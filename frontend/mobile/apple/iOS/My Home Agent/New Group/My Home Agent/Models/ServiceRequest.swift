import Foundation
import UIKit
import SwiftUI

struct ServiceRequest: Identifiable, Codable {
    let id: String
    let property: String
    let propertyDetails: PropertySummary?
    let category: String
    let categoryDisplay: String?
    let provider: String?
    let providerDetails: ServiceProvider?
    let title: String
    let description: String
    let status: ServiceRequestStatus
    let priority: ServiceRequestPriority
    let preferredSchedule: PreferredSchedule?
    let estimatedDuration: String?
    let scheduledStart: Date?
    let scheduledEnd: Date?
    let actualStart: Date?
    let actualEnd: Date?
    let estimatedCost: Decimal?
    let finalCost: Decimal?
    let createdAt: Date
    let updatedAt: Date
    let createdBy: String
    let createdByDetails: User?
    let budgetMinimum: Decimal?
    let budgetMaximum: Decimal?
    let bidSubmissionDeadline: Date?
    let selectedProvider: String?
    let selectedProviderDetails: ServiceProvider?
    let runnerUpProvider: String?
    let runnerUpProviderDetails: ServiceProvider?
    let bids: [Bid]?
    let clarifications: [Clarification]?
    let mediaDetails: [Media]?
    let isDiy: Bool
    let researchEntries: [ResearchEntry]?
    
    // UI properties
    var attachedPhotos: [UIImage] = []
    var date: Date { createdAt } // For UI compatibility
    
    // Computed properties for UI
    var statusColor: Color {
        switch status {
        case .PENDING: return AppTheme.warningColor
        case .IN_PROGRESS: return AppTheme.infoColor
        case .COMPLETED: return AppTheme.successColor
        case .CANCELLED, .DECLINED: return AppTheme.errorColor
        case .SCHEDULED: return Color.blue
        case .BIDDING, .REOPENED_BIDDING: return Color.purple
        case .ACCEPTED: return Color.green
        case .IN_RESEARCH: return Color.orange
        case .UNKNOWN: return Color(red: 0.5, green: 0.5, blue: 0.5) // AppTheme.disabledText
        }
    }
    
    enum CodingKeys: String, CodingKey {
        case id
        case property
        case propertyDetails
        case category
        case categoryDisplay
        case provider
        case providerDetails
        case title
        case description
        case status
        case priority
        case preferredSchedule
        case estimatedDuration
        case scheduledStart
        case scheduledEnd
        case actualStart
        case actualEnd
        case estimatedCost
        case finalCost
        case createdAt
        case updatedAt
        case createdBy
        case createdByDetails
        case budgetMinimum
        case budgetMaximum
        case bidSubmissionDeadline
        case selectedProvider
        case selectedProviderDetails
        case runnerUpProvider
        case runnerUpProviderDetails
        case bids
        case clarifications
        case mediaDetails
        case isDiy
        case researchEntries
    }
}

struct PropertySummary: Codable {
    let id: String
    let title: String
    let address: String
    let city: String
    let state: String
    let zipCode: String
    
    enum CodingKeys: String, CodingKey {
        case id
        case title
        case address
        case city
        case state
        case zipCode
    }
}

enum ServiceRequestStatus: String, Codable {
    case PENDING
    case IN_PROGRESS
    case COMPLETED
    case CANCELLED
    case DECLINED
    case SCHEDULED
    case BIDDING
    case REOPENED_BIDDING
    case ACCEPTED
    case IN_RESEARCH
    case UNKNOWN
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        self = ServiceRequestStatus(rawValue: rawValue) ?? .UNKNOWN
    }
}

enum ServiceRequestPriority: String, Codable {
    case LOW
    case MEDIUM
    case HIGH
    case URGENT
    case UNKNOWN
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        self = ServiceRequestPriority(rawValue: rawValue) ?? .UNKNOWN
    }
}

struct Bid: Codable {
    // Add bid properties as needed
    let id: String
}

struct Clarification: Codable {
    // Add clarification properties as needed
    let id: String
}

struct ResearchEntry: Codable {
    // Add research entry properties as needed
    let id: String
}

// Extension to ServiceRequestStatus for backward compatibility
extension ServiceRequestStatus {
    var stringValue: String {
        return self.rawValue
    }
    
    static func fromLegacyStatus(_ status: String) -> ServiceRequestStatus {
        switch status.lowercased() {
        case "pending": return .PENDING
        case "in_progress": return .IN_PROGRESS
        case "completed": return .COMPLETED
        case "cancelled": return .CANCELLED
        case "declined": return .DECLINED
        case "scheduled": return .SCHEDULED
        case "bidding": return .BIDDING
        case "reopened_bidding": return .REOPENED_BIDDING
        case "accepted": return .ACCEPTED
        case "in_research": return .IN_RESEARCH
        default: return .UNKNOWN
        }
    }
}

struct PreferredSchedule: Codable {
    let timeSlots: [TimeSlot]?
    let flexible: Bool?
    let notes: String?
    
    // Legacy support
    let date: String?

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        timeSlots = try? container.decodeIfPresent([TimeSlot].self, forKey: .timeSlots)
        notes = try? container.decodeIfPresent(String.self, forKey: .notes)
        
        // Legacy field
        date = try? container.decodeIfPresent(String.self, forKey: .date)
        
        // Accept both string and bool for 'flexible'
        if let boolValue = try? container.decodeIfPresent(Bool.self, forKey: .flexible) {
            flexible = boolValue
        } else if let stringValue = try? container.decodeIfPresent(String.self, forKey: .flexible) {
            flexible = (stringValue as NSString).boolValue
        } else {
            flexible = nil
        }
    }
    
    init(timeSlots: [TimeSlot], flexible: Bool = false, notes: String? = nil) {
        self.timeSlots = timeSlots
        self.flexible = flexible
        self.notes = notes
        self.date = nil
    }

    private enum CodingKeys: String, CodingKey {
        case timeSlots
        case flexible
        case notes
        case date
    }
}

struct TimeSlot: Codable, Identifiable {
    let id: UUID
    let date: String
    let startTime: String
    let endTime: String
    
    init(id: UUID = UUID(), date: String, startTime: String, endTime: String) {
        self.id = id
        self.date = date
        self.startTime = startTime
        self.endTime = endTime
    }
    
    enum CodingKeys: String, CodingKey {
        case date
        case startTime
        case endTime
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = UUID()
        self.date = try container.decode(String.self, forKey: .date)
        self.startTime = try container.decode(String.self, forKey: .startTime)
        self.endTime = try container.decode(String.self, forKey: .endTime)
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(date, forKey: .date)
        try container.encode(startTime, forKey: .startTime)
        try container.encode(endTime, forKey: .endTime)
    }
}