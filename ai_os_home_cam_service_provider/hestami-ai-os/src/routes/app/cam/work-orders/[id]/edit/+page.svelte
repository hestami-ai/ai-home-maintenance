<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Save } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';
	import { ARCCategoryValues, AssetCategoryValues, DocumentCategoryValues, OwnerIntentPriorityValues, WorkOrderCategoryValues, WorkOrderPriorityValues, type Unit, type Vendor, type WorkOrder, unitApi, vendorApi, workOrderApi } from '$lib/api/cam';

	let workOrder = $state<WorkOrder | null>(null);
	let units = $state<Unit[]>([]);
	let vendors = $state<Vendor[]>([]);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let error = $state<string | null>(null);

	let formData = $state<{
		locationType: 'unit' | 'common_area';
		unitId: string;
		commonAreaDescription: string;
		title: string;
		description: string;
		category: string;
		priority: string;
		vendorId: string;
		dueDate: string;
	}>({
		locationType: 'unit',
		unitId: '',
		commonAreaDescription: '',
		title: '',
		description: '',
		category: DocumentCategoryValues.MAINTENANCE,
		priority: OwnerIntentPriorityValues.NORMAL,
		vendorId: '',
		dueDate: ''
	});

	const categoryOptions = [
		{ value: DocumentCategoryValues.MAINTENANCE, label: 'Maintenance' },
		{ value: WorkOrderCategoryValues.REPAIR, label: 'Repair' },
		{ value: ARCCategoryValues.LANDSCAPING, label: 'Landscaping' },
		{ value: WorkOrderCategoryValues.CLEANING, label: 'Cleaning' },
		{ value: AssetCategoryValues.ELECTRICAL, label: 'Electrical' },
		{ value: AssetCategoryValues.PLUMBING, label: 'Plumbing' },
		{ value: ARCCategoryValues.HVAC, label: ARCCategoryValues.HVAC },
		{ value: WorkOrderCategoryValues.OTHER, label: 'Other' }
	];

	const priorityOptions = [
		{ value: WorkOrderPriorityValues.EMERGENCY, label: 'Emergency' },
		{ value: OwnerIntentPriorityValues.URGENT, label: 'Urgent' },
		{ value: WorkOrderPriorityValues.HIGH, label: 'High' },
		{ value: OwnerIntentPriorityValues.NORMAL, label: 'Normal' },
		{ value: WorkOrderPriorityValues.LOW, label: 'Low' }
	];

	const workOrderId = $derived(($page.params as Record<string, string>).id);

	async function loadData() {
		if (!workOrderId || !$currentAssociation?.id) return;

		isLoading = true;
		error = null;

		try {
			const [workOrderRes, unitsRes, vendorsRes] = await Promise.all([
				workOrderApi.get(workOrderId),
				unitApi.list({}).catch(() => null),
				vendorApi.list({ isActive: true }).catch(() => null)
			]);

			if (workOrderRes.ok && workOrderRes.data?.workOrder) {
				const wo = workOrderRes.data.workOrder;
				workOrder = wo;
				formData = {
					locationType: wo.unitId ? 'unit' : 'common_area',
					unitId: wo.unitId || '',
					commonAreaDescription: wo.commonAreaName || '',
					title: wo.title || '',
					description: wo.description || '',
					category: (wo.category as string) || DocumentCategoryValues.MAINTENANCE,
					priority: (wo.priority as string) || OwnerIntentPriorityValues.NORMAL,
					vendorId: wo.assignedVendorId || '',
					dueDate: wo.slaDeadline?.split('T')[0] || ''
				};
			} else {
				error = 'Work order not found';
			}

			if (unitsRes?.ok && unitsRes.data?.units) {
				units = unitsRes.data.units;
			}

			if (vendorsRes?.ok && vendorsRes.data?.vendors) {
				vendors = vendorsRes.data.vendors;
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

		if (!workOrder) return;

		if (!formData.title) {
			error = 'Please fill in all required fields';
			return;
		}

		if (formData.locationType === 'unit' && !formData.unitId) {
			error = 'Please select a unit';
			return;
		}

		if (formData.locationType === 'common_area' && !formData.commonAreaDescription) {
			error = 'Please describe the common area location';
			return;
		}

		isSaving = true;
		error = null;

		try {
			const response = await (workOrderApi as any).update(workOrder.id, {
				unitId: formData.locationType === 'unit' ? formData.unitId : undefined,
				commonAreaDescription: formData.locationType === 'common_area' ? formData.commonAreaDescription : undefined,
				title: formData.title,
				description: formData.description || undefined,
				category: formData.category,
				priority: formData.priority,
				vendorId: formData.vendorId || undefined,
				dueDate: formData.dueDate || undefined
			});

			if (!response.ok) {
				error = 'Failed to update work order';
				return;
			}
			goto(`/app/cam/work-orders/${workOrder.id}`);
		} catch (e) {
			error = 'Failed to update work order';
			console.error(e);
		} finally {
			isSaving = false;
		}
	}

	$effect(() => {
		if (workOrderId && $currentAssociation?.id) {
			loadData();
		}
	});
</script>

<svelte:head>
	<title>Edit Work Order | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto(`/app/cam/work-orders/${workOrderId}`)}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>
			<div class="flex-1">
				<h1 class="text-xl font-semibold">Edit Work Order</h1>
				{#if workOrder}
					<p class="mt-0.5 text-sm text-surface-500">{workOrder.workOrderNumber}</p>
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
			{:else if error && !workOrder}
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
						<h3 class="mb-4 font-semibold">Location</h3>
						<div class="space-y-4">
							<div>
								<span class="mb-2 block text-sm font-medium">Location Type</span>
								<div class="flex gap-4">
									<label class="flex items-center gap-2">
										<input
											type="radio"
											name="locationType"
											value="unit"
											bind:group={formData.locationType}
											class="h-4 w-4 text-primary-500"
										/>
										<span>Unit</span>
									</label>
									<label class="flex items-center gap-2">
										<input
											type="radio"
											name="locationType"
											value="common_area"
											bind:group={formData.locationType}
											class="h-4 w-4 text-primary-500"
										/>
										<span>Common Area</span>
									</label>
								</div>
							</div>

							{#if formData.locationType === 'unit'}
								<div>
									<label for="unitId" class="mb-1 block text-sm font-medium">
										Unit <span class="text-error-500">*</span>
									</label>
									<select
										id="unitId"
										bind:value={formData.unitId}
										class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
									>
										<option value="">Select a unit</option>
										{#each units as unit}
											<option value={unit.id}>Unit {unit.unitNumber}</option>
										{/each}
									</select>
								</div>
							{:else}
								<div>
									<label for="commonAreaDescription" class="mb-1 block text-sm font-medium">
										Common Area Location <span class="text-error-500">*</span>
									</label>
									<input
										id="commonAreaDescription"
										type="text"
										bind:value={formData.commonAreaDescription}
										placeholder="e.g., Pool area, Clubhouse, Parking lot B"
										class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
									/>
								</div>
							{/if}
						</div>
					</Card>

					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 font-semibold">Work Order Details</h3>
						<div class="space-y-4">
							<div>
								<label for="title" class="mb-1 block text-sm font-medium">
									Title <span class="text-error-500">*</span>
								</label>
								<input
									id="title"
									type="text"
									bind:value={formData.title}
									required
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
									rows={4}
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								></textarea>
							</div>

							<div class="grid gap-4 sm:grid-cols-2">
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
									<label for="priority" class="mb-1 block text-sm font-medium">
										Priority <span class="text-error-500">*</span>
									</label>
									<select
										id="priority"
										bind:value={formData.priority}
										required
										class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
									>
										{#each priorityOptions as option}
											<option value={option.value}>{option.label}</option>
										{/each}
									</select>
								</div>
							</div>

							<div>
								<label for="dueDate" class="mb-1 block text-sm font-medium">
									Due Date
								</label>
								<input
									id="dueDate"
									type="date"
									bind:value={formData.dueDate}
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								/>
							</div>
						</div>
					</Card>

					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 font-semibold">Vendor Assignment</h3>
						<div>
							<label for="vendorId" class="mb-1 block text-sm font-medium">
								Assigned Vendor
							</label>
							<select
								id="vendorId"
								bind:value={formData.vendorId}
								class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							>
								<option value="">Not assigned</option>
								{#each vendors as vendor}
									<option value={vendor.id}>
										{vendor.name}
									</option>
								{/each}
							</select>
						</div>
					</Card>

					<div class="flex justify-end gap-3">
						<button
							type="button"
							onclick={() => goto(`/app/cam/work-orders/${workOrderId}`)}
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
