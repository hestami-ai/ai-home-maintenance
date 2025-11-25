import Foundation
import UIKit
import Combine
import OSLog

/// Manages media file uploads with progress tracking and error handling
class MediaUploadManager: NSObject, ObservableObject {
    static let shared = MediaUploadManager()
    
    // MARK: - Published Properties
    
    @Published var uploadQueue: [MediaUploadTask] = []
    @Published var isUploading: Bool = false
    @Published var currentUploadIndex: Int = 0
    @Published var overallProgress: Double = 0.0
    
    // MARK: - Configuration
    
    struct UploadConfig {
        var maxFileSize: Int64 = 100 * 1024 * 1024 // 100MB
        var allowedImageTypes: [String] = ["image/jpeg", "image/png", "image/gif"]
        var allowedVideoTypes: [String] = ["video/mp4", "video/quicktime"]
        var uploadStrategy: UploadStrategy = .sequential
    }
    
    enum UploadStrategy {
        case sequential
        case parallel(maxConcurrent: Int)
    }
    
    var config = UploadConfig()
    
    // MARK: - Private Properties
    
    private var session: URLSession!
    private var uploadTasks: [String: URLSessionUploadTask] = [:]
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Initialization
    
    private override init() {
        super.init()
        
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 300 // 5 minutes
        configuration.timeoutIntervalForResource = 600 // 10 minutes
        
        session = URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    }
    
    // MARK: - Public Methods
    
    /// Upload media files for a property with metadata
    func uploadMedia(tasks: [MediaUploadTask], completion: @escaping (Result<[Media], Error>) -> Void) {
        AppLogger.media.debug("uploadMedia called with \(tasks.count, privacy: .public) tasks")
        
        guard !tasks.isEmpty else {
            AppLogger.media.error("No tasks to upload")
            completion(.failure(MediaUploadError.noValidFiles))
            return
        }
        
        AppLogger.media.debug("Created \(tasks.count, privacy: .public) upload tasks")
        
        // Add to queue and start upload on main queue
        DispatchQueue.main.async {
            self.uploadQueue.append(contentsOf: tasks)
            AppLogger.media.debug("Queue now has \(self.uploadQueue.count, privacy: .public) tasks")
            
            // Start uploading based on strategy
            switch self.config.uploadStrategy {
            case .sequential:
                AppLogger.media.debug("Starting sequential upload")
                self.uploadSequentially(completion: completion)
            case .parallel(let maxConcurrent):
                self.uploadInParallel(maxConcurrent: maxConcurrent, completion: completion)
            }
        }
    }
    
    /// Cancel all uploads
    func cancelAllUploads() {
        uploadTasks.values.forEach { $0.cancel() }
        uploadTasks.removeAll()
        
        DispatchQueue.main.async {
            self.uploadQueue.removeAll()
            self.isUploading = false
            self.currentUploadIndex = 0
            self.overallProgress = 0.0
        }
    }
    
    /// Cancel specific upload
    func cancelUpload(taskId: String) {
        uploadTasks[taskId]?.cancel()
        uploadTasks.removeValue(forKey: taskId)
        
        DispatchQueue.main.async {
            if let index = self.uploadQueue.firstIndex(where: { $0.id == taskId }) {
                self.uploadQueue[index].status = .cancelled
            }
        }
    }
    
    /// Retry failed upload
    func retryUpload(taskId: String, completion: @escaping (Result<[Media], Error>) -> Void) {
        guard let index = uploadQueue.firstIndex(where: { $0.id == taskId }) else {
            AppLogger.media.warning("Task \(taskId, privacy: .public) not found in queue for retry")
            return
        }
        
        AppLogger.media.info("Retrying task: \(self.uploadQueue[index].fileName, privacy: .public)")
        
        DispatchQueue.main.async {
            self.uploadQueue[index].status = .pending
            self.uploadQueue[index].error = nil
            self.uploadQueue[index].progress = 0.0
            
            // Start upload after status update completes
            self.uploadSequentially(completion: completion)
        }
    }
    
    // MARK: - Private Methods
    
    private func uploadSequentially(completion: @escaping (Result<[Media], Error>) -> Void) {
        DispatchQueue.main.async {
            self.isUploading = true
        }
        
        uploadNextInQueue(completion: completion)
    }
    
    private func uploadNextInQueue(completion: @escaping (Result<[Media], Error>) -> Void) {
        AppLogger.media.debug("uploadNextInQueue called, queue has \(self.uploadQueue.count, privacy: .public) tasks")
        
        // Log status of all tasks
        #if DEBUG
        for (index, task) in self.uploadQueue.enumerated() {
            AppLogger.media.debug("  Task \(index, privacy: .public): \(task.fileName, privacy: .public) - status: \(String(describing: task.status), privacy: .public)")
        }
        #endif
        
        // Find next pending task
        guard let nextTask = uploadQueue.first(where: { $0.status == .pending }) else {
            // All done
            AppLogger.media.debug("No more pending tasks")
            let uploadedMedia = uploadQueue.compactMap { $0.uploadedMedia }
            let hasErrors = uploadQueue.contains { $0.status == .failed }
            
            AppLogger.media.info("Upload complete - \(uploadedMedia.count, privacy: .public) successful, hasErrors: \(hasErrors, privacy: .public)")
            
            DispatchQueue.main.async {
                self.isUploading = false
                self.currentUploadIndex = 0
                self.overallProgress = 1.0
            }
            
            if hasErrors {
                completion(.failure(MediaUploadError.someUploadsFailed))
            } else {
                completion(.success(uploadedMedia))
            }
            return
        }
        
        AppLogger.media.debug("Found pending task: \(nextTask.fileName, privacy: .public)")
        
        // Update current index
        if let index = uploadQueue.firstIndex(where: { $0.id == nextTask.id }) {
            DispatchQueue.main.async {
                self.currentUploadIndex = index
            }
        }
        
        // Upload the task
        uploadTask(nextTask) { [weak self] result in
            guard let self = self else { return }
            
            switch result {
            case .success(let media):
                DispatchQueue.main.async {
                    if let index = self.uploadQueue.firstIndex(where: { $0.id == nextTask.id }) {
                        self.uploadQueue[index].status = .completed
                        self.uploadQueue[index].uploadedMedia = media
                        self.uploadQueue[index].progress = 1.0
                    }
                    self.updateOverallProgress()
                }
                
            case .failure(let error):
                DispatchQueue.main.async {
                    if let index = self.uploadQueue.firstIndex(where: { $0.id == nextTask.id }) {
                        self.uploadQueue[index].status = .failed
                        self.uploadQueue[index].error = error.localizedDescription
                        self.uploadQueue[index].progress = 0.0
                    }
                }
            }
            
            // Upload next
            self.uploadNextInQueue(completion: completion)
        }
    }
    
    private func uploadInParallel(maxConcurrent: Int, completion: @escaping (Result<[Media], Error>) -> Void) {
        // TODO: Implement parallel upload strategy for Phase 2
        uploadSequentially(completion: completion)
    }
    
    private func uploadTask(_ task: MediaUploadTask, completion: @escaping (Result<Media, Error>) -> Void) {
        AppLogger.media.debug("uploadTask called for \(task.fileName, privacy: .public)")
        AppLogger.media.debug("File URL: \(task.fileURL.path, privacy: .public)")
        AppLogger.media.debug("Property ID: \(task.propertyId, privacy: .public)")
        
        DispatchQueue.main.async {
            if let index = self.uploadQueue.firstIndex(where: { $0.id == task.id }) {
                self.uploadQueue[index].status = .uploading
                AppLogger.media.debug("Task status set to uploading")
            }
        }
        
        // Create multipart form data
        AppLogger.media.debug("Creating multipart form data...")
        guard let boundary = createMultipartFormData(for: task) else {
            AppLogger.media.error("Failed to create multipart form data")
            completion(.failure(MediaUploadError.invalidFileData))
            return
        }
        AppLogger.media.debug("Multipart form data created successfully")
        
        // Create request
        let endpoint = "/api/media/properties/\(task.propertyId)/upload"
        let fullURL = NetworkManager.shared.baseURL + endpoint
        AppLogger.media.debug("Upload URL: \(fullURL, privacy: .public)")
        
        guard let url = URL(string: fullURL) else {
            AppLogger.media.error("Invalid URL: \(fullURL, privacy: .public)")
            completion(.failure(MediaUploadError.invalidURL))
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary.boundaryString)", forHTTPHeaderField: "Content-Type")
        // Note: Timeout is controlled by URLSession configuration (5 min request, 10 min resource)
        
        // Add authentication - session cookie
        if let sessionCookie = NetworkManager.shared.getSessionCookieValue() {
            AppLogger.media.debug("Adding session cookie")
            request.setValue("hestami_session=\(sessionCookie)", forHTTPHeaderField: "Cookie")
        } else {
            AppLogger.media.warning("No session cookie found")
        }
        
        // Add CSRF token if available (though browser doesn't use it)
        NetworkManager.shared.addCSRFToken(to: &request)
        
        // Log request details
        #if DEBUG
        AppLogger.media.debug("Request details:")
        AppLogger.media.debug("  URL: \(request.url?.absoluteString ?? "nil", privacy: .public)")
        AppLogger.media.debug("  Method: \(request.httpMethod ?? "nil", privacy: .public)")
        if let headers = request.allHTTPHeaderFields {
            for (key, value) in headers {
                let isSensitive = key.lowercased().contains("cookie") || key.lowercased().contains("auth")
                if isSensitive {
                    AppLogger.debugSensitive("Header \(key)", sensitiveData: value, category: AppLogger.media)
                } else {
                    AppLogger.media.debug("  \(key, privacy: .public): \(value, privacy: .public)")
                }
            }
        }
        #endif
        
        AppLogger.media.debug("Creating URLSession upload task...")
        
        // Read the multipart body data
        guard let bodyData = try? Data(contentsOf: boundary.fileURL) else {
            AppLogger.media.error("Failed to read multipart body file")
            completion(.failure(MediaUploadError.invalidFileData))
            return
        }
        AppLogger.media.debug("Multipart body size: \(bodyData.count, privacy: .public) bytes")
        
        // Create upload task with data instead of file
        let uploadTask = session.uploadTask(with: request, from: bodyData) { data, response, error in
            AppLogger.media.debug("===== UPLOAD COMPLETION HANDLER CALLED =====")
            if let error = error {
                AppLogger.media.error("Error: \(error.localizedDescription, privacy: .public)")
            }
            #if DEBUG
            AppLogger.media.debug("Response: \(response.debugDescription, privacy: .public)")
            AppLogger.media.debug("Data size: \(data?.count ?? 0, privacy: .public) bytes")
            #endif
            
            // Clean up temp file
            try? FileManager.default.removeItem(at: boundary.fileURL)
            
            if let error = error {
                AppLogger.media.error("Upload failed with error: \(error.localizedDescription, privacy: .public)")
                completion(.failure(error))
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                completion(.failure(MediaUploadError.invalidResponse))
                return
            }
            
            guard (200...299).contains(httpResponse.statusCode) else {
                let errorMessage = data.flatMap { String(data: $0, encoding: .utf8) } ?? "Unknown error"
                AppLogger.media.error("Upload failed with status \(httpResponse.statusCode, privacy: .public): \(errorMessage, privacy: .public)")
                completion(.failure(MediaUploadError.serverError(statusCode: httpResponse.statusCode, message: errorMessage)))
                return
            }
            
            guard let data = data else {
                completion(.failure(MediaUploadError.noData))
                return
            }
            
            do {
                let decoder = JSONDecoder()
                decoder.keyDecodingStrategy = .convertFromSnakeCase
                
                // Configure date decoding to handle ISO 8601 format
                let dateFormatter = ISO8601DateFormatter()
                dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                decoder.dateDecodingStrategy = .custom { decoder in
                    let container = try decoder.singleValueContainer()
                    let dateString = try container.decode(String.self)
                    
                    // Try ISO 8601 with fractional seconds
                    if let date = dateFormatter.date(from: dateString) {
                        return date
                    }
                    
                    // Try ISO 8601 without fractional seconds
                    dateFormatter.formatOptions = [.withInternetDateTime]
                    if let date = dateFormatter.date(from: dateString) {
                        return date
                    }
                    
                    // Try standard date formatter as fallback
                    let fallbackFormatter = DateFormatter()
                    fallbackFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSSSSZ"
                    fallbackFormatter.locale = Locale(identifier: "en_US_POSIX")
                    fallbackFormatter.timeZone = TimeZone(secondsFromGMT: 0)
                    if let date = fallbackFormatter.date(from: dateString) {
                        return date
                    }
                    
                    throw DecodingError.dataCorruptedError(in: container, debugDescription: "Cannot decode date string: \(dateString)")
                }
                
                let media = try decoder.decode(Media.self, from: data)
                AppLogger.media.info("Successfully decoded media response: \(media.id, privacy: .public)")
                completion(.success(media))
            } catch {
                AppLogger.media.error("Failed to decode media response: \(error.localizedDescription, privacy: .public)")
                #if DEBUG
                if let responseString = String(data: data, encoding: .utf8) {
                    AppLogger.media.error("Response JSON: \(responseString, privacy: .public)")
                }
                #endif
                completion(.failure(MediaUploadError.decodingError(error)))
            }
        }
        
        uploadTasks[task.id] = uploadTask
        AppLogger.media.debug("Starting upload task...")
        uploadTask.resume()
        AppLogger.media.debug("Upload task resumed")
    }
    
    private func createMultipartFormData(for task: MediaUploadTask) -> (fileURL: URL, boundaryString: String)? {
        let boundary = "Boundary-\(UUID().uuidString)"
        
        AppLogger.media.debug("createMultipartFormData: Reading file data from \(task.fileURL.path, privacy: .public)")
        guard let fileData = try? Data(contentsOf: task.fileURL) else {
            AppLogger.media.error("createMultipartFormData: Failed to read file data")
            return nil
        }
        AppLogger.media.debug("createMultipartFormData: File data size: \(fileData.count, privacy: .public) bytes")
        
        var body = Data()
        
        // Add file
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(task.fileName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(task.mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(fileData)
        body.append("\r\n".data(using: .utf8)!)
        
        // Add title
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"title\"\r\n\r\n".data(using: .utf8)!)
        body.append(task.title.data(using: .utf8)!)
        body.append("\r\n".data(using: .utf8)!)
        
        // Add description
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"description\"\r\n\r\n".data(using: .utf8)!)
        body.append(task.description.data(using: .utf8)!)
        body.append("\r\n".data(using: .utf8)!)
        
        // Add media_type
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"media_type\"\r\n\r\n".data(using: .utf8)!)
        body.append(task.mediaType.data(using: .utf8)!)
        body.append("\r\n".data(using: .utf8)!)
        
        // Add media_sub_type
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"media_sub_type\"\r\n\r\n".data(using: .utf8)!)
        body.append(task.mediaSubType.data(using: .utf8)!)
        body.append("\r\n".data(using: .utf8)!)
        
        // Add location_type
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"location_type\"\r\n\r\n".data(using: .utf8)!)
        body.append(task.locationType.data(using: .utf8)!)
        body.append("\r\n".data(using: .utf8)!)
        
        // Add location_sub_type
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"location_sub_type\"\r\n\r\n".data(using: .utf8)!)
        body.append(task.locationSubType.data(using: .utf8)!)
        body.append("\r\n".data(using: .utf8)!)
        
        // Add file_type (MIME type)
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file_type\"\r\n\r\n".data(using: .utf8)!)
        body.append(task.mimeType.data(using: .utf8)!)
        body.append("\r\n".data(using: .utf8)!)
        
        // Add file_size (as string)
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file_size\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(task.fileSize)".data(using: .utf8)!)
        body.append("\r\n".data(using: .utf8)!)
        
        // Add original_filename
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"original_filename\"\r\n\r\n".data(using: .utf8)!)
        body.append(task.fileName.data(using: .utf8)!)
        body.append("\r\n".data(using: .utf8)!)
        
        // Add mime_type (same as file_type)
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"mime_type\"\r\n\r\n".data(using: .utf8)!)
        body.append(task.mimeType.data(using: .utf8)!)
        body.append("\r\n".data(using: .utf8)!)
        
        // Close boundary
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        
        // Write to temp file
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        do {
            try body.write(to: tempURL)
            return (tempURL, boundary)
        } catch {
            AppLogger.media.error("Failed to write multipart data: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }
    
    private func validateFile(_ url: URL) -> (url: URL, fileName: String, fileSize: Int64, mimeType: String)? {
        guard let attributes = try? FileManager.default.attributesOfItem(atPath: url.path),
              let fileSize = attributes[.size] as? Int64 else {
            AppLogger.media.warning("Could not get file attributes for: \(url.lastPathComponent, privacy: .public)")
            return nil
        }
        
        // Check file size
        if fileSize > config.maxFileSize {
            AppLogger.media.warning("File too large: \(url.lastPathComponent, privacy: .public) (\(fileSize, privacy: .public) bytes)")
            return nil
        }
        
        // Determine MIME type
        let fileName = url.lastPathComponent
        let fileExtension = url.pathExtension.lowercased()
        
        let mimeType: String
        switch fileExtension {
        case "jpg", "jpeg":
            mimeType = "image/jpeg"
        case "png":
            mimeType = "image/png"
        case "gif":
            mimeType = "image/gif"
        case "mp4":
            mimeType = "video/mp4"
        case "mov":
            mimeType = "video/quicktime"
        default:
            AppLogger.media.warning("Unsupported file type: \(fileExtension, privacy: .public)")
            return nil
        }
        
        // Validate MIME type
        let allowedTypes = config.allowedImageTypes + config.allowedVideoTypes
        guard allowedTypes.contains(mimeType) else {
            AppLogger.media.warning("File type not allowed: \(mimeType, privacy: .public)")
            return nil
        }
        
        return (url, fileName, fileSize, mimeType)
    }
    
    private func updateOverallProgress() {
        let totalTasks = uploadQueue.count
        guard totalTasks > 0 else {
            overallProgress = 0.0
            return
        }
        
        let completedTasks = uploadQueue.filter { $0.status == .completed }.count
        let uploadingTasks = uploadQueue.filter { $0.status == .uploading }
        
        var progress = Double(completedTasks)
        
        // Add progress from currently uploading tasks
        for task in uploadingTasks {
            progress += task.progress
        }
        
        overallProgress = progress / Double(totalTasks)
    }
}

// MARK: - URLSessionTaskDelegate

extension MediaUploadManager: URLSessionTaskDelegate, URLSessionDataDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, didSendBodyData bytesSent: Int64, totalBytesSent: Int64, totalBytesExpectedToSend: Int64) {
        let progress = Double(totalBytesSent) / Double(totalBytesExpectedToSend)
        AppLogger.media.debug("Upload progress: \(Int(progress * 100), privacy: .public)% (\(totalBytesSent, privacy: .public)/\(totalBytesExpectedToSend, privacy: .public) bytes)")
        
        // Find the task and update progress
        DispatchQueue.main.async {
            if let taskId = self.uploadTasks.first(where: { $0.value == task })?.key,
               let index = self.uploadQueue.firstIndex(where: { $0.id == taskId }) {
                self.uploadQueue[index].progress = progress
                self.updateOverallProgress()
            }
        }
    }
    
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        AppLogger.media.debug("Received response")
        #if DEBUG
        if let httpResponse = response as? HTTPURLResponse {
            AppLogger.media.debug("Status code: \(httpResponse.statusCode, privacy: .public)")
            AppLogger.media.debug("Headers: \(String(describing: httpResponse.allHeaderFields), privacy: .public)")
        }
        #endif
        completionHandler(.allow)
    }
    
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        AppLogger.media.debug("Received data: \(data.count, privacy: .public) bytes")
        #if DEBUG
        if let responseString = String(data: data, encoding: .utf8) {
            AppLogger.media.debug("Response body: \(responseString, privacy: .public)")
        }
        #endif
    }
    
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        AppLogger.media.debug("URLSession task completed")
        if let error = error {
            AppLogger.media.error("URLSession task error: \(error.localizedDescription, privacy: .public)")
            AppLogger.media.error("Error code: \((error as NSError).code, privacy: .public)")
            AppLogger.media.error("Error domain: \((error as NSError).domain, privacy: .public)")
        } else {
            AppLogger.media.info("URLSession task completed successfully")
        }
        
        if let httpResponse = task.response as? HTTPURLResponse {
            AppLogger.media.debug("Final status code: \(httpResponse.statusCode, privacy: .public)")
        }
    }
}

// MARK: - Models

struct MediaUploadTask: Identifiable {
    let id: String
    let fileURL: URL
    let fileName: String
    let fileSize: Int64
    let mimeType: String
    let propertyId: String
    
    // Metadata fields
    var title: String
    var description: String
    var mediaType: String
    var mediaSubType: String
    var locationType: String
    var locationSubType: String
    
    var status: UploadStatus = .pending
    var progress: Double = 0.0
    var error: String?
    var uploadedMedia: Media?
    
    enum UploadStatus {
        case pending
        case uploading
        case completed
        case failed
        case cancelled
    }
}

// MARK: - Errors

enum MediaUploadError: LocalizedError {
    case noValidFiles
    case invalidFileData
    case invalidURL
    case invalidResponse
    case noData
    case serverError(statusCode: Int, message: String)
    case decodingError(Error)
    case someUploadsFailed
    
    var errorDescription: String? {
        switch self {
        case .noValidFiles:
            return "No valid files to upload"
        case .invalidFileData:
            return "Could not read file data"
        case .invalidURL:
            return "Invalid upload URL"
        case .invalidResponse:
            return "Invalid server response"
        case .noData:
            return "No data received from server"
        case .serverError(let statusCode, let message):
            return "Server error (\(statusCode)): \(message)"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .someUploadsFailed:
            return "Some uploads failed. Check individual file status."
        }
    }
}
