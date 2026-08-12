import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	STATE_MACHINE_GRAPH_OPERATION_VERSION,
	STATE_MACHINE_GRAPH_REQUEST_SCHEMA_VERSION,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_REQUEST_SCHEMA_VERSION,
	type BuildStateMachineGraphRequest,
	type BuildStateMachineTopologyObservationRequest,
	type StateMachineGraphSnapshot,
	type StateMachineTopologyObservation
} from '../contracts/state-machine-graph.js';
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
import { observeStateMachineTopology } from '../providers/jpwb-state-machines/observe-state-machines.js';
import { validateStateMachineTopologyObservation } from '../providers/jpwb-state-machines/validate-state-machine-observation.js';
import { buildStaticSemanticSnapshot } from '../semantic/build-static-semantic-snapshot.js';
import { resolveSubject } from '../subject/resolve-subject.js';
import { buildStateMachineGraph } from './build-state-machine-graph.js';
import { stateMachineGraphContentDigest } from './state-machine-graph-content.js';
import { validateStateMachineGraph } from './validate-state-machine-graph.js';

const SOURCE_PATH = 'packages/domain/src/transitions.data.ts';
const temporaryRoots: string[] = [];

const TRANSITIONS = `// GENERATED FILE — do not edit by hand.
export const STATE_MACHINES = {
  'Work.lifecycle': {
    name: 'Work.lifecycle',
    states: ['PROPOSED', 'EXECUTING', 'DONE'],
    initialState: 'PROPOSED',
    terminalStates: ['DONE'],
    transitions: [
      { from: 'PROPOSED', to: 'EXECUTING', trigger: 'start', guard: 'authorized', note: '§1' },
      { from: 'EXECUTING', to: 'DONE', trigger: 'finish' }
    ],
    illegal: [{ from: 'DONE', to: 'EXECUTING', reason: 'terminal' }],
		guarded: [
			{ from: 'PROPOSED', to: 'EXECUTING', reason: 'requires authorization' },
			{ from: 'PROPOSED', to: 'EXECUTING', reason: 'requires an approved plan' }
		],
    sourceSection: 'fixture §1'
  },
  'Execution.status': {
    name: 'Execution.status',
    states: ['IDLE', 'RUNNING'],
    initialState: 'IDLE',
    terminalStates: [],
    transitions: [{ from: 'IDLE', to: 'RUNNING' }],
    illegal: [],
    guarded: []
  }
};
export const CROSS_AXIS_RULES = [
  { machine: 'Work.lifecycle', from: 'execution=SUCCEEDED', to: 'DONE', reason: 'separate axis' }
];
`;

function write(root: string, path: string, content: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, content, 'utf8');
}

function json(root: string, path: string, value: unknown): void {
	write(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

function fixtureRoot(): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-state-machine-graph-'));
	temporaryRoots.push(root);
	json(root, 'package.json', { name: 'fixture', private: true, workspaces: ['packages/*'] });
	json(root, 'packages/domain/package.json', {
		name: '@fixture/domain',
		private: true,
		version: '0.0.0'
	});
	json(root, 'packages/domain/tsconfig.json', {
		compilerOptions: {
			module: 'NodeNext',
			moduleResolution: 'NodeNext',
			noEmit: true,
			noLib: true,
			strict: true,
			target: 'ES2022'
		},
		files: ['src/transitions.data.ts']
	});
	write(root, SOURCE_PATH, TRANSITIONS);
	write(root, 'bun.lock', 'fixture lock\n');
	return root;
}

function subjectRequest(root: string): ResolveSubjectRequest {
	return {
		budgets: {
			maxBytes: 8 * 1024 * 1024,
			maxConfigDepth: 16,
			maxDiagnostics: 1_000,
			maxDurationMs: 30_000,
			maxFiles: 1_000,
			maxProjects: 10
		},
		filters: { exclude: [], include: [] },
		operationVersion: 'state-machine-graph-test/1',
		outputs: [],
		policyVersion: SUBJECT_POLICY_VERSION,
		rootLocator: root,
		schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
		scope: { kind: 'EXPLICIT_PROJECTS', projects: ['packages/domain/tsconfig.json'] },
		subjectKind: 'WORKTREE'
	};
}

function semanticBudgets(): SemanticBudgets {
	return {
		maxAstDepth: 128,
		maxAstNodes: 50_000,
		maxCompilerInputMetadataBytes: 4 * 1024 * 1024,
		maxCompilerQueries: 50_000,
		maxCompilerFacts: 50_000,
		maxCompilerQueryInvocations: 500_000,
		maxContextBytes: 8 * 1024 * 1024,
		maxContextFileBytes: 2 * 1024 * 1024,
		maxContextFiles: 1_000,
		maxDiagnosticCharacters: 100_000,
		maxDiagnostics: 1_000,
		maxDirectoryEntries: 10_000,
		maxDurationMs: 30_000,
		maxLiteralCharacters: 10_000,
		maxPathCharacters: 1_000,
		maxProjects: 10,
		maxScopes: 10_000,
		maxSnapshotBytes: 32 * 1024 * 1024,
		maxSources: 1_000
	};
}

interface BuiltFixture {
	readonly graphRequest: BuildStateMachineGraphRequest;
	readonly observation: StateMachineTopologyObservation;
	readonly observationRequest: BuildStateMachineTopologyObservationRequest;
	readonly snapshot: StaticSemanticSnapshot;
	readonly subject: FrozenSubject;
}

function builtFixture(): BuiltFixture {
	const root = fixtureRoot();
	const subjectOutcome = resolveSubject(subjectRequest(root));
	if (subjectOutcome.outcome !== 'resolved') throw new Error(JSON.stringify(subjectOutcome));
	const subject = subjectOutcome.subject;
	const semanticRequest: BuildStaticSemanticSnapshotRequest = {
		assignabilityRequests: [],
		budgets: semanticBudgets(),
		capabilities: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'],
		expectEmpty: false,
		operationVersion: SEMANTIC_OPERATION_VERSION,
		rootLocator: root,
		schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
		subjectId: subject.descriptor.subjectId
	};
	const semanticOutcome = buildStaticSemanticSnapshot(semanticRequest, { subject });
	if (semanticOutcome.outcome === 'unavailable' || semanticOutcome.outcome === 'incompatible')
		throw new Error(JSON.stringify(semanticOutcome));
	const snapshot = semanticOutcome.snapshot;
	const artifact = subject.artifacts.find((item) => item.path === SOURCE_PATH)!;
	const observationRequest: BuildStateMachineTopologyObservationRequest = {
		artifact: {
			bytes: artifact.bytes,
			canonicalPathKey: artifact.canonicalPathKey,
			disposition: 'ANALYZED',
			path: artifact.path,
			primaryClass: artifact.primaryClass,
			roles: artifact.roles,
			sha256: artifact.sha256
		},
		budgets: {
			maxAstNodes: Math.max(1, artifact.bytes * 2),
			maxCrossAxisRules: Math.max(1, artifact.bytes),
			maxDiagnostics: Math.max(1, artifact.bytes),
			maxMachines: Math.max(1, artifact.bytes),
			maxSourceBytes: Math.max(1, artifact.bytes),
			maxStates: Math.max(1, artifact.bytes),
			maxTextCharacters: Math.max(1, artifact.bytes * 2),
			maxTransitions: Math.max(1, artifact.bytes)
		},
		operationVersion: STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION,
		schemaVersion: STATE_MACHINE_TOPOLOGY_OBSERVATION_REQUEST_SCHEMA_VERSION,
		subjectId: subject.descriptor.subjectId
	};
	const observationOutcome = observeStateMachineTopology(observationRequest, { subject });
	if (observationOutcome.outcome !== 'complete')
		throw new Error(JSON.stringify(observationOutcome));
	const observation = observationOutcome.observation;
	const source = snapshot.sources.find((item) => item.logicalPath === SOURCE_PATH)!;
	const graphRequest: BuildStateMachineGraphRequest = {
		budgets: { maxEdges: artifact.bytes, maxNodes: artifact.bytes },
		observationId: observation.id,
		operationVersion: STATE_MACHINE_GRAPH_OPERATION_VERSION,
		schemaVersion: STATE_MACHINE_GRAPH_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: snapshot.id,
		source: {
			logicalPath: source.logicalPath,
			programId: source.programId,
			projectId: source.projectId,
			semanticSourceId: source.id
		},
		subjectId: snapshot.subjectId
	};
	return { graphRequest, observation, observationRequest, snapshot, subject };
}

function graphOf(fixture: BuiltFixture): StateMachineGraphSnapshot {
	const outcome = buildStateMachineGraph(
		fixture.graphRequest,
		fixture.snapshot,
		fixture.observation
	);
	expect(outcome.outcome, JSON.stringify(outcome)).toBe('partial');
	if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
	return outcome.graph;
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('generated JPWB state-machine topology graph', () => {
	it('builds a deterministic, independently validated, explicitly partial graph', () => {
		const fixture = builtFixture();
		expect(validateStateMachineTopologyObservation(fixture.observation, fixture.subject)).toEqual({
			issues: [],
			state: 'VALID'
		});
		const graph = graphOf(fixture);
		expect(
			buildStateMachineGraph(fixture.graphRequest, fixture.snapshot, fixture.observation)
		).toMatchObject({
			graph,
			outcome: 'partial'
		});
		expect(
			validateStateMachineGraph(graph, fixture.graphRequest, fixture.snapshot, fixture.observation)
		).toEqual({
			issues: [],
			state: 'VALID'
		});
		expect(graph.coverage).toMatchObject({
			crossAxisRuleEdges: 1,
			explicitlyIllegalTransitionEdges: 1,
			expectedGuardedTransitions: 2,
			expectedLegalTransitions: 2,
			guardedLegalTransitionEdges: 2,
			legalTransitionEdges: 2,
			machineNodes: 2,
			reconciles: true,
			stateContainmentEdges: 5,
			stateNodes: 5
		});
		expect(graph.edges.map((edge) => edge.relationKind)).toEqual(
			expect.arrayContaining([
				'CONTAINS_STATE',
				'DECLARES_CROSS_AXIS_RULE',
				'EXPLICITLY_ILLEGAL_TRANSITION',
				'GUARDED_LEGAL_TRANSITION',
				'LEGAL_TRANSITION'
			])
		);
		expect(graph.edges.every((edge) => !edge.relationCode.startsWith('REL-'))).toBe(true);
		const guardedEdges = graph.edges.filter(
			(edge) => edge.relationKind === 'GUARDED_LEGAL_TRANSITION'
		);
		expect(guardedEdges).toHaveLength(2);
		expect(guardedEdges.map((edge) => edge.reason).sort()).toEqual([
			'requires an approved plan',
			'requires authorization'
		]);
		expect(guardedEdges.every((edge) => edge.sourceLocations.length === 2)).toBe(true);
		expect(graph).toMatchObject({
			closure: 'OPEN',
			fullJanCsaa007Conformance: 'NOT_CLAIMED',
			fullJanCsaa008Conformance: 'NOT_CLAIMED',
			health: 'PARTIAL',
			registryStatus: 'IMPLEMENTATION_LOCAL_UNREGISTERED',
			scope: 'GENERATED_RUNTIME_TOPOLOGY_ONLY',
			verifierAuthority: 'RETAINED_DELEGATED'
		});
		expect(graph.contentDigest).toBe(stateMachineGraphContentDigest(graph));
		expect(graph.limitations.map((item) => item.kind)).toEqual(
			expect.arrayContaining([
				'COMMAND_PERFORMABILITY_NOT_ANALYZED',
				'CROSS_AXIS_EFFECT_NOT_MODELED',
				'GUARD_ENFORCEMENT_NOT_ANALYZED',
				'RELATION_REGISTRY_UNAVAILABLE',
				'WHOLE_PROGRAM_REACHABILITY_NOT_ANALYZED'
			])
		);
	});

	it.each([
		[
			'snapshot',
			(fixture: BuiltFixture) => ({ ...fixture.graphRequest, semanticSnapshotId: 'wrong' })
		],
		['subject', (fixture: BuiltFixture) => ({ ...fixture.graphRequest, subjectId: 'wrong' })],
		[
			'observation',
			(fixture: BuiltFixture) => ({ ...fixture.graphRequest, observationId: 'wrong' })
		],
		[
			'source',
			(fixture: BuiltFixture) => ({
				...fixture.graphRequest,
				source: { ...fixture.graphRequest.source, logicalPath: 'wrong.ts' }
			})
		]
	])('fails closed for a mismatched %s binding', (_name, revise) => {
		const fixture = builtFixture();
		expect(
			buildStateMachineGraph(revise(fixture), fixture.snapshot, fixture.observation).outcome
		).toBe('unavailable');
	});

	it('enforces caller graph budgets without treating them as product ceilings', () => {
		const fixture = builtFixture();
		for (const budgets of [
			{ maxEdges: 1, maxNodes: 10_000 },
			{ maxEdges: 10_000, maxNodes: 1 }
		]) {
			expect(
				buildStateMachineGraph(
					{ ...fixture.graphRequest, budgets },
					fixture.snapshot,
					fixture.observation
				)
			).toMatchObject({ diagnostics: [{ code: 'BUDGET_EXHAUSTED' }], outcome: 'unavailable' });
		}
		expect(
			buildStateMachineGraph(
				{
					...fixture.graphRequest,
					budgets: { maxEdges: Number.MAX_SAFE_INTEGER, maxNodes: Number.MAX_SAFE_INTEGER }
				},
				fixture.snapshot,
				fixture.observation
			).outcome
		).toBe('partial');
	});

	it('rejects hostile and non-closed requests without invoking accessors', () => {
		const fixture = builtFixture();
		let invoked = false;
		const accessor = { ...fixture.graphRequest } as Record<string, unknown>;
		Object.defineProperty(accessor, 'subjectId', {
			enumerable: true,
			get: () => {
				invoked = true;
				return fixture.graphRequest.subjectId;
			}
		});
		for (const value of [
			null,
			[],
			new Proxy(fixture.graphRequest, {}),
			accessor,
			{ ...fixture.graphRequest, extra: true },
			{ ...fixture.graphRequest, operationVersion: 'wrong' },
			{ ...fixture.graphRequest, schemaVersion: 'wrong' },
			{ ...fixture.graphRequest, budgets: { ...fixture.graphRequest.budgets, maxEdges: 0 } },
			{ ...fixture.graphRequest, source: { ...fixture.graphRequest.source, extra: true } }
		])
			expect(buildStateMachineGraph(value, fixture.snapshot, fixture.observation).outcome).toBe(
				'unavailable'
			);
		expect(invoked).toBe(false);
	});

	it('rejects invalid observations, missing semantic capability, and forged generated-source binding', () => {
		const fixture = builtFixture();
		const invalidObservation = structuredClone(
			fixture.observation
		) as StateMachineTopologyObservation;
		(invalidObservation as unknown as { contentDigest: string }).contentDigest = '0'.repeat(64);
		expect(
			buildStateMachineGraph(fixture.graphRequest, fixture.snapshot, invalidObservation)
		).toMatchObject({
			diagnostics: [{ code: 'OBSERVATION_INVALID' }],
			outcome: 'unavailable'
		});
		const missingCapability = {
			...fixture.snapshot,
			capabilities: fixture.snapshot.capabilities.filter((item) => item.capability !== 'TS_SYMBOL')
		};
		expect(
			buildStateMachineGraph(fixture.graphRequest, missingCapability, fixture.observation)
		).toMatchObject({
			diagnostics: [{ code: 'SEMANTIC_CAPABILITY_UNAVAILABLE' }],
			outcome: 'unavailable'
		});
		const forgedSource = {
			...fixture.snapshot,
			sources: fixture.snapshot.sources.map((source) =>
				source.id === fixture.graphRequest.source.semanticSourceId
					? { ...source, origin: 'AUTHORED' as const }
					: source
			)
		};
		expect(
			buildStateMachineGraph(fixture.graphRequest, forgedSource, fixture.observation)
		).toMatchObject({
			diagnostics: [{ code: 'SOURCE_BINDING_MISMATCH' }],
			outcome: 'unavailable'
		});
	});
});
