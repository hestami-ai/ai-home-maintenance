import os
import json
import httpx
from dotenv import load_dotenv
import urllib.parse

load_dotenv()  # Load environment variables from a .env file

def find_contractors_with_bing_search(args: dict) -> dict:
    """
    Search for contractors using Bing Entity Search API based on query and location parameters.
    
    Args:
        args (dict): Dictionary containing:
            - query (str): Search query for contractors
            - zipCode (str): ZIP code to search around
            - radius (int, optional): Search radius in miles (default: 25)
            - market (str, optional): Market to search in (default: en-US)
    
    Returns:
        dict: Dictionary containing search results or error message
    """
    print("Finding contractors...")

    # Get API credentials
    api_key = os.getenv("BING_SEARCH_SUBSCRIPTION_KEY", "YOUR_DEFAULT_KEY")
    
    # Extract and validate parameters
    query = args.get("query")
    zip_code = args.get("zipCode")
    radius = args.get("radius", 25)  # Default radius of 25 miles
    market = args.get("market", "en-US")
    
    if not query or not zip_code:
        return {"error": "Both query and zipCode parameters are required"}
    
    # Build the search query
    search_query = f"{query} near {zip_code}"
    encoded_query = urllib.parse.quote(search_query)
    
    # Set up the request parameters
    url = f"https://api.bing.microsoft.com/v7.0/entities"
    params = {
        #"q": encoded_query,
        "q": search_query,
        "mkt": market
    }
    headers = {
        "Ocp-Apim-Subscription-Key": api_key
    }
    
    try:
        # Make the API request using httpx
        with httpx.Client(timeout=30.0) as client:
            response = client.get(url, params=params, headers=headers)
            response.raise_for_status()  # Raise an exception for 4XX/5XX status codes
            
            # Parse the response
            data = response.json()
            print(f"Bing Entity Search Response: {data}")
            
            # Extract relevant information from the response
            places = data.get("places", {}).get("value", [])
            
            # Format the results
            contractors = []
            for place in places:
                if place.get("entityPresentationInfo", {}).get("entityTypeHints", []):
                    # Format the address
                    address_obj = place.get("address", {})
                    address_parts = [
                        address_obj.get("addressLocality", ""),
                        address_obj.get("addressRegion", ""),
                        address_obj.get("postalCode", "")
                    ]
                    formatted_address = ", ".join(filter(None, address_parts))
                    
                    contractor = {
                        "name": place.get("name"),
                        "description": place.get("description", ""),
                        "url": place.get("url", ""),
                        "telephone": place.get("telephone", ""),
                        "address": formatted_address,
                        "webSearchUrl": place.get("webSearchUrl", ""),
                        "distance": place.get("distance", None)
                    }
                    contractors.append(contractor)
            
            return {
                "success": True,
                "query": search_query,
                "location": zip_code,
                "radius": radius,
                "contractors": contractors
            }
            
    except httpx.HTTPStatusError as e:
        print(f"HTTP error occurred: {e.response.status_code} - {e.response.text}")
        return {"error": f"API request failed with status {e.response.status_code}"}
    except httpx.RequestError as e:
        print(f"Request error occurred: {str(e)}")
        return {"error": f"An error occurred while making the request: {str(e)}"}
    except Exception as e:
        print(f"Error occurred: {str(e)}")
        return {"error": f"An error occurred while processing the request: {str(e)}"}

def find_contractors_with_azure_maps(args: dict) -> dict:
    """
    Search for contractors using Azure Maps REST API based on query and location parameters.
    Includes mapping information and more detailed location data.
    
    Args:
        args (dict): Dictionary containing:
            - query (str): Search query for contractors
            - zipCode (str): ZIP code to search around
            - radius (int, optional): Search radius in miles (default: 25)
            - market (str, optional): Market to search in (default: en-US)
    
    Returns:
        dict: Dictionary containing search results with mapping data or error message
    """
    print("Finding contractors with mapping data...")

    # GET https://atlas.microsoft.com/search/address/json?api-version=1.0&query=roof+leak+repair+contractors&subscription-key=YOUR_AZURE_MAPS_KEY&lat=38.8942&lon=-77.4311&radius=16093&category=repair&include=rating

    # GET https://atlas.microsoft.com/search/address/json?api-version=1.0&query=roof+leak+repair+contractors&subscription-key=G2nVkxCK4yfXVXSl2VOe8kSC8XBCBPLdIP2M07wvXvq50ElvcTV1JQQJ99BAACYeBjF2bW3CAAAgAZMP1oax&lat=38.8942&lon=-77.4311&radius=16093&category=repair&include=rating


    # Get API credentials
    api_key = os.getenv("AZURE_MAPS_KEY", "YOUR_DEFAULT_KEY")
    
    # Extract and validate parameters
    query = args.get("query")
    zip_code = args.get("zipCode")
    radius = args.get("radius", 25)  # Default radius of 25 miles
    market = args.get("market", "en-US")
    
    if not query or not zip_code:
        return {"error": "Both query and zipCode parameters are required"}
    
    # Dictionary mapping common home service keywords to Azure Maps POI category IDs
    HOME_SERVICE_CATEGORIES = {
        # General Contractors & Home Improvement
        "general": ["7399", "7000"],  # General Contractor, Home Improvement
        "renovation": ["7000", "7399"],  # Home Improvement, General Contractor
        "remodel": ["7000", "7399"],  # Home Improvement, General Contractor
        
        # Specific Trade Categories
        "roof": ["7699039", "7399"],  # Roofing Service, General Contractor
        "plumb": ["7699025", "7399"],  # Plumbing Service, General Contractor
        "electric": ["7699013", "7399"],  # Electrical Service, General Contractor
        "hvac": ["7699019", "7399"],  # HVAC Service, General Contractor
        "paint": ["7699023", "7399"],  # Painting Service, General Contractor
        "carpet": ["7699007", "7699"],  # Carpet Service, Repair Service
        "floor": ["7699015", "7399"],  # Flooring Service, General Contractor
        "window": ["7699043", "7399"],  # Window Service, General Contractor
        "door": ["7699011", "7399"],  # Door Service, General Contractor
        "garage": ["7699017", "7399"],  # Garage Door Service, General Contractor
        "landscape": ["7699021", "7399"],  # Landscaping Service, General Contractor
        
        # Default fallback categories
        "default": ["7399", "7000", "7699"]  # General Contractor, Home Improvement, Repair Service
    }

    def get_service_categories(query: str) -> list:
        """
        Get relevant service categories based on the search query.
        
        Args:
            query (str): The search query
        
        Returns:
            list: List of relevant category IDs
        """
        query = query.lower()
        matched_categories = set()
        
        # Check for matches in our category mapping
        for keyword, categories in HOME_SERVICE_CATEGORIES.items():
            if keyword in query:
                matched_categories.update(categories)
        
        # If no specific categories matched, use default categories
        if not matched_categories:
            matched_categories.update(HOME_SERVICE_CATEGORIES["default"])
        
        return list(matched_categories)

    # First, get coordinates for the ZIP code using Azure Maps Search API
    geocode_url = "https://atlas.microsoft.com/search/address/structured/json"
    geocode_params = {
        "subscription-key": api_key,
        "api-version": "1.0",
        "countryCode": "US",
        "postalCode": zip_code,
        "limit": 1
    }
    
    try:
        with httpx.Client(timeout=30.0) as client:
            # Get coordinates for ZIP code
            print(f"Geocoding ZIP code: {zip_code}")
            geocode_response = client.get(geocode_url, params=geocode_params)
            geocode_response.raise_for_status()
            geocode_data = geocode_response.json()
            
            print(f"Geocoding response: {geocode_data}")
            
            if not geocode_data.get("results"):
                return {"error": "Could not find coordinates for the provided ZIP code"}
            
            # Extract coordinates
            result = geocode_data["results"][0]
            if result.get("address", {}).get("countryCode") != "US":
                return {"error": "The provided ZIP code is not a valid US ZIP code"}
            
            location = result["position"]
            lat, lon = location["lat"], location["lon"]
            
            # Also get the city and state for better context
            address = result.get("address", {})
            city = address.get("municipality", "")
            state = address.get("countrySubdivision", "")
            
            print(f"Found coordinates for ZIP code {zip_code} ({city}, {state}): {lat}, {lon}")
            
            # Search for contractors near the coordinates
            search_url = "https://atlas.microsoft.com/search/poi/json"
            
            # Clean up the query - remove common contractor-related terms
            base_query = query.lower().replace("contractors", "").replace("contractor", "").strip()
            
            # Get relevant categories based on the query
            categories = get_service_categories(base_query)
            
            search_params = {
                "subscription-key": api_key,
                "api-version": "1.0",
                "query": base_query,  # Use original query
                "lat": lat,
                "lon": lon,
                "radius": min(radius * 1609.34, 50000),  # Convert miles to meters, max 50km
                "limit": 10,
                #"categorySet": categories[0],  # Use primary category
                "include": "rating",
                "language": "en-US",
                "typeahead": True  # Add typeahead for better POI matching
            }
            
            print(f"Azure Maps Search Query: {base_query}")
            print(f"Azure Maps Search Parameters: {search_params}")
            
            search_response = client.get(search_url, params=search_params)
            search_response.raise_for_status()
            search_data = search_response.json()
            
            print(f"Azure Maps Search Response: {search_data}")
            
            # Format the results
            contractors = []
            for poi in search_data.get("results", []):
                address = poi.get("address", {})
                position = poi.get("position", {})
                rating_info = poi.get("rating", {})
                
                contractor = {
                    "name": poi.get("poi", {}).get("name"),
                    "description": poi.get("poi", {}).get("categories", []),
                    "url": poi.get("poi", {}).get("url", ""),
                    "telephone": poi.get("poi", {}).get("phone", ""),
                    "address": f"{address.get('streetNumber', '')} {address.get('streetName', '')}, {address.get('municipality', '')}, {address.get('countrySubdivision', '')} {address.get('postalCode', '')}",
                    "coordinates": {
                        "latitude": position.get("lat"),
                        "longitude": position.get("lon")
                    },
                    "distance": poi.get("dist", 0) / 1609.34,  # Convert meters to miles
                    "score": poi.get("score", 0),
                    "rating": {
                        "totalRatings": rating_info.get("totalRatings", 0),
                        "averageRating": rating_info.get("rating", 0.0),
                        "ratingCount": rating_info.get("ratingCount", 0),
                        "reviewCount": rating_info.get("reviewCount", 0)
                    }
                }
                contractors.append(contractor)
            
            # Get a static map image URL for the area
            map_url = "https://atlas.microsoft.com/map/static/png"
            map_params = {
                "subscription-key": api_key,
                "api-version": "1.0",
                "center": f"{lon},{lat}",
                "zoom": 12,
                "width": 800,
                "height": 600,
                "layer": "basic",
                "style": "main"
            }
            
            static_map_url = f"{map_url}?{urllib.parse.urlencode(map_params)}"
            
            return {
                "success": True,
                "query": f"{query} contractors",
                "location": {
                    "zipCode": zip_code,
                    "coordinates": {
                        "latitude": lat,
                        "longitude": lon
                    }
                },
                "radius": radius,
                "contractors": contractors,
                "map": {
                    "staticMapUrl": static_map_url,
                    "center": {
                        "latitude": lat,
                        "longitude": lon
                    },
                    "zoom": 12
                }
            }
            
    except httpx.HTTPStatusError as e:
        print(f"HTTP error occurred: {e.response.status_code} - {e.response.text}")
        return {"error": f"API request failed with status {e.response.status_code}"}
    except httpx.RequestError as e:
        print(f"Request error occurred: {str(e)}")
        return {"error": f"An error occurred while making the request: {str(e)}"}
    except Exception as e:
        print(f"Error occurred: {str(e)}")
        return {"error": f"An error occurred while processing the request: {str(e)}"}



def find_contractors_example(args: dict) -> dict:
    """
    Example implementation of the find_contractors tool that returns dummy data.
    Useful for testing without making actual API calls.
    """
    return {
        "success": True,
        "query": args.get("query", "plumber"),
        "location": args.get("zipCode", "12345"),
        "radius": args.get("radius", 25),
        "contractors": [
            {
                "name": "Example Plumbing Services",
                "description": "Professional plumbing services with 20+ years of experience",
                "url": "https://example-plumbing.com",
                "telephone": "(555) 123-4567",
                "address": "123 Main St, Example City, ST 12345",
                "webSearchUrl": "https://www.bing.com/search?q=Example+Plumbing+Services",
                "distance": 2.5
            },
            {
                "name": "Local Contractor Solutions",
                "description": "Full-service contractor specializing in residential and commercial projects",
                "url": "https://localcontractor.com",
                "telephone": "(555) 987-6543",
                "address": "456 Oak Ave, Example City, ST 12345",
                "webSearchUrl": "https://www.bing.com/search?q=Local+Contractor+Solutions",
                "distance": 3.2
            }
        ]
    }



def find_contractors(args: dict) -> dict:
    """
    Search for contractors using either Azure Maps or Bing Search API based on configuration.
    The implementation is chosen based on the CONTRACTOR_SEARCH_PROVIDER environment variable.
    
    Args:
        args (dict): Dictionary containing:
            - query (str): Search query for contractors
            - zipCode (str): ZIP code to search around
            - radius (int, optional): Search radius in miles (default: 25)
            - market (str, optional): Market to search in (default: en-US)
    
    Returns:
        dict: Dictionary containing search results or error message
    """
    # Get the configured search provider
    search_provider = os.getenv("CONTRACTOR_SEARCH_PROVIDER", "azure_maps").lower()
    
    if search_provider == "bing_search":
        print("Using Bing Search API for contractor search...")
        return find_contractors_with_bing_search(args)
    else:  # Default to Azure Maps
        print("Using Azure Maps API for contractor search...")
        return find_contractors_with_azure_maps(args)
