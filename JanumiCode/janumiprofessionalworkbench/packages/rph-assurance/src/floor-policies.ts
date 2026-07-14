// The 3 de minimis floor policies as authorable ASSURANCE_POLICY content — the single source of truth for both the
// runtime floor plan (deMinimisFloorPlan / the Validators) and the seeded canonical ASSURANCE_POLICY objects. §8.4
// mandates all three; §8.10 treats Reasoning Review as a versioned Assurance Policy. The rich rule arrays of the
// AssurancePolicyDefinition object (disposition/remediation/escalation/waiver rules) are §16.23-unresolved shapes, so
// the seed fills them empty; the meaningful content is criteria + independence + finding definitions.
import type { IndependenceRequirement, Severity } from './assurance-rules.js';
import { FLOOR_POLICY_IDS, type FloorPolicyId } from './floor.js';
import { REASONING_REVIEW_CRITERIA } from './validators.js';

export interface FloorPolicyCriterion {
	readonly id: string;
	readonly statement: string;
	readonly mandatory: boolean;
}
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
	criteria: REASONING_REVIEW_CRITERIA.map((c) => ({
		id: c.id,
		statement: c.label,
		mandatory: true
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
	criteria: [
		{
			id: 'FS-01-schema',
			statement: 'The output conforms to its object contract / schema.',
			mandatory: true
		},
		{
			id: 'FS-02-invariants',
			statement: 'All applicable deterministic invariants hold.',
			mandatory: true
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
	criteria: [
		{ id: 'IP-01-identity', statement: 'The subject has a stable identity.', mandatory: true },
		{ id: 'IP-02-version', statement: 'The subject carries a semantic version.', mandatory: true },
		{ id: 'IP-03-provenance', statement: 'The subject records its provenance.', mandatory: true },
		{ id: 'IP-04-producer', statement: 'The producing actor is recorded.', mandatory: true },
		{ id: 'IP-05-trace', statement: 'Input/context/output trace is complete.', mandatory: true }
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
