<script lang="ts">
	import { X, Loader2, Info } from 'lucide-svelte';
	import { orpc } from '$lib/api';

	interface Props {
		open: boolean;
		settings: any;
		onClose: () => void;
		onSave: (newSettings: any) => void;
	}

	let { open, settings, onClose, onSave }: Props = $props();

	let formData = $state({} as any);
	let isSaving = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (open) {
			formData = { ...settings };
			error = null;
		}
	});

	async function handleSubmit() {
		isSaving = true;
		error = null;
		try {
			const res = await orpc.documentProcessing.updateSettings(formData);
			if (res.ok) {
				onSave(res.data);
				onClose();
			} else {
				error = 'Failed to save settings. Please try again.';
			}
		} catch (err) {
			console.error('Error saving settings:', err);
			error = 'An unexpected error occurred.';
		} finally {
			isSaving = false;
		}
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			type="button"
			class="absolute inset-0 bg-black/50 backdrop-blur-sm"
			onclick={onClose}
			aria-label="Close modal"
		></button>

		<div class="relative z-10 w-full max-w-lg rounded-xl bg-surface-50-950 p-0 shadow-2xl border border-surface-200-800">
			<div class="flex items-center justify-between border-b border-surface-200-800 px-6 py-4">
				<h2 class="text-xl font-bold text-surface-900 dark:text-surface-100">DPQ Configuration</h2>
				<button
					type="button"
					onclick={onClose}
					class="rounded-lg p-1 text-surface-500 transition-colors hover:bg-surface-100-900"
				>
					<X class="h-6 w-6" />
				</button>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
				<div class="max-h-[70vh] overflow-y-auto p-6 space-y-6">
					{#if error}
						<div class="rounded-lg bg-red-500/10 p-3 text-sm text-red-600 border border-red-500/20">
							{error}
						</div>
					{/if}

					<div class="flex items-center justify-between">
						<div>
							<label for="autoRetryEnabled" class="text-sm font-semibold text-surface-900 dark:text-surface-100">Automatic Retries</label>
							<p class="text-xs text-surface-500">Enable automatic recovery for transient processing failures</p>
						</div>
						<input 
							id="autoRetryEnabled"
							type="checkbox" 
							bind:checked={formData.autoRetryEnabled}
							class="h-5 w-5 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
						/>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<label for="maxRetryAttempts" class="text-sm font-semibold text-surface-900 dark:text-surface-100">Max Attempts</label>
							<input 
								id="maxRetryAttempts"
								type="number" 
								bind:value={formData.maxRetryAttempts}
								min="1"
								max="10"
								class="w-full rounded-lg border border-surface-300-700 bg-surface-100-900 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
							/>
						</div>
						<div class="space-y-2">
							<label for="retryIntervalSeconds" class="text-sm font-semibold text-surface-900 dark:text-surface-100">Initial Delay (sec)</label>
							<input 
								id="retryIntervalSeconds"
								type="number" 
								bind:value={formData.retryIntervalSeconds}
								min="30"
								class="w-full rounded-lg border border-surface-300-700 bg-surface-100-900 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
							/>
						</div>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<label for="retryBackoffMultiplier" class="text-sm font-semibold text-surface-900 dark:text-surface-100">Backoff Multiplier</label>
							<input 
								id="retryBackoffMultiplier"
								type="number" 
								step="0.5"
								bind:value={formData.retryBackoffMultiplier}
								min="1"
								class="w-full rounded-lg border border-surface-300-700 bg-surface-100-900 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
							/>
						</div>
						<div class="space-y-2">
							<label for="infectedRetentionDays" class="text-sm font-semibold text-surface-900 dark:text-surface-100">Retention (days)</label>
							<input 
								id="infectedRetentionDays"
								type="number" 
								bind:value={formData.infectedRetentionDays}
								min="1"
								class="w-full rounded-lg border border-surface-300-700 bg-surface-100-900 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
							/>
						</div>
					</div>

					<div class="flex gap-3 rounded-lg bg-blue-500/10 p-4 border border-blue-500/20">
						<Info class="h-5 w-5 text-blue-500 shrink-0" />
						<p class="text-xs text-blue-700 dark:text-blue-300">
							Changes to these settings take effect immediately for new processing jobs. In-flight jobs will continue with previous settings until their next retry cycle.
						</p>
					</div>
				</div>

				<div class="flex justify-end gap-3 border-t border-surface-200-800 px-6 py-4">
					<button
						type="button"
						onclick={onClose}
						disabled={isSaving}
						class="rounded-lg px-4 py-2 text-sm font-medium text-surface-700-300 transition-colors hover:bg-surface-100-900"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={isSaving}
						class="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-50 shadow-md"
					>
						{#if isSaving}
							<Loader2 class="h-4 w-4 animate-spin" />
						{/if}
						Save Changes
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
