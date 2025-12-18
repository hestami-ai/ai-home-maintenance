<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Tab {
		id: string;
		label: string;
		content: Snippet;
		badge?: number;
	}

	interface Props {
		tabs: Tab[];
		activeTab?: string;
		onTabChange?: (tabId: string) => void;
		lazyLoad?: boolean;
	}

	let { tabs, activeTab, onTabChange, lazyLoad = false }: Props = $props();

	let currentTab = $derived(activeTab ?? tabs[0]?.id ?? '');
	
	// Track which tabs have been visited for lazy loading
	let visitedTabs = $state<Set<string>>(new Set());
	
	// Initialize with first tab when tabs change
	$effect(() => {
		if (tabs[0]?.id && !visitedTabs.has(tabs[0].id)) {
			visitedTabs.add(tabs[0].id);
		}
	});

	function selectTab(tabId: string) {
		visitedTabs.add(tabId);
		onTabChange?.(tabId);
	}

	// Check if a tab should render its content
	function shouldRenderTab(tabId: string): boolean {
		if (!lazyLoad) {
			// Without lazy load, only render current tab
			return tabId === currentTab;
		}
		// With lazy load, render if visited (keeps content in DOM)
		return visitedTabs.has(tabId);
	}
</script>

<div class="flex h-full flex-col">
	<div class="flex-shrink-0 border-b border-surface-300-700">
		<nav class="-mb-px flex space-x-4 px-6" aria-label="Tabs">
			{#each tabs as tab}
				<button
					type="button"
					onclick={() => selectTab(tab.id)}
					class="whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors"
					class:border-primary-500={currentTab === tab.id}
					class:text-primary-500={currentTab === tab.id}
					class:border-transparent={currentTab !== tab.id}
					class:text-surface-500={currentTab !== tab.id}
					class:hover:border-surface-300-700={currentTab !== tab.id}
					class:hover:text-surface-700-300={currentTab !== tab.id}
				>
					{tab.label}
					{#if tab.badge !== undefined && tab.badge > 0}
						<span class="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-500 px-1.5 text-xs font-medium text-white">
							{tab.badge > 99 ? '99+' : tab.badge}
						</span>
					{/if}
				</button>
			{/each}
		</nav>
	</div>

	<div class="flex-1 overflow-y-auto p-6">
		{#each tabs as tab}
			{#if shouldRenderTab(tab.id)}
				<div class:hidden={tab.id !== currentTab}>
					{@render tab.content()}
				</div>
			{/if}
		{/each}
	</div>
</div>
