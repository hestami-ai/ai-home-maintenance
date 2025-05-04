import os
from celery import Celery
from celery.signals import worker_ready

# Set the default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hestami_ai.settings')

app = Celery('hestami_ai')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django app configs.
app.autodiscover_tasks()

# Start the research queue processor when the worker is ready
@worker_ready.connect
def start_research_queue_on_worker_ready(**kwargs):
    """
    Start the research queue processor when the Celery worker is ready.
    This ensures we have a continuously running task that processes
    research entries serially.
    """
    # Import here to avoid circular imports
    from services.tasks import start_research_queue_processor
    
    # Start the research queue processor
    start_research_queue_processor()
