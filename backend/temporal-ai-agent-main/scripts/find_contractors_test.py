from tools.find_contractors import find_contractors
import json

if __name__ == "__main__":
    # Test parameters
    search_args = {
        "query": "plumber",  # Type of contractor to search for
        "zipCode": "94105",  # San Francisco area
        "radius": 25,        # 25 mile radius
        "market": "en-US"    # US market
    }
    
    # Call the find_contractors function
    results = find_contractors(search_args)
    
    # Pretty print the results
    print(json.dumps(results, indent=2))