import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
	PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
	PROJECT_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION,
	PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS,
	type ProjectContextReportRequest
} from '../contracts/project-context-report.js';
import {
	SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY,
	SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY_TRANSFER,
	SEMANTIC_SOURCE_QUERY_REPORT_GATE_EFFECT,
	SEMANTIC_SOURCE_QUERY_REPORT_NONCLAIMS,
	SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
	SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION,
	type SemanticSourceQueryReportRequest
} from '../contracts/semantic-source-query-report.js';
import type { SemanticSourceQueryExpression } from '../contracts/semantic-source-query.js';
import { evaluateSemanticSourceQuery } from '../query/evaluate-semantic-source-query.js';
import { canonicalSemanticJson, canonicalSemanticJsonWitness } from '../semantic/canonical.js';
import { verifyFrozenSubject } from '../subject/freshness.js';
import {
	captureSemanticReportPipeline,
	type SemanticReportPipelineCapture,
	type SemanticReportPipelineOutcome
} from './run-project-context-report.js';
import {
	SEMANTIC_SOURCE_QUERY_REPORT_PROGRESS_NONCLAIMS,
	runSemanticSourceQueryReportWithDependencies,
	semanticSourceQueryReportExitCode,
	type SemanticSourceQueryReportProgressEvent,
	type SemanticSourceQueryReportRuntimeDependencies
} from './run-semantic-source-query-report.js';

let repositoryRoot = '';
let captured: SemanticReportPipelineCapture;

function write(root: string, path: string, contents: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents, 'utf8');
}

function json(root: string, path: string, value: unknown): void {
	write(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

function createFixture(): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-semantic-source-query-report-'));
	json(root, 'package.json', {
		name: 'semantic-source-query-report-fixture',
		private: true,
		type: 'module',
		workspaces: ['projects/*']
	});
	json(root, 'projects/app/package.json', {
		name: '@fixture/semantic-source-query-report',
		private: true,
		type: 'module',
		version: '0.0.0'
	});
	json(root, 'projects/app/tsconfig.json', {
		compilerOptions: {
			module: 'NodeNext',
			moduleResolution: 'NodeNext',
			noEmit: true,
			noLib: true,
			strict: true,
			target: 'ES2022'
		},
		include: ['src/**/*']
	});
	write(root, 'projects/app/src/alpha.ts', 'export const alpha = 1;\n');
	write(root, 'projects/app/src/beta.ts', 'export const beta = 2;\n');
	write(root, 'projects/app/src/external.d.ts', 'export declare const external: number;\n');
	// Retained as an unsupported framework candidate, making the branded semantic capture PARTIAL.
	write(root, 'projects/app/src/View.svelte', '<p>fixture</p>\n');
	write(root, 'bun.lock', 'fixture lock\n');
	return root;
}

function budgets(): SemanticSourceQueryReportRequest['budgets'] {
	return {
		maxDiagnostics: 100,
		maxResultBytes: 8 * 1024 * 1024,
		maxResultRecords: 20_000,
		query: {
			maxDepth: 8,
			maxEvaluations: 10_000,
			maxFanout: 16,
			maxNodes: 64,
			maxPopulation: 100,
			maxTraceNodes: 10_000
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
	};
}

function matchingExpression(): SemanticSourceQueryExpression {
	return {
		kind: 'OR',
		nodeId: 'root',
		operands: [
			{
				field: 'logicalPath',
				kind: 'LOGICAL_PATH_STARTS_WITH',
				nodeId: 'path',
				value: 'projects/app/src/alpha'
			},
			{
				field: 'declarationFile',
				kind: 'EQUALS',
				nodeId: 'declaration',
				value: true
			}
		]
	};
}

function zeroMatchExpression(): SemanticSourceQueryExpression {
	return {
		field: 'logicalPath',
		kind: 'EQUALS',
		nodeId: 'absent',
		value: 'projects/app/src/absent.ts'
	};
}

function request(
	overrides: Partial<SemanticSourceQueryReportRequest> = {}
): SemanticSourceQueryReportRequest {
	return {
		budgets: budgets(),
		executionId: 'execution-001',
		expression: matchingExpression(),
		operationVersion: SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
		schemaVersion: SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: ['projects/app/tsconfig.json'],
		...overrides
	};
}

function predecessorRequest(
	reportRequest: SemanticSourceQueryReportRequest
): ProjectContextReportRequest {
	return {
		budgets: {
			maxResultBytes: Math.min(
				reportRequest.budgets.maxResultBytes,
				PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS.maxResultBytes
			),
			projectContext: PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS.projectContext,
			semantic: reportRequest.budgets.semantic,
			subject: reportRequest.budgets.subject
		},
		operationVersion: PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
		schemaVersion: PROJECT_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: reportRequest.subjectProjectConfigPaths
	};
}

function dependencies(
	overrides: Partial<SemanticSourceQueryReportRuntimeDependencies> = {}
): SemanticSourceQueryReportRuntimeDependencies {
	return {
		captureSemantic: (requestValue) => ({
			...captured,
			request: requestValue as ProjectContextReportRequest
		}),
		evaluateQuery: evaluateSemanticSourceQuery,
		verifySubject: verifyFrozenSubject,
		...overrides
	};
}

beforeAll(() => {
	repositoryRoot = createFixture();
	const outcome = captureSemanticReportPipeline(predecessorRequest(request()), {
		repositoryRoot
	});
	if (outcome.outcome !== 'semantic-captured') throw new Error(JSON.stringify(outcome));
	captured = outcome;
}, 120_000);

afterAll(() => {
	if (repositoryRoot !== '') rmSync(repositoryRoot, { force: true, recursive: true });
});

describe('runSemanticSourceQueryReport', () => {
	it('returns compact exact partitions, node-total traces, metadata identities, and deferred progress', async () => {
		const progress: SemanticSourceQueryReportProgressEvent[] = [];
		let telemetryWasDeferred = true;
		const exactEvaluator: typeof evaluateSemanticSourceQuery = (input) => {
			telemetryWasDeferred &&= progress.length === 0;
			return evaluateSemanticSourceQuery(input);
		};
		const outcome = await runSemanticSourceQueryReportWithDependencies(
			request(),
			{ onProgress: (event) => progress.push(event), repositoryRoot },
			dependencies({ evaluateQuery: exactEvaluator })
		);
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('partial');
		expect(semanticSourceQueryReportExitCode(outcome)).toBe(3);
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));

		expect(outcome).toMatchObject({
			analysisAuthority: SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY,
			authorityTransfer: SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY_TRANSFER,
			gateEffect: SEMANTIC_SOURCE_QUERY_REPORT_GATE_EFFECT,
			state: 'partial'
		});
		expect(outcome.result.capability).toEqual({
			fullJanCsaaCapability029SemanticQuery: 'NOT_CLAIMED',
			id: 'IMPLEMENTATION_LOCAL_SEMANTIC_SOURCE_QUERY',
			registeredJanCsaa007Operation: 'NOT_CLAIMED',
			status: 'IMPLEMENTATION_LOCAL_UNREGISTERED'
		});
		expect(outcome.result.facadeNonclaims).toStrictEqual(SEMANTIC_SOURCE_QUERY_REPORT_NONCLAIMS);
		expect(outcome.result.queryDefinition).toMatchObject({
			access: 'CAPTURED_STATIC_SEMANTIC_SOURCE_METADATA_ONLY',
			evaluationMode: 'COMPLETE',
			explanationPolicy: 'NODE_TOTAL_PREORDER_TRACE_PER_RETAINED_SOURCE',
			ordering: 'STATIC_SEMANTIC_SNAPSHOT_SOURCE_ORDER',
			population: 'SEMANTIC_SOURCE',
			registeredOperators: ['EQUALS', 'LOGICAL_PATH_STARTS_WITH', 'NOT', 'AND', 'OR']
		});
		expect(outcome.result.queryDefinition.registeredFields).toEqual(
			expect.arrayContaining(['id', 'projectId', 'programId', 'provenanceId', 'logicalPath'])
		);
		expect(outcome.result.queryBinding).toMatchObject({
			definitionId: outcome.result.queryDefinition.id,
			referenceId: outcome.result.queryReference.id,
			semanticSnapshotId: outcome.result.population.semanticSnapshotId,
			subjectId: outcome.subject.subjectId
		});
		expect(outcome.result.queryResult).toMatchObject({
			bindingId: outcome.result.queryBinding.id,
			executionId: 'execution-001'
		});
		expect(outcome.result.queryExplanation).toMatchObject({
			nodeTotal: true,
			resultId: outcome.result.queryResult.id,
			traceNodes: outcome.result.queryCoverage.traceNodes
		});
		expect(outcome.result.identities).toEqual({
			queryBindingId: outcome.result.queryBinding.id,
			queryDefinitionId: outcome.result.queryDefinition.id,
			queryExplanationId: outcome.result.queryExplanation.id,
			queryReferenceId: outcome.result.queryReference.id,
			queryResultId: outcome.result.queryResult.id
		});

		const byId = new Map(
			outcome.result.evaluations.map((evaluation) => [evaluation.source.id, evaluation.source])
		);
		expect(
			outcome.result.partitions.supportedMatches.map((id) => byId.get(id)?.logicalPath).sort()
		).toEqual(['projects/app/src/alpha.ts', 'projects/app/src/external.d.ts']);
		expect(
			outcome.result.partitions.supportedNonmatches.map((id) => byId.get(id)?.logicalPath)
		).toEqual(['projects/app/src/beta.ts']);
		expect(outcome.result.partitions).toMatchObject({
			conflict: [],
			notApplicable: [],
			unevaluated: [],
			unknown: []
		});
		expect(outcome.result.evaluations).toHaveLength(3);
		expect(
			outcome.result.evaluations.every(
				(evaluation) =>
					evaluation.query.trace.map((node) => node.nodeId).join(',') === 'root,path,declaration'
			)
		).toBe(true);
		expect(outcome.result.dynamicEvidence).toMatchObject({
			applicability: 'NOT_APPLICABLE',
			epistemic: {
				capabilityCoverage: 'excluded',
				executionHealth: 'not-run',
				inference: 'not-applicable',
				supportBasis: { kind: 'not-applicable' }
			}
		});
		expect(outcome.result.population).toMatchObject({
			evaluationClosure: 'CLOSED_FOR_RETAINED_VALIDATED_SEMANTIC_SOURCES',
			globalClosure: 'OPEN',
			semanticHealth: 'PARTIAL',
			zeroSupportedMatchesMeaning: 'NO_SUPPORTED_MATCH_IN_RETAINED_POPULATION_ONLY'
		});
		expect(outcome.result.currentness).toEqual({
			changedPaths: [],
			diagnosticCodes: [],
			scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
			state: 'CURRENT_FOR_CAPTURED_SUBJECT'
		});
		expect(outcome.stageOutcomes.currentness).toEqual({
			diagnosticCodes: [],
			state: 'CURRENT_FOR_CAPTURED_SUBJECT'
		});
		expect(outcome.result.limitations.zeroSupportedMatchesGlobalAbsence).toBe('NOT_SUPPORTED');
		expect(canonicalSemanticJson(outcome)).not.toContain(repositoryRoot);
		expect(Object.isFrozen(outcome)).toBe(true);

		expect(telemetryWasDeferred).toBe(true);
		expect(progress).toHaveLength(12);
		expect(progress.map((event) => event.sequence)).toEqual(progress.map((_, index) => index + 1));
		expect(progress.map((event) => event.phase)).toEqual([
			'REQUEST_BIND',
			'REQUEST_BIND',
			'QUERY_VALIDATE',
			'QUERY_VALIDATE',
			'SEMANTIC_CAPTURE',
			'SEMANTIC_CAPTURE',
			'QUERY_EVALUATE',
			'QUERY_EVALUATE',
			'CURRENTNESS',
			'CURRENTNESS',
			'RESULT',
			'RESULT'
		]);
		expect(
			progress.every((event) => event.nonclaims === SEMANTIC_SOURCE_QUERY_REPORT_PROGRESS_NONCLAIMS)
		).toBe(true);
	});

	it('keeps zero matches bounded to the retained PARTIAL/open population', async () => {
		const outcome = await runSemanticSourceQueryReportWithDependencies(
			request({ executionId: 'zero-match', expression: zeroMatchExpression() }),
			{ repositoryRoot },
			dependencies()
		);
		expect(outcome.outcome).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		expect(outcome.result.partitions.supportedMatches).toEqual([]);
		expect(outcome.result.partitions.supportedNonmatches).toHaveLength(3);
		expect(outcome.result.population).toMatchObject({
			globalClosure: 'OPEN',
			semanticHealth: 'PARTIAL',
			zeroSupportedMatchesMeaning: 'NO_SUPPORTED_MATCH_IN_RETAINED_POPULATION_ONLY'
		});
		expect(outcome.result.limitations.zeroSupportedMatchesGlobalAbsence).toBe('NOT_SUPPORTED');
		expect(outcome.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
			'SEMANTIC_CAPTURE_PARTIAL'
		);
	});

	it('rejects hostile or over-budget descendants before semantic capture', async () => {
		const cyclic: Record<string, unknown> = { kind: 'NOT', nodeId: 'cycle' };
		cyclic.operand = cyclic;
		const getter = { kind: 'NOT', nodeId: 'getter' } as Record<string, unknown>;
		Object.defineProperty(getter, 'operand', {
			enumerable: true,
			get: () => matchingExpression()
		});
		const proxied = new Proxy(zeroMatchExpression(), {});
		const overBudget = {
			kind: 'AND',
			nodeId: 'and',
			operands: [zeroMatchExpression(), { ...zeroMatchExpression(), nodeId: 'second' }]
		} as SemanticSourceQueryExpression;
		for (const [expression, budgetOverride] of [
			[cyclic, undefined],
			[getter, undefined],
			[proxied, undefined],
			[overBudget, { ...budgets().query, maxNodes: 1 }]
		] as const) {
			const capture = vi.fn(dependencies().captureSemantic);
			const baseBudgets = budgets();
			const outcome = await runSemanticSourceQueryReportWithDependencies(
				request({
					budgets:
						budgetOverride === undefined ? baseBudgets : { ...baseBudgets, query: budgetOverride },
					expression: expression as SemanticSourceQueryExpression
				}),
				{ repositoryRoot },
				dependencies({ captureSemantic: capture })
			);
			expect(outcome.outcome).toBe('unavailable');
			expect(capture).not.toHaveBeenCalled();
		}
	});

	it('contains predecessor unavailability without trusting its diagnostic envelope', async () => {
		const injected = {
			code: 'FORGED_CODE',
			diagnostics: [
				{
					code: 'FORGED_DIAGNOSTIC',
					message: repositoryRoot,
					path: repositoryRoot,
					phase: null,
					severity: 'ERROR',
					source: 'REPORT'
				}
			],
			facadeNonclaims: [],
			operationVersion: 'forged',
			outcome: 'unavailable',
			schemaVersion: 'forged',
			stage: 'RESULT',
			state: 'failed'
		} as unknown as SemanticReportPipelineOutcome;
		const outcome = await runSemanticSourceQueryReportWithDependencies(
			request(),
			{ repositoryRoot },
			dependencies({ captureSemantic: () => injected })
		);
		expect(outcome).toMatchObject({
			code: 'SEMANTIC_CAPTURE_UNAVAILABLE',
			outcome: 'unavailable',
			stage: 'SEMANTIC_CAPTURE'
		});
		expect(canonicalSemanticJson(outcome)).not.toContain('FORGED');
		expect(canonicalSemanticJson(outcome)).not.toContain(repositoryRoot);
	});

	it('detaches request aliases before awaiting capture and verifies currentness after evaluation', async () => {
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		let evaluated = false;
		let verifiedAfterEvaluation = false;
		const mutable = request();
		const outcomePromise = runSemanticSourceQueryReportWithDependencies(
			mutable,
			{ repositoryRoot },
			dependencies({
				captureSemantic: async (requestValue) => {
					await gate;
					return { ...captured, request: requestValue as ProjectContextReportRequest };
				},
				evaluateQuery: (input) => {
					evaluated = true;
					return evaluateSemanticSourceQuery(input);
				},
				verifySubject: ((subject, options) => {
					verifiedAfterEvaluation = evaluated;
					return verifyFrozenSubject(subject, options);
				}) as typeof verifyFrozenSubject
			})
		);
		(mutable as { executionId: string }).executionId = 'mutated';
		(mutable.expression as { nodeId: string }).nodeId = 'mutated';
		(mutable.subjectProjectConfigPaths as string[])[0] = 'mutated/tsconfig.json';
		release();
		const outcome = await outcomePromise;
		expect(outcome.outcome).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		expect(outcome.request.executionId).toBe('execution-001');
		expect(outcome.request.expression).toEqual(matchingExpression());
		expect(outcome.request.subjectProjectConfigPaths).toEqual(['projects/app/tsconfig.json']);
		expect(verifiedAfterEvaluation).toBe(true);
	});

	it('accepts an exact injected evaluator and rejects a forged result', async () => {
		const exact = await runSemanticSourceQueryReportWithDependencies(
			request({ executionId: 'exact-injected' }),
			{ repositoryRoot },
			dependencies({ evaluateQuery: (input) => evaluateSemanticSourceQuery(input) })
		);
		expect(exact.outcome).toBe('partial');

		const forgedEvaluator: typeof evaluateSemanticSourceQuery = (input) => {
			const outcome = evaluateSemanticSourceQuery(input);
			if (outcome.state === 'REFUSED') return outcome;
			return {
				state: 'EVALUATED',
				evaluation: {
					...outcome.evaluation,
					coverage: {
						...outcome.evaluation.coverage,
						chargedEvaluations: outcome.evaluation.coverage.chargedEvaluations + 1
					}
				}
			};
		};
		const forged = await runSemanticSourceQueryReportWithDependencies(
			request({ executionId: 'forged-injected' }),
			{ repositoryRoot },
			dependencies({ evaluateQuery: forgedEvaluator })
		);
		expect(forged).toMatchObject({
			code: 'QUERY_EVALUATION_VALIDATION_FAILED',
			outcome: 'unavailable',
			stage: 'QUERY_EVALUATE'
		});
	});

	it('rejects accessor-varying dependency and capture shells without invoking their getters', async () => {
		let dependencyGetterReads = 0;
		const accessorDependencies = dependencies() as SemanticSourceQueryReportRuntimeDependencies &
			Record<string, unknown>;
		Object.defineProperty(accessorDependencies, 'evaluateQuery', {
			enumerable: true,
			get() {
				dependencyGetterReads += 1;
				return evaluateSemanticSourceQuery;
			}
		});
		const dependencyOutcome = await runSemanticSourceQueryReportWithDependencies(
			request({ executionId: 'accessor-dependencies' }),
			{ repositoryRoot },
			accessorDependencies
		);
		expect(dependencyOutcome).toMatchObject({
			code: 'INTERNAL_FAILURE',
			outcome: 'unavailable',
			state: 'failed'
		});
		expect(dependencyGetterReads).toBe(0);

		let captureGetterReads = 0;
		const accessorCapture = {
			...captured,
			request: predecessorRequest(request({ executionId: 'accessor-capture' }))
		} as SemanticReportPipelineCapture & Record<string, unknown>;
		Object.defineProperty(accessorCapture, 'semanticSnapshot', {
			enumerable: true,
			get() {
				captureGetterReads += 1;
				return captured.semanticSnapshot;
			}
		});
		const captureOutcome = await runSemanticSourceQueryReportWithDependencies(
			request({ executionId: 'accessor-capture' }),
			{ repositoryRoot },
			dependencies({ captureSemantic: () => accessorCapture })
		);
		expect(captureOutcome).toMatchObject({
			code: 'SEMANTIC_CAPTURE_UNAVAILABLE',
			outcome: 'unavailable',
			stage: 'SEMANTIC_CAPTURE'
		});
		expect(captureGetterReads).toBe(0);
	});

	it('trusted-replays injected REFUSED outcomes before using any diagnostic framing', async () => {
		const forgedRefusal = await runSemanticSourceQueryReportWithDependencies(
			request({ executionId: 'forged-refusal' }),
			{ repositoryRoot },
			dependencies({
				evaluateQuery: (() => ({
					diagnostic: {
						code: 'FORGED_BUDGET',
						message: `leak:${repositoryRoot}`,
						phase: 'REQUEST'
					},
					state: 'REFUSED'
				})) as unknown as typeof evaluateSemanticSourceQuery
			})
		);
		expect(forgedRefusal).toMatchObject({
			code: 'QUERY_EVALUATION_VALIDATION_FAILED',
			outcome: 'unavailable',
			stage: 'QUERY_EVALUATE'
		});
		expect(canonicalSemanticJson(forgedRefusal)).not.toContain('FORGED');
		expect(canonicalSemanticJson(forgedRefusal)).not.toContain(repositoryRoot);
	});

	it('discards a mutable exact injected evaluation before final verifier-side mutation', async () => {
		let mutableOutcome!: {
			evaluation: { coverage: { chargedEvaluations: number } };
			state: 'EVALUATED';
		};
		const outcome = await runSemanticSourceQueryReportWithDependencies(
			request({ executionId: 'mutable-exact-injected' }),
			{ repositoryRoot },
			dependencies({
				evaluateQuery: ((input: Parameters<typeof evaluateSemanticSourceQuery>[0]) => {
					mutableOutcome = JSON.parse(
						canonicalSemanticJson(evaluateSemanticSourceQuery(input))
					) as typeof mutableOutcome;
					return mutableOutcome;
				}) as unknown as typeof evaluateSemanticSourceQuery,
				verifySubject: ((subject, options) => {
					mutableOutcome.evaluation.coverage.chargedEvaluations += 10_000;
					return verifyFrozenSubject(subject, options);
				}) as typeof verifyFrozenSubject
			})
		);
		expect(outcome.outcome).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		expect(mutableOutcome.state).toBe('EVALUATED');
		expect(outcome.result.queryCoverage.chargedEvaluations).toBe(
			outcome.result.queryCoverage.traceNodes
		);
		expect(mutableOutcome.evaluation.coverage.chargedEvaluations).toBe(
			outcome.result.queryCoverage.chargedEvaluations + 10_000
		);
	});

	it('reports a final stale captured subject after semantic evidence was evaluated', async () => {
		const alphaPath = join(repositoryRoot, 'projects/app/src/alpha.ts');
		const original = readFileSync(alphaPath, 'utf8');
		let mutated = false;
		try {
			const outcome = await runSemanticSourceQueryReportWithDependencies(
				request({ executionId: 'stale-final-subject' }),
				{ repositoryRoot },
				dependencies({
					evaluateQuery: (input) => {
						if (!mutated) {
							mutated = true;
							writeFileSync(alphaPath, `${original}// changed after capture\n`, 'utf8');
						}
						return evaluateSemanticSourceQuery(input);
					}
				})
			);
			expect(outcome.outcome).toBe('partial');
			if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
			expect(outcome.result.currentness).toMatchObject({
				changedPaths: ['projects/app/src/alpha.ts'],
				state: 'STALE'
			});
			expect(outcome.stageOutcomes.currentness.state).toBe('STALE');
		} finally {
			writeFileSync(alphaPath, original, 'utf8');
		}
	});

	it('keeps definition/reference/binding stable while result/explanation identify each execution', async () => {
		const first = await runSemanticSourceQueryReportWithDependencies(
			request({ executionId: 'occurrence-a' }),
			{ repositoryRoot },
			dependencies()
		);
		const second = await runSemanticSourceQueryReportWithDependencies(
			request({ executionId: 'occurrence-b' }),
			{ repositoryRoot },
			dependencies()
		);
		if (first.outcome !== 'partial' || second.outcome !== 'partial')
			throw new Error(JSON.stringify({ first, second }));
		expect(first.result.queryDefinition.id).toBe(second.result.queryDefinition.id);
		expect(first.result.queryReference.id).toBe(second.result.queryReference.id);
		expect(first.result.queryBinding.id).toBe(second.result.queryBinding.id);
		expect(first.result.queryResult.id).not.toBe(second.result.queryResult.id);
		expect(first.result.queryExplanation.id).not.toBe(second.result.queryExplanation.id);
	});

	it('refuses an exact one-byte-below result budget and counts the terminal LF', async () => {
		const roomy = await runSemanticSourceQueryReportWithDependencies(
			request({ executionId: 'byte-budget' }),
			{ repositoryRoot },
			dependencies()
		);
		if (roomy.outcome !== 'partial') throw new Error(JSON.stringify(roomy));
		const firstBytes = canonicalSemanticJsonWitness(roomy).bytes + 1;
		const tighterBudgets = { ...budgets(), maxResultBytes: firstBytes };
		const tight = await runSemanticSourceQueryReportWithDependencies(
			request({ budgets: tighterBudgets, executionId: 'byte-budget' }),
			{ repositoryRoot },
			dependencies()
		);
		if (tight.outcome !== 'partial') throw new Error(JSON.stringify(tight));
		const exactBytes = canonicalSemanticJsonWitness(tight).bytes + 1;
		const refused = await runSemanticSourceQueryReportWithDependencies(
			request({
				budgets: { ...budgets(), maxResultBytes: exactBytes - 1 },
				executionId: 'byte-budget'
			}),
			{ repositoryRoot },
			dependencies()
		);
		expect(refused).toMatchObject({
			code: 'RESULT_BUDGET_EXCEEDED',
			outcome: 'unavailable',
			stage: 'RESULT',
			state: 'resource-refused'
		});
	});

	it('rechecks the final record budget after currentness diagnostics are attached', async () => {
		const mismatchingVerifier = (() => ({
			changedPaths: [],
			diagnostics: [],
			state: 'STALE'
		})) as unknown as typeof verifyFrozenSubject;
		const roomy = await runSemanticSourceQueryReportWithDependencies(
			request({ executionId: 'record-budget-currentness' }),
			{ repositoryRoot },
			dependencies({ verifySubject: mismatchingVerifier })
		);
		if (roomy.outcome !== 'partial') throw new Error(JSON.stringify(roomy));
		expect(roomy.result.currentness.state).toBe('UNAVAILABLE');
		const finalAccountedRecords =
			roomy.result.evaluations.length +
			roomy.result.queryCoverage.traceNodes +
			roomy.result.population.retainedRecords +
			roomy.result.limitations.semanticSnapshot.length +
			roomy.result.queryDefinition.expression.nodeCount +
			roomy.diagnostics.length +
			roomy.result.currentness.changedPaths.length +
			16;
		const refused = await runSemanticSourceQueryReportWithDependencies(
			request({
				budgets: { ...budgets(), maxResultRecords: finalAccountedRecords - 1 },
				executionId: 'record-budget-currentness'
			}),
			{ repositoryRoot },
			dependencies({ verifySubject: mismatchingVerifier })
		);
		expect(refused).toMatchObject({
			code: 'RESULT_RECORD_BUDGET_EXCEEDED',
			outcome: 'unavailable',
			stage: 'CURRENTNESS',
			state: 'resource-refused'
		});
	});
});
