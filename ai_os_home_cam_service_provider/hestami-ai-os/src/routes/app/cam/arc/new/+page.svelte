<script lang="ts">
	import { goto } from '$app/navigation';
	import { ArrowLeft, ClipboardCheck, Upload } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';
	import { ARCCategoryValues, AssetCategoryValues, arcRequestApi, type Unit, unitApi } from '$lib/api/cam';

	let units = $state<Unit[]>([]);
	let isLoadingData = $state(true);
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	let formData = $state({
		unitId: '',
		title: '',
		description: '',
		category: 'EXTERIOR_MODIFICATION',
		projectScope: '',
		estimatedCost: '',
		startDate: '',
		completionDate: ''
	});

	const categoryOptions = [
		{ value: 'EXTERIOR_MODIFICATION', label: 'Exterior Modification' },
		{ value: ARCCategoryValues.LANDSCAPING, label: 'Landscaping' },
		{ value: 'FENCE_WALL', label: 'Fence / Wall' },
		{ value: ARCCategoryValues.ROOF, label: 'Roof' },
		{ value: 'PAINT_COLOR', label: 'Paint / Color Change' },
		{ value: 'WINDOW_DOOR', label: 'Window / Door' },
		{ value: ARCCategoryValues.SOLAR, label: 'Solar Installation' },
		{ value: AssetCategoryValues.POOL_SPA, label: 'Pool / Spa' },
		{ value: 'PATIO_DECK', label: 'Patio / Deck' },
		{ value: ARCCategoryValues.OTHER, label: 'Other' }
	];

	async function loadFormData() {
		if (!$currentAssociation?.id) return;

		isLoadingData = true;
		try {
			const response = await unitApi.list({});
			if (response.ok) {
				units = response.data.units;
			}
		} catch (e) {
			console.error('Failed to load units:', e);
		} finally {
			isLoadingData = false;
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!$currentAssociation?.id) {
			error = 'No association selected';
			return;
		}

		if (!formData.unitId || !formData.title) {
			error = 'Please fill in all required fields';
			return;
		}

		isSubmitting = true;
		error = null;

		try {
			const response = await arcRequestApi.create({
				associationId: $currentAssociation.id,
				requesterPartyId: '', // TODO: Get from current user context
				title: formData.title,
				description: formData.description || '',
				category: formData.category as any,
				estimatedCost: formData.estimatedCost ? parseFloat(formData.estimatedCost) : undefined,
				proposedStartDate: formData.startDate || undefined,
				proposedEndDate: formData.completionDate || undefined,
				idempotencyKey: crypto.randomUUID()
			} as any);

			if (!response.ok) {
				error = 'Failed to submit ARC request';
				return;
			}
			goto(`/app/cam/arc/${response.data.request.id}`);
		} catch (e) {
			error = 'Failed to submit ARC request';
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
	<title>Submit ARC Request | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto('/app/cam/arc')}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>
			<div class="flex-1">
				<h1 class="text-xl font-semibold">Submit ARC Request</h1>
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
						<h3 class="mb-4 font-semibold">Property Information</h3>
						<div>
							<label for="unitId" class="mb-1 block text-sm font-medium">
								Unit <span class="text-error-500">*</span>
							</label>
							<select
								id="unitId"
								bind:value={formData.unitId}
								required
								class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							>
								<option value="">Select your unit</option>
								{#each units as unit}
									<option value={unit.id}>
										Unit {unit.unitNumber} - {unit.propertyName}
									</option>
								{/each}
							</select>
						</div>
					</Card>

					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 font-semibold">Request Details</h3>
						<div class="space-y-4">
							<div>
								<label for="category" class="mb-1 block text-sm font-medium">
									Category <span class="text-error-500">*</span>
								</label>
								<select
									id="category"
									bind:value={formData.category}
									required
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								>
									{#each categoryOptions as option}
										<option value={option.value}>{option.label}</option>
									{/each}
								</select>
							</div>

							<div>
								<label for="title" class="mb-1 block text-sm font-medium">
									Title <span class="text-error-500">*</span>
								</label>
								<input
									id="title"
									type="text"
									bind:value={formData.title}
									required
									placeholder="Brief description of the modification"
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								/>
							</div>

							<div>
								<label for="description" class="mb-1 block text-sm font-medium">
									Description
								</label>
								<textarea
									id="description"
									bind:value={formData.description}
									rows={3}
									placeholder="Detailed description of the proposed modification..."
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								></textarea>
							</div>

							<div>
								<label for="projectScope" class="mb-1 block text-sm font-medium">
									Project Scope
								</label>
								<textarea
									id="projectScope"
									bind:value={formData.projectScope}
									rows={3}
									placeholder="Materials, dimensions, colors, contractor information..."
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								></textarea>
							</div>
						</div>
					</Card>

					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 font-semibold">Project Timeline & Cost</h3>
						<div class="grid gap-4 sm:grid-cols-3">
							<div>
								<label for="estimatedCost" class="mb-1 block text-sm font-medium">
									Estimated Cost
								</label>
								<div class="relative">
									<span class="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500">$</span>
									<input
										id="estimatedCost"
										type="number"
										step="0.01"
										min="0"
										bind:value={formData.estimatedCost}
										placeholder="0.00"
										class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 py-2 pl-7 pr-3 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
									/>
								</div>
							</div>

							<div>
								<label for="startDate" class="mb-1 block text-sm font-medium">
									Planned Start Date
								</label>
								<input
									id="startDate"
									type="date"
									bind:value={formData.startDate}
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								/>
							</div>

							<div>
								<label for="completionDate" class="mb-1 block text-sm font-medium">
									Expected Completion
								</label>
								<input
									id="completionDate"
									type="date"
									bind:value={formData.completionDate}
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								/>
							</div>
						</div>
					</Card>

					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 font-semibold">Supporting Documents (Optional)</h3>
						<div class="rounded-lg border-2 border-dashed border-surface-300-700 p-8 text-center">
							<Upload class="mx-auto h-8 w-8 text-surface-400" />
							<p class="mt-2 text-sm text-surface-500">
								Upload plans, specs, photos, or color samples
							</p>
							<p class="mt-1 text-xs text-surface-400">
								You can add documents after submitting the request
							</p>
						</div>
					</Card>

					<div class="rounded-lg bg-warning-500/10 p-4">
						<p class="text-sm text-warning-700">
							<strong>Note:</strong> By submitting this request, you acknowledge that you will not begin work until you receive written approval from the Architectural Review Committee.
						</p>
					</div>

					<div class="flex justify-end gap-3">
						<button
							type="button"
							onclick={() => goto('/app/cam/arc')}
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
								<ClipboardCheck class="mr-2 h-4 w-4" />
							{/if}
							Submit Request
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
</div>
