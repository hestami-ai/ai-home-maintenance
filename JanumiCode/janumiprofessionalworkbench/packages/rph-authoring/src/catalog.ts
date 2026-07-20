// Single source for PWU Type authoring: (a) field HELP so every surface (the node-graph inspector form AND the
// agent's tool schemas) explains the fields, and (b) a copy-on-use CATALOG of reusable PWU Type blueprints (the
// Product Realization PWA's §7 work areas — the seed "PWU library"). The engine's DefinePwuType / EditPwuType
// accept all of these fields; "start from template" simply pre-fills them, and the engine copy is fully editable
// afterward (no cross-PWA coupling). This module is PURE DATA (no engine import) so it is browser-safe and is
// exported from the "@janumipwb/rph-authoring/catalog" subpath — importing it never drags the Node engine into a
// browser bundle.

export const PWU_TYPE_HELP = {
	name: 'The human name of this reusable PWU Type (e.g. "Architecture Definition").',
	pwuKind:
		'A SCREAMING_SNAKE token classifying the work (e.g. ARCHITECTURE). Every Instance of this type carries this kind.',
	purpose: 'One or two sentences on what work of this type accomplishes and what it produces.',
	isRoot:
		'Exactly one type in a PWA is the root — the top of every Undertaking’s Professional Work Graph. Publishing requires a root.',
	completionRule:
		'When an Instance of this type is DONE. Defaults to the RPH rule: execution succeeded AND required outputs exist AND assurance satisfied (no green without assurance).',
	permittedChildTypeIds:
		'Which PWU Types may be decomposed UNDER this type in the graph — the allowed composition.',
	permittedChildren:
		'Per-child composition cardinality (parallel to permittedChildTypeIds): each rule is {typeId, cardinality, applicabilityNote?}. cardinality is M1 (mandatory exactly one), M+ (mandatory one or more), C1 (conditional zero or one), or C+ (conditional zero or more). Use a free-text applicabilityNote to say WHEN a conditional (C*) child applies.',
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
		'For a DELEGATED_EXTERNAL type: ids of ACTIVE non-floor assurance policies the counterparty ATTESTS it satisfies (assurance-by-attestation). This is the counterparty’s CLAIM, not your own review — disclosure is not verification. Same id rules as requiredAssurancePolicyIds (locked-floor, DRAFT, SUSPENDED, and missing ids are rejected). May be empty.',
	boundaryApplicabilityNote:
		'For a DELEGATED_EXTERNAL type: free-text scope/condition of the delegation (e.g. "STAT panels only; routine handled internally"). Optional.'
} as const;

export interface PwuTypeTemplate {
	readonly key: string;
	readonly name: string;
	readonly pwuKind: string;
	readonly purpose: string;
	readonly isRoot: boolean;
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
		purpose: 'Root: structure product work from originating intent to authoritative baselines.',
		requiredInputs: ['originating-intent'],
		requiredOutputs: ['authoritative-baseline']
	},
	{
		key: 'intent-definition',
		name: 'Intent & Product Definition',
		pwuKind: 'INTENT_DEFINITION',
		isRoot: false,
		purpose: 'Originating intent, stakeholders, product boundary.',
		requiredInputs: ['originating-intent'],
		requiredOutputs: ['product-definition']
	},
	{
		key: 'product-behavior',
		name: 'Product Behavior Definition',
		pwuKind: 'PRODUCT_BEHAVIOR',
		isRoot: false,
		purpose: 'Actors, capabilities, journeys, requirements.',
		requiredInputs: ['product-definition'],
		requiredOutputs: ['approved-behavior']
	},
	{
		key: 'architecture',
		name: 'Architecture Definition',
		pwuKind: 'ARCHITECTURE',
		isRoot: false,
		purpose: 'A coherent technical structure realizing approved behavior.',
		requiredInputs: ['approved-behavior'],
		requiredOutputs: ['architecture-baseline']
	},
	{
		key: 'implementation-planning',
		name: 'Implementation Planning',
		pwuKind: 'IMPLEMENTATION_PLANNING',
		isRoot: false,
		purpose: 'Increments, decomposition, dependencies, test + migration planning.',
		requiredInputs: ['architecture-baseline'],
		requiredOutputs: ['implementation-plan']
	},
	{
		key: 'product-implementation',
		name: 'Product Implementation',
		pwuKind: 'PRODUCT_IMPLEMENTATION',
		isRoot: false,
		purpose: 'Realize the planned increments.',
		requiredInputs: ['implementation-plan'],
		requiredOutputs: ['implemented-increments']
	},
	{
		key: 'integrated-validation',
		name: 'Integrated Product Validation',
		pwuKind: 'INTEGRATED_VALIDATION',
		isRoot: false,
		purpose: 'Journey / requirement / architecture / fitness validation.',
		requiredInputs: ['implemented-increments'],
		requiredOutputs: ['validation-evidence']
	},
	{
		key: 'baseline-promotion',
		name: 'Product Baseline Promotion',
		pwuKind: 'BASELINE_PROMOTION',
		isRoot: false,
		purpose: 'Evidence package, residual-risk + promotion decisions, authoritative baseline.',
		requiredInputs: ['validation-evidence'],
		requiredOutputs: ['authoritative-baseline']
	},
	{
		key: 'architecture-concern',
		name: 'Architecture Concern',
		pwuKind: 'ARCHITECTURE_CONCERN',
		isRoot: false,
		purpose: 'A generic architecture concern contributing to Architecture Definition.',
		requiredInputs: ['approved-behavior'],
		requiredOutputs: ['architecture-baseline']
	}
];

/** Look up a catalog blueprint by key (undefined if none). */
export function catalogTemplate(key: string): PwuTypeTemplate | undefined {
	return PWU_TYPE_CATALOG.find((t) => t.key === key);
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
