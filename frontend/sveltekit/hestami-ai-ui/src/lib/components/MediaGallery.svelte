<!-- 
  MediaGallery.svelte - A component for displaying a gallery of media items
  Handles different states of media processing and provides a grid layout
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import MediaItem from './MediaItem.svelte';
  import SimpleLightbox from './SimpleLightbox.svelte';
  import type { PropertyImage } from './types';
  
  // Props
  export let mediaItems: any[] = [];
  export let title: string = '';
  export let emptyMessage: string = 'No media available';
  export let columns: number = 3;
  export let aspectRatio: string = '16/9';
  export let size: 'small' | 'medium' | 'large' = 'medium';
  export let showTitles: boolean = true;
  
  // Lightbox state
  let lightboxOpen = false;
  let currentIndex = 0;
  let currentLightboxImage: PropertyImage | null = null;
  
  // Filter out deleted items, non-image/video files, and timeline comment attachments for the lightbox
  $: readyMediaItems = mediaItems.filter(item => {
    // Check if item is ready and not deleted
    const isReadyAndNotDeleted = item.is_ready && !item.is_deleted;
    
    // Check if item is an image or video
    const isImageOrVideo = item.is_image || item.is_video;
    
    // Check if item is not part of a timeline comment
    // Items attached to timeline comments will have metadata that indicates they're attachments
    const isNotTimelineAttachment = !item.metadata || 
                                  (typeof item.metadata === 'string' ? 
                                    !item.metadata.includes('timeline') : 
                                    !item.metadata.timeline_comment_id);
    
    return isReadyAndNotDeleted && isImageOrVideo && isNotTimelineAttachment;
  });
  
  // Determine if we have any media to show
  $: hasMedia = readyMediaItems && readyMediaItems.length > 0;
  
  // Determine if any media is still processing (only for image/video files that aren't timeline attachments)
  $: hasProcessingMedia = mediaItems.some(item => {
    // Only check processing status for images and videos
    const isImageOrVideo = item.is_image || item.is_video;
    
    // Skip timeline comment attachments
    const isNotTimelineAttachment = !item.metadata || 
                                  (typeof item.metadata === 'string' ? 
                                    !item.metadata.includes('timeline') : 
                                    !item.metadata.timeline_comment_id);
    
    // Check if it's still processing
    const isProcessing = !item.is_ready && 
                        ['PENDING', 'SCANNING', 'PROCESSING'].includes(item.processing_status);
    
    return isImageOrVideo && isNotTimelineAttachment && isProcessing;
  });
  
  // Auto-refresh gallery if media is still processing
  let refreshInterval: number;
  let refreshCount = 0;
  
  onMount(() => {
    if (hasProcessingMedia) {
      refreshInterval = setInterval(() => {
        if (refreshCount < 10) { // Limit refreshes
          // Dispatch an event to request refresh of media data
          const refreshEvent = new CustomEvent('refresh-media');
          window.dispatchEvent(refreshEvent);
          refreshCount++;
        } else {
          clearInterval(refreshInterval);
        }
      }, 10000); // Refresh every 10 seconds
    }
    
    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
    };
  });
  
  // Convert media item to PropertyImage format for SimpleLightbox
  function convertToPropertyImage(item: any): PropertyImage {
    return {
      id: item.id,
      url: item.file_url,
      thumbnail: item.thumbnail_medium_url || item.file_url,
      area: item.title || '',
      description: item.description || '',
      uploadDate: new Date(item.created_at),
      tags: [item.media_type],
      width: 1200, // Default values since we might not have actual dimensions
      height: 800
    };
  }
  
  // Handle opening the lightbox
  function openLightbox(index: number) {
    if (readyMediaItems[index].is_ready) {
      currentIndex = index;
      currentLightboxImage = convertToPropertyImage(readyMediaItems[index]);
      lightboxOpen = true;
    }
  }
  
  // Handle closing the lightbox
  function closeLightbox() {
    lightboxOpen = false;
    currentLightboxImage = null;
  }
</script>

{#if title}
  <h3 class="mb-2 text-lg font-medium">{title}</h3>
{/if}

{#if hasMedia}
  <div class="grid gap-4" style="grid-template-columns: repeat({columns}, minmax(0, 1fr));" role="list">
    {#each readyMediaItems as item, i}
      <div 
        class="media-container flex items-center justify-center"
        role="listitem"
      >
        <button
          class="w-full h-full bg-transparent border-0 p-0 cursor-pointer"
          aria-label={`View ${item.title || 'media item'}`}
          on:click={() => openLightbox(i)}
        >
        <MediaItem 
          media={item} 
          {size} 
          showTitle={showTitles} 
          {aspectRatio} 
          className="cursor-pointer hover:opacity-90 transition-opacity"
        />
      </div>
    {/each}
  </div>
  
  {#if hasProcessingMedia}
    <div class="mt-4 text-sm text-surface-600 dark:text-surface-400">
      Some media is still being processed and will appear automatically when ready.
    </div>
  {/if}
{:else}
  <div class="p-4 text-center text-surface-600 dark:text-surface-400 bg-surface-100 dark:bg-surface-800 rounded-lg">
    {emptyMessage}
  </div>
{/if}

<!-- Use SimpleLightbox for image viewing with zoom capabilities -->
<SimpleLightbox 
  image={currentLightboxImage}
  isOpen={lightboxOpen}
  onClose={closeLightbox}
  containerClass="z-50"
/>

<!-- Custom Lightbox for video and other media types -->
{#if lightboxOpen && readyMediaItems.length > 0 && currentIndex < readyMediaItems.length && !readyMediaItems[currentIndex].is_image}
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80" 
    role="dialog"
    aria-modal="true"
    aria-label="Media viewer"
    on:click={closeLightbox}
    on:keydown={(e) => e.key === 'Escape' && closeLightbox()}
  >
    <div 
      class="lightbox-content bg-white dark:bg-gray-800 p-4 rounded-lg max-w-4xl" 
      role="document"
      on:click|stopPropagation
    >
      <div class="flex justify-end mb-2">
        <button 
          class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" 
          on:click={closeLightbox}
          aria-label="Close lightbox"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {#if readyMediaItems[currentIndex].is_video}
        <video 
          src={readyMediaItems[currentIndex].file_url} 
          controls 
          class="max-h-[70vh] max-w-full mx-auto"
        >
          <track kind="captions" src="" label="English" />
          Your browser does not support the video tag.
        </video>
      {:else}
        <div class="p-8 bg-gray-100 dark:bg-gray-700 rounded-lg text-center">
          <div class="text-4xl mb-4" aria-hidden="true">📄</div>
          <p>{readyMediaItems[currentIndex].original_filename || 'File'}</p>
          <a 
            href={readyMediaItems[currentIndex].file_url} 
            download 
            class="mt-4 inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Download File
          </a>
        </div>
      {/if}
      
      {#if readyMediaItems[currentIndex].title}
        <div class="mt-4 text-lg font-medium">{readyMediaItems[currentIndex].title}</div>
      {/if}
      
      {#if readyMediaItems[currentIndex].description}
        <div class="mt-2 text-gray-600 dark:text-gray-400">
          {readyMediaItems[currentIndex].description}
        </div>
      {/if}
      
      <!-- Navigation controls -->
      {#if readyMediaItems.length > 1}
        <div class="flex justify-between mt-4">
          <button 
            class="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600" 
            on:click={() => {
              currentIndex = (currentIndex - 1 + readyMediaItems.length) % readyMediaItems.length;
              currentLightboxImage = readyMediaItems[currentIndex].is_image ? convertToPropertyImage(readyMediaItems[currentIndex]) : null;
            }}
            disabled={readyMediaItems.length <= 1}
          >
            Previous
          </button>
          <div class="text-center flex items-center">
            {currentIndex + 1} of {readyMediaItems.length}
          </div>
          <button 
            class="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600" 
            on:click={() => {
              currentIndex = (currentIndex + 1) % readyMediaItems.length;
              currentLightboxImage = readyMediaItems[currentIndex].is_image ? convertToPropertyImage(readyMediaItems[currentIndex]) : null;
            }}
            disabled={readyMediaItems.length <= 1}
          >
            Next
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .media-container {
    transition: transform 0.2s ease-in-out;
  }
  
  .media-container:hover {
    transform: scale(1.02);
  }
  
  .lightbox-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    max-width: 90vw;
  }
  
  /* Responsive grid adjustments */
  @media (max-width: 768px) {
    :global(.grid) {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
  }
  
  @media (max-width: 480px) {
    :global(.grid) {
      grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
    }
  }
</style>
