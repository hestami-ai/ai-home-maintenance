package com.hestami_ai.myhomeagent.ui.viewmodel

import android.app.Application
import android.util.Log
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
 * Signup screen UI state.
 */
data class SignupUiState(
    val email: String = "",
    val password: String = "",
    val confirmPassword: String = "",
    val firstName: String = "",
    val lastName: String = "",
    val phoneNumber: String = "",
    val userRole: String = "PROPERTY_OWNER",
    val isLoading: Boolean = false,
    val error: String? = null,
    val isRegistered: Boolean = false,
    val user: User? = null
)

/**
 * ViewModel for the signup screen.
 * Matches iOS SignupViewModel.swift implementation.
 */
class SignupViewModel(application: Application) : AndroidViewModel(application) {

    companion object {
        private const val TAG = "SignupViewModel"
    }

    private val authManager = AuthManager.getInstance(application)

    private val _uiState = MutableStateFlow(SignupUiState())
    val uiState: StateFlow<SignupUiState> = _uiState.asStateFlow()

    fun updateEmail(email: String) {
        _uiState.value = _uiState.value.copy(email = email, error = null)
    }

    fun updatePassword(password: String) {
        _uiState.value = _uiState.value.copy(password = password, error = null)
    }

    fun updateConfirmPassword(confirmPassword: String) {
        _uiState.value = _uiState.value.copy(confirmPassword = confirmPassword, error = null)
    }

    fun updateFirstName(firstName: String) {
        _uiState.value = _uiState.value.copy(firstName = firstName, error = null)
    }

    fun updateLastName(lastName: String) {
        _uiState.value = _uiState.value.copy(lastName = lastName, error = null)
    }

    fun updatePhoneNumber(phoneNumber: String) {
        _uiState.value = _uiState.value.copy(phoneNumber = phoneNumber, error = null)
    }

    fun updateUserRole(userRole: String) {
        _uiState.value = _uiState.value.copy(userRole = userRole, error = null)
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    /**
     * Validate form fields.
     */
    private fun validateForm(): String? {
        val state = _uiState.value

        if (state.email.isBlank()) {
            return "Email is required"
        }
        if (!android.util.Patterns.EMAIL_ADDRESS.matcher(state.email).matches()) {
            return "Please enter a valid email address"
        }
        if (state.password.isBlank()) {
            return "Password is required"
        }
        if (state.password.length < 8) {
            return "Password must be at least 8 characters"
        }
        if (state.password != state.confirmPassword) {
            return "Passwords do not match"
        }
        if (state.firstName.isBlank()) {
            return "First name is required"
        }
        if (state.lastName.isBlank()) {
            return "Last name is required"
        }
        if (state.phoneNumber.isBlank()) {
            return "Phone number is required"
        }

        return null
    }

    /**
     * Perform registration.
     */
    fun register() {
        Log.i(TAG, "Starting registration process")

        val validationError = validateForm()
        if (validationError != null) {
            _uiState.value = _uiState.value.copy(error = validationError)
            return
        }

        val state = _uiState.value

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            try {
                val user = authManager.register(
                    email = state.email,
                    password = state.password,
                    confirmPassword = state.confirmPassword,
                    firstName = state.firstName,
                    lastName = state.lastName,
                    phoneNumber = state.phoneNumber,
                    userRole = state.userRole
                )
                Log.i(TAG, "Registration successful")
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isRegistered = true,
                    user = user
                )
            } catch (e: AuthError) {
                Log.e(TAG, "Registration failed: ${e.message}")
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message
                )
            } catch (e: Exception) {
                Log.e(TAG, "Registration failed with unexpected error: ${e.message}")
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "An unexpected error occurred"
                )
            }
        }
    }
}
