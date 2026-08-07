// Baseline Manager — the authoritative, immutable promotions across the workbench. The load reads the current
// Baselines through the query surface; the actions dispatch real BASELINE commands, advancing the authoring
// lifecycle CANDIDATE -> UNDER_REVIEW -> APPROVED live. Promotion to AUTHORITATIVE (PromoteBaseline) is a
// documented follow-up: canPromoteBaseline needs an effective promotion Decision + satisfied assessments, which is
// out of scope for this authoring surface.
import { fail } from '@sveltejs/kit';
import { listBaselines } from '@janumipwb/rph-engine';
import { dispatch, getEngine, mintUiId } from '$lib/server/workbench';
import { readRenderedRevision, refuse, STALE_FORM } from '$lib/server/optimistic-concurrency';
import type { Actions, PageServerLoad } from './$types';

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
		items: Array.isArray(b.state.itemObjectVersions) ? b.state.itemObjectVersions.length : 0
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
	}
};
