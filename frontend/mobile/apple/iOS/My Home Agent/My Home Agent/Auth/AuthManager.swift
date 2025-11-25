import Foundation
import LocalAuthentication

enum AuthError: Error, LocalizedError {
    case noRefreshToken
    case refreshFailed
    case loginFailed
    case networkError(NetworkError)
    case credentialsNotFound
    case biometricError(String)
    case biometricsFailed
    case noSessionId
    case sessionExpired
    
    public var errorDescription: String? {
        switch self {
        case .noRefreshToken:
            return "No refresh token available. Please log in again."
        case .refreshFailed:
            return "Failed to refresh authentication. Please log in again."
        case .loginFailed:
            return "Login failed. Please check your credentials and try again."
        case .networkError(let error):
            return error.errorDescription
        case .credentialsNotFound:
            return "No stored credentials found. Please log in with your email and password."
        case .biometricError(let message):
            return "Biometric authentication failed: \(message)"
        case .biometricsFailed:
            return "Biometric authentication failed. Please try again or use your password."
        case .noSessionId:
            return "No session ID found. Please log in again."
        case .sessionExpired:
            return "Your session has expired. Please log in again."
        }    
    }
}

final class AuthManager {
    static let shared = AuthManager()
    
    private let keychainService = "com.hestami.app"
    private let accessTokenKey = "accessToken"
    private let refreshTokenKey = "refreshToken"
    private let sessionIdKey = "sessionId"
    private let emailKey = "userEmail"
    private let passwordKey = "userPassword"
    private let rememberMeKey = "rememberMe"
    // User ID key removed
    
    private init() {}
    
    // Access token getter/setter with secure Keychain storage
    var accessToken: String? {
        get {
            return KeychainWrapper.standard.string(forKey: accessTokenKey)
        }
        set {
            if let newValue = newValue {
                _ = KeychainWrapper.standard.set(newValue, forKey: accessTokenKey)
            } else {
                _ = KeychainWrapper.standard.removeObject(forKey: accessTokenKey)
            }
        }
    }
    
    // Refresh token getter/setter with secure Keychain storage
    var refreshToken: String? {
        get {
            return KeychainWrapper.standard.string(forKey: refreshTokenKey)
        }
        set {
            if let newValue = newValue {
                _ = KeychainWrapper.standard.set(newValue, forKey: refreshTokenKey)
            } else {
                _ = KeychainWrapper.standard.removeObject(forKey: refreshTokenKey)
            }
        }
    }
    
    // Session ID getter/setter with secure Keychain storage
    var sessionId: String? {
        get {
            return KeychainWrapper.standard.string(forKey: sessionIdKey)
        }
        set {
            if let newValue = newValue {
                _ = KeychainWrapper.standard.set(newValue, forKey: sessionIdKey)
            } else {
                _ = KeychainWrapper.standard.removeObject(forKey: sessionIdKey)
            }
        }
    }
    
    // Stored email getter/setter
    var storedEmail: String? {
        get {
            return KeychainWrapper.standard.string(forKey: emailKey)
        }
        set {
            if let newValue = newValue {
                _ = KeychainWrapper.standard.set(newValue, forKey: emailKey)
            } else {
                _ = KeychainWrapper.standard.removeObject(forKey: emailKey)
            }
        }
    }
    
    // Stored password getter/setter (only when Remember Me is enabled)
    var storedPassword: String? {
        get {
            return isRememberMeEnabled ? KeychainWrapper.standard.string(forKey: passwordKey) : nil
        }
        set {
            if let newValue = newValue, isRememberMeEnabled {
                _ = KeychainWrapper.standard.set(newValue, forKey: passwordKey)
            } else {
                _ = KeychainWrapper.standard.removeObject(forKey: passwordKey)
            }
        }
    }
    
    // Remember Me setting
    var isRememberMeEnabled: Bool {
        get {
            return UserDefaults.standard.bool(forKey: rememberMeKey)
        }
        set {
            UserDefaults.standard.set(newValue, forKey: rememberMeKey)
            if !newValue {
                // Clear stored password if Remember Me is disabled
                _ = KeychainWrapper.standard.removeObject(forKey: passwordKey)
            }
        }
    }
    
    // User ID property removed
    
    var isAuthenticated: Bool {
        // Consider the user authenticated if they have session cookies
        return NetworkManager.shared.hasSessionCookie()
    }
    
    // Validate if the current session is active by attempting to fetch the user profile
    func validateSession() async -> Bool {
        // First check if we have a session cookie
        guard NetworkManager.shared.hasSessionCookie() else {
            AppLogger.auth.debug("No session cookie found, session is invalid")
            return false
        }
        
        // If we have a cookie, verify it works by fetching the profile
        do {
            AppLogger.auth.debug("Validating session by fetching user profile")
            let _: User = try await NetworkManager.shared.request(
                endpoint: "/api/users/profile/", 
                method: .get,
                parameters: [:] // Empty parameters for POST request
            )
            AppLogger.auth.info("Session is valid")
            return true
        } catch {
            AppLogger.auth.warning("Session validation failed: \(error.localizedDescription, privacy: .public)")
            return false
        }
    }
    
    // Verify authentication setup by checking cookies and headers
    func verifyAuthenticationSetup() {
        #if DEBUG
        AppLogger.auth.debug("===== AUTHENTICATION VERIFICATION SUMMARY =====")
        AppLogger.auth.debug("isAuthenticated = \(self.isAuthenticated, privacy: .public)")
        
        // Use NetworkManager's cookie debugging
        NetworkManager.shared.debugCookies()
        
        AppLogger.auth.debug("===== END AUTHENTICATION VERIFICATION =====")
        #endif
    }
    
    // Login method with email and password
    func login(email: String, password: String, rememberMe: Bool = false) async throws -> User {
        AppLogger.debugSensitive("Attempting login with email", sensitiveData: email, category: AppLogger.auth)
        let parameters = ["email": email, "password": password]
        
        AppLogger.auth.debug("Sending login request to /api/users/login/")
        
        do {
            let loginResponse: LoginResponse = try await NetworkManager.shared.request(
                endpoint: "/api/users/login/",
                method: .post,
                parameters: parameters
            )
            
            AppLogger.auth.info("Login successful")
            
            // Store credentials if Remember Me is enabled
            self.isRememberMeEnabled = rememberMe
            self.storedEmail = email
            if rememberMe {
                self.storedPassword = password
            } else {
                self.storedPassword = nil
            }
            
            // Verify that we have a session cookie after login
            if !NetworkManager.shared.hasSessionCookie() {
                AppLogger.auth.error("Warning - No session cookie found after login")
                AppLogger.auth.error("Login failed - server did not provide a session cookie")
                
                // Debug cookies after failed login
                NetworkManager.shared.debugCookies()
                
                throw AuthError.loginFailed
            }
            
            // Debug cookies after successful login
            NetworkManager.shared.debugCookies()
            
            return loginResponse.user
        } catch let networkError as NetworkError {
            // Convert NetworkError to AuthError with better message
            AppLogger.error("Login failed due to network error", error: networkError, category: AppLogger.auth)
            throw AuthError.networkError(networkError)
        } catch {
            // Handle other errors
            AppLogger.error("Login failed", error: error, category: AppLogger.auth)
            throw AuthError.loginFailed
        }
    }
    
    // Biometric authentication
    func authenticateWithBiometrics() async throws -> User {
        guard let email = storedEmail, let password = storedPassword else {
            throw AuthError.credentialsNotFound
        }
        
        // Use the main login method to ensure proper session validation
        return try await login(email: email, password: password, rememberMe: true)
    }
    
    // Refresh token method - No longer used as server doesn't provide tokens
    func refreshAccessToken() async throws {
        // Since the server doesn't use tokens, we'll just re-authenticate the user
        guard let email = storedEmail, let password = storedPassword else {
            throw AuthError.refreshFailed
        }
        
        AppLogger.auth.debug("Refreshing authentication")
        
        // Re-login with stored credentials
        _ = try await login(email: email, password: password, rememberMe: isRememberMeEnabled)
        // Note: login method already refreshes cookies
    }
    
    // Logout method
    func logout() {
        // Keep email for convenience but remove password
        if !isRememberMeEnabled {
            storedPassword = nil
        }
        
        // Authentication is now based solely on cookies
        AppLogger.auth.info("Logging out")
        
        // Clear all cookies
        NetworkManager.shared.clearCookies()
    }
    
    // Check if biometric authentication is available
    func canUseBiometricAuthentication() -> Bool {
        let context = LAContext()
        var error: NSError?
        
        // Check if the device supports biometric authentication
        let canEvaluate = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        
        // Only return true if biometrics are available AND we have stored credentials
        return canEvaluate && storedEmail != nil && storedPassword != nil
    }
    
    // Register method for new user signup
    func register(
        email: String,
        password: String,
        confirmPassword: String,
        firstName: String,
        lastName: String,
        phoneNumber: String,
        userRole: String
    ) async throws -> User {
        AppLogger.debugSensitive("Attempting registration with email", sensitiveData: email, category: AppLogger.auth)
        
        let parameters: [String: Any] = [
            "email": email,
            "password": password,
            "confirm_password": confirmPassword,
            "first_name": firstName,
            "last_name": lastName,
            "phone_number": phoneNumber,
            "user_role": userRole,
            "service_provider": NSNull()
        ]
        
        AppLogger.auth.debug("Sending registration request to /api/users/register/")
        
        do {
            let registerResponse: RegisterResponse = try await NetworkManager.shared.request(
                endpoint: "/api/users/register/",
                method: .post,
                parameters: parameters
            )
            
            AppLogger.auth.info("Registration successful")
            return registerResponse.user
        } catch let networkError as NetworkError {
            AppLogger.error("Registration failed with network error", error: networkError, category: AppLogger.auth)
            throw AuthError.networkError(networkError)
        } catch {
            AppLogger.error("Registration failed", error: error, category: AppLogger.auth)
            throw AuthError.loginFailed
        }
    }
}

// Auth response models - Deprecated, use LoginResponse instead
struct AuthResponse: Decodable {
    let user: User
}

// RefreshResponse is no longer used as server doesn't provide tokens
struct RefreshResponse: Decodable {
    // Empty placeholder structure
}

// Registration response model
struct RegisterResponse: Decodable {
    let user: User
    let message: String?
}