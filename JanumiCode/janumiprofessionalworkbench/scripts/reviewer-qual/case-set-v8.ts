// ⭐⭐ `JAN-EXEC` Phase 7, the review in parts, B7 — REVIEWER-QUALIFICATION CASE SET, VERSION EIGHT (`REG-D-125`, `REG-D-126`;
// DESIGN-authoring-review-in-parts.md §5; ROADMAP-undertaking-execution-sandbox.md §9a.8).
//
// VERSION SEVEN'S 41 NON-GRAPH CASES, BYTE FOR BYTE, AND 35 PART CASES IN PLACE OF ITS 19 GRAPH CASES. The authoring floor's
// reviewer is to be handed one type of an authored PWA at a time, in the `PWA_TYPE` framing — its whole definition the
// subject, its place in the PWA the context (`pwaTypeParts`, `pwaTypeReviewInput`) — never the whole graph (`REG-F-571`).
// So a part case is ONE TYPE of a graph case: the graph case's whole input, and the type whose part is reviewed, cut from it
// at materialize time by the product's own builders (`materialize.ts`). The 35, as design §5 and `REG-D-126` state them:
//   · THE 13 CLEAN PARTS (Q30) — the three parts of G7-CLEAN, the seven of G3-CLEAN, and the root of each of G3-CLEAN-R1,
//     -R2 and -R3: each a part of a PWA whose oracle is SATISFIED unconditionally, so, under ASR-10, satisfied itself.
//   · THE 14 CATCHERS (Q30) — one part of each planted graph case, the one design §5's table names as seeing the plant whole
//     (`CATCHERS_V8`); `G7-RR-03-CHILD`'s is the root, Realization, whose own decomposition holds the optional rule.
//   · THE 3-LEVEL PAIR (Q31) — `G8-CLEAN`, one root, two middle composites and two leaves under each, all seven parts; and
//     `G8-RR-02`'s Verification, the one middle phase whose children leave out the end-to-end run its own purpose requires.
//     Derived from G7: the same request, the same account's style (`G8_GRAPHS`). Neither is a case of this set: their parts are.
// The other parts of a planted PWA are not cases. ⛔ A CASE IS DATA, AND ITS ID IS ITS SOURCE'S AND ITS PART'S: the source
// case's id, a full stop, then `T` and the type's position in the source's export order, two digits (`partCaseId`) — so the
// id is safe as a file name and as a substring filter, and no part case's id holds another's.
// ⛔ ORACLE INTEGRITY (`REG-D-073`): what each part case is EXPECTED to draw is in `oracles-v8.ts`, versioned separately, and
// is the sponsor's conferral (`REG-D-126` Q30 and Q31) — no case is tuned to a reply.
// Generated into `docs/tracking/reviewer-qualification/cases/` by `generate.ts`; the JSON is never hand-edited.
import type { AssuranceSubject, ProfessionalRationaleSummary } from '@janumipwb/rph-assurance';
import type { PwaGraphNode, PwaMeta } from '@janumipwb/rph-projections';
import { CASE_SET_V7 } from './case-set-v7.js';
import {
	CASE_PRODUCER_MODEL_ID,
	CASE_PRODUCER_PROVIDER_ID,
	type CaseSet,
	type GraphCase,
	type PwaTypeCase
} from './cases.js';

// ── the 3-level pair (`REG-D-126` Q31; design §5) ─────────────────────────────────────────────────────────────────────
// ⛔ Production's shape, as G7's: one PWA and seven types, each a real ULID minted once from one authoring session (the PWA
// first, then each type seconds after the one before) and fixed here, with no three letters together.
const G8_PWA_ID = 'pwa_01M5N2TV00606JA2A3518CE6EX';
const REALIZATION_ID = 'pwut_01M5N2V2MV71P4Y94Q9WJ47V6S';
const IMPLEMENTATION_ID = 'pwut_01M5N2V7FH39EA78XA89S683XW';
const TOOL_BUILD_ID = 'pwut_01M5N2VG5N7F9FH13FF9YZ8RV7';
const UNIT_TESTS_ID = 'pwut_01M5N2VQ004C0FW25MD17C646E';
const VERIFICATION_ID = 'pwut_01M5N2VV3P892Q0KG2C6ZJ7E0V';
const PREPARATION_ID = 'pwut_01M5N2W1YT1E2867H2412C5E90';
const END_TO_END_ID = 'pwut_01M5N2W6NA8H116C4RF940E0CK';

/** G7's request, word for word: the pair is derived from G7 (design §5). */
const REQUEST = CASE_SET_V7.cases.find((c): c is GraphCase => c.id === 'G7-CLEAN' && c.arm === 'PWA_GRAPH')!.input.prompt;

/** The catalog's policies for each kind the pair declares, as `ontology.seedPolicies` applies them, in the catalog's order. */
const POLICIES = {
	PRODUCT_REALIZATION: ['pol_intent_fidelity', 'pol_decomposition_coverage', 'pol_intent_preservation', 'pol_fitness_for_purpose'],
	PRODUCT_IMPLEMENTATION: ['pol_assumption_disclosure', 'pol_intent_preservation', 'pol_test_adequacy'],
	INTEGRATED_PRODUCT_VALIDATION: [
		'pol_assumption_disclosure',
		'pol_intent_preservation',
		'pol_test_adequacy',
		'pol_fitness_for_purpose'
	]
} as const;

/** An ACTIVE prompt template, its one marker `{title}` (a work unit supplies its title), as the export carries one. */
const template = (templateText: string, outputContract: string) => ({
	templateText,
	outputContract,
	status: 'ACTIVE' as const,
	templateVersion: 1
});

/** One INTERNAL MODEL type of the pair, each key where `buildPwaExport` writes it. */
const g8Type = (
	n: Pick<PwaGraphNode, 'id' | 'name' | 'isRoot' | 'requiredInputs' | 'requiredOutputs' | 'permittedChildren'> & {
		readonly pwuKind: keyof typeof POLICIES;
		readonly purpose: string;
		readonly prompt: string;
		readonly contract: string;
	}
): PwaGraphNode => ({
	id: n.id,
	name: n.name,
	pwuKind: n.pwuKind,
	isRoot: n.isRoot,
	permittedChildTypeIds: (n.permittedChildren ?? []).map((r) => r.typeId),
	requiredInputs: n.requiredInputs,
	requiredOutputs: n.requiredOutputs,
	executionBoundary: 'INTERNAL',
	workDischarge: 'MODEL',
	promptStatus: 'ACTIVE',
	purpose: n.purpose,
	requiredAssurancePolicyIds: [...POLICIES[n.pwuKind]],
	permittedChildren: n.permittedChildren ?? [],
	promptTemplate: template(n.prompt, n.contract)
});

/** The verification's rule for its end-to-end child, and the input its report takes from it — ⭑ G8-RR-02's plant omits both. */
const END_TO_END_RULE = {
	typeId: END_TO_END_ID,
	cardinality: 'M1' as const,
	applicabilityNote: 'Every verification runs the built tool end to end.'
};

/** The seven types, in the order an author defines them; ⭑ `withEndToEnd` false is G8-RR-02's sole plant. */
function g8Nodes(withEndToEnd: boolean): PwaGraphNode[] {
	const nodes = [
		g8Type({
			id: REALIZATION_ID,
			name: 'Realization',
			pwuKind: 'PRODUCT_REALIZATION',
			isRoot: true,
			requiredInputs: ['supplied-requirements', 'supplied-design', 'implementation-report', 'verification-report'],
			requiredOutputs: ['realization-result'],
			purpose:
				'Realize wordfreq from the supplied requirements and design: synthesize the result of the built and verified product from its two phases’ reports.',
			permittedChildren: [
				{ typeId: IMPLEMENTATION_ID, cardinality: 'M1', applicabilityNote: 'Every realization builds the product.' },
				{ typeId: VERIFICATION_ID, cardinality: 'M1', applicabilityNote: 'Every realization runs the built product against its requirements.' }
			],
			prompt:
				'You are realizing {title} from the supplied requirements and design. Its work is done by its two phases: the ' +
				'implementation, which reports the built tool and its unit-test work, and the verification, which reports what ' +
				'running the built tool against the requirements shows. Synthesize the result from their reports: say what was ' +
				'built, which requirements the verification’s runs show met and which they do not, and cite the run that shows ' +
				'each. Claim nothing their reports do not show, and report no test or run result that is not in them.',
			contract:
				'One JSON object: {"built": string, "requirements": [{"id": string, "met": boolean, "shownBy": string[]}], "openIssues": string[]}.'
		}),
		g8Type({
			id: IMPLEMENTATION_ID,
			name: 'Implementation',
			pwuKind: 'PRODUCT_IMPLEMENTATION',
			isRoot: false,
			requiredInputs: ['supplied-requirements', 'supplied-design', 'wordfreq-build', 'unit-test-report'],
			requiredOutputs: ['implementation-report'],
			purpose:
				'Compose the implementation of wordfreq: the built tool and its unit-test work, synthesized into the implementation report.',
			permittedChildren: [
				{ typeId: TOOL_BUILD_ID, cardinality: 'M1', applicabilityNote: 'Every implementation builds the tool.' },
				{ typeId: UNIT_TESTS_ID, cardinality: 'M1', applicabilityNote: 'Every implementation tests what it builds.' }
			],
			prompt:
				'You are reporting the implementation of {title}. Its work is done by its two children: the tool build, which ' +
				'builds the tool as the supplied design specifies, and the unit tests, which trace to the supplied requirements ' +
				'and cover its successful paths and its failure paths. Synthesize the implementation report from their work ' +
				'products: say which files were built, and which tests ran and how their run ended, as the unit tests’ work ' +
				'product reports it. Claim nothing their work products do not show, and report no test or run result that is not ' +
				'in them.',
			contract:
				'One JSON object: {"files": string[], "tests": [{"name": string, "requirement": string}], "testRun": {"command": string, "exitCode": number, "output": string}}.'
		}),
		g8Type({
			id: TOOL_BUILD_ID,
			name: 'Tool Build',
			pwuKind: 'PRODUCT_IMPLEMENTATION',
			isRoot: false,
			requiredInputs: ['supplied-requirements', 'supplied-design'],
			requiredOutputs: ['wordfreq-build'],
			purpose: 'Build wordfreq as the supplied design specifies, from the supplied requirements.',
			prompt:
				'You are building {title}. Build the tool as the supplied design specifies, from the supplied requirements. Report ' +
				'each file you wrote, and the command that built it with its exit code and output as they were. Never report a ' +
				'file you did not write, and never invent a result.',
			contract: 'One JSON object: {"files": string[], "build": {"command": string, "exitCode": number, "output": string}}.'
		}),
		g8Type({
			id: UNIT_TESTS_ID,
			name: 'Unit Tests',
			pwuKind: 'PRODUCT_IMPLEMENTATION',
			isRoot: false,
			requiredInputs: ['supplied-requirements', 'wordfreq-build'],
			requiredOutputs: ['unit-test-report'],
			purpose:
				'Write and run unit tests of wordfreq that each trace to a supplied requirement, its successful paths and its failure paths: an unreadable or missing file, and a bad argument.',
			prompt:
				'You are testing {title}. Write unit tests that each trace to a supplied requirement, covering its successful paths ' +
				'and its failure paths: an unreadable or missing file, and a bad argument. Run the tests and report the command, its ' +
				'exit code and its output as they were. Never report a test as passing that you did not run, and never invent a ' +
				'result.',
			contract:
				'One JSON object: {"tests": [{"name": string, "requirement": string}], "testRun": {"command": string, "exitCode": number, "output": string}}.'
		}),
		g8Type({
			id: VERIFICATION_ID,
			name: 'Verification',
			pwuKind: 'INTEGRATED_PRODUCT_VALIDATION',
			isRoot: false,
			requiredInputs: ['supplied-requirements', 'wordfreq-build', 'verification-cases', ...(withEndToEnd ? ['end-to-end-runs'] : [])],
			requiredOutputs: ['verification-report'],
			purpose:
				'Verify the built wordfreq end to end against each supplied requirement: run the built tool on its successful paths and its failure paths, and report what those runs show.',
			permittedChildren: [
				{
					typeId: PREPARATION_ID,
					cardinality: 'M1',
					applicabilityNote: 'Every verification prepares its inputs and expected results.'
				},
				...(withEndToEnd ? [END_TO_END_RULE] : [])
			],
			prompt:
				'You are verifying {title}. Its work is done by its two children: the verification preparation, which prepares ' +
				'requirement-traced inputs and expected results, and the end-to-end verification, which runs the built tool on ' +
				'them. For each supplied requirement, report each run of the built tool on its successful paths and its failure ' +
				'paths — its command, exit code, standard output and standard error — as the end-to-end verification’s work ' +
				'product reports it. Report a requirement no run shows as not shown. Never report a run no work product shows, ' +
				'and never invent its output.',
			contract:
				'One JSON object: {"runs": [{"requirement": string, "command": string, "exitCode": number, "stdout": string, "stderr": string}], "notShown": string[]}.'
		}),
		g8Type({
			id: PREPARATION_ID,
			name: 'Verification Preparation',
			pwuKind: 'INTEGRATED_PRODUCT_VALIDATION',
			isRoot: false,
			requiredInputs: ['supplied-requirements'],
			requiredOutputs: ['verification-cases'],
			purpose:
				'Prepare requirement-traced inputs and expected results for verifying wordfreq, its successful paths and its failure paths; its output claims no run of the tool.',
			prompt:
				'You are preparing the verification of {title}. For each supplied requirement, write the inputs that exercise its ' +
				'successful paths and its failure paths, and the result each should produce, each traced to its requirement. Your ' +
				'work is preparation: claim no run of the tool, and report no result as observed.',
			contract: 'One JSON object: {"cases": [{"requirement": string, "input": string, "expected": string}]}.'
		})
	];
	if (!withEndToEnd) return nodes;
	return [
		...nodes,
		g8Type({
			id: END_TO_END_ID,
			name: 'End-to-End Verification',
			pwuKind: 'INTEGRATED_PRODUCT_VALIDATION',
			isRoot: false,
			requiredInputs: ['verification-cases', 'wordfreq-build'],
			requiredOutputs: ['end-to-end-runs'],
			purpose:
				'Run the built wordfreq end to end on the prepared successful and failure paths, retaining each run’s command, exit code, standard output and standard error.',
			prompt:
				'You are running the end-to-end verification of {title}. Run the built tool on each prepared input, its successful ' +
				'paths and its failure paths, and report each run’s requirement, command, exit code, standard output and standard ' +
				'error as they were. Report a prepared input you did not run as not run. Never report a run you did not make, and ' +
				'never invent its output.',
			contract:
				'One JSON object: {"runs": [{"requirement": string, "command": string, "exitCode": number, "stdout": string, "stderr": string}], "notRun": string[]}.'
		})
	];
}

/** The producer's account, in G7's style: it claims only what the graph declares, and names no grandchild and no count. */
const G8_ACCOUNT: ProfessionalRationaleSummary = {
	rationale:
		'The types realize wordfreq from the supplied requirements and design. “Realization”, the root, synthesizes the result ' +
		'from the reports of its two phases: “Implementation” composes the built tool and its unit-test work, and ' +
		'“Verification” verifies the built tool against the requirements. Each phase’s work is done by children of its own, ' +
		'and its report synthesizes their work products. Each type declares MODEL and carries an ACTIVE prompt with an output ' +
		'contract.',
	assumptions: ['The supplied requirements and design are complete enough to build wordfreq from.'],
	limitations: ['Packaging and publishing the built tool are outside the request and are not modelled.'],
	residualUncertainty: ['The request does not state how large an input file wordfreq must handle.']
};
const G8_NARRATION =
	'Defined the types under “Realization” in three levels and wired their inputs and outputs so each work product feeds the type that needs it.';
const G8_PWA: PwaMeta = {
	id: G8_PWA_ID,
	name: 'wordfreq — construct and verify in phases',
	domain: 'software',
	version: '1.0.0',
	publicationStatus: 'DRAFT'
};
const PRODUCER: NonNullable<AssuranceSubject['producer']> = {
	actorType: 'AGENT',
	agentId: 'jpwb-authoring-agent',
	modelId: CASE_PRODUCER_MODEL_ID,
	providerId: CASE_PRODUCER_PROVIDER_ID
};
const g8Graph = (id: string, withEndToEnd: boolean): GraphCase => ({
	id,
	arm: 'PWA_GRAPH',
	subject: { subjectId: G8_PWA_ID, objectType: 'PROFESSIONAL_WORK_ARCHITECTURE', semanticVersion: 1, isAiProduced: true, producer: PRODUCER },
	input: { prompt: REQUEST, pwa: G8_PWA, nodes: g8Nodes(withEndToEnd), rationale: G8_ACCOUNT, narration: G8_NARRATION }
});

/**
 * ⭐ THE 3-LEVEL PAIR (`REG-D-126` Q31; design §5): G8-CLEAN, and G8-RR-02, G8-CLEAN with End-to-End Verification omitted from
 * Verification's decomposition and its wiring — the type, its rule and the report's input from it — and nothing else:
 * Verification's purpose, prompt and output contract unchanged, the account silent. ⚠ SOURCES, NOT CASES: version eight holds
 * their parts, never the graphs whole.
 */
export const G8_GRAPHS: readonly GraphCase[] = [g8Graph('G8-CLEAN', true), g8Graph('G8-RR-02', false)];

// ── the part cases ─────────────────────────────────────────────────────────────────────────────────────────────────────
const SOURCES: ReadonlyMap<string, GraphCase> = new Map(
	[...CASE_SET_V7.cases.filter((c): c is GraphCase => c.arm === 'PWA_GRAPH'), ...G8_GRAPHS].map((c) => [c.id, c])
);
const sourceOf = (id: string): GraphCase => {
	const c = SOURCES.get(id);
	if (c === undefined) throw new Error(`no graph case ${id} to cut a part from`);
	return c;
};

/** A part case's id: its source's, a full stop, `T`, and the type's 1-based position in the source's export order, two digits. */
export function partCaseId(source: GraphCase, typeId: string): string {
	const at = source.input.nodes.findIndex((n) => n.id === typeId);
	if (at < 0) throw new Error(`${source.id} holds no type ${typeId}`);
	return `${source.id}.T${String(at + 1).padStart(2, '0')}`;
}

/** One part case: the source's whole input and the type reviewed; its subject that type, by the source's producer. */
function partCase(sourceId: string, typeId: string): PwaTypeCase {
	const source = sourceOf(sourceId);
	return {
		id: partCaseId(source, typeId),
		arm: 'PWA_TYPE',
		sourceCaseId: source.id,
		subject: {
			subjectId: typeId,
			objectType: 'PWU_TYPE',
			semanticVersion: 1,
			isAiProduced: true,
			producer: source.subject.producer
		},
		input: { typeId, ...source.input }
	};
}
/** Every part of a source, in its export order. */
const everyPart = (sourceId: string): PwaTypeCase[] => sourceOf(sourceId).input.nodes.map((n) => partCase(sourceId, n.id));
/** A source's root part. */
const rootPart = (sourceId: string): PwaTypeCase => partCase(sourceId, sourceOf(sourceId).input.nodes.find((n) => n.isRoot)!.id);

/** A type of a source, by its name — so the table below names each catcher as design §5 does. */
const typeNamed = (sourceId: string, name: string): string => {
	const n = sourceOf(sourceId).input.nodes.find((x) => x.name === name);
	if (n === undefined) throw new Error(`${sourceId} has no type named ${name}`);
	return n.id;
};

/**
 * ⭐ THE CATCHERS (`REG-D-126` Q30; design §5's table) — for each planted graph case, the one part that sees its plant whole,
 * by name, and the criterion it must fault; ⭐ Q31 adds `G8-RR-02`'s Verification. Descriptive and used: the part cases below
 * are made from it, and the cases test holds it to the table.
 */
export const CATCHERS_V8 = [
	{ source: 'G-RR-01', part: 'Pedestrian Bridge Concept Study', criterion: 'RR-01-no-problem-substitution' },
	{ source: 'G3-RR-02', part: 'Pedestrian Bridge Structural Review', criterion: 'RR-02-no-obligation-elision' },
	{ source: 'G3-RR-03', part: 'Load Analysis (static pedestrian load)', criterion: 'RR-03-no-unjustified-scope-reduction' },
	{ source: 'G3-RR-04', part: 'Vibration Compliance Statement', criterion: 'RR-04-no-proxy-satisfaction' },
	{ source: 'G3-RR-05', part: 'Pedestrian Bridge Structural Review', criterion: 'RR-05-no-premature-convergence' },
	{ source: 'G3-RR-06', part: 'Member, Connection and Foundation Design', criterion: 'RR-06-sound-inference' },
	{ source: 'G3-RR-07', part: 'Design Self-Check by the Senior Design Engineer', criterion: 'RR-07-no-contradiction' },
	{ source: 'G3-RR-08', part: 'Member, Connection and Foundation Design', criterion: 'RR-08-evidence-integrity' },
	{ source: 'G3-RR-09', part: 'Pedestrian Bridge Structural Review', criterion: 'RR-09-no-completeness-from-existence' },
	{ source: 'G7-RR-04', part: 'Verification', criterion: 'RR-04-no-proxy-satisfaction' },
	{ source: 'G7-RR-02', part: 'Implementation', criterion: 'RR-02-no-obligation-elision' },
	{ source: 'G7-RR-03-CHILD', part: 'Realization', criterion: 'RR-03-no-unjustified-scope-reduction' },
	{ source: 'G7-RR-03-PROMPT', part: 'Implementation', criterion: 'RR-03-no-unjustified-scope-reduction' },
	{ source: 'G7-RR-08', part: 'Implementation', criterion: 'RR-08-evidence-integrity' },
	{ source: 'G8-RR-02', part: 'Verification', criterion: 'RR-02-no-obligation-elision' }
] as const;

const catcher = (source: string): PwaTypeCase => {
	const row = CATCHERS_V8.find((r) => r.source === source)!;
	return partCase(source, typeNamed(source, row.part));
};

const PART_CASES_V8: readonly PwaTypeCase[] = [
	// The 13 clean parts (Q30): G3-CLEAN's seven, the three renamed copies' roots, then — after G3's catchers — G7-CLEAN's three.
	...everyPart('G3-CLEAN'),
	rootPart('G3-CLEAN-R1'),
	rootPart('G3-CLEAN-R2'),
	rootPart('G3-CLEAN-R3'),
	// The 14 catchers (Q30), in version seven's order of their sources.
	...['G-RR-01', 'G3-RR-02', 'G3-RR-03', 'G3-RR-04', 'G3-RR-05', 'G3-RR-06', 'G3-RR-07', 'G3-RR-08', 'G3-RR-09'].map(catcher),
	...everyPart('G7-CLEAN'),
	...['G7-RR-04', 'G7-RR-02', 'G7-RR-03-CHILD', 'G7-RR-03-PROMPT', 'G7-RR-08'].map(catcher),
	// The 3-level pair (Q31): G8-CLEAN's seven parts, then G8-RR-02's Verification.
	...everyPart('G8-CLEAN'),
	catcher('G8-RR-02')
];

export const CASE_SET_V8: CaseSet = {
	note:
		'GENERATED by `bun run scripts/reviewer-qual/generate.ts` from scripts/reviewer-qual/case-set-v8.ts — never ' +
		'hand-edited. Reviewer-qualification cases, version eight (JAN-EXEC Phase 7, the review in parts, B7; REG-D-125, ' +
		'REG-D-126): version seven’s 41 non-graph cases, unchanged and under their ids, then 35 PWA_TYPE part cases in place of ' +
		'its 19 graph cases — each one type of a graph case, its whole input and the type reviewed, cut by the product’s own ' +
		'pwaTypeParts and reviewed through pwaTypeReviewInput: the 13 clean parts and the 14 catchers of REG-D-126 Q30, and the ' +
		'seven parts of G8-CLEAN and the Verification of G8-RR-02, the 3-level pair of Q31. A part case’s id is its source ' +
		'case’s, a full stop, T and the type’s position in the source’s export order. Oracles are versioned separately, in ' +
		'../oracles/. Oracle integrity: no increment that edits the reviewer’s prompt, criteria or scoring edits these cases.',
	caseSetVersion: 8,
	cases: [...CASE_SET_V7.cases.filter((c) => c.arm !== 'PWA_GRAPH'), ...PART_CASES_V8]
};
