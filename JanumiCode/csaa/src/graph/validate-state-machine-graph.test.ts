import { describe, expect, it } from 'vitest';

import {
	FULL_JAN_CSAA_008_CONFORMANCE,
	STATE_MACHINE_GRAPH_OPERATION_VERSION,
	STATE_MACHINE_GRAPH_REGISTRY_STATUS,
	STATE_MACHINE_GRAPH_REQUEST_SCHEMA_VERSION,
	STATE_MACHINE_GRAPH_SCOPE,
	STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_METHOD,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_SCHEMA_VERSION,
	type BuildStateMachineGraphRequest,
	type StateMachineGraphSnapshot,
	type StateMachineTopologyObservation
} from '../contracts/state-machine-graph.js';
import {
	FULL_JAN_CSAA_007_CONFORMANCE,
	SEMANTIC_EXTRACTION_VERSION,
	SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
	TYPESCRIPT_PROVIDER_VERSION,
	type StaticSemanticSnapshot
} from '../contracts/semantic.js';
import { buildStateMachineGraph } from './build-state-machine-graph.js';
import {
	stateMachineTopologyMachineId,
	stateMachineTopologyObservationId,
	stateMachineTopologyStateId
} from './state-machine-graph-ids.js';
import {
	stateMachineGraphContentDigest,
	stateMachineTopologyObservationContentDigest
} from './state-machine-graph-content.js';
import {
	validateConstructedStateMachineGraph,
	validateStateMachineGraph
} from './validate-state-machine-graph.js';

const SUBJECT_ID = 'a'.repeat(64);
const SOURCE_DIGEST = 'b'.repeat(64);
const SNAPSHOT_ID = 'semantic-snapshot:test';
const PROJECT_ID = 'semantic-project:test';
const PROGRAM_ID = 'semantic-program:test';
const SOURCE_ID = 'semantic-source:test';
const PROJECT_PROVENANCE_ID = 'semantic-provenance:project-source';
const SYNTAX_PROVENANCE_ID = 'semantic-provenance:syntax-source';
const LOGICAL_PATH = 'src/generated/state-machines.ts';
const PROVIDER = {
	api: 'PUBLIC_COMPILER_API',
	id: 'typescript',
	version: TYPESCRIPT_PROVIDER_VERSION
} as const;

interface Fixture {
	readonly graph: StateMachineGraphSnapshot;
	readonly observation: StateMachineTopologyObservation;
	readonly request: BuildStateMachineGraphRequest;
	readonly snapshot: StaticSemanticSnapshot;
}

function fixture(): Fixture {
	const artifact = {
		bytes: 1,
		canonicalPathKey: LOGICAL_PATH,
		disposition: 'ANALYZED',
		path: LOGICAL_PATH,
		primaryClass: 'GENERATED_SOURCE',
		roles: ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'GENERATED'],
		sha256: SOURCE_DIGEST
	} as const;
	const observationIdentity = {
		artifact,
		method: STATE_MACHINE_TOPOLOGY_OBSERVATION_METHOD,
		operationVersion: STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION,
		schemaVersion: STATE_MACHINE_TOPOLOGY_OBSERVATION_SCHEMA_VERSION,
		subjectId: SUBJECT_ID
	};
	const observationId = stateMachineTopologyObservationId(observationIdentity);
	const machineId = stateMachineTopologyMachineId(observationId, 'delivery');
	const stateId = stateMachineTopologyStateId(machineId, 'draft');
	const observationContent: Omit<StateMachineTopologyObservation, 'contentDigest'> = {
		artifact,
		budgets: {
			maxAstNodes: 16,
			maxCrossAxisRules: 16,
			maxDiagnostics: 16,
			maxMachines: 16,
			maxSourceBytes: 16,
			maxStates: 16,
			maxTextCharacters: 128,
			maxTransitions: 16
		},
		coverage: {
			crossAxisRules: 0,
			explicitlyIllegalTransitions: 0,
			guardedTransitions: 0,
			legalTransitions: 0,
			machines: 1,
			reconciles: true,
			states: 1
		},
		crossAxisRules: [],
		explicitlyIllegalTransitions: [],
		epistemic: {
			capabilityCoverage: 'PARTIAL',
			conflictState: 'NOT_EVALUATED',
			executionHealth: 'SUCCEEDED',
			freshness: 'SUBJECT_BOUND',
			inferenceState: 'NONE',
			supportBasis: 'DECLARED_GENERATED_TOPOLOGY'
		},
		fullJanCsaa007Conformance: FULL_JAN_CSAA_007_CONFORMANCE,
		fullJanCsaa008Conformance: FULL_JAN_CSAA_008_CONFORMANCE,
		guardedTransitions: [],
		id: observationId,
		legalTransitions: [],
		machines: [
			{
				explicitlyIllegalTransitionIds: [],
				guardedTransitionIds: [],
				id: machineId,
				initialState: null,
				legalTransitionIds: [],
				name: 'delivery',
				sourceSection: 'generated fixture',
				span: { end: 1, start: 0 },
				stateIds: [stateId],
				terminalStates: []
			}
		],
		method: STATE_MACHINE_TOPOLOGY_OBSERVATION_METHOD,
		operationVersion: STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION,
		producer: PROVIDER,
		registryStatus: STATE_MACHINE_GRAPH_REGISTRY_STATUS,
		schemaVersion: STATE_MACHINE_TOPOLOGY_OBSERVATION_SCHEMA_VERSION,
		scope: STATE_MACHINE_GRAPH_SCOPE,
		states: [
			{
				id: stateId,
				initial: false,
				machineId,
				name: 'draft',
				ordinal: 0,
				span: { end: 1, start: 0 },
				terminal: false
			}
		],
		subjectId: SUBJECT_ID,
		verifierAuthority: STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY
	};
	const observation: StateMachineTopologyObservation = {
		...observationContent,
		contentDigest: stateMachineTopologyObservationContentDigest(observationContent)
	};
	const provenanceBase = {
		epistemic: {},
		extractionVersion: SEMANTIC_EXTRACTION_VERSION,
		invalidationDependencies: [],
		limitations: [],
		projectId: PROJECT_ID,
		provider: PROVIDER,
		snapshotId: SNAPSHOT_ID,
		sourceId: SOURCE_ID,
		subjectId: SUBJECT_ID
	};
	const snapshot = {
		capabilities: [
			{ capability: 'TS_PROJECT', reason: 'fixture', state: 'SUPPORTED' },
			{ capability: 'TS_SYMBOL', reason: 'fixture', state: 'SUPPORTED' },
			{ capability: 'TS_SYNTAX', reason: 'fixture', state: 'SUPPORTED' }
		],
		extractionVersion: SEMANTIC_EXTRACTION_VERSION,
		health: 'PARTIAL',
		id: SNAPSHOT_ID,
		provenances: [
			{
				...provenanceBase,
				capability: 'TS_PROJECT',
				id: PROJECT_PROVENANCE_ID,
				parentProvenanceId: null
			},
			{
				...provenanceBase,
				capability: 'TS_SYNTAX',
				id: SYNTAX_PROVENANCE_ID,
				parentProvenanceId: PROJECT_PROVENANCE_ID
			}
		],
		provider: PROVIDER,
		schemaVersion: SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
		sources: [
			{
				analysisDisposition: 'DEEP_INDEXED',
				artifactClass: 'GENERATED_SOURCE',
				artifactRoles: artifact.roles,
				bytes: artifact.bytes,
				contentSha256: artifact.sha256,
				declarationFile: false,
				diagnosticIds: [],
				id: SOURCE_ID,
				languageVariant: 'Standard',
				logicalPath: LOGICAL_PATH,
				mapping: { reason: 'Fixture is already in source coordinates.', state: 'NOT_APPLICABLE' },
				moduleKind: 'MODULE',
				origin: 'GENERATED',
				programId: PROGRAM_ID,
				projectId: PROJECT_ID,
				provenanceId: PROJECT_PROVENANCE_ID,
				rootFile: true,
				rootNodeId: null,
				scriptKind: 3,
				scriptKindName: 'TS',
				syntaxProvenanceId: SYNTAX_PROVENANCE_ID,
				textLength: 1
			}
		],
		subjectId: SUBJECT_ID
	} as unknown as StaticSemanticSnapshot;
	const request = {
		budgets: { maxEdges: 16, maxNodes: 16 },
		observationId,
		operationVersion: STATE_MACHINE_GRAPH_OPERATION_VERSION,
		schemaVersion: STATE_MACHINE_GRAPH_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: snapshot.id,
		source: {
			logicalPath: LOGICAL_PATH,
			programId: PROGRAM_ID,
			projectId: PROJECT_ID,
			semanticSourceId: SOURCE_ID
		},
		subjectId: SUBJECT_ID
	} as BuildStateMachineGraphRequest;
	const outcome = buildStateMachineGraph(request, snapshot, observation);
	if (outcome.outcome !== 'partial')
		throw new Error(
			`Fixture graph failed: ${outcome.diagnostics[0]?.message ?? 'unknown failure'}`
		);
	return { graph: outcome.graph, observation, request, snapshot };
}

function finalized(graph: StateMachineGraphSnapshot): StateMachineGraphSnapshot {
	return { ...graph, contentDigest: stateMachineGraphContentDigest(graph) };
}

function codes(result: ReturnType<typeof validateStateMachineGraph>): readonly string[] {
	return result.issues.map((issue) => issue.code);
}

describe('state-machine graph validator', () => {
	it('accepts the exact canonical projection through public and producer entry points', () => {
		const { graph, observation, request, snapshot } = fixture();
		expect(validateStateMachineGraph(graph, request, snapshot, observation)).toEqual({
			issues: [],
			state: 'VALID'
		});
		expect(validateConstructedStateMachineGraph(graph, request, snapshot, observation)).toEqual({
			issues: [],
			state: 'VALID'
		});
	});

	it('rejects non-closed records, accessors, Proxies, and non-scalar text', () => {
		const { graph, observation, request, snapshot } = fixture();
		const expanded = { ...graph, unexpected: true };
		const accessor = structuredClone(graph) as StateMachineGraphSnapshot;
		Object.defineProperty(accessor, 'id', { enumerable: true, get: () => graph.id });
		const nonScalar = { ...graph, subjectId: '\ud800' };
		for (const candidate of [expanded, accessor, new Proxy(graph, {}), nonScalar])
			expect(codes(validateStateMachineGraph(candidate, request, snapshot, observation))).toContain(
				'INVALID_SHAPE'
			);
	});

	it('recomputes graph identity and the finalized content digest', () => {
		const { graph, observation, request, snapshot } = fixture();
		const identityMutation = finalized({ ...graph, id: `${graph.id}:mutated` as never });
		expect(
			codes(validateStateMachineGraph(identityMutation, request, snapshot, observation))
		).toContain('IDENTITY_MISMATCH');
		const digestMutation = { ...graph, contentDigest: '0'.repeat(64) };
		expect(
			codes(validateStateMachineGraph(digestMutation, request, snapshot, observation))
		).toContain('CONTENT_DIGEST_MISMATCH');
	});

	it('binds the exact source selector and caller-supplied population budgets', () => {
		const { graph, observation, request, snapshot } = fixture();
		const sourceMutation = finalized({
			...graph,
			source: { ...graph.source, logicalPath: 'src/generated/other.ts' }
		});
		expect(
			codes(validateStateMachineGraph(sourceMutation, request, snapshot, observation))
		).toContain('SOURCE_BINDING_MISMATCH');
		const boundedRequest = { ...request, budgets: { maxEdges: 16, maxNodes: 1 } };
		const boundedGraph = finalized({ ...graph, budgets: boundedRequest.budgets });
		expect(
			codes(validateStateMachineGraph(boundedGraph, boundedRequest, snapshot, observation))
		).toContain('POPULATION_BUDGET_EXCEEDED');
	});

	it('reconciles exact limitations, indexes, and complete node/edge populations', () => {
		const { graph, observation, request, snapshot } = fixture();
		const limitationMutation = finalized({
			...graph,
			limitations: graph.limitations.map((item, index) =>
				index === 0 ? { ...item, reason: `${item.reason} mutated` } : item
			)
		});
		expect(
			codes(validateStateMachineGraph(limitationMutation, request, snapshot, observation))
		).toContain('LIMITATION_MISMATCH');

		const indexMutation = finalized({ ...graph, forwardIndex: graph.forwardIndex.slice(1) });
		expect(
			codes(validateStateMachineGraph(indexMutation, request, snapshot, observation))
		).toContain('POPULATION_MISMATCH');

		const populationMutation = finalized({ ...graph, edges: graph.edges.slice(1) });
		expect(
			codes(validateStateMachineGraph(populationMutation, request, snapshot, observation))
		).toContain('POPULATION_MISMATCH');
	});

	it('keeps maxIssues as a report-count budget rather than a graph-capacity ceiling', () => {
		const { graph, observation, request, snapshot } = fixture();
		const mutation = finalized({
			...graph,
			id: `${graph.id}:mutated` as never,
			limitations: [],
			nodes: []
		});
		const result = validateStateMachineGraph(mutation, request, snapshot, observation, {
			maxIssues: 1
		});
		expect(result.issues).toHaveLength(1);
		expect(result.state).toBe('BUDGET_EXHAUSTED');
	});

	it('reports malformed nested wire shapes and unsupported request or graph versions', () => {
		const { graph, observation, request, snapshot } = fixture();
		const sparseNodes = [...graph.nodes];
		delete sparseNodes[0];
		const candidates: readonly {
			readonly graph: unknown;
			readonly request: unknown;
			readonly code: string;
		}[] = [
			{
				code: 'INVALID_SHAPE',
				graph: { ...graph, budgets: { ...graph.budgets, maxEdges: 0 } },
				request
			},
			{
				code: 'INVALID_SHAPE',
				graph: { ...graph, source: { ...graph.source, logicalPath: '' } },
				request
			},
			{ code: 'INVALID_SHAPE', graph: { ...graph, nodes: {} }, request },
			{ code: 'INVALID_SHAPE', graph: { ...graph, nodes: sparseNodes }, request },
			{ code: 'INVALID_SHAPE', graph: { ...graph, nodes: [null] }, request },
			{
				code: 'INVALID_SHAPE',
				graph: { ...graph, nodes: [{ ...graph.nodes[0], kind: 'UNKNOWN' }] },
				request
			},
			{
				code: 'UNSUPPORTED_SCHEMA_VERSION',
				graph: { ...graph, schemaVersion: 'state-machine-graph/future' },
				request
			},
			{
				code: 'UNSUPPORTED_SCHEMA_VERSION',
				graph,
				request: { ...request, schemaVersion: 'state-machine-graph-request/future' }
			},
			{
				code: 'INVALID_VALUE',
				graph,
				request: { ...request, operationVersion: 'state-machine-graph-operation/future' }
			}
		];
		for (const candidate of candidates)
			expect(
				codes(validateStateMachineGraph(candidate.graph, candidate.request, snapshot, observation))
			).toContain(candidate.code);
	});

	it('checks every independent identity, source, provider, capability, and provenance binding', () => {
		const { graph, observation, request, snapshot } = fixture();
		const source = snapshot.sources[0]!;
		const scenarios: readonly {
			readonly code: string;
			readonly graph?: StateMachineGraphSnapshot;
			readonly observation?: StateMachineTopologyObservation;
			readonly request?: BuildStateMachineGraphRequest;
			readonly snapshot?: StaticSemanticSnapshot;
		}[] = [
			{
				code: 'IDENTITY_MISMATCH',
				request: { ...request, semanticSnapshotId: 'semantic-snapshot:other' as never }
			},
			{
				code: 'IDENTITY_MISMATCH',
				request: { ...request, observationId: 'state-machine-observation:other' as never }
			},
			{ code: 'IDENTITY_MISMATCH', request: { ...request, subjectId: 'other-subject' } },
			{
				code: 'GRAPH_INPUT_MISMATCH',
				graph: finalized({ ...graph, budgets: { maxEdges: 17, maxNodes: 17 } })
			},
			{
				code: 'POPULATION_BUDGET_EXCEEDED',
				graph: finalized({
					...graph,
					budgets: { maxEdges: 1, maxNodes: 16 },
					edges: [...graph.edges, graph.edges[0]!]
				}),
				request: { ...request, budgets: { maxEdges: 1, maxNodes: 16 } }
			},
			{
				code: 'CONFORMANCE_OVERCLAIM',
				graph: finalized({
					...graph,
					epistemic: { ...graph.epistemic, executionHealth: 'SUCCEEDED' }
				})
			},
			{
				code: 'SOURCE_BINDING_MISMATCH',
				graph: finalized({
					...graph,
					source: { ...graph.source, semanticSourceId: 'semantic-source:absent' as never }
				}),
				request: {
					...request,
					source: { ...request.source, semanticSourceId: 'semantic-source:absent' as never }
				}
			},
			{
				code: 'SOURCE_BINDING_MISMATCH',
				snapshot: {
					...snapshot,
					sources: [{ ...source, logicalPath: 'src/generated/different.ts' }]
				} as StaticSemanticSnapshot
			},
			{
				code: 'SOURCE_BINDING_MISMATCH',
				graph: finalized({
					...graph,
					producer: { ...graph.producer, version: '5.9.3-forged' as never }
				})
			},
			{
				code: 'SOURCE_BINDING_MISMATCH',
				snapshot: {
					...snapshot,
					capabilities: snapshot.capabilities.filter((record) => record.capability !== 'TS_SYMBOL')
				} as StaticSemanticSnapshot
			},
			{
				code: 'SOURCE_BINDING_MISMATCH',
				snapshot: {
					...snapshot,
					provenances: snapshot.provenances.map((record, index) =>
						index === 0 ? { ...record, sourceId: 'semantic-source:forged' as never } : record
					)
				} as StaticSemanticSnapshot
			}
		];
		for (const scenario of scenarios) {
			const result = validateStateMachineGraph(
				scenario.graph ?? graph,
				scenario.request ?? request,
				scenario.snapshot ?? snapshot,
				scenario.observation ?? observation
			);
			expect(codes(result), JSON.stringify(result)).toContain(scenario.code);
		}
	});

	it('checks edge/node relations, canonical order, coverage, and observation validity independently', () => {
		const { graph, observation, request, snapshot } = fixture();
		const firstEdge = graph.edges[0]!;
		const firstNode = graph.nodes[0]!;
		const otherCode =
			firstEdge.relationCode === 'IMPL-JPWB-SM-CONTAINS-STATE-001'
				? 'IMPL-JPWB-SM-LEGAL-TRANSITION-001'
				: 'IMPL-JPWB-SM-CONTAINS-STATE-001';
		const graphScenarios: readonly [string, StateMachineGraphSnapshot][] = [
			[
				'POPULATION_MISMATCH',
				finalized({
					...graph,
					coverage: { ...graph.coverage, expectedStates: graph.coverage.expectedStates + 1 }
				})
			],
			['NONCANONICAL_ORDER', finalized({ ...graph, nodes: [...graph.nodes].reverse() })],
			[
				'DANGLING_REFERENCE',
				finalized({
					...graph,
					edges: [
						{
							...firstEdge,
							source: { ...firstEdge.source, nodeId: 'graph-node:absent' as never }
						},
						...graph.edges.slice(1)
					]
				})
			],
			[
				'DANGLING_REFERENCE',
				finalized({
					...graph,
					edges: [
						{
							...firstEdge,
							source: {
								...firstEdge.source,
								kind: firstEdge.source.kind === 'MACHINE' ? 'STATE' : 'MACHINE'
							}
						},
						...graph.edges.slice(1)
					]
				})
			],
			[
				'INVALID_VALUE',
				finalized({
					...graph,
					edges: [{ ...firstEdge, relationCode: otherCode }, ...graph.edges.slice(1)]
				})
			],
			[
				'SOURCE_BINDING_MISMATCH',
				finalized({
					...graph,
					edges: [{ ...firstEdge, provenanceIds: [] }, ...graph.edges.slice(1)]
				})
			],
			[
				'SOURCE_BINDING_MISMATCH',
				finalized({
					...graph,
					nodes: [{ ...firstNode, provenanceIds: [] }, ...graph.nodes.slice(1)]
				})
			]
		];
		for (const [code, candidate] of graphScenarios) {
			const result = validateStateMachineGraph(candidate, request, snapshot, observation);
			expect(codes(result), JSON.stringify(result)).toContain(code);
		}

		const invalidObservation = {
			...observation,
			contentDigest: '0'.repeat(64)
		};
		expect(
			codes(validateStateMachineGraph(graph, request, snapshot, invalidObservation))
		).toContain('OBSERVATION_INVALID');
	});

	it('validates report budgets and catches hostile semantic snapshot access', () => {
		const { graph, observation, request, snapshot } = fixture();
		for (const maxIssues of [0, 100_001])
			expect(
				validateStateMachineGraph(graph, request, snapshot, observation, { maxIssues })
			).toMatchObject({
				issues: [{ code: 'INVALID_VALUE', path: '$validationOptions.maxIssues' }],
				state: 'INVALID'
			});

		const capabilities = new Proxy(snapshot.capabilities, {
			get(target, property, receiver) {
				if (property === 'filter') throw new Error('hostile capability population');
				return Reflect.get(target, property, receiver);
			}
		});
		const hostileSnapshot = { ...snapshot, capabilities } as StaticSemanticSnapshot;
		expect(
			codes(validateStateMachineGraph(graph, request, hostileSnapshot, observation))
		).toContain('INVALID_SHAPE');
	});
});
