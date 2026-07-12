// The pure assurance rule functions (DOC-004). Validators only RECOMMEND; these functions are how the
// Assurance Service turns criteria + findings + evidence + independence into authoritative dispositions.
// Load-bearing rules: strictest-unresolved aggregate (NEVER a numeric average, §28.2); UNABLE_TO_DETERMINE
// != MET (Inv-6); VALIDATOR_FAILED != REJECTED and boundary-rejection != REJECTED (Inv-9/10); waivers bind
// to an exact policy+criterion+object+semanticVersion (Inv-14).

export type Disposition =
	'SATISFIED' | 'CONDITIONALLY_SATISFIED' | 'REJECTED' | 'INCONCLUSIVE' | 'ESCALATED';
export type AggregateDisposition =
	| 'REJECTED'
	| 'EVIDENCE_REQUIRED'
	| 'UNASSESSED'
	| 'INCONCLUSIVE'
	| 'CONDITIONALLY_SATISFIED'
	| 'SATISFIED';
export type CriterionOutcome =
	'MET' | 'PARTIALLY_MET' | 'NOT_MET' | 'NOT_APPLICABLE' | 'UNABLE_TO_DETERMINE';
export type Severity = 'INFORMATIONAL' | 'ADVISORY' | 'MATERIAL' | 'BLOCKING' | 'CRITICAL';

export interface Finding {
	readonly severity: Severity;
	readonly open: boolean;
}
export interface CriterionResult {
	readonly mandatory: boolean;
	readonly outcome: CriterionOutcome;
}

/**
 * Single-policy disposition (§10.3 precedence ladder). Open CRITICAL/BLOCKING findings and unmet mandatory
 * criteria block satisfaction; UNABLE_TO_DETERMINE on a mandatory criterion is INCONCLUSIVE (never a pass);
 * a MATERIAL finding or a partially-met mandatory criterion yields CONDITIONALLY_SATISFIED.
 */
export function dispositionFromFindings(input: {
	findings: readonly Finding[];
	criteria: readonly CriterionResult[];
	evidenceDeficit?: boolean;
}): Disposition {
	const open = input.findings.filter((f) => f.open);
	if (open.some((f) => f.severity === 'CRITICAL')) return 'REJECTED';
	if (open.some((f) => f.severity === 'BLOCKING')) return 'REJECTED';
	const mandatory = input.criteria.filter((c) => c.mandatory);
	if (mandatory.some((c) => c.outcome === 'NOT_MET')) return 'REJECTED';
	if (input.evidenceDeficit || mandatory.some((c) => c.outcome === 'UNABLE_TO_DETERMINE'))
		return 'INCONCLUSIVE';
	if (
		open.some((f) => f.severity === 'MATERIAL') ||
		mandatory.some((c) => c.outcome === 'PARTIALLY_MET')
	) {
		return 'CONDITIONALLY_SATISFIED';
	}
	if (mandatory.every((c) => c.outcome === 'MET' || c.outcome === 'NOT_APPLICABLE'))
		return 'SATISFIED';
	return 'INCONCLUSIVE';
}

export interface PolicyAssessment {
	readonly required: boolean;
	readonly disposition: Disposition | 'WAIVED' | 'MISSING' | 'EVIDENCE_REQUIRED';
}

/**
 * Aggregate (multi-policy) disposition — the STRICTEST UNRESOLVED disposition among REQUIRED policies, in
 * precedence order. NEVER a numeric average; a satisfied advisory policy never overrides a rejected blocking
 * one (advisory/non-required policies do not gate the aggregate). §28.2 / Inv-17.
 */
export function aggregateDisposition(
	assessments: readonly PolicyAssessment[]
): AggregateDisposition {
	const required = assessments.filter((a) => a.required);
	if (required.some((a) => a.disposition === 'REJECTED')) return 'REJECTED';
	if (required.some((a) => a.disposition === 'MISSING')) return 'UNASSESSED';
	if (required.some((a) => a.disposition === 'EVIDENCE_REQUIRED')) return 'EVIDENCE_REQUIRED';
	if (required.some((a) => a.disposition === 'INCONCLUSIVE' || a.disposition === 'ESCALATED'))
		return 'INCONCLUSIVE';
	if (required.some((a) => a.disposition === 'CONDITIONALLY_SATISFIED'))
		return 'CONDITIONALLY_SATISFIED';
	if (required.every((a) => a.disposition === 'SATISFIED' || a.disposition === 'WAIVED'))
		return 'SATISFIED';
	return 'INCONCLUSIVE';
}

export interface EvidenceForAdmissibility {
	readonly id?: string;
	readonly provenance?: unknown;
	readonly contentReference?: unknown;
	readonly scope?: string;
	readonly limitations?: readonly string[];
	readonly status?: string;
	readonly supportsClaimIds?: readonly string[];
}
export interface AdmissibilityResult {
	readonly admissible: boolean;
	readonly failed: readonly string[];
}

/** Evidence admissibility — all 8 conditions (§6.2). Absence of any condition makes the evidence inadmissible;
 *  admissible evidence is a precondition for a SATISFIED claim (Inv-3). Confidence is never a substitute. */
export function evidenceAdmissibility(
	e: EvidenceForAdmissibility,
	opts: { claimId?: string; sufficientlyCurrent?: boolean } = {}
): AdmissibilityResult {
	const failed: string[] = [];
	if (!e.id) failed.push('IDENTITY_STABLE');
	if (e.provenance === undefined || e.provenance === null) failed.push('PROVENANCE_PRESENT');
	if (e.contentReference === undefined || e.contentReference === null)
		failed.push('CONTENT_AVAILABLE');
	if (!e.scope) failed.push('SCOPE_STATED');
	if (e.limitations === undefined) failed.push('LIMITATIONS_RECORDED'); // an empty array counts as recorded
	if (e.status === 'INVALIDATED') failed.push('NOT_INVALIDATED');
	if (opts.sufficientlyCurrent === false) failed.push('SUFFICIENTLY_CURRENT');
	if (opts.claimId && e.supportsClaimIds && !e.supportsClaimIds.includes(opts.claimId))
		failed.push('RELEVANT');
	return { admissible: failed.length === 0, failed };
}

export type IndependenceRequirement =
	| 'NONE'
	| 'DIFFERENT_INVOCATION'
	| 'DIFFERENT_CONTEXT_INSTANCE'
	| 'DIFFERENT_AGENT'
	| 'DIFFERENT_MODEL'
	| 'DIFFERENT_PROVIDER'
	| 'HUMAN'
	| 'ORGANIZATIONALLY_INDEPENDENT';

export interface Identity {
	readonly invocationId?: string;
	readonly contextInstanceId?: string;
	readonly agentId?: string;
	readonly modelId?: string;
	readonly providerId?: string;
	readonly orgId?: string;
	readonly actorType?: string;
}

/** Multi-dimensional independence check (§8, Inv-8). If not satisfied the assessment CANNOT be SATISFIED. */
export function checkIndependence(
	required: IndependenceRequirement,
	producer: Identity,
	evaluator: Identity
): { independent: boolean; reason?: string } {
	const differs = (k: keyof Identity): boolean =>
		producer[k] !== undefined && evaluator[k] !== undefined && producer[k] !== evaluator[k];
	const fail = (reason: string) => ({ independent: false, reason });
	switch (required) {
		case 'NONE':
			return { independent: true };
		case 'DIFFERENT_INVOCATION':
			return differs('invocationId') ? { independent: true } : fail('same invocation');
		case 'DIFFERENT_CONTEXT_INSTANCE':
			return differs('contextInstanceId') ? { independent: true } : fail('same context instance');
		case 'DIFFERENT_AGENT':
			return differs('agentId') ? { independent: true } : fail('same agent identity');
		case 'DIFFERENT_MODEL':
			return differs('modelId') ? { independent: true } : fail('same model');
		case 'DIFFERENT_PROVIDER':
			return differs('providerId') ? { independent: true } : fail('same provider');
		case 'HUMAN':
			return evaluator.actorType === 'HUMAN'
				? { independent: true }
				: fail('evaluator is not human');
		case 'ORGANIZATIONALLY_INDEPENDENT':
			return differs('orgId') ? { independent: true } : fail('same organization');
		default: {
			const _never: never = required;
			throw new Error(`Unknown independence requirement: ${String(_never)}`);
		}
	}
}

export interface Waiver {
	readonly policyId: string;
	readonly criterionId: string;
	readonly objectId: string;
	readonly objectSemanticVersion: number;
}

/** A waiver applies ONLY to its exact policy + criterion + object + semantic version (Inv-14). A waiver for
 *  object v2 does NOT apply to v3 — new semantic versions require an explicit re-waiver. */
export function isWaiverApplicable(waiver: Waiver, target: Waiver): boolean {
	return (
		waiver.policyId === target.policyId &&
		waiver.criterionId === target.criterionId &&
		waiver.objectId === target.objectId &&
		waiver.objectSemanticVersion === target.objectSemanticVersion
	);
}

export type ValidatorResultClass = 'VALID' | 'VALIDATOR_FAILED' | 'BOUNDARY_REJECTED';

export interface ValidatorResultContext {
	readonly executionFailed?: boolean;
	readonly schemaValid: boolean;
	readonly policyVersionMatches: boolean;
	readonly subjectVersionMatches: boolean;
	readonly requiredCriteriaPresent: boolean;
	readonly evidenceExists: boolean;
	readonly evidenceInvalidated: boolean;
	readonly independenceSatisfied: boolean;
	readonly recommendation?: string;
	readonly mandatoryCriterionUnmet?: boolean;
}

/**
 * Classify a validator result BEFORE it can affect authoritative state (§34, Inv-9/10). A validator execution
 * failure is VALIDATOR_FAILED (never REJECTED). Malformed/incoherent output is BOUNDARY_REJECTED (never
 * REJECTED). Only a VALID result may then be turned into an authoritative disposition (which could be REJECTED
 * on its merits). A SATISFIED recommendation with an unmet mandatory criterion is rejected at the boundary.
 */
export function classifyValidatorResult(ctx: ValidatorResultContext): {
	klass: ValidatorResultClass;
	reason?: string;
} {
	if (ctx.executionFailed)
		return { klass: 'VALIDATOR_FAILED', reason: 'validator execution failed' };
	if (!ctx.schemaValid)
		return { klass: 'BOUNDARY_REJECTED', reason: 'RPH_VALIDATOR_OUTPUT_INVALID' };
	if (!ctx.policyVersionMatches)
		return { klass: 'BOUNDARY_REJECTED', reason: 'RPH_POLICY_VERSION_MISMATCH' };
	if (!ctx.subjectVersionMatches)
		return { klass: 'BOUNDARY_REJECTED', reason: 'RPH_SUBJECT_VERSION_MISMATCH' };
	if (!ctx.requiredCriteriaPresent)
		return { klass: 'BOUNDARY_REJECTED', reason: 'required criteria missing' };
	if (!ctx.evidenceExists) return { klass: 'BOUNDARY_REJECTED', reason: 'RPH_EVIDENCE_MISSING' };
	if (ctx.evidenceInvalidated)
		return { klass: 'BOUNDARY_REJECTED', reason: 'RPH_EVIDENCE_INVALIDATED' };
	if (!ctx.independenceSatisfied)
		return { klass: 'BOUNDARY_REJECTED', reason: 'RPH_VALIDATOR_INDEPENDENCE_VIOLATION' };
	if (ctx.recommendation === 'SATISFIED' && ctx.mandatoryCriterionUnmet) {
		return {
			klass: 'BOUNDARY_REJECTED',
			reason: 'disposition contradicts mandatory policy (SATISFIED with unmet mandatory criterion)'
		};
	}
	return { klass: 'VALID' };
}
