import Foundation
import UIKit
import Combine

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
        print("🟢 MediaUploadManager: uploadMedia called with \(tasks.count) tasks")
        
        guard !tasks.isEmpty else {
            print("❌ MediaUploadManager: No tasks to upload")
            completion(.failure(MediaUploadError.noValidFiles))
            return
        }
        
        print("🟢 MediaUploadManager: Created \(tasks.count) upload tasks")
        
        // Add to queue and start upload on main queue
        DispatchQueue.main.async {
            self.uploadQueue.append(contentsOf: tasks)
            print("🟢 MediaUploadManager: Queue now has \(self.uploadQueue.count) tasks")
            
            // Start uploading based on strategy
            switch self.config.uploadStrategy {
            case .sequential:
                print("🟢 MediaUploadManager: Starting sequential upload")
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
            print("❌ MediaUploadManager: Task \(taskId) not found in queue for retry")
            return
        }
        
        print("🔄 MediaUploadManager: Retrying task: \(uploadQueue[index].fileName)")
        
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
        print("🟡 MediaUploadManager: uploadNextInQueue called, queue has \(uploadQueue.count) tasks")
        
        // Log status of all tasks
        for (index, task) in uploadQueue.enumerated() {
            print("   Task \(index): \(task.fileName) - status: \(task.status)")
        }
        
        // Find next pending task
        guard let nextTask = uploadQueue.first(where: { $0.status == .pending }) else {
            // All done
            print("🟡 MediaUploadManager: No more pending tasks")
            let uploadedMedia = uploadQueue.compactMap { $0.uploadedMedia }
            let hasErrors = uploadQueue.contains { $0.status == .failed }
            
            print("🟡 MediaUploadManager: Upload complete - \(uploadedMedia.count) successful, hasErrors: \(hasErrors)")
            
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
        
        print("🟡 MediaUploadManager: Found pending task: \(nextTask.fileName)")
        
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
        print("🟠 MediaUploadManager: uploadTask called for \(task.fileName)")
        print("🟠 MediaUploadManager: File URL: \(task.fileURL)")
        print("🟠 MediaUploadManager: Property ID: \(task.propertyId)")
        
        DispatchQueue.main.async {
            if let index = self.uploadQueue.firstIndex(where: { $0.id == task.id }) {
                self.uploadQueue[index].status = .uploading
                print("🟠 MediaUploadManager: Task status set to uploading")
            }
        }
        
        // Create multipart form data
        print("🟠 MediaUploadManager: Creating multipart form data...")
        guard let boundary = createMultipartFormData(for: task) else {
            print("❌ MediaUploadManager: Failed to create multipart form data")
            completion(.failure(MediaUploadError.invalidFileData))
            return
        }
        print("🟠 MediaUploadManager: Multipart form data created successfully")
        
        // Create request
        let endpoint = "/api/media/properties/\(task.propertyId)/upload"
        let fullURL = NetworkManager.shared.baseURL + endpoint
        print("🟠 MediaUploadManager: Upload URL: \(fullURL)")
        
        guard let url = URL(string: fullURL) else {
            print("❌ MediaUploadManager: Invalid URL: \(fullURL)")
            completion(.failure(MediaUploadError.invalidURL))
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary.boundaryString)", forHTTPHeaderField: "Content-Type")
        // Note: Timeout is controlled by URLSession configuration (5 min request, 10 min resource)
        
        // Add authentication - session cookie
        if let sessionCookie = NetworkManager.shared.getSessionCookieValue() {
            print("🟠 MediaUploadManager: Adding session cookie")
            request.setValue("hestami_session=\(sessionCookie)", forHTTPHeaderField: "Cookie")
        } else {
            print("⚠️ MediaUploadManager: No session cookie found")
        }
        
        // Add CSRF token if available (though browser doesn't use it)
        NetworkManager.shared.addCSRFToken(to: &request)
        
        // Log request details
        print("🟠 MediaUploadManager: Request details:")
        print("   URL: \(request.url?.absoluteString ?? "nil")")
        print("   Method: \(request.httpMethod ?? "nil")")
        if let headers = request.allHTTPHeaderFields {
            print("   Headers:")
            for (key, value) in headers {
                print("     \(key): \(value)")
            }
        }
        
        print("🟠 MediaUploadManager: Creating URLSession upload task...")
        
        // Read the multipart body data
        guard let bodyData = try? Data(contentsOf: boundary.fileURL) else {
            print("❌ MediaUploadManager: Failed to read multipart body file")
            completion(.failure(MediaUploadError.invalidFileData))
            return
        }
        print("🟠 MediaUploadManager: Multipart body size: \(bodyData.count) bytes")
        
        // Create upload task with data instead of file
        let uploadTask = session.uploadTask(with: request, from: bodyData) { data, response, error in
            print("🎯 MediaUploadManager: ===== UPLOAD COMPLETION HANDLER CALLED =====")
            print("🎯 Error: \(error?.localizedDescription ?? "nil")")
            print("🎯 Response: \(response.debugDescription)")
            print("🎯 Data size: \(data?.count ?? 0) bytes")
            
            // Clean up temp file
            try? FileManager.default.removeItem(at: boundary.fileURL)
            
            if let error = error {
                print("❌ MediaUploadManager: Upload failed with error: \(error.localizedDescription)")
                completion(.failure(error))
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                completion(.failure(MediaUploadError.invalidResponse))
                return
            }
            
            guard (200...299).contains(httpResponse.statusCode) else {
                let errorMessage = data.flatMap { String(data: $0, encoding: .utf8) } ?? "Unknown error"
                print("❌ Upload failed with status \(httpResponse.statusCode): \(errorMessage)")
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
                print("✅ Successfully decoded media response: \(media.id)")
                completion(.success(media))
            } catch {
                print("❌ Failed to decode media response: \(error)")
                if let responseString = String(data: data, encoding: .utf8) {
                    print("❌ Response JSON: \(responseString)")
                }
                completion(.failure(MediaUploadError.decodingError(error)))
            }
        }
        
        uploadTasks[task.id] = uploadTask
        print("🟠 MediaUploadManager: Starting upload task...")
        uploadTask.resume()
        print("🟠 MediaUploadManager: Upload task resumed")
    }
    
    private func createMultipartFormData(for task: MediaUploadTask) -> (fileURL: URL, boundaryString: String)? {
        let boundary = "Boundary-\(UUID().uuidString)"
        
        print("🔵 createMultipartFormData: Reading file data from \(task.fileURL)")
        guard let fileData = try? Data(contentsOf: task.fileURL) else {
            print("❌ createMultipartFormData: Failed to read file data")
            return nil
        }
        print("🔵 createMultipartFormData: File data size: \(fileData.count) bytes")
        
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
            print("❌ Failed to write multipart data: \(error)")
            return nil
        }
    }
    
    private func validateFile(_ url: URL) -> (url: URL, fileName: String, fileSize: Int64, mimeType: String)? {
        guard let attributes = try? FileManager.default.attributesOfItem(atPath: url.path),
              let fileSize = attributes[.size] as? Int64 else {
            print("⚠️ Could not get file attributes for: \(url.lastPathComponent)")
            return nil
        }
        
        // Check file size
        if fileSize > config.maxFileSize {
            print("⚠️ File too large: \(url.lastPathComponent) (\(fileSize) bytes)")
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
            print("⚠️ Unsupported file type: \(fileExtension)")
            return nil
        }
        
        // Validate MIME type
        let allowedTypes = config.allowedImageTypes + config.allowedVideoTypes
        guard allowedTypes.contains(mimeType) else {
            print("⚠️ File type not allowed: \(mimeType)")
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
        print("📊 MediaUploadManager: Upload progress: \(Int(progress * 100))% (\(totalBytesSent)/\(totalBytesExpectedToSend) bytes)")
        
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
        print("📥 MediaUploadManager: Received response")
        if let httpResponse = response as? HTTPURLResponse {
            print("📥 Status code: \(httpResponse.statusCode)")
            print("📥 Headers: \(httpResponse.allHeaderFields)")
        }
        completionHandler(.allow)
    }
    
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        print("📥 MediaUploadManager: Received data: \(data.count) bytes")
        if let responseString = String(data: data, encoding: .utf8) {
            print("📥 Response body: \(responseString)")
        }
    }
    
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        print("🏁 MediaUploadManager: URLSession task completed")
        if let error = error {
            print("❌ MediaUploadManager: URLSession task error: \(error.localizedDescription)")
            print("❌ Error code: \((error as NSError).code)")
            print("❌ Error domain: \((error as NSError).domain)")
        } else {
            print("✅ MediaUploadManager: URLSession task completed successfully")
        }
        
        if let httpResponse = task.response as? HTTPURLResponse {
            print("🏁 Final status code: \(httpResponse.statusCode)")
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
