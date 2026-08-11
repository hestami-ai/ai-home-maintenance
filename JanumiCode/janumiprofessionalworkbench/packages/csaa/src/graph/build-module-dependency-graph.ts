import { isProxy } from 'node:util/types';
import {
	FULL_JAN_CSAA_007_CONFORMANCE,
	type SemanticModuleOccurrenceKind,
	type SemanticModuleResolutionRecord,
	type StaticSemanticSnapshot
} from '../contracts/semantic.js';
import {
	MODULE_DEPENDENCY_GRAPH_CANONICAL_PROFILE,
	MODULE_DEPENDENCY_GRAPH_METHOD,
	MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
	MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
	MODULE_DEPENDENCY_GRAPH_SCHEMA_VERSION,
	type BuildModuleDependencyGraphRequest,
	type ModuleDependencyGraphBuildDiagnostic,
	type ModuleDependencyGraphBuildOutcome,
	type ModuleDependencyGraphCoverage,
	type ModuleDependencyGraphEdge,
	type ModuleDependencyGraphEdgeId,
	type ModuleDependencyGraphEpistemicState,
	type ModuleDependencyGraphIndexEntry,
	type ModuleDependencyGraphLayer,
	type ModuleDependencyGraphLimitation,
	type ModuleDependencyGraphNode,
	type ModuleDependencyGraphNodeId,
	type ModuleDependencyGraphRelationKind,
	type ModuleDependencyGraphSnapshot
} from '../contracts/graph.js';
import { moduleDependencyGraphContentDigest } from './module-dependency-content.js';
import { moduleDependencyGraphInputDigest } from './module-dependency-input.js';
import {
	moduleDependencyGraphEdgeId,
	moduleDependencyGraphId,
	moduleDependencyGraphLayerId,
	moduleDependencyGraphResolutionTargetNodeId,
	moduleDependencyGraphSourceNodeId
} from './ids.js';
import { validateModuleDependencyGraph } from './validate-graph.js';

const REQUEST_KEYS = [
	'operationVersion',
	'schemaVersion',
	'semanticSnapshotId',
	'subjectId'
] as const;

function diagnostic(
	code: ModuleDependencyGraphBuildDiagnostic['code'],
	message: string,
	phase: ModuleDependencyGraphBuildDiagnostic['phase'],
	path: string | null = null
): ModuleDependencyGraphBuildDiagnostic {
	return { code, message, path, phase };
}

function unavailable(
	code: ModuleDependencyGraphBuildDiagnostic['code'],
	message: string,
	phase: ModuleDependencyGraphBuildDiagnostic['phase'],
	path: string | null = null
): ModuleDependencyGraphBuildOutcome {
	return { diagnostics: [diagnostic(code, message, phase, path)], outcome: 'unavailable' };
}

function materializeRequest(value: unknown): BuildModuleDependencyGraphRequest {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		throw new TypeError('Module dependency graph request must be a plain data object.');
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new TypeError('Module dependency graph request must have a plain prototype.');
	const keys = Reflect.ownKeys(value);
	if (keys.some((key) => typeof key !== 'string'))
		throw new TypeError('Module dependency graph request rejects symbol keys.');
	const actual = (keys as string[]).sort();
	const expected = [...REQUEST_KEYS].sort();
	if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index]))
		throw new TypeError(`Module dependency graph request requires exactly ${expected.join(', ')}.`);
	const record = value as Record<string, unknown>;
	for (const key of expected) {
		const descriptor = Reflect.getOwnPropertyDescriptor(record, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new TypeError(`Module dependency graph request field ${key} must be data.`);
		if (typeof descriptor.value !== 'string' || descriptor.value.length === 0)
			throw new TypeError(`Module dependency graph request field ${key} must be nonempty text.`);
	}
	if (record.schemaVersion !== MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION)
		throw new TypeError('Unsupported module dependency graph request schema version.');
	if (record.operationVersion !== MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION)
		throw new TypeError('Unsupported module dependency graph operation version.');
	return record as unknown as BuildModuleDependencyGraphRequest;
}

function relationKind(kind: SemanticModuleOccurrenceKind): ModuleDependencyGraphRelationKind {
	switch (kind) {
		case 'IMPORT':
			return 'IMPORT_OCCURRENCE';
		case 'EXPORT':
			return 'EXPORT_OCCURRENCE';
		case 'IMPORT_EQUALS':
			return 'IMPORT_EQUALS_OCCURRENCE';
		case 'IMPORT_TYPE':
			return 'IMPORT_TYPE_OCCURRENCE';
		case 'DYNAMIC_IMPORT':
			return 'DYNAMIC_IMPORT_OCCURRENCE';
	}
}

function epistemicForResolution(
	state: SemanticModuleResolutionRecord['resolutionState']
): ModuleDependencyGraphEpistemicState {
	if (state === 'UNSUPPORTED') return 'UNSUPPORTED';
	if (state === 'UNRESOLVED') return 'UNKNOWN';
	return 'SUPPORTED';
}

function aggregateEpistemic(
	resolutions: readonly SemanticModuleResolutionRecord[]
): ModuleDependencyGraphEpistemicState {
	if (resolutions.some((record) => record.resolutionState === 'UNSUPPORTED')) return 'UNSUPPORTED';
	if (resolutions.some((record) => record.resolutionState === 'UNRESOLVED')) return 'UNKNOWN';
	return 'SUPPORTED';
}

function compareId(left: { readonly id: string }, right: { readonly id: string }): number {
	return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function compareLimitation(
	left: ModuleDependencyGraphLimitation,
	right: ModuleDependencyGraphLimitation
): number {
	const leftKey = `${left.kind}\0${left.moduleResolutionId ?? ''}\0${left.sourceId ?? ''}`;
	const rightKey = `${right.kind}\0${right.moduleResolutionId ?? ''}\0${right.sourceId ?? ''}`;
	return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}

function limitationsFor(
	snapshot: StaticSemanticSnapshot
): readonly ModuleDependencyGraphLimitation[] {
	const limitations: ModuleDependencyGraphLimitation[] = [
		{
			closureEffect: 'NONE',
			kind: 'DEPCRUISE_NOT_RUN',
			moduleResolutionId: null,
			reason:
				'Dependency-cruiser corroboration was not run by this compiler-native graph increment.',
			sourceId: null
		}
	];
	if (snapshot.health === 'PARTIAL')
		limitations.push({
			closureEffect: 'DEGRADES_CLOSURE',
			kind: 'SEMANTIC_INPUT_PARTIAL',
			moduleResolutionId: null,
			reason: 'The bound static semantic snapshot is partial.',
			sourceId: null
		});
	for (const resolution of snapshot.moduleResolutions) {
		switch (resolution.resolutionState) {
			case 'RESOLVED_AMBIENT':
			case 'RESOLVED_EXTERNAL':
				limitations.push({
					closureEffect: 'DEGRADES_CLOSURE',
					kind: 'NON_SOURCE_MODULE_TARGET',
					moduleResolutionId: resolution.id,
					reason: `The ${resolution.resolutionState} module target is represented as an explicit graph-native endpoint outside the source-node population.`,
					sourceId: resolution.sourceId
				});
				break;
			case 'UNRESOLVED':
				limitations.push({
					closureEffect: 'DEGRADES_CLOSURE',
					kind: 'UNRESOLVED_MODULE',
					moduleResolutionId: resolution.id,
					reason: 'The compiler did not resolve this module occurrence.',
					sourceId: resolution.sourceId
				});
				break;
			case 'UNSUPPORTED':
				limitations.push({
					closureEffect: 'DEGRADES_CLOSURE',
					kind: 'UNSUPPORTED_MODULE_RESOLUTION',
					moduleResolutionId: resolution.id,
					reason: 'This module occurrence is outside the supported compiler resolution surface.',
					sourceId: resolution.sourceId
				});
				break;
			case 'RESOLVED_SOURCE':
				break;
		}
	}
	return limitations.sort(compareLimitation);
}

function makeIndexes(
	nodes: readonly ModuleDependencyGraphNode[],
	edges: readonly ModuleDependencyGraphEdge[],
	direction: 'FORWARD' | 'REVERSE'
): readonly ModuleDependencyGraphIndexEntry[] {
	const byNode = new Map<ModuleDependencyGraphNodeId, ModuleDependencyGraphEdgeId[]>(
		nodes.map((node) => [node.id, []])
	);
	for (const edge of edges) {
		const nodeId = direction === 'FORWARD' ? edge.source.nodeId : edge.target.nodeId;
		byNode.get(nodeId)?.push(edge.id);
	}
	return [...byNode.entries()]
		.map(([nodeId, edgeIds]): ModuleDependencyGraphIndexEntry => ({
			nodeId,
			edgeIds: edgeIds.sort()
		}))
		.sort((left, right) => (left.nodeId < right.nodeId ? -1 : left.nodeId > right.nodeId ? 1 : 0));
}

function coverageFor(
	snapshot: StaticSemanticSnapshot,
	nodes: readonly ModuleDependencyGraphNode[],
	edges: readonly ModuleDependencyGraphEdge[]
): ModuleDependencyGraphCoverage {
	const graphNativeTargets = nodes.filter((node) => node.kind === 'RESOLUTION_TARGET').length;
	const resolvedSourceTargets = snapshot.moduleResolutions.filter(
		(record) => record.resolutionState === 'RESOLVED_SOURCE'
	).length;
	const resolvedAmbientTargets = snapshot.moduleResolutions.filter(
		(record) => record.resolutionState === 'RESOLVED_AMBIENT'
	).length;
	const resolvedExternalTargets = snapshot.moduleResolutions.filter(
		(record) => record.resolutionState === 'RESOLVED_EXTERNAL'
	).length;
	const unresolvedTargets = snapshot.moduleResolutions.filter(
		(record) => record.resolutionState === 'UNRESOLVED'
	).length;
	const unsupportedTargets = snapshot.moduleResolutions.filter(
		(record) => record.resolutionState === 'UNSUPPORTED'
	).length;
	const representedSources = nodes.filter((node) => node.kind === 'SOURCE').length;
	const representedModuleResolutions = edges.length;
	const stateTotal =
		resolvedSourceTargets +
		resolvedAmbientTargets +
		resolvedExternalTargets +
		unresolvedTargets +
		unsupportedTargets;
	const reconciles =
		representedSources === snapshot.sources.length &&
		representedModuleResolutions === snapshot.moduleResolutions.length &&
		stateTotal === snapshot.moduleResolutions.length &&
		graphNativeTargets === snapshot.moduleResolutions.length - resolvedSourceTargets;
	return {
		closure:
			snapshot.health === 'PARTIAL' || graphNativeTargets > 0 || !reconciles ? 'OPEN' : 'CLOSED',
		expectedModuleResolutions: snapshot.moduleResolutions.length,
		expectedSources: snapshot.sources.length,
		graphNativeTargets,
		reconciles,
		representedModuleResolutions,
		representedSources,
		resolvedAmbientTargets,
		resolvedExternalTargets,
		resolvedSourceTargets,
		unresolvedTargets,
		unsupportedTargets
	};
}

function partialDiagnostics(
	limitations: readonly ModuleDependencyGraphLimitation[]
): readonly ModuleDependencyGraphBuildDiagnostic[] {
	return limitations
		.filter((limitation) => limitation.closureEffect === 'DEGRADES_CLOSURE')
		.map((limitation) =>
			diagnostic(
				'GRAPH_PARTIAL',
				limitation.reason,
				'PROJECT',
				limitation.moduleResolutionId
					? `$.moduleResolutions[${limitation.moduleResolutionId}]`
					: null
			)
		);
}

export function buildModuleDependencyGraph(
	requestValue: unknown,
	snapshot: StaticSemanticSnapshot
): ModuleDependencyGraphBuildOutcome {
	let request: BuildModuleDependencyGraphRequest;
	try {
		request = materializeRequest(requestValue);
	} catch (error) {
		return unavailable(
			'REQUEST_INVALID',
			error instanceof Error ? error.message : 'Invalid module dependency graph request.',
			'REQUEST'
		);
	}
	if (request.semanticSnapshotId !== snapshot.id)
		return unavailable(
			'SEMANTIC_SNAPSHOT_ID_MISMATCH',
			'The request semanticSnapshotId does not match the supplied semantic snapshot.',
			'REQUEST',
			'$.semanticSnapshotId'
		);
	if (request.subjectId !== snapshot.subjectId)
		return unavailable(
			'SUBJECT_ID_MISMATCH',
			'The request subjectId does not match the supplied semantic snapshot.',
			'REQUEST',
			'$.subjectId'
		);
	for (const capability of ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'] as const) {
		const state = snapshot.capabilities.find((record) => record.capability === capability)?.state;
		if (state === undefined || state === 'UNSUPPORTED')
			return unavailable(
				'SEMANTIC_CAPABILITY_UNAVAILABLE',
				`The ${capability} semantic capability is required for module graph projection.`,
				'PROJECT',
				'$.capabilities'
			);
	}

	try {
		const sourceById = new Map(snapshot.sources.map((source) => [source.id, source]));
		const astNodeById = new Map(snapshot.astNodes.map((node) => [node.id, node]));
		const provenanceIds = new Set(snapshot.provenances.map((record) => record.id));
		if (sourceById.size !== snapshot.sources.length)
			throw new Error('The semantic source population contains duplicate IDs.');
		if (astNodeById.size !== snapshot.astNodes.length)
			throw new Error('The semantic AST-node population contains duplicate IDs.');
		if (provenanceIds.size !== snapshot.provenances.length)
			throw new Error('The semantic provenance population contains duplicate IDs.');
		const resolutionIds = new Set<string>();
		for (const resolution of snapshot.moduleResolutions) {
			if (resolutionIds.has(resolution.id))
				throw new Error(`Duplicate module resolution ID ${resolution.id}.`);
			resolutionIds.add(resolution.id);
			const source = sourceById.get(resolution.sourceId);
			const occurrence = astNodeById.get(resolution.nodeId);
			if (source === undefined)
				throw new Error(`Module resolution ${resolution.id} has a missing source.`);
			if (occurrence === undefined || occurrence.sourceId !== resolution.sourceId)
				throw new Error(`Module resolution ${resolution.id} has an invalid occurrence node.`);
			if (!provenanceIds.has(resolution.provenanceId))
				throw new Error(`Module resolution ${resolution.id} has missing provenance.`);
			if (resolution.resolutionState === 'RESOLVED_SOURCE') {
				if (resolution.targetSourceId === null || !sourceById.has(resolution.targetSourceId))
					throw new Error(`Resolved-source module resolution ${resolution.id} lacks its target.`);
			} else if (resolution.targetSourceId !== null) {
				throw new Error(`Non-source module resolution ${resolution.id} carries a source target.`);
			}
		}
		for (const source of snapshot.sources)
			if (!provenanceIds.has(source.provenanceId))
				throw new Error(`Semantic source ${source.id} has missing provenance.`);

		const graphInputDigest = moduleDependencyGraphInputDigest(snapshot);
		const graphId = moduleDependencyGraphId({
			canonicalProfile: MODULE_DEPENDENCY_GRAPH_CANONICAL_PROFILE,
			graphInputDigest,
			graphKind: 'TYPESCRIPT_MODULE_DEPENDENCY',
			method: MODULE_DEPENDENCY_GRAPH_METHOD,
			operationVersion: MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
			schemaVersion: MODULE_DEPENDENCY_GRAPH_SCHEMA_VERSION,
			semanticSnapshotId: snapshot.id,
			subjectId: snapshot.subjectId
		});
		const layerId = moduleDependencyGraphLayerId(graphId, 'TYPESCRIPT_MODULE_RESOLUTION', 0);
		const nodes: ModuleDependencyGraphNode[] = snapshot.sources.map((source) => ({
			analysisDisposition: source.analysisDisposition,
			epistemic: 'SUPPORTED',
			graphId,
			id: moduleDependencyGraphSourceNodeId(graphId, source.id),
			kind: 'SOURCE',
			layerId,
			logicalPath: source.logicalPath,
			programId: source.programId,
			projectId: source.projectId,
			provenanceIds: [source.provenanceId],
			semanticSnapshotId: snapshot.id,
			semanticSourceId: source.id,
			sourceLocations: [{ end: source.textLength, sourceId: source.id, start: 0 }],
			subjectId: snapshot.subjectId
		}));
		const sourceNodeBySemanticId = new Map(
			nodes
				.filter(
					(node): node is Extract<ModuleDependencyGraphNode, { kind: 'SOURCE' }> =>
						node.kind === 'SOURCE'
				)
				.map((node) => [node.semanticSourceId, node])
		);
		for (const resolution of snapshot.moduleResolutions) {
			if (resolution.resolutionState === 'RESOLVED_SOURCE') continue;
			const occurrence = astNodeById.get(resolution.nodeId)!;
			nodes.push({
				epistemic: epistemicForResolution(resolution.resolutionState),
				graphId,
				id: moduleDependencyGraphResolutionTargetNodeId(graphId, resolution.id),
				kind: 'RESOLUTION_TARGET',
				layerId,
				moduleResolutionId: resolution.id,
				moduleSymbolId: resolution.moduleSymbolId,
				provenanceIds: [resolution.provenanceId],
				resolutionState: resolution.resolutionState,
				semanticSnapshotId: snapshot.id,
				sourceLocations: [
					{ end: occurrence.end, sourceId: occurrence.sourceId, start: occurrence.start }
				],
				specifier: resolution.specifier,
				specifierState: resolution.specifierState,
				subjectId: snapshot.subjectId
			});
		}
		nodes.sort(compareId);
		const targetNodeByResolutionId = new Map(
			nodes
				.filter(
					(node): node is Extract<ModuleDependencyGraphNode, { kind: 'RESOLUTION_TARGET' }> =>
						node.kind === 'RESOLUTION_TARGET'
				)
				.map((node) => [node.moduleResolutionId, node])
		);
		const edges: ModuleDependencyGraphEdge[] = snapshot.moduleResolutions.map((resolution) => {
			const occurrence = astNodeById.get(resolution.nodeId)!;
			const sourceNode = sourceNodeBySemanticId.get(resolution.sourceId)!;
			const targetNode =
				resolution.resolutionState === 'RESOLVED_SOURCE'
					? sourceNodeBySemanticId.get(resolution.targetSourceId!)!
					: targetNodeByResolutionId.get(resolution.id)!;
			const source = { kind: 'SOURCE' as const, nodeId: sourceNode.id };
			const target = { kind: targetNode.kind, nodeId: targetNode.id };
			const edgeRelationKind = relationKind(resolution.occurrenceKind);
			return {
				epistemic: epistemicForResolution(resolution.resolutionState),
				graphId,
				id: moduleDependencyGraphEdgeId({
					graph: graphId,
					moduleResolutionId: resolution.id,
					relationKind: edgeRelationKind,
					source,
					target
				}),
				layerId,
				method: MODULE_DEPENDENCY_GRAPH_METHOD,
				moduleResolutionId: resolution.id,
				occurrenceKind: resolution.occurrenceKind,
				occurrenceNodeId: resolution.nodeId,
				provenanceIds: [resolution.provenanceId],
				relationKind: edgeRelationKind,
				resolutionState: resolution.resolutionState,
				semanticSnapshotId: snapshot.id,
				source,
				sourceLocations: [
					{ end: occurrence.end, sourceId: occurrence.sourceId, start: occurrence.start }
				],
				specifier: resolution.specifier,
				specifierState: resolution.specifierState,
				subjectId: snapshot.subjectId,
				target,
				typeOnly: resolution.typeOnly
			};
		});
		edges.sort(compareId);
		const limitations = limitationsFor(snapshot);
		const coverage = coverageFor(snapshot, nodes, edges);
		const epistemic = aggregateEpistemic(snapshot.moduleResolutions);
		const layerProvenanceIds = [
			...new Set(
				nodes
					.flatMap((node) => node.provenanceIds)
					.concat(edges.flatMap((edge) => edge.provenanceIds))
			)
		].sort();
		const layer: ModuleDependencyGraphLayer = {
			coverage,
			edgeIds: edges.map((edge) => edge.id),
			epistemic,
			graphId,
			id: layerId,
			kind: 'TYPESCRIPT_MODULE_RESOLUTION',
			limitations,
			method: MODULE_DEPENDENCY_GRAPH_METHOD,
			nodeIds: nodes.map((node) => node.id),
			ordinal: 0,
			provenanceIds: layerProvenanceIds,
			producer: { ...snapshot.provider },
			semanticSnapshotId: snapshot.id,
			subjectId: snapshot.subjectId
		};
		const content = {
			canonicalProfile: MODULE_DEPENDENCY_GRAPH_CANONICAL_PROFILE,
			coverage,
			edges,
			epistemic,
			forwardIndex: makeIndexes(nodes, edges, 'FORWARD'),
			fullJanCsaa007Conformance: FULL_JAN_CSAA_007_CONFORMANCE,
			graphInputDigest,
			graphKind: 'TYPESCRIPT_MODULE_DEPENDENCY' as const,
			health: coverage.closure === 'CLOSED' ? ('COMPLETE' as const) : ('PARTIAL' as const),
			id: graphId,
			layers: [layer] as const,
			limitations,
			method: MODULE_DEPENDENCY_GRAPH_METHOD,
			nodes,
			operationVersion: MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
			producer: { ...snapshot.provider },
			reverseIndex: makeIndexes(nodes, edges, 'REVERSE'),
			schemaVersion: MODULE_DEPENDENCY_GRAPH_SCHEMA_VERSION,
			semanticExtractionVersion: snapshot.extractionVersion,
			semanticSchemaVersion: snapshot.schemaVersion,
			semanticSnapshotId: snapshot.id,
			subjectId: snapshot.subjectId
		};
		const graph: ModuleDependencyGraphSnapshot = {
			...content,
			contentDigest: moduleDependencyGraphContentDigest(content)
		};
		const validation = validateModuleDependencyGraph(graph, snapshot);
		if (validation.state !== 'VALID') {
			const firstIssue = validation.issues[0];
			return unavailable(
				'GRAPH_VALIDATION_FAILED',
				firstIssue === undefined
					? 'Module dependency graph validation failed without a diagnostic.'
					: `Module dependency graph validation failed: ${firstIssue.message}`,
				'VALIDATE',
				firstIssue?.path ?? null
			);
		}
		return {
			diagnostics: partialDiagnostics(limitations),
			graph,
			outcome: graph.health === 'COMPLETE' ? 'complete' : 'partial'
		};
	} catch (error) {
		return unavailable(
			'DANGLING_SEMANTIC_REFERENCE',
			error instanceof Error
				? `Module dependency graph projection failed closed: ${error.message}`
				: 'Module dependency graph projection failed closed.',
			'PROJECT'
		);
	}
}
