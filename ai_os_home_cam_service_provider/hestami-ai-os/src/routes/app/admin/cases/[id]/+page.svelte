<script lang="ts">
	import { page } from '$app/stores';
	import { ConciergeCaseStatusValues, ConciergeCasePriorityValues, CaseNoteTypeValues, ConciergeActionTypeValues, ConciergeActionStatusValues } from '$lib/api/cam';
	import { CommunicationChannel, CommunicationDirection } from '../../../../../../generated/prisma/enums.js';
	import { orpc } from '$lib/api';
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
		CheckCircle,
		AlertTriangle,
		Activity,
		Shield,
		Loader2,
		RefreshCw,
		ChevronRight,
		Calendar,
		MapPin,
		Phone,
		Mail,
		ExternalLink,
		Image,
		Video,
		File,
		Download,
		Paperclip,
		Building2,
		X,
		Eye,
		Play as PlayIcon,
		Plus,
		Square,
		Ban,
		CircleSlash,
		Star,
		Edit,
		Save,
		DollarSign,
		Check,
		XCircle,
		Zap,
		TrendingDown
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import { Select } from 'flowbite-svelte';
	import { invalidate } from '$app/navigation';

	// Get data from server load function
	let { data } = $props();
	// Use $state with $effect to avoid proxy errors during navigation
	let caseDetail = $state<any>(null);

	$effect(() => {
		// Track data to trigger re-runs on navigation, but guard against undefined
		if (data != null && typeof data === 'object') {
			caseDetail = data.caseDetail ?? null;
		}
	});

	let activeTab = $state<string>('overview');
	let isRefreshing = $state(false);

	// Quick Action Modal States
	let showReassignModal = $state(false);
	let showStatusModal = $state(false);
	let showNoteModal = $state(false);

	// Reassign state
	let staffMembers = $state<Array<{ id: string; userId: string; displayName: string }>>([]);
	let isLoadingStaff = $state(false);
	let selectedStaffUserId = $state<string | null>(null);
	let isReassigning = $state(false);
	let reassignError = $state<string | null>(null);

	// Status change state
	let selectedStatus = $state<string>('');
	let statusReason = $state('');
	let isChangingStatus = $state(false);
	let statusError = $state<string | null>(null);

	// Add note state
	let noteContent = $state('');
	let noteType = $state<string>(CaseNoteTypeValues.GENERAL);
	let isInternalNote = $state(true);
	let isAddingNote = $state(false);
	let noteError = $state<string | null>(null);

	// Action management state
	let showCreateActionModal = $state(false);
	let showActionModal = $state(false);
	let selectedAction = $state<any>(null);
	let actionModalMode = $state<'start' | 'complete' | 'block' | 'cancel'>('start');

	// Create action form state
	let newActionType = $state<string>(ConciergeActionTypeValues.OTHER);
	let newActionDescription = $state('');
	let newActionNotes = $state('');
	let isCreatingAction = $state(false);
	let createActionError = $state<string | null>(null);

	// Action operation state
	let actionOutcome = $state('');
	let actionBlockReason = $state('');
	let actionCancelReason = $state('');
	let isProcessingAction = $state(false);
	let actionError = $state<string | null>(null);

	// Case Review state
	interface CaseReview {
		id: string;
		caseId: string;
		outcomeSummary: string;
		vendorPerformanceNotes: string | null;
		issuesEncountered: string | null;
		lessonsLearned: string | null;
		vendorRating: number | null;
		communicationRating: number | null;
		timelinessRating: number | null;
		overallSatisfaction: number | null;
		reusableVendor: boolean;
		reusableScope: boolean;
		reusableProcess: boolean;
		reviewedByUserId: string;
		reviewedByUserName: string | null;
		reviewedAt: string;
	}
	let existingReview = $state<CaseReview | null>(null);
	let isLoadingReview = $state(false);
	let reviewLoaded = $state(false);
	let isEditingReview = $state(false);
	let isSavingReview = $state(false);
	let reviewError = $state<string | null>(null);

	// Review form state
	let reviewOutcomeSummary = $state('');
	let reviewVendorNotes = $state('');
	let reviewIssues = $state('');
	let reviewLessons = $state('');
	let reviewVendorRating = $state<number | null>(null);
	let reviewCommRating = $state<number | null>(null);
	let reviewTimelinessRating = $state<number | null>(null);
	let reviewOverallRating = $state<number | null>(null);
	let reviewReusableVendor = $state(false);
	let reviewReusableScope = $state(false);
	let reviewReusableProcess = $state(false);

	// Bids Tab State
	interface BidComparison {
		id: string;
		vendorName: string;
		amount: string | null;
		laborCost: string | null;
		materialsCost: string | null;
		otherCosts: string | null;
		estimatedDuration: number | null;
		status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
		validUntil: string | null;
		isLowest: boolean;
		isFastest: boolean;
	}
	interface BidComparisonData {
		caseId: string;
		bids: BidComparison[];
		lowestBidId: string | null;
		fastestBidId: string | null;
		averageAmount: string | null;
	}
	let bidsData = $state<BidComparisonData | null>(null);
	let isLoadingBids = $state(false);
	let bidsLoaded = $state(false);
	let bidsError = $state<string | null>(null);

	// Scope amendment state
	let showScopeAmendmentModal = $state(false);
	let scopeAmendmentContent = $state('');
	let isAddingScopeAmendment = $state(false);
	let scopeAmendmentError = $state<string | null>(null);

	// Communication state
	interface CaseCommunicationItem {
		id: string;
		channel: string;
		direction: string;
		subject: string | null;
		contentPreview: string;
		fromUserName: string | null;
		toRecipient: string | null;
		sentAt: string | null;
		createdAt: string;
	}
	let communications = $state<CaseCommunicationItem[]>([]);
	let isLoadingComms = $state(false);
	let commsLoaded = $state(false);
	let commsError = $state<string | null>(null);

	// Message composer state
	let showMessageComposerModal = $state(false);
	let messageChannel = $state<string>(CommunicationChannel.EMAIL);
	let messageDirection = $state<string>(CommunicationDirection.OUTBOUND);
	let messageSubject = $state('');
	let messageContent = $state('');
	let messageRecipient = $state('');
	let isSendingMessage = $state(false);
	let messageError = $state<string | null>(null);

	// Timeline entry state
	let showTimelineEntryModal = $state(false);
	let timelineEntryTitle = $state('');
	let timelineEntryContent = $state('');
	let isAddingTimelineEntry = $state(false);
	let timelineEntryError = $state<string | null>(null);

	// Bid action state
	let showAcceptBidModal = $state(false);
	let showRejectBidModal = $state(false);
	let selectedBid = $state<BidComparison | null>(null);
	let bidActionReason = $state('');
	let isProcessingBidAction = $state(false);
	let bidActionError = $state<string | null>(null);

	// Valid action status transitions
	const ACTION_STATUS_TRANSITIONS: Record<string, string[]> = {
		[ConciergeActionStatusValues.PLANNED]: [ConciergeActionStatusValues.IN_PROGRESS, ConciergeActionStatusValues.CANCELLED],
		[ConciergeActionStatusValues.IN_PROGRESS]: [ConciergeActionStatusValues.COMPLETED, ConciergeActionStatusValues.BLOCKED, ConciergeActionStatusValues.CANCELLED],
		[ConciergeActionStatusValues.BLOCKED]: [ConciergeActionStatusValues.IN_PROGRESS, ConciergeActionStatusValues.CANCELLED],
		[ConciergeActionStatusValues.COMPLETED]: [],
		[ConciergeActionStatusValues.CANCELLED]: []
	};

	// Valid status transitions
	const STATUS_TRANSITIONS: Record<string, string[]> = {
		[ConciergeCaseStatusValues.INTAKE]: [ConciergeCaseStatusValues.ASSESSMENT, ConciergeCaseStatusValues.CANCELLED],
		[ConciergeCaseStatusValues.ASSESSMENT]: [ConciergeCaseStatusValues.IN_PROGRESS, ConciergeCaseStatusValues.PENDING_EXTERNAL, ConciergeCaseStatusValues.PENDING_OWNER, ConciergeCaseStatusValues.ON_HOLD, ConciergeCaseStatusValues.CANCELLED],
		[ConciergeCaseStatusValues.IN_PROGRESS]: [ConciergeCaseStatusValues.PENDING_EXTERNAL, ConciergeCaseStatusValues.PENDING_OWNER, ConciergeCaseStatusValues.ON_HOLD, ConciergeCaseStatusValues.RESOLVED, ConciergeCaseStatusValues.CANCELLED],
		[ConciergeCaseStatusValues.PENDING_EXTERNAL]: [ConciergeCaseStatusValues.IN_PROGRESS, ConciergeCaseStatusValues.ON_HOLD, ConciergeCaseStatusValues.CANCELLED],
		[ConciergeCaseStatusValues.PENDING_OWNER]: [ConciergeCaseStatusValues.IN_PROGRESS, ConciergeCaseStatusValues.ON_HOLD, ConciergeCaseStatusValues.CANCELLED],
		[ConciergeCaseStatusValues.ON_HOLD]: [ConciergeCaseStatusValues.IN_PROGRESS, ConciergeCaseStatusValues.CANCELLED],
		[ConciergeCaseStatusValues.RESOLVED]: [ConciergeCaseStatusValues.CLOSED],
		[ConciergeCaseStatusValues.CLOSED]: [],
		[ConciergeCaseStatusValues.CANCELLED]: []
	};

	const availableStatuses = $derived(
		caseDetail?.case?.status ? STATUS_TRANSITIONS[caseDetail.case.status] || [] : []
	);

	async function refresh() {
		isRefreshing = true;
		try {
			await invalidate('data');
		} finally {
			isRefreshing = false;
		}
	}

	// Load staff members for reassignment
	async function loadStaffMembers() {
		if (staffMembers.length > 0) return; // Already loaded
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

	// Open reassign modal
	async function openReassignModal() {
		reassignError = null;
		selectedStaffUserId = caseDetail?.case?.assignedConciergeUserId ?? null;
		showReassignModal = true;
		await loadStaffMembers();
	}

	// Reassign case
	async function reassignCase() {
		if (!caseDetail?.case?.id || isReassigning) return;
		isReassigning = true;
		reassignError = null;

		try {
			await orpc.staffConciergeCase.assign({
				idempotencyKey: crypto.randomUUID(),
				id: caseDetail.case.id,
				assignedConciergeUserId: selectedStaffUserId
			});
			showReassignModal = false;
			await refresh();
		} catch (err) {
			console.error('Failed to reassign:', err);
			reassignError = err instanceof Error ? err.message : 'Failed to reassign case';
		} finally {
			isReassigning = false;
		}
	}

	// Open status modal
	function openStatusModal() {
		statusError = null;
		selectedStatus = '';
		statusReason = '';
		showStatusModal = true;
	}

	// Change status
	async function changeStatus() {
		if (!caseDetail?.case?.id || !selectedStatus || isChangingStatus) return;
		isChangingStatus = true;
		statusError = null;

		try {
			await orpc.staffConciergeCase.updateStatus({
				idempotencyKey: crypto.randomUUID(),
				id: caseDetail.case.id,
				status: selectedStatus as any,
				reason: statusReason.trim() || undefined
			});
			showStatusModal = false;
			await refresh();
		} catch (err) {
			console.error('Failed to change status:', err);
			statusError = err instanceof Error ? err.message : 'Failed to change status';
		} finally {
			isChangingStatus = false;
		}
	}

	// Open note modal
	function openNoteModal() {
		noteError = null;
		noteContent = '';
		noteType = CaseNoteTypeValues.GENERAL;
		isInternalNote = true;
		showNoteModal = true;
	}

	// Add note
	async function addNote() {
		if (!caseDetail?.case?.id || !noteContent.trim() || isAddingNote) return;
		isAddingNote = true;
		noteError = null;

		try {
			await orpc.staffConciergeCase.addNote({
				idempotencyKey: crypto.randomUUID(),
				caseId: caseDetail.case.id,
				content: noteContent.trim(),
				noteType: noteType as any,
				isInternal: isInternalNote
			});
			showNoteModal = false;
			await refresh();
		} catch (err) {
			console.error('Failed to add note:', err);
			noteError = err instanceof Error ? err.message : 'Failed to add note';
		} finally {
			isAddingNote = false;
		}
	}

	// Action management functions
	function openCreateActionModal() {
		createActionError = null;
		newActionType = ConciergeActionTypeValues.OTHER;
		newActionDescription = '';
		newActionNotes = '';
		showCreateActionModal = true;
	}

	async function createAction() {
		if (!caseDetail?.case?.id || !newActionDescription.trim() || isCreatingAction) return;
		isCreatingAction = true;
		createActionError = null;

		try {
			await orpc.staffConciergeAction.create({
				idempotencyKey: crypto.randomUUID(),
				caseId: caseDetail.case.id,
				actionType: newActionType as any,
				description: newActionDescription.trim(),
				notes: newActionNotes.trim() || undefined
			});
			showCreateActionModal = false;
			await refresh();
		} catch (err) {
			console.error('Failed to create action:', err);
			createActionError = err instanceof Error ? err.message : 'Failed to create action';
		} finally {
			isCreatingAction = false;
		}
	}

	function openActionModal(action: any, mode: 'start' | 'complete' | 'block' | 'cancel') {
		actionError = null;
		selectedAction = action;
		actionModalMode = mode;
		actionOutcome = '';
		actionBlockReason = '';
		actionCancelReason = '';
		showActionModal = true;
	}

	async function processAction() {
		if (!selectedAction?.id || isProcessingAction) return;
		isProcessingAction = true;
		actionError = null;

		try {
			switch (actionModalMode) {
				case 'start':
					await orpc.staffConciergeAction.start({
						idempotencyKey: crypto.randomUUID(),
						id: selectedAction.id
					});
					break;
				case 'complete':
					if (!actionOutcome.trim()) {
						actionError = 'Outcome is required';
						isProcessingAction = false;
						return;
					}
					await orpc.staffConciergeAction.complete({
						idempotencyKey: crypto.randomUUID(),
						id: selectedAction.id,
						outcome: actionOutcome.trim()
					});
					break;
				case 'block':
					if (!actionBlockReason.trim()) {
						actionError = 'Reason is required';
						isProcessingAction = false;
						return;
					}
					await orpc.staffConciergeAction.block({
						idempotencyKey: crypto.randomUUID(),
						id: selectedAction.id,
						reason: actionBlockReason.trim()
					});
					break;
				case 'cancel':
					await orpc.staffConciergeAction.cancel({
						idempotencyKey: crypto.randomUUID(),
						id: selectedAction.id,
						reason: actionCancelReason.trim() || undefined
					});
					break;
			}
			showActionModal = false;
			await refresh();
		} catch (err) {
			console.error('Failed to process action:', err);
			actionError = err instanceof Error ? err.message : 'Failed to process action';
		} finally {
			isProcessingAction = false;
		}
	}

	function getActionStatusColor(status: string): string {
		const colors: Record<string, string> = {
			[ConciergeActionStatusValues.PLANNED]: 'preset-filled-secondary-500',
			[ConciergeActionStatusValues.IN_PROGRESS]: 'preset-filled-warning-500',
			[ConciergeActionStatusValues.COMPLETED]: 'preset-filled-success-500',
			[ConciergeActionStatusValues.BLOCKED]: 'preset-filled-error-500',
			[ConciergeActionStatusValues.CANCELLED]: 'preset-outlined-surface-500'
		};
		return colors[status] || 'preset-filled-surface-500';
	}

	function getActionTypeLabel(type: string): string {
		const labels: Record<string, string> = {
			[ConciergeActionTypeValues.PHONE_CALL]: 'Phone Call',
			[ConciergeActionTypeValues.EMAIL]: 'Email',
			[ConciergeActionTypeValues.DOCUMENT_REVIEW]: 'Document Review',
			[ConciergeActionTypeValues.RESEARCH]: 'Research',
			[ConciergeActionTypeValues.VENDOR_CONTACT]: 'Vendor Contact',
			[ConciergeActionTypeValues.HOA_CONTACT]: 'HOA Contact',
			[ConciergeActionTypeValues.SCHEDULING]: 'Scheduling',
			[ConciergeActionTypeValues.APPROVAL_REQUEST]: 'Approval Request',
			[ConciergeActionTypeValues.FOLLOW_UP]: 'Follow Up',
			[ConciergeActionTypeValues.ESCALATION]: 'Escalation',
			[ConciergeActionTypeValues.OTHER]: 'Other'
		};
		return labels[type] || type;
	}

	function canTransitionAction(action: any, targetStatus: string): boolean {
		const validTransitions = ACTION_STATUS_TRANSITIONS[action.status] || [];
		return validTransitions.includes(targetStatus);
	}

	function getStatusLabel(status: string): string {
		const labels: Record<string, string> = {
			[ConciergeCaseStatusValues.INTAKE]: 'Intake',
			[ConciergeCaseStatusValues.ASSESSMENT]: 'Assessment',
			[ConciergeCaseStatusValues.IN_PROGRESS]: 'In Progress',
			[ConciergeCaseStatusValues.PENDING_EXTERNAL]: 'Pending External',
			[ConciergeCaseStatusValues.PENDING_OWNER]: 'Pending Owner',
			[ConciergeCaseStatusValues.ON_HOLD]: 'On Hold',
			[ConciergeCaseStatusValues.RESOLVED]: 'Resolved',
			[ConciergeCaseStatusValues.CLOSED]: 'Closed',
			[ConciergeCaseStatusValues.CANCELLED]: 'Cancelled'
		};
		return labels[status] || status;
	}

	function getStatusColor(status: string): string {
		const colors: Record<string, string> = {
			[ConciergeCaseStatusValues.INTAKE]: 'preset-filled-primary-500',
			[ConciergeCaseStatusValues.ASSESSMENT]: 'preset-filled-secondary-500',
			[ConciergeCaseStatusValues.IN_PROGRESS]: 'preset-filled-warning-500',
			[ConciergeCaseStatusValues.PENDING_EXTERNAL]: 'preset-filled-tertiary-500',
			[ConciergeCaseStatusValues.PENDING_OWNER]: 'preset-filled-error-500',
			[ConciergeCaseStatusValues.ON_HOLD]: 'preset-filled-surface-500',
			[ConciergeCaseStatusValues.RESOLVED]: 'preset-filled-success-500',
			[ConciergeCaseStatusValues.CLOSED]: 'preset-outlined-surface-500',
			[ConciergeCaseStatusValues.CANCELLED]: 'preset-outlined-surface-500'
		};
		return colors[status] || 'preset-filled-surface-500';
	}

	function getPriorityBadgeClass(priority: string): string {
		const colors: Record<string, string> = {
			[ConciergeCasePriorityValues.LOW]: 'preset-outlined-surface-500',
			[ConciergeCasePriorityValues.NORMAL]: 'preset-outlined-primary-500',
			[ConciergeCasePriorityValues.HIGH]: 'preset-filled-warning-500',
			[ConciergeCasePriorityValues.URGENT]: 'preset-filled-error-500',
			[ConciergeCasePriorityValues.EMERGENCY]: 'preset-filled-error-500'
		};
		return colors[priority] || 'preset-outlined-surface-500';
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

	function getTimeInState(updatedAt: string): string {
		const ms = Date.now() - new Date(updatedAt).getTime();
		const hours = Math.floor(ms / (1000 * 60 * 60));
		const days = Math.floor(hours / 24);
		if (days > 0) return `${days}d ${hours % 24}h`;
		if (hours > 0) return `${hours}h`;
		return 'Just now';
	}

	// SLA thresholds by priority (in hours)
	const SLA_THRESHOLDS: Record<string, { response: number; resolution: number }> = {
		[ConciergeCasePriorityValues.EMERGENCY]: { response: 2, resolution: 8 },
		[ConciergeCasePriorityValues.URGENT]: { response: 4, resolution: 24 },
		[ConciergeCasePriorityValues.HIGH]: { response: 8, resolution: 48 },
		[ConciergeCasePriorityValues.NORMAL]: { response: 24, resolution: 120 },
		[ConciergeCasePriorityValues.LOW]: { response: 48, resolution: 240 }
	};

	// Terminal statuses that don't have SLA concerns
	const TERMINAL_STATUSES: string[] = [
		ConciergeCaseStatusValues.RESOLVED,
		ConciergeCaseStatusValues.CLOSED,
		ConciergeCaseStatusValues.CANCELLED
	];

	// Calculate SLA status based on case age and priority
	function calculateSlaStatus(createdAt: string, priority: string, status: string): {
		status: 'on-track' | 'at-risk' | 'breached' | 'completed';
		label: string;
		hoursRemaining?: number;
		percentUsed: number;
	} {
		// Terminal statuses are "completed" SLA-wise
		if (TERMINAL_STATUSES.includes(status)) {
			return { status: 'completed', label: 'Completed', percentUsed: 0 };
		}

		const thresholds = SLA_THRESHOLDS[priority] || SLA_THRESHOLDS[ConciergeCasePriorityValues.NORMAL];
		const ageMs = Date.now() - new Date(createdAt).getTime();
		const ageHours = ageMs / (1000 * 60 * 60);

		// Use response SLA for early statuses, resolution SLA for in-progress
		const isEarlyStatus = status === ConciergeCaseStatusValues.INTAKE || status === ConciergeCaseStatusValues.ASSESSMENT;
		const slaHours = isEarlyStatus ? thresholds.response : thresholds.resolution;

		const percentUsed = (ageHours / slaHours) * 100;
		const hoursRemaining = Math.max(0, slaHours - ageHours);

		if (percentUsed >= 100) {
			return { status: 'breached', label: 'SLA Breached', hoursRemaining: 0, percentUsed };
		} else if (percentUsed >= 75) {
			return { status: 'at-risk', label: 'At Risk', hoursRemaining, percentUsed };
		} else {
			return { status: 'on-track', label: 'On Track', hoursRemaining, percentUsed };
		}
	}

	function getSlaStatusClass(slaStatus: 'on-track' | 'at-risk' | 'breached' | 'completed'): string {
		const classes: Record<string, string> = {
			'on-track': 'preset-filled-success-500',
			'at-risk': 'preset-filled-warning-500',
			'breached': 'preset-filled-error-500',
			'completed': 'preset-outlined-surface-500'
		};
		return classes[slaStatus] || 'preset-filled-surface-500';
	}

	function formatHoursRemaining(hours: number | undefined): string {
		if (hours === undefined || hours <= 0) return '';
		if (hours < 1) return `${Math.round(hours * 60)}m left`;
		if (hours < 24) return `${Math.round(hours)}h left`;
		const days = Math.floor(hours / 24);
		const remainingHours = Math.round(hours % 24);
		return `${days}d ${remainingHours}h left`;
	}

	// Derived SLA status for current case
	const slaInfo = $derived(
		caseDetail?.case
			? calculateSlaStatus(caseDetail.case.createdAt, caseDetail.case.priority, caseDetail.case.status)
			: null
	);

	// Load existing review when Review tab is opened
	async function loadReview() {
		if (!caseDetail?.case?.id || reviewLoaded) return;
		isLoadingReview = true;
		reviewError = null;
		try {
			const response = await orpc.caseReview.getByCase({ caseId: caseDetail.case.id });
			if (response.ok && response.data.review) {
				existingReview = response.data.review as CaseReview;
				// Populate form with existing data
				reviewOutcomeSummary = existingReview.outcomeSummary;
				reviewVendorNotes = existingReview.vendorPerformanceNotes || '';
				reviewIssues = existingReview.issuesEncountered || '';
				reviewLessons = existingReview.lessonsLearned || '';
				reviewVendorRating = existingReview.vendorRating;
				reviewCommRating = existingReview.communicationRating;
				reviewTimelinessRating = existingReview.timelinessRating;
				reviewOverallRating = existingReview.overallSatisfaction;
				reviewReusableVendor = existingReview.reusableVendor;
				reviewReusableScope = existingReview.reusableScope;
				reviewReusableProcess = existingReview.reusableProcess;
			}
			reviewLoaded = true;
		} catch (e) {
			reviewError = e instanceof Error ? e.message : 'Failed to load review';
		} finally {
			isLoadingReview = false;
		}
	}

	// Start editing review
	function startEditReview() {
		isEditingReview = true;
	}

	// Cancel editing
	function cancelEditReview() {
		isEditingReview = false;
		reviewError = null;
		// Reset form to existing data
		if (existingReview) {
			reviewOutcomeSummary = existingReview.outcomeSummary;
			reviewVendorNotes = existingReview.vendorPerformanceNotes || '';
			reviewIssues = existingReview.issuesEncountered || '';
			reviewLessons = existingReview.lessonsLearned || '';
			reviewVendorRating = existingReview.vendorRating;
			reviewCommRating = existingReview.communicationRating;
			reviewTimelinessRating = existingReview.timelinessRating;
			reviewOverallRating = existingReview.overallSatisfaction;
			reviewReusableVendor = existingReview.reusableVendor;
			reviewReusableScope = existingReview.reusableScope;
			reviewReusableProcess = existingReview.reusableProcess;
		} else {
			// Reset to empty
			reviewOutcomeSummary = '';
			reviewVendorNotes = '';
			reviewIssues = '';
			reviewLessons = '';
			reviewVendorRating = null;
			reviewCommRating = null;
			reviewTimelinessRating = null;
			reviewOverallRating = null;
			reviewReusableVendor = false;
			reviewReusableScope = false;
			reviewReusableProcess = false;
		}
	}

	// Save review (create or update)
	async function saveReview() {
		if (!caseDetail?.case?.id || isSavingReview) return;
		if (!reviewOutcomeSummary.trim() || reviewOutcomeSummary.length < 10) {
			reviewError = 'Outcome summary must be at least 10 characters';
			return;
		}

		isSavingReview = true;
		reviewError = null;

		try {
			const reviewData = {
				caseId: caseDetail.case.id,
				outcomeSummary: reviewOutcomeSummary.trim(),
				vendorPerformanceNotes: reviewVendorNotes.trim() || undefined,
				issuesEncountered: reviewIssues.trim() || undefined,
				lessonsLearned: reviewLessons.trim() || undefined,
				vendorRating: reviewVendorRating ?? undefined,
				communicationRating: reviewCommRating ?? undefined,
				timelinessRating: reviewTimelinessRating ?? undefined,
				overallSatisfaction: reviewOverallRating ?? undefined,
				reusableVendor: reviewReusableVendor,
				reusableScope: reviewReusableScope,
				reusableProcess: reviewReusableProcess,
				idempotencyKey: crypto.randomUUID()
			};

			let response;
			if (existingReview) {
				response = await orpc.caseReview.update(reviewData);
			} else {
				response = await orpc.caseReview.create(reviewData);
			}

			if (response.ok) {
				existingReview = response.data.review as CaseReview;
				isEditingReview = false;
			}
		} catch (e) {
			reviewError = e instanceof Error ? e.message : 'Failed to save review';
		} finally {
			isSavingReview = false;
		}
	}

	// Load review when tab changes to review
	$effect(() => {
		if (activeTab === 'review' && caseDetail?.case?.id && !reviewLoaded) {
			loadReview();
		}
	});

	// Load bids when tab changes to bids
	async function loadBids() {
		if (!caseDetail?.case?.id || bidsLoaded) return;
		isLoadingBids = true;
		bidsError = null;
		try {
			const response = await orpc.vendorBid.compare({ caseId: caseDetail.case.id });
			if (response.ok) {
				bidsData = response.data.comparison;
			}
			bidsLoaded = true;
		} catch (e) {
			bidsError = e instanceof Error ? e.message : 'Failed to load bids';
		} finally {
			isLoadingBids = false;
		}
	}

	$effect(() => {
		if (activeTab === 'bids' && caseDetail?.case?.id && !bidsLoaded) {
			loadBids();
		}
	});

	// Bid action functions
	function openAcceptBidModal(bid: BidComparison) {
		selectedBid = bid;
		bidActionReason = '';
		bidActionError = null;
		showAcceptBidModal = true;
	}

	function openRejectBidModal(bid: BidComparison) {
		selectedBid = bid;
		bidActionReason = '';
		bidActionError = null;
		showRejectBidModal = true;
	}

	async function acceptBid() {
		if (!selectedBid || isProcessingBidAction) return;
		isProcessingBidAction = true;
		bidActionError = null;

		try {
			await orpc.vendorBid.accept({
				idempotencyKey: crypto.randomUUID(),
				id: selectedBid.id,
				reason: bidActionReason.trim() || undefined
			});
			showAcceptBidModal = false;
			bidsLoaded = false;
			await loadBids();
		} catch (e) {
			bidActionError = e instanceof Error ? e.message : 'Failed to accept bid';
		} finally {
			isProcessingBidAction = false;
		}
	}

	async function rejectBid() {
		if (!selectedBid || isProcessingBidAction) return;
		isProcessingBidAction = true;
		bidActionError = null;

		try {
			await orpc.vendorBid.reject({
				idempotencyKey: crypto.randomUUID(),
				id: selectedBid.id,
				reason: bidActionReason.trim() || undefined
			});
			showRejectBidModal = false;
			bidsLoaded = false;
			await loadBids();
		} catch (e) {
			bidActionError = e instanceof Error ? e.message : 'Failed to reject bid';
		} finally {
			isProcessingBidAction = false;
		}
	}

	function getBidStatusClass(status: string): string {
		const classes: Record<string, string> = {
			PENDING: 'preset-filled-warning-500',
			ACCEPTED: 'preset-filled-success-500',
			REJECTED: 'preset-filled-error-500',
			EXPIRED: 'preset-outlined-surface-500'
		};
		return classes[status] || 'preset-filled-surface-500';
	}

	function formatCurrency(amount: string | null): string {
		if (!amount) return 'TBD';
		const num = parseFloat(amount);
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
	}

	function formatDuration(days: number | null): string {
		if (!days) return 'TBD';
		if (days === 1) return '1 day';
		return `${days} days`;
	}

	// Scope Amendment functions
	function openScopeEditModal() {
		scopeAmendmentContent = '';
		scopeAmendmentError = null;
		showScopeAmendmentModal = true;
	}

	async function addScopeAmendment() {
		if (!caseDetail?.case?.id || !scopeAmendmentContent.trim() || isAddingScopeAmendment) return;
		isAddingScopeAmendment = true;
		scopeAmendmentError = null;

		try {
			// Add scope amendment as a note with [SCOPE] prefix
			await orpc.staffConciergeCase.addNote({
				idempotencyKey: crypto.randomUUID(),
				caseId: caseDetail.case.id,
				content: `[SCOPE] ${scopeAmendmentContent.trim()}`,
				noteType: CaseNoteTypeValues.GENERAL,
				isInternal: false // Scope amendments should be visible
			});
			showScopeAmendmentModal = false;
			await refresh();
		} catch (e) {
			scopeAmendmentError = e instanceof Error ? e.message : 'Failed to add scope amendment';
		} finally {
			isAddingScopeAmendment = false;
		}
	}

	// Communication functions
	async function loadCommunications() {
		if (!caseDetail?.case?.id || commsLoaded) return;
		isLoadingComms = true;
		commsError = null;
		try {
			const response = await orpc.caseCommunication.listByCase({ caseId: caseDetail.case.id, limit: 50 });
			if (response.ok) {
				communications = response.data.communications;
			}
			commsLoaded = true;
		} catch (e) {
			commsError = e instanceof Error ? e.message : 'Failed to load communications';
		} finally {
			isLoadingComms = false;
		}
	}

	$effect(() => {
		if (activeTab === 'communications' && caseDetail?.case?.id && !commsLoaded) {
			loadCommunications();
		}
	});

	function openMessageComposer() {
		messageChannel = CommunicationChannel.EMAIL;
		messageDirection = CommunicationDirection.OUTBOUND;
		messageSubject = '';
		messageContent = '';
		messageRecipient = caseDetail?.ownerContact?.email || '';
		messageError = null;
		showMessageComposerModal = true;
	}

	async function sendMessage() {
		if (!caseDetail?.case?.id || !messageContent.trim() || isSendingMessage) return;
		isSendingMessage = true;
		messageError = null;

		try {
			await orpc.caseCommunication.create({
				idempotencyKey: crypto.randomUUID(),
				caseId: caseDetail.case.id,
				channel: messageChannel as typeof CommunicationChannel.EMAIL,
				direction: messageDirection as typeof CommunicationDirection.OUTBOUND,
				subject: messageSubject.trim() || undefined,
				content: messageContent.trim(),
				toRecipient: messageRecipient.trim() || undefined,
				sentAt: new Date().toISOString()
			});
			showMessageComposerModal = false;
			commsLoaded = false;
			await loadCommunications();
		} catch (e) {
			messageError = e instanceof Error ? e.message : 'Failed to log communication';
		} finally {
			isSendingMessage = false;
		}
	}

	function getChannelLabel(channel: string): string {
		const labels: Record<string, string> = {
			EMAIL: 'Email',
			SMS: 'SMS',
			LETTER: 'Letter'
		};
		return labels[channel] || channel;
	}

	function getDirectionLabel(direction: string): string {
		const labels: Record<string, string> = {
			INBOUND: 'Inbound',
			OUTBOUND: 'Outbound',
			INTERNAL: 'Internal'
		};
		return labels[direction] || direction;
	}

	function getDirectionBadgeClass(direction: string): string {
		const classes: Record<string, string> = {
			INBOUND: 'preset-filled-primary-500',
			OUTBOUND: 'preset-filled-success-500',
			INTERNAL: 'preset-outlined-surface-500'
		};
		return classes[direction] || 'preset-filled-surface-500';
	}

	// Availability type labels for display
	const AVAILABILITY_TYPE_LABELS: Record<string, string> = {
		FLEXIBLE: 'Flexible - Any reasonable time works',
		WEEKDAYS_ONLY: 'Weekdays Only - No weekends',
		WEEKENDS_ONLY: 'Weekends Only - Not available on weekdays',
		SPECIFIC_TIMES: 'Specific Times - See notes below',
		OWNER_PRESENT: 'Owner Must Be Present - Schedule with owner',
		NO_PREFERENCE: 'No Preference'
	};

	// Timeline Entry functions
	function openTimelineEntryModal() {
		timelineEntryTitle = '';
		timelineEntryContent = '';
		timelineEntryError = null;
		showTimelineEntryModal = true;
	}

	async function addTimelineEntry() {
		if (!caseDetail?.case?.id || !timelineEntryContent.trim() || isAddingTimelineEntry) return;
		isAddingTimelineEntry = true;
		timelineEntryError = null;

		try {
			const entryContent = timelineEntryTitle.trim()
				? `[TIMELINE] ${timelineEntryTitle.trim()}\n${timelineEntryContent.trim()}`
				: `[TIMELINE] ${timelineEntryContent.trim()}`;

			await orpc.staffConciergeCase.addNote({
				idempotencyKey: crypto.randomUUID(),
				caseId: caseDetail.case.id,
				content: entryContent,
				noteType: CaseNoteTypeValues.GENERAL,
				isInternal: false // Timeline entries should be visible
			});
			showTimelineEntryModal = false;
			await refresh();
		} catch (e) {
			timelineEntryError = e instanceof Error ? e.message : 'Failed to add timeline entry';
		} finally {
			isAddingTimelineEntry = false;
		}
	}

	const tabs = [
		{ id: 'overview', label: 'Overview', icon: Home },
		{ id: 'context', label: 'Context', icon: MapPin },
		{ id: 'scope', label: 'Scope', icon: Settings },
		{ id: 'tasks', label: 'Tasks', icon: CheckCircle },
		{ id: 'vendors', label: 'Vendors', icon: Users },
		{ id: 'bids', label: 'Bids', icon: DollarSign },
		{ id: 'media', label: 'Media', icon: Image },
		{ id: 'communications', label: 'Comms', icon: MessageSquare },
		{ id: 'timeline', label: 'Timeline', icon: Clock },
		{ id: 'review', label: 'Review', icon: FileText },
		{ id: 'audit', label: 'Audit', icon: Shield }
	];

	// Attachment type for type safety
	interface Attachment {
		id: string;
		fileName: string;
		fileSize: number;
		mimeType: string;
		fileUrl: string;
		presignedFileUrl: string | null;
		presignedThumbnailUrl: string | null;
		thumbnailUrl: string | null;
		uploadedBy?: string;
		createdAt: string;
	}

	// Derive attachments from caseDetail
	const attachments = $derived((caseDetail?.attachments ?? []) as Attachment[]);

	// Filter media attachments (images and videos)
	const mediaAttachments = $derived(
		attachments.filter((a) => a.mimeType.startsWith('image/') || a.mimeType.startsWith('video/'))
	);

	// Lightbox state for viewing media
	let lightboxOpen = $state(false);
	let lightboxAttachment = $state<Attachment | null>(null);

	function openLightbox(attachment: Attachment) {
		lightboxAttachment = attachment;
		lightboxOpen = true;
	}

	function closeLightbox() {
		lightboxOpen = false;
		lightboxAttachment = null;
	}

	// Handle keyboard events for lightbox
	function handleLightboxKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeLightbox();
		}
	}

	function getFileIcon(mimeType: string) {
		if (mimeType.startsWith('image/')) return Image;
		if (mimeType.startsWith('video/')) return Video;
		return File;
	}

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}
</script>

<svelte:head>
	<title>{caseDetail?.case.title || 'Case Details'} | Staff View | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-6">
		<!-- Back Link -->
		<div class="mb-6">
			<a
				href="/app/admin/work-queue"
				class="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
			>
				<ArrowLeft class="h-4 w-4" />
				Back to Work Queue
			</a>
		</div>

		{#if caseDetail}
			<!-- Header -->
			<div class="mb-6">
				<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div>
						<div class="flex flex-wrap items-center gap-3">
							<span class="text-sm font-medium text-surface-500">{caseDetail.case.caseNumber}</span>
							<span class="badge {getStatusColor(caseDetail.case.status)}">
								{getStatusLabel(caseDetail.case.status)}
							</span>
							<span class="badge {getPriorityBadgeClass(caseDetail.case.priority)}">
								{caseDetail.case.priority}
							</span>
							{#if slaInfo}
								<span
									class="badge {getSlaStatusClass(slaInfo.status)}"
									title={slaInfo.hoursRemaining !== undefined ? formatHoursRemaining(slaInfo.hoursRemaining) : ''}
								>
									{slaInfo.label}
									{#if slaInfo.status !== 'completed' && slaInfo.status !== 'breached'}
										<span class="ml-1 text-xs opacity-75">
											({Math.round(slaInfo.percentUsed)}%)
										</span>
									{/if}
								</span>
							{/if}
						</div>
						<h1 class="mt-2 text-2xl font-bold">{caseDetail.case.title}</h1>
						<div class="mt-2 flex flex-wrap items-center gap-4 text-sm text-surface-500">
							<span class="flex items-center gap-1">
								<Calendar class="h-4 w-4" />
								Created {formatShortDate(caseDetail.case.createdAt)}
							</span>
							<span class="flex items-center gap-1">
								<Clock class="h-4 w-4" />
								In state: {getTimeInState(caseDetail.case.updatedAt)}
							</span>
							{#if caseDetail.case.assignedConciergeName}
								<span class="flex items-center gap-1">
									<User class="h-4 w-4" />
									{caseDetail.case.assignedConciergeName}
								</span>
							{:else}
								<span class="flex items-center gap-1 text-warning-500">
									<AlertTriangle class="h-4 w-4" />
									Unassigned
								</span>
							{/if}
						</div>
					</div>
					<div class="flex flex-wrap gap-2">
						<a
							href="/app/admin/activity?entityType=CONCIERGE_CASE&entityId={caseDetail.case.id}"
							class="btn preset-outlined-primary-500"
						>
							<Activity class="mr-2 h-4 w-4" />
							View Audit Trail
						</a>
						<button onclick={refresh} class="btn preset-outlined-surface-500" disabled={isRefreshing}>
							{#if isRefreshing}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							{:else}
								<RefreshCw class="mr-2 h-4 w-4" />
							{/if}
							Refresh
						</button>
					</div>
				</div>
			</div>

			<!-- Tabs -->
			<div class="mb-6 border-b border-surface-300-700">
				<nav class="-mb-px flex gap-4 overflow-x-auto">
					{#each tabs as tab}
						<button
							class="flex shrink-0 items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors {activeTab === tab.id
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
			<div class="grid gap-6 lg:grid-cols-3">
				<!-- Main Content -->
				<div class="lg:col-span-2 space-y-6">
					{#if activeTab === 'overview'}
						<!-- Overview Tab -->
						<Card variant="outlined" padding="lg">
							<h2 class="text-lg font-semibold">Case Summary</h2>
							<p class="mt-4 text-surface-600 dark:text-surface-400">
								{caseDetail.case.description}
							</p>
						</Card>

						<Card variant="outlined" padding="lg">
							<h2 class="text-lg font-semibold">Property Information</h2>
							<div class="mt-4 space-y-3">
								<div class="flex items-start gap-3">
									<Home class="h-5 w-5 text-surface-400 mt-0.5" />
									<div>
										<p class="font-medium">{caseDetail.property.name}</p>
										<p class="text-sm text-surface-500">{caseDetail.property.addressLine1}</p>
									</div>
								</div>
							</div>
						</Card>

						<!-- Owner Contact Information -->
						{#if caseDetail.ownerContact}
							<Card variant="outlined" padding="lg">
								<h2 class="text-lg font-semibold">Owner Contact</h2>
								<div class="mt-4 space-y-3">
									<div class="flex items-start gap-3">
										<User class="h-5 w-5 text-surface-400 mt-0.5" />
										<div>
											<p class="font-medium">{caseDetail.ownerContact.name || 'No name provided'}</p>
											{#if caseDetail.ownerContact.organizationName}
												<p class="text-sm text-surface-500">{caseDetail.ownerContact.organizationName}</p>
											{/if}
										</div>
									</div>
									{#if caseDetail.ownerContact.email}
										<div class="flex items-center gap-3">
											<Mail class="h-5 w-5 text-surface-400" />
											<a href="mailto:{caseDetail.ownerContact.email}" class="text-primary-500 hover:underline">
												{caseDetail.ownerContact.email}
											</a>
										</div>
									{/if}
								</div>
							</Card>
						{/if}

						<!-- Status History -->
						{#if caseDetail.statusHistory && caseDetail.statusHistory.length > 0}
							<Card variant="outlined" padding="lg">
								<h2 class="text-lg font-semibold">Status History</h2>
								<div class="mt-4 space-y-3">
									{#each caseDetail.statusHistory.slice(0, 5) as history}
										<div class="flex items-start gap-3 border-l-2 border-surface-300-700 pl-4">
											<div class="flex-1">
												<div class="flex items-center gap-2">
													{#if history.fromStatus}
														<span class="text-sm text-surface-500">{getStatusLabel(history.fromStatus)}</span>
														<ChevronRight class="h-4 w-4 text-surface-400" />
													{/if}
													<span class="text-sm font-medium">{getStatusLabel(history.toStatus)}</span>
												</div>
												{#if history.reason}
													<p class="mt-1 text-sm text-surface-500">{history.reason}</p>
												{/if}
												<p class="mt-1 text-xs text-surface-400">{formatDate(history.createdAt)}</p>
											</div>
										</div>
									{/each}
								</div>
							</Card>
						{/if}

						<!-- Attachments (Read-only) -->
						<Card variant="outlined" padding="lg">
							<div class="flex items-center gap-2">
								<Paperclip class="h-5 w-5 text-primary-500" />
								<h2 class="text-lg font-semibold">Attachments</h2>
							</div>
							{#if attachments.length > 0}
								<div class="mt-4 space-y-3">
									{#each attachments as attachment}
										{@const FileIcon = getFileIcon(attachment.mimeType)}
										<div class="flex items-center justify-between rounded-lg border border-surface-300-700 p-3">
											<div class="flex items-center gap-3">
												<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-100-900">
													<FileIcon class="h-5 w-5 text-surface-500" />
												</div>
												<div>
													<p class="font-medium text-sm">{attachment.fileName}</p>
													<p class="text-xs text-surface-500">
														{formatFileSize(attachment.fileSize)} • {formatShortDate(attachment.createdAt)}
													</p>
												</div>
											</div>
											<a
												href={attachment.fileUrl}
												target="_blank"
												rel="noopener noreferrer"
												class="btn preset-outlined-surface-500 btn-sm"
												title="Download {attachment.fileName}"
											>
												<Download class="h-4 w-4" />
											</a>
										</div>
									{/each}
								</div>
							{:else}
								<p class="mt-4 text-sm text-surface-500">No attachments uploaded for this case.</p>
							{/if}
						</Card>

					{:else if activeTab === 'context'}
						<!-- Context Tab -->
						<Card variant="outlined" padding="lg">
							<h2 class="text-lg font-semibold">Property Context</h2>
							<div class="mt-4 space-y-4">
								<div>
									<h3 class="text-sm font-medium text-surface-500">Property</h3>
									<p class="mt-1">{caseDetail.property.name}</p>
									<p class="text-sm text-surface-500">{caseDetail.property.addressLine1}</p>
								</div>
							</div>
						</Card>

						<Card variant="outlined" padding="lg">
							<h2 class="text-lg font-semibold">Issue Description</h2>
							<p class="mt-4 text-surface-600 dark:text-surface-400">
								{caseDetail.case.description}
							</p>
						</Card>

						<!-- Constraints & Requirements -->
						<Card variant="outlined" padding="lg">
							<div class="flex items-center gap-2">
								<AlertTriangle class="h-5 w-5 text-warning-500" />
								<h2 class="text-lg font-semibold">Constraints & Requirements</h2>
							</div>
							<p class="mt-1 text-sm text-surface-500">
								Access restrictions, HOA rules, and scheduling constraints for this case
							</p>

							<div class="mt-4 space-y-4">
								<!-- Owner Availability -->
								<div class="rounded-lg border border-surface-300-700 p-4">
									<h3 class="text-sm font-medium flex items-center gap-2">
										<Calendar class="h-4 w-4 text-surface-400" />
										Owner Availability
									</h3>
									<div class="mt-2">
										<span class="badge preset-filled-primary-500 text-xs">
											{AVAILABILITY_TYPE_LABELS[caseDetail.case.availabilityType] || caseDetail.case.availabilityType}
										</span>
										{#if caseDetail.case.availabilityNotes}
											<p class="mt-2 text-sm text-surface-600 dark:text-surface-400">
												{caseDetail.case.availabilityNotes}
											</p>
										{/if}
									</div>
								</div>

								<!-- Linked Entities -->
								{#if caseDetail.case.linkedUnitId || caseDetail.case.linkedArcRequestId}
									<div class="rounded-lg border border-surface-300-700 p-4">
										<h3 class="text-sm font-medium flex items-center gap-2">
											<Building2 class="h-4 w-4 text-surface-400" />
											Linked Entities
										</h3>
										<div class="mt-2 space-y-2">
											{#if caseDetail.case.linkedUnitId}
												<div class="flex items-center gap-2">
													<span class="badge preset-outlined-primary-500 text-xs">HOA Unit</span>
													<span class="text-sm text-surface-500">Unit ID: {caseDetail.case.linkedUnitId}</span>
												</div>
												<p class="text-xs text-surface-400">
													This case is linked to an HOA-managed unit. HOA rules and restrictions may apply.
												</p>
											{/if}
											{#if caseDetail.case.linkedArcRequestId}
												<div class="flex items-center gap-2">
													<span class="badge preset-outlined-secondary-500 text-xs">ARC Request</span>
													<span class="text-sm text-surface-500">Request ID: {caseDetail.case.linkedArcRequestId}</span>
												</div>
												<p class="text-xs text-surface-400">
													This case is linked to an Architectural Review Committee request.
												</p>
											{/if}
										</div>
									</div>
								{/if}

								<!-- General Requirements Info -->
								<div class="rounded-lg bg-surface-100 p-4 dark:bg-surface-800">
									<h3 class="text-sm font-medium flex items-center gap-2">
										<Shield class="h-4 w-4 text-surface-400" />
										General Requirements
									</h3>
									<ul class="mt-2 space-y-1 text-sm text-surface-600 dark:text-surface-400">
										<li class="flex items-center gap-2">
											<CheckCircle class="h-3 w-3 text-success-500" />
											All vendors must be verified and insured
										</li>
										<li class="flex items-center gap-2">
											<CheckCircle class="h-3 w-3 text-success-500" />
											Work must comply with local building codes
										</li>
										<li class="flex items-center gap-2">
											<CheckCircle class="h-3 w-3 text-success-500" />
											Owner notification required 24 hours before service
										</li>
										{#if caseDetail.case.linkedUnitId}
											<li class="flex items-center gap-2">
												<AlertTriangle class="h-3 w-3 text-warning-500" />
												HOA approval may be required for exterior modifications
											</li>
										{/if}
									</ul>
								</div>
							</div>
						</Card>

						<!-- Related Documents -->
						<Card variant="outlined" padding="lg">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<Paperclip class="h-5 w-5 text-primary-500" />
									<h2 class="text-lg font-semibold">Related Documents</h2>
								</div>
								{#if attachments.length > 0}
									<span class="badge preset-outlined-surface-500 text-xs">
										{attachments.length} {attachments.length === 1 ? 'document' : 'documents'}
									</span>
								{/if}
							</div>
							<p class="mt-1 text-sm text-surface-500">
								Documents attached to this case
							</p>

							{#if attachments.length > 0}
								<div class="mt-4 space-y-2">
									{#each attachments as doc}
										<div class="flex items-center justify-between gap-4 rounded-lg border border-surface-300-700 p-3">
											<div class="flex items-center gap-3 min-w-0">
												{#if doc.mimeType.startsWith('image/')}
													<div class="flex-shrink-0">
														{#if doc.presignedThumbnailUrl || doc.thumbnailUrl}
															<img
																src={doc.presignedThumbnailUrl || doc.thumbnailUrl}
																alt={doc.fileName}
																class="h-10 w-10 rounded object-cover"
															/>
														{:else}
															<div class="flex h-10 w-10 items-center justify-center rounded bg-surface-200-800">
																<Image class="h-5 w-5 text-surface-400" />
															</div>
														{/if}
													</div>
												{:else if doc.mimeType.startsWith('video/')}
													<div class="flex h-10 w-10 items-center justify-center rounded bg-surface-200-800">
														<Video class="h-5 w-5 text-surface-400" />
													</div>
												{:else if doc.mimeType === 'application/pdf'}
													<div class="flex h-10 w-10 items-center justify-center rounded bg-error-500/10">
														<FileText class="h-5 w-5 text-error-500" />
													</div>
												{:else}
													<div class="flex h-10 w-10 items-center justify-center rounded bg-surface-200-800">
														<File class="h-5 w-5 text-surface-400" />
													</div>
												{/if}
												<div class="min-w-0">
													<p class="font-medium truncate">{doc.fileName}</p>
													<p class="text-xs text-surface-400">
														{(doc.fileSize / 1024).toFixed(1)} KB • {formatShortDate(doc.createdAt)}
													</p>
												</div>
											</div>
											<div class="flex-shrink-0">
												{#if doc.presignedFileUrl}
													<a
														href={doc.presignedFileUrl}
														target="_blank"
														rel="noopener noreferrer"
														class="btn btn-sm preset-outlined-primary-500"
													>
														<Download class="h-4 w-4" />
													</a>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<div class="mt-4 rounded-lg bg-surface-100-900 p-4">
									<p class="text-sm text-surface-500">
										No documents have been attached to this case yet.
									</p>
								</div>
							{/if}
						</Card>

					{:else if activeTab === 'scope'}
						<!-- Scope Tab -->
						<Card variant="outlined" padding="lg">
							<div class="flex items-center justify-between">
								<h2 class="text-lg font-semibold">Work Scope</h2>
								<button
									onclick={() => openScopeEditModal()}
									class="btn preset-outlined-primary-500 btn-sm"
								>
									<Edit class="mr-1 h-4 w-4" />
									Add Amendment
								</button>
							</div>

							<!-- Current Scope (from description) -->
							<div class="mt-4">
								<h3 class="text-sm font-medium text-surface-500">Original Scope</h3>
								<div class="mt-2 rounded-lg bg-surface-100 p-4 dark:bg-surface-800">
									<p class="whitespace-pre-wrap">{caseDetail.case.description}</p>
								</div>
							</div>

							<!-- Scope Amendments (from notes) -->
							{@const scopeNotes = caseDetail.notes?.filter((n: any) => n.content.startsWith('[SCOPE]')) || []}
							{#if scopeNotes.length > 0}
								<div class="mt-6">
									<h3 class="text-sm font-medium text-surface-500">Scope Amendments</h3>
									<div class="mt-2 space-y-3">
										{#each scopeNotes as note, index}
											<div class="relative border-l-2 border-primary-500 pl-4">
												<div class="absolute -left-1.5 top-0 h-3 w-3 rounded-full bg-primary-500"></div>
												<div class="text-xs text-surface-400">
													Amendment #{scopeNotes.length - index} · {formatDate(note.createdAt)} by {note.createdByName}
												</div>
												<p class="mt-1 whitespace-pre-wrap text-surface-700 dark:text-surface-300">
													{note.content.replace('[SCOPE] ', '')}
												</p>
											</div>
										{/each}
									</div>
								</div>
							{:else}
								<div class="mt-6 text-center text-surface-400">
									<p class="text-sm">No scope amendments yet. Add an amendment to track scope changes.</p>
								</div>
							{/if}
						</Card>

					{:else if activeTab === 'tasks'}
						<!-- Tasks Tab -->
						<Card variant="outlined" padding="lg">
							<div class="flex items-center justify-between">
								<h2 class="text-lg font-semibold">Tasks & Actions</h2>
								<button
									onclick={openCreateActionModal}
									class="btn preset-filled-primary-500 btn-sm"
								>
									<Plus class="mr-1 h-4 w-4" />
									Create Action
								</button>
							</div>
							{#if caseDetail.actions && caseDetail.actions.length > 0}
								<div class="mt-4 space-y-3">
									{#each caseDetail.actions as action}
										<div class="rounded-lg border border-surface-300-700 p-4">
											<div class="flex items-start justify-between gap-4">
												<div class="flex-1 min-w-0">
													<div class="flex items-center gap-2 flex-wrap">
														<p class="font-medium">{getActionTypeLabel(action.actionType)}</p>
														<span class="badge {getActionStatusColor(action.status)} text-xs">
															{action.status}
														</span>
													</div>
													{#if action.description}
														<p class="mt-1 text-sm text-surface-600 dark:text-surface-400">{action.description}</p>
													{/if}
													<p class="mt-2 text-xs text-surface-400">{formatDate(action.createdAt)}</p>
												</div>
												<!-- Action buttons based on status -->
												<div class="flex flex-wrap gap-1">
													{#if canTransitionAction(action, ConciergeActionStatusValues.IN_PROGRESS)}
														<button
															onclick={() => openActionModal(action, 'start')}
															class="btn preset-filled-success-500 btn-sm"
															title="Start action"
														>
															<Play class="h-3.5 w-3.5" />
														</button>
													{/if}
													{#if canTransitionAction(action, ConciergeActionStatusValues.COMPLETED)}
														<button
															onclick={() => openActionModal(action, 'complete')}
															class="btn preset-filled-success-500 btn-sm"
															title="Complete action"
														>
															<CheckCircle class="h-3.5 w-3.5" />
														</button>
													{/if}
													{#if canTransitionAction(action, ConciergeActionStatusValues.BLOCKED)}
														<button
															onclick={() => openActionModal(action, 'block')}
															class="btn preset-filled-warning-500 btn-sm"
															title="Block action"
														>
															<Ban class="h-3.5 w-3.5" />
														</button>
													{/if}
													{#if canTransitionAction(action, ConciergeActionStatusValues.CANCELLED)}
														<button
															onclick={() => openActionModal(action, 'cancel')}
															class="btn preset-outlined-surface-500 btn-sm"
															title="Cancel action"
														>
															<CircleSlash class="h-3.5 w-3.5" />
														</button>
													{/if}
												</div>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<div class="mt-6 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-surface-300-700 p-8">
									<CheckCircle class="h-12 w-12 text-surface-400" />
									<p class="mt-2 text-sm text-surface-500">No actions recorded yet</p>
									<p class="text-xs text-surface-400">Create an action to track work on this case</p>
								</div>
							{/if}
						</Card>

					{:else if activeTab === 'vendors'}
						<!-- Vendors Tab -->
						<Card variant="outlined" padding="lg">
							<div class="flex items-center justify-between">
								<h2 class="text-lg font-semibold">Vendor Candidates</h2>
								<a
									href="/app/admin/cases/{caseDetail.case.id}/vendors"
									class="btn preset-filled-primary-500"
								>
									<Users class="mr-2 h-4 w-4" />
									Open Vendor Research
								</a>
							</div>
							<p class="mt-4 text-surface-500">
								Use the Vendor Research workspace to discover, extract, and manage vendor candidates for this case.
							</p>
						</Card>

					{:else if activeTab === 'bids'}
						<!-- Bids Tab -->
						<Card variant="outlined" padding="lg">
							<div class="flex items-center justify-between">
								<h2 class="text-lg font-semibold">Bid Comparison</h2>
								<button
									class="btn preset-outlined-surface-500"
									onclick={() => { bidsLoaded = false; loadBids(); }}
									disabled={isLoadingBids}
								>
									{#if isLoadingBids}
										<Loader2 class="mr-2 h-4 w-4 animate-spin" />
									{:else}
										<RefreshCw class="mr-2 h-4 w-4" />
									{/if}
									Refresh
								</button>
							</div>

							{#if isLoadingBids}
								<div class="mt-6 flex items-center justify-center py-12">
									<Loader2 class="h-8 w-8 animate-spin text-primary-500" />
								</div>
							{:else if bidsError}
								<div class="mt-4 rounded-lg bg-error-100 p-4 text-error-700 dark:bg-error-900/30 dark:text-error-400">
									{bidsError}
								</div>
							{:else if !bidsData || bidsData.bids.length === 0}
								<div class="mt-6">
									<EmptyState
										icon={DollarSign}
										title="No Bids Yet"
										description="No vendor bids have been submitted for this case yet."
									/>
								</div>
							{:else}
								<!-- Summary Stats -->
								<div class="mt-4 grid gap-4 sm:grid-cols-3">
									<div class="rounded-lg bg-surface-100 p-4 dark:bg-surface-800">
										<div class="text-sm text-surface-500">Total Bids</div>
										<div class="mt-1 text-2xl font-bold">{bidsData.bids.length}</div>
									</div>
									<div class="rounded-lg bg-surface-100 p-4 dark:bg-surface-800">
										<div class="text-sm text-surface-500">Average Amount</div>
										<div class="mt-1 text-2xl font-bold">{formatCurrency(bidsData.averageAmount)}</div>
									</div>
									<div class="rounded-lg bg-surface-100 p-4 dark:bg-surface-800">
										<div class="text-sm text-surface-500">Pending</div>
										<div class="mt-1 text-2xl font-bold">{bidsData.bids.filter(b => b.status === 'PENDING').length}</div>
									</div>
								</div>

								<!-- Bid Comparison Table -->
								<div class="mt-6 overflow-x-auto">
									<table class="w-full text-sm">
										<thead>
											<tr class="border-b border-surface-300-700">
												<th class="px-4 py-3 text-left font-semibold">Vendor</th>
												<th class="px-4 py-3 text-right font-semibold">Amount</th>
												<th class="px-4 py-3 text-right font-semibold">Duration</th>
												<th class="px-4 py-3 text-center font-semibold">Status</th>
												<th class="px-4 py-3 text-right font-semibold">Valid Until</th>
												<th class="px-4 py-3 text-right font-semibold">Actions</th>
											</tr>
										</thead>
										<tbody>
											{#each bidsData.bids as bid}
												<tr class="border-b border-surface-200-800 hover:bg-surface-100 dark:hover:bg-surface-800">
													<td class="px-4 py-3">
														<div class="flex items-center gap-2">
															<span class="font-medium">{bid.vendorName}</span>
															{#if bid.isLowest}
																<span class="inline-flex items-center gap-1 rounded-full bg-success-100 px-2 py-0.5 text-xs font-medium text-success-700 dark:bg-success-900/30 dark:text-success-400" title="Lowest Bid">
																	<TrendingDown class="h-3 w-3" />
																	Lowest
																</span>
															{/if}
															{#if bid.isFastest}
																<span class="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-400" title="Fastest Delivery">
																	<Zap class="h-3 w-3" />
																	Fastest
																</span>
															{/if}
														</div>
													</td>
													<td class="px-4 py-3 text-right font-mono">
														{formatCurrency(bid.amount)}
														{#if bid.laborCost || bid.materialsCost}
															<div class="text-xs text-surface-500">
																{#if bid.laborCost}Labor: {formatCurrency(bid.laborCost)}{/if}
																{#if bid.laborCost && bid.materialsCost} · {/if}
																{#if bid.materialsCost}Materials: {formatCurrency(bid.materialsCost)}{/if}
															</div>
														{/if}
													</td>
													<td class="px-4 py-3 text-right">{formatDuration(bid.estimatedDuration)}</td>
													<td class="px-4 py-3 text-center">
														<span class="badge {getBidStatusClass(bid.status)}">{bid.status}</span>
													</td>
													<td class="px-4 py-3 text-right text-surface-500">
														{bid.validUntil ? formatShortDate(bid.validUntil) : '—'}
													</td>
													<td class="px-4 py-3 text-right">
														{#if bid.status === 'PENDING'}
															<div class="flex items-center justify-end gap-2">
																<button
																	class="btn btn-sm preset-filled-success-500"
																	onclick={() => openAcceptBidModal(bid)}
																	title="Accept Bid"
																>
																	<Check class="h-4 w-4" />
																</button>
																<button
																	class="btn btn-sm preset-filled-error-500"
																	onclick={() => openRejectBidModal(bid)}
																	title="Reject Bid"
																>
																	<XCircle class="h-4 w-4" />
																</button>
															</div>
														{:else}
															<span class="text-surface-400">—</span>
														{/if}
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							{/if}
						</Card>

					{:else if activeTab === 'media'}
						<!-- Media Tab -->
						<Card variant="outlined" padding="lg">
							<div class="flex items-center gap-2">
								<Image class="h-5 w-5 text-primary-500" />
								<h2 class="text-lg font-semibold">Case Media</h2>
							</div>
							<p class="mt-1 text-sm text-surface-500">
								Photos and videos attached to this case
							</p>

							{#if mediaAttachments.length > 0}
								<div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
									{#each mediaAttachments as attachment}
										<div class="group relative overflow-hidden rounded-lg border border-surface-300-700 bg-surface-100-900">
											<!-- Thumbnail/Preview -->
											<button
												type="button"
												onclick={() => openLightbox(attachment)}
												class="relative aspect-square w-full cursor-pointer overflow-hidden"
											>
												{#if attachment.mimeType.startsWith('image/')}
													<img
														src={attachment.presignedThumbnailUrl || attachment.presignedFileUrl || ''}
														alt={attachment.fileName}
														class="h-full w-full object-cover transition-transform group-hover:scale-105"
													/>
												{:else if attachment.mimeType.startsWith('video/')}
													<div class="flex h-full w-full items-center justify-center bg-surface-200-800">
														<div class="flex flex-col items-center gap-2">
															<div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary-500/20">
																<PlayIcon class="h-6 w-6 text-primary-500" />
															</div>
															<span class="text-xs text-surface-500">Video</span>
														</div>
													</div>
												{/if}
												<!-- Hover overlay -->
												<div class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
													<Eye class="h-8 w-8 text-white" />
												</div>
											</button>

											<!-- File info -->
											<div class="p-2">
												<p class="truncate text-xs font-medium" title={attachment.fileName}>
													{attachment.fileName}
												</p>
												<p class="text-xs text-surface-500">
													{formatFileSize(attachment.fileSize)}
												</p>
											</div>

											<!-- Actions -->
											<div class="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
												<a
													href={attachment.presignedFileUrl || attachment.fileUrl}
													download={attachment.fileName}
													class="flex h-8 w-8 items-center justify-center rounded-full bg-surface-900/80 text-white hover:bg-surface-800"
													title="Download original"
													onclick={(e) => e.stopPropagation()}
												>
													<Download class="h-4 w-4" />
												</a>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<div class="mt-6 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-surface-300-700 p-8">
									<Image class="h-12 w-12 text-surface-400" />
									<p class="mt-2 text-sm text-surface-500">No media files attached to this case</p>
								</div>
							{/if}
						</Card>

					{:else if activeTab === 'communications'}
						<!-- Communications Tab -->
						<!-- Off-Platform Communication Warning (Phase 16+14 Wave 7.3) -->
						<div class="mb-4 rounded-lg border border-warning-300-700 bg-warning-50-950 p-4">
							<div class="flex items-start gap-3">
								<AlertTriangle class="h-5 w-5 text-warning-500 flex-shrink-0 mt-0.5" />
								<div>
									<p class="font-medium text-warning-700 dark:text-warning-300">Communication Reminder</p>
									<p class="mt-1 text-sm text-warning-600 dark:text-warning-400">
										All case-related communications should be logged here for audit compliance.
										If you communicate with property owners, vendors, or other parties outside this platform
										(phone, personal email, in-person), please log a summary here.
									</p>
								</div>
							</div>
						</div>

						<Card variant="outlined" padding="lg">
							<div class="flex items-center justify-between">
								<h2 class="text-lg font-semibold">Communications</h2>
								<button
									onclick={openMessageComposer}
									class="btn preset-filled-primary-500 btn-sm"
								>
									<Plus class="mr-1 h-4 w-4" />
									Log Communication
								</button>
							</div>

							<!-- Communications List -->
							{#if isLoadingComms}
								<div class="mt-6 flex items-center justify-center py-8">
									<Loader2 class="h-6 w-6 animate-spin text-primary-500" />
								</div>
							{:else if commsError}
								<div class="mt-4 rounded-lg bg-error-100 p-4 text-error-700 dark:bg-error-900/30 dark:text-error-400">
									{commsError}
								</div>
							{:else if communications.length > 0}
								<div class="mt-4 space-y-3">
									{#each communications as comm}
										<div class="rounded-lg border border-surface-300-700 p-4">
											<div class="flex items-start gap-3">
												<Mail class="h-5 w-5 text-surface-400 mt-0.5" />
												<div class="flex-1">
													<div class="flex items-center gap-2 flex-wrap">
														<span class="badge {getDirectionBadgeClass(comm.direction)} text-xs">
															{getDirectionLabel(comm.direction)}
														</span>
														<span class="badge preset-outlined-surface-500 text-xs">
															{getChannelLabel(comm.channel)}
														</span>
														{#if comm.toRecipient}
															<span class="text-xs text-surface-500">to {comm.toRecipient}</span>
														{/if}
													</div>
													{#if comm.subject}
														<p class="mt-1 font-medium text-sm">{comm.subject}</p>
													{/if}
													<p class="mt-2 text-sm text-surface-600 dark:text-surface-400">{comm.contentPreview}</p>
													<p class="mt-2 text-xs text-surface-400">
														{comm.sentAt ? formatDate(comm.sentAt) : formatDate(comm.createdAt)}
														{#if comm.fromUserName}
															<span class="ml-2">by {comm.fromUserName}</span>
														{/if}
													</p>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<p class="mt-4 text-surface-500">No communications logged yet.</p>
							{/if}
						</Card>

						<!-- Internal Notes Card -->
						<Card variant="outlined" padding="lg" class="mt-6">
							<div class="flex items-center justify-between">
								<h2 class="text-lg font-semibold">Internal Notes</h2>
								<button
									onclick={openNoteModal}
									class="btn preset-outlined-primary-500 btn-sm"
								>
									<Plus class="mr-1 h-4 w-4" />
									Add Note
								</button>
							</div>
							{@const nonScopeNotes = caseDetail.notes?.filter((n: any) => !n.content.startsWith('[SCOPE]')) || []}
							{#if nonScopeNotes.length > 0}
								<div class="mt-4 space-y-3">
									{#each nonScopeNotes as note}
										<div class="rounded-lg border border-surface-300-700 p-4">
											<div class="flex items-start gap-3">
												<MessageSquare class="h-5 w-5 text-surface-400 mt-0.5" />
												<div class="flex-1">
													<div class="flex items-center gap-2">
														<span class="font-medium text-sm">{note.createdByName ?? 'Unknown'}</span>
														<span class="badge preset-outlined-surface-500 text-xs">{note.noteType}</span>
														{#if note.isInternal}
															<span class="badge preset-filled-warning-500 text-xs">Internal</span>
														{/if}
													</div>
													<p class="mt-2 text-sm">{note.content}</p>
													<p class="mt-2 text-xs text-surface-400">
														{formatDate(note.createdAt)}
													</p>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<p class="mt-4 text-surface-500">No internal notes yet.</p>
							{/if}
						</Card>

					{:else if activeTab === 'timeline'}
						<!-- Timeline Tab -->
						<Card variant="outlined" padding="lg">
							<div class="flex items-center justify-between">
								<div>
									<h2 class="text-lg font-semibold">Activity Timeline</h2>
									<p class="mt-1 text-sm text-surface-500">Complete chronological history of all case events</p>
								</div>
								<button
									onclick={openTimelineEntryModal}
									class="btn preset-filled-primary-500 btn-sm"
								>
									<Plus class="mr-1 h-4 w-4" />
									Add Entry
								</button>
							</div>

							{@const timelineNotes = caseDetail.notes?.filter((n: any) => n.content.startsWith('[TIMELINE]')) || []}
							{@const allEvents = [
								...(caseDetail.statusHistory || []).map((h: any) => ({ type: 'status', data: h, date: h.createdAt })),
								...timelineNotes.map((n: any) => ({ type: 'timeline', data: n, date: n.createdAt }))
							].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())}

							<div class="mt-6 space-y-4">
								{#if allEvents.length === 0}
									<p class="text-center text-surface-500 py-8">No timeline events yet.</p>
								{:else}
									{#each allEvents as event, index}
										<div class="flex gap-4">
											<div class="flex flex-col items-center">
												{#if event.type === 'status'}
													<div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500/10">
														<Activity class="h-4 w-4 text-primary-500" />
													</div>
												{:else}
													<div class="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-500/10">
														<Clock class="h-4 w-4 text-secondary-500" />
													</div>
												{/if}
												{#if index < allEvents.length - 1}
													<div class="flex-1 w-px bg-surface-300-700"></div>
												{/if}
											</div>
											<div class="flex-1 pb-4">
												{#if event.type === 'status'}
													<p class="font-medium">
														Status changed to {getStatusLabel(event.data.toStatus)}
													</p>
													{#if event.data.fromStatus}
														<p class="text-sm text-surface-500">From: {getStatusLabel(event.data.fromStatus)}</p>
													{/if}
													{#if event.data.reason}
														<p class="mt-1 text-sm text-surface-500">{event.data.reason}</p>
													{/if}
												{:else}
													{@const content = event.data.content.replace('[TIMELINE] ', '')}
													{@const parts = content.split('\n')}
													{@const title = parts.length > 1 ? parts[0] : null}
													{@const body = parts.length > 1 ? parts.slice(1).join('\n') : content}
													{#if title}
														<p class="font-medium">{title}</p>
														<p class="mt-1 text-sm text-surface-500">{body}</p>
													{:else}
														<p class="font-medium">{body}</p>
													{/if}
													<p class="mt-1 text-xs text-surface-400">by {event.data.createdByName ?? 'Unknown'}</p>
												{/if}
												<p class="mt-1 text-xs text-surface-400">{formatDate(event.date)}</p>
											</div>
										</div>
									{/each}
								{/if}
							</div>
						</Card>

					{:else if activeTab === 'review'}
						<!-- Review Tab -->
						<Card variant="outlined" padding="lg">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<FileText class="h-5 w-5 text-primary-500" />
									<h2 class="text-lg font-semibold">Case Review</h2>
								</div>
								{#if existingReview && !isEditingReview}
									<button
										onclick={startEditReview}
										class="btn btn-sm preset-outlined-primary-500"
									>
										<Edit class="mr-1 h-4 w-4" />
										Edit Review
									</button>
								{/if}
							</div>
							<p class="mt-1 text-sm text-surface-500">
								Post-completion review for institutional knowledge
							</p>

							{#if isLoadingReview}
								<div class="mt-6 flex items-center justify-center py-8">
									<Loader2 class="h-6 w-6 animate-spin text-primary-500" />
								</div>
							{:else if caseDetail.case.status !== ConciergeCaseStatusValues.RESOLVED && caseDetail.case.status !== ConciergeCaseStatusValues.CLOSED && !existingReview}
								<div class="mt-6 rounded-lg bg-warning-500/10 border border-warning-500/20 p-4">
									<p class="text-sm text-warning-600 dark:text-warning-400">
										Case must be resolved or closed before creating a review.
									</p>
								</div>
							{:else if existingReview && !isEditingReview}
								<!-- Display existing review -->
								<div class="mt-6 space-y-6">
									<!-- Outcome Summary -->
									<div>
										<h3 class="font-medium text-surface-600 dark:text-surface-400">Outcome Summary</h3>
										<p class="mt-1 text-sm">{existingReview.outcomeSummary}</p>
									</div>

									<!-- Ratings -->
									<div class="grid gap-4 sm:grid-cols-2">
										<div class="rounded-lg border border-surface-300-700 p-3">
											<p class="text-sm text-surface-500">Vendor Rating</p>
											<div class="mt-1 flex items-center gap-1">
												{#each [1, 2, 3, 4, 5] as star}
													<Star
														class="h-4 w-4 {(existingReview.vendorRating ?? 0) >= star ? 'text-warning-500 fill-warning-500' : 'text-surface-300'}"
													/>
												{/each}
												<span class="ml-2 text-sm">{existingReview.vendorRating || 'N/A'}</span>
											</div>
										</div>
										<div class="rounded-lg border border-surface-300-700 p-3">
											<p class="text-sm text-surface-500">Communication Rating</p>
											<div class="mt-1 flex items-center gap-1">
												{#each [1, 2, 3, 4, 5] as star}
													<Star
														class="h-4 w-4 {(existingReview.communicationRating ?? 0) >= star ? 'text-warning-500 fill-warning-500' : 'text-surface-300'}"
													/>
												{/each}
												<span class="ml-2 text-sm">{existingReview.communicationRating || 'N/A'}</span>
											</div>
										</div>
										<div class="rounded-lg border border-surface-300-700 p-3">
											<p class="text-sm text-surface-500">Timeliness Rating</p>
											<div class="mt-1 flex items-center gap-1">
												{#each [1, 2, 3, 4, 5] as star}
													<Star
														class="h-4 w-4 {(existingReview.timelinessRating ?? 0) >= star ? 'text-warning-500 fill-warning-500' : 'text-surface-300'}"
													/>
												{/each}
												<span class="ml-2 text-sm">{existingReview.timelinessRating || 'N/A'}</span>
											</div>
										</div>
										<div class="rounded-lg border border-surface-300-700 p-3">
											<p class="text-sm text-surface-500">Overall Satisfaction</p>
											<div class="mt-1 flex items-center gap-1">
												{#each [1, 2, 3, 4, 5] as star}
													<Star
														class="h-4 w-4 {(existingReview.overallSatisfaction ?? 0) >= star ? 'text-warning-500 fill-warning-500' : 'text-surface-300'}"
													/>
												{/each}
												<span class="ml-2 text-sm">{existingReview.overallSatisfaction || 'N/A'}</span>
											</div>
										</div>
									</div>

									<!-- Reusability Flags -->
									<div>
										<h3 class="font-medium text-surface-600 dark:text-surface-400">Reusability</h3>
										<div class="mt-2 flex flex-wrap gap-2">
											<span class="badge {existingReview.reusableVendor ? 'preset-filled-success-500' : 'preset-outlined-surface-500'}">
												{existingReview.reusableVendor ? '✓' : '✗'} Reusable Vendor
											</span>
											<span class="badge {existingReview.reusableScope ? 'preset-filled-success-500' : 'preset-outlined-surface-500'}">
												{existingReview.reusableScope ? '✓' : '✗'} Reusable Scope
											</span>
											<span class="badge {existingReview.reusableProcess ? 'preset-filled-success-500' : 'preset-outlined-surface-500'}">
												{existingReview.reusableProcess ? '✓' : '✗'} Reusable Process
											</span>
										</div>
									</div>

									<!-- Notes -->
									{#if existingReview.vendorPerformanceNotes}
										<div>
											<h3 class="font-medium text-surface-600 dark:text-surface-400">Vendor Performance Notes</h3>
											<p class="mt-1 text-sm">{existingReview.vendorPerformanceNotes}</p>
										</div>
									{/if}
									{#if existingReview.issuesEncountered}
										<div>
											<h3 class="font-medium text-surface-600 dark:text-surface-400">Issues Encountered</h3>
											<p class="mt-1 text-sm">{existingReview.issuesEncountered}</p>
										</div>
									{/if}
									{#if existingReview.lessonsLearned}
										<div>
											<h3 class="font-medium text-surface-600 dark:text-surface-400">Lessons Learned</h3>
											<p class="mt-1 text-sm">{existingReview.lessonsLearned}</p>
										</div>
									{/if}

									<!-- Meta -->
									<div class="text-xs text-surface-400">
										Reviewed by {existingReview.reviewedByUserName || 'Unknown'} on {formatDate(existingReview.reviewedAt)}
									</div>
								</div>
							{:else}
								<!-- Review Form (create or edit) -->
								<form onsubmit={(e) => { e.preventDefault(); saveReview(); }} class="mt-6 space-y-6">
									{#if reviewError}
										<div class="rounded-lg bg-error-500/10 border border-error-500/20 p-3 text-sm text-error-500">
											{reviewError}
										</div>
									{/if}

									<!-- Outcome Summary -->
									<div>
										<label for="reviewOutcome" class="label">
											Outcome Summary <span class="text-error-500">*</span>
										</label>
										<textarea
											id="reviewOutcome"
											bind:value={reviewOutcomeSummary}
											placeholder="Describe the outcome of this case..."
											rows="4"
											class="textarea w-full"
											required
											minlength="10"
										></textarea>
										<p class="mt-1 text-xs text-surface-400">Minimum 10 characters</p>
									</div>

									<!-- Ratings -->
									<div class="grid gap-4 sm:grid-cols-2">
										<div>
											<label class="label">Vendor Rating</label>
											<div class="mt-1 flex items-center gap-1">
												{#each [1, 2, 3, 4, 5] as star}
													<button
														type="button"
														onclick={() => reviewVendorRating = reviewVendorRating === star ? null : star}
														class="p-1 hover:scale-110 transition-transform"
													>
														<Star
															class="h-6 w-6 {(reviewVendorRating ?? 0) >= star ? 'text-warning-500 fill-warning-500' : 'text-surface-300 hover:text-warning-400'}"
														/>
													</button>
												{/each}
											</div>
										</div>
										<div>
											<label class="label">Communication Rating</label>
											<div class="mt-1 flex items-center gap-1">
												{#each [1, 2, 3, 4, 5] as star}
													<button
														type="button"
														onclick={() => reviewCommRating = reviewCommRating === star ? null : star}
														class="p-1 hover:scale-110 transition-transform"
													>
														<Star
															class="h-6 w-6 {(reviewCommRating ?? 0) >= star ? 'text-warning-500 fill-warning-500' : 'text-surface-300 hover:text-warning-400'}"
														/>
													</button>
												{/each}
											</div>
										</div>
										<div>
											<label class="label">Timeliness Rating</label>
											<div class="mt-1 flex items-center gap-1">
												{#each [1, 2, 3, 4, 5] as star}
													<button
														type="button"
														onclick={() => reviewTimelinessRating = reviewTimelinessRating === star ? null : star}
														class="p-1 hover:scale-110 transition-transform"
													>
														<Star
															class="h-6 w-6 {(reviewTimelinessRating ?? 0) >= star ? 'text-warning-500 fill-warning-500' : 'text-surface-300 hover:text-warning-400'}"
														/>
													</button>
												{/each}
											</div>
										</div>
										<div>
											<label class="label">Overall Satisfaction</label>
											<div class="mt-1 flex items-center gap-1">
												{#each [1, 2, 3, 4, 5] as star}
													<button
														type="button"
														onclick={() => reviewOverallRating = reviewOverallRating === star ? null : star}
														class="p-1 hover:scale-110 transition-transform"
													>
														<Star
															class="h-6 w-6 {(reviewOverallRating ?? 0) >= star ? 'text-warning-500 fill-warning-500' : 'text-surface-300 hover:text-warning-400'}"
														/>
													</button>
												{/each}
											</div>
										</div>
									</div>

									<!-- Reusability Flags -->
									<div>
										<label class="label">Reusability Flags</label>
										<div class="mt-2 space-y-2">
											<label class="flex items-center gap-2">
												<input type="checkbox" bind:checked={reviewReusableVendor} class="checkbox" />
												<span class="text-sm">Reusable Vendor - Would use this vendor again</span>
											</label>
											<label class="flex items-center gap-2">
												<input type="checkbox" bind:checked={reviewReusableScope} class="checkbox" />
												<span class="text-sm">Reusable Scope - Scope could serve as template</span>
											</label>
											<label class="flex items-center gap-2">
												<input type="checkbox" bind:checked={reviewReusableProcess} class="checkbox" />
												<span class="text-sm">Reusable Process - Process could be standardized</span>
											</label>
										</div>
									</div>

									<!-- Optional Notes -->
									<div>
										<label for="reviewVendorNotes" class="label">Vendor Performance Notes</label>
										<textarea
											id="reviewVendorNotes"
											bind:value={reviewVendorNotes}
											placeholder="Notes about vendor performance..."
											rows="2"
											class="textarea w-full"
										></textarea>
									</div>
									<div>
										<label for="reviewIssues" class="label">Issues Encountered</label>
										<textarea
											id="reviewIssues"
											bind:value={reviewIssues}
											placeholder="Any issues that arose during the case..."
											rows="2"
											class="textarea w-full"
										></textarea>
									</div>
									<div>
										<label for="reviewLessons" class="label">Lessons Learned</label>
										<textarea
											id="reviewLessons"
											bind:value={reviewLessons}
											placeholder="Key takeaways from this case..."
											rows="2"
											class="textarea w-full"
										></textarea>
									</div>

									<!-- Actions -->
									<div class="flex justify-end gap-3">
										{#if isEditingReview}
											<button
												type="button"
												onclick={cancelEditReview}
												class="btn preset-outlined-surface-500"
											>
												Cancel
											</button>
										{/if}
										<button
											type="submit"
											disabled={isSavingReview || !reviewOutcomeSummary.trim()}
											class="btn preset-filled-primary-500"
										>
											{#if isSavingReview}
												<Loader2 class="mr-2 h-4 w-4 animate-spin" />
												Saving...
											{:else}
												<Save class="mr-2 h-4 w-4" />
												{existingReview ? 'Update Review' : 'Create Review'}
											{/if}
										</button>
									</div>
								</form>
							{/if}
						</Card>

					{:else if activeTab === 'audit'}
						<!-- Audit Tab -->
						<Card variant="outlined" padding="lg">
							<div class="flex items-center gap-2">
								<Shield class="h-5 w-5 text-primary-500" />
								<h2 class="text-lg font-semibold">Audit Trail</h2>
							</div>
							<p class="mt-1 text-sm text-surface-500">
								Complete audit log of all actions taken on this case
							</p>

							<div class="mt-6">
								<div class="rounded-lg bg-surface-100-900 p-4">
									<p class="text-sm text-surface-500">
										Audit trail data is available via the Activity Events API.
										This view will display all recorded ActivityEvents for this case entity.
									</p>
									<a
										href="/app/admin/activity?entityType=CONCIERGE_CASE&entityId={caseDetail.case.id}"
										class="btn preset-outlined-primary-500 mt-4"
									>
										<Activity class="mr-2 h-4 w-4" />
										View Full Audit Log
									</a>
								</div>
							</div>

							<!-- Quick audit summary -->
							<div class="mt-6 space-y-4">
								<h3 class="font-medium">Quick Summary</h3>
								<div class="grid gap-4 sm:grid-cols-2">
									<div class="rounded-lg border border-surface-300-700 p-3">
										<p class="text-sm text-surface-500">Created</p>
										<p class="font-medium">{formatDate(caseDetail.case.createdAt)}</p>
									</div>
									<div class="rounded-lg border border-surface-300-700 p-3">
										<p class="text-sm text-surface-500">Last Updated</p>
										<p class="font-medium">{formatDate(caseDetail.case.updatedAt)}</p>
									</div>
									<div class="rounded-lg border border-surface-300-700 p-3">
										<p class="text-sm text-surface-500">Status Changes</p>
										<p class="font-medium">{caseDetail.statusHistory?.length || 0}</p>
									</div>
									<div class="rounded-lg border border-surface-300-700 p-3">
										<p class="text-sm text-surface-500">Notes Added</p>
										<p class="font-medium">{caseDetail.notes?.length || 0}</p>
									</div>
								</div>
							</div>
						</Card>
					{/if}
				</div>

				<!-- Sidebar -->
				<div class="space-y-6">
					<!-- Quick Actions -->
					<Card variant="outlined" padding="lg">
						<h3 class="font-semibold">Quick Actions</h3>
						<div class="mt-4 space-y-2">
							<button 
								onclick={openReassignModal}
								class="btn preset-outlined-surface-500 w-full justify-start"
							>
								<User class="mr-2 h-4 w-4" />
								Reassign Case
							</button>
							<button 
								onclick={openStatusModal}
								class="btn preset-outlined-surface-500 w-full justify-start"
								disabled={availableStatuses.length === 0}
							>
								<Settings class="mr-2 h-4 w-4" />
								Change Status
							</button>
							<button 
								onclick={openNoteModal}
								class="btn preset-outlined-surface-500 w-full justify-start"
							>
								<MessageSquare class="mr-2 h-4 w-4" />
								Add Note
							</button>
						</div>
					</Card>

					<!-- Organization Info -->
					{#if caseDetail.organization}
						<Card variant="outlined" padding="lg">
							<h3 class="font-semibold">Organization</h3>
							<div class="mt-4">
								<a
									href="/app/admin/organizations/{caseDetail.organization.id}"
									class="flex items-center gap-3 group"
								>
									<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/10">
										<Building2 class="h-5 w-5 text-primary-500" />
									</div>
									<div>
										<p class="font-medium group-hover:text-primary-500 transition-colors">{caseDetail.organization.name}</p>
										<p class="text-sm text-surface-500">{caseDetail.organization.type.replace(/_/g, ' ')}</p>
									</div>
									<ChevronRight class="ml-auto h-4 w-4 text-surface-400 group-hover:text-primary-500 transition-colors" />
								</a>
							</div>
						</Card>
					{/if}

					<!-- Assignment Info -->
					<Card variant="outlined" padding="lg">
						<h3 class="font-semibold">Assignment</h3>
						<div class="mt-4">
							{#if caseDetail.case.assignedConciergeName}
								<div class="flex items-center gap-3">
									<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/10">
										<User class="h-5 w-5 text-primary-500" />
									</div>
									<div>
										<p class="font-medium">{caseDetail.case.assignedConciergeName}</p>
										<p class="text-sm text-surface-500">Assigned Concierge</p>
									</div>
								</div>
							{:else}
								<div class="flex items-center gap-3 text-warning-500">
									<AlertTriangle class="h-5 w-5" />
									<span>No one assigned</span>
								</div>
							{/if}
						</div>
					</Card>

					<!-- Case Metadata -->
					<Card variant="outlined" padding="lg">
						<h3 class="font-semibold">Case Details</h3>
						<div class="mt-4 space-y-3 text-sm">
							<div class="flex justify-between">
								<span class="text-surface-500">Case ID</span>
								<span class="font-mono text-xs">{caseDetail.case.id.slice(0, 8)}...</span>
							</div>
							<div class="flex justify-between">
								<span class="text-surface-500">Case Number</span>
								<span>{caseDetail.case.caseNumber}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-surface-500">Status</span>
								<span>{getStatusLabel(caseDetail.case.status)}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-surface-500">Priority</span>
								<span>{caseDetail.case.priority}</span>
							</div>
							{#if caseDetail.case.resolvedAt}
								<div class="flex justify-between">
									<span class="text-surface-500">Resolved</span>
									<span>{formatShortDate(caseDetail.case.resolvedAt)}</span>
								</div>
							{/if}
							{#if caseDetail.case.closedAt}
								<div class="flex justify-between">
									<span class="text-surface-500">Closed</span>
									<span>{formatShortDate(caseDetail.case.closedAt)}</span>
								</div>
							{/if}
						</div>
					</Card>
				</div>
			</div>
		{/if}
	</div>

	<!-- Reassign Case Modal -->
	{#if showReassignModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<Card variant="outlined" padding="lg" class="w-full max-w-md bg-surface-50 dark:bg-surface-900">
				<h2 class="text-lg font-semibold">Reassign Case</h2>
				<p class="mt-1 text-sm text-surface-500">Select a staff member to assign this case to.</p>

				{#if reassignError}
					<div class="mt-4 rounded-lg bg-error-500/10 p-3 text-sm text-error-500">
						{reassignError}
					</div>
				{/if}

				<div class="mt-4">
					{#if isLoadingStaff}
						<div class="flex items-center justify-center py-4">
							<Loader2 class="h-6 w-6 animate-spin text-primary-500" />
						</div>
					{:else}
						<label for="staff-select" class="label mb-1 block text-sm">Assign to</label>
						<Select
							id="staff-select"
							bind:value={selectedStaffUserId}
							size="sm"
							disabled={isReassigning}
						>
							<option value={null}>Unassigned</option>
							{#each staffMembers as staff}
								<option value={staff.userId}>{staff.displayName}</option>
							{/each}
						</Select>
					{/if}
				</div>

				<div class="mt-6 flex justify-end gap-3">
					<button
						type="button"
						onclick={() => (showReassignModal = false)}
						class="btn preset-tonal-surface"
						disabled={isReassigning}
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={reassignCase}
						class="btn preset-filled-primary-500"
						disabled={isReassigning || isLoadingStaff}
					>
						{#if isReassigning}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Saving...
						{:else}
							Save Assignment
						{/if}
					</button>
				</div>
			</Card>
		</div>
	{/if}

	<!-- Change Status Modal -->
	{#if showStatusModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<Card variant="outlined" padding="lg" class="w-full max-w-md bg-surface-50 dark:bg-surface-900">
				<h2 class="text-lg font-semibold">Change Status</h2>
				<p class="mt-1 text-sm text-surface-500">
					Current status: <span class="font-medium">{getStatusLabel(caseDetail?.case?.status ?? '')}</span>
				</p>

				{#if statusError}
					<div class="mt-4 rounded-lg bg-error-500/10 p-3 text-sm text-error-500">
						{statusError}
					</div>
				{/if}

				<div class="mt-4 space-y-4">
					<div>
						<label for="status-select" class="label mb-1 block text-sm">New Status</label>
						<Select
							id="status-select"
							bind:value={selectedStatus}
							size="sm"
							disabled={isChangingStatus}
						>
							<option value="">Select a status...</option>
							{#each availableStatuses as status}
								<option value={status}>{getStatusLabel(status)}</option>
							{/each}
						</Select>
					</div>

					<div>
						<label for="status-reason" class="label mb-1 block text-sm">Reason (optional)</label>
						<textarea
							id="status-reason"
							bind:value={statusReason}
							placeholder="Why is this status changing?"
							class="textarea w-full"
							rows="3"
							disabled={isChangingStatus}
						></textarea>
					</div>
				</div>

				<div class="mt-6 flex justify-end gap-3">
					<button
						type="button"
						onclick={() => (showStatusModal = false)}
						class="btn preset-tonal-surface"
						disabled={isChangingStatus}
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={changeStatus}
						class="btn preset-filled-primary-500"
						disabled={isChangingStatus || !selectedStatus}
					>
						{#if isChangingStatus}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Updating...
						{:else}
							Update Status
						{/if}
					</button>
				</div>
			</Card>
		</div>
	{/if}

	<!-- Add Note Modal -->
	{#if showNoteModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<Card variant="outlined" padding="lg" class="w-full max-w-md bg-surface-50 dark:bg-surface-900">
				<h2 class="text-lg font-semibold">Add Note</h2>
				<p class="mt-1 text-sm text-surface-500">Add a note to this case.</p>

				{#if noteError}
					<div class="mt-4 rounded-lg bg-error-500/10 p-3 text-sm text-error-500">
						{noteError}
					</div>
				{/if}

				<div class="mt-4 space-y-4">
					<div>
						<label for="note-content" class="label mb-1 block text-sm">Note Content</label>
						<textarea
							id="note-content"
							bind:value={noteContent}
							placeholder="Enter your note..."
							class="textarea w-full"
							rows="4"
							disabled={isAddingNote}
						></textarea>
					</div>

					<div>
						<label for="note-type" class="label mb-1 block text-sm">Note Type</label>
						<Select
							id="note-type"
							bind:value={noteType}
							size="sm"
							disabled={isAddingNote}
						>
							<option value={CaseNoteTypeValues.GENERAL}>General</option>
							<option value={CaseNoteTypeValues.CLARIFICATION_REQUEST}>Clarification Request</option>
							<option value={CaseNoteTypeValues.CLARIFICATION_RESPONSE}>Clarification Response</option>
							<option value={CaseNoteTypeValues.DECISION_RATIONALE}>Decision Rationale</option>
						</Select>
					</div>

					<div class="flex items-center gap-2">
						<input
							type="checkbox"
							id="note-internal"
							bind:checked={isInternalNote}
							class="checkbox"
							disabled={isAddingNote}
						/>
						<label for="note-internal" class="text-sm">Internal note (not visible to property owner)</label>
					</div>
				</div>

				<div class="mt-6 flex justify-end gap-3">
					<button
						type="button"
						onclick={() => (showNoteModal = false)}
						class="btn preset-tonal-surface"
						disabled={isAddingNote}
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={addNote}
						class="btn preset-filled-primary-500"
						disabled={isAddingNote || !noteContent.trim()}
					>
						{#if isAddingNote}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Adding...
						{:else}
							Add Note
						{/if}
					</button>
				</div>
			</Card>
		</div>
	{/if}

	<!-- Create Action Modal -->
	{#if showCreateActionModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<Card variant="outlined" padding="lg" class="w-full max-w-md bg-surface-50 dark:bg-surface-900">
				<h2 class="text-lg font-semibold">Create Action</h2>
				<p class="mt-1 text-sm text-surface-500">Plan a new action for this case.</p>

				{#if createActionError}
					<div class="mt-4 rounded-lg bg-error-500/10 p-3 text-sm text-error-500">
						{createActionError}
					</div>
				{/if}

				<div class="mt-4 space-y-4">
					<div>
						<label for="action-type" class="label mb-1 block text-sm">Action Type</label>
						<Select
							id="action-type"
							bind:value={newActionType}
							size="sm"
							disabled={isCreatingAction}
						>
							<option value={ConciergeActionTypeValues.PHONE_CALL}>Phone Call</option>
							<option value={ConciergeActionTypeValues.EMAIL}>Email</option>
							<option value={ConciergeActionTypeValues.DOCUMENT_REVIEW}>Document Review</option>
							<option value={ConciergeActionTypeValues.RESEARCH}>Research</option>
							<option value={ConciergeActionTypeValues.VENDOR_CONTACT}>Vendor Contact</option>
							<option value={ConciergeActionTypeValues.HOA_CONTACT}>HOA Contact</option>
							<option value={ConciergeActionTypeValues.SCHEDULING}>Scheduling</option>
							<option value={ConciergeActionTypeValues.APPROVAL_REQUEST}>Approval Request</option>
							<option value={ConciergeActionTypeValues.FOLLOW_UP}>Follow Up</option>
							<option value={ConciergeActionTypeValues.ESCALATION}>Escalation</option>
							<option value={ConciergeActionTypeValues.OTHER}>Other</option>
						</Select>
					</div>

					<div>
						<label for="action-description" class="label mb-1 block text-sm">Description</label>
						<textarea
							id="action-description"
							bind:value={newActionDescription}
							placeholder="Describe what needs to be done..."
							class="textarea w-full"
							rows="3"
							disabled={isCreatingAction}
						></textarea>
					</div>

					<div>
						<label for="action-notes" class="label mb-1 block text-sm">Notes (optional)</label>
						<textarea
							id="action-notes"
							bind:value={newActionNotes}
							placeholder="Any additional notes..."
							class="textarea w-full"
							rows="2"
							disabled={isCreatingAction}
						></textarea>
					</div>
				</div>

				<div class="mt-6 flex justify-end gap-3">
					<button
						type="button"
						onclick={() => (showCreateActionModal = false)}
						class="btn preset-tonal-surface"
						disabled={isCreatingAction}
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={createAction}
						class="btn preset-filled-primary-500"
						disabled={isCreatingAction || !newActionDescription.trim()}
					>
						{#if isCreatingAction}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Creating...
						{:else}
							Create Action
						{/if}
					</button>
				</div>
			</Card>
		</div>
	{/if}

	<!-- Action Operation Modal -->
	{#if showActionModal && selectedAction}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<Card variant="outlined" padding="lg" class="w-full max-w-md bg-surface-50 dark:bg-surface-900">
				<h2 class="text-lg font-semibold">
					{#if actionModalMode === 'start'}
						Start Action
					{:else if actionModalMode === 'complete'}
						Complete Action
					{:else if actionModalMode === 'block'}
						Block Action
					{:else}
						Cancel Action
					{/if}
				</h2>
				<p class="mt-1 text-sm text-surface-500">
					{getActionTypeLabel(selectedAction.actionType)}: {selectedAction.description}
				</p>

				{#if actionError}
					<div class="mt-4 rounded-lg bg-error-500/10 p-3 text-sm text-error-500">
						{actionError}
					</div>
				{/if}

				<div class="mt-4 space-y-4">
					{#if actionModalMode === 'start'}
						<p class="text-sm text-surface-600 dark:text-surface-400">
							This will mark the action as "In Progress". Are you ready to begin working on this action?
						</p>
					{:else if actionModalMode === 'complete'}
						<div>
							<label for="action-outcome" class="label mb-1 block text-sm">Outcome (required)</label>
							<textarea
								id="action-outcome"
								bind:value={actionOutcome}
								placeholder="Describe the outcome of this action..."
								class="textarea w-full"
								rows="3"
								disabled={isProcessingAction}
							></textarea>
						</div>
					{:else if actionModalMode === 'block'}
						<div>
							<label for="action-block-reason" class="label mb-1 block text-sm">Reason (required)</label>
							<textarea
								id="action-block-reason"
								bind:value={actionBlockReason}
								placeholder="Why is this action blocked?"
								class="textarea w-full"
								rows="3"
								disabled={isProcessingAction}
							></textarea>
						</div>
					{:else}
						<div>
							<label for="action-cancel-reason" class="label mb-1 block text-sm">Reason (optional)</label>
							<textarea
								id="action-cancel-reason"
								bind:value={actionCancelReason}
								placeholder="Why is this action being cancelled?"
								class="textarea w-full"
								rows="3"
								disabled={isProcessingAction}
							></textarea>
						</div>
					{/if}
				</div>

				<div class="mt-6 flex justify-end gap-3">
					<button
						type="button"
						onclick={() => (showActionModal = false)}
						class="btn preset-tonal-surface"
						disabled={isProcessingAction}
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={processAction}
						class="btn {actionModalMode === 'cancel' ? 'preset-outlined-surface-500' : actionModalMode === 'block' ? 'preset-filled-warning-500' : 'preset-filled-success-500'}"
						disabled={isProcessingAction || (actionModalMode === 'complete' && !actionOutcome.trim()) || (actionModalMode === 'block' && !actionBlockReason.trim())}
					>
						{#if isProcessingAction}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Processing...
						{:else if actionModalMode === 'start'}
							Start Action
						{:else if actionModalMode === 'complete'}
							Complete Action
						{:else if actionModalMode === 'block'}
							Block Action
						{:else}
							Cancel Action
						{/if}
					</button>
				</div>
			</Card>
		</div>
	{/if}

	<!-- Media Lightbox Modal -->
	{#if lightboxOpen && lightboxAttachment}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
			onclick={closeLightbox}
			onkeydown={handleLightboxKeydown}
			role="dialog"
			aria-modal="true"
			aria-label="Media viewer"
			tabindex="-1"
		>
			<!-- Close button -->
			<button
				type="button"
				onclick={closeLightbox}
				class="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
				aria-label="Close viewer"
			>
				<X class="h-6 w-6" />
			</button>

			<!-- Download button -->
			<a
				href={lightboxAttachment.presignedFileUrl || lightboxAttachment.fileUrl}
				download={lightboxAttachment.fileName}
				class="absolute right-16 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
				title="Download original"
				onclick={(e) => e.stopPropagation()}
			>
				<Download class="h-5 w-5" />
			</a>

			<!-- Media content -->
			<div
				class="relative max-h-[90vh] max-w-[90vw]"
				onclick={(e) => e.stopPropagation()}
				role="presentation"
			>
				{#if lightboxAttachment.mimeType.startsWith('image/')}
					<img
						src={lightboxAttachment.presignedFileUrl || ''}
						alt={lightboxAttachment.fileName}
						class="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
					/>
				{:else if lightboxAttachment.mimeType.startsWith('video/')}
					<video
						src={lightboxAttachment.presignedFileUrl || ''}
						controls
						autoplay
						class="max-h-[90vh] max-w-[90vw] rounded-lg"
					>
						<track kind="captions" />
						Your browser does not support the video tag.
					</video>
				{/if}

				<!-- File info below media -->
				<div class="mt-4 text-center text-white">
					<p class="font-medium">{lightboxAttachment.fileName}</p>
					<p class="text-sm text-white/70">
						{formatFileSize(lightboxAttachment.fileSize)} • {formatShortDate(lightboxAttachment.createdAt)}
					</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Accept Bid Modal -->
	{#if showAcceptBidModal && selectedBid}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<Card class="w-full max-w-md" variant="elevated" padding="lg">
				<h3 class="text-lg font-semibold">Accept Bid</h3>
				<p class="mt-2 text-surface-500">
					Accept bid from <strong>{selectedBid.vendorName}</strong> for {formatCurrency(selectedBid.amount)}?
				</p>
				<p class="mt-1 text-sm text-surface-400">
					This will reject all other pending bids for this case.
				</p>

				{#if bidActionError}
					<div class="mt-4 rounded-lg bg-error-100 p-3 text-sm text-error-700 dark:bg-error-900/30 dark:text-error-400">
						{bidActionError}
					</div>
				{/if}

				<div class="mt-4">
					<label class="label">Reason (optional)</label>
					<textarea
						class="input mt-1"
						placeholder="Why are you selecting this vendor?"
						bind:value={bidActionReason}
						rows="2"
						disabled={isProcessingBidAction}
					></textarea>
				</div>

				<div class="mt-6 flex justify-end gap-3">
					<button
						type="button"
						onclick={() => (showAcceptBidModal = false)}
						class="btn preset-tonal-surface"
						disabled={isProcessingBidAction}
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={acceptBid}
						class="btn preset-filled-success-500"
						disabled={isProcessingBidAction}
					>
						{#if isProcessingBidAction}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Accepting...
						{:else}
							<Check class="mr-2 h-4 w-4" />
							Accept Bid
						{/if}
					</button>
				</div>
			</Card>
		</div>
	{/if}

	<!-- Reject Bid Modal -->
	{#if showRejectBidModal && selectedBid}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<Card class="w-full max-w-md" variant="elevated" padding="lg">
				<h3 class="text-lg font-semibold">Reject Bid</h3>
				<p class="mt-2 text-surface-500">
					Reject bid from <strong>{selectedBid.vendorName}</strong>?
				</p>

				{#if bidActionError}
					<div class="mt-4 rounded-lg bg-error-100 p-3 text-sm text-error-700 dark:bg-error-900/30 dark:text-error-400">
						{bidActionError}
					</div>
				{/if}

				<div class="mt-4">
					<label class="label">Reason (optional)</label>
					<textarea
						class="input mt-1"
						placeholder="Why are you rejecting this bid?"
						bind:value={bidActionReason}
						rows="2"
						disabled={isProcessingBidAction}
					></textarea>
				</div>

				<div class="mt-6 flex justify-end gap-3">
					<button
						type="button"
						onclick={() => (showRejectBidModal = false)}
						class="btn preset-tonal-surface"
						disabled={isProcessingBidAction}
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={rejectBid}
						class="btn preset-filled-error-500"
						disabled={isProcessingBidAction}
					>
						{#if isProcessingBidAction}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Rejecting...
						{:else}
							<XCircle class="mr-2 h-4 w-4" />
							Reject Bid
						{/if}
					</button>
				</div>
			</Card>
		</div>
	{/if}

	<!-- Scope Amendment Modal -->
	{#if showScopeAmendmentModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<Card class="w-full max-w-lg" variant="elevated" padding="lg">
				<h3 class="text-lg font-semibold">Add Scope Amendment</h3>
				<p class="mt-2 text-sm text-surface-500">
					Describe the changes or additions to the work scope. This will be recorded as an amendment to the original scope.
				</p>

				{#if scopeAmendmentError}
					<div class="mt-4 rounded-lg bg-error-100 p-3 text-sm text-error-700 dark:bg-error-900/30 dark:text-error-400">
						{scopeAmendmentError}
					</div>
				{/if}

				<div class="mt-4">
					<label for="scope-amendment" class="label">Amendment Details</label>
					<textarea
						id="scope-amendment"
						class="input mt-1"
						placeholder="Describe the scope changes..."
						bind:value={scopeAmendmentContent}
						rows="4"
						disabled={isAddingScopeAmendment}
					></textarea>
				</div>

				<div class="mt-6 flex justify-end gap-3">
					<button
						type="button"
						onclick={() => (showScopeAmendmentModal = false)}
						class="btn preset-tonal-surface"
						disabled={isAddingScopeAmendment}
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={addScopeAmendment}
						class="btn preset-filled-primary-500"
						disabled={isAddingScopeAmendment || !scopeAmendmentContent.trim()}
					>
						{#if isAddingScopeAmendment}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Adding...
						{:else}
							<Plus class="mr-2 h-4 w-4" />
							Add Amendment
						{/if}
					</button>
				</div>
			</Card>
		</div>
	{/if}

	<!-- Message Composer Modal -->
	{#if showMessageComposerModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<Card class="w-full max-w-lg" variant="elevated" padding="lg">
				<h3 class="text-lg font-semibold">Log Communication</h3>
				<p class="mt-2 text-sm text-surface-500">
					Record an outbound or inbound communication for this case.
				</p>

				{#if messageError}
					<div class="mt-4 rounded-lg bg-error-100 p-3 text-sm text-error-700 dark:bg-error-900/30 dark:text-error-400">
						{messageError}
					</div>
				{/if}

				<div class="mt-4 grid gap-4 sm:grid-cols-2">
					<div>
						<label for="msg-channel" class="label">Channel</label>
						<select
							id="msg-channel"
							class="select mt-1"
							bind:value={messageChannel}
							disabled={isSendingMessage}
						>
							<option value={CommunicationChannel.EMAIL}>Email</option>
							<option value={CommunicationChannel.SMS}>SMS</option>
							<option value={CommunicationChannel.LETTER}>Letter</option>
						</select>
					</div>
					<div>
						<label for="msg-direction" class="label">Direction</label>
						<select
							id="msg-direction"
							class="select mt-1"
							bind:value={messageDirection}
							disabled={isSendingMessage}
						>
							<option value={CommunicationDirection.OUTBOUND}>Outbound</option>
							<option value={CommunicationDirection.INBOUND}>Inbound</option>
							<option value={CommunicationDirection.INTERNAL}>Internal</option>
						</select>
					</div>
				</div>

				<div class="mt-4">
					<label for="msg-recipient" class="label">Recipient</label>
					<input
						id="msg-recipient"
						type="text"
						class="input mt-1"
						placeholder="Email or phone number"
						bind:value={messageRecipient}
						disabled={isSendingMessage}
					/>
				</div>

				<div class="mt-4">
					<label for="msg-subject" class="label">Subject (optional)</label>
					<input
						id="msg-subject"
						type="text"
						class="input mt-1"
						placeholder="Communication subject"
						bind:value={messageSubject}
						disabled={isSendingMessage}
					/>
				</div>

				<div class="mt-4">
					<label for="msg-content" class="label">Content</label>
					<textarea
						id="msg-content"
						class="input mt-1"
						placeholder="Message content..."
						bind:value={messageContent}
						rows="4"
						disabled={isSendingMessage}
					></textarea>
				</div>

				<div class="mt-6 flex justify-end gap-3">
					<button
						type="button"
						onclick={() => (showMessageComposerModal = false)}
						class="btn preset-tonal-surface"
						disabled={isSendingMessage}
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={sendMessage}
						class="btn preset-filled-primary-500"
						disabled={isSendingMessage || !messageContent.trim()}
					>
						{#if isSendingMessage}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Logging...
						{:else}
							<MessageSquare class="mr-2 h-4 w-4" />
							Log Communication
						{/if}
					</button>
				</div>
			</Card>
		</div>
	{/if}

	<!-- Timeline Entry Modal -->
	{#if showTimelineEntryModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<Card class="w-full max-w-lg" variant="elevated" padding="lg">
				<h3 class="text-lg font-semibold">Add Timeline Entry</h3>
				<p class="mt-2 text-sm text-surface-500">
					Add a manual event to the case timeline to record important milestones or activities.
				</p>

				{#if timelineEntryError}
					<div class="mt-4 rounded-lg bg-error-100 p-3 text-sm text-error-700 dark:bg-error-900/30 dark:text-error-400">
						{timelineEntryError}
					</div>
				{/if}

				<div class="mt-4">
					<label for="timeline-title" class="label">Title (optional)</label>
					<input
						id="timeline-title"
						type="text"
						class="input mt-1"
						placeholder="Brief title for the event"
						bind:value={timelineEntryTitle}
						disabled={isAddingTimelineEntry}
					/>
				</div>

				<div class="mt-4">
					<label for="timeline-content" class="label">Details</label>
					<textarea
						id="timeline-content"
						class="input mt-1"
						placeholder="Describe what happened..."
						bind:value={timelineEntryContent}
						rows="4"
						disabled={isAddingTimelineEntry}
					></textarea>
				</div>

				<div class="mt-6 flex justify-end gap-3">
					<button
						type="button"
						onclick={() => (showTimelineEntryModal = false)}
						class="btn preset-tonal-surface"
						disabled={isAddingTimelineEntry}
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={addTimelineEntry}
						class="btn preset-filled-primary-500"
						disabled={isAddingTimelineEntry || !timelineEntryContent.trim()}
					>
						{#if isAddingTimelineEntry}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Adding...
						{:else}
							<Plus class="mr-2 h-4 w-4" />
							Add Entry
						{/if}
					</button>
				</div>
			</Card>
		</div>
	{/if}
</PageContainer>

