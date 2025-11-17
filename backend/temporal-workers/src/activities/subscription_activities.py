import os
from temporalio import activity

API_BASE_URL = os.getenv("DJANGO_API_URL", "http://django-api:8050")
SERVICE_TOKEN = os.getenv("TEMPORAL_SERVICE_ACCOUNT_TOKEN")

@activity.defn(name="create_square_subscription")
async def create_square_subscription(user_id: str, plan_id: str) -> dict:
    """Create a Square subscription through Django API."""
    import httpx  # Import inside the activity to avoid workflow sandbox restrictions
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{API_BASE_URL}/api/subscriptions/create_subscription/",  # Use create_subscription to match URLs
            json={"user_id": user_id, "plan_variation_id": plan_id},
            headers={
                "Authorization": f"Token {SERVICE_TOKEN}",  # Use Token prefix for DRF's TokenAuthentication
                "Content-Type": "application/json"
            }
        )
        response.raise_for_status()
        return response.json()

@activity.defn(name="update_square_subscription")
async def update_square_subscription(subscription_id: str, new_plan_id: str) -> dict:
    """Update an existing Square subscription through Django API."""
    import httpx  # Import inside the activity to avoid workflow sandbox restrictions
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{API_BASE_URL}/api/subscriptions/{subscription_id}/upgrade/",
            json={"plan_variation_id": new_plan_id},
            headers={
                "Authorization": f"Token {SERVICE_TOKEN}",  # Use Token prefix for DRF's TokenAuthentication
                "Content-Type": "application/json"
            }
        )
        response.raise_for_status()
        return response.json()

@activity.defn(name="cancel_square_subscription")
async def cancel_square_subscription(subscription_id: str) -> dict:
    """Cancel a Square subscription through Django API."""
    import httpx  # Import inside the activity to avoid workflow sandbox restrictions
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{API_BASE_URL}/api/subscriptions/{subscription_id}/cancel/",
            headers={
                "Authorization": f"Token {SERVICE_TOKEN}",  # Use Token prefix for DRF's TokenAuthentication
                "Content-Type": "application/json"
            }
        )
        response.raise_for_status()
        return response.json()

@activity.defn(name="update_user_subscription_status")
async def update_user_subscription_status(user_id: str, subscription_data: dict) -> dict:
    """Update user subscription status through Django API."""
    import httpx  # Import inside the activity to avoid workflow sandbox restrictions
    
    async with httpx.AsyncClient() as client:
        response = await client.patch(
            f"{API_BASE_URL}/api/subscriptions/{subscription_data['square_subscription_id']}/",
            json=subscription_data,
            headers={
                "Authorization": f"Token {SERVICE_TOKEN}",  # Use Token prefix for DRF's TokenAuthentication
                "Content-Type": "application/json"
            }
        )
        response.raise_for_status()
        return response.json()

# List of activities to register with the worker
subscription_activities = [
    create_square_subscription,
    update_square_subscription,
    cancel_square_subscription,
    update_user_subscription_status
]
