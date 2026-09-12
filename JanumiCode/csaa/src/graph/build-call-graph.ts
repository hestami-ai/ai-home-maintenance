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
	type CallGraphId,
	type CallGraphIndexEntry,
	type CallGraphLayer,
	type CallGraphLayerId,
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
	type SemanticSymbolRecord,
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

/**
 * Reproduces the default `Array#sort` ordering (UTF-16 code-unit comparison)
 * as an explicit comparator. Locale-aware comparison is deliberately avoided:
 * every ordering produced here is content-fingerprinted.
 */
function compareText(left: string, right: string): number {
	return Number(left > right) - Number(left < right);
}

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
	.sort(compareText)
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
				'Compiler-resolved signatures plus a retained inline implementation support exact inline targets; other dispatch remains open.',
			state: 'PARTIAL'
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
).sort((left, right) => compareText(left.lane, right.lane));

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

export interface CallGraphProjectionBudgets {
	readonly maxClassificationSteps: number;
	readonly maxEdges: number;
	readonly maxLimitations: number;
	readonly maxNodes: number;
}

export interface BuildCallGraphOptions {
	/** Operational materialization limits; excluded from graph content and identity. */
	readonly budgets: CallGraphProjectionBudgets;
}

export interface BoundedCallGraphBuildDiagnostic extends Omit<CallGraphBuildDiagnostic, 'code'> {
	readonly code: CallGraphBuildDiagnostic['code'] | 'BUDGET_EXCEEDED';
}

export type BoundedCallGraphBuildOutcome =
	| {
			readonly diagnostics: readonly BoundedCallGraphBuildDiagnostic[];
			readonly graph: CallGraphSnapshot;
			readonly outcome: 'complete' | 'partial';
	  }
	| {
			readonly diagnostics: readonly BoundedCallGraphBuildDiagnostic[];
			readonly graph?: never;
			readonly outcome: 'unavailable';
	  };

class CallGraphClassificationBudgetError extends RangeError {
	readonly code = 'BUDGET_EXCEEDED';
	readonly path = '$options.budgets.maxClassificationSteps';
}

class CallGraphCandidateEdgeBudgetError extends RangeError {
	constructor(readonly minimumTargetCount: number) {
		super('Call graph candidate target population exceeds the remaining edge budget.');
	}
}

class ClassificationStepBudget {
	private used = 0;

	constructor(private readonly maximum: number | null) {}

	consume(count = 1): void {
		if (!Number.isSafeInteger(count) || count < 0)
			throw new Error('Call graph classification step count is invalid.');
		if (count > Number.MAX_SAFE_INTEGER - this.used)
			throw new CallGraphClassificationBudgetError(
				'Call graph classification steps exceed the safe-integer range.'
			);
		this.used += count;
		if (this.maximum !== null && this.used > this.maximum)
			throw new CallGraphClassificationBudgetError(
				`Call graph classification steps exceed maxClassificationSteps ${String(this.maximum)}.`
			);
	}
}

function consumeSortInspections(steps: ClassificationStepBudget, recordCount: number): void {
	if (recordCount <= 1) return;
	const passes = Math.ceil(Math.log2(recordCount));
	if (recordCount > Math.floor(Number.MAX_SAFE_INTEGER / passes))
		throw new CallGraphClassificationBudgetError(
			'Call graph classification sort inspections exceed the safe-integer range.'
		);
	steps.consume(recordCount * passes);
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

function boundedDiagnostic(
	code: BoundedCallGraphBuildDiagnostic['code'],
	message: string,
	phase: BoundedCallGraphBuildDiagnostic['phase'],
	path: string | null = null
): BoundedCallGraphBuildDiagnostic {
	return { code, message, path, phase };
}

function boundedUnavailable(
	code: BoundedCallGraphBuildDiagnostic['code'],
	message: string,
	phase: BoundedCallGraphBuildDiagnostic['phase'],
	path: string | null = null
): BoundedCallGraphBuildOutcome {
	return { diagnostics: [boundedDiagnostic(code, message, phase, path)], outcome: 'unavailable' };
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
	const actual = (keys as string[]).sort(compareText);
	const expected = [...REQUEST_KEYS].sort(compareText);
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

function exactDataRecord(
	value: unknown,
	expectedKeys: readonly string[],
	label: string
): Readonly<Record<string, unknown>> {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		throw new TypeError(`${label} must be a plain data object.`);
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new TypeError(`${label} must have a plain prototype.`);
	const keys = Reflect.ownKeys(value);
	if (
		keys.some((key) => typeof key !== 'string') ||
		keys.length !== expectedKeys.length ||
		expectedKeys.some((key) => !keys.includes(key))
	)
		throw new TypeError(`${label} has an invalid field set.`);
	const result: Record<string, unknown> = {};
	for (const key of expectedKeys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new TypeError(`${label}.${key} must be enumerable data.`);
		result[key] = descriptor.value;
	}
	return result;
}

function positiveSafeInteger(value: unknown, label: string): number {
	if (
		typeof value !== 'number' ||
		!Number.isSafeInteger(value) ||
		Object.is(value, -0) ||
		value <= 0
	)
		throw new TypeError(`${label} must be a positive safe integer.`);
	return value;
}

function materializeBuildOptions(value: unknown): BuildCallGraphOptions | null {
	if (value === undefined) return null;
	const options = exactDataRecord(value, ['budgets'], 'Call graph build options');
	const budgets = exactDataRecord(
		options.budgets,
		['maxClassificationSteps', 'maxEdges', 'maxLimitations', 'maxNodes'],
		'Call graph projection budgets'
	);
	return {
		budgets: {
			maxClassificationSteps: positiveSafeInteger(
				budgets.maxClassificationSteps,
				'budgets.maxClassificationSteps'
			),
			maxEdges: positiveSafeInteger(budgets.maxEdges, 'budgets.maxEdges'),
			maxLimitations: positiveSafeInteger(budgets.maxLimitations, 'budgets.maxLimitations'),
			maxNodes: positiveSafeInteger(budgets.maxNodes, 'budgets.maxNodes')
		}
	};
}

function compareId(left: { readonly id: string }, right: { readonly id: string }): number {
	return compareText(left.id, right.id);
}

function sortedUnique<T extends string>(values: Iterable<T>): T[] {
	return [...new Set(values)].sort(compareText);
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
	const exactCount = classifications.filter(
		(classification) => classification.resolutionClass === 'EXACT'
	).length;
	const allUnsupported = classifications.every(
		(classification) => classification.resolutionClass === 'UNSUPPORTED'
	);
	let inferenceState: CallGraphEpistemicState['inferenceState'];
	if (exactCount === classifications.length) inferenceState = 'NONE';
	else if (candidateCount === 0 && exactCount === 0) inferenceState = 'UNRESOLVED';
	else if (candidateCount === classifications.length) inferenceState = 'CANDIDATE';
	else inferenceState = 'MIXED';
	let supportBasis: CallGraphEpistemicState['supportBasis'];
	if (candidateCount > 0) supportBasis = 'COMPILER_BOUND_STATIC_CANDIDATE';
	else if (exactCount > 0) supportBasis = 'COMPILER_CONFIRMED';
	else if (allUnsupported) supportBasis = 'UNSUPPORTED';
	else supportBasis = 'NO_TARGET_EVIDENCE';
	return {
		capabilityCoverage: 'PARTIAL',
		conflictState: 'NOT_EVALUATED',
		executionHealth: 'PARTIAL',
		freshness: 'SNAPSHOT_BOUND',
		inferenceState,
		supportBasis
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
		.map(([nodeId, edgeIds]) => {
			const sortedEdgeIds = [...edgeIds].sort(compareText);
			return { edgeIds: sortedEdgeIds, nodeId };
		})
		.sort((left, right) => compareText(left.nodeId, right.nodeId));
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
	return compareText(leftKey, rightKey);
}

function partialDiagnostics(
	limitations: readonly CallGraphLimitation[]
): readonly CallGraphBuildDiagnostic[] {
	const counts = new Map<CallGraphLimitationKind, number>();
	for (const entry of limitations) counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);
	return [...counts.entries()]
		.sort(([left], [right]) => compareText(left, right))
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

type PopulationCount = readonly [string, number, number];

function capabilityRejection(snapshot: StaticSemanticSnapshot): CallGraphBuildOutcome | null {
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
	return null;
}

function requestRejection(
	requestValue: unknown,
	snapshot: StaticSemanticSnapshot
): CallGraphBuildOutcome | null {
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
	return capabilityRejection(snapshot);
}

function assertUniquePopulations(populations: readonly PopulationCount[]): void {
	for (const [name, size, length] of populations)
		if (size !== length) throw new Error(`The semantic ${name} population contains duplicate IDs.`);
}

function buildChildrenByParent(
	snapshot: StaticSemanticSnapshot,
	nodeById: Map<SemanticAstNodeRecord['id'], SemanticAstNodeRecord>,
	sourceById: Map<SemanticSourceRecord['id'], SemanticSourceRecord>
): Map<SemanticAstNodeRecord['id'], SemanticAstNodeRecord[]> {
	const childrenByParent = new Map<SemanticAstNodeRecord['id'], SemanticAstNodeRecord[]>();
	for (const node of snapshot.astNodes) {
		if (!sourceById.has(node.sourceId))
			throw new Error(`AST node ${node.id} has a missing source.`);
		if (node.parentId !== null) {
			const parent = nodeById.get(node.parentId);
			// S6582 REFUSED: `undefined !== undefined` is FALSE, so the optional chain stops refusing
			// exactly when the referring record's own sourceId is also missing — a dangling parent would
			// be grouped under a non-existent id and silently dropped instead of failing closed.
			if (parent === undefined || parent.sourceId !== node.sourceId)
				throw new Error(`AST node ${node.id} has an invalid parent.`);
			addGrouped(childrenByParent, node.parentId, node);
		}
	}
	for (const children of childrenByParent.values()) children.sort(compareId);
	return childrenByParent;
}

function buildDeclarationsByNode(
	snapshot: StaticSemanticSnapshot,
	nodeById: Map<SemanticAstNodeRecord['id'], SemanticAstNodeRecord>,
	sourceById: Map<SemanticSourceRecord['id'], SemanticSourceRecord>,
	symbolById: Map<SemanticSymbolId, SemanticSymbolRecord>
): Map<SemanticAstNodeRecord['id'], SemanticDeclarationRecord[]> {
	const declarationsByNode = new Map<SemanticAstNodeRecord['id'], SemanticDeclarationRecord[]>();
	for (const declaration of snapshot.declarations) {
		if (!sourceById.has(declaration.sourceId))
			throw new Error(`Declaration ${declaration.id} has a missing source.`);
		if (declaration.nodeId !== null) {
			const node = nodeById.get(declaration.nodeId);
			// S6582 REFUSED — see above: both-undefined must still refuse.
			if (node === undefined || node.sourceId !== declaration.sourceId)
				throw new Error(`Declaration ${declaration.id} has an invalid node.`);
			addGrouped(declarationsByNode, declaration.nodeId, declaration);
		}
		if (declaration.symbolId !== null && !symbolById.has(declaration.symbolId))
			throw new Error(`Declaration ${declaration.id} has a missing symbol.`);
	}
	return declarationsByNode;
}

function assertSymbolDeclarations(
	snapshot: StaticSemanticSnapshot,
	declarationById: Map<SemanticDeclarationId, SemanticDeclarationRecord>
): void {
	for (const symbol of snapshot.symbols)
		for (const declarationId of symbol.declarationIds)
			if (!declarationById.has(declarationId))
				throw new Error(`Symbol ${symbol.id} has a missing declaration.`);
}

function buildReferencesByNode(
	snapshot: StaticSemanticSnapshot,
	nodeById: Map<SemanticAstNodeRecord['id'], SemanticAstNodeRecord>,
	symbolById: Map<SemanticSymbolId, SemanticSymbolRecord>
): Map<SemanticAstNodeRecord['id'], SemanticReferenceRecord[]> {
	const referencesByNode = new Map<SemanticAstNodeRecord['id'], SemanticReferenceRecord[]>();
	for (const reference of snapshot.references) {
		const node = nodeById.get(reference.nodeId);
		// S6582 REFUSED — see above: both-undefined must still refuse.
		if (node === undefined || node.sourceId !== reference.sourceId)
			throw new Error(`Reference ${reference.id} has an invalid node.`);
		if (reference.resolvedSymbolId !== null && !symbolById.has(reference.resolvedSymbolId))
			throw new Error(`Reference ${reference.id} has a missing resolved symbol.`);
		addGrouped(referencesByNode, reference.nodeId, reference);
	}
	for (const references of referencesByNode.values()) references.sort(compareId);
	return referencesByNode;
}

function declaredSymbolIds(
	declarations: readonly SemanticDeclarationRecord[]
): Set<SemanticSymbolId> {
	return new Set(
		declarations.flatMap((declaration) =>
			declaration.symbolId === null ? [] : [declaration.symbolId]
		)
	);
}

function buildCallableSpecs(
	snapshot: StaticSemanticSnapshot,
	sourceById: Map<SemanticSourceRecord['id'], SemanticSourceRecord>,
	childrenByParent: Map<SemanticAstNodeRecord['id'], SemanticAstNodeRecord[]>,
	declarationsByNode: Map<SemanticAstNodeRecord['id'], SemanticDeclarationRecord[]>
): Map<SemanticAstNodeRecord['id'], CallableSpec> {
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
			symbolIds: declaredSymbolIds(declarations)
		});
	}
	return callableSpecsByNode;
}

function mergeClassDeclarations(
	spec: CallableSpec,
	classDeclarations: readonly SemanticDeclarationRecord[]
): void {
	for (const declaration of classDeclarations) {
		spec.declarationIds.add(declaration.id);
		if (declaration.symbolId !== null) spec.symbolIds.add(declaration.symbolId);
	}
}

// A class symbol denotes its explicit constructor when one exists. Otherwise
// the class node itself is the explicit frontier anchor for an implicit constructor.
function mergeClassSymbols(
	snapshot: StaticSemanticSnapshot,
	callableSpecsByNode: Map<SemanticAstNodeRecord['id'], CallableSpec>,
	childrenByParent: Map<SemanticAstNodeRecord['id'], SemanticAstNodeRecord[]>,
	declarationsByNode: Map<SemanticAstNodeRecord['id'], SemanticDeclarationRecord[]>
): void {
	for (const node of snapshot.astNodes) {
		if (node.kind !== ts.SyntaxKind.ClassDeclaration && node.kind !== ts.SyntaxKind.ClassExpression)
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
		mergeClassDeclarations(spec, classDeclarations);
	}
}

function seedAssignmentReferences(
	spec: CallableSpec,
	assignment: StaticSemanticSnapshot['assignments'][number],
	valueNodeId: SemanticAstNodeRecord['id'],
	references: readonly SemanticReferenceRecord[],
	symbolById: Map<SemanticSymbolId, SemanticSymbolRecord>
): void {
	for (const reference of references) {
		if (reference.resolvedSymbolId === null) continue;
		const symbolId = reference.resolvedSymbolId;
		spec.symbolIds.add(symbolId);
		const associationInputs = spec.assignmentInputIdsBySymbol.get(symbolId) ?? new Set<string>();
		associationInputs.add(assignment.nodeId);
		associationInputs.add(assignment.targetNodeId);
		associationInputs.add(valueNodeId);
		spec.assignmentInputIdsBySymbol.set(symbolId, associationInputs);
		const symbol = symbolById.get(symbolId)!;
		for (const declarationId of symbol.declarationIds) spec.declarationIds.add(declarationId);
	}
}

// Initializer/assignment links seed possible callable values only. They never
// prove exclusivity, no-write, order, or dispatch closure and therefore can
// contribute candidates but cannot produce confirmed edges.
function seedAssignmentSpecs(
	snapshot: StaticSemanticSnapshot,
	callableSpecsByNode: Map<SemanticAstNodeRecord['id'], CallableSpec>,
	referencesByNode: Map<SemanticAstNodeRecord['id'], SemanticReferenceRecord[]>,
	symbolById: Map<SemanticSymbolId, SemanticSymbolRecord>
): void {
	for (const assignment of snapshot.assignments) {
		if (assignment.valueNodeId === null) continue;
		const spec = callableSpecsByNode.get(assignment.valueNodeId);
		if (spec === undefined) continue;
		seedAssignmentReferences(
			spec,
			assignment,
			assignment.valueNodeId,
			referencesByNode.get(assignment.targetNodeId) ?? [],
			symbolById
		);
	}
}

function buildSemanticIndex(snapshot: StaticSemanticSnapshot) {
	const nodeById = new Map(snapshot.astNodes.map((node) => [node.id, node]));
	const sourceById = new Map(snapshot.sources.map((source) => [source.id, source]));
	const referenceById = new Map(snapshot.references.map((reference) => [reference.id, reference]));
	const symbolById = new Map(snapshot.symbols.map((symbol) => [symbol.id, symbol]));
	const declarationById = new Map(
		snapshot.declarations.map((declaration) => [declaration.id, declaration])
	);
	const provenanceIds = new Set(snapshot.provenances.map((record) => record.id));
	assertUniquePopulations([
		['AST node', nodeById.size, snapshot.astNodes.length],
		['source', sourceById.size, snapshot.sources.length],
		['reference', referenceById.size, snapshot.references.length],
		['symbol', symbolById.size, snapshot.symbols.length],
		['declaration', declarationById.size, snapshot.declarations.length],
		['provenance', provenanceIds.size, snapshot.provenances.length]
	] as const);
	const childrenByParent = buildChildrenByParent(snapshot, nodeById, sourceById);
	const declarationsByNode = buildDeclarationsByNode(snapshot, nodeById, sourceById, symbolById);
	assertSymbolDeclarations(snapshot, declarationById);
	const referencesByNode = buildReferencesByNode(snapshot, nodeById, symbolById);
	const callableSpecsByNode = buildCallableSpecs(
		snapshot,
		sourceById,
		childrenByParent,
		declarationsByNode
	);
	mergeClassSymbols(snapshot, callableSpecsByNode, childrenByParent, declarationsByNode);
	seedAssignmentSpecs(snapshot, callableSpecsByNode, referencesByNode, symbolById);
	return {
		callableSpecsByNode,
		childrenByParent,
		declarationById,
		nodeById,
		provenanceIds,
		referencesByNode,
		sourceById,
		symbolById
	};
}

type SemanticIndex = ReturnType<typeof buildSemanticIndex>;

function projectSourceNodes(
	snapshot: StaticSemanticSnapshot,
	graphId: CallGraphId,
	layerId: CallGraphLayerId
): CallGraphNode[] {
	return snapshot.sources.map((source): CallGraphNode => ({
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
}

function projectCallableNode(
	spec: CallableSpec,
	snapshot: StaticSemanticSnapshot,
	index: SemanticIndex,
	graphId: CallGraphId,
	layerId: CallGraphLayerId
): CallGraphCallableTargetNode {
	const declarations = [...spec.declarationIds]
		.map((id) => index.declarationById.get(id))
		.filter((value): value is SemanticDeclarationRecord => value !== undefined);
	const nodeProvenance = sortedUnique([
		spec.source.provenanceId,
		...(spec.source.syntaxProvenanceId === null ? [] : [spec.source.syntaxProvenanceId]),
		...declarations.flatMap((record) => [record.bindingProvenanceId, record.structuralProvenanceId])
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
		sourceLocations: [{ end: spec.node.end, sourceId: spec.source.id, start: spec.node.start }],
		subjectId: snapshot.subjectId,
		symbolIds: sortedUnique(spec.symbolIds)
	};
}

function projectCallableNodes(
	snapshot: StaticSemanticSnapshot,
	index: SemanticIndex,
	graphId: CallGraphId,
	layerId: CallGraphLayerId
): CallGraphCallableTargetNode[] {
	return [...index.callableSpecsByNode.values()]
		.map((spec) => projectCallableNode(spec, snapshot, index, graphId, layerId))
		.sort(compareId);
}

function buildSpecsBySymbol(
	callableSpecsByNode: Map<SemanticAstNodeRecord['id'], CallableSpec>
): Map<SemanticSymbolId, CallableSpec[]> {
	const specsBySymbol = new Map<SemanticSymbolId, CallableSpec[]>();
	for (const spec of callableSpecsByNode.values())
		for (const symbolId of spec.symbolIds) addGrouped(specsBySymbol, symbolId, spec);
	for (const specs of specsBySymbol.values())
		specs.sort((left, right) => compareText(left.node.id, right.node.id));
	return specsBySymbol;
}

function buildProjection(
	snapshot: StaticSemanticSnapshot,
	index: SemanticIndex,
	classificationSteps: ClassificationStepBudget
) {
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
	const sourceNodeIdBySourceId = new Map(
		snapshot.sources.map((source) => [source.id, callGraphSourceRegionNodeId(graphId, source.id)])
	);
	const callableNodeIdBySemanticNodeId = new Map(
		[...index.callableSpecsByNode.values()].map((spec) => [
			spec.node.id,
			callGraphCallableTargetNodeId(graphId, spec.node.id)
		])
	);
	const specsBySymbol = buildSpecsBySymbol(index.callableSpecsByNode);
	const invocationNodeIds = new Set(snapshot.invocations.map((invocation) => invocation.nodeId));
	return {
		callableNodeIdBySemanticNodeId,
		classificationSteps,
		graphId,
		graphInputDigest,
		index,
		invocationNodeIds,
		layerId,
		snapshot,
		sourceNodeIdBySourceId,
		specsBySymbol
	};
}

type Projection = ReturnType<typeof buildProjection>;

function subtreeIds(
	root: SemanticAstNodeRecord,
	index: SemanticIndex,
	steps: ClassificationStepBudget
): Set<SemanticAstNodeRecord['id']> {
	const result = new Set<SemanticAstNodeRecord['id']>();
	const stack = [root];
	while (stack.length > 0) {
		const current = stack.pop()!;
		steps.consume();
		if (result.has(current.id)) continue;
		result.add(current.id);
		const children = index.childrenByParent.get(current.id) ?? [];
		steps.consume(children.length);
		for (const child of children) stack.push(child);
	}
	return result;
}

function collectInlineCallableSpecs(
	root: SemanticAstNodeRecord,
	invocationKind: SemanticInvocationSiteRecord['invocationKind'],
	index: SemanticIndex,
	steps: ClassificationStepBudget,
	result: CallableSpec[]
): void {
	steps.consume();
	const direct = index.callableSpecsByNode.get(root.id);
	if (direct !== undefined && compatibleCallable(invocationKind, direct)) {
		result.push(direct);
		return;
	}
	if (root.kind === ts.SyntaxKind.ClassExpression) {
		const children = index.childrenByParent.get(root.id) ?? [];
		steps.consume(children.length);
		for (const child of children) {
			const spec = index.callableSpecsByNode.get(child.id);
			if (spec?.callableKind === 'CONSTRUCTOR' && compatibleCallable(invocationKind, spec)) {
				result.push(spec);
				return;
			}
		}
		return;
	}
	if (!TRANSPARENT_CALLEE_KINDS.has(root.kind)) return;
	const children = index.childrenByParent.get(root.id) ?? [];
	steps.consume(children.length);
	for (const child of children)
		collectInlineCallableSpecs(child, invocationKind, index, steps, result);
}

function inlineCallableSpecs(
	root: SemanticAstNodeRecord,
	invocationKind: SemanticInvocationSiteRecord['invocationKind'],
	index: SemanticIndex,
	steps: ClassificationStepBudget
): CallableSpec[] {
	const result: CallableSpec[] = [];
	collectInlineCallableSpecs(root, invocationKind, index, steps, result);
	return result;
}

function ownerFor(invocationNode: SemanticAstNodeRecord, projection: Projection): CallGraphNodeId {
	let parentId = invocationNode.parentId;
	const visited = new Set<SemanticAstNodeRecord['id']>();
	while (parentId !== null) {
		projection.classificationSteps.consume();
		if (visited.has(parentId)) throw new Error('AST ancestry contains a cycle.');
		visited.add(parentId);
		const callableNodeId = projection.callableNodeIdBySemanticNodeId.get(parentId);
		if (callableNodeId !== undefined) return callableNodeId;
		const parent = projection.index.nodeById.get(parentId);
		if (parent === undefined) throw new Error('Invocation ancestry has a missing node.');
		parentId = parent.parentId;
	}
	const sourceNodeId = projection.sourceNodeIdBySourceId.get(invocationNode.sourceId);
	if (sourceNodeId === undefined) throw new Error('Invocation source region is missing.');
	return sourceNodeId;
}

interface ClassificationBase {
	readonly dispatchClass: CallGraphDispatchClass;
	readonly invocation: SemanticInvocationSiteRecord;
	readonly ownerNodeId: CallGraphNodeId;
	readonly source: SemanticSourceRecord;
}

function beginClassification(
	invocation: SemanticInvocationSiteRecord,
	projection: Projection,
	maxCandidateTargets: number | null
) {
	const invocationNode = projection.index.nodeById.get(invocation.nodeId);
	const callee = projection.index.nodeById.get(invocation.calleeNodeId);
	const source = projection.index.sourceById.get(invocation.sourceId);
	if (
		invocationNode === undefined ||
		callee === undefined ||
		source === undefined ||
		invocationNode.sourceId !== invocation.sourceId ||
		callee.sourceId !== invocation.sourceId
	)
		throw new Error(`Invocation ${invocation.id} has invalid semantic endpoints.`);
	projection.classificationSteps.consume();
	const inlineSpecs = inlineCallableSpecs(
		callee,
		invocation.invocationKind,
		projection.index,
		projection.classificationSteps
	);
	consumeSortInspections(projection.classificationSteps, inlineSpecs.length);
	inlineSpecs.sort((left, right) => compareText(left.node.id, right.node.id));
	const baseProvenance = sortedUnique([
		source.provenanceId,
		...(source.syntaxProvenanceId === null ? [] : [source.syntaxProvenanceId]),
		...(invocation.resolutionProvenanceId === null
			? []
			: [invocation.resolutionProvenanceId])
	]);
	const base: ClassificationBase = {
		dispatchClass: resolutionDispatchClass(callee, [], inlineSpecs),
		invocation,
		ownerNodeId: ownerFor(invocationNode, projection),
		source
	};
	return {
		base,
		baseProvenance,
		callee,
		inlineSpecs,
		invocation,
		maxCandidateTargets,
		memberReferences: [] as SemanticReferenceRecord[],
		projection,
		subtreeReferences: [] as SemanticReferenceRecord[]
	};
}

type ClassificationState = ReturnType<typeof beginClassification>;

function classifyDynamicCallee(state: ClassificationState): CallClassification | null {
	const callee = state.callee;
	if (
		callee.kind === ts.SyntaxKind.ImportKeyword ||
		(callee.kind === ts.SyntaxKind.Identifier && callee.syntacticIdentifierText === 'eval')
	)
		return {
			...state.base,
			provenanceIds: state.baseProvenance,
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
	return null;
}

function classifyInlineTargets(state: ClassificationState): CallClassification | null {
	const inlineSpecs = state.inlineSpecs;
	if (inlineSpecs.length === 1) {
		const targetSpec = inlineSpecs[0]!;
		const targetNodeId = state.projection.callableNodeIdBySemanticNodeId.get(targetSpec.node.id);
		if (targetNodeId === undefined) throw new Error('Inline callable target node is missing.');
		state.projection.classificationSteps.consume(targetSpec.symbolIds.size);
		consumeSortInspections(state.projection.classificationSteps, targetSpec.symbolIds.size);
		const exact =
			state.invocation.targetState === 'IMPLEMENTATION_IDENTIFIED' &&
			state.invocation.resolvedSignatureId !== null &&
			state.invocation.resolutionProvenanceId !== null &&
			state.invocation.implementationNodeId === targetSpec.node.id;
		return {
			...state.base,
			provenanceIds: state.baseProvenance,
			reasonCode: exact
				? 'INLINE_CALLABLE_EXACT_SYNTAX_TARGET'
				: 'INLINE_CALLABLE_WITHOUT_RESOLVED_SIGNATURE',
			referenceIds: [],
			resolutionClass: exact ? 'EXACT' : 'CANDIDATE_SET',
			resolvedSymbolIds: sortedUnique(targetSpec.symbolIds),
			targetCallableNodeIds: [targetNodeId],
			targetSpecs: inlineSpecs
		};
	}
	if (inlineSpecs.length > 1)
		return {
			...state.base,
			provenanceIds: state.baseProvenance,
			reasonCode: 'MULTIPLE_CALLEE_REFERENCE_CANDIDATES',
			referenceIds: [],
			resolutionClass: 'UNSUPPORTED',
			resolvedSymbolIds: [],
			targetCallableNodeIds: [],
			targetSpecs: []
		};
	return null;
}

function classifyNestedInvocationCallee(state: ClassificationState): CallClassification | null {
	const calleeSubtree = subtreeIds(
		state.callee,
		state.projection.index,
		state.projection.classificationSteps
	);
	state.projection.classificationSteps.consume(calleeSubtree.size);
	let containsNestedInvocation = false;
	for (const nodeId of calleeSubtree)
		if (state.projection.invocationNodeIds.has(nodeId)) {
			containsNestedInvocation = true;
			break;
		}
	if (containsNestedInvocation)
		return {
			...state.base,
			dispatchClass: 'UNSUPPORTED_EXPRESSION',
			provenanceIds: state.baseProvenance,
			reasonCode: 'DYNAMIC_CALLEE_EXPRESSION',
			referenceIds: [],
			resolutionClass: 'UNSUPPORTED',
			resolvedSymbolIds: [],
			targetCallableNodeIds: [],
			targetSpecs: []
		};
	const subtreeReferences: SemanticReferenceRecord[] = [];
	for (const nodeId of calleeSubtree) {
		state.projection.classificationSteps.consume();
		for (const reference of state.projection.index.referencesByNode.get(nodeId) ?? []) {
			state.projection.classificationSteps.consume();
			subtreeReferences.push(reference);
		}
	}
	consumeSortInspections(state.projection.classificationSteps, subtreeReferences.length);
	subtreeReferences.sort(compareId);
	state.subtreeReferences = subtreeReferences;
	state.projection.classificationSteps.consume(subtreeReferences.length);
	state.memberReferences = subtreeReferences.filter(
		(reference) => reference.role === 'MEMBER_NAME'
	);
	state.base = {
		...state.base,
		dispatchClass: resolutionDispatchClass(state.callee, state.memberReferences, state.inlineSpecs)
	};
	return null;
}

function classifyReceiverDispatch(state: ClassificationState): CallClassification | null {
	const callee = state.callee;
	if (callee.kind === ts.SyntaxKind.ThisKeyword || callee.kind === ts.SyntaxKind.SuperKeyword)
		return {
			...state.base,
			provenanceIds: state.baseProvenance,
			reasonCode: 'THIS_OR_SUPER_DISPATCH',
			referenceIds: [],
			resolutionClass: 'UNSUPPORTED',
			resolvedSymbolIds: [],
			targetCallableNodeIds: [],
			targetSpecs: []
		};
	if (
		callee.kind === ts.SyntaxKind.ElementAccessExpression &&
		state.memberReferences.length === 0
	) {
		state.projection.classificationSteps.consume(state.subtreeReferences.length);
		consumeSortInspections(state.projection.classificationSteps, state.subtreeReferences.length);
		return {
			...state.base,
			provenanceIds: state.baseProvenance,
			reasonCode: 'COMPUTED_ELEMENT_DISPATCH',
			referenceIds: state.subtreeReferences.map((reference) => reference.id).sort(compareText),
			resolutionClass: 'UNSUPPORTED',
			resolvedSymbolIds: [],
			targetCallableNodeIds: [],
			targetSpecs: []
		};
	}
	return null;
}

function selectCalleeReferences(state: ClassificationState): readonly SemanticReferenceRecord[] {
	const callee = state.callee;
	if (
		callee.kind === ts.SyntaxKind.PropertyAccessExpression ||
		callee.kind === ts.SyntaxKind.ElementAccessExpression ||
		state.memberReferences.length > 0
	)
		return state.memberReferences;
	if (callee.kind === ts.SyntaxKind.Identifier || callee.kind === ts.SyntaxKind.PrivateIdentifier)
		return state.projection.index.referencesByNode.get(callee.id) ?? [];
	if (TRANSPARENT_CALLEE_KINDS.has(callee.kind))
		state.projection.classificationSteps.consume(state.subtreeReferences.length);
	if (TRANSPARENT_CALLEE_KINDS.has(callee.kind))
		return state.subtreeReferences.filter(
			(reference) => reference.role === 'SYMBOL_USE' || reference.role === 'MEMBER_NAME'
		);
	return [];
}

function classifyReferenceCardinality(
	state: ClassificationState,
	selectedReferences: readonly SemanticReferenceRecord[]
): CallClassification | null {
	if (selectedReferences.length === 0)
		return {
			...state.base,
			provenanceIds: state.baseProvenance,
			reasonCode:
				state.base.dispatchClass === 'UNSUPPORTED_EXPRESSION'
					? 'DYNAMIC_CALLEE_EXPRESSION'
					: 'CALLEE_REFERENCE_NOT_RECONCILED',
			referenceIds: [],
			resolutionClass:
				state.base.dispatchClass === 'UNSUPPORTED_EXPRESSION' ? 'UNSUPPORTED' : 'UNRESOLVED',
			resolvedSymbolIds: [],
			targetCallableNodeIds: [],
			targetSpecs: []
		};
	if (selectedReferences.length > 1) {
		const referenceCount = selectedReferences.length;
		const provenanceCount = state.baseProvenance.length + referenceCount * 2;
		state.projection.classificationSteps.consume(referenceCount * 5);
		state.projection.classificationSteps.consume(provenanceCount);
		consumeSortInspections(state.projection.classificationSteps, provenanceCount);
		consumeSortInspections(state.projection.classificationSteps, referenceCount);
		consumeSortInspections(state.projection.classificationSteps, referenceCount);
		return {
			...state.base,
			provenanceIds: sortedUnique([
				...state.baseProvenance,
				...selectedReferences.flatMap((reference) => [
					reference.resolutionProvenanceId,
					reference.structuralProvenanceId
				])
			]),
			reasonCode: 'MULTIPLE_CALLEE_REFERENCE_CANDIDATES',
			referenceIds: selectedReferences.map((reference) => reference.id).sort(compareText),
			resolutionClass: 'UNSUPPORTED',
			resolvedSymbolIds: sortedUnique(
				selectedReferences.flatMap((reference) =>
					reference.resolvedSymbolId === null ? [] : [reference.resolvedSymbolId]
				)
			),
			targetCallableNodeIds: [],
			targetSpecs: []
		};
	}
	return null;
}

function externalDispatchClassification(
	state: ClassificationState,
	reference: SemanticReferenceRecord,
	referenceProvenance: readonly SemanticProvenanceId[],
	declarationIds: readonly SemanticDeclarationId[],
	symbolId: SemanticSymbolId
): CallClassification {
	const index = state.projection.index;
	let externalOnly = declarationIds.length > 0;
	for (const declarationId of declarationIds) {
		state.projection.classificationSteps.consume(2);
		const declaration = index.declarationById.get(declarationId);
		if (declaration === undefined) throw new Error(`Declaration ${declarationId} is absent.`);
		const declarationSource = index.sourceById.get(declaration.sourceId);
		if (declarationSource === undefined)
			throw new Error(`Declaration source ${declaration.sourceId} is absent.`);
		if (
			!declaration.ambient &&
			declarationSource.analysisDisposition !== 'CONTEXT_ONLY' &&
			declarationSource.origin !== 'EXTERNAL_DECLARATION' &&
			declarationSource.origin !== 'TOOLCHAIN_LIBRARY' &&
			declarationSource.artifactClass !== 'EXTERNAL_DEPENDENCY' &&
			declarationSource.artifactClass !== 'VENDOR'
		) {
			externalOnly = false;
			break;
		}
	}
	return {
		...state.base,
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
}

function classifyResolvedReference(
	state: ClassificationState,
	reference: SemanticReferenceRecord
): CallClassification {
	const referenceProvenance = sortedUnique([
		...state.baseProvenance,
		reference.resolutionProvenanceId,
		reference.structuralProvenanceId
	]);
	if (reference.resolutionState === 'UNSUPPORTED')
		return {
			...state.base,
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
			...state.base,
			provenanceIds: referenceProvenance,
			reasonCode: 'REFERENCE_UNRESOLVED',
			referenceIds: [reference.id],
			resolutionClass: 'UNRESOLVED',
			resolvedSymbolIds: [],
			targetCallableNodeIds: [],
			targetSpecs: []
		};
	const symbolId = reference.resolvedSymbolId;
	const symbol = state.projection.index.symbolById.get(symbolId);
	if (symbol === undefined) throw new Error(`Resolved symbol ${symbolId} is absent.`);
	const symbolSpecs = state.projection.specsBySymbol.get(symbolId) ?? [];
	const candidates: CallableSpec[] = [];
	const candidateNodeIdSet = new Set<CallGraphNodeId>();
	for (const spec of symbolSpecs) {
		state.projection.classificationSteps.consume(3);
		if (!compatibleCallable(state.invocation.invocationKind, spec)) continue;
		candidates.push(spec);
		candidateNodeIdSet.add(callGraphCallableTargetNodeId(state.projection.graphId, spec.node.id));
		if (state.maxCandidateTargets !== null && candidateNodeIdSet.size > state.maxCandidateTargets)
			throw new CallGraphCandidateEdgeBudgetError(candidateNodeIdSet.size);
	}
	consumeSortInspections(state.projection.classificationSteps, candidateNodeIdSet.size);
	const candidateNodeIds = [...candidateNodeIdSet].sort(compareText);
	if (candidateNodeIds.length > 0)
		return {
			...state.base,
			provenanceIds: referenceProvenance,
			reasonCode: 'RESOLVED_LOCAL_CALLABLE_CANDIDATES',
			referenceIds: [reference.id],
			resolutionClass: 'CANDIDATE_SET',
			resolvedSymbolIds: [symbolId],
			targetCallableNodeIds: candidateNodeIds,
			targetSpecs: candidates
		};
	return externalDispatchClassification(
		state,
		reference,
		referenceProvenance,
		symbol.declarationIds,
		symbolId
	);
}

function classifyInvocation(
	invocation: SemanticInvocationSiteRecord,
	projection: Projection,
	maxCandidateTargets: number | null
): CallClassification {
	const state = beginClassification(invocation, projection, maxCandidateTargets);
	const dynamicCallee = classifyDynamicCallee(state);
	if (dynamicCallee !== null) return dynamicCallee;
	const inlineTargets = classifyInlineTargets(state);
	if (inlineTargets !== null) return inlineTargets;
	const nestedCallee = classifyNestedInvocationCallee(state);
	if (nestedCallee !== null) return nestedCallee;
	const receiverDispatch = classifyReceiverDispatch(state);
	if (receiverDispatch !== null) return receiverDispatch;
	const selectedReferences = selectCalleeReferences(state);
	projection.classificationSteps.consume(selectedReferences.length);
	const cardinality = classifyReferenceCardinality(state, selectedReferences);
	if (cardinality !== null) return cardinality;
	return classifyResolvedReference(state, selectedReferences[0]!);
}

function frontierKindFor(
	resolutionClass: CallGraphResolutionClass
): CallGraphFrontierNode['frontierKind'] {
	if (resolutionClass === 'EXTERNAL_DISPATCH') return 'EXTERNAL_DISPATCH';
	if (resolutionClass === 'UNRESOLVED') return 'UNRESOLVED';
	return 'UNSUPPORTED';
}

function frontierNodeFor(
	classification: CallClassification,
	invocationNode: SemanticAstNodeRecord,
	projection: Projection
): CallGraphFrontierNode {
	const snapshot = projection.snapshot;
	const frontierKind = frontierKindFor(classification.resolutionClass);
	const frontierId = callGraphFrontierNodeId(
		projection.graphId,
		classification.invocation.id,
		frontierKind
	);
	return {
		epistemic: epistemicForResolution(classification.resolutionClass, snapshot),
		frontierKind,
		graphId: projection.graphId,
		id: frontierId,
		invocationId: classification.invocation.id,
		kind: 'FRONTIER',
		layerId: projection.layerId,
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
	};
}

function projectCallSiteNodes(
	classifications: readonly CallClassification[],
	projection: Projection
): { callSiteNodes: CallGraphCallSiteNode[]; frontierNodes: CallGraphFrontierNode[] } {
	const snapshot = projection.snapshot;
	const callSiteNodes: CallGraphCallSiteNode[] = [];
	const frontierNodes: CallGraphFrontierNode[] = [];
	for (const classification of classifications) {
		const invocationNode = projection.index.nodeById.get(classification.invocation.nodeId)!;
		const callSiteId = callGraphCallSiteNodeId(projection.graphId, classification.invocation.id);
		let targetNodeIds = classification.targetCallableNodeIds;
		if (
			classification.resolutionClass !== 'CANDIDATE_SET' &&
			classification.resolutionClass !== 'EXACT'
		) {
			const frontierNode = frontierNodeFor(classification, invocationNode, projection);
			frontierNodes.push(frontierNode);
			targetNodeIds = [frontierNode.id];
		}
		callSiteNodes.push({
			calleeNodeId: classification.invocation.calleeNodeId,
			dispatchClass: classification.dispatchClass,
			epistemic: epistemicForResolution(classification.resolutionClass, snapshot),
			graphId: projection.graphId,
			id: callSiteId,
			invocationId: classification.invocation.id,
			invocationKind: classification.invocation.invocationKind,
			invocationNodeId: classification.invocation.nodeId,
			kind: 'CALL_SITE',
			layerId: projection.layerId,
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
	return { callSiteNodes, frontierNodes };
}

function ownershipEdge(
	callSite: CallGraphCallSiteNode,
	owner: CallGraphNode,
	projection: Projection
): CallGraphEdge {
	const snapshot = projection.snapshot;
	const ownershipSource = endpoint(owner);
	const ownershipTarget = endpoint(callSite);
	return {
		candidateRank: null,
		epistemic: structuralEpistemic(snapshot),
		evidenceClass: 'R-SEM',
		graphId: projection.graphId,
		id: callGraphEdgeId({
			candidateRank: null,
			graph: projection.graphId,
			invocationId: callSite.invocationId,
			relationKind: 'CALL_SITE_OWNERSHIP',
			source: ownershipSource,
			target: ownershipTarget
		}),
		invocationId: callSite.invocationId,
		layerId: projection.layerId,
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
	};
}

function candidateTargetEdge(
	callSite: CallGraphCallSiteNode,
	target: CallGraphNode,
	candidateRank: number,
	targetSpecBySemanticNodeId: Map<SemanticAstNodeRecord['id'], CallableSpec>,
	invocation: SemanticInvocationSiteRecord,
	projection: Projection
): CallGraphEdge {
	const snapshot = projection.snapshot;
	const sourceEndpoint = endpoint(callSite);
	const targetEndpoint = endpoint(target);
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
	return {
		candidateRank,
		epistemic: epistemicForResolution('CANDIDATE_SET', snapshot),
		evidenceClass: 'R-INF',
		graphId: projection.graphId,
		id: callGraphEdgeId({
			candidateRank,
			graph: projection.graphId,
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
				...(invocation.resolvedSignatureId === null
					? (['INVOCATION_SPECIFIC_SIGNATURE_NOT_RETAINED'] as const)
					: []),
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
		layerId: projection.layerId,
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
	};
}

function confirmedTargetEdge(
	callSite: CallGraphCallSiteNode,
	target: CallGraphNode,
	projection: Projection
): CallGraphEdge {
	if (target.kind !== 'CALLABLE_TARGET')
		throw new Error('An exact call target must be a retained callable target.');
	const snapshot = projection.snapshot;
	const sourceEndpoint = endpoint(callSite);
	const targetEndpoint = endpoint(target);
	return {
		candidateRank: null,
		epistemic: epistemicForResolution('EXACT', snapshot),
		evidenceClass: 'R-SEM',
		graphId: projection.graphId,
		id: callGraphEdgeId({
			candidateRank: null,
			graph: projection.graphId,
			invocationId: callSite.invocationId,
			relationKind: 'CONFIRMED_CALL_TARGET',
			source: sourceEndpoint,
			target: targetEndpoint
		}),
		invocationId: callSite.invocationId,
		layerId: projection.layerId,
		method: CALL_GRAPH_METHOD,
		provenanceIds: sortedUnique([...callSite.provenanceIds, ...target.provenanceIds]),
		relationCode: 'REL-067',
		relationKind: 'CONFIRMED_CALL_TARGET',
		resolutionClass: 'EXACT',
		semanticSnapshotId: snapshot.id,
		source: sourceEndpoint,
		sourceLocations: callSite.sourceLocations,
		subjectId: snapshot.subjectId,
		target: targetEndpoint,
		targetState: 'CONFIRMED'
	};
}

function unresolvedTargetEdge(
	callSite: CallGraphCallSiteNode,
	target: CallGraphNode,
	resolutionClass: Exclude<CallGraphResolutionClass, 'CANDIDATE_SET'>,
	projection: Projection
): CallGraphEdge {
	const snapshot = projection.snapshot;
	const sourceEndpoint = endpoint(callSite);
	const targetEndpoint = endpoint(target);
	if (resolutionClass === 'EXACT')
		throw new Error('The initial call graph producer cannot emit confirmed targets.');
	return {
		candidateRank: null,
		epistemic: epistemicForResolution(resolutionClass, snapshot),
		evidenceClass: 'R-INF',
		graphId: projection.graphId,
		id: callGraphEdgeId({
			candidateRank: null,
			graph: projection.graphId,
			invocationId: callSite.invocationId,
			relationKind: 'UNRESOLVED_CALL_TARGET',
			source: sourceEndpoint,
			target: targetEndpoint
		}),
		invocationId: callSite.invocationId,
		layerId: projection.layerId,
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
	};
}

function pushTargetEdges(
	edges: CallGraphEdge[],
	callSite: CallGraphCallSiteNode,
	nodeByGraphId: Map<CallGraphNodeId, CallGraphNode>,
	targetSpecBySemanticNodeId: Map<SemanticAstNodeRecord['id'], CallableSpec>,
	invocation: SemanticInvocationSiteRecord,
	projection: Projection
): void {
	for (const [index, targetNodeId] of callSite.targetNodeIds.entries()) {
		const target = nodeByGraphId.get(targetNodeId)!;
		if (callSite.resolutionClass === 'EXACT')
			edges.push(confirmedTargetEdge(callSite, target, projection));
		else if (callSite.resolutionClass === 'CANDIDATE_SET')
			edges.push(
				candidateTargetEdge(
					callSite,
					target,
					index + 1,
					targetSpecBySemanticNodeId,
					invocation,
					projection
				)
			);
		else edges.push(unresolvedTargetEdge(callSite, target, callSite.resolutionClass, projection));
	}
}

function projectEdges(
	callSiteNodes: readonly CallGraphCallSiteNode[],
	nodeByGraphId: Map<CallGraphNodeId, CallGraphNode>,
	classificationByInvocationId: Map<CallGraphCallSiteNode['invocationId'], CallClassification>,
	projection: Projection
): CallGraphEdge[] {
	const edges: CallGraphEdge[] = [];
	for (const callSite of callSiteNodes) {
		const classification = classificationByInvocationId.get(callSite.invocationId)!;
		const targetSpecBySemanticNodeId = new Map(
			classification.targetSpecs.map((spec) => [spec.node.id, spec])
		);
		const owner = nodeByGraphId.get(callSite.ownerNodeId)!;
		edges.push(ownershipEdge(callSite, owner, projection));
		pushTargetEdges(
			edges,
			callSite,
			nodeByGraphId,
			targetSpecBySemanticNodeId,
			classification.invocation,
			projection
		);
		if (!classification.provenanceIds.every((id) => projection.index.provenanceIds.has(id)))
			throw new Error(`Invocation ${callSite.invocationId} has missing provenance.`);
	}
	edges.sort(compareId);
	if (new Set(edges.map((edge) => edge.id)).size !== edges.length)
		throw new Error('Call graph edge identity collision.');
	return edges;
}

function appendClassificationLimitations(
	limitations: CallGraphLimitation[],
	classification: CallClassification
): void {
	if (classification.invocation.resolvedSignatureId === null)
		limitations.push(
			limitation(
				'INVOCATION_SPECIFIC_SIGNATURE_NOT_RETAINED',
				'The compiler did not retain a resolved Signature identity for this invocation.',
				classification.invocation
			)
		);
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
			break;
	}
}

function buildLimitations(
	snapshot: StaticSemanticSnapshot,
	classifications: readonly CallClassification[]
): CallGraphLimitation[] {
	const limitations: CallGraphLimitation[] = [
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
	for (const classification of classifications)
		appendClassificationLimitations(limitations, classification);
	limitations.sort(compareLimitation);
	return limitations;
}

interface CallGraphProjectedPopulation {
	readonly edges: number;
	readonly limitations: number;
	readonly nodes: number;
}

function checkedPopulationAdd(left: number, right: number): number {
	const result = left + right;
	if (!Number.isSafeInteger(result)) throw new RangeError('Call graph population is not safe.');
	return result;
}

function baseProjectedPopulation(
	snapshot: StaticSemanticSnapshot,
	callableCount: number
): CallGraphProjectedPopulation {
	const invocationCount = snapshot.invocations.length;
	return {
		edges: checkedPopulationAdd(invocationCount, invocationCount),
		limitations: 2 + Number(snapshot.health === 'PARTIAL'),
		nodes: checkedPopulationAdd(
			checkedPopulationAdd(snapshot.sources.length, callableCount),
			invocationCount
		)
	};
}

function classificationLimitationCount(classification: CallClassification): number {
	const missingSignature = Number(classification.invocation.resolvedSignatureId === null);
	switch (classification.resolutionClass) {
		case 'CANDIDATE_SET':
			return (
				missingSignature +
				1 +
				Number(
					classification.dispatchClass === 'MEMBER_REFERENCE' ||
						classification.dispatchClass === 'LITERAL_ELEMENT_REFERENCE'
				)
			);
		case 'EXTERNAL_DISPATCH':
			return (
				missingSignature +
				1 +
				Number(classification.reasonCode === 'CALLABLE_VALUE_FLOW_NOT_MODELED')
			);
		case 'UNRESOLVED':
		case 'UNSUPPORTED':
			return missingSignature + 1;
		case 'EXACT':
			return 0;
	}
}

function targetEdgeCount(classification: CallClassification): number {
	return classification.resolutionClass === 'CANDIDATE_SET'
		? classification.targetCallableNodeIds.length
		: 1;
}

function populationExceeds(
	population: CallGraphProjectedPopulation,
	budgets: CallGraphProjectionBudgets
): boolean {
	return (
		population.edges > budgets.maxEdges ||
		population.limitations > budgets.maxLimitations ||
		population.nodes > budgets.maxNodes
	);
}

function populationBudgetRejection(
	population: CallGraphProjectedPopulation,
	budgets: CallGraphProjectionBudgets
): BoundedCallGraphBuildOutcome {
	const diagnostics = (
		[
			['edges', 'maxEdges'],
			['limitations', 'maxLimitations'],
			['nodes', 'maxNodes']
		] as const
	).flatMap(([populationKey, budgetKey]) =>
		population[populationKey] <= budgets[budgetKey]
			? []
			: [
					boundedDiagnostic(
						'BUDGET_EXCEEDED',
						`The projected call-graph ${populationKey} population has reached ${String(population[populationKey])}, which exceeds ${budgetKey} ${String(budgets[budgetKey])}.`,
						'PROJECT',
						`$options.budgets.${budgetKey}`
					)
				]
	);
	return { diagnostics, outcome: 'unavailable' };
}

function classifyProjection(
	projection: Projection,
	budgets: CallGraphProjectionBudgets | null
):
	| {
			readonly classifications: readonly CallClassification[];
			readonly population: CallGraphProjectedPopulation;
	  }
	| { readonly rejection: BoundedCallGraphBuildOutcome } {
	const snapshot = projection.snapshot;
	let population = baseProjectedPopulation(snapshot, projection.index.callableSpecsByNode.size);
	if (budgets !== null && populationExceeds(population, budgets))
		return { rejection: populationBudgetRejection(population, budgets) };
	const classifications: CallClassification[] = [];
	for (const invocation of snapshot.invocations) {
		let classification: CallClassification;
		try {
			classification = classifyInvocation(
				invocation,
				projection,
				budgets === null ? null : checkedPopulationAdd(budgets.maxEdges - population.edges, 1)
			);
		} catch (error) {
			if (error instanceof CallGraphCandidateEdgeBudgetError)
				return {
					rejection: populationBudgetRejection(
						{
							...population,
							edges: checkedPopulationAdd(population.edges, error.minimumTargetCount - 1)
						},
						budgets!
					)
				};
			throw error;
		}
		population = {
			edges: checkedPopulationAdd(population.edges, targetEdgeCount(classification) - 1),
			limitations: checkedPopulationAdd(
				population.limitations,
				classificationLimitationCount(classification)
			),
			nodes: checkedPopulationAdd(
				population.nodes,
				Number(
					classification.resolutionClass !== 'CANDIDATE_SET' &&
						classification.resolutionClass !== 'EXACT'
				)
			)
		};
		if (budgets !== null && populationExceeds(population, budgets))
			return { rejection: populationBudgetRejection(population, budgets) };
		classifications.push(classification);
	}
	if (classifications.length !== snapshot.invocations.length)
		throw new Error('Call graph population planning did not retain every invocation.');
	return { classifications, population };
}

function buildCoverage(
	snapshot: StaticSemanticSnapshot,
	callSiteNodes: readonly CallGraphCallSiteNode[],
	frontierNodes: readonly CallGraphFrontierNode[],
	edges: readonly CallGraphEdge[]
): CallGraphCoverage {
	const callSiteByInvocationId = new Map(callSiteNodes.map((node) => [node.invocationId, node]));
	const targetEdges = edges.filter((edge) => edge.relationKind !== 'CALL_SITE_OWNERSHIP');
	return {
		candidateSetCallSites: callSiteNodes.filter((node) => node.resolutionClass === 'CANDIDATE_SET')
			.length,
		candidateTargetEdges: edges.filter((edge) => edge.relationKind === 'CANDIDATE_CALL_TARGET')
			.length,
		closure: 'OPEN',
		exactCallSites: callSiteNodes.filter((node) => node.resolutionClass === 'EXACT').length,
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
}

function assertCoverageReconciles(coverage: CallGraphCoverage): void {
	const categoryTotal =
		coverage.candidateSetCallSites +
		coverage.exactCallSites +
		coverage.externalDispatchCallSites +
		coverage.unresolvedCallSites +
		coverage.unsupportedCallSites;
	if (!coverage.reconciles || categoryTotal !== coverage.expectedCallSites)
		throw new Error('Call graph coverage does not reconcile.');
}

function assembleGraph(
	projection: Projection,
	classifications: readonly CallClassification[],
	nodes: readonly CallGraphNode[],
	edges: readonly CallGraphEdge[],
	limitations: readonly CallGraphLimitation[],
	coverage: CallGraphCoverage
): CallGraphSnapshot {
	const snapshot = projection.snapshot;
	const graphEpistemic = globalEpistemic(snapshot, classifications);
	const layerProvenanceIds = sortedUnique(
		nodes.flatMap((node) => node.provenanceIds).concat(edges.flatMap((edge) => edge.provenanceIds))
	);
	const layer: CallGraphLayer = {
		capability: CALL_GRAPH_CAPABILITY,
		capabilityStatus: CALL_GRAPH_CAPABILITY_STATUS,
		coverage,
		edgeIds: edges.map((edge) => edge.id),
		entryMechanismCoverage: ENTRY_MECHANISM_COVERAGE,
		epistemic: graphEpistemic,
		graphId: projection.graphId,
		id: projection.layerId,
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
		graphInputDigest: projection.graphInputDigest,
		graphKind: 'TYPESCRIPT_CALL' as const,
		health: 'PARTIAL' as const,
		id: projection.graphId,
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
	return {
		...content,
		contentDigest: callGraphContentDigest(content)
	};
}

function finalizeCallGraph(
	graph: CallGraphSnapshot,
	snapshot: StaticSemanticSnapshot,
	graphInputDigest: string,
	limitations: readonly CallGraphLimitation[]
): CallGraphBuildOutcome {
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
}

function projectCallGraph(
	snapshot: StaticSemanticSnapshot,
	budgets: CallGraphProjectionBudgets | null
): BoundedCallGraphBuildOutcome {
	const mandatoryPopulation = baseProjectedPopulation(snapshot, 0);
	if (budgets !== null && populationExceeds(mandatoryPopulation, budgets))
		return populationBudgetRejection(mandatoryPopulation, budgets);
	const index = buildSemanticIndex(snapshot);
	const exactBasePopulation = baseProjectedPopulation(snapshot, index.callableSpecsByNode.size);
	if (budgets !== null && populationExceeds(exactBasePopulation, budgets))
		return populationBudgetRejection(exactBasePopulation, budgets);
	const projection = buildProjection(
		snapshot,
		index,
		new ClassificationStepBudget(budgets?.maxClassificationSteps ?? null)
	);
	const plan = classifyProjection(projection, budgets);
	if ('rejection' in plan) return plan.rejection;
	const classifications = plan.classifications;
	const sourceNodes = projectSourceNodes(snapshot, projection.graphId, projection.layerId);
	const callableNodes = projectCallableNodes(
		snapshot,
		index,
		projection.graphId,
		projection.layerId
	);
	const { callSiteNodes, frontierNodes } = projectCallSiteNodes(classifications, projection);
	const nodes: CallGraphNode[] = [
		...sourceNodes,
		...callableNodes,
		...callSiteNodes,
		...frontierNodes
	].sort(compareId);
	const nodeByGraphId = new Map(nodes.map((node) => [node.id, node]));
	if (nodeByGraphId.size !== nodes.length) throw new Error('Call graph node identity collision.');
	const classificationByInvocationId = new Map(
		classifications.map((entry) => [entry.invocation.id, entry])
	);
	const edges = projectEdges(
		callSiteNodes,
		nodeByGraphId,
		classificationByInvocationId,
		projection
	);
	const limitations = buildLimitations(snapshot, classifications);
	if (
		nodes.length !== plan.population.nodes ||
		edges.length !== plan.population.edges ||
		limitations.length !== plan.population.limitations
	)
		throw new Error(
			'Call graph materialization does not reconcile with its exact population plan.'
		);
	const coverage = buildCoverage(snapshot, callSiteNodes, frontierNodes, edges);
	assertCoverageReconciles(coverage);
	const graph = assembleGraph(projection, classifications, nodes, edges, limitations, coverage);
	return finalizeCallGraph(graph, snapshot, projection.graphInputDigest, limitations);
}

function buildCallGraphInternal(
	requestValue: unknown,
	snapshot: StaticSemanticSnapshot
): CallGraphBuildOutcome;
function buildCallGraphInternal(
	requestValue: unknown,
	snapshot: StaticSemanticSnapshot,
	optionsValue: BuildCallGraphOptions
): BoundedCallGraphBuildOutcome;
function buildCallGraphInternal(
	requestValue: unknown,
	snapshot: StaticSemanticSnapshot,
	optionsValue?: BuildCallGraphOptions
): CallGraphBuildOutcome | BoundedCallGraphBuildOutcome {
	let options: BuildCallGraphOptions | null;
	try {
		options = materializeBuildOptions(optionsValue);
	} catch (error) {
		return unavailable(
			'REQUEST_INVALID',
			error instanceof Error ? error.message : 'Invalid call graph build options.',
			'REQUEST',
			'$options'
		);
	}
	const rejection = requestRejection(requestValue, snapshot);
	if (rejection !== null) return rejection;
	try {
		return projectCallGraph(snapshot, options?.budgets ?? null);
	} catch (error) {
		if (error instanceof CallGraphClassificationBudgetError)
			return boundedUnavailable('BUDGET_EXCEEDED', error.message, 'PROJECT', error.path);
		return unavailable(
			'DANGLING_SEMANTIC_REFERENCE',
			error instanceof Error
				? `Call graph projection failed closed: ${error.message}`
				: 'Call graph projection failed closed.',
			'PROJECT'
		);
	}
}

/** Public low-level operation; graph identity and behavior remain unchanged. */
export function buildCallGraph(
	requestValue: unknown,
	snapshot: StaticSemanticSnapshot
): CallGraphBuildOutcome {
	return buildCallGraphInternal(requestValue, snapshot);
}

/** @internal Trusted bounded materialization seam for the coding-agent report facade. */
export function buildBoundedCallGraph(
	requestValue: unknown,
	snapshot: StaticSemanticSnapshot,
	options: BuildCallGraphOptions
): BoundedCallGraphBuildOutcome {
	return buildCallGraphInternal(requestValue, snapshot, options);
}
