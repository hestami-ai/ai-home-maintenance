<script lang="ts">
	import { createDialog } from '@melt-ui/svelte';
	import { fade } from 'svelte/transition';
	import { X, AlertTriangle, Loader } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	
	// Define the property type based on Django model
	interface Property {
		id: string;
		title: string;
		description: string;
		address: string;
		city: string;
		state: string;
		zip_code: string;
		country: string;
		status: string;
		created_at: string;
		updated_at: string;
		owner: string;
		owner_details: {
			id: string;
			email: string;
			first_name: string;
			last_name: string;
			user_role: string;
		};
		media_count: number;
		descriptives: Record<string, any>;
		service_requests: any[];
	}
	
	// Get property type from descriptives or use a default
	const propertyType = (property: Property | null) => property?.descriptives?.property_type || 'Residential';
	
	// Get a placeholder image
	const placeholderImages = [
		'https://images.unsplash.com/photo-1568605114967-8130f3a36994',
		'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9',
		'https://images.unsplash.com/photo-1600585154340-be6161a56a0c'
	];
	
	// Use a placeholder image based on the property ID
	const getImageUrl = (property: Property | null) => {
		if (!property) return placeholderImages[0];
		const imageIndex = parseInt(property.id.replace(/[^0-9]/g, '').slice(0, 2) || '0', 10) % placeholderImages.length;
		return placeholderImages[imageIndex] + '?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80';
	}
	
	// Props using Svelte 5 runes syntax
	const { isOpen, property, onClose, onDelete } = $props<{
		isOpen: boolean;
		property: Property;
		onClose: () => void;
		onDelete: () => void;
	}>();
	
	// Loading state
	let isSubmitting = $state(false);
	
	// Create Melt UI dialog
	const {
		elements: { trigger, overlay, content, title, description, close },
		states: { open }
	} = createDialog({
		forceVisible: true
	});
	
	// Sync the open state with the isOpen prop
	$effect(() => {
		open.set(isOpen);
	});
</script>

<!-- Dialog Overlay -->
{#if $open}
	<div use:overlay class="fixed inset-0 z-50 bg-black/50" transition:fade={{ duration: 150 }}>
		<!-- Dialog Content -->
		<div
			use:content
			class="fixed left-[50%] top-[50%] z-50 max-h-[85vh] w-[90vw] max-w-[450px] translate-x-[-50%] translate-y-[-50%] overflow-auto rounded-lg bg-white dark:bg-surface-900 p-6 shadow-xl border border-surface-300-600-token"
			transition:fade={{ duration: 150 }}
		>
			<!-- Dialog Header -->
			<div class="flex items-center justify-between mb-4">
				<div class="flex items-center gap-2 text-error-500">
					<AlertTriangle class="h-6 w-6" />
					<h2 use:title class="h3 font-semibold">Delete Property</h2>
				</div>
				<button
					use:close
					class="btn-icon btn-icon-sm variant-soft-surface"
					onclick={onClose}
				>
					<X class="h-5 w-5" />
				</button>
			</div>
			
			<!-- Dialog Content -->
			<div class="mb-6">
				<p use:description class="mb-4">
					Are you sure you want to delete this property? This action cannot be undone.
				</p>
				
				<!-- Property Details -->
				<div class="card variant-soft p-4 mb-4">
					<div class="flex items-start gap-3">
						<img 
							src={getImageUrl(property)} 
							alt={property.title || property.address}
							class="w-16 h-16 rounded-md object-cover"
						/>
						<div>
							<h3 class="font-semibold">{property.title || property.address}</h3>
							<p class="text-sm text-surface-600-300-token">{property.address}</p>
							<p class="text-sm text-surface-600-300-token">{property.city}, {property.state} {property.zip_code}</p>
							<div class="flex gap-1 mt-1">
								<span class="badge variant-soft-primary">{propertyType(property)}</span>
								<span class="badge variant-soft-{property.status === 'ACTIVE' ? 'success' : property.status === 'PENDING' ? 'warning' : 'neutral'}">
									{property.status.charAt(0) + property.status.slice(1).toLowerCase()}
								</span>
							</div>
						</div>
					</div>
				</div>
				
				<!-- Warning -->
				<div class="alert variant-soft-warning">
					<span>Deleting this property will remove all associated service requests and records.</span>
				</div>
			</div>
			
			<!-- Dialog Actions - Using form with enhance -->
			<form
				method="POST"
				action="?/deleteProperty"
				use:enhance={() => {
					// Pre-submission logic
					isSubmitting = true;
					
					return async ({ result }) => {
						isSubmitting = false;
						
						if (result.type === 'success') {
							// Invalidate the properties data to refresh the list
							// Use the specific invalidation key that matches the server-side depends() call
							await invalidate('properties');
							
							// Close dialog
							onClose();
							
							// Notify parent of successful deletion
							onDelete();
						} else if (result.type === 'failure') {
							// Show error message
							alert(result.data?.message || 'Failed to delete property');
						} else {
							alert('An unexpected error occurred');
						}
					};
				}}
				class="flex justify-end gap-2"
			>
				<!-- Hidden input for property ID -->
				<input type="hidden" name="propertyId" value={property.id} />
				
				<button
					type="button"
					class="btn variant-ghost"
					onclick={onClose}
					disabled={isSubmitting}
				>
					Cancel
				</button>
				<button
					type="submit"
					class="btn variant-filled-error"
					disabled={isSubmitting}
				>
					{#if isSubmitting}
						<Loader class="h-5 w-5 mr-2 animate-spin" />
						Deleting...
					{:else}
						Delete Property
					{/if}
				</button>
			</form>
		</div>
	</div>
{/if}
