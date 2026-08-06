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

// Stable ids for the Product Realization PWA's PWU Types, keyed by KIND.
//
// ── THE ONLY HAND-WRITTEN THING LEFT, AND WHY (REG-F-033) ────────────────────────────────────────────────────
// The tree itself used to be a hand-written `PWU_TYPES` literal: the name, purpose and composition children of
// every type. `policiesForKind`'s comment already named that shape — "a THIRD copy of content the ontology
// already carries" — and fixed the POLICY list while leaving the COMPOSITION list. REG-F-033 measured the cost:
// the shipped tree CONTRADICTED the authored candidates (Architecture Definition authored ten children and
// shipped one that was not among them), and four further ontology fields reached nothing at all.
//
// Everything is now DERIVED from `handle.ontology.pwuTemplates`. Only the ids stay hand-assigned, because they
// are stable identity: deriving them would rename every PWU Type the moment a kind was renamed, and committed
// events reference them. A kind->id map is the smallest thing that cannot drift, and a missing entry is a hard
// failure below rather than a silently skipped type.
const PT_BY_KIND: Readonly<Record<string, string>> = {
	PRODUCT_REALIZATION: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Z20',
	INTENT_AND_PRODUCT_DEFINITION: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Z30',
	PRODUCT_BEHAVIOR_DEFINITION: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Z40',
	ARCHITECTURE_DEFINITION: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Z50',
	IMPLEMENTATION_PLANNING: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Z60',
	PRODUCT_IMPLEMENTATION: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Z70',
	INTEGRATED_PRODUCT_VALIDATION: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Z80',
	PRODUCT_BASELINE_PROMOTION: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5Z90',
	ARCHITECTURE_CONCERN: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5ZA0',
	// DEEPENING 2026-08-06 (sponsor direction). Six templates the ontology has always described and the PWA never
	// published, so the tree was two levels where the ontology describes three.
	INTENT_DISCOVERY: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5ZB0',
	PRODUCT_BOUNDARY: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5ZC0',
	USER_JOURNEY_DEFINITION: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5ZD0',
	REQUIREMENT_DEFINITION: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5ZE0',
	ARCHITECTURE_DECISION: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5ZF0',
	WORK_DECOMPOSITION: 'pwut_01ARZ3NDEKTSV4RRFFQ69G5ZG0'
};

/**
 * The DISPLAY NAME of a PWU Type, derived from its kind.
 *
 * ── WHY NOT `humanizeCode` ───────────────────────────────────────────────────────────────────────────────────
 * The first version of this derivation used it and QUIETLY RENAMED EVERY PUBLISHED TYPE: `humanizeCode` sentence-
 * cases ("Architecture definition") where the hand-written names were title-cased ("Architecture Definition").
 * Seventy-nine references across the suite depend on those names and three e2e specs went red — a user-facing
 * regression introduced by a refactor whose whole point was to change nothing but the SOURCE of the data.
 *
 * So the rule is title-case per underscore-separated word, with `AND` rendered `&` — which reproduces all nine
 * pre-existing names EXACTLY. `seed-workbench.test.ts` pins them, so a future change to this function that
 * renames a shipped type reddens instead of silently relabelling the workbench.
 */
function typeName(kind: string): string {
	return kind
		.split('_')
		.map((w) => (w === 'AND' ? '&' : w.charAt(0) + w.slice(1).toLowerCase()))
		.join(' ');
}

/** A PWU Type as the ontology describes it, resolved to ids. */
interface DerivedType {
	readonly id: string;
	readonly kind: string;
	readonly isRoot: boolean;
	readonly purpose: string;
	readonly children: readonly { readonly id: string; readonly kind: string }[];
	readonly requiredInputs: readonly string[];
	readonly requiredOutputs: readonly string[];
	readonly completionClaims: readonly string[];
}

/**
 * Derive the published PWU Types from the ontology.
 *
 * ── THE TREE IS `candidateChildren`, INTERSECTED WITH WHAT HAS A TEMPLATE ────────────────────────────────────
 * The ontology authors 63 candidate child kinds and 50 have NO `pwuTemplate` row. A kind with no template has no
 * `defaultPolicyIds`, and `requireGoverningPolicies` THROWS on an undescribed kind (REG-F-029) — so publishing
 * those 50 would mint child types that cannot be assessed and cannot be driven. The intersection is the honest
 * ceiling: it takes the tree from 9 types to 15 and from two levels to three, while the delivery census keeps
 * pinning the 50 rather than letting a deeper tree stand in for a coherent ontology.
 */
function derivedTypes(handle: EngineHandle): DerivedType[] {
	const templates = handle.ontology.pwuTemplates as readonly {
		pwuKind: string;
		isRoot?: boolean;
		purpose?: string;
		candidateChildren?: readonly string[];
		inputs?: readonly string[];
		outputArtifactTypes?: readonly string[];
		completionClaims?: readonly string[];
	}[];
	const idFor = (kind: string): string => {
		const id = PT_BY_KIND[kind];
		if (!id)
			throw new Error(
				`seedWorkbench: the ontology describes a PWU Type of kind "${kind}" with no stable id in ` +
					`PT_BY_KIND. Add one rather than letting the type go unpublished — a work area the ontology ` +
					`describes and the PWA omits is exactly the gap REG-F-033 measured.`
			);
		return id;
	};
	const described = new Set(templates.map((t) => t.pwuKind));
	const types = templates.map((t) => ({
		id: idFor(t.pwuKind),
		kind: t.pwuKind,
		isRoot: t.isRoot ?? false,
		purpose: t.purpose ?? typeName(t.pwuKind),
		children: (t.candidateChildren ?? [])
			.filter((c) => described.has(c))
			.map((c) => ({ id: idFor(c), kind: c })),
		requiredInputs: t.inputs ?? [],
		requiredOutputs: t.outputArtifactTypes ?? [],
		completionClaims: t.completionClaims ?? []
	}));
	// Root first — PublishPwa names types[0] as the root, and the ontology declares exactly one.
	const roots = types.filter((t) => t.isRoot);
	if (roots.length !== 1)
		throw new Error(
			`seedWorkbench: the ontology declares ${roots.length} root PWU Types, expected exactly 1.`
		);
	// ── ONLY WHAT THE ROOT CAN REACH (§11.6) ─────────────────────────────────────────────────────────────────
	// `ValidatePwa` refuses a composition with an orphan: "every type reachable from that root". The ontology
	// describes ARCHITECTURE_DECISION and names it in NO `candidateChildren` list, so publishing all fifteen is
	// REFUSED BY THE ENGINE — correctly. Parenting it by guess would be authoring composition structure the
	// ontology declined to state, so it stays unpublished and `ontology-delivery-census` NAMES it rather than
	// letting it disappear into a filter. The engine caught this independently of the design note predicting it.
	const byId = new Map(types.map((t) => [t.id, t]));
	const reachable = new Set([roots[0]!.id]);
	const queue = [roots[0]!];
	while (queue.length) {
		for (const c of queue.pop()!.children)
			if (!reachable.has(c.id)) {
				reachable.add(c.id);
				const child = byId.get(c.id);
				if (child) queue.push(child);
			}
	}
	return [roots[0]!, ...types.filter((t) => !t.isRoot && reachable.has(t.id))];
}

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
	const types = derivedTypes(handle);
	for (const t of types) {
		send('DefinePwuType', 'PWU_TYPE', t.id, {
			pwuTypeId: t.id,
			pwaId: SEED_PWA,
			pwuKind: t.kind,
			name: typeName(t.kind),
			purpose: t.purpose,
			isRoot: t.isRoot,
			permittedChildTypeIds: t.children.map((c) => c.id),
			// CARDINALITY IS AUTHORED, and narrowly. `candidateChildren` is a flat list carrying no cardinality, so
			// the root's seven canonical branches stay M1 (each happens exactly once in a product realization) and
			// every deeper child is C+ — conditional, one-or-more — which is what "candidate" means. Claiming M1
			// for a candidate would assert a mandate the ontology does not state.
			permittedChildren: t.children.map((c) => ({
				typeId: c.id,
				cardinality: t.isRoot ? 'M1' : 'C+'
			})),
			requiredAssurancePolicyIds: policiesForKind(handle, t.kind),
			// THE FOUR TEMPLATE FIELDS THAT REACHED NOTHING (REG-F-033), delivered into the ratified homes they
			// always had on PWU_TYPE. Absent stays absent: an empty array would read as "this type requires no
			// inputs", which is a claim, where omission is silence.
			...(t.requiredInputs.length ? { requiredInputs: [...t.requiredInputs] } : {}),
			...(t.requiredOutputs.length ? { requiredOutputs: [...t.requiredOutputs] } : {}),
			// TRANSFORMED, not verbatim: `completionClaims` is a string[] and `completionRule` a single string, so
			// the claims are rendered as an explicit CONJUNCTION — a completion rule over claims is exactly "all of
			// these hold" — with every claim retained rather than summarised away.
			...(t.completionClaims.length
				? { completionRule: 'All of: ' + t.completionClaims.join(' ') }
				: {})
		});
	}
	send('SubmitPwaForReview', 'PROFESSIONAL_WORK_ARCHITECTURE', SEED_PWA, {});
	send('ValidatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', SEED_PWA, {});
	send('PublishPwa', 'PROFESSIONAL_WORK_ARCHITECTURE', SEED_PWA, {
		rootPwuTypeId: types[0]!.id
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
	// The SAME derivation the publish loop used, so the instance-side kind->type map cannot name a type the PWA
	// did not publish.
	for (const t of derivedTypes(handle)) pwuTypeByKind[t.kind] = t.id;
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
