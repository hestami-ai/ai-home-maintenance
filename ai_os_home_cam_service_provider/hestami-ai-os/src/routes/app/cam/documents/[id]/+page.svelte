<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft, FileText, Clock, Download, Eye, Edit, Loader2 } from 'lucide-svelte';
	import { TabbedContent } from '$lib/components/cam';
	import { Card, EmptyState, Alert } from '$lib/components/ui';
	import { documentApi, activityEventApi, type Document } from '$lib/api/cam';
	import DocumentStatusBadge from '$lib/components/cam/documents/DocumentStatusBadge.svelte';
	import { onDestroy } from 'svelte';

	interface DocumentHistoryEvent {
		id: string;
		action: string;
		description: string;
		performedBy: string;
		createdAt: string;
	}

	let documentData = $state<Document | null>(null);
	let history = $state<DocumentHistoryEvent[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	const documentId = $derived(($page.params as Record<string, string>).id);

	// Polling state
	let pollIntervalId: ReturnType<typeof setInterval> | null = null;
	const POLL_INTERVAL_MS = 2000;
	const PROCESSING_STATUSES = ['PENDING_UPLOAD', 'PROCESSING'];

	// Check if document is in a processing state
	const isProcessing = $derived(documentData ? PROCESSING_STATUSES.includes(documentData.status) : false);

	// Start/stop polling based on processing status
	$effect(() => {
		if (isProcessing && documentId) {
			startPolling();
		} else {
			stopPolling();
		}
	});

	function startPolling() {
		if (pollIntervalId) return;

		pollIntervalId = setInterval(async () => {
			if (!documentId) return;
			try {
				const response = await documentApi.get(documentId);
				if (response.ok) {
					documentData = response.data.document;
					if (!PROCESSING_STATUSES.includes(response.data.document.status)) {
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

	onDestroy(() => {
		stopPolling();
	});

	async function loadDocument() {
		if (!documentId) return;

		isLoading = true;
		error = null;

		try {
			const response = await documentApi.get(documentId);
			if (!response.ok) {
				error = 'Document not found';
				return;
			}
			documentData = response.data.document;
		} catch (e) {
			error = 'Failed to load document';
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	async function loadHistory() {
		if (!documentId) return;
		try {
			const response = await activityEventApi.getByEntity({ entityType: 'DOCUMENT', entityId: documentId });
			if (response.ok) {
				history = response.data.events.map((e: any) => ({
					id: e.id,
					action: e.action,
					description: e.summary,
					performedBy: e.performedBy,
					createdAt: e.createdAt
				}));
			}
		} catch (e) {
			console.error('Failed to load history:', e);
		}
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatDateTime(dateString: string | undefined): string {
		if (!dateString) return '—';
		return new Date(dateString).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function formatFileSize(bytes: number | undefined): string {
		if (bytes === undefined) return '—';
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function getVisibilityLabel(visibility: string | undefined): string {
		if (!visibility) return '—';
		switch (visibility) {
			case 'OWNER_ONLY': return 'Owner Only';
			case 'BOARD_ONLY': return 'Board Only';
			case 'MEMBERS': return 'All Members';
			case 'PUBLIC': return 'Public';
			default: return visibility;
		}
	}

	function isPreviewable(mimeType: string | undefined): boolean {
		if (!mimeType) return false;
		return mimeType.startsWith('image/') || mimeType === 'application/pdf';
	}

	$effect(() => {
		if (documentId) {
			loadDocument();
			loadHistory();
		}
	});
</script>

<svelte:head>
	<title>{documentData?.title || 'Document'} | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto('/app/cam/documents')}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>

			{#if isLoading}
				<div class="h-6 w-48 animate-pulse rounded bg-surface-200-800"></div>
			{:else if documentData}
				<div class="flex-1">
					<div class="flex items-center gap-2">
						<p class="text-sm text-surface-500">{documentData.category.replace(/_/g, ' ')}</p>
						<DocumentStatusBadge
							status={documentData.status}
							processingAttemptCount={(documentData as any).processingAttemptCount}
							processingErrorType={(documentData as any).processingErrorType}
							size="sm"
						/>
					</div>
					<h1 class="mt-0.5 text-xl font-semibold">{documentData.title}</h1>
				</div>

				<div class="flex gap-2">
					{#if documentData.status === 'ACTIVE'}
						<a href="/api/document/{documentData.id}/download" class="btn btn-sm preset-filled-primary-500">
							<Download class="mr-1 h-4 w-4" />
							Download
						</a>
					{:else}
						<button
							type="button"
							class="btn btn-sm preset-filled-primary-500"
							disabled
							title="Document is still processing"
						>
							<Download class="mr-1 h-4 w-4" />
							Download
						</button>
					{/if}
					<a href="/app/cam/documents/{documentData.id}/edit" class="btn btn-sm preset-tonal-surface">
						<Edit class="mr-1 h-4 w-4" />
						Edit
					</a>
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
		{:else if documentData}
			<!-- Processing Alert -->
			{#if isProcessing}
				<Alert variant="info" title="Processing Document" class="mb-6">
					<div class="flex items-center gap-2">
						<Loader2 class="h-4 w-4 animate-spin" />
						<span>Your document is being scanned and processed. This page will update automatically.</span>
					</div>
				</Alert>
			{/if}

			<!-- Security Alert -->
			{#if documentData.status === 'INFECTED'}
				<Alert variant="error" title="Security Risk Detected" class="mb-6">
					This file has been flagged as a security risk and cannot be used.
				</Alert>
			{/if}

			<!-- Processing Error Alert -->
			{#if documentData.status === 'PROCESSING_FAILED' && (documentData as any).processingErrorMessage}
				<Alert variant="error" title="Processing Issue" class="mb-6">
					<p>{(documentData as any).processingErrorMessage}</p>
					{#if (documentData as any).processingNextRetryAt}
						<p class="mt-2 text-sm">
							Next retry scheduled for: {new Date((documentData as any).processingNextRetryAt).toLocaleString()}
						</p>
					{/if}
				</Alert>
			{/if}

			<TabbedContent
				tabs={[
					{ id: 'overview', label: 'Overview', content: overviewTab },
					{ id: 'preview', label: 'Preview', content: previewTab },
					{ id: 'history', label: 'History', content: historyTab }
				]}
			/>
		{/if}
	</div>
</div>

{#snippet overviewTab()}
	{#if documentData}
		<div class="space-y-6">
			<Card variant="outlined" padding="lg">
				<h3 class="mb-4 font-semibold">Document Information</h3>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<div>
						<h4 class="text-sm font-medium text-surface-500">File Name</h4>
						<p class="mt-1">{documentData.fileName}</p>
					</div>
					<div>
						<h4 class="text-sm font-medium text-surface-500">Category</h4>
						<p class="mt-1">{documentData.category.replace(/_/g, ' ')}</p>
					</div>
					<div>
						<h4 class="text-sm font-medium text-surface-500">Visibility</h4>
						<p class="mt-1">{getVisibilityLabel(documentData.visibility)}</p>
					</div>
					<div>
						<h4 class="text-sm font-medium text-surface-500">File Type</h4>
						<p class="mt-1">{documentData.mimeType}</p>
					</div>
					<div>
						<h4 class="text-sm font-medium text-surface-500">File Size</h4>
						<p class="mt-1">{formatFileSize(documentData.fileSize)}</p>
					</div>
					<div>
						<h4 class="text-sm font-medium text-surface-500">Uploaded By</h4>
						<p class="mt-1">{(documentData as any).uploadedBy || 'Unknown'}</p>
					</div>
				</div>
			</Card>

			{#if (documentData as any).contextType && (documentData as any).contextName}
				<Card variant="outlined" padding="lg">
					<h3 class="mb-4 font-semibold">Linked Context</h3>
					<div class="grid gap-4 sm:grid-cols-2">
						<div>
							<h4 class="text-sm font-medium text-surface-500">Context Type</h4>
							<p class="mt-1">{(documentData as any).contextType?.replace(/_/g, ' ')}</p>
						</div>
						<div>
							<h4 class="text-sm font-medium text-surface-500">Linked To</h4>
							<p class="mt-1">{(documentData as any).contextName}</p>
						</div>
					</div>
				</Card>
			{/if}

			<Card variant="outlined" padding="lg">
				<h3 class="mb-4 font-semibold">Timestamps</h3>
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<h4 class="text-sm font-medium text-surface-500">Uploaded</h4>
						<p class="mt-1">{formatDateTime(documentData.createdAt)}</p>
					</div>
					<div>
						<h4 class="text-sm font-medium text-surface-500">Last Modified</h4>
						<p class="mt-1">{formatDateTime((documentData as any).updatedAt)}</p>
					</div>
				</div>
			</Card>
		</div>
	{/if}
{/snippet}

{#snippet previewTab()}
	<Card variant="outlined" padding="lg">
		<h3 class="mb-4 font-semibold">Document Preview</h3>

		{#if documentData && documentData.status === 'ACTIVE' && documentData.mimeType && isPreviewable(documentData.mimeType)}
			{#if documentData.mimeType.startsWith('image/')}
				<div class="flex justify-center">
					<img
						src="/api/document/{documentData.id}/preview"
						alt={documentData.title}
						class="max-h-[600px] max-w-full rounded-lg"
					/>
				</div>
			{:else if documentData.mimeType === 'application/pdf'}
				<div class="aspect-[8.5/11] w-full">
					<iframe
						src="/api/document/{documentData.id}/preview"
						title={documentData.title}
						class="h-full w-full rounded-lg border border-surface-300-700"
					></iframe>
				</div>
			{/if}
		{:else if isProcessing}
			<div class="flex flex-col items-center justify-center py-12 text-surface-500">
				<Loader2 class="h-12 w-12 animate-spin mb-4" />
				<p>Preview will be available after processing completes</p>
			</div>
		{:else if documentData?.status === 'INFECTED'}
			<div class="flex flex-col items-center justify-center py-12">
				<Eye class="h-12 w-12 text-error-300" />
				<p class="mt-4 text-error-500">Preview not available - file flagged as security risk</p>
			</div>
		{:else}
			<div class="flex flex-col items-center justify-center py-12">
				<Eye class="h-12 w-12 text-surface-300" />
				<p class="mt-4 text-surface-500">Preview not available for this file type</p>
				{#if documentData?.status === 'ACTIVE'}
					<a href="/api/document/{documentId}/download" class="btn preset-filled-primary-500 mt-4">
						<Download class="mr-1 h-4 w-4" />
						Download to View
					</a>
				{/if}
			</div>
		{/if}
	</Card>
{/snippet}

{#snippet historyTab()}
	<Card variant="outlined" padding="lg">
		<h3 class="mb-4 font-semibold">Version History</h3>

		{#if history.length === 0}
			<EmptyState
				title="No history"
				description="Version changes and access logs will appear here."
			/>
		{:else}
			<div class="space-y-4">
				{#each history as event}
					<div class="flex gap-3">
						<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface-200-800">
							<Clock class="h-4 w-4 text-surface-500" />
						</div>
						<div class="flex-1">
							<p class="font-medium">{event.action}</p>
							<p class="text-sm text-surface-500">{event.description}</p>
							<p class="mt-1 text-xs text-surface-400">
								{event.performedBy} · {formatDateTime(event.createdAt)}
							</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</Card>
{/snippet}
