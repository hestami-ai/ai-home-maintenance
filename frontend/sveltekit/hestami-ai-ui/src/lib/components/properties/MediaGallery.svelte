<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';
  import type { Media } from '$lib/types';
  
  export let media: Media[] = [];
  export let mediaTypes: any[] = [];
  export let locationTypes: any[] = [];
  
  const dispatch = createEventDispatcher();
  
  let filterLocation = 'all';
  let deleteConfirmId: string | null = null;
  let deletingId: string | null = null;
  let editingMedia: Media | null = null;
  let editForm = {
    title: '',
    description: '',
    media_type: '',
    media_sub_type: '',
    location_type: '',
    location_sub_type: ''
  };
  let isUpdating = false;
  
  // Filter media by location type
  $: filteredMedia = media.filter(m => {
    if (m.is_deleted) return false;
    if (filterLocation === 'all') return true;
    return m.location_type === filterLocation;
  });
  
  // Get unique location types from media for filter dropdown
  $: uniqueLocationTypes = Array.from(new Set(media.map(m => m.location_type))).filter(Boolean);
  
  function formatLocationLabel(locationType: string): string {
    return locationType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  function formatSubLocationLabel(subType: string): string {
    if (!subType) return '';
    return subType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  function showDeleteConfirm(mediaId: string) {
    deleteConfirmId = mediaId;
  }
  
  function cancelDelete() {
    deleteConfirmId = null;
  }
  
  function showEditModal(item: Media) {
    editingMedia = item;
    editForm = {
      title: item.title || '',
      description: item.description || '',
      media_type: item.media_type || '',
      media_sub_type: item.media_sub_type || '',
      location_type: item.location_type || '',
      location_sub_type: item.location_sub_type || ''
    };
  }
  
  function cancelEdit() {
    editingMedia = null;
    editForm = {
      title: '',
      description: '',
      media_type: '',
      media_sub_type: '',
      location_type: '',
      location_sub_type: ''
    };
  }
  
  function getLocationSubtypes(locationType: string) {
    if (!Array.isArray(locationTypes)) return [];
    const location = locationTypes.find(l => l.type === locationType);
    return location?.subtypes || [];
  }
  
  function getMediaSubtypes(mediaType: string) {
    if (!Array.isArray(mediaTypes)) return [];
    const type = mediaTypes.find(t => t.type === mediaType);
    return type?.subtypes || [];
  }
  
  async function updateMedia() {
    if (!browser || !editingMedia) return;
    
    isUpdating = true;
    
    try {
      const response = await fetch(`/api/media/${editingMedia.id}/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(editForm)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update media');
      }
      
      cancelEdit();
      dispatch('updated');
    } catch (error: any) {
      console.error('Error updating media:', error);
      alert(error.message || 'Failed to update media');
    } finally {
      isUpdating = false;
    }
  }
  
  async function deleteMedia(mediaId: string) {
    if (!browser) return;
    
    deletingId = mediaId;
    
    try {
      const response = await fetch(`/api/media/${mediaId}/`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete media');
      }
      
      deleteConfirmId = null;
      dispatch('deleted');
    } catch (error: any) {
      console.error('Error deleting media:', error);
      alert(error.message || 'Failed to delete media');
    } finally {
      deletingId = null;
    }
  }
  
  function getMediaIcon(mediaType: string) {
    switch (mediaType) {
      case 'IMAGE':
        return 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z';
      case 'VIDEO':
        return 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z';
      default:
        return 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z';
    }
  }
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h3 class="h3">Media Gallery ({filteredMedia.length})</h3>
    
    <!-- Filter -->
    <div class="flex items-center space-x-2">
      <label for="location-filter" class="label"><span>Filter:</span></label>
      <select
        id="location-filter"
        bind:value={filterLocation}
        class="select"
      >
        <option value="all">All Locations</option>
        {#each uniqueLocationTypes as locationType}
          <option value={locationType}>{formatLocationLabel(locationType)}</option>
        {/each}
      </select>
    </div>
  </div>
  
  {#if filteredMedia.length === 0}
    <div class="card p-12 text-center variant-ghost">
      <svg class="mx-auto h-12 w-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
      <p class="mt-2">No media found</p>
      <p class="text-sm opacity-70">Upload some files to get started</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {#each filteredMedia as item (item.id)}
        <div class="card overflow-hidden hover:variant-soft transition-all">
          <!-- Media Preview -->
          <div class="aspect-video bg-surface-200-700-token relative">
            {#if item.media_type === 'IMAGE'}
              {#if item.thumbnail_medium_url}
                <img
                  src={item.thumbnail_medium_url}
                  alt={item.title}
                  class="w-full h-full object-cover"
                  loading="lazy"
                />
              {:else if item.file_url}
                <img
                  src={item.file_url}
                  alt={item.title}
                  class="w-full h-full object-cover"
                  loading="lazy"
                />
              {:else}
                <div class="w-full h-full flex items-center justify-center">
                  <svg class="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={getMediaIcon(item.media_type)}/>
                  </svg>
                </div>
              {/if}
            {:else}
              <div class="w-full h-full flex items-center justify-center">
                <svg class="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={getMediaIcon(item.media_type)}/>
                </svg>
              </div>
            {/if}
            
            <!-- Media Type Badge -->
            <div class="absolute top-2 left-2">
              <span class="badge variant-filled-surface">
                {item.media_type}
              </span>
            </div>
            
            <!-- Processing Status -->
            {#if item.metadata?.scan_status === 'SCANNING'}
              <div class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <div class="text-white text-sm">Scanning...</div>
              </div>
            {/if}
          </div>
          
          <!-- Media Info -->
          <div class="p-3 space-y-2">
            <div>
              <h4 class="font-medium truncate" title={item.title}>
                {item.title}
              </h4>
              {#if item.location_type}
                <p class="text-sm opacity-70">
                  {formatLocationLabel(item.location_type)}
                  {#if item.location_sub_type}
                    - {formatSubLocationLabel(item.location_sub_type)}
                  {/if}
                </p>
              {/if}
            </div>
            
            {#if item.description}
              <p class="text-sm opacity-70 line-clamp-2" title={item.description}>
                {item.description}
              </p>
            {/if}
            
            <!-- Actions -->
            <div class="flex items-center justify-between pt-2 border-t border-surface-300-600-token">
              {#if item.file_url}
                <a
                  href={item.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="anchor text-sm"
                >
                  View
                </a>
              {:else}
                <span class="text-sm opacity-50">Processing...</span>
              {/if}
              
              <div class="flex space-x-2">
                <button
                  type="button"
                  on:click={() => showEditModal(item)}
                  class="btn btn-sm variant-ghost"
                  title="Edit metadata"
                >
                  Edit
                </button>
                <button
                  type="button"
                  on:click={() => showDeleteConfirm(item.id)}
                  disabled={deletingId === item.id}
                  class="btn btn-sm variant-ghost-error disabled:opacity-50"
                >
                  {deletingId === item.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
          
          <!-- Delete Confirmation Modal -->
          {#if deleteConfirmId === item.id}
            <div class="absolute inset-0 bg-surface-backdrop-token flex items-center justify-center p-4 z-10">
              <div class="card p-4 max-w-sm w-full" role="dialog" aria-modal="true" tabindex="-1" on:click|stopPropagation>
                <h5 class="h5 mb-2">Delete Media?</h5>
                <p class="text-sm mb-4">
                  Are you sure you want to delete "{item.title}"? This action cannot be undone.
                </p>
                <div class="flex space-x-2">
                  <button
                    type="button"
                    on:click={cancelDelete}
                    class="btn variant-ghost flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    on:click={() => deleteMedia(item.id)}
                    disabled={deletingId === item.id}
                    class="btn variant-filled-error flex-1 disabled:opacity-50"
                  >
                    {deletingId === item.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Edit Media Modal -->
{#if editingMedia}
  <div class="fixed inset-0 bg-surface-backdrop-token flex items-center justify-center p-4 z-50">
    <div class="card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true">
      <h3 class="h3 mb-4">Edit Media</h3>
      
      <form on:submit|preventDefault={updateMedia} class="space-y-4">
        <!-- Title -->
        <div>
          <label for="edit-title" class="label">
            <span>Title</span>
          </label>
          <input
            id="edit-title"
            type="text"
            bind:value={editForm.title}
            class="input"
            placeholder="Enter title"
          />
        </div>
        
        <!-- Description -->
        <div>
          <label for="edit-description" class="label">
            <span>Description</span>
          </label>
          <textarea
            id="edit-description"
            bind:value={editForm.description}
            rows="3"
            class="textarea"
            placeholder="Enter description"
          ></textarea>
        </div>
        
        <!-- Media Type -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="edit-media-type" class="label">
              <span>Media Type</span>
            </label>
            <select
              id="edit-media-type"
              bind:value={editForm.media_type}
              class="select"
            >
              <option value="">Select type...</option>
              {#if Array.isArray(mediaTypes)}
                {#each mediaTypes as type}
                  <option value={type.type}>{type.label}</option>
                {/each}
              {/if}
            </select>
          </div>
          
          <div>
            <label for="edit-media-subtype" class="label">
              <span>Media Sub-Type</span>
            </label>
            <select
              id="edit-media-subtype"
              bind:value={editForm.media_sub_type}
              class="select"
            >
              <option value="">Select sub-type...</option>
              {#each getMediaSubtypes(editForm.media_type) as subtype}
                <option value={subtype.type}>{subtype.label}</option>
              {/each}
            </select>
          </div>
        </div>
        
        <!-- Location Type -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="edit-location-type" class="label">
              <span>Location Type</span>
            </label>
            <select
              id="edit-location-type"
              bind:value={editForm.location_type}
              class="select"
            >
              <option value="">Select location...</option>
              {#if Array.isArray(locationTypes)}
                {#each locationTypes as location}
                  <option value={location.type}>{location.label}</option>
                {/each}
              {/if}
            </select>
          </div>
          
          <div>
            <label for="edit-location-subtype" class="label">
              <span>Location Sub-Type</span>
            </label>
            <select
              id="edit-location-subtype"
              bind:value={editForm.location_sub_type}
              class="select"
            >
              <option value="">Select sub-location...</option>
              {#each getLocationSubtypes(editForm.location_type) as subtype}
                <option value={subtype.type}>{subtype.label}</option>
              {/each}
            </select>
          </div>
        </div>
        
        <!-- Actions -->
        <div class="flex space-x-2 pt-4">
          <button
            type="button"
            on:click={cancelEdit}
            class="btn variant-ghost flex-1"
            disabled={isUpdating}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="btn variant-filled-primary flex-1"
            disabled={isUpdating}
          >
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
