<script lang="ts">
	import { AlertTriangle, AlertCircle, Minus, ChevronDown, Flame } from 'lucide-svelte';
	import type { ConciergeCasePriority } from '$lib/api/cam';

	interface Props {
		priority: ConciergeCasePriority;
		showLabel?: boolean;
		size?: 'sm' | 'md' | 'lg';
	}

	let { priority, showLabel = true, size = 'md' }: Props = $props();

	const priorityConfig: Record<ConciergeCasePriority, { label: string; color: string; icon: typeof AlertTriangle }> = {
		LOW: { label: 'Low', color: 'text-surface-500', icon: ChevronDown },
		NORMAL: { label: 'Normal', color: 'text-blue-500', icon: Minus },
		HIGH: { label: 'High', color: 'text-amber-500', icon: AlertCircle },
		URGENT: { label: 'Urgent', color: 'text-orange-500', icon: AlertTriangle },
		EMERGENCY: { label: 'Emergency', color: 'text-red-500', icon: Flame }
	};

	const config = $derived(priorityConfig[priority] || priorityConfig.NORMAL);
	const PriorityIcon = $derived(config.icon);

	const sizeClasses = {
		sm: 'text-xs gap-1',
		md: 'text-sm gap-1.5',
		lg: 'text-base gap-2'
	};

	const iconSizes = {
		sm: 12,
		md: 14,
		lg: 16
	};
</script>

<span class="inline-flex items-center font-medium {config.color} {sizeClasses[size]}">
	<PriorityIcon size={iconSizes[size]} />
	{#if showLabel}
		{config.label}
	{/if}
</span>
