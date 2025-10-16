import Foundation

@MainActor
class MediaMetadataViewModel: ObservableObject {
    @Published var mediaTypes: [MediaTypeOption] = []
    @Published var mediaSubTypes: [MediaSubTypeOption] = []
    @Published var locationTypes: [LocationTypeOption] = []
    @Published var locationSubTypes: [LocationSubTypeOption] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private let networkManager = NetworkManager.shared
    private var allLocationSubTypes: [String: [LocationSubTypeOption]] = [:]
    
    // MARK: - Load Media Types
    
    func loadMediaTypes() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            let response: MediaTypesResponse = try await networkManager.request(
                endpoint: "/api/media/types/",
                method: .get
            )
            
            mediaTypes = response.types
            // Django returns all subtypes for all media types, so just flatten them
            if let firstMediaType = response.subTypes.keys.first {
                mediaSubTypes = response.subTypes[firstMediaType] ?? []
            }
            
            print("✅ Loaded \(mediaTypes.count) media types and \(mediaSubTypes.count) sub-types")
        } catch {
            print("❌ Failed to load media types: \(error)")
            errorMessage = "Failed to load media types"
            // Set defaults if API fails
            setDefaultMediaTypes()
        }
    }
    
    // MARK: - Load Location Types
    
    func loadLocationTypes() async {
        do {
            let response: LocationTypesResponse = try await networkManager.request(
                endpoint: "/api/media/locations/",
                method: .get
            )
            
            locationTypes = response.types
            allLocationSubTypes = response.subTypes
            
            print("✅ Loaded \(locationTypes.count) location types")
            print("✅ Location sub-types dictionary keys: \(allLocationSubTypes.keys)")
            for (key, subtypes) in allLocationSubTypes {
                print("   \(key): \(subtypes.count) subtypes")
            }
        } catch {
            print("❌ Failed to load location types: \(error)")
            errorMessage = "Failed to load location types"
            // Set defaults if API fails
            setDefaultLocationTypes()
        }
    }
    
    // MARK: - Load Location Sub-Types
    
    func loadLocationSubTypes(for locationType: String) async {
        // Get subtypes from the cached dictionary
        locationSubTypes = allLocationSubTypes[locationType] ?? []
        print("✅ loadLocationSubTypes called for '\(locationType)'")
        print("   Available keys in dictionary: \(allLocationSubTypes.keys)")
        print("   Loaded \(locationSubTypes.count) location sub-types")
        if !locationSubTypes.isEmpty {
            print("   Sub-types: \(locationSubTypes.map { $0.label })")
        }
    }
    
    // MARK: - Default Values (Fallback)
    
    private func setDefaultMediaTypes() {
        mediaTypes = [
            MediaTypeOption(value: "IMAGE", label: "Image"),
            MediaTypeOption(value: "VIDEO", label: "Video"),
            MediaTypeOption(value: "FILE", label: "File"),
            MediaTypeOption(value: "OTHER", label: "Other")
        ]
        
        mediaSubTypes = [
            MediaSubTypeOption(value: "REGULAR", label: "Regular"),
            MediaSubTypeOption(value: "360_DEGREE", label: "360 Degree"),
            MediaSubTypeOption(value: "FLOORPLAN", label: "Floorplan"),
            MediaSubTypeOption(value: "DOCUMENT", label: "Document"),
            MediaSubTypeOption(value: "OTHER", label: "Other")
        ]
    }
    
    private func setDefaultLocationTypes() {
        locationTypes = [
            LocationTypeOption(value: "INTERIOR", label: "Interior"),
            LocationTypeOption(value: "EXTERIOR", label: "Exterior"),
            LocationTypeOption(value: "SPECIALIZED", label: "Specialized"),
            LocationTypeOption(value: "MISCELLANEOUS", label: "Miscellaneous"),
            LocationTypeOption(value: "OTHER", label: "Other")
        ]
    }
}

// MARK: - Models

struct MediaTypeOption: Codable {
    let value: String
    let label: String
    
    var type: String { value }
}

struct MediaSubTypeOption: Codable {
    let value: String
    let label: String
    
    var type: String { value }
}

struct LocationTypeOption: Codable {
    let value: String
    let label: String
    
    var type: String { value }
}

struct LocationSubTypeOption: Codable {
    let value: String
    let label: String
    
    var type: String { value }
}

// MARK: - API Response Models

struct MediaTypesResponse: Codable {
    let types: [MediaTypeOption]
    let subTypes: [String: [MediaSubTypeOption]]
}

struct LocationTypesResponse: Codable {
    let types: [LocationTypeOption]
    let subTypes: [String: [LocationSubTypeOption]]
}
