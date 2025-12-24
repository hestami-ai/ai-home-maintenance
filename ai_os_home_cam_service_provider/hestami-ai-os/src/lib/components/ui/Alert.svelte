<script lang="ts">
	import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'info' | 'success' | 'warning' | 'error';
		title?: string;
		dismissible?: boolean;
		onDismiss?: () => void;
		children: Snippet;
	}

	let { variant = 'info', title, dismissible = false, onDismiss, children }: Props = $props();

	const variantConfig = {
		info: {
			icon: Info,
			bgClass: 'bg-primary-500/10',
			borderClass: 'border-primary-500/50',
			textClass: 'text-primary-700 dark:text-primary-300',
			iconClass: 'text-primary-500'
		},
		success: {
			icon: CheckCircle,
			bgClass: 'bg-success-500/10',
			borderClass: 'border-success-500/50',
			textClass: 'text-success-700 dark:text-success-300',
			iconClass: 'text-success-500'
		},
		warning: {
			icon: AlertTriangle,
			bgClass: 'bg-warning-500/10',
			borderClass: 'border-warning-500/50',
			textClass: 'text-warning-700 dark:text-warning-300',
			iconClass: 'text-warning-500'
		},
		error: {
			icon: AlertCircle,
			bgClass: 'bg-error-500/10',
			borderClass: 'border-error-500/50',
			textClass: 'text-error-700 dark:text-error-300',
			iconClass: 'text-error-500'
		}
	};

	const config = $derived(variantConfig[variant]);
	const Icon = $derived(config.icon);
</script>

<div class="rounded-lg border {config.bgClass} {config.borderClass} p-4" role="alert">
	<div class="flex items-start gap-3">
		<Icon class="h-5 w-5 flex-shrink-0 {config.iconClass}" />
		<div class="flex-1 {config.textClass}">
			{#if title}
				<p class="font-medium">{title}</p>
			{/if}
			<div class="text-sm" class:mt-1={title}>
				{@render children()}
			</div>
		</div>
		{#if dismissible && onDismiss}
			<button
				type="button"
				onclick={onDismiss}
				class="flex-shrink-0 rounded p-1 hover:bg-surface-200-800"
				aria-label="Dismiss"
			>
				<X class="h-4 w-4" />
			</button>
		{/if}
	</div>
</div>
