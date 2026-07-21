<script lang="ts">
	import { get, writable } from 'svelte/store';
	import { onMount, setContext } from 'svelte';
	import { page } from '$app/state';
	import ThemeToggle from '$lib/ThemeToggle.svelte';
	import {
		applyTheme,
		documentTheme,
		nextTheme,
		parseTheme,
		persistTheme,
		THEME_CONTEXT,
		THEME_STORAGE_KEY,
		type Theme,
		type ThemeContext
	} from '$lib/theme';
	import '$lib/styles/theme.css';
	let { children } = $props();

	const theme = writable<Theme>('dark');
	function setTheme(next: Theme, persist = true) {
		applyTheme(next);
		theme.set(next);
		if (persist) persistTheme(next);
	}
	const themeContext: ThemeContext = {
		theme,
		setTheme,
		toggleTheme: () => setTheme(nextTheme(get(theme)))
	};
	setContext(THEME_CONTEXT, themeContext);

	// E2E hydration marker: the client sets this once Svelte has hydrated, so tests can wait for interactivity
	// before driving toggle/enhance controls (otherwise a click can land before its handler is attached). Harmless
	// in production — it just stamps one data attribute on <html>.
	onMount(() => {
		setTheme(documentTheme(), false);
		document.documentElement.dataset.hydrated = 'true';
		const saved = localStorage.getItem('jpwb-nav-collapsed');
		if (saved !== null) collapsed = saved === '1';

		const syncThemeAcrossTabs = (event: StorageEvent) => {
			if (event.key !== THEME_STORAGE_KEY) return;
			setTheme(parseTheme(event.newValue) ?? 'dark', false);
		};
		window.addEventListener('storage', syncThemeAcrossTabs);
		return () => window.removeEventListener('storage', syncThemeAcrossTabs);
	});

	// The left navigation collapses to an icon rail to give the node-graph designer more room.
	let collapsed = $state(false);
	function toggleNav() {
		collapsed = !collapsed;
		localStorage.setItem('jpwb-nav-collapsed', collapsed ? '1' : '0');
	}

	// Two visibly-distinct contexts (RPH-DOC-010 §5/§35): PWA Design vs Undertaking. The nav + the context banner
	// make the current level unmistakable — the reviewer can always tell which level they are examining.
	const nav = [
		{ label: 'PWA Library', href: '/', icon: '▤', context: 'design' },
		{ label: 'Undertakings', href: '/undertakings', icon: '◈', context: 'undertaking' },
		{ label: 'Decisions', href: '/decisions', icon: '⚖', context: 'undertaking' },
		{ label: 'Baselines', href: '/baselines', icon: '◆', context: 'undertaking' }
	];
	const activeContext = $derived(
		page.url.pathname.startsWith('/undertakings') ||
			page.url.pathname.startsWith('/decisions') ||
			page.url.pathname.startsWith('/baselines')
			? 'undertaking'
			: 'design'
	);
	// The Work-Architecture designer and the Undertaking workbench are full-bleed, viewport-locked graph surfaces
	// (their own internal panels scroll); list pages keep the padded, scrollable content box.
	const fullBleed = $derived(
		page.url.pathname.startsWith('/pwa/') || /^\/undertakings\/[^/]+$/.test(page.url.pathname)
	);
	function isActive(href: string): boolean {
		if (href === '/') return page.url.pathname === '/' || page.url.pathname.startsWith('/pwa');
		return page.url.pathname.startsWith(href);
	}
</script>

<div class="app">
	<aside class:collapsed>
		<div class="brand">
			<div class="mark">◭</div>
			{#if !collapsed}
				<div class="brandtext">
					<div class="title">Janumi JPWB</div>
					<div class="ver">Professional Workbench</div>
				</div>
			{/if}
			<button
				class="navtoggle"
				onclick={toggleNav}
				aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
				title={collapsed ? 'Expand navigation' : 'Collapse navigation'}>{collapsed ? '»' : '«'}</button
			>
		</div>
		<nav>
			{#each nav as item (item.href)}
				<a
					href={item.href}
					class:active={isActive(item.href)}
					title={item.label}
					aria-label={item.label}
				>
					<span class="ic">{item.icon}</span>{#if !collapsed}<span class="lbl">{item.label}</span>{/if}
				</a>
			{/each}
		</nav>
		<div class="theme-slot" class:collapsed><ThemeToggle {collapsed} /></div>
		{#if !collapsed}
			<div class="foot">Recursive Professional Harness · live engine</div>
		{/if}
	</aside>
	<main>
		<div
			class="ctxbar"
			class:design={activeContext === 'design'}
			class:undertaking={activeContext === 'undertaking'}
		>
			{activeContext === 'design'
				? 'PWA DESIGN CONTEXT — reusable Professional Work Architectures'
				: 'UNDERTAKING CONTEXT — concrete professional work'}
		</div>
		<div class="content" class:full={fullBleed}>{@render children()}</div>
	</main>
</div>

<style>
	:global(*, *::before, *::after) {
		box-sizing: border-box;
	}
	:global(body) {
		margin: 0;
		background: var(--surface);
		color: var(--on);
		font-family: 'Inter', system-ui, sans-serif;
	}
	:global(a) {
		color: var(--primary);
		text-decoration: none;
	}
	.app {
		display: flex;
		height: 100vh;
		overflow: hidden;
	}
	aside {
		width: 232px;
		flex-shrink: 0;
		background: var(--surface-low);
		display: flex;
		flex-direction: column;
		height: 100vh;
		transition: width 0.16s ease;
	}
	aside.collapsed {
		width: 60px;
	}
	.brand {
		display: flex;
		gap: 10px;
		align-items: center;
		padding: 18px 14px;
		position: relative;
	}
	aside.collapsed .brand {
		justify-content: center;
		padding: 18px 0;
	}
	.mark {
		width: 34px;
		height: 34px;
		flex-shrink: 0;
		border-radius: 6px;
		background: var(--primary-container);
		color: var(--on-primary-container);
		display: grid;
		place-items: center;
		font-size: 18px;
	}
	.brandtext {
		min-width: 0;
	}
	.title {
		font-weight: 700;
		letter-spacing: -0.02em;
	}
	.ver {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: var(--outline);
		margin-top: 2px;
	}
	.navtoggle {
		margin-left: auto;
		background: var(--sc-high);
		border: 1px solid var(--outline-faint);
		color: var(--on-variant);
		border-radius: 6px;
		width: 24px;
		height: 24px;
		font-size: 12px;
		cursor: pointer;
		display: grid;
		place-items: center;
	}
	aside.collapsed .navtoggle {
		position: absolute;
		right: -12px;
		top: 22px;
		margin-left: 0;
		z-index: 2;
	}
	.navtoggle:hover {
		color: var(--primary);
	}
	nav {
		display: flex;
		flex-direction: column;
		padding: 6px 10px;
		gap: 2px;
	}
	aside.collapsed nav {
		padding: 6px 8px;
	}
	nav a {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border-radius: 6px;
		color: var(--on-variant);
		font-size: 14px;
		border-left: 3px solid transparent;
	}
	aside.collapsed nav a {
		justify-content: center;
		padding: 10px 0;
		gap: 0;
	}
	nav a:hover {
		background: var(--sc-high);
	}
	nav a.active {
		background: var(--sc-high);
		color: var(--primary);
		border-left-color: var(--primary);
	}
	aside.collapsed nav a.active {
		border-left-color: transparent;
		border-bottom: 2px solid var(--primary);
		border-radius: 6px 6px 0 0;
	}
	.ic {
		width: 18px;
		text-align: center;
		opacity: 0.85;
	}
	.foot {
		margin-top: 0;
		padding: 16px 18px;
		font-size: 10px;
		color: var(--outline);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.theme-slot {
		margin-top: auto;
		padding: 10px 12px 0;
	}
	.theme-slot.collapsed {
		display: flex;
		justify-content: center;
		padding: 10px 9px 14px;
	}
	main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	.ctxbar {
		flex-shrink: 0;
		padding: 8px 24px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.12em;
		border-bottom: 1px solid var(--sc);
	}
	.ctxbar.design {
		background: linear-gradient(90deg, var(--primary-soft), transparent);
		color: var(--primary);
	}
	.ctxbar.undertaking {
		background: linear-gradient(90deg, var(--tertiary-soft), transparent);
		color: var(--tertiary);
	}
	.content {
		padding: 24px;
		flex: 1;
		min-width: 0;
		min-height: 0;
		overflow: auto;
	}
	/* Full-bleed, viewport-locked graph surfaces manage their own internal scrolling. */
	.content.full {
		padding: 0;
		overflow: hidden;
	}
</style>
