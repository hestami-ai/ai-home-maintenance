// Decision Center — governance acts across the workbench (approvals, waivers, promotions). The list is a read
// View of every Decision; the actions author governance: propose a Decision (PROPOSED) then approve it (EFFECTIVE),
// or grant/deny a PROPOSED waiver. A decision is authority exercised — a PROPOSED recommendation is not approval
// (INV / RPH-GOV-001/002). Waivers are NOT proposable here: ProposeDecision cannot carry the WaiverDetail DOC-004
// §12.2 requires (exact policy, criterion, finding, controls), so a decision it minted as 'WAIVER' could never
// discharge anything — RequestWaiver is the authoring path (the PWA floor panel drives it). The per-row actions
// mirror the engine's own preconditions (JAN-CMDPRE DWP-01a): ApproveDecision refuses a WAIVER target, and
// GrantWaiver/DenyWaiver refuse a non-WAIVER target, so each row offers only the command the engine will accept.
import { fail } from '@sveltejs/kit';
import { getObject, listDecisions, listGovernedObjects } from '@janumipwb/rph-engine';
import { dispatch, getEngine, mintUiId, uiSession } from '$lib/server/workbench';
import { actingActor } from '$lib/server/identity';
// The PER-4 surface guard lives in ONE module (`$lib/server/optimistic-concurrency`), not inline here. It was
// inline for exactly one route, and the moment a second route needed it the copy would have been the third
// place this repo learned that one guard becomes several that disagree. Extracting it also made its
// load-bearing branch — "the form declared NOTHING, which is not 0" — directly assertable for the first time;
// no e2e can reach that branch, because every rendered page supplies the field.
import { readRenderedRevision, refuse, STALE_FORM } from '$lib/server/optimistic-concurrency';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	// WORKSPACE by design (SPEC-001 INV-02 / FORK-9): this IS the workspace-wide Decision register.
	const decisions = listDecisions(getEngine(), { kind: 'WORKSPACE' }).map((d) => ({
		id: d.id,
		// THE REVISION THIS PAGE IS RENDERED FROM (JPWB-DOC-003 §9 PER-4). It must reach the template and
		// travel back through the form: a value re-read inside the action is ALWAYS current and can never
		// conflict, which satisfies the letter of PER-4 and none of its purpose. `listByType` supplies it and
		// WORKSPACE scope passes the rows through unchanged — this `.map()` was the only place it was dropped.
		revision: d.revision,
		type: String((d.state.decisionType ?? '') as string),
		status: String((d.state.status ?? '') as string),
		selectedOption: String((d.state.selectedOption ?? '') as string),
		rationale: String((d.state.rationale ?? '') as string),
		// What the decision is ABOUT. Rendered because a governance register whose rows do not say what they
		// govern is a list of verbs (REG-F-106 / ASR-15).
		subjectObjectIds: Array.isArray(d.state.subjectObjectIds)
			? (d.state.subjectObjectIds as unknown[]).map(String)
			: []
	}));
	// THE SUBJECTS A PROPOSAL MAY NAME (REG-F-106, ruled REG-D-041). Same WORKSPACE scope as the register above:
	// RPH-DOC-010 §4.7 says this surface is "used to exercise authority over versions, waivers, escalations, and
	// acceptance", and SPEC-001 L2915 confirms a workbench-wide Decision Center is legitimate and conformant.
	const subjects = listGovernedObjects(getEngine(), { kind: 'WORKSPACE' });
	return { decisions, subjects };
};

export const actions: Actions = {
	// Propose a governance Decision — creates it in PROPOSED with a HUMAN authority so it can later be approved.
	propose: async ({ request }) => {
		const form = await request.formData();
		const decisionType = String((form.get('decisionType') ?? '') as string).trim();
		const selectedOption = String((form.get('selectedOption') ?? '') as string).trim();
		const rationale = String((form.get('rationale') ?? '') as string).trim();
		if (!decisionType) return fail(400, { error: 'A decision type is required.' });
		if (!selectedOption) return fail(400, { error: 'A selected option is required.' });
		// ⚠ A DECISION MUST NAME WHAT IT IS ABOUT (REG-F-106, ruled REG-D-041). This used to send `[]`.
		//
		// `subjectObjectIds` is a REQUIRED field of DecisionObject in BOTH ratified contracts (CDM §23.1,
		// Contract Package §22), for all nine decision types — and OBJ-1 forbids reading meaning into the empty
		// case: "No semantic state may be inferred from null values, empty arrays, missing rows…". A subjectless
		// decision is not a decision about nothing; per ASR-15 it "is not authority — it is provenance at best",
		// which made this form look like it was authorizing while being incapable of it. Refused HERE, with a
		// reason, rather than left to fail at whichever downstream gate happens to check.
		const subjectObjectIds = form
			.getAll('subjectObjectIds')
			.filter((v): v is string => typeof v === 'string')
			.map((v) => v.trim())
			.filter(Boolean);
		if (subjectObjectIds.length === 0)
			return fail(400, {
				error:
					'A decision must name what it is about — an authorization is bound to exact subjects and versions (ASR-15). Select at least one subject.'
			});
		const id = mintUiId('dec');
		const r = dispatch('ProposeDecision', 'DECISION', id, {
			decisionType,
			subjectObjectIds,
			selectedOption,
			rationale,
			// THE AUTHORITY IS THE SESSION, READ FROM AUTHENTICATED CONTEXT. `proposeDecision` refuses a payload
			// authority that is not the stamped issuer (ASR-15: a Decision records the authority of ITS issuer, and
			// no delegation record exists to carry one actor's for another). The literal that used to sit here —
			// `ui-user` — was neither, so every propose in the running app was refused.
			authority: actingActor(uiSession()),
			consideredEvidenceIds: [],
			consideredObservationIds: []
		});
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { proposed: id };
	},

	// Approve a PROPOSED Decision — PROPOSED -> EFFECTIVE (gated by the decision's HUMAN authority).
	approve: async ({ request }) => {
		const form = await request.formData();
		const id = String((form.get('id') ?? '') as string).trim();
		if (!id) return fail(400, { error: 'A decision id is required to approve.' });
		// PER-4 FAIL-CLOSED. No declared revision means NO EXPECTATION, which is last-write-wins. The id is
		// already refused when absent; under PER-4 the revision is exactly as load-bearing.
		const expectedRevision = readRenderedRevision(form);
		if (expectedRevision === null) return fail(400, { error: STALE_FORM });
		const selectedOption = String((form.get('selectedOption') ?? '') as string).trim();
		const rationale = String((form.get('rationale') ?? '') as string).trim();
		// ⚠ THE VERSIONS THE APPROVER IS ACTUALLY APPROVING, READ FROM THE STORE. This used to be `{}`.
		//
		// `{}` was not a shortcut — it was VACUOUS, and only harmlessly so because the decisions this route minted
		// had no subjects to disagree about. `approveDecision` compares the stated versions against the pin taken
		// at propose; with no subjects the pin is empty and there is nothing to compare. Now that a proposal names
		// its subjects, stating their CURRENT versions makes that comparison live: if a subject moved between
		// proposal and approval, the approval is REFUSED as stale. That is ASR-15 becoming operative on this route
		// for the first time — "a decision approving version n never authorizes version n+1".
		//
		// Read at APPROVAL time on purpose. Re-reading the pin instead would agree with itself always — the
		// tautology REG-F-050 records, and the same shape as re-reading a revision inside its own action.
		const subjectSemanticVersions: Record<string, number> = {};
		const stored = getObject(getEngine(), id)?.subjectObjectIds;
		const subjectIds = Array.isArray(stored)
			? (stored as unknown[]).filter((v): v is string => typeof v === 'string')
			: [];
		for (const subjectId of subjectIds) {
			const version = getObject(getEngine(), subjectId)?.semanticVersion;
			if (typeof version === 'number') subjectSemanticVersions[subjectId] = version;
		}
		const r = dispatch(
			'ApproveDecision',
			'DECISION',
			id,
			{
				selectedOption,
				rationale,
				consideredEvidenceIds: [],
				consideredObservationIds: [],
				subjectSemanticVersions
			},
			expectedRevision
		);
		if (r.status !== 'ACCEPTED') return refuse(r);
		return { approved: id };
	},

	// Grant a PROPOSED waiver — PROPOSED -> EFFECTIVE, recording the WaiverGranted fact the floor gate audits.
	grant: async ({ request }) => {
		const form = await request.formData();
		const id = String((form.get('id') ?? '') as string).trim();
		if (!id) return fail(400, { error: 'A waiver decision id is required to grant.' });
		const expectedRevision = readRenderedRevision(form);
		if (expectedRevision === null) return fail(400, { error: STALE_FORM });
		const r = dispatch(
			'GrantWaiver',
			'DECISION',
			id,
			{ waiverDecisionId: id, duration: 'until superseded' },
			expectedRevision
		);
		if (r.status !== 'ACCEPTED') return refuse(r);
		return { granted: id };
	},

	// Deny a PROPOSED waiver — PROPOSED -> SUPERSEDED (denial addresses the REQUEST; unmaking a granted waiver
	// is RevokeDecision's act).
	deny: async ({ request }) => {
		const form = await request.formData();
		const id = String((form.get('id') ?? '') as string).trim();
		const rationale = String((form.get('rationale') ?? '') as string).trim();
		if (!id) return fail(400, { error: 'A waiver decision id is required to deny.' });
		const expectedRevision = readRenderedRevision(form);
		if (expectedRevision === null) return fail(400, { error: STALE_FORM });
		const r = dispatch(
			'DenyWaiver',
			'DECISION',
			id,
			{ rationale: rationale || 'Denied from the Decision Center.' },
			expectedRevision
		);
		if (r.status !== 'ACCEPTED') return refuse(r);
		return { denied: id };
	}
};
