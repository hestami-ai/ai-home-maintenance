import { Buffer } from 'node:buffer';
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
