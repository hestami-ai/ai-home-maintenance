<script lang="ts">
	import {
		ArrowLeft,
		Download,
		Trash2,
		FileText,
		Image,
		File,
		Loader2,
		Home,
		Calendar,
		Tag
	} from 'lucide-svelte';
	import { PageContainer, Card, Alert } from '$lib/components/ui';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { createOrgClient } from '$lib/api/orpc';
	import { DocumentContextTypeValues, DocumentStatusValues } from '$lib/api/cam';
	import DocumentStatusBadge from '$lib/components/cam/documents/DocumentStatusBadge.svelte';
	import { onDestroy } from 'svelte';

	interface Document {
		id: string;
		title: string;
		description: string | null;
		category: string;
		visibility: string;
		status: string;
		storageProvider: string;
		storagePath: string;
		fileUrl: string;
		fileName: string;
		fileSize: number;
		mimeType: string;
		checksum: string | null;
		pageCount: number | null;
		thumbnailUrl: string | null;
		version: number;
		effectiveDate: string | null;
		expirationDate: string | null;
		tags: string[];
		archivedAt: string | null;
		processingStartedAt: string | null;
		processingCompletedAt: string | null;
		processingAttemptCount: number;
		processingNextRetryAt: string | null;
		processingErrorType: string | null;
		processingErrorMessage: string | null;
		processingErrorDetails: any | null;
		createdAt: string;
		updatedAt: string;
	}

	interface ContextBinding {
		contextType: string;
		contextId: string;
		isPrimary: boolean;
	}

	interface Props {
		data: {
			document: Document;
			contextBindings: ContextBinding[];
			organization: { id: string; name: string; slug: string };
		};
	}

	let { data }: Props = $props();

	// Use $state + $effect to sync data - track data reference but guard against undefined
	let orgId = $state<string | null>(null);
	let documentFromData = $state<Document | null>(null);
	let contextBindings = $state<ContextBinding[]>([]);
	let isLoading = $state(false);
	let isDeleting = $state(false);
	let error = $state<string | null>(null);
	let showDeleteConfirm = $state(false);

	// Local document state that can be updated by polling
	// Use a separate override state to avoid the state_referenced_locally warning
	let documentOverride = $state<Document | null>(null);
	const documentData = $derived(documentOverride ?? documentFromData);

	// Create org client for API calls
	const orgClient = $derived(orgId ? createOrgClient(orgId) : null);

	// Sync state from data and reset override when navigating to a different document
	$effect(() => {
		// Track data to trigger re-runs on navigation, but guard against undefined
		if (data == null || typeof data !== 'object') return;
		orgId = data.organization?.id ?? null;
		documentFromData = data.document ?? null;
		contextBindings = data.contextBindings ?? [];
		// Reset override when document changes (navigation)
		documentOverride = null;
	});

	// Polling state
	let pollIntervalId: ReturnType<typeof setInterval> | null = null;
	const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds
	const PROCESSING_STATUSES = [DocumentStatusValues.PENDING_UPLOAD, DocumentStatusValues.PROCESSING];

	// Check if document is in a processing state that requires polling
	const isProcessing = $derived((PROCESSING_STATUSES as string[]).includes(documentData.status));

	// Start/stop polling based on processing status
	$effect(() => {
		if (isProcessing) {
			startPolling();
		} else {
			stopPolling();
		}
	});

	function startPolling() {
		if (pollIntervalId) return; // Already polling

		pollIntervalId = setInterval(async () => {
			try {
				if (!orgClient) return;
				const result = await orgClient.document.getDocument({ id: documentData.id });
				if (result.ok) {
					const newDoc = result.data.document as Document;
					documentOverride = newDoc;

					// Stop polling if no longer processing
					if (!(PROCESSING_STATUSES as string[]).includes(newDoc.status)) {
						stopPolling();
					}
				}
			} catch (err) {
				console.error('Polling error:', err);
			}
		}, POLL_INTERVAL_MS);
	}

	function stopPolling() {
		if (pollIntervalId) {
			clearInterval(pollIntervalId);
			pollIntervalId = null;
		}
	}

	// Cleanup on component destroy
	onDestroy(() => {
		stopPolling();
	});

	// Check for feedback messages in URL
	const showSuccessAlert = $derived(page.url.searchParams.get('success') === 'true');
	const showErrorAlert = $derived(page.url.searchParams.get('error') === 'true');
	const showInfectedAlert = $derived(page.url.searchParams.get('infected') === 'true');

	const categoryLabels: Record<string, string> = {
		PROPERTY_DEED: 'Property Deed',
		INSURANCE: 'Insurance Policy',
		WARRANTY: 'Warranty',
		INSPECTION: 'Inspection Report',
		RECEIPT: 'Receipt',
		CONTRACT: 'Contract',
		PHOTO: 'Photo',
		OTHER: 'Other'
	};



	async function handleDelete() {
		if (isDeleting || !documentData) return;

		isDeleting = true;
		error = null;

		try {
			if (!orgClient) {
				error = 'Client not available';
				isDeleting = false;
				return;
			}
			const result = await orgClient.document.archiveDocument({
				idempotencyKey: crypto.randomUUID(),
				id: documentData.id,
				reason: 'User requested deletion'
			});

			if (result.ok) {
				goto('/app/concierge/documents');
			} else {
				error = 'Failed to delete document';
				isDeleting = false;
			}
		} catch (err) {
			console.error('Delete error:', err);
			error = err instanceof Error ? err.message : 'Failed to delete document';
			isDeleting = false;
		}
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function getFileIcon(mimeType: string) {
		if (mimeType.startsWith('image/')) return Image;
		if (mimeType.includes('pdf')) return FileText;
		return File;
	}

	const propertyBinding = $derived(contextBindings.find((b) => b.contextType === DocumentContextTypeValues.PROPERTY));
</script>

<svelte:head>
	<title>{documentData?.title || 'Document'} | Hestami AI</title>
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
						<a href="/app/concierge/documents" class="btn preset-tonal-surface">
							<ArrowLeft class="mr-2 h-4 w-4" />
							Back to Documents
						</a>
						<button onclick={() => invalidateAll()} class="btn preset-tonal-primary">Try Again</button>
					</div>
				</div>
			</Card>
		{:else if documentData}
			<!-- Header -->
			<div class="mb-6">
				<a
					href="/app/concierge/documents"
					class="mb-4 inline-flex items-center text-sm text-surface-500 hover:text-surface-700"
				>
					<ArrowLeft class="mr-1 h-4 w-4" />
					Back to Documents
				</a>

				<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div class="flex items-start gap-4">
						<div
							class="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-500/10"
						>
							{#if documentData.mimeType.startsWith('image/')}
								<Image class="h-7 w-7 text-primary-500" />
							{:else if documentData.mimeType.includes('pdf')}
								<FileText class="h-7 w-7 text-primary-500" />
							{:else}
								<File class="h-7 w-7 text-primary-500" />
							{/if}
						</div>
						<div>
							<div class="flex items-center gap-3">
								<h1 class="text-2xl font-bold">{documentData.title}</h1>
								<DocumentStatusBadge
									status={documentData.status}
									processingAttemptCount={documentData.processingAttemptCount}
									processingErrorType={documentData.processingErrorType}
									size="md"
								/>
							</div>
							<p class="mt-1 text-surface-500">
								{documentData.fileName} • {formatFileSize(documentData.fileSize)}
							</p>
						</div>
					</div>

					<div class="flex gap-2">
						{#if documentData.status === DocumentStatusValues.ACTIVE}
							<a
								href={(documentData as any).presignedFileUrl || ''}
								target="_blank"
								rel="noopener noreferrer"
								class="btn preset-filled-primary-500"
							>
								<Download class="mr-2 h-4 w-4" />
								Download
							</a>
						{:else}
							<button
								type="button"
								class="btn preset-filled-primary-500"
								disabled
								title="Document is still processing"
							>
								<Download class="mr-2 h-4 w-4" />
								Download
							</button>
						{/if}
						<button
							type="button"
							onclick={() => (showDeleteConfirm = true)}
							class="btn preset-tonal-error"
						>
							<Trash2 class="mr-2 h-4 w-4" />
							Delete
						</button>
					</div>
				</div>
			</div>

			<!-- Delete Confirmation -->
			{#if showDeleteConfirm}
				<Card variant="outlined" padding="md" class="mb-6 border-error-500/50 bg-error-500/5">
					<div class="flex items-center justify-between">
						<p class="font-medium text-error-600 dark:text-error-400">
							Are you sure you want to delete this document?
						</p>
						<div class="flex gap-2">
							<button
								type="button"
								onclick={() => (showDeleteConfirm = false)}
								class="btn preset-tonal-surface"
								disabled={isDeleting}
							>
								Cancel
							</button>
							<button
								type="button"
								onclick={handleDelete}
								class="btn preset-filled-error-500"
								disabled={isDeleting}
							>
								{#if isDeleting}
									<Loader2 class="mr-2 h-4 w-4 animate-spin" />
									Deleting...
								{:else}
									Delete
								{/if}
							</button>
						</div>
					</div>
				</Card>
			{/if}

			<div class="grid gap-6 lg:grid-cols-3">
				<!-- Main Content -->
				<div class="space-y-6 lg:col-span-2">
					<!-- Processing Alert -->
					{#if isProcessing}
						<Alert variant="info" title="Processing Document">
							<div class="flex items-center gap-2">
								<Loader2 class="h-4 w-4 animate-spin" />
								<span>Your document is being scanned and processed. This page will update automatically.</span>
							</div>
						</Alert>
					{/if}

					<!-- Feedback Alerts -->
					{#if showSuccessAlert && documentData.status === DocumentStatusValues.ACTIVE}
						<Alert variant="success" title="Upload Successful">
							Your document has been processed and is now ready for use.
						</Alert>
					{/if}

					{#if showInfectedAlert || (documentData.status === DocumentStatusValues.INFECTED)}
						<Alert variant="error" title="Security Risk Detected">
							This file has been flagged as a security risk and cannot be used.
						</Alert>
					{/if}

					<!-- Processing Error Info -->
					{#if documentData.status === DocumentStatusValues.PROCESSING_FAILED && documentData.processingErrorMessage}
						<Alert variant="error" title="Processing Issue">
							<p>{documentData.processingErrorMessage}</p>
							{#if documentData.processingNextRetryAt}
								<p class="mt-2 text-sm">
									Next retry scheduled for: {new Date(documentData.processingNextRetryAt).toLocaleString()}
								</p>
							{/if}
						</Alert>
					{/if}

					<!-- Preview -->
					{#if documentData.status === DocumentStatusValues.ACTIVE}
						{#if documentData.mimeType.startsWith('image/')}
							<Card variant="outlined" padding="md">
								<h2 class="mb-4 font-semibold">Preview</h2>
								<img
									src={(documentData as any).presignedThumbnailUrl || (documentData as any).presignedFileUrl || ''}
									alt={documentData.title}
									class="max-h-96 w-full rounded-lg object-contain"
								/>
							</Card>
						{:else if documentData.mimeType.includes('pdf')}
							<Card variant="outlined" padding="md">
								<h2 class="mb-4 font-semibold">Preview</h2>
								<div class="aspect-[8.5/11] w-full">
									<iframe
										src={(documentData as any).presignedFileUrl || ''}
										title={documentData.title}
										class="h-full w-full rounded-lg border border-surface-300-700"
									></iframe>
								</div>
							</Card>
						{/if}
					{:else if isProcessing}
						<Card variant="outlined" padding="md">
							<h2 class="mb-4 font-semibold">Preview</h2>
							<div class="flex flex-col items-center justify-center py-12 text-surface-500">
								<Loader2 class="h-8 w-8 animate-spin mb-3" />
								<p>Preview will be available after processing completes</p>
							</div>
						</Card>
					{/if}

					<!-- Description -->
					{#if documentData.description}
						<Card variant="outlined" padding="md">
							<h2 class="mb-3 font-semibold">Description</h2>
							<p class="text-surface-600 dark:text-surface-400">{documentData.description}</p>
						</Card>
					{/if}
				</div>

				<!-- Sidebar -->
				<div class="space-y-6">
					<!-- Details -->
					<Card variant="outlined" padding="md">
						<h2 class="mb-3 font-semibold">Details</h2>
						<dl class="space-y-3 text-sm">
							<div class="flex justify-between">
								<dt class="text-surface-500">Category</dt>
								<dd class="font-medium">
									{categoryLabels[documentData.category] || documentData.category}
								</dd>
							</div>
							<div class="flex justify-between">
								<dt class="text-surface-500">File Type</dt>
								<dd class="font-medium">{documentData.mimeType}</dd>
							</div>
							<div class="flex justify-between">
								<dt class="text-surface-500">Size</dt>
								<dd class="font-medium">{formatFileSize(documentData.fileSize)}</dd>
							</div>
							<div class="flex justify-between">
								<dt class="text-surface-500">Version</dt>
								<dd class="font-medium">{documentData.version}</dd>
							</div>
							<div class="flex justify-between">
								<dt class="text-surface-500">Uploaded</dt>
								<dd class="font-medium">{formatDate(documentData.createdAt)}</dd>
							</div>
							{#if documentData.effectiveDate}
								<div class="flex justify-between">
									<dt class="text-surface-500">Effective Date</dt>
									<dd class="font-medium">{formatDate(documentData.effectiveDate)}</dd>
								</div>
							{/if}
							{#if documentData.expirationDate}
								<div class="flex justify-between">
									<dt class="text-surface-500">Expires</dt>
									<dd class="font-medium">{formatDate(documentData.expirationDate)}</dd>
								</div>
							{/if}
						</dl>
					</Card>

					<!-- Property Link -->
					{#if propertyBinding}
						<Card variant="outlined" padding="md">
							<h2 class="mb-3 font-semibold">Property</h2>
							<a
								href="/app/concierge/properties/{propertyBinding.contextId}"
								class="flex items-center gap-3 rounded-lg p-2 -m-2 hover:bg-surface-500/5 transition-colors"
							>
								<div
									class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-500/10"
								>
									<Home class="h-5 w-5 text-primary-500" />
								</div>
								<span class="font-medium text-primary-500">View Property</span>
							</a>
						</Card>
					{/if}

					<!-- Tags -->
					{#if documentData.tags.length > 0}
						<Card variant="outlined" padding="md">
							<h2 class="mb-3 font-semibold">Tags</h2>
							<div class="flex flex-wrap gap-2">
								{#each documentData.tags as tag}
									<span
										class="inline-flex items-center gap-1 rounded-full bg-surface-500/10 px-2 py-1 text-xs"
									>
										<Tag class="h-3 w-3" />
										{tag}
									</span>
								{/each}
							</div>
						</Card>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</PageContainer>
