import SwiftUI

// MARK: - Card Container
struct CardView<Content: View>: View {
    let content: Content
    var padding: CGFloat = 12
    
    init(padding: CGFloat = 12, @ViewBuilder content: () -> Content) {
        self.padding = padding
        self.content = content()
    }
    
    var body: some View {
        content
            .padding(padding)
            .background(AppTheme.cardBackground)
            .cornerRadius(AppTheme.cornerRadius)
            .overlay(
                RoundedRectangle(cornerRadius: AppTheme.cornerRadius)
                    .stroke(AppTheme.borderColor, lineWidth: 1)
            )
    }
}

// MARK: - Unified Status Badge
struct UnifiedStatusBadge: View {
    let text: String
    let color: Color
    var style: StatusBadgeStyle = .pill
    
    enum StatusBadgeStyle {
        case pill
        case dot
    }
    
    var body: some View {
        switch style {
        case .pill:
            Text(text)
                .font(.caption)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(color.opacity(0.2))
                .foregroundColor(color)
                .cornerRadius(8)
        case .dot:
            HStack(spacing: 4) {
                Circle()
                    .fill(color)
                    .frame(width: 8, height: 8)
                
                Text(text)
                    .font(.caption2)
                    .foregroundColor(AppTheme.secondaryText)
            }
        }
    }
}

// MARK: - Unified Empty State
struct UnifiedEmptyStateView: View {
    let icon: String
    let title: String
    let message: String
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil
    
    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            
            Image(systemName: icon)
                .font(.system(size: 60))
                .foregroundColor(AppTheme.secondaryText)
                .padding()
                .background(Circle().fill(AppTheme.cardBackground))
                .overlay(
                    Circle()
                        .stroke(AppTheme.borderColor, lineWidth: 1)
                )
                .padding()
            
            Text(title)
                .font(AppTheme.titleFont)
                .foregroundColor(AppTheme.primaryText)
            
            Text(message)
                .font(AppTheme.bodyFont)
                .foregroundColor(AppTheme.secondaryText)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            
            if let actionTitle = actionTitle, let action = action {
                Button(action: action) {
                    Text(actionTitle)
                        .font(AppTheme.bodyFont.bold())
                        .foregroundColor(AppTheme.buttonText)
                        .padding()
                        .padding(.horizontal, 20)
                        .background(AppTheme.buttonBackground)
                        .cornerRadius(10)
                }
                .padding(.top, 10)
            }
            
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
}

// MARK: - Standard Button Styles
struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AppTheme.bodyFont.bold())
            .foregroundColor(AppTheme.buttonText)
            .frame(maxWidth: .infinity)
            .padding()
            .background(AppTheme.buttonBackground)
            .cornerRadius(AppTheme.cornerRadius)
            .opacity(configuration.isPressed ? 0.8 : 1.0)
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AppTheme.bodyFont.bold())
            .foregroundColor(AppTheme.buttonBackground) // Use primary color for text
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color.clear)
            .cornerRadius(AppTheme.cornerRadius)
            .overlay(
                RoundedRectangle(cornerRadius: AppTheme.cornerRadius)
                    .stroke(AppTheme.buttonBackground, lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.6 : 1.0)
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
    }
}

struct DestructiveButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AppTheme.bodyFont.bold())
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding()
            .background(AppTheme.errorColor)
            .cornerRadius(AppTheme.cornerRadius)
            .opacity(configuration.isPressed ? 0.8 : 1.0)
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
    }
}

// MARK: - Convenience Extensions
extension ButtonStyle where Self == PrimaryButtonStyle {
    static var primary: PrimaryButtonStyle { PrimaryButtonStyle() }
}

extension ButtonStyle where Self == SecondaryButtonStyle {
    static var secondary: SecondaryButtonStyle { SecondaryButtonStyle() }
}

extension ButtonStyle where Self == DestructiveButtonStyle {
    static var destructive: DestructiveButtonStyle { DestructiveButtonStyle() }
}
