import Foundation
import SwiftUI
import OSLog

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
        AppLogger.auth.info("Starting login process")
        AppLogger.auth.debug("Email: \(self.email, privacy: .public), RememberMe: \(self.rememberMe, privacy: .public)")
        isLoading = true
        error = nil
        
        do {
            AppLogger.auth.debug("Calling AuthManager.login")
            _ = try await AuthManager.shared.login(email: email, password: password, rememberMe: rememberMe)
            AppLogger.auth.info("Login successful")
            isAuthenticated = true
            isLoading = false
        } catch {
            AppLogger.error("Login failed", error: error, category: AppLogger.auth)
            
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