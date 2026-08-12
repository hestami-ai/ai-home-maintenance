import { isProxy } from 'node:util/types';
import ts from 'typescript';
import {
	FULL_JAN_CSAA_CAPABILITY_007_DATA_FLOW,
	READ_WRITE_ACCESS_GRAPH_CANONICAL_PROFILE,
	READ_WRITE_ACCESS_GRAPH_CAPABILITY,
	READ_WRITE_ACCESS_GRAPH_CAPABILITY_STATUS,
	READ_WRITE_ACCESS_GRAPH_METHOD,
	READ_WRITE_ACCESS_GRAPH_OPERATION_VERSION,
	READ_WRITE_ACCESS_GRAPH_SCHEMA_VERSION,
	type ReadWriteAccessGraphEdge,
	type ReadWriteAccessGraphIndexEntry,
	type ReadWriteAccessGraphLimitation,
	type ReadWriteAccessGraphNode,
	type ReadWriteAccessGraphSnapshot,
	type ReadWriteAccessOccurrenceNode
} from '../contracts/read-write-access-graph.js';
import type { StaticSemanticSnapshot } from '../contracts/semantic.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import {
	readWriteAccessEdgeId,
	readWriteAccessFrontierNodeId,
	readWriteAccessGraphContentDigest,
	readWriteAccessGraphId,
	readWriteAccessGraphInputDigest,
	readWriteAccessGraphLayerId,
	readWriteAccessOccurrenceNodeId,
	readWriteAccessSymbolNodeId
} from './read-write-access-graph-canonical.js';

export type ReadWriteAccessGraphValidationIssueCode =
	| 'BUDGET_EXCEEDED'
	| 'CONTENT_DIGEST_MISMATCH'
	| 'COVERAGE_MISMATCH'
	| 'DANGLING_ENDPOINT'
	| 'DANGLING_SEMANTIC_REFERENCE'
	| 'DUPLICATE_ID'
	| 'FIELD_SET_INVALID'
	| 'IDENTITY_MISMATCH'
	| 'INDEX_MISMATCH'
	| 'ORDER_INVALID'
	| 'SHAPE_INVALID'
	| 'SNAPSHOT_BINDING_MISMATCH';

export interface ReadWriteAccessGraphValidationIssue {
	readonly code: ReadWriteAccessGraphValidationIssueCode;
	readonly message: string;
	readonly path: string;
}

export interface ReadWriteAccessGraphValidationOptions {
	readonly maxIssues?: number;
	readonly maxRecords?: number;
	readonly maxStringCharacters?: number;
}

export type ReadWriteAccessGraphValidationResult =
	| { readonly issues: readonly []; readonly state: 'VALID' }
	| { readonly issues: readonly ReadWriteAccessGraphValidationIssue[]; readonly state: 'INVALID' };

const TOP_LEVEL_KEYS = [
	'canonicalProfile',
	'capability',
	'capabilityStatus',
	'contentDigest',
	'coverage',
	'edges',
	'forwardIndex',
	'fullJanCsaaCapability007DataFlow',
	'graphInputDigest',
	'graphKind',
	'health',
	'id',
	'layers',
	'limitations',
	'method',
	'nodes',
	'operationVersion',
	'producer',
	'reverseIndex',
	'schemaVersion',
	'semanticExtractionVersion',
	'semanticSchemaVersion',
	'semanticSnapshotId',
	'subjectId'
] as const;
const COVERAGE_KEYS = [
	'accessOccurrences',
	'closure',
	'discoveredAssignments',
	'discoveredCandidateReferences',
	'edges',
	'excludedTypePositionReferences',
	'frontierAssignments',
	'frontierNodes',
	'frontierReferences',
	'readAccesses',
	'readWriteAccesses',
	'reconciles',
	'representedAssignmentTargets',
	'representedReferences',
	'symbolSlots',
	'writeAccesses'
] as const;
const LAYER_KEYS = [
	'capability',
	'capabilityStatus',
	'coverage',
	'edgeIds',
	'graphId',
	'id',
	'kind',
	'limitations',
	'method',
	'nodeIds',
	'ordinal',
	'producer',
	'provenanceIds',
	'semanticSnapshotId',
	'subjectId'
] as const;
const COMMON_NODE_KEYS = [
	'epistemic',
	'graphId',
	'id',
	'kind',
	'layerId',
	'provenanceIds',
	'semanticSnapshotId',
	'sourceLocations',
	'subjectId'
] as const;
const SYMBOL_NODE_KEYS = [
	...COMMON_NODE_KEYS,
	'declarationIds',
	'name',
	'programId',
	'projectId',
	'symbolId'
] as const;
const ACCESS_NODE_KEYS = [
	...COMMON_NODE_KEYS,
	'accessKind',
	'assignmentNodeId',
	'declarationId',
	'occurrenceKind',
	'occurrenceNodeId',
	'referenceId',
	'slotNodeId',
	'sourceId',
	'symbolId'
] as const;
const FRONTIER_NODE_KEYS = [
	...COMMON_NODE_KEYS,
	'assignmentNodeId',
	'frontierKind',
	'occurrenceNodeId',
	'reason',
	'referenceId',
	'sourceId'
] as const;
const EDGE_KEYS = [
	'accessNodeId',
	'epistemic',
	'graphId',
	'id',
	'layerId',
	'method',
	'provenanceIds',
	'relationKind',
	'semanticSnapshotId',
	'source',
	'sourceLocations',
	'subjectId',
	'target'
] as const;
const ENDPOINT_KEYS = ['kind', 'nodeId'] as const;
const INDEX_ENTRY_KEYS = ['edgeIds', 'nodeId'] as const;
const LOCATION_KEYS = ['end', 'sourceId', 'start'] as const;
const EXPECTED_LIMITATIONS: readonly ReadWriteAccessGraphLimitation[] = [
	{
		kind: 'ALIAS_AND_MEMORY_MODEL_NOT_ANALYZED',
		reason:
			'Compiler-resolved symbol identity is retained, but no heap, points-to, reaching-definition, or alias-flow model is constructed.'
	},
	{
		kind: 'CONTROL_FLOW_NOT_ANALYZED',
		reason:
			'Access occurrences are not ordered through control-flow paths, exceptional flow, or asynchronous flow.'
	},
	{
		kind: 'CROSS_PROGRAM_SYMBOL_RECONCILIATION_NOT_ANALYZED',
		reason: 'Symbol slots remain scoped to the TypeScript Program that produced them.'
	},
	{
		kind: 'DATA_FLOW_CAPABILITY_NOT_CLAIMED',
		reason:
			'This bounded access projection is an input to later data-flow analysis, not JAN-CSAA-CAP-007 data flow.'
	},
	{
		kind: 'DYNAMIC_WRITE_TARGETS_FRONTIERED',
		reason:
			'Computed element writes without a compiler-resolved member symbol remain explicit frontiers.'
	},
	{
		kind: 'TYPE_POSITION_REFERENCES_EXCLUDED',
		reason: 'Type-position references are not represented as runtime value reads or writes.'
	},
	{
		kind: 'UNMODELED_WRITE_FORMS_NOT_ANALYZED',
		reason:
			'Implicit bindings, for-in/of targets, delete operations, and write forms absent from normalized assignment facts are not classified as supported writes.'
	}
];
const ACCESS_KINDS = new Set(['READ', 'READ_WRITE', 'WRITE']);
const OCCURRENCE_KINDS = new Set(['ASSIGNMENT_DECLARATION_TARGET', 'REFERENCE']);
const FRONTIER_KINDS = new Set([
	'DYNAMIC_ELEMENT_WRITE_TARGET',
	'MISSING_SEMANTIC_RECORD',
	'TYPE_POSITION_EXCLUDED',
	'UNRESOLVED_REFERENCE',
	'UNSUPPORTED_ASSIGNMENT_TARGET',
	'UNSUPPORTED_REFERENCE'
]);

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function plainObject(value: unknown): boolean {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		return false;
	const prototype = Reflect.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function exactKeys(value: object, expected: readonly string[]): boolean {
	const keys = Reflect.ownKeys(value);
	if (keys.some((key) => typeof key !== 'string') || keys.length !== expected.length) return false;
	const actual = (keys as string[]).sort(compareText);
	const wanted = [...expected].sort(compareText);
	return actual.every((key, index) => key === wanted[index]);
}

function sortedIds(records: readonly { readonly id: string }[]): boolean {
	return records.every((record, index) => index === 0 || records[index - 1]!.id < record.id);
}

function same(left: unknown, right: unknown): boolean {
	return canonicalSemanticJson(left) === canonicalSemanticJson(right);
}

function sortedUnique(values: Iterable<string>): string[] {
	return [...new Set(values)].sort(compareText);
}

function validLocations(
	value: unknown,
	sourceIds: ReadonlySet<string>,
	expectedSourceId?: string
): boolean {
	return (
		Array.isArray(value) &&
		value.every(
			(location) =>
				plainObject(location) &&
				exactKeys(location, LOCATION_KEYS) &&
				typeof location.sourceId === 'string' &&
				sourceIds.has(location.sourceId) &&
				(expectedSourceId === undefined || location.sourceId === expectedSourceId) &&
				Number.isSafeInteger(location.start) &&
				location.start >= 0 &&
				Number.isSafeInteger(location.end) &&
				location.end >= location.start
		)
	);
}

function nearestAssignmentNodeId(
	nodeId: string,
	nodeById: ReadonlyMap<string, StaticSemanticSnapshot['astNodes'][number]>,
	assignmentByTargetId: ReadonlyMap<string, StaticSemanticSnapshot['assignments'][number]>
): StaticSemanticSnapshot['assignments'][number]['nodeId'] | null {
	let current = nodeById.get(nodeId);
	const seen = new Set<string>();
	while (current !== undefined) {
		if (seen.has(current.id)) throw new Error('AST ancestry contains a cycle.');
		seen.add(current.id);
		const assignment = assignmentByTargetId.get(current.id);
		if (assignment !== undefined) return assignment.nodeId;
		current = current.parentId === null ? undefined : nodeById.get(current.parentId);
	}
	return null;
}

function isTypePosition(
	nodeId: string,
	nodeById: ReadonlyMap<string, StaticSemanticSnapshot['astNodes'][number]>
): boolean {
	let current = nodeById.get(nodeId);
	const seen = new Set<string>();
	while (current !== undefined) {
		if (seen.has(current.id)) throw new Error('AST ancestry contains a cycle.');
		seen.add(current.id);
		if (current.kind >= ts.SyntaxKind.FirstTypeNode && current.kind <= ts.SyntaxKind.LastTypeNode)
			return true;
		current = current.parentId === null ? undefined : nodeById.get(current.parentId);
	}
	return false;
}

function isUnmodeledWriteContext(
	nodeId: string,
	nodeById: ReadonlyMap<string, StaticSemanticSnapshot['astNodes'][number]>
): boolean {
	let current = nodeById.get(nodeId);
	const seen = new Set<string>();
	while (current !== undefined) {
		if (seen.has(current.id)) throw new Error('AST ancestry contains a cycle.');
		seen.add(current.id);
		if (
			current.kind === ts.SyntaxKind.DeleteExpression ||
			current.kind === ts.SyntaxKind.ForInStatement ||
			current.kind === ts.SyntaxKind.ForOfStatement
		)
			return true;
		current = current.parentId === null ? undefined : nodeById.get(current.parentId);
	}
	return false;
}

function expectedAssignmentAccessKind(
	assignment: StaticSemanticSnapshot['assignments'][number]
): 'READ_WRITE' | 'WRITE' {
	return assignment.assignmentKind === 'PREFIX_UPDATE' ||
		assignment.assignmentKind === 'POSTFIX_UPDATE' ||
		(assignment.assignmentKind === 'BINARY' &&
			assignment.operatorKind !== ts.SyntaxKind.EqualsToken)
		? 'READ_WRITE'
		: 'WRITE';
}

function assignmentTargetClass(
	target: StaticSemanticSnapshot['astNodes'][number],
	hasBoundDeclaration: boolean
): 'DYNAMIC_ELEMENT' | 'SUPPORTED' | 'UNSUPPORTED' {
	if (hasBoundDeclaration) return 'SUPPORTED';
	if (
		target.kind === ts.SyntaxKind.Identifier ||
		target.kind === ts.SyntaxKind.PrivateIdentifier ||
		target.kind === ts.SyntaxKind.PropertyAccessExpression
	)
		return 'SUPPORTED';
	if (target.kind === ts.SyntaxKind.ElementAccessExpression) return 'DYNAMIC_ELEMENT';
	return 'UNSUPPORTED';
}

function referenceWritesAssignmentTarget(
	reference: StaticSemanticSnapshot['references'][number],
	node: StaticSemanticSnapshot['astNodes'][number],
	target: StaticSemanticSnapshot['astNodes'][number]
): boolean {
	if (
		(target.kind === ts.SyntaxKind.Identifier || target.kind === ts.SyntaxKind.PrivateIdentifier) &&
		reference.nodeId === target.id
	)
		return true;
	return (
		(target.kind === ts.SyntaxKind.PropertyAccessExpression ||
			target.kind === ts.SyntaxKind.ElementAccessExpression) &&
		reference.role === 'MEMBER_NAME' &&
		node.parentId === target.id
	);
}

function expectedIndexes(
	nodes: readonly ReadWriteAccessGraphNode[],
	edges: readonly ReadWriteAccessGraphEdge[],
	direction: 'FORWARD' | 'REVERSE'
): ReadWriteAccessGraphIndexEntry[] {
	const grouped = new Map(nodes.map((node) => [node.id, [] as ReadWriteAccessGraphEdge['id'][]]));
	for (const edge of edges) {
		const id = direction === 'FORWARD' ? edge.source.nodeId : edge.target.nodeId;
		grouped.get(id)?.push(edge.id);
	}
	return [...grouped.entries()]
		.map(([nodeId, edgeIds]) => ({ nodeId, edgeIds: edgeIds.sort(compareText) }))
		.sort((left, right) => compareText(left.nodeId, right.nodeId));
}

function structuralBudgetIssue(
	value: unknown,
	maxRecords: number,
	maxStringCharacters: number
): string | null {
	const pending: unknown[] = [value];
	let records = 0;
	let stringCharacters = 0;
	while (pending.length > 0) {
		const current = pending.pop();
		records += 1;
		if (records > maxRecords)
			return `Graph structural record budget exceeded: ${records} > ${maxRecords}.`;
		if (typeof current === 'string') {
			stringCharacters += current.length;
			if (stringCharacters > maxStringCharacters)
				return `Graph string-character budget exceeded: ${stringCharacters} > ${maxStringCharacters}.`;
			continue;
		}
		if (current === null || typeof current !== 'object') continue;
		for (const key of Reflect.ownKeys(current)) {
			if (typeof key !== 'string') continue;
			stringCharacters += key.length;
			if (stringCharacters > maxStringCharacters)
				return `Graph string-character budget exceeded: ${stringCharacters} > ${maxStringCharacters}.`;
			pending.push(Reflect.get(current, key));
		}
	}
	return null;
}

function validate(
	value: unknown,
	snapshot: StaticSemanticSnapshot,
	expectedInputDigest: string,
	options: ReadWriteAccessGraphValidationOptions
): ReadWriteAccessGraphValidationResult {
	const maxIssues = options.maxIssues ?? 1_000;
	const maxRecords = options.maxRecords ?? 10_000_000;
	const maxStringCharacters = options.maxStringCharacters ?? 1_000_000_000;
	const issues: ReadWriteAccessGraphValidationIssue[] = [];
	const add = (
		code: ReadWriteAccessGraphValidationIssueCode,
		message: string,
		path: string
	): void => {
		if (issues.length < maxIssues) issues.push({ code, message, path });
	};
	try {
		if (
			!Number.isSafeInteger(maxIssues) ||
			maxIssues <= 0 ||
			!Number.isSafeInteger(maxRecords) ||
			maxRecords <= 0 ||
			!Number.isSafeInteger(maxStringCharacters) ||
			maxStringCharacters <= 0
		)
			throw new TypeError('Validation budgets must be positive safe integers.');
		if (!plainObject(value)) {
			add('SHAPE_INVALID', 'Graph must be a plain data object.', '$');
			return { issues, state: 'INVALID' };
		}
		const structuralIssue = structuralBudgetIssue(value, maxRecords, maxStringCharacters);
		if (structuralIssue !== null) {
			add('BUDGET_EXCEEDED', structuralIssue, '$');
			return { issues, state: 'INVALID' };
		}
		if (!exactKeys(value as object, TOP_LEVEL_KEYS))
			add('FIELD_SET_INVALID', 'Graph field set is invalid.', '$');
		const graph = value as unknown as ReadWriteAccessGraphSnapshot;
		if (
			!Array.isArray(graph.nodes) ||
			!Array.isArray(graph.edges) ||
			!Array.isArray(graph.layers)
		) {
			add('SHAPE_INVALID', 'Graph node, edge, and layer collections must be arrays.', '$');
			return { issues, state: 'INVALID' };
		}
		if (
			graph.canonicalProfile !== READ_WRITE_ACCESS_GRAPH_CANONICAL_PROFILE ||
			graph.capability !== READ_WRITE_ACCESS_GRAPH_CAPABILITY ||
			graph.capabilityStatus !== READ_WRITE_ACCESS_GRAPH_CAPABILITY_STATUS ||
			graph.fullJanCsaaCapability007DataFlow !== FULL_JAN_CSAA_CAPABILITY_007_DATA_FLOW ||
			graph.graphKind !== 'TYPESCRIPT_READ_WRITE_ACCESS' ||
			graph.health !== 'PARTIAL' ||
			graph.method !== READ_WRITE_ACCESS_GRAPH_METHOD ||
			graph.operationVersion !== READ_WRITE_ACCESS_GRAPH_OPERATION_VERSION ||
			graph.schemaVersion !== READ_WRITE_ACCESS_GRAPH_SCHEMA_VERSION
		)
			add('SHAPE_INVALID', 'Graph discriminator or version fields are incompatible.', '$');
		if (
			graph.semanticSnapshotId !== snapshot.id ||
			graph.subjectId !== snapshot.subjectId ||
			graph.semanticExtractionVersion !== snapshot.extractionVersion ||
			graph.semanticSchemaVersion !== snapshot.schemaVersion ||
			!same(graph.producer, snapshot.provider)
		)
			add(
				'SNAPSHOT_BINDING_MISMATCH',
				'Graph is not bound to the supplied semantic snapshot.',
				'$'
			);
		if (graph.graphInputDigest !== expectedInputDigest)
			add('IDENTITY_MISMATCH', 'graphInputDigest is invalid.', '$.graphInputDigest');
		const expectedGraphId = readWriteAccessGraphId({
			canonicalProfile: READ_WRITE_ACCESS_GRAPH_CANONICAL_PROFILE,
			graphInputDigest: expectedInputDigest,
			method: READ_WRITE_ACCESS_GRAPH_METHOD,
			operationVersion: READ_WRITE_ACCESS_GRAPH_OPERATION_VERSION,
			schemaVersion: READ_WRITE_ACCESS_GRAPH_SCHEMA_VERSION,
			semanticSnapshotId: snapshot.id,
			subjectId: snapshot.subjectId
		});
		if (graph.id !== expectedGraphId)
			add('IDENTITY_MISMATCH', 'Graph identity is invalid.', '$.id');
		if (graph.contentDigest !== readWriteAccessGraphContentDigest(graph))
			add('CONTENT_DIGEST_MISMATCH', 'Graph content digest is invalid.', '$.contentDigest');
		if (!plainObject(graph.coverage) || !exactKeys(graph.coverage, COVERAGE_KEYS))
			add('FIELD_SET_INVALID', 'Coverage field set is invalid.', '$.coverage');
		if (!sortedIds(graph.nodes) || !sortedIds(graph.edges))
			add('ORDER_INVALID', 'Nodes and edges must be strictly identity ordered.', '$');
		const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
		const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]));
		if (nodeById.size !== graph.nodes.length)
			add('DUPLICATE_ID', 'Node identities are not unique.', '$.nodes');
		if (edgeById.size !== graph.edges.length)
			add('DUPLICATE_ID', 'Edge identities are not unique.', '$.edges');
		const semanticNodeById = new Map(snapshot.astNodes.map((node) => [node.id, node]));
		const semanticNodeIds = new Set(semanticNodeById.keys());
		const sourceIds = new Set(snapshot.sources.map((source) => source.id));
		const sourceById = new Map(snapshot.sources.map((source) => [source.id, source]));
		const symbolById = new Map(snapshot.symbols.map((symbol) => [symbol.id, symbol]));
		const symbolIds = new Set(symbolById.keys());
		const referenceById = new Map(
			snapshot.references.map((reference) => [reference.id, reference])
		);
		const referenceIds = new Set(referenceById.keys());
		const declarationById = new Map(
			snapshot.declarations.map((declaration) => [declaration.id, declaration])
		);
		const declarationIds = new Set(declarationById.keys());
		const provenanceIds = new Set<string>(snapshot.provenances.map((provenance) => provenance.id));
		const provenanceBySource = new Map<string, string[]>();
		for (const provenance of snapshot.provenances) {
			if (provenance.sourceId === null) continue;
			const ids = provenanceBySource.get(provenance.sourceId);
			if (ids === undefined) provenanceBySource.set(provenance.sourceId, [provenance.id]);
			else ids.push(provenance.id);
		}
		const assignmentById = new Map(
			snapshot.assignments.map((assignment) => [assignment.nodeId, assignment])
		);
		const assignmentByTargetId = new Map(
			snapshot.assignments.map((assignment) => [assignment.targetNodeId, assignment])
		);
		const assignmentNodeIds = new Set(assignmentById.keys());
		const candidateById = new Map(
			snapshot.declarationCandidates.map((candidate) => [candidate.id, candidate])
		);
		const declarationAssignmentById = new Map<
			string,
			StaticSemanticSnapshot['assignments'][number]['nodeId']
		>();
		const declarationsByAssignment = new Map<string, Set<string>>();
		for (const declaration of snapshot.declarations) {
			if (declaration.nodeId === null) continue;
			const candidate =
				declaration.candidateId === null ? undefined : candidateById.get(declaration.candidateId);
			const occurrenceNodeId = candidate?.nameNodeId ?? declaration.nodeId;
			const assignmentId = nearestAssignmentNodeId(
				occurrenceNodeId,
				semanticNodeById,
				assignmentByTargetId
			);
			if (assignmentId === null) continue;
			declarationAssignmentById.set(declaration.id, assignmentId);
			const ids = declarationsByAssignment.get(assignmentId) ?? new Set<string>();
			ids.add(declaration.id);
			declarationsByAssignment.set(assignmentId, ids);
		}
		const candidateReferenceIds = new Set(
			snapshot.references
				.filter((reference) => reference.role === 'MEMBER_NAME' || reference.role === 'SYMBOL_USE')
				.map((reference) => reference.id)
		);
		if (!Array.isArray(graph.limitations) || !same(graph.limitations, EXPECTED_LIMITATIONS))
			add('SHAPE_INVALID', 'Graph limitations are absent or incompatible.', '$.limitations');
		const layerId = readWriteAccessGraphLayerId(expectedGraphId);
		for (const [index, node] of graph.nodes.entries()) {
			const path = `$.nodes[${index}]`;
			if (!plainObject(node)) {
				add('SHAPE_INVALID', 'Node must be a plain data object.', path);
				continue;
			}
			const expectedKeys =
				node.kind === 'SYMBOL_SLOT'
					? SYMBOL_NODE_KEYS
					: node.kind === 'ACCESS_OCCURRENCE'
						? ACCESS_NODE_KEYS
						: node.kind === 'FRONTIER'
							? FRONTIER_NODE_KEYS
							: [];
			if (expectedKeys.length === 0 || !exactKeys(node, expectedKeys))
				add('FIELD_SET_INVALID', 'Node field set or discriminator is invalid.', path);
			if (
				node.graphId !== graph.id ||
				node.layerId !== layerId ||
				node.subjectId !== graph.subjectId ||
				node.semanticSnapshotId !== graph.semanticSnapshotId
			)
				add('SNAPSHOT_BINDING_MISMATCH', 'Node graph binding is invalid.', path);
			if (
				!['SUPPORTED', 'UNKNOWN', 'UNSUPPORTED'].includes(node.epistemic) ||
				!validLocations(
					node.sourceLocations,
					sourceIds,
					node.kind === 'SYMBOL_SLOT' ? undefined : node.sourceId
				)
			)
				add('SHAPE_INVALID', 'Node epistemic state or source locations are invalid.', path);
			if (
				!Array.isArray(node.provenanceIds) ||
				node.provenanceIds.some((id: unknown) => typeof id !== 'string' || !provenanceIds.has(id))
			)
				add('DANGLING_SEMANTIC_REFERENCE', 'Node provenance is dangling.', `${path}.provenanceIds`);
			if (node.kind === 'SYMBOL_SLOT') {
				const symbol = symbolById.get(node.symbolId);
				const expectedLocations =
					symbol?.declarationIds
						.map((id) => declarationById.get(id))
						.filter(
							(declaration): declaration is StaticSemanticSnapshot['declarations'][number] =>
								declaration !== undefined
						)
						.map((declaration) => ({
							end: declaration.end,
							sourceId: declaration.sourceId,
							start: declaration.start
						}))
						.sort(
							(left, right) =>
								compareText(left.sourceId, right.sourceId) || left.start - right.start
						) ?? [];
				if (
					symbol === undefined ||
					node.id !== readWriteAccessSymbolNodeId(graph.id, node.symbolId) ||
					node.epistemic !== 'SUPPORTED' ||
					node.name !== symbol.name ||
					node.programId !== symbol.programId ||
					node.projectId !== symbol.projectId ||
					!same(node.declarationIds, [...symbol.declarationIds].sort(compareText)) ||
					!same(node.provenanceIds, [symbol.provenanceId]) ||
					!same(node.sourceLocations, expectedLocations)
				)
					add('IDENTITY_MISMATCH', 'Symbol-slot identity or semantic symbol is invalid.', path);
			} else {
				if (!semanticNodeIds.has(node.occurrenceNodeId) || !sourceIds.has(node.sourceId))
					add('DANGLING_SEMANTIC_REFERENCE', 'Occurrence node or source is dangling.', path);
				if (node.kind === 'ACCESS_OCCURRENCE') {
					const slot = nodeById.get(node.slotNodeId);
					if (
						!symbolIds.has(node.symbolId) ||
						slot?.kind !== 'SYMBOL_SLOT' ||
						slot.symbolId !== node.symbolId
					)
						add('DANGLING_SEMANTIC_REFERENCE', 'Access symbol slot is dangling.', path);
					if (
						node.epistemic !== 'SUPPORTED' ||
						!ACCESS_KINDS.has(node.accessKind) ||
						!OCCURRENCE_KINDS.has(node.occurrenceKind) ||
						(node.assignmentNodeId !== null && !assignmentNodeIds.has(node.assignmentNodeId)) ||
						(node.occurrenceKind === 'REFERENCE') !== (node.referenceId !== null) ||
						(node.occurrenceKind === 'ASSIGNMENT_DECLARATION_TARGET') !==
							(node.declarationId !== null)
					)
						add('SHAPE_INVALID', 'Access occurrence classification is invalid.', path);
					if (node.referenceId !== null && !referenceIds.has(node.referenceId))
						add('DANGLING_SEMANTIC_REFERENCE', 'Access reference is dangling.', path);
					if (node.declarationId !== null && !declarationIds.has(node.declarationId))
						add('DANGLING_SEMANTIC_REFERENCE', 'Access declaration is dangling.', path);
					const semanticReference =
						node.referenceId === null ? undefined : referenceById.get(node.referenceId);
					const semanticDeclaration =
						node.declarationId === null ? undefined : declarationById.get(node.declarationId);
					let expectedAccessKind: 'READ' | 'READ_WRITE' | 'WRITE' | null = null;
					let expectedAssignmentNodeId:
						StaticSemanticSnapshot['assignments'][number]['nodeId'] | null = null;
					let expectedOccurrenceNodeId: StaticSemanticSnapshot['astNodes'][number]['id'] | null =
						null;
					let expectedSourceId: StaticSemanticSnapshot['sources'][number]['id'] | null = null;
					let expectedSymbolId: StaticSemanticSnapshot['symbols'][number]['id'] | null = null;
					let expectedProvenanceIds: readonly string[] | null = null;
					if (semanticReference !== undefined) {
						expectedOccurrenceNodeId = semanticReference.nodeId;
						expectedSourceId = semanticReference.sourceId;
						expectedSymbolId = semanticReference.resolvedSymbolId ?? semanticReference.symbolId;
						expectedAssignmentNodeId = nearestAssignmentNodeId(
							semanticReference.nodeId,
							semanticNodeById,
							assignmentByTargetId
						);
						const semanticSource = sourceById.get(semanticReference.sourceId);
						const semanticSymbol =
							expectedSymbolId === null ? undefined : symbolById.get(expectedSymbolId);
						const referenceIsSupported =
							candidateReferenceIds.has(semanticReference.id) &&
							semanticReference.scopeLinkState === 'RESOLVED' &&
							(semanticReference.resolutionState === 'RESOLVED_DIRECT' ||
								semanticReference.resolutionState === 'RESOLVED_ALIAS') &&
							semanticSource !== undefined &&
							semanticSymbol !== undefined &&
							!isTypePosition(semanticReference.nodeId, semanticNodeById) &&
							!isUnmodeledWriteContext(semanticReference.nodeId, semanticNodeById);
						if (referenceIsSupported) {
							expectedProvenanceIds = sortedUnique([
								semanticReference.resolutionProvenanceId,
								semanticReference.structuralProvenanceId,
								semanticSymbol.provenanceId,
								semanticSource.provenanceId,
								...(semanticSource.syntaxProvenanceId === null
									? []
									: [semanticSource.syntaxProvenanceId])
							]);
							expectedAccessKind = 'READ';
						}
						if (referenceIsSupported && expectedAssignmentNodeId !== null) {
							const assignment = assignmentById.get(expectedAssignmentNodeId);
							const occurrenceNode = semanticNodeById.get(semanticReference.nodeId);
							const target =
								assignment === undefined
									? undefined
									: semanticNodeById.get(assignment.targetNodeId);
							if (assignment !== undefined && target !== undefined) {
								const targetClass = assignmentTargetClass(
									target,
									(declarationsByAssignment.get(assignment.nodeId)?.size ?? 0) > 0
								);
								if (targetClass === 'UNSUPPORTED') expectedAccessKind = null;
								else if (
									assignment !== undefined &&
									occurrenceNode !== undefined &&
									target !== undefined &&
									referenceWritesAssignmentTarget(semanticReference, occurrenceNode, target)
								) {
									expectedAccessKind = expectedAssignmentAccessKind(assignment);
								}
							}
						}
					} else if (semanticDeclaration !== undefined) {
						const candidate =
							semanticDeclaration.candidateId === null
								? undefined
								: candidateById.get(semanticDeclaration.candidateId);
						expectedOccurrenceNodeId = candidate?.nameNodeId ?? semanticDeclaration.nodeId;
						expectedSourceId = semanticDeclaration.sourceId;
						expectedSymbolId = semanticDeclaration.symbolId;
						expectedAssignmentNodeId =
							declarationAssignmentById.get(semanticDeclaration.id) ?? null;
						const assignment =
							expectedAssignmentNodeId === null
								? undefined
								: assignmentById.get(expectedAssignmentNodeId);
						const semanticSource = sourceById.get(semanticDeclaration.sourceId);
						const semanticSymbol =
							expectedSymbolId === null ? undefined : symbolById.get(expectedSymbolId);
						if (
							assignment !== undefined &&
							semanticDeclaration.symbolBindingState === 'RESOLVED' &&
							semanticSource !== undefined &&
							semanticSymbol !== undefined
						) {
							expectedAccessKind = expectedAssignmentAccessKind(assignment);
							expectedProvenanceIds = sortedUnique([
								semanticDeclaration.bindingProvenanceId,
								semanticDeclaration.structuralProvenanceId,
								semanticSymbol.provenanceId,
								semanticSource.provenanceId,
								...(semanticSource.syntaxProvenanceId === null
									? []
									: [semanticSource.syntaxProvenanceId])
							]);
						}
					}
					if (
						expectedAccessKind === null ||
						node.accessKind !== expectedAccessKind ||
						node.assignmentNodeId !== expectedAssignmentNodeId ||
						node.occurrenceNodeId !== expectedOccurrenceNodeId ||
						node.sourceId !== expectedSourceId ||
						node.symbolId !== expectedSymbolId ||
						sourceById.get(node.sourceId) === undefined ||
						!same(node.provenanceIds, expectedProvenanceIds) ||
						!same(node.sourceLocations, [
							{
								end: semanticNodeById.get(node.occurrenceNodeId)?.end,
								sourceId: node.sourceId,
								start: semanticNodeById.get(node.occurrenceNodeId)?.start
							}
						])
					)
						add(
							'DANGLING_SEMANTIC_REFERENCE',
							'Access occurrence does not match its semantic fact.',
							path
						);
					if (
						node.id !==
						readWriteAccessOccurrenceNodeId(graph.id, {
							declarationId: node.declarationId,
							referenceId: node.referenceId
						})
					)
						add('IDENTITY_MISMATCH', 'Access occurrence identity is invalid.', path);
				} else {
					if (
						node.id !==
						readWriteAccessFrontierNodeId(graph.id, {
							assignmentNodeId: node.assignmentNodeId,
							frontierKind: node.frontierKind,
							occurrenceNodeId: node.occurrenceNodeId,
							referenceId: node.referenceId
						})
					)
						add('IDENTITY_MISMATCH', 'Frontier identity is invalid.', path);
					if (
						!FRONTIER_KINDS.has(node.frontierKind) ||
						(node.assignmentNodeId !== null && !assignmentNodeIds.has(node.assignmentNodeId)) ||
						(node.referenceId !== null && !candidateReferenceIds.has(node.referenceId)) ||
						typeof node.reason !== 'string' ||
						node.reason.length === 0 ||
						(node.frontierKind === 'TYPE_POSITION_EXCLUDED'
							? node.epistemic !== 'UNSUPPORTED'
							: node.epistemic !== 'UNKNOWN')
					)
						add('SHAPE_INVALID', 'Frontier classification is invalid.', path);

					let expectedAssignmentNodeId:
						StaticSemanticSnapshot['assignments'][number]['nodeId'] | null = null;
					let expectedOccurrenceNodeId: StaticSemanticSnapshot['astNodes'][number]['id'] | null =
						null;
					let expectedSourceId: StaticSemanticSnapshot['sources'][number]['id'] | null = null;
					let expectedKind: string | null = null;
					let expectedReason: string | null = null;
					let expectedEpistemic: 'UNKNOWN' | 'UNSUPPORTED' | null = null;
					let expectedProvenanceIds: readonly string[] | null = null;
					const semanticReference =
						node.referenceId === null ? undefined : referenceById.get(node.referenceId);
					if (semanticReference !== undefined) {
						expectedAssignmentNodeId = nearestAssignmentNodeId(
							semanticReference.nodeId,
							semanticNodeById,
							assignmentByTargetId
						);
						expectedOccurrenceNodeId = semanticReference.nodeId;
						expectedSourceId = semanticReference.sourceId;
						expectedProvenanceIds = sortedUnique([
							semanticReference.resolutionProvenanceId,
							semanticReference.structuralProvenanceId
						]);
						if (isTypePosition(semanticReference.nodeId, semanticNodeById)) {
							expectedKind = 'TYPE_POSITION_EXCLUDED';
							expectedReason =
								'Type-position reference is excluded from runtime access classification.';
							expectedEpistemic = 'UNSUPPORTED';
						} else if (isUnmodeledWriteContext(semanticReference.nodeId, semanticNodeById)) {
							expectedKind = 'UNSUPPORTED_REFERENCE';
							expectedReason =
								'Reference occurs in a write-capable syntax form outside the normalized assignment taxonomy.';
							expectedEpistemic = 'UNKNOWN';
						} else if (expectedAssignmentNodeId !== null) {
							const assignment = assignmentById.get(expectedAssignmentNodeId);
							const target =
								assignment === undefined
									? undefined
									: semanticNodeById.get(assignment.targetNodeId);
							if (
								assignment !== undefined &&
								target !== undefined &&
								assignmentTargetClass(
									target,
									(declarationsByAssignment.get(assignment.nodeId)?.size ?? 0) > 0
								) === 'UNSUPPORTED'
							) {
								expectedKind = 'UNSUPPORTED_ASSIGNMENT_TARGET';
								expectedReason =
									'Reference occurs inside an assignment target shape outside this bounded method.';
								expectedEpistemic = 'UNKNOWN';
							}
						}
						if (expectedKind === null) {
							const symbolId = semanticReference.resolvedSymbolId ?? semanticReference.symbolId;
							const resolved =
								symbolId !== null &&
								symbolById.has(symbolId) &&
								semanticReference.scopeLinkState === 'RESOLVED' &&
								(semanticReference.resolutionState === 'RESOLVED_DIRECT' ||
									semanticReference.resolutionState === 'RESOLVED_ALIAS');
							if (!resolved) {
								expectedKind =
									semanticReference.resolutionState === 'UNSUPPORTED'
										? 'UNSUPPORTED_REFERENCE'
										: 'UNRESOLVED_REFERENCE';
								expectedReason =
									semanticReference.scopeLinkState === 'RESOLVED'
										? 'Reference does not resolve to a retained Program-local symbol slot.'
										: 'Reference scope linkage is unsupported and cannot establish a supported access.';
								expectedEpistemic = 'UNKNOWN';
							}
						}
					} else if (node.assignmentNodeId !== null) {
						const assignment = assignmentById.get(node.assignmentNodeId);
						const target =
							assignment === undefined ? undefined : semanticNodeById.get(assignment.targetNodeId);
						const source = target === undefined ? undefined : sourceById.get(target.sourceId);
						if (assignment !== undefined && target !== undefined && source !== undefined) {
							expectedAssignmentNodeId = assignment.nodeId;
							expectedOccurrenceNodeId = target.id;
							expectedSourceId = source.id;
							const targetClass = assignmentTargetClass(
								target,
								(declarationsByAssignment.get(assignment.nodeId)?.size ?? 0) > 0
							);
							expectedKind =
								targetClass === 'DYNAMIC_ELEMENT'
									? 'DYNAMIC_ELEMENT_WRITE_TARGET'
									: 'UNSUPPORTED_ASSIGNMENT_TARGET';
							expectedReason =
								targetClass === 'DYNAMIC_ELEMENT'
									? 'Computed element assignment has no compiler-resolved member slot.'
									: 'Assignment target has no supported resolved write slot.';
							expectedEpistemic = 'UNKNOWN';
							expectedProvenanceIds = sortedUnique(provenanceBySource.get(source.id) ?? []);
						}
					}
					const expectedNode =
						expectedOccurrenceNodeId === null
							? undefined
							: semanticNodeById.get(expectedOccurrenceNodeId);
					if (
						expectedKind === null ||
						node.assignmentNodeId !== expectedAssignmentNodeId ||
						node.occurrenceNodeId !== expectedOccurrenceNodeId ||
						node.sourceId !== expectedSourceId ||
						node.frontierKind !== expectedKind ||
						node.reason !== expectedReason ||
						node.epistemic !== expectedEpistemic ||
						!same(node.provenanceIds, expectedProvenanceIds) ||
						expectedNode === undefined ||
						!same(node.sourceLocations, [
							{
								end: expectedNode?.end,
								sourceId: expectedSourceId,
								start: expectedNode?.start
							}
						])
					)
						add('DANGLING_SEMANTIC_REFERENCE', 'Frontier does not match its semantic fact.', path);
				}
			}
		}
		for (const [index, edge] of graph.edges.entries()) {
			const path = `$.edges[${index}]`;
			if (!plainObject(edge) || !exactKeys(edge, EDGE_KEYS)) {
				add('FIELD_SET_INVALID', 'Edge field set is invalid.', path);
				continue;
			}
			if (
				!plainObject(edge.source) ||
				!exactKeys(edge.source, ENDPOINT_KEYS) ||
				!plainObject(edge.target) ||
				!exactKeys(edge.target, ENDPOINT_KEYS)
			)
				add('FIELD_SET_INVALID', 'Edge endpoint field set is invalid.', path);
			const source = nodeById.get(edge.source.nodeId);
			const target = nodeById.get(edge.target.nodeId);
			if (source?.kind !== 'ACCESS_OCCURRENCE' || target?.kind !== 'SYMBOL_SLOT')
				add('DANGLING_ENDPOINT', 'Edge endpoints are absent or have incompatible kinds.', path);
			else if (source.slotNodeId !== target.id || edge.accessNodeId !== source.id)
				add('DANGLING_ENDPOINT', 'Edge does not connect its access to its symbol slot.', path);
			if (
				edge.graphId !== graph.id ||
				edge.layerId !== layerId ||
				edge.subjectId !== graph.subjectId ||
				edge.semanticSnapshotId !== graph.semanticSnapshotId ||
				edge.method !== READ_WRITE_ACCESS_GRAPH_METHOD ||
				edge.epistemic !== 'SUPPORTED' ||
				!['READS', 'WRITES'].includes(edge.relationKind) ||
				edge.source.kind !== 'ACCESS_OCCURRENCE' ||
				edge.target.kind !== 'SYMBOL_SLOT' ||
				!validLocations(edge.sourceLocations, sourceIds) ||
				!Array.isArray(edge.provenanceIds) ||
				edge.provenanceIds.some(
					(id: unknown) => typeof id !== 'string' || !provenanceIds.has(id)
				) ||
				(source?.kind === 'ACCESS_OCCURRENCE' &&
					(!same(edge.provenanceIds, source.provenanceIds) ||
						!same(edge.sourceLocations, source.sourceLocations)))
			)
				add('SNAPSHOT_BINDING_MISMATCH', 'Edge binding or evidence is invalid.', path);
			if (
				edge.id !==
				readWriteAccessEdgeId({
					graphId: graph.id,
					relationKind: edge.relationKind,
					source: edge.source,
					target: edge.target
				})
			)
				add('IDENTITY_MISMATCH', 'Edge identity is invalid.', path);
		}
		for (const access of graph.nodes.filter(
			(node): node is ReadWriteAccessOccurrenceNode => node.kind === 'ACCESS_OCCURRENCE'
		)) {
			const actual = graph.edges
				.filter((edge) => edge.accessNodeId === access.id)
				.map((edge) => edge.relationKind)
				.sort(compareText);
			const expected =
				access.accessKind === 'READ_WRITE'
					? ['READS', 'WRITES']
					: [access.accessKind === 'READ' ? 'READS' : 'WRITES'];
			if (!same(actual, expected))
				add(
					'COVERAGE_MISMATCH',
					'Access edge relations do not match accessKind.',
					`$.nodes[id=${access.id}]`
				);
		}
		if (!same(graph.forwardIndex, expectedIndexes(graph.nodes, graph.edges, 'FORWARD')))
			add('INDEX_MISMATCH', 'Forward index is invalid.', '$.forwardIndex');
		if (!same(graph.reverseIndex, expectedIndexes(graph.nodes, graph.edges, 'REVERSE')))
			add('INDEX_MISMATCH', 'Reverse index is invalid.', '$.reverseIndex');
		for (const [path, index] of [
			['$.forwardIndex', graph.forwardIndex],
			['$.reverseIndex', graph.reverseIndex]
		] as const)
			if (
				!Array.isArray(index) ||
				index.some(
					(entry) =>
						!plainObject(entry) ||
						!exactKeys(entry, INDEX_ENTRY_KEYS) ||
						!Array.isArray(entry.edgeIds)
				)
			)
				add('FIELD_SET_INVALID', 'Graph index entry field set is invalid.', path);
		const accesses = graph.nodes.filter((node) => node.kind === 'ACCESS_OCCURRENCE');
		const frontiers = graph.nodes.filter((node) => node.kind === 'FRONTIER');
		const slots = graph.nodes.filter((node) => node.kind === 'SYMBOL_SLOT');
		const accessReferenceIds = accesses.flatMap((node) =>
			node.referenceId === null ? [] : [node.referenceId]
		);
		const frontierReferenceIds = frontiers.flatMap((node) =>
			node.referenceId === null ? [] : [node.referenceId]
		);
		const projectedReferenceIds = [...accessReferenceIds, ...frontierReferenceIds];
		if (
			new Set(projectedReferenceIds).size !== projectedReferenceIds.length ||
			!same(
				[...projectedReferenceIds].sort(compareText),
				[...candidateReferenceIds].sort(compareText)
			)
		)
			add(
				'COVERAGE_MISMATCH',
				'Candidate semantic references are not projected exactly once.',
				'$.nodes'
			);
		const expectedDeclarationAccessIds = snapshot.declarations
			.filter(
				(declaration) =>
					declaration.symbolBindingState === 'RESOLVED' &&
					declaration.symbolId !== null &&
					symbolById.has(declaration.symbolId) &&
					declarationAssignmentById.has(declaration.id)
			)
			.map((declaration) => declaration.id)
			.sort(compareText);
		const actualDeclarationAccessIds = accesses
			.flatMap((node) => (node.declarationId === null ? [] : [node.declarationId]))
			.sort(compareText);
		if (
			new Set(actualDeclarationAccessIds).size !== actualDeclarationAccessIds.length ||
			!same(actualDeclarationAccessIds, expectedDeclarationAccessIds)
		)
			add(
				'COVERAGE_MISMATCH',
				'Assignment-bound semantic declarations are not projected exactly once.',
				'$.nodes'
			);
		const representedAssignmentIds = new Set(
			accesses.flatMap((node) =>
				node.assignmentNodeId === null || node.accessKind === 'READ' ? [] : [node.assignmentNodeId]
			)
		);
		const assignmentFrontierIds = frontiers.flatMap((node) =>
			node.referenceId === null && node.assignmentNodeId !== null ? [node.assignmentNodeId] : []
		);
		const projectedAssignmentIds = [...representedAssignmentIds, ...assignmentFrontierIds];
		if (
			new Set(assignmentFrontierIds).size !== assignmentFrontierIds.length ||
			new Set(projectedAssignmentIds).size !== projectedAssignmentIds.length ||
			!same([...projectedAssignmentIds].sort(compareText), [...assignmentNodeIds].sort(compareText))
		)
			add(
				'COVERAGE_MISMATCH',
				'Semantic assignments are not represented or frontiered exactly once.',
				'$.nodes'
			);
		const slotSymbolIds = slots.map((slot) => slot.symbolId);
		const accessedSymbolIds = [...new Set(accesses.map((access) => access.symbolId))].sort(
			compareText
		);
		if (
			new Set(slotSymbolIds).size !== slotSymbolIds.length ||
			!same([...slotSymbolIds].sort(compareText), accessedSymbolIds)
		)
			add(
				'COVERAGE_MISMATCH',
				'Accessed semantic symbols do not reconcile with symbol slots.',
				'$.nodes'
			);
		const excludedTypePositionReferences = frontiers.filter(
			(node) => node.frontierKind === 'TYPE_POSITION_EXCLUDED'
		).length;
		const expectedCoverage = {
			accessOccurrences: accesses.length,
			closure: 'OPEN',
			discoveredAssignments: snapshot.assignments.length,
			discoveredCandidateReferences: candidateReferenceIds.size,
			edges: graph.edges.length,
			excludedTypePositionReferences,
			frontierAssignments: assignmentFrontierIds.length,
			frontierNodes: frontiers.length,
			frontierReferences: frontierReferenceIds.length - excludedTypePositionReferences,
			readAccesses: accesses.filter((node) => node.accessKind === 'READ').length,
			readWriteAccesses: accesses.filter((node) => node.accessKind === 'READ_WRITE').length,
			reconciles: true,
			representedAssignmentTargets: representedAssignmentIds.size,
			representedReferences: accessReferenceIds.length,
			symbolSlots: slots.length,
			writeAccesses: accesses.filter((node) => node.accessKind === 'WRITE').length
		} as const;
		if (!same(graph.coverage, expectedCoverage))
			add('COVERAGE_MISMATCH', 'Coverage counters do not reconcile.', '$.coverage');
		if (
			graph.layers.length !== 1 ||
			!plainObject(graph.layers[0]) ||
			!exactKeys(graph.layers[0], LAYER_KEYS)
		)
			add('FIELD_SET_INVALID', 'Exactly one valid graph layer is required.', '$.layers');
		else {
			const layer = graph.layers[0];
			const expectedLayerProvenanceIds = sortedUnique(
				graph.nodes
					.flatMap((node) => node.provenanceIds)
					.concat(graph.edges.flatMap((edge) => edge.provenanceIds))
			);
			if (
				layer.id !== layerId ||
				layer.graphId !== graph.id ||
				layer.capability !== READ_WRITE_ACCESS_GRAPH_CAPABILITY ||
				layer.capabilityStatus !== READ_WRITE_ACCESS_GRAPH_CAPABILITY_STATUS ||
				layer.kind !== 'TYPESCRIPT_READ_WRITE_ACCESS' ||
				layer.method !== READ_WRITE_ACCESS_GRAPH_METHOD ||
				layer.ordinal !== 0 ||
				layer.subjectId !== graph.subjectId ||
				layer.semanticSnapshotId !== graph.semanticSnapshotId ||
				!same(layer.producer, graph.producer) ||
				!same(layer.provenanceIds, expectedLayerProvenanceIds) ||
				!same(layer.coverage, graph.coverage) ||
				!same(
					layer.nodeIds,
					graph.nodes.map((node) => node.id)
				) ||
				!same(
					layer.edgeIds,
					graph.edges.map((edge) => edge.id)
				) ||
				!same(layer.limitations, graph.limitations)
			)
				add('IDENTITY_MISMATCH', 'Graph layer does not reconcile with its graph.', '$.layers[0]');
		}
		return issues.length === 0 ? { issues: [], state: 'VALID' } : { issues, state: 'INVALID' };
	} catch (error) {
		add(
			'SHAPE_INVALID',
			error instanceof Error
				? `Validation failed closed: ${error.message}`
				: 'Validation failed closed.',
			'$'
		);
		return { issues, state: 'INVALID' };
	}
}

export function validateConstructedReadWriteAccessGraph(
	graph: unknown,
	snapshot: StaticSemanticSnapshot,
	expectedInputDigest: string,
	options: ReadWriteAccessGraphValidationOptions = {}
): ReadWriteAccessGraphValidationResult {
	return validate(graph, snapshot, expectedInputDigest, options);
}

export function validateReadWriteAccessGraph(
	graph: unknown,
	snapshot: StaticSemanticSnapshot,
	options: ReadWriteAccessGraphValidationOptions = {}
): ReadWriteAccessGraphValidationResult {
	return validate(graph, snapshot, readWriteAccessGraphInputDigest(snapshot), options);
}
