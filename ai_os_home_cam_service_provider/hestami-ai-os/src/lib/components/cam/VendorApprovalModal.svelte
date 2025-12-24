<script lang="ts">
	import { X, Loader2 } from 'lucide-svelte';

	interface Props {
		open: boolean;
		vendorName?: string;
		action: 'APPROVE' | 'REJECT' | 'REQUEST_INFO' | null;
		loading?: boolean;
		onConfirm: (data: { action: string; notes: string; expirationDate?: string }) => void;
		onCancel: () => void;
	}

	let {
		open,
		vendorName = '',
		action,
		loading = false,
		onConfirm,
		onCancel
	}: Props = $props();

	let notes = $state('');
	let expirationDate = $state('');
	let error = $state('');

	const actionConfig: Record<string, { title: string; label: string; variant: string; requiresExpiration: boolean }> = {
		APPROVE: { title: 'Approve Vendor', label: 'Approve', variant: 'approve', requiresExpiration: true },
		REJECT: { title: 'Reject Vendor', label: 'Reject', variant: 'deny', requiresExpiration: false },
		REQUEST_INFO: { title: 'Request Additional Information', label: 'Request Info', variant: 'default', requiresExpiration: false }
	};

	const config = $derived(action ? actionConfig[action] : null);

	const variantClasses: Record<string, string> = {
		approve: 'bg-success-500 hover:bg-success-600 text-white',
		deny: 'bg-error-500 hover:bg-error-600 text-white',
		default: 'bg-primary-500 hover:bg-primary-600 text-white'
	};

	function handleConfirm() {
		if (!notes.trim()) {
			error = 'Notes are required.';
			return;
		}
		if (config?.requiresExpiration && !expirationDate) {
			error = 'Approval expiration date is required.';
			return;
		}
		error = '';
		onConfirm({
			action: action!,
			notes: notes.trim(),
			expirationDate: config?.requiresExpiration ? expirationDate : undefined
		});
	}

	function handleCancel() {
		notes = '';
		expirationDate = '';
		error = '';
		onCancel();
	}

	// Set default expiration to 1 year from now for approvals
	$effect(() => {
		if (open && action === 'APPROVE' && !expirationDate) {
			const oneYearFromNow = new Date();
			oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
			expirationDate = oneYearFromNow.toISOString().split('T')[0];
		}
	});

	$effect(() => {
		if (!open) {
			notes = '';
			expirationDate = '';
			error = '';
		}
	});
</script>

{#if open && config}
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<button
			type="button"
			class="absolute inset-0 bg-black/50"
			onclick={handleCancel}
			aria-label="Close modal"
		></button>

		<div class="relative z-10 w-full max-w-md rounded-lg bg-surface-100-900 shadow-xl">
			<div class="flex items-center justify-between border-b border-surface-300-700 px-6 py-4">
				<h2 class="text-lg font-semibold">{config.title}</h2>
				<button
					type="button"
					onclick={handleCancel}
					class="rounded-lg p-1 text-surface-500 transition-colors hover:bg-surface-200-800 hover:text-surface-700-300"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<div class="space-y-4 p-6">
				{#if vendorName}
					<div class="rounded-lg bg-surface-200-800 p-3">
						<p class="text-sm text-surface-500">Vendor</p>
						<p class="font-medium">{vendorName}</p>
					</div>
				{/if}

				{#if action === 'APPROVE'}
					<div>
						<label for="expiration-date" class="block text-sm font-medium">
							Approval Expiration Date <span class="text-error-500">*</span>
						</label>
						<input
							id="expiration-date"
							type="date"
							bind:value={expirationDate}
							class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							class:border-error-500={error && !expirationDate}
						/>
						<p class="mt-1 text-xs text-surface-500">
							Vendor will need to be re-approved after this date.
						</p>
					</div>
				{/if}

				<div>
					<label for="notes" class="block text-sm font-medium">
						{#if action === 'REQUEST_INFO'}
							Information Requested <span class="text-error-500">*</span>
						{:else}
							Notes <span class="text-error-500">*</span>
						{/if}
					</label>
					<textarea
						id="notes"
						bind:value={notes}
						rows={4}
						placeholder={action === 'REQUEST_INFO' 
							? 'Describe what additional information is needed...'
							: action === 'REJECT'
								? 'Provide reason for rejection...'
								: 'Add any notes about this approval...'}
						class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm placeholder:text-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						class:border-error-500={error && !notes.trim()}
					></textarea>
					{#if error}
						<p class="mt-1 text-sm text-error-500">{error}</p>
					{/if}
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
					disabled={loading || !notes.trim() || (config.requiresExpiration && !expirationDate)}
					class="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 {variantClasses[config.variant]}"
				>
					{#if loading}
						<Loader2 class="h-4 w-4 animate-spin" />
					{/if}
					{config.label}
				</button>
			</div>
		</div>
	</div>
{/if}
