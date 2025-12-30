<script lang="ts">
	import { page } from '$app/stores';
	import {
		ArrowLeft,
		Clock,
		FileText,
		Users,
		Home,
		Settings,
		Play,
		MessageSquare,
		Scale,
		User,
		HelpCircle,
		CheckCircle,
		Send,
		Link
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import {
		CaseStatusBadge,
		CasePriorityBadge,
		ConciergeActionPanel,
		CaseOverviewTab,
		CaseIntentTab,
		CaseDecisionsTab,
		CaseActionsTab,
		CaseDocumentsTab,
		CaseHistoryTab,
		CaseParticipantsTab
	} from '$lib/components/cam';
	import {
		conciergeCaseApi,
		type ConciergeCaseDetail,
		type CaseNoteType,
		type ConciergeCaseStatus
	} from '$lib/api/cam';

	let caseDetail = $state<ConciergeCaseDetail | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let activeTab = $state<string>('overview');

	let noteContent = $state('');
	let noteType = $state<CaseNoteType>('GENERAL');
	let isSubmittingNote = $state(false);

	let clarificationQuestion = $state('');
	let isSubmittingClarification = $state(false);

	let showStatusModal = $state(false);
	let newStatus = $state<ConciergeCaseStatus | ''>('');
	let statusReason = $state('');
	let isUpdatingStatus = $state(false);

	const caseId = $derived($page.params.id);

	async function loadCaseDetail() {
		if (!caseId) return;
		isLoading = true;
		error = null;
		try {
			const response = await conciergeCaseApi.getDetail(caseId);
			if (!response.ok) {
				error = 'Failed to load case details';
				return;
			}
			caseDetail = response.data;
		} catch (err) {
			console.error('Failed to load case:', err);
			// Preserve the actual error message for display
			error = err instanceof Error ? err.message : 'An error occurred while loading the case';
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		loadCaseDetail();
	});

	function getStatusLabel(status: string): string {
		const labels: Record<string, string> = {
			INTAKE: 'Intake',
			ASSESSMENT: 'Assessment',
			IN_PROGRESS: 'In Progress',
			PENDING_EXTERNAL: 'Pending External',
			PENDING_OWNER: 'Pending Owner',
			ON_HOLD: 'On Hold',
			RESOLVED: 'Resolved',
			CLOSED: 'Closed',
			CANCELLED: 'Cancelled'
		};
		return labels[status] || status;
	}

	function getStatusColor(status: string): string {
		const colors: Record<string, string> = {
			INTAKE: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
			ASSESSMENT: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
			IN_PROGRESS: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
			PENDING_EXTERNAL: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
			PENDING_OWNER: 'bg-red-500/10 text-red-500 border-red-500/20',
			ON_HOLD: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
			RESOLVED: 'bg-green-500/10 text-green-500 border-green-500/20',
			CLOSED: 'bg-surface-500/10 text-surface-500 border-surface-500/20',
			CANCELLED: 'bg-surface-500/10 text-surface-500 border-surface-500/20'
		};
		return colors[status] || 'bg-surface-500/10 text-surface-500 border-surface-500/20';
	}

	function getPriorityColor(priority: string): string {
		const colors: Record<string, string> = {
			LOW: 'text-surface-500',
			NORMAL: 'text-blue-500',
			HIGH: 'text-amber-500',
			URGENT: 'text-orange-500',
			EMERGENCY: 'text-red-500'
		};
		return colors[priority] || 'text-surface-500';
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function formatShortDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric'
		});
	}

	function getNoteTypeLabel(noteType: CaseNoteType): string {
		const labels: Record<CaseNoteType, string> = {
			GENERAL: 'Note',
			CLARIFICATION_REQUEST: 'Clarification Request',
			CLARIFICATION_RESPONSE: 'Owner Response',
			DECISION_RATIONALE: 'Decision'
		};
		return labels[noteType] || noteType;
	}

	function getNoteTypeIcon(noteType: CaseNoteType) {
		switch (noteType) {
			case 'CLARIFICATION_REQUEST':
				return HelpCircle;
			case 'CLARIFICATION_RESPONSE':
				return CheckCircle;
			case 'DECISION_RATIONALE':
				return Settings;
			default:
				return MessageSquare;
		}
	}

	function generateIdempotencyKey(): string {
		return `case-action-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
	}

	async function submitNote() {
		if (!noteContent.trim() || !caseId) return;

		isSubmittingNote = true;
		try {
			const response = await conciergeCaseApi.addNote({
				caseId,
				content: noteContent.trim(),
				noteType,
				isInternal: false,
				idempotencyKey: generateIdempotencyKey()
			});

			if (response.ok) {
				noteContent = '';
				noteType = 'GENERAL';
				await loadCaseDetail();
			}
		} catch (err) {
			console.error('Failed to add note:', err);
		} finally {
			isSubmittingNote = false;
		}
	}

	async function requestClarification() {
		if (!clarificationQuestion.trim() || !caseId) return;

		isSubmittingClarification = true;
		try {
			const response = await conciergeCaseApi.requestClarification({
				caseId,
				question: clarificationQuestion.trim(),
				idempotencyKey: generateIdempotencyKey()
			});

			if (response.ok) {
				clarificationQuestion = '';
				await loadCaseDetail();
			}
		} catch (err) {
			console.error('Failed to request clarification:', err);
		} finally {
			isSubmittingClarification = false;
		}
	}

	async function updateStatus() {
		if (!newStatus || !caseId) return;

		isUpdatingStatus = true;
		try {
			const response = await conciergeCaseApi.updateStatus({
				id: caseId,
				status: newStatus as ConciergeCaseStatus,
				reason: statusReason || undefined,
				idempotencyKey: generateIdempotencyKey()
			});

			if (response.ok) {
				showStatusModal = false;
				newStatus = '';
				statusReason = '';
				await loadCaseDetail();
			}
		} catch (err) {
			console.error('Failed to update status:', err);
		} finally {
			isUpdatingStatus = false;
		}
	}

	const statusOptions: ConciergeCaseStatus[] = [
		'INTAKE',
		'ASSESSMENT',
		'IN_PROGRESS',
		'PENDING_EXTERNAL',
		'PENDING_OWNER',
		'ON_HOLD',
		'RESOLVED',
		'CLOSED',
		'CANCELLED'
	];

	const tabs = [
		{ id: 'overview', label: 'Overview', icon: Home },
		{ id: 'intent', label: 'Intent', icon: MessageSquare },
		{ id: 'decisions', label: 'Decisions', icon: Scale },
		{ id: 'actions', label: 'Actions', icon: Play },
		{ id: 'documents', label: 'Documents', icon: FileText },
		{ id: 'participants', label: 'Participants', icon: Users },
		{ id: 'history', label: 'History', icon: Clock }
	];
</script>

<svelte:head>
	<title>{caseDetail?.case.title || 'Case Details'} | Concierge | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-8">
		<!-- Back Link -->
		<div class="mb-6">
			<a
				href="/app/concierge/cases"
				class="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
			>
				<ArrowLeft class="h-4 w-4" />
				Back to Cases
			</a>
		</div>

		{#if isLoading}
			<div class="flex items-center justify-center py-12">
				<div class="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
			</div>
		{:else if error || !caseDetail}
			<Card variant="outlined" padding="lg">
				<EmptyState
					title="Unable to load case"
					description={error || 'The case could not be found or you do not have permission to view it.'}
				>
					{#snippet actions()}
						<a href="/app/concierge/cases" class="btn preset-filled-primary-500">
							Return to Cases
						</a>
					{/snippet}
				</EmptyState>
			</Card>
		{:else}
			<!-- Header -->
			<div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<div class="flex items-center gap-3">
						<h1 class="text-2xl font-bold">{caseDetail.case.title}</h1>
						<span
							class="inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium {getStatusColor(
								caseDetail.case.status
							)}"
						>
							{getStatusLabel(caseDetail.case.status)}
						</span>
					</div>
					<div class="mt-2 flex flex-wrap items-center gap-4 text-sm text-surface-500">
						<span>{caseDetail.case.caseNumber}</span>
						<span>•</span>
						<span class={getPriorityColor(caseDetail.case.priority)}>
							{caseDetail.case.priority} Priority
						</span>
						<span>•</span>
						<span>Created {formatShortDate(caseDetail.case.createdAt)}</span>
						{#if caseDetail.case.assignedConciergeName}
							<span>•</span>
							<span class="flex items-center gap-1">
								<User class="h-4 w-4" />
								{caseDetail.case.assignedConciergeName}
							</span>
						{/if}
					</div>
				</div>
				<div class="flex flex-wrap gap-2">
					<button
						class="btn preset-outlined-surface-500"
						onclick={() => (showStatusModal = true)}
					>
						<Settings class="mr-2 h-4 w-4" />
						Change Status
					</button>
				</div>
			</div>

			<!-- Tabs -->
			<div class="mb-6 border-b border-surface-300-700">
				<nav class="-mb-px flex gap-6 overflow-x-auto">
					{#each tabs as tab}
						<button
							class="flex shrink-0 items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors {activeTab ===
							tab.id
								? 'border-primary-500 text-primary-500'
								: 'border-transparent text-surface-500 hover:border-surface-300 hover:text-surface-700 dark:hover:text-surface-300'}"
							onclick={() => (activeTab = tab.id)}
						>
							<tab.icon class="h-4 w-4" />
							{tab.label}
						</button>
					{/each}
				</nav>
			</div>

			<!-- Tab Content -->
			<div class="grid gap-6 lg:grid-cols-4">
				<!-- Main Content -->
				<div class="lg:col-span-3">
					{#if activeTab === 'overview'}
						<CaseOverviewTab {caseDetail} />
					{:else if activeTab === 'intent'}
						<CaseIntentTab {caseDetail} />
					{:else if activeTab === 'decisions'}
						<CaseDecisionsTab {caseDetail} />
					{:else if activeTab === 'actions'}
						<CaseActionsTab {caseDetail} />
					{:else if activeTab === 'documents'}
						<CaseDocumentsTab {caseDetail} />
					{:else if activeTab === 'participants'}
						<CaseParticipantsTab {caseDetail} />
					{:else if activeTab === 'history'}
						<CaseHistoryTab {caseDetail} />
					{/if}
				</div>

				<!-- Sidebar with Action Panel -->
				<div class="lg:col-span-1">
					<Card variant="outlined" padding="md">
						<ConciergeActionPanel
							{caseDetail}
							onRequestClarification={async (question) => {
								if (!caseDetail) return;
								await conciergeCaseApi.requestClarification({
									caseId: caseDetail.case.id,
									question,
									idempotencyKey: generateIdempotencyKey()
								});
								await loadCaseDetail();
							}}
							onUpdateStatus={async (status, reason) => {
								if (!caseDetail) return;
								await conciergeCaseApi.updateStatus({
									id: caseDetail.case.id,
									status,
									reason,
									idempotencyKey: generateIdempotencyKey()
								});
								await loadCaseDetail();
							}}
							onLinkArc={async (arcRequestId) => {
								if (!caseDetail) return;
								await conciergeCaseApi.linkToArc({
									caseId: caseDetail.case.id,
									arcRequestId,
									idempotencyKey: generateIdempotencyKey()
								});
								await loadCaseDetail();
							}}
							onLinkWorkOrder={async (workOrderId) => {
								if (!caseDetail) return;
								await conciergeCaseApi.linkToWorkOrder({
									caseId: caseDetail.case.id,
									workOrderId,
									idempotencyKey: generateIdempotencyKey()
								});
								await loadCaseDetail();
							}}
							onCloseCase={async (resolution) => {
								if (!caseDetail) return;
								await conciergeCaseApi.close({
									caseId: caseDetail.case.id,
									idempotencyKey: generateIdempotencyKey()
								});
								await loadCaseDetail();
							}}
							onAssignConcierge={async (conciergeUserId) => {
								if (!caseDetail) return;
								await conciergeCaseApi.assign({
									caseId: caseDetail.case.id,
									conciergeId: conciergeUserId,
									idempotencyKey: generateIdempotencyKey()
								});
								await loadCaseDetail();
							}}
						/>
					</Card>
				</div>
			</div>
		{/if}
	</div>
</PageContainer>

<!-- Status Change Modal -->
{#if showStatusModal && caseDetail}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="mx-4 w-full max-w-md rounded-lg bg-surface-50-950 p-6 shadow-xl">
			<h2 class="text-lg font-semibold">Change Case Status</h2>
			<p class="mt-1 text-sm text-surface-500">
				Current status: {getStatusLabel(caseDetail.case.status)}
			</p>

			<div class="mt-4 space-y-4">
				<div>
					<label for="newStatus" class="block text-sm font-medium">New Status</label>
					<select id="newStatus" bind:value={newStatus} class="select mt-1 w-full">
						<option value="">Select a status</option>
						{#each statusOptions as status}
							{#if status !== caseDetail.case.status}
								<option value={status}>{getStatusLabel(status)}</option>
							{/if}
						{/each}
					</select>
				</div>

				<div>
					<label for="statusReason" class="block text-sm font-medium">Reason (optional)</label>
					<textarea
						id="statusReason"
						bind:value={statusReason}
						placeholder="Explain why you're changing the status..."
						class="textarea mt-1 w-full"
						rows="3"
					></textarea>
				</div>
			</div>

			<div class="mt-6 flex justify-end gap-3">
				<button
					class="btn preset-outlined-surface-500"
					onclick={() => {
						showStatusModal = false;
						newStatus = '';
						statusReason = '';
					}}
				>
					Cancel
				</button>
				<button
					class="btn preset-filled-primary-500"
					onclick={updateStatus}
					disabled={!newStatus || isUpdatingStatus}
				>
					{#if isUpdatingStatus}
						<span class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
						Updating...
					{:else}
						Update Status
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
