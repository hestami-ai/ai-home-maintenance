<script lang="ts">
	import { X, Loader2, Calendar } from 'lucide-svelte';

	interface Props {
		open: boolean;
		violationId: string;
		violationNumber: string;
		loading?: boolean;
		onConfirm: (data: { hearingDate: string; hearingTime: string; location: string; notes: string }) => void;
		onCancel: () => void;
	}

	let {
		open,
		violationId,
		violationNumber,
		loading = false,
		onConfirm,
		onCancel
	}: Props = $props();

	let hearingDate = $state('');
	let hearingTime = $state('10:00');
	let location = $state('');
	let notes = $state('');
	let error = $state('');

	const locationOptions = [
		'Community Clubhouse',
		'Association Office',
		'Virtual Meeting (Zoom)',
		'Other'
	];

	function handleConfirm() {
		if (!hearingDate) {
			error = 'Please select a hearing date.';
			return;
		}
		if (!location) {
			error = 'Please select a location.';
			return;
		}

		const selectedDate = new Date(hearingDate);
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		if (selectedDate < today) {
			error = 'Hearing date must be in the future.';
			return;
		}

		error = '';
		onConfirm({
			hearingDate,
			hearingTime,
			location,
			notes: notes.trim()
		});
	}

	function handleCancel() {
		hearingDate = '';
		hearingTime = '10:00';
		location = '';
		notes = '';
		error = '';
		onCancel();
	}

	function getMinDate(): string {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		return tomorrow.toISOString().split('T')[0];
	}

	$effect(() => {
		if (!open) {
			hearingDate = '';
			hearingTime = '10:00';
			location = '';
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

		<div class="relative z-10 w-full max-w-lg rounded-lg bg-surface-100-900 shadow-xl">
			<div class="flex items-center justify-between border-b border-surface-300-700 px-6 py-4">
				<div>
					<h2 class="text-lg font-semibold">Schedule Hearing</h2>
					<p class="text-sm text-surface-500">{violationNumber}</p>
				</div>
				<button
					type="button"
					onclick={handleCancel}
					class="rounded-lg p-1 text-surface-500 transition-colors hover:bg-surface-200-800 hover:text-surface-700-300"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<div class="space-y-4 p-6">
				{#if error}
					<div class="rounded-lg bg-error-500/10 p-3 text-sm text-error-500">
						{error}
					</div>
				{/if}

				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label for="hearingDate" class="mb-1 block text-sm font-medium">
							Hearing Date <span class="text-error-500">*</span>
						</label>
						<input
							id="hearingDate"
							type="date"
							min={getMinDate()}
							bind:value={hearingDate}
							class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>

					<div>
						<label for="hearingTime" class="mb-1 block text-sm font-medium">
							Hearing Time <span class="text-error-500">*</span>
						</label>
						<input
							id="hearingTime"
							type="time"
							bind:value={hearingTime}
							class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
				</div>

				<div>
					<label for="location" class="mb-1 block text-sm font-medium">
						Location <span class="text-error-500">*</span>
					</label>
					<select
						id="location"
						bind:value={location}
						class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					>
						<option value="">Select a location</option>
						{#each locationOptions as loc}
							<option value={loc}>{loc}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="notes" class="mb-1 block text-sm font-medium">
						Additional Notes
					</label>
					<textarea
						id="notes"
						bind:value={notes}
						rows={3}
						placeholder="Any additional information for the hearing notice..."
						class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					></textarea>
				</div>

				<div class="rounded-lg bg-warning-500/10 p-3">
					<p class="text-sm text-warning-700">
						<strong>Note:</strong> A hearing notice will be automatically sent to the responsible party with the scheduled date, time, and location.
					</p>
				</div>
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
					disabled={loading || !hearingDate || !location}
					class="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if loading}
						<Loader2 class="h-4 w-4 animate-spin" />
					{:else}
						<Calendar class="h-4 w-4" />
					{/if}
					Schedule Hearing
				</button>
			</div>
		</div>
	</div>
{/if}
