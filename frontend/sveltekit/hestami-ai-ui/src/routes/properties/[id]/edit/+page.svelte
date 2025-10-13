<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';
  import PropertyForm from '$lib/components/properties/PropertyForm.svelte';
  import MediaUpload from '$lib/components/properties/MediaUpload.svelte';
  import MediaGallery from '$lib/components/properties/MediaGallery.svelte';
  
  export let data: PageData;
  
  let { property, media, mediaTypes, locationTypes, fieldChoices } = data;
  let activeTab: 'details' | 'media' = 'details';
  let saveStatus: 'idle' | 'saving' | 'success' | 'error' = 'idle';
  let errorMessage = '';
  
  // Reactive statement to update media when data changes
  $: ({ property, media, mediaTypes, locationTypes } = data);
  
  // Debug: Log property data
  $: console.log('Property data:', property);
  
  function handlePropertySaved() {
    saveStatus = 'success';
    setTimeout(() => {
      saveStatus = 'idle';
    }, 3000);
  }
  
  function handlePropertyError(message: string) {
    saveStatus = 'error';
    errorMessage = message;
    setTimeout(() => {
      saveStatus = 'idle';
      errorMessage = '';
    }, 5000);
  }
  
  function handleMediaUploaded() {
    // Refresh the page to reload media
    goto($page.url.pathname, { invalidateAll: true });
  }
  
  function handleMediaDeleted() {
    // Refresh the page to reload media
    goto($page.url.pathname, { invalidateAll: true });
  }
  
  function handleCancel() {
    goto(`/properties/${property.id}`);
  }
</script>

<svelte:head>
  <title>Edit Property - {property.title}</title>
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-7xl">
  <!-- Header -->
  <div class="mb-8">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="h1">Edit Property</h1>
        <p class="mt-2">{property.title}</p>
        <p class="text-sm opacity-70">{property.address}, {property.city}, {property.state}</p>
      </div>
      <button
        on:click={handleCancel}
        class="btn variant-ghost"
      >
        Cancel
      </button>
    </div>
  </div>

  <!-- Status Messages -->
  {#if saveStatus === 'success'}
    <aside class="alert variant-filled-success mb-6">
      <div class="alert-message">
        <p>Property saved successfully!</p>
      </div>
    </aside>
  {/if}

  {#if saveStatus === 'error'}
    <aside class="alert variant-filled-error mb-6">
      <div class="alert-message">
        <p>{errorMessage || 'Failed to save property'}</p>
      </div>
    </aside>
  {/if}

  <!-- Tabs -->
  <div class="card p-4 mb-6">
    <nav class="btn-group preset-outlined-surface-200-800 flex-col p-2 md:flex-row flex flex-wrap gap-1">
      <button
        on:click={() => activeTab = 'details'}
        class="btn px-4 py-2 rounded-lg font-medium border-2 {activeTab === 'details' ? 'variant-filled-primary border-primary-500' : 'variant-soft-surface border-transparent hover:variant-soft-primary'}"
      >
        Property Details
      </button>
      <button
        on:click={() => activeTab = 'media'}
        class="btn px-4 py-2 rounded-lg font-medium border-2 {activeTab === 'media' ? 'variant-filled-primary border-primary-500' : 'variant-soft-surface border-transparent hover:variant-soft-primary'}"
      >
        Media ({media.filter(m => !m.is_deleted).length})
      </button>
    </nav>
  </div>

  <!-- Tab Content -->
  <div class="card">
    {#if activeTab === 'details'}
      <PropertyForm 
        {property}
        {fieldChoices}
        on:saved={handlePropertySaved}
        on:error={(e) => handlePropertyError(e.detail)}
      />
    {:else if activeTab === 'media'}
      <div class="p-6 space-y-8">
        <MediaUpload 
          propertyId={property.id}
          {mediaTypes}
          {locationTypes}
          on:uploaded={handleMediaUploaded}
        />
        
        <div class="border-t border-gray-200 pt-8">
          <MediaGallery 
            {media}
            {mediaTypes}
            {locationTypes}
            on:deleted={handleMediaDeleted}
            on:updated={handleMediaUploaded}
          />
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  /* Add any custom styles here */
</style>
