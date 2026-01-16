<script lang="ts">
	import { Upload, X, FileText, Image, Video, File, Loader2, AlertTriangle, Check } from 'lucide-svelte';
	import * as tus from 'tus-js-client';
	import { createOrgClient } from '$lib/api/orpc';
	import {
		CONCIERGE_DOCUMENT_CATEGORIES,
		CONCIERGE_CATEGORY_LABELS,
		DocumentCategory,
		type ConciergeDocumentCategory
	} from '$lib/utils/documentCategories';

	/**
	 * File validation constants
	 */
	const ALLOWED_TYPES = [
		'application/pdf',
		'image/jpeg',
		'image/jpg',
		'image/png',
		'image/gif',
		'image/webp',
		'video/mp4',
		'video/quicktime',
		'video/webm',
		'application/msword',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
	];
	const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
	const MAX_FILES = 10;

	/**
	 * File status for tracking upload progress
	 * - 'pending': File selected but not yet uploaded
	 * - 'uploading': TUS upload in progress
	 * - 'complete': TUS upload finished (file is now processing on server)
	 * - 'error': Upload failed
	 */
	type FileStatus = 'pending' | 'uploading' | 'complete' | 'error';

	/**
	 * Tracked file with upload metadata
	 */
	interface TrackedFile {
		id: string;
		file: globalThis.File;
		status: FileStatus;
		progress: number;
		error?: string;
		documentId?: string;
		category: ConciergeDocumentCategory;
	}

	interface Props {
		organizationId: string;
		disabled?: boolean;
		onFilesChange?: (files: TrackedFile[]) => void;
	}

	let { organizationId, disabled = false, onFilesChange }: Props = $props();

	let files = $state<TrackedFile[]>([]);
	let isDragging = $state(false);
	let validationError = $state<string | null>(null);

	// Expose files and methods for parent component
	export function getFiles(): TrackedFile[] {
		return files;
	}

	export function getPendingFiles(): TrackedFile[] {
		return files.filter((f) => f.status === 'pending');
	}

	export function getUploadedDocumentIds(): string[] {
		return files.filter((f) => f.documentId).map((f) => f.documentId!);
	}

	export function hasFiles(): boolean {
		return files.length > 0;
	}

	export function hasPendingFiles(): boolean {
		return files.some((f) => f.status === 'pending');
	}

	export function hasErrors(): boolean {
		return files.some((f) => f.status === 'error');
	}

	export function allUploadsComplete(): boolean {
		return files.length > 0 && files.every((f) => f.status === 'complete');
	}

	/**
	 * Upload all pending files for a given case.
	 * Returns immediately after TUS uploads complete - doesn't wait for server-side processing.
	 */
	export async function uploadFilesForCase(caseId: string): Promise<{ success: boolean; documentIds: string[] }> {
		const pendingFiles = files.filter((f) => f.status === 'pending');
		if (pendingFiles.length === 0) {
			return { success: true, documentIds: [] };
		}

		const orgClient = createOrgClient(organizationId);
		const uploadPromises = pendingFiles.map((trackedFile) => uploadSingleFile(trackedFile, caseId, orgClient));

		const results = await Promise.allSettled(uploadPromises);
		const documentIds = results
			.filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
			.map((r) => r.value);

		const hasErrors = results.some((r) => r.status === 'rejected');
		return { success: !hasErrors, documentIds };
	}

	/**
	 * Upload a single file via TUS.
	 * Completes when TUS upload finishes - doesn't wait for server-side processing.
	 */
	async function uploadSingleFile(
		trackedFile: TrackedFile,
		caseId: string,
		orgClient: ReturnType<typeof createOrgClient>
	): Promise<string> {
		const fileIndex = files.findIndex((f) => f.id === trackedFile.id);
		if (fileIndex === -1) {
			throw new Error('File not found');
		}

		// Update status to uploading
		files[fileIndex] = { ...files[fileIndex], status: 'uploading', progress: 0 };
		files = [...files];
		notifyChange();

		try {
			// 1. Initiate upload to get document ID and TUS endpoint
			const idempotencyKey = crypto.randomUUID();
			const initResult = await orgClient.document.initiateUpload({
				idempotencyKey,
				fileName: trackedFile.file.name,
				fileSize: trackedFile.file.size,
				mimeType: trackedFile.file.type,
				contextType: 'CASE',
				contextId: caseId,
				title: trackedFile.file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
				category: trackedFile.category,
				visibility: 'PRIVATE'
			});

			const { documentId, tusEndpoint } = initResult.data;

			// Update tracked file with document ID
			files[fileIndex] = { ...files[fileIndex], documentId };
			files = [...files];
			notifyChange();

			// 2. Perform TUS upload
			await new Promise<void>((resolve, reject) => {
				const upload = new tus.Upload(trackedFile.file, {
					endpoint: tusEndpoint,
					retryDelays: [0, 3000, 5000, 10000, 20000],
					metadata: {
						filename: trackedFile.file.name,
						filetype: trackedFile.file.type,
						documentId
					},
					onError: (err) => {
						const idx = files.findIndex((f) => f.id === trackedFile.id);
						if (idx !== -1) {
							files[idx] = { ...files[idx], status: 'error', error: err.message };
							files = [...files];
							notifyChange();
						}
						reject(err);
					},
					onProgress: (bytesUploaded, bytesTotal) => {
						const progress = Math.round((bytesUploaded / bytesTotal) * 100);
						const idx = files.findIndex((f) => f.id === trackedFile.id);
						if (idx !== -1) {
							files[idx] = { ...files[idx], progress };
							files = [...files];
							notifyChange();
						}
					},
					onSuccess: () => {
						// Mark as complete immediately - server will process asynchronously
						const idx = files.findIndex((f) => f.id === trackedFile.id);
						if (idx !== -1) {
							files[idx] = { ...files[idx], status: 'complete', progress: 100 };
							files = [...files];
							notifyChange();
						}
						resolve();
					}
				});

				upload.start();
			});

			return documentId;
		} catch (error) {
			const idx = files.findIndex((f) => f.id === trackedFile.id);
			if (idx !== -1) {
				files[idx] = {
					...files[idx],
					status: 'error',
					error: error instanceof Error ? error.message : 'Upload failed'
				};
				files = [...files];
				notifyChange();
			}
			throw error;
		}
	}

	function notifyChange() {
		onFilesChange?.(files);
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (!disabled) {
			isDragging = true;
		}
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;

		if (disabled) return;

		const droppedFiles = e.dataTransfer?.files;
		if (droppedFiles) {
			addFiles(Array.from(droppedFiles));
		}
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files) {
			addFiles(Array.from(input.files));
			input.value = ''; // Reset input
		}
	}

	function addFiles(newFiles: globalThis.File[]) {
		validationError = null;

		// Check total file count
		if (files.length + newFiles.length > MAX_FILES) {
			validationError = `Maximum ${MAX_FILES} files allowed. You have ${files.length} files.`;
			return;
		}

		const validFiles: TrackedFile[] = [];

		for (const file of newFiles) {
			// Check file type
			if (!ALLOWED_TYPES.includes(file.type)) {
				validationError = `File type not supported: ${file.name}. Please upload PDF, images, videos, or Word documents.`;
				continue;
			}

			// Check file size
			if (file.size > MAX_FILE_SIZE) {
				validationError = `File too large: ${file.name}. Maximum size is 100MB.`;
				continue;
			}

			// Check for duplicates
			if (files.some((f) => f.file.name === file.name && f.file.size === file.size)) {
				continue; // Skip duplicates silently
			}

			// Determine default category based on file type
			let category: ConciergeDocumentCategory = DocumentCategory.GENERAL;
			if (file.type.startsWith('image/')) {
				category = DocumentCategory.PHOTO;
			} else if (file.type.startsWith('video/')) {
				category = DocumentCategory.VIDEO;
			}

			validFiles.push({
				id: crypto.randomUUID(),
				file,
				status: 'pending',
				progress: 0,
				category
			});
		}

		if (validFiles.length > 0) {
			files = [...files, ...validFiles];
			notifyChange();
		}
	}

	function removeFile(id: string) {
		files = files.filter((f) => f.id !== id);
		notifyChange();
	}

	function updateFileCategory(id: string, category: ConciergeDocumentCategory) {
		const idx = files.findIndex((f) => f.id === id);
		if (idx !== -1) {
			files[idx] = { ...files[idx], category };
			files = [...files];
			notifyChange();
		}
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function getFileIcon(mimeType: string) {
		if (mimeType.startsWith('image/')) return Image;
		if (mimeType.startsWith('video/')) return Video;
		if (mimeType.includes('pdf')) return FileText;
		return File;
	}

	function getStatusColor(status: FileStatus): string {
		switch (status) {
			case 'complete':
				return 'text-success-500';
			case 'error':
				return 'text-error-500';
			case 'uploading':
				return 'text-primary-500';
			default:
				return 'text-surface-500';
		}
	}

	// Category options for dropdown
	const categoryOptions = CONCIERGE_DOCUMENT_CATEGORIES.map((cat) => ({
		value: cat,
		label: CONCIERGE_CATEGORY_LABELS[cat]
	}));
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div>
			<h3 class="font-medium">Supporting Media</h3>
			<p class="text-sm text-surface-500">
				Add photos, videos, or documents to help describe the issue (optional)
			</p>
		</div>
		{#if files.length > 0}
			<span class="text-sm text-surface-500">{files.length}/{MAX_FILES} files</span>
		{/if}
	</div>

	{#if validationError}
		<div class="flex items-center gap-2 rounded-lg bg-error-500/10 p-3 text-sm text-error-500">
			<AlertTriangle class="h-4 w-4 shrink-0" />
			{validationError}
		</div>
	{/if}

	<!-- Drop zone -->
	{#if files.length < MAX_FILES}
		<div
			role="button"
			tabindex="0"
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			ondrop={handleDrop}
			class="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors {isDragging
				? 'border-primary-500 bg-primary-500/5'
				: 'border-surface-300-700 hover:border-primary-300'} {disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}"
		>
			<Upload class="h-8 w-8 text-surface-400" />
			<p class="mt-3 text-center text-sm">
				Drag and drop files here, or
				<label class="cursor-pointer text-primary-500 hover:underline {disabled ? 'pointer-events-none' : ''}">
					browse
					<input
						type="file"
						class="sr-only"
						multiple
						accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.webm,.doc,.docx"
						onchange={handleFileSelect}
						{disabled}
					/>
				</label>
			</p>
			<p class="mt-1 text-xs text-surface-400">
				PDF, images, videos, or documents up to 100MB each
			</p>
		</div>
	{/if}

	<!-- File list -->
	{#if files.length > 0}
		<div class="space-y-2">
			{#each files as trackedFile (trackedFile.id)}
				{@const FileIcon = getFileIcon(trackedFile.file.type)}
				<div
					class="flex items-center gap-3 rounded-lg border border-surface-300-700 bg-surface-50-950 p-3"
				>
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-200-800"
					>
						<FileIcon class="h-5 w-5 {getStatusColor(trackedFile.status)}" />
					</div>

					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium">{trackedFile.file.name}</p>
						<div class="flex items-center gap-2 text-xs text-surface-500">
							<span>{formatFileSize(trackedFile.file.size)}</span>
							{#if trackedFile.status === 'uploading'}
								<span class="text-primary-500">Uploading {trackedFile.progress}%</span>
							{:else if trackedFile.status === 'complete'}
								<span class="text-success-500">Uploaded</span>
							{:else if trackedFile.status === 'error'}
								<span class="text-error-500">{trackedFile.error || 'Error'}</span>
							{/if}
						</div>

						{#if trackedFile.status === 'uploading' && trackedFile.progress > 0}
							<div class="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-200-800">
								<div
									class="h-full bg-primary-500 transition-all"
									style="width: {trackedFile.progress}%"
								></div>
							</div>
						{/if}
					</div>

					<!-- Category selector (only for pending files) -->
					{#if trackedFile.status === 'pending'}
						<select
							class="select w-32 text-xs"
							value={trackedFile.category}
							onchange={(e) => updateFileCategory(trackedFile.id, (e.target as HTMLSelectElement).value as ConciergeDocumentCategory)}
							{disabled}
						>
							{#each categoryOptions as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					{/if}

					<!-- Status indicator or remove button -->
					{#if trackedFile.status === 'uploading'}
						<Loader2 class="h-5 w-5 shrink-0 animate-spin text-primary-500" />
					{:else if trackedFile.status === 'complete'}
						<Check class="h-5 w-5 shrink-0 text-success-500" />
					{:else if trackedFile.status === 'error'}
						<AlertTriangle class="h-5 w-5 shrink-0 text-error-500" />
					{:else}
						<button
							type="button"
							onclick={() => removeFile(trackedFile.id)}
							class="btn-icon btn-sm preset-tonal-surface"
							aria-label="Remove file"
							{disabled}
						>
							<X class="h-4 w-4" />
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
