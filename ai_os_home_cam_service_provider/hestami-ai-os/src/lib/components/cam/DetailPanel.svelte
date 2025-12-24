<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		header?: Snippet;
		actions?: Snippet;
		content: Snippet;
	}

	let { header, actions, content }: Props = $props();
</script>

<div class="flex h-full flex-col">
	{#if header || actions}
		<div class="flex flex-shrink-0 items-center justify-between border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
			<div class="min-w-0 flex-1">
				{#if header}
					{@render header()}
				{/if}
			</div>
			{#if actions}
				<div class="ml-4 flex flex-shrink-0 items-center gap-2">
					{@render actions()}
				</div>
			{/if}
		</div>
	{/if}

	<div class="flex-1 overflow-y-auto">
		{@render content()}
	</div>
</div>
