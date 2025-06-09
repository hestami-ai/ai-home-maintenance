<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Upload } from 'lucide-svelte';
	import type { Property } from '$lib/types';
	import { ServiceCategory, ServicePriority } from '$lib/types';
	
	// Get data from server-side load function
	export let data: { properties: Property[]; error: string | null };
	
	// Form state
	let title = '';
	let description = '';
	let propertyId = '';
	let category = ServiceCategory.PLUMBING;
	let priority = ServicePriority.MEDIUM;
	let files: FileList | null = null;
	let isSubmitting = false;
	let successMessage = '';
	let errorMessage = '';
	
	// Initialize property selection if properties are available
	$: {
		if (data.properties && data.properties.length > 0 && !propertyId) {
			propertyId = data.properties[0].id;
		}
	}
	
	// Form validation
	let errors = {
		title: '',
		description: '',
		property: ''
	};
	
	function validateForm() {
		let isValid = true;
		
		// Reset errors
		errors = {
			title: '',
			description: '',
			property: ''
		};
		
		// Validate title
		if (!title.trim()) {
			errors.title = 'Title is required';
			isValid = false;
		}
		
		// Validate description
		if (!description.trim()) {
			errors.description = 'Description is required';
			isValid = false;
		}
		
		// Validate property
		if (!propertyId) {
			errors.property = 'Property is required';
			isValid = false;
		}
		
		return isValid;
	}
	
	// Category options with labels
	const categories = [
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
	
	// Priority options with labels and colors
	const priorities = [
		{ value: ServicePriority.LOW, label: 'Low', color: 'success' },
		{ value: ServicePriority.MEDIUM, label: 'Medium', color: 'warning' },
		{ value: ServicePriority.HIGH, label: 'High', color: 'error' },
		{ value: ServicePriority.URGENT, label: 'Urgent', color: 'tertiary' }
	];
</script>

<div class="container mx-auto p-4 space-y-6">
	<header class="flex items-center gap-2 mb-6">
		<a href="/requests" class="btn-icon variant-soft-surface">
			<ArrowLeft class="h-5 w-5" />
		</a>
		<div>
			<h1 class="h1">New Service Request</h1>
			<p class="text-surface-600-300-token">Create a new maintenance or service request</p>
		</div>
	</header>
	
	{#if data.error}
		<div class="alert variant-filled-error">
			<p>{data.error}</p>
		</div>
	{/if}
	
	{#if successMessage}
		<div class="alert variant-filled-success">
			<p>{successMessage}</p>
		</div>
	{/if}
	
	{#if errorMessage}
		<div class="alert variant-filled-error">
			<p>{errorMessage}</p>
		</div>
	{/if}
	
	<form 
		method="POST" 
		action="?/createServiceRequest"
		use:enhance={() => {
			// Validate form before submission
			if (!validateForm()) {
				return;
			}
			
			// Set submitting state
			isSubmitting = true;
			successMessage = '';
			errorMessage = '';
			
			return async ({ result }) => {
				// Reset submitting state
				isSubmitting = false;
				
				if (result.type === 'redirect') {
					// Let SvelteKit handle the redirect
					return;
				} else if (result.type === 'success') {
					// Show success message and redirect after a short delay
					interface SuccessData {
						message?: string;
						redirect?: string;
						requestId?: string;
					}
					
					const resultData = result.data as SuccessData || {};
					successMessage = resultData?.message || 'Service request created successfully';
					
					// Clear form
					title = '';
					description = '';
					files = null;
					
					// Redirect to the specified URL after a short delay
					if (resultData?.redirect) {
						const redirectUrl = resultData.redirect;
						setTimeout(() => {
							goto(redirectUrl);
						}, 1500);
					}
				} else if (result.type === 'failure') {
					// Show error message
					interface ErrorData {
						message?: string;
					}
					
					const resultData = result.data as ErrorData || {};
					console.error('Form submission failed:', resultData);
					errorMessage = resultData?.message || 'Failed to create service request';
				}
			};
		}}
		class="space-y-6"
	>
		<!-- Basic info section -->
		<section class="card p-4 space-y-4">
			<h2 class="h3">Request Information</h2>
			
			<!-- Title -->
			<div class="form-field {errors.title ? 'input-error' : ''}">
				<label class="label" for="request-title">
					<span>Title</span>
				</label>
				<input
					id="request-title"
					name="title"
					type="text"
					placeholder="Brief description of the issue"
					bind:value={title}
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
					name="description"
					placeholder="Detailed description of the issue"
					bind:value={description}
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
				<select id="request-category" name="category" bind:value={category} class="select">
					{#each categories as cat}
						<option value={cat.value}>{cat.label}</option>
					{/each}
				</select>
			</div>
			
			<!-- Property -->
			<div class="form-field {errors.property ? 'input-error' : ''}">
				<label class="label" for="request-property">
					<span>Property</span>
				</label>
				<select id="request-property" name="property_id" bind:value={propertyId} class="select">
					{#if data.properties.length === 0}
						<option value="">No properties available</option>
					{:else}
						{#each data.properties as property}
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
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-2" aria-labelledby="priority-group-label">
					<span id="priority-group-label" class="sr-only">Select priority level</span>
					{#each priorities as prio}
						<button
							type="button"
							class="chip w-full justify-center {priority === prio.value ? `preset-filled-${prio.color}-500` : 'preset-outlined'}"
							on:click={() => priority = prio.value}
							aria-pressed={priority === prio.value}
						>
							<span>{prio.label}</span>
						</button>
					{/each}
				</div>
				<input id="request-priority" type="hidden" name="priority" value={priority} />
			</div>
		</section>
		
		<!-- Media upload section -->
		<section class="card p-4 space-y-4">
			<h2 class="h3">Media Attachments</h2>
			<p class="text-surface-600-300-token">Add photos or videos of the issue (optional)</p>
			
			<div class="file-upload-container border-2 border-dashed border-surface-300-600-token rounded-lg p-6 text-center">
				<label for="file-upload" class="cursor-pointer flex flex-col items-center justify-center gap-2">
					<Upload class="h-8 w-8 text-surface-500-400-token" />
					<span class="text-surface-700-200-token">Click to upload or drag and drop</span>
					<span class="text-xs text-surface-500-400-token">PNG, JPG, MP4 up to 10MB</span>
				</label>
				<input 
					id="file-upload" 
					type="file" 
					accept="image/png, image/jpeg, video/mp4" 
					multiple 
					bind:files
					class="hidden"
				/>
			</div>
			
			<!-- File preview area -->
			{#if files && files.length > 0}
				<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
					{#each Array.from(files) as file, i}
						<div class="relative aspect-square bg-surface-200-700-token rounded-lg overflow-hidden">
							{#if file.type.startsWith('image/')}
								<img src={URL.createObjectURL(file)} alt="Preview" class="w-full h-full object-cover" />
							{:else if file.type.startsWith('video/')}
							<!-- Using a video poster approach instead of actual video for preview -->
							<div class="w-full h-full bg-black flex items-center justify-center">
								<span class="badge variant-filled-primary p-2">
									Video File
								</span>
							</div>
							<!-- File name as additional context -->
							<div class="absolute bottom-0 left-0 right-0 bg-black/60 p-1 truncate text-xs text-white">
								{file.name}
							</div>
							{/if}
							<button 
								type="button" 
								class="absolute top-1 right-1 btn-icon btn-icon-sm variant-filled-error"
								on:click={() => {
									if (files) {
										const newFiles = Array.from(files).filter((_, index) => index !== i);
										const dt = new DataTransfer();
										newFiles.forEach(f => dt.items.add(f));
										files = dt.files;
									}
								}}
							>
								&times;
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</section>
		
		<!-- Submit buttons -->
		<div class="flex justify-end gap-2">
			<a href="/requests" class="btn variant-soft">Cancel</a>
			<button type="submit" class="btn variant-filled-primary" disabled={isSubmitting}>
				{#if isSubmitting}
					<span class="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>
					Submitting...
				{:else}
					Create Request
				{/if}
			</button>
		</div>
	</form>
</div>
