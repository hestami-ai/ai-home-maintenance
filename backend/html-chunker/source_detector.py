"""
Source detection module for identifying data sources from URLs.
"""
import re
from typing import Optional
from urllib.parse import urlparse
import logging

logger = logging.getLogger(__name__)

# Source types
SOURCE_GOOGLE_MAPS = "google_maps"
SOURCE_THUMBTACK = "thumbtack"
SOURCE_YELP = "yelp"
SOURCE_GENERIC = "generic"

# URL patterns for source detection
SOURCE_PATTERNS = {
    SOURCE_GOOGLE_MAPS: [
        r'google\.com/maps',
        r'www\.google\.com/maps',
        r'maps\.google\.com',
        r'goo\.gl/maps',
    ],
    SOURCE_THUMBTACK: [
        r'thumbtack\.com',
        r'www\.thumbtack\.com',
    ],
    SOURCE_YELP: [
        r'yelp\.com',
        r'www\.yelp\.com',
        r'm\.yelp\.com',
    ],
}


def detect_source_from_url(url: Optional[str]) -> str:
    """
    Detect the data source from a URL.
    
    Args:
        url: The source URL to analyze
        
    Returns:
        Source identifier (e.g., 'google_maps', 'thumbtack', 'yelp', 'generic')
    """
    if not url:
        logger.warning("No URL provided, defaulting to generic source")
        return SOURCE_GENERIC
    
    try:
        # Parse the URL to get the hostname and path
        parsed = urlparse(url)
        hostname = parsed.netloc.lower() if parsed.netloc else ""
        path = parsed.path.lower() if parsed.path else ""
        
        # Combine hostname and path for pattern matching
        full_url_part = f"{hostname}{path}"
        
        logger.debug(f"Detecting source from: {full_url_part}")
        
        # Check against known patterns
        for source_type, patterns in SOURCE_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, full_url_part, re.IGNORECASE):
                    logger.info(f"Detected source: {source_type} from URL: {url}")
                    return source_type
        
        # Default to generic if no match
        logger.info(f"No specific source detected for URL: {url}, using generic")
        return SOURCE_GENERIC
        
    except Exception as e:
        logger.error(f"Error detecting source from URL '{url}': {str(e)}")
        return SOURCE_GENERIC


def get_source_display_name(source: str) -> str:
    """
    Get a human-readable display name for a source.
    
    Args:
        source: Source identifier
        
    Returns:
        Display name
    """
    display_names = {
        SOURCE_GOOGLE_MAPS: "Google Maps",
        SOURCE_THUMBTACK: "Thumbtack",
        SOURCE_YELP: "Yelp",
        SOURCE_GENERIC: "Generic",
    }
    return display_names.get(source, source.title())


# Export key functions and constants
__all__ = [
    'detect_source_from_url',
    'get_source_display_name',
    'SOURCE_GOOGLE_MAPS',
    'SOURCE_THUMBTACK',
    'SOURCE_YELP',
    'SOURCE_GENERIC',
]
