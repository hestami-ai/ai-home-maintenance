import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
	MODULE_RESOLUTION_TRACE_AUTHORITY,
	MODULE_RESOLUTION_TRACE_AUTHORITY_TRANSFER,
	MODULE_RESOLUTION_TRACE_CAPABILITY,
	MODULE_RESOLUTION_TRACE_CAPABILITY_STATUS,
	MODULE_RESOLUTION_TRACE_CURRENTNESS,
	MODULE_RESOLUTION_TRACE_FRESHNESS,
	MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_007_CONFORMANCE,
	MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_008_CONFORMANCE,
	MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_011_CONFORMANCE,
	MODULE_RESOLUTION_TRACE_GATE_EFFECT,
	MODULE_RESOLUTION_TRACE_NONCLAIMS,
	type ModuleResolutionTraceBuildInputs,
	type ModuleResolutionTraceDiagnosticCode,
	type ModuleResolutionTraceSnapshot
} from '../contracts/module-resolution-trace.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import { buildModuleResolutionTrace } from './build-module-resolution-trace.js';
import {
	MODULE_RESOLUTION_FIXTURE_IMPORTER_PATH,
	MODULE_RESOLUTION_FIXTURE_PACKAGE_NAME,
	MODULE_RESOLUTION_FIXTURE_TARGET_PATH,
	createModuleResolutionTraceFixture,
	moduleResolutionTraceInputs,
	type ModuleResolutionTraceFixture
} from './module-resolution-trace-fixture.test-support.js';
import {
	moduleResolutionAttemptId,
	moduleResolutionCandidateId,
	moduleResolutionRelationId,
	moduleResolutionTargetInputBinding,
	moduleResolutionTraceContentDigest,
	moduleResolutionTraceId,
	moduleResolutionTraceInputDigest
} from './module-resolution-trace-canonical.js';
import { validateModuleResolutionTrace } from './validate-module-resolution-trace.js';

function build(inputs: ModuleResolutionTraceBuildInputs): ModuleResolutionTraceSnapshot {
	const outcome = buildModuleResolutionTrace(inputs);
	expect(outcome.outcome).toBe('partial');
	if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
	expect(validateModuleResolutionTrace(outcome.trace, inputs)).toEqual({
		issues: [],
		state: 'VALID'
	});
	return outcome.trace;
}

function expectUnavailable(inputs: unknown, code: ModuleResolutionTraceDiagnosticCode): void {
	const outcome = buildModuleResolutionTrace(inputs as ModuleResolutionTraceBuildInputs);
	expect(outcome.outcome).toBe('unavailable');
	if (outcome.outcome === 'unavailable') expect(outcome.diagnostics[0]?.code).toBe(code);
}

function expectDeeplyFrozen(value: unknown, seen = new WeakSet<object>()): void {
	if (value === null || typeof value !== 'object' || seen.has(value)) return;
	seen.add(value);
	expect(Object.isFrozen(value)).toBe(true);
	for (const child of Object.values(value)) expectDeeplyFrozen(child, seen);
}

describe('buildModuleResolutionTrace', { timeout: 30_000 }, () => {
	let fixture: ModuleResolutionTraceFixture;
	let inputs: ModuleResolutionTraceBuildInputs;
	let trace: ModuleResolutionTraceSnapshot;

	beforeAll(() => {
		fixture = createModuleResolutionTraceFixture();
		inputs = moduleResolutionTraceInputs(fixture);
		trace = build(inputs);
	});

	afterAll(() => {
		fixture.cleanup();
	});

	it('replays the selected TypeScript resolver occurrence only over its verified project capture', () => {
		expect(trace).toMatchObject({
			authorityTransfer: MODULE_RESOLUTION_TRACE_AUTHORITY_TRANSFER,
			capability: MODULE_RESOLUTION_TRACE_CAPABILITY,
			capabilityStatus: MODULE_RESOLUTION_TRACE_CAPABILITY_STATUS,
			currentness: MODULE_RESOLUTION_TRACE_CURRENTNESS,
			freshness: MODULE_RESOLUTION_TRACE_FRESHNESS,
			fullJanCsaa007Conformance: MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_007_CONFORMANCE,
			fullJanCsaa008Conformance: MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_008_CONFORMANCE,
			fullJanCsaa011Conformance: MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_011_CONFORMANCE,
			gateEffect: MODULE_RESOLUTION_TRACE_GATE_EFFECT,
			health: 'PARTIAL',
			resolutionAuthority: MODULE_RESOLUTION_TRACE_AUTHORITY,
			resultCompleteness: 'COMPLETE_FOR_SELECTED_SUPPORTED_EXACT_RESOLVED_REQUEST',
			truncation: { reason: null, state: 'NOT_TRUNCATED' }
		});
		expect(trace.nonclaims).toEqual(MODULE_RESOLUTION_TRACE_NONCLAIMS);
		expect(trace.importerWitness).toMatchObject({
			logicalPath: MODULE_RESOLUTION_FIXTURE_IMPORTER_PATH,
			occurrenceKind: 'IMPORT',
			specifier: MODULE_RESOLUTION_FIXTURE_PACKAGE_NAME,
			typeOnly: false
		});
		expect(trace.targetWitness).toMatchObject({
			artifactClass: 'CONTEXT_ONLY',
			declarationFile: true,
			logicalPath: MODULE_RESOLUTION_FIXTURE_TARGET_PATH,
			originalResolvedLogicalPath: `node_modules/${MODULE_RESOLUTION_FIXTURE_PACKAGE_NAME}/dist/index.d.ts`,
			origin: 'WORKSPACE_BUILD_DECLARATION',
			packageExportTarget: './dist/index.d.ts'
		});
		expect(trace.resolverEnvironment).toMatchObject({
			compilerVersion: '5.9.3',
			customConditions: [],
			impliedNodeFormat: 99,
			impliedNodeFormatName: 'ESNext',
			moduleName: 'NodeNext',
			moduleResolutionName: 'NodeNext',
			packageJsonType: 'module',
			publicConditionMembership: { import: true, node: true, types: true },
			publicConditionOrder: 'NOT_CLAIMED',
			resolutionMode: 99,
			resolutionModeName: 'ESNext'
		});
		expect(trace.captureWitness.state).toBe('VERIFIED_PROJECT_SCOPED_CAPTURE');
	});

	it('records exact ordered staged callbacks, invocation ordinals, and all module FILE_EXISTS candidates', () => {
		expect(trace.attempts).toHaveLength(22);
		expect(trace.attempts.map((attempt) => attempt.ordinal)).toEqual(
			Array.from({ length: 22 }, (_, index) => index)
		);
		expect(
			trace.attempts.filter((attempt) => attempt.stage === 'IMPLIED_NODE_FORMAT')
		).toHaveLength(5);
		expect(trace.attempts.filter((attempt) => attempt.stage === 'MODULE_RESOLUTION')).toHaveLength(
			17
		);
		const repeatedConsumerDirectory = trace.attempts.filter(
			(attempt) =>
				attempt.query.operation === 'DIRECTORY_EXISTS' &&
				attempt.query.logicalPath === 'packages/consumer/src'
		);
		expect(repeatedConsumerDirectory.map((attempt) => attempt.invocationOrdinal)).toEqual([0, 1]);

		const moduleFileExists = trace.attempts.filter(
			(attempt) =>
				attempt.stage === 'MODULE_RESOLUTION' && attempt.query.operation === 'FILE_EXISTS'
		);
		expect(moduleFileExists).toHaveLength(4);
		expect(trace.candidates).toHaveLength(moduleFileExists.length);
		expect(trace.candidates.map((candidate) => candidate.attemptId)).toEqual(
			moduleFileExists.map((attempt) => attempt.id)
		);
		expect(trace.candidates.slice(0, 3).map((candidate) => candidate.exclusionReason)).toEqual([
			'PACKAGE_METADATA_NOT_A_MODULE_TARGET',
			'PACKAGE_METADATA_NOT_A_MODULE_TARGET',
			'PACKAGE_METADATA_NOT_A_MODULE_TARGET'
		]);
		const selected = trace.candidates.filter((candidate) => candidate.disposition === 'SELECTED');
		expect(selected).toHaveLength(1);
		expect(selected[0]).toMatchObject({
			exclusionReason: null,
			logicalPath: trace.targetWitness.originalResolvedLogicalPath,
			observationResult: 'PRESENT',
			purpose: 'MODULE_TARGET_CANDIDATE'
		});
		expect(trace.attempts).toContainEqual(
			expect.objectContaining({
				observation: expect.objectContaining({
					resolvedLogicalPath: MODULE_RESOLUTION_FIXTURE_TARGET_PATH,
					result: 'RESOLVED'
				}),
				purpose: 'REALPATH',
				query: {
					logicalPath: trace.targetWitness.originalResolvedLogicalPath,
					operation: 'REALPATH'
				},
				stage: 'MODULE_RESOLUTION'
			})
		);
	});

	it('reconciles exact accounting and an independent target READ_FILE witness', () => {
		expect(trace.coverage).toEqual({
			astNodes: 14,
			attemptPopulationReconciles: true,
			attemptRecords: 22,
			candidatePopulationReconciles: true,
			candidateRecords: 4,
			chargedTraversalSteps: 40,
			excludedCandidates: 3,
			impliedNodeFormatAttempts: 5,
			inputRecords: 23,
			moduleResolutionAttempts: 17,
			moduleResolutionFileExistsAttempts: 4,
			outputRecords: 27,
			readBytes: 557,
			relationPopulationReconciles: true,
			relationRecords: 1,
			selectedCandidates: 1,
			selectedImporterPrograms: 1,
			selectedImporterSources: 1,
			selectedTargets: 1,
			selectedWorkspacePackages: 1
		});
		expect(trace.targetWitness.targetRead.query).toEqual({
			logicalPath: MODULE_RESOLUTION_FIXTURE_TARGET_PATH,
			operation: 'READ_FILE'
		});
		expect(trace.targetWitness.targetRead.observation).toMatchObject({
			contentBytes: trace.targetWitness.bytes,
			contentSha256: trace.targetWitness.contentSha256,
			operation: 'READ_FILE',
			origin: 'WORKSPACE_BUILD_DECLARATION',
			result: 'PRESENT'
		});
		expect(trace.coverage.inputRecords).toBe(trace.attempts.length + 1);
		expect(trace.coverage.outputRecords).toBe(1 + trace.attempts.length + trace.candidates.length);
		expect(trace.coverage.chargedTraversalSteps).toBe(
			trace.coverage.astNodes + trace.attempts.length + trace.candidates.length
		);
	});

	it('derives every canonical identity and digest deterministically', () => {
		const binding = {
			captureWitness: trace.captureWitness,
			importerWitness: trace.importerWitness,
			resolverEnvironment: trace.resolverEnvironment,
			targetWitness: moduleResolutionTargetInputBinding(trace.targetWitness)
		};
		expect(moduleResolutionTraceInputDigest(inputs, binding)).toBe(trace.inputDigest);
		expect(
			moduleResolutionTraceId({
				conditionalExportResolutionId: trace.conditionalExportResolution.id,
				inputDigest: trace.inputDigest,
				semanticSnapshotId: trace.semanticSnapshotId,
				subjectId: trace.subjectId
			})
		).toBe(trace.id);
		for (const attempt of trace.attempts) {
			const { id: _id, ...record } = attempt;
			expect(moduleResolutionAttemptId(trace.id, record)).toBe(attempt.id);
		}
		for (const candidate of trace.candidates) {
			const { id: _id, ...record } = candidate;
			expect(moduleResolutionCandidateId(trace.id, record)).toBe(candidate.id);
		}
		expect(
			moduleResolutionRelationId({
				importerSourceId: trace.relation.importerSourceId,
				semanticModuleResolutionId: trace.relation.semanticModuleResolutionId,
				specifierNodeId: trace.relation.specifierNodeId,
				targetSourceId: trace.relation.targetSourceId,
				traceId: trace.id
			})
		).toBe(trace.relation.id);
		expect(moduleResolutionTraceContentDigest(trace)).toBe(trace.contentDigest);
	});

	it('is deterministic, deeply frozen, and does not retain mutable request aliases', () => {
		const again = build(inputs);
		expect(canonicalSemanticJson(again)).toBe(canonicalSemanticJson(trace));
		expectDeeplyFrozen(again);

		const mutableBudgets = { ...inputs.request.budgets };
		const aliased = {
			...inputs,
			request: { ...inputs.request, budgets: mutableBudgets }
		};
		const isolated = build(aliased);
		mutableBudgets.maxAttempts = 1;
		expect(isolated.budgets.maxAttempts).toBe(inputs.request.budgets.maxAttempts);
	});

	it('emits paired, monotonic progress and contains observer failures', async () => {
		const events: Array<{ phase: string; sequence: number; state: string }> = [];
		const outcome = buildModuleResolutionTrace(inputs, {
			onProgress(event) {
				events.push({ phase: event.phase, sequence: event.sequence, state: event.state });
				throw new Error('observer failure must be contained');
			}
		});
		expect(outcome.outcome).toBe('partial');
		await Promise.resolve();
		expect(events.map((event) => event.sequence)).toEqual(
			Array.from({ length: events.length }, (_, index) => index)
		);
		expect(
			events.every((event, index) => event.state === (index % 2 === 0 ? 'STARTED' : 'COMPLETED'))
		).toBe(true);
		expect(events.at(-1)).toEqual({
			phase: 'TRACE_VALIDATE',
			sequence: events.length - 1,
			state: 'COMPLETED'
		});
	});

	it('fails closed for unsupported selection and exact one-below budgets', () => {
		expectUnavailable(
			{ ...inputs, request: { ...inputs.request, specifier: './relative.js' } },
			'UNSUPPORTED_REQUEST'
		);
		expectUnavailable(
			moduleResolutionTraceInputs(fixture, {}, { maxAttempts: trace.coverage.attemptRecords - 1 }),
			'BUDGET_EXCEEDED'
		);
		expectUnavailable(
			moduleResolutionTraceInputs(
				fixture,
				{},
				{ maxCandidates: trace.coverage.candidateRecords - 1 }
			),
			'BUDGET_EXCEEDED'
		);
		expectUnavailable(
			moduleResolutionTraceInputs(fixture, {}, { maxAstNodes: trace.coverage.astNodes - 1 }),
			'BUDGET_EXCEEDED'
		);
		expectUnavailable(
			moduleResolutionTraceInputs(fixture, {}, { maxReadBytes: trace.coverage.readBytes - 1 }),
			'BUDGET_EXCEEDED'
		);
		expectUnavailable(
			moduleResolutionTraceInputs(
				fixture,
				{},
				{
					maxTraversalSteps: trace.coverage.chargedTraversalSteps - 1
				}
			),
			'BUDGET_EXCEEDED'
		);
		expectUnavailable(
			moduleResolutionTraceInputs(
				fixture,
				{},
				{ maxOutputRecords: trace.coverage.outputRecords - 1 }
			),
			'BUDGET_EXCEEDED'
		);
	});
});
