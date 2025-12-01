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
 * UI state for the add property screen.
 */
data class AddPropertyUiState(
    val title: String = "",
    val description: String = "",
    val address: String = "",
    val city: String = "",
    val state: String = "",
    val zipCode: String = "",
    val propertyType: String = "Single Family",
    val yearBuilt: String = "",
    val squareFootage: String = "",
    val bedrooms: String = "",
    val bathrooms: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val isSuccess: Boolean = false,
    val createdProperty: Property? = null
)

/**
 * Property type options.
 */
val propertyTypes = listOf(
    "Single Family",
    "Townhouse",
    "Condo",
    "Apartment",
    "Multi-Family",
    "Mobile Home",
    "Land",
    "Commercial",
    "Other"
)

/**
 * US States for dropdown.
 */
val usStates = listOf(
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
)

/**
 * ViewModel for adding a new property.
 */
class AddPropertyViewModel : ViewModel() {

    companion object {
        private const val TAG = "AddPropertyViewModel"
    }

    private val repository = PropertyRepository()

    private val _uiState = MutableStateFlow(AddPropertyUiState())
    val uiState: StateFlow<AddPropertyUiState> = _uiState.asStateFlow()

    fun updateTitle(value: String) {
        _uiState.value = _uiState.value.copy(title = value)
    }

    fun updateDescription(value: String) {
        _uiState.value = _uiState.value.copy(description = value)
    }

    fun updateAddress(value: String) {
        _uiState.value = _uiState.value.copy(address = value)
    }

    fun updateCity(value: String) {
        _uiState.value = _uiState.value.copy(city = value)
    }

    fun updateState(value: String) {
        _uiState.value = _uiState.value.copy(state = value)
    }

    fun updateZipCode(value: String) {
        _uiState.value = _uiState.value.copy(zipCode = value)
    }

    fun updatePropertyType(value: String) {
        _uiState.value = _uiState.value.copy(propertyType = value)
    }

    fun updateYearBuilt(value: String) {
        _uiState.value = _uiState.value.copy(yearBuilt = value)
    }

    fun updateSquareFootage(value: String) {
        _uiState.value = _uiState.value.copy(squareFootage = value)
    }

    fun updateBedrooms(value: String) {
        _uiState.value = _uiState.value.copy(bedrooms = value)
    }

    fun updateBathrooms(value: String) {
        _uiState.value = _uiState.value.copy(bathrooms = value)
    }

    /**
     * Validate the form fields.
     */
    private fun validateForm(): Boolean {
        val state = _uiState.value
        
        if (state.title.isBlank()) {
            _uiState.value = state.copy(error = "Property title is required")
            return false
        }
        if (state.address.isBlank()) {
            _uiState.value = state.copy(error = "Address is required")
            return false
        }
        if (state.city.isBlank()) {
            _uiState.value = state.copy(error = "City is required")
            return false
        }
        if (state.state.isBlank()) {
            _uiState.value = state.copy(error = "State is required")
            return false
        }
        if (state.zipCode.isBlank()) {
            _uiState.value = state.copy(error = "ZIP code is required")
            return false
        }
        if (state.zipCode.length < 5) {
            _uiState.value = state.copy(error = "Please enter a valid ZIP code")
            return false
        }
        
        return true
    }

    /**
     * Submit the property form.
     */
    fun submitProperty() {
        if (!validateForm()) return

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            val state = _uiState.value
            when (val result = repository.createProperty(
                title = state.title,
                description = state.description,
                address = state.address,
                city = state.city,
                state = state.state,
                zipCode = state.zipCode
            )) {
                is Result.Success -> {
                    Log.d(TAG, "Property created: ${result.data.id}")
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isSuccess = true,
                        createdProperty = result.data
                    )
                }
                is Result.Error -> {
                    Log.e(TAG, "Failed to create property: ${result.error.message}")
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.error.message
                    )
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

    /**
     * Reset the form.
     */
    fun resetForm() {
        _uiState.value = AddPropertyUiState()
    }
}
