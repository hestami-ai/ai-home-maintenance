<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Loader2, RefreshCw, Maximize2, X } from 'lucide-svelte';

	interface Props {
		title: string;
		icon?: Snippet;
		loading?: boolean;
		error?: string | null;
		onRefresh?: () => void;
		expandable?: boolean;
		children: Snippet;
		footer?: Snippet;
	}

	let {
		title,
		icon,
		loading = false,
		error = null,
		onRefresh,
		expandable = false,
		children,
		footer
	}: Props = $props();

	let isExpanded = $state(false);
</script>

<div class="rounded-lg border border-surface-300-700 bg-surface-100-900 {isExpanded ? 'fixed inset-4 z-50 overflow-auto' : ''}">
	<div class="flex items-center justify-between border-b border-surface-300-700 px-4 py-3">
		<div class="flex items-center gap-2">
			{#if icon}
				<div class="text-primary-500">
					{@render icon()}
				</div>
			{/if}
			<h3 class="font-semibold">{title}</h3>
		</div>
		<div class="flex items-center gap-1">
			{#if onRefresh}
				<button
					type="button"
					onclick={onRefresh}
					disabled={loading}
					class="rounded p-1 text-surface-400 transition-colors hover:bg-surface-200-800 hover:text-surface-600 disabled:opacity-50"
					title="Refresh"
				>
					<RefreshCw class="h-4 w-4 {loading ? 'animate-spin' : ''}" />
				</button>
			{/if}
			{#if expandable}
				<button
					type="button"
					onclick={() => isExpanded = !isExpanded}
					class="rounded p-1 text-surface-400 transition-colors hover:bg-surface-200-800 hover:text-surface-600"
					title={isExpanded ? 'Collapse' : 'Expand'}
				>
					{#if isExpanded}
						<X class="h-4 w-4" />
					{:else}
						<Maximize2 class="h-4 w-4" />
					{/if}
				</button>
			{/if}
		</div>
	</div>

	<div class="p-4">
		{#if loading}
			<div class="flex items-center justify-center py-8">
				<Loader2 class="h-6 w-6 animate-spin text-primary-500" />
			</div>
		{:else if error}
			<div class="rounded-lg bg-error-500/10 p-4 text-center text-sm text-error-500">
				{error}
			</div>
		{:else}
			{@render children()}
		{/if}
	</div>

	{#if footer && !loading && !error}
		<div class="border-t border-surface-300-700 px-4 py-2">
			{@render footer()}
		</div>
	{/if}
</div>

{#if isExpanded}
	<button
		type="button"
		class="fixed inset-0 z-40 bg-black/50"
		onclick={() => isExpanded = false}
		aria-label="Close expanded widget"
	></button>
{/if}
