<script lang="ts">
	import { Loader2 } from 'lucide-svelte';

	interface Props {
		size?: 'sm' | 'md' | 'lg';
		text?: string;
	}

	let { size = 'md', text }: Props = $props();

	const sizeClasses = {
		sm: 'h-4 w-4',
		md: 'h-6 w-6',
		lg: 'h-8 w-8'
	};
</script>

<div class="flex items-center justify-center gap-2">
	<Loader2 class="{sizeClasses[size]} animate-spin text-primary-500" />
	{#if text}
		<span class="text-sm text-surface-500">{text}</span>
	{/if}
</div>
