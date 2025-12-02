package com.hestami_ai.myhomeagent.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.core.content.edit
import androidx.fragment.app.FragmentActivity
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.hestami_ai.myhomeagent.data.model.User
import com.hestami_ai.myhomeagent.data.network.ApiService
import com.hestami_ai.myhomeagent.data.network.LoginRequest
import com.hestami_ai.myhomeagent.data.network.NetworkModule
import com.hestami_ai.myhomeagent.data.network.RegisterRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import timber.log.Timber
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Authentication manager handling login, logout, and credential storage.
 * Matches iOS AuthManager.swift implementation.
 */
class AuthManager private constructor(context: Context) {

    companion object {
        private const val PREFS_NAME = "auth_prefs"
        private const val KEY_EMAIL = "userEmail"
        private const val KEY_PASSWORD = "userPassword"
        private const val KEY_REMEMBER_ME = "rememberMe"

        @Volatile
        private var instance: AuthManager? = null

        fun getInstance(context: Context): AuthManager {
            return instance ?: synchronized(this) {
                instance ?: AuthManager(context.applicationContext).also { instance = it }
            }
        }
    }

    private val encryptedPrefs: SharedPreferences
    private val regularPrefs: SharedPreferences
    private val apiService: ApiService

    init {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        encryptedPrefs = EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )

        regularPrefs = context.getSharedPreferences("${PREFS_NAME}_regular", Context.MODE_PRIVATE)
        apiService = NetworkModule.provideApiService()
    }

    // ==================== Stored Credentials ====================

    var storedEmail: String?
        get() = encryptedPrefs.getString(KEY_EMAIL, null)
        set(value) {
            encryptedPrefs.edit {
                if (value != null) putString(KEY_EMAIL, value)
                else remove(KEY_EMAIL)
            }
        }

    var storedPassword: String?
        get() = if (isRememberMeEnabled) encryptedPrefs.getString(KEY_PASSWORD, null) else null
        set(value) {
            encryptedPrefs.edit {
                if (value != null && isRememberMeEnabled) putString(KEY_PASSWORD, value)
                else remove(KEY_PASSWORD)
            }
        }

    var isRememberMeEnabled: Boolean
        get() = regularPrefs.getBoolean(KEY_REMEMBER_ME, false)
        set(value) {
            regularPrefs.edit { putBoolean(KEY_REMEMBER_ME, value) }
            if (!value) {
                // Clear stored password if Remember Me is disabled
                encryptedPrefs.edit { remove(KEY_PASSWORD) }
            }
        }

    // ==================== Authentication State ====================

    /**
     * Check if user is currently authenticated (has valid session cookie).
     */
    val isAuthenticated: Boolean
        get() = NetworkModule.hasActiveSession()

    /**
     * Validate if the current session is active by fetching user profile.
     */
    suspend fun validateSession(): Boolean = withContext(Dispatchers.IO) {
        if (!NetworkModule.hasActiveSession()) {
            Timber.d("No session cookie found, session is invalid")
            return@withContext false
        }

        try {
            Timber.d("Validating session by fetching user profile")
            val response = apiService.getProfile()
            val isValid = response.isSuccessful
            Timber.i(if (isValid) "Session is valid" else "Session validation failed")
            isValid
        } catch (e: Exception) {
            Timber.w(e, "Session validation failed")
            false
        }
    }

    // ==================== Login ====================

    /**
     * Login with email and password.
     */
    suspend fun login(
        email: String,
        password: String,
        rememberMe: Boolean = false
    ): User = withContext(Dispatchers.IO) {
        Timber.d("Attempting login with email: ${email.take(3)}***")

        try {
            val response = apiService.login(LoginRequest(email, password))

            if (!response.isSuccessful) {
                Timber.e("Login failed with status: ${response.code()}")
                throw AuthError.LoginFailed
            }

            val loginResponse = response.body() ?: throw AuthError.LoginFailed
            Timber.i("Login successful for user: %s", loginResponse.user.email)

            // Store credentials if Remember Me is enabled
            isRememberMeEnabled = rememberMe
            storedEmail = email
            storedPassword = if (rememberMe) password else null

            // Verify session cookie was set
            if (!NetworkModule.hasActiveSession()) {
                Timber.e("Warning - No session cookie found after login")
                throw AuthError.LoginFailed
            }

            loginResponse.user
        } catch (e: AuthError) {
            throw e
        } catch (e: Exception) {
            Timber.e(e, "Login failed")
            throw AuthError.NetworkError(e)
        }
    }

    // ==================== Registration ====================

    /**
     * Register a new user.
     */
    suspend fun register(
        email: String,
        password: String,
        confirmPassword: String,
        firstName: String,
        lastName: String,
        phoneNumber: String,
        userRole: String
    ): User = withContext(Dispatchers.IO) {
        Timber.d("Attempting registration with email: ${email.take(3)}***")

        try {
            val request = RegisterRequest(
                email = email,
                password = password,
                confirmPassword = confirmPassword,
                firstName = firstName,
                lastName = lastName,
                phoneNumber = phoneNumber,
                userRole = userRole
            )

            val response = apiService.register(request)

            if (!response.isSuccessful) {
                Timber.e("Registration failed with status: ${response.code()}")
                throw AuthError.RegistrationFailed
            }

            val registerResponse = response.body() ?: throw AuthError.RegistrationFailed
            Timber.i("Registration successful for user: %s", registerResponse.user.email)

            registerResponse.user
        } catch (e: AuthError) {
            throw e
        } catch (e: Exception) {
            Timber.e(e, "Registration failed")
            throw AuthError.NetworkError(e)
        }
    }

    // ==================== Biometric Authentication ====================

    /**
     * Check if biometric authentication is available and credentials are stored.
     */
    fun canUseBiometricAuthentication(context: Context): Boolean {
        val biometricManager = BiometricManager.from(context)
        val canAuthenticate = biometricManager.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG or
            BiometricManager.Authenticators.BIOMETRIC_WEAK
        ) == BiometricManager.BIOMETRIC_SUCCESS

        return canAuthenticate && storedEmail != null && storedPassword != null
    }

    /**
     * Authenticate using biometrics and stored credentials.
     */
    suspend fun authenticateWithBiometrics(activity: FragmentActivity): User {
        val email = storedEmail ?: throw AuthError.CredentialsNotFound
        val password = storedPassword ?: throw AuthError.CredentialsNotFound

        // Show biometric prompt
        val authenticated = showBiometricPrompt(activity)
        if (!authenticated) {
            throw AuthError.BiometricsFailed
        }

        // Use stored credentials to login
        return login(email, password, rememberMe = true)
    }

    private suspend fun showBiometricPrompt(activity: FragmentActivity): Boolean =
        suspendCancellableCoroutine { continuation ->
            val executor = ContextCompat.getMainExecutor(activity)

            val callback = object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    continuation.resume(true)
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    if (continuation.isActive) {
                        continuation.resumeWithException(
                            AuthError.BiometricError(errString.toString())
                        )
                    }
                }

                override fun onAuthenticationFailed() {
                    // Don't resume here - user can retry
                    Timber.d("Biometric authentication attempt failed")
                }
            }

            val promptInfo = BiometricPrompt.PromptInfo.Builder()
                .setTitle("Authenticate")
                .setSubtitle("Use your fingerprint or face to sign in")
                .setNegativeButtonText("Cancel")
                .build()

            val biometricPrompt = BiometricPrompt(activity, executor, callback)
            biometricPrompt.authenticate(promptInfo)

            continuation.invokeOnCancellation {
                biometricPrompt.cancelAuthentication()
            }
        }

    // ==================== Logout ====================

    /**
     * Logout and clear session.
     */
    fun logout() {
        Timber.i("Logging out")

        // Keep email for convenience but remove password if Remember Me is disabled
        if (!isRememberMeEnabled) {
            storedPassword = null
        }

        // Clear session cookies
        NetworkModule.clearSession()
        Timber.i("User logged out")
    }

    // ==================== Token Refresh ====================

    /**
     * Refresh authentication using stored credentials.
     * Note: Server uses session cookies, not tokens.
     */
    @Suppress("unused")
    suspend fun refreshAuthentication() {
        val email = storedEmail ?: throw AuthError.RefreshFailed
        val password = storedPassword ?: throw AuthError.RefreshFailed

        Timber.d("Refreshing authentication")
        login(email, password, rememberMe = isRememberMeEnabled)
    }
}
