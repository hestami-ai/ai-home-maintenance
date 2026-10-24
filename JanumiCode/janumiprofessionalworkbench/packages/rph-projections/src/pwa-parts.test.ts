// ⭐⭐ `JAN-EXEC` Phase 7, the review in parts, B1 (`REG-D-125`; DESIGN-authoring-review-in-parts.md D1-D3) — THE PARTS OF AN
// AUTHORED PWA, ONE PER TYPE: each its whole definition as the export carries it, and its place in the PWA as context.
//
// The design's own controls are here (roadmap §9a.2): absent versus authored-empty fields, a delegated contract, stored
// context, the root's PWA description, sibling prompt text kept out of the skeletons, flow across a middle composite's
// boundary, and several roots (one part per type, no review added). So are the package check's three: a leaf exported
// before its ancestors, a type two composites permit, and a flow between a composite and its own child. The exports are
// built by the real builder over literal nodes, as every reviewer case's graph is.
import { describe, expect, it } from 'vitest';
import { buildPwaGraphExport, type PwaGraphNode, type PwaMeta } from './pwa-graph.js';
import { pwaTypeParts } from './pwa-parts.js';

const PWA: PwaMeta = {
	id: 'pwa_01M5PARTS00000000000000P01',
	name: 'wordfreq',
	domain: 'software',
	version: '1.0.0',
	publicationStatus: 'DRAFT',
	description: 'Construct and verify wordfreq from the supplied requirements and design.'
};

const node = (over: Partial<PwaGraphNode> & Pick<PwaGraphNode, 'id' | 'name'>): PwaGraphNode => ({
	pwuKind: over.name.toUpperCase().replace(/\W+/g, '_'),
	isRoot: false,
	permittedChildTypeIds: [],
	requiredInputs: [],
	requiredOutputs: [],
	executionBoundary: 'INTERNAL',
	...over
});
const template = (text: string, contract?: string) => ({
	templateText: text,
	...(contract === undefined ? {} : { outputContract: contract }),
	status: 'ACTIVE' as const,
	templateVersion: 2
});

// ── A DEPTH-3 PWA: a root, two middle composites, three leaves, and a flow across both middles' boundaries ────────────
const ROOT = node({
	id: 'pwut_ROOT',
	name: 'Realization',
	isRoot: true,
	purpose: 'Construct and verify wordfreq.',
	permittedChildTypeIds: ['pwut_BUILD', 'pwut_CHECK'],
	permittedChildren: [
		{ typeId: 'pwut_BUILD', cardinality: 'M1', applicabilityNote: 'Every realization is built.' },
		{ typeId: 'pwut_CHECK', cardinality: 'C1' }
	],
	requiredInputs: ['requirements'],
	requiredOutputs: ['report'],
	promptTemplate: template('Realize {title} from its children’s work.', 'A JSON report.')
});
const BUILD = node({
	id: 'pwut_BUILD',
	name: 'Build',
	purpose: 'Build wordfreq.',
	permittedChildTypeIds: ['pwut_CODE', 'pwut_DOCS'],
	requiredInputs: ['requirements'],
	promptTemplate: template('Build {title}.', 'The build.')
});
const CODE = node({
	id: 'pwut_CODE',
	name: 'Code',
	purpose: 'Write the code.',
	requiredInputs: ['requirements'],
	requiredOutputs: ['source'],
	promptTemplate: template('SECRET-CODE-PROMPT write the code for {title}.', 'SECRET-CODE-CONTRACT the source files.')
});
const DOCS = node({
	id: 'pwut_DOCS',
	name: 'Docs',
	requiredInputs: ['source'],
	requiredOutputs: ['manual'],
	completionRule: '',
	promptTemplate: { templateText: 'SECRET-DOCS-PROMPT document {title}.', status: 'DRAFT', templateVersion: 1 }
});
const CHECK = node({
	id: 'pwut_CHECK',
	name: 'Check',
	purpose: 'Verify wordfreq.',
	permittedChildTypeIds: ['pwut_TEST'],
	requiredOutputs: ['report']
});
const TEST = node({
	id: 'pwut_TEST',
	name: 'Test',
	purpose: '',
	requiredInputs: ['source', 'manual'],
	requiredOutputs: ['report'],
	requiredAssurancePolicyIds: [],
	executionBoundary: 'DELEGATED_EXTERNAL',
	boundaryContract: { counterpartyLabel: 'An independent test lab', attestedAssurancePolicyIds: ['pol_test_adequacy'] },
	contextSpecification: {
		requiredElements: ['the source'],
		constraintDispositions: [{ constraintId: 'CON-1', fate: 'PROPAGATED' }]
	}
});
const NODES = [ROOT, BUILD, CODE, DOCS, CHECK, TEST];
const EXPORT = buildPwaGraphExport(PWA, NODES);
const partOf = (id: string) => pwaTypeParts(EXPORT).find((p) => p.typeId === id)!;

describe('⭐⭐ the review in parts, B1 — pwaTypeParts: one part per type, its whole definition the subject, its place in the PWA the context', () => {
	it('⭐ one part per type, in the export’s order, each its type’s own', () => {
		const parts = pwaTypeParts(EXPORT);
		expect(parts.map((p) => p.typeId)).toEqual(NODES.map((n) => n.id));
		for (const p of parts) expect(p.subject.type.id, p.typeId).toBe(p.typeId);
	});

	it('⭐ the SUBJECT is the type exactly as the export carries it — every field, its prompt text and output contract, absent fields absent and empty ones as authored', () => {
		for (const n of NODES) expect(partOf(n.id).subject.type, n.id).toStrictEqual(EXPORT.nodes.find((x) => x.id === n.id));
		expect(partOf('pwut_CODE').subject.type.promptTemplate, 'the type’s own prompt, whole').toEqual(CODE.promptTemplate);
		// ⛔ Absent stays absent: no purpose was authored for Docs, and none is manufactured.
		expect('purpose' in partOf('pwut_DOCS').subject.type, 'an absent purpose').toBe(false);
		// ⭐ An authored empty value stays authored.
		expect([partOf('pwut_DOCS').subject.type.completionRule, partOf('pwut_TEST').subject.type.purpose]).toEqual(['', '']);
		expect(partOf('pwut_TEST').subject.type.requiredAssurancePolicyIds, 'an authored empty list').toEqual([]);
	});

	it('⭐ a delegated type’s boundary contract and a stored context specification are in its subject', () => {
		const t = partOf('pwut_TEST').subject.type;
		expect(t.boundaryContract).toEqual({ counterpartyLabel: 'An independent test lab', attestedAssurancePolicyIds: ['pol_test_adequacy'] });
		expect(t.contextSpecification).toEqual(TEST.contextSpecification);
	});

	it('⭐ the root’s subject carries the PWA’s name, domain and description; no other type’s does', () => {
		expect(partOf('pwut_ROOT').subject.pwa).toEqual({ name: 'wordfreq', domain: 'software', description: PWA.description });
		for (const id of ['pwut_BUILD', 'pwut_CODE', 'pwut_DOCS', 'pwut_CHECK', 'pwut_TEST'])
			expect('pwa' in partOf(id).subject, id).toBe(false);
	});

	it('⛔ a PWA that stores no description gives its root none; an empty one is carried as authored', () => {
		const { description: _absent, ...bare } = PWA;
		const none = pwaTypeParts(buildPwaGraphExport(bare, NODES))[0]!.subject.pwa;
		expect(none, 'a PWA with no description').toEqual({ name: 'wordfreq', domain: 'software' });
		expect(none !== undefined && 'description' in none).toBe(false);
		expect(pwaTypeParts(buildPwaGraphExport({ ...PWA, description: '' }, NODES))[0]!.subject.pwa?.description).toBe('');
	});

	it('⭐ the ANCESTORS, the root first, each with its name, kind and purpose — and no purpose where none was authored', () => {
		expect(partOf('pwut_CODE').context.ancestors).toEqual([
			{ name: 'Realization', pwuKind: 'REALIZATION', purpose: 'Construct and verify wordfreq.' },
			{ name: 'Build', pwuKind: 'BUILD', purpose: 'Build wordfreq.' }
		]);
		expect(partOf('pwut_ROOT').context.ancestors, 'the root has none').toEqual([]);
		const unnamedPurpose = pwaTypeParts(
			buildPwaGraphExport(PWA, [node({ id: 'r', name: 'R', isRoot: true, permittedChildTypeIds: ['c'] }), node({ id: 'c', name: 'C' })])
		)[1]!.context.ancestors;
		expect(unnamedPurpose, 'an ancestor with no purpose carries none').toEqual([{ name: 'R', pwuKind: 'R' }]);
	});

	it('⭐ the ancestors are ROOT FIRST by their depth below a root, not by the export’s order — a leaf the agent defined before the composites that permit it', () => {
		const leaf = node({ id: 'l', name: 'Leaf' });
		const middle = node({ id: 'm', name: 'Middle', purpose: 'Build the middle.', permittedChildTypeIds: ['l'] });
		const root = node({ id: 'r', name: 'Root', isRoot: true, purpose: 'Build the whole.', permittedChildTypeIds: ['m'] });
		const ex = buildPwaGraphExport(PWA, [leaf, middle, root]);
		expect(ex.nodes.map((n) => n.id), 'arrangement: the leaf is exported first and the root last').toEqual(['l', 'm', 'r']);
		expect(pwaTypeParts(ex)[0]!.context.ancestors).toEqual([
			{ name: 'Root', pwuKind: 'ROOT', purpose: 'Build the whole.' },
			{ name: 'Middle', pwuKind: 'MIDDLE', purpose: 'Build the middle.' }
		]);
	});

	it('⭐ its PARENT’S RULE for it: the cardinality and applicability note the parent stores — or the parent’s name alone where it stores none', () => {
		expect(partOf('pwut_BUILD').context.parentRules).toEqual([
			{ parent: 'Realization', cardinality: 'M1', applicabilityNote: 'Every realization is built.' }
		]);
		expect(partOf('pwut_CHECK').context.parentRules, 'a rule with no note').toEqual([{ parent: 'Realization', cardinality: 'C1' }]);
		expect(partOf('pwut_CODE').context.parentRules, 'a parent that stores no rule for it').toEqual([{ parent: 'Build' }]);
		expect(partOf('pwut_ROOT').context.parentRules, 'the root has no parent').toEqual([]);
	});

	it('⭐ a type two composites permit gets EACH one’s rule for it, in the export’s order — not the first parent’s alone', () => {
		const shared = node({ id: 's', name: 'Shared' });
		const first = node({
			id: 'a',
			name: 'First',
			permittedChildTypeIds: ['s'],
			permittedChildren: [{ typeId: 's', cardinality: 'M1', applicabilityNote: 'Every first is shared.' }]
		});
		const second = node({ id: 'b', name: 'Second', permittedChildTypeIds: ['s'], permittedChildren: [{ typeId: 's', cardinality: 'C1' }] });
		const root = node({ id: 'r', name: 'Root', isRoot: true, permittedChildTypeIds: ['a', 'b'] });
		const parts = pwaTypeParts(buildPwaGraphExport(PWA, [root, first, second, shared]));
		expect(parts.find((p) => p.typeId === 's')!.context.parentRules).toEqual([
			{ parent: 'First', cardinality: 'M1', applicabilityNote: 'Every first is shared.' },
			{ parent: 'Second', cardinality: 'C1' }
		]);
	});

	it('⭐ the ARTIFACTS it consumes and produces, with every type that produces and consumes each, by name', () => {
		expect(partOf('pwut_DOCS').context.artifacts).toEqual([
			{ name: 'manual', producedBy: ['Docs'], consumedBy: ['Test'] },
			{ name: 'source', producedBy: ['Code'], consumedBy: ['Docs', 'Test'] }
		]);
		// ⭐ A2 (2) — ~~'Realization', 'Check', 'Test'~~ and ~~'Realization', 'Build', 'Code'~~: the root names its children, never
		// its grandchildren — Test by Check, whose subtree holds it, and Code by Build.
		expect(partOf('pwut_ROOT').context.artifacts).toEqual([
			{ name: 'report', producedBy: ['Realization', 'Check'], consumedBy: [] },
			{ name: 'requirements', producedBy: [], consumedBy: ['Realization', 'Build'] }
		]);
	});

	it('⭐ its CHILDREN’S SKELETONS, in the order it permits them: every exported field, the prompt template’s status and version kept', () => {
		const skeletons = partOf('pwut_BUILD').childSkeletons;
		expect(skeletons.map((s) => s.id)).toEqual(['pwut_CODE', 'pwut_DOCS']);
		const { promptTemplate: _codeTemplate, ...codeRest } = CODE;
		expect(skeletons[0], 'Code, field for field').toStrictEqual({ ...codeRest, promptTemplate: { status: 'ACTIVE', templateVersion: 2 } });
		expect(Object.keys(skeletons[0]!), 'in the export’s key order').toEqual(Object.keys(EXPORT.nodes.find((n) => n.id === 'pwut_CODE')!));
		expect(skeletons[1]!.promptTemplate, 'a DRAFT template stays DRAFT').toEqual({ status: 'DRAFT', templateVersion: 1 });
		expect(partOf('pwut_CHECK').childSkeletons[0], 'a delegated child keeps its contract').toStrictEqual(TEST);
		expect(partOf('pwut_CODE').childSkeletons, 'a leaf has none').toEqual([]);
	});

	it('⛔ A SIBLING’S PROMPT TEXT AND OUTPUT CONTRACT ARE IN NO PART BUT ITS OWN — a skeleton never carries them', () => {
		const parts = pwaTypeParts(EXPORT);
		for (const secret of ['SECRET-CODE-PROMPT', 'SECRET-CODE-CONTRACT', 'SECRET-DOCS-PROMPT']) {
			const holders = parts.filter((p) => JSON.stringify(p).includes(secret)).map((p) => p.typeId);
			expect(holders, secret).toEqual([secret.includes('DOCS') ? 'pwut_DOCS' : 'pwut_CODE']);
		}
	});

	it('⭐ a composite’s DATA FLOW: among its children’s subtrees, and across its own subtree’s boundary — a middle composite’s included', () => {
		// Build's subtree is Build, Code and Docs: Code → Docs stays inside one composite's children, and source and manual leave
		// it for Test, in Check's subtree.
		expect(partOf('pwut_BUILD').context.dataFlow).toEqual({
			amongChildren: [{ producer: 'Code', consumer: 'Docs', artifact: 'source' }],
			acrossBoundary: [
				{ producer: 'Code', consumer: 'Test', artifact: 'source' },
				{ producer: 'Docs', consumer: 'Test', artifact: 'manual' }
			]
		});
		// Check's subtree is Check and Test: the same two flows enter it, and none is among its children (it has one).
		expect(partOf('pwut_CHECK').context.dataFlow).toEqual({
			amongChildren: [],
			acrossBoundary: [
				{ producer: 'Code', consumer: 'Test', artifact: 'source' },
				{ producer: 'Docs', consumer: 'Test', artifact: 'manual' }
			]
		});
		// The root's children are Build and Check: both flows run between their subtrees, and Code → Docs stays inside Build's.
		// ⭐ A2 (2) — named by child: ~~Code → Test~~ and ~~Docs → Test~~ are Build → Check, each for its own artifact.
		expect(partOf('pwut_ROOT').context.dataFlow).toEqual({
			amongChildren: [
				{ producer: 'Build', consumer: 'Check', artifact: 'source' },
				{ producer: 'Build', consumer: 'Check', artifact: 'manual' }
			],
			acrossBoundary: []
		});
		expect('dataFlow' in partOf('pwut_CODE').context, 'a leaf carries no data flow').toBe(false);
	});

	it('⭐ A2 (2) — A COMPOSITE’S CONTEXT NAMES ITS CHILDREN, NEVER ITS GRANDCHILDREN: each data-flow and artifact peer inside its subtree is named by the child whose subtree holds it', () => {
		// The root's grandchildren are Code and Docs (under Build) and Test (under Check). ⛔ Named as themselves, the root's
		// part showed the reviewer types it is not shown and whose composition is their parent's to judge.
		const root = partOf('pwut_ROOT').context;
		const named = JSON.stringify({ artifacts: root.artifacts, dataFlow: root.dataFlow });
		for (const grandchild of ['Code', 'Docs', 'Test']) expect(named, grandchild).not.toContain(`"${grandchild}"`);
		expect(root.artifacts, 'each peer by the child whose subtree holds it, once, the root by its own name').toEqual([
			{ name: 'report', producedBy: ['Realization', 'Check'], consumedBy: [] },
			{ name: 'requirements', producedBy: [], consumedBy: ['Realization', 'Build'] }
		]);
		expect(root.dataFlow, 'Code → Test and Docs → Test, between Build’s subtree and Check’s, by child').toEqual({
			amongChildren: [
				{ producer: 'Build', consumer: 'Check', artifact: 'source' },
				{ producer: 'Build', consumer: 'Check', artifact: 'manual' }
			],
			acrossBoundary: []
		});
	});

	it('⭐ A2 (2) — a MIDDLE composite names its own children for the flows inside its subtree, and an outside endpoint by its own name; two flows that name the same pair are listed once', () => {
		// Middle's children are Left and Right; Left's own children, Deep and Deeper, each produce the same draft that Right
		// consumes, and Deep consumes the root's brief, from outside Middle's subtree.
		const deep = node({ id: 'd', name: 'Deep', requiredInputs: ['brief'], requiredOutputs: ['draft'] });
		const deeper = node({ id: 'e', name: 'Deeper', requiredOutputs: ['draft'] });
		const left = node({ id: 'l', name: 'Left', permittedChildTypeIds: ['d', 'e'] });
		const right = node({ id: 'g', name: 'Right', requiredInputs: ['draft'] });
		const middle = node({ id: 'm', name: 'Middle', permittedChildTypeIds: ['l', 'g'] });
		const root = node({ id: 'r', name: 'Root', isRoot: true, permittedChildTypeIds: ['m'], requiredOutputs: ['brief'] });
		const ex = buildPwaGraphExport(PWA, [root, middle, left, right, deep, deeper]);
		expect(ex.dataFlow, 'arrangement: brief from the root to Deep, and draft from each of Deep and Deeper to Right').toEqual([
			{ producer: 'r', consumer: 'd', artifact: 'brief' },
			{ producer: 'd', consumer: 'g', artifact: 'draft' },
			{ producer: 'e', consumer: 'g', artifact: 'draft' }
		]);
		const contextOf = (id: string) => pwaTypeParts(ex).find((p) => p.typeId === id)!.context;
		expect(contextOf('m').dataFlow).toEqual({
			amongChildren: [{ producer: 'Left', consumer: 'Right', artifact: 'draft' }],
			acrossBoundary: [{ producer: 'Root', consumer: 'Left', artifact: 'brief' }]
		});
		expect(contextOf('r').dataFlow, 'the root: every flow it holds is inside Middle’s subtree').toEqual({ amongChildren: [], acrossBoundary: [] });
		expect(contextOf('r').artifacts, 'the root’s brief, its consumer by the root’s child').toEqual([
			{ name: 'brief', producedBy: ['Root'], consumedBy: ['Middle'] }
		]);
		// ⭐ CONTROL — a LEAF names every peer as itself: it has no subtree to aggregate into.
		expect(contextOf('g').artifacts).toEqual([{ name: 'draft', producedBy: ['Deep', 'Deeper'], consumedBy: ['Right'] }]);
	});

	it('⭐ A2 (2) — a type two of a composite’s children permit is named by EACH of them, in the order the composite permits them', () => {
		const shared = node({ id: 's', name: 'Shared', requiredOutputs: ['part'] });
		const first = node({ id: 'a', name: 'First', permittedChildTypeIds: ['s'] });
		const second = node({ id: 'b', name: 'Second', permittedChildTypeIds: ['s'] });
		const root = node({ id: 'r', name: 'Root', isRoot: true, permittedChildTypeIds: ['a', 'b'], requiredInputs: ['part'] });
		const part = pwaTypeParts(buildPwaGraphExport(PWA, [root, first, second, shared]))[0]!;
		expect(part.context.artifacts).toEqual([{ name: 'part', producedBy: ['First', 'Second'], consumedBy: ['Root'] }]);
	});

	it('⛔ a flow between a composite and its OWN child is in neither list of its data flow, and not among its parent’s children — the composite’s own artifacts carry it', () => {
		// Middle feeds its child (brief) and consumes its child's output (draft); the root feeds Middle (plan); the child's
		// draft also leaves Middle's subtree for Sibling, the root's other child.
		const root = node({ id: 'r', name: 'Root', isRoot: true, permittedChildTypeIds: ['p', 'q'], requiredOutputs: ['plan'] });
		const middle = node({
			id: 'p',
			name: 'Middle',
			permittedChildTypeIds: ['c'],
			requiredInputs: ['plan', 'draft'],
			requiredOutputs: ['brief']
		});
		const child = node({ id: 'c', name: 'Child', requiredInputs: ['brief'], requiredOutputs: ['draft'] });
		const sibling = node({ id: 'q', name: 'Sibling', requiredInputs: ['draft'] });
		const ex = buildPwaGraphExport(PWA, [root, middle, child, sibling]);
		expect(ex.dataFlow, 'arrangement: a flow from the root to Middle, and each way between Middle and its child').toEqual([
			{ producer: 'r', consumer: 'p', artifact: 'plan' },
			{ producer: 'p', consumer: 'c', artifact: 'brief' },
			{ producer: 'c', consumer: 'p', artifact: 'draft' },
			{ producer: 'c', consumer: 'q', artifact: 'draft' }
		]);
		const contextOf = (id: string) => pwaTypeParts(ex).find((p) => p.typeId === id)!.context;
		expect(contextOf('p').dataFlow, 'Middle: brief and draft between it and its child are in neither list').toEqual({
			amongChildren: [],
			acrossBoundary: [
				{ producer: 'Root', consumer: 'Middle', artifact: 'plan' },
				{ producer: 'Child', consumer: 'Sibling', artifact: 'draft' }
			]
		});
		expect(contextOf('p').artifacts, 'Middle’s own artifacts carry both, each end named').toEqual([
			{ name: 'brief', producedBy: ['Middle'], consumedBy: ['Child'] },
			{ name: 'draft', producedBy: ['Child'], consumedBy: ['Middle', 'Sibling'] },
			{ name: 'plan', producedBy: ['Root'], consumedBy: ['Middle'] }
		]);
		// ⭐ A2 (2) — the draft's producer by the root's child whose subtree holds it: ~~Child~~ Middle.
		expect(contextOf('r').dataFlow, 'the root: plan, from it to its child, is not among its children; draft, between two children’s subtrees, is').toEqual({
			amongChildren: [{ producer: 'Middle', consumer: 'Sibling', artifact: 'draft' }],
			acrossBoundary: []
		});
	});

	it('⭐ SEVERAL ROOTS: still one part per type, no review added for the whole — and each root’s subject carries the PWA', () => {
		const second = node({ id: 'pwut_ROOT2', name: 'Second Root', isRoot: true });
		const ex = buildPwaGraphExport(PWA, [...NODES, second]);
		expect(ex.roots, 'arrangement: two roots').toEqual(['pwut_ROOT', 'pwut_ROOT2']);
		const parts = pwaTypeParts(ex);
		expect(parts.map((p) => p.typeId)).toEqual([...NODES.map((n) => n.id), 'pwut_ROOT2']);
		expect(parts.filter((p) => p.subject.pwa !== undefined).map((p) => p.typeId)).toEqual(['pwut_ROOT', 'pwut_ROOT2']);
	});

	it('⭐ terminates on a cycle, and a type is never its own ancestor', () => {
		const a = node({ id: 'a', name: 'A', isRoot: true, permittedChildTypeIds: ['b'] });
		const b = node({ id: 'b', name: 'B', permittedChildTypeIds: ['a'] });
		const parts = pwaTypeParts(buildPwaGraphExport(PWA, [a, b]));
		expect(parts.map((p) => p.context.ancestors.map((x) => x.name))).toEqual([['B'], ['A']]);
	});
});

// ── ⭐⭐ D3a (`REG-D-127`; `REG-F-573`) — THE DECLARED POLICIES NAMED, AND THOSE THE KIND MAY TAKE ──────────────────────────
// A part showed its declared policies as ids alone, and no list of the policies its kind may take, so it could not show that
// a Test Adequacy policy exists and is missing (`G7-RR-02.T02`, SATISFIED twice). The library is the policy view the authoring
// surface reads (`rph-authoring` `listPolicies`): each policy's id, name, purpose, status, floor membership and kinds.
const TEST_ADEQUACY = {
	id: 'pol_test_adequacy',
	name: 'Test Adequacy',
	purpose: 'Determine whether the available tests are sufficient to support the claims being made.',
	version: '1.0.0',
	status: 'ACTIVE',
	isFloor: false,
	pwuKinds: ['PRODUCT_IMPLEMENTATION', 'INTEGRATED_PRODUCT_VALIDATION']
};
const INTENT_PRESERVATION = {
	id: 'pol_intent_preservation',
	name: 'Intent Preservation',
	purpose: 'Determine whether a transformation of professional work remains faithful to the authorized intent.',
	version: '1.0.0',
	status: 'ACTIVE',
	isFloor: false,
	pwuKinds: ['PRODUCT_IMPLEMENTATION', 'PRODUCT_REALIZATION']
};
/** The library: the two above; a floor policy and an inactive one, each naming the kind; one naming no kind; one another kind. */
const LIBRARY = [
	{ id: 'floor.reasoning-review', name: 'Reasoning Review', purpose: 'The floor’s review.', version: '1.0.0', status: 'ACTIVE', isFloor: true, pwuKinds: ['PRODUCT_IMPLEMENTATION'] },
	INTENT_PRESERVATION,
	{ id: 'pol_draft_style', name: 'Draft Style', purpose: 'Not yet in force.', version: '0.1.0', status: 'DRAFT', isFloor: false, pwuKinds: ['PRODUCT_IMPLEMENTATION'] },
	TEST_ADEQUACY,
	{ id: 'pol_any_kind', name: 'Any Kind', purpose: 'Governs every kind of work.', version: '1.0.0', status: 'ACTIVE', isFloor: false },
	{ id: 'pol_baseline_promotion', name: 'Baseline Promotion', purpose: 'Another kind’s.', version: '1.0.0', status: 'ACTIVE', isFloor: false, pwuKinds: ['PRODUCT_BASELINE_PROMOTION'] }
];
const IMPLEMENTATION = node({
	id: 'pwut_IMPL',
	name: 'Implementation',
	pwuKind: 'PRODUCT_IMPLEMENTATION',
	isRoot: true,
	requiredAssurancePolicyIds: ['pol_intent_preservation']
});
const shown = (p: { id: string; name: string; purpose: string }) => ({ id: p.id, name: p.name, purpose: p.purpose });

describe('⭐⭐ D3a (REG-D-127) — a part names its declared policies, and lists the ACTIVE non-floor policies its kind may take', () => {
	it('⛔ RED FIRST — a part whose kind may take Test Adequacy and which does not declare it SHOWS BOTH FACTS: its declared policies lack it, and its applicable list holds Test Adequacy’s id, name and purpose', () => {
		const [part] = pwaTypeParts(buildPwaGraphExport(PWA, [IMPLEMENTATION]), LIBRARY);
		expect(part!.subject.declaredPolicies, 'the declared one, named').toEqual([shown(INTENT_PRESERVATION)]);
		expect(part!.subject.declaredPolicies!.map((p) => p.id), 'its declared policies lack Test Adequacy').not.toContain('pol_test_adequacy');
		expect(part!.context.applicablePolicies, 'what its kind may take, Test Adequacy among them').toContainEqual(shown(TEST_ADEQUACY));
	});

	it('⭐ the applicable list: every ACTIVE non-floor policy whose kinds name the subject’s kind or name none, in the library’s order — ⛔ CONTROLS: a floor policy, an inactive one and another kind’s are not listed', () => {
		const [part] = pwaTypeParts(buildPwaGraphExport(PWA, [IMPLEMENTATION]), LIBRARY);
		expect(part!.context.applicablePolicies?.map((p) => p.id)).toEqual(['pol_intent_preservation', 'pol_test_adequacy', 'pol_any_kind']);
		for (const id of ['floor.reasoning-review', 'pol_draft_style', 'pol_baseline_promotion'])
			expect(JSON.stringify(part!.context), `${id} is not listed`).not.toContain(id);
	});

	it('⭐ a policy naming NO kind is listed for every kind — and one naming an empty list of kinds names none, as the kernel reads it', () => {
		const kinds = ['PRODUCT_IMPLEMENTATION', 'STRUCTURAL_REVIEW', 'SITE_INVESTIGATION'];
		const library = [...LIBRARY, { id: 'pol_empty_kinds', name: 'Empty Kinds', purpose: 'An empty list.', version: '1.0.0', status: 'ACTIVE', isFloor: false, pwuKinds: [] }];
		for (const kind of kinds) {
			const [part] = pwaTypeParts(buildPwaGraphExport(PWA, [{ ...IMPLEMENTATION, pwuKind: kind }]), library);
			const ids = part!.context.applicablePolicies?.map((p) => p.id);
			expect(ids, kind).toContain('pol_any_kind');
			expect(ids, kind).toContain('pol_empty_kinds');
		}
		const [other] = pwaTypeParts(buildPwaGraphExport(PWA, [{ ...IMPLEMENTATION, pwuKind: 'STRUCTURAL_REVIEW' }]), LIBRARY);
		expect(other!.context.applicablePolicies, 'a kind no policy names: the no-kind policy alone').toEqual([shown(LIBRARY[4]!)]);
	});

	it('⭐ each declared policy is shown with its id, name and purpose, in its declared order — ⚠ a declared id the library does not hold by its id alone; no declared list where the type declares none; an authored empty list as authored', () => {
		const declaring = { ...IMPLEMENTATION, requiredAssurancePolicyIds: ['pol_test_adequacy', 'pol_retired_elsewhere', 'pol_intent_preservation'] };
		const [part] = pwaTypeParts(buildPwaGraphExport(PWA, [declaring]), LIBRARY);
		expect(part!.subject.declaredPolicies).toEqual([shown(TEST_ADEQUACY), { id: 'pol_retired_elsewhere' }, shown(INTENT_PRESERVATION)]);
		const { requiredAssurancePolicyIds: _none, ...silent } = IMPLEMENTATION;
		expect('declaredPolicies' in pwaTypeParts(buildPwaGraphExport(PWA, [silent]), LIBRARY)[0]!.subject, 'a type that declares none').toBe(false);
		expect(pwaTypeParts(buildPwaGraphExport(PWA, [{ ...IMPLEMENTATION, requiredAssurancePolicyIds: [] }]), LIBRARY)[0]!.subject.declaredPolicies).toEqual([]);
	});

	it('⭐ the subject’s keys: its type, then its declared policies, then the PWA on a root; the context’s applicable policies last — and no library leaves both out, as case set v8 measured its parts', () => {
		const [part] = pwaTypeParts(buildPwaGraphExport(PWA, [IMPLEMENTATION]), LIBRARY);
		expect(Object.keys(part!.subject)).toEqual(['type', 'declaredPolicies', 'pwa']);
		expect(Object.keys(part!.context)).toEqual(['ancestors', 'parentRules', 'artifacts', 'applicablePolicies']);
		const [bare] = pwaTypeParts(buildPwaGraphExport(PWA, [IMPLEMENTATION]));
		expect([Object.keys(bare!.subject), Object.keys(bare!.context)]).toEqual([['type', 'pwa'], ['ancestors', 'parentRules', 'artifacts']]);
		expect(pwaTypeParts(buildPwaGraphExport(PWA, [IMPLEMENTATION]), [])[0]!.context.applicablePolicies, 'an empty library lists none').toEqual([]);
	});
});
