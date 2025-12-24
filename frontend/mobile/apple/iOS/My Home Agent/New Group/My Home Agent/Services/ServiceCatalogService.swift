import Foundation

class ServiceCatalogService {
    static let shared = ServiceCatalogService()
    
    private init() {}
    
    func getServices() async throws -> [ServiceAPI] {
        return try await NetworkManager.shared.request(endpoint: "/api/services/")
    }
    
    func getServiceCategories() async throws -> [String] {
        return try await NetworkManager.shared.request(endpoint: "/api/services/categories/")
    }
    
    func getService(id: String) async throws -> ServiceAPI {
        return try await NetworkManager.shared.request(endpoint: "/api/services/\(id)/")
    }
    
    // Convert API service model to UI service model
    func convertToUIService(_ apiService: ServiceAPI) -> Service {
        return Service(
            id: UUID(), // Using UUID for UI model
            name: apiService.name,
            icon: apiService.iconName ?? "questionmark.circle.fill",
            description: apiService.description,
            estimatedCost: apiService.estimatedCost ?? "Price varies"
        )
    }
}
