<script lang="ts">
	import {
		FileText,
		Search,
		Upload,
		Filter,
		Calendar,
		Link2,
		History,
		Eye,
		Printer,
		ExternalLink,
		AlertCircle,
		Clock
	} from 'lucide-svelte';
	import { SplitView, ListPanel, DetailPanel, TabbedContent } from '$lib/components/cam';
	import { EmptyState } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';
	import {
		CAM_DOCUMENT_CATEGORIES,
		CAM_CATEGORY_LABELS,
		getCamCategory,
		type CamDocumentCategory
	} from '$lib/utils/documentCategories';
	import { documentApi, type Document as ApiDocument, type DocumentDetail as ApiDocumentDetail, type DocumentReference as ApiDocumentReference, type DocumentVersion as ApiDocumentVersion } from '$lib/api/cam';

	// Use API types with local aliases for compatibility
	type Document = ApiDocument;
	type DocumentDetail = ApiDocumentDetail;
	type DocumentReference = ApiDocumentReference;
	type DocumentVersion = ApiDocumentVersion;

	interface ActivityEvent {
		id: string;
		action: string;
		summary: string;
		performedBy?: string;
		actorType?: string;
		createdAt?: string;
		previousState?: unknown;
		newState?: unknown;
	}

	let documents = $state<Document[]>([]);
	let selectedDocument = $state<Document | null>(null);
	let documentDetail = $state<DocumentDetail | null>(null);
	let documentPresignedUrl = $state<string | null>(null);
	let documentReferences = $state<DocumentReference[]>([]);
	let documentVersions = $state<DocumentVersion[]>([]);
	let activityHistory = $state<ActivityEvent[]>([]);
	let referenceCount = $state(0);

	let isLoading = $state(true);
	let isLoadingDetail = $state(false);
	let searchQuery = $state('');
	let categoryFilter = $state<string>('');
	let statusFilter = $state<string>('');
	let referencedFilter = $state<string>('');

	const categoryOptions = [
		{ value: '', label: 'All Categories' },
		...CAM_DOCUMENT_CATEGORIES.map((cat) => ({
			value: cat,
			label: CAM_CATEGORY_LABELS[cat]
		}))
	];

	const statusOptions = [
		{ value: '', label: 'All Statuses' },
		{ value: 'DRAFT', label: 'Draft' },
		{ value: 'ACTIVE', label: 'Active' },
		{ value: 'SUPERSEDED', label: 'Superseded' },
		{ value: 'ARCHIVED', label: 'Archived' }
	];

	const referencedOptions = [
		{ value: '', label: 'All Documents' },
		{ value: 'referenced', label: 'Referenced' },
		{ value: 'unreferenced', label: 'Not Referenced' }
	];

	async function loadDocuments() {
		if (!$currentAssociation?.id) return;

		isLoading = true;
		try {
			const response = await documentApi.list({
				category: categoryFilter as any || undefined,
				status: statusFilter as any || undefined,
				search: searchQuery || undefined
			});
			if (response.ok) {
				documents = response.data.documents;
			}
		} catch (error) {
			console.error('Failed to load documents:', error);
		} finally {
			isLoading = false;
		}
	}

	async function loadDocumentDetail(docId: string) {
		isLoadingDetail = true;
		documentPresignedUrl = null;
		try {
			const [detailRes, refsRes, versionsRes, historyRes, urlRes] = await Promise.all([
				documentApi.get(docId),
				documentApi.getReferences(docId),
				documentApi.getVersions(docId),
				documentApi.getActivityHistory(docId),
				documentApi.getDownloadUrl(docId).catch(() => null)
			]);

			if (detailRes.ok && detailRes.data?.document) {
				documentDetail = detailRes.data.document;
			}

			if (refsRes.ok && refsRes.data) {
				documentReferences = refsRes.data.references;
				referenceCount = refsRes.data.referenceCount;
			}

			if (versionsRes.ok && versionsRes.data?.versions) {
				documentVersions = versionsRes.data.versions.map(v => ({
					id: v.id,
					version: v.version,
					status: v.status,
					fileName: '',
					fileSize: 0,
					uploadedBy: '',
					createdAt: v.createdAt
				}));
			}

			if (historyRes.ok && historyRes.data?.events) {
				activityHistory = historyRes.data.events.map(e => ({
					id: e.id,
					action: e.action,
					summary: e.summary,
					performedBy: e.performedById || '',
					actorType: e.performedByType || '',
					createdAt: e.performedAt,
					previousState: null,
					newState: null
				}));
			}

			if (urlRes && urlRes.ok && urlRes.data?.downloadUrl) {
				documentPresignedUrl = urlRes.data.downloadUrl;
			}
		} catch (error) {
			console.error('Failed to load document detail:', error);
		} finally {
			isLoadingDetail = false;
		}
	}

	function selectDocument(doc: Document) {
		selectedDocument = doc;
		loadDocumentDetail(doc.id);
	}

	function formatDate(dateString: string | null | undefined): string {
		if (!dateString) return '—';
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
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}

	function formatCategory(category: string): string {
		const camCat = getCamCategory(category as any);
		return CAM_CATEGORY_LABELS[camCat] || category.replace(/_/g, ' ');
	}

	function getStatusBadgeClass(status: string | undefined): string {
		if (!status) return 'bg-surface-500/10 text-surface-500';
		switch (status) {
			case 'ACTIVE':
				return 'bg-success-500/10 text-success-600';
			case 'DRAFT':
				return 'bg-warning-500/10 text-warning-600';
			case 'SUPERSEDED':
				return 'bg-surface-500/10 text-surface-500';
			case 'ARCHIVED':
				return 'bg-error-500/10 text-error-600';
			default:
				return 'bg-surface-500/10 text-surface-500';
		}
	}

	function isNotYetEffective(effectiveDate: string | null | undefined): boolean {
		if (!effectiveDate) return false;
		return new Date(effectiveDate) > new Date();
	}

	function getContextTypeLabel(contextType: string): string {
		const labels: Record<string, string> = {
			VIOLATION: 'Violation',
			ARC_REQUEST: 'ARC Request',
			WORK_ORDER: 'Work Order',
			ASSOCIATION: 'Association',
			UNIT: 'Unit',
			PROPERTY: 'Property'
		};
		return labels[contextType] || contextType;
	}

	function getContextLink(contextType: string, contextId: string): string {
		const paths: Record<string, string> = {
			VIOLATION: `/app/cam/violations/${contextId}`,
			ARC_REQUEST: `/app/cam/arc/${contextId}`,
			WORK_ORDER: `/app/cam/work-orders/${contextId}`,
			UNIT: `/app/cam/units/${contextId}`
		};
		return paths[contextType] || '#';
	}

	function canPreview(mimeType: string): boolean {
		return (
			mimeType === 'application/pdf' ||
			mimeType.startsWith('image/') ||
			mimeType.startsWith('text/')
		);
	}

	const filteredDocuments = $derived(() => {
		let filtered = documents;

		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter((d) => (d.title || '').toLowerCase().includes(query));
		}

		if (referencedFilter === 'referenced') {
			filtered = filtered.filter((d) => (d as any).referenceCount > 0);
		} else if (referencedFilter === 'unreferenced') {
			filtered = filtered.filter((d) => !(d as any).referenceCount || (d as any).referenceCount === 0);
		}

		return filtered;
	});

	$effect(() => {
		if ($currentAssociation?.id) {
			loadDocuments();
		}
	});

	$effect(() => {
		if (categoryFilter !== undefined || statusFilter !== undefined) {
			loadDocuments();
		}
	});
</script>

<svelte:head>
	<title>Documents & Records | CAM | Hestami AI</title>
</svelte:head>

<SplitView hasSelection={!!selectedDocument}>
	{#snippet listPanel()}
		<ListPanel loading={isLoading}>
			{#snippet header()}
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<h1 class="text-lg font-semibold">Documents & Records</h1>
						<a href="/app/cam/documents/upload" class="btn btn-sm preset-filled-primary-500">
							<Upload class="mr-1 h-4 w-4" />
							Upload
						</a>
					</div>

					<div class="relative">
						<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
						<input
							type="text"
							placeholder="Search documents..."
							bind:value={searchQuery}
							class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 py-2 pl-9 pr-3 text-sm placeholder:text-surface-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>

					<div class="grid grid-cols-2 gap-2">
						<select
							bind:value={categoryFilter}
							class="rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						>
							{#each categoryOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>

						<select
							bind:value={statusFilter}
							class="rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						>
							{#each statusOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</div>

					<select
						bind:value={referencedFilter}
						class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					>
						{#each referencedOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>
			{/snippet}

			{#snippet items()}
				{@const docs = filteredDocuments()}
				{#if docs.length === 0}
					<div class="p-6">
						<EmptyState
							title="No documents found"
							description={searchQuery || categoryFilter || statusFilter
								? 'Try adjusting your filters.'
								: 'No documents have been uploaded yet.'}
						/>
					</div>
				{:else}
					<div class="divide-y divide-surface-300-700">
						{#each docs as doc}
							<button
								type="button"
								onclick={() => selectDocument(doc)}
								class="w-full px-4 py-3 text-left transition-colors hover:bg-surface-200-800 {selectedDocument?.id === doc.id ? 'bg-primary-500/10' : ''}"
							>
								<div class="flex items-start gap-3">
									<FileText class="mt-0.5 h-5 w-5 flex-shrink-0 text-surface-400" />
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<p class="truncate font-medium">{doc.title}</p>
											<span class="shrink-0 rounded px-1.5 py-0.5 text-xs {getStatusBadgeClass(doc.status)}">
												{doc.status}
											</span>
										</div>
										<p class="mt-0.5 text-sm text-surface-500">
											{formatCategory(doc.category)} · v{doc.version} · {formatFileSize(doc.fileSize)}
										</p>
										<div class="mt-0.5 flex items-center gap-2 text-xs text-surface-400">
											<span>{formatDate(doc.createdAt)}</span>
											{#if (doc as any).effectiveDate}
												<span class="flex items-center gap-1">
													<Calendar class="h-3 w-3" />
													{formatDate((doc as any).effectiveDate)}
													{#if isNotYetEffective((doc as any).effectiveDate)}
														<span class="text-warning-500">(not yet effective)</span>
													{/if}
												</span>
											{/if}
										</div>
									</div>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			{/snippet}
		</ListPanel>
	{/snippet}

	{#snippet detailPanel()}
		{#if selectedDocument}
			<DetailPanel>
				{#snippet header()}
					{@const d = selectedDocument!}
					<div>
						<div class="flex items-center gap-2">
							<p class="text-sm text-surface-500">{formatCategory(d.category)}</p>
							<span class="rounded px-1.5 py-0.5 text-xs {getStatusBadgeClass(d.status)}">
								{d.status}
							</span>
							{#if isNotYetEffective((d as any).effectiveDate)}
								<span class="flex items-center gap-1 rounded bg-warning-500/10 px-1.5 py-0.5 text-xs text-warning-600">
									<Clock class="h-3 w-3" />
									Not Yet Effective
								</span>
							{/if}
						</div>
						<h2 class="mt-1 text-xl font-semibold">{d.title}</h2>
						<p class="mt-0.5 text-sm text-surface-500">Version {d.version}</p>
					</div>
				{/snippet}

				{#snippet actions()}
					{@const d = selectedDocument!}
					<a href={documentPresignedUrl || ''} download class="btn btn-sm preset-filled-primary-500">
						Download
					</a>
					<a href="/app/cam/documents/{d.id}/new-version" class="btn btn-sm preset-tonal-surface">
						New Version
					</a>
				{/snippet}

				{#snippet content()}
					<TabbedContent
						tabs={[
							{ id: 'overview', label: 'Overview', content: overviewTab },
							{ id: 'content', label: 'Content', content: contentTab },
							{ id: 'references', label: `References (${referenceCount})`, content: referencesTab },
							{ id: 'history', label: 'History', content: historyTab }
						]}
					/>
				{/snippet}
			</DetailPanel>
		{/if}
	{/snippet}

	{#snippet emptyDetail()}
		<div class="text-center">
			<FileText class="mx-auto h-12 w-12 text-surface-300" />
			<p class="mt-2 text-surface-500">Select a document to view details</p>
		</div>
	{/snippet}
</SplitView>

{#snippet overviewTab()}
	{#if selectedDocument && documentDetail}
		<div class="space-y-6">
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<h3 class="text-sm font-medium text-surface-500">File Name</h3>
					<p class="mt-1">{documentDetail.fileName}</p>
				</div>
				<div>
					<h3 class="text-sm font-medium text-surface-500">Category</h3>
					<p class="mt-1">{formatCategory(documentDetail.category)}</p>
				</div>
				<div>
					<h3 class="text-sm font-medium text-surface-500">Visibility</h3>
					<p class="mt-1">{documentDetail.visibility.replace(/_/g, ' ')}</p>
				</div>
				<div>
					<h3 class="text-sm font-medium text-surface-500">File Size</h3>
					<p class="mt-1">{formatFileSize(documentDetail.fileSize)}</p>
				</div>
				<div>
					<h3 class="text-sm font-medium text-surface-500">Effective Date</h3>
					<p class="mt-1 flex items-center gap-2">
						{formatDate(documentDetail.effectiveDate)}
						{#if isNotYetEffective(documentDetail.effectiveDate)}
							<span class="text-warning-500 text-sm">(not yet effective)</span>
						{/if}
					</p>
				</div>
				<div>
					<h3 class="text-sm font-medium text-surface-500">Uploaded</h3>
					<p class="mt-1">{formatDate(documentDetail.createdAt)}</p>
				</div>
			</div>

			{#if documentDetail.description}
				<div>
					<h3 class="text-sm font-medium text-surface-500">Description</h3>
					<p class="mt-1 text-surface-700 dark:text-surface-300">{documentDetail.description}</p>
				</div>
			{/if}

			{#if documentDetail.tags && documentDetail.tags.length > 0}
				<div>
					<h3 class="text-sm font-medium text-surface-500">Tags</h3>
					<div class="mt-2 flex flex-wrap gap-2">
						{#each documentDetail.tags as tag}
							<span class="rounded-full bg-surface-200-800 px-2.5 py-0.5 text-sm">{tag}</span>
						{/each}
					</div>
				</div>
			{/if}

			{#if documentVersions.length > 1}
				<div>
					<h3 class="mb-3 text-sm font-medium text-surface-500">Version History</h3>
					<div class="space-y-2">
						{#each documentVersions as version}
							<div class="flex items-center justify-between rounded-lg border border-surface-300-700 p-3 {version.id === selectedDocument.id ? 'bg-primary-500/5 border-primary-500' : ''}">
								<div class="flex items-center gap-3">
									<span class="font-medium">v{version.version}</span>
									<span class="rounded px-1.5 py-0.5 text-xs {getStatusBadgeClass(version.status)}">
										{version.status}
									</span>
									{#if version.id === selectedDocument.id}
										<span class="text-xs text-primary-500">(current)</span>
									{/if}
								</div>
								<div class="text-sm text-surface-500">
									{formatDate(version.createdAt)}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{:else if isLoadingDetail}
		<div class="flex items-center justify-center py-8">
			<div class="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
		</div>
	{/if}
{/snippet}

{#snippet contentTab()}
	{#if selectedDocument}
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<h3 class="font-medium">Document Preview</h3>
				<div class="flex gap-2">
					<button
						type="button"
						onclick={() => documentPresignedUrl && window.open(documentPresignedUrl, '_blank')}
						class="btn btn-sm preset-tonal-surface"
					>
						<ExternalLink class="mr-1 h-4 w-4" />
						Open in New Tab
					</button>
					<button
						type="button"
						onclick={() => window.print()}
						class="btn btn-sm preset-tonal-surface"
					>
						<Printer class="mr-1 h-4 w-4" />
						Print
					</button>
				</div>
			</div>

			{#if canPreview(selectedDocument.mimeType)}
				{#if selectedDocument.mimeType.startsWith('image/')}
					<div class="rounded-lg border border-surface-300-700 bg-surface-200-800 p-4">
						<img
								src={documentPresignedUrl || ''}
								alt={selectedDocument.title}
								class="mx-auto max-h-[500px] rounded"
							/>
					</div>
				{:else if selectedDocument.mimeType === 'application/pdf'}
					<div class="rounded-lg border border-surface-300-700 bg-surface-200-800">
						<iframe
								src={documentPresignedUrl || ''}
								title={selectedDocument.title}
								class="h-[600px] w-full rounded-lg"
							></iframe>
					</div>
				{:else}
					<div class="flex h-64 items-center justify-center rounded-lg border border-surface-300-700 bg-surface-200-800">
						<div class="text-center">
							<Eye class="mx-auto h-8 w-8 text-surface-400" />
							<p class="mt-2 text-surface-500">Preview not available for this file type</p>
							<a href={documentPresignedUrl || ''} download class="btn btn-sm preset-filled-primary-500 mt-3">
								Download to View
							</a>
						</div>
					</div>
				{/if}
			{:else}
				<div class="flex h-64 items-center justify-center rounded-lg border border-surface-300-700 bg-surface-200-800">
					<div class="text-center">
						<FileText class="mx-auto h-8 w-8 text-surface-400" />
						<p class="mt-2 text-surface-500">Preview not available for {selectedDocument.mimeType}</p>
						<a href={documentPresignedUrl || ''} download class="btn btn-sm preset-filled-primary-500 mt-3">
							Download to View
						</a>
					</div>
				</div>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet referencesTab()}
	{#if documentReferences.length === 0}
		<EmptyState
			title="No references"
			description="This document has not been linked to any violations, ARC requests, or work orders yet."
		/>
	{:else}
		<div class="space-y-4">
			<p class="text-sm text-surface-500">
				This document is referenced in {referenceCount} {referenceCount === 1 ? 'place' : 'places'}.
			</p>

			<div class="space-y-2">
				{#each documentReferences as ref}
					<a
						href={getContextLink(ref.contextType, ref.contextId)}
						class="flex items-center justify-between rounded-lg border border-surface-300-700 p-3 transition-colors hover:bg-surface-200-800"
					>
						<div class="flex items-center gap-3">
							<Link2 class="h-4 w-4 text-surface-400" />
							<div>
								<p class="font-medium">{getContextTypeLabel(ref.contextType)}</p>
								<p class="text-sm text-surface-500">ID: {ref.contextId}</p>
								{#if ref.bindingNotes}
									<p class="mt-1 text-sm text-surface-400">{ref.bindingNotes}</p>
								{/if}
							</div>
						</div>
						<div class="text-sm text-surface-500">
							{formatDate(ref.createdAt)}
						</div>
					</a>
				{/each}
			</div>
		</div>
	{/if}
{/snippet}

{#snippet historyTab()}
	{#if activityHistory.length === 0}
		<EmptyState
			title="No history"
			description="Activity history will appear here as the document is modified."
		/>
	{:else}
		<div class="space-y-4">
			<p class="text-sm text-surface-500">
				Showing {activityHistory.length} activity {activityHistory.length === 1 ? 'event' : 'events'}.
			</p>

			<div class="space-y-3">
				{#each activityHistory as event}
					<div class="rounded-lg border border-surface-300-700 p-3">
						<div class="flex items-start justify-between">
							<div class="flex items-start gap-3">
								<History class="mt-0.5 h-4 w-4 text-surface-400" />
								<div>
									<p class="font-medium">{event.summary}</p>
									<div class="mt-1 flex items-center gap-2 text-sm text-surface-500">
										<span class="rounded bg-surface-200-800 px-1.5 py-0.5 text-xs">
											{event.action}
										</span>
										<span>by {event.performedBy || 'System'}</span>
									</div>
								</div>
							</div>
							<div class="text-sm text-surface-500">
								{event.createdAt ? formatDateTime(event.createdAt) : '—'}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
{/snippet}
