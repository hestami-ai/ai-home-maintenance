import Foundation
import OSLog

class ChatFileUploader {
    static let shared = ChatFileUploader()
    
    private let networkManager = NetworkManager.shared
    private let session: URLSession
    
    private init() {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 60.0  // 60 seconds for file uploads
        configuration.timeoutIntervalForResource = 120.0  // 2 minutes for large files
        session = URLSession(configuration: configuration)
    }
    
    /// Upload a file with optional image dimensions
    func uploadFile(
        fileData: Data,
        filename: String,
        mimeType: String,
        width: Int? = nil,
        height: Int? = nil
    ) async throws -> UploadedFile {
        AppLogger.app.info("Uploading file: \(filename, privacy: .public), size: \(fileData.count, privacy: .public) bytes")
        
        // Validate file size
        guard fileData.count <= FileUploadConstants.maxFileSize else {
            throw FileUploadError.fileTooLarge
        }
        
        // Get session cookie
        guard let sessionCookie = networkManager.getSessionCookieHeader() else {
            AppLogger.app.error("No session cookie available for file upload")
            throw FileUploadError.noSessionCookie
        }
        
        // Construct URL
        let urlString = "\(networkManager.baseURL)/api/chat/files/upload"
        guard let url = URL(string: urlString) else {
            throw FileUploadError.invalidResponse
        }
        
        // Create request
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        
        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.setValue(sessionCookie, forHTTPHeaderField: "Cookie")
        
        // Build multipart body
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
        
        // Add dimensions for images (REQUIRED for image files)
        if let width = width {
            body.appendMultipartField(name: "width", value: "\(width)", boundary: boundary)
        }
        if let height = height {
            body.appendMultipartField(name: "height", value: "\(height)", boundary: boundary)
        }
        
        // Close multipart
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        
        request.httpBody = body
        
        AppLogger.app.debug("Sending upload request to \(urlString, privacy: .public)")
        
        // Make the request
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw FileUploadError.invalidResponse
        }
        
        AppLogger.app.debug("Upload response status: \(httpResponse.statusCode, privacy: .public)")
        
        // Handle response
        guard httpResponse.statusCode == 200 else {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            AppLogger.app.error("Upload failed: \(errorMessage, privacy: .public)")
            throw FileUploadError.serverError(statusCode: httpResponse.statusCode, message: errorMessage)
        }
        
        // Decode response
        do {
            let uploadedFile = try JSONDecoder().decode(UploadedFile.self, from: data)
            AppLogger.app.info("File uploaded successfully: \(uploadedFile.file_id, privacy: .public)")
            
            // Log text extraction status
            if uploadedFile.hasExtractedText {
                AppLogger.app.debug("Text extracted from document (source: \(uploadedFile.source ?? "unknown"))")
            }
            
            return uploadedFile
        } catch {
            AppLogger.app.error("Failed to decode upload response: \(error.localizedDescription, privacy: .public)")
            throw FileUploadError.invalidResponse
        }
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
