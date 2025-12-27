<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Save } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { unitApi, type Unit } from '$lib/api/cam';

	let unit = $state<Unit | null>(null);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let error = $state<string | null>(null);

	let formData = $state({
		unitNumber: '',
		unitType: 'RESIDENTIAL',
		status: 'OCCUPIED',
		address: '',
		squareFootage: '',
		bedrooms: '',
		bathrooms: ''
	});

	const unitTypeOptions = [
		{ value: 'RESIDENTIAL', label: 'Residential' },
		{ value: 'COMMERCIAL', label: 'Commercial' },
		{ value: 'MIXED_USE', label: 'Mixed Use' }
	];

	const statusOptions = [
		{ value: 'OCCUPIED', label: 'Occupied' },
		{ value: 'VACANT', label: 'Vacant' },
		{ value: 'UNDER_RENOVATION', label: 'Under Renovation' }
	];

	const unitId = $derived(($page.params as Record<string, string>).id);

	async function loadData() {
		if (!unitId) return;

		isLoading = true;
		error = null;

		try {
			const response = await unitApi.get(unitId);
			if (!response.ok) {
				error = 'Unit not found';
				return;
			}
			const u = response.data.unit as any;
			unit = u;
			formData = {
				unitNumber: u.unitNumber || '',
				unitType: u.unitType || 'RESIDENTIAL',
				status: u.status || 'OCCUPIED',
				address: u.addressLine1 || '',
				squareFootage: u.squareFeet?.toString() || '',
				bedrooms: u.bedrooms?.toString() || '',
				bathrooms: u.bathrooms?.toString() || ''
			};
		} catch (e) {
			error = 'Failed to load data';
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!unit) return;

		if (!formData.unitNumber) {
			error = 'Please fill in all required fields';
			return;
		}

		isSaving = true;
		error = null;

		try {
			const response = await unitApi.update(unit.id, {
				unitNumber: formData.unitNumber,
				unitType: formData.unitType as any,
				addressLine1: formData.address || undefined,
				squareFeet: formData.squareFootage ? parseInt(formData.squareFootage) : undefined,
				bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : undefined,
				bathrooms: formData.bathrooms ? parseFloat(formData.bathrooms) : undefined
			});

			if (!response.ok) {
				error = 'Failed to update unit';
				return;
			}
			goto(`/app/cam/units/${unit.id}`);
		} catch (e) {
			error = 'Failed to update unit';
			console.error(e);
		} finally {
			isSaving = false;
		}
	}

	$effect(() => {
		if (unitId) {
			loadData();
		}
	});
</script>

<svelte:head>
	<title>Edit Unit | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto(`/app/cam/units/${unitId}`)}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>
			<div class="flex-1">
				<h1 class="text-xl font-semibold">Edit Unit</h1>
				{#if unit}
					<p class="mt-0.5 text-sm text-surface-500">Unit {unit.unitNumber}</p>
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
			{:else if error && !unit}
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
						<h3 class="mb-4 font-semibold">Unit Information</h3>
						<div class="space-y-4">
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
										class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
									/>
								</div>

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

							<div>
								<label for="address" class="mb-1 block text-sm font-medium">
									Address
								</label>
								<input
									id="address"
									type="text"
									bind:value={formData.address}
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								/>
							</div>
						</div>
					</Card>

					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 font-semibold">Unit Details</h3>
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
					</Card>

					<div class="flex justify-end gap-3">
						<button
							type="button"
							onclick={() => goto(`/app/cam/units/${unitId}`)}
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
