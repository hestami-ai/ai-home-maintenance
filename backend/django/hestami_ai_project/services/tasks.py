"""
Celery tasks for the services app.
"""
import os
import json
import time
import logging
import tempfile
import requests
from typing import Dict, Any, Optional, List
from celery import shared_task
import redis
from django.conf import settings
from django.db import transaction
from django.core.files.base import ContentFile
from .models.base_models import ServiceRequest, ServiceResearch, ServiceProviderScrapedData

# Use celery logger for task logs (goes to celery.log)
logger = logging.getLogger('celery')

# Redis client for distributed locks
redis_client = redis.Redis.from_url(
    settings.CELERY_BROKER_URL if hasattr(settings, 'CELERY_BROKER_URL') else 'redis://redis:6379/0'
)

# Configuration for HTML chunker API
HTML_CHUNKER_URL = os.environ.get('HTML_CHUNKER_URL', 'http://html-chunker:8000')
HTML_CHUNKER_LLM = os.environ.get('HTML_CHUNKER_LLM', 'ollama')
HTML_CHUNKER_MODEL = os.environ.get('HTML_CHUNKER_MODEL', 'qwen3:4b-q4_K_M')
HTML_CHUNKER_MAX_TOKENS = int(os.environ.get('HTML_CHUNKER_MAX_TOKENS', '24048'))
HTML_CHUNKER_OVERLAP = float(os.environ.get('HTML_CHUNKER_OVERLAP', '0.1'))
HTML_CHUNKER_LOG_LEVEL = os.environ.get('HTML_CHUNKER_LOG_LEVEL', 'DEBUG')

# Configuration for service request processing
SERVICE_REQUEST_PROCESSOR_INTERVAL = float(os.environ.get('SERVICE_REQUEST_PROCESSOR_INTERVAL', '5'))

# Configuration for service provider scraped data processing
SERVICE_PROVIDER_BATCH_SIZE = int(os.environ.get('SERVICE_PROVIDER_BATCH_SIZE', '1'))
SERVICE_PROVIDER_PROCESSOR_INTERVAL = float(os.environ.get('SERVICE_PROVIDER_PROCESSOR_INTERVAL', '60'))

@shared_task
def process_pending_service_requests() -> str:
    """
    Process pending service requests by launching the Temporal IO workflow.
    
    This task scans for service requests with a status of PENDING and launches
    the Temporal IO service request workflow for each one.
    
    Returns:
        str: A message indicating the number of processed requests
    """
    from temporalio.client import Client
    import asyncio
    
    # Get pending service requests
    pending_requests = ServiceRequest.objects.filter(status=ServiceRequest.Status.PENDING)
    
    if not pending_requests.exists():
        logger.debug("No pending service requests found")
        return "No pending service requests found"
    
    logger.info(f"Found {pending_requests.count()} pending service requests")
    
    # Process each pending request
    for request in pending_requests:
        try:
            # Launch the Temporal workflow asynchronously
            async def start_workflow() -> None:
                # Connect to Temporal server
                client = await Client.connect(
                    settings.TEMPORAL_SETTINGS['host'],
                    namespace=settings.TEMPORAL_SETTINGS['namespace']
                )
                
                # Start the workflow
                await client.start_workflow(
                    "ServiceRequestProcessingWorkflow",  # Workflow name
                    str(request.id),  # Input parameter
                    id=f"service-request-{request.id}",  # Unique workflow ID
                    task_queue=os.environ.get('SERVICE_REQUEST_TASK_QUEUE', 'service-request-tasks')
                )
                
                logger.info(f"Started workflow for service request {request.id}")
            
            # Run the async function
            asyncio.run(start_workflow())
            
        except Exception as e:
            logger.error(f"Error launching workflow for service request {request.id}: {str(e)}")
    
    return f"Processed {pending_requests.count()} pending service requests"

@shared_task
def start_service_request_processor() -> str:
    """
    Start the service request processor task.
    
    This task is scheduled to run periodically by Celery Beat.
    
    Returns:
        str: A message indicating the task has been started
    """
    logger.info("Starting service request processor")
    process_pending_service_requests.apply_async()
    return "Service request processor started"


@shared_task(
    name="services.process_pending_service_provider_scraped_data",
    ignore_result=False,
    soft_time_limit=300,
    time_limit=360,
    acks_late=True
)
def process_pending_service_provider_scraped_data(scraped_data_id: str = None) -> Dict[str, Any]:
    """
    Process pending service provider scraped data by launching DBOS workflows.
    
    This task scans for ServiceProviderScrapedData records with scrape_status of
    'pending' or 'paused_intervention' (for retry after manual resolution) and
    launches a DBOS workflow for each one.
    
    Args:
        scraped_data_id: Optional specific scraped data ID to process. If provided,
                        only this record will be processed. Otherwise, batch processing occurs.
    
    Batch size is configurable via SERVICE_PROVIDER_BATCH_SIZE env var (default: 1).
    
    Returns:
        Dict with processing summary
    """
    from services.workflows import ServiceProviderIngestionWorkflow
    
    logger.info(f"Checking for pending service provider scraped data (specific_id={scraped_data_id})")
    
    try:
        # If specific ID provided, process only that record
        if scraped_data_id:
            pending_records = ServiceProviderScrapedData.objects.filter(
                id=scraped_data_id,
                scrape_status__in=['pending', 'paused_intervention', 'in_progress']
            )
        else:
            # Query for pending or paused_intervention records
            pending_records = ServiceProviderScrapedData.objects.filter(
                scrape_status__in=['pending', 'paused_intervention']
            ).order_by('created_at')[:SERVICE_PROVIDER_BATCH_SIZE]
        
        if not pending_records.exists():
            logger.debug("No pending service provider scraped data found")
            return {
                'status': 'success',
                'processed': 0,
                'message': 'No pending records found'
            }
        
        logger.info(f"Found {pending_records.count()} pending scraped data records to process")
        
        processed_count = 0
        failed_count = 0
        
        # Process each record
        for record in pending_records:
            try:
                # Acquire distributed lock to prevent duplicate processing
                lock_key = f"scraped_data_lock:{record.id}"
                lock = redis_client.lock(lock_key, timeout=300)  # 5 minute lock
                
                if not lock.acquire(blocking=False):
                    logger.warning(f"Could not acquire lock for scraped data {record.id}, skipping")
                    continue
                
                try:
                    # Update status to in_progress
                    with transaction.atomic():
                        record.scrape_status = 'in_progress'
                        record.workflow_id = f"provider-ingestion-{record.id}"
                        record.save(update_fields=['scrape_status', 'workflow_id'])
                    
                    logger.info(f"Starting DBOS workflow for scraped data {record.id}")
                    
                    # Get the initialized DBOS instance
                    from services.dbos_init import get_dbos_instance
                    dbos_instance = get_dbos_instance()
                    
                    if dbos_instance is None:
                        raise Exception("DBOS not initialized - cannot launch workflow")
                    
                    # Create workflow instance and launch
                    workflow = ServiceProviderIngestionWorkflow(dbos_instance)
                    
                    # Launch workflow (DBOS handles async execution)
                    result = workflow.process_scraped_data(str(record.id))
                    
                    logger.info(
                        f"DBOS workflow launched for scraped data {record.id}: "
                        f"status={result.get('status')}"
                    )
                    
                    processed_count += 1
                    
                finally:
                    # Release lock
                    try:
                        lock.release()
                    except Exception as e:
                        logger.warning(f"Error releasing lock for {record.id}: {e}")
                
            except Exception as e:
                logger.exception(f"Error processing scraped data {record.id}: {e}")
                failed_count += 1
                
                # Update record to failed status
                try:
                    with transaction.atomic():
                        record.scrape_status = 'failed'
                        record.error_message = f"Task error: {str(e)}"
                        record.save(update_fields=['scrape_status', 'error_message'])
                except Exception as save_error:
                    logger.error(f"Failed to update error status for {record.id}: {save_error}")
        
        summary = {
            'status': 'success',
            'processed': processed_count,
            'failed': failed_count,
            'message': f"Processed {processed_count} records, {failed_count} failed"
        }
        
        logger.info(f"Service provider scraped data processing complete: {summary}")
        return summary
        
    except Exception as e:
        logger.exception(f"Error in process_pending_service_provider_scraped_data: {e}")
        return {
            'status': 'error',
            'processed': 0,
            'failed': 0,
            'message': str(e)
        }
