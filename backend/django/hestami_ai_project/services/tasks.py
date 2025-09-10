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
from .models.base_models import ServiceRequest, ServiceResearch

logger = logging.getLogger(__name__)

# Redis client for distributed locks
redis_client = redis.Redis.from_url(
    settings.CELERY_BROKER_URL if hasattr(settings, 'CELERY_BROKER_URL') else 'redis://redis:6379/0'
)

# Configuration for HTML chunker API
HTML_CHUNKER_URL = os.environ.get('HTML_CHUNKER_URL', 'http://html-chunker:8000')
HTML_CHUNKER_LLM = os.environ.get('HTML_CHUNKER_LLM', 'ollama')
HTML_CHUNKER_MODEL = os.environ.get('HTML_CHUNKER_MODEL', 'qwen2.5:14b-instruct-q4_1')
HTML_CHUNKER_MAX_TOKENS = int(os.environ.get('HTML_CHUNKER_MAX_TOKENS', '24048'))
HTML_CHUNKER_OVERLAP = float(os.environ.get('HTML_CHUNKER_OVERLAP', '0.1'))
HTML_CHUNKER_LOG_LEVEL = os.environ.get('HTML_CHUNKER_LOG_LEVEL', 'DEBUG')

# Configuration for service request processing
SERVICE_REQUEST_PROCESSOR_INTERVAL = float(os.environ.get('SERVICE_REQUEST_PROCESSOR_INTERVAL', '5'))

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
