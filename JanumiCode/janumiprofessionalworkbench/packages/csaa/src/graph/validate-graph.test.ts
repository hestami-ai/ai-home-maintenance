import { describe, expect, it } from 'vitest';
import {
	MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
	MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
	type ModuleDependencyGraphSnapshot
} from '../contracts/graph.js';
import {
	SEMANTIC_EXTRACTION_VERSION,
	SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
	type SemanticModuleResolutionId,
	type SemanticNodeId,
	type SemanticProgramId,
	type SemanticProjectId,
	type SemanticProvenanceId,
	type SemanticSnapshotId,
	type SemanticSourceId,
	type StaticSemanticSnapshot
} from '../contracts/semantic.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import { buildModuleDependencyGraph } from './build-module-dependency-graph.js';
import { validateModuleDependencyGraph } from './validate-graph.js';

const snapshotId = 'static:ts-snapshot-fixture' as SemanticSnapshotId;
const projectId = 'semantic:project-fixture' as SemanticProjectId;
const programId = 'semantic:program-fixture' as SemanticProgramId;
const sourceA = 'semantic:source-a' as SemanticSourceId;
const sourceB = 'semantic:source-b' as SemanticSourceId;
const sourceAProvenance = 'semantic:provenance-source-a' as SemanticProvenanceId;
const sourceBProvenance = 'semantic:provenance-source-b' as SemanticProvenanceId;
const resolutionProvenance = 'semantic:provenance-resolution' as SemanticProvenanceId;
const occurrenceNodeId = 'semantic:node-import' as SemanticNodeId;
const resolutionId = 'semantic:module-resolution-import' as SemanticModuleResolutionId;

function semanticSnapshot(): StaticSemanticSnapshot {
	return {
		astNodes: [{ end: 22, id: occurrenceNodeId, kind: 273, sourceId: sourceA, start: 0 }],
		capabilities: [
			{ capability: 'TS_PROJECT', reason: 'fixture', state: 'SUPPORTED' },
			{ capability: 'TS_SYMBOL', reason: 'fixture', state: 'SUPPORTED' },
			{ capability: 'TS_SYNTAX', reason: 'fixture', state: 'SUPPORTED' }
		],
		expectedEmpty: false,
		extractionVersion: SEMANTIC_EXTRACTION_VERSION,
		health: 'COMPLETE',
		id: snapshotId,
		moduleResolutions: [
			{
				id: resolutionId,
				moduleSymbolId: null,
				nodeId: occurrenceNodeId,
				occurrenceKind: 'IMPORT',
				provenanceId: resolutionProvenance,
				resolutionState: 'RESOLVED_SOURCE',
				sourceId: sourceA,
				specifier: './b.js',
				specifierState: 'LITERAL',
				targetSourceId: sourceB,
				typeOnly: false
			}
		],
		provenances: [
			{ id: resolutionProvenance, snapshotId, subjectId: 'fixture-subject' },
			{ id: sourceAProvenance, snapshotId, subjectId: 'fixture-subject' },
			{ id: sourceBProvenance, snapshotId, subjectId: 'fixture-subject' }
		],
		provider: { api: 'PUBLIC_COMPILER_API', id: 'typescript', version: '5.9.3' },
		schemaVersion: SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
		sources: [
			{
				analysisDisposition: 'DEEP_INDEXED',
				id: sourceA,
				logicalPath: 'src/a.ts',
				programId,
				projectId,
				provenanceId: sourceAProvenance,
				textLength: 24
			},
			{
				analysisDisposition: 'DEEP_INDEXED',
				id: sourceB,
				logicalPath: 'src/b.ts',
				programId,
				projectId,
				provenanceId: sourceBProvenance,
				textLength: 20
			}
		],
		subjectId: 'fixture-subject'
	} as unknown as StaticSemanticSnapshot;
}

function validGraph(snapshot: StaticSemanticSnapshot): ModuleDependencyGraphSnapshot {
	const outcome = buildModuleDependencyGraph(
		{
			operationVersion: MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
			schemaVersion: MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
			semanticSnapshotId: snapshot.id,
			subjectId: snapshot.subjectId
		},
		snapshot
	);
	if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
	return outcome.graph;
}

function clone(graph: ModuleDependencyGraphSnapshot): ModuleDependencyGraphSnapshot {
	return JSON.parse(canonicalSemanticJson(graph)) as ModuleDependencyGraphSnapshot;
}

function unresolvedSemanticSnapshot(): StaticSemanticSnapshot {
	const snapshot = semanticSnapshot();
	return {
		...snapshot,
		moduleResolutions: [
			{
				...snapshot.moduleResolutions[0]!,
				resolutionState: 'UNRESOLVED',
				targetSourceId: null
			}
		]
	} as StaticSemanticSnapshot;
}

function issueCodes(
	graph: ModuleDependencyGraphSnapshot,
	snapshot: StaticSemanticSnapshot
): readonly string[] {
	const result = validateModuleDependencyGraph(graph, snapshot);
	return result.issues.map((issue) => issue.code);
}

describe('validateModuleDependencyGraph', () => {
	it('keeps an external classification while using an available context source endpoint', () => {
		const base = semanticSnapshot();
		const snapshot = {
			...base,
			moduleResolutions: [
				{ ...base.moduleResolutions[0]!, resolutionState: 'RESOLVED_EXTERNAL' as const }
			]
		} as StaticSemanticSnapshot;
		const graph = validGraph(snapshot);
		expect(graph).toMatchObject({
			coverage: {
				closure: 'OPEN',
				graphNativeTargets: 0,
				resolvedExternalTargets: 1
			},
			health: 'PARTIAL'
		});
		expect(graph.edges[0]?.target.kind).toBe('SOURCE');
		expect(graph.limitations).toContainEqual(
			expect.objectContaining({ kind: 'NON_SOURCE_MODULE_TARGET' })
		);
		expect(validateModuleDependencyGraph(graph, snapshot)).toEqual({
			issues: [],
			state: 'VALID'
		});
	});

	it('accepts the exact deterministic module-dependency graph', () => {
		const snapshot = semanticSnapshot();
		expect(validateModuleDependencyGraph(validGraph(snapshot), snapshot)).toEqual({
			issues: [],
			state: 'VALID'
		});
	});

	it('rejects nested hostile graph and provenance properties before optimized indexes inspect them', () => {
		const snapshot = unresolvedSemanticSnapshot();
		const graph = clone(validGraph(snapshot));
		const target = graph.nodes.find((node) => node.kind === 'RESOLUTION_TARGET')!;
		const moduleResolutionId = target.moduleResolutionId;
		let graphGetterHits = 0;
		Object.defineProperty(target, 'moduleResolutionId', {
			enumerable: true,
			get() {
				graphGetterHits += 1;
				return moduleResolutionId;
			}
		});
		expect(validateModuleDependencyGraph(graph, snapshot, { maxIssues: 1 })).toMatchObject({
			issues: [expect.objectContaining({ code: 'INVALID_SHAPE' })],
			state: 'BUDGET_EXHAUSTED'
		});
		expect(graphGetterHits).toBe(0);

		const kindGraph = clone(validGraph(snapshot));
		const kindTarget = kindGraph.nodes.find((node) => node.kind === 'RESOLUTION_TARGET')!;
		let kindGetterHits = 0;
		Object.defineProperty(kindTarget, 'kind', {
			enumerable: true,
			get() {
				kindGetterHits += 1;
				return 'RESOLUTION_TARGET';
			}
		});
		expect(validateModuleDependencyGraph(kindGraph, snapshot)).toMatchObject({ state: 'INVALID' });
		expect(kindGetterHits).toBe(0);

		const symbolGraph = clone(validGraph(snapshot));
		Object.defineProperty(symbolGraph, Symbol('hostile'), { enumerable: true, value: true });
		expect(validateModuleDependencyGraph(symbolGraph, snapshot)).toMatchObject({
			issues: [expect.objectContaining({ code: 'INVALID_SHAPE' })],
			state: 'INVALID'
		});

		const proxyGraph = clone(validGraph(snapshot));
		const targetIndex = proxyGraph.nodes.findIndex((node) => node.kind === 'RESOLUTION_TARGET');
		let proxyTrapHits = 0;
		(proxyGraph.nodes as ModuleDependencyGraphSnapshot['nodes'][number][])[targetIndex] = new Proxy(
			proxyGraph.nodes[targetIndex]!,
			{
				getPrototypeOf() {
					proxyTrapHits += 1;
					throw new Error('nested graph proxy trap');
				}
			}
		);
		const proxyResult = validateModuleDependencyGraph(proxyGraph, snapshot);
		expect(proxyResult.state).toBe('INVALID');
		expect(proxyResult.issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'INVALID_SHAPE' })])
		);
		expect(proxyTrapHits).toBe(0);

		const provenanceRecords = snapshot.provenances.map((record) => ({ ...record }));
		const hostileSnapshot = {
			...snapshot,
			provenances: provenanceRecords
		} as StaticSemanticSnapshot;
		const provenanceId = provenanceRecords[0]!.id;
		let provenanceGetterHits = 0;
		Object.defineProperty(provenanceRecords[0]!, 'id', {
			enumerable: true,
			get() {
				provenanceGetterHits += 1;
				return provenanceId;
			}
		});
		const provenanceResult = validateModuleDependencyGraph(validGraph(snapshot), hostileSnapshot);
		expect(provenanceResult.state).toBe('INVALID');
		expect(provenanceResult.issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'INVALID_SHAPE' })])
		);
		expect(provenanceGetterHits).toBe(0);

		let semanticProxyTrapHits = 0;
		const semanticProxy = new Proxy(snapshot, {
			getPrototypeOf() {
				semanticProxyTrapHits += 1;
				throw new Error('semantic snapshot proxy trap');
			}
		});
		expect(validateModuleDependencyGraph(validGraph(snapshot), semanticProxy)).toMatchObject({
			issues: [expect.objectContaining({ code: 'INVALID_SHAPE' })],
			state: 'INVALID'
		});
		expect(semanticProxyTrapHits).toBe(0);

		let provenanceArrayProxyTrapHits = 0;
		const provenanceArrayProxy = new Proxy([...snapshot.provenances], {
			getPrototypeOf() {
				provenanceArrayProxyTrapHits += 1;
				throw new Error('semantic provenance array proxy trap');
			}
		});
		const hostilePopulationSnapshot = {
			...snapshot,
			provenances: provenanceArrayProxy
		} as StaticSemanticSnapshot;
		expect(
			validateModuleDependencyGraph(validGraph(snapshot), hostilePopulationSnapshot)
		).toMatchObject({ state: 'INVALID' });
		expect(provenanceArrayProxyTrapHits).toBe(0);

		const nullProvenanceSnapshot = {
			...snapshot,
			provenances: [null]
		} as unknown as StaticSemanticSnapshot;
		expect(
			validateModuleDependencyGraph(validGraph(snapshot), nullProvenanceSnapshot)
		).toMatchObject({
			state: 'INVALID'
		});
	});

	it('rejects malformed graph wire shapes at every public composite boundary', () => {
		const snapshot = semanticSnapshot();
		const graph = validGraph(snapshot);
		const unresolvedSnapshot = unresolvedSemanticSnapshot();
		const unresolvedGraph = validGraph(unresolvedSnapshot);
		const mutate = (
			change: (candidate: ModuleDependencyGraphSnapshot) => void,
			base = graph
		): ModuleDependencyGraphSnapshot => {
			const candidate = clone(base);
			change(candidate);
			return candidate;
		};
		const malformed: readonly unknown[] = [
			null,
			[],
			mutate((candidate) => Object.assign(candidate, { unexpected: true })),
			mutate((candidate) =>
				Object.assign(candidate as unknown as { coverage: unknown }, { coverage: null })
			),
			mutate((candidate) =>
				Object.assign(candidate.coverage as unknown as { expectedSources: unknown }, {
					expectedSources: -1
				})
			),
			mutate((candidate) =>
				Object.assign(candidate as unknown as { limitations: unknown }, { limitations: [null] })
			),
			mutate((candidate) =>
				Object.assign(candidate.limitations[0]! as unknown as { reason: unknown }, { reason: '' })
			),
			mutate((candidate) =>
				Object.assign(candidate.nodes[0]! as unknown as { sourceLocations: unknown }, {
					sourceLocations: [null]
				})
			),
			mutate((candidate) =>
				Object.assign(candidate.nodes[0]! as unknown as { sourceLocations: unknown }, {
					sourceLocations: [{ end: 0, sourceId: sourceA, start: 1 }]
				})
			),
			mutate((candidate) =>
				Object.assign(candidate.edges[0]! as unknown as { source: unknown }, { source: null })
			),
			mutate((candidate) =>
				Object.assign(candidate.edges[0]!.source as unknown as { kind: unknown }, { kind: 'BAD' })
			),
			mutate((candidate) =>
				Object.assign(candidate as unknown as { forwardIndex: unknown }, {
					forwardIndex: [null]
				})
			),
			mutate((candidate) =>
				Object.assign(candidate.forwardIndex[0]! as unknown as { edgeIds: unknown }, {
					edgeIds: [1]
				})
			),
			mutate((candidate) =>
				Object.assign(candidate as unknown as { producer: unknown }, { producer: null })
			),
			mutate((candidate) =>
				Object.assign(candidate.producer as unknown as { version: unknown }, { version: '' })
			),
			mutate((candidate) =>
				Object.assign(candidate as unknown as { nodes: unknown }, { nodes: [null] })
			),
			mutate((candidate) => {
				const sourceNode = candidate.nodes.find((node) => node.kind === 'SOURCE')!;
				Object.assign(sourceNode as unknown as { logicalPath: unknown }, { logicalPath: 1 });
			}),
			mutate((candidate) => {
				const target = candidate.nodes.find((node) => node.kind === 'RESOLUTION_TARGET')!;
				Object.assign(target as unknown as { specifier: unknown }, { specifier: 1 });
			}, unresolvedGraph),
			mutate((candidate) =>
				Object.assign(candidate as unknown as { edges: unknown }, { edges: [null] })
			),
			mutate((candidate) =>
				Object.assign(candidate.edges[0]! as unknown as { method: unknown }, { method: 'wrong' })
			),
			mutate((candidate) =>
				Object.assign(candidate as unknown as { layers: unknown }, { layers: [null] })
			),
			mutate((candidate) =>
				Object.assign(candidate.layers[0]! as unknown as { ordinal: unknown }, { ordinal: 1 })
			),
			mutate((candidate) =>
				Object.assign(candidate.layers[0]! as unknown as { limitations: unknown }, {
					limitations: [null]
				})
			),
			mutate((candidate) =>
				Object.assign(candidate.layers[0]! as unknown as { nodeIds: unknown }, { nodeIds: [1] })
			),
			mutate((candidate) =>
				Object.assign(candidate as unknown as { reverseIndex: unknown }, { reverseIndex: null })
			)
		];

		for (const value of malformed)
			expect(validateModuleDependencyGraph(value, snapshot)).toMatchObject({ state: 'INVALID' });
		for (const maxIssues of [0, Number.NaN, 100_001])
			expect(validateModuleDependencyGraph(graph, snapshot, { maxIssues })).toMatchObject({
				issues: [expect.objectContaining({ path: '$validationOptions.maxIssues' })],
				state: 'INVALID'
			});
		const hostile = new Proxy(
			{},
			{
				getPrototypeOf() {
					throw new Error('hostile graph');
				}
			}
		);
		expect(validateModuleDependencyGraph(hostile, snapshot)).toMatchObject({
			issues: [expect.objectContaining({ code: 'INVALID_SHAPE' })],
			state: 'INVALID'
		});
	});

	it('rejects shape-valid contract, reference, evidence, and reconciliation drift', () => {
		type MutationCase = {
			readonly expectedCode: string;
			readonly name: string;
			readonly unresolved?: boolean;
			readonly mutate: (
				graph: ModuleDependencyGraphSnapshot,
				snapshot: StaticSemanticSnapshot
			) => void;
		};
		const sourceNode = (graph: ModuleDependencyGraphSnapshot, semanticSourceId = sourceA) =>
			graph.nodes.find(
				(node) => node.kind === 'SOURCE' && node.semanticSourceId === semanticSourceId
			)!;
		const targetNode = (graph: ModuleDependencyGraphSnapshot) =>
			graph.nodes.find((node) => node.kind === 'RESOLUTION_TARGET')!;
		const cases: readonly MutationCase[] = [
			{
				expectedCode: 'UNSUPPORTED_SCHEMA_VERSION',
				name: 'schema version',
				mutate: (graph) =>
					Object.assign(graph as unknown as { schemaVersion: string }, { schemaVersion: 'other' })
			},
			{
				expectedCode: 'INVALID_VALUE',
				name: 'operation version',
				mutate: (graph) =>
					Object.assign(graph as unknown as { operationVersion: string }, {
						operationVersion: 'other'
					})
			},
			{
				expectedCode: 'INVALID_VALUE',
				name: 'canonical profile',
				mutate: (graph) =>
					Object.assign(graph as unknown as { canonicalProfile: string }, {
						canonicalProfile: 'other'
					})
			},
			{
				expectedCode: 'INVALID_VALUE',
				name: 'construction method',
				mutate: (graph) =>
					Object.assign(graph as unknown as { method: string }, { method: 'other' })
			},
			{
				expectedCode: 'CONFORMANCE_OVERCLAIM',
				name: 'full conformance overclaim',
				mutate: (graph) =>
					Object.assign(graph as unknown as { fullJanCsaa007Conformance: string }, {
						fullJanCsaa007Conformance: 'CLAIMED'
					})
			},
			{
				expectedCode: 'DANGLING_REFERENCE',
				name: 'semantic snapshot binding',
				mutate: (graph) =>
					Object.assign(graph as unknown as { semanticSnapshotId: string }, {
						semanticSnapshotId: 'static:other'
					})
			},
			{
				expectedCode: 'DANGLING_REFERENCE',
				name: 'subject binding',
				mutate: (graph) =>
					Object.assign(graph as unknown as { subjectId: string }, { subjectId: 'other' })
			},
			{
				expectedCode: 'INVALID_VALUE',
				name: 'semantic extraction version',
				mutate: (graph) =>
					Object.assign(graph as unknown as { semanticExtractionVersion: string }, {
						semanticExtractionVersion: 'other'
					})
			},
			{
				expectedCode: 'INVALID_VALUE',
				name: 'semantic schema version',
				mutate: (graph) =>
					Object.assign(graph as unknown as { semanticSchemaVersion: string }, {
						semanticSchemaVersion: 'other'
					})
			},
			{
				expectedCode: 'INVALID_VALUE',
				name: 'producer version',
				mutate: (graph) =>
					Object.assign(graph.producer as unknown as { version: string }, { version: 'other' })
			},
			{
				expectedCode: 'INVALID_VALUE',
				name: 'graph input digest form',
				mutate: (graph) =>
					Object.assign(graph as unknown as { graphInputDigest: string }, {
						graphInputDigest: 'not-a-digest'
					})
			},
			{
				expectedCode: 'INVALID_VALUE',
				name: 'content digest form',
				mutate: (graph) =>
					Object.assign(graph as unknown as { contentDigest: string }, {
						contentDigest: 'not-a-digest'
					})
			},
			{
				expectedCode: 'POPULATION_MISMATCH',
				name: 'layer population',
				mutate: (graph) => Object.assign(graph as unknown as { layers: unknown[] }, { layers: [] })
			},
			{
				expectedCode: 'IDENTITY_MISMATCH',
				name: 'layer identity',
				mutate: (graph) =>
					Object.assign(graph.layers[0]! as unknown as { id: string }, { id: 'graph-layer:other' })
			},
			{
				expectedCode: 'INVALID_VALUE',
				name: 'layer producer',
				mutate: (graph) =>
					Object.assign(graph.layers[0]!.producer as unknown as { version: string }, {
						version: 'other'
					})
			},
			...(['graphId', 'layerId', 'semanticSnapshotId', 'subjectId'] as const).map(
				(field): MutationCase => ({
					expectedCode: 'DANGLING_REFERENCE',
					name: `node ${field} binding`,
					mutate: (graph) =>
						Object.assign(sourceNode(graph) as unknown as Record<string, string>, {
							[field]: 'other'
						})
				})
			),
			{
				expectedCode: 'DANGLING_REFERENCE',
				name: 'absent provenance',
				mutate: (graph) =>
					Object.assign(sourceNode(graph) as unknown as { provenanceIds: string[] }, {
						provenanceIds: ['semantic:provenance-missing']
					})
			},
			{
				expectedCode: 'DANGLING_REFERENCE',
				name: 'provenance snapshot ownership',
				mutate: (_graph, snapshot) =>
					Object.assign(snapshot.provenances[0]! as unknown as { snapshotId: string }, {
						snapshotId: 'static:other'
					})
			},
			{
				expectedCode: 'DANGLING_REFERENCE',
				name: 'location source',
				mutate: (graph) =>
					Object.assign(sourceNode(graph).sourceLocations[0]! as unknown as { sourceId: string }, {
						sourceId: 'semantic:source-missing'
					})
			},
			{
				expectedCode: 'INVALID_VALUE',
				name: 'location extent',
				mutate: (graph) =>
					Object.assign(sourceNode(graph).sourceLocations[0]! as unknown as { end: number }, {
						end: 25
					})
			},
			{
				expectedCode: 'DUPLICATE_ID',
				name: 'duplicate semantic source representation',
				mutate: (graph) =>
					Object.assign(sourceNode(graph, sourceB) as unknown as { semanticSourceId: string }, {
						semanticSourceId: sourceA
					})
			},
			{
				expectedCode: 'DANGLING_REFERENCE',
				name: 'absent semantic source',
				mutate: (graph) =>
					Object.assign(sourceNode(graph) as unknown as { semanticSourceId: string }, {
						semanticSourceId: 'semantic:source-missing'
					})
			},
			{
				expectedCode: 'INVALID_VALUE',
				name: 'semantic source field reproduction',
				mutate: (graph) =>
					Object.assign(sourceNode(graph) as unknown as { analysisDisposition: string }, {
						analysisDisposition: 'CONTEXT_ONLY'
					})
			},
			{
				expectedCode: 'IDENTITY_MISMATCH',
				name: 'source node identity',
				mutate: (graph) =>
					Object.assign(sourceNode(graph) as unknown as { id: string }, { id: 'graph-node:other' })
			},
			{
				expectedCode: 'DANGLING_REFERENCE',
				name: 'source provenance reproduction',
				mutate: (graph) =>
					Object.assign(sourceNode(graph) as unknown as { provenanceIds: string[] }, {
						provenanceIds: [sourceBProvenance]
					})
			},
			{
				expectedCode: 'INVALID_VALUE',
				name: 'source location reproduction',
				mutate: (graph) =>
					Object.assign(sourceNode(graph).sourceLocations[0]! as unknown as { start: number }, {
						start: 1
					})
			},
			{
				expectedCode: 'INVALID_VALUE',
				name: 'source epistemic state',
				mutate: (graph) =>
					Object.assign(sourceNode(graph) as unknown as { epistemic: string }, {
						epistemic: 'UNKNOWN'
					})
			},
			{
				expectedCode: 'DANGLING_REFERENCE',
				name: 'absent native-target resolution',
				unresolved: true,
				mutate: (graph) =>
					Object.assign(targetNode(graph) as unknown as { moduleResolutionId: string }, {
						moduleResolutionId: 'semantic:module-resolution-missing'
					})
			},
			{
				expectedCode: 'INVALID_VALUE',
				name: 'resolved-source native-target overrepresentation',
				unresolved: true,
				mutate: (_graph, snapshot) =>
					Object.assign(snapshot.moduleResolutions[0]! as unknown as Record<string, unknown>, {
						resolutionState: 'RESOLVED_SOURCE',
						targetSourceId: sourceB
					})
			},
			{
				expectedCode: 'INVALID_VALUE',
				name: 'native-target field reproduction',
				unresolved: true,
				mutate: (graph) =>
					Object.assign(targetNode(graph) as unknown as { specifier: string }, {
						specifier: './other.js'
					})
			},
			{
				expectedCode: 'IDENTITY_MISMATCH',
				name: 'native-target identity',
				unresolved: true,
				mutate: (graph) =>
					Object.assign(targetNode(graph) as unknown as { id: string }, { id: 'graph-node:other' })
			},
			{
				expectedCode: 'DANGLING_REFERENCE',
				name: 'native-target provenance',
				unresolved: true,
				mutate: (graph) =>
					Object.assign(targetNode(graph) as unknown as { provenanceIds: string[] }, {
						provenanceIds: [sourceAProvenance]
					})
			},
			{
				expectedCode: 'INVALID_VALUE',
				name: 'native-target occurrence location',
				unresolved: true,
				mutate: (graph) =>
					Object.assign(targetNode(graph).sourceLocations[0]! as unknown as { start: number }, {
						start: 1
					})
			},
			{
				expectedCode: 'INVALID_VALUE',
				name: 'native-target epistemic state',
				unresolved: true,
				mutate: (graph) =>
					Object.assign(targetNode(graph) as unknown as { epistemic: string }, {
						epistemic: 'SUPPORTED'
					})
			},
			{
				expectedCode: 'DANGLING_REFERENCE',
				name: 'absent edge resolution',
				mutate: (graph) =>
					Object.assign(graph.edges[0]! as unknown as { moduleResolutionId: string }, {
						moduleResolutionId: 'semantic:module-resolution-missing'
					})
			},
			{
				expectedCode: 'DANGLING_REFERENCE',
				name: 'absent occurrence node',
				mutate: (_graph, snapshot) =>
					Object.assign(snapshot as unknown as { astNodes: unknown[] }, { astNodes: [] })
			},
			{
				expectedCode: 'DANGLING_REFERENCE',
				name: 'occurrence importer mismatch',
				mutate: (_graph, snapshot) =>
					Object.assign(snapshot.astNodes[0]! as unknown as { sourceId: string }, {
						sourceId: sourceB
					})
			},
			{
				expectedCode: 'INVALID_VALUE',
				name: 'edge occurrence reproduction',
				mutate: (graph) =>
					Object.assign(graph.edges[0]! as unknown as { typeOnly: boolean }, { typeOnly: true })
			},
			{
				expectedCode: 'DANGLING_REFERENCE',
				name: 'edge provenance reproduction',
				mutate: (graph) =>
					Object.assign(graph.edges[0]! as unknown as { provenanceIds: string[] }, {
						provenanceIds: [sourceAProvenance]
					})
			},
			{
				expectedCode: 'INVALID_VALUE',
				name: 'edge occurrence location',
				mutate: (graph) =>
					Object.assign(graph.edges[0]!.sourceLocations[0]! as unknown as { start: number }, {
						start: 1
					})
			},
			{
				expectedCode: 'DANGLING_REFERENCE',
				name: 'edge importer endpoint',
				mutate: (graph) =>
					Object.assign(graph.edges[0]!.source as unknown as { nodeId: string }, {
						nodeId: sourceNode(graph, sourceB).id
					})
			},
			{
				expectedCode: 'DANGLING_REFERENCE',
				name: 'resolved-source target endpoint kind',
				mutate: (graph) =>
					Object.assign(graph.edges[0]!.target as unknown as Record<string, string>, {
						kind: 'RESOLUTION_TARGET'
					})
			},
			{
				expectedCode: 'DANGLING_REFERENCE',
				name: 'native target endpoint kind',
				unresolved: true,
				mutate: (graph) =>
					Object.assign(graph.edges[0]!.target as unknown as Record<string, string>, {
						kind: 'SOURCE'
					})
			},
			{
				expectedCode: 'IDENTITY_MISMATCH',
				name: 'edge identity',
				mutate: (graph) =>
					Object.assign(graph.edges[0]! as unknown as { id: string }, { id: 'graph-edge:other' })
			},
			{
				expectedCode: 'INVALID_VALUE',
				name: 'edge epistemic state',
				mutate: (graph) =>
					Object.assign(graph.edges[0]! as unknown as { epistemic: string }, {
						epistemic: 'UNKNOWN'
					})
			},
			{
				expectedCode: 'POPULATION_MISMATCH',
				name: 'edge population',
				mutate: (graph) => Object.assign(graph as unknown as { edges: unknown[] }, { edges: [] })
			},
			{
				expectedCode: 'POPULATION_MISMATCH',
				name: 'source-node population',
				mutate: (graph) =>
					Object.assign(graph as unknown as { nodes: unknown[] }, {
						nodes: graph.nodes.filter(
							(node) => node.kind !== 'SOURCE' || node.semanticSourceId !== sourceB
						)
					})
			},
			{
				expectedCode: 'POPULATION_MISMATCH',
				name: 'native-target population',
				unresolved: true,
				mutate: (graph) =>
					Object.assign(graph as unknown as { nodes: unknown[] }, {
						nodes: graph.nodes.filter((node) => node.kind !== 'RESOLUTION_TARGET')
					})
			},
			{
				expectedCode: 'POPULATION_MISMATCH',
				name: 'layer node manifest',
				mutate: (graph) =>
					Object.assign(graph.layers[0]! as unknown as { nodeIds: string[] }, { nodeIds: [] })
			},
			{
				expectedCode: 'POPULATION_MISMATCH',
				name: 'layer edge manifest',
				mutate: (graph) =>
					Object.assign(graph.layers[0]! as unknown as { edgeIds: string[] }, { edgeIds: [] })
			},
			{
				expectedCode: 'DANGLING_REFERENCE',
				name: 'index node',
				mutate: (graph) =>
					Object.assign(graph.forwardIndex[0]! as unknown as { nodeId: string }, {
						nodeId: 'graph-node:missing'
					})
			},
			{
				expectedCode: 'DANGLING_REFERENCE',
				name: 'index edge',
				mutate: (graph) =>
					Object.assign(
						graph.forwardIndex.find((entry) => entry.edgeIds.length > 0)! as unknown as {
							edgeIds: string[];
						},
						{ edgeIds: ['graph-edge:missing'] }
					)
			},
			{
				expectedCode: 'POPULATION_MISMATCH',
				name: 'graph coverage',
				mutate: (graph) =>
					Object.assign(graph.coverage as unknown as { expectedSources: number }, {
						expectedSources: graph.coverage.expectedSources + 1
					})
			},
			{
				expectedCode: 'POPULATION_MISMATCH',
				name: 'layer coverage',
				mutate: (graph) =>
					Object.assign(graph.layers[0]!.coverage as unknown as { expectedSources: number }, {
						expectedSources: graph.layers[0]!.coverage.expectedSources + 1
					})
			},
			{
				expectedCode: 'LIMITATION_MISMATCH',
				name: 'layer limitation reconciliation',
				mutate: (graph) =>
					Object.assign(graph.layers[0]! as unknown as { limitations: unknown[] }, {
						limitations: []
					})
			},
			{
				expectedCode: 'INVALID_VALUE',
				name: 'graph epistemic aggregate',
				mutate: (graph) =>
					Object.assign(graph as unknown as { epistemic: string }, { epistemic: 'UNKNOWN' })
			},
			{
				expectedCode: 'INVALID_VALUE',
				name: 'layer epistemic aggregate',
				mutate: (graph) =>
					Object.assign(graph.layers[0]! as unknown as { epistemic: string }, {
						epistemic: 'UNKNOWN'
					})
			},
			{
				expectedCode: 'INVALID_VALUE',
				name: 'health closure contract',
				mutate: (graph) =>
					Object.assign(graph as unknown as { health: string }, {
						health: graph.health === 'COMPLETE' ? 'PARTIAL' : 'COMPLETE'
					})
			},
			{
				expectedCode: 'POPULATION_MISMATCH',
				name: 'layer provenance manifest',
				mutate: (graph) =>
					Object.assign(graph.layers[0]! as unknown as { provenanceIds: string[] }, {
						provenanceIds: []
					})
			},
			{
				expectedCode: 'DUPLICATE_ID',
				name: 'duplicate graph identities',
				mutate: (graph) => {
					Object.assign(graph as unknown as { nodes: unknown[]; edges: unknown[] }, {
						edges: [...graph.edges, graph.edges[0]!],
						nodes: [...graph.nodes, graph.nodes[0]!]
					});
				}
			}
		];

		for (const scenario of cases) {
			const snapshot = scenario.unresolved ? unresolvedSemanticSnapshot() : semanticSnapshot();
			const graph = validGraph(snapshot);
			scenario.mutate(graph, snapshot);
			expect(issueCodes(graph, snapshot), scenario.name).toContain(scenario.expectedCode);
		}
	});

	it('rejects a graph whose finalized content digest was changed', () => {
		const snapshot = semanticSnapshot();
		const graph = clone(validGraph(snapshot));
		(graph as unknown as { contentDigest: string }).contentDigest = '0'.repeat(64);
		expect(issueCodes(graph, snapshot)).toContain('CONTENT_DIGEST_MISMATCH');
	});

	it('rejects graph-input and graph identity drift', () => {
		const snapshot = semanticSnapshot();
		const graph = clone(validGraph(snapshot));
		(graph as unknown as { graphInputDigest: string }).graphInputDigest = '1'.repeat(64);
		const codes = issueCodes(graph, snapshot);
		expect(codes).toContain('GRAPH_INPUT_MISMATCH');
		expect(codes).toContain('IDENTITY_MISMATCH');
	});

	it('rejects dangling typed endpoints', () => {
		const snapshot = semanticSnapshot();
		const graph = clone(validGraph(snapshot));
		(graph.edges[0]!.target as unknown as { nodeId: string }).nodeId = 'graph-node:source-missing';
		expect(issueCodes(graph, snapshot)).toContain('DANGLING_REFERENCE');
	});

	it('rejects a forward index that hides a represented edge', () => {
		const snapshot = semanticSnapshot();
		const graph = clone(validGraph(snapshot));
		const sourceEntry = graph.forwardIndex.find((entry) => entry.edgeIds.length > 0)!;
		(sourceEntry as unknown as { edgeIds: string[] }).edgeIds = [];
		expect(issueCodes(graph, snapshot)).toContain('POPULATION_MISMATCH');
	});

	it('rejects limitation loss and absolute source paths', () => {
		const snapshot = semanticSnapshot();
		const graph = clone(validGraph(snapshot));
		(graph as unknown as { limitations: unknown[] }).limitations = [];
		const sourceNode = graph.nodes.find((node) => node.kind === 'SOURCE')!;
		(sourceNode as unknown as { logicalPath: string }).logicalPath = 'C:/outside/a.ts';
		const codes = issueCodes(graph, snapshot);
		expect(codes).toContain('LIMITATION_MISMATCH');
		expect(codes).toContain('ABSOLUTE_PATH');
	});

	it('bounds hostile mutation diagnostics', () => {
		const snapshot = semanticSnapshot();
		const graph = clone(validGraph(snapshot));
		(graph as unknown as { graphInputDigest: string }).graphInputDigest = '2'.repeat(64);
		const result = validateModuleDependencyGraph(graph, snapshot, { maxIssues: 1 });
		expect(result.issues).toHaveLength(1);
		expect(result.state).toBe('BUDGET_EXHAUSTED');
	});
});
