<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';
  import type { Property } from '$lib/types';
  
  export let property: Property;
  export let fieldChoices: any = {};
  
  const dispatch = createEventDispatcher();
  
  // Debug logging
  console.log('PropertyForm received property:', property);
  console.log('Property city:', property.city);
  console.log('Property state:', property.state);
  console.log('Property zip_code:', property.zip_code);
  
  // Form state
  let formData = {
    title: property.title || '',
    description: property.description || '',
    address: property.address || '',
    city: property.city || '',
    state: property.state || '',
    zip_code: property.zip_code || '',
    county: property.county || '',
    country: property.country || 'USA',
    status: property.status || 'ACTIVE',
    descriptives: property.descriptives || {}
  };
  
  // Debug formData
  console.log('FormData initialized:', formData);
  
  // Descriptives state (with defaults from existing property data)
  let descriptives = {
    // Basic Property Info
    propertyType: formData.descriptives?.propertyType || '',
    unitNumber: formData.descriptives?.unitNumber || '',
    yearBuilt: formData.descriptives?.yearBuilt || '',
    squareFootage: formData.descriptives?.squareFootage || '',
    bedrooms: formData.descriptives?.bedrooms || '',
    bathrooms: formData.descriptives?.bathrooms || '',
    
    // Structure
    garage: formData.descriptives?.garage ?? false,
    garageType: formData.descriptives?.garageType || '',
    garageSpaces: formData.descriptives?.garageSpaces || '',
    basement: formData.descriptives?.basement ?? false,
    basementType: formData.descriptives?.basementType || '',
    attic: formData.descriptives?.attic ?? false,
    crawlSpace: formData.descriptives?.crawlSpace ?? false,
    gatedCommunity: formData.descriptives?.gatedCommunity ?? false,
    
    // HVAC
    heatingSystem: formData.descriptives?.heatingSystem || '',
    coolingSystem: formData.descriptives?.coolingSystem || '',
    airConditioning: formData.descriptives?.airConditioning ?? false,
    hvacAge: formData.descriptives?.hvacAge || '',
    hvacBrand: formData.descriptives?.hvacBrand || '',
    
    // Roofing & Exterior
    roofType: formData.descriptives?.roofType || '',
    roofAge: formData.descriptives?.roofAge || '',
    exteriorMaterial: formData.descriptives?.exteriorMaterial || '',
    foundationType: formData.descriptives?.foundationType || '',
    
    // Landscaping
    pool: formData.descriptives?.pool ?? false,
    poolType: formData.descriptives?.poolType || '',
    fence: formData.descriptives?.fence ?? false,
    fenceType: formData.descriptives?.fenceType || '',
    deck: formData.descriptives?.deck ?? false,
    deckMaterial: formData.descriptives?.deckMaterial || '',
    patio: formData.descriptives?.patio ?? false,
    patioMaterial: formData.descriptives?.patioMaterial || '',
    sprinklerSystem: formData.descriptives?.sprinklerSystem ?? false,
    
    // Utilities
    utilities: {
      gas: formData.descriptives?.utilities?.gas || '',
      sewer: formData.descriptives?.utilities?.sewer || '',
      water: formData.descriptives?.utilities?.water || '',
      electricity: formData.descriptives?.utilities?.electricity || '',
      internetCable: formData.descriptives?.utilities?.internetCable || ''
    }
  };
  
  let isSubmitting = false;
  let expandedSections = {
    basic: true,
    address: true,
    details: false,
    structure: false,
    hvac: false,
    roofing: false,
    landscaping: false,
    utilities: false
  };
  
  function toggleSection(section: keyof typeof expandedSections) {
    expandedSections[section] = !expandedSections[section];
  }
  
  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    
    if (!browser) return;
    
    isSubmitting = true;
    
    try {
      // Prepare the update payload
      const updateData = {
        title: formData.title,
        description: formData.description,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zip_code,
        county: formData.county,
        country: formData.country,
        status: formData.status,
        descriptives: descriptives
      };
      
      // Call SvelteKit API route which proxies to Django
      const response = await fetch(`/api/properties/${property.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update property');
      }
      
      const updatedProperty = await response.json();
      dispatch('saved', updatedProperty);
    } catch (error: any) {
      console.error('Error updating property:', error);
      dispatch('error', error.message || 'Failed to update property');
    } finally {
      isSubmitting = false;
    }
  }
</script>

<form on:submit={handleSubmit} class="p-6 space-y-6">
  
  <!-- Basic Information Section -->
  <div class="card variant-ghost">
    <button
      type="button"
      on:click={() => toggleSection('basic')}
      class="w-full px-6 py-4 flex items-center justify-between hover:variant-soft transition-colors"
    >
      <h3 class="h3">Basic Information</h3>
      <svg 
        class="w-5 h-5 text-gray-500 transition-transform {expandedSections.basic ? 'rotate-180' : ''}" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
      </svg>
    </button>
    
    {#if expandedSections.basic}
      <div class="p-6 space-y-4">
        <div>
          <label for="title" class="label">
            Property Title <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="title"
            bind:value={formData.title}
            required
            class="input"
            placeholder="e.g., My Home, Downtown Condo"
          />
        </div>
        
        <div>
          <label for="description" class="label">
            <span>Description</span>
          </label>
          <textarea
            id="description"
            bind:value={formData.description}
            rows="3"
            class="textarea"
            placeholder="Brief description of the property"
          ></textarea>
        </div>
        
        <div>
          <label for="status" class="label">
            Status
          </label>
          <select
            id="status"
            bind:value={formData.status}
            class="input"
          >
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>
    {/if}
  </div>

  <!-- Address Section -->
  <div class="card variant-ghost">
    <button
      type="button"
      on:click={() => toggleSection('address')}
      class="w-full px-6 py-4 flex items-center justify-between hover:variant-soft transition-colors"
    >
      <h3 class="h3">Address</h3>
      <svg 
        class="w-5 h-5 text-gray-500 transition-transform {expandedSections.address ? 'rotate-180' : ''}" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
      </svg>
    </button>
    
    {#if expandedSections.address}
      <div class="p-6 space-y-4">
        <div>
          <label for="address" class="label">
            Street Address <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="address"
            bind:value={formData.address}
            required
            class="input"
            placeholder="123 Main St"
          />
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="city" class="label">
              City <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="city"
              bind:value={formData.city}
              required
              class="input"
            />
          </div>
          
          <div>
            <label for="state" class="label">
              State <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="state"
              bind:value={formData.state}
              required
              class="input"
            />
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label for="zip_code" class="label">
              ZIP Code <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="zip_code"
              bind:value={formData.zip_code}
              required
              class="input"
            />
          </div>
          
          <div>
            <label for="county" class="label">
              County
            </label>
            <input
              type="text"
              id="county"
              bind:value={formData.county}
              class="input"
            />
          </div>
          
          <div>
            <label for="country" class="label">
              Country <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="country"
              bind:value={formData.country}
              required
              class="input"
            />
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Property Details Section -->
  <div class="card variant-ghost">
    <button
      type="button"
      on:click={() => toggleSection('details')}
      class="w-full px-6 py-4 flex items-center justify-between hover:variant-soft transition-colors"
    >
      <h3 class="h3">Property Details</h3>
      <svg 
        class="w-5 h-5 text-gray-500 transition-transform {expandedSections.details ? 'rotate-180' : ''}" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
      </svg>
    </button>
    
    {#if expandedSections.details}
      <div class="p-6 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="propertyType" class="label">
              Property Type
            </label>
            <select
              id="propertyType"
              bind:value={descriptives.propertyType}
              class="select"
            >
              <option value="">Select type...</option>
              {#if fieldChoices.propertyType}
                {#each fieldChoices.propertyType as [value, label]}
                  <option value={value}>{label}</option>
                {/each}
              {/if}
            </select>
          </div>
          
          <div>
            <label for="unitNumber" class="label">
              Unit Number
            </label>
            <input
              type="text"
              id="unitNumber"
              bind:value={descriptives.unitNumber}
              class="input"
              placeholder="For condos/apartments"
            />
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label for="bedrooms" class="label">
              Bedrooms
            </label>
            <input
              type="number"
              id="bedrooms"
              bind:value={descriptives.bedrooms}
              min="0"
              class="input"
            />
          </div>
          
          <div>
            <label for="bathrooms" class="label">
              Bathrooms
            </label>
            <input
              type="number"
              id="bathrooms"
              bind:value={descriptives.bathrooms}
              min="0"
              step="0.5"
              class="input"
              placeholder="e.g., 1.5, 2.5"
            />
          </div>
          
          <div>
            <label for="yearBuilt" class="label">
              Year Built
            </label>
            <input
              type="number"
              id="yearBuilt"
              bind:value={descriptives.yearBuilt}
              min="1800"
              max="2100"
              class="input"
            />
          </div>
        </div>
        
        <div>
          <label for="squareFootage" class="label">
            Square Footage
          </label>
          <input
            type="number"
            id="squareFootage"
            bind:value={descriptives.squareFootage}
            min="0"
            class="input"
          />
        </div>
      </div>
    {/if}
  </div>

  <!-- Structure & Features Section -->
  <div class="card variant-ghost">
    <button
      type="button"
      on:click={() => toggleSection('structure')}
      class="w-full px-6 py-4 flex items-center justify-between hover:variant-soft transition-colors"
    >
      <h3 class="h3">Structure & Features</h3>
      <svg 
        class="w-5 h-5 text-gray-500 transition-transform {expandedSections.structure ? 'rotate-180' : ''}" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
      </svg>
    </button>
    
    {#if expandedSections.structure}
      <div class="p-6 space-y-4">
        <!-- Garage -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label class="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" bind:checked={descriptives.garage} class="checkbox" />
            <span class="label">Garage</span>
          </label>
          <div>
            <label for="garageType" class="label">Garage Type</label>
            <select id="garageType" bind:value={descriptives.garageType} class="select">
              <option value="">Select type...</option>
              {#if fieldChoices.garageType}
                {#each fieldChoices.garageType as [value, label]}
                  <option value={value}>{label}</option>
                {/each}
              {/if}
            </select>
          </div>
          <div>
            <label for="garageSpaces" class="label">Garage Spaces</label>
            <input type="number" id="garageSpaces" bind:value={descriptives.garageSpaces} min="0" class="input" />
          </div>
        </div>
        
        <!-- Basement -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label class="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" bind:checked={descriptives.basement} class="checkbox" />
            <span class="label">Basement</span>
          </label>
          <div>
            <label for="basementType" class="label">Basement Type</label>
            <select id="basementType" bind:value={descriptives.basementType} class="select">
              <option value="">Select type...</option>
              {#if fieldChoices.basementType}
                {#each fieldChoices.basementType as [value, label]}
                  <option value={value}>{label}</option>
                {/each}
              {/if}
            </select>
          </div>
        </div>
        
        <!-- Other Features -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label class="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" bind:checked={descriptives.attic} class="checkbox" />
            <span class="label">Attic</span>
          </label>
          <label class="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" bind:checked={descriptives.crawlSpace} class="checkbox" />
            <span class="label">Crawl Space</span>
          </label>
          <label class="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" bind:checked={descriptives.gatedCommunity} class="checkbox" />
            <span class="label">Gated Community</span>
          </label>
        </div>
      </div>
    {/if}
  </div>

  <!-- HVAC Section -->
  <div class="card variant-ghost">
    <button
      type="button"
      on:click={() => toggleSection('hvac')}
      class="w-full px-6 py-4 flex items-center justify-between hover:variant-soft transition-colors"
    >
      <h3 class="h3">HVAC & Climate Control</h3>
      <svg 
        class="w-5 h-5 text-gray-500 transition-transform {expandedSections.hvac ? 'rotate-180' : ''}" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
      </svg>
    </button>
    
    {#if expandedSections.hvac}
      <div class="p-6 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="heatingSystem" class="label">Heating System</label>
            <select id="heatingSystem" bind:value={descriptives.heatingSystem} class="select">
              <option value="">Select system...</option>
              {#if fieldChoices.heatingSystem}
                {#each fieldChoices.heatingSystem as [value, label]}
                  <option value={value}>{label}</option>
                {/each}
              {/if}
            </select>
          </div>
          <div>
            <label for="coolingSystem" class="label">Cooling System</label>
            <select id="coolingSystem" bind:value={descriptives.coolingSystem} class="select">
              <option value="">Select system...</option>
              {#if fieldChoices.coolingSystem}
                {#each fieldChoices.coolingSystem as [value, label]}
                  <option value={value}>{label}</option>
                {/each}
              {/if}
            </select>
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="hvacAge" class="label">HVAC Age (years)</label>
            <input type="number" id="hvacAge" bind:value={descriptives.hvacAge} min="0" class="input" />
          </div>
          <div>
            <label for="hvacBrand" class="label">HVAC Brand</label>
            <input type="text" id="hvacBrand" bind:value={descriptives.hvacBrand} class="input" placeholder="e.g., Carrier, Trane" />
          </div>
        </div>
        
        <label class="flex items-center space-x-2 cursor-pointer">
          <input type="checkbox" bind:checked={descriptives.airConditioning} class="checkbox" />
          <span class="label">Air Conditioning</span>
        </label>
      </div>
    {/if}
  </div>

  <!-- Roofing & Exterior Section -->
  <div class="card variant-ghost">
    <button
      type="button"
      on:click={() => toggleSection('roofing')}
      class="w-full px-6 py-4 flex items-center justify-between hover:variant-soft transition-colors"
    >
      <h3 class="h3">Roofing & Exterior</h3>
      <svg 
        class="w-5 h-5 text-gray-500 transition-transform {expandedSections.roofing ? 'rotate-180' : ''}" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
      </svg>
    </button>
    
    {#if expandedSections.roofing}
      <div class="p-6 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="roofType" class="label">Roof Type</label>
            <select id="roofType" bind:value={descriptives.roofType} class="select">
              <option value="">Select type...</option>
              {#if fieldChoices.roofType}
                {#each fieldChoices.roofType as [value, label]}
                  <option value={value}>{label}</option>
                {/each}
              {/if}
            </select>
          </div>
          <div>
            <label for="roofAge" class="label">Roof Age (years)</label>
            <input type="number" id="roofAge" bind:value={descriptives.roofAge} min="0" class="input" />
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="exteriorMaterial" class="label">Exterior Material</label>
            <select id="exteriorMaterial" bind:value={descriptives.exteriorMaterial} class="select">
              <option value="">Select material...</option>
              {#if fieldChoices.exteriorMaterial}
                {#each fieldChoices.exteriorMaterial as [value, label]}
                  <option value={value}>{label}</option>
                {/each}
              {/if}
            </select>
          </div>
          <div>
            <label for="foundationType" class="label">Foundation Type</label>
            <select id="foundationType" bind:value={descriptives.foundationType} class="select">
              <option value="">Select type...</option>
              {#if fieldChoices.foundationType}
                {#each fieldChoices.foundationType as [value, label]}
                  <option value={value}>{label}</option>
                {/each}
              {/if}
            </select>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Landscaping Section -->
  <div class="card variant-ghost">
    <button
      type="button"
      on:click={() => toggleSection('landscaping')}
      class="w-full px-6 py-4 flex items-center justify-between hover:variant-soft transition-colors"
    >
      <h3 class="h3">Landscaping & Outdoor</h3>
      <svg 
        class="w-5 h-5 text-gray-500 transition-transform {expandedSections.landscaping ? 'rotate-180' : ''}" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
      </svg>
    </button>
    
    {#if expandedSections.landscaping}
      <div class="p-6 space-y-4">
        <!-- Pool -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label class="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" bind:checked={descriptives.pool} class="checkbox" />
            <span class="label">Pool</span>
          </label>
          <div>
            <label for="poolType" class="label">Pool Type</label>
            <select id="poolType" bind:value={descriptives.poolType} class="select">
              <option value="">Select type...</option>
              {#if fieldChoices.poolType}
                {#each fieldChoices.poolType as [value, label]}
                  <option value={value}>{label}</option>
                {/each}
              {/if}
            </select>
          </div>
        </div>
        
        <!-- Fence -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label class="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" bind:checked={descriptives.fence} class="checkbox" />
            <span class="label">Fence</span>
          </label>
          <div>
            <label for="fenceType" class="label">Fence Type</label>
            <select id="fenceType" bind:value={descriptives.fenceType} class="select">
              <option value="">Select type...</option>
              {#if fieldChoices.fenceType}
                {#each fieldChoices.fenceType as [value, label]}
                  <option value={value}>{label}</option>
                {/each}
              {/if}
            </select>
          </div>
        </div>
        
        <!-- Deck -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label class="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" bind:checked={descriptives.deck} class="checkbox" />
            <span class="label">Deck</span>
          </label>
          <div>
            <label for="deckMaterial" class="label">Deck Material</label>
            <select id="deckMaterial" bind:value={descriptives.deckMaterial} class="select">
              <option value="">Select material...</option>
              {#if fieldChoices.deckMaterial}
                {#each fieldChoices.deckMaterial as [value, label]}
                  <option value={value}>{label}</option>
                {/each}
              {/if}
            </select>
          </div>
        </div>
        
        <!-- Patio -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label class="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" bind:checked={descriptives.patio} class="checkbox" />
            <span class="label">Patio</span>
          </label>
          <div>
            <label for="patioMaterial" class="label">Patio Material</label>
            <select id="patioMaterial" bind:value={descriptives.patioMaterial} class="select">
              <option value="">Select material...</option>
              {#if fieldChoices.patioMaterial}
                {#each fieldChoices.patioMaterial as [value, label]}
                  <option value={value}>{label}</option>
                {/each}
              {/if}
            </select>
          </div>
        </div>
        
        <!-- Sprinkler System -->
        <label class="flex items-center space-x-2 cursor-pointer">
          <input type="checkbox" bind:checked={descriptives.sprinklerSystem} class="checkbox" />
          <span class="label">Sprinkler System</span>
        </label>
      </div>
    {/if}
  </div>

  <!-- Utilities Section -->
  <div class="card variant-ghost">
    <button
      type="button"
      on:click={() => toggleSection('utilities')}
      class="w-full px-6 py-4 flex items-center justify-between hover:variant-soft transition-colors"
    >
      <h3 class="h3">Utilities</h3>
      <svg 
        class="w-5 h-5 text-gray-500 transition-transform {expandedSections.utilities ? 'rotate-180' : ''}" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
      </svg>
    </button>
    
    {#if expandedSections.utilities}
      <div class="p-6 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="gas" class="label">
              Gas Service
            </label>
            <input
              type="text"
              id="gas"
              bind:value={descriptives.utilities.gas}
              class="input"
              placeholder="Provider or status"
            />
          </div>
          
          <div>
            <label for="electricity" class="label">
              Electricity
            </label>
            <input
              type="text"
              id="electricity"
              bind:value={descriptives.utilities.electricity}
              class="input"
              placeholder="Provider"
            />
          </div>
          
          <div>
            <label for="water" class="label">
              Water
            </label>
            <input
              type="text"
              id="water"
              bind:value={descriptives.utilities.water}
              class="input"
              placeholder="Provider or source"
            />
          </div>
          
          <div>
            <label for="sewer" class="label">
              Sewer
            </label>
            <input
              type="text"
              id="sewer"
              bind:value={descriptives.utilities.sewer}
              class="input"
              placeholder="Municipal, septic, etc."
            />
          </div>
          
          <div class="md:col-span-2">
            <label for="internetCable" class="label">
              Internet/Cable
            </label>
            <input
              type="text"
              id="internetCable"
              bind:value={descriptives.utilities.internetCable}
              class="input"
              placeholder="Provider"
            />
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Submit Button -->
  <div class="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
    <button
      type="submit"
      disabled={isSubmitting}
      class="btn variant-filled-primary"
    >
      {isSubmitting ? 'Saving...' : 'Save Property Details'}
    </button>
  </div>
</form>
