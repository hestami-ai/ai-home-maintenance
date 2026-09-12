import { Buffer } from 'node:buffer';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DECLARATION_CONTEXT_ANALYSIS_NONCLAIMS } from '../contracts/declaration-context-analysis.js';
import {
	DECLARATION_CONTEXT_REPORT_NONCLAIMS,
	DECLARATION_CONTEXT_REPORT_OPERATION_VERSION,
	DECLARATION_CONTEXT_REPORT_PREDECESSOR_NONCLAIMS,
	DECLARATION_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION,
	DECLARATION_CONTEXT_REPORT_SAFETY_CEILINGS,
	DECLARATION_CONTEXT_REPORT_SCHEMA_VERSION,
	DECLARATION_CONTEXT_REPORT_SELECTION,
	type DeclarationContextReportBudgets,
	type DeclarationContextReportRequest
} from '../contracts/declaration-context-report.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import {
	DECLARATION_CONTEXT_ANALYSIS_FIXTURE_EXPORT_NAME,
	DECLARATION_CONTEXT_ANALYSIS_FIXTURE_TERMINAL_NAME,
	createDeclarationContextAnalysisFixture,
	declarationContextAnalysisBudgets,
	type DeclarationContextAnalysisFixture,
	type DeclarationContextAnalysisFixtureOptions
} from '../semantic/declaration-context-analysis-fixture.test-support.js';
import {
	DECLARATION_CONTEXT_REPORT_PROGRESS_NONCLAIMS,
	declarationContextReportExitCode,
	runDeclarationContextReport,
	type DeclarationContextReportProgressEvent
} from './run-declaration-context-report.js';

const fixtures: DeclarationContextAnalysisFixture[] = [];

function fixture(
	options: DeclarationContextAnalysisFixtureOptions = {}
): DeclarationContextAnalysisFixture {
	const created = createDeclarationContextAnalysisFixture(options);
	fixtures.push(created);
	return created;
}

function budgets(
	overrides: Partial<DeclarationContextReportBudgets> = {}
): DeclarationContextReportBudgets {
	return {
		conditionalExport: {
			maxAstNodes: 100_000,
			maxBranches: 10_000,
			maxConditionChecks: 10_000,
			maxDiagnostics: 1_000,
			maxFrontiers: 10_000,
			maxInputRecords: 1_000_000,
			maxInputStringCharacters: 64 * 1024 * 1024,
			maxManifestBytes: 4 * 1024 * 1024,
			maxOutputRecords: 20_001,
			maxTraversalSteps: 1_000_000
		},
		declarationContext: declarationContextAnalysisBudgets(),
		maxResultBytes: 128 * 1024 * 1024,
		moduleResolutionTrace: {
			maxAstNodes: 100_000,
			maxAttempts: 100_000,
			maxCandidates: 100_000,
			maxDiagnostics: 1_000,
			maxInputRecords: 1_000_000,
			maxInputStringCharacters: 64 * 1024 * 1024,
			maxOutputRecords: 200_001,
			maxReadBytes: 64 * 1024 * 1024,
			maxTraversalSteps: 300_000
		},
		projectContext: {
			maxConfigurationClosureRecords: 10_000,
			maxDiagnostics: 1_000,
			maxInputRecords: 1_000_000,
			maxInputStringCharacters: 64 * 1024 * 1024,
			maxMemberships: 100_000,
			maxOutputRecords: 200_000,
			maxPrograms: 10_000,
			maxProjectReferences: 10_000,
			maxProjects: 100,
			maxSources: 100_000,
			maxTraversalSteps: 1_000_000
		},
		semantic: {
			maxAstDepth: 256,
			maxAstNodes: 200_000,
			maxCompilerFacts: 200_000,
			maxCompilerInputMetadataBytes: 32 * 1024 * 1024,
			maxCompilerQueries: 200_000,
			maxCompilerQueryInvocations: 2_000_000,
			maxContextBytes: 64 * 1024 * 1024,
			maxContextFileBytes: 8 * 1024 * 1024,
			maxContextFiles: 10_000,
			maxDiagnosticCharacters: 2_000_000,
			maxDiagnostics: 10_000,
			maxDirectoryEntries: 1_000_000,
			maxDurationMs: 60_000,
			maxLiteralCharacters: 10_000,
			maxPathCharacters: 4_096,
			maxProjects: 10,
			maxScopes: 200_000,
			maxSnapshotBytes: 128 * 1024 * 1024,
			maxSources: 10_000
		},
		subject: {
			maxBytes: 64 * 1024 * 1024,
			maxConfigDepth: 32,
			maxDiagnostics: 1_000,
			maxDurationMs: 30_000,
			maxFiles: 10_000,
			maxProjects: 10
		},
		...overrides
	};
}

function request(
	selected: DeclarationContextAnalysisFixture,
	overrides: Partial<DeclarationContextReportRequest> = {},
	budgetOverrides: Partial<DeclarationContextReportBudgets> = {}
): DeclarationContextReportRequest {
	const importerSource = selected.semanticSnapshot.sources.find(
		(source) => source.id === selected.importerSourceId
	)!;
	const importerProject = selected.semanticSnapshot.projects.find(
		(project) => project.id === importerSource.projectId
	)!;
	const importerResolution = selected.semanticSnapshot.moduleResolutions.find(
		(resolution) => resolution.id === selected.importerModuleResolutionId
	)!;
	const specifierNode = selected.semanticSnapshot.astNodes.find(
		(node) => node.id === importerResolution.nodeId
	)!;
	return {
		budgets: budgets(budgetOverrides),
		exportName: DECLARATION_CONTEXT_ANALYSIS_FIXTURE_EXPORT_NAME,
		importer: {
			logicalPath: selected.importerPath,
			projectConfigPath: importerProject.configPath,
			specifierNodeStart: specifierNode.start
		},
		operationVersion: DECLARATION_CONTEXT_REPORT_OPERATION_VERSION,
		packageName: '@fixture/module-target',
		schemaVersion: DECLARATION_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: ['tsconfig.json'],
		...overrides
	};
}

afterEach(() => {
	for (const selected of fixtures.splice(0)) selected.cleanup();
});

describe('runDeclarationContextReport', () => {
	it(
		'returns deterministic exact declaration binding evidence with ordered bounded progress',
		{ timeout: 120_000 },
		async () => {
			const selected = fixture();
			const events: DeclarationContextReportProgressEvent[] = [];
			const first = runDeclarationContextReport(request(selected), {
				onProgress: (event) => events.push(event),
				repositoryRoot: selected.root
			});
			const second = runDeclarationContextReport(request(selected), {
				repositoryRoot: selected.root
			});
			expect(first.outcome).toBe('partial');
			expect(declarationContextReportExitCode(first)).toBe(3);
			const firstJson = canonicalSemanticJson(first);
			expect(firstJson).toBe(canonicalSemanticJson(second));
			if (first.outcome !== 'partial') throw new Error(JSON.stringify(first));

			expect(first.result.capability).toMatchObject({ id: 'JAN-CSAA-CAP-013', status: 'PARTIAL' });
			expect(first.result.selection).toBe(DECLARATION_CONTEXT_REPORT_SELECTION);
			expect(first.result.binding).toMatchObject({
				aliasHops: 1,
				declarationCount: 2,
				exportName: DECLARATION_CONTEXT_ANALYSIS_FIXTURE_EXPORT_NAME,
				mergeState: 'MERGED',
				resolutionKind: 'ALIASED_TO_TERMINAL_SYMBOL',
				terminalName: DECLARATION_CONTEXT_ANALYSIS_FIXTURE_TERMINAL_NAME
			});
			expect(first.result.binding.declarationArtifact).toMatchObject({
				extension: '.d.ts',
				logicalPath: 'packages/module-target/dist/index.d.ts',
				origin: 'WORKSPACE_BUILD_DECLARATION'
			});
			expect(first.result.binding.declarationKinds).toEqual(['INTERFACE', 'NAMESPACE']);
			expect(first.result.evidence.declarationContextAnalysis.exportBinding.id).toBe(
				first.result.binding.exportBindingId
			);
			expect(first.result.evidence.moduleResolutionTrace.targetWitness.logicalPath).toBe(
				first.result.binding.declarationArtifact.logicalPath
			);
			expect(first.result.currentness).toMatchObject({
				compilerCapture: 'NOT_ASSESSED',
				contextOnlyTarget: 'NOT_ASSESSED',
				scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
				state: 'CURRENT_FOR_CAPTURED_SUBJECT'
			});
			expect(first.result.facadeNonclaims).toBe(DECLARATION_CONTEXT_REPORT_NONCLAIMS);
			expect(first.result.facadeNonclaims).not.toContain('CURRENTNESS_OR_FRESHNESS');
			expect(
				DECLARATION_CONTEXT_ANALYSIS_NONCLAIMS.filter(
					(value) => value !== 'CURRENTNESS_OR_FRESHNESS'
				).every((value) => first.result.facadeNonclaims.includes(value))
			).toBe(true);
			expect(first.result.predecessorNonclaims).toBe(
				DECLARATION_CONTEXT_REPORT_PREDECESSOR_NONCLAIMS
			);
			expect(first.result.predecessorNonclaims.declarationContextAnalysis).toContain(
				'CURRENTNESS_OR_FRESHNESS'
			);
			expect(first.stageOutcomes.declarationContext.outcome).toBe('partial');
			expect(first.stageOutcomes.predecessorPipeline.moduleResolutionTrace.outcome).toBe('partial');

			expect(events.map((event) => event.sequence)).toEqual(events.map((_, index) => index + 1));
			expect(events.some((event) => event.kind === 'PREDECESSOR_PIPELINE')).toBe(true);
			expect(events.at(-1)).toMatchObject({
				detailCode: 'PARTIAL',
				phase: 'RESULT',
				state: 'COMPLETED'
			});
			expect(
				events.at(-1)?.observations.find((observation) => observation.metric === 'RESULT_BYTES')
			).toMatchObject({
				limit: first.request.budgets.maxResultBytes,
				unit: 'BYTES',
				value: Buffer.byteLength(firstJson, 'utf8') + 1
			});
			expect(
				events.every((event) => event.nonclaims === DECLARATION_CONTEXT_REPORT_PROGRESS_NONCLAIMS)
			).toBe(true);
			const terminalEventCount = events.length;
			await new Promise<void>((resolve) => setImmediate(resolve));
			expect(events).toHaveLength(terminalEventCount);
			expect(events.at(-1)).toMatchObject({
				detailCode: 'PARTIAL',
				phase: 'RESULT',
				state: 'COMPLETED'
			});
		}
	);

	it(
		'admits the exact terminal-byte boundary including LF and refuses one byte below it',
		{ timeout: 120_000 },
		() => {
			const selected = fixture();
			let limit = budgets().maxResultBytes;
			let exactBytes = 0;
			for (let attempt = 0; attempt < 4; attempt += 1) {
				const outcome = runDeclarationContextReport(
					request(selected, {}, { maxResultBytes: limit }),
					{ repositoryRoot: selected.root }
				);
				expect(outcome.outcome).toBe('partial');
				exactBytes = Buffer.byteLength(canonicalSemanticJson(outcome), 'utf8') + 1;
				if (exactBytes === limit) break;
				limit = exactBytes;
			}
			expect(exactBytes).toBe(limit);

			const refused = runDeclarationContextReport(
				request(selected, {}, { maxResultBytes: limit - 1 }),
				{ repositoryRoot: selected.root }
			);
			expect(refused).toMatchObject({
				code: 'RESULT_BUDGET_EXCEEDED',
				outcome: 'unavailable',
				stage: 'RESULT',
				state: 'resource-refused'
			});
		}
	);

	it(
		'supports the fixed zero-hop direct-export single-declaration slice',
		{ timeout: 120_000 },
		() => {
			const selected = fixture({
				targetDeclarationText: `export interface ${DECLARATION_CONTEXT_ANALYSIS_FIXTURE_EXPORT_NAME} { readonly value: string; }\n`
			});
			const outcome = runDeclarationContextReport(request(selected), {
				repositoryRoot: selected.root
			});
			if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
			expect(outcome.outcome).toBe('partial');
			expect(outcome.result.binding).toMatchObject({
				aliasHops: 0,
				declarationCount: 1,
				mergeState: 'SINGLE',
				resolutionKind: 'DIRECT_TERMINAL_SYMBOL',
				terminalName: DECLARATION_CONTEXT_ANALYSIS_FIXTURE_EXPORT_NAME
			});
		}
	);

	it(
		'fails closed for an absent exact export and a wrong import occurrence',
		{ timeout: 120_000 },
		() => {
			const selected = fixture();
			const absent = runDeclarationContextReport(
				request(selected, { exportName: 'AbsentContract' }),
				{ repositoryRoot: selected.root }
			);
			expect(absent).toMatchObject({
				outcome: 'unavailable',
				stage: 'DECLARATION_CONTEXT',
				state: 'incompatible'
			});
			expect(declarationContextReportExitCode(absent)).toBe(2);

			const base = request(selected);
			const wrongOccurrence = runDeclarationContextReport(
				request(selected, {
					importer: { ...base.importer, specifierNodeStart: base.importer.specifierNodeStart + 1 }
				}),
				{ repositoryRoot: selected.root }
			);
			expect(wrongOccurrence).toMatchObject({
				outcome: 'unavailable',
				stage: 'PREDECESSOR_PIPELINE',
				state: 'incompatible'
			});
			expect(declarationContextReportExitCode(wrongOccurrence)).toBe(2);
		}
	);

	it(
		'classifies declaration and result budget refusals without partial evidence',
		{ timeout: 120_000 },
		() => {
			const selected = fixture();
			const base = request(selected);
			const aliasRefused = runDeclarationContextReport(
				request(
					selected,
					{},
					{
						declarationContext: { ...base.budgets.declarationContext, maxAliasHops: 0 }
					}
				),
				{ repositoryRoot: selected.root }
			);
			expect(aliasRefused).toMatchObject({
				outcome: 'unavailable',
				stage: 'DECLARATION_CONTEXT',
				state: 'resource-refused'
			});
			expect(declarationContextReportExitCode(aliasRefused)).toBe(3);

			const resultRefused = runDeclarationContextReport(
				request(selected, {}, { maxResultBytes: 1 }),
				{ repositoryRoot: selected.root }
			);
			expect(resultRefused).toMatchObject({
				code: 'RESULT_BUDGET_EXCEEDED',
				outcome: 'unavailable',
				stage: 'RESULT',
				state: 'resource-refused'
			});
		}
	);

	it('rejects non-data records, incompatible versions, invalid export names, and inconsistent local budgets', () => {
		const selected = fixture();
		const base = request(selected);
		const inherited = Object.assign(Object.create({ inherited: true }) as object, base);
		const exportBudget = {
			...base.budgets.declarationContext,
			maxInputStringCharacters: 1
		};
		const shortReadBudget = {
			...base.budgets.declarationContext,
			maxReadBytes: base.budgets.declarationContext.maxProgramReadBytes - 1
		};
		const cases: readonly {
			readonly code: string;
			readonly path: string;
			readonly state?: 'incompatible' | 'resource-refused';
			readonly value: unknown;
		}[] = [
			{ code: 'REQUEST_SHAPE_INVALID', path: '$', value: inherited },
			{ code: 'REQUEST_SHAPE_INVALID', path: '$', value: { ...base, unexpected: true } },
			{
				code: 'REQUEST_OPERATION_INCOMPATIBLE',
				path: '$.operationVersion',
				value: { ...base, operationVersion: 'unsupported' }
			},
			{
				code: 'REQUEST_SCHEMA_INCOMPATIBLE',
				path: '$.schemaVersion',
				value: { ...base, schemaVersion: 'unsupported' }
			},
			{
				code: 'REQUEST_EXPORT_NAME_INVALID',
				path: '$.exportName',
				value: { ...base, exportName: '' }
			},
			{
				code: 'REQUEST_EXPORT_NAME_BUDGET_EXCEEDED',
				path: '$.exportName',
				state: 'resource-refused',
				value: {
					...base,
					budgets: { ...base.budgets, declarationContext: exportBudget },
					exportName: 'ab'
				}
			},
			{
				code: 'REQUEST_BUDGET_INVALID',
				path: '$.budgets.declarationContext.maxReadBytes',
				value: {
					...base,
					budgets: { ...base.budgets, declarationContext: shortReadBudget }
				}
			}
		];

		for (const malformed of cases) {
			const outcome = runDeclarationContextReport(malformed.value, {
				repositoryRoot: selected.root
			});
			expect(outcome, malformed.code).toMatchObject({
				code: malformed.code,
				outcome: 'unavailable',
				stage: 'REQUEST',
				state: malformed.state ?? 'incompatible'
			});
			expect(outcome.diagnostics[0], malformed.code).toMatchObject({ path: malformed.path });
		}

		for (const value of [0, -0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
			const outcome = runDeclarationContextReport(
				{
					...base,
					budgets: {
						...base.budgets,
						declarationContext: {
							...base.budgets.declarationContext,
							maxDeclarations: value
						}
					}
				},
				{ repositoryRoot: selected.root }
			);
			expect(outcome, String(value)).toMatchObject({
				code: 'REQUEST_BUDGET_INVALID',
				outcome: 'unavailable',
				stage: 'REQUEST',
				state: 'incompatible'
			});
		}
	});

	it('contains rejected telemetry and retains a monotonic zero fallback when the host clock fails', async () => {
		const baseline = runDeclarationContextReport({}, { repositoryRoot: process.cwd() });
		const events: DeclarationContextReportProgressEvent[] = [];
		const clock = vi.spyOn(process.hrtime, 'bigint').mockImplementation(() => {
			throw new Error('The trusted-host monotonic clock is unavailable.');
		});
		let observed;
		try {
			observed = runDeclarationContextReport(
				{},
				{
					onProgress: (event) => {
						events.push(event);
						return Promise.reject(new Error('Rejected telemetry remains out of band.'));
					},
					repositoryRoot: process.cwd()
				}
			);
		} finally {
			clock.mockRestore();
		}

		expect(canonicalSemanticJson(observed)).toBe(canonicalSemanticJson(baseline));
		expect(events).toHaveLength(2);
		expect(events.every((event) => event.elapsedMs === 0)).toBe(true);
		await new Promise<void>((resolve) => setImmediate(resolve));
	});

	it(
		'preserves bounded declaration diagnostics while redacting absolute and rejecting escaping paths',
		{ timeout: 120_000 },
		async () => {
			const selected = fixture();
			const baseline = runDeclarationContextReport(request(selected), {
				repositoryRoot: selected.root
			});
			expect(baseline.outcome).toBe('partial');
			if (baseline.outcome !== 'partial') throw new Error(JSON.stringify(baseline));
			const analysis = baseline.result.evidence.declarationContextAnalysis;
			vi.resetModules();
			vi.doMock('../semantic/build-declaration-context-analysis.js', () => ({
				buildDeclarationContextAnalysis: () => ({
					analysis,
					diagnostics: [
						{
							code: 'VALIDATION_FAILED',
							message: `Validation warning under ${selected.root}.`,
							path: join(selected.root, 'packages/module-target/dist/index.d.ts'),
							phase: 'ANALYSIS_VALIDATE'
						},
						{
							code: 'VALIDATION_FAILED',
							message: 'Validation warning outside the selected root.',
							path: '../outside.d.ts',
							phase: 'ANALYSIS_VALIDATE'
						}
					],
					outcome: 'partial'
				})
			}));

			try {
				const isolated = await import('./run-declaration-context-report.js');
				const outcome = isolated.runDeclarationContextReport(request(selected), {
					repositoryRoot: selected.root
				});
				expect(outcome.outcome).toBe('partial');
				if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
				expect(outcome.diagnostics.slice(-2).map((diagnostic) => diagnostic.path)).toEqual([
					'packages/module-target/dist/index.d.ts',
					null
				]);
				expect(outcome.stageOutcomes.declarationContext.diagnosticCodes).toEqual([
					'VALIDATION_FAILED',
					'VALIDATION_FAILED'
				]);
				expect(canonicalSemanticJson(outcome)).not.toContain(selected.root);
			} finally {
				vi.doUnmock('../semantic/build-declaration-context-analysis.js');
				vi.resetModules();
			}
		}
	);

	it('classifies an unrecognized declaration-analysis failure as failed', async () => {
		const selected = fixture();
		vi.resetModules();
		vi.doMock('../semantic/build-declaration-context-analysis.js', () => ({
			buildDeclarationContextAnalysis: () => ({
				diagnostics: [
					{
						code: 'VALIDATION_FAILED',
						message: 'The declaration analysis did not validate.',
						path: null,
						phase: 'ANALYSIS_VALIDATE'
					}
				],
				outcome: 'unavailable'
			})
		}));

		try {
			const isolated = await import('./run-declaration-context-report.js');
			const outcome = isolated.runDeclarationContextReport(request(selected), {
				repositoryRoot: selected.root
			});
			expect(outcome).toMatchObject({
				code: 'DECLARATION_CONTEXT_UNAVAILABLE',
				outcome: 'unavailable',
				stage: 'DECLARATION_CONTEXT',
				state: 'failed'
			});
		} finally {
			vi.doUnmock('../semantic/build-declaration-context-analysis.js');
			vi.resetModules();
		}
	});

	it('retains capture-bound evidence when the final currentness observer fails closed', async () => {
		const selected = fixture();
		let verificationCalls = 0;
		vi.resetModules();
		vi.doMock('../subject/freshness.js', async (importOriginal) => {
			const actual = await importOriginal<typeof import('../subject/freshness.js')>();
			return {
				...actual,
				verifyFrozenSubject: (...args: Parameters<typeof actual.verifyFrozenSubject>) => {
					verificationCalls += 1;
					if (verificationCalls === 5) throw new Error('Final currentness could not be observed.');
					return actual.verifyFrozenSubject(...args);
				}
			};
		});

		try {
			const isolated = await import('./run-declaration-context-report.js');
			const outcome = isolated.runDeclarationContextReport(request(selected), {
				repositoryRoot: selected.root
			});
			if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
			expect(outcome.outcome).toBe('partial');
			expect(verificationCalls).toBe(5);
			expect(outcome.result.currentness).toMatchObject({
				changedPaths: [],
				diagnosticCodes: ['SUBJECT_CHANGED_DURING_RESOLUTION'],
				state: 'UNAVAILABLE'
			});
		} finally {
			vi.doUnmock('../subject/freshness.js');
			vi.resetModules();
		}
	});

	it(
		'rejects declaration evidence that does not reconcile with the captured subject identity',
		{ timeout: 120_000 },
		async () => {
			const selected = fixture();
			const baseline = runDeclarationContextReport(request(selected), {
				repositoryRoot: selected.root
			});
			expect(baseline.outcome).toBe('partial');
			if (baseline.outcome !== 'partial') throw new Error(JSON.stringify(baseline));
			const analysis = {
				...baseline.result.evidence.declarationContextAnalysis,
				subjectId: 'non-reconciling-subject'
			};
			vi.resetModules();
			vi.doMock('../semantic/build-declaration-context-analysis.js', () => ({
				buildDeclarationContextAnalysis: () => ({ analysis, diagnostics: [], outcome: 'partial' })
			}));

			try {
				const isolated = await import('./run-declaration-context-report.js');
				const outcome = isolated.runDeclarationContextReport(request(selected), {
					repositoryRoot: selected.root
				});
				expect(outcome).toMatchObject({
					code: 'EVIDENCE_IDENTITY_MISMATCH',
					outcome: 'unavailable',
					stage: 'RESULT',
					state: 'failed'
				});
			} finally {
				vi.doUnmock('../semantic/build-declaration-context-analysis.js');
				vi.resetModules();
			}
		}
	);

	it('fails closed when canonical terminal-report serialization is unavailable', async () => {
		const selected = fixture();
		vi.resetModules();
		vi.doMock('../semantic/canonical.js', async (importOriginal) => {
			const actual = await importOriginal<typeof import('../semantic/canonical.js')>();
			return {
				...actual,
				canonicalSemanticJsonWitness: (value: unknown) => {
					const record = value as Readonly<Record<string, unknown>>;
					if (
						value !== null &&
						typeof value === 'object' &&
						record.schemaVersion === DECLARATION_CONTEXT_REPORT_SCHEMA_VERSION &&
						record.outcome === 'partial'
					)
						throw new Error('Canonical report serialization is unavailable.');
					return actual.canonicalSemanticJsonWitness(value);
				}
			};
		});

		try {
			const isolated = await import('./run-declaration-context-report.js');
			const outcome = isolated.runDeclarationContextReport(request(selected), {
				repositoryRoot: selected.root
			});
			expect(outcome).toMatchObject({
				code: 'RESULT_SERIALIZATION_FAILED',
				outcome: 'unavailable',
				stage: 'RESULT',
				state: 'failed'
			});
		} finally {
			vi.doUnmock('../semantic/canonical.js');
			vi.resetModules();
		}
	});

	it('fails closed when the trusted host throws while supplying its fixed repository root', () => {
		const selected = fixture();
		const events: DeclarationContextReportProgressEvent[] = [];
		const options = new Proxy(
			{
				onProgress: (event: DeclarationContextReportProgressEvent) => events.push(event),
				repositoryRoot: selected.root
			},
			{
				get(target, property, receiver) {
					if (property === 'repositoryRoot')
						throw new Error('The trusted host could not supply its fixed root.');
					return Reflect.get(target, property, receiver);
				}
			}
		);
		const outcome = runDeclarationContextReport(request(selected), options);

		expect(outcome).toMatchObject({
			code: 'INTERNAL_FAILURE',
			outcome: 'unavailable',
			stage: 'RESULT',
			state: 'failed'
		});
		expect(declarationContextReportExitCode(outcome)).toBe(4);
		expect(events.at(-1)).toMatchObject({
			detailCode: 'INTERNAL_FAILURE',
			phase: 'PREDECESSOR_PIPELINE',
			state: 'FAILED'
		});
	});

	it('rejects hostile request shapes and absolute-ceiling excess before analysis', () => {
		const selected = fixture();
		const base = request(selected);
		const proxied = new Proxy(base, {});
		const proxyOutcome = runDeclarationContextReport(proxied, { repositoryRoot: selected.root });
		expect(proxyOutcome).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'unavailable',
			stage: 'REQUEST',
			state: 'incompatible'
		});

		let getterReads = 0;
		const accessorRequest: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(base))
			Object.defineProperty(
				accessorRequest,
				key,
				key === 'budgets'
					? {
							enumerable: true,
							get() {
								getterReads += 1;
								return value;
							}
						}
					: { enumerable: true, value }
			);
		const accessorOutcome = runDeclarationContextReport(accessorRequest, {
			repositoryRoot: selected.root
		});
		expect(accessorOutcome).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'unavailable',
			stage: 'REQUEST',
			state: 'incompatible'
		});
		expect(getterReads).toBe(0);

		const ceilingOutcome = runDeclarationContextReport(
			request(
				selected,
				{},
				{
					declarationContext: {
						...base.budgets.declarationContext,
						maxTraversalSteps:
							DECLARATION_CONTEXT_REPORT_SAFETY_CEILINGS.declarationContext.maxTraversalSteps + 1
					}
				}
			),
			{ repositoryRoot: selected.root }
		);
		expect(ceilingOutcome).toMatchObject({
			code: 'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING',
			outcome: 'unavailable',
			stage: 'REQUEST',
			state: 'resource-refused'
		});

		const resultCeilingOutcome = runDeclarationContextReport(
			request(
				selected,
				{},
				{
					maxResultBytes: DECLARATION_CONTEXT_REPORT_SAFETY_CEILINGS.maxResultBytes + 1
				}
			),
			{ repositoryRoot: selected.root }
		);
		expect(resultCeilingOutcome).toMatchObject({
			code: 'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING',
			outcome: 'unavailable',
			stage: 'REQUEST',
			state: 'resource-refused'
		});

		const inheritedCeilingOutcome = runDeclarationContextReport(
			request(
				selected,
				{},
				{
					semantic: {
						...base.budgets.semantic,
						maxProjects: DECLARATION_CONTEXT_REPORT_SAFETY_CEILINGS.semantic.maxProjects + 1
					}
				}
			),
			{ repositoryRoot: selected.root }
		);
		expect(inheritedCeilingOutcome).toMatchObject({
			code: 'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING',
			outcome: 'unavailable',
			stage: 'REQUEST',
			state: 'resource-refused'
		});

		const importerOutcome = runDeclarationContextReport(
			request(selected, {
				importer: { ...base.importer, specifierNodeStart: -1 }
			}),
			{ repositoryRoot: selected.root }
		);
		expect(importerOutcome).toMatchObject({
			code: 'REQUEST_IMPORTER_INVALID',
			outcome: 'unavailable',
			stage: 'REQUEST',
			state: 'incompatible'
		});

		const inconsistentOutcome = runDeclarationContextReport(
			request(
				selected,
				{},
				{
					declarationContext: {
						...base.budgets.declarationContext,
						maxInputRecords: base.budgets.declarationContext.maxCompilerInputAttempts - 1
					}
				}
			),
			{ repositoryRoot: selected.root }
		);
		expect(inconsistentOutcome).toMatchObject({
			code: 'REQUEST_BUDGET_INVALID',
			outcome: 'unavailable',
			stage: 'REQUEST',
			state: 'incompatible'
		});
	});

	it(
		'reports selected-subject staleness without promoting compiler or target currentness',
		{ timeout: 120_000 },
		() => {
			const selected = fixture();
			const importerPath = join(selected.root, selected.importerPath);
			const original = readFileSync(importerPath, 'utf8');
			let mutated = false;
			const outcome = runDeclarationContextReport(request(selected), {
				onProgress: (event) => {
					if (
						!mutated &&
						event.kind === 'REPORT_STAGE' &&
						event.phase === 'CURRENTNESS' &&
						event.state === 'STARTED'
					) {
						mutated = true;
						writeFileSync(importerPath, `${original}\n`, 'utf8');
					}
				},
				repositoryRoot: selected.root
			});
			expect(outcome.outcome).toBe('partial');
			if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
			expect(outcome.result.currentness).toMatchObject({
				compilerCapture: 'NOT_ASSESSED',
				contextOnlyTarget: 'NOT_ASSESSED',
				state: 'STALE'
			});
			expect(outcome.result.currentness.changedPaths).toContain(selected.importerPath);
		}
	);

	it(
		'contains hostile telemetry observers and maps fixed-root failure to exit 4',
		{ timeout: 120_000 },
		() => {
			const selected = fixture();
			const withThrowingObserver = runDeclarationContextReport(request(selected), {
				onProgress: () => {
					throw new Error('observer failure');
				},
				repositoryRoot: selected.root
			});
			expect(withThrowingObserver.outcome).toBe('partial');

			const failed = runDeclarationContextReport(request(selected), {
				repositoryRoot: join(selected.root, 'missing-root')
			});
			expect(failed).toMatchObject({
				outcome: 'unavailable',
				stage: 'PREDECESSOR_PIPELINE',
				state: 'failed'
			});
			expect(declarationContextReportExitCode(failed)).toBe(4);
		}
	);
});
