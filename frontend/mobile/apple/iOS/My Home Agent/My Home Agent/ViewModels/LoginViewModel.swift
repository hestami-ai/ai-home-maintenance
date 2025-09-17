import Foundation
import SwiftUI

@MainActor
class LoginViewModel: ObservableObject {
    @Published var email = ""
    @Published var password = ""
    @Published var rememberMe = false
    @Published var isLoading = false
    @Published var error: Error?
    @Published var isAuthenticated = false
    @Published var canUseBiometrics = false
    @Published var showErrorAlert = false
    
    func login() async {
        print("📝 LoginViewModel: Starting login process")
        print("📝 LoginViewModel: Email: \(email), RememberMe: \(rememberMe)")
        isLoading = true
        error = nil
        
        do {
            print("📝 LoginViewModel: Calling AuthManager.login")
            _ = try await AuthManager.shared.login(email: email, password: password, rememberMe: rememberMe)
            print("📝 LoginViewModel: Login successful")
            isAuthenticated = true
            isLoading = false
        } catch {
            print("❌ LoginViewModel: Login failed with error: \(error)")
            print("❌ LoginViewModel: Error description: \(error.localizedDescription)")
            
            // Store the error for display
            self.error = error
            showErrorAlert = true
            isLoading = false
        }
    }
    
    func loginWithBiometrics() async {
        guard AuthManager.shared.canUseBiometricAuthentication() else {
            error = AuthError.biometricError("Biometric authentication not available")
            showErrorAlert = true
            return
        }
        
        isLoading = true
        error = nil
        
        do {
            _ = try await AuthManager.shared.authenticateWithBiometrics()
            isAuthenticated = true
            isLoading = false
        } catch {
            // Store the error for display
            self.error = error
            showErrorAlert = true
            isLoading = false
        }
    }
    
    func logout() {
        AuthManager.shared.logout()
        isAuthenticated = false
    }
    
    // Check if user is already authenticated
    func checkAuthentication() {
        isAuthenticated = AuthManager.shared.isAuthenticated
        
        // Auto-fill email if stored
        if let storedEmail = AuthManager.shared.storedEmail {
            email = storedEmail
        }
        
        // Set remember me state
        rememberMe = AuthManager.shared.isRememberMeEnabled
        
        // Check if biometric authentication is available
        canUseBiometrics = AuthManager.shared.canUseBiometricAuthentication()
    }
}