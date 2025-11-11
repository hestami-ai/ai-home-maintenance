# Bug Fix: Merge Consolidation Issues

## Issues Fixed

### 1. **Duplicate Reviews**
**Problem:** Reviews were being duplicated multiple times in merged data
```json
// Same review appeared 6 times
"individual_reviews": [
  {"reviewer": "Hampton Barclay", "date": "2023-10-15", ...},
  {"reviewer": "Hampton Barclay", "date": "2023-10-15", ...},  // duplicate
  {"reviewer": "Hampton Barclay", "date": "2023-10-15", ...},  // duplicate
  ...
]
```

**Fix:** Deduplicate by (reviewer, date, platform) signature
```python
existing_sigs = set()
for review in existing_individual:
    sig = (review.get('reviewer', ''), review.get('date', ''), review.get('platform', ''))
    existing_sigs.add(sig)

# Only add new unique reviews
for review in new_individual:
    sig = (review.get('reviewer', ''), review.get('date', ''), review.get('platform', ''))
    if sig not in existing_sigs:
        deduplicated_reviews.append(review)
```

### 2. **Lost Business Data**
**Problem:** Rich data from Thumbtack was being lost:
- ❌ `business_hours`: "9:00 am - 6:00 pm" → Empty
- ❌ `employees`: 15 → 0
- ❌ `license`: Full license info → Empty
- ❌ `payment_methods`: ["Cash", "Check", "Credit card"] → Empty

**Fix:** Comprehensive field-by-field merging with smart preferences:
- Business hours: Use source with more days filled
- Employees: Use higher number (more recent)
- License: Merge all fields, fill in missing data
- Payment methods: Union of all sources

### 3. **Schema Mismatch**
**Problem:** Old merge function looked for wrong keys:
```python
contact_info = merged.get('contact_info', {})  # ❌ Wrong
```

Actual schema:
```python
business_info.contact_information  # ✅ Correct
```

**Fix:** Updated to use correct schema structure throughout

### 4. **Incomplete Merging**
**Problem:** Old function only merged specific fields, ignored:
- Customer interaction (estimate_process, pricing_strategy, etc.)
- Media (photos, gallery links)
- Awards
- Service areas

**Fix:** Now merges ALL sections:
- ✅ Business info (all fields)
- ✅ Contact information
- ✅ Reviews (deduplicated)
- ✅ Services (offered, specialties, not_offered)
- ✅ Customer interaction
- ✅ Media
- ✅ License details
- ✅ Business hours
- ✅ Payment methods
- ✅ Social media

## Expected Merge Result

### Input: Google + Thumbtack

**Google provides:**
- Phone: (703) 581-2761
- Address: 40413 Stonebrook Hamlet Pl, Waterford, VA 20197
- Website: milcondesignandbuild.com
- Reviews: 135 total, 3 individual reviews
- Name: "Milcon Roofing, Design & Build"

**Thumbtack provides:**
- Business hours: Mon-Sat 9am-6pm
- Employees: 15
- License: CIC – Contractor – Commercial Improvement, Matthew Kavanah, VA
- Description: (long, detailed)
- Reviews: 155 total, 4 individual reviews
- Payment methods: Cash, Check, Credit card
- Name: "Milcon Design & Build"

### Output: Merged Entity

```json
{
  "business_info": {
    "name": "Milcon Roofing, Design & Build",  // Longer name preferred
    "description": "Having been in the remodeling Industry...",  // Thumbtack's longer description
    "years_in_business": 20,  // From Thumbtack
    "employees": 15,  // From Thumbtack
    "business_hours": {  // From Thumbtack (more complete)
      "Monday": "9:00 am - 6:00 pm",
      "Tuesday": "9:00 am - 6:00 pm",
      ...
    },
    "payment_methods": ["Cash", "Check", "Credit card"],  // From Thumbtack
    "background_check": true,  // From Thumbtack
    "license": {  // From Thumbtack
      "type": "CIC – Contractor – Commercial Improvement",
      "holder": "Matthew Kavanah",
      "number": "VA",
      "valid_until": "2025-06-01"
    },
    "contact_information": {  // Merged from both
      "phone": "(703) 581-2761",  // From Google
      "address": "40413 Stonebrook Hamlet Pl, Waterford, VA 20197",  // From Google
      "website": "milcondesignandbuild.com",  // From Google
      "plus_code": "59XW+F5 Waterford, Virginia"  // From Google
    }
  },
  "reviews": {
    "total_reviews": 155,  // Thumbtack has more
    "overall_rating": 5.0,
    "individual_reviews": [
      // 3 from Google + 4 from Thumbtack = 7 unique reviews (no duplicates)
    ]
  },
  "services": {
    "offered": [
      "roof", "windows", "doors", "siding",  // From Google
      "Full roof replacement", "Roof installation - new construction"  // From Thumbtack
    ]
  },
  "customer_interaction": {  // From Thumbtack
    "estimate_process": "We start by messaging/phone call...",
    "pricing_strategy": "We are highly competitive...",
    ...
  },
  "media": {
    "total_photos": 166  // Max of 9 (Google) and 166 (Thumbtack)
  }
}
```

## Testing

### Test Case 1: Milcon Example
Re-process the Google and Thumbtack scrapes for Milcon to verify:
- ✅ No duplicate reviews
- ✅ Business hours preserved
- ✅ License info preserved
- ✅ All contact info merged

### Test Case 2: Underdogs HVAC
Re-process to verify the raw_content fix works with proper merging.

## Files Modified

- `services/workflows/enrichment_utils.py` - Completely rewrote `merge_scraped_data()` function (lines 116-333)

## Next Steps

1. **Add Scrape Groups** - Implement the scrape grouping feature to link related scrapes
2. **Improve Matching** - Fix identity resolution to handle name variations ("Milcon Roofing, Design & Build" vs "Milcon Design & Build")
3. **Test Thoroughly** - Verify merge logic with real data
