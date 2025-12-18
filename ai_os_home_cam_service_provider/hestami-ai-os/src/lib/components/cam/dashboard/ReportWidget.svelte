<script lang="ts">
	import { BarChart3, Play, ExternalLink } from 'lucide-svelte';
	import { goto } from '$app/navigation';

	interface ReportSummary {
		id: string;
		name: string;
		lastRun?: string;
		category: string;
	}

	interface Props {
		reports?: ReportSummary[];
		loading?: boolean;
	}

	let { reports = [], loading = false }: Props = $props();

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<div class="rounded-lg border border-surface-300-700 bg-surface-100-900">
	<div class="flex items-center justify-between border-b border-surface-300-700 px-4 py-3">
		<div class="flex items-center gap-2">
			<BarChart3 class="h-5 w-5 text-primary-500" />
			<h3 class="font-semibold">Quick Reports</h3>
		</div>
		<a
			href="/app/cam/reports"
			class="text-sm text-primary-500 hover:text-primary-600"
		>
			View All
		</a>
	</div>

	<div class="p-4">
		{#if loading}
			<div class="space-y-3">
				{#each Array(3) as _}
					<div class="h-12 animate-pulse rounded bg-surface-200-800"></div>
				{/each}
			</div>
		{:else if reports.length === 0}
			<div class="py-4 text-center text-sm text-surface-500">
				No reports available
			</div>
		{:else}
			<div class="space-y-2">
				{#each reports.slice(0, 5) as report}
					<div class="flex items-center justify-between rounded-lg bg-surface-200-800 p-3">
						<div class="min-w-0 flex-1">
							<p class="truncate font-medium">{report.name}</p>
							<p class="text-xs text-surface-500">
								{report.category}
								{#if report.lastRun}
									· Last run {formatDate(report.lastRun)}
								{/if}
							</p>
						</div>
						<button
							type="button"
							onclick={() => goto(`/app/cam/reports/${report.id}`)}
							class="ml-2 rounded p-1.5 text-primary-500 transition-colors hover:bg-primary-500/10"
							title="Run Report"
						>
							<Play class="h-4 w-4" />
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
