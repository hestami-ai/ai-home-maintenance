# Service Provider Ingestion Workflow - Troubleshooting Guide

## Common Issues

### 1. DBOS Not Initialized Error

**Symptom**: Celery task fails with "DBOS not initialized - cannot launch workflow"

**Causes**:
- DBOS initialization failed during Django startup
- Database connection issues
- Missing DBOS schema

**Solutions**:

1. Check Django logs for DBOS initialization errors:
   ```bash
   # Look for "Failed to initialize DBOS" or "DBOS initialized successfully"
   docker logs django-container | grep DBOS
   ```

2. Verify database connection:
   ```bash
   python manage.py dbshell
   \dn  # List schemas - should see 'dbos'
   ```

3. Initialize DBOS schema if missing:
   ```bash
   python manage.py init_dbos_schema
   ```

4. Restart Django/Celery workers:
   ```bash
   docker-compose restart django celery
   ```

### 2. HTML Chunker Connection Failed

**Symptom**: Workflow fails at HTML extraction stage with connection timeout

**Causes**:
- HTML chunker service not running
- Incorrect `HTML_CHUNKER_URL` configuration
- Network connectivity issues

**Solutions**:

1. Check HTML chunker service status:
   ```bash
   docker ps | grep html-chunker
   curl http://html-chunker:8000/
   ```

2. Verify environment variable:
   ```bash
   echo $HTML_CHUNKER_URL
   # Should be: http://html-chunker:8000
   ```

3. Check HTML chunker logs:
   ```bash
   docker logs html-chunker-container
   ```

### 3. Workflow Stuck in "in_progress"

**Symptom**: Records remain in `scrape_status='in_progress'` indefinitely

**Causes**:
- Workflow crashed mid-execution
- Celery worker died
- Redis lock not released

**Solutions**:

1. Check for orphaned locks in Redis:
   ```bash
   redis-cli
   KEYS scraped_data_lock:*
   # Delete if needed: DEL scraped_data_lock:<uuid>
   ```

2. Manually reset status to retry:
   ```python
   from services.models import ServiceProviderScrapedData
   
   # Find stuck records
   stuck = ServiceProviderScrapedData.objects.filter(
       scrape_status='in_progress',
       last_scraped_at__lt=timezone.now() - timedelta(hours=1)
   )
   
   # Reset to pending
   stuck.update(scrape_status='pending', workflow_id=None)
   ```

3. Check Celery worker logs:
   ```bash
   docker logs celery-container | grep "scraped data"
   ```

### 4. Identity Resolution Always Creates New Providers

**Symptom**: Workflow creates duplicate providers instead of linking to existing ones

**Causes**:
- Company names don't match closely enough (< 70% similarity)
- Existing providers have very different names
- Fuzzy matching thresholds too strict

**Solutions**:

1. Check existing provider names:
   ```python
   from services.models import ServiceProvider
   ServiceProvider.objects.filter(business_name__icontains='<search term>')
   ```

2. Review match scores in logs:
   ```bash
   docker logs celery-container | grep "Match score"
   ```

3. Adjust thresholds in `identity_resolution.py` if needed:
   ```python
   THRESHOLD_AUTO_LINK = 85.0  # Lower to be more aggressive
   THRESHOLD_INTERVENTION = 70.0  # Lower to catch more ambiguous cases
   ```

### 5. Paused Intervention Records Not Retrying

**Symptom**: Records with `scrape_status='paused_intervention'` don't get processed after manual resolution

**Causes**:
- `service_provider` FK not set after manual review
- Celery beat not running
- Task not picking up paused_intervention status

**Solutions**:

1. Verify Celery beat is running:
   ```bash
   docker ps | grep celery-beat
   docker logs celery-beat-container
   ```

2. Check if task is scheduled:
   ```python
   from django_celery_beat.models import PeriodicTask
   PeriodicTask.objects.filter(name__icontains='provider')
   ```

3. Manually trigger task:
   ```python
   from services.tasks import process_pending_service_provider_scraped_data
   process_pending_service_provider_scraped_data.delay()
   ```

4. Verify manual resolution was saved:
   ```python
   record = ServiceProviderScrapedData.objects.get(id='<uuid>')
   print(f"Status: {record.scrape_status}")
   print(f"Provider: {record.service_provider}")
   # Should have service_provider set or status changed to 'pending'
   ```

## Monitoring Queries

### Check Workflow Status Distribution

```python
from services.models import ServiceProviderScrapedData
from django.db.models import Count

ServiceProviderScrapedData.objects.values('scrape_status').annotate(
    count=Count('id')
).order_by('scrape_status')
```

### Find Records Needing Intervention

```python
from services.models import ServiceProviderScrapedData

interventions = ServiceProviderScrapedData.objects.filter(
    scrape_status='paused_intervention'
).select_related('service_provider')

for record in interventions:
    print(f"ID: {record.id}")
    print(f"Source: {record.source_name}")
    print(f"Reason: {record.intervention_reason}")
    print("---")
```

### Check Recent Failures

```python
from services.models import ServiceProviderScrapedData
from django.utils import timezone
from datetime import timedelta

recent_failures = ServiceProviderScrapedData.objects.filter(
    scrape_status='failed',
    last_scraped_at__gte=timezone.now() - timedelta(hours=24)
)

for record in recent_failures:
    print(f"ID: {record.id}")
    print(f"Error: {record.error_message}")
    print("---")
```

### View DBOS Workflow State

```sql
-- Connect to PostgreSQL
\c hestami_ai

-- Switch to DBOS schema
SET search_path TO dbos;

-- List DBOS tables
\dt

-- Check workflow executions (table structure depends on DBOS version)
SELECT * FROM workflow_status ORDER BY created_at DESC LIMIT 10;
```

## Performance Tuning

### Increase Batch Size

For higher throughput, increase the batch size:

```bash
# In .env or docker-compose.yml
SERVICE_PROVIDER_BATCH_SIZE=5  # Process 5 records per task
```

**Note**: Higher batch sizes increase memory usage and may cause timeouts.

### Adjust Task Interval

Change how often the task runs:

```bash
SERVICE_PROVIDER_PROCESSOR_INTERVAL=30  # Run every 30 seconds
```

### Celery Worker Concurrency

Increase Celery worker concurrency in settings.py:

```python
CELERY_WORKER_CONCURRENCY = 8  # More workers
```

## Logging

### Enable Debug Logging

For detailed workflow logs:

```bash
# In .env
DBOS_LOG_LEVEL=DEBUG
HTML_CHUNKER_LOG_LEVEL=DEBUG
```

### View Workflow Execution Logs

```bash
# Django logs
docker logs django-container | grep "ServiceProviderIngestionWorkflow"

# Celery logs
docker logs celery-container | grep "scraped data"

# HTML chunker logs
docker logs html-chunker-container
```

## Contact & Support

For issues not covered here:
1. Check DBOS documentation: https://docs.dbos.dev/
2. Review Django logs for stack traces
3. Check Celery task results in Django admin
4. Query DBOS internal tables for workflow state
