import Foundation
import SwiftUI

class PropertyService {
    static let shared = PropertyService()
    
    private init() {}
    
    func getProperties() async throws -> [Property] {
        let response: PropertyResponse = try await NetworkManager.shared.request(endpoint: "/api/properties/")
        return response.properties
    }
    
    func getProperty(id: String) async throws -> Property {
        return try await NetworkManager.shared.request(endpoint: "/api/properties/\(id)/")
    }
    
    func createProperty(property: PropertyCreateRequest) async throws -> Property {
        return try await NetworkManager.shared.request(
            endpoint: "/api/properties/",
            method: .post,
            parameters: property.toDictionary()
        )
    }
    
    func updateProperty(id: String, updates: PropertyUpdateRequest) async throws -> Property {
        let params = updates.toDictionary()
        print("🔄 PropertyService: Updating property \(id)")
        print("📦 PropertyService: Update parameters: \(params)")
        if let descriptives = params["descriptives"] as? [String: Any] {
            print("📋 PropertyService: Descriptives keys: \(descriptives.keys.sorted())")
        }
        
        return try await NetworkManager.shared.request(
            endpoint: "/api/properties/\(id)",
            method: .patch,
            parameters: params
        )
    }
    
    func deleteProperty(id: String) async throws {
        let _: EmptyResponse = try await NetworkManager.shared.request(
            endpoint: "/api/properties/\(id)/",
            method: .delete
        )
    }
}

struct PropertyResponse: Codable {
    let properties: [Property]
}

struct PropertyCreateRequest: Codable {
    let title: String
    let description: String
    let address: String
    let city: String
    let state: String
    let zipCode: String
    let country: String
    let descriptives: PropertyDescriptives?
    
    func toDictionary() -> [String: Any] {
        var dict: [String: Any] = [
            "title": title,
            "description": description,
            "address": address,
            "city": city,
            "state": state,
            "zip_code": zipCode,
            "country": country
        ]
        
        if let descriptives = descriptives {
            // Convert descriptives to dictionary
            let encoder = JSONEncoder()
            if let descriptivesData = try? encoder.encode(descriptives),
               let descriptivesDict = try? JSONSerialization.jsonObject(with: descriptivesData) as? [String: Any] {
                dict["descriptives"] = descriptivesDict
            }
        }
        
        return dict
    }
}

struct PropertyUpdateRequest: Codable {
    let title: String?
    let description: String?
    let address: String?
    let city: String?
    let state: String?
    let zipCode: String?
    let county: String?
    let country: String?
    let descriptives: PropertyDescriptives?
    
    func toDictionary() -> [String: Any] {
        var dict: [String: Any] = [:]
        
        if let title = title { dict["title"] = title }
        if let description = description { dict["description"] = description }
        if let address = address { dict["address"] = address }
        if let city = city { dict["city"] = city }
        if let state = state { dict["state"] = state }
        if let zipCode = zipCode { dict["zip_code"] = zipCode }
        if let county = county { dict["county"] = county }
        if let country = country { dict["country"] = country }
        
        if let descriptives = descriptives {
            // Convert descriptives to dictionary
            let encoder = JSONEncoder()
            if let descriptivesData = try? encoder.encode(descriptives),
               let descriptivesDict = try? JSONSerialization.jsonObject(with: descriptivesData) as? [String: Any] {
                dict["descriptives"] = descriptivesDict
            }
        }
        
        return dict
    }
}

