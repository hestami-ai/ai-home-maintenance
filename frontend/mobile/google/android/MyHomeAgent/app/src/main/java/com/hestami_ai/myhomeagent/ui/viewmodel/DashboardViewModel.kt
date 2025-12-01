package com.hestami_ai.myhomeagent.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hestami_ai.myhomeagent.data.model.Property
import com.hestami_ai.myhomeagent.data.model.ServiceRequest
import com.hestami_ai.myhomeagent.data.model.ServiceRequestStatus
import com.hestami_ai.myhomeagent.data.network.Result
import com.hestami_ai.myhomeagent.data.repository.PropertyRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber

/**
 * UI state for the dashboard screen.
 */
data class DashboardUiState(
    val propertyCount: Int = 0,
    val activeRequestCount: Int = 0,
    val recentRequests: List<ServiceRequest> = emptyList(),
    val properties: List<Property> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null
)

/**
 * ViewModel for the dashboard screen.
 * Matches iOS DashboardViewModel.swift implementation.
 */
class DashboardViewModel : ViewModel() {

    private val propertyRepository = PropertyRepository()

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        loadDashboardData()
    }

    /**
     * Load all dashboard data.
     */
    fun loadDashboardData() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            // Load properties (service requests are nested within properties)
            val propertiesResult = propertyRepository.getProperties()
            val properties = when (propertiesResult) {
                is Result.Success -> propertiesResult.data
                is Result.Error -> {
                    Timber.e("Failed to load properties: ${propertiesResult.error.message}")
                    emptyList()
                }
                is Result.Loading -> emptyList()
            }

            // Extract all service requests from properties
            val allRequests = properties.flatMap { it.serviceRequests ?: emptyList() }

            // Calculate active requests
            val activeRequests = allRequests.filter { request ->
                request.status in listOf(
                    ServiceRequestStatus.PENDING,
                    ServiceRequestStatus.IN_PROGRESS,
                    ServiceRequestStatus.SCHEDULED,
                    ServiceRequestStatus.BIDDING,
                    ServiceRequestStatus.ACCEPTED,
                    ServiceRequestStatus.IN_RESEARCH
                )
            }

            // Get recent requests (last 5)
            val recentRequests = allRequests
                .sortedByDescending { it.createdAt }
                .take(5)

            _uiState.value = _uiState.value.copy(
                propertyCount = properties.size,
                activeRequestCount = activeRequests.size,
                recentRequests = recentRequests,
                properties = properties,
                isLoading = false
            )
        }
    }

    /**
     * Refresh dashboard data.
     */
    fun refresh() {
        loadDashboardData()
    }

    /**
     * Clear error state.
     */
    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}
