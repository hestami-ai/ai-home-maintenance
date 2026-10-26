import { describe, expect, it } from 'vitest';
import type { Identity } from './assurance-rules.js';
import { FLOOR_POLICY_IDS, type AssuranceSubject } from './floor.js';
import {
	createValidatorRegistry,
	identityProvenanceValidatorInstance,
	reasoningReviewResultFromJudgement,
	runDeMinimisFloor,
	runFloorPolicies,
	schemaInvariantValidatorInstance,
	VALIDATOR_ALLOWANCE_STOPPED,
	VALIDATOR_FAILURE_CODES,
	VALIDATOR_MODEL_SUBSTITUTED,
	validatorFailureError,
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
 * exactly what a live reviewer does: `REG-F-412` measured nine rows in four of four reviews; seven stored, all nine (`REG-F-439`).
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

	// ⭐ The review in parts, B3 (`REG-D-125`; design D1, D5) — the authoring floor runs a PWA's deterministic policies once
	// over the PWA and its Reasoning Review once over each type, so it asks for the policies it means and composes each.
	it('⭐ runFloorPolicies runs the named policies of the subject’s plan, and no other', async () => {
		let reviewed = 0;
		const counting: Validator = {
			...mockReasoningReview(CLEAN),
			evaluate: (s, c) => {
				reviewed += 1;
				return mockReasoningReview(CLEAN).evaluate(s, c);
			}
		};
		const deterministic = await runFloorPolicies(subject, goodCtx, registry(counting), [
			FLOOR_POLICY_IDS.SCHEMA_INVARIANT,
			FLOOR_POLICY_IDS.IDENTITY_PROVENANCE
		]);
		expect(deterministic.plan.map((p) => p.policyId)).toEqual([
			FLOOR_POLICY_IDS.SCHEMA_INVARIANT,
			FLOOR_POLICY_IDS.IDENTITY_PROVENANCE
		]);
		expect(deterministic.results.map((r) => r.policyId)).toEqual(deterministic.plan.map((p) => p.policyId));
		expect(reviewed, 'the reasoning review was not run for the deterministic plan').toBe(0);
		const review = await runFloorPolicies(subject, goodCtx, registry(counting), [FLOOR_POLICY_IDS.REASONING_REVIEW]);
		expect(review.plan.map((p) => `${p.policyId}:${p.independence}`)).toEqual([
			'floor.reasoning-review:DIFFERENT_MODEL'
		]);
		expect(review.results.map((r) => r.policyId)).toEqual([FLOOR_POLICY_IDS.REASONING_REVIEW]);
		expect(reviewed).toBe(1);
		// ⚠ A policy the subject's own plan does not hold is not run: a subject no AI produced has no Reasoning Review.
		const nonAi = await runFloorPolicies({ ...subject, isAiProduced: false }, goodCtx, registry(counting), [
			FLOOR_POLICY_IDS.REASONING_REVIEW
		]);
		expect([nonAi.plan, nonAi.results, reviewed]).toEqual([[], [], 1]);
	});
});

// ── ⭐ `JAN-SELRES` D6 (`REG-F-460`) — A THROWN FAILURE MAY CARRY ITS OWN CODE, RECORDED BESIDE THE FAILURE ─────────
//
// ⛔ WHAT WAS WRONG. The runner read a throw's `.message` and nothing else, so a review REFUSED because the reviewing
// tool reported another model than the one selected was one `VALIDATOR_EXECUTION_FAILED` like any other — and the
// app's classifier, which reads codes and never prose, told the operator to retry the reviewer.
//
// ⭑ ONE CASE PER LIMB, EACH WITH EXACT `toEqual` OBSERVATIONS — never "contains": a limb that ADDED an observation
// would pass a containment check. The Reasoning-Review Validator is ALONE in its registry, so the floor's observations
// are exactly the failed result's: the two deterministic policies are MISSING, and a missing policy records none.
describe('⭐ D6 — a throw records VALIDATOR_EXECUTION_FAILED first, then a carried in-set failure, and nothing else', () => {
	/** The floor's observations when the Reasoning-Review Validator rejects with `thrown`. */
	async function observationsOfThrowing(thrown: unknown) {
		const reg = createValidatorRegistry();
		reg.register({
			policyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
			validatorId: 'throws',
			evaluate: () => Promise.reject(thrown)
		});
		return (await runDeMinimisFloor(subject, goodCtx, reg)).observations;
	}
	/** The observation every throw has always recorded — the thrown message as its statement. */
	const executionFailed = (statement: string) => ({
		code: 'VALIDATOR_EXECUTION_FAILED',
		severity: 'MATERIAL',
		statement,
		open: true
	});

	it('⭑ a CAUSELESS throw is recorded exactly as it always was: one VALIDATOR_EXECUTION_FAILED, its message the statement', async () => {
		// ⛔ THE MUTANT: record something for a throw that carries nothing. The reviewer fingerprint scores throws
		// (`scripts/reviewer-qual/runner.ts` `scoreThrow`) and every refused selection throws one of these, so a causeless
		// throw must stay byte for byte what it was — this pins it, and held before `D6` was built.
		expect(await observationsOfThrowing(new Error('agy unavailable'))).toEqual([
			executionFailed('agy unavailable')
		]);
	});

	it('⭐ an IN-SET failure adds exactly one observation, SECOND — its code and statement, MATERIAL and open', async () => {
		// ⭑ THE CLOSED SET, PINNED: ~~one member~~ ⭐ two members (`JAN-EXEC` Phase 7, package L2's check, finding 2 — the
		// authoring review's allowance stopping a review, `VALIDATOR_ALLOWANCE_STOPPED`), by value. MOVED DELIBERATELY.
		expect(VALIDATOR_FAILURE_CODES).toEqual(['VALIDATOR_MODEL_SUBSTITUTED', 'VALIDATOR_ALLOWANCE_STOPPED']);
		const recorded = [
			executionFailed('the review was refused'),
			{
				code: 'VALIDATOR_MODEL_SUBSTITUTED',
				severity: 'MATERIAL',
				statement:
					"The reviewing tool 'devin' reported that 'm2' answered, not the configured 'm1'.",
				open: true
			}
		];
		// ⭑ BUILT BY THE HELPER THE APP THROWS WITH …
		expect(
			await observationsOfThrowing(
				validatorFailureError('the review was refused', {
					code: VALIDATOR_MODEL_SUBSTITUTED,
					statement:
						"The reviewing tool 'devin' reported that 'm2' answered, not the configured 'm1'."
				})
			),
			'the carried failure was not recorded second, beside the execution failure'
		).toEqual(recorded);
		// ⭑ … AND BY HAND, WITH NO HELPER AND NO CLASS: the runner reads the PROPERTY, so a carrier from another copy of
		// this package (`src` beside `dist`) is read the same.
		expect(
			await observationsOfThrowing(
				Object.assign(new Error('the review was refused'), {
					validatorFailure: {
						code: 'VALIDATOR_MODEL_SUBSTITUTED',
						statement:
							"The reviewing tool 'devin' reported that 'm2' answered, not the configured 'm1'."
					}
				})
			),
			'a duck-typed carrier was not read'
		).toEqual(recorded);
	});

	// ⭐⭐ `JAN-EXEC` Phase 7, package L2's check, finding 2 (`REG-F-580`; design D20) — A REVIEW THE HOST'S ALLOWANCE STOPPED HAS
	// A CODE OF ITS OWN. ⛔ Recorded as a causeless throw, the stop read as a reviewer that did not execute, and the app's
	// classifier answered it "Configure or retry the reviewer" — a remedy that cannot clear it: no reviewer ran, and a stopped
	// round reserves nothing, so a retry is stopped again. ⛔ PREDICTED RED, read from the code at de18c9e0: no such member.
	it('⭐ the allowance’s stop is an IN-SET failure too: recorded SECOND, beside the execution failure, MATERIAL and open', async () => {
		expect(VALIDATOR_ALLOWANCE_STOPPED).toBe('VALIDATOR_ALLOWANCE_STOPPED');
		expect(
			await observationsOfThrowing(
				validatorFailureError('No reviewer call was made for this type.', {
					code: VALIDATOR_ALLOWANCE_STOPPED,
					statement: 'The host’s allowance stopped this review before any reviewer call.'
				})
			),
			'the allowance’s stop was not recorded second, beside the execution failure'
		).toEqual([
			executionFailed('No reviewer call was made for this type.'),
			{
				code: 'VALIDATOR_ALLOWANCE_STOPPED',
				severity: 'MATERIAL',
				statement: 'The host’s allowance stopped this review before any reviewer call.',
				open: true
			}
		]);
	});

	it('⛔ a code OUTSIDE the closed set adds nothing — a throw does not extend this package’s vocabulary', async () => {
		// ⭑ NEAR MISSES, not only a far-away code: a reader that folded case or whitespace, or matched a prefix or a
		// suffix, would record the spelling it was handed VERBATIM — a new code no classifier matches.
		const outOfSet = [
			'SOME_OTHER_CODE',
			'validator_model_substituted',
			' VALIDATOR_MODEL_SUBSTITUTED ',
			'VALIDATOR_MODEL_SUBSTITUTED_X',
			'MODEL_SUBSTITUTED'
		];
		for (const code of outOfSet)
			expect(
				await observationsOfThrowing(
					Object.assign(new Error('refused for another reason'), {
						validatorFailure: {
							code,
							statement: 'a statement under an unknown code'
						}
					})
				),
				`the out-of-set code ${JSON.stringify(code)} was recorded`
			).toEqual([executionFailed('refused for another reason')]);
	});

	it('⛔ a NON-Error throw adds nothing, whatever it carries — its statement is still String(thrown)', async () => {
		const thrown = {
			message: 'not an Error',
			validatorFailure: {
				code: VALIDATOR_MODEL_SUBSTITUTED,
				statement: 'carried by a plain object'
			}
		};
		expect(await observationsOfThrowing(thrown)).toEqual([executionFailed(String(thrown))]);
	});

	it('⛔ a MALFORMED carrier adds nothing: not an object, no code, no statement, a statement that says nothing, or a read that throws', async () => {
		/** An Error carrying `validatorFailure`, as a Validator throws one. */
		const carrying = (validatorFailure: unknown): Error =>
			Object.assign(new Error('refused'), { validatorFailure });
		// ⛔ A READ THAT THROWS. The runner reads the carrier INSIDE its own catch, so a getter or a Proxy trap that throws
		// there must not make the floor run reject: a Validator that throws yields a failed result, whatever it throws.
		const throwingGetter = Object.defineProperty(new Error('refused'), 'validatorFailure', {
			get(): never {
				throw new Error('BOOM from the validatorFailure getter');
			}
		});
		const throwingTrap = new Proxy(new Error('refused'), {
			get(target, key, receiver): unknown {
				if (key === 'validatorFailure') throw new Error('BOOM from a proxy trap');
				return Reflect.get(target, key, receiver);
			}
		});
		const throwingStatement = carrying({
			code: VALIDATOR_MODEL_SUBSTITUTED,
			get statement(): never {
				throw new Error('BOOM from the statement getter');
			}
		});
		const malformed: readonly (readonly [string, Error])[] = [
			['null', carrying(null)],
			['a string', carrying(VALIDATOR_MODEL_SUBSTITUTED)],
			['no code', carrying({ statement: 'a statement with no code' })],
			['no statement', carrying({ code: VALIDATOR_MODEL_SUBSTITUTED })],
			[
				'a statement that is not a string',
				carrying({ code: VALIDATOR_MODEL_SUBSTITUTED, statement: 42 })
			],
			['a blank statement', carrying({ code: VALIDATOR_MODEL_SUBSTITUTED, statement: '   ' })],
			['behind a getter that throws', throwingGetter],
			['behind a Proxy trap that throws', throwingTrap],
			['an object whose statement getter throws', throwingStatement]
		];
		for (const [name, thrown] of malformed)
			expect(
				await observationsOfThrowing(thrown),
				`a carrier that is ${name} was recorded`
			).toEqual([executionFailed('refused')]);
	});
});
