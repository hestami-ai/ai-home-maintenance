import type {
	ModuleDependencyGraphEdge,
	ModuleDependencyGraphEdgeId,
	ModuleDependencyGraphNode,
	ModuleDependencyGraphNodeId,
	ModuleDependencyGraphRelationKind,
	ModuleDependencyGraphSnapshot
} from '../contracts/graph.js';
import type { StaticSemanticSnapshot } from '../contracts/semantic.js';
import { compareText } from '../inventory/canonical.js';
import {
	canonicalSemanticJsonPrefixedSha256,
	canonicalSemanticJsonWitness,
	isProxyValue,
	isUnicodeScalarString
} from '../semantic/canonical.js';
import { validateModuleDependencyGraph } from '../graph/validate-graph.js';

export const MODULE_CODE_SLICE_REQUEST_SCHEMA_VERSION =
	'jan-csaa-module-code-slice-request/1.0.0' as const;
export const MODULE_CODE_SLICE_SCHEMA_VERSION = 'jan-csaa-module-code-slice/1.0.0' as const;
export const MODULE_CODE_SLICE_OPERATION_VERSION =
	'jan-csaa-build-module-code-slice/1.0.0' as const;
export const MODULE_CODE_SLICE_METHOD =
	'validated-module-dependency-bounded-may-slice/1.0.0' as const;
export const MODULE_CODE_SLICE_CAPABILITY = 'JAN-CSAA-CAP-030' as const;
export const MODULE_CODE_SLICE_CAPABILITY_STATUS = 'PARTIAL' as const;

export const MODULE_CODE_SLICE_NONCLAIMS = Object.freeze([
	'NOT_REACHED_IS_NOT_IRRELEVANT_OR_SAFE_TO_REMOVE',
	'MODULE_DEPENDENCIES_ARE_NOT_CALL_OR_DATA_FLOW',
	'DYNAMIC_OR_EXTERNAL_FRONTIERS_ARE_NOT_CLOSED',
	'NO_GATE_DECISION_OR_REMEDIATION_AUTHORITY'
] as const);

export const MODULE_CODE_SLICE_POLICY = Object.freeze({
	aliasTreatment: 'MODULE_RESOLUTION_ONLY',
	asyncTreatment: 'NOT_MODELED',
	dispatchTreatment: 'NOT_APPLICABLE_TO_MODULE_EDGES',
	exceptionTreatment: 'NOT_MODELED',
	generatedSourceTreatment: 'PRESERVE_SEMANTIC_SOURCE_IDENTITY',
	pathSemantics: 'CONSERVATIVE_MAY_SLICE',
	runtimeTreatment: 'NOT_CONSUMED'
} as const);

export type ModuleCodeSliceDirection = 'FORWARD' | 'BACKWARD' | 'CHOP';

export interface ModuleCodeSliceBudgets {
	readonly maxDepth: number;
	readonly maxFrontiers: number;
	readonly maxInputEdges: number;
	readonly maxInputNodes: number;
	readonly maxMembers: number;
	readonly maxResultBytes: number;
	readonly maxTraversalSteps: number;
	readonly maxWitnessEdges: number;
}

export interface ModuleCodeSliceRequest {
	readonly budgets: ModuleCodeSliceBudgets;
	readonly direction: ModuleCodeSliceDirection;
	readonly edgeFamilies: readonly ModuleDependencyGraphRelationKind[];
	readonly fromNodeId: ModuleDependencyGraphNodeId;
	readonly graphId: ModuleDependencyGraphSnapshot['id'];
	readonly operationVersion: typeof MODULE_CODE_SLICE_OPERATION_VERSION;
	readonly policy: typeof MODULE_CODE_SLICE_POLICY;
	readonly schemaVersion: typeof MODULE_CODE_SLICE_REQUEST_SCHEMA_VERSION;
	readonly semanticSnapshotId: StaticSemanticSnapshot['id'];
	readonly subjectId: string;
	readonly toNodeId: ModuleDependencyGraphNodeId | null;
}

export interface ModuleCodeSliceWitnessPath {
	readonly edgeIds: readonly ModuleDependencyGraphEdgeId[];
	readonly nodeIds: readonly ModuleDependencyGraphNodeId[];
}

export interface ModuleCodeSliceMember {
	readonly distanceFromCriterion: number;
	readonly distanceToTerminal: number | null;
	readonly epistemic: 'CONFIRMED' | 'POSSIBLE' | 'CONFLICTING';
	readonly nodeId: ModuleDependencyGraphNodeId;
	readonly nodeKind: ModuleDependencyGraphNode['kind'];
	readonly ordinal: number;
	readonly provenanceIds: readonly string[];
	readonly witness: ModuleCodeSliceWitnessPath;
}

export interface ModuleCodeSliceFrontier {
	readonly edgeId: ModuleDependencyGraphEdgeId | null;
	readonly fromNodeId: ModuleDependencyGraphNodeId;
	readonly kind:
		| 'DEPTH_BOUNDARY'
		| 'GRAPH_COVERAGE'
		| 'MEMBER_BOUNDARY'
		| 'RESOLUTION_TARGET'
		| 'TRAVERSAL_BOUNDARY';
	readonly ordinal: number;
	readonly reason: string;
	readonly toNodeId: ModuleDependencyGraphNodeId | null;
}

export interface ModuleCodeSliceResult {
	readonly capability: typeof MODULE_CODE_SLICE_CAPABILITY;
	readonly capabilityStatus: typeof MODULE_CODE_SLICE_CAPABILITY_STATUS;
	readonly closure: 'CLOSED_FOR_SELECTED_GRAPH' | 'OPEN';
	readonly contentDigest: string;
	readonly coverage: {
		readonly examinedEdges: number;
		readonly frontiers: number;
		readonly inputEdges: number;
		readonly inputNodes: number;
		readonly members: number;
		readonly selectedEdges: number;
		readonly witnessEdges: number;
	};
	readonly direction: ModuleCodeSliceDirection;
	readonly edgeFamilies: readonly ModuleDependencyGraphRelationKind[];
	readonly fromNodeId: ModuleDependencyGraphNodeId;
	readonly frontiers: readonly ModuleCodeSliceFrontier[];
	readonly graphId: ModuleDependencyGraphSnapshot['id'];
	readonly id: string;
	readonly members: readonly ModuleCodeSliceMember[];
	readonly method: typeof MODULE_CODE_SLICE_METHOD;
	readonly nonclaims: typeof MODULE_CODE_SLICE_NONCLAIMS;
	readonly operationVersion: typeof MODULE_CODE_SLICE_OPERATION_VERSION;
	readonly policy: typeof MODULE_CODE_SLICE_POLICY;
	readonly schemaVersion: typeof MODULE_CODE_SLICE_SCHEMA_VERSION;
	readonly semanticSnapshotId: StaticSemanticSnapshot['id'];
	readonly subjectId: string;
	readonly toNodeId: ModuleDependencyGraphNodeId | null;
	readonly truncation: {
		readonly reasons: readonly ('DEPTH' | 'MEMBERS' | 'TRAVERSAL_STEPS')[];
		readonly state: 'NOT_TRUNCATED' | 'TRUNCATED';
	};
}

export interface ModuleCodeSliceDiagnostic {
	readonly code:
		| 'BUDGET_EXCEEDED'
		| 'GRAPH_INVALID'
		| 'IDENTITY_MISMATCH'
		| 'OPEN_FRONTIER'
		| 'REQUEST_INVALID'
		| 'RESULT_BUDGET_EXCEEDED';
	readonly message: string;
	readonly path: string | null;
}

export type ModuleCodeSliceOutcome =
	| {
			readonly diagnostics: readonly ModuleCodeSliceDiagnostic[];
			readonly outcome: 'complete' | 'partial';
			readonly result: ModuleCodeSliceResult;
	  }
	| {
			readonly diagnostics: readonly ModuleCodeSliceDiagnostic[];
			readonly outcome: 'unavailable';
			readonly result?: never;
	  };

export interface ModuleCodeSliceValidationIssue {
	readonly code: 'EXPECTED_OUTCOME_UNAVAILABLE' | 'OUTCOME_INVALID' | 'OUTCOME_MISMATCH';
	readonly message: string;
}

export type ModuleCodeSliceValidationResult =
	| { readonly issues: readonly []; readonly state: 'VALID' }
	| { readonly issues: readonly ModuleCodeSliceValidationIssue[]; readonly state: 'INVALID' };

const REQUEST_KEYS = Object.freeze([
	'budgets',
	'direction',
	'edgeFamilies',
	'fromNodeId',
	'graphId',
	'operationVersion',
	'policy',
	'schemaVersion',
	'semanticSnapshotId',
	'subjectId',
	'toNodeId'
] as const);
const BUDGET_KEYS = Object.freeze([
	'maxDepth',
	'maxFrontiers',
	'maxInputEdges',
	'maxInputNodes',
	'maxMembers',
	'maxResultBytes',
	'maxTraversalSteps',
	'maxWitnessEdges'
] as const);
const POLICY_KEYS = Object.freeze([
	'aliasTreatment',
	'asyncTreatment',
	'dispatchTreatment',
	'exceptionTreatment',
	'generatedSourceTreatment',
	'pathSemantics',
	'runtimeTreatment'
] as const);
const RELATION_KINDS = Object.freeze([
	'DYNAMIC_IMPORT_OCCURRENCE',
	'EXPORT_OCCURRENCE',
	'IMPORT_EQUALS_OCCURRENCE',
	'IMPORT_OCCURRENCE',
	'IMPORT_TYPE_OCCURRENCE'
] as const satisfies readonly ModuleDependencyGraphRelationKind[]);
const SAFETY = Object.freeze({
	maxDepth: 10_000,
	maxFrontiers: 1_000_000,
	maxInputEdges: 2_000_000,
	maxInputNodes: 1_000_000,
	maxMembers: 1_000_000,
	maxResultBytes: 256 * 1024 * 1024,
	maxTraversalSteps: 10_000_000,
	maxWitnessEdges: 10_000_000
});

class Refusal extends Error {
	constructor(
		readonly code: ModuleCodeSliceDiagnostic['code'],
		message: string,
		readonly path: string | null
	) {
		super(message);
	}
}

function deepFreezeConstructed<Value>(value: Value, seen = new WeakSet<object>()): Value {
	if (value === null || typeof value !== 'object' || seen.has(value)) return value;
	seen.add(value);
	for (const key of Reflect.ownKeys(value)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor !== undefined && 'value' in descriptor)
			deepFreezeConstructed(descriptor.value, seen);
	}
	return Object.freeze(value);
}

function plainRecord(
	value: unknown,
	keys: readonly string[],
	path: string
): Record<string, unknown> {
	if (
		value === null ||
		typeof value !== 'object' ||
		Array.isArray(value) ||
		isProxyValue(value) ||
		Object.getPrototypeOf(value) !== Object.prototype
	)
		throw new Refusal('REQUEST_INVALID', 'Expected an exact plain-data object.', path);
	const ownKeys = Reflect.ownKeys(value);
	if (ownKeys.some((key) => typeof key !== 'string'))
		throw new Refusal('REQUEST_INVALID', 'Symbol-bearing request objects are unsupported.', path);
	const actual = (ownKeys as string[]).sort(compareText);
	const expected = [...keys].sort(compareText);
	if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index]))
		throw new Refusal(
			'REQUEST_INVALID',
			'Request object keys do not match the closed schema.',
			path
		);
	const result: Record<string, unknown> = {};
	for (const key of expected) {
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !('value' in descriptor))
			throw new Refusal(
				'REQUEST_INVALID',
				'Accessors are not accepted in request data.',
				`${path}.${key}`
			);
		result[key] = descriptor.value;
	}
	return result;
}

function scalar(value: unknown, path: string): string {
	if (typeof value !== 'string' || value.length === 0 || !isUnicodeScalarString(value))
		throw new Refusal('REQUEST_INVALID', 'Expected a nonempty Unicode-scalar string.', path);
	return value;
}

function exactStringArray(value: unknown, path: string): readonly string[] {
	if (
		!Array.isArray(value) ||
		isProxyValue(value) ||
		Object.getPrototypeOf(value) !== Array.prototype
	)
		throw new Refusal('REQUEST_INVALID', 'Expected an ordinary dense array.', path);
	const values: string[] = [];
	for (let index = 0; index < value.length; index += 1) {
		const descriptor = Object.getOwnPropertyDescriptor(value, `${index}`);
		if (descriptor === undefined || !('value' in descriptor))
			throw new Refusal(
				'REQUEST_INVALID',
				'Array holes and accessors are unsupported.',
				`${path}[${index}]`
			);
		values.push(scalar(descriptor.value, `${path}[${index}]`));
	}
	const permittedKeys = new Set(['length', ...values.map((_, index) => `${index}`)]);
	if (Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !permittedKeys.has(key)))
		throw new Refusal('REQUEST_INVALID', 'Array metadata is outside the closed schema.', path);
	return values;
}

function exactPolicy(value: unknown): typeof MODULE_CODE_SLICE_POLICY {
	const policy = plainRecord(value, POLICY_KEYS, '$.policy');
	for (const key of POLICY_KEYS)
		if (policy[key] !== MODULE_CODE_SLICE_POLICY[key])
			throw new Refusal(
				'REQUEST_INVALID',
				'The exact declared slice policy is required.',
				`$.policy.${key}`
			);
	return MODULE_CODE_SLICE_POLICY;
}

function request(value: unknown): ModuleCodeSliceRequest {
	const record = plainRecord(value, REQUEST_KEYS, '$');
	const budgetRecord = plainRecord(record.budgets, BUDGET_KEYS, '$.budgets');
	const budgets = {} as Record<(typeof BUDGET_KEYS)[number], number>;
	for (const key of BUDGET_KEYS) {
		const amount = budgetRecord[key];
		if (
			typeof amount !== 'number' ||
			!Number.isSafeInteger(amount) ||
			amount < (key === 'maxDepth' ? 0 : 1) ||
			amount > SAFETY[key]
		)
			throw new Refusal(
				'REQUEST_INVALID',
				'Slice budget is outside its safety range.',
				`$.budgets.${key}`
			);
		budgets[key] = amount;
	}
	if (record.schemaVersion !== MODULE_CODE_SLICE_REQUEST_SCHEMA_VERSION)
		throw new Refusal(
			'REQUEST_INVALID',
			'Unsupported slice request schema version.',
			'$.schemaVersion'
		);
	if (record.operationVersion !== MODULE_CODE_SLICE_OPERATION_VERSION)
		throw new Refusal(
			'REQUEST_INVALID',
			'Unsupported slice operation version.',
			'$.operationVersion'
		);
	const policy = exactPolicy(record.policy);
	if (
		record.direction !== 'FORWARD' &&
		record.direction !== 'BACKWARD' &&
		record.direction !== 'CHOP'
	)
		throw new Refusal('REQUEST_INVALID', 'Unsupported slice direction.', '$.direction');
	const requestedFamilies = exactStringArray(record.edgeFamilies, '$.edgeFamilies');
	if (requestedFamilies.length === 0)
		throw new Refusal('REQUEST_INVALID', 'At least one edge family is required.', '$.edgeFamilies');
	const edgeFamilies = requestedFamilies.map((family, index) => {
		if (!RELATION_KINDS.includes(family as ModuleDependencyGraphRelationKind))
			throw new Refusal('REQUEST_INVALID', 'Unknown edge family.', `$.edgeFamilies[${index}]`);
		return family as ModuleDependencyGraphRelationKind;
	});
	const canonicalFamilies = [...new Set(edgeFamilies)].sort(compareText);
	if (
		canonicalFamilies.length !== edgeFamilies.length ||
		canonicalFamilies.some((family, index) => family !== edgeFamilies[index])
	)
		throw new Refusal(
			'REQUEST_INVALID',
			'Edge families must be sorted and unique.',
			'$.edgeFamilies'
		);
	const fromNodeId = scalar(record.fromNodeId, '$.fromNodeId') as ModuleDependencyGraphNodeId;
	const toNodeId =
		record.toNodeId === null
			? null
			: (scalar(record.toNodeId, '$.toNodeId') as ModuleDependencyGraphNodeId);
	if ((record.direction === 'CHOP') !== (toNodeId !== null))
		throw new Refusal(
			'REQUEST_INVALID',
			'CHOP requires toNodeId and other directions require it to be null.',
			'$.toNodeId'
		);
	return {
		budgets: budgets as unknown as ModuleCodeSliceBudgets,
		direction: record.direction,
		edgeFamilies: canonicalFamilies,
		fromNodeId,
		graphId: scalar(record.graphId, '$.graphId') as ModuleDependencyGraphSnapshot['id'],
		operationVersion: MODULE_CODE_SLICE_OPERATION_VERSION,
		policy,
		schemaVersion: MODULE_CODE_SLICE_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: scalar(
			record.semanticSnapshotId,
			'$.semanticSnapshotId'
		) as StaticSemanticSnapshot['id'],
		subjectId: scalar(record.subjectId, '$.subjectId'),
		toNodeId
	};
}

interface Arc {
	readonly edge: ModuleDependencyGraphEdge;
	readonly from: ModuleDependencyGraphNodeId;
	readonly to: ModuleDependencyGraphNodeId;
}

interface FrontierArc {
	readonly arc: Arc;
	readonly reason: 'DEPTH' | 'MEMBERS' | 'TRAVERSAL_STEPS';
}

interface Traversal {
	readonly distance: Map<ModuleDependencyGraphNodeId, number>;
	readonly frontierArcs: FrontierArc[];
	readonly predecessor: Map<ModuleDependencyGraphNodeId, Arc>;
	readonly reasons: Set<'DEPTH' | 'MEMBERS' | 'TRAVERSAL_STEPS'>;
	readonly steps: number;
}

function adjacency(
	edges: readonly ModuleDependencyGraphEdge[],
	direction: 'FORWARD' | 'BACKWARD'
): Map<ModuleDependencyGraphNodeId, Arc[]> {
	const result = new Map<ModuleDependencyGraphNodeId, Arc[]>();
	for (const edge of edges) {
		const from = direction === 'FORWARD' ? edge.source.nodeId : edge.target.nodeId;
		const to = direction === 'FORWARD' ? edge.target.nodeId : edge.source.nodeId;
		const group = result.get(from) ?? [];
		group.push({ edge, from, to });
		result.set(from, group);
	}
	for (const group of result.values())
		group.sort((left, right) => compareText(left.edge.id, right.edge.id));
	return result;
}

function traverse(
	start: ModuleDependencyGraphNodeId,
	index: ReadonlyMap<ModuleDependencyGraphNodeId, readonly Arc[]>,
	budgets: ModuleCodeSliceBudgets
): Traversal {
	const distance = new Map<ModuleDependencyGraphNodeId, number>([[start, 0]]);
	const predecessor = new Map<ModuleDependencyGraphNodeId, Arc>();
	const frontierArcs: FrontierArc[] = [];
	const reasons = new Set<'DEPTH' | 'MEMBERS' | 'TRAVERSAL_STEPS'>();
	const queue = [start];
	let cursor = 0;
	let steps = 0;
	while (cursor < queue.length) {
		const current = queue[cursor++]!;
		const currentDistance = distance.get(current)!;
		for (const arc of index.get(current) ?? []) {
			if (steps >= budgets.maxTraversalSteps) {
				reasons.add('TRAVERSAL_STEPS');
				frontierArcs.push({ arc, reason: 'TRAVERSAL_STEPS' });
				continue;
			}
			steps += 1;
			if (distance.has(arc.to)) continue;
			if (currentDistance >= budgets.maxDepth) {
				reasons.add('DEPTH');
				frontierArcs.push({ arc, reason: 'DEPTH' });
				continue;
			}
			if (distance.size >= budgets.maxMembers) {
				reasons.add('MEMBERS');
				frontierArcs.push({ arc, reason: 'MEMBERS' });
				continue;
			}
			distance.set(arc.to, currentDistance + 1);
			predecessor.set(arc.to, arc);
			queue.push(arc.to);
		}
	}
	return { distance, frontierArcs, predecessor, reasons, steps };
}

function witness(
	start: ModuleDependencyGraphNodeId,
	target: ModuleDependencyGraphNodeId,
	predecessor: ReadonlyMap<ModuleDependencyGraphNodeId, Arc>
): ModuleCodeSliceWitnessPath {
	const nodes: ModuleDependencyGraphNodeId[] = [target];
	const edges: ModuleDependencyGraphEdgeId[] = [];
	let current = target;
	while (current !== start) {
		const arc = predecessor.get(current);
		if (arc === undefined) throw new Error('Reached slice member lacks its canonical predecessor.');
		edges.push(arc.edge.id);
		current = arc.from;
		nodes.push(current);
	}
	return { edgeIds: edges.reverse(), nodeIds: nodes.reverse() };
}

function combineWitness(
	left: ModuleCodeSliceWitnessPath,
	rightTraversalWitness: ModuleCodeSliceWitnessPath
): ModuleCodeSliceWitnessPath {
	return {
		edgeIds: [...left.edgeIds, ...rightTraversalWitness.edgeIds].filter(
			(id, index, values) => index === 0 || id !== values[index - 1]
		),
		nodeIds: [...left.nodeIds, ...rightTraversalWitness.nodeIds.slice(1)]
	};
}

function memberEpistemic(
	node: ModuleDependencyGraphNode,
	witnessPath: ModuleCodeSliceWitnessPath,
	edgeById: ReadonlyMap<ModuleDependencyGraphEdgeId, ModuleDependencyGraphEdge>
): ModuleCodeSliceMember['epistemic'] {
	const states = [node.epistemic, ...witnessPath.edgeIds.map((id) => edgeById.get(id)?.epistemic)];
	if (states.includes('CONFLICTING')) return 'CONFLICTING';
	if (states.some((state) => state !== 'SUPPORTED')) return 'POSSIBLE';
	return 'CONFIRMED';
}

function frontierRecords(
	traversals: readonly Traversal[],
	nodeById: ReadonlyMap<ModuleDependencyGraphNodeId, ModuleDependencyGraphNode>,
	graph: ModuleDependencyGraphSnapshot,
	includedIds: ReadonlySet<ModuleDependencyGraphNodeId>,
	fallbackNodeId: ModuleDependencyGraphNodeId,
	budgets: ModuleCodeSliceBudgets
): ModuleCodeSliceFrontier[] {
	const byKey = new Map<string, Omit<ModuleCodeSliceFrontier, 'ordinal'>>();
	for (const traversal of traversals)
		for (const frontier of traversal.frontierArcs) {
			const { arc } = frontier;
			const reason =
				frontier.reason === 'TRAVERSAL_STEPS'
					? 'Traversal-step budget stopped this path.'
					: frontier.reason === 'MEMBERS'
						? 'Member budget stopped this path.'
						: 'Depth budget stopped this path.';
			const kind =
				frontier.reason === 'TRAVERSAL_STEPS'
					? 'TRAVERSAL_BOUNDARY'
					: frontier.reason === 'MEMBERS'
						? 'MEMBER_BOUNDARY'
						: 'DEPTH_BOUNDARY';
			byKey.set(`${kind}\0${arc.edge.id}\0${arc.from}\0${arc.to}`, {
				edgeId: arc.edge.id,
				fromNodeId: arc.from,
				kind,
				reason,
				toNodeId: arc.to
			});
		}
	for (const traversal of traversals)
		for (const nodeId of traversal.distance.keys()) {
			const node = nodeById.get(nodeId);
			if (node?.kind !== 'RESOLUTION_TARGET') continue;
			byKey.set(`RESOLUTION_TARGET\0${nodeId}`, {
				edgeId: null,
				fromNodeId: nodeId,
				kind: 'RESOLUTION_TARGET',
				reason: `Module resolution remains ${node.resolutionState}.`,
				toNodeId: null
			});
		}
	const sourceNodeBySemanticId = new Map(
		graph.nodes
			.filter(
				(node): node is Extract<ModuleDependencyGraphNode, { kind: 'SOURCE' }> =>
					node.kind === 'SOURCE'
			)
			.map((node) => [node.semanticSourceId, node])
	);
	for (const limitation of graph.limitations) {
		if (limitation.closureEffect !== 'DEGRADES_CLOSURE') continue;
		const sourceNode =
			limitation.sourceId === null ? undefined : sourceNodeBySemanticId.get(limitation.sourceId);
		if (sourceNode !== undefined && !includedIds.has(sourceNode.id)) continue;
		const fromNodeId = sourceNode?.id ?? fallbackNodeId;
		byKey.set(
			`GRAPH_COVERAGE\0${limitation.kind}\0${limitation.moduleResolutionId ?? ''}\0${fromNodeId}`,
			{
				edgeId: null,
				fromNodeId,
				kind: 'GRAPH_COVERAGE',
				reason: `${limitation.kind}: ${limitation.reason}`,
				toNodeId: null
			}
		);
	}
	if (
		graph.coverage.closure === 'OPEN' &&
		![...byKey.values()].some((entry) => entry.kind === 'GRAPH_COVERAGE')
	)
		byKey.set(`GRAPH_COVERAGE\0UNEXPLAINED\0${fallbackNodeId}`, {
			edgeId: null,
			fromNodeId: fallbackNodeId,
			kind: 'GRAPH_COVERAGE',
			reason:
				'The validated module graph declares open coverage without a slice-local closing proof.',
			toNodeId: null
		});
	const ordered = [...byKey.values()].sort((left, right) =>
		compareText(
			`${left.kind}\0${left.edgeId ?? ''}\0${left.fromNodeId}\0${left.toNodeId ?? ''}`,
			`${right.kind}\0${right.edgeId ?? ''}\0${right.fromNodeId}\0${right.toNodeId ?? ''}`
		)
	);
	if (ordered.length > budgets.maxFrontiers)
		throw new Refusal(
			'BUDGET_EXCEEDED',
			'The complete explicit slice-frontier population exceeds maxFrontiers.',
			'$.budgets.maxFrontiers'
		);
	return ordered.map((record, ordinal) => ({ ...record, ordinal }));
}

function resultContent(result: Omit<ModuleCodeSliceResult, 'contentDigest' | 'id'>) {
	return result;
}

function unavailable(
	code: ModuleCodeSliceDiagnostic['code'],
	message: string,
	path: string | null
): ModuleCodeSliceOutcome {
	return deepFreezeConstructed({ diagnostics: [{ code, message, path }], outcome: 'unavailable' });
}

export function buildModuleCodeSlice(
	requestValue: unknown,
	graph: ModuleDependencyGraphSnapshot,
	semanticSnapshot: StaticSemanticSnapshot
): ModuleCodeSliceOutcome {
	try {
		const accepted = request(requestValue);
		if (
			accepted.graphId !== graph.id ||
			accepted.semanticSnapshotId !== graph.semanticSnapshotId ||
			accepted.semanticSnapshotId !== semanticSnapshot.id ||
			accepted.subjectId !== graph.subjectId ||
			accepted.subjectId !== semanticSnapshot.subjectId
		)
			throw new Refusal(
				'IDENTITY_MISMATCH',
				'Slice request, graph, semantic snapshot, and subject identities differ.',
				null
			);
		if (
			graph.nodes.length > accepted.budgets.maxInputNodes ||
			graph.edges.length > accepted.budgets.maxInputEdges
		)
			throw new Refusal(
				'BUDGET_EXCEEDED',
				'The complete graph population exceeds its input budget.',
				'$.budgets'
			);
		const validation = validateModuleDependencyGraph(graph, semanticSnapshot);
		if (validation.state !== 'VALID')
			throw new Refusal('GRAPH_INVALID', 'The source graph failed independent validation.', null);
		const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
		if (
			!nodeById.has(accepted.fromNodeId) ||
			(accepted.toNodeId !== null && !nodeById.has(accepted.toNodeId))
		)
			throw new Refusal(
				'REQUEST_INVALID',
				'A slice criterion node is absent from the graph.',
				null
			);
		const selected = graph.edges.filter((edge) =>
			accepted.edgeFamilies.includes(edge.relationKind)
		);
		const edgeById = new Map(selected.map((edge) => [edge.id, edge]));
		const forward = traverse(
			accepted.fromNodeId,
			adjacency(selected, accepted.direction === 'BACKWARD' ? 'BACKWARD' : 'FORWARD'),
			accepted.budgets
		);
		const traversals: Traversal[] = [forward];
		let terminal: Traversal | null = null;
		let includedIds: ModuleDependencyGraphNodeId[];
		if (accepted.direction === 'CHOP') {
			terminal = traverse(accepted.toNodeId!, adjacency(selected, 'BACKWARD'), accepted.budgets);
			traversals.push(terminal);
			includedIds = [...forward.distance.keys()].filter((id) => terminal!.distance.has(id));
		} else includedIds = [...forward.distance.keys()];
		includedIds.sort(compareText);
		if (includedIds.length > accepted.budgets.maxMembers)
			throw new Refusal(
				'BUDGET_EXCEEDED',
				'The slice member population exceeds maxMembers.',
				'$.budgets.maxMembers'
			);
		let witnessEdges = 0;
		const members = includedIds.map((nodeId, ordinal): ModuleCodeSliceMember => {
			const left = witness(accepted.fromNodeId, nodeId, forward.predecessor);
			let completeWitness = left;
			let distanceToTerminal: number | null = null;
			if (terminal !== null) {
				const reversePath = witness(accepted.toNodeId!, nodeId, terminal.predecessor);
				const memberToTerminal: ModuleCodeSliceWitnessPath = {
					edgeIds: [...reversePath.edgeIds].reverse(),
					nodeIds: [...reversePath.nodeIds].reverse()
				};
				completeWitness = combineWitness(left, memberToTerminal);
				distanceToTerminal = terminal.distance.get(nodeId)!;
			}
			witnessEdges += completeWitness.edgeIds.length;
			if (witnessEdges > accepted.budgets.maxWitnessEdges)
				throw new Refusal(
					'BUDGET_EXCEEDED',
					'The cumulative witness population exceeds maxWitnessEdges.',
					'$.budgets.maxWitnessEdges'
				);
			const node = nodeById.get(nodeId)!;
			const provenanceIds = [
				...node.provenanceIds,
				...completeWitness.edgeIds.flatMap((edgeId) => edgeById.get(edgeId)?.provenanceIds ?? [])
			]
				.filter((id, index, values) => values.indexOf(id) === index)
				.sort(compareText);
			return {
				distanceFromCriterion: forward.distance.get(nodeId)!,
				distanceToTerminal,
				epistemic: memberEpistemic(node, completeWitness, edgeById),
				nodeId,
				nodeKind: node.kind,
				ordinal,
				provenanceIds,
				witness: completeWitness
			};
		});
		const frontiers = frontierRecords(
			traversals,
			nodeById,
			graph,
			new Set(includedIds),
			accepted.fromNodeId,
			accepted.budgets
		);
		const truncationReasons = [...new Set(traversals.flatMap((entry) => [...entry.reasons]))].sort(
			compareText
		);
		const closure =
			graph.coverage.closure === 'CLOSED' &&
			frontiers.length === 0 &&
			truncationReasons.length === 0
				? 'CLOSED_FOR_SELECTED_GRAPH'
				: 'OPEN';
		const content = resultContent({
			capability: MODULE_CODE_SLICE_CAPABILITY,
			capabilityStatus: MODULE_CODE_SLICE_CAPABILITY_STATUS,
			closure,
			coverage: {
				examinedEdges: traversals.reduce((total, entry) => total + entry.steps, 0),
				frontiers: frontiers.length,
				inputEdges: graph.edges.length,
				inputNodes: graph.nodes.length,
				members: members.length,
				selectedEdges: selected.length,
				witnessEdges
			},
			direction: accepted.direction,
			edgeFamilies: accepted.edgeFamilies,
			fromNodeId: accepted.fromNodeId,
			frontiers,
			graphId: graph.id,
			members,
			method: MODULE_CODE_SLICE_METHOD,
			nonclaims: MODULE_CODE_SLICE_NONCLAIMS,
			operationVersion: MODULE_CODE_SLICE_OPERATION_VERSION,
			policy: MODULE_CODE_SLICE_POLICY,
			schemaVersion: MODULE_CODE_SLICE_SCHEMA_VERSION,
			semanticSnapshotId: semanticSnapshot.id,
			subjectId: semanticSnapshot.subjectId,
			toNodeId: accepted.toNodeId,
			truncation: {
				reasons: truncationReasons,
				state: truncationReasons.length === 0 ? 'NOT_TRUNCATED' : 'TRUNCATED'
			}
		});
		const id = canonicalSemanticJsonPrefixedSha256('module-slice:', content);
		const resultWithoutDigest = { ...content, id };
		const result: ModuleCodeSliceResult = {
			...resultWithoutDigest,
			contentDigest: canonicalSemanticJsonPrefixedSha256('sha256:', resultWithoutDigest)
		};
		if (canonicalSemanticJsonWitness(result).bytes + 1 > accepted.budgets.maxResultBytes)
			throw new Refusal(
				'RESULT_BUDGET_EXCEEDED',
				'The canonical slice result exceeds maxResultBytes.',
				'$.budgets.maxResultBytes'
			);
		return deepFreezeConstructed({
			diagnostics:
				closure === 'OPEN'
					? [
							{
								code: 'OPEN_FRONTIER',
								message:
									'Slice remains open because upstream resolution or a declared traversal bound exposes a frontier.',
								path: null
							}
						]
					: [],
			outcome: closure === 'CLOSED_FOR_SELECTED_GRAPH' ? 'complete' : 'partial',
			result
		});
	} catch (error) {
		if (error instanceof Refusal) return unavailable(error.code, error.message, error.path);
		return unavailable('REQUEST_INVALID', 'The module slice failed closed.', null);
	}
}

/**
 * Reconstructs the deterministic outcome from its bound inputs and compares canonical bytes. This
 * detects storage or transport mutation; it does not constitute an independent analysis method.
 */
export function validateModuleCodeSliceOutcome(
	requestValue: unknown,
	candidate: unknown,
	graph: ModuleDependencyGraphSnapshot,
	semanticSnapshot: StaticSemanticSnapshot
): ModuleCodeSliceValidationResult {
	const expected = buildModuleCodeSlice(requestValue, graph, semanticSnapshot);
	if (expected.outcome === 'unavailable')
		return deepFreezeConstructed({
			issues: [
				{
					code: 'EXPECTED_OUTCOME_UNAVAILABLE' as const,
					message: 'The bound inputs do not produce an outcome that can be validated.'
				}
			],
			state: 'INVALID' as const
		});
	try {
		const expectedWitness = canonicalSemanticJsonWitness(expected);
		const candidateWitness = canonicalSemanticJsonWitness(candidate);
		if (
			expectedWitness.bytes !== candidateWitness.bytes ||
			expectedWitness.sha256 !== candidateWitness.sha256
		)
			return deepFreezeConstructed({
				issues: [
					{
						code: 'OUTCOME_MISMATCH' as const,
						message: 'Canonical outcome bytes differ from deterministic reconstruction.'
					}
				],
				state: 'INVALID' as const
			});
		return deepFreezeConstructed({ issues: [] as const, state: 'VALID' as const });
	} catch {
		return deepFreezeConstructed({
			issues: [
				{
					code: 'OUTCOME_INVALID' as const,
					message: 'The candidate is not finite canonical plain data.'
				}
			],
			state: 'INVALID' as const
		});
	}
}
