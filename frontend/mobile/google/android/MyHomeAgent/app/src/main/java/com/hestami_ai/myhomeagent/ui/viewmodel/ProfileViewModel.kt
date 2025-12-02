package com.hestami_ai.myhomeagent.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.hestami_ai.myhomeagent.auth.AuthManager
import com.hestami_ai.myhomeagent.data.model.User
import com.hestami_ai.myhomeagent.data.network.ApiService
import com.hestami_ai.myhomeagent.data.network.ChangePasswordRequest
import com.hestami_ai.myhomeagent.data.network.NetworkModule
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import timber.log.Timber

/**
 * UI state for the Profile screen.
 */
data class ProfileUiState(
    val user: User? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    val passwordChangeSuccess: Boolean = false
)

/**
 * ViewModel for the Profile screen.
 */
class ProfileViewModel(application: Application) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    private val authManager = AuthManager.getInstance(application)
    private val apiService: ApiService = NetworkModule.provideApiService()

    /**
     * Load user profile from the API.
     */
    fun loadProfile() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                val response = apiService.getProfile()
                if (response.isSuccessful) {
                    val user = response.body()
                    _uiState.update { it.copy(user = user, isLoading = false) }
                    Timber.d("Profile loaded successfully: ${user?.email}")
                } else {
                    _uiState.update { 
                        it.copy(
                            isLoading = false, 
                            error = "Failed to load profile"
                        ) 
                    }
                    Timber.e("Failed to load profile: ${response.code()}")
                }
            } catch (e: Exception) {
                _uiState.update { 
                    it.copy(
                        isLoading = false, 
                        error = "Network error: ${e.message}"
                    ) 
                }
                Timber.e(e, "Error loading profile")
            }
        }
    }

    /**
     * Change user password.
     */
    fun changePassword(currentPassword: String, newPassword: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null, passwordChangeSuccess = false) }

            try {
                val request = ChangePasswordRequest(
                    currentPassword = currentPassword,
                    newPassword = newPassword
                )
                val response = apiService.changePassword(request)
                
                if (response.isSuccessful) {
                    _uiState.update { 
                        it.copy(
                            isLoading = false, 
                            passwordChangeSuccess = true,
                            error = null
                        ) 
                    }
                    Timber.i("Password changed successfully")
                } else {
                    val errorMessage = when (response.code()) {
                        400 -> "Current password is incorrect"
                        401 -> "Session expired. Please sign in again."
                        else -> "Failed to change password"
                    }
                    _uiState.update { 
                        it.copy(
                            isLoading = false, 
                            error = errorMessage
                        ) 
                    }
                    Timber.e("Failed to change password: ${response.code()}")
                }
            } catch (e: Exception) {
                _uiState.update { 
                    it.copy(
                        isLoading = false, 
                        error = "Network error: ${e.message}"
                    ) 
                }
                Timber.e(e, "Error changing password")
            }
        }
    }

    /**
     * Logout the user.
     */
    fun logout() {
        authManager.logout()
        Timber.i("User logged out from profile")
    }
}
