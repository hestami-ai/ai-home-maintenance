# Bug Fix: Duplicate Service Providers Due to raw_content Fallback

## Issue Summary
The DBOS merge entity step was failing to correctly identify existing businesses, causing duplicate service provider entries in the database. Specifically, "Underdogs HVAC, llc." was being added multiple times instead of being merged with existing records.

## Root Cause
The html-chunker service has a fallback mechanism that returns `{"raw_content": "<json_string>"}` when it fails to parse the LLM response as valid JSON. The workflow's `extract_html` step was not handling this fallback case, resulting in:

1. **Malformed processed_data**: Instead of receiving parsed business data, the workflow received:
   ```json
   {
     "raw_content": "{\"business_info\": {...}}"
   }
   ```

2. **Identity resolution failure**: The identity resolution logic couldn't extract the company name from `business_info` because it was nested inside a JSON string.

3. **Field consolidation failure**: The consolidate_fields step couldn't extract any business data for the same reason.

4. **Duplicate creation**: Since matching failed (no company name to match), the workflow defaulted to creating a new provider each time.

## Files Modified

### 1. `services/workflows/provider_ingestion.py`
- **Line 187-201**: Added JSON parsing logic in `extract_html` step to detect and parse `raw_content` fallback
- **Line 319-327**: Added defensive checks in `consolidate_fields` to handle edge cases with `business_info` structure

### 2. `services/workflows/identity_resolution.py`
- **Line 184-191**: Enhanced defensive checks in `find_matching_providers` to handle malformed `business_info`

## Changes Made

### Extract HTML Step Enhancement
```python
# Handle raw_content fallback from html-chunker
if isinstance(processed_data, dict) and 'raw_content' in processed_data and 'business_info' not in processed_data:
    logger.warning(f"Detected raw_content fallback from html-chunker, attempting to parse JSON string")
    raw_content = processed_data.get('raw_content', '')
    
    if isinstance(raw_content, str):
        try:
            import json
            parsed_content = json.loads(raw_content)
            logger.info(f"Successfully parsed raw_content JSON string")
            processed_data = parsed_content
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse raw_content as JSON: {e}")
            raise Exception(f"HTML chunker returned unparseable raw_content: {e}")
```

### Defensive Checks in Consolidate Fields
```python
business_info = processed_data.get('business_info', {})

# Handle case where business_info might be a list (take first item)
if isinstance(business_info, list):
    logger.warning(f"business_info is a list, taking first item")
    business_info = business_info[0] if business_info else {}

# Ensure business_info is a dict
if not isinstance(business_info, dict):
    logger.error(f"business_info is not a dict: {type(business_info)}, using empty dict")
    business_info = {}
```

## Testing Recommendations

### 1. Test with Existing Underdogs HVAC Data
Re-process the existing scraped data for "Underdogs HVAC, llc." to verify:
- The workflow correctly parses the `raw_content` JSON string
- Identity resolution successfully extracts the company name
- The business is matched to existing provider (if one exists) or creates only one new entry

### 2. Clean Up Duplicate Providers
Query for duplicate "Underdogs HVAC" entries:
```python
from services.models import ServiceProvider
duplicates = ServiceProvider.objects.filter(business_name__icontains='Underdogs HVAC')
print(f"Found {duplicates.count()} Underdogs HVAC providers")
for provider in duplicates:
    print(f"ID: {provider.id}, Name: {provider.business_name}, Created: {provider.created_at}")
```

Merge or delete duplicates as appropriate, keeping the most complete record.

### 3. Monitor Logs
Watch for these log messages during workflow execution:
- `"Detected raw_content fallback from html-chunker"` - Indicates the fix is being applied
- `"Successfully parsed raw_content JSON string"` - Confirms successful parsing
- `"business_info is not a dict"` - Indicates data structure issues that need investigation

### 4. Verify Identity Resolution
Check that identity resolution is working correctly:
```python
from services.workflows.identity_resolution import find_matching_providers

# Test with the Underdogs HVAC data
test_data = {
    "business_info": {
        "name": "Underdogs HVAC, llc.",
        "contact_information": {
            "phone": None,
            "website": None
        }
    }
}

matches = find_matching_providers(test_data)
print(f"Found {len(matches)} potential matches")
for provider, score, components in matches:
    print(f"Provider: {provider.business_name}, Score: {score:.2f}%, Components: {components}")
```

## Prevention

### Short-term
- Monitor html-chunker logs for JSON parsing failures
- Add alerts when `raw_content` fallback is used frequently

### Long-term
- Improve html-chunker's JSON parsing robustness
- Consider using a more lenient JSON parser (e.g., demjson3) as default
- Add validation schema for processed_data to catch malformed data early

## Related Issues
- html-chunker returning `raw_content` fallback (see `extractor.py` line 636)
- LLM occasionally returning malformed JSON responses
- Need for better error handling in extraction pipeline
