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
	let tab = $state<
		'graph' | 'overview' | 'execution' | 'assurance' | 'decisions' | 'baselines' | 'traceability'
	>('graph');
	const tabs = [
		'graph',
		'overview',
		'execution',
		'assurance',
		'decisions',
		'baselines',
		'traceability'
	] as const;

	// Execution plane (JAN-EXECPLAN DWP-02): group the undertaking-scoped Execution Plans by the PWU Instance they
	// perform, and title each group from the PWU list. The plans are already scoped + shaped server-side (F-6 fix).
	const pwuTitleById = $derived(new Map(data.pwuList.map((p) => [p.id, p.title])));
	const plansByPwu = $derived.by(() => {
		const groups = new Map<string, typeof data.plans>();
		for (const pl of data.plans) {
			const g = groups.get(pl.workUnitId) ?? [];
			g.push(pl);
			groups.set(pl.workUnitId, g);
		}
		return [...groups.entries()].map(([pwuId, plans]) => ({
			pwuId,
			title: pwuTitleById.get(pwuId) ?? pwuId,
			plans
		}));
	});
	// DWP-03: the step affordance → form-action + label. Keyed to the read-model's advanceCommands (the FOUR
	// command-backed transitions ONLY — never the wider stepState machine topology, F-11). A stepState with no
	// command-backed transition yields no entry here and renders no button.
	const STEP_ACTION = {
		start: 'startStep',
		complete: 'completeStep',
		fail: 'failStep',
		retry: 'retryStep'
	} as const;
	const STEP_LABEL = { start: 'Start', complete: 'Complete', fail: 'Fail', retry: 'Retry' } as const;
	// DWP-04: which instances a hand-off advisory flags (display-only highlight; the advisory gates nothing).
	const advisoryConsumerIds = $derived(new Set(data.sequence.advisories.map((a) => a.consumerInstanceId)));
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
		<p class="hint dim" data-testid="exec-nocomplete">
			Plans are driven step-by-step (Start · Complete · Fail · Retry) and cancelled as a whole. The domain has
			no plan-COMPLETION command yet, so a fully-succeeded plan stays ACTIVE — surfaced honestly, not faked
			(JAN-EXECPLAN §15 / F-9).
		</p>
		{#if form?.error}<p class="err" role="alert" data-testid="exec-error">{form.error}</p>{/if}
		{#if !plansByPwu.length}
			<p class="none" data-testid="exec-empty">No execution plans for this undertaking.</p>
		{/if}
		{#each plansByPwu as group (group.pwuId)}
			<div class="planpwu" data-testid="exec-pwu-group">
				<h3 class="pwuhead">
					{group.title} <span class="mono dim">{group.pwuId.slice(0, 14)}…</span>
				</h3>
				{#each group.plans as pl (pl.id)}
					<div class="plancard" data-testid="exec-plan">
						<div class="planhead">
							<span class="mono">{pl.id.slice(0, 14)}…</span>
							<span class="tag">{pl.status}</span>
							{#if pl.planVersion !== undefined}<span class="dim">v{pl.planVersion}</span>{/if}
							{#if pl.status !== 'CANCELLED'}
								<form method="POST" action="?/cancelPlan" use:enhance class="inlineform">
									<input type="hidden" name="planId" value={pl.id} />
									<button class="mini" data-testid="plan-cancel">Cancel plan</button>
								</form>
							{/if}
						</div>
						{#if !pl.steps.length}<p class="none">No steps.</p>{/if}
						<ol class="steps">
							{#each pl.steps as s (s.id)}
								<li class="step" data-testid="exec-step">
									<span class="st {s.tone}" data-testid="step-state">{s.stepState}</span>
									<span class="stype">{s.stepType}</span>
									<span class="spurpose">{s.purpose}</span>
									{#if s.runtimeBindingId}<span class="dim mono">rb {s.runtimeBindingId.slice(0, 10)}…</span
										>{/if}
									<span class="stepacts">
										{#each s.advanceCommands as cmd (cmd)}
											{#if cmd === 'complete'}
												<!-- Complete names its produced output + provenance. Empty + non-AI = a HUMAN no-output
												     completion the floor gate admits; an AI-produced output whose floor is unsatisfied is
												     REJECTED by the §8.4 gate (surfaced verbatim above). -->
												<form
													method="POST"
													action="?/completeStep"
													use:enhance
													class="inlineform completeform"
												>
													<input type="hidden" name="planId" value={pl.id} />
													<input type="hidden" name="stepId" value={s.id} />
													<input
														name="outputArtifactId"
														placeholder="output id"
														class="tinyinput"
														data-testid="complete-output"
													/>
													<label class="ailbl"
														><input
															type="checkbox"
															name="aiProduced"
															value="true"
															data-testid="complete-ai"
														/> AI</label
													>
													<button class="mini" data-testid="step-action-complete">Complete</button>
												</form>
											{:else}
												<form method="POST" action="?/{STEP_ACTION[cmd]}" use:enhance class="inlineform">
													<input type="hidden" name="planId" value={pl.id} />
													<input type="hidden" name="stepId" value={s.id} />
													<button class="mini" data-testid="step-action-{cmd}">{STEP_LABEL[cmd]}</button>
												</form>
											{/if}
										{/each}
										{#if s.belowQueued}
											<span class="dim" data-testid="step-belowqueued"
												>no advance command in the domain (below QUEUED)</span
											>
										{/if}
									</span>
								</li>
							{/each}
						</ol>
					</div>
				{/each}
			</div>
		{/each}

		<!-- DWP-04 (Tier 2, fork C): the Undertaking execution SEQUENCE + the layerHandoff advisory. Instances are
		     arranged by their TYPES' hand-off DEPENDENCY (a partial order — a shared layer is concurrent), NOT an
		     execution schedule (§9.1). The advisory is a coherence check that gates NOTHING. -->
		<h3 class="t2head">Execution sequence — hand-off dependency</h3>
		<p class="hint dim" data-testid="seq-caveat">
			Instances arranged by their PWU Types' hand-off dependency — a partial order (a shared layer runs
			independently), NOT an execution schedule (§9.1). The advisory below is a coherence surface; it gates
			nothing (fork C).
		</p>
		{#each data.sequence.layers as layer (layer.index)}
			<div class="seqlayer" data-testid="seq-layer">
				<span class="dim seqlabel">dep {layer.index + 1}</span>
				{#each layer.instances as si (si.id)}
					<span
						class="seqinst"
						class:flagged={advisoryConsumerIds.has(si.id)}
						data-testid="seq-instance">{si.title} <span class="tag">{si.executionState || '—'}</span></span
					>
				{/each}
			</div>
		{/each}
		{#if data.sequence.unplaced.length}
			<div class="seqlayer">
				<span class="dim seqlabel">unplaced</span>
				{#each data.sequence.unplaced as si (si.id)}
					<span class="seqinst" data-testid="seq-unplaced"
						>{si.title} <span class="tag">{si.executionState || '—'}</span>
						<span class="dim">({si.reason})</span></span
					>
				{/each}
			</div>
		{/if}
		{#if data.sequence.advisories.length}
			<div class="advisories" data-testid="seq-advisories">
				{#each data.sequence.advisories as a (a.consumerInstanceId + a.producerTypeId + a.artifact)}
					<p class="advisory" data-testid="seq-advisory">⚠ {a.consumerTitle}: {a.detail}</p>
				{/each}
			</div>
		{:else}
			<p class="dim" data-testid="seq-noadvisory">No hand-off coherence advisories.</p>
		{/if}
	</div>
{:else if tab === 'assurance'}
	<div class="panel">
		<h2>Assurance — §38 Assurance Workbench</h2>
		<p class="hint">
			The §38 Assurance View — folded from the governed event stream, not the object store. Every §38 field is
			sourced except <b>missing evidence</b> (its events are unbuilt); unsourced fields read <b>unknown</b>,
			never a false “none”.
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
					<tr class="detail">
						<td></td>
						<td colspan="5">
							<div class="kv"><span>Claims evaluated</span><b>{a.claimsEvaluated.join(', ') || 'none'}</b></div>
							<div class="kv">
								<span>Evidence considered</span><b>{a.evidenceConsidered.join(', ') || 'none'}</b>
							</div>
							<div class="kv">
								<span>Missing evidence</span><b
									>{a.missingEvidence.length ? a.missingEvidence.join(', ') : 'none'}</b
								>
							</div>
							<div class="kv"><span>Control actions</span><b>{a.controlActions.join(', ') || 'none'}</b></div>
							<div class="kv">
								<span>Findings</span><b
									>{a.findings.length
										? a.findings.map((f) => `${f.code} [${f.severity}]`).join('; ')
										: 'none'}</b
								>
							</div>
							<div class="kv">
								<span>Waivers</span><b
									>{a.waivers.length ? a.waivers.map((w) => w.status).join('; ') : 'none'}</b
								>
							</div>
							<div class="kv">
								<span>Invalidation</span><b
									>{a.invalidations.length ? a.invalidations.map((i) => i.status).join('; ') : 'valid'}</b
								>
							</div>
							{#if a.openConditions.length}
								<div class="kv"><span>Open conditions</span><b>{a.openConditions.join('; ')}</b></div>
							{/if}
						</td>
					</tr>
				{/each}
				{#if !data.assessments.length}<tr><td colspan="6" class="none">No assessments.</td></tr>{/if}
			</tbody>
		</table>

		{#each data.applicablePolicies as ap (ap.pwuId)}
			<h3>Applicable policies — {ap.pwuTitle}</h3>
			<table>
				<thead><tr><th>Policy</th><th>Applies via</th><th>Assessment</th></tr></thead>
				<tbody>
					{#each ap.rows as r (r.policyId)}
						<tr
							><td class="mono">{r.policyId}</td><td><span class="tag">{r.source}</span></td><td
								>{#if r.assessed}{r.disposition || 'ASSESSING'}{:else}<span class="req"
										>REQUIRED — UNASSESSED</span
									>{/if}</td
							></tr
						>
					{/each}
				</tbody>
			</table>
		{/each}

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
{:else if tab === 'baselines'}
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
{:else}
	<!-- W4-INC-1 (WP-4-007): the intent-to-baseline TRACEABILITY surface, consuming the rph-projections
	     traceabilityProjector (W2-INC-3). A derived, read-only typed-link view — never authoritative state. -->
	<div class="panel" data-testid="traceability-panel">
		<h2>Traceability — typed intent-to-baseline links</h2>
		<p class="hint">
			Derived from the event log (rebuildable projection); scoped to this Undertaking's PWUs. Carries no
			authority.
		</p>
		<div class="trace-counts">
			{#each Object.entries(data.trace.counts) as [type, n] (type)}
				<span class="tag" data-trace-type={type}>{type} · {n}</span>
			{/each}
		</div>
		<table>
			<thead><tr><th>From</th><th>Link</th><th>To</th></tr></thead>
			<tbody>
				{#each data.trace.links as l, i (i)}
					<tr>
						<td class="mono">{l.from.slice(0, 16)}…</td>
						<td><span class="tag">{l.type}</span></td>
						<td class="mono">{l.to.slice(0, 16)}…</td>
					</tr>
				{/each}
				{#if !data.trace.links.length}
					<tr><td colspan="3" class="none">No traceability links.</td></tr>
				{/if}
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
	/* Execution plane (DWP-02): per-PWU plan → steps panel. */
	.planpwu {
		margin: 10px 0 16px;
	}
	.pwuhead {
		font-size: 13px;
		margin: 0 0 6px;
		display: flex;
		gap: 8px;
		align-items: baseline;
	}
	.plancard {
		border: 1px solid var(--outline-faint);
		border-radius: 8px;
		padding: 8px 10px;
		margin: 6px 0;
		background: var(--surface-low);
	}
	.planhead {
		display: flex;
		gap: 8px;
		align-items: center;
		margin-bottom: 6px;
	}
	.dim {
		color: var(--outline);
		font-size: 11px;
	}
	ol.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.step {
		display: flex;
		gap: 8px;
		align-items: center;
		font-size: 12px;
		flex-wrap: wrap;
	}
	.stype {
		color: var(--on-variant);
		font-weight: 600;
	}
	.spurpose {
		color: var(--on);
	}
	/* stepState tone → colour. Every StepState maps to a defined tone in rph-projections (state-transition totality,
	   EP-TST-5); these five classes cover all five tones — no stepState renders without a colour. */
	.st {
		font-size: 10px;
		font-weight: 700;
		padding: 2px 7px;
		border-radius: 4px;
		border: 1px solid transparent;
		white-space: nowrap;
	}
	.st.positive {
		color: var(--tertiary);
		border-color: var(--tertiary);
	}
	.st.active {
		color: var(--indigo);
		border-color: var(--indigo);
	}
	.st.negative {
		color: var(--error);
		border-color: var(--error);
	}
	.st.pending {
		color: var(--amber);
		border-color: var(--amber);
	}
	.st.muted {
		color: var(--outline);
		border-color: var(--outline-faint);
	}
	.stepacts {
		display: inline-flex;
		gap: 6px;
		align-items: center;
		flex-wrap: wrap;
		margin-left: auto;
	}
	.inlineform {
		margin: 0;
		display: inline;
	}
	.completeform {
		display: inline-flex;
		gap: 4px;
		align-items: center;
	}
	.tinyinput {
		width: 96px;
		font-size: 10px;
		padding: 2px 5px;
	}
	.ailbl {
		font-size: 10px;
		color: var(--outline);
		display: inline-flex;
		gap: 2px;
		align-items: center;
	}
	/* Tier-2 execution sequence (DWP-04): dependency layers + advisories. */
	.t2head {
		margin-top: 18px;
	}
	.seqlayer {
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
		padding: 4px 0;
	}
	.seqlabel {
		min-width: 64px;
		font-size: 11px;
	}
	.seqinst {
		display: inline-flex;
		gap: 6px;
		align-items: center;
		font-size: 12px;
		border: 1px solid var(--outline-faint);
		border-radius: 6px;
		padding: 3px 8px;
	}
	.seqinst.flagged {
		border-color: var(--amber);
	}
	.advisories {
		margin-top: 8px;
	}
	.advisory {
		font-size: 12px;
		color: var(--amber);
		margin: 3px 0;
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
	tr.detail td {
		padding-top: 2px;
		padding-bottom: 8px;
	}
	.kv {
		display: flex;
		gap: 8px;
		font-size: 11.5px;
		line-height: 1.7;
	}
	.kv span {
		color: var(--outline);
		min-width: 132px;
	}
	.kv b {
		color: var(--on-variant);
		font-weight: 600;
	}
	.req {
		color: var(--error, #ff6b6b);
		font-weight: 700;
		font-size: 11px;
	}
</style>
