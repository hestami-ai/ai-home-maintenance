//
//  DesignSystem.swift
//  Hestami Home Measurements
//
//  Created by Marshall Hendricks on 1/23/26.
//

import SwiftUI

// MARK: - Reusable Components

struct ThemedButton: View {
    let title: String
    let action: () -> Void
    var isDisabled: Bool = false
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.headline)
                .foregroundColor(isDisabled ? AppTheme.disabledText : AppTheme.buttonText)
                .frame(maxWidth: .infinity)
                .padding()
                .background(isDisabled ? AppTheme.disabledText.opacity(0.3) : AppTheme.buttonBackground)
                .cornerRadius(10)
        }
        .disabled(isDisabled)
    }
}

struct ThemedSecondaryButton: View {
    let title: String
    let action: () -> Void
    var isDisabled: Bool = false
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.headline)
                .foregroundColor(isDisabled ? AppTheme.disabledText : AppTheme.primaryText)
                .frame(maxWidth: .infinity)
                .padding()
                .background(AppTheme.secondaryBackground)
                .cornerRadius(10)
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(AppTheme.borderColor, lineWidth: 1)
                )
        }
        .disabled(isDisabled)
    }
}

struct ThemedCardView<Content: View>: View {
    let content: Content
    
    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    var body: some View {
        content
            .padding(16)
            .background(AppTheme.cardBackground)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(AppTheme.borderColor, lineWidth: 1)
            )
    }
}

struct StatusBadge: View {
    let text: String
    let color: Color
    
    var body: some View {
        Text(text)
            .font(.caption)
            .fontWeight(.semibold)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.2))
            .foregroundColor(color)
            .cornerRadius(8)
    }
}

struct MetricCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)
            
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(AppTheme.primaryText)
            
            Text(title)
                .font(.caption)
                .foregroundColor(AppTheme.secondaryText)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(AppTheme.cardBackground)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(AppTheme.borderColor, lineWidth: 1)
        )
    }
}

struct ProgressIndicator: View {
    let progress: Double
    let color: Color
    
    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                // Background
                RoundedRectangle(cornerRadius: 8)
                    .fill(AppTheme.secondaryBackground)
                    .frame(height: 8)
                
                // Progress
                RoundedRectangle(cornerRadius: 8)
                    .fill(color)
                    .frame(width: geometry.size.width * CGFloat(progress), height: 8)
                    .animation(.easeInOut(duration: 0.3), value: progress)
            }
        }
        .frame(height: 8)
    }
}

struct ThemedTextField: View {
    let title: String
    @Binding var text: String
    var placeholder: String = ""
    var isSecure: Bool = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
                .foregroundColor(AppTheme.primaryText)
            
            if isSecure {
                SecureField(placeholder, text: $text)
                    .textFieldStyle(ThemedTextFieldStyle())
            } else {
                TextField(placeholder, text: $text)
                    .textFieldStyle(ThemedTextFieldStyle())
            }
        }
    }
}

struct ThemedTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding()
            .background(AppTheme.inputBackground)
            .cornerRadius(10)
            .foregroundColor(AppTheme.primaryText)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(AppTheme.borderColor, lineWidth: 1)
            )
    }
}

struct ThemedSection<Content: View>: View {
    let header: String
    let footer: String?
    let content: Content
    
    init(header: String, footer: String? = nil, @ViewBuilder content: () -> Content) {
        self.header = header
        self.footer = footer
        self.content = content()
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(header)
                .font(.headline)
                .foregroundColor(AppTheme.primaryText)
            
            content
            
            if let footer = footer {
                Text(footer)
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
            }
        }
        .padding()
        .background(AppTheme.cardBackground)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(AppTheme.borderColor, lineWidth: 1)
        )
    }
}

struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String
    let buttonTitle: String
    let buttonAction: () -> Void
    
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: icon)
                .font(.system(size: 80))
                .foregroundColor(AppTheme.secondaryText)
            
            Text(title)
                .font(.title2)
                .fontWeight(.semibold)
                .foregroundColor(AppTheme.primaryText)
            
            Text(message)
                .font(.body)
                .foregroundColor(AppTheme.secondaryText)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            
            ThemedButton(title: buttonTitle, action: buttonAction)
                .padding(.horizontal)
        }
    }
}

struct InfoRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .foregroundColor(AppTheme.secondaryText)
            
            Spacer()
            
            Text(value)
                .foregroundColor(AppTheme.primaryText)
                .fontWeight(.medium)
        }
    }
}

struct ThemedList<Content: View>: View {
    let content: Content
    
    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    var body: some View {
        List {
            content
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(AppTheme.primaryBackground)
    }
}

struct ThemedNavigationLink<Destination: View, Label: View>: View {
    let destination: Destination
    let label: Label
    
    init(destination: Destination, @ViewBuilder label: () -> Label) {
        self.destination = destination
        self.label = label()
    }
    
    var body: some View {
        NavigationLink(destination: destination) {
            label
                .padding(.vertical, 4)
        }
        .listRowBackground(AppTheme.cardBackground)
        .listRowSeparator(.hidden)
    }
}

// MARK: - Preview Helpers

#Preview("Themed Components") {
    VStack(spacing: 20) {
        ThemedButton(title: "Primary Button", action: {})
        ThemedSecondaryButton(title: "Secondary Button", action: {})
        
        ThemedCardView {
            VStack {
                Text("Card Content")
                    .foregroundColor(AppTheme.primaryText)
            }
        }
        
        StatusBadge(text: "In Progress", color: AppTheme.info)
        
        MetricCard(title: "Scans", value: "12", icon: "arkit", color: AppTheme.success)
        
        ProgressIndicator(progress: 0.7, color: AppTheme.success)
    }
    .padding()
    .themedBackground()
}
