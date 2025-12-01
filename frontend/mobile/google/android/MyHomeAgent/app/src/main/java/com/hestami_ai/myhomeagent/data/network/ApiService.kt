package com.hestami_ai.myhomeagent.data.network

import com.hestami_ai.myhomeagent.data.model.Conversation
import com.hestami_ai.myhomeagent.data.model.ConversationsResponse
import com.hestami_ai.myhomeagent.data.model.DeleteConversationRequest
import com.hestami_ai.myhomeagent.data.model.DeleteConversationResponse
import com.hestami_ai.myhomeagent.data.model.LibreChatMessage
import com.hestami_ai.myhomeagent.data.model.LoginResponse
import com.hestami_ai.myhomeagent.data.model.Property
import com.hestami_ai.myhomeagent.data.model.RegisterResponse
import com.hestami_ai.myhomeagent.data.model.SendMessageRequest
import com.hestami_ai.myhomeagent.data.model.SendMessageResponse
import com.hestami_ai.myhomeagent.data.model.ServiceRequest
import com.hestami_ai.myhomeagent.data.model.User
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.HTTP
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Retrofit API service interface defining all API endpoints.
 * Matches the iOS NetworkManager endpoints.
 */
@Suppress("unused")
interface ApiService {

    // ==================== Authentication ====================

    @POST("api/users/login/")
    suspend fun login(@Body credentials: LoginRequest): Response<LoginResponse>

    @POST("api/users/register/")
    suspend fun register(@Body registration: RegisterRequest): Response<RegisterResponse>

    @POST("api/users/logout/")
    suspend fun logout(): Response<Unit>

    @GET("api/users/profile/")
    suspend fun getProfile(): Response<User>

    @PUT("api/users/profile/")
    suspend fun updateProfile(@Body profile: UpdateProfileRequest): Response<User>

    @POST("api/users/change-password/")
    suspend fun changePassword(@Body request: ChangePasswordRequest): Response<Unit>

    // ==================== Properties ====================

    @GET("api/properties/")
    suspend fun getProperties(): Response<PropertiesResponse>

    @GET("api/properties/{id}/")
    suspend fun getProperty(@Path("id") id: String): Response<Property>

    @POST("api/properties/")
    suspend fun createProperty(@Body property: CreatePropertyRequest): Response<Property>

    @PUT("api/properties/{id}/")
    suspend fun updateProperty(
        @Path("id") id: String,
        @Body property: UpdatePropertyRequest
    ): Response<Property>

    @PATCH("api/properties/{id}/")
    suspend fun patchProperty(
        @Path("id") id: String,
        @Body updates: Map<String, Any?>
    ): Response<Property>

    @DELETE("api/properties/{id}/")
    suspend fun deleteProperty(@Path("id") id: String): Response<Unit>

    // ==================== Service Requests ====================

    @GET("api/service-requests/")
    suspend fun getServiceRequests(
        @Query("property") propertyId: String? = null,
        @Query("status") status: String? = null
    ): Response<List<ServiceRequest>>

    @GET("api/service-requests/{id}/")
    suspend fun getServiceRequest(@Path("id") id: String): Response<ServiceRequest>

    @POST("api/service-requests/")
    suspend fun createServiceRequest(@Body request: CreateServiceRequestBody): Response<ServiceRequest>

    @PUT("api/service-requests/{id}/")
    suspend fun updateServiceRequest(
        @Path("id") id: String,
        @Body request: UpdateServiceRequestBody
    ): Response<ServiceRequest>

    @PATCH("api/service-requests/{id}/")
    suspend fun patchServiceRequest(
        @Path("id") id: String,
        @Body updates: Map<String, Any?>
    ): Response<ServiceRequest>

    @DELETE("api/service-requests/{id}/")
    suspend fun deleteServiceRequest(@Path("id") id: String): Response<Unit>

    // ==================== Chat ====================

    @GET("api/chat/convos")
    suspend fun getConversations(): Response<ConversationsResponse>

    @GET("api/chat/convos")
    suspend fun getConversationsAsArray(): Response<List<Conversation>>

    @GET("api/chat/convos")
    suspend fun getConversationsRaw(): Response<okhttp3.ResponseBody>

    @GET("api/chat/messages")
    suspend fun getMessages(@Query("conversationId") conversationId: String): Response<List<LibreChatMessage>>

    @POST("api/chat/agents/chat/google")
    suspend fun sendChatMessage(@Body request: SendMessageRequest): Response<SendMessageResponse>

    @POST("api/chat/agents/chat/google")
    suspend fun sendChatMessageWithMap(@Body request: Map<String, Any>): Response<SendMessageResponse>

    @HTTP(method = "DELETE", path = "api/chat/convos", hasBody = true)
    suspend fun deleteConversation(@Body request: DeleteConversationRequest): Response<DeleteConversationResponse>
}

// ==================== Request Body Classes ====================

data class LoginRequest(
    val email: String,
    val password: String
)

data class RegisterRequest(
    val email: String,
    val password: String,
    val confirmPassword: String,
    val firstName: String,
    val lastName: String,
    val phoneNumber: String,
    val userRole: String,
    val serviceProvider: String? = null
)

data class UpdateProfileRequest(
    val firstName: String? = null,
    val lastName: String? = null,
    val phoneNumber: String? = null
)

data class ChangePasswordRequest(
    val currentPassword: String,
    val newPassword: String
)

data class CreatePropertyRequest(
    val title: String,
    val description: String,
    val address: String,
    val city: String,
    val state: String,
    val zipCode: String,
    val country: String = "USA"
)

data class UpdatePropertyRequest(
    val title: String? = null,
    val description: String? = null,
    val address: String? = null,
    val city: String? = null,
    val state: String? = null,
    val zipCode: String? = null,
    val country: String? = null
)

data class CreateServiceRequestBody(
    val property: String,
    val category: String,
    val title: String,
    val description: String,
    val priority: String = "MEDIUM",
    val isDiy: Boolean = false
)

data class UpdateServiceRequestBody(
    val title: String? = null,
    val description: String? = null,
    val status: String? = null,
    val priority: String? = null
)

// ==================== Response Wrapper Classes ====================

data class PropertiesResponse(
    val properties: List<Property>
)
