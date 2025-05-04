<script lang="ts">
	import { Trash2, PenSquare, MapPin, Home } from 'lucide-svelte';
	// Import types from central types file
	import type { Property, Media } from '$lib/types';
	
	// Props using Svelte 5 runes syntax
	const { property, onDelete } = $props<{
		property: Property;
		onDelete: () => void;
	}>();
	
	// Get property type from descriptives or use a default
// Based on the API response, propertyType is in descriptives.propertyType (camelCase)
	const propertyType = property.descriptives?.propertyType || property.descriptives?.property_type || 'Residential';
	
	// Format the status for display
	const formattedStatus = property.status.charAt(0) + property.status.slice(1).toLowerCase();
	
	// Flag to track if we're using a placeholder image
	const hasRealImage = $state<boolean>(!!property.featuredImage);
	
	// Determine the image URL to use (only if we have a real image)
	// Use $state to make imageUrl reactive in Svelte 5
	const imageUrl = $state<string | null>(property.featuredImage || null);
	
	// Log image status for debugging
	if (property.featuredImage) {
		console.log(`Using featured image for property ${property.id}:`, property.featuredImage);
	} else {
		console.log(`No image available for property ${property.id}, will use home icon placeholder`);
	}
</script>

<div class="card overflow-hidden h-full flex flex-col">
	<header class="relative">
		<!-- Property Image or Placeholder -->
		<a href={`/properties/${property.id}`} class="block">
			{#if hasRealImage && imageUrl}
				<!-- Real property image -->
				<img 
					src={imageUrl} 
					alt={`${property.title || property.address}, ${property.city}, ${property.state}`}
					class="w-full h-48 object-cover hover:opacity-90 transition-opacity"
				/>
			{:else}
				<!-- Home icon placeholder -->
				<div class="w-full h-48 flex items-center justify-center bg-surface-200-700-token/30 hover:bg-surface-300-600-token/30 transition-colors">
					<Home class="h-24 w-24 text-primary-500 opacity-50" />
				</div>
			{/if}
		</a>
		
		<!-- Property Type and Status Badges -->
		<div class="absolute top-2 right-2 flex flex-col gap-2">
			<span class="badge variant-filled-primary">{propertyType}</span>
			<span class="badge variant-filled-{property.status === 'ACTIVE' ? 'success' : property.status === 'PENDING' ? 'warning' : 'neutral'}">
				{formattedStatus}
			</span>
			{#if property.media && property.media.length > 0}
				<span class="badge variant-filled-secondary">
					{property.media.filter((m: Media) => m.media_type === 'IMAGE' && !m.is_deleted).length} Images
				</span>
			{/if}
		</div>
	</header>
	
	<div class="p-4 flex-grow">
		<!-- Property Title and Address -->
		<div class="flex items-start gap-2">
			<MapPin class="h-5 w-5 text-primary-500 flex-shrink-0 mt-0.5" />
			<div>
				<a href={`/properties/${property.id}`} class="hover:underline">
					<h3 class="font-semibold text-lg">{property.title || property.address}</h3>
				</a>
				<p class="text-surface-600-300-token">{property.address}</p>
				<p class="text-surface-600-300-token">{property.city}, {property.state} {property.zip_code}</p>
				
				<!-- Show service requests count if any -->
				{#if property.service_requests?.length > 0}
					<p class="mt-2 text-sm">
						<span class="badge variant-filled-secondary">{property.service_requests.length} Service Request{property.service_requests.length !== 1 ? 's' : ''}</span>
					</p>
				{/if}
			</div>
		</div>
	</div>
	
	<footer class="p-4 border-t border-surface-300-600-token flex justify-between gap-2">
		<a 
			href={`/properties/${property.id}`} 
			class="btn btn-sm variant-filled-primary"
		>
			View Details
		</a>
		
		<div class="flex gap-2">
			<a 
				href={`/properties/${property.id}/edit`} 
				class="btn btn-sm variant-ghost-secondary"
			>
				<PenSquare class="h-4 w-4 mr-1" />
				Edit
			</a>
			<button 
				class="btn btn-sm variant-ghost-error" 
				onclick={onDelete}
			>
				<Trash2 class="h-4 w-4 mr-1" />
				Delete
			</button>
		</div>
	</footer>
</div>
