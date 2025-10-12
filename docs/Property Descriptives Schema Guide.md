# Property Descriptives Schema Guide

## Overview

The property descriptives schema provides a standardized structure for capturing detailed property information without requiring Pydantic. This guide explains how to use the schema in both Django backend and SvelteKit frontend.

## Architecture

### Backend (Django)

**Files:**
- `properties/descriptives_schema.py` - Schema definition and helper functions
- `properties/models.py` - Property model with descriptives JSONField
- `properties/views_schema.py` - API endpoints for schema access
- `properties/urls.py` - URL routing for schema endpoints

### Frontend (SvelteKit)

The frontend can fetch the schema structure and field choices via API endpoints.

## Backend Usage

### 1. Default Descriptives Structure

Every new property automatically gets the default descriptives structure:

```python
from properties.models import Property

# Create a new property
property = Property.objects.create(
    owner=user,
    title="My Home",
    address="123 Main St",
    city="Springfield",
    state="IL",
    zip_code="62701",
    country="USA"
)

# descriptives field is automatically populated with default structure
print(property.descriptives['propertyType'])  # None
print(property.descriptives['bedrooms'])  # None
print(property.descriptives['utilities'])  # {'gas': None, 'water': None, ...}
```

### 2. Updating Descriptives

Use the `merge_descriptives()` helper to safely update nested structures:

```python
from properties.descriptives_schema import merge_descriptives

# Update specific fields
property.descriptives = merge_descriptives(
    property.descriptives,
    {
        'propertyType': 'single_family',
        'bedrooms': 3,
        'bathrooms': 2.5,
        'yearBuilt': 1995,
        'heatingSystem': 'forced_air',
        'utilities': {
            'gas': 'Peoples Gas',
            'electricity': 'ComEd'
        }
    }
)
property.save()
```

### 3. Field Choices

Access predefined choices for dropdown fields:

```python
from properties.descriptives_schema import (
    PROPERTY_TYPE_CHOICES,
    HEATING_SYSTEM_CHOICES,
    COOLING_SYSTEM_CHOICES,
)

# Use in Django forms or serializers
for value, label in PROPERTY_TYPE_CHOICES:
    print(f"{value}: {label}")
# Output:
# single_family: Single Family
# townhome: Townhome
# condo: Condo
# ...
```

## API Endpoints

### Get Schema Structure

**Endpoint:** `GET /api/properties/schema/descriptives/`

**Response:**
```json
{
  "schema": {
    "propertyType": null,
    "yearBuilt": null,
    "bedrooms": null,
    "utilities": {
      "gas": null,
      "water": null,
      "electricity": null
    },
    ...
  },
  "version": "1.0"
}
```

### Get Field Choices

**Endpoint:** `GET /api/properties/schema/descriptives/choices/`

**Response:**
```json
{
  "propertyType": [
    ["single_family", "Single Family"],
    ["townhome", "Townhome"],
    ...
  ],
  "heatingSystem": [
    ["forced_air", "Forced Air"],
    ["radiant", "Radiant"],
    ...
  ],
  ...
}
```

## Frontend Usage (SvelteKit)

### 1. Fetch Schema on Page Load

```typescript
// In +page.server.ts
export const load: PageServerLoad = async ({ cookies, url }) => {
  const [schemaRes, choicesRes] = await Promise.all([
    apiGet(cookies, '/api/properties/schema/descriptives/', {}, url.pathname),
    apiGet(cookies, '/api/properties/schema/descriptives/choices/', {}, url.pathname)
  ]);
  
  return {
    descriptivesSchema: schemaRes.data.schema,
    fieldChoices: choicesRes.data
  };
};
```

### 2. Use in Forms

```svelte
<script lang="ts">
  export let data;
  
  let { descriptivesSchema, fieldChoices } = data;
  let formData = { ...descriptivesSchema }; // Start with defaults
</script>

<select bind:value={formData.propertyType}>
  <option value="">Select type...</option>
  {#each fieldChoices.propertyType as [value, label]}
    <option value={value}>{label}</option>
  {/each}
</select>

<select bind:value={formData.heatingSystem}>
  <option value="">Select heating...</option>
  {#each fieldChoices.heatingSystem as [value, label]}
    <option value={value}>{label}</option>
  {/each}
</select>
```

## Schema Fields

### Basic Property Info
- `propertyType` - Type of property (single_family, condo, etc.)
- `yearBuilt` - Year the property was built
- `squareFootage` - Total square footage
- `bedrooms` - Number of bedrooms
- `bathrooms` - Number of bathrooms (can be decimal: 1.5, 2.5)
- `unitNumber` - Unit number for condos/apartments

### Structure & Features
- `basement` - Has basement (boolean)
- `basementType` - Type of basement (finished, unfinished, etc.)
- `garage` - Has garage (boolean)
- `garageType` - Type of garage (attached, detached)
- `garageSpaces` - Number of garage spaces
- `attic` - Has attic (boolean)
- `crawlSpace` - Has crawl space (boolean)

### HVAC & Climate
- `heatingSystem` - Type of heating system
- `heatingFuel` - Fuel type for heating
- `coolingSystem` - Type of cooling system
- `airConditioning` - Has AC (boolean)
- `hvacAge` - Age of HVAC system in years
- `hvacBrand` - HVAC brand name
- `hvacModel` - HVAC model number
- `thermostatType` - Type of thermostat

### Utilities & Systems
- `utilities` - Nested object with:
  - `gas` - Gas service provider
  - `water` - Water service provider
  - `electricity` - Electric provider
  - `sewer` - Sewer service
  - `internetCable` - Internet/cable provider
- `waterSource` - Water source type
- `sewerSystem` - Sewer system type
- `waterHeater` - Nested object with type, fuel, capacity, age, brand, model

### Plumbing & Electrical
- `plumbingType` - Type of plumbing (copper, PEX, etc.)
- `electricalPanel` - Panel type (breaker, fuse)
- `electricalAmps` - Electrical service amperage
- `wiringType` - Type of wiring

### Roofing & Exterior
- `roofType` - Type of roof
- `roofAge` - Age of roof in years
- `exteriorMaterial` - Exterior material type
- `foundationType` - Foundation type

### Appliances
- `appliances` - Nested object with boolean flags for:
  - refrigerator, stove, dishwasher, washer, dryer, microwave, oven, range, garbageDisposal

### Landscaping
- `sprinklerSystem` - Has sprinkler system (boolean)
- `pool` - Has pool (boolean)
- `poolType` - Type of pool
- `fence` - Has fence (boolean)
- `fenceType` - Type of fence

### Special Features
- `petFriendly` - Pet friendly (boolean)
- `smokingAllowed` - Smoking allowed (boolean)
- `wheelchairAccessible` - Wheelchair accessible (boolean)
- `fireplace` - Has fireplace (boolean)
- `fireplaceType` - Type of fireplace

### Notes
- `maintenanceNotes` - General maintenance notes
- `specialInstructions` - Special access or handling instructions

## Migration Guide

If you have existing properties with empty or partial descriptives:

```python
from properties.models import Property
from properties.descriptives_schema import merge_descriptives, get_default_descriptives

# Update all properties to have complete schema
for property in Property.objects.all():
    if not property.descriptives:
        property.descriptives = get_default_descriptives()
    else:
        # Merge existing data with defaults
        property.descriptives = merge_descriptives(
            get_default_descriptives(),
            property.descriptives
        )
    property.save()
```

## Benefits

1. **No Pydantic Dependency** - Uses plain Python dicts and Django JSONField
2. **Type Safety** - Field choices are defined and validated
3. **Frontend Integration** - Schema available via API for dynamic form generation
4. **Extensible** - Easy to add new fields without breaking existing data
5. **Service Provider Ready** - Comprehensive fields for maintenance and service needs
6. **Backward Compatible** - Existing properties work with merge_descriptives()

## Future Enhancements

- Add validation functions for specific fields (e.g., year range, positive numbers)
- Create Django admin interface with custom widgets for nested fields
- Add search/filter capabilities based on descriptives
- Generate TypeScript types from schema for frontend type safety
