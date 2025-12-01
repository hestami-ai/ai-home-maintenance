package com.hestami_ai.myhomeagent.ui.viewmodel

import android.net.Uri
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hestami_ai.myhomeagent.data.model.Property
import com.hestami_ai.myhomeagent.data.model.ServiceRequest
import com.hestami_ai.myhomeagent.data.network.Result
import com.hestami_ai.myhomeagent.data.repository.PropertyRepository
import com.hestami_ai.myhomeagent.data.repository.ServiceRequestRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalTime
import java.util.UUID

/**
 * Service request categories.
 */
val serviceCategories = listOf(
    "PLUMBING",
    "ELECTRICAL",
    "HVAC",
    "ROOFING",
    "LANDSCAPING",
    "APPLIANCE",
    "FLOORING",
    "PAINTING",
    "GENERAL",
    "OTHER"
)

/**
 * Priority levels.
 */
val priorityLevels = listOf(
    "LOW",
    "MEDIUM",
    "HIGH",
    "URGENT"
)

data class TimeSlotInput(
    val id: String = UUID.randomUUID().toString(),
    val date: LocalDate,
    val startTime: LocalTime,
    val endTime: LocalTime
)

/**
 * UI state for the create service request screen.
 */
data class CreateServiceRequestUiState(
    val properties: List<Property> = emptyList(),
    val selectedProperty: Property? = null,
    val category: String = "HVAC", // Default to HVAC like iOS
    val title: String = "",
    val description: String = "",
    val priority: String = "MEDIUM",
    val isDiy: Boolean = false,
    
    // Scheduling
    val useSchedule: Boolean = false,
    val scheduledStart: LocalDate = LocalDate.now().plusDays(1),
    val scheduledStartTime: LocalTime = LocalTime.of(9, 0),
    val scheduledEnd: LocalDate = LocalDate.now().plusDays(1),
    val scheduledEndTime: LocalTime = LocalTime.of(17, 0),
    
    // Preferred Schedule
    val timeSlots: List<TimeSlotInput> = emptyList(),
    val isFlexible: Boolean = false,
    val scheduleNotes: String = "",
    
    // Media
    val mediaUris: List<Uri> = emptyList(),
    
    val isLoadingProperties: Boolean = false,
    val isSubmitting: Boolean = false,
    val error: String? = null,
    val isSuccess: Boolean = false,
    val createdRequest: ServiceRequest? = null
)

/**
 * ViewModel for creating a new service request.
 */
class CreateServiceRequestViewModel : ViewModel() {

    companion object {
        private const val TAG = "CreateServiceRequestVM"
    }

    private val propertyRepository = PropertyRepository()
    private val requestRepository = ServiceRequestRepository()

    private val _uiState = MutableStateFlow(CreateServiceRequestUiState())
    val uiState: StateFlow<CreateServiceRequestUiState> = _uiState.asStateFlow()

    init {
        loadProperties()
    }

    /**
     * Load user's properties for selection.
     */
    private fun loadProperties() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoadingProperties = true)

            when (val result = propertyRepository.getProperties()) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(
                        properties = result.data,
                        isLoadingProperties = false,
                        selectedProperty = result.data.firstOrNull()
                    )
                }
                is Result.Error -> {
                    Log.e(TAG, "Failed to load properties: ${result.error.message}")
                    _uiState.value = _uiState.value.copy(
                        isLoadingProperties = false,
                        error = "Failed to load properties"
                    )
                }
                is Result.Loading -> {}
            }
        }
    }

    fun selectProperty(property: Property) {
        _uiState.value = _uiState.value.copy(selectedProperty = property)
    }

    fun updateCategory(value: String) {
        _uiState.value = _uiState.value.copy(category = value)
    }

    fun updateTitle(value: String) {
        _uiState.value = _uiState.value.copy(title = value)
    }

    fun updateDescription(value: String) {
        _uiState.value = _uiState.value.copy(description = value)
    }

    fun updatePriority(value: String) {
        _uiState.value = _uiState.value.copy(priority = value)
    }

    fun updateIsDiy(value: Boolean) {
        _uiState.value = _uiState.value.copy(isDiy = value)
    }
    
    // Scheduling Updates
    fun updateUseSchedule(value: Boolean) {
        _uiState.value = _uiState.value.copy(useSchedule = value)
    }
    
    fun updateScheduledStart(date: LocalDate) {
        _uiState.value = _uiState.value.copy(scheduledStart = date)
        // Ensure end is not before start
        if (_uiState.value.scheduledEnd.isBefore(date)) {
            _uiState.value = _uiState.value.copy(scheduledEnd = date)
        }
    }
    
    fun updateScheduledStartTime(time: LocalTime) {
        _uiState.value = _uiState.value.copy(scheduledStartTime = time)
    }
    
    fun updateScheduledEnd(date: LocalDate) {
        _uiState.value = _uiState.value.copy(scheduledEnd = date)
    }
    
    fun updateScheduledEndTime(time: LocalTime) {
        _uiState.value = _uiState.value.copy(scheduledEndTime = time)
    }
    
    // Preferred Schedule Updates
    fun addTimeSlot(date: LocalDate, startTime: LocalTime, endTime: LocalTime) {
        val newSlot = TimeSlotInput(
            date = date,
            startTime = startTime,
            endTime = endTime
        )
        val currentSlots = _uiState.value.timeSlots.toMutableList()
        currentSlots.add(newSlot)
        _uiState.value = _uiState.value.copy(timeSlots = currentSlots)
    }
    
    fun removeTimeSlot(id: String) {
        val currentSlots = _uiState.value.timeSlots.filter { it.id != id }
        _uiState.value = _uiState.value.copy(timeSlots = currentSlots)
    }
    
    fun updateIsFlexible(value: Boolean) {
        _uiState.value = _uiState.value.copy(isFlexible = value)
    }
    
    fun updateScheduleNotes(value: String) {
        _uiState.value = _uiState.value.copy(scheduleNotes = value)
    }
    
    // Media Updates
    fun addMedia(uris: List<Uri>) {
        val currentMedia = _uiState.value.mediaUris.toMutableList()
        currentMedia.addAll(uris)
        _uiState.value = _uiState.value.copy(mediaUris = currentMedia)
    }
    
    fun removeMedia(uri: Uri) {
        val currentMedia = _uiState.value.mediaUris.filter { it != uri }
        _uiState.value = _uiState.value.copy(mediaUris = currentMedia)
    }

    /**
     * Validate the form fields.
     */
    private fun validateForm(): Boolean {
        val state = _uiState.value

        if (state.selectedProperty == null) {
            _uiState.value = state.copy(error = "Please select a property")
            return false
        }
        if (state.title.isBlank()) {
            _uiState.value = state.copy(error = "Title is required")
            return false
        }
        if (state.description.isBlank()) {
            _uiState.value = state.copy(error = "Description is required")
            return false
        }

        return true
    }

    /**
     * Submit the service request.
     */
    fun submitRequest() {
        if (!validateForm()) return

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSubmitting = true, error = null)

            val state = _uiState.value
            
            // Note: The repository currently only accepts basic fields.
            // In a full implementation, we would pass the schedule and media fields here.
            // For now, we proceed with the existing repository method.
            
            when (val result = requestRepository.createServiceRequest(
                propertyId = state.selectedProperty!!.id,
                category = state.category,
                title = state.title,
                description = state.description,
                priority = state.priority,
                isDiy = state.isDiy
            )) {
                is Result.Success -> {
                    Log.d(TAG, "Service request created: ${result.data.id}")
                    
                    // TODO: Upload Media if any
                    // if (state.mediaUris.isNotEmpty()) { uploadMedia(result.data.id, state.mediaUris) }
                    
                    _uiState.value = _uiState.value.copy(
                        isSubmitting = false,
                        isSuccess = true,
                        createdRequest = result.data
                    )
                }
                is Result.Error -> {
                    Log.e(TAG, "Failed to create request: ${result.error.message}")
                    _uiState.value = _uiState.value.copy(
                        isSubmitting = false,
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
        _uiState.value = CreateServiceRequestUiState(
            properties = _uiState.value.properties,
            selectedProperty = _uiState.value.properties.firstOrNull()
        )
    }
}
