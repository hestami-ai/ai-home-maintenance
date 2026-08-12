import { isProxy } from 'node:util/types';
import ts from 'typescript';
import {
	FULL_JAN_CSAA_CAPABILITY_007_DATA_FLOW,
	READ_WRITE_ACCESS_GRAPH_CANONICAL_PROFILE,
	READ_WRITE_ACCESS_GRAPH_CAPABILITY,
	READ_WRITE_ACCESS_GRAPH_CAPABILITY_STATUS,
	READ_WRITE_ACCESS_GRAPH_METHOD,
	READ_WRITE_ACCESS_GRAPH_OPERATION_VERSION,
	READ_WRITE_ACCESS_GRAPH_REQUEST_SCHEMA_VERSION,
	READ_WRITE_ACCESS_GRAPH_SCHEMA_VERSION,
	type BuildReadWriteAccessGraphRequest,
	type ReadWriteAccessFrontierKind,
	type ReadWriteAccessFrontierNode,
	type ReadWriteAccessGraphBuildDiagnostic,
	type ReadWriteAccessGraphBuildOutcome,
	type ReadWriteAccessGraphCoverage,
	type ReadWriteAccessGraphEdge,
	type ReadWriteAccessGraphIndexEntry,
	type ReadWriteAccessGraphLimitation,
	type ReadWriteAccessGraphNode,
	type ReadWriteAccessGraphNodeId,
	type ReadWriteAccessKind,
	type ReadWriteAccessOccurrenceNode,
	type ReadWriteSymbolSlotNode
} from '../contracts/read-write-access-graph.js';
import type {
	SemanticAssignmentRecord,
	SemanticAstNodeRecord,
	SemanticDeclarationRecord,
	SemanticProvenanceId,
	SemanticReferenceRecord,
	SemanticSourceRecord,
	SemanticSymbolId,
	SemanticSymbolRecord,
	StaticSemanticSnapshot
} from '../contracts/semantic.js';
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
import { validateConstructedReadWriteAccessGraph } from './validate-read-write-access-graph.js';

const REQUEST_KEYS = [
	'budgets',
	'operationVersion',
	'schemaVersion',
	'semanticSnapshotId',
	'subjectId'
] as const;
const BUDGET_KEYS = ['maxAccesses', 'maxEdges', 'maxFrontiers', 'maxNodes'] as const;
const ACCESS_REFERENCE_ROLES = new Set<SemanticReferenceRecord['role']>([
	'MEMBER_NAME',
	'SYMBOL_USE'
]);

const LIMITATIONS: readonly ReadWriteAccessGraphLimitation[] = [
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

interface AccessSpec {
	readonly accessKind: ReadWriteAccessKind;
	readonly assignment: SemanticAssignmentRecord | null;
	readonly declaration: SemanticDeclarationRecord | null;
	readonly node: SemanticAstNodeRecord;
	readonly reference: SemanticReferenceRecord | null;
	readonly source: SemanticSourceRecord;
	readonly symbol: SemanticSymbolRecord;
}

interface FrontierSpec {
	readonly assignment: SemanticAssignmentRecord | null;
	readonly frontierKind: ReadWriteAccessFrontierKind;
	readonly node: SemanticAstNodeRecord;
	readonly provenanceIds: readonly SemanticProvenanceId[];
	readonly reason: string;
	readonly reference: SemanticReferenceRecord | null;
	readonly source: SemanticSourceRecord;
}

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique<T extends string>(values: Iterable<T>): T[] {
	return [...new Set(values)].sort(compareText);
}

function exactOwnStringKeys(value: object, expected: readonly string[]): boolean {
	const keys = Reflect.ownKeys(value);
	const sortedExpected = [...expected].sort(compareText);
	return (
		keys.every((key) => typeof key === 'string') &&
		keys.length === expected.length &&
		(keys as string[]).sort(compareText).every((key, index) => key === sortedExpected[index])
	);
}

function positiveSafeInteger(value: unknown, name: string): number {
	if (!Number.isSafeInteger(value) || (value as number) <= 0)
		throw new TypeError(`${name} must be a positive safe integer.`);
	return value as number;
}

function materializeRequest(value: unknown): BuildReadWriteAccessGraphRequest {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		throw new TypeError('Read/write access graph request must be a plain data object.');
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new TypeError('Read/write access graph request must have a plain prototype.');
	if (!exactOwnStringKeys(value, REQUEST_KEYS))
		throw new TypeError('Read/write access graph request has an invalid field set.');
	const request = value as Record<string, unknown>;
	if (
		request.budgets === null ||
		typeof request.budgets !== 'object' ||
		Array.isArray(request.budgets) ||
		isProxy(request.budgets)
	)
		throw new TypeError('Read/write access graph budgets must be a plain data object.');
	if (!exactOwnStringKeys(request.budgets, BUDGET_KEYS))
		throw new TypeError('Read/write access graph budgets have an invalid field set.');
	const budgetPrototype = Reflect.getPrototypeOf(request.budgets);
	if (budgetPrototype !== Object.prototype && budgetPrototype !== null)
		throw new TypeError('Read/write access graph budgets must have a plain prototype.');
	const budgets = request.budgets as Record<string, unknown>;
	if (request.operationVersion !== READ_WRITE_ACCESS_GRAPH_OPERATION_VERSION)
		throw new TypeError('Read/write access graph operationVersion is incompatible.');
	if (request.schemaVersion !== READ_WRITE_ACCESS_GRAPH_REQUEST_SCHEMA_VERSION)
		throw new TypeError('Read/write access graph request schemaVersion is incompatible.');
	if (typeof request.semanticSnapshotId !== 'string' || request.semanticSnapshotId.length === 0)
		throw new TypeError('Read/write access graph semanticSnapshotId must be nonempty.');
	if (typeof request.subjectId !== 'string' || request.subjectId.length === 0)
		throw new TypeError('Read/write access graph subjectId must be nonempty.');
	return {
		budgets: {
			maxAccesses: positiveSafeInteger(budgets.maxAccesses, 'budgets.maxAccesses'),
			maxEdges: positiveSafeInteger(budgets.maxEdges, 'budgets.maxEdges'),
			maxFrontiers: positiveSafeInteger(budgets.maxFrontiers, 'budgets.maxFrontiers'),
			maxNodes: positiveSafeInteger(budgets.maxNodes, 'budgets.maxNodes')
		},
		operationVersion: READ_WRITE_ACCESS_GRAPH_OPERATION_VERSION,
		schemaVersion: READ_WRITE_ACCESS_GRAPH_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId:
			request.semanticSnapshotId as BuildReadWriteAccessGraphRequest['semanticSnapshotId'],
		subjectId: request.subjectId
	};
}

function diagnostic(
	code: ReadWriteAccessGraphBuildDiagnostic['code'],
	message: string,
	phase: ReadWriteAccessGraphBuildDiagnostic['phase'],
	path: string | null = null
): ReadWriteAccessGraphBuildDiagnostic {
	return { code, message, path, phase };
}

function unavailable(
	code: ReadWriteAccessGraphBuildDiagnostic['code'],
	message: string,
	phase: ReadWriteAccessGraphBuildDiagnostic['phase'],
	path: string | null = null
): ReadWriteAccessGraphBuildOutcome {
	return { diagnostics: [diagnostic(code, message, phase, path)], outcome: 'unavailable' };
}

function mapUnique<T extends { readonly id: string }>(
	label: string,
	records: readonly T[]
): Map<string, T> {
	const map = new Map(records.map((record) => [record.id, record]));
	if (map.size !== records.length) throw new Error(`${label} identity collision.`);
	return map;
}

function nearestTargetAssignment(
	node: SemanticAstNodeRecord,
	nodeById: ReadonlyMap<string, SemanticAstNodeRecord>,
	assignmentByTargetId: ReadonlyMap<string, SemanticAssignmentRecord>
): SemanticAssignmentRecord | null {
	let current: SemanticAstNodeRecord | undefined = node;
	const seen = new Set<string>();
	while (current !== undefined) {
		if (seen.has(current.id)) throw new Error('AST ancestry contains a cycle.');
		seen.add(current.id);
		const assignment = assignmentByTargetId.get(current.id);
		if (assignment !== undefined) return assignment;
		current = current.parentId === null ? undefined : nodeById.get(current.parentId);
	}
	return null;
}

function inTypePosition(
	node: SemanticAstNodeRecord,
	nodeById: ReadonlyMap<string, SemanticAstNodeRecord>
): boolean {
	let current: SemanticAstNodeRecord | undefined = node;
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

function inUnmodeledWriteContext(
	node: SemanticAstNodeRecord,
	nodeById: ReadonlyMap<string, SemanticAstNodeRecord>
): boolean {
	let current: SemanticAstNodeRecord | undefined = node;
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

function assignmentAccessKind(assignment: SemanticAssignmentRecord): ReadWriteAccessKind {
	if (
		assignment.assignmentKind === 'PREFIX_UPDATE' ||
		assignment.assignmentKind === 'POSTFIX_UPDATE'
	)
		return 'READ_WRITE';
	if (
		assignment.assignmentKind === 'BINARY' &&
		assignment.operatorKind !== ts.SyntaxKind.EqualsToken
	)
		return 'READ_WRITE';
	return 'WRITE';
}

function targetKind(
	target: SemanticAstNodeRecord,
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

function isWriteReference(
	reference: SemanticReferenceRecord,
	node: SemanticAstNodeRecord,
	target: SemanticAstNodeRecord
): boolean {
	if (
		(target.kind === ts.SyntaxKind.Identifier || target.kind === ts.SyntaxKind.PrivateIdentifier) &&
		node.id === target.id
	)
		return true;
	return (
		(target.kind === ts.SyntaxKind.PropertyAccessExpression ||
			target.kind === ts.SyntaxKind.ElementAccessExpression) &&
		node.parentId === target.id &&
		reference.role === 'MEMBER_NAME'
	);
}

function referenceProvenance(
	reference: SemanticReferenceRecord,
	symbol: SemanticSymbolRecord,
	source: SemanticSourceRecord
): SemanticProvenanceId[] {
	return sortedUnique([
		reference.resolutionProvenanceId,
		reference.structuralProvenanceId,
		symbol.provenanceId,
		source.provenanceId,
		...(source.syntaxProvenanceId === null ? [] : [source.syntaxProvenanceId])
	]);
}

function declarationProvenance(
	declaration: SemanticDeclarationRecord,
	symbol: SemanticSymbolRecord,
	source: SemanticSourceRecord
): SemanticProvenanceId[] {
	return sortedUnique([
		declaration.bindingProvenanceId,
		declaration.structuralProvenanceId,
		symbol.provenanceId,
		source.provenanceId,
		...(source.syntaxProvenanceId === null ? [] : [source.syntaxProvenanceId])
	]);
}

function sourceLocation(node: SemanticAstNodeRecord) {
	return [{ end: node.end, sourceId: node.sourceId, start: node.start }] as const;
}

function makeIndexes(
	nodes: readonly ReadWriteAccessGraphNode[],
	edges: readonly ReadWriteAccessGraphEdge[],
	direction: 'FORWARD' | 'REVERSE'
): ReadWriteAccessGraphIndexEntry[] {
	const grouped = new Map<ReadWriteAccessGraphNodeId, ReadWriteAccessGraphEdge['id'][]>(
		nodes.map((node) => [node.id, []])
	);
	for (const edge of edges) {
		const nodeId = direction === 'FORWARD' ? edge.source.nodeId : edge.target.nodeId;
		const list = grouped.get(nodeId);
		if (list === undefined) throw new Error('Graph index endpoint is dangling.');
		list.push(edge.id);
	}
	return [...grouped.entries()]
		.map(([nodeId, edgeIds]) => ({ nodeId, edgeIds: edgeIds.sort(compareText) }))
		.sort((left, right) => compareText(left.nodeId, right.nodeId));
}

function enforceBudgets(
	request: BuildReadWriteAccessGraphRequest,
	accesses: number,
	edges: number,
	frontiers: number,
	nodes: number
): void {
	const values = [
		['maxAccesses', accesses, request.budgets.maxAccesses],
		['maxEdges', edges, request.budgets.maxEdges],
		['maxFrontiers', frontiers, request.budgets.maxFrontiers],
		['maxNodes', nodes, request.budgets.maxNodes]
	] as const;
	for (const [name, actual, maximum] of values)
		if (actual > maximum) throw new RangeError(`${name} exceeded: ${actual} > ${maximum}.`);
}

export function buildReadWriteAccessGraph(
	requestInput: BuildReadWriteAccessGraphRequest,
	snapshot: StaticSemanticSnapshot
): ReadWriteAccessGraphBuildOutcome {
	let request: BuildReadWriteAccessGraphRequest;
	try {
		request = materializeRequest(requestInput);
	} catch (error) {
		return unavailable(
			'REQUEST_INVALID',
			error instanceof Error ? error.message : 'Read/write access graph request is invalid.',
			'REQUEST'
		);
	}
	try {
		if (request.semanticSnapshotId !== snapshot.id)
			return unavailable(
				'SEMANTIC_SNAPSHOT_ID_MISMATCH',
				'Request semanticSnapshotId does not match the supplied snapshot.',
				'REQUEST'
			);
		if (request.subjectId !== snapshot.subjectId)
			return unavailable(
				'SUBJECT_ID_MISMATCH',
				'Request subjectId does not match the supplied snapshot.',
				'REQUEST'
			);
		for (const capability of ['TS_SYNTAX', 'TS_SYMBOL'] as const) {
			if (
				!snapshot.capabilities.some(
					(entry) => entry.capability === capability && entry.state !== 'UNSUPPORTED'
				)
			)
				return unavailable(
					'SEMANTIC_CAPABILITY_UNAVAILABLE',
					`${capability} is unavailable in the supplied semantic snapshot.`,
					'REQUEST'
				);
		}
		const nodeById = mapUnique('AST node', snapshot.astNodes);
		const sourceById = mapUnique('source', snapshot.sources);
		const symbolById = mapUnique('symbol', snapshot.symbols);
		mapUnique('reference', snapshot.references);
		const declarationById = mapUnique('declaration', snapshot.declarations);
		const provenanceBySource = new Map<string, SemanticProvenanceId[]>();
		for (const provenance of snapshot.provenances) {
			if (provenance.sourceId === null) continue;
			const records = provenanceBySource.get(provenance.sourceId);
			if (records === undefined) provenanceBySource.set(provenance.sourceId, [provenance.id]);
			else records.push(provenance.id);
		}
		for (const node of snapshot.astNodes)
			if (node.parentId !== null && !nodeById.has(node.parentId))
				throw new Error(`AST node ${node.id} has a dangling parent.`);

		const assignmentByTargetId = new Map<string, SemanticAssignmentRecord>();
		for (const assignment of snapshot.assignments) {
			if (!nodeById.has(assignment.nodeId) || !nodeById.has(assignment.targetNodeId))
				throw new Error(`Assignment ${assignment.nodeId} has a dangling semantic node.`);
			if (assignmentByTargetId.has(assignment.targetNodeId))
				throw new Error(`Assignment target ${assignment.targetNodeId} is not unique.`);
			assignmentByTargetId.set(assignment.targetNodeId, assignment);
		}

		const declarationsByAssignment = new Map<string, SemanticDeclarationRecord[]>();
		const candidateById = mapUnique('declaration candidate', snapshot.declarationCandidates);
		for (const declaration of snapshot.declarations) {
			if (declaration.nodeId === null) continue;
			const node = nodeById.get(declaration.nodeId);
			if (node === undefined) throw new Error(`Declaration ${declaration.id} has a dangling node.`);
			const candidate =
				declaration.candidateId === null ? undefined : candidateById.get(declaration.candidateId);
			const nameNode =
				candidate?.nameNodeId === null || candidate?.nameNodeId === undefined
					? node
					: nodeById.get(candidate.nameNodeId);
			if (nameNode === undefined)
				throw new Error(`Declaration ${declaration.id} has a dangling candidate name node.`);
			const assignment = nearestTargetAssignment(nameNode, nodeById, assignmentByTargetId);
			if (assignment === null) continue;
			const list = declarationsByAssignment.get(assignment.nodeId);
			if (list === undefined) declarationsByAssignment.set(assignment.nodeId, [declaration]);
			else list.push(declaration);
		}

		const assignmentTargetKinds = new Map<
			string,
			'DYNAMIC_ELEMENT' | 'SUPPORTED' | 'UNSUPPORTED'
		>();
		for (const assignment of snapshot.assignments) {
			const target = nodeById.get(assignment.targetNodeId)!;
			assignmentTargetKinds.set(
				assignment.nodeId,
				targetKind(target, (declarationsByAssignment.get(assignment.nodeId)?.length ?? 0) > 0)
			);
		}

		const accesses: AccessSpec[] = [];
		const frontiers: FrontierSpec[] = [];
		const addAccess = (access: AccessSpec): void => {
			accesses.push(access);
			if (accesses.length > request.budgets.maxAccesses)
				throw new RangeError(
					`maxAccesses exceeded: ${accesses.length} > ${request.budgets.maxAccesses}.`
				);
		};
		const addFrontier = (frontier: FrontierSpec): void => {
			frontiers.push(frontier);
			if (frontiers.length > request.budgets.maxFrontiers)
				throw new RangeError(
					`maxFrontiers exceeded: ${frontiers.length} > ${request.budgets.maxFrontiers}.`
				);
		};
		const representedAssignments = new Set<string>();
		let discoveredCandidateReferences = 0;
		let representedReferences = 0;
		let frontierReferences = 0;
		let excludedTypePositionReferences = 0;

		for (const reference of snapshot.references) {
			if (!ACCESS_REFERENCE_ROLES.has(reference.role)) continue;
			discoveredCandidateReferences += 1;
			const node = nodeById.get(reference.nodeId);
			const source = sourceById.get(reference.sourceId);
			if (node === undefined || source === undefined)
				throw new Error(`Reference ${reference.id} is dangling.`);
			const assignment = nearestTargetAssignment(node, nodeById, assignmentByTargetId);
			if (inTypePosition(node, nodeById)) {
				excludedTypePositionReferences += 1;
				addFrontier({
					assignment,
					frontierKind: 'TYPE_POSITION_EXCLUDED',
					node,
					provenanceIds: sortedUnique([
						reference.resolutionProvenanceId,
						reference.structuralProvenanceId
					]),
					reason: 'Type-position reference is excluded from runtime access classification.',
					reference,
					source
				});
				continue;
			}
			if (inUnmodeledWriteContext(node, nodeById)) {
				frontierReferences += 1;
				addFrontier({
					assignment,
					frontierKind: 'UNSUPPORTED_REFERENCE',
					node,
					provenanceIds: sortedUnique([
						reference.resolutionProvenanceId,
						reference.structuralProvenanceId
					]),
					reason:
						'Reference occurs in a write-capable syntax form outside the normalized assignment taxonomy.',
					reference,
					source
				});
				continue;
			}
			if (assignment !== null && assignmentTargetKinds.get(assignment.nodeId) === 'UNSUPPORTED') {
				frontierReferences += 1;
				addFrontier({
					assignment,
					frontierKind: 'UNSUPPORTED_ASSIGNMENT_TARGET',
					node,
					provenanceIds: sortedUnique([
						reference.resolutionProvenanceId,
						reference.structuralProvenanceId
					]),
					reason: 'Reference occurs inside an assignment target shape outside this bounded method.',
					reference,
					source
				});
				continue;
			}
			const symbolId = reference.resolvedSymbolId ?? reference.symbolId;
			const symbol = symbolId === null ? undefined : symbolById.get(symbolId);
			if (
				symbol === undefined ||
				reference.scopeLinkState !== 'RESOLVED' ||
				(reference.resolutionState !== 'RESOLVED_DIRECT' &&
					reference.resolutionState !== 'RESOLVED_ALIAS')
			) {
				frontierReferences += 1;
				addFrontier({
					assignment,
					frontierKind:
						reference.resolutionState === 'UNSUPPORTED'
							? 'UNSUPPORTED_REFERENCE'
							: 'UNRESOLVED_REFERENCE',
					node,
					provenanceIds: sortedUnique([
						reference.resolutionProvenanceId,
						reference.structuralProvenanceId
					]),
					reason:
						reference.scopeLinkState === 'RESOLVED'
							? 'Reference does not resolve to a retained Program-local symbol slot.'
							: 'Reference scope linkage is unsupported and cannot establish a supported access.',
					reference,
					source
				});
				continue;
			}
			let accessKind: ReadWriteAccessKind = 'READ';
			if (assignment !== null) {
				const target = nodeById.get(assignment.targetNodeId)!;
				if (isWriteReference(reference, node, target)) {
					accessKind = assignmentAccessKind(assignment);
					representedAssignments.add(assignment.nodeId);
				}
			}
			addAccess({ accessKind, assignment, declaration: null, node, reference, source, symbol });
			representedReferences += 1;
		}

		for (const assignment of snapshot.assignments) {
			const declarations = declarationsByAssignment.get(assignment.nodeId) ?? [];
			for (const declaration of declarations) {
				if (declaration.symbolId === null || declaration.symbolBindingState !== 'RESOLVED')
					continue;
				const symbol = symbolById.get(declaration.symbolId);
				const candidate =
					declaration.candidateId === null ? undefined : candidateById.get(declaration.candidateId);
				const node =
					candidate?.nameNodeId === null || candidate?.nameNodeId === undefined
						? declaration.nodeId === null
							? undefined
							: nodeById.get(declaration.nodeId)
						: nodeById.get(candidate.nameNodeId);
				const source = sourceById.get(declaration.sourceId);
				if (symbol === undefined || node === undefined || source === undefined)
					throw new Error(`Assignment declaration ${declaration.id} is dangling.`);
				addAccess({
					accessKind: assignmentAccessKind(assignment),
					assignment,
					declaration,
					node,
					reference: null,
					source,
					symbol
				});
				representedAssignments.add(assignment.nodeId);
			}
		}

		for (const assignment of snapshot.assignments) {
			if (representedAssignments.has(assignment.nodeId)) continue;
			const target = nodeById.get(assignment.targetNodeId)!;
			const source = sourceById.get(target.sourceId);
			if (source === undefined)
				throw new Error(`Assignment ${assignment.nodeId} source is dangling.`);
			const kind = assignmentTargetKinds.get(assignment.nodeId);
			addFrontier({
				assignment,
				frontierKind:
					kind === 'DYNAMIC_ELEMENT'
						? 'DYNAMIC_ELEMENT_WRITE_TARGET'
						: 'UNSUPPORTED_ASSIGNMENT_TARGET',
				node: target,
				provenanceIds: sortedUnique(provenanceBySource.get(source.id) ?? []),
				reason:
					kind === 'DYNAMIC_ELEMENT'
						? 'Computed element assignment has no compiler-resolved member slot.'
						: 'Assignment target has no supported resolved write slot.',
				reference: null,
				source
			});
		}

		const graphInputDigest = readWriteAccessGraphInputDigest(snapshot);
		const graphId = readWriteAccessGraphId({
			canonicalProfile: READ_WRITE_ACCESS_GRAPH_CANONICAL_PROFILE,
			graphInputDigest,
			method: READ_WRITE_ACCESS_GRAPH_METHOD,
			operationVersion: READ_WRITE_ACCESS_GRAPH_OPERATION_VERSION,
			schemaVersion: READ_WRITE_ACCESS_GRAPH_SCHEMA_VERSION,
			semanticSnapshotId: snapshot.id,
			subjectId: snapshot.subjectId
		});
		const layerId = readWriteAccessGraphLayerId(graphId);
		const symbolsUsed = new Map<SemanticSymbolId, SemanticSymbolRecord>();
		for (const access of accesses) symbolsUsed.set(access.symbol.id, access.symbol);
		const projectedEdges = accesses.reduce(
			(total, access) => total + (access.accessKind === 'READ_WRITE' ? 2 : 1),
			0
		);
		enforceBudgets(
			request,
			accesses.length,
			projectedEdges,
			frontiers.length,
			accesses.length + frontiers.length + symbolsUsed.size
		);
		const symbolNodes: ReadWriteSymbolSlotNode[] = [...symbolsUsed.values()]
			.map((symbol) => ({
				declarationIds: [...symbol.declarationIds].sort(compareText),
				epistemic: 'SUPPORTED' as const,
				graphId,
				id: readWriteAccessSymbolNodeId(graphId, symbol.id),
				kind: 'SYMBOL_SLOT' as const,
				layerId,
				name: symbol.name,
				programId: symbol.programId,
				projectId: symbol.projectId,
				provenanceIds: [symbol.provenanceId],
				semanticSnapshotId: snapshot.id,
				sourceLocations: symbol.declarationIds
					.map((id) => declarationById.get(id))
					.filter((entry): entry is SemanticDeclarationRecord => entry !== undefined)
					.map((entry) => ({ end: entry.end, sourceId: entry.sourceId, start: entry.start }))
					.sort(
						(left, right) => compareText(left.sourceId, right.sourceId) || left.start - right.start
					),
				subjectId: snapshot.subjectId,
				symbolId: symbol.id
			}))
			.sort((left, right) => compareText(left.id, right.id));
		const slotIdBySymbol = new Map(symbolNodes.map((node) => [node.symbolId, node.id]));

		const accessNodes: ReadWriteAccessOccurrenceNode[] = accesses
			.map((access): ReadWriteAccessOccurrenceNode => {
				const provenanceIds =
					access.reference === null
						? declarationProvenance(access.declaration!, access.symbol, access.source)
						: referenceProvenance(access.reference, access.symbol, access.source);
				return {
					accessKind: access.accessKind,
					assignmentNodeId: access.assignment?.nodeId ?? null,
					declarationId: access.declaration?.id ?? null,
					epistemic: 'SUPPORTED' as const,
					graphId,
					id: readWriteAccessOccurrenceNodeId(graphId, {
						declarationId: access.declaration?.id ?? null,
						referenceId: access.reference?.id ?? null
					}),
					kind: 'ACCESS_OCCURRENCE' as const,
					layerId,
					occurrenceKind: access.reference === null ? 'ASSIGNMENT_DECLARATION_TARGET' : 'REFERENCE',
					occurrenceNodeId: access.node.id,
					provenanceIds,
					referenceId: access.reference?.id ?? null,
					semanticSnapshotId: snapshot.id,
					slotNodeId: slotIdBySymbol.get(access.symbol.id)!,
					sourceId: access.source.id,
					sourceLocations: sourceLocation(access.node),
					subjectId: snapshot.subjectId,
					symbolId: access.symbol.id
				};
			})
			.sort((left, right) => compareText(left.id, right.id));
		if (new Set(accessNodes.map((node) => node.id)).size !== accessNodes.length)
			throw new Error('Read/write access occurrence identity collision.');

		const frontierNodes: ReadWriteAccessFrontierNode[] = frontiers
			.map((frontier): ReadWriteAccessFrontierNode => ({
				assignmentNodeId: frontier.assignment?.nodeId ?? null,
				epistemic: frontier.frontierKind === 'TYPE_POSITION_EXCLUDED' ? 'UNSUPPORTED' : 'UNKNOWN',
				frontierKind: frontier.frontierKind,
				graphId,
				id: readWriteAccessFrontierNodeId(graphId, {
					assignmentNodeId: frontier.assignment?.nodeId ?? null,
					frontierKind: frontier.frontierKind,
					occurrenceNodeId: frontier.node.id,
					referenceId: frontier.reference?.id ?? null
				}),
				kind: 'FRONTIER' as const,
				layerId,
				occurrenceNodeId: frontier.node.id,
				provenanceIds: frontier.provenanceIds,
				reason: frontier.reason,
				referenceId: frontier.reference?.id ?? null,
				semanticSnapshotId: snapshot.id,
				sourceId: frontier.source.id,
				sourceLocations: sourceLocation(frontier.node),
				subjectId: snapshot.subjectId
			}))
			.sort((left, right) => compareText(left.id, right.id));
		if (new Set(frontierNodes.map((node) => node.id)).size !== frontierNodes.length)
			throw new Error('Read/write frontier identity collision.');

		const nodes: ReadWriteAccessGraphNode[] = [
			...accessNodes,
			...frontierNodes,
			...symbolNodes
		].sort((left, right) => compareText(left.id, right.id));
		if (new Set(nodes.map((node) => node.id)).size !== nodes.length)
			throw new Error('Read/write graph node identity collision.');
		const edges: ReadWriteAccessGraphEdge[] = accessNodes
			.flatMap((access) => {
				const relations: ReadWriteAccessGraphEdge['relationKind'][] =
					access.accessKind === 'READ_WRITE'
						? ['READS', 'WRITES']
						: [access.accessKind === 'READ' ? 'READS' : 'WRITES'];
				return relations.map((relationKind) => {
					const source = { kind: 'ACCESS_OCCURRENCE' as const, nodeId: access.id };
					const target = { kind: 'SYMBOL_SLOT' as const, nodeId: access.slotNodeId };
					return {
						accessNodeId: access.id,
						epistemic: 'SUPPORTED' as const,
						graphId,
						id: readWriteAccessEdgeId({ graphId, relationKind, source, target }),
						layerId,
						method: READ_WRITE_ACCESS_GRAPH_METHOD,
						provenanceIds: access.provenanceIds,
						relationKind,
						semanticSnapshotId: snapshot.id,
						source,
						sourceLocations: access.sourceLocations,
						subjectId: snapshot.subjectId,
						target
					};
				});
			})
			.sort((left, right) => compareText(left.id, right.id));
		if (new Set(edges.map((edge) => edge.id)).size !== edges.length)
			throw new Error('Read/write graph edge identity collision.');

		enforceBudgets(request, accessNodes.length, edges.length, frontierNodes.length, nodes.length);
		const coverage: ReadWriteAccessGraphCoverage = {
			accessOccurrences: accessNodes.length,
			closure: 'OPEN',
			discoveredAssignments: snapshot.assignments.length,
			discoveredCandidateReferences,
			edges: edges.length,
			excludedTypePositionReferences,
			frontierAssignments: snapshot.assignments.length - representedAssignments.size,
			frontierNodes: frontierNodes.length,
			frontierReferences,
			readAccesses: accessNodes.filter((node) => node.accessKind === 'READ').length,
			readWriteAccesses: accessNodes.filter((node) => node.accessKind === 'READ_WRITE').length,
			reconciles:
				discoveredCandidateReferences ===
					representedReferences + frontierReferences + excludedTypePositionReferences &&
				snapshot.assignments.length ===
					representedAssignments.size + (snapshot.assignments.length - representedAssignments.size),
			representedAssignmentTargets: representedAssignments.size,
			representedReferences,
			symbolSlots: symbolNodes.length,
			writeAccesses: accessNodes.filter((node) => node.accessKind === 'WRITE').length
		};
		if (!coverage.reconciles) throw new Error('Read/write access coverage does not reconcile.');
		const provenanceIds = sortedUnique(
			nodes
				.flatMap((node) => node.provenanceIds)
				.concat(edges.flatMap((edge) => edge.provenanceIds))
		);
		const graphLimitations = LIMITATIONS.map((limitation) => ({ ...limitation }));
		const layerLimitations = LIMITATIONS.map((limitation) => ({ ...limitation }));
		const layer = {
			capability: READ_WRITE_ACCESS_GRAPH_CAPABILITY,
			capabilityStatus: READ_WRITE_ACCESS_GRAPH_CAPABILITY_STATUS,
			coverage,
			edgeIds: edges.map((edge) => edge.id),
			graphId,
			id: layerId,
			kind: 'TYPESCRIPT_READ_WRITE_ACCESS' as const,
			limitations: layerLimitations,
			method: READ_WRITE_ACCESS_GRAPH_METHOD,
			nodeIds: nodes.map((node) => node.id),
			ordinal: 0 as const,
			producer: { ...snapshot.provider },
			provenanceIds,
			semanticSnapshotId: snapshot.id,
			subjectId: snapshot.subjectId
		};
		const content = {
			canonicalProfile: READ_WRITE_ACCESS_GRAPH_CANONICAL_PROFILE,
			capability: READ_WRITE_ACCESS_GRAPH_CAPABILITY,
			capabilityStatus: READ_WRITE_ACCESS_GRAPH_CAPABILITY_STATUS,
			coverage,
			edges,
			forwardIndex: makeIndexes(nodes, edges, 'FORWARD'),
			fullJanCsaaCapability007DataFlow: FULL_JAN_CSAA_CAPABILITY_007_DATA_FLOW,
			graphInputDigest,
			graphKind: 'TYPESCRIPT_READ_WRITE_ACCESS' as const,
			health: 'PARTIAL' as const,
			id: graphId,
			layers: [layer] as const,
			limitations: graphLimitations,
			method: READ_WRITE_ACCESS_GRAPH_METHOD,
			nodes,
			operationVersion: READ_WRITE_ACCESS_GRAPH_OPERATION_VERSION,
			producer: { ...snapshot.provider },
			reverseIndex: makeIndexes(nodes, edges, 'REVERSE'),
			schemaVersion: READ_WRITE_ACCESS_GRAPH_SCHEMA_VERSION,
			semanticExtractionVersion: snapshot.extractionVersion,
			semanticSchemaVersion: snapshot.schemaVersion,
			semanticSnapshotId: snapshot.id,
			subjectId: snapshot.subjectId
		};
		const graph = { ...content, contentDigest: readWriteAccessGraphContentDigest(content) };
		const validation = validateConstructedReadWriteAccessGraph(graph, snapshot, graphInputDigest, {
			maxIssues: 1_000,
			maxRecords: snapshot.budgets.maxSnapshotBytes,
			maxStringCharacters: snapshot.budgets.maxSnapshotBytes
		});
		if (validation.state !== 'VALID') {
			const issue = validation.issues[0];
			return unavailable(
				'GRAPH_VALIDATION_FAILED',
				issue === undefined
					? 'Read/write access graph validation failed without a diagnostic.'
					: `Read/write access graph validation failed: ${issue.message}`,
				'VALIDATE',
				issue?.path ?? null
			);
		}
		return {
			diagnostics: [
				diagnostic(
					'GRAPH_PARTIAL',
					'Read/write access facts are partial and do not claim control flow or JAN-CSAA-CAP-007 data flow.',
					'CLASSIFY'
				)
			],
			graph,
			outcome: 'partial'
		};
	} catch (error) {
		return unavailable(
			error instanceof RangeError ? 'BUDGET_EXCEEDED' : 'UNSAFE_SEMANTIC_INPUT',
			error instanceof Error
				? `Read/write access projection failed closed: ${error.message}`
				: 'Read/write access projection failed closed.',
			'CLASSIFY'
		);
	}
}
