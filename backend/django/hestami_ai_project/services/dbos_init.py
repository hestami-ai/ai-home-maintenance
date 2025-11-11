"""
DBOS initialization for Django.

This module handles the initialization of DBOS when Django starts up.
DBOS will use the same PostgreSQL database as Django but with a separate 'dbos' schema.
"""
import os
import logging
from typing import Optional
from dbos import DBOS

logger = logging.getLogger(__name__)

_dbos_instance: Optional[DBOS] = None
_dbos_pid: Optional[int] = None  # Track which process initialized DBOS


def initialize_dbos() -> DBOS:
    """
    Initialize DBOS with Django's database configuration.
    
    This is process-safe - if called from a different process (e.g., different Gunicorn worker),
    it will reinitialize DBOS for that process. PostgreSQL connections cannot be shared
    across processes.
    
    Returns:
        DBOS instance
    """
    global _dbos_instance, _dbos_pid
    
    current_pid = os.getpid()
    
    # If already initialized in this process, return existing instance
    if _dbos_instance is not None and _dbos_pid == current_pid:
        logger.debug(f"DBOS already initialized in process {current_pid}, returning existing instance")
        return _dbos_instance
    
    # If initialized in a different process, we need to reinitialize
    if _dbos_instance is not None and _dbos_pid != current_pid:
        logger.info(f"DBOS was initialized in process {_dbos_pid}, reinitializing for process {current_pid}")
        _dbos_instance = None
    
    logger.info("Initializing DBOS...")
    
    try:
        # Get database configuration from environment variables
        # These should match Django's DATABASES['default'] configuration
        db_config = {
            'hostname': os.environ.get('SQL_HOST', 'localhost'),
            'port': int(os.environ.get('SQL_PORT', '5432')),
            'username': os.environ.get('SQL_USER', 'postgres'),
            'password': os.environ.get('SQL_PASSWORD', 'postgres'),
            'app_db_name': os.environ.get('SQL_DATABASE', 'hestami_ai'),
            'sys_db_name': os.environ.get('SQL_DATABASE', 'hestami_ai'),
            'app_db_schema': 'public',
            'sys_db_schema': 'dbos',  # DBOS uses separate schema for its state
            'ssl': False,
            'connectionTimeoutMillis': 3000,
        }
        
        # Create DBOS configuration
        # DBOS expects a simpler config format
        db_url = os.environ.get(
            'DBOS_SYSTEM_DATABASE_URL',
            f"postgresql://{db_config['username']}:{db_config['password']}@"
            f"{db_config['hostname']}:{db_config['port']}/{db_config['app_db_name']}"
        )
        
        config = {
            'name': 'hestami-ai-services',
            'system_database_url': db_url,
        }
        
        # Add DBOS Cloud API key if available for Conductor integration
        dbos_api_key = os.environ.get('DBOS_API_KEY')
        if dbos_api_key:
            config['api_key'] = dbos_api_key
            logger.info("DBOS Cloud API key configured - workflows will be visible in Conductor")
        
        # Initialize DBOS with config parameter
        # Note: You may see "prepared statement already exists" warnings in logs
        # These are harmless - DBOS handles them internally and they don't affect data integrity
        _dbos_instance = DBOS(config=config)
        
        # Register workflows and activities
        # Import here to avoid circular imports
        from services.workflows import ServiceProviderIngestionWorkflow
        
        # DBOS will automatically discover @DBOS.workflow() and @DBOS.step() decorators
        # when the module is imported
        
        # Launch DBOS to start processing
        DBOS.launch()
        
        # Store the process ID
        _dbos_pid = current_pid
        
        logger.info(f"DBOS initialized and launched successfully in process {current_pid}")
        return _dbos_instance
        
    except Exception as e:
        logger.exception(f"Failed to initialize DBOS: {e}")
        raise


def get_dbos_instance() -> Optional[DBOS]:
    """
    Get the initialized DBOS instance for this process.
    
    If DBOS hasn't been initialized in this process yet, it will be initialized now.
    This supports lazy per-worker initialization with multi-process Gunicorn.
    
    Returns:
        DBOS instance
    """
    global _dbos_instance, _dbos_pid
    
    current_pid = os.getpid()
    
    # If not initialized in this process, initialize now
    if _dbos_instance is None or _dbos_pid != current_pid:
        logger.info(f"Lazy-initializing DBOS for process {current_pid}")
        return initialize_dbos()
    
    return _dbos_instance


def shutdown_dbos():
    """
    Shutdown DBOS and clean up resources.
    
    This should be called during Django app shutdown.
    """
    global _dbos_instance
    
    if _dbos_instance is not None:
        logger.info("Shutting down DBOS...")
        try:
            # Destroy DBOS singleton and close connections
            DBOS.destroy()
            _dbos_instance = None
            logger.info("DBOS shutdown complete")
        except Exception as e:
            logger.exception(f"Error during DBOS shutdown: {e}")
