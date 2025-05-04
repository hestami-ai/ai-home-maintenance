We need to create a Celery task that will be the GPU singleton for processing the service requests that have newly added research that needs to be processed. What that looks like is when an Hestami admin staff adds a new service research request (and specifically, any service research request that has the status of "In Research" and research data field is empty or perhaps has empty JSON in it (it's unclear how JSONField data types in Django work in this regard)) then that should trigger a Celery task that will process the GPU singleton for processing the service requests that have newly added research that needs to be processed. Because there is only one GPU available, we need to enforce a singleton pattern around the GPU which is an HTTP request to a remote API. 

The file that is being sent is the HTML file that contains the service research data comes from the research content field of the service request which could be large and is why it's sent as a file.

To process a sequence of events serially, one at a time using Celery while ensuring that other Celery tasks do not interfere, you can use the task queue routing, worker concurrency settings, and locking mechanisms.

Here’s how you can enforce a singleton pattern around your constrained resource:

1. Use a Dedicated Celery Queue for Serial Processing
By defining a dedicated queue, you can ensure that only one worker is processing tasks related to your constrained resource.

Steps:
Assign the task to a specific queue.
Run a Celery worker that listens only to that queue.
Set --concurrency=1 so that the worker processes tasks one at a time.
Example:

python


from celery import Celery

app = Celery('tasks', broker='redis://localhost:6379/0')

@app.task(queue='serial_queue')
def process_event(event_data):
    # Simulate processing
    print(f"Processing event: {event_data}")
Run a worker that only listens to this queue:

sh


celery -A tasks worker --loglevel=info --queues=serial_queue --concurrency=1
This guarantees: ✅ Only one worker handles tasks from serial_queue
✅ Tasks are executed sequentially

2. Use a Distributed Lock for Singleton Enforcement
Even with a dedicated queue, a lock ensures no other process starts the task.

Using Redis Lock


import time
import redis
from celery import Celery
from redis.exceptions import LockError

app = Celery('tasks', broker='redis://localhost:6379/0')
redis_client = redis.StrictRedis(host='localhost', port=6379, db=0)

@app.task(queue='serial_queue')
def process_event(event_data):
    lock = redis_client.lock("event_processing_lock", timeout=30)  # Auto-release in 30s
    acquired = lock.acquire(blocking=False)
    
    if not acquired:
        print("Another process is already handling the task.")
        return

    try:
        print(f"Processing event: {event_data}")
        time.sleep(5)  # Simulated processing delay
    finally:
        lock.release()


3. Use Celery Task Rate Limits (Optional)
To prevent multiple tasks from running too frequently, use rate limits:

python


@app.task(rate_limit="1/m")  # 1 task per minute
def process_event(event_data):
    print(f"Processing event: {event_data}")