import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
	MODULE_RESOLUTION_TRACE_NONCLAIMS,
	MODULE_RESOLUTION_TRACE_CURRENTNESS,
	MODULE_RESOLUTION_TRACE_FRESHNESS
} from '../contracts/module-resolution-trace.js';
import {
	MODULE_RESOLUTION_TRACE_REPORT_NONCLAIMS,
	MODULE_RESOLUTION_TRACE_REPORT_OPERATION_VERSION,
	MODULE_RESOLUTION_TRACE_REPORT_PREDECESSOR_NONCLAIMS,
	MODULE_RESOLUTION_TRACE_REPORT_REQUEST_SCHEMA_VERSION,
	MODULE_RESOLUTION_TRACE_REPORT_SELECTION,
	type ModuleResolutionTraceReportRequest
} from '../contracts/module-resolution-trace-report.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import {
	MODULE_RESOLUTION_FIXTURE_IMPORTER_PATH,
	MODULE_RESOLUTION_FIXTURE_PACKAGE_NAME,
	createModuleResolutionTraceFixture,
	type ModuleResolutionTraceFixture
} from '../resolution/module-resolution-trace-fixture.test-support.js';
import {
	MODULE_RESOLUTION_TRACE_REPORT_PROGRESS_NONCLAIMS,
	MODULE_RESOLUTION_TRACE_REPORT_PROGRESS_SCHEMA_VERSION,
	moduleResolutionTraceReportExitCode,
	runModuleResolutionTraceReport,
	type ModuleResolutionTraceReportProgressEvent
} from './run-module-resolution-trace-report.js';

const fixtures: ModuleResolutionTraceFixture[] = [];

function fixture(): ModuleResolutionTraceFixture {
	const created = createModuleResolutionTraceFixture();
	fixtures.push(created);
	return created;
}

function request(
	selected: ModuleResolutionTraceFixture,
	overrides: Partial<ModuleResolutionTraceReportRequest> = {}
): ModuleResolutionTraceReportRequest {
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
		budgets: {
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
			maxResultBytes: 64 * 1024 * 1024,
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
			}
		},
		importer: {
			logicalPath: selected.importerPath,
			projectConfigPath: importerProject.configPath,
			specifierNodeStart: specifierNode.start
		},
		operationVersion: MODULE_RESOLUTION_TRACE_REPORT_OPERATION_VERSION,
		packageName: MODULE_RESOLUTION_FIXTURE_PACKAGE_NAME,
		schemaVersion: MODULE_RESOLUTION_TRACE_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: ['tsconfig.json'],
		...overrides
	};
}

afterEach(() => {
	for (const selected of fixtures.splice(0)) selected.cleanup();
});

describe('runModuleResolutionTraceReport', () => {
	it(
		'returns a deterministic exact trace with scoped predecessor evidence and ordered progress',
		{ timeout: 120_000 },
		() => {
			const selected = fixture();
			const progress: ModuleResolutionTraceReportProgressEvent[] = [];
			const first = runModuleResolutionTraceReport(request(selected), {
				onProgress: (event) => progress.push(event),
				repositoryRoot: selected.root
			});
			expect(first.outcome).toBe('partial');
			expect(moduleResolutionTraceReportExitCode(first)).toBe(3);
			if (first.outcome !== 'partial') throw new Error(JSON.stringify(first));

			expect(first.result.capability).toMatchObject({
				id: 'JAN-CSAA-CAP-011',
				status: 'PARTIAL'
			});
			expect(first.result.selection).toBe(MODULE_RESOLUTION_TRACE_REPORT_SELECTION);
			expect(first.result.importer).toMatchObject({
				logicalPath: MODULE_RESOLUTION_FIXTURE_IMPORTER_PATH,
				projectConfigPath: 'packages/consumer/tsconfig.json',
				specifier: MODULE_RESOLUTION_FIXTURE_PACKAGE_NAME
			});
			expect(first.result.resolvedTarget).toMatchObject({
				extension: '.d.ts',
				logicalPath: 'packages/module-target/dist/index.d.ts',
				packageExportTarget: './dist/index.d.ts'
			});
			expect(first.result.evidence.conditionalExportResolution.decision).toMatchObject({
				state: 'SELECTED_TARGET',
				target: './dist/index.d.ts'
			});
			const trace = first.result.evidence.moduleResolutionTrace;
			expect(trace.importerWitness.logicalPath).toBe(MODULE_RESOLUTION_FIXTURE_IMPORTER_PATH);
			expect(trace.targetWitness.logicalPath).toBe(first.result.resolvedTarget.logicalPath);
			expect(trace.attempts.length).toBeGreaterThan(0);
			expect(trace.candidates.length).toBeGreaterThan(0);
			expect(trace.currentness).toBe(MODULE_RESOLUTION_TRACE_CURRENTNESS);
			expect(trace.freshness).toBe(MODULE_RESOLUTION_TRACE_FRESHNESS);
			expect(first.result.currentness).toMatchObject({
				compilerCapture: 'NOT_ASSESSED',
				contextOnlyTarget: 'NOT_ASSESSED',
				scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
				state: 'CURRENT_FOR_CAPTURED_SUBJECT'
			});
			expect(first.result.facadeNonclaims).toBe(MODULE_RESOLUTION_TRACE_REPORT_NONCLAIMS);
			expect(
				MODULE_RESOLUTION_TRACE_NONCLAIMS.filter(
					(value) => value !== 'CURRENTNESS_OR_FRESHNESS'
				).every((value) => first.result.facadeNonclaims.includes(value))
			).toBe(true);
			expect(first.result.predecessorNonclaims).toBe(
				MODULE_RESOLUTION_TRACE_REPORT_PREDECESSOR_NONCLAIMS
			);
			expect(first.result.predecessorNonclaims.moduleResolutionTrace).toBe(
				MODULE_RESOLUTION_TRACE_NONCLAIMS
			);
			expect(first.result.facadeNonclaims).not.toContain('CURRENTNESS_OR_FRESHNESS');
			expect(first.result.facadeNonclaims).toContain('TYPE_ONLY_IMPORT_OCCURRENCE');
			expect(first.result.predecessorNonclaims.moduleResolutionTrace).toContain(
				'CURRENTNESS_OR_FRESHNESS'
			);
			expect(first.result.facadeNonclaims).not.toContain(
				'JAN_CSAA_CAP_011_PATH_ALIAS_OR_MODULE_RESOLUTION'
			);

			const reportStages = progress.filter((event) => event.kind === 'REPORT_STAGE');
			expect(reportStages.map(({ phase, state }) => ({ phase, state }))).toEqual(
				[
					'REQUEST_BIND',
					'SUBJECT_PROJECT_PATH_BIND',
					'SUBJECT_CAPTURE',
					'SEMANTIC_SNAPSHOT',
					'PROJECT_CONTEXT',
					'IMPORTER_SELECTOR',
					'CONDITIONAL_EXPORT',
					'MODULE_RESOLUTION_TRACE',
					'CURRENTNESS',
					'RESULT'
				].flatMap((phase) => [
					{ phase, state: 'STARTED' },
					{ phase, state: 'COMPLETED' }
				])
			);
			expect(progress.map((event) => event.sequence)).toEqual(
				progress.map((_, index) => index + 1)
			);
			expect(
				progress.every(
					(event) =>
						event.schemaVersion === MODULE_RESOLUTION_TRACE_REPORT_PROGRESS_SCHEMA_VERSION &&
						event.nonclaims === MODULE_RESOLUTION_TRACE_REPORT_PROGRESS_NONCLAIMS
				)
			).toBe(true);

			const second = runModuleResolutionTraceReport(request(selected), {
				repositoryRoot: selected.root
			});
			expect(canonicalSemanticJson(second)).toBe(canonicalSemanticJson(first));
			expect(canonicalSemanticJson(first)).not.toContain(selected.root);
		}
	);

	it(
		'refuses a type-only import outside the fixed value-import selection',
		{ timeout: 120_000 },
		() => {
			const selected = fixture();
			const base = request(selected);
			const typeOnlySource = `import type { target } from '${MODULE_RESOLUTION_FIXTURE_PACKAGE_NAME}';\nexport type ImportedTarget = typeof target;\n`;
			writeFileSync(
				join(selected.root, ...MODULE_RESOLUTION_FIXTURE_IMPORTER_PATH.split('/')),
				typeOnlySource,
				'utf8'
			);
			const outcome = runModuleResolutionTraceReport(
				request(selected, {
					importer: {
						...base.importer,
						specifierNodeStart: typeOnlySource.indexOf(
							`'${MODULE_RESOLUTION_FIXTURE_PACKAGE_NAME}'`
						)
					}
				}),
				{ repositoryRoot: selected.root }
			);
			expect(outcome).toMatchObject({
				code: 'IMPORT_OCCURRENCE_NOT_EXACT',
				stage: 'MODULE_RESOLUTION_TRACE',
				state: 'incompatible'
			});
		}
	);

	it(
		'fails closed when the exact project, source, or literal occurrence does not bind',
		{
			timeout: 120_000
		},
		() => {
			const selected = fixture();
			for (const [expectedCode, importer] of [
				[
					'IMPORTER_PROJECT_NOT_EXACT',
					{ ...request(selected).importer, projectConfigPath: 'packages/missing/tsconfig.json' }
				],
				[
					'IMPORTER_SOURCE_NOT_EXACT',
					{ ...request(selected).importer, logicalPath: 'packages/consumer/src/missing.ts' }
				],
				['IMPORT_OCCURRENCE_NOT_EXACT', { ...request(selected).importer, specifierNodeStart: 0 }]
			] as const) {
				const outcome = runModuleResolutionTraceReport(request(selected, { importer }), {
					repositoryRoot: selected.root
				});
				expect(outcome).toMatchObject({
					code: expectedCode,
					outcome: 'unavailable',
					stage: 'MODULE_RESOLUTION_TRACE',
					state: 'incompatible'
				});
			}
		}
	);

	it(
		'admits only the complete result and returns a small resource refusal otherwise',
		{
			timeout: 120_000
		},
		() => {
			const selected = fixture();
			const base = request(selected);
			const outcome = runModuleResolutionTraceReport(
				request(selected, { budgets: { ...base.budgets, maxResultBytes: 1 } }),
				{ repositoryRoot: selected.root }
			);
			expect(outcome).toMatchObject({
				code: 'RESULT_BUDGET_EXCEEDED',
				outcome: 'unavailable',
				stage: 'RESULT',
				state: 'resource-refused'
			});
			expect(canonicalSemanticJson(outcome).length).toBeLessThan(20_000);
			expect(moduleResolutionTraceReportExitCode(outcome)).toBe(3);
		}
	);

	it(
		'reports only FrozenSubject currentness and leaves capture and context-only target unassessed',
		{
			timeout: 120_000
		},
		() => {
			const selected = fixture();
			let mutated = false;
			const outcome = runModuleResolutionTraceReport(request(selected), {
				onProgress(event) {
					if (
						event.kind === 'REPORT_STAGE' &&
						event.phase === 'CURRENTNESS' &&
						event.state === 'STARTED'
					) {
						mutated = true;
						writeFileSync(
							join(selected.root, ...MODULE_RESOLUTION_FIXTURE_IMPORTER_PATH.split('/')),
							`import { target } from '${MODULE_RESOLUTION_FIXTURE_PACKAGE_NAME}';\nexport const value = target + 1;\n`,
							'utf8'
						);
					}
				},
				repositoryRoot: selected.root
			});
			expect(mutated).toBe(true);
			expect(outcome.outcome).toBe('partial');
			if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
			expect(outcome.result.currentness).toMatchObject({
				compilerCapture: 'NOT_ASSESSED',
				contextOnlyTarget: 'NOT_ASSESSED',
				state: 'STALE'
			});
			expect(outcome.result.currentness.changedPaths).toContain(
				MODULE_RESOLUTION_FIXTURE_IMPORTER_PATH
			);
			expect(outcome.result.evidence.moduleResolutionTrace.currentness).toBe('NOT_CLAIMED');
			expect(outcome.result.evidence.conditionalExportResolution.currentness).toBe('NOT_CLAIMED');
		}
	);

	it(
		'charges a linear exact-selector scan for adversarial duplicate imports',
		{ timeout: 120_000 },
		() => {
			const selected = fixture();
			const base = request(selected);
			const duplicateImports = Array.from(
				{ length: 256 },
				() => `import '${MODULE_RESOLUTION_FIXTURE_PACKAGE_NAME}';`
			).join('\n');
			writeFileSync(
				join(selected.root, ...MODULE_RESOLUTION_FIXTURE_IMPORTER_PATH.split('/')),
				`import { target } from '${MODULE_RESOLUTION_FIXTURE_PACKAGE_NAME}';\n${duplicateImports}\nexport const value = target;\n`,
				'utf8'
			);
			const outcome = runModuleResolutionTraceReport(
				request(selected, {
					budgets: {
						...base.budgets,
						moduleResolutionTrace: {
							...base.budgets.moduleResolutionTrace,
							maxTraversalSteps: 200
						}
					}
				}),
				{ repositoryRoot: selected.root }
			);
			expect(outcome).toMatchObject({
				code: 'IMPORTER_SELECTOR_BUDGET_EXCEEDED',
				outcome: 'unavailable',
				stage: 'MODULE_RESOLUTION_TRACE',
				state: 'resource-refused'
			});
			expect(moduleResolutionTraceReportExitCode(outcome)).toBe(3);
		}
	);

	it(
		'classifies literal and source-byte budget exhaustion as resource refusal',
		{ timeout: 120_000 },
		() => {
			const selected = fixture();
			const base = request(selected);
			const literalBudget = runModuleResolutionTraceReport(
				request(selected, {
					budgets: {
						...base.budgets,
						semantic: { ...base.budgets.semantic, maxLiteralCharacters: 1 }
					}
				}),
				{ repositoryRoot: selected.root }
			);
			expect(literalBudget).toMatchObject({
				code: 'REQUEST_PACKAGE_BUDGET_EXCEEDED',
				stage: 'REQUEST',
				state: 'resource-refused'
			});
			expect(moduleResolutionTraceReportExitCode(literalBudget)).toBe(3);

			const contextFileBudget = runModuleResolutionTraceReport(
				request(selected, {
					budgets: {
						...base.budgets,
						semantic: { ...base.budgets.semantic, maxContextFileBytes: 1 }
					}
				}),
				{ repositoryRoot: selected.root }
			);
			expect(contextFileBudget).toMatchObject({
				code: 'SEMANTIC_SNAPSHOT_UNAVAILABLE',
				stage: 'SEMANTIC_SNAPSHOT',
				state: 'resource-refused'
			});
			expect(moduleResolutionTraceReportExitCode(contextFileBudget)).toBe(3);
		}
	);

	it('rejects hostile and over-ceiling request shapes without invoking accessors', () => {
		let invoked = 0;
		const hostile = Object.create(null, {
			budgets: {
				enumerable: true,
				get() {
					invoked += 1;
					return {};
				}
			},
			importer: { enumerable: true, value: {} },
			operationVersion: {
				enumerable: true,
				value: MODULE_RESOLUTION_TRACE_REPORT_OPERATION_VERSION
			},
			packageName: { enumerable: true, value: MODULE_RESOLUTION_FIXTURE_PACKAGE_NAME },
			schemaVersion: {
				enumerable: true,
				value: MODULE_RESOLUTION_TRACE_REPORT_REQUEST_SCHEMA_VERSION
			},
			subjectProjectConfigPaths: { enumerable: true, value: ['tsconfig.json'] }
		});
		const incompatible = runModuleResolutionTraceReport(hostile, {
			repositoryRoot: process.cwd()
		});
		expect(incompatible).toMatchObject({ code: 'REQUEST_SHAPE_INVALID', state: 'incompatible' });
		expect(moduleResolutionTraceReportExitCode(incompatible)).toBe(2);
		expect(invoked).toBe(0);

		const selected = fixture();
		const base = request(selected);
		const over = runModuleResolutionTraceReport(
			request(selected, {
				budgets: {
					...base.budgets,
					maxResultBytes: 128 * 1024 * 1024 + 1
				}
			}),
			{ repositoryRoot: selected.root }
		);
		expect(over).toMatchObject({
			code: 'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING',
			state: 'resource-refused'
		});
		expect(moduleResolutionTraceReportExitCode(over)).toBe(3);

		const failed = runModuleResolutionTraceReport(base, {
			repositoryRoot: join(selected.root, 'missing-root')
		});
		expect(failed).toMatchObject({ code: 'REPOSITORY_ROOT_UNAVAILABLE', state: 'failed' });
		expect(moduleResolutionTraceReportExitCode(failed)).toBe(4);
	});
});
