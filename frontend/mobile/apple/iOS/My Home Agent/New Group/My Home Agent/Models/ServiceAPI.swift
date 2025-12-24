import Foundation

struct ServiceAPI: Codable {
    let id: String
    let name: String
    let description: String
    let iconName: String?
    let category: String
    let estimatedCost: String?
    let estimatedDuration: String?
    let isPopular: Bool?
    let isAvailable: Bool
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case description
        case iconName = "icon_name"
        case category
        case estimatedCost = "estimated_cost"
        case estimatedDuration = "estimated_duration"
        case isPopular = "is_popular"
        case isAvailable = "is_available"
    }
}
