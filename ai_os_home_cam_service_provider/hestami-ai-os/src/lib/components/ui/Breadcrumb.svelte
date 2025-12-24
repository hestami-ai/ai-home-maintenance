<script lang="ts">
	import { ChevronRight, Home } from 'lucide-svelte';

	interface BreadcrumbItem {
		label: string;
		href?: string;
	}

	interface Props {
		items: BreadcrumbItem[];
		showHome?: boolean;
	}

	let { items, showHome = true }: Props = $props();
</script>

<nav aria-label="Breadcrumb" class="flex items-center gap-1 text-sm">
	{#if showHome}
		<a
			href="/app/admin"
			class="flex items-center gap-1 text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
		>
			<Home class="h-4 w-4" />
			<span class="sr-only">Home</span>
		</a>
		{#if items.length > 0}
			<ChevronRight class="h-4 w-4 text-surface-400" />
		{/if}
	{/if}

	{#each items as item, index}
		{#if index > 0}
			<ChevronRight class="h-4 w-4 text-surface-400" />
		{/if}

		{#if item.href && index < items.length - 1}
			<a
				href={item.href}
				class="text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 truncate max-w-[150px]"
			>
				{item.label}
			</a>
		{:else}
			<span class="font-medium text-surface-900 dark:text-surface-100 truncate max-w-[200px]">
				{item.label}
			</span>
		{/if}
	{/each}
</nav>
