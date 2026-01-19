<script lang="ts">
	import { ARCRequestStatusValues, BidStatusValues, InvoiceStatusValues } from '$lib/api/cam';
	import { Shield, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';

	interface Props {
		workOrderId: string;
		workOrderNumber: string;
		title: string;
		approvedAmount?: string | number;
		requiresBoardApproval: boolean;
		boardApprovalStatus?: string;
		boardApprovalVoteId?: string;
		onRequestApproval?: () => void;
		onRecordDecision?: (approved: boolean) => void;
	}

	let {
		workOrderId,
		workOrderNumber,
		title,
		approvedAmount,
		requiresBoardApproval,
		boardApprovalStatus,
		boardApprovalVoteId,
		onRequestApproval,
		onRecordDecision
	}: Props = $props();

	function getStatusColor(status?: string): string {
		switch (status) {
			case InvoiceStatusValues.APPROVED: return 'text-success-600 bg-success-600/10';
			case ARCRequestStatusValues.DENIED: return 'text-error-600 bg-error-600/10';
			case BidStatusValues.PENDING: return 'text-warning-600 bg-warning-600/10';
			default: return 'text-surface-500 bg-surface-500/10';
		}
	}

	function getStatusIcon(status?: string) {
		switch (status) {
			case InvoiceStatusValues.APPROVED: return CheckCircle;
			case ARCRequestStatusValues.DENIED: return XCircle;
			case BidStatusValues.PENDING: return Clock;
			default: return AlertTriangle;
		}
	}

	const StatusIcon = $derived(getStatusIcon(boardApprovalStatus));
	const formattedAmount = $derived(
		approvedAmount 
			? `$${Number(approvedAmount).toLocaleString()}` 
			: 'Not specified'
	);
</script>

{#if requiresBoardApproval}
	<Card variant="outlined" padding="md">
		<div class="flex items-start gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/10">
				<Shield class="h-5 w-5 text-purple-600" />
			</div>
			<div class="flex-1">
				<h4 class="font-semibold text-purple-600">Board Approval Required</h4>
				<p class="mt-1 text-sm text-surface-500">
					This work order requires board approval due to budget threshold.
				</p>

				<div class="mt-3 rounded-lg bg-surface-100-900 p-3">
					<div class="grid gap-2 text-sm">
						<div class="flex justify-between">
							<span class="text-surface-500">Work Order:</span>
							<span class="font-medium">{workOrderNumber}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-surface-500">Amount:</span>
							<span class="font-medium">{formattedAmount}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-surface-500">Status:</span>
							<span class="flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium {getStatusColor(boardApprovalStatus)}">
								{#if boardApprovalStatus === InvoiceStatusValues.APPROVED}
									<CheckCircle class="h-3.5 w-3.5" />
								{:else if boardApprovalStatus === ARCRequestStatusValues.DENIED}
									<XCircle class="h-3.5 w-3.5" />
								{:else if boardApprovalStatus === BidStatusValues.PENDING}
									<Clock class="h-3.5 w-3.5" />
								{:else}
									<AlertTriangle class="h-3.5 w-3.5" />
								{/if}
								{boardApprovalStatus || 'Not Submitted'}
							</span>
						</div>
					</div>
				</div>

				{#if !boardApprovalVoteId && boardApprovalStatus !== InvoiceStatusValues.APPROVED && boardApprovalStatus !== ARCRequestStatusValues.DENIED}
					<div class="mt-4">
						<button
							type="button"
							onclick={onRequestApproval}
							class="btn btn-sm preset-filled-primary-500"
						>
							<Shield class="mr-1.5 h-4 w-4" />
							Request Board Approval
						</button>
						<p class="mt-1.5 text-xs text-surface-400">
							This will create a vote item for the next board meeting.
						</p>
					</div>
				{/if}

				{#if boardApprovalStatus === BidStatusValues.PENDING && boardApprovalVoteId}
					<div class="mt-4 flex gap-2">
						<button
							type="button"
							onclick={() => onRecordDecision?.(true)}
							class="btn btn-sm preset-filled-success-500"
						>
							<CheckCircle class="mr-1.5 h-4 w-4" />
							Record Approval
						</button>
						<button
							type="button"
							onclick={() => onRecordDecision?.(false)}
							class="btn btn-sm preset-filled-error-500"
						>
							<XCircle class="mr-1.5 h-4 w-4" />
							Record Denial
						</button>
					</div>
				{/if}

				{#if boardApprovalStatus === InvoiceStatusValues.APPROVED}
					<div class="mt-4 flex items-center gap-2 text-success-600">
						<CheckCircle class="h-5 w-5" />
						<span class="font-medium">Board has approved this work order</span>
					</div>
				{/if}

				{#if boardApprovalStatus === ARCRequestStatusValues.DENIED}
					<div class="mt-4 flex items-center gap-2 text-error-600">
						<XCircle class="h-5 w-5" />
						<span class="font-medium">Board has denied this work order</span>
					</div>
				{/if}
			</div>
		</div>
	</Card>
{/if}
