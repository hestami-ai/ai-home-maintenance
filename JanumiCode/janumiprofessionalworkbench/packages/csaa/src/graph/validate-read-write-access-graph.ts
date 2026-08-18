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
	type ReadWriteAccessFrontierNode,
	type ReadWriteAccessGraphEdge,
	type ReadWriteAccessGraphIndexEntry,
	type ReadWriteAccessGraphLayerId,
	type ReadWriteAccessGraphLimitation,
	type ReadWriteAccessGraphNode,
	type ReadWriteAccessGraphSnapshot,
	type ReadWriteAccessOccurrenceNode,
	type ReadWriteSymbolSlotNode
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
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
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
		.map(([nodeId, edgeIds]) => {
			edgeIds.sort(compareText);
			return { nodeId, edgeIds };
		})
		.sort((left, right) => compareText(left.nodeId, right.nodeId));
}

interface StructuralBudgetWalk {
	readonly maxRecords: number;
	readonly maxStringCharacters: number;
	readonly pending: unknown[];
	records: number;
	stringCharacters: number;
}

function stringBudgetIssue(walk: StructuralBudgetWalk): string | null {
	if (walk.stringCharacters > walk.maxStringCharacters)
		return `Graph string-character budget exceeded: ${walk.stringCharacters} > ${walk.maxStringCharacters}.`;
	return null;
}

function expandStructuralBudgetKeys(walk: StructuralBudgetWalk, current: object): string | null {
	for (const key of Reflect.ownKeys(current)) {
		if (typeof key !== 'string') continue;
		walk.stringCharacters += key.length;
		const issue = stringBudgetIssue(walk);
		if (issue !== null) return issue;
		walk.pending.push(Reflect.get(current, key));
	}
	return null;
}

function visitStructuralBudgetEntry(walk: StructuralBudgetWalk): string | null {
	const current = walk.pending.pop();
	walk.records += 1;
	if (walk.records > walk.maxRecords)
		return `Graph structural record budget exceeded: ${walk.records} > ${walk.maxRecords}.`;
	if (typeof current === 'string') {
		walk.stringCharacters += current.length;
		return stringBudgetIssue(walk);
	}
	if (current === null || typeof current !== 'object') return null;
	return expandStructuralBudgetKeys(walk, current);
}

function structuralBudgetIssue(
	value: unknown,
	maxRecords: number,
	maxStringCharacters: number
): string | null {
	const walk: StructuralBudgetWalk = {
		maxRecords,
		maxStringCharacters,
		pending: [value],
		records: 0,
		stringCharacters: 0
	};
	while (walk.pending.length > 0) {
		const issue = visitStructuralBudgetEntry(walk);
		if (issue !== null) return issue;
	}
	return null;
}

type AddValidationIssue = (
	code: ReadWriteAccessGraphValidationIssueCode,
	message: string,
	path: string
) => void;

interface ValidationBudgets {
	readonly maxIssues: number;
	readonly maxRecords: number;
	readonly maxStringCharacters: number;
}

interface ValidationRequest {
	readonly add: AddValidationIssue;
	readonly budgets: ValidationBudgets;
	readonly expectedInputDigest: string;
	readonly snapshot: StaticSemanticSnapshot;
	readonly value: unknown;
}

interface SemanticIndex {
	readonly assignmentById: ReadonlyMap<string, StaticSemanticSnapshot['assignments'][number]>;
	readonly assignmentByTargetId: ReadonlyMap<string, StaticSemanticSnapshot['assignments'][number]>;
	readonly assignmentNodeIds: ReadonlySet<string>;
	readonly candidateById: ReadonlyMap<
		string,
		StaticSemanticSnapshot['declarationCandidates'][number]
	>;
	readonly candidateReferenceIds: ReadonlySet<string>;
	readonly declarationAssignmentById: ReadonlyMap<
		string,
		StaticSemanticSnapshot['assignments'][number]['nodeId']
	>;
	readonly declarationById: ReadonlyMap<string, StaticSemanticSnapshot['declarations'][number]>;
	readonly declarationIds: ReadonlySet<string>;
	readonly declarationsByAssignment: ReadonlyMap<string, ReadonlySet<string>>;
	readonly provenanceBySource: ReadonlyMap<string, readonly string[]>;
	readonly provenanceIds: ReadonlySet<string>;
	readonly referenceById: ReadonlyMap<string, StaticSemanticSnapshot['references'][number]>;
	readonly referenceIds: ReadonlySet<string>;
	readonly semanticNodeById: ReadonlyMap<string, StaticSemanticSnapshot['astNodes'][number]>;
	readonly semanticNodeIds: ReadonlySet<string>;
	readonly sourceById: ReadonlyMap<string, StaticSemanticSnapshot['sources'][number]>;
	readonly sourceIds: ReadonlySet<string>;
	readonly symbolById: ReadonlyMap<string, StaticSemanticSnapshot['symbols'][number]>;
	readonly symbolIds: ReadonlySet<string>;
}

interface ValidationState {
	readonly add: AddValidationIssue;
	readonly graph: ReadWriteAccessGraphSnapshot;
	readonly index: SemanticIndex;
	readonly layerId: ReadWriteAccessGraphLayerId;
	readonly nodeById: ReadonlyMap<string, ReadWriteAccessGraphNode>;
	readonly snapshot: StaticSemanticSnapshot;
}

interface DeclarationAssignmentLinks {
	readonly declarationAssignmentById: ReadonlyMap<
		string,
		StaticSemanticSnapshot['assignments'][number]['nodeId']
	>;
	readonly declarationsByAssignment: ReadonlyMap<string, ReadonlySet<string>>;
}

function assertBudgets(budgets: ValidationBudgets): void {
	if (
		!Number.isSafeInteger(budgets.maxIssues) ||
		budgets.maxIssues <= 0 ||
		!Number.isSafeInteger(budgets.maxRecords) ||
		budgets.maxRecords <= 0 ||
		!Number.isSafeInteger(budgets.maxStringCharacters) ||
		budgets.maxStringCharacters <= 0
	)
		throw new TypeError('Validation budgets must be positive safe integers.');
}

function validationFailureMessage(error: unknown): string {
	return error instanceof Error
		? `Validation failed closed: ${error.message}`
		: 'Validation failed closed.';
}

function buildProvenanceBySource(snapshot: StaticSemanticSnapshot): Map<string, string[]> {
	const provenanceBySource = new Map<string, string[]>();
	for (const provenance of snapshot.provenances) {
		if (provenance.sourceId === null) continue;
		const ids = provenanceBySource.get(provenance.sourceId);
		if (ids === undefined) provenanceBySource.set(provenance.sourceId, [provenance.id]);
		else ids.push(provenance.id);
	}
	return provenanceBySource;
}

function buildDeclarationAssignmentLinks(
	snapshot: StaticSemanticSnapshot,
	semanticNodeById: ReadonlyMap<string, StaticSemanticSnapshot['astNodes'][number]>,
	candidateById: ReadonlyMap<string, StaticSemanticSnapshot['declarationCandidates'][number]>,
	assignmentByTargetId: ReadonlyMap<string, StaticSemanticSnapshot['assignments'][number]>
): DeclarationAssignmentLinks {
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
	return { declarationAssignmentById, declarationsByAssignment };
}

function buildSemanticIndex(snapshot: StaticSemanticSnapshot): SemanticIndex {
	const semanticNodeById = new Map(snapshot.astNodes.map((node) => [node.id, node]));
	const sourceById = new Map(snapshot.sources.map((source) => [source.id, source]));
	const symbolById = new Map(snapshot.symbols.map((symbol) => [symbol.id, symbol]));
	const referenceById = new Map(snapshot.references.map((reference) => [reference.id, reference]));
	const declarationById = new Map(
		snapshot.declarations.map((declaration) => [declaration.id, declaration])
	);
	const provenanceBySource = buildProvenanceBySource(snapshot);
	const assignmentById = new Map(
		snapshot.assignments.map((assignment) => [assignment.nodeId, assignment])
	);
	const assignmentByTargetId = new Map(
		snapshot.assignments.map((assignment) => [assignment.targetNodeId, assignment])
	);
	const candidateById = new Map(
		snapshot.declarationCandidates.map((candidate) => [candidate.id, candidate])
	);
	const links = buildDeclarationAssignmentLinks(
		snapshot,
		semanticNodeById,
		candidateById,
		assignmentByTargetId
	);
	return {
		assignmentById,
		assignmentByTargetId,
		assignmentNodeIds: new Set(assignmentById.keys()),
		candidateById,
		candidateReferenceIds: new Set(
			snapshot.references
				.filter((reference) => reference.role === 'MEMBER_NAME' || reference.role === 'SYMBOL_USE')
				.map((reference) => reference.id)
		),
		declarationAssignmentById: links.declarationAssignmentById,
		declarationById,
		declarationIds: new Set(declarationById.keys()),
		declarationsByAssignment: links.declarationsByAssignment,
		provenanceBySource,
		provenanceIds: new Set<string>(snapshot.provenances.map((provenance) => provenance.id)),
		referenceById,
		referenceIds: new Set(referenceById.keys()),
		semanticNodeById,
		semanticNodeIds: new Set(semanticNodeById.keys()),
		sourceById,
		sourceIds: new Set(snapshot.sources.map((source) => source.id)),
		symbolById,
		symbolIds: new Set(symbolById.keys())
	};
}

function validateGraphBinding(
	graph: ReadWriteAccessGraphSnapshot,
	snapshot: StaticSemanticSnapshot,
	expectedInputDigest: string,
	add: AddValidationIssue
): void {
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
		add('SNAPSHOT_BINDING_MISMATCH', 'Graph is not bound to the supplied semantic snapshot.', '$');
	if (graph.graphInputDigest !== expectedInputDigest)
		add('IDENTITY_MISMATCH', 'graphInputDigest is invalid.', '$.graphInputDigest');
}

function validateGraphIdentity(
	graph: ReadWriteAccessGraphSnapshot,
	expectedGraphId: ReadWriteAccessGraphSnapshot['id'],
	add: AddValidationIssue
): void {
	if (graph.id !== expectedGraphId) add('IDENTITY_MISMATCH', 'Graph identity is invalid.', '$.id');
	if (graph.contentDigest !== readWriteAccessGraphContentDigest(graph))
		add('CONTENT_DIGEST_MISMATCH', 'Graph content digest is invalid.', '$.contentDigest');
	if (!plainObject(graph.coverage) || !exactKeys(graph.coverage, COVERAGE_KEYS))
		add('FIELD_SET_INVALID', 'Coverage field set is invalid.', '$.coverage');
	if (!sortedIds(graph.nodes) || !sortedIds(graph.edges))
		add('ORDER_INVALID', 'Nodes and edges must be strictly identity ordered.', '$');
}

function validateGraphBody(graph: ReadWriteAccessGraphSnapshot, request: ValidationRequest): void {
	const { add, snapshot } = request;
	validateGraphBinding(graph, snapshot, request.expectedInputDigest, add);
	const expectedGraphId = readWriteAccessGraphId({
		canonicalProfile: READ_WRITE_ACCESS_GRAPH_CANONICAL_PROFILE,
		graphInputDigest: request.expectedInputDigest,
		method: READ_WRITE_ACCESS_GRAPH_METHOD,
		operationVersion: READ_WRITE_ACCESS_GRAPH_OPERATION_VERSION,
		schemaVersion: READ_WRITE_ACCESS_GRAPH_SCHEMA_VERSION,
		semanticSnapshotId: snapshot.id,
		subjectId: snapshot.subjectId
	});
	validateGraphIdentity(graph, expectedGraphId, add);
	const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
	const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]));
	if (nodeById.size !== graph.nodes.length)
		add('DUPLICATE_ID', 'Node identities are not unique.', '$.nodes');
	if (edgeById.size !== graph.edges.length)
		add('DUPLICATE_ID', 'Edge identities are not unique.', '$.edges');
	const index = buildSemanticIndex(snapshot);
	if (!Array.isArray(graph.limitations) || !same(graph.limitations, EXPECTED_LIMITATIONS))
		add('SHAPE_INVALID', 'Graph limitations are absent or incompatible.', '$.limitations');
	const state: ValidationState = {
		add,
		graph,
		index,
		layerId: readWriteAccessGraphLayerId(expectedGraphId),
		nodeById,
		snapshot
	};
	validateNodes(state);
	validateEdges(state);
	validateAccessEdgeRelations(state);
	validateIndexes(state);
	validateCoverageAndLayer(state);
}

function runValidation(request: ValidationRequest): boolean {
	assertBudgets(request.budgets);
	if (!plainObject(request.value)) {
		request.add('SHAPE_INVALID', 'Graph must be a plain data object.', '$');
		return true;
	}
	const structuralIssue = structuralBudgetIssue(
		request.value,
		request.budgets.maxRecords,
		request.budgets.maxStringCharacters
	);
	if (structuralIssue !== null) {
		request.add('BUDGET_EXCEEDED', structuralIssue, '$');
		return true;
	}
	if (!exactKeys(request.value as object, TOP_LEVEL_KEYS))
		request.add('FIELD_SET_INVALID', 'Graph field set is invalid.', '$');
	const graph = request.value as unknown as ReadWriteAccessGraphSnapshot;
	if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || !Array.isArray(graph.layers)) {
		request.add('SHAPE_INVALID', 'Graph node, edge, and layer collections must be arrays.', '$');
		return true;
	}
	validateGraphBody(graph, request);
	return false;
}

function validate(
	value: unknown,
	snapshot: StaticSemanticSnapshot,
	expectedInputDigest: string,
	options: ReadWriteAccessGraphValidationOptions
): ReadWriteAccessGraphValidationResult {
	const budgets: ValidationBudgets = {
		maxIssues: options.maxIssues ?? 1_000,
		maxRecords: options.maxRecords ?? 10_000_000,
		maxStringCharacters: options.maxStringCharacters ?? 1_000_000_000
	};
	const issues: ReadWriteAccessGraphValidationIssue[] = [];
	const add: AddValidationIssue = (code, message, path) => {
		if (issues.length < budgets.maxIssues) issues.push({ code, message, path });
	};
	try {
		if (runValidation({ add, budgets, expectedInputDigest, snapshot, value }))
			return { issues, state: 'INVALID' };
		return issues.length === 0 ? { issues: [], state: 'VALID' } : { issues, state: 'INVALID' };
	} catch (error) {
		add('SHAPE_INVALID', validationFailureMessage(error), '$');
		return { issues, state: 'INVALID' };
	}
}

function expectedNodeKeys(node: ReadWriteAccessGraphNode): readonly string[] {
	if (node.kind === 'SYMBOL_SLOT') return SYMBOL_NODE_KEYS;
	if (node.kind === 'ACCESS_OCCURRENCE') return ACCESS_NODE_KEYS;
	if (node.kind === 'FRONTIER') return FRONTIER_NODE_KEYS;
	return [];
}

function validateCommonNodeFields(
	state: ValidationState,
	node: ReadWriteAccessGraphNode,
	path: string
): void {
	const { add, graph, index } = state;
	const expectedKeys = expectedNodeKeys(node);
	if (expectedKeys.length === 0 || !exactKeys(node, expectedKeys))
		add('FIELD_SET_INVALID', 'Node field set or discriminator is invalid.', path);
	if (
		node.graphId !== graph.id ||
		node.layerId !== state.layerId ||
		node.subjectId !== graph.subjectId ||
		node.semanticSnapshotId !== graph.semanticSnapshotId
	)
		add('SNAPSHOT_BINDING_MISMATCH', 'Node graph binding is invalid.', path);
	if (
		!['SUPPORTED', 'UNKNOWN', 'UNSUPPORTED'].includes(node.epistemic) ||
		!validLocations(
			node.sourceLocations,
			index.sourceIds,
			node.kind === 'SYMBOL_SLOT' ? undefined : node.sourceId
		)
	)
		add('SHAPE_INVALID', 'Node epistemic state or source locations are invalid.', path);
	if (
		!Array.isArray(node.provenanceIds) ||
		node.provenanceIds.some((id: unknown) => typeof id !== 'string' || !index.provenanceIds.has(id))
	)
		add('DANGLING_SEMANTIC_REFERENCE', 'Node provenance is dangling.', `${path}.provenanceIds`);
}

function validateNodes(state: ValidationState): void {
	for (const [index, node] of state.graph.nodes.entries())
		validateNode(state, node, `$.nodes[${index}]`);
}

function validateNode(state: ValidationState, node: ReadWriteAccessGraphNode, path: string): void {
	if (!plainObject(node)) {
		state.add('SHAPE_INVALID', 'Node must be a plain data object.', path);
		return;
	}
	validateCommonNodeFields(state, node, path);
	if (node.kind === 'SYMBOL_SLOT') {
		validateSymbolSlotNode(state, node, path);
		return;
	}
	if (
		!state.index.semanticNodeIds.has(node.occurrenceNodeId) ||
		!state.index.sourceIds.has(node.sourceId)
	)
		state.add('DANGLING_SEMANTIC_REFERENCE', 'Occurrence node or source is dangling.', path);
	if (node.kind === 'ACCESS_OCCURRENCE') validateAccessNode(state, node, path);
	else validateFrontierNode(state, node, path);
}

function expectedSymbolLocations(
	symbol: StaticSemanticSnapshot['symbols'][number] | undefined,
	declarationById: ReadonlyMap<string, StaticSemanticSnapshot['declarations'][number]>
): { end: number; sourceId: StaticSemanticSnapshot['sources'][number]['id']; start: number }[] {
	return (
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
				(left, right) => compareText(left.sourceId, right.sourceId) || left.start - right.start
			) ?? []
	);
}

function validateSymbolSlotNode(
	state: ValidationState,
	node: ReadWriteSymbolSlotNode,
	path: string
): void {
	const symbol = state.index.symbolById.get(node.symbolId);
	const expectedLocations = expectedSymbolLocations(symbol, state.index.declarationById);
	if (
		symbol === undefined ||
		node.id !== readWriteAccessSymbolNodeId(state.graph.id, node.symbolId) ||
		node.epistemic !== 'SUPPORTED' ||
		node.name !== symbol.name ||
		node.programId !== symbol.programId ||
		node.projectId !== symbol.projectId ||
		!same(node.declarationIds, [...symbol.declarationIds].sort(compareText)) ||
		!same(node.provenanceIds, [symbol.provenanceId]) ||
		!same(node.sourceLocations, expectedLocations)
	)
		state.add('IDENTITY_MISMATCH', 'Symbol-slot identity or semantic symbol is invalid.', path);
}

interface AccessExpectation {
	accessKind: 'READ' | 'READ_WRITE' | 'WRITE' | null;
	assignmentNodeId: StaticSemanticSnapshot['assignments'][number]['nodeId'] | null;
	occurrenceNodeId: StaticSemanticSnapshot['astNodes'][number]['id'] | null;
	provenanceIds: readonly string[] | null;
	sourceId: StaticSemanticSnapshot['sources'][number]['id'] | null;
	symbolId: StaticSemanticSnapshot['symbols'][number]['id'] | null;
}

function applyAssignmentAccessKind(
	index: SemanticIndex,
	semanticReference: StaticSemanticSnapshot['references'][number],
	expectation: AccessExpectation
): void {
	const assignment =
		expectation.assignmentNodeId === null
			? undefined
			: index.assignmentById.get(expectation.assignmentNodeId);
	const occurrenceNode = index.semanticNodeById.get(semanticReference.nodeId);
	const target =
		assignment === undefined ? undefined : index.semanticNodeById.get(assignment.targetNodeId);
	if (assignment === undefined || target === undefined) return;
	const targetClass = assignmentTargetClass(
		target,
		(index.declarationsByAssignment.get(assignment.nodeId)?.size ?? 0) > 0
	);
	if (targetClass === 'UNSUPPORTED') expectation.accessKind = null;
	else if (
		occurrenceNode !== undefined &&
		referenceWritesAssignmentTarget(semanticReference, occurrenceNode, target)
	)
		expectation.accessKind = expectedAssignmentAccessKind(assignment);
}

function applyReferenceAccessExpectation(
	index: SemanticIndex,
	semanticReference: StaticSemanticSnapshot['references'][number],
	expectation: AccessExpectation
): void {
	expectation.occurrenceNodeId = semanticReference.nodeId;
	expectation.sourceId = semanticReference.sourceId;
	expectation.symbolId = semanticReference.resolvedSymbolId ?? semanticReference.symbolId;
	expectation.assignmentNodeId = nearestAssignmentNodeId(
		semanticReference.nodeId,
		index.semanticNodeById,
		index.assignmentByTargetId
	);
	const semanticSource = index.sourceById.get(semanticReference.sourceId);
	const semanticSymbol =
		expectation.symbolId === null ? undefined : index.symbolById.get(expectation.symbolId);
	const referenceIsSupported =
		index.candidateReferenceIds.has(semanticReference.id) &&
		semanticReference.scopeLinkState === 'RESOLVED' &&
		(semanticReference.resolutionState === 'RESOLVED_DIRECT' ||
			semanticReference.resolutionState === 'RESOLVED_ALIAS') &&
		semanticSource !== undefined &&
		semanticSymbol !== undefined &&
		!isTypePosition(semanticReference.nodeId, index.semanticNodeById) &&
		!isUnmodeledWriteContext(semanticReference.nodeId, index.semanticNodeById);
	if (referenceIsSupported) {
		expectation.provenanceIds = sortedUnique([
			semanticReference.resolutionProvenanceId,
			semanticReference.structuralProvenanceId,
			semanticSymbol.provenanceId,
			semanticSource.provenanceId,
			...(semanticSource.syntaxProvenanceId === null ? [] : [semanticSource.syntaxProvenanceId])
		]);
		expectation.accessKind = 'READ';
	}
	if (referenceIsSupported && expectation.assignmentNodeId !== null)
		applyAssignmentAccessKind(index, semanticReference, expectation);
}

function applyDeclarationAccessExpectation(
	index: SemanticIndex,
	semanticDeclaration: StaticSemanticSnapshot['declarations'][number],
	expectation: AccessExpectation
): void {
	const candidate =
		semanticDeclaration.candidateId === null
			? undefined
			: index.candidateById.get(semanticDeclaration.candidateId);
	expectation.occurrenceNodeId = candidate?.nameNodeId ?? semanticDeclaration.nodeId;
	expectation.sourceId = semanticDeclaration.sourceId;
	expectation.symbolId = semanticDeclaration.symbolId;
	expectation.assignmentNodeId =
		index.declarationAssignmentById.get(semanticDeclaration.id) ?? null;
	const assignment =
		expectation.assignmentNodeId === null
			? undefined
			: index.assignmentById.get(expectation.assignmentNodeId);
	const semanticSource = index.sourceById.get(semanticDeclaration.sourceId);
	const semanticSymbol =
		expectation.symbolId === null ? undefined : index.symbolById.get(expectation.symbolId);
	if (
		assignment === undefined ||
		semanticDeclaration.symbolBindingState !== 'RESOLVED' ||
		semanticSource === undefined ||
		semanticSymbol === undefined
	)
		return;
	expectation.accessKind = expectedAssignmentAccessKind(assignment);
	expectation.provenanceIds = sortedUnique([
		semanticDeclaration.bindingProvenanceId,
		semanticDeclaration.structuralProvenanceId,
		semanticSymbol.provenanceId,
		semanticSource.provenanceId,
		...(semanticSource.syntaxProvenanceId === null ? [] : [semanticSource.syntaxProvenanceId])
	]);
}

function accessExpectation(
	index: SemanticIndex,
	semanticReference: StaticSemanticSnapshot['references'][number] | undefined,
	semanticDeclaration: StaticSemanticSnapshot['declarations'][number] | undefined
): AccessExpectation {
	const expectation: AccessExpectation = {
		accessKind: null,
		assignmentNodeId: null,
		occurrenceNodeId: null,
		provenanceIds: null,
		sourceId: null,
		symbolId: null
	};
	if (semanticReference !== undefined)
		applyReferenceAccessExpectation(index, semanticReference, expectation);
	else if (semanticDeclaration !== undefined)
		applyDeclarationAccessExpectation(index, semanticDeclaration, expectation);
	return expectation;
}

function accessOccurrenceMismatch(
	index: SemanticIndex,
	node: ReadWriteAccessOccurrenceNode,
	expectation: AccessExpectation
): boolean {
	return (
		expectation.accessKind === null ||
		node.accessKind !== expectation.accessKind ||
		node.assignmentNodeId !== expectation.assignmentNodeId ||
		node.occurrenceNodeId !== expectation.occurrenceNodeId ||
		node.sourceId !== expectation.sourceId ||
		node.symbolId !== expectation.symbolId ||
		index.sourceById.get(node.sourceId) === undefined ||
		!same(node.provenanceIds, expectation.provenanceIds) ||
		!same(node.sourceLocations, [
			{
				end: index.semanticNodeById.get(node.occurrenceNodeId)?.end,
				sourceId: node.sourceId,
				start: index.semanticNodeById.get(node.occurrenceNodeId)?.start
			}
		])
	);
}

function validateAccessClassification(
	state: ValidationState,
	node: ReadWriteAccessOccurrenceNode,
	path: string
): void {
	const { add, index } = state;
	const slot = state.nodeById.get(node.slotNodeId);
	if (
		!index.symbolIds.has(node.symbolId) ||
		slot?.kind !== 'SYMBOL_SLOT' ||
		slot.symbolId !== node.symbolId
	)
		add('DANGLING_SEMANTIC_REFERENCE', 'Access symbol slot is dangling.', path);
	if (
		node.epistemic !== 'SUPPORTED' ||
		!ACCESS_KINDS.has(node.accessKind) ||
		!OCCURRENCE_KINDS.has(node.occurrenceKind) ||
		(node.assignmentNodeId !== null && !index.assignmentNodeIds.has(node.assignmentNodeId)) ||
		(node.occurrenceKind === 'REFERENCE') !== (node.referenceId !== null) ||
		(node.occurrenceKind === 'ASSIGNMENT_DECLARATION_TARGET') !== (node.declarationId !== null)
	)
		add('SHAPE_INVALID', 'Access occurrence classification is invalid.', path);
	if (node.referenceId !== null && !index.referenceIds.has(node.referenceId))
		add('DANGLING_SEMANTIC_REFERENCE', 'Access reference is dangling.', path);
	if (node.declarationId !== null && !index.declarationIds.has(node.declarationId))
		add('DANGLING_SEMANTIC_REFERENCE', 'Access declaration is dangling.', path);
}

function validateAccessNode(
	state: ValidationState,
	node: ReadWriteAccessOccurrenceNode,
	path: string
): void {
	const { add, index } = state;
	validateAccessClassification(state, node, path);
	const expectation = accessExpectation(
		index,
		node.referenceId === null ? undefined : index.referenceById.get(node.referenceId),
		node.declarationId === null ? undefined : index.declarationById.get(node.declarationId)
	);
	if (accessOccurrenceMismatch(index, node, expectation))
		add('DANGLING_SEMANTIC_REFERENCE', 'Access occurrence does not match its semantic fact.', path);
	if (
		node.id !==
		readWriteAccessOccurrenceNodeId(state.graph.id, {
			declarationId: node.declarationId,
			referenceId: node.referenceId
		})
	)
		add('IDENTITY_MISMATCH', 'Access occurrence identity is invalid.', path);
}

interface FrontierExpectation {
	assignmentNodeId: StaticSemanticSnapshot['assignments'][number]['nodeId'] | null;
	epistemic: 'UNKNOWN' | 'UNSUPPORTED' | null;
	kind: string | null;
	occurrenceNodeId: StaticSemanticSnapshot['astNodes'][number]['id'] | null;
	provenanceIds: readonly string[] | null;
	reason: string | null;
	sourceId: StaticSemanticSnapshot['sources'][number]['id'] | null;
}

function applyReferenceFrontierKind(
	index: SemanticIndex,
	semanticReference: StaticSemanticSnapshot['references'][number],
	expectation: FrontierExpectation
): void {
	if (isTypePosition(semanticReference.nodeId, index.semanticNodeById)) {
		expectation.kind = 'TYPE_POSITION_EXCLUDED';
		expectation.reason = 'Type-position reference is excluded from runtime access classification.';
		expectation.epistemic = 'UNSUPPORTED';
		return;
	}
	if (isUnmodeledWriteContext(semanticReference.nodeId, index.semanticNodeById)) {
		expectation.kind = 'UNSUPPORTED_REFERENCE';
		expectation.reason =
			'Reference occurs in a write-capable syntax form outside the normalized assignment taxonomy.';
		expectation.epistemic = 'UNKNOWN';
		return;
	}
	if (expectation.assignmentNodeId === null) return;
	const assignment = index.assignmentById.get(expectation.assignmentNodeId);
	const target =
		assignment === undefined ? undefined : index.semanticNodeById.get(assignment.targetNodeId);
	if (
		assignment !== undefined &&
		target !== undefined &&
		assignmentTargetClass(
			target,
			(index.declarationsByAssignment.get(assignment.nodeId)?.size ?? 0) > 0
		) === 'UNSUPPORTED'
	) {
		expectation.kind = 'UNSUPPORTED_ASSIGNMENT_TARGET';
		expectation.reason =
			'Reference occurs inside an assignment target shape outside this bounded method.';
		expectation.epistemic = 'UNKNOWN';
	}
}

function applyUnresolvedReferenceFrontier(
	index: SemanticIndex,
	semanticReference: StaticSemanticSnapshot['references'][number],
	expectation: FrontierExpectation
): void {
	const symbolId = semanticReference.resolvedSymbolId ?? semanticReference.symbolId;
	const resolved =
		symbolId !== null &&
		index.symbolById.has(symbolId) &&
		semanticReference.scopeLinkState === 'RESOLVED' &&
		(semanticReference.resolutionState === 'RESOLVED_DIRECT' ||
			semanticReference.resolutionState === 'RESOLVED_ALIAS');
	if (resolved) return;
	expectation.kind =
		semanticReference.resolutionState === 'UNSUPPORTED'
			? 'UNSUPPORTED_REFERENCE'
			: 'UNRESOLVED_REFERENCE';
	expectation.reason =
		semanticReference.scopeLinkState === 'RESOLVED'
			? 'Reference does not resolve to a retained Program-local symbol slot.'
			: 'Reference scope linkage is unsupported and cannot establish a supported access.';
	expectation.epistemic = 'UNKNOWN';
}

function applyReferenceFrontierExpectation(
	index: SemanticIndex,
	semanticReference: StaticSemanticSnapshot['references'][number],
	expectation: FrontierExpectation
): void {
	expectation.assignmentNodeId = nearestAssignmentNodeId(
		semanticReference.nodeId,
		index.semanticNodeById,
		index.assignmentByTargetId
	);
	expectation.occurrenceNodeId = semanticReference.nodeId;
	expectation.sourceId = semanticReference.sourceId;
	expectation.provenanceIds = sortedUnique([
		semanticReference.resolutionProvenanceId,
		semanticReference.structuralProvenanceId
	]);
	applyReferenceFrontierKind(index, semanticReference, expectation);
	if (expectation.kind === null)
		applyUnresolvedReferenceFrontier(index, semanticReference, expectation);
}

function applyAssignmentFrontierExpectation(
	index: SemanticIndex,
	assignmentNodeId: StaticSemanticSnapshot['assignments'][number]['nodeId'],
	expectation: FrontierExpectation
): void {
	const assignment = index.assignmentById.get(assignmentNodeId);
	const target =
		assignment === undefined ? undefined : index.semanticNodeById.get(assignment.targetNodeId);
	const source = target === undefined ? undefined : index.sourceById.get(target.sourceId);
	if (assignment === undefined || target === undefined || source === undefined) return;
	expectation.assignmentNodeId = assignment.nodeId;
	expectation.occurrenceNodeId = target.id;
	expectation.sourceId = source.id;
	const targetClass = assignmentTargetClass(
		target,
		(index.declarationsByAssignment.get(assignment.nodeId)?.size ?? 0) > 0
	);
	expectation.kind =
		targetClass === 'DYNAMIC_ELEMENT'
			? 'DYNAMIC_ELEMENT_WRITE_TARGET'
			: 'UNSUPPORTED_ASSIGNMENT_TARGET';
	expectation.reason =
		targetClass === 'DYNAMIC_ELEMENT'
			? 'Computed element assignment has no compiler-resolved member slot.'
			: 'Assignment target has no supported resolved write slot.';
	expectation.epistemic = 'UNKNOWN';
	expectation.provenanceIds = sortedUnique(index.provenanceBySource.get(source.id) ?? []);
}

function frontierExpectation(
	index: SemanticIndex,
	node: ReadWriteAccessFrontierNode
): FrontierExpectation {
	const expectation: FrontierExpectation = {
		assignmentNodeId: null,
		epistemic: null,
		kind: null,
		occurrenceNodeId: null,
		provenanceIds: null,
		reason: null,
		sourceId: null
	};
	const semanticReference =
		node.referenceId === null ? undefined : index.referenceById.get(node.referenceId);
	if (semanticReference !== undefined)
		applyReferenceFrontierExpectation(index, semanticReference, expectation);
	else if (node.assignmentNodeId !== null)
		applyAssignmentFrontierExpectation(index, node.assignmentNodeId, expectation);
	return expectation;
}

function frontierMismatch(
	index: SemanticIndex,
	node: ReadWriteAccessFrontierNode,
	expectation: FrontierExpectation
): boolean {
	const expectedNode =
		expectation.occurrenceNodeId === null
			? undefined
			: index.semanticNodeById.get(expectation.occurrenceNodeId);
	return (
		expectation.kind === null ||
		node.assignmentNodeId !== expectation.assignmentNodeId ||
		node.occurrenceNodeId !== expectation.occurrenceNodeId ||
		node.sourceId !== expectation.sourceId ||
		node.frontierKind !== expectation.kind ||
		node.reason !== expectation.reason ||
		node.epistemic !== expectation.epistemic ||
		!same(node.provenanceIds, expectation.provenanceIds) ||
		expectedNode === undefined ||
		!same(node.sourceLocations, [
			{
				end: expectedNode?.end,
				sourceId: expectation.sourceId,
				start: expectedNode?.start
			}
		])
	);
}

function validateFrontierNode(
	state: ValidationState,
	node: ReadWriteAccessFrontierNode,
	path: string
): void {
	const { add, index } = state;
	if (
		node.id !==
		readWriteAccessFrontierNodeId(state.graph.id, {
			assignmentNodeId: node.assignmentNodeId,
			frontierKind: node.frontierKind,
			occurrenceNodeId: node.occurrenceNodeId,
			referenceId: node.referenceId
		})
	)
		add('IDENTITY_MISMATCH', 'Frontier identity is invalid.', path);
	if (
		!FRONTIER_KINDS.has(node.frontierKind) ||
		(node.assignmentNodeId !== null && !index.assignmentNodeIds.has(node.assignmentNodeId)) ||
		(node.referenceId !== null && !index.candidateReferenceIds.has(node.referenceId)) ||
		typeof node.reason !== 'string' ||
		node.reason.length === 0 ||
		(node.frontierKind === 'TYPE_POSITION_EXCLUDED'
			? node.epistemic !== 'UNSUPPORTED'
			: node.epistemic !== 'UNKNOWN')
	)
		add('SHAPE_INVALID', 'Frontier classification is invalid.', path);
	const expectation = frontierExpectation(index, node);
	if (frontierMismatch(index, node, expectation))
		add('DANGLING_SEMANTIC_REFERENCE', 'Frontier does not match its semantic fact.', path);
}

function edgeBindingInvalid(
	state: ValidationState,
	edge: ReadWriteAccessGraphEdge,
	source: ReadWriteAccessGraphNode | undefined
): boolean {
	const { graph, index } = state;
	return (
		edge.graphId !== graph.id ||
		edge.layerId !== state.layerId ||
		edge.subjectId !== graph.subjectId ||
		edge.semanticSnapshotId !== graph.semanticSnapshotId ||
		edge.method !== READ_WRITE_ACCESS_GRAPH_METHOD ||
		edge.epistemic !== 'SUPPORTED' ||
		!['READS', 'WRITES'].includes(edge.relationKind) ||
		edge.source.kind !== 'ACCESS_OCCURRENCE' ||
		edge.target.kind !== 'SYMBOL_SLOT' ||
		!validLocations(edge.sourceLocations, index.sourceIds) ||
		!Array.isArray(edge.provenanceIds) ||
		edge.provenanceIds.some(
			(id: unknown) => typeof id !== 'string' || !index.provenanceIds.has(id)
		) ||
		(source?.kind === 'ACCESS_OCCURRENCE' &&
			(!same(edge.provenanceIds, source.provenanceIds) ||
				!same(edge.sourceLocations, source.sourceLocations)))
	);
}

function validateEdge(state: ValidationState, edge: ReadWriteAccessGraphEdge, path: string): void {
	const { add } = state;
	if (!plainObject(edge) || !exactKeys(edge, EDGE_KEYS)) {
		add('FIELD_SET_INVALID', 'Edge field set is invalid.', path);
		return;
	}
	if (
		!plainObject(edge.source) ||
		!exactKeys(edge.source, ENDPOINT_KEYS) ||
		!plainObject(edge.target) ||
		!exactKeys(edge.target, ENDPOINT_KEYS)
	)
		add('FIELD_SET_INVALID', 'Edge endpoint field set is invalid.', path);
	const source = state.nodeById.get(edge.source.nodeId);
	const target = state.nodeById.get(edge.target.nodeId);
	if (source?.kind !== 'ACCESS_OCCURRENCE' || target?.kind !== 'SYMBOL_SLOT')
		add('DANGLING_ENDPOINT', 'Edge endpoints are absent or have incompatible kinds.', path);
	else if (source.slotNodeId !== target.id || edge.accessNodeId !== source.id)
		add('DANGLING_ENDPOINT', 'Edge does not connect its access to its symbol slot.', path);
	if (edgeBindingInvalid(state, edge, source))
		add('SNAPSHOT_BINDING_MISMATCH', 'Edge binding or evidence is invalid.', path);
	if (
		edge.id !==
		readWriteAccessEdgeId({
			graphId: state.graph.id,
			relationKind: edge.relationKind,
			source: edge.source,
			target: edge.target
		})
	)
		add('IDENTITY_MISMATCH', 'Edge identity is invalid.', path);
}

function validateEdges(state: ValidationState): void {
	for (const [index, edge] of state.graph.edges.entries())
		validateEdge(state, edge, `$.edges[${index}]`);
}

function validateAccessEdgeRelations(state: ValidationState): void {
	const { add, graph } = state;
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
}

function validateIndexes(state: ValidationState): void {
	const { add, graph } = state;
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
}

interface NodeProjection {
	readonly accessReferenceIds: readonly string[];
	readonly accesses: readonly ReadWriteAccessOccurrenceNode[];
	readonly assignmentFrontierIds: readonly string[];
	readonly excludedTypePositionReferences: number;
	readonly frontierReferenceIds: readonly string[];
	readonly frontiers: readonly ReadWriteAccessFrontierNode[];
	readonly representedAssignmentIds: ReadonlySet<string>;
	readonly slots: readonly ReadWriteSymbolSlotNode[];
}

function projectNodeGroups(graph: ReadWriteAccessGraphSnapshot): NodeProjection {
	const accesses = graph.nodes.filter((node) => node.kind === 'ACCESS_OCCURRENCE');
	const frontiers = graph.nodes.filter((node) => node.kind === 'FRONTIER');
	const slots = graph.nodes.filter((node) => node.kind === 'SYMBOL_SLOT');
	return {
		accessReferenceIds: accesses.flatMap((node) =>
			node.referenceId === null ? [] : [node.referenceId]
		),
		accesses,
		assignmentFrontierIds: frontiers.flatMap((node) =>
			node.referenceId === null && node.assignmentNodeId !== null ? [node.assignmentNodeId] : []
		),
		excludedTypePositionReferences: frontiers.filter(
			(node) => node.frontierKind === 'TYPE_POSITION_EXCLUDED'
		).length,
		frontierReferenceIds: frontiers.flatMap((node) =>
			node.referenceId === null ? [] : [node.referenceId]
		),
		frontiers,
		representedAssignmentIds: new Set(
			accesses.flatMap((node) =>
				node.assignmentNodeId === null || node.accessKind === 'READ' ? [] : [node.assignmentNodeId]
			)
		),
		slots
	};
}

function validateReferenceProjection(state: ValidationState, projection: NodeProjection): void {
	const projectedReferenceIds = [
		...projection.accessReferenceIds,
		...projection.frontierReferenceIds
	];
	if (
		new Set(projectedReferenceIds).size !== projectedReferenceIds.length ||
		!same(
			[...projectedReferenceIds].sort(compareText),
			[...state.index.candidateReferenceIds].sort(compareText)
		)
	)
		state.add(
			'COVERAGE_MISMATCH',
			'Candidate semantic references are not projected exactly once.',
			'$.nodes'
		);
}

function validateDeclarationProjection(state: ValidationState, projection: NodeProjection): void {
	const { index, snapshot } = state;
	const expectedDeclarationAccessIds = snapshot.declarations
		.filter(
			(declaration) =>
				declaration.symbolBindingState === 'RESOLVED' &&
				declaration.symbolId !== null &&
				index.symbolById.has(declaration.symbolId) &&
				index.declarationAssignmentById.has(declaration.id)
		)
		.map((declaration) => declaration.id)
		.sort(compareText);
	const actualDeclarationAccessIds = projection.accesses
		.flatMap((node) => (node.declarationId === null ? [] : [node.declarationId]))
		.sort(compareText);
	if (
		new Set(actualDeclarationAccessIds).size !== actualDeclarationAccessIds.length ||
		!same(actualDeclarationAccessIds, expectedDeclarationAccessIds)
	)
		state.add(
			'COVERAGE_MISMATCH',
			'Assignment-bound semantic declarations are not projected exactly once.',
			'$.nodes'
		);
}

function validateAssignmentProjection(state: ValidationState, projection: NodeProjection): void {
	const projectedAssignmentIds = [
		...projection.representedAssignmentIds,
		...projection.assignmentFrontierIds
	];
	if (
		new Set(projection.assignmentFrontierIds).size !== projection.assignmentFrontierIds.length ||
		new Set(projectedAssignmentIds).size !== projectedAssignmentIds.length ||
		!same(
			[...projectedAssignmentIds].sort(compareText),
			[...state.index.assignmentNodeIds].sort(compareText)
		)
	)
		state.add(
			'COVERAGE_MISMATCH',
			'Semantic assignments are not represented or frontiered exactly once.',
			'$.nodes'
		);
}

function validateSymbolProjection(state: ValidationState, projection: NodeProjection): void {
	const slotSymbolIds = projection.slots.map((slot) => slot.symbolId);
	const accessedSymbolIds = [...new Set(projection.accesses.map((access) => access.symbolId))].sort(
		compareText
	);
	if (
		new Set(slotSymbolIds).size !== slotSymbolIds.length ||
		!same([...slotSymbolIds].sort(compareText), accessedSymbolIds)
	)
		state.add(
			'COVERAGE_MISMATCH',
			'Accessed semantic symbols do not reconcile with symbol slots.',
			'$.nodes'
		);
}

function validateCoverageCounters(state: ValidationState, projection: NodeProjection): void {
	const { accesses, frontiers, slots } = projection;
	const excludedTypePositionReferences = projection.excludedTypePositionReferences;
	const expectedCoverage = {
		accessOccurrences: accesses.length,
		closure: 'OPEN',
		discoveredAssignments: state.snapshot.assignments.length,
		discoveredCandidateReferences: state.index.candidateReferenceIds.size,
		edges: state.graph.edges.length,
		excludedTypePositionReferences,
		frontierAssignments: projection.assignmentFrontierIds.length,
		frontierNodes: frontiers.length,
		frontierReferences: projection.frontierReferenceIds.length - excludedTypePositionReferences,
		readAccesses: accesses.filter((node) => node.accessKind === 'READ').length,
		readWriteAccesses: accesses.filter((node) => node.accessKind === 'READ_WRITE').length,
		reconciles: true,
		representedAssignmentTargets: projection.representedAssignmentIds.size,
		representedReferences: projection.accessReferenceIds.length,
		symbolSlots: slots.length,
		writeAccesses: accesses.filter((node) => node.accessKind === 'WRITE').length
	} as const;
	if (!same(state.graph.coverage, expectedCoverage))
		state.add('COVERAGE_MISMATCH', 'Coverage counters do not reconcile.', '$.coverage');
}

function validateLayer(state: ValidationState): void {
	const { add, graph } = state;
	if (
		graph.layers.length !== 1 ||
		!plainObject(graph.layers[0]) ||
		!exactKeys(graph.layers[0], LAYER_KEYS)
	) {
		add('FIELD_SET_INVALID', 'Exactly one valid graph layer is required.', '$.layers');
		return;
	}
	const layer = graph.layers[0];
	const expectedLayerProvenanceIds = sortedUnique(
		graph.nodes
			.flatMap((node) => node.provenanceIds)
			.concat(graph.edges.flatMap((edge) => edge.provenanceIds))
	);
	if (
		layer.id !== state.layerId ||
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

function validateCoverageAndLayer(state: ValidationState): void {
	const projection = projectNodeGroups(state.graph);
	validateReferenceProjection(state, projection);
	validateDeclarationProjection(state, projection);
	validateAssignmentProjection(state, projection);
	validateSymbolProjection(state, projection);
	validateCoverageCounters(state, projection);
	validateLayer(state);
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
