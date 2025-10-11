import Foundation
import SwiftUI

@MainActor
class ServicesViewModel: ObservableObject {
    @Published var services: [Service] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var categories: [String] = []
    @Published var selectedCategory: String?
    
    func loadServices() async {
        isLoading = true
        errorMessage = nil
        
        // Check if we have a valid session
        if !NetworkManager.shared.hasSessionCookie() {
            print("⚠️ ServicesViewModel: No session cookie found. User may need to log in again.")
            errorMessage = "Session expired. Please log in again."
            isLoading = false
            return
        }
        
        do {
            let apiServices = try await ServiceCatalogService.shared.getServices()
            
            // Convert API services to UI services
            let uiServices = apiServices.map { apiService in
                ServiceCatalogService.shared.convertToUIService(apiService)
            }
            
            services = uiServices
            isLoading = false
        } catch {
            print("❌ ServicesViewModel: Error loading services: \(error)")
            errorMessage = "Failed to load services: \(error.localizedDescription)"
            isLoading = false
            // Load dummy data for development/testing
            loadDummyData()
        }
    }
    
    func loadCategories() async {
        do {
            let fetchedCategories = try await ServiceCatalogService.shared.getServiceCategories()
            categories = fetchedCategories
        } catch {
            print("Failed to load categories: \(error.localizedDescription)")
            // Set some default categories
            categories = ["Maintenance", "Repair", "Cleaning", "Renovation", "Other"]
        }
    }
    
    func filteredServices() -> [Service] {
        if let category = selectedCategory, !category.isEmpty {
            return services.filter { $0.name.contains(category) || $0.description.contains(category) }
        } else {
            return services
        }
    }
    
    // For demo/testing purposes - load dummy data when API is not available
    func loadDummyData() {
        self.services = [
            Service(id: UUID(), name: "Lawn Maintenance", icon: "leaf.fill", 
                   description: "Regular lawn mowing, edging, and maintenance services", 
                   estimatedCost: "$50-100"),
            Service(id: UUID(), name: "Roof Repair", icon: "house.fill", 
                   description: "Repair of leaks, damaged shingles, and general roof maintenance", 
                   estimatedCost: "$200-1000"),
            Service(id: UUID(), name: "Plumbing Repair", icon: "drop.fill", 
                   description: "Fix leaks, clogs, and general plumbing issues", 
                   estimatedCost: "$100-500"),
            Service(id: UUID(), name: "Driveway Sealing", icon: "car.fill", 
                   description: "Seal and protect your driveway from weather damage", 
                   estimatedCost: "$200-400"),
            Service(id: UUID(), name: "Interior Painting", icon: "paintbrush.fill", 
                   description: "Professional interior painting services", 
                   estimatedCost: "$300-800"),
            Service(id: UUID(), name: "Window Cleaning", icon: "sparkles", 
                   description: "Professional window cleaning inside and out", 
                   estimatedCost: "$100-300")
        ]
    }
}
