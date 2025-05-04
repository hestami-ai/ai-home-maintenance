<script lang="ts">
	import { createDialog } from '@melt-ui/svelte';
	import { fade } from 'svelte/transition';
	import { X, Home, Upload, Loader } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	
	// Props using Svelte 5 runes syntax
	const { isOpen, onClose, onAdd } = $props<{
		isOpen: boolean;
		onClose: () => void;
		onAdd: (property: {
			title: string;
			description: string;
			address: string;
			city: string;
			state: string;
			zip_code: string;
			country: string;
			descriptives: {
				type: string;
				created_from: string;
			}
		}) => void;
	}>();
	
	// Property types
	const propertyTypes = [
		'Single Family Home',
		'Townhouse',
		'Condominium',
		'Apartment',
		'Multi-Family Home',
		'Mobile Home',
		'Vacation Home',
		'Other'
	];
	
	// Countries
	const countries = [
		'United States',
		'Canada',
		'Mexico',
		'Other'
	];
	
	// Form state
	let titleValue = $state('');
	let descriptionValue = $state('');
	let addressValue = $state('');
	let cityValue = $state('');
	let stateValue = $state('');
	let zipCodeValue = $state('');
	let countryValue = $state(countries[0]);
	let typeValue = $state(propertyTypes[0]);
	let imageUrl = $state('https://images.unsplash.com/photo-1568605114967-8130f3a36994?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80');
	
	// Form validation
	let errors = $state({
		title: '',
		address: '',
		city: '',
		state: '',
		zip_code: '',
		country: '',
		api: ''
	});
	
	// Loading state
	let isSubmitting = $state(false);
	
	// Function to update property data in the hidden input field
	function updatePropertyData() {
		const propertyData = {
			title: titleValue,
			description: descriptionValue,
			address: addressValue,
			city: cityValue,
			state: stateValue,
			zip_code: zipCodeValue,
			country: countryValue,
			descriptives: { 
				type: typeValue,
				created_from: 'web_ui'
			}
		};
		
		// Update the hidden input with the serialized property data
		const inputElement = document.getElementById('propertyDataInput') as HTMLInputElement;
		if (inputElement) {
			inputElement.value = JSON.stringify(propertyData);
		}
	}
	
	// Initialize property data when component mounts
	onMount(() => {
		updatePropertyData();
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
	function handleValidation() {
		// Reset errors
		errors = {
			title: '',
			address: '',
			city: '',
			state: '',
			zip_code: '',
			country: '',
			api: ''
		};
		
		let isValid = true;
		
		if (!titleValue.trim()) {
			errors.title = 'Title is required';
			isValid = false;
		}
		
		if (!addressValue.trim()) {
			errors.address = 'Address is required';
			isValid = false;
		}
		
		if (!cityValue.trim()) {
			errors.city = 'City is required';
			isValid = false;
		}
		
		if (!stateValue.trim()) {
			errors.state = 'State is required';
			isValid = false;
		}
		
		if (!zipCodeValue.trim()) {
			errors.zip_code = 'ZIP code is required';
			isValid = false;
		}
		
		if (!countryValue.trim()) {
			errors.country = 'Country is required';
			isValid = false;
		}
		
		return isValid;
	}
	
	// Mock image upload
	function handleImageUpload() {
		// In a real app, this would open a file picker and upload the image
		// For now, we'll just cycle through some sample images
		const sampleImages = [
			'https://images.unsplash.com/photo-1568605114967-8130f3a36994?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80',
			'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80',
			'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80',
			'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80',
			'https://images.unsplash.com/photo-1592595896551-12b371d546d5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80'
		];
		
		const currentIndex = sampleImages.indexOf(imageUrl);
		const nextIndex = (currentIndex + 1) % sampleImages.length;
		imageUrl = sampleImages[nextIndex];
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
					<h2 use:title class="h3 font-semibold">Add New Property</h2>
					<p use:description class="text-surface-600-300-token">
						Enter the details of your property below.
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
			
			<!-- Property Image Preview -->
			<div class="mb-6">
				<label class="label mb-2" for="property-image-preview">
					<span>Property Image</span>
				</label>
				<div class="relative rounded-lg overflow-hidden bg-surface-200-700-token">
					<img
						id="property-image-preview"
						src={imageUrl}
						alt="Property preview"
						class="w-full h-48 object-cover"
					/>
					<button
						class="absolute bottom-2 right-2 btn variant-filled-primary"
						onclick={handleImageUpload}
					>
						<Upload class="h-4 w-4 mr-1" />
						Change Image
					</button>
				</div>
			</div>
			
			<!-- Property Form -->
			<form 
				method="POST" 
				action="?/createProperty"
				class="space-y-4"
				use:enhance={({ cancel }) => {
					// Pre-submission logic
					isSubmitting = true;
					
					// Validate form before submission
					const isValid = handleValidation();
					if (!isValid) {
						isSubmitting = false;
						cancel();
					}
					
					// Make sure property data is updated before submission
					updatePropertyData();
					
					// Define the expected result data type
					return async ({ result }) => {
						isSubmitting = false;
						
						if (result.type === 'success') {
							// Invalidate the properties data to refresh the list
							// Use the specific invalidation key that matches the server-side depends() call
							await invalidate('properties');
							
							// Reset form
							titleValue = '';
							descriptionValue = '';
							addressValue = '';
							cityValue = '';
							stateValue = '';
							zipCodeValue = '';
							countryValue = countries[0];
							typeValue = propertyTypes[0];
							
							// Close dialog
							onClose();
							
							// Call onAdd to notify parent of success if needed
							if (result.data?.property) {
								onAdd(result.data.property);
							}
						} else if (result.type === 'failure') {
							// Show error message
							const errorMessage = result.data && typeof result.data === 'object' && 'message' in result.data 
								? String(result.data.message) 
								: 'Failed to create property';
							errors.api = errorMessage;
						} else {
							errors.api = 'An unexpected error occurred';
						}
					};
				}}
			>
				<!-- Hidden input for property data - this will be populated by updatePropertyData() -->
				<input type="hidden" id="propertyDataInput" name="propertyData" value="" />
				<!-- Title -->
				<div class="form-field {errors.title ? 'input-error' : ''}">
					<label class="label" for="title">
						<span>Property Title</span>
					</label>
					<input
						id="title"
						class="input"
						type="text"
						bind:value={titleValue}
						oninput={updatePropertyData}
						placeholder="My Beautiful Home"
					/>
					{#if errors.title}
						<p class="text-error-500 text-sm mt-1">{errors.title}</p>
					{/if}
				</div>
				
				<!-- Description -->
				<div class="form-field">
					<label class="label" for="description">
						<span>Description (Optional)</span>
					</label>
					<textarea
						id="description"
						class="textarea"
						bind:value={descriptionValue}
						oninput={updatePropertyData}
						placeholder="A brief description of your property"
						rows="3"
					></textarea>
				</div>
				
				<!-- Address -->
				<div class="form-field {errors.address ? 'input-error' : ''}">
					<label class="label" for="address">
						<span>Street Address</span>
					</label>
					<input
						id="address"
						class="input"
						type="text"
						bind:value={addressValue}
						oninput={updatePropertyData}
						placeholder="123 Main Street"
					/>
					{#if errors.address}
						<p class="text-error-500 text-sm mt-1">{errors.address}</p>
					{/if}
				</div>
				
				<!-- City, State, ZIP -->
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<!-- City -->
					<div class="form-field {errors.city ? 'input-error' : ''}">
						<label class="label" for="city">
							<span>City</span>
						</label>
						<input
							id="city"
							class="input"
							type="text"
							bind:value={cityValue}
							oninput={updatePropertyData}
							placeholder="Boston"
						/>
						{#if errors.city}
							<p class="text-error-500 text-sm mt-1">{errors.city}</p>
						{/if}
					</div>
					
					<!-- State -->
					<div class="form-field {errors.state ? 'input-error' : ''}">
						<label class="label" for="state">
							<span>State</span>
						</label>
						<input
							id="state"
							class="input"
							type="text"
							bind:value={stateValue}
							oninput={updatePropertyData}
							placeholder="MA"
						/>
						{#if errors.state}
							<p class="text-error-500 text-sm mt-1">{errors.state}</p>
						{/if}
					</div>
					
					<!-- ZIP Code -->
					<div class="form-field {errors.zip_code ? 'input-error' : ''}">
						<label class="label" for="zip_code">
							<span>ZIP Code</span>
						</label>
						<input
							id="zipCode"
							class="input"
							type="text"
							bind:value={zipCodeValue}
							oninput={updatePropertyData}
							placeholder="02108"
						/>
						{#if errors.zip_code}
							<p class="text-error-500 text-sm mt-1">{errors.zip_code}</p>
						{/if}
					</div>
				</div>
				
				<!-- Country -->
				<div class="form-field {errors.country ? 'input-error' : ''}">
					<label class="label" for="country">
						<span>Country</span>
					</label>
					<select id="country" class="select" bind:value={countryValue} onchange={updatePropertyData}>
						{#each countries as country}
							<option value={country}>{country}</option>
						{/each}
					</select>
					{#if errors.country}
						<p class="text-error-500 text-sm mt-1">{errors.country}</p>
					{/if}
				</div>
				
				<!-- Property Type -->
				<div class="form-field">
					<label class="label" for="type">
						<span>Property Type</span>
					</label>
					<select id="type" class="select" bind:value={typeValue} onchange={updatePropertyData}>
						{#each propertyTypes as propertyType}
							<option value={propertyType}>{propertyType}</option>
						{/each}
					</select>
				</div>
				
				<!-- API Error Message -->
				{#if errors.api}
					<div class="alert variant-filled-error p-3 mt-4">
						<p>{errors.api}</p>
					</div>
				{/if}
				
				<!-- Form Actions -->
				<div class="flex justify-end gap-2 mt-6">
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
						class="btn variant-filled-primary"
						disabled={isSubmitting}
					>
						{#if isSubmitting}
							<Loader class="h-5 w-5 mr-2 animate-spin" />
							Saving...
						{:else}
							<Home class="h-5 w-5 mr-2" />
							Add Property
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
