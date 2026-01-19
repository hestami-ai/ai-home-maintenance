<script lang="ts">
	import { ActivityEntityTypeValues, PillarAccessValues } from '$lib/api/cam';
	import {
		Inbox,
		AlertTriangle,
		Clock,
		Filter,
		RefreshCw,
		ChevronRight,
		Loader2,
		AlertCircle,
		CheckCircle,
		FileText,
		Wrench,
		Gavel,
		Home
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import {
		workQueueApi,
		PILLAR_LABELS,
		URGENCY_LABELS,
		ITEM_TYPE_LABELS,
		getItemRoute,
		type WorkQueueItem,
		type WorkQueuePillar,
		type WorkQueueUrgency,
		type WorkQueueSummary
	} from '$lib/api/workQueue';

	interface Props {
		data: {
			items: WorkQueueItem[];
			summary: WorkQueueSummary | null;
			filters: {
				pillar: WorkQueuePillar;
				urgency: WorkQueueUrgency | '';
				assignedToMe: boolean;
				unassignedOnly: boolean;
			};
		};
	}

	let { data }: Props = $props();

	// Use $state with $effect and untrack to avoid proxy errors during navigation
	let items = $state<WorkQueueItem[]>([]);
	let summary = $state<WorkQueueSummary | null>(null);
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	// Filters - sync from server data via $effect
	let pillarFilter = $state<WorkQueuePillar>('ALL');
	let urgencyFilter = $state<WorkQueueUrgency | ''>('');
	let assignedToMeFilter = $state(false);
	let unassignedOnlyFilter = $state(false);

	// Sync all data from props
	// Track data to trigger re-runs on navigation, but guard against undefined
	$effect(() => {
		if (data != null && typeof data === 'object') {
			items = data.items ?? [];
			summary = data.summary ?? null;
			pillarFilter = data.filters?.pillar ?? 'ALL';
			urgencyFilter = data.filters?.urgency ?? '';
			assignedToMeFilter = data.filters?.assignedToMe ?? false;
			unassignedOnlyFilter = data.filters?.unassignedOnly ?? false;
		}
	});

	// Navigate with new filter params
	function applyFilter(filterName: string, value: string | boolean) {
		const params = new URLSearchParams();
		
		// Start with current filter values
		const newPillar = filterName === 'pillar' ? value as string : pillarFilter;
		const newUrgency = filterName === 'urgency' ? value as string : urgencyFilter;
		const newAssignedToMe = filterName === 'assignedToMe' ? value as boolean : assignedToMeFilter;
		const newUnassignedOnly = filterName === 'unassignedOnly' ? value as boolean : unassignedOnlyFilter;
		
		if (newPillar !== 'ALL') params.set('pillar', newPillar);
		if (newUrgency) params.set('urgency', newUrgency);
		if (newAssignedToMe) params.set('assignedToMe', 'true');
		if (newUnassignedOnly) params.set('unassignedOnly', 'true');
		
		const url = `/app/admin/work-queue?${params.toString()}`;
		window.location.href = url;
	}

	function refreshPage() {
		window.location.reload();
	}

	function getUrgencyBadgeClass(urgency: WorkQueueUrgency): string {
		const colorMap: Record<WorkQueueUrgency, string> = {
			CRITICAL: 'preset-filled-error-500',
			HIGH: 'preset-filled-warning-500',
			NORMAL: 'preset-filled-primary-500',
			LOW: 'preset-filled-surface-500'
		};
		return colorMap[urgency] || 'preset-filled-surface-500';
	}

	function getItemIcon(itemType: string) {
		switch (itemType) {
			case ActivityEntityTypeValues.CONCIERGE_CASE:
				return Home;
			case ActivityEntityTypeValues.WORK_ORDER:
				return Wrench;
			case ActivityEntityTypeValues.VIOLATION:
				return AlertTriangle;
			case ActivityEntityTypeValues.ARC_REQUEST:
				return FileText;
			default:
				return Inbox;
		}
	}

	function getPillarBadgeClass(pillar: string): string {
		switch (pillar) {
			case PillarAccessValues.CONCIERGE:
				return 'preset-outlined-primary-500';
			case PillarAccessValues.CAM:
				return 'preset-outlined-secondary-500';
			case ActivityEntityTypeValues.CONTRACTOR:
				return 'preset-outlined-tertiary-500';
			default:
				return 'preset-outlined-surface-500';
		}
	}


</script>

<svelte:head>
	<title>Work Queue | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-6">
		<!-- Header -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold">Work Queue</h1>
				<p class="mt-1 text-surface-500">Items requiring attention across all pillars</p>
			</div>
			<button onclick={refreshPage} class="btn preset-outlined-primary-500" disabled={isLoading}>
				{#if isLoading}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{:else}
					<RefreshCw class="mr-2 h-4 w-4" />
				{/if}
				Refresh
			</button>
		</div>

		<!-- Summary Cards -->
		{#if summary}
			<div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
				<Card variant="outlined" padding="md">
					<div class="flex items-center gap-3">
						<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-500/10">
							<Inbox class="h-5 w-5 text-surface-500" />
						</div>
						<div>
							<p class="text-2xl font-bold">{summary.total}</p>
							<p class="text-sm text-surface-500">Total Items</p>
						</div>
					</div>
				</Card>
				<Card variant="outlined" padding="md">
					<div class="flex items-center gap-3">
						<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-error-500/10">
							<AlertCircle class="h-5 w-5 text-error-500" />
						</div>
						<div>
							<p class="text-2xl font-bold">{summary.critical}</p>
							<p class="text-sm text-surface-500">Critical</p>
						</div>
					</div>
				</Card>
				<Card variant="outlined" padding="md">
					<div class="flex items-center gap-3">
						<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-500/10">
							<AlertTriangle class="h-5 w-5 text-warning-500" />
						</div>
						<div>
							<p class="text-2xl font-bold">{summary.high}</p>
							<p class="text-sm text-surface-500">High Priority</p>
						</div>
					</div>
				</Card>
				<Card variant="outlined" padding="md">
					<div class="flex items-center gap-3">
						<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10">
							<CheckCircle class="h-5 w-5 text-primary-500" />
						</div>
						<div>
							<p class="text-2xl font-bold">{summary.normal}</p>
							<p class="text-sm text-surface-500">Normal</p>
						</div>
					</div>
				</Card>
				<Card variant="outlined" padding="md">
					<div class="flex items-center gap-3">
						<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-500/10">
							<Clock class="h-5 w-5 text-secondary-500" />
						</div>
						<div>
							<p class="text-2xl font-bold">{summary.unassigned}</p>
							<p class="text-sm text-surface-500">Unassigned</p>
						</div>
					</div>
				</Card>
			</div>
		{/if}

		<!-- Filters -->
		<div class="mt-6 flex flex-wrap items-center gap-4">
			<div class="flex items-center gap-2">
				<Filter class="h-4 w-4 text-surface-400" />
				<span class="text-sm font-medium">Filters:</span>
			</div>
			<select 
				value={pillarFilter} 
				onchange={(e) => applyFilter('pillar', e.currentTarget.value)}
				class="select w-40"
			>
				<option value="ALL">All Pillars</option>
				<option value=PillarAccessValues.CONCIERGE>Concierge</option>
				<option value=PillarAccessValues.CAM>CAM</option>
				<option value=ActivityEntityTypeValues.CONTRACTOR>Contractor</option>
			</select>
			<select 
				value={urgencyFilter} 
				onchange={(e) => applyFilter('urgency', e.currentTarget.value)}
				class="select w-36"
			>
				<option value="">All Urgency</option>
				<option value="CRITICAL">Critical</option>
				<option value="HIGH">High</option>
				<option value="NORMAL">Normal</option>
				<option value="LOW">Low</option>
			</select>
			<label class="flex items-center gap-2">
				<input 
					type="checkbox" 
					checked={assignedToMeFilter} 
					onchange={(e) => applyFilter('assignedToMe', e.currentTarget.checked)}
					class="checkbox" 
				/>
				<span class="text-sm">Assigned to me</span>
			</label>
			<label class="flex items-center gap-2">
				<input 
					type="checkbox" 
					checked={unassignedOnlyFilter} 
					onchange={(e) => applyFilter('unassignedOnly', e.currentTarget.checked)}
					class="checkbox" 
				/>
				<span class="text-sm">Unassigned only</span>
			</label>
		</div>

		<!-- Work Queue List -->
		<div class="mt-6">
			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-primary-500" />
				</div>
			{:else if error}
				<Card variant="outlined" padding="lg">
					<div class="text-center text-error-500">
						<p>{error}</p>
						<button onclick={refreshPage} class="btn preset-outlined-primary-500 mt-4">
							Try Again
						</button>
					</div>
				</Card>
			{:else if items.length === 0}
				<Card variant="outlined" padding="lg">
					<EmptyState
						title="No items in queue"
						description="All caught up! There are no items requiring attention."
					/>
				</Card>
			{:else}
				<div class="space-y-3">
					{#each items as item}
						{@const ItemIcon = getItemIcon(item.itemType)}
						<a
							href={getItemRoute(item.itemType, item.itemId)}
							class="block rounded-lg border border-surface-300-700 bg-surface-50-950 p-4 transition-all hover:border-primary-500 hover:shadow-md"
						>
							<div class="flex items-start gap-4">
								<!-- Icon -->
								<div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface-200-800">
									<ItemIcon class="h-5 w-5 text-surface-600 dark:text-surface-400" />
								</div>

								<!-- Content -->
								<div class="min-w-0 flex-1">
									<div class="flex items-start justify-between gap-4">
										<div class="min-w-0">
											<div class="flex flex-wrap items-center gap-2">
												<span class="badge {getPillarBadgeClass(item.pillar)} text-xs">
													{item.pillar}
												</span>
												<span class="badge preset-outlined-surface-500 text-xs">
													{ITEM_TYPE_LABELS[item.itemType] || item.itemType}
												</span>
												<span class="text-sm text-surface-500">{item.itemNumber}</span>
											</div>
											<h3 class="mt-1 font-medium truncate">{item.title}</h3>
											<p class="mt-1 text-sm text-surface-500">
												{item.requiredAction}
											</p>
										</div>
										<div class="flex flex-shrink-0 flex-col items-end gap-2">
											<span class="badge {getUrgencyBadgeClass(item.urgency as WorkQueueUrgency)}">
												{URGENCY_LABELS[item.urgency as WorkQueueUrgency]}
											</span>
											<div class="flex items-center gap-1 text-xs text-surface-400">
												<Clock class="h-3 w-3" />
												<span>{item.timeInStateFormatted}</span>
											</div>
										</div>
									</div>

									<!-- Footer -->
									<div class="mt-3 flex flex-wrap items-center gap-4 text-xs text-surface-500">
										{#if item.propertyName}
											<span>Property: {item.propertyName}</span>
										{/if}
										{#if item.associationName}
											<span>Association: {item.associationName}</span>
										{/if}
										{#if item.assignedToName}
											<span>Assigned: {item.assignedToName}</span>
										{:else}
											<span class="text-warning-500">Unassigned</span>
										{/if}
										<span>State: {item.currentState}</span>
									</div>
								</div>

								<!-- Arrow -->
								<ChevronRight class="h-5 w-5 flex-shrink-0 text-surface-400" />
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</PageContainer>
