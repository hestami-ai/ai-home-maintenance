// ⭐⭐ `JAN-EXEC` Phase 7 completion E2 — THE DECLARED-POLICY REVIEW SEAM (`REG-F-523`; `REG-D-110` (3), the sponsor's *"One
// per policy"*; `DESIGN-phase-7-completion.md` B1).
//
// ── ⛔ WHAT THIS REPLACES ────────────────────────────────────────────────────────────────────────────────────────────────
// A work unit's declared assurance policies were signed off with no criterion checked: each verdict was computed from the
// policy's required-evidence list alone, the same for every unit of every Undertaking, and issued on the operator's own
// click (`REG-F-523`). `R25` owes *"a competent reviewer was asked"*; nobody was.
//
// ── ⭐ WHAT IT IS ───────────────────────────────────────────────────────────────────────────────────────────────────────
// One review per (unit, declared policy) pair. The reviewer is asked the policy's OWN criteria — its purpose framing the
// review (`DECLARED_POLICY`, `reasoning-review-validator.ts` `declaredPolicyLine`) — over the unit's work product and the
// commands it ran (`R18`; for a unit composed of others, ~~its children's~~ ⭐ R3-A F1: its whole subtree's: `REG-D-111` (2)'s
// general form), and answers each criterion.
//   · ⭑ THE MACHINERY IS THE VALIDATOR'S OWN: its call, its retry of a call that threw short of its bound, its repairs and
//     its capture of every try (design B1). A second reviewer with its own transport would be a second thing to qualify.
//   · ⛔ SEPARATE FROM THE FLOOR'S `FloorPolicyId`: the validator's result cites `floor.reasoning-review` by its type, and
//     a declared answer is not a floor result. So this seam reads the result's CRITERION ROWS and OBSERVATIONS — the
//     policy's own, rendered and scored from `input.criteria` — and hands back a `DeclaredPolicyAnswer` naming the
//     DECLARED policy; nothing here is ever recorded as a floor assessment, and nothing is registered in the floor's
//     registry.
//   · ⭐ THE VERDICT IS NOT THIS SEAM'S. It hands back what the reviewer ANSWERED; the sign-off computes the verdict from
//     those answers (`declared-policy-signoff.ts`, `dispositionFromFindings`; design B2), so a reviewer's recommendation
//     cannot outvote its own criterion rows.
//   · ⚠ A REVIEW THAT FAILS IS ANSWERED, NOT THROWN: its call failed, or it was refused before any was made — and the sign
//     -off records it INCONCLUSIVE with the failure's statement (PER-9: the record of a review that broke is still owed).
//
// ── ⭐ IN THE GATE LANE ─────────────────────────────────────────────────────────────────────────────────────────────────
// The declared STAND-IN answers (`createStandinDeclaredPolicyReviewer`), as `standin.reasoning-review` answers the floor:
// it has no checker, so where the test registered a `DECLARED_POLICY` stipulation for the unit's PWA it stipulates EVERY
// criterion CLEAN — recorded `UNABLE_TO_DETERMINE` with `stipulated: 'MET'` beside it, never as met — and where none is
// registered it answers nothing, and the verdict is INCONCLUSIVE. `REG-D-071` Q2 (b): a stipulated answer counts only in
// an engine built for tests, and for nothing anywhere else.
import {
	reasoningReviewResultFromJudgement,
	type AssuranceSubject,
	type Disposition,
	type FloorCriterion,
	type FloorObservation,
	type Identity,
	type ReasoningReviewFinding,
	type ReasoningReviewInput,
	type Validator
} from '@janumipwb/rph-assurance';

/** The validator id a model-judged declared review is recorded under — never `agy.reasoning-review`, a FLOOR validator. */
export const DECLARED_REVIEW_VALIDATOR_ID = 'reviewer.declared-policy';
/**
 * ⭐ R3-A F2 (the lead's delegated decision of 2026-10-16, registered as REG-D-114 (12)) — the id a REPLAYED declared review
 * is recorded under: never the live reviewer's, since no reviewer ran — as the floor's replayed review is recorded under
 * `replay.reasoning-review` (`assurance/index.ts`, `REPLAY_REVIEWER_ID`).
 */
export const REPLAY_DECLARED_REVIEW_VALIDATOR_ID = 'replay.declared-policy';
/** The declared stand-in's id (test mode only) — distinct from the floor's `standin.reasoning-review`. */
export const STANDIN_DECLARED_REVIEW_VALIDATOR_ID = 'standin.declared-policy-review';
/** The id a refused reviewer selection is recorded under: nothing reviewed. */
export const UNCONFIGURED_DECLARED_REVIEWER_ID = 'declared-policy-review.unconfigured';

/** What the declared stand-in writes beside each stipulated row, and nothing else: no reviewer read it. */
export const DECLARED_STIPULATION_STATEMENT =
	'Stipulated CLEAN by the test (REG-D-071): the declared stand-in judges nothing, and no reviewer read this criterion.';

/**
 * ONE (unit, declared policy) pair's review, as its reviewer answered it.
 *
 * ⭑ `criteria` HOLDS ONE ROW PER CRITERION OF THE POLICY, in the policy's order — the mapper's three-way reading
 * (`reasoningReviewResultFromJudgement`): `MET` / `NOT_MET` for a row the reviewer answered, `UNABLE_TO_DETERMINE` for one
 * it did not, a stipulation beside the last. `mandatory` is the POLICY's (`severityIfNotMet`), never the reviewer's.
 * ⭑ `observations` are the failed criteria, each open at the POLICY's declared severity (`R25`).
 */
export interface DeclaredPolicyAnswer {
	readonly policyId: string;
	readonly validatorId: string;
	/** Who judged — the reviewer's ACTUAL identity, resolved per run (§8.4), or the stand-in's. */
	readonly evaluator: Identity;
	readonly criteria: readonly FloorCriterion[];
	readonly observations: readonly FloorObservation[];
	/** The reviewer's own recommendation — RECORDED, never the verdict (design B2). */
	readonly recommendation: Disposition;
	readonly residualUncertainty: readonly string[];
	readonly limitations: readonly string[];
	/** Set when the review produced no answer: the validator's own statement of why. No criterion was answered. */
	readonly failure?: string;
}

/** The seam: one review of one (unit, declared policy) pair. Never throws — a failure is an answer that says so. */
export interface DeclaredPolicyReviewer {
	readonly validatorId: string;
	review(subject: AssuranceSubject, input: ReasoningReviewInput): Promise<DeclaredPolicyAnswer>;
}

/** The policy id a `DECLARED_POLICY` input names, or `undefined` — which the reviewer then refuses, sending nothing. */
const policyIdOf = (input: ReasoningReviewInput): string | undefined =>
	input.framing === 'DECLARED_POLICY' ? input.declaredPolicy?.policyId : undefined;

/** A review that produced no answer: no row, no observation, INCONCLUSIVE recommended — and why, in the validator's words. */
function failedAnswer(
	policyId: string,
	validatorId: string,
	evaluator: Identity,
	failure: string
): DeclaredPolicyAnswer {
	return {
		policyId,
		validatorId,
		evaluator,
		criteria: [],
		observations: [],
		recommendation: 'INCONCLUSIVE',
		residualUncertainty: [],
		limitations: [],
		failure
	};
}

/** ⛔ The refusal of an input that is not a declared review: it names no declared policy, so nothing is sent. */
const NOT_A_DECLARED_REVIEW =
	'This review was not sent: its input is not a DECLARED_POLICY review naming its policy, so the declared-policy reviewer could not say what it judges against. No model was called.';

/**
 * ⭐ THE MODEL REVIEWER: the product's reasoning-review validator — built by the caller with its transport, its capture and
 * its retry bound (`assurance/index.ts` `createDeclaredPolicyReviewer`) — run in the `DECLARED_POLICY` framing, its result
 * read as the declared policy's answers.
 *
 * ⚠ `configured` is who answers a call that THREW: such a call reported no identity, so the record carries the identity
 * the host configured, ungraded — the validator's own rule for its thrown calls (`TryReport`).
 * ⭐ R3-A F2 — `validatorId` is the id this reviewer and every answer it gives are recorded under: the live reviewer's, or,
 * under the replay, the replay's own (`REPLAY_DECLARED_REVIEW_VALIDATOR_ID`; `createDeclaredPolicyReviewer` chooses).
 */
export function createModelDeclaredPolicyReviewer(
	validator: Validator,
	configured: () => Identity,
	validatorId: string = DECLARED_REVIEW_VALIDATOR_ID
): DeclaredPolicyReviewer {
	return {
		validatorId,
		async review(subject, input) {
			const policyId = policyIdOf(input);
			if (policyId === undefined)
				return failedAnswer(input.declaredPolicy?.policyId ?? '', validatorId, configured(), NOT_A_DECLARED_REVIEW);
			try {
				const r = await validator.evaluate(subject, { reasoningReview: input });
				// ⭑ The rows and the observations are the POLICY's — `input.criteria` rendered the rubric and scored the reply
				// (`reasoningReviewResultFromJudgement`) — so the floor id the result carries by its type is the only thing
				// read away here.
				return {
					policyId,
					validatorId,
					evaluator: r.evaluator,
					criteria: r.criteria,
					observations: r.observations,
					recommendation: r.dispositionRecommendation,
					residualUncertainty: r.residualUncertainty,
					limitations: r.limitations
				};
			} catch (e) {
				// ⛔ ANSWERED, NOT THROWN — the validator's own sanitised statement (its seam sanitises every throw).
				return failedAnswer(policyId, validatorId, configured(), e instanceof Error ? e.message : String(e));
			}
		}
	};
}

/**
 * ⭐ A REFUSED SELECTION's reviewer: it runs nothing, and answers every review with the refusal — the floor registry's
 * refusing validator's own words (`assurance/index.ts` `unconfiguredReviewer`), read by asking it.
 */
export function createUnconfiguredDeclaredPolicyReviewer(refusing: Validator): DeclaredPolicyReviewer {
	const nobody: Identity = { actorType: 'SYSTEM', agentId: UNCONFIGURED_DECLARED_REVIEWER_ID };
	return {
		validatorId: UNCONFIGURED_DECLARED_REVIEWER_ID,
		async review(subject, input) {
			const policyId = input.declaredPolicy?.policyId ?? '';
			try {
				await refusing.evaluate(subject, { reasoningReview: input });
			} catch (e) {
				return failedAnswer(policyId, UNCONFIGURED_DECLARED_REVIEWER_ID, nobody, e instanceof Error ? e.message : String(e));
			}
			// ⛔ A refusing validator that answered is not refusing: fail closed rather than read its answer.
			return failedAnswer(policyId, UNCONFIGURED_DECLARED_REVIEWER_ID, nobody, 'The refused reviewer selection answered a review.');
		}
	};
}

/** The declared stand-in's identity: distinct from the floor's stand-in, from any model, and from every producer. */
export const STANDIN_DECLARED_EVALUATOR: Identity = {
	actorType: 'AGENT',
	agentId: 'standin-declared-reviewer',
	modelId: 'standin',
	providerId: 'jpwb-test'
};

/** The host's answer to "did the test register a `DECLARED_POLICY` stipulation for this unit's PWA?" — never a throw. */
export type DeclaredStipulationLookup = (subject: AssuranceSubject) => 'CLEAN' | undefined;

/**
 * ⭐⭐ THE DECLARED STAND-IN (test mode only) — the floor stand-in's rules (`standin-reasoning-review-validator.ts`) where they
 * apply, with no checker:
 *   · ⛔ IT JUDGES NOTHING. No structural checker reads a declared criterion, so no row is ever answered MET or NOT_MET
 *     by it — its rule 2's "a stipulation completes a subject the checker READ" cannot hold, and it says so beside every
 *     row, and in its limitations.
 *   · With a registration for the unit's PWA on the `DECLARED_POLICY` arm, EVERY criterion of the policy is stipulated CLEAN:
 *     each recorded `UNABLE_TO_DETERMINE` with `stipulated: 'MET'` beside it, by the package's own mapper.
 *   · Without one, nothing is answered: every row `UNABLE_TO_DETERMINE`, and the verdict INCONCLUSIVE — fail-closed.
 *   · Its recommendation is derived: SATISFIED only over a whole stipulated rubric, INCONCLUSIVE otherwise.
 * ⚠ INDEPENDENCE HERE IS A LABEL, as for the floor's stand-in (`REG-D-071` Q2 (e)).
 */
export function createStandinDeclaredPolicyReviewer(opts: {
	readonly stipulationFor: DeclaredStipulationLookup;
}): DeclaredPolicyReviewer {
	return {
		validatorId: STANDIN_DECLARED_REVIEW_VALIDATOR_ID,
		review(subject, input) {
			const policyId = policyIdOf(input);
			if (policyId === undefined)
				return Promise.resolve(
					failedAnswer(
						input.declaredPolicy?.policyId ?? '',
						STANDIN_DECLARED_REVIEW_VALIDATOR_ID,
						STANDIN_DECLARED_EVALUATOR,
						NOT_A_DECLARED_REVIEW
					)
				);
			const registered = opts.stipulationFor(subject);
			const stipulated: ReasoningReviewFinding[] =
				registered === 'CLEAN'
					? input.criteria.map((c) => ({
							criterionId: c.id,
							failed: false,
							statement: DECLARED_STIPULATION_STATEMENT,
							stipulated: true as const
						}))
					: [];
			const disclosure =
				stipulated.length > 0
					? `Declared stand-in (test mode): no criterion of ${policyId} was judged; all ${stipulated.length} were stipulated CLEAN by the test and NOT reviewed (REG-D-071).`
					: `Declared stand-in (test mode): no criterion of ${policyId} was judged, and no stipulation was registered for this unit's PWA.`;
			const r = reasoningReviewResultFromJudgement(
				subject,
				STANDIN_DECLARED_EVALUATOR,
				STANDIN_DECLARED_REVIEW_VALIDATOR_ID,
				{
					findings: stipulated,
					recommendation: stipulated.length > 0 && stipulated.length === input.criteria.length ? 'SATISFIED' : 'INCONCLUSIVE',
					limitations: [disclosure]
				},
				input.criteria
			);
			return Promise.resolve({
				policyId,
				validatorId: STANDIN_DECLARED_REVIEW_VALIDATOR_ID,
				evaluator: STANDIN_DECLARED_EVALUATOR,
				criteria: r.criteria,
				observations: r.observations,
				recommendation: r.dispositionRecommendation,
				residualUncertainty: r.residualUncertainty,
				limitations: r.limitations
			});
		}
	};
}
