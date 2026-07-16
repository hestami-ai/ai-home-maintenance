// seedWorkbench — stand up a fully-populated workbench in one call, entirely through live commands: author + publish
// the Product Realization PWA (its PWU Types = the §7 work areas), instantiate it as the Field Service Management
// Undertaking, and drive that Undertaking's Professional Work Graph. This gives the UI a real PWA (PWA Design
// context) AND a real Undertaking with a live graph (Undertaking context) to render — the RPH-DOC-010 separation,
// demonstrated end to end. It is deterministic: it drives commands; no fixture event log is replayed.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import {
	FLOOR_POLICY_DEFINITIONS,
	findingsFor,
	humanizeCode,
	type Severity
} from '@janumipwb/rph-assurance';
import type { EngineHandle, EngineSeedPolicy } from './engine.js';
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

/**
 * Seed the loaded PWA's additive assurance policies as ACTIVE ASSURANCE_POLICY objects — READ FROM THE ONTOLOGY
 * the engine was composed with, which is the single source for the DOC-004 catalog.
 *
 * It used to iterate a hand-maintained `ADDITIVE_POLICY_SEEDS` const in this file while `validateOntology` and the
 * conformance profiles read `ontology.seedPolicies`. Two copies of the same governance content, no test that they
 * agreed, and the divergence ran exactly one way: the copy the app/agent/UI actually read held 17 of the catalog's
 * 81 criteria and 11 of its 99 findings, in paraphrase, and bound `IP-01`/`IP-02` to claims the ontology binds
 * elsewhere. The FAITHFUL copy was the one nothing seeded. Reading the ontology here is what makes the catalog
 * one thing; `seed-policy-arrays.test.ts` is what keeps it one.
 */
export function seedAdditivePolicies(handle: EngineHandle): void {
	const send = sender(handle, 'seedaddpol');
	for (const p of handle.ontology.seedPolicies) {
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
			independenceRequirement: p.independenceRequirement,
			findingDefinitions: findingsFor(p, rawFindings(p)),
			permittedControlActions: p.permittedControlActions
		});
	}
}

/**
 * The policy's ratified finding codes as the `{code, severity, statement}` triples `findingsFor` converts into
 * DOC-004 §9.1 FindingDefinitions (which derives each finding's affectedClaimTypes/defaultControlActions from the
 * policy itself, so a finding cannot claim an action its own policy forbids).
 *
 * The two fields §9.1 mandates and DOC-004 ratifies for NONE of its 99 codes are resolved without inventing them:
 * an authored annotation if the ontology carries one (11 codes do), otherwise the policy's OWN `failureSeverity`
 * and the humanized code. So an unannotated finding inherits its policy's declared severity rather than a severity
 * someone made up — the same structural rule `findingsFor` already applies to claims and control actions.
 */
function rawFindings(
	p: EngineSeedPolicy
): { code: string; severity: Severity; statement: string }[] {
	return p.findingTypes.map((code) => {
		const annotation = p.findingAnnotations?.[code];
		return {
			code,
			severity: (annotation?.defaultSeverity ?? p.failureSeverity) as Severity,
			statement: annotation?.description ?? humanizeCode(code)
		};
	});
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
