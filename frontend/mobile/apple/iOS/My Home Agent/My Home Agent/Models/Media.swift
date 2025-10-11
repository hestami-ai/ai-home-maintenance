import Foundation
import UIKit

struct Media: Identifiable, Codable {
    let id: String
    let propertyRef: String?
    let serviceRequest: String?
    let serviceReport: String?
    let reportPhotoType: String?
    let uploader: String
    let file: String
    let fileType: String
    let fileSize: Int
    let title: String
    let description: String
    let uploadDate: Date
    var fileUrl: String
    private let _thumbnailSmallUrl: String?
    private let _thumbnailMediumUrl: String?
    private let _thumbnailLargeUrl: String?
    
    // Computed properties that rewrite thumbnail URLs
    var thumbnailSmallUrl: String? {
        guard let url = _thumbnailSmallUrl else { return nil }
        return NetworkManager.shared.rewriteMediaURL(url)
    }
    
    var thumbnailMediumUrl: String? {
        guard let url = _thumbnailMediumUrl else { return nil }
        return NetworkManager.shared.rewriteMediaURL(url)
    }
    
    var thumbnailLargeUrl: String? {
        guard let url = _thumbnailLargeUrl else { return nil }
        return NetworkManager.shared.rewriteMediaURL(url)
    }
    let isImage: Bool
    let isVideo: Bool
    let mediaType: MediaType
    let mediaSubType: String
    let locationType: String
    let locationSubType: String
    let locationDisplay: String?
    let parentType: ParentType
    let originalFilename: String
    let mimeType: String
    let processingStatus: ProcessingStatus
    let isReady: Bool
    
    // UI properties
    var image: UIImage?
    
    enum CodingKeys: String, CodingKey {
        case id
        case propertyRef
        case serviceRequest
        case serviceReport
        case reportPhotoType
        case uploader
        case file
        case fileType
        case fileSize
        case title
        case description
        case uploadDate
        case fileUrl
        case _thumbnailSmallUrl = "thumbnailSmallUrl"
        case _thumbnailMediumUrl = "thumbnailMediumUrl"
        case _thumbnailLargeUrl = "thumbnailLargeUrl"
        case isImage
        case isVideo
        case mediaType
        case mediaSubType
        case locationType
        case locationSubType
        case locationDisplay
        case parentType
        case originalFilename
        case mimeType
        case processingStatus
        case isReady
    }
}

enum MediaType: String, Codable {
    case IMAGE
    case VIDEO
    case FILE
    case UNKNOWN
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        self = MediaType(rawValue: rawValue) ?? .UNKNOWN
    }
}

enum ParentType: String, Codable {
    case PROPERTY
    case SERVICE_REQUEST
    case SERVICE_REPORT
    case UNKNOWN
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        self = ParentType(rawValue: rawValue) ?? .UNKNOWN
    }
}

enum ProcessingStatus: String, Codable {
    case READY
    case PENDING
    case FAILED
    case UNKNOWN
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        self = ProcessingStatus(rawValue: rawValue) ?? .UNKNOWN
    }
}