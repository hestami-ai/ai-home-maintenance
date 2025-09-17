import SwiftUI
import UIKit

// Enhanced SwiftUI modifier to disable autocorrection and input assistant
struct DisableInputAssistant: ViewModifier {
    func body(content: Content) -> some View {
        content
            .disableAutocorrection(true)
            .autocapitalization(.none)
            .modifier(DisableInputAssistantModifier())
    }
}

extension View {
    func disableInputAssistant() -> some View {
        self.modifier(DisableInputAssistant())
    }
}