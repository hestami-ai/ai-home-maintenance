// Baseline Manager — the authoritative, immutable promotions across the workbench. The load reads the current
// Baselines through the query surface; the actions dispatch real BASELINE commands, advancing the authoring
// lifecycle CANDIDATE -> UNDER_REVIEW -> APPROVED -> AUTHORITATIVE live.
//
// ── PROMOTION IS NO LONGER A DOCUMENTED FOLLOW-UP (S-0 of ROADMAP-decision-subject-scope, REG-F-077) ─────────
//
// This header used to say promotion was "out of scope for this authoring surface" because `canPromoteBaseline`
// needs an effective promotion Decision. That is exactly the hollowness the design names: the gate had NO caller
// from the surface at all — `PromoteBaseline` appeared nowhere in `apps/rph-demo`, so its scope conjunct could
// not be reached, let alone tested, from the workbench.
//
// THE AUTHORIZATION IS SITED NEXT TO ITS OBJECT, WHICH IS THE DESIGN'S WHOLE ANSWER. There is no subject picker:
// `decisionType` is single-valued and the gates demand mutually exclusive values, so no one Decision satisfies
// them all. Here the subject is the row being acted on, so it is DERIVED (`subjectObjectIds: [id]`) — the idiom
// already used at `pwa/[id]:553` and `undertakings/[id]:933`, and the one shape that cannot mint a scope for an
// object the professional is not looking at.
import { fail } from '@sveltejs/kit';
import { listBaselines, listDecisions } from '@janumipwb/rph-engine';
import { actingActor } from '$lib/server/identity';
import { dispatch, getEngine, mintUiId, uiSession } from '$lib/server/workbench';
import { readRenderedRevision, refuse, STALE_FORM } from '$lib/server/optimistic-concurrency';
import type { Actions, PageServerLoad } from './$types';

/**
 * The EFFECTIVE `PROMOTE_BASELINE` Decision that names this baseline, or `undefined`.
 *
 * ⚠ RESOLVED FROM THE STORE, NEVER TAKEN FROM THE FORM, and that is the load-bearing choice. A decision id
 * carried on a hidden input is a caller-supplied claim about who authorized what — REG-F-014's exact shape, on
 * the field that decides whether a governance act is permitted. The surface does not get to say which decision
 * authorizes; it finds the one that does, the same way `hasEffectiveWaiver` (`lib/server/floor.ts:255`) does.
 *
 * WORKSPACE scope, deliberately (SPEC-001 INV-02 / FORK-9): the subject of this lookup is the baseline filtered
 * below, not an Undertaking, and a promotion may be authorized from anywhere in the workspace.
 */
function promotionAuthorizationFor(baselineId: string): string | undefined {
	return listDecisions(getEngine(), { kind: 'WORKSPACE' }).find(
		(d) =>
			d.state.decisionType === 'PROMOTE_BASELINE' &&
			d.state.status === 'EFFECTIVE' &&
			(d.state.subjectObjectIds as string[] | undefined)?.includes(baselineId)
	)?.id;
}

// BaselineObject.baselineType — RPH-DOC-007 §23 / DOC-002 §24.1 (6 values).
const BASELINE_TYPES = [
	'INTENT',
	'REQUIREMENTS',
	'ARCHITECTURE',
	'IMPLEMENTATION',
	'RELEASE',
	'EVIDENCE_PACKAGE'
] as const;

export const load: PageServerLoad = () => {
	// WORKSPACE by design (SPEC-001 INV-02 / FORK-9): this IS the workspace-wide Baseline register. Its declared
	// subject is the workspace, so the scope states that rather than being omitted.
	const baselines = listBaselines(getEngine(), { kind: 'WORKSPACE' }).map((b) => ({
		id: b.id,
		// THE REVISION THIS PAGE IS RENDERED FROM (JPWB-DOC-003 §9 PER-4). `listByType` populates it on every
		// row it emits (queries.ts:44) and the WORKSPACE branch of `withinScope` returns the SAME ARRAY BY
		// REFERENCE (queries.ts:161) — it cannot drop a field, because it does not rebuild the rows. So this
		// `.map()` was the only place the value was discarded, which is precisely what /decisions found.
		//
		// `b.id` and `b.revision` are read from ONE `loadObject` call in ONE loop iteration (queries.ts:39-45),
		// so the id this row submits and the revision it declares cannot describe different objects. That is
		// the check worth making before copying a pattern: a revision belonging to some OTHER aggregate would
		// either conflict spuriously or — far worse — happen to match and protect nothing.
		revision: b.revision,
		type: String((b.state.baselineType ?? '') as string),
		status: String((b.state.status ?? '') as string),
		purpose: String((b.state.purpose ?? '') as string),
		items: Array.isArray(b.state.itemObjectVersions) ? b.state.itemObjectVersions.length : 0,
		// Whether a governance Decision already permits this baseline's promotion. Rendered so the professional
		// can see that authorization is a SEPARATE, recorded act rather than a side effect of clicking Promote —
		// which is what DOC-001 §5.2 reserving promotion to Governance actually means at a surface.
		authorized: promotionAuthorizationFor(b.id) !== undefined
	}));
	return { baselines };
};

export const actions: Actions = {
	// Create a Baseline candidate (CANDIDATE) of the chosen type. Items + assessments are pinned later; a bare
	// candidate is valid and the starting point of the authoring lifecycle.
	//
	// ⚠ DELIBERATELY CARRIES NO `expectedRevision`, and that is the rule rather than an omission. PER-4's
	// NON-EXAMPLE exempts pure creations, and this is one: the id is minted here and the aggregate does not
	// exist before the command. Verified at the handler rather than inferred from the name — `createBaseline`
	// (governance.ts:704) routes to `createObject`, which commits with `expectedRevision: undefined`
	// (kit.ts:560), and the store reads that as "must not yet exist" (sqlite-storage-adapter.ts:151-153). A
	// declared revision would have nothing to compare against. Do not "fix" this by threading one through.
	create: async ({ request }) => {
		const form = await request.formData();
		const baselineType = String((form.get('baselineType') ?? '') as string);
		if (!(BASELINE_TYPES as readonly string[]).includes(baselineType)) {
			return fail(400, { error: 'Choose a baseline type.' });
		}
		const id = mintUiId('base');
		const r = dispatch('CreateBaseline', 'BASELINE', id, {
			baselineType,
			itemObjectIds: [],
			assuranceAssessmentIds: []
		});
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { created: id };
	},

	// CANDIDATE -> UNDER_REVIEW. In scope for PER-4: `advanceStatus` loads the existing aggregate
	// (kit.ts:640) and commits at `loaded.revision + 1`, so the engine's compare-and-swap is live and the
	// surface was declining it by omission.
	//
	// ⚠ THIS IS THE ACTION A NAIVE PARSER WOULD LET THROUGH. The row it acts on was created moments earlier
	// and sits at revision 0 — so `Number('')`, which is also 0, would MATCH. A broken round-trip fails here
	// silently and only surfaces one step later at `approve`. See `optimistic-concurrency.test.ts`.
	submit: async ({ request }) => {
		const form = await request.formData();
		const id = String((form.get('id') ?? '') as string).trim();
		if (!id) return fail(400, { error: 'A baseline id is required.' });
		// PER-4 FAIL-CLOSED. No declared revision means NO EXPECTATION, which is last-write-wins. The id is
		// already refused when absent; under PER-4 the revision is exactly as load-bearing.
		const expectedRevision = readRenderedRevision(form);
		if (expectedRevision === null) return fail(400, { error: STALE_FORM });
		const r = dispatch('SubmitBaselineForReview', 'BASELINE', id, {}, expectedRevision);
		if (r.status !== 'ACCEPTED') return refuse(r);
		return { submitted: id };
	},

	// UNDER_REVIEW -> APPROVED. In scope for PER-4, same shape as `submit`.
	approve: async ({ request }) => {
		const form = await request.formData();
		const id = String((form.get('id') ?? '') as string).trim();
		if (!id) return fail(400, { error: 'A baseline id is required.' });
		const expectedRevision = readRenderedRevision(form);
		if (expectedRevision === null) return fail(400, { error: STALE_FORM });
		const r = dispatch('ApproveBaseline', 'BASELINE', id, {}, expectedRevision);
		if (r.status !== 'ACCEPTED') return refuse(r);
		return { approved: id };
	},

	// AUTHORIZE — mint the governance Decision that permits THIS baseline's promotion, and make it effective.
	//
	// Both halves in one act, deliberately. `ProposeDecision` alone decides nothing — ASR-15 checks authority
	// BEFORE effect, and `canPromoteBaseline` requires `status === 'EFFECTIVE'` — so a surface that only proposed
	// would leave the act unreachable for a second reason and look like it had done the work.
	//
	// ⚠ THE AUTHORITY IS THE SESSION'S OWN, NOT A LITERAL. `proposeDecision` refuses a declared authority that is
	// not the stamped issuer (REG-F-014), so `actingActor(uiSession())` is the only value that can be correct here.
	//
	// ⚠ AND NO VERSIONS ARE SENT. `proposeDecision` derives the pin itself from the store — `subjectVersions`
	// (`handlers/governance.ts:210`) — so a form-supplied version would be a caller's claim about the state of an
	// object it does not own. DESIGN §1.3: the surface supplies SUBJECTS, the engine supplies VERSIONS.
	authorize: async ({ request }) => {
		const form = await request.formData();
		const id = String((form.get('id') ?? '') as string).trim();
		if (!id) return fail(400, { error: 'A baseline id is required.' });
		const decisionId = mintUiId('dec');
		const rationale = `Promotion of baseline ${id}: its authoring lifecycle is complete and its items are pinned.`;
		const proposed = dispatch('ProposeDecision', 'DECISION', decisionId, {
			decisionType: 'PROMOTE_BASELINE',
			// DERIVED FROM THE ROW — the whole of REG-F-077's repair on this surface.
			subjectObjectIds: [id],
			selectedOption: 'Promote to AUTHORITATIVE',
			rationale,
			authority: actingActor(uiSession()),
			consideredObservationIds: []
		});
		if (proposed.status !== 'ACCEPTED') return refuse(proposed);
		// ⚠ THE APPROVAL STATES THE VERSION IT IS APPROVING, AND `{}` WOULD BE THE VACUOUS ANSWER.
		//
		// `ApproveDecisionPayload.subjectSemanticVersions` is REQUIRED (§22.1, the only Decision payload the
		// corpus schematizes). `approveDecision` compares it against the pin taken at propose time and REFUSES on
		// disagreement — *"a decision binds the versions that were REVIEWED"* (DOC-003 ASR-15). The predicate
		// filters on `pinned[id] !== undefined`, so **`{}` iterates zero entries and passes vacuously**, which is
		// what `/decisions:85` sends today.
		//
		// This is NOT the forgery shape DESIGN §1.3 warns about, and the difference is the direction of failure:
		// the PIN is derived by the engine and cannot be influenced from here, while this value is CHECKED against
		// it. A wrong value can only cause a refusal, never widen an authority — so stating the true version is
		// fail-closed and stating nothing is fail-open. It is read from the store, not from the form.
		const baselineVersion = Number(
			(getEngine().loadObject(id)?.state as { semanticVersion?: number } | undefined)?.semanticVersion ?? 1
		);
		const approved = dispatch('ApproveDecision', 'DECISION', decisionId, {
			selectedOption: 'Promote to AUTHORITATIVE',
			rationale,
			consideredEvidenceIds: [],
			consideredObservationIds: [],
			subjectSemanticVersions: { [id]: baselineVersion }
		});
		if (approved.status !== 'ACCEPTED') return refuse(approved);
		return { authorized: id };
	},

	// APPROVED -> AUTHORITATIVE, through `canPromoteBaseline`'s real gate.
	//
	// ⚠ IT REFUSES BEFORE DISPATCHING WHEN NO AUTHORIZATION EXISTS, and that is not a second gate competing with
	// the engine's. `PromoteBaselinePayload.promotionDecisionId` is REQUIRED, so an unauthorized promotion has
	// nothing honest to put there — and inventing a value is the precise defect REG-F-014 item 4 recorded, where
	// a handler's own comment said defaulting "would fabricate a reference to nothing" and the next line did it.
	// Refusing here names what is missing; it never lets an act through that the engine would have stopped.
	//
	// ⚠ AND THE LIMIT OF THAT, STATED SO THE E2E IS NOT READ AS PROVING MORE THAN IT DOES. Because the resolver
	// above filters on the same facts `canPromoteBaseline` checks — type, EFFECTIVE, subject membership — the
	// surface refuses first, so the engine's `PROMOTION_DECISION_OUT_OF_SCOPE` and `NO_EFFECTIVE_PROMOTION_DECISION`
	// findings are UNREACHABLE FROM THIS ROUTE. That is inherent to the shape rather than a defect: any surface
	// must cite *some* id, so any surface pre-filters. The gate itself IS reached and does run — status, authority,
	// scope and transition legality are all evaluated on the accept path — but its individual REFUSAL findings are
	// proved in `packages/rph-domain/src/governance.test.ts`, not here.
	promote: async ({ request }) => {
		const form = await request.formData();
		const id = String((form.get('id') ?? '') as string).trim();
		if (!id) return fail(400, { error: 'A baseline id is required.' });
		const expectedRevision = readRenderedRevision(form);
		if (expectedRevision === null) return fail(400, { error: STALE_FORM });
		const promotionDecisionId = promotionAuthorizationFor(id);
		if (!promotionDecisionId)
			return fail(400, {
				error: `Promotion is refused: no effective PROMOTE_BASELINE decision names baseline ${id}. Authorize the promotion first — an authorization does not bleed to another object (RPH-GOV-005).`
			});
		const r = dispatch(
			'PromoteBaseline',
			'BASELINE',
			id,
			{
				promotionDecisionId,
				// A baseline authored on this surface pins no items and cites no assessments, so both are empty
				// by construction rather than by omission — `canPromoteBaseline`'s item and assessment findings
				// iterate these lists and produce nothing for an empty one.
				expectedItemObjectVersions: [],
				requiredAssessmentIds: []
			},
			expectedRevision
		);
		if (r.status !== 'ACCEPTED') return refuse(r);
		return { promoted: id };
	}
};
