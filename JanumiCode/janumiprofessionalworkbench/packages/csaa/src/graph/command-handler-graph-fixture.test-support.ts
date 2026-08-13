import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
	ARROW_COMMAND_CENSUS_ADAPTER_ID,
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_RAW_OUTPUT_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
	type ArrowCommandCensusArtifactSetBinding,
	type ArrowCommandCensusBudgets,
	type ArrowCommandCensusExecutorIdentity,
	type ArrowCommandCensusObservation,
	type ArrowCommandCensusRawOutput,
	type ObserveArrowCommandCensusRequest
} from '../contracts/arrow-command-census.js';
import {
	COMMAND_HANDLER_GRAPH_OPERATION_VERSION,
	COMMAND_HANDLER_GRAPH_REQUEST_SCHEMA_VERSION,
	type BuildCommandHandlerGraphRequest,
	type CommandHandlerRegistrySelector
} from '../contracts/command-handler-graph.js';
import {
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	type BuildStaticSemanticSnapshotRequest,
	type SemanticBudgets,
	type StaticSemanticSnapshot
} from '../contracts/semantic.js';
import {
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	type FrozenSubject,
	type ResolveSubjectRequest
} from '../contracts/subject.js';
import {
	buildArrowCommandCensusArtifactSet,
	validateArrowCommandCensusArtifactSet
} from '../providers/jpwb-arrow-command-census/artifact-set.js';
import { normalizeArrowCommandCensusObservation } from '../providers/jpwb-arrow-command-census/normalize-arrow-command-census.js';
import { validateArrowCommandCensusObservation } from '../providers/jpwb-arrow-command-census/validate-arrow-command-census.js';
import { buildStaticSemanticSnapshot } from '../semantic/build-static-semantic-snapshot.js';
import { resolveSubject } from '../subject/resolve-subject.js';

const COMMAND_REGISTRY_PATH = 'packages/rph-contracts/src/messages.ts';
const COMMAND_REGISTRY_PROJECT = 'packages/rph-contracts/tsconfig.json';
const HANDLER_REGISTRY_PATH = 'packages/rph-application/src/handlers/registry.ts';
const HANDLER_REGISTRY_PROJECT = 'packages/rph-application/tsconfig.json';
const HANDLER_SOURCE_PATH = 'packages/rph-application/src/handlers/work.ts';
const RETAINED_VERIFIER_PATH = 'verif/arrow-command-census.ts';
const FIXTURE_SHA = 'a'.repeat(64);

const DIRECT_HANDLER_SOURCE = [
	'function advanceStatus<T>(value: T): T { return value; }',
	'',
	'export const startWork = () => {',
	"\treturn advanceStatus({ machine: 'Work.status', target: 'STARTED' });",
	'};',
	''
].join('\n');

const FACTORY_HANDLER_SOURCE = [
	'function advanceStatus<T>(value: T): T { return value; }',
	'',
	'export function makeWorkHandler() {',
	'\treturn () => {',
	"\t\treturn advanceStatus({ machine: 'Work.status', target: 'STARTED' });",
	'\t};',
	'}',
	'',
	'export const startWork = makeWorkHandler();',
	''
].join('\n');

const INITIALIZER_FACTORY_HANDLER_SOURCE = [
	'function advanceStatus<T>(value: T): T { return value; }',
	'',
	'export const makeWorkHandler = () => {',
	'\treturn () => {',
	"\t\treturn advanceStatus({ machine: 'Work.status', target: 'STARTED' });",
	'\t};',
	'};',
	'',
	'export const startWork = makeWorkHandler();',
	''
].join('\n');

const NESTED_DIRECT_HANDLER_SOURCE = [
	'function advanceStatus<T>(value: T): T { return value; }',
	'',
	'export const startWork = () => {',
	'\tconst guard = () => {',
	"\t\treturn 'authorized';",
	'\t};',
	'\tguard();',
	"\treturn advanceStatus({ machine: 'Work.status', target: 'STARTED' });",
	'};',
	''
].join('\n');

type HandlerFixtureVariant =
	| 'DIRECT'
	| 'EMPTY'
	| 'FACTORY'
	| 'FACTORY_INITIALIZER'
	| 'NESTED_DIRECT'
	| 'SHARED_DIRECT'
	| 'TABLE';

function handlerSource(variant: HandlerFixtureVariant): string {
	if (variant === 'FACTORY') return FACTORY_HANDLER_SOURCE;
	if (variant === 'FACTORY_INITIALIZER') return INITIALIZER_FACTORY_HANDLER_SOURCE;
	if (variant === 'NESTED_DIRECT') return NESTED_DIRECT_HANDLER_SOURCE;
	return DIRECT_HANDLER_SOURCE;
}

function handlerSiteLine(source: string): number {
	return source.split('\n').findIndex((line) => line.includes('return advanceStatus')) + 1;
}

function write(root: string, path: string, contents: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents, 'utf8');
}

function json(root: string, path: string, value: unknown): void {
	write(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

function createRepository(variant: HandlerFixtureVariant): {
	readonly handlerSiteLine: number;
	readonly root: string;
} {
	const root = mkdtempSync(join(tmpdir(), 'csaa-command-handler-graph-'));
	const source = handlerSource(variant);
	json(root, 'package.json', {
		name: 'command-handler-graph-fixture',
		private: true,
		workspaces: ['packages/*']
	});
	write(root, 'bun.lock', 'fixture lock\n');

	for (const [directory, name] of [
		['rph-application', '@fixture/rph-application'],
		['rph-contracts', '@fixture/rph-contracts'],
		['rph-domain', '@fixture/rph-domain']
	] as const)
		json(root, `packages/${directory}/package.json`, {
			name,
			private: true,
			type: 'module',
			version: '0.0.0'
		});

	json(root, COMMAND_REGISTRY_PROJECT, {
		compilerOptions: {
			module: 'NodeNext',
			moduleResolution: 'NodeNext',
			noEmit: true,
			noLib: true,
			strict: true,
			target: 'ES2022'
		},
		files: ['src/index.ts', 'src/messages.ts']
	});
	json(root, HANDLER_REGISTRY_PROJECT, {
		compilerOptions: {
			module: 'NodeNext',
			moduleResolution: 'NodeNext',
			noEmit: true,
			noLib: true,
			strict: true,
			target: 'ES2022'
		},
		files: ['src/command-bus.ts', 'src/handlers/registry.ts', 'src/handlers/work.ts']
	});
	json(root, 'packages/rph-domain/tsconfig.json', {
		compilerOptions: {
			module: 'NodeNext',
			moduleResolution: 'NodeNext',
			noEmit: true,
			noLib: true,
			strict: true,
			target: 'ES2022'
		},
		files: [
			'src/index.ts',
			'src/machine-exclusions.ts',
			'src/pwu-lifecycle-command-spec.ts',
			'src/step-command-spec.ts',
			'src/transitions.data.ts'
		]
	});

	const commandEntry = (commandName: string, eventName: string): string => `
	${commandName}: {
		payload: StartWorkPayloadSchema,
		targetAggregateType: 'WORK',
		emitsEvent: '${eventName}',
		firstSlice: false
	}`;
	const commandEntries =
		variant === 'EMPTY'
			? ''
			: variant === 'SHARED_DIRECT'
				? `${commandEntry('StartWork', 'WorkStarted')},${commandEntry('ResumeWork', 'WorkResumed')}`
				: commandEntry('StartWork', 'WorkStarted');
	write(
		root,
		COMMAND_REGISTRY_PATH,
		`export const StartWorkPayloadSchema = {};
export const COMMANDS = {${commandEntries}
} as const;
`
	);
	write(root, 'packages/rph-contracts/src/index.ts', "export * from './messages.js';\n");
	const handlerEntries =
		variant === 'EMPTY'
			? ''
			: variant === 'SHARED_DIRECT'
				? 'StartWork: startWork, ResumeWork: startWork'
				: 'StartWork: startWork';
	write(
		root,
		HANDLER_REGISTRY_PATH,
		`import { startWork } from './work.js';
export const HANDLERS = { ${handlerEntries} } as const;
`
	);
	write(root, HANDLER_SOURCE_PATH, source);
	write(
		root,
		'packages/rph-application/src/command-bus.ts',
		`import { COMMANDS } from '../../rph-contracts/src/messages.js';
import { HANDLERS } from './handlers/registry.js';

function validateAgainst(_schema: unknown, value: unknown, _context: unknown) {
	return { ok: true as const, value };
}

export class CommandBus {
	private dispatchStamped(command: { commandType: keyof typeof COMMANDS; payload: unknown }) {
		const spec = COMMANDS[command.commandType];
		if (!spec) return null;
		const parsed = validateAgainst(spec.payload, command.payload, {});
		if (!parsed.ok) return null;
		const handler = HANDLERS[command.commandType];
		if (!handler) return null;
		const ctx = {};
		return handler(ctx, command, parsed.value);
	}
}
`
	);

	write(root, 'packages/rph-domain/src/index.ts', "export * from './transitions.data.js';\n");
	write(
		root,
		'packages/rph-domain/src/machine-exclusions.ts',
		'export const isExcludedMachine = () => false;\n'
	);
	write(
		root,
		'packages/rph-domain/src/pwu-lifecycle-command-spec.ts',
		'export const PWU_LIFECYCLE_COMMAND_SPECS = {};\n'
	);
	write(
		root,
		'packages/rph-domain/src/step-command-spec.ts',
		variant === 'TABLE'
			? "export const STEP_COMMAND_SPECS = { StartWork: { machine: 'Work.status' } } as const;\n"
			: 'export const STEP_COMMAND_SPECS = {};\n'
	);
	write(
		root,
		'packages/rph-domain/src/transitions.data.ts',
		`// GENERATED FILE - fixture only.
export const STATE_MACHINES = {
	'Work.status': {
		name: 'Work.status',
		states: ['PROPOSED', 'STARTED'],
		initialState: 'PROPOSED',
		terminalStates: ['STARTED'],
		transitions: [
			{ from: 'PROPOSED', to: 'STARTED', trigger: 'start', guard: 'operator is authorized' }
		],
		illegal: [],
		guarded: [
			{ from: 'PROPOSED', to: 'STARTED', reason: 'requires an authenticated operator' },
			{ from: 'PROPOSED', to: 'STARTED', reason: 'requires command authorization' }
		]
	}
};
export const CROSS_AXIS_RULES = [];
`
	);

	write(root, RETAINED_VERIFIER_PATH, 'export const retainedArrowCensus = true;\n');
	write(
		root,
		'verif/arrow-command-census.baseline.json',
		'{"dead":[],"orphans":[],"total":1,"unanalysed":[],"uncovered":[]}\n'
	);
	write(root, 'verif/arrow-census-coverage.test.ts', 'export const retainedCoverage = true;\n');
	write(root, 'verif/arrow-command-census.test.ts', 'export const retainedOracle = true;\n');
	write(
		root,
		'verif/command-dispatch-census.test.ts',
		'// Retained delegated fixture; CSAA records but does not execute this census.\n'
	);
	write(
		root,
		'verif/guard-enforcement-ledger.ts',
		`export interface GuardRow {
	readonly disposition: 'ENFORCED' | 'UNENFORCED';
	readonly evidence: string;
	readonly enforcingSite?: string;
	readonly enforcingAnchor?: string;
}
export const retainedGuardLedgerAnalyzer = true;
`
	);
	write(
		root,
		'verif/guard-enforcement-ledger.data.ts',
		`import type { GuardRow } from './guard-enforcement-ledger.js';
export const GUARD_LEDGER: Readonly<Record<string, GuardRow>> = {
	['operator is authorized']: {
		disposition: 'ENFORCED',
		evidence: 'The direct fixture handler contains the retained refusing anchor.',
		enforcingSite: 'packages/rph-application/src/handlers/work.ts:999',
		enforcingAnchor: "return advanceStatus({ machine: 'Work.status', target: 'STARTED' });"
	}
};
`
	);
	write(
		root,
		'verif/guard-enforcement-ledger.test.ts',
		'// Retained guard-ledger authority fixture; CSAA does not execute this test.\n'
	);
	return { handlerSiteLine: handlerSiteLine(source), root };
}

function subjectRequest(root: string): ResolveSubjectRequest {
	return {
		budgets: {
			maxBytes: 16 * 1024 * 1024,
			maxConfigDepth: 32,
			maxDiagnostics: 1_000,
			maxDurationMs: 30_000,
			maxFiles: 10_000,
			maxProjects: 10
		},
		filters: { exclude: [], include: [] },
		operationVersion: 'command-handler-graph-fixture/1.0.0',
		outputs: [],
		policyVersion: SUBJECT_POLICY_VERSION,
		rootLocator: root,
		schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
		scope: { kind: 'REPOSITORY' },
		subjectKind: 'WORKTREE'
	};
}

function semanticBudgets(): SemanticBudgets {
	return {
		maxAstDepth: 128,
		maxAstNodes: 100_000,
		maxCompilerInputMetadataBytes: 8 * 1024 * 1024,
		maxCompilerQueries: 100_000,
		maxCompilerFacts: 100_000,
		maxCompilerQueryInvocations: 1_000_000,
		maxContextBytes: 16 * 1024 * 1024,
		maxContextFileBytes: 4 * 1024 * 1024,
		maxContextFiles: 10_000,
		maxDiagnosticCharacters: 1_000_000,
		maxDiagnostics: 10_000,
		maxDirectoryEntries: 100_000,
		maxDurationMs: 60_000,
		maxLiteralCharacters: 10_000,
		maxPathCharacters: 2_000,
		maxProjects: 10,
		maxScopes: 100_000,
		maxSnapshotBytes: 64 * 1024 * 1024,
		maxSources: 10_000
	};
}

function semanticSnapshot(root: string, subject: FrozenSubject): StaticSemanticSnapshot {
	const request: BuildStaticSemanticSnapshotRequest = {
		assignabilityRequests: [],
		budgets: semanticBudgets(),
		capabilities: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'],
		expectEmpty: false,
		operationVersion: SEMANTIC_OPERATION_VERSION,
		rootLocator: root,
		schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
		subjectId: subject.descriptor.subjectId
	};
	const outcome = buildStaticSemanticSnapshot(request, { subject });
	if (outcome.outcome === 'unavailable' || outcome.outcome === 'incompatible')
		throw new Error(`Semantic fixture construction failed: ${JSON.stringify(outcome)}`);
	return outcome.snapshot;
}

function buildArrowArtifactSetFixture(
	subject: FrozenSubject
): ArrowCommandCensusArtifactSetBinding {
	const totalBytes = subject.artifacts.reduce((sum, artifact) => sum + artifact.bytes, 0);
	const outcome = buildArrowCommandCensusArtifactSet(
		{
			budgets: {
				maxArtifacts: subject.artifacts.length + 1,
				maxDiagnostics: 1_000,
				maxTotalBytes: totalBytes + 1
			},
			operationVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION,
			schemaVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
			subjectId: subject.descriptor.subjectId
		},
		{ subject }
	);
	if (outcome.outcome !== 'complete')
		throw new Error(`Arrow artifact-set fixture construction failed: ${JSON.stringify(outcome)}`);
	const validation = validateArrowCommandCensusArtifactSet(outcome.artifactSet, subject);
	if (validation.state !== 'VALID')
		throw new Error(`Arrow artifact-set fixture is invalid: ${JSON.stringify(validation)}`);
	return outcome.artifactSet;
}

function arrowBudgets(): ArrowCommandCensusBudgets {
	return {
		maxArtifacts: 1_000,
		maxBirthStates: 100,
		maxDeclaredArrowOccurrences: 100,
		maxDeclaredSites: 100,
		maxDiagnostics: 100,
		maxExecutorDurationMs: 30_000,
		maxExternalModuleBytes: 100_000_000,
		maxExternalModuleFiles: 10_000,
		maxMachines: 100,
		maxMapStates: 100,
		maxMaterializedBytes: 16 * 1024 * 1024,
		maxOutputStringCharacters: 100_000,
		maxRawArrayEntries: 1_000,
		maxRawJsonDepth: 20,
		maxStderrBytes: 10_000,
		maxStdoutBytes: 1_000_000
	};
}

function executorIdentity(
	artifactSet: ArrowCommandCensusArtifactSetBinding
): ArrowCommandCensusExecutorIdentity {
	const retainedVerifier = artifactSet.artifacts.find(
		(artifact) => artifact.path === RETAINED_VERIFIER_PATH
	);
	if (retainedVerifier === undefined)
		throw new Error('Retained verifier is absent from the fixture set.');
	return {
		adapterId: ARROW_COMMAND_CENSUS_ADAPTER_ID,
		adapterVersion: ARROW_COMMAND_CENSUS_OPERATION_VERSION,
		executableBytes: 1,
		executableSha256: FIXTURE_SHA,
		externalModules: [
			{
				bytes: 1,
				contentDigest: FIXTURE_SHA,
				files: 1,
				name: 'typescript',
				version: '5.9.3'
			},
			{ bytes: 1, contentDigest: FIXTURE_SHA, files: 1, name: 'ulid', version: '2.4.0' },
			{ bytes: 1, contentDigest: FIXTURE_SHA, files: 1, name: 'zod', version: '4.4.3' }
		],
		retainedVerifierCanonicalPathKey: retainedVerifier.canonicalPathKey,
		retainedVerifierSha256: retainedVerifier.sha256,
		runtime: 'bun',
		runtimeVersion: '1.3.14',
		worker: { bytes: 1, sha256: FIXTURE_SHA }
	};
}

function rawArrowEvidence(site: string): ArrowCommandCensusRawOutput {
	return {
		baseline: { dead: [], orphans: [], total: 1, unanalysed: [], uncovered: [] },
		births: [{ machine: 'Work.status', states: ['PROPOSED'] }],
		census: { orphans: [], total: 1, uncovered: [] },
		deadCovered: { dead: [], unanalysed: [] },
		declaredArrows: [
			{
				from: 'PROPOSED',
				machine: 'Work.status',
				site,
				to: 'STARTED'
			}
		],
		occupiable: [{ machine: 'Work.status', states: ['PROPOSED', 'STARTED'] }],
		schemaVersion: ARROW_COMMAND_CENSUS_RAW_OUTPUT_SCHEMA_VERSION
	};
}

function arrowObservation(
	artifactSet: ArrowCommandCensusArtifactSetBinding,
	subject: FrozenSubject,
	site: string
): ArrowCommandCensusObservation {
	const request: ObserveArrowCommandCensusRequest = {
		artifactSetId: artifactSet.id,
		budgets: arrowBudgets(),
		operationVersion: ARROW_COMMAND_CENSUS_OPERATION_VERSION,
		schemaVersion: ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
		subjectId: subject.descriptor.subjectId
	};
	const observation = normalizeArrowCommandCensusObservation({
		artifactSet,
		evidence: rawArrowEvidence(site),
		executor: executorIdentity(artifactSet),
		request
	}).observation;
	const validation = validateArrowCommandCensusObservation(observation, subject);
	if (validation.state !== 'VALID')
		throw new Error(`Arrow observation fixture is invalid: ${JSON.stringify(validation)}`);
	return observation;
}

function registrySelector(
	snapshot: StaticSemanticSnapshot,
	logicalPath: string,
	projectConfigPath: string,
	exportName: CommandHandlerRegistrySelector['exportName']
): CommandHandlerRegistrySelector {
	const projectIds = new Set(
		snapshot.projects
			.filter((project) => project.configPath === projectConfigPath)
			.map((project) => project.id)
	);
	const sources = snapshot.sources.filter(
		(source) => source.logicalPath === logicalPath && projectIds.has(source.projectId)
	);
	if (sources.length !== 1)
		throw new Error(
			`Expected one ${logicalPath} source in ${projectConfigPath}; found ${sources.length}.`
		);
	const source = sources[0]!;
	const declarations = snapshot.declarations.filter(
		(declaration) => declaration.sourceId === source.id && declaration.name === exportName
	);
	if (declarations.length !== 1)
		throw new Error(`Expected one ${exportName} declaration; found ${declarations.length}.`);
	return {
		contentSha256: source.contentSha256,
		declarationId: declarations[0]!.id,
		exportName,
		logicalPath,
		programId: source.programId,
		projectConfigPath,
		projectId: source.projectId,
		sourceId: source.id
	};
}

function graphRequest(
	snapshot: StaticSemanticSnapshot,
	observation: ArrowCommandCensusObservation
): BuildCommandHandlerGraphRequest {
	return {
		arrowObservationId: observation.id,
		budgets: {
			maxAstNodes: 100_000,
			maxCommandRegistryEntries: 100,
			maxEdges: 1_000,
			maxFrontiers: 1_000,
			maxHandlerRegistryEntries: 100,
			maxNodes: 1_000,
			maxSourceBytes: 4 * 1024 * 1024
		},
		commandRegistry: registrySelector(
			snapshot,
			COMMAND_REGISTRY_PATH,
			COMMAND_REGISTRY_PROJECT,
			'COMMANDS'
		),
		handlerRegistry: registrySelector(
			snapshot,
			HANDLER_REGISTRY_PATH,
			HANDLER_REGISTRY_PROJECT,
			'HANDLERS'
		),
		operationVersion: COMMAND_HANDLER_GRAPH_OPERATION_VERSION,
		schemaVersion: COMMAND_HANDLER_GRAPH_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: snapshot.id,
		subjectId: snapshot.subjectId
	};
}

export interface CommandHandlerGraphFixture {
	readonly arrowArtifactSet: ArrowCommandCensusArtifactSetBinding;
	readonly cleanup: () => void;
	readonly graphRequest: BuildCommandHandlerGraphRequest;
	readonly observation: ArrowCommandCensusObservation;
	readonly root: string;
	readonly snapshot: StaticSemanticSnapshot;
	readonly subject: FrozenSubject;
}

/**
 * Builds a real compiler-backed, exact-subject fixture without executing the retained verifier.
 * The arrow observation is produced through the normalizer and validated against the same subject.
 */
function createFixture(variant: HandlerFixtureVariant): CommandHandlerGraphFixture {
	const repository = createRepository(variant);
	const { root } = repository;
	let cleaned = false;
	const cleanup = (): void => {
		if (cleaned) return;
		cleaned = true;
		rmSync(root, { force: true, recursive: true });
	};
	try {
		const subjectOutcome = resolveSubject(subjectRequest(root));
		if (subjectOutcome.outcome !== 'resolved')
			throw new Error(`Subject fixture construction failed: ${JSON.stringify(subjectOutcome)}`);
		const subject = subjectOutcome.subject;
		const snapshot = semanticSnapshot(root, subject);
		const arrowArtifactSet = buildArrowArtifactSetFixture(subject);
		const site =
			variant === 'TABLE'
				? 'STEP_COMMAND_SPECS.StartWork'
				: `work.ts:${repository.handlerSiteLine}`;
		const observation = arrowObservation(arrowArtifactSet, subject, site);
		return {
			arrowArtifactSet,
			cleanup,
			graphRequest: graphRequest(snapshot, observation),
			observation,
			root,
			snapshot,
			subject
		};
	} catch (error) {
		cleanup();
		throw error;
	}
}

export function createCommandHandlerGraphFixture(): CommandHandlerGraphFixture {
	return createFixture('DIRECT');
}

/** Factory-result variant used to exercise explicitly candidate graph relations and frontiers. */
export function createFactoryCommandHandlerGraphFixture(): CommandHandlerGraphFixture {
	return createFixture('FACTORY');
}

/** Factory-result variant whose factory callable is reached through a variable initializer. */
export function createInitializerFactoryCommandHandlerGraphFixture(): CommandHandlerGraphFixture {
	return createFixture('FACTORY_INITIALIZER');
}

/** Places the retained site inside a nested callback contained by the direct registered handler. */
export function createNestedDirectCommandHandlerGraphFixture(): CommandHandlerGraphFixture {
	return createFixture('NESTED_DIRECT');
}

/** Table-locator variant used to verify independent semantic command-table attribution. */
export function createTableCommandHandlerGraphFixture(): CommandHandlerGraphFixture {
	return createFixture('TABLE');
}

/** Two commands deliberately share one direct callable implementation. */
export function createSharedDirectCommandHandlerGraphFixture(): CommandHandlerGraphFixture {
	return createFixture('SHARED_DIRECT');
}

/** Empty source-of-truth registries used to enforce non-vacuous population validation. */
export function createEmptyCommandHandlerGraphFixture(): CommandHandlerGraphFixture {
	return createFixture('EMPTY');
}
