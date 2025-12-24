import SwiftUI

enum RequestStatus: String, CaseIterable {
    case pending = "Pending"
    case inProgress = "In Progress"
    case completed = "Completed"
    case cancelled = "Cancelled"
    
    var apiValue: String {
        switch self {
        case .pending: return "pending"
        case .inProgress: return "in_progress"
        case .completed: return "completed"
        case .cancelled: return "cancelled"
        }
    }
    
    var color: Color {
        switch self {
        case .pending: return AppTheme.warningColor // Warning color
        case .inProgress: return AppTheme.infoColor // Info color
        case .completed: return AppTheme.successColor // Success color
        case .cancelled: return AppTheme.errorColor // Error color
        }
    }
    
    static func fromAPIValue(_ value: String) -> RequestStatus {
        switch value {
        case "pending": return .pending
        case "in_progress": return .inProgress
        case "completed": return .completed
        case "cancelled": return .cancelled
        default: return .pending
        }
    }
}
