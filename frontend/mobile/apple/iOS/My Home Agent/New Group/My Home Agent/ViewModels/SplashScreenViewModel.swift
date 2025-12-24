import Foundation
import SwiftUI
import OSLog

@MainActor
class SplashScreenViewModel: ObservableObject {
    @Published var isLoading = true
    @Published var showLoginView = false
    @Published var showMainApp = false
    
    func checkAuthenticationStatus() async {
        // Simulate a delay to show the splash screen
        try? await Task.sleep(nanoseconds: 2_000_000_000) // 2 seconds
        
        // Step 1: Try to validate the current session by fetching user profile
        if await AuthManager.shared.validateSession() {
            // Session is valid, show main app
            AppLogger.auth.info("Session is valid, proceeding to main app")
            showMainApp = true
            isLoading = false
            return
        }
        
        // Step 2: Session is not valid, try to login with stored credentials if available
        if AuthManager.shared.isAuthenticated {
            AppLogger.auth.info("Attempting to login with stored credentials")
            do {
                // Try to login with stored credentials
                if let email = AuthManager.shared.storedEmail, let password = AuthManager.shared.storedPassword {
                    _ = try await AuthManager.shared.login(email: email, password: password, rememberMe: AuthManager.shared.isRememberMeEnabled)
                    AppLogger.auth.info("Login with stored credentials successful")
                    showMainApp = true
                } else {
                    AppLogger.auth.warning("Stored credentials incomplete, showing login screen")
                    showLoginView = true
                }
            } catch {
                AppLogger.error("Login with stored credentials failed", error: error, category: AppLogger.auth)
                showLoginView = true
            }
        } else {
            // Step 3: No stored credentials, show login view
            AppLogger.auth.info("No stored credentials, showing login screen")
            showLoginView = true
        }
        
        isLoading = false
    }
}
