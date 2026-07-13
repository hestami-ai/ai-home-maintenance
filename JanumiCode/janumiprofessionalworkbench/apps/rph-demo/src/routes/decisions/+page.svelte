<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	let {
		data,
		form
	}: {
		data: PageData;
		form: { error?: string; proposed?: string; approved?: string } | null;
	} = $props();

	// The 9 governance DecisionType values (RPH-DOC-007 §22 / DOC-002 §23.1).
	const DECISION_TYPES = [
		'APPROVAL',
		'REJECTION',
		'WAIVER',
		'ESCALATION',
		'RESHAPE',
		'REPLAN',
		'PROMOTE_BASELINE',
		'ABANDON',
		'REVOKE'
	];

	let showProposeForm = $state(false);
</script>

<svelte:head><title>Decision Center — JPWB</title></svelte:head>

<header class="pagehead">
	<div>
		<h1>Decision Center</h1>
		<p class="sub">
			Version-bound governance acts. A decision is authority exercised — recommendation is not
			approval.
		</p>
	</div>
	<button class="ghost" onclick={() => (showProposeForm = !showProposeForm)}>+ Propose Decision</button>
</header>

{#if form?.error}<p class="err" role="alert">{form.error}</p>{/if}

{#if showProposeForm}
	<form method="POST" action="?/propose" use:enhance class="proposeform">
		<label class="field">
			<span class="flabel">Decision type</span>
			<select name="decisionType">
				{#each DECISION_TYPES as t (t)}
					<option value={t}>{t}</option>
				{/each}
			</select>
		</label>
		<label class="field grow">
			<span class="flabel">Selected option</span>
			<input name="selectedOption" placeholder="Chosen option (e.g. Approve v0.1.0)" required />
		</label>
		<label class="field grow">
			<span class="flabel">Rationale</span>
			<input name="rationale" placeholder="Why this decision" />
		</label>
		<button class="primary" type="submit">Propose</button>
	</form>
{/if}

<table>
	<thead
		><tr
			><th>Decision</th><th>Type</th><th>Status</th><th>Option</th><th>Rationale</th><th></th></tr
		></thead
	>
	<tbody>
		{#each data.decisions as d (d.id)}
			<tr>
				<td class="mono">{d.id.slice(0, 16)}…</td>
				<td>{d.type}</td>
				<td><span class="tag" class:eff={d.status === 'EFFECTIVE'}>{d.status}</span></td>
				<td>{d.selectedOption}</td>
				<td>{d.rationale}</td>
				<td class="act">
					{#if d.status === 'PROPOSED'}
						<form method="POST" action="?/approve" use:enhance>
							<input type="hidden" name="id" value={d.id} />
							<input type="hidden" name="selectedOption" value={d.selectedOption} />
							<input type="hidden" name="rationale" value={d.rationale} />
							<button class="ghost small" type="submit">Approve</button>
						</form>
					{/if}
				</td>
			</tr>
		{/each}
		{#if !data.decisions.length}<tr><td colspan="6" class="none">No decisions yet.</td></tr>{/if}
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
		max-width: 620px;
	}
	.err {
		color: var(--error);
		font-size: 12.5px;
		margin: 0 0 14px;
	}
	.proposeform {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: flex-end;
		background: var(--surface-low);
		border-radius: 12px;
		padding: 16px 18px;
		margin-bottom: 18px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.field.grow {
		flex: 1 1 200px;
	}
	.flabel {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--outline);
	}
	.proposeform select,
	.proposeform input {
		background: var(--sc-highest);
		border: 1px solid var(--outline-faint);
		color: var(--on);
		border-radius: 6px;
		padding: 8px 11px;
		font-size: 12.5px;
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
		white-space: nowrap;
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
		padding: 9px 16px;
		font-weight: 700;
		font-size: 13px;
		cursor: pointer;
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
	td.act {
		text-align: right;
	}
	td.act form {
		margin: 0;
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
	.tag.eff {
		background: rgba(97, 218, 193, 0.15);
		color: var(--tertiary);
	}
	.none {
		color: var(--outline);
		text-align: center;
	}
</style>
