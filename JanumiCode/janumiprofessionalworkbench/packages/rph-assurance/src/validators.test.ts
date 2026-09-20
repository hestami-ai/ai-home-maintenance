import { describe, expect, it } from 'vitest';
import type { Identity } from './assurance-rules.js';
import { FLOOR_POLICY_IDS, type AssuranceSubject } from './floor.js';
import {
	createValidatorRegistry,
	identityProvenanceValidatorInstance,
	reasoningReviewResultFromJudgement,
	runDeMinimisFloor,
	schemaInvariantValidatorInstance,
	type ReasoningReviewJudgement,
	type Validator,
	type ValidatorContext
} from './validators.js';
import { SEEDED_REASONING_REVIEW_CRITERIA } from './floor-policies.js';

const CODEX: Identity = {
	actorType: 'AGENT',
	agentId: 'executor',
	modelId: 'gpt-5.4-mini',
	providerId: 'openai'
};
const GEMINI: Identity = {
	actorType: 'AGENT',
	agentId: 'judge',
	modelId: 'gemini',
	providerId: 'google'
};

const subject: AssuranceSubject = {
	subjectId: 'pwa_1',
	objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
	semanticVersion: 1,
	isAiProduced: true,
	producer: CODEX
};

const goodCtx: ValidatorContext = {
	schemaInvariant: { schemaValid: true, invariantViolations: [] },
	identityProvenance: {
		hasStableId: true,
		hasSemanticVersion: true,
		hasProvenance: true,
		hasProducer: true,
		traceComplete: true
	}
};

/** A mock Reasoning-Review Validator driven by a fixed judgement (stands in for the agy backend in unit tests). */
function mockReasoningReview(j: ReasoningReviewJudgement, evaluator: Identity = GEMINI): Validator {
	return {
		policyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
		validatorId: 'mock.reasoning-review',
		evaluate: (s) =>
			Promise.resolve(
				reasoningReviewResultFromJudgement(
					s,
					evaluator,
					'mock.reasoning-review',
					j,
					SEEDED_REASONING_REVIEW_CRITERIA
				)
			)
	};
}
/**
 * ⭐⭐ `JAN-ORPHANED` `OR-02` — WHAT A REVIEWER THAT EVALUATED EVERYTHING AND FAULTED NOTHING ACTUALLY
 * RETURNS: one `failed: false` row per criterion.
 *
 * ⛔ THIS FIXTURE USED TO BE `findings: []`, AND THAT MEANT THE OPPOSITE OF WHAT IT MEANS NOW. It was
 * authored 2026-07-14 under the contract where an unmentioned criterion read as `MET` — so an empty list
 * said *“evaluated everything, found nothing”*. `R26` (2026-09-20) ruled that absence means the reviewer
 * did not judge it, and re-meant every such literal without touching one: the `R26` commit changed seven
 * files and no fixture among them.
 *
 * ⭑ THE INTENT WAS ALWAYS THIS — IT IS WRITTEN IN THE FIXTURE'S OWN DOCSTRING (*“all 9 criteria MET”*).
 * What changed is only that a clean verdict must now be SAID rather than inferred from silence, which is
 * exactly what a live reviewer does: `REG-F-412` measured nine rows in five of five reviews.
 *
 * ⚠ DERIVED, NEVER HAND-LISTED. Nine written-out ids would stop covering a tenth criterion silently — the
 * hand-listing defect one level up. (The criterion list itself is pinned by id AND count in
 * `pwa-export.test.ts`, so this cannot mask a new one.)
 */
const allClean = () =>
	SEEDED_REASONING_REVIEW_CRITERIA.map((c) => ({
		criterionId: c.id,
		failed: false,
		statement: 'evaluated; the failure class is absent'
	}));
const CLEAN: ReasoningReviewJudgement = { findings: allClean(), recommendation: 'SATISFIED' };

describe('reasoningReviewResultFromJudgement — judgement → schema-conformant ValidatorResult', () => {
	// ⭐ RENAMED AND RE-ASSERTED FOR `R26`. This read *“MET iff absent”* — the contract that made a
	// criterion the reviewer never mentioned read as PASSED. Absence now means the reviewer did not judge
	// it, which is what `UNABLE_TO_DETERMINE` is for; a clean verdict must be SAID (`failed: false`).
	it('maps each judged failure class to a criterion; UNJUDGED classes are UNABLE_TO_DETERMINE', () => {
		const r = reasoningReviewResultFromJudgement(
			subject,
			GEMINI,
			'v1',
			{
				findings: [
					{
						criterionId: 'RR-05-no-premature-convergence',
						failed: true,
						statement: 'stopped after one pass',
						severity: 'BLOCKING'
					}
				],
				recommendation: 'REJECTED'
			},
			SEEDED_REASONING_REVIEW_CRITERIA
		);
		expect(r.criteria).toHaveLength(9); // all nine failure classes become criteria
		expect(
			r.criteria.find((c) => c.criterionId === 'RR-05-no-premature-convergence')?.outcome
		).toBe('NOT_MET');
		// ⛔ THE JUDGEMENT SAID NOTHING ABOUT `RR-01`, SO THE RECORD SAYS NOTHING ABOUT IT EITHER. Before `R26`
		// this asserted `MET` — a pass the reviewer never gave.
		expect(r.criteria.find((c) => c.criterionId === 'RR-01-no-problem-substitution')?.outcome).toBe(
			'UNABLE_TO_DETERMINE'
		);
		// ⭑ AND A CLEAN VERDICT STILL READS AS ONE when the reviewer actually gives it.
		const said = reasoningReviewResultFromJudgement(
			subject,
			GEMINI,
			'v1',
			{
				findings: [
					{ criterionId: 'RR-01-no-problem-substitution', failed: false, statement: 'clean' }
				],
				recommendation: 'SATISFIED'
			},
			SEEDED_REASONING_REVIEW_CRITERIA
		);
		expect(said.criteria.find((c) => c.criterionId === 'RR-01-no-problem-substitution')?.outcome).toBe(
			'MET'
		);
		expect(r.observations).toHaveLength(1);
		expect(r.dispositionRecommendation).toBe('REJECTED');
		expect(r.evaluator.modelId).toBe('gemini');
	});
});

describe('validator registry + runDeMinimisFloor', () => {
	function registry(rr?: Validator) {
		const reg = createValidatorRegistry();
		reg.register(schemaInvariantValidatorInstance);
		reg.register(identityProvenanceValidatorInstance);
		if (rr) reg.register(rr);
		return reg;
	}

	it('all floor validators present + clean → aggregate SATISFIED, gate OPEN', async () => {
		const out = await runDeMinimisFloor(subject, goodCtx, registry(mockReasoningReview(CLEAN)));
		expect(out.aggregate).toBe('SATISFIED');
		expect(out.gatePermitsTransition).toBe(true);
	});

	// ── ⭐⭐ `JAN-ORPHANED` `OR-01` — A SILENT REVIEWER CLOSES THE GATE, PROVEN AT THE COMPOSITION LEVEL ──────
	//
	// ⛔ THIS TEST IS WRITTEN **BEFORE** THE FIXTURES ARE CORRECTED, AND THAT ORDER IS THE WHOLE POINT. Until
	// `JAN-ORPHANED`, the arrangement above (`CLEAN` = `findings: []`) WAS this signal — inverted. It failed,
	// and its failure was the only thing in the suite demonstrating that a reviewer which judged nothing cannot
	// compose to SATISFIED. Correcting the fixture first would have removed that demonstration silently, and
	// nothing would have gone red to say so.
	//
	// ⚠ THE GAP IT FILLS IS DERIVED, NOT GUESSED. `reviewer-silence-is-not-a-pass.test.ts` asserts
	// `dispositionFromFindings` DIRECTLY — it never calls a floor runner. Grepping the filesystem for call
	// sites of `runDeMinimisFloor` / `runFloorAndPlanRecording` returns only the tests being corrected plus one
	// failure-path test. So after the correction, no test anywhere would drive SILENCE through the real
	// composition. This one does.
	//
	// ⭑ IT ASSERTS THE GATE AS WELL AS THE AGGREGATE. An INCONCLUSIVE aggregate that still opened the gate is
	// the harm `REG-F-409` is about; asserting only the aggregate would leave the harm untested.
	it('⭐ a reviewer that judged NOTHING blocks the floor: aggregate INCONCLUSIVE, gate CLOSED', async () => {
		// THE MUTANT: revert `R26` — map an unmentioned criterion back to `MET`. Every criterion then reads
		// PASSED on the word of a reviewer that said nothing, the aggregate goes SATISFIED, and the gate opens.
		const silent: ReasoningReviewJudgement = { findings: [], recommendation: 'SATISFIED' };
		const out = await runDeMinimisFloor(subject, goodCtx, registry(mockReasoningReview(silent)));
		expect(out.aggregate, 'a reviewer that judged nothing composed to a verdict').toBe('INCONCLUSIVE');
		expect(out.gatePermitsTransition, 'silence opened the publish gate').toBe(false);
	});

	it('an AI subject with NO Reasoning-Review validator registered is UNASSESSED and blocked', async () => {
		const out = await runDeMinimisFloor(subject, goodCtx, registry());
		expect(out.aggregate).toBe('UNASSESSED');
		expect(out.gatePermitsTransition).toBe(false);
	});

	it('a Reasoning-Review validator that THROWS yields VALIDATOR_FAILED (blocks, never REJECTED)', async () => {
		const throwing: Validator = {
			policyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
			validatorId: 'boom',
			evaluate: () => Promise.reject(new Error('agy unavailable'))
		};
		const out = await runDeMinimisFloor(subject, goodCtx, registry(throwing));
		const rr = out.perPolicy.find((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW)!;
		expect(rr.disposition).toBe('VALIDATOR_FAILED');
		expect(out.gatePermitsTransition).toBe(false);
	});

	it('a Reasoning-Review finding a failure class blocks the gate', async () => {
		const bad = mockReasoningReview({
			findings: [
				{
					criterionId: 'RR-04-no-proxy-satisfaction',
					failed: true,
					statement: 'surface repair',
					severity: 'BLOCKING'
				}
			],
			recommendation: 'REJECTED'
		});
		const out = await runDeMinimisFloor(subject, goodCtx, registry(bad));
		expect(out.aggregate).toBe('REJECTED');
		expect(out.gatePermitsTransition).toBe(false);
	});

	it('missing deterministic facts in context fail the floor closed (schema facts unavailable → blocked)', async () => {
		const out = await runDeMinimisFloor(
			subject,
			{ reasoningReview: undefined },
			registry(mockReasoningReview(CLEAN))
		);
		expect(out.gatePermitsTransition).toBe(false);
	});

	it('a non-AI subject does not require Reasoning Review to pass', async () => {
		const nonAi: AssuranceSubject = { ...subject, isAiProduced: false };
		const out = await runDeMinimisFloor(nonAi, goodCtx, registry());
		expect(out.aggregate).toBe('SATISFIED');
		expect(out.gatePermitsTransition).toBe(true);
	});
});
