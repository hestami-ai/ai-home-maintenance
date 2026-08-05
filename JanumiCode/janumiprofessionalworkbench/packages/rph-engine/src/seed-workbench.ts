// seedWorkbench — stand up a fully-populated workbench in one call, entirely through live commands: author + publish
// the Product Realization PWA (its PWU Types = the §7 work areas), instantiate it as the Field Service Management
// Undertaking, and drive that Undertaking's Professional Work Graph. This gives the UI a real PWA (PWA Design
// context) AND a real Undertaking with a live graph (Undertaking context) to render — the RPH-DOC-010 separation,
// demonstrated end to end. It is deterministic: it drives commands; no fixture event log is replayed.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { ProfessionalWorkObjectTypeSchema } from '@janumipwb/rph-contracts';
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

/** The Product Realization PWA PWU Types (RPH-DOC-010 §7 work areas + the corpus's Architecture Concern type). The
 *  root permits the 7 canonical branches (each mandatory-exactly-one), Architecture Definition permits the
 *  Architecture Concern (conditional one-or-more), and each type's required assurance policies are DERIVED from the
 *  ontology (§11.7.4) — see `policiesForKind` below. */
const PWU_TYPES: ReadonlyArray<{
	id: string;
	kind: string;
	name: string;
	purpose: string;
	root?: boolean;
	children?: readonly SeedChild[];
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
		]
	},
	{
		id: PT_INTENT,
		kind: 'INTENT_AND_PRODUCT_DEFINITION',
		name: 'Intent & Product Definition',
		purpose: 'Originating intent, stakeholders, product boundary'
	},
	{
		id: PT_BEHAVIOR,
		kind: 'PRODUCT_BEHAVIOR_DEFINITION',
		name: 'Product Behavior Definition',
		purpose: 'Actors, capabilities, journeys, requirements'
	},
	{
		id: PT_ARCH,
		kind: 'ARCHITECTURE_DEFINITION',
		name: 'Architecture Definition',
		purpose: 'A coherent technical structure realizing approved behavior',
		children: [
			{ id: PT_CONCERN, cardinality: 'C+', note: 'One per material architecture concern' }
		]
	},
	{
		id: PT_PLAN,
		kind: 'IMPLEMENTATION_PLANNING',
		name: 'Implementation Planning',
		purpose: 'Increments, decomposition, dependencies, test + migration planning'
	},
	{
		id: PT_IMPL,
		kind: 'PRODUCT_IMPLEMENTATION',
		name: 'Product Implementation',
		purpose: 'Realize the planned increments'
	},
	{
		id: PT_VALIDATE,
		kind: 'INTEGRATED_PRODUCT_VALIDATION',
		name: 'Integrated Product Validation',
		purpose: 'Journey/requirement/architecture/fitness validation'
	},
	{
		id: PT_PROMOTE,
		kind: 'PRODUCT_BASELINE_PROMOTION',
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

/**
 * The policies a PWU Type DECLARES, read from the ontology the engine was composed with (REG-F-029).
 *
 * These four lists used to be written by hand on `PWU_TYPES` — a THIRD copy of content the ontology already
 * carries as `pwuTemplates[].defaultPolicyIds`, and it had drifted exactly the way a hand-maintained copy does:
 * a strict SUBSET for three kinds, and ABSENT for five, so `PT_BEHAVIOR` and `PT_CONCERN` declared nothing at
 * all. Any per-kind policy selection built on that copy would have inherited the gaps rather than closed them —
 * which is what made this the first step of REG-F-029 rather than a tidy-up.
 *
 * The same move `seedAdditivePolicies` already made for `seedPolicies`: read the ontology, so the catalog is one
 * thing. FAILS LOUD on a kind the ontology does not describe, because a silent `[]` here is precisely the shape
 * that produces an unassessable PWU Type three layers downstream.
 */
function policiesForKind(handle: EngineHandle, pwuKind: string): string[] {
	const template = handle.ontology.pwuTemplates.find(
		(t) => (t as { pwuKind?: string }).pwuKind === pwuKind
	) as { defaultPolicyIds?: readonly string[] } | undefined;
	if (!template)
		throw new Error(
			`seedWorkbench: the ontology describes no PWU Type of kind "${pwuKind}", so its required assurance ` +
				`policies cannot be derived. Add a pwuTemplates row for it (grounded in the corpus) rather than ` +
				`letting the type ship declaring no policies — an unassessable type is invisible until §5.1 is enforced.`
		);
	return [...(template.defaultPolicyIds ?? [])];
}

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

/**
 * Create the 3 de minimis floor policies as canonical ASSURANCE_POLICY objects (guide §8.4/§8.9). These are
 * universal (every engine needs them for the floor gate), so this is safe to call on any engine.
 *
 * ── THE SCOPE, AND THE COMMENT THAT USED TO BE HERE (REG-F-024) ──────────────────────────────────────────────
 * This declared `['PROFESSIONAL_WORK_ARCHITECTURE']` and said why: *"the single-value applicableObjectTypes
 * limitation is §16-unresolved; the plane-agnostic array is a later reconciliation."* **There is no such
 * limitation and there never was.** The field is `z.array(ProfessionalWorkObjectTypeSchema)` — a required array of
 * the ratified 22-value enum — and `git log -S` puts that comment in the SAME commit as the code it describes, so
 * it was wrong when written rather than true-then-stale. The test fixture had already been seeding three types
 * for as long as it has existed, which is how the suite passed against a floor scoped more honestly than the one
 * that shipped.
 *
 * ── WHY BROAD, AND WHY DERIVED ───────────────────────────────────────────────────────────────────────────────
 * §16 item 23 IS open, and it is about this floor — but what it leaves unresolved is material-boundary
 * classification, not which object types a policy may name. Its own instruction settles the direction, verbatim:
 * **"Never interpret the missing wire shape as permission to omit or hide the floor."** A narrow scope citing the
 * unresolved wire shape is precisely that reading. §8.4 scopes the floor by *"every material professional
 * transformation"* and enumerates no object types at all.
 *
 * So the declaration is derived from the enum, not listed: a hand-written list goes stale the day a 23rd object
 * type is added, and it goes stale in the FORBIDDEN direction — silently exempting new work. The fixture's own
 * three-type list is the proof, since it was already missing EVIDENCE, which is what the reference undertaking
 * tripped on at step #47.
 *
 * ── AND IT REQUIRES NOTHING NEW ──────────────────────────────────────────────────────────────────────────────
 * `floor-gate.ts` never reads `applicableObjectTypes` or `applicability`; it requires the FLOOR_POLICY_IDS triple
 * outright. So the floor was ALREADY universal in enforcement and narrow only in declaration, and the two
 * disagreed. Broadening the declaration permits strictly more and requires strictly nothing more — which is what
 * makes this safe, and what made the 54 refusals a false declaration rather than a real scope conflict.
 * `floor-declared-scope.test.ts` holds declared ⊇ enforced so the two cannot part again.
 */
export function seedFloorPolicies(handle: EngineHandle): void {
	const send = sender(handle, 'seedpol');
	for (const def of FLOOR_POLICY_DEFINITIONS) {
		send('CreateAssurancePolicy', 'ASSURANCE_POLICY', def.policyId, {
			policyId: def.policyId,
			version: '1.0.0',
			name: def.name,
			purpose: def.purpose,
			rationale: def.rationale,
			applicableObjectTypes: [...ProfessionalWorkObjectTypeSchema.options],
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
			// REG-F-022 second instance, DELIVERED. `appliesToPwuKinds` is authored by every catalog policy and was
			// dropped here; DOC-004 §5.1's `pwuKindConditions` is its ratified home. Absent on a policy that
			// declares none → the field stays absent rather than becoming an empty array, because [] would read as
			// "applies to no PWU kind" and absent reads as "unrestricted", which is what the ontology means.
			applicability: {
				objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'],
				...(p.appliesToPwuKinds?.length ? { pwuKindConditions: [...p.appliesToPwuKinds] } : {})
			},
			evaluatedClaimTypes: p.evaluatedClaimTypes,
			// REG-F-022, DELIVERED (REG-E-026). The finding this register opened with: twelve policies state which
			// evidence they need, this payload named eleven fields and not that one, and so Gate A in
			// `completeAssuranceAssessment` — the refusal that stops a SATISFIED disposition standing on unmet
			// mandatory evidence — read `[]` on every policy the product can produce. A control whose population is
			// empty is a control that cannot fail.
			//
			// BOTH FIELDS, because DOC-004 §3.1 declares both and the catalog's own headings select between them:
			// §15.5 and §16.4 say "Required evidence" (13 items, and these GATE); §17.4-§26.4 say "Evidence"
			// (76 items, carried and ungated). Routing the 76 into `requiredEvidence` would make nine policies
			// unsatisfiable by any caller — which is why the split is asserted in doc004-conformance.test.ts rather
			// than trusted to whoever edits this line next.
			requiredEvidence: p.requiredEvidence,
			optionalEvidence: p.optionalEvidence,
			criteria: p.criteria,
			evaluatorRole: p.evaluatorRole,
			independenceRequirement: p.independenceRequirement,
			findingDefinitions: findingsFor(p, rawFindings(p)),
			permittedControlActions: p.permittedControlActions
		});
		// The ratified catalog is in force by definition, so the bootstrap activates it (DRAFT -> ACTIVE). Regular
		// policies are now born DRAFT (DOC-002 §18); the deliberate DRAFT->ACTIVE control is for user-authored policies,
		// not the seeded ratified catalog. Floor policies (seedFloorPolicies) are born ACTIVE + locked, so not here.
		send('ActivateAssurancePolicy', 'ASSURANCE_POLICY', p.policyId, { policyId: p.policyId });
	}
}

/**
 * The policy's ratified finding codes as the `{code, severity, statement}` triples `findingsFor` converts into
 * DOC-004 §9.1 FindingDefinitions (which derives each finding's affectedClaimTypes/defaultControlActions from the
 * policy itself, so a finding cannot claim an action its own policy forbids).
 *
 * The two fields §9.1 mandates and DOC-004 ratifies for almost none of its 99 codes (it binds `INTENT_EXPANSION`
 * to MATERIAL in §33's worked example; the corrected count is in ontology.types.ts) are resolved without inventing them:
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
			requiredAssurancePolicyIds: policiesForKind(handle, t.kind)
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
	// The undertaking's assessments are judged under the RATIFIED catalog's Fitness For Purpose policy
	// ("Determine whether the completed product is suitable for the actual approved user need") — seeded just
	// above from the DOC-004 catalog. Passing it means the demo EXERCISES the catalog rather than growing it:
	// the drive creates its own policy only when run standalone, and a 16th policy duplicating a ratified one is
	// exactly what the seeded-library test guards against.
	driveReferenceUndertaking(handle, {
		undertakingId: SEED_UNDERTAKING,
		pwuTypeByKind,
		assurancePolicyId: 'pol_fitness_for_purpose'
	});
}
