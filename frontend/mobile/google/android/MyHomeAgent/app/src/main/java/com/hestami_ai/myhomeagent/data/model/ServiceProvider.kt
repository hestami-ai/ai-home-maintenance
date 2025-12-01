package com.hestami_ai.myhomeagent.data.model

import com.google.gson.annotations.SerializedName

/**
 * Service provider model matching iOS ServiceProvider.swift implementation.
 */
data class ServiceProvider(
    @SerializedName("id")
    val id: String = "",

    @SerializedName("businessName")
    val businessName: String = "",

    @SerializedName("description")
    val description: String? = null,

    @SerializedName("rating")
    val rating: String = "",

    @SerializedName("totalReviews")
    val totalReviews: Int = 0
)
