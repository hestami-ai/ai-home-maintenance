<script lang="ts">
	import { X, Search, User, Users, Check, Loader2 } from 'lucide-svelte';
	import { partyApi, type Party } from '$lib/api/cam';

	interface Props {
		open: boolean;
		title?: string;
		multiSelect?: boolean;
		partyType?: 'INDIVIDUAL' | 'TRUST' | 'CORPORATION' | 'LLC' | 'PARTNERSHIP' | 'ESTATE';
		onClose: () => void;
		onSelect: (selected: Party[]) => void;
	}

	let {
		open = $bindable(false),
		title = 'Select Party',
		multiSelect = false,
		partyType,
		onClose,
		onSelect
	}: Props = $props();

	let parties = $state<Party[]>([]);
	let isLoading = $state(false);
	let searchQuery = $state('');
	let selectedIds = $state<Set<string>>(new Set());
	let searchTimeout: any;

	async function loadParties() {
		isLoading = true;
		try {
			const response = await partyApi.list({
				search: searchQuery || undefined,
				partyType: (partyType as any) || undefined,
				limit: 20
			});
			if (response.ok && response.data?.parties) {
				parties = response.data.parties;
			}
		} catch (error) {
			console.error('Failed to load parties:', error);
		} finally {
			isLoading = false;
		}
	}

	function handleSearchInput() {
		if (searchTimeout) clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			loadParties();
		}, 300);
	}

	function toggleSelection(party: Party) {
		if (multiSelect) {
			const next = new Set(selectedIds);
			if (next.has(party.id)) {
				next.delete(party.id);
			} else {
				next.add(party.id);
			}
			selectedIds = next;
		} else {
			onSelect([party]);
			open = false;
		}
	}

	function handleConfirm() {
		const selected = parties.filter((p) => selectedIds.has(p.id));
		onSelect(selected);
		open = false;
	}

	function handleCancel() {
		open = false;
		onClose();
	}

	$effect(() => {
		if (open) {
			loadParties();
		} else {
			searchQuery = '';
			selectedIds = new Set();
		}
	});
</script>

{#if open}
	<div class="fixed inset-0 z-[60] flex items-center justify-center">
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick={handleCancel}></div>

		<div class="relative z-10 flex h-full max-h-[600px] w-full max-w-lg flex-col rounded-xl border border-surface-300-700 bg-surface-50-950 shadow-2xl">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-surface-300-700 px-6 py-4">
				<div>
					<h2 class="text-lg font-semibold">{title}</h2>
					<p class="text-sm text-surface-500">
						{multiSelect ? 'Select one or more parties' : 'Search and select a party'}
					</p>
				</div>
				<button
					type="button"
					onclick={handleCancel}
					class="rounded-lg p-2 text-surface-500 transition-colors hover:bg-surface-200-800"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<!-- Search -->
			<div class="border-b border-surface-300-700 p-4">
				<div class="relative">
					<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
					<input
						type="text"
						placeholder="Search by name or email..."
						bind:value={searchQuery}
						oninput={handleSearchInput}
						class="w-full rounded-lg border border-surface-300-700 bg-surface-100-900 py-2 pl-9 pr-3 text-sm placeholder:text-surface-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					/>
				</div>
			</div>

			<!-- List -->
			<div class="flex-1 overflow-y-auto p-2">
				{#if isLoading && parties.length === 0}
					<div class="flex h-32 items-center justify-center">
						<Loader2 class="h-6 w-6 animate-spin text-primary-500" />
					</div>
				{:else if parties.length === 0}
					<div class="flex h-32 flex-col items-center justify-center text-surface-500">
						<Users class="mb-2 h-8 w-8 opacity-20" />
						<p>No parties found</p>
					</div>
				{:else}
					<div class="space-y-1">
						{#each parties as party}
							{@const selected = selectedIds.has(party.id)}
							<button
								type="button"
								onclick={() => toggleSelection(party)}
								class="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-surface-200-800 {selected
									? 'bg-primary-500/10 ring-1 ring-primary-500'
									: ''}"
							>
								<div
									class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full {party.partyType ===
									'INDIVIDUAL'
										? 'bg-blue-500/10 text-blue-500'
										: 'bg-amber-500/10 text-amber-500'}"
								>
									{#if party.partyType === 'INDIVIDUAL'}
										<User class="h-5 w-5" />
									{:else}
										<Users class="h-5 w-5" />
									{/if}
								</div>
								<div class="min-w-0 flex-1">
									<p class="truncate font-medium">{party.displayName}</p>
									<p class="truncate text-sm text-surface-500">{party.email || 'No email'}</p>
								</div>
								{#if selected}
									<Check class="h-5 w-5 text-primary-500" />
								{/if}
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Footer (only for multiSelect) -->
			{#if multiSelect}
				<div class="flex items-center justify-between border-t border-surface-300-700 px-6 py-4">
					<p class="text-sm text-surface-500">
						{selectedIds.size} selected
					</p>
					<div class="flex gap-3">
						<button type="button" onclick={handleCancel} class="btn btn-sm preset-tonal-surface">
							Cancel
						</button>
						<button
							type="button"
							onclick={handleConfirm}
							disabled={selectedIds.size === 0}
							class="btn btn-sm preset-filled-primary-500"
						>
							Select Parties
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
