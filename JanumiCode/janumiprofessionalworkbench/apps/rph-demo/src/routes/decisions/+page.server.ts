// Decision Center — governance acts across the workbench (approvals, waivers, promotions). The list is a read
// View of every Decision; the actions author governance: propose a Decision (PROPOSED) then approve it (EFFECTIVE),
// or grant/deny a PROPOSED waiver. A decision is authority exercised — a PROPOSED recommendation is not approval
// (INV / RPH-GOV-001/002). Waivers are NOT proposable here: ProposeDecision cannot carry the WaiverDetail DOC-004
// §12.2 requires (exact policy, criterion, finding, controls), so a decision it minted as 'WAIVER' could never
// discharge anything — RequestWaiver is the authoring path (the PWA floor panel drives it). The per-row actions
// mirror the engine's own preconditions (JAN-CMDPRE DWP-01a): ApproveDecision refuses a WAIVER target, and
// GrantWaiver/DenyWaiver refuse a non-WAIVER target, so each row offers only the command the engine will accept.
import { fail } from '@sveltejs/kit';
import { listDecisions } from '@janumipwb/rph-engine';
import { dispatch, getEngine, mintUiId } from '$lib/server/workbench';
import type { Actions, PageServerLoad } from './$types';

/**
 * The revision the SUBMITTING PAGE was rendered from, or null when the form declared none.
 *
 * ⚠ `Number('')` IS 0, AND 0 IS A REAL REVISION. A newly created aggregate lands at revision 0, so a
 * just-proposed Decision sits at 0. If the hidden input is missing, the browser posts an EMPTY STRING and a
 * naive `Number(raw)` would turn *"the form carried nothing"* into *"expect revision 0"* — which MATCHES a
 * freshly proposed decision. The propose-then-approve e2e would stay green over a form that round-trips
 * nothing at all. THE EMPTY-STRING GUARD IS THE ENTIRE DEFENCE, and it is the easiest thing here to get wrong.
 */
function readRenderedRevision(form: FormData): number | null {
	const raw = form.get('expectedRevision');
	if (typeof raw !== 'string') return null;
	const trimmed = raw.trim();
	if (trimmed === '') return null;
	const n = Number(trimmed);
	return Number.isInteger(n) && n >= 0 ? n : null;
}

const STALE_FORM =
	'This page did not declare the revision it was rendered from. Reload the page and retry.';

/** Surface the RPH code alongside the message so a CONFLICT is distinguishable from a state-machine refusal —
 *  the two read identically otherwise, and that distinction is the only evidence this route can offer. */
function refuse(r: ReturnType<typeof dispatch>) {
	return fail(r.status === 'CONFLICT' ? 409 : 400, {
		error: r.error?.message ?? r.status,
		code: r.error?.code
	});
}

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
		rationale: String((d.state.rationale ?? '') as string)
	}));
	return { decisions };
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
		const id = mintUiId('dec');
		const r = dispatch('ProposeDecision', 'DECISION', id, {
			decisionType,
			subjectObjectIds: [],
			selectedOption,
			rationale,
			authority: { actorId: 'ui-user', actorType: 'HUMAN', displayName: 'Workbench User' },
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
		const r = dispatch(
			'ApproveDecision',
			'DECISION',
			id,
			{
				selectedOption,
				rationale,
				consideredEvidenceIds: [],
				consideredObservationIds: [],
				subjectSemanticVersions: {}
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
