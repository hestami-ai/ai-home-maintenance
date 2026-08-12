import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
	type ArrowCommandCensusArtifactSetBinding,
	type ArrowCommandCensusBudgets
} from '../../contracts/arrow-command-census.js';
import type { CapturedArtifactRecord, FrozenSubject } from '../../contracts/subject.js';
import { SUBJECT_POLICY_VERSION, SUBJECT_REQUEST_SCHEMA_VERSION } from '../../contracts/subject.js';
import { sha256 } from '../../inventory/canonical.js';
import { classifyArtifact } from '../../subject/artifacts.js';
import { attachFrozenSubjectBytes } from '../../subject/frozen-store.js';
import { canonicalPathKey } from '../../subject/paths.js';
import { resolveSubject } from '../../subject/resolve-subject.js';
import { buildArrowCommandCensusArtifactSet } from './artifact-set.js';
import {
	type ArrowCommandCensusProgressEvent,
	observeArrowCommandCensus
} from './observe-arrow-command-census.js';
import { validateArrowCommandCensusObservation } from './validate-arrow-command-census.js';

type ChildMode =
	| 'CHILD_ERROR'
	| 'INVALID_FRAME'
	| 'INVALID_JSON'
	| 'INVALID_SHAPE'
	| 'INVALID_UTF8'
	| 'NONZERO_EXIT'
	| 'STDERR_BUDGET'
	| 'STDERR_SUCCESS'
	| 'STDOUT_BUDGET'
	| 'TIMEOUT';

const childProcessControl = vi.hoisted(() => ({ mode: null as ChildMode | null }));

vi.mock('node:child_process', async (importOriginal) => {
	const actual = await importOriginal<typeof import('node:child_process')>();
	const { EventEmitter } = await import('node:events');
	return {
		...actual,
		spawn: (...args: Parameters<typeof actual.spawn>) => {
			const mode = childProcessControl.mode;
			if (mode === null) return actual.spawn(...args);
			const child = new EventEmitter() as ReturnType<typeof actual.spawn>;
			const stdout = new EventEmitter();
			const stderr = new EventEmitter();
			Object.assign(child, {
				kill: () => {
					queueMicrotask(() => child.emit('close', null));
					return true;
				},
				stderr,
				stdin: {
					end: () => {
						queueMicrotask(() => {
							switch (mode) {
								case 'CHILD_ERROR':
									child.emit('error', new Error('synthetic child failure'));
									break;
								case 'INVALID_FRAME':
									stdout.emit('data', Buffer.from('{}\n\n'));
									child.emit('close', 0);
									break;
								case 'INVALID_JSON':
									stdout.emit('data', Buffer.from('{\n'));
									child.emit('close', 0);
									break;
								case 'INVALID_SHAPE':
									stdout.emit('data', Buffer.from('{}\n'));
									child.emit('close', 0);
									break;
								case 'INVALID_UTF8':
									stdout.emit('data', Buffer.from([0xff, 0x0a]));
									child.emit('close', 0);
									break;
								case 'NONZERO_EXIT':
									stderr.emit('data', Buffer.from('synthetic failure'));
									child.emit('close', 7);
									break;
								case 'STDERR_BUDGET':
									stderr.emit('data', Buffer.from('xx'));
									break;
								case 'STDERR_SUCCESS':
									stderr.emit('data', Buffer.from('unexpected'));
									child.emit('close', 0);
									break;
								case 'STDOUT_BUDGET':
									stdout.emit('data', Buffer.from('xx'));
									break;
								case 'TIMEOUT':
									break;
							}
						});
					}
				},
				stdout
			});
			return child;
		}
	};
});

const ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const SYNTHETIC_SUBJECT_ID = 'subject:arrow-command-census-observer-fixture';
const encoder = new TextEncoder();

const SYNTHETIC_SOURCES = new Map<string, string>([
	[
		'verif/arrow-command-census.ts',
		`export function declaredArrows() {
	return [{ machine: 'Alpha', from: 'A0', to: 'A1', site: 'execution.ts:1' }];
}
export function birthStates() { return new Map([['Alpha', new Set(['A0'])]]); }
export function occupiable() { return new Map([['Alpha', new Set(['A0', 'A1'])]]); }
export function deadCovered() { return { dead: [], unanalysed: [] }; }
export function census() { return { uncovered: [], orphans: [], total: 1 }; }
`
	],
	[
		'verif/arrow-command-census.baseline.json',
		'{"dead":[],"orphans":[],"total":1,"unanalysed":[],"uncovered":[]}\n'
	],
	['verif/arrow-census-coverage.test.ts', 'export const retainedCoverage = true;\n'],
	['verif/arrow-command-census.test.ts', 'export const retainedOracle = true;\n'],
	[
		'packages/rph-domain/package.json',
		'{"exports":{".":"./src/index.ts"},"name":"@janumipwb/rph-domain","type":"module"}\n'
	],
	[
		'packages/rph-contracts/package.json',
		'{"exports":{".":"./src/index.ts"},"name":"@janumipwb/rph-contracts","type":"module"}\n'
	],
	['packages/rph-domain/src/index.ts', 'export const domain = true;\n'],
	['packages/rph-domain/src/machine-exclusions.ts', 'export const excluded = false;\n'],
	['packages/rph-domain/src/pwu-lifecycle-command-spec.ts', 'export const pwu = {};\n'],
	['packages/rph-domain/src/step-command-spec.ts', 'export const step = {};\n'],
	[
		'packages/rph-domain/src/transitions.data.ts',
		'// GENERATED FILE — do not edit by hand.\nexport const STATE_MACHINES = {};\n'
	],
	['packages/rph-contracts/src/index.ts', 'export const contracts = true;\n'],
	['packages/rph-application/src/handlers/execution.ts', 'export const handler = true;\n']
]);

function syntheticArtifact(path: string, source: string): CapturedArtifactRecord {
	const bytes = encoder.encode(source);
	const classification = classifyArtifact(path, source);
	return {
		bytes: bytes.byteLength,
		canonicalPathKey: canonicalPathKey(path),
		disposition: classification.disposition,
		path,
		primaryClass: classification.primaryClass,
		reason: classification.reason,
		roles: classification.roles,
		sha256: sha256(bytes)
	};
}

function syntheticSubject(): FrozenSubject {
	const artifacts = [...SYNTHETIC_SOURCES]
		.map(([path, source]) => syntheticArtifact(path, source))
		.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
	const subject = {
		artifacts,
		descriptor: { subjectId: SYNTHETIC_SUBJECT_ID },
		diagnostics: [],
		excludedArtifacts: [],
		generatedContexts: [],
		population: {
			analyzed: artifacts.filter((artifact) => artifact.disposition === 'ANALYZED').length,
			discovered: artifacts.length,
			excluded: 0,
			failed: 0,
			included: artifacts.length,
			inventoryOnly: artifacts.filter((artifact) => artifact.disposition === 'INVENTORY_ONLY')
				.length,
			reconciles: true
		},
		projects: [],
		request: {},
		workspaces: []
	} as unknown as FrozenSubject;
	attachFrozenSubjectBytes(
		subject,
		new Map([...SYNTHETIC_SOURCES].map(([path, source]) => [path, encoder.encode(source)]))
	);
	return subject;
}

const observerBudgets: ArrowCommandCensusBudgets = {
	maxArtifacts: 1_000,
	maxBirthStates: 10_000,
	maxDeclaredArrowOccurrences: 10_000,
	maxDeclaredSites: 10_000,
	maxDiagnostics: 100,
	maxExecutorDurationMs: 120_000,
	maxExternalModuleBytes: 64 * 1024 * 1024,
	maxExternalModuleFiles: 5_000,
	maxMachines: 1_000,
	maxMapStates: 100_000,
	maxMaterializedBytes: 64 * 1024 * 1024,
	maxOutputStringCharacters: 10_000_000,
	maxRawArrayEntries: 100_000,
	maxRawJsonDepth: 20,
	maxStderrBytes: 1024 * 1024,
	maxStdoutBytes: 64 * 1024 * 1024
};

afterEach(() => {
	childProcessControl.mode = null;
});

function syntheticBinding() {
	const subject = syntheticSubject();
	const totalBytes = subject.artifacts.reduce((sum, artifact) => sum + artifact.bytes, 0);
	const outcome = buildArrowCommandCensusArtifactSet(
		{
			budgets: {
				maxArtifacts: subject.artifacts.length + 1,
				maxDiagnostics: 100,
				maxTotalBytes: totalBytes + 1
			},
			operationVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION,
			schemaVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
			subjectId: subject.descriptor.subjectId
		},
		{ subject }
	);
	if (outcome.outcome !== 'complete') throw new Error(JSON.stringify(outcome));
	const request = {
		artifactSetId: outcome.artifactSet.id,
		budgets: observerBudgets,
		operationVersion: ARROW_COMMAND_CENSUS_OPERATION_VERSION,
		schemaVersion: ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
		subjectId: subject.descriptor.subjectId
	};
	return { artifactSet: outcome.artifactSet, request, subject };
}

describe('observeArrowCommandCensus request boundary', () => {
	it('fails closed on malformed requests before touching hostile dependencies', async () => {
		let touched = false;
		const dependencies = new Proxy(
			{},
			{
				get() {
					touched = true;
					throw new Error('must not run');
				}
			}
		);
		const outcome = await observeArrowCommandCensus(
			{ extra: true } as never,
			dependencies as never
		);
		expect(outcome).toMatchObject({
			diagnostics: [{ code: 'REQUEST_INVALID', phase: 'REQUEST', severity: 'ERROR' }],
			outcome: 'unavailable'
		});
		expect(touched).toBe(false);
	});

	it('reports request failure and skipped cleanup without allowing a progress sink to affect outcome', async () => {
		const events: ArrowCommandCensusProgressEvent[] = [];
		const outcome = await observeArrowCommandCensus({ extra: true } as never, {} as never, {
			onProgress(event) {
				events.push(event);
				throw new Error('telemetry must be observational');
			}
		});
		expect(outcome).toMatchObject({
			diagnostics: [{ code: 'REQUEST_INVALID', phase: 'REQUEST', severity: 'ERROR' }],
			outcome: 'unavailable'
		});
		expect(events.map((event) => [event.phase, event.state])).toEqual([
			['REQUEST_AND_ARTIFACT_BIND', 'STARTED'],
			['REQUEST_AND_ARTIFACT_BIND', 'FAILED'],
			['CAPSULE_CLEANUP', 'SKIPPED']
		]);
		expect(events[1]?.details).toEqual({ code: 'REQUEST_INVALID' });
		expect(events[2]?.details).toEqual({ attempted: false, reason: 'CAPSULE_NOT_CREATED' });
		expect(events.every((event, index) => event.sequence === index)).toBe(true);
	});

	it('measures phase durations monotonically even when the wall clock jumps', async () => {
		const wall = vi
			.spyOn(Date, 'now')
			.mockReturnValueOnce(1_000)
			.mockReturnValueOnce(1_000_000_000_000)
			.mockReturnValueOnce(0);
		const events: ArrowCommandCensusProgressEvent[] = [];
		try {
			await observeArrowCommandCensus({ extra: true } as never, {} as never, {
				onProgress: (event) => events.push(event)
			});
		} finally {
			wall.mockRestore();
		}
		expect(events).toHaveLength(3);
		expect(events.map((event) => event.timestamp)).toEqual([
			new Date(1_000).toISOString(),
			new Date(1_000_000_000_000).toISOString(),
			new Date(0).toISOString()
		]);
		expect(events.every((event) => event.adapterElapsedMs < 1_000)).toBe(true);
		expect(events[1]?.durationMs).toBeLessThan(1_000);
	});

	it('rejects exact-boundary request and binding failures before executor capture', async () => {
		const binding = syntheticBinding();
		const requestCases: unknown[] = [
			null,
			[],
			Object.setPrototypeOf({ ...binding.request }, Date.prototype),
			{ ...binding.request, schemaVersion: 'unsupported' },
			{ ...binding.request, operationVersion: 'unsupported' },
			{ ...binding.request, subjectId: '' },
			{ ...binding.request, artifactSetId: '' },
			{ ...binding.request, budgets: { ...binding.request.budgets, maxArtifacts: 0 } }
		];
		const accessor = { ...binding.request } as Record<string, unknown>;
		Object.defineProperty(accessor, 'subjectId', {
			enumerable: true,
			get: () => binding.request.subjectId
		});
		requestCases.push(accessor);
		for (const request of requestCases) {
			const outcome = await observeArrowCommandCensus(request as never, binding);
			expect(outcome).toMatchObject({
				diagnostics: [expect.objectContaining({ code: 'REQUEST_INVALID' })],
				outcome: 'unavailable'
			});
		}

		const bindingCases: Array<{
			readonly dependencies: {
				artifactSet: ArrowCommandCensusArtifactSetBinding;
				subject: FrozenSubject;
			};
			readonly expected: string;
			readonly request?: typeof binding.request;
		}> = [
			{
				dependencies: {
					artifactSet: binding.artifactSet,
					subject: { ...binding.subject } as FrozenSubject
				},
				expected: 'SUBJECT_CAPABILITY_UNAVAILABLE'
			},
			{
				dependencies: { artifactSet: binding.artifactSet, subject: binding.subject },
				expected: 'SUBJECT_ID_MISMATCH',
				request: { ...binding.request, subjectId: 'different' }
			},
			{
				dependencies: {
					artifactSet: {
						...binding.artifactSet,
						id: 'different'
					} as ArrowCommandCensusArtifactSetBinding,
					subject: binding.subject
				},
				expected: 'ARTIFACT_SET_IDENTITY_MISMATCH'
			},
			{
				dependencies: { artifactSet: binding.artifactSet, subject: binding.subject },
				expected: 'BUDGET_EXHAUSTED',
				request: {
					...binding.request,
					budgets: { ...binding.request.budgets, maxArtifacts: 1 }
				}
			}
		];
		for (const candidate of bindingCases) {
			const outcome = await observeArrowCommandCensus(
				(candidate.request ?? binding.request) as never,
				candidate.dependencies
			);
			expect(outcome).toMatchObject({
				diagnostics: [expect.objectContaining({ code: candidate.expected })],
				outcome: 'unavailable'
			});
		}

		const invalidArtifactSet = structuredClone(binding.artifactSet) as unknown as Record<
			string,
			any
		>;
		invalidArtifactSet.contentDigest = '0'.repeat(64);
		const invalidSetOutcome = await observeArrowCommandCensus(binding.request, {
			artifactSet: invalidArtifactSet as ArrowCommandCensusArtifactSetBinding,
			subject: binding.subject
		});
		expect(invalidSetOutcome).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'ARTIFACT_SET_INVALID' })],
			outcome: 'unavailable'
		});
	});
});

describe('JPWB retained arrow-command census bounded observer', () => {
	it.each([
		['STDOUT_BUDGET', { maxStdoutBytes: 1 }, 'BUDGET_EXHAUSTED'],
		['STDERR_BUDGET', { maxStderrBytes: 1 }, 'BUDGET_EXHAUSTED'],
		['TIMEOUT', { maxExecutorDurationMs: 1 }, 'BUDGET_EXHAUSTED'],
		['CHILD_ERROR', {}, 'EXECUTOR_FAILED'],
		['NONZERO_EXIT', {}, 'EXECUTOR_FAILED'],
		['STDERR_SUCCESS', {}, 'EXECUTOR_FAILED'],
		['INVALID_UTF8', {}, 'RAW_OUTPUT_INVALID'],
		['INVALID_FRAME', {}, 'RAW_OUTPUT_INVALID'],
		['INVALID_JSON', {}, 'RAW_OUTPUT_INVALID'],
		['INVALID_SHAPE', {}, 'RAW_OUTPUT_INVALID']
	] as const)(
		'fails closed for isolated-worker outcome %s',
		async (mode, budgetOverrides, expectedCode) => {
			const binding = syntheticBinding();
			childProcessControl.mode = mode;
			const events: ArrowCommandCensusProgressEvent[] = [];
			const outcome = await observeArrowCommandCensus(
				{
					...binding.request,
					budgets: { ...binding.request.budgets, ...budgetOverrides }
				},
				{ artifactSet: binding.artifactSet, subject: binding.subject },
				{ onProgress: (event) => events.push(event) }
			);
			expect(outcome).toMatchObject({
				diagnostics: [expect.objectContaining({ code: expectedCode })],
				outcome: 'unavailable'
			});
			expect(events.at(-1)).toMatchObject({ phase: 'CAPSULE_CLEANUP', state: 'COMPLETED' });
		},
		30_000
	);

	it('fails closed when materialization exceeds its caller operation budget and cleans the capsule', async () => {
		const binding = syntheticBinding();
		const progress: ArrowCommandCensusProgressEvent[] = [];
		const outcome = await observeArrowCommandCensus(
			{
				...binding.request,
				budgets: { ...binding.request.budgets, maxMaterializedBytes: 1 }
			},
			{ artifactSet: binding.artifactSet, subject: binding.subject },
			{ onProgress: (event) => progress.push(event) }
		);
		expect(outcome).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'BUDGET_EXHAUSTED' })],
			outcome: 'unavailable'
		});
		expect(progress.map((event) => [event.phase, event.state])).toEqual(
			expect.arrayContaining([
				['CAPSULE_MATERIALIZATION', 'FAILED'],
				['CAPSULE_CLEANUP', 'COMPLETED']
			])
		);
	});

	it('executes a synthetic frozen subject with portable evidence and complete phase telemetry', async () => {
		const { artifactSet, request, subject } = syntheticBinding();
		const progress: ArrowCommandCensusProgressEvent[] = [];
		const outcome = await observeArrowCommandCensus(
			request,
			{ artifactSet, subject },
			{ onProgress: (event) => progress.push(event) }
		);
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('complete');
		if (outcome.outcome !== 'complete') return;
		expect(outcome.observation.coverage).toMatchObject({
			baselineMatches: true,
			coveredInScopeTopologyArrows: 1,
			declaredArrowOccurrences: 1,
			totalInScopeTopologyArrows: 1,
			uncoveredArrows: 0
		});
		expect(validateArrowCommandCensusObservation(outcome.observation, subject)).toEqual({
			issues: [],
			state: 'VALID'
		});
		expect(progress.map((event) => [event.phase, event.state])).toEqual([
			['REQUEST_AND_ARTIFACT_BIND', 'STARTED'],
			['REQUEST_AND_ARTIFACT_BIND', 'COMPLETED'],
			['EXECUTOR_ENVIRONMENT_CAPTURE', 'STARTED'],
			['EXECUTOR_ENVIRONMENT_CAPTURE', 'COMPLETED'],
			['CAPSULE_MATERIALIZATION', 'STARTED'],
			['CAPSULE_MATERIALIZATION', 'COMPLETED'],
			['RETAINED_VERIFIER_EXECUTION', 'STARTED'],
			['RETAINED_VERIFIER_EXECUTION', 'COMPLETED'],
			['POST_EXECUTION_INTEGRITY_RECHECK', 'STARTED'],
			['POST_EXECUTION_INTEGRITY_RECHECK', 'COMPLETED'],
			['RETAINED_VERIFIER_RESULT_ACCEPTANCE', 'STARTED'],
			['RETAINED_VERIFIER_RESULT_ACCEPTANCE', 'COMPLETED'],
			['WORKER_OUTPUT_PARSE_AND_RUNTIME_RECONCILE', 'STARTED'],
			['WORKER_OUTPUT_PARSE_AND_RUNTIME_RECONCILE', 'COMPLETED'],
			['OBSERVATION_NORMALIZATION', 'STARTED'],
			['OBSERVATION_NORMALIZATION', 'COMPLETED'],
			['CAPSULE_CLEANUP', 'STARTED'],
			['CAPSULE_CLEANUP', 'COMPLETED']
		]);
		const evidence = JSON.stringify(outcome.observation);
		expect(evidence).not.toContain(ROOT);
		expect(evidence).not.toContain(process.execPath);
	}, 120_000);
});

describe.skipIf(process.env.CSAA_ARROW_CENSUS_INTEGRATION !== '1')(
	'JPWB retained arrow-command census integration',
	() => {
		it('binds the current repository and reproduces stable canonical evidence across capsules', async () => {
			const resolution = resolveSubject({
				budgets: {
					maxBytes: 256 * 1024 * 1024,
					maxConfigDepth: 64,
					maxDiagnostics: 100_000,
					maxDurationMs: 180_000,
					maxFiles: 100_000,
					maxProjects: 200
				},
				expectEmpty: false,
				filters: { exclude: [], include: [] },
				operationVersion: 'jan-csaa-arrow-command-census-integration/1.0.0',
				outputs: [],
				policyVersion: SUBJECT_POLICY_VERSION,
				rootLocator: ROOT,
				schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
				scope: { kind: 'REPOSITORY' },
				subjectKind: 'WORKTREE'
			});
			expect(resolution.outcome).toBe('resolved');
			if (resolution.outcome !== 'resolved') throw new Error(JSON.stringify(resolution));
			const subject = resolution.subject;
			const setOutcome = buildArrowCommandCensusArtifactSet(
				{
					budgets: {
						maxArtifacts: observerBudgets.maxArtifacts,
						maxDiagnostics: observerBudgets.maxDiagnostics,
						maxTotalBytes: observerBudgets.maxMaterializedBytes
					},
					operationVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION,
					schemaVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
					subjectId: subject.descriptor.subjectId
				},
				{ subject }
			);
			expect(setOutcome.outcome, JSON.stringify(setOutcome)).toBe('complete');
			if (setOutcome.outcome !== 'complete') throw new Error(JSON.stringify(setOutcome));
			const request = {
				artifactSetId: setOutcome.artifactSet.id,
				budgets: observerBudgets,
				operationVersion: ARROW_COMMAND_CENSUS_OPERATION_VERSION,
				schemaVersion: ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
				subjectId: subject.descriptor.subjectId
			};
			const progress: ArrowCommandCensusProgressEvent[] = [];
			const first = await observeArrowCommandCensus(
				request,
				{
					artifactSet: setOutcome.artifactSet,
					subject
				},
				{ onProgress: (event) => progress.push(event) }
			);
			const second = await observeArrowCommandCensus(request, {
				artifactSet: setOutcome.artifactSet,
				subject
			});
			expect(first.outcome, JSON.stringify(first)).toBe('complete');
			expect(second.outcome, JSON.stringify(second)).toBe('complete');
			if (first.outcome === 'unavailable' || second.outcome === 'unavailable') return;
			expect(second.observation).toEqual(first.observation);
			expect(validateArrowCommandCensusObservation(first.observation, subject)).toEqual({
				issues: [],
				state: 'VALID'
			});
			expect(progress.map((event) => [event.phase, event.state])).toEqual([
				['REQUEST_AND_ARTIFACT_BIND', 'STARTED'],
				['REQUEST_AND_ARTIFACT_BIND', 'COMPLETED'],
				['EXECUTOR_ENVIRONMENT_CAPTURE', 'STARTED'],
				['EXECUTOR_ENVIRONMENT_CAPTURE', 'COMPLETED'],
				['CAPSULE_MATERIALIZATION', 'STARTED'],
				['CAPSULE_MATERIALIZATION', 'COMPLETED'],
				['RETAINED_VERIFIER_EXECUTION', 'STARTED'],
				['RETAINED_VERIFIER_EXECUTION', 'COMPLETED'],
				['POST_EXECUTION_INTEGRITY_RECHECK', 'STARTED'],
				['POST_EXECUTION_INTEGRITY_RECHECK', 'COMPLETED'],
				['RETAINED_VERIFIER_RESULT_ACCEPTANCE', 'STARTED'],
				['RETAINED_VERIFIER_RESULT_ACCEPTANCE', 'COMPLETED'],
				['WORKER_OUTPUT_PARSE_AND_RUNTIME_RECONCILE', 'STARTED'],
				['WORKER_OUTPUT_PARSE_AND_RUNTIME_RECONCILE', 'COMPLETED'],
				['OBSERVATION_NORMALIZATION', 'STARTED'],
				['OBSERVATION_NORMALIZATION', 'COMPLETED'],
				['CAPSULE_CLEANUP', 'STARTED'],
				['CAPSULE_CLEANUP', 'COMPLETED']
			]);
			expect(
				progress
					.filter((event) => event.state !== 'STARTED')
					.every((event) => typeof event.durationMs === 'number' && event.durationMs >= 0)
			).toBe(true);
			expect(JSON.stringify(progress)).not.toMatch(/capsuleRoot|packageRoot|resolvedPath/u);
			expect(first.observation.coverage).toMatchObject({
				baselineMatches: true,
				deadCoveredArrows: 11,
				declaredArrowOccurrences: 164,
				orphanMachines: 10,
				totalInScopeTopologyArrows: 295,
				unanalysedMachines: 2,
				uncoveredArrows: 153
			});
			expect(first.observation.executor.externalModules.map((module) => module.name)).toEqual([
				'typescript',
				'ulid',
				'zod'
			]);
		}, 300_000);
	}
);
