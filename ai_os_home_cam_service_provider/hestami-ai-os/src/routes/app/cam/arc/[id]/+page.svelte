<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft, ClipboardCheck, FileText, Clock, CheckCircle, XCircle, Pause, MessageSquare, Pencil, User, Bot, Image, FileImage, History, Scale, Users, Vote, AlertCircle } from 'lucide-svelte';
	import { TabbedContent, DecisionButton, ARCDecisionModal, DocumentPicker } from '$lib/components/cam';
	import { Card, EmptyState } from '$lib/components/ui';
	import { ARCRequestStatusValues, ARCReviewActionValues, ActivityEntityTypeValues, activityEventApi, arcRequestApi, arcReviewApi, documentApi, type ARCRequest, type Document } from '$lib/api/cam';
	import { nanoid } from 'nanoid';
	import { refreshBadgeCounts } from '$lib/stores';

	interface ARCHistoryEvent {
		id: string;
		action: string;
		description: string;
		performedBy: string;
		actorType?: string;
		rationale?: string;
		relatedDocuments?: string[];
		createdAt: string;
	}

	interface ARCPrecedent {
		id: string;
		requestNumber: string;
		title: string;
		status: string;
		category: string;
		decisionDate: string | null;
	}

	interface VoteData {
		id: string;
		reviewerId: string;
		reviewerName: string | null;
		action: string;
		notes: string | null;
		conditions: string | null;
		createdAt: string;
	}

	interface VoteSummary {
		total: number;
		approve: number;
		deny: number;
		requestChanges: number;
		table: number;
	}

	interface QuorumInfo {
		required: number | null;
		met: boolean;
		activeMembers: number;
	}

	interface ThresholdInfo {
		required: number | null;
		current: number;
		met: boolean;
	}

	let request = $state<ARCRequest | null>(null);
	let documents = $state<Document[]>([]);
	let unitPrecedents = $state<ARCPrecedent[]>([]);
	let categoryPrecedents = $state<ARCPrecedent[]>([]);
	let history = $state<ARCHistoryEvent[]>([]);
	let votes = $state<VoteData[]>([]);
	let voteSummary = $state<VoteSummary | null>(null);
	let quorum = $state<QuorumInfo | null>(null);
	let threshold = $state<ThresholdInfo | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	let showDecisionModal = $state(false);
	let decisionType = $state<'APPROVE' | 'APPROVE_WITH_CONDITIONS' | 'DENY' | 'TABLE' | 'REQUEST_CHANGES' | null>(null);
	let isActionLoading = $state(false);
	let showDocumentPicker = $state(false);
	let isLinkingDocument = $state(false);

	const requestId = $derived(($page.params as Record<string, string>).id);

	async function loadRequest() {
		if (!requestId) return;

		isLoading = true;
		error = null;

		try {
			const response = await arcRequestApi.get(requestId);
			if (!response.ok) {
				error = 'ARC request not found';
				return;
			}
			request = response.data.request as unknown as ARCRequest;
		} catch (e) {
			error = 'Failed to load ARC request';
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	async function loadDocuments() {
		if (!requestId) return;
		try {
			const response = await documentApi.list({ contextType: ActivityEntityTypeValues.ARC_REQUEST, contextId: requestId });
			if (response.ok) {
				documents = response.data.documents;
			}
		} catch (e) {
			console.error('Failed to load documents:', e);
		}
	}

	async function loadHistory() {
		if (!requestId) return;
		try {
			const response = await activityEventApi.getByEntity({ entityType: ActivityEntityTypeValues.ARC_REQUEST, entityId: requestId });
			if (response.ok) {
				history = response.data.events.map((e: any) => ({
					id: e.id,
					action: e.action,
					description: e.summary,
					performedBy: e.performedBy,
					actorType: e.actorType,
					rationale: e.rationale,
					relatedDocuments: e.relatedDocuments,
					createdAt: e.createdAt
				}));
			}
		} catch (e) {
			console.error('Failed to load history:', e);
		}
	}

	async function loadPrecedents() {
		if (!requestId || !request) return;
		try {
			const response = await arcRequestApi.getPriorPrecedents(requestId, {
				unitId: (request as any).unitId || undefined,
				category: request.category as any || undefined
			});
			if (response.ok) {
				unitPrecedents = response.data.unitPrecedents || [];
				categoryPrecedents = response.data.categoryPrecedents || [];
			}
		} catch (e) {
			console.error('Failed to load precedents:', e);
		}
	}

	async function loadVotes() {
		if (!requestId) return;
		try {
			const response = await arcReviewApi.getVotes(requestId);
			if (response.ok) {
				votes = response.data.votes || [];
				voteSummary = response.data.summary || null;
				quorum = response.data.quorum || null;
				threshold = response.data.threshold || null;
			}
		} catch (e) {
			console.error('Failed to load votes:', e);
		}
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case ARCRequestStatusValues.SUBMITTED: return 'text-primary-500 bg-primary-500/10';
			case ARCRequestStatusValues.UNDER_REVIEW: return 'text-warning-500 bg-warning-500/10';
			case ARCRequestStatusValues.APPROVED: return 'text-success-500 bg-success-500/10';
			case 'APPROVED_WITH_CONDITIONS': return 'text-success-600 bg-success-500/20';
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

	function formatDateTime(dateString: string): string {
		return new Date(dateString).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
	}

	function openDecisionModal(type: 'APPROVE' | 'APPROVE_WITH_CONDITIONS' | 'DENY' | 'TABLE' | 'REQUEST_CHANGES') {
		decisionType = type;
		showDecisionModal = true;
	}

	async function handleDecisionConfirm(data: { decision: string; rationale: string; conditions?: string }) {
		if (!request) return;

		isActionLoading = true;
		try {
			// Map decision to action type
			const actionMap: Record<string, 'APPROVE' | 'DENY' | 'REQUEST_CHANGES' | 'TABLE'> = {
				[ARCReviewActionValues.APPROVE]: ARCReviewActionValues.APPROVE,
				'APPROVE_WITH_CONDITIONS': ARCReviewActionValues.APPROVE,
				[ARCReviewActionValues.DENY]: ARCReviewActionValues.DENY,
				[ARCReviewActionValues.REQUEST_CHANGES]: ARCReviewActionValues.REQUEST_CHANGES,
				[ARCReviewActionValues.TABLE]: ARCReviewActionValues.TABLE
			};
			const action = actionMap[data.decision] || ARCReviewActionValues.APPROVE;

			const response = await arcReviewApi.recordDecision({
				requestId: request.id,
				action,
				notes: data.rationale,
				conditions: data.conditions,
				idempotencyKey: nanoid()
			});

			if (response.ok) {
				await loadRequest();
				await loadHistory();
				await loadVotes();
				await refreshBadgeCounts();
				showDecisionModal = false;
				decisionType = null;
			}
		} catch (e) {
			console.error('Failed to perform action:', e);
		} finally {
			isActionLoading = false;
		}
	}

	async function handleLinkDocuments(selectedDocs: Array<{ documentId: string; version: number; title: string }>) {
		if (!requestId || selectedDocs.length === 0) return;

		isLinkingDocument = true;
		try {
			for (const doc of selectedDocs) {
				const response = await documentApi.linkToContext({
					documentId: doc.documentId,
					contextType: ActivityEntityTypeValues.ARC_REQUEST,
					contextId: requestId,
					bindingNotes: `Linked as referenced guideline/submission document`,
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
		if (requestId) {
			loadRequest();
			loadDocuments();
			loadHistory();
			loadVotes();
		}
	});

	$effect(() => {
		if (request) {
			loadPrecedents();
		}
	});
</script>

<svelte:head>
	<title>{request?.requestNumber || 'ARC Request'} | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto('/app/cam/arc')}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>

			{#if isLoading}
				<div class="h-6 w-48 animate-pulse rounded bg-surface-200-800"></div>
			{:else if request}
				<div class="flex-1">
					<div class="flex items-center gap-2">
						<span class="text-sm text-surface-500">{request.requestNumber}</span>
						<span class="rounded px-1.5 py-0.5 text-xs font-medium bg-surface-200-800">
							{request.category}
						</span>
						<span class="rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(request.status)}">
							{request.status.replace(/_/g, ' ')}
						</span>
					</div>
					<h1 class="mt-1 text-xl font-semibold">{request.title}</h1>
				</div>

				<div class="flex gap-2">
					{#if ([ARCRequestStatusValues.SUBMITTED, ARCRequestStatusValues.UNDER_REVIEW] as string[]).includes(request.status)}
						<DecisionButton
							variant="approve"
							requiresRationale
							onclick={() => openDecisionModal(ARCReviewActionValues.APPROVE)}
						>
							<CheckCircle class="mr-1 h-4 w-4" />
							Approve
						</DecisionButton>
						<DecisionButton
							variant="approve"
							requiresRationale
							onclick={() => openDecisionModal('APPROVE_WITH_CONDITIONS')}
						>
							<CheckCircle class="mr-1 h-4 w-4" />
							Approve w/ Conditions
						</DecisionButton>
						<DecisionButton
							variant="deny"
							requiresRationale
							onclick={() => openDecisionModal(ARCReviewActionValues.DENY)}
						>
							<XCircle class="mr-1 h-4 w-4" />
							Deny
						</DecisionButton>
						<DecisionButton
							variant="default"
							requiresRationale
							onclick={() => openDecisionModal(ARCReviewActionValues.TABLE)}
						>
							<Pause class="mr-1 h-4 w-4" />
							Table
						</DecisionButton>
						<DecisionButton
							variant="default"
							requiresRationale
							onclick={() => openDecisionModal(ARCReviewActionValues.REQUEST_CHANGES)}
						>
							<MessageSquare class="mr-1 h-4 w-4" />
							Request Changes
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
		{:else if request}
			<TabbedContent
				tabs={[
					{ id: 'overview', label: 'Overview', content: overviewTab },
					{ id: 'proposal', label: 'Proposal', content: proposalTab },
					{ id: 'precedents', label: 'Governing Rules', content: precedentsTab },
					{ id: 'decisions', label: 'Decisions', content: decisionsTab },
					{ id: 'history', label: 'History', content: historyTab }
				]}
			/>
		{/if}
	</div>
</div>

{#snippet overviewTab()}
	{#if request}
		<div class="space-y-6">
			<Card variant="outlined" padding="lg">
				<h3 class="mb-4 font-semibold">Request Details</h3>
				<div class="space-y-4">
					<div>
						<h4 class="text-sm font-medium text-surface-500">Description</h4>
						<p class="mt-1">{(request as any).description || 'No description provided.'}</p>
					</div>

					{#if (request as any).projectScope}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Project Scope</h4>
							<p class="mt-1">{(request as any).projectScope}</p>
						</div>
					{/if}

					<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						<div>
							<h4 class="text-sm font-medium text-surface-500">Category</h4>
							<p class="mt-1">{request.category}</p>
						</div>
						<div>
							<h4 class="text-sm font-medium text-surface-500">Status</h4>
							<p class="mt-1">
								<span class="rounded-full px-2 py-0.5 text-sm font-medium {getStatusColor(request.status)}">
									{request.status.replace(/_/g, ' ')}
								</span>
							</p>
						</div>
						{#if (request as any).estimatedCost}
							<div>
								<h4 class="text-sm font-medium text-surface-500">Estimated Cost</h4>
								<p class="mt-1">{formatCurrency(typeof (request as any).estimatedCost === 'string' ? parseFloat((request as any).estimatedCost) : (request as any).estimatedCost ?? 0)}</p>
							</div>
						{/if}
					</div>
				</div>
			</Card>

			<Card variant="outlined" padding="lg">
				<h3 class="mb-4 font-semibold">Location & Submitter</h3>
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<h4 class="text-sm font-medium text-surface-500">Unit</h4>
						<p class="mt-1">
							<a href="/app/cam/units/{(request as any).unitId}" class="text-primary-500 hover:underline">
								Unit {request.unitNumber}
							</a>
						</p>
					</div>
					<div>
						<h4 class="text-sm font-medium text-surface-500">Submitted By</h4>
						<p class="mt-1">{request.submitterName}</p>
					</div>
				</div>
			</Card>

			<Card variant="outlined" padding="lg">
				<h3 class="mb-4 font-semibold">Timeline</h3>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div>
						<h4 class="text-sm font-medium text-surface-500">Submitted</h4>
						<p class="mt-1">{request.createdAt ? formatDate(request.createdAt) : '-'}</p>
					</div>
					{#if (request as any).startDate}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Planned Start</h4>
							<p class="mt-1">{formatDate((request as any).startDate)}</p>
						</div>
					{/if}
					{#if (request as any).completionDate}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Expected Completion</h4>
							<p class="mt-1">{formatDate((request as any).completionDate)}</p>
						</div>
					{/if}
					<div>
						<h4 class="text-sm font-medium text-surface-500">Last Updated</h4>
						<p class="mt-1">{request.updatedAt ? formatDate(request.updatedAt) : '-'}</p>
					</div>
				</div>
			</Card>

			{#if (request as any).conditions}
				<Card variant="outlined" padding="lg">
					<h3 class="mb-4 font-semibold">Conditions / Stipulations</h3>
					<p>{(request as any).conditions}</p>
				</Card>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet proposalTab()}
	<div class="space-y-6">
		<Card variant="outlined" padding="lg">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="font-semibold">Plans & Drawings</h3>
				<a href="/app/cam/documents/upload?contextType=ARC_REQUEST&contextId={requestId}&documentType=PLANS" class="btn btn-sm preset-filled-primary-500">
					Upload Plans
				</a>
			</div>

			{@const planDocs = documents.filter(d => ['PLANS', 'RENDERING', 'SURVEY'].includes(d.category))}
			{#if planDocs.length === 0}
				<EmptyState
					title="No plans uploaded"
					description="Upload architectural drawings, renderings, or surveys."
				/>
			{:else}
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each planDocs as doc}
						<div class="rounded-lg border border-surface-300-700 p-4">
							<div class="flex items-center gap-3">
								<FileImage class="h-8 w-8 text-primary-500" />
								<div class="flex-1 min-w-0">
									<p class="font-medium truncate">{doc.title}</p>
									<p class="text-xs text-surface-500">{doc.category}</p>
								</div>
							</div>
							<div class="mt-3 flex gap-2">
								<a href="/api/document/{doc.id}/preview" target="_blank" class="btn btn-sm preset-tonal-primary flex-1">
									Preview
								</a>
								<a href="/api/document/{doc.id}/download" class="btn btn-sm preset-tonal-surface flex-1">
									Download
								</a>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</Card>

		<Card variant="outlined" padding="lg">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="font-semibold">Specifications & Photos</h3>
				<a href="/app/cam/documents/upload?contextType=ARC_REQUEST&contextId={requestId}&documentType=SPECS" class="btn btn-sm preset-filled-primary-500">
					Upload Specs
				</a>
			</div>

			{@const specDocs = documents.filter(d => ['SPECS', 'PHOTO', 'OTHER'].includes(d.category))}
			{#if specDocs.length === 0}
				<EmptyState
					title="No specifications uploaded"
					description="Upload material specs, color samples, or photos."
				/>
			{:else}
				<div class="divide-y divide-surface-300-700">
					{#each specDocs as doc}
						<div class="flex items-center gap-3 py-3">
							{#if doc.category === 'PHOTO'}
								<Image class="h-5 w-5 text-surface-400" />
							{:else}
								<FileText class="h-5 w-5 text-surface-400" />
							{/if}
							<div class="flex-1">
								<p class="font-medium">{doc.title}</p>
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

		<Card variant="outlined" padding="lg">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="font-semibold">Permits</h3>
				<a href="/app/cam/documents/upload?contextType=ARC_REQUEST&contextId={requestId}&documentType=PERMIT" class="btn btn-sm preset-filled-primary-500">
					Upload Permit
				</a>
			</div>

			{@const permitDocs = documents.filter(d => d.category === 'PERMIT')}
			{#if permitDocs.length === 0}
				<EmptyState
					title="No permits uploaded"
					description="Upload any required building permits or approvals."
				/>
			{:else}
				<div class="divide-y divide-surface-300-700">
					{#each permitDocs as doc}
						<div class="flex items-center gap-3 py-3">
							<ClipboardCheck class="h-5 w-5 text-success-500" />
							<div class="flex-1">
								<p class="font-medium">{doc.title}</p>
								<p class="text-sm text-surface-500">{formatDate(doc.createdAt)}</p>
							</div>
							<a href="/api/document/{doc.id}/download" class="btn btn-sm preset-tonal-surface">
								Download
							</a>
						</div>
					{/each}
				</div>
			{/if}
		</Card>
	</div>
{/snippet}

{#snippet precedentsTab()}
	<div class="space-y-6">
		<Card variant="outlined" padding="lg">
			<h3 class="mb-4 flex items-center gap-2 font-semibold">
				<Scale class="h-5 w-5 text-primary-500" />
				Architectural Guidelines
			</h3>
			<p class="text-sm text-surface-500">
				Review the governing documents and architectural guidelines that apply to this request type.
			</p>
			<div class="mt-4 rounded-lg bg-surface-100-900 p-4">
				<p class="text-sm italic text-surface-600">
					"All exterior modifications must be approved by the Architectural Review Committee prior to commencement of work. 
					Modifications should be consistent with the overall aesthetic of the community."
				</p>
				<p class="mt-2 text-xs text-surface-500">— CC&Rs Section 7.2</p>
			</div>
		</Card>

		<Card variant="outlined" padding="lg">
			<h3 class="mb-4 flex items-center gap-2 font-semibold">
				<History class="h-5 w-5 text-primary-500" />
				Prior Requests for This Unit
			</h3>
			{#if unitPrecedents.length === 0}
				<EmptyState
					title="No prior requests"
					description="No previous ARC requests found for this unit."
				/>
			{:else}
				<div class="divide-y divide-surface-300-700">
					{#each unitPrecedents as precedent}
						<a href="/app/cam/arc/{precedent.id}" class="flex items-center gap-3 py-3 hover:bg-surface-100-900 -mx-2 px-2 rounded transition-colors">
							<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full {getStatusColor(precedent.status)}">
								{#if precedent.status === ARCRequestStatusValues.APPROVED}
									<CheckCircle class="h-4 w-4" />
								{:else if precedent.status === ARCRequestStatusValues.DENIED}
									<XCircle class="h-4 w-4" />
								{:else}
									<Clock class="h-4 w-4" />
								{/if}
							</div>
							<div class="flex-1 min-w-0">
								<p class="font-medium truncate">{precedent.title}</p>
								<p class="text-sm text-surface-500">{precedent.requestNumber} · {precedent.category}</p>
							</div>
							<span class="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(precedent.status)}">
								{precedent.status.replace(/_/g, ' ')}
							</span>
						</a>
					{/each}
				</div>
			{/if}
		</Card>

		<Card variant="outlined" padding="lg">
			<h3 class="mb-4 flex items-center gap-2 font-semibold">
				<History class="h-5 w-5 text-primary-500" />
				Similar Requests ({request?.category})
			</h3>
			{#if categoryPrecedents.length === 0}
				<EmptyState
					title="No similar requests"
					description="No previous ARC requests found for this category."
				/>
			{:else}
				<div class="divide-y divide-surface-300-700">
					{#each categoryPrecedents as precedent}
						<a href="/app/cam/arc/{precedent.id}" class="flex items-center gap-3 py-3 hover:bg-surface-100-900 -mx-2 px-2 rounded transition-colors">
							<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full {getStatusColor(precedent.status)}">
								{#if precedent.status === ARCRequestStatusValues.APPROVED}
									<CheckCircle class="h-4 w-4" />
								{:else if precedent.status === ARCRequestStatusValues.DENIED}
									<XCircle class="h-4 w-4" />
								{:else}
									<Clock class="h-4 w-4" />
								{/if}
							</div>
							<div class="flex-1 min-w-0">
								<p class="font-medium truncate">{precedent.title}</p>
								<p class="text-sm text-surface-500">{precedent.requestNumber}</p>
							</div>
							<div class="text-right">
								<span class="rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(precedent.status)}">
									{precedent.status.replace(/_/g, ' ')}
								</span>
								{#if precedent.decisionDate}
									<p class="mt-1 text-xs text-surface-400">{formatDate(precedent.decisionDate)}</p>
								{/if}
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</Card>
	</div>
{/snippet}

{#snippet decisionsTab()}
	<div class="space-y-6">
		<!-- Quorum & Threshold Status -->
		<div class="grid gap-4 sm:grid-cols-2">
			<Card variant="outlined" padding="lg">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-full {quorum?.met ? 'bg-success-500/20' : 'bg-warning-500/20'}">
						<Users class="h-5 w-5 {quorum?.met ? 'text-success-500' : 'text-warning-500'}" />
					</div>
					<div>
						<h4 class="font-medium">Quorum Status</h4>
						{#if quorum?.required}
							<p class="text-sm text-surface-500">
								{voteSummary?.total || 0} of {quorum.required} required votes
								{#if quorum.met}
									<span class="ml-1 text-success-500">✓ Met</span>
								{:else}
									<span class="ml-1 text-warning-500">Not met</span>
								{/if}
							</p>
						{:else}
							<p class="text-sm text-surface-500">No quorum requirement</p>
						{/if}
					</div>
				</div>
			</Card>

			<Card variant="outlined" padding="lg">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-full {threshold?.met ? 'bg-success-500/20' : 'bg-warning-500/20'}">
						<Vote class="h-5 w-5 {threshold?.met ? 'text-success-500' : 'text-warning-500'}" />
					</div>
					<div>
						<h4 class="font-medium">Approval Threshold</h4>
						{#if threshold?.required}
							<p class="text-sm text-surface-500">
								{threshold.current}% of {threshold.required}% required
								{#if threshold.met}
									<span class="ml-1 text-success-500">✓ Met</span>
								{:else}
									<span class="ml-1 text-warning-500">Not met</span>
								{/if}
							</p>
						{:else}
							<p class="text-sm text-surface-500">No threshold requirement</p>
						{/if}
					</div>
				</div>
			</Card>
		</div>

		<!-- Vote Summary -->
		<Card variant="outlined" padding="lg">
			<h3 class="mb-4 font-semibold">Vote Summary</h3>
			{#if voteSummary && voteSummary.total > 0}
				{@const total = voteSummary.total || 1}
				<div class="space-y-3">
					<div class="flex items-center gap-3">
						<div class="h-3 flex-1 overflow-hidden rounded-full bg-surface-200-800">
							<div class="flex h-full">
								{#if voteSummary.approve > 0}
									<div class="bg-success-500" style="width: {(voteSummary.approve / total) * 100}%"></div>
								{/if}
								{#if voteSummary.deny > 0}
									<div class="bg-error-500" style="width: {(voteSummary.deny / total) * 100}%"></div>
								{/if}
								{#if voteSummary.requestChanges > 0}
									<div class="bg-warning-500" style="width: {(voteSummary.requestChanges / total) * 100}%"></div>
								{/if}
								{#if voteSummary.table > 0}
									<div class="bg-surface-400" style="width: {(voteSummary.table / total) * 100}%"></div>
								{/if}
							</div>
						</div>
						<span class="text-sm font-medium">{voteSummary.total} votes</span>
					</div>
					<div class="flex flex-wrap gap-4 text-sm">
						<div class="flex items-center gap-2">
							<div class="h-3 w-3 rounded-full bg-success-500"></div>
							<span>Approve: {voteSummary.approve}</span>
						</div>
						<div class="flex items-center gap-2">
							<div class="h-3 w-3 rounded-full bg-error-500"></div>
							<span>Deny: {voteSummary.deny}</span>
						</div>
						<div class="flex items-center gap-2">
							<div class="h-3 w-3 rounded-full bg-warning-500"></div>
							<span>Request Changes: {voteSummary.requestChanges}</span>
						</div>
						<div class="flex items-center gap-2">
							<div class="h-3 w-3 rounded-full bg-surface-400"></div>
							<span>Table: {voteSummary.table}</span>
						</div>
					</div>
				</div>
			{:else}
				<EmptyState
					title="No votes yet"
					description="Committee members have not cast any votes."
				/>
			{/if}
		</Card>

		<!-- Individual Votes -->
		<Card variant="outlined" padding="lg">
			<h3 class="mb-4 font-semibold">Vote Details</h3>
			{#if votes.length === 0}
				<EmptyState
					title="No votes recorded"
					description="Individual votes will appear here as committee members review the request."
				/>
			{:else}
				<div class="divide-y divide-surface-300-700">
					{#each votes as vote}
						<div class="py-3">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-3">
									<div class="flex h-8 w-8 items-center justify-center rounded-full {vote.action === ARCReviewActionValues.APPROVE ? 'bg-success-500/20' : vote.action === ARCReviewActionValues.DENY ? 'bg-error-500/20' : 'bg-warning-500/20'}">
										{#if vote.action === ARCReviewActionValues.APPROVE}
											<CheckCircle class="h-4 w-4 text-success-500" />
										{:else if vote.action === ARCReviewActionValues.DENY}
											<XCircle class="h-4 w-4 text-error-500" />
										{:else}
											<AlertCircle class="h-4 w-4 text-warning-500" />
										{/if}
									</div>
									<div>
										<p class="font-medium">{vote.reviewerName || vote.reviewerId}</p>
										<p class="text-xs text-surface-500">{formatDateTime(vote.createdAt)}</p>
									</div>
								</div>
								<span class="rounded-full px-2 py-0.5 text-xs font-medium {vote.action === ARCReviewActionValues.APPROVE ? 'bg-success-500/10 text-success-500' : vote.action === ARCReviewActionValues.DENY ? 'bg-error-500/10 text-error-500' : 'bg-warning-500/10 text-warning-500'}">
									{vote.action.replace(/_/g, ' ')}
								</span>
							</div>
							{#if vote.notes}
								<p class="mt-2 text-sm text-surface-600 pl-11">{vote.notes}</p>
							{/if}
							{#if vote.conditions}
								<div class="mt-2 rounded bg-surface-100-900 p-2 ml-11">
									<p class="text-xs font-medium text-surface-500">Conditions:</p>
									<p class="text-sm">{vote.conditions}</p>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</Card>

		<!-- Decision Actions (if request is still open) -->
		{#if request && ([ARCRequestStatusValues.SUBMITTED, ARCRequestStatusValues.UNDER_REVIEW] as string[]).includes(request.status)}
			<Card variant="outlined" padding="lg">
				<h3 class="mb-4 font-semibold">Record Decision</h3>
				<p class="mb-4 text-sm text-surface-500">
					As a reviewer, you can cast your vote or record a final decision.
				</p>
				<div class="flex flex-wrap gap-2">
					<DecisionButton
						variant="approve"
						requiresRationale
						onclick={() => openDecisionModal(ARCReviewActionValues.APPROVE)}
					>
						<CheckCircle class="mr-1 h-4 w-4" />
						Approve
					</DecisionButton>
					<DecisionButton
						variant="approve"
						requiresRationale
						onclick={() => openDecisionModal('APPROVE_WITH_CONDITIONS')}
					>
						<CheckCircle class="mr-1 h-4 w-4" />
						Approve w/ Conditions
					</DecisionButton>
					<DecisionButton
						variant="deny"
						requiresRationale
						onclick={() => openDecisionModal(ARCReviewActionValues.DENY)}
					>
						<XCircle class="mr-1 h-4 w-4" />
						Deny
					</DecisionButton>
					<DecisionButton
						variant="default"
						requiresRationale
						onclick={() => openDecisionModal(ARCReviewActionValues.REQUEST_CHANGES)}
					>
						<MessageSquare class="mr-1 h-4 w-4" />
						Request Changes
					</DecisionButton>
					<DecisionButton
						variant="default"
						requiresRationale
						onclick={() => openDecisionModal(ARCReviewActionValues.TABLE)}
					>
						<Pause class="mr-1 h-4 w-4" />
						Table
					</DecisionButton>
				</div>
			</Card>
		{/if}
	</div>
{/snippet}

{#snippet documentsTab()}
	<Card variant="outlined" padding="lg">
		<div class="mb-4 flex items-center justify-between">
			<h3 class="font-semibold">Submission Documents & Guidelines</h3>
			<div class="flex gap-2">
				<button
					type="button"
					onclick={() => showDocumentPicker = true}
					class="btn btn-sm preset-tonal-surface"
				>
					<FileText class="mr-1 h-4 w-4" />
					Link Existing
				</button>
				<a href="/app/cam/documents/upload?contextType=ARC_REQUEST&contextId={requestId}" class="btn btn-sm preset-filled-primary-500">
					Upload New
				</a>
			</div>
		</div>

		{#if documents.length === 0}
			<EmptyState
				title="No documents"
				description="Plans, specs, photos, and permits will appear here."
			/>
		{:else}
			<div class="divide-y divide-surface-300-700">
				{#each documents as doc}
					<div class="flex items-center gap-3 py-3">
						<FileText class="h-5 w-5 text-surface-400" />
						<div class="flex-1">
							<p class="font-medium">{doc.title}</p>
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
				description="Review decisions and status changes will appear here."
			/>
		{:else}
			<div class="relative space-y-0">
				<div class="absolute left-4 top-0 h-full w-0.5 bg-surface-200-800"></div>
				{#each history as event, i}
					<div class="relative flex gap-4 pb-6 {i === history.length - 1 ? 'pb-0' : ''}">
						<div class="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full {event.actorType === 'SYSTEM' ? 'bg-surface-300-700' : event.actorType === 'AI' ? 'bg-tertiary-500/20' : 'bg-primary-500/20'}">
							{#if event.actorType === 'SYSTEM'}
								<Clock class="h-4 w-4 text-surface-500" />
							{:else if event.actorType === 'AI'}
								<Bot class="h-4 w-4 text-tertiary-500" />
							{:else}
								<Pencil class="h-4 w-4 text-primary-500" />
							{/if}
						</div>
						<div class="flex-1 rounded-lg border border-surface-300-700 bg-surface-50-950 p-3">
							<div class="flex items-start justify-between gap-2">
								<div>
									<p class="font-medium">{event.action.replace(/_/g, ' ')}</p>
									<p class="text-sm text-surface-500">{event.description}</p>
								</div>
								<span class="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {event.actorType === 'SYSTEM' ? 'bg-surface-200-800 text-surface-500' : event.actorType === 'AI' ? 'bg-tertiary-500/10 text-tertiary-500' : 'bg-primary-500/10 text-primary-500'}">
									{event.actorType || 'HUMAN'}
								</span>
							</div>
							{#if event.rationale}
								<div class="mt-2 rounded bg-surface-100-900 p-2">
									<p class="text-xs font-medium text-surface-500">Rationale:</p>
									<p class="text-sm text-surface-600">{event.rationale}</p>
								</div>
							{/if}
							{#if event.relatedDocuments && event.relatedDocuments.length > 0}
								<div class="mt-2 flex flex-wrap gap-1">
									{#each event.relatedDocuments as docId}
										<a href="/api/document/{docId}" class="inline-flex items-center gap-1 rounded bg-surface-200-800 px-2 py-0.5 text-xs text-surface-600 hover:bg-surface-300-700">
											<FileText class="h-3 w-3" />
											Document
										</a>
									{/each}
								</div>
							{/if}
							<p class="mt-2 text-xs text-surface-400">
								{event.performedBy} · {formatDateTime(event.createdAt)}
							</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</Card>
{/snippet}

<ARCDecisionModal
	open={showDecisionModal}
	decision={decisionType}
	loading={isActionLoading}
	onConfirm={handleDecisionConfirm}
	onCancel={() => {
		showDecisionModal = false;
		decisionType = null;
	}}
/>

<DocumentPicker
	bind:open={showDocumentPicker}
	multiSelect={true}
	categoryFilter="ARCHITECTURAL_GUIDELINES"
	onClose={() => showDocumentPicker = false}
	onSelect={handleLinkDocuments}
/>
