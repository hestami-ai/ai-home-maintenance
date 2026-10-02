// The Assurance-Service RECORDING plan (§8.9 layer 3) — the pure bridge from a floor run to the canonical
// ASSURANCE_ASSESSMENT + ASSURANCE_OBSERVATION objects. composeAssuranceOutcome does the authoritative work
// (boundary classification of each Validator result + strictest-unresolved aggregation + the transition gate); this
// pairs every per-policy outcome back with its Validator result's proposed observations and residual uncertainty,
// and folds the boundary-only pseudo-dispositions (VALIDATOR_FAILED / BOUNDARY_REJECTED, §8.13) into the recordable
// INCONCLUSIVE the AssuranceAssessment state machine actually accepts. A MISSING policy (no Validator ran) yields NO
// assessment — there is nothing to record, and the aggregate already blocks the gate. This module stays PURE and
// plane-agnostic (no contracts import, no dispatch); the recorder that turns the plan into live commands lives in the
// composition layer, so authoring- and execution-plane hosts share one recording shape.
import type { AggregateDisposition, Disposition, Identity, Severity } from './assurance-rules.js';
import {
	composeAssuranceOutcome,
	FLOOR_POLICY_IDS,
	type AssuranceSubject,
	type ComposeOptions,
	type FloorCriterion,
	type FloorPolicyId,
	type FloorPolicyOutcome,
	type FloorPolicyRef,
	type ValidatorResult
} from './floor.js';

/** An ASSURANCE_OBSERVATION to record (OPEN): a Validator's own, or INDEPENDENCE_VIOLATION / D2's recommendation. */
export interface RecordableObservation {
	/** The Validator's specific finding/criterion code (e.g. RR-01-no-problem-substitution, SCHEMA_INVALID). */
	readonly code: string;
	readonly severity: Severity;
	readonly statement: string;
	/**
	 * ⭐ `JAN-ESCREC` D2 — the §21 `observationType`, carried ONLY by an observation this module authors itself. Absent —
	 * as on every observation transcribed from a Validator — the recorder types it by policy (`observationTypeFor` in
	 * `rph-engine`'s `record-assurance.ts`: FINDING for the review, POLICY_VIOLATION otherwise), exactly as before.
	 *
	 * ⭑ THE NARROWEST UNION ADMITTING WHAT IS WRITTEN, and this module writes one type. A wider one would let a later
	 * writer pick a type nobody has decided on: `REG-Q-068` (open) records that no ratified text says which of the seven
	 * types are signals and which defects, so a second member here is a decision, and must be a reviewed edit of this line.
	 * ⭑ LOCAL, NOT THE CONTRACT'S `ObservationType`: this module imports no contracts (see the header) — it is the PURE,
	 * plane-agnostic plan, and the recorder is the one seam that maps it onto the wire. The recorder ties this union to
	 * the ratified enum at compile time with a type ANNOTATION (`record-assurance.ts`: the `observationType` it sends
	 * is declared `ObservationType`, so a member outside the enum fails to compile), and the command schema refuses
	 * anything else at dispatch.
	 */
	readonly observationType?: 'RECOMMENDATION';
}

/**
 * ⭐⭐ `JAN-ESCREC` D2 — THE CODE OF THE ONE TYPED OBSERVATION THIS MODULE AUTHORS (beside the untyped
 * `INDEPENDENCE_VIOLATION`): a VALID Reasoning Review's ESCALATED recommendation, recorded whatever the review's
 * outcome (`REG-D-089`; `REG-D-090`).
 *
 * ⭑ EXPORTED BY NAME so a reader IMPORTS it instead of restating it: the app's classifier keeps it out of the subject
 * findings with an `o.code === …` comparison no compiler checks (the `VALIDATOR_MODEL_SUBSTITUTED` precedent,
 * `validators.ts`). ⭑ AND ON THE EVENT IT IS THE ONLY DISCRIMINATOR: `AssuranceObservationRecorded` carries no
 * observation type, so a reader of the log tells this record from a finding by this code alone.
 *
 * ⚠ DISCLOSED: THE CODE IS NOT RESERVED AT THE BOUNDARY (the ER-1 verifier's finding [5]). Nothing refuses a VALIDATOR
 * that proposes an observation of its OWN under this code — or under `INDEPENDENCE_VIOLATION`, the other code this
 * module authors. Such an observation is transcribed like any other: untyped, at the validator's severity, before the
 * one appended here. So on the event, where the code is the only discriminator, a validator's fault would read as the
 * service's record of a recommendation, and the app's classifier, which keeps this code out of the subject findings,
 * would hide that fault from the producer. Driven in memory by the verifier: a VALID review proposing it at BLOCKING is
 * recorded REJECTED, carrying it. ⭑ NO LIVE REVIEWER CAN: `coerceJudgement` keeps a finding only under a criterion id
 * the POLICY declares (`apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.ts:296-310`, the filter at
 * `:300-303`), and the mapper codes each observation by that id (`validators.ts`,
 * `reasoningReviewResultFromJudgement`). A boundary rule — refuse (BOUNDARY_REJECTED) or rename an observation a
 * validator proposes under a code the service authors — is filed as `REG-F-478`, and is not built in `JAN-ESCREC` ER-1.
 */
export const REVIEWER_RECOMMENDED_ESCALATION = 'REVIEWER_RECOMMENDED_ESCALATION';

/**
 * The observation's fixed statement, `REG-D-090` verbatim. It states the fact and nothing more: what the reviewer
 * recommended, that the review prompt does not define it, and the Assurance Policy Catalog's definition (its §10.1
 * ESCALATED heading). It names no criterion and no deficiency, because it is not a finding — the disclosed departure
 * from ASR-11's observation shape that `REG-Q-068` leaves open.
 *
 * ⛔ NOT EXPORTED, AND THE EXPORT CENSUS IS THE REASON (`scripts/export-guard.ts`: the unit is the PRODUCTION-CONSUMED
 * value export). No production reader needs this text: the recorder carries it through the plan, a reader of the record
 * reads it back from the OBJECT, and the operator-facing sentences D3 adds are the app's own, worded differently. So an
 * export would be a surface that makes no promise to the system — or, once something imported it, a consumed export
 * owing a guard for nothing. And it would invite the one test that cannot fail: the recorded statement compared with
 * the constant it was built from passes any edit of it. The tests restate it byte for byte from `REG-D-090` instead.
 * ⚠ ITS SECOND SENTENCE IS A CLAIM ABOUT ONE APP FILE, made from this validator-agnostic package, which cannot see it:
 * the reviewer prompt (`apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.ts`, the recommendation
 * sentence). `reasoning-review-validator.test.ts` pins it there in every framing (the ER-1 verifier's finding [10]; the
 * re-verifiers' [2] and [3]): that sentence WHOLE, the value bare at its end, and the value named ONCE in the whole
 * materialized prompt — so the one definition it cannot see is a definition ELSEWHERE in the prompt that never names the
 * value. And "the reviewing model" presumes a model evaluator, which a human reviewer (`REG-F-474`) would not be.
 */
const REVIEWER_RECOMMENDED_ESCALATION_STATEMENT =
	"The reviewing model's recommendation was ESCALATED. The review prompt does not define ESCALATED; the Assurance Policy Catalog defines it as: the validator implementation or policy-designated authority cannot resolve the issue within its authority or competence.";

/**
 * ⭐ D2's CONDITION — and what it leaves out on purpose.
 *
 * ⭑ THE REASONING REVIEW ONLY, VALID ONLY, THE LITERAL ONLY. A boundary-rejected or failed result's recommendation is
 * never read (ASR-11: *"Malformed or invalid validator output can never mutate authoritative state"*), a failed
 * validator's being a placeholder (`validators.ts`' `failedResult`); and the deterministic policies recommend what their
 * own ladder computed, so an ESCALATED there is no reviewer's word. The literal is exact: no other case, no padding.
 * ⚠ "VALID" IS THE BOUNDARY'S CLASS, WHICH IS WIDER THAN ASR-2'S VALID OUTPUT (the ER-1 verifier's finding [7]). ASR-2
 * calls a partial reply — an unanswered mandatory criterion — *"invalid output"*; the boundary rejects only an EMPTY
 * criteria list (`floor.ts:440`, the `requiredCriteriaPresent` flag), so a partial reply is classed VALID and composes
 * INCONCLUSIVE. That is why a review left INCONCLUSIVE by an unanswered criterion records its recommendation here, as
 * the ruling's *"in every case"* asks, while a result the boundary DOES reject records none.
 * ⛔ AND NOT THE OUTCOME. The ruling records the recommendation *"in every case"* — beside a REJECTED (*"with the
 * escalation recorded beside it"*), an INCONCLUSIVE, a CONDITIONALLY_SATISFIED, or a SATISFIED kept because another policy
 * blocked (`composeAssuranceOutcome`'s rule (a), D1). Keyed on `po.disposition === 'ESCALATED'`, every one of those would
 * lose it, which is `REG-F-473`'s loss again.
 * ⛔ NOR THE PLAN'S `required` FLAG (the ER-1 re-verifier's finding [4], decided in the second fix round): *"in every
 * case"* includes a review the plan marks non-required, which D1 escalates all the same (`floor.ts`, condition (iv)).
 */
function recordsTheEscalation(po: FloorPolicyOutcome, r: ValidatorResult | undefined): boolean {
	return (
		po.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW &&
		po.resultClass === 'VALID' &&
		r?.dispositionRecommendation === 'ESCALATED'
	);
}

/**
 * One policy's outcome to record as a canonical ASSURANCE_ASSESSMENT plus its observations.
 *
 * THIS CARRIES THE WHOLE VALIDATOR RESULT, not a summary of it. It used to carry seven fields, and
 * `recordAssuranceRecordingPlan` then completed the assessment with a `validatorResult` of exactly TWO:
 * `{ dispositionRecommendation, evaluator }` — where `evaluator` is not a field of the ratified DOC-007 §20
 * ValidatorResult at all, and every one of §20's sixteen was absent. The island computes a full, faithful
 * result (floor.ts `ValidatorResult`); this seam discarded thirteen of its fields on the way into the governed
 * stream, and `ValidatorResultSchema` was `z.record(z.string(), z.unknown())` — any object — so nothing said so
 * for the codebase's life. The verdict that decides whether AI-produced professional work may be published was
 * the least-checked payload in the system.
 *
 * The fields below exist so the recorder can build a real §20 ValidatorResult. Every one is already computed
 * upstream: this is transcription of a mapping that should always have existed, not new information.
 */
export interface RecordablePolicyAssessment {
	readonly policyId: FloorPolicyId;
	readonly policyVersion: string;
	/** DOC-007 §20 — the validator IMPLEMENTATION that produced this result (e.g. `deterministic.schema-invariant`),
	 *  distinct from the `evaluator` identity that ran it. The island had it all along; the record never carried it. */
	readonly validatorId: string;
	readonly validatorVersion: string;
	/** The canonical disposition to complete the assessment on (one of the 5; boundary pseudo-values → INCONCLUSIVE). */
	readonly disposition: Disposition;
	/** Whether the policy's independence requirement was met by the evaluator (recorded for transparency). */
	readonly independenceOk: boolean;
	/** The evaluator that actually produced this Validator result — §8.4 L851 requires its "actual identities and
	 *  lineage are recorded", and §9.7 the "resolved provider/model/version actually invoked". Deterministic floor
	 *  validators run as SYSTEM; the Reasoning Review carries the real judge (model/provider). */
	readonly evaluator?: Identity;
	/** The per-criterion results. §20 routes these through `claimResults` — see recordAssuranceRecordingPlan for
	 *  why the floor cannot use that route and what is surfaced instead. */
	readonly criteria: readonly FloorCriterion[];
	readonly observations: readonly RecordableObservation[];
	readonly consideredEvidenceIds: readonly string[];
	readonly rejectedEvidenceIds: readonly string[];
	readonly residualUncertainty: readonly string[];
	readonly limitations: readonly string[];
}

/** The full recording plan for a subject's floor run — a superset of what the transition gate needs. */
export interface AssuranceRecordingPlan {
	readonly subjectId: string;
	readonly subjectSemanticVersion: number;
	readonly aggregate: AggregateDisposition;
	readonly gatePermitsTransition: boolean;
	/** One assessment per policy that produced a Validator result (MISSING policies are omitted). */
	readonly assessments: readonly RecordablePolicyAssessment[];
}

/** Fold a per-policy boundary outcome into a recordable disposition. VALIDATOR_FAILED / BOUNDARY_REJECTED are NOT
 *  authoritative dispositions (§8.13) — they leave the policy INCONCLUSIVE, which blocks the gate. MISSING never
 *  reaches here (those policies are filtered out — no assessment is recorded for a Validator that did not run). */
function toRecordable(d: FloorPolicyOutcome['disposition']): Disposition {
	if (d === 'VALIDATOR_FAILED' || d === 'BOUNDARY_REJECTED' || d === 'MISSING')
		return 'INCONCLUSIVE';
	return d;
}

/**
 * Build the recording plan from a floor run. Reuses composeAssuranceOutcome as the single source of the per-policy
 * disposition + aggregate + gate — `REG-D-089`'s rule (a) included, so a review may be completed ESCALATED — then
 * rehydrates each recorded policy with its Validator result's observations and residual uncertainty, so the persisted
 * ASSURANCE_OBSERVATIONs are faithful to exactly what the Validator proposed, followed by the two this module authors
 * itself: the INDEPENDENCE_VIOLATION a failed independence check leaves, and a VALID Reasoning Review's ESCALATED
 * recommendation (`JAN-ESCREC` D2). Neither is ever placed in the ladder's input.
 */
export function assuranceRecordingPlan(
	subject: AssuranceSubject,
	plan: readonly FloorPolicyRef[],
	results: readonly ValidatorResult[],
	opts: ComposeOptions = {}
): AssuranceRecordingPlan {
	const outcome = composeAssuranceOutcome(subject, plan, results, opts);
	const byPolicy = new Map(results.map((r) => [r.policyId, r]));
	const assessments: RecordablePolicyAssessment[] = [];
	for (const po of outcome.perPolicy) {
		if (po.resultClass === 'MISSING') continue;
		const r = byPolicy.get(po.policyId);
		const observations: RecordableObservation[] = (r?.observations ?? []).map((o) => ({
			code: o.code,
			severity: o.severity,
			statement: o.statement
		}));
		// A required-but-failed independence check must leave a DURABLE, inspectable observation, not only the
		// transient `independenceOk` flag. Persistence records observations, never the flag (recordAssuranceRecordingPlan),
		// so without this the violation would vanish at the boundary and the read-back would report independence as
		// satisfied. §8.12: "If required independence is missing, the Assessment cannot be satisfied; record an
		// independence violation." (This is why an Assessment could never reach a durable INDEPENDENCE_VIOLATION.)
		if (!po.independenceOk) {
			observations.push({
				code: 'INDEPENDENCE_VIOLATION',
				severity: 'BLOCKING',
				statement:
					po.boundaryReason ??
					'The Reasoning Review evaluator is not independent of the producer (§8.4, §8.12).'
			});
		}
		// ⭐⭐ `JAN-ESCREC` D2 — THE REVIEWER'S ESCALATED RECOMMENDATION, RECORDED BESIDE THE OUTCOME (`REG-D-089`). ASR-1
		// separates the validator's recommendation from the authoritative disposition, and the Contract Package's §38
		// lists both, *"For every validator call"*; until now the recommendation reached no assessment record
		// (design G2). ⭑ APPENDED HERE, AFTER COMPOSITION, LIKE THE INDEPENDENCE VIOLATION ABOVE, and LAST: it never
		// enters the ladder's input or `composeAssuranceOutcome(...).observations`, and wherever the Validator proposed
		// observations of its own, the first one is still its own. ⚠ Where it proposed none — the clean, ESCALATED arm —
		// this is the ONLY observation, so a reader of `observations[0]` meets it (D3's waiver target read it so until
		// ER-1, and now skips it: `apps/rph-demo/src/routes/pwa/[id]/+page.server.ts`).
		// ⭑ INFORMATIONAL and open: a record of what was recommended, which forecloses no disposition. ⚠ The type is lost
		// on the EVENT (`AssuranceObservationRecorded` carries none), so there the code is the discriminator. Only
		// ESCALATED is recorded; every other recommendation is `REG-F-475`'s.
		if (recordsTheEscalation(po, r)) {
			observations.push({
				code: REVIEWER_RECOMMENDED_ESCALATION,
				observationType: 'RECOMMENDATION',
				severity: 'INFORMATIONAL',
				statement: REVIEWER_RECOMMENDED_ESCALATION_STATEMENT
			});
		}
		assessments.push({
			policyId: po.policyId,
			policyVersion: r?.policyVersion ?? '1',
			// `unknown.<policyId>` only if a policy produced a non-MISSING outcome with no result at all, which
			// composeAssuranceOutcome should make impossible — it is a loud placeholder, not a silent default.
			validatorId: r?.validatorId ?? `unknown.${po.policyId}`,
			validatorVersion: r?.validatorVersion ?? '1',
			disposition: toRecordable(po.disposition),
			independenceOk: po.independenceOk,
			...(r?.evaluator ? { evaluator: r.evaluator } : {}),
			criteria: r?.criteria ?? [],
			observations,
			consideredEvidenceIds: r?.consideredEvidenceIds ?? [],
			rejectedEvidenceIds: r?.rejectedEvidenceIds ?? [],
			residualUncertainty: r?.residualUncertainty ?? [],
			limitations: r?.limitations ?? []
		});
	}
	return {
		subjectId: outcome.subjectId,
		subjectSemanticVersion: outcome.subjectSemanticVersion,
		aggregate: outcome.aggregate,
		gatePermitsTransition: outcome.gatePermitsTransition,
		assessments
	};
}
