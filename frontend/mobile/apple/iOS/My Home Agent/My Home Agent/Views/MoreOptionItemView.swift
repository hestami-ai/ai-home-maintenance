import SwiftUI

struct MoreOptionItemView: View {
    let icon: String
    let title: String
    let description: String
    
    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(AppTheme.buttonBackground)
                .frame(width: 40, height: 40)
                .background(AppTheme.cardBackground)
                .cornerRadius(8)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(AppTheme.borderColor, lineWidth: 1)
                )
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(AppTheme.bodyFont.bold())
                    .foregroundColor(AppTheme.primaryText)
                
                Text(description)
                    .font(AppTheme.captionFont)
                    .foregroundColor(AppTheme.secondaryText)
                    .lineLimit(2)
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(AppTheme.secondaryText)
        }
        .padding()
        .background(AppTheme.cardBackground)
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(AppTheme.borderColor, lineWidth: 1)
        )
    }
}
