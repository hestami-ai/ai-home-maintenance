<script lang="ts">
	import { X, Search, FileText, Check, Filter } from 'lucide-svelte';
	import { currentAssociation } from '$lib/stores';
	import {
		CAM_DOCUMENT_CATEGORIES,
		CAM_CATEGORY_LABELS,
		getCamCategory,
		type CamDocumentCategory
	} from '$lib/utils/documentCategories';
	import { documentApi } from '$lib/api/cam';

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
		createdAt: string;
	}

	interface SelectedDocument {
		documentId: string;
		version: number;
		title: string;
	}

	interface Props {
		open: boolean;
		multiSelect?: boolean;
		selectedDocuments?: SelectedDocument[];
		categoryFilter?: CamDocumentCategory;
		onClose: () => void;
		onSelect: (documents: SelectedDocument[]) => void;
	}

	let {
		open = $bindable(false),
		multiSelect = false,
		selectedDocuments = [],
		categoryFilter = undefined,
		onClose,
		onSelect
	}: Props = $props();

	let documents = $state<Document[]>([]);
	let isLoading = $state(false);
	let searchQuery = $state('');
	let statusFilter = $state<string>('ACTIVE');
	let localCategoryFilter = $state<string>('');
	let localSelected = $state<SelectedDocument[]>([]);

	const categoryOptions = [
		{ value: '', label: 'All Categories' },
		...CAM_DOCUMENT_CATEGORIES.map((cat) => ({
			value: cat,
			label: CAM_CATEGORY_LABELS[cat]
		}))
	];

	const statusOptions = [
		{ value: '', label: 'All Statuses' },
		{ value: 'ACTIVE', label: 'Active' },
		{ value: 'DRAFT', label: 'Draft' }
	];

	$effect(() => {
		if (open) {
			localCategoryFilter = categoryFilter || '';
			localSelected = [...selectedDocuments];
			loadDocuments();
		}
	});

	$effect(() => {
		if (open && (searchQuery !== undefined || localCategoryFilter !== undefined || statusFilter !== undefined)) {
			loadDocuments();
		}
	});

	async function loadDocuments() {
		if (!$currentAssociation?.id) return;

		isLoading = true;
		try {
			const response = await documentApi.list({
				category: localCategoryFilter as any || undefined,
				status: statusFilter as any || undefined,
				search: searchQuery || undefined
			});
			if (response.ok && response.data?.documents) {
				documents = response.data.documents;
			}
		} catch (error) {
			console.error('Failed to load documents:', error);
		} finally {
			isLoading = false;
		}
	}

	function isSelected(docId: string): boolean {
		return localSelected.some((d) => d.documentId === docId);
	}

	function toggleDocument(doc: Document) {
		const existing = localSelected.findIndex((d) => d.documentId === doc.id);

		if (existing >= 0) {
			localSelected = localSelected.filter((_, i) => i !== existing);
		} else {
			const newSelection: SelectedDocument = {
				documentId: doc.id,
				version: doc.version || 1,
				title: doc.title
			};

			if (multiSelect) {
				localSelected = [...localSelected, newSelection];
			} else {
				localSelected = [newSelection];
			}
		}
	}

	function handleConfirm() {
		onSelect(localSelected);
		onClose();
	}

	function handleCancel() {
		localSelected = [...selectedDocuments];
		onClose();
	}

	function formatFileSize(bytes: number | undefined): string {
		if (bytes === undefined) return '—';
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

	function formatCategory(category: string): string {
		const camCat = getCamCategory(category as any);
		return CAM_CATEGORY_LABELS[camCat] || category.replace(/_/g, ' ');
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<button
			type="button"
			class="absolute inset-0 bg-black/50"
			onclick={handleCancel}
			aria-label="Close"
		></button>

		<div class="relative z-10 w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl bg-surface-50-950 shadow-xl">
			<div class="flex items-center justify-between border-b border-surface-300-700 px-6 py-4">
				<div>
					<h2 class="text-lg font-semibold">Select Document{multiSelect ? 's' : ''}</h2>
					<p class="text-sm text-surface-500">
						{multiSelect ? 'Select one or more documents to link' : 'Select a document to link'}
					</p>
				</div>
				<button
					type="button"
					onclick={handleCancel}
					class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<div class="border-b border-surface-300-700 px-6 py-3 space-y-3">
				<div class="relative">
					<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
					<input
						type="text"
						placeholder="Search documents..."
						bind:value={searchQuery}
						class="w-full rounded-lg border border-surface-300-700 bg-surface-100-900 py-2 pl-9 pr-3 text-sm placeholder:text-surface-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					/>
				</div>

				<div class="flex gap-2">
					<select
						bind:value={localCategoryFilter}
						class="flex-1 rounded-lg border border-surface-300-700 bg-surface-100-900 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					>
						{#each categoryOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>

					<select
						bind:value={statusFilter}
						class="rounded-lg border border-surface-300-700 bg-surface-100-900 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					>
						{#each statusOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="flex-1 overflow-y-auto p-2">
				{#if isLoading}
					<div class="flex items-center justify-center py-12">
						<div class="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
					</div>
				{:else if documents.length === 0}
					<div class="py-12 text-center">
						<FileText class="mx-auto h-10 w-10 text-surface-300" />
						<p class="mt-3 text-surface-500">No documents found</p>
						<p class="mt-1 text-sm text-surface-400">Try adjusting your search or filters</p>
					</div>
				{:else}
					<div class="space-y-1">
						{#each documents as doc}
							<button
								type="button"
								onclick={() => toggleDocument(doc)}
								class="w-full flex items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-surface-200-800 {isSelected(doc.id) ? 'bg-primary-500/10 ring-1 ring-primary-500' : ''}"
							>
								<div class="flex h-8 w-8 items-center justify-center rounded {isSelected(doc.id) ? 'bg-primary-500 text-white' : 'bg-surface-200-800'}">
									{#if isSelected(doc.id)}
										<Check class="h-4 w-4" />
									{:else}
										<FileText class="h-4 w-4 text-surface-500" />
									{/if}
								</div>
								<div class="flex-1 min-w-0">
									<p class="truncate font-medium">{doc.title}</p>
									<p class="text-sm text-surface-500">
										{formatCategory(doc.category)} · v{doc.version} · {formatFileSize(doc.fileSize)}
									</p>
								</div>
								<div class="text-sm text-surface-400">
									{formatDate(doc.createdAt)}
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<div class="flex items-center justify-between border-t border-surface-300-700 px-6 py-4">
				<div class="text-sm text-surface-500">
					{#if localSelected.length > 0}
						{localSelected.length} document{localSelected.length > 1 ? 's' : ''} selected
					{:else}
						No documents selected
					{/if}
				</div>
				<div class="flex gap-3">
					<button
						type="button"
						onclick={handleCancel}
						class="btn btn-sm preset-tonal-surface"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={handleConfirm}
						disabled={localSelected.length === 0}
						class="btn btn-sm preset-filled-primary-500"
					>
						{multiSelect ? 'Link Documents' : 'Link Document'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
