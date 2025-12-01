package com.hestami_ai.myhomeagent.data.model

import com.google.gson.annotations.SerializedName

/**
 * Login response from the API.
 * Matches iOS LoginResponse.swift implementation.
 */
data class LoginResponse(
    @SerializedName("success")
    val success: Boolean,

    @SerializedName("user")
    val user: User
)

/**
 * Registration response from the API.
 * Matches iOS RegisterResponse implementation.
 */
data class RegisterResponse(
    @SerializedName("user")
    val user: User,

    @SerializedName("message")
    val message: String? = null
)
