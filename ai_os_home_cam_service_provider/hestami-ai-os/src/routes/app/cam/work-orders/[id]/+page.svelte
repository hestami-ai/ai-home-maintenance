<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Wrench, FileText, Clock, UserPlus, CheckCircle, XCircle, Calendar, Pencil } from 'lucide-svelte';
	import { TabbedContent, DecisionButton, AssignVendorModal, ScheduleWorkModal, CompleteWorkOrderModal, DocumentPicker } from '$lib/components/cam';
	import { Card, EmptyState } from '$lib/components/ui';
	import { workOrderApi, vendorApi, documentApi, activityEventApi, type WorkOrder, type Vendor, type Document } from '$lib/api/cam';
	import { refreshBadgeCounts } from '$lib/stores';

	interface WorkOrderHistoryEvent {
		id: string;
		action: string;
		description: string;
		performedBy: string;
		createdAt: string;
	}

	let workOrder = $state<WorkOrder | null>(null);
	let documents = $state<Document[]>([]);
	let history = $state<WorkOrderHistoryEvent[]>([]);
	let vendors = $state<Vendor[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	let showAssignVendorModal = $state(false);
	let showScheduleWorkModal = $state(false);
	let showCompleteModal = $state(false);
	let showDocumentPicker = $state(false);
	let isActionLoading = $state(false);
	let isLinkingDocument = $state(false);

	const workOrderId = $derived(($page.params as Record<string, string>).id);

	async function loadWorkOrder() {
		if (!workOrderId) return;

		isLoading = true;
		error = null;

		try {
			const response = await workOrderApi.get(workOrderId);
			if (response.ok && response.data?.workOrder) {
				workOrder = response.data.workOrder as WorkOrder;
			} else {
				error = 'Work order not found';
			}
		} catch (e) {
			error = 'Failed to load work order';
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	async function loadDocuments() {
		if (!workOrderId) return;
		try {
			const response = await documentApi.list({ contextType: 'WORK_ORDER', contextId: workOrderId });
			if (response.ok && response.data?.documents) {
				documents = response.data.documents;
			}
		} catch (e) {
			console.error('Failed to load documents:', e);
		}
	}

	async function loadHistory() {
		if (!workOrderId) return;
		try {
			const response = await activityEventApi.list({ entityType: 'WORK_ORDER', entityId: workOrderId });
			if (response.ok && response.data?.events) {
				history = response.data.events.map(e => ({
					id: e.id,
					action: e.action,
					description: e.summary,
					performedBy: e.performedBy,
					createdAt: e.createdAt
				}));
			}
		} catch (e) {
			console.error('Failed to load history:', e);
		}
	}

	function getPriorityColor(priority: string): string {
		switch (priority) {
			case 'EMERGENCY': return 'bg-error-500 text-white';
			case 'URGENT': return 'bg-warning-500 text-white';
			case 'HIGH': return 'bg-yellow-500 text-black';
			case 'NORMAL': return 'bg-primary-500 text-white';
			case 'LOW': return 'bg-surface-400 text-white';
			default: return 'bg-surface-300 text-surface-700';
		}
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'SUBMITTED': return 'text-primary-500 bg-primary-500/10';
			case 'APPROVED': return 'text-success-500 bg-success-500/10';
			case 'ASSIGNED': return 'text-warning-500 bg-warning-500/10';
			case 'SCHEDULED': return 'text-yellow-600 bg-yellow-500/10';
			case 'IN_PROGRESS': return 'text-primary-600 bg-primary-500/20';
			case 'COMPLETED': return 'text-success-500 bg-success-500/10';
			case 'CLOSED': return 'text-surface-500 bg-surface-500/10';
			case 'CANCELLED': return 'text-error-500 bg-error-500/10';
			default: return 'text-surface-500 bg-surface-500/10';
		}
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatDateTime(dateString: string): string {
		return new Date(dateString).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function formatCurrency(amount: string | number | undefined): string {
		if (amount === undefined) return '$0.00';
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount));
	}

	function isOverdue(dueDate?: string, status?: string): boolean {
		if (!dueDate || !status) return false;
		if (['COMPLETED', 'CLOSED', 'CANCELLED'].includes(status)) return false;
		return new Date(dueDate) < new Date();
	}

	async function loadVendors() {
		try {
			const response = await vendorApi.list({ status: 'APPROVED' });
			if (response.ok && response.data?.vendors) {
				vendors = response.data.vendors;
			}
		} catch (e) {
			console.error('Failed to load vendors:', e);
		}
	}

	async function handleAssignVendor(data: { vendorId: string; notes?: string }) {
		if (!workOrder) return;

		isActionLoading = true;
		try {
			const response = await workOrderApi.assign(workOrder.id, {
				vendorId: data.vendorId,
				notes: data.notes,
				idempotencyKey: crypto.randomUUID()
			});

			if (response.ok) {
				await loadWorkOrder();
				await loadHistory();
				await refreshBadgeCounts();
				showAssignVendorModal = false;
			}
		} catch (e) {
			console.error('Failed to assign vendor:', e);
		} finally {
			isActionLoading = false;
		}
	}

	async function handleScheduleWork(data: { scheduledDate: string; scheduledTime?: string; estimatedDuration?: number; notes?: string }) {
		if (!workOrder) return;

		isActionLoading = true;
		try {
			const response = await workOrderApi.schedule(workOrder.id, {
				scheduledDate: data.scheduledDate,
				scheduledTime: data.scheduledTime,
				estimatedDuration: data.estimatedDuration,
				notes: data.notes,
				idempotencyKey: crypto.randomUUID()
			});

			if (response.ok) {
				await loadWorkOrder();
				await loadHistory();
				await refreshBadgeCounts();
				showScheduleWorkModal = false;
			}
		} catch (e) {
			console.error('Failed to schedule work:', e);
		} finally {
			isActionLoading = false;
		}
	}

	async function handleCompleteWorkOrder(data: { completedDate: string; actualCost?: number; notes?: string }) {
		if (!workOrder) return;

		isActionLoading = true;
		try {
			const response = await workOrderApi.complete(workOrder.id, {
				completedDate: data.completedDate,
				actualCost: data.actualCost,
				notes: data.notes,
				idempotencyKey: crypto.randomUUID()
			});

			if (response.ok) {
				await loadWorkOrder();
				await loadHistory();
				await refreshBadgeCounts();
				showCompleteModal = false;
			}
		} catch (e) {
			console.error('Failed to complete work order:', e);
		} finally {
			isActionLoading = false;
		}
	}

	function openAssignVendorModal() {
		loadVendors();
		showAssignVendorModal = true;
	}

	async function handleLinkDocuments(selectedDocs: Array<{ documentId: string; version: number; title: string }>) {
		if (!workOrderId || selectedDocs.length === 0) return;

		isLinkingDocument = true;
		try {
			for (const doc of selectedDocs) {
				const response = await documentApi.linkToContext({
					documentId: doc.documentId,
					contextType: 'WORK_ORDER',
					contextId: workOrderId,
					bindingNotes: `Linked as authorization/supporting document`,
					idempotencyKey: crypto.randomUUID()
				});

				if (!response.ok) {
					console.error(`Failed to link document ${doc.documentId}`);
				}
			}
			await loadDocuments();
			showDocumentPicker = false;
		} catch (e) {
			console.error('Failed to link documents:', e);
		} finally {
			isLinkingDocument = false;
		}
	}

	$effect(() => {
		if (workOrderId) {
			loadWorkOrder();
			loadDocuments();
			loadHistory();
		}
	});
</script>

<svelte:head>
	<title>{workOrder?.workOrderNumber || 'Work Order'} | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto('/app/cam/work-orders')}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>

			{#if isLoading}
				<div class="h-6 w-48 animate-pulse rounded bg-surface-200-800"></div>
			{:else if workOrder}
				<div class="flex-1">
					<div class="flex items-center gap-2">
						<span class="text-sm text-surface-500">{workOrder.workOrderNumber}</span>
						<span class="rounded px-1.5 py-0.5 text-xs font-medium {getPriorityColor(workOrder.priority)}">
							{workOrder.priority}
						</span>
						<span class="rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(workOrder.status)}">
							{workOrder.status.replace(/_/g, ' ')}
						</span>
						{#if isOverdue(workOrder.dueDate, workOrder.status)}
							<span class="rounded-full bg-error-500 px-2 py-0.5 text-xs font-medium text-white">
								OVERDUE
							</span>
						{/if}
					</div>
					<h1 class="mt-1 text-xl font-semibold">{workOrder.title}</h1>
				</div>

				<div class="flex gap-2">
					<a
						href="/app/cam/work-orders/{workOrder.id}/edit"
						class="btn btn-sm preset-tonal-surface"
					>
						<Pencil class="mr-1 h-4 w-4" />
						Edit
					</a>
					{#if workOrder.status === 'SUBMITTED' || !workOrder.vendorId}
						<DecisionButton variant="default" onclick={openAssignVendorModal}>
							<UserPlus class="mr-1 h-4 w-4" />
							Assign Vendor
						</DecisionButton>
					{/if}
					{#if workOrder.status === 'ASSIGNED' || (workOrder.vendorId && !workOrder.scheduledDate)}
						<DecisionButton variant="default" onclick={() => showScheduleWorkModal = true}>
							<Calendar class="mr-1 h-4 w-4" />
							Schedule
						</DecisionButton>
					{/if}
					{#if ['ASSIGNED', 'SCHEDULED', 'IN_PROGRESS'].includes(workOrder.status)}
						<DecisionButton variant="approve" onclick={() => showCompleteModal = true}>
							<CheckCircle class="mr-1 h-4 w-4" />
							Mark Complete
						</DecisionButton>
					{/if}
					{#if !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(workOrder.status)}
						<DecisionButton variant="deny">
							<XCircle class="mr-1 h-4 w-4" />
							Cancel
						</DecisionButton>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-6">
		{#if isLoading}
			<div class="flex h-64 items-center justify-center">
				<div class="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
			</div>
		{:else if error}
			<div class="flex h-64 items-center justify-center">
				<EmptyState title="Error" description={error} />
			</div>
		{:else if workOrder}
			<TabbedContent
				tabs={[
					{ id: 'overview', label: 'Overview', content: overviewTab },
					{ id: 'documents', label: 'Documents', content: documentsTab },
					{ id: 'history', label: 'History', content: historyTab }
				]}
			/>
		{/if}
	</div>
</div>

{#snippet overviewTab()}
	{#if workOrder}
		<div class="space-y-6">
			<Card variant="outlined" padding="lg">
				<h3 class="mb-4 font-semibold">Work Order Details</h3>
				<div class="space-y-4">
					<div>
						<h4 class="text-sm font-medium text-surface-500">Description</h4>
						<p class="mt-1">{workOrder.description || 'No description provided.'}</p>
					</div>

					<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						<div>
							<h4 class="text-sm font-medium text-surface-500">Category</h4>
							<p class="mt-1">{workOrder.category}</p>
						</div>
						<div>
							<h4 class="text-sm font-medium text-surface-500">Priority</h4>
							<p class="mt-1">
								<span class="rounded px-2 py-0.5 text-sm font-medium {getPriorityColor(workOrder.priority)}">
									{workOrder.priority}
								</span>
							</p>
						</div>
						<div>
							<h4 class="text-sm font-medium text-surface-500">Status</h4>
							<p class="mt-1">
								<span class="rounded-full px-2 py-0.5 text-sm font-medium {getStatusColor(workOrder.status)}">
									{workOrder.status.replace(/_/g, ' ')}
								</span>
							</p>
						</div>
					</div>
				</div>
			</Card>

			<Card variant="outlined" padding="lg">
				<h3 class="mb-4 font-semibold">Location</h3>
				<div class="grid gap-4 sm:grid-cols-2">
					{#if workOrder.unitId}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Unit</h4>
							<p class="mt-1">
								<a href="/app/cam/units/{workOrder.unitId}" class="text-primary-500 hover:underline">
									Unit {workOrder.unitNumber}
								</a>
							</p>
						</div>
					{/if}
					{#if workOrder.commonAreaName}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Common Area</h4>
							<p class="mt-1">{workOrder.commonAreaName}</p>
						</div>
					{/if}
				</div>
			</Card>

			<Card variant="outlined" padding="lg">
				<h3 class="mb-4 font-semibold">Vendor & Cost</h3>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<div>
						<h4 class="text-sm font-medium text-surface-500">Assigned Vendor</h4>
						<p class="mt-1">
							{#if workOrder.vendorId}
								<a href="/app/cam/vendors/{workOrder.vendorId}" class="text-primary-500 hover:underline">
									{workOrder.vendorName}
								</a>
							{:else}
								<span class="text-surface-400">Not assigned</span>
							{/if}
						</p>
					</div>
					{#if workOrder.estimatedCost}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Estimated Cost</h4>
							<p class="mt-1">{formatCurrency(workOrder.estimatedCost)}</p>
						</div>
					{/if}
					{#if workOrder.actualCost}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Actual Cost</h4>
							<p class="mt-1">{formatCurrency(Number(workOrder.actualCost))}</p>
						</div>
					{/if}
				</div>
			</Card>

			<Card variant="outlined" padding="lg">
				<h3 class="mb-4 font-semibold">Timeline</h3>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div>
						<h4 class="text-sm font-medium text-surface-500">Created</h4>
						<p class="mt-1">{formatDate(workOrder.createdAt)}</p>
					</div>
					{#if workOrder.dueDate}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Due Date</h4>
							<p class="mt-1 {isOverdue(workOrder.dueDate, workOrder.status) ? 'text-error-500 font-medium' : ''}">
								{formatDate(workOrder.dueDate)}
							</p>
						</div>
					{/if}
					{#if workOrder.scheduledDate}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Scheduled</h4>
							<p class="mt-1">{formatDate(workOrder.scheduledDate)}</p>
						</div>
					{/if}
					{#if workOrder.completedDate}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Completed</h4>
							<p class="mt-1">{formatDate(workOrder.completedDate)}</p>
						</div>
					{/if}
				</div>
			</Card>
		</div>
	{/if}
{/snippet}

{#snippet documentsTab()}
	<Card variant="outlined" padding="lg">
		<div class="mb-4 flex items-center justify-between">
			<h3 class="font-semibold">Authorization & Supporting Documents</h3>
			<div class="flex gap-2">
				<button
					type="button"
					onclick={() => showDocumentPicker = true}
					class="btn btn-sm preset-tonal-surface"
				>
					<FileText class="mr-1 h-4 w-4" />
					Link Existing
				</button>
				<a href="/app/cam/documents/upload?contextType=WORK_ORDER&contextId={workOrderId}" class="btn btn-sm preset-filled-primary-500">
					Upload New
				</a>
			</div>
		</div>

		{#if documents.length === 0}
			<EmptyState
				title="No documents"
				description="Photos, invoices, and bids will appear here."
			/>
		{:else}
			<div class="divide-y divide-surface-300-700">
				{#each documents as doc}
					<div class="flex items-center gap-3 py-3">
						<FileText class="h-5 w-5 text-surface-400" />
						<div class="flex-1">
							<p class="font-medium">{doc.name}</p>
							<p class="text-sm text-surface-500">{doc.category} · {formatDate(doc.createdAt)}</p>
						</div>
						<a href="/api/document/{doc.id}/download" class="btn btn-sm preset-tonal-surface">
							Download
						</a>
					</div>
				{/each}
			</div>
		{/if}
	</Card>
{/snippet}

{#snippet historyTab()}
	<Card variant="outlined" padding="lg">
		<h3 class="mb-4 font-semibold">Activity History</h3>

		{#if history.length === 0}
			<EmptyState
				title="No history"
				description="Status changes and activity will appear here."
			/>
		{:else}
			<div class="space-y-4">
				{#each history as event}
					<div class="flex gap-3">
						<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface-200-800">
							<Clock class="h-4 w-4 text-surface-500" />
						</div>
						<div class="flex-1">
							<p class="font-medium">{event.action}</p>
							<p class="text-sm text-surface-500">{event.description}</p>
							<p class="mt-1 text-xs text-surface-400">
								{event.performedBy} · {formatDateTime(event.createdAt)}
							</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</Card>
{/snippet}

<AssignVendorModal
	open={showAssignVendorModal}
	{vendors}
	loading={isActionLoading}
	onConfirm={handleAssignVendor}
	onCancel={() => showAssignVendorModal = false}
/>

<ScheduleWorkModal
	open={showScheduleWorkModal}
	loading={isActionLoading}
	onConfirm={handleScheduleWork}
	onCancel={() => showScheduleWorkModal = false}
/>

<CompleteWorkOrderModal
	open={showCompleteModal}
	loading={isActionLoading}
	onConfirm={handleCompleteWorkOrder}
	onCancel={() => showCompleteModal = false}
/>

<DocumentPicker
	bind:open={showDocumentPicker}
	multiSelect={true}
	onClose={() => showDocumentPicker = false}
	onSelect={handleLinkDocuments}
/>
