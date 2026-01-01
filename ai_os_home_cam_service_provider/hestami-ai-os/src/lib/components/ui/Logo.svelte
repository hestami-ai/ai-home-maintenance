<script lang="ts">
	interface Props {
		size?: 'sm' | 'md' | 'lg';
		showText?: boolean;
		href?: string;
	}

	let { size = 'md', showText = true, href = '/' }: Props = $props();

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

<a href={href} class="flex items-center gap-2 no-underline">
	<div class="relative {sizeClasses[size]}">
		<!-- Light mode logo (default) -->
		<img 
			src="/hestami-ai-company-logo-transparent.png" 
			alt="Hestami AI" 
			class="absolute inset-0 h-full w-full object-contain dark:hidden"
		/>
		<!-- Dark mode logo -->
		<img 
			src="/hestami-ai-company-logo-light-w-green.png" 
			alt="Hestami AI" 
			class="absolute inset-0 h-full w-full object-contain hidden dark:block"
		/>
	</div>
	{#if showText}
		<span class="font-semibold {textClasses[size]}">Hestami</span>
	{/if}
</a>
