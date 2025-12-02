package com.hestami_ai.myhomeagent.data.network

/**
 * A generic class that holds a value or an error.
 * Used for representing the result of network operations.
 */
@Suppress("unused")
sealed class Result<out T> {
    data class Success<out T>(val data: T) : Result<T>()
    data class Error(val error: NetworkError) : Result<Nothing>()
    data object Loading : Result<Nothing>()

    val isSuccess: Boolean get() = this is Success
    val isError: Boolean get() = this is Error
    val isLoading: Boolean get() = this is Loading

    /**
     * Returns the data if this is a Success, or null otherwise.
     */
    fun getOrNull(): T? = when (this) {
        is Success -> data
        else -> null
    }

    /**
     * Returns the data if this is a Success, or throws the error if this is an Error.
     */
    fun getOrThrow(): T = when (this) {
        is Success -> data
        is Error -> throw error
        is Loading -> throw IllegalStateException("Result is still loading")
    }

    /**
     * Returns the data if this is a Success, or the default value otherwise.
     */
    fun getOrDefault(default: @UnsafeVariance T): T = when (this) {
        is Success -> data
        else -> default
    }

    /**
     * Maps the success value to a new value.
     */
    inline fun <R> map(transform: (T) -> R): Result<R> = when (this) {
        is Success -> Success(transform(data))
        is Error -> this
        is Loading -> Loading
    }

    /**
     * Executes the given block if this is a Success.
     */
    inline fun onSuccess(action: (T) -> Unit): Result<T> {
        if (this is Success) action(data)
        return this
    }

    /**
     * Executes the given block if this is an Error.
     */
    inline fun onError(action: (NetworkError) -> Unit): Result<T> {
        if (this is Error) action(error)
        return this
    }

    companion object {
        /**
         * Creates a Success result.
         */
        fun <T> success(data: T): Result<T> = Success(data)

        /**
         * Creates an Error result.
         */
        fun error(error: NetworkError): Result<Nothing> = Error(error)

        /**
         * Creates a Loading result.
         */
        fun loading(): Result<Nothing> = Loading
    }
}
