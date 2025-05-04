<script lang="ts">
	import { page } from '$app/stores';
	import { Plus, Home } from 'lucide-svelte';
	import PropertyCard from '$lib/components/properties/PropertyCard.svelte';
	import AddPropertyDialog from '$lib/components/properties/AddPropertyDialog.svelte';
	import DeletePropertyDialog from '$lib/components/properties/DeletePropertyDialog.svelte';
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';

	// Import types from central types file
	import type { Property } from '$lib/types';
	
	// Import data from the load function using Svelte 5 runes syntax
	const { data } = $props<{ data?: { properties?: Property[] } }>();
	
	// Extract properties from the data object
	const initialProperties = data?.properties || [];
	
	// Import PropertyInput type from central types file
	import type { PropertyInput } from '$lib/types';
	// Use PropertyInput as our form input type
	type PropertyFormInput = PropertyInput;
	
	// Make properties reactive
	let properties = $state<Property[]>(initialProperties);
	
	// Keep properties in sync with data.properties using $effect
	$effect(() => {
		if (data?.properties) {
			properties = data.properties;
		}
	});
	
	// State for dialogs
	let isAddDialogOpen = $state(false);
	let isDeleteDialogOpen = $state(false);
	let propertyToDelete = $state<Property | null>(null);
	
	// Handle adding a new property
	function handleAddProperty(newProperty: PropertyFormInput) {
		// The AddPropertyDialog component now handles the form submission
		// with use:enhance, so we just need to close the dialog
		isAddDialogOpen = false;
		
		// Force a refresh of the properties data using the same key as in the server load function
		invalidate('properties');
	}
	
	// Handle deleting a property
	function handleDeleteProperty() {
		// The DeletePropertyDialog component now handles the form submission
		// with use:enhance, so we just need to close the dialog
		isDeleteDialogOpen = false;
		propertyToDelete = null;
	}
	
	// Open the delete confirmation dialog
	function openDeleteDialog(property: Property) {
		propertyToDelete = property;
		isDeleteDialogOpen = true;
	}
</script>

<div class="container mx-auto space-y-8 pb-8">
	<header class="flex justify-between items-center">
		<div>
			<h1 class="h1">My Properties</h1>
			<p class="text-surface-600-300-token">Manage your registered properties</p>
		</div>
		<button 
			class="btn variant-filled-primary" 
			onclick={() => isAddDialogOpen = true}
		>
			<Plus class="h-5 w-5 mr-2" />
			Add Property
		</button>
	</header>
	
	{#if !properties || properties.length === 0}
		<div class="card p-8 text-center">
			<div class="flex flex-col items-center justify-center space-y-4">
				<div class="p-4 rounded-full bg-surface-200-700-token">
					<Home class="h-12 w-12 text-surface-600-300-token" />
				</div>
				<h2 class="h3">No Properties Found</h2>
				<p class="text-surface-600-300-token max-w-md">You haven't added any properties yet. Add your first property to start managing maintenance requests.</p>
				<button 
					class="btn variant-filled-primary" 
					onclick={() => isAddDialogOpen = true}
				>
					<Plus class="h-5 w-5 mr-2" />
					Add Your First Property
				</button>
			</div>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each properties as property}
				<PropertyCard 
					{property} 
					onDelete={() => openDeleteDialog(property)} 
				/>
			{/each}
		</div>
	{/if}
</div>

<!-- Add Property Dialog -->
<AddPropertyDialog 
	isOpen={isAddDialogOpen} 
	onClose={() => isAddDialogOpen = false}
	onAdd={handleAddProperty}
/>

<!-- Delete Property Dialog -->
<DeletePropertyDialog 
	isOpen={isDeleteDialogOpen} 
	property={propertyToDelete || {
		id: '',
		title: '',
		description: '',
		address: '',
		city: '',
		state: '',
		zip_code: '',
		country: '',
		status: 'PENDING',
		created_at: '',
		updated_at: '',
		owner: '',
		owner_details: {
			id: '',
			email: '',
			first_name: '',
			last_name: '',
			user_role: ''
		},
		media_count: 0,
		descriptives: {},
		service_requests: []
	}}
	onClose={() => {
		isDeleteDialogOpen = false;
		propertyToDelete = null;
	}}
	onDelete={() => handleDeleteProperty()}
/>
