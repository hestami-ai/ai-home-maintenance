from datetime import timedelta
from typing import Optional
import os

from temporalio import workflow
from temporalio.common import RetryPolicy

# Common retry policy for subscription operations
SUBSCRIPTION_RETRY_POLICY = RetryPolicy(
    initial_interval=timedelta(seconds=1),
    maximum_interval=timedelta(seconds=10),
    maximum_attempts=3
)

# Get plan IDs from environment
PLAN_ID_FREE = os.environ.get('SQUARE_PLAN_ID_FREE')
PLAN_ID_CORE = os.environ.get('SQUARE_PLAN_ID_CORE')
PLAN_ID_WHOLE = os.environ.get('SQUARE_PLAN_ID_WHOLE')

@workflow.defn(name="CreateSubscriptionWorkflow")
class CreateSubscriptionWorkflow:
    @workflow.run
    async def run(self, user_id: int, plan_id: Optional[str] = None) -> dict:
        """
        Workflow to create a new subscription.
        Creates a Square subscription for both free and paid plans.
        Free plan will be represented as a $0.00 subscription in Square.
        """
        # Create Square subscription (free or paid)
        result = await workflow.execute_activity(
            "create_square_subscription",
            args=[user_id, plan_id or PLAN_ID_FREE],  # Use free plan ID if none specified
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=SUBSCRIPTION_RETRY_POLICY
        )
        
        # Update user status with new subscription
        await workflow.execute_activity(
            "update_user_subscription_status",
            args=[user_id, {
                "status": "active",
                "plan_id": plan_id or PLAN_ID_FREE,
                "square_subscription_id": result.get("square_subscription_id")
            }],
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=SUBSCRIPTION_RETRY_POLICY
        )

        return {
            "status": "success",
            "message": f"{'Free' if not plan_id else 'Paid'} plan subscription activated",
            "square_subscription_id": result.get("square_subscription_id")
        }

@workflow.defn(name="UpdateSubscriptionWorkflow")
class UpdateSubscriptionWorkflow:
    @workflow.run
    async def run(
        self, 
        user_id: int, 
        new_plan_id: Optional[str],
        current_square_subscription_id: str  # Now always required since all plans have subscriptions
    ) -> dict:
        """
        Workflow to update an existing subscription.
        Handles changes between any plans (free or paid).
        All plans maintain a Square subscription.
        """
        # Update the Square subscription to the new plan
        result = await workflow.execute_activity(
            "update_square_subscription",
            args=[
                current_square_subscription_id, 
                new_plan_id or PLAN_ID_FREE  # Use free plan ID if none specified
            ],
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=SUBSCRIPTION_RETRY_POLICY
        )
        
        # Update user status with new plan
        await workflow.execute_activity(
            "update_user_subscription_status",
            args=[user_id, {
                "status": "active",
                "plan_id": new_plan_id or PLAN_ID_FREE,
                "square_subscription_id": current_square_subscription_id
            }],
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=SUBSCRIPTION_RETRY_POLICY
        )
        
        return {
            "status": "success",
            "message": "Subscription plan updated",
            "square_subscription_id": current_square_subscription_id
        }

@workflow.defn(name="CancelSubscriptionWorkflow")
class CancelSubscriptionWorkflow:
    @workflow.run
    async def run(
        self, 
        user_id: int, 
        square_subscription_id: str  # Now required since all plans have subscriptions
    ) -> dict:
        """
        Workflow to handle subscription cancellation.
        This completely cancels the user's subscription in Square and our system.
        Note: To downgrade to free plan, use UpdateSubscriptionWorkflow instead.
        """
        # Cancel Square subscription
        await workflow.execute_activity(
            "cancel_square_subscription",
            args=[square_subscription_id],
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=SUBSCRIPTION_RETRY_POLICY
        )

        # Update user status to cancelled
        await workflow.execute_activity(
            "update_user_subscription_status",
            args=[user_id, {
                "status": "cancelled",
                "plan_id": None,
                "square_subscription_id": None
            }],
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=SUBSCRIPTION_RETRY_POLICY
        )

        return {
            "status": "success",
            "message": "Subscription cancelled"
        }
