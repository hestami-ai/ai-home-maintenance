<script lang="ts">
	import { getContext } from 'svelte';
	import { THEME_CONTEXT, type ThemeContext } from '$lib/theme';

	let { collapsed = false }: { collapsed?: boolean } = $props();
	const context = getContext<ThemeContext>(THEME_CONTEXT);
	const theme = context.theme;
</script>

<button
	type="button"
	class:collapsed
	class="theme-toggle"
	onclick={context.toggleTheme}
	aria-label="Light color mode"
	aria-pressed={$theme === 'light'}
	title={$theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
>
	<span class="theme-icon" aria-hidden="true">{$theme === 'light' ? '☀' : '☾'}</span>
	{#if !collapsed}<span>{$theme === 'light' ? 'Light mode' : 'Dark mode'}</span>{/if}
</button>

<style>
	.theme-toggle {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 38px;
		padding: 8px 10px;
		border: 1px solid var(--outline-faint);
		border-radius: 7px;
		background: var(--sc-high);
		color: var(--on-variant);
		font: inherit;
		font-size: 12px;
		font-weight: 650;
		cursor: pointer;
	}

	.theme-toggle:hover {
		border-color: var(--outline);
		color: var(--primary);
	}

	.theme-toggle.collapsed {
		justify-content: center;
		width: 42px;
		height: 42px;
		padding: 0;
	}

	.theme-icon {
		width: 18px;
		text-align: center;
		font-size: 16px;
		line-height: 1;
	}
</style>
