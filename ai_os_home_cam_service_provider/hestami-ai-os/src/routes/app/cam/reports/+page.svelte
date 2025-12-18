<script lang="ts">
	import { BarChart3, Plus, Search, Play, Calendar } from 'lucide-svelte';
	import { SplitView, ListPanel, DetailPanel } from '$lib/components/cam';
	import { Card, EmptyState } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';

	interface ReportDefinition {
		id: string;
		name: string;
		description: string;
		category: string;
		outputFormat: string;
		createdAt: string;
	}

	let reports = $state<ReportDefinition[]>([]);
	let selectedReport = $state<ReportDefinition | null>(null);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let categoryFilter = $state<string>('');

	const categoryOptions = [
		{ value: '', label: 'All Categories' },
		{ value: 'FINANCIAL', label: 'Financial' },
		{ value: 'OPERATIONAL', label: 'Operational' },
		{ value: 'COMPLIANCE', label: 'Compliance' },
		{ value: 'CUSTOM', label: 'Custom' }
	];

	async function loadReports() {
		if (!$currentAssociation?.id) return;

		isLoading = true;
		try {
			let url = `/api/report/definition?associationId=${$currentAssociation.id}`;
			if (categoryFilter) url += `&category=${categoryFilter}`;

			const response = await fetch(url);
			if (response.ok) {
				const data = await response.json();
				if (data.ok && data.data?.items) {
					reports = data.data.items;
				}
			}
		} catch (error) {
			console.error('Failed to load reports:', error);
		} finally {
			isLoading = false;
		}
	}

	function selectReport(report: ReportDefinition) {
		selectedReport = report;
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	const filteredReports = $derived(
		reports.filter((r) =>
			r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			r.description.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	$effect(() => {
		if ($currentAssociation?.id) {
			loadReports();
		}
	});

	$effect(() => {
		loadReports();
	});
</script>

<svelte:head>
	<title>Reports | CAM | Hestami AI</title>
</svelte:head>

<SplitView hasSelection={!!selectedReport}>
	{#snippet listPanel()}
		<ListPanel loading={isLoading}>
			{#snippet header()}
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<h1 class="text-lg font-semibold">Reports</h1>
						<a href="/app/cam/reports/new" class="btn btn-sm preset-filled-primary-500">
							<Plus class="mr-1 h-4 w-4" />
							New
						</a>
					</div>

					<div class="relative">
						<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
						<input
							type="text"
							placeholder="Search reports..."
							bind:value={searchQuery}
							class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 py-2 pl-9 pr-3 text-sm placeholder:text-surface-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>

					<select
						bind:value={categoryFilter}
						class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					>
						{#each categoryOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>
			{/snippet}

			{#snippet items()}
				{#if filteredReports.length === 0}
					<div class="p-6">
						<EmptyState
							title="No reports found"
							description={searchQuery || categoryFilter
								? 'Try adjusting your filters.'
								: 'No report definitions available.'}
						/>
					</div>
				{:else}
					<div class="divide-y divide-surface-300-700">
						{#each filteredReports as report}
							<button
								type="button"
								onclick={() => selectReport(report)}
								class="w-full px-4 py-3 text-left transition-colors hover:bg-surface-200-800 {selectedReport?.id === report.id ? 'bg-primary-500/10' : ''}"
							>
								<div class="flex items-start gap-3">
									<BarChart3 class="mt-0.5 h-5 w-5 flex-shrink-0 text-surface-400" />
									<div class="min-w-0 flex-1">
										<p class="font-medium">{report.name}</p>
										<p class="mt-0.5 truncate text-sm text-surface-500">
											{report.description}
										</p>
										<p class="mt-0.5 text-xs text-surface-400">
											{report.category} · {report.outputFormat}
										</p>
									</div>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			{/snippet}
		</ListPanel>
	{/snippet}

	{#snippet detailPanel()}
		{#if selectedReport}
			<DetailPanel>
				{#snippet header()}
					{@const rpt = selectedReport!}
					<div>
						<p class="text-sm text-surface-500">{rpt.category}</p>
						<h2 class="mt-1 text-xl font-semibold">{rpt.name}</h2>
					</div>
				{/snippet}

				{#snippet actions()}
					{@const rpt = selectedReport!}
					<a href="/app/cam/reports/{rpt.id}" class="btn btn-sm preset-filled-primary-500">
						<Play class="mr-1 h-4 w-4" />
						Run Report
					</a>
					<a href="/app/cam/reports/{rpt.id}/schedule" class="btn btn-sm preset-tonal-surface">
						<Calendar class="mr-1 h-4 w-4" />
						Schedule
					</a>
				{/snippet}

				{#snippet content()}
					{@const rpt = selectedReport!}
					<div class="p-6">
						<div class="space-y-6">
							<div>
								<h3 class="text-sm font-medium text-surface-500">Description</h3>
								<p class="mt-1">{rpt.description}</p>
							</div>

							<div class="grid gap-4 sm:grid-cols-2">
								<div>
									<h3 class="text-sm font-medium text-surface-500">Category</h3>
									<p class="mt-1">{rpt.category}</p>
								</div>
								<div>
									<h3 class="text-sm font-medium text-surface-500">Output Format</h3>
									<p class="mt-1">{rpt.outputFormat}</p>
								</div>
								<div>
									<h3 class="text-sm font-medium text-surface-500">Created</h3>
									<p class="mt-1">{formatDate(rpt.createdAt)}</p>
								</div>
							</div>

							<div class="border-t border-surface-300-700 pt-4">
								<h3 class="mb-3 font-medium">Recent Executions</h3>
								<div class="rounded-lg bg-surface-200-800 p-4 text-center">
									<p class="text-surface-500">No recent executions</p>
								</div>
							</div>
						</div>
					</div>
				{/snippet}
			</DetailPanel>
		{/if}
	{/snippet}

	{#snippet emptyDetail()}
		<div class="text-center">
			<BarChart3 class="mx-auto h-12 w-12 text-surface-300" />
			<p class="mt-2 text-surface-500">Select a report to view details</p>
		</div>
	{/snippet}
</SplitView>
