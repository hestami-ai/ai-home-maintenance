<script lang="ts">
	import { page } from '$app/stores';
	import { ConciergeCaseStatusValues, ConciergeCasePriorityValues, CaseNoteTypeValues } from '$lib/api/cam';
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
		Play as PlayIcon
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
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
			await orpc.conciergeCase.assign({
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
			await orpc.conciergeCase.updateStatus({
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
			await orpc.conciergeCase.addNote({
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

	const tabs = [
		{ id: 'overview', label: 'Overview', icon: Home },
		{ id: 'context', label: 'Context', icon: MapPin },
		{ id: 'scope', label: 'Scope', icon: Settings },
		{ id: 'tasks', label: 'Tasks', icon: CheckCircle },
		{ id: 'vendors', label: 'Vendors', icon: Users },
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

					{:else if activeTab === 'scope'}
						<!-- Scope Tab -->
						<Card variant="outlined" padding="lg">
							<h2 class="text-lg font-semibold">Work Scope</h2>
							<p class="mt-4 text-surface-500">
								Work scope details will be displayed here once defined.
							</p>
						</Card>

					{:else if activeTab === 'tasks'}
						<!-- Tasks Tab -->
						<Card variant="outlined" padding="lg">
							<h2 class="text-lg font-semibold">Tasks & Actions</h2>
							{#if caseDetail.actions && caseDetail.actions.length > 0}
								<div class="mt-4 space-y-3">
									{#each caseDetail.actions as action}
										<div class="rounded-lg border border-surface-300-700 p-4">
											<div class="flex items-start justify-between">
												<div>
													<p class="font-medium">{action.actionType}</p>
													{#if action.description}
														<p class="mt-1 text-sm text-surface-500">{action.description}</p>
													{/if}
												</div>
												<span class="badge preset-outlined-surface-500 text-xs">
													{action.status}
												</span>
											</div>
											<p class="mt-2 text-xs text-surface-400">{formatDate(action.createdAt)}</p>
										</div>
									{/each}
								</div>
							{:else}
								<p class="mt-4 text-surface-500">No actions recorded yet.</p>
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
						<Card variant="outlined" padding="lg">
							<h2 class="text-lg font-semibold">Notes & Communications</h2>
							{#if caseDetail.notes && caseDetail.notes.length > 0}
								<div class="mt-4 space-y-3">
									{#each caseDetail.notes as note}
										<div class="rounded-lg border border-surface-300-700 p-4">
											<div class="flex items-start gap-3">
												<MessageSquare class="h-5 w-5 text-surface-400 mt-0.5" />
												<div class="flex-1">
													<div class="flex items-center gap-2">
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
								<p class="mt-4 text-surface-500">No notes or communications recorded yet.</p>
							{/if}
						</Card>

					{:else if activeTab === 'timeline'}
						<!-- Timeline Tab -->
						<Card variant="outlined" padding="lg">
							<h2 class="text-lg font-semibold">Activity Timeline</h2>
							<p class="mt-1 text-sm text-surface-500">Complete chronological history of all case events</p>
							
							<div class="mt-6 space-y-4">
								<!-- Status changes -->
								{#if caseDetail.statusHistory}
									{#each caseDetail.statusHistory as history}
										<div class="flex gap-4">
											<div class="flex flex-col items-center">
												<div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500/10">
													<Activity class="h-4 w-4 text-primary-500" />
												</div>
												<div class="flex-1 w-px bg-surface-300-700"></div>
											</div>
											<div class="flex-1 pb-4">
												<p class="font-medium">
													Status changed to {getStatusLabel(history.toStatus)}
												</p>
												{#if history.fromStatus}
													<p class="text-sm text-surface-500">From: {getStatusLabel(history.fromStatus)}</p>
												{/if}
												{#if history.reason}
													<p class="mt-1 text-sm text-surface-500">{history.reason}</p>
												{/if}
												<p class="mt-1 text-xs text-surface-400">{formatDate(history.createdAt)}</p>
											</div>
										</div>
									{/each}
								{/if}

								<!-- Notes -->
								{#if caseDetail.notes}
									{#each caseDetail.notes as note}
										<div class="flex gap-4">
											<div class="flex flex-col items-center">
												<div class="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-500/10">
													<MessageSquare class="h-4 w-4 text-secondary-500" />
												</div>
												<div class="flex-1 w-px bg-surface-300-700"></div>
											</div>
											<div class="flex-1 pb-4">
												<p class="font-medium">{note.noteType} added</p>
												<p class="mt-1 text-sm text-surface-500 line-clamp-2">{note.content}</p>
												<p class="mt-2 text-xs text-surface-400">
													{formatDate(note.createdAt)}
												</p>
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
							</div>
							<p class="mt-1 text-sm text-surface-500">
								Post-completion review for institutional knowledge
							</p>

							<div class="mt-6 rounded-lg bg-surface-100-900 p-4">
								<p class="text-sm text-surface-500">
									Case reviews capture outcome summaries, vendor performance notes, issues encountered, and reusability flags.
									Reviews can be created once a case is resolved or closed.
								</p>
								{#if caseDetail.case.status === ConciergeCaseStatusValues.RESOLVED || caseDetail.case.status === ConciergeCaseStatusValues.CLOSED}
									<p class="mt-2 text-sm text-success-500">
										This case is eligible for review.
									</p>
								{:else}
									<p class="mt-2 text-sm text-warning-500">
										Case must be resolved or closed before creating a review.
									</p>
								{/if}
							</div>
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
						<select
							id="staff-select"
							bind:value={selectedStaffUserId}
							class="select w-full"
							disabled={isReassigning}
						>
							<option value={null}>Unassigned</option>
							{#each staffMembers as staff}
								<option value={staff.userId}>{staff.displayName}</option>
							{/each}
						</select>
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
						<select
							id="status-select"
							bind:value={selectedStatus}
							class="select w-full"
							disabled={isChangingStatus}
						>
							<option value="">Select a status...</option>
							{#each availableStatuses as status}
								<option value={status}>{getStatusLabel(status)}</option>
							{/each}
						</select>
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
						<select
							id="note-type"
							bind:value={noteType}
							class="select w-full"
							disabled={isAddingNote}
						>
							<option value={CaseNoteTypeValues.GENERAL}>General</option>
							<option value={CaseNoteTypeValues.CLARIFICATION_REQUEST}>Clarification Request</option>
							<option value={CaseNoteTypeValues.CLARIFICATION_RESPONSE}>Clarification Response</option>
							<option value={CaseNoteTypeValues.DECISION_RATIONALE}>Decision Rationale</option>
						</select>
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
</PageContainer>

