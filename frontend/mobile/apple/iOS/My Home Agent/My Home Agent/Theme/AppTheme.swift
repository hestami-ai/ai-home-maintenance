import SwiftUI

struct AppTheme {
    // Background Colors - Blue-toned from web app
    static let primaryBackground = Color(red: 0.08, green: 0.11, blue: 0.17) // RGB(20, 29, 43) - main background
    static let secondaryBackground = Color(red: 0.10, green: 0.14, blue: 0.19) // RGB(26, 35, 48) - secondary background
    static let tertiaryBackground = Color(red: 0.10, green: 0.13, blue: 0.18) // RGB(25, 34, 47) - tertiary background
    static let cardBackground = Color(red: 0.09, green: 0.12, blue: 0.18) // RGB(22, 31, 45) - card background
    
    // Navigation and Sidebar Colors - Green-toned from web app
    static let navigationBackground = Color(red: 0.09, green: 0.20, blue: 0.24) // RGB(22, 51, 60) - navigation/sidebar
    static let sidebarBackground = Color(red: 0.08, green: 0.20, blue: 0.23) // RGB(21, 50, 59) - sidebar alternative
    
    // Text Colors - Primarily white as specified
    static let primaryText = Color(red: 1.0, green: 1.0, blue: 1.0) // White primary text
    static let secondaryText = Color(red: 0.7, green: 0.7, blue: 0.7) // Light gray secondary text
    static let disabledText = Color(red: 0.5, green: 0.5, blue: 0.5) // Disabled text
    
    // Accent Colors - Keeping existing accent system but updating primary
    static let accentColor = Color(red: 0.09, green: 0.20, blue: 0.24) // Primary accent using green-blue
    static let accentSecondary = Color(red: 0.95, green: 0.31, blue: 0.31) // Keep red accent
    static let accentPrimary = Color(red: 0.0, green: 0.47, blue: 0.95) // Keep blue accent
    
    // Status Colors - Keep existing for consistency
    static let successColor = Color(red: 0.16, green: 0.71, blue: 0.47) // success green
    static let warningColor = Color(red: 0.95, green: 0.69, blue: 0.16) // warning yellow
    static let errorColor = Color(red: 0.95, green: 0.31, blue: 0.31) // error red
    static let infoColor = Color(red: 0.0, green: 0.47, blue: 0.95) // info blue
    
    // UI Elements - Updated to match web app theme
    static let buttonBackground = Color(red: 0.09, green: 0.20, blue: 0.24) // Navigation green-blue
    static let buttonText = Color.white
    static let borderColor = Color(red: 0.07, green: 0.10, blue: 0.16) // RGB(17, 26, 40) - subtle border
    static let inputBackground = Color(red: 0.07, green: 0.11, blue: 0.16).opacity(0.8) // Input field background
    static let textPrimary = Color.white // Primary text color
    
    // Tab Bar and Navigation specific colors
    static let tabBarBackground = Color(red: 0.09, green: 0.20, blue: 0.24) // Green navigation color
    static let navBarBackground = Color(red: 0.08, green: 0.20, blue: 0.23) // Alternative navigation color
    
    // Fonts - Keep existing
    static let titleFont = Font.title.bold()
    static let headlineFont = Font.headline
    static let subheadlineFont = Font.subheadline
    static let bodyFont = Font.body
    static let captionFont = Font.caption
    
    // Dimensions - Keep existing
    static let cornerRadius: CGFloat = 10
    static let standardPadding: CGFloat = 16
    static let smallPadding: CGFloat = 8
}