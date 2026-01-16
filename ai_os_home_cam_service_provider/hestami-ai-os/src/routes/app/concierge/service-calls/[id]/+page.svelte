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
		Paperclip
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import { orpc } from '$lib/api';
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import {
		getServiceCallStatusLabel,
		getServiceCallStatusColor,
		getServiceCallStatusDotColor,
		priorityToUrgency,
		SERVICE_CALL_URGENCY_LABELS
	} from '$lib/utils/serviceCallTerminology';
	import type { ConciergeCaseStatus, ConciergeCasePriority } from '$lib/api/cam';

	interface ServiceCall {
		id: string;
		caseNumber: string;
		title: string;
		description: string;
		status: ConciergeCaseStatus;
		priority: ConciergeCasePriority;
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

	interface Props {
		data: {
			serviceCall: ServiceCall;
			property: Property;
			notes: Note[];
			statusHistory: StatusHistory[];
			attachments: Attachment[];
			quotes: Quote[];
		};
	}

	let { data }: Props = $props();

	let serviceCall = $derived(data.serviceCall);
	let property = $derived(data.property);
	let notes = $state<Note[]>([]);
	let statusHistory = $derived(data.statusHistory);
	let attachments = $derived(data.attachments);
	let quotes = $state<Quote[]>([]);
	let isLoading = $state(false);
	let isLoadingQuotes = $state(false);
	let isRespondingToQuote = $state<string | null>(null);
	let error = $state<string | null>(null);

	const caseId = $derived(serviceCall.id);

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

	// Synchronize notes and quotes to local state for reactive updates
	$effect(() => {
		if (data.notes) notes = [...data.notes];
		if (data.quotes) quotes = [...data.quotes];
	});



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
				noteType: 'GENERAL',
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
				</div>
			</div>

			<div class="grid gap-6 lg:grid-cols-3">
				<!-- Main Content -->
				<div class="space-y-6 lg:col-span-2">
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
												{formatFileSize(attachment.fileSize)} • {formatRelativeTime(attachment.createdAt)}
											</p>
										</div>
										<a
											href={attachment.fileUrl}
											target="_blank"
											rel="noopener noreferrer"
											class="btn btn-sm preset-tonal-primary"
											title="Download {attachment.fileName}"
										>
											<Download class="h-4 w-4" />
										</a>
									</div>
								{/each}
							</div>
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
								{#if quotes.some((q) => q.status === 'ACCEPTED')}
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
											class="rounded-lg border p-4 {quote.status === 'ACCEPTED'
												? 'border-green-500/50 bg-green-500/5'
												: quote.status === 'REJECTED'
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
													class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {quote.status === 'ACCEPTED'
														? 'bg-green-500/10 text-green-600 dark:text-green-400'
														: quote.status === 'REJECTED'
															? 'bg-surface-500/10 text-surface-500'
															: quote.status === 'EXPIRED'
																? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
																: 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}"
												>
													{quote.status === 'ACCEPTED'
														? 'Approved'
														: quote.status === 'REJECTED'
															? 'Declined'
															: quote.status === 'EXPIRED'
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
											{#if quote.validUntil && quote.status === 'PENDING'}
												<p class="mt-2 text-xs text-surface-500">
													Valid until {formatDate(quote.validUntil).split(',')[0]}
												</p>
											{/if}

											<!-- Actions -->
											{#if quote.status === 'PENDING'}
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
						{#if !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(serviceCall.status)}
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
	</div>
</PageContainer>
