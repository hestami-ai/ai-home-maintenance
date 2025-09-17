import Foundation

struct LoginResponse: Decodable {
    let success: Bool
    let user: User
    
    // No custom CodingKeys needed as NetworkManager uses .convertFromSnakeCase
}
