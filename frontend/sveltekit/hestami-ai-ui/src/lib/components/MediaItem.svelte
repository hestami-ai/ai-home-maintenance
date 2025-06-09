<!-- 
  MediaItem.svelte - A component for displaying media items with processing status
  This component handles different states of media processing and provides appropriate UI
-->
<script lang="ts">
  import { onMount } from 'svelte';
  
  // Media item data
  export let media: any; // Media object from API
  export let size: 'small' | 'medium' | 'large' = 'medium';
  export let showTitle = true;
  export let aspectRatio = '16/9';
  export let className = '';
  
  // Determine which URL to use based on size
  let mediaUrl: string;
  $: {
    if (size === 'small' && media.thumbnail_small_url) {
      mediaUrl = media.thumbnail_small_url;
    } else if (size === 'medium' && media.thumbnail_medium_url) {
      mediaUrl = media.thumbnail_medium_url;
    } else if (size === 'large' && media.thumbnail_large_url) {
      mediaUrl = media.thumbnail_large_url;
    } else {
      mediaUrl = media.file_url;
    }
  }
  
  // Processing status indicators
  $: isReady = media.is_ready === true;
  $: isDeleted = media.is_deleted === true;
  $: processingStatus = media.processing_status || 'PENDING';
  
  // Status message based on processing status
  let statusMessage: string;
  $: {
    switch (processingStatus) {
      case 'SCANNING':
        statusMessage = 'Scanning for malware...';
        break;
      case 'PROCESSING':
        statusMessage = 'Processing media...';
        break;
      case 'PENDING':
        statusMessage = 'Preparing media...';
        break;
      case 'FAILED':
        statusMessage = 'Scan failed';
        break;
      case 'REJECTED':
        statusMessage = 'File rejected - security issue';
        break;
      case 'PROCESSING_FAILED':
        statusMessage = 'Processing failed';
        break;
      default:
        statusMessage = '';
    }
  }
  
  // Handle image loading errors
  let imageError = false;
  const handleImageError = () => {
    imageError = true;
  };
  
  // Retry loading the image periodically if it's still processing
  let retryCount = 0;
  let retryInterval: number;
  
  onMount(() => {
    // If media is not ready but in a processing state, set up retry interval
    if (!isReady && ['PENDING', 'SCANNING', 'PROCESSING'].includes(processingStatus)) {
      retryInterval = setInterval(() => {
        if (retryCount < 10) { // Limit retries
          // Force image reload by appending timestamp
          mediaUrl = `${mediaUrl.split('?')[0]}?t=${Date.now()}`;
          retryCount++;
        } else {
          clearInterval(retryInterval);
        }
      }, 5000); // Retry every 5 seconds
    }
    
    return () => {
      if (retryInterval) clearInterval(retryInterval);
    };
  });
</script>

<div class="media-item {className}" style="aspect-ratio: {aspectRatio};">
  {#if isDeleted}
    <!-- Deleted media placeholder -->
    <div class="placeholder deleted">
      <span class="icon">🚫</span>
      <p>This file has been removed</p>
    </div>
  {:else if isReady}
    <!-- Ready media display -->
    {#if media.is_image}
      <img 
        src={mediaUrl} 
        alt={media.title || 'Image'} 
        on:error={handleImageError}
        class:hidden={imageError}
      />
      {#if imageError}
        <div class="placeholder error">
          <span class="icon">⚠️</span>
          <p>Unable to load image</p>
        </div>
      {/if}
    {:else if media.is_video}
      <div class="video-thumbnail">
        <img 
          src={mediaUrl} 
          alt={media.title || 'Video thumbnail'} 
          on:error={handleImageError}
          class:hidden={imageError}
        />
        <div class="play-button">▶</div>
        {#if imageError}
          <div class="placeholder error">
            <span class="icon">⚠️</span>
            <p>Unable to load video thumbnail</p>
          </div>
        {/if}
      </div>
    {:else}
      <div class="placeholder file">
        <span class="icon">📄</span>
        <p>{media.original_filename || 'File'}</p>
      </div>
    {/if}
  {:else}
    <!-- Processing placeholder -->
    <div class="placeholder processing">
      <div class="spinner"></div>
      <p>{statusMessage}</p>
    </div>
  {/if}
  
  {#if showTitle && media.title}
    <div class="media-title">
      {media.title}
    </div>
  {/if}
</div>

<style>
  .media-item {
    position: relative;
    overflow: hidden;
    border-radius: 0.375rem;
    background-color: rgba(var(--color-surface-500) / 0.2);
  }
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: opacity 0.2s ease-in-out;
  }
  
  .hidden {
    display: none;
  }
  
  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 1rem;
    text-align: center;
    color: var(--color-surface-900);
  }
  
  .placeholder .icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }
  
  .placeholder p {
    font-size: 0.875rem;
    opacity: 0.8;
  }
  
  .placeholder.processing {
    background-color: rgba(var(--color-primary-500) / 0.1);
  }
  
  .placeholder.error {
    background-color: rgba(var(--color-error-500) / 0.1);
  }
  
  .placeholder.deleted {
    background-color: rgba(var(--color-error-500) / 0.1);
  }
  
  .placeholder.file {
    background-color: rgba(var(--color-surface-500) / 0.1);
  }
  
  .video-thumbnail {
    position: relative;
    width: 100%;
    height: 100%;
  }
  
  .play-button {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 3rem;
    height: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    border-radius: 50%;
    font-size: 1.5rem;
  }
  
  .media-title {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 0.5rem;
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    font-size: 0.875rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  /* Custom spinner */
  .spinner {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 3px solid rgba(0, 0, 0, 0.1);
    border-top-color: #3b82f6;
    animation: spin 1s linear infinite;
    margin-bottom: 0.5rem;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
