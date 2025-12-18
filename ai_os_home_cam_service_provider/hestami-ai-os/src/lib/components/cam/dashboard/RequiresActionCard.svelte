<script lang="ts">
	import { ClipboardCheck, AlertTriangle, Wrench, Gavel, ChevronRight, Clock } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import type { DashboardRequiresAction } from '$lib/api/cam';

	interface Props {
		data: DashboardRequiresAction;
	}

	let { data }: Props = $props();

	const totalActions = $derived(
		data.pendingArc.count +
		data.escalatedViolations.total +
		data.workOrdersAwaitingAuth.count +
		data.governancePending.meetingsNeedingMinutes +
		data.governancePending.motionsAwaitingVote
	);
</script>

<Card variant="outlined" padding="none">
	<div class="border-b border-surface-300-700 px-6 py-4">
		<div class="flex items-center justify-between">
			<h2 class="font-semibold">Requires Action</h2>
			{#if totalActions > 0}
				<span class="flex h-6 min-w-6 items-center justify-center rounded-full bg-error-500 px-2 text-xs font-semibold text-white">
					{totalActions}
				</span>
			{/if}
		</div>
	</div>
	<div class="divide-y divide-surface-300-700">
		<!-- Pending ARC Decisions -->
		<a
			href="/app/cam/arc?status=SUBMITTED,UNDER_REVIEW"
			class="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-surface-200-800"
		>
			<div class="flex h-10 w-10 items-center justify-center rounded-lg text-warning-500 bg-warning-500/10">
				<ClipboardCheck class="h-5 w-5" />
			</div>
			<div class="flex-1">
				<p class="text-sm font-medium">Pending ARC Decisions</p>
				<p class="text-2xl font-bold">{data.pendingArc.count}</p>
				{#if data.pendingArc.oldestAgeDays > 0}
					<p class="flex items-center gap-1 text-xs text-surface-500">
						<Clock class="h-3 w-3" />
						Oldest: {data.pendingArc.oldestAgeDays} days
					</p>
				{/if}
			</div>
			<ChevronRight class="h-5 w-5 text-surface-400" />
		</a>

		<!-- Escalated Violations -->
		<a
			href="/app/cam/violations?status=ESCALATED"
			class="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-surface-200-800"
		>
			<div class="flex h-10 w-10 items-center justify-center rounded-lg text-error-500 bg-error-500/10">
				<AlertTriangle class="h-5 w-5" />
			</div>
			<div class="flex-1">
				<p class="text-sm font-medium">Escalated Violations</p>
				<p class="text-2xl font-bold">{data.escalatedViolations.total}</p>
				{#if data.escalatedViolations.total > 0}
					<div class="flex gap-2 text-xs">
						{#if data.escalatedViolations.bySeverity.critical > 0}
							<span class="text-error-500">{data.escalatedViolations.bySeverity.critical} critical</span>
						{/if}
						{#if data.escalatedViolations.bySeverity.major > 0}
							<span class="text-warning-500">{data.escalatedViolations.bySeverity.major} major</span>
						{/if}
					</div>
				{/if}
			</div>
			<ChevronRight class="h-5 w-5 text-surface-400" />
		</a>

		<!-- Work Orders Awaiting Authorization -->
		<a
			href="/app/cam/work-orders?status=SUBMITTED&requiresBoardApproval=true"
			class="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-surface-200-800"
		>
			<div class="flex h-10 w-10 items-center justify-center rounded-lg text-primary-500 bg-primary-500/10">
				<Wrench class="h-5 w-5" />
			</div>
			<div class="flex-1">
				<p class="text-sm font-medium">Work Orders Awaiting Authorization</p>
				<p class="text-2xl font-bold">{data.workOrdersAwaitingAuth.count}</p>
				{#if data.workOrdersAwaitingAuth.hasBudgetExceptions}
					<p class="text-xs text-warning-500">⚠ Budget exceptions present</p>
				{/if}
			</div>
			<ChevronRight class="h-5 w-5 text-surface-400" />
		</a>

		<!-- Governance Actions Pending -->
		<a
			href="/app/cam/governance"
			class="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-surface-200-800"
		>
			<div class="flex h-10 w-10 items-center justify-center rounded-lg text-secondary-500 bg-secondary-500/10">
				<Gavel class="h-5 w-5" />
			</div>
			<div class="flex-1">
				<p class="text-sm font-medium">Governance Actions Pending</p>
				<p class="text-2xl font-bold">{data.governancePending.meetingsNeedingMinutes + data.governancePending.motionsAwaitingVote}</p>
				<div class="flex gap-2 text-xs text-surface-500">
					{#if data.governancePending.meetingsNeedingMinutes > 0}
						<span>{data.governancePending.meetingsNeedingMinutes} minutes pending</span>
					{/if}
					{#if data.governancePending.motionsAwaitingVote > 0}
						<span>{data.governancePending.motionsAwaitingVote} motions awaiting vote</span>
					{/if}
				</div>
			</div>
			<ChevronRight class="h-5 w-5 text-surface-400" />
		</a>
	</div>
</Card>
