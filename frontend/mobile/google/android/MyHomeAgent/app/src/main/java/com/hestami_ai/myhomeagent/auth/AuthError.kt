package com.hestami_ai.myhomeagent.auth

/**
 * Authentication error types matching iOS AuthError implementation.
 * Uses classes instead of objects to avoid serialization warnings.
 */
sealed class AuthError(message: String, cause: Throwable? = null) : Exception(message, cause) {
    
    class NoRefreshToken : AuthError("No refresh token available. Please log in again.")
    
    class RefreshFailed : AuthError("Failed to refresh authentication. Please log in again.")
    
    class LoginFailed : AuthError("Login failed. Please check your credentials and try again.")
    
    class NetworkError(cause: Throwable) : AuthError(cause.message ?: "Network error occurred.", cause)
    
    class CredentialsNotFound : AuthError("No stored credentials found. Please log in with your email and password.")
    
    class BiometricError(message: String) : AuthError(message)
    
    class BiometricsFailed : AuthError("Biometric authentication failed. Please try again or use your password.")
    
    class NoSessionId : AuthError("No session ID found. Please log in again.")
    
    class SessionExpired : AuthError("Your session has expired. Please log in again.")
    
    class RegistrationFailed : AuthError("Registration failed. Please try again.")
    
    @Suppress("unused")
    companion object {
        val LoginFailed = LoginFailed()
        val RegistrationFailed = RegistrationFailed()
        val CredentialsNotFound = CredentialsNotFound()
        val BiometricsFailed = BiometricsFailed()
        val RefreshFailed = RefreshFailed()
        val NoRefreshToken = NoRefreshToken()
        val NoSessionId = NoSessionId()
        val SessionExpired = SessionExpired()
        
        fun NetworkError(cause: Throwable) = AuthError.NetworkError(cause)
        fun BiometricError(message: String) = AuthError.BiometricError(message)
    }
}
