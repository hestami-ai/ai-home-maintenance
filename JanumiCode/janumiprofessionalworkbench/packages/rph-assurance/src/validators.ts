// The Validator subsystem seam (§8.9) — the evaluator-execution arm of Assurance Engineering. A Validator is a
// replaceable implementation of a floor policy that PROPOSES a schema-conformant ValidatorResult; it never mutates
// state. This module is the in-process registry + the ordered-floor runner + the pure Reasoning-Review judgement
// mapper. The registry is a RUNTIME seam (not a persisted contract — §16.23 leaves deployment-capability projections
// unresolved). Concrete model-backed Validators (e.g. agy/Gemini for Reasoning Review) live server-side and register
// here; the deterministic floor Validators are pure and defined here.
import type { Disposition, Identity, Severity } from './assurance-rules.js';
import { assuranceRecordingPlan, type AssuranceRecordingPlan } from './recording.js';
import {
	composeAssuranceOutcome,
	deMinimisFloorPlan,
	FLOOR_POLICY_IDS,
	identityProvenanceValidator,
	schemaInvariantValidator,
	type AssuranceOutcome,
	type AssuranceSubject,
	type FloorCriterion,
	type FloorObservation,
	type FloorPolicyId,
	type FloorPolicyRef,
	type IdentityProvenanceFacts,
	type SchemaInvariantFacts,
	type ValidatorResult
} from './floor.js';

/** The inputs a Validator needs beyond the subject. Deterministic Validators read the fact bags; the Reasoning
 *  Review Validator reads the review input (the intent + the serialized subject content to review). */
export interface ReasoningReviewInput {
	readonly prompt: string;
	readonly content: string;
	readonly plan?: string;
	readonly prior?: { readonly gaps: readonly string[] };
}
export interface ValidatorContext {
	readonly schemaInvariant?: SchemaInvariantFacts;
	readonly identityProvenance?: IdentityProvenanceFacts;
	readonly reasoningReview?: ReasoningReviewInput;
}

export interface Validator {
	readonly policyId: FloorPolicyId;
	readonly validatorId: string;
	evaluate(subject: AssuranceSubject, ctx: ValidatorContext): Promise<ValidatorResult>;
}

export interface ValidatorRegistry {
	register(v: Validator): void;
	get(policyId: FloorPolicyId): Validator | undefined;
}

/** An in-process validator registry (one Validator per floor policy). Not a persisted contract. */
export function createValidatorRegistry(): ValidatorRegistry {
	const map = new Map<FloorPolicyId, Validator>();
	return {
		register: (v) => {
			map.set(v.policyId, v);
		},
		get: (id) => map.get(id)
	};
}

// Deterministic floor Validators as registry instances (pure — they read facts from the context).
export const schemaInvariantValidatorInstance: Validator = {
	policyId: FLOOR_POLICY_IDS.SCHEMA_INVARIANT,
	validatorId: 'deterministic.schema-invariant',
	evaluate: (subject, ctx) =>
		Promise.resolve(
			schemaInvariantValidator(
				subject,
				ctx.schemaInvariant ?? {
					schemaValid: false,
					invariantViolations: ['SCHEMA_FACTS_UNAVAILABLE']
				}
			)
		)
};
export const identityProvenanceValidatorInstance: Validator = {
	policyId: FLOOR_POLICY_IDS.IDENTITY_PROVENANCE,
	validatorId: 'deterministic.identity-provenance',
	evaluate: (subject, ctx) =>
		Promise.resolve(
			identityProvenanceValidator(
				subject,
				ctx.identityProvenance ?? {
					hasStableId: false,
					hasSemanticVersion: false,
					hasProvenance: false,
					hasProducer: false,
					traceComplete: false
				}
			)
		)
};

/** Reasoning Review criteria = the §8.4 / §11.7.5 derivational-integrity failure classes, phrased so that MET means
 *  the failure is ABSENT. The Validator prompt and the judgement mapper both key off these ids. */
export const REASONING_REVIEW_CRITERIA = [
	{
		id: 'RR-01-no-problem-substitution',
		label:
			'The result genuinely discharges its delegated obligation rather than substituting an easier problem.'
	},
	{
		id: 'RR-02-no-obligation-elision',
		label: 'No delegated professional obligation is silently dropped.'
	},
	{
		id: 'RR-03-no-unjustified-scope-reduction',
		label: 'Scope is not narrowed without explicit justification.'
	},
	{
		id: 'RR-04-no-proxy-satisfaction',
		label: 'No proxy or surface satisfaction that conceals the underlying problem.'
	},
	{ id: 'RR-05-no-premature-convergence', label: 'No premature closure or convergence.' },
	{
		id: 'RR-06-sound-inference',
		label: 'No unsupported assumptions, circular support, or invalid inference.'
	},
	{
		id: 'RR-07-no-contradiction',
		label: 'No contradiction with intent, constraints, inputs, or evidence.'
	},
	{
		id: 'RR-08-evidence-integrity',
		label: 'No omitted inconvenient evidence and no hidden/unacknowledged uncertainty.'
	},
	{
		id: 'RR-09-no-completeness-from-existence',
		label: 'Completeness is not claimed merely from output existence or activity.'
	}
] as const;

export interface ReasoningReviewFinding {
	readonly criterionId: string;
	/** True = the failure class IS present (i.e. the criterion is NOT_MET). */
	readonly failed: boolean;
	readonly statement: string;
	readonly severity?: Severity;
}
export interface ReasoningReviewJudgement {
	readonly findings: readonly ReasoningReviewFinding[];
	readonly recommendation: Disposition;
	readonly residualUncertainty?: readonly string[];
	readonly limitations?: readonly string[];
	readonly consideredEvidenceIds?: readonly string[];
	readonly rejectedEvidenceIds?: readonly string[];
}

/**
 * Map a Reasoning Review judgement (from any backend — model, deterministic, hybrid, human) to the schema-conformant
 * ValidatorResult. Each failure class becomes a mandatory criterion (MET iff absent); present failures become open
 * observations. Pure + backend-agnostic, so the agy/Gemini adapter and any future Validator share one mapping.
 */
export function reasoningReviewResultFromJudgement(
	subject: AssuranceSubject,
	evaluator: Identity,
	validatorId: string,
	j: ReasoningReviewJudgement
): ValidatorResult {
	const byId = new Map(j.findings.map((f) => [f.criterionId, f]));
	const criteria: FloorCriterion[] = REASONING_REVIEW_CRITERIA.map((c) => {
		const f = byId.get(c.id);
		return {
			criterionId: c.id,
			mandatory: true,
			outcome: f?.failed ? 'NOT_MET' : 'MET',
			...(f?.statement ? { rationale: f.statement } : {})
		};
	});
	const observations: FloorObservation[] = j.findings
		.filter((f) => f.failed)
		.map((f) => ({
			code: f.criterionId,
			severity: f.severity ?? 'MATERIAL',
			statement: f.statement,
			open: true
		}));
	return {
		policyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
		policyVersion: '1',
		validatorId,
		validatorVersion: '1',
		subjectId: subject.subjectId,
		subjectSemanticVersion: subject.semanticVersion,
		evaluator,
		criteria,
		observations,
		dispositionRecommendation: j.recommendation,
		consideredEvidenceIds: j.consideredEvidenceIds ?? [],
		rejectedEvidenceIds: j.rejectedEvidenceIds ?? [],
		residualUncertainty: j.residualUncertainty ?? [],
		executionFailed: false,
		limitations: j.limitations ?? []
	};
}

function failedResult(
	subject: AssuranceSubject,
	p: FloorPolicyRef,
	validatorId: string,
	reason: string
): ValidatorResult {
	return {
		policyId: p.policyId,
		policyVersion: p.policyVersion,
		validatorId,
		validatorVersion: '1',
		subjectId: subject.subjectId,
		subjectSemanticVersion: subject.semanticVersion,
		evaluator: { actorType: 'SYSTEM' },
		criteria: [],
		observations: [
			{ code: 'VALIDATOR_EXECUTION_FAILED', severity: 'MATERIAL', statement: reason, open: true }
		],
		dispositionRecommendation: 'INCONCLUSIVE',
		consideredEvidenceIds: [],
		rejectedEvidenceIds: [],
		residualUncertainty: [],
		executionFailed: true,
		limitations: []
	};
}

/**
 * Run the ordered de minimis floor over a subject using the registered Validators. An absent Validator leaves its
 * policy MISSING (compose blocks — never assume satisfied); a Validator that throws yields a VALIDATOR_FAILED result
 * (compose blocks, and it is never mistaken for REJECTED). The composed outcome + its transition gate are returned.
 */
async function runFloorResults(
	subject: AssuranceSubject,
	ctx: ValidatorContext,
	registry: ValidatorRegistry
): Promise<{ plan: FloorPolicyRef[]; results: ValidatorResult[] }> {
	const plan = deMinimisFloorPlan(subject);
	const results: ValidatorResult[] = [];
	for (const p of plan) {
		const v = registry.get(p.policyId);
		if (!v) continue; // missing → compose treats the policy as MISSING → blocks
		try {
			results.push(await v.evaluate(subject, ctx));
		} catch (e) {
			results.push(
				failedResult(subject, p, v.validatorId, e instanceof Error ? e.message : String(e))
			);
		}
	}
	return { plan, results };
}

export async function runDeMinimisFloor(
	subject: AssuranceSubject,
	ctx: ValidatorContext,
	registry: ValidatorRegistry
): Promise<AssuranceOutcome> {
	const { plan, results } = await runFloorResults(subject, ctx, registry);
	return composeAssuranceOutcome(subject, plan, results);
}

/**
 * Run the ordered de minimis floor and produce the Assurance-Service RECORDING plan — the canonical per-policy
 * assessments + observations carrying the floor-computed dispositions (§8.9 layer 3). Same run + blocking semantics
 * as runDeMinimisFloor; the composition layer turns the plan into live ASSURANCE_ASSESSMENT/OBSERVATION commands.
 */
export async function runFloorAndPlanRecording(
	subject: AssuranceSubject,
	ctx: ValidatorContext,
	registry: ValidatorRegistry
): Promise<AssuranceRecordingPlan> {
	const { plan, results } = await runFloorResults(subject, ctx, registry);
	return assuranceRecordingPlan(subject, plan, results);
}
