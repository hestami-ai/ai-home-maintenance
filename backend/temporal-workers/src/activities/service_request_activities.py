import logging
import os
import requests
from typing import Dict, Any, Optional
from pydantic import BaseModel, UUID4
from temporalio import activity

# Configure logging
logger = logging.getLogger(__name__)

# Define Pydantic models for type safety
class ServiceRequestDetail(BaseModel):
    id: UUID4
    title: str
    description: str
    status: str
    priority: str
    category: str
    property_id: UUID4
    provider_id: Optional[UUID4] = None
    selected_provider_id: Optional[UUID4] = None
    estimated_cost: Optional[float] = None
    final_cost: Optional[float] = None
    scheduled_start: Optional[str] = None
    scheduled_end: Optional[str] = None
    created_at: str
    updated_at: str
    is_diy: bool = False


@activity.defn
async def get_service_request_details(request_id: str) -> Dict[str, Any]:
    """
    Activity to retrieve service request details from the Django backend.
    
    Args:
        request_id: UUID of the service request
        
    Returns:
        Dict containing service request details
        
    Raises:
        Exception: If the API call fails or returns an error
    """
    try:
        # Get API base URL from environment variable
        api_base_url = os.getenv("DJANGO_API_URL", "http://django-api:8050")
        
        # Get API token from environment variable
        api_token = os.getenv("TEMPORAL_SERVICE_ACCOUNT_TOKEN")
        if not api_token:
            raise ValueError("TEMPORAL_SERVICE_ACCOUNT_TOKEN environment variable is not set")
        
        # Construct the API endpoint URL
        endpoint = f"{api_base_url}/api/services/requests/{request_id}/"
        
        # Set up headers with authentication
        headers = {
            "Authorization": f"Token {api_token}",
            "Content-Type": "application/json"
        }
        
        # Make the API call
        logger.info(f"Retrieving service request details for ID: {request_id} from endpoint: {endpoint}")
        response = requests.get(endpoint, headers=headers)
        
        # Log response status
        logger.info(f"Response status code: {response.status_code}")
        
        if response.status_code != 200:
            logger.error(f"Error response: {response.text}")
        
        # Check if the request was successful
        response.raise_for_status()
        
        # Parse and validate the response data
        data = response.json()
        
        # Log the structure of the data for debugging
        logger.info(f"Property field type: {type(data.get('property')).__name__}")
        logger.info(f"Provider field: {data.get('provider')}")
        logger.info(f"Selected provider field: {data.get('selected_provider')}")
        
        # Handle property field which could be a string UUID or an object with an id
        property_id = data.get("property")
        if isinstance(property_id, dict) and "id" in property_id:
            property_id = property_id["id"]
        
        # Handle provider and selected_provider which could be null or objects
        provider_id = None
        if data.get("provider") is not None:
            if isinstance(data["provider"], dict) and "id" in data["provider"]:
                provider_id = data["provider"]["id"]
            elif isinstance(data["provider"], str):
                provider_id = data["provider"]
        
        selected_provider_id = None
        if data.get("selected_provider") is not None:
            if isinstance(data["selected_provider"], dict) and "id" in data["selected_provider"]:
                selected_provider_id = data["selected_provider"]["id"]
            elif isinstance(data["selected_provider"], str):
                selected_provider_id = data["selected_provider"]
        
        service_request = ServiceRequestDetail(
            id=data["id"],
            title=data["title"],
            description=data["description"],
            status=data["status"],
            priority=data["priority"],
            category=data["category"],
            property_id=property_id,
            provider_id=provider_id,
            selected_provider_id=selected_provider_id,
            estimated_cost=data.get("estimated_cost"),
            final_cost=data.get("final_cost"),
            scheduled_start=data.get("scheduled_start"),
            scheduled_end=data.get("scheduled_end"),
            created_at=data["created_at"],
            updated_at=data["updated_at"],
            is_diy=data.get("is_diy", False)
        )
        
        logger.info(f"Successfully retrieved service request details for ID: {request_id}")
        return service_request.model_dump()
        
    except requests.exceptions.RequestException as e:
        logger.error(f"API request failed: {str(e)}")
        raise Exception(f"Failed to retrieve service request: {str(e)}")
    except Exception as e:
        logger.error(f"Error retrieving service request details: {str(e)}")
        raise Exception(f"Error processing service request details: {str(e)}")


@activity.defn
async def update_service_request_status(request_id: str, status: str) -> Dict[str, Any]:
    """
    Activity to update the status of a service request.
    
    Args:
        request_id: UUID of the service request
        status: New status to set
        
    Returns:
        Dict containing updated service request details
        
    Raises:
        Exception: If the API call fails or returns an error
    """
    try:
        # Get API base URL from environment variable
        api_base_url = os.getenv("DJANGO_API_URL", "http://django-api:8050")
        
        # Get API token from environment variable
        api_token = os.getenv("TEMPORAL_SERVICE_ACCOUNT_TOKEN")
        if not api_token:
            raise ValueError("TEMPORAL_SERVICE_ACCOUNT_TOKEN environment variable is not set")
        
        # Construct the API endpoint URL
        endpoint = f"{api_base_url}/api/services/requests/{request_id}/"
        
        # Set up headers with authentication - try with Token prefix instead of Bearer
        headers = {
            "Authorization": f"Token {api_token}",
            "Content-Type": "application/json"
        }
                
        # Prepare the payload
        payload = {
            "status": status
        }
        
        # Make the API call
        logger.info(f"Updating service request {request_id} status to {status}")
        response = requests.put(endpoint, headers=headers, json=payload)
        
        # Check if the request was successful
        response.raise_for_status()
        
        # Parse the response data
        data = response.json()
        logger.info(f"Successfully updated service request {request_id} status to {status}")
        
        return data
        
    except requests.exceptions.RequestException as e:
        logger.error(f"API request failed: {str(e)}")
        raise Exception(f"Failed to update service request status: {str(e)}")
    except Exception as e:
        logger.error(f"Error updating service request status: {str(e)}")
        raise Exception(f"Error processing service request status update: {str(e)}")
