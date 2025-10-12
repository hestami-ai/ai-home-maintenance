import Foundation
import UIKit

// Helper extension for flexible Int decoding (handles both Int and String from backend)
extension KeyedDecodingContainer {
    func decodeFlexibleInt(forKey key: K) throws -> Int? {
        // Try to decode as Int first
        if let intValue = try? decodeIfPresent(Int.self, forKey: key) {
            return intValue
        }
        // If that fails, try to decode as String and convert
        if let stringValue = try? decodeIfPresent(String.self, forKey: key) {
            // Return nil for empty strings
            if stringValue.isEmpty {
                return nil
            }
            // Try to convert string to int
            return Int(stringValue)
        }
        return nil
    }
}

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
    // Basic Property Info
    let propertyType: String?
    let yearBuilt: Int?
    let squareFootage: Int?
    let lotSize: String?
    let stories: Int?
    let bedrooms: Int?
    let bathrooms: String?
    let unitNumber: String?
    
    // Access & Security
    let gatedCommunity: Bool?
    let accessCode: String?
    let accessInstructions: String?
    let parkingType: String?
    let parkingSpaces: Int?
    
    // Structure & Features
    let basement: Bool?
    let basementType: String?
    let garage: Bool?
    let garageType: String?
    let garageSpaces: Int?
    let attic: Bool?
    let atticAccess: String?
    let crawlSpace: Bool?
    
    // HVAC & Climate Control
    let heatingSystem: String?
    let heatingFuel: String?
    let coolingSystem: String?
    let airConditioning: Bool?
    let hvacAge: Int?
    let hvacBrand: String?
    let hvacModel: String?
    let thermostatType: String?
    
    // Utilities & Systems
    let utilities: PropertyUtilities?
    let waterSource: String?
    let sewerSystem: String?
    let electricalPanel: String?
    let electricalAmps: Int?
    let gasService: Bool?
    let waterHeater: PropertyWaterHeater?
    
    // Plumbing
    let plumbingType: String?
    let waterShutoffLocation: String?
    let mainDrainCleanout: String?
    
    // Electrical
    let electricalPanelLocation: String?
    let wiringType: String?
    
    // Roofing & Exterior
    let roofType: String?
    let roofAge: String?
    let exteriorMaterial: String?
    let foundationType: String?
    
    // Appliances
    let appliances: PropertyAppliances?
    
    // Smart Home & Internet
    let internetService: Bool?
    let internetProvider: String?
    let smartHomeDevices: [String]?
    
    // Landscaping & Exterior
    let sprinklerSystem: Bool?
    let pool: Bool?
    let poolType: String?
    let fence: Bool?
    let fenceType: String?
    let deck: Bool?
    let deckMaterial: String?
    let patio: Bool?
    let patioMaterial: String?
    
    // Special Considerations
    let petFriendly: Bool?
    let smokingAllowed: Bool?
    let wheelchairAccessible: Bool?
    let fireplace: Bool?
    let fireplaceType: String?
    
    // Maintenance & Notes
    let maintenanceNotes: String?
    let specialInstructions: String?
    
    // Legacy field
    let createdFrom: String?
    
    // Custom decoder to handle flexible Int/String types from backend
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        // Decode strings
        propertyType = try container.decodeIfPresent(String.self, forKey: .propertyType)
        lotSize = try container.decodeIfPresent(String.self, forKey: .lotSize)
        bathrooms = try container.decodeIfPresent(String.self, forKey: .bathrooms)
        unitNumber = try container.decodeIfPresent(String.self, forKey: .unitNumber)
        accessCode = try container.decodeIfPresent(String.self, forKey: .accessCode)
        accessInstructions = try container.decodeIfPresent(String.self, forKey: .accessInstructions)
        parkingType = try container.decodeIfPresent(String.self, forKey: .parkingType)
        basementType = try container.decodeIfPresent(String.self, forKey: .basementType)
        garageType = try container.decodeIfPresent(String.self, forKey: .garageType)
        atticAccess = try container.decodeIfPresent(String.self, forKey: .atticAccess)
        heatingSystem = try container.decodeIfPresent(String.self, forKey: .heatingSystem)
        heatingFuel = try container.decodeIfPresent(String.self, forKey: .heatingFuel)
        coolingSystem = try container.decodeIfPresent(String.self, forKey: .coolingSystem)
        hvacBrand = try container.decodeIfPresent(String.self, forKey: .hvacBrand)
        hvacModel = try container.decodeIfPresent(String.self, forKey: .hvacModel)
        thermostatType = try container.decodeIfPresent(String.self, forKey: .thermostatType)
        waterSource = try container.decodeIfPresent(String.self, forKey: .waterSource)
        sewerSystem = try container.decodeIfPresent(String.self, forKey: .sewerSystem)
        electricalPanel = try container.decodeIfPresent(String.self, forKey: .electricalPanel)
        plumbingType = try container.decodeIfPresent(String.self, forKey: .plumbingType)
        waterShutoffLocation = try container.decodeIfPresent(String.self, forKey: .waterShutoffLocation)
        mainDrainCleanout = try container.decodeIfPresent(String.self, forKey: .mainDrainCleanout)
        electricalPanelLocation = try container.decodeIfPresent(String.self, forKey: .electricalPanelLocation)
        wiringType = try container.decodeIfPresent(String.self, forKey: .wiringType)
        roofType = try container.decodeIfPresent(String.self, forKey: .roofType)
        roofAge = try container.decodeIfPresent(String.self, forKey: .roofAge)
        exteriorMaterial = try container.decodeIfPresent(String.self, forKey: .exteriorMaterial)
        foundationType = try container.decodeIfPresent(String.self, forKey: .foundationType)
        internetProvider = try container.decodeIfPresent(String.self, forKey: .internetProvider)
        poolType = try container.decodeIfPresent(String.self, forKey: .poolType)
        fenceType = try container.decodeIfPresent(String.self, forKey: .fenceType)
        deckMaterial = try container.decodeIfPresent(String.self, forKey: .deckMaterial)
        patioMaterial = try container.decodeIfPresent(String.self, forKey: .patioMaterial)
        fireplaceType = try container.decodeIfPresent(String.self, forKey: .fireplaceType)
        maintenanceNotes = try container.decodeIfPresent(String.self, forKey: .maintenanceNotes)
        specialInstructions = try container.decodeIfPresent(String.self, forKey: .specialInstructions)
        createdFrom = try container.decodeIfPresent(String.self, forKey: .createdFrom)
        
        // Decode flexible Int fields (can be Int or String in JSON)
        yearBuilt = try container.decodeFlexibleInt(forKey: .yearBuilt)
        squareFootage = try container.decodeFlexibleInt(forKey: .squareFootage)
        stories = try container.decodeFlexibleInt(forKey: .stories)
        bedrooms = try container.decodeFlexibleInt(forKey: .bedrooms)
        parkingSpaces = try container.decodeFlexibleInt(forKey: .parkingSpaces)
        garageSpaces = try container.decodeFlexibleInt(forKey: .garageSpaces)
        hvacAge = try container.decodeFlexibleInt(forKey: .hvacAge)
        electricalAmps = try container.decodeFlexibleInt(forKey: .electricalAmps)
        
        // Decode booleans
        gatedCommunity = try container.decodeIfPresent(Bool.self, forKey: .gatedCommunity)
        basement = try container.decodeIfPresent(Bool.self, forKey: .basement)
        garage = try container.decodeIfPresent(Bool.self, forKey: .garage)
        attic = try container.decodeIfPresent(Bool.self, forKey: .attic)
        crawlSpace = try container.decodeIfPresent(Bool.self, forKey: .crawlSpace)
        airConditioning = try container.decodeIfPresent(Bool.self, forKey: .airConditioning)
        gasService = try container.decodeIfPresent(Bool.self, forKey: .gasService)
        internetService = try container.decodeIfPresent(Bool.self, forKey: .internetService)
        sprinklerSystem = try container.decodeIfPresent(Bool.self, forKey: .sprinklerSystem)
        pool = try container.decodeIfPresent(Bool.self, forKey: .pool)
        fence = try container.decodeIfPresent(Bool.self, forKey: .fence)
        deck = try container.decodeIfPresent(Bool.self, forKey: .deck)
        patio = try container.decodeIfPresent(Bool.self, forKey: .patio)
        petFriendly = try container.decodeIfPresent(Bool.self, forKey: .petFriendly)
        smokingAllowed = try container.decodeIfPresent(Bool.self, forKey: .smokingAllowed)
        wheelchairAccessible = try container.decodeIfPresent(Bool.self, forKey: .wheelchairAccessible)
        fireplace = try container.decodeIfPresent(Bool.self, forKey: .fireplace)
        
        // Decode nested objects
        utilities = try container.decodeIfPresent(PropertyUtilities.self, forKey: .utilities)
        waterHeater = try container.decodeIfPresent(PropertyWaterHeater.self, forKey: .waterHeater)
        appliances = try container.decodeIfPresent(PropertyAppliances.self, forKey: .appliances)
        smartHomeDevices = try container.decodeIfPresent([String].self, forKey: .smartHomeDevices)
    }
    
    // Convenience initializer for common fields
    init(
        propertyType: String? = nil,
        yearBuilt: Int? = nil,
        squareFootage: Int? = nil,
        bedrooms: Int? = nil,
        bathrooms: String? = nil,
        unitNumber: String? = nil,
        garage: Bool? = nil,
        basement: Bool? = nil,
        gatedCommunity: Bool? = nil,
        heatingSystem: String? = nil,
        airConditioning: Bool? = nil,
        utilities: PropertyUtilities? = nil,
        createdFrom: String? = nil
    ) {
        self.propertyType = propertyType
        self.yearBuilt = yearBuilt
        self.squareFootage = squareFootage
        self.lotSize = nil
        self.stories = nil
        self.bedrooms = bedrooms
        self.bathrooms = bathrooms
        self.unitNumber = unitNumber
        self.gatedCommunity = gatedCommunity
        self.accessCode = nil
        self.accessInstructions = nil
        self.parkingType = nil
        self.parkingSpaces = nil
        self.basement = basement
        self.basementType = nil
        self.garage = garage
        self.garageType = nil
        self.garageSpaces = nil
        self.attic = nil
        self.atticAccess = nil
        self.crawlSpace = nil
        self.heatingSystem = heatingSystem
        self.heatingFuel = nil
        self.coolingSystem = nil
        self.airConditioning = airConditioning
        self.hvacAge = nil
        self.hvacBrand = nil
        self.hvacModel = nil
        self.thermostatType = nil
        self.utilities = utilities
        self.waterSource = nil
        self.sewerSystem = nil
        self.electricalPanel = nil
        self.electricalAmps = nil
        self.gasService = nil
        self.waterHeater = nil
        self.plumbingType = nil
        self.waterShutoffLocation = nil
        self.mainDrainCleanout = nil
        self.electricalPanelLocation = nil
        self.wiringType = nil
        self.roofType = nil
        self.roofAge = nil
        self.exteriorMaterial = nil
        self.foundationType = nil
        self.appliances = nil
        self.internetService = nil
        self.internetProvider = nil
        self.smartHomeDevices = nil
        self.sprinklerSystem = nil
        self.pool = nil
        self.poolType = nil
        self.fence = nil
        self.fenceType = nil
        self.deck = nil
        self.deckMaterial = nil
        self.patio = nil
        self.patioMaterial = nil
        self.petFriendly = nil
        self.smokingAllowed = nil
        self.wheelchairAccessible = nil
        self.fireplace = nil
        self.fireplaceType = nil
        self.maintenanceNotes = nil
        self.specialInstructions = nil
        self.createdFrom = createdFrom
    }
    
    enum CodingKeys: String, CodingKey {
        case propertyType
        case yearBuilt
        case squareFootage
        case lotSize
        case stories
        case bedrooms
        case bathrooms
        case unitNumber
        case gatedCommunity
        case accessCode
        case accessInstructions
        case parkingType
        case parkingSpaces
        case basement
        case basementType
        case garage
        case garageType
        case garageSpaces
        case attic
        case atticAccess
        case crawlSpace
        case heatingSystem
        case heatingFuel
        case coolingSystem
        case airConditioning
        case hvacAge
        case hvacBrand
        case hvacModel
        case thermostatType
        case utilities
        case waterSource
        case sewerSystem
        case electricalPanel
        case electricalAmps
        case gasService
        case waterHeater
        case plumbingType
        case waterShutoffLocation
        case mainDrainCleanout
        case electricalPanelLocation
        case wiringType
        case roofType
        case roofAge
        case exteriorMaterial
        case foundationType
        case appliances
        case internetService
        case internetProvider
        case smartHomeDevices
        case sprinklerSystem
        case pool
        case poolType
        case fence
        case fenceType
        case deck
        case deckMaterial
        case patio
        case patioMaterial
        case petFriendly
        case smokingAllowed
        case wheelchairAccessible
        case fireplace
        case fireplaceType
        case maintenanceNotes
        case specialInstructions
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

struct PropertyWaterHeater: Codable {
    let type: String?
    let fuel: String?
    let capacity: String?
    let age: Int?
    let brand: String?
    let model: String?
}

struct PropertyAppliances: Codable {
    let refrigerator: Bool?
    let stove: Bool?
    let dishwasher: Bool?
    let washer: Bool?
    let dryer: Bool?
    let microwave: Bool?
    let oven: Bool?
    let range: Bool?
    let garbageDisposal: Bool?
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