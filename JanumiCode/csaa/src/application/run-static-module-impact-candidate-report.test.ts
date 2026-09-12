import { Buffer } from 'node:buffer';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_NONCLAIMS,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_OUTER_RESULT_BASE_BYTE_RESERVATION,
	STATIC_MODULE_IMPACT_CANDIDATE_WITNESS_HOP_RESULT_BYTE_RESERVATION,
	type StaticModuleImpactCandidateReportRequest
} from '../contracts/static-module-impact-candidate-report.js';
import { sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import {
	runStaticModuleImpactCandidateReport,
	runStaticModuleImpactCandidateReportWithCapturedSubject,
	staticModuleImpactCandidateReportExitCode
} from './run-static-module-impact-candidate-report.js';

const temporaryRoots: string[] = [];
const LEAF = 'export const leaf = 1;\n';
const MIDDLE = "import { leaf } from './leaf.js';\nexport const middle = leaf + 1;\n";
const ENTRY = "import { middle } from './middle.js';\nexport const entry = middle + 1;\n";

function write(root: string, path: string, contents: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents, 'utf8');
}

function json(root: string, path: string, value: unknown): void {
	write(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-static-impact-report-'));
	temporaryRoots.push(root);
	json(root, 'package.json', {
		name: 'static-impact-report-fixture',
		private: true,
		workspaces: ['packages/*']
	});
	json(root, 'packages/demo/package.json', {
		name: '@fixture/static-impact-report',
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
	write(root, 'packages/demo/src/leaf.ts', LEAF);
	write(root, 'packages/demo/src/middle.ts', MIDDLE);
	write(root, 'packages/demo/src/entry.ts', ENTRY);
	write(
		root,
		'packages/demo/src/unrelated.ts',
		"import { absent } from './absent.js';\nexport const unrelated = absent;\n"
	);
	write(root, 'bun.lock', 'fixture lock\n');
	json(root, 'verif/retained-evidence.json', { evidence: 'retained' });
	return root;
}

function longChainFixture(sourceCount: number): { readonly root: string; readonly seed: string } {
	const root = mkdtempSync(join(tmpdir(), 'csaa-static-impact-long-chain-'));
	temporaryRoots.push(root);
	json(root, 'package.json', {
		name: 'static-impact-long-chain-fixture',
		private: true,
		workspaces: ['packages/*']
	});
	json(root, 'packages/demo/package.json', {
		name: '@fixture/static-impact-long-chain',
		private: true,
		version: '0.0.0'
	});
	const files: string[] = [];
	let seed = '';
	for (let index = 0; index < sourceCount; index += 1) {
		const name = `source-${String(index).padStart(3, '0')}`;
		const path = `src/${name}.ts`;
		files.push(path);
		const contents =
			index === 0
				? 'export const value0 = 0;\n'
				: `import { value${index - 1} } from './source-${String(index - 1).padStart(3, '0')}.js';\nexport const value${index} = value${index - 1} + 1;\n`;
		if (index === 0) seed = contents;
		write(root, `packages/demo/${path}`, contents);
	}
	json(root, 'packages/demo/tsconfig.json', {
		compilerOptions: {
			module: 'NodeNext',
			moduleResolution: 'NodeNext',
			noEmit: true,
			noLib: true,
			strict: true,
			target: 'ES2022'
		},
		files
	});
	write(root, 'bun.lock', 'fixture lock\n');
	return { root, seed };
}

function request(
	overrides: Partial<StaticModuleImpactCandidateReportRequest> = {}
): StaticModuleImpactCandidateReportRequest {
	return {
		budgets: {
			maxCandidateWitnessHops: 16_000,
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
		operationVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
		schemaVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
		seed: {
			basis: 'CALLER_DECLARED_WORKING_CHANGE_SET',
			expectedArtifactSha256: sha256(LEAF),
			id: 'seed:leaf-edit',
			logicalPath: 'packages/demo/src/leaf.ts',
			operation: 'EDIT',
			projectConfigPath: 'packages/demo/tsconfig.json',
			schemaVersion: STATIC_MODULE_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION,
			scope: 'WHOLE_SOURCE',
			workingChangeSetId: 'working-change:fixture'
		},
		subjectProjectConfigPaths: ['packages/demo/tsconfig.json'],
		...overrides
	};
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('runStaticModuleImpactCandidateReport', () => {
	it('forwards trusted artifacts and the exact filter policy into the reachability predecessor', () => {
		const root = fixture();
		const subjectFilters = {
			exclude: [],
			include: [
				'package.json',
				'packages/demo/package.json',
				'packages/demo/tsconfig.json',
				'packages/demo/src/entry.ts',
				'packages/demo/src/leaf.ts',
				'packages/demo/src/middle.ts',
				'packages/demo/src/unrelated.ts',
				'verif/retained-evidence.json'
			]
		};
		const execution = runStaticModuleImpactCandidateReportWithCapturedSubject(request(), {
			additionalArtifacts: ['verif/retained-evidence.json'],
			repositoryRoot: root,
			subjectFilters
		});
		expect(execution.outcome.outcome).toBe('partial');
		expect(execution.subject?.request.scope).toMatchObject({
			additionalArtifacts: ['verif/retained-evidence.json'],
			kind: 'EXPLICIT_PROJECTS'
		});
		expect(execution.subject?.artifacts.map((artifact) => artifact.path)).toContain(
			'verif/retained-evidence.json'
		);
		expect(execution.subject?.request.filters).toEqual(subjectFilters);
		if (execution.outcome.outcome !== 'partial') throw new Error(JSON.stringify(execution.outcome));
		expect(execution.outcome.subject.subjectId).toBe(execution.subject?.descriptor.subjectId);
	});

	it('projects deterministic possible importer candidates with complete native-edge witnesses', () => {
		const root = fixture();
		const progress: unknown[] = [];
		const first = runStaticModuleImpactCandidateReport(request(), {
			onPredecessorProgress: (event) => progress.push(event),
			repositoryRoot: root
		});
		expect(first.outcome).toBe('partial');
		expect(staticModuleImpactCandidateReportExitCode(first)).toBe(3);
		if (first.outcome !== 'partial') throw new Error(JSON.stringify(first));

		expect(first.analysisAuthority).toBe('NONE');
		expect(first.authorityTransfer).toBe('NONE');
		expect(first.gateEffect).toBe('NONE');
		expect(first.result.capability).toEqual({
			fullJanCsaaCap031: 'NOT_CLAIMED',
			id: 'IMPLEMENTATION_LOCAL_STATIC_MODULE_IMPACT_CANDIDATES',
			predecessorCapability: 'JAN-CSAA-CAP-027',
			predecessorStatus: 'PARTIAL',
			status: 'IMPLEMENTATION_LOCAL_UNREGISTERED'
		});
		expect(first.result.facadeNonclaims).toBe(STATIC_MODULE_IMPACT_CANDIDATE_REPORT_NONCLAIMS);
		expect(first.result.globalImpactClosure).toBe('OPEN');
		expect(first.result.currentness).toMatchObject({
			finalFacadeVerification: 'RECHECKED_AFTER_PROJECTION_AND_RESULT_SIZE_ACCOUNTING',
			state: 'CURRENT_FOR_CAPTURED_SUBJECT'
		});
		expect(first.result.seed).toMatchObject({
			artifact: {
				path: 'packages/demo/src/leaf.ts',
				sha256: sha256(LEAF)
			},
			bindingState: 'BOUND_TO_CURRENT_CAPTURED_SOURCE',
			logicalPath: 'packages/demo/src/leaf.ts',
			operation: 'EDIT',
			scope: 'WHOLE_SOURCE',
			seedId: 'seed:leaf-edit',
			workingChangeSet: {
				basis: 'CALLER_DECLARED_NOT_INDEPENDENTLY_VALIDATED',
				id: 'working-change:fixture'
			}
		});
		expect(first.result.candidates).toHaveLength(2);
		expect(
			first.result.candidates.map((candidate) => ({
				distance: candidate.distance,
				impact: candidate.impactEpistemicState,
				path: candidate.logicalPath,
				relationship: candidate.structuralRelationship,
				witnessNodes: candidate.witness.seedToCandidateNodeIds.length,
				witnessSteps: candidate.witness.steps.length
			}))
		).toEqual([
			{
				distance: 1,
				impact: 'POSSIBLE',
				path: 'packages/demo/src/middle.ts',
				relationship: 'DIRECT_STATIC_MODULE_IMPORTER',
				witnessNodes: 2,
				witnessSteps: 1
			},
			{
				distance: 2,
				impact: 'POSSIBLE',
				path: 'packages/demo/src/entry.ts',
				relationship: 'TRANSITIVE_STATIC_MODULE_IMPORTER',
				witnessNodes: 3,
				witnessSteps: 2
			}
		]);
		const nodePath = new Map(
			first.result.evidence.predecessorReport.result.evidence.nodes.flatMap((node) =>
				node.kind === 'SOURCE' ? [[node.id, node.logicalPath] as const] : []
			)
		);
		const entry = first.result.candidates[1]!;
		expect(entry.witness.traversalDirection).toBe('REVERSE');
		expect(entry.witness.nativeEdgeOrientation).toBe('IMPORTER_TO_IMPORTED');
		expect(entry.witness.seedToCandidateNodeIds.map((id) => nodePath.get(id))).toEqual([
			'packages/demo/src/leaf.ts',
			'packages/demo/src/middle.ts',
			'packages/demo/src/entry.ts'
		]);
		expect(
			entry.witness.steps.map((step) => ({
				from: nodePath.get(step.fromSeedTowardCandidateNodeId),
				nativeImported: nodePath.get(step.nativeImportedNodeId),
				nativeImporter: nodePath.get(step.nativeImporterNodeId),
				ordinal: step.ordinal,
				to: nodePath.get(step.toCandidateNodeId)
			}))
		).toEqual([
			{
				from: 'packages/demo/src/leaf.ts',
				nativeImported: 'packages/demo/src/leaf.ts',
				nativeImporter: 'packages/demo/src/middle.ts',
				ordinal: 0,
				to: 'packages/demo/src/middle.ts'
			},
			{
				from: 'packages/demo/src/middle.ts',
				nativeImported: 'packages/demo/src/middle.ts',
				nativeImporter: 'packages/demo/src/entry.ts',
				ordinal: 1,
				to: 'packages/demo/src/entry.ts'
			}
		]);
		expect(entry.witness.steps.every((step) => step.sourceLocations.length > 0)).toBe(true);
		expect(first.result.uncertainty.encounteredFrontiers).toEqual([]);
		expect(first.result.uncertainty.upstreamClosure).toBe('OPEN');
		expect(first.result.uncertainty.upstreamLimitations.length).toBeGreaterThan(0);
		expect(first.result.uncertainty.unassessedPropagationFamilies).toContain('DATA_FLOW');
		expect(first.result.uncertainty.unassessedPropagationFamilies).toContain('RUNTIME');
		expect(first.result.uncertainty.unvisitedNodeInterpretation).toBe(
			'NO_IMPACT_OR_IRRELEVANCE_STATE_ASSIGNED'
		);
		expect(progress.length).toBeGreaterThan(10);
		const firstJson = canonicalSemanticJson(first);
		expect(firstJson).not.toContain(root);
		expect(firstJson).not.toContain(root.replaceAll('\\', '/'));

		const second = runStaticModuleImpactCandidateReport(request(), { repositoryRoot: root });
		expect(canonicalSemanticJson(second)).toBe(firstJson);
	});

	it('keeps an empty structural importer set distinct from non-impact', () => {
		const root = fixture();
		const outcome = runStaticModuleImpactCandidateReport(
			request({
				seed: {
					...request().seed,
					expectedArtifactSha256: sha256(ENTRY),
					id: 'seed:entry-edit',
					logicalPath: 'packages/demo/src/entry.ts'
				}
			}),
			{ repositoryRoot: root }
		);
		expect(outcome.outcome).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		expect(outcome.result.candidates).toEqual([]);
		expect(outcome.result.conclusion).toBe(
			'NO_STATIC_MODULE_IMPORTER_CANDIDATES_OBSERVED_WITHIN_SELECTED_GRAPH'
		);
		expect(outcome.result.globalImpactClosure).toBe('OPEN');
		expect(outcome.result.coverage.unvisitedGraphNodes).toBeGreaterThan(0);
		expect(outcome.result.facadeNonclaims).toContain(
			'NOT_AFFECTED_UNVISITED_IRRELEVANCE_DEAD_CODE_OR_SAFE_REMOVAL'
		);
	});

	it('preflights cumulative candidate witness hops before long-chain path allocation', () => {
		const { root, seed } = longChainFixture(32);
		const outcome = runStaticModuleImpactCandidateReport(
			request({
				budgets: { ...request().budgets, maxCandidateWitnessHops: 100 },
				seed: {
					...request().seed,
					expectedArtifactSha256: sha256(seed),
					id: 'seed:long-chain',
					logicalPath: 'packages/demo/src/source-000.ts'
				}
			}),
			{ repositoryRoot: root }
		);
		expect(outcome).toMatchObject({
			code: 'CANDIDATE_WITNESS_HOP_BUDGET_EXCEEDED',
			outcome: 'unavailable',
			stage: 'PROJECTION',
			state: 'resource-refused'
		});
		expect(staticModuleImpactCandidateReportExitCode(outcome)).toBe(3);
	});

	it('derives a tighter witness-hop preflight from a small result-byte budget', () => {
		const { root, seed } = longChainFixture(32);
		const seedRequest = request({
			seed: {
				...request().seed,
				expectedArtifactSha256: sha256(seed),
				id: 'seed:result-byte-bound-long-chain',
				logicalPath: 'packages/demo/src/source-000.ts'
			}
		});
		const calibration = runStaticModuleImpactCandidateReport(seedRequest, {
			repositoryRoot: root
		});
		if (calibration.outcome !== 'partial') throw new Error(JSON.stringify(calibration));
		const predecessorBytes =
			Buffer.byteLength(
				canonicalSemanticJson(calibration.result.evidence.predecessorReport),
				'utf8'
			) + 1;
		const maxResultBytes =
			predecessorBytes +
			STATIC_MODULE_IMPACT_CANDIDATE_OUTER_RESULT_BASE_BYTE_RESERVATION +
			100 * STATIC_MODULE_IMPACT_CANDIDATE_WITNESS_HOP_RESULT_BYTE_RESERVATION;
		expect(calibration.result.coverage.candidateWitnessHops).toBeGreaterThan(100);

		const outcome = runStaticModuleImpactCandidateReport(
			request({
				budgets: { ...seedRequest.budgets, maxResultBytes },
				seed: seedRequest.seed
			}),
			{ repositoryRoot: root }
		);
		expect(outcome).toMatchObject({
			code: 'CANDIDATE_WITNESS_RESULT_BYTE_RESERVATION_EXCEEDED',
			outcome: 'unavailable',
			stage: 'PROJECTION',
			state: 'resource-refused'
		});
		expect(staticModuleImpactCandidateReportExitCode(outcome)).toBe(3);
	});

	it('refuses a stale caller-declared baseline and a subject changed after capture', () => {
		const root = fixture();
		const mismatch = runStaticModuleImpactCandidateReport(
			request({ seed: { ...request().seed, expectedArtifactSha256: '0'.repeat(64) } }),
			{ repositoryRoot: root }
		);
		expect(mismatch).toMatchObject({
			code: 'SEED_BASELINE_DIGEST_MISMATCH',
			outcome: 'unavailable',
			stage: 'SEED_BIND',
			state: 'stale'
		});
		expect(staticModuleImpactCandidateReportExitCode(mismatch)).toBe(3);

		let changed = false;
		const stale = runStaticModuleImpactCandidateReport(request(), {
			onPredecessorProgress(event) {
				if (!changed && event.phase === 'CURRENTNESS' && event.state === 'STARTED') {
					changed = true;
					write(root, 'packages/demo/src/leaf.ts', `${LEAF}// changed\n`);
				}
			},
			repositoryRoot: root
		});
		expect(changed).toBe(true);
		expect(stale).toMatchObject({
			code: 'SEED_CAPTURE_STALE',
			outcome: 'unavailable',
			stage: 'CURRENTNESS',
			state: 'stale'
		});

		for (const triggerState of ['STARTED', 'COMPLETED'] as const) {
			const lateRoot = fixture();
			let lateChanged = false;
			const late = runStaticModuleImpactCandidateReport(request(), {
				onPredecessorProgress(event) {
					if (!lateChanged && event.phase === 'RESULT' && event.state === triggerState) {
						lateChanged = true;
						write(lateRoot, 'packages/demo/src/leaf.ts', `${LEAF}// changed late\n`);
					}
				},
				repositoryRoot: lateRoot
			});
			expect(lateChanged, triggerState).toBe(true);
			expect(late, triggerState).toMatchObject({
				code: 'SEED_CAPTURE_STALE',
				outcome: 'unavailable',
				stage: 'CURRENTNESS',
				state: 'stale'
			});
		}
	});

	it('fails closed for hostile seed shells and delegates bounded request refusal', () => {
		const root = fixture();
		let getterHits = 0;
		const hostileSeed = { ...request().seed } as Record<string, unknown>;
		Object.defineProperty(hostileSeed, 'id', {
			enumerable: true,
			get() {
				getterHits += 1;
				return 'hostile';
			}
		});
		const hostile = runStaticModuleImpactCandidateReport(
			{ ...request(), seed: hostileSeed },
			{ repositoryRoot: root }
		);
		expect(hostile).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'unavailable',
			stage: 'REQUEST'
		});
		expect(getterHits).toBe(0);

		const refused = runStaticModuleImpactCandidateReport(
			{
				...request(),
				budgets: { ...request().budgets, maxResultBytes: Number.MAX_SAFE_INTEGER }
			},
			{ repositoryRoot: root }
		);
		expect(refused).toMatchObject({
			code: 'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING',
			outcome: 'unavailable',
			stage: 'PREDECESSOR_REPORT',
			state: 'resource-refused'
		});
	});

	it('does not execute hostile runner-option accessors or proxy traps', () => {
		const root = fixture();
		let accessorHits = 0;
		const accessorOptions: Record<string, unknown> = {};
		Object.defineProperty(accessorOptions, 'repositoryRoot', {
			enumerable: true,
			get() {
				accessorHits += 1;
				return root;
			}
		});
		const accessorOutcome = runStaticModuleImpactCandidateReport(
			request(),
			accessorOptions as unknown as { readonly repositoryRoot: string }
		);
		expect(accessorOutcome).toMatchObject({
			code: 'OPTIONS_ROOT_INVALID',
			outcome: 'unavailable',
			stage: 'REQUEST',
			state: 'failed'
		});
		expect(accessorHits).toBe(0);

		let proxyTrapHits = 0;
		const proxyOptions = new Proxy(
			{ repositoryRoot: root },
			{
				getOwnPropertyDescriptor(target, property) {
					proxyTrapHits += 1;
					return Reflect.getOwnPropertyDescriptor(target, property);
				},
				getPrototypeOf(target) {
					proxyTrapHits += 1;
					return Reflect.getPrototypeOf(target);
				},
				ownKeys(target) {
					proxyTrapHits += 1;
					return Reflect.ownKeys(target);
				}
			}
		);
		const proxyOutcome = runStaticModuleImpactCandidateReport(request(), proxyOptions);
		expect(proxyOutcome).toMatchObject({
			code: 'OPTIONS_SHAPE_INVALID',
			outcome: 'unavailable',
			stage: 'REQUEST',
			state: 'failed'
		});
		expect(proxyTrapHits).toBe(0);

		let additionalAccessorHits = 0;
		const accessorArtifacts = ['verif/retained-evidence.json'];
		Object.defineProperty(accessorArtifacts, '0', {
			enumerable: true,
			get() {
				additionalAccessorHits += 1;
				return 'verif/retained-evidence.json';
			}
		});
		const accessorArtifactsOutcome = runStaticModuleImpactCandidateReport(request(), {
			additionalArtifacts: accessorArtifacts,
			repositoryRoot: root
		});
		expect(accessorArtifactsOutcome).toMatchObject({
			code: 'OPTIONS_ADDITIONAL_ARTIFACTS_INVALID',
			outcome: 'unavailable',
			stage: 'REQUEST',
			state: 'failed'
		});
		expect(additionalAccessorHits).toBe(0);

		for (const additionalArtifacts of [
			new Proxy(['verif/retained-evidence.json'], {}),
			['../escape.json'],
			['verif/retained-evidence.json', 'verif/retained-evidence.json']
		]) {
			const outcome = runStaticModuleImpactCandidateReport(request(), {
				additionalArtifacts,
				repositoryRoot: root
			});
			expect(outcome).toMatchObject({
				code: 'OPTIONS_ADDITIONAL_ARTIFACTS_INVALID',
				outcome: 'unavailable',
				stage: 'REQUEST',
				state: 'failed'
			});
		}

		let filterAccessorHits = 0;
		const accessorFilters = { exclude: [] } as {
			exclude: readonly string[];
			include?: readonly string[];
		};
		Object.defineProperty(accessorFilters, 'include', {
			enumerable: true,
			get() {
				filterAccessorHits += 1;
				return ['packages/**'];
			}
		});
		const accessorFiltersOutcome = runStaticModuleImpactCandidateReport(request(), {
			repositoryRoot: root,
			subjectFilters: accessorFilters as { exclude: readonly string[]; include: readonly string[] }
		});
		expect(accessorFiltersOutcome).toMatchObject({
			code: 'OPTIONS_SUBJECT_FILTERS_INVALID',
			outcome: 'unavailable',
			stage: 'REQUEST',
			state: 'failed'
		});
		expect(filterAccessorHits).toBe(0);
	});

	it('fails closed across exact request, option, artifact, and filter admission boundaries', () => {
		const root = fixture();
		const customRequest = Object.assign(Object.create({ inherited: true }), request());
		const customOptions = Object.assign(Object.create({ inherited: true }), {
			repositoryRoot: root
		});
		const extraArtifacts: string[] & { extra?: boolean } = [];
		extraArtifacts.extra = true;
		const extraFilters: string[] & { extra?: boolean } = [];
		extraFilters.extra = true;
		const additionalAccessor = { repositoryRoot: root } as Record<string, unknown>;
		Object.defineProperty(additionalAccessor, 'additionalArtifacts', {
			enumerable: true,
			get: () => ['verif/retained-evidence.json']
		});
		const filtersAccessor = { repositoryRoot: root } as Record<string, unknown>;
		Object.defineProperty(filtersAccessor, 'subjectFilters', {
			enumerable: true,
			get: () => ({ exclude: [], include: [] })
		});
		const cases: ReadonlyArray<{
			readonly code: string;
			readonly options?: unknown;
			readonly requestValue?: unknown;
		}> = [
			{ code: 'REQUEST_SHAPE_INVALID', requestValue: null },
			{ code: 'REQUEST_SHAPE_INVALID', requestValue: customRequest },
			{ code: 'REQUEST_SHAPE_INVALID', requestValue: { ...request(), extra: true } },
			{
				code: 'REQUEST_BUDGET_INVALID',
				requestValue: {
					...request(),
					budgets: { ...request().budgets, maxCandidateWitnessHops: 0 }
				}
			},
			{
				code: 'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING',
				requestValue: {
					...request(),
					budgets: { ...request().budgets, maxCandidateWitnessHops: Number.MAX_SAFE_INTEGER }
				}
			},
			{
				code: 'REQUEST_OPERATION_INCOMPATIBLE',
				requestValue: { ...request(), operationVersion: 'old' }
			},
			{ code: 'REQUEST_SCHEMA_INCOMPATIBLE', requestValue: { ...request(), schemaVersion: 'old' } },
			{
				code: 'REQUEST_SEED_SCHEMA_INCOMPATIBLE',
				requestValue: { ...request(), seed: { ...request().seed, schemaVersion: 'old' } }
			},
			{
				code: 'REQUEST_SEED_INVALID',
				requestValue: { ...request(), seed: { ...request().seed, operation: 'DELETE' } }
			},
			{
				code: 'REQUEST_SEED_INVALID',
				requestValue: { ...request(), seed: { ...request().seed, id: '' } }
			},
			{
				code: 'REQUEST_SEED_DIGEST_INVALID',
				requestValue: { ...request(), seed: { ...request().seed, expectedArtifactSha256: 'BAD' } }
			},
			{ code: 'OPTIONS_SHAPE_INVALID', options: [] },
			{ code: 'OPTIONS_SHAPE_INVALID', options: customOptions },
			{ code: 'OPTIONS_SHAPE_INVALID', options: { repositoryRoot: root, extra: true } },
			{ code: 'OPTIONS_ADDITIONAL_ARTIFACTS_INVALID', options: additionalAccessor },
			{
				code: 'OPTIONS_PROGRESS_INVALID',
				options: { onPredecessorProgress: 1, repositoryRoot: root }
			},
			{ code: 'OPTIONS_SUBJECT_FILTERS_INVALID', options: filtersAccessor },
			{
				code: 'OPTIONS_ADDITIONAL_ARTIFACTS_INVALID',
				options: { additionalArtifacts: new Array(10_001), repositoryRoot: root }
			},
			{
				code: 'OPTIONS_ADDITIONAL_ARTIFACTS_INVALID',
				options: { additionalArtifacts: extraArtifacts, repositoryRoot: root }
			},
			{
				code: 'OPTIONS_ADDITIONAL_ARTIFACTS_INVALID',
				options: { additionalArtifacts: [0], repositoryRoot: root }
			},
			{
				code: 'OPTIONS_SUBJECT_FILTERS_INVALID',
				options: { repositoryRoot: root, subjectFilters: null }
			},
			{
				code: 'OPTIONS_SUBJECT_FILTERS_INVALID',
				options: { repositoryRoot: root, subjectFilters: { exclude: [] } }
			},
			{
				code: 'OPTIONS_SUBJECT_FILTERS_INVALID',
				options: { repositoryRoot: root, subjectFilters: { exclude: 0, include: [] } }
			},
			{
				code: 'OPTIONS_SUBJECT_FILTERS_INVALID',
				options: {
					repositoryRoot: root,
					subjectFilters: { exclude: new Array(10_001), include: [] }
				}
			},
			{
				code: 'OPTIONS_SUBJECT_FILTERS_INVALID',
				options: { repositoryRoot: root, subjectFilters: { exclude: extraFilters, include: [] } }
			},
			{
				code: 'OPTIONS_SUBJECT_FILTERS_INVALID',
				options: { repositoryRoot: root, subjectFilters: { exclude: [0], include: [] } }
			},
			{
				code: 'OPTIONS_SUBJECT_FILTERS_INVALID',
				options: { repositoryRoot: root, subjectFilters: { exclude: ['../escape'], include: [] } }
			}
		];
		for (const testCase of cases) {
			const outcome = runStaticModuleImpactCandidateReport(
				'requestValue' in testCase ? testCase.requestValue : request(),
				(testCase.options ?? { repositoryRoot: root }) as Parameters<
					typeof runStaticModuleImpactCandidateReport
				>[1]
			);
			expect(outcome).toMatchObject({ code: testCase.code, outcome: 'unavailable' });
		}
		const incompatible = runStaticModuleImpactCandidateReport(
			{ ...request(), operationVersion: 'old' },
			{ repositoryRoot: root }
		);
		expect(staticModuleImpactCandidateReportExitCode(incompatible)).toBe(2);
		const failed = runStaticModuleImpactCandidateReport(
			request(),
			[] as unknown as Parameters<typeof runStaticModuleImpactCandidateReport>[1]
		);
		expect(staticModuleImpactCandidateReportExitCode(failed)).toBe(4);
	});

	it('refuses the outer projection when only the predecessor fits maxResultBytes', () => {
		const root = fixture();
		const entryRequest = request({
			seed: {
				...request().seed,
				expectedArtifactSha256: sha256(ENTRY),
				id: 'seed:entry-result-budget',
				logicalPath: 'packages/demo/src/entry.ts'
			}
		});
		const calibration = runStaticModuleImpactCandidateReport(entryRequest, {
			repositoryRoot: root
		});
		if (calibration.outcome !== 'partial') throw new Error(JSON.stringify(calibration));
		const predecessorBytes =
			Buffer.byteLength(
				canonicalSemanticJson(calibration.result.evidence.predecessorReport),
				'utf8'
			) + 1;
		const outcome = runStaticModuleImpactCandidateReport(
			request({
				budgets: { ...entryRequest.budgets, maxResultBytes: predecessorBytes + 1_024 },
				seed: entryRequest.seed
			}),
			{ repositoryRoot: root }
		);
		expect(outcome).toMatchObject({
			code: 'RESULT_BUDGET_EXCEEDED',
			outcome: 'unavailable',
			stage: 'RESULT',
			state: 'resource-refused'
		});
	});
});
