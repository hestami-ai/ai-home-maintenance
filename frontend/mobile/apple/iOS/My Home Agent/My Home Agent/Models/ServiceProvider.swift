import Foundation

struct ServiceProvider: Codable {
    let id: String
    let companyName: String
    let description: String?
    let rating: String
    let totalReviews: Int
    
    enum CodingKeys: String, CodingKey {
        case id
        case companyName
        case description
        case rating
        case totalReviews
    }
}