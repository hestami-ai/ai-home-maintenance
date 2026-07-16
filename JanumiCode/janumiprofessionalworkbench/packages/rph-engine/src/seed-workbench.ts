// seedWorkbench — stand up a fully-populated workbench in one call, entirely through live commands: author + publish
// the Product Realization PWA (its PWU Types = the §7 work areas), instantiate it as the Field Service Management
// Undertaking, and drive that Undertaking's Professional Work Graph. This gives the UI a real PWA (PWA Design
// context) AND a real Undertaking with a live graph (Undertaking context) to render — the RPH-DOC-010 separation,
// demonstrated end to end. It is deterministic: it drives commands; no fixture event log is replayed.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import { FLOOR_POLICY_DEFINITIONS, findingsFor, type Severity } from '@janumipwb/rph-assurance';
import type { EngineHandle } from './engine.js';
import { driveReferenceUndertaking } from './reference-undertaking.js';

const ACTOR: ActorReference = {
	actorId: 'workbench',
	actorType: 'HUMAN',
	displayName: 'Workbench'
};

export const SEED_PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5Z00';
export const SEED_PWA_VERSION = '1.3.0';
export const SEED_UNDERTAKING = 'und_01ARZ3NDEKTSV4RRFFQ69G5Z10';

// Stable ids for the Product Realization PWA's PWU Types (referenced below to wire the composition tree).
const PT_ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Z20';
const PT_INTENT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Z30';
const PT_BEHAVIOR = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Z40';
const PT_ARCH = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Z50';
const PT_PLAN = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Z60';
const PT_IMPL = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Z70';
const PT_VALIDATE = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Z80';
const PT_PROMOTE = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Z90';
const PT_CONCERN = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5ZA0';

/** A permitted-child composition rule on a seeded type (cardinality per §11.7.2). */
interface SeedChild {
	id: string;
	cardinality: string;
	note?: string;
}

/** The Product Realization PWA PWU Types (RPH-DOC-010 §7 work areas + a generic Architecture Concern type). The
 *  root permits the 7 canonical branches (each mandatory-exactly-one), Architecture Definition permits the generic
 *  Architecture Concern (conditional one-or-more), and a few types declare required assurance policies (§11.7.4). */
const PWU_TYPES: ReadonlyArray<{
	id: string;
	kind: string;
	name: string;
	purpose: string;
	root?: boolean;
	children?: readonly SeedChild[];
	policies?: readonly string[];
}> = [
	{
		id: PT_ROOT,
		kind: 'PRODUCT_REALIZATION',
		name: 'Product Realization',
		purpose: 'Root: structure product work from intent to authoritative baselines',
		root: true,
		children: [
			{ id: PT_INTENT, cardinality: 'M1' },
			{ id: PT_BEHAVIOR, cardinality: 'M1' },
			{ id: PT_ARCH, cardinality: 'M1' },
			{ id: PT_PLAN, cardinality: 'M1' },
			{ id: PT_IMPL, cardinality: 'M1' },
			{ id: PT_VALIDATE, cardinality: 'M1' },
			{ id: PT_PROMOTE, cardinality: 'M1' }
		],
		policies: ['pol_intent_preservation']
	},
	{
		id: PT_INTENT,
		kind: 'INTENT_DEFINITION',
		name: 'Intent & Product Definition',
		purpose: 'Originating intent, stakeholders, product boundary',
		policies: ['pol_intent_fidelity', 'pol_intent_completeness', 'pol_assumption_disclosure']
	},
	{
		id: PT_BEHAVIOR,
		kind: 'PRODUCT_BEHAVIOR',
		name: 'Product Behavior Definition',
		purpose: 'Actors, capabilities, journeys, requirements'
	},
	{
		id: PT_ARCH,
		kind: 'ARCHITECTURE',
		name: 'Architecture Definition',
		purpose: 'A coherent technical structure realizing approved behavior',
		children: [
			{ id: PT_CONCERN, cardinality: 'C+', note: 'One per material architecture concern' }
		],
		policies: ['pol_architecture_coverage']
	},
	{
		id: PT_PLAN,
		kind: 'IMPLEMENTATION_PLANNING',
		name: 'Implementation Planning',
		purpose: 'Increments, decomposition, dependencies, test + migration planning',
		policies: ['pol_decomposition_coverage']
	},
	{
		id: PT_IMPL,
		kind: 'PRODUCT_IMPLEMENTATION',
		name: 'Product Implementation',
		purpose: 'Realize the planned increments'
	},
	{
		id: PT_VALIDATE,
		kind: 'INTEGRATED_VALIDATION',
		name: 'Integrated Product Validation',
		purpose: 'Journey/requirement/architecture/fitness validation'
	},
	{
		id: PT_PROMOTE,
		kind: 'BASELINE_PROMOTION',
		name: 'Product Baseline Promotion',
		purpose: 'Evidence package, residual-risk + promotion decisions, authoritative baseline'
	},
	{
		id: PT_CONCERN,
		kind: 'ARCHITECTURE_CONCERN',
		name: 'Architecture Concern',
		purpose: 'A generic architecture concern contributing to Architecture Definition'
	}
];

// Each sender uses a UNIQUE key prefix so idempotency keys never collide across logical seed operations (a
// collision would return a prior receipt as DUPLICATE and silently skip the command).
function sender(handle: EngineHandle, prefix: string) {
	let n = 0;
	return (
		commandType: string,
		targetAggregateType: string,
		targetAggregateId: string,
		payload: unknown
	): void => {
		n += 1;
		const command: DomainCommand = {
			commandId: `${prefix}-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType,
			targetAggregateId,
			issuedAt: '2026-07-12T00:00:00Z',
			issuedBy: ACTOR,
			correlationId: 'seed-workbench',
			idempotencyKey: `${prefix}-idem-${n}`,
			payload
		};
		const r = handle.dispatch(command);
		if (r.status !== 'ACCEPTED' && r.status !== 'DUPLICATE') {
			throw new Error(
				`seedWorkbench failed at ${commandType} (${targetAggregateId}): ${r.status} ${JSON.stringify(r.error)}`
			);
		}
	};
}

/** Create the 3 de minimis floor policies as canonical ASSURANCE_POLICY objects (guide §8.4/§8.9). These are
 *  universal (every engine needs them for the floor gate), so this is safe to call on any engine. For the authoring
 *  plane they are scoped to PROFESSIONAL_WORK_ARCHITECTURE (the single-value applicableObjectTypes limitation is
 *  §16-unresolved; the plane-agnostic array is a later reconciliation). */
export function seedFloorPolicies(handle: EngineHandle): void {
	const send = sender(handle, 'seedpol');
	for (const def of FLOOR_POLICY_DEFINITIONS) {
		send('CreateAssurancePolicy', 'ASSURANCE_POLICY', def.policyId, {
			policyId: def.policyId,
			version: '1.0.0',
			name: def.name,
			purpose: def.purpose,
			rationale: def.rationale,
			applicableObjectTypes: ['PROFESSIONAL_WORK_ARCHITECTURE'],
			evaluatedClaimTypes: def.evaluatedClaimTypes,
			criteria: def.criteria,
			evaluatorRole: def.evaluatorRole,
			independenceRequirement: def.independence,
			findingDefinitions: def.findingDefinitions,
			permittedControlActions: def.permittedControlActions
		});
	}
}

/** The Product Realization PWA's additive assurance policies (DOC-004 §15-§21) as authorable ASSURANCE_POLICY
 *  objects — the declarable policies a PWU Type may require ON TOP of the locked de minimis floor. Seeding them as
 *  real objects makes the PWA Designer's policy manager + picker engine-backed (not a static catalog), and gives the
 *  author a starting library to reference, edit, version, suspend, or supersede. Content is a faithful compact of the
 *  ontology's seedPolicies (single-value enum fields per the ASSURANCE_POLICY object contract). */
interface AdditivePolicySeed {
	readonly policyId: string;
	readonly name: string;
	readonly purpose: string;
	readonly rationale: string;
	/** DOC-004 §3.1 / DOC-007 / DOC-002 §17.1: `evaluatedClaimTypes: ClaimType[]`. Was singular. */
	readonly evaluatedClaimTypes: readonly string[];
	readonly evaluatorRole: string;
	readonly independence: string;
	/** DOC-004 §3.1 / DOC-007: `permittedControlActions: ControlAction[]` — a SET per policy. Was ONE. */
	readonly permittedControlActions: readonly string[];
	/** The RATIFIED DOC-004 §7 shape, aliased from the generated contract. This was a THIRD inline
	 *  restatement of `{id, statement, mandatory}` — a shape no document defines — after floor-policies.ts
	 *  and ontology.ts. It survived because AssurancePolicy.criteria was an array of ANY OBJECT
	 *  (AUDIT-placeholder-helpers.md). Aliasing means the next divergence fails the build. */
	readonly criteria: readonly AssessmentCriterion[];
	/** RAW triples. Converted to DOC-004 §9.1 FindingDefinitions at the seeding call by rph-assurance's
	 *  `findingsFor`, which derives each finding's affectedClaimTypes/defaultControlActions from THIS policy's
	 *  own sets — structurally, so a finding cannot claim an action its own policy does not permit. */
	readonly findingDefinitions: ReadonlyArray<{
		code: string;
		severity: Severity;
		statement: string;
	}>;
}

const ADDITIVE_POLICY_SEEDS: readonly AdditivePolicySeed[] = [
	{
		policyId: 'pol_intent_fidelity',
		name: 'Intent Fidelity',
		purpose:
			"The formalized objective represents the user's need rather than substituting a preferred solution; scope, constraints, and material ambiguity are preserved.",
		rationale:
			'Catalog §15 — unauthorized intent alteration cannot be silently introduced; inferred elements must be labelled, not presented as user fact.',
		evaluatedClaimTypes: ['PRESERVATION'],
		evaluatorRole: 'intent-fidelity-reviewer',
		independence: 'DIFFERENT_AGENT',
		// DOC-004 §15.10 (POL-INTENT-FIDELITY) — transcribed, was just 'CLARIFY'
		permittedControlActions: [
			'CLARIFY',
			'REVISE_CONTEXT',
			'RESHAPE_PWU',
			'REQUEST_HUMAN_DECISION',
			'REJECT'
		],
		criteria: [
			{
				id: 'IF-01',
				name: 'Objective fidelity',
				description: 'no solution substituted for the need.',
				criterionType: 'BOOLEAN',
				evaluationMethod: 'MODEL_JUDGMENT',
				requiredEvidenceIds: [],
				severityIfNotMet: 'BLOCKING',
				mayBeNotApplicable: false
			},
			{
				id: 'IF-02',
				name: 'Boundary fidelity',
				description: 'no unauthorized scope expansion.',
				criterionType: 'BOOLEAN',
				evaluationMethod: 'MODEL_JUDGMENT',
				requiredEvidenceIds: [],
				severityIfNotMet: 'BLOCKING',
				mayBeNotApplicable: false
			},
			{
				id: 'IF-03',
				name: 'Constraint fidelity',
				description: 'explicit user constraints preserved.',
				criterionType: 'BOOLEAN',
				evaluationMethod: 'MODEL_JUDGMENT',
				requiredEvidenceIds: [],
				severityIfNotMet: 'BLOCKING',
				mayBeNotApplicable: false
			}
		],
		findingDefinitions: [
			{
				code: 'SOLUTION_SUBSTITUTION',
				severity: 'BLOCKING',
				statement: 'An inferred solution replaced the stated need.'
			},
			{
				code: 'MISSING_USER_CONSTRAINT',
				severity: 'BLOCKING',
				statement: 'A mandatory user constraint was omitted.'
			}
		]
	},
	{
		policyId: 'pol_intent_completeness',
		name: 'Intent Completeness',
		purpose:
			'Desired outcomes, product boundary, mandatory constraints, and success conditions are sufficiently explicit for the next authorized activity.',
		rationale:
			'Catalog §16 — completeness is risk-relative sufficiency, not exhaustive specification.',
		evaluatedClaimTypes: ['COMPLETENESS'],
		evaluatorRole: 'intent-completeness-reviewer',
		independence: 'DIFFERENT_INVOCATION',
		// UNRATIFIED: §16 (POL-INTENT-COMPLETENESS) has NO control-actions subsection — verified by direct search of §16.1-16.6. Value preserved as a 1-element array; shape fixed, content untouched.
		permittedControlActions: ['GATHER_CONTEXT'],
		criteria: [
			{
				id: 'IC-01',
				name: 'IC-01',
				description: 'Desired outcomes are explicit.',
				criterionType: 'BOOLEAN',
				evaluationMethod: 'MODEL_JUDGMENT',
				requiredEvidenceIds: [],
				severityIfNotMet: 'BLOCKING',
				mayBeNotApplicable: false
			},
			{
				id: 'IC-04',
				name: 'IC-04',
				description: 'Mandatory constraints are recorded.',
				criterionType: 'BOOLEAN',
				evaluationMethod: 'MODEL_JUDGMENT',
				requiredEvidenceIds: [],
				severityIfNotMet: 'BLOCKING',
				mayBeNotApplicable: false
			},
			{
				id: 'IC-05',
				name: 'IC-05',
				description: 'Success conditions exist, or the work is marked exploratory.',
				criterionType: 'BOOLEAN',
				evaluationMethod: 'MODEL_JUDGMENT',
				requiredEvidenceIds: [],
				severityIfNotMet: 'BLOCKING',
				mayBeNotApplicable: false
			}
		],
		findingDefinitions: [
			{
				code: 'MISSING_MANDATORY_CONSTRAINT',
				severity: 'MATERIAL',
				statement: 'A mandatory constraint is missing.'
			},
			{
				code: 'NO_SUCCESS_CONDITION',
				severity: 'MATERIAL',
				statement: 'No success condition and not marked exploratory.'
			}
		]
	},
	{
		policyId: 'pol_assumption_disclosure',
		name: 'Assumption Disclosure',
		purpose:
			'Material assumptions are surfaced as first-class Assumption Objects, distinguished from established fact, with materiality and verification needs identified.',
		rationale:
			'Catalog §17 — cross-cutting: applies to any model-produced professional artifact; SATISFIED means disclosed, not verified.',
		evaluatedClaimTypes: ['COMPLETENESS'],
		evaluatorRole: 'assumption-disclosure-reviewer',
		independence: 'DIFFERENT_INVOCATION',
		// DOC-004 §17.8 (POL-ASSUMPTION-DISCLOSURE) — transcribed, was just 'GATHER_EVIDENCE'
		permittedControlActions: [
			'GATHER_EVIDENCE',
			'CLARIFY',
			'RESHAPE_PWU',
			'INVALIDATE_DEPENDENTS',
			'REQUEST_HUMAN_DECISION',
			'ESCALATE'
		],
		criteria: [
			{
				id: 'AD-01',
				name: 'AD-01',
				description: 'Material assumptions surfaced as first-class objects (not prose).',
				criterionType: 'BOOLEAN',
				evaluationMethod: 'MODEL_JUDGMENT',
				requiredEvidenceIds: [],
				severityIfNotMet: 'BLOCKING',
				mayBeNotApplicable: false
			},
			{
				id: 'AD-02',
				name: 'AD-02',
				description: 'Assumptions distinguished from established facts.',
				criterionType: 'BOOLEAN',
				evaluationMethod: 'MODEL_JUDGMENT',
				requiredEvidenceIds: [],
				severityIfNotMet: 'BLOCKING',
				mayBeNotApplicable: false
			},
			{
				id: 'AD-04',
				name: 'AD-04',
				description: 'Materiality is classified (IMMATERIAL/MATERIAL/CRITICAL).',
				criterionType: 'BOOLEAN',
				evaluationMethod: 'MODEL_JUDGMENT',
				requiredEvidenceIds: [],
				severityIfNotMet: 'BLOCKING',
				mayBeNotApplicable: false
			}
		],
		findingDefinitions: [
			{
				code: 'HIDDEN_MATERIAL_ASSUMPTION',
				severity: 'MATERIAL',
				statement: 'A material assumption was left undisclosed.'
			},
			{
				code: 'ASSUMPTION_PRESENTED_AS_FACT',
				severity: 'MATERIAL',
				statement: 'An assumption was presented as established fact.'
			}
		]
	},
	{
		policyId: 'pol_decomposition_coverage',
		name: 'Decomposition Coverage',
		purpose:
			'No mandatory parent obligation silently disappears; applicable constraints propagate; a credible parent-level recomposition strategy exists.',
		rationale:
			'Catalog §19 — any missing mandatory obligation or child intent divergence is BLOCKING.',
		evaluatedClaimTypes: ['COVERAGE'],
		evaluatorRole: 'decomposition-coverage-reviewer',
		independence: 'DIFFERENT_AGENT',
		// DOC-004 §19.8 (POL-DECOMPOSITION-COVERAGE) — transcribed, was just 'REVISE_DECOMPOSITION'
		permittedControlActions: [
			'REVISE_DECOMPOSITION',
			'RESHAPE_PWU',
			'CLARIFY',
			'REQUEST_HUMAN_DECISION',
			'REJECT'
		],
		criteria: [
			{
				id: 'DC-01',
				name: 'DC-01',
				description: 'Every mandatory parent obligation is allocated/retained/satisfied/waived.',
				criterionType: 'BOOLEAN',
				evaluationMethod: 'MODEL_JUDGMENT',
				requiredEvidenceIds: [],
				severityIfNotMet: 'BLOCKING',
				mayBeNotApplicable: false
			},
			{
				id: 'DC-02',
				name: 'DC-02',
				description: 'Applicable constraints are propagated or explicitly retained.',
				criterionType: 'BOOLEAN',
				evaluationMethod: 'MODEL_JUDGMENT',
				requiredEvidenceIds: [],
				severityIfNotMet: 'BLOCKING',
				mayBeNotApplicable: false
			},
			{
				id: 'DC-06',
				name: 'DC-06',
				description: 'A credible recomposition strategy exists.',
				criterionType: 'BOOLEAN',
				evaluationMethod: 'MODEL_JUDGMENT',
				requiredEvidenceIds: [],
				severityIfNotMet: 'BLOCKING',
				mayBeNotApplicable: false
			}
		],
		findingDefinitions: [
			{
				code: 'MISSING_OBLIGATION_ALLOCATION',
				severity: 'BLOCKING',
				statement: 'A mandatory obligation was not allocated.'
			},
			{
				code: 'DROPPED_CONSTRAINT',
				severity: 'BLOCKING',
				statement: 'An applicable constraint was dropped.'
			}
		]
	},
	{
		policyId: 'pol_architecture_coverage',
		name: 'Architecture Coverage',
		purpose:
			'Applicable requirements and constraints are allocated to structure with explicit boundaries, data ownership, and security; the architecture is feasible.',
		rationale:
			'Catalog §21 — critical security, tenant-isolation, data-integrity, or mandatory-constraint failures are BLOCKING.',
		evaluatedClaimTypes: ['COVERAGE'],
		evaluatorRole: 'architecture-coverage-reviewer',
		independence: 'DIFFERENT_AGENT',
		// UNRATIFIED: §21 (POL-ARCHITECTURE-COVERAGE) has NO control-actions subsection — verified by direct search of §21.1-21.6. Value preserved as a 1-element array; shape fixed, content untouched.
		permittedControlActions: ['RESHAPE_PWU'],
		criteria: [
			{
				id: 'AC-01',
				name: 'AC-01',
				description: 'Applicable requirements are allocated to architecture.',
				criterionType: 'BOOLEAN',
				evaluationMethod: 'MODEL_JUDGMENT',
				requiredEvidenceIds: [],
				severityIfNotMet: 'BLOCKING',
				mayBeNotApplicable: false
			},
			{
				id: 'AC-05',
				name: 'AC-05',
				description: 'Data ownership is explicit (data-integrity boundary).',
				criterionType: 'BOOLEAN',
				evaluationMethod: 'MODEL_JUDGMENT',
				requiredEvidenceIds: [],
				severityIfNotMet: 'BLOCKING',
				mayBeNotApplicable: false
			},
			{
				id: 'AC-08',
				name: 'AC-08',
				description: 'Mandatory constraints are preserved.',
				criterionType: 'BOOLEAN',
				evaluationMethod: 'MODEL_JUDGMENT',
				requiredEvidenceIds: [],
				severityIfNotMet: 'BLOCKING',
				mayBeNotApplicable: false
			}
		],
		findingDefinitions: [
			{
				code: 'UNCOVERED_REQUIREMENT',
				severity: 'CRITICAL',
				statement: 'A requirement is not covered by the architecture.'
			},
			{
				code: 'ARCHITECTURE_CONSTRAINT_VIOLATION',
				severity: 'CRITICAL',
				statement: 'The architecture violates a mandatory constraint.'
			}
		]
	},
	{
		policyId: 'pol_intent_preservation',
		name: 'Intent Preservation',
		purpose:
			'Each downstream transformation still preserves the approved Product Intent end-to-end — no silent change of product semantics.',
		rationale:
			'Catalog §20/§30 — the promoted result must still serve the originating Product Intent.',
		evaluatedClaimTypes: ['PRESERVATION'],
		evaluatorRole: 'intent-preservation-reviewer',
		independence: 'DIFFERENT_AGENT',
		// DOC-004 §23.7 (POL-INTENT-PRESERVATION) — transcribed. NOTE: the previous value 'ESCALATE' is NOT a member of §23.7's ratified set; the code permitted an action the ratified policy does not list. Removing it is the ratified truth, and a real behaviour change.
		permittedControlActions: [
			'RESHAPE_PWU',
			'REVISE_DECOMPOSITION',
			'INVALIDATE_DEPENDENTS',
			'REQUEST_HUMAN_DECISION',
			'REJECT',
			'ABANDON'
		],
		criteria: [
			{
				id: 'IP-01',
				name: 'IP-01',
				description: 'Approved intent is traced through this transformation.',
				criterionType: 'BOOLEAN',
				evaluationMethod: 'MODEL_JUDGMENT',
				requiredEvidenceIds: [],
				severityIfNotMet: 'BLOCKING',
				mayBeNotApplicable: false
			},
			{
				id: 'IP-02',
				name: 'IP-02',
				description: 'No silent change to product semantics.',
				criterionType: 'BOOLEAN',
				evaluationMethod: 'MODEL_JUDGMENT',
				requiredEvidenceIds: [],
				severityIfNotMet: 'BLOCKING',
				mayBeNotApplicable: false
			}
		],
		findingDefinitions: [
			{
				code: 'INTENT_EROSION',
				severity: 'BLOCKING',
				statement: 'The approved intent was eroded downstream.'
			}
		]
	}
];

/** Seed the additive Product Realization assurance policies as ACTIVE ASSURANCE_POLICY objects. */
export function seedAdditivePolicies(handle: EngineHandle): void {
	const send = sender(handle, 'seedaddpol');
	for (const p of ADDITIVE_POLICY_SEEDS) {
		send('CreateAssurancePolicy', 'ASSURANCE_POLICY', p.policyId, {
			policyId: p.policyId,
			version: '1.0.0',
			name: p.name,
			purpose: p.purpose,
			rationale: p.rationale,
			applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
			evaluatedClaimTypes: p.evaluatedClaimTypes,
			criteria: p.criteria,
			evaluatorRole: p.evaluatorRole,
			independenceRequirement: p.independence,
			findingDefinitions: findingsFor(p, p.findingDefinitions),
			permittedControlActions: p.permittedControlActions
		});
	}
}

/** The full workbench policy library: the 3 locked de minimis floor policies + the additive Product Realization
 *  policies. Seed this in EVERY engine (reference AND empty) so the PWA Designer's policy manager + picker are
 *  always populated and the floor policies are present as (locked) real objects. */
export function seedPolicyLibrary(handle: EngineHandle): void {
	seedFloorPolicies(handle);
	seedAdditivePolicies(handle);
}

/** Author + publish the Product Realization PWA (idempotent-ish: safe to call once per engine). */
export function authorProductRealizationPwa(handle: EngineHandle): void {
	const send = sender(handle, 'seedpwa');
	send('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', SEED_PWA, {
		pwaId: SEED_PWA,
		name: 'Product Realization',
		domain: 'software product',
		description:
			'Structure product-development work from originating intent through validated, authoritative product baselines.',
		version: SEED_PWA_VERSION
	});
	for (const t of PWU_TYPES) {
		const children = t.children ?? [];
		send('DefinePwuType', 'PWU_TYPE', t.id, {
			pwuTypeId: t.id,
			pwaId: SEED_PWA,
			pwuKind: t.kind,
			name: t.name,
			purpose: t.purpose,
			isRoot: t.root ?? false,
			permittedChildTypeIds: children.map((c) => c.id),
			permittedChildren: children.map((c) => ({
				typeId: c.id,
				cardinality: c.cardinality,
				...(c.note ? { applicabilityNote: c.note } : {})
			})),
			requiredAssurancePolicyIds: [...(t.policies ?? [])]
		});
	}
	send('SubmitPwaForReview', 'PROFESSIONAL_WORK_ARCHITECTURE', SEED_PWA, {});
	send('ValidatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', SEED_PWA, {});
	send('PublishPwa', 'PROFESSIONAL_WORK_ARCHITECTURE', SEED_PWA, {
		rootPwuTypeId: PWU_TYPES[0]!.id
	});
}

/** Author the PWA, instantiate the Field Service Management Undertaking under it, and drive its graph. */
export function seedWorkbench(handle: EngineHandle): void {
	seedPolicyLibrary(handle);
	authorProductRealizationPwa(handle);
	const send = sender(handle, 'sedund');
	send('CreateUndertaking', 'UNDERTAKING', SEED_UNDERTAKING, {
		undertakingId: SEED_UNDERTAKING,
		name: 'Field Service Management SaaS Undertaking',
		description:
			'Build a multi-tenant Field Service Management SaaS product for trades businesses.',
		pwaId: SEED_PWA,
		pwaVersion: SEED_PWA_VERSION,
		instantiationProfile: 'Standard Product Realization',
		objective: 'Enable trades businesses to manage customer work from request through invoice.',
		intendedOutputProduct: 'Field Service Management SaaS'
	});
	const pwuTypeByKind: Record<string, string> = {};
	for (const t of PWU_TYPES) pwuTypeByKind[t.kind] = t.id;
	driveReferenceUndertaking(handle, { undertakingId: SEED_UNDERTAKING, pwuTypeByKind });
}
