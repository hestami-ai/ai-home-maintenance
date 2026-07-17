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
	type AssuranceSubject,
	type FloorCriterion,
	type FloorPolicyId,
	type FloorPolicyOutcome,
	type FloorPolicyRef,
	type ValidatorResult
} from './floor.js';

/** One observation to record as a canonical ASSURANCE_OBSERVATION (OPEN), faithful to the Validator's proposal. */
export interface RecordableObservation {
	/** The Validator's specific finding/criterion code (e.g. RR-01-no-problem-substitution, SCHEMA_INVALID). */
	readonly code: string;
	readonly severity: Severity;
	readonly statement: string;
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
 * disposition + aggregate + gate, then rehydrates each recorded policy with its Validator result's observations and
 * residual uncertainty so the persisted ASSURANCE_OBSERVATIONs are faithful to exactly what the Validator proposed.
 */
export function assuranceRecordingPlan(
	subject: AssuranceSubject,
	plan: readonly FloorPolicyRef[],
	results: readonly ValidatorResult[]
): AssuranceRecordingPlan {
	const outcome = composeAssuranceOutcome(subject, plan, results);
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
