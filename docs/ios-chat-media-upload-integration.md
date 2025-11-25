# iOS Chat Media Upload Integration Guide

This document describes how to implement file/image upload capability for the chat feature in the iOS app, matching the web implementation.

## Overview

Files must be uploaded to the SvelteKit backend before sending a chat message. The backend handles:
1. Virus scanning via Django
2. Forwarding to LibreChat for storage
3. Returning file metadata for use in chat messages

Uploaded images are displayed inline in chat messages and can be viewed full-size.

---

## API Endpoints

### 1. File Upload Endpoint

**Endpoint:** `POST /api/chat/files/upload`

Uploads a file, scans for viruses, and stores in LibreChat.

#### Request Format

Send a `multipart/form-data` request:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | The file to upload |
| `endpoint` | String | No | AI endpoint (default: `"google"`) |
| `width` | String | **Yes for images** | Image width in pixels |
| `height` | String | **Yes for images** | Image height in pixels |
| `tool_resource` | String | No | Optional tool resource identifier |

> **CRITICAL:** For image files (jpg, jpeg, png, gif), you MUST extract and include `width` and `height` before uploading. The backend will reject image uploads without dimensions.

#### Response Format

```json
{
  "success": true,
  "file_id": "uuid-string",
  "_id": "mongodb-id",
  "filename": "original-filename.jpg",
  "filepath": "/images/user-id/processed-filename.jpg",
  "type": "image/jpeg",
  "size": 5471666,
  "width": 4032,
  "height": 3024
}
```

### 2. File Serving Endpoint

**Endpoint:** `GET /api/chat/files/serve/{path}`

Proxies file requests to LibreChat with authentication. Used to display uploaded images in chat.

#### Usage

When displaying images from chat messages, transform the `filepath` to use this endpoint:

```
Original:  /images/userId/filename.jpg
Proxied:   /api/chat/files/serve/images/userId/filename.jpg
```

---

## Allowed File Types

```swift
let ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "mp4", "mov", "md", "pdf", "docx", "txt", "doc", "usdz"]
let IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif"]
let MAX_FILE_SIZE = 100 * 1024 * 1024  // 100MB
```

---

## Implementation

### Data Models

```swift
/// Represents an uploaded file ready to be attached to a message
struct UploadedFile: Codable {
    let file_id: String
    let _id: String?
    let filename: String
    let filepath: String?
    let type: String
    let size: Int
    let width: Int?
    let height: Int?
    
    /// Returns the proxied URL for displaying this file
    var displayURL: URL? {
        guard let filepath = filepath else { return nil }
        // Transform LibreChat path to proxied path
        let proxiedPath = "/api/chat/files/serve\(filepath)"
        return URL(string: "\(baseURL)\(proxiedPath)")
    }
    
    /// Whether this file is an image
    var isImage: Bool {
        type.hasPrefix("image/")
    }
}

/// File attachment format for chat messages
struct FileAttachment: Codable {
    let file_id: String
    let filename: String
    let filepath: String?
    let type: String
    let size: Int
    let width: Int?
    let height: Int?
}

/// Chat message request body
struct ChatMessageRequest: Codable {
    let text: String
    let sender: String = "User"
    let clientTimestamp: String
    let isCreatedByUser: Bool = true
    let parentMessageId: String
    let messageId: String
    let error: Bool = false
    let endpoint: String = "google"
    let model: String = "gemini-2.5-flash-lite"
    let agent_id: String = "ephemeral"
    let conversationId: String?
    let thinking: Bool = false
    let files: [FileAttachment]?
    let imageUrls: [String]?  // Filepaths for image files
}
```

### Step 1: Extract Image Dimensions

Before uploading images, extract their dimensions:

```swift
import UIKit

/// Extract dimensions from a UIImage
func getImageDimensions(from image: UIImage) -> (width: Int, height: Int) {
    let scale = image.scale
    return (
        width: Int(image.size.width * scale),
        height: Int(image.size.height * scale)
    )
}

/// Extract dimensions from image Data
func getImageDimensions(from data: Data) -> (width: Int, height: Int)? {
    guard let image = UIImage(data: data) else { return nil }
    return getImageDimensions(from: image)
}

/// Extract dimensions using CGImageSource (more efficient for large images)
func getImageDimensionsEfficient(from data: Data) -> (width: Int, height: Int)? {
    guard let source = CGImageSourceCreateWithData(data as CFData, nil),
          let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
          let width = properties[kCGImagePropertyPixelWidth] as? Int,
          let height = properties[kCGImagePropertyPixelHeight] as? Int else {
        return nil
    }
    return (width: width, height: height)
}
```

### Step 2: Upload File

```swift
import Foundation

class ChatFileUploader {
    private let baseURL: String
    private let session: URLSession
    
    init(baseURL: String, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }
    
    /// Upload a file with optional image dimensions
    func uploadFile(
        fileData: Data,
        filename: String,
        mimeType: String,
        width: Int? = nil,
        height: Int? = nil,
        sessionCookie: String
    ) async throws -> UploadedFile {
        let url = URL(string: "\(baseURL)/api/chat/files/upload")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        
        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.setValue(sessionCookie, forHTTPHeaderField: "Cookie")
        
        var body = Data()
        
        // Add file
        body.appendMultipartField(
            name: "file",
            filename: filename,
            mimeType: mimeType,
            data: fileData,
            boundary: boundary
        )
        
        // Add endpoint
        body.appendMultipartField(name: "endpoint", value: "google", boundary: boundary)
        
        // Add dimensions for images (REQUIRED)
        if let width = width {
            body.appendMultipartField(name: "width", value: "\(width)", boundary: boundary)
        }
        if let height = height {
            body.appendMultipartField(name: "height", value: "\(height)", boundary: boundary)
        }
        
        // Close multipart
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        
        request.httpBody = body
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw UploadError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 else {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw UploadError.serverError(statusCode: httpResponse.statusCode, message: errorMessage)
        }
        
        return try JSONDecoder().decode(UploadedFile.self, from: data)
    }
}

// MARK: - Data Extension for Multipart

extension Data {
    mutating func appendMultipartField(name: String, value: String, boundary: String) {
        append("--\(boundary)\r\n".data(using: .utf8)!)
        append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".data(using: .utf8)!)
        append("\(value)\r\n".data(using: .utf8)!)
    }
    
    mutating func appendMultipartField(name: String, filename: String, mimeType: String, data: Data, boundary: String) {
        append("--\(boundary)\r\n".data(using: .utf8)!)
        append("Content-Disposition: form-data; name=\"\(name)\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        append(data)
        append("\r\n".data(using: .utf8)!)
    }
}

// MARK: - Errors

enum UploadError: Error {
    case invalidResponse
    case serverError(statusCode: Int, message: String)
    case fileTooLarge
    case unsupportedFileType
}
```

### Step 3: Send Chat Message with Files

```swift
class ChatService {
    private let baseURL: String
    private let session: URLSession
    
    func sendMessage(
        text: String,
        uploadedFiles: [UploadedFile],
        conversationId: String?,
        sessionCookie: String
    ) async throws -> ChatResponse {
        let url = URL(string: "\(baseURL)/api/chat/agents/chat/google")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(sessionCookie, forHTTPHeaderField: "Cookie")
        
        // Build file attachments
        let fileAttachments: [FileAttachment]? = uploadedFiles.isEmpty ? nil : uploadedFiles.map { file in
            FileAttachment(
                file_id: file.file_id,
                filename: file.filename,
                filepath: file.filepath,
                type: file.type,
                size: file.size,
                width: file.width,
                height: file.height
            )
        }
        
        // Extract image URLs for LibreChat format
        let imageUrls: [String]? = uploadedFiles
            .filter { $0.isImage }
            .compactMap { $0.filepath }
        
        let requestBody = ChatMessageRequest(
            text: text.isEmpty ? " " : text,  // LibreChat requires text
            clientTimestamp: ISO8601DateFormatter().string(from: Date()),
            parentMessageId: "00000000-0000-0000-0000-000000000000",
            messageId: UUID().uuidString,
            conversationId: conversationId,
            files: fileAttachments,
            imageUrls: imageUrls?.isEmpty == true ? nil : imageUrls
        )
        
        request.httpBody = try JSONEncoder().encode(requestBody)
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw ChatError.sendFailed
        }
        
        return try JSONDecoder().decode(ChatResponse.self, from: data)
    }
}
```

### Step 4: Display Images in Chat Messages

When rendering chat messages, transform file paths to use the proxy endpoint:

```swift
struct ChatMessageView: View {
    let message: ChatMessage
    let baseURL: String
    
    var body: some View {
        VStack(alignment: message.isCreatedByUser ? .trailing : .leading, spacing: 8) {
            // Display images for user messages (above text)
            if message.isCreatedByUser {
                fileAttachmentsView
            }
            
            // Message text
            Text(message.text)
                .padding()
                .background(message.isCreatedByUser ? Color.blue : Color.gray.opacity(0.2))
                .cornerRadius(12)
            
            // Display images for assistant messages (below text)
            if !message.isCreatedByUser {
                fileAttachmentsView
            }
        }
    }
    
    @ViewBuilder
    private var fileAttachmentsView: some View {
        if let files = message.files, !files.isEmpty {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150))], spacing: 8) {
                ForEach(files, id: \.file_id) { file in
                    if file.isImage, let url = getProxiedURL(for: file) {
                        AsyncImage(url: url) { image in
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(maxWidth: 200, maxHeight: 150)
                                .clipped()
                                .cornerRadius(8)
                        } placeholder: {
                            ProgressView()
                                .frame(width: 100, height: 100)
                        }
                        .onTapGesture {
                            // Open full-size image
                            openFullSizeImage(url: url)
                        }
                    } else {
                        // Non-image file attachment
                        HStack {
                            Image(systemName: "doc")
                            Text(file.filename)
                                .lineLimit(1)
                        }
                        .padding(8)
                        .background(Color.gray.opacity(0.1))
                        .cornerRadius(8)
                    }
                }
            }
        }
    }
    
    /// Transform LibreChat filepath to proxied URL
    private func getProxiedURL(for file: FileAttachment) -> URL? {
        guard let filepath = file.filepath else { return nil }
        // Transform: /images/userId/file.jpg -> /api/chat/files/serve/images/userId/file.jpg
        let proxiedPath = "/api/chat/files/serve\(filepath)"
        return URL(string: "\(baseURL)\(proxiedPath)")
    }
}
```

---

## Complete User Flow

1. **User selects file(s)** from photo library, camera, or files app

2. **For each file:**
   - Validate extension against `ALLOWED_EXTENSIONS`
   - Validate size against `MAX_FILE_SIZE` (100MB)
   - If image: extract `width` and `height`
   - Show upload progress indicator
   - Call `POST /api/chat/files/upload`
   - Store returned `UploadedFile` metadata

3. **Display pending files** as thumbnails/chips in the chat input area
   - Allow user to remove files before sending

4. **When user sends message:**
   - Include all `UploadedFile` data in the `files` array
   - For images, also populate `imageUrls` with filepaths
   - POST to `/api/chat/agents/chat/google`

5. **Display messages with attachments:**
   - Transform `filepath` to proxied URL via `/api/chat/files/serve/`
   - Show images inline with tap-to-enlarge
   - Show non-image files as download links

---

## Error Handling

| Status | Meaning | Action |
|--------|---------|--------|
| 400 | File type not allowed or virus detected | Show error, don't retry |
| 401 | Authentication required | Redirect to login |
| 413 | File too large | Show error with size limit |
| 500 | Server error | Show error, allow retry |

```swift
func handleUploadError(_ error: UploadError) {
    switch error {
    case .serverError(let statusCode, let message):
        switch statusCode {
        case 400:
            showAlert("Upload Failed", message: message)
        case 401:
            redirectToLogin()
        case 413:
            showAlert("File Too Large", message: "Maximum file size is 100MB")
        default:
            showAlert("Upload Failed", message: "Please try again")
        }
    case .fileTooLarge:
        showAlert("File Too Large", message: "Maximum file size is 100MB")
    case .unsupportedFileType:
        showAlert("Unsupported File", message: "This file type is not allowed")
    default:
        showAlert("Upload Failed", message: "Please try again")
    }
}
```

---

## Testing Checklist

- [ ] Upload single image with dimensions
- [ ] Upload multiple images
- [ ] Upload non-image file (PDF, etc.)
- [ ] Verify images display inline in sent messages
- [ ] Verify tap-to-enlarge works
- [ ] Verify file size validation (reject > 100MB)
- [ ] Verify file type validation
- [ ] Test upload cancellation
- [ ] Test network error handling
- [ ] Test authentication expiry during upload
