import SwiftUI
import UIKit

// Enhanced modifier for app-wide input settings that also disables the system input assistant
struct AppInputAssistantModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .disableAutocorrection(true)
            .autocapitalization(.none)
            .modifier(DisableInputAssistantModifier())
    }
}
