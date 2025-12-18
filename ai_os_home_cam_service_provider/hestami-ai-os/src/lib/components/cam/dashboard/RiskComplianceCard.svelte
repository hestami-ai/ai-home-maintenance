<script lang="ts">
	import { AlertTriangle, ChevronRight, UserX } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';

	interface ViolationsBySeverity {
		critical: number;
		major: number;
		moderate: number;
		minor: number;
	}

	interface RepeatOffender {
		id: string;
		name: string;
		unitNumber: string;
		violationCount: number;
	}

	interface Props {
		violationsBySeverity: ViolationsBySeverity;
		repeatOffenders: RepeatOffender[];
	}

	let {
		violationsBySeverity = { critical: 0, major: 0, moderate: 0, minor: 0 },
		repeatOffenders = []
	}: Props = $props();

	const totalViolations = $derived(
		violationsBySeverity.critical +
		violationsBySeverity.major +
		violationsBySeverity.moderate +
		violationsBySeverity.minor
	);

	const severityItems = $derived([
		{ label: 'Critical', count: violationsBySeverity.critical, color: 'bg-error-500' },
		{ label: 'Major', count: violationsBySeverity.major, color: 'bg-warning-500' },
		{ label: 'Moderate', count: violationsBySeverity.moderate, color: 'bg-yellow-500' },
		{ label: 'Minor', count: violationsBySeverity.minor, color: 'bg-surface-400' }
	]);
</script>

<Card variant="outlined" padding="none">
	<div class="border-b border-surface-300-700 px-6 py-4">
		<h2 class="font-semibold">Risk & Compliance</h2>
	</div>

	<div class="p-6">
		<div class="mb-4">
			<div class="flex items-center justify-between text-sm">
				<span class="text-surface-500">Open Violations</span>
				<span class="font-semibold">{totalViolations}</span>
			</div>
			<div class="mt-2 flex h-3 overflow-hidden rounded-full bg-surface-200-800">
				{#each severityItems as item}
					{#if item.count > 0}
						<div
							class="{item.color} transition-all"
							style="width: {(item.count / totalViolations) * 100}%"
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
		</div>

		<a
			href="/app/cam/violations"
			class="flex items-center justify-between rounded-lg border border-surface-300-700 px-3 py-2 text-sm transition-colors hover:bg-surface-200-800"
		>
			<span>View all violations</span>
			<ChevronRight class="h-4 w-4 text-surface-400" />
		</a>
	</div>

	{#if repeatOffenders.length > 0}
		<div class="border-t border-surface-300-700 p-6">
			<div class="mb-3 flex items-center gap-2 text-sm font-medium">
				<UserX class="h-4 w-4 text-warning-500" />
				<span>Repeat Offenders</span>
			</div>
			<div class="space-y-2">
				{#each repeatOffenders.slice(0, 3) as offender}
					<a
						href="/app/cam/units/{offender.id}"
						class="flex items-center justify-between rounded-lg bg-surface-200-800 px-3 py-2 text-sm transition-colors hover:bg-surface-300-700"
					>
						<div>
							<span class="font-medium">{offender.name}</span>
							<span class="text-surface-500"> · Unit {offender.unitNumber}</span>
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
