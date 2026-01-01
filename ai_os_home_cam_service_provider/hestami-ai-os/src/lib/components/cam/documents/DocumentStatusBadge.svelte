<script lang="ts">
	import {
		Loader2,
		Clock,
		AlertTriangle,
		CheckCircle2,
		Archive,
		History,
		ShieldAlert,
		FileEdit,
		FileQuestion
	} from 'lucide-svelte';
	import type { operations } from '$lib/api/types.generated';

	type DocumentStatus = operations['document.listDocuments']['responses']['200']['content']['application/json']['data']['documents'][number]['status'];

	interface Props {
		status: DocumentStatus;
		processingAttemptCount?: number;
		processingErrorType?: string | null;
		size?: 'sm' | 'md' | 'lg';
		showLabel?: boolean;
		showTooltip?: boolean;
	}

	let { 
		status, 
		processingAttemptCount = 0, 
		processingErrorType = null,
		size = 'md',
		showLabel = true,
		showTooltip = true
	}: Props = $props();

	// In a real app, we might get this from context or a store
	const MAX_RETRY_ATTEMPTS = 3;

	const isProcessingFailedExhausted = $derived(
		status === 'PROCESSING_FAILED' && 
		(processingErrorType === 'PERMANENT' || processingAttemptCount >= MAX_RETRY_ATTEMPTS)
	);

	const isProcessingFailedRetrying = $derived(
		status === 'PROCESSING_FAILED' && !isProcessingFailedExhausted
	);

	const statusConfigs: Record<string, { label: string; color: string; icon: any; tooltip: string }> = {
		PENDING_UPLOAD: { 
			label: 'Awaiting Upload', 
			color: 'bg-surface-500/10 text-surface-600 dark:text-surface-400 border-surface-500/20',
			icon: Clock,
			tooltip: 'Waiting for file upload to complete'
		},
		PROCESSING: { 
			label: 'Processing', 
			color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
			icon: Loader2,
			tooltip: 'File is being scanned and processed'
		},
		PROCESSING_FAILED_RETRYING: { 
			label: 'Retrying', 
			color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
			icon: Clock,
			tooltip: 'Processing delayed, retrying automatically...'
		},
		PROCESSING_FAILED_EXHAUSTED: { 
			label: 'Failed', 
			color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
			icon: AlertTriangle,
			tooltip: 'Processing failed. Please try uploading again.'
		},
		INFECTED: { 
			label: 'Security Risk', 
			color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
			icon: ShieldAlert,
			tooltip: 'File flagged as potentially harmful and rejected'
		},
		ACTIVE: { 
			label: 'Ready', 
			color: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
			icon: CheckCircle2,
			tooltip: 'Document is ready for use'
		},
		SUPERSEDED: { 
			label: 'Superseded', 
			color: 'bg-surface-500/10 text-surface-500 border-surface-500/20',
			icon: History,
			tooltip: 'Replaced by a newer version'
		},
		ARCHIVED: { 
			label: 'Archived', 
			color: 'bg-surface-500/10 text-surface-500 border-surface-500/20',
			icon: Archive,
			tooltip: 'Document has been archived'
		},
		DRAFT: { 
			label: 'Draft', 
			color: 'bg-surface-500/10 text-surface-500 border-surface-500/20',
			icon: FileEdit,
			tooltip: 'Document is in draft status'
		}
	};

	const currentStatusKey = $derived(() => {
		if (isProcessingFailedExhausted) return 'PROCESSING_FAILED_EXHAUSTED';
		if (isProcessingFailedRetrying) return 'PROCESSING_FAILED_RETRYING';
		return status;
	});

	const config = $derived(statusConfigs[currentStatusKey()] || {
		label: status,
		color: 'bg-surface-500/10 text-surface-500 border-surface-500/20',
		icon: FileQuestion,
		tooltip: `Status: ${status}`
	});

	const sizeClasses = {
		sm: 'px-1.5 py-0.5 text-[10px] gap-1',
		md: 'px-2 py-0.5 text-xs gap-1.5',
		lg: 'px-2.5 py-1 text-sm gap-2'
	};

	const iconSizes = {
		sm: 'h-3 w-3',
		md: 'h-3.5 w-3.5',
		lg: 'h-4 w-4'
	};
</script>

<span
	class="inline-flex items-center rounded-full border font-medium {config.color} {sizeClasses[size]}"
	title={showTooltip ? config.tooltip : undefined}
>
	<config.icon class="{iconSizes[size]} {status === 'PROCESSING' ? 'animate-spin' : ''}" />
	{#if showLabel}
		{config.label}
	{/if}
</span>
