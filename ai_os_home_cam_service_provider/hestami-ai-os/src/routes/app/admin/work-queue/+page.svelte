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
		Home,
		UserPlus,
		CheckSquare,
		Square,
		Users,
		X,
		Activity
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import { Select } from 'flowbite-svelte';
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
	import { orpc } from '$lib/api/orpc';

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
			currentUserId: string | null;
		};
	}

	let { data }: Props = $props();

	// Use $state with $effect and untrack to avoid proxy errors during navigation
	let items = $state<WorkQueueItem[]>([]);
	let summary = $state<WorkQueueSummary | null>(null);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let currentUserId = $state<string | null>(null);

	// Claim state
	let claimingItemId = $state<string | null>(null);
	let claimError = $state<string | null>(null);

	// Bulk selection state
	let selectedItemIds = $state<Set<string>>(new Set());
	let isBulkMode = $state(false);

	// Bulk reassign modal state
	let showBulkReassignModal = $state(false);
	let staffMembers = $state<Array<{ id: string; userId: string; displayName: string }>>([]);
	let isLoadingStaff = $state(false);
	let selectedStaffUserId = $state<string | null>(null);
	let isBulkReassigning = $state(false);
	let bulkReassignError = $state<string | null>(null);

	// Polling state
	let pollingInterval: ReturnType<typeof setInterval> | null = null;
	let lastItemCount = $state(0);
	let hasNewItems = $state(false);

	// Derived: count of selected items
	const selectedCount = $derived(selectedItemIds.size);

	// Derived: can we bulk reassign? (only concierge cases supported)
	const canBulkReassign = $derived(() => {
		if (selectedItemIds.size === 0) return false;
		// Check if all selected items are concierge cases
		return items
			.filter(item => selectedItemIds.has(item.itemId))
			.every(item => item.itemType === ActivityEntityTypeValues.CONCIERGE_CASE);
	});

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
			currentUserId = data.currentUserId ?? null;
			// Track item count for change detection
			lastItemCount = items.length;
		}
	});

	// Auto-refresh reminder effect - show reminder after 2 minutes of inactivity
	$effect(() => {
		// Start reminder interval
		pollingInterval = setInterval(() => {
			// After 2 minutes, suggest the user refresh to see latest data
			if (!isLoading && items.length > 0) {
				hasNewItems = true;
			}
		}, 120000); // 2 minutes

		// Cleanup on destroy
		return () => {
			if (pollingInterval) {
				clearInterval(pollingInterval);
				pollingInterval = null;
			}
		};
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

	/**
	 * Claim an unassigned work item by assigning it to the current user
	 */
	async function handleClaimItem(item: WorkQueueItem, event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();

		if (!currentUserId) {
			claimError = 'You must be logged in to claim items';
			return;
		}

		// Only concierge cases can be claimed via this mechanism
		if (item.itemType !== ActivityEntityTypeValues.CONCIERGE_CASE) {
			claimError = 'Only concierge cases can be claimed from this view';
			return;
		}

		claimingItemId = item.itemId;
		claimError = null;

		try {
			const response = await orpc.staffConciergeCase.assign({
				id: item.itemId,
				assignedConciergeUserId: currentUserId,
				idempotencyKey: crypto.randomUUID()
			});

			if (response.ok) {
				// Update the local item to reflect the claim
				const itemIndex = items.findIndex(i => i.itemId === item.itemId);
				if (itemIndex !== -1) {
					// Remove item from list since it's now assigned (if filtering by unassigned)
					// Or update the assigned name if showing all
					if (unassignedOnlyFilter) {
						items = items.filter(i => i.itemId !== item.itemId);
						// Update summary counts
						if (summary) {
							summary = {
								...summary,
								unassigned: Math.max(0, summary.unassigned - 1)
							};
						}
					} else {
						// Just refresh to get updated assignment info
						refreshPage();
					}
				}
			}
		} catch (e) {
			claimError = e instanceof Error ? e.message : 'Failed to claim item';
		} finally {
			claimingItemId = null;
		}
	}

	/**
	 * Check if an item can be claimed
	 */
	function canClaimItem(item: WorkQueueItem): boolean {
		return (
			!item.assignedToName &&
			currentUserId !== null &&
			item.itemType === ActivityEntityTypeValues.CONCIERGE_CASE
		);
	}

	/**
	 * Toggle bulk selection mode
	 */
	function toggleBulkMode() {
		isBulkMode = !isBulkMode;
		if (!isBulkMode) {
			selectedItemIds = new Set();
		}
	}

	/**
	 * Toggle selection of a single item
	 */
	function toggleItemSelection(itemId: string, event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		const newSet = new Set(selectedItemIds);
		if (newSet.has(itemId)) {
			newSet.delete(itemId);
		} else {
			newSet.add(itemId);
		}
		selectedItemIds = newSet;
	}

	/**
	 * Select all items
	 */
	function selectAll() {
		selectedItemIds = new Set(items.map(item => item.itemId));
	}

	/**
	 * Deselect all items
	 */
	function deselectAll() {
		selectedItemIds = new Set();
	}

	/**
	 * Load staff members for reassignment
	 */
	async function loadStaffMembers() {
		if (staffMembers.length > 0) return;
		isLoadingStaff = true;
		try {
			const result = await orpc.orgStaff.list({ limit: 100 });
			staffMembers = result.data.staff;
		} catch (err) {
			console.error('Failed to load staff:', err);
		} finally {
			isLoadingStaff = false;
		}
	}

	/**
	 * Open bulk reassign modal
	 */
	async function openBulkReassignModal() {
		bulkReassignError = null;
		selectedStaffUserId = null;
		showBulkReassignModal = true;
		await loadStaffMembers();
	}

	/**
	 * Perform bulk reassignment
	 */
	async function performBulkReassign() {
		if (!selectedStaffUserId || selectedItemIds.size === 0 || isBulkReassigning) return;

		isBulkReassigning = true;
		bulkReassignError = null;

		try {
			const itemsToReassign = items
				.filter(item => selectedItemIds.has(item.itemId))
				.map(item => ({ itemType: item.itemType, itemId: item.itemId }));

			const response = await orpc.workQueue.bulkReassign({
				items: itemsToReassign,
				assignToUserId: selectedStaffUserId,
				idempotencyKey: crypto.randomUUID()
			});

			if (response.ok) {
				const { successCount, failureCount } = response.data;
				if (failureCount > 0) {
					bulkReassignError = `${successCount} items reassigned, ${failureCount} failed`;
				}

				// Close modal and refresh
				showBulkReassignModal = false;
				selectedItemIds = new Set();
				isBulkMode = false;
				refreshPage();
			}
		} catch (e) {
			bulkReassignError = e instanceof Error ? e.message : 'Failed to reassign items';
		} finally {
			isBulkReassigning = false;
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
			<div class="flex items-center gap-2">
				<a
					href="/app/admin/activity"
					class="btn preset-outlined-surface-500"
				>
					<Activity class="mr-2 h-4 w-4" />
					Activity Feed
				</a>
				<button
					onclick={toggleBulkMode}
					class="btn {isBulkMode ? 'preset-filled-primary-500' : 'preset-outlined-surface-500'}"
				>
					{#if isBulkMode}
						<X class="mr-2 h-4 w-4" />
						Cancel
					{:else}
						<CheckSquare class="mr-2 h-4 w-4" />
						Select
					{/if}
				</button>
				<button onclick={refreshPage} class="btn preset-outlined-primary-500" disabled={isLoading}>
					{#if isLoading}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{:else}
						<RefreshCw class="mr-2 h-4 w-4" />
					{/if}
					Refresh
				</button>
			</div>
		</div>

		<!-- New Items Notification -->
		{#if hasNewItems}
			<div class="mt-4 rounded-lg bg-primary-500/10 border border-primary-500/20 p-3 flex items-center justify-between">
				<div class="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400">
					<AlertCircle class="h-4 w-4" />
					<span>Queue has been updated. Click refresh to see the latest items.</span>
				</div>
				<button
					onclick={() => { hasNewItems = false; refreshPage(); }}
					class="btn btn-sm preset-filled-primary-500"
				>
					<RefreshCw class="mr-1 h-3 w-3" />
					Refresh Now
				</button>
			</div>
		{/if}

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
			<Select
				value={pillarFilter}
				onchange={(e) => applyFilter('pillar', e.currentTarget.value)}
				size="sm"
				class="w-40"
			>
				<option value="ALL">All Pillars</option>
				<option value={PillarAccessValues.CONCIERGE}>Concierge</option>
				<option value={PillarAccessValues.CAM}>CAM</option>
				<option value={ActivityEntityTypeValues.CONTRACTOR}>Contractor</option>
			</Select>
			<Select
				value={urgencyFilter}
				onchange={(e) => applyFilter('urgency', e.currentTarget.value)}
				size="sm"
				class="w-36"
			>
				<option value="">All Urgency</option>
				<option value="CRITICAL">Critical</option>
				<option value="HIGH">High</option>
				<option value="NORMAL">Normal</option>
				<option value="LOW">Low</option>
			</Select>
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

		<!-- Claim Error Message -->
		{#if claimError}
			<div class="mt-4 rounded-lg bg-error-500/10 border border-error-500/20 p-3 text-sm text-error-500">
				{claimError}
				<button
					onclick={() => (claimError = null)}
					class="ml-2 text-error-400 hover:text-error-600"
				>
					Dismiss
				</button>
			</div>
		{/if}

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
				<!-- Bulk Selection Actions Bar -->
				{#if isBulkMode}
					<div class="mb-4 flex items-center justify-between rounded-lg bg-surface-100-900 p-3">
						<div class="flex items-center gap-4">
							<button onclick={selectAll} class="btn btn-sm preset-outlined-surface-500">
								Select All ({items.length})
							</button>
							<button onclick={deselectAll} class="btn btn-sm preset-outlined-surface-500" disabled={selectedCount === 0}>
								Deselect All
							</button>
							<span class="text-sm text-surface-500">
								{selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected
							</span>
						</div>
						<div class="flex items-center gap-2">
							<button
								onclick={openBulkReassignModal}
								disabled={selectedCount === 0 || !canBulkReassign()}
								class="btn btn-sm preset-filled-primary-500"
							>
								<Users class="mr-1 h-4 w-4" />
								Reassign
							</button>
						</div>
					</div>
				{/if}

				<div class="space-y-3">
					{#each items as item}
						{@const ItemIcon = getItemIcon(item.itemType)}
						{@const isSelected = selectedItemIds.has(item.itemId)}
						<div
							class="rounded-lg border bg-surface-50-950 p-4 transition-all {isBulkMode
								? isSelected
									? 'border-primary-500 bg-primary-500/5'
									: 'border-surface-300-700 hover:border-surface-400'
								: 'border-surface-300-700 hover:border-primary-500 hover:shadow-md'}"
						>
							<div class="flex items-start gap-4">
								<!-- Checkbox (in bulk mode) or Icon -->
								{#if isBulkMode}
									<button
										onclick={(e) => toggleItemSelection(item.itemId, e)}
										class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg {isSelected ? 'bg-primary-500' : 'bg-surface-200-800'}"
									>
										{#if isSelected}
											<CheckSquare class="h-5 w-5 text-white" />
										{:else}
											<Square class="h-5 w-5 text-surface-400" />
										{/if}
									</button>
								{:else}
									<a href={getItemRoute(item.itemType, item.itemId)} class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface-200-800">
										<ItemIcon class="h-5 w-5 text-surface-600 dark:text-surface-400" />
									</a>
								{/if}

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
											{#if canClaimItem(item)}
												<button
													onclick={(e) => handleClaimItem(item, e)}
													disabled={claimingItemId !== null}
													class="btn btn-sm preset-filled-primary-500 py-0.5 px-2"
												>
													{#if claimingItemId === item.itemId}
														<Loader2 class="mr-1 h-3 w-3 animate-spin" />
														Claiming...
													{:else}
														<UserPlus class="mr-1 h-3 w-3" />
														Claim
													{/if}
												</button>
											{/if}
										{/if}
										<span>State: {item.currentState}</span>
									</div>
								</div>

								<!-- Arrow (only when not in bulk mode) -->
								{#if !isBulkMode}
									<a href={getItemRoute(item.itemType, item.itemId)} class="flex-shrink-0">
										<ChevronRight class="h-5 w-5 text-surface-400" />
									</a>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</PageContainer>

<!-- Bulk Reassign Modal -->
{#if showBulkReassignModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="w-full max-w-md rounded-lg bg-surface-50-950 p-6 shadow-xl">
			<h3 class="text-lg font-semibold">Bulk Reassign</h3>
			<p class="mt-1 text-sm text-surface-500">
				Reassign {selectedCount} selected {selectedCount === 1 ? 'item' : 'items'} to a staff member.
			</p>

			{#if bulkReassignError}
				<div class="mt-4 rounded-lg bg-error-500/10 border border-error-500/20 p-3 text-sm text-error-500">
					{bulkReassignError}
				</div>
			{/if}

			<div class="mt-4">
				<label for="bulkReassignStaff" class="label">Assign to *</label>
				{#if isLoadingStaff}
					<div class="flex items-center gap-2 p-2">
						<Loader2 class="h-4 w-4 animate-spin" />
						<span class="text-sm text-surface-500">Loading staff...</span>
					</div>
				{:else}
					<Select
						id="bulkReassignStaff"
						bind:value={selectedStaffUserId}
						class="w-full"
					>
						<option value="">Select staff member...</option>
						{#each staffMembers as staff}
							<option value={staff.userId}>{staff.displayName}</option>
						{/each}
					</Select>
				{/if}
			</div>

			<div class="mt-6 flex justify-end gap-3">
				<button
					onclick={() => {
						showBulkReassignModal = false;
						bulkReassignError = null;
					}}
					class="btn preset-outlined-surface-500"
				>
					Cancel
				</button>
				<button
					onclick={performBulkReassign}
					disabled={!selectedStaffUserId || isBulkReassigning}
					class="btn preset-filled-primary-500"
				>
					{#if isBulkReassigning}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Reassigning...
					{:else}
						<Users class="mr-2 h-4 w-4" />
						Reassign {selectedCount} {selectedCount === 1 ? 'Item' : 'Items'}
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
