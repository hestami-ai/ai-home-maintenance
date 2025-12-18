<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Loader2 } from 'lucide-svelte';

	type Variant = 'approve' | 'deny' | 'escalate' | 'default';

	interface Props {
		variant?: Variant;
		loading?: boolean;
		disabled?: boolean;
		disabledReason?: string;
		requiresRationale?: boolean;
		onclick?: () => void;
		children: Snippet;
	}

	let {
		variant = 'default',
		loading = false,
		disabled = false,
		disabledReason,
		requiresRationale = false,
		onclick,
		children
	}: Props = $props();

	const variantClasses: Record<Variant, string> = {
		approve: 'bg-success-500 hover:bg-success-600 text-white',
		deny: 'bg-error-500 hover:bg-error-600 text-white',
		escalate: 'bg-warning-500 hover:bg-warning-600 text-white',
		default: 'bg-primary-500 hover:bg-primary-600 text-white'
	};

	const isDisabled = $derived(disabled || loading);
</script>

<button
	type="button"
	{onclick}
	disabled={isDisabled}
	title={isDisabled && disabledReason ? disabledReason : undefined}
	class="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 {variantClasses[variant]}"
>
	{#if loading}
		<Loader2 class="h-4 w-4 animate-spin" />
	{/if}
	{@render children()}
	{#if requiresRationale}
		<span class="text-xs opacity-75">*</span>
	{/if}
</button>
