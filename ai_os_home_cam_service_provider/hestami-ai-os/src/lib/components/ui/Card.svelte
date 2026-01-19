<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'default' | 'outlined' | 'elevated' | 'filled';
		padding?: 'none' | 'sm' | 'md' | 'lg';
		class?: string;
		children: Snippet;
	}

	let { variant = 'default', padding = 'md', class: className = '', children }: Props = $props();

	const variantClasses = {
		default: 'bg-surface-100-900',
		outlined: 'bg-surface-100-900 border border-surface-300-700',
		elevated: 'bg-surface-100-900 shadow-lg',
		filled: 'bg-surface-200-800'
	};

	const paddingClasses = {
		none: '',
		sm: 'p-3',
		md: 'p-4 sm:p-6',
		lg: 'p-6 sm:p-8'
	};
</script>

<div class="rounded-lg {variantClasses[variant]} {paddingClasses[padding]} {className}">
	{@render children()}
</div>
