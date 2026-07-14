// The Assurance-Service RECORDING plan (§8.9 layer 3) — the pure bridge from a floor run to the canonical
// ASSURANCE_ASSESSMENT + ASSURANCE_OBSERVATION objects. composeAssuranceOutcome does the authoritative work
// (boundary classification of each Validator result + strictest-unresolved aggregation + the transition gate); this
// pairs every per-policy outcome back with its Validator result's proposed observations and residual uncertainty,
// and folds the boundary-only pseudo-dispositions (VALIDATOR_FAILED / BOUNDARY_REJECTED, §8.13) into the recordable
// INCONCLUSIVE the AssuranceAssessment state machine actually accepts. A MISSING policy (no Validator ran) yields NO
// assessment — there is nothing to record, and the aggregate already blocks the gate. This module stays PURE and
// plane-agnostic (no contracts import, no dispatch); the recorder that turns the plan into live commands lives in the
// composition layer, so authoring- and execution-plane hosts share one recording shape.
import type { AggregateDisposition, Disposition, Severity } from './assurance-rules.js';
import {
	composeAssuranceOutcome,
	type AssuranceSubject,
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

/** One policy's outcome to record as a canonical ASSURANCE_ASSESSMENT plus its observations. */
export interface RecordablePolicyAssessment {
	readonly policyId: FloorPolicyId;
	readonly policyVersion: string;
	/** The canonical disposition to complete the assessment on (one of the 5; boundary pseudo-values → INCONCLUSIVE). */
	readonly disposition: Disposition;
	/** Whether the policy's independence requirement was met by the evaluator (recorded for transparency). */
	readonly independenceOk: boolean;
	readonly observations: readonly RecordableObservation[];
	readonly residualUncertainty: readonly string[];
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
		assessments.push({
			policyId: po.policyId,
			policyVersion: r?.policyVersion ?? '1',
			disposition: toRecordable(po.disposition),
			independenceOk: po.independenceOk,
			observations,
			residualUncertainty: r?.residualUncertainty ?? []
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
