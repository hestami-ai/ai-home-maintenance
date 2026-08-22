import { Buffer } from 'node:buffer';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
	ARROW_COMMAND_CENSUS_ADAPTER_ID,
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_RAW_OUTPUT_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
	type ArrowCommandCensusExecutorIdentity,
	type ArrowCommandCensusObservation,
	type ArrowCommandCensusRawOutput,
	type ObserveArrowCommandCensusOutcome
} from '../contracts/arrow-command-census.js';
import {
	ARROW_COMMAND_CENSUS_REPORT_EXECUTION_SELECTION,
	ARROW_COMMAND_CENSUS_REPORT_ADMISSION_LIMITS,
	ARROW_COMMAND_CENSUS_REPORT_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_REPORT_REQUEST_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_REPORT_SAFETY_CEILINGS,
	type ArrowCommandCensusReportRequest
} from '../contracts/arrow-command-census-report.js';
import {
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	SUBJECT_SCHEMA_VERSION,
	type CapturedArtifactRecord,
	type FrozenSubject
} from '../contracts/subject.js';
import { sha256 } from '../inventory/canonical.js';
import { classifyArtifact } from '../subject/artifacts.js';
import { attachFrozenSubjectBytes } from '../subject/frozen-store.js';
import { canonicalPathKey } from '../subject/paths.js';
import {
	buildArrowCommandCensusArtifactSet,
	validateArrowCommandCensusArtifactSet
} from '../providers/jpwb-arrow-command-census/artifact-set.js';
import {
	observeArrowCommandCensus,
	type ArrowCommandCensusProgressEvent
} from '../providers/jpwb-arrow-command-census/observe-arrow-command-census.js';
import { normalizeArrowCommandCensusObservation } from '../providers/jpwb-arrow-command-census/normalize-arrow-command-census.js';
import { validateArrowCommandCensusObservation } from '../providers/jpwb-arrow-command-census/validate-arrow-command-census.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import type { verifyFrozenSubject } from '../subject/freshness.js';
import type { resolveSubject } from '../subject/resolve-subject.js';
import {
	admitArrowCommandCensusReportRequest,
	runArrowCommandCensusReport,
	runArrowCommandCensusReportWithDependencies,
	type ArrowCommandCensusReportProgressEvent,
	type ArrowCommandCensusReportRuntimeDependencies
} from './run-arrow-command-census-report.js';

const SYNTHETIC_SUBJECT_ID = 'subject:arrow-command-census-report-fixture';
const encoder = new TextEncoder();
const root = mkdtempSync(join(tmpdir(), 'csaa-arrow-command-census-report-'));
const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const projectPath = 'fixture/tsconfig.json';

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
		.sort((left, right) => left.path.localeCompare(right.path));
	const request = {
		budgets: ARROW_COMMAND_CENSUS_REPORT_SAFETY_CEILINGS.subject,
		expectEmpty: false,
		filters: { exclude: [], include: [] },
		operationVersion: ARROW_COMMAND_CENSUS_REPORT_OPERATION_VERSION,
		outputs: [],
		policyVersion: SUBJECT_POLICY_VERSION,
		rootLocator: '<runtime>',
		schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
		scope: { additionalArtifacts: [], kind: 'EXPLICIT_PROJECTS', projects: [projectPath] },
		subjectKind: 'WORKTREE'
	} as const;
	const subject: FrozenSubject = {
		artifacts,
		descriptor: {
			configurationDigest: 'fixture-configuration',
			dirtyState: 'UNKNOWN',
			excludedClasses: [],
			exclusionPolicyIds: [],
			fileManifestDigest: 'fixture-manifest',
			operationVersion: ARROW_COMMAND_CENSUS_REPORT_OPERATION_VERSION,
			parentRevision: null,
			perimeter: [...SYNTHETIC_SOURCES.keys()].sort(),
			policyVersion: SUBJECT_POLICY_VERSION,
			repositoryRoot: '.',
			revision: null,
			schemaVersion: SUBJECT_SCHEMA_VERSION,
			subjectId: SYNTHETIC_SUBJECT_ID,
			subjectKind: 'WORKTREE'
		},
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
		request,
		workspaces: []
	};
	attachFrozenSubjectBytes(
		subject,
		new Map([...SYNTHETIC_SOURCES].map(([path, source]) => [path, encoder.encode(source)]))
	);
	return subject;
}

function acceptedRequest(
	maxResultBytes = ARROW_COMMAND_CENSUS_REPORT_SAFETY_CEILINGS.maxResultBytes
) {
	return {
		budgets: { ...ARROW_COMMAND_CENSUS_REPORT_SAFETY_CEILINGS, maxResultBytes },
		executionSelection: ARROW_COMMAND_CENSUS_REPORT_EXECUTION_SELECTION,
		operationVersion: ARROW_COMMAND_CENSUS_REPORT_OPERATION_VERSION,
		schemaVersion: ARROW_COMMAND_CENSUS_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: [projectPath]
	} satisfies ArrowCommandCensusReportRequest;
}

let subject: FrozenSubject;
let retainedOutcome: Exclude<ObserveArrowCommandCensusOutcome, { readonly outcome: 'unavailable' }>;

beforeAll(() => {
	mkdirSync(dirname(join(root, projectPath)), { recursive: true });
	writeFileSync(join(root, projectPath), '{"compilerOptions":{},"files":[]}\n');
	subject = syntheticSubject();
	const artifactSetOutcome = buildArrowCommandCensusArtifactSet(
		{
			budgets: ARROW_COMMAND_CENSUS_REPORT_SAFETY_CEILINGS.artifactSet,
			operationVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION,
			schemaVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
			subjectId: subject.descriptor.subjectId
		},
		{ subject }
	);
	if (artifactSetOutcome.outcome !== 'complete')
		throw new Error(JSON.stringify(artifactSetOutcome));
	const retainedVerifier = artifactSetOutcome.artifactSet.artifacts.find(
		(artifact) => artifact.path === 'verif/arrow-command-census.ts'
	);
	if (retainedVerifier === undefined) throw new Error('Synthetic retained verifier is absent.');
	const fixtureSha = '0'.repeat(64);
	const executor: ArrowCommandCensusExecutorIdentity = {
		adapterId: ARROW_COMMAND_CENSUS_ADAPTER_ID,
		adapterVersion: ARROW_COMMAND_CENSUS_OPERATION_VERSION,
		executableBytes: 1,
		executableSha256: fixtureSha,
		externalModules: [
			{ bytes: 1, contentDigest: fixtureSha, files: 1, name: 'typescript', version: '5.9.3' },
			{ bytes: 1, contentDigest: fixtureSha, files: 1, name: 'ulid', version: '2.4.0' },
			{ bytes: 1, contentDigest: fixtureSha, files: 1, name: 'zod', version: '4.4.3' }
		],
		retainedVerifierCanonicalPathKey: retainedVerifier.canonicalPathKey,
		retainedVerifierSha256: retainedVerifier.sha256,
		runtime: 'bun',
		runtimeVersion: '1.3.14',
		worker: { bytes: 1, sha256: fixtureSha }
	};
	const evidence: ArrowCommandCensusRawOutput = {
		baseline: { dead: [], orphans: [], total: 1, unanalysed: [], uncovered: [] },
		births: [{ machine: 'Alpha', states: ['A0'] }],
		census: { orphans: [], total: 1, uncovered: [] },
		deadCovered: { dead: [], unanalysed: [] },
		declaredArrows: [{ from: 'A0', machine: 'Alpha', site: 'execution.ts:1', to: 'A1' }],
		occupiable: [{ machine: 'Alpha', states: ['A0', 'A1'] }],
		schemaVersion: ARROW_COMMAND_CENSUS_RAW_OUTPUT_SCHEMA_VERSION
	};
	const observation = normalizeArrowCommandCensusObservation({
		artifactSet: artifactSetOutcome.artifactSet,
		evidence,
		executor,
		request: {
			artifactSetId: artifactSetOutcome.artifactSet.id,
			budgets: ARROW_COMMAND_CENSUS_REPORT_SAFETY_CEILINGS.observation,
			operationVersion: ARROW_COMMAND_CENSUS_OPERATION_VERSION,
			schemaVersion: ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
			subjectId: subject.descriptor.subjectId
		}
	}).observation;
	const validation = validateArrowCommandCensusObservation(observation, subject);
	if (validation.state !== 'VALID') throw new Error(JSON.stringify(validation));
	retainedOutcome = { diagnostics: [], observation, outcome: 'complete' };
});

afterAll(() => {
	rmSync(root, { force: true, recursive: true });
});

function resolvedSubject(): ReturnType<typeof resolveSubject> {
	return { completeness: 'COMPLETE', diagnostics: [], outcome: 'resolved', subject };
}

function currentSubject(): ReturnType<typeof verifyFrozenSubject> {
	return { changedPaths: [], diagnostics: [], state: 'CURRENT' };
}

function adapterEvent(details: Readonly<Record<string, unknown>>): ArrowCommandCensusProgressEvent {
	return {
		adapterElapsedMs: 1,
		details,
		durationMs: 1,
		event: 'CSAA_ARROW_COMMAND_CENSUS_PHASE',
		phase: 'OBSERVATION_NORMALIZATION',
		schemaVersion: 'jan-csaa-arrow-command-census-progress/1.0.0',
		sequence: 1,
		state: 'COMPLETED',
		timestamp: '2026-01-01T00:00:00.000Z'
	};
}

function dependencies(
	overrides: Partial<ArrowCommandCensusReportRuntimeDependencies> = {}
): ArrowCommandCensusReportRuntimeDependencies {
	return {
		buildArtifactSet: buildArrowCommandCensusArtifactSet,
		observeCensus: async (_request, _inputs, options) => {
			options?.onProgress?.(adapterEvent({ coverage: retainedOutcome.observation.coverage }));
			return retainedOutcome;
		},
		resolveSubject: (() => resolvedSubject()) as typeof resolveSubject,
		validateArtifactSet: validateArrowCommandCensusArtifactSet,
		validateObservation: validateArrowCommandCensusObservation,
		verifySubject: (() => currentSubject()) as typeof verifyFrozenSubject,
		...overrides
	};
}

describe('arrow-command-census report', () => {
	it('requires explicit acknowledgement of the side-effecting retained execution boundary', () => {
		const { executionSelection: _executionSelection, ...missing } = acceptedRequest();
		expect(admitArrowCommandCensusReportRequest(missing)).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'rejected'
		});
		expect(
			admitArrowCommandCensusReportRequest({
				...acceptedRequest(),
				executionSelection: 'RUN_WITHOUT_SIDE_EFFECTS'
			})
		).toMatchObject({ code: 'REQUEST_EXECUTION_SELECTION_UNSUPPORTED', outcome: 'rejected' });
	});

	it('publishes and enforces the exact project-path ceiling while rejecting hostile path text', () => {
		const atLimit = 'a'.repeat(
			ARROW_COMMAND_CENSUS_REPORT_ADMISSION_LIMITS.maxProjectPathCharacters
		);
		expect(
			admitArrowCommandCensusReportRequest({
				...acceptedRequest(),
				subjectProjectConfigPaths: [atLimit]
			})
		).toMatchObject({ outcome: 'admitted', request: { subjectProjectConfigPaths: [atLimit] } });
		expect(
			admitArrowCommandCensusReportRequest({
				...acceptedRequest(),
				subjectProjectConfigPaths: [`${atLimit}a`]
			})
		).toMatchObject({ code: 'REQUEST_PATH_BUDGET_EXCEEDED', outcome: 'rejected' });
		for (const hostilePath of ['fixture/*.json', 'fixture/\u0000.json', 'fixture/\ud800.json']) {
			expect(
				admitArrowCommandCensusReportRequest({
					...acceptedRequest(),
					subjectProjectConfigPaths: [hostilePath]
				})
			).toMatchObject({ code: 'REQUEST_PATH_INVALID', outcome: 'rejected' });
		}
	});

	it.runIf(process.env.CSAA_ARROW_COMMAND_CENSUS_REPORT_INTEGRATION === '1')(
		'runs the public facade with production dependencies against the current repository',
		async () => {
			const progress: ArrowCommandCensusReportProgressEvent[] = [];
			const outcome = await runArrowCommandCensusReport(
				{
					budgets: ARROW_COMMAND_CENSUS_REPORT_SAFETY_CEILINGS,
					executionSelection: ARROW_COMMAND_CENSUS_REPORT_EXECUTION_SELECTION,
					operationVersion: ARROW_COMMAND_CENSUS_REPORT_OPERATION_VERSION,
					schemaVersion: ARROW_COMMAND_CENSUS_REPORT_REQUEST_SCHEMA_VERSION,
					subjectProjectConfigPaths: [
						'packages/rph-application/tsconfig.json',
						'packages/rph-contracts/tsconfig.json',
						'packages/rph-domain/tsconfig.json'
					]
				},
				{
					onProgress: (event) => progress.push(event),
					repositoryRoot: REPOSITORY_ROOT
				}
			);

			expect(outcome.outcome, JSON.stringify(outcome)).toBe('partial');
			if (outcome.outcome !== 'partial') return;
			expect(outcome.stageOutcomes).toMatchObject({
				artifactSet: { outcome: 'complete' },
				currentness: { state: 'CURRENT_FOR_CAPTURED_SUBJECT' },
				retainedCensus: { outcome: 'complete' },
				subject: { outcome: 'resolved' }
			});
			expect(outcome.result.coverage.baselineMatches).toBe(true);
			expect(outcome.result.evidence.observation.declaredArrows.length).toBeGreaterThan(0);
			expect(outcome.result.evidence.observation.declaredSites.length).toBeGreaterThan(0);
			expect(progress.some((event) => event.kind === 'RETAINED_ADAPTER')).toBe(true);
			for (const phase of [
				'REQUEST_BIND',
				'SUBJECT_CAPTURE',
				'ARTIFACT_SET',
				'RETAINED_CENSUS',
				'CURRENTNESS',
				'RESULT'
			] as const) {
				expect(
					progress.filter((event) => event.kind === 'REPORT_STAGE' && event.phase === phase)
				).toEqual([
					expect.objectContaining({ state: 'STARTED' }),
					expect.objectContaining({ state: 'COMPLETED' })
				]);
			}
		},
		600_000
	);

	it('returns nonempty validated retained evidence without allowing progress mutation or rejection to alter it', async () => {
		const progress: ArrowCommandCensusReportProgressEvent[] = [];
		const outcome = await runArrowCommandCensusReportWithDependencies(
			acceptedRequest(),
			{
				onProgress(event) {
					progress.push(event);
					if (event.kind === 'RETAINED_ADAPTER') {
						const coverage = event.adapterProgress?.details.coverage as
							{ baselineMatches?: boolean } | undefined;
						if (coverage !== undefined) coverage.baselineMatches = false;
					}
					return Promise.reject(new Error('contained progress rejection'));
				},
				repositoryRoot: root
			},
			dependencies()
		);
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('partial');
		if (outcome.outcome !== 'partial') return;
		expect(outcome).toMatchObject({
			analysisAuthority: 'NONE',
			authorityTransfer: 'NONE',
			gateEffect: 'NONE',
			result: {
				capability: {
					id: 'arrow-command-census',
					registryStatus: 'IMPLEMENTATION_LOCAL_UNREGISTERED',
					status: 'PARTIAL',
					verifierAuthority: 'RETAINED_DELEGATED'
				},
				coverage: {
					baselineMatches: true,
					declaredArrowOccurrences: 1,
					declaredSites: 1,
					totalInScopeTopologyArrows: 1,
					uncoveredArrows: 0
				},
				currentness: { state: 'CURRENT_FOR_CAPTURED_SUBJECT' }
			}
		});
		expect(outcome.result.evidence.observation.declaredArrows).toEqual([
			expect.objectContaining({ from: 'A0', machine: 'Alpha', to: 'A1' })
		]);
		expect(
			validateArrowCommandCensusObservation(outcome.result.evidence.observation, subject)
		).toEqual({
			issues: [],
			state: 'VALID'
		});
		expect(progress.some((event) => event.kind === 'RETAINED_ADAPTER')).toBe(true);
		for (const phase of [
			'REQUEST_BIND',
			'SUBJECT_CAPTURE',
			'ARTIFACT_SET',
			'RETAINED_CENSUS',
			'CURRENTNESS',
			'RESULT'
		] as const) {
			expect(
				progress.filter((event) => event.phase === phase && event.kind === 'REPORT_STAGE')
			).toEqual([
				expect.objectContaining({ state: 'STARTED' }),
				expect.objectContaining({ state: 'COMPLETED' })
			]);
		}
	});

	it('awaits the retained observer before currentness and terminal evidence', async () => {
		let release!: (value: ObserveArrowCommandCensusOutcome) => void;
		const deferred = new Promise<ObserveArrowCommandCensusOutcome>((resolve) => {
			release = resolve;
		});
		let settled = false;
		const running = runArrowCommandCensusReportWithDependencies(
			acceptedRequest(),
			{ repositoryRoot: root },
			dependencies({ observeCensus: (() => deferred) as typeof observeArrowCommandCensus })
		).then((outcome) => {
			settled = true;
			return outcome;
		});
		await Promise.resolve();
		expect(settled).toBe(false);
		release(retainedOutcome);
		expect((await running).outcome).toBe('partial');
	});

	it('preserves a partial baseline observation and classifies provider budget refusal', async () => {
		const mismatched = normalizeArrowCommandCensusObservation({
			artifactSet: retainedOutcome.observation.artifactSet,
			evidence: {
				...retainedOutcome.observation.rawEvidence,
				baseline: { ...retainedOutcome.observation.rawEvidence.baseline, total: 2 }
			},
			executor: retainedOutcome.observation.executor,
			request: {
				artifactSetId: retainedOutcome.observation.artifactSet.id,
				budgets: retainedOutcome.observation.budgets,
				operationVersion: ARROW_COMMAND_CENSUS_OPERATION_VERSION,
				schemaVersion: ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
				subjectId: retainedOutcome.observation.subjectId
			}
		});
		expect(mismatched.baselineMismatch).toBe(true);
		const baselinePartial: ObserveArrowCommandCensusOutcome = {
			diagnostics: [
				{
					code: 'BASELINE_MISMATCH',
					message: 'Synthetic retained baseline mismatch.',
					path: 'verif/arrow-command-census.baseline.json',
					phase: 'VALIDATE',
					severity: 'WARNING'
				}
			],
			observation: mismatched.observation,
			outcome: 'partial'
		};
		const partial = await runArrowCommandCensusReportWithDependencies(
			acceptedRequest(),
			{ repositoryRoot: root },
			dependencies({
				observeCensus: (async () => baselinePartial) as typeof observeArrowCommandCensus
			})
		);
		expect(partial).toMatchObject({
			outcome: 'partial',
			result: { coverage: { baselineMatches: false } },
			stageOutcomes: {
				retainedCensus: { diagnosticCodes: ['BASELINE_MISMATCH'], outcome: 'partial' }
			}
		});

		const refused = await runArrowCommandCensusReportWithDependencies(
			acceptedRequest(),
			{ repositoryRoot: root },
			dependencies({
				observeCensus: (async () => ({
					diagnostics: [
						{
							code: 'BUDGET_EXHAUSTED',
							message: 'Synthetic budget refusal.',
							path: '$request.budgets.maxStdoutBytes',
							phase: 'EXECUTE',
							severity: 'ERROR'
						}
					],
					outcome: 'unavailable'
				})) as typeof observeArrowCommandCensus
			})
		);
		expect(refused).toMatchObject({
			diagnostics: [{ path: '$.budgets.observation.maxStdoutBytes' }],
			outcome: 'unavailable',
			stage: 'RETAINED_CENSUS',
			state: 'resource-refused'
		});
		const aggregateRefused = await runArrowCommandCensusReportWithDependencies(
			acceptedRequest(),
			{ repositoryRoot: root },
			dependencies({
				observeCensus: (async () => ({
					diagnostics: [
						{
							code: 'BUDGET_EXHAUSTED',
							message: 'Synthetic aggregate budget refusal.',
							path: '$request.budgets',
							phase: 'EXECUTE',
							severity: 'ERROR'
						}
					],
					outcome: 'unavailable'
				})) as typeof observeArrowCommandCensus
			})
		);
		expect(aggregateRefused).toMatchObject({
			diagnostics: [{ path: '$.budgets.observation' }],
			outcome: 'unavailable',
			state: 'resource-refused'
		});
	});

	it('rejects a contradictory partial envelope that the retained provider cannot emit', async () => {
		const contradictory = await runArrowCommandCensusReportWithDependencies(
			acceptedRequest(),
			{ repositoryRoot: root },
			dependencies({
				observeCensus: (async () => ({
					diagnostics: [
						{
							code: 'BASELINE_MISMATCH',
							message: 'Forged mismatch around matching evidence.',
							path: 'verif/arrow-command-census.baseline.json',
							phase: 'VALIDATE',
							severity: 'WARNING'
						}
					],
					observation: retainedOutcome.observation,
					outcome: 'partial'
				})) as typeof observeArrowCommandCensus
			})
		);
		expect(contradictory).toMatchObject({
			code: 'EVIDENCE_IDENTITY_MISMATCH',
			outcome: 'unavailable',
			stage: 'RETAINED_CENSUS',
			state: 'failed'
		});
	});

	it('bounds and attributes independent artifact-set validation diagnostics', async () => {
		let receivedMaxIssues: number | undefined;
		const request = acceptedRequest();
		const outcome = await runArrowCommandCensusReportWithDependencies(
			{
				...request,
				budgets: {
					...request.budgets,
					artifactSet: { ...request.budgets.artifactSet, maxDiagnostics: 7 }
				}
			},
			{ repositoryRoot: root },
			dependencies({
				validateArtifactSet: ((_value, _subject, options) => {
					receivedMaxIssues = options?.maxIssues;
					return {
						issues: [
							{ code: 'IDENTITY_MISMATCH', message: 'Synthetic artifact mismatch.', path: '$.id' }
						],
						state: 'INVALID'
					};
				}) as typeof validateArrowCommandCensusArtifactSet
			})
		);
		expect(receivedMaxIssues).toBe(7);
		expect(outcome).toMatchObject({
			code: 'ARTIFACT_SET_VALIDATION_FAILED',
			diagnostics: expect.arrayContaining([
				expect.objectContaining({ path: '$.id', source: 'ARTIFACT_SET' })
			]),
			outcome: 'unavailable',
			stage: 'ARTIFACT_SET'
		});
	});

	it('fails independently invalid returned evidence and never calls it caller incompatibility', async () => {
		const invalid = await runArrowCommandCensusReportWithDependencies(
			acceptedRequest(),
			{ repositoryRoot: root },
			dependencies({
				validateObservation: (() => ({
					issues: [
						{ code: 'IDENTITY_MISMATCH', message: 'Synthetic invalid observation.', path: '$.id' }
					],
					state: 'INVALID'
				})) as typeof validateArrowCommandCensusObservation
			})
		);
		expect(invalid).toMatchObject({
			code: 'OBSERVATION_VALIDATION_FAILED',
			diagnostics: expect.arrayContaining([
				expect.objectContaining({ path: '$.id', source: 'RETAINED_CENSUS' })
			]),
			outcome: 'unavailable',
			stage: 'RETAINED_CENSUS',
			state: 'failed'
		});
	});

	it.each([
		[
			'verifier authority',
			(observation: ArrowCommandCensusObservation) => ({
				...observation,
				verifierAuthority: 'FORGED_AUTHORITY' as never
			})
		],
		[
			'oracle change',
			(observation: ArrowCommandCensusObservation) => ({
				...observation,
				oracleChange: 'FORGED_ORACLE_CHANGE' as never
			})
		],
		[
			'replacement equivalence',
			(observation: ArrowCommandCensusObservation) => ({
				...observation,
				replacementEquivalence: 'FORGED_REPLACEMENT_EQUIVALENCE' as never
			})
		],
		[
			'integration strategy',
			(observation: ArrowCommandCensusObservation) => ({
				...observation,
				integrationStrategy: 'FORGED_INTEGRATION_STRATEGY' as never
			})
		],
		[
			'conformance boundary',
			(observation: ArrowCommandCensusObservation) => ({
				...observation,
				fullJanCsaa007Conformance: 'COMPLETE' as never
			})
		],
		[
			'executor adapter identity',
			(observation: ArrowCommandCensusObservation) => ({
				...observation,
				executor: { ...observation.executor, adapterId: 'forged-adapter' as never }
			})
		]
	] as const)(
		'rejects forged %s even when a trust-bound validator falsely reports VALID',
		async (_label, forge) => {
			const forged = await runArrowCommandCensusReportWithDependencies(
				acceptedRequest(),
				{ repositoryRoot: root },
				dependencies({
					observeCensus: (async () => ({
						diagnostics: [],
						observation: forge(retainedOutcome.observation),
						outcome: 'complete'
					})) as typeof observeArrowCommandCensus,
					validateObservation: (() => ({
						issues: [],
						state: 'VALID'
					})) as typeof validateArrowCommandCensusObservation
				})
			);
			expect(forged).toMatchObject({
				code: 'EVIDENCE_IDENTITY_MISMATCH',
				outcome: 'unavailable',
				stage: 'RESULT',
				state: 'failed'
			});
		}
	);

	it.each([
		{
			expected: 'STALE',
			freshness: { changedPaths: ['fixture/tsconfig.json'], diagnostics: [], state: 'STALE' }
		},
		{
			expected: 'UNAVAILABLE',
			freshness: { changedPaths: [], diagnostics: [], state: 'UNAVAILABLE' }
		}
	] as const)(
		'retains captured evidence when final currentness is $expected',
		async ({ expected, freshness }) => {
			const outcome = await runArrowCommandCensusReportWithDependencies(
				acceptedRequest(),
				{ repositoryRoot: root },
				dependencies({ verifySubject: (() => freshness) as typeof verifyFrozenSubject })
			);
			expect(outcome).toMatchObject({
				outcome: 'partial',
				result: { coverage: { declaredArrowOccurrences: 1 }, currentness: { state: expected } }
			});
		}
	);

	it('admits the exact serialized terminal size and refuses one byte below it', async () => {
		let limit = ARROW_COMMAND_CENSUS_REPORT_SAFETY_CEILINGS.maxResultBytes;
		let exactOutcome;
		for (let attempt = 0; attempt < 8; attempt += 1) {
			exactOutcome = await runArrowCommandCensusReportWithDependencies(
				acceptedRequest(limit),
				{ repositoryRoot: root },
				dependencies()
			);
			expect(exactOutcome.outcome, JSON.stringify(exactOutcome)).toBe('partial');
			const measured = Buffer.byteLength(canonicalSemanticJson(exactOutcome), 'utf8') + 1;
			if (measured === limit) break;
			limit = measured;
		}
		expect(exactOutcome?.outcome).toBe('partial');
		expect(Buffer.byteLength(canonicalSemanticJson(exactOutcome), 'utf8') + 1).toBe(limit);

		const refused = await runArrowCommandCensusReportWithDependencies(
			acceptedRequest(limit - 1),
			{ repositoryRoot: root },
			dependencies()
		);
		expect(refused).toMatchObject({
			code: 'RESULT_BUDGET_EXCEEDED',
			outcome: 'unavailable',
			stage: 'RESULT',
			state: 'resource-refused'
		});
	});
});
