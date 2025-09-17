import SwiftUI

struct PropertyStatView: View {
    let icon: String
    let title: String
    let value: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .foregroundColor(AppTheme.accentColor)
                
                Text(title)
                    .font(AppTheme.captionFont)
                    .foregroundColor(AppTheme.secondaryText)
            }
            
            Text(value)
                .font(AppTheme.bodyFont.bold())
                .foregroundColor(AppTheme.primaryText)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.cardBackground)
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(AppTheme.borderColor, lineWidth: 1)
        )
    }
}

struct PropertyStatView_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            AppTheme.primaryBackground.edgesIgnoringSafeArea(.all)
            
            VStack(spacing: 20) {
                PropertyStatView(icon: "square.fill", title: "Square Footage", value: "2,500 sq ft")
                PropertyStatView(icon: "bed.double.fill", title: "Bedrooms", value: "4")
                PropertyStatView(icon: "shower.fill", title: "Bathrooms", value: "2.5")
                PropertyStatView(icon: "calendar", title: "Year Built", value: "2010")
            }
            .padding()
        }
        .preferredColorScheme(.dark)
    }
}
