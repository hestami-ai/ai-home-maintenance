<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft, AlertTriangle, FileText, Clock, Send, TrendingUp, CheckCircle, Calendar, Pencil, DollarSign, ClipboardCheck, MessageSquare, Wrench, XCircle, Scale, AlertOctagon, Timer, Image, BookOpen } from 'lucide-svelte';
	import { TabbedContent, DecisionButton, RationaleModal, SendNoticeModal, ScheduleHearingModal, AssessFineModal, AppealModal, DocumentPicker } from '$lib/components/cam';
	import { Card, EmptyState } from '$lib/components/ui';
	import { refreshBadgeCounts } from '$lib/stores'; // Keeping only refreshBadgeCounts action
	import { violationApi, documentApi, activityEventApi, type ViolationDetail, type Document } from '$lib/api/cam';

	interface PriorViolation {
		id: string;
		violationNumber: string;
		title: string;
		status: string;
		severity: string;
		createdAt: string;
	}

	interface ViolationHistoryEvent {
		id: string;
		action: string;
		description: string;
		performedBy: string;
		actorType?: 'HUMAN' | 'SYSTEM';
		rationale?: string;
		relatedDocuments?: string[];
		createdAt: string;
	}

	interface ViolationNotice {
		id: string;
		noticeType: string;
		sentDate: string;
		recipient: string;
		deliveryStatus: string;
		templateName?: string;
	}

	interface OwnerResponse {
		id: string;
		submittedDate: string;
		content: string;
		submittedBy: string;
		hasAttachments: boolean;
		acknowledged: boolean;
	}

    let { data } = $props();

    // Derive state from props - updates when navigating between violations
	let violation = $derived<ViolationDetail | null>(data.violation);
	let documents = $derived<Document[]>(data.documents);
	let history = $derived<ViolationHistoryEvent[]>(data.history);
	let notices = $derived<ViolationNotice[]>(data.notices);
	let ownerResponses = $derived<OwnerResponse[]>(data.ownerResponses);
	
    // Secondary data (client-side fetch for now)
	let priorUnitViolations = $state<PriorViolation[]>([]);
	let priorTypeViolations = $state<PriorViolation[]>([]);
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	let showRationaleModal = $state(false);
	let rationaleAction = $state<{ type: string; label: string; variant: 'approve' | 'deny' | 'escalate' | 'default' } | null>(null);
	let isActionLoading = $state(false);

	let showSendNoticeModal = $state(false);
	let showScheduleHearingModal = $state(false);
	let showAssessFineModal = $state(false);
	let showAppealModal = $state(false);
	let showDocumentPicker = $state(false);
	let isLinkingDocument = $state(false);

	const violationId = $derived(($page.params as Record<string, string>).id);

    // Re-assign if data changes (e.g. navigation)
    $effect(() => {
        violation = data.violation;
        documents = data.documents;
        history = data.history;
        notices = data.notices;
        ownerResponses = data.ownerResponses;
    });

    // Helper to reload data manually if needed (for actions that don't fully reload page)
    // Ideally we should use `invalidateAll()` but existing methods below update state manually too.
    // We will keep existing methods but update them to use direct API or removed functions.
    // Actually, the original methods like `loadViolation` were called after actions. 
    // We should replace them with `invalidateAll` OR re-implement them to just update local state if we want to avoid full reload.
    // For now, I will keep `loadViolation` etc BUT make them valid functions again (copying logic back?) 
    // OR better: use `invalidateAll()` to refresh `data` prop.
    // The original code had specific loading functions. Let's reimplement them simply to wrap `invalidateAll` or specific refetch if we want to keep the "client-side refresh" pattern after an action without full page load.
    
    // HOWEVER, the implementation plan said "Remove loadViolation, loadDocuments".
    // So I should replace calls to `loadViolation()` with `goto($page.url, { invalidateAll: true })` or similar.
    // But wait, `data` prop updates automatically on invalidate.
    
    // Let's re-add local loaders if we want to support the "update after action" flow without full reload if possible,
    // OR just rely on `invalidateAll()`. `invalidateAll` is cleaner for SSR.
    
    // But I need to define the functions because the action handlers call them.
    
    async function refreshData() {
        // This is a simple way to refresh the data prop
        await goto($page.url, {  invalidateAll: true, replaceState: true, noScroll: true });
    }

	async function loadViolation() {
        await refreshData();
	}

	async function loadDocuments() {
        // We can just refresh all data
        await refreshData();
	}

	async function loadHistory() {
        await refreshData();
	}

    // loadNotices didn't exist in original code usages shown in previous turn? 
    // Wait, line 122 defined loadNotices.
    // I will stub them to just refresh data.

	async function loadNotices() { await refreshData(); }
	async function loadOwnerResponses() { await refreshData(); }

	async function loadPriorViolations() {
		if (!violation?.unitId) return;
		try {
			// Load violations for the same unit (excluding current)
			const unitRes = await violationApi.list({ unitId: violation.unitId });
			if (unitRes.ok) {
				priorUnitViolations = unitRes.data.violations
					.filter((v) => v.id !== violation?.id)
					.slice(0, 5)
					.map(v => ({
						id: v.id,
						violationNumber: v.violationNumber,
						title: v.title,
						status: v.status,
						severity: v.severity,
						createdAt: (v as any).createdAt || ''
					}));
			}

			// Load violations of the same type (excluding current)
			if (violation.violationTypeId) {
				const typeRes = await violationApi.list({ violationTypeId: violation.violationTypeId });
				if (typeRes.ok) {
					priorTypeViolations = typeRes.data.violations
						.filter((v) => v.id !== violation?.id)
						.slice(0, 5)
						.map(v => ({
							id: v.id,
							violationNumber: v.violationNumber,
							title: v.title,
							status: v.status,
							severity: v.severity,
							createdAt: (v as any).createdAt || ''
						}));
				}
			}
		} catch (e) {
			console.error('Failed to load prior violations:', e);
		}
	}

	function getActionAuditInfo(action: string): { event: string; newStatus: string; requiresRationale: boolean } {
		const auditMap: Record<string, { event: string; newStatus: string; requiresRationale: boolean }> = {
			'CONFIRM': { event: 'VIOLATION_CONFIRMED', newStatus: 'UNDER_REVIEW', requiresRationale: true },
			'MARK_INVALID': { event: 'VIOLATION_MARKED_INVALID', newStatus: 'CLOSED', requiresRationale: true },
			'SEND_NOTICE': { event: 'NOTICE_SENT', newStatus: 'NOTICE_SENT', requiresRationale: false },
			'REQUEST_RESPONSE': { event: 'OWNER_RESPONSE_REQUESTED', newStatus: 'OWNER_RESPONSE_PENDING', requiresRationale: true },
			'ESCALATE': { event: 'VIOLATION_ESCALATED', newStatus: 'ESCALATED', requiresRationale: true },
			'SCHEDULE_HEARING': { event: 'HEARING_SCHEDULED', newStatus: 'HEARING_SCHEDULED', requiresRationale: false },
			'ASSESS_FINE': { event: 'FINE_ASSESSED', newStatus: '(unchanged)', requiresRationale: false },
			'AUTHORIZE_REMEDIATION': { event: 'REMEDIATION_AUTHORIZED', newStatus: 'REMEDIATION_IN_PROGRESS', requiresRationale: false },
			'RESOLVE': { event: 'VIOLATION_RESOLVED', newStatus: 'RESOLVED', requiresRationale: true }
		};
		return auditMap[action] || { event: 'UNKNOWN', newStatus: '(unknown)', requiresRationale: false };
	}

	function getSeverityColor(severity: string): string {
		switch (severity) {
			case 'CRITICAL': return 'bg-error-500 text-white';
			case 'MAJOR': return 'bg-warning-500 text-white';
			case 'MODERATE': return 'bg-yellow-500 text-black';
			case 'MINOR': return 'bg-surface-400 text-white';
			default: return 'bg-surface-300 text-surface-700';
		}
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'DETECTED': return 'text-blue-500 bg-blue-500/10';
			case 'UNDER_REVIEW': return 'text-indigo-500 bg-indigo-500/10';
			case 'NOTICE_SENT': return 'text-warning-500 bg-warning-500/10';
			case 'OWNER_RESPONSE_PENDING': return 'text-orange-500 bg-orange-500/10';
			case 'CURE_PERIOD': return 'text-yellow-600 bg-yellow-500/10';
			case 'ESCALATED': return 'text-error-600 bg-error-500/20';
			case 'HEARING_SCHEDULED': return 'text-primary-500 bg-primary-500/10';
			case 'REMEDIATION_IN_PROGRESS': return 'text-cyan-500 bg-cyan-500/10';
			case 'RESOLVED': return 'text-success-500 bg-success-500/10';
			case 'CLOSED': return 'text-surface-500 bg-surface-500/10';
			default: return 'text-surface-500 bg-surface-500/10';
		}
	}

	function calculateSlaStatus(dueDate?: string, curePeriodDays?: number, createdAt?: string): { daysRemaining: number; isOverdue: boolean; urgency: 'low' | 'medium' | 'high' | 'critical' } | null {
		if (!dueDate && !curePeriodDays) return null;
		
		let targetDate: Date;
		if (dueDate) {
			targetDate = new Date(dueDate);
		} else if (curePeriodDays && createdAt) {
			targetDate = new Date(createdAt);
			targetDate.setDate(targetDate.getDate() + curePeriodDays);
		} else {
			return null;
		}

		const now = new Date();
		const diffMs = targetDate.getTime() - now.getTime();
		const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
		const isOverdue = daysRemaining < 0;

		let urgency: 'low' | 'medium' | 'high' | 'critical';
		if (isOverdue) {
			urgency = 'critical';
		} else if (daysRemaining <= 3) {
			urgency = 'high';
		} else if (daysRemaining <= 7) {
			urgency = 'medium';
		} else {
			urgency = 'low';
		}

		return { daysRemaining, isOverdue, urgency };
	}

	function getSlaColor(urgency: 'low' | 'medium' | 'high' | 'critical'): string {
		switch (urgency) {
			case 'critical': return 'text-error-500 bg-error-500/10';
			case 'high': return 'text-warning-500 bg-warning-500/10';
			case 'medium': return 'text-yellow-600 bg-yellow-500/10';
			case 'low': return 'text-success-500 bg-success-500/10';
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

	function openRationaleModal(type: string, label: string, variant: 'approve' | 'deny' | 'escalate' | 'default') {
		rationaleAction = { type, label, variant };
		showRationaleModal = true;
	}

	async function handleRationaleConfirm(rationale: string) {
		if (!violation || !rationaleAction) return;

		isActionLoading = true;
		try {
			const response = await (violationApi as any).recordAction(violation.id, {
				action: rationaleAction.type,
				notes: rationale,
				idempotencyKey: crypto.randomUUID()
			});

			if (response.ok) {
				await loadViolation();
				await loadHistory();
				await refreshBadgeCounts();
				showRationaleModal = false;
				rationaleAction = null;
			}
		} catch (e) {
			console.error('Failed to perform action:', e);
		} finally {
			isActionLoading = false;
		}
	}

	async function handleSendNotice(data: { templateId: string; noticeType: string; curePeriodDays: number; notes: string }) {
		if (!violation) return;

		isActionLoading = true;
		try {
			const response = await violationApi.sendNotice(violation.id, {
				noticeType: data.noticeType as any,
				subject: 'Violation Notice',
				body: data.notes || '',
				recipientName: '',
				deliveryMethod: 'EMAIL'
			});

			if (response.ok) {
				await loadViolation();
				await loadHistory();
				await refreshBadgeCounts();
				showSendNoticeModal = false;
			}
		} catch (e) {
			console.error('Failed to send notice:', e);
		} finally {
			isActionLoading = false;
		}
	}

	async function handleScheduleHearing(data: { hearingDate: string; hearingTime: string; location: string; notes: string }) {
		if (!violation) return;

		isActionLoading = true;
		try {
			const hearingDateTime = `${data.hearingDate}T${data.hearingTime}:00`;
			const response = await violationApi.scheduleHearing(violation.id, {
				hearingDate: hearingDateTime,
				location: data.location,
				notes: data.notes,
				idempotencyKey: crypto.randomUUID()
			});

			if (response.ok) {
				await loadViolation();
				await loadHistory();
				await refreshBadgeCounts();
				showScheduleHearingModal = false;
			}
		} catch (e) {
			console.error('Failed to schedule hearing:', e);
		} finally {
			isActionLoading = false;
		}
	}

	async function handleAssessFine(data: { amount: number; fineType: string; dueDate: string; notes: string }) {
		if (!violation) return;

		isActionLoading = true;
		try {
			const response = await violationApi.assessFine(violation.id, {
				amount: data.amount,
				fineType: data.fineType,
				dueDate: data.dueDate,
				notes: data.notes,
				idempotencyKey: crypto.randomUUID()
			});

			if (response.ok) {
				await loadViolation();
				await loadHistory();
				await refreshBadgeCounts();
				showAssessFineModal = false;
			}
		} catch (e) {
			console.error('Failed to assess fine:', e);
		} finally {
			isActionLoading = false;
		}
	}

	async function handleAppeal(data: { reason: string; requestBoardReview: boolean; supportingInfo: string }) {
		if (!violation) return;

		isActionLoading = true;
		try {
			const response = await violationApi.fileAppeal(violation.id, {
				reason: data.reason,
				idempotencyKey: crypto.randomUUID()
			});

			if (response.ok) {
				await loadViolation();
				await loadHistory();
				await refreshBadgeCounts();
				showAppealModal = false;
			}
		} catch (e) {
			console.error('Failed to file appeal:', e);
		} finally {
			isActionLoading = false;
		}
	}

	async function handleLinkDocuments(selectedDocs: Array<{ documentId: string; version: number; title: string }>) {
		if (!violationId || selectedDocs.length === 0) return;

		isLinkingDocument = true;
		try {
			for (const doc of selectedDocs) {
				const response = await documentApi.linkToContext({
					documentId: doc.documentId,
					contextType: 'VIOLATION',
					contextId: violationId,
					bindingNotes: `Linked to violation as supporting evidence`,
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
		if (violationId) {
			loadViolation();
			loadDocuments();
			loadHistory();
			loadNotices();
			loadOwnerResponses();
		}
	});

	$effect(() => {
		if (violation?.unitId) {
			loadPriorViolations();
		}
	});
</script>

<svelte:head>
	<title>{violation?.violationNumber || 'Violation'} | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto('/app/cam/violations')}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>

			{#if isLoading}
				<div class="h-6 w-48 animate-pulse rounded bg-surface-200-800"></div>
			{:else if violation}
				<div class="flex-1">
					<div class="flex items-center gap-2">
						<span class="text-sm text-surface-500">{violation.violationNumber}</span>
						<span class="rounded px-1.5 py-0.5 text-xs font-medium {getSeverityColor(violation.severity)}">
							{violation.severity}
						</span>
						<span class="rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(violation.status)}">
							{violation.status.replace(/_/g, ' ')}
						</span>
					</div>
					<h1 class="mt-1 text-xl font-semibold">{violation.title}</h1>
				</div>

				<div class="flex flex-wrap gap-2">
					<a
						href="/app/cam/violations/{violation.id}/edit"
						class="btn btn-sm preset-tonal-surface"
					>
						<Pencil class="mr-1 h-4 w-4" />
						Edit
					</a>
					{#if violation.status === 'DRAFT'}
						<DecisionButton
							variant="default"
							requiresRationale
							onclick={() => openRationaleModal('CONFIRM', 'Confirm Violation', 'default')}
						>
							<ClipboardCheck class="mr-1 h-4 w-4" />
							Confirm
						</DecisionButton>
						<DecisionButton
							variant="deny"
							requiresRationale
							onclick={() => openRationaleModal('MARK_INVALID', 'Mark Invalid', 'deny')}
						>
							<XCircle class="mr-1 h-4 w-4" />
							Invalid
						</DecisionButton>
					{/if}
					{#if ['UNDER_REVIEW', 'NOTICE_SENT', 'OWNER_RESPONSE_PENDING'].includes(violation.status)}
						<DecisionButton
							variant="default"
							onclick={() => showSendNoticeModal = true}
						>
							<Send class="mr-1 h-4 w-4" />
							Send Notice
						</DecisionButton>
					{/if}
					{#if violation.status === 'NOTICE_SENT'}
						<DecisionButton
							variant="default"
							requiresRationale
							onclick={() => openRationaleModal('REQUEST_RESPONSE', 'Request Owner Response', 'default')}
						>
							<MessageSquare class="mr-1 h-4 w-4" />
							Request Response
						</DecisionButton>
					{/if}
					{#if ['UNDER_REVIEW', 'NOTICE_SENT', 'OWNER_RESPONSE_PENDING', 'CURE_PERIOD'].includes(violation.status)}
						<DecisionButton
							variant="escalate"
							requiresRationale
							onclick={() => openRationaleModal('ESCALATE', 'Escalate', 'escalate')}
						>
							<TrendingUp class="mr-1 h-4 w-4" />
							Escalate
						</DecisionButton>
					{/if}
					{#if violation.status === 'ESCALATED'}
						<DecisionButton
							variant="default"
							onclick={() => showScheduleHearingModal = true}
						>
							<Calendar class="mr-1 h-4 w-4" />
							Schedule Hearing
						</DecisionButton>
						<DecisionButton
							variant="default"
							onclick={() => goto(`/app/cam/violations/${violation!.id}/remediation`)}
						>
							<Wrench class="mr-1 h-4 w-4" />
							Authorize Remediation
						</DecisionButton>
					{/if}
					{#if ['ESCALATED', 'HEARING_SCHEDULED', 'HEARING_HELD'].includes(violation.status)}
						<DecisionButton
							variant="deny"
							onclick={() => showAssessFineModal = true}
						>
							<DollarSign class="mr-1 h-4 w-4" />
							Assess Fine
						</DecisionButton>
					{/if}
					{#if !['DETECTED', 'RESOLVED', 'CLOSED'].includes(violation.status)}
						<DecisionButton
							variant="approve"
							requiresRationale
							onclick={() => openRationaleModal('RESOLVE', 'Resolve', 'approve')}
						>
							<CheckCircle class="mr-1 h-4 w-4" />
							Resolve
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
		{:else if violation}
			<TabbedContent
				tabs={[
					{ id: 'overview', label: 'Overview', content: overviewTab },
					{ id: 'actions', label: 'Actions', content: actionsTab },
					{ id: 'communications', label: 'Communications', content: communicationsTab, badge: notices.length + ownerResponses.length || undefined },
					{ id: 'documents', label: 'Documents', content: documentsTab },
					{ id: 'history', label: 'History', content: historyTab }
				]}
			/>
		{/if}
	</div>
</div>

{#snippet overviewTab()}
	{#if violation}
		{@const slaStatus = calculateSlaStatus((violation as any).dueDate, (violation as any).curePeriodDays, (violation as any).createdAt)}
		<div class="space-y-6">
			{#if (violation as any).hasHoaConflict}
				<div class="flex items-start gap-3 rounded-lg border border-error-500/50 bg-error-500/10 p-4">
					<AlertOctagon class="h-5 w-5 flex-shrink-0 text-error-500" />
					<div>
						<h4 class="font-semibold text-error-500">HOA Rule Conflict</h4>
						<p class="mt-1 text-sm text-surface-600">
							{(violation as any).hoaConflictNotes || 'This violation has a potential conflict with HOA governing documents. Manual review required.'}
						</p>
					</div>
				</div>
			{/if}

			{#if (violation as any).hasAppeal}
				<div class="flex items-start gap-3 rounded-lg border border-warning-500/50 bg-warning-500/10 p-4">
					<Scale class="h-5 w-5 flex-shrink-0 text-warning-500" />
					<div>
						<h4 class="font-semibold text-warning-600">Appeal Filed</h4>
						<p class="mt-1 text-sm text-surface-600">
							An appeal has been filed for this violation. Status: {(violation as any).appealStatus || 'Pending Review'}
						</p>
					</div>
				</div>
			{/if}

			{#if slaStatus && !['RESOLVED', 'CLOSED'].includes(violation.status)}
				<div class="flex items-center gap-3 rounded-lg border p-4 {getSlaColor(slaStatus.urgency)}">
					<Timer class="h-5 w-5 flex-shrink-0" />
					<div class="flex-1">
						<h4 class="font-semibold">
							{#if slaStatus.isOverdue}
								Overdue by {Math.abs(slaStatus.daysRemaining)} day{Math.abs(slaStatus.daysRemaining) !== 1 ? 's' : ''}
							{:else}
								{slaStatus.daysRemaining} day{slaStatus.daysRemaining !== 1 ? 's' : ''} remaining
							{/if}
						</h4>
						<p class="text-sm opacity-75">
							{(violation as any).dueDate ? `Due: ${formatDate((violation as any).dueDate)}` : `Cure period: ${(violation as any).curePeriodDays || violation.curePeriodEnds} days`}
						</p>
					</div>
				</div>
			{/if}

			<Card variant="outlined" padding="lg">
				<h3 class="mb-4 font-semibold">Violation Details</h3>
				<div class="space-y-4">
					<div>
						<h4 class="text-sm font-medium text-surface-500">Description</h4>
						<p class="mt-1">{violation.description || 'No description provided.'}</p>
					</div>

					<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						<div>
							<h4 class="text-sm font-medium text-surface-500">Violation Type</h4>
							<p class="mt-1">{(violation as any).violationTypeName || 'N/A'}</p>
						</div>
						<div>
							<h4 class="text-sm font-medium text-surface-500">Severity</h4>
							<p class="mt-1">
								<span class="rounded px-2 py-0.5 text-sm font-medium {getSeverityColor(violation.severity)}">
									{violation.severity}
								</span>
							</p>
						</div>
						<div>
							<h4 class="text-sm font-medium text-surface-500">Status</h4>
							<p class="mt-1">
								<span class="rounded-full px-2 py-0.5 text-sm font-medium {getStatusColor(violation.status)}">
									{violation.status.replace(/_/g, ' ')}
								</span>
							</p>
						</div>
					</div>
				</div>
			</Card>

			{#if (violation as any).violationTypeRuleText}
				<Card variant="outlined" padding="lg">
					<h3 class="mb-4 flex items-center gap-2 font-semibold">
						<BookOpen class="h-5 w-5 text-primary-500" />
						Governing Rule
					</h3>
					<div class="rounded-lg bg-surface-100-900 p-4">
						<p class="text-sm italic text-surface-600">"{(violation as any).violationTypeRuleText}"</p>
					</div>
					<p class="mt-2 text-xs text-surface-500">
						Rule associated with violation type: {(violation as any).violationTypeName}
					</p>
				</Card>
			{/if}

			<Card variant="outlined" padding="lg">
				<h3 class="mb-4 font-semibold">Location & Responsible Party</h3>
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<h4 class="text-sm font-medium text-surface-500">Unit</h4>
						<p class="mt-1">
							<a href="/app/cam/units/{violation.unitId}" class="text-primary-500 hover:underline">
								Unit {(violation as any).unitNumber || violation.violationNumber}
							</a>
						</p>
					</div>
					<div>
						<h4 class="text-sm font-medium text-surface-500">Responsible Party</h4>
						<p class="mt-1">{(violation as any).responsiblePartyName || '-'}</p>
					</div>
				</div>
			</Card>

			<Card variant="outlined" padding="lg">
				<h3 class="mb-4 font-semibold">Timeline</h3>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div>
						<h4 class="text-sm font-medium text-surface-500">Reported</h4>
						<p class="mt-1">{((violation as any).reportedDate || (violation as any).createdAt) ? formatDate((violation as any).reportedDate || (violation as any).createdAt || '') : '-'}</p>
					</div>
					{#if (violation as any).dueDate}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Due Date</h4>
							<p class="mt-1">{formatDate((violation as any).dueDate)}</p>
						</div>
					{/if}
					{#if (violation as any).resolvedDate}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Resolved</h4>
							<p class="mt-1">{formatDate((violation as any).resolvedDate)}</p>
						</div>
					{/if}
					<div>
						<h4 class="text-sm font-medium text-surface-500">Last Updated</h4>
						<p class="mt-1">{(violation as any).updatedAt ? formatDate((violation as any).updatedAt) : '-'}</p>
					</div>
				</div>
			</Card>

			{#if priorUnitViolations.length > 0 || priorTypeViolations.length > 0}
				<Card variant="outlined" padding="lg">
					<h3 class="mb-4 font-semibold flex items-center gap-2">
						<AlertTriangle class="h-5 w-5 text-warning-500" />
						Prior Violation History
					</h3>
					
					{#if priorUnitViolations.length > 0}
						<div class="mb-4">
							<h4 class="text-sm font-medium text-surface-500 mb-2">
								Same Unit ({priorUnitViolations.length} prior)
							</h4>
							<div class="space-y-2">
								{#each priorUnitViolations as pv}
									<a
										href="/app/cam/violations/{pv.id}"
										class="flex items-center justify-between rounded-lg border border-surface-300-700 p-2 text-sm hover:bg-surface-200-800"
									>
										<div class="flex items-center gap-2">
											<span class="text-surface-500">{pv.violationNumber}</span>
											<span class="truncate">{pv.title}</span>
										</div>
										<div class="flex items-center gap-2">
											<span class="rounded px-1.5 py-0.5 text-xs font-medium {getSeverityColor(pv.severity)}">
												{pv.severity}
											</span>
											<span class="rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(pv.status)}">
												{pv.status.replace(/_/g, ' ')}
											</span>
										</div>
									</a>
								{/each}
							</div>
						</div>
					{/if}

					{#if priorTypeViolations.length > 0}
						<div>
							<h4 class="text-sm font-medium text-surface-500 mb-2">
								Same Violation Type ({priorTypeViolations.length} prior)
							</h4>
							<div class="space-y-2">
								{#each priorTypeViolations as pv}
									<a
										href="/app/cam/violations/{pv.id}"
										class="flex items-center justify-between rounded-lg border border-surface-300-700 p-2 text-sm hover:bg-surface-200-800"
									>
										<div class="flex items-center gap-2">
											<span class="text-surface-500">{pv.violationNumber}</span>
											<span class="truncate">{pv.title}</span>
										</div>
										<div class="flex items-center gap-2">
											<span class="rounded px-1.5 py-0.5 text-xs font-medium {getSeverityColor(pv.severity)}">
												{pv.severity}
											</span>
											<span class="rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(pv.status)}">
												{pv.status.replace(/_/g, ' ')}
											</span>
										</div>
									</a>
								{/each}
							</div>
						</div>
					{/if}

					{#if priorUnitViolations.length > 0 || priorTypeViolations.length > 0}
						<p class="mt-3 text-xs text-warning-500">
							⚠️ This unit/type has prior violations. Consider escalation if pattern continues.
						</p>
					{/if}
				</Card>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet actionsTab()}
	{#if violation}
		<div class="space-y-6">
			{#if violation.status === 'DRAFT'}
				<Card variant="outlined" padding="lg">
					<h3 class="mb-4 font-semibold">Review & Confirmation</h3>
					<p class="mb-4 text-sm text-surface-500">
						This violation has been detected but not yet confirmed. Review the evidence and decide whether to proceed.
					</p>
					<div class="flex flex-wrap gap-3">
						<DecisionButton
							variant="default"
							requiresRationale
							onclick={() => openRationaleModal('CONFIRM', 'Confirm Violation', 'default')}
						>
							<ClipboardCheck class="mr-2 h-4 w-4" />
							Confirm Violation
						</DecisionButton>
						<DecisionButton
							variant="deny"
							requiresRationale
							onclick={() => openRationaleModal('MARK_INVALID', 'Mark Invalid', 'deny')}
						>
							<XCircle class="mr-2 h-4 w-4" />
							Mark as Invalid
						</DecisionButton>
					</div>
					<div class="mt-4 rounded-lg bg-surface-100-900 p-3 text-xs">
						<p class="font-medium text-surface-600">Audit Preview:</p>
						<ul class="mt-1 space-y-1 text-surface-500">
							<li>• <strong>Confirm:</strong> Creates VIOLATION_CONFIRMED event → Status: UNDER_REVIEW (requires rationale)</li>
							<li>• <strong>Invalid:</strong> Creates VIOLATION_MARKED_INVALID event → Status: CLOSED (requires rationale)</li>
						</ul>
					</div>
				</Card>
			{/if}

			{#if ['UNDER_REVIEW', 'NOTICE_SENT', 'OWNER_RESPONSE_PENDING'].includes(violation.status)}
				<Card variant="outlined" padding="lg">
					<h3 class="mb-4 font-semibold">Notice Actions</h3>
					<p class="mb-4 text-sm text-surface-500">
						Send official notices to the responsible party regarding this violation.
					</p>
					<div class="flex flex-wrap gap-3">
						<DecisionButton
							variant="default"
							onclick={() => showSendNoticeModal = true}
						>
							<Send class="mr-2 h-4 w-4" />
							Send Notice
						</DecisionButton>
						{#if violation.status === 'NOTICE_SENT'}
							<DecisionButton
								variant="default"
								requiresRationale
								onclick={() => openRationaleModal('REQUEST_RESPONSE', 'Request Owner Response', 'default')}
							>
								<MessageSquare class="mr-2 h-4 w-4" />
								Request Response
							</DecisionButton>
						{/if}
					</div>
					<div class="mt-4 rounded-lg bg-surface-100-900 p-3 text-xs">
						<p class="font-medium text-surface-600">Audit Preview:</p>
						<ul class="mt-1 space-y-1 text-surface-500">
							<li>• <strong>Send Notice:</strong> Creates NOTICE_SENT event → Status: NOTICE_SENT</li>
							<li>• <strong>Request Response:</strong> Creates OWNER_RESPONSE_REQUESTED event → Status: OWNER_RESPONSE_PENDING (requires rationale)</li>
						</ul>
					</div>
				</Card>
			{/if}

			{#if ['UNDER_REVIEW', 'NOTICE_SENT', 'OWNER_RESPONSE_PENDING', 'CURE_PERIOD'].includes(violation.status)}
				<Card variant="outlined" padding="lg">
					<h3 class="mb-4 font-semibold">Escalation</h3>
					<p class="mb-4 text-sm text-surface-500">
						Escalate this violation for further review or enforcement action.
					</p>
					<div class="flex flex-wrap gap-3">
						<DecisionButton
							variant="escalate"
							requiresRationale
							onclick={() => openRationaleModal('ESCALATE', 'Escalate', 'escalate')}
						>
							<TrendingUp class="mr-2 h-4 w-4" />
							Escalate Violation
						</DecisionButton>
					</div>
					<div class="mt-4 rounded-lg bg-surface-100-900 p-3 text-xs">
						<p class="font-medium text-surface-600">Audit Preview:</p>
						<p class="mt-1 text-surface-500">• Creates VIOLATION_ESCALATED event → Status: ESCALATED (requires rationale)</p>
					</div>
				</Card>
			{/if}

			{#if violation.status === 'ESCALATED'}
				<Card variant="outlined" padding="lg">
					<h3 class="mb-4 font-semibold">Escalated Actions</h3>
					<p class="mb-4 text-sm text-surface-500">
						This violation has been escalated. Schedule a hearing or authorize remediation.
					</p>
					<div class="flex flex-wrap gap-3">
						<DecisionButton
							variant="default"
							onclick={() => showScheduleHearingModal = true}
						>
							<Calendar class="mr-2 h-4 w-4" />
							Schedule Hearing
						</DecisionButton>
						<DecisionButton
							variant="default"
							onclick={() => goto(`/app/cam/violations/${violation!.id}/remediation`)}
						>
							<Wrench class="mr-2 h-4 w-4" />
							Authorize Remediation
						</DecisionButton>
					</div>
					<div class="mt-4 rounded-lg bg-surface-100-900 p-3 text-xs">
						<p class="font-medium text-surface-600">Audit Preview:</p>
						<ul class="mt-1 space-y-1 text-surface-500">
							<li>• <strong>Schedule Hearing:</strong> Creates HEARING_SCHEDULED event → Status: HEARING_SCHEDULED</li>
							<li>• <strong>Authorize Remediation:</strong> Creates REMEDIATION_AUTHORIZED event → Status: REMEDIATION_IN_PROGRESS</li>
						</ul>
					</div>
				</Card>
			{/if}

			{#if ['ESCALATED', 'HEARING_SCHEDULED', 'HEARING_HELD'].includes(violation.status)}
				<Card variant="outlined" padding="lg">
					<h3 class="mb-4 font-semibold">Enforcement</h3>
					<p class="mb-4 text-sm text-surface-500">
						Apply fines or other enforcement actions.
					</p>
					<div class="flex flex-wrap gap-3">
						<DecisionButton
							variant="deny"
							onclick={() => showAssessFineModal = true}
						>
							<DollarSign class="mr-2 h-4 w-4" />
							Assess Fine
						</DecisionButton>
					</div>
					<div class="mt-4 rounded-lg bg-surface-100-900 p-3 text-xs">
						<p class="font-medium text-surface-600">Audit Preview:</p>
						<p class="mt-1 text-surface-500">• Creates FINE_ASSESSED event → Status unchanged (fine amount recorded)</p>
					</div>
				</Card>
			{/if}

			{#if !['DETECTED', 'RESOLVED', 'CLOSED'].includes(violation.status)}
				<Card variant="outlined" padding="lg">
					<h3 class="mb-4 font-semibold">Resolution</h3>
					<p class="mb-4 text-sm text-surface-500">
						Mark this violation as resolved once the issue has been addressed.
					</p>
					<div class="flex flex-wrap gap-3">
						<DecisionButton
							variant="approve"
							requiresRationale
							onclick={() => openRationaleModal('RESOLVE', 'Resolve', 'approve')}
						>
							<CheckCircle class="mr-2 h-4 w-4" />
							Resolve Violation
						</DecisionButton>
					</div>
					<div class="mt-4 rounded-lg bg-surface-100-900 p-3 text-xs">
						<p class="font-medium text-surface-600">Audit Preview:</p>
						<p class="mt-1 text-surface-500">• Creates VIOLATION_RESOLVED event → Status: RESOLVED (requires rationale)</p>
					</div>
				</Card>
			{/if}

			{#if ['RESOLVED', 'CLOSED'].includes(violation.status)}
				<Card variant="outlined" padding="lg">
					<div class="flex items-center gap-3 text-success-500">
						<CheckCircle class="h-6 w-6" />
						<div>
							<h3 class="font-semibold">Violation {violation.status === 'CLOSED' ? 'Closed' : 'Resolved'}</h3>
							<p class="text-sm text-surface-500">No further actions available.</p>
						</div>
					</div>
				</Card>
			{/if}

			{#if !['DRAFT', 'CLOSED'].includes(violation.status)}
				<Card variant="outlined" padding="lg">
					<h3 class="mb-4 font-semibold flex items-center gap-2">
						<Scale class="h-5 w-5 text-primary-500" />
						Appeal
					</h3>
					<p class="mb-4 text-sm text-surface-500">
						Property owners may file an appeal to contest this violation. Appeals can optionally request Board review.
					</p>
					<div class="flex flex-wrap gap-3">
						<DecisionButton
							variant="default"
							onclick={() => showAppealModal = true}
						>
							<Scale class="mr-2 h-4 w-4" />
							File Appeal
						</DecisionButton>
					</div>
					<div class="mt-4 rounded-lg bg-surface-100-900 p-3 text-xs">
						<p class="font-medium text-surface-600">Audit Preview:</p>
						<p class="mt-1 text-surface-500">• Creates APPEAL_FILED event → Status unchanged (appeal flag set)</p>
					</div>
				</Card>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet communicationsTab()}
	<div class="space-y-6">
		<Card variant="outlined" padding="lg">
			<h3 class="mb-4 font-semibold">Notices Sent</h3>
			{#if notices.length === 0}
				<EmptyState
					title="No notices sent"
					description="Notices sent to the responsible party will appear here."
				/>
			{:else}
				<div class="divide-y divide-surface-300-700">
					{#each notices as notice}
						<div class="py-3">
							<div class="flex items-start justify-between gap-2">
								<div>
									<p class="font-medium">{notice.noticeType.replace(/_/g, ' ')}</p>
									<p class="text-sm text-surface-500">
										To: {notice.recipient} · {formatDateTime(notice.sentDate)}
									</p>
									{#if notice.templateName}
										<p class="text-xs text-surface-400">Template: {notice.templateName}</p>
									{/if}
								</div>
								<span class="rounded-full px-2 py-0.5 text-xs font-medium {notice.deliveryStatus === 'DELIVERED' ? 'bg-success-500/10 text-success-500' : notice.deliveryStatus === 'FAILED' ? 'bg-error-500/10 text-error-500' : 'bg-warning-500/10 text-warning-500'}">
									{notice.deliveryStatus}
								</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</Card>

		<Card variant="outlined" padding="lg">
			<h3 class="mb-4 font-semibold">Owner Responses</h3>
			{#if ownerResponses.length === 0}
				<EmptyState
					title="No responses"
					description="Responses from the property owner will appear here."
				/>
			{:else}
				<div class="space-y-4">
					{#each ownerResponses as response}
						<div class="rounded-lg border border-surface-300-700 p-4">
							<div class="mb-2 flex items-start justify-between gap-2">
								<div>
									<p class="font-medium">{response.submittedBy}</p>
									<p class="text-xs text-surface-400">{formatDateTime(response.submittedDate)}</p>
								</div>
								<div class="flex items-center gap-2">
									{#if response.hasAttachments}
										<span class="text-xs text-surface-500">Has attachments</span>
									{/if}
									{#if response.acknowledged}
										<span class="rounded-full bg-success-500/10 px-2 py-0.5 text-xs font-medium text-success-500">
											Acknowledged
										</span>
									{:else}
										<span class="rounded-full bg-warning-500/10 px-2 py-0.5 text-xs font-medium text-warning-500">
											Pending Review
										</span>
									{/if}
								</div>
							</div>
							<p class="text-sm text-surface-600">{response.content}</p>
							{#if !response.acknowledged}
								<div class="mt-3 flex gap-2">
									<button
										type="button"
										class="btn btn-sm preset-tonal-surface"
										onclick={() => {/* TODO: Acknowledge response */}}
									>
										Acknowledge
									</button>
									<a
										href="/app/cam/violations/{violationId}/response/{response.id}"
										class="btn btn-sm preset-tonal-primary"
									>
										View Details
									</a>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</Card>
	</div>
{/snippet}

{#snippet documentsTab()}
	<Card variant="outlined" padding="lg">
		<div class="mb-4 flex items-center justify-between">
			<h3 class="font-semibold">Supporting Documents</h3>
			<div class="flex gap-2">
				<button
					type="button"
					onclick={() => showDocumentPicker = true}
					class="btn btn-sm preset-tonal-surface"
				>
					<FileText class="mr-1 h-4 w-4" />
					Link Existing
				</button>
				<a href="/app/cam/documents/upload?contextType=VIOLATION&contextId={violationId}" class="btn btn-sm preset-filled-primary-500">
					Upload New
				</a>
			</div>
		</div>

		{#if documents.length === 0}
			<EmptyState
				title="No documents"
				description="Evidence, notices, and other documents will appear here."
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
				description="Status changes and activity will appear here."
			/>
		{:else}
			<div class="relative space-y-0">
				<div class="absolute left-4 top-0 h-full w-0.5 bg-surface-200-800"></div>
				{#each history as event, i}
					<div class="relative flex gap-4 pb-6 {i === history.length - 1 ? 'pb-0' : ''}">
						<div class="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full {event.actorType === 'SYSTEM' ? 'bg-surface-300-700' : 'bg-primary-500/20'}">
							{#if event.actorType === 'SYSTEM'}
								<Clock class="h-4 w-4 text-surface-500" />
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
								<span class="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {event.actorType === 'SYSTEM' ? 'bg-surface-200-800 text-surface-500' : 'bg-primary-500/10 text-primary-500'}">
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

<RationaleModal
	open={showRationaleModal}
	title={rationaleAction?.label || 'Confirm Action'}
	actionLabel={rationaleAction?.label || 'Confirm'}
	actionVariant={rationaleAction?.variant || 'default'}
	loading={isActionLoading}
	onConfirm={handleRationaleConfirm}
	onCancel={() => {
		showRationaleModal = false;
		rationaleAction = null;
	}}
/>

{#if violation}
	<SendNoticeModal
		open={showSendNoticeModal}
		violationId={violation.id}
		violationNumber={violation.violationNumber}
		loading={isActionLoading}
		onConfirm={handleSendNotice}
		onCancel={() => showSendNoticeModal = false}
	/>

	<ScheduleHearingModal
		open={showScheduleHearingModal}
		violationId={violation.id}
		violationNumber={violation.violationNumber}
		loading={isActionLoading}
		onConfirm={handleScheduleHearing}
		onCancel={() => showScheduleHearingModal = false}
	/>

	<AssessFineModal
		open={showAssessFineModal}
		violationId={violation.id}
		violationNumber={violation.violationNumber}
		loading={isActionLoading}
		onConfirm={handleAssessFine}
		onCancel={() => showAssessFineModal = false}
	/>

	<AppealModal
		open={showAppealModal}
		violationNumber={violation.violationNumber}
		onclose={() => showAppealModal = false}
		onsubmit={handleAppeal}
	/>

	<DocumentPicker
		bind:open={showDocumentPicker}
		multiSelect={true}
		categoryFilter="EVIDENCE_INSPECTIONS"
		onClose={() => showDocumentPicker = false}
		onSelect={handleLinkDocuments}
	/>
{/if}
