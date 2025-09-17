import SwiftUI

struct ServiceRequestRow: View {
    let request: ServiceRequest
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(request.title)
                    .font(AppTheme.bodyFont.bold())
                    .foregroundColor(AppTheme.primaryText)
                
                Spacer()
                
                // Status pill
                Text(request.status.rawValue.replacingOccurrences(of: "_", with: " ").capitalized)
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(statusColor(request.status).opacity(0.2))
                    .foregroundColor(statusColor(request.status))
                    .cornerRadius(12)
            }
            
            Text(request.description)
                .font(AppTheme.captionFont)
                .foregroundColor(AppTheme.secondaryText)
                .lineLimit(2)
            
            HStack {
                // Category
                HStack(spacing: 4) {
                    Image(systemName: categoryIcon(request.category))
                        .font(.caption)
                    Text(request.categoryDisplay ?? request.category)
                        .font(.caption)
                }
                .foregroundColor(AppTheme.accentColor)
                
                Spacer()
                
                // Date
                Text(formatDate(request.createdAt))
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
                
                // Priority indicator if urgent or high
                if request.priority == .URGENT || request.priority == .HIGH {
                    HStack(spacing: 2) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.caption)
                        Text(request.priority.rawValue.capitalized)
                            .font(.caption)
                    }
                    .foregroundColor(priorityColor(request.priority))
                }
            }
        }
        .padding()
        .background(AppTheme.cardBackground)
        .cornerRadius(10)
        .shadow(color: Color.black.opacity(0.05), radius: 2, x: 0, y: 1)
    }
    
    // Helper function to get status color
    private func statusColor(_ status: ServiceRequestStatus) -> Color {
        switch status {
        case .PENDING:
            return AppTheme.warningColor
        case .IN_PROGRESS:
            return AppTheme.infoColor
        case .COMPLETED:
            return AppTheme.successColor
        case .CANCELLED, .DECLINED:
            return AppTheme.errorColor
        case .SCHEDULED:
            return Color.blue
        case .BIDDING, .REOPENED_BIDDING:
            return Color.purple
        case .ACCEPTED:
            return Color.green
        case .IN_RESEARCH:
            return Color.orange
        case .UNKNOWN:
            return Color(red: 0.5, green: 0.5, blue: 0.5)
        }
    }
    
    // Helper function to get priority color
    private func priorityColor(_ priority: ServiceRequestPriority) -> Color {
        switch priority {
        case .URGENT:
            return Color.red
        case .HIGH:
            return Color.orange
        case .MEDIUM:
            return Color.yellow
        case .LOW:
            return Color.green
        case .UNKNOWN:
            return Color.gray
        }
    }
    
    // Helper function to get category icon
    private func categoryIcon(_ category: String) -> String {
        switch category.lowercased() {
        case "hvac":
            return "thermometer"
        case "plumbing":
            return "drop.fill"
        case "electrical":
            return "bolt.fill"
        case "appliance":
            return "washer.fill"
        case "structural":
            return "hammer.fill"
        case "landscaping":
            return "leaf.fill"
        case "cleaning":
            return "spray.fill"
        case "pest_control":
            return "ant.fill"
        case "security":
            return "lock.fill"
        default:
            return "wrench.fill"
        }
    }
    
    // Helper function to format date
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }
}

struct ServiceRequestRow_Previews: PreviewProvider {
    static var previews: some View {
        let dummyDate = Date()
        let dummyUser = User(
            id: "3824fea0-90a9-4262-83c7-1c8d0d185ba4",
            email: "user@example.com",
            userRole: "PROPERTY_OWNER",
            firstName: "John",
            lastName: "Doe",
            phoneNumber: "555-123-4567"
        )
        
        let dummyRequest = ServiceRequest(
            id: "398b6ac9-18fc-4ee4-9b2a-f88e4e68320c",
            property: "b5617c30-92a7-4e3d-8522-fb8885e73b31",
            propertyDetails: PropertySummary(
                id: "b5617c30-92a7-4e3d-8522-fb8885e73b31",
                title: "Townhome in Centerviille",
                address: "6083 Wicker Ln #154",
                city: "Centerville",
                state: "VA",
                zipCode: "20121"
            ),
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
        )
        
        return VStack {
            ServiceRequestRow(request: dummyRequest)
                .padding()
        }
        .background(AppTheme.primaryBackground)
        .previewLayout(.sizeThatFits)
    }
}