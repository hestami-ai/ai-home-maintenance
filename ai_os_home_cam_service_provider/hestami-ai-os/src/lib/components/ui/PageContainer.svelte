<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
		padding?: boolean;
		children: Snippet;
	}

	let { maxWidth = 'xl', padding = true, children }: Props = $props();

	const maxWidthClasses = {
		sm: 'max-w-screen-sm',
		md: 'max-w-screen-md',
		lg: 'max-w-screen-lg',
		xl: 'max-w-screen-xl',
		'2xl': 'max-w-screen-2xl',
		full: 'max-w-full'
	};
</script>

<div class="mx-auto w-full {maxWidthClasses[maxWidth]}" class:px-4={padding} class:sm:px-6={padding} class:lg:px-8={padding}>
	{@render children()}
</div>
