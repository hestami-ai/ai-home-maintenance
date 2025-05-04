<script lang="ts">
	import { createDialog } from '@melt-ui/svelte';
	import { fade } from 'svelte/transition';
	import { X, Clipboard, Upload } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { Property } from '$lib/types';
	import { ServiceCategory, ServicePriority } from '$lib/types';
	
	// Props using Svelte 5 runes syntax
	const { isOpen, onClose, properties } = $props<{
		isOpen: boolean;
		onClose: () => void;
		properties: Property[];
	}>();
	
	// Request categories from the ServiceCategory enum with labels
	type CategoryOption = {
		value: ServiceCategory;
		label: string;
	};
	
	const categories: CategoryOption[] = [
		{ value: ServiceCategory.PLUMBING, label: 'Plumbing' },
		{ value: ServiceCategory.ELECTRICAL, label: 'Electrical' },
		{ value: ServiceCategory.HVAC, label: 'HVAC' },
		{ value: ServiceCategory.GENERAL_MAINTENANCE, label: 'General Maintenance' },
		{ value: ServiceCategory.LANDSCAPING, label: 'Landscaping' },
		{ value: ServiceCategory.CLEANING, label: 'Cleaning' },
		{ value: ServiceCategory.SECURITY, label: 'Security' },
		{ value: ServiceCategory.PEST_CONTROL, label: 'Pest Control' },
		{ value: ServiceCategory.ROOFING, label: 'Roofing' },
		{ value: ServiceCategory.REMODELING, label: 'Remodeling' },
		{ value: ServiceCategory.OTHER, label: 'Other' }
	];
	
	// Property value will be initialized once properties are available
	let propertyValue = $state('');
	
	// Form state
	let titleValue = $state('');
	let descriptionValue = $state('');
	let categoryValue = $state(categories[0].value);
	let priorityValue = $state(ServicePriority.MEDIUM);
	
	// Initialize propertyValue when properties are available
	$effect(() => {
		if (properties && properties.length > 0) {
			propertyValue = properties[0].id;
		}
	});
	
	// Form validation
	let errors = $state({
		title: '',
		description: '',
		property: ''
	});
	
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
	
	// Form validation function
	function validateForm(): boolean {
		// Reset errors
		errors = {
			title: '',
			description: '',
			property: ''
		};
		
		// Validate form
		let isValid = true;
		
		if (!titleValue.trim()) {
			errors.title = 'Title is required';
			isValid = false;
		}
		
		if (!descriptionValue.trim()) {
			errors.description = 'Description is required';
			isValid = false;
		}
		
		if (!propertyValue) {
			errors.property = 'Property is required';
			isValid = false;
		}
		
		return isValid;
	}
</script>

<!-- Dialog Overlay -->
{#if $open}
	<div use:overlay class="fixed inset-0 z-50 bg-black/50" transition:fade={{ duration: 150 }}>
		<!-- Dialog Content -->
		<div
			use:content
			class="fixed left-[50%] top-[50%] z-50 max-h-[85vh] w-[90vw] max-w-[500px] translate-x-[-50%] translate-y-[-50%] overflow-auto rounded-lg bg-white dark:bg-surface-900 p-6 shadow-xl border border-surface-300-600-token"
			transition:fade={{ duration: 150 }}
		>
			<!-- Dialog Header -->
			<div class="flex items-center justify-between mb-6">
				<div>
					<h2 use:title class="h3 font-semibold">Create Service Request</h2>
					<p use:description class="text-surface-600-300-token">
						Enter the details of your service request below.
					</p>
				</div>
				<button
					use:close
					class="btn-icon btn-icon-sm variant-soft-surface"
					onclick={onClose}
				>
					<X class="h-5 w-5" />
				</button>
			</div>
			
			<!-- Request Form -->
			<form 
				method="POST" 
				action="?/createServiceRequest"
				use:enhance={({ formElement }) => {
					// Validate form before submission
					if (!validateForm()) {
						return;
					}
					
					return async ({ result }) => {
						if (result.type === 'success') {
							// Reset form
							titleValue = '';
							descriptionValue = '';
							categoryValue = categories[0].value;
							propertyValue = properties.length > 0 ? properties[0].id : '';
							priorityValue = ServicePriority.MEDIUM;
							
							// Close dialog
							onClose();
							
							// Invalidate all data to refresh the page
							await invalidateAll();
						}
					};
				}}
				class="space-y-4">
				<!-- Title -->
				<div class="form-field {errors.title ? 'input-error' : ''}">
					<label class="label" for="request-title">
						<span>Title</span>
					</label>
					<input
						id="request-title"
						type="text"
						placeholder="Brief description of the issue"
						bind:value={titleValue}
						class="input"
					/>
					{#if errors.title}
						<p class="text-error-500 text-sm mt-1">{errors.title}</p>
					{/if}
				</div>
				
				<!-- Description -->
				<div class="form-field {errors.description ? 'input-error' : ''}">
					<label class="label" for="request-description">
						<span>Description</span>
					</label>
					<textarea
						id="request-description"
						placeholder="Detailed description of the issue"
						bind:value={descriptionValue}
						class="textarea h-24"
						rows="3"
					></textarea>
					{#if errors.description}
						<p class="text-error-500 text-sm mt-1">{errors.description}</p>
					{/if}
				</div>
				
				<!-- Category -->
				<div class="form-field">
					<label class="label" for="request-category">
						<span>Category</span>
					</label>
					<select id="request-category" bind:value={categoryValue} class="select">
						{#each categories as category}
							<option value={category.value}>{category.label}</option>
						{/each}
					</select>
				</div>
				
				<!-- Property -->
				<div class="form-field {errors.property ? 'input-error' : ''}">
					<label class="label" for="request-property">
						<span>Property</span>
					</label>
					<select id="request-property" bind:value={propertyValue} class="select">
						{#if properties.length === 0}
							<option value="">No properties available</option>
						{:else}
							{#each properties as property}
								<option value={property.id}>{property.title} - {property.address}, {property.city}, {property.state}</option>
							{/each}
						{/if}
					</select>
					{#if errors.property}
						<p class="text-error-500 text-sm mt-1">{errors.property}</p>
					{/if}
				</div>
				
				<!-- Priority -->
				<div class="form-field">
					<label class="label" for="request-priority">
						<span>Priority</span>
					</label>
					<div class="flex gap-2">
						<button
							type="button"
							class="chip w-full justify-center {priorityValue === ServicePriority.LOW ? 'preset-filled-success-500' : 'preset-outlined'}"
							onclick={() => priorityValue = ServicePriority.LOW}
						>
							<span>Low</span>
						</button>
						<button
							type="button"
							class="chip w-full justify-center {priorityValue === ServicePriority.MEDIUM ? 'preset-filled-warning-500' : 'preset-outlined'}"
							onclick={() => priorityValue = ServicePriority.MEDIUM}
						>
							<span>Medium</span>
						</button>
						<button
							type="button"
							class="chip w-full justify-center {priorityValue === ServicePriority.HIGH ? 'preset-filled-error-500' : 'preset-outlined'}"
							onclick={() => priorityValue = ServicePriority.HIGH}
						>
							<span>High</span>
						</button>
						<button
							type="button"
							class="chip w-full justify-center {priorityValue === ServicePriority.URGENT ? 'preset-filled-tertiary-500' : 'preset-outlined'}"
							onclick={() => priorityValue = ServicePriority.URGENT}
						>
							<span>Urgent</span>
						</button>
					</div>
				</div>
				
				<!-- Hidden inputs for form submission -->
				<input type="hidden" name="title" value={titleValue} />
				<input type="hidden" name="description" value={descriptionValue} />
				<input type="hidden" name="category" value={categoryValue} />
				<input type="hidden" name="property_id" value={propertyValue} />
				<input type="hidden" name="priority" value={priorityValue} />
				
				<!-- Submit Button -->
				<div class="flex justify-end gap-2 mt-6">
					<button type="button" class="btn variant-soft" onclick={onClose}>
						Cancel
					</button>
					<button type="submit" class="btn variant-filled-primary">
						Create Request
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
