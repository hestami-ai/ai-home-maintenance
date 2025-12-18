<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Save, Plus, X } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';

	interface Property {
		id: string;
		name: string;
		address: string;
		propertyType: string;
		status: string;
		yearBuilt?: number;
		totalSquareFootage?: number;
		parkingSpaces?: number;
		amenities?: string[];
	}

	let property = $state<Property | null>(null);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let error = $state<string | null>(null);

	let formData = $state({
		name: '',
		address: '',
		propertyType: 'CONDO',
		status: 'ACTIVE',
		yearBuilt: '',
		totalSquareFootage: '',
		parkingSpaces: '',
		amenities: [] as string[]
	});

	let newAmenity = $state('');

	const propertyTypeOptions = [
		{ value: 'SINGLE_FAMILY', label: 'Single Family' },
		{ value: 'TOWNHOME', label: 'Townhome' },
		{ value: 'CONDO', label: 'Condominium' },
		{ value: 'APARTMENT', label: 'Apartment' },
		{ value: 'COMMERCIAL', label: 'Commercial' },
		{ value: 'MIXED_USE', label: 'Mixed Use' }
	];

	const statusOptions = [
		{ value: 'ACTIVE', label: 'Active' },
		{ value: 'INACTIVE', label: 'Inactive' },
		{ value: 'UNDER_CONSTRUCTION', label: 'Under Construction' }
	];

	const commonAmenities = [
		'Pool',
		'Gym',
		'Clubhouse',
		'Tennis Court',
		'Playground',
		'Dog Park',
		'Business Center',
		'Parking Garage',
		'Gated Entry',
		'Concierge'
	];

	const propertyId = $derived(($page.params as Record<string, string>).id);

	function addAmenity() {
		if (newAmenity && !formData.amenities.includes(newAmenity)) {
			formData.amenities = [...formData.amenities, newAmenity];
			newAmenity = '';
		}
	}

	function removeAmenity(amenity: string) {
		formData.amenities = formData.amenities.filter(a => a !== amenity);
	}

	async function loadData() {
		if (!propertyId) return;

		isLoading = true;
		error = null;

		try {
			const response = await fetch(`/api/property/${propertyId}`);
			if (response.ok) {
				const data = await response.json();
				if (data.ok && data.data) {
					property = data.data;
					formData = {
						name: data.data.name || '',
						address: data.data.address || '',
						propertyType: data.data.propertyType || 'CONDO',
						status: data.data.status || 'ACTIVE',
						yearBuilt: data.data.yearBuilt?.toString() || '',
						totalSquareFootage: data.data.totalSquareFootage?.toString() || '',
						parkingSpaces: data.data.parkingSpaces?.toString() || '',
						amenities: data.data.amenities || []
					};
				} else {
					error = 'Property not found';
				}
			} else {
				error = 'Failed to load property';
			}
		} catch (e) {
			error = 'Failed to load data';
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!property) return;

		if (!formData.name || !formData.address) {
			error = 'Please fill in all required fields';
			return;
		}

		isSaving = true;
		error = null;

		try {
			const response = await fetch(`/api/property/${property.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: formData.name,
					address: formData.address,
					propertyType: formData.propertyType,
					status: formData.status,
					yearBuilt: formData.yearBuilt ? parseInt(formData.yearBuilt) : undefined,
					totalSquareFootage: formData.totalSquareFootage ? parseInt(formData.totalSquareFootage) : undefined,
					parkingSpaces: formData.parkingSpaces ? parseInt(formData.parkingSpaces) : undefined,
					amenities: formData.amenities.length > 0 ? formData.amenities : undefined
				})
			});

			if (response.ok) {
				goto(`/app/cam/properties/${property.id}`);
			} else {
				const data = await response.json();
				error = data.error?.message || 'Failed to update property';
			}
		} catch (e) {
			error = 'Failed to update property';
			console.error(e);
		} finally {
			isSaving = false;
		}
	}

	$effect(() => {
		if (propertyId) {
			loadData();
		}
	});
</script>

<svelte:head>
	<title>Edit Property | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto(`/app/cam/properties/${propertyId}`)}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>
			<div class="flex-1">
				<h1 class="text-xl font-semibold">Edit Property</h1>
				{#if property}
					<p class="mt-0.5 text-sm text-surface-500">{property.name}</p>
				{/if}
			</div>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-6">
		<div class="mx-auto max-w-2xl">
			{#if isLoading}
				<div class="flex h-64 items-center justify-center">
					<div class="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
				</div>
			{:else if error && !property}
				<div class="rounded-lg bg-error-500/10 p-4 text-error-500">
					{error}
				</div>
			{:else}
				<form onsubmit={handleSubmit} class="space-y-6">
					{#if error}
						<div class="rounded-lg bg-error-500/10 p-4 text-error-500">
							{error}
						</div>
					{/if}

					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 font-semibold">Basic Information</h3>
						<div class="space-y-4">
							<div>
								<label for="name" class="mb-1 block text-sm font-medium">
									Property Name <span class="text-error-500">*</span>
								</label>
								<input
									id="name"
									type="text"
									bind:value={formData.name}
									required
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								/>
							</div>

							<div>
								<label for="address" class="mb-1 block text-sm font-medium">
									Address <span class="text-error-500">*</span>
								</label>
								<textarea
									id="address"
									bind:value={formData.address}
									required
									rows={2}
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								></textarea>
							</div>

							<div class="grid gap-4 sm:grid-cols-2">
								<div>
									<label for="propertyType" class="mb-1 block text-sm font-medium">
										Property Type
									</label>
									<select
										id="propertyType"
										bind:value={formData.propertyType}
										class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
									>
										{#each propertyTypeOptions as option}
											<option value={option.value}>{option.label}</option>
										{/each}
									</select>
								</div>

								<div>
									<label for="status" class="mb-1 block text-sm font-medium">
										Status
									</label>
									<select
										id="status"
										bind:value={formData.status}
										class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
									>
										{#each statusOptions as option}
											<option value={option.value}>{option.label}</option>
										{/each}
									</select>
								</div>
							</div>
						</div>
					</Card>

					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 font-semibold">Property Details</h3>
						<div class="grid gap-4 sm:grid-cols-3">
							<div>
								<label for="yearBuilt" class="mb-1 block text-sm font-medium">
									Year Built
								</label>
								<input
									id="yearBuilt"
									type="number"
									min="1800"
									max="2100"
									bind:value={formData.yearBuilt}
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								/>
							</div>

							<div>
								<label for="totalSquareFootage" class="mb-1 block text-sm font-medium">
									Total Sq Ft
								</label>
								<input
									id="totalSquareFootage"
									type="number"
									min="0"
									bind:value={formData.totalSquareFootage}
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								/>
							</div>

							<div>
								<label for="parkingSpaces" class="mb-1 block text-sm font-medium">
									Parking Spaces
								</label>
								<input
									id="parkingSpaces"
									type="number"
									min="0"
									bind:value={formData.parkingSpaces}
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								/>
							</div>
						</div>
					</Card>

					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 font-semibold">Amenities</h3>
						<div class="space-y-4">
							<div class="flex gap-2">
								<select
									bind:value={newAmenity}
									class="flex-1 rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								>
									<option value="">Select an amenity</option>
									{#each commonAmenities.filter(a => !formData.amenities.includes(a)) as amenity}
										<option value={amenity}>{amenity}</option>
									{/each}
								</select>
								<button
									type="button"
									onclick={addAmenity}
									disabled={!newAmenity}
									class="btn preset-filled-primary-500"
								>
									<Plus class="h-4 w-4" />
								</button>
							</div>

							{#if formData.amenities.length > 0}
								<div class="flex flex-wrap gap-2">
									{#each formData.amenities as amenity}
										<span class="inline-flex items-center gap-1 rounded-full bg-primary-500/10 px-3 py-1 text-sm text-primary-500">
											{amenity}
											<button
												type="button"
												onclick={() => removeAmenity(amenity)}
												class="ml-1 rounded-full p-0.5 hover:bg-primary-500/20"
											>
												<X class="h-3 w-3" />
											</button>
										</span>
									{/each}
								</div>
							{:else}
								<p class="text-sm text-surface-500">No amenities selected</p>
							{/if}
						</div>
					</Card>

					<div class="flex justify-end gap-3">
						<button
							type="button"
							onclick={() => goto(`/app/cam/properties/${propertyId}`)}
							class="btn preset-tonal-surface"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isSaving}
							class="btn preset-filled-primary-500"
						>
							{#if isSaving}
								<span class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
							{:else}
								<Save class="mr-2 h-4 w-4" />
							{/if}
							Save Changes
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
</div>
