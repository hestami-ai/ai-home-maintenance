import SwiftUI

struct SharedSearchBar: View {
    @Binding var text: String
    @State private var isEditing = false
    
    var body: some View {
        HStack {
            TextField("Search...", text: $text)
                .disableInputAssistant()
                .padding(7)
                .padding(.horizontal, 25)
                .background(AppTheme.cardBackground)
                .cornerRadius(8)
                .foregroundColor(AppTheme.primaryText)
                .overlay(
                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(AppTheme.secondaryText)
                            .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
                            .padding(.leading, 8)
                        
                        if isEditing && !text.isEmpty {
                            Button(action: {
                                text = ""
                            }) {
                                Image(systemName: "multiply.circle.fill")
                                    .foregroundColor(AppTheme.secondaryText)
                                    .padding(.trailing, 8)
                            }
                        }
                    }
                )
                .onTapGesture {
                    isEditing = true
                }
            
            if isEditing {
                Button(action: {
                    isEditing = false
                    text = ""
                    // Dismiss keyboard
                    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                }) {
                    Text("Cancel")
                        .foregroundColor(AppTheme.accentColor)
                }
                .padding(.trailing, 10)
                .transition(.move(edge: .trailing))
                .animation(.default, value: isEditing)
            }
        }
    }
}
