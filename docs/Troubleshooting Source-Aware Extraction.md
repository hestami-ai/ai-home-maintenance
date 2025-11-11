# Troubleshooting Source-Aware Extraction

## Issue: Old Code Still Running

### Symptoms
1. Logs show requests to `/extract` instead of `/extract_from_string`
2. Logs show "No URL provided, defaulting to generic source"
3. Old model name appears in logs (`qwen2.5:14b-instruct-q4_1` instead of `qwen3:4b-q4_K_M`)
4. Missing log entries for HTML content size and source URL

### Root Cause
**Django/Celery containers haven't been restarted** after code changes. Python code is cached in memory.

### Solution Steps

#### 1. Restart Django Container
```bash
# Stop and restart Django container
docker-compose -f compose.dev.yaml restart django

# Or rebuild if needed
docker-compose -f compose.dev.yaml up -d --build django
```

#### 2. Restart Celery Workers
```bash
# Restart Celery worker container
docker-compose -f compose.dev.yaml restart celery-worker

# Or rebuild if needed
docker-compose -f compose.dev.yaml up -d --build celery-worker
```

#### 3. Restart html-chunker (Already Done)
```bash
# You've already done this
docker-compose -f compose.dev.yaml up -d --build html-chunker
```

#### 4. Verify All Containers Are Running Latest Code
```bash
# Check container status
docker-compose -f compose.dev.yaml ps

# Check logs for each service
docker-compose -f compose.dev.yaml logs -f django
docker-compose -f compose.dev.yaml logs -f celery-worker
docker-compose -f compose.dev.yaml logs -f html-chunker
```

## Expected Log Output After Fix

### When Using /extract_from_string Endpoint
```
2025-11-05 15:37:52,952 - api - INFO - Extraction request received with LLM: ollama, model: qwen3:4b-q4_K_M
2025-11-05 15:37:52,952 - api - INFO - Log level set to: INFO
2025-11-05 15:37:52,952 - api - INFO - HTML content size: 18415 bytes
2025-11-05 15:37:52,952 - api - INFO - Raw text content size: 5234 bytes
2025-11-05 15:37:52,952 - api - INFO - Source URL provided: https://www.google.com/maps/place/...
2025-11-05 15:37:52,952 - extractor - INFO - Processing HTML content
2025-11-05 15:37:52,953 - source_detector - INFO - Detected source: Google Maps
2025-11-05 15:37:52,953 - extractor - INFO - Detected source: Google Maps
2025-11-05 15:37:52,953 - extractor - INFO - Using LLM: ollama, Model: qwen3:4b-q4_K_M
```

### Key Differences from Current Logs
1. ✅ Shows `/extract_from_string` endpoint (not `/extract`)
2. ✅ Shows HTML content size
3. ✅ Shows raw text content size (if provided)
4. ✅ Shows source URL
5. ✅ Shows "Detected source: Google Maps" (not "Generic")
6. ✅ Shows correct model: `qwen3:4b-q4_K_M`

## Verification Checklist

### 1. Check Django Workflow Code
```bash
# SSH into Django container
docker exec -it <django-container-name> bash

# Check the workflow file
cat /app/services/workflows/provider_ingestion.py | grep -A 20 "extract_from_string"

# Should show:
# response = requests.post(
#     f"{HTML_CHUNKER_URL}/extract_from_string",
#     json=payload,
#     ...
# )
```

### 2. Check Environment Variables
```bash
# In Django container
echo $HTML_CHUNKER_MODEL
# Should output: qwen3:4b-q4_K_M

# In html-chunker container
docker exec -it <html-chunker-container-name> python -c "from common import DEFAULT_MODEL; print(DEFAULT_MODEL)"
# Should output: qwen3:4b-q4_K_M
```

### 3. Test API Directly
```bash
# Test /extract_from_string endpoint
curl -X POST http://localhost:8000/extract_from_string \
  -H "Content-Type: application/json" \
  -d '{
    "html_content": "<html><body><h1>Test</h1></body></html>",
    "text_content": "Test",
    "source_url": "https://www.google.com/maps/place/test",
    "llm": "ollama",
    "model": "qwen3:4b-q4_K_M",
    "log_level": "INFO"
  }'
```

### 4. Check ServiceProviderScrapedData Records
```bash
# In Django shell
docker exec -it <django-container-name> python manage.py shell

# Run:
from services.models import ServiceProviderScrapedData
record = ServiceProviderScrapedData.objects.first()
print(f"Source URL: {record.source_url}")
print(f"Has raw_text: {bool(record.raw_text)}")
print(f"Has raw_html: {bool(record.raw_html)}")
```

## Common Issues

### Issue 1: Container Not Restarted
**Symptom**: Old code still running
**Solution**: Restart Django and Celery containers

### Issue 2: Environment Variables Not Updated
**Symptom**: Old model name in logs
**Solution**: 
1. Update `compose.dev.yaml` environment variables
2. Restart containers with `docker-compose up -d`

### Issue 3: Source URL is None/Empty
**Symptom**: "No URL provided, defaulting to generic source"
**Solution**: 
1. Check `ServiceProviderScrapedData.source_url` field is populated
2. Verify workflow is passing `source_url` in payload
3. Check API endpoint is receiving `source_url` parameter

### Issue 4: Using Wrong Endpoint
**Symptom**: Logs show `/extract` instead of `/extract_from_string`
**Solution**: 
1. Verify workflow code uses `/extract_from_string`
2. Restart Django container to reload code

## Quick Restart All Services
```bash
# Stop all services
docker-compose -f compose.dev.yaml down

# Rebuild and start all services
docker-compose -f compose.dev.yaml up -d --build

# Watch logs
docker-compose -f compose.dev.yaml logs -f
```

## Debugging Commands

### Check What Code is Running
```bash
# In Django container - check workflow code
docker exec <django-container> cat /app/services/workflows/provider_ingestion.py | grep -A 5 "HTML_CHUNKER_URL"

# In html-chunker container - check model
docker exec <html-chunker-container> cat /app/common.py | grep DEFAULT_MODEL
```

### Monitor Real-Time Logs
```bash
# All services
docker-compose -f compose.dev.yaml logs -f

# Just html-chunker
docker-compose -f compose.dev.yaml logs -f html-chunker

# Just Django
docker-compose -f compose.dev.yaml logs -f django

# Just Celery
docker-compose -f compose.dev.yaml logs -f celery-worker
```

### Test Workflow Manually
```python
# In Django shell
from services.workflows import ServiceProviderIngestionWorkflow
from services.dbos_init import get_dbos_instance
from services.models import ServiceProviderScrapedData

# Get a test record
record = ServiceProviderScrapedData.objects.filter(scrape_status='pending').first()
print(f"Testing with record: {record.id}")
print(f"Source URL: {record.source_url}")

# Create workflow and run
dbos = get_dbos_instance()
workflow = ServiceProviderIngestionWorkflow(dbos)
result = workflow.process_scraped_data(str(record.id))
print(result)
```

## Success Indicators

After proper restart, you should see:

1. ✅ **Correct endpoint**: `POST /extract_from_string`
2. ✅ **Correct model**: `qwen3:4b-q4_K_M`
3. ✅ **Source detection**: "Detected source: Google Maps" (for Google Maps URLs)
4. ✅ **Complete logging**: HTML size, text size, source URL all logged
5. ✅ **Workflow logs**: "Calling html-chunker with source URL: ..."

## Still Not Working?

If issues persist after restarting all containers:

1. **Check compose.dev.yaml** - Verify environment variables are set correctly
2. **Rebuild from scratch** - `docker-compose down -v && docker-compose up -d --build`
3. **Check Python path** - Ensure code changes are in the correct directory
4. **Check file mounts** - Verify volume mounts in docker-compose are correct
5. **Clear Python cache** - Delete `__pycache__` directories and `.pyc` files
