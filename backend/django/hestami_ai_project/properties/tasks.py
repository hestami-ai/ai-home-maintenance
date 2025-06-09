"""
Celery tasks for the properties app.
"""
import os
import json
import time
import asyncio
import logging
from typing import Dict, Any, Optional, List
from celery import shared_task
from django.db import transaction
from django.db.models import Q
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

# Import Temporal SDK
from temporalio.client import Client
from temporalio.common import RetryPolicy

from .models import Property, PropertyStatus

logger = logging.getLogger(__name__)

# Configuration for Temporal service
TEMPORAL_HOST = os.environ.get('TEMPORAL_HOST', 'temporal:7233')
TEMPORAL_NAMESPACE = os.environ.get('TEMPORAL_NAMESPACE', 'default')
TEMPORAL_PROPERTY_TASK_QUEUE = os.environ.get('PROPERTY_TASK_QUEUE', 'property-tasks')

# Sleep time between processing cycles (in seconds)
PROPERTY_COUNTY_PROCESSOR_INTERVAL = int(os.environ.get('PROPERTY_COUNTY_PROCESSOR_INTERVAL', '5'))
PERMIT_PROCESSOR_INTERVAL = int(os.environ.get('PERMIT_PROCESSOR_INTERVAL', '5'))

# Permit retry interval (in days, defaults to 7 days)
PERMIT_RETRY_INTERVAL_DAYS = int(os.environ.get('PERMIT_RETRY_INTERVAL_DAYS', '7'))


@shared_task(
    bind=True,
    name="properties.process_property_county_queue",
    ignore_result=False,
    soft_time_limit=3600,  # 1 hour soft time limit
    time_limit=3900,  # 1 hour 5 minutes hard time limit
    acks_late=True
)
def process_property_county_queue(self):
    """
    Background task that continuously checks for properties with status PENDING and missing county info,
    and launches a Temporal workflow to find the county for each property.
    
    This task runs in an infinite loop, checking for properties that need processing,
    processing them in batches, and then sleeping for a configurable amount of time
    before checking again.
    """
    # Get the sleep time from environment variables
    sleep_time = PROPERTY_COUNTY_PROCESSOR_INTERVAL
    
    logger.debug(f"Starting property county processor with sleep time of {sleep_time} seconds")
    
    # Run in an infinite loop
    while True:
        try:
            # Find properties with PENDING status and empty county field
            pending_properties = Property.objects.filter(
                status=PropertyStatus.PENDING
            ).filter(
                Q(county__isnull=True) | Q(county='')
            ).order_by('created_at')[:10]  # Process in batches of 10
            
            if not pending_properties.exists():
                logger.debug("No pending properties found. Sleeping...")
                time.sleep(sleep_time)
                continue
            
            logger.debug(f"Found {pending_properties.count()} pending properties that need county information")
            
            # Process each property
            for property_obj in pending_properties:
                try:
                    with transaction.atomic():
                        # Prevent other processes from processing this property
                        # by updating its status to a temporary value
                        Property.objects.filter(id=property_obj.id).update(
                            status="COUNTY_PROCESSING"
                        )
                    
                    # Launch Temporal workflow to find county information
                    workflow_launched = launch_property_county_workflow(property_obj.id)
                    
                    if workflow_launched:
                        logger.debug(f"Successfully launched county workflow for property {property_obj.id}")
                        # Note: The workflow will update the property status to ACTIVE when it completes
                    else:
                        logger.error(f"Failed to launch county workflow for property {property_obj.id}")
                        # Revert status back to PENDING if workflow launch failed
                        Property.objects.filter(id=property_obj.id).update(
                            status=PropertyStatus.PENDING
                        )
                
                except Exception as e:
                    logger.exception(f"Error processing property {property_obj.id}: {str(e)}")
                    # Revert status in case of error
                    try:
                        Property.objects.filter(id=property_obj.id).update(
                            status=PropertyStatus.PENDING
                        )
                    except Exception as revert_error:
                        logger.error(f"Error reverting property status: {str(revert_error)}")
            
            # Sleep before the next cycle
            logger.debug(f"Completed processing cycle. Sleeping for {sleep_time} seconds...")
            time.sleep(sleep_time)
        
        except Exception as e:
            logger.exception(f"Error in property county processor loop: {str(e)}")
            # Sleep before trying again
            time.sleep(sleep_time)


def launch_property_county_workflow(property_id: str) -> bool:
    """
    Launch a Temporal workflow to find and update the county for a property.
    Uses the Temporal Python SDK with gRPC directly.
    
    Args:
        property_id: The ID of the property to process
        
    Returns:
        bool: True if workflow was successfully launched, False otherwise
    """
    try:
        logger.debug(f"Launching PropertyCountyWorkflow for property {property_id}")
        
        # Create a workflow ID that is unique to this property
        workflow_id = f"property-county-{property_id}"
        
        # Use asyncio to run the async Temporal client code
        return asyncio.run(_launch_workflow(workflow_id, property_id))
    
    except Exception as e:
        logger.exception(f"Error launching PropertyCountyWorkflow: {str(e)}")
        return False


async def _launch_workflow(workflow_id: str, property_id: str) -> bool:
    """
    Internal async function to launch the Temporal workflow.
    
    Args:
        workflow_id: The unique ID for the workflow
        property_id: The ID of the property to process
        
    Returns:
        bool: True if the workflow was successfully launched
    """
    try:
        # Connect to the Temporal server using gRPC
        client = await Client.connect(
            TEMPORAL_HOST,
            namespace=TEMPORAL_NAMESPACE
        )
        
        logger.debug(f"Connected to Temporal server at {TEMPORAL_HOST}")
        
        # Start the workflow
        # Note: This doesn't execute the workflow, just starts it
        handle = await client.start_workflow(
            "PropertyCountyWorkflow",  # The workflow type name
            # Pass the property_id as a string since it's a UUID
            args=[str(property_id)],
            id=workflow_id,           # Unique workflow ID
            task_queue=TEMPORAL_PROPERTY_TASK_QUEUE,
            retry_policy=RetryPolicy(
                initial_interval=timedelta(seconds=1),
                maximum_interval=timedelta(seconds=10),
                maximum_attempts=3
            )
        )
        
        logger.debug(f"Successfully started workflow {workflow_id} with run ID: {handle.run_id}")
        return True
        
    except Exception as e:
        logger.exception(f"Error in _launch_workflow: {str(e)}")
        return False


@shared_task(
    bind=True,
    name="properties.process_permit_retrieval_queue",
    ignore_result=False,
    soft_time_limit=3600,  # 1 hour soft time limit
    time_limit=3900,  # 1 hour 5 minutes hard time limit
    acks_late=True
)
def process_permit_retrieval_queue(self):
    """
    Background task that continuously checks for properties with status NEVER_ATTEMPTED
    for permit retrieval, and launches a Temporal workflow to retrieve permit history.
    
    This task runs in an infinite loop, checking for properties that need processing,
    processing them in batches, and then sleeping for a configurable amount of time
    before checking again.
    """
    # Get the sleep time from environment variables
    sleep_time = PERMIT_PROCESSOR_INTERVAL
    
    logger.debug(f"Starting permit retrieval processor with sleep time of {sleep_time} seconds")
    
    # Run in an infinite loop
    while True:
        try:
            # Find properties ready for permit retrieval:
            # - permit_retrieval_status = 'NEVER_ATTEMPTED'
            # - status = 'ACTIVE' (property is active)
            # - county is not null/empty
            # - address is not null/empty
            ready_properties = Property.objects.filter(
                permit_retrieval_status='NEVER_ATTEMPTED',
                status=PropertyStatus.ACTIVE
            ).filter(
                Q(county__isnull=False) & ~Q(county='')
            ).filter(
                Q(address__isnull=False) & ~Q(address='')
            ).order_by('created_at')  # Process oldest first
            
            if not ready_properties.exists():
                logger.debug("No properties ready for permit retrieval. Sleeping...")
                time.sleep(sleep_time)
                continue
            
            logger.info(f"Found {ready_properties.count()} properties ready for permit retrieval")
            
            # Process each property
            for property_obj in ready_properties:
                try:
                    with transaction.atomic():
                        # Update status to SCHEDULED to prevent other processes from processing
                        Property.objects.filter(id=property_obj.id).update(
                            permit_retrieval_status='SCHEDULED'
                        )
                    
                    # Launch Temporal workflow to retrieve permit history
                    workflow_launched = launch_permit_retrieval_workflow(
                        str(property_obj.id),
                        property_obj.address,
                        property_obj.county
                    )
                    
                    if workflow_launched:
                        logger.info(f"Successfully launched permit retrieval workflow for property {property_obj.id}")
                        # Note: The workflow will update the status as it progresses
                    else:
                        logger.error(f"Failed to launch permit retrieval workflow for property {property_obj.id}")
                        # Revert status back to NEVER_ATTEMPTED if workflow launch failed
                        Property.objects.filter(id=property_obj.id).update(
                            permit_retrieval_status='NEVER_ATTEMPTED'
                        )
                
                except Exception as e:
                    logger.exception(f"Error processing property {property_obj.id} for permit retrieval: {str(e)}")
                    # Revert status in case of error
                    try:
                        Property.objects.filter(id=property_obj.id).update(
                            permit_retrieval_status='NEVER_ATTEMPTED'
                        )
                    except Exception as revert_error:
                        logger.error(f"Error reverting permit retrieval status: {str(revert_error)}")
            
            # Sleep before the next cycle
            logger.debug(f"Completed permit processing cycle. Sleeping for {sleep_time} seconds...")
            time.sleep(sleep_time)
        
        except Exception as e:
            logger.exception(f"Error in permit retrieval processor loop: {str(e)}")
            # Sleep before trying again
            time.sleep(sleep_time)


def launch_permit_retrieval_workflow(property_id: str, address: str, county: str) -> bool:
    """
    Launch a Temporal workflow to retrieve permit history for a property.
    Uses the Temporal Python SDK with gRPC directly.
    
    Args:
        property_id: The ID of the property to process
        address: The property address
        county: The property county
        
    Returns:
        bool: True if workflow was successfully launched, False otherwise
    """
    try:
        logger.debug(f"Launching PropertyPermitRetrievalWorkflow for property {property_id}")
        
        # Create a workflow ID that is unique to this property
        workflow_id = f"property-permit-retrieval-{property_id}"
        
        # Store the workflow ID in the property for tracking
        Property.objects.filter(id=property_id).update(
            permit_retrieval_workflow_id=workflow_id
        )
        
        # Get the retry interval from environment variables
        permit_retry_days = int(os.getenv('PERMIT_RETRY_INTERVAL_DAYS', '7'))
        
        # Use asyncio to run the async Temporal client code
        return asyncio.run(_launch_permit_workflow(workflow_id, property_id, address, county, permit_retry_days))
    
    except Exception as e:
        logger.exception(f"Error launching PropertyPermitRetrievalWorkflow: {str(e)}")
        return False


async def _launch_permit_workflow(workflow_id: str, property_id: str, address: str, county: str, permit_retry_interval_days: int) -> bool:
    """
    Internal async function to launch the permit retrieval Temporal workflow.
    
    Args:
        workflow_id: The unique ID for the workflow
        property_id: The ID of the property to process
        address: The property address
        county: The property county
        
    Returns:
        bool: True if the workflow was successfully launched
    """
    try:
        # Connect to the Temporal server using gRPC
        client = await Client.connect(
            TEMPORAL_HOST,
            namespace=TEMPORAL_NAMESPACE
        )
        
        logger.debug(f"Connected to Temporal server at {TEMPORAL_HOST}")
        
        # Start the workflow
        handle = await client.start_workflow(
            "PropertyPermitRetrievalWorkflow",  # The workflow type name
            # Pass the parameters the workflow needs
            args=[str(property_id), address, county, permit_retry_interval_days],
            id=workflow_id,           # Unique workflow ID
            task_queue=TEMPORAL_PROPERTY_TASK_QUEUE,
            retry_policy=RetryPolicy(
                initial_interval=timedelta(seconds=10),
                maximum_interval=timedelta(minutes=5),
                maximum_attempts=3
            )
        )
        
        logger.debug(f"Successfully started permit retrieval workflow {workflow_id} with run ID: {handle.run_id}")
        return True
        
    except Exception as e:
        logger.exception(f"Error in _launch_permit_workflow: {str(e)}")
        return False


# Function to start the property county processor
def start_property_county_processor():
    """
    Start the property county processor task.
    This should be called when the Celery worker starts.
    """
    logger.info("Starting property county processor task")
    process_property_county_queue.delay()


# Function to start the permit retrieval processor
def start_permit_retrieval_processor():
    """
    Start the permit retrieval processor task.
    This should be called when the Celery worker starts.
    """
    logger.info("Starting permit retrieval processor task")
    process_permit_retrieval_queue.delay()
