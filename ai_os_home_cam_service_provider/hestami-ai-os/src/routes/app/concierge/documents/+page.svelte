<script lang="ts">
	import {
		Upload,
		Search,
		FileText,
		File,
		Image,
		Loader2,
		Download,
		Trash2,
		Filter,
		X
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import { orpc } from '$lib/api';
	import { createOrgClient } from '$lib/api/orpc';
	import { invalidateAll } from '$app/navigation';
	import DocumentStatusBadge from '$lib/components/cam/documents/DocumentStatusBadge.svelte';

	interface Document {
		id: string;
		title: string;
		category: string;
		status: string;
		visibility: string;
		fileName: string;
		fileSize: number;
		mimeType: string;
		version: number;
		processingStartedAt: string | null;
		processingCompletedAt: string | null;
		processingAttemptCount: number;
		processingErrorType: string | null;
		createdAt: string;
		thumbnailUrl: string | null;
	}

	interface Props {
		data: {
			documents: Document[];
			organization: { id: string; name: string; slug: string };
		};
	}

	let { data }: Props = $props();

	let documents = $derived(data.documents);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let searchQuery = $state('');
	let selectedCategory = $state<string>('');
	let showUploadModal = $state(false);

	const categories = [
		{ value: '', label: 'All Categories' },
		{ value: 'PROPERTY_DEED', label: 'Property Deed' },
		{ value: 'INSURANCE', label: 'Insurance' },
		{ value: 'WARRANTY', label: 'Warranty' },
		{ value: 'INSPECTION', label: 'Inspection' },
		{ value: 'RECEIPT', label: 'Receipt' },
		{ value: 'CONTRACT', label: 'Contract' },
		{ value: 'PHOTO', label: 'Photo' },
		{ value: 'OTHER', label: 'Other' }
	];

	const categoryLabels: Record<string, string> = {
		PROPERTY_DEED: 'Property Deed',
		INSURANCE: 'Insurance',
		WARRANTY: 'Warranty',
		INSPECTION: 'Inspection',
		RECEIPT: 'Receipt',
		CONTRACT: 'Contract',
		PHOTO: 'Photo',
		OTHER: 'Other'
	};

	const filteredDocuments = $derived(
		documents.filter((d) => {
			const matchesSearch =
				!searchQuery ||
				d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
				d.fileName.toLowerCase().includes(searchQuery.toLowerCase());
			const matchesCategory = !selectedCategory || d.category === selectedCategory;
			return matchesSearch && matchesCategory;
		})
	);



	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function getFileIcon(mimeType: string) {
		if (mimeType.startsWith('image/')) return Image;
		if (mimeType.includes('pdf')) return FileText;
		return File;
	}

	async function handleDelete(docId: string) {
		if (!confirm('Are you sure you want to delete this failed document?')) return;
		
		isLoading = true;
		try {
			const client = createOrgClient(data.organization.id);
			await client.document.archiveDocument({ id: docId, reason: 'User deleted failed document' });
			await invalidateAll();
		} catch (err) {
			console.error('Failed to delete document:', err);
			error = 'Failed to delete document';
		} finally {
			isLoading = false;
		}
	}

</script>

<svelte:head>
	<title>Documents | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-8">
		<!-- Header -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold">Documents</h1>
				<p class="mt-1 text-surface-500">View and manage your property documents</p>
			</div>
			<a href="/app/concierge/documents/upload" class="btn preset-filled-primary-500">
				<Upload class="mr-2 h-4 w-4" />
				Upload Document
			</a>
		</div>

		<!-- Search and Filters -->
		<div class="mt-6 flex flex-col gap-4 sm:flex-row">
			<div class="relative flex-1">
				<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
				<input
					type="text"
					placeholder="Search documents..."
					bind:value={searchQuery}
					class="input w-full pl-10"
				/>
			</div>
			<select bind:value={selectedCategory} class="select w-full sm:w-48">
				{#each categories as cat}
					<option value={cat.value}>{cat.label}</option>
				{/each}
			</select>
		</div>

		<!-- Documents List -->
		<div class="mt-6">
			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-primary-500" />
				</div>
			{:else if error}
				<Card variant="outlined" padding="md">
					<div class="text-center text-error-500">
						<p>{error}</p>
						<button onclick={() => invalidateAll()} class="btn preset-tonal-primary mt-4">
							Try Again
						</button>
					</div>
				</Card>
			{:else if documents.length === 0}
				<Card variant="outlined" padding="none">
					<div class="p-6">
						<EmptyState
							title="No documents yet"
							description="Upload documents related to your properties, service requests, and more."
						>
							{#snippet actions()}
								<a href="/app/concierge/documents/upload" class="btn preset-filled-primary-500">
									<Upload class="mr-2 h-4 w-4" />
									Upload Your First Document
								</a>
							{/snippet}
						</EmptyState>
					</div>
				</Card>
			{:else if filteredDocuments.length === 0}
				<Card variant="outlined" padding="md">
					<p class="text-center text-surface-500">No documents match your search.</p>
				</Card>
			{:else}
				<div class="space-y-3">
					{#each filteredDocuments as doc (doc.id)}
						{@const FileIcon = getFileIcon(doc.mimeType)}
						<a
							href="/app/concierge/documents/{doc.id}"
							class="flex items-center gap-4 rounded-lg border border-surface-300-700 p-4 transition-all hover:border-primary-500 hover:bg-surface-500/5"
						>
							{#if doc.thumbnailUrl}
								<div class="h-12 w-12 shrink-0 overflow-hidden rounded-lg">
									<img
										src={doc.thumbnailUrl}
										alt={doc.title}
										class="h-full w-full object-cover"
									/>
								</div>
							{:else}
								<div
									class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-500/10"
								>
									<FileIcon class="h-6 w-6 text-surface-500" />
								</div>
							{/if}
							<div class="min-w-0 flex-1">
								<h3 class="font-medium">{doc.title}</h3>
								<div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-surface-500">
									<span>{doc.fileName}</span>
									<span>•</span>
									<span>{formatFileSize(doc.fileSize)}</span>
									<span>•</span>
									<span>{formatDate(doc.createdAt)}</span>
								</div>
							</div>
							<div class="flex shrink-0 items-center gap-4">
								<DocumentStatusBadge 
									status={doc.status} 
									processingAttemptCount={doc.processingAttemptCount}
									processingErrorType={doc.processingErrorType}
									size="sm"
								/>
								{#if doc.status === 'PROCESSING_FAILED'}
									<button
										type="button"
										onclick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											handleDelete(doc.id);
										}}
										class="btn-icon btn-icon-sm preset-tonal-error"
										title="Delete failed document"
									>
										<Trash2 class="h-4 w-4" />
									</button>
								{/if}
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</PageContainer>
