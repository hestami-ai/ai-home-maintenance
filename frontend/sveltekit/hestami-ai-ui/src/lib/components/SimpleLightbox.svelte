<script lang="ts">
	import type { PropertyImage } from './types';
	import ModelViewer from './ModelViewer.svelte';
	
	// Component props
	export let image: (PropertyImage & { mediaType?: string }) | null = null;
	export let isOpen: boolean = false;
	export let onClose: () => void = () => {};
	export let containerClass: string = '';
	
	// Debug logging flag
	const DEBUG_EVENTS = true;
	
	// Check if this is a 3D model
	$: is3DModel = image?.mediaType === '3D_MODEL';
	
	// Debug logger
	function logEvent(eventName: string, target: any, detail?: any) {
		if (DEBUG_EVENTS) {
			console.log(`[SimpleLightbox] ${eventName}:`, {
				target: target?.className || target?.tagName || target,
				detail,
				timestamp: Date.now()
			});
		}
	}
	
	// Zoom and pan state
	let zoomLevel = 1;
	let panX = 0;
	let panY = 0;
	
	// Drag state tracking - simplified approach
	let isDragging = false;
	let dragStartX = 0;
	let dragStartY = 0;
	let dragStartPanX = 0;
	let dragStartPanY = 0;
	
	// Reset zoom when image changes or lightbox closes
	$: if (!isOpen || !image) {
		resetZoom();
	}
	
	// Handle keyboard events
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		} else if (e.key === '+') {
			zoomIn();
		} else if (e.key === '-') {
			zoomOut();
		} else if (e.key === '0') {
			resetZoom();
		}
	}
	
	// Zoom functions
	function zoomIn() {
		zoomLevel = Math.min(zoomLevel + 0.25, 3);
	}
	
	function zoomOut() {
		zoomLevel = Math.max(zoomLevel - 0.25, 0.5);
		if (zoomLevel <= 1) {
			panX = 0;
			panY = 0;
		}
	}
	
	function resetZoom() {
		zoomLevel = 1;
		panX = 0;
		panY = 0;
	}
	
	// Drag handlers - simplified approach
	function handleDragStart(e: MouseEvent | Touch) {
		if (zoomLevel <= 1) {
			return;
		}
		
		// Set drag state
		isDragging = true;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		dragStartPanX = panX;
		dragStartPanY = panY;
	}
	
	function handleDragMove(e: MouseEvent | Touch) {
		if (!isDragging) return;
		
		// Calculate the distance moved
		const dx = e.clientX - dragStartX;
		const dy = e.clientY - dragStartY;
		
		// Update pan position
		panX = dragStartPanX + dx;
		panY = dragStartPanY + dy;
		
		// Limit panning based on zoom level
		const maxPan = 300 * (zoomLevel - 1);
		panX = Math.max(Math.min(panX, maxPan), -maxPan);
		panY = Math.max(Math.min(panY, maxPan), -maxPan);
	}
	
	function handleDragEnd() {
		if (!isDragging) return;
		isDragging = false;
	}
	
	// Mouse event handlers
	function handleMouseDown(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		handleDragStart(e);
	}
	
	function handleMouseMove(e: MouseEvent) {
		if (!isDragging) return;
		
		e.preventDefault();
		e.stopPropagation();
		handleDragMove(e);
	}
	
	function handleMouseUp() {
		handleDragEnd();
	}
	
	// Touch event handlers
	function handleTouchStart(e: TouchEvent) {
		if (e.touches.length !== 1) return;
		
		e.stopPropagation();
		handleDragStart(e.touches[0]);
	}
	
	function handleTouchMove(e: TouchEvent) {
		if (!isDragging || e.touches.length !== 1) return;
		
		e.preventDefault();
		e.stopPropagation();
		handleDragMove(e.touches[0]);
	}
	
	function handleTouchEnd() {
		handleDragEnd();
	}
	
	// Handle content click to prevent closing
	function handleContentClick(e: MouseEvent) {
		e.stopPropagation();
	}
</script>

<svelte:window onmousemove={handleMouseMove} onmouseup={handleMouseUp} />

{#if isOpen && image}
	<!-- Accessible dialog overlay -->
	<div 
		class="lightbox-overlay {containerClass}" 
		role="dialog"
		aria-modal="true"
		aria-label="Image lightbox"
		tabindex="0"
		onkeydown={handleKeyDown}
	>
		<!-- Background overlay click handler - MUST be behind content -->
		<button 
			type="button"
			class="overlay-click-handler"
			onclick={(e) => {
				logEvent('OVERLAY BUTTON CLICKED', e.target, { currentTarget: e.currentTarget });
				// Only close if clicking the overlay itself, not children
				if (e.target === e.currentTarget) {
					onClose();
				}
			}}
			onmousedown={(e) => logEvent('overlay-mousedown', e.target)}
			onmouseup={(e) => logEvent('overlay-mouseup', e.target)}
			onpointerdown={(e) => logEvent('overlay-pointerdown', e.target)}
			onpointerup={(e) => logEvent('overlay-pointerup', e.target)}
			aria-label="Close lightbox"
		></button>
		
		<!-- Content container -->
		<div 
			class="lightbox-content" 
			role="document"
		>
			<!-- Removed invisible click handler that was blocking mouse events -->
			<!-- Content container - 3D Model or Image -->
			{#if is3DModel}
				<!-- 3D Model Viewer -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<!-- svelte-ignore a11y_click_events_have_key_keys -->
				<div 
					class="model-container"
					onclick={(e) => { 
						logEvent('model-container-click', e.target, { bubbles: e.bubbles, cancelable: e.cancelable });
						e.stopPropagation(); 
						e.stopImmediatePropagation(); 
					}}
					onmousedown={(e) => { 
						logEvent('model-container-mousedown', e.target, { button: e.button });
						e.stopPropagation(); 
						e.stopImmediatePropagation(); 
					}}
					onmousemove={(e) => { 
						e.stopPropagation(); 
						e.stopImmediatePropagation(); 
					}}
					onmouseup={(e) => { 
						logEvent('model-container-mouseup', e.target, { button: e.button });
						e.stopPropagation(); 
						e.stopImmediatePropagation(); 
					}}
					onpointerdown={(e) => { 
						logEvent('model-container-pointerdown', e.target, { pointerType: e.pointerType, button: e.button });
						e.stopPropagation(); 
						e.stopImmediatePropagation(); 
					}}
					onpointermove={(e) => { 
						e.stopPropagation(); 
						e.stopImmediatePropagation(); 
					}}
					onpointerup={(e) => { 
						logEvent('model-container-pointerup', e.target, { pointerType: e.pointerType, button: e.button });
						e.stopPropagation(); 
						e.stopImmediatePropagation(); 
					}}
					onpointercancel={(e) => { 
						logEvent('model-container-pointercancel', e.target);
						e.stopPropagation(); 
						e.stopImmediatePropagation(); 
					}}
					onwheel={(e) => { 
						e.stopPropagation(); 
						e.stopImmediatePropagation(); 
					}}
					ontouchstart={(e) => { 
						logEvent('model-container-touchstart', e.target);
						e.stopPropagation(); 
						e.stopImmediatePropagation(); 
					}}
					ontouchmove={(e) => { 
						e.stopPropagation(); 
						e.stopImmediatePropagation(); 
					}}
					ontouchend={(e) => { 
						logEvent('model-container-touchend', e.target);
						e.stopPropagation(); 
						e.stopImmediatePropagation(); 
					}}
				>
					<ModelViewer 
						src={image.url} 
						alt={image.description || image.area || '3D Model'}
						height="100%"
						width="100%"
					/>
				</div>
			{:else}
				<!-- Image container with zoom and pan applied -->
				<div 
					class="image-container"
					class:draggable={zoomLevel > 1}
				>
					<!-- Accessible div for pan interaction with ARIA role -->
					<div 
						class="image-pan-area"
						role="button"
						tabindex={zoomLevel > 1 ? 0 : -1}
						aria-label="Pan image"
						aria-disabled={zoomLevel <= 1}
						onmousedown={(e) => {
							e.preventDefault();
							e.stopPropagation();
							handleMouseDown(e);
						}}
						ontouchstart={(e) => {
							e.stopPropagation();
							handleTouchStart(e);
						}}
						ontouchmove={(e) => {
							if (isDragging) {
								e.preventDefault();
								e.stopPropagation();
								handleTouchMove(e);
							}
						}}
						ontouchend={(e) => {
							e.stopPropagation();
							handleTouchEnd();
						}}
						ontouchcancel={(e) => {
							e.stopPropagation();
							handleTouchEnd();
						}}
						onkeydown={(e) => {
							if (e.key === 'Enter' && zoomLevel > 1) {
								// Create a synthetic mouse event for keyboard activation
								const syntheticEvent = {
									clientX: window.innerWidth / 2,
									clientY: window.innerHeight / 2,
									pageX: window.innerWidth / 2,
									pageY: window.innerHeight / 2,
									preventDefault: () => {},
									stopPropagation: () => {}
								} as MouseEvent;
								handleMouseDown(syntheticEvent);
							}
						}}
					>
						<div class="image-wrapper" style="transform: scale({zoomLevel}) translate({panX}px, {panY}px);">
							<img 
								src={image.url} 
								alt={image.description || image.area || 'Property image'} 
								class="lightbox-image"
								draggable="false"
							/>
						</div>
					</div>
				</div>
			{/if}
			
			
			<!-- Zoom controls (only for images, not 3D models) -->
			{#if !is3DModel}
			<div class="zoom-controls">
				<button 
					type="button" 
					class="zoom-button zoom-in" 
					onclick={(e) => { e.stopPropagation(); zoomIn(); }}
					aria-label="Zoom in"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="11" cy="11" r="8"></circle>
						<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
						<line x1="11" y1="8" x2="11" y2="14"></line>
						<line x1="8" y1="11" x2="14" y2="11"></line>
					</svg>
				</button>
				
				<button 
					type="button" 
					class="zoom-button zoom-out" 
					onclick={(e) => { e.stopPropagation(); zoomOut(); }}
					aria-label="Zoom out"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="11" cy="11" r="8"></circle>
						<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
						<line x1="8" y1="11" x2="14" y2="11"></line>
					</svg>
				</button>
				
				<button 
					type="button" 
					class="zoom-button zoom-reset" 
					onclick={(e) => { e.stopPropagation(); resetZoom(); }}
					aria-label="Reset zoom"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M3 2v6h6"></path>
						<path d="M3 13a9 9 0 1 0 3-7.7L3 8"></path>
					</svg>
				</button>
			</div>
			{/if}
			
			<!-- Image metadata -->
			<div class="metadata">
				{#if image.area}
					<p class="area">{image.area}</p>
				{/if}
				
				{#if image.description}
					<p class="description">{image.description}</p>
				{/if}
				
				{#if image.uploadDate}
					<p class="date">Uploaded: {new Date(image.uploadDate).toLocaleDateString()}</p>
				{/if}
			</div>
			
			<!-- Close button -->
			<button 
				type="button" 
				class="close-button" 
				onclick={(e) => { e.stopPropagation(); onClose(); }}
				aria-label="Close lightbox"
			>
				×
			</button>
		</div>
	</div>


{/if}

<style>
	.lightbox-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 9999;
		background: rgba(0, 0, 0, 0.9);
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 0; /* Removed padding */
	}
	
	.lightbox-content {
		position: relative;
		width: 98vw; /* Nearly full width */
		height: 98vh; /* Nearly full height */
		display: flex;
		flex-direction: column;
		border-radius: 0.5rem;
		overflow: hidden;
		background: rgba(0, 0, 0, 0.5);
	}
	
	.image-container {
		position: relative;
		width: 100%;
		flex: 1; /* Take all available space */
		overflow: hidden;
		display: flex;
		justify-content: center;
		align-items: center;
	}
	
	.model-container {
		position: relative;
		width: 100%;
		flex: 1; /* Take all available space */
		overflow: hidden;
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 10; /* Above overlay button */
		pointer-events: auto;
	}

	.image-pan-area {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 3; /* Higher than other elements */
		cursor: move; /* Show move cursor when zoomed in */
	}
	
	.image-wrapper {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
		height: 100%;
		transition: transform 0.1s ease-out;
	}

	.lightbox-image {
		width: auto;
		height: auto;
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		display: block; /* Prevent inline spacing issues */
	}
	
	.metadata {
		padding: 0.75rem; /* Reduced padding */
		background: rgba(0, 0, 0, 0.7);
		color: white;
		flex-shrink: 0; /* Prevent metadata from taking space from image */
	}
	
	.area {
		font-weight: bold;
		font-size: 1.2rem;
		margin-bottom: 0.5rem;
	}
	
	.description {
		margin-bottom: 0.5rem;
	}
	
	.date {
		font-size: 0.9rem;
		opacity: 0.8;
		margin-bottom: 0.5rem;
	}
	
	.close-button {
		position: absolute;
		top: 1rem;
		right: 1rem;
		background: rgba(255, 255, 255, 0.2);
		border: none;
		border-radius: 50%;
		width: 2.5rem;
		height: 2.5rem;
		display: flex;
		justify-content: center;
		align-items: center;
		cursor: pointer;
		color: white;
		font-size: 1.5rem;
		z-index: 10; /* Increased z-index to be above all other elements */
	}
	
	.close-button:hover {
		background: rgba(255, 255, 255, 0.3);
	}
	
	.overlay-click-handler {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: transparent;
		border: none;
		cursor: default;
		z-index: 0; /* Behind everything */
		pointer-events: auto;
	}
	
	.content-click-handler {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: transparent;
		border: none;
		padding: 0;
		margin: 0;
		z-index: 2;
	}
	
	/* Zoom controls */
	.zoom-controls {
		position: absolute;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 0.5rem;
		z-index: 3;
		background: rgba(0, 0, 0, 0.5);
		border-radius: 2rem;
		padding: 0.5rem;
	}
	
	.zoom-button {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		border: none;
		background: rgba(255, 255, 255, 0.2);
		color: white;
		display: flex;
		justify-content: center;
		align-items: center;
		cursor: pointer;
		transition: background-color 0.2s ease;
	}
	
	.zoom-button:hover {
		background: rgba(255, 255, 255, 0.3);
	}
	
	.zoom-button:focus {
		outline: 2px solid rgba(255, 255, 255, 0.5);
		outline-offset: 2px;
	}
	
	/* Transition for smooth zooming */
	
	.draggable .image-wrapper:active {
		transition: none;
	}
	
	.lightbox-image {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		cursor: default;
	}
	
	.image-pan-area {
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		cursor: default;
		outline: none;
	}
	
	.draggable .image-pan-area {
		cursor: grab;
	}
	
	.draggable .image-pan-area:active,
	.draggable .image-pan-area:focus {
		cursor: grabbing;
		outline: none;
	}
	
	.draggable .lightbox-image:active {
		transition: none;
	}
	
	.console {
		position: fixed;
		bottom: 0;
		left: 0;
		width: 100%;
		background: #000;
		color: #00ff00;
		font-family: monospace;
		font-size: 12px;
		padding: 10px;
	}
</style>
