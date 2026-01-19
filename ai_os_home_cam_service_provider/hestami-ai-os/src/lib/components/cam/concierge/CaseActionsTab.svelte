<script lang="ts">
	import { JobPaymentStatusValues, JobStatusValues } from '$lib/api/cam';
	import { Play, CheckCircle, Clock, AlertCircle } from 'lucide-svelte';
	import LinkedEntityCard from './LinkedEntityCard.svelte';
	import { EmptyState } from '$lib/components/ui';
	import type { ConciergeCaseDetail } from '$lib/api/cam';

	interface Props {
		caseDetail: ConciergeCaseDetail;
	}

	let { caseDetail }: Props = $props();

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function getActionStatusIcon(status: string) {
		switch (status) {
			case JobStatusValues.COMPLETED:
				return CheckCircle;
			case JobStatusValues.IN_PROGRESS:
				return Play;
			case JobPaymentStatusValues.PENDING:
				return Clock;
			default:
				return AlertCircle;
		}
	}

	function getActionStatusColor(status: string): string {
		switch (status) {
			case JobStatusValues.COMPLETED:
				return 'text-green-500';
			case JobStatusValues.IN_PROGRESS:
				return 'text-amber-500';
			case JobPaymentStatusValues.PENDING:
				return 'text-surface-500';
			default:
				return 'text-surface-500';
		}
	}

	const hasLinkedEntities = $derived(
		caseDetail.case.linkedArcRequestId ||
		caseDetail.case.linkedWorkOrderId ||
		caseDetail.case.linkedUnitId ||
		caseDetail.case.linkedJobId
	);
</script>

<div class="space-y-6">
	<!-- Linked Entities -->
	<div>
		<h3 class="text-sm font-medium text-surface-500 uppercase tracking-wide mb-4">
			Linked Workflows
		</h3>
		{#if hasLinkedEntities}
			<div class="space-y-3">
				{#if caseDetail.case.linkedArcRequestId}
					<LinkedEntityCard
						type="arc"
						id={caseDetail.case.linkedArcRequestId}
						href="/app/cam/arc/{caseDetail.case.linkedArcRequestId}"
					/>
				{/if}
				{#if caseDetail.case.linkedWorkOrderId}
					<LinkedEntityCard
						type="work_order"
						id={caseDetail.case.linkedWorkOrderId}
						href="/app/cam/work-orders/{caseDetail.case.linkedWorkOrderId}"
					/>
				{/if}
				{#if caseDetail.case.linkedUnitId}
					<LinkedEntityCard
						type="unit"
						id={caseDetail.case.linkedUnitId}
						href="/app/cam/units/{caseDetail.case.linkedUnitId}"
					/>
				{/if}
				{#if caseDetail.case.linkedJobId}
					<LinkedEntityCard
						type="job"
						id={caseDetail.case.linkedJobId}
						href="/app/jobs/{caseDetail.case.linkedJobId}"
					/>
				{/if}
			</div>
		{:else}
			<div class="rounded-lg border border-dashed border-surface-300-700 p-4 text-center">
				<p class="text-sm text-surface-500">No linked workflows yet</p>
			</div>
		{/if}
	</div>

	<!-- Actions List -->
	<div>
		<h3 class="text-sm font-medium text-surface-500 uppercase tracking-wide mb-4">
			Coordination Actions
		</h3>
		{#if caseDetail.actions.length === 0}
			<EmptyState
				title="No actions yet"
				description="Coordination actions and external communications will appear here."
			/>
		{:else}
			<div class="space-y-3">
				{#each caseDetail.actions as action}
					{@const StatusIcon = getActionStatusIcon(action.status)}
					<div class="rounded-lg border border-surface-300-700 p-4">
						<div class="flex items-start justify-between gap-3">
							<div class="flex items-start gap-3">
								<div class="mt-0.5">
									<StatusIcon size={18} class={getActionStatusColor(action.status)} />
								</div>
								<div>
									<p class="font-medium">{action.description}</p>
									<p class="text-sm text-surface-500">
										{action.actionType.replace(/_/g, ' ')}
									</p>
								</div>
							</div>
							<div class="text-right text-sm">
								<span class="font-medium {getActionStatusColor(action.status)}">
									{action.status}
								</span>
								{#if action.plannedAt}
									<p class="text-xs text-surface-500">
										Planned: {formatDate(action.plannedAt)}
									</p>
								{/if}
								{#if action.completedAt}
									<p class="text-xs text-surface-500">
										Completed: {formatDate(action.completedAt)}
									</p>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
