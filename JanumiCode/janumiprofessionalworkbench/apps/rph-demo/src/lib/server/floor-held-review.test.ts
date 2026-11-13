// ⭐⭐ `JAN-EXEC` Phase 7, PACKAGE L13 — design D68 (`REG-D-157`; `REG-F-630`; `REG-D-059`; the lead's decisions (a) to (d) and (g)) — A
// REVIEW THE FLOOR HOLDS INCONCLUSIVE FOR A FAILED CHECK IS ANSWERED AS A REJECTED ONE: ITS FAILED CHECKS GO BACK, AND A ROUND HELD SO
// ASKS FOR A REPAIR.
//
// ⛔ WHAT WAS WRONG. In P6 again's sixth paid run the second round's "CLI and Error Handling Design", unchanged since the first, was
// recommended SATISFIED by its reviewer with one check failed. The boundary refuses a SATISFIED over an unmet mandatory check, so the
// floor recorded the type INCONCLUSIVE with the check's observation beside it — and the classifier sent no INCONCLUSIVE review's
// observation back: beside the rejected "Failure and Interface E2E Verification" the check was left out of the repair, and alone the
// turn would have ended with no repair and a guidance naming a reviewer that did not fail (`REG-F-630`). A unit's review held so got
// no further try.
// ⭑ WHAT MUST HOLD (the lead's test, the record's own: the record keeps no reviewer recommendation but ESCALATED, `REG-F-475`). An
// INCONCLUSIVE review carrying an observation whose code is a check the review declares (`REASONING_REVIEW_CRITERIA`) is answered as a
// REJECTED review is: those observations are its findings, beside a REJECTED or CONDITIONALLY_SATISFIED review's, and none of its
// other observations; a round ~~whose fold is INCONCLUSIVE because of such a review~~ ⭐ holding such a review, whatever its fold
// (package L14, `REG-D-158`), is answered REFINE_SUBJECT, autoRefine true, with
// REFINE_SUBJECT's guidance; and the page reads the hint for a revision. An INCONCLUSIVE review with no failed declared check — an
// unanswered check, an operational code, a boundary-rejected reply that recorded no failed check, a code no check declares — sends
// nothing back and is answered as today, word for word.
// ⭐⭐ `JAN-EXEC` Phase 7, PACKAGE L14 — design D68 as amended (`REG-D-158`; the lead's decisions (a) to (c)) — WHATEVER THE ROUND'S FOLD.
// ⛔ Package L13 asked the fold to be INCONCLUSIVE. Beside a part the round holds no concluded review of — MISSING, or recorded in a state
// no completion concludes in — the fold is UNASSESSED (`partsDisposition`), and a held part there was answered as an incomplete review,
// nothing sent back, where a REJECTED part beside the same part folds the round REJECTED and is answered by revision. The fold and the
// record stay as they are; only the answer moves, and with it the page's hint and the escalation note keyed on the hint (L14's block
// below; through the page's own read, `floor-held-review-page.test.ts`).
//
// ⭑ THE CLASSIFIER, PURE: rounds as the floor returns one (`floor-parts.test.ts`'s `partView` and `roundOf`, restated: a test file's
// fixtures are its own), and a unit's view as the execution plane builds one (`execution/floor-over-subject.ts`: the three policies
// and no parts); where a control's point is how the RECORD reads, the record is made by the package's own composition
// (`assuranceRecordingPlan` over `reasoningReviewResultFromJudgement`). The statements are stand-ins; no model is asked anything.
import { vi } from 'vitest';

// ⭑ `workbench.ts` reads `RPH_DEMO_MODE` at load, and only a harness may reset its engine (the last guard below reads the seed).
vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

import {
	assuranceRecordingPlan,
	deMinimisFloorPlan,
	FLOOR_POLICY_IDS,
	REASONING_REVIEW_CRITERIA,
	reasoningReviewResultFromJudgement,
	REVIEWER_RECOMMENDED_ESCALATION,
	SEEDED_REASONING_REVIEW_CRITERIA,
	type AssuranceSubject,
	type ReasoningReviewJudgement
} from '@janumipwb/rph-assurance';
import { AssuranceAssessmentStateSchema, AssuranceDispositionRecommendationSchema } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';
import {
	classifyFloorRemediation,
	floorBlockedHint,
	floorFailedReviews,
	partsDisposition,
	reasoningReviewCriteria,
	refineDirective,
	type FloorPartView,
	type FloorRemediation,
	type FloorView
} from './floor.js';
import { SESSION_CREDENTIAL } from './identity.js';
import { getEngine, resetEngine } from './workbench.js';

const REVIEW = FLOOR_POLICY_IDS.REASONING_REVIEW;
type Obs = { readonly code: string; readonly severity: string; readonly statement: string };

/** The classifier's answers, verbatim (`floor.ts`) — restated, so a change to any of them reddens here. */
const REFINE_GUIDANCE =
	'PublishPwa remains blocked while valid Reasoning Review findings are open. Revise the reviewed PWA graph and/or its recorded professional rationale as the coded findings require, then rerun assurance.';
const INCOMPLETE_GUIDANCE =
	'PublishPwa remains blocked because the mandatory Reasoning Review is incomplete but produced no valid subject finding. Inspect the recorded policy result, configure or change the reviewer as needed, and rerun assurance. Do not revise the PWA or record a waiver merely to clear an incomplete review.';
const EXECUTION_FAILED_GUIDANCE =
	'PublishPwa remains blocked because the mandatory Reasoning Review did not execute. Configure or retry the reviewer; if it remains unavailable, change to a permitted independent validator and rerun assurance. Do not revise the PWA or record a waiver in response to this execution failure.';
/** Today's answer to an INCONCLUSIVE review that could not tell, whole. */
const INCOMPLETE: FloorRemediation = {
	action: 'RETRY_OR_CONFIGURE_REVIEWER',
	autoRefine: false,
	findings: [],
	guidance: INCOMPLETE_GUIDANCE
};

// ── The sixth run's types, by stand-in ids, in an export order ─────────────────────────────────────────────────────────────────
const SUCCESS = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5W11';
const FAILURE = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5W12';
const DESIGN = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5W13';
const NAMES: Readonly<Record<string, string>> = {
	[SUCCESS]: 'Successful Workflow E2E Verification',
	[FAILURE]: 'Failure and Interface E2E Verification',
	[DESIGN]: 'CLI and Error Handling Design'
};
const INTENT = 'Realize the CLI product the Undertaking describes.';

/** A failed check as the record holds one: coded by the check's id, at the policy's declared severity (`R25`), BLOCKING. */
const failedCheck = (code: string, statement: string): Obs => ({ code, severity: 'BLOCKING', statement });
/** The rejected leaf's check, and the held design's — stand-in statements. */
const LEAF_FAULT = failedCheck(
	'RR-04-no-proxy-satisfaction',
	'Unlike its revised sibling, this leaf’s prompt neither forbids fabricated evidence nor says how to represent evidence that is unavailable.'
);
const DESIGN_FAULT = failedCheck(
	'RR-07-no-contradiction',
	'The design says every error exits with a non-zero status, and its own example of a missing input file exits with zero.'
);
/** An observation coded by no check the review declares — as the waiver e2e stages one (`floor.test.ts`), and one more. */
const UNDECLARED: Obs = { code: 'RR-04', severity: 'BLOCKING', statement: 'Staged blocking reasoning-review finding.' };
const UNLISTED: Obs = { code: 'RR-10-unlisted-check', severity: 'BLOCKING', statement: 'A check this policy does not declare.' };
const EXECUTION_FAILED: Obs = { code: 'VALIDATOR_EXECUTION_FAILED', severity: 'MATERIAL', statement: 'The reviewer did not respond.' };

const part = (typeId: string, disposition: string, observations: readonly Obs[] = [], independenceOk = true): FloorPartView => ({
	typeId,
	typeName: NAMES[typeId] ?? typeId,
	semanticVersion: 1,
	disposition,
	independenceOk,
	observations: observations.map((o) => ({ ...o, typeId, typeName: NAMES[typeId] ?? typeId }))
});
/** A round over `parts`, folded as the floor folds one, beside the PWA's two deterministic policies, which passed. */
const roundOf = (parts: readonly FloorPartView[]): FloorView => {
	const fold = partsDisposition(parts);
	return {
		subjectId: 'pwa_01ARZ3NDEKTSV4RRFFQ69G5W00',
		aggregate: fold,
		satisfied: fold === 'SATISFIED',
		waived: false,
		policies: [
			{ policyId: 'floor.schema-invariant', disposition: 'SATISFIED', independenceOk: true, observations: [] },
			{ policyId: 'floor.identity-provenance', disposition: 'SATISFIED', independenceOk: true, observations: [] },
			{
				policyId: REVIEW,
				disposition: fold,
				independenceOk: parts.every((p) => p.independenceOk),
				observations: parts.flatMap((p) => p.observations)
			}
		],
		reasoningGaps: [],
		parts
	};
};
/** A unit's review as the execution plane hands it to the classifier: the three policies and no parts (`floor-over-subject.ts`). */
const unitView = (disposition: string, observations: readonly Obs[]): FloorView =>
	({
		subjectId: 'art_01ARZ3NDEKTSV4RRFFQ69G5W90',
		satisfied: false,
		waived: false,
		policies: [
			{ policyId: 'floor.schema-invariant', disposition: 'SATISFIED', independenceOk: true, observations: [] },
			{ policyId: 'floor.identity-provenance', disposition: 'SATISFIED', independenceOk: true, observations: [] },
			{ policyId: REVIEW, disposition, independenceOk: true, observations: [...observations] }
		]
	}) as unknown as FloorView;

const typed = (r: FloorRemediation) => r.findings.map((f) => [f.typeId ?? null, f.code]);

describe('⭐⭐ L13 — D68: a review the floor holds INCONCLUSIVE for a failed check is answered as a REJECTED one', () => {
	// ⛔ PREDICTED RED, read from the code at 230574f3: only REJECTED and CONDITIONALLY_SATISFIED parts send their observations back,
	// so the held design's check is not among the findings, and the directive lists the rejected leaf alone.
	it('⭐ RED — the sixth run’s second-round shape (stand-in statements): a REJECTED type beside one held INCONCLUSIVE for a failed check — both types’ checks are the findings, in export order, and the directive lists each under its type', () => {
		const round = roundOf([part(SUCCESS, 'SATISFIED'), part(FAILURE, 'REJECTED', [LEAF_FAULT]), part(DESIGN, 'INCONCLUSIVE', [DESIGN_FAULT])]);
		expect(round.policies.find((p) => p.policyId === REVIEW)?.disposition, 'arrangement: the fold').toBe('REJECTED');

		const remediation = classifyFloorRemediation(round);

		expect(typed(remediation), 'the held type’s failed check is not among the findings').toEqual([
			[FAILURE, LEAF_FAULT.code],
			[DESIGN, DESIGN_FAULT.code]
		]);
		expect([remediation.action, remediation.autoRefine, remediation.guidance, remediation.failedParts]).toEqual([
			'REFINE_SUBJECT',
			true,
			REFINE_GUIDANCE,
			undefined
		]);
		// ⭐ THE DIRECTIVE THE AGENT IS GIVEN, WHOLE: each type's check under its type, the rest of the text as package L12 leaves it.
		expect(refineDirective(INTENT, remediation.findings, remediation.failedParts)).toBe(
			[
				'An independent assurance Reasoning Review produced valid findings about the authored PWA subject, reviewed type by type.',
				'Revise the PWA graph and/or its recorded professional rationale as each coded finding requires; do not merely restate the intent:',
				'Every type of the PWA is reviewed again after this revision, not only those named below. Where a finding names a problem, look for the same problem in every other type and fix it wherever it occurs.',
				`Findings about the type "Failure and Interface E2E Verification" (${FAILURE}):`,
				`1. [${LEAF_FAULT.code}] ${LEAF_FAULT.statement}`,
				'',
				`Findings about the type "CLI and Error Handling Design" (${DESIGN}):`,
				`1. [${DESIGN_FAULT.code}] ${DESIGN_FAULT.statement}`,
				'',
				`Original intent: ${INTENT}`
			].join('\n')
		);
	});

	// ⛔ PREDICTED RED: the fold is INCONCLUSIVE, which no rule answers by revision — RETRY_OR_CONFIGURE_REVIEWER, autoRefine false, no
	// finding, and the page's hint NOT_BY_REVISION.
	it('⭐ RED — the held type alone, beside satisfied ones: REFINE_SUBJECT, autoRefine true, its check listed, REFINE_SUBJECT’s guidance — and the page reads the hint for a revision', () => {
		const round = roundOf([part(SUCCESS, 'SATISFIED'), part(FAILURE, 'SATISFIED'), part(DESIGN, 'INCONCLUSIVE', [DESIGN_FAULT])]);
		expect(round.policies.find((p) => p.policyId === REVIEW)?.disposition, 'arrangement: the fold').toBe('INCONCLUSIVE');

		expect(classifyFloorRemediation(round), 'the held round is not answered as a rejected one').toEqual({
			action: 'REFINE_SUBJECT',
			autoRefine: true,
			findings: [{ ...DESIGN_FAULT, typeId: DESIGN, typeName: NAMES[DESIGN] }],
			guidance: REFINE_GUIDANCE
		});
		expect(floorBlockedHint(round), 'the page does not read the hint for a revision').toBe('REVISE');
	});

	// ⛔ PREDICTED RED: the concluded parts, classified without the failed one, are answered RETRY_OR_CONFIGURE_REVIEWER, so the branch
	// answers nothing and the execution failure's branch answers the round.
	it('⭐ RED — beside a part whose review failed operationally: the beside-failed-reviews branch answers by revision, the held type’s check the finding and the failed type named', () => {
		const round = roundOf([
			part(SUCCESS, 'INCONCLUSIVE', [EXECUTION_FAILED], false),
			part(FAILURE, 'SATISFIED'),
			part(DESIGN, 'INCONCLUSIVE', [DESIGN_FAULT])
		]);

		const remediation = classifyFloorRemediation(round);

		expect([remediation.action, remediation.autoRefine, remediation.failedParts], 'the branch does not answer by revision').toEqual([
			'REFINE_SUBJECT',
			true,
			[{ typeId: SUCCESS, typeName: NAMES[SUCCESS] }]
		]);
		expect(typed(remediation)).toEqual([[DESIGN, DESIGN_FAULT.code]]);
		expect(remediation.guidance).toBe(
			`${REFINE_GUIDANCE} The Reasoning Review of "Successful Workflow E2E Verification" (${SUCCESS}) failed operationally and recorded no finding: that failure is not a defect in the PWA, and every type, the failed ones included, is reviewed again when assurance reruns.`
		);
		expect([floorBlockedHint(round), floorFailedReviews(round)]).toEqual([
			'REVISE_BESIDE_FAILED_REVIEWS',
			`"Successful Workflow E2E Verification" (${SUCCESS})`
		]);
	});

	// ⛔ PREDICTED RED: a review with no parts is judged by its own disposition, INCONCLUSIVE, which sends nothing back.
	it('⭐ RED — a unit’s review, which has no parts, held so: REFINE_SUBJECT, autoRefine true, its failed declared check the one finding — never its observation that no check declares', () => {
		expect(classifyFloorRemediation(unitView('INCONCLUSIVE', [DESIGN_FAULT, UNLISTED])), 'a unit’s held review is not answered as a rejected one').toEqual({
			action: 'REFINE_SUBJECT',
			autoRefine: true,
			findings: [DESIGN_FAULT],
			guidance: REFINE_GUIDANCE
		});
	});

	// ⛔ PREDICTED RED: today nothing of an INCONCLUSIVE part goes back, so its check is missing; under D68 only its failed declared
	// check goes, never its observation that no check declares, nor its operational one.
	it('⭐ RED — a held part’s other observations stay: only its failed declared check goes back, beside a rejected part’s findings', () => {
		const round = roundOf([part(FAILURE, 'REJECTED', [LEAF_FAULT]), part(DESIGN, 'INCONCLUSIVE', [UNDECLARED, DESIGN_FAULT, UNLISTED])]);
		expect(typed(classifyFloorRemediation(round)), 'a held part’s other observation went back, or its check did not').toEqual([
			[FAILURE, LEAF_FAULT.code],
			[DESIGN, DESIGN_FAULT.code]
		]);
	});
});

describe('⭑ L13 — D68, controls: an INCONCLUSIVE review that could not tell is answered as today, word for word', () => {
	const COULD_NOT_TELL: readonly (readonly [string, readonly Obs[]])[] = [
		['an unanswered check (nothing observed)', []],
		['a code no check declares, as the waiver e2e stages it', [UNDECLARED]],
		['a code no check declares, the policy’s own form', [UNLISTED]]
	];

	for (const [label, observations] of COULD_NOT_TELL) {
		it(`⭑ CONTROL — ${label}: alone beside satisfied parts, and a unit’s review, answered as an incomplete review, nothing sent back`, () => {
			const round = roundOf([part(SUCCESS, 'SATISFIED'), part(DESIGN, 'INCONCLUSIVE', observations)]);
			expect(classifyFloorRemediation(round), 'the round').toEqual(INCOMPLETE);
			expect(floorBlockedHint(round), 'the page').toBe('NOT_BY_REVISION');
			expect(classifyFloorRemediation(unitView('INCONCLUSIVE', observations)), 'a unit’s review').toEqual(INCOMPLETE);
		});
	}

	it('⭑ CONTROL — an operational code: the review that did not execute is answered by its own branch, word for word, nothing sent back', () => {
		expect(classifyFloorRemediation(roundOf([part(SUCCESS, 'SATISFIED'), part(DESIGN, 'INCONCLUSIVE', [EXECUTION_FAILED], false)]))).toEqual({
			action: 'RETRY_OR_CONFIGURE_REVIEWER',
			autoRefine: false,
			findings: [],
			guidance: EXECUTION_FAILED_GUIDANCE
		});
		expect(classifyFloorRemediation(unitView('INCONCLUSIVE', [EXECUTION_FAILED]))).toEqual({
			action: 'RETRY_OR_CONFIGURE_REVIEWER',
			autoRefine: false,
			findings: [],
			guidance: EXECUTION_FAILED_GUIDANCE
		});
	});

	// ⭑ THE RECORD, MADE BY THE PACKAGE'S OWN COMPOSITION: a clean reply recommending SATISFIED, bound to another version of its
	// subject, is boundary-rejected (`RPH_SUBJECT_VERSION_MISMATCH`) and recorded INCONCLUSIVE with nothing observed.
	it('⭑ CONTROL — a boundary-rejected reply that recorded no failed check (the composition’s own record): answered as an incomplete review, nothing sent back', () => {
		const plan = recorded(clean('SATISFIED'), { stale: true });
		expect(plan.assessments.map((a) => [a.disposition, a.observations.length]), 'arrangement: the boundary’s INCONCLUSIVE, nothing observed').toEqual([
			['INCONCLUSIVE', 0]
		]);
		expect(classifyFloorRemediation(viewOf(plan))).toEqual(INCOMPLETE);
	});

	it('⭑ CONTROL — a part that could not tell beside a CONDITIONALLY_SATISFIED part’s finding: the fold INCONCLUSIVE, answered as today, nothing sent back', () => {
		const minor: Obs = { code: 'RR-03-no-unjustified-scope-reduction', severity: 'MATERIAL', statement: 'The scope is narrowed without a stated reason.' };
		expect(classifyFloorRemediation(roundOf([part(FAILURE, 'CONDITIONALLY_SATISFIED', [minor]), part(DESIGN, 'INCONCLUSIVE', [UNDECLARED])]))).toEqual(
			INCOMPLETE
		);
	});

	// ⭑ (b) NAMES A FOLDED INCONCLUSIVE: a held part beside a part the round holds no review of (MISSING) folds UNASSESSED, ~~and is
	// answered as today~~. The authoring route never makes such a round (`runPwaFloor` reviews every part it lists); the page's read can.
	// ⭐⭐ Package L14 (`REG-D-158`; D68 as amended, the lead's decision (c)) — RESTATED TO THE RULING: a held part is answered as a rejected
	// one is, whatever the fold, as a REJECTED part beside the same part is (it folds the round REJECTED). The fold stays UNASSESSED; only the
	// answer moves, and with it the page's hint and the escalation note keyed on the hint. ⛔ PREDICTED RED at 769394ba:
	// RETRY_OR_CONFIGURE_REVIEWER, nothing sent back. Its old promise is kept where it still holds — a part that could not tell, beside a part
	// with no concluded review, answered as today — by L14's control below.
	it('~~⭑ CONTROL~~ ⭐ RED — a held part beside a part the round holds no review of: the fold UNASSESSED, ~~answered as today~~ ⭐ answered as a rejected one is — REFINE_SUBJECT, its check the one finding, and the page reads the hint for a revision (package L14, REG-D-158)', () => {
		const round = roundOf([part(SUCCESS, 'MISSING'), part(DESIGN, 'INCONCLUSIVE', [DESIGN_FAULT])]);
		expect(round.policies.find((p) => p.policyId === REVIEW)?.disposition, 'arrangement: the fold').toBe('UNASSESSED');
		expect(classifyFloorRemediation(round), 'the held part beside a part with no review is not answered as a rejected one').toEqual({
			action: 'REFINE_SUBJECT',
			autoRefine: true,
			findings: [{ ...DESIGN_FAULT, typeId: DESIGN, typeName: NAMES[DESIGN] }],
			guidance: REFINE_GUIDANCE
		});
		expect(floorBlockedHint(round), 'the page does not read the hint for a revision').toBe('REVISE');
	});

	it('⭑ CONTROL — a satisfied round: nothing to do', () => {
		expect(classifyFloorRemediation(roundOf([part(SUCCESS, 'SATISFIED'), part(DESIGN, 'SATISFIED')]))).toEqual({
			action: 'NONE',
			autoRefine: false,
			findings: [],
			guidance: ''
		});
	});

	// ⭑ A REJECTED ROUND, BYTE FOR BYTE: its findings and its directive as at 230574f3 — the rejected part's observations, its code no
	// check declares among them and the reviewer's recommendation never; and beside it parts that could not tell send nothing.
	it('⭑ CONTROL — a REJECTED round’s findings and directive, byte for byte, beside INCONCLUSIVE parts that could not tell', () => {
		const recommendation: Obs = { code: REVIEWER_RECOMMENDED_ESCALATION, severity: 'INFORMATIONAL', statement: 'The reviewing model’s recommendation was ESCALATED.' };
		const round = roundOf([
			part(SUCCESS, 'INCONCLUSIVE', []),
			part(FAILURE, 'REJECTED', [LEAF_FAULT, UNLISTED, recommendation]),
			part(DESIGN, 'INCONCLUSIVE', [UNDECLARED])
		]);
		const remediation = classifyFloorRemediation(round);
		expect([remediation.action, remediation.autoRefine, typed(remediation)]).toEqual([
			'REFINE_SUBJECT',
			true,
			[
				[FAILURE, LEAF_FAULT.code],
				[FAILURE, UNLISTED.code]
			]
		]);
		expect(refineDirective(INTENT, remediation.findings, remediation.failedParts)).toBe(
			[
				'An independent assurance Reasoning Review produced valid findings about the authored PWA subject, reviewed type by type.',
				'Revise the PWA graph and/or its recorded professional rationale as each coded finding requires; do not merely restate the intent:',
				'Every type of the PWA is reviewed again after this revision, not only those named below. Where a finding names a problem, look for the same problem in every other type and fix it wherever it occurs.',
				`Findings about the type "Failure and Interface E2E Verification" (${FAILURE}):`,
				`1. [${LEAF_FAULT.code}] ${LEAF_FAULT.statement}`,
				`2. [${UNLISTED.code}] ${UNLISTED.statement}`,
				'',
				`Original intent: ${INTENT}`
			].join('\n')
		);
	});
});

// ── Package L14 — the rounds a held part can share, read from the contract ──────────────────────────────────────────────────────────
/** The assessment states no completion concludes in: the contract's fifteen less the five a completion admits, each read as MISSING by
 *  the fold (`partsDisposition`), so a round beside any of them folds UNASSESSED. Read from the contract, never restated. */
const NOT_CONCLUDED: readonly string[] = AssuranceAssessmentStateSchema.options.filter(
	(s) => !(AssuranceDispositionRecommendationSchema.options as readonly string[]).includes(s)
);
/** The fold a round's reasoning review shows. */
const foldOf = (round: FloorView): string | undefined => round.policies.find((p) => p.policyId === REVIEW)?.disposition;
/** A round holding the design's held part, answered as a round with a REJECTED part is: its check the one finding, whole. */
const HELD_ANSWER: FloorRemediation = {
	action: 'REFINE_SUBJECT',
	autoRefine: true,
	findings: [{ ...DESIGN_FAULT, typeId: DESIGN, typeName: NAMES[DESIGN] }],
	guidance: REFINE_GUIDANCE
};

describe('⭐⭐ L14 — REG-D-158 (D68 as amended): a held review is answered as a rejected one whatever the round’s fold — beside a part with no concluded review too', () => {
	// ⛔ PREDICTED RED, read from the code at 769394ba: the condition asks the fold to be INCONCLUSIVE, and beside a part with no concluded
	// review the fold is UNASSESSED, so the held part's round is answered RETRY_OR_CONFIGURE_REVIEWER, nothing sent back — first beside
	// REQUESTED, the first of the contract's states no completion concludes in. Its arrangement (the folds) green before it.
	it('⭐ RED — the general form: beside a part in each state its review can be recorded in (the contract’s fifteen) and beside one the read marks MISSING, the held part’s round is answered as a rejected one is, and the page reads the hint for a revision — the folds it shares REJECTED, UNASSESSED and INCONCLUSIVE alone', () => {
		expect(NOT_CONCLUDED, 'arrangement: the contract’s states no completion concludes in').toEqual([
			'REQUESTED',
			'EVIDENCE_PENDING',
			'READY',
			'ASSESSING',
			'WAIVED',
			'VALIDATOR_FAILED',
			'INDEPENDENCE_VIOLATION',
			'INVALIDATED',
			'WAIVER_EXPIRED',
			'CANCELLED'
		]);
		const rounds = [...AssuranceAssessmentStateSchema.options, 'MISSING'].map(
			(state) => [state, roundOf([part(SUCCESS, state), part(DESIGN, 'INCONCLUSIVE', [DESIGN_FAULT])])] as const
		);
		const folds = new Map<string, string[]>();
		for (const [state, round] of rounds) folds.set(foldOf(round) ?? '', [...(folds.get(foldOf(round) ?? '') ?? []), state]);
		expect(Object.fromEntries(folds), 'arrangement: the folds a held part shares a round in, and beside what').toEqual({
			INCONCLUSIVE: ['SATISFIED', 'CONDITIONALLY_SATISFIED', 'INCONCLUSIVE', 'ESCALATED'],
			REJECTED: ['REJECTED'],
			UNASSESSED: [...NOT_CONCLUDED, 'MISSING']
		});

		for (const [state, round] of rounds) {
			expect(
				classifyFloorRemediation(round),
				`beside a part recorded ${state} (the fold ${foldOf(round)}): the held part is not answered as a rejected one`
			).toEqual(HELD_ANSWER);
			expect(floorBlockedHint(round), `beside a part recorded ${state}: the page does not read the hint for a revision`).toBe('REVISE');
		}
	});

	// ⛔ PREDICTED RED: the parts that concluded, classified without the failed one, fold UNASSESSED beside the MISSING part, which the
	// condition does not answer by revision; so the branch answers nothing, and the execution failure's branch answers the round.
	it('⭐ RED — beside a part whose review failed operationally and a part the round holds no review of: the beside-failed-reviews branch answers by revision, the held type’s check the finding and the failed type named', () => {
		const round = roundOf([
			part(SUCCESS, 'INCONCLUSIVE', [EXECUTION_FAILED], false),
			part(FAILURE, 'MISSING'),
			part(DESIGN, 'INCONCLUSIVE', [DESIGN_FAULT])
		]);
		expect(foldOf(round), 'arrangement: the fold').toBe('UNASSESSED');

		const remediation = classifyFloorRemediation(round);

		expect([remediation.action, remediation.autoRefine, remediation.failedParts], 'the branch does not answer by revision').toEqual([
			'REFINE_SUBJECT',
			true,
			[{ typeId: SUCCESS, typeName: NAMES[SUCCESS] }]
		]);
		expect(typed(remediation)).toEqual([[DESIGN, DESIGN_FAULT.code]]);
		expect(remediation.guidance).toBe(
			`${REFINE_GUIDANCE} The Reasoning Review of "Successful Workflow E2E Verification" (${SUCCESS}) failed operationally and recorded no finding: that failure is not a defect in the PWA, and every type, the failed ones included, is reviewed again when assurance reruns.`
		);
		expect([floorBlockedHint(round), floorFailedReviews(round)]).toEqual([
			'REVISE_BESIDE_FAILED_REVIEWS',
			`"Successful Workflow E2E Verification" (${SUCCESS})`
		]);
	});

	// ⭑ THE PARITY THE RULING ASKS FOR: a REJECTED part beside the same parts folds the round REJECTED and is answered by revision, its
	// finding sent back. Green at 769394ba and after.
	it('⭑ CONTROL — a REJECTED part beside a part with no concluded review (MISSING, and each state no completion concludes in): the fold REJECTED, REFINE_SUBJECT, its finding — the parity the ruling asks for, before package L14 and after', () => {
		for (const state of ['MISSING', ...NOT_CONCLUDED]) {
			const round = roundOf([part(SUCCESS, state), part(FAILURE, 'REJECTED', [LEAF_FAULT])]);
			expect(foldOf(round), `arrangement: the fold beside a part recorded ${state}`).toBe('REJECTED');
			expect(classifyFloorRemediation(round), `beside a part recorded ${state}`).toEqual({
				action: 'REFINE_SUBJECT',
				autoRefine: true,
				findings: [{ ...LEAF_FAULT, typeId: FAILURE, typeName: NAMES[FAILURE] }],
				guidance: REFINE_GUIDANCE
			});
			expect(floorBlockedHint(round), `beside a part recorded ${state}: the page`).toBe('REVISE');
		}
	});

	// ⭑ L13'S OLD PROMISE, KEPT WHERE IT STILL HOLDS (the lead's decision (b)): a part that could not tell — nothing observed, or a code no
	// check declares — beside a part with no concluded review is answered as today, word for word, nothing sent back; and beside a failed
	// part as well, by the execution failure's branch, as today. Green at 769394ba and after.
	it('⭑ CONTROL — a part that could not tell beside a part with no concluded review, alone and beside a failed part: answered as today, word for word, nothing sent back — the incomplete review’s answer and the page’s NOT_BY_REVISION, or the execution failure’s', () => {
		const couldNotTell: readonly (readonly [string, readonly Obs[]])[] = [
			['nothing observed', []],
			['a code no check declares, as the waiver e2e stages it', [UNDECLARED]],
			['a code no check declares, the policy’s own form', [UNLISTED]]
		];
		for (const [label, observations] of couldNotTell) {
			for (const state of ['MISSING', ...NOT_CONCLUDED]) {
				const round = roundOf([part(SUCCESS, state), part(DESIGN, 'INCONCLUSIVE', observations)]);
				expect(foldOf(round), `arrangement: ${label}, beside a part recorded ${state}: the fold`).toBe('UNASSESSED');
				expect(classifyFloorRemediation(round), `${label}, beside a part recorded ${state}`).toEqual(INCOMPLETE);
				expect(floorBlockedHint(round), `${label}, beside a part recorded ${state}: the page`).toBe('NOT_BY_REVISION');
			}
			const besideFailed = roundOf([
				part(SUCCESS, 'INCONCLUSIVE', [EXECUTION_FAILED], false),
				part(FAILURE, 'MISSING'),
				part(DESIGN, 'INCONCLUSIVE', observations)
			]);
			expect(classifyFloorRemediation(besideFailed), `${label}, beside a failed part and a part with no review`).toEqual({
				action: 'RETRY_OR_CONFIGURE_REVIEWER',
				autoRefine: false,
				findings: [],
				guidance: EXECUTION_FAILED_GUIDANCE
			});
			expect(floorBlockedHint(besideFailed), `${label}, beside a failed part and a part with no review: the page`).toBe('NOT_BY_REVISION');
		}
	});
});

describe('⭑ L13 — D68, the record: how a review comes to be held INCONCLUSIVE for a failed check, and the checks it is judged by', () => {
	// ⭐ THE SIXTH RUN'S MECHANISM, BY THE PACKAGE'S OWN COMPOSITION: a reply recommending SATISFIED with one check failed — the
	// reviewer's own severity ADVISORY — is boundary-rejected and recorded INCONCLUSIVE, the failed check at the policy's BLOCKING.
	// ⛔ PREDICTED RED at its last assertion: the classifier sends that record nothing back today.
	it('⭐ RED — a reply recommending SATISFIED over a failed check is recorded INCONCLUSIVE with the check beside it, and that unit’s review is answered as a rejected one', () => {
		const plan = recorded(failing('SATISFIED', 'ADVISORY'));
		expect(plan.assessments.map((a) => [a.disposition, a.observations.map((o) => [o.code, o.severity])]), 'arrangement: the record').toEqual([
			['INCONCLUSIVE', [[DESIGN_FAULT.code, 'BLOCKING']]]
		]);
		const remediation = classifyFloorRemediation(viewOf(plan));
		expect([remediation.action, remediation.autoRefine, remediation.findings.map((f) => [f.code, f.statement])]).toEqual([
			'REFINE_SUBJECT',
			true,
			[[DESIGN_FAULT.code, DESIGN_FAULT.statement]]
		]);
	});

	// ⭑ D68's reading of the sponsor's words — a reviewer that itself returned INCONCLUSIVE and failed a declared check is answered the
	// same way — holds by the REJECTED arm: the composition records such a reply REJECTED (its failed check, at the policy's BLOCKING,
	// rejects it), so it was answered so before D68 too. Green at 230574f3 and after.
	it('⭑ CONTROL — a reply recommending INCONCLUSIVE with a failed declared check is recorded REJECTED, and answered as a rejected one, before D68 and after', () => {
		const plan = recorded(failing('INCONCLUSIVE', 'BLOCKING'));
		expect(plan.assessments.map((a) => a.disposition), 'arrangement: the record').toEqual(['REJECTED']);
		expect(classifyFloorRemediation(viewOf(plan)).action).toBe('REFINE_SUBJECT');
	});

	// ⭑ (a)'s premise: the checks the classifier counts as declared are the ones the stored policy declares — the policy is locked, and
	// its criteria are this constant's, in order. Green at 230574f3 and after.
	it('⭑ the checks the review declares are the stored policy’s, id for id: the reference seed’s floor.reasoning-review', () => {
		resetEngine('reference');
		expect(reasoningReviewCriteria(getEngine().as(SESSION_CREDENTIAL)).map((c) => c.id)).toEqual(REASONING_REVIEW_CRITERIA.map((c) => c.id));
	});
});

// ── The record, made by the package's own composition ─────────────────────────────────────────────────────────────────────────
const SUBJECT: AssuranceSubject = {
	subjectId: 'art_01ARZ3NDEKTSV4RRFFQ69G5W91',
	objectType: 'ARTIFACT',
	semanticVersion: 1,
	isAiProduced: true,
	producer: { actorType: 'AGENT', agentId: 'executor', modelId: 'executor-model', providerId: 'executor-provider' }
};
const EVALUATOR = { actorType: 'AGENT' as const, agentId: 'reviewer', modelId: 'reviewer-model', providerId: 'reviewer-provider' };
/** A reply answering every seeded check unfailed, recommending `recommendation`. */
const clean = (recommendation: ReasoningReviewJudgement['recommendation']): ReasoningReviewJudgement => ({
	findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c) => ({ criterionId: c.id, failed: false, statement: 'evaluated; the failure class is absent' })),
	recommendation
});
/** A reply failing the design's check, `RR-07`, at the reviewer's own `severity`, the rest unfailed, recommending `recommendation`. */
const failing = (recommendation: ReasoningReviewJudgement['recommendation'], severity: 'ADVISORY' | 'BLOCKING'): ReasoningReviewJudgement => ({
	findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c) =>
		c.id === DESIGN_FAULT.code
			? { criterionId: c.id, failed: true, statement: DESIGN_FAULT.statement, severity }
			: { criterionId: c.id, failed: false, statement: 'evaluated; the failure class is absent' }
	),
	recommendation
});
/** The reasoning review's recording plan for `judgement`, as `runFloorPolicies` plans and the recorder composes it. */
function recorded(judgement: ReasoningReviewJudgement, opts: { readonly stale?: boolean } = {}) {
	const result = reasoningReviewResultFromJudgement(SUBJECT, EVALUATOR, 'fixture.reasoning-review', judgement, SEEDED_REASONING_REVIEW_CRITERIA);
	const plan = deMinimisFloorPlan(SUBJECT).filter((p) => p.policyId === REVIEW);
	return assuranceRecordingPlan(SUBJECT, plan, [opts.stale ? { ...result, subjectSemanticVersion: SUBJECT.semanticVersion + 1 } : result]);
}
/** The view the execution plane hands the classifier for `plan` (`floor-over-subject.ts`), beside two deterministic policies that passed. */
const viewOf = (plan: ReturnType<typeof recorded>): FloorView =>
	({
		subjectId: SUBJECT.subjectId,
		satisfied: plan.gatePermitsTransition,
		waived: false,
		policies: [
			{ policyId: 'floor.schema-invariant', disposition: 'SATISFIED', independenceOk: true, observations: [] },
			{ policyId: 'floor.identity-provenance', disposition: 'SATISFIED', independenceOk: true, observations: [] },
			...plan.assessments.map((a) => ({
				policyId: a.policyId,
				disposition: a.disposition,
				independenceOk: a.independenceOk,
				observations: a.observations
			}))
		]
	}) as unknown as FloorView;
