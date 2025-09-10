import asyncio
import logging
import os
from dotenv import load_dotenv
from temporalio.client import Client
from temporalio.worker import Worker

# Import search attributes registration
from register_search_attributes import register_at_startup

from workflows.subscription_workflow import (
    CreateSubscriptionWorkflow,
    UpdateSubscriptionWorkflow,
    CancelSubscriptionWorkflow
)
from workflows.property_workflow import (
    PropertyCountyWorkflow,
    PropertyPermitRetrievalWorkflow
)
from workflows.service_request_workflow import ServiceRequestProcessingWorkflow
from workflows.search_attributes_marker import SearchAttributesRegistrationMarker
from activities.subscription_activities import (
    create_square_subscription,
    update_square_subscription,
    cancel_square_subscription,
    update_user_subscription_status
)
from activities.property_activities import (
    get_property_details,
    find_property_county,
    update_property_county,
    get_property_permit_history,
    update_property_permit_status,
    create_permit_history_record,
    process_property_scraped_data,
    convert_property_scraped_data_to_permit_history_record
)
from activities.service_request_activities import (
    get_service_request_details,
    update_service_request_status
)

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    # Register search attributes at startup
    logger.info("Registering custom search attributes...")
    registered = await register_at_startup()
    if registered:
        logger.info("Successfully registered search attributes")
    else:
        logger.info("Search attributes registration skipped (already registered)")
    
    # Connect to Temporal server
    client = await Client.connect(
        os.getenv("TEMPORAL_HOST", "temporal:7233"),
        namespace=os.getenv("TEMPORAL_NAMESPACE", "default")
    )

    # Task queue names
    subscription_task_queue = os.getenv("SUBSCRIPTION_TASK_QUEUE", "subscription-tasks")
    property_task_queue = os.getenv("PROPERTY_TASK_QUEUE", "property-tasks")
    service_request_task_queue = os.getenv("SERVICE_REQUEST_TASK_QUEUE", "service-request-tasks")
    
    # Create subscription worker
    subscription_worker = Worker(
        client,
        task_queue=subscription_task_queue,
        workflows=[
            CreateSubscriptionWorkflow,
            UpdateSubscriptionWorkflow,
            CancelSubscriptionWorkflow
        ],
        activities=[
            create_square_subscription,
            update_square_subscription,
            cancel_square_subscription,
            update_user_subscription_status
        ]
    )
    
    # Create property worker
    property_worker = Worker(
        client,
        task_queue=property_task_queue,
        workflows=[
            PropertyCountyWorkflow,
            PropertyPermitRetrievalWorkflow,
            SearchAttributesRegistrationMarker
        ],
        activities=[
            get_property_details,
            find_property_county,
            update_property_county,
            get_property_permit_history,
            update_property_permit_status,
            create_permit_history_record,
            process_property_scraped_data,
            convert_property_scraped_data_to_permit_history_record
        ]
    )

    logger.info(
        "Starting subscription worker on task queue %s in namespace %s", 
        subscription_task_queue,
        os.getenv("TEMPORAL_NAMESPACE", "default")
    )
    
    logger.info(
        "Starting property worker on task queue %s in namespace %s", 
        property_task_queue,
        os.getenv("TEMPORAL_NAMESPACE", "default")
    )
    
    # Create service request worker
    service_request_worker = Worker(
        client,
        task_queue=service_request_task_queue,
        workflows=[
            ServiceRequestProcessingWorkflow
        ],
        activities=[
            get_service_request_details,
            update_service_request_status
        ]
    )

    logger.info(
        "Starting service request worker on task queue %s in namespace %s", 
        service_request_task_queue,
        os.getenv("TEMPORAL_NAMESPACE", "default")
    )
    
    # Run all workers
    await asyncio.gather(
        subscription_worker.run(),
        property_worker.run(),
        service_request_worker.run()
    )

if __name__ == "__main__":
    asyncio.run(main())
