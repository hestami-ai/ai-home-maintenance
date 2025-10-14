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
    retryCount: number;
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
    const subtypes = type?.subtypes || [];
    console.log(`getMediaSubtypes(${mediaType}):`, subtypes);
    return subtypes;
  }
  
  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    
    if (files) {
      addFiles(Array.from(files));
    }
  }
  
  function addFiles(files: File[]) {
    const newUploads: FileUpload[] = files.map(file => {
      const mediaType = file.type.startsWith('image/') ? 'IMAGE' : file.type.startsWith('video/') ? 'VIDEO' : 'FILE';
      const subtypes = getMediaSubtypes(mediaType);
      const defaultSubtype = subtypes.length > 0 ? subtypes[0].type : 'REGULAR';
      
      console.log(`File: ${file.name}, mediaType: ${mediaType}, defaultSubtype: ${defaultSubtype}`);
      
      return {
        file,
        id: Math.random().toString(36).substring(7),
        uploading: false,
        progress: 0,
        error: null,
        success: false,
        retryCount: 0,
        metadata: {
          title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
          description: '',
          media_type: mediaType,
          media_sub_type: defaultSubtype,
          location_type: 'INTERIOR',
          location_sub_type: ''
        }
      };
    });
    
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
      // Ensure media_sub_type is never undefined
      if (!upload.metadata.media_sub_type || upload.metadata.media_sub_type === 'undefined') {
        console.error('media_sub_type is undefined! Setting to REGULAR');
        upload.metadata.media_sub_type = 'REGULAR';
      }
      
      formData.append('title', upload.metadata.title);
      formData.append('description', upload.metadata.description);
      formData.append('media_type', upload.metadata.media_type);
      formData.append('media_sub_type', upload.metadata.media_sub_type);
      formData.append('location_type', upload.metadata.location_type);
      
      // Add file metadata
      formData.append('file_type', upload.file.type);
      formData.append('file_size', upload.file.size.toString());
      formData.append('original_filename', upload.file.name);
      formData.append('mime_type', upload.file.type);
      
      if (upload.metadata.location_sub_type) {
        formData.append('location_sub_type', upload.metadata.location_sub_type);
      }
      
      // Use XMLHttpRequest for better compatibility with large uploads (same as service requests)
      const result = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            upload.progress = Math.round((event.loaded / event.total) * 100);
            uploads = uploads; // Trigger reactivity
          }
        });
        
        // Handle completion
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (e) {
              resolve(xhr.responseText);
            }
          } else {
            reject({ status: xhr.status, statusText: xhr.statusText, responseText: xhr.responseText });
          }
        });
        
        // Handle errors
        xhr.addEventListener('error', () => {
          reject({ status: 0, statusText: 'Network error during upload' });
        });
        
        xhr.addEventListener('abort', () => {
          reject({ status: 0, statusText: 'Upload aborted' });
        });
        
        // Send the request (no trailing slash - matches service request pattern)
        xhr.open('POST', `/api/media/properties/${propertyId}/upload`);
        xhr.withCredentials = true; // Include cookies
        xhr.send(formData);
      });
      
      // Success - no error handling needed since promise rejects on error
      upload.success = true;
      upload.uploading = false;
      uploads = uploads;
      dispatch('upload-complete', result);
    } catch (err: any) {
      // Handle errors from XMLHttpRequest rejection
      const status = err.status || 500;
      let errorMessage = 'Upload failed';
      let shouldRetry = false;
      
      switch (status) {
        case 413:
          errorMessage = `File too large. Maximum size is 100MB. Your file is ${(upload.file.size / 1024 / 1024).toFixed(1)}MB.`;
          break;
        case 429:
          errorMessage = 'Server is busy. Retrying automatically...';
          shouldRetry = true;
          break;
        case 503:
          errorMessage = 'Server temporarily unavailable. Retrying automatically...';
          shouldRetry = true;
          break;
        case 504:
          errorMessage = 'Upload timed out. Please check your connection and try again.';
          break;
        case 500:
          errorMessage = 'Server error occurred. Please try again or contact support.';
          break;
        case 0:
          errorMessage = err.statusText || 'Network error occurred';
          break;
        default:
          try {
            const errorData = JSON.parse(err.responseText);
            errorMessage = errorData.error || errorMessage;
          } catch {
            errorMessage = `Upload failed (${status})`;
          }
      }
      
      // Auto-retry for transient errors (429, 503)
      if (shouldRetry && upload.retryCount < 3) {
        upload.retryCount++;
        upload.error = `${errorMessage} (Attempt ${upload.retryCount + 1}/4)`;
        uploads = uploads;
        
        // Exponential backoff: 2s, 4s, 8s
        const delay = Math.pow(2, upload.retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry the upload
        return uploadFile(upload);
      }
      
      // Set error and stop
      upload.error = errorMessage;
      upload.uploading = false;
      uploads = uploads;
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
              <div class="md:col-span-2">
                <label for="title-{upload.id}" class="label text-xs mb-1"><span>Title</span></label>
                <input
                  id="title-{upload.id}"
                  type="text"
                  bind:value={upload.metadata.title}
                  disabled={upload.uploading}
                  class="input text-sm"
                />
              </div>
              
              <div>
                <label for="media-type-{upload.id}" class="label text-xs mb-1"><span>Media Type</span></label>
                <select
                  id="media-type-{upload.id}"
                  value={upload.metadata.media_type}
                  on:change={(e) => {
                    const target = e.target as HTMLSelectElement;
                    upload.metadata.media_type = target.value;
                    // Reset media_sub_type when media_type changes
                    const subtypes = getMediaSubtypes(target.value);
                    upload.metadata.media_sub_type = subtypes.length > 0 ? subtypes[0].type : '';
                    uploads = uploads;
                  }}
                  disabled={upload.uploading}
                  class="select text-sm"
                >
                  {#each mediaTypes as type}
                    <option value={type.type}>{type.label}</option>
                  {/each}
                </select>
              </div>
              
              {#if getMediaSubtypes(upload.metadata.media_type).length > 0}
                <div>
                  <label for="media-sub-type-{upload.id}" class="label text-xs mb-1"><span>Media Sub-Type</span></label>
                  <select
                    id="media-sub-type-{upload.id}"
                    value={upload.metadata.media_sub_type}
                    on:change={(e) => {
                      const target = e.target as HTMLSelectElement;
                      upload.metadata.media_sub_type = target.value;
                      uploads = uploads;
                    }}
                    disabled={upload.uploading}
                    class="select text-sm"
                  >
                    {#each getMediaSubtypes(upload.metadata.media_type) as subtype}
                      <option value={subtype.type}>{subtype.label}</option>
                    {/each}
                  </select>
                </div>
              {/if}
              
              <div>
                <label for="location-type-{upload.id}" class="label text-xs mb-1"><span>Location Type</span></label>
                <select
                  id="location-type-{upload.id}"
                  value={upload.metadata.location_type}
                  on:change={(e) => {
                    const target = e.target as HTMLSelectElement;
                    upload.metadata.location_type = target.value;
                    upload.metadata.location_sub_type = '';
                    uploads = uploads;
                  }}
                  disabled={upload.uploading}
                  class="select text-sm"
                >
                  {#each locationTypes as locationType}
                    <option value={locationType.type}>{locationType.label}</option>
                  {/each}
                </select>
              </div>
              
              {#if getLocationSubtypes(upload.metadata.location_type).length > 0}
                <div>
                  <label for="location-subtype-{upload.id}" class="label text-xs mb-1"><span>Specific Location</span></label>
                  <select
                    id="location-subtype-{upload.id}"
                    value={upload.metadata.location_sub_type}
                    on:change={(e) => {
                      const target = e.target as HTMLSelectElement;
                      upload.metadata.location_sub_type = target.value;
                      uploads = uploads;
                    }}
                    disabled={upload.uploading}
                    class="select text-sm"
                  >
                    <option value="">Select...</option>
                    {#each getLocationSubtypes(upload.metadata.location_type) as subtype}
                      <option value={subtype.value}>{subtype.label}</option>
                    {/each}
                  </select>
                </div>
              {/if}
              
              <div class="md:col-span-2">
                <label for="description-{upload.id}" class="label text-xs mb-1"><span>Description (optional)</span></label>
                <textarea
                  id="description-{upload.id}"
                  bind:value={upload.metadata.description}
                  disabled={upload.uploading}
                  rows="2"
                  class="textarea text-sm"
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
