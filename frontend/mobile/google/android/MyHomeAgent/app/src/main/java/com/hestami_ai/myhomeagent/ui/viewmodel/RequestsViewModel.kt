package com.hestami_ai.myhomeagent.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
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
 * Filter options for service requests.
 */
enum class RequestFilter(val displayName: String) {
    ALL("All"),
    PENDING("Pending"),
    IN_PROGRESS("In Progress"),
    COMPLETED("Completed")
}

/**
 * UI state for the requests screen.
 */
data class RequestsUiState(
    val requests: List<ServiceRequest> = emptyList(),
    val filteredRequests: List<ServiceRequest> = emptyList(),
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val error: String? = null,
    val selectedFilter: RequestFilter = RequestFilter.ALL,
    val selectedRequest: ServiceRequest? = null
)

/**
 * ViewModel for the service requests screen.
 * Matches iOS RequestsViewModel.swift implementation.
 * Service requests are extracted from properties since there's no separate endpoint.
 */
class RequestsViewModel : ViewModel() {

    private val propertyRepository = PropertyRepository()

    private val _uiState = MutableStateFlow(RequestsUiState())
    val uiState: StateFlow<RequestsUiState> = _uiState.asStateFlow()

    init {
        loadRequests()
    }

    /**
     * Load service requests by fetching properties and extracting nested requests.
     */
    fun loadRequests() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            when (val result = propertyRepository.getProperties()) {
                is Result.Success -> {
                    // Extract all service requests from properties
                    val allRequests = result.data.flatMap { it.serviceRequests ?: emptyList() }
                    Timber.d("Loaded ${allRequests.size} service requests from ${result.data.size} properties")
                    _uiState.value = _uiState.value.copy(
                        requests = allRequests,
                        isLoading = false
                    )
                    applyFilter(_uiState.value.selectedFilter)
                }
                is Result.Error -> {
                    Timber.e("Failed to load requests: ${result.error.message}")
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
     * Refresh requests (pull-to-refresh).
     */
    fun refreshRequests() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isRefreshing = true, error = null)

            when (val result = propertyRepository.getProperties()) {
                is Result.Success -> {
                    // Extract all service requests from properties
                    val allRequests = result.data.flatMap { it.serviceRequests ?: emptyList() }
                    _uiState.value = _uiState.value.copy(
                        requests = allRequests,
                        isRefreshing = false
                    )
                    applyFilter(_uiState.value.selectedFilter)
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
     * Apply a filter to the requests list.
     */
    fun applyFilter(filter: RequestFilter) {
        val filtered = when (filter) {
            RequestFilter.ALL -> _uiState.value.requests
            RequestFilter.PENDING -> _uiState.value.requests.filter { 
                it.status == ServiceRequestStatus.PENDING || 
                it.status == ServiceRequestStatus.BIDDING 
            }
            RequestFilter.IN_PROGRESS -> _uiState.value.requests.filter { 
                it.status == ServiceRequestStatus.IN_PROGRESS || 
                it.status == ServiceRequestStatus.SCHEDULED ||
                it.status == ServiceRequestStatus.ACCEPTED
            }
            RequestFilter.COMPLETED -> _uiState.value.requests.filter { 
                it.status == ServiceRequestStatus.COMPLETED 
            }
        }
        _uiState.value = _uiState.value.copy(
            selectedFilter = filter,
            filteredRequests = filtered
        )
    }

    /**
     * Select a request for detail view.
     */
    fun selectRequest(request: ServiceRequest) {
        _uiState.value = _uiState.value.copy(selectedRequest = request)
    }

    /**
     * Clear selected request.
     */
    fun clearSelectedRequest() {
        _uiState.value = _uiState.value.copy(selectedRequest = null)
    }

    /**
     * Delete a service request.
     * Note: Currently not implemented as there's no dedicated service request delete endpoint.
     * Service requests are managed through the properties API.
     */
    @Suppress("unused")
    fun deleteRequest(requestId: String) {
        // TODO: Implement when service request delete endpoint is available
        Timber.w("Delete service request not implemented: $requestId")
        _uiState.value = _uiState.value.copy(
            error = "Delete functionality is not yet available"
        )
    }

    /**
     * Clear error state.
     */
    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}
