<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { ArrowLeft, Save } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';
	import { unitApi, propertyApi } from '$lib/api/cam';

	interface Property {
		id: string;
		name: string;
	}

	let properties = $state<Property[]>([]);
	let isLoadingData = $state(true);
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	const preselectedPropertyId = $derived($page.url.searchParams.get('propertyId') || '');

	let formData = $state({
		propertyId: '',
		unitNumber: '',
		unitType: 'RESIDENTIAL',
		status: 'VACANT',
		address: '',
		squareFootage: '',
		bedrooms: '',
		bathrooms: '',
		floor: '',
		notes: ''
	});

	const unitTypeOptions = [
		{ value: 'RESIDENTIAL', label: 'Residential' },
		{ value: 'COMMERCIAL', label: 'Commercial' },
		{ value: 'MIXED_USE', label: 'Mixed Use' }
	];

	const statusOptions = [
		{ value: 'VACANT', label: 'Vacant' },
		{ value: 'OCCUPIED', label: 'Occupied' },
		{ value: 'UNDER_RENOVATION', label: 'Under Renovation' }
	];

	async function loadFormData() {
		if (!$currentAssociation?.id) return;

		isLoadingData = true;
		try {
			const response = await propertyApi.list({});
			if (response.ok && response.data?.properties) {
				properties = response.data.properties;
			}

			if (preselectedPropertyId) {
				formData.propertyId = preselectedPropertyId;
			}
		} catch (e) {
			console.error('Failed to load properties:', e);
		} finally {
			isLoadingData = false;
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!formData.propertyId || !formData.unitNumber) {
			error = 'Please fill in all required fields';
			return;
		}

		isSubmitting = true;
		error = null;

		try {
			const response = await unitApi.create({
				propertyId: formData.propertyId,
				unitNumber: formData.unitNumber,
				unitType: formData.unitType,
				status: formData.status,
				address: formData.address || undefined,
				squareFootage: formData.squareFootage ? parseInt(formData.squareFootage) : undefined,
				bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : undefined,
				bathrooms: formData.bathrooms ? parseFloat(formData.bathrooms) : undefined,
				floor: formData.floor ? parseInt(formData.floor) : undefined,
				idempotencyKey: crypto.randomUUID()
			});

			if (response.ok && response.data?.unit) {
				goto(`/app/cam/units/${response.data.unit.id}`);
			} else {
				error = response.error?.message || 'Failed to create unit';
			}
		} catch (e) {
			error = 'Failed to create unit';
			console.error(e);
		} finally {
			isSubmitting = false;
		}
	}

	$effect(() => {
		if ($currentAssociation?.id) {
			loadFormData();
		}
	});
</script>

<svelte:head>
	<title>Add Unit | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto('/app/cam/units')}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>
			<div class="flex-1">
				<h1 class="text-xl font-semibold">Add Unit</h1>
				<p class="mt-0.5 text-sm text-surface-500">
					{$currentAssociation?.name || 'Select an association'}
				</p>
			</div>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-6">
		<div class="mx-auto max-w-2xl">
			{#if isLoadingData}
				<div class="flex h-64 items-center justify-center">
					<div class="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
				</div>
			{:else}
				<form onsubmit={handleSubmit} class="space-y-6">
					{#if error}
						<div class="rounded-lg bg-error-500/10 p-4 text-error-500">
							{error}
						</div>
					{/if}

					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 font-semibold">Property & Unit</h3>
						<div class="space-y-4">
							<div>
								<label for="propertyId" class="mb-1 block text-sm font-medium">
									Property <span class="text-error-500">*</span>
								</label>
								<select
									id="propertyId"
									bind:value={formData.propertyId}
									required
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								>
									<option value="">Select a property</option>
									{#each properties as property}
										<option value={property.id}>{property.name}</option>
									{/each}
								</select>
							</div>

							<div class="grid gap-4 sm:grid-cols-2">
								<div>
									<label for="unitNumber" class="mb-1 block text-sm font-medium">
										Unit Number <span class="text-error-500">*</span>
									</label>
									<input
										id="unitNumber"
										type="text"
										bind:value={formData.unitNumber}
										required
										placeholder="e.g., 101, A-1, Suite 200"
										class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
									/>
								</div>

								<div>
									<label for="floor" class="mb-1 block text-sm font-medium">
										Floor
									</label>
									<input
										id="floor"
										type="number"
										min="0"
										bind:value={formData.floor}
										class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
									/>
								</div>
							</div>

							<div class="grid gap-4 sm:grid-cols-2">
								<div>
									<label for="unitType" class="mb-1 block text-sm font-medium">
										Unit Type
									</label>
									<select
										id="unitType"
										bind:value={formData.unitType}
										class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
									>
										{#each unitTypeOptions as option}
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
						<h3 class="mb-4 font-semibold">Unit Details</h3>
						<div class="space-y-4">
							<div>
								<label for="address" class="mb-1 block text-sm font-medium">
									Address (if different from property)
								</label>
								<input
									id="address"
									type="text"
									bind:value={formData.address}
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								/>
							</div>

							<div class="grid gap-4 sm:grid-cols-3">
								<div>
									<label for="squareFootage" class="mb-1 block text-sm font-medium">
										Square Footage
									</label>
									<input
										id="squareFootage"
										type="number"
										min="0"
										bind:value={formData.squareFootage}
										class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
									/>
								</div>

								<div>
									<label for="bedrooms" class="mb-1 block text-sm font-medium">
										Bedrooms
									</label>
									<input
										id="bedrooms"
										type="number"
										min="0"
										bind:value={formData.bedrooms}
										class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
									/>
								</div>

								<div>
									<label for="bathrooms" class="mb-1 block text-sm font-medium">
										Bathrooms
									</label>
									<input
										id="bathrooms"
										type="number"
										min="0"
										step="0.5"
										bind:value={formData.bathrooms}
										class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
									/>
								</div>
							</div>
						</div>
					</Card>

					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 font-semibold">Additional Notes</h3>
						<textarea
							id="notes"
							bind:value={formData.notes}
							rows={3}
							placeholder="Any additional notes about this unit..."
							class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						></textarea>
					</Card>

					<div class="flex justify-end gap-3">
						<button
							type="button"
							onclick={() => goto('/app/cam/units')}
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
							Add Unit
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
</div>
