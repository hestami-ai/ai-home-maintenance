<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		ArrowLeft,
		Loader2,
		Save,
		Wrench
	} from 'lucide-svelte';
	import { PageContainer, Card } from '$lib/components/ui';
	import { ARCCategoryValues, ActivityEntityTypeValues, JobPriorityValues, JobSourceTypeValues, JobStatusValues, jobApi, type JobSourceType } from '$lib/api/cam';

	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	// Form fields
	let title = $state('');
	let description = $state('');
	let sourceType = $state<JobSourceType>(JobSourceTypeValues.DIRECT_CUSTOMER);
	let category = $state('');
	let priority = $state<string>(JobPriorityValues.MEDIUM);
	let addressLine1 = $state('');
	let addressLine2 = $state('');
	let city = $state('');
	let stateProvince = $state('');
	let postalCode = $state('');
	let locationNotes = $state('');
	let estimatedHours = $state<number | undefined>(undefined);
	let estimatedCost = $state<number | undefined>(undefined);

	const sourceTypes: Array<{ value: JobSourceType; label: string }> = [
		{ value: JobSourceTypeValues.DIRECT_CUSTOMER, label: 'Direct Customer' },
		{ value: JobStatusValues.LEAD, label: 'Lead' },
		{ value: ActivityEntityTypeValues.WORK_ORDER, label: 'Work Order' },
		{ value: ActivityEntityTypeValues.VIOLATION, label: 'Violation' },
		{ value: ActivityEntityTypeValues.ARC_REQUEST, label: 'ARC Request' },
		{ value: JobSourceTypeValues.RECURRING, label: 'Recurring' }
	];

	const priorities = [
		{ value: JobPriorityValues.EMERGENCY, label: 'Emergency' },
		{ value: JobPriorityValues.HIGH, label: 'High' },
		{ value: JobPriorityValues.MEDIUM, label: 'Medium' },
		{ value: JobPriorityValues.LOW, label: 'Low' }
	] as const;

	const categories = [
		ARCCategoryValues.HVAC,
		'Plumbing',
		'Electrical',
		'Roofing',
		'Landscaping',
		'General Maintenance',
		'Painting',
		'Flooring',
		'Appliance Repair',
		'Other'
	];

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!title.trim()) {
			error = 'Title is required';
			return;
		}

		isSubmitting = true;
		error = null;

		try {
			const response = await jobApi.create({
				sourceType,
				title: title.trim(),
				description: description.trim() || undefined,
				category: category || undefined,
				priority: priority as import('$lib/api/cam').JobPriority,
				addressLine1: addressLine1.trim() || undefined,
				addressLine2: addressLine2.trim() || undefined,
				city: city.trim() || undefined,
				state: stateProvince.trim() || undefined,
				postalCode: postalCode.trim() || undefined,
				locationNotes: locationNotes.trim() || undefined,
				estimatedHours,
				estimatedCost,
				idempotencyKey: crypto.randomUUID()
			});

			if (!response.ok) {
				error = 'Failed to create job';
				return;
			}
			goto(`/app/contractor/jobs/${response.data.job.id}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create job';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>New Job | Contractor Portal | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="mx-auto max-w-3xl py-6">
		<!-- Header -->
		<div class="flex items-center gap-4 mb-6">
			<a href="/app/contractor/jobs" class="btn btn-icon preset-outlined-surface-500">
				<ArrowLeft class="h-4 w-4" />
			</a>
			<div>
				<h1 class="text-2xl font-bold">Create New Job</h1>
				<p class="text-surface-500">Enter job details to create a new contractor job</p>
			</div>
		</div>

		<!-- Form -->
		<form onsubmit={handleSubmit}>
			{#if error}
				<div class="mb-6 rounded-lg border border-error-500/50 bg-error-500/10 p-4 text-error-500">
					{error}
				</div>
			{/if}

			<div class="space-y-6">
				<!-- Basic Info -->
				<Card variant="outlined" padding="md">
					<h2 class="font-medium mb-4">Basic Information</h2>
					<div class="space-y-4">
						<div>
							<label for="title" class="label mb-1">Title *</label>
							<input
								id="title"
								type="text"
								bind:value={title}
								placeholder="e.g., HVAC Repair - Unit 101"
								class="input w-full"
								required
							/>
						</div>

						<div>
							<label for="description" class="label mb-1">Description</label>
							<textarea
								id="description"
								bind:value={description}
								placeholder="Describe the work to be done..."
								rows="3"
								class="textarea w-full"
							></textarea>
						</div>

						<div class="grid gap-4 sm:grid-cols-2">
							<div>
								<label for="sourceType" class="label mb-1">Source Type</label>
								<select id="sourceType" bind:value={sourceType} class="select w-full">
									{#each sourceTypes as source}
										<option value={source.value}>{source.label}</option>
									{/each}
								</select>
							</div>

							<div>
								<label for="category" class="label mb-1">Category</label>
								<select id="category" bind:value={category} class="select w-full">
									<option value="">Select category...</option>
									{#each categories as cat}
										<option value={cat}>{cat}</option>
									{/each}
								</select>
							</div>
						</div>

						<div>
							<label for="priority" class="label mb-1">Priority</label>
							<div class="flex gap-2">
								{#each priorities as p}
									<button
										type="button"
										onclick={() => priority = p.value}
										class="btn btn-sm {priority === p.value ? 'preset-filled-primary-500' : 'preset-outlined-surface-500'}"
									>
										{p.label}
									</button>
								{/each}
							</div>
						</div>
					</div>
				</Card>

				<!-- Location -->
				<Card variant="outlined" padding="md">
					<h2 class="font-medium mb-4">Location</h2>
					<div class="space-y-4">
						<div>
							<label for="addressLine1" class="label mb-1">Address Line 1</label>
							<input
								id="addressLine1"
								type="text"
								bind:value={addressLine1}
								placeholder="Street address"
								class="input w-full"
							/>
						</div>

						<div>
							<label for="addressLine2" class="label mb-1">Address Line 2</label>
							<input
								id="addressLine2"
								type="text"
								bind:value={addressLine2}
								placeholder="Apt, suite, unit, etc."
								class="input w-full"
							/>
						</div>

						<div class="grid gap-4 sm:grid-cols-3">
							<div>
								<label for="city" class="label mb-1">City</label>
								<input
									id="city"
									type="text"
									bind:value={city}
									class="input w-full"
								/>
							</div>
							<div>
								<label for="state" class="label mb-1">State</label>
								<input
									id="state"
									type="text"
									bind:value={stateProvince}
									class="input w-full"
								/>
							</div>
							<div>
								<label for="postalCode" class="label mb-1">Postal Code</label>
								<input
									id="postalCode"
									type="text"
									bind:value={postalCode}
									class="input w-full"
								/>
							</div>
						</div>

						<div>
							<label for="locationNotes" class="label mb-1">Location Notes</label>
							<textarea
								id="locationNotes"
								bind:value={locationNotes}
								placeholder="Gate code, parking instructions, etc."
								rows="2"
								class="textarea w-full"
							></textarea>
						</div>
					</div>
				</Card>

				<!-- Estimates -->
				<Card variant="outlined" padding="md">
					<h2 class="font-medium mb-4">Estimates</h2>
					<div class="grid gap-4 sm:grid-cols-2">
						<div>
							<label for="estimatedHours" class="label mb-1">Estimated Hours</label>
							<input
								id="estimatedHours"
								type="number"
								bind:value={estimatedHours}
								min="0"
								step="0.5"
								placeholder="0"
								class="input w-full"
							/>
						</div>
						<div>
							<label for="estimatedCost" class="label mb-1">Estimated Cost ($)</label>
							<input
								id="estimatedCost"
								type="number"
								bind:value={estimatedCost}
								min="0"
								step="0.01"
								placeholder="0.00"
								class="input w-full"
							/>
						</div>
					</div>
				</Card>

				<!-- Actions -->
				<div class="flex justify-end gap-3">
					<a href="/app/contractor/jobs" class="btn preset-outlined-surface-500">
						Cancel
					</a>
					<button
						type="submit"
						disabled={isSubmitting || !title.trim()}
						class="btn preset-filled-primary-500"
					>
						{#if isSubmitting}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Creating...
						{:else}
							<Save class="mr-2 h-4 w-4" />
							Create Job
						{/if}
					</button>
				</div>
			</div>
		</form>
	</div>
</PageContainer>
