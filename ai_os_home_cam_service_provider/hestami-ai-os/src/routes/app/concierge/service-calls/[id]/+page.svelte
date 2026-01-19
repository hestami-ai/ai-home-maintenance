<script lang="ts">
	import {
		ArrowLeft,
		Loader2,
		Clock,
		MapPin,
		MessageSquare,
		Send,
		CheckCircle,
		AlertCircle,
		Home,
		DollarSign,
		Calendar,
		Check,
		X,
		Star,
		FileText,
		Image,
		Video,
		File,
		Download,
		Paperclip,
		Pencil,
		Save,
		Plus,
		Eye
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import { orpc } from '$lib/api';
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import ServiceCallMediaUpload from '$lib/components/concierge/ServiceCallMediaUpload.svelte';
	import {
		getServiceCallStatusLabel,
		getServiceCallStatusColor,
		getServiceCallStatusDotColor,
		priorityToUrgency,
		SERVICE_CALL_URGENCY_LABELS,
		SERVICE_CALL_URGENCY_DESCRIPTIONS,
		SERVICE_CALL_URGENCY_COLORS,
		urgencyToPriority,
		type ServiceCallUrgency
	} from '$lib/utils/serviceCallTerminology';
	import type { ConciergeCaseStatus, ConciergeCasePriority } from '$lib/api/cam';
	import { BidStatusValues, CaseNoteTypeValues, ConciergeCaseStatusValues, ConciergeCasePriorityValues } from '$lib/api/cam';

	type AvailabilityType = 'FLEXIBLE' | 'SPECIFIC';

	interface AvailabilitySlot {
		id: string;
		startTime: string;
		endTime: string;
		notes: string | null;
	}

	interface EditAvailabilitySlot {
		id: string;
		date: string;
		startTime: string;
		endTime: string;
		notes?: string;
	}

	interface ServiceCall {
		id: string;
		caseNumber: string;
		title: string;
		description: string;
		status: ConciergeCaseStatus;
		priority: ConciergeCasePriority;
		availabilityType: AvailabilityType;
		availabilityNotes: string | null;
		availabilitySlots: AvailabilitySlot[];
		createdAt: string;
		updatedAt: string;
		resolvedAt: string | null;
		resolutionSummary: string | null;
	}

	interface Property {
		id: string;
		name: string;
		addressLine1: string;
		city: string | null;
		state: string | null;
		postalCode: string | null;
	}

	interface Note {
		id: string;
		content: string;
		noteType: string;
		isInternal: boolean;
		createdBy: string;
		createdAt: string;
	}

	interface StatusHistory {
		id: string;
		fromStatus: string | null;
		toStatus: string;
		reason: string | null;
		changedBy: string;
		createdAt: string;
	}

	interface Quote {
		id: string;
		vendorCandidateId: string;
		vendorName: string;
		amount: string | null;
		currency: string;
		status: string;
		validUntil: string | null;
		estimatedDuration: number | null;
		receivedAt: string;
	}

	interface Attachment {
		id: string;
		fileName: string;
		fileSize: number;
		mimeType: string;
		fileUrl: string;
		uploadedBy: string;
		createdAt: string;
	}

	interface Organization {
		id: string;
		name: string;
		slug: string;
		type: string;
		status: string;
	}

	interface Props {
		data: {
			serviceCall: ServiceCall;
			property: Property;
			notes: Note[];
			statusHistory: StatusHistory[];
			attachments: Attachment[];
			quotes: Quote[];
			organization: Organization | null;
		};
	}

	let { data }: Props = $props();

	// Use $state + $effect to sync data - track data reference but guard against undefined
	let serviceCall = $state<ServiceCall | null>(null);
	let property = $state<Property | null>(null);
	let notes = $state<Note[]>([]);
	let statusHistory = $state<StatusHistory[]>([]);
	let attachments = $state<Attachment[]>([]);
	let quotes = $state<Quote[]>([]);
	let organization = $state<Organization | null>(null);
	let isLoading = $state(false);
	let isLoadingQuotes = $state(false);
	let isRespondingToQuote = $state<string | null>(null);
	let error = $state<string | null>(null);

	const caseId = $derived(serviceCall?.id ?? '');

	// Edit mode state
	let isEditMode = $state(false);
	let isSaving = $state(false);
	let isUploadingMedia = $state(false);
	let editTitle = $state('');
	let editDescription = $state('');
	let editUrgency = $state<ServiceCallUrgency>('ROUTINE');
	let editAvailabilityType = $state<AvailabilityType>('FLEXIBLE');
	let editAvailabilityNotes = $state('');
	let editAvailabilitySlots = $state<EditAvailabilitySlot[]>([]);
	let editError = $state<string | null>(null);

	// Cancel state
	let showCancelConfirm = $state(false);
	let isCancelling = $state(false);
	let cancelReason = $state('');

	// Attachment preview state
	let previewAttachment = $state<Attachment | null>(null);

	// Reference to media upload component
	let mediaUploadComponent: ServiceCallMediaUpload | undefined = $state();

	const urgencies: ServiceCallUrgency[] = ['ROUTINE', 'SOON', ConciergeCasePriorityValues.URGENT, ConciergeCasePriorityValues.EMERGENCY];

	// Check if case can be edited (not closed or cancelled)
	const canEdit = $derived(
		serviceCall &&
		!([ConciergeCaseStatusValues.RESOLVED, ConciergeCaseStatusValues.CLOSED, ConciergeCaseStatusValues.CANCELLED] as string[]).includes(serviceCall.status)
	);

	// Helper to get file icon based on MIME type
	function getFileIcon(mimeType: string) {
		if (mimeType.startsWith('image/')) return Image;
		if (mimeType.startsWith('video/')) return Video;
		if (mimeType.includes('pdf')) return FileText;
		return File;
	}

	// Helper to format file size
	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}


	// New note form
	let newNoteContent = $state('');
	let isSubmittingNote = $state(false);

	// Synchronize all data to local state for reactive updates
	$effect(() => {
		// Track data to trigger re-runs on navigation, but guard against undefined
		if (data == null || typeof data !== 'object') return;
		serviceCall = data.serviceCall ?? null;
		property = data.property ?? null;
		statusHistory = data.statusHistory ?? [];
		attachments = data.attachments ?? [];
		organization = data.organization ?? null;
		if (data.notes) notes = [...data.notes];
		if (data.quotes) quotes = [...data.quotes];
	});

	// Helper to parse ISO datetime to date and time parts
	function parseISODateTime(isoString: string): { date: string; time: string } {
		const dt = new Date(isoString);
		const date = dt.toISOString().split('T')[0];
		const time = dt.toTimeString().slice(0, 5);
		return { date, time };
	}

	// Helper to add a new availability slot
	function addEditAvailabilitySlot() {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		const dateStr = tomorrow.toISOString().split('T')[0];

		editAvailabilitySlots = [
			...editAvailabilitySlots,
			{
				id: crypto.randomUUID(),
				date: dateStr,
				startTime: '09:00',
				endTime: '17:00'
			}
		];
	}

	// Helper to remove an availability slot
	function removeEditAvailabilitySlot(id: string) {
		editAvailabilitySlots = editAvailabilitySlots.filter((s) => s.id !== id);
	}

	// Convert local date/time to ISO datetime string
	function toISODateTime(date: string, time: string): string {
		return new Date(`${date}T${time}:00`).toISOString();
	}

	// Initialize edit form values when entering edit mode
	function enterEditMode() {
		if (!serviceCall) return;
		editTitle = serviceCall.title;
		editDescription = serviceCall.description;
		editUrgency = priorityToUrgency(serviceCall.priority);
		editAvailabilityType = serviceCall.availabilityType;
		editAvailabilityNotes = serviceCall.availabilityNotes ?? '';
		// Convert existing slots to edit format
		editAvailabilitySlots = serviceCall.availabilitySlots.map((slot) => {
			const start = parseISODateTime(slot.startTime);
			const end = parseISODateTime(slot.endTime);
			return {
				id: slot.id,
				date: start.date,
				startTime: start.time,
				endTime: end.time,
				notes: slot.notes ?? undefined
			};
		});
		editError = null;
		isEditMode = true;
	}

	function cancelEdit() {
		isEditMode = false;
		editError = null;
	}

	async function saveChanges() {
		if (!serviceCall || isSaving) return;

		// Validate
		if (!editTitle.trim()) {
			editError = 'Title is required';
			return;
		}
		if (!editDescription.trim() || editDescription.trim().length < 10) {
			editError = 'Description must be at least 10 characters';
			return;
		}
		if (editAvailabilityType === 'SPECIFIC' && editAvailabilitySlots.length === 0) {
			editError = 'Please add at least one availability time slot';
			return;
		}

		isSaving = true;
		editError = null;

		try {
			// Prepare availability slots for API
			const slotsForApi =
				editAvailabilityType === 'SPECIFIC'
					? editAvailabilitySlots.map((slot) => ({
							startTime: toISODateTime(slot.date, slot.startTime),
							endTime: toISODateTime(slot.date, slot.endTime),
							notes: slot.notes
						}))
					: [];

			// Update case details
			const newPriority = urgencyToPriority(editUrgency);
			await orpc.conciergeCase.update({
				idempotencyKey: crypto.randomUUID(),
				id: serviceCall.id,
				title: editTitle.trim(),
				description: editDescription.trim(),
				priority: newPriority,
				availabilityType: editAvailabilityType,
				availabilityNotes: editAvailabilityNotes.trim() || undefined,
				availabilitySlots: slotsForApi
			});

			// Upload any new media files
			if (mediaUploadComponent?.hasPendingFiles()) {
				isUploadingMedia = true;
				const uploadResult = await mediaUploadComponent.uploadFilesForCase(serviceCall.id);
				if (!uploadResult.success) {
					console.warn('Some media uploads failed:', uploadResult);
				}
				isUploadingMedia = false;
			}

			// Reload the page data
			await invalidateAll();
			isEditMode = false;
		} catch (err) {
			console.error('Failed to save changes:', err);
			editError = err instanceof Error ? err.message : 'Failed to save changes';
		} finally {
			isSaving = false;
			isUploadingMedia = false;
		}
	}



	async function loadQuotes() {
		isLoadingQuotes = true;
		try {
			const result = await orpc.vendorBid.listByCase({ caseId, limit: 20 });
			quotes = result.data.bids.filter((b: any) => b.isCustomerFacing !== false);
		} catch (err) {
			console.error('Failed to load quotes:', err);
		} finally {
			isLoadingQuotes = false;
		}
	}

	async function approveQuote(quoteId: string) {
		if (isRespondingToQuote) return;
		isRespondingToQuote = quoteId;

		try {
			await orpc.vendorBid.accept({ idempotencyKey: crypto.randomUUID(), id: quoteId });
			// Reload quotes to get updated statuses
			await loadQuotes();
			// Reload service call to get updated status
			await invalidateAll();
		} catch (err) {
			console.error('Failed to approve quote:', err);
		} finally {
			isRespondingToQuote = null;
		}
	}

	async function declineQuote(quoteId: string) {
		if (isRespondingToQuote) return;
		isRespondingToQuote = quoteId;

		try {
			await orpc.vendorBid.reject({ idempotencyKey: crypto.randomUUID(), id: quoteId, reason: 'Declined by property owner' });
			await loadQuotes();
		} catch (err) {
			console.error('Failed to decline quote:', err);
		} finally {
			isRespondingToQuote = null;
		}
	}

	async function cancelServiceCall() {
		if (!serviceCall || isCancelling) return;

		isCancelling = true;

		try {
			await orpc.conciergeCase.cancel({
				idempotencyKey: crypto.randomUUID(),
				id: serviceCall.id,
				reason: cancelReason.trim() || 'Cancelled by property owner'
			});

			// Reload the page data
			await invalidateAll();
			showCancelConfirm = false;
			cancelReason = '';
		} catch (err) {
			console.error('Failed to cancel service call:', err);
		} finally {
			isCancelling = false;
		}
	}

	function formatCurrency(amount: string | null): string {
		if (!amount) return 'TBD';
		const num = parseFloat(amount);
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(num);
	}

	async function submitNote() {
		if (!newNoteContent.trim() || isSubmittingNote || !serviceCall) return;

		isSubmittingNote = true;

		try {
			const result = await orpc.conciergeCase.addNote({
				idempotencyKey: crypto.randomUUID(),
				caseId: serviceCall.id,
				content: newNoteContent.trim(),
				noteType: CaseNoteTypeValues.GENERAL,
				isInternal: false
			});

			notes = [...notes, result.data.note];
			newNoteContent = '';
		} catch (err) {
			console.error('Failed to add note:', err);
		} finally {
			isSubmittingNote = false;
		}
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

	function formatRelativeTime(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return formatDate(dateString);
	}
</script>

<svelte:head>
	<title>{serviceCall?.caseNumber || 'Service Call'} | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-8">
		{#if isLoading}
			<div class="flex items-center justify-center py-12">
				<Loader2 class="h-8 w-8 animate-spin text-primary-500" />
			</div>
		{:else if error}
			<Card variant="outlined" padding="md">
				<div class="text-center">
					<p class="text-error-500">{error}</p>
					<div class="mt-4 flex justify-center gap-2">
						<a href="/app/concierge" class="btn preset-tonal-surface">
							<ArrowLeft class="mr-2 h-4 w-4" />
							Back to Dashboard
						</a>
						<button onclick={() => invalidateAll()} class="btn preset-tonal-primary">Try Again</button>
					</div>
				</div>
			</Card>
		{:else if serviceCall && property}
			<!-- Header -->
			<div class="mb-6">
				<a
					href="/app/concierge"
					class="mb-4 inline-flex items-center text-sm text-surface-500 hover:text-surface-700"
				>
					<ArrowLeft class="mr-1 h-4 w-4" />
					Back to Dashboard
				</a>

				<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<div class="flex items-center gap-3">
							<h1 class="text-2xl font-bold">{serviceCall.title}</h1>
							<span
								class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium {getServiceCallStatusColor(
									serviceCall.status
								)}"
							>
								<span class="h-1.5 w-1.5 rounded-full {getServiceCallStatusDotColor(serviceCall.status)}"></span>
								{getServiceCallStatusLabel(serviceCall.status)}
							</span>
						</div>
						<p class="mt-1 text-surface-500">
							{serviceCall.caseNumber} • Submitted {formatRelativeTime(serviceCall.createdAt)}
						</p>
					</div>
					{#if canEdit && !isEditMode}
						<div class="flex gap-2">
							<button
								type="button"
								onclick={enterEditMode}
								class="btn preset-tonal-primary"
							>
								<Pencil class="mr-2 h-4 w-4" />
								Edit
							</button>
							<button
								type="button"
								onclick={() => (showCancelConfirm = true)}
								class="btn preset-tonal-error"
							>
								<X class="mr-2 h-4 w-4" />
								Cancel Request
							</button>
						</div>
					{/if}
				</div>
			</div>

			{#if isEditMode}
				<!-- Edit Mode -->
				<div class="space-y-6">
					{#if editError}
						<div class="rounded-lg bg-error-500/10 p-4 text-sm text-error-500">
							{editError}
						</div>
					{/if}

					<!-- Edit Title -->
					<Card variant="outlined" padding="md">
						<h2 class="mb-4 font-semibold">Edit Service Call</h2>
						<div class="space-y-4">
							<div>
								<label for="edit-title" class="label mb-1 block">
									Title <span class="text-error-500">*</span>
								</label>
								<input
									type="text"
									id="edit-title"
									bind:value={editTitle}
									placeholder="Brief summary of the issue"
									class="input w-full"
									maxlength="255"
									disabled={isSaving}
								/>
							</div>

							<div>
								<label for="edit-description" class="label mb-1 block">
									Description <span class="text-error-500">*</span>
								</label>
								<textarea
									id="edit-description"
									bind:value={editDescription}
									placeholder="Detailed description of the issue"
									class="textarea w-full"
									rows="5"
									disabled={isSaving}
								></textarea>
								<p class="mt-1 text-xs text-surface-500">Minimum 10 characters</p>
							</div>
						</div>
					</Card>

					<!-- Edit Urgency -->
					<Card variant="outlined" padding="md">
						<h2 class="mb-4 font-semibold">Urgency</h2>
						<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
							{#each urgencies as urg}
								<button
									type="button"
									onclick={() => (editUrgency = urg)}
									class="rounded-lg border p-4 text-left transition-all {editUrgency === urg
										? 'border-primary-500 bg-primary-500/5 ring-2 ring-primary-500/20'
										: 'border-surface-300 hover:border-primary-300 dark:border-surface-700'}"
									disabled={isSaving}
								>
									<p class="font-medium {SERVICE_CALL_URGENCY_COLORS[urg]}">
										{SERVICE_CALL_URGENCY_LABELS[urg]}
									</p>
									<p class="mt-1 text-sm text-surface-500">{SERVICE_CALL_URGENCY_DESCRIPTIONS[urg]}</p>
								</button>
							{/each}
						</div>
					</Card>

					<!-- Edit Availability -->
					<Card variant="outlined" padding="md">
						<h2 class="mb-4 font-semibold">Your Availability</h2>
						<p class="mb-4 text-sm text-surface-500">
							When can a service provider visit your property?
						</p>

						<div class="grid gap-3 sm:grid-cols-2">
							<button
								type="button"
								onclick={() => {
									editAvailabilityType = 'FLEXIBLE';
									editAvailabilitySlots = [];
								}}
								class="rounded-lg border p-4 text-left transition-all {editAvailabilityType === 'FLEXIBLE'
									? 'border-primary-500 bg-primary-500/5 ring-2 ring-primary-500/20'
									: 'border-surface-300 hover:border-primary-300 dark:border-surface-700'}"
								disabled={isSaving}
							>
								<div class="flex items-center gap-2">
									<Clock
										class="h-5 w-5 {editAvailabilityType === 'FLEXIBLE'
											? 'text-primary-500'
											: 'text-surface-500'}"
									/>
									<span class="font-medium">Flexible / ASAP</span>
								</div>
								<p class="mt-2 text-sm text-surface-500">
									I'm flexible with scheduling. Contact me to arrange a convenient time.
								</p>
							</button>

							<button
								type="button"
								onclick={() => {
									editAvailabilityType = 'SPECIFIC';
									if (editAvailabilitySlots.length === 0) {
										addEditAvailabilitySlot();
									}
								}}
								class="rounded-lg border p-4 text-left transition-all {editAvailabilityType === 'SPECIFIC'
									? 'border-primary-500 bg-primary-500/5 ring-2 ring-primary-500/20'
									: 'border-surface-300 hover:border-primary-300 dark:border-surface-700'}"
								disabled={isSaving}
							>
								<div class="flex items-center gap-2">
									<Calendar
										class="h-5 w-5 {editAvailabilityType === 'SPECIFIC'
											? 'text-primary-500'
											: 'text-surface-500'}"
									/>
									<span class="font-medium">Specific Times</span>
								</div>
								<p class="mt-2 text-sm text-surface-500">
									I have specific dates and times when I'm available.
								</p>
							</button>
						</div>

						{#if editAvailabilityType === 'SPECIFIC'}
							<div class="mt-4 space-y-3">
								<p class="text-sm font-medium">Available Time Slots</p>

								{#each editAvailabilitySlots as slot, index (slot.id)}
									<div
										class="flex flex-wrap items-start gap-3 rounded-lg border border-surface-300 p-3 dark:border-surface-700"
									>
										<div class="flex-1 min-w-[200px]">
											<label for="slot-date-{index}" class="label mb-1 block text-xs">Date</label>
											<input
												type="date"
												id="slot-date-{index}"
												bind:value={slot.date}
												min={new Date().toISOString().split('T')[0]}
												class="input w-full"
												disabled={isSaving}
											/>
										</div>
										<div class="w-28">
											<label for="slot-start-{index}" class="label mb-1 block text-xs">From</label>
											<input
												type="time"
												id="slot-start-{index}"
												bind:value={slot.startTime}
												class="input w-full"
												disabled={isSaving}
											/>
										</div>
										<div class="w-28">
											<label for="slot-end-{index}" class="label mb-1 block text-xs">To</label>
											<input
												type="time"
												id="slot-end-{index}"
												bind:value={slot.endTime}
												class="input w-full"
												disabled={isSaving}
											/>
										</div>
										<div class="flex items-end">
											<button
												type="button"
												onclick={() => removeEditAvailabilitySlot(slot.id)}
												class="btn btn-sm preset-tonal-error mt-5"
												aria-label="Remove time slot"
												disabled={isSaving}
											>
												<X class="h-4 w-4" />
											</button>
										</div>
									</div>
								{/each}

								<button
									type="button"
									onclick={addEditAvailabilitySlot}
									class="btn btn-sm preset-tonal-primary"
									disabled={isSaving}
								>
									<Plus class="mr-1 h-4 w-4" />
									Add Another Time Slot
								</button>

								{#if editAvailabilitySlots.length === 0}
									<p class="text-sm text-warning-500">
										Please add at least one available time slot.
									</p>
								{/if}
							</div>
						{/if}

						<div class="mt-4">
							<label for="edit-availability-notes" class="label mb-1 block text-sm">
								Additional Notes (optional)
							</label>
							<textarea
								id="edit-availability-notes"
								bind:value={editAvailabilityNotes}
								placeholder="e.g., Please call before arriving, gate code is 1234, dog in backyard..."
								class="textarea w-full"
								rows="2"
								disabled={isSaving}
							></textarea>
						</div>
					</Card>

					<!-- Add Media -->
					{#if organization}
						<Card variant="outlined" padding="md">
							<ServiceCallMediaUpload
								bind:this={mediaUploadComponent}
								organizationId={organization.id}
								disabled={isSaving}
							/>
						</Card>
					{/if}

					<!-- Existing Attachments (read-only in edit mode) -->
					{#if attachments && attachments.length > 0}
						<Card variant="outlined" padding="md">
							<div class="mb-4 flex items-center gap-2">
								<Paperclip class="h-5 w-5 text-surface-500" />
								<h2 class="font-semibold">Existing Attachments</h2>
								<span class="rounded-full bg-surface-500/10 px-2 py-0.5 text-xs font-medium text-surface-500">
									{attachments.length}
								</span>
							</div>
							<div class="space-y-2">
								{#each attachments as attachment (attachment.id)}
									{@const FileIcon = getFileIcon(attachment.mimeType)}
									<div class="flex items-center gap-3 rounded-lg border border-surface-300-700 bg-surface-50-950 p-3">
										<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-200-800">
											<FileIcon class="h-5 w-5 text-surface-500" />
										</div>
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium">{attachment.fileName}</p>
											<p class="text-xs text-surface-500">
												{formatFileSize(attachment.fileSize)}
											</p>
										</div>
									</div>
								{/each}
							</div>
						</Card>
					{/if}

					<!-- Edit Actions -->
					<div class="flex justify-end gap-3">
						<button
							type="button"
							onclick={cancelEdit}
							class="btn preset-tonal-surface"
							disabled={isSaving}
						>
							Cancel
						</button>
						<button
							type="button"
							onclick={saveChanges}
							class="btn preset-filled-primary-500"
							disabled={isSaving || !editTitle.trim() || editDescription.trim().length < 10}
						>
							{#if isSaving}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
								{#if isUploadingMedia}
									Uploading media...
								{:else}
									Saving...
								{/if}
							{:else}
								<Save class="mr-2 h-4 w-4" />
								Save Changes
							{/if}
						</button>
					</div>
				</div>
			{:else}
				<div class="grid gap-6 lg:grid-cols-3">
				<!-- Main Content -->
				<div class="space-y-6 lg:col-span-2">
					<!-- Property Info -->
					<Card variant="outlined" padding="md">
						<h2 class="mb-3 font-semibold">Property</h2>
						<a
							href="/app/concierge/properties/{property.id}"
							class="flex items-start gap-3 rounded-lg p-2 -m-2 hover:bg-surface-500/5 transition-colors"
						>
							<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
								<Home class="h-5 w-5 text-primary-500" />
							</div>
							<div>
								<p class="font-medium">{property.name}</p>
								<p class="text-sm text-surface-500">
									{property.addressLine1}
								</p>
								<p class="text-sm text-surface-500">
									{property.city}, {property.state} {property.postalCode}
								</p>
							</div>
						</a>
					</Card>

					<!-- Description -->
					<Card variant="outlined" padding="md">
						<h2 class="mb-3 font-semibold">Description</h2>
						<div class="prose prose-sm max-w-none whitespace-pre-wrap text-surface-600 dark:text-surface-400">
							{serviceCall.description}
						</div>
					</Card>

					<!-- Attachments -->
					{#if attachments && attachments.length > 0}
						<Card variant="outlined" padding="md">
							<div class="mb-4 flex items-center gap-2">
								<Paperclip class="h-5 w-5 text-surface-500" />
								<h2 class="font-semibold">Attachments</h2>
								<span class="rounded-full bg-surface-500/10 px-2 py-0.5 text-xs font-medium text-surface-500">
									{attachments.length}
								</span>
							</div>

							<!-- Image Previews Grid -->
							{@const imageAttachments = attachments.filter(a => a.mimeType.startsWith('image/'))}
							{@const otherAttachments = attachments.filter(a => !a.mimeType.startsWith('image/'))}

							{#if imageAttachments.length > 0}
								<div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
									{#each imageAttachments as attachment (attachment.id)}
										<button
											type="button"
											onclick={() => (previewAttachment = attachment)}
											class="group relative aspect-square overflow-hidden rounded-lg border border-surface-300-700 bg-surface-100-900 transition-all hover:border-primary-500 hover:ring-2 hover:ring-primary-500/20"
										>
											<img
												src={attachment.fileUrl}
												alt={attachment.fileName}
												class="h-full w-full object-cover"
												loading="lazy"
											/>
											<div class="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/40">
												<Eye class="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
											</div>
											<div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
												<p class="truncate text-xs text-white">{attachment.fileName}</p>
											</div>
										</button>
									{/each}
								</div>
							{/if}

							<!-- Other Attachments List -->
							{#if otherAttachments.length > 0}
								<div class="space-y-2">
									{#each otherAttachments as attachment (attachment.id)}
										{@const FileIcon = getFileIcon(attachment.mimeType)}
										<div class="flex items-center gap-3 rounded-lg border border-surface-300-700 bg-surface-50-950 p-3">
											<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-200-800">
												<FileIcon class="h-5 w-5 text-surface-500" />
											</div>
											<div class="min-w-0 flex-1">
												<p class="truncate text-sm font-medium">{attachment.fileName}</p>
												<p class="text-xs text-surface-500">
													{formatFileSize(attachment.fileSize)} • {formatRelativeTime(attachment.createdAt)}
												</p>
											</div>
											<div class="flex gap-1">
												{#if attachment.mimeType.includes('pdf') || attachment.mimeType.startsWith('video/')}
													<a
														href={attachment.fileUrl}
														target="_blank"
														rel="noopener noreferrer"
														class="btn btn-sm preset-tonal-primary"
														title="View {attachment.fileName}"
													>
														<Eye class="h-4 w-4" />
													</a>
												{/if}
												<a
													href={attachment.fileUrl}
													download={attachment.fileName}
													class="btn btn-sm preset-tonal-surface"
													title="Download {attachment.fileName}"
												>
													<Download class="h-4 w-4" />
												</a>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</Card>
					{/if}

					<!-- Resolution (if resolved) -->
					{#if serviceCall.resolutionSummary}
						<Card variant="outlined" padding="md" class="border-green-500/50 bg-green-500/5">
							<div class="flex items-start gap-3">
								<CheckCircle class="h-5 w-5 shrink-0 text-green-500" />
								<div>
									<h2 class="font-semibold text-green-700 dark:text-green-400">Resolution</h2>
									<p class="mt-1 text-sm text-surface-600 dark:text-surface-400">
										{serviceCall.resolutionSummary}
									</p>
									{#if serviceCall.resolvedAt}
										<p class="mt-2 text-xs text-surface-500">
											Resolved {formatDate(serviceCall.resolvedAt)}
										</p>
									{/if}
								</div>
							</div>
						</Card>
					{/if}

					<!-- Quotes Section -->
					{#if quotes.length > 0 || isLoadingQuotes}
						<Card variant="outlined" padding="md">
							<div class="mb-4 flex items-center justify-between">
								<h2 class="font-semibold">Quotes</h2>
								{#if quotes.some((q) => q.status === BidStatusValues.ACCEPTED)}
									<span class="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
										<CheckCircle class="h-3 w-3" />
										Quote Approved
									</span>
								{/if}
							</div>

							{#if isLoadingQuotes}
								<div class="flex items-center justify-center py-8">
									<Loader2 class="h-6 w-6 animate-spin text-primary-500" />
								</div>
							{:else}
								<div class="space-y-4">
									{#each quotes as quote (quote.id)}
										<div
											class="rounded-lg border p-4 {quote.status === BidStatusValues.ACCEPTED
												? 'border-green-500/50 bg-green-500/5'
												: quote.status === BidStatusValues.REJECTED
													? 'border-surface-300-700 bg-surface-500/5 opacity-60'
													: 'border-surface-300-700'}"
										>
											<!-- Quote Header -->
											<div class="flex items-start justify-between gap-4">
												<div class="flex items-start gap-3">
													<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
														<DollarSign class="h-5 w-5 text-primary-500" />
													</div>
													<div>
														<div class="flex items-center gap-2">
															<h3 class="font-medium">{quote.vendorName}</h3>
														</div>
														<p class="text-2xl font-bold text-primary-600 dark:text-primary-400">
															{formatCurrency(quote.amount)}
														</p>
													</div>
												</div>

												<!-- Status Badge -->
												<span
													class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {quote.status === BidStatusValues.ACCEPTED
														? 'bg-green-500/10 text-green-600 dark:text-green-400'
														: quote.status === BidStatusValues.REJECTED
															? 'bg-surface-500/10 text-surface-500'
															: quote.status === BidStatusValues.EXPIRED
																? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
																: 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}"
												>
													{quote.status === BidStatusValues.ACCEPTED
														? 'Approved'
														: quote.status === BidStatusValues.REJECTED
															? 'Declined'
															: quote.status === BidStatusValues.EXPIRED
																? 'Expired'
																: 'Pending Review'}
												</span>
											</div>

											<!-- Timeline -->
											{#if quote.estimatedDuration}
												<div class="mt-3 flex items-center gap-4 text-sm">
													<div class="flex items-center gap-1 text-surface-500">
														<Clock class="h-4 w-4" />
														<span>{quote.estimatedDuration} day{quote.estimatedDuration !== 1 ? 's' : ''}</span>
													</div>
												</div>
											{/if}

											<!-- Valid Until -->
											{#if quote.validUntil && quote.status === BidStatusValues.PENDING}
												<p class="mt-2 text-xs text-surface-500">
													Valid until {formatDate(quote.validUntil).split(',')[0]}
												</p>
											{/if}

											<!-- Actions -->
											{#if quote.status === BidStatusValues.PENDING}
												<div class="mt-4 flex gap-2">
													<button
														type="button"
														onclick={() => approveQuote(quote.id)}
														class="btn preset-filled-primary-500 flex-1"
														disabled={isRespondingToQuote !== null}
													>
														{#if isRespondingToQuote === quote.id}
															<Loader2 class="mr-2 h-4 w-4 animate-spin" />
														{:else}
															<Check class="mr-2 h-4 w-4" />
														{/if}
														Approve Quote
													</button>
													<button
														type="button"
														onclick={() => declineQuote(quote.id)}
														class="btn preset-tonal-surface"
														disabled={isRespondingToQuote !== null}
													>
														<X class="mr-2 h-4 w-4" />
														Decline
													</button>
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</Card>
					{/if}

					<!-- Communication -->
					<Card variant="outlined" padding="md">
						<h2 class="mb-4 font-semibold">Communication</h2>

						{#if notes.length === 0}
							<p class="text-sm text-surface-500">No messages yet.</p>
						{:else}
							<div class="space-y-4">
								{#each notes as note}
									<div class="flex gap-3">
										<div
											class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-500/10"
										>
											<MessageSquare class="h-4 w-4 text-surface-500" />
										</div>
										<div class="flex-1">
											<div class="flex items-center gap-2">
												<span class="text-sm font-medium">
													{note.noteType === 'CLARIFICATION_REQUEST'
														? 'Hestami Team'
														: 'You'}
												</span>
												<span class="text-xs text-surface-500">
													{formatRelativeTime(note.createdAt)}
												</span>
											</div>
											<p class="mt-1 text-sm text-surface-600 dark:text-surface-400">
												{note.content}
											</p>
										</div>
									</div>
								{/each}
							</div>
						{/if}

						<!-- Add Note Form -->
						{#if !([ConciergeCaseStatusValues.RESOLVED, ConciergeCaseStatusValues.CLOSED, ConciergeCaseStatusValues.CANCELLED] as string[]).includes(serviceCall.status)}
							<div class="mt-4 border-t border-surface-300-700 pt-4">
								<div class="flex gap-2">
									<input
										type="text"
										bind:value={newNoteContent}
										placeholder="Add a message or update..."
										class="input flex-1"
										onkeydown={(e) => e.key === 'Enter' && submitNote()}
									/>
									<button
										type="button"
										onclick={submitNote}
										class="btn preset-filled-primary-500"
										disabled={!newNoteContent.trim() || isSubmittingNote}
									>
										{#if isSubmittingNote}
											<Loader2 class="h-4 w-4 animate-spin" />
										{:else}
											<Send class="h-4 w-4" />
										{/if}
									</button>
								</div>
							</div>
						{/if}
					</Card>

					<!-- Status History -->
					<Card variant="outlined" padding="md">
						<h2 class="mb-4 font-semibold">Status History</h2>
						<div class="space-y-3">
							{#each statusHistory as history}
								<div class="flex items-start gap-3">
									<div class="mt-0.5 h-2 w-2 rounded-full bg-surface-400"></div>
									<div class="flex-1">
										<p class="text-sm">
											{#if history.fromStatus}
												Status changed from <span class="font-medium"
													>{getServiceCallStatusLabel(history.fromStatus as ConciergeCaseStatus)}</span
												>
												to
											{:else}
												Service call created with status
											{/if}
											<span class="font-medium"
												>{getServiceCallStatusLabel(history.toStatus as ConciergeCaseStatus)}</span
											>
										</p>
										{#if history.reason}
											<p class="mt-0.5 text-sm text-surface-500">{history.reason}</p>
										{/if}
										<p class="mt-0.5 text-xs text-surface-500">
											{formatDate(history.createdAt)}
										</p>
									</div>
								</div>
							{/each}
						</div>
					</Card>
				</div>

				<!-- Sidebar -->
				<div class="space-y-6">
					<!-- Details -->
					<Card variant="outlined" padding="md">
						<h2 class="mb-3 font-semibold">Details</h2>
						<dl class="space-y-3 text-sm">
							<div class="flex justify-between">
								<dt class="text-surface-500">Status</dt>
								<dd class="font-medium">{getServiceCallStatusLabel(serviceCall.status)}</dd>
							</div>
							<div class="flex justify-between">
								<dt class="text-surface-500">Urgency</dt>
								<dd class="font-medium">
									{SERVICE_CALL_URGENCY_LABELS[priorityToUrgency(serviceCall.priority)]}
								</dd>
							</div>
							<div class="flex justify-between">
								<dt class="text-surface-500">Submitted</dt>
								<dd class="font-medium">{formatDate(serviceCall.createdAt)}</dd>
							</div>
							<div class="flex justify-between">
								<dt class="text-surface-500">Last Updated</dt>
								<dd class="font-medium">{formatDate(serviceCall.updatedAt)}</dd>
							</div>
						</dl>
					</Card>

					<!-- Need Help -->
					<Card variant="outlined" padding="md" class="bg-primary-500/5">
						<div class="flex items-start gap-3">
							<AlertCircle class="h-5 w-5 shrink-0 text-primary-500" />
							<div>
								<p class="font-medium">Need to update this request?</p>
								<p class="mt-1 text-sm text-surface-500">
									Add a message above or contact our concierge team for assistance.
								</p>
							</div>
						</div>
					</Card>
				</div>
			</div>
			{/if}
		{/if}
	</div>

	<!-- Cancel Confirmation Modal -->
	{#if showCancelConfirm}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<Card variant="outlined" padding="lg" class="w-full max-w-md bg-surface-50 dark:bg-surface-900">
				<h2 class="mb-4 text-lg font-semibold">Cancel Service Call?</h2>
				<p class="mb-4 text-sm text-surface-600 dark:text-surface-400">
					Are you sure you want to cancel this service call? This action cannot be undone.
				</p>
				<div class="mb-4">
					<label for="cancel-reason" class="label mb-1 block text-sm">
						Reason (optional)
					</label>
					<textarea
						id="cancel-reason"
						bind:value={cancelReason}
						placeholder="Why are you cancelling this request?"
						class="textarea w-full"
						rows="3"
						disabled={isCancelling}
					></textarea>
				</div>
				<div class="flex justify-end gap-3">
					<button
						type="button"
						onclick={() => {
							showCancelConfirm = false;
							cancelReason = '';
						}}
						class="btn preset-tonal-surface"
						disabled={isCancelling}
					>
						Keep Request
					</button>
					<button
						type="button"
						onclick={cancelServiceCall}
						class="btn preset-filled-error-500"
						disabled={isCancelling}
					>
						{#if isCancelling}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Cancelling...
						{:else}
							Cancel Request
						{/if}
					</button>
				</div>
			</Card>
		</div>
	{/if}

	<!-- Image Preview Modal -->
	{#if previewAttachment}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
			role="dialog"
			aria-modal="true"
			aria-label="Image preview"
		>
			<button
				type="button"
				onclick={() => (previewAttachment = null)}
				class="absolute inset-0 cursor-default"
				aria-label="Close preview"
			></button>
			<div class="relative z-10 flex max-h-[90vh] max-w-[90vw] flex-col items-center">
				<img
					src={previewAttachment.fileUrl}
					alt={previewAttachment.fileName}
					class="max-h-[80vh] max-w-full rounded-lg object-contain"
				/>
				<div class="mt-4 flex items-center gap-3">
					<p class="text-sm text-white">{previewAttachment.fileName}</p>
					<a
						href={previewAttachment.fileUrl}
						download={previewAttachment.fileName}
						class="btn btn-sm preset-filled-surface-500"
						title="Download"
					>
						<Download class="mr-2 h-4 w-4" />
						Download
					</a>
					<button
						type="button"
						onclick={() => (previewAttachment = null)}
						class="btn btn-sm preset-tonal-surface"
					>
						<X class="mr-2 h-4 w-4" />
						Close
					</button>
				</div>
			</div>
		</div>
	{/if}
</PageContainer>
