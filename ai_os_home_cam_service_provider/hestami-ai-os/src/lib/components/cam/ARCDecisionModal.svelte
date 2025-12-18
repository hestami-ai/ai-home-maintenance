<script lang="ts">
	import { X, Loader2 } from 'lucide-svelte';

	interface Props {
		open: boolean;
		decision: 'APPROVE' | 'APPROVE_WITH_CONDITIONS' | 'DENY' | 'TABLE' | 'REQUEST_CHANGES' | null;
		loading?: boolean;
		onConfirm: (data: { decision: string; rationale: string; conditions?: string }) => void;
		onCancel: () => void;
	}

	let {
		open,
		decision,
		loading = false,
		onConfirm,
		onCancel
	}: Props = $props();

	let rationale = $state('');
	let conditions = $state('');
	let error = $state('');

	const decisionConfig: Record<string, { title: string; label: string; variant: string; requiresConditions: boolean }> = {
		APPROVE: { title: 'Approve Request', label: 'Approve', variant: 'approve', requiresConditions: false },
		APPROVE_WITH_CONDITIONS: { title: 'Approve with Conditions', label: 'Approve with Conditions', variant: 'approve', requiresConditions: true },
		DENY: { title: 'Deny Request', label: 'Deny', variant: 'deny', requiresConditions: false },
		TABLE: { title: 'Table Request', label: 'Table for Later', variant: 'default', requiresConditions: false },
		REQUEST_CHANGES: { title: 'Request Changes', label: 'Request Changes', variant: 'escalate', requiresConditions: false }
	};

	const config = $derived(decision ? decisionConfig[decision] : null);
	const requiresConditions = $derived(config?.requiresConditions ?? false);

	const variantClasses: Record<string, string> = {
		approve: 'bg-success-500 hover:bg-success-600 text-white',
		deny: 'bg-error-500 hover:bg-error-600 text-white',
		escalate: 'bg-warning-500 hover:bg-warning-600 text-white',
		default: 'bg-primary-500 hover:bg-primary-600 text-white'
	};

	function handleConfirm() {
		if (!rationale.trim()) {
			error = 'Rationale is required for this decision.';
			return;
		}
		if (requiresConditions && !conditions.trim()) {
			error = 'Conditions are required for conditional approval.';
			return;
		}
		error = '';
		onConfirm({
			decision: decision!,
			rationale: rationale.trim(),
			conditions: requiresConditions ? conditions.trim() : undefined
		});
	}

	function handleCancel() {
		rationale = '';
		conditions = '';
		error = '';
		onCancel();
	}

	$effect(() => {
		if (!open) {
			rationale = '';
			conditions = '';
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

		<div class="relative z-10 w-full max-w-lg rounded-lg bg-surface-100-900 shadow-xl">
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
				{#if requiresConditions}
					<div>
						<label for="conditions" class="block text-sm font-medium">
							Conditions <span class="text-error-500">*</span>
						</label>
						<textarea
							id="conditions"
							bind:value={conditions}
							rows={3}
							placeholder="Enter the conditions that must be met for this approval..."
							class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm placeholder:text-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						></textarea>
						<p class="mt-1 text-xs text-surface-500">
							These conditions will be communicated to the applicant.
						</p>
					</div>
				{/if}

				<div>
					<label for="rationale" class="block text-sm font-medium">
						Rationale <span class="text-error-500">*</span>
					</label>
					<textarea
						id="rationale"
						bind:value={rationale}
						rows={4}
						placeholder="Please provide a rationale for this decision..."
						class="mt-2 w-full rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm placeholder:text-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						class:border-error-500={error && !rationale.trim()}
					></textarea>
					{#if error}
						<p class="mt-1 text-sm text-error-500">{error}</p>
					{/if}
					<p class="mt-2 text-xs text-surface-500">
						This rationale will be recorded in the audit trail.
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
					disabled={loading || !rationale.trim() || (requiresConditions && !conditions.trim())}
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
