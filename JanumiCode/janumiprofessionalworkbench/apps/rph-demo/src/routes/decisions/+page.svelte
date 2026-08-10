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
			// The RPH error code, surfaced so a STALE PAGE is distinguishable from a refused act. `refuse()`
			// has returned it since /decisions was wired; until now nothing rendered it, which made it a field
			// that existed only in the claim that it existed.
			code?: string;
			proposed?: string;
			approved?: string;
			granted?: string;
			denied?: string;
		} | null;
	} = $props();

	/** A revision conflict is not a refusal — the act was legal and the page was simply out of date. */
	const isStale = $derived(form?.code === 'RPH_REVISION_CONFLICT');

	// The proposable DecisionType values (RPH-DOC-007 §22 / DOC-002 §23.1) — WAIVER deliberately absent:
	// ProposeDecision cannot carry DOC-004 §12.2's WaiverDetail, so a waiver proposed here could never
	// discharge anything and (JAN-CMDPRE DWP-01a) could never be approved. Waivers are born via RequestWaiver.
	const DECISION_TYPES = [
		'APPROVAL',
		'REJECTION',
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

{#if form?.error}
	<p class="err" role="alert">
		{#if isStale}
			This decision changed while this page was open, so the act was not applied. Reload to see the
			current state, then decide again. <span class="mono">({form.error})</span>
		{:else}
			{form.error}
		{/if}
	</p>
{/if}

{#if showProposeForm}
	<!-- ⚠ THE NOTICE IS REWRITTEN, NOT KEPT (REG-F-106, ruled REG-D-041). It used to read "authorizes nothing — it
	     names no subject", which was true and is now false: the form REQUIRES a subject. A stale warning on a
	     repaired surface is worse than none, because it teaches the professional to disbelieve the surface. What
	     replaces it is what remains true and is the harder thing to know — an approved decision is a STANDING,
	     version-bound authority which the acting surfaces will find and honour, and which stops resolving the
	     moment its subject changes version (ASR-15). -->
	{#if !data.subjects.length}
		<!-- A WORKBENCH WITH NOTHING IN IT HAS NOTHING TO DECIDE ABOUT, and saying so beats rendering an empty
		     picker beside a live Propose button. The form would post, the action would refuse, and the
		     professional would have learned that the surface offers acts it cannot perform — the REG-F-106 defect
		     in miniature.

		     ⚠ EXACTLY ONE NOTICE RENDERS, and that is a fix rather than a tidy-up (REG-F-108). The ASR-15 notice
		     used to sit ABOVE this branch, so a cold-start workbench showed BOTH — explaining what an approved
		     decision goes on to authorize directly above a line saying no decision can be made. Two `role="note"`
		     elements is also what the e2e tripped over, which is the accessibility tree reporting the same
		     incoherence the reader would have felt. -->
		<p class="notice" role="note">
			There is nothing to decide about yet. A decision binds exact subjects and versions, so this workspace
			needs at least one governed object before a decision can be proposed.
		</p>
	{:else}
		<!-- ⚠ THE NOTICE IS REWRITTEN, NOT KEPT (REG-F-106, ruled REG-D-041). It used to read "authorizes nothing
		     — it names no subject", which was true and is now false: the form REQUIRES a subject. A stale warning
		     on a repaired surface is worse than none, because it teaches the professional to disbelieve the
		     surface. What replaces it is what remains true and is the harder thing to know — an approved decision
		     is a STANDING, version-bound authority which the acting surfaces will find and honour, and which stops
		     resolving the moment its subject changes version (ASR-15). -->
		<p class="notice" role="note">
			A decision names <strong>exact subjects and versions</strong> (ASR-15). Once approved it becomes a
			standing authority that the acting surfaces — Baseline Manager, Undertaking Workbench — will find and
			honour, and it <strong>stops resolving</strong> the moment a subject changes version.
		</p>
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
			<span class="flabel">Subject(s) — what this decision is about</span>
			<!-- The catalog is DERIVED from the object-type registry, not a hand-written list of "things a decision
			     can be about". Hand-listing is how I got REG-F-106 wrong the first time: I called three decision
			     types exempt because no gate of OURS read them. -->
			<select name="subjectObjectIds" multiple size="6" required data-testid="subject-picker">
				{#each data.subjects as s (s.id)}
					<option value={s.id}
						>{s.objectType} · {s.label}{s.semanticVersion === undefined
							? ''
							: ` · v${s.semanticVersion}`}</option
					>
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
{/if}

<table>
	<thead
		><tr
			><th>Decision</th><th>Type</th><th>Subject</th><th>Status</th><th>Option</th><th>Rationale</th
			><th></th></tr
		></thead
	>
	<tbody>
		{#each data.decisions as d (d.id)}
			<tr>
				<td class="mono">{d.id.slice(0, 16)}…</td>
				<td>{d.type}</td>
				<!-- WHAT THE ROW GOVERNS. A governance register whose rows do not say what they are about is a list
				     of verbs — and for as long as every row here was subjectless, this column would have been empty
				     and would have shown that (REG-F-106). Legacy subjectless rows render "—" rather than blank, so
				     the absence reads as a fact and not as a rendering gap (OBJ-1). -->
				<td class="subj">
					{#if d.subjectObjectIds.length}
						{#each d.subjectObjectIds as sid (sid)}
							<span class="mono">{data.subjects.find((s) => s.id === sid)?.label ?? sid}</span>
						{/each}
					{:else}
						<span class="none" title="Proposed before a subject was required (REG-F-106)">—</span>
					{/if}
				</td>
				<td><span class="tag" class:eff={d.status === 'EFFECTIVE'}>{d.status}</span></td>
				<td>{d.selectedOption}</td>
				<td>{d.rationale}</td>
				<td class="act">
					<!-- Affordances mirror the engine's preconditions (JAN-CMDPRE DWP-01a): a waiver is granted or
					     denied, never "approved" — each row offers only the command the engine will accept. -->
					{#if d.status === 'PROPOSED'}
						{#if d.type === 'WAIVER'}
							<form method="POST" action="?/grant" use:enhance>
								<input type="hidden" name="id" value={d.id} />
								<!-- The revision this row was RENDERED from. Interpolated from the load data and never
								     recomputed in the action — that is the whole of the PER-4 protection. -->
								<input type="hidden" name="expectedRevision" value={d.revision} />
								<button class="ghost small" type="submit">Grant waiver</button>
							</form>
							<form method="POST" action="?/deny" use:enhance>
								<input type="hidden" name="id" value={d.id} />
								<!-- The revision this row was RENDERED from. Interpolated from the load data and never
								     recomputed in the action — that is the whole of the PER-4 protection. -->
								<input type="hidden" name="expectedRevision" value={d.revision} />
								<input type="hidden" name="rationale" value={d.rationale} />
								<button class="ghost small" type="submit">Deny</button>
							</form>
						{:else}
							<form method="POST" action="?/approve" use:enhance>
								<input type="hidden" name="id" value={d.id} />
								<!-- The revision this row was RENDERED from. Interpolated from the load data and never
								     recomputed in the action — that is the whole of the PER-4 protection. -->
								<input type="hidden" name="expectedRevision" value={d.revision} />
								<input type="hidden" name="selectedOption" value={d.selectedOption} />
								<input type="hidden" name="rationale" value={d.rationale} />
								<button class="ghost small" type="submit">Approve</button>
							</form>
						{/if}
					{/if}
				</td>
			</tr>
		{/each}
		{#if !data.decisions.length}<tr><td colspan="7" class="none">No decisions yet.</td></tr>{/if}
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
	.notice {
		color: var(--on-variant);
		background: var(--surface-low);
		border-left: 3px solid var(--outline-faint);
		border-radius: 6px;
		font-size: 12.5px;
		line-height: 1.55;
		padding: 10px 14px;
		margin: 0 0 12px;
		max-width: 760px;
	}
	.notice strong {
		color: var(--on);
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
		color: var(--on-primary);
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
		white-space: nowrap;
	}
	td.act form {
		margin: 0;
		display: inline-block;
	}
	td.act form + form {
		margin-left: 6px;
	}
	.mono {
		font-family: 'Source Code Pro', monospace;
		color: var(--outline);
	}
	td.subj {
		max-width: 220px;
	}
	td.subj .mono {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.proposeform select[multiple] {
		min-width: 260px;
	}
	.tag {
		font-size: 10px;
		background: var(--sc-highest);
		padding: 2px 7px;
		border-radius: 4px;
		color: var(--on);
	}
	.tag.eff {
		background: var(--tertiary-soft);
		color: var(--tertiary);
	}
	.none {
		color: var(--outline);
		text-align: center;
	}
</style>
