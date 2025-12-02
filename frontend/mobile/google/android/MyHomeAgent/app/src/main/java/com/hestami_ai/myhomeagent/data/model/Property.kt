package com.hestami_ai.myhomeagent.data.model

import com.google.gson.annotations.SerializedName
import java.util.Date

/**
 * Property status enumeration matching iOS PropertyStatus.
 */
enum class PropertyStatus {
    @SerializedName("ACTIVE") ACTIVE,
    @SerializedName("INACTIVE") INACTIVE,
    @SerializedName("PENDING") PENDING,
    @SerializedName("COUNTY_PROCESSING") COUNTY_PROCESSING,
    UNKNOWN;

    companion object {
        @Suppress("unused")
        fun fromString(value: String): PropertyStatus {
            return entries.find { it.name == value } ?: UNKNOWN
        }
    }
}

/**
 * Property utilities information.
 */
data class PropertyUtilities(
    @SerializedName("gas")
    val gas: String? = null,

    @SerializedName("sewer")
    val sewer: String? = null,

    @SerializedName("water")
    val water: String? = null,

    @SerializedName("electricity")
    val electricity: String? = null,

    @SerializedName("internetCable")
    val internetCable: String? = null
)

/**
 * Property water heater information.
 */
data class PropertyWaterHeater(
    @SerializedName("type")
    val type: String? = null,

    @SerializedName("fuel")
    val fuel: String? = null,

    @SerializedName("capacity")
    val capacity: String? = null,

    @SerializedName("age")
    val age: Int? = null,

    @SerializedName("brand")
    val brand: String? = null,

    @SerializedName("model")
    val model: String? = null
)

/**
 * Property appliances information.
 */
data class PropertyAppliances(
    @SerializedName("refrigerator")
    val refrigerator: Boolean? = null,

    @SerializedName("stove")
    val stove: Boolean? = null,

    @SerializedName("dishwasher")
    val dishwasher: Boolean? = null,

    @SerializedName("washer")
    val washer: Boolean? = null,

    @SerializedName("dryer")
    val dryer: Boolean? = null,

    @SerializedName("microwave")
    val microwave: Boolean? = null,

    @SerializedName("oven")
    val oven: Boolean? = null,

    @SerializedName("range")
    val range: Boolean? = null,

    @SerializedName("garbageDisposal")
    val garbageDisposal: Boolean? = null
)

/**
 * Geocode position coordinates.
 */
data class GeocodePosition(
    @SerializedName("lat")
    val lat: Double? = null,

    @SerializedName("lon")
    val lon: Double? = null
)

/**
 * Geocode result address.
 */
data class GeocodeResultAddress(
    @SerializedName("country")
    val country: String? = null,

    @SerializedName("localName")
    val localName: String? = null,

    @SerializedName("postalCode")
    val postalCode: String? = null,

    @SerializedName("streetName")
    val streetName: String? = null,

    @SerializedName("countryCode")
    val countryCode: String? = null,

    @SerializedName("municipality")
    val municipality: String? = null,

    @SerializedName("streetNumber")
    val streetNumber: String? = null,

    @SerializedName("freeformAddress")
    val freeformAddress: String? = null
)

/**
 * Geocode result.
 */
data class GeocodeResult(
    @SerializedName("id")
    val id: String? = null,

    @SerializedName("type")
    val type: String? = null,

    @SerializedName("score")
    val score: Double? = null,

    @SerializedName("address")
    val address: GeocodeResultAddress? = null,

    @SerializedName("position")
    val position: GeocodePosition? = null
)

/**
 * Geocode summary.
 */
data class GeocodeSummary(
    @SerializedName("query")
    val query: String? = null,

    @SerializedName("queryTime")
    val queryTime: Int? = null
)

/**
 * Geocode address containing results and summary.
 */
data class GeocodeAddress(
    @SerializedName("results")
    val results: List<GeocodeResult>? = null,

    @SerializedName("summary")
    val summary: GeocodeSummary? = null
)

/**
 * Property descriptives containing detailed property information.
 * Matches iOS PropertyDescriptives implementation.
 */
data class PropertyDescriptives(
    // Basic Property Info
    @SerializedName("propertyType")
    val propertyType: String? = null,

    @SerializedName("yearBuilt")
    val yearBuilt: Int? = null,

    @SerializedName("squareFootage")
    val squareFootage: Int? = null,

    @SerializedName("lotSize")
    val lotSize: String? = null,

    @SerializedName("stories")
    val stories: Int? = null,

    @SerializedName("bedrooms")
    val bedrooms: Int? = null,

    @SerializedName("bathrooms")
    val bathrooms: String? = null,

    @SerializedName("unitNumber")
    val unitNumber: String? = null,

    // Access & Security
    @SerializedName("gatedCommunity")
    val gatedCommunity: Boolean? = null,

    @SerializedName("accessCode")
    val accessCode: String? = null,

    @SerializedName("accessInstructions")
    val accessInstructions: String? = null,

    @SerializedName("parkingType")
    val parkingType: String? = null,

    @SerializedName("parkingSpaces")
    val parkingSpaces: Int? = null,

    // Structure & Features
    @SerializedName("basement")
    val basement: Boolean? = null,

    @SerializedName("basementType")
    val basementType: String? = null,

    @SerializedName("garage")
    val garage: Boolean? = null,

    @SerializedName("garageType")
    val garageType: String? = null,

    @SerializedName("garageSpaces")
    val garageSpaces: Int? = null,

    @SerializedName("attic")
    val attic: Boolean? = null,

    @SerializedName("atticAccess")
    val atticAccess: String? = null,

    @SerializedName("crawlSpace")
    val crawlSpace: Boolean? = null,

    // HVAC & Climate Control
    @SerializedName("heatingSystem")
    val heatingSystem: String? = null,

    @SerializedName("heatingFuel")
    val heatingFuel: String? = null,

    @SerializedName("coolingSystem")
    val coolingSystem: String? = null,

    @SerializedName("airConditioning")
    val airConditioning: Boolean? = null,

    @SerializedName("hvacAge")
    val hvacAge: Int? = null,

    @SerializedName("hvacBrand")
    val hvacBrand: String? = null,

    @SerializedName("hvacModel")
    val hvacModel: String? = null,

    @SerializedName("thermostatType")
    val thermostatType: String? = null,

    // Utilities & Systems
    @SerializedName("utilities")
    val utilities: PropertyUtilities? = null,

    @SerializedName("waterSource")
    val waterSource: String? = null,

    @SerializedName("sewerSystem")
    val sewerSystem: String? = null,

    @SerializedName("electricalPanel")
    val electricalPanel: String? = null,

    @SerializedName("electricalAmps")
    val electricalAmps: Int? = null,

    @SerializedName("gasService")
    val gasService: Boolean? = null,

    @SerializedName("waterHeater")
    val waterHeater: PropertyWaterHeater? = null,

    // Plumbing
    @SerializedName("plumbingType")
    val plumbingType: String? = null,

    @SerializedName("waterShutoffLocation")
    val waterShutoffLocation: String? = null,

    @SerializedName("mainDrainCleanout")
    val mainDrainCleanout: String? = null,

    // Electrical
    @SerializedName("electricalPanelLocation")
    val electricalPanelLocation: String? = null,

    @SerializedName("wiringType")
    val wiringType: String? = null,

    // Roofing & Exterior
    @SerializedName("roofType")
    val roofType: String? = null,

    @SerializedName("roofAge")
    val roofAge: String? = null,

    @SerializedName("exteriorMaterial")
    val exteriorMaterial: String? = null,

    @SerializedName("foundationType")
    val foundationType: String? = null,

    // Appliances
    @SerializedName("appliances")
    val appliances: PropertyAppliances? = null,

    // Smart Home & Internet
    @SerializedName("internetService")
    val internetService: Boolean? = null,

    @SerializedName("internetProvider")
    val internetProvider: String? = null,

    @SerializedName("smartHomeDevices")
    val smartHomeDevices: List<String>? = null,

    // Landscaping & Exterior
    @SerializedName("sprinklerSystem")
    val sprinklerSystem: Boolean? = null,

    @SerializedName("pool")
    val pool: Boolean? = null,

    @SerializedName("poolType")
    val poolType: String? = null,

    @SerializedName("fence")
    val fence: Boolean? = null,

    @SerializedName("fenceType")
    val fenceType: String? = null,

    @SerializedName("deck")
    val deck: Boolean? = null,

    @SerializedName("deckMaterial")
    val deckMaterial: String? = null,

    @SerializedName("patio")
    val patio: Boolean? = null,

    @SerializedName("patioMaterial")
    val patioMaterial: String? = null,

    // Special Considerations
    @SerializedName("petFriendly")
    val petFriendly: Boolean? = null,

    @SerializedName("smokingAllowed")
    val smokingAllowed: Boolean? = null,

    @SerializedName("wheelchairAccessible")
    val wheelchairAccessible: Boolean? = null,

    @SerializedName("fireplace")
    val fireplace: Boolean? = null,

    @SerializedName("fireplaceType")
    val fireplaceType: String? = null,

    // Maintenance & Notes
    @SerializedName("maintenanceNotes")
    val maintenanceNotes: String? = null,

    @SerializedName("specialInstructions")
    val specialInstructions: String? = null,

    // Legacy field
    @SerializedName("created_from")
    val createdFrom: String? = null
)

/**
 * Property model matching iOS Property.swift implementation.
 */
data class Property(
    @SerializedName("id")
    val id: String,

    @SerializedName("title")
    val title: String,

    @SerializedName("description")
    val description: String,

    @SerializedName("address")
    val address: String,

    @SerializedName("city")
    val city: String,

    @SerializedName("state")
    val state: String,

    @SerializedName("zip_code")
    val zipCode: String,

    @SerializedName("county")
    val county: String? = null,

    @SerializedName("country")
    val country: String,

    @SerializedName("status")
    val status: PropertyStatus,

    @SerializedName("created_at")
    val createdAt: Date,

    @SerializedName("updated_at")
    val updatedAt: Date,

    @SerializedName("owner")
    val owner: String,

    @SerializedName("owner_details")
    val ownerDetails: User,

    @SerializedName("media_count")
    val mediaCount: Int,

    @SerializedName("descriptives")
    val descriptives: PropertyDescriptives? = null,

    @SerializedName("service_requests")
    val serviceRequests: List<ServiceRequest>? = null,

    @SerializedName("geocode_address")
    val geocodeAddress: GeocodeAddress? = null,

    @SerializedName("geocode_address_source")
    val geocodeAddressSource: String? = null,

    @SerializedName("permit_retrieval_status")
    val permitRetrievalStatus: String? = null,

    @SerializedName("permit_last_retrieved_at")
    val permitLastRetrievedAt: Date? = null,

    @SerializedName("permit_retrieval_error")
    val permitRetrievalError: String? = null,

    @SerializedName("permit_next_retrieval_at")
    val permitNextRetrievalAt: Date? = null,

    @SerializedName("permit_retrieval_workflow_id")
    val permitRetrievalWorkflowId: String? = null,

    @SerializedName("featuredImage")
    val featuredImage: String? = null,

    @SerializedName("media")
    val media: List<Media>? = null
) {
    /**
     * Full address string for display.
     */
    @Suppress("unused")
    val fullAddress: String
        get() = "$address, $city, $state $zipCode"
}
