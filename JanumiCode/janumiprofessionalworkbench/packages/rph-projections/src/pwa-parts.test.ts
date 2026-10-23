// ⭐⭐ `JAN-EXEC` Phase 7, the review in parts, B1 (`REG-D-125`; DESIGN-authoring-review-in-parts.md D1-D3) — THE PARTS OF AN
// AUTHORED PWA, ONE PER TYPE: each its whole definition as the export carries it, and its place in the PWA as context.
//
// Each control below is the design's own (roadmap §9a.2): absent versus authored-empty fields, a delegated contract, stored
// context, the root's PWA description, sibling prompt text kept out of the skeletons, flow across a middle composite's
// boundary, and several roots (one part per type, no review added). The exports are built by the real builder over literal
// nodes, as every reviewer case's graph is.
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

	it('⭐ its PARENT’S RULE for it: the cardinality and applicability note the parent stores — or the parent’s name alone where it stores none', () => {
		expect(partOf('pwut_BUILD').context.parentRules).toEqual([
			{ parent: 'Realization', cardinality: 'M1', applicabilityNote: 'Every realization is built.' }
		]);
		expect(partOf('pwut_CHECK').context.parentRules, 'a rule with no note').toEqual([{ parent: 'Realization', cardinality: 'C1' }]);
		expect(partOf('pwut_CODE').context.parentRules, 'a parent that stores no rule for it').toEqual([{ parent: 'Build' }]);
		expect(partOf('pwut_ROOT').context.parentRules, 'the root has no parent').toEqual([]);
	});

	it('⭐ the ARTIFACTS it consumes and produces, with every type that produces and consumes each, by name', () => {
		expect(partOf('pwut_DOCS').context.artifacts).toEqual([
			{ name: 'manual', producedBy: ['Docs'], consumedBy: ['Test'] },
			{ name: 'source', producedBy: ['Code'], consumedBy: ['Docs', 'Test'] }
		]);
		expect(partOf('pwut_ROOT').context.artifacts).toEqual([
			{ name: 'report', producedBy: ['Realization', 'Check', 'Test'], consumedBy: [] },
			{ name: 'requirements', producedBy: [], consumedBy: ['Realization', 'Build', 'Code'] }
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
		expect(partOf('pwut_ROOT').context.dataFlow).toEqual({
			amongChildren: [
				{ producer: 'Code', consumer: 'Test', artifact: 'source' },
				{ producer: 'Docs', consumer: 'Test', artifact: 'manual' }
			],
			acrossBoundary: []
		});
		expect('dataFlow' in partOf('pwut_CODE').context, 'a leaf carries no data flow').toBe(false);
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
