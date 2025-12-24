<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Inbox } from 'lucide-svelte';

	interface Props {
		title: string;
		description?: string;
		actions?: Snippet;
	}

	let { title, description, actions }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center py-12 text-center">
	<div class="mb-4 rounded-full bg-surface-200-800 p-4">
		<Inbox class="h-8 w-8 text-surface-500" />
	</div>
	<h3 class="text-lg font-semibold">{title}</h3>
	{#if description}
		<p class="mt-1 max-w-sm text-sm text-surface-500">{description}</p>
	{/if}
	{#if actions}
		<div class="mt-6">
			{@render actions()}
		</div>
	{/if}
</div>
