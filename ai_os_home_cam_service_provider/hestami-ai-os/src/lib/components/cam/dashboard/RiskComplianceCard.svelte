<script lang="ts">
	import { AlertTriangle, ChevronRight, UserX, Clock, ClipboardList } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import type { DashboardRiskCompliance } from '$lib/api/cam';

	interface Props {
		data: DashboardRiskCompliance;
	}

	let { data }: Props = $props();

	const severityItems = $derived([
		{ label: 'Critical', count: data.violationsBySeverity.critical, color: 'bg-error-500' },
		{ label: 'Major', count: data.violationsBySeverity.major, color: 'bg-warning-500' },
		{ label: 'Moderate', count: data.violationsBySeverity.moderate, color: 'bg-yellow-500' },
		{ label: 'Minor', count: data.violationsBySeverity.minor, color: 'bg-surface-400' }
	]);
</script>

<Card variant="outlined" padding="none">
	<div class="border-b border-surface-300-700 px-6 py-4">
		<h2 class="font-semibold">Risk & Compliance</h2>
	</div>

	<div class="p-6">
		<!-- Violations by Severity -->
		<div class="mb-4">
			<div class="flex items-center justify-between text-sm">
				<span class="text-surface-500">Open Violations</span>
				<span class="font-semibold">{data.violationsBySeverity.total}</span>
			</div>
			{#if data.violationsBySeverity.total > 0}
				<div class="mt-2 flex h-3 overflow-hidden rounded-full bg-surface-200-800">
					{#each severityItems as item}
						{#if item.count > 0}
							<div
								class="{item.color} transition-all"
								style="width: {(item.count / data.violationsBySeverity.total) * 100}%"
								title="{item.label}: {item.count}"
							></div>
						{/if}
					{/each}
				</div>
				<div class="mt-2 flex flex-wrap gap-3 text-xs">
					{#each severityItems as item}
						<div class="flex items-center gap-1">
							<div class="h-2 w-2 rounded-full {item.color}"></div>
							<span class="text-surface-500">{item.label}: {item.count}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Additional Risk Indicators -->
		<div class="mb-4 grid grid-cols-2 gap-3">
			<div class="rounded-lg bg-surface-200-800 p-3">
				<div class="flex items-center gap-2 text-xs text-surface-500">
					<Clock class="h-3 w-3" />
					<span>Overdue ARC</span>
				</div>
				<p class="mt-1 text-lg font-bold">{data.overdueArcRequests}</p>
			</div>
			<div class="rounded-lg bg-surface-200-800 p-3">
				<div class="flex items-center gap-2 text-xs text-surface-500">
					<ClipboardList class="h-3 w-3" />
					<span>Long-Running WOs</span>
				</div>
				<p class="mt-1 text-lg font-bold">{data.longRunningWorkOrders}</p>
			</div>
		</div>

		<a
			href="/app/cam/violations"
			class="flex items-center justify-between rounded-lg border border-surface-300-700 px-3 py-2 text-sm transition-colors hover:bg-surface-200-800"
		>
			<span>View all violations</span>
			<ChevronRight class="h-4 w-4 text-surface-400" />
		</a>
	</div>

	<!-- Repeat Offenders -->
	{#if data.repeatViolationsByUnit.length > 0}
		<div class="border-t border-surface-300-700 p-6">
			<div class="mb-3 flex items-center gap-2 text-sm font-medium">
				<UserX class="h-4 w-4 text-warning-500" />
				<span>Repeat Offenders</span>
			</div>
			<div class="space-y-2">
				{#each data.repeatViolationsByUnit.slice(0, 5) as offender}
					<a
						href="/app/cam/units/{offender.unitId}"
						class="flex items-center justify-between rounded-lg bg-surface-200-800 px-3 py-2 text-sm transition-colors hover:bg-surface-300-700"
					>
						<div>
							<span class="font-medium">Unit {offender.unitNumber}</span>
							{#if offender.ownerName}
								<span class="text-surface-500"> · {offender.ownerName}</span>
							{/if}
						</div>
						<span class="rounded-full bg-warning-500/10 px-2 py-0.5 text-xs font-medium text-warning-500">
							{offender.violationCount} violations
						</span>
					</a>
				{/each}
			</div>
		</div>
	{/if}
</Card>
