<script lang="ts">
	import { goto } from '$app/navigation';
	import { ArrowLeft, Wrench, Upload } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';
	import { ARCCategoryValues, AssetCategoryValues, FundTypeValues, WorkOrderCategoryValues, WorkOrderOriginTypeValues, WorkOrderPriorityValues, type Unit, type Vendor, unitApi, vendorApi, workOrderApi } from '$lib/api/cam';

	let units = $state<Unit[]>([]);
	let vendors = $state<Vendor[]>([]);
	let isLoadingData = $state(true);
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	let formData = $state({
		locationType: 'unit' as 'unit' | 'common_area',
		unitId: '',
		commonAreaDescription: '',
		title: '',
		description: '',
		category: WorkOrderCategoryValues.MAINTENANCE,
		priority: WorkOrderPriorityValues.MEDIUM,
		vendorId: '',
		dueDate: '',
		// Phase 9: Origin tracking
		originType: WorkOrderOriginTypeValues.MANUAL as string,
		violationId: '',
		arcRequestId: '',
		resolutionId: '',
		originNotes: '',
		// Phase 9: Budget
		budgetSource: '' as string,
		approvedAmount: '',
		// Phase 9: Constraints
		constraints: ''
	});

	// Phase 9: Origin type options
	const originTypeOptions = [
		{ value: WorkOrderOriginTypeValues.MANUAL, label: 'Manual Entry' },
		{ value: WorkOrderOriginTypeValues.VIOLATION_REMEDIATION, label: 'Violation Remediation' },
		{ value: WorkOrderOriginTypeValues.ARC_APPROVAL, label: 'ARC Approval' },
		{ value: WorkOrderOriginTypeValues.PREVENTIVE_MAINTENANCE, label: 'Preventive Maintenance' },
		{ value: WorkOrderOriginTypeValues.BOARD_DIRECTIVE, label: 'Board Directive' },
		{ value: WorkOrderOriginTypeValues.EMERGENCY_ACTION, label: 'Emergency Action' }
	];

	// Phase 9: Budget source options
	const budgetSourceOptions = [
		{ value: '', label: 'Select budget source' },
		{ value: FundTypeValues.OPERATING, label: 'Operating Fund' },
		{ value: FundTypeValues.RESERVE, label: 'Reserve Fund' },
		{ value: FundTypeValues.SPECIAL, label: 'Special Assessment' }
	];

	const categoryOptions = [
		{ value: WorkOrderCategoryValues.MAINTENANCE, label: 'Maintenance' },
		{ value: WorkOrderCategoryValues.REPAIR, label: 'Repair' },
		{ value: WorkOrderCategoryValues.LANDSCAPING, label: 'Landscaping' },
		{ value: WorkOrderCategoryValues.CLEANING, label: 'Cleaning' },
		{ value: AssetCategoryValues.ELECTRICAL, label: 'Electrical' },
		{ value: AssetCategoryValues.PLUMBING, label: 'Plumbing' },
		{ value: ARCCategoryValues.HVAC, label: ARCCategoryValues.HVAC },
		{ value: WorkOrderCategoryValues.OTHER, label: 'Other' }
	];

	const priorityOptions = [
		{ value: WorkOrderPriorityValues.EMERGENCY, label: 'Emergency' },
		{ value: WorkOrderPriorityValues.HIGH, label: 'High' },
		{ value: WorkOrderPriorityValues.MEDIUM, label: 'Medium' },
		{ value: WorkOrderPriorityValues.LOW, label: 'Low' },
		{ value: WorkOrderPriorityValues.SCHEDULED, label: 'Scheduled' }
	];

	async function loadFormData() {
		if (!$currentAssociation?.id) return;

		isLoadingData = true;
		try {
			const [unitsRes, vendorsRes] = await Promise.all([
				unitApi.list({}).catch(() => null),
				vendorApi.list({ isActive: true }).catch(() => null)
			]);

			if (unitsRes?.ok) {
				units = unitsRes.data.units;
			}

			if (vendorsRes?.ok) {
				vendors = vendorsRes.data.vendors;
			}
		} catch (e) {
			console.error('Failed to load form data:', e);
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

		isSubmitting = true;
		error = null;

		try {
			const response = await workOrderApi.create({
				title: formData.title,
				description: formData.description || '',
				category: formData.category as any,
				priority: formData.priority as any,
				unitId: formData.locationType === 'unit' ? formData.unitId : undefined,
				commonAreaDescription: formData.locationType === 'common_area' ? formData.commonAreaDescription : undefined,
				vendorId: formData.vendorId || undefined,
				slaDeadline: formData.dueDate || undefined,
				idempotencyKey: crypto.randomUUID()
			});

			if (!response.ok) {
				error = 'Failed to create work order';
				return;
			}
			goto(`/app/cam/work-orders/${response.data.workOrder.id}`);
		} catch (e) {
			error = 'Failed to create work order';
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
	<title>Create Work Order | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto('/app/cam/work-orders')}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>
			<div class="flex-1">
				<h1 class="text-xl font-semibold">Create Work Order</h1>
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

					<!-- Phase 9: Origin Section -->
					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 font-semibold">Origin & Source</h3>
						<div class="space-y-4">
							<div>
								<label for="originType" class="mb-1 block text-sm font-medium">
									Origin Type <span class="text-error-500">*</span>
								</label>
								<select
									id="originType"
									bind:value={formData.originType}
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								>
									{#each originTypeOptions as option}
										<option value={option.value}>{option.label}</option>
									{/each}
								</select>
								<p class="mt-1 text-xs text-surface-400">
									Select how this work order originated
								</p>
							</div>

							{#if formData.originType !== WorkOrderOriginTypeValues.MANUAL}
								<div>
									<label for="originNotes" class="mb-1 block text-sm font-medium">
										Origin Notes
									</label>
									<textarea
										id="originNotes"
										bind:value={formData.originNotes}
										rows={2}
										placeholder="Additional context about the origin..."
										class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
									></textarea>
								</div>
							{/if}
						</div>
					</Card>

					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 font-semibold">Location</h3>
						<div class="space-y-4">
							<fieldset>
								<legend class="mb-2 block text-sm font-medium">Location Type</legend>
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
							</fieldset>

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
									placeholder="Brief description of the work needed"
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
									placeholder="Detailed description of the work to be done..."
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

					<!-- Phase 9: Budget Section -->
					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 font-semibold">Budget & Constraints</h3>
						<div class="space-y-4">
							<div class="grid gap-4 sm:grid-cols-2">
								<div>
									<label for="budgetSource" class="mb-1 block text-sm font-medium">
										Budget Source
									</label>
									<select
										id="budgetSource"
										bind:value={formData.budgetSource}
										class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
									>
										{#each budgetSourceOptions as option}
											<option value={option.value}>{option.label}</option>
										{/each}
									</select>
								</div>

								<div>
									<label for="approvedAmount" class="mb-1 block text-sm font-medium">
										Estimated Budget
									</label>
									<div class="relative">
										<span class="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">$</span>
										<input
											id="approvedAmount"
											type="number"
											step="0.01"
											min="0"
											bind:value={formData.approvedAmount}
											placeholder="0.00"
											class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 py-2 pl-7 pr-3 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
										/>
									</div>
								</div>
							</div>

							<div>
								<label for="constraints" class="mb-1 block text-sm font-medium">
									Constraints / Conditions
								</label>
								<textarea
									id="constraints"
									bind:value={formData.constraints}
									rows={2}
									placeholder="HOA rules, access restrictions, special requirements..."
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								></textarea>
								<p class="mt-1 text-xs text-surface-400">
									Any conditions or restrictions that apply to this work
								</p>
							</div>
						</div>
					</Card>

					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 font-semibold">Vendor Assignment (Optional)</h3>
						<div>
							<label for="vendorId" class="mb-1 block text-sm font-medium">
								Assign Vendor
							</label>
							<select
								id="vendorId"
								bind:value={formData.vendorId}
								class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							>
								<option value="">Assign later</option>
								{#each vendors as vendor}
									<option value={vendor.id}>
										{vendor.name}
									</option>
								{/each}
							</select>
							<p class="mt-1 text-xs text-surface-400">
								You can assign a vendor now or later from the work order detail page.
							</p>
						</div>
					</Card>

					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 font-semibold">Attachments (Optional)</h3>
						<div class="rounded-lg border-2 border-dashed border-surface-300-700 p-8 text-center">
							<Upload class="mx-auto h-8 w-8 text-surface-400" />
							<p class="mt-2 text-sm text-surface-500">
								Upload photos or documents
							</p>
							<p class="mt-1 text-xs text-surface-400">
								You can add attachments after creating the work order
							</p>
						</div>
					</Card>

					<div class="flex justify-end gap-3">
						<button
							type="button"
							onclick={() => goto('/app/cam/work-orders')}
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
								<Wrench class="mr-2 h-4 w-4" />
							{/if}
							Create Work Order
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
</div>
