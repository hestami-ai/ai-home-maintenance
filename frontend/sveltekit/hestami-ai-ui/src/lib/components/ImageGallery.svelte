<script lang="ts">
	// ImageGallery.svelte - A reusable image and video gallery component with tag filtering
	
	// Import types from separate file
	import type { GalleryItem, ImageGalleryProps } from './types';
	
	// Component props using Svelte 5 runes
	const props = $props();
	
	// Provide defaults for props
	const items = props.items ?? [];
	const startIndex = props.startIndex ?? 0;
	const showThumbnails = props.showThumbnails ?? true;
	const showFullscreenButton = props.showFullscreenButton ?? true;
	const showPlayButton = props.showPlayButton ?? true;
	const showBullets = props.showBullets ?? false;
	const showNav = props.showNav ?? true;
	const autoPlay = props.autoPlay ?? false;
	const slideInterval = props.slideInterval ?? 3000;
	const slideDuration = props.slideDuration ?? 450;
	const thumbnailPosition = props.thumbnailPosition ?? 'bottom';
	const galleryClass = props.galleryClass ?? '';
	const thumbnailsClass = props.thumbnailsClass ?? '';
	const mainViewerClass = props.mainViewerClass ?? '';
	const navButtonsClass = props.navButtonsClass ?? '';
	const showTags = props.showTags ?? true;
	const tagContainerClass = props.tagContainerClass ?? '';
	const tagClass = props.tagClass ?? '';
	const activeTagClass = props.activeTagClass ?? '';
	const clearFilterClass = props.clearFilterClass ?? '';
	
	// Internal state
	let currentIndex = $state(startIndex);
	let isFullscreen = $state(false);
	let isPlaying = $state(false);
	let playTimer = $state<number | undefined>(undefined);
	let selectedTags = $state<string[]>([]);
	let uniqueTags = $state<string[]>([]);
	let filteredItems = $state<GalleryItem[]>([]);
	
	// Extract all unique tags from items
	$effect(() => {
		const tagSet = new Set<string>();
		items.forEach((item: GalleryItem) => {
			if (item.tags && item.tags.length > 0) {
				item.tags.forEach((tag: string) => tagSet.add(tag));
			}
		});
		uniqueTags = Array.from(tagSet).sort();
	});
	
	// Filter items based on selected tags
	$effect(() => {
		if (selectedTags.length === 0) {
			filteredItems = [...items];
		} else {
			filteredItems = items.filter((item: GalleryItem) => 
				item.tags && item.tags.some((tag: string) => selectedTags.includes(tag))
			);
		}
		
		// Reset current index if it's out of bounds after filtering
		if (filteredItems.length > 0 && currentIndex >= filteredItems.length) {
			currentIndex = 0;
		}
	});
	
	// Get the current item
	const currentItem = $derived(filteredItems[currentIndex] || null);
	
	// Handle tag selection
	function toggleTag(tag: string) {
		if (selectedTags.includes(tag)) {
			selectedTags = selectedTags.filter((t: string) => t !== tag);
		} else {
			selectedTags = [...selectedTags, tag];
		}
	}
	
	// Clear all tag filters
	function clearTagFilters() {
		selectedTags = [];
	}
	
	// Navigation functions
	function goToNext() {
		if (filteredItems.length > 1) {
			currentIndex = (currentIndex + 1) % filteredItems.length;
		}
	}
	
	function goToPrev() {
		if (filteredItems.length > 1) {
			currentIndex = (currentIndex - 1 + filteredItems.length) % filteredItems.length;
		}
	}
	
	function goToIndex(index: number) {
		if (index >= 0 && index < filteredItems.length) {
			currentIndex = index;
		}
	}
	
	// Fullscreen handling
	function toggleFullscreen() {
		isFullscreen = !isFullscreen;
	}
	
	// Auto play functions
	function togglePlay() {
		isPlaying = !isPlaying;
		if (isPlaying) {
			startAutoPlay();
		} else {
			stopAutoPlay();
		}
	}
	
	function startAutoPlay() {
		stopAutoPlay(); // Clear any existing timer
		playTimer = window.setInterval(goToNext, slideInterval);
	}
	
	function stopAutoPlay() {
		if (playTimer) {
			window.clearInterval(playTimer);
			playTimer = undefined;
		}
	}
	
	// Start autoplay if enabled
	$effect(() => {
		if (autoPlay && !playTimer && filteredItems.length > 1) {
			isPlaying = true;
			startAutoPlay();
		}
	});
	
	// Cleanup on component destruction
	function onDestroy() {
		stopAutoPlay();
	}
</script>

<div class="image-gallery {galleryClass}" class:fullscreen={isFullscreen}>
	<!-- Tag filtering section -->
	{#if showTags && uniqueTags.length > 0}
		<div class="tag-container {tagContainerClass}">
			{#each uniqueTags as tag}
				<button 
					type="button" 
					class="tag-button {tagClass}" 
					class:active={selectedTags.includes(tag)} 
					class:active-tag={selectedTags.includes(tag)} 
					class:variant-filled-primary={selectedTags.includes(tag)}
					onclick={() => toggleTag(tag)}
				>
					{tag}
				</button>
			{/each}
			
			{#if selectedTags.length > 0}
				<button 
					type="button" 
					class="clear-filter {clearFilterClass}" 
					onclick={clearTagFilters}
				>
					Clear Filters
				</button>
			{/if}
		</div>
	{/if}
	
	<!-- Main viewer section -->
	<div class="main-viewer {mainViewerClass}" class:fullscreen={isFullscreen}>
		{#if filteredItems.length > 0 && currentItem}
			<!-- Main content display -->
			<div class="main-slide">
				{#if currentItem.renderItem}
					{@const Component = currentItem.renderItem(currentItem)}
					<Component />
				{:else if currentItem.type === 'video'}
					<video
						src={currentItem.original}
						controls
						height={currentItem.originalHeight}
						width={currentItem.originalWidth}
						class="main-image {currentItem.originalClass || ''}"
						title={currentItem.originalTitle}
					>
						<track kind="captions" src="" label="English" />
						Your browser does not support the video tag.
					</video>
				{:else}
					<img
						src={currentItem.original}
						alt={currentItem.originalAlt || ''}
						height={currentItem.originalHeight}
						width={currentItem.originalWidth}
						loading={currentItem.loading || 'lazy'}
						class="main-image {currentItem.originalClass || ''}"
						srcset={currentItem.srcSet}
						sizes={currentItem.sizes}
						title={currentItem.originalTitle}
					/>
				{/if}
				
				{#if currentItem.description}
					<div class="description">
						{currentItem.description}
					</div>
				{/if}
			</div>
			
			<!-- Navigation controls -->
			{#if showNav && filteredItems.length > 1}
				<div class="nav-buttons {navButtonsClass}">
					<button type="button" class="nav-button prev-button" onclick={goToPrev}>
						<span class="sr-only">Previous</span>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><polyline points="15 18 9 12 15 6"></polyline></svg>
					</button>
					<button type="button" class="nav-button next-button" onclick={goToNext}>
						<span class="sr-only">Next</span>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><polyline points="9 18 15 12 9 6"></polyline></svg>
					</button>
				</div>
			{/if}
			
			<!-- Additional controls -->
			<div class="controls">
				{#if showPlayButton && filteredItems.length > 1}
					<button type="button" class="control-button play-button" onclick={togglePlay}>
						{#if isPlaying}
							<span class="sr-only">Pause</span>
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
						{:else}
							<span class="sr-only">Play</span>
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
						{/if}
					</button>
				{/if}
				
				{#if showFullscreenButton}
					<button type="button" class="control-button fullscreen-button" onclick={toggleFullscreen}>
						{#if isFullscreen}
							<span class="sr-only">Exit Fullscreen</span>
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>
						{:else}
							<span class="sr-only">Enter Fullscreen</span>
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
						{/if}
					</button>
				{/if}
			</div>
			
			<!-- Bullets navigation -->
			{#if showBullets && filteredItems.length > 1}
				<div class="bullets">
					{#each filteredItems as _, index}
						<button 
							type="button" 
							class="bullet {index === currentIndex ? 'active' : ''} {filteredItems[index].bulletClass || ''}"
							onclick={() => goToIndex(index)}
						>
							<span class="sr-only">Go to slide {index + 1}</span>
						</button>
					{/each}
				</div>
			{/if}
		{:else}
			<div class="empty-gallery">
				<p>No images to display</p>
			</div>
		{/if}
	</div>
	
	<!-- Thumbnails section -->
	{#if showThumbnails && filteredItems.length > 1}
		<div class="thumbnails {thumbnailsClass} thumbnails-{thumbnailPosition}" class:thumbnails-horizontal={thumbnailPosition === 'top' || thumbnailPosition === 'bottom'} class:thumbnails-vertical={thumbnailPosition === 'left' || thumbnailPosition === 'right'}>
			{#each filteredItems as item, index}
				<div 
					class="thumbnail-item {index === currentIndex ? 'active' : ''}"
					onclick={() => goToIndex(index)}
					onkeydown={(e) => e.key === 'Enter' && goToIndex(index)}
					tabindex="0"
					role="button"
					aria-label={`View ${item.thumbnailLabel || `image ${index + 1}`}`}
				>
					{#if item.renderThumbInner}
						{@const ThumbComponent = item.renderThumbInner(item)}
						<ThumbComponent />
					{:else}
						<img
							src={item.thumbnail}
							alt={item.thumbnailAlt || ''}
							height={item.thumbnailHeight}
							width={item.thumbnailWidth}
							loading={item.thumbnailLoading || 'lazy'}
							class="thumbnail-image {item.thumbnailClass || ''}"
							title={item.thumbnailTitle}
						/>
						{#if item.thumbnailLabel}
							<div class="thumbnail-label">{item.thumbnailLabel}</div>
						{/if}
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	/* Base structure styles - minimal to allow for Skeleton UI customization */
	.image-gallery {
		display: flex;
		flex-direction: column;
		width: 100%;
		position: relative;
	}
	
	.image-gallery.fullscreen {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 9999;
		background: rgba(0, 0, 0, 0.9);
		padding: 1rem;
	}
	
	.main-viewer {
		position: relative;
		width: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		overflow: hidden;
	}
	
	.main-slide {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
	}
	
	.main-image {
		max-width: 100%;
		max-height: 70vh;
		object-fit: contain;
	}
	
	.description {
		margin-top: 0.5rem;
		text-align: center;
	}
	
	.thumbnails {
		display: flex;
		padding: 0.5rem 0;
		overflow-x: auto;
		scrollbar-width: thin;
	}
	
	.thumbnails-horizontal {
		flex-direction: row;
		justify-content: center;
		flex-wrap: wrap;
	}
	
	.thumbnails-vertical {
		flex-direction: column;
		align-items: center;
		max-height: 70vh;
		overflow-y: auto;
	}
	
	.thumbnail-item {
		cursor: pointer;
		margin: 0.25rem;
		opacity: 0.7;
		transition: opacity 0.2s ease;
		border: 2px solid transparent;
	}
	
	.thumbnail-item:hover,
	.thumbnail-item:focus {
		opacity: 0.9;
		outline: none;
	}
	
	.thumbnail-item.active {
		opacity: 1;
		border-color: var(--color-primary-500, #3b82f6);
	}
	
	.thumbnail-image {
		max-width: 100px;
		max-height: 100px;
		object-fit: cover;
	}
	
	.thumbnail-label {
		font-size: 0.75rem;
		text-align: center;
		max-width: 100px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	
	.nav-buttons {
		position: absolute;
		top: 50%;
		left: 0;
		right: 0;
		transform: translateY(-50%);
		display: flex;
		justify-content: space-between;
		pointer-events: none;
	}
	
	.nav-button {
		background: rgba(0, 0, 0, 0.5);
		color: white;
		border: none;
		border-radius: 50%;
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		pointer-events: auto;
		transition: background-color 0.2s ease;
	}
	
	.nav-button:hover {
		background: rgba(0, 0, 0, 0.7);
	}
	
	.controls {
		position: absolute;
		bottom: 10px;
		right: 10px;
		display: flex;
		gap: 0.5rem;
	}
	
	.control-button {
		background: rgba(0, 0, 0, 0.5);
		color: white;
		border: none;
		border-radius: 4px;
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: background-color 0.2s ease;
	}
	
	.control-button:hover {
		background: rgba(0, 0, 0, 0.7);
	}
	
	.bullets {
		display: flex;
		justify-content: center;
		margin-top: 0.5rem;
		gap: 0.5rem;
	}
	
	.bullet {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.3);
		border: none;
		padding: 0;
		cursor: pointer;
	}
	
	.bullet.active {
		background: var(--color-primary-500, #3b82f6);
	}
	
	.tag-container {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	
	.tag-button {
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		background: rgba(0, 0, 0, 0.1);
		border: none;
		cursor: pointer;
		font-size: 0.875rem;
		transition: all 0.2s ease;
	}
	
	.tag-button:hover {
		background: rgba(0, 0, 0, 0.2);
	}
	
	.tag-button.active {
		background: var(--color-primary-500, #3b82f6);
		color: white;
	}
	
	.clear-filter {
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		background: rgba(0, 0, 0, 0.1);
		border: none;
		cursor: pointer;
		font-size: 0.875rem;
		margin-left: 0.5rem;
	}
	
	.clear-filter:hover {
		background: rgba(0, 0, 0, 0.2);
	}
	
	.empty-gallery {
		padding: 2rem;
		text-align: center;
		color: var(--color-surface-500);
	}
	
	/* Accessibility */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}
</style>
