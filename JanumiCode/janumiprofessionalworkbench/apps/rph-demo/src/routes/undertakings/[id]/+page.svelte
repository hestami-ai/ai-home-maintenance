<script lang="ts">
	import { SvelteFlow, Background, Controls, MiniMap } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { toFlow } from '$lib/toFlow';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const flow = $derived(toFlow(data.graph));
	let nodes = $state(toFlow(data.graph).nodes);
	let edges = $state(toFlow(data.graph).edges);
	let tab = $state<'graph' | 'overview' | 'assurance' | 'decisions' | 'baselines'>('graph');
	const tabs = ['graph', 'overview', 'assurance', 'decisions', 'baselines'] as const;
</script>

<svelte:head><title>{data.undertaking.name} — Workbench</title></svelte:head>

<nav class="crumbs"><a href="/undertakings">Undertaking Portfolio</a> › <span>{data.undertaking.name}</span></nav>

<header class="uhead">
	<div>
		<h1>{data.undertaking.name}</h1>
		<p class="binding">
			Instantiated from <strong>{data.undertaking.pwaName} v{data.undertaking.pwaVersion}</strong> ·
			status <span class="pill">{data.undertaking.status}</span>
		</p>
		<p class="obj">{data.undertaking.objective} <span class="product">→ {data.undertaking.intendedOutputProduct}</span></p>
	</div>
</header>

<div class="tabs">
	{#each tabs as t (t)}
		<button class:sel={tab === t} onclick={() => (tab = t)}>{t}</button>
	{/each}
</div>

{#if tab === 'graph'}
	<p class="legend">
		Live Professional Work Graph. <b class="g">Green</b> = execution SUCCEEDED <em>and</em> assurance SATISFIED
		(no green without assurance). <b class="a">Amber</b> = succeeded but not yet assured. <b class="i">Indigo
		border</b> = baselined.
	</p>
	{#if flow.openResiduals.length}
		<p class="residual">⚠ Open residual: {flow.openResiduals.join('; ')}</p>
	{/if}
	<div class="flow">
		<SvelteFlow bind:nodes bind:edges fitView>
			<Background />
			<Controls />
			<MiniMap />
		</SvelteFlow>
	</div>
{:else if tab === 'overview'}
	<div class="panel">
		<h2>Professional Work Graph — lifecycle rollup</h2>
		<div class="rollup">
			{#each Object.entries(data.rollup) as [state, n] (state)}
				<div class="chip"><span class="num">{n}</span> {state}</div>
			{/each}
		</div>
	</div>
{:else if tab === 'assurance'}
	<div class="panel">
		<h2>Assurance — assessments &amp; observations</h2>
		<table>
			<thead><tr><th>Assessment</th><th>Policy</th><th>State</th></tr></thead>
			<tbody>
				{#each data.assessments as a (a.id)}<tr><td class="mono">{a.id.slice(0, 14)}…</td><td>{a.policy}</td><td><span class="tag">{a.state}</span></td></tr>{/each}
				{#if !data.assessments.length}<tr><td colspan="3" class="none">No assessments.</td></tr>{/if}
			</tbody>
		</table>
		{#if data.observations.length}
			<h3>Observations</h3>
			{#each data.observations as o (o.id)}<div class="obs"><span class="sev">{o.severity}</span> {o.statement} <span class="disp">({o.disposition})</span></div>{/each}
		{/if}
	</div>
{:else if tab === 'decisions'}
	<div class="panel">
		<h2>Decisions — governance acts</h2>
		<table>
			<thead><tr><th>Decision</th><th>Type</th><th>Status</th><th>Rationale</th></tr></thead>
			<tbody>
				{#each data.decisions as dc (dc.id)}<tr><td class="mono">{dc.id.slice(0, 14)}…</td><td>{dc.type}</td><td><span class="tag">{dc.status}</span></td><td>{dc.rationale}</td></tr>{/each}
				{#if !data.decisions.length}<tr><td colspan="4" class="none">No decisions.</td></tr>{/if}
			</tbody>
		</table>
	</div>
{:else}
	<div class="panel">
		<h2>Baselines — authoritative promotions</h2>
		<table>
			<thead><tr><th>Baseline</th><th>Type</th><th>Status</th><th>Items</th></tr></thead>
			<tbody>
				{#each data.baselines as b (b.id)}<tr><td class="mono">{b.id.slice(0, 14)}…</td><td>{b.type}</td><td><span class="tag" class:auth={b.status === 'AUTHORITATIVE'}>{b.status}</span></td><td>{b.items}</td></tr>{/each}
				{#if !data.baselines.length}<tr><td colspan="4" class="none">No baselines.</td></tr>{/if}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.crumbs {
		font-size: 12px;
		color: var(--outline);
		margin-bottom: 8px;
	}
	.uhead h1 {
		margin: 0 0 4px;
		font-size: 26px;
	}
	.binding {
		margin: 0 0 4px;
		font-size: 12.5px;
		color: var(--on-variant);
	}
	.binding strong {
		color: var(--tertiary);
	}
	.pill {
		font-size: 10px;
		font-weight: 700;
		padding: 2px 7px;
		border-radius: 5px;
		background: rgba(97, 218, 193, 0.15);
		color: var(--tertiary);
	}
	.obj {
		margin: 0;
		font-size: 13px;
		color: var(--on-variant);
	}
	.product {
		color: var(--outline);
	}
	.tabs {
		display: flex;
		gap: 4px;
		margin: 18px 0 14px;
		border-bottom: 1px solid var(--sc);
	}
	.tabs button {
		background: none;
		border: none;
		color: var(--on-variant);
		padding: 9px 14px;
		font-size: 13px;
		cursor: pointer;
		text-transform: capitalize;
		border-bottom: 2px solid transparent;
	}
	.tabs button.sel {
		color: var(--primary);
		border-bottom-color: var(--primary);
		font-weight: 600;
	}
	.legend {
		font-size: 12px;
		color: var(--on-variant);
		margin: 0 0 8px;
	}
	.legend .g {
		color: var(--tertiary);
	}
	.legend .a {
		color: var(--amber);
	}
	.legend .i {
		color: var(--indigo);
	}
	.residual {
		color: var(--amber);
		font-weight: 600;
		font-size: 12.5px;
		margin: 0 0 8px;
	}
	.flow {
		height: calc(100vh - 320px);
		min-height: 420px;
		background: var(--surface-low);
		border-radius: 12px;
		overflow: hidden;
	}
	.panel {
		background: var(--surface-low);
		border-radius: 12px;
		padding: 20px;
	}
	.panel h2 {
		margin: 0 0 14px;
		font-size: 17px;
	}
	.panel h3 {
		margin: 20px 0 8px;
		font-size: 14px;
	}
	.rollup {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.chip {
		background: var(--sc);
		border-radius: 8px;
		padding: 10px 14px;
		font-size: 12px;
		color: var(--on-variant);
	}
	.chip .num {
		font-size: 18px;
		font-weight: 700;
		color: var(--on);
		margin-right: 6px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12.5px;
	}
	th {
		text-align: left;
		color: var(--outline);
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		padding: 6px 10px;
		border-bottom: 1px solid var(--sc);
	}
	td {
		padding: 9px 10px;
		border-bottom: 1px solid var(--sc);
		color: var(--on-variant);
	}
	.mono {
		font-family: 'Source Code Pro', monospace;
		color: var(--outline);
	}
	.tag {
		font-size: 10px;
		background: var(--sc-highest);
		padding: 2px 7px;
		border-radius: 4px;
		color: var(--on);
	}
	.tag.auth {
		background: rgba(154, 140, 255, 0.2);
		color: var(--indigo);
	}
	.none {
		color: var(--outline);
		text-align: center;
	}
	.obs {
		font-size: 12.5px;
		padding: 6px 0;
		color: var(--on-variant);
	}
	.sev {
		font-size: 10px;
		background: var(--sc-highest);
		padding: 1px 6px;
		border-radius: 4px;
		margin-right: 6px;
	}
	.disp {
		color: var(--outline);
	}
</style>
