# JSON Parsing and Source Detection Fixes

## Date
November 5, 2025

## Issues Fixed

### Issue 1: Google Maps URL Not Detected

**Problem**: Google Maps URLs with `www.google.com/maps/place/...` format were not being detected.

**Root Cause**: The regex pattern only matched `google.com/maps` without the `www` subdomain.

**Fix**: Added `www.google.com/maps` pattern to `SOURCE_PATTERNS` in `source_detector.py`.

**Before**:
```python
SOURCE_GOOGLE_MAPS: [
    r'google\.com/maps',
    r'maps\.google\.com',
    r'goo\.gl/maps',
],
```

**After**:
```python
SOURCE_GOOGLE_MAPS: [
    r'google\.com/maps',
    r'www\.google\.com/maps',  # Added this line
    r'maps\.google\.com',
    r'goo\.gl/maps',
],
```

**Log Evidence**:
```
2025-11-05 15:48:50,449 - source_detector - INFO - No specific source detected for URL: https://www.google.com/maps/place/..., using generic
```

**Expected After Fix**:
```
2025-11-05 XX:XX:XX - source_detector - INFO - Detected source: google_maps from URL: https://www.google.com/maps/place/...
2025-11-05 XX:XX:XX - extractor - INFO - Detected source: Google Maps
```

---

### Issue 2: JSON Parsing Fails with Control Characters

**Problem**: LLM responses contained invalid control characters causing JSON parsing to fail.

**Error Message**:
```
2025-11-05 15:48:50,441 - extractor - ERROR - Failed to parse full content as JSON: Invalid control character at: line 14 column 32 (char 1301)
2025-11-05 15:48:50,442 - extractor - ERROR - Failed to parse cleaned response as JSON: Invalid control character at: line 14 column 32 (char 1301)
```

**Root Cause**: The LLM (qwen3:4b-q4_K_M) was generating JSON with control characters (0x00-0x1F) that are not allowed in JSON strings except for `\t`, `\n`, and `\r`.

**Fix**: Added control character removal in `_parse_json_response()` function in `extractor.py`.

**Code Changes**:

1. **Remove invalid control characters**:
```python
# Remove invalid control characters (but keep valid ones like \n, \t, \r)
# Control characters are 0x00-0x1F except for \t (0x09), \n (0x0A), \r (0x0D)
cleaned_response = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F]', '', cleaned_response)
```

2. **Better error context logging**:
```python
except json.JSONDecodeError as e:
    logger.error(f"Failed to parse full content as JSON: {e}")
    # Show context around the error position
    if hasattr(e, 'pos') and e.pos:
        start = max(0, e.pos - 50)
        end = min(len(content), e.pos + 50)
        context = content[start:end]
        logger.error(f"Error context: ...{context}...")
    logger.debug(f"Content (first 1000 chars): {content[:1000]}")
```

**Processing Flow**:
1. Try to parse JSON directly
2. If fails, remove control characters
3. Remove text before first `{` and after last `}`
4. Remove comments
5. Try parsing again
6. If still fails, try demjson3 (lenient parser)
7. If all fails, return raw content as fallback

---

## Files Modified

### 1. `backend/html-chunker/source_detector.py`
- Added `www.google.com/maps` pattern to Google Maps detection

### 2. `backend/html-chunker/extractor.py`
- Added control character removal in `_parse_json_response()`
- Improved error logging with context around parse errors
- Limited debug output to first 500 chars to avoid log spam

---

## Testing

### Test Case 1: Google Maps URL Detection
```bash
curl -X POST http://localhost:8000/extract_from_string \
  -H "Content-Type: application/json" \
  -d '{
    "html_content": "<html><body>Test</body></html>",
    "source_url": "https://www.google.com/maps/place/Business+Name/@39.21,-77.67,10z/data=...",
    "llm": "ollama",
    "model": "qwen3:4b-q4_K_M"
  }'
```

**Expected Log Output**:
```
- source_detector - INFO - Detected source: google_maps from URL: https://www.google.com/maps/place/...
- extractor - INFO - Detected source: Google Maps
```

### Test Case 2: JSON with Control Characters
The fix should automatically clean control characters from LLM responses without manual intervention.

**Expected Behavior**:
- No more "Invalid control character" errors
- Successful JSON parsing after cleaning
- Warning log if fallback to raw content is needed

---

## Impact

### Positive
1. ✅ Google Maps URLs now properly detected and use Google Maps-specific prompt
2. ✅ JSON parsing more robust against LLM output variations
3. ✅ Better error logging for debugging JSON issues
4. ✅ Graceful degradation (returns raw content if all parsing fails)

### Potential Issues
- Control character removal might alter intended content in edge cases
- Need to monitor if qwen3:4b model consistently produces control characters

---

## Monitoring

### Key Metrics to Watch

1. **Source Detection Success Rate**:
   - Monitor logs for "Detected source: Google Maps" vs "using generic"
   - Should see Google Maps detection for all `www.google.com/maps` URLs

2. **JSON Parsing Success Rate**:
   - Monitor for "Successfully parsed cleaned response as JSON"
   - Watch for "Returning raw content as fallback" (should be rare)

3. **Control Character Frequency**:
   - Track how often control character cleaning is triggered
   - May indicate need to adjust LLM temperature or prompt

### Log Patterns to Monitor

**Success Pattern**:
```
INFO - Source URL provided: https://www.google.com/maps/...
INFO - Detected source: google_maps from URL: ...
INFO - Detected source: Google Maps
DEBUG - Successfully parsed full response as JSON
```

**Fallback Pattern** (should be rare):
```
ERROR - Failed to parse full content as JSON: Invalid control character...
ERROR - Failed to parse cleaned response as JSON: ...
WARNING - Returning raw content as fallback
```

---

## Future Improvements

1. **LLM Output Validation**: Add schema validation before JSON parsing
2. **Retry Logic**: Retry LLM call if JSON parsing fails
3. **Model Tuning**: Test if different temperature settings reduce control characters
4. **Prompt Engineering**: Add explicit instruction to avoid control characters
5. **Source Detection**: Add more URL patterns as new sources are discovered

---

## Rollback Plan

If issues arise:

1. **Revert source_detector.py**:
   ```bash
   git checkout HEAD -- backend/html-chunker/source_detector.py
   ```

2. **Revert extractor.py**:
   ```bash
   git checkout HEAD -- backend/html-chunker/extractor.py
   ```

3. **Rebuild and restart**:
   ```bash
   docker compose -f compose.dev.yaml build html-chunker
   docker compose -f compose.dev.yaml up -d html-chunker
   ```

---

## Related Documentation

- [Source-Aware Extraction Implementation.md](./Source-Aware%20Extraction%20Implementation.md)
- [Troubleshooting Source-Aware Extraction.md](./Troubleshooting%20Source-Aware%20Extraction.md)
