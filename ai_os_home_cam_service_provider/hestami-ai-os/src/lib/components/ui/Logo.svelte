<script lang="ts">
	interface Props {
		size?: 'sm' | 'md' | 'lg';
		showText?: boolean;
	}

	let { size = 'md', showText = true }: Props = $props();

	const sizeClasses = {
		sm: 'h-6 w-6',
		md: 'h-8 w-8',
		lg: 'h-10 w-10'
	};

	const textClasses = {
		sm: 'text-lg',
		md: 'text-xl',
		lg: 'text-2xl'
	};
</script>

<a href="/" class="flex items-center gap-2 no-underline">
	<div
		class="flex items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-secondary-500 {sizeClasses[
			size
		]}"
	>
		<span class="font-bold text-white" class:text-sm={size === 'sm'} class:text-base={size === 'md'} class:text-lg={size === 'lg'}>H</span>
	</div>
	{#if showText}
		<span class="font-semibold {textClasses[size]}">Hestami</span>
	{/if}
</a>
