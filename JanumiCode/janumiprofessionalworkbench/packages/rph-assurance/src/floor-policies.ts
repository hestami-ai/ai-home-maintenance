// The 3 de minimis floor policies as authorable ASSURANCE_POLICY content — the single source of truth for both the
// runtime floor plan (deMinimisFloorPlan / the Validators) and the seeded canonical ASSURANCE_POLICY objects. §8.4
// mandates all three; §8.10 treats Reasoning Review as a versioned Assurance Policy. The rich rule arrays of the
// AssurancePolicyDefinition object (disposition/remediation/escalation/waiver rules) are §16.23-unresolved shapes, so
// the seed fills them empty; the meaningful content is criteria + independence + finding definitions.
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import type { IndependenceRequirement, Severity } from './assurance-rules.js';
import { FLOOR_POLICY_IDS, type FloorPolicyId } from './floor.js';
import { REASONING_REVIEW_CRITERIA } from './validators.js';

/**
 * A floor criterion IS a DOC-004 §7 `AssessmentCriterion` — no local restatement.
 *
 * It was `{ id, statement, mandatory }`: a shape no ratified document defines, with no overlap beyond `id`.
 * That survived because `AssurancePolicy.criteria` was typed as an array of ANY OBJECT, so nothing could
 * detect the divergence (AUDIT-placeholder-helpers.md). Aliasing the generated type rather than redeclaring
 * it means the next divergence fails the build instead of shipping.
 *
 * MIGRATION (2026-07-16), faithful to the live runtime:
 *   statement       -> description
 *   mandatory: true -> severityIfNotMet: 'BLOCKING'  (assurance-rules already maps a mandatory NOT_MET
 *                      criterion and an open BLOCKING finding to the same REJECTED disposition)
 *
 * ⚠️ `name` — CORRECTED 2026-07-16 after adversarial review caught the claim below being false.
 *
 * This comment previously read: "name -> taken from the id's own descriptive tail ('FS-01-schema' ->
 * 'Schema conformance'), which is existing content". **That rule is falsified by its own example, 7 times out
 * of 7.** Mechanically applying it gives 'schema', not 'Schema conformance'; 'invariants', not 'Invariant
 * integrity'; 'producer', not 'Producing actor recorded'. The two are not the same operation and never were.
 *
 * The truth: the 7 FS/IP names below are AUTHORED — I wrote them, reading each criterion's own description
 * and its policy's purpose. That is authoring professional content, which is exactly what the increment claimed
 * not to do. It is disclosed here rather than dressed as derivation, and it is the smallest such authoring I
 * could find (a short label for a criterion whose full statement is right beside it, in a policy nobody reads
 * at runtime), but the honest name for it is authored, not transcribed.
 *
 * The RR-* names ARE mechanically derived — see the `.replace(...).replaceAll(...)` below, which is the rule
 * this comment described. If the sponsor wants the floor's names ratified rather than authored, these 7 are
 * the list to review.
 */
export type FloorPolicyCriterion = AssessmentCriterion;
export interface FloorFindingDefinition {
	readonly code: string;
	readonly severity: Severity;
	readonly statement: string;
}
export interface FloorPolicyDefinition {
	readonly policyId: FloorPolicyId;
	readonly name: string;
	readonly purpose: string;
	readonly rationale: string;
	/** Single ClaimType value (the object schema takes a single enum, not an array). */
	readonly evaluatedClaimType: string;
	readonly evaluatorRole: string;
	readonly independence: IndependenceRequirement;
	/** Single ControlAction value the policy may recommend. */
	readonly permittedControlAction: string;
	readonly criteria: readonly FloorPolicyCriterion[];
	readonly findingDefinitions: readonly FloorFindingDefinition[];
}

const REASONING_REVIEW: FloorPolicyDefinition = {
	policyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
	name: 'Reasoning Review',
	purpose:
		'Every material AI/agent output genuinely discharges its delegated professional obligation rather than producing a plausible substitute that conceals the underlying problem.',
	rationale:
		'The mandatory, non-suppressible floor for AI-produced work (§8.4). No profile, low-risk classification, or planner may waive it; it requires evaluator independence.',
	evaluatedClaimType: 'CORRECTNESS',
	evaluatorRole: 'reasoning-reviewer',
	independence: 'DIFFERENT_MODEL',
	permittedControlAction: 'RETRY',
	// The ONLY floor policy whose evaluationMethod is MODEL_JUDGMENT: §8.4 step 3's Reasoning Review is a
	// judgment about whether an AI result genuinely discharged its obligation — it cannot be a deterministic
	// check, which is exactly why §8.4 requires evaluator independence for it and not for steps 1-2.
	// `name` is the id's descriptive tail ('RR-01-no-problem-substitution' -> 'no problem substitution') —
	// existing content, not authored: these ids already carry the criterion's short label.
	criteria: REASONING_REVIEW_CRITERIA.map((c) => ({
		id: c.id,
		name: c.id.replace(/^RR-\d+-/, '').replaceAll('-', ' '),
		description: c.label,
		criterionType: 'BOOLEAN' as const,
		evaluationMethod: 'MODEL_JUDGMENT' as const,
		requiredEvidenceIds: [],
		severityIfNotMet: 'BLOCKING' as const,
		mayBeNotApplicable: false
	})),
	findingDefinitions: REASONING_REVIEW_CRITERIA.map((c) => ({
		code: c.id,
		severity: 'MATERIAL' as const,
		statement: `Reasoning-review failure: ${c.label}`
	}))
};

const SCHEMA_INVARIANT: FloorPolicyDefinition = {
	policyId: FLOOR_POLICY_IDS.SCHEMA_INVARIANT,
	name: 'Output Contract & Invariant Integrity',
	purpose:
		'Every material output conforms to its object contract/schema and all applicable deterministic invariants.',
	rationale: 'Floor step 1 (§8.4): a candidate that fails its contract cannot be admitted.',
	evaluatedClaimType: 'CORRECTNESS',
	evaluatorRole: 'deterministic-schema-validator',
	independence: 'NONE',
	permittedControlAction: 'ESCALATE',
	// evaluationMethod DETERMINISTIC: this floor's evaluator is `deterministic-schema-validator` — a contract
	// check, not a judgment. severityIfNotMet BLOCKING: §8.4 step 1, "a candidate that fails its contract cannot
	// be admitted." mayBeNotApplicable false: the floor always applies to a material transformation.
	criteria: [
		{
			id: 'FS-01-schema',
			name: 'Schema conformance',
			description: 'The output conforms to its object contract / schema.',
			criterionType: 'BOOLEAN',
			evaluationMethod: 'DETERMINISTIC',
			requiredEvidenceIds: [],
			severityIfNotMet: 'BLOCKING',
			mayBeNotApplicable: false
		},
		{
			id: 'FS-02-invariants',
			name: 'Invariant integrity',
			description: 'All applicable deterministic invariants hold.',
			criterionType: 'BOOLEAN',
			evaluationMethod: 'DETERMINISTIC',
			requiredEvidenceIds: [],
			severityIfNotMet: 'BLOCKING',
			mayBeNotApplicable: false
		}
	],
	findingDefinitions: [
		{
			code: 'SCHEMA_INVALID',
			severity: 'CRITICAL',
			statement: 'Output failed strict contract/schema validation.'
		},
		{
			code: 'INVARIANT_VIOLATION',
			severity: 'BLOCKING',
			statement: 'A deterministic invariant was violated.'
		}
	]
};

const IDENTITY_PROVENANCE: FloorPolicyDefinition = {
	policyId: FLOOR_POLICY_IDS.IDENTITY_PROVENANCE,
	name: 'Identity, Provenance & Trace Completeness',
	purpose:
		'Every material output carries a stable identity, semantic version, provenance, producing actor, and complete trace.',
	rationale: 'Floor step 2 (§8.4): an untraceable output cannot be admitted or later assessed.',
	evaluatedClaimType: 'CONSISTENCY',
	evaluatorRole: 'deterministic-provenance-validator',
	independence: 'NONE',
	permittedControlAction: 'ESCALATE',
	// All DETERMINISTIC (evaluator: `deterministic-provenance-validator`) and BLOCKING — §8.4 step 2: "an
	// untraceable output cannot be admitted or later assessed."
	criteria: [
		{
			id: 'IP-01-identity',
			name: 'Stable identity',
			description: 'The subject has a stable identity.',
			criterionType: 'BOOLEAN',
			evaluationMethod: 'DETERMINISTIC',
			requiredEvidenceIds: [],
			severityIfNotMet: 'BLOCKING',
			mayBeNotApplicable: false
		},
		{
			id: 'IP-02-version',
			name: 'Semantic version',
			description: 'The subject carries a semantic version.',
			criterionType: 'BOOLEAN',
			evaluationMethod: 'DETERMINISTIC',
			requiredEvidenceIds: [],
			severityIfNotMet: 'BLOCKING',
			mayBeNotApplicable: false
		},
		{
			id: 'IP-03-provenance',
			name: 'Provenance recorded',
			description: 'The subject records its provenance.',
			criterionType: 'BOOLEAN',
			evaluationMethod: 'DETERMINISTIC',
			requiredEvidenceIds: [],
			severityIfNotMet: 'BLOCKING',
			mayBeNotApplicable: false
		},
		{
			id: 'IP-04-producer',
			name: 'Producing actor recorded',
			description: 'The producing actor is recorded.',
			criterionType: 'BOOLEAN',
			evaluationMethod: 'DETERMINISTIC',
			requiredEvidenceIds: [],
			severityIfNotMet: 'BLOCKING',
			mayBeNotApplicable: false
		},
		{
			id: 'IP-05-trace',
			name: 'Trace completeness',
			description: 'Input/context/output trace is complete.',
			criterionType: 'BOOLEAN',
			evaluationMethod: 'DETERMINISTIC',
			requiredEvidenceIds: [],
			severityIfNotMet: 'BLOCKING',
			mayBeNotApplicable: false
		}
	],
	findingDefinitions: [
		{ code: 'IP-01-identity', severity: 'BLOCKING', statement: 'Missing/unstable identity.' },
		{ code: 'IP-02-version', severity: 'BLOCKING', statement: 'Missing semantic version.' },
		{ code: 'IP-03-provenance', severity: 'BLOCKING', statement: 'Missing provenance.' },
		{ code: 'IP-04-producer', severity: 'BLOCKING', statement: 'Missing producing actor.' },
		{ code: 'IP-05-trace', severity: 'BLOCKING', statement: 'Incomplete trace.' }
	]
};

/** The de minimis floor policies, in floor order. Reasoning Review last (it applies only to AI-produced subjects). */
export const FLOOR_POLICY_DEFINITIONS: readonly FloorPolicyDefinition[] = [
	SCHEMA_INVARIANT,
	IDENTITY_PROVENANCE,
	REASONING_REVIEW
];
