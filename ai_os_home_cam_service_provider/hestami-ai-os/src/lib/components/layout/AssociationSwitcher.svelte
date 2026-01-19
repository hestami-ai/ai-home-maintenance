<script lang="ts">
	import { ChevronDown, Building2, Check } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { orpc } from '$lib/api/orpc';
	import { associationStore } from '$lib/stores/association';
	
	interface Association {
		id: string;
		name: string;
		status: string;
	}

	interface Props {
		currentAssociation: Association | null;
		associations: Association[];
	}

	let { currentAssociation, associations = [] }: Props = $props();

	// Safe associations access for navigation transitions
	const safeAssociations = $derived(Array.isArray(associations) ? associations : []);

	let isOpen = $state(false);
	let isSwitching = $state(false);

	function toggleDropdown() {
		isOpen = !isOpen;
	}

	function closeDropdown() {
		isOpen = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (isOpen && event.key === 'Escape') {
			closeDropdown();
		}
	}

	onMount(() => {
		document.addEventListener('keydown', handleKeydown);
		return () => document.removeEventListener('keydown', handleKeydown);
	});

	const hasMultiple = $derived(safeAssociations.length > 1);

	/**
	 * Switch to a different association.
	 * Calls oRPC to persist the preference in the database, then reloads the page.
	 */
	async function switchAssociation(associationId: string) {
		if (isSwitching) return;
		isSwitching = true;
		closeDropdown();

		try {
			// Call oRPC to set the default association in the database
			const result = await orpc.association.setDefault({ idempotencyKey: crypto.randomUUID(), associationId });

			if (result.ok) {
				// Update the store immediately for optimistic UI
				const newAssociation = safeAssociations.find(a => a.id === associationId);
				if (newAssociation) {
					associationStore.setCurrent(newAssociation as any);
				}
				// Reload to get fresh server data with new association context
				window.location.reload();
			}
		} catch (err) {
			console.error('Failed to switch association:', err);
			isSwitching = false;
		}
	}
</script>

{#if currentAssociation}
	<div class="relative">
		<button
			type="button"
			onclick={toggleDropdown}
			class="btn preset-tonal-surface flex items-center gap-2"
			class:cursor-default={!hasMultiple}
			disabled={!hasMultiple}
			aria-expanded={isOpen}
			aria-haspopup="true"
		>
			<Building2 class="h-4 w-4 text-primary-500" />
			<span class="max-w-40 truncate text-sm font-medium">
				{currentAssociation.name}
			</span>
			{#if hasMultiple}
				<ChevronDown class="h-4 w-4 transition-transform {isOpen ? 'rotate-180' : ''}" />
			{/if}
		</button>

		{#if isOpen && hasMultiple}
			<!-- Backdrop -->
			<button
				type="button"
				class="fixed inset-0 z-40"
				onclick={closeDropdown}
				aria-label="Close menu"
			></button>

			<!-- Dropdown -->
			<div
				class="preset-outlined-surface-200-800 absolute right-0 z-50 mt-2 w-72 rounded-lg bg-surface-100-900 shadow-xl"
			>
				<div class="p-2">
					<p class="px-3 py-2 text-xs font-semibold uppercase text-surface-500">
						Switch Association
					</p>

					{#each safeAssociations as association}
						{@const isSelected = association.id === currentAssociation?.id}
						<button
							type="button"
							onclick={() => switchAssociation(association.id)}
							disabled={isSelected || isSwitching}
							class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-surface-200-800 disabled:opacity-50 disabled:cursor-default"
						>
							<Building2 class="h-4 w-4 flex-shrink-0 text-surface-500" />
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2">
									<span class="truncate font-medium">{association.name}</span>
									{#if isSelected}
										<Check class="h-4 w-4 text-success-500 flex-shrink-0" />
									{/if}
								</div>
								<p class="text-xs text-surface-500">{association.status}</p>
							</div>
						</button>
					{/each}

					{#if safeAssociations.length === 0}
						<p class="px-3 py-4 text-center text-sm text-surface-500">No associations available</p>
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}
