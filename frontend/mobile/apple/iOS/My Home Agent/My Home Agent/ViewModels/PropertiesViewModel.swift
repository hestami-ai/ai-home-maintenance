import Foundation
import SwiftUI

@MainActor
class PropertiesViewModel: ObservableObject {
    @Published var properties: [Property] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var showRoomPlanAlert = false
    
    func loadProperties() async {
        isLoading = true
        errorMessage = nil
        
        do {
            let fetchedProperties = try await PropertyService.shared.getProperties()
            properties = fetchedProperties
            isLoading = false
        } catch {
            errorMessage = "Failed to load properties: \(error.localizedDescription)"
            isLoading = false
        }
    }
    
    func getProperty(id: String) async throws -> Property {
        return try await PropertyService.shared.getProperty(id: id)
    }
    
    func createProperty(
        title: String,
        description: String,
        address: String,
        city: String,
        state: String,
        zipCode: String,
        country: String = "United States",
        propertyType: String? = nil,
        bedrooms: String? = nil,
        bathrooms: String? = nil,
        yearBuilt: String? = nil,
        squareFootage: String? = nil
    ) async {
        // Create descriptives if any are provided
        var descriptives: PropertyDescriptives? = nil
        
        if propertyType != nil || bedrooms != nil || bathrooms != nil || yearBuilt != nil || squareFootage != nil {
            descriptives = PropertyDescriptives(
                garage: false,
                basement: false,
                bedrooms: bedrooms,
                bathrooms: bathrooms,
                utilities: nil,
                yearBuilt: yearBuilt,
                unitNumber: nil,
                propertyType: propertyType,
                heatingSystem: nil,
                squareFootage: squareFootage,
                gatedCommunity: false,
                airConditioning: false,
                createdFrom: "ios_app"
            )
        }
        
        // Create property request
        let propertyRequest = PropertyCreateRequest(
            title: title,
            description: description,
            address: address,
            city: city,
            state: state,
            zipCode: zipCode,
            country: country,
            descriptives: descriptives
        )
        
        isLoading = true
        errorMessage = nil
        
        do {
            let createdProperty = try await PropertyService.shared.createProperty(property: propertyRequest)
            properties.append(createdProperty)
            isLoading = false
        } catch {
            errorMessage = "Failed to create property: \(error.localizedDescription)"
            isLoading = false
        }
    }
    
    func updateProperty(
        id: String,
        title: String? = nil,
        description: String? = nil,
        address: String? = nil,
        city: String? = nil,
        state: String? = nil,
        zipCode: String? = nil,
        country: String? = nil,
        propertyType: String? = nil,
        bedrooms: String? = nil,
        bathrooms: String? = nil,
        yearBuilt: String? = nil,
        squareFootage: String? = nil
    ) async throws -> Property {
        // Create descriptives if any are provided
        var descriptives: PropertyDescriptives? = nil
        
        if propertyType != nil || bedrooms != nil || bathrooms != nil || yearBuilt != nil || squareFootage != nil {
            descriptives = PropertyDescriptives(
                garage: false,
                basement: false,
                bedrooms: bedrooms,
                bathrooms: bathrooms,
                utilities: nil,
                yearBuilt: yearBuilt,
                unitNumber: nil,
                propertyType: propertyType,
                heatingSystem: nil,
                squareFootage: squareFootage,
                gatedCommunity: false,
                airConditioning: false,
                createdFrom: "ios_app"
            )
        }
        
        // Create update request
        let updateRequest = PropertyUpdateRequest(
            title: title,
            description: description,
            address: address,
            city: city,
            state: state,
            zipCode: zipCode,
            country: country,
            descriptives: descriptives
        )
        
        isLoading = true
        errorMessage = nil
        
        do {
            let updatedProperty = try await PropertyService.shared.updateProperty(id: id, updates: updateRequest)
            
            // Update the property in the local array
            if let index = properties.firstIndex(where: { $0.id == id }) {
                properties[index] = updatedProperty
            }
            
            isLoading = false
            return updatedProperty
        } catch {
            isLoading = false
            errorMessage = "Failed to update property: \(error.localizedDescription)"
            throw error
        }
    }
    
    func deleteProperty(id: String) async {
        isLoading = true
        errorMessage = nil
        
        do {
            try await PropertyService.shared.deleteProperty(id: id)
            
            // Remove the property from the local array
            properties.removeAll { $0.id == id }
            
            isLoading = false
        } catch {
            errorMessage = "Failed to delete property: \(error.localizedDescription)"
            isLoading = false
        }
    }
    
    // For demo/testing purposes - load dummy data when API is not available
    func loadDummyData() {
        let dummyDate = Date()
        let dummyOwner = User(
            id: "3824fea0-90a9-4262-83c7-1c8d0d185ba4",
            email: "user@example.com",
            userRole: "PROPERTY_OWNER",
            firstName: "John",
            lastName: "Doe",
            phoneNumber: "555-123-4567"
        )
        
        properties = [
            Property(
                id: UUID().uuidString,
                title: "Main Residence",
                description: "Primary home",
                address: "123 Main Street",
                city: "Springfield",
                state: "IL",
                zipCode: "62701",
                county: "Sangamon",
                country: "US",
                status: .ACTIVE,
                createdAt: dummyDate,
                updatedAt: dummyDate,
                owner: dummyOwner.id,
                ownerDetails: dummyOwner,
                mediaCount: 0,
                descriptives: PropertyDescriptives(
                    garage: true,
                    basement: true,
                    bedrooms: "3",
                    bathrooms: "2",
                    utilities: nil,
                    yearBuilt: "2010",
                    unitNumber: nil,
                    propertyType: "Single Family Home",
                    heatingSystem: "Forced Air",
                    squareFootage: "2000",
                    gatedCommunity: false,
                    airConditioning: true,
                    createdFrom: "dummy_data"
                ),
                serviceRequests: [],
                geocodeAddress: nil,
                geocodeAddressSource: nil,
                permitRetrievalStatus: nil,
                permitLastRetrievedAt: nil,
                permitRetrievalError: nil,
                permitNextRetrievalAt: nil,
                permitRetrievalWorkflowId: nil,
                featuredImage: nil,
                media: nil
            ),
            Property(
                id: UUID().uuidString,
                title: "Vacation Home",
                description: "Beach property",
                address: "456 Beach Road",
                city: "Miami",
                state: "FL",
                zipCode: "33139",
                county: "Miami-Dade",
                country: "US",
                status: .ACTIVE,
                createdAt: dummyDate,
                updatedAt: dummyDate,
                owner: dummyOwner.id,
                ownerDetails: dummyOwner,
                mediaCount: 0,
                descriptives: PropertyDescriptives(
                    garage: false,
                    basement: false,
                    bedrooms: "2",
                    bathrooms: "2",
                    utilities: nil,
                    yearBuilt: "2015",
                    unitNumber: "303",
                    propertyType: "Condo",
                    heatingSystem: "Heat Pump",
                    squareFootage: "1200",
                    gatedCommunity: true,
                    airConditioning: true,
                    createdFrom: "dummy_data"
                ),
                serviceRequests: [],
                geocodeAddress: nil,
                geocodeAddressSource: nil,
                permitRetrievalStatus: nil,
                permitLastRetrievedAt: nil,
                permitRetrievalError: nil,
                permitNextRetrievalAt: nil,
                permitRetrievalWorkflowId: nil,
                featuredImage: nil,
                media: nil
            )
        ]
    }
}
