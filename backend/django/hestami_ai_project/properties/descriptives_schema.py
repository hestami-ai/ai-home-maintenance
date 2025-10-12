"""
Property descriptives default schema and field definitions.
This provides the structure for the Property.descriptives JSONField without requiring Pydantic.
"""

# Default empty descriptives structure
DEFAULT_DESCRIPTIVES = {
    # Basic Property Info
    "propertyType": None,  # single_family, townhome, condo, apartment, multi_family, commercial, other
    "yearBuilt": None,
    "squareFootage": None,
    "lotSize": None,
    "stories": None,
    "bedrooms": None,
    "bathrooms": None,
    "unitNumber": None,
    
    # Access & Security
    "gatedCommunity": False,
    "accessCode": None,
    "accessInstructions": None,
    "parkingType": None,  # garage, driveway, street, carport, covered, none
    "parkingSpaces": None,
    
    # Structure & Features
    "basement": False,
    "basementType": None,  # finished, unfinished, partial, none
    "garage": False,
    "garageType": None,  # attached, detached, none
    "garageSpaces": None,
    "attic": False,
    "atticAccess": None,  # pull_down, stairway, scuttle, none
    "crawlSpace": False,
    
    # HVAC & Climate Control
    "heatingSystem": None,  # forced_air, radiant, heat_pump, baseboard, boiler, geothermal, none, other
    "heatingFuel": None,  # natural_gas, electric, oil, propane, solar, other
    "coolingSystem": None,  # central_ac, heat_pump, window_units, evaporative, ductless_mini_split, none, other
    "airConditioning": False,
    "hvacAge": None,
    "hvacBrand": None,
    "hvacModel": None,
    "thermostatType": None,  # programmable, smart, manual
    
    # Utilities & Systems
    "utilities": {
        "gas": None,
        "sewer": None,
        "water": None,
        "electricity": None,
        "internetCable": None,
    },
    "waterSource": None,  # municipal, well, shared
    "sewerSystem": None,  # municipal, septic, shared
    "electricalPanel": None,  # breaker, fuse
    "electricalAmps": None,
    "gasService": False,
    "waterHeater": {
        "type": None,  # tank, tankless, hybrid, solar, other
        "fuel": None,  # electric, gas, propane, solar, other
        "capacity": None,
        "age": None,
        "brand": None,
        "model": None,
    },
    
    # Plumbing
    "plumbingType": None,  # copper, pex, galvanized, pvc, mixed
    "waterShutoffLocation": None,
    "mainDrainCleanout": None,
    
    # Electrical
    "electricalPanelLocation": None,
    "wiringType": None,  # copper, aluminum, knob_tube, mixed
    
    # Roofing & Exterior
    "roofType": None,  # asphalt_shingle, metal, tile, slate, flat, rubber, other
    "roofAge": None,
    "exteriorMaterial": None,  # vinyl, brick, wood, stucco, stone, fiber_cement, mixed, other
    "foundationType": None,  # slab, crawlspace, basement, pier_beam
    
    # Appliances
    "appliances": {
        "refrigerator": False,
        "stove": False,
        "dishwasher": False,
        "washer": False,
        "dryer": False,
        "microwave": False,
        "oven": False,
        "range": False,
        "garbageDisposal": False,
    },
    
    # Smart Home & Internet
    "internetService": False,
    "internetProvider": None,
    "smartHomeDevices": [],
    
    # Landscaping & Exterior
    "sprinklerSystem": False,
    "pool": False,
    "poolType": None,  # inground, aboveground, none
    "fence": False,
    "fenceType": None,  # wood, vinyl, chain_link, wrought_iron, none
    "deck": False,
    "deckMaterial": None,  # wood, composite, vinyl, aluminum, none
    "patio": False,
    "patioMaterial": None,  # concrete, pavers, stone, brick, tile, none
    
    # Special Considerations
    "petFriendly": False,
    "smokingAllowed": False,
    "wheelchairAccessible": False,
    "fireplace": False,
    "fireplaceType": None,  # wood, gas, electric, none
    
    # Maintenance & Notes
    "maintenanceNotes": None,
    "specialInstructions": None,
}


# Field choices for dropdowns
PROPERTY_TYPE_CHOICES = [
    ("single_family", "Single Family"),
    ("townhome", "Townhome"),
    ("condo", "Condo"),
    ("apartment", "Apartment"),
    ("multi_family", "Multi-Family"),
    ("commercial", "Commercial"),
    ("other", "Other"),
]

HEATING_SYSTEM_CHOICES = [
    ("forced_air", "Forced Air"),
    ("radiant", "Radiant"),
    ("heat_pump", "Heat Pump"),
    ("baseboard", "Baseboard"),
    ("boiler", "Boiler"),
    ("geothermal", "Geothermal"),
    ("none", "None"),
    ("other", "Other"),
]

COOLING_SYSTEM_CHOICES = [
    ("central_ac", "Central AC"),
    ("heat_pump", "Heat Pump"),
    ("window_units", "Window Units"),
    ("evaporative", "Evaporative"),
    ("ductless_mini_split", "Ductless Mini-Split"),
    ("none", "None"),
    ("other", "Other"),
]

ROOF_TYPE_CHOICES = [
    ("asphalt_shingle", "Asphalt Shingle"),
    ("metal", "Metal"),
    ("tile", "Tile"),
    ("slate", "Slate"),
    ("flat", "Flat"),
    ("rubber", "Rubber"),
    ("other", "Other"),
]

EXTERIOR_MATERIAL_CHOICES = [
    ("vinyl", "Vinyl"),
    ("brick", "Brick"),
    ("wood", "Wood"),
    ("stucco", "Stucco"),
    ("stone", "Stone"),
    ("fiber_cement", "Fiber Cement"),
    ("mixed", "Mixed"),
    ("other", "Other"),
]

FOUNDATION_TYPE_CHOICES = [
    ("slab", "Slab"),
    ("crawlspace", "Crawlspace"),
    ("basement", "Basement"),
    ("pier_beam", "Pier & Beam"),
]

PARKING_TYPE_CHOICES = [
    ("garage", "Garage"),
    ("driveway", "Driveway"),
    ("street", "Street"),
    ("carport", "Carport"),
    ("covered", "Covered"),
    ("none", "None"),
]

BASEMENT_TYPE_CHOICES = [
    ("finished", "Finished"),
    ("unfinished", "Unfinished"),
    ("partial", "Partially Finished"),
    ("none", "None"),
]

GARAGE_TYPE_CHOICES = [
    ("attached", "Attached"),
    ("detached", "Detached"),
    ("none", "None"),
]

POOL_TYPE_CHOICES = [
    ("inground", "In-Ground"),
    ("aboveground", "Above-Ground"),
    ("none", "None"),
]

FENCE_TYPE_CHOICES = [
    ("wood", "Wood"),
    ("vinyl", "Vinyl"),
    ("chain_link", "Chain Link"),
    ("wrought_iron", "Wrought Iron"),
    ("none", "None"),
]

DECK_MATERIAL_CHOICES = [
    ("wood", "Wood"),
    ("composite", "Composite"),
    ("vinyl", "Vinyl"),
    ("aluminum", "Aluminum"),
    ("none", "None"),
]

PATIO_MATERIAL_CHOICES = [
    ("concrete", "Concrete"),
    ("pavers", "Pavers"),
    ("stone", "Stone"),
    ("brick", "Brick"),
    ("tile", "Tile"),
    ("none", "None"),
]


def get_default_descriptives():
    """
    Return a deep copy of the default descriptives structure.
    Use this when creating new properties to ensure nested dicts are independent.
    """
    import copy
    return copy.deepcopy(DEFAULT_DESCRIPTIVES)


def merge_descriptives(existing: dict, updates: dict) -> dict:
    """
    Merge updates into existing descriptives, preserving structure.
    
    Args:
        existing: Current descriptives dict
        updates: New values to merge in
        
    Returns:
        Merged descriptives dict
    """
    import copy
    result = copy.deepcopy(existing) if existing else get_default_descriptives()
    
    def deep_merge(base, update):
        """Recursively merge update into base."""
        for key, value in update.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                deep_merge(base[key], value)
            else:
                base[key] = value
        return base
    
    return deep_merge(result, updates)
