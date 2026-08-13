import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS,
	CALL_GRAPH_OPERATION_VERSION,
	CALL_GRAPH_REQUEST_SCHEMA_VERSION,
	COMMAND_HANDLER_GRAPH_OPERATION_VERSION,
	COMMAND_HANDLER_GRAPH_REQUEST_SCHEMA_VERSION,
	COMMAND_DISPATCH_TOPOLOGY_OPERATION_VERSION,
	COMMAND_DISPATCH_TOPOLOGY_REQUEST_SCHEMA_VERSION,
	COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH,
	GUARD_CLASSIFICATION_OVERLAY_OPERATION_VERSION,
	GUARD_CLASSIFICATION_OVERLAY_REQUEST_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS,
	DEPENDENCY_CRUISER_INVOCATION_SCHEMA_VERSION,
	DEPENDENCY_CRUISER_ARGV_GRAMMAR_VERSION,
	DEPENDENCY_CRUISER_PROVIDER_ID,
	DEPENDENCY_CRUISER_PROVIDER_VERSION,
	DEPENDENCY_CRUISER_RAW_SCHEMA_ID,
	DEPENDENCY_PROVIDER_COMPARISON_OPERATION_VERSION,
	DEPENDENCY_PROVIDER_COMPARISON_REQUEST_SCHEMA_VERSION,
	FULL_JAN_CSAA_CAPABILITY_007_DATA_FLOW,
	MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
	MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
	READ_WRITE_ACCESS_GRAPH_OPERATION_VERSION,
	READ_WRITE_ACCESS_GRAPH_REQUEST_SCHEMA_VERSION,
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	STATE_MACHINE_GRAPH_OPERATION_VERSION,
	STATE_MACHINE_GRAPH_REQUEST_SCHEMA_VERSION,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_REQUEST_SCHEMA_VERSION,
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	type ModuleDependencyGraphSnapshot,
	type BuildStateMachineGraphRequest,
	type GuardEnforcementLedgerObservation,
	type StateMachineGraphSnapshot,
	type StateMachineTopologyObservation,
	type SemanticCapability,
	type StaticSemanticSnapshotProgressEvent,
	type ResolveSubjectRequest,
	buildCallGraph,
	buildCommandHandlerGraph,
	buildCommandDispatchTopology,
	buildGuardClassificationOverlay,
	buildGuardEnforcementLedgerArtifactSet,
	buildArrowCommandCensusArtifactSet,
	buildModuleDependencyGraph,
	buildReadWriteAccessGraph,
	buildStaticSemanticSnapshot,
	buildStateMachineGraph,
	canonicalSemanticJson,
	canonicalSemanticJsonWitness,
	compareDependencyProviders,
	normalizeDependencyCruiserOutput,
	observeArrowCommandCensus,
	observeGuardEnforcementLedger,
	observeStateMachineTopology,
	resolveSubject,
	selectJpwbCommandHandlerRegistries,
	selectJpwbCommandDispatchTopology,
	sha256,
	validateDependencyCruiserObservation,
	validateDependencyProviderComparison,
	validateArrowCommandCensusObservation,
	validateCommandHandlerGraph,
	validateCommandDispatchTopology,
	validateGuardClassificationOverlay,
	validateGuardEnforcementLedgerObservation,
	validateModuleDependencyGraph,
	validateReadWriteAccessGraph,
	validateStateMachineGraph,
	validateStateMachineTopologyObservation,
	validateStaticSemanticSnapshot
} from '@janumipwb/csaa';

const SMOKE_SELECTOR = process.env.CSAA_REPOSITORY_SMOKE;
type RepositorySmokeProfile = 'FULL' | 'STRUCTURAL';
type RepositorySmokeSuite = 'COMMAND_HANDLER_ONLY' | 'FULL_SUITE';

interface RepositorySmokeProjectionPlan {
	readonly runIndependentSemanticRevalidation: boolean;
	readonly runCallGraph: boolean;
	readonly runDependencyProviderComparison: boolean;
	readonly runGuardClassificationOverlay: boolean;
	readonly runModuleDependencyGraph: boolean;
	readonly runReadWriteAccessGraph: boolean;
	readonly runRepositoryDiscoveryPreflight: boolean;
	readonly runStateMachineProjection: boolean;
	readonly suite: RepositorySmokeSuite;
}

const REPOSITORY_SMOKE_PROJECTION_PLANS: Readonly<
	Record<RepositorySmokeSuite, RepositorySmokeProjectionPlan>
> = {
	COMMAND_HANDLER_ONLY: {
		runIndependentSemanticRevalidation: false,
		runCallGraph: false,
		runDependencyProviderComparison: false,
		runGuardClassificationOverlay: true,
		runModuleDependencyGraph: false,
		runReadWriteAccessGraph: false,
		runRepositoryDiscoveryPreflight: false,
		runStateMachineProjection: true,
		suite: 'COMMAND_HANDLER_ONLY'
	},
	FULL_SUITE: {
		runIndependentSemanticRevalidation: true,
		runCallGraph: true,
		runDependencyProviderComparison: true,
		runGuardClassificationOverlay: false,
		runModuleDependencyGraph: true,
		runReadWriteAccessGraph: true,
		runRepositoryDiscoveryPreflight: true,
		runStateMachineProjection: true,
		suite: 'FULL_SUITE'
	}
};

function repositorySmokeProfile(value: string | undefined): RepositorySmokeProfile {
	if (value === undefined || value.trim() === '') return 'FULL';
	const normalized = value.trim().toUpperCase();
	if (normalized === 'FULL' || normalized === 'STRUCTURAL') return normalized;
	throw new Error(`Unsupported CSAA_REPOSITORY_SMOKE_PROFILE: ${value}`);
}

function repositorySmokeSuite(value: string | undefined): RepositorySmokeSuite {
	if (value === undefined || value.trim() === '') return 'FULL_SUITE';
	const normalized = value.trim().toUpperCase();
	if (normalized === 'COMMAND_HANDLER' || normalized === 'COMMAND_HANDLER_ONLY')
		return 'COMMAND_HANDLER_ONLY';
	if (normalized === 'FULL' || normalized === 'FULL_SUITE') return 'FULL_SUITE';
	throw new Error(`Unsupported CSAA_REPOSITORY_SMOKE_SUITE: ${value}`);
}

function assertRepositorySmokeSelection(
	profile: RepositorySmokeProfile,
	suite: RepositorySmokeSuite,
	selector: string | undefined
): void {
	if (suite !== 'COMMAND_HANDLER_ONLY') return;
	if (profile !== 'STRUCTURAL')
		throw new Error('COMMAND_HANDLER_ONLY requires CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL.');
	if (selector !== '1') throw new Error('COMMAND_HANDLER_ONLY requires CSAA_REPOSITORY_SMOKE=1.');
}

function semanticCapabilitiesForProfile(
	profile: RepositorySmokeProfile
): readonly SemanticCapability[] {
	return profile === 'FULL'
		? ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX', 'TS_TYPE']
		: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'];
}

const SMOKE_PROFILE = repositorySmokeProfile(process.env.CSAA_REPOSITORY_SMOKE_PROFILE);
const SMOKE_SUITE = repositorySmokeSuite(process.env.CSAA_REPOSITORY_SMOKE_SUITE);
const SMOKE_PROJECTION_PLAN = REPOSITORY_SMOKE_PROJECTION_PLANS[SMOKE_SUITE];
assertRepositorySmokeSelection(SMOKE_PROFILE, SMOKE_SUITE, SMOKE_SELECTOR);
const SEMANTIC_CAPABILITIES = semanticCapabilitiesForProfile(SMOKE_PROFILE);
const RUN_REPOSITORY_SMOKE =
	SMOKE_SELECTOR !== undefined && SMOKE_SELECTOR !== '' && SMOKE_SELECTOR !== '0';
// Provisional runaway guards required by the budgeted APIs and test runner for this opt-in
// smoke. They are not empirically established operating ceilings, product defaults, SLOs, or
// acceptance targets. Snapshot bytes are canonical JSON UTF-8 bytes; semantic duration is
// observed at phase checkpoints rather than by cancelling computation at an exact instant.
const REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES = 1_000_000_000;
const REPOSITORY_SMOKE_FAILSAFE_SUBJECT_DURATION_MS = 180_000;
const REPOSITORY_SMOKE_FAILSAFE_SUBJECT_FILES = 100_000;
const REPOSITORY_SMOKE_FAILSAFE_SUBJECT_PROJECTS = 200;
const REPOSITORY_SMOKE_FAILSAFE_SUBJECT_CONFIG_DEPTH = 64;
const REPOSITORY_SMOKE_FAILSAFE_SEMANTIC_DURATION_MS = 3_600_000;
const REPOSITORY_SMOKE_FAILSAFE_SNAPSHOT_BYTES = 1_000_000_000;
const REPOSITORY_SMOKE_FAILSAFE_PROVIDER_DURATION_MS = 300_000;
// Two subject resolutions, the semantic build, two provider processes, and five minutes for
// graph projection, validation, failure reporting, and cleanup. This is a test-runner guard,
// not an empirical product ceiling or SLO.
const REPOSITORY_SMOKE_FAILSAFE_TEST_TIMEOUT_MS =
	REPOSITORY_SMOKE_FAILSAFE_SUBJECT_DURATION_MS * 2 +
	REPOSITORY_SMOKE_FAILSAFE_SEMANTIC_DURATION_MS +
	REPOSITORY_SMOKE_FAILSAFE_PROVIDER_DURATION_MS * 2 +
	300_000;
// Historical three-project representative slice used by the FULL smoke profile.
const REPRESENTATIVE_PROJECTS = [
	'packages/rph-application/tsconfig.json',
	'packages/rph-contracts/tsconfig.json',
	'packages/rph-domain/tsconfig.json'
] as const;
const COMMAND_HANDLER_COMPILER_CLOSURE_PROJECTS = [
	'packages/rph-application/tsconfig.json',
	'packages/rph-assurance/tsconfig.json',
	'packages/rph-contracts/tsconfig.json',
	'packages/rph-domain/tsconfig.json',
	'packages/rph-persistence/tsconfig.json',
	'packages/rph-ports/tsconfig.json',
	'packages/rph-projections/tsconfig.json'
] as const;
const SELECTED_PROJECTS =
	SMOKE_SELECTOR === 'all'
		? null
		: SMOKE_SELECTOR === undefined || SMOKE_SELECTOR === '1'
			? SMOKE_PROFILE === 'STRUCTURAL'
				? COMMAND_HANDLER_COMPILER_CLOSURE_PROJECTS
				: REPRESENTATIVE_PROJECTS
			: SMOKE_SELECTOR.split(',')
					.map((path) => path.trim())
					.filter((path) => path.length > 0);
const USE_COMMON_COMMAND_HANDLER_SUBJECT =
	SMOKE_PROFILE === 'STRUCTURAL' &&
	SELECTED_PROJECTS !== null &&
	SELECTED_PROJECTS.length === COMMAND_HANDLER_COMPILER_CLOSURE_PROJECTS.length &&
	COMMAND_HANDLER_COMPILER_CLOSURE_PROJECTS.every(
		(path, index) => SELECTED_PROJECTS[index] === path
	);
const COMMAND_ANALYSIS_RETAINED_ARTIFACTS = [
	...ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS,
	...GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS,
	COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH
] as const;
const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

const REPOSITORY_SMOKE_TELEMETRY_SCHEMA_VERSION =
	'jan-csaa-repository-smoke-telemetry/1.2.0' as const;

type RepositorySmokePhase =
	| 'ARROW_COMMAND_CENSUS_ARTIFACT_SET_BINDING'
	| 'ARROW_COMMAND_CENSUS_OBSERVATION'
	| 'ARROW_COMMAND_CENSUS_SUBJECT_SELECTION'
	| 'ARROW_COMMAND_CENSUS_VALIDATE_AND_SERIALIZE'
	| 'CALL_GRAPH'
	| 'COMMAND_HANDLER_STATIC_PROJECTION'
	| 'COMMAND_DISPATCH_STATIC_TOPOLOGY'
	| 'GUARD_CLASSIFICATION_STATIC_OVERLAY'
	| 'GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_BINDING'
	| 'GUARD_ENFORCEMENT_LEDGER_OBSERVATION'
	| 'GUARD_ENFORCEMENT_LEDGER_VALIDATE_AND_SERIALIZE'
	| 'DEPENDENCY_CRUISER_EXECUTION'
	| 'DEPENDENCY_CRUISER_NORMALIZATION'
	| 'DEPENDENCY_PROVIDER_COMPARISON'
	| 'MODULE_DEPENDENCY_GRAPH'
	| 'READ_WRITE_ACCESS_GRAPH'
	| 'REPOSITORY_DISCOVERY_PREFLIGHT'
	| 'SELECTED_SUBJECT_RESOLUTION'
	| 'STATE_MACHINE_GRAPH_PROJECTION'
	| 'STATE_MACHINE_TOPOLOGY_OBSERVATION'
	| 'STATIC_SEMANTIC_SNAPSHOT_BUILD'
	| 'STATIC_SEMANTIC_SNAPSHOT_VALIDATE_AND_SERIALIZE';

interface RepositorySmokeTelemetryOptions {
	/** Deterministic test clock; one sample supplies both wall and monotonic values. */
	readonly now?: () => number;
	readonly write?: (line: string) => void;
}

function redactTelemetryPath(text: string, path: string, replacement: string): string {
	const pattern = path
		.split(/[\\/]+/u)
		.map((part) => part.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
		.join('[\\\\/]');
	return pattern.length === 0 ? text : text.replace(new RegExp(pattern, 'giu'), replacement);
}

function sanitizeTelemetryText(text: string): string {
	return redactTelemetryPath(
		redactTelemetryPath(
			redactTelemetryPath(text, REPOSITORY_ROOT, '<repository-root>'),
			tmpdir(),
			'<temporary-root>'
		),
		process.execPath,
		'<process-executable>'
	).slice(0, 4_096);
}

function errorTelemetry(error: unknown): { readonly message: string; readonly name: string } {
	if (error instanceof Error)
		return { message: sanitizeTelemetryText(error.message), name: error.name };
	try {
		return { message: sanitizeTelemetryText(String(error)), name: typeof error };
	} catch {
		return { message: '<unprintable thrown value>', name: typeof error };
	}
}

function createRepositorySmokeTelemetry(
	details: Readonly<Record<string, unknown>>,
	options: RepositorySmokeTelemetryOptions = {}
) {
	const readTimes = (): { readonly monotonicMs: number; readonly wallMs: number } => {
		if (options.now !== undefined) {
			const value = options.now();
			return { monotonicMs: value, wallMs: value };
		}
		return { monotonicMs: performance.now(), wallMs: Date.now() };
	};
	const write = options.write ?? ((line: string): void => void process.stdout.write(line));
	const runStarted = readTimes();
	let sequence = 0;
	let active: {
		readonly details: Readonly<Record<string, unknown>>;
		readonly name: RepositorySmokePhase;
		readonly startedAtMonotonicMs: number;
	} | null = null;
	let ended = false;
	const completed: Array<{ readonly durationMs: number; readonly phase: RepositorySmokePhase }> =
		[];
	const skipped: RepositorySmokePhase[] = [];
	const emit = (event: Readonly<Record<string, unknown>>): void => {
		write(
			`${JSON.stringify({ schemaVersion: REPOSITORY_SMOKE_TELEMETRY_SCHEMA_VERSION, sequence, ...event })}\n`
		);
		sequence += 1;
	};
	const phaseDurationsMs = (): Readonly<Record<string, number>> =>
		Object.fromEntries(completed.map((entry) => [entry.phase, entry.durationMs]));
	emit({
		details,
		event: 'CSAA_REPOSITORY_SMOKE_RUN',
		runElapsedMs: 0,
		state: 'STARTED',
		timestamp: new Date(runStarted.wallMs).toISOString()
	});
	return {
		complete(completionDetails: Readonly<Record<string, unknown>> = {}): void {
			if (active === null) throw new Error('Repository smoke telemetry has no active phase.');
			const finishedAt = readTimes();
			const durationMs = Math.max(
				0,
				Math.round(finishedAt.monotonicMs - active.startedAtMonotonicMs)
			);
			completed.push({ durationMs, phase: active.name });
			emit({
				details: completionDetails,
				durationMs,
				event: 'CSAA_REPOSITORY_SMOKE_PHASE',
				phase: active.name,
				runElapsedMs: Math.max(0, Math.round(finishedAt.monotonicMs - runStarted.monotonicMs)),
				state: 'COMPLETED',
				timestamp: new Date(finishedAt.wallMs).toISOString()
			});
			active = null;
		},
		fail(error: unknown): void {
			if (ended) return;
			const failedAt = readTimes();
			const failedPhase = active?.name ?? null;
			if (active !== null)
				emit({
					details: active.details,
					durationMs: Math.max(0, Math.round(failedAt.monotonicMs - active.startedAtMonotonicMs)),
					error: errorTelemetry(error),
					event: 'CSAA_REPOSITORY_SMOKE_PHASE',
					phase: active.name,
					runElapsedMs: Math.max(0, Math.round(failedAt.monotonicMs - runStarted.monotonicMs)),
					state: 'FAILED',
					timestamp: new Date(failedAt.wallMs).toISOString()
				});
			active = null;
			emit({
				error: errorTelemetry(error),
				event: 'CSAA_REPOSITORY_SMOKE_RUN',
				failedPhase,
				phaseDurationsMs: phaseDurationsMs(),
				runElapsedMs: Math.max(0, Math.round(failedAt.monotonicMs - runStarted.monotonicMs)),
				state: 'FAILED',
				timestamp: new Date(failedAt.wallMs).toISOString()
			});
			ended = true;
		},
		finish(completionDetails: Readonly<Record<string, unknown>> = {}): void {
			if (active !== null)
				throw new Error(`Repository smoke phase ${active.name} is still active.`);
			if (ended) throw new Error('Repository smoke telemetry has already ended.');
			const finishedAt = readTimes();
			emit({
				details: completionDetails,
				event: 'CSAA_REPOSITORY_SMOKE_RUN',
				phaseDurationsMs: phaseDurationsMs(),
				runElapsedMs: Math.max(0, Math.round(finishedAt.monotonicMs - runStarted.monotonicMs)),
				state: 'COMPLETED',
				timestamp: new Date(finishedAt.wallMs).toISOString()
			});
			ended = true;
		},
		phaseDurationsMs,
		skip(name: RepositorySmokePhase, skipDetails: Readonly<Record<string, unknown>>): void {
			if (active !== null)
				throw new Error(`Repository smoke phase ${active.name} is still active.`);
			if (ended) throw new Error('Repository smoke telemetry has already ended.');
			const skippedAt = readTimes();
			skipped.push(name);
			emit({
				details: skipDetails,
				durationMs: 0,
				event: 'CSAA_REPOSITORY_SMOKE_PHASE',
				phase: name,
				runElapsedMs: Math.max(0, Math.round(skippedAt.monotonicMs - runStarted.monotonicMs)),
				state: 'SKIPPED',
				timestamp: new Date(skippedAt.wallMs).toISOString()
			});
		},
		skippedPhases(): readonly RepositorySmokePhase[] {
			return [...skipped];
		},
		start(name: RepositorySmokePhase, phaseDetails: Readonly<Record<string, unknown>> = {}): void {
			if (active !== null)
				throw new Error(`Repository smoke phase ${active.name} is still active.`);
			if (ended) throw new Error('Repository smoke telemetry has already ended.');
			const startedAt = readTimes();
			active = { details: phaseDetails, name, startedAtMonotonicMs: startedAt.monotonicMs };
			emit({
				details: phaseDetails,
				event: 'CSAA_REPOSITORY_SMOKE_PHASE',
				phase: name,
				runElapsedMs: Math.max(0, Math.round(startedAt.monotonicMs - runStarted.monotonicMs)),
				state: 'STARTED',
				timestamp: new Date(startedAt.wallMs).toISOString()
			});
		}
	};
}

function providerInputPaths(projectPaths: readonly string[]): string[] {
	if (SELECTED_PROJECTS === null) return ['apps', 'packages'];
	return [
		...new Set(
			projectPaths.map((path) => {
				const separator = path.lastIndexOf('/');
				return separator < 0 ? path : path.slice(0, separator);
			})
		)
	].sort();
}

function resolveSmokeSubject(scope: ResolveSubjectRequest['scope']) {
	return resolveSubject({
		budgets: {
			maxBytes: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES,
			maxConfigDepth: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_CONFIG_DEPTH,
			maxDiagnostics: 100_000,
			maxDurationMs: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_DURATION_MS,
			maxFiles: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_FILES,
			maxProjects: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_PROJECTS
		},
		expectEmpty: false,
		filters: { exclude: [], include: [] },
		operationVersion: 'jan-csaa-repository-smoke/1.0.0',
		outputs: [],
		policyVersion: SUBJECT_POLICY_VERSION,
		rootLocator: REPOSITORY_ROOT,
		schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
		scope,
		subjectKind: 'WORKTREE'
	});
}

describe('repository smoke phase telemetry', () => {
	it('selects an explicit structural profile without changing the full default', () => {
		expect(repositorySmokeProfile(undefined)).toBe('FULL');
		expect(repositorySmokeProfile('')).toBe('FULL');
		expect(repositorySmokeProfile(' structural ')).toBe('STRUCTURAL');
		expect(() => repositorySmokeProfile('unknown')).toThrow(
			'Unsupported CSAA_REPOSITORY_SMOKE_PROFILE: unknown'
		);
		expect(repositorySmokeSuite(undefined)).toBe('FULL_SUITE');
		expect(repositorySmokeSuite('')).toBe('FULL_SUITE');
		expect(repositorySmokeSuite(' command_handler ')).toBe('COMMAND_HANDLER_ONLY');
		expect(repositorySmokeSuite(' command_handler_only ')).toBe('COMMAND_HANDLER_ONLY');
		expect(repositorySmokeSuite(' full ')).toBe('FULL_SUITE');
		expect(repositorySmokeSuite(' full_suite ')).toBe('FULL_SUITE');
		expect(() => repositorySmokeSuite('unknown')).toThrow(
			'Unsupported CSAA_REPOSITORY_SMOKE_SUITE: unknown'
		);
		expect(() => assertRepositorySmokeSelection('FULL', 'COMMAND_HANDLER_ONLY', '1')).toThrow(
			'COMMAND_HANDLER_ONLY requires CSAA_REPOSITORY_SMOKE_PROFILE=STRUCTURAL.'
		);
		for (const selector of [undefined, '', '0', 'all', ' 1 '])
			expect(() =>
				assertRepositorySmokeSelection('STRUCTURAL', 'COMMAND_HANDLER_ONLY', selector)
			).toThrow('COMMAND_HANDLER_ONLY requires CSAA_REPOSITORY_SMOKE=1.');
		expect(() =>
			assertRepositorySmokeSelection('STRUCTURAL', 'COMMAND_HANDLER_ONLY', '1')
		).not.toThrow();
		expect(REPOSITORY_SMOKE_PROJECTION_PLANS.COMMAND_HANDLER_ONLY).toEqual({
			runIndependentSemanticRevalidation: false,
			runCallGraph: false,
			runDependencyProviderComparison: false,
			runGuardClassificationOverlay: true,
			runModuleDependencyGraph: false,
			runReadWriteAccessGraph: false,
			runRepositoryDiscoveryPreflight: false,
			runStateMachineProjection: true,
			suite: 'COMMAND_HANDLER_ONLY'
		});
		expect(REPOSITORY_SMOKE_PROJECTION_PLANS.FULL_SUITE).toEqual({
			runIndependentSemanticRevalidation: true,
			runCallGraph: true,
			runDependencyProviderComparison: true,
			runGuardClassificationOverlay: false,
			runModuleDependencyGraph: true,
			runReadWriteAccessGraph: true,
			runRepositoryDiscoveryPreflight: true,
			runStateMachineProjection: true,
			suite: 'FULL_SUITE'
		});
		expect(semanticCapabilitiesForProfile('STRUCTURAL')).toEqual([
			'TS_PROJECT',
			'TS_SYMBOL',
			'TS_SYNTAX'
		]);
		expect(semanticCapabilitiesForProfile('FULL')).toEqual([
			'TS_PROJECT',
			'TS_SYMBOL',
			'TS_SYNTAX',
			'TS_TYPE'
		]);
		expect(COMMAND_HANDLER_COMPILER_CLOSURE_PROJECTS).toEqual([
			'packages/rph-application/tsconfig.json',
			'packages/rph-assurance/tsconfig.json',
			'packages/rph-contracts/tsconfig.json',
			'packages/rph-domain/tsconfig.json',
			'packages/rph-persistence/tsconfig.json',
			'packages/rph-ports/tsconfig.json',
			'packages/rph-projections/tsconfig.json'
		]);
		expect(COMMAND_ANALYSIS_RETAINED_ARTIFACTS).toEqual([
			...ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS,
			...GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS,
			COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH
		]);
	});

	it('emits ordered structured run and phase progress with independent phase durations', () => {
		const lines: string[] = [];
		const times = [1_000, 1_010, 1_040, 1_050, 1_060];
		const telemetry = createRepositorySmokeTelemetry(
			{ selector: 'fixture' },
			{
				now: () => times.shift()!,
				write: (line) => lines.push(line)
			}
		);
		telemetry.start('CALL_GRAPH', { callSites: 7 });
		telemetry.complete({ edges: 9 });
		telemetry.skip('STATE_MACHINE_GRAPH_PROJECTION', {
			reason: 'artifact absent',
			reasonCode: 'STATE_MACHINE_ARTIFACT_ABSENT'
		});
		telemetry.finish({ outcome: 'partial' });
		const events = lines.map((line) => JSON.parse(line) as Record<string, any>);
		expect(events.map((event) => [event.event, event.state, event.phase ?? null])).toEqual([
			['CSAA_REPOSITORY_SMOKE_RUN', 'STARTED', null],
			['CSAA_REPOSITORY_SMOKE_PHASE', 'STARTED', 'CALL_GRAPH'],
			['CSAA_REPOSITORY_SMOKE_PHASE', 'COMPLETED', 'CALL_GRAPH'],
			['CSAA_REPOSITORY_SMOKE_PHASE', 'SKIPPED', 'STATE_MACHINE_GRAPH_PROJECTION'],
			['CSAA_REPOSITORY_SMOKE_RUN', 'COMPLETED', null]
		]);
		expect(events[2]).toMatchObject({ durationMs: 30, runElapsedMs: 40 });
		expect(events[3]).toMatchObject({
			details: { reasonCode: 'STATE_MACHINE_ARTIFACT_ABSENT' },
			durationMs: 0
		});
		expect(events[4]!.phaseDurationsMs).toEqual({ CALL_GRAPH: 30 });
		expect(telemetry.phaseDurationsMs()).toEqual({ CALL_GRAPH: 30 });
		expect(telemetry.skippedPhases()).toEqual(['STATE_MACHINE_GRAPH_PROJECTION']);
		expect(
			events.every((event) => event.schemaVersion === REPOSITORY_SMOKE_TELEMETRY_SCHEMA_VERSION)
		).toBe(true);
	});

	it('rejects skip operations that would obscure an active or ended run state', () => {
		const telemetry = createRepositorySmokeTelemetry({}, { write: () => undefined });
		telemetry.start('CALL_GRAPH');
		expect(() => telemetry.skip('MODULE_DEPENDENCY_GRAPH', {})).toThrow(
			'Repository smoke phase CALL_GRAPH is still active.'
		);
		telemetry.complete();
		telemetry.finish();
		expect(() => telemetry.skip('MODULE_DEPENDENCY_GRAPH', {})).toThrow(
			'Repository smoke telemetry has already ended.'
		);
	});

	it('records the active failure phase and reuses the same error in the run terminal event', () => {
		const lines: string[] = [];
		const times = [2_000, 2_010, 2_025];
		const telemetry = createRepositorySmokeTelemetry(
			{ selector: 'fixture' },
			{
				now: () => times.shift()!,
				write: (line) => lines.push(line)
			}
		);
		telemetry.start('DEPENDENCY_CRUISER_EXECUTION', { inputPaths: ['packages/domain'] });
		telemetry.fail(new Error('provider refused'));
		const events = lines.map((line) => JSON.parse(line) as Record<string, any>);
		expect(events.at(-2)).toMatchObject({
			durationMs: 15,
			error: { message: 'provider refused', name: 'Error' },
			phase: 'DEPENDENCY_CRUISER_EXECUTION',
			state: 'FAILED'
		});
		expect(events.at(-1)).toMatchObject({
			error: { message: 'provider refused', name: 'Error' },
			failedPhase: 'DEPENDENCY_CRUISER_EXECUTION',
			state: 'FAILED'
		});
	});
});

describe('current JPWB repository semantic and graph smoke', () => {
	it.runIf(RUN_REPOSITORY_SMOKE)(
		'freezes, replays, validates, and projects the selected TypeScript project closure',
		async () => {
			const telemetry = createRepositorySmokeTelemetry({
				budgetClassification: 'PROVISIONAL_CALLER_OPERATION_BUDGETS_NOT_PRODUCT_CEILINGS',
				provisionalCallerOperationBudgets: {
					dependencyProviderMaxDurationMs: REPOSITORY_SMOKE_FAILSAFE_PROVIDER_DURATION_MS,
					semanticMaxDurationMs: REPOSITORY_SMOKE_FAILSAFE_SEMANTIC_DURATION_MS,
					semanticMaxSnapshotBytes: REPOSITORY_SMOKE_FAILSAFE_SNAPSHOT_BYTES,
					subjectResolution: {
						maxBytes: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES,
						maxConfigDepth: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_CONFIG_DEPTH,
						maxDurationMs: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_DURATION_MS,
						maxFiles: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_FILES,
						maxProjects: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_PROJECTS
					},
					testDurationMs: REPOSITORY_SMOKE_FAILSAFE_TEST_TIMEOUT_MS
				},
				projectionPlan: SMOKE_PROJECTION_PLAN,
				selectedProjects: SELECTED_PROJECTS ?? ['<repository>'],
				semanticCapabilities: SEMANTIC_CAPABILITIES,
				semanticProfile: SMOKE_PROFILE,
				smokeSuite: SMOKE_SUITE,
				selector: SMOKE_SELECTOR ?? null
			});
			try {
				let repositorySubjectOutcome: ReturnType<typeof resolveSmokeSubject> | null = null;
				if (SELECTED_PROJECTS !== null && SMOKE_PROJECTION_PLAN.runRepositoryDiscoveryPreflight) {
					telemetry.start('REPOSITORY_DISCOVERY_PREFLIGHT', {
						requiredProjects: SELECTED_PROJECTS
					});
					repositorySubjectOutcome = resolveSmokeSubject({ kind: 'REPOSITORY' });
					expect(repositorySubjectOutcome.outcome, JSON.stringify(repositorySubjectOutcome)).toBe(
						'resolved'
					);
					if (repositorySubjectOutcome.outcome !== 'resolved')
						throw new Error(JSON.stringify(repositorySubjectOutcome));
					const discoveredProjectPaths = repositorySubjectOutcome.subject.projects.map(
						(project) => project.configPath
					);
					expect(discoveredProjectPaths).toEqual(expect.arrayContaining([...SELECTED_PROJECTS]));
					telemetry.complete({ discoveredProjects: discoveredProjectPaths.length });
				} else
					telemetry.skip('REPOSITORY_DISCOVERY_PREFLIGHT', {
						reason:
							SELECTED_PROJECTS === null
								? 'Repository scope is already the selected subject.'
								: 'The selected smoke suite resolves its exact explicit-project subject directly.',
						reasonCode:
							SELECTED_PROJECTS === null
								? 'REPOSITORY_SCOPE_ALREADY_SELECTED'
								: 'SUITE_PHASE_NOT_REQUESTED'
					});
				telemetry.start('SELECTED_SUBJECT_RESOLUTION', {
					scope: SELECTED_PROJECTS === null ? 'REPOSITORY' : 'EXPLICIT_PROJECTS'
				});
				const subjectOutcome = resolveSmokeSubject(
					SELECTED_PROJECTS === null
						? { kind: 'REPOSITORY' }
						: {
								...(USE_COMMON_COMMAND_HANDLER_SUBJECT
									? { additionalArtifacts: COMMAND_ANALYSIS_RETAINED_ARTIFACTS }
									: {}),
								kind: 'EXPLICIT_PROJECTS',
								projects: SELECTED_PROJECTS
							}
				);
				expect(subjectOutcome.outcome, JSON.stringify(subjectOutcome)).toBe('resolved');
				if (subjectOutcome.outcome !== 'resolved') throw new Error(JSON.stringify(subjectOutcome));
				const subject = subjectOutcome.subject;
				const projectPaths = subject.projects.map((project) => project.configPath);
				expect(projectPaths).toEqual(
					expect.arrayContaining([...(SELECTED_PROJECTS ?? REPRESENTATIVE_PROJECTS)])
				);
				const subjectArtifactBytes = subject.artifacts.reduce(
					(total, artifact) => total + artifact.bytes,
					0
				);
				telemetry.complete({
					artifactBytes: subjectArtifactBytes,
					artifacts: subject.artifacts.length,
					projects: subject.projects.length,
					subjectId: subject.descriptor.subjectId
				});

				const semanticPipelineStartedAt = performance.now();
				const semanticProgressEvents: StaticSemanticSnapshotProgressEvent[] = [];
				const semanticPhaseDurationsMs: Record<string, number> = {};
				const semanticMemoryHighWaterBytes = {
					external: 0,
					heapTotal: 0,
					heapUsed: 0,
					rss: 0
				};
				telemetry.start('STATIC_SEMANTIC_SNAPSHOT_BUILD', {
					capabilities: SEMANTIC_CAPABILITIES,
					provisionalCallerOperationBudgets: {
						maxDurationMs: REPOSITORY_SMOKE_FAILSAFE_SEMANTIC_DURATION_MS,
						maxSnapshotBytes: REPOSITORY_SMOKE_FAILSAFE_SNAPSHOT_BYTES
					}
				});
				const outcome = buildStaticSemanticSnapshot(
					{
						assignabilityRequests: [],
						budgets: {
							maxAstDepth: 2_048,
							maxAstNodes: 5_000_000,
							maxCompilerInputMetadataBytes: 536_870_912,
							maxCompilerQueries: 5_000_000,
							maxCompilerFacts: 5_000_000,
							maxCompilerQueryInvocations: 50_000_000,
							maxContextBytes: 536_870_912,
							maxContextFileBytes: 67_108_864,
							maxContextFiles: 100_000,
							maxDiagnosticCharacters: 50_000_000,
							maxDiagnostics: 500_000,
							maxDirectoryEntries: 5_000_000,
							maxDurationMs: REPOSITORY_SMOKE_FAILSAFE_SEMANTIC_DURATION_MS,
							maxLiteralCharacters: 10_000,
							maxPathCharacters: 4_096,
							maxProjects: 200,
							maxSnapshotBytes: REPOSITORY_SMOKE_FAILSAFE_SNAPSHOT_BYTES,
							maxScopes: 1_000_000,
							maxSources: 100_000
						},
						capabilities: SEMANTIC_CAPABILITIES,
						expectEmpty: false,
						operationVersion: SEMANTIC_OPERATION_VERSION,
						rootLocator: REPOSITORY_ROOT,
						schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
						subjectId: subject.descriptor.subjectId
					},
					{ subject },
					{
						onProgress(event) {
							semanticProgressEvents.push(event);
							if (event.state !== 'STARTED')
								semanticPhaseDurationsMs[event.phase] =
									(semanticPhaseDurationsMs[event.phase] ?? 0) + event.durationMs;
							semanticMemoryHighWaterBytes.external = Math.max(
								semanticMemoryHighWaterBytes.external,
								event.memoryUsage.external
							);
							semanticMemoryHighWaterBytes.heapTotal = Math.max(
								semanticMemoryHighWaterBytes.heapTotal,
								event.memoryUsage.heapTotal
							);
							semanticMemoryHighWaterBytes.heapUsed = Math.max(
								semanticMemoryHighWaterBytes.heapUsed,
								event.memoryUsage.heapUsed
							);
							semanticMemoryHighWaterBytes.rss = Math.max(
								semanticMemoryHighWaterBytes.rss,
								event.memoryUsage.rss
							);
							process.stdout.write(`${JSON.stringify(event)}\n`);
						}
					}
				);
				const outcomeSummary = JSON.stringify({
					diagnostics: outcome.diagnostics,
					outcome: outcome.outcome
				});
				expect(['complete', 'partial'], outcomeSummary).toContain(outcome.outcome);
				if (outcome.outcome !== 'complete' && outcome.outcome !== 'partial')
					throw new Error(outcomeSummary);
				const snapshot = outcome.snapshot;
				telemetry.complete({
					adapterPhaseDurationsMs: semanticPhaseDurationsMs,
					astNodes: snapshot.astNodes.length,
					diagnostics: outcome.diagnostics.length,
					memoryHighWaterBytes: semanticMemoryHighWaterBytes,
					outcome: outcome.outcome,
					programs: snapshot.programs.length,
					progressEvents: semanticProgressEvents.length,
					sources: snapshot.sources.length
				});
				expect(snapshot.projects).toHaveLength(subject.projects.length);
				expect(snapshot.programs).toHaveLength(subject.projects.length);
				expect(snapshot.sources.length).toBeGreaterThan(0);
				expect(snapshot.astNodes.length).toBeGreaterThan(snapshot.sources.length);
				expect(snapshot.declarationCandidates.length).toBeGreaterThan(0);
				expect(snapshot.declarations.length).toBeGreaterThan(0);
				expect(snapshot.symbols.length).toBeGreaterThan(0);
				expect(snapshot.aliases.length).toBeGreaterThan(0);
				expect(snapshot.references.length).toBeGreaterThan(0);
				expect(snapshot.moduleResolutions.length).toBeGreaterThan(0);
				expect(snapshot.moduleExports.length).toBeGreaterThan(0);
				const completedInternalSemanticPhases = new Set(
					semanticProgressEvents
						.filter((event) => event.state === 'COMPLETED')
						.map((event) => event.phase)
				);
				for (const requiredPhase of ['SERIALIZE', 'VALIDATE', 'FINALIZE'] as const)
					expect(completedInternalSemanticPhases.has(requiredPhase)).toBe(true);
				const internalSerializeEvent = semanticProgressEvents.find(
					(event) => event.phase === 'SERIALIZE' && event.state === 'COMPLETED'
				);
				if (internalSerializeEvent === undefined)
					throw new Error('The semantic builder did not report a completed SERIALIZE phase.');
				let semanticSnapshotWitness: {
					readonly bytes: number;
					readonly sha256: string | null;
					readonly validationMode: 'BUILDER_INTERNAL' | 'INDEPENDENT_REVALIDATION';
				} = {
					bytes: internalSerializeEvent.counts.canonicalBytes,
					sha256: null,
					validationMode: 'BUILDER_INTERNAL'
				};
				expect(semanticSnapshotWitness.bytes).toBeGreaterThan(0);
				expect(semanticSnapshotWitness.bytes).toBeLessThanOrEqual(
					snapshot.budgets.maxSnapshotBytes
				);
				if (SMOKE_PROJECTION_PLAN.runIndependentSemanticRevalidation) {
					telemetry.start('STATIC_SEMANTIC_SNAPSHOT_VALIDATE_AND_SERIALIZE', {
						semanticSnapshotId: snapshot.id
					});
					expect(
						validateStaticSemanticSnapshot(
							snapshot,
							{
								maxDepth: 4_096,
								maxDiagnostics: snapshot.budgets.maxDiagnostics,
								maxIssues: 100_000,
								maxRecords: snapshot.budgets.maxSnapshotBytes,
								maxReferenceChecks: snapshot.budgets.maxSnapshotBytes,
								maxStringCharacters: snapshot.budgets.maxSnapshotBytes
							},
							{ frozenSubject: subject }
						)
					).toEqual({ issues: [], state: 'VALID' });
					const canonicalWitness = canonicalSemanticJsonWitness(snapshot);
					expect(canonicalWitness.bytes).toBeLessThanOrEqual(snapshot.budgets.maxSnapshotBytes);
					expect(canonicalWitness.sha256).toMatch(/^[a-f0-9]{64}$/u);
					expect(canonicalWitness.bytes).toBe(semanticSnapshotWitness.bytes);
					semanticSnapshotWitness = {
						...canonicalWitness,
						validationMode: 'INDEPENDENT_REVALIDATION'
					};
					telemetry.complete({
						bytes: canonicalWitness.bytes,
						sha256: canonicalWitness.sha256,
						validationState: 'VALID'
					});
				} else
					telemetry.skip('STATIC_SEMANTIC_SNAPSHOT_VALIDATE_AND_SERIALIZE', {
						builderCompletedPhases: ['SERIALIZE', 'VALIDATE', 'FINALIZE'],
						canonicalBytes: semanticSnapshotWitness.bytes,
						reason:
							'The semantic builder already serialized, validated, and finalized the accepted snapshot against the frozen subject.',
						reasonCode: 'VALIDATED_IN_BUILD_PIPELINE'
					});
				const semanticPipelineDurationMs = Math.max(
					0,
					Math.round(performance.now() - semanticPipelineStartedAt)
				);
				let moduleDependencyGraph: ModuleDependencyGraphSnapshot | null = null;
				let moduleDependencyGraphResult: null | {
					readonly bytes: number;
					readonly durationMs: number;
					readonly edges: number;
					readonly health: string;
					readonly nodes: number;
					readonly sha256: string;
				} = null;
				if (SMOKE_PROJECTION_PLAN.runModuleDependencyGraph) {
					const graphStartedAt = performance.now();
					telemetry.start('MODULE_DEPENDENCY_GRAPH', {
						moduleResolutions: snapshot.moduleResolutions.length,
						sources: snapshot.sources.length
					});
					const graphOutcome = buildModuleDependencyGraph(
						{
							operationVersion: MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
							schemaVersion: MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
							semanticSnapshotId: snapshot.id,
							subjectId: snapshot.subjectId
						},
						snapshot
					);
					expect(['complete', 'partial'], JSON.stringify(graphOutcome)).toContain(
						graphOutcome.outcome
					);
					if (graphOutcome.outcome === 'unavailable') throw new Error(JSON.stringify(graphOutcome));
					const graph = graphOutcome.graph;
					expect(validateModuleDependencyGraph(graph, snapshot)).toEqual({
						issues: [],
						state: 'VALID'
					});
					expect(graph.coverage.reconciles).toBe(true);
					expect(graph.coverage.representedSources).toBe(snapshot.sources.length);
					expect(graph.coverage.representedModuleResolutions).toBe(
						snapshot.moduleResolutions.length
					);
					expect(graph.edges).toHaveLength(snapshot.moduleResolutions.length);
					const graphWitness = canonicalSemanticJsonWitness(graph);
					telemetry.complete({
						bytes: graphWitness.bytes,
						edges: graph.edges.length,
						health: graph.health,
						nodes: graph.nodes.length,
						outcome: graphOutcome.outcome,
						validationState: 'VALID'
					});
					moduleDependencyGraph = graph;
					moduleDependencyGraphResult = {
						bytes: graphWitness.bytes,
						durationMs: Math.max(0, Math.round(performance.now() - graphStartedAt)),
						edges: graph.edges.length,
						health: graph.health,
						nodes: graph.nodes.length,
						sha256: graphWitness.sha256
					};
				} else
					telemetry.skip('MODULE_DEPENDENCY_GRAPH', {
						reason: 'The selected smoke suite does not request the module-dependency projection.',
						reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
					});
				let callGraphResult: null | {
					readonly bytes: number;
					readonly candidateSetCallSites: number;
					readonly durationMs: number;
					readonly externalDispatchCallSites: number;
					readonly nodes: number;
					readonly targetEdges: number;
					readonly unresolvedCallSites: number;
					readonly unsupportedCallSites: number;
				} = null;
				if (SMOKE_PROJECTION_PLAN.runCallGraph && SEMANTIC_CAPABILITIES.includes('TS_TYPE')) {
					const callGraphStartedAt = performance.now();
					telemetry.start('CALL_GRAPH', { callSites: snapshot.invocations.length });
					const callGraphOutcome = buildCallGraph(
						{
							operationVersion: CALL_GRAPH_OPERATION_VERSION,
							schemaVersion: CALL_GRAPH_REQUEST_SCHEMA_VERSION,
							semanticSnapshotId: snapshot.id,
							subjectId: snapshot.subjectId
						},
						snapshot
					);
					expect(callGraphOutcome.outcome, JSON.stringify(callGraphOutcome.diagnostics)).toBe(
						'partial'
					);
					if (callGraphOutcome.outcome === 'unavailable')
						throw new Error(JSON.stringify(callGraphOutcome));
					const callGraph = callGraphOutcome.graph;
					expect(callGraph.coverage.reconciles).toBe(true);
					expect(callGraph.coverage.representedCallSites).toBe(snapshot.invocations.length);
					expect(callGraph.coverage.closure).toBe('OPEN');
					expect(callGraph.coverage.wholeProgramReachability).toBe('NOT_CLAIMED');
					const callGraphWitness = canonicalSemanticJsonWitness(callGraph);
					telemetry.complete({
						bytes: callGraphWitness.bytes,
						candidateSetCallSites: callGraph.coverage.candidateSetCallSites,
						edges: callGraph.coverage.targetEdges,
						externalDispatchCallSites: callGraph.coverage.externalDispatchCallSites,
						nodes: callGraph.nodes.length,
						outcome: callGraphOutcome.outcome,
						unsupportedCallSites: callGraph.coverage.unsupportedCallSites,
						unresolvedCallSites: callGraph.coverage.unresolvedCallSites
					});
					callGraphResult = {
						bytes: callGraphWitness.bytes,
						candidateSetCallSites: callGraph.coverage.candidateSetCallSites,
						durationMs: Math.max(0, Math.round(performance.now() - callGraphStartedAt)),
						externalDispatchCallSites: callGraph.coverage.externalDispatchCallSites,
						nodes: callGraph.nodes.length,
						targetEdges: callGraph.coverage.targetEdges,
						unresolvedCallSites: callGraph.coverage.unresolvedCallSites,
						unsupportedCallSites: callGraph.coverage.unsupportedCallSites
					};
				} else
					telemetry.skip('CALL_GRAPH', {
						reason: SMOKE_PROJECTION_PLAN.runCallGraph
							? 'The structural profile does not request TS_TYPE; the current call-graph contract requires it.'
							: 'The selected smoke suite does not request the call-graph projection.',
						reasonCode: SMOKE_PROJECTION_PLAN.runCallGraph
							? 'TS_TYPE_NOT_REQUESTED'
							: 'SUITE_PHASE_NOT_REQUESTED'
					});
				let readWriteAccessGraphResult: null | {
					readonly accesses: number;
					readonly bytes: number;
					readonly durationMs: number;
					readonly edges: number;
					readonly frontiers: number;
					readonly id: string;
					readonly nodes: number;
					readonly reads: number;
					readonly readWrites: number;
					readonly sha256: string;
					readonly symbolSlots: number;
					readonly writes: number;
				} = null;
				if (SMOKE_PROJECTION_PLAN.runReadWriteAccessGraph) {
					const readWriteAccessGraphStartedAt = performance.now();
					const readWriteAccessMaxAccesses = Math.max(
						1,
						snapshot.references.length + snapshot.declarations.length
					);
					const readWriteAccessMaxFrontiers = Math.max(
						1,
						snapshot.references.length + snapshot.assignments.length
					);
					const readWriteAccessBudgets = {
						maxAccesses: readWriteAccessMaxAccesses,
						maxEdges: Math.max(1, readWriteAccessMaxAccesses * 2),
						maxFrontiers: readWriteAccessMaxFrontiers,
						maxNodes: Math.max(1, readWriteAccessMaxAccesses * 2 + readWriteAccessMaxFrontiers)
					};
					telemetry.start('READ_WRITE_ACCESS_GRAPH', {
						assignments: snapshot.assignments.length,
						budgets: readWriteAccessBudgets,
						declarations: snapshot.declarations.length,
						references: snapshot.references.length,
						symbols: snapshot.symbols.length
					});
					const readWriteAccessOutcome = buildReadWriteAccessGraph(
						{
							budgets: readWriteAccessBudgets,
							operationVersion: READ_WRITE_ACCESS_GRAPH_OPERATION_VERSION,
							schemaVersion: READ_WRITE_ACCESS_GRAPH_REQUEST_SCHEMA_VERSION,
							semanticSnapshotId: snapshot.id,
							subjectId: snapshot.subjectId
						},
						snapshot
					);
					expect(
						readWriteAccessOutcome.outcome,
						JSON.stringify(readWriteAccessOutcome.diagnostics)
					).toBe('partial');
					if (readWriteAccessOutcome.outcome === 'unavailable')
						throw new Error(JSON.stringify(readWriteAccessOutcome));
					const readWriteAccessGraph = readWriteAccessOutcome.graph;
					expect(
						validateReadWriteAccessGraph(readWriteAccessGraph, snapshot, {
							maxIssues: 100_000,
							maxRecords: snapshot.budgets.maxSnapshotBytes,
							maxStringCharacters: snapshot.budgets.maxSnapshotBytes
						})
					).toEqual({
						issues: [],
						state: 'VALID'
					});
					expect(readWriteAccessGraph.coverage.reconciles).toBe(true);
					expect(readWriteAccessGraph.coverage.closure).toBe('OPEN');
					expect(readWriteAccessGraph.fullJanCsaaCapability007DataFlow).toBe(
						FULL_JAN_CSAA_CAPABILITY_007_DATA_FLOW
					);
					const readWriteAccessGraphWitness = canonicalSemanticJsonWitness(readWriteAccessGraph);
					telemetry.complete({
						accesses: readWriteAccessGraph.coverage.accessOccurrences,
						bytes: readWriteAccessGraphWitness.bytes,
						edges: readWriteAccessGraph.edges.length,
						frontiers: readWriteAccessGraph.coverage.frontierNodes,
						nodes: readWriteAccessGraph.nodes.length,
						outcome: readWriteAccessOutcome.outcome,
						reads: readWriteAccessGraph.coverage.readAccesses,
						readWrites: readWriteAccessGraph.coverage.readWriteAccesses,
						symbolSlots: readWriteAccessGraph.coverage.symbolSlots,
						validationState: 'VALID',
						writes: readWriteAccessGraph.coverage.writeAccesses
					});
					readWriteAccessGraphResult = {
						accesses: readWriteAccessGraph.coverage.accessOccurrences,
						bytes: readWriteAccessGraphWitness.bytes,
						durationMs: Math.max(0, Math.round(performance.now() - readWriteAccessGraphStartedAt)),
						edges: readWriteAccessGraph.edges.length,
						frontiers: readWriteAccessGraph.coverage.frontierNodes,
						id: readWriteAccessGraph.id,
						nodes: readWriteAccessGraph.nodes.length,
						reads: readWriteAccessGraph.coverage.readAccesses,
						readWrites: readWriteAccessGraph.coverage.readWriteAccesses,
						sha256: readWriteAccessGraphWitness.sha256,
						symbolSlots: readWriteAccessGraph.coverage.symbolSlots,
						writes: readWriteAccessGraph.coverage.writeAccesses
					};
				} else
					telemetry.skip('READ_WRITE_ACCESS_GRAPH', {
						reason: 'The selected smoke suite does not request the read/write-access projection.',
						reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
					});
				const stateMachineArtifact = subject.artifacts.find(
					(artifact) => artifact.path === 'packages/rph-domain/src/transitions.data.ts'
				);
				let stateMachineResult: null | {
					readonly bytes: number;
					readonly crossAxisRules: number;
					readonly durationMs: number;
					readonly edges: number;
					readonly machines: number;
					readonly nodes: number;
					readonly states: number;
					readonly transitions: number;
				} = null;
				let stateMachineProjection: null | {
					readonly graph: StateMachineGraphSnapshot;
					readonly observation: StateMachineTopologyObservation;
					readonly request: BuildStateMachineGraphRequest;
				} = null;
				if (!SMOKE_PROJECTION_PLAN.runStateMachineProjection) {
					const skipDetails = {
						reason: 'The selected smoke suite does not request state-machine projection.',
						reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
					};
					telemetry.skip('STATE_MACHINE_TOPOLOGY_OBSERVATION', skipDetails);
					telemetry.skip('STATE_MACHINE_GRAPH_PROJECTION', skipDetails);
				} else if (stateMachineArtifact !== undefined) {
					const stateMachineStartedAt = performance.now();
					const populationBudget = Math.max(1, stateMachineArtifact.bytes);
					telemetry.start('STATE_MACHINE_TOPOLOGY_OBSERVATION', {
						artifactBytes: stateMachineArtifact.bytes,
						artifactPath: stateMachineArtifact.path
					});
					const observationOutcome = observeStateMachineTopology(
						{
							artifact: {
								bytes: stateMachineArtifact.bytes,
								canonicalPathKey: stateMachineArtifact.canonicalPathKey,
								disposition: 'ANALYZED',
								path: stateMachineArtifact.path,
								primaryClass: stateMachineArtifact.primaryClass,
								roles: stateMachineArtifact.roles,
								sha256: stateMachineArtifact.sha256
							},
							budgets: {
								maxAstNodes: Math.max(1, stateMachineArtifact.bytes * 2),
								maxCrossAxisRules: populationBudget,
								maxDiagnostics: populationBudget,
								maxMachines: populationBudget,
								maxSourceBytes: populationBudget,
								maxStates: populationBudget,
								maxTextCharacters: Math.max(1, stateMachineArtifact.bytes * 2),
								maxTransitions: populationBudget
							},
							operationVersion: STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION,
							schemaVersion: STATE_MACHINE_TOPOLOGY_OBSERVATION_REQUEST_SCHEMA_VERSION,
							subjectId: subject.descriptor.subjectId
						},
						{ subject }
					);
					expect(observationOutcome.outcome, JSON.stringify(observationOutcome)).toBe('complete');
					if (observationOutcome.outcome !== 'complete')
						throw new Error(JSON.stringify(observationOutcome));
					const observation = observationOutcome.observation;
					expect(validateStateMachineTopologyObservation(observation, subject)).toEqual({
						issues: [],
						state: 'VALID'
					});
					telemetry.complete({
						crossAxisRules: observation.crossAxisRules.length,
						explicitlyIllegalTransitions: observation.explicitlyIllegalTransitions.length,
						guardedDeclarations: observation.guardedTransitions.length,
						legalTransitions: observation.legalTransitions.length,
						machines: observation.machines.length,
						states: observation.states.length,
						validationState: 'VALID'
					});
					const matchingSources = snapshot.sources.filter(
						(source) =>
							source.logicalPath === stateMachineArtifact.path &&
							snapshot.projects.find((project) => project.id === source.projectId)?.configPath ===
								'packages/rph-domain/tsconfig.json'
					);
					expect(matchingSources).toHaveLength(1);
					const stateMachineSource = matchingSources[0]!;
					const guardedLegalTransitionCount = new Set(
						observation.guardedTransitions.map((item) => item.legalTransitionId)
					).size;
					const graphRequest = {
						budgets: {
							maxEdges:
								observation.states.length +
								observation.legalTransitions.length +
								observation.guardedTransitions.length -
								guardedLegalTransitionCount +
								observation.explicitlyIllegalTransitions.length +
								observation.crossAxisRules.length,
							maxNodes:
								observation.machines.length +
								observation.states.length +
								observation.crossAxisRules.length
						},
						observationId: observation.id,
						operationVersion: STATE_MACHINE_GRAPH_OPERATION_VERSION,
						schemaVersion: STATE_MACHINE_GRAPH_REQUEST_SCHEMA_VERSION,
						semanticSnapshotId: snapshot.id,
						source: {
							logicalPath: stateMachineSource.logicalPath,
							programId: stateMachineSource.programId,
							projectId: stateMachineSource.projectId,
							semanticSourceId: stateMachineSource.id
						},
						subjectId: snapshot.subjectId
					};
					telemetry.start('STATE_MACHINE_GRAPH_PROJECTION', {
						maxEdges: graphRequest.budgets.maxEdges,
						maxNodes: graphRequest.budgets.maxNodes,
						uniqueGuardedLegalTransitions: guardedLegalTransitionCount
					});
					const stateMachineOutcome = buildStateMachineGraph(graphRequest, snapshot, observation);
					expect(stateMachineOutcome.outcome, JSON.stringify(stateMachineOutcome)).toBe('partial');
					if (stateMachineOutcome.outcome !== 'partial')
						throw new Error(JSON.stringify(stateMachineOutcome));
					const stateMachineGraph = stateMachineOutcome.graph;
					expect(
						validateStateMachineGraph(stateMachineGraph, graphRequest, snapshot, observation)
					).toEqual({ issues: [], state: 'VALID' });
					expect(stateMachineGraph.coverage.reconciles).toBe(true);
					expect(stateMachineGraph.fullJanCsaa007Conformance).toBe('NOT_CLAIMED');
					expect(stateMachineGraph.fullJanCsaa008Conformance).toBe('NOT_CLAIMED');
					expect(stateMachineGraph.registryStatus).toBe('IMPLEMENTATION_LOCAL_UNREGISTERED');
					expect(stateMachineGraph.verifierAuthority).toBe('RETAINED_DELEGATED');
					const stateMachineWitness = canonicalSemanticJsonWitness(stateMachineGraph);
					telemetry.complete({
						bytes: stateMachineWitness.bytes,
						edges: stateMachineGraph.edges.length,
						nodes: stateMachineGraph.nodes.length,
						outcome: stateMachineOutcome.outcome,
						validationState: 'VALID'
					});
					stateMachineResult = {
						bytes: stateMachineWitness.bytes,
						crossAxisRules: observation.crossAxisRules.length,
						durationMs: Math.max(0, Math.round(performance.now() - stateMachineStartedAt)),
						edges: stateMachineGraph.edges.length,
						machines: observation.machines.length,
						nodes: stateMachineGraph.nodes.length,
						states: observation.states.length,
						transitions:
							observation.legalTransitions.length + observation.explicitlyIllegalTransitions.length
					};
					stateMachineProjection = {
						graph: stateMachineGraph,
						observation,
						request: graphRequest
					};
				} else {
					const skipDetails = {
						reason:
							'Selected subject does not contain packages/rph-domain/src/transitions.data.ts.',
						reasonCode: 'STATE_MACHINE_ARTIFACT_ABSENT'
					};
					telemetry.skip('STATE_MACHINE_TOPOLOGY_OBSERVATION', skipDetails);
					telemetry.skip('STATE_MACHINE_GRAPH_PROJECTION', skipDetails);
				}

				telemetry.start('ARROW_COMMAND_CENSUS_SUBJECT_SELECTION', {
					reusedRepositoryPreflight:
						SELECTED_PROJECTS !== null && !USE_COMMON_COMMAND_HANDLER_SUBJECT,
					reusedSelectedSubject: SELECTED_PROJECTS === null || USE_COMMON_COMMAND_HANDLER_SUBJECT,
					scope: USE_COMMON_COMMAND_HANDLER_SUBJECT
						? 'EXPLICIT_PROJECTS_WITH_AUXILIARY_EVIDENCE'
						: 'REPOSITORY'
				});
				let arrowSubject = subject;
				if (SELECTED_PROJECTS !== null && !USE_COMMON_COMMAND_HANDLER_SUBJECT) {
					if (repositorySubjectOutcome?.outcome !== 'resolved')
						throw new Error(
							'Repository preflight subject is unavailable for arrow-command census.'
						);
					arrowSubject = repositorySubjectOutcome.subject;
				}
				if (SMOKE_SUITE === 'COMMAND_HANDLER_ONLY') {
					expect(arrowSubject).toBe(subject);
					expect(arrowSubject.descriptor.subjectId).toBe(snapshot.subjectId);
				}
				const arrowSubjectBytes = arrowSubject.artifacts.reduce(
					(total, artifact) => total + artifact.bytes,
					0
				);
				telemetry.complete({
					artifactBytes: arrowSubjectBytes,
					artifacts: arrowSubject.artifacts.length,
					projects: arrowSubject.projects.length,
					reusedSelectedSubject: SELECTED_PROJECTS === null || USE_COMMON_COMMAND_HANDLER_SUBJECT,
					reusedRepositoryPreflight:
						SELECTED_PROJECTS !== null && !USE_COMMON_COMMAND_HANDLER_SUBJECT,
					subjectId: arrowSubject.descriptor.subjectId
				});

				const artifactSetBudgets = {
					maxArtifacts: arrowSubject.artifacts.length,
					maxDiagnostics: 100_000,
					maxTotalBytes: arrowSubjectBytes
				};
				telemetry.start('ARROW_COMMAND_CENSUS_ARTIFACT_SET_BINDING', {
					budgetClassification: 'CALLER_OPERATION_BUDGETS_NOT_PRODUCT_CEILINGS',
					budgets: artifactSetBudgets,
					operationVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION,
					schemaVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION
				});
				const artifactSetOutcome = buildArrowCommandCensusArtifactSet(
					{
						budgets: artifactSetBudgets,
						operationVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION,
						schemaVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
						subjectId: arrowSubject.descriptor.subjectId
					},
					{ subject: arrowSubject }
				);
				expect(artifactSetOutcome.outcome, JSON.stringify(artifactSetOutcome)).toBe('complete');
				if (artifactSetOutcome.outcome !== 'complete')
					throw new Error(JSON.stringify(artifactSetOutcome));
				const arrowArtifactSet = artifactSetOutcome.artifactSet;
				expect(arrowArtifactSet.subjectId).toBe(arrowSubject.descriptor.subjectId);
				const arrowArtifactBytes = arrowArtifactSet.artifacts.reduce(
					(total, artifact) => total + artifact.bytes,
					0
				);
				telemetry.complete({
					artifactBytes: arrowArtifactBytes,
					artifacts: arrowArtifactSet.coverage.artifacts,
					commandDeclarationArtifacts: arrowArtifactSet.coverage.commandDeclarationArtifacts,
					handlerSourceArtifacts: arrowArtifactSet.coverage.handlerSourceArtifacts,
					packageSourceArtifacts: arrowArtifactSet.coverage.packageSourceArtifacts,
					reconciles: arrowArtifactSet.coverage.reconciles
				});

				const arrowObservationBudgets = {
					maxArtifacts: arrowArtifactSet.artifacts.length,
					maxBirthStates: 1_000_000,
					maxDeclaredArrowOccurrences: 1_000_000,
					maxDeclaredSites: 1_000_000,
					maxDiagnostics: 100_000,
					maxExecutorDurationMs: REPOSITORY_SMOKE_FAILSAFE_PROVIDER_DURATION_MS,
					maxExternalModuleBytes: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES,
					maxExternalModuleFiles: 100_000,
					maxMachines: 100_000,
					maxMapStates: 1_000_000,
					maxMaterializedBytes: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES,
					maxOutputStringCharacters: 100_000_000,
					maxRawArrayEntries: 10_000_000,
					maxRawJsonDepth: 64,
					maxStderrBytes: 100_000_000,
					maxStdoutBytes: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES
				};
				const arrowAdapterPhaseDurationsMs: Record<string, number> = {};
				telemetry.start('ARROW_COMMAND_CENSUS_OBSERVATION', {
					budgetClassification: 'PROVISIONAL_CALLER_OPERATION_BUDGETS_NOT_PRODUCT_CEILINGS',
					budgets: arrowObservationBudgets,
					operationVersion: ARROW_COMMAND_CENSUS_OPERATION_VERSION,
					schemaVersion: ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION
				});
				const arrowOutcome = await observeArrowCommandCensus(
					{
						artifactSetId: arrowArtifactSet.id,
						budgets: arrowObservationBudgets,
						operationVersion: ARROW_COMMAND_CENSUS_OPERATION_VERSION,
						schemaVersion: ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
						subjectId: arrowSubject.descriptor.subjectId
					},
					{ artifactSet: arrowArtifactSet, subject: arrowSubject },
					{
						onProgress(event) {
							if (event.durationMs !== undefined && event.state !== 'STARTED')
								arrowAdapterPhaseDurationsMs[event.phase] = event.durationMs;
							process.stdout.write(`${JSON.stringify(event)}\n`);
						}
					}
				);
				expect(['complete', 'partial'], JSON.stringify(arrowOutcome)).toContain(
					arrowOutcome.outcome
				);
				if (arrowOutcome.outcome !== 'complete' && arrowOutcome.outcome !== 'partial')
					throw new Error(JSON.stringify(arrowOutcome));
				const arrowObservation = arrowOutcome.observation;
				expect(arrowObservation.subjectId).toBe(arrowSubject.descriptor.subjectId);
				expect(arrowObservation.artifactSet.id).toBe(arrowArtifactSet.id);
				const externalModuleBytes = arrowObservation.executor.externalModules.reduce(
					(total, module) => total + module.bytes,
					0
				);
				const externalModuleFiles = arrowObservation.executor.externalModules.reduce(
					(total, module) => total + module.files,
					0
				);
				telemetry.complete({
					adapterPhaseDurationsMs: arrowAdapterPhaseDurationsMs,
					baselineMatches: arrowObservation.coverage.baselineMatches,
					coveredInScopeTopologyArrows: arrowObservation.coverage.coveredInScopeTopologyArrows,
					deadCoveredArrows: arrowObservation.coverage.deadCoveredArrows,
					declaredArrowOccurrences: arrowObservation.coverage.declaredArrowOccurrences,
					declaredSites: arrowObservation.coverage.declaredSites,
					diagnostics: arrowOutcome.diagnostics.length,
					externalModuleBytes,
					externalModuleFiles,
					externalModules: arrowObservation.executor.externalModules.length,
					orphanMachines: arrowObservation.coverage.orphanMachines,
					outcome: arrowOutcome.outcome,
					rawOutputBytes: arrowObservation.rawOutput.bytes,
					totalInScopeTopologyArrows: arrowObservation.coverage.totalInScopeTopologyArrows,
					unanalysedMachines: arrowObservation.coverage.unanalysedMachines,
					uncoveredArrows: arrowObservation.coverage.uncoveredArrows
				});

				telemetry.start('ARROW_COMMAND_CENSUS_VALIDATE_AND_SERIALIZE', {
					observationId: arrowObservation.id,
					subjectBound: true
				});
				expect(validateArrowCommandCensusObservation(arrowObservation, arrowSubject)).toEqual({
					issues: [],
					state: 'VALID'
				});
				const arrowObservationWitness = canonicalSemanticJsonWitness(arrowObservation);
				telemetry.complete({
					authorityTransfer: arrowObservation.authorityTransfer,
					bytes: arrowObservationWitness.bytes,
					contentDigest: arrowObservation.contentDigest,
					gateEffect: arrowObservation.gateEffect,
					limitations: arrowObservation.limitations.length,
					oracleChange: arrowObservation.oracleChange,
					replacementEquivalence: arrowObservation.replacementEquivalence,
					sha256: arrowObservationWitness.sha256,
					verifierAuthority: arrowObservation.verifierAuthority,
					validationState: 'VALID'
				});

				let guardObservation: GuardEnforcementLedgerObservation | null = null;
				let guardEnforcementLedgerResult: null | {
					readonly artifactBytes: number;
					readonly artifacts: number;
					readonly arrowOccurrences: number;
					readonly classifiedGuardTexts: number;
					readonly durationMs: number;
					readonly ledgerRows: number;
					readonly observationBytes: number;
				} = null;
				if (SMOKE_PROJECTION_PLAN.runGuardClassificationOverlay) {
					const guardLedgerStartedAt = performance.now();
					const guardArtifactSetBudgets = {
						maxArtifacts: subject.artifacts.length,
						maxDiagnostics: 100_000,
						maxTotalBytes: subjectArtifactBytes
					};
					telemetry.start('GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_BINDING', {
						budgetClassification: 'CALLER_OPERATION_BUDGETS_NOT_PRODUCT_CEILINGS',
						budgets: guardArtifactSetBudgets
					});
					const guardArtifactSetOutcome = buildGuardEnforcementLedgerArtifactSet(
						{
							budgets: guardArtifactSetBudgets,
							operationVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
							schemaVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
							subjectId: subject.descriptor.subjectId
						},
						{ subject }
					);
					expect(guardArtifactSetOutcome.outcome, JSON.stringify(guardArtifactSetOutcome)).toBe(
						'complete'
					);
					if (guardArtifactSetOutcome.outcome !== 'complete')
						throw new Error(JSON.stringify(guardArtifactSetOutcome));
					const guardArtifactSet = guardArtifactSetOutcome.artifactSet;
					const guardArtifactBytes = guardArtifactSet.artifacts.reduce(
						(total, artifact) => total + artifact.bytes,
						0
					);
					telemetry.complete({
						artifactBytes: guardArtifactBytes,
						artifacts: guardArtifactSet.artifacts.length,
						reconciles: guardArtifactSet.coverage.reconciles
					});
					const guardObservationBudgets = {
						maxArtifacts: guardArtifactSet.artifacts.length,
						maxAuditEntries: 1_000_000,
						maxDiagnostics: 100_000,
						maxExecutorDurationMs: REPOSITORY_SMOKE_FAILSAFE_PROVIDER_DURATION_MS,
						maxExternalModuleBytes: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES,
						maxExternalModuleFiles: 100_000,
						maxGuardedArrows: 1_000_000,
						maxGuardTexts: 1_000_000,
						maxLedgerRows: 1_000_000,
						maxMaterializedBytes: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES,
						maxOutputStringCharacters: 100_000_000,
						maxRawArrayEntries: 10_000_000,
						maxRawJsonDepth: 64,
						maxStderrBytes: 100_000_000,
						maxStdoutBytes: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES
					};
					const guardAdapterPhaseDurationsMs: Record<string, number> = {};
					telemetry.start('GUARD_ENFORCEMENT_LEDGER_OBSERVATION', {
						budgetClassification: 'PROVISIONAL_CALLER_OPERATION_BUDGETS_NOT_PRODUCT_CEILINGS',
						budgets: guardObservationBudgets
					});
					const guardOutcome = await observeGuardEnforcementLedger(
						{
							artifactSetId: guardArtifactSet.id,
							budgets: guardObservationBudgets,
							operationVersion: GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
							schemaVersion: GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
							subjectId: subject.descriptor.subjectId
						},
						{ artifactSet: guardArtifactSet, subject },
						{
							onProgress(event) {
								if (event.durationMs !== undefined && event.state !== 'STARTED')
									guardAdapterPhaseDurationsMs[event.phase] = event.durationMs;
								process.stdout.write(`${JSON.stringify(event)}\n`);
							}
						}
					);
					expect(['complete', 'partial'], JSON.stringify(guardOutcome)).toContain(
						guardOutcome.outcome
					);
					if (guardOutcome.outcome === 'unavailable') throw new Error(JSON.stringify(guardOutcome));
					guardObservation = guardOutcome.observation;
					telemetry.complete({
						adapterPhaseDurationsMs: guardAdapterPhaseDurationsMs,
						arrowOccurrences: guardObservation.coverage.arrowOccurrences,
						classifiedGuardTexts: guardObservation.coverage.classifiedGuardTexts,
						ledgerRows: guardObservation.coverage.ledgerRows,
						outcome: guardOutcome.outcome
					});
					telemetry.start('GUARD_ENFORCEMENT_LEDGER_VALIDATE_AND_SERIALIZE', {
						observationId: guardObservation.id,
						subjectBound: true
					});
					expect(validateGuardEnforcementLedgerObservation(guardObservation, subject)).toEqual({
						issues: [],
						state: 'VALID'
					});
					const guardObservationWitness = canonicalSemanticJsonWitness(guardObservation);
					telemetry.complete({
						bytes: guardObservationWitness.bytes,
						contentDigest: guardObservation.contentDigest,
						runtimeEnforcement: guardObservation.runtimeEnforcement,
						validationState: 'VALID',
						verifierAuthority: guardObservation.verifierAuthority
					});
					guardEnforcementLedgerResult = {
						artifactBytes: guardArtifactBytes,
						artifacts: guardArtifactSet.artifacts.length,
						arrowOccurrences: guardObservation.coverage.arrowOccurrences,
						classifiedGuardTexts: guardObservation.coverage.classifiedGuardTexts,
						durationMs: Math.max(0, Math.round(performance.now() - guardLedgerStartedAt)),
						ledgerRows: guardObservation.coverage.ledgerRows,
						observationBytes: guardObservationWitness.bytes
					};
				} else {
					const skipDetails = {
						reason: 'The selected smoke suite does not request the guard-classification overlay.',
						reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
					};
					telemetry.skip('GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_BINDING', skipDetails);
					telemetry.skip('GUARD_ENFORCEMENT_LEDGER_OBSERVATION', skipDetails);
					telemetry.skip('GUARD_ENFORCEMENT_LEDGER_VALIDATE_AND_SERIALIZE', skipDetails);
				}

				let commandHandlerResult: null | {
					readonly bytes: number;
					readonly candidateEdges: number;
					readonly commandRegistryEntries: number;
					readonly durationMs: number;
					readonly edges: number;
					readonly frontiers: number;
					readonly handlerRegistryEntries: number;
					readonly nodes: number;
				} = null;
				let commandDispatchTopologyResult: null | {
					readonly bytes: number;
					readonly candidateEdges: number;
					readonly durationMs: number;
					readonly nodes: number;
					readonly pipelineFacts: number;
					readonly retainedCensusBytes: number;
				} = null;
				let guardClassificationOverlayResult: null | {
					readonly anchorSites: number;
					readonly bytes: number;
					readonly candidateHandlerLinks: number;
					readonly classifications: number;
					readonly commandEvidenceLinks: number;
					readonly directHandlerLinks: number;
					readonly durationMs: number;
					readonly frontiers: number;
					readonly occurrences: number;
					readonly stateEvidenceRefs: number;
				} = null;
				if (snapshot.subjectId === arrowObservation.subjectId) {
					const commandHandlerStartedAt = performance.now();
					const registrySelectors = selectJpwbCommandHandlerRegistries(snapshot);
					const commandHandlerBudgets = {
						maxAstNodes: Math.max(1, snapshot.astNodes.length),
						maxCommandRegistryEntries: Math.max(1, snapshot.declarations.length),
						maxEdges: Math.max(
							1,
							snapshot.declarations.length * 4 + arrowObservation.declaredArrows.length
						),
						maxFrontiers: Math.max(
							1,
							snapshot.declarations.length + arrowObservation.declaredSites.length
						),
						maxHandlerRegistryEntries: Math.max(1, snapshot.declarations.length),
						maxNodes: Math.max(
							1,
							snapshot.declarations.length * 4 +
								arrowObservation.declaredSites.length +
								arrowObservation.declaredArrows.length
						),
						maxSourceBytes: Math.max(1, subjectArtifactBytes)
					};
					const commandHandlerRequest = {
						arrowObservationId: arrowObservation.id,
						budgets: commandHandlerBudgets,
						commandRegistry: registrySelectors.commandRegistry,
						handlerRegistry: registrySelectors.handlerRegistry,
						operationVersion: COMMAND_HANDLER_GRAPH_OPERATION_VERSION,
						schemaVersion: COMMAND_HANDLER_GRAPH_REQUEST_SCHEMA_VERSION,
						semanticSnapshotId: snapshot.id,
						subjectId: snapshot.subjectId
					};
					const commandHandlerPhaseDurationsMs: Record<string, number> = {};
					telemetry.start('COMMAND_HANDLER_STATIC_PROJECTION', {
						budgetClassification: 'PROVISIONAL_CALLER_OPERATION_BUDGETS_NOT_PRODUCT_CEILINGS',
						budgets: commandHandlerBudgets,
						declaredArrowOccurrences: arrowObservation.declaredArrows.length,
						declaredSites: arrowObservation.declaredSites.length
					});
					const commandHandlerOutcome = buildCommandHandlerGraph(
						commandHandlerRequest,
						snapshot,
						arrowObservation,
						arrowSubject,
						{
							onProgress(event) {
								if (event.state !== 'STARTED')
									commandHandlerPhaseDurationsMs[event.phase] = event.durationMs;
								process.stdout.write(`${JSON.stringify(event)}\n`);
							}
						}
					);
					expect(
						commandHandlerOutcome.outcome,
						JSON.stringify(commandHandlerOutcome.diagnostics)
					).toBe('partial');
					if (commandHandlerOutcome.outcome !== 'partial')
						throw new Error(JSON.stringify(commandHandlerOutcome));
					const commandHandlerGraph = commandHandlerOutcome.graph;
					const commandHandlerWitness = canonicalSemanticJsonWitness(commandHandlerGraph);
					expect(
						validateCommandHandlerGraph(
							commandHandlerGraph,
							snapshot,
							arrowObservation,
							arrowSubject,
							{
								maxIssues: 100_000,
								maxRecords: Math.max(1, commandHandlerWitness.bytes),
								maxStringCharacters: Math.max(1, commandHandlerWitness.bytes)
							}
						)
					).toEqual({ issues: [], state: 'VALID' });
					expect(commandHandlerGraph.coverage.reconciles).toBe(true);
					expect(commandHandlerGraph.coverage.commandRegistryClosure).toBe('CLOSED');
					expect(commandHandlerGraph.coverage.discoveredCommandRegistryEntries).toBeGreaterThan(0);
					expect(commandHandlerGraph.coverage.discoveredHandlerRegistryEntries).toBeGreaterThan(0);
					expect(commandHandlerGraph.coverage.missingHandlerRegistrations).toBe(0);
					expect(commandHandlerGraph.coverage.undeclaredHandlerRegistrations).toBe(0);
					expect(commandHandlerGraph.coverage.representedCommandRegistryEntries).toBe(
						commandHandlerGraph.coverage.discoveredCommandRegistryEntries
					);
					expect(commandHandlerGraph.coverage.representedHandlerRegistryEntries).toBe(
						commandHandlerGraph.coverage.discoveredHandlerRegistryEntries
					);
					expect(commandHandlerGraph.coverage.representedArrowSites).toBe(
						commandHandlerGraph.coverage.discoveredArrowSites
					);
					expect(commandHandlerGraph.coverage.representedArrowOccurrences).toBe(
						commandHandlerGraph.coverage.discoveredArrowOccurrences
					);
					expect(commandHandlerGraph.runtimeDispatchClosure).toBe('NOT_CLAIMED');
					expect(commandHandlerGraph.runtimePerformability).toBe('NOT_CLAIMED');
					telemetry.complete({
						adapterPhaseDurationsMs: commandHandlerPhaseDurationsMs,
						bytes: commandHandlerWitness.bytes,
						candidateEdges: commandHandlerGraph.coverage.candidateEdges,
						commandRegistryClosure: commandHandlerGraph.coverage.commandRegistryClosure,
						commandRegistryEntries: commandHandlerGraph.coverage.discoveredCommandRegistryEntries,
						edges: commandHandlerGraph.edges.length,
						frontiers: commandHandlerGraph.coverage.frontierNodes,
						handlerRegistryEntries: commandHandlerGraph.coverage.discoveredHandlerRegistryEntries,
						nodes: commandHandlerGraph.nodes.length,
						validationState: 'VALID'
					});
					commandHandlerResult = {
						bytes: commandHandlerWitness.bytes,
						candidateEdges: commandHandlerGraph.coverage.candidateEdges,
						commandRegistryEntries: commandHandlerGraph.coverage.discoveredCommandRegistryEntries,
						durationMs: Math.max(0, Math.round(performance.now() - commandHandlerStartedAt)),
						edges: commandHandlerGraph.edges.length,
						frontiers: commandHandlerGraph.coverage.frontierNodes,
						handlerRegistryEntries: commandHandlerGraph.coverage.discoveredHandlerRegistryEntries,
						nodes: commandHandlerGraph.nodes.length
					};

					if (SMOKE_PROJECTION_PLAN.runGuardClassificationOverlay) {
						if (guardObservation === null || stateMachineProjection === null)
							throw new Error(
								'The guard-classification overlay requires validated guard and state-machine predecessors.'
							);
						const guardOverlayStartedAt = performance.now();
						const guardOverlayBudgets = {
							maxAnchorSites: Math.max(1, guardObservation.guards.length),
							maxAstNodes: Math.max(1, snapshot.astNodes.length),
							maxCommandEvidenceLinks: Math.max(
								1,
								guardObservation.guardedArrows.length *
									Math.max(1, arrowObservation.declaredArrows.length)
							),
							maxDiagnostics: 100_000,
							maxFrontiers: Math.max(
								1,
								guardObservation.guardedArrows.length + guardObservation.guards.length * 2
							),
							maxGuardOccurrences: Math.max(1, guardObservation.guardedArrows.length),
							maxGuardRecords: Math.max(1, guardObservation.guards.length),
							maxHandlerLinks: Math.max(
								1,
								guardObservation.guards.length * Math.max(1, commandHandlerGraph.nodes.length)
							),
							maxSourceBytes: Math.max(1, subjectArtifactBytes),
							maxStateEvidenceRefs: Math.max(
								1,
								guardObservation.guardedArrows.length *
									Math.max(1, stateMachineProjection.graph.edges.length)
							)
						};
						const guardOverlayRequest = {
							arrowObservationId: arrowObservation.id,
							budgets: guardOverlayBudgets,
							commandHandlerGraphId: commandHandlerGraph.id,
							guardObservationId: guardObservation.id,
							operationVersion: GUARD_CLASSIFICATION_OVERLAY_OPERATION_VERSION,
							schemaVersion: GUARD_CLASSIFICATION_OVERLAY_REQUEST_SCHEMA_VERSION,
							semanticSnapshotId: snapshot.id,
							stateGraphId: stateMachineProjection.graph.id,
							stateObservationId: stateMachineProjection.observation.id,
							subjectId: subject.descriptor.subjectId
						};
						const guardOverlayInputs = {
							arrowObservation,
							commandHandlerGraph,
							commandHandlerRequest,
							guardObservation,
							request: guardOverlayRequest,
							semanticSnapshot: snapshot,
							stateGraph: stateMachineProjection.graph,
							stateGraphRequest: stateMachineProjection.request,
							stateObservation: stateMachineProjection.observation,
							subject
						};
						telemetry.start('GUARD_CLASSIFICATION_STATIC_OVERLAY', {
							budgetClassification: 'PROVISIONAL_CALLER_OPERATION_BUDGETS_NOT_PRODUCT_CEILINGS',
							budgets: guardOverlayBudgets,
							guardObservationId: guardObservation.id,
							stateGraphId: stateMachineProjection.graph.id
						});
						const guardOverlayOutcome = buildGuardClassificationOverlay(guardOverlayInputs, {
							onProgress(event) {
								process.stdout.write(`${JSON.stringify(event)}\n`);
							}
						});
						expect(
							guardOverlayOutcome.outcome,
							JSON.stringify(guardOverlayOutcome.diagnostics)
						).toBe('partial');
						if (guardOverlayOutcome.outcome !== 'partial')
							throw new Error(JSON.stringify(guardOverlayOutcome));
						const guardOverlay = guardOverlayOutcome.overlay;
						expect(
							validateGuardClassificationOverlay(guardOverlay, guardOverlayInputs, {
								maxInputRecords: 10_000_000,
								maxInputStringCharacters: 1_000_000_000,
								maxIssues: 100_000,
								maxRecords: 10_000_000,
								maxStringCharacters: 1_000_000_000
							})
						).toEqual({ issues: [], state: 'VALID' });
						expect(guardOverlay.coverage).toMatchObject({
							anchorSites: 12,
							candidateFactoryHandlerLinks: 1,
							classifications: 82,
							commandEvidenceLinks: 94,
							directHandlerLinks: 10,
							expectedClassifications: 82,
							expectedCommandEvidenceLinks: 94,
							expectedOccurrences: 146,
							expectedStateEvidenceRefs: 148,
							helperFrontiers: 3,
							noCommandEvidenceFrontiers: 55,
							occurrences: 146,
							reconciles: true,
							stateEvidenceRefs: 148
						});
						expect(guardOverlay.health).toBe('PARTIAL');
						expect(guardOverlay.runtimeEnforcement).toBe('NOT_CLAIMED');
						expect(guardOverlay.runtimePerformability).toBe('NOT_CLAIMED');
						expect(guardOverlay.fullJanCsaa007Conformance).toBe('NOT_CLAIMED');
						expect(guardOverlay.fullJanCsaa008Conformance).toBe('NOT_CLAIMED');
						const guardOverlayWitness = canonicalSemanticJsonWitness(guardOverlay);
						telemetry.complete({
							anchorSites: guardOverlay.coverage.anchorSites,
							bytes: guardOverlayWitness.bytes,
							candidateHandlerLinks: guardOverlay.coverage.candidateFactoryHandlerLinks,
							classifications: guardOverlay.coverage.classifications,
							commandEvidenceLinks: guardOverlay.coverage.commandEvidenceLinks,
							directHandlerLinks: guardOverlay.coverage.directHandlerLinks,
							frontiers: guardOverlay.coverage.frontiers,
							occurrences: guardOverlay.coverage.occurrences,
							stateEvidenceRefs: guardOverlay.coverage.stateEvidenceRefs,
							validationState: 'VALID'
						});
						guardClassificationOverlayResult = {
							anchorSites: guardOverlay.coverage.anchorSites,
							bytes: guardOverlayWitness.bytes,
							candidateHandlerLinks: guardOverlay.coverage.candidateFactoryHandlerLinks,
							classifications: guardOverlay.coverage.classifications,
							commandEvidenceLinks: guardOverlay.coverage.commandEvidenceLinks,
							directHandlerLinks: guardOverlay.coverage.directHandlerLinks,
							durationMs: Math.max(0, Math.round(performance.now() - guardOverlayStartedAt)),
							frontiers: guardOverlay.coverage.frontiers,
							occurrences: guardOverlay.coverage.occurrences,
							stateEvidenceRefs: guardOverlay.coverage.stateEvidenceRefs
						};
					} else
						telemetry.skip('GUARD_CLASSIFICATION_STATIC_OVERLAY', {
							reason: 'The selected smoke suite does not request the guard-classification overlay.',
							reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
						});

					const commandDispatchStartedAt = performance.now();
					const commandBusSelector = selectJpwbCommandDispatchTopology(snapshot);
					const commandBusSource = snapshot.sources.find(
						(source) => source.id === commandBusSelector.sourceId
					);
					if (commandBusSource === undefined)
						throw new Error(
							'The selected command-bus source is absent from the semantic snapshot.'
						);
					const handlerTargets = commandHandlerGraph.nodes.filter(
						(node) => node.kind === 'HANDLER_TARGET'
					).length;
					const commandDispatchBudgets = {
						maxAstNodes: Math.max(1, snapshot.astNodes.length),
						maxDiagnostics: 100_000,
						maxEdges: Math.max(1, handlerTargets),
						maxHandlerTargets: Math.max(1, handlerTargets),
						maxNodes: 1,
						maxSourceBytes: Math.max(1, commandBusSource.bytes)
					};
					const commandDispatchPhaseDurationsMs: Record<string, number> = {};
					telemetry.start('COMMAND_DISPATCH_STATIC_TOPOLOGY', {
						budgetClassification: 'PROVISIONAL_CALLER_OPERATION_BUDGETS_NOT_PRODUCT_CEILINGS',
						budgets: commandDispatchBudgets,
						predecessorGraphId: commandHandlerGraph.id,
						predecessorHandlerTargets: handlerTargets
					});
					const commandDispatchOutcome = buildCommandDispatchTopology(
						{
							budgets: commandDispatchBudgets,
							commandBus: commandBusSelector,
							commandHandlerGraphId: commandHandlerGraph.id,
							operationVersion: COMMAND_DISPATCH_TOPOLOGY_OPERATION_VERSION,
							schemaVersion: COMMAND_DISPATCH_TOPOLOGY_REQUEST_SCHEMA_VERSION,
							semanticSnapshotId: snapshot.id,
							subjectId: snapshot.subjectId
						},
						snapshot,
						commandHandlerGraph,
						arrowObservation,
						arrowSubject,
						{
							onProgress(event) {
								if (event.state !== 'STARTED')
									commandDispatchPhaseDurationsMs[event.phase] = event.monotonicDurationMs;
								process.stdout.write(`${JSON.stringify(event)}\n`);
							}
						}
					);
					expect(
						commandDispatchOutcome.outcome,
						JSON.stringify(commandDispatchOutcome.diagnostics)
					).toBe('partial');
					if (commandDispatchOutcome.outcome !== 'partial')
						throw new Error(JSON.stringify(commandDispatchOutcome));
					const commandDispatchGraph = commandDispatchOutcome.graph;
					const commandDispatchWitness = canonicalSemanticJsonWitness(commandDispatchGraph);
					expect(
						validateCommandDispatchTopology(
							commandDispatchGraph,
							{
								budgets: commandDispatchBudgets,
								commandBus: commandBusSelector,
								commandHandlerGraphId: commandHandlerGraph.id,
								operationVersion: COMMAND_DISPATCH_TOPOLOGY_OPERATION_VERSION,
								schemaVersion: COMMAND_DISPATCH_TOPOLOGY_REQUEST_SCHEMA_VERSION,
								semanticSnapshotId: snapshot.id,
								subjectId: snapshot.subjectId
							},
							snapshot,
							commandHandlerGraph,
							arrowObservation,
							arrowSubject,
							{
								maxIssues: 100_000,
								maxRecords: 10_000_000,
								maxStringCharacters: 1_000_000_000
							}
						)
					).toEqual({ issues: [], state: 'VALID' });
					expect(commandDispatchGraph.coverage.reconciles).toBe(true);
					expect(commandDispatchGraph.coverage.pipelineNodes).toBe(1);
					expect(commandDispatchGraph.coverage.representedPipelineFacts).toBe(5);
					expect(commandDispatchGraph.coverage.candidateHandlerTargetEdges).toBeGreaterThan(0);
					expect(commandDispatchGraph.edges.every((edge) => edge.attribution === 'CANDIDATE')).toBe(
						true
					);
					expect(commandDispatchGraph.retainedCommandDispatchCensus).toMatchObject({
						artifactPath: COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH,
						execution: 'NOT_EXECUTED_BY_CSAA',
						integration: 'NOT_INTEGRATED',
						verifierAuthority: 'RETAIN_DELEGATED'
					});
					expect(commandDispatchGraph.runtimeDispatchClosure).toBe('NOT_CLAIMED');
					expect(commandDispatchGraph.runtimePerformability).toBe('NOT_CLAIMED');
					telemetry.complete({
						adapterPhaseDurationsMs: commandDispatchPhaseDurationsMs,
						bytes: commandDispatchWitness.bytes,
						candidateEdges: commandDispatchGraph.coverage.candidateHandlerTargetEdges,
						nodes: commandDispatchGraph.nodes.length,
						pipelineFacts: commandDispatchGraph.coverage.representedPipelineFacts,
						retainedCensusBytes: commandDispatchGraph.retainedCommandDispatchCensus.artifactBytes,
						validationState: 'VALID'
					});
					commandDispatchTopologyResult = {
						bytes: commandDispatchWitness.bytes,
						candidateEdges: commandDispatchGraph.coverage.candidateHandlerTargetEdges,
						durationMs: Math.max(0, Math.round(performance.now() - commandDispatchStartedAt)),
						nodes: commandDispatchGraph.nodes.length,
						pipelineFacts: commandDispatchGraph.coverage.representedPipelineFacts,
						retainedCensusBytes: commandDispatchGraph.retainedCommandDispatchCensus.artifactBytes
					};
				} else if (SMOKE_SUITE === 'COMMAND_HANDLER_ONLY')
					throw new Error(
						`COMMAND_HANDLER_ONLY requires one exact subject, but semantic ${snapshot.subjectId} and retained observation ${arrowObservation.subjectId} differ.`
					);
				else {
					const skipDetails = {
						reason:
							'The semantic snapshot and retained observation have distinct exact subjects; use the structural common-subject smoke profile for this projection.',
						reasonCode: 'SUBJECT_IDENTITY_MISMATCH',
						semanticSubjectId: snapshot.subjectId,
						arrowObservationSubjectId: arrowObservation.subjectId
					};
					telemetry.skip('COMMAND_HANDLER_STATIC_PROJECTION', skipDetails);
					telemetry.skip('COMMAND_DISPATCH_STATIC_TOPOLOGY', skipDetails);
					telemetry.skip('GUARD_CLASSIFICATION_STATIC_OVERLAY', skipDetails);
				}

				let dependencyProviderResult: null | {
					readonly agreementRecords: number;
					readonly corroborationRecords: number;
					readonly dependencies: number;
					readonly durationMs: number;
					readonly health: string;
					readonly incomparableRecords: number;
					readonly modules: number;
					readonly observedDifferenceRecords: number;
					readonly records: number;
				} = null;
				if (SMOKE_PROJECTION_PLAN.runDependencyProviderComparison) {
					if (moduleDependencyGraph === null)
						throw new Error(
							'Dependency-provider comparison requires the module-dependency graph phase.'
						);
					const graph = moduleDependencyGraph;
					const dependencyCruiserInputPaths = providerInputPaths(projectPaths);
					const dependencyCruiserArgs = [
						'depcruise',
						...dependencyCruiserInputPaths,
						'--config',
						'.dependency-cruiser.cjs',
						'--output-type',
						'json'
					];
					const providerStartedAt = new Date();
					const dependencyProviderPipelineStartedMs = performance.now();
					telemetry.start('DEPENDENCY_CRUISER_EXECUTION', {
						inputPaths: dependencyCruiserInputPaths,
						provisionalRuntimeCancellationGuardMs: REPOSITORY_SMOKE_FAILSAFE_PROVIDER_DURATION_MS
					});
					const providerProcess = spawnSync('bunx', dependencyCruiserArgs, {
						cwd: REPOSITORY_ROOT,
						encoding: 'utf8',
						maxBuffer: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES,
						timeout: REPOSITORY_SMOKE_FAILSAFE_PROVIDER_DURATION_MS,
						windowsHide: true
					});
					const providerFinishedAt = new Date();
					if (providerProcess.error) throw providerProcess.error;
					expect(providerProcess.status).not.toBeNull();
					if (providerProcess.status === null)
						throw new Error(
							`dependency-cruiser terminated without an exit status: ${providerProcess.stderr}`
						);
					const providerRaw = providerProcess.stdout;
					const providerRawForBinding = JSON.parse(providerRaw) as {
						readonly summary?: { readonly optionsUsed?: { readonly baseDir?: unknown } };
					};
					const providerReportedBaseDir = providerRawForBinding.summary?.optionsUsed?.baseDir;
					if (typeof providerReportedBaseDir !== 'string' || !isAbsolute(providerReportedBaseDir))
						throw new Error(
							'dependency-cruiser did not report the expected absolute subject root.'
						);
					expect(resolve(providerReportedBaseDir)).toBe(resolve(REPOSITORY_ROOT));
					telemetry.complete({
						exitStatus: providerProcess.status,
						reportedBaseDirState: 'MATCHED_REPOSITORY_ROOT',
						stderrBytes: Buffer.byteLength(providerProcess.stderr, 'utf8'),
						stdoutBytes: Buffer.byteLength(providerRaw, 'utf8')
					});
					telemetry.start('DEPENDENCY_CRUISER_NORMALIZATION', {
						rawBytes: Buffer.byteLength(providerRaw, 'utf8')
					});
					const configBytes = readFileSync(`${REPOSITORY_ROOT}/.dependency-cruiser.cjs`);
					const providerNormalization = normalizeDependencyCruiserOutput(providerRaw, {
						argvGrammarVersion: DEPENDENCY_CRUISER_ARGV_GRAMMAR_VERSION,
						baseDir: '.',
						budgets: {
							maxCommandArgs: 1_000,
							maxDependencies: 5_000_000,
							maxDependents: 5_000_000,
							maxInputPaths: 100_000,
							maxIssues: 100_000,
							maxJsonDepth: 256,
							maxModules: 1_000_000,
							maxPathLength: 4_096,
							maxRawBytes: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES,
							maxRules: 1_000_000,
							maxStringLength: 1_000_000,
							maxSummaryViolations: 1_000_000,
							maxTotalStringCharacters: REPOSITORY_SMOKE_FAILSAFE_SUBJECT_BYTES
						},
						command: {
							args: dependencyCruiserArgs.slice(1),
							exitStatus: providerProcess.status,
							finishedAt: providerFinishedAt.toISOString(),
							startedAt: providerStartedAt.toISOString()
						},
						config: { path: '.dependency-cruiser.cjs', sha256: sha256(configBytes) },
						inputPaths: dependencyCruiserInputPaths,
						provider: {
							id: DEPENDENCY_CRUISER_PROVIDER_ID,
							version: DEPENDENCY_CRUISER_PROVIDER_VERSION
						},
						providerReportedBaseDir: {
							bytes: Buffer.byteLength(providerReportedBaseDir, 'utf8'),
							representation: 'ABSOLUTE',
							sha256: sha256(providerReportedBaseDir),
							state: 'PRESENT'
						},
						raw: {
							bytes: Buffer.byteLength(providerRaw, 'utf8'),
							sha256: sha256(providerRaw)
						},
						rawSchemaId: DEPENDENCY_CRUISER_RAW_SCHEMA_ID,
						schemaVersion: DEPENDENCY_CRUISER_INVOCATION_SCHEMA_VERSION,
						subjectRoot: {
							bytes: Buffer.byteLength(providerReportedBaseDir, 'utf8'),
							sha256: sha256(providerReportedBaseDir)
						},
						subjectId: snapshot.subjectId
					});
					expect(providerNormalization.outcome, JSON.stringify(providerNormalization)).toBe(
						'complete'
					);
					if (providerNormalization.outcome === 'unavailable')
						throw new Error(JSON.stringify(providerNormalization));
					const providerObservation = providerNormalization.observation;
					expect(validateDependencyCruiserObservation(providerObservation)).toEqual({
						issues: [],
						state: 'VALID'
					});
					telemetry.complete({
						dependencies: providerObservation.dependencies.length,
						health: providerObservation.health,
						modules: providerObservation.modules.length,
						outcome: providerNormalization.outcome,
						validationState: 'VALID'
					});
					telemetry.start('DEPENDENCY_PROVIDER_COMPARISON', {
						compilerEdges: graph.edges.length,
						providerDependencies: providerObservation.dependencies.length
					});
					const comparisonRequest = {
						budgets: {
							maxComparisonRecords: 5_000_000,
							maxDiagnostics: 100_000,
							maxRationaleCharacters: 100_000
						},
						dependencyCruiserObservationId: providerObservation.id,
						graphId: graph.id,
						negativeCoverage: {
							rationale:
								'The smoke invocation is intentionally bounded to selected input roots and the configured dependency-cruiser exclusions.',
							state: 'OPEN' as const
						},
						operationVersion: DEPENDENCY_PROVIDER_COMPARISON_OPERATION_VERSION,
						resolutionContext: {
							compilerContextDigest: sha256(
								canonicalSemanticJson({
									graphInputDigest: graph.graphInputDigest,
									projectIds: snapshot.projects.map((project) => project.id)
								})
							),
							providerContextDigest: sha256(
								canonicalSemanticJson({
									configDigest: providerObservation.invocation.config.sha256,
									inputPaths: providerObservation.invocation.inputPaths,
									optionsDigest: providerObservation.summary.optionsDigest
								})
							),
							rationale:
								'The compiler uses the selected project tsconfig context while dependency-cruiser uses the repository root tsconfig and its own resolver options.',
							state: 'NOT_EQUIVALENT' as const
						},
						schemaVersion: DEPENDENCY_PROVIDER_COMPARISON_REQUEST_SCHEMA_VERSION,
						semanticSnapshotId: snapshot.id,
						subjectId: snapshot.subjectId
					};
					const comparisonOutcome = compareDependencyProviders(
						comparisonRequest,
						snapshot,
						graph,
						providerObservation
					);
					expect(comparisonOutcome.outcome, JSON.stringify(comparisonOutcome)).toBe('partial');
					if (comparisonOutcome.outcome === 'unavailable')
						throw new Error(JSON.stringify(comparisonOutcome));
					const comparison = comparisonOutcome.comparison;
					expect(
						validateDependencyProviderComparison(
							comparison,
							comparisonRequest,
							snapshot,
							graph,
							providerObservation
						)
					).toEqual({ issues: [], state: 'VALID' });
					expect(comparison.coverage.reconciles).toBe(true);
					expect(comparison.coverage.recordCount).toBeGreaterThan(0);
					expect(
						comparison.limitations.some(
							(limitation) => limitation.kind === 'CONFLICT_QUALIFICATION_UNAVAILABLE'
						)
					).toBe(true);
					telemetry.complete({
						agreementRecords: comparison.coverage.agreementRecords,
						corroborationRecords: comparison.coverage.corroborationRecords,
						incomparableRecords: comparison.coverage.incomparableRecords,
						observedDifferenceRecords: comparison.coverage.observedDifferenceRecords,
						outcome: comparisonOutcome.outcome,
						records: comparison.coverage.recordCount,
						validationState: 'VALID'
					});
					dependencyProviderResult = {
						agreementRecords: comparison.coverage.agreementRecords,
						corroborationRecords: comparison.coverage.corroborationRecords,
						dependencies: providerObservation.dependencies.length,
						durationMs: Math.max(
							0,
							Math.round(performance.now() - dependencyProviderPipelineStartedMs)
						),
						health: providerObservation.health,
						incomparableRecords: comparison.coverage.incomparableRecords,
						modules: providerObservation.modules.length,
						observedDifferenceRecords: comparison.coverage.observedDifferenceRecords,
						records: comparison.coverage.recordCount
					};
				} else {
					const skipDetails = {
						reason: 'The selected smoke suite does not request dependency-provider execution.',
						reasonCode: 'SUITE_PHASE_NOT_REQUESTED'
					};
					telemetry.skip('DEPENDENCY_CRUISER_EXECUTION', skipDetails);
					telemetry.skip('DEPENDENCY_CRUISER_NORMALIZATION', skipDetails);
					telemetry.skip('DEPENDENCY_PROVIDER_COMPARISON', skipDetails);
				}
				if (SMOKE_SUITE === 'COMMAND_HANDLER_ONLY' && commandHandlerResult === null)
					throw new Error(
						'COMMAND_HANDLER_ONLY cannot complete without a validated command-handler projection.'
					);
				if (SMOKE_SUITE === 'COMMAND_HANDLER_ONLY' && commandDispatchTopologyResult === null)
					throw new Error(
						'COMMAND_HANDLER_ONLY cannot complete without a validated command-dispatch static topology.'
					);
				if (
					SMOKE_PROJECTION_PLAN.runGuardClassificationOverlay &&
					(guardEnforcementLedgerResult === null || guardClassificationOverlayResult === null)
				)
					throw new Error(
						'The selected smoke suite cannot complete without validated guard-ledger and guard-classification evidence.'
					);
				const exactSubjectReuse =
					arrowSubject === subject &&
					snapshot.subjectId === subject.descriptor.subjectId &&
					arrowArtifactSet.subjectId === snapshot.subjectId &&
					arrowObservation.subjectId === snapshot.subjectId;
				if (SMOKE_SUITE === 'COMMAND_HANDLER_ONLY') expect(exactSubjectReuse).toBe(true);
				const phaseDurationsMs = telemetry.phaseDurationsMs();
				const skippedPhases = telemetry.skippedPhases();
				telemetry.finish({
					arrowCommandCensusOutcome: arrowOutcome.outcome,
					commandDispatchStaticTopology: commandDispatchTopologyResult !== null,
					commandHandlerStaticProjection: commandHandlerResult !== null,
					exactSubjectReuse,
					guardClassificationStaticOverlay: guardClassificationOverlayResult !== null,
					guardEnforcementLedgerObserved: guardEnforcementLedgerResult !== null,
					semanticSnapshotOutcome: outcome.outcome,
					semanticProfile: SMOKE_PROFILE,
					skippedPhases,
					smokeSuite: SMOKE_SUITE,
					projects: snapshot.projects.length,
					sources: snapshot.sources.length,
					stateMachineProjected: stateMachineResult !== null
				});
				process.stdout.write(
					`${JSON.stringify({
						arrowCommandCensus: {
							adapterPhaseDurationsMs: arrowAdapterPhaseDurationsMs,
							artifactBytes: arrowArtifactBytes,
							artifactSetId: arrowArtifactSet.id,
							artifacts: arrowArtifactSet.artifacts.length,
							baselineMatches: arrowObservation.coverage.baselineMatches,
							declaredArrowOccurrences: arrowObservation.coverage.declaredArrowOccurrences,
							declaredSites: arrowObservation.coverage.declaredSites,
							externalModuleBytes,
							externalModuleFiles,
							outcome: arrowOutcome.outcome,
							observationBytes: arrowObservationWitness.bytes,
							observationId: arrowObservation.id,
							observationSha256: arrowObservationWitness.sha256,
							rawOutputBytes: arrowObservation.rawOutput.bytes,
							rawOutputId: arrowObservation.rawOutput.id,
							rawOutputSha256: arrowObservation.rawOutput.sha256,
							subjectId: arrowSubject.descriptor.subjectId,
							subjectScope: arrowSubject.request.scope.kind,
							subjectArtifactBytes: arrowSubjectBytes,
							subjectArtifacts: arrowSubject.artifacts.length,
							totalInScopeTopologyArrows: arrowObservation.coverage.totalInScopeTopologyArrows,
							uncoveredArrows: arrowObservation.coverage.uncoveredArrows
						},
						callGraph: callGraphResult,
						commandDispatchStaticTopology: commandDispatchTopologyResult,
						commandHandlerStaticProjection: commandHandlerResult,
						dependencyProviderComparison: dependencyProviderResult,
						event: 'CSAA_REPOSITORY_SMOKE_RESULT',
						exactSubjectReuse,
						guardClassificationStaticOverlay: guardClassificationOverlayResult,
						guardEnforcementLedger: guardEnforcementLedgerResult,
						moduleDependencyGraph: moduleDependencyGraphResult,
						readWriteAccessGraph: readWriteAccessGraphResult,
						projectCount: snapshot.projects.length,
						phaseDurationsMs,
						selectedSubjectArtifactBytes: subjectArtifactBytes,
						selectedSubjectArtifactCount: subject.artifacts.length,
						selector: SMOKE_SELECTOR ?? null,
						semanticPipelineDurationMs,
						semanticProfile: SMOKE_PROFILE,
						semanticSnapshotPhaseDurationsMs: semanticPhaseDurationsMs,
						semanticSnapshotProgressEvents: semanticProgressEvents.length,
						semanticSnapshotMemoryHighWaterBytes: semanticMemoryHighWaterBytes,
						semanticSnapshotWitness,
						skippedPhases,
						smokeSuite: SMOKE_SUITE,
						stateMachine: stateMachineResult,
						sourceCount: snapshot.sources.length
					})}\n`
				);
			} catch (error) {
				telemetry.fail(error);
				throw error;
			}
		},
		REPOSITORY_SMOKE_FAILSAFE_TEST_TIMEOUT_MS
	);
});
