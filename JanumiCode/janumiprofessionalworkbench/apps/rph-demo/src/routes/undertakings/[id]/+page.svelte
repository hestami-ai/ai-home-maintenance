<script lang="ts">
	import { SvelteFlow, Background, Controls, MiniMap } from '@xyflow/svelte';
	import type { Edge, Node } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { enhance } from '$app/forms';
	import { toFlow } from '$lib/toFlow';
	import type { PageData } from './$types';

	let {
		data,
		form
	}: {
		data: PageData;
		form: { error?: string; proposed?: string; advanced?: string } | null;
	} = $props();
	// Derive the graph from `data` and sync it into the bindable node/edge state (so it tracks server updates and
	// doesn't just capture the initial prop value).
	const flow = $derived(toFlow(data.graph));
	let nodes = $state<Node[]>([]);
	let edges = $state<Edge[]>([]);
	$effect(() => {
		nodes = flow.nodes;
		edges = flow.edges;
	});
	let tab = $state<'graph' | 'overview' | 'execution' | 'assurance' | 'decisions' | 'baselines'>(
		'graph'
	);
	const tabs = ['graph', 'overview', 'execution', 'assurance', 'decisions', 'baselines'] as const;
</script>

<svelte:head><title>{data.undertaking.name} — Workbench</title></svelte:head>

<nav class="crumbs"
	><a href="/undertakings">Undertaking Portfolio</a> › <span>{data.undertaking.name}</span></nav
>

<header class="uhead">
	<div>
		<h1>{data.undertaking.name}</h1>
		<p class="binding">
			Instantiated from <strong>{data.undertaking.pwaName} v{data.undertaking.pwaVersion}</strong> ·
			status <span class="pill">{data.undertaking.status}</span>
		</p>
		<p class="obj">
			{data.undertaking.objective}
			<span class="product">→ {data.undertaking.intendedOutputProduct}</span>
		</p>
	</div>
</header>

<div class="tabs">
	{#each tabs as t (t)}
		<button class:sel={tab === t} onclick={() => (tab = t)}>{t}</button>
	{/each}
</div>

{#if tab === 'graph'}
	<p class="legend">
		Live Professional Work Graph — a <em>projection</em> (View) of the Undertaking's PWU Instances; the
		engine never renders. <b class="g">Green</b> = execution SUCCEEDED <em>and</em> assurance SATISFIED
		(no green without assurance). <b class="a">Amber</b> = succeeded but not yet assured.
		<b class="i">Indigo border</b> = baselined.
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
		{#if data.pwuTypeOptions.length}
			<div class="instwrap">
				<h3>Instantiate a PWU</h3>
				<p class="hint">
					Select a PWU Type from the bound PWA to instantiate it as a PWU Instance in this Undertaking
					(the instance realizes that type — CON-009 ownership).
				</p>
				<form method="POST" action="?/proposePwu" use:enhance class="instform">
					<select name="pwuTypeId" required>
						<option value="" disabled selected>Select a PWU Type…</option>
						{#each data.pwuTypeOptions as o (o.id)}<option value={o.id}>{o.name}</option>{/each}
					</select>
					<input name="title" placeholder="Instance title (optional)" />
					<button class="primary" type="submit">Instantiate PWU</button>
				</form>
			</div>
		{/if}
		{#if form?.error}<p class="err" role="alert">{form.error}</p>{/if}
		<h3>PWU Instances → PWU Types</h3>
		<p class="hint">
			Each PWU Instance realizes a PWU Type defined by the PWA (or is a declared local extension), and
			carries its own four-axis state. Drive its lifecycle with the actions column — a PWU only turns
			green (SATISFIED) once its assurance is SATISFIED (no green without assurance / INV-5).
		</p>
		<div class="tablewrap">
			<table>
				<thead>
					<tr>
						<th>PWU Instance</th>
						<th>Work state</th>
						<th>Execution</th>
						<th>Assurance</th>
						<th>PWU Type (definition)</th>
						<th>Lifecycle actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.pwuList as p (p.id)}
						<tr>
							<td>{p.title}</td>
							<td><span class="tag">{p.workLifecycleState}</span></td>
							<td>{p.executionState || '—'}</td>
							<td>{p.assuranceState}</td>
							<td>
								{#if p.typePwaId}<a href={`/pwa/${p.typePwaId}`}>{p.typeName} ↗</a
									>{:else}{p.typeName}{/if}
							</td>
							<td>
								<div class="acts">
									{#if p.workLifecycleState === 'PROPOSED'}
										<form method="POST" action="?/beginExecute" use:enhance>
											<input type="hidden" name="pwuId" value={p.id} />
											<button class="mini" type="submit">Begin &amp; Execute</button>
										</form>
									{:else if p.workLifecycleState === 'EXECUTING'}
										<form method="POST" action="?/recordAssurance" use:enhance>
											<input type="hidden" name="pwuId" value={p.id} />
											<button class="mini" type="submit">Record Assurance</button>
										</form>
										<form method="POST" action="?/markSatisfied" use:enhance>
											<input type="hidden" name="pwuId" value={p.id} />
											<button class="mini" type="submit">Mark Satisfied</button>
										</form>
									{:else if p.workLifecycleState === 'UNDER_ASSURANCE'}
										<form method="POST" action="?/markSatisfied" use:enhance>
											<input type="hidden" name="pwuId" value={p.id} />
											<button class="mini primary" type="submit">Mark Satisfied</button>
										</form>
									{:else if p.workLifecycleState === 'SATISFIED'}
										<span class="done">✓ satisfied</span>
									{:else}
										<span class="muted">{p.workLifecycleState}</span>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{:else if tab === 'execution'}
	<div class="panel">
		<h2>Execution — plans that perform PWU Instances</h2>
		<p class="hint">
			An Execution Plan is a distinct object that <em>performs</em> a PWU Instance through temporal steps.
			It is not the Professional Work Graph, and it is not named a "workflow" here except for temporal execution
			machinery.
		</p>
		<table>
			<thead><tr><th>Execution Plan</th><th>Performs PWU</th><th>Status</th><th>Steps</th></tr></thead>
			<tbody>
				{#each data.plans as pl (pl.id)}<tr
						><td class="mono">{pl.id.slice(0, 14)}…</td><td class="mono"
							>{pl.workUnitId.slice(0, 14)}…</td
						><td><span class="tag">{pl.status}</span></td><td>{pl.steps}</td></tr
					>{/each}
				{#if !data.plans.length}<tr><td colspan="4" class="none">No execution plans.</td></tr>{/if}
			</tbody>
		</table>
	</div>
{:else if tab === 'assurance'}
	<div class="panel">
		<h2>Assurance — assessments &amp; observations</h2>
		<p class="hint">
			The §38 Assurance View — folded from the governed event stream, not the object store. Independence and
			validator identity read <b>unknown</b> (never a false “none”) when the source event did not carry them.
		</p>
		<table>
			<thead
				><tr
					><th>Assessment</th><th>Policy</th><th>State</th><th>Disposition</th><th>Independence</th><th
						>Validator</th
					></tr
				></thead
			>
			<tbody>
				{#each data.assessments as a (a.id)}
					<tr
						><td class="mono">{a.id.slice(0, 14)}…</td><td>{a.policy}</td><td
							><span class="tag">{a.state}</span></td
						><td>{a.disposition || '—'}</td><td
							><span class="tag">{a.independenceStatus || 'unknown'}</span></td
						><td class="mono"
							>{a.validatorIdentity ? `${a.validatorIdentity}@${a.validatorVersion}` : 'unknown'}</td
						></tr
					>
					{#if a.openConditions.length}<tr
							><td></td><td colspan="5" class="none">Open conditions: {a.openConditions.join('; ')}</td
							></tr
						>{/if}
				{/each}
				{#if !data.assessments.length}<tr><td colspan="6" class="none">No assessments.</td></tr>{/if}
			</tbody>
		</table>
		{#if data.observations.length}
			<h3>Observations</h3>
			{#each data.observations as o (o.id)}<div class="obs">
					<span class="sev">{o.severity}</span>
					{o.statement} <span class="disp">({o.disposition})</span>
				</div>{/each}
		{/if}
	</div>
{:else if tab === 'decisions'}
	<div class="panel">
		<h2>Decisions — governance acts</h2>
		<table>
			<thead><tr><th>Decision</th><th>Type</th><th>Status</th><th>Rationale</th></tr></thead>
			<tbody>
				{#each data.decisions as dc (dc.id)}<tr><td class="mono">{dc.id.slice(0, 14)}…</td><td
							>{dc.type}</td
						><td><span class="tag">{dc.status}</span></td><td>{dc.rationale}</td></tr
					>{/each}
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
				{#each data.baselines as b (b.id)}<tr><td class="mono">{b.id.slice(0, 14)}…</td><td>{b.type}</td
						><td><span class="tag" class:auth={b.status === 'AUTHORITATIVE'}>{b.status}</span></td><td
							>{b.items}</td
						></tr
					>{/each}
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
	.panel .hint {
		color: var(--outline);
		font-size: 12px;
		margin: 0 0 12px;
	}
	.instwrap {
		background: var(--sc);
		border-radius: 10px;
		padding: 14px 16px;
		margin: 8px 0 20px;
	}
	.instwrap h3 {
		margin: 0 0 6px;
	}
	.instform {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.instform select,
	.instform input {
		background: var(--sc-highest);
		border: 1px solid var(--outline-faint);
		color: var(--on);
		border-radius: 6px;
		padding: 8px 11px;
		font-size: 12.5px;
	}
	.instform button.primary {
		background: var(--primary);
		color: #00263f;
		border: none;
		border-radius: 8px;
		padding: 8px 14px;
		font-weight: 700;
		font-size: 12.5px;
		cursor: pointer;
	}
	.err {
		color: var(--error);
		font-size: 12.5px;
		margin: 8px 0 0;
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
	.tablewrap {
		overflow-x: auto;
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
	.acts {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.acts form {
		margin: 0;
	}
	button.mini {
		background: var(--sc-highest);
		color: var(--on);
		border: 1px solid var(--outline-faint);
		border-radius: 6px;
		padding: 4px 9px;
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}
	button.mini.primary {
		background: var(--primary);
		color: #00263f;
		border: none;
	}
	.done {
		color: var(--tertiary);
		font-size: 11px;
		font-weight: 700;
	}
	.muted {
		color: var(--outline);
		font-size: 11px;
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
