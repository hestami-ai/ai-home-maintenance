import os
import json
import httpx
import logging
from dotenv import load_dotenv
import urllib.parse

load_dotenv()  # Load environment variables from a .env file

# Configure logging
logger = logging.getLogger(__name__)

def find_county_with_azure_maps(args: dict) -> dict:
    """
    Find the county/locality of a property address using Azure Maps API.
    
    Args:
        args (dict): Dictionary containing:
            - address (str): The full property address to search
            - includeNeighborhood (bool, optional): Whether to include neighborhood info (default: False)
            - includeZipCode (bool, optional): Whether to include ZIP code data (default: False)
    
    Returns:
        dict: Dictionary containing address details including county information
    """
    logger.info("Finding county information...")

    # Get API credentials
    subscription_key = os.getenv("AZURE_MAPS_KEY")
    
    if not subscription_key:
        # Raise an exception instead of returning an error dict
        # This will properly fail the Temporal activity
        raise ValueError("Azure Maps API key is not configured")
    
    # Extract and validate parameters
    address = args.get("address")
    include_neighborhood = args.get("includeNeighborhood", False)
    include_zip_code = args.get("includeZipCode", True)

    logger.info(f"Address: {address}")
    
    
    if not address:
        # Raise an exception for missing address
        raise ValueError("Address parameter is required")
    
    # Check if the address is already URL-encoded (contains %xx sequences)
    # If it is, decode it first to prevent double-encoding
    # if '%' in address:
    #     logger.info(f"Address appears to be already encoded, decoding first: {address}")
    #     address = urllib.parse.unquote(address)
    #     logger.info(f"Decoded address: {address}")
    
    # DO NOT ENCODE THE ADDRESS - Azure Maps API or HTTPX does it for us
    # # Encode the address for the URL
    # encoded_address = urllib.parse.quote(address)
    encoded_address = address
    logger.info(f"Final encoded address for API call: {encoded_address}")
    
    # Set up the request parameters for the Search API
    url = "https://atlas.microsoft.com/search/address/json"
    params = {
        "api-version": "1.0",
        "subscription-key": subscription_key,
        "query": encoded_address,
        "typeahead": "false",  # We want exact matches, not suggestions
        "limit": 1,  # Only need the top result
        "countrySet": "US"  # Assuming US addresses
    }

    logger.info(f"Azure Maps Search Parameters: {url} {params}")

    try:
        # Make the API request using httpx
        with httpx.Client(timeout=30.0) as client:
            response = client.get(url, params=params)
            response.raise_for_status()  # Raise an exception for 4XX/5XX status codes
            
            # Parse the response
            data = response.json()
            logger.info(f"Azure Maps Search Response: {data}")
            
            # Store the full raw response for later access
            raw_response = data
            
            # Extract county information from the response
            results = data.get("results", [])
            
            if not results:
                raise ValueError("No results found for the provided address")
            
            # Get the top result
            top_result = results[0]
            
            # Extract address components
            address_components = top_result.get("address", {})
            
            # Prepare the response with county information
            county = address_components.get("countrySecondarySubdivision", "")
            formatted_address = address_components.get("freeformAddress", "")
            
            response_data = {
                "success": True,
                "address": address,
                "formatted_address": formatted_address,
                "county": county,
                "locality": address_components.get("municipality", ""),
                "state": address_components.get("countrySubdivision", ""),
                "country": address_components.get("country", ""),
                "position": top_result.get("position", {}),
                "raw_response": raw_response  # Include the full raw response
            }
            
            # Include optional information if requested
            if include_neighborhood:
                response_data["neighborhood"] = address_components.get("countryTertiarySubdivision", "")
            
            if include_zip_code:
                response_data["zip_code"] = address_components.get("postalCode", "")
            
            return response_data
            
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error occurred: {e.response.status_code} - {e.response.text}")
        # Re-raise exception to properly fail the activity
        raise ValueError(f"API request failed with status {e.response.status_code}: {e.response.text}")
    except httpx.RequestError as e:
        logger.error(f"Request error occurred: {str(e)}")
        # Re-raise exception to properly fail the activity
        raise ValueError(f"An error occurred while making the request: {str(e)}")
    except Exception as e:
        logger.error(f"Error occurred: {str(e)}")
        # Re-raise exception to properly fail the activity
        raise

def find_county_example(args: dict) -> dict:
    """
    Example implementation of the find_county tool that returns dummy data.
    Useful for testing without making actual API calls.
    """
    address = args.get("address", "13511 Granite Rock Dr, Chantilly, VA 20151")
    
    return {
        "success": True,
        "address": address,
        "formatted_address": "13511 Granite Rock Dr, Chantilly, VA 20151, United States",
        "county": "Fairfax County",
        "locality": "Chantilly",
        "state": "VA",
        "country": "United States",
        "position": {
            "lat": 38.8462,
            "lon": -77.4089
        }
    }

def find_county(args: dict) -> dict:
    """
    Find the county for a property address using Azure Maps API.
    The implementation is chosen based on the COUNTY_SEARCH_PROVIDER environment variable.
    
    Args:
        args (dict): Dictionary containing:
            - address (str): The full property address to search
            - includeNeighborhood (bool, optional): Whether to include neighborhood info (default: False)
            - includeZipCode (bool, optional): Whether to include ZIP code data (default: False)
    
    Returns:
        dict: Dictionary containing address details including county information
    """
    # Get the configured search provider
    search_provider = os.getenv("COUNTY_SEARCH_PROVIDER", "azure_maps").lower()
    
    if search_provider == "example":
        logger.info("Using example data for county search...")
        return find_county_example(args)
    else:  # Default to Azure Maps
        logger.info("Using Azure Maps API for county search...")
        return find_county_with_azure_maps(args)
