// Single source for PWU Type authoring: (a) field HELP so every surface (the node-graph inspector form AND the
// agent's tool schemas) explains the fields, and (b) a copy-on-use CATALOG of reusable PWU Type blueprints (the
// Product Realization PWA's §7 work areas — the seed "PWU library"). The engine's DefinePwuType / EditPwuType
// accept all of these fields; "start from template" simply pre-fills them, and the engine copy is fully editable
// afterward (no cross-PWA coupling). This module is PURE (no engine import: its one import is the work-unit marker
// list, from `rph-application`'s pure `execution-invocation` module through that package's own subpath) so it is
// browser-safe and is exported from the "@janumipwb/rph-authoring/catalog" subpath — importing it never drags the
// Node engine into a browser bundle.
import { WORK_UNIT_MARKERS } from '@janumipwb/rph-application/execution-invocation';

/**
 * ⭐ `REG-F-507` remedy 2 (`REG-D-121` Q18) — THE MARKERS A WORK UNIT SUPPLIES ITS PROMPT, read from the engine's one
 * render map (`WORK_UNIT_MARKERS`), so the help both authors read, the designer form and the agent's instructions name
 * what a unit fills and cannot name another. Written as they name it: "{subject}, {title}, {description} and {purpose}".
 */
export { WORK_UNIT_MARKERS };
const BRACED = WORK_UNIT_MARKERS.map((m) => `{${m}}`);
export const WORK_UNIT_MARKER_LIST: string =
	BRACED.length > 1 ? `${BRACED.slice(0, -1).join(', ')} and ${BRACED.at(-1)}` : (BRACED[0] ?? '');

/** ⭐ `REG-F-507` — the markers among `markers` that no work unit supplies: a step using one is refused at render. */
export function markersNoWorkUnitSupplies(markers: readonly string[]): string[] {
	return markers.filter((m) => !WORK_UNIT_MARKERS.includes(m));
}

export const PWU_TYPE_HELP = {
	name: 'The human name of this reusable PWU Type (e.g. "Architecture Definition").',
	pwuKind:
		'A SCREAMING_SNAKE token classifying the work (e.g. ARCHITECTURE). Every Instance of this type carries this kind.',
	purpose: 'One or two sentences on what work of this type accomplishes and what it produces.',
	isRoot:
		'Exactly one type in a PWA is the root — the top of every Undertaking’s Professional Work Graph. Publishing requires a root.',
	// ⛔ EG-06: this said *"When an Instance of this type is DONE … (no green without assurance)"*. Nothing
	// evaluates it — all 39 production sites are a schema entry, an assignment, a presence guard or a stored
	// default. *"No green without assurance"* IS a real guarantee, made by `requireGoverningPolicies` and the
	// locked floor and keyed on `pwuKind` + `requiredAssurancePolicyIds` — NOT by this box. Attaching a true
	// guarantee to an inert field is worse than saying nothing: it is a reason to trust it.
	completionRule:
		'Your statement of when work of this type is DONE. RECORDED AND SHOWN, not evaluated — no gate reads it, ' +
		'and editing it changes no outcome. What actually holds a PWU back is its assurance: the locked floor plus ' +
		'the policies selected by this type\u2019s kind and declared policy ids.',
	// ⛔⛔ EG-06 DELETED `permittedChildTypeIds` FROM THIS MAP. It was authored, corrected, and read by
	// NOBODY: cross-tabulated against both consumers, it was the one key of fourteen that neither the form
	// renders nor the agent's tool schema names (12 of the other 13 are used by both, which is the positive
	// control). Its control is described by `permittedChildren` above, which IS rendered, so the admission was
	// folded there rather than corrected in a string no professional could reach.
	// ⭐ FOUND BY THE E2E, NOT BY THE UNIT GATE — the assertion that a person can SEE the text is what failed.
	permittedChildren:
		'The child types this one is composed of, each with a cardinality. Used to BUILD the initial graph when ' +
		'an Undertaking is instantiated, and to warn when a type is unreachable from the root. ⚠ IT IS NOT AN ' +
		'ALLOW-LIST: nothing refuses a decomposition into a type outside it. ' +
		'⚠ ONLY THE MANDATORY/CONDITIONAL SPLIT IS ENFORCED. M1 and M+ both instantiate the child; C1 and C+ ' +
		'both record it as an offer and instantiate nothing. The upper bound is NOT enforced — \u201cexactly one\u201d ' +
		'and \u201cone or more\u201d behave identically, and an unrecognised code is silently read as M1. ' +
		'The applicabilityNote is free text saying WHEN a conditional child applies; it is shown, never evaluated.',
	requiredAssurancePolicyIds:
		'Ids of ACTIVE non-floor assurance policies future Instances of this type MUST satisfy (declared/required treatment, §11.7.4) — e.g. Requirement Coverage or Intent Preservation. DRAFT, SUSPENDED, SUPERSEDED, missing, and locked-floor ids are rejected when newly added. This is required treatment, not a runtime assessment; the locked de-minimis floor always applies on top and is never listed here.',
	requiredInputs:
		'Named artifacts this type of work CONSUMES (e.g. "approved-behavior"). A matching output declares a compatible artifact hand-off; it does not establish execution order.',
	requiredOutputs:
		'Named artifacts this type of work PRODUCES (e.g. "architecture-baseline"). A type with a matching required input can consume that artifact; this compatibility does not establish temporal order.',
	executionBoundary:
		'Where this type’s work is discharged. INTERNAL (default) = inside your accountability scope, decomposed/executed under the platform assurance floor. DELEGATED_EXTERNAL = handed to an external party across an organizational boundary; the node is then TERMINAL (it declares NO child types) and instead carries a boundaryContract. Use DELEGATED_EXTERNAL for a whole unit of work you contract out and only receive a result from — not for work you still own and decompose.',
	counterpartyLabel:
		'For a DELEGATED_EXTERNAL type: the external party that performs the work (e.g. "Contract Lab — Hematology"). Required when delegating — it names who is accountable across the boundary.',
	attestedAssurancePolicyIds:
		'For a DELEGATED_EXTERNAL type: ids of ACTIVE non-floor assurance policies the counterparty ATTESTS it ' +
		'satisfies. This is the counterparty\u2019s CLAIM, not your own review — disclosure is not verification. ' +
		'Same id rules as requiredAssurancePolicyIds (locked-floor, DRAFT, SUSPENDED and missing ids are rejected). ' +
		'⚠ BEYOND THAT ID CHECK IT CHANGES NO OUTCOME: nothing at Undertaking or assessment time reads these ids, ' +
		'and the delegated-boundary banner appears whether the list is full or empty. May be empty.',
	// ⛔ EG-06: THESE THREE LIVED AS INLINE LITERALS IN THE MARKUP while their twelve siblings were
	// single-sourced here — two vocabularies for one form, and the three the agent's tool schema cannot see.
	workDischarge:
		'A person, a model, or not yet decided. Choosing \u201ca model\u201d means this type carries the prompt the ' +
		'model is given — and an unanswered question is shown as unanswered rather than assumed. ⚠ It is also what ' +
		'lets an execution step request a runtime binding: only a MODEL type gets one.',
	promptTemplateText:
		'What an agent is told when this type is executed. Use markers, a name in braces, for values supplied at run ' +
		`time: a work unit supplies ${WORK_UNIT_MARKER_LIST}, and a marker nothing supplies refuses the step rather ` +
		'than rendering empty.',
	// ⛔ EG-06: this said *"An answer that does not match is inert — it creates no findings and changes
	// nothing"*, and BOTH limbs were wrong. There is no matcher at all — `work-product-floor.ts` says so
	// itself: *"`PromptTemplate.outputContract` is FREE TEXT … not machine-checkable, so contract conformance
	// cannot be decided today."* And an answer that cannot be located DOES create a finding
	// (`WORK_PRODUCT_NOT_PARSEABLE`), so it is not inert either.
	// ⛔ EG-07b ADDED THIS KEY. EG-06 measured it absent while its explanation lived inline in the markup on a
	// bare <label> — which the single-source limb structurally cannot see, since that limb only inspects
	// {@render fhead(...)} calls. It is needed here because the agent's tool schema can only describe a
	// parameter with a string this map carries.
	promptActive:
		'Whether this template is ARMED. A DRAFT template is authored text and renders nothing — the step that ' +
		'would use it is refused. ACTIVE is the instruction the model is actually given. A type must declare ' +
		'MODEL to arm one: the engine refuses an ACTIVE template on work discharged any other way.',
	promptOutputContract:
		'What a usable answer looks like. This text is APPENDED VERBATIM to the instruction the model receives, ' +
		'so changing it changes the work — but nothing compares the answer back against it. Contract conformance ' +
		'is not machine-checked today.',
	boundaryApplicabilityNote:
		'For a DELEGATED_EXTERNAL type: free-text scope/condition of the delegation (e.g. "STAT panels only; routine handled internally"). Optional.'
} as const;

export interface PwuTypeTemplate {
	readonly key: string;
	readonly name: string;
	readonly pwuKind: string;
	readonly purpose: string;
	readonly isRoot: boolean;
	/**
	 * JAN-DISCHARGE — who does this work. ⭑ REQUIRED HERE, AND OPTIONAL ON THE OBJECT, DELIBERATELY. The object
	 * must tolerate absence (`PER-2`: types authored before the question existed were never asked). A BLUEPRINT
	 * has no such excuse — it is written today, and a new one that omits the answer would hand every type
	 * copied from it an unanswered question nobody was even shown. Requiring it here is the structural version
	 * of "the blueprints get real answers".
	 *
	 * ⚠ AND EVERY ONE OF THEM SAYS `UNDECLARED`, WHICH IS AN ANSWER RATHER THAN A DODGE. `JAN-DISCHARGE`'s
	 * roadmap said "an unanswered blueprint is the defect propagating"; that was WRONG and is corrected here.
	 * The defect was AMBIGUITY — one silence standing for "a person does it", "a model does it" and "nobody
	 * decided". A blueprint cannot know which of those holds for a given organisation's Intent Definition, and
	 * guessing would put an answer in the professional's mouth. `UNDECLARED` removes the ambiguity and hands
	 * over a VISIBLE open question, which is exactly what this field was added to do.
	 */
	readonly workDischarge: 'MODEL' | 'HUMAN' | 'UNDECLARED';
	/** Named artifacts an Instance of this type consumes (concern-3 data-flow) — a starting point, fully editable. */
	readonly requiredInputs?: readonly string[];
	/** Named artifacts an Instance of this type produces (concern-3 data-flow) — a starting point, fully editable. */
	readonly requiredOutputs?: readonly string[];
}

/** Curated, copy-on-use PWU Type blueprints — the Product Realization PWA's §7 work areas. The requiredInputs /
 *  requiredOutputs sketch the canonical hand-offs so a scaffolded graph shows data-flow edges out of the box. */
export const PWU_TYPE_CATALOG: readonly PwuTypeTemplate[] = [
	{
		key: 'product-realization',
		name: 'Product Realization',
		pwuKind: 'PRODUCT_REALIZATION',
		isRoot: true,
		workDischarge: 'UNDECLARED',
		purpose: 'Root: structure product work from originating intent to authoritative baselines.',
		requiredInputs: ['originating-intent'],
		requiredOutputs: ['authoritative-baseline']
	},
	{
		key: 'intent-definition',
		name: 'Intent & Product Definition',
		pwuKind: 'INTENT_AND_PRODUCT_DEFINITION',
		isRoot: false,
		workDischarge: 'UNDECLARED',
		purpose: 'Originating intent, stakeholders, product boundary.',
		requiredInputs: ['originating-intent'],
		requiredOutputs: ['product-definition']
	},
	{
		key: 'product-behavior',
		name: 'Product Behavior Definition',
		pwuKind: 'PRODUCT_BEHAVIOR_DEFINITION',
		isRoot: false,
		workDischarge: 'UNDECLARED',
		purpose: 'Actors, capabilities, journeys, requirements.',
		requiredInputs: ['product-definition'],
		requiredOutputs: ['approved-behavior']
	},
	{
		key: 'architecture',
		name: 'Architecture Definition',
		pwuKind: 'ARCHITECTURE_DEFINITION',
		isRoot: false,
		workDischarge: 'UNDECLARED',
		purpose: 'A coherent technical structure realizing approved behavior.',
		requiredInputs: ['approved-behavior'],
		requiredOutputs: ['architecture-baseline']
	},
	{
		key: 'implementation-planning',
		name: 'Implementation Planning',
		pwuKind: 'IMPLEMENTATION_PLANNING',
		isRoot: false,
		workDischarge: 'UNDECLARED',
		purpose: 'Increments, decomposition, dependencies, test + migration planning.',
		requiredInputs: ['architecture-baseline'],
		requiredOutputs: ['implementation-plan']
	},
	{
		key: 'product-implementation',
		name: 'Product Implementation',
		pwuKind: 'PRODUCT_IMPLEMENTATION',
		isRoot: false,
		workDischarge: 'UNDECLARED',
		purpose: 'Realize the planned increments.',
		requiredInputs: ['implementation-plan'],
		requiredOutputs: ['implemented-increments']
	},
	{
		key: 'integrated-validation',
		name: 'Integrated Product Validation',
		pwuKind: 'INTEGRATED_PRODUCT_VALIDATION',
		isRoot: false,
		workDischarge: 'UNDECLARED',
		purpose: 'Journey / requirement / architecture / fitness validation.',
		requiredInputs: ['implemented-increments'],
		requiredOutputs: ['validation-evidence']
	},
	{
		key: 'baseline-promotion',
		name: 'Product Baseline Promotion',
		pwuKind: 'PRODUCT_BASELINE_PROMOTION',
		isRoot: false,
		workDischarge: 'UNDECLARED',
		purpose: 'Evidence package, residual-risk + promotion decisions, authoritative baseline.',
		requiredInputs: ['validation-evidence'],
		requiredOutputs: ['authoritative-baseline']
	},
	{
		key: 'architecture-concern',
		name: 'Architecture Concern',
		pwuKind: 'ARCHITECTURE_CONCERN',
		isRoot: false,
		workDischarge: 'UNDECLARED',
		purpose: 'A generic architecture concern contributing to Architecture Definition.',
		requiredInputs: ['approved-behavior'],
		requiredOutputs: ['architecture-baseline']
	}
];

/** Look up a catalog blueprint by key (undefined if none). */
export function catalogTemplate(key: string): PwuTypeTemplate | undefined {
	return PWU_TYPE_CATALOG.find((t) => t.key === key);
}

/**
 * ⭐ `REG-F-524` (`REG-D-121` Q18) — WHICH PWU KINDS A POLICY GOVERNS, as the agent's policy listing and the designer form
 * both say it: the kinds its applicability names, or nothing for a policy that names none, which no kind excludes.
 */
export function policyKindsText(pwuKinds: readonly string[] | undefined): string {
	return pwuKinds && pwuKinds.length > 0 ? `governs PWU kinds ${pwuKinds.join(', ')}` : '';
}

/** One assurance policy as the authoring surfaces present it (id + human label + one-line blurb). */
export interface AssurancePolicyOption {
	readonly id: string;
	readonly label: string;
	readonly blurb: string;
}

/** The locked, non-removable de-minimis assurance floor (§11.7.4). Every PWU Type carries it implicitly — it is
 *  NEVER listed in requiredAssurancePolicyIds and cannot be waived. Shown as the rail's locked section. */
export const ASSURANCE_FLOOR: readonly AssurancePolicyOption[] = [
	{
		id: 'floor.schema-invariant',
		label: 'Output Contract & Invariant Integrity',
		blurb: 'Every material output satisfies its contract + the domain invariants.'
	},
	{
		id: 'floor.identity-provenance',
		label: 'Identity, Provenance & Trace Completeness',
		blurb: 'Every material transformation is identity/provenance/trace-complete.'
	},
	{
		id: 'floor.reasoning-review',
		label: 'Reasoning Review',
		blurb:
			'Every material AI/agent output is independently reviewed for genuine obligation discharge.'
	}
];

/** The declarable, ADDITIVE assurance policies a PWU Type may require of its future instances (§11.7.4 "required
 *  treatment"). These sit ON TOP of the locked floor. The Product Realization PWA's seed policies. */
export const ASSURANCE_POLICY_CATALOG: readonly AssurancePolicyOption[] = [
	{
		id: 'pol_intent_fidelity',
		label: 'Intent Fidelity',
		blurb: 'Output stays faithful to approved Intent.'
	},
	{
		id: 'pol_intent_completeness',
		label: 'Intent Completeness',
		blurb: 'Intent covers jobs, outcomes, boundary, constraints, and success conditions.'
	},
	{
		id: 'pol_assumption_disclosure',
		label: 'Assumption Disclosure',
		blurb: 'Assumptions and residual uncertainty are surfaced, not hidden.'
	},
	{
		id: 'pol_decomposition_coverage',
		label: 'Decomposition Coverage',
		blurb: 'Every required child obligation is allocated and covered.'
	},
	{
		id: 'pol_architecture_coverage',
		label: 'Architecture Coverage',
		blurb: 'Requirements/constraints are allocated to structure with verification counterparts.'
	},
	{
		id: 'pol_intent_preservation',
		label: 'Intent Preservation',
		blurb: 'The promoted result still preserves the approved Intent end-to-end.'
	}
];

/** Resolve an assurance-policy id to its human label (floor or additive), falling back to the raw id. */
export function assurancePolicyLabel(id: string): string {
	return (
		ASSURANCE_POLICY_CATALOG.find((p) => p.id === id)?.label ??
		ASSURANCE_FLOOR.find((p) => p.id === id)?.label ??
		id
	);
}

/**
 * ⭑⭑ JAN-EXECGOV EG-05 — WHAT EACH ASSURANCE POLICY CONTROL DOES, INCLUDING THE ONES THAT DO NOTHING.
 *
 * The sponsor's case: *"the human user may use the UI to make manual changes as well."* A setting a person edits
 * and nothing consults is a **fiction presented as control**, and the remedy is DISCLOSURE rather than wiring —
 * removing the control would lose the author's intent, and wiring it would invent governance the corpus has not
 * asked for. (`evaluationMethod`'s absent reader is already filed as `REG-F-243`, OPEN.)
 *
 * ⚠ `consulted` IS A FALSIFIABLE CLAIM, NOT A BOOLEAN, AND THAT IS THE WHOLE DESIGN. Each entry that claims a
 * reader must NAME the file and QUOTE it; `verif/authoring-field-disposition.test.ts` fails if the quote is not
 * in that file. A quote rather than a line number because this register already records that line citations rot.
 *
 * ⛔⛔ AND THE OBVIOUS ALTERNATIVE IS ALREADY DEFEATED — MEASURED, NOT FEARED. A gate that DERIVED "consulted" by
 * looking for the field name inside a conditional would report `evaluatorRole` and `evaluatedClaimTypes` as
 * consulted at HEAD, because EG-04's own `policyEditPatch` added `if (f.evaluatorRole)` — a presence guard, not
 * a consultation. The commit that fixed their sibling would have silenced the gate for them. So the disposition
 * is declared by a human and made checkable, rather than inferred by a pattern that a refactor can satisfy.
 */
export interface AuthoringFieldDisposition {
	/** Rendered to the professional beside the control. For an unconsulted field it SAYS SO. */
	readonly help: string;
	/** The reader that consults this value, or `null` when nothing does. */
	readonly consulted: { readonly file: string; readonly quote: string } | null;
}

export const ASSURANCE_POLICY_FIELDS: Readonly<Record<string, AuthoringFieldDisposition>> = {
	name: {
		help: 'The human name of this policy, shown wherever the policy is referenced.',
		consulted: {
			file: 'apps/rph-demo/src/routes/pwa/[id]/+page.svelte',
			quote: '<span class="pcname">{p.name}</span>'
		}
	},
	purpose: {
		help: 'One or two sentences on what this policy is for. Read by a professional, not by the engine.',
		consulted: {
			file: 'apps/rph-demo/src/routes/pwa/[id]/+page.svelte',
			quote: '<p class="pcpurpose">{p.purpose}</p>'
		}
	},
	rationale: {
		// ⛔ NOT CONSULTED. Three production sites, all `String((x.state.rationale ?? '') as string)` projections
		// into a view model. Nothing branches on it.
		help:
			'Why this policy exists. Recorded and kept with the policy, and NOT read by the engine — it does not ' +
			'affect any assessment, disposition, or gate.',
		consulted: null
	},
	evaluatedClaimTypes: {
		// ⛔ NOT CONSULTED FOR A POLICY THIS SURFACE CAN AUTHOR. Its one reader copies the value into a FLOOR
		// policy's finding definitions (`floor-policies.ts`), and floor policies are seeded and locked — this form
		// cannot reach that path. ⚠ The distinction matters: the field is not dead in the system, it is inert HERE,
		// and saying "nothing reads it" would be false.
		help:
			'Which kind of claim this policy is about. Recorded on the policy; for a policy authored here it is ' +
			'not read by any gate — only the seeded floor policies feed this into their finding definitions.',
		consulted: null
	},
	evaluatorRole: {
		// ⛔ NOT CONSULTED. 45 non-test production sites, every one an assignment or a projection; nothing
		// compares it. POSITIVE CONTROL for that search: its sibling `independenceRequirement` IS compared,
		// at `assurance.ts:2198`, and the same search finds it.
		help:
			'Who is expected to evaluate against this policy. Recorded, and NOT currently used to select or ' +
			'constrain an evaluator — the independence requirement below is what the engine actually enforces.',
		consulted: null
	},
	independenceRequirement: {
		help: 'How independent the evaluator must be from whoever did the work. ENFORCED: an assessment that does not meet it is refused.',
		consulted: {
			file: 'packages/rph-application/src/handlers/assurance.ts',
			quote: "r !== policyState?.independenceRequirement"
		}
	},
	permittedControlActions: {
		help: 'Which control actions this policy may call for. ENFORCED: a rule naming an action outside this set is refused.',
		consulted: {
			file: 'packages/rph-application/src/handlers/assurance.ts',
			quote: 'if (permittedControlActions === undefined) return null;'
		}
	},
	criteria: {
		help: 'One criterion per line. ENFORCED: each is assessed, and a BLOCKING criterion that is not met rejects the disposition.',
		// ⚠ THE FIRST QUOTE I REACHED FOR HERE WAS `criteria: p.criteria` — a WRITE into created state, which
		// is the exact shape this file calls out for `evaluatorRole`. A declaration citing a copy would have
		// passed the gate and proved nothing. This one consults a criterion's own severity to decide whether it
		// blocks, which is a criterion changing an outcome.
		consulted: {
			file: 'packages/rph-assurance/src/validators.ts',
			quote: 'mandatory: BLOCKING_SEVERITIES.has(c.severityIfNotMet)'
		}
	}
};
