<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	let {
		data,
		form
	}: {
		data: PageData;
		form: { error?: string; definedType?: string; advanced?: string } | null;
	} = $props();
	let selected = $state(data.types.find((t) => t.isRoot)?.id ?? data.types[0]?.id ?? '');
	const current = $derived(data.types.find((t) => t.id === selected));
	const editable = $derived(data.pwa.publicationStatus === 'DRAFT');
	const hasRoot = $derived(data.types.some((t) => t.isRoot));
	let showTypeForm = $state(false);
	const RANK: Record<string, number> = {
		DRAFT: 1,
		UNDER_REVIEW: 2,
		VALIDATED: 3,
		PUBLISHED: 4,
		DEPRECATED: 5,
		RETIRED: 6
	};
	const rank = $derived(RANK[data.pwa.publicationStatus] ?? 0);
</script>

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

<div class="pubbar">
	<ol class="steps">
		<li class:done={rank > 1} class:active={data.pwa.publicationStatus === 'DRAFT'}>Draft</li>
		<li class:done={rank > 2} class:active={data.pwa.publicationStatus === 'UNDER_REVIEW'}>
			Under Review
		</li>
		<li class:done={rank > 3} class:active={data.pwa.publicationStatus === 'VALIDATED'}>Validated</li>
		<li class:done={rank >= 4} class:active={rank >= 4}>Published</li>
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
		{:else}
			<span class="immutable">🔒 Published versions are immutable</span>
		{/if}
	</div>
</div>
{#if form?.error}<p class="err" role="alert">{form.error}</p>{/if}

<div class="split">
	<section class="arch">
		<div class="archhead">
			<h2>Work Architecture — PWU Types</h2>
			{#if editable}
				<button class="ghost small" onclick={() => (showTypeForm = !showTypeForm)}
					>+ Define PWU Type</button
				>
			{/if}
		</div>
		<p class="hint">
			Reusable PWU Type definitions (allowed composition). This is a View of the PWA; it shows no
			execution or assurance state.
		</p>
		{#if editable && showTypeForm}
			<form method="POST" action="?/defineType" use:enhance class="typeform">
				<input name="name" placeholder="PWU Type name (e.g. Delivery Realization)" required />
				<input name="pwuKind" placeholder="Kind (e.g. DELIVERY_REALIZATION)" required />
				<input name="purpose" placeholder="Purpose (optional)" />
				<label class="rootcheck"><input type="checkbox" name="isRoot" /> Root type</label>
				<button class="primary" type="submit">Add type</button>
			</form>
		{/if}
		<div class="types">
			{#each data.types as t (t.id)}
				<button
					class="type"
					class:sel={selected === t.id}
					class:root={t.isRoot}
					onclick={() => (selected = t.id)}
				>
					<span class="tname"
						>{t.name}{#if t.isRoot}<span class="rootbadge">ROOT</span>{/if}</span
					>
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
			<div class="field"><span class="flabel">Purpose</span><p>{current.purpose}</p></div>
			<div class="field">
				<span class="flabel">Completion rule</span><p class="mono">{current.completionRule || '—'}</p>
			</div>
			<div class="field">
				<span class="flabel">Permitted children</span>
				<p>{current.permittedChildTypeIds.length} type(s)</p>
			</div>
			<div class="field">
				<span class="flabel">Required assurance</span>
				<p>{current.requiredAssurancePolicyIds.length} policy(ies)</p>
			</div>
		{:else}
			<p class="hint">Select a PWU Type.</p>
		{/if}

		{#if data.fixtures.length}
			<div class="fixtures">
				<span class="flabel">Conformance fixtures</span>
				{#each data.fixtures as f (f.id)}
					<a class="fixture" href={`/undertakings/${f.id}`}>
						{#if f.isReferenceFixture}<span class="fxbadge">REFERENCE FIXTURE</span>{/if}
						{f.name} ↗
					</a>
				{/each}
				<p class="fxnote">
					A fixture is an Undertaking used to exercise this PWA — it is not the PWA definition.
				</p>
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
	.pubbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		background: var(--surface-low);
		border-radius: 12px;
		padding: 12px 18px;
		margin-top: 18px;
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
	.pubact form {
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
	.hintline {
		font-size: 11px;
		color: var(--outline);
	}
	.err {
		color: var(--error);
		font-size: 12.5px;
		margin: 10px 0 0;
	}
	.split {
		display: grid;
		grid-template-columns: 1fr 320px;
		gap: 18px;
		margin-top: 18px;
	}
	.arch,
	.inspector {
		background: var(--surface-low);
		border-radius: 12px;
		padding: 18px;
	}
	.archhead {
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
		margin: 0 0 14px;
	}
	.typeform {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		background: var(--sc);
		border-radius: 10px;
		padding: 12px;
		margin-bottom: 14px;
	}
	.typeform input[type='text'],
	.typeform input:not([type]) {
		background: var(--sc-highest);
		border: 1px solid var(--outline-faint);
		color: var(--on);
		border-radius: 6px;
		padding: 8px 11px;
		font-size: 12.5px;
	}
	.rootcheck {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--on-variant);
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
	.fxnote {
		font-size: 11px;
		color: var(--outline);
		margin: 6px 0 0;
	}
</style>
