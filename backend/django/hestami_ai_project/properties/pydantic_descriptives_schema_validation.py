"""
Property descriptives schema definitions.
Provides validation and structure for the Property.descriptives JSONField.
"""
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, validator


class WaterHeaterSchema(BaseModel):
    """Water heater system details."""
    type: Optional[Literal["tank", "tankless", "hybrid", "solar", "other"]] = None
    fuel: Optional[Literal["electric", "gas", "propane", "solar", "other"]] = None
    capacity: Optional[int] = Field(None, description="Capacity in gallons")
    age: Optional[int] = Field(None, description="Age in years")
    brand: Optional[str] = None
    model: Optional[str] = None


class AppliancesSchema(BaseModel):
    """Appliances included with property."""
    refrigerator: bool = False
    stove: bool = False
    dishwasher: bool = False
    washer: bool = False
    dryer: bool = False
    microwave: bool = False
    oven: bool = False
    range: bool = False
    garbage_disposal: bool = False


class UtilitiesSchema(BaseModel):
    """Utility service details."""
    gas: Optional[str] = Field(None, description="Gas service provider or status")
    sewer: Optional[str] = Field(None, description="Sewer service type or provider")
    water: Optional[str] = Field(None, description="Water service provider or status")
    electricity: Optional[str] = Field(None, description="Electric service provider")
    internet_cable: Optional[str] = Field(None, alias="internetCable", description="Internet/cable provider")


class PropertyDescriptivesSchema(BaseModel):
    """
    Comprehensive property descriptives schema.
    Based on industry standards (RESO) with focus on maintenance and service provider needs.
    """
    
    # Basic Property Info
    property_type: Optional[Literal[
        "single_family", "townhome", "condo", "apartment", 
        "multi_family", "commercial", "other"
    ]] = Field(None, alias="propertyType")
    year_built: Optional[int] = Field(None, alias="yearBuilt", ge=1800, le=2100)
    square_footage: Optional[int] = Field(None, alias="squareFootage", gt=0)
    lot_size: Optional[int] = Field(None, alias="lotSize", description="Lot size in square feet")
    stories: Optional[int] = Field(None, ge=1, le=10)
    bedrooms: Optional[int] = Field(None, ge=0, le=50)
    bathrooms: Optional[float] = Field(None, ge=0, le=50, description="Can be decimal (1.5, 2.5)")
    unit_number: Optional[str] = Field(None, alias="unitNumber", description="For condos/apartments")
    
    # Access & Security
    gated_community: bool = Field(False, alias="gatedCommunity")
    access_code: Optional[str] = Field(None, alias="accessCode", description="Gate code, lockbox code, etc.")
    access_instructions: Optional[str] = Field(None, alias="accessInstructions")
    parking_type: Optional[Literal[
        "garage", "driveway", "street", "carport", "covered", "none"
    ]] = Field(None, alias="parkingType")
    parking_spaces: Optional[int] = Field(None, alias="parkingSpaces", ge=0)
    
    # Structure & Features
    basement: bool = False
    basement_type: Optional[Literal["finished", "unfinished", "partial", "none"]] = Field(
        None, alias="basementType"
    )
    garage: bool = False
    garage_type: Optional[Literal["attached", "detached", "none"]] = Field(None, alias="garageType")
    garage_spaces: Optional[int] = Field(None, alias="garageSpaces", ge=0)
    attic: bool = False
    attic_access: Optional[Literal["pull_down", "stairway", "scuttle", "none"]] = Field(
        None, alias="atticAccess"
    )
    crawl_space: bool = Field(False, alias="crawlSpace")
    
    # HVAC & Climate Control (Critical for service providers)
    heating_system: Optional[Literal[
        "forced_air", "radiant", "heat_pump", "baseboard", 
        "boiler", "geothermal", "none", "other"
    ]] = Field(None, alias="heatingSystem")
    heating_fuel: Optional[Literal[
        "natural_gas", "electric", "oil", "propane", "solar", "other"
    ]] = Field(None, alias="heatingFuel")
    cooling_system: Optional[Literal[
        "central_ac", "heat_pump", "window_units", "evaporative", 
        "ductless_mini_split", "none", "other"
    ]] = Field(None, alias="coolingSystem")
    air_conditioning: bool = Field(False, alias="airConditioning")
    hvac_age: Optional[int] = Field(None, alias="hvacAge", description="Years since installation")
    hvac_brand: Optional[str] = Field(None, alias="hvacBrand")
    hvac_model: Optional[str] = Field(None, alias="hvacModel")
    thermostat_type: Optional[Literal["programmable", "smart", "manual"]] = Field(
        None, alias="thermostatType"
    )
    
    # Utilities & Systems
    utilities: Optional[UtilitiesSchema] = None
    water_source: Optional[Literal["municipal", "well", "shared"]] = Field(None, alias="waterSource")
    sewer_system: Optional[Literal["municipal", "septic", "shared"]] = Field(None, alias="sewerSystem")
    electrical_panel: Optional[Literal["breaker", "fuse"]] = Field(None, alias="electricalPanel")
    electrical_amps: Optional[int] = Field(None, alias="electricalAmps", description="100, 200, etc.")
    gas_service: bool = Field(False, alias="gasService")
    water_heater: Optional[WaterHeaterSchema] = Field(None, alias="waterHeater")
    
    # Plumbing
    plumbing_type: Optional[Literal["copper", "pex", "galvanized", "pvc", "mixed"]] = Field(
        None, alias="plumbingType"
    )
    water_shutoff_location: Optional[str] = Field(None, alias="waterShutoffLocation")
    main_drain_cleanout: Optional[str] = Field(None, alias="mainDrainCleanout")
    
    # Electrical
    electrical_panel_location: Optional[str] = Field(None, alias="electricalPanelLocation")
    wiring_type: Optional[Literal["copper", "aluminum", "knob_tube", "mixed"]] = Field(
        None, alias="wiringType"
    )
    
    # Roofing & Exterior
    roof_type: Optional[Literal[
        "asphalt_shingle", "metal", "tile", "slate", "flat", "rubber", "other"
    ]] = Field(None, alias="roofType")
    roof_age: Optional[int] = Field(None, alias="roofAge", description="Age in years")
    exterior_material: Optional[Literal[
        "vinyl", "brick", "wood", "stucco", "stone", "fiber_cement", "mixed", "other"
    ]] = Field(None, alias="exteriorMaterial")
    foundation_type: Optional[Literal["slab", "crawlspace", "basement", "pier_beam"]] = Field(
        None, alias="foundationType"
    )
    
    # Appliances
    appliances: Optional[AppliancesSchema] = None
    
    # Smart Home & Internet
    internet_service: bool = Field(False, alias="internetService")
    internet_provider: Optional[str] = Field(None, alias="internetProvider")
    smart_home_devices: Optional[List[str]] = Field(None, alias="smartHomeDevices")
    
    # Landscaping & Exterior
    sprinkler_system: bool = Field(False, alias="sprinklerSystem")
    pool: bool = False
    pool_type: Optional[Literal["inground", "aboveground", "none"]] = Field(None, alias="poolType")
    fence: bool = False
    fence_type: Optional[Literal["wood", "vinyl", "chain_link", "wrought_iron", "none"]] = Field(
        None, alias="fenceType"
    )
    
    # Special Considerations
    pet_friendly: bool = Field(False, alias="petFriendly")
    smoking_allowed: bool = Field(False, alias="smokingAllowed")
    wheelchair_accessible: bool = Field(False, alias="wheelchairAccessible")
    fireplace: bool = False
    fireplace_type: Optional[Literal["wood", "gas", "electric", "none"]] = Field(
        None, alias="fireplaceType"
    )
    
    # Maintenance & Notes
    maintenance_notes: Optional[str] = Field(None, alias="maintenanceNotes")
    special_instructions: Optional[str] = Field(None, alias="specialInstructions")
    
    class Config:
        # Allow population by field name or alias
        populate_by_name = True
        # Allow extra fields for future flexibility
        extra = "allow"
        # Use enum values instead of enum objects
        use_enum_values = True

    @validator('bathrooms')
    def validate_bathrooms(cls, v):
        """Validate bathroom count allows half baths (1.5, 2.5, etc.)."""
        if v is not None and v % 0.5 != 0:
            raise ValueError('Bathrooms must be in increments of 0.5')
        return v


def validate_property_descriptives(data: dict) -> tuple[bool, dict, list]:
    """
    Validate property descriptives data against schema.
    
    Args:
        data: Dictionary of descriptives data
        
    Returns:
        Tuple of (is_valid, validated_data, errors)
    """
    try:
        validated = PropertyDescriptivesSchema(**data)
        return True, validated.dict(by_alias=True, exclude_none=True), []
    except Exception as e:
        errors = []
        if hasattr(e, 'errors'):
            errors = e.errors()
        else:
            errors = [{"msg": str(e)}]
        return False, {}, errors
