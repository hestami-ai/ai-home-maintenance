import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	STRUCTURAL_MODULE_REACHABILITY_REPORT_NONCLAIMS,
	STRUCTURAL_MODULE_REACHABILITY_REPORT_OPERATION_VERSION,
	STRUCTURAL_MODULE_REACHABILITY_REPORT_REQUEST_SCHEMA_VERSION,
	type StructuralModuleReachabilityReportRequest
} from '../contracts/structural-module-reachability-report.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import {
	runStructuralModuleReachabilityReport,
	structuralModuleReachabilityReportExitCode
} from './run-structural-module-reachability-report.js';

const temporaryRoots: string[] = [];

function write(root: string, path: string, contents: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents, 'utf8');
}

function json(root: string, path: string, value: unknown): void {
	write(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-reachability-report-'));
	temporaryRoots.push(root);
	json(root, 'package.json', {
		name: 'reachability-report-fixture',
		private: true,
		workspaces: ['packages/*']
	});
	json(root, 'packages/demo/package.json', {
		name: '@fixture/reachability-report',
		private: true,
		version: '0.0.0'
	});
	json(root, 'packages/demo/tsconfig.json', {
		compilerOptions: {
			module: 'NodeNext',
			moduleResolution: 'NodeNext',
			noEmit: true,
			noLib: true,
			strict: true,
			target: 'ES2022'
		},
		files: ['src/entry.ts', 'src/leaf.ts', 'src/middle.ts', 'src/unrelated.ts']
	});
	write(root, 'packages/demo/src/leaf.ts', 'export const leaf = 1;\n');
	write(root, 'packages/demo/dist/generated.ts', 'export const generated = true;\n');
	write(
		root,
		'packages/demo/src/middle.ts',
		"import { leaf } from './leaf.js';\nexport const middle = leaf + 1;\n"
	);
	write(
		root,
		'packages/demo/src/entry.ts',
		"import { middle } from './middle.js';\nexport const entry = middle + 1;\n"
	);
	write(
		root,
		'packages/demo/src/unrelated.ts',
		"import { absent } from './absent.js';\nexport const unrelated = absent;\n"
	);
	write(root, 'bun.lock', 'fixture lock\n');
	return root;
}

function request(
	overrides: Partial<StructuralModuleReachabilityReportRequest> = {}
): StructuralModuleReachabilityReportRequest {
	return {
		budgets: {
			maxResultBytes: 16 * 1024 * 1024,
			reachability: {
				maxDiagnostics: 1_000,
				maxEdges: 10_000,
				maxFrontierRecords: 10_000,
				maxInputRecords: 1_000_000,
				maxInputStringCharacters: 10_000_000,
				maxNodes: 10_000,
				maxReachableNodes: 10_000,
				maxTraversalSteps: 20_000,
				maxWitnessEdges: 10_000
			},
			semantic: {
				maxAstDepth: 256,
				maxAstNodes: 100_000,
				maxCompilerInputMetadataBytes: 16 * 1024 * 1024,
				maxCompilerQueries: 100_000,
				maxCompilerFacts: 100_000,
				maxCompilerQueryInvocations: 1_000_000,
				maxContextBytes: 32 * 1024 * 1024,
				maxContextFileBytes: 8 * 1024 * 1024,
				maxContextFiles: 10_000,
				maxDiagnosticCharacters: 1_000_000,
				maxDiagnostics: 10_000,
				maxDirectoryEntries: 1_000_000,
				maxDurationMs: 60_000,
				maxLiteralCharacters: 10_000,
				maxPathCharacters: 2_000,
				maxProjects: 10,
				maxScopes: 100_000,
				maxSnapshotBytes: 64 * 1024 * 1024,
				maxSources: 10_000
			},
			subject: {
				maxBytes: 32 * 1024 * 1024,
				maxConfigDepth: 32,
				maxDiagnostics: 1_000,
				maxDurationMs: 30_000,
				maxFiles: 10_000,
				maxProjects: 10
			}
		},
		criterionLogicalPath: 'packages/demo/src/leaf.ts',
		direction: 'REVERSE',
		operationVersion: STRUCTURAL_MODULE_REACHABILITY_REPORT_OPERATION_VERSION,
		projectConfigPath: 'packages/demo/tsconfig.json',
		schemaVersion: STRUCTURAL_MODULE_REACHABILITY_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: ['packages/demo/tsconfig.json'],
		...overrides
	};
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('runStructuralModuleReachabilityReport', () => {
	it('renders deterministic reverse structural importer candidates and original import witnesses', () => {
		const root = fixture();
		const first = runStructuralModuleReachabilityReport(request(), { repositoryRoot: root });
		expect(first.outcome).toBe('partial');
		expect(structuralModuleReachabilityReportExitCode(first)).toBe(3);
		if (first.outcome !== 'partial') throw new Error(JSON.stringify(first));

		expect(first.result.capability).toEqual({
			changeImpact: 'NOT_CLAIMED',
			codeSlice: 'NOT_CLAIMED',
			id: 'JAN-CSAA-CAP-027',
			semanticQuery: 'NOT_CLAIMED',
			status: 'PARTIAL'
		});
		expect(first.result.facadeNonclaims).toBe(STRUCTURAL_MODULE_REACHABILITY_REPORT_NONCLAIMS);
		expect(first.result.interpretation).toBe('STRUCTURAL_IMPORTER_CANDIDATES');
		expect(first.result.currentness).toMatchObject({
			changedPaths: [],
			scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
			state: 'CURRENT_FOR_CAPTURED_SUBJECT'
		});
		expect(first.result.analysis).toMatchObject({
			capability: 'JAN-CSAA-CAP-027',
			capabilityStatus: 'PARTIAL',
			direction: 'REVERSE',
			health: 'PARTIAL',
			structuralClosure: 'EXACT_FOR_SELECTED_VALIDATED_GRAPH_AND_CRITERION',
			truncation: { reason: null, state: 'NOT_TRUNCATED' }
		});

		const pathByNode = new Map(
			first.result.evidence.nodes.flatMap((node) =>
				node.kind === 'SOURCE' ? [[node.id, node.logicalPath] as const] : []
			)
		);
		expect(
			first.result.analysis.members.map((member) => ({
				distance: member.distance,
				path: pathByNode.get(member.nodeId)
			}))
		).toEqual([
			{ distance: 0, path: 'packages/demo/src/leaf.ts' },
			{ distance: 1, path: 'packages/demo/src/middle.ts' },
			{ distance: 2, path: 'packages/demo/src/entry.ts' }
		]);
		expect(
			first.result.evidence.witnessEdges.map((edge) => ({
				source: pathByNode.get(edge.source.nodeId),
				specifier: edge.specifier,
				target: pathByNode.get(edge.target.nodeId)
			}))
		).toEqual([
			{
				source: 'packages/demo/src/entry.ts',
				specifier: './middle.js',
				target: 'packages/demo/src/middle.ts'
			},
			{
				source: 'packages/demo/src/middle.ts',
				specifier: './leaf.js',
				target: 'packages/demo/src/leaf.ts'
			}
		]);
		expect(
			first.result.evidence.witnessEdges.every((edge) => edge.sourceLocations.length > 0)
		).toBe(true);
		const pathBySource = new Map(
			first.result.evidence.sources.map((source) => [source.id, source.logicalPath] as const)
		);
		const limitationSourceIds = new Set(
			[
				...first.result.analysis.upstreamLimitations,
				...first.result.sourceGraphSummary.limitations
			].flatMap((limitation) => (limitation.sourceId === null ? [] : [limitation.sourceId]))
		);
		expect([...limitationSourceIds].every((sourceId) => pathBySource.has(sourceId))).toBe(true);
		expect([...pathBySource.values()]).toContain('packages/demo/src/unrelated.ts');
		expect([...pathByNode.values()]).not.toContain('packages/demo/src/unrelated.ts');

		const firstJson = canonicalSemanticJson(first);
		expect(firstJson).not.toContain(root);
		expect(firstJson).not.toContain(root.replaceAll('\\', '/'));
		const second = runStructuralModuleReachabilityReport(request(), { repositoryRoot: root });
		expect(canonicalSemanticJson(second)).toBe(firstJson);
	});

	it('fails closed on hostile shape, traversal, excess ceilings, and absent paths', () => {
		const root = fixture();
		const extra = { ...request(), unexpected: true };
		const traversing = request({ criterionLogicalPath: '../escape.ts' });
		const excessive = request({
			budgets: { ...request().budgets, maxResultBytes: 64 * 1024 * 1024 + 1 }
		});
		const missing = request({ criterionLogicalPath: 'packages/demo/src/missing.ts' });
		const criterionProjectOutsideSubject = request({ subjectProjectConfigPaths: ['package.json'] });
		const excluded = request({ criterionLogicalPath: 'packages/demo/dist/generated.ts' });
		const proxy = new Proxy(request(), {});
		const accessorProjects = ['packages/demo/tsconfig.json'];
		Object.defineProperty(accessorProjects, '0', {
			configurable: true,
			enumerable: true,
			get: () => {
				throw new Error('The request boundary must not invoke array accessors.');
			}
		});
		const accessorArray = request({ subjectProjectConfigPaths: accessorProjects });
		const customPrototypeProjects = ['packages/demo/tsconfig.json'];
		Object.setPrototypeOf(customPrototypeProjects, Object.create(Array.prototype));
		const customPrototypeArray = request({
			subjectProjectConfigPaths: customPrototypeProjects
		});

		for (const [candidate, code, exitCode] of [
			[extra, 'REQUEST_SHAPE_INVALID', 2],
			[traversing, 'REQUEST_PATH_INVALID', 2],
			[excessive, 'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING', 3],
			[missing, 'CRITERION_PATH_INVALID', 2],
			[criterionProjectOutsideSubject, 'REQUEST_CRITERION_PROJECT_OUTSIDE_SUBJECT', 2],
			[excluded, 'CRITERION_EXCLUDED', 2],
			[proxy, 'REQUEST_SHAPE_INVALID', 2],
			[accessorArray, 'REQUEST_PROJECTS_INVALID', 2],
			[customPrototypeArray, 'REQUEST_PROJECTS_INVALID', 2]
		] as const) {
			const outcome = runStructuralModuleReachabilityReport(candidate, { repositoryRoot: root });
			expect(outcome).toMatchObject({ code, outcome: 'unavailable' });
			expect(structuralModuleReachabilityReportExitCode(outcome)).toBe(exitCode);
		}
	});

	it('refuses an over-budget result instead of returning an empty successful population', () => {
		const root = fixture();
		const outcome = runStructuralModuleReachabilityReport(
			request({ budgets: { ...request().budgets, maxResultBytes: 1 } }),
			{ repositoryRoot: root }
		);
		expect(outcome).toMatchObject({
			code: 'RESULT_BUDGET_EXCEEDED',
			outcome: 'unavailable',
			stage: 'RESULT',
			state: 'resource-refused'
		});
		expect(structuralModuleReachabilityReportExitCode(outcome)).toBe(3);
	});
});
