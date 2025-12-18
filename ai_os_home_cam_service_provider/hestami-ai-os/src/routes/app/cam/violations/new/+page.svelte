<script lang="ts">
	import { goto } from '$app/navigation';
	import { ArrowLeft, AlertTriangle, Upload } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';

	interface ViolationType {
		id: string;
		name: string;
		description?: string;
		defaultSeverity: string;
	}

	interface Unit {
		id: string;
		unitNumber: string;
		ownerName?: string;
	}

	let violationTypes = $state<ViolationType[]>([]);
	let units = $state<Unit[]>([]);
	let isLoadingData = $state(true);
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	let formData = $state({
		unitId: '',
		violationTypeId: '',
		title: '',
		description: '',
		severity: 'MODERATE',
		reportedDate: new Date().toISOString().split('T')[0]
	});

	const severityOptions = [
		{ value: 'CRITICAL', label: 'Critical' },
		{ value: 'MAJOR', label: 'Major' },
		{ value: 'MODERATE', label: 'Moderate' },
		{ value: 'MINOR', label: 'Minor' }
	];

	async function loadFormData() {
		if (!$currentAssociation?.id) return;

		isLoadingData = true;
		try {
			const [typesRes, unitsRes] = await Promise.all([
				fetch(`/api/violation-type?associationId=${$currentAssociation.id}`).catch(() => null),
				fetch(`/api/unit?associationId=${$currentAssociation.id}`).catch(() => null)
			]);

			if (typesRes?.ok) {
				const data = await typesRes.json();
				if (data.ok && data.data?.items) {
					violationTypes = data.data.items;
				}
			}

			if (unitsRes?.ok) {
				const data = await unitsRes.json();
				if (data.ok && data.data?.items) {
					units = data.data.items;
				}
			}
		} catch (e) {
			console.error('Failed to load form data:', e);
		} finally {
			isLoadingData = false;
		}
	}

	function handleViolationTypeChange() {
		const selectedType = violationTypes.find(t => t.id === formData.violationTypeId);
		if (selectedType?.defaultSeverity) {
			formData.severity = selectedType.defaultSeverity;
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
			const response = await fetch('/api/violation', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					associationId: $currentAssociation.id,
					unitId: formData.unitId,
					violationTypeId: formData.violationTypeId || undefined,
					title: formData.title,
					description: formData.description || undefined,
					severity: formData.severity,
					reportedDate: formData.reportedDate
				})
			});

			if (response.ok) {
				const data = await response.json();
				if (data.ok && data.data?.id) {
					goto(`/app/cam/violations/${data.data.id}`);
				} else {
					error = data.error?.message || 'Failed to create violation';
				}
			} else {
				error = 'Failed to create violation';
			}
		} catch (e) {
			error = 'Failed to create violation';
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
	<title>Report Potential Violation | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto('/app/cam/violations')}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>
			<div class="flex-1">
				<h1 class="text-xl font-semibold">Report Potential Violation</h1>
				<p class="mt-0.5 text-sm text-surface-500">
					{$currentAssociation?.name || 'Select an association'} · Detection initiates review, not enforcement
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
						<h3 class="mb-4 font-semibold">Location</h3>
						<div class="space-y-4">
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
											Unit {unit.unitNumber}{unit.ownerName ? ` - ${unit.ownerName}` : ''}
										</option>
									{/each}
								</select>
							</div>
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
									onchange={handleViolationTypeChange}
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
									placeholder="Brief description of the violation"
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
									placeholder="Detailed description of the violation..."
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
										Reported Date <span class="text-error-500">*</span>
									</label>
									<input
										id="reportedDate"
										type="date"
										bind:value={formData.reportedDate}
										required
										class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
									/>
								</div>
							</div>
						</div>
					</Card>

					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 font-semibold">Evidence (Optional)</h3>
						<div class="rounded-lg border-2 border-dashed border-surface-300-700 p-8 text-center">
							<Upload class="mx-auto h-8 w-8 text-surface-400" />
							<p class="mt-2 text-sm text-surface-500">
								Upload photos or documents as evidence
							</p>
							<p class="mt-1 text-xs text-surface-400">
								You can add evidence after creating the violation
							</p>
						</div>
					</Card>

					<div class="flex justify-end gap-3">
						<button
							type="button"
							onclick={() => goto('/app/cam/violations')}
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
								<AlertTriangle class="mr-2 h-4 w-4" />
							{/if}
							Report Violation
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
</div>
