# Media Metadata Update API Documentation

## Overview
Added functionality to update media metadata for property media files. This allows users to edit titles, descriptions, media types, and location information for uploaded media without re-uploading files.

---

## Implementation Summary

### **Files Modified:**

1. **`media/urls.py`**
   - Added route: `path('<uuid:media_id>/update/', views.update_media_metadata)`

2. **`media/serializers.py`**
   - Added `MediaMetadataUpdateSerializer` class
   - Validates updatable fields only
   - Includes location type/subtype validation

3. **`media/views.py`**
   - Added `update_media_metadata()` view function
   - Implements permission checks
   - Supports partial updates (PATCH)

---

## API Endpoint

### **PATCH `/api/media/<media_id>/update/`**

**Purpose:** Update metadata for an existing media file

**Authentication:** Required (JWT)

**Permissions:**
- Property media: User must be property owner OR have `can_manage_media` permission
- Service request media: User must be requester OR uploader
- Service report media: User must be uploader
- Orphaned media: User must be uploader

**Request Body (all fields optional):**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "media_type": "IMAGE",
  "media_sub_type": "REGULAR",
  "location_type": "INTERIOR",
  "location_sub_type": "LIVING_ROOM"
}
```

**Updatable Fields:**
- `title` (string, max 255 chars)
- `description` (text)
- `media_type` (choice: IMAGE, VIDEO, FILE, OTHER)
- `media_sub_type` (choice: REGULAR, 360_DEGREE, FLOORPLAN, OTHER)
- `location_type` (choice: INTERIOR, EXTERIOR, etc.)
- `location_sub_type` (choice: depends on location_type)

**Non-Updatable Fields:**
- `file` - Cannot change the actual file
- `uploader` - Cannot change who uploaded it
- `property_ref` - Cannot move to different property
- `service_request` - Cannot change parent relationship
- `service_report` - Cannot change parent relationship
- `file_type`, `file_size`, `upload_date` - System managed

**Response (200 OK):**
```json
{
  "id": "uuid",
  "title": "Updated Title",
  "description": "Updated description",
  "media_type": "IMAGE",
  "media_sub_type": "REGULAR",
  "location_type": "INTERIOR",
  "location_sub_type": "LIVING_ROOM",
  "file_url": "https://...",
  "thumbnail_small_url": "https://...",
  "thumbnail_medium_url": "https://...",
  "thumbnail_large_url": "https://...",
  // ... all other media fields
}
```

**Error Responses:**

**403 Forbidden:**
```json
{
  "error": "You don't have permission to update this media"
}
```

**404 Not Found:**
```json
{
  "detail": "Not found."
}
```

**400 Bad Request:**
```json
{
  "location_sub_type": [
    "Invalid sub-type \"BEDROOM\" for location type \"EXTERIOR\""
  ]
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to update media metadata",
  "details": "Error message"
}
```

---

## Validation Rules

### **Location Type/Subtype Validation:**
The `location_sub_type` must be valid for the selected `location_type`:

**INTERIOR:**
- LIVING_ROOM, KITCHEN, BEDROOM, BATHROOM, DINING_ROOM, HALLWAY, CLOSET, LAUNDRY_ROOM, OFFICE, OTHER

**EXTERIOR:**
- FRONT_YARD, BACK_YARD, SIDE_YARD, DRIVEWAY, GARAGE, PATIO, DECK, ROOF, FOUNDATION, OTHER

**BASEMENT:**
- FINISHED, UNFINISHED, STORAGE, UTILITY, OTHER

**ATTIC:**
- FINISHED, UNFINISHED, STORAGE, OTHER

**GARAGE:**
- ATTACHED, DETACHED, CARPORT, OTHER

**UTILITY:**
- HVAC, ELECTRICAL_PANEL, WATER_HEATER, FURNACE, OTHER

**STRUCTURAL:**
- FOUNDATION, FRAMING, ROOF_STRUCTURE, WALLS, FLOORS, CEILINGS, OTHER

**SYSTEMS:**
- PLUMBING, ELECTRICAL, HVAC_SYSTEM, SECURITY, OTHER

---

## Permission Logic

### **Property Media:**
```python
# User can update if:
1. User is property owner, OR
2. User has PropertyAccess with can_manage_media=True, OR
3. User has 'properties.manage_property_media' permission
```

### **Service Request Media:**
```python
# User can update if:
1. User is the service requester, OR
2. User is the uploader
```

### **Service Report Media:**
```python
# User can update if:
1. User is the uploader (service provider)
```

---

## Usage Examples

### **Example 1: Update Title and Description**
```bash
curl -X PATCH https://api.example.com/api/media/{media_id}/update/ \
  -H "Authorization: Bearer {jwt_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Master Bedroom - North Wall",
    "description": "Shows water damage near ceiling"
  }'
```

### **Example 2: Update Location**
```bash
curl -X PATCH https://api.example.com/api/media/{media_id}/update/ \
  -H "Authorization: Bearer {jwt_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "location_type": "INTERIOR",
    "location_sub_type": "BEDROOM"
  }'
```

### **Example 3: Change Media Type**
```bash
curl -X PATCH https://api.example.com/api/media/{media_id}/update/ \
  -H "Authorization: Bearer {jwt_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "media_type": "IMAGE",
    "media_sub_type": "360_DEGREE"
  }'
```

### **Example 4: Partial Update (Only Title)**
```bash
curl -X PATCH https://api.example.com/api/media/{media_id}/update/ \
  -H "Authorization: Bearer {jwt_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title Only"
  }'
```

---

## Frontend Integration

### **SvelteKit Example:**

```typescript
// In your API utility file
export async function updateMediaMetadata(
  cookies: Cookies,
  mediaId: string,
  updates: {
    title?: string;
    description?: string;
    media_type?: string;
    media_sub_type?: string;
    location_type?: string;
    location_sub_type?: string;
  },
  returnUrl: string
): Promise<ApiResponse<Media>> {
  return apiPatch(
    cookies,
    `/api/media/${mediaId}/update/`,
    updates,
    {},
    returnUrl
  );
}

// In your component
async function handleUpdateMedia() {
  try {
    const response = await fetch(`/api/media/${mediaId}/update`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: newTitle,
        description: newDescription,
        location_type: selectedLocationType,
        location_sub_type: selectedLocationSubtype
      })
    });
    
    if (response.ok) {
      const updatedMedia = await response.json();
      // Update UI with new data
    }
  } catch (error) {
    console.error('Failed to update media:', error);
  }
}
```

---

## Security Considerations

1. **Authentication Required:** All requests must include valid JWT token
2. **Permission Checks:** Strict permission validation based on media parent type
3. **Soft Delete Check:** Cannot update deleted media
4. **Field Restrictions:** Cannot modify file, uploader, or parent relationships
5. **Validation:** All field values validated against allowed choices
6. **Logging:** All update attempts logged for audit trail

---

## Testing Checklist

- [ ] Update title for property media as owner
- [ ] Update description for property media with can_manage_media permission
- [ ] Update location type/subtype with valid combination
- [ ] Attempt invalid location_sub_type for location_type (should fail)
- [ ] Attempt to update as non-owner without permission (should fail 403)
- [ ] Attempt to update deleted media (should fail 404)
- [ ] Partial update with only one field
- [ ] Update all fields at once
- [ ] Verify updated media returned in response
- [ ] Check audit logs for update events

---

## Future Enhancements

1. **Bulk Update:** Add endpoint to update multiple media items at once
2. **History Tracking:** Track metadata change history
3. **Revert Changes:** Allow reverting to previous metadata versions
4. **Auto-tagging:** AI-powered automatic location/type detection
5. **Batch Operations:** Update metadata for all media in a location
6. **Metadata Templates:** Save and apply metadata templates

---

## Related Endpoints

- `POST /api/media/properties/{property_id}/upload/` - Upload new media
- `GET /api/media/properties/{property_id}/` - List property media
- `DELETE /api/media/{media_id}/` - Delete media
- `GET /api/media/{media_id}/status/` - Check processing status
- `GET /api/media/types/` - Get media type choices
- `GET /api/media/locations/` - Get location type choices

---

## Changelog

**v1.0 - Initial Implementation**
- Added PATCH endpoint for metadata updates
- Created MediaMetadataUpdateSerializer
- Implemented permission checks for all parent types
- Added validation for location type/subtype combinations
- Full audit logging
