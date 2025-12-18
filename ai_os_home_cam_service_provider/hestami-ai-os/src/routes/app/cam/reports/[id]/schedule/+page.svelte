<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Calendar, Clock, Mail, Loader2 } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';

	interface ReportDefinition {
		id: string;
		name: string;
		description: string;
		category: string;
	}

	let report = $state<ReportDefinition | null>(null);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let error = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	// Schedule form state
	let frequency = $state('WEEKLY');
	let dayOfWeek = $state('1'); // Monday
	let dayOfMonth = $state('1');
	let time = $state('08:00');
	let outputFormat = $state('PDF');
	let recipients = $state('');
	let isActive = $state(true);

	const reportId = $derived(($page.params as Record<string, string>).id);

	const frequencyOptions = [
		{ value: 'DAILY', label: 'Daily' },
		{ value: 'WEEKLY', label: 'Weekly' },
		{ value: 'MONTHLY', label: 'Monthly' },
		{ value: 'QUARTERLY', label: 'Quarterly' }
	];

	const dayOfWeekOptions = [
		{ value: '0', label: 'Sunday' },
		{ value: '1', label: 'Monday' },
		{ value: '2', label: 'Tuesday' },
		{ value: '3', label: 'Wednesday' },
		{ value: '4', label: 'Thursday' },
		{ value: '5', label: 'Friday' },
		{ value: '6', label: 'Saturday' }
	];

	const formatOptions = [
		{ value: 'PDF', label: 'PDF' },
		{ value: 'EXCEL', label: 'Excel' },
		{ value: 'CSV', label: 'CSV' }
	];

	async function loadReport() {
		if (!reportId) return;

		isLoading = true;
		error = null;

		try {
			const response = await fetch(`/api/report/definition/${reportId}`);
			if (response.ok) {
				const data = await response.json();
				if (data.ok && data.data) {
					report = data.data;
				} else {
					error = 'Report not found';
				}
			} else {
				error = 'Failed to load report';
			}
		} catch (e) {
			error = 'Failed to load report';
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	async function saveSchedule() {
		if (!report || !$currentAssociation?.id) return;

		isSaving = true;
		error = null;
		successMessage = null;

		try {
			const response = await fetch(`/api/report/${report.id}/schedule`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					associationId: $currentAssociation.id,
					frequency,
					dayOfWeek: frequency === 'WEEKLY' ? parseInt(dayOfWeek) : undefined,
					dayOfMonth: frequency === 'MONTHLY' || frequency === 'QUARTERLY' ? parseInt(dayOfMonth) : undefined,
					time,
					outputFormat,
					recipients: recipients.split(',').map(r => r.trim()).filter(r => r),
					isActive
				})
			});

			if (response.ok) {
				successMessage = 'Schedule saved successfully!';
				setTimeout(() => {
					goto('/app/cam/reports');
				}, 1500);
			} else {
				error = 'Failed to save schedule';
			}
		} catch (e) {
			error = 'Failed to save schedule';
			console.error(e);
		} finally {
			isSaving = false;
		}
	}

	$effect(() => {
		if (reportId) {
			loadReport();
		}
	});
</script>

<svelte:head>
	<title>Schedule Report | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto('/app/cam/reports')}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>

			{#if isLoading}
				<div class="h-6 w-48 animate-pulse rounded bg-surface-200-800"></div>
			{:else if report}
				<div class="flex-1">
					<p class="text-sm text-surface-500">Schedule Report</p>
					<h1 class="text-xl font-semibold">{report.name}</h1>
				</div>
			{/if}
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-6">
		{#if isLoading}
			<div class="flex h-64 items-center justify-center">
				<Loader2 class="h-8 w-8 animate-spin text-primary-500" />
			</div>
		{:else if report}
			<div class="mx-auto max-w-2xl space-y-6">
				{#if successMessage}
					<div class="rounded-lg bg-success-500/10 p-4 text-success-600">
						{successMessage}
					</div>
				{/if}

				{#if error}
					<div class="rounded-lg bg-error-500/10 p-4 text-error-500">
						{error}
					</div>
				{/if}

				<Card variant="outlined" padding="lg">
					<div class="flex items-center gap-3 mb-6">
						<Calendar class="h-6 w-6 text-primary-500" />
						<h3 class="font-semibold">Schedule Configuration</h3>
					</div>

					<div class="space-y-4">
						<div>
							<label for="frequency" class="block text-sm font-medium">
								Frequency <span class="text-error-500">*</span>
							</label>
							<select
								id="frequency"
								bind:value={frequency}
								class="mt-1 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							>
								{#each frequencyOptions as option}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</div>

						{#if frequency === 'WEEKLY'}
							<div>
								<label for="dayOfWeek" class="block text-sm font-medium">
									Day of Week <span class="text-error-500">*</span>
								</label>
								<select
									id="dayOfWeek"
									bind:value={dayOfWeek}
									class="mt-1 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								>
									{#each dayOfWeekOptions as option}
										<option value={option.value}>{option.label}</option>
									{/each}
								</select>
							</div>
						{/if}

						{#if frequency === 'MONTHLY' || frequency === 'QUARTERLY'}
							<div>
								<label for="dayOfMonth" class="block text-sm font-medium">
									Day of Month <span class="text-error-500">*</span>
								</label>
								<select
									id="dayOfMonth"
									bind:value={dayOfMonth}
									class="mt-1 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								>
									{#each Array.from({ length: 28 }, (_, i) => i + 1) as day}
										<option value={day.toString()}>{day}</option>
									{/each}
								</select>
							</div>
						{/if}

						<div>
							<label for="time" class="block text-sm font-medium">
								Time <span class="text-error-500">*</span>
							</label>
							<div class="relative mt-1">
								<Clock class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
								<input
									id="time"
									type="time"
									bind:value={time}
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 py-2 pl-10 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								/>
							</div>
						</div>

						<div>
							<label for="outputFormat" class="block text-sm font-medium">
								Output Format <span class="text-error-500">*</span>
							</label>
							<select
								id="outputFormat"
								bind:value={outputFormat}
								class="mt-1 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							>
								{#each formatOptions as option}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</div>
					</div>
				</Card>

				<Card variant="outlined" padding="lg">
					<div class="flex items-center gap-3 mb-6">
						<Mail class="h-6 w-6 text-primary-500" />
						<h3 class="font-semibold">Delivery</h3>
					</div>

					<div class="space-y-4">
						<div>
							<label for="recipients" class="block text-sm font-medium">
								Email Recipients
							</label>
							<textarea
								id="recipients"
								bind:value={recipients}
								rows={3}
								placeholder="Enter email addresses, separated by commas"
								class="mt-1 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm placeholder:text-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							></textarea>
							<p class="mt-1 text-xs text-surface-500">
								Leave empty to only save to the reports archive.
							</p>
						</div>

						<div class="flex items-center gap-3">
							<input
								id="isActive"
								type="checkbox"
								bind:checked={isActive}
								class="h-4 w-4 rounded border-surface-300-700 text-primary-500 focus:ring-primary-500"
							/>
							<label for="isActive" class="text-sm font-medium">
								Schedule is active
							</label>
						</div>
					</div>
				</Card>

				<div class="flex justify-end gap-3">
					<button
						type="button"
						onclick={() => goto('/app/cam/reports')}
						class="rounded-lg px-4 py-2 text-sm font-medium text-surface-700-300 transition-colors hover:bg-surface-200-800"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={saveSchedule}
						disabled={isSaving}
						class="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if isSaving}
							<Loader2 class="h-4 w-4 animate-spin" />
						{/if}
						Save Schedule
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>
