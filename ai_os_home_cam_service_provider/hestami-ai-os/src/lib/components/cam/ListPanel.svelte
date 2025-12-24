<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Loader2, ChevronLeft, ChevronRight, Square, CheckSquare, Minus } from 'lucide-svelte';
	import { EmptyState } from '$lib/components/ui';

	interface Props {
		header?: Snippet;
		items: Snippet;
		loading?: boolean;
		emptyTitle?: string;
		emptyDescription?: string;
		// Pagination props
		hasNextPage?: boolean;
		hasPrevPage?: boolean;
		onNextPage?: () => void;
		onPrevPage?: () => void;
		pageInfo?: string;
		loadingMore?: boolean;
		// Bulk selection props
		bulkSelection?: boolean;
		selectedCount?: number;
		totalCount?: number;
		onSelectAll?: () => void;
		onDeselectAll?: () => void;
		bulkActions?: Snippet;
	}

	let {
		header,
		items,
		loading = false,
		emptyTitle = 'No items found',
		emptyDescription = 'There are no items to display.',
		hasNextPage = false,
		hasPrevPage = false,
		onNextPage,
		onPrevPage,
		pageInfo,
		loadingMore = false,
		bulkSelection = false,
		selectedCount = 0,
		totalCount = 0,
		onSelectAll,
		onDeselectAll,
		bulkActions
	}: Props = $props();

	const showPagination = $derived(hasNextPage || hasPrevPage || pageInfo);
	const showBulkBar = $derived(bulkSelection && selectedCount > 0);
	const allSelected = $derived(selectedCount > 0 && selectedCount === totalCount);
	const someSelected = $derived(selectedCount > 0 && selectedCount < totalCount);
</script>

<div class="flex h-full flex-col">
	{#if header}
		<div class="flex-shrink-0 border-b border-surface-300-700 bg-surface-50-950 p-4">
			{@render header()}
		</div>
	{/if}

	{#if showBulkBar}
		<div class="flex-shrink-0 border-b border-primary-500/30 bg-primary-500/10 px-4 py-2">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<button
						type="button"
						onclick={allSelected ? onDeselectAll : onSelectAll}
						class="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700"
					>
						{#if allSelected}
							<CheckSquare class="h-4 w-4" />
						{:else if someSelected}
							<Minus class="h-4 w-4" />
						{:else}
							<Square class="h-4 w-4" />
						{/if}
					</button>
					<span class="text-sm font-medium">
						{selectedCount} of {totalCount} selected
					</span>
					<button
						type="button"
						onclick={onDeselectAll}
						class="text-sm text-surface-500 hover:text-surface-700"
					>
						Clear
					</button>
				</div>
				{#if bulkActions}
					<div class="flex items-center gap-2">
						{@render bulkActions()}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<div class="flex-1 overflow-y-auto">
		{#if loading}
			<div class="flex h-full items-center justify-center py-12">
				<Loader2 class="h-6 w-6 animate-spin text-primary-500" />
			</div>
		{:else}
			{@render items()}
		{/if}
	</div>

	{#if showPagination && !loading}
		<div class="flex-shrink-0 border-t border-surface-300-700 bg-surface-50-950 px-4 py-2">
			<div class="flex items-center justify-between">
				<button
					type="button"
					class="flex items-center gap-1 rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 {hasPrevPage ? 'text-primary-500 hover:bg-primary-500/10' : 'text-surface-400'}"
					disabled={!hasPrevPage || loadingMore}
					onclick={onPrevPage}
				>
					<ChevronLeft class="h-4 w-4" />
					Previous
				</button>

				<div class="flex items-center gap-2">
					{#if loadingMore}
						<Loader2 class="h-4 w-4 animate-spin text-primary-500" />
					{/if}
					{#if pageInfo}
						<span class="text-sm text-surface-500">{pageInfo}</span>
					{/if}
				</div>

				<button
					type="button"
					class="flex items-center gap-1 rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 {hasNextPage ? 'text-primary-500 hover:bg-primary-500/10' : 'text-surface-400'}"
					disabled={!hasNextPage || loadingMore}
					onclick={onNextPage}
				>
					Next
					<ChevronRight class="h-4 w-4" />
				</button>
			</div>
		</div>
	{/if}
</div>
