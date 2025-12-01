package com.hestami_ai.myhomeagent.data.network

/**
 * Network error types matching iOS NetworkError implementation.
 * Uses classes instead of objects to avoid serialization warnings.
 */
sealed class NetworkError(override val message: String, cause: Throwable? = null) : Exception(message, cause) {
    
    class InvalidUrl : NetworkError("Invalid URL. Please check the address and try again.")
    
    class InvalidResponse : NetworkError("Invalid response from server. Please try again later.")
    
    class HttpError(val statusCode: Int, val responseBody: String? = null) : 
        NetworkError("Server error (HTTP $statusCode). Please try again later.")
    
    class DecodingError(cause: Throwable) : 
        NetworkError("Error processing server response. Please try again later.", cause)
    
    class ServerError(message: String) : NetworkError(message)
    
    class NoData : NetworkError("No data received from server. Please check your connection and try again.")
    
    class Unauthorized : NetworkError("Authentication failed. Please log in again.")
    
    class ConnectionError : NetworkError("Cannot connect to server. Please check your internet connection or try again later.")
    
    class TimeoutError : NetworkError("Connection timed out. Please check your internet connection and try again.")
    
    class UnknownError(cause: Throwable) : 
        NetworkError("An unexpected error occurred: ${cause.message}", cause)

    /**
     * Check if this error is an authentication error.
     */
    @Suppress("unused")
    val isAuthError: Boolean
        get() = this is Unauthorized || (this is HttpError && statusCode == 401)
    
    @Suppress("unused")
    companion object {
        val InvalidUrl = InvalidUrl()
        val InvalidResponse = InvalidResponse()
        val NoData = NoData()
        val Unauthorized = Unauthorized()
        val ConnectionError = ConnectionError()
        val TimeoutError = TimeoutError()
        
        fun HttpError(statusCode: Int, responseBody: String? = null) = NetworkError.HttpError(statusCode, responseBody)
        fun DecodingError(cause: Throwable) = NetworkError.DecodingError(cause)
        fun ServerError(message: String) = NetworkError.ServerError(message)
        fun UnknownError(cause: Throwable) = NetworkError.UnknownError(cause)
    }
}
