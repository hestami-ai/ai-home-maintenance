"""
Schema loader utility for loading JSON schemas for HTML extraction.
"""
import os
import json
from typing import Dict, Any, List, Optional

# Define the path to the schemas directory
SCHEMAS_DIR = os.path.join(os.path.dirname(__file__), "schemas")

# Map of schema types to their file paths
SCHEMA_FILES = {
    "business_info": "business_info_schema.json",
    "services": "services_schema.json",
    "reviews": "reviews_schema.json",
    "customer_interaction": "customer_interaction_schema.json",
    "media": "media_schema.json",
    "awards": "awards_schema.json",
    "discovery": "discovery_schema.json",
    "service-provider-schema": "service-provider-schema.json"
}

def load_schema(schema_type: str) -> Dict[str, Any]:
    """
    Load a specific schema by type.
    
    Args:
        schema_type (str): The type of schema to load (e.g., "business_info", "services", etc.)
        
    Returns:
        Dict[str, Any]: The loaded schema as a dictionary
        
    Raises:
        ValueError: If the schema type is not recognized
    """
    if schema_type not in SCHEMA_FILES:
        raise ValueError(f"Unknown schema type: {schema_type}. Available types: {', '.join(SCHEMA_FILES.keys())}")
    
    schema_path = os.path.join(SCHEMAS_DIR, SCHEMA_FILES[schema_type])
    
    try:
        with open(schema_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        raise FileNotFoundError(f"Schema file not found: {schema_path}")
    except json.JSONDecodeError:
        raise ValueError(f"Invalid JSON in schema file: {schema_path}")

def load_multiple_schemas(schema_types: List[str]) -> Dict[str, Any]:
    """
    Load and combine multiple schemas.
    
    Args:
        schema_types (List[str]): List of schema types to load and combine
        
    Returns:
        Dict[str, Any]: The combined schema
    """
    combined_schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {}
    }
    
    for schema_type in schema_types:
        schema = load_schema(schema_type)
        combined_schema["properties"].update(schema["properties"])
    
    return combined_schema

def get_schema_as_string(schema_type: str) -> str:
    """
    Get a schema as a formatted JSON string.
    
    Args:
        schema_type (str): The type of schema to load
        
    Returns:
        str: The schema as a formatted JSON string
    """
    schema = load_schema(schema_type)
    return json.dumps(schema, indent=2)

def get_multiple_schemas_as_string(schema_types: List[str]) -> str:
    """
    Get multiple combined schemas as a formatted JSON string.
    
    Args:
        schema_types (List[str]): List of schema types to load and combine
        
    Returns:
        str: The combined schema as a formatted JSON string
    """
    combined_schema = load_multiple_schemas(schema_types)
    return json.dumps(combined_schema, indent=2)

def get_schema_property(schema_type: str, property_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Get a specific property from a schema.
    
    Args:
        schema_type (str): The type of schema to load
        property_path (str, optional): Dot-separated path to the property (e.g., "reviews.individual_reviews")
        
    Returns:
        Dict[str, Any]: The requested schema property
    """
    schema = load_schema(schema_type)
    
    if not property_path:
        return schema
    
    # Navigate through the property path
    parts = property_path.split('.')
    current = schema
    
    for part in parts:
        if part in current.get("properties", {}):
            current = current["properties"][part]
        else:
            raise ValueError(f"Property path not found: {property_path}")
    
    return current
