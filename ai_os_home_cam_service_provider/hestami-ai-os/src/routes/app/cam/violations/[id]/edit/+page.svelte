<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Save } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';
	import { ViolationSeverityValues, type Unit, type ViolationDetail, type ViolationType, unitApi, violationApi, violationTypeApi } from '$lib/api/cam';

	let violation = $state<ViolationDetail | null>(null);
	let violationTypes = $state<ViolationType[]>([]);
	let units = $state<Unit[]>([]);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let error = $state<string | null>(null);

	let formData = $state<{
		unitId: string;
		violationTypeId: string;
		title: string;
		description: string;
		severity: string;
		reportedDate: string;
		dueDate: string;
	}>({
		unitId: '',
		violationTypeId: '',
		title: '',
		description: '',
		severity: ViolationSeverityValues.MODERATE,
		reportedDate: '',
		dueDate: ''
	});

	const severityOptions = [
		{ value: ViolationSeverityValues.CRITICAL, label: 'Critical' },
		{ value: ViolationSeverityValues.MAJOR, label: 'Major' },
		{ value: ViolationSeverityValues.MODERATE, label: 'Moderate' },
		{ value: ViolationSeverityValues.MINOR, label: 'Minor' }
	];

	const violationId = $derived(($page.params as Record<string, string>).id);

	async function loadData() {
		if (!violationId || !$currentAssociation?.id) return;

		isLoading = true;
		error = null;

		try {
			const [violationRes, typesRes, unitsRes] = await Promise.all([
				violationApi.get(violationId),
				violationTypeApi.list().catch(() => null),
				unitApi.list({}).catch(() => null)
			]);

			if (violationRes.ok && violationRes.data?.violation) {
				const v = violationRes.data.violation;
				violation = v;
				formData = {
					unitId: v.unitId || '',
					violationTypeId: v.violationTypeId || '',
					title: v.title || '',
					description: v.description || '',
					severity: v.severity as string || ViolationSeverityValues.MODERATE,
					reportedDate: v.reportedDate?.split('T')[0] || '',
					dueDate: v.curePeriodEnds?.split('T')[0] || ''
				};
			} else {
				error = 'Violation not found';
			}

			if (typesRes?.ok && typesRes.data?.violationTypes) {
				violationTypes = typesRes.data.violationTypes;
			}

			if (unitsRes?.ok && unitsRes.data?.units) {
				units = unitsRes.data.units;
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

		if (!violation) return;

		if (!formData.unitId || !formData.title) {
			error = 'Please fill in all required fields';
			return;
		}

		isSaving = true;
		error = null;

		try {
			const response = await violationApi.update(violation.id, {
				unitId: formData.unitId,
				title: formData.title,
				severity: formData.severity as any,
				idempotencyKey: crypto.randomUUID()
			});

			if (!response.ok) {
				error = 'Failed to update violation';
				return;
			}
			goto(`/app/cam/violations/${violation.id}`);
		} catch (e) {
			error = 'Failed to update violation';
			console.error(e);
		} finally {
			isSaving = false;
		}
	}

	$effect(() => {
		if (violationId && $currentAssociation?.id) {
			loadData();
		}
	});
</script>

<svelte:head>
	<title>Edit Violation | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto(`/app/cam/violations/${violationId}`)}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>
			<div class="flex-1">
				<h1 class="text-xl font-semibold">Edit Violation</h1>
				{#if violation}
					<p class="mt-0.5 text-sm text-surface-500">{violation.violationNumber}</p>
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
			{:else if error && !violation}
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
								<option value="">Select a unit</option>
								{#each units as unit}
									<option value={unit.id}>
										Unit {unit.unitNumber}{(unit as any).ownerName ? ` - ${(unit as any).ownerName}` : ''}
									</option>
								{/each}
							</select>
						</div>
					</Card>

					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 font-semibold">Violation Details</h3>
						<div class="space-y-4">
							<div>
								<label for="violationTypeId" class="mb-1 block text-sm font-medium">
									Violation Type
								</label>
								<select
									id="violationTypeId"
									bind:value={formData.violationTypeId}
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								>
									<option value="">Select a type (optional)</option>
									{#each violationTypes as type}
										<option value={type.id}>{type.name}</option>
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
									<label for="severity" class="mb-1 block text-sm font-medium">
										Severity <span class="text-error-500">*</span>
									</label>
									<select
										id="severity"
										bind:value={formData.severity}
										required
										class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
									>
										{#each severityOptions as option}
											<option value={option.value}>{option.label}</option>
										{/each}
									</select>
								</div>

								<div>
									<label for="reportedDate" class="mb-1 block text-sm font-medium">
										Reported Date
									</label>
									<input
										id="reportedDate"
										type="date"
										bind:value={formData.reportedDate}
										class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
									/>
								</div>
							</div>

							<div>
								<label for="dueDate" class="mb-1 block text-sm font-medium">
									Due Date (Cure Deadline)
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

					<div class="flex justify-end gap-3">
						<button
							type="button"
							onclick={() => goto(`/app/cam/violations/${violationId}`)}
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
