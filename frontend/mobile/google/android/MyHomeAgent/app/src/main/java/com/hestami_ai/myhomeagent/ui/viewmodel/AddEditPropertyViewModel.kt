package com.hestami_ai.myhomeagent.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hestami_ai.myhomeagent.data.model.Property
import com.hestami_ai.myhomeagent.data.model.PropertyDescriptives
import com.hestami_ai.myhomeagent.data.network.Result
import com.hestami_ai.myhomeagent.data.repository.PropertyRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber

/**
 * UI state for the add/edit property screen.
 */
data class AddEditPropertyUiState(
    // Basic Info
    val title: String = "",
    val description: String = "",
    val address: String = "",
    val city: String = "",
    val state: String = "",
    val zipCode: String = "",
    val county: String = "",
    val country: String = "United States",
    
    // Property Details
    val propertyType: String = "Single Family Home",
    val yearBuilt: String = "",
    val squareFootage: String = "",
    val lotSize: String = "",
    val stories: String = "",
    val bedrooms: String = "",
    val bathrooms: String = "",
    val unitNumber: String = "",
    
    // Structure & Features
    val basement: Boolean = false,
    val basementType: String = "None",
    val garage: Boolean = false,
    val garageType: String = "None",
    val garageSpaces: String = "",
    val attic: Boolean = false,
    val atticAccess: String = "None",
    val crawlSpace: Boolean = false,
    
    // HVAC
    val heatingSystem: String = "None",
    val heatingFuel: String = "None",
    val coolingSystem: String = "None",
    val airConditioning: Boolean = false,
    val hvacAge: String = "",
    val thermostatType: String = "Manual",
    
    // Exterior
    val roofType: String = "None",
    val roofAge: String = "",
    val exteriorMaterial: String = "None",
    val foundationType: String = "None",
    
    // Access & Security
    val gatedCommunity: Boolean = false,
    val accessCode: String = "",
    val accessInstructions: String = "",
    val parkingType: String = "None",
    val parkingSpaces: String = "",
    
    // Landscaping
    val sprinklerSystem: Boolean = false,
    val pool: Boolean = false,
    val poolType: String = "None",
    val fence: Boolean = false,
    val fenceType: String = "None",
    val deck: Boolean = false,
    val deckMaterial: String = "None",
    val patio: Boolean = false,
    val patioMaterial: String = "None",
    
    // Special Considerations
    val petFriendly: Boolean = false,
    val smokingAllowed: Boolean = false,
    val wheelchairAccessible: Boolean = false,
    val fireplace: Boolean = false,
    val fireplaceType: String = "None",
    
    // Notes
    val maintenanceNotes: String = "",
    val specialInstructions: String = "",
    
    // UI State
    val isLoading: Boolean = false,
    val error: String? = null,
    val isSuccess: Boolean = false,
    val savedProperty: Property? = null
)

/**
 * Option lists for dropdowns.
 */
object PropertyOptions {
    val propertyTypes = listOf(
        "Single Family Home", "Condominium", "Townhouse", "Apartment",
        "Multi-Family Home", "Vacation Home", "Mobile Home", "Commercial", "Other"
    )
    
    val countries = listOf("United States", "Canada", "Mexico", "Other")
    
    val usStates = listOf(
        "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
        "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
        "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
        "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
        "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
    )
    
    val basementTypes = listOf("None", "Finished", "Unfinished", "Partially Finished")
    val garageTypes = listOf("None", "Attached", "Detached")
    val atticAccessTypes = listOf("None", "Pull Down", "Stairway", "Scuttle")
    val heatingSystems = listOf("None", "Forced Air", "Radiant", "Heat Pump", "Baseboard", "Boiler", "Geothermal", "Other")
    val heatingFuels = listOf("None", "Natural Gas", "Electric", "Oil", "Propane", "Solar", "Other")
    val coolingSystems = listOf("None", "Central AC", "Heat Pump", "Window Units", "Evaporative", "Ductless Mini-Split", "Other")
    val thermostatTypes = listOf("Manual", "Programmable", "Smart")
    val roofTypes = listOf("None", "Asphalt Shingle", "Metal", "Tile", "Slate", "Flat", "Rubber", "Other")
    val exteriorMaterials = listOf("None", "Vinyl", "Brick", "Wood", "Stucco", "Stone", "Fiber Cement", "Mixed", "Other")
    val foundationTypes = listOf("None", "Slab", "Crawlspace", "Basement", "Pier & Beam")
    val parkingTypes = listOf("None", "Garage", "Driveway", "Street", "Carport", "Covered")
    val poolTypes = listOf("None", "In-Ground", "Above-Ground")
    val fenceTypes = listOf("None", "Wood", "Vinyl", "Chain Link", "Wrought Iron")
    val deckMaterials = listOf("None", "Wood", "Composite", "Vinyl", "Aluminum")
    val patioMaterials = listOf("None", "Concrete", "Pavers", "Stone", "Brick", "Tile")
    val fireplaceTypes = listOf("None", "Wood", "Gas", "Electric")
}

/**
 * Value mapping between display labels and backend values.
 */
object PropertyValueMaps {
    val propertyType = mapOf(
        "Single Family Home" to "single_family",
        "Condominium" to "condo",
        "Townhouse" to "townhome",
        "Apartment" to "apartment",
        "Multi-Family Home" to "multi_family",
        "Vacation Home" to "vacation_home",
        "Mobile Home" to "mobile_home",
        "Commercial" to "commercial",
        "Other" to "other"
    )
    
    val heatingSystem = mapOf(
        "Forced Air" to "forced_air",
        "Radiant" to "radiant",
        "Heat Pump" to "heat_pump",
        "Baseboard" to "baseboard",
        "Boiler" to "boiler",
        "Geothermal" to "geothermal",
        "None" to "none",
        "Other" to "other"
    )
    
    val heatingFuel = mapOf(
        "Natural Gas" to "natural_gas",
        "Electric" to "electric",
        "Oil" to "oil",
        "Propane" to "propane",
        "Solar" to "solar",
        "Other" to "other",
        "None" to "none"
    )
    
    val coolingSystem = mapOf(
        "Central AC" to "central_ac",
        "Heat Pump" to "heat_pump",
        "Window Units" to "window_units",
        "Evaporative" to "evaporative",
        "Ductless Mini-Split" to "ductless_mini_split",
        "None" to "none",
        "Other" to "other"
    )
    
    val thermostatType = mapOf(
        "Manual" to "manual",
        "Programmable" to "programmable",
        "Smart" to "smart"
    )
    
    val roofType = mapOf(
        "Asphalt Shingle" to "asphalt_shingle",
        "Metal" to "metal",
        "Tile" to "tile",
        "Slate" to "slate",
        "Flat" to "flat",
        "Rubber" to "rubber",
        "Other" to "other",
        "None" to "none"
    )
    
    val exteriorMaterial = mapOf(
        "Vinyl" to "vinyl",
        "Brick" to "brick",
        "Wood" to "wood",
        "Stucco" to "stucco",
        "Stone" to "stone",
        "Fiber Cement" to "fiber_cement",
        "Mixed" to "mixed",
        "Other" to "other",
        "None" to "none"
    )
    
    val foundationType = mapOf(
        "Slab" to "slab",
        "Crawlspace" to "crawlspace",
        "Basement" to "basement",
        "Pier & Beam" to "pier_beam",
        "None" to "none"
    )
    
    val basementType = mapOf(
        "Finished" to "finished",
        "Unfinished" to "unfinished",
        "Partially Finished" to "partial",
        "None" to "none"
    )
    
    val garageType = mapOf(
        "Attached" to "attached",
        "Detached" to "detached",
        "None" to "none"
    )
    
    val atticAccess = mapOf(
        "Pull Down" to "pull_down",
        "Stairway" to "stairway",
        "Scuttle" to "scuttle",
        "None" to "none"
    )
    
    val parkingType = mapOf(
        "Garage" to "garage",
        "Driveway" to "driveway",
        "Street" to "street",
        "Carport" to "carport",
        "Covered" to "covered",
        "None" to "none"
    )
    
    val poolType = mapOf(
        "In-Ground" to "inground",
        "Above-Ground" to "aboveground",
        "None" to "none"
    )
    
    val fenceType = mapOf(
        "Wood" to "wood",
        "Vinyl" to "vinyl",
        "Chain Link" to "chain_link",
        "Wrought Iron" to "wrought_iron",
        "None" to "none"
    )
    
    val deckMaterial = mapOf(
        "Wood" to "wood",
        "Composite" to "composite",
        "Vinyl" to "vinyl",
        "Aluminum" to "aluminum",
        "None" to "none"
    )
    
    val patioMaterial = mapOf(
        "Concrete" to "concrete",
        "Pavers" to "pavers",
        "Stone" to "stone",
        "Brick" to "brick",
        "Tile" to "tile",
        "None" to "none"
    )
    
    val fireplaceType = mapOf(
        "Wood" to "wood",
        "Gas" to "gas",
        "Electric" to "electric",
        "None" to "none"
    )
    
    fun toBackendValue(displayValue: String, map: Map<String, String>): String? {
        if (displayValue == "None") return null
        return map[displayValue] ?: displayValue.lowercase().replace(" ", "_")
    }
    
    fun toDisplayValue(backendValue: String?, map: Map<String, String>): String {
        if (backendValue == null) return "None"
        val reverseMap = map.entries.associate { (k, v) -> v to k }
        return reverseMap[backendValue] ?: backendValue
    }
}

/**
 * ViewModel for adding or editing a property.
 */
class AddEditPropertyViewModel : ViewModel() {

    companion object {
        private const val TAG = "AddEditPropertyVM"
    }

    private val repository = PropertyRepository()

    private val _uiState = MutableStateFlow(AddEditPropertyUiState())
    val uiState: StateFlow<AddEditPropertyUiState> = _uiState.asStateFlow()
    
    private var editingPropertyId: String? = null
    
    val isEditing: Boolean
        get() = editingPropertyId != null

    /**
     * Load an existing property for editing.
     */
    @Suppress("UNNECESSARY_SAFE_CALL")
    fun loadProperty(property: Property) {
        editingPropertyId = property.id
        Timber.d("Loading property for editing: ${property.id}")
        
        // Note: Using safe calls because Gson can deserialize null into non-nullable fields
        _uiState.value = _uiState.value.copy(
            // Basic Info
            title = property.title ?: "",
            description = property.description ?: "",
            address = property.address ?: "",
            city = property.city ?: "",
            state = property.state ?: "",
            zipCode = property.zipCode ?: "",
            county = property.county ?: "",
            country = property.country ?: "United States"
        )
        
        // Load descriptives if available
        property.descriptives?.let { desc ->
            _uiState.value = _uiState.value.copy(
                // Property Details
                propertyType = PropertyValueMaps.toDisplayValue(desc.propertyType, PropertyValueMaps.propertyType),
                yearBuilt = desc.yearBuilt?.toString() ?: "",
                squareFootage = desc.squareFootage?.toString() ?: "",
                lotSize = desc.lotSize ?: "",
                stories = desc.stories?.toString() ?: "",
                bedrooms = desc.bedrooms?.toString() ?: "",
                bathrooms = desc.bathrooms ?: "",
                unitNumber = desc.unitNumber ?: "",
                
                // Structure & Features
                basement = desc.basement ?: false,
                basementType = PropertyValueMaps.toDisplayValue(desc.basementType, PropertyValueMaps.basementType),
                garage = desc.garage ?: false,
                garageType = PropertyValueMaps.toDisplayValue(desc.garageType, PropertyValueMaps.garageType),
                garageSpaces = desc.garageSpaces?.toString() ?: "",
                attic = desc.attic ?: false,
                atticAccess = PropertyValueMaps.toDisplayValue(desc.atticAccess, PropertyValueMaps.atticAccess),
                crawlSpace = desc.crawlSpace ?: false,
                
                // HVAC
                heatingSystem = PropertyValueMaps.toDisplayValue(desc.heatingSystem, PropertyValueMaps.heatingSystem),
                heatingFuel = PropertyValueMaps.toDisplayValue(desc.heatingFuel, PropertyValueMaps.heatingFuel),
                coolingSystem = PropertyValueMaps.toDisplayValue(desc.coolingSystem, PropertyValueMaps.coolingSystem),
                airConditioning = desc.airConditioning ?: false,
                hvacAge = desc.hvacAge?.toString() ?: "",
                thermostatType = PropertyValueMaps.toDisplayValue(desc.thermostatType, PropertyValueMaps.thermostatType),
                
                // Exterior
                roofType = PropertyValueMaps.toDisplayValue(desc.roofType, PropertyValueMaps.roofType),
                roofAge = desc.roofAge ?: "",
                exteriorMaterial = PropertyValueMaps.toDisplayValue(desc.exteriorMaterial, PropertyValueMaps.exteriorMaterial),
                foundationType = PropertyValueMaps.toDisplayValue(desc.foundationType, PropertyValueMaps.foundationType),
                
                // Access & Security
                gatedCommunity = desc.gatedCommunity ?: false,
                accessCode = desc.accessCode ?: "",
                accessInstructions = desc.accessInstructions ?: "",
                parkingType = PropertyValueMaps.toDisplayValue(desc.parkingType, PropertyValueMaps.parkingType),
                parkingSpaces = desc.parkingSpaces?.toString() ?: "",
                
                // Landscaping
                sprinklerSystem = desc.sprinklerSystem ?: false,
                pool = desc.pool ?: false,
                poolType = PropertyValueMaps.toDisplayValue(desc.poolType, PropertyValueMaps.poolType),
                fence = desc.fence ?: false,
                fenceType = PropertyValueMaps.toDisplayValue(desc.fenceType, PropertyValueMaps.fenceType),
                deck = desc.deck ?: false,
                deckMaterial = PropertyValueMaps.toDisplayValue(desc.deckMaterial, PropertyValueMaps.deckMaterial),
                patio = desc.patio ?: false,
                patioMaterial = PropertyValueMaps.toDisplayValue(desc.patioMaterial, PropertyValueMaps.patioMaterial),
                
                // Special Considerations
                petFriendly = desc.petFriendly ?: false,
                smokingAllowed = desc.smokingAllowed ?: false,
                wheelchairAccessible = desc.wheelchairAccessible ?: false,
                fireplace = desc.fireplace ?: false,
                fireplaceType = PropertyValueMaps.toDisplayValue(desc.fireplaceType, PropertyValueMaps.fireplaceType),
                
                // Notes
                maintenanceNotes = desc.maintenanceNotes ?: "",
                specialInstructions = desc.specialInstructions ?: ""
            )
        }
    }

    // Update functions for all fields
    fun updateTitle(value: String) { _uiState.value = _uiState.value.copy(title = value) }
    fun updateDescription(value: String) { _uiState.value = _uiState.value.copy(description = value) }
    fun updateAddress(value: String) { _uiState.value = _uiState.value.copy(address = value) }
    fun updateCity(value: String) { _uiState.value = _uiState.value.copy(city = value) }
    fun updateState(value: String) { _uiState.value = _uiState.value.copy(state = value) }
    fun updateZipCode(value: String) { _uiState.value = _uiState.value.copy(zipCode = value) }
    fun updateCounty(value: String) { _uiState.value = _uiState.value.copy(county = value) }
    fun updateCountry(value: String) { _uiState.value = _uiState.value.copy(country = value) }
    fun updatePropertyType(value: String) { _uiState.value = _uiState.value.copy(propertyType = value) }
    fun updateYearBuilt(value: String) { _uiState.value = _uiState.value.copy(yearBuilt = value) }
    fun updateSquareFootage(value: String) { _uiState.value = _uiState.value.copy(squareFootage = value) }
    fun updateLotSize(value: String) { _uiState.value = _uiState.value.copy(lotSize = value) }
    fun updateStories(value: String) { _uiState.value = _uiState.value.copy(stories = value) }
    fun updateBedrooms(value: String) { _uiState.value = _uiState.value.copy(bedrooms = value) }
    fun updateBathrooms(value: String) { _uiState.value = _uiState.value.copy(bathrooms = value) }
    fun updateUnitNumber(value: String) { _uiState.value = _uiState.value.copy(unitNumber = value) }
    fun updateBasement(value: Boolean) { _uiState.value = _uiState.value.copy(basement = value) }
    fun updateBasementType(value: String) { _uiState.value = _uiState.value.copy(basementType = value) }
    fun updateGarage(value: Boolean) { _uiState.value = _uiState.value.copy(garage = value) }
    fun updateGarageType(value: String) { _uiState.value = _uiState.value.copy(garageType = value) }
    fun updateGarageSpaces(value: String) { _uiState.value = _uiState.value.copy(garageSpaces = value) }
    fun updateAttic(value: Boolean) { _uiState.value = _uiState.value.copy(attic = value) }
    fun updateAtticAccess(value: String) { _uiState.value = _uiState.value.copy(atticAccess = value) }
    fun updateCrawlSpace(value: Boolean) { _uiState.value = _uiState.value.copy(crawlSpace = value) }
    fun updateHeatingSystem(value: String) { _uiState.value = _uiState.value.copy(heatingSystem = value) }
    fun updateHeatingFuel(value: String) { _uiState.value = _uiState.value.copy(heatingFuel = value) }
    fun updateCoolingSystem(value: String) { _uiState.value = _uiState.value.copy(coolingSystem = value) }
    fun updateAirConditioning(value: Boolean) { _uiState.value = _uiState.value.copy(airConditioning = value) }
    fun updateHvacAge(value: String) { _uiState.value = _uiState.value.copy(hvacAge = value) }
    fun updateThermostatType(value: String) { _uiState.value = _uiState.value.copy(thermostatType = value) }
    fun updateRoofType(value: String) { _uiState.value = _uiState.value.copy(roofType = value) }
    fun updateRoofAge(value: String) { _uiState.value = _uiState.value.copy(roofAge = value) }
    fun updateExteriorMaterial(value: String) { _uiState.value = _uiState.value.copy(exteriorMaterial = value) }
    fun updateFoundationType(value: String) { _uiState.value = _uiState.value.copy(foundationType = value) }
    fun updateGatedCommunity(value: Boolean) { _uiState.value = _uiState.value.copy(gatedCommunity = value) }
    fun updateAccessCode(value: String) { _uiState.value = _uiState.value.copy(accessCode = value) }
    fun updateAccessInstructions(value: String) { _uiState.value = _uiState.value.copy(accessInstructions = value) }
    fun updateParkingType(value: String) { _uiState.value = _uiState.value.copy(parkingType = value) }
    fun updateParkingSpaces(value: String) { _uiState.value = _uiState.value.copy(parkingSpaces = value) }
    fun updateSprinklerSystem(value: Boolean) { _uiState.value = _uiState.value.copy(sprinklerSystem = value) }
    fun updatePool(value: Boolean) { _uiState.value = _uiState.value.copy(pool = value) }
    fun updatePoolType(value: String) { _uiState.value = _uiState.value.copy(poolType = value) }
    fun updateFence(value: Boolean) { _uiState.value = _uiState.value.copy(fence = value) }
    fun updateFenceType(value: String) { _uiState.value = _uiState.value.copy(fenceType = value) }
    fun updateDeck(value: Boolean) { _uiState.value = _uiState.value.copy(deck = value) }
    fun updateDeckMaterial(value: String) { _uiState.value = _uiState.value.copy(deckMaterial = value) }
    fun updatePatio(value: Boolean) { _uiState.value = _uiState.value.copy(patio = value) }
    fun updatePatioMaterial(value: String) { _uiState.value = _uiState.value.copy(patioMaterial = value) }
    fun updatePetFriendly(value: Boolean) { _uiState.value = _uiState.value.copy(petFriendly = value) }
    fun updateSmokingAllowed(value: Boolean) { _uiState.value = _uiState.value.copy(smokingAllowed = value) }
    fun updateWheelchairAccessible(value: Boolean) { _uiState.value = _uiState.value.copy(wheelchairAccessible = value) }
    fun updateFireplace(value: Boolean) { _uiState.value = _uiState.value.copy(fireplace = value) }
    fun updateFireplaceType(value: String) { _uiState.value = _uiState.value.copy(fireplaceType = value) }
    fun updateMaintenanceNotes(value: String) { _uiState.value = _uiState.value.copy(maintenanceNotes = value) }
    fun updateSpecialInstructions(value: String) { _uiState.value = _uiState.value.copy(specialInstructions = value) }

    /**
     * Validate the form fields.
     */
    private fun validateForm(): Boolean {
        val state = _uiState.value
        
        if (state.title.isBlank()) {
            _uiState.value = state.copy(error = "Property name is required")
            return false
        }
        if (state.address.isBlank()) {
            _uiState.value = state.copy(error = "Street address is required")
            return false
        }
        if (state.city.isBlank()) {
            _uiState.value = state.copy(error = "City is required")
            return false
        }
        if (state.state.isBlank()) {
            _uiState.value = state.copy(error = "State is required")
            return false
        }
        if (state.zipCode.isBlank()) {
            _uiState.value = state.copy(error = "ZIP code is required")
            return false
        }
        if (state.zipCode.length < 5) {
            _uiState.value = state.copy(error = "Please enter a valid ZIP code")
            return false
        }
        
        return true
    }

    /**
     * Build PropertyDescriptives from current state.
     */
    private fun buildDescriptives(): PropertyDescriptives {
        val state = _uiState.value
        return PropertyDescriptives(
            propertyType = PropertyValueMaps.toBackendValue(state.propertyType, PropertyValueMaps.propertyType),
            yearBuilt = state.yearBuilt.toIntOrNull(),
            squareFootage = state.squareFootage.toIntOrNull(),
            lotSize = state.lotSize.ifBlank { null },
            stories = state.stories.toIntOrNull(),
            bedrooms = state.bedrooms.toIntOrNull(),
            bathrooms = state.bathrooms.ifBlank { null },
            unitNumber = state.unitNumber.ifBlank { null },
            
            basement = state.basement,
            basementType = PropertyValueMaps.toBackendValue(state.basementType, PropertyValueMaps.basementType),
            garage = state.garage,
            garageType = PropertyValueMaps.toBackendValue(state.garageType, PropertyValueMaps.garageType),
            garageSpaces = state.garageSpaces.toIntOrNull(),
            attic = state.attic,
            atticAccess = PropertyValueMaps.toBackendValue(state.atticAccess, PropertyValueMaps.atticAccess),
            crawlSpace = state.crawlSpace,
            
            heatingSystem = PropertyValueMaps.toBackendValue(state.heatingSystem, PropertyValueMaps.heatingSystem),
            heatingFuel = PropertyValueMaps.toBackendValue(state.heatingFuel, PropertyValueMaps.heatingFuel),
            coolingSystem = PropertyValueMaps.toBackendValue(state.coolingSystem, PropertyValueMaps.coolingSystem),
            airConditioning = state.airConditioning,
            hvacAge = state.hvacAge.toIntOrNull(),
            thermostatType = PropertyValueMaps.toBackendValue(state.thermostatType, PropertyValueMaps.thermostatType),
            
            roofType = PropertyValueMaps.toBackendValue(state.roofType, PropertyValueMaps.roofType),
            roofAge = state.roofAge.ifBlank { null },
            exteriorMaterial = PropertyValueMaps.toBackendValue(state.exteriorMaterial, PropertyValueMaps.exteriorMaterial),
            foundationType = PropertyValueMaps.toBackendValue(state.foundationType, PropertyValueMaps.foundationType),
            
            gatedCommunity = state.gatedCommunity,
            accessCode = state.accessCode.ifBlank { null },
            accessInstructions = state.accessInstructions.ifBlank { null },
            parkingType = PropertyValueMaps.toBackendValue(state.parkingType, PropertyValueMaps.parkingType),
            parkingSpaces = state.parkingSpaces.toIntOrNull(),
            
            sprinklerSystem = state.sprinklerSystem,
            pool = state.pool,
            poolType = PropertyValueMaps.toBackendValue(state.poolType, PropertyValueMaps.poolType),
            fence = state.fence,
            fenceType = PropertyValueMaps.toBackendValue(state.fenceType, PropertyValueMaps.fenceType),
            deck = state.deck,
            deckMaterial = PropertyValueMaps.toBackendValue(state.deckMaterial, PropertyValueMaps.deckMaterial),
            patio = state.patio,
            patioMaterial = PropertyValueMaps.toBackendValue(state.patioMaterial, PropertyValueMaps.patioMaterial),
            
            petFriendly = state.petFriendly,
            smokingAllowed = state.smokingAllowed,
            wheelchairAccessible = state.wheelchairAccessible,
            fireplace = state.fireplace,
            fireplaceType = PropertyValueMaps.toBackendValue(state.fireplaceType, PropertyValueMaps.fireplaceType),
            
            maintenanceNotes = state.maintenanceNotes.ifBlank { null },
            specialInstructions = state.specialInstructions.ifBlank { null },
            
            createdFrom = "android_app"
        )
    }

    /**
     * Submit the property form (create or update).
     */
    fun submitProperty() {
        if (!validateForm()) return

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            val state = _uiState.value
            
            if (isEditing) {
                // Update existing property
                when (val result = repository.updateProperty(
                    id = editingPropertyId!!,
                    title = state.title,
                    description = state.description,
                    address = state.address,
                    city = state.city,
                    state = state.state,
                    zipCode = state.zipCode
                )) {
                    is Result.Success -> {
                        Timber.d("Property updated: ${result.data.id}")
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            isSuccess = true,
                            savedProperty = result.data
                        )
                    }
                    is Result.Error -> {
                        Timber.e("Failed to update property: ${result.error.message}")
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            error = result.error.message
                        )
                    }
                    is Result.Loading -> {}
                }
            } else {
                // Create new property
                when (val result = repository.createProperty(
                    title = state.title,
                    description = state.description,
                    address = state.address,
                    city = state.city,
                    state = state.state,
                    zipCode = state.zipCode
                )) {
                    is Result.Success -> {
                        Timber.d("Property created: ${result.data.id}")
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            isSuccess = true,
                            savedProperty = result.data
                        )
                    }
                    is Result.Error -> {
                        Timber.e("Failed to create property: ${result.error.message}")
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            error = result.error.message
                        )
                    }
                    is Result.Loading -> {}
                }
            }
        }
    }

    /**
     * Clear error state.
     */
    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    /**
     * Reset the form.
     */
    fun resetForm() {
        editingPropertyId = null
        _uiState.value = AddEditPropertyUiState()
    }
}
