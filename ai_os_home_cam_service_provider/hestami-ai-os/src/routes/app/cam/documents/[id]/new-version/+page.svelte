<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { ArrowLeft, Upload, FileText, X, AlertCircle } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';

	interface ParentDocument {
		id: string;
		title: string;
		category: string;
		version: number;
		fileName: string;
		fileSize: number;
	}

	let parentDocument = $state<ParentDocument | null>(null);
	let file = $state<File | null>(null);
	let filePreview = $state<string | null>(null);
	let isLoading = $state(true);
	let isUploading = $state(false);
	let error = $state<string | null>(null);
	let dragOver = $state(false);

	const documentId = $derived($page.params.id);

	$effect(() => {
		if (documentId) {
			loadParentDocument();
		}
	});

	async function loadParentDocument() {
		isLoading = true;
		try {
			const response = await fetch(`/api/v1/rpc/document.getDocument?id=${documentId}`);
			if (response.ok) {
				const data = await response.json();
				if (data.ok && data.data?.document) {
					parentDocument = {
						id: data.data.document.id,
						title: data.data.document.title,
						category: data.data.document.category,
						version: data.data.document.version,
						fileName: data.data.document.fileName,
						fileSize: data.data.document.fileSize
					};
				}
			}
		} catch (e) {
			error = 'Failed to load document';
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			setFile(input.files[0]);
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
			setFile(e.dataTransfer.files[0]);
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		dragOver = true;
	}

	function handleDragLeave() {
		dragOver = false;
	}

	function setFile(newFile: File) {
		if (filePreview) {
			URL.revokeObjectURL(filePreview);
		}
		file = newFile;
		if (newFile.type.startsWith('image/')) {
			filePreview = URL.createObjectURL(newFile);
		} else {
			filePreview = null;
		}
	}

	function removeFile() {
		if (filePreview) {
			URL.revokeObjectURL(filePreview);
		}
		file = null;
		filePreview = null;
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!file) {
			error = 'Please select a file to upload';
			return;
		}

		if (!parentDocument) {
			error = 'Parent document not found';
			return;
		}

		isUploading = true;
		error = null;

		try {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('parentDocumentId', parentDocument.id);

			const response = await fetch('/api/document/upload-version', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				throw new Error('Failed to upload new version');
			}

			goto(`/app/cam/documents`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to upload new version';
			console.error(e);
		} finally {
			isUploading = false;
		}
	}
</script>

<svelte:head>
	<title>Upload New Version | Documents | CAM | Hestami AI</title>
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
			<div class="flex-1">
				<h1 class="text-xl font-semibold">Upload New Version</h1>
				{#if parentDocument}
					<p class="mt-0.5 text-sm text-surface-500">
						Creating version {parentDocument.version + 1} of "{parentDocument.title}"
					</p>
				{/if}
			</div>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-6">
		<div class="mx-auto max-w-2xl">
			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<div class="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
				</div>
			{:else if !parentDocument}
				<Card variant="outlined" padding="lg">
					<div class="text-center py-8">
						<AlertCircle class="mx-auto h-12 w-12 text-error-500" />
						<p class="mt-4 text-lg font-medium">Document not found</p>
						<p class="mt-2 text-surface-500">The document you're trying to update doesn't exist.</p>
						<button
							type="button"
							onclick={() => goto('/app/cam/documents')}
							class="btn preset-filled-primary-500 mt-6"
						>
							Back to Documents
						</button>
					</div>
				</Card>
			{:else}
				<form onsubmit={handleSubmit} class="space-y-6">
					{#if error}
						<div class="rounded-lg bg-error-500/10 p-4 text-error-500">
							{error}
						</div>
					{/if}

					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 font-semibold">Current Version</h3>
						<div class="rounded-lg bg-surface-200-800 p-4">
							<div class="flex items-center gap-3">
								<div class="flex h-10 w-10 items-center justify-center rounded bg-surface-300-700">
									<FileText class="h-5 w-5 text-surface-500" />
								</div>
								<div class="flex-1">
									<p class="font-medium">{parentDocument.title}</p>
									<p class="text-sm text-surface-500">
										Version {parentDocument.version} · {formatFileSize(parentDocument.fileSize)}
									</p>
								</div>
								<span class="rounded bg-surface-300-700 px-2 py-1 text-xs font-medium">
									Will be superseded
								</span>
							</div>
						</div>
					</Card>

					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 font-semibold">New Version File</h3>
						{#if !file}
							<div
								class="rounded-lg border-2 border-dashed p-8 text-center transition-colors {dragOver
									? 'border-primary-500 bg-primary-500/5'
									: 'border-surface-300-700'}"
								ondrop={handleDrop}
								ondragover={handleDragOver}
								ondragleave={handleDragLeave}
								role="button"
								tabindex="0"
							>
								<Upload class="mx-auto h-10 w-10 text-surface-400" />
								<p class="mt-3 text-surface-600">
									Drag and drop the new version here, or
									<label class="cursor-pointer text-primary-500 hover:underline">
										browse
										<input
											type="file"
											class="hidden"
											onchange={handleFileSelect}
										/>
									</label>
								</p>
								<p class="mt-1 text-xs text-surface-400">
									The new file will become version {parentDocument.version + 1}
								</p>
							</div>
						{:else}
							<div class="rounded-lg bg-surface-200-800 p-4">
								<div class="flex items-center gap-3">
									{#if filePreview}
										<img
											src={filePreview}
											alt={file.name}
											class="h-12 w-12 rounded object-cover"
										/>
									{:else}
										<div class="flex h-12 w-12 items-center justify-center rounded bg-surface-300-700">
											<FileText class="h-6 w-6 text-surface-500" />
										</div>
									{/if}
									<div class="flex-1">
										<p class="font-medium">{file.name}</p>
										<p class="text-sm text-surface-500">
											{formatFileSize(file.size)}
										</p>
									</div>
									<span class="rounded bg-primary-500/10 px-2 py-1 text-xs font-medium text-primary-500">
										Version {parentDocument.version + 1}
									</span>
									<button
										type="button"
										onclick={removeFile}
										class="flex h-8 w-8 items-center justify-center rounded-lg text-surface-500 hover:bg-surface-300-700 hover:text-error-500"
									>
										<X class="h-4 w-4" />
									</button>
								</div>
							</div>
						{/if}
					</Card>

					<Card variant="outlined" padding="lg">
						<h3 class="mb-2 font-semibold">What happens next?</h3>
						<ul class="space-y-2 text-sm text-surface-600">
							<li class="flex items-start gap-2">
								<span class="mt-1 h-1.5 w-1.5 rounded-full bg-primary-500"></span>
								<span>The current version will be marked as <strong>superseded</strong></span>
							</li>
							<li class="flex items-start gap-2">
								<span class="mt-1 h-1.5 w-1.5 rounded-full bg-primary-500"></span>
								<span>The new file will become the <strong>active version</strong></span>
							</li>
							<li class="flex items-start gap-2">
								<span class="mt-1 h-1.5 w-1.5 rounded-full bg-primary-500"></span>
								<span>All version history will be <strong>preserved</strong></span>
							</li>
							<li class="flex items-start gap-2">
								<span class="mt-1 h-1.5 w-1.5 rounded-full bg-primary-500"></span>
								<span>Existing references will continue to point to their original versions</span>
							</li>
						</ul>
					</Card>

					<div class="flex justify-end gap-3">
						<button
							type="button"
							onclick={() => goto('/app/cam/documents')}
							class="btn preset-tonal-surface"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isUploading || !file}
							class="btn preset-filled-primary-500"
						>
							{#if isUploading}
								<span class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
								Uploading...
							{:else}
								<Upload class="mr-2 h-4 w-4" />
								Upload Version {parentDocument.version + 1}
							{/if}
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
</div>
