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
from .models import ServiceRequest, ServiceResearch

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

def process_research_content(research_entry: ServiceResearch) -> Dict[str, Any]:
    """
    Process the research content using the HTML chunker API.
    
    Args:
        research_entry: The ServiceResearch instance to process
        
    Returns:
        Dict with processing results
    """
    logger.info(f"Starting to process research content for entry: {research_entry.id}")
    
    if not research_entry.research_content:
        logger.warning(f"No research content to process for entry: {research_entry.id}")
        return {
            "success": False,
            "message": "No research content to process"
        }
    
    try:
        # Get HTML chunker URL from environment variables with fallback options
        html_chunker_url = os.environ.get('HTML_CHUNKER_URL', 'http://html-chunker:8000')
        
        # Try alternative URLs if the main one doesn't work
        alternative_urls = [
            'http://localhost:8070',  # Try localhost
            'http://127.0.0.1:8070',  # Try IP directly
        ]
        
        # Log the HTML chunker configuration
        logger.info(f"HTML Chunker configuration: URL={html_chunker_url}, LLM={HTML_CHUNKER_LLM}, Model={HTML_CHUNKER_MODEL}")
        
        # Check if the HTML chunker service is accessible
        chunker_accessible = False
        working_url = html_chunker_url
        
        # Try the main URL first
        try:
            health_url = f"{html_chunker_url}/health"
            logger.info(f"Checking HTML chunker health at: {health_url}")
            
            health_response = requests.get(health_url, timeout=5)
            if health_response.status_code == 200:
                logger.info(f"HTML chunker service is accessible: {health_response.text}")
                chunker_accessible = True
            else:
                logger.warning(f"HTML chunker service returned non-200 status: {health_response.status_code}")
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to connect to HTML chunker service at {html_chunker_url}: {str(e)}")
            
            # Try alternative URLs
            for alt_url in alternative_urls:
                try:
                    logger.info(f"Trying alternative HTML chunker URL: {alt_url}")
                    alt_health_url = f"{alt_url}/health"
                    alt_health_response = requests.get(alt_health_url, timeout=5)
                    
                    if alt_health_response.status_code == 200:
                        logger.info(f"Alternative HTML chunker service is accessible at {alt_url}: {alt_health_response.text}")
                        chunker_accessible = True
                        working_url = alt_url
                        break
                except requests.exceptions.RequestException as alt_e:
                    logger.error(f"Failed to connect to alternative HTML chunker service at {alt_url}: {str(alt_e)}")
        
        if not chunker_accessible:
            logger.error("Could not connect to any HTML chunker service. Aborting processing.")
            return {
                "success": False,
                "message": "Could not connect to HTML chunker service"
            }
        
        # Create a temporary file for the HTML content
        with tempfile.NamedTemporaryFile(suffix='.html', delete=False, mode='w+', encoding='utf-8') as html_file:
            html_file.write(research_entry.research_content)
            html_file_path = html_file.name
        
        logger.info(f"Created temporary HTML file at {html_file_path} for research entry: {research_entry.id}")
        
        try:
            # Prepare the API request
            url = f"{working_url}/extract"
            
            # Prepare the files dictionary
            files = {
                'file': ('content.html', open(html_file_path, 'rb'), 'text/html')
            }
            
            # Prepare form data
            data = {
                'llm': HTML_CHUNKER_LLM,
                'model': HTML_CHUNKER_MODEL,
                'max_tokens': HTML_CHUNKER_MAX_TOKENS,
                'overlap_percent': HTML_CHUNKER_OVERLAP,
                'log_level': HTML_CHUNKER_LOG_LEVEL
            }
            
            # Add raw text content if available
            if research_entry.research_content_raw_text:
                data['text_content'] = research_entry.research_content_raw_text
                logger.info(f"Including raw text content ({len(research_entry.research_content_raw_text)} characters)")
            
            # Make the API request
            logger.info(f"Sending request to HTML chunker API: {url} with params: {data}")
            
            # Set a longer timeout for the request
            response = requests.post(url, files=files, data=data, timeout=300)  # 5-minute timeout
            
            # Check the response
            if response.status_code == 200:
                try:
                    # Parse the JSON response
                    result = response.json()
                    logger.info(f"Successfully processed research entry {research_entry.id}")
                    
                    # Save the extracted data to the research entry
                    research_entry.research_data = result
                    research_entry.save(update_fields=['research_data'])
                    logger.info(f"Saved extracted data to research entry {research_entry.id}")
                    
                    return {
                        "success": True,
                        "message": "Successfully processed research content",
                        "data": result
                    }
                except ValueError as json_error:
                    logger.error(f"Error parsing JSON response: {str(json_error)}")
                    return {
                        "success": False,
                        "message": f"Error parsing JSON response: {str(json_error)}"
                    }
            else:
                logger.error(f"Error processing research content: {response.status_code} - {response.text}")
                return {
                    "success": False,
                    "message": f"Error processing research content: {response.status_code} - {response.text}"
                }
        
        finally:
            # Clean up the temporary file
            try:
                os.unlink(html_file_path)
                logger.info(f"Removed temporary HTML file at {html_file_path}")
            except Exception as cleanup_error:
                logger.error(f"Error cleaning up temporary file: {str(cleanup_error)}")
    
    except Exception as e:
        logger.exception(f"Error processing research content: {str(e)}")
        return {
            "success": False,
            "message": f"Error processing research content: {str(e)}"
        }


@shared_task(
    bind=True,
    name="services.process_research_queue",
    ignore_result=False,
    soft_time_limit=3600,  # 1 hour soft time limit
    time_limit=3900,  # 1 hour 5 minutes hard time limit
    acks_late=True
)
def process_research_queue(self):
    """
    Background task that continuously checks for service requests in "In Research" status
    and processes them serially.
    
    This task runs in a loop, checking for service requests that need processing,
    processing them one at a time, and then sleeping for a configurable amount of time
    before checking again.
    """
    # Get the sleep time from environment variables or use a default of 5 seconds
    sleep_time = int(os.environ.get('RESEARCH_QUEUE_SLEEP_TIME', 5))
    
    logger.debug(f"Starting research queue processor with sleep time of {sleep_time} seconds")
    
    # Run in an infinite loop
    while True:
        try:
            # Get all service requests in "In Research" status
            service_requests = ServiceRequest.objects.filter(
                status=ServiceRequest.Status.IN_RESEARCH
            ).order_by('priority', 'created_at')
            
            if not service_requests.exists():
                logger.debug("No service requests in 'In Research' status found. Sleeping...")
                time.sleep(sleep_time)
                continue
            
            logger.debug(f"Found {service_requests.count()} service requests in 'In Research' status")
            
            # Process each service request
            for service_request in service_requests:
                # Get all research entries for this service request that have content
                # and don't already have research data
                research_entries = service_request.research_entries.filter(
                    research_content__isnull=False,
                    research_content__gt=''
                ).exclude(
                    research_data__has_key='business_info'
                )
                
                if not research_entries.exists():
                    logger.debug(f"No research entries to process for service request {service_request.id}")
                    continue
                
                logger.debug(f"Found {research_entries.count()} research entries to process for service request {service_request.id}")
                
                # Process each research entry serially
                for research_entry in research_entries:
                    try:
                        logger.debug(f"Processing research entry {research_entry.id} for service request {service_request.id}")
                        
                        # Process the research content
                        result = process_research_content(research_entry)
                        
                        if result["success"]:
                            logger.debug(f"Successfully processed research entry {research_entry.id}")
                        else:
                            logger.error(f"Failed to process research entry {research_entry.id}: {result['message']}")
                    
                    except Exception as e:
                        logger.exception(f"Error processing research entry {research_entry.id}: {str(e)}")
            
            # Sleep before checking again
            logger.debug(f"Completed processing cycle. Sleeping for {sleep_time} seconds...")
            time.sleep(sleep_time)
        
        except Exception as e:
            logger.exception(f"Error in research queue processor: {str(e)}")
            # Sleep before trying again
            time.sleep(sleep_time)


# Add a dummy task to handle old queued tasks gracefully
@shared_task(name='services.process_research_entry')
def process_research_entry(research_entry_id):
    """
    Dummy task to handle old queued tasks that were scheduled before the architecture change.
    This prevents errors when old tasks are pulled from the queue.
    """
    logger.info(f"Received old process_research_entry task for entry ID: {research_entry_id}. "
                f"This task is deprecated and the entry will be processed by the background task.")
    return {
        'success': True,
        'message': 'Task is deprecated, entry will be processed by the background task'
    }


# Process research entries to create service providers
@shared_task(
    name='services.process_service_provider_creation',
    bind=True,
    max_retries=None,
    soft_time_limit=3600,  # 1 hour soft time limit (matches process_research_queue)
    time_limit=3900        # 1 hour 5 min hard time limit (matches process_research_queue)
)
def process_service_provider_creation(self):
    # TODO: Migrate this infinite background task to Temporal IO for robust, long-running workflow management.

    """
    Task that continuously processes ServiceResearch entries with valid business information
    but haven't been converted to ServiceProvider records yet. Runs as an infinite loop,
    processing entries in batches and sleeping between cycles.
    """
    import time
    interval = int(os.environ.get('SERVICE_PROVIDER_CREATION_INTERVAL', 5))
    batch_size = int(os.environ.get('SERVICE_PROVIDER_CREATION_BATCH_SIZE', 5))
    logger.info(f"Starting service provider creation processor with interval {interval}s and batch size {batch_size}")

    while True:
        try:
            # Get all research entries that haven't been processed for service provider creation
            # and have valid business information
            research_entries = ServiceResearch.objects.filter(
                service_provider_created=False,
                research_data__has_key='business_info'
            )
            if not research_entries.exists():
                logger.debug("No research entries found for service provider creation. Sleeping...")
                time.sleep(interval)
                continue

            logger.info(f"Found {research_entries.count()} research entries for potential service provider creation")

            for research_entry in research_entries[:batch_size]:
                try:
                    # Extract business info from research data
                    research_data = research_entry.research_data
                    business_info = research_data.get('business_info', {})

                    # Check if business name is present
                    business_name = business_info.get('name')
                    if not business_name:
                        logger.debug(f"Research entry {research_entry.id} has no business name. Skipping.")
                        # Mark as processed to avoid checking it again
                        research_entry.service_provider_created = True
                        research_entry.save(update_fields=['service_provider_created'])
                        continue

                    # Check if at least one contact method is present
                    contact_info = business_info.get('contact_information', {})
                    has_phone = bool(contact_info.get('phone'))
                    has_address = bool(contact_info.get('address'))
                    has_website = bool(contact_info.get('website'))

                    if not (has_phone or has_address or has_website):
                        logger.debug(f"Research entry {research_entry.id} has no contact information. Skipping.")
                        # Mark as processed to avoid checking it again
                        research_entry.service_provider_created = True
                        research_entry.save(update_fields=['service_provider_created'])
                        continue

                    logger.info(f"Creating service provider from research entry {research_entry.id} for business '{business_name}'")
                    # Create the service provider
                    with transaction.atomic():
                        # Check if a service provider with this name already exists
                        from .models import ServiceProvider
                        existing_provider = ServiceProvider.objects.filter(company_name=business_name).first()
                        if existing_provider:
                            logger.info(f"Service provider with name '{business_name}' already exists (ID: {existing_provider.id}). Updating research entry.")
                            # Mark the research entry as processed
                            research_entry.service_provider_created = True
                            research_entry.save(update_fields=['service_provider_created'])
                            continue
                        # Create a new service provider
                        service_provider = ServiceProvider.objects.create(
                            company_name=business_name,
                            description=business_info.get('description', ''),
                            service_area={
                                'areas': business_info.get('service_areas', [])
                            },
                            is_available=True
                        )
                        # Mark the research entry as processed
                        research_entry.service_provider_created = True
                        research_entry.save(update_fields=['service_provider_created'])
                        logger.info(f"Successfully created service provider {service_provider.id} for business '{business_name}'")
                except Exception as e:
                    logger.exception(f"Error processing research entry {research_entry.id} for service provider creation: {str(e)}")
            logger.debug(f"Completed service provider creation cycle.")
        except Exception as e:
            logger.exception(f"Error in service provider creation processor loop: {str(e)}")
            time.sleep(interval)
                    

    


# Function to start the research queue processor
def start_research_queue_processor():
    """
    Start the research queue processor task.
    This should be called when the Celery worker starts.
    """
    logger.info("Starting research queue processor task")
    process_research_queue.delay()
    
    # Also start the service provider creation processor
    logger.info("Starting service provider creation processor task")
    process_service_provider_creation.apply_async(countdown=5)
