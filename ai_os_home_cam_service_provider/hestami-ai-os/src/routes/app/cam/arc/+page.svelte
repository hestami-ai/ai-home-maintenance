<script lang="ts">
	import { ClipboardCheck, Plus, Search } from 'lucide-svelte';
	import { SplitView, ListPanel, DetailPanel, TabbedContent, DecisionButton, RationaleModal } from '$lib/components/cam';
	import { EmptyState } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';
	import { ARCRequestStatusValues, ARCReviewActionValues, arcRequestApi, arcReviewApi, type ARCRequest } from '$lib/api/cam';
	import { nanoid } from 'nanoid';

	interface ARCRequestListItem extends ARCRequest {
		unitNumber?: string;
		submitterName?: string;
	}

	let requests = $state<ARCRequest[]>([]);
	let selectedRequest = $state<ARCRequest | null>(null);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let statusFilter = $state<string>('');

	let showRationaleModal = $state(false);
	let rationaleAction = $state<{ type: string; label: string; variant: 'approve' | 'deny' | 'escalate' | 'default' } | null>(null);
	let isActionLoading = $state(false);

	const statusOptions = [
		{ value: '', label: 'All Statuses' },
		{ value: ARCRequestStatusValues.SUBMITTED, label: 'Submitted' },
		{ value: ARCRequestStatusValues.UNDER_REVIEW, label: 'Under Review' },
		{ value: ARCRequestStatusValues.APPROVED, label: 'Approved' },
		{ value: 'APPROVED_WITH_CONDITIONS', label: 'Approved w/ Conditions' },
		{ value: ARCRequestStatusValues.DENIED, label: 'Denied' },
		{ value: ARCRequestStatusValues.TABLED, label: 'Tabled' },
		{ value: ARCRequestStatusValues.WITHDRAWN, label: 'Withdrawn' }
	];

	async function loadRequests() {
		if (!$currentAssociation?.id) return;

		isLoading = true;
		try {
			const params: { status?: string; search?: string } = {};
			if (statusFilter) params.status = statusFilter;
			if (searchQuery) params.search = searchQuery;

			const response = await arcRequestApi.list(params as any);
			if (response.ok) {
				requests = response.data.requests as unknown as ARCRequestListItem[];
			}
		} catch (error) {
			console.error('Failed to load ARC requests:', error);
		} finally {
			isLoading = false;
		}
	}

	function selectRequest(request: ARCRequest) {
		selectedRequest = request;
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case ARCRequestStatusValues.SUBMITTED: return 'text-primary-500 bg-primary-500/10';
			case ARCRequestStatusValues.UNDER_REVIEW: return 'text-warning-500 bg-warning-500/10';
			case ARCRequestStatusValues.APPROVED: return 'text-success-500 bg-success-500/10';
			case 'APPROVED_WITH_CONDITIONS': return 'text-success-600 bg-success-500/10';
			case ARCRequestStatusValues.DENIED: return 'text-error-500 bg-error-500/10';
			case ARCRequestStatusValues.TABLED: return 'text-surface-500 bg-surface-500/10';
			case ARCRequestStatusValues.WITHDRAWN: return 'text-surface-400 bg-surface-400/10';
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

	function openRationaleModal(type: string, label: string, variant: 'approve' | 'deny' | 'escalate' | 'default') {
		rationaleAction = { type, label, variant };
		showRationaleModal = true;
	}

	async function handleRationaleConfirm(rationale: string) {
		if (!selectedRequest || !rationaleAction) return;

		isActionLoading = true;
		try {
			// Map decision to action type
			const actionMap: Record<string, 'APPROVE' | 'DENY' | 'REQUEST_CHANGES' | 'TABLE'> = {
				'APPROVE': ARCReviewActionValues.APPROVE,
				'APPROVE_WITH_CONDITIONS': ARCReviewActionValues.APPROVE,
				'DENY': ARCReviewActionValues.DENY,
				'REQUEST_CHANGES': ARCReviewActionValues.REQUEST_CHANGES,
				'TABLE': ARCReviewActionValues.TABLE
			};
			const action = actionMap[rationaleAction.type] || ARCReviewActionValues.APPROVE;

			const response = await arcReviewApi.submitReview({
				requestId: selectedRequest.id,
				action,
				notes: rationale,
				idempotencyKey: nanoid()
			});

			if (response.ok) {
				await loadRequests();
				showRationaleModal = false;
				rationaleAction = null;
			}
		} catch (error) {
			console.error('Failed to perform action:', error);
		} finally {
			isActionLoading = false;
		}
	}

	const filteredRequests = $derived(
		requests.filter((r) =>
			r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			r.requestNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
			(r.unitNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
		)
	);

	$effect(() => {
		if ($currentAssociation?.id) {
			loadRequests();
		}
	});

	$effect(() => {
		loadRequests();
	});
</script>

<svelte:head>
	<title>ARC Requests | CAM | Hestami AI</title>
</svelte:head>

<SplitView hasSelection={!!selectedRequest}>
	{#snippet listPanel()}
		<ListPanel loading={isLoading}>
			{#snippet header()}
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<h1 class="text-lg font-semibold">ARC Requests</h1>
						<a href="/app/cam/arc/new" class="btn btn-sm preset-filled-primary-500">
							<Plus class="mr-1 h-4 w-4" />
							New
						</a>
					</div>

					<div class="relative">
						<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
						<input
							type="text"
							placeholder="Search requests..."
							bind:value={searchQuery}
							class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 py-2 pl-9 pr-3 text-sm placeholder:text-surface-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>

					<select
						bind:value={statusFilter}
						class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					>
						{#each statusOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>
			{/snippet}

			{#snippet items()}
				{#if filteredRequests.length === 0}
					<div class="p-6">
						<EmptyState
							title="No ARC requests found"
							description={searchQuery || statusFilter
								? 'Try adjusting your filters.'
								: 'No ARC requests have been submitted yet.'}
						/>
					</div>
				{:else}
					<div class="divide-y divide-surface-300-700">
						{#each filteredRequests as request}
							<button
								type="button"
								onclick={() => selectRequest(request)}
								class="w-full px-4 py-3 text-left transition-colors hover:bg-surface-200-800 {selectedRequest?.id === request.id ? 'bg-primary-500/10' : ''}"
							>
								<div class="flex items-start justify-between gap-2">
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<span class="text-xs font-medium text-surface-500">
												{request.requestNumber}
											</span>
											<span class="rounded px-1.5 py-0.5 text-xs font-medium bg-surface-200-800">
												{request.category}
											</span>
										</div>
										<p class="mt-1 truncate font-medium">{request.title}</p>
										<p class="mt-0.5 text-sm text-surface-500">
											Unit {request.unitNumber} · {request.submitterName}
										</p>
									</div>
									<span class="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(request.status)}">
										{request.status.replace(/_/g, ' ')}
									</span>
								</div>
								<p class="mt-1 text-xs text-surface-400">
									{formatDate(request.createdAt)}
								</p>
							</button>
						{/each}
					</div>
				{/if}
			{/snippet}
		</ListPanel>
	{/snippet}

	{#snippet detailPanel()}
		{#if selectedRequest}
			<DetailPanel>
				{#snippet header()}
					{@const r = selectedRequest!}
					<div>
						<div class="flex items-center gap-2">
							<span class="text-sm text-surface-500">{r.requestNumber}</span>
							<span class="rounded px-1.5 py-0.5 text-xs font-medium bg-surface-200-800">
								{r.category}
							</span>
							<span class="rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(r.status)}">
								{r.status.replace(/_/g, ' ')}
							</span>
						</div>
						<h2 class="mt-1 text-xl font-semibold">{r.title}</h2>
					</div>
				{/snippet}

				{#snippet actions()}
					{@const r = selectedRequest!}
					{#if ([ARCRequestStatusValues.SUBMITTED, ARCRequestStatusValues.UNDER_REVIEW] as string[]).includes(r.status)}
						<DecisionButton
							variant="approve"
							requiresRationale
							onclick={() => openRationaleModal(ARCRequestStatusValues.APPROVED, 'Approve', 'approve')}
						>
							Approve
						</DecisionButton>
						<DecisionButton
							variant="deny"
							requiresRationale
							onclick={() => openRationaleModal(ARCRequestStatusValues.DENIED, 'Deny', 'deny')}
						>
							Deny
						</DecisionButton>
						<DecisionButton
							variant="default"
							requiresRationale
							onclick={() => openRationaleModal(ARCRequestStatusValues.TABLED, 'Table', 'default')}
						>
							Table
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
			<ClipboardCheck class="mx-auto h-12 w-12 text-surface-300" />
			<p class="mt-2 text-surface-500">Select a request to view details</p>
		</div>
	{/snippet}
</SplitView>

{#snippet overviewTab()}
	{#if selectedRequest}
		<div class="space-y-6">
			<div>
				<h3 class="text-sm font-medium text-surface-500">Description</h3>
				<p class="mt-1">{(selectedRequest as any).description || 'No description provided.'}</p>
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<h3 class="text-sm font-medium text-surface-500">Unit</h3>
					<p class="mt-1">
						<a href="/app/cam/units/{(selectedRequest as any).unitId}" class="text-primary-500 hover:underline">
							Unit {selectedRequest.unitNumber}
						</a>
					</p>
				</div>
				<div>
					<h3 class="text-sm font-medium text-surface-500">Submitter</h3>
					<p class="mt-1">{selectedRequest.submitterName}</p>
				</div>
				<div>
					<h3 class="text-sm font-medium text-surface-500">Submitted</h3>
					<p class="mt-1">{formatDate(selectedRequest.createdAt)}</p>
				</div>
				<div>
					<h3 class="text-sm font-medium text-surface-500">Last Updated</h3>
					<p class="mt-1">{selectedRequest.updatedAt ? formatDate(selectedRequest.updatedAt) : '-'}</p>
				</div>
			</div>
		</div>
	{/if}
{/snippet}

{#snippet documentsTab()}
	<EmptyState
		title="No documents"
		description="Plans, specs, and photos will appear here."
	/>
{/snippet}

{#snippet historyTab()}
	<EmptyState
		title="No history"
		description="Review history and status changes will appear here."
	/>
{/snippet}

<RationaleModal
	open={showRationaleModal}
	title={rationaleAction?.label || 'Confirm Decision'}
	actionLabel={rationaleAction?.label || 'Confirm'}
	actionVariant={rationaleAction?.variant || 'default'}
	loading={isActionLoading}
	onConfirm={handleRationaleConfirm}
	onCancel={() => {
		showRationaleModal = false;
		rationaleAction = null;
	}}
/>
