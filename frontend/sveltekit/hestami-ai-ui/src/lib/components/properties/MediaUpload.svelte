<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';
  
  export let propertyId: string;
  export let mediaTypes: any[] = [];
  export let locationTypes: any[] = [];
  
  const dispatch = createEventDispatcher();
  
  interface FileUpload {
    file: File;
    id: string;
    uploading: boolean;
    progress: number;
    error: string | null;
    success: boolean;
    metadata: {
      title: string;
      description: string;
      media_type: string;
      media_sub_type: string;
      location_type: string;
      location_sub_type: string;
    };
  }
  
  let fileInput: HTMLInputElement;
  let uploads: FileUpload[] = [];
  
  // Get location subtypes for a given location type
  function getLocationSubtypes(locationType: string) {
    if (!Array.isArray(locationTypes)) {
      console.warn('locationTypes is not an array:', locationTypes);
      return [];
    }
    const location = locationTypes.find(l => l.type === locationType);
    return location?.subtypes || [];
  }
  
  // Get media subtypes for a given media type
  function getMediaSubtypes(mediaType: string) {
    if (!Array.isArray(mediaTypes)) {
      console.warn('mediaTypes is not an array:', mediaTypes);
      return [];
    }
    const type = mediaTypes.find(t => t.type === mediaType);
    return type?.subtypes || [];
  }
  
  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    
    if (files) {
      addFiles(Array.from(files));
    }
  }
  
  function addFiles(files: File[]) {
    const newUploads: FileUpload[] = files.map(file => ({
      file,
      id: Math.random().toString(36).substring(7),
      uploading: false,
      progress: 0,
      error: null,
      success: false,
      metadata: {
        title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
        description: '',
        media_type: file.type.startsWith('image/') ? 'IMAGE' : file.type.startsWith('video/') ? 'VIDEO' : 'FILE',
        media_sub_type: 'REGULAR',
        location_type: 'INTERIOR',
        location_sub_type: ''
      }
    }));
    
    uploads = [...uploads, ...newUploads];
  }
  
  function removeUpload(id: string) {
    uploads = uploads.filter(u => u.id !== id);
  }
  
  async function uploadFile(upload: FileUpload) {
    if (!browser) return;
    
    upload.uploading = true;
    upload.error = null;
    uploads = uploads; // Trigger reactivity
    
    try {
      const formData = new FormData();
      formData.append('file', upload.file);
      formData.append('title', upload.metadata.title);
      formData.append('description', upload.metadata.description);
      formData.append('media_type', upload.metadata.media_type);
      formData.append('media_sub_type', upload.metadata.media_sub_type);
      formData.append('location_type', upload.metadata.location_type);
      
      if (upload.metadata.location_sub_type) {
        formData.append('location_sub_type', upload.metadata.location_sub_type);
      }
      
      const response = await fetch(`/api/media/properties/${propertyId}/upload/`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
      
      upload.success = true;
      upload.progress = 100;
      
      // Remove successful upload after a delay
      setTimeout(() => {
        removeUpload(upload.id);
        dispatch('uploaded');
      }, 2000);
    } catch (error: any) {
      console.error('Upload error:', error);
      upload.error = error.message || 'Upload failed';
    } finally {
      upload.uploading = false;
      uploads = uploads; // Trigger reactivity
    }
  }
  
  function uploadAll() {
    uploads.forEach(upload => {
      if (!upload.uploading && !upload.success) {
        uploadFile(upload);
      }
    });
  }
</script>

<div class="space-y-6">
  <div>
    <h3 class="text-lg font-semibold text-gray-900 mb-4">Upload Media</h3>
    
    <!-- File Input -->
    <div class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
      <input
        type="file"
        bind:this={fileInput}
        on:change={handleFileSelect}
        multiple
        accept="image/*,video/*,.pdf,.doc,.docx"
        class="hidden"
      />
      
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
      </svg>
      
      <p class="mt-2 text-sm text-gray-600">
        <button
          type="button"
          on:click={() => fileInput.click()}
          class="font-medium text-blue-600 hover:text-blue-500"
        >
          Click to upload
        </button>
        or drag and drop
      </p>
      <p class="text-xs text-gray-500 mt-1">
        Images, videos, or documents
      </p>
    </div>
  </div>
  
  <!-- Upload Queue -->
  {#if uploads.length > 0}
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h4 class="text-md font-medium text-gray-900">Files to Upload ({uploads.length})</h4>
        <button
          type="button"
          on:click={uploadAll}
          disabled={uploads.every(u => u.uploading || u.success)}
          class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Upload All
        </button>
      </div>
      
      {#each uploads as upload (upload.id)}
        <div class="border border-gray-200 rounded-lg p-4 space-y-3">
          <!-- File Info -->
          <div class="flex items-start justify-between">
            <div class="flex items-center space-x-3 flex-1">
              <div class="flex-shrink-0">
                {#if upload.file.type.startsWith('image/')}
                  <svg class="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/>
                  </svg>
                {:else if upload.file.type.startsWith('video/')}
                  <svg class="w-8 h-8 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
                  </svg>
                {:else}
                  <svg class="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/>
                  </svg>
                {/if}
              </div>
              
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 truncate">{upload.file.name}</p>
                <p class="text-xs text-gray-500">{(upload.file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            
            {#if !upload.uploading && !upload.success}
              <button
                type="button"
                on:click={() => removeUpload(upload.id)}
                aria-label="Remove file"
                class="text-gray-400 hover:text-red-500 transition-colors"
              >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                </svg>
              </button>
            {/if}
          </div>
          
          <!-- Metadata Form -->
          {#if !upload.success}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label for="title-{upload.id}" class="block text-xs font-medium text-gray-700 mb-1">Title</label>
                <input
                  id="title-{upload.id}"
                  type="text"
                  bind:value={upload.metadata.title}
                  disabled={upload.uploading}
                  class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                />
              </div>
              
              <div>
                <label for="location-type-{upload.id}" class="block text-xs font-medium text-gray-700 mb-1">Location Type</label>
                <select
                  id="location-type-{upload.id}"
                  bind:value={upload.metadata.location_type}
                  disabled={upload.uploading}
                  class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                >
                  {#each locationTypes as locationType}
                    <option value={locationType.type}>{locationType.label}</option>
                  {/each}
                </select>
              </div>
              
              {#if getLocationSubtypes(upload.metadata.location_type).length > 0}
                <div>
                  <label for="location-subtype-{upload.id}" class="block text-xs font-medium text-gray-700 mb-1">Specific Location</label>
                  <select
                    id="location-subtype-{upload.id}"
                    bind:value={upload.metadata.location_sub_type}
                    disabled={upload.uploading}
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                  >
                    <option value="">Select...</option>
                    {#each getLocationSubtypes(upload.metadata.location_type) as subtype}
                      <option value={subtype.value}>{subtype.label}</option>
                    {/each}
                  </select>
                </div>
              {/if}
              
              <div class="md:col-span-2">
                <label for="description-{upload.id}" class="block text-xs font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  id="description-{upload.id}"
                  bind:value={upload.metadata.description}
                  disabled={upload.uploading}
                  rows="2"
                  class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                ></textarea>
              </div>
            </div>
          {/if}
          
          <!-- Status -->
          {#if upload.uploading}
            <div class="flex items-center space-x-2">
              <div class="flex-1 bg-gray-200 rounded-full h-2">
                <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: {upload.progress}%"></div>
              </div>
              <span class="text-xs text-gray-600">Uploading...</span>
            </div>
          {:else if upload.success}
            <div class="flex items-center space-x-2 text-green-600">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
              <span class="text-sm font-medium">Uploaded successfully!</span>
            </div>
          {:else if upload.error}
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2 text-red-600">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                </svg>
                <span class="text-sm">{upload.error}</span>
              </div>
              <button
                type="button"
                on:click={() => uploadFile(upload)}
                class="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Retry
              </button>
            </div>
          {:else}
            <button
              type="button"
              on:click={() => uploadFile(upload)}
              class="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upload This File
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
