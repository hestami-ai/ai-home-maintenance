<script lang="ts">
	// Import necessary types
	import type { PropertyImage } from './types';
	
	// Component props using traditional Svelte props
	export let image: PropertyImage | null = null;
	export let isOpen: boolean = false;
	export let onClose: () => void = () => {};
	export let containerClass: string = '';
</script>

{#if isOpen && image}
	<div 
		class="lightbox-overlay {containerClass}" 
		on:click={onClose}
	>
		<div 
			class="lightbox-content" 
			on:click|stopPropagation
		>
			<div class="image-container">
				<img 
					src={image.url} 
					alt={image.description || image.area || 'Property image'} 
					class="lightbox-image"
				/>
			</div>
			
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
			
					aria-label="Close lightbox"
				>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
				</button>
			</div>
		</div>
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
				onclick={onClose}
				aria-label="Close lightbox"
			>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
			</button>
		</div>
	</div>
{/if}

<style>
	/* Simplified styles */
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
		padding: 1rem;
	}
	
	.lightbox-content {
		position: relative;
		max-width: 90vw;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		border-radius: 0.5rem;
		overflow: hidden;
		background: rgba(0, 0, 0, 0.5);
	}
	
	.image-container {
		position: relative;
		width: 100%;
		height: 70vh;
		overflow: hidden;
		display: flex;
		justify-content: center;
		align-items: center;
	}
	
	.lightbox-image {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}
	
	.metadata {
		padding: 1rem;
		background: rgba(0, 0, 0, 0.7);
		color: white;
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
	}
	
	.close-button:hover {
		background: rgba(255, 255, 255, 0.3);
	}
</style>
