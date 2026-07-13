<script lang="ts">
	import { enhance } from '$app/forms';
	import { SvelteFlow, Background, Controls } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import type { Edge, Node } from '@xyflow/svelte';
	import { toPwaFlow } from '$lib/pwaFlow';
	import { PWU_TYPE_CATALOG, PWU_TYPE_HELP } from '$lib/authoring/pwuType';
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

	let selected = $state(data.types.find((t) => t.isRoot)?.id ?? data.types[0]?.id ?? '');
	const current = $derived(data.types.find((t) => t.id === selected));
	const editable = $derived(data.pwa.publicationStatus === 'DRAFT');
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

	// Node graph: PWU Types are nodes; permittedChildTypeIds are the composition edges. Recomputed when the DRAFT
	// changes (authoring/agent) or the selection changes.
	const flow = $derived(toPwaFlow(data.types, selected));
	let nodes = $state<Node[]>([]);
	let edges = $state<Edge[]>([]);
	$effect(() => {
		nodes = flow.nodes;
		edges = flow.edges;
	});

	// Shared define/edit PWU Type form: formMode is null (inspector shows the selected node) | 'define' | { editId }.
	type FormMode = null | 'define' | { editId: string };
	let formMode = $state<FormMode>(null);
	let showPwaEdit = $state(false);
	const f = $state({ name: '', pwuKind: '', purpose: '', completionRule: '', isRoot: false });
	let children = $state<string[]>([]);
	const editingId = $derived(typeof formMode === 'object' && formMode ? formMode.editId : '');

	$effect(() => {
		if (form?.definedType) {
			selected = form.definedType;
			formMode = null;
		} else if (form?.editedType || form?.removedType) {
			formMode = null;
		}
	});

	function openDefine() {
		Object.assign(f, { name: '', pwuKind: '', purpose: '', completionRule: '', isRoot: false });
		children = [];
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
			isRoot: t.isRoot
		});
		children = [...t.permittedChildTypeIds];
		formMode = { editId: id };
	}
	function applyTemplate(key: string) {
		const t = PWU_TYPE_CATALOG.find((x) => x.key === key);
		if (!t) return;
		Object.assign(f, { name: t.name, pwuKind: t.pwuKind, purpose: t.purpose, isRoot: t.isRoot });
	}
	function toggleChild(id: string, on: boolean) {
		children = on ? [...children, id] : children.filter((c) => c !== id);
	}
</script>

{#snippet fhead(label: string, help: string)}
	<div class="fld">
		<span class="flabel">{label}</span>
		<span class="fhelp">{help}</span>
	</div>
{/snippet}

<svelte:head><title>{data.pwa.name} — Work Architecture</title></svelte:head>

<nav class="crumbs"><a href="/">PWA Library</a> › <span>{data.pwa.name}</span></nav>

<header class="pagehead">
	<div>
		<h1>{data.pwa.name}</h1>
		<p class="meta">
			<span class="pill" class:pub={data.pwa.publicationStatus === 'PUBLISHED'}
				>{data.pwa.publicationStatus}</span
			>
			v{data.pwa.version} · {data.pwa.domain}
		</p>
		<p class="sub">{data.pwa.description}</p>
	</div>
</header>

{#if editable}
	<div class="pwaedit">
		{#if !showPwaEdit}
			<button class="ghost small" onclick={() => (showPwaEdit = true)}>Edit PWA details</button>
		{:else}
			<form method="POST" action="?/editDetails" use:enhance class="detailform">
				<input name="name" value={data.pwa.name} placeholder="PWA name" required />
				<input name="domain" value={data.pwa.domain} placeholder="Domain" />
				<input name="description" value={data.pwa.description} placeholder="Description" />
				<button class="primary" type="submit">Save</button>
				<button type="button" class="ghost small" onclick={() => (showPwaEdit = false)}>Cancel</button>
			</form>
		{/if}
	</div>
{/if}

<div class="pubbar">
	<ol class="steps">
		<li class:done={rank > 1} class:active={data.pwa.publicationStatus === 'DRAFT'}>Draft</li>
		<li class:done={rank > 2} class:active={data.pwa.publicationStatus === 'UNDER_REVIEW'}>
			Under Review
		</li>
		<li class:done={rank > 3} class:active={data.pwa.publicationStatus === 'VALIDATED'}>Validated</li>
		<li class:done={rank > 4} class:active={data.pwa.publicationStatus === 'PUBLISHED'}>Published</li>
		<li class:done={rank > 5} class:active={data.pwa.publicationStatus === 'DEPRECATED'}>
			Deprecated
		</li>
		<li class:done={rank > 6} class:active={data.pwa.publicationStatus === 'RETIRED'}>Retired</li>
	</ol>
	<div class="pubact">
		{#if data.pwa.publicationStatus === 'DRAFT'}
			<form method="POST" action="?/submitForReview" use:enhance>
				<button class="ghost" type="submit" disabled={!hasRoot}>Submit for Review →</button>
			</form>
			{#if !hasRoot}<span class="hintline">Define a root PWU Type to submit.</span>{/if}
		{:else if data.pwa.publicationStatus === 'UNDER_REVIEW'}
			<form method="POST" action="?/validate" use:enhance>
				<button class="ghost" type="submit">Validate →</button>
			</form>
		{:else if data.pwa.publicationStatus === 'VALIDATED'}
			<form method="POST" action="?/publish" use:enhance>
				<button class="primary" type="submit">Publish</button>
			</form>
		{:else if data.pwa.publicationStatus === 'PUBLISHED'}
			<span class="immutable">🔒 Published versions are immutable</span>
			<form method="POST" action="?/deprecate" use:enhance>
				<button class="ghost" type="submit">Deprecate</button>
			</form>
		{:else if data.pwa.publicationStatus === 'DEPRECATED'}
			<form method="POST" action="?/retire" use:enhance>
				<button class="ghost" type="submit">Retire</button>
			</form>
		{:else if data.pwa.publicationStatus === 'RETIRED'}
			<span class="retired">retired</span>
		{/if}
	</div>
</div>
{#if form?.error}<p class="err" role="alert">{form.error}</p>{/if}

<div class="designer">
	<section class="canvaswrap">
		<div class="canvashead">
			<h2>Work Architecture — Professional Work Graph</h2>
			{#if editable}
				<button class="ghost small" onclick={openDefine}>+ Define PWU Type</button>
			{/if}
		</div>
		<p class="hint">
			Each node is a reusable PWU Type; an edge means the parent type may be decomposed into the child
			(allowed composition). Click a node to inspect or edit it. This is a View of the PWA — PWU Types
			carry no execution or assurance state.
		</p>
		<div class="canvas">
			{#if data.types.length}
				<SvelteFlow bind:nodes bind:edges onnodeclick={(e) => (selected = e.node.id)} fitView>
					<Background />
					<Controls />
				</SvelteFlow>
			{:else}
				<div class="emptycanvas">
					<p>No PWU Types yet.</p>
					{#if editable}<p class="hint">Use “+ Define PWU Type”, or ask the agent to build the graph.</p>{/if}
				</div>
			{/if}
		</div>
	</section>

	<aside class="inspector">
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
					<label class="rootcheck"
						><input type="checkbox" name="isRoot" bind:checked={f.isRoot} /> Root type</label
					>
					<span class="fhelp">{PWU_TYPE_HELP.isRoot}</span>
				</div>
				<div class="ffield">
					{@render fhead('Permitted child types', PWU_TYPE_HELP.permittedChildTypeIds)}
					<div class="childlist">
						{#each data.types.filter((t) => t.id !== editingId) as t (t.id)}
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
						{/each}
						{#if data.types.filter((t) => t.id !== editingId).length === 0}
							<span class="fhelp">Define more types to allow composition.</span>
						{/if}
					</div>
				</div>
				<div class="formactions">
					<button class="primary" type="submit">{editing ? 'Save changes' : 'Add type'}</button>
					<button type="button" class="ghost small" onclick={() => (formMode = null)}>Cancel</button>
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
				<span class="flabel">Permitted children</span>
				<p>{current.permittedChildTypeIds.length} type(s)</p>
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
			<p class="hint">Select a node to inspect it.</p>
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
	.pwaedit {
		margin-top: 12px;
	}
	.detailform {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.detailform input {
		background: var(--sc-highest);
		border: 1px solid var(--outline-faint);
		color: var(--on);
		border-radius: 6px;
		padding: 8px 11px;
		font-size: 12.5px;
	}
	.pubbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		background: var(--surface-low);
		border-radius: 12px;
		padding: 12px 18px;
		margin-top: 14px;
	}
	.steps {
		display: flex;
		gap: 8px;
		list-style: none;
		margin: 0;
		padding: 0;
		font-size: 11px;
		color: var(--outline);
		flex-wrap: wrap;
	}
	.steps li {
		padding: 3px 10px;
		border-radius: 20px;
		background: var(--sc);
		letter-spacing: 0.04em;
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
		gap: 10px;
	}
	.pubact form,
	.inspactions form {
		margin: 0;
	}
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
	button.ghost.small {
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
	.immutable {
		font-size: 12px;
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
	.hintline {
		font-size: 11px;
		color: var(--outline);
	}
	.err {
		color: var(--error);
		font-size: 12.5px;
		margin: 10px 0 0;
	}
	.designer {
		display: grid;
		grid-template-columns: 1fr 340px;
		gap: 18px;
		margin-top: 18px;
	}
	.canvaswrap,
	.inspector {
		background: var(--surface-low);
		border-radius: 12px;
		padding: 18px;
	}
	.canvashead {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	h2 {
		margin: 0 0 4px;
		font-size: 16px;
	}
	.hint {
		color: var(--outline);
		font-size: 12px;
		margin: 0 0 12px;
	}
	.canvas {
		height: calc(100vh - 360px);
		min-height: 420px;
		background: var(--surface);
		border: 1px solid var(--sc);
		border-radius: 10px;
		overflow: hidden;
	}
	.emptycanvas {
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		color: var(--on-variant);
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
	.formactions {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.field {
		margin-bottom: 14px;
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
		margin-top: 20px;
		border-top: 1px solid var(--sc);
		padding-top: 14px;
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
	.canvas :global(.svelte-flow__node) {
		cursor: pointer;
	}
</style>
