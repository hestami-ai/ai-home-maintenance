<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	let selected = $state(data.types.find((t) => t.isRoot)?.id ?? data.types[0]?.id ?? '');
	const current = $derived(data.types.find((t) => t.id === selected));
</script>

<svelte:head><title>{data.pwa.name} — Work Architecture</title></svelte:head>

<nav class="crumbs"><a href="/">PWA Library</a> › <span>{data.pwa.name}</span></nav>

<header class="pagehead">
	<div>
		<h1>{data.pwa.name}</h1>
		<p class="meta">
			<span class="pill" class:pub={data.pwa.publicationStatus === 'PUBLISHED'}>{data.pwa.publicationStatus}</span>
			v{data.pwa.version} · {data.pwa.domain}
		</p>
		<p class="sub">{data.pwa.description}</p>
	</div>
</header>

<div class="split">
	<section class="arch">
		<h2>Work Architecture — PWU Types</h2>
		<p class="hint">Reusable PWU Type definitions (allowed composition). This is a View of the PWA; it shows no execution or assurance state.</p>
		<div class="types">
			{#each data.types as t (t.id)}
				<button class="type" class:sel={selected === t.id} class:root={t.isRoot} onclick={() => (selected = t.id)}>
					<span class="tname">{t.name}{#if t.isRoot}<span class="rootbadge">ROOT</span>{/if}</span>
					<span class="tkind">{t.pwuKind}</span>
				</button>
			{/each}
			{#if !data.types.length}<p class="hint">No PWU Types defined yet.</p>{/if}
		</div>
	</section>

	<aside class="inspector">
		{#if current}
			<div class="itag">PWU TYPE</div>
			<h3>{current.name}</h3>
			<div class="field"><label>Purpose</label><p>{current.purpose}</p></div>
			<div class="field"><label>Completion rule</label><p class="mono">{current.completionRule || '—'}</p></div>
			<div class="field"><label>Permitted children</label><p>{current.permittedChildTypeIds.length} type(s)</p></div>
			<div class="field"><label>Required assurance</label><p>{current.requiredAssurancePolicyIds.length} policy(ies)</p></div>
		{:else}
			<p class="hint">Select a PWU Type.</p>
		{/if}

		{#if data.fixtures.length}
			<div class="fixtures">
				<label>Conformance fixtures</label>
				{#each data.fixtures as f (f.id)}
					<a class="fixture" href={`/undertakings/${f.id}`}>
						{#if f.isReferenceFixture}<span class="fxbadge">REFERENCE FIXTURE</span>{/if}
						{f.name} ↗
					</a>
				{/each}
				<p class="fxnote">A fixture is an Undertaking used to exercise this PWA — it is not the PWA definition.</p>
			</div>
		{/if}
	</aside>
</div>

<style>
	.crumbs {
		font-size: 12px;
		color: var(--outline);
		margin-bottom: 10px;
	}
	.pagehead h1 {
		margin: 0 0 6px;
		font-size: 28px;
	}
	.meta {
		margin: 0 0 6px;
		font-size: 12px;
		color: var(--on-variant);
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.pill {
		font-size: 10px;
		font-weight: 700;
		padding: 3px 8px;
		border-radius: 5px;
		background: rgba(159, 202, 255, 0.15);
		color: var(--primary);
	}
	.pill.pub {
		background: rgba(97, 218, 193, 0.15);
		color: var(--tertiary);
	}
	.sub {
		margin: 0;
		max-width: 680px;
		color: var(--on-variant);
		font-size: 13px;
		line-height: 1.5;
	}
	.split {
		display: grid;
		grid-template-columns: 1fr 320px;
		gap: 18px;
		margin-top: 20px;
	}
	.arch,
	.inspector {
		background: var(--surface-low);
		border-radius: 12px;
		padding: 18px;
	}
	h2 {
		margin: 0 0 4px;
		font-size: 16px;
	}
	.hint {
		color: var(--outline);
		font-size: 12px;
		margin: 0 0 14px;
	}
	.types {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.type {
		text-align: left;
		background: var(--sc);
		border: none;
		border-top: 2px solid var(--outline-faint);
		border-radius: 8px;
		padding: 12px 14px;
		color: var(--on);
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.type.root {
		border-top-color: var(--primary);
	}
	.type.sel {
		outline: 2px solid rgba(159, 202, 255, 0.5);
	}
	.tname {
		font-weight: 600;
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.rootbadge {
		font-size: 9px;
		background: var(--primary-container);
		color: #fff;
		padding: 1px 6px;
		border-radius: 4px;
		letter-spacing: 0.08em;
	}
	.tkind {
		font-size: 11px;
		color: var(--outline);
		font-family: 'Source Code Pro', monospace;
	}
	.itag {
		font-size: 10px;
		letter-spacing: 0.14em;
		color: var(--primary);
		font-weight: 700;
	}
	.inspector h3 {
		margin: 6px 0 16px;
		font-size: 19px;
	}
	.field {
		margin-bottom: 14px;
	}
	.field label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--outline);
		display: block;
		margin-bottom: 4px;
	}
	.field p {
		margin: 0;
		font-size: 13px;
		color: var(--on-variant);
		line-height: 1.5;
	}
	.mono {
		font-family: 'Source Code Pro', monospace;
		font-size: 11.5px !important;
	}
	.fixtures {
		margin-top: 20px;
		border-top: 1px solid var(--sc);
		padding-top: 14px;
	}
	.fixtures label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--outline);
		display: block;
		margin-bottom: 8px;
	}
	.fixture {
		display: block;
		background: var(--sc);
		border-radius: 8px;
		padding: 10px 12px;
		font-size: 12.5px;
		margin-bottom: 6px;
		color: var(--on);
	}
	.fxbadge {
		display: inline-block;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.08em;
		background: var(--primary-container);
		color: #fff;
		padding: 1px 6px;
		border-radius: 4px;
		margin-right: 6px;
	}
	.fxnote {
		font-size: 11px;
		color: var(--outline);
		margin: 6px 0 0;
	}
</style>
