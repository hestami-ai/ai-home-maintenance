package com.hestami_ai.myhomeagent.data.model

import com.google.gson.annotations.SerializedName

/**
 * User model matching iOS User.swift implementation.
 */
data class User(
    @SerializedName("id")
    val id: String,

    @SerializedName("email")
    val email: String,

    @SerializedName("user_role")
    val userRole: String,

    @SerializedName("first_name")
    val firstName: String,

    @SerializedName("last_name")
    val lastName: String,

    @SerializedName("phone_number")
    val phoneNumber: String? = null,

    @SerializedName("service_provider")
    val serviceProvider: String? = null
) {
    /**
     * Display name computed from first/last name or email fallback.
     */
    val displayName: String
        get() = when {
            firstName.isNotEmpty() || lastName.isNotEmpty() ->
                "$firstName $lastName".trim()
            else -> email
        }

    /**
     * User initials for avatar display.
     */
    val initials: String
        get() = when {
            firstName.isNotEmpty() && lastName.isNotEmpty() ->
                "${firstName.first()}${lastName.first()}".uppercase()
            firstName.isNotEmpty() ->
                firstName.first().uppercase()
            lastName.isNotEmpty() ->
                lastName.first().uppercase()
            email.isNotEmpty() ->
                email.first().uppercase()
            else -> "?"
        }
}
