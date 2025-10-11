import Foundation

class RoomScanUploadService {
    static let shared = RoomScanUploadService()
    
    private let networkManager = NetworkManager.shared
    private let storageService = RoomScanStorageService.shared
    
    private init() {}
    
    // MARK: - Upload Room Scan
    
    func uploadRoomScan(
        scan: RoomScan,
        propertyId: String,
        title: String? = nil,
        description: String? = nil
    ) async throws -> Media {
        // Update scan status to uploading
        var updatedScan = scan
        updatedScan = RoomScan(
            id: scan.id,
            name: scan.name,
            propertyId: propertyId,
            createdAt: scan.createdAt,
            fileURL: scan.fileURL,
            thumbnailURL: scan.thumbnailURL,
            uploadStatus: .uploading,
            backendMediaId: scan.backendMediaId
        )
        try storageService.updateScan(updatedScan)
        
        do {
            // Upload the USDZ file
            let media = try await uploadFile(
                fileURL: scan.fileURL,
                propertyId: propertyId,
                title: title ?? scan.name,
                description: description ?? "3D Room Scan created on \(formatDate(scan.createdAt))"
            )
            
            // Update scan with backend media ID and uploaded status
            updatedScan = RoomScan(
                id: scan.id,
                name: scan.name,
                propertyId: propertyId,
                createdAt: scan.createdAt,
                fileURL: scan.fileURL,
                thumbnailURL: scan.thumbnailURL,
                uploadStatus: .uploaded,
                backendMediaId: media.id
            )
            try storageService.updateScan(updatedScan)
            
            print("✅ RoomScanUpload: Successfully uploaded scan \(scan.id) to backend as media \(media.id)")
            return media
            
        } catch {
            // Update scan status to failed
            updatedScan = RoomScan(
                id: scan.id,
                name: scan.name,
                propertyId: scan.propertyId,
                createdAt: scan.createdAt,
                fileURL: scan.fileURL,
                thumbnailURL: scan.thumbnailURL,
                uploadStatus: .failed,
                backendMediaId: scan.backendMediaId
            )
            try? storageService.updateScan(updatedScan)
            
            print("❌ RoomScanUpload: Failed to upload scan \(scan.id): \(error)")
            throw error
        }
    }
    
    // MARK: - Upload File to Backend
    
    private func uploadFile(
        fileURL: URL,
        propertyId: String,
        title: String,
        description: String
    ) async throws -> Media {
        guard let baseURL = URL(string: "https://dev-homeservices.hestami-ai.com") else {
            throw NetworkError.invalidURL
        }
        
        let endpoint = "/api/properties/\(propertyId)/media/upload/"
        guard let url = URL(string: baseURL.absoluteString + endpoint) else {
            throw NetworkError.invalidURL
        }
        
        // Create multipart form data
        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        
        // Add cookies for authentication
        if let sessionCookie = networkManager.getSessionCookieValue() {
            request.addValue("hestami_session=\(sessionCookie)", forHTTPHeaderField: "Cookie")
        }
        
        // Build multipart body
        var body = Data()
        
        // Add file
        let fileData = try Data(contentsOf: fileURL)
        let filename = fileURL.lastPathComponent
        let mimeType = "model/vnd.usdz+zip"
        
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(fileData)
        body.append("\r\n".data(using: .utf8)!)
        
        // Add title
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"title\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(title)\r\n".data(using: .utf8)!)
        
        // Add description
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"description\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(description)\r\n".data(using: .utf8)!)
        
        // Add media_sub_type
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"media_sub_type\"\r\n\r\n".data(using: .utf8)!)
        body.append("FLOORPLAN\r\n".data(using: .utf8)!)
        
        // Add location_type
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"location_type\"\r\n\r\n".data(using: .utf8)!)
        body.append("INTERIOR\r\n".data(using: .utf8)!)
        
        // Close boundary
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        
        request.httpBody = body
        
        print("🌐 RoomScanUpload: Uploading file to \(url.absoluteString)")
        print("🌐 RoomScanUpload: File size: \(fileData.count) bytes")
        
        // Make the request
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.invalidResponse
        }
        
        print("🌐 RoomScanUpload: Response status code: \(httpResponse.statusCode)")
        
        guard httpResponse.statusCode == 201 else {
            if let errorString = String(data: data, encoding: .utf8) {
                print("❌ RoomScanUpload: Error response: \(errorString)")
            }
            throw NetworkError.httpError(statusCode: httpResponse.statusCode, data: data)
        }
        
        // Decode response
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        
        // Configure date decoding - use the same strategy as NetworkManager
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)
            
            // Try formatter with microseconds first
            let formatter1 = DateFormatter()
            formatter1.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSSSS'Z'"
            formatter1.timeZone = TimeZone(abbreviation: "UTC")
            
            if let date = formatter1.date(from: dateString) {
                return date
            }
            
            // Try formatter without microseconds
            let formatter2 = DateFormatter()
            formatter2.dateFormat = "yyyy-MM-dd'T'HH:mm:ss'Z'"
            formatter2.timeZone = TimeZone(abbreviation: "UTC")
            
            if let date = formatter2.date(from: dateString) {
                return date
            }
            
            // Try standard ISO8601 formatter
            let formatter3 = ISO8601DateFormatter()
            if let date = formatter3.date(from: dateString) {
                return date
            }
            
            throw DecodingError.dataCorrupted(DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Expected date string to be ISO8601-formatted."))
        }
        
        let media = try decoder.decode(Media.self, from: data)
        print("✅ RoomScanUpload: Successfully uploaded media with ID: \(media.id)")
        
        return media
    }
    
    // MARK: - Helper Methods
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
    
    // MARK: - Batch Upload
    
    func uploadAllUnuploadedScans(propertyId: String) async throws -> [Media] {
        let scans = storageService.getScans(forPropertyId: propertyId)
            .filter { $0.uploadStatus == .notUploaded || $0.uploadStatus == .failed }
        
        var uploadedMedia: [Media] = []
        
        for scan in scans {
            do {
                let media = try await uploadRoomScan(
                    scan: scan,
                    propertyId: propertyId
                )
                uploadedMedia.append(media)
            } catch {
                print("❌ RoomScanUpload: Failed to upload scan \(scan.id): \(error)")
                // Continue with next scan
            }
        }
        
        return uploadedMedia
    }
}
