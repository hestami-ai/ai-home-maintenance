package com.hestami_ai.myhomeagent.ui.viewmodel

import android.app.Application
import android.util.Log
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.hestami_ai.myhomeagent.auth.AuthError
import com.hestami_ai.myhomeagent.auth.AuthManager
import com.hestami_ai.myhomeagent.data.model.User
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Login screen UI state.
 */
data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val rememberMe: Boolean = false,
    val isLoading: Boolean = false,
    val error: String? = null,
    val isAuthenticated: Boolean = false,
    val canUseBiometrics: Boolean = false,
    val user: User? = null
)

/**
 * ViewModel for the login screen.
 * Matches iOS LoginViewModel.swift implementation.
 */
class LoginViewModel(application: Application) : AndroidViewModel(application) {

    companion object {
        private const val TAG = "LoginViewModel"
    }

    private val authManager = AuthManager.getInstance(application)

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    init {
        checkAuthentication()
    }

    fun updateEmail(email: String) {
        _uiState.value = _uiState.value.copy(email = email, error = null)
    }

    fun updatePassword(password: String) {
        _uiState.value = _uiState.value.copy(password = password, error = null)
    }

    fun updateRememberMe(rememberMe: Boolean) {
        _uiState.value = _uiState.value.copy(rememberMe = rememberMe)
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    /**
     * Perform login with email and password.
     */
    fun login() {
        val state = _uiState.value
        Log.i(TAG, "Starting login process")

        if (state.email.isBlank() || state.password.isBlank()) {
            _uiState.value = state.copy(error = "Please enter email and password")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            try {
                val user = authManager.login(
                    email = state.email,
                    password = state.password,
                    rememberMe = state.rememberMe
                )
                Log.i(TAG, "Login successful")
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isAuthenticated = true,
                    user = user
                )
            } catch (e: AuthError) {
                Log.e(TAG, "Login failed: ${e.message}")
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message
                )
            } catch (e: Exception) {
                Log.e(TAG, "Login failed with unexpected error: ${e.message}")
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "An unexpected error occurred"
                )
            }
        }
    }

    /**
     * Perform login with biometrics.
     */
    fun loginWithBiometrics(activity: FragmentActivity) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            try {
                val user = authManager.authenticateWithBiometrics(activity)
                Log.i(TAG, "Biometric login successful")
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isAuthenticated = true,
                    user = user
                )
            } catch (e: AuthError) {
                Log.e(TAG, "Biometric login failed: ${e.message}")
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message
                )
            } catch (e: Exception) {
                Log.e(TAG, "Biometric login failed with unexpected error: ${e.message}")
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "Biometric authentication failed"
                )
            }
        }
    }

    /**
     * Check if user is already authenticated.
     */
    private fun checkAuthentication() {
        val isAuthenticated = authManager.isAuthenticated
        val storedEmail = authManager.storedEmail ?: ""
        val rememberMe = authManager.isRememberMeEnabled
        val canUseBiometrics = authManager.canUseBiometricAuthentication(getApplication())

        _uiState.value = _uiState.value.copy(
            email = storedEmail,
            rememberMe = rememberMe,
            isAuthenticated = isAuthenticated,
            canUseBiometrics = canUseBiometrics
        )
    }

    /**
     * Logout the user.
     */
    fun logout() {
        authManager.logout()
        _uiState.value = LoginUiState()
    }
}
