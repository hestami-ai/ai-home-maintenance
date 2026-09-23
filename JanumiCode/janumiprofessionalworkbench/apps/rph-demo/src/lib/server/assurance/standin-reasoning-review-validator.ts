// ⭐⭐ THE DECLARED STAND-IN REVIEWER — test mode only (`JAN-CRITREAD` J1-2; `DESIGN-what-the-tests-prove.md` §4.1;
// `REG-D-071`).
//
// The browser tests exist to prove the product HANDLES a reviewer's verdict; whether a reviewer can EARN one is
// measured separately, by qualification. So in test mode the reasoning review is answered by a stand-in that says
// exactly what it is: the structural checker's REAL judgements, plus a CLEAN answer the TEST itself stipulates for
// the criteria the checker cannot judge — each recorded `UNABLE_TO_DETERMINE`, with `stipulated: 'MET'` beside it.
// Outside an engine built to admit stipulations those rows fail closed, exactly as they would for anyone.
//
// ── THE SIX RULES (§4.1), EACH ONE A TEST IN `standin-reasoning-review-validator.test.ts` ──────────────────────
// 1. The checker runs first, unchanged, and its answers are recorded as its own.
// 2. A stipulation completes a subject the checker READ; it never replaces a read. If the checker judged nothing —
//    its `unreadable()` branch — nothing is stipulated and the review stays INCONCLUSIVE.
// 3. With a registration for this subject and arm, every criterion of the policy in force that the checker did NOT
//    judge is stipulated clean.
// 4. Without one, nothing else is answered: the remainder arrives `UNABLE_TO_DETERMINE` and the review is
//    INCONCLUSIVE — fail-closed, not a throw (a throw is VALIDATOR_FAILED, which stages BLOCKED_EXTERNAL).
// 5. Only CLEAN, and only the remainder — DERIVED from the policy's list minus what the checker judged, so the
//    stand-in can neither answer a checker-judged criterion nor hand-list one.
// 6. The recommendation is DERIVED, never copied: SATISFIED only when the checker found nothing AND the whole
//    remainder is stipulated; the checker's own when it found a fault; INCONCLUSIVE otherwise.
//
// ⚠ INDEPENDENCE HERE IS A LABEL (`REG-D-071` Q2 (e)). The stand-in names no model, and one test author writes both
// the producer's plan and the stipulation. That is accepted only because a stipulation counts for nothing outside
// an engine built for tests.
import {
	FLOOR_POLICY_IDS,
	reasoningReviewResultFromJudgement,
	type AssuranceSubject,
	type Identity,
	type ReasoningReviewFinding,
	type ReasoningReviewJudgement,
	type Validator
} from '@janumipwb/rph-assurance';
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import { judgeStructurally } from './mock-reasoning-review-validator.js';
import type { StipulableFraming } from '../stipulations.js';

export const STANDIN_VALIDATOR_ID = 'standin.reasoning-review';

/** Distinct from the mock, from `agy`, and — by `modelId` — from both default-lane producers. */
const EVALUATOR: Identity = {
	actorType: 'AGENT',
	agentId: 'standin-reviewer',
	modelId: 'standin',
	providerId: 'jpwb-test'
};

/** The host's answer to "did the test register a stipulation for this subject, on this arm?" — never a throw. */
export type StipulationLookup = (subject: AssuranceSubject, framing: StipulableFraming) => 'CLEAN' | undefined;

/**
 * Rules 2–6 over the checker's judgement. Pure, so each rule is testable without a floor.
 */
export function standinJudgement(
	checker: ReasoningReviewJudgement,
	policyCriteria: readonly Pick<AssessmentCriterion, 'id'>[],
	registered: 'CLEAN' | undefined
): ReasoningReviewJudgement {
	// Rule 2 — a subject the checker could not read is not completed by anyone.
	if (checker.findings.length === 0) return checker;
	const judged = new Set(checker.findings.map((f) => f.criterionId));
	// Rule 5 — the remainder is DERIVED: the policy's own list, minus what the checker judged.
	const remainder = policyCriteria.map((c) => c.id).filter((id) => !judged.has(id));
	const stipulated: ReasoningReviewFinding[] =
		registered === 'CLEAN'
			? remainder.map((criterionId) => ({
					criterionId,
					failed: false,
					statement: 'Stipulated CLEAN by the test (REG-D-071): not reviewed by anyone.',
					stipulated: true as const
				}))
			: [];
	const faulted = checker.findings.some((f) => f.failed);
	// Rule 6 — derived, never copied from the checker's constant.
	const recommendation: ReasoningReviewJudgement['recommendation'] = faulted
		? checker.recommendation
		: stipulated.length === remainder.length
			? 'SATISFIED'
			: 'INCONCLUSIVE';
	const disclosure =
		stipulated.length > 0
			? `Declared stand-in (test mode): ${judged.size} criteria evaluated by the structural checker; ${stipulated.length} stipulated CLEAN by the test and NOT reviewed (REG-D-071).`
			: `Declared stand-in (test mode): ${judged.size} criteria evaluated by the structural checker; the other ${remainder.length} were not evaluated, and no stipulation was registered for this subject.`;
	return {
		...checker,
		findings: [...checker.findings, ...stipulated],
		recommendation,
		limitations: [...(checker.limitations ?? []), disclosure]
	};
}

export function createStandinReasoningReviewValidator(opts: { stipulationFor: StipulationLookup }): Validator {
	return {
		policyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
		validatorId: STANDIN_VALIDATOR_ID,
		evaluate: (subject, ctx) => {
			const input = ctx.reasoningReview;
			if (!input) throw new Error('reasoning-review context is missing');
			// Rule 1 — the checker's own judgement, unchanged.
			const checker = judgeStructurally(input);
			const registered =
				input.framing === 'PROCESS_RESULT' ? undefined : opts.stipulationFor(subject, input.framing);
			return Promise.resolve(
				reasoningReviewResultFromJudgement(
					subject,
					EVALUATOR,
					STANDIN_VALIDATOR_ID,
					standinJudgement(checker, input.criteria, registered),
					input.criteria
				)
			);
		}
	};
}
