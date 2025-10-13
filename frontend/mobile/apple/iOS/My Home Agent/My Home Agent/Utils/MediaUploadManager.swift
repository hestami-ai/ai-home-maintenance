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
    
    /// Upload media files for a property
    func uploadMedia(files: [URL], propertyId: String, completion: @escaping (Result<[Media], Error>) -> Void) {
        // Validate files
        let validatedFiles = files.compactMap { validateFile($0) }
        
        guard !validatedFiles.isEmpty else {
            completion(.failure(MediaUploadError.noValidFiles))
            return
        }
        
        // Create upload tasks
        let tasks = validatedFiles.map { fileInfo in
            MediaUploadTask(
                id: UUID().uuidString,
                fileURL: fileInfo.url,
                fileName: fileInfo.fileName,
                fileSize: fileInfo.fileSize,
                mimeType: fileInfo.mimeType,
                propertyId: propertyId
            )
        }
        
        // Add to queue
        DispatchQueue.main.async {
            self.uploadQueue.append(contentsOf: tasks)
        }
        
        // Start uploading based on strategy
        switch config.uploadStrategy {
        case .sequential:
            uploadSequentially(completion: completion)
        case .parallel(let maxConcurrent):
            uploadInParallel(maxConcurrent: maxConcurrent, completion: completion)
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
            return
        }
        
        DispatchQueue.main.async {
            self.uploadQueue[index].status = .pending
            self.uploadQueue[index].error = nil
            self.uploadQueue[index].progress = 0.0
        }
        
        uploadSequentially(completion: completion)
    }
    
    // MARK: - Private Methods
    
    private func uploadSequentially(completion: @escaping (Result<[Media], Error>) -> Void) {
        DispatchQueue.main.async {
            self.isUploading = true
        }
        
        uploadNextInQueue(completion: completion)
    }
    
    private func uploadNextInQueue(completion: @escaping (Result<[Media], Error>) -> Void) {
        // Find next pending task
        guard let nextTask = uploadQueue.first(where: { $0.status == .pending }) else {
            // All done
            let uploadedMedia = uploadQueue.compactMap { $0.uploadedMedia }
            let hasErrors = uploadQueue.contains { $0.status == .failed }
            
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
        DispatchQueue.main.async {
            if let index = self.uploadQueue.firstIndex(where: { $0.id == task.id }) {
                self.uploadQueue[index].status = .uploading
            }
        }
        
        // Create multipart form data
        guard let boundary = createMultipartFormData(for: task) else {
            completion(.failure(MediaUploadError.invalidFileData))
            return
        }
        
        // Create request
        let endpoint = "/api/properties/\(task.propertyId)/media/upload/"
        guard let url = URL(string: NetworkManager.shared.baseURL + endpoint) else {
            completion(.failure(MediaUploadError.invalidURL))
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary.boundaryString)", forHTTPHeaderField: "Content-Type")
        
        // Add authentication
        if let sessionCookie = NetworkManager.shared.getSessionCookieValue() {
            request.setValue("hestami_session=\(sessionCookie)", forHTTPHeaderField: "Cookie")
        }
        
        // Create upload task
        let uploadTask = session.uploadTask(with: request, fromFile: boundary.fileURL) { data, response, error in
            // Clean up temp file
            try? FileManager.default.removeItem(at: boundary.fileURL)
            
            if let error = error {
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
                let media = try decoder.decode(Media.self, from: data)
                completion(.success(media))
            } catch {
                print("❌ Failed to decode media response: \(error)")
                completion(.failure(MediaUploadError.decodingError(error)))
            }
        }
        
        uploadTasks[task.id] = uploadTask
        uploadTask.resume()
    }
    
    private func createMultipartFormData(for task: MediaUploadTask) -> (fileURL: URL, boundaryString: String)? {
        let boundary = "Boundary-\(UUID().uuidString)"
        
        guard let fileData = try? Data(contentsOf: task.fileURL) else {
            return nil
        }
        
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
        body.append(task.fileName.data(using: .utf8)!)
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

extension MediaUploadManager: URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, didSendBodyData bytesSent: Int64, totalBytesSent: Int64, totalBytesExpectedToSend: Int64) {
        let progress = Double(totalBytesSent) / Double(totalBytesExpectedToSend)
        
        // Find the task and update progress
        DispatchQueue.main.async {
            if let taskId = self.uploadTasks.first(where: { $0.value == task })?.key,
               let index = self.uploadQueue.firstIndex(where: { $0.id == taskId }) {
                self.uploadQueue[index].progress = progress
                self.updateOverallProgress()
            }
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
