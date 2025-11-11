from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)


class ServicesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'services'
    
    def ready(self):
        """
        Initialize services when Django starts.
        
        Note: DBOS is NOT initialized here because it doesn't work with multi-process
        Gunicorn workers (PostgreSQL connections cannot be shared across processes).
        DBOS is initialized lazily per-worker when first needed.
        """
        logger.info("Services app ready (DBOS will initialize per-worker)")
