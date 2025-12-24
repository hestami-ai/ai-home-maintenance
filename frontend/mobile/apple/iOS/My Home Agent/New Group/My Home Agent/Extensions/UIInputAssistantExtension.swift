import UIKit
import SwiftUI

// Extension to disable the system input assistant view that appears above the keyboard
extension UITextField {
    // This method disables the input assistant view by setting its height to zero
    @objc func disableInputAssistant() {
        // Find the input assistant view in the view hierarchy
        let inputAssistantItem = self.inputAssistantItem
        
        // Set the leading/trailing bar groups to empty to remove buttons
        inputAssistantItem.leadingBarButtonGroups = []
        inputAssistantItem.trailingBarButtonGroups = []
        
        // The system will try to apply a height constraint of 72 points to the input assistant view
        // We need to find this view and modify its constraints
        DispatchQueue.main.async {
            // Look for the SystemInputAssistantView in the app's window hierarchy
            if let window = UIApplication.getKeyWindow(),
               let _ = window.viewWithTag(38473829) { // Using a unique tag to identify our view
                return // Already set up
            }
            
            // Find the SystemInputAssistantView in the view hierarchy
            for window in UIApplication.getAllWindows() {
                window.subviews.forEach { view in
                    // SystemInputAssistantView doesn't have a public API, so we identify it by its constraints
                    view.subviews.forEach { subview in
                        if String(describing: type(of: subview)).contains("InputAssistant") {
                            // Found the input assistant view
                            subview.tag = 38473829 // Mark it with a unique tag
                            
                            // Remove the height constraint
                            for constraint in subview.constraints {
                                if constraint.identifier == "assistantHeight" {
                                    constraint.isActive = false
                                    
                                    // Add a new height constraint with zero height
                                    let zeroHeightConstraint = NSLayoutConstraint(
                                        item: subview,
                                        attribute: .height,
                                        relatedBy: .equal,
                                        toItem: nil,
                                        attribute: .notAnAttribute,
                                        multiplier: 1,
                                        constant: 0
                                    )
                                    zeroHeightConstraint.identifier = "assistantZeroHeight"
                                    zeroHeightConstraint.priority = UILayoutPriority(999) // High but not required
                                    subview.addConstraint(zeroHeightConstraint)
                                    
                                    // Force layout update
                                    subview.setNeedsLayout()
                                    subview.layoutIfNeeded()
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

extension UITextView {
    // Same implementation for UITextView
    @objc func disableInputAssistant() {
        // Find the input assistant item
        let inputAssistantItem = self.inputAssistantItem
        
        // Set the leading/trailing bar groups to empty to remove buttons
        inputAssistantItem.leadingBarButtonGroups = []
        inputAssistantItem.trailingBarButtonGroups = []
        
        // The rest of the implementation is the same as UITextField
        DispatchQueue.main.async {
            // Look for the SystemInputAssistantView in the app's window hierarchy
            if let window = UIApplication.getKeyWindow(),
               let _ = window.viewWithTag(38473829) { // Using a unique tag to identify our view
                return // Already set up
            }
            
            // Find the SystemInputAssistantView in the view hierarchy
            for window in UIApplication.getAllWindows() {
                window.subviews.forEach { view in
                    view.subviews.forEach { subview in
                        if String(describing: type(of: subview)).contains("InputAssistant") {
                            // Found the input assistant view
                            subview.tag = 38473829 // Mark it with a unique tag
                            
                            // Remove the height constraint
                            for constraint in subview.constraints {
                                if constraint.identifier == "assistantHeight" {
                                    constraint.isActive = false
                                    
                                    // Add a new height constraint with zero height
                                    let zeroHeightConstraint = NSLayoutConstraint(
                                        item: subview,
                                        attribute: .height,
                                        relatedBy: .equal,
                                        toItem: nil,
                                        attribute: .notAnAttribute,
                                        multiplier: 1,
                                        constant: 0
                                    )
                                    zeroHeightConstraint.identifier = "assistantZeroHeight"
                                    zeroHeightConstraint.priority = UILayoutPriority(999) // High but not required
                                    subview.addConstraint(zeroHeightConstraint)
                                    
                                    // Force layout update
                                    subview.setNeedsLayout()
                                    subview.layoutIfNeeded()
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// SwiftUI wrapper for UITextField with input assistant disabled
struct InputAssistantDisabledTextField: UIViewRepresentable {
    @Binding var text: String
    var placeholder: String
    var keyboardType: UIKeyboardType = .default
    
    func makeUIView(context: Context) -> UITextField {
        let textField = UITextField()
        textField.delegate = context.coordinator
        textField.placeholder = placeholder
        textField.keyboardType = keyboardType
        textField.disableInputAssistant()
        return textField
    }
    
    func updateUIView(_ uiView: UITextField, context: Context) {
        uiView.text = text
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    class Coordinator: NSObject, UITextFieldDelegate {
        var parent: InputAssistantDisabledTextField
        
        init(_ parent: InputAssistantDisabledTextField) {
            self.parent = parent
        }
        
        func textFieldDidChangeSelection(_ textField: UITextField) {
            parent.text = textField.text ?? ""
        }
    }
}

// SwiftUI modifier to apply the input assistant disabling
struct DisableInputAssistantModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(
                // Hidden view to trigger the input assistant disabling
                Color.clear
                    .frame(width: 0, height: 0)
                    .onAppear {
                        // Find all text fields and disable their input assistants
                        NotificationCenter.default.addObserver(forName: UIResponder.keyboardWillShowNotification, object: nil, queue: .main) { _ in
                            // When keyboard appears, find the first responder
                            if let window = UIApplication.getKeyWindow() {
                                // Find the first responder
                                if let textField = findFirstResponder(in: window) as? UITextField {
                                    textField.disableInputAssistant()
                                } else if let textView = findFirstResponder(in: window) as? UITextView {
                                    textView.disableInputAssistant()
                                }
                            }
                        }
                    }
            )
    }
    
    // Helper function to find the first responder in the view hierarchy
    private func findFirstResponder(in view: UIView) -> UIView? {
        if view.isFirstResponder {
            return view
        }
        
        for subview in view.subviews {
            if let firstResponder = findFirstResponder(in: subview) {
                return firstResponder
            }
        }
        
        return nil
    }
}

// View extension to make it easy to use
extension View {
    func disableSystemInputAssistant() -> some View {
        self.modifier(DisableInputAssistantModifier())
    }
}
