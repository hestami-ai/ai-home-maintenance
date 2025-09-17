import Foundation
import SwiftUI

struct User: Codable, Identifiable {
    let id: String
    let email: String
    let userRole: String
    let firstName: String
    let lastName: String
    let phoneNumber: String?
    let serviceProvider: String?
    
    // UI-specific properties (excluded from Codable)
    var displayName: String {
        if !firstName.isEmpty || !lastName.isEmpty {
            return "\(firstName) \(lastName)".trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return email
    }
    
    var initials: String {
        if !firstName.isEmpty && !lastName.isEmpty {
            return "\(firstName.prefix(1))\(lastName.prefix(1))".uppercased()
        } else if !firstName.isEmpty {
            return String(firstName.prefix(1)).uppercased()
        } else if !lastName.isEmpty {
            return String(lastName.prefix(1)).uppercased()
        }
        return email.prefix(1).uppercased()
    }
    
    // Optional UI image for profile picture (excluded from Codable)
    var profileUIImage: UIImage?
    
    // CodingKeys to exclude profileUIImage from encoding/decoding
    enum CodingKeys: String, CodingKey {
        case id
        case email
        case userRole
        case firstName
        case lastName
        case phoneNumber
        case serviceProvider
    }
    
    // Custom initializer for creating users in code (for previews, etc.)
    init(id: String, email: String, userRole: String, firstName: String, lastName: String, 
         phoneNumber: String? = nil, serviceProvider: String? = nil, profileUIImage: UIImage? = nil) {
        self.id = id
        self.email = email
        self.userRole = userRole
        self.firstName = firstName
        self.lastName = lastName
        self.phoneNumber = phoneNumber
        self.serviceProvider = serviceProvider
        self.profileUIImage = profileUIImage
    }
}