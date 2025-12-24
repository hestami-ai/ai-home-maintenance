# RoomPlan Storage - Quick Start Guide

## For Developers

### Files Created

```
Models/
└── RoomScan.swift                    # Data model for room scans

Services/
├── RoomScanStorageService.swift      # Local file storage
└── RoomScanUploadService.swift       # Backend upload

Views/
├── SaveScanDialog.swift              # Save scan modal
├── UploadScanDialog.swift            # Upload scan modal
└── SavedRoomScansView.swift          # Scan list view

RoomPlanView.swift (updated)          # Main scanning view

Documentation/
├── RoomPlan Storage Implementation.md
└── RoomPlan Quick Start Guide.md
```

### Integration Points

#### 1. Using RoomPlanView

**Basic Usage** (no property association):
```swift
NavigationLink("Scan Room") {
    RoomPlanView()
}
```

**With Property Association**:
```swift
NavigationLink("Scan Room") {
    RoomPlanView(propertyId: property.id)
}
```

#### 2. Accessing Saved Scans

**Get All Scans**:
```swift
let scans = RoomScanStorageService.shared.getAllScans()
```

**Get Scans for Property**:
```swift
let scans = RoomScanStorageService.shared.getScans(forPropertyId: propertyId)
```

**Get Single Scan**:
```swift
if let scan = RoomScanStorageService.shared.getScan(byId: scanId) {
    // Use scan
}
```

#### 3. Upload Scans

**Upload Single Scan**:
```swift
Task {
    do {
        let media = try await RoomScanUploadService.shared.uploadRoomScan(
            scan: scan,
            propertyId: propertyId
        )
        print("Uploaded as media: \(media.id)")
    } catch {
        print("Upload failed: \(error)")
    }
}
```

**Batch Upload**:
```swift
Task {
    do {
        let uploadedMedia = try await RoomScanUploadService.shared
            .uploadAllUnuploadedScans(propertyId: propertyId)
        print("Uploaded \(uploadedMedia.count) scans")
    } catch {
        print("Batch upload failed: \(error)")
    }
}
```

### Key APIs

#### RoomScanStorageService

```swift
// Save a new scan
let scan = try await RoomScanStorageService.shared.saveRoomScan(
    capturedRoom: capturedRoom,
    name: "Living Room",
    propertyId: "property-id"  // optional
)

// Update scan metadata
var updatedScan = scan
updatedScan.uploadStatus = .uploaded
try RoomScanStorageService.shared.updateScan(updatedScan)

// Delete scan
try RoomScanStorageService.shared.deleteScan(id: scan.id)

// Get storage info
let size = RoomScanStorageService.shared.getStorageSizeFormatted()
print("Storage used: \(size)")
```

#### RoomScanUploadService

```swift
// Upload with custom metadata
let media = try await RoomScanUploadService.shared.uploadRoomScan(
    scan: scan,
    propertyId: propertyId,
    title: "Custom Title",
    description: "Custom description"
)
```

## For Users

### How to Scan a Room

1. **Start Scanning**
   - Open the app
   - Navigate to "Room Scan"
   - Tap "Start Scanning"
   - Grant camera permission if prompted

2. **Perform the Scan**
   - Move your device slowly around the room
   - Point camera at walls, furniture, and features
   - Follow on-screen guidance
   - Ensure good lighting

3. **Complete the Scan**
   - Tap "Stop Scanning" when done
   - Wait for processing to complete
   - Review the captured room

4. **Save the Scan**
   - Tap "Save Scan"
   - Enter a descriptive name
   - Optionally select a property
   - Tap "Save"

5. **Upload to Cloud** (Optional)
   - After saving, tap "Upload to Cloud"
   - Select the property to associate with
   - Tap "Upload"
   - Wait for upload to complete

### Managing Saved Scans

1. **View Saved Scans**
   - In Room Scan view, tap folder icon (top right)
   - See list of all saved scans
   - Check upload status badges

2. **View a Scan**
   - Tap "View" on any scan
   - Scan opens in 3D viewer
   - Pinch to zoom, drag to rotate
   - Tap done when finished

3. **Upload a Scan**
   - Tap "Upload" on any local scan
   - Select property
   - Tap "Upload"
   - Status changes to "Cloud" when complete

4. **Delete a Scan**
   - Tap trash icon on any scan
   - Confirm deletion
   - Scan removed from device

### Tips for Best Results

**Scanning Tips**:
- Use in well-lit rooms
- Move slowly and steadily
- Capture all walls and corners
- Include furniture and fixtures
- Avoid reflective surfaces
- Keep device steady

**Storage Tips**:
- Upload scans to free local storage
- Delete old/duplicate scans
- Check storage usage in saved scans view
- Each scan is typically 1-5 MB

**Upload Tips**:
- Upload on WiFi for faster speeds
- Ensure stable internet connection
- Associate with correct property
- Retry failed uploads

### Troubleshooting

**Scan Won't Save**:
- Check available storage space
- Ensure app has file access permissions
- Try shorter scan name
- Restart app if needed

**Upload Fails**:
- Check internet connection
- Verify you're logged in
- Ensure property exists
- Try again later
- Check upload status in saved scans

**Can't View Scan**:
- Ensure scan file exists
- Try deleting and rescanning
- Update iOS if needed
- Contact support if persists

**Camera Permission Denied**:
- Open Settings app
- Go to My Home Agent
- Enable Camera access
- Restart app

## Advanced Usage

### Custom Integration

If you want to integrate RoomPlan storage into other parts of the app:

```swift
import RoomPlan

// In your view
@State private var showRoomPlanView = false

// Button to trigger scanning
Button("Scan Room") {
    showRoomPlanView = true
}
.sheet(isPresented: $showRoomPlanView) {
    NavigationView {
        RoomPlanView(propertyId: currentPropertyId)
    }
}

// Access scans later
let propertyScans = RoomScanStorageService.shared
    .getScans(forPropertyId: currentPropertyId)

// Display scan count
Text("\(propertyScans.count) scans available")
```

### Property Detail Integration

Add a room scans section to property detail views:

```swift
Section("Room Scans") {
    let scans = RoomScanStorageService.shared
        .getScans(forPropertyId: property.id)
    
    if scans.isEmpty {
        Text("No scans yet")
            .foregroundColor(.secondary)
    } else {
        ForEach(scans) { scan in
            HStack {
                Text(scan.name)
                Spacer()
                if scan.uploadStatus == .uploaded {
                    Image(systemName: "checkmark.icloud")
                        .foregroundColor(.green)
                }
            }
        }
    }
    
    NavigationLink("New Scan") {
        RoomPlanView(propertyId: property.id)
    }
}
```

## API Reference

### RoomScan Model

```swift
struct RoomScan {
    let id: String                    // Unique identifier
    let name: String                  // User-provided name
    let propertyId: String?           // Associated property
    let createdAt: Date              // Creation timestamp
    let fileURL: URL                 // Local USDZ file path
    let thumbnailURL: URL?           // Thumbnail image path
    let uploadStatus: UploadStatus   // Sync status
    let backendMediaId: String?      // Backend media ID
}

enum UploadStatus {
    case notUploaded  // Local only
    case uploading    // In progress
    case uploaded     // Synced
    case failed       // Upload error
}
```

### Storage Service Methods

```swift
// Save
func saveRoomScan(
    capturedRoom: CapturedRoom,
    name: String,
    propertyId: String?
) async throws -> RoomScan

// Retrieve
func getAllScans() -> [RoomScan]
func getScan(byId id: String) -> RoomScan?
func getScans(forPropertyId propertyId: String) -> [RoomScan]

// Update
func updateScan(_ updatedScan: RoomScan) throws

// Delete
func deleteScan(id: String) throws

// Info
func getStorageSize() -> Int64
func getStorageSizeFormatted() -> String
```

### Upload Service Methods

```swift
// Upload
func uploadRoomScan(
    scan: RoomScan,
    propertyId: String,
    title: String?,
    description: String?
) async throws -> Media

// Batch
func uploadAllUnuploadedScans(
    propertyId: String
) async throws -> [Media]
```

## Support

For issues or questions:
1. Check this documentation
2. Review implementation documentation
3. Check app logs for errors
4. Contact development team
