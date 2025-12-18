<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { ArrowLeft, Upload, FileText, X, AlertTriangle, Calendar, ChevronDown, ChevronUp, Clock } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';
	import {
		CAM_DOCUMENT_CATEGORIES,
		CAM_CATEGORY_LABELS,
		CAM_TO_PRIMARY_DOCUMENT_CATEGORY,
		type CamDocumentCategory
	} from '$lib/utils/documentCategories';

	interface UploadedFile {
		file: File;
		preview?: string;
		title: string;
		description: string;
		version: number;
		expanded: boolean;
	}

	let files = $state<UploadedFile[]>([]);
	let isUploading = $state(false);
	let error = $state<string | null>(null);
	let dragOver = $state(false);
	let validationErrors = $state<string[]>([]);

	let sharedMetadata = $state({
		category: 'OTHER' as CamDocumentCategory,
		visibility: 'PUBLIC',
		effectiveDate: new Date().toISOString().split('T')[0],
		contextType: '',
		contextId: ''
	});

	const categoryOptions = CAM_DOCUMENT_CATEGORIES.map((cat) => ({
		value: cat,
		label: CAM_CATEGORY_LABELS[cat]
	}));

	const visibilityOptions = [
		{ value: 'PUBLIC', label: 'Public (All Members)' },
		{ value: 'OWNERS_ONLY', label: 'Owners Only' },
		{ value: 'BOARD_ONLY', label: 'Board Only' },
		{ value: 'STAFF_ONLY', label: 'Staff Only' },
		{ value: 'PRIVATE', label: 'Private' }
	];

	const contextTypeLabels: Record<string, string> = {
		VIOLATION: 'Violation',
		ARC_REQUEST: 'ARC Request',
		WORK_ORDER: 'Work Order',
		UNIT: 'Unit',
		VENDOR: 'Vendor',
		ASSOCIATION: 'Association'
	};

	const isOtherCategory = $derived(sharedMetadata.category === 'OTHER');
	const isNotYetEffective = $derived(() => {
		if (!sharedMetadata.effectiveDate) return false;
		return new Date(sharedMetadata.effectiveDate) > new Date();
	});

	$effect(() => {
		const params = $page.url.searchParams;
		const contextType = params.get('contextType');
		const contextId = params.get('contextId');

		if (contextType) sharedMetadata.contextType = contextType;
		if (contextId) sharedMetadata.contextId = contextId;

		if (contextType === 'VIOLATION') sharedMetadata.category = 'EVIDENCE_INSPECTIONS';
		else if (contextType === 'ARC_REQUEST') sharedMetadata.category = 'ARCHITECTURAL_GUIDELINES';
		else if (contextType === 'WORK_ORDER') sharedMetadata.category = 'EVIDENCE_INSPECTIONS';
		else if (contextType === 'ASSOCIATION') sharedMetadata.category = 'GOVERNING_DOCUMENTS';
	});

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files) {
			addFiles(Array.from(input.files));
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		if (e.dataTransfer?.files) {
			addFiles(Array.from(e.dataTransfer.files));
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		dragOver = true;
	}

	function handleDragLeave() {
		dragOver = false;
	}

	function addFiles(newFiles: File[]) {
		const uploadedFiles: UploadedFile[] = newFiles.map(file => {
			const uploaded: UploadedFile = {
				file,
				title: file.name.replace(/\.[^/.]+$/, ''),
				description: '',
				version: 1,
				expanded: false
			};
			if (file.type.startsWith('image/')) {
				uploaded.preview = URL.createObjectURL(file);
			}
			return uploaded;
		});
		files = [...files, ...uploadedFiles];
	}

	function removeFile(index: number) {
		const file = files[index];
		if (file.preview) {
			URL.revokeObjectURL(file.preview);
		}
		files = files.filter((_, i) => i !== index);
	}

	function toggleFileExpanded(index: number) {
		files[index].expanded = !files[index].expanded;
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function validateForm(): boolean {
		const errors: string[] = [];

		if (files.length === 0) {
			errors.push('Please select at least one file to upload');
		}

		if (!sharedMetadata.effectiveDate) {
			errors.push('Effective date is required');
		}

		if (!sharedMetadata.visibility) {
			errors.push('Visibility is required');
		}

		for (const uploadedFile of files) {
			if (!uploadedFile.title.trim()) {
				errors.push(`Title is required for ${uploadedFile.file.name}`);
			}
		}

		validationErrors = errors;
		return errors.length === 0;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!validateForm()) {
			error = validationErrors[0];
			return;
		}

		if (!$currentAssociation?.id) {
			error = 'No association selected';
			return;
		}

		isUploading = true;
		error = null;

		try {
			const documentCategory = CAM_TO_PRIMARY_DOCUMENT_CATEGORY[sharedMetadata.category];

			const uploadPromises = files.map(async (uploadedFile) => {
				const formDataObj = new FormData();
				formDataObj.append('file', uploadedFile.file);
				formDataObj.append('associationId', $currentAssociation!.id);
				formDataObj.append('title', uploadedFile.title);
				formDataObj.append('description', uploadedFile.description);
				formDataObj.append('category', documentCategory);
				formDataObj.append('visibility', sharedMetadata.visibility);
				formDataObj.append('effectiveDate', sharedMetadata.effectiveDate);
				formDataObj.append('version', String(uploadedFile.version));
				if (sharedMetadata.contextType) formDataObj.append('contextType', sharedMetadata.contextType);
				if (sharedMetadata.contextId) formDataObj.append('contextId', sharedMetadata.contextId);

				const response = await fetch('/api/document/upload', {
					method: 'POST',
					body: formDataObj
				});

				if (!response.ok) {
					throw new Error(`Failed to upload ${uploadedFile.file.name}`);
				}

				return response.json();
			});

			await Promise.all(uploadPromises);

			if (sharedMetadata.contextType && sharedMetadata.contextId) {
				const contextPath = getContextPath(sharedMetadata.contextType, sharedMetadata.contextId);
				goto(contextPath);
			} else {
				goto('/app/cam/documents');
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to upload files';
			console.error(e);
		} finally {
			isUploading = false;
		}
	}

	function getContextPath(contextType: string, contextId: string): string {
		switch (contextType) {
			case 'VIOLATION': return `/app/cam/violations/${contextId}`;
			case 'ARC_REQUEST': return `/app/cam/arc/${contextId}`;
			case 'WORK_ORDER': return `/app/cam/work-orders/${contextId}`;
			case 'UNIT': return `/app/cam/units/${contextId}`;
			case 'VENDOR': return `/app/cam/vendors/${contextId}`;
			case 'ASSOCIATION': return `/app/cam/associations/${contextId}`;
			default: return '/app/cam/documents';
		}
	}

	function getBackPath(): string {
		if (sharedMetadata.contextType && sharedMetadata.contextId) {
			return getContextPath(sharedMetadata.contextType, sharedMetadata.contextId);
		}
		return '/app/cam/documents';
	}
</script>

<svelte:head>
	<title>Upload Document | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto(getBackPath())}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>
			<div class="flex-1">
				<h1 class="text-xl font-semibold">Upload Documents</h1>
				{#if sharedMetadata.contextType}
					<p class="mt-0.5 text-sm text-surface-500">
						Uploading to {contextTypeLabels[sharedMetadata.contextType] || sharedMetadata.contextType}
					</p>
				{/if}
			</div>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-6">
		<div class="mx-auto max-w-3xl">
			<form onsubmit={handleSubmit} class="space-y-6">
				{#if error}
					<div class="rounded-lg bg-error-500/10 p-4 text-error-500">
						{error}
					</div>
				{/if}

				<Card variant="outlined" padding="lg">
					<h3 class="mb-4 font-semibold">Select Files</h3>
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
							Drag and drop files here, or
							<label class="cursor-pointer text-primary-500 hover:underline">
								browse
								<input
									type="file"
									multiple
									class="hidden"
									onchange={handleFileSelect}
								/>
							</label>
						</p>
						<p class="mt-1 text-xs text-surface-400">
							PDF, images, and documents up to 25MB each. You can upload multiple files at once.
						</p>
					</div>

					{#if files.length > 0}
						<div class="mt-4 space-y-3">
							<p class="text-sm text-surface-500">{files.length} file{files.length > 1 ? 's' : ''} selected</p>
							{#each files as uploadedFile, index}
								<div class="rounded-lg border border-surface-300-700 bg-surface-100-900">
									<div class="flex items-center gap-3 p-3">
										{#if uploadedFile.preview}
											<img
												src={uploadedFile.preview}
												alt={uploadedFile.file.name}
												class="h-10 w-10 rounded object-cover"
											/>
										{:else}
											<div class="flex h-10 w-10 items-center justify-center rounded bg-surface-300-700">
												<FileText class="h-5 w-5 text-surface-500" />
											</div>
										{/if}
										<div class="flex-1 min-w-0">
											<p class="truncate font-medium">{uploadedFile.file.name}</p>
											<p class="text-sm text-surface-500">
												{formatFileSize(uploadedFile.file.size)}
											</p>
										</div>
										<button
											type="button"
											onclick={() => toggleFileExpanded(index)}
											class="flex h-8 w-8 items-center justify-center rounded-lg text-surface-500 hover:bg-surface-200-800"
											title="Edit file details"
										>
											{#if uploadedFile.expanded}
												<ChevronUp class="h-4 w-4" />
											{:else}
												<ChevronDown class="h-4 w-4" />
											{/if}
										</button>
										<button
											type="button"
											onclick={() => removeFile(index)}
											class="flex h-8 w-8 items-center justify-center rounded-lg text-surface-500 hover:bg-surface-300-700 hover:text-error-500"
										>
											<X class="h-4 w-4" />
										</button>
									</div>

									{#if uploadedFile.expanded}
										<div class="border-t border-surface-300-700 p-3 space-y-3">
											<div>
												<label for="file-title-{index}" class="mb-1 block text-sm font-medium">Title *</label>
												<input
													id="file-title-{index}"
													type="text"
													bind:value={uploadedFile.title}
													placeholder="Document title"
													class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
												/>
											</div>
											<div>
												<label for="file-desc-{index}" class="mb-1 block text-sm font-medium">Description</label>
												<textarea
													id="file-desc-{index}"
													bind:value={uploadedFile.description}
													placeholder="Optional description"
													rows="2"
													class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
												></textarea>
											</div>
											<div>
												<label for="file-version-{index}" class="mb-1 block text-sm font-medium">Version</label>
												<input
													id="file-version-{index}"
													type="number"
													bind:value={uploadedFile.version}
													min="1"
													class="w-24 rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
												/>
											</div>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</Card>

				<Card variant="outlined" padding="lg">
					<h3 class="mb-4 font-semibold">Shared Document Settings</h3>
					<p class="mb-4 text-sm text-surface-500">These settings apply to all uploaded files.</p>
					<div class="space-y-4">
						<div class="grid gap-4 sm:grid-cols-2">
							<div>
								<label for="category" class="mb-1 block text-sm font-medium">
									Category *
								</label>
								<select
									id="category"
									bind:value={sharedMetadata.category}
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								>
									{#each categoryOptions as option}
										<option value={option.value}>{option.label}</option>
									{/each}
								</select>
								{#if isOtherCategory}
									<div class="mt-2 flex items-start gap-2 rounded-lg bg-warning-500/10 p-2 text-warning-600">
										<AlertTriangle class="h-4 w-4 mt-0.5 flex-shrink-0" />
										<p class="text-sm">Consider selecting a more specific category for better organization.</p>
									</div>
								{/if}
							</div>

							<div>
								<label for="visibility" class="mb-1 block text-sm font-medium">
									Visibility *
								</label>
								<select
									id="visibility"
									bind:value={sharedMetadata.visibility}
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								>
									{#each visibilityOptions as option}
										<option value={option.value}>{option.label}</option>
									{/each}
								</select>
							</div>
						</div>

						<div>
							<label for="effectiveDate" class="mb-1 block text-sm font-medium">
								Effective Date *
							</label>
							<div class="flex items-center gap-3">
								<div class="relative flex-1">
									<Calendar class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
									<input
										type="date"
										id="effectiveDate"
										bind:value={sharedMetadata.effectiveDate}
										class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 py-2 pl-10 pr-3 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
									/>
								</div>
								{#if isNotYetEffective()}
									<div class="flex items-center gap-1 rounded-lg bg-warning-500/10 px-3 py-2 text-warning-600">
										<Clock class="h-4 w-4" />
										<span class="text-sm">Not yet effective</span>
									</div>
								{/if}
							</div>
						</div>

						{#if sharedMetadata.contextType}
							<div class="rounded-lg bg-surface-200-800 p-3">
								<p class="text-sm">
									<span class="font-medium">Linked to:</span>
									{contextTypeLabels[sharedMetadata.contextType] || sharedMetadata.contextType}
								</p>
							</div>
						{/if}
					</div>
				</Card>

				<div class="flex justify-end gap-3">
					<button
						type="button"
						onclick={() => goto(getBackPath())}
						class="btn preset-tonal-surface"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={isUploading || files.length === 0}
						class="btn preset-filled-primary-500"
					>
						{#if isUploading}
							<span class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
							Uploading...
						{:else}
							<Upload class="mr-2 h-4 w-4" />
							Upload {files.length > 1 ? `${files.length} Files` : 'File'}
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
</div>
