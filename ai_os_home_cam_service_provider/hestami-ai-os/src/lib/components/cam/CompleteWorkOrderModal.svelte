<script lang="ts">
	import { X, Loader2 } from 'lucide-svelte';

	interface Props {
		open: boolean;
		loading?: boolean;
		onConfirm: (data: { completedDate: string; actualCost?: number; notes?: string }) => void;
		onCancel: () => void;
	}

	let {
		open,
		loading = false,
		onConfirm,
		onCancel
	}: Props = $props();

	let completedDate = $state('');
	let actualCost = $state('');
	let notes = $state('');
	let error = $state('');

	function handleConfirm() {
		if (!completedDate) {
			error = 'Please select a completion date.';
			return;
		}
		error = '';
		onConfirm({
			completedDate,
			actualCost: actualCost ? parseFloat(actualCost) : undefined,
			notes: notes.trim() || undefined
		});
	}

	function handleCancel() {
		completedDate = '';
		actualCost = '';
		notes = '';
		error = '';
		onCancel();
	}

	// Set default to today
	$effect(() => {
		if (open && !completedDate) {
			completedDate = new Date().toISOString().split('T')[0];
		}
	});

	$effect(() => {
		if (!open) {
			completedDate = '';
			actualCost = '';
			notes = '';
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

		<div class="relative z-10 w-full max-w-md rounded-lg bg-surface-100-900 shadow-xl">
			<div class="flex items-center justify-between border-b border-surface-300-700 px-6 py-4">
				<h2 class="text-lg font-semibold">Complete Work Order</h2>
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
					<label for="completed-date" class="block text-sm font-medium">
						Completion Date <span class="text-error-500">*</span>
					</label>
					<input
						id="completed-date"
						type="date"
						bind:value={completedDate}
						class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						class:border-error-500={error && !completedDate}
					/>
				</div>

				<div>
					<label for="actual-cost" class="block text-sm font-medium">
						Actual Cost
					</label>
					<div class="relative mt-2">
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500">$</span>
						<input
							id="actual-cost"
							type="number"
							min="0"
							step="0.01"
							bind:value={actualCost}
							placeholder="0.00"
							class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 py-2 pl-7 pr-3 text-sm placeholder:text-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
				</div>

				<div>
					<label for="notes" class="block text-sm font-medium">
						Completion Notes
					</label>
					<textarea
						id="notes"
						bind:value={notes}
						rows={3}
						placeholder="Describe the work completed, any issues encountered, etc..."
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
					disabled={loading || !completedDate}
					class="inline-flex items-center gap-2 rounded-lg bg-success-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-success-600 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if loading}
						<Loader2 class="h-4 w-4 animate-spin" />
					{/if}
					Mark Complete
				</button>
			</div>
		</div>
	</div>
{/if}
