<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	let {
		data,
		form
	}: {
		data: PageData;
		form: {
			error?: string;
			// The RPH error code, surfaced so a STALE PAGE is distinguishable from a refused act. Without it
			// the two read identically to the professional, and "someone else changed this while you were
			// looking at it" is a different instruction from "this cannot be done" (JPWB-DOC-003 §9 PER-4).
			code?: string;
			created?: string;
			submitted?: string;
			approved?: string;
		} | null;
	} = $props();

	/** A revision conflict is not a refusal — the act was legal and the page was simply out of date. */
	const isStale = $derived(form?.code === 'RPH_REVISION_CONFLICT');

	// The 6 BaselineType values (RPH-DOC-007 §23). Promotion to AUTHORITATIVE is a documented follow-up — it needs
	// an effective promotion Decision + satisfied assessments (canPromoteBaseline) and is out of this surface's scope.
	const BASELINE_TYPES = [
		'INTENT',
		'REQUIREMENTS',
		'ARCHITECTURE',
		'IMPLEMENTATION',
		'RELEASE',
		'EVIDENCE_PACKAGE'
	];
	let showCreate = $state(false);
</script>

<svelte:head><title>Baseline Manager — JPWB</title></svelte:head>
<header class="pagehead">
	<div>
		<h1>Baseline Manager</h1>
		<p class="sub">
			Promoted, immutable item sets. An authoritative baseline is frozen — changes create a successor.
			A repository commit is not a baseline.
		</p>
	</div>
	<button class="ghost" onclick={() => (showCreate = !showCreate)}>+ Create Baseline</button>
</header>

{#if showCreate}
	<form method="POST" action="?/create" use:enhance class="createform">
		<label class="fld">
			<span class="flabel">Baseline type</span>
			<select name="baselineType" aria-label="Baseline type">
				{#each BASELINE_TYPES as t (t)}
					<option value={t}>{t}</option>
				{/each}
			</select>
		</label>
		<button class="primary" type="submit">Create baseline</button>
	</form>
{/if}

{#if form?.error}
	<p class="err" role="alert">
		{#if isStale}
			This baseline changed while this page was open, so the act was not applied. Reload to see the
			current state, then decide again. <span class="mono">({form.error})</span>
		{:else}
			{form.error}
		{/if}
	</p>
{/if}

<table>
	<thead>
		<tr>
			<th>Baseline</th><th>Type</th><th>Status</th><th>Items</th><th>Purpose</th><th>Advance</th>
		</tr>
	</thead>
	<tbody>
		{#each data.baselines as b (b.id)}
			<tr>
				<td class="mono">{b.id.slice(0, 16)}…</td>
				<td>{b.type}</td>
				<td><span class="tag" class:auth={b.status === 'AUTHORITATIVE'}>{b.status}</span></td>
				<td>{b.items}</td>
				<td>{b.purpose}</td>
				<td class="act">
					{#if b.status === 'CANDIDATE'}
						<form method="POST" action="?/submit" use:enhance>
							<input type="hidden" name="id" value={b.id} />
							<!-- The revision THIS ROW was rendered from. Interpolated from the load data and never
							     recomputed in the action — a value re-read at submit is always current, can never
							     conflict, and would satisfy PER-4's letter while protecting nothing. -->
							<input type="hidden" name="expectedRevision" value={b.revision} />
							<button class="ghost small" type="submit">Submit</button>
						</form>
					{:else if b.status === 'UNDER_REVIEW'}
						<form method="POST" action="?/approve" use:enhance>
							<input type="hidden" name="id" value={b.id} />
							<input type="hidden" name="expectedRevision" value={b.revision} />
							<button class="primary small" type="submit">Approve</button>
						</form>
					{:else}
						<span class="dash">—</span>
					{/if}
				</td>
			</tr>
		{/each}
		{#if !data.baselines.length}<tr><td colspan="6" class="none">No baselines yet.</td></tr>{/if}
	</tbody>
</table>

<style>
	.pagehead {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 20px;
	}
	h1 {
		margin: 0 0 4px;
		font-size: 28px;
	}
	.sub {
		margin: 0;
		color: var(--on-variant);
		font-size: 13px;
		max-width: 680px;
	}
	.createform {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: flex-end;
		background: var(--surface-low);
		border-radius: 12px;
		padding: 16px 18px;
		margin-bottom: 16px;
	}
	.fld {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.flabel {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--outline);
	}
	select {
		background: var(--sc-highest);
		border: 1px solid var(--outline-faint);
		color: var(--on);
		border-radius: 6px;
		padding: 8px 11px;
		font-size: 12.5px;
	}
	.err {
		color: var(--error);
		font-size: 12.5px;
		margin: 0 0 14px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12.5px;
		background: var(--surface-low);
		border-radius: 12px;
		overflow: hidden;
	}
	th {
		text-align: left;
		color: var(--outline);
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		padding: 12px;
	}
	td {
		padding: 11px 12px;
		border-top: 1px solid var(--sc);
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
		background: var(--indigo-soft);
		color: var(--indigo);
	}
	.act form {
		margin: 0;
	}
	.dash {
		color: var(--outline);
	}
	.none {
		color: var(--outline);
		text-align: center;
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
	button.primary {
		background: var(--primary);
		color: var(--on-primary);
		border: none;
		border-radius: 8px;
		padding: 8px 16px;
		font-weight: 700;
		font-size: 13px;
		cursor: pointer;
	}
	button.small {
		padding: 6px 11px;
		font-size: 12px;
	}
</style>
