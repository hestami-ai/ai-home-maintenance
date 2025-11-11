"""
Utility functions for enriching service provider data with geocoding and embeddings.
"""
import logging
import os
import httpx
import requests
from typing import Optional, Dict, Any, List
from django.contrib.gis.geos import Point

logger = logging.getLogger('celery')

# Ollama configuration for embeddings
OLLAMA_BASE_URL = os.environ.get('OLLAMA_BASE_URL', 'http://ollama:11434')
EMBEDDING_MODEL = 'qwen3-embedding:8b-q4_K_M'
EMBEDDING_DIMENSIONS = 4096  # qwen3-embedding:8b produces 4096-dimensional embeddings

# Azure Maps configuration
AZURE_MAPS_KEY = os.environ.get('AZURE_MAPS_KEY')


def geocode_address(address: str) -> Optional[Dict[str, Any]]:
    """
    Geocode an address to get latitude, longitude, and full geocoding response.
    
    Uses Azure Maps API for geocoding.
    
    Args:
        address: Full address string
        
    Returns:
        Dict with 'latitude', 'longitude', 'plus_code', 'source', 'full_response', or None
    """
    if not address or not address.strip():
        logger.debug("[GEOCODE] Empty address provided")
        return None
    
    if not AZURE_MAPS_KEY:
        logger.error("[GEOCODE] Azure Maps API key is not configured (AZURE_MAPS_KEY)")
        return None
    
    logger.info(f"[GEOCODE] Geocoding address: {address}")
    
    try:
        # Use Azure Maps Search API
        url = "https://atlas.microsoft.com/search/address/json"
        params = {
            "api-version": "1.0",
            "subscription-key": AZURE_MAPS_KEY,
            "query": address,
            "typeahead": "false",  # We want exact matches, not suggestions
            "limit": 1,  # Only need the top result
            "countrySet": "US"  # Assuming US addresses
        }
        
        logger.debug(f"[GEOCODE] Calling Azure Maps API: {url}")
        
        with httpx.Client(timeout=30.0) as client:
            response = client.get(url, params=params)
            response.raise_for_status()
            
            data = response.json()
            results = data.get("results", [])
            
            if not results:
                logger.warning(f"No geocoding results for address: {address}")
                return None
            
            # Get the top result
            top_result = results[0]
            position = top_result.get("position", {})
            
            latitude = position.get("lat")
            longitude = position.get("lon")
            
            if latitude is None or longitude is None:
                logger.warning(f"No coordinates in geocoding result for address: {address}")
                return None
            
            logger.info(f"Geocoded address '{address}' to ({latitude}, {longitude}) using Azure Maps")
            
            return {
                'latitude': float(latitude),
                'longitude': float(longitude),
                'plus_code': None,  # Azure Maps doesn't provide plus codes
                'source': 'AZURE_MAPS',
                'full_response': data  # Store the complete Azure Maps response
            }
        
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error geocoding address '{address}': {e.response.status_code} - {e.response.text}")
        return None
    except httpx.RequestError as e:
        logger.error(f"Request error geocoding address '{address}': {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Error geocoding address '{address}': {e}")
        return None


def create_point_from_coords(latitude: float, longitude: float) -> Point:
    """
    Create a PostGIS Point from latitude and longitude.
    
    Args:
        latitude: Latitude in decimal degrees
        longitude: Longitude in decimal degrees
        
    Returns:
        Django GIS Point object (SRID 4326)
    """
    # Point(longitude, latitude) - note the order!
    return Point(longitude, latitude, srid=4326)


def detect_source_name(source_url: str) -> str:
    """
    Auto-detect source name from URL.
    
    Args:
        source_url: URL of the scraped page
        
    Returns:
        Detected source name
    """
    if not source_url:
        return 'Unknown Source'
    
    url_lower = source_url.lower()
    
    # Map domains to source names
    source_map = {
        'maps.google.com': 'Google Maps',
        'google.com/maps': 'Google Maps',
        'thumbtack.com': 'Thumbtack',
        'yelp.com': 'Yelp',
        'angieslist.com': "Angi's List",
        'angi.com': 'Angi',
        'homeadvisor.com': 'HomeAdvisor',
        'bbb.org': 'Better Business Bureau',
        'dpor.virginia.gov': 'VA DPOR License Lookup',
        'scc.virginia.gov': 'VA SCC Business License',
        'virginia.gov': 'Virginia State Website',
        'maryland.gov': 'Maryland State Website',
        'dllr.state.md.us': 'MD DLLR License Lookup',
        'dc.gov': 'DC Government Website',
        'facebook.com': 'Facebook',
        'nextdoor.com': 'Nextdoor',
    }
    
    for domain, name in source_map.items():
        if domain in url_lower:
            return name
    
    # Fallback: extract domain name
    try:
        from urllib.parse import urlparse
        parsed = urlparse(source_url)
        domain = parsed.netloc or parsed.path
        # Clean up domain (remove www., etc.)
        domain = domain.replace('www.', '')
        return domain if domain else 'Unknown Source'
    except Exception:
        return 'Unknown Source'


def merge_scraped_data(processed_data: Dict[str, Any], existing_merged_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Merge new processed_data with existing merged_data.
    
    Strategy:
    - Keep all data from all sources
    - For conflicts, prefer the most complete/recent data
    - Deduplicate reviews by reviewer + date + platform
    - Merge arrays (services, payment_methods, etc.)
    - Track provenance for each field
    
    Args:
        processed_data: New data from current scrape
        existing_merged_data: Existing merged data from previous scrapes
        
    Returns:
        Merged data dictionary
    """
    if not existing_merged_data:
        return processed_data
    
    # Start with existing data
    merged = existing_merged_data.copy()
    
    # ========== BUSINESS INFO ==========
    existing_biz = merged.get('business_info', {})
    new_biz = processed_data.get('business_info', {})
    
    # Merge business_info fields - prefer non-empty, more complete data
    merged_biz = existing_biz.copy()
    
    # Name: prefer longer/more complete name
    if new_biz.get('name'):
        if not merged_biz.get('name') or len(new_biz['name']) > len(merged_biz.get('name', '')):
            merged_biz['name'] = new_biz['name']
    
    # Description: prefer longer description
    if new_biz.get('description'):
        if not merged_biz.get('description') or len(new_biz['description']) > len(merged_biz.get('description', '')):
            merged_biz['description'] = new_biz['description']
    
    # Years in business: prefer higher number (more recent data)
    if new_biz.get('years_in_business') and new_biz['years_in_business'] > merged_biz.get('years_in_business', 0):
        merged_biz['years_in_business'] = new_biz['years_in_business']
    
    # Employees: prefer higher number (more recent data)
    if new_biz.get('employees') and new_biz['employees'] > merged_biz.get('employees', 0):
        merged_biz['employees'] = new_biz['employees']
    
    # Business hours: prefer non-empty
    new_hours = new_biz.get('business_hours', {})
    existing_hours = merged_biz.get('business_hours', {})
    if new_hours and any(v for v in new_hours.values() if v):
        # If existing is empty or new has more days filled, use new
        existing_filled = sum(1 for v in existing_hours.values() if v)
        new_filled = sum(1 for v in new_hours.values() if v)
        if new_filled > existing_filled:
            merged_biz['business_hours'] = new_hours
    
    # Payment methods: merge arrays
    existing_payment = set(merged_biz.get('payment_methods', []))
    new_payment = set(new_biz.get('payment_methods', []))
    if new_payment:
        merged_biz['payment_methods'] = list(existing_payment | new_payment)
    
    # Social media: merge arrays
    existing_social = set(merged_biz.get('social_media', []))
    new_social = set(new_biz.get('social_media', []))
    if new_social:
        merged_biz['social_media'] = list(existing_social | new_social)
    
    # Service areas: merge arrays
    existing_areas = set(merged_biz.get('service_areas', []))
    new_areas = set(new_biz.get('service_areas', []))
    if new_areas:
        merged_biz['service_areas'] = list(existing_areas | new_areas)
    
    # Background check: prefer True
    if new_biz.get('background_check'):
        merged_biz['background_check'] = True
    
    # Awards: merge arrays
    existing_awards = merged_biz.get('awards', [])
    new_awards = new_biz.get('awards', [])
    if new_awards:
        merged_biz['awards'] = existing_awards + new_awards
    
    # License: prefer most complete license info
    new_license = new_biz.get('license', {})
    existing_license = merged_biz.get('license', {})
    if isinstance(new_license, dict) and isinstance(existing_license, dict):
        merged_license = existing_license.copy()
        for key in ['type', 'holder', 'number', 'valid_until', 'verified_on']:
            if new_license.get(key) and not existing_license.get(key):
                merged_license[key] = new_license[key]
        merged_biz['license'] = merged_license
    elif new_license:
        merged_biz['license'] = new_license
    
    # Contact information: merge, prefer non-null values
    new_contact = new_biz.get('contact_information', {})
    existing_contact = merged_biz.get('contact_information', {})
    if isinstance(new_contact, dict) and isinstance(existing_contact, dict):
        merged_contact = existing_contact.copy()
        for key in ['phone', 'email', 'website', 'address', 'plus_code']:
            if new_contact.get(key) and not existing_contact.get(key):
                merged_contact[key] = new_contact[key]
        merged_biz['contact_information'] = merged_contact
    elif new_contact:
        merged_biz['contact_information'] = new_contact
    
    merged['business_info'] = merged_biz
    
    # ========== REVIEWS ==========
    existing_reviews = merged.get('reviews', {})
    new_reviews = processed_data.get('reviews', {})
    
    merged_reviews = existing_reviews.copy()
    
    # Deduplicate individual reviews by (reviewer, date, platform)
    existing_individual = existing_reviews.get('individual_reviews', [])
    new_individual = new_reviews.get('individual_reviews', [])
    
    # Create set of existing review signatures
    existing_sigs = set()
    for review in existing_individual:
        sig = (review.get('reviewer', ''), review.get('date', ''), review.get('platform', ''))
        existing_sigs.add(sig)
    
    # Add only new unique reviews
    deduplicated_reviews = existing_individual.copy()
    for review in new_individual:
        sig = (review.get('reviewer', ''), review.get('date', ''), review.get('platform', ''))
        if sig not in existing_sigs:
            deduplicated_reviews.append(review)
            existing_sigs.add(sig)
    
    merged_reviews['individual_reviews'] = deduplicated_reviews
    
    # Update aggregated ratings: use weighted average or prefer source with more reviews
    if new_reviews.get('total_reviews'):
        existing_total = existing_reviews.get('total_reviews', 0)
        new_total = new_reviews.get('total_reviews', 0)
        
        # If new source has more reviews, prefer its rating
        if new_total > existing_total:
            merged_reviews['overall_rating'] = new_reviews.get('overall_rating')
            merged_reviews['total_reviews'] = new_total
            if new_reviews.get('rating_distribution'):
                merged_reviews['rating_distribution'] = new_reviews['rating_distribution']
    
    # Merge review keywords
    existing_keywords = set(existing_reviews.get('review_keywords', []))
    new_keywords = set(new_reviews.get('review_keywords', []))
    if new_keywords:
        merged_reviews['review_keywords'] = list(existing_keywords | new_keywords)
    
    merged['reviews'] = merged_reviews
    
    # ========== SERVICES ==========
    existing_services = merged.get('services', {})
    new_services = processed_data.get('services', {})
    
    merged_services = existing_services.copy()
    
    # Merge offered services
    existing_offered = set(existing_services.get('offered', []))
    new_offered = set(new_services.get('offered', []))
    if new_offered:
        merged_services['offered'] = list(existing_offered | new_offered)
    
    # Merge specialties
    existing_specialties = set(existing_services.get('specialties', []))
    new_specialties = set(new_services.get('specialties', []))
    if new_specialties:
        merged_services['specialties'] = list(existing_specialties | new_specialties)
    
    # Merge not_offered (less important, but keep for completeness)
    existing_not_offered = set(existing_services.get('not_offered', []))
    new_not_offered = set(new_services.get('not_offered', []))
    if new_not_offered:
        merged_services['not_offered'] = list(existing_not_offered | new_not_offered)
    
    merged['services'] = merged_services
    
    # ========== CUSTOMER INTERACTION ==========
    existing_interaction = merged.get('customer_interaction', {})
    new_interaction = processed_data.get('customer_interaction', {})
    
    merged_interaction = existing_interaction.copy()
    
    # Prefer non-empty values
    for key in ['onboarding_process', 'pricing_strategy', 'estimate_process', 'communication_style']:
        if new_interaction.get(key) and not existing_interaction.get(key):
            merged_interaction[key] = new_interaction[key]
    
    merged['customer_interaction'] = merged_interaction
    
    # ========== MEDIA ==========
    existing_media = merged.get('media', {})
    new_media = processed_data.get('media', {})
    
    merged_media = existing_media.copy()
    
    # Sum total photos
    existing_photos = existing_media.get('total_photos', 0)
    new_photos = new_media.get('total_photos', 0)
    merged_media['total_photos'] = max(existing_photos, new_photos)  # Use max, not sum (could be same photos)
    
    # Merge gallery links
    existing_gallery = existing_media.get('gallery_links', [])
    new_gallery = new_media.get('gallery_links', [])
    if new_gallery:
        merged_media['gallery_links'] = list(set(existing_gallery + new_gallery))
    
    merged['media'] = merged_media
    
    return merged


def generate_embedding(text: str) -> Optional[List[float]]:
    """
    Generate vector embedding for text using Ollama.
    
    Uses qwen3-embedding:8b-q4_K_M model via Ollama API.
    
    Args:
        text: Text to embed (e.g., business description)
        
    Returns:
        List of floats (1024 dimensions) or None on error
        
    Raises:
        Exception: If Ollama is unavailable (workflow should fail)
    """
    if not text or not text.strip():
        logger.warning("[EMBEDDING] Empty or whitespace-only text provided")
        return None
    
    logger.info(f"[EMBEDDING] Generating embedding for text (length: {len(text)} chars)")
    logger.debug(f"[EMBEDDING] Text preview: {text[:200]}...")
    
    try:
        # Ollama embeddings API endpoint
        url = f"{OLLAMA_BASE_URL}/api/embeddings"
        logger.debug(f"[EMBEDDING] Ollama URL: {url}")
        logger.debug(f"[EMBEDDING] Model: {EMBEDDING_MODEL}")
        
        # Prepare request
        truncated_text = text[:30000]  # qwen3 supports 32k context, use 30k to be safe
        if len(text) > 30000:
            logger.warning(f"[EMBEDDING] Text truncated from {len(text)} to 30000 chars")
            
        payload = {
            "model": EMBEDDING_MODEL,
            "prompt": truncated_text,
        }
        
        # Make request
        logger.debug(f"[EMBEDDING] Sending request to Ollama...")
        response = requests.post(url, json=payload, timeout=60)
        logger.debug(f"[EMBEDDING] Response status: {response.status_code}")
        response.raise_for_status()
        
        # Extract embedding
        result = response.json()
        embedding = result.get('embedding')
        
        if not embedding:
            logger.error(f"[EMBEDDING] No embedding in response: {result}")
            raise ValueError("No embedding returned from Ollama")
        
        logger.info(f"[EMBEDDING] Received embedding with {len(embedding)} dimensions")
        
        # Verify dimensions
        if len(embedding) != EMBEDDING_DIMENSIONS:
            logger.warning(
                f"[EMBEDDING] Expected {EMBEDDING_DIMENSIONS} dimensions, got {len(embedding)}. "
                f"Truncating or padding to match."
            )
            # Truncate or pad to match expected dimensions
            if len(embedding) > EMBEDDING_DIMENSIONS:
                embedding = embedding[:EMBEDDING_DIMENSIONS]
            else:
                embedding = embedding + [0.0] * (EMBEDDING_DIMENSIONS - len(embedding))
        
        logger.info(f"[EMBEDDING] Successfully generated {len(embedding)}-dimensional embedding")
        logger.debug(f"[EMBEDDING] Embedding sample (first 5): {embedding[:5]}")
        
        return embedding
        
    except requests.exceptions.Timeout as e:
        logger.error(f"[EMBEDDING] Ollama request timed out after 60s: {e}")
        raise Exception(f"Failed to generate embedding - Ollama timeout: {e}")
    except requests.exceptions.ConnectionError as e:
        logger.error(f"[EMBEDDING] Cannot connect to Ollama at {OLLAMA_BASE_URL}: {e}")
        raise Exception(f"Failed to generate embedding - Ollama unavailable: {e}")
    except requests.exceptions.RequestException as e:
        logger.error(f"[EMBEDDING] Ollama API request failed: {e}")
        raise Exception(f"Failed to generate embedding - Ollama error: {e}")
    except Exception as e:
        logger.error(f"[EMBEDDING] Unexpected error generating embedding: {e}", exc_info=True)
        raise Exception(f"Failed to generate embedding: {e}")


def prepare_embedding_text(provider_data: Dict[str, Any]) -> str:
    """
    Prepare text for embedding generation by combining key fields.
    
    Args:
        provider_data: Merged provider data
        
    Returns:
        Combined text string optimized for semantic search
    """
    parts = []
    
    # Company name
    business_info = provider_data.get('business_info', {})
    if business_info.get('name'):
        parts.append(f"Company: {business_info['name']}")
    
    # Description
    if business_info.get('description'):
        parts.append(business_info['description'])
    
    # Services offered
    services = provider_data.get('services', {})
    if services.get('offered'):
        parts.append(f"Services: {', '.join(services['offered'])}")
    
    # Specialties
    if services.get('specialties'):
        parts.append(f"Specialties: {', '.join(services['specialties'])}")
    
    # Service areas
    if provider_data.get('service_area'):
        service_area = provider_data['service_area']
        if isinstance(service_area, dict):
            normalized = service_area.get('normalized', {})
            areas = []
            areas.extend(normalized.get('counties', []))
            areas.extend(normalized.get('states', []))
            areas.extend(normalized.get('independent_cities', []))
            if areas:
                parts.append(f"Service Areas: {', '.join(areas)}")
    
    return ' | '.join(parts)
