#!/usr/bin/env python3
"""
Test script for the county_extractor endpoint.
"""
import json
import requests
import sys
import os
from pathlib import Path

def test_county_extractor(html_file_path, state="VA", county="Fairfax County", site_name="LDIP"):
    """
    Test the county_extractor endpoint with a given HTML file.
    
    Args:
        html_file_path: Path to the HTML file
        state: State code (default: VA)
        county: County name (default: Fairfax County)
        site_name: Site name (default: LDIP)
    """
    # Validate file exists
    html_path = Path(html_file_path)
    if not html_path.exists():
        print(f"Error: File not found: {html_file_path}")
        return
    
    # Read HTML content
    with open(html_path, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    # Prepare payload
    payload = {
        "state": state,
        "county": county,
        "site_name": site_name,
        "html_text": html_content
    }
    
    # Print request details
    print(f"Sending request to county_extractor:")
    print(f"  State: {state}")
    print(f"  County: {county}")
    print(f"  Site Name: {site_name}")
    print(f"  HTML Size: {len(html_content)} bytes")
    
    # Send request
    try:
        response = requests.post(
            "http://localhost:8070/county_extractor/",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        # Print response
        print(f"Response Status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"Extracted {len(result)} items:")
            print(json.dumps(result, indent=2))
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Request failed: {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_county_extractor.py <html_file_path> [state] [county] [site_name]")
        sys.exit(1)
    
    html_file = sys.argv[1]
    state = sys.argv[2] if len(sys.argv) > 2 else "VA"
    county = sys.argv[3] if len(sys.argv) > 3 else "Fairfax County"
    site_name = sys.argv[4] if len(sys.argv) > 4 else "LDIP"
    
    test_county_extractor(html_file, state, county, site_name)
