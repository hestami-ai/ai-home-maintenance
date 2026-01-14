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
	import DocumentStatusBadge from '$lib/components/cam/documents/DocumentStatusBadge.svelte';

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

	// Create org client for API calls
	const orgClient = $derived(createOrgClient(data.organization.id));

	let document = $derived(data.document);
	let contextBindings = $derived(data.contextBindings);
	let isLoading = $state(false);
	let isDeleting = $state(false);
	let error = $state<string | null>(null);
	let showDeleteConfirm = $state(false);
	
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
		if (isDeleting || !document) return;

		isDeleting = true;
		error = null;

		try {
			const result = await orgClient.document.archiveDocument({
				idempotencyKey: crypto.randomUUID(),
				id: document.id,
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

	const propertyBinding = $derived(contextBindings.find((b) => b.contextType === 'PROPERTY'));
</script>

<svelte:head>
	<title>{document?.title || 'Document'} | Hestami AI</title>
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
		{:else if document}
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
							{#if document.mimeType.startsWith('image/')}
								<Image class="h-7 w-7 text-primary-500" />
							{:else if document.mimeType.includes('pdf')}
								<FileText class="h-7 w-7 text-primary-500" />
							{:else}
								<File class="h-7 w-7 text-primary-500" />
							{/if}
						</div>
						<div>
							<div class="flex items-center gap-3">
								<h1 class="text-2xl font-bold">{document.title}</h1>
								<DocumentStatusBadge 
									status={document.status} 
									processingAttemptCount={document.processingAttemptCount}
									processingErrorType={document.processingErrorType}
									size="md"
								/>
							</div>
							<p class="mt-1 text-surface-500">
								{document.fileName} • {formatFileSize(document.fileSize)}
							</p>
						</div>
					</div>

					<div class="flex gap-2">
						<a
							href={(document as any).presignedFileUrl || ''}
							target="_blank"
							rel="noopener noreferrer"
							class="btn preset-filled-primary-500"
						>
							<Download class="mr-2 h-4 w-4" />
							Download
						</a>
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
					<!-- Feedback Alerts -->
					{#if showSuccessAlert}
						<Alert variant="success" title="Upload Successful">
							Your document has been processed and is now ready for use.
						</Alert>
					{/if}

					{#if showInfectedAlert || (document.status === 'INFECTED')}
						<Alert variant="error" title="Security Risk Detected">
							This file has been flagged as a security risk and cannot be used.
						</Alert>
					{/if}

					<!-- Processing Error Info -->
					{#if document.status === 'PROCESSING_FAILED' && document.processingErrorMessage}
						<Alert variant="error" title="Processing Issue">
							<p>{document.processingErrorMessage}</p>
							{#if document.processingNextRetryAt}
								<p class="mt-2 text-sm">
									Next retry scheduled for: {new Date(document.processingNextRetryAt).toLocaleString()}
								</p>
							{/if}
						</Alert>
					{/if}

					<!-- Preview -->
					{#if document.mimeType.startsWith('image/')}
						<Card variant="outlined" padding="md">
							<h2 class="mb-4 font-semibold">Preview</h2>
							<img
								src={(document as any).presignedThumbnailUrl || (document as any).presignedFileUrl || ''}
								alt={document.title}
								class="max-h-96 w-full rounded-lg object-contain"
							/>
						</Card>
					{:else if document.mimeType.includes('pdf')}
						<Card variant="outlined" padding="md">
							<h2 class="mb-4 font-semibold">Preview</h2>
							<div class="aspect-[8.5/11] w-full">
								<iframe
									src={(document as any).presignedFileUrl || ''}
									title={document.title}
									class="h-full w-full rounded-lg border border-surface-300-700"
								></iframe>
							</div>
						</Card>
					{/if}

					<!-- Description -->
					{#if document.description}
						<Card variant="outlined" padding="md">
							<h2 class="mb-3 font-semibold">Description</h2>
							<p class="text-surface-600 dark:text-surface-400">{document.description}</p>
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
									{categoryLabels[document.category] || document.category}
								</dd>
							</div>
							<div class="flex justify-between">
								<dt class="text-surface-500">File Type</dt>
								<dd class="font-medium">{document.mimeType}</dd>
							</div>
							<div class="flex justify-between">
								<dt class="text-surface-500">Size</dt>
								<dd class="font-medium">{formatFileSize(document.fileSize)}</dd>
							</div>
							<div class="flex justify-between">
								<dt class="text-surface-500">Version</dt>
								<dd class="font-medium">{document.version}</dd>
							</div>
							<div class="flex justify-between">
								<dt class="text-surface-500">Uploaded</dt>
								<dd class="font-medium">{formatDate(document.createdAt)}</dd>
							</div>
							{#if document.effectiveDate}
								<div class="flex justify-between">
									<dt class="text-surface-500">Effective Date</dt>
									<dd class="font-medium">{formatDate(document.effectiveDate)}</dd>
								</div>
							{/if}
							{#if document.expirationDate}
								<div class="flex justify-between">
									<dt class="text-surface-500">Expires</dt>
									<dd class="font-medium">{formatDate(document.expirationDate)}</dd>
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
					{#if document.tags.length > 0}
						<Card variant="outlined" padding="md">
							<h2 class="mb-3 font-semibold">Tags</h2>
							<div class="flex flex-wrap gap-2">
								{#each document.tags as tag}
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
