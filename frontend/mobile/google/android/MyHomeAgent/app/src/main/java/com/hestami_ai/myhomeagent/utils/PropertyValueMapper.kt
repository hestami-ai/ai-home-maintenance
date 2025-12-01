package com.hestami_ai.myhomeagent.utils

/**
 * Utility object to map raw property values to human-readable display strings.
 * Matches iOS PropertyDetailView value mapping.
 */
object PropertyValueMapper {
    
    private val displayMap = mapOf(
        // Heating systems
        "forced_air" to "Forced Air",
        "radiant" to "Radiant",
        "heat_pump" to "Heat Pump",
        "baseboard" to "Baseboard",
        "boiler" to "Boiler",
        "geothermal" to "Geothermal",
        "electric" to "Electric",
        "gas" to "Gas",
        "oil" to "Oil",
        
        // Cooling systems
        "central_ac" to "Central AC",
        "window_units" to "Window Units",
        "evaporative" to "Evaporative",
        "ductless_mini_split" to "Ductless Mini-Split",
        "none" to "None",
        
        // Fuels
        "natural_gas" to "Natural Gas",
        "propane" to "Propane",
        "electricity" to "Electricity",
        
        // Roofing materials
        "asphalt_shingle" to "Asphalt Shingle",
        "metal" to "Metal",
        "tile" to "Tile",
        "slate" to "Slate",
        "wood_shake" to "Wood Shake",
        "flat" to "Flat",
        "rubber" to "Rubber",
        
        // Exterior materials
        "fiber_cement" to "Fiber Cement",
        "vinyl" to "Vinyl",
        "brick" to "Brick",
        "stucco" to "Stucco",
        "wood" to "Wood",
        "stone" to "Stone",
        "aluminum" to "Aluminum",
        
        // Fence types
        "chain_link" to "Chain Link",
        "wrought_iron" to "Wrought Iron",
        "wood_privacy" to "Wood Privacy",
        "vinyl_privacy" to "Vinyl Privacy",
        "split_rail" to "Split Rail",
        "picket" to "Picket",
        
        // Foundation types
        "pier_beam" to "Pier & Beam",
        "slab" to "Slab",
        "crawl_space" to "Crawl Space",
        "basement" to "Basement",
        "raised" to "Raised",
        
        // Pool types
        "inground" to "In-Ground",
        "aboveground" to "Above-Ground",
        "infinity" to "Infinity",
        "lap" to "Lap Pool",
        
        // Basement types
        "finished" to "Finished",
        "unfinished" to "Unfinished",
        "partial" to "Partially Finished",
        
        // Garage types
        "attached" to "Attached",
        "detached" to "Detached",
        "carport" to "Carport",
        "built_in" to "Built-In",
        
        // Attic access
        "pull_down" to "Pull-Down Stairs",
        "scuttle" to "Scuttle Hole",
        "walk_up" to "Walk-Up Stairs",
        "none" to "None",
        
        // Water source
        "municipal" to "Municipal",
        "well" to "Well",
        "cistern" to "Cistern",
        
        // Sewer system
        "public" to "Public Sewer",
        "septic" to "Septic Tank",
        "cesspool" to "Cesspool",
        
        // Electrical panel
        "circuit_breaker" to "Circuit Breaker",
        "fuse_box" to "Fuse Box",
        
        // Thermostat types
        "smart" to "Smart",
        "programmable" to "Programmable",
        "manual" to "Manual",
        "wifi" to "WiFi-Enabled",
        
        // Property types
        "single_family" to "Single Family",
        "multi_family" to "Multi-Family",
        "condo" to "Condominium",
        "townhouse" to "Townhouse",
        "apartment" to "Apartment",
        "mobile_home" to "Mobile Home",
        "manufactured" to "Manufactured Home",
        "duplex" to "Duplex",
        "triplex" to "Triplex",
        "fourplex" to "Fourplex",
        
        // Parking types
        "street" to "Street",
        "driveway" to "Driveway",
        "garage" to "Garage",
        "carport" to "Carport",
        "lot" to "Parking Lot",
        
        // Deck/Patio materials
        "composite" to "Composite",
        "pressure_treated" to "Pressure-Treated Wood",
        "cedar" to "Cedar",
        "redwood" to "Redwood",
        "concrete" to "Concrete",
        "pavers" to "Pavers",
        "flagstone" to "Flagstone",
        
        // Fireplace types
        "wood_burning" to "Wood Burning",
        "gas_fireplace" to "Gas",
        "electric_fireplace" to "Electric",
        "pellet" to "Pellet"
    )
    
    /**
     * Convert a raw value to its human-readable display string.
     * Falls back to capitalizing the value if no mapping exists.
     */
    fun displayValue(value: String?): String {
        if (value == null) return "Unknown"
        return displayMap[value.lowercase()] ?: value.split("_")
            .joinToString(" ") { word ->
                word.replaceFirstChar { it.uppercase() }
            }
    }
    
    /**
     * Format a boolean value for display.
     */
    fun displayBoolean(value: Boolean?): String {
        return when (value) {
            true -> "Yes"
            false -> "No"
            null -> "Unknown"
        }
    }
}
