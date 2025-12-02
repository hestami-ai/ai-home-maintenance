import Foundation
import UIKit

// MARK: - File Upload Models

/// Represents an uploaded file ready to be attached to a message
struct UploadedFile: Codable, Identifiable {
    let file_id: String
    let _id: String?
    let filename: String
    let filepath: String?
    let type: String
    let size: Int
    let width: Int?
    let height: Int?
    let text: String?        // Extracted text content (for PDFs, docs)
    let source: String?      // "text" if extracted, "local" if not
    let embedded: Bool?
    
    var id: String { file_id }
    
    /// Returns the proxied URL for displaying this file
    func displayURL(baseURL: String) -> URL? {
        guard let filepath = filepath else { return nil }
        // Transform LibreChat path to proxied path
        let proxiedPath = "/api/chat/files/serve\(filepath)"
        return URL(string: "\(baseURL)\(proxiedPath)")
    }
    
    /// Whether this file is an image
    var isImage: Bool {
        type.hasPrefix("image/")
    }
    
    /// Whether this file has extracted text content
    var hasExtractedText: Bool {
        guard let text = text, !text.isEmpty else { return false }
        return source == "text"
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
    let text: String?
    let source: String?
    let embedded: Bool?
    
    /// Whether this file is an image
    var isImage: Bool {
        type.hasPrefix("image/")
    }
    
    /// Returns the proxied URL for displaying this file
    func displayURL(baseURL: String) -> URL? {
        guard let filepath = filepath else { return nil }
        let proxiedPath = "/api/chat/files/serve\(filepath)"
        return URL(string: "\(baseURL)\(proxiedPath)")
    }
}

// MARK: - File Upload Error

enum FileUploadError: Error, LocalizedError {
    case invalidResponse
    case serverError(statusCode: Int, message: String)
    case fileTooLarge
    case unsupportedFileType
    case noSessionCookie
    case imageProcessingFailed
    case fileAccessDenied
    
    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid response from server"
        case .serverError(let statusCode, let message):
            return "Upload failed (\(statusCode)): \(message)"
        case .fileTooLarge:
            return "File is too large. Maximum size is 100MB"
        case .unsupportedFileType:
            return "This file type is not supported"
        case .noSessionCookie:
            return "Authentication required. Please log in again"
        case .imageProcessingFailed:
            return "Failed to process image"
        case .fileAccessDenied:
            return "Cannot access file. Please try again"
        }
    }
}

// MARK: - File Constants

struct FileUploadConstants {
    static let allowedExtensions = ["jpg", "jpeg", "png", "gif", "mp4", "mov", "md", "pdf", "docx", "txt", "doc", "usdz"]
    static let imageExtensions = ["jpg", "jpeg", "png", "gif"]
    static let maxFileSize = 100 * 1024 * 1024  // 100MB
    
    static func isAllowedExtension(_ ext: String) -> Bool {
        allowedExtensions.contains(ext.lowercased())
    }
    
    static func isImageExtension(_ ext: String) -> Bool {
        imageExtensions.contains(ext.lowercased())
    }
}

// MARK: - Pending File Upload

/// Represents a file that is pending upload or has been uploaded
struct PendingFileUpload: Identifiable {
    let id = UUID()
    let filename: String
    let fileData: Data
    let mimeType: String
    let fileExtension: String
    var thumbnail: UIImage?
    var uploadedFile: UploadedFile?
    var isUploading: Bool = false
    var uploadProgress: Double = 0.0
    var error: String?
    
    var isImage: Bool {
        FileUploadConstants.isImageExtension(fileExtension)
    }
    
    var isUploaded: Bool {
        uploadedFile != nil
    }
}

// MARK: - Image Dimension Helpers

extension UIImage {
    /// Get the actual pixel dimensions of the image
    func getPixelDimensions() -> (width: Int, height: Int) {
        let scale = self.scale
        return (
            width: Int(self.size.width * scale),
            height: Int(self.size.height * scale)
        )
    }
}

extension Data {
    /// Extract dimensions from image Data using CGImageSource (efficient for large images)
    func getImageDimensions() -> (width: Int, height: Int)? {
        guard let source = CGImageSourceCreateWithData(self as CFData, nil),
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let width = properties[kCGImagePropertyPixelWidth] as? Int,
              let height = properties[kCGImagePropertyPixelHeight] as? Int else {
            return nil
        }
        return (width, height)
    }
}

// MARK: - OCR Field Builder

/// Builds the OCR field for chat messages from files with extracted text
/// - Parameter files: Array of uploaded files
/// - Returns: Formatted OCR string if any files have extracted text, nil otherwise
func buildOcrField(from files: [UploadedFile]) -> String? {
    let docsWithText = files.filter { $0.hasExtractedText }
    guard !docsWithText.isEmpty else { return nil }
    
    let parts = docsWithText.map { file in
        "# \"\(file.filename)\"\n\(file.text!)"
    }
    
    return "Attached document(s):\n```md\(parts.joined(separator: "\n\n"))\n```"
}
