// ⭐ The review in parts, B1 (`REG-D-125`; DESIGN-authoring-review-in-parts.md §3; roadmap §9a.2 "Measure") — A SYNTHETIC PWA
// SHAPED LIKE RUN-11'S CANDIDATE, for measuring what each part's review is handed: 16 types — one root, four middle composites
// and eleven leaves, three levels deep — each with a purpose of about 150 characters, two or three declared policy ids, MODEL
// discharge, and an ACTIVE prompt template of about 500-600 characters with an output contract. ⚠ Synthetic: run-11's own
// candidate is not read here, so what this measures is the builder over a PWA of that shape, not run-11's prompts.
import type { ProfessionalRationaleSummary } from '@janumipwb/rph-assurance';
import { buildPwaGraphExport, type PwaGraphExport, type PwaGraphNode } from '@janumipwb/rph-projections';

/** One type of the fixture: its name, kind, artifacts and policies; its children, by name, for a composite. */
interface Shape {
	readonly name: string;
	readonly kind: string;
	readonly inputs: readonly string[];
	readonly outputs: readonly string[];
	readonly policies: readonly string[];
	readonly children?: readonly string[];
}

const SHAPES: readonly Shape[] = [
	{
		name: 'Product Realization',
		kind: 'PRODUCT_REALIZATION',
		inputs: ['product-brief'],
		outputs: ['delivered-product'],
		policies: ['pol_intent_preservation', 'pol_fitness_for_purpose'],
		children: ['Requirements Engineering', 'Architecture and Design', 'Implementation', 'Verification and Validation']
	},
	{
		name: 'Requirements Engineering',
		kind: 'REQUIREMENTS_ENGINEERING',
		inputs: ['product-brief'],
		outputs: ['requirements-baseline'],
		policies: ['pol_intent_preservation', 'pol_assumption_disclosure'],
		children: ['Stakeholder Analysis', 'Requirements Specification', 'Acceptance Criteria']
	},
	{ name: 'Stakeholder Analysis', kind: 'STAKEHOLDER_ANALYSIS', inputs: ['product-brief'], outputs: ['stakeholder-needs'], policies: ['pol_intent_preservation', 'pol_assumption_disclosure'] },
	{ name: 'Requirements Specification', kind: 'REQUIREMENTS_SPECIFICATION', inputs: ['stakeholder-needs'], outputs: ['requirements-spec'], policies: ['pol_intent_preservation', 'pol_assumption_disclosure', 'pol_fitness_for_purpose'] },
	{ name: 'Acceptance Criteria', kind: 'ACCEPTANCE_CRITERIA', inputs: ['requirements-spec'], outputs: ['acceptance-criteria', 'requirements-baseline'], policies: ['pol_intent_preservation', 'pol_test_adequacy'] },
	{
		name: 'Architecture and Design',
		kind: 'ARCHITECTURE_AND_DESIGN',
		inputs: ['requirements-baseline'],
		outputs: ['design-baseline'],
		policies: ['pol_fitness_for_purpose', 'pol_assumption_disclosure'],
		children: ['Architecture Definition', 'Interface Design', 'Data Design']
	},
	{ name: 'Architecture Definition', kind: 'ARCHITECTURE_DEFINITION', inputs: ['requirements-spec'], outputs: ['architecture'], policies: ['pol_fitness_for_purpose', 'pol_assumption_disclosure'] },
	{ name: 'Interface Design', kind: 'INTERFACE_DESIGN', inputs: ['architecture'], outputs: ['interface-spec'], policies: ['pol_fitness_for_purpose', 'pol_intent_preservation'] },
	{ name: 'Data Design', kind: 'DATA_DESIGN', inputs: ['architecture'], outputs: ['data-model', 'design-baseline'], policies: ['pol_fitness_for_purpose', 'pol_assumption_disclosure', 'pol_intent_preservation'] },
	{
		name: 'Implementation',
		kind: 'IMPLEMENTATION',
		inputs: ['design-baseline'],
		outputs: ['built-product'],
		policies: ['pol_fitness_for_purpose', 'pol_test_adequacy', 'pol_intent_preservation'],
		children: ['Core Implementation', 'CLI Implementation', 'Unit Testing']
	},
	{ name: 'Core Implementation', kind: 'CORE_IMPLEMENTATION', inputs: ['architecture', 'data-model'], outputs: ['core-module'], policies: ['pol_fitness_for_purpose', 'pol_test_adequacy'] },
	{ name: 'CLI Implementation', kind: 'CLI_IMPLEMENTATION', inputs: ['interface-spec', 'core-module'], outputs: ['cli-binary'], policies: ['pol_fitness_for_purpose', 'pol_test_adequacy'] },
	{ name: 'Unit Testing', kind: 'UNIT_TESTING', inputs: ['core-module', 'cli-binary'], outputs: ['unit-test-report', 'built-product'], policies: ['pol_test_adequacy', 'pol_assumption_disclosure', 'pol_fitness_for_purpose'] },
	{
		name: 'Verification and Validation',
		kind: 'VERIFICATION_AND_VALIDATION',
		inputs: ['built-product', 'acceptance-criteria'],
		outputs: ['delivered-product'],
		policies: ['pol_test_adequacy', 'pol_fitness_for_purpose'],
		children: ['Integration Testing', 'Acceptance Validation']
	},
	{ name: 'Integration Testing', kind: 'INTEGRATION_TESTING', inputs: ['cli-binary', 'interface-spec'], outputs: ['integration-report'], policies: ['pol_test_adequacy', 'pol_assumption_disclosure'] },
	{ name: 'Acceptance Validation', kind: 'ACCEPTANCE_VALIDATION', inputs: ['acceptance-criteria', 'integration-report', 'unit-test-report'], outputs: ['delivered-product'], policies: ['pol_test_adequacy', 'pol_intent_preservation', 'pol_fitness_for_purpose'] }
];

/** A production-shaped PWU-Type id for the `i`th type: `pwut_` and 26 Crockford base32 characters. */
const idOf = (i: number): string => `pwut_01M6R11SHAPED${String(i + 1).padStart(13, '0')}`;

const purposeOf = (s: Shape): string =>
	`Carry out ${s.name.toLowerCase()} for the wordfreq command-line tool, so that every later phase starts from a reviewed, complete and traceable ${s.outputs[0]}.`;

const templateTextOf = (s: Shape): string =>
	`You are the ${s.name} unit of the wordfreq realization. Read the inputs you are given (${s.inputs.join(', ')}) and produce ` +
	`${s.outputs.join(' and ')}. Work only from what the inputs state; where they are silent, record an explicit assumption ` +
	'instead of inventing a requirement. For every element you produce, cite the input element it answers. Report each check ' +
	'you ran with its actual result, and never report a check you did not run. If an input is missing or contradictory, stop ' +
	'and report the gap rather than guessing. Keep the result inside the scope of this unit.';

const outputContractOf = (s: Shape): string =>
	`A JSON object: {"${s.outputs[0]}": string, "assumptions": string[], "checks": {"name": string, "result": string}[], "gaps": string[]}.`;

/** The fixture's 16 types, in the order an author defines them, each key where `buildPwaExport` writes it. */
export const RUN11_SHAPED_NODES: readonly PwaGraphNode[] = SHAPES.map((s, i) => {
	const children = (s.children ?? []).map((c) => idOf(SHAPES.findIndex((x) => x.name === c)));
	return {
		id: idOf(i),
		name: s.name,
		pwuKind: s.kind,
		isRoot: i === 0,
		permittedChildTypeIds: children,
		requiredInputs: [...s.inputs],
		requiredOutputs: [...s.outputs],
		executionBoundary: 'INTERNAL',
		workDischarge: 'MODEL',
		promptStatus: 'ACTIVE',
		purpose: purposeOf(s),
		requiredAssurancePolicyIds: [...s.policies],
		permittedChildren: children.map((typeId) => ({ typeId, cardinality: 'M1' as const })),
		promptTemplate: { templateText: templateTextOf(s), outputContract: outputContractOf(s), status: 'ACTIVE', templateVersion: 1 },
		completionRule: 'Execution succeeded AND required outputs exist AND assurance satisfied'
	};
});

/** The fixture's export, as `buildPwaExport` would give it for these types. */
export const RUN11_SHAPED_EXPORT: PwaGraphExport = buildPwaGraphExport(
	{
		id: 'pwa_01M6R11SHAPED000000000000P',
		name: 'wordfreq realization',
		domain: 'software',
		version: '1.0.0',
		publicationStatus: 'DRAFT',
		description: 'Realize the wordfreq command-line tool from its brief: requirements, design, implementation and verification.'
	},
	RUN11_SHAPED_NODES
);

/** The request the fixture's PWA was authored from. */
export const RUN11_SHAPED_REQUEST =
	'Design a Professional Work Architecture for realizing wordfreq, a command-line tool that counts word frequencies in text ' +
	'files. The PWA must take the product brief through requirements engineering, architecture and design, implementation and ' +
	'verification and validation, and deliver a tested, documented tool. Each phase should be a composite of the professional ' +
	'activities it needs, every activity performed by a model, and each type should declare the assurance policies its work ' +
	'needs: intent preservation, assumption disclosure, fitness for purpose and test adequacy where they apply. Each type that ' +
	'a model performs needs an active prompt with an output contract, and every artifact a type produces should be consumed by ' +
	'the type that needs it.';

/** An account of the authoring, of about the size a producing agent returns. */
export const RUN11_SHAPED_ACCOUNT: ProfessionalRationaleSummary = {
	rationale:
		'The root is the realization itself, decomposed into the four phases the request names, each a composite of the ' +
		'activities that phase needs. Requirements engineering turns the brief into stakeholder needs, a specification and ' +
		'acceptance criteria, which form the requirements baseline; architecture and design derive the architecture, the ' +
		'interface and the data model from the specification; implementation builds the core module and the CLI and unit-tests ' +
		'both; verification and validation integrate the binary and validate it against the acceptance criteria. Every type is ' +
		'performed by a model and carries an active prompt with an output contract, and each declares the policies its work needs.',
	assumptions: [
		'The product brief states the input formats the tool must accept.',
		'A single command-line binary is the whole delivered product.',
		'The catalog’s policies are the ones the request means.'
	],
	limitations: ['Packaging and release are outside the request.', 'No performance requirement was given, so none is designed for.'],
	residualUncertainty: ['Whether the brief expects Unicode word boundaries.', 'Whether integration testing needs a separate data set.']
};

/** The authoring agent's observable narration, of about the size a turn leaves. */
export const RUN11_SHAPED_NARRATION =
	'Created the root Product Realization and its four phases. Defined the requirements activities and wired the brief to ' +
	'stakeholder analysis. Added the design activities and their artifacts. Added the implementation activities and unit ' +
	'testing. Added integration testing and acceptance validation. Declared policies on each type. Wrote an active prompt with ' +
	'an output contract for every type. Checked that each artifact a type produces is consumed by the type that needs it.';
