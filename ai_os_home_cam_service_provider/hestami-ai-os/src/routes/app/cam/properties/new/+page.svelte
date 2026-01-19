<script lang="ts">
	import { goto } from '$app/navigation';
	import { ArrowLeft, Save, Plus, X } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';
	import { AssetStatusValues, PropertyTypeValues, StaffStatusValues, propertyApi } from '$lib/api/cam';

	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	let formData = $state({
		name: '',
		address: '',
		propertyType: 'CONDO',
		status: StaffStatusValues.ACTIVE,
		yearBuilt: '',
		totalSquareFootage: '',
		parkingSpaces: '',
		amenities: [] as string[],
		notes: ''
	});

	let newAmenity = $state('');

	const propertyTypeOptions = [
		{ value: PropertyTypeValues.SINGLE_FAMILY, label: 'Single Family' },
		{ value: 'TOWNHOME', label: 'Townhome' },
		{ value: 'CONDO', label: 'Condominium' },
		{ value: 'APARTMENT', label: 'Apartment' },
		{ value: PropertyTypeValues.COMMERCIAL, label: 'Commercial' },
		{ value: PropertyTypeValues.MIXED_USE, label: 'Mixed Use' }
	];

	const statusOptions = [
		{ value: StaffStatusValues.ACTIVE, label: 'Active' },
		{ value: AssetStatusValues.INACTIVE, label: 'Inactive' },
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

	function addAmenity() {
		if (newAmenity && !formData.amenities.includes(newAmenity)) {
			formData.amenities = [...formData.amenities, newAmenity];
			newAmenity = '';
		}
	}

	function removeAmenity(amenity: string) {
		formData.amenities = formData.amenities.filter(a => a !== amenity);
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!$currentAssociation?.id) {
			error = 'No association selected';
			return;
		}

		if (!formData.name || !formData.address) {
			error = 'Please fill in all required fields';
			return;
		}

		isSubmitting = true;
		error = null;

		try {
			const response = await propertyApi.create({
				associationId: $currentAssociation!.id,
				name: formData.name,
				addressLine1: formData.address,
				city: '',
				state: '',
				postalCode: '',
				propertyType: formData.propertyType as any,
				yearBuilt: formData.yearBuilt ? parseInt(formData.yearBuilt) : undefined,
				totalAcres: formData.totalSquareFootage ? parseInt(formData.totalSquareFootage) / 43560 : undefined
			} as any);

			if (!response.ok) {
				error = 'Failed to create property';
				return;
			}
			goto(`/app/cam/properties/${response.data.property.id}`);
		} catch (e) {
			error = 'Failed to create property';
			console.error(e);
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Add Property | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto('/app/cam/properties')}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>
			<div class="flex-1">
				<h1 class="text-xl font-semibold">Add Property</h1>
				<p class="mt-0.5 text-sm text-surface-500">
					{$currentAssociation?.name || 'Select an association'}
				</p>
			</div>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-6">
		<div class="mx-auto max-w-2xl">
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
								placeholder="e.g., Sunset Towers, Oak Grove Condos"
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
								placeholder="Full property address"
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

				<Card variant="outlined" padding="lg">
					<h3 class="mb-4 font-semibold">Additional Notes</h3>
					<textarea
						id="notes"
						bind:value={formData.notes}
						rows={3}
						placeholder="Any additional notes about this property..."
						class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					></textarea>
				</Card>

				<div class="flex justify-end gap-3">
					<button
						type="button"
						onclick={() => goto('/app/cam/properties')}
						class="btn preset-tonal-surface"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class="btn preset-filled-primary-500"
					>
						{#if isSubmitting}
							<span class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
						{:else}
							<Save class="mr-2 h-4 w-4" />
						{/if}
						Add Property
					</button>
				</div>
			</form>
		</div>
	</div>
</div>
