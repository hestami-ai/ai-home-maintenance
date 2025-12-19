<script lang="ts">
	import { Calendar, User, Home, Clock, AlertCircle } from 'lucide-svelte';
	import CaseStatusBadge from './CaseStatusBadge.svelte';
	import CasePriorityBadge from './CasePriorityBadge.svelte';
	import WaitingOnIndicator from './WaitingOnIndicator.svelte';
	import type { ConciergeCaseDetail } from '$lib/api/cam';

	interface Props {
		caseDetail: ConciergeCaseDetail;
	}

	let { caseDetail }: Props = $props();

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function getBlockingReason(): string | null {
		switch (caseDetail.case.status) {
			case 'PENDING_OWNER':
				return 'Waiting for owner to respond to clarification request';
			case 'PENDING_EXTERNAL':
				return 'Waiting for external party (HOA, vendor, etc.)';
			case 'ON_HOLD':
				return 'Case is on hold';
			default:
				return null;
		}
	}

	const blockingReason = $derived(getBlockingReason());
</script>

<div class="space-y-6">
	<!-- Status & Priority -->
	<div class="flex flex-wrap items-center gap-3">
		<CaseStatusBadge status={caseDetail.case.status} size="lg" />
		<CasePriorityBadge priority={caseDetail.case.priority} size="md" />
		<WaitingOnIndicator status={caseDetail.case.status} />
	</div>

	<!-- Blocking Indicator -->
	{#if blockingReason}
		<div class="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
			<div class="flex items-center gap-3">
				<AlertCircle class="h-5 w-5 text-amber-500 shrink-0" />
				<div>
					<p class="font-medium text-amber-600 dark:text-amber-400">What's Blocking Progress</p>
					<p class="text-sm text-surface-600 dark:text-surface-400">{blockingReason}</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Owner Intent -->
	<div>
		<h3 class="text-sm font-medium text-surface-500 uppercase tracking-wide">Owner Intent</h3>
		<div class="mt-2 rounded-lg bg-surface-100-900 p-4">
			<p class="font-medium">{caseDetail.case.title}</p>
			<p class="mt-2 text-sm whitespace-pre-wrap text-surface-600 dark:text-surface-400">
				{caseDetail.case.description}
			</p>
		</div>
	</div>

	<!-- Key Information Grid -->
	<div class="grid gap-4 sm:grid-cols-2">
		<!-- Property -->
		<div class="rounded-lg border border-surface-300-700 p-4">
			<div class="flex items-center gap-2 text-surface-500">
				<Home size={16} />
				<span class="text-xs font-medium uppercase tracking-wide">Property</span>
			</div>
			<p class="mt-2 font-medium">{caseDetail.property.name}</p>
			<p class="text-sm text-surface-500">
				{caseDetail.property.addressLine1}
				{#if caseDetail.property.city}
					<br />{caseDetail.property.city}, {caseDetail.property.state} {caseDetail.property.postalCode}
				{/if}
			</p>
		</div>

		<!-- Assigned Concierge -->
		<div class="rounded-lg border border-surface-300-700 p-4">
			<div class="flex items-center gap-2 text-surface-500">
				<User size={16} />
				<span class="text-xs font-medium uppercase tracking-wide">Assigned Concierge</span>
			</div>
			{#if caseDetail.case.assignedConciergeName}
				<p class="mt-2 font-medium">{caseDetail.case.assignedConciergeName}</p>
			{:else}
				<p class="mt-2 text-surface-500 italic">Unassigned</p>
			{/if}
		</div>

		<!-- Created -->
		<div class="rounded-lg border border-surface-300-700 p-4">
			<div class="flex items-center gap-2 text-surface-500">
				<Calendar size={16} />
				<span class="text-xs font-medium uppercase tracking-wide">Created</span>
			</div>
			<p class="mt-2 font-medium">{formatDate(caseDetail.case.createdAt)}</p>
		</div>

		<!-- Last Updated -->
		<div class="rounded-lg border border-surface-300-700 p-4">
			<div class="flex items-center gap-2 text-surface-500">
				<Clock size={16} />
				<span class="text-xs font-medium uppercase tracking-wide">Last Updated</span>
			</div>
			<p class="mt-2 font-medium">{formatDate(caseDetail.case.updatedAt)}</p>
		</div>
	</div>

	<!-- Origin Intent -->
	{#if caseDetail.originIntent}
		<div>
			<h3 class="text-sm font-medium text-surface-500 uppercase tracking-wide">Origin Intent</h3>
			<div class="mt-2 rounded-lg border border-surface-300-700 p-4">
				<p class="font-medium">{caseDetail.originIntent.title}</p>
				<p class="mt-1 text-sm text-surface-500">{caseDetail.originIntent.description}</p>
				{#if caseDetail.originIntent.status}
					<p class="mt-2 text-xs text-surface-500">
						Status: {caseDetail.originIntent.status}
					</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
