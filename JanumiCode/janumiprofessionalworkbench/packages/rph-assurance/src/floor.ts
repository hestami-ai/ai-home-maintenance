// The de minimis assurance floor (§8.4) as a PLANE-AGNOSTIC pipeline over an AssuranceSubject — a material
// transformation output, whether an authoring-plane PWA draft or an execution-plane work product. Every material
// transformation receives, in order: (1) strict schema/invariant validation, (2) identity/provenance/trace checks,
// (3) a Reasoning Review Assessment iff produced or materially shaped by an AI/agent, and (4) canonical
// disposition + protected-transition enforcement. This module is the PURE core: it defines the Validator RESULT
// shape a Validator must emit (never bare prose/pass-fail/score — §8.9), the deterministic floor validators, the
// ordered floor plan, and `composeAssuranceOutcome`, which finally wires the assurance island
// (dispositionFromFindings → aggregateDisposition strictest-unresolved + checkIndependence + the result boundary).
// The model-backed Reasoning Review Validator and the registry/invocation live server-side (impure); step (4)
// enforcement is done by the caller that records the Assessment and re-checks the disposition at the gate.
import {
	aggregateDisposition,
	checkIndependence,
	classifyValidatorResult,
	dispositionFromFindings,
	type AggregateDisposition,
	type CriterionResult,
	type Disposition,
	type Identity,
	type IndependenceRequirement,
	type PolicyAssessment,
	type Severity,
	type ValidatorResultClass
} from './assurance-rules.js';

/** A material transformation output the floor runs over — plane-agnostic. */
export interface AssuranceSubject {
	readonly subjectId: string;
	readonly objectType: string;
	readonly semanticVersion: number;
	/** Was the subject produced or materially shaped by an AI/agent? Drives the mandatory Reasoning Review step. */
	readonly isAiProduced: boolean;
	/** Identity of the producer (executor) — the independence baseline the Reasoning Review evaluator must differ from. */
	readonly producer: Identity;
}

export const FLOOR_POLICY_IDS = {
	SCHEMA_INVARIANT: 'floor.schema-invariant',
	IDENTITY_PROVENANCE: 'floor.identity-provenance',
	REASONING_REVIEW: 'floor.reasoning-review'
} as const;
export type FloorPolicyId = (typeof FLOOR_POLICY_IDS)[keyof typeof FLOOR_POLICY_IDS];

export interface FloorPolicyRef {
	readonly policyId: FloorPolicyId;
	readonly policyVersion: string;
	readonly required: boolean;
	readonly independence: IndependenceRequirement;
}

/**
 * The ordered de minimis floor for a subject: schema/invariant → identity/provenance → (Reasoning Review IFF the
 * subject was produced or materially shaped by an AI/agent). The floor is NOT risk-optional — no profile, low-risk
 * classification, or planner may suppress it (§8.4). Reasoning Review requires model-level independence by default.
 */
export function deMinimisFloorPlan(subject: AssuranceSubject): FloorPolicyRef[] {
	const plan: FloorPolicyRef[] = [
		{
			policyId: FLOOR_POLICY_IDS.SCHEMA_INVARIANT,
			policyVersion: '1',
			required: true,
			independence: 'NONE'
		},
		{
			policyId: FLOOR_POLICY_IDS.IDENTITY_PROVENANCE,
			policyVersion: '1',
			required: true,
			independence: 'NONE'
		}
	];
	if (subject.isAiProduced) {
		plan.push({
			policyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
			policyVersion: '1',
			required: true,
			independence: 'DIFFERENT_MODEL'
		});
	}
	return plan;
}

/** One concrete observation a Validator emits (feeds finding-type AssuranceObservations downstream). */
export interface FloorObservation {
	readonly code: string;
	readonly severity: Severity;
	readonly statement: string;
	readonly open: boolean;
}

export interface FloorCriterion extends CriterionResult {
	readonly criterionId: string;
	readonly rationale?: string;
}

/**
 * A Validator's schema-conformant RESULT (§8.9): it PROPOSES criterion results, observations, and a disposition
 * recommendation — it never mutates state and never returns only prose/pass-fail/unscoped confidence. The Assurance
 * Service (composeAssuranceOutcome) validates and composes it; it does not authorize acceptance.
 */
export interface ValidatorResult {
	readonly policyId: FloorPolicyId;
	readonly policyVersion: string;
	readonly validatorId: string;
	readonly validatorVersion: string;
	readonly subjectId: string;
	readonly subjectSemanticVersion: number;
	/** Identity of the evaluator (for the independence check against the subject's producer). */
	readonly evaluator: Identity;
	readonly criteria: readonly FloorCriterion[];
	readonly observations: readonly FloorObservation[];
	readonly dispositionRecommendation: Disposition;
	readonly consideredEvidenceIds: readonly string[];
	readonly rejectedEvidenceIds: readonly string[];
	readonly residualUncertainty: readonly string[];
	readonly executionFailed: boolean;
	readonly limitations: readonly string[];
}

function buildResult(args: {
	subject: AssuranceSubject;
	policyId: FloorPolicyId;
	validatorId: string;
	criteria: readonly FloorCriterion[];
	observations: readonly FloorObservation[];
	evaluator: Identity;
}): ValidatorResult {
	const dispositionRecommendation = dispositionFromFindings({
		findings: args.observations.map((o) => ({ severity: o.severity, open: o.open })),
		criteria: args.criteria
	});
	return {
		policyId: args.policyId,
		policyVersion: '1',
		validatorId: args.validatorId,
		validatorVersion: '1',
		subjectId: args.subject.subjectId,
		subjectSemanticVersion: args.subject.semanticVersion,
		evaluator: args.evaluator,
		criteria: args.criteria,
		observations: args.observations,
		dispositionRecommendation,
		consideredEvidenceIds: [],
		rejectedEvidenceIds: [],
		residualUncertainty: [],
		executionFailed: false,
		limitations: []
	};
}

const SYSTEM_EVALUATOR: Identity = { actorType: 'SYSTEM', agentId: 'floor.deterministic' };

// ── Step 1: strict output-contract/schema validation + applicable deterministic invariants ──────────────────────
export interface SchemaInvariantFacts {
	readonly schemaValid: boolean;
	/** Codes of violated deterministic invariants (empty = none). */
	readonly invariantViolations: readonly string[];
}

/** Deterministic floor Validator #1 — the subject conforms to its object contract/schema and every applicable
 *  deterministic invariant holds. A schema failure is CRITICAL; an invariant violation is BLOCKING. */
export function schemaInvariantValidator(
	subject: AssuranceSubject,
	facts: SchemaInvariantFacts
): ValidatorResult {
	const observations: FloorObservation[] = [];
	if (!facts.schemaValid)
		observations.push({
			code: 'SCHEMA_INVALID',
			severity: 'CRITICAL',
			statement: 'Subject failed strict output-contract/schema validation.',
			open: true
		});
	for (const v of facts.invariantViolations)
		observations.push({
			code: v,
			severity: 'BLOCKING',
			statement: `Deterministic invariant violated: ${v}`,
			open: true
		});
	const criteria: FloorCriterion[] = [
		{
			criterionId: 'FS-01-schema',
			mandatory: true,
			outcome: facts.schemaValid ? 'MET' : 'NOT_MET'
		},
		{
			criterionId: 'FS-02-invariants',
			mandatory: true,
			outcome: facts.invariantViolations.length === 0 ? 'MET' : 'NOT_MET'
		}
	];
	return buildResult({
		subject,
		policyId: FLOOR_POLICY_IDS.SCHEMA_INVARIANT,
		validatorId: 'deterministic.schema-invariant',
		criteria,
		observations,
		evaluator: SYSTEM_EVALUATOR
	});
}

// ── Step 2: identity, semantic-version, provenance, authority, input/context/output, and trace completeness ──────
export interface IdentityProvenanceFacts {
	readonly hasStableId: boolean;
	readonly hasSemanticVersion: boolean;
	readonly hasProvenance: boolean;
	readonly hasProducer: boolean;
	readonly traceComplete: boolean;
}

/** Deterministic floor Validator #2 — identity/version/provenance/producer/trace completeness. Any missing element
 *  is BLOCKING (the subject cannot be admitted without a stable, traceable identity). */
export function identityProvenanceValidator(
	subject: AssuranceSubject,
	facts: IdentityProvenanceFacts
): ValidatorResult {
	const criteria: FloorCriterion[] = [
		{
			criterionId: 'IP-01-identity',
			mandatory: true,
			outcome: facts.hasStableId ? 'MET' : 'NOT_MET'
		},
		{
			criterionId: 'IP-02-version',
			mandatory: true,
			outcome: facts.hasSemanticVersion ? 'MET' : 'NOT_MET'
		},
		{
			criterionId: 'IP-03-provenance',
			mandatory: true,
			outcome: facts.hasProvenance ? 'MET' : 'NOT_MET'
		},
		{
			criterionId: 'IP-04-producer',
			mandatory: true,
			outcome: facts.hasProducer ? 'MET' : 'NOT_MET'
		},
		{
			criterionId: 'IP-05-trace',
			mandatory: true,
			outcome: facts.traceComplete ? 'MET' : 'NOT_MET'
		}
	];
	const observations: FloorObservation[] = criteria
		.filter((c) => c.outcome === 'NOT_MET')
		.map((c) => ({
			code: c.criterionId,
			severity: 'BLOCKING' as const,
			statement: `${c.criterionId} not satisfied — identity/provenance/trace incomplete.`,
			open: true
		}));
	return buildResult({
		subject,
		policyId: FLOOR_POLICY_IDS.IDENTITY_PROVENANCE,
		validatorId: 'deterministic.identity-provenance',
		criteria,
		observations,
		evaluator: SYSTEM_EVALUATOR
	});
}

// ── Step 4 (compose): validate each Validator result at the boundary, check independence, and aggregate ──────────
export interface FloorPolicyOutcome {
	readonly policyId: FloorPolicyId;
	readonly required: boolean;
	readonly resultClass: ValidatorResultClass | 'MISSING';
	readonly disposition: Disposition | 'VALIDATOR_FAILED' | 'BOUNDARY_REJECTED' | 'MISSING';
	readonly boundaryReason?: string;
	readonly independenceOk: boolean;
}

export interface AssuranceOutcome {
	readonly subjectId: string;
	readonly subjectSemanticVersion: number;
	readonly aggregate: AggregateDisposition;
	readonly perPolicy: readonly FloorPolicyOutcome[];
	readonly observations: readonly FloorObservation[];
	/** True iff the composed aggregate permits the protected downstream transition (SATISFIED only). Missing,
	 *  failed, boundary-rejected, inconclusive, conditional, or rejected floor results all block. */
	readonly gatePermitsTransition: boolean;
}

/**
 * The Assurance-Service composition step. For each planned floor policy: if its Validator result is MISSING, the
 * floor is incomplete (never assume satisfied). Otherwise classify the result at the boundary (VALIDATOR_FAILED /
 * BOUNDARY_REJECTED never become authoritative findings), enforce the policy's independence requirement, derive the
 * single-policy disposition, and fold everything into the strictest-unresolved aggregate. The gate opens only on a
 * SATISFIED aggregate.
 */
export function composeAssuranceOutcome(
	subject: AssuranceSubject,
	plan: readonly FloorPolicyRef[],
	results: readonly ValidatorResult[]
): AssuranceOutcome {
	const byPolicy = new Map(results.map((r) => [r.policyId, r]));
	const perPolicy: FloorPolicyOutcome[] = [];
	const observations: FloorObservation[] = [];
	const policyAssessments: PolicyAssessment[] = [];

	for (const p of plan) {
		const r = byPolicy.get(p.policyId);
		if (!r) {
			perPolicy.push({
				policyId: p.policyId,
				required: p.required,
				resultClass: 'MISSING',
				disposition: 'MISSING',
				independenceOk: false
			});
			policyAssessments.push({ required: p.required, disposition: 'MISSING' });
			continue;
		}
		observations.push(...r.observations);
		const independence = checkIndependence(p.independence, subject.producer, r.evaluator);
		const mandatoryUnmet = r.criteria.some((c) => c.mandatory && c.outcome === 'NOT_MET');
		const klass = classifyValidatorResult({
			executionFailed: r.executionFailed,
			schemaValid: true,
			policyVersionMatches: r.policyVersion === p.policyVersion,
			subjectVersionMatches: r.subjectSemanticVersion === subject.semanticVersion,
			requiredCriteriaPresent: r.criteria.length > 0,
			evidenceExists: true,
			evidenceInvalidated: false,
			independenceSatisfied: independence.independent,
			recommendation: r.dispositionRecommendation,
			mandatoryCriterionUnmet: mandatoryUnmet
		});

		let disposition: FloorPolicyOutcome['disposition'];
		let aggDisposition: PolicyAssessment['disposition'];
		if (klass.klass === 'VALIDATOR_FAILED') {
			disposition = 'VALIDATOR_FAILED';
			aggDisposition = 'INCONCLUSIVE'; // §8.13: not REJECTED; leaves assurance incomplete → blocks.
		} else if (klass.klass === 'BOUNDARY_REJECTED') {
			disposition = 'BOUNDARY_REJECTED';
			aggDisposition = 'INCONCLUSIVE'; // malformed result cannot create an authoritative finding → blocks.
		} else {
			disposition = dispositionFromFindings({
				findings: r.observations.map((o) => ({ severity: o.severity, open: o.open })),
				criteria: r.criteria
			});
			aggDisposition = disposition;
		}
		perPolicy.push({
			policyId: p.policyId,
			required: p.required,
			resultClass: klass.klass,
			disposition,
			...(klass.reason ? { boundaryReason: klass.reason } : {}),
			independenceOk: independence.independent
		});
		policyAssessments.push({ required: p.required, disposition: aggDisposition });
	}

	const aggregate = aggregateDisposition(policyAssessments);
	return {
		subjectId: subject.subjectId,
		subjectSemanticVersion: subject.semanticVersion,
		aggregate,
		perPolicy,
		observations,
		gatePermitsTransition: aggregate === 'SATISFIED'
	};
}
