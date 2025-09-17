import Foundation
import SwiftUI

@MainActor
class RequestsViewModel: ObservableObject {
    @Published var serviceRequests: [ServiceRequest] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var error: Error?
    
    private let serviceRequestService = ServiceRequestService.shared
    
    // Load all service requests for the current user
    func loadServiceRequests() async {
        isLoading = true
        errorMessage = nil
        error = nil
        
        do {
            let requests = try await serviceRequestService.getRequests()
            serviceRequests = requests
            isLoading = false
        } catch let networkError as NetworkError {
            error = networkError
            errorMessage = networkError.errorDescription
            isLoading = false
            // Fallback to dummy data in development
            if ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1" {
                loadDummyData()
            }
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
            // Fallback to dummy data in development
            if ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1" {
                loadDummyData()
            }
        }
    }
    
    // Create a new service request
    func createServiceRequest(
        propertyId: String,
        title: String,
        description: String,
        category: String,
        priority: ServiceRequestPriority = .MEDIUM,
        scheduledStart: Date? = nil,
        scheduledEnd: Date? = nil
    ) async throws -> ServiceRequest {
        // Create request parameters
        let parameters: [String: Any] = [
            "property": propertyId,
            "title": title,
            "description": description,
            "category": category,
            "priority": priority.rawValue,
            "scheduled_start": scheduledStart?.ISO8601Format() as Any,
            "scheduled_end": scheduledEnd?.ISO8601Format() as Any
        ]
        
        let newRequest = try await serviceRequestService.createRequest(parameters: parameters)
        serviceRequests.append(newRequest)
        
        return newRequest
    }
    
    // Update a service request status
    func updateServiceRequestStatus(requestId: String, status: ServiceRequestStatus) async throws {
        let parameters: [String: Any] = ["status": status.rawValue]
        
        let updatedRequest = try await serviceRequestService.updateRequest(id: requestId, updates: parameters)
        if let index = serviceRequests.firstIndex(where: { $0.id == requestId }) {
            serviceRequests[index] = updatedRequest
        }
    }
    
    // Cancel a service request
    func cancelServiceRequest(requestId: String) async throws {
        try await updateServiceRequestStatus(requestId: requestId, status: .CANCELLED)
        // Remove from local array if needed
        // serviceRequests.removeAll { $0.id == requestId }
    }
    
    // Filter requests by status
    func filteredRequests(by status: ServiceRequestStatus?) -> [ServiceRequest] {
        guard let status = status else {
            return serviceRequests
        }
        
        return serviceRequests.filter { $0.status == status }
    }
    
    // Load dummy data for development and previews
    private func loadDummyData() {
        let dummyDate = Date()
        let dummyUser = User(
            id: "3824fea0-90a9-4262-83c7-1c8d0d185ba4",
            email: "user@example.com",
            userRole: "PROPERTY_OWNER",
            firstName: "John",
            lastName: "Doe",
            phoneNumber: "555-123-4567"
        )
        
        let propertySummary = PropertySummary(
            id: "b5617c30-92a7-4e3d-8522-fb8885e73b31",
            title: "Townhome in Centerviille",
            address: "6083 Wicker Ln #154",
            city: "Centerville",
            state: "VA",
            zipCode: "20121"
        )
        
        serviceRequests = [
            ServiceRequest(
                id: "398b6ac9-18fc-4ee4-9b2a-f88e4e68320c",
                property: propertySummary.id,
                propertyDetails: propertySummary,
                category: "HVAC",
                categoryDisplay: "HVAC",
                provider: nil,
                providerDetails: nil,
                title: "Furnace is not cooling well",
                description: "The A/C unit is not cooling well.",
                status: .IN_RESEARCH,
                priority: .HIGH,
                preferredSchedule: nil,
                estimatedDuration: nil,
                scheduledStart: nil,
                scheduledEnd: nil,
                actualStart: nil,
                actualEnd: nil,
                estimatedCost: nil,
                finalCost: nil,
                createdAt: dummyDate,
                updatedAt: dummyDate,
                createdBy: dummyUser.id,
                createdByDetails: dummyUser,
                budgetMinimum: nil,
                budgetMaximum: nil,
                bidSubmissionDeadline: nil,
                selectedProvider: nil,
                selectedProviderDetails: nil,
                runnerUpProvider: nil,
                runnerUpProviderDetails: nil,
                bids: [],
                clarifications: [],
                mediaDetails: [],
                isDiy: false,
                researchEntries: []
            ),
            ServiceRequest(
                id: "73b83cd1-160d-4062-b4a1-ca4953402b00",
                property: propertySummary.id,
                propertyDetails: propertySummary,
                category: "PLUMBING",
                categoryDisplay: "Plumbing",
                provider: nil,
                providerDetails: nil,
                title: "Hot water heater is leaking",
                description: "New hot water heater needed urgently.",
                status: .PENDING,
                priority: .URGENT,
                preferredSchedule: nil,
                estimatedDuration: nil,
                scheduledStart: Calendar.current.date(byAdding: .day, value: 1, to: dummyDate),
                scheduledEnd: Calendar.current.date(byAdding: .day, value: 1, to: dummyDate),
                actualStart: nil,
                actualEnd: nil,
                estimatedCost: nil,
                finalCost: nil,
                createdAt: dummyDate,
                updatedAt: dummyDate,
                createdBy: dummyUser.id,
                createdByDetails: dummyUser,
                budgetMinimum: nil,
                budgetMaximum: nil,
                bidSubmissionDeadline: nil,
                selectedProvider: nil,
                selectedProviderDetails: nil,
                runnerUpProvider: nil,
                runnerUpProviderDetails: nil,
                bids: [],
                clarifications: [],
                mediaDetails: [],
                isDiy: false,
                researchEntries: []
            )
        ]
    }
}