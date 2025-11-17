import Foundation
import SwiftUI

@MainActor
class SignupViewModel: ObservableObject {
    @Published var email = ""
    @Published var password = ""
    @Published var confirmPassword = ""
    @Published var firstName = ""
    @Published var lastName = ""
    @Published var phoneNumber = ""
    @Published var userRole = "PROPERTY_OWNER" // Default role
    @Published var isLoading = false
    @Published var error: Error?
    @Published var showErrorAlert = false
    @Published var registrationSuccessful = false
    
    // Form validation
    var passwordsMatch: Bool {
        password == confirmPassword || confirmPassword.isEmpty
    }
    
    var formValid: Bool {
        !email.isEmpty &&
        !password.isEmpty &&
        !confirmPassword.isEmpty &&
        !firstName.isEmpty &&
        !lastName.isEmpty &&
        !phoneNumber.isEmpty &&
        passwordsMatch
    }
    
    func register() async {
        print("📝 SignupViewModel: Starting registration process")
        
        guard formValid else {
            error = NSError(domain: "SignupViewModel", code: 1, userInfo: [NSLocalizedDescriptionKey: "Please fill in all fields"])
            showErrorAlert = true
            return
        }
        
        guard passwordsMatch else {
            error = NSError(domain: "SignupViewModel", code: 2, userInfo: [NSLocalizedDescriptionKey: "Passwords do not match"])
            showErrorAlert = true
            return
        }
        
        isLoading = true
        error = nil
        
        do {
            print("📝 SignupViewModel: Calling AuthManager.register")
            _ = try await AuthManager.shared.register(
                email: email,
                password: password,
                confirmPassword: confirmPassword,
                firstName: firstName,
                lastName: lastName,
                phoneNumber: phoneNumber,
                userRole: userRole
            )
            
            print("✅ SignupViewModel: Registration successful")
            registrationSuccessful = true
            isLoading = false
        } catch {
            print("❌ SignupViewModel: Registration failed with error: \(error)")
            print("❌ SignupViewModel: Error description: \(error.localizedDescription)")
            
            // Store the error for display
            self.error = error
            showErrorAlert = true
            isLoading = false
        }
    }
}
