<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { SvelteFlow, Background, Controls, Panel } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import type { Edge, Node } from '@xyflow/svelte';
	import { toPwaFlow } from '$lib/pwaFlow';
	import PwuTypeCard from '$lib/PwuTypeCard.svelte';
	import { analyzePwaGraph, buildPwaGraphExport } from '@janumipwb/rph-projections';
	import {
		PWU_TYPE_CATALOG,
		PWU_TYPE_HELP,
		ASSURANCE_FLOOR,
		ASSURANCE_POLICY_CATALOG,
		assurancePolicyLabel
	} from '$lib/authoring/pwuType';
	import type { PageData } from './$types';
	let {
		data,
		form
	}: {
		data: PageData;
		form: {
			error?: string;
			definedType?: string;
			editedType?: string;
			removedType?: string;
			editedPwa?: string;
			advanced?: string;
		} | null;
	} = $props();

	// Selection = an explicit user/agent override, falling back to the root (or first) type. Deriving it from `data`
	// keeps it correct when the graph changes and self-heals when the selected type is removed.
	let selectedOverride = $state<string | null>(null);
	const selected = $derived(
		selectedOverride && data.types.some((t) => t.id === selectedOverride)
			? selectedOverride
			: (data.types.find((t) => t.isRoot)?.id ?? data.types[0]?.id ?? '')
	);
	const current = $derived(data.types.find((t) => t.id === selected));
	const editable = $derived(data.pwa.publicationStatus === 'DRAFT');
	// A floor waiver is a pre-publication override — offer it through the publish FSM up to (not incl.) PUBLISHED.
	const canWaive = $derived(
		['DRAFT', 'UNDER_REVIEW', 'VALIDATED'].includes(data.pwa.publicationStatus)
	);
	const hasRoot = $derived(data.types.some((t) => t.isRoot));
	const RANK: Record<string, number> = {
		DRAFT: 1,
		UNDER_REVIEW: 2,
		VALIDATED: 3,
		PUBLISHED: 4,
		DEPRECATED: 5,
		RETIRED: 6
	};
	const rank = $derived(RANK[data.pwa.publicationStatus] ?? 0);

	// Node graph: PWU Types are nodes rendered by the PwuTypeCard custom node. The BASE view is the composition
	// ("permits") tree, laid out top-down by dagre. Data-flow (requiredOutputs→requiredInputs) is a SEPARATE overlay,
	// off by default (§11.7.2: composition ≠ order). Collapsing a non-leaf hides its subtree. Recomputed when the
	// DRAFT, selection, collapse set, or overlay toggle changes.
	const nodeTypes = { pwuType: PwuTypeCard };
	let collapsed = $state<Set<string>>(new Set());
	let showDataFlow = $state(false);
	function toggleCollapse(id: string) {
		const next = new Set(collapsed);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		collapsed = next;
	}
	const flow = $derived(
		toPwaFlow(data.types, { collapsed, showDataFlow, onToggleCollapse: toggleCollapse })
	);
	let nodes = $state<Node[]>([]);
	let edges = $state<Edge[]>([]);

	// Structural health of the graph — the same queryable report the harness asserts on (single root, acyclic,
	// connected; advisory findings for dangling data-flow / fan-out). Surfaced as a chip so the author sees issues.
	const graphReport = $derived(
		analyzePwaGraph(
			buildPwaGraphExport(
				{
					id: data.pwa.id,
					name: data.pwa.name,
					domain: data.pwa.domain,
					version: data.pwa.version,
					publicationStatus: data.pwa.publicationStatus
				},
				data.types.map((t) => ({
					id: t.id,
					name: t.name,
					pwuKind: t.pwuKind,
					isRoot: t.isRoot,
					permittedChildTypeIds: t.permittedChildTypeIds,
					requiredInputs: t.requiredInputs,
					requiredOutputs: t.requiredOutputs
				}))
			)
		)
	);
	const graphIssues = $derived(
		graphReport.invariants.filter((i) => !i.ok).length + graphReport.findings.length
	);
	const graphHealthTitle = $derived(
		[
			...graphReport.invariants.map((i) => `${i.ok ? '✓' : '✗'} ${i.name}: ${i.detail}`),
			...graphReport.findings.map((f) => `• ${f}`)
		].join('\n')
	);
	$effect(() => {
		nodes = flow.nodes;
		edges = flow.edges;
	});

	// Shared define/edit PWU Type form: formMode is null (inspector shows the selected node) | 'define' | { editId }.
	type FormMode = null | 'define' | { editId: string };
	let formMode = $state<FormMode>(null);
	let showPwaEdit = $state(false);
	let agentCollapsed = $state(false);
	const f = $state({
		name: '',
		pwuKind: '',
		purpose: '',
		completionRule: '',
		isRoot: false,
		requiredInputs: '',
		requiredOutputs: ''
	});
	let children = $state<string[]>([]);
	// Selected declared assurance policy ids for the type being authored.
	let policies = $state<string[]>([]);
	// Per-child cardinality being authored, keyed by child type id (only meaningful for checked children).
	let childRules = $state<Record<string, { cardinality: string; note: string }>>({});
	const editingId = $derived(typeof formMode === 'object' && formMode ? formMode.editId : '');

	$effect(() => {
		if (form?.definedType) {
			selectedOverride = form.definedType;
			formMode = null;
		} else if (form?.editedType || form?.removedType) {
			formMode = null;
		}
	});

	function openDefine() {
		Object.assign(f, {
			name: '',
			pwuKind: '',
			purpose: '',
			completionRule: '',
			isRoot: false,
			requiredInputs: '',
			requiredOutputs: ''
		});
		children = [];
		policies = [];
		childRules = {};
		formMode = 'define';
	}
	function openEdit(id: string) {
		const t = data.types.find((x) => x.id === id);
		if (!t) return;
		Object.assign(f, {
			name: t.name,
			pwuKind: t.pwuKind,
			purpose: t.purpose,
			completionRule: t.completionRule,
			isRoot: t.isRoot,
			requiredInputs: t.requiredInputs.join(', '),
			requiredOutputs: t.requiredOutputs.join(', ')
		});
		children = [...t.permittedChildTypeIds];
		policies = [...t.requiredAssurancePolicyIds];
		childRules = Object.fromEntries(
			t.permittedChildren.map((r) => [
				r.typeId,
				{ cardinality: r.cardinality, note: r.applicabilityNote ?? '' }
			])
		);
		formMode = { editId: id };
	}
	function applyTemplate(key: string) {
		const t = PWU_TYPE_CATALOG.find((x) => x.key === key);
		if (!t) return;
		Object.assign(f, {
			name: t.name,
			pwuKind: t.pwuKind,
			purpose: t.purpose,
			isRoot: t.isRoot,
			requiredInputs: (t.requiredInputs ?? []).join(', '),
			requiredOutputs: (t.requiredOutputs ?? []).join(', ')
		});
	}
	function toggleChild(id: string, on: boolean) {
		children = on ? [...children, id] : children.filter((c) => c !== id);
		if (on && !childRules[id]) childRules = { ...childRules, [id]: { cardinality: 'M1', note: '' } };
	}
	function togglePolicy(id: string, on: boolean) {
		policies = on ? [...policies, id] : policies.filter((p) => p !== id);
	}

	// ---- The authoring agent: chat + reasoning log, driving the SAME engine via the SSE relay; the graph
	// re-renders live as each tool call commits (invalidateAll re-runs load -> data.types -> flow).
	type LogEntry = {
		kind: 'status' | 'text' | 'thinking' | 'tool' | 'toolend' | 'error';
		text: string;
		ok?: boolean;
	};
	function policyLabel(id: string): string {
		return assurancePolicyLabel(id);
	}

	const MUTATING = new Set([
		'set_pwa_details',
		'define_pwu_type',
		'define_from_template',
		'edit_pwu_type',
		'remove_pwu_type',
		'link_types',
		'unlink_types',
		'scaffold_graph'
	]);
	let chatInput = $state('');
	let running = $state(false);
	let log = $state<LogEntry[]>([]);

	// Hydrate the log from the DURABLE, event-sourced conversation when the PWA loads or changes — the transcript
	// survives reloads/navigation (it is domain state in the engine, not client memory). Guarded so a live run (and
	// its invalidateAll graph refreshes) never clobbers the in-flight log.
	let hydratedFor = $state('');
	$effect(() => {
		if (data.pwa.id !== hydratedFor && !running) {
			log = data.conversation ?? [];
			hydratedFor = data.pwa.id;
		}
	});

	function push(entry: LogEntry) {
		log = [...log, entry];
	}
	function appendText(kind: 'text' | 'thinking', t: string) {
		const last = log[log.length - 1];
		if (last && last.kind === kind) {
			last.text += t;
			log = [...log];
		} else push({ kind, text: t });
	}

	async function sendToAgent(e: SubmitEvent) {
		e.preventDefault();
		const instruction = chatInput.trim();
		if (!instruction || running) return;
		running = true;
		agentCollapsed = false;
		push({ kind: 'text', text: `You: ${instruction}` });
		chatInput = '';
		try {
			const res = await fetch(`/pwa/${data.pwa.id}/agent`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ instruction })
			});
			if (!res.ok || !res.body) {
				push({ kind: 'error', text: `Agent request failed (${res.status}).` });
				return;
			}
			const reader = res.body.getReader();
			const dec = new TextDecoder();
			let buf = '';
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				buf += dec.decode(value, { stream: true });
				let idx: number;
				while ((idx = buf.indexOf('\n\n')) >= 0) {
					const line = buf
						.slice(0, idx)
						.split('\n')
						.find((l) => l.startsWith('data:'));
					buf = buf.slice(idx + 2);
					if (!line) continue;
					await handleEvent(JSON.parse(line.slice(5).trim()));
				}
			}
		} catch (err) {
			push({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
		} finally {
			running = false;
			await invalidateAll();
		}
	}

	async function handleEvent(ev: {
		kind: string;
		text?: string;
		tool?: string;
		args?: Record<string, unknown>;
		ok?: boolean;
		summary?: string;
		message?: string;
	}) {
		switch (ev.kind) {
			case 'status':
				push({ kind: 'status', text: ev.text ?? '' });
				break;
			case 'text':
				appendText('text', ev.text ?? '');
				break;
			case 'thinking':
				appendText('thinking', ev.text ?? '');
				break;
			case 'tool_start':
				push({ kind: 'tool', text: `${ev.tool}(${compactArgs(ev.args)})` });
				break;
			case 'tool_end':
				push({ kind: 'toolend', text: `${ev.tool}: ${ev.summary ?? ''}`, ok: ev.ok });
				if (ev.ok && ev.tool && MUTATING.has(ev.tool)) await invalidateAll();
				break;
			case 'error':
				push({ kind: 'error', text: ev.message ?? 'error' });
				break;
			default:
				break;
		}
	}
	function compactArgs(args: Record<string, unknown> | undefined): string {
		if (!args) return '';
		return Object.entries(args)
			.map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
			.join(', ');
	}
</script>

{#snippet fhead(label: string, help: string)}
	<div class="fld">
		<span class="flabel">{label}</span>
		<span class="fhelp">{help}</span>
	</div>
{/snippet}

<svelte:head><title>{data.pwa.name} — Work Architecture</title></svelte:head>

<div class="designer">
	<header class="topbar">
		<div class="tbmain">
			<nav class="crumbs"><a href="/">PWA Library</a> › <span>{data.pwa.name}</span></nav>
			<div class="titlerow">
				<h1>{data.pwa.name}</h1>
				<span class="pill" class:pub={data.pwa.publicationStatus === 'PUBLISHED'}
					>{data.pwa.publicationStatus}</span
				>
				<span class="tbmeta">v{data.pwa.version} · {data.pwa.domain}</span>
				{#if data.types.length}
					<span
						class="health"
						class:bad={!graphReport.valid}
						class:warn={graphReport.valid && graphReport.findings.length > 0}
						title={graphHealthTitle}
						data-testid="graph-health"
					>
						{graphReport.valid
							? graphReport.findings.length
								? `⚠ ${graphIssues} note(s)`
								: '✓ well-formed'
							: `✗ ${graphIssues} issue(s)`}
					</span>
				{/if}

				{#if data.floor}
					<span
						class="floorchip"
						class:bad={data.floor.aggregate === 'REJECTED'}
						class:warn={!data.floor.satisfied && data.floor.aggregate !== 'REJECTED'}
						class:ok={data.floor.satisfied}
						title="De minimis assurance floor — schema, provenance, and an independent reasoning review (exec ≠ assurance)"
						data-testid="assurance-chip"
					>
						⚖ {data.floor.satisfied ? 'floor satisfied' : `floor ${data.floor.aggregate.toLowerCase()}`}
					</span>
				{/if}
				{#if editable}
					<button class="ghost small" onclick={() => (showPwaEdit = !showPwaEdit)}>Edit details</button>
				{/if}
			</div>
			{#if editable && showPwaEdit}
				<form method="POST" action="?/editDetails" use:enhance class="detailform">
					<input name="name" value={data.pwa.name} placeholder="PWA name" required />
					<input name="domain" value={data.pwa.domain} placeholder="Domain" />
					<input name="description" value={data.pwa.description} placeholder="Description" />
					<button class="primary small" type="submit">Save</button>
					<button type="button" class="ghost small" onclick={() => (showPwaEdit = false)}>Cancel</button>
				</form>
			{/if}
			{#if form?.error}<p class="err" role="alert">{form.error}</p>{/if}
		</div>

		<div class="tbpub">
			<ol class="steps">
				<li class:done={rank > 1} class:active={data.pwa.publicationStatus === 'DRAFT'}>Draft</li>
				<li class:done={rank > 2} class:active={data.pwa.publicationStatus === 'UNDER_REVIEW'}>Review</li>
				<li class:done={rank > 3} class:active={data.pwa.publicationStatus === 'VALIDATED'}>Valid.</li>
				<li class:done={rank > 4} class:active={data.pwa.publicationStatus === 'PUBLISHED'}>Pub.</li>
				<li class:done={rank > 5} class:active={data.pwa.publicationStatus === 'DEPRECATED'}>Deprec.</li>
				<li class:done={rank > 6} class:active={data.pwa.publicationStatus === 'RETIRED'}>Retired</li>
			</ol>
			<div class="pubact">
				{#if editable}
					<button class="ghost small" onclick={openDefine}>+ Define PWU Type</button>
				{/if}
				{#if data.pwa.publicationStatus === 'DRAFT'}
					<form method="POST" action="?/submitForReview" use:enhance>
						<button class="ghost small" type="submit" disabled={!hasRoot}>Submit for Review →</button>
					</form>
				{:else if data.pwa.publicationStatus === 'UNDER_REVIEW'}
					<form method="POST" action="?/validate" use:enhance>
						<button class="ghost small" type="submit">Validate →</button>
					</form>
				{:else if data.pwa.publicationStatus === 'VALIDATED'}
					<form method="POST" action="?/publish" use:enhance>
						<button class="primary small" type="submit">Publish</button>
					</form>
				{:else if data.pwa.publicationStatus === 'PUBLISHED'}
					<span class="immutable">🔒 Published versions are immutable</span>
					<form method="POST" action="?/deprecate" use:enhance>
						<button class="ghost small" type="submit">Deprecate</button>
					</form>
				{:else if data.pwa.publicationStatus === 'DEPRECATED'}
					<form method="POST" action="?/retire" use:enhance>
						<button class="ghost small" type="submit">Retire</button>
					</form>
				{:else if data.pwa.publicationStatus === 'RETIRED'}
					<span class="retired">retired</span>
				{/if}
			</div>
		</div>
	</header>

	<div class="canvas">
		<div class="flowarea">
			<SvelteFlow
			bind:nodes
			bind:edges
			{nodeTypes}
			onnodeclick={(e) => (selectedOverride = e.node.id)}
			fitView
			fitViewOptions={{ padding: 0.22, minZoom: 0.25 }}
		>
			<Background />
			<Controls position="bottom-right" />

			<Panel position="bottom-left">
				<div class="overlaytoggle" data-testid="overlay-toggle">
					<label class="ovlabel">
						<input type="checkbox" bind:checked={showDataFlow} />
						Data-flow overlay
					</label>
					{#if collapsed.size}
						<button class="ghost small" onclick={() => (collapsed = new Set())}>Expand all</button>
					{/if}
				</div>
			</Panel>

			{#if editable}
				<Panel position="top-left">
					<section class="agentpanel" class:collapsed={agentCollapsed} data-testid="agent-panel">
						<header class="ppanelhead">
							<span class="itag">AI AGENT</span>
							<div class="pheadright">
								{#if running}<span class="livedot">● working…</span>{/if}
								<button
									class="collapsebtn"
									onclick={() => (agentCollapsed = !agentCollapsed)}
									aria-label={agentCollapsed ? 'Expand agent panel' : 'Collapse agent panel'}
									>{agentCollapsed ? '▸' : '▾'}</button
								>
							</div>
						</header>
						{#if !agentCollapsed}
							<div class="agentlog" data-testid="agent-log">
								{#if log.length === 0}
									<p class="logempty">
										Describe what you want and the JPWB agent proposes the PWU Types + links onto this
										DRAFT. You review and publish.
									</p>
								{/if}
								{#each log as entry, i (i)}
									<div
										class="logentry {entry.kind}"
										class:bad={entry.kind === 'toolend' && entry.ok === false}
									>
										{#if entry.kind === 'tool'}<span class="logmark">▶</span>{:else if entry.kind === 'toolend'}<span
												class="logmark">{entry.ok === false ? '✗' : '✓'}</span
											>{:else if entry.kind === 'thinking'}<span class="logmark">…</span>{:else if entry.kind === 'error'}<span
												class="logmark">!</span
											>{/if}<span class="logtext">{entry.text}</span>
									</div>
								{/each}
							</div>
						{/if}
					</section>
				</Panel>
			{/if}

			<Panel position="top-right">
				<aside class="inspectorpanel">
					{#if editable && formMode !== null}
						{@const editing = editingId !== ''}
						<div class="itag">{editing ? 'EDIT PWU TYPE' : 'NEW PWU TYPE'}</div>
						<form
							method="POST"
							action={editing ? '?/editType' : '?/defineType'}
							use:enhance
							class="typeform"
						>
							{#if editing}<input type="hidden" name="pwuTypeId" value={editingId} />{/if}
							{#if !editing}
								<div class="ffield">
									<span class="flabel">Start from template</span>
									<span class="fhelp">Copy a reusable blueprint from the catalog, then edit it freely.</span>
									<select class="tplsel" onchange={(e) => applyTemplate(e.currentTarget.value)}>
										<option value="">— blank —</option>
										{#each PWU_TYPE_CATALOG as t (t.key)}<option value={t.key}>{t.name}</option>{/each}
									</select>
								</div>
							{/if}
							<div class="ffield">
								{@render fhead('Name', PWU_TYPE_HELP.name)}
								<input name="name" bind:value={f.name} required />
							</div>
							<div class="ffield">
								{@render fhead('Kind', PWU_TYPE_HELP.pwuKind)}
								<input name="pwuKind" bind:value={f.pwuKind} placeholder="ARCHITECTURE" required />
							</div>
							<div class="ffield">
								{@render fhead('Purpose', PWU_TYPE_HELP.purpose)}
								<textarea name="purpose" bind:value={f.purpose} rows="2"></textarea>
							</div>
							<div class="ffield">
								{@render fhead('Completion rule', PWU_TYPE_HELP.completionRule)}
								<input
									name="completionRule"
									bind:value={f.completionRule}
									placeholder="(defaults to the RPH rule)"
								/>
							</div>
							<div class="ffield">
								{@render fhead('Required inputs', PWU_TYPE_HELP.requiredInputs)}
								<input name="requiredInputs" bind:value={f.requiredInputs} placeholder="approved-behavior" />
							</div>
							<div class="ffield">
								{@render fhead('Required outputs', PWU_TYPE_HELP.requiredOutputs)}
								<input
									name="requiredOutputs"
									bind:value={f.requiredOutputs}
									placeholder="architecture-baseline"
								/>
							</div>
							<div class="ffield">
								<label class="rootcheck"
									><input type="checkbox" name="isRoot" bind:checked={f.isRoot} /> Root type</label
								>
								<span class="fhelp">{PWU_TYPE_HELP.isRoot}</span>
							</div>
							<div class="ffield">
								{@render fhead('Permitted child types + cardinality', PWU_TYPE_HELP.permittedChildren)}
								<div class="childlist">
									{#each data.types.filter((t) => t.id !== editingId) as t (t.id)}
										{@const rule = childRules[t.id] ?? { cardinality: 'M1', note: '' }}
										<div class="childrow">
											<label class="childopt">
												<input
													type="checkbox"
													name="permittedChildTypeIds"
													value={t.id}
													checked={children.includes(t.id)}
													onchange={(e) => toggleChild(t.id, e.currentTarget.checked)}
												/>
												{t.name}
											</label>
											{#if children.includes(t.id)}
												<select
													class="cardsel"
													name={`cardinality:${t.id}`}
													value={rule.cardinality}
													onchange={(e) =>
														(childRules = {
															...childRules,
															[t.id]: { ...rule, cardinality: e.currentTarget.value }
														})}
													aria-label={`Cardinality for ${t.name}`}
												>
													<option value="M1">M1 · exactly one</option>
													<option value="M+">M+ · one or more</option>
													<option value="C1">C1 · conditional, 0 or 1</option>
													<option value="C+">C+ · conditional, 0 or more</option>
												</select>
												{#if rule.cardinality === 'C1' || rule.cardinality === 'C+'}
													<input
														class="cardnote"
														name={`applicability:${t.id}`}
														value={rule.note}
														oninput={(e) =>
															(childRules = {
																...childRules,
																[t.id]: { ...rule, note: e.currentTarget.value }
															})}
														placeholder="when does this child apply?"
														aria-label={`Applicability for ${t.name}`}
													/>
												{/if}
											{/if}
										</div>
									{/each}
									{#if data.types.filter((t) => t.id !== editingId).length === 0}
										<span class="fhelp">Define more types to allow composition.</span>
									{/if}
								</div>
							</div>
							<div class="ffield">
								{@render fhead('Declared assurance policies', PWU_TYPE_HELP.requiredAssurancePolicyIds)}
								<div class="policylist">
									<div class="floornote">
										🔒 de minimis floor · always applies · not listed here
									</div>
									{#each ASSURANCE_POLICY_CATALOG as p (p.id)}
										<label class="childopt" title={p.blurb}>
											<input
												type="checkbox"
												name="requiredAssurancePolicyIds"
												value={p.id}
												checked={policies.includes(p.id)}
												onchange={(e) => togglePolicy(p.id, e.currentTarget.checked)}
											/>
											{p.label}
										</label>
									{/each}
								</div>
							</div>
							<div class="formactions">
								<button class="primary small" type="submit">{editing ? 'Save changes' : 'Add type'}</button>
								<button type="button" class="ghost small" onclick={() => (formMode = null)}>Cancel</button
								>
							</div>
						</form>
					{:else if current}
						<div class="itag">PWU TYPE</div>
						<h3>{current.name}</h3>
						<div class="field"><span class="flabel">Kind</span><p class="mono">{current.pwuKind}</p></div>
						<div class="field"><span class="flabel">Purpose</span><p>{current.purpose}</p></div>
						<div class="field">
							<span class="flabel">Completion rule</span><p class="mono">{current.completionRule || '—'}</p>
						</div>
						<div class="field">
							<span class="flabel">Required inputs</span>
							<p>{current.requiredInputs.length ? current.requiredInputs.join(', ') : '—'}</p>
						</div>
						<div class="field">
							<span class="flabel">Required outputs</span>
							<p>{current.requiredOutputs.length ? current.requiredOutputs.join(', ') : '—'}</p>
						</div>
						<div class="field">
							<span class="flabel">Permitted children</span>
							{#if current.permittedChildTypeIds.length === 0}
								<p>— (leaf)</p>
							{:else}
								<ul class="childcards">
									{#each current.permittedChildTypeIds as cid (cid)}
										{@const rule = current.permittedChildren.find((r) => r.typeId === cid)}
										{@const child = data.types.find((t) => t.id === cid)}
										<li>
											<span class="cardbadge">{rule?.cardinality ?? 'M1'}</span>
											{child?.name ?? cid}
											{#if rule?.applicabilityNote}<em class="applic">· {rule.applicabilityNote}</em
												>{/if}
										</li>
									{/each}
								</ul>
							{/if}
						</div>
						<div class="field assurancerail">
							<span class="flabel">Assurance rail</span>
							<div class="railfloor">
								<div class="raillocked">🔒 de minimis floor · non-removable</div>
								{#each ASSURANCE_FLOOR as p (p.id)}
									<div class="railitem" title={p.blurb}>{p.label}</div>
								{/each}
							</div>
							{#if current.requiredAssurancePolicyIds.length}
								<div class="railadd">
									{#each current.requiredAssurancePolicyIds as pid (pid)}
										<div class="railitem plus">+ {policyLabel(pid)}</div>
									{/each}
								</div>
							{:else}
								<span class="fhelp">No additional policies declared (the floor still applies).</span>
							{/if}
						</div>
						{#if editable}
							<div class="inspactions">
								<button class="ghost small" onclick={() => openEdit(current.id)}>Edit</button>
								<form method="POST" action="?/removeType" use:enhance>
									<input type="hidden" name="pwuTypeId" value={current.id} />
									<button class="ghost small danger" type="submit">Remove</button>
								</form>
							</div>
						{/if}
					{:else}
						<div class="itag">INSPECTOR</div>
						<p class="hint">Select a node to inspect it{#if editable}, or “+ Define PWU Type”.{/if}</p>
					{/if}

					{#if data.fixtures.length}
						<div class="fixtures">
							<span class="flabel">Conformance fixtures</span>
							{#each data.fixtures as fx (fx.id)}
								<a class="fixture" href={`/undertakings/${fx.id}`}>
									{#if fx.isReferenceFixture}<span class="fxbadge">REFERENCE FIXTURE</span>{/if}
									{fx.name} ↗
								</a>
							{/each}
						</div>
					{/if}
				</aside>
			</Panel>

			{#if data.types.length === 0}
				<Panel position="top-center">
					<div class="emptyhint">
						No PWU Types yet — use “+ Define PWU Type”{#if editable}, or ask the agent below{/if}.
					</div>
				</Panel>
			{/if}
			{#if data.floor}
				<Panel position="bottom-right">
					<div class="floorpanel" data-testid="assurance-panel">
						<div class="floorhead">
							<span
								class="floortag"
								class:ok={data.floor.satisfied}
								class:bad={data.floor.aggregate === 'REJECTED'}
								data-testid="assurance-disposition">⚖ {data.floor.aggregate}</span
							>
							<span class="floorsub">de minimis assurance floor</span>
							{#if data.floor.waived}
								<span class="waivedbadge" data-testid="assurance-waived">waiver in force</span>
							{/if}
						</div>
						<ul class="floorpolicies">
							{#each data.floor.policies as pol (pol.policyId)}
								<li class:ok={pol.disposition === 'SATISFIED'} class:bad={pol.disposition === 'REJECTED'}>
									<span class="pdisp"
										>{pol.disposition === 'SATISFIED' ? '✓' : pol.disposition === 'REJECTED' ? '✗' : '•'}</span
									>
									{policyLabel(pol.policyId)}
								</li>
							{/each}
						</ul>
						{#if data.floor.reasoningGaps.length}
							<p class="floorgapshdr">Reasoning-review findings</p>
							<ul class="floorgaps">
								{#each data.floor.reasoningGaps.slice(0, 5) as g}<li>{g}</li>{/each}
							</ul>
						{/if}
						{#if !data.floor.satisfied && data.floor.waived}
							<p class="floorhint">
								A governance waiver is in force — publishing is permitted despite the floor (an auditable,
								recorded override).
							</p>
						{:else if !data.floor.satisfied}
							<p class="floorhint">
								Publishing is blocked until the floor is SATISFIED — revise the graph and re-run, or record a
								waiver.
							</p>
							{#if canWaive}
								<form method="POST" action="?/recordWaiver" use:enhance class="floorwaiver">
									<input
										name="rationale"
										placeholder="Waiver rationale — why publish despite the floor"
										required
									/>
									<button class="ghost small danger" type="submit">Record waiver + allow publish</button>
								</form>
							{/if}
						{/if}
					</div>
				</Panel>
			{/if}
			</SvelteFlow>
		</div>
		{#if editable}
			<form class="chatbar" onsubmit={sendToAgent}>
				<textarea
					bind:value={chatInput}
					placeholder="Ask the agent to build or modify the graph — e.g. “Draft a product realization architecture with the standard work areas.”"
					rows="1"
					data-testid="agent-input"
					onkeydown={(e) => {
						if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendToAgent(e as unknown as SubmitEvent);
					}}
				></textarea>
				<button class="primary" type="submit" disabled={running || !chatInput.trim()}>
					{running ? 'Working…' : 'Send'}
				</button>
			</form>
		{/if}
	</div>
</div>

<style>
	.designer {
		height: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.topbar {
		flex: 0 0 auto;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 18px;
		padding: 12px 20px;
		border-bottom: 1px solid var(--sc);
		background: var(--surface);
	}
	.tbmain {
		min-width: 0;
	}
	.crumbs {
		font-size: 11px;
		color: var(--outline);
		margin-bottom: 4px;
	}
	.titlerow {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.titlerow h1 {
		margin: 0;
		font-size: 20px;
		letter-spacing: -0.01em;
	}
	.tbmeta {
		font-size: 12px;
		color: var(--on-variant);
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
	.health {
		font-size: 10px;
		font-weight: 700;
		padding: 3px 8px;
		border-radius: 5px;
		background: rgba(97, 218, 193, 0.15);
		color: var(--tertiary);
		cursor: help;
		white-space: nowrap;
	}
	.health.warn {
		background: rgba(230, 181, 102, 0.15);
		color: var(--amber);
	}
	.health.bad {
		background: rgba(255, 180, 171, 0.15);
		color: var(--error);
	}
	.detailform {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		margin-top: 10px;
	}
	.detailform input {
		background: var(--sc-highest);
		border: 1px solid var(--outline-faint);
		color: var(--on);
		border-radius: 6px;
		padding: 7px 10px;
		font-size: 12.5px;
	}
	.tbpub {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 8px;
		flex-shrink: 0;
	}
	.steps {
		display: flex;
		gap: 5px;
		list-style: none;
		margin: 0;
		padding: 0;
		font-size: 10px;
		color: var(--outline);
	}
	.steps li {
		padding: 3px 8px;
		border-radius: 20px;
		background: var(--sc);
		letter-spacing: 0.03em;
		white-space: nowrap;
	}
	.steps li.done {
		color: var(--tertiary);
	}
	.steps li.active {
		background: var(--sc-highest);
		color: var(--primary);
		font-weight: 700;
	}
	.pubact {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.pubact form {
		margin: 0;
	}
	.immutable {
		font-size: 11px;
		color: var(--tertiary);
		font-weight: 600;
	}
	.retired {
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--outline);
		font-weight: 700;
	}
	.err {
		color: var(--error);
		font-size: 12.5px;
		margin: 8px 0 0;
	}
	.canvas {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		background: var(--surface);
	}
	.flowarea {
		flex: 1;
		min-height: 0;
		position: relative;
	}
	.canvas :global(.svelte-flow) {
		background: var(--surface);
	}
	.canvas :global(.svelte-flow__node) {
		cursor: pointer;
	}
	/* Floating panels overlaid on the canvas (Svelte Flow <Panel>) */
	.agentpanel,
	.inspectorpanel {
		background: rgba(20, 20, 21, 0.94);
		border: 1px solid var(--outline-faint);
		border-radius: 12px;
		backdrop-filter: blur(6px);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
	}
	.agentpanel {
		width: 288px;
		/* Fits inside the flow area (which sits above the chat bar), scrolling internally. */
		max-height: calc(100vh - 235px);
		display: flex;
		flex-direction: column;
		padding: 12px;
	}
	.agentpanel.collapsed {
		width: 200px;
	}
	.ppanelhead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.pheadright {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.livedot {
		font-size: 11px;
		color: var(--tertiary);
		font-weight: 600;
	}
	.collapsebtn {
		background: var(--sc-high);
		border: 1px solid var(--outline-faint);
		color: var(--on-variant);
		border-radius: 5px;
		width: 22px;
		height: 22px;
		font-size: 11px;
		cursor: pointer;
	}
	.agentlog {
		margin-top: 10px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-height: 120px;
	}
	.logempty {
		color: var(--outline);
		font-size: 11.5px;
		line-height: 1.5;
		margin: 0;
	}
	.logentry {
		font-size: 12px;
		line-height: 1.45;
		color: var(--on-variant);
		display: flex;
		gap: 6px;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.logentry.tool,
	.logentry.toolend {
		font-family: 'Source Code Pro', monospace;
		font-size: 11px;
	}
	.logentry.toolend {
		color: var(--tertiary);
	}
	.logentry.toolend.bad {
		color: var(--error);
	}
	.logentry.thinking {
		color: var(--outline);
		font-style: italic;
	}
	.logentry.status {
		color: var(--outline);
		font-size: 10px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.logentry.error {
		color: var(--error);
	}
	.logmark {
		flex-shrink: 0;
		font-weight: 700;
	}
	.inspectorpanel {
		width: 320px;
		max-height: calc(100vh - 235px);
		overflow-y: auto;
		padding: 14px 16px;
	}
	.inspectorpanel h3 {
		margin: 6px 0 14px;
		font-size: 18px;
	}
	.chatbar {
		flex: 0 0 auto;
		display: flex;
		gap: 10px;
		align-items: flex-end;
		padding: 12px 20px;
		border-top: 1px solid var(--sc);
		background: var(--surface);
	}
	.chatbar textarea {
		flex: 1;
		background: var(--sc-highest);
		border: 1px solid var(--outline-faint);
		color: var(--on);
		border-radius: 8px;
		padding: 9px 11px;
		font-size: 13px;
		font-family: inherit;
		resize: none;
		max-height: 96px;
	}
	.emptyhint {
		background: rgba(20, 20, 21, 0.9);
		border: 1px dashed var(--outline-faint);
		border-radius: 10px;
		padding: 10px 14px;
		font-size: 12px;
		color: var(--on-variant);
	}
	.itag {
		font-size: 10px;
		letter-spacing: 0.14em;
		color: var(--primary);
		font-weight: 700;
	}
	.hint {
		color: var(--outline);
		font-size: 12px;
		margin: 8px 0 0;
	}
	.typeform {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 10px;
	}
	.ffield {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.fld {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.fhelp {
		font-size: 11px;
		color: var(--outline);
		line-height: 1.4;
	}
	.typeform input,
	.typeform textarea,
	.tplsel {
		background: var(--sc-highest);
		border: 1px solid var(--outline-faint);
		color: var(--on);
		border-radius: 6px;
		padding: 8px 11px;
		font-size: 12.5px;
		font-family: inherit;
	}
	.rootcheck {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12.5px;
		color: var(--on-variant);
	}
	.childlist {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.childopt {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--on-variant);
	}
	.childrow {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}
	.childrow .childopt {
		flex: 1 1 auto;
		min-width: 90px;
	}
	.cardsel {
		font-size: 10px;
		padding: 1px 2px;
		background: #232324;
		color: var(--on-variant);
		border: 1px solid var(--outline);
		border-radius: 4px;
	}
	.cardnote {
		flex: 1 1 100%;
		font-size: 11px;
		padding: 2px 5px;
		background: #232324;
		color: var(--on-variant);
		border: 1px solid var(--outline);
		border-radius: 4px;
	}
	.policylist {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.floornote {
		font-size: 10.5px;
		color: var(--outline);
		padding-bottom: 2px;
	}
	.childcards {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.childcards li {
		font-size: 12.5px;
		color: var(--on-variant);
		display: flex;
		align-items: baseline;
		gap: 6px;
	}
	.cardbadge {
		font-family: 'Source Code Pro', monospace;
		font-size: 10px;
		font-weight: 600;
		color: #9fcaff;
		border: 1px solid #345;
		border-radius: 4px;
		padding: 0 4px;
		flex: 0 0 auto;
	}
	.applic {
		color: var(--outline);
		font-size: 11px;
	}
	.assurancerail {
		border-left: 2px solid #4a4a2a;
		padding-left: 8px;
	}
	.railfloor {
		border-radius: 6px;
		background: #201f16;
		border: 1px solid #4a4a2a;
		padding: 6px 8px;
		margin-bottom: 4px;
	}
	.raillocked {
		font-size: 10.5px;
		font-weight: 600;
		color: #d8c56a;
		margin-bottom: 3px;
	}
	.railitem {
		font-size: 11.5px;
		color: var(--on-variant);
		line-height: 1.5;
	}
	.railitem.plus {
		color: #61dac1;
	}
	.railadd {
		padding: 2px 0 0 2px;
	}
	.overlaytoggle {
		display: flex;
		align-items: center;
		gap: 10px;
		background: rgba(24, 24, 26, 0.85);
		border: 1px solid var(--outline);
		border-radius: 8px;
		padding: 5px 9px;
	}
	.ovlabel {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		color: var(--on-variant);
		cursor: pointer;
	}
	.formactions {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.field {
		margin-bottom: 12px;
	}
	.flabel {
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
	.inspactions {
		display: flex;
		gap: 8px;
		align-items: center;
		margin-top: 4px;
	}
	.fixtures {
		margin-top: 18px;
		border-top: 1px solid var(--sc);
		padding-top: 12px;
	}
	.fixture {
		display: block;
		background: var(--sc);
		border-radius: 8px;
		padding: 9px 11px;
		font-size: 12px;
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
	/* Buttons */
	button.ghost {
		background: var(--sc-highest);
		color: var(--on);
		border: 1px solid var(--outline-faint);
		border-radius: 8px;
		padding: 8px 14px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}
	button.ghost:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	button.ghost.small,
	button.primary.small {
		padding: 6px 11px;
		font-size: 12px;
	}
	button.ghost.danger {
		color: var(--error);
		border-color: rgba(255, 180, 171, 0.4);
	}
	button.primary {
		background: var(--primary);
		color: #00263f;
		border: none;
		border-radius: 8px;
		padding: 8px 16px;
		font-weight: 700;
		font-size: 13px;
		cursor: pointer;
	}
	button.primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	/* De minimis assurance floor — chip + panel */
	.floorchip { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 5px; border: 1px solid transparent; white-space: nowrap; cursor: help; }
	.floorchip.ok { background: rgba(97, 218, 193, 0.15); color: var(--tertiary); }
	.floorchip.warn { background: rgba(230, 181, 102, 0.15); color: var(--amber); }
	.floorchip.bad { background: rgba(255, 180, 171, 0.15); color: var(--error); }
	.floorpanel { width: 280px; max-width: 32vw; max-height: calc(100vh - 320px); overflow-y: auto; padding: 12px 14px; border: 1px solid var(--sc); border-radius: 10px; background: var(--surface); box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18); font-size: 12px; }
	.floorhead { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
	.floortag { font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 5px; background: rgba(230, 181, 102, 0.15); color: var(--amber); }
	.floortag.ok { background: rgba(97, 218, 193, 0.15); color: var(--tertiary); }
	.floortag.bad { background: rgba(255, 180, 171, 0.15); color: var(--error); }
	.floorsub { font-size: 10px; color: var(--outline); }
	.floorpolicies { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
	.floorpolicies li { display: flex; gap: 6px; align-items: baseline; color: var(--on-variant); }
	.floorpolicies li.ok { color: var(--on-surface); }
	.floorpolicies .pdisp { color: var(--amber); font-weight: 800; }
	.floorpolicies li.ok .pdisp { color: var(--tertiary); }
	.floorpolicies li.bad .pdisp { color: var(--error); }
	.floorgapshdr { margin: 10px 0 4px; font-weight: 700; color: var(--on-variant); }
	.floorgaps { margin: 0; padding-left: 16px; display: flex; flex-direction: column; gap: 3px; }
	.floorgaps li { line-height: 1.35; }
	.floorhint { margin: 10px 0 0; color: var(--on-variant); line-height: 1.4; }
	.floorwaiver { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--sc); padding-top: 10px; }
	.floorwaiver input { padding: 6px 8px; border: 1px solid var(--sc); border-radius: 6px; background: var(--surface); color: inherit; font-size: 11px; }
	.waivedbadge { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 5px; background: rgba(97, 218, 193, 0.15); color: var(--tertiary); }
</style>
