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
	requiredInputs:
		'Named artifacts this type of work CONSUMES before it can start (e.g. "approved-behavior"). A data-flow edge is drawn from whichever type produces a matching output.',
	requiredOutputs:
		'Named artifacts this type of work PRODUCES when done (e.g. "architecture-baseline"). Downstream types that require a matching input consume it — the data-flow that threads the graph.'
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
