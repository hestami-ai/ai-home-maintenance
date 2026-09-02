// The TEST_MODE Reasoning-Review Validator must FAIL CLOSED on a subject it cannot read.
//
// ── THE DEFECT THIS FILE EXISTS FOR ─────────────────────────────────────────────────────────────────────────
// `judge()` returned `{ findings: [], recommendation: 'SATISFIED' }` from BOTH its unreadable-subject arms — a
// JSON parse failure, and an export with no `nodes`. So the floor's mandatory Reasoning Review passed, with
// zero findings, on content it had never read.
//
// ⚠ AND IT IS A CONTROL THAT CANNOT FAIL, SITTING INSIDE THE ASSURANCE FLOOR, ON THE PATH THE GATE USES. Every
// e2e that "proves" the floor blocks was proving less than it appeared: the one validator the gate can run had
// an arm that returns a pass for anything it cannot parse.
//
// ⚠⚠ THE SAME FILE ALREADY FAILS CLOSED ONE FUNCTION LOWER, WITH A COMMENT EXPLAINING WHY. `evaluate` throws on
// a missing `reasoningReview` context and cites §13.3 "fail closed". So the module holds both postures at once
// — reasoned fail-closed on missing INPUT, silent fail-open on unreadable CONTENT — and its own header claims
// "an invalid one is REJECTED", which was a behaviour the code did not have.
import { describe, expect, it } from 'vitest';
import { createMockReasoningReviewValidator } from './mock-reasoning-review-validator.js';
import { REASONING_REVIEW_CRITERIA } from '@janumipwb/rph-assurance';
import { buildPwaGraphExport, type PwaGraphNode } from '@janumipwb/rph-projections';

const SUBJECT = { id: 'pwa-1', semanticVersion: 1 };

async function judgeContent(content: string) {
	const v = createMockReasoningReviewValidator();
	return v.evaluate(SUBJECT as never, {
		reasoningReview: { content, criteria: REASONING_REVIEW_CRITERIA, prompt: 'x' }
	} as never);
}

/** A well-formed export — the control that proves the fix did not simply block everything.
 *  ⚠ BUILT WITH THE REAL BUILDER, NOT HAND-WRITTEN JSON. The first version of this fixture invented a shape
 *  (`edges` instead of `permits`) and `analyzePwaGraph` threw — a control that fails for its OWN reason
 *  proves nothing about the subject, so the fixture is derived from the same function production uses. */
const ROOT: PwaGraphNode = {
	id: 'root',
	name: 'root',
	pwuKind: 'PRODUCT_REALIZATION',
	isRoot: true,
	permittedChildTypeIds: [],
	requiredInputs: [],
	requiredOutputs: []
} as PwaGraphNode;

const VALID_GRAPH = JSON.stringify(
	buildPwaGraphExport(
		{ id: 'pwa_t', name: 'T', domain: 'software', version: '0.1.0', publicationStatus: 'DRAFT' } as never,
		[ROOT]
	)
);

describe('mock Reasoning Review — fail CLOSED on an unreadable subject', () => {
	it('unparseable content is INCONCLUSIVE, never SATISFIED', async () => {
		const r = await judgeContent('}{ not json at all');

		// THE MUTANT: return SATISFIED, which is what shipped. floor.ts:333 — INCONCLUSIVE "leaves assurance
		// incomplete → blocks"; assurance-rules.ts:44 — undeterminable on a mandatory criterion is
		// "INCONCLUSIVE (never a pass)". A validator that cannot read its subject has not reviewed it.
		expect(r.dispositionRecommendation).toBe('INCONCLUSIVE');
		expect(r.dispositionRecommendation).not.toBe('SATISFIED');
	});

	it('a parsed object with no `nodes` is INCONCLUSIVE — malformed is not empty', async () => {
		// `{nodes: []}` is a legitimately EMPTY graph and stays reviewable; an export with no `nodes` key at all
		// is malformed. THE MUTANT: collapse the two and pass both.
		const r = await judgeContent(JSON.stringify({ notAGraph: true }));
		expect(r.dispositionRecommendation).toBe('INCONCLUSIVE');
	});

	it('the unreadability is RECORDED, not merely dispositioned', async () => {
		const r = await judgeContent('}{ not json at all');

		// THE MUTANT: return INCONCLUSIVE with empty limitations. PER-9 E-5 is "the parse/validation/repair
		// outcome"; a disposition alone says the review failed but not that it failed to READ. §8.9 requires a
		// valid result to identify its "residual uncertainty, limitations" — this is what that field is for.
		expect(r.limitations.length).toBeGreaterThan(0);
		expect(r.limitations.join(' ')).toMatch(/pars|read/i);
	});

	it('CONTROL — a well-formed graph is still SATISFIED', async () => {
		// Without this the fix could not be told apart from "block everything", which would pass all three
		// assertions above while destroying the gate.
		const r = await judgeContent(VALID_GRAPH);
		expect(r.dispositionRecommendation).toBe('SATISFIED');
	});
});
