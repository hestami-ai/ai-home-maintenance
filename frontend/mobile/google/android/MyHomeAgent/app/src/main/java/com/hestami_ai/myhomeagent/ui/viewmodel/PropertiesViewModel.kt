package com.hestami_ai.myhomeagent.ui.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hestami_ai.myhomeagent.data.model.Property
import com.hestami_ai.myhomeagent.data.network.Result
import com.hestami_ai.myhomeagent.data.repository.PropertyRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * UI state for the properties screen.
 */
data class PropertiesUiState(
    val properties: List<Property> = emptyList(),
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val error: String? = null,
    val selectedProperty: Property? = null
)

/**
 * ViewModel for the properties screen.
 * Matches iOS PropertiesViewModel.swift implementation.
 */
class PropertiesViewModel : ViewModel() {

    companion object {
        private const val TAG = "PropertiesViewModel"
    }

    private val repository = PropertyRepository()

    private val _uiState = MutableStateFlow(PropertiesUiState())
    val uiState: StateFlow<PropertiesUiState> = _uiState.asStateFlow()

    init {
        loadProperties()
    }

    /**
     * Load properties from the API.
     */
    fun loadProperties() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            when (val result = repository.getProperties()) {
                is Result.Success -> {
                    Log.d(TAG, "Loaded ${result.data.size} properties")
                    _uiState.value = _uiState.value.copy(
                        properties = result.data,
                        isLoading = false
                    )
                }
                is Result.Error -> {
                    Log.e(TAG, "Failed to load properties: ${result.error.message}")
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.error.message
                    )
                }
                is Result.Loading -> {
                    // Already handled above
                }
            }
        }
    }

    /**
     * Refresh properties (pull-to-refresh).
     */
    fun refreshProperties() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isRefreshing = true, error = null)

            when (val result = repository.getProperties()) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(
                        properties = result.data,
                        isRefreshing = false
                    )
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isRefreshing = false,
                        error = result.error.message
                    )
                }
                is Result.Loading -> {}
            }
        }
    }

    /**
     * Select a property for detail view.
     */
    fun selectProperty(property: Property) {
        _uiState.value = _uiState.value.copy(selectedProperty = property)
    }

    /**
     * Clear selected property.
     */
    fun clearSelectedProperty() {
        _uiState.value = _uiState.value.copy(selectedProperty = null)
    }

    /**
     * Delete a property.
     */
    fun deleteProperty(propertyId: String) {
        viewModelScope.launch {
            when (val result = repository.deleteProperty(propertyId)) {
                is Result.Success -> {
                    // Remove from local list
                    val updatedList = _uiState.value.properties.filter { it.id != propertyId }
                    _uiState.value = _uiState.value.copy(properties = updatedList)
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(error = result.error.message)
                }
                is Result.Loading -> {}
            }
        }
    }

    /**
     * Clear error state.
     */
    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}
