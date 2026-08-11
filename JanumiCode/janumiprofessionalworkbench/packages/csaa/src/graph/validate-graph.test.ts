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

function issueCodes(
	graph: ModuleDependencyGraphSnapshot,
	snapshot: StaticSemanticSnapshot
): readonly string[] {
	const result = validateModuleDependencyGraph(graph, snapshot);
	return result.issues.map((issue) => issue.code);
}

describe('validateModuleDependencyGraph', () => {
	it('accepts the exact deterministic module-dependency graph', () => {
		const snapshot = semanticSnapshot();
		expect(validateModuleDependencyGraph(validGraph(snapshot), snapshot)).toEqual({
			issues: [],
			state: 'VALID'
		});
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
