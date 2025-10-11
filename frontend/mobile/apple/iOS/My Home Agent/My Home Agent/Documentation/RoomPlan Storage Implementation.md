# RoomPlan Storage Implementation

## Overview
This document describes the implementation of persistent storage for RoomPlan scans in the My Home Agent iOS app.

## Architecture

### Storage Strategy: Hybrid Local + Backend

The implementation uses a hybrid approach combining local storage for offline access with backend synchronization for cloud backup and cross-device access.

#### Local Storage
- **Location**: App's Documents directory (`~/Documents/RoomScans/`)
- **File Format**: USDZ (Universal Scene Description) files
- **Metadata**: JSON file (`room_scans_metadata.json`)
- **Benefits**:
  - Offline access to scans
  - Fast retrieval
  - No network dependency for viewing
  - No CoreData complexity

#### Backend Storage
- **Endpoint**: `/api/properties/{id}/media/upload/`
- **Media Type**: `FLOORPLAN` (3D model subtype)
- **Benefits**:
  - Cloud backup
  - Cross-device synchronization
  - Property association
  - Integration with existing media management

## Components

### 1. Models

#### `RoomScan.swift`
```swift
struct RoomScan: Identifiable, Codable {
    let id: String
    let name: String
    let propertyId: String?
    let createdAt: Date
    let fileURL: URL
    let thumbnailURL: URL?
    let uploadStatus: UploadStatus
    let backendMediaId: String?
}
```

**Upload Status States**:
- `notUploaded`: Scan exists only locally
- `uploading`: Upload in progress
- `uploaded`: Successfully synced to backend
- `failed`: Upload failed, can retry

### 2. Services

#### `RoomScanStorageService.swift`
Manages local file operations and metadata.

**Key Methods**:
- `saveRoomScan(capturedRoom:name:propertyId:)` - Save scan to local storage
- `getAllScans()` - Retrieve all saved scans
- `getScan(byId:)` - Get specific scan
- `getScans(forPropertyId:)` - Get scans for a property
- `updateScan(_:)` - Update scan metadata
- `deleteScan(id:)` - Delete scan and files
- `getStorageSize()` - Calculate total storage used

**File Structure**:
```
Documents/
├── room_scans_metadata.json
└── RoomScans/
    ├── {scan-id}.usdz
    ├── {scan-id}_thumbnail.png
    └── ...
```

#### `RoomScanUploadService.swift`
Handles backend synchronization via Media API.

**Key Methods**:
- `uploadRoomScan(scan:propertyId:title:description:)` - Upload to backend
- `uploadAllUnuploadedScans(propertyId:)` - Batch upload

**Upload Process**:
1. Update scan status to `uploading`
2. Create multipart form data with USDZ file
3. POST to `/api/properties/{id}/media/upload/`
4. Update scan with backend media ID
5. Set status to `uploaded` or `failed`

### 3. Views

#### `RoomPlanView.swift` (Updated)
Main scanning interface with save/upload functionality.

**New Features**:
- Save scan dialog after capture
- Upload to cloud option
- View saved scans button (toolbar)
- New scan button to reset

**Initialization**:
```swift
RoomPlanView(propertyId: "optional-property-id")
```

#### `SaveScanDialog.swift`
Modal dialog for saving scans.

**Features**:
- Name input with auto-generated default
- Property selection (optional)
- Loads properties from backend

#### `UploadScanDialog.swift`
Modal dialog for uploading scans to backend.

**Features**:
- Property selection (required)
- Pre-selects associated property if available
- Validates property selection

#### `SavedRoomScansView.swift`
List view for managing saved scans.

**Features**:
- Display all saved scans
- Upload status badges (Local, Uploading, Cloud, Failed)
- View scan in QuickLook
- Upload to cloud
- Delete scan
- Storage size indicator

## User Flow

### Scanning and Saving
1. User navigates to Room Scan
2. Taps "Start Scanning"
3. Performs room scan with device
4. Taps "Stop Scanning"
5. Scan completes, shows "Save Scan" button
6. User taps "Save Scan"
7. Enters name and optionally selects property
8. Scan saved locally

### Uploading to Cloud
1. After saving, "Upload to Cloud" button appears
2. User taps "Upload to Cloud"
3. Selects property (required for backend)
4. Upload begins, status updates to "Uploading"
5. On success, status updates to "Cloud"
6. Scan now backed up and accessible across devices

### Viewing Saved Scans
1. User taps folder icon in toolbar
2. `SavedRoomScansView` opens
3. Shows list of all saved scans
4. User can:
   - View scan in 3D (QuickLook)
   - Upload unsynced scans
   - Delete scans
   - See storage usage

## Backend Integration

### Media Upload API

**Endpoint**: `POST /api/properties/{property_id}/media/upload/`

**Request**:
```
Content-Type: multipart/form-data

Fields:
- file: USDZ file
- title: Scan name
- description: Auto-generated description
- media_sub_type: "FLOORPLAN"
- location_type: "INTERIOR"
```

**Response**:
```json
{
  "id": "media-uuid",
  "property_ref": "property-uuid",
  "file_url": "https://...",
  "media_type": "FILE",
  "media_sub_type": "FLOORPLAN",
  "upload_date": "2025-10-09T12:00:00Z",
  ...
}
```

### Authentication
Uses existing session cookie authentication via `NetworkManager`.

## Storage Management

### Local Storage
- Files stored in app's Documents directory
- Persists across app launches
- Backed up to iCloud (if enabled by user)
- Can be cleared by deleting app

### Storage Limits
- No hard limit enforced
- Storage size displayed in UI
- User responsible for managing storage
- USDZ files typically 1-5 MB per scan

### Cleanup
- Manual deletion via UI
- Files deleted when scan deleted
- Metadata updated atomically

## Error Handling

### Save Errors
- File system errors (permissions, space)
- Display alert with error message
- Haptic feedback for errors

### Upload Errors
- Network errors
- Authentication errors
- Backend validation errors
- Status set to `failed`, can retry
- Error displayed to user

## Future Enhancements

### Potential Improvements
1. **Automatic Upload**: Auto-upload when on WiFi
2. **Compression**: Compress USDZ files to save space
3. **Thumbnails**: Generate 3D preview thumbnails
4. **Sharing**: Share scans via AirDrop/Messages
5. **Annotations**: Add notes/measurements to scans
6. **Room Detection**: Auto-detect room type
7. **Batch Operations**: Select multiple scans for bulk actions
8. **Search/Filter**: Search scans by name/property/date
9. **Export Options**: Export to different formats (OBJ, FBX)
10. **AR Preview**: Preview scan in AR before saving

## Testing Checklist

- [ ] Save scan without property association
- [ ] Save scan with property association
- [ ] Upload scan to backend
- [ ] View scan in QuickLook
- [ ] Delete scan
- [ ] Handle save errors gracefully
- [ ] Handle upload errors gracefully
- [ ] Verify storage size calculation
- [ ] Test with multiple scans
- [ ] Test offline functionality
- [ ] Verify metadata persistence
- [ ] Test upload retry after failure
- [ ] Verify backend media creation

## Dependencies

### iOS Frameworks
- `RoomPlan` - 3D room scanning
- `QuickLook` - USDZ file preview
- `Foundation` - File management
- `SwiftUI` - UI components

### App Services
- `NetworkManager` - HTTP requests
- `HapticManager` - Haptic feedback
- `PropertiesViewModel` - Property data

## Notes

- USDZ format is Apple's standard for 3D content
- QuickLook provides native 3D viewing
- No third-party dependencies required
- Follows app's existing architecture patterns
- Maintains consistency with media management
