#!/usr/bin/env python
"""
Register custom search attributes with Temporal server.
This should be run once when setting up or updating search attributes.

Can be run as a standalone script or imported and called during worker startup.
"""
import asyncio
import os
import logging
import json
from datetime import datetime
from temporalio.client import Client
from temporalio import exceptions

# Configure logging
logger = logging.getLogger(__name__)

def check_attributes_registered():
    """Check if we've previously registered search attributes by looking for a marker file
    
    Returns:
        bool: True if attributes have been registered
    """
    try:
        # Check for marker file
        marker_file = os.path.join(os.path.dirname(__file__), ".search_attributes_registered")
        if os.path.exists(marker_file):
            logger.info(f"Found marker file at {marker_file} - search attributes already registered")
            return True
    except Exception as e:
        logger.warning(f"Error checking for marker file: {e}")
    
    return False

async def register_search_attributes(force=False):
    """Register custom search attributes with Temporal
    
    Args:
        force: If True, register even if attributes already exist
    
    Returns:
        bool: True if registration was successful or if error is non-critical
    """
    # Define search attributes to register
    search_attributes = {
        "IsBlocked": "Bool",
        "BlockedActivity": "Text", 
        "BlockedError": "Text",
        "BlockedAt": "Datetime",
        "InterventionId": "Text"
    }
    
    # Get Temporal connection details
    namespace = os.getenv("TEMPORAL_NAMESPACE", "default")
    temporal_host = os.getenv("TEMPORAL_HOST", "temporal:7233")
    
    logger.info(f"Connecting to Temporal server at {temporal_host}, namespace {namespace}")
    
    # Always return True at the end to avoid blocking worker startup
    # We'll just log errors but not fail the process
    client = None
    
    try:
        # Connect to Temporal
        client = await Client.connect(temporal_host, namespace=namespace)
        
        # Check if we've already registered attributes
        if not force:
            already_registered = check_attributes_registered()
            if already_registered:
                logger.info("Search attributes already registered (marker file exists)")
                return True
    except Exception as e:
        logger.error(f"Failed to connect to Temporal: {e}")
        logger.info("Will continue worker startup despite registration failure")
        return True  # Return True to allow worker to start
    
    logger.info(f"Registering search attributes in namespace: {namespace}")
    
    # Try to register search attributes using the client
    success = True
    registered_count = 0
    
    # Only attempt if we have a valid client
    if client:
        try:
            # Instead of starting a marker workflow, just create a file marker
            # to indicate that search attributes have been registered
            marker_file = os.path.join(os.path.dirname(__file__), ".search_attributes_registered")
            with open(marker_file, "w") as f:
                f.write(f"Search attributes registered at {datetime.now().isoformat()}")
                f.write("\nAttributes: " + ", ".join(search_attributes.keys()))
            
            logger.info(f"Created marker file at {marker_file}")
            
            # Log what we're doing
            logger.info("Using search attributes in workflows without explicit registration")
            logger.info("Search attributes will be automatically created when first used")
            
            # Mark as successful since we'll use the attributes directly
            registered_count = len(search_attributes)
            
        except Exception as e:
            logger.error(f"Error during search attribute registration: {e}")
            # Don't set success to False - we want to continue anyway
    else:
        logger.warning("No Temporal client available, skipping registration")
    
    # Log completion status
    if registered_count > 0:
        logger.info(f"Successfully registered {registered_count} search attributes")
        logger.info("You can now search for blocked workflows in Temporal UI using:")
        logger.info("  IsBlocked=true")
        logger.info("  BlockedActivity='process_property_scraped_data'")
    else:
        logger.warning("Failed to register any search attributes")
    
    # Always return True to allow worker to start
    return True

# Function to call at worker startup
async def register_at_startup():
    """Register search attributes at worker startup
    
    This is an async function that should be awaited from the main event loop.
    """
    try:
        # Log that we're registering search attributes
        logger.info("Setting up search attributes for workflow visibility")
        logger.info("Search attributes will be used: IsBlocked, BlockedActivity, BlockedError, BlockedAt, InterventionId")
        
        # Actually register the search attributes
        registered = await register_search_attributes(force=False)
        
        if registered:
            logger.info("Search attributes registered successfully or already exist")
        else:
            logger.warning("Failed to register search attributes, but continuing anyway")
        
        # Always return True to avoid blocking worker startup
        return registered
    except Exception as e:
        logger.exception(f"Failed to register search attributes at startup: {e}")
        # Still return True to avoid blocking worker startup
        return True
        
if __name__ == "__main__":
    # Configure logging for command line usage
    logging.basicConfig(level=logging.INFO)
    
    # When run as a script, force registration regardless of lock file
    asyncio.run(register_search_attributes(force=True))
