import Foundation

struct ServiceProvider: Codable {
    let id: String
    let businessName: String
    let description: String?
    let rating: String
    let totalReviews: Int
    
    enum CodingKeys: String, CodingKey {
        case id
        case businessName
        case description
        case rating
        case totalReviews
    }
}