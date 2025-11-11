# Source-Aware Extraction Implementation

## Overview
Implemented automatic source detection and source-specific prompt templates for the html-chunker service to optimize extraction quality for different data sources (Google Maps, Thumbtack, Yelp, etc.).

## Implementation Date
November 5, 2025

## Components Modified

### 1. New Module: `source_detector.py`
**Location**: `backend/html-chunker/source_detector.py`

**Purpose**: Detect data source from URL hostname

**Key Functions**:
- `detect_source_from_url(url)` - Identifies source from URL patterns
- `get_source_display_name(source)` - Returns human-readable source name

**Supported Sources**:
- `google_maps` - Google Maps business listings
- `thumbtack` - Thumbtack service provider profiles
- `yelp` - Yelp business pages
- `generic` - Fallback for unknown sources

### 2. Enhanced: `prompts.py`
**Location**: `backend/html-chunker/prompts.py`

**Changes**:
- Added Google Maps-specific prompt components:
  - `GOOGLE_MAPS_INTRODUCTION` - Deterministic extractor introduction
  - `GOOGLE_MAPS_CRITICAL_RULES` - Strict "omit if not present" rules
  - `GOOGLE_MAPS_SERVICE_AREA_RULES` - Service area vs address distinction, Plus Code handling
  - `GOOGLE_MAPS_EXTRACTION_STEPS` - Normalize UI chrome, extract explicit data only
  - `GOOGLE_MAPS_OUTPUT_FORMAT` - Strict JSON conformance requirements

- Updated functions to accept `source` parameter:
  - `get_full_extraction_prompt(schema_str, instruction_prompt=None, source=None)`
  - `get_extraction_prompt_with_content(schema_str, content, instruction_prompt=None, source=None)`

**Google Maps Prompt Key Features**:
- No guessing or inventing data
- Omit fields not explicitly present
- ISO-8601 dates only (omit relative dates like "4 weeks ago")
- Distinguish between Plus Codes and service areas
- Strip UI chrome (Save, Share, Directions, etc.)
- Cross-check HTML attributes with raw text

### 3. Schema Update: `service-provider-schema.json`
**Location**: `backend/html-chunker/schemas/service-provider-schema.json`

**Changes**:
- Added `plus_code` field to `contact_information` object
  ```json
  "contact_information": {
    "type": "object",
    "properties": {
      "website": { "type": "string" },
      "phone": { "type": "string" },
      "address": { "type": "string" },
      "plus_code": { "type": "string" }
    }
  }
  ```

### 4. API Endpoints: `api.py`
**Location**: `backend/html-chunker/api.py`

**Changes**:
- Added `source_url` parameter to both endpoints:
  - `/extract` (multipart form)
  - `/extract_from_string` (JSON)
- Updated `HTMLExtractionRequest` Pydantic model with `source_url` field
- Passes `source_url` to `process_html()` function
- Logs source URL for debugging

### 5. Extraction Engine: `extractor.py`
**Location**: `backend/html-chunker/extractor.py`

**Changes**:
- Added `source_url` parameter to all extraction functions:
  - `process_html()`
  - `process_html_file()`
  - `extract_directly()`
  - `extract_from_chunk()`
  - `extract_with_llm()`
  - `create_extraction_prompt()`

- Added source detection at start of `process_html()`:
  ```python
  from source_detector import detect_source_from_url, get_source_display_name
  source = detect_source_from_url(source_url)
  logger.info(f"Detected source: {get_source_display_name(source)}")
  ```

- Propagates `source` identifier through entire extraction pipeline

### 6. Chunker Utilities: `chunker.py`
**Location**: `backend/html-chunker/chunker.py`

**Changes**:
- Updated `get_prompt_template_tokens()` to accept `source` parameter
- Passes `source` to `get_full_extraction_prompt()` for accurate token counting

### 7. DBOS Workflow: `provider_ingestion.py`
**Location**: `backend/django/hestami_ai_project/services/workflows/provider_ingestion.py`

**Changes**:
- Updated `extract_html()` step to use `/extract_from_string` endpoint
- Sends all three required parameters:
  - `html_content` - Raw HTML from `scraped_data.raw_html`
  - `text_content` - Plain text from `scraped_data.raw_text`
  - `source_url` - Source URL from `scraped_data.source_url`
- Removed temporary file creation (no longer needed with JSON endpoint)
- Added logging of source URL for traceability

**Before**:
```python
# Used /extract endpoint with multipart form data
with tempfile.NamedTemporaryFile(...) as f:
    files = {'file': ('scraped.html', f, 'text/html')}
    response = requests.post(f"{HTML_CHUNKER_URL}/extract", files=files, data=data)
```

**After**:
```python
# Uses /extract_from_string endpoint with JSON payload
payload = {
    'html_content': scraped_data.raw_html,
    'text_content': scraped_data.raw_text if scraped_data.raw_text else None,
    'source_url': scraped_data.source_url,
    'llm': HTML_CHUNKER_LLM,
    'model': HTML_CHUNKER_MODEL,
    'max_tokens': HTML_CHUNKER_MAX_TOKENS,
    'overlap_percent': HTML_CHUNKER_OVERLAP,
    'log_level': HTML_CHUNKER_LOG_LEVEL,
}
response = requests.post(
    f"{HTML_CHUNKER_URL}/extract_from_string",
    json=payload,
    headers={'Content-Type': 'application/json'},
    timeout=300
)
```

## Data Flow

```
1. Django Workflow (provider_ingestion.py)
   ↓ Sends: html_content, text_content, source_url
   
2. FastAPI Endpoint (/extract_from_string)
   ↓ Receives request, logs source_url
   
3. Source Detector (source_detector.py)
   ↓ Analyzes URL hostname → Returns source identifier
   
4. Extractor (extractor.py)
   ↓ Preprocesses HTML, detects source
   
5. Prompt Generator (prompts.py)
   ↓ Selects appropriate prompt template based on source
   
6. LLM Extraction
   ↓ Processes with source-optimized prompt
   
7. Response
   ↓ Returns structured JSON to Django workflow
```

## Source-Specific Prompt Differences

### Google Maps Prompt
- **Philosophy**: Deterministic, strict, "omit if not present"
- **Key Rules**:
  - Never invent or guess data
  - Omit fields without explicit evidence
  - ISO-8601 dates only (no relative dates)
  - Distinguish Plus Codes from service areas
  - Strip UI chrome elements
  - No rating distribution unless explicitly shown
- **Use Case**: High-precision extraction from structured Google Maps data

### Generic/Thumbtack Prompt
- **Philosophy**: Flexible, comprehensive extraction
- **Key Rules**:
  - Extract from HTML attributes (data-star, aria-label)
  - Cross-check with raw text
  - Use null for missing values
  - Identify alternative terms for fields
  - Extract numbers properly (5 years → 5)
- **Use Case**: General-purpose extraction from varied sources

## Adding New Sources

To add a new source (e.g., Yelp-specific prompt):

1. **Add URL patterns** in `source_detector.py`:
   ```python
   SOURCE_YELP = "yelp"
   SOURCE_PATTERNS = {
       SOURCE_YELP: [r'yelp\.com', r'www\.yelp\.com'],
   }
   ```

2. **Create prompt components** in `prompts.py`:
   ```python
   YELP_INTRODUCTION = """..."""
   YELP_CRITICAL_RULES = """..."""
   ```

3. **Add conditional logic** in `get_full_extraction_prompt()`:
   ```python
   if source == SOURCE_YELP:
       return f"""{YELP_INTRODUCTION}
       {YELP_CRITICAL_RULES}
       ...
       """
   ```

## Testing

### Manual Testing
```bash
# Test Google Maps extraction
curl -X POST http://localhost:8000/extract_from_string \
  -H "Content-Type: application/json" \
  -d '{
    "html_content": "<html>...</html>",
    "text_content": "raw text...",
    "source_url": "https://www.google.com/maps/place/...",
    "llm": "ollama",
    "model": "qwen2.5:14b-instruct-q4_1"
  }'
```

### Expected Behavior
- Google Maps URLs → Uses strict Google Maps prompt
- Thumbtack URLs → Uses generic/Thumbtack prompt
- Unknown URLs → Uses generic prompt
- Logs show detected source for debugging

## Benefits

1. **Improved Extraction Quality**: Source-specific prompts optimize for each platform's data structure
2. **Reduced Hallucination**: Strict "omit if not present" rules prevent invented data
3. **Better Service Area Handling**: Distinguishes between addresses and service areas
4. **Extensible Architecture**: Easy to add new sources without modifying core logic
5. **Automatic Detection**: No manual configuration needed per request
6. **Cross-Check Support**: Raw text validation for HTML attribute extraction

## Backward Compatibility

- Existing code without `source_url` parameter continues to work
- Falls back to generic prompt when source_url is None or unrecognized
- No breaking changes to API contracts
- Original `/extract` endpoint still available for file uploads

## Configuration

No new environment variables required. Uses existing html-chunker configuration:
- `HTML_CHUNKER_URL`
- `HTML_CHUNKER_LLM`
- `HTML_CHUNKER_MODEL`
- `HTML_CHUNKER_MAX_TOKENS`
- `HTML_CHUNKER_OVERLAP`
- `HTML_CHUNKER_LOG_LEVEL`

## Monitoring

Key log messages to monitor:
- `"Detected source: {source_name}"` - Confirms source detection
- `"Calling html-chunker with source URL: {url}"` - Workflow request
- `"Source URL provided: {url}"` - API endpoint receipt

## Future Enhancements

1. Add Yelp-specific prompt template
2. Add Angi/HomeAdvisor-specific prompts
3. Machine learning-based source detection
4. A/B testing framework for prompt effectiveness
5. Source-specific schema variations
6. Confidence scoring per source type
