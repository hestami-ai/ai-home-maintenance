//
//  AppTheme.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/23/26.
//

import SwiftUI
import ARKit

// MARK: - App Theme

struct AppTheme {
    
    // MARK: - Background Colors (Blue-toned Dark Theme)
    
    static let primaryBackground = Color(red: 20/255, green: 29/255, blue: 43/255)
    static let secondaryBackground = Color(red: 26/255, green: 35/255, blue: 48/255)
    static let tertiaryBackground = Color(red: 25/255, green: 34/255, blue: 47/255)
    static let cardBackground = Color(red: 22/255, green: 31/255, blue: 45/255)
    
    // MARK: - Navigation Colors (Green-toned)
    
    static let navigationBackground = Color(red: 22/255, green: 51/255, blue: 60/255)
    static let sidebarBackground = Color(red: 21/255, green: 50/255, blue: 59/255)
    static let tabBarBackground = Color(red: 22/255, green: 51/255, blue: 60/255)
    static let navBarBackground = Color(red: 21/255, green: 50/255, blue: 59/255)
    
    // MARK: - Text Colors
    
    static let primaryText = Color(red: 255/255, green: 255/255, blue: 255/255)
    static let secondaryText = Color(red: 178/255, green: 178/255, blue: 178/255)
    static let disabledText = Color(red: 128/255, green: 128/255, blue: 128/255)
    
    // MARK: - Accent Colors
    
    static let primary = Color(red: 0/255, green: 120/255, blue: 242/255)
    static let primaryAccent = Color(red: 22/255, green: 51/255, blue: 60/255)
    static let secondaryAccent = Color(red: 242/255, green: 79/255, blue: 79/255)
    static let primaryBlueAccent = Color(red: 0/255, green: 120/255, blue: 242/255)
    static let accent = Color(red: 175/255, green: 82/255, blue: 222/255)
    
    // MARK: - Status Colors
    
    static let success = Color(red: 41/255, green: 181/255, blue: 120/255)
    static let warning = Color(red: 242/255, green: 176/255, blue: 41/255)
    static let error = Color(red: 242/255, green: 79/255, blue: 79/255)
    static let info = Color(red: 0/255, green: 120/255, blue: 242/255)
    
    // MARK: - UI Elements
    
    static let buttonBackground = Color(red: 22/255, green: 51/255, blue: 60/255)
    static let buttonText = Color.white
    static let borderColor = Color(red: 17/255, green: 26/255, blue: 40/255)
    static let inputBackground = Color(red: 17/255, green: 28/255, blue: 41/255).opacity(0.8)
    
    // MARK: - Opacity Variants
    
    static let overlayDark = Color.black.opacity(0.6)
    static let overlayMedium = Color.black.opacity(0.5)
    static let overlayLight = Color.black.opacity(0.3)
    
    // MARK: - Semantic Colors
    
    static func statusColor(for status: ScanStatus) -> Color {
        switch status {
        case .notStarted:
            return .gray
        case .inProgress:
            return info
        case .paused:
            return warning
        case .completed:
            return success
        case .uploading:
            return info
        case .processing:
            return primaryBlueAccent
        case .success:
            return success
        case .failed:
            return error
        }
    }
    
    static func trackingQualityColor(for quality: ARCamera.TrackingState) -> Color {
        switch quality {
        case .normal:
            return success
        case .notAvailable:
            return .gray
        case .limited:
            return warning
        }
    }
    
    static func readinessColor(for status: ReadinessStatus) -> Color {
        switch status {
        case .ready:
            return success
        case .lowConfidence:
            return warning
        case .notReady:
            return error
        }
    }
}

// MARK: - View Modifiers

struct ThemedBackground: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(AppTheme.primaryBackground)
            .preferredColorScheme(.dark)
    }
}

struct ThemedCard: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(AppTheme.cardBackground)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(AppTheme.borderColor, lineWidth: 1)
            )
    }
}

struct ThemedButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundColor(AppTheme.buttonText)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(AppTheme.buttonBackground)
            .cornerRadius(10)
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

struct ThemedSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundColor(AppTheme.primaryText)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(AppTheme.secondaryBackground)
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(AppTheme.borderColor, lineWidth: 1)
            )
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

// MARK: - View Extensions

extension View {
    func themedBackground() -> some View {
        self.modifier(ThemedBackground())
    }
    
    func themedCard() -> some View {
        self.modifier(ThemedCard())
    }
    
    func themedButtonStyle() -> some View {
        self.buttonStyle(ThemedButtonStyle())
    }
    
    func themedSecondaryButtonStyle() -> some View {
        self.buttonStyle(ThemedSecondaryButtonStyle())
    }
}
