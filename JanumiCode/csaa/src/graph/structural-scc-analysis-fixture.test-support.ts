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
import { buildModuleDependencyGraph } from './build-module-dependency-graph.js';

const subjectId = 'structural-scc-fixture-subject';
const snapshotId = 'static:structural-scc-fixture' as SemanticSnapshotId;
const projectId = 'semantic:structural-scc-project' as SemanticProjectId;
const programId = 'semantic:structural-scc-program' as SemanticProgramId;
const sourceNames = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

const sourceId = (name: (typeof sourceNames)[number]) =>
	`semantic:structural-scc-source-${name}` as SemanticSourceId;
const sourceProvenanceId = (name: (typeof sourceNames)[number]) =>
	`semantic:structural-scc-source-provenance-${name}` as SemanticProvenanceId;

interface FixtureResolution {
	readonly from: (typeof sourceNames)[number];
	readonly name: string;
	readonly specifier: string;
	readonly to: (typeof sourceNames)[number] | null;
}

const resolutions: readonly FixtureResolution[] = [
	{ from: 'a', name: 'a-to-b', specifier: './b.js', to: 'b' },
	{ from: 'b', name: 'b-to-a', specifier: './a.js', to: 'a' },
	{ from: 'c', name: 'c-to-c', specifier: './c.js', to: 'c' },
	{ from: 'd', name: 'd-to-e', specifier: './e.js', to: 'e' },
	{ from: 'd', name: 'd-to-missing', specifier: './missing.js', to: null }
];

const resolutionId = (name: string) =>
	`semantic:structural-scc-resolution-${name}` as SemanticModuleResolutionId;
const resolutionNodeId = (name: string) => `semantic:structural-scc-node-${name}` as SemanticNodeId;
const resolutionProvenanceId = (name: string) =>
	`semantic:structural-scc-resolution-provenance-${name}` as SemanticProvenanceId;

export interface StructuralSccGraphFixture {
	readonly graph: ModuleDependencyGraphSnapshot;
	readonly snapshot: StaticSemanticSnapshot;
}

function semanticSnapshot(): StaticSemanticSnapshot {
	return {
		astNodes: resolutions.map((resolution, ordinal) => ({
			end: ordinal * 10 + 9,
			id: resolutionNodeId(resolution.name),
			kind: 273,
			sourceId: sourceId(resolution.from),
			start: ordinal * 10
		})),
		capabilities: [
			{ capability: 'TS_PROJECT', reason: 'fixture', state: 'SUPPORTED' },
			{ capability: 'TS_SYMBOL', reason: 'fixture', state: 'SUPPORTED' },
			{ capability: 'TS_SYNTAX', reason: 'fixture', state: 'SUPPORTED' }
		],
		expectedEmpty: false,
		extractionVersion: SEMANTIC_EXTRACTION_VERSION,
		health: 'COMPLETE',
		id: snapshotId,
		moduleResolutions: resolutions.map((resolution) => ({
			id: resolutionId(resolution.name),
			moduleSymbolId: null,
			nodeId: resolutionNodeId(resolution.name),
			occurrenceKind: 'IMPORT' as const,
			provenanceId: resolutionProvenanceId(resolution.name),
			resolutionState:
				resolution.to === null ? ('UNRESOLVED' as const) : ('RESOLVED_SOURCE' as const),
			sourceId: sourceId(resolution.from),
			specifier: resolution.specifier,
			specifierState: 'LITERAL' as const,
			targetSourceId: resolution.to === null ? null : sourceId(resolution.to),
			typeOnly: false
		})),
		provenances: [
			...sourceNames.map((name) => ({
				id: sourceProvenanceId(name),
				snapshotId,
				subjectId
			})),
			...resolutions.map((resolution) => ({
				id: resolutionProvenanceId(resolution.name),
				snapshotId,
				subjectId
			}))
		],
		provider: { api: 'PUBLIC_COMPILER_API', id: 'typescript', version: '5.9.3' },
		schemaVersion: SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
		sources: sourceNames.map((name) => ({
			analysisDisposition: 'DEEP_INDEXED' as const,
			id: sourceId(name),
			logicalPath: `src/${name}.ts`,
			programId,
			projectId,
			provenanceId: sourceProvenanceId(name),
			textLength: 100
		})),
		subjectId
	} as unknown as StaticSemanticSnapshot;
}

export function createStructuralSccGraphFixture(): StructuralSccGraphFixture {
	const snapshot = semanticSnapshot();
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
	return { graph: outcome.graph, snapshot };
}
