# Media Upload Implementation

## Overview

Implemented a complete media upload system for property details with sequential uploads, progress tracking, and error handling.

## Components Created

### 1. **MediaUploadManager** (`Utils/MediaUploadManager.swift`)

Singleton manager handling all upload operations.

**Features:**
- ✅ Sequential upload strategy (MVP)
- ✅ File validation (type, size)
- ✅ Progress tracking per file and overall
- ✅ Retry failed uploads
- ✅ Cancel uploads
- ✅ Multipart form-data encoding
- ✅ Session cookie authentication

**Configuration:**
```swift
var config = MediaUploadManager.UploadConfig()
config.maxFileSize = 100 * 1024 * 1024 // 100MB (matches backend)
config.allowedImageTypes = ["image/jpeg", "image/png", "image/gif"]
config.allowedVideoTypes = ["video/mp4", "video/quicktime"]
config.uploadStrategy = .sequential
```

**Usage:**
```swift
MediaUploadManager.shared.uploadMedia(
    files: [URL],
    propertyId: String
) { result in
    // Handle completion
}
```

### 2. **MediaPickerView** (`Views/MediaPickerView.swift`)

SwiftUI wrapper for native iOS media pickers.

**Features:**
- ✅ PHPickerViewController for photo library (multi-select up to 10)
- ✅ UIImagePickerController for camera (single capture)
- ✅ Supports images and videos
- ✅ Automatic file type detection
- ✅ Copies files to temp directory for upload

**Supported Formats:**
- **Images:** JPEG, PNG, GIF
- **Videos:** MP4, QuickTime (MOV)

### 3. **MediaSelectionSheet** (`Views/MediaPickerView.swift`)

User-friendly selection interface.

**Options:**
- 📸 **Choose from Library** - Multi-select photos/videos
- 📷 **Take Photo or Video** - Capture with camera

### 4. **MediaUploadProgressView** (`Views/MediaUploadProgressView.swift`)

Bottom sheet showing detailed upload progress.

**Features:**
- ✅ Overall progress bar
- ✅ Per-file status (pending, uploading, completed, failed)
- ✅ File size display
- ✅ Upload percentage per file
- ✅ Error messages
- ✅ Retry failed uploads
- ✅ Cancel all uploads

**States:**
- **Pending** - Queued for upload
- **Uploading** - Currently uploading with progress
- **Completed** - Successfully uploaded
- **Failed** - Upload failed with error message
- **Cancelled** - User cancelled upload

### 5. **PropertyDetailView Integration** (`PropertiesView.swift`)

Added "Upload Media" button below "Edit Property" button.

**Features:**
- ✅ Shows current media count badge
- ✅ Opens media selection sheet
- ✅ Automatically starts upload on selection
- ✅ Shows progress sheet during upload
- ✅ Refreshes property data on completion

## Upload Flow

```
1. User taps "Upload Media" button
   ↓
2. MediaSelectionSheet appears
   ├─ Choose from Library (PHPicker)
   └─ Take Photo/Video (Camera)
   ↓
3. User selects files (up to 10)
   ↓
4. Files copied to temp directory
   ↓
5. MediaUploadManager validates files
   ├─ Check file size (max 100MB)
   ├─ Check file type (JPEG, PNG, GIF, MP4, MOV)
   └─ Reject invalid files
   ↓
6. Sequential upload begins
   ├─ Create multipart form-data
   ├─ Add session cookie for auth
   ├─ POST to /api/properties/{id}/media/upload/
   └─ Track progress via URLSessionTaskDelegate
   ↓
7. MediaUploadProgressView shows status
   ├─ Overall progress bar
   ├─ Per-file status
   └─ Error handling
   ↓
8. On completion:
   ├─ Refresh property data
   ├─ Update media count
   └─ Show success/error summary
```

## Backend Integration

**Endpoint:** `POST /api/properties/{property_id}/media/upload/`

**Request Format:** Multipart form-data
```
Content-Type: multipart/form-data; boundary=Boundary-{UUID}

--Boundary-{UUID}
Content-Disposition: form-data; name="file"; filename="image.jpg"
Content-Type: image/jpeg

{binary data}
--Boundary-{UUID}
Content-Disposition: form-data; name="title"

image.jpg
--Boundary-{UUID}--
```

**Response:** Media object (JSON)
```json
{
  "id": "uuid",
  "file_url": "https://...",
  "title": "image.jpg",
  "file_size": 1234567,
  "mime_type": "image/jpeg",
  "processing_status": "queued"
}
```

**Backend Constraints:**
- Max file size: 100MB
- Allowed image types: JPEG, PNG, GIF
- Allowed video types: MP4, QuickTime
- Virus scanning enabled
- Async thumbnail generation

## Configuration

### Upload Limits
```swift
// In MediaUploadManager.UploadConfig
maxFileSize: 100MB (matches backend)
selectionLimit: 10 files per session
```

### Allowed File Types
```swift
// Images
"image/jpeg" (.jpg, .jpeg)
"image/png" (.png)
"image/gif" (.gif)

// Videos
"video/mp4" (.mp4)
"video/quicktime" (.mov)
```

### Upload Strategy
```swift
// Current: Sequential (MVP)
config.uploadStrategy = .sequential

// Future: Parallel (Phase 2)
config.uploadStrategy = .parallel(maxConcurrent: 3)
```

## Error Handling

**Client-Side Validation:**
- ❌ File too large (> 100MB)
- ❌ Unsupported file type
- ❌ No valid files selected

**Upload Errors:**
- ❌ Network failure (auto-retry available)
- ❌ Server error (show error message)
- ❌ Authentication error (session expired)
- ❌ Invalid response (decoding error)

**User Actions:**
- 🔄 Retry individual failed uploads
- 🔄 Retry all failed uploads
- ❌ Cancel all uploads
- ✅ Dismiss when complete

## Future Enhancements (Phase 2)

### Parallel Uploads
```swift
config.uploadStrategy = .parallel(maxConcurrent: 3)
```
Upload multiple files simultaneously for faster completion.

### Background Upload
```swift
let config = URLSessionConfiguration.background(
    withIdentifier: "com.hestami.media-upload"
)
```
Continue uploads when app is backgrounded or terminated.

### Image Compression
```swift
if image.size.width > 2048 {
    image = image.resized(to: CGSize(width: 2048, height: ...))
}
let data = image.jpegData(compressionQuality: 0.8)
```
Reduce file size before upload to save bandwidth.

### Processing Status Polling
Poll `/api/media/{id}/processing-status/` to show thumbnail generation progress.

### Chunked Upload
For very large files, split into chunks and upload separately for resumability.

## Testing Checklist

- [ ] Upload single image from library
- [ ] Upload multiple images (up to 10)
- [ ] Upload video from library
- [ ] Take photo with camera and upload
- [ ] Take video with camera and upload
- [ ] Test file size validation (> 100MB)
- [ ] Test unsupported file type rejection
- [ ] Test network error handling
- [ ] Test retry failed upload
- [ ] Test cancel upload
- [ ] Verify progress tracking accuracy
- [ ] Verify media count updates after upload
- [ ] Test session authentication
- [ ] Test upload while app is backgrounded

## Known Limitations

1. **No background upload** - Uploads pause when app is backgrounded (Phase 2)
2. **No image compression** - Large images uploaded as-is (Phase 2)
3. **Sequential only** - One file at a time (Phase 2: parallel)
4. **No processing status** - Can't track thumbnail generation (backend limitation)
5. **No chunked upload** - Large files can't be resumed if interrupted (Phase 2)

## Performance Considerations

- **File validation** - Happens before upload to fail fast
- **Temp file cleanup** - Automatically removed after upload
- **Memory usage** - Files read from disk, not loaded into memory
- **Progress updates** - Throttled to avoid UI lag
- **Network efficiency** - Multipart form-data is standard and efficient

## Security

- ✅ Session cookie authentication
- ✅ Server-side virus scanning
- ✅ File type validation (client and server)
- ✅ File size limits enforced
- ✅ Property ownership verification (backend)
- ✅ Temp files cleaned up after upload
