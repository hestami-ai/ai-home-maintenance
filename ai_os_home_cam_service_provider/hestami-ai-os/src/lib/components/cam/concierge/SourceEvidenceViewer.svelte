<script lang="ts">
	import { Eye, Code, FileText, ExternalLink, AlertTriangle, CheckCircle, XCircle } from 'lucide-svelte';
	import { Card } from '$lib/components/ui';

	interface Props {
		sourceUrl?: string | null;
		sourceHtml?: string | null;
		sourcePlainText?: string | null;
		extractionConfidence?: number | null;
		extractedFields?: Record<string, { value: string; highlighted?: boolean }>;
		onFieldAnnotate?: (fieldName: string, annotation: string) => void;
		onFieldRemove?: (fieldName: string) => void;
	}

	let {
		sourceUrl = null,
		sourceHtml = null,
		sourcePlainText = null,
		extractionConfidence = null,
		extractedFields = {},
		onFieldAnnotate,
		onFieldRemove
	}: Props = $props();

	let viewMode = $state<'text' | 'html'>('text');
	let showAnnotateModal = $state(false);
	let annotatingField = $state<string | null>(null);
	let annotationText = $state('');

	function getConfidenceColor(confidence: number): string {
		if (confidence >= 0.8) return 'text-success-500';
		if (confidence >= 0.5) return 'text-warning-500';
		return 'text-error-500';
	}

	function getConfidenceLabel(confidence: number): string {
		if (confidence >= 0.8) return 'High';
		if (confidence >= 0.5) return 'Medium';
		return 'Low';
	}

	function highlightText(text: string, values: string[]): string {
		let result = text;
		for (const value of values) {
			if (value && value.length > 2) {
				// Escape special regex characters
				const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				const regex = new RegExp(`(${escaped})`, 'gi');
				result = result.replace(regex, '<mark class="bg-primary-200 dark:bg-primary-800 px-0.5 rounded">$1</mark>');
			}
		}
		return result;
	}

	const highlightedText = $derived(() => {
		if (!sourcePlainText) return '';
		const fieldValues = Object.values(extractedFields)
			.filter(f => f.highlighted !== false)
			.map(f => f.value);
		return highlightText(sourcePlainText, fieldValues);
	});

	function openAnnotateModal(fieldName: string) {
		annotatingField = fieldName;
		annotationText = '';
		showAnnotateModal = true;
	}

	function submitAnnotation() {
		if (annotatingField && annotationText && onFieldAnnotate) {
			onFieldAnnotate(annotatingField, annotationText);
		}
		showAnnotateModal = false;
		annotatingField = null;
		annotationText = '';
	}

	function handleRemoveField(fieldName: string) {
		if (onFieldRemove) {
			onFieldRemove(fieldName);
		}
	}
</script>

<Card variant="outlined" padding="md">
	<div class="space-y-4">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Eye class="h-5 w-5 text-primary-500" />
				<h3 class="font-semibold">Source Evidence</h3>
			</div>
			{#if extractionConfidence !== null}
				<div class="flex items-center gap-2">
					<span class="text-xs text-surface-500">Extraction Confidence:</span>
					<span class="flex items-center gap-1 text-sm font-medium {getConfidenceColor(extractionConfidence)}">
						{#if extractionConfidence >= 0.8}
							<CheckCircle class="h-4 w-4" />
						{:else if extractionConfidence >= 0.5}
							<AlertTriangle class="h-4 w-4" />
						{:else}
							<XCircle class="h-4 w-4" />
						{/if}
						{getConfidenceLabel(extractionConfidence)} ({Math.round(extractionConfidence * 100)}%)
					</span>
				</div>
			{/if}
		</div>

		<!-- Source URL -->
		{#if sourceUrl}
			<div class="flex items-center gap-2 text-sm">
				<ExternalLink class="h-4 w-4 text-surface-400" />
				<a href={sourceUrl} target="_blank" rel="noopener noreferrer" class="text-primary-500 hover:underline truncate">
					{sourceUrl}
				</a>
			</div>
		{/if}

		<!-- Extracted Fields -->
		{#if Object.keys(extractedFields).length > 0}
			<div class="border-t border-surface-300-700 pt-4">
				<p class="text-xs font-medium text-surface-500 mb-2">Extracted Fields</p>
				<div class="space-y-2">
					{#each Object.entries(extractedFields) as [fieldName, field]}
						<div class="flex items-center justify-between rounded-lg bg-surface-100-900 px-3 py-2">
							<div class="min-w-0 flex-1">
								<span class="text-xs text-surface-500">{fieldName}</span>
								<p class="text-sm font-medium truncate">{field.value}</p>
							</div>
							{#if onFieldAnnotate || onFieldRemove}
								<div class="flex items-center gap-1 ml-2">
									{#if onFieldAnnotate}
										<button
											onclick={() => openAnnotateModal(fieldName)}
											class="btn btn-sm preset-outlined-surface-500"
											title="Annotate field"
										>
											Edit
										</button>
									{/if}
									{#if onFieldRemove}
										<button
											onclick={() => handleRemoveField(fieldName)}
											class="btn btn-sm preset-outlined-error-500"
											title="Remove field"
										>
											<XCircle class="h-3 w-3" />
										</button>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- View Mode Toggle -->
		{#if sourcePlainText || sourceHtml}
			<div class="flex items-center gap-2 border-t border-surface-300-700 pt-4">
				<button
					onclick={() => viewMode = 'text'}
					class="btn btn-sm {viewMode === 'text' ? 'preset-filled-primary-500' : 'preset-outlined-surface-500'}"
				>
					<FileText class="mr-1 h-3 w-3" />
					Text
				</button>
				{#if sourceHtml}
					<button
						onclick={() => viewMode = 'html'}
						class="btn btn-sm {viewMode === 'html' ? 'preset-filled-primary-500' : 'preset-outlined-surface-500'}"
					>
						<Code class="mr-1 h-3 w-3" />
						HTML
					</button>
				{/if}
			</div>

			<!-- Content View -->
			<div class="rounded-lg border border-surface-300-700 bg-surface-50-950 p-4 max-h-96 overflow-auto">
				{#if viewMode === 'text' && sourcePlainText}
					<div class="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm">
						{@html highlightedText()}
					</div>
				{:else if viewMode === 'html' && sourceHtml}
					<pre class="text-xs overflow-auto whitespace-pre-wrap">{sourceHtml}</pre>
				{:else}
					<p class="text-surface-500 text-sm italic">No source content available</p>
				{/if}
			</div>
		{/if}
	</div>
</Card>

<!-- Annotate Modal -->
{#if showAnnotateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="w-full max-w-md rounded-lg bg-surface-50-950 p-6 shadow-xl">
			<h3 class="text-lg font-semibold mb-4">Annotate Field: {annotatingField}</h3>
			<div class="space-y-4">
				<div>
					<label for="annotation" class="block text-sm font-medium mb-1">Annotation/Correction</label>
					<textarea
						id="annotation"
						bind:value={annotationText}
						rows={3}
						class="textarea w-full"
						placeholder="Enter correction or annotation..."
					></textarea>
				</div>
				<div class="flex justify-end gap-2">
					<button onclick={() => showAnnotateModal = false} class="btn preset-outlined-surface-500">
						Cancel
					</button>
					<button onclick={submitAnnotation} class="btn preset-filled-primary-500" disabled={!annotationText.trim()}>
						Save Annotation
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
