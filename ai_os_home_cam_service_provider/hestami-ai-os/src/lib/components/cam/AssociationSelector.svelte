<script lang="ts">
	import { Building2, ChevronDown, Check } from 'lucide-svelte';
	import { camStore, currentAssociation, hasMultipleAssociations } from '$lib/stores';
	import type { Association } from '$lib/stores';

	let isOpen = $state(false);
	let dropdownRef: HTMLDivElement | null = $state(null);

	function selectAssociation(association: Association) {
		camStore.setCurrentAssociation(association);
		isOpen = false;
	}

	function toggleDropdown() {
		isOpen = !isOpen;
	}

	function handleClickOutside(event: MouseEvent) {
		if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
			isOpen = false;
		}
	}

	$effect(() => {
		if (isOpen) {
			document.addEventListener('click', handleClickOutside);
			return () => document.removeEventListener('click', handleClickOutside);
		}
	});
</script>

{#if $currentAssociation}
	<div class="relative" bind:this={dropdownRef}>
		<button
			type="button"
			onclick={toggleDropdown}
			class="flex w-full items-center gap-2 rounded-lg border border-surface-300-700 bg-surface-100-900 px-3 py-2 text-left transition-colors hover:bg-surface-200-800"
			class:cursor-default={!$hasMultipleAssociations}
			disabled={!$hasMultipleAssociations}
		>
			<Building2 class="h-4 w-4 flex-shrink-0 text-primary-500" />
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm font-medium">{$currentAssociation.name}</p>
				<p class="truncate text-xs text-surface-500">
					{$currentAssociation.status}
				</p>
			</div>
			{#if $hasMultipleAssociations}
				<ChevronDown
					class="h-4 w-4 flex-shrink-0 text-surface-500 transition-transform {isOpen ? 'rotate-180' : ''}"
				/>
			{/if}
		</button>

		{#if isOpen && $hasMultipleAssociations}
			<div
				class="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-surface-300-700 bg-surface-100-900 py-1 shadow-lg"
			>
				{#each $camStore.associations as association}
					{@const isSelected = association.id === $currentAssociation?.id}
					<button
						type="button"
						onclick={() => selectAssociation(association)}
						class="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-200-800 {isSelected ? 'bg-primary-500/10' : ''}"
					>
						<Building2 class="h-4 w-4 flex-shrink-0 text-surface-500" />
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium">{association.name}</p>
							<p class="truncate text-xs text-surface-500">{association.status}</p>
						</div>
						{#if isSelected}
							<Check class="h-4 w-4 flex-shrink-0 text-primary-500" />
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>
{:else}
	<div class="rounded-lg border border-surface-300-700 bg-surface-100-900 px-3 py-2">
		<p class="text-sm text-surface-500">No association selected</p>
	</div>
{/if}
