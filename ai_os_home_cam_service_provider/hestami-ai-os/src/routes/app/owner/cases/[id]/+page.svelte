<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import {
		ArrowLeft,
		MessageSquare,
		Clock,
		FileText,
		Users,
		Send,
		AlertCircle,
		CheckCircle,
		Home
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import {
		conciergeCaseApi,
		type ConciergeCaseDetail,
		type CaseNote,
		type CaseNoteType
	} from '$lib/api/cam';

	let caseDetail = $state<ConciergeCaseDetail | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let activeTab = $state<'overview' | 'timeline' | 'documents' | 'participants'>('overview');

	let clarificationResponse = $state('');
	let isSubmittingResponse = $state(false);
	let responseError = $state<string | null>(null);

	const caseId = $derived($page.params.id);

	async function loadCaseDetail() {
		if (!caseId) return;
		isLoading = true;
		error = null;
		try {
			const response = await conciergeCaseApi.getDetail(caseId);
			if (response.ok && response.data) {
				caseDetail = response.data;
			} else {
				error = 'Failed to load case details';
			}
		} catch (err) {
			console.error('Failed to load case:', err);
			error = 'An error occurred while loading the case';
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		loadCaseDetail();
	});

	function getStatusLabel(status: string): string {
		const labels: Record<string, string> = {
			INTAKE: 'New',
			ASSESSMENT: 'Under Review',
			IN_PROGRESS: 'In Progress',
			PENDING_EXTERNAL: 'Waiting on External',
			PENDING_OWNER: 'Needs Your Response',
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
			CLARIFICATION_REQUEST: 'Question from Concierge',
			CLARIFICATION_RESPONSE: 'Your Response',
			DECISION_RATIONALE: 'Decision'
		};
		return labels[noteType] || noteType;
	}

	function getNoteTypeIcon(noteType: CaseNoteType) {
		switch (noteType) {
			case 'CLARIFICATION_REQUEST':
				return AlertCircle;
			case 'CLARIFICATION_RESPONSE':
				return CheckCircle;
			default:
				return MessageSquare;
		}
	}

	function hasPendingClarification(): boolean {
		if (!caseDetail) return false;
		return caseDetail.case.status === 'PENDING_OWNER';
	}

	function getLatestClarificationRequest(): CaseNote | null {
		if (!caseDetail) return null;
		const requests = caseDetail.notes.filter((n) => n.noteType === 'CLARIFICATION_REQUEST');
		return requests.length > 0 ? requests[requests.length - 1] : null;
	}

	function generateIdempotencyKey(): string {
		return `clarification-response-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
	}

	async function submitClarificationResponse() {
		if (!clarificationResponse.trim()) {
			responseError = 'Please enter your response';
			return;
		}

		isSubmittingResponse = true;
		responseError = null;

		try {
			const response = await conciergeCaseApi.respondToClarification({
				caseId: caseId!,
				response: clarificationResponse.trim(),
				idempotencyKey: generateIdempotencyKey()
			});

			if (response.ok) {
				clarificationResponse = '';
				await loadCaseDetail();
			} else {
				responseError = 'Failed to submit response. Please try again.';
			}
		} catch (err) {
			console.error('Failed to submit response:', err);
			responseError = 'An error occurred. Please try again.';
		} finally {
			isSubmittingResponse = false;
		}
	}

	const tabs = [
		{ id: 'overview' as const, label: 'Overview', icon: Home },
		{ id: 'timeline' as const, label: 'Timeline', icon: Clock },
		{ id: 'documents' as const, label: 'Documents', icon: FileText },
		{ id: 'participants' as const, label: 'Participants', icon: Users }
	];
</script>

<svelte:head>
	<title>{caseDetail?.case.title || 'Case Details'} | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-8">
		<!-- Back Link -->
		<div class="mb-6">
			<a
				href="/app/owner/cases"
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
						<a href="/app/owner/cases" class="btn preset-filled-primary-500">
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
					</div>
				</div>
			</div>

			<!-- Pending Clarification Alert -->
			{#if hasPendingClarification()}
				{@const latestRequest = getLatestClarificationRequest()}
				<Card variant="outlined" padding="md" class="mb-6 border-red-500/30 bg-red-500/5">
					<div class="flex items-start gap-4">
						<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10">
							<AlertCircle class="h-5 w-5 text-red-500" />
						</div>
						<div class="flex-1">
							<h3 class="font-semibold text-red-600 dark:text-red-400">Response Needed</h3>
							{#if latestRequest}
								<p class="mt-1 text-sm text-surface-600 dark:text-surface-400">
									{latestRequest.content}
								</p>
							{/if}
							<div class="mt-4">
								{#if responseError}
									<p class="mb-2 text-sm text-error-500">{responseError}</p>
								{/if}
								<textarea
									bind:value={clarificationResponse}
									placeholder="Type your response here..."
									class="textarea w-full"
									rows="3"
								></textarea>
								<div class="mt-2 flex justify-end">
									<button
										class="btn preset-filled-primary-500"
										onclick={submitClarificationResponse}
										disabled={isSubmittingResponse}
									>
										{#if isSubmittingResponse}
											<span class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
											Submitting...
										{:else}
											<Send class="mr-2 h-4 w-4" />
											Submit Response
										{/if}
									</button>
								</div>
							</div>
						</div>
					</div>
				</Card>
			{/if}

			<!-- Tabs -->
			<div class="mb-6 border-b border-surface-300-700">
				<nav class="-mb-px flex gap-6">
					{#each tabs as tab}
						<button
							class="flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors {activeTab ===
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
			{#if activeTab === 'overview'}
				<div class="grid gap-6 lg:grid-cols-3">
					<!-- Main Content -->
					<div class="lg:col-span-2 space-y-6">
						<!-- Description -->
						<Card variant="outlined" padding="md">
							<h3 class="font-semibold">Description</h3>
							<p class="mt-2 whitespace-pre-wrap text-surface-600 dark:text-surface-400">
								{caseDetail.case.description}
							</p>
						</Card>

						<!-- Recent Notes -->
						<Card variant="outlined" padding="none">
							<div class="border-b border-surface-300-700 px-6 py-4">
								<h3 class="font-semibold">Recent Activity</h3>
							</div>
							{#if caseDetail.notes.length === 0}
								<div class="p-6">
									<EmptyState
										title="No activity yet"
										description="Updates and communications will appear here."
									/>
								</div>
							{:else}
								<div class="divide-y divide-surface-300-700">
									{#each caseDetail.notes.slice(0, 5) as note}
										{@const NoteIcon = getNoteTypeIcon(note.noteType)}
										<div class="px-6 py-4">
											<div class="flex items-start gap-3">
												<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-200-800">
													<NoteIcon class="h-4 w-4 text-surface-500" />
												</div>
												<div class="flex-1 min-w-0">
													<div class="flex items-center gap-2">
														<span class="text-sm font-medium">
															{getNoteTypeLabel(note.noteType)}
														</span>
														<span class="text-xs text-surface-500">
															{formatDate(note.createdAt)}
														</span>
													</div>
													<p class="mt-1 text-sm text-surface-600 dark:text-surface-400">
														{note.content}
													</p>
												</div>
											</div>
										</div>
									{/each}
								</div>
								{#if caseDetail.notes.length > 5}
									<div class="border-t border-surface-300-700 px-6 py-3">
										<button
											class="text-sm text-primary-500 hover:underline"
											onclick={() => (activeTab = 'timeline')}
										>
											View all activity →
										</button>
									</div>
								{/if}
							{/if}
						</Card>
					</div>

					<!-- Sidebar -->
					<div class="space-y-6">
						<!-- Property Info -->
						<Card variant="outlined" padding="md">
							<h3 class="font-semibold">Property</h3>
							<div class="mt-3">
								<p class="font-medium">{caseDetail.property.name}</p>
								<p class="text-sm text-surface-500">
									{caseDetail.property.addressLine1}
									{#if caseDetail.property.city}
										<br />{caseDetail.property.city}, {caseDetail.property.state} {caseDetail.property.postalCode}
									{/if}
								</p>
							</div>
						</Card>

						<!-- Case Details -->
						<Card variant="outlined" padding="md">
							<h3 class="font-semibold">Details</h3>
							<dl class="mt-3 space-y-3 text-sm">
								<div>
									<dt class="text-surface-500">Status</dt>
									<dd class="font-medium">{getStatusLabel(caseDetail.case.status)}</dd>
								</div>
								<div>
									<dt class="text-surface-500">Priority</dt>
									<dd class="font-medium {getPriorityColor(caseDetail.case.priority)}">
										{caseDetail.case.priority}
									</dd>
								</div>
								<div>
									<dt class="text-surface-500">Created</dt>
									<dd>{formatDate(caseDetail.case.createdAt)}</dd>
								</div>
								<div>
									<dt class="text-surface-500">Last Updated</dt>
									<dd>{formatDate(caseDetail.case.updatedAt)}</dd>
								</div>
								{#if caseDetail.case.assignedConciergeName}
									<div>
										<dt class="text-surface-500">Assigned To</dt>
										<dd>{caseDetail.case.assignedConciergeName}</dd>
									</div>
								{/if}
								{#if caseDetail.case.resolvedAt}
									<div>
										<dt class="text-surface-500">Resolved</dt>
										<dd>{formatDate(caseDetail.case.resolvedAt)}</dd>
									</div>
								{/if}
							</dl>
						</Card>

						<!-- Resolution Summary -->
						{#if caseDetail.case.resolutionSummary}
							<Card variant="outlined" padding="md">
								<h3 class="font-semibold">Resolution</h3>
								<p class="mt-2 text-sm text-surface-600 dark:text-surface-400">
									{caseDetail.case.resolutionSummary}
								</p>
							</Card>
						{/if}
					</div>
				</div>
			{:else if activeTab === 'timeline'}
				<Card variant="outlined" padding="none">
					<div class="border-b border-surface-300-700 px-6 py-4">
						<h3 class="font-semibold">Full Timeline</h3>
					</div>
					{#if caseDetail.notes.length === 0 && caseDetail.statusHistory.length === 0}
						<div class="p-6">
							<EmptyState
								title="No activity yet"
								description="All case activity and status changes will appear here."
							/>
						</div>
					{:else}
						<div class="divide-y divide-surface-300-700">
							{#each caseDetail.notes as note}
								{@const NoteIcon = getNoteTypeIcon(note.noteType)}
								<div class="px-6 py-4">
									<div class="flex items-start gap-3">
										<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-200-800">
											<NoteIcon class="h-4 w-4 text-surface-500" />
										</div>
										<div class="flex-1 min-w-0">
											<div class="flex items-center gap-2">
												<span class="text-sm font-medium">
													{getNoteTypeLabel(note.noteType)}
												</span>
												<span class="text-xs text-surface-500">
													{formatDate(note.createdAt)}
												</span>
											</div>
											<p class="mt-1 text-sm text-surface-600 dark:text-surface-400">
												{note.content}
											</p>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</Card>
			{:else if activeTab === 'documents'}
				<Card variant="outlined" padding="none">
					<div class="border-b border-surface-300-700 px-6 py-4">
						<h3 class="font-semibold">Documents & Attachments</h3>
					</div>
					{#if caseDetail.attachments.length === 0}
						<div class="p-6">
							<EmptyState
								title="No documents"
								description="Documents and attachments related to this case will appear here."
							/>
						</div>
					{:else}
						<div class="divide-y divide-surface-300-700">
							{#each caseDetail.attachments as attachment}
								<div class="flex items-center justify-between px-6 py-4">
									<div class="flex items-center gap-3">
										<FileText class="h-5 w-5 text-surface-500" />
										<div>
											<p class="font-medium">{attachment.fileName}</p>
											<p class="text-sm text-surface-500">
												{(attachment.fileSize / 1024).toFixed(1)} KB • {formatShortDate(attachment.createdAt)}
											</p>
										</div>
									</div>
									<a
										href={attachment.fileUrl}
										target="_blank"
										rel="noopener noreferrer"
										class="btn preset-outlined-surface-500 btn-sm"
									>
										View
									</a>
								</div>
							{/each}
						</div>
					{/if}
				</Card>
			{:else if activeTab === 'participants'}
				<Card variant="outlined" padding="none">
					<div class="border-b border-surface-300-700 px-6 py-4">
						<h3 class="font-semibold">Participants</h3>
					</div>
					{#if caseDetail.participants.length === 0}
						<div class="p-6">
							<EmptyState
								title="No participants"
								description="People involved in this case will be listed here."
							/>
						</div>
					{:else}
						<div class="divide-y divide-surface-300-700">
							{#each caseDetail.participants as participant}
								<div class="flex items-center justify-between px-6 py-4">
									<div class="flex items-center gap-3">
										<div class="flex h-10 w-10 items-center justify-center rounded-full bg-surface-200-800">
											<Users class="h-5 w-5 text-surface-500" />
										</div>
										<div>
											<p class="font-medium">
												{participant.partyName || participant.externalContactName || 'Unknown'}
											</p>
											<p class="text-sm text-surface-500">{participant.role}</p>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</Card>
			{/if}
		{/if}
	</div>
</PageContainer>
