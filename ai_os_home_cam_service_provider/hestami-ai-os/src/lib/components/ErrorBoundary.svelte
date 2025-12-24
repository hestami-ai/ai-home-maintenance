<script lang="ts">
	/**
	 * Error Boundary Component
	 * 
	 * Catches errors in child components and logs them to the server.
	 * Displays a fallback UI when an error occurs.
	 * 
	 * Usage:
	 *   <ErrorBoundary>
	 *     <YourComponent />
	 *   </ErrorBoundary>
	 * 
	 * With custom fallback:
	 *   <ErrorBoundary>
	 *     <YourComponent />
	 *     {#snippet fallback(error, reset)}
	 *       <div>Something went wrong: {error.message}</div>
	 *       <button onclick={reset}>Try again</button>
	 *     {/snippet}
	 *   </ErrorBoundary>
	 */
	
	import { logger } from '$lib/logger';
	import type { Snippet } from 'svelte';
	
	interface Props {
		children: Snippet;
		fallback?: Snippet<[Error, () => void]>;
		componentName?: string;
	}
	
	let { children, fallback, componentName = 'Unknown' }: Props = $props();
	
	let error: Error | null = $state(null);
	let errorInfo: string | null = $state(null);
	
	function handleError(e: Error, info?: string) {
		error = e;
		errorInfo = info || null;
		
		// Log to server
		logger.captureError(e, {
			component: componentName,
			errorInfo,
			errorBoundary: true
		});
	}
	
	function reset() {
		error = null;
		errorInfo = null;
	}
	
	// Expose error handler for programmatic use
	export { handleError, reset };
</script>

{#if error}
	{#if fallback}
		{@render fallback(error, reset)}
	{:else}
		<div class="error-boundary">
			<div class="error-content">
				<svg class="error-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10"/>
					<line x1="12" y1="8" x2="12" y2="12"/>
					<line x1="12" y1="16" x2="12.01" y2="16"/>
				</svg>
				<h2>Something went wrong</h2>
				<p class="error-message">{error.message}</p>
				<button class="reset-button" onclick={reset}>
					Try again
				</button>
				{#if import.meta.env.DEV}
					<details class="error-details">
						<summary>Error details</summary>
						<pre>{error.stack}</pre>
						{#if errorInfo}
							<pre>{errorInfo}</pre>
						{/if}
					</details>
				{/if}
			</div>
		</div>
	{/if}
{:else}
	{@render children()}
{/if}

<style>
	.error-boundary {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 200px;
		padding: 2rem;
		background: var(--color-surface, #fafafa);
		border: 1px solid var(--color-border, #e5e5e5);
		border-radius: 8px;
	}
	
	.error-content {
		text-align: center;
		max-width: 400px;
	}
	
	.error-icon {
		width: 48px;
		height: 48px;
		color: var(--color-error, #dc2626);
		margin-bottom: 1rem;
	}
	
	h2 {
		margin: 0 0 0.5rem;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-text, #171717);
	}
	
	.error-message {
		margin: 0 0 1rem;
		color: var(--color-text-muted, #737373);
		font-size: 0.875rem;
	}
	
	.reset-button {
		padding: 0.5rem 1rem;
		background: var(--color-primary, #2563eb);
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s;
	}
	
	.reset-button:hover {
		background: var(--color-primary-hover, #1d4ed8);
	}
	
	.error-details {
		margin-top: 1rem;
		text-align: left;
	}
	
	.error-details summary {
		cursor: pointer;
		color: var(--color-text-muted, #737373);
		font-size: 0.75rem;
	}
	
	.error-details pre {
		margin: 0.5rem 0 0;
		padding: 0.5rem;
		background: var(--color-surface-alt, #f5f5f5);
		border-radius: 4px;
		font-size: 0.75rem;
		overflow-x: auto;
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
