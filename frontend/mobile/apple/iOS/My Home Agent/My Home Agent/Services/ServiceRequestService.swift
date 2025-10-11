import Foundation

// Response wrapper for service requests list
struct ServiceRequestsResponse: Codable {
    let serviceRequests: [ServiceRequest]
}

class ServiceRequestService {
    static let shared = ServiceRequestService()
    
    private init() {}
    
    func getRequests() async throws -> [ServiceRequest] {
        let response: ServiceRequestsResponse = try await NetworkManager.shared.request(endpoint: "/api/services/requests/")
        return response.serviceRequests
    }
    
    func getRequestsForProperty(propertyId: String) async throws -> [ServiceRequest] {
        return try await NetworkManager.shared.request(endpoint: "/api/services/requests/property/\(propertyId)/")
    }
    
    func getRequest(id: String) async throws -> ServiceRequest {
        return try await NetworkManager.shared.request(endpoint: "/api/services/requests/\(id)/")
    }
    
    func createRequest(request: ServiceRequest) async throws -> ServiceRequest {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        let data = try encoder.encode(request)
        let parameters = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
        
        return try await NetworkManager.shared.request(
            endpoint: "/api/services/requests/create/",
            method: .post,
            parameters: parameters
        )
    }
    
    func createRequest(parameters: [String: Any]) async throws -> ServiceRequest {
        return try await NetworkManager.shared.request(
            endpoint: "/api/services/requests/create/",
            method: .post,
            parameters: parameters
        )
    }
    
    func updateRequest(request: ServiceRequest) async throws -> ServiceRequest {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        let data = try encoder.encode(request)
        let parameters = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
        
        return try await NetworkManager.shared.request(
            endpoint: "/api/services/requests/\(request.id)/",
            method: .put,
            parameters: parameters
        )
    }
    
    func updateRequest(id: String, updates: [String: Any]) async throws -> ServiceRequest {
        return try await NetworkManager.shared.request(
            endpoint: "/api/services/requests/\(id)/",
            method: .put,
            parameters: updates
        )
    }
    
    func cancelRequest(id: String) async throws {
        let _: EmptyResponse = try await NetworkManager.shared.request(
            endpoint: "/api/services/requests/\(id)/cancel/",
            method: .post
        )
    }
}
