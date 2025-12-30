<script lang="ts">
	import { ArrowLeft, Upload, Loader2, Check, X, FileText, Image, File } from 'lucide-svelte';
	import { PageContainer, Card } from '$lib/components/ui';
	import { orpc } from '$lib/api';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { 
		CONCIERGE_DOCUMENT_CATEGORIES,
		CONCIERGE_CATEGORY_LABELS,
		type ConciergeDocumentCategory
	} from '$lib/utils/documentCategories';

	// Property interface for type safety
	interface Property {
		id: string;
		name: string;
		addressLine1: string;
	}

	// File validation constants
	const allowedTypes = [
		'application/pdf',
		'image/jpeg',
		'image/jpg',
		'image/png',
		'image/gif',
		'image/webp',
		'application/msword',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
	];
	const maxFileSize = 10 * 1024 * 1024; // 10MB

	// Category options for select
	const categories = CONCIERGE_DOCUMENT_CATEGORIES.map(cat => ({
		value: cat,
		label: CONCIERGE_CATEGORY_LABELS[cat]
	}));

	interface Props {
		data: {
			properties: Property[];
		};
	}

	let { data }: Props = $props();

	let isSubmitting = $state(false);
	let isLoadingProperties = $state(false);
	let error = $state<string | null>(null);
	let properties = $derived(data.properties);

	// Form state
	let title = $state('');
	let description = $state('');
	let category = $state<ConciergeDocumentCategory>('GENERAL');
	let selectedPropertyId = $state('');
	let selectedFile = $state<globalThis.File | null>(null);
	let isDragging = $state(false);

	// Form validation
	const isValid = $derived(
		title.trim().length > 0 &&
		selectedPropertyId.length > 0 &&
		selectedFile !== null
	);

	// Get pre-selected property from URL
	const urlPropertyId = $page.url.searchParams.get('propertyId');

	// Synchronize pre-selected values
	$effect(() => {
		if (urlPropertyId) {
			selectedPropertyId = urlPropertyId;
		} else if (properties.length === 1 && !selectedPropertyId) {
			selectedPropertyId = properties[0].id;
		}
	});

	async function loadProperties() {
		// Just refresh the data
		window.location.reload();
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;

		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			validateAndSetFile(files[0]);
		}
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			validateAndSetFile(input.files[0]);
		}
	}

	function validateAndSetFile(file: globalThis.File) {
		error = null;

		if (!allowedTypes.includes(file.type)) {
			error = 'File type not supported. Please upload PDF, images, or Word documents.';
			return;
		}

		if (file.size > maxFileSize) {
			error = 'File is too large. Maximum size is 10MB.';
			return;
		}

		selectedFile = file;

		// Auto-fill title from filename if empty
		if (!title) {
			title = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
		}
	}

	function clearFile() {
		selectedFile = null;
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function getFileIcon(mimeType: string) {
		if (mimeType.startsWith('image/')) return Image;
		if (mimeType.includes('pdf')) return FileText;
		return File;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!isValid || isSubmitting || !selectedFile) return;

		isSubmitting = true;
		error = null;

		try {
			// Use oRPC's native file upload support
			const result = await orpc.document.uploadWithFile({
				idempotencyKey: crypto.randomUUID(),
				file: selectedFile,
				contextType: 'PROPERTY',
				contextId: selectedPropertyId,
				title: title.trim(),
				description: description.trim() || undefined,
				category: category,
				visibility: 'PRIVATE'
			});

			goto(`/app/concierge/documents/${result.data.document.id}`);
		} catch (err) {
			console.error('Failed to upload document:', err);
			error = err instanceof Error ? err.message : 'Failed to upload document';
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Upload Document | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-8">
		<!-- Header -->
		<div class="mb-6">
			<a
				href="/app/concierge/documents"
				class="mb-4 inline-flex items-center text-sm text-surface-500 hover:text-surface-700"
			>
				<ArrowLeft class="mr-1 h-4 w-4" />
				Back to Documents
			</a>
			<h1 class="text-2xl font-bold">Upload Document</h1>
			<p class="mt-1 text-surface-500">Add a document to your property records</p>
		</div>

		{#if error}
			<div class="mb-6 rounded-lg bg-error-500/10 p-4 text-sm text-error-500">
				{error}
			</div>
		{/if}

		<form onsubmit={handleSubmit}>
			<div class="space-y-6">
				<!-- File Upload -->
				<Card variant="outlined" padding="md">
					<h2 class="mb-4 font-semibold">File</h2>

					{#if selectedFile}
						{@const FileIcon = getFileIcon(selectedFile.type)}
						<div
							class="flex items-center gap-4 rounded-lg border border-surface-300-700 bg-surface-500/5 p-4"
						>
							<div
								class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-500/10"
							>
								<FileIcon class="h-6 w-6 text-primary-500" />
							</div>
							<div class="min-w-0 flex-1">
								<p class="font-medium">{selectedFile.name}</p>
								<p class="text-sm text-surface-500">{formatFileSize(selectedFile.size)}</p>
							</div>
							<button
								type="button"
								onclick={clearFile}
								class="btn-icon preset-tonal-surface"
								aria-label="Remove file"
							>
								<X class="h-4 w-4" />
							</button>
						</div>
					{:else}
						<div
							role="button"
							tabindex="0"
							ondragover={handleDragOver}
							ondragleave={handleDragLeave}
							ondrop={handleDrop}
							class="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors {isDragging
								? 'border-primary-500 bg-primary-500/5'
								: 'border-surface-300-700 hover:border-primary-300'}"
						>
							<Upload class="h-10 w-10 text-surface-400" />
							<p class="mt-4 text-center font-medium">
								Drag and drop your file here, or
								<label class="cursor-pointer text-primary-500 hover:underline">
									browse
									<input
										type="file"
										class="sr-only"
										accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx"
										onchange={handleFileSelect}
									/>
								</label>
							</p>
							<p class="mt-2 text-sm text-surface-500">
								PDF, images, or Word documents up to 10MB
							</p>
						</div>
					{/if}
				</Card>

				<!-- Document Details -->
				<Card variant="outlined" padding="md">
					<h2 class="mb-4 font-semibold">Document Details</h2>
					<div class="space-y-4">
						<div>
							<label for="title" class="label mb-1 block">
								Title <span class="text-error-500">*</span>
							</label>
							<input
								type="text"
								id="title"
								bind:value={title}
								placeholder="e.g., Home Insurance Policy 2024"
								class="input w-full"
								required
								maxlength="255"
							/>
						</div>

						<div>
							<label for="description" class="label mb-1 block">Description</label>
							<textarea
								id="description"
								bind:value={description}
								placeholder="Optional description or notes about this document"
								class="textarea w-full"
								rows="3"
							></textarea>
						</div>

						<div>
							<label for="category" class="label mb-1 block">
								Category <span class="text-error-500">*</span>
							</label>
							<select id="category" bind:value={category} class="select w-full">
								{#each categories as cat}
									<option value={cat.value}>{cat.label}</option>
								{/each}
							</select>
						</div>
					</div>
				</Card>

				<!-- Property Association -->
				<Card variant="outlined" padding="md">
					<h2 class="mb-4 font-semibold">Property</h2>
					{#if isLoadingProperties}
						<div class="flex items-center gap-2 text-surface-500">
							<Loader2 class="h-4 w-4 animate-spin" />
							Loading properties...
						</div>
					{:else if properties.length === 0}
						<div class="rounded-lg bg-warning-500/10 p-4">
							<p class="font-medium text-warning-600 dark:text-warning-400">No properties found</p>
							<p class="mt-1 text-sm text-surface-500">
								You need to add a property before uploading documents.
							</p>
							<a href="/app/concierge/properties/new" class="btn preset-filled-primary-500 mt-3">
								Add Property
							</a>
						</div>
					{:else}
						<select
							id="property"
							bind:value={selectedPropertyId}
							class="select w-full"
							required
						>
							<option value="">Select a property</option>
							{#each properties as prop}
								<option value={prop.id}>
									{prop.name} - {prop.addressLine1}
								</option>
							{/each}
						</select>
					{/if}
				</Card>

				<!-- Actions -->
				<div class="flex justify-end gap-3">
					<a href="/app/concierge/documents" class="btn preset-tonal-surface">Cancel</a>
					<button
						type="submit"
						class="btn preset-filled-primary-500"
						disabled={!isValid || isSubmitting || properties.length === 0}
					>
						{#if isSubmitting}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Uploading...
						{:else}
							<Check class="mr-2 h-4 w-4" />
							Upload Document
						{/if}
					</button>
				</div>
			</div>
		</form>
	</div>
</PageContainer>
