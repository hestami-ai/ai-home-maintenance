"""
Shared API endpoint definition structure and request handling utilities.
"""

from typing import Dict, Any, Optional
from enum import Enum


class APIRoute(Enum):
    """
    Shared API route definitions.
    """
    
    # Link Management Routes
    CREATE_LINK = "/links"
    GET_LINK = "/links/{slug}"
    UPDATE_LINK = "/links/{slug}"
    DELETE_LINK = "/links/{slug}"
    
    # Redirection Routes
    REDIRECT = "/{slug}"
    REDIRECT_WITH_QUERY = "/{slug}/{query}"
    
    # Analytics Routes
    GET_ANALYTICS = "/analytics/{slug}"
    GET_ALL_ANALYTICS = "/analytics"
    
    # Data Governance Routes
    ERASE_DATA = "/governance/erase/{slug}"
    AUDIT_ERASURE = "/governance/audit/{audit_id}"


class APIDefaults:
    """
    Default API configurations and utilities.
    """
    
    @staticmethod
    def create_response(status: int, data: Optional[Dict[str, Any]] = None, 
                     error: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a standard API response structure.
        """
        response = {
            "status": status,
            "timestamp": None  # Will be set by API layer
        }
        
        if data:
            response["data"] = data
            
        if error:
            response["error"] = error
            
        return response


def validate_slug(slug: str) -> bool:
    """
    Validate that a slug conforms to the required format.
    """
    if not slug or len(slug) != 6:
        return False
    
    # Check if all characters are alphanumeric
    return all(c.isalnum() for c in slug)


def is_valid_uuid(uuid_str: str) -> bool:
    """
    Validate that a string is a valid UUID.
    """
    try:
        UUID(uuid_str)
        return True
    except (ValueError, TypeError):
        return False