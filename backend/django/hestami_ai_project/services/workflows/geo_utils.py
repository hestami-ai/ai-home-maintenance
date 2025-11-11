"""
Geographic normalization utilities for service provider data.
"""
import logging
from typing import Dict, List, Set

logger = logging.getLogger('celery')

# Hardcoded VA city-to-county mapping (interim solution)
# TODO: Replace with authoritative data source (Azure Maps, curated dataset)
VA_CITY_TO_COUNTY = {
    # Independent cities (stand alone, not part of a county)
    'alexandria': {'type': 'independent_city', 'name': 'Alexandria', 'state': 'VA'},
    'fairfax city': {'type': 'independent_city', 'name': 'Fairfax City', 'state': 'VA'},
    'falls church': {'type': 'independent_city', 'name': 'Falls Church', 'state': 'VA'},
    'manassas': {'type': 'independent_city', 'name': 'Manassas', 'state': 'VA'},
    'manassas park': {'type': 'independent_city', 'name': 'Manassas Park', 'state': 'VA'},
    'arlington': {'type': 'county', 'name': 'Arlington County', 'state': 'VA'},
    
    # Cities within counties
    'vienna': {'type': 'city', 'county': 'Fairfax County', 'state': 'VA'},
    'reston': {'type': 'city', 'county': 'Fairfax County', 'state': 'VA'},
    'herndon': {'type': 'city', 'county': 'Fairfax County', 'state': 'VA'},
    'mclean': {'type': 'city', 'county': 'Fairfax County', 'state': 'VA'},
    'great falls': {'type': 'city', 'county': 'Fairfax County', 'state': 'VA'},
    'annandale': {'type': 'city', 'county': 'Fairfax County', 'state': 'VA'},
    'springfield': {'type': 'city', 'county': 'Fairfax County', 'state': 'VA'},
    'burke': {'type': 'city', 'county': 'Fairfax County', 'state': 'VA'},
    'centreville': {'type': 'city', 'county': 'Fairfax County', 'state': 'VA'},
    'chantilly': {'type': 'city', 'county': 'Fairfax County', 'state': 'VA'},
    'clifton': {'type': 'city', 'county': 'Fairfax County', 'state': 'VA'},
    'lorton': {'type': 'city', 'county': 'Fairfax County', 'state': 'VA'},
    'oakton': {'type': 'city', 'county': 'Fairfax County', 'state': 'VA'},
    
    # Loudoun County cities
    'leesburg': {'type': 'city', 'county': 'Loudoun County', 'state': 'VA'},
    'ashburn': {'type': 'city', 'county': 'Loudoun County', 'state': 'VA'},
    'sterling': {'type': 'city', 'county': 'Loudoun County', 'state': 'VA'},
    'purcellville': {'type': 'city', 'county': 'Loudoun County', 'state': 'VA'},
    
    # Prince William County cities
    'woodbridge': {'type': 'city', 'county': 'Prince William County', 'state': 'VA'},
    'dale city': {'type': 'city', 'county': 'Prince William County', 'state': 'VA'},
    'dumfries': {'type': 'city', 'county': 'Prince William County', 'state': 'VA'},
    'gainesville': {'type': 'city', 'county': 'Prince William County', 'state': 'VA'},
    'haymarket': {'type': 'city', 'county': 'Prince William County', 'state': 'VA'},
    'occoquan': {'type': 'city', 'county': 'Prince William County', 'state': 'VA'},
}

# Regional aliases
REGIONAL_ALIASES = {
    'northern virginia': ['Fairfax County', 'Loudoun County', 'Prince William County', 'Arlington County', 'Alexandria'],
    'nova': ['Fairfax County', 'Loudoun County', 'Prince William County', 'Arlington County', 'Alexandria'],
    'dmv': ['Fairfax County', 'Loudoun County', 'Prince William County', 'Arlington County', 'Alexandria'],
    'dmv area': ['Fairfax County', 'Loudoun County', 'Prince William County', 'Arlington County', 'Alexandria'],
}


def normalize_service_area(raw_service_areas: List[str]) -> Dict:
    """
    Normalize service area labels to structured county/state format.
    
    Args:
        raw_service_areas: List of raw service area strings from scraped data
        
    Returns:
        Dict with structure:
        {
            "normalized": {
                "counties": [...],
                "states": [...],
                "independent_cities": [...]
            },
            "raw_tags": [...]
        }
    """
    counties: Set[str] = set()
    states: Set[str] = set()
    independent_cities: Set[str] = set()
    raw_tags: List[str] = []
    
    for area in raw_service_areas:
        if not area:
            continue
            
        area_lower = area.lower().strip()
        raw_tags.append(area)
        
        # Check for regional aliases
        if area_lower in REGIONAL_ALIASES:
            for location in REGIONAL_ALIASES[area_lower]:
                if 'County' in location:
                    counties.add(location)
                else:
                    independent_cities.add(location)
            states.add('VA')
            continue
        
        # Check for direct county match
        if 'county' in area_lower:
            counties.add(area)
            # Extract state if present
            if ', va' in area_lower or ' va' in area_lower:
                states.add('VA')
            continue
        
        # Check VA city mapping
        if area_lower in VA_CITY_TO_COUNTY:
            mapping = VA_CITY_TO_COUNTY[area_lower]
            states.add(mapping['state'])
            
            if mapping['type'] == 'independent_city':
                independent_cities.add(mapping['name'])
            elif mapping['type'] == 'county':
                counties.add(mapping['name'])
            elif mapping['type'] == 'city' and 'county' in mapping:
                counties.add(mapping['county'])
            continue
        
        # Check for state-only entries
        state_abbrevs = ['va', 'md', 'dc', 'virginia', 'maryland']
        if area_lower in state_abbrevs:
            states.add(area_lower.upper() if len(area_lower) == 2 else 'VA')
            continue
        
        # If we can't normalize, just keep as raw tag
        logger.debug(f"Could not normalize service area: {area}")
    
    return {
        "normalized": {
            "counties": sorted(list(counties)),
            "states": sorted(list(states)),
            "independent_cities": sorted(list(independent_cities))
        },
        "raw_tags": raw_tags
    }
