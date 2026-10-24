// ⭐⭐ `JAN-EXEC` Phase 7, the review in parts, B8a — REVIEWER-QUALIFICATION CASE SET, VERSION NINE (`REG-D-127`;
// DESIGN-authoring-review-in-parts.md D3a and §5, case set v9; ROADMAP-undertaking-execution-sandbox.md §9a.9a).
//
// VERSION EIGHT'S 41 NON-PART CASES, BYTE FOR BYTE, AND ITS 35 PART CASES UNDER THEIR IDS, EACH CUT WITH THE SEEDED POLICY
// LIBRARY. Version eight's measurement found two things the sponsor ruled fixed before P6 (`REG-D-127` Q33b):
//   · D3a, THE POLICIES NAMED (`REG-F-573`) — a part showed its declared policies as ids alone, and no list of the policies its
//     kind may take, so `G7-RR-02.T02`, Implementation with Test Adequacy removed, was answered SATISFIED twice. A part is now
//     cut with the policy library (`pwaTypeParts`): its declared policies named, and the ACTIVE non-floor policies its kind may
//     take listed. Each part case carries the library its materialization reads — the one the workbench seeds, as the
//     authoring surface's policy view reads it (`SEEDED_POLICY_LIBRARY`) — so the floor and the case read the same values.
//   · THE BRIDGE CASES RESTATED (`REG-F-572`) — the G3 graphs were authored for the whole-PWA review, their types carrying no
//     purpose, and their leaves were rejected in 7 of 12 clean evaluations as defining no work. Each bridge source is restated
//     as production stores a type it defines (`definePwuType`; the cases test's `asStored`): a purpose for each type, no
//     declared policy, no child rule, the completion rule a type defined without one is stored with, and a delegated type's
//     boundary contract. G3-CLEAN's seven purposes match its own account and the request; the renamed copies carry them
//     unchanged; each planted twin is G3-CLEAN restated but where its plant is, under one rule for every twin: a type keeps
//     G3-CLEAN's purpose while it is still true of it, and a type its plant gives other work, in the twin's graph and its
//     account alike, says that work as the twin's account states it (`RESTATED_PLANTS_V9`).
// ⛔ THE 35 PART CASES KEEP THEIR IDS, THEIR ORDER AND THEIR ORACLES: every expected verdict, faulted criterion, catcher and
// standing is version eight's (`REG-D-126`). The restated bridge cases await the sponsor's confirmation of their restatement
// before measurement (`oracles-v9.ts`). Their prompts are new, and owe a RUN.
// ⛔ A CASE IS DATA: the library and every purpose below are literals, and no runtime import reaches a package (`cases.ts`).
// Generated into `docs/tracking/reviewer-qualification/cases/` by `generate.ts`; the JSON is never hand-edited.
import type { AssurancePolicyView } from '@janumipwb/rph-authoring';
import type { PwaGraphBoundaryContract, PwaGraphNode } from '@janumipwb/rph-projections';
import { CASE_SET_V7 } from './case-set-v7.js';
import { CASE_SET_V8 } from './case-set-v8.js';
import type { CaseSet, GraphCase, PwaTypeCase } from './cases.js';

/**
 * ⭐ D3a — THE POLICY LIBRARY THE WORKBENCH SEEDS (`seedPolicyLibrary`), as the authoring surface's policy view reads it
 * (`rph-authoring` `assurancePolicyViews`), in its order: the three floor policies, then the catalog's twelve, each ACTIVE.
 * ⚠ Written out, not read: a case is data. The cases test holds it to the view over a seeded engine, value for value.
 */
export const SEEDED_POLICY_LIBRARY: readonly AssurancePolicyView[] = [
	{
		id: 'floor.schema-invariant',
		name: 'Output Contract & Invariant Integrity',
		purpose: 'Every material output conforms to its object contract/schema and all applicable deterministic invariants.',
		version: '1.0.0',
		status: 'ACTIVE',
		isFloor: true
	},
	{
		id: 'floor.identity-provenance',
		name: 'Identity, Provenance & Trace Completeness',
		purpose: 'Every material output carries a stable identity, semantic version, provenance, producing actor, and complete trace.',
		version: '1.0.0',
		status: 'ACTIVE',
		isFloor: true
	},
	{
		id: 'floor.reasoning-review',
		name: 'Reasoning Review',
		purpose:
			'Every material AI/agent output genuinely discharges its delegated professional obligation rather than producing a plausible substitute that conceals the underlying problem.',
		version: '1.0.0',
		status: 'ACTIVE',
		isFloor: true
	},
	{
		id: 'pol_intent_fidelity',
		name: 'Intent Fidelity',
		purpose:
			'Determine whether formalized Product Intent faithfully represents the user’s originating expression, authorized clarifications, accepted constraints, and explicitly approved scope changes.',
		version: '1.0.0',
		status: 'ACTIVE',
		isFloor: false,
		pwuKinds: ['INTENT_AND_PRODUCT_DEFINITION', 'INTENT_DISCOVERY', 'PRODUCT_BOUNDARY', 'PRODUCT_REALIZATION']
	},
	{
		id: 'pol_intent_completeness',
		name: 'Intent Completeness',
		purpose:
			'Determine whether the current Product Intent contains enough explicit structure for the next authorized professional activity. Completeness is proportional to risk, consequence, uncertainty, and irreversibility.',
		version: '1.0.0',
		status: 'ACTIVE',
		isFloor: false,
		pwuKinds: ['INTENT_AND_PRODUCT_DEFINITION', 'PRODUCT_BOUNDARY']
	},
	{
		id: 'pol_assumption_disclosure',
		name: 'Assumption Disclosure',
		purpose:
			'Identify premises that materially affect the validity of work but have not been established as facts, constraints, or authorized decisions.',
		version: '1.0.0',
		status: 'ACTIVE',
		isFloor: false,
		pwuKinds: [
			'INTENT_AND_PRODUCT_DEFINITION',
			'PRODUCT_BEHAVIOR_DEFINITION',
			'ARCHITECTURE_DEFINITION',
			'ARCHITECTURE_DECISION',
			'IMPLEMENTATION_PLANNING',
			'WORK_DECOMPOSITION',
			'PRODUCT_IMPLEMENTATION',
			'INTEGRATED_PRODUCT_VALIDATION',
			'INTENT_DISCOVERY'
		]
	},
	{
		id: 'pol_requirement_coverage',
		name: 'Requirement Coverage',
		purpose:
			'Determine whether approved outcomes, capabilities, journeys, constraints, and operational needs are represented by requirements or explicitly excluded.',
		version: '1.0.0',
		status: 'ACTIVE',
		isFloor: false,
		pwuKinds: ['PRODUCT_BEHAVIOR_DEFINITION', 'USER_JOURNEY_DEFINITION', 'REQUIREMENT_DEFINITION']
	},
	{
		id: 'pol_decomposition_coverage',
		name: 'Decomposition Coverage',
		purpose: "Determine whether child PWUs collectively preserve and cover the parent PWU's obligations.",
		version: '1.0.0',
		status: 'ACTIVE',
		isFloor: false,
		pwuKinds: ['ARCHITECTURE_DEFINITION', 'IMPLEMENTATION_PLANNING', 'WORK_DECOMPOSITION', 'PRODUCT_REALIZATION']
	},
	{
		id: 'pol_constraint_propagation',
		name: 'Constraint Propagation',
		purpose: 'Determine whether constraints remain enforceable as work is decomposed, delegated, transformed, or revised.',
		version: '1.0.0',
		status: 'ACTIVE',
		isFloor: false,
		pwuKinds: ['IMPLEMENTATION_PLANNING', 'WORK_DECOMPOSITION']
	},
	{
		id: 'pol_architecture_coverage',
		name: 'Architecture Coverage',
		purpose: 'Determine whether the architecture provides a coherent structure for satisfying applicable product obligations.',
		version: '1.0.0',
		status: 'ACTIVE',
		isFloor: false,
		pwuKinds: ['ARCHITECTURE_DEFINITION', 'ARCHITECTURE_CONCERN']
	},
	{
		id: 'pol_historical_consistency',
		name: 'Historical Consistency',
		purpose:
			'Determine whether current work repeats known failure, conflicts with an active decision, ignores recorded rationale, or diverges from precedent without explanation.',
		version: '1.0.0',
		status: 'ACTIVE',
		isFloor: false,
		pwuKinds: ['ARCHITECTURE_DECISION']
	},
	{
		id: 'pol_intent_preservation',
		name: 'Intent Preservation',
		purpose: 'Determine whether a transformation of professional work remains faithful to the authorized intent.',
		version: '1.0.0',
		status: 'ACTIVE',
		isFloor: false,
		pwuKinds: [
			'PRODUCT_BEHAVIOR_DEFINITION',
			'ARCHITECTURE_DEFINITION',
			'IMPLEMENTATION_PLANNING',
			'WORK_DECOMPOSITION',
			'PRODUCT_IMPLEMENTATION',
			'INTEGRATED_PRODUCT_VALIDATION',
			'PRODUCT_BASELINE_PROMOTION',
			'PRODUCT_REALIZATION',
			'USER_JOURNEY_DEFINITION',
			'REQUIREMENT_DEFINITION'
		]
	},
	{
		id: 'pol_test_adequacy',
		name: 'Test Adequacy',
		purpose: 'Determine whether the available tests are sufficient to support the claims being made.',
		version: '1.0.0',
		status: 'ACTIVE',
		isFloor: false,
		pwuKinds: ['PRODUCT_IMPLEMENTATION', 'INTEGRATED_PRODUCT_VALIDATION']
	},
	{
		id: 'pol_fitness_for_purpose',
		name: 'Fitness For Purpose',
		purpose: 'Determine whether the completed product is suitable for the actual approved user need.',
		version: '1.0.0',
		status: 'ACTIVE',
		isFloor: false,
		pwuKinds: ['INTEGRATED_PRODUCT_VALIDATION', 'PRODUCT_REALIZATION', 'PRODUCT_BASELINE_PROMOTION']
	},
	{
		id: 'pol_baseline_promotion',
		name: 'Baseline Promotion',
		purpose: 'Determine whether candidate work may become an authoritative baseline.',
		version: '1.0.0',
		status: 'ACTIVE',
		isFloor: false,
		pwuKinds: ['PRODUCT_BASELINE_PROMOTION']
	}
];

// ── the bridge cases, restated (`REG-F-572`) ───────────────────────────────────────────────────────────────────────────────
/** The graph cases of version seven, by id — the sources version eight's bridge part cases were cut from. */
const V7_GRAPHS: ReadonlyMap<string, GraphCase> = new Map(
	CASE_SET_V7.cases.filter((c): c is GraphCase => c.arm === 'PWA_GRAPH').map((c) => [c.id, c])
);
const v7Graph = (id: string): GraphCase => {
	const c = V7_GRAPHS.get(id);
	if (c === undefined) throw new Error(`no graph case ${id} in version seven`);
	return c;
};

/** The completion rule `definePwuType` stores for a type defined with none — as every bridge type was. */
const DEFINED_COMPLETION_RULE = 'Execution succeeded AND required outputs exist AND assurance satisfied';
/** The boundary contract the bridge's delegated check is defined with: the firm that carries it out, attesting no policy. */
const CHECKING_FIRM: PwaGraphBoundaryContract = { counterpartyLabel: 'An independent checking firm', attestedAssurancePolicyIds: [] };

/** G3-CLEAN's seven types, in its export order, each by its id. */
const [ROOT, SURVEY, OPTIONS, LOAD, DESIGN, CHECK, PERMIT] = v7Graph('G3-CLEAN').input.nodes.map((n) => n.id);

/**
 * ⭐ G3-CLEAN'S SEVEN PURPOSES, by type id — each the work its own account says the type does, in the request's terms, adding
 * and removing no obligation the account states. The renamed copies' types carry the same ids, and so the same purposes.
 */
const CLEAN_PURPOSES: ReadonlyMap<string, string> = new Map([
	[
		ROOT!,
		'Carry out the structural review of the 40 m single-span steel pedestrian bridge over the two-track rail line, each ' +
			'obligation of the instruction by a type of its own: the site and geotechnical survey, the selection of a structural ' +
			'form after comparing the viable options, the load analysis to the Eurocodes, the member, connection and foundation ' +
			'design, the independent design check by a firm that took no part in the design, and the permit submission to the ' +
			'rail authority.'
	],
	[SURVEY!, 'Survey the site of the crossing and investigate its ground, producing the site survey and the geotechnical report.'],
	[OPTIONS!, 'Compare the viable structural forms for the bridge against the site survey and the geotechnical report, and select one.'],
	[
		LOAD!,
		'Analyse the selected structural form to the Eurocodes for pedestrian, wind and pedestrian-induced vibration loading, ' +
			'with the foundation stiffness the geotechnical report gives in its dynamic model, producing the load model.'
	],
	[
		DESIGN!,
		'Design the bridge’s steel members, its connections and its foundations from the load model and the geotechnical ' +
			'report, producing the design calculations and the general arrangement drawings.'
	],
	[
		CHECK!,
		'Check the bridge’s design independently, by a firm that took no part in the design, as the rail authority requires, ' +
			'certifying the design calculations and drawings.'
	],
	[
		PERMIT!,
		'Make the permit submission to the rail authority once the independent check has certified the design, with the ' +
			'geotechnical report and the design calculations.'
	]
]);

/**
 * ⭐ THE PLANTED TYPES' PURPOSES (`REG-D-127`: "The planted type's purpose is consistent with its plant") — for each planted
 * twin, each type whose purpose its plant changes, by its name in that twin, and the purpose it carries: the work the twin's
 * own account says it does. ONE RULE FOR EVERY TWIN: a type keeps G3-CLEAN's purpose while that purpose is still true of it,
 * and a type its plant gives other work — in the twin's graph and its account alike — carries that work as the account states
 * it; a root's work is its children's, as its purpose lists them, so a root is here where its plant changes its children or
 * the work of one its purpose lists. A plant that sets the account against the graph stays where version seven put it, and no
 * purpose takes the account's side: G3-RR-06's and G3-RR-08's design, whose accounts say it works from the load model while
 * their graphs give it the geotechnical report too, and G3-RR-09's check, whose account calls every type complete while its
 * graph gives the check no output, are not here. Every type of a twin not here carries G3-CLEAN's purpose for its id.
 * Descriptive and used: `restated` reads it, and the cases test holds it to the purposes the sponsor is shown and each twin's
 * every difference from G3-CLEAN to its plant.
 */
export const RESTATED_PLANTS_V9: readonly { readonly source: string; readonly type: string; readonly purpose: string }[] = [
	// G-RR-01: a concept study in place of the structural review — its root and its three children are the plant.
	{
		source: 'G-RR-01',
		type: 'Pedestrian Bridge Concept Study',
		purpose:
			'Deliver the bridge review as a concept study: establish the bridge’s appearance, show it in its setting, and confirm ' +
			'through public consultation that the bridge is acceptable.'
	},
	{ source: 'G-RR-01', type: 'Visual Concept', purpose: 'Establish the bridge’s appearance in concept sketches.' },
	{
		source: 'G-RR-01',
		type: 'Photorealistic Renderings',
		purpose: 'Show the bridge in its setting in photorealistic renderings made from the concept sketches.'
	},
	{
		source: 'G-RR-01',
		type: 'Public Consultation',
		purpose: 'Confirm with the public, from the renderings, that the bridge is acceptable, in a consultation report.'
	},
	// G3-RR-02: the independent check absent, and the permit submission made on the design directly — the root lists no check,
	// as its account does not.
	{
		source: 'G3-RR-02',
		type: 'Pedestrian Bridge Structural Review',
		purpose:
			'Carry out the structural review of the 40 m single-span steel pedestrian bridge over the two-track rail line, each ' +
			'obligation of the instruction by a type of its own: the site and geotechnical survey, the selection of a structural ' +
			'form after comparing the viable options, the load analysis to the Eurocodes, the member, connection and foundation ' +
			'design, and the permit submission to the rail authority.'
	},
	{
		source: 'G3-RR-02',
		type: 'Rail Authority Permit Submission',
		purpose:
			'Make the permit submission to the rail authority once the design is complete, with the design calculations, the ' +
			'drawings and the geotechnical report.'
	},
	// G3-RR-03: the load analysis narrowed to the static pedestrian load.
	{
		source: 'G3-RR-03',
		type: 'Load Analysis (static pedestrian load)',
		purpose: 'Analyse the selected structural form to the Eurocodes for the static pedestrian load only, producing the load model.'
	},
	// G3-RR-04: the load analysis without vibration, and a compliance statement standing in for it — the root lists the
	// statement among its children's work, as its account does.
	{
		source: 'G3-RR-04',
		type: 'Pedestrian Bridge Structural Review',
		purpose:
			'Carry out the structural review of the 40 m single-span steel pedestrian bridge over the two-track rail line, each ' +
			'obligation of the instruction by a type of its own: the site and geotechnical survey, the selection of a structural ' +
			'form after comparing the viable options, the load analysis to the Eurocodes, the statement recording that the bridge ' +
			'complies with the comfort criteria for pedestrian-induced vibration, the member, connection and foundation design, ' +
			'the independent design check by a firm that took no part in the design, and the permit submission to the rail ' +
			'authority.'
	},
	{
		source: 'G3-RR-04',
		type: 'Load Analysis (pedestrian, wind)',
		purpose: 'Analyse the selected structural form to the Eurocodes for pedestrian and wind loading, producing the load model.'
	},
	{
		source: 'G3-RR-04',
		type: 'Vibration Compliance Statement',
		purpose: 'Record that the bridge complies with the comfort criteria for pedestrian-induced vibration.'
	},
	// G3-RR-05: the form fixed at the outset, so the root lists no comparison of options and the analysis is of the
	// cable-stayed deck.
	{
		source: 'G3-RR-05',
		type: 'Pedestrian Bridge Structural Review',
		purpose:
			'Carry out the structural review of the 40 m single-span steel pedestrian bridge over the two-track rail line, its ' +
			'structural form fixed at the outset as a cable-stayed deck, each obligation of the instruction by a type of its own: ' +
			'the site and geotechnical survey, the load analysis to the Eurocodes, the member, connection and foundation design, ' +
			'the independent design check by a firm that took no part in the design, and the permit submission to the rail ' +
			'authority.'
	},
	{
		source: 'G3-RR-05',
		type: 'Load Analysis (pedestrian, wind, vibration)',
		purpose:
			'Analyse the cable-stayed deck to the Eurocodes for pedestrian, wind and pedestrian-induced vibration loading, with the ' +
			'foundation stiffness the geotechnical report gives in its dynamic model, producing the load model.'
	},
	// G3-RR-07: the check carried out within the design team — and so the root, whose purpose lists each child's work, lists
	// the check as its account describes it, no longer by a firm that took no part in the design.
	{
		source: 'G3-RR-07',
		type: 'Pedestrian Bridge Structural Review',
		purpose:
			'Carry out the structural review of the 40 m single-span steel pedestrian bridge over the two-track rail line, each ' +
			'obligation of the instruction by a type of its own: the site and geotechnical survey, the selection of a structural ' +
			'form after comparing the viable options, the load analysis to the Eurocodes, the member, connection and foundation ' +
			'design, the design check within the design team by its senior design engineer, and the permit submission to the ' +
			'rail authority.'
	},
	{
		source: 'G3-RR-07',
		type: 'Design Self-Check by the Senior Design Engineer',
		purpose:
			'Check the bridge’s design within the design team, by its senior design engineer, who knows the design best, ' +
			'certifying the design calculations and drawings.'
	}
];

/**
 * A bridge type as `definePwuType` stores one defined with a purpose and nothing else it declares: its structure, its purpose,
 * no declared policy, no child rule, the stored completion rule, and, delegated, its boundary contract — each key where
 * `buildPwaExport` writes it.
 */
const asDefined = (n: PwaGraphNode, purpose: string): PwaGraphNode => ({
	id: n.id,
	name: n.name,
	pwuKind: n.pwuKind,
	isRoot: n.isRoot,
	permittedChildTypeIds: n.permittedChildTypeIds,
	requiredInputs: n.requiredInputs,
	requiredOutputs: n.requiredOutputs,
	executionBoundary: n.executionBoundary,
	purpose,
	requiredAssurancePolicyIds: [],
	permittedChildren: [],
	completionRule: DEFINED_COMPLETION_RULE,
	...(n.executionBoundary === 'DELEGATED_EXTERNAL' ? { boundaryContract: CHECKING_FIRM } : {})
});

/** A bridge source of version seven, restated: each type as defined, its purpose its plant's or G3-CLEAN's for its id. */
function restated(sourceId: string): GraphCase {
	const source = v7Graph(sourceId);
	const plants = new Map(RESTATED_PLANTS_V9.filter((r) => r.source === sourceId).map((r) => [r.type, r.purpose]));
	for (const type of plants.keys())
		if (!source.input.nodes.some((n) => n.name === type)) throw new Error(`${sourceId} has no type named ${type}`);
	const nodes = source.input.nodes.map((n) => {
		const purpose = plants.get(n.name) ?? CLEAN_PURPOSES.get(n.id);
		if (purpose === undefined) throw new Error(`${sourceId}: no purpose for ${n.name}`);
		return asDefined(n, purpose);
	});
	return { ...source, input: { ...source.input, nodes } };
}

/** ⭐ THE BRIDGE SOURCES, RESTATED: G3-CLEAN, its three renamed copies, and its nine planted twins, in version seven's order. */
export const BRIDGE_GRAPHS_V9: readonly GraphCase[] = [
	'G3-CLEAN',
	'G3-CLEAN-R1',
	'G3-CLEAN-R2',
	'G3-CLEAN-R3',
	'G-RR-01',
	'G3-RR-02',
	'G3-RR-03',
	'G3-RR-04',
	'G3-RR-05',
	'G3-RR-06',
	'G3-RR-07',
	'G3-RR-08',
	'G3-RR-09'
].map(restated);

// ── the part cases ─────────────────────────────────────────────────────────────────────────────────────────────────────
const BRIDGES: ReadonlyMap<string, GraphCase> = new Map(BRIDGE_GRAPHS_V9.map((c) => [c.id, c]));

/**
 * One of version eight's part cases, carried: its id, arm, source and subject unchanged; its input its source's — restated, for
 * a bridge case — its type, and the seeded library its part is cut with.
 */
function carried(c: PwaTypeCase): PwaTypeCase {
	const bridge = BRIDGES.get(c.sourceCaseId);
	return {
		...c,
		input: {
			...(bridge === undefined ? c.input : { typeId: c.input.typeId, ...bridge.input }),
			policyLibrary: SEEDED_POLICY_LIBRARY
		}
	};
}

const PART_CASES_V9: readonly PwaTypeCase[] = CASE_SET_V8.cases
	.filter((c): c is PwaTypeCase => c.arm === 'PWA_TYPE')
	.map(carried);

export const CASE_SET_V9: CaseSet = {
	note:
		'GENERATED by `bun run scripts/reviewer-qual/generate.ts` from scripts/reviewer-qual/case-set-v9.ts — never ' +
		'hand-edited. Reviewer-qualification cases, version nine (JAN-EXEC Phase 7, the review in parts, B8a; REG-D-127): ' +
		'version eight’s 41 non-part cases, unchanged and under their ids, then its 35 PWA_TYPE part cases under their ids, each ' +
		'cut with the policy library the workbench seeds, which it carries (design D3a: each part names its declared policies and ' +
		'lists the ACTIVE non-floor policies its kind may take). The 19 cut from the bridge cases are cut from their sources ' +
		'restated as production stores a type it defines: a purpose for each type, no declared policy, no child rule, the stored ' +
		'completion rule, and the delegated check’s boundary contract; each planted twin is G3-CLEAN restated but where its ' +
		'plant is. Oracles are versioned separately, in ../oracles/. Oracle integrity: no increment that edits the reviewer’s ' +
		'prompt, criteria or scoring edits these cases.',
	caseSetVersion: 9,
	cases: [...CASE_SET_V8.cases.filter((c) => c.arm !== 'PWA_TYPE'), ...PART_CASES_V9]
};
