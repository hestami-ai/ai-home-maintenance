import { isProxy } from 'node:util/types';
import ts from 'typescript';
import {
	CALL_GRAPH_CANONICAL_PROFILE,
	CALL_GRAPH_CAPABILITY,
	CALL_GRAPH_CAPABILITY_STATUS,
	CALL_GRAPH_METHOD,
	CALL_GRAPH_OPERATION_VERSION,
	CALL_GRAPH_REQUEST_SCHEMA_VERSION,
	CALL_GRAPH_SCHEMA_VERSION,
	type BuildCallGraphRequest,
	type CallGraphBuildDiagnostic,
	type CallGraphBuildOutcome,
	type CallGraphCallableKind,
	type CallGraphCallableTargetNode,
	type CallGraphCallSiteNode,
	type CallGraphCoverage,
	type CallGraphDispatchClass,
	type CallGraphEdge,
	type CallGraphEndpoint,
	type CallGraphEntryMechanism,
	type CallGraphEntryMechanismCoverage,
	type CallGraphEpistemicState,
	type CallGraphFrontierNode,
	type CallGraphIndexEntry,
	type CallGraphLayer,
	type CallGraphLimitation,
	type CallGraphLimitationKind,
	type CallGraphNode,
	type CallGraphNodeId,
	type CallGraphReasonCode,
	type CallGraphRelationLaneCoverage,
	type CallGraphResolutionClass,
	type CallGraphSnapshot
} from '../contracts/call-graph.js';
import {
	FULL_JAN_CSAA_007_CONFORMANCE,
	type SemanticAstNodeRecord,
	type SemanticDeclarationId,
	type SemanticDeclarationRecord,
	type SemanticInvocationSiteRecord,
	type SemanticProvenanceId,
	type SemanticReferenceRecord,
	type SemanticSourceRecord,
	type SemanticSymbolId,
	type StaticSemanticSnapshot
} from '../contracts/semantic.js';
import { callGraphContentDigest } from './call-graph-content.js';
import {
	callGraphCallSiteNodeId,
	callGraphCallableTargetNodeId,
	callGraphEdgeId,
	callGraphFrontierNodeId,
	callGraphId,
	callGraphLayerId,
	callGraphSourceRegionNodeId
} from './call-graph-ids.js';
import { callGraphInputDigest } from './call-graph-input.js';
import { validateConstructedCallGraph } from './validate-call-graph.js';

const REQUEST_KEYS = [
	'operationVersion',
	'schemaVersion',
	'semanticSnapshotId',
	'subjectId'
] as const;

const ENTRY_MECHANISMS: readonly CallGraphEntryMechanism[] = [
	'PACKAGE_OR_EXECUTABLE_ENTRY',
	'FRAMEWORK_ENTRY',
	'TEST_DISCOVERY_ENTRY',
	'DYNAMIC_IMPORT_OR_CONDITIONAL_LOAD',
	'DEPENDENCY_INJECTION_OR_SERVICE_REGISTRY',
	'EVENT_MESSAGE_COMMAND_CALLBACK_TIMER_OR_SUBSCRIPTION',
	'DECORATOR_OR_METADATA_DISCOVERY',
	'REFLECTION_OR_NAME_LOOKUP',
	'CONFIG_MANIFEST_SCRIPT_PLUGIN_OR_EXTENSION',
	'GENERATED_OR_VIRTUAL_SOURCE_ENTRY',
	'EXTERNAL_API_JOB_PROTOCOL_OR_NATIVE_ENTRY',
	'RUNTIME_OBSERVED_ENTRY'
];

const ENTRY_MECHANISM_COVERAGE: readonly CallGraphEntryMechanismCoverage[] = [...ENTRY_MECHANISMS]
	.sort()
	.map((mechanism) => ({
		mechanism,
		reason: 'This initial static call projection does not model entry mechanisms.',
		state: 'NOT_ANALYZED'
	}));

const RELATION_LANE_COVERAGE: readonly CallGraphRelationLaneCoverage[] = (
	[
		{
			lane: 'CANDIDATE',
			reason:
				'Compiler-bound symbols and retained callable declarations support open static candidates.',
			state: 'PARTIAL'
		},
		{
			lane: 'CONFIRMED',
			reason:
				'Invocation-specific resolved signatures and dispatch-closure evidence are not retained.',
			state: 'NOT_SUPPORTED'
		},
		{
			lane: 'INFERRED',
			reason: 'No separately qualified call-target inference provider is applied.',
			state: 'NOT_SUPPORTED'
		},
		{
			lane: 'OBSERVED',
			reason: 'No runtime execution evidence is consumed by this static projection.',
			state: 'NOT_RUN'
		},
		{
			lane: 'UNRESOLVED',
			reason: 'Every unbounded, unresolved, external, or unsupported target remains explicit.',
			state: 'SUPPORTED'
		}
	] satisfies CallGraphRelationLaneCoverage[]
).sort((left, right) => (left.lane < right.lane ? -1 : left.lane > right.lane ? 1 : 0));

const TRANSPARENT_CALLEE_KINDS = new Set<number>([
	ts.SyntaxKind.ParenthesizedExpression,
	ts.SyntaxKind.NonNullExpression,
	ts.SyntaxKind.AsExpression,
	ts.SyntaxKind.TypeAssertionExpression,
	ts.SyntaxKind.SatisfiesExpression
]);

interface CallableSpec {
	readonly assignmentInputIdsBySymbol: Map<SemanticSymbolId, Set<string>>;
	readonly bodyState: CallGraphCallableTargetNode['bodyState'];
	readonly callableKind: CallGraphCallableKind;
	readonly declarationIds: Set<SemanticDeclarationId>;
	readonly node: SemanticAstNodeRecord;
	readonly source: SemanticSourceRecord;
	readonly symbolIds: Set<SemanticSymbolId>;
}

interface CallClassification {
	readonly dispatchClass: CallGraphDispatchClass;
	readonly invocation: SemanticInvocationSiteRecord;
	readonly ownerNodeId: CallGraphNodeId;
	readonly provenanceIds: readonly SemanticProvenanceId[];
	readonly reasonCode: CallGraphReasonCode;
	readonly referenceIds: readonly SemanticReferenceRecord['id'][];
	readonly resolutionClass: CallGraphResolutionClass;
	readonly resolvedSymbolIds: readonly SemanticSymbolId[];
	readonly source: SemanticSourceRecord;
	readonly targetCallableNodeIds: readonly CallGraphNodeId[];
	readonly targetSpecs: readonly CallableSpec[];
}

function diagnostic(
	code: CallGraphBuildDiagnostic['code'],
	message: string,
	phase: CallGraphBuildDiagnostic['phase'],
	path: string | null = null
): CallGraphBuildDiagnostic {
	return { code, message, path, phase };
}

function unavailable(
	code: CallGraphBuildDiagnostic['code'],
	message: string,
	phase: CallGraphBuildDiagnostic['phase'],
	path: string | null = null
): CallGraphBuildOutcome {
	return { diagnostics: [diagnostic(code, message, phase, path)], outcome: 'unavailable' };
}

function materializeRequest(value: unknown): BuildCallGraphRequest {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		throw new TypeError('Call graph request must be a plain data object.');
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new TypeError('Call graph request must have a plain prototype.');
	const keys = Reflect.ownKeys(value);
	if (keys.some((key) => typeof key !== 'string'))
		throw new TypeError('Call graph request rejects symbol keys.');
	const actual = (keys as string[]).sort();
	const expected = [...REQUEST_KEYS].sort();
	if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index]))
		throw new TypeError(`Call graph request requires exactly ${expected.join(', ')}.`);
	const record = value as Record<string, unknown>;
	for (const key of expected) {
		const descriptor = Reflect.getOwnPropertyDescriptor(record, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new TypeError(`Call graph request field ${key} must be data.`);
		if (typeof descriptor.value !== 'string' || descriptor.value.length === 0)
			throw new TypeError(`Call graph request field ${key} must be nonempty text.`);
	}
	if (record.schemaVersion !== CALL_GRAPH_REQUEST_SCHEMA_VERSION)
		throw new TypeError('Unsupported call graph request schema version.');
	if (record.operationVersion !== CALL_GRAPH_OPERATION_VERSION)
		throw new TypeError('Unsupported call graph operation version.');
	return record as unknown as BuildCallGraphRequest;
}

function compareId(left: { readonly id: string }, right: { readonly id: string }): number {
	return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function sortedUnique<T extends string>(values: Iterable<T>): T[] {
	return [...new Set(values)].sort();
}

function addGrouped<Key, Value>(map: Map<Key, Value[]>, key: Key, value: Value): void {
	const group = map.get(key);
	if (group === undefined) map.set(key, [value]);
	else group.push(value);
}

function callableKind(kind: number): CallGraphCallableKind | null {
	switch (kind) {
		case ts.SyntaxKind.FunctionDeclaration:
			return 'FUNCTION_DECLARATION';
		case ts.SyntaxKind.MethodDeclaration:
			return 'METHOD_DECLARATION';
		case ts.SyntaxKind.Constructor:
			return 'CONSTRUCTOR';
		case ts.SyntaxKind.GetAccessor:
			return 'GET_ACCESSOR';
		case ts.SyntaxKind.SetAccessor:
			return 'SET_ACCESSOR';
		case ts.SyntaxKind.FunctionExpression:
			return 'FUNCTION_EXPRESSION';
		case ts.SyntaxKind.ArrowFunction:
			return 'ARROW_FUNCTION';
		case ts.SyntaxKind.ClassExpression:
			return 'CLASS_EXPRESSION';
		case ts.SyntaxKind.ClassDeclaration:
			return 'CLASS_DECLARATION';
		case ts.SyntaxKind.ClassStaticBlockDeclaration:
			return 'CLASS_STATIC_BLOCK';
		default:
			return null;
	}
}

function bodyState(
	node: SemanticAstNodeRecord,
	children: readonly SemanticAstNodeRecord[]
): CallGraphCallableTargetNode['bodyState'] | null {
	if (node.kind === ts.SyntaxKind.ClassStaticBlockDeclaration) return 'STATIC_BLOCK';
	if (node.kind === ts.SyntaxKind.ArrowFunction)
		return children.some((child) => child.kind === ts.SyntaxKind.Block)
			? 'BLOCK_BODY'
			: 'EXPRESSION_BODY';
	if (node.kind === ts.SyntaxKind.ClassDeclaration || node.kind === ts.SyntaxKind.ClassExpression)
		return children.some((child) => child.kind === ts.SyntaxKind.Constructor) ? null : 'IMPLICIT';
	return children.some((child) => child.kind === ts.SyntaxKind.Block) ? 'BLOCK_BODY' : null;
}

function compatibleCallable(
	invocationKind: SemanticInvocationSiteRecord['invocationKind'],
	spec: CallableSpec
): boolean {
	if (invocationKind === 'NEW')
		return (
			spec.callableKind === 'CONSTRUCTOR' ||
			spec.callableKind === 'CLASS_DECLARATION' ||
			spec.callableKind === 'CLASS_EXPRESSION'
		);
	return (
		spec.callableKind === 'FUNCTION_DECLARATION' ||
		spec.callableKind === 'METHOD_DECLARATION' ||
		spec.callableKind === 'FUNCTION_EXPRESSION' ||
		spec.callableKind === 'ARROW_FUNCTION'
	);
}

function structuralEpistemic(snapshot: StaticSemanticSnapshot): CallGraphEpistemicState {
	return {
		capabilityCoverage: 'PARTIAL',
		conflictState: 'NOT_EVALUATED',
		executionHealth: snapshot.health === 'COMPLETE' ? 'SUCCEEDED' : 'PARTIAL',
		freshness: 'SNAPSHOT_BOUND',
		inferenceState: 'NONE',
		supportBasis: 'COMPILER_CONFIRMED'
	};
}

function epistemicForResolution(
	resolutionClass: CallGraphResolutionClass,
	snapshot: StaticSemanticSnapshot
): CallGraphEpistemicState {
	if (resolutionClass === 'CANDIDATE_SET')
		return {
			capabilityCoverage: 'PARTIAL',
			conflictState: 'NOT_EVALUATED',
			executionHealth: snapshot.health === 'COMPLETE' ? 'SUCCEEDED' : 'PARTIAL',
			freshness: 'SNAPSHOT_BOUND',
			inferenceState: 'CANDIDATE',
			supportBasis: 'COMPILER_BOUND_STATIC_CANDIDATE'
		};
	if (resolutionClass === 'UNSUPPORTED')
		return {
			capabilityCoverage: 'UNSUPPORTED',
			conflictState: 'NOT_EVALUATED',
			executionHealth: 'PARTIAL',
			freshness: 'SNAPSHOT_BOUND',
			inferenceState: 'UNRESOLVED',
			supportBasis: 'UNSUPPORTED'
		};
	return {
		capabilityCoverage: 'PARTIAL',
		conflictState: 'NOT_EVALUATED',
		executionHealth: 'PARTIAL',
		freshness: 'SNAPSHOT_BOUND',
		inferenceState: resolutionClass === 'EXACT' ? 'NONE' : 'UNRESOLVED',
		supportBasis: resolutionClass === 'EXACT' ? 'COMPILER_CONFIRMED' : 'NO_TARGET_EVIDENCE'
	};
}

function globalEpistemic(
	snapshot: StaticSemanticSnapshot,
	classifications: readonly CallClassification[]
): CallGraphEpistemicState {
	if (classifications.length === 0) return structuralEpistemic(snapshot);
	const candidateCount = classifications.filter(
		(classification) => classification.resolutionClass === 'CANDIDATE_SET'
	).length;
	const allUnsupported = classifications.every(
		(classification) => classification.resolutionClass === 'UNSUPPORTED'
	);
	return {
		capabilityCoverage: 'PARTIAL',
		conflictState: 'NOT_EVALUATED',
		executionHealth: 'PARTIAL',
		freshness: 'SNAPSHOT_BOUND',
		inferenceState:
			candidateCount === 0
				? 'UNRESOLVED'
				: candidateCount === classifications.length
					? 'CANDIDATE'
					: 'MIXED',
		supportBasis:
			candidateCount > 0
				? 'COMPILER_BOUND_STATIC_CANDIDATE'
				: allUnsupported
					? 'UNSUPPORTED'
					: 'NO_TARGET_EVIDENCE'
	};
}

function endpoint(node: CallGraphNode): CallGraphEndpoint {
	return { kind: node.kind, nodeId: node.id };
}

function makeIndexes(
	nodes: readonly CallGraphNode[],
	edges: readonly CallGraphEdge[],
	direction: 'FORWARD' | 'REVERSE'
): readonly CallGraphIndexEntry[] {
	const byNode = new Map<CallGraphNodeId, CallGraphEdge['id'][]>(
		nodes.map((node) => [node.id, []])
	);
	for (const edge of edges) {
		const nodeId = direction === 'FORWARD' ? edge.source.nodeId : edge.target.nodeId;
		const group = byNode.get(nodeId);
		if (group === undefined)
			throw new Error('A call edge endpoint is absent from the node population.');
		group.push(edge.id);
	}
	return [...byNode.entries()]
		.map(([nodeId, edgeIds]) => ({ edgeIds: edgeIds.sort(), nodeId }))
		.sort((left, right) => (left.nodeId < right.nodeId ? -1 : left.nodeId > right.nodeId ? 1 : 0));
}

function limitation(
	kind: CallGraphLimitationKind,
	reason: string,
	invocation: SemanticInvocationSiteRecord | null = null
): CallGraphLimitation {
	return {
		closureEffect: 'DEGRADES_CLOSURE',
		invocationId: invocation?.id ?? null,
		kind,
		reason,
		sourceId: invocation?.sourceId ?? null
	};
}

function compareLimitation(left: CallGraphLimitation, right: CallGraphLimitation): number {
	const leftKey = `${left.kind}\0${left.invocationId ?? ''}\0${left.sourceId ?? ''}`;
	const rightKey = `${right.kind}\0${right.invocationId ?? ''}\0${right.sourceId ?? ''}`;
	return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}

function partialDiagnostics(
	limitations: readonly CallGraphLimitation[]
): readonly CallGraphBuildDiagnostic[] {
	const counts = new Map<CallGraphLimitationKind, number>();
	for (const entry of limitations) counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);
	return [...counts.entries()]
		.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
		.map(([kind, count]) =>
			diagnostic(
				'GRAPH_PARTIAL',
				`${kind}: ${String(count)} explicit call-graph limitation${count === 1 ? '' : 's'}.`,
				'PROJECT'
			)
		);
}

function resolutionDispatchClass(
	callee: SemanticAstNodeRecord,
	memberReferences: readonly SemanticReferenceRecord[],
	inlineSpecs: readonly CallableSpec[]
): CallGraphDispatchClass {
	if (inlineSpecs.length > 0) return 'INLINE_CALLABLE';
	if (callee.kind === ts.SyntaxKind.Identifier || callee.kind === ts.SyntaxKind.PrivateIdentifier)
		return 'DIRECT_REFERENCE';
	if (callee.kind === ts.SyntaxKind.PropertyAccessExpression) return 'MEMBER_REFERENCE';
	if (callee.kind === ts.SyntaxKind.ElementAccessExpression)
		return memberReferences.length === 1 ? 'LITERAL_ELEMENT_REFERENCE' : 'DYNAMIC_EXPRESSION';
	if (TRANSPARENT_CALLEE_KINDS.has(callee.kind))
		return memberReferences.length === 1 ? 'MEMBER_REFERENCE' : 'DIRECT_REFERENCE';
	return 'UNSUPPORTED_EXPRESSION';
}

export function buildCallGraph(
	requestValue: unknown,
	snapshot: StaticSemanticSnapshot
): CallGraphBuildOutcome {
	let request: BuildCallGraphRequest;
	try {
		request = materializeRequest(requestValue);
	} catch (error) {
		return unavailable(
			'REQUEST_INVALID',
			error instanceof Error ? error.message : 'Invalid call graph request.',
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
	for (const capability of ['TS_PROJECT', 'TS_SYNTAX', 'TS_SYMBOL', 'TS_TYPE'] as const) {
		const state = snapshot.capabilities.find((record) => record.capability === capability)?.state;
		if (state === undefined || state === 'UNSUPPORTED')
			return unavailable(
				'SEMANTIC_CAPABILITY_UNAVAILABLE',
				`The ${capability} semantic capability is required for call graph projection.`,
				'PROJECT',
				'$.capabilities'
			);
	}

	try {
		const nodeById = new Map(snapshot.astNodes.map((node) => [node.id, node]));
		const sourceById = new Map(snapshot.sources.map((source) => [source.id, source]));
		const referenceById = new Map(
			snapshot.references.map((reference) => [reference.id, reference])
		);
		const symbolById = new Map(snapshot.symbols.map((symbol) => [symbol.id, symbol]));
		const declarationById = new Map(
			snapshot.declarations.map((declaration) => [declaration.id, declaration])
		);
		const provenanceIds = new Set(snapshot.provenances.map((record) => record.id));
		for (const [name, size, length] of [
			['AST node', nodeById.size, snapshot.astNodes.length],
			['source', sourceById.size, snapshot.sources.length],
			['reference', referenceById.size, snapshot.references.length],
			['symbol', symbolById.size, snapshot.symbols.length],
			['declaration', declarationById.size, snapshot.declarations.length],
			['provenance', provenanceIds.size, snapshot.provenances.length]
		] as const)
			if (size !== length)
				throw new Error(`The semantic ${name} population contains duplicate IDs.`);

		const childrenByParent = new Map<SemanticAstNodeRecord['id'], SemanticAstNodeRecord[]>();
		for (const node of snapshot.astNodes) {
			if (!sourceById.has(node.sourceId))
				throw new Error(`AST node ${node.id} has a missing source.`);
			if (node.parentId !== null) {
				const parent = nodeById.get(node.parentId);
				if (parent === undefined || parent.sourceId !== node.sourceId)
					throw new Error(`AST node ${node.id} has an invalid parent.`);
				addGrouped(childrenByParent, node.parentId, node);
			}
		}
		for (const children of childrenByParent.values()) children.sort(compareId);

		const declarationsByNode = new Map<SemanticAstNodeRecord['id'], SemanticDeclarationRecord[]>();
		for (const declaration of snapshot.declarations) {
			if (!sourceById.has(declaration.sourceId))
				throw new Error(`Declaration ${declaration.id} has a missing source.`);
			if (declaration.nodeId !== null) {
				const node = nodeById.get(declaration.nodeId);
				if (node === undefined || node.sourceId !== declaration.sourceId)
					throw new Error(`Declaration ${declaration.id} has an invalid node.`);
				addGrouped(declarationsByNode, declaration.nodeId, declaration);
			}
			if (declaration.symbolId !== null && !symbolById.has(declaration.symbolId))
				throw new Error(`Declaration ${declaration.id} has a missing symbol.`);
		}
		for (const symbol of snapshot.symbols)
			for (const declarationId of symbol.declarationIds)
				if (!declarationById.has(declarationId))
					throw new Error(`Symbol ${symbol.id} has a missing declaration.`);

		const referencesByNode = new Map<SemanticAstNodeRecord['id'], SemanticReferenceRecord[]>();
		for (const reference of snapshot.references) {
			const node = nodeById.get(reference.nodeId);
			if (node === undefined || node.sourceId !== reference.sourceId)
				throw new Error(`Reference ${reference.id} has an invalid node.`);
			if (reference.resolvedSymbolId !== null && !symbolById.has(reference.resolvedSymbolId))
				throw new Error(`Reference ${reference.id} has a missing resolved symbol.`);
			addGrouped(referencesByNode, reference.nodeId, reference);
		}
		for (const references of referencesByNode.values()) references.sort(compareId);

		const callableSpecsByNode = new Map<SemanticAstNodeRecord['id'], CallableSpec>();
		for (const node of snapshot.astNodes) {
			const source = sourceById.get(node.sourceId)!;
			if (source.analysisDisposition !== 'DEEP_INDEXED') continue;
			const kind = callableKind(node.kind);
			if (kind === null) continue;
			const state = bodyState(node, childrenByParent.get(node.id) ?? []);
			if (state === null) continue;
			const declarations = declarationsByNode.get(node.id) ?? [];
			callableSpecsByNode.set(node.id, {
				assignmentInputIdsBySymbol: new Map(),
				bodyState: state,
				callableKind: kind,
				declarationIds: new Set(declarations.map((declaration) => declaration.id)),
				node,
				source,
				symbolIds: new Set(
					declarations.flatMap((declaration) =>
						declaration.symbolId === null ? [] : [declaration.symbolId]
					)
				)
			});
		}

		// A class symbol denotes its explicit constructor when one exists. Otherwise
		// the class node itself is the explicit frontier anchor for an implicit constructor.
		for (const node of snapshot.astNodes) {
			if (
				node.kind !== ts.SyntaxKind.ClassDeclaration &&
				node.kind !== ts.SyntaxKind.ClassExpression
			)
				continue;
			const classDeclarations = declarationsByNode.get(node.id) ?? [];
			const constructorNode = (childrenByParent.get(node.id) ?? []).find(
				(child) => child.kind === ts.SyntaxKind.Constructor
			);
			const spec =
				constructorNode === undefined
					? callableSpecsByNode.get(node.id)
					: callableSpecsByNode.get(constructorNode.id);
			if (spec === undefined) continue;
			for (const declaration of classDeclarations) {
				spec.declarationIds.add(declaration.id);
				if (declaration.symbolId !== null) spec.symbolIds.add(declaration.symbolId);
			}
		}

		// Initializer/assignment links seed possible callable values only. They never
		// prove exclusivity, no-write, order, or dispatch closure and therefore can
		// contribute candidates but cannot produce confirmed edges.
		for (const assignment of snapshot.assignments) {
			if (assignment.valueNodeId === null) continue;
			const spec = callableSpecsByNode.get(assignment.valueNodeId);
			if (spec === undefined) continue;
			for (const reference of referencesByNode.get(assignment.targetNodeId) ?? []) {
				if (reference.resolvedSymbolId === null) continue;
				const symbolId = reference.resolvedSymbolId;
				spec.symbolIds.add(symbolId);
				const associationInputs =
					spec.assignmentInputIdsBySymbol.get(symbolId) ?? new Set<string>();
				associationInputs.add(assignment.nodeId);
				associationInputs.add(assignment.targetNodeId);
				associationInputs.add(assignment.valueNodeId);
				spec.assignmentInputIdsBySymbol.set(symbolId, associationInputs);
				const symbol = symbolById.get(symbolId)!;
				for (const declarationId of symbol.declarationIds) spec.declarationIds.add(declarationId);
			}
		}

		const graphInputDigest = callGraphInputDigest(snapshot);
		const graphId = callGraphId({
			canonicalProfile: CALL_GRAPH_CANONICAL_PROFILE,
			graphInputDigest,
			graphKind: 'TYPESCRIPT_CALL',
			method: CALL_GRAPH_METHOD,
			operationVersion: CALL_GRAPH_OPERATION_VERSION,
			schemaVersion: CALL_GRAPH_SCHEMA_VERSION,
			semanticSnapshotId: snapshot.id,
			subjectId: snapshot.subjectId
		});
		const layerId = callGraphLayerId(graphId, 'TYPESCRIPT_STATIC_CALL', 0);

		const sourceNodes = snapshot.sources.map((source): CallGraphNode => ({
			analysisDisposition: source.analysisDisposition,
			epistemic: structuralEpistemic(snapshot),
			graphId,
			id: callGraphSourceRegionNodeId(graphId, source.id),
			kind: 'SOURCE_REGION',
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
		const sourceNodeBySourceId = new Map(
			sourceNodes.map((node) => {
				if (node.kind !== 'SOURCE_REGION') throw new Error('Invalid source-region projection.');
				return [node.semanticSourceId, node] as const;
			})
		);

		const callableNodes: CallGraphCallableTargetNode[] = [...callableSpecsByNode.values()]
			.map((spec): CallGraphCallableTargetNode => {
				const declarations = [...spec.declarationIds]
					.map((id) => declarationById.get(id))
					.filter((value): value is SemanticDeclarationRecord => value !== undefined);
				const nodeProvenance = sortedUnique([
					spec.source.provenanceId,
					...(spec.source.syntaxProvenanceId === null ? [] : [spec.source.syntaxProvenanceId]),
					...declarations.flatMap((record) => [
						record.bindingProvenanceId,
						record.structuralProvenanceId
					])
				]);
				return {
					bodyState: spec.bodyState,
					callableKind: spec.callableKind,
					declarationIds: sortedUnique(spec.declarationIds),
					epistemic: structuralEpistemic(snapshot),
					graphId,
					id: callGraphCallableTargetNodeId(graphId, spec.node.id),
					kind: 'CALLABLE_TARGET',
					layerId,
					programId: spec.source.programId,
					projectId: spec.source.projectId,
					provenanceIds: nodeProvenance,
					semanticNodeId: spec.node.id,
					semanticSnapshotId: snapshot.id,
					sourceId: spec.source.id,
					sourceLocations: [
						{ end: spec.node.end, sourceId: spec.source.id, start: spec.node.start }
					],
					subjectId: snapshot.subjectId,
					symbolIds: sortedUnique(spec.symbolIds)
				};
			})
			.sort(compareId);
		const callableNodeBySemanticNodeId = new Map(
			callableNodes.map((node) => [node.semanticNodeId, node])
		);
		const callableNodeById = new Map(callableNodes.map((node) => [node.id, node]));
		const specsBySymbol = new Map<SemanticSymbolId, CallableSpec[]>();
		for (const spec of callableSpecsByNode.values())
			for (const symbolId of spec.symbolIds) addGrouped(specsBySymbol, symbolId, spec);
		for (const specs of specsBySymbol.values())
			specs.sort((left, right) =>
				left.node.id < right.node.id ? -1 : left.node.id > right.node.id ? 1 : 0
			);

		function subtreeIds(root: SemanticAstNodeRecord): Set<SemanticAstNodeRecord['id']> {
			const result = new Set<SemanticAstNodeRecord['id']>();
			const stack = [root];
			while (stack.length > 0) {
				const current = stack.pop()!;
				if (result.has(current.id)) continue;
				result.add(current.id);
				for (const child of childrenByParent.get(current.id) ?? []) stack.push(child);
			}
			return result;
		}

		function inlineCallableSpecs(
			root: SemanticAstNodeRecord,
			invocationKind: SemanticInvocationSiteRecord['invocationKind']
		): CallableSpec[] {
			const direct = callableSpecsByNode.get(root.id);
			if (direct !== undefined && compatibleCallable(invocationKind, direct)) return [direct];
			if (root.kind === ts.SyntaxKind.ClassExpression) {
				const constructor = (childrenByParent.get(root.id) ?? [])
					.map((child) => callableSpecsByNode.get(child.id))
					.find(
						(spec): spec is CallableSpec =>
							spec !== undefined &&
							spec.callableKind === 'CONSTRUCTOR' &&
							compatibleCallable(invocationKind, spec)
					);
				return constructor === undefined ? [] : [constructor];
			}
			if (!TRANSPARENT_CALLEE_KINDS.has(root.kind)) return [];
			return (childrenByParent.get(root.id) ?? []).flatMap((child) =>
				inlineCallableSpecs(child, invocationKind)
			);
		}

		function ownerFor(invocationNode: SemanticAstNodeRecord): CallGraphNodeId {
			let parentId = invocationNode.parentId;
			const visited = new Set<SemanticAstNodeRecord['id']>();
			while (parentId !== null) {
				if (visited.has(parentId)) throw new Error('AST ancestry contains a cycle.');
				visited.add(parentId);
				const callable = callableNodeBySemanticNodeId.get(parentId);
				if (callable !== undefined) return callable.id;
				const parent = nodeById.get(parentId);
				if (parent === undefined) throw new Error('Invocation ancestry has a missing node.');
				parentId = parent.parentId;
			}
			const sourceNode = sourceNodeBySourceId.get(invocationNode.sourceId);
			if (sourceNode === undefined) throw new Error('Invocation source region is missing.');
			return sourceNode.id;
		}

		const invocationNodeIds = new Set(snapshot.invocations.map((invocation) => invocation.nodeId));
		const classifications: CallClassification[] = snapshot.invocations.map((invocation) => {
			const invocationNode = nodeById.get(invocation.nodeId);
			const callee = nodeById.get(invocation.calleeNodeId);
			const source = sourceById.get(invocation.sourceId);
			if (
				invocationNode === undefined ||
				callee === undefined ||
				source === undefined ||
				invocationNode.sourceId !== invocation.sourceId ||
				callee.sourceId !== invocation.sourceId
			)
				throw new Error(`Invocation ${invocation.id} has invalid semantic endpoints.`);
			const inlineSpecs = inlineCallableSpecs(callee, invocation.invocationKind);
			inlineSpecs.sort((left, right) =>
				left.node.id < right.node.id ? -1 : left.node.id > right.node.id ? 1 : 0
			);
			const baseProvenance = sortedUnique([
				source.provenanceId,
				...(source.syntaxProvenanceId === null ? [] : [source.syntaxProvenanceId])
			]);
			let base = {
				dispatchClass: resolutionDispatchClass(callee, [], inlineSpecs),
				invocation,
				ownerNodeId: ownerFor(invocationNode),
				source
			};

			if (
				callee.kind === ts.SyntaxKind.ImportKeyword ||
				(callee.kind === ts.SyntaxKind.Identifier && callee.syntacticIdentifierText === 'eval')
			)
				return {
					...base,
					provenanceIds: baseProvenance,
					reasonCode:
						callee.kind === ts.SyntaxKind.ImportKeyword
							? 'DYNAMIC_IMPORT_CALL'
							: 'DYNAMIC_CALLEE_EXPRESSION',
					referenceIds: [],
					resolutionClass: 'UNSUPPORTED',
					resolvedSymbolIds: [],
					targetCallableNodeIds: [],
					targetSpecs: []
				};

			if (inlineSpecs.length === 1) {
				const target = callableNodeBySemanticNodeId.get(inlineSpecs[0]!.node.id);
				if (target === undefined) throw new Error('Inline callable target node is missing.');
				return {
					...base,
					provenanceIds: baseProvenance,
					reasonCode: 'INLINE_CALLABLE_WITHOUT_RESOLVED_SIGNATURE',
					referenceIds: [],
					resolutionClass: 'CANDIDATE_SET',
					resolvedSymbolIds: target.symbolIds,
					targetCallableNodeIds: [target.id],
					targetSpecs: inlineSpecs
				};
			}
			if (inlineSpecs.length > 1)
				return {
					...base,
					provenanceIds: baseProvenance,
					reasonCode: 'MULTIPLE_CALLEE_REFERENCE_CANDIDATES',
					referenceIds: [],
					resolutionClass: 'UNSUPPORTED',
					resolvedSymbolIds: [],
					targetCallableNodeIds: [],
					targetSpecs: []
				};

			const calleeSubtree = subtreeIds(callee);
			let containsNestedInvocation = false;
			for (const nodeId of calleeSubtree)
				if (invocationNodeIds.has(nodeId)) {
					containsNestedInvocation = true;
					break;
				}
			if (containsNestedInvocation)
				return {
					...base,
					dispatchClass: 'UNSUPPORTED_EXPRESSION',
					provenanceIds: baseProvenance,
					reasonCode: 'DYNAMIC_CALLEE_EXPRESSION',
					referenceIds: [],
					resolutionClass: 'UNSUPPORTED',
					resolvedSymbolIds: [],
					targetCallableNodeIds: [],
					targetSpecs: []
				};
			const subtreeReferences: SemanticReferenceRecord[] = [];
			for (const nodeId of calleeSubtree)
				subtreeReferences.push(...(referencesByNode.get(nodeId) ?? []));
			subtreeReferences.sort(compareId);
			const memberReferences = subtreeReferences.filter(
				(reference) => reference.role === 'MEMBER_NAME'
			);
			base = {
				...base,
				dispatchClass: resolutionDispatchClass(callee, memberReferences, inlineSpecs)
			};

			if (callee.kind === ts.SyntaxKind.ThisKeyword || callee.kind === ts.SyntaxKind.SuperKeyword)
				return {
					...base,
					provenanceIds: baseProvenance,
					reasonCode: 'THIS_OR_SUPER_DISPATCH',
					referenceIds: [],
					resolutionClass: 'UNSUPPORTED',
					resolvedSymbolIds: [],
					targetCallableNodeIds: [],
					targetSpecs: []
				};
			if (callee.kind === ts.SyntaxKind.ElementAccessExpression && memberReferences.length === 0)
				return {
					...base,
					provenanceIds: baseProvenance,
					reasonCode: 'COMPUTED_ELEMENT_DISPATCH',
					referenceIds: subtreeReferences.map((reference) => reference.id).sort(),
					resolutionClass: 'UNSUPPORTED',
					resolvedSymbolIds: [],
					targetCallableNodeIds: [],
					targetSpecs: []
				};

			let selectedReferences: SemanticReferenceRecord[];
			if (
				callee.kind === ts.SyntaxKind.PropertyAccessExpression ||
				callee.kind === ts.SyntaxKind.ElementAccessExpression ||
				memberReferences.length > 0
			)
				selectedReferences = memberReferences;
			else if (
				callee.kind === ts.SyntaxKind.Identifier ||
				callee.kind === ts.SyntaxKind.PrivateIdentifier
			)
				selectedReferences = referencesByNode.get(callee.id) ?? [];
			else if (TRANSPARENT_CALLEE_KINDS.has(callee.kind))
				selectedReferences = subtreeReferences.filter(
					(reference) => reference.role === 'SYMBOL_USE' || reference.role === 'MEMBER_NAME'
				);
			else selectedReferences = [];

			if (selectedReferences.length === 0)
				return {
					...base,
					provenanceIds: baseProvenance,
					reasonCode:
						base.dispatchClass === 'UNSUPPORTED_EXPRESSION'
							? 'DYNAMIC_CALLEE_EXPRESSION'
							: 'CALLEE_REFERENCE_NOT_RECONCILED',
					referenceIds: [],
					resolutionClass:
						base.dispatchClass === 'UNSUPPORTED_EXPRESSION' ? 'UNSUPPORTED' : 'UNRESOLVED',
					resolvedSymbolIds: [],
					targetCallableNodeIds: [],
					targetSpecs: []
				};
			if (selectedReferences.length > 1)
				return {
					...base,
					provenanceIds: sortedUnique([
						...baseProvenance,
						...selectedReferences.flatMap((reference) => [
							reference.resolutionProvenanceId,
							reference.structuralProvenanceId
						])
					]),
					reasonCode: 'MULTIPLE_CALLEE_REFERENCE_CANDIDATES',
					referenceIds: selectedReferences.map((reference) => reference.id).sort(),
					resolutionClass: 'UNSUPPORTED',
					resolvedSymbolIds: sortedUnique(
						selectedReferences.flatMap((reference) =>
							reference.resolvedSymbolId === null ? [] : [reference.resolvedSymbolId]
						)
					),
					targetCallableNodeIds: [],
					targetSpecs: []
				};

			const reference = selectedReferences[0]!;
			const referenceProvenance = sortedUnique([
				...baseProvenance,
				reference.resolutionProvenanceId,
				reference.structuralProvenanceId
			]);
			if (reference.resolutionState === 'UNSUPPORTED')
				return {
					...base,
					provenanceIds: referenceProvenance,
					reasonCode: 'REFERENCE_UNSUPPORTED',
					referenceIds: [reference.id],
					resolutionClass: 'UNSUPPORTED',
					resolvedSymbolIds: [],
					targetCallableNodeIds: [],
					targetSpecs: []
				};
			if (reference.resolutionState === 'UNRESOLVED' || reference.resolvedSymbolId === null)
				return {
					...base,
					provenanceIds: referenceProvenance,
					reasonCode: 'REFERENCE_UNRESOLVED',
					referenceIds: [reference.id],
					resolutionClass: 'UNRESOLVED',
					resolvedSymbolIds: [],
					targetCallableNodeIds: [],
					targetSpecs: []
				};

			const symbolId = reference.resolvedSymbolId;
			const symbol = symbolById.get(symbolId);
			if (symbol === undefined) throw new Error(`Resolved symbol ${symbolId} is absent.`);
			const candidates = (specsBySymbol.get(symbolId) ?? []).filter((spec) =>
				compatibleCallable(invocation.invocationKind, spec)
			);
			const candidateNodes = sortedUnique(
				candidates.map((spec) => callGraphCallableTargetNodeId(graphId, spec.node.id))
			).map((id) => callableNodeById.get(id)!);
			if (candidateNodes.length > 0)
				return {
					...base,
					provenanceIds: referenceProvenance,
					reasonCode: 'RESOLVED_LOCAL_CALLABLE_CANDIDATES',
					referenceIds: [reference.id],
					resolutionClass: 'CANDIDATE_SET',
					resolvedSymbolIds: [symbolId],
					targetCallableNodeIds: candidateNodes.map((node) => node.id),
					targetSpecs: candidates
				};

			const declarations = symbol.declarationIds.map((id) => declarationById.get(id)!);
			const externalOnly =
				declarations.length > 0 &&
				declarations.every((declaration) => {
					const declarationSource = sourceById.get(declaration.sourceId)!;
					return (
						declaration.ambient ||
						declarationSource.analysisDisposition === 'CONTEXT_ONLY' ||
						declarationSource.origin === 'EXTERNAL_DECLARATION' ||
						declarationSource.origin === 'TOOLCHAIN_LIBRARY' ||
						declarationSource.artifactClass === 'EXTERNAL_DEPENDENCY' ||
						declarationSource.artifactClass === 'VENDOR'
					);
				});
			return {
				...base,
				provenanceIds: referenceProvenance,
				reasonCode: externalOnly
					? 'RESOLVED_EXTERNAL_OR_CONTEXT_ONLY_SYMBOL'
					: 'CALLABLE_VALUE_FLOW_NOT_MODELED',
				referenceIds: [reference.id],
				resolutionClass: 'EXTERNAL_DISPATCH',
				resolvedSymbolIds: [symbolId],
				targetCallableNodeIds: [],
				targetSpecs: []
			};
		});

		const callSiteNodes: CallGraphCallSiteNode[] = [];
		const frontierNodes: CallGraphFrontierNode[] = [];
		for (const classification of classifications) {
			const invocationNode = nodeById.get(classification.invocation.nodeId)!;
			const callSiteId = callGraphCallSiteNodeId(graphId, classification.invocation.id);
			let targetNodeIds = classification.targetCallableNodeIds;
			if (classification.resolutionClass !== 'CANDIDATE_SET') {
				const frontierKind =
					classification.resolutionClass === 'EXTERNAL_DISPATCH'
						? ('EXTERNAL_DISPATCH' as const)
						: classification.resolutionClass === 'UNRESOLVED'
							? ('UNRESOLVED' as const)
							: ('UNSUPPORTED' as const);
				const frontierId = callGraphFrontierNodeId(
					graphId,
					classification.invocation.id,
					frontierKind
				);
				frontierNodes.push({
					epistemic: epistemicForResolution(classification.resolutionClass, snapshot),
					frontierKind,
					graphId,
					id: frontierId,
					invocationId: classification.invocation.id,
					kind: 'FRONTIER',
					layerId,
					provenanceIds: classification.provenanceIds,
					reasonCode: classification.reasonCode,
					semanticSnapshotId: snapshot.id,
					semanticSymbolIds: classification.resolvedSymbolIds,
					sourceId: classification.source.id,
					sourceLocations: [
						{
							end: invocationNode.end,
							sourceId: classification.source.id,
							start: invocationNode.start
						}
					],
					subjectId: snapshot.subjectId
				});
				targetNodeIds = [frontierId];
			}
			callSiteNodes.push({
				calleeNodeId: classification.invocation.calleeNodeId,
				dispatchClass: classification.dispatchClass,
				epistemic: epistemicForResolution(classification.resolutionClass, snapshot),
				graphId,
				id: callSiteId,
				invocationId: classification.invocation.id,
				invocationKind: classification.invocation.invocationKind,
				invocationNodeId: classification.invocation.nodeId,
				kind: 'CALL_SITE',
				layerId,
				optional: classification.invocation.optional,
				ownerNodeId: classification.ownerNodeId,
				programId: classification.source.programId,
				projectId: classification.source.projectId,
				provenanceIds: classification.provenanceIds,
				reasonCode: classification.reasonCode,
				referenceIds: classification.referenceIds,
				resolutionClass: classification.resolutionClass,
				resolvedSymbolIds: classification.resolvedSymbolIds,
				semanticSnapshotId: snapshot.id,
				sourceId: classification.source.id,
				sourceLocations: [
					{
						end: invocationNode.end,
						sourceId: classification.source.id,
						start: invocationNode.start
					}
				],
				subjectId: snapshot.subjectId,
				targetNodeIds
			});
		}

		const nodes: CallGraphNode[] = [
			...sourceNodes,
			...callableNodes,
			...callSiteNodes,
			...frontierNodes
		].sort(compareId);
		const nodeByGraphId = new Map(nodes.map((node) => [node.id, node]));
		if (nodeByGraphId.size !== nodes.length) throw new Error('Call graph node identity collision.');
		const callSiteByInvocationId = new Map(callSiteNodes.map((node) => [node.invocationId, node]));
		const classificationByInvocationId = new Map(
			classifications.map((entry) => [entry.invocation.id, entry])
		);
		const edges: CallGraphEdge[] = [];
		for (const callSite of callSiteNodes) {
			const classification = classificationByInvocationId.get(callSite.invocationId)!;
			const targetSpecBySemanticNodeId = new Map(
				classification.targetSpecs.map((spec) => [spec.node.id, spec])
			);
			const owner = nodeByGraphId.get(callSite.ownerNodeId)!;
			const ownershipSource = endpoint(owner);
			const ownershipTarget = endpoint(callSite);
			edges.push({
				candidateRank: null,
				epistemic: structuralEpistemic(snapshot),
				evidenceClass: 'R-SEM',
				graphId,
				id: callGraphEdgeId({
					candidateRank: null,
					graph: graphId,
					invocationId: callSite.invocationId,
					relationKind: 'CALL_SITE_OWNERSHIP',
					source: ownershipSource,
					target: ownershipTarget
				}),
				invocationId: callSite.invocationId,
				layerId,
				method: CALL_GRAPH_METHOD,
				provenanceIds: sortedUnique([...owner.provenanceIds, ...callSite.provenanceIds]),
				relationCode: 'STRUCTURAL',
				relationKind: 'CALL_SITE_OWNERSHIP',
				resolutionClass: null,
				semanticSnapshotId: snapshot.id,
				source: ownershipSource,
				sourceLocations: callSite.sourceLocations,
				subjectId: snapshot.subjectId,
				target: ownershipTarget,
				targetState: 'STRUCTURAL'
			});

			for (const [index, targetNodeId] of callSite.targetNodeIds.entries()) {
				const target = nodeByGraphId.get(targetNodeId)!;
				const sourceEndpoint = endpoint(callSite);
				const targetEndpoint = endpoint(target);
				if (callSite.resolutionClass === 'CANDIDATE_SET') {
					const candidateRank = index + 1;
					const targetSpec =
						target.kind === 'CALLABLE_TARGET'
							? targetSpecBySemanticNodeId.get(target.semanticNodeId)
							: undefined;
					const assignmentInputIds =
						targetSpec === undefined
							? []
							: sortedUnique(
									callSite.resolvedSymbolIds.flatMap((symbolId) => [
										...(targetSpec.assignmentInputIdsBySymbol.get(symbolId) ?? [])
									])
								);
					edges.push({
						candidateRank,
						epistemic: epistemicForResolution('CANDIDATE_SET', snapshot),
						evidenceClass: 'R-INF',
						graphId,
						id: callGraphEdgeId({
							candidateRank,
							graph: graphId,
							invocationId: callSite.invocationId,
							relationKind: 'CANDIDATE_CALL_TARGET',
							source: sourceEndpoint,
							target: targetEndpoint
						}),
						inferenceBasis: {
							inputIds: sortedUnique([
								callSite.invocationId,
								...callSite.referenceIds,
								...callSite.resolvedSymbolIds,
								...assignmentInputIds,
								...(target.kind === 'CALLABLE_TARGET'
									? [target.semanticNodeId, ...target.declarationIds]
									: [])
							]),
							limitationKinds: sortedUnique([
								'CANDIDATE_SET_OPEN',
								'INVOCATION_SPECIFIC_SIGNATURE_NOT_RETAINED',
								...(callSite.dispatchClass === 'MEMBER_REFERENCE' ||
								callSite.dispatchClass === 'LITERAL_ELEMENT_REFERENCE'
									? (['DYNAMIC_DISPATCH_NOT_CLOSED'] as const)
									: [])
							]),
							method: CALL_GRAPH_METHOD,
							rationale:
								'The compiler-bound symbol and retained callable declaration establish a possible target; no exclusivity or dispatch closure is claimed.'
						},
						invocationId: callSite.invocationId,
						layerId,
						method: CALL_GRAPH_METHOD,
						provenanceIds: sortedUnique([...callSite.provenanceIds, ...target.provenanceIds]),
						relationCode: 'REL-068',
						relationKind: 'CANDIDATE_CALL_TARGET',
						resolutionClass: 'CANDIDATE_SET',
						semanticSnapshotId: snapshot.id,
						source: sourceEndpoint,
						sourceLocations: callSite.sourceLocations,
						subjectId: snapshot.subjectId,
						target: targetEndpoint,
						targetState: 'CANDIDATE'
					});
				} else {
					const resolutionClass = callSite.resolutionClass;
					if (resolutionClass === 'EXACT')
						throw new Error('The initial call graph producer cannot emit confirmed targets.');
					edges.push({
						candidateRank: null,
						epistemic: epistemicForResolution(resolutionClass, snapshot),
						evidenceClass: 'R-INF',
						graphId,
						id: callGraphEdgeId({
							candidateRank: null,
							graph: graphId,
							invocationId: callSite.invocationId,
							relationKind: 'UNRESOLVED_CALL_TARGET',
							source: sourceEndpoint,
							target: targetEndpoint
						}),
						invocationId: callSite.invocationId,
						layerId,
						method: CALL_GRAPH_METHOD,
						provenanceIds: sortedUnique([...callSite.provenanceIds, ...target.provenanceIds]),
						relationCode: 'REL-071',
						relationKind: 'UNRESOLVED_CALL_TARGET',
						resolutionClass,
						semanticSnapshotId: snapshot.id,
						source: sourceEndpoint,
						sourceLocations: callSite.sourceLocations,
						subjectId: snapshot.subjectId,
						target: targetEndpoint,
						targetState: 'UNRESOLVED_DYNAMIC'
					});
				}
			}
			if (!classification.provenanceIds.every((id) => provenanceIds.has(id)))
				throw new Error(`Invocation ${callSite.invocationId} has missing provenance.`);
		}
		edges.sort(compareId);
		if (new Set(edges.map((edge) => edge.id)).size !== edges.length)
			throw new Error('Call graph edge identity collision.');

		const limitations: CallGraphLimitation[] = [
			limitation(
				'INVOCATION_SPECIFIC_SIGNATURE_NOT_RETAINED',
				'The semantic snapshot records syntactic invocation sites but not invocation-specific resolved signatures or dispatch closure.'
			),
			limitation(
				'ENTRY_MECHANISM_NOT_ANALYZED',
				'The twelve reachability entry-mechanism classes remain outside this static call projection.'
			),
			limitation(
				'CALLER_CONTEXT_COARSENED',
				'Call-site ownership records the nearest lexical callable or source region; runtime evaluation ownership is not modeled.'
			)
		];
		if (snapshot.health === 'PARTIAL')
			limitations.push(
				limitation('SEMANTIC_INPUT_PARTIAL', 'The bound static semantic snapshot is partial.')
			);
		for (const classification of classifications) {
			switch (classification.resolutionClass) {
				case 'CANDIDATE_SET':
					limitations.push(
						limitation(
							'CANDIDATE_SET_OPEN',
							'The retained candidate set is possible but not proven complete or exclusive.',
							classification.invocation
						)
					);
					if (
						classification.dispatchClass === 'MEMBER_REFERENCE' ||
						classification.dispatchClass === 'LITERAL_ELEMENT_REFERENCE'
					)
						limitations.push(
							limitation(
								'DYNAMIC_DISPATCH_NOT_CLOSED',
								'Member override, structural, and receiver points-to candidates are not closed.',
								classification.invocation
							)
						);
					break;
				case 'EXTERNAL_DISPATCH':
					limitations.push(
						limitation(
							'EXTERNAL_DISPATCH_FRONTIER',
							'The resolved callable value has no bounded deep-indexed executable target.',
							classification.invocation
						)
					);
					if (classification.reasonCode === 'CALLABLE_VALUE_FLOW_NOT_MODELED')
						limitations.push(
							limitation(
								'CALLABLE_VALUE_FLOW_NOT_MODELED',
								'Callable value flow and points-to propagation are not modeled.',
								classification.invocation
							)
						);
					break;
				case 'UNRESOLVED':
					limitations.push(
						limitation(
							'UNRESOLVED_TARGET_FRONTIER',
							'The supported static reference mechanism did not resolve a callable target.',
							classification.invocation
						)
					);
					break;
				case 'UNSUPPORTED':
					limitations.push(
						limitation(
							'UNSUPPORTED_TARGET_FRONTIER',
							'The call target is outside this producer method.',
							classification.invocation
						)
					);
					break;
				case 'EXACT':
					throw new Error('The initial call graph producer cannot classify exact targets.');
			}
		}
		limitations.sort(compareLimitation);

		const targetEdges = edges.filter((edge) => edge.relationKind !== 'CALL_SITE_OWNERSHIP');
		const coverage: CallGraphCoverage = {
			candidateSetCallSites: callSiteNodes.filter(
				(node) => node.resolutionClass === 'CANDIDATE_SET'
			).length,
			candidateTargetEdges: edges.filter((edge) => edge.relationKind === 'CANDIDATE_CALL_TARGET')
				.length,
			closure: 'OPEN',
			exactCallSites: 0,
			expectedCallSites: snapshot.invocations.length,
			externalDispatchCallSites: callSiteNodes.filter(
				(node) => node.resolutionClass === 'EXTERNAL_DISPATCH'
			).length,
			frontierNodes: frontierNodes.length,
			ownershipEdges: edges.filter((edge) => edge.relationKind === 'CALL_SITE_OWNERSHIP').length,
			reconciles:
				callSiteNodes.length === snapshot.invocations.length &&
				callSiteByInvocationId.size === snapshot.invocations.length &&
				edges.filter((edge) => edge.relationKind === 'CALL_SITE_OWNERSHIP').length ===
					callSiteNodes.length &&
				targetEdges.length >= callSiteNodes.length &&
				callSiteNodes.every((node) => node.targetNodeIds.length >= 1),
			representedCallSites: callSiteNodes.length,
			targetEdges: targetEdges.length,
			unresolvedCallSites: callSiteNodes.filter((node) => node.resolutionClass === 'UNRESOLVED')
				.length,
			unsupportedCallSites: callSiteNodes.filter((node) => node.resolutionClass === 'UNSUPPORTED')
				.length,
			wholeProgramReachability: 'NOT_CLAIMED'
		};
		const categoryTotal =
			coverage.candidateSetCallSites +
			coverage.exactCallSites +
			coverage.externalDispatchCallSites +
			coverage.unresolvedCallSites +
			coverage.unsupportedCallSites;
		if (!coverage.reconciles || categoryTotal !== coverage.expectedCallSites)
			throw new Error('Call graph coverage does not reconcile.');

		const graphEpistemic = globalEpistemic(snapshot, classifications);
		const layerProvenanceIds = sortedUnique(
			nodes
				.flatMap((node) => node.provenanceIds)
				.concat(edges.flatMap((edge) => edge.provenanceIds))
		);
		const layer: CallGraphLayer = {
			capability: CALL_GRAPH_CAPABILITY,
			capabilityStatus: CALL_GRAPH_CAPABILITY_STATUS,
			coverage,
			edgeIds: edges.map((edge) => edge.id),
			entryMechanismCoverage: ENTRY_MECHANISM_COVERAGE,
			epistemic: graphEpistemic,
			graphId,
			id: layerId,
			kind: 'TYPESCRIPT_STATIC_CALL',
			limitations,
			method: CALL_GRAPH_METHOD,
			nodeIds: nodes.map((node) => node.id),
			ordinal: 0,
			producer: { ...snapshot.provider },
			provenanceIds: layerProvenanceIds,
			relationLaneCoverage: RELATION_LANE_COVERAGE,
			semanticSnapshotId: snapshot.id,
			subjectId: snapshot.subjectId
		};
		const content = {
			canonicalProfile: CALL_GRAPH_CANONICAL_PROFILE,
			capability: CALL_GRAPH_CAPABILITY,
			capabilityStatus: CALL_GRAPH_CAPABILITY_STATUS,
			coverage,
			edges,
			entryMechanismCoverage: ENTRY_MECHANISM_COVERAGE,
			epistemic: graphEpistemic,
			forwardIndex: makeIndexes(nodes, edges, 'FORWARD'),
			fullJanCsaa007Conformance: FULL_JAN_CSAA_007_CONFORMANCE,
			graphInputDigest,
			graphKind: 'TYPESCRIPT_CALL' as const,
			health: 'PARTIAL' as const,
			id: graphId,
			layers: [layer] as const,
			limitations,
			method: CALL_GRAPH_METHOD,
			nodes,
			operationVersion: CALL_GRAPH_OPERATION_VERSION,
			producer: { ...snapshot.provider },
			relationLaneCoverage: RELATION_LANE_COVERAGE,
			reverseIndex: makeIndexes(nodes, edges, 'REVERSE'),
			schemaVersion: CALL_GRAPH_SCHEMA_VERSION,
			semanticExtractionVersion: snapshot.extractionVersion,
			semanticSchemaVersion: snapshot.schemaVersion,
			semanticSnapshotId: snapshot.id,
			subjectId: snapshot.subjectId
		};
		const graph: CallGraphSnapshot = {
			...content,
			contentDigest: callGraphContentDigest(content)
		};
		const validation = validateConstructedCallGraph(graph, snapshot, graphInputDigest);
		if (validation.state !== 'VALID') {
			const firstIssue = validation.issues[0];
			return unavailable(
				'GRAPH_VALIDATION_FAILED',
				firstIssue === undefined
					? 'Call graph validation failed without a diagnostic.'
					: `Call graph validation failed: ${firstIssue.message}`,
				'VALIDATE',
				firstIssue?.path ?? null
			);
		}
		return {
			diagnostics: partialDiagnostics(limitations),
			graph,
			outcome: 'partial'
		};
	} catch (error) {
		return unavailable(
			'DANGLING_SEMANTIC_REFERENCE',
			error instanceof Error
				? `Call graph projection failed closed: ${error.message}`
				: 'Call graph projection failed closed.',
			'PROJECT'
		);
	}
}
