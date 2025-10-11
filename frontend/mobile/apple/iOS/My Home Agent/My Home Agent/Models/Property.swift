import Foundation
import UIKit

struct Property: Identifiable, Codable {
    let id: String
    let title: String
    let description: String
    let address: String
    let city: String
    let state: String
    let zipCode: String
    let county: String?
    let country: String
    let status: PropertyStatus
    let createdAt: Date
    let updatedAt: Date
    let owner: String
    let ownerDetails: User
    let mediaCount: Int
    let descriptives: PropertyDescriptives?
    let serviceRequests: [ServiceRequest]?
    let geocodeAddress: GeocodeAddress?
    let geocodeAddressSource: String?
    let permitRetrievalStatus: String?
    let permitLastRetrievedAt: Date?
    let permitRetrievalError: String?
    let permitNextRetrievalAt: Date?
    let permitRetrievalWorkflowId: String?
    private let _featuredImage: String?
    private let _media: [Media]?
    
    // Computed properties that rewrite media URLs
    var featuredImage: String? {
        guard let image = _featuredImage else { return nil }
        return NetworkManager.shared.rewriteMediaURL(image)
    }
    
    var media: [Media]? {
        return _media?.map { mediaItem in
            var updatedItem = mediaItem
            if !mediaItem.fileUrl.isEmpty {
                updatedItem.fileUrl = NetworkManager.shared.rewriteMediaURL(mediaItem.fileUrl)
            }
            return updatedItem
        }
    }
    
    // UI properties
    var image: UIImage?
    
    // Custom initializer to handle the renamed properties
    init(
        id: String,
        title: String,
        description: String,
        address: String,
        city: String,
        state: String,
        zipCode: String,
        county: String?,
        country: String,
        status: PropertyStatus,
        createdAt: Date,
        updatedAt: Date,
        owner: String,
        ownerDetails: User,
        mediaCount: Int,
        descriptives: PropertyDescriptives?,
        serviceRequests: [ServiceRequest]?,
        geocodeAddress: GeocodeAddress?,
        geocodeAddressSource: String?,
        permitRetrievalStatus: String?,
        permitLastRetrievedAt: Date?,
        permitRetrievalError: String?,
        permitNextRetrievalAt: Date?,
        permitRetrievalWorkflowId: String?,
        featuredImage: String?,
        media: [Media]?
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.address = address
        self.city = city
        self.state = state
        self.zipCode = zipCode
        self.county = county
        self.country = country
        self.status = status
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.owner = owner
        self.ownerDetails = ownerDetails
        self.mediaCount = mediaCount
        self.descriptives = descriptives
        self.serviceRequests = serviceRequests
        self.geocodeAddress = geocodeAddress
        self.geocodeAddressSource = geocodeAddressSource
        self.permitRetrievalStatus = permitRetrievalStatus
        self.permitLastRetrievedAt = permitLastRetrievedAt
        self.permitRetrievalError = permitRetrievalError
        self.permitNextRetrievalAt = permitNextRetrievalAt
        self.permitRetrievalWorkflowId = permitRetrievalWorkflowId
        self._featuredImage = featuredImage
        self._media = media
    }
    
    enum CodingKeys: String, CodingKey {
        case id
        case title
        case description
        case address
        case city
        case state
        case zipCode
        case county
        case country
        case status
        case createdAt
        case updatedAt
        case owner
        case ownerDetails
        case mediaCount
        case descriptives
        case serviceRequests
        case geocodeAddress
        case geocodeAddressSource
        case permitRetrievalStatus
        case permitLastRetrievedAt
        case permitRetrievalError
        case permitNextRetrievalAt
        case permitRetrievalWorkflowId
        case _featuredImage = "featuredImage"
        case _media = "media"
    }
}

enum PropertyStatus: String, Codable {
    case ACTIVE
    case INACTIVE
    case PENDING
    case COUNTY_PROCESSING
    case UNKNOWN
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        self = PropertyStatus(rawValue: rawValue) ?? .UNKNOWN
    }
}

struct PropertyDescriptives: Codable {
    let garage: Bool?
    let basement: Bool?
    let bedrooms: String?
    let bathrooms: String?
    let utilities: PropertyUtilities?
    let yearBuilt: String?
    let unitNumber: String?
    let propertyType: String?
    let heatingSystem: String?
    let squareFootage: String?
    let gatedCommunity: Bool?
    let airConditioning: Bool?
    let createdFrom: String?
    
    enum CodingKeys: String, CodingKey {
        case garage
        case basement
        case bedrooms
        case bathrooms
        case utilities
        case yearBuilt
        case unitNumber
        case propertyType
        case heatingSystem
        case squareFootage
        case gatedCommunity
        case airConditioning
        case createdFrom = "created_from"
    }
}

struct PropertyUtilities: Codable {
    let gas: String?
    let sewer: String?
    let water: String?
    let electricity: String?
    let internetCable: String?
    
    enum CodingKeys: String, CodingKey {
        case gas
        case sewer
        case water
        case electricity
        case internetCable
    }
}

struct GeocodeAddress: Codable {
    let results: [GeocodeResult]?
    let summary: GeocodeSummary?
    
    struct GeocodeResult: Codable {
        let id: String?
        let type: String?
        let score: Double?
        let address: GeocodeResultAddress?
        let position: GeocodePosition?
    }
    
    struct GeocodeResultAddress: Codable {
        let country: String?
        let localName: String?
        let postalCode: String?
        let streetName: String?
        let countryCode: String?
        let municipality: String?
        let streetNumber: String?
        let freeformAddress: String?
    }
    
    struct GeocodePosition: Codable {
        let lat: Double?
        let lon: Double?
    }
    
    struct GeocodeSummary: Codable {
        let query: String?
        let queryTime: Int?
    }
}