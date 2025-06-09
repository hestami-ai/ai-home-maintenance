import os
import logging
import csv
import httpx
import asyncio
from gradio_client import Client, handle_file
from temporalio import activity
from typing import Dict, Any, Optional
from datetime import datetime, timezone

# Import from local tools directory
from tools.find_county import find_county

# Configure logging
logger = logging.getLogger(__name__)

# Get environment variables
API_BASE_URL = os.getenv("DJANGO_API_URL", "http://api:8050")
SERVICE_TOKEN = os.getenv("TEMPORAL_SERVICE_ACCOUNT_TOKEN")
BROWSER_USE_WEBUI_URL = os.getenv("BROWSER_USE_WEBUI_URL", "http://browser-use-webui:7788")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
BROWSER_USE_LLM_MODEL_NAME = os.getenv("BROWSER_USE_LLM_MODEL_NAME", "gemini-2.5-flash-preview-05-20")

# Log configuration on startup (but not the actual tokens)
if not SERVICE_TOKEN:
    logger.warning("TEMPORAL_SERVICE_ACCOUNT_TOKEN environment variable is not set!")
if not GEMINI_API_KEY:
    logger.warning("GEMINI_API_KEY environment variable is not set!")
logger.debug(f"Configured API_BASE_URL: {API_BASE_URL}")
logger.debug(f"Configured BROWSER_USE_WEBUI_URL: {BROWSER_USE_WEBUI_URL}")
logger.debug(f"Configured BROWSER_USE_LLM_MODEL_NAME: {BROWSER_USE_LLM_MODEL_NAME}")
logger.debug(f"Service token available: {bool(SERVICE_TOKEN)}")
logger.debug(f"Gemini API key available: {bool(GEMINI_API_KEY)}")

@activity.defn(name="get_property_details")
async def get_property_details(property_id: str) -> Dict[str, Any]:
    """
    Get property details from the Django API.
    
    Args:
        property_id: The ID of the property to retrieve
        
    Returns:
        dict: The property details
    """
    import httpx  # Import inside the activity to avoid workflow sandbox restrictions
    
    if not SERVICE_TOKEN:
        logger.error("Cannot make API request: TEMPORAL_SERVICE_ACCOUNT_TOKEN not set")
        raise ValueError("Service account token not available")
        
    # Prepare auth headers
    headers = {
        "Authorization": f"Token {SERVICE_TOKEN}",
        "Content-Type": "application/json"
    }
    
    logger.debug(f"Making API request to: {API_BASE_URL}/api/properties/{property_id}/")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{API_BASE_URL}/api/properties/{property_id}/",
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP Error: {e.response.status_code} - {e.response.reason_phrase}")
            logger.error(f"Response content: {e.response.text}")
            raise

@activity.defn(name="find_property_county")
async def find_property_county(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Find county information for a property address using Azure Maps API.
    
    Args:
        args: Dictionary containing address and other optional parameters
        
    Returns:
        dict: County information for the property
    """
    # We can directly use the find_county function from our tools module
    return find_county(args)

@activity.defn(name="update_property_county")
async def update_property_county(property_id: str, county_info: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update property with county information.
    
    Args:
        property_id: The ID of the property to update
        county_info: Dictionary containing county information
        
    Returns:
        dict: Response from the API
    """
    import httpx  # Import inside the activity to avoid workflow sandbox restrictions
    
    if not SERVICE_TOKEN:
        logger.error("Cannot make API request: TEMPORAL_SERVICE_ACCOUNT_TOKEN not set")
        raise ValueError("Service account token not available")
    
    # Log county info including the full raw JSON from Azure Maps
    logger.info(f"Updating property {property_id} with county: {county_info.get('county', '')}")
    
    # Log the full raw JSON from Azure Maps for validation and future data extraction
    import json
    logger.info(f"Azure Maps raw response: {json.dumps(county_info)}")
    
    # Extract the raw Azure Maps response if available
    raw_response = county_info.get("raw_response", None)
    
    # Prepare the update data
    update_data = {
        "county": county_info.get("county", ""),
        "status": "ACTIVE",  # Change from PENDING to ACTIVE after county is updated
        
        # Save the geocoded address data - use the raw response if available,
        # otherwise use the processed county_info
        "geocode_address": raw_response if raw_response else county_info,
        "geocode_address_source": "azure_maps"
    }
    
    logger.info(f"Updating property with geocoded data: {update_data}")
    
    # Prepare auth headers
    headers = {
        "Authorization": f"Token {SERVICE_TOKEN}",
        "Content-Type": "application/json"
    }
    
    # Construct the URL with the correct /update/ suffix, ensuring no invisible characters
    # Use string concatenation instead of f-strings to avoid potential character encoding issues
    url = API_BASE_URL + "/api/properties/" + str(property_id) + "/update/"
    logger.info("Making API request to: " + url)
    
    # Still provide a summary for general log reading, but we've already logged the full data above
    logger.info(f"Update data summary: county={update_data.get('county', '')}, status={update_data.get('status', '')}, source={update_data.get('geocode_address_source', '')}")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.put(  # Use PUT instead of PATCH to ensure compatibility
                url,
                json=update_data,
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP Error: {e.response.status_code} - {e.response.reason_phrase}")
            logger.error(f"Response content: {e.response.text}")
            raise

@activity.defn(name="get_property_permit_history")
async def get_property_permit_history(property_id: str, address: str, county: str) -> Dict[str, Any]:
    """
    Get property permit history using Browser Use WebUI with county-specific prompts.
    
    Args:
        property_id: The ID of the property to store permit history for
        address: The property address to lookup permits for
        county: The county name to find the appropriate tool configuration
        
    Returns:
        dict: The permit history results
    """
    if not GEMINI_API_KEY:
        logger.error("Cannot make permit history request: GEMINI_API_KEY not set")
        raise ValueError("Gemini API key not available")
    
    try:
        # Read the CSV file to find the appropriate tool configuration
        csv_path = os.path.join(os.path.dirname(__file__), "Hestami-AI Public Information Lookup - AI Tools.csv")
        
        tool_config = None
        with open(csv_path, 'r', newline='', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                if (row.get('Tool Name') == 'Property_History_Retrieval_Tool' and 
                    row.get('Tool Status') == 'Active' and
                    county.lower() in row.get('County / City / Locality', '').lower()):
                    tool_config = row
                    break
        
        if not tool_config:
            logger.error(f"No active Property_History_Retrieval_Tool found for county: {county}")
            return {
                "success": False,
                "error": f"No permit history tool configured for county: {county}",
                "results": []
            }
        
        # Extract URL and prompt template from the tool configuration
        tool_url = tool_config.get('URL', '')
        prompt_template = tool_config.get('Prompt Template', '')
        
        # Replace placeholders in the prompt template
        task_prompt = prompt_template.replace('{URL}', tool_url).replace('{TARGET_PROPERTY_ADDRESS}', address)
        
        logger.info(f"Getting permit history for property_id: {property_id}, address: {address} in county: {county}")
        logger.debug(f"Using tool URL: {tool_url}")
        
        # Make the request to Browser Use WebUI using gradio_client in a separate thread
        try:
            # Define the blocking function that will run in the executor
            def _blocking_predict_call():
                # It's often safer to initialize the client within the function that runs in a separate thread,
                # especially if the client is not explicitly documented as thread-safe or maintains per-thread state.
                logger.debug(f"Initializing Gradio client (in executor) for: {BROWSER_USE_WEBUI_URL}")
                gradio_client_instance = Client(BROWSER_USE_WEBUI_URL, download_files=False)
                
                logger.debug(f"Calling /run_with_stream API (in executor) for task: {task_prompt[:100]}...")
                # Parameters must match the order and type defined in the /run_with_stream API documentation
                return gradio_client_instance.predict(
                    "custom",  # agent_type
                    "google",  # llm_provider
                    BROWSER_USE_LLM_MODEL_NAME,  # llm_model_name
                    8192,  # llm_num_ctx
                    0.6,  # llm_temperature
                    "",  # llm_base_url
                    GEMINI_API_KEY,  # llm_api_key
                    False,  # use_own_browser
                    False,  # keep_browser_open
                    False,  # headless
                    False,  # disable_security
                    1280,  # window_w
                    720,  # window_h
                    "/tmp/recordings",  # save_recording_path
                    "/tmp/agent_history",  # save_agent_history_path
                    "/tmp/traces",  # save_trace_path
                    False,  # enable_recording
                    task_prompt,  # task
                    "",  # add_infos
                    30,  # max_steps
                    True,  # use_vision
                    10,  # max_actions_per_step
                    "function_calling",  # tool_calling_method
                    "",  # chrome_cdp
                    4096,  # max_input_tokens
                    3.0,  # minimum_wait_page_load_time
                    5.0,  # wait_for_network_idle_page_load_time
                    7.0,  # maximum_wait_page_load_time
                    500,  # viewport_expansion
                    api_name="/run_with_stream"
                )

            loop = asyncio.get_running_loop()
            # Run the blocking call in the default ThreadPoolExecutor
            result_tuple = await loop.run_in_executor(None, _blocking_predict_call)
            
            # /run_with_stream returns a tuple of 8 elements.
            if isinstance(result_tuple, tuple) and len(result_tuple) >= 3:
                final_result = str(result_tuple[1]) if result_tuple[1] is not None else ""
                errors = str(result_tuple[2]) if result_tuple[2] is not None else ""
                logger.debug(f"Gradio /run_with_stream response parsed: final_result='{final_result[:100]}...', errors='{errors[:100]}...'")
            else:
                logger.error(f"Unexpected response structure from Gradio /run_with_stream: {str(result_tuple)[:500]}")
                final_result = ""
                errors = f"Unexpected response structure from Gradio client: {str(result_tuple)[:200]}"

            logger.info(f"Browser Use completed for permit history lookup")
            if errors:
                logger.warning(f"Browser Use reported errors: {errors}")
            
            return {
                "success": True,
                "property_id": property_id,
                "county": county,
                "address": address,
                "tool_url": tool_url,
                "final_result": final_result,
                "errors": errors,
                "raw_response": result
            }

        except Exception as e:
            logger.exception(f"Error calling Browser Use WebUI with gradio_client: {str(e)}")
            return {
                "success": False,
                "error": f"Gradio client request failed: {str(e)}",
                "results": []
            }
            
    except FileNotFoundError:
        logger.error(f"CSV configuration file not found at: {csv_path}")
        return {
            "success": False,
            "error": "Tool configuration file not found",
            "results": []
        }
    except Exception as e:
        logger.error(f"Error getting permit history: {str(e)}", exc_info=True)
        return {
            "success": False,
            "error": f"Failed to get permit history: {str(e)}",
            "results": []
        }

@activity.defn
async def update_property_permit_status(
    property_id: str,
    status: str,
    error_message: Optional[str] = None,
    next_retrieval_at: Optional[str] = None
) -> Dict[str, Any]:
    """
    Update property permit retrieval status and related fields in Django.
    
    Args:
        property_id: UUID of the property to update
        status: New permit retrieval status (NEVER_ATTEMPTED, IN_PROGRESS, COMPLETED, FAILED, SCHEDULED)
        error_message: Error message to store (if any)
        next_retrieval_at: ISO datetime string for next retrieval attempt (if any)
        
    Returns:
        Dict with success status and any errors
    """
    logger.info(f"Updating permit status for property {property_id} to {status}")
    
    try:
        # Prepare update data
        update_data = {
            'permit_retrieval_status': status
        }
        
        # Add timestamp fields based on status
        if status == 'COMPLETED':
            update_data['permit_last_retrieved_at'] = timezone.now().isoformat()
            update_data['permit_retrieval_error'] = None  # Clear any previous error
            
        elif status == 'FAILED':
            if error_message:
                update_data['permit_retrieval_error'] = error_message
            if next_retrieval_at:
                update_data['permit_next_retrieval_at'] = next_retrieval_at
                
        elif status == 'IN_PROGRESS':
            # Clear any previous error when starting
            update_data['permit_retrieval_error'] = None
        
        # Make request to Django API
        async with httpx.AsyncClient() as client:
            headers = {}
            if SERVICE_TOKEN:
                headers['Authorization'] = f'Token {SERVICE_TOKEN}'
            
            response = await client.patch(
                f"{API_BASE_URL}/api/properties/{property_id}/permit-status/",
                json=update_data,
                headers=headers,
                timeout=30.0
            )
            
            if response.status_code == 200:
                logger.info(f"Successfully updated permit status for property {property_id}")
                return {
                    'success': True,
                    'property_id': property_id,
                    'status': status
                }
            else:
                error_msg = f"Failed to update permit status. Status: {response.status_code}, Response: {response.text}"
                logger.error(error_msg)
                return {
                    'success': False,
                    'property_id': property_id,
                    'error': error_msg
                }
                
    except httpx.RequestError as e:
        logger.exception(f"HTTP error updating permit status for property {property_id}: {str(e)}")
        return {
            'success': False,
            'property_id': property_id,
            'error': f"HTTP error: {str(e)}"
        }
    except Exception as e:
        logger.exception(f"Unexpected error updating permit status for property {property_id}: {str(e)}")
        return {
            'success': False,
            'property_id': property_id,
            'error': f"Unexpected error: {str(e)}"
        }

@activity.defn
async def create_permit_history_record(
    property_id: str,
    permit_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Create a PermitHistory record in Django with the retrieved permit data.
    
    Args:
        property_id: UUID of the property
        permit_data: Dictionary containing permit information from web scraping
        
    Returns:
        Dict with success status and any errors
    """
    logger.info(f"Creating permit history record for property {property_id}")
    
    try:
        # Prepare permit history data
        history_data = {
            'property_id': property_id,
            'raw_permit_data': permit_data,
            # TODO: Add extraction logic for structured fields if needed
            # For now, we'll store everything in raw_permit_data
        }
        
        # Make request to Django API
        async with httpx.AsyncClient() as client:
            headers = {}
            if SERVICE_TOKEN:
                headers['Authorization'] = f'Token {SERVICE_TOKEN}'
            
            response = await client.post(
                f"{API_BASE_URL}/api/properties/{property_id}/permit-history/",
                json=history_data,
                headers=headers,
                timeout=30.0
            )
            
            if response.status_code in [200, 201]:
                logger.info(f"Successfully created permit history record for property {property_id}")
                return {
                    'success': True,
                    'property_id': property_id,
                    'record_id': response.json().get('id') if response.status_code == 201 else None
                }
            else:
                error_msg = f"Failed to create permit history record. Status: {response.status_code}, Response: {response.text}"
                logger.error(error_msg)
                return {
                    'success': False,
                    'property_id': property_id,
                    'error': error_msg
                }
                
    except httpx.RequestError as e:
        logger.exception(f"HTTP error creating permit history record for property {property_id}: {str(e)}")
        return {
            'success': False,
            'property_id': property_id,
            'error': f"HTTP error: {str(e)}"
        }
    except Exception as e:
        logger.exception(f"Unexpected error creating permit history record for property {property_id}: {str(e)}")
        return {
            'success': False,
            'property_id': property_id,
            'error': f"Unexpected error: {str(e)}"
        }

# List of activities to register with the worker
property_activities = [
    get_property_details,
    find_property_county,
    update_property_county,
    get_property_permit_history,
    update_property_permit_status,
    create_permit_history_record,
]
