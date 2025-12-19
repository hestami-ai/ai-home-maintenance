<script lang="ts">
	import type { ConciergeCaseStatus } from '$lib/api/cam';

	interface Props {
		status: ConciergeCaseStatus;
		size?: 'sm' | 'md' | 'lg';
	}

	let { status, size = 'md' }: Props = $props();

	const statusConfig: Record<ConciergeCaseStatus, { label: string; color: string }> = {
		INTAKE: { label: 'Intake', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
		ASSESSMENT: { label: 'Assessment', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
		IN_PROGRESS: { label: 'In Progress', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
		PENDING_EXTERNAL: { label: 'Pending External', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
		PENDING_OWNER: { label: 'Pending Owner', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
		ON_HOLD: { label: 'On Hold', color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20' },
		RESOLVED: { label: 'Resolved', color: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' },
		CLOSED: { label: 'Closed', color: 'bg-surface-500/10 text-surface-600 dark:text-surface-400 border-surface-500/20' },
		CANCELLED: { label: 'Cancelled', color: 'bg-surface-500/10 text-surface-500 border-surface-500/20' }
	};

	const config = $derived(statusConfig[status] || statusConfig.INTAKE);

	const sizeClasses = {
		sm: 'px-2 py-0.5 text-xs',
		md: 'px-2.5 py-1 text-sm',
		lg: 'px-3 py-1.5 text-sm'
	};
</script>

<span
	class="inline-flex items-center rounded-full border font-medium {config.color} {sizeClasses[size]}"
>
	{config.label}
</span>
