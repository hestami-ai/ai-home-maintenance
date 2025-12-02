package com.hestami_ai.myhomeagent.data.repository

import com.hestami_ai.myhomeagent.data.model.Property
import com.hestami_ai.myhomeagent.data.network.ApiService
import com.hestami_ai.myhomeagent.data.network.CreatePropertyRequest
import com.hestami_ai.myhomeagent.data.network.NetworkError
import com.hestami_ai.myhomeagent.data.network.NetworkModule
import com.hestami_ai.myhomeagent.data.network.Result
import com.hestami_ai.myhomeagent.data.network.UpdatePropertyRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import timber.log.Timber

/**
 * Repository for property data operations.
 * Handles API calls and data transformation.
 */
@Suppress("unused")
class PropertyRepository {

    private val apiService: ApiService = NetworkModule.provideApiService()

    /**
     * Fetch all properties for the current user.
     */
    suspend fun getProperties(): Result<List<Property>> = withContext(Dispatchers.IO) {
        try {
            Timber.d("Fetching properties")
            val response = apiService.getProperties()

            if (response.isSuccessful) {
                val propertiesResponse = response.body()
                val properties = propertiesResponse?.properties ?: emptyList()
                Timber.d("Fetched ${properties.size} properties")
                Result.success(properties)
            } else {
                Timber.e("Failed to fetch properties: ${response.code()}")
                when (response.code()) {
                    401 -> Result.error(NetworkError.Unauthorized)
                    else -> Result.error(NetworkError.HttpError(response.code(), response.errorBody()?.string()))
                }
            }
        } catch (e: Exception) {
            Timber.e(e, "Error fetching properties")
            Result.error(NetworkError.UnknownError(e))
        }
    }

    /**
     * Fetch a single property by ID.
     */
    suspend fun getProperty(id: String): Result<Property> = withContext(Dispatchers.IO) {
        try {
            Timber.d("Fetching property: $id")
            val response = apiService.getProperty(id)

            if (response.isSuccessful) {
                val property = response.body()
                if (property != null) {
                    Timber.d("Fetched property: ${property.title}")
                    Result.success(property)
                } else {
                    Result.error(NetworkError.NoData)
                }
            } else {
                Timber.e("Failed to fetch property: ${response.code()}")
                when (response.code()) {
                    401 -> Result.error(NetworkError.Unauthorized)
                    404 -> Result.error(NetworkError.ServerError("Property not found"))
                    else -> Result.error(NetworkError.HttpError(response.code(), response.errorBody()?.string()))
                }
            }
        } catch (e: Exception) {
            Timber.e(e, "Error fetching property")
            Result.error(NetworkError.UnknownError(e))
        }
    }

    /**
     * Create a new property.
     */
    suspend fun createProperty(
        title: String,
        description: String,
        address: String,
        city: String,
        state: String,
        zipCode: String,
        country: String = "USA"
    ): Result<Property> = withContext(Dispatchers.IO) {
        try {
            Timber.d("Creating property: $title")
            val request = CreatePropertyRequest(
                title = title,
                description = description,
                address = address,
                city = city,
                state = state,
                zipCode = zipCode,
                country = country
            )
            val response = apiService.createProperty(request)

            if (response.isSuccessful) {
                val property = response.body()
                if (property != null) {
                    Timber.d("Created property: ${property.id}")
                    Result.success(property)
                } else {
                    Result.error(NetworkError.NoData)
                }
            } else {
                Timber.e("Failed to create property: ${response.code()}")
                Result.error(NetworkError.HttpError(response.code(), response.errorBody()?.string()))
            }
        } catch (e: Exception) {
            Timber.e(e, "Error creating property")
            Result.error(NetworkError.UnknownError(e))
        }
    }

    /**
     * Update an existing property.
     */
    suspend fun updateProperty(
        id: String,
        title: String? = null,
        description: String? = null,
        address: String? = null,
        city: String? = null,
        state: String? = null,
        zipCode: String? = null
    ): Result<Property> = withContext(Dispatchers.IO) {
        try {
            Timber.d("Updating property: $id")
            val request = UpdatePropertyRequest(
                title = title,
                description = description,
                address = address,
                city = city,
                state = state,
                zipCode = zipCode
            )
            val response = apiService.updateProperty(id, request)

            if (response.isSuccessful) {
                val property = response.body()
                if (property != null) {
                    Timber.d("Updated property: ${property.id}")
                    Result.success(property)
                } else {
                    Result.error(NetworkError.NoData)
                }
            } else {
                Timber.e("Failed to update property: ${response.code()}")
                Result.error(NetworkError.HttpError(response.code(), response.errorBody()?.string()))
            }
        } catch (e: Exception) {
            Timber.e(e, "Error updating property")
            Result.error(NetworkError.UnknownError(e))
        }
    }

    /**
     * Delete a property.
     */
    suspend fun deleteProperty(id: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            Timber.d("Deleting property: $id")
            val response = apiService.deleteProperty(id)

            if (response.isSuccessful) {
                Timber.d("Deleted property: $id")
                Result.success(Unit)
            } else {
                Timber.e("Failed to delete property: ${response.code()}")
                Result.error(NetworkError.HttpError(response.code(), response.errorBody()?.string()))
            }
        } catch (e: Exception) {
            Timber.e(e, "Error deleting property")
            Result.error(NetworkError.UnknownError(e))
        }
    }
}
