<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Play, Download, FileText, Table, FileSpreadsheet, Loader2 } from 'lucide-svelte';
	import { Card, EmptyState } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';
	import { reportApi } from '$lib/api/cam';

	interface ReportDefinition {
		id: string;
		name: string;
		description?: string;
		category: string;
		outputFormat?: string;
		parameters?: ReportParameter[];
	}

	interface ReportParameter {
		name: string;
		label: string;
		type: string;
		required: boolean;
		options?: { value: string; label: string }[];
		defaultValue?: string;
	}

	interface ReportResult {
		id: string;
		status: string;
		generatedAt: string;
		rowCount?: number;
		data?: Record<string, unknown>[];
		columns?: { key: string; label: string }[];
		downloadUrl?: string;
	}

	let report = $state<ReportDefinition | null>(null);
	let result = $state<ReportResult | null>(null);
	let isLoading = $state(true);
	let isRunning = $state(false);
	let error = $state<string | null>(null);
	let parameterValues = $state<Record<string, string>>({});

	const reportId = $derived(($page.params as Record<string, string>).id);

	async function loadReport() {
		if (!reportId) return;

		isLoading = true;
		error = null;

		try {
			const response = await reportApi.definitions.get(reportId);
			if (!response.ok) {
				error = 'Report not found';
				return;
			}
			report = response.data.report as any;
			// Initialize parameter values with defaults
			if (report?.parameters) {
				for (const param of report.parameters) {
					if (param.defaultValue) {
						parameterValues[param.name] = param.defaultValue;
					}
				}
			}
		} catch (e) {
			error = 'Failed to load report';
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	async function runReport() {
		if (!report || !$currentAssociation?.id) return;

		isRunning = true;
		result = null;
		error = null;

		try {
			const response = await reportApi.execute({
				reportId: report.id,
				parametersJson: JSON.stringify(parameterValues),
				idempotencyKey: crypto.randomUUID()
			});

			if (!response.ok) {
				error = 'Failed to generate report';
				return;
			}
			result = response.data.execution as any;
		} catch (e) {
			error = 'Failed to execute report';
			console.error(e);
		} finally {
			isRunning = false;
		}
	}

	function downloadReport(format: 'pdf' | 'excel' | 'csv') {
		if (!result?.downloadUrl) return;
		window.open(`${result.downloadUrl}?format=${format}`, '_blank');
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	$effect(() => {
		if (reportId) {
			loadReport();
		}
	});
</script>

<svelte:head>
	<title>{report?.name || 'Report'} | CAM | Hestami AI</title>
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
					<p class="text-sm text-surface-500">{report.category}</p>
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
		{:else if error && !report}
			<div class="flex h-64 items-center justify-center">
				<EmptyState title="Error" description={error} />
			</div>
		{:else if report}
			<div class="mx-auto max-w-4xl space-y-6">
				<Card variant="outlined" padding="lg">
					<h3 class="mb-4 font-semibold">Report Parameters</h3>
					
					{#if report.parameters && report.parameters.length > 0}
						<div class="grid gap-4 sm:grid-cols-2">
							{#each report.parameters as param}
								<div>
									<label for={param.name} class="block text-sm font-medium">
										{param.label}
										{#if param.required}
											<span class="text-error-500">*</span>
										{/if}
									</label>
									
									{#if param.type === 'date'}
										<input
											id={param.name}
											type="date"
											bind:value={parameterValues[param.name]}
											class="mt-1 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
										/>
									{:else if param.type === 'select' && param.options}
										<select
											id={param.name}
											bind:value={parameterValues[param.name]}
											class="mt-1 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
										>
											<option value="">Select...</option>
											{#each param.options as option}
												<option value={option.value}>{option.label}</option>
											{/each}
										</select>
									{:else if param.type === 'number'}
										<input
											id={param.name}
											type="number"
											bind:value={parameterValues[param.name]}
											class="mt-1 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
										/>
									{:else}
										<input
											id={param.name}
											type="text"
											bind:value={parameterValues[param.name]}
											class="mt-1 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
										/>
									{/if}
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-surface-500">This report has no configurable parameters.</p>
					{/if}

					<div class="mt-6 flex justify-end">
						<button
							type="button"
							onclick={runReport}
							disabled={isRunning}
							class="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{#if isRunning}
								<Loader2 class="h-4 w-4 animate-spin" />
								Generating...
							{:else}
								<Play class="h-4 w-4" />
								Run Report
							{/if}
						</button>
					</div>
				</Card>

				{#if error && result === null && !isRunning}
					<Card variant="outlined" padding="lg">
						<div class="text-center text-error-500">
							<p>{error}</p>
						</div>
					</Card>
				{/if}

				{#if result}
					<Card variant="outlined" padding="lg">
						<div class="mb-4 flex items-center justify-between">
							<div>
								<h3 class="font-semibold">Report Results</h3>
								<p class="text-sm text-surface-500">
									Generated {formatDate(result.generatedAt)}
									{#if result.rowCount !== undefined}
										· {result.rowCount} rows
									{/if}
								</p>
							</div>
							<div class="flex gap-2">
								<button
									type="button"
									onclick={() => downloadReport('pdf')}
									class="inline-flex items-center gap-1 rounded-lg border border-surface-300-700 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-200-800"
								>
									<FileText class="h-4 w-4" />
									PDF
								</button>
								<button
									type="button"
									onclick={() => downloadReport('excel')}
									class="inline-flex items-center gap-1 rounded-lg border border-surface-300-700 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-200-800"
								>
									<FileSpreadsheet class="h-4 w-4" />
									Excel
								</button>
								<button
									type="button"
									onclick={() => downloadReport('csv')}
									class="inline-flex items-center gap-1 rounded-lg border border-surface-300-700 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-200-800"
								>
									<Table class="h-4 w-4" />
									CSV
								</button>
							</div>
						</div>

						{#if result.columns && result.data && result.data.length > 0}
							<div class="overflow-x-auto rounded-lg border border-surface-300-700">
								<table class="w-full text-sm">
									<thead class="bg-surface-200-800">
										<tr>
											{#each result.columns as col}
												<th class="px-4 py-2 text-left font-medium">{col.label}</th>
											{/each}
										</tr>
									</thead>
									<tbody class="divide-y divide-surface-300-700">
										{#each result.data.slice(0, 50) as row}
											<tr class="hover:bg-surface-100-900">
												{#each result.columns as col}
													<td class="px-4 py-2">{row[col.key] ?? '-'}</td>
												{/each}
											</tr>
										{/each}
									</tbody>
								</table>
								{#if result.data.length > 50}
									<div class="border-t border-surface-300-700 bg-surface-100-900 px-4 py-2 text-center text-sm text-surface-500">
										Showing first 50 of {result.data.length} rows. Download the full report for all data.
									</div>
								{/if}
							</div>
						{:else}
							<div class="rounded-lg bg-surface-200-800 p-8 text-center">
								<p class="text-surface-500">No data returned for this report.</p>
							</div>
						{/if}
					</Card>
				{/if}
			</div>
		{/if}
	</div>
</div>
