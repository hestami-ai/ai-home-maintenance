# Ollama Embeddings Integration

**Date:** November 6, 2025

## Overview

Switched from OpenAI embeddings to local Ollama embeddings using **qwen3-embedding:8b-q4_K_M** model.

## Configuration

### Model Details
- **Model**: qwen3-embedding:8b-q4_K_M
- **Dimensions**: 1024 (configurable from 32-4096)
- **Context Length**: 32k tokens
- **Languages**: 100+ languages supported
- **Performance**: State-of-the-art on MTEB multilingual leaderboard

### Environment Variables
```bash
# Required - same as html-chunker
OLLAMA_BASE_URL=http://ollama:11434
```

## Changes Made

### 1. Updated `enrichment_utils.py`
- Replaced OpenAI API calls with Ollama API
- Changed endpoint to `/api/embeddings`
- Updated dimensions from 1536 → 1024
- Increased context limit from 8k → 30k chars (qwen3 supports 32k)
- **Failure behavior**: Raises exception if Ollama unavailable (workflow fails)

### 2. Updated `base_models.py`
- Changed `VectorField` dimensions from 1536 → 1024
- Updated comment to reference qwen3-embedding

### 3. Updated `requirements.txt`
- Removed `openai==2.7.1` dependency
- Kept `requests` (already present)

### 4. Created Migration `0026_alter_vector_dimensions_for_ollama.py`
- Drops existing HNSW index
- Alters `description_embedding` field to 1024 dimensions
- Recreates HNSW index with new dimensions
- Uses `CONCURRENTLY` for zero-downtime

## API Comparison

### OpenAI (Old)
```python
client = openai.OpenAI(api_key=OPENAI_API_KEY)
response = client.embeddings.create(
    model='text-embedding-3-small',
    input=text,
    dimensions=1536
)
embedding = response.data[0].embedding
```

### Ollama (New)
```python
response = requests.post(
    f"{OLLAMA_BASE_URL}/api/embeddings",
    json={
        "model": "qwen3-embedding:8b-q4_K_M",
        "prompt": text
    }
)
embedding = response.json()['embedding']
```

## Migration Steps

### 1. Apply Migration
```powershell
docker compose -f compose.dev.yaml exec api python manage.py migrate services 0026
```

This will:
1. Drop old HNSW index (1536 dimensions)
2. Alter vector field to 1024 dimensions
3. Recreate HNSW index (1024 dimensions)

### 2. Clear Existing Embeddings (Optional)
If you have existing providers with 1536-dimension embeddings:

```sql
-- Connect to database
docker compose -f compose.dev.yaml exec db psql -U hestami_user -d hestami_db

-- Clear old embeddings
UPDATE services_serviceprovider SET description_embedding = NULL;
```

### 3. Rebuild Docker Image
```powershell
# Rebuild without openai dependency
docker compose -f compose.dev.yaml build api

# Restart
docker compose -f compose.dev.yaml up -d api
```

### 4. Verify Ollama Model
```powershell
# Check if model is available
docker compose -f compose.dev.yaml exec ollama ollama list

# If not present, pull it
docker compose -f compose.dev.yaml exec ollama ollama pull qwen3-embedding:8b-q4_K_M
```

## Testing

### Test Embedding Generation
```python
from services.workflows.enrichment_utils import generate_embedding

# Test embedding
text = "Professional HVAC repair and maintenance services"
embedding = generate_embedding(text)

print(f"Dimensions: {len(embedding)}")  # Should be 1024
print(f"Sample values: {embedding[:5]}")
```

### Test Semantic Search
```python
from services.utils.query_builder import ServiceProviderQueryBuilder

# Semantic search
results = (ServiceProviderQueryBuilder()
    .semantic_search("emergency plumbing services", limit=10)
    .execute()
)

for provider in results:
    print(f"{provider.business_name} - Similarity: {provider.similarity}")
```

## Benefits

### ✅ Advantages
1. **No API costs** - Runs locally
2. **No API key management** - No secrets to manage
3. **Privacy** - Data stays local
4. **Multilingual** - 100+ languages supported
5. **Longer context** - 32k vs 8k tokens
6. **State-of-the-art** - Top MTEB performance

### ⚠️ Considerations
1. **Synchronous** - Blocks workflow during embedding generation
2. **Resource usage** - Requires Ollama service running
3. **Latency** - May be slower than OpenAI API (depends on hardware)
4. **Dimension change** - Existing embeddings incompatible (need regeneration)

## Performance

### Expected Timing
- **Small text** (< 1k chars): ~100-500ms
- **Medium text** (1k-10k chars): ~500ms-2s
- **Large text** (10k-30k chars): ~2-5s

Times vary based on:
- Hardware (GPU vs CPU)
- Model quantization (q4_K_M)
- Concurrent requests

## Troubleshooting

### Ollama Connection Error
```
Failed to generate embedding - Ollama unavailable: Connection refused
```

**Solution:**
```powershell
# Check Ollama is running
docker compose -f compose.dev.yaml ps ollama

# Check Ollama logs
docker compose -f compose.dev.yaml logs ollama

# Restart Ollama
docker compose -f compose.dev.yaml restart ollama
```

### Model Not Found
```
Error: model 'qwen3-embedding:8b-q4_K_M' not found
```

**Solution:**
```powershell
docker compose -f compose.dev.yaml exec ollama ollama pull qwen3-embedding:8b-q4_K_M
```

### Dimension Mismatch
```
Expected 1024 dimensions, got 4096
```

**Solution:** The code automatically truncates or pads to 1024 dimensions. Check logs for warnings.

## Rollback

If you need to revert to OpenAI:

### 1. Revert Code Changes
```powershell
git revert <commit-hash>
```

### 2. Rollback Migration
```powershell
docker compose -f compose.dev.yaml exec api python manage.py migrate services 0025
```

### 3. Add OpenAI Back
```bash
# requirements.txt
openai==2.7.1
```

### 4. Rebuild
```powershell
docker compose -f compose.dev.yaml build api
docker compose -f compose.dev.yaml up -d api
```

## Future Enhancements

1. **Async embedding generation** - Use Celery task queue
2. **Batch processing** - Generate embeddings in batches
3. **Caching** - Cache embeddings for identical text
4. **Fallback** - Try multiple models if one fails
5. **Monitoring** - Track embedding generation time and success rate
6. **Custom dimensions** - Allow per-use-case dimension configuration

## References

- **Qwen3 Embedding**: https://ollama.com/library/qwen3-embedding
- **Ollama API**: https://github.com/ollama/ollama/blob/main/docs/api.md
- **MTEB Leaderboard**: https://huggingface.co/spaces/mteb/leaderboard
