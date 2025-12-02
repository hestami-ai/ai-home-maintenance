package com.hestami_ai.myhomeagent.data.model

import com.google.gson.annotations.SerializedName
import java.math.BigDecimal
import java.util.Date
import java.util.UUID

/**
 * Service request status enumeration matching iOS ServiceRequestStatus.
 */
enum class ServiceRequestStatus {
    @SerializedName("PENDING") PENDING,
    @SerializedName("IN_PROGRESS") IN_PROGRESS,
    @SerializedName("COMPLETED") COMPLETED,
    @SerializedName("CANCELLED") CANCELLED,
    @SerializedName("DECLINED") DECLINED,
    @SerializedName("SCHEDULED") SCHEDULED,
    @SerializedName("BIDDING") BIDDING,
    @SerializedName("REOPENED_BIDDING") REOPENED_BIDDING,
    @SerializedName("ACCEPTED") ACCEPTED,
    @SerializedName("IN_RESEARCH") IN_RESEARCH,
    UNKNOWN;

    @Suppress("unused")
    companion object {
        fun fromString(value: String): ServiceRequestStatus {
            return entries.find { it.name == value } ?: UNKNOWN
        }

        fun fromLegacyStatus(status: String): ServiceRequestStatus {
            return when (status.lowercase()) {
                "pending" -> PENDING
                "in_progress" -> IN_PROGRESS
                "completed" -> COMPLETED
                "cancelled" -> CANCELLED
                "declined" -> DECLINED
                "scheduled" -> SCHEDULED
                "bidding" -> BIDDING
                "reopened_bidding" -> REOPENED_BIDDING
                "accepted" -> ACCEPTED
                "in_research" -> IN_RESEARCH
                else -> UNKNOWN
            }
        }
    }
}

/**
 * Service request priority enumeration matching iOS ServiceRequestPriority.
 */
enum class ServiceRequestPriority {
    @SerializedName("LOW") LOW,
    @SerializedName("MEDIUM") MEDIUM,
    @SerializedName("HIGH") HIGH,
    @SerializedName("URGENT") URGENT,
    UNKNOWN;

    companion object {
        @Suppress("unused")
        fun fromString(value: String): ServiceRequestPriority {
            return entries.find { it.name == value } ?: UNKNOWN
        }
    }
}

/**
 * Property summary for service request details.
 */
data class PropertySummary(
    @SerializedName("id")
    val id: String = "",

    @SerializedName("title")
    val title: String = "",

    @SerializedName("address")
    val address: String = "",

    @SerializedName("city")
    val city: String = "",

    @SerializedName("state")
    val state: String = "",

    @SerializedName("zip_code")
    val zipCode: String = ""
)

/**
 * Time slot for preferred schedule.
 */
data class TimeSlot(
    val id: UUID = UUID.randomUUID(),

    @SerializedName("date")
    val date: String,

    @SerializedName("start_time")
    val startTime: String,

    @SerializedName("end_time")
    val endTime: String
)

/**
 * Preferred schedule for service request.
 */
data class PreferredSchedule(
    @SerializedName("time_slots")
    val timeSlots: List<TimeSlot>? = null,

    @SerializedName("flexible")
    val flexible: Boolean? = null,

    @SerializedName("notes")
    val notes: String? = null,

    // Legacy support
    @SerializedName("date")
    val date: String? = null
)

/**
 * Bid model placeholder.
 */
data class Bid(
    @SerializedName("id")
    val id: String
)

/**
 * Clarification model placeholder.
 */
data class Clarification(
    @SerializedName("id")
    val id: String
)

/**
 * Research entry model placeholder.
 */
data class ResearchEntry(
    @SerializedName("id")
    val id: String
)

/**
 * Service request model matching iOS ServiceRequest.swift implementation.
 */
data class ServiceRequest(
    @SerializedName("id")
    val id: String = "",

    @SerializedName("property")
    val property: String = "",

    @SerializedName("property_details")
    val propertyDetails: PropertySummary? = null,

    @SerializedName("category")
    val category: String = "",

    @SerializedName("category_display")
    val categoryDisplay: String? = null,

    @SerializedName("provider")
    val provider: String? = null,

    @SerializedName("provider_details")
    val providerDetails: ServiceProvider? = null,

    @SerializedName("title")
    val title: String? = null,

    @SerializedName("description")
    val description: String? = null,

    @SerializedName("status")
    val status: ServiceRequestStatus = ServiceRequestStatus.UNKNOWN,

    @SerializedName("priority")
    val priority: ServiceRequestPriority = ServiceRequestPriority.UNKNOWN,

    @SerializedName("preferred_schedule")
    val preferredSchedule: PreferredSchedule? = null,

    @SerializedName("estimated_duration")
    val estimatedDuration: String? = null,

    @SerializedName("scheduled_start")
    val scheduledStart: Date? = null,

    @SerializedName("scheduled_end")
    val scheduledEnd: Date? = null,

    @SerializedName("actual_start")
    val actualStart: Date? = null,

    @SerializedName("actual_end")
    val actualEnd: Date? = null,

    @SerializedName("estimated_cost")
    val estimatedCost: BigDecimal? = null,

    @SerializedName("final_cost")
    val finalCost: BigDecimal? = null,

    @SerializedName("created_at")
    val createdAt: Date = Date(),

    @SerializedName("updated_at")
    val updatedAt: Date = Date(),

    @SerializedName("created_by")
    val createdBy: String = "",

    @SerializedName("created_by_details")
    val createdByDetails: User? = null,

    @SerializedName("budget_minimum")
    val budgetMinimum: BigDecimal? = null,

    @SerializedName("budget_maximum")
    val budgetMaximum: BigDecimal? = null,

    @SerializedName("bid_submission_deadline")
    val bidSubmissionDeadline: Date? = null,

    @SerializedName("selected_provider")
    val selectedProvider: String? = null,

    @SerializedName("selected_provider_details")
    val selectedProviderDetails: ServiceProvider? = null,

    @SerializedName("runner_up_provider")
    val runnerUpProvider: String? = null,

    @SerializedName("runner_up_provider_details")
    val runnerUpProviderDetails: ServiceProvider? = null,

    @SerializedName("bids")
    val bids: List<Bid>? = null,

    @SerializedName("clarifications")
    val clarifications: List<Clarification>? = null,

    @SerializedName("media_details")
    val mediaDetails: List<Media>? = null,

    @SerializedName("is_diy")
    val isDiy: Boolean = false,

    @SerializedName("research_entries")
    val researchEntries: List<ResearchEntry>? = null
)
