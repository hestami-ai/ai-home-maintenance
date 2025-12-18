<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ChevronLeft } from 'lucide-svelte';

	interface Props {
		listPanel: Snippet;
		detailPanel: Snippet;
		emptyDetail?: Snippet;
		hasSelection?: boolean;
		listWidth?: string;
	}

	let {
		listPanel,
		detailPanel,
		emptyDetail,
		hasSelection = false,
		listWidth = 'w-80 lg:w-96'
	}: Props = $props();

	let showDetailOnMobile = $state(false);

	function showDetail() {
		showDetailOnMobile = true;
	}

	function hideDetail() {
		showDetailOnMobile = false;
	}

	$effect(() => {
		if (hasSelection && window.innerWidth < 1024) {
			showDetailOnMobile = true;
		}
	});
</script>

<div class="flex h-full">
	<div
		class="flex-shrink-0 border-r border-surface-300-700 {listWidth}"
		class:hidden={showDetailOnMobile}
		class:lg:block={showDetailOnMobile}
	>
		<div class="h-full overflow-y-auto">
			{@render listPanel()}
		</div>
	</div>

	<div
		class="flex-1"
		class:hidden={!showDetailOnMobile && !hasSelection}
		class:lg:block={true}
	>
		{#if hasSelection}
			<div class="flex h-full flex-col">
				<button
					type="button"
					onclick={hideDetail}
					class="flex items-center gap-2 border-b border-surface-300-700 px-4 py-2 text-sm text-surface-500 hover:text-surface-700-300 lg:hidden"
				>
					<ChevronLeft class="h-4 w-4" />
					Back to list
				</button>
				<div class="flex-1 overflow-y-auto">
					{@render detailPanel()}
				</div>
			</div>
		{:else if emptyDetail}
			<div class="flex h-full items-center justify-center">
				{@render emptyDetail()}
			</div>
		{:else}
			<div class="flex h-full items-center justify-center text-surface-500">
				<p>Select an item to view details</p>
			</div>
		{/if}
	</div>
</div>
