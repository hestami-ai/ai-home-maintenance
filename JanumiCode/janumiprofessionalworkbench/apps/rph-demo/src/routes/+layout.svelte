<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	let { children } = $props();

	// E2E hydration marker: the client sets this once Svelte has hydrated, so tests can wait for interactivity
	// before driving toggle/enhance controls (otherwise a click can land before its handler is attached). Harmless
	// in production — it just stamps one data attribute on <html>.
	onMount(() => {
		document.documentElement.dataset.hydrated = 'true';
	});

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
	function isActive(href: string): boolean {
		if (href === '/') return page.url.pathname === '/' || page.url.pathname.startsWith('/pwa');
		return page.url.pathname.startsWith(href);
	}
</script>

<div class="app">
	<aside>
		<div class="brand">
			<div class="mark">◭</div>
			<div>
				<div class="title">Janumi JPWB</div>
				<div class="ver">Professional Workbench</div>
			</div>
		</div>
		<nav>
			{#each nav as item (item.href)}
				<a href={item.href} class:active={isActive(item.href)}>
					<span class="ic">{item.icon}</span>{item.label}
				</a>
			{/each}
		</nav>
		<div class="foot">Recursive Professional Harness · live engine</div>
	</aside>
	<main>
		<div class="ctxbar" class:design={activeContext === 'design'} class:undertaking={activeContext === 'undertaking'}>
			{activeContext === 'design' ? 'PWA DESIGN CONTEXT — reusable Professional Work Architectures' : 'UNDERTAKING CONTEXT — concrete professional work'}
		</div>
		<div class="content">{@render children()}</div>
	</main>
</div>

<style>
	:global(:root) {
		--surface: #131313;
		--surface-low: #1b1b1c;
		--sc: #202020;
		--sc-high: #2a2a2a;
		--sc-highest: #353535;
		--on: #e5e2e1;
		--on-variant: #c0c7d3;
		--outline: #8a919d;
		--outline-faint: #404751;
		--primary: #9fcaff;
		--primary-container: #007acc;
		--tertiary: #61dac1;
		--error: #ffb4ab;
		--amber: #e6b566;
		--indigo: #9a8cff;
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
		min-height: 100vh;
	}
	aside {
		width: 232px;
		background: var(--surface-low);
		display: flex;
		flex-direction: column;
		position: sticky;
		top: 0;
		height: 100vh;
	}
	.brand {
		display: flex;
		gap: 10px;
		align-items: center;
		padding: 20px 18px;
	}
	.mark {
		width: 34px;
		height: 34px;
		border-radius: 6px;
		background: var(--primary-container);
		color: #fff;
		display: grid;
		place-items: center;
		font-size: 18px;
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
	nav {
		display: flex;
		flex-direction: column;
		padding: 6px 10px;
		gap: 2px;
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
	nav a:hover {
		background: var(--sc-high);
	}
	nav a.active {
		background: var(--sc-high);
		color: var(--primary);
		border-left-color: var(--primary);
	}
	.ic {
		width: 18px;
		text-align: center;
		opacity: 0.85;
	}
	.foot {
		margin-top: auto;
		padding: 16px 18px;
		font-size: 10px;
		color: var(--outline);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.ctxbar {
		padding: 8px 24px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.12em;
		border-bottom: 1px solid var(--sc);
	}
	.ctxbar.design {
		background: linear-gradient(90deg, rgba(159, 202, 255, 0.12), transparent);
		color: var(--primary);
	}
	.ctxbar.undertaking {
		background: linear-gradient(90deg, rgba(97, 218, 193, 0.12), transparent);
		color: var(--tertiary);
	}
	.content {
		padding: 24px;
		flex: 1;
		min-width: 0;
	}
</style>
