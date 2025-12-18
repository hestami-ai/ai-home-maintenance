<script lang="ts">
	import { X, Loader2, Search } from 'lucide-svelte';

	interface Vendor {
		id: string;
		name: string;
		trades: string[];
		status: string;
	}

	interface Props {
		open: boolean;
		vendors?: Vendor[];
		loading?: boolean;
		onConfirm: (data: { vendorId: string; notes?: string }) => void;
		onCancel: () => void;
	}

	let {
		open,
		vendors = [],
		loading = false,
		onConfirm,
		onCancel
	}: Props = $props();

	let selectedVendorId = $state('');
	let notes = $state('');
	let searchQuery = $state('');
	let error = $state('');

	const filteredVendors = $derived(
		vendors.filter(v => 
			v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			v.trades.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
		)
	);

	const selectedVendor = $derived(vendors.find(v => v.id === selectedVendorId));

	function handleConfirm() {
		if (!selectedVendorId) {
			error = 'Please select a vendor.';
			return;
		}
		error = '';
		onConfirm({
			vendorId: selectedVendorId,
			notes: notes.trim() || undefined
		});
	}

	function handleCancel() {
		selectedVendorId = '';
		notes = '';
		searchQuery = '';
		error = '';
		onCancel();
	}

	$effect(() => {
		if (!open) {
			selectedVendorId = '';
			notes = '';
			searchQuery = '';
			error = '';
		}
	});
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<button
			type="button"
			class="absolute inset-0 bg-black/50"
			onclick={handleCancel}
			aria-label="Close modal"
		></button>

		<div class="relative z-10 w-full max-w-lg rounded-lg bg-surface-100-900 shadow-xl">
			<div class="flex items-center justify-between border-b border-surface-300-700 px-6 py-4">
				<h2 class="text-lg font-semibold">Assign Vendor</h2>
				<button
					type="button"
					onclick={handleCancel}
					class="rounded-lg p-1 text-surface-500 transition-colors hover:bg-surface-200-800 hover:text-surface-700-300"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<div class="space-y-4 p-6">
				<div>
					<label for="vendor-search" class="block text-sm font-medium">
						Select Vendor <span class="text-error-500">*</span>
					</label>
					<div class="relative mt-2">
						<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
						<input
							id="vendor-search"
							type="text"
							bind:value={searchQuery}
							placeholder="Search vendors by name or trade..."
							class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 py-2 pl-10 pr-3 text-sm placeholder:text-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
				</div>

				<div class="max-h-48 overflow-y-auto rounded-lg border border-surface-300-700">
					{#if filteredVendors.length === 0}
						<div class="p-4 text-center text-sm text-surface-500">
							No vendors found
						</div>
					{:else}
						{#each filteredVendors as vendor}
							<button
								type="button"
								class="flex w-full items-center gap-3 border-b border-surface-200-800 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-200-800 {selectedVendorId === vendor.id ? 'bg-primary-500/10' : ''}"
								onclick={() => selectedVendorId = vendor.id}
							>
								<div class="flex h-8 w-8 items-center justify-center rounded-full bg-surface-300-700 text-sm font-medium">
									{vendor.name.charAt(0)}
								</div>
								<div class="flex-1">
									<p class="font-medium">{vendor.name}</p>
									<p class="text-xs text-surface-500">{vendor.trades.join(', ')}</p>
								</div>
								{#if selectedVendorId === vendor.id}
									<div class="h-2 w-2 rounded-full bg-primary-500"></div>
								{/if}
							</button>
						{/each}
					{/if}
				</div>

				{#if selectedVendor}
					<div class="rounded-lg bg-primary-500/10 p-3">
						<p class="text-sm font-medium text-primary-600 dark:text-primary-400">
							Selected: {selectedVendor.name}
						</p>
					</div>
				{/if}

				<div>
					<label for="notes" class="block text-sm font-medium">
						Notes (Optional)
					</label>
					<textarea
						id="notes"
						bind:value={notes}
						rows={2}
						placeholder="Add any notes for the vendor assignment..."
						class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm placeholder:text-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					></textarea>
				</div>

				{#if error}
					<p class="text-sm text-error-500">{error}</p>
				{/if}
			</div>

			<div class="flex justify-end gap-3 border-t border-surface-300-700 px-6 py-4">
				<button
					type="button"
					onclick={handleCancel}
					disabled={loading}
					class="rounded-lg px-4 py-2 text-sm font-medium text-surface-700-300 transition-colors hover:bg-surface-200-800"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={handleConfirm}
					disabled={loading || !selectedVendorId}
					class="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if loading}
						<Loader2 class="h-4 w-4 animate-spin" />
					{/if}
					Assign Vendor
				</button>
			</div>
		</div>
	</div>
{/if}
