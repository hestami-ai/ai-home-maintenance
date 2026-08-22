import { Buffer } from 'node:buffer';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
	GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID,
	GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH,
	GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_DATA_PATH,
	GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
	type GuardEnforcementLedgerExecutorIdentity,
	type GuardEnforcementLedgerObservation,
	type GuardEnforcementLedgerRawEvidence,
	type ObserveGuardEnforcementLedgerOutcome
} from '../contracts/guard-enforcement-ledger.js';
import {
	GUARD_ENFORCEMENT_LEDGER_REPORT_ADDITIONAL_ARTIFACT_PATHS,
	GUARD_ENFORCEMENT_LEDGER_REPORT_EXECUTION_SELECTION,
	GUARD_ENFORCEMENT_LEDGER_REPORT_ADMISSION_LIMITS,
	GUARD_ENFORCEMENT_LEDGER_REPORT_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_REPORT_REQUEST_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_REPORT_SAFETY_CEILINGS,
	type GuardEnforcementLedgerReportRequest
} from '../contracts/guard-enforcement-ledger-report.js';
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
	buildGuardEnforcementLedgerArtifactSet,
	validateGuardEnforcementLedgerArtifactSet
} from '../providers/jpwb-guard-enforcement-ledger/artifact-set.js';
import {
	observeGuardEnforcementLedger,
	type GuardEnforcementLedgerProgressEvent
} from '../providers/jpwb-guard-enforcement-ledger/observe-guard-enforcement-ledger.js';
import { normalizeGuardEnforcementLedgerObservation } from '../providers/jpwb-guard-enforcement-ledger/normalize-guard-enforcement-ledger.js';
import { validateGuardEnforcementLedgerObservation } from '../providers/jpwb-guard-enforcement-ledger/validate-guard-enforcement-ledger.js';
import { GUARD_ENFORCEMENT_LEDGER_WORKER_RESULT_SCHEMA_VERSION } from '../providers/jpwb-guard-enforcement-ledger/worker.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import type { verifyFrozenSubject } from '../subject/freshness.js';
import type { resolveSubject } from '../subject/resolve-subject.js';
import {
	admitGuardEnforcementLedgerReportRequest,
	runGuardEnforcementLedgerReport,
	runGuardEnforcementLedgerReportWithDependencies,
	type GuardEnforcementLedgerReportProgressEvent,
	type GuardEnforcementLedgerReportRuntimeDependencies
} from './run-guard-enforcement-ledger-report.js';

const SYNTHETIC_SUBJECT_ID = 'subject:guard-enforcement-ledger-report-fixture';
const encoder = new TextEncoder();
const root = mkdtempSync(join(tmpdir(), 'csaa-guard-enforcement-ledger-report-'));
const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const projectPath = 'fixture/tsconfig.json';

const SYNTHETIC_SOURCES = new Map<string, string>([
	[
		'verif/guard-enforcement-ledger.ts',
		'export const guardedArrows = () => []; export const auditLedger = () => ({});\n'
	],
	[
		'verif/guard-enforcement-ledger.data.ts',
		`export const GUARD_LEDGER = {
	one: { disposition: 'ENFORCED', evidence: 'handler refusal', enforcingSite: 'packages/rph-application/src/handlers/execution.ts:1', enforcingAnchor: 'throw new Error' }
};\n`
	],
	['verif/guard-enforcement-ledger.test.ts', 'export const retainedOracle = true;\n'],
	[
		'packages/rph-domain/package.json',
		'{"exports":{".":"./src/index.ts"},"name":"@janumipwb/rph-domain","type":"module"}\n'
	],
	[
		'packages/rph-contracts/package.json',
		'{"exports":{".":"./src/index.ts"},"name":"@janumipwb/rph-contracts","type":"module"}\n'
	],
	['packages/rph-domain/src/index.ts', "export * from './transitions.data.js';\n"],
	[
		'packages/rph-domain/src/machine-exclusions.ts',
		'export const isExcludedMachine = () => false;\n'
	],
	[
		'packages/rph-domain/src/transitions.data.ts',
		'// GENERATED FILE — fixture\nexport const STATE_MACHINES = {};\n'
	],
	['packages/rph-contracts/src/index.ts', "export * from './ids.js';\n"],
	[
		'packages/rph-application/src/handlers/execution.ts',
		"export function execution() { throw new Error('guard a'); }\n"
	]
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
		budgets: GUARD_ENFORCEMENT_LEDGER_REPORT_SAFETY_CEILINGS.subject,
		expectEmpty: false,
		filters: { exclude: [], include: [] },
		operationVersion: GUARD_ENFORCEMENT_LEDGER_REPORT_OPERATION_VERSION,
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
			operationVersion: GUARD_ENFORCEMENT_LEDGER_REPORT_OPERATION_VERSION,
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
	maxResultBytes = GUARD_ENFORCEMENT_LEDGER_REPORT_SAFETY_CEILINGS.maxResultBytes
) {
	return {
		budgets: { ...GUARD_ENFORCEMENT_LEDGER_REPORT_SAFETY_CEILINGS, maxResultBytes },
		executionSelection: GUARD_ENFORCEMENT_LEDGER_REPORT_EXECUTION_SELECTION,
		operationVersion: GUARD_ENFORCEMENT_LEDGER_REPORT_OPERATION_VERSION,
		schemaVersion: GUARD_ENFORCEMENT_LEDGER_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: [projectPath]
	} satisfies GuardEnforcementLedgerReportRequest;
}

let subject: FrozenSubject;
let retainedOutcome: Exclude<
	ObserveGuardEnforcementLedgerOutcome,
	{ readonly outcome: 'unavailable' }
>;

beforeAll(() => {
	mkdirSync(dirname(join(root, projectPath)), { recursive: true });
	writeFileSync(join(root, projectPath), '{"compilerOptions":{},"files":[]}\n');
	subject = syntheticSubject();
	const artifactSetOutcome = buildGuardEnforcementLedgerArtifactSet(
		{
			budgets: GUARD_ENFORCEMENT_LEDGER_REPORT_SAFETY_CEILINGS.artifactSet,
			operationVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
			schemaVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
			subjectId: subject.descriptor.subjectId
		},
		{ subject }
	);
	if (artifactSetOutcome.outcome !== 'complete')
		throw new Error(JSON.stringify(artifactSetOutcome));
	const retainedAnalyzer = artifactSetOutcome.artifactSet.artifacts.find(
		(artifact) => artifact.path === GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH
	);
	const retainedData = artifactSetOutcome.artifactSet.artifacts.find(
		(artifact) => artifact.path === GUARD_ENFORCEMENT_LEDGER_DATA_PATH
	);
	if (retainedAnalyzer === undefined || retainedData === undefined)
		throw new Error('Synthetic retained guard-ledger sources are absent.');
	const fixtureSha = '0'.repeat(64);
	const executor: GuardEnforcementLedgerExecutorIdentity = {
		adapterId: GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID,
		adapterVersion: GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
		executableBytes: 1,
		executableSha256: fixtureSha,
		externalModules: [
			{ bytes: 1, contentDigest: fixtureSha, files: 1, name: 'typescript', version: '5.9.3' },
			{ bytes: 1, contentDigest: fixtureSha, files: 1, name: 'ulid', version: '2.4.0' },
			{ bytes: 1, contentDigest: fixtureSha, files: 1, name: 'zod', version: '4.4.3' }
		],
		retainedAnalyzerCanonicalPathKey: retainedAnalyzer.canonicalPathKey,
		retainedAnalyzerSha256: retainedAnalyzer.sha256,
		retainedDataCanonicalPathKey: retainedData.canonicalPathKey,
		retainedDataSha256: retainedData.sha256,
		runtime: 'bun',
		runtimeVersion: '1.3.14',
		worker: { bytes: 1, sha256: fixtureSha }
	};
	const evidence: GuardEnforcementLedgerRawEvidence = {
		analyzerPath: GUARD_ENFORCEMENT_LEDGER_ANALYZER_PATH,
		audit: {
			arrowCount: 1,
			counts: [{ count: 1, disposition: 'ENFORCED' }],
			enforcedAnchorBroken: [],
			enforcedWithoutSite: [],
			stale: [],
			textCount: 1,
			unclassified: []
		},
		dataPath: GUARD_ENFORCEMENT_LEDGER_DATA_PATH,
		guardTexts: ['guard a'],
		guardedArrows: [{ from: 'A0', guard: 'guard a', machine: 'Alpha', to: 'A1' }],
		ledgerRows: [
			{
				disposition: 'ENFORCED',
				enforcingAnchor: 'throw new Error',
				enforcingSite: 'packages/rph-application/src/handlers/execution.ts:1',
				evidence: 'handler refusal',
				guardText: 'guard a'
			}
		],
		runtime: { bunVersion: '1.3.14' },
		schemaVersion: GUARD_ENFORCEMENT_LEDGER_WORKER_RESULT_SCHEMA_VERSION
	};
	const observation = normalizeGuardEnforcementLedgerObservation({
		artifactSet: artifactSetOutcome.artifactSet,
		evidence,
		executor,
		request: {
			artifactSetId: artifactSetOutcome.artifactSet.id,
			budgets: GUARD_ENFORCEMENT_LEDGER_REPORT_SAFETY_CEILINGS.observation,
			operationVersion: GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
			schemaVersion: GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
			subjectId: subject.descriptor.subjectId
		},
		transportOutputBytes: encoder.encode('{"fixture":true}\n')
	});
	const validation = validateGuardEnforcementLedgerObservation(observation, subject);
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

function adapterEvent(
	details: Readonly<Record<string, unknown>>
): GuardEnforcementLedgerProgressEvent {
	return {
		adapterElapsedMs: 1,
		details,
		durationMs: 1,
		event: 'CSAA_GUARD_ENFORCEMENT_LEDGER_PHASE',
		phase: 'OBSERVATION_NORMALIZATION',
		schemaVersion: 'jan-csaa-guard-enforcement-ledger-progress/1.0.0',
		sequence: 1,
		state: 'COMPLETED',
		timestamp: '2026-01-01T00:00:00.000Z'
	};
}

function dependencies(
	overrides: Partial<GuardEnforcementLedgerReportRuntimeDependencies> = {}
): GuardEnforcementLedgerReportRuntimeDependencies {
	return {
		buildArtifactSet: buildGuardEnforcementLedgerArtifactSet,
		observeLedger: async (_request, _inputs, options) => {
			options?.onProgress?.(adapterEvent({ coverage: retainedOutcome.observation.coverage }));
			return retainedOutcome;
		},
		resolveSubject: (() => resolvedSubject()) as typeof resolveSubject,
		validateArtifactSet: validateGuardEnforcementLedgerArtifactSet,
		validateObservation: validateGuardEnforcementLedgerObservation,
		verifySubject: (() => currentSubject()) as typeof verifyFrozenSubject,
		...overrides
	};
}

describe('guard-enforcement-ledger report', () => {
	it('requires explicit acknowledgement of the side-effecting retained execution boundary', () => {
		const { executionSelection: _executionSelection, ...missing } = acceptedRequest();
		expect(admitGuardEnforcementLedgerReportRequest(missing)).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'rejected'
		});
		expect(
			admitGuardEnforcementLedgerReportRequest({
				...acceptedRequest(),
				executionSelection: 'RUN_WITHOUT_SIDE_EFFECTS'
			})
		).toMatchObject({ code: 'REQUEST_EXECUTION_SELECTION_UNSUPPORTED', outcome: 'rejected' });
	});

	it('publishes and enforces the exact project-path ceiling while rejecting hostile path text', () => {
		const atLimit = 'a'.repeat(
			GUARD_ENFORCEMENT_LEDGER_REPORT_ADMISSION_LIMITS.maxProjectPathCharacters
		);
		expect(
			admitGuardEnforcementLedgerReportRequest({
				...acceptedRequest(),
				subjectProjectConfigPaths: [atLimit]
			})
		).toMatchObject({ outcome: 'admitted', request: { subjectProjectConfigPaths: [atLimit] } });
		expect(
			admitGuardEnforcementLedgerReportRequest({
				...acceptedRequest(),
				subjectProjectConfigPaths: [`${atLimit}a`]
			})
		).toMatchObject({ code: 'REQUEST_PATH_BUDGET_EXCEEDED', outcome: 'rejected' });
		for (const hostilePath of ['fixture/*.json', 'fixture/\u0000.json', 'fixture/\ud800.json']) {
			expect(
				admitGuardEnforcementLedgerReportRequest({
					...acceptedRequest(),
					subjectProjectConfigPaths: [hostilePath]
				})
			).toMatchObject({ code: 'REQUEST_PATH_INVALID', outcome: 'rejected' });
		}
	});

	it.runIf(process.env.CSAA_GUARD_ENFORCEMENT_LEDGER_REPORT_INTEGRATION === '1')(
		'runs the public facade with production dependencies against the current repository',
		async () => {
			const progress: GuardEnforcementLedgerReportProgressEvent[] = [];
			const outcome = await runGuardEnforcementLedgerReport(
				{
					budgets: GUARD_ENFORCEMENT_LEDGER_REPORT_SAFETY_CEILINGS,
					executionSelection: GUARD_ENFORCEMENT_LEDGER_REPORT_EXECUTION_SELECTION,
					operationVersion: GUARD_ENFORCEMENT_LEDGER_REPORT_OPERATION_VERSION,
					schemaVersion: GUARD_ENFORCEMENT_LEDGER_REPORT_REQUEST_SCHEMA_VERSION,
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
				retainedLedger: { outcome: 'complete' },
				subject: { outcome: 'resolved' }
			});
			expect(outcome.result.coverage.reconciles).toBe(true);
			expect(outcome.result.coverage.classifiedGuardTexts).toBeGreaterThan(0);
			expect(outcome.result.evidence.observation.guardedArrows.length).toBeGreaterThan(0);
			expect(outcome.result.evidence.observation.guards.length).toBeGreaterThan(0);
			expect(progress.some((event) => event.kind === 'RETAINED_ADAPTER')).toBe(true);
			for (const phase of [
				'REQUEST_BIND',
				'SUBJECT_CAPTURE',
				'ARTIFACT_SET',
				'RETAINED_LEDGER',
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
		const progress: GuardEnforcementLedgerReportProgressEvent[] = [];
		const outcome = await runGuardEnforcementLedgerReportWithDependencies(
			acceptedRequest(),
			{
				onProgress(event) {
					progress.push(event);
					if (event.kind === 'RETAINED_ADAPTER') {
						const coverage = event.adapterProgress?.details.coverage as
							{ arrowOccurrences?: number } | undefined;
						if (coverage !== undefined) coverage.arrowOccurrences = 999;
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
					id: 'guard-enforcement-ledger',
					registryStatus: 'IMPLEMENTATION_LOCAL_UNREGISTERED',
					status: 'PARTIAL',
					verifierAuthority: 'RETAINED_DELEGATED'
				},
				coverage: {
					arrowOccurrences: 1,
					classifiedGuardTexts: 1,
					distinctGuardTexts: 1,
					ledgerRows: 1,
					staleLedgerRows: 0,
					unclassifiedGuardTexts: 0
				},
				currentness: { state: 'CURRENT_FOR_CAPTURED_SUBJECT' }
			}
		});
		expect(outcome.result.evidence.observation.guardedArrows).toEqual([
			expect.objectContaining({ from: 'A0', guardText: 'guard a', machine: 'Alpha', to: 'A1' })
		]);
		expect(
			validateGuardEnforcementLedgerObservation(outcome.result.evidence.observation, subject)
		).toEqual({
			issues: [],
			state: 'VALID'
		});
		expect(progress.some((event) => event.kind === 'RETAINED_ADAPTER')).toBe(true);
		for (const phase of [
			'REQUEST_BIND',
			'SUBJECT_CAPTURE',
			'ARTIFACT_SET',
			'RETAINED_LEDGER',
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

	it('binds subject capture and retained observation to the exact admitted request and FrozenSubject', async () => {
		let capturedSubjectRequest: Parameters<typeof resolveSubject>[0] | undefined;
		let capturedObservationRequest: Parameters<typeof observeGuardEnforcementLedger>[0] | undefined;
		let capturedObservationInputs: Parameters<typeof observeGuardEnforcementLedger>[1] | undefined;
		const request = acceptedRequest();
		const outcome = await runGuardEnforcementLedgerReportWithDependencies(
			request,
			{ repositoryRoot: root },
			dependencies({
				observeLedger: async (observerRequest, inputs) => {
					capturedObservationRequest = observerRequest;
					capturedObservationInputs = inputs;
					return retainedOutcome;
				},
				resolveSubject: ((subjectRequest: Parameters<typeof resolveSubject>[0]) => {
					capturedSubjectRequest = subjectRequest;
					return resolvedSubject();
				}) as typeof resolveSubject
			})
		);
		expect(outcome.outcome).toBe('partial');
		expect(capturedSubjectRequest).toMatchObject({
			budgets: request.budgets.subject,
			scope: {
				additionalArtifacts: GUARD_ENFORCEMENT_LEDGER_REPORT_ADDITIONAL_ARTIFACT_PATHS,
				kind: 'EXPLICIT_PROJECTS',
				projects: [projectPath]
			}
		});
		expect(capturedObservationRequest).toEqual({
			artifactSetId: retainedOutcome.observation.artifactSet.id,
			budgets: request.budgets.observation,
			operationVersion: GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
			schemaVersion: GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
			subjectId: subject.descriptor.subjectId
		});
		expect(capturedObservationInputs?.artifactSet).toEqual(retainedOutcome.observation.artifactSet);
		expect(capturedObservationInputs?.subject).toBe(subject);
	});

	it('awaits the retained observer before currentness and terminal evidence', async () => {
		let release!: (value: ObserveGuardEnforcementLedgerOutcome) => void;
		const deferred = new Promise<ObserveGuardEnforcementLedgerOutcome>((resolve) => {
			release = resolve;
		});
		let settled = false;
		const running = runGuardEnforcementLedgerReportWithDependencies(
			acceptedRequest(),
			{ repositoryRoot: root },
			dependencies({ observeLedger: (() => deferred) as typeof observeGuardEnforcementLedger })
		).then((outcome) => {
			settled = true;
			return outcome;
		});
		await Promise.resolve();
		expect(settled).toBe(false);
		release(retainedOutcome);
		expect((await running).outcome).toBe('partial');
	});

	it('preserves a partial audit-hole observation and classifies provider budget refusal', async () => {
		const partialEvidence: GuardEnforcementLedgerRawEvidence = {
			...retainedOutcome.observation.rawEvidence,
			audit: {
				...retainedOutcome.observation.rawEvidence.audit,
				arrowCount: 2,
				textCount: 2,
				unclassified: ['guard b']
			},
			guardTexts: ['guard a', 'guard b'],
			guardedArrows: [
				...retainedOutcome.observation.rawEvidence.guardedArrows,
				{ from: 'A1', guard: 'guard b', machine: 'Alpha', to: 'A2' }
			]
		};
		const partialObservation = normalizeGuardEnforcementLedgerObservation({
			artifactSet: retainedOutcome.observation.artifactSet,
			evidence: partialEvidence,
			executor: retainedOutcome.observation.executor,
			request: {
				artifactSetId: retainedOutcome.observation.artifactSet.id,
				budgets: retainedOutcome.observation.budgets,
				operationVersion: GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
				schemaVersion: GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
				subjectId: retainedOutcome.observation.subjectId
			},
			transportOutputBytes: encoder.encode('{"fixture":"partial"}\n')
		});
		expect(partialObservation.coverage.unclassifiedGuardTexts).toBe(1);
		const auditPartial: ObserveGuardEnforcementLedgerOutcome = {
			diagnostics: [],
			observation: partialObservation,
			outcome: 'partial'
		};
		const partial = await runGuardEnforcementLedgerReportWithDependencies(
			acceptedRequest(),
			{ repositoryRoot: root },
			dependencies({
				observeLedger: (async () => auditPartial) as typeof observeGuardEnforcementLedger
			})
		);
		expect(partial).toMatchObject({
			outcome: 'partial',
			result: { coverage: { unclassifiedGuardTexts: 1 } },
			stageOutcomes: {
				retainedLedger: { diagnosticCodes: [], outcome: 'partial' }
			}
		});

		const refused = await runGuardEnforcementLedgerReportWithDependencies(
			acceptedRequest(),
			{ repositoryRoot: root },
			dependencies({
				observeLedger: (async () => ({
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
				})) as typeof observeGuardEnforcementLedger
			})
		);
		expect(refused).toMatchObject({
			diagnostics: [{ path: '$.budgets.observation.maxStdoutBytes' }],
			outcome: 'unavailable',
			stage: 'RETAINED_LEDGER',
			state: 'resource-refused'
		});
		const aggregateRefused = await runGuardEnforcementLedgerReportWithDependencies(
			acceptedRequest(),
			{ repositoryRoot: root },
			dependencies({
				observeLedger: (async () => ({
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
				})) as typeof observeGuardEnforcementLedger
			})
		);
		expect(aggregateRefused).toMatchObject({
			diagnostics: [{ path: '$.budgets.observation' }],
			outcome: 'unavailable',
			state: 'resource-refused'
		});
	});

	it('rejects a contradictory partial envelope that the retained provider cannot emit', async () => {
		const contradictory = await runGuardEnforcementLedgerReportWithDependencies(
			acceptedRequest(),
			{ repositoryRoot: root },
			dependencies({
				observeLedger: (async () => ({
					diagnostics: [],
					observation: retainedOutcome.observation,
					outcome: 'partial'
				})) as typeof observeGuardEnforcementLedger
			})
		);
		expect(contradictory).toMatchObject({
			code: 'EVIDENCE_IDENTITY_MISMATCH',
			outcome: 'unavailable',
			stage: 'RETAINED_LEDGER',
			state: 'failed'
		});
	});

	it('drops over-budget repository-relative diagnostic paths from terminal evidence', async () => {
		const outcome = await runGuardEnforcementLedgerReportWithDependencies(
			acceptedRequest(),
			{ repositoryRoot: root },
			dependencies({
				observeLedger: (async () => ({
					diagnostics: [
						{
							code: 'EXECUTOR_FAILED',
							message: 'Synthetic executor failure.',
							path: 'a'.repeat(
								GUARD_ENFORCEMENT_LEDGER_REPORT_ADMISSION_LIMITS.maxDiagnosticPathCharacters + 1
							),
							phase: 'EXECUTE',
							severity: 'ERROR'
						}
					],
					outcome: 'unavailable'
				})) as typeof observeGuardEnforcementLedger
			})
		);
		expect(outcome).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'EXECUTOR_FAILED', path: null })],
			outcome: 'unavailable',
			stage: 'RETAINED_LEDGER'
		});
	});

	it('bounds and attributes independent artifact-set validation diagnostics', async () => {
		let receivedMaxIssues: number | undefined;
		const request = acceptedRequest();
		const outcome = await runGuardEnforcementLedgerReportWithDependencies(
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
				}) as typeof validateGuardEnforcementLedgerArtifactSet
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
		const invalid = await runGuardEnforcementLedgerReportWithDependencies(
			acceptedRequest(),
			{ repositoryRoot: root },
			dependencies({
				validateObservation: (() => ({
					issues: [
						{ code: 'IDENTITY_MISMATCH', message: 'Synthetic invalid observation.', path: '$.id' }
					],
					state: 'INVALID'
				})) as typeof validateGuardEnforcementLedgerObservation
			})
		);
		expect(invalid).toMatchObject({
			code: 'OBSERVATION_VALIDATION_FAILED',
			diagnostics: expect.arrayContaining([
				expect.objectContaining({ path: '$.id', source: 'RETAINED_LEDGER' })
			]),
			outcome: 'unavailable',
			stage: 'RETAINED_LEDGER',
			state: 'failed'
		});
	});

	it.each([
		[
			'verifier authority',
			(observation: GuardEnforcementLedgerObservation) => ({
				...observation,
				verifierAuthority: 'FORGED_AUTHORITY' as never
			})
		],
		[
			'oracle change',
			(observation: GuardEnforcementLedgerObservation) => ({
				...observation,
				oracleChange: 'FORGED_ORACLE_CHANGE' as never
			})
		],
		[
			'replacement equivalence',
			(observation: GuardEnforcementLedgerObservation) => ({
				...observation,
				replacementEquivalence: 'FORGED_REPLACEMENT_EQUIVALENCE' as never
			})
		],
		[
			'integration strategy',
			(observation: GuardEnforcementLedgerObservation) => ({
				...observation,
				integrationStrategy: 'FORGED_INTEGRATION_STRATEGY' as never
			})
		],
		[
			'baseline change boundary',
			(observation: GuardEnforcementLedgerObservation) => ({
				...observation,
				baselineChange: 'FORGED_BASELINE_CHANGE' as never
			})
		],
		[
			'runtime-enforcement boundary',
			(observation: GuardEnforcementLedgerObservation) => ({
				...observation,
				runtimeEnforcement: 'CLAIMED' as never
			})
		],
		[
			'retained-test execution boundary',
			(observation: GuardEnforcementLedgerObservation) => ({
				...observation,
				retainedTestExecution: 'EXECUTED_BY_CSAA' as never
			})
		],
		[
			'executor adapter identity',
			(observation: GuardEnforcementLedgerObservation) => ({
				...observation,
				executor: { ...observation.executor, adapterId: 'forged-adapter' as never }
			})
		],
		[
			'executor retained-analyzer identity',
			(observation: GuardEnforcementLedgerObservation) => ({
				...observation,
				executor: { ...observation.executor, retainedAnalyzerSha256: 'f'.repeat(64) }
			})
		],
		[
			'executor retained-data identity',
			(observation: GuardEnforcementLedgerObservation) => ({
				...observation,
				executor: { ...observation.executor, retainedDataSha256: 'e'.repeat(64) }
			})
		]
	] as const)(
		'rejects forged %s even when a trust-bound validator falsely reports VALID',
		async (_label, forge) => {
			const forged = await runGuardEnforcementLedgerReportWithDependencies(
				acceptedRequest(),
				{ repositoryRoot: root },
				dependencies({
					observeLedger: (async () => ({
						diagnostics: [],
						observation: forge(retainedOutcome.observation),
						outcome: 'complete'
					})) as typeof observeGuardEnforcementLedger,
					validateObservation: (() => ({
						issues: [],
						state: 'VALID'
					})) as typeof validateGuardEnforcementLedgerObservation
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
			const outcome = await runGuardEnforcementLedgerReportWithDependencies(
				acceptedRequest(),
				{ repositoryRoot: root },
				dependencies({ verifySubject: (() => freshness) as typeof verifyFrozenSubject })
			);
			expect(outcome).toMatchObject({
				outcome: 'partial',
				result: { coverage: { arrowOccurrences: 1 }, currentness: { state: expected } }
			});
		}
	);

	it('admits the exact serialized terminal size and refuses one byte below it', async () => {
		let limit = GUARD_ENFORCEMENT_LEDGER_REPORT_SAFETY_CEILINGS.maxResultBytes;
		let exactOutcome;
		for (let attempt = 0; attempt < 8; attempt += 1) {
			exactOutcome = await runGuardEnforcementLedgerReportWithDependencies(
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

		const refused = await runGuardEnforcementLedgerReportWithDependencies(
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
