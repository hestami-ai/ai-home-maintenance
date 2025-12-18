<script lang="ts">
	import { X, Loader2 } from 'lucide-svelte';

	interface Props {
		open: boolean;
		loading?: boolean;
		onConfirm: (data: { scheduledDate: string; scheduledTime?: string; estimatedDuration?: number; notes?: string }) => void;
		onCancel: () => void;
	}

	let {
		open,
		loading = false,
		onConfirm,
		onCancel
	}: Props = $props();

	let scheduledDate = $state('');
	let scheduledTime = $state('');
	let estimatedDuration = $state('');
	let notes = $state('');
	let error = $state('');

	function handleConfirm() {
		if (!scheduledDate) {
			error = 'Please select a scheduled date.';
			return;
		}
		error = '';
		onConfirm({
			scheduledDate,
			scheduledTime: scheduledTime || undefined,
			estimatedDuration: estimatedDuration ? parseInt(estimatedDuration) : undefined,
			notes: notes.trim() || undefined
		});
	}

	function handleCancel() {
		scheduledDate = '';
		scheduledTime = '';
		estimatedDuration = '';
		notes = '';
		error = '';
		onCancel();
	}

	$effect(() => {
		if (!open) {
			scheduledDate = '';
			scheduledTime = '';
			estimatedDuration = '';
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
				<h2 class="text-lg font-semibold">Schedule Work</h2>
				<button
					type="button"
					onclick={handleCancel}
					class="rounded-lg p-1 text-surface-500 transition-colors hover:bg-surface-200-800 hover:text-surface-700-300"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<div class="space-y-4 p-6">
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="scheduled-date" class="block text-sm font-medium">
							Date <span class="text-error-500">*</span>
						</label>
						<input
							id="scheduled-date"
							type="date"
							bind:value={scheduledDate}
							class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							class:border-error-500={error && !scheduledDate}
						/>
					</div>
					<div>
						<label for="scheduled-time" class="block text-sm font-medium">
							Time
						</label>
						<input
							id="scheduled-time"
							type="time"
							bind:value={scheduledTime}
							class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
				</div>

				<div>
					<label for="estimated-duration" class="block text-sm font-medium">
						Estimated Duration (hours)
					</label>
					<input
						id="estimated-duration"
						type="number"
						min="1"
						max="100"
						bind:value={estimatedDuration}
						placeholder="e.g., 2"
						class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm placeholder:text-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					/>
				</div>

				<div>
					<label for="notes" class="block text-sm font-medium">
						Notes
					</label>
					<textarea
						id="notes"
						bind:value={notes}
						rows={3}
						placeholder="Add any scheduling notes or special instructions..."
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
					disabled={loading || !scheduledDate}
					class="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if loading}
						<Loader2 class="h-4 w-4 animate-spin" />
					{/if}
					Schedule
				</button>
			</div>
		</div>
	</div>
{/if}
