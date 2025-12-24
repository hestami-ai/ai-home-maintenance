<script lang="ts">
	import { FileText, Download, Image, File } from 'lucide-svelte';
	import { EmptyState } from '$lib/components/ui';
	import type { ConciergeCaseDetail } from '$lib/api/cam';

	interface Props {
		caseDetail: ConciergeCaseDetail;
	}

	let { caseDetail }: Props = $props();

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function getFileIcon(mimeType: string) {
		if (mimeType.startsWith('image/')) return Image;
		return File;
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-medium text-surface-500 uppercase tracking-wide">
			Documents & Attachments
		</h3>
	</div>

	{#if caseDetail.attachments.length === 0}
		<EmptyState
			title="No documents"
			description="Documents and attachments related to this case will appear here."
		>
			{#snippet actions()}
				<button class="btn preset-outlined-primary-500">
					<FileText size={16} class="mr-2" />
					Upload Document
				</button>
			{/snippet}
		</EmptyState>
	{:else}
		<div class="space-y-3">
			{#each caseDetail.attachments as attachment}
				{@const FileIcon = getFileIcon(attachment.mimeType)}
				<div class="flex items-center justify-between rounded-lg border border-surface-300-700 p-4">
					<div class="flex items-center gap-3">
						<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-100-900">
							<FileIcon size={20} class="text-surface-500" />
						</div>
						<div>
							<p class="font-medium">{attachment.fileName}</p>
							<p class="text-sm text-surface-500">
								{formatFileSize(attachment.fileSize)} • {formatDate(attachment.createdAt)}
							</p>
						</div>
					</div>
					<a
						href={attachment.fileUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="btn preset-outlined-surface-500 btn-sm"
					>
						<Download size={14} class="mr-1" />
						Download
					</a>
				</div>
			{/each}
		</div>
	{/if}
</div>
