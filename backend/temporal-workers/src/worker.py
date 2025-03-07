import asyncio
import logging
import os
from dotenv import load_dotenv
from temporalio.client import Client
from temporalio.worker import Worker

from workflows.subscription_workflow import (
    CreateSubscriptionWorkflow,
    UpdateSubscriptionWorkflow,
    CancelSubscriptionWorkflow
)
from activities.subscription_activities import (
    create_square_subscription,
    update_square_subscription,
    cancel_square_subscription,
    update_user_subscription_status
)

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    # Connect to Temporal server
    client = await Client.connect(
        os.getenv("TEMPORAL_HOST", "temporal:7233"),
        namespace=os.getenv("TEMPORAL_NAMESPACE", "default")
    )

    # Run worker
    worker = Worker(
        client,
        task_queue=os.getenv("TEMPORAL_TASK_QUEUE", "subscription-tasks"),
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

    logger.info(
        "Starting worker on task queue %s in namespace %s", 
        os.getenv("TEMPORAL_TASK_QUEUE", "subscription-tasks"),
        os.getenv("TEMPORAL_NAMESPACE", "default")
    )
    
    await worker.run()

if __name__ == "__main__":
    asyncio.run(main())
