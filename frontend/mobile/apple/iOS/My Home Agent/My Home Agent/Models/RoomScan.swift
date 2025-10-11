import Foundation
import RoomPlan

struct RoomScan: Identifiable, Codable {
    let id: String
    let name: String
    let propertyId: String?
    let createdAt: Date
    let fileURL: URL
    let thumbnailURL: URL?
    let uploadStatus: UploadStatus
    let backendMediaId: String?
    
    enum UploadStatus: String, Codable {
        case notUploaded = "NOT_UPLOADED"
        case uploading = "UPLOADING"
        case uploaded = "UPLOADED"
        case failed = "FAILED"
    }
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case propertyId
        case createdAt
        case fileURL
        case thumbnailURL
        case uploadStatus
        case backendMediaId
    }
    
    init(
        id: String = UUID().uuidString,
        name: String,
        propertyId: String? = nil,
        createdAt: Date = Date(),
        fileURL: URL,
        thumbnailURL: URL? = nil,
        uploadStatus: UploadStatus = .notUploaded,
        backendMediaId: String? = nil
    ) {
        self.id = id
        self.name = name
        self.propertyId = propertyId
        self.createdAt = createdAt
        self.fileURL = fileURL
        self.thumbnailURL = thumbnailURL
        self.uploadStatus = uploadStatus
        self.backendMediaId = backendMediaId
    }
}

struct RoomScanMetadata: Codable {
    var scans: [RoomScan]
    
    init(scans: [RoomScan] = []) {
        self.scans = scans
    }
}
