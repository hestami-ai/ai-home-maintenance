// Single source for PWU Type authoring: (a) field HELP so the form explains every field the user was missing, and
// (b) a copy-on-use CATALOG of reusable PWU Type blueprints (the Product Realization PWA's §7 work areas — the
// seed "PWU library"). The engine's DefinePwuType / EditPwuType accept all of these fields; "start from template"
// simply pre-fills the form, and the engine copy is fully editable afterward (no cross-PWA coupling).

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
		'Which PWU Types may be decomposed UNDER this type in the graph — the allowed composition.'
} as const;

export interface PwuTypeTemplate {
	readonly key: string;
	readonly name: string;
	readonly pwuKind: string;
	readonly purpose: string;
	readonly isRoot: boolean;
}

/** Curated, copy-on-use PWU Type blueprints — the Product Realization PWA's §7 work areas. */
export const PWU_TYPE_CATALOG: readonly PwuTypeTemplate[] = [
	{
		key: 'product-realization',
		name: 'Product Realization',
		pwuKind: 'PRODUCT_REALIZATION',
		isRoot: true,
		purpose: 'Root: structure product work from originating intent to authoritative baselines.'
	},
	{
		key: 'intent-definition',
		name: 'Intent & Product Definition',
		pwuKind: 'INTENT_DEFINITION',
		isRoot: false,
		purpose: 'Originating intent, stakeholders, product boundary.'
	},
	{
		key: 'product-behavior',
		name: 'Product Behavior Definition',
		pwuKind: 'PRODUCT_BEHAVIOR',
		isRoot: false,
		purpose: 'Actors, capabilities, journeys, requirements.'
	},
	{
		key: 'architecture',
		name: 'Architecture Definition',
		pwuKind: 'ARCHITECTURE',
		isRoot: false,
		purpose: 'A coherent technical structure realizing approved behavior.'
	},
	{
		key: 'implementation-planning',
		name: 'Implementation Planning',
		pwuKind: 'IMPLEMENTATION_PLANNING',
		isRoot: false,
		purpose: 'Increments, decomposition, dependencies, test + migration planning.'
	},
	{
		key: 'product-implementation',
		name: 'Product Implementation',
		pwuKind: 'PRODUCT_IMPLEMENTATION',
		isRoot: false,
		purpose: 'Realize the planned increments.'
	},
	{
		key: 'integrated-validation',
		name: 'Integrated Product Validation',
		pwuKind: 'INTEGRATED_VALIDATION',
		isRoot: false,
		purpose: 'Journey / requirement / architecture / fitness validation.'
	},
	{
		key: 'baseline-promotion',
		name: 'Product Baseline Promotion',
		pwuKind: 'BASELINE_PROMOTION',
		isRoot: false,
		purpose: 'Evidence package, residual-risk + promotion decisions, authoritative baseline.'
	},
	{
		key: 'architecture-concern',
		name: 'Architecture Concern',
		pwuKind: 'ARCHITECTURE_CONCERN',
		isRoot: false,
		purpose: 'A generic architecture concern contributing to Architecture Definition.'
	}
];
