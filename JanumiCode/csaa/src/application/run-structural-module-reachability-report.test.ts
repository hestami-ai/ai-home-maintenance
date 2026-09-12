import { Buffer } from 'node:buffer';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	STRUCTURAL_MODULE_REACHABILITY_REPORT_NONCLAIMS,
	STRUCTURAL_MODULE_REACHABILITY_REPORT_OPERATION_VERSION,
	STRUCTURAL_MODULE_REACHABILITY_REPORT_REQUEST_SCHEMA_VERSION,
	type StructuralModuleReachabilityReportRequest
} from '../contracts/structural-module-reachability-report.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import {
	runStructuralModuleReachabilityReport,
	runStructuralModuleReachabilityReportWithCapturedSubject,
	STRUCTURAL_MODULE_REACHABILITY_REPORT_PROGRESS_NONCLAIMS,
	STRUCTURAL_MODULE_REACHABILITY_REPORT_PROGRESS_SCHEMA_VERSION,
	type StructuralModuleReachabilityReportProgressEvent,
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
	json(root, 'verif/retained-evidence.json', { evidence: 'retained' });
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
	it('captures trusted additional artifacts in the exact predecessor subject identity', () => {
		const root = fixture();
		const baseline = runStructuralModuleReachabilityReportWithCapturedSubject(request(), {
			repositoryRoot: root
		});
		const retained = runStructuralModuleReachabilityReportWithCapturedSubject(request(), {
			additionalArtifacts: ['verif/retained-evidence.json'],
			repositoryRoot: root
		});
		expect(retained.outcome.outcome).toBe('partial');
		expect(retained.subject?.request.scope).toMatchObject({
			additionalArtifacts: ['verif/retained-evidence.json'],
			kind: 'EXPLICIT_PROJECTS'
		});
		expect(retained.subject?.artifacts.map((artifact) => artifact.path)).toContain(
			'verif/retained-evidence.json'
		);
		expect(retained.subject?.descriptor.subjectId).not.toBe(baseline.subject?.descriptor.subjectId);
	});

	it('captures the trusted exact filter policy in the predecessor subject identity', () => {
		const root = fixture();
		const baseline = runStructuralModuleReachabilityReportWithCapturedSubject(request(), {
			repositoryRoot: root
		});
		const subjectFilters = {
			exclude: [],
			include: [
				'package.json',
				'packages/demo/package.json',
				'packages/demo/tsconfig.json',
				'packages/demo/src/entry.ts',
				'packages/demo/src/leaf.ts',
				'packages/demo/src/middle.ts',
				'packages/demo/src/unrelated.ts'
			]
		};
		const filtered = runStructuralModuleReachabilityReportWithCapturedSubject(request(), {
			repositoryRoot: root,
			subjectFilters
		});
		expect(filtered.outcome.outcome).toBe('partial');
		expect(filtered.subject?.request.filters).toEqual(subjectFilters);
		expect(filtered.subject?.descriptor.subjectId).not.toBe(baseline.subject?.descriptor.subjectId);
	});

	it('renders deterministic reverse structural importer candidates and original import witnesses', () => {
		const root = fixture();
		const progress: StructuralModuleReachabilityReportProgressEvent[] = [];
		const first = runStructuralModuleReachabilityReport(request(), {
			onProgress: (event) => progress.push(event),
			repositoryRoot: root
		});
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
		expect(first.result.criterionSelector.artifact).toMatchObject({
			disposition: 'ANALYZED',
			path: 'packages/demo/src/leaf.ts',
			sha256: expect.stringMatching(/^[0-9a-f]{64}$/u)
		});
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
			first.result.evidence.witnessEdges
				.map((edge) => ({
					source: pathByNode.get(edge.source.nodeId),
					specifier: edge.specifier,
					target: pathByNode.get(edge.target.nodeId)
				}))
				.sort((left, right) => (left.source ?? '').localeCompare(right.source ?? ''))
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
		expect(progress.length).toBeGreaterThan(10);
		expect(progress.map((event) => event.sequence)).toEqual(progress.map((_, index) => index + 1));
		expect(
			progress.every(
				(event, index) => index === 0 || event.elapsedMs >= progress[index - 1]!.elapsedMs
			)
		).toBe(true);
		expect(
			progress.every(
				(event) =>
					event.deliverySemantics === 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK' &&
					event.nonclaims === STRUCTURAL_MODULE_REACHABILITY_REPORT_PROGRESS_NONCLAIMS &&
					event.protocolRole === 'PRELIMINARY_CAP_027_REPORT_TELEMETRY' &&
					event.reportIdentityEffect === 'EXCLUDED_FROM_REPORT_IDENTITY' &&
					event.wallClockBudgetEffect === 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET'
			)
		).toBe(true);
		expect(
			progress.every(
				(event) =>
					event.schemaVersion === STRUCTURAL_MODULE_REACHABILITY_REPORT_PROGRESS_SCHEMA_VERSION
			)
		).toBe(true);
		const reportStages = progress.filter((event) => event.kind === 'REPORT_STAGE');
		expect(reportStages.map(({ phase, stage, state }) => ({ phase, stage, state }))).toEqual(
			(
				[
					['REQUEST_BIND', 'REQUEST'],
					['SUBJECT_PROJECT_PATH_BIND', 'SUBJECT'],
					['CRITERION_PATH_BIND', 'CRITERION'],
					['SUBJECT_CAPTURE', 'SUBJECT'],
					['CRITERION_ARTIFACT_BIND', 'CRITERION'],
					['SEMANTIC_SNAPSHOT', 'SEMANTIC_SNAPSHOT'],
					['MODULE_GRAPH', 'MODULE_GRAPH'],
					['CRITERION_NODE_BIND', 'CRITERION'],
					['ANALYSIS', 'ANALYSIS'],
					['CURRENTNESS', 'CURRENTNESS'],
					['RESULT', 'RESULT']
				] as const
			).flatMap(([phase, stage]) => [
				{ phase, stage, state: 'STARTED' },
				{ phase, stage, state: 'COMPLETED' }
			])
		);
		expect(
			reportStages.every(
				(event) =>
					JSON.stringify(Object.keys(event).sort()) ===
					JSON.stringify(
						[
							'deliverySemantics',
							'detailCode',
							'elapsedMs',
							'kind',
							'nonclaims',
							'observations',
							'operationVersion',
							'phase',
							'protocolRole',
							'reportIdentityEffect',
							'schemaVersion',
							'sequence',
							'stage',
							'state',
							'wallClockBudgetEffect'
						].sort()
					)
			)
		).toBe(true);
		expect(progress.some((event) => event.detailCode === 'STAGE_INTERRUPTED')).toBe(false);
		const selectedCriterionEvents = progress.filter((event) =>
			event.observations.some((observation) => observation.metric === 'SELECTED_CRITERIA')
		);
		expect(selectedCriterionEvents).toHaveLength(1);
		expect(selectedCriterionEvents[0]).toMatchObject({
			kind: 'REPORT_STAGE',
			phase: 'CRITERION_NODE_BIND',
			state: 'COMPLETED'
		});
		const analysisCompletion = reportStages.find(
			(event) => event.phase === 'ANALYSIS' && event.state === 'COMPLETED'
		);
		expect(
			analysisCompletion?.observations.find(
				(observation) => observation.metric === 'ANALYSIS_CONSUMED_INPUT_RECORDS'
			)
		).toMatchObject({
			basis: 'EXACT',
			limit: request().budgets.reachability.maxInputRecords,
			unit: 'COUNT'
		});
		expect(
			analysisCompletion?.observations.find(
				(observation) => observation.metric === 'ANALYSIS_CONSUMED_INPUT_UTF16_CODE_UNITS'
			)
		).toMatchObject({
			basis: 'EXACT',
			limit: request().budgets.reachability.maxInputStringCharacters,
			unit: 'COUNT'
		});
		expect(progress.at(-1)).toMatchObject({
			detailCode: 'PARTIAL',
			kind: 'REPORT_STAGE',
			stage: 'RESULT',
			state: 'COMPLETED'
		});
		expect(
			progress.at(-1)?.observations.find((observation) => observation.metric === 'RESULT_BYTES')
		).toMatchObject({
			basis: 'EXACT',
			limit: request().budgets.maxResultBytes,
			unit: 'BYTES',
			value: Buffer.byteLength(firstJson, 'utf8') + 1
		});
		const semanticSerialization = progress.find(
			(event) =>
				event.kind === 'SEMANTIC_SNAPSHOT' &&
				event.semanticProgress.phase === 'SERIALIZE' &&
				event.semanticProgress.state === 'COMPLETED'
		);
		expect(semanticSerialization).toBeDefined();
		expect(
			semanticSerialization?.observations.find(
				(observation) => observation.metric === 'SEMANTIC_CANONICAL_BYTES'
			)
		).toMatchObject({ basis: 'EXACT', limit: request().budgets.semantic.maxSnapshotBytes });
		const progressJson = canonicalSemanticJson(progress);
		expect(progressJson).not.toContain(root);
		expect(progressJson).not.toContain(root.replaceAll('\\', '/'));

		const second = runStructuralModuleReachabilityReport(request(), {
			onProgress: () => {
				throw new Error('Observer failure must remain out of band.');
			},
			repositoryRoot: root
		});
		expect(canonicalSemanticJson(second)).toBe(firstJson);
	});

	it('attributes a failed path bind to the exact active phase', () => {
		const root = fixture();
		const progress: StructuralModuleReachabilityReportProgressEvent[] = [];
		const outcome = runStructuralModuleReachabilityReport(
			request({ criterionLogicalPath: 'packages/demo/src/missing.ts' }),
			{ onProgress: (event) => progress.push(event), repositoryRoot: root }
		);
		expect(outcome).toMatchObject({ code: 'CRITERION_PATH_INVALID', outcome: 'unavailable' });
		expect(
			progress
				.filter((event) => event.kind === 'REPORT_STAGE')
				.map(({ detailCode, phase, state }) => ({ detailCode, phase, state }))
		).toEqual([
			{ detailCode: null, phase: 'REQUEST_BIND', state: 'STARTED' },
			{ detailCode: 'REQUEST_ADMITTED', phase: 'REQUEST_BIND', state: 'COMPLETED' },
			{ detailCode: null, phase: 'SUBJECT_PROJECT_PATH_BIND', state: 'STARTED' },
			{
				detailCode: 'SUBJECT_PROJECT_PATHS_BOUND',
				phase: 'SUBJECT_PROJECT_PATH_BIND',
				state: 'COMPLETED'
			},
			{ detailCode: null, phase: 'CRITERION_PATH_BIND', state: 'STARTED' },
			{
				detailCode: 'CRITERION_PATH_INVALID',
				phase: 'CRITERION_PATH_BIND',
				state: 'FAILED'
			}
		]);
	});

	it('contains rejected observer results without replacing the terminal outcome', async () => {
		const root = fixture();
		const baseline = runStructuralModuleReachabilityReport({}, { repositoryRoot: root });
		const observed = runStructuralModuleReachabilityReport(
			{},
			{
				onProgress: () => Promise.reject(new Error('observer rejection')),
				repositoryRoot: root
			}
		);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(canonicalSemanticJson(observed)).toBe(canonicalSemanticJson(baseline));
	});

	it('uses deterministic elapsed time when the monotonic clock is unavailable', () => {
		const root = fixture();
		const progress: StructuralModuleReachabilityReportProgressEvent[] = [];
		const clock = vi.spyOn(process.hrtime, 'bigint').mockImplementationOnce(() => {
			throw new Error('clock unavailable');
		});
		try {
			const outcome = runStructuralModuleReachabilityReport(
				{},
				{
					onProgress: (event) => progress.push(event),
					repositoryRoot: root
				}
			);
			expect(outcome).toMatchObject({ code: 'REQUEST_SHAPE_INVALID', outcome: 'unavailable' });
			expect(progress.length).toBeGreaterThan(0);
			expect(progress.every((event) => event.elapsedMs === 0)).toBe(true);
		} finally {
			clock.mockRestore();
		}
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

	it('admits only exact versions, direction, budgets, paths, and dense unique project arrays', () => {
		const root = fixture();
		const base = request();
		const inherited = Object.assign(Object.create({ inherited: true }), base);
		const nonEnumerable = { ...base };
		Object.defineProperty(nonEnumerable, 'schemaVersion', {
			enumerable: false,
			value: base.schemaVersion
		});
		const sparseProjects: string[] = [];
		sparseProjects.length = 1;

		const cases: readonly {
			readonly code: string;
			readonly state?: 'incompatible' | 'resource-refused';
			readonly value: unknown;
		}[] = [
			{ code: 'REQUEST_SHAPE_INVALID', value: inherited },
			{ code: 'REQUEST_SHAPE_INVALID', value: nonEnumerable },
			{
				code: 'REQUEST_BUDGET_INVALID',
				value: { ...base, budgets: { ...base.budgets, maxResultBytes: 0 } }
			},
			{
				code: 'REQUEST_SCHEMA_VERSION_UNSUPPORTED',
				value: { ...base, schemaVersion: 'unsupported' }
			},
			{
				code: 'REQUEST_OPERATION_VERSION_UNSUPPORTED',
				value: { ...base, operationVersion: 'unsupported' }
			},
			{
				code: 'REQUEST_DIRECTION_INVALID',
				value: { ...base, direction: 'SIDEWAYS' }
			},
			{
				code: 'REQUEST_PATH_INVALID',
				value: { ...base, criterionLogicalPath: '' }
			},
			{
				code: 'REQUEST_PATH_BUDGET_EXCEEDED',
				state: 'resource-refused',
				value: {
					...base,
					budgets: {
						...base.budgets,
						semantic: { ...base.budgets.semantic, maxPathCharacters: 1 }
					}
				}
			},
			{
				code: 'REQUEST_PATH_INVALID',
				value: { ...base, subjectProjectConfigPaths: ['bad*path.json'] }
			},
			{
				code: 'REQUEST_PROJECTS_INVALID',
				value: { ...base, subjectProjectConfigPaths: {} }
			},
			{
				code: 'REQUEST_PROJECTS_INVALID',
				value: { ...base, subjectProjectConfigPaths: [] }
			},
			{
				code: 'REQUEST_PROJECTS_BUDGET_EXCEEDED',
				state: 'resource-refused',
				value: {
					...base,
					budgets: {
						...base.budgets,
						subject: { ...base.budgets.subject, maxProjects: 1 }
					},
					subjectProjectConfigPaths: ['packages/demo/tsconfig.json', 'packages/other/tsconfig.json']
				}
			},
			{
				code: 'REQUEST_PROJECTS_INVALID',
				value: { ...base, subjectProjectConfigPaths: sparseProjects }
			},
			{
				code: 'REQUEST_PROJECTS_INVALID',
				value: {
					...base,
					subjectProjectConfigPaths: ['packages/demo/tsconfig.json', 'packages/demo/tsconfig.json']
				}
			}
		];

		for (const malformed of cases) {
			const outcome = runStructuralModuleReachabilityReport(malformed.value, {
				repositoryRoot: root
			});
			expect(outcome, malformed.code).toMatchObject({
				code: malformed.code,
				outcome: 'unavailable',
				stage: 'REQUEST',
				state: malformed.state ?? 'incompatible'
			});
		}
	});

	it('classifies bounded, forbidden, missing, incompatible, and ambiguous subjects', () => {
		const budgetRoot = fixture();
		const base = request();
		const budget = runStructuralModuleReachabilityReportWithCapturedSubject(
			request({
				budgets: {
					...base.budgets,
					subject: { ...base.budgets.subject, maxFiles: 1 }
				}
			}),
			{ repositoryRoot: budgetRoot }
		);
		expect(budget.outcome).toMatchObject({
			code: 'SUBJECT_RESOURCE_REFUSED',
			outcome: 'unavailable',
			stage: 'SUBJECT',
			state: 'resource-refused'
		});
		expect(budget).toMatchObject({ repositoryRoot: null, resultBytes: null, subject: null });

		const forbiddenRoot = fixture();
		json(forbiddenRoot, 'packages/demo/tsconfig.json', {
			compilerOptions: { noLib: true },
			include: ['src/*/../outside.ts']
		});
		const forbidden = runStructuralModuleReachabilityReport(request(), {
			repositoryRoot: forbiddenRoot
		});
		expect(forbidden).toMatchObject({
			code: 'SUBJECT_FORBIDDEN',
			outcome: 'unavailable',
			stage: 'SUBJECT',
			state: 'incompatible'
		});

		const missingRoot = fixture();
		rmSync(join(missingRoot, 'package.json'));
		const missing = runStructuralModuleReachabilityReport(request(), {
			repositoryRoot: missingRoot
		});
		expect(missing).toMatchObject({
			code: 'SUBJECT_NOT_FOUND',
			outcome: 'unavailable',
			stage: 'SUBJECT',
			state: 'incompatible'
		});

		const incompatibleRoot = fixture();
		write(incompatibleRoot, 'packages/demo/package.json', '{ malformed');
		const incompatible = runStructuralModuleReachabilityReport(request(), {
			repositoryRoot: incompatibleRoot
		});
		expect(incompatible).toMatchObject({
			code: 'SUBJECT_INCOMPATIBLE',
			outcome: 'unavailable',
			stage: 'SUBJECT',
			state: 'incompatible'
		});

		const ambiguousRoot = fixture();
		json(ambiguousRoot, 'packages/other/package.json', {
			name: '@fixture/reachability-report',
			private: true,
			version: '0.0.0'
		});
		write(ambiguousRoot, 'packages/other/src/index.ts', 'export const other = true;\n');
		const ambiguous = runStructuralModuleReachabilityReport(request(), {
			repositoryRoot: ambiguousRoot
		});
		expect(ambiguous).toMatchObject({
			code: 'SUBJECT_AMBIGUOUS',
			outcome: 'unavailable',
			stage: 'SUBJECT',
			state: 'incompatible'
		});
	}, 60_000);

	it('distinguishes directory selectors and an unavailable repository root', () => {
		const root = fixture();
		for (const [candidate, code, stage] of [
			[
				request({
					projectConfigPath: 'packages/demo',
					subjectProjectConfigPaths: ['packages/demo']
				}),
				'PROJECT_PATH_INVALID',
				'SUBJECT'
			],
			[
				request({
					subjectProjectConfigPaths: ['packages/demo/tsconfig.json', 'packages/demo']
				}),
				'PROJECT_PATH_INVALID',
				'SUBJECT'
			],
			[
				request({ criterionLogicalPath: 'packages/demo/src' }),
				'CRITERION_PATH_INVALID',
				'CRITERION'
			]
		] as const) {
			const outcome = runStructuralModuleReachabilityReport(candidate, { repositoryRoot: root });
			expect(outcome, code).toMatchObject({
				code,
				outcome: 'unavailable',
				stage,
				state: 'incompatible'
			});
		}

		const invalidRoot = runStructuralModuleReachabilityReport(request(), {
			repositoryRoot: join(root, 'missing-root')
		});
		expect(invalidRoot).toMatchObject({
			code: 'REPOSITORY_ROOT_UNAVAILABLE',
			outcome: 'unavailable',
			stage: 'REQUEST',
			state: 'failed'
		});
		expect(structuralModuleReachabilityReportExitCode(invalidRoot)).toBe(4);
	});

	it('rejects a criterion that is analyzed only by another captured project', () => {
		const root = fixture();
		json(root, 'packages/other/package.json', {
			name: '@fixture/reachability-other',
			private: true,
			version: '0.0.0'
		});
		json(root, 'packages/other/tsconfig.json', {
			compilerOptions: {
				module: 'NodeNext',
				moduleResolution: 'NodeNext',
				noEmit: true,
				noLib: true,
				strict: true,
				target: 'ES2022'
			},
			files: ['src/other.ts']
		});
		write(root, 'packages/other/src/other.ts', 'export const other = true;\n');

		const outcome = runStructuralModuleReachabilityReport(
			request({
				criterionLogicalPath: 'packages/other/src/other.ts',
				subjectProjectConfigPaths: ['packages/demo/tsconfig.json', 'packages/other/tsconfig.json']
			}),
			{ repositoryRoot: root }
		);
		expect(outcome).toMatchObject({
			code: 'CRITERION_OUTSIDE_PROJECT',
			outcome: 'unavailable',
			stage: 'CRITERION',
			state: 'incompatible'
		});
	}, 60_000);

	it('reports stale and unavailable currentness without replacing captured reachability evidence', () => {
		for (const [expectedState, mutate] of [
			[
				'STALE',
				(root: string) => write(root, 'packages/demo/src/leaf.ts', 'export const leaf = 2;\n')
			],
			['UNAVAILABLE', (root: string) => write(root, 'package.json', '{ malformed')]
		] as const) {
			const root = fixture();
			let mutated = false;
			const outcome = runStructuralModuleReachabilityReport(request(), {
				onProgress: (event) => {
					if (
						!mutated &&
						event.kind === 'REPORT_STAGE' &&
						event.phase === 'ANALYSIS' &&
						event.state === 'COMPLETED'
					) {
						mutated = true;
						mutate(root);
					}
				},
				repositoryRoot: root
			});
			expect(mutated, expectedState).toBe(true);
			expect(outcome.outcome, expectedState).toBe('partial');
			if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
			expect(outcome.result.currentness.state).toBe(expectedState);
			expect(outcome.stageOutcomes.currentness.state).toBe(expectedState);
			expect(outcome.result.analysis.members).toHaveLength(3);
			if (expectedState === 'STALE')
				expect(outcome.result.currentness.changedPaths).toContain('packages/demo/src/leaf.ts');
			else expect(outcome.result.currentness.diagnosticCodes).toContain('CONFIG_MALFORMED');
		}
	}, 60_000);

	it('renders forward structural dependency candidates', () => {
		const root = fixture();
		const outcome = runStructuralModuleReachabilityReport(
			request({ criterionLogicalPath: 'packages/demo/src/entry.ts', direction: 'FORWARD' }),
			{ repositoryRoot: root }
		);
		expect(outcome.outcome).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		const pathByNode = new Map(
			outcome.result.evidence.nodes.flatMap((node) =>
				node.kind === 'SOURCE' ? [[node.id, node.logicalPath] as const] : []
			)
		);
		expect(outcome.result.interpretation).toBe('STRUCTURAL_DEPENDENCY_CANDIDATES');
		expect(outcome.result.analysis.members.map((member) => pathByNode.get(member.nodeId))).toEqual([
			'packages/demo/src/entry.ts',
			'packages/demo/src/middle.ts',
			'packages/demo/src/leaf.ts'
		]);
	}, 60_000);

	it('refuses independent graph-population and traversal budgets at the analysis stage', () => {
		const root = fixture();
		for (const budgetKey of [
			'maxEdges',
			'maxNodes',
			'maxReachableNodes',
			'maxTraversalSteps',
			'maxWitnessEdges'
		] as const) {
			const baseline = request();
			const progress: StructuralModuleReachabilityReportProgressEvent[] = [];
			const outcome = runStructuralModuleReachabilityReport(
				request({
					budgets: {
						...baseline.budgets,
						reachability: { ...baseline.budgets.reachability, [budgetKey]: 1 }
					}
				}),
				{ onProgress: (event) => progress.push(event), repositoryRoot: root }
			);
			expect(outcome, budgetKey).toMatchObject({
				code: 'STRUCTURAL_MODULE_REACHABILITY_UNAVAILABLE',
				outcome: 'unavailable',
				stage: 'ANALYSIS',
				state: 'resource-refused'
			});
			expect(structuralModuleReachabilityReportExitCode(outcome)).toBe(3);
			expect(progress.at(-1), budgetKey).toMatchObject({
				detailCode: 'BUDGET_EXCEEDED',
				kind: 'REPORT_STAGE',
				phase: 'ANALYSIS',
				state: 'FAILED'
			});
		}
	}, 60_000);

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

	it('contains a canonical result serialization failure at the exact terminal stage', () => {
		const root = fixture();
		const progress: StructuralModuleReachabilityReportProgressEvent[] = [];
		let byteLength: ReturnType<typeof vi.spyOn> | undefined;
		try {
			const outcome = runStructuralModuleReachabilityReport(request(), {
				onProgress: (event) => {
					progress.push(event);
					if (
						byteLength === undefined &&
						event.kind === 'REPORT_STAGE' &&
						event.phase === 'RESULT' &&
						event.state === 'STARTED'
					)
						byteLength = vi.spyOn(Buffer, 'byteLength').mockImplementation(() => {
							throw new Error('synthetic canonical byte measurement failure');
						});
				},
				repositoryRoot: root
			});
			expect(byteLength).toBeDefined();
			expect(outcome).toMatchObject({
				code: 'RESULT_SERIALIZATION_FAILED',
				outcome: 'unavailable',
				stage: 'RESULT',
				state: 'failed'
			});
			expect(structuralModuleReachabilityReportExitCode(outcome)).toBe(4);
			expect(progress.at(-1)).toMatchObject({
				detailCode: 'RESULT_SERIALIZATION_FAILED',
				kind: 'REPORT_STAGE',
				phase: 'RESULT',
				state: 'FAILED'
			});
		} finally {
			byteLength?.mockRestore();
		}
	}, 60_000);

	it('reports exact canonical snapshot bytes when the semantic snapshot budget refuses the run', () => {
		const root = fixture();
		const calibrationProgress: StructuralModuleReachabilityReportProgressEvent[] = [];
		const calibration = runStructuralModuleReachabilityReport(request(), {
			onProgress: (event) => calibrationProgress.push(event),
			repositoryRoot: root
		});
		expect(calibration.outcome).toBe('partial');
		const calibratedBytes = calibrationProgress
			.find(
				(event) =>
					event.kind === 'SEMANTIC_SNAPSHOT' &&
					event.semanticProgress.phase === 'SERIALIZE' &&
					event.semanticProgress.state === 'COMPLETED'
			)
			?.observations.find(
				(observation) => observation.metric === 'SEMANTIC_CANONICAL_BYTES'
			)?.value;
		expect(calibratedBytes).toBeGreaterThan(2_048);
		const maxSnapshotBytes = calibratedBytes! - 1_024;
		const progress: StructuralModuleReachabilityReportProgressEvent[] = [];
		const baseline = request();
		const outcome = runStructuralModuleReachabilityReport(
			request({
				budgets: {
					...baseline.budgets,
					semantic: { ...baseline.budgets.semantic, maxSnapshotBytes }
				}
			}),
			{ onProgress: (event) => progress.push(event), repositoryRoot: root }
		);
		expect(outcome).toMatchObject({
			code: 'SEMANTIC_SNAPSHOT_UNAVAILABLE',
			outcome: 'unavailable',
			stage: 'SEMANTIC_SNAPSHOT',
			state: 'resource-refused'
		});
		const failedSerialization = progress.find(
			(event) =>
				event.kind === 'SEMANTIC_SNAPSHOT' &&
				event.semanticProgress.phase === 'SERIALIZE' &&
				event.semanticProgress.state === 'FAILED'
		);
		expect(failedSerialization?.detailCode).toBe('SEMANTIC_BUDGET_EXCEEDED');
		const bytes = failedSerialization?.observations.find(
			(observation) => observation.metric === 'SEMANTIC_CANONICAL_BYTES'
		);
		expect(bytes).toMatchObject({ basis: 'EXACT', limit: maxSnapshotBytes, unit: 'BYTES' });
		expect(bytes?.value).toBeGreaterThan(maxSnapshotBytes);
		expect(progress.at(-1)).toMatchObject({
			detailCode: 'SEMANTIC_SNAPSHOT_UNAVAILABLE',
			kind: 'REPORT_STAGE',
			stage: 'SEMANTIC_SNAPSHOT',
			state: 'FAILED'
		});
	}, 60_000);

	it('reports lower-bound consumed-input usage when either analyzer input budget refuses', () => {
		const root = fixture();
		const calibrationProgress: StructuralModuleReachabilityReportProgressEvent[] = [];
		const calibration = runStructuralModuleReachabilityReport(request(), {
			onProgress: (event) => calibrationProgress.push(event),
			repositoryRoot: root
		});
		expect(calibration.outcome).toBe('partial');
		const analysisCompletion = calibrationProgress.find(
			(event) =>
				event.kind === 'REPORT_STAGE' && event.phase === 'ANALYSIS' && event.state === 'COMPLETED'
		);
		const calibrated = {
			maxInputRecords: analysisCompletion?.observations.find(
				(observation) => observation.metric === 'ANALYSIS_CONSUMED_INPUT_RECORDS'
			)?.value,
			maxInputStringCharacters: analysisCompletion?.observations.find(
				(observation) => observation.metric === 'ANALYSIS_CONSUMED_INPUT_UTF16_CODE_UNITS'
			)?.value
		};
		expect(calibrated.maxInputRecords).toBeGreaterThan(1);
		expect(calibrated.maxInputStringCharacters).toBeGreaterThan(1);

		for (const [budgetKey, metric] of [
			['maxInputRecords', 'ANALYSIS_CONSUMED_INPUT_RECORDS'],
			['maxInputStringCharacters', 'ANALYSIS_CONSUMED_INPUT_UTF16_CODE_UNITS']
		] as const) {
			const limit = calibrated[budgetKey]! - 1;
			const baseline = request();
			const progress: StructuralModuleReachabilityReportProgressEvent[] = [];
			const outcome = runStructuralModuleReachabilityReport(
				request({
					budgets: {
						...baseline.budgets,
						reachability: { ...baseline.budgets.reachability, [budgetKey]: limit }
					}
				}),
				{ onProgress: (event) => progress.push(event), repositoryRoot: root }
			);
			expect(outcome).toMatchObject({
				code: 'STRUCTURAL_MODULE_REACHABILITY_UNAVAILABLE',
				outcome: 'unavailable',
				stage: 'ANALYSIS',
				state: 'resource-refused'
			});
			const analysisFailure = progress.at(-1);
			expect(analysisFailure).toMatchObject({
				detailCode: 'BUDGET_EXCEEDED',
				kind: 'REPORT_STAGE',
				phase: 'ANALYSIS',
				state: 'FAILED'
			});
			const usage = analysisFailure?.observations.find(
				(observation) => observation.metric === metric
			);
			expect(usage).toMatchObject({ basis: 'LOWER_BOUND', limit, unit: 'COUNT' });
			expect(usage?.value).toBeGreaterThan(0);
			expect(usage?.value).toBeLessThanOrEqual(calibrated[budgetKey]!);
			if (budgetKey === 'maxInputStringCharacters') expect(usage?.value).toBeGreaterThan(limit);
			const outcomeJson = canonicalSemanticJson(outcome);
			expect(outcomeJson).not.toContain('ANALYSIS_CONSUMED_INPUT_RECORDS');
			expect(outcomeJson).not.toContain('ANALYSIS_CONSUMED_INPUT_UTF16_CODE_UNITS');
		}
	}, 60_000);
});
