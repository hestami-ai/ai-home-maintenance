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
    let featuredImage: String?
    let media: [Media]?
    
    // UI properties
    var image: UIImage?
    
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
        case featuredImage
        case media
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