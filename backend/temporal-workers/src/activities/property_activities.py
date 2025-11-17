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
API_BASE_URL = os.getenv("DJANGO_API_URL", "http://django-api:8050")
SERVICE_TOKEN = os.getenv("TEMPORAL_SERVICE_ACCOUNT_TOKEN")
BROWSER_USE_WEBUI_URL = os.getenv("BROWSER_USE_WEBUI_URL", "http://browser-use-webui:7788")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
BROWSER_USE_LLM_MODEL_NAME = os.getenv("BROWSER_USE_LLM_MODEL_NAME", "gemini-2.5-flash-preview-05-20")
# The HTML chunker runs on port 8000 inside the container
CHUNKER_API_URL = os.getenv("HTML_CHUNKER_API_URL", "http://html-chunker:8000")

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
async def get_property_permit_history(property_id: str, address: str, county: str, state: str) -> Dict[str, Any]:
    """
    Get property permit history using Browser Use WebUI with county-specific prompts.
    
    Args:
        property_id: The ID of the property to store permit history for
        address: The property address to lookup permits for
        county: The county name to find the appropriate tool configuration
        state: The state abbreviation (e.g., 'VA') for the property
        
    Returns:
        dict: The permit history results
    """
    if not GEMINI_API_KEY:
        logger.error("Cannot make permit history request: GEMINI_API_KEY not set")
        raise ValueError("Gemini API key not available")
    
    try:
        # Create a tracking ID from the workflow ID and workflow run ID
        workflow_id = activity.info().workflow_id
        workflow_run_id = activity.info().workflow_run_id
        tracking_id = f"{workflow_id}:{workflow_run_id}"
        
        logger.info(f"Created tracking ID: {tracking_id} for property permit history")
        
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
        task_prompt = prompt_template.replace('{URL}', tool_url)\
                                    .replace('{TARGET_PROPERTY_ADDRESS}', address)\
                                    .replace('{TARGET_PROPERTY_COUNTY}', county)\
                                    .replace('{TARGET_PROPERTY_STATE}', state)\
                                    .replace('{TARGET_PROPERTY_ID}', property_id)\
                                    .replace('{SCRAPE_TYPE}', 'PERMIT_HISTORY')\
                                    .replace('{TRACKING_ID}', tracking_id)
        
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
                    32768,  # max_input_tokens
                    3.0,  # minimum_wait_page_load_time
                    5.0,  # wait_for_network_idle_page_load_time
                    7.0,  # maximum_wait_page_load_time
                    500,  # viewport_expansion
                    api_name="/run_with_stream"
                )

            logger.info("About to execute Gradio client call in ThreadPoolExecutor")
            try:
                loop = asyncio.get_running_loop()
                # Run the blocking call in the default ThreadPoolExecutor
                logger.info("Calling run_in_executor with _blocking_predict_call")
                result_tuple = await loop.run_in_executor(None, _blocking_predict_call)
                logger.info(f"Received result from executor: {type(result_tuple).__name__}, data: {str(result_tuple)[:500]}...")
            except Exception as inner_e:
                logger.exception(f"Exception during executor call: {str(inner_e)}")
                raise
            
            # /run_with_stream returns a tuple of 8 elements.
            logger.info(f"Processing result_tuple: type={type(result_tuple).__name__}, is_tuple={isinstance(result_tuple, tuple)}, length={len(result_tuple) if isinstance(result_tuple, tuple) else 'N/A'}")
            
            if isinstance(result_tuple, tuple) and len(result_tuple) >= 3:
                logger.info(f"Result tuple elements: [0]={type(result_tuple[0]).__name__}, [1]={type(result_tuple[1]).__name__}, [2]={type(result_tuple[2]).__name__}")
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
            
            # Log all local variables to help debug the issue
            logger.info(f"Local variables before return: result_tuple={type(result_tuple).__name__}, final_result={type(final_result).__name__}, errors={type(errors).__name__}")
            
            # Create the return dictionary explicitly to avoid any variable name issues
            return_dict = {
                "success": True,
                "property_id": property_id,
                "county": county,
                "address": address,
                "tool_url": tool_url,
                "final_result": final_result,
                "errors": errors,
                "raw_response": result_tuple  # Make sure this is using result_tuple, not result
            }
            
            logger.info(f"Return dictionary created with keys: {list(return_dict.keys())}")
            return return_dict

        except Exception as e:
            logger.exception(f"Error calling Browser Use WebUI with gradio_client: {str(e)}")
            # Log the full traceback to help identify where 'result' might be referenced
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
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
            # Fix: Use datetime.now() with UTC timezone instead of timezone.now()
            update_data['permit_last_retrieved_at'] = datetime.now(timezone.utc).isoformat()
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

@activity.defn(name="process_property_scraped_data")
async def process_property_scraped_data(property_id: str, state: str, county: str) -> Dict[str, Any]:
    """
    Process pending PropertyScrapedData for a property using the HTML chunker.

    Args:
        property_id: UUID of the property
        state: State abbreviation (e.g., 'VA')
        county: County name

    Returns:
        Dict containing counts of processed entries
    """
    if not SERVICE_TOKEN:
        logger.error("Cannot process scraped data: TEMPORAL_SERVICE_ACCOUNT_TOKEN not set")
        raise ValueError("Service account token not available")
    
    # Create a tracking ID from the workflow ID and workflow run ID
    workflow_id = activity.info().workflow_id
    workflow_run_id = activity.info().workflow_run_id
    tracking_id = f"{workflow_id}:{workflow_run_id}"
    
    logger.info(f"Created tracking ID: {tracking_id} for property scraped data processing")
    
    # Read the CSV file to find the appropriate site name
    csv_path = os.path.join(os.path.dirname(__file__), "Hestami-AI Public Information Lookup - AI Tools.csv")
    
    # Get the site short name from the CSV
    site_short_name = "NEEDS_LOOKUP_OR_WILL_FAIL"  # Default value
    try:
        with open(csv_path, 'r', newline='', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                if (row.get('State') == state and 
                    county.lower() in row.get('County / City / Locality', '').lower()):
                    site_short_name = row.get('Site Short Name', 'NEEDS_LOOKUP_OR_WILL_FAIL')
                    logger.info(f"Found site short name: {site_short_name} for {state}, {county}")
                    break
    except Exception as e:
        logger.warning(f"Error reading CSV file for site name: {e}, using default NEEDS_LOOKUP_OR_WILL_FAIL")

    headers = {"Authorization": f"Token {SERVICE_TOKEN}", "Content-Type": "application/json"}
    list_url = f"{API_BASE_URL}/api/properties/{property_id}/scraped-data/"
    params = {"processed_status": "pending", "tracking_id": tracking_id}
    
    logger.info(f"Listing scraped data with params: {params}")
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(list_url, headers=headers, params=params, timeout=30.0)
            resp.raise_for_status()
            items = resp.json()
            logger.info(f"Found {len(items)} pending scraped data items to process")
        except Exception as e:
            logger.error(f"Error listing scraped data for property {property_id}: {e}")
            raise

        processed_count = 0
        for item in items:
            scraped_id = item.get("id")
            html_text = item.get("raw_html", "")
            # Call HTML chunker for this entry
            try:
                logger.info(f"Calling HTML chunker at {CHUNKER_API_URL}/county_extractor/ with site_name: {site_short_name}")
                
                # Create payload
                payload = {
                    "state": state, 
                    "county": county, 
                    "site_name": site_short_name, 
                    "html_text": html_text
                }
                
                # Log payload size for debugging
                html_size = len(html_text) if html_text else 0
                logger.info(f"HTML content size: {html_size} bytes")
                
                # Make the request with increased timeout and detailed error handling
                chunker_resp = await client.post(
                    f"{CHUNKER_API_URL}/county_extractor/",
                    json=payload,
                    timeout=120.0  # Increased timeout for large HTML content
                )
                
                # Check for errors
                chunker_resp.raise_for_status()
                processed_data = chunker_resp.json()
                logger.info(f"Successfully processed HTML content with chunker, received {len(processed_data)} items")
            except httpx.ConnectError as e:
                logger.error(f"Connection error to HTML chunker for scraped_data {scraped_id}: {e}")
                logger.error(f"Check if HTML chunker service is running and accessible at {CHUNKER_API_URL}")
                raise
            except httpx.ReadTimeout as e:
                logger.error(f"Timeout error processing HTML for scraped_data {scraped_id}: {e}")
                logger.error("Consider increasing the timeout for large HTML content")
                raise
            except httpx.HTTPStatusError as e:
                logger.error(f"HTTP error from HTML chunker for scraped_data {scraped_id}: {e.response.status_code} - {e.response.text}")
                raise
            except Exception as e:
                logger.error(f"Unexpected error extracting HTML for scraped_data {scraped_id}: {e}")
                raise
            # Update the scraped_data record
            try:
                update_resp = await client.patch(
                    f"{API_BASE_URL}/api/properties/{property_id}/scraped-data/{scraped_id}/",
                    headers=headers,
                    json={"processed_data": processed_data, "processed_status": "completed"},
                    timeout=30.0
                )
                update_resp.raise_for_status()
                processed_count += 1
                logger.info(f"Updated scraped data {scraped_id} status to completed")
            except Exception as e:
                logger.error(f"Error updating scraped_data {scraped_id} for property {property_id}: {e}")
                raise

        return {
            "success": True,
            "property_id": property_id,
            "state": state,
            "county": county,
            "site_name": site_short_name,
            "processed": processed_count,
            "total": len(items),
            "tracking_id": tracking_id
        }

@activity.defn
async def convert_property_scraped_data_to_permit_history_record(property_id: str, tracking_id: str) -> Dict[str, Any]:
    """
    Convert processed property scraped data of type 'Permit History' to PermitHistory records.
    
    This activity will:
    1. Retrieve all completed scraped data with the specified tracking_id and type 'Permit History'
    2. Convert each permit record from the scraped format to the PermitHistory model format
    3. Post each converted record to the Django API endpoint
    
    Args:
        property_id: UUID of the property
        tracking_id: The tracking ID used to identify related scraped data
        
    Returns:
        Dict containing counts of processed entries and created permit records
    """
    if not SERVICE_TOKEN:
        logger.error("Cannot convert scraped data: TEMPORAL_SERVICE_ACCOUNT_TOKEN not set")
        raise ValueError("Service account token not available")
    
    headers = {"Authorization": f"Token {SERVICE_TOKEN}", "Content-Type": "application/json"}
    list_url = f"{API_BASE_URL}/api/properties/{property_id}/scraped-data/"
    params = {"processed_status": "completed", "tracking_id": tracking_id, "scrape_type": "Permit History"}
    
    logger.info(f"Listing completed permit history scraped data with tracking_id: {tracking_id}")
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(list_url, headers=headers, params=params, timeout=30.0)
            resp.raise_for_status()
            items = resp.json()
            logger.info(f"Found {len(items)} completed permit history scraped data items to convert")
        except Exception as e:
            logger.error(f"Error listing scraped data for property {property_id}: {e}")
            raise
        
        created_permits = 0
        for item in items:
            scraped_id = item.get("id")
            processed_data = item.get("processed_data", [])
            
            if not processed_data:
                logger.warning(f"Scraped data {scraped_id} has no processed data, skipping")
                continue
                
            logger.info(f"Converting {len(processed_data)} permit records from scraped data {scraped_id}")
            
            # Process each permit record in the processed data
            for permit_record in processed_data:
                # Skip records with extraction metadata only
                if "_extraction_metadata" in permit_record and len(permit_record) <= 1:
                    continue
                    
                try:
                    # Convert the permit record to PermitHistory format
                    permit_data = convert_permit_record(permit_record, property_id)
                    
                    # Create the permit history record
                    create_url = f"{API_BASE_URL}/api/properties/{property_id}/permits/create/"
                    create_resp = await client.post(
                        create_url,
                        headers=headers,
                        json=permit_data,
                        timeout=30.0
                    )
                    create_resp.raise_for_status()
                    created_permits += 1
                    logger.info(f"Created permit history record from scraped data {scraped_id}")
                except Exception as e:
                    logger.error(f"Error creating permit history record from scraped data {scraped_id}: {e}")
                    # Continue processing other records even if one fails
                    continue
        
        return {
            "success": True,
            "property_id": property_id,
            "tracking_id": tracking_id,
            "scraped_data_processed": len(items),
            "permits_created": created_permits
        }


def convert_permit_record(permit_record: Dict[str, Any], property_id: str) -> Dict[str, Any]:
    """
    Convert a permit record from scraped data format to PermitHistory format.
    
    Args:
        permit_record: The permit record from scraped data
        property_id: The UUID of the property
        
    Returns:
        Dict containing the permit data in PermitHistory format
    """
    # Initialize the permit data with defaults
    permit_data = {
        "property": property_id,
        "raw_permit_data": permit_record,  # Store the original record
        "source_name": "Fairfax County",  # Default source name
        "scraped_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Extract permit number from record field (format: "FIDO - TYPE - NUMBER")
    record = permit_record.get("record", "")
    if record:
        parts = record.split(" - ")
        if len(parts) >= 3:
            permit_data["permit_number"] = parts[2].strip()
            permit_data["permit_type"] = parts[1].strip()
        else:
            permit_data["permit_number"] = record
    
    # Extract permit description (use record if no specific description)
    permit_data["permit_description"] = record
    
    # Map status to standard permit status
    status = permit_record.get("status", "")
    if status:
        permit_data["permit_status"] = map_permit_status(status)
    
    # Extract dates
    date_str = permit_record.get("date", "")
    if date_str and "Issued:" in date_str:
        issued_date = date_str.replace("Issued:", "").strip()
        permit_data["issued_date"] = issued_date
    
    # Extract source URL
    record_url = permit_record.get("record_url", "")
    if record_url:
        # Convert relative URL to absolute URL if needed
        if record_url.startswith("/"):
            permit_data["source_url"] = f"https://fairfaxcounty.gov{record_url}"
        else:
            permit_data["source_url"] = record_url
    
    # Store any additional extracted fields
    extracted_fields = {}
    for key, value in permit_record.items():
        if key not in ["_extraction_metadata", "record", "status", "date", "record_url"] and value:
            extracted_fields[key] = value
    
    if extracted_fields:
        permit_data["extracted_fields"] = extracted_fields
    
    return permit_data


def map_permit_status(status: str) -> str:
    """
    Map a permit status from scraped data to a standard PermitHistoryStatus.
    
    Args:
        status: The status string from scraped data
        
    Returns:
        A standardized status string matching PermitHistoryStatus choices
    """
    status = status.upper()
    
    if "APPROVED" in status:
        return "APPROVED"
    elif "DENIED" in status:
        return "DENIED"
    elif "EXPIRED" in status:
        return "EXPIRED"
    elif "CANCELLED" in status or "CANCELED" in status:
        return "CANCELLED"
    elif "FINAL" in status or "FINALIZED" in status:
        return "COMPLETED"
    elif "CLOSED" in status:
        return "COMPLETED"
    elif "ACTIVE" in status or "OPEN" in status:
        return "ACTIVE"
    elif "PENDING" in status or "SUBMITTED" in status or "REVIEW" in status:
        return "PENDING"
    else:
        return "UNKNOWN"


# List of activities to register with the worker
property_activities = [
    get_property_details,
    find_property_county,
    update_property_county,
    get_property_permit_history,
    update_property_permit_status,
    create_permit_history_record,
    process_property_scraped_data,
    convert_property_scraped_data_to_permit_history_record,
]
