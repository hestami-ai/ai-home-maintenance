package com.hestami_ai.myhomeagent.data.repository

import com.hestami_ai.myhomeagent.data.model.ServiceRequest
import com.hestami_ai.myhomeagent.data.network.ApiService
import com.hestami_ai.myhomeagent.data.network.CreateServiceRequestBody
import com.hestami_ai.myhomeagent.data.network.NetworkError
import com.hestami_ai.myhomeagent.data.network.NetworkModule
import com.hestami_ai.myhomeagent.data.network.Result
import com.hestami_ai.myhomeagent.data.network.UpdateServiceRequestBody
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import timber.log.Timber

/**
 * Repository for service request data operations.
 */
@Suppress("unused")
class ServiceRequestRepository {

    private val apiService: ApiService = NetworkModule.provideApiService()

    /**
     * Fetch all service requests, optionally filtered by property or status.
     */
    suspend fun getServiceRequests(
        propertyId: String? = null,
        status: String? = null
    ): Result<List<ServiceRequest>> = withContext(Dispatchers.IO) {
        try {
            Timber.d("Fetching service requests")
            val response = apiService.getServiceRequests(propertyId, status)

            if (response.isSuccessful) {
                val requests = response.body() ?: emptyList()
                Timber.d("Fetched ${requests.size} service requests")
                Result.success(requests)
            } else {
                Timber.e("Failed to fetch service requests: ${response.code()}")
                when (response.code()) {
                    401 -> Result.error(NetworkError.Unauthorized)
                    else -> Result.error(NetworkError.HttpError(response.code(), response.errorBody()?.string()))
                }
            }
        } catch (e: Exception) {
            Timber.e(e, "Error fetching service requests")
            Result.error(NetworkError.UnknownError(e))
        }
    }

    /**
     * Fetch a single service request by ID.
     */
    suspend fun getServiceRequest(id: String): Result<ServiceRequest> = withContext(Dispatchers.IO) {
        try {
            Timber.d("Fetching service request: $id")
            val response = apiService.getServiceRequest(id)

            if (response.isSuccessful) {
                val request = response.body()
                if (request != null) {
                    Timber.d("Fetched service request: ${request.title}")
                    Result.success(request)
                } else {
                    Result.error(NetworkError.NoData)
                }
            } else {
                Timber.e("Failed to fetch service request: ${response.code()}")
                when (response.code()) {
                    401 -> Result.error(NetworkError.Unauthorized)
                    404 -> Result.error(NetworkError.ServerError("Service request not found"))
                    else -> Result.error(NetworkError.HttpError(response.code(), response.errorBody()?.string()))
                }
            }
        } catch (e: Exception) {
            Timber.e(e, "Error fetching service request")
            Result.error(NetworkError.UnknownError(e))
        }
    }

    /**
     * Create a new service request.
     */
    suspend fun createServiceRequest(
        propertyId: String,
        category: String,
        title: String,
        description: String,
        priority: String = "MEDIUM",
        isDiy: Boolean = false
    ): Result<ServiceRequest> = withContext(Dispatchers.IO) {
        try {
            Timber.d("Creating service request: $title")
            val request = CreateServiceRequestBody(
                property = propertyId,
                category = category,
                title = title,
                description = description,
                priority = priority,
                isDiy = isDiy
            )
            val response = apiService.createServiceRequest(request)

            if (response.isSuccessful) {
                val serviceRequest = response.body()
                if (serviceRequest != null) {
                    Timber.d("Created service request: ${serviceRequest.id}")
                    Result.success(serviceRequest)
                } else {
                    Result.error(NetworkError.NoData)
                }
            } else {
                Timber.e("Failed to create service request: ${response.code()}")
                Result.error(NetworkError.HttpError(response.code(), response.errorBody()?.string()))
            }
        } catch (e: Exception) {
            Timber.e(e, "Error creating service request")
            Result.error(NetworkError.UnknownError(e))
        }
    }

    /**
     * Update an existing service request.
     */
    suspend fun updateServiceRequest(
        id: String,
        title: String? = null,
        description: String? = null,
        status: String? = null,
        priority: String? = null
    ): Result<ServiceRequest> = withContext(Dispatchers.IO) {
        try {
            Timber.d("Updating service request: $id")
            val request = UpdateServiceRequestBody(
                title = title,
                description = description,
                status = status,
                priority = priority
            )
            val response = apiService.updateServiceRequest(id, request)

            if (response.isSuccessful) {
                val serviceRequest = response.body()
                if (serviceRequest != null) {
                    Timber.d("Updated service request: ${serviceRequest.id}")
                    Result.success(serviceRequest)
                } else {
                    Result.error(NetworkError.NoData)
                }
            } else {
                Timber.e("Failed to update service request: ${response.code()}")
                Result.error(NetworkError.HttpError(response.code(), response.errorBody()?.string()))
            }
        } catch (e: Exception) {
            Timber.e(e, "Error updating service request")
            Result.error(NetworkError.UnknownError(e))
        }
    }

    /**
     * Delete a service request.
     */
    suspend fun deleteServiceRequest(id: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            Timber.d("Deleting service request: $id")
            val response = apiService.deleteServiceRequest(id)

            if (response.isSuccessful) {
                Timber.d("Deleted service request: $id")
                Result.success(Unit)
            } else {
                Timber.e("Failed to delete service request: ${response.code()}")
                Result.error(NetworkError.HttpError(response.code(), response.errorBody()?.string()))
            }
        } catch (e: Exception) {
            Timber.e(e, "Error deleting service request")
            Result.error(NetworkError.UnknownError(e))
        }
    }
}
