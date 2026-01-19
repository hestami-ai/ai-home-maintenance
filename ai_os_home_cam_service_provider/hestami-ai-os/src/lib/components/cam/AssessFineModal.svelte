<script lang="ts">
	import { JobSourceTypeValues, ScheduleFrequencyValues } from '$lib/api/cam';
	import { X, Loader2, DollarSign } from 'lucide-svelte';

	interface Props {
		open: boolean;
		violationId: string;
		violationNumber: string;
		loading?: boolean;
		onConfirm: (data: { amount: number; fineType: string; dueDate: string; notes: string }) => void;
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

	let amount = $state('');
	let fineType = $state('STANDARD');
	let dueDate = $state('');
	let notes = $state('');
	let error = $state('');

	const fineTypeOptions = [
		{ value: 'STANDARD', label: 'Standard Fine', defaultAmount: 100 },
		{ value: ScheduleFrequencyValues.DAILY, label: 'Daily Fine', defaultAmount: 25 },
		{ value: JobSourceTypeValues.RECURRING, label: 'Recurring Fine', defaultAmount: 50 },
		{ value: 'HEARING_ASSESSED', label: 'Hearing-Assessed Fine', defaultAmount: 250 }
	];

	function handleFineTypeChange() {
		const option = fineTypeOptions.find(o => o.value === fineType);
		if (option) {
			amount = option.defaultAmount.toString();
		}
	}

	function getDefaultDueDate(): string {
		const date = new Date();
		date.setDate(date.getDate() + 30);
		return date.toISOString().split('T')[0];
	}

	function handleConfirm() {
		const amountNum = parseFloat(amount);
		if (!amount || isNaN(amountNum) || amountNum <= 0) {
			error = 'Please enter a valid fine amount.';
			return;
		}
		if (!dueDate) {
			error = 'Please select a due date.';
			return;
		}

		error = '';
		onConfirm({
			amount: amountNum,
			fineType,
			dueDate,
			notes: notes.trim()
		});
	}

	function handleCancel() {
		amount = '';
		fineType = 'STANDARD';
		dueDate = '';
		notes = '';
		error = '';
		onCancel();
	}

	$effect(() => {
		if (open && !dueDate) {
			dueDate = getDefaultDueDate();
			handleFineTypeChange();
		}
	});

	$effect(() => {
		if (!open) {
			amount = '';
			fineType = 'STANDARD';
			dueDate = '';
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
					<h2 class="text-lg font-semibold">Assess Fine</h2>
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

				<div>
					<label for="fineType" class="mb-1 block text-sm font-medium">
						Fine Type <span class="text-error-500">*</span>
					</label>
					<select
						id="fineType"
						bind:value={fineType}
						onchange={handleFineTypeChange}
						class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					>
						{#each fineTypeOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label for="amount" class="mb-1 block text-sm font-medium">
							Amount <span class="text-error-500">*</span>
						</label>
						<div class="relative">
							<span class="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500">$</span>
							<input
								id="amount"
								type="number"
								step="0.01"
								min="0"
								bind:value={amount}
								class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 py-2 pl-7 pr-3 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							/>
						</div>
					</div>

					<div>
						<label for="dueDate" class="mb-1 block text-sm font-medium">
							Due Date <span class="text-error-500">*</span>
						</label>
						<input
							id="dueDate"
							type="date"
							bind:value={dueDate}
							class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
				</div>

				<div>
					<label for="notes" class="mb-1 block text-sm font-medium">
						Notes / Justification
					</label>
					<textarea
						id="notes"
						bind:value={notes}
						rows={3}
						placeholder="Justification for the fine amount..."
						class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					></textarea>
				</div>

				<div class="rounded-lg bg-surface-200-800 p-3">
					<p class="text-sm">
						<strong>Fine Summary:</strong> ${amount || '0.00'} {fineType.replace(/_/g, ' ').toLowerCase()} fine due by {dueDate ? new Date(dueDate).toLocaleDateString() : 'TBD'}
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
					disabled={loading || !amount || !dueDate}
					class="inline-flex items-center gap-2 rounded-lg bg-error-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-error-600 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if loading}
						<Loader2 class="h-4 w-4 animate-spin" />
					{:else}
						<DollarSign class="h-4 w-4" />
					{/if}
					Assess Fine
				</button>
			</div>
		</div>
	</div>
{/if}
