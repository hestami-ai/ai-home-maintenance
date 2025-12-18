<script lang="ts">
	import { Wrench, Plus, Search } from 'lucide-svelte';
	import { SplitView, ListPanel, DetailPanel, TabbedContent, DecisionButton } from '$lib/components/cam';
	import { EmptyState } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';
	import { workOrderApi, type WorkOrder } from '$lib/api/cam';

	interface WorkOrderListItem extends WorkOrder {
		locationDescription?: string;
		unitNumber?: string;
		vendorName?: string;
	}

	let workOrders = $state<WorkOrder[]>([]);
	let selectedWorkOrder = $state<WorkOrder | null>(null);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let statusFilter = $state<string>('');
	let priorityFilter = $state<string>('');

	// Phase 9: Updated status options with AUTHORIZED and REVIEW_REQUIRED
	const statusOptions = [
		{ value: '', label: 'All Statuses' },
		{ value: 'DRAFT', label: 'Draft' },
		{ value: 'SUBMITTED', label: 'Submitted' },
		{ value: 'TRIAGED', label: 'Triaged' },
		{ value: 'AUTHORIZED', label: 'Authorized' },
		{ value: 'ASSIGNED', label: 'Assigned' },
		{ value: 'SCHEDULED', label: 'Scheduled' },
		{ value: 'IN_PROGRESS', label: 'In Progress' },
		{ value: 'ON_HOLD', label: 'On Hold' },
		{ value: 'COMPLETED', label: 'Completed' },
		{ value: 'REVIEW_REQUIRED', label: 'Review Required' },
		{ value: 'INVOICED', label: 'Invoiced' },
		{ value: 'CLOSED', label: 'Closed' },
		{ value: 'CANCELLED', label: 'Cancelled' }
	];

	// Phase 9: Origin type filter options
	const originTypeOptions = [
		{ value: '', label: 'All Origins' },
		{ value: 'VIOLATION_REMEDIATION', label: 'Violation' },
		{ value: 'ARC_APPROVAL', label: 'ARC Approval' },
		{ value: 'PREVENTIVE_MAINTENANCE', label: 'Preventive' },
		{ value: 'BOARD_DIRECTIVE', label: 'Board Directive' },
		{ value: 'EMERGENCY_ACTION', label: 'Emergency' },
		{ value: 'MANUAL', label: 'Manual' }
	];

	const priorityOptions = [
		{ value: '', label: 'All Priorities' },
		{ value: 'EMERGENCY', label: 'Emergency' },
		{ value: 'HIGH', label: 'High' },
		{ value: 'MEDIUM', label: 'Medium' },
		{ value: 'LOW', label: 'Low' }
	];

	async function loadWorkOrders() {
		if (!$currentAssociation?.id) return;

		isLoading = true;
		try {
			const params: { status?: string; priority?: string; search?: string } = {};
			if (statusFilter) params.status = statusFilter;
			if (priorityFilter) params.priority = priorityFilter;
			if (searchQuery) params.search = searchQuery;

			const response = await workOrderApi.list(params);
			if (response.ok && response.data?.workOrders) {
				workOrders = response.data.workOrders as WorkOrderListItem[];
			}
		} catch (error) {
			console.error('Failed to load work orders:', error);
		} finally {
			isLoading = false;
		}
	}

	function selectWorkOrder(workOrder: WorkOrder) {
		selectedWorkOrder = workOrder;
	}

	// Phase 9: Updated status colors with new states
	function getStatusColor(status: string): string {
		switch (status) {
			case 'DRAFT': return 'text-surface-500 bg-surface-500/10';
			case 'SUBMITTED': return 'text-primary-500 bg-primary-500/10';
			case 'TRIAGED': return 'text-blue-500 bg-blue-500/10';
			case 'AUTHORIZED': return 'text-green-600 bg-green-600/10';
			case 'ASSIGNED': return 'text-secondary-500 bg-secondary-500/10';
			case 'SCHEDULED': return 'text-indigo-500 bg-indigo-500/10';
			case 'IN_PROGRESS': return 'text-warning-500 bg-warning-500/10';
			case 'ON_HOLD': return 'text-orange-500 bg-orange-500/10';
			case 'COMPLETED': return 'text-success-500 bg-success-500/10';
			case 'REVIEW_REQUIRED': return 'text-amber-600 bg-amber-600/10';
			case 'INVOICED': return 'text-purple-500 bg-purple-500/10';
			case 'CLOSED': return 'text-surface-400 bg-surface-400/10';
			case 'CANCELLED': return 'text-error-500 bg-error-500/10';
			default: return 'text-surface-500 bg-surface-500/10';
		}
	}

	// Phase 9: Get origin type display label
	function getOriginTypeLabel(originType?: string): string {
		switch (originType) {
			case 'VIOLATION_REMEDIATION': return 'Violation';
			case 'ARC_APPROVAL': return 'ARC';
			case 'PREVENTIVE_MAINTENANCE': return 'Preventive';
			case 'BOARD_DIRECTIVE': return 'Board';
			case 'EMERGENCY_ACTION': return 'Emergency';
			case 'MANUAL': return 'Manual';
			default: return '-';
		}
	}

	// Phase 9: Get origin type color
	function getOriginTypeColor(originType?: string): string {
		switch (originType) {
			case 'VIOLATION_REMEDIATION': return 'text-error-600 bg-error-600/10';
			case 'ARC_APPROVAL': return 'text-blue-600 bg-blue-600/10';
			case 'PREVENTIVE_MAINTENANCE': return 'text-green-600 bg-green-600/10';
			case 'BOARD_DIRECTIVE': return 'text-purple-600 bg-purple-600/10';
			case 'EMERGENCY_ACTION': return 'text-red-600 bg-red-600/10';
			case 'MANUAL': return 'text-surface-500 bg-surface-500/10';
			default: return 'text-surface-400 bg-surface-400/10';
		}
	}

	function getPriorityColor(priority: string): string {
		switch (priority) {
			case 'EMERGENCY': return 'bg-error-500 text-white';
			case 'HIGH': return 'bg-warning-500 text-white';
			case 'MEDIUM': return 'bg-yellow-500 text-black';
			case 'LOW': return 'bg-surface-400 text-white';
			default: return 'bg-surface-300 text-surface-700';
		}
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function isOverdue(dueDate?: string, status?: string): boolean {
		if (!dueDate) return false;
		if (['COMPLETED', 'CLOSED', 'CANCELLED'].includes(status || '')) return false;
		return new Date(dueDate) < new Date();
	}

	const filteredWorkOrders = $derived(
		workOrders.filter((wo) =>
			wo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			wo.workOrderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
			(wo.unitNumber && wo.unitNumber.toLowerCase().includes(searchQuery.toLowerCase()))
		)
	);

	$effect(() => {
		if ($currentAssociation?.id) {
			loadWorkOrders();
		}
	});

	$effect(() => {
		loadWorkOrders();
	});
</script>

<svelte:head>
	<title>Work Orders | CAM | Hestami AI</title>
</svelte:head>

<SplitView hasSelection={!!selectedWorkOrder}>
	{#snippet listPanel()}
		<ListPanel loading={isLoading}>
			{#snippet header()}
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<h1 class="text-lg font-semibold">Work Orders</h1>
						<a href="/app/cam/work-orders/new" class="btn btn-sm preset-filled-primary-500">
							<Plus class="mr-1 h-4 w-4" />
							New
						</a>
					</div>

					<div class="relative">
						<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
						<input
							type="text"
							placeholder="Search work orders..."
							bind:value={searchQuery}
							class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 py-2 pl-9 pr-3 text-sm placeholder:text-surface-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>

					<div class="flex gap-2">
						<select
							bind:value={statusFilter}
							class="flex-1 rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						>
							{#each statusOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
						<select
							bind:value={priorityFilter}
							class="flex-1 rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						>
							{#each priorityOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</div>
				</div>
			{/snippet}

			{#snippet items()}
				{#if filteredWorkOrders.length === 0}
					<div class="p-6">
						<EmptyState
							title="No work orders found"
							description={searchQuery || statusFilter || priorityFilter
								? 'Try adjusting your filters.'
								: 'No work orders have been created yet.'}
						/>
					</div>
				{:else}
					<div class="divide-y divide-surface-300-700">
						{#each filteredWorkOrders as workOrder}
							{@const overdue = isOverdue(workOrder.dueDate, workOrder.status)}
							<button
								type="button"
								onclick={() => selectWorkOrder(workOrder)}
								class="w-full px-4 py-3 text-left transition-colors hover:bg-surface-200-800 {selectedWorkOrder?.id === workOrder.id ? 'bg-primary-500/10' : ''}"
							>
								<div class="flex items-start justify-between gap-2">
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<span class="text-xs font-medium text-surface-500">
												{workOrder.workOrderNumber}
											</span>
											<span class="rounded px-1.5 py-0.5 text-xs font-medium {getPriorityColor(workOrder.priority)}">
												{workOrder.priority}
											</span>
											{#if overdue}
												<span class="rounded px-1.5 py-0.5 text-xs font-medium bg-error-500 text-white">
													OVERDUE
												</span>
											{/if}
										</div>
										<p class="mt-1 truncate font-medium">{workOrder.title}</p>
										<p class="mt-0.5 text-sm text-surface-500">
											{workOrder.locationDescription}
											{#if workOrder.vendorName}
												· {workOrder.vendorName}
											{/if}
										</p>
									</div>
									<span class="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(workOrder.status)}">
										{workOrder.status.replace(/_/g, ' ')}
									</span>
								</div>
								<p class="mt-1 text-xs text-surface-400">
									{workOrder.createdAt ? formatDate(workOrder.createdAt) : ''}
									{#if workOrder.dueDate}
										· Due {formatDate(workOrder.dueDate)}
									{/if}
								</p>
							</button>
						{/each}
					</div>
				{/if}
			{/snippet}
		</ListPanel>
	{/snippet}

	{#snippet detailPanel()}
		{#if selectedWorkOrder}
			<DetailPanel>
				{#snippet header()}
					{@const wo = selectedWorkOrder!}
					<div>
						<div class="flex items-center gap-2">
							<span class="text-sm text-surface-500">{wo.workOrderNumber}</span>
							<span class="rounded px-1.5 py-0.5 text-xs font-medium {getPriorityColor(wo.priority)}">
								{wo.priority}
							</span>
							<span class="rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(wo.status)}">
								{wo.status.replace(/_/g, ' ')}
							</span>
						</div>
						<h2 class="mt-1 text-xl font-semibold">{wo.title}</h2>
					</div>
				{/snippet}

				{#snippet actions()}
					{@const wo = selectedWorkOrder!}
					{#if wo.status === 'SUBMITTED'}
						<DecisionButton variant="default">
							Assign Vendor
						</DecisionButton>
					{/if}
					{#if wo.status === 'IN_PROGRESS'}
						<DecisionButton variant="approve">
							Mark Complete
						</DecisionButton>
					{/if}
					{#if !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(wo.status)}
						<DecisionButton variant="deny">
							Cancel
						</DecisionButton>
					{/if}
				{/snippet}

				{#snippet content()}
					<TabbedContent
						tabs={[
							{
								id: 'overview',
								label: 'Overview',
								content: overviewTab
							},
							{
								id: 'scope',
								label: 'Scope & Auth',
								content: scopeTab
							},
							{
								id: 'budget',
								label: 'Budget',
								content: budgetTab
							},
							{
								id: 'vendor',
								label: 'Vendor',
								content: vendorTab
							},
							{
								id: 'documents',
								label: 'Documents',
								content: documentsTab
							},
							{
								id: 'history',
								label: 'History',
								content: historyTab
							}
						]}
					/>
				{/snippet}
			</DetailPanel>
		{/if}
	{/snippet}

	{#snippet emptyDetail()}
		<div class="text-center">
			<Wrench class="mx-auto h-12 w-12 text-surface-300" />
			<p class="mt-2 text-surface-500">Select a work order to view details</p>
		</div>
	{/snippet}
</SplitView>

{#snippet overviewTab()}
	{#if selectedWorkOrder}
		<div class="space-y-6">
			<div>
				<h3 class="text-sm font-medium text-surface-500">Description</h3>
				<p class="mt-1">{selectedWorkOrder.description || 'No description provided.'}</p>
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<h3 class="text-sm font-medium text-surface-500">Location</h3>
					<p class="mt-1">{selectedWorkOrder.locationDescription}</p>
				</div>
				{#if selectedWorkOrder.unitId}
					<div>
						<h3 class="text-sm font-medium text-surface-500">Unit</h3>
						<p class="mt-1">
							<a href="/app/cam/units/{selectedWorkOrder.unitId}" class="text-primary-500 hover:underline">
								Unit {selectedWorkOrder.unitNumber}
							</a>
						</p>
					</div>
				{/if}
				<div>
					<h3 class="text-sm font-medium text-surface-500">Vendor</h3>
					<p class="mt-1">{selectedWorkOrder.vendorName || 'Not assigned'}</p>
				</div>
				<div>
					<h3 class="text-sm font-medium text-surface-500">Category</h3>
					<p class="mt-1">{selectedWorkOrder.category}</p>
				</div>
				<div>
					<h3 class="text-sm font-medium text-surface-500">Created</h3>
					<p class="mt-1">{selectedWorkOrder.createdAt ? formatDate(selectedWorkOrder.createdAt) : '-'}</p>
				</div>
				{#if selectedWorkOrder.dueDate}
					<div>
						<h3 class="text-sm font-medium text-surface-500">Due Date</h3>
						<p class="mt-1" class:text-error-500={isOverdue(selectedWorkOrder.dueDate, selectedWorkOrder.status)}>
							{formatDate(selectedWorkOrder.dueDate)}
						</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}
{/snippet}

{#snippet documentsTab()}
	<EmptyState
		title="No documents"
		description="Photos, invoices, and bids will appear here."
	/>
{/snippet}

{#snippet historyTab()}
	<EmptyState
		title="No history"
		description="Status changes and activity will appear here."
	/>
{/snippet}

{#snippet scopeTab()}
	{#if selectedWorkOrder}
		<div class="space-y-6">
			<div>
				<h3 class="text-sm font-medium text-surface-500">Scope Description</h3>
				<p class="mt-1">{selectedWorkOrder.description || 'No description provided.'}</p>
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<h3 class="text-sm font-medium text-surface-500">Origin Type</h3>
					<p class="mt-1">
						{#if selectedWorkOrder.originType}
							<span class="rounded px-2 py-0.5 text-xs font-medium {getOriginTypeColor(selectedWorkOrder.originType)}">
								{getOriginTypeLabel(selectedWorkOrder.originType)}
							</span>
						{:else}
							<span class="text-surface-400">Not specified</span>
						{/if}
					</p>
				</div>
				<div>
					<h3 class="text-sm font-medium text-surface-500">Constraints</h3>
					<p class="mt-1">{selectedWorkOrder.constraints || 'None'}</p>
				</div>
			</div>

			<div class="border-t border-surface-300-700 pt-4">
				<h3 class="text-sm font-medium text-surface-500 mb-3">Authorization</h3>
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<h4 class="text-xs text-surface-400">Authorizing Role</h4>
						<p class="mt-0.5 font-medium">{selectedWorkOrder.authorizingRole || 'Pending'}</p>
					</div>
					<div>
						<h4 class="text-xs text-surface-400">Authorized At</h4>
						<p class="mt-0.5">{selectedWorkOrder.authorizedAt ? formatDate(selectedWorkOrder.authorizedAt) : 'Not yet authorized'}</p>
					</div>
					<div class="sm:col-span-2">
						<h4 class="text-xs text-surface-400">Authorization Rationale</h4>
						<p class="mt-0.5">{selectedWorkOrder.authorizationRationale || 'N/A'}</p>
					</div>
				</div>
			</div>

			{#if selectedWorkOrder.requiresBoardApproval}
				<div class="border-t border-surface-300-700 pt-4">
					<h3 class="text-sm font-medium text-surface-500 mb-3">Board Approval</h3>
					<div class="grid gap-4 sm:grid-cols-2">
						<div>
							<h4 class="text-xs text-surface-400">Status</h4>
							<p class="mt-0.5 font-medium">{selectedWorkOrder.boardApprovalStatus || 'Pending'}</p>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet budgetTab()}
	{#if selectedWorkOrder}
		<div class="space-y-6">
			<div class="grid gap-4 sm:grid-cols-3">
				<div class="rounded-lg border border-surface-300-700 p-4">
					<h4 class="text-xs text-surface-400">Budget Source</h4>
					<p class="mt-1 text-lg font-semibold">{selectedWorkOrder.budgetSource || 'Not set'}</p>
				</div>
				<div class="rounded-lg border border-surface-300-700 p-4">
					<h4 class="text-xs text-surface-400">Approved Amount</h4>
					<p class="mt-1 text-lg font-semibold">
						{selectedWorkOrder.approvedAmount ? `$${Number(selectedWorkOrder.approvedAmount).toLocaleString()}` : '-'}
					</p>
				</div>
				<div class="rounded-lg border border-surface-300-700 p-4">
					<h4 class="text-xs text-surface-400">Spend to Date</h4>
					<p class="mt-1 text-lg font-semibold">
						{selectedWorkOrder.spendToDate ? `$${Number(selectedWorkOrder.spendToDate).toLocaleString()}` : '$0'}
					</p>
				</div>
			</div>

			{#if selectedWorkOrder.approvedAmount && selectedWorkOrder.spendToDate}
				{@const variance = Number(selectedWorkOrder.spendToDate) - Number(selectedWorkOrder.approvedAmount)}
				{@const isOverBudget = variance > 0}
				<div class="rounded-lg border p-4 {isOverBudget ? 'border-error-500 bg-error-500/10' : 'border-success-500 bg-success-500/10'}">
					<h4 class="text-xs {isOverBudget ? 'text-error-600' : 'text-success-600'}">Budget Variance</h4>
					<p class="mt-1 text-lg font-semibold {isOverBudget ? 'text-error-600' : 'text-success-600'}">
						{isOverBudget ? '+' : ''}{variance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
					</p>
				</div>
			{/if}

			<div class="border-t border-surface-300-700 pt-4">
				<h3 class="text-sm font-medium text-surface-500 mb-3">Linked Invoices</h3>
				<EmptyState
					title="No invoices"
					description="Invoices linked to this work order will appear here."
				/>
			</div>
		</div>
	{/if}
{/snippet}

{#snippet vendorTab()}
	{#if selectedWorkOrder}
		<div class="space-y-6">
			<div>
				<h3 class="text-sm font-medium text-surface-500">Assigned Vendor</h3>
				<p class="mt-1 text-lg font-medium">{selectedWorkOrder.vendorName || 'Not assigned'}</p>
			</div>

			<div class="border-t border-surface-300-700 pt-4">
				<h3 class="text-sm font-medium text-surface-500 mb-3">Job Status</h3>
				<p class="text-surface-400 text-sm">Job execution details are read-only from the CAM view.</p>
				<EmptyState
					title="No job created"
					description="When a vendor starts work, job progress will appear here."
				/>
			</div>

			<div class="border-t border-surface-300-700 pt-4">
				<h3 class="text-sm font-medium text-surface-500 mb-3">Completion</h3>
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<h4 class="text-xs text-surface-400">Started At</h4>
						<p class="mt-0.5">{selectedWorkOrder.startedAt ? formatDate(selectedWorkOrder.startedAt) : '-'}</p>
					</div>
					<div>
						<h4 class="text-xs text-surface-400">Completed At</h4>
						<p class="mt-0.5">{selectedWorkOrder.completedAt ? formatDate(selectedWorkOrder.completedAt) : '-'}</p>
					</div>
					<div>
						<h4 class="text-xs text-surface-400">Actual Cost</h4>
						<p class="mt-0.5">{selectedWorkOrder.actualCost ? `$${Number(selectedWorkOrder.actualCost).toLocaleString()}` : '-'}</p>
					</div>
					<div>
						<h4 class="text-xs text-surface-400">Actual Hours</h4>
						<p class="mt-0.5">{selectedWorkOrder.actualHours || '-'}</p>
					</div>
				</div>
			</div>
		</div>
	{/if}
{/snippet}
