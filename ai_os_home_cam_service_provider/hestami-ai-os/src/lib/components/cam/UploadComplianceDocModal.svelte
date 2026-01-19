<script lang="ts">
	import { ARCCategoryValues, DocumentCategoryValues } from '$lib/api/cam';
	import { X, Loader2, Upload, FileText } from 'lucide-svelte';

	interface Props {
		open: boolean;
		vendorName?: string;
		loading?: boolean;
		onConfirm: (data: { documentType: string; file: File; expirationDate?: string; notes?: string }) => void;
		onCancel: () => void;
	}

	let {
		open,
		vendorName = '',
		loading = false,
		onConfirm,
		onCancel
	}: Props = $props();

	let documentType = $state('');
	let expirationDate = $state('');
	let notes = $state('');
	let selectedFile = $state<File | null>(null);
	let error = $state('');
	let dragOver = $state(false);

	const documentTypes = [
		{ value: 'INSURANCE_COI', label: 'Certificate of Insurance (COI)' },
		{ value: 'INSURANCE_GL', label: 'General Liability Insurance' },
		{ value: 'INSURANCE_WC', label: "Workers' Compensation Insurance" },
		{ value: DocumentCategoryValues.LICENSE, label: 'Business License' },
		{ value: 'LICENSE_CONTRACTOR', label: 'Contractor License' },
		{ value: 'W9', label: 'W-9 Form' },
		{ value: DocumentCategoryValues.CONTRACT, label: 'Service Contract' },
		{ value: DocumentCategoryValues.BOND, label: 'Surety Bond' },
		{ value: ARCCategoryValues.OTHER, label: 'Other Compliance Document' }
	];

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			selectedFile = input.files[0];
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
		if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
			selectedFile = event.dataTransfer.files[0];
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		dragOver = true;
	}

	function handleDragLeave() {
		dragOver = false;
	}

	function handleConfirm() {
		if (!documentType) {
			error = 'Please select a document type.';
			return;
		}
		if (!selectedFile) {
			error = 'Please select a file to upload.';
			return;
		}
		error = '';
		onConfirm({
			documentType,
			file: selectedFile,
			expirationDate: expirationDate || undefined,
			notes: notes.trim() || undefined
		});
	}

	function handleCancel() {
		documentType = '';
		expirationDate = '';
		notes = '';
		selectedFile = null;
		error = '';
		onCancel();
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}

	$effect(() => {
		if (!open) {
			documentType = '';
			expirationDate = '';
			notes = '';
			selectedFile = null;
			error = '';
		}
	});
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<button
			type="button"
			class="absolute inset-0 bg-black/50"
			onclick={handleCancel}
			aria-label="Close modal"
		></button>

		<div class="relative z-10 w-full max-w-lg rounded-lg bg-surface-100-900 shadow-xl">
			<div class="flex items-center justify-between border-b border-surface-300-700 px-6 py-4">
				<h2 class="text-lg font-semibold">Upload Compliance Document</h2>
				<button
					type="button"
					onclick={handleCancel}
					class="rounded-lg p-1 text-surface-500 transition-colors hover:bg-surface-200-800 hover:text-surface-700-300"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<div class="space-y-4 p-6">
				{#if vendorName}
					<div class="rounded-lg bg-surface-200-800 p-3">
						<p class="text-sm text-surface-500">Vendor</p>
						<p class="font-medium">{vendorName}</p>
					</div>
				{/if}

				<div>
					<label for="document-type" class="block text-sm font-medium">
						Document Type <span class="text-error-500">*</span>
					</label>
					<select
						id="document-type"
						bind:value={documentType}
						class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						class:border-error-500={error && !documentType}
					>
						<option value="">Select document type</option>
						{#each documentTypes as type}
							<option value={type.value}>{type.label}</option>
						{/each}
					</select>
				</div>

				<div>
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="block text-sm font-medium">
						File <span class="text-error-500">*</span>
					</label>
					<div
						class="mt-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors {dragOver ? 'border-primary-500 bg-primary-500/5' : 'border-surface-300-700'} {error && !selectedFile ? 'border-error-500' : ''}"
						ondrop={handleDrop}
						ondragover={handleDragOver}
						ondragleave={handleDragLeave}
						role="button"
						tabindex="0"
					>
						{#if selectedFile}
							<div class="flex items-center justify-center gap-3">
								<FileText class="h-8 w-8 text-primary-500" />
								<div class="text-left">
									<p class="font-medium">{selectedFile.name}</p>
									<p class="text-sm text-surface-500">{formatFileSize(selectedFile.size)}</p>
								</div>
								<button
									type="button"
									onclick={() => selectedFile = null}
									class="ml-2 text-surface-400 hover:text-error-500"
								>
									<X class="h-5 w-5" />
								</button>
							</div>
						{:else}
							<Upload class="mx-auto h-8 w-8 text-surface-400" />
							<p class="mt-2 text-sm text-surface-500">
								Drag and drop a file here, or
							</p>
							<label class="mt-2 inline-block cursor-pointer text-sm font-medium text-primary-500 hover:text-primary-600">
								browse to upload
								<input
									type="file"
									class="hidden"
									accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
									onchange={handleFileSelect}
								/>
							</label>
							<p class="mt-1 text-xs text-surface-400">
								PDF, DOC, DOCX, JPG, PNG up to 100MB
							</p>
						{/if}
					</div>
				</div>

				<div>
					<label for="expiration-date" class="block text-sm font-medium">
						Expiration Date
					</label>
					<input
						id="expiration-date"
						type="date"
						bind:value={expirationDate}
						class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					/>
					<p class="mt-1 text-xs text-surface-500">
						Leave blank if document does not expire.
					</p>
				</div>

				<div>
					<label for="notes" class="block text-sm font-medium">
						Notes
					</label>
					<textarea
						id="notes"
						bind:value={notes}
						rows={2}
						placeholder="Add any notes about this document..."
						class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm placeholder:text-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					></textarea>
				</div>

				{#if error}
					<p class="text-sm text-error-500">{error}</p>
				{/if}
			</div>

			<div class="flex justify-end gap-3 border-t border-surface-300-700 px-6 py-4">
				<button
					type="button"
					onclick={handleCancel}
					disabled={loading}
					class="rounded-lg px-4 py-2 text-sm font-medium text-surface-700-300 transition-colors hover:bg-surface-200-800"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={handleConfirm}
					disabled={loading || !documentType || !selectedFile}
					class="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if loading}
						<Loader2 class="h-4 w-4 animate-spin" />
					{/if}
					Upload Document
				</button>
			</div>
		</div>
	</div>
{/if}
