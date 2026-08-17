import { isProxy } from 'node:util/types';
import ts from 'typescript';

import type { ArrowCommandCensusObservation } from '../contracts/arrow-command-census.js';
import type {
	CommandHandlerGraphSnapshot,
	HandlerRegistrationNode,
	HandlerTargetNode
} from '../contracts/command-handler-graph.js';
import {
	COMMAND_DISPATCH_TOPOLOGY_AUTHORITY_TRANSFER,
	COMMAND_DISPATCH_TOPOLOGY_BASELINE_CHANGE,
	COMMAND_DISPATCH_TOPOLOGY_CANONICAL_PROFILE,
	COMMAND_DISPATCH_TOPOLOGY_CAPABILITY_STATUS,
	COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_LOGICAL_PATH,
	COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_METHOD_NAME,
	COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_PROJECT_CONFIG_PATH,
	COMMAND_DISPATCH_TOPOLOGY_COMMAND_HANDLER_POPULATION_TREATMENT,
	COMMAND_DISPATCH_TOPOLOGY_DERIVATION_CAPABILITY,
	COMMAND_DISPATCH_TOPOLOGY_FULL_JAN_CSAA_007_CONFORMANCE,
	COMMAND_DISPATCH_TOPOLOGY_FULL_JAN_CSAA_008_CONFORMANCE,
	COMMAND_DISPATCH_TOPOLOGY_GATE_EFFECT,
	COMMAND_DISPATCH_TOPOLOGY_GRAPH_AUTHORITY,
	COMMAND_DISPATCH_TOPOLOGY_INFERENCE_CAPABILITY,
	COMMAND_DISPATCH_TOPOLOGY_INTEGRATION_STRATEGY,
	COMMAND_DISPATCH_TOPOLOGY_LIMITATIONS,
	COMMAND_DISPATCH_TOPOLOGY_METHOD,
	COMMAND_DISPATCH_TOPOLOGY_OPERATION_VERSION,
	COMMAND_DISPATCH_TOPOLOGY_ORACLE_CHANGE,
	COMMAND_DISPATCH_TOPOLOGY_REGISTRY_STATUS,
	COMMAND_DISPATCH_TOPOLOGY_REPLACEMENT_EQUIVALENCE,
	COMMAND_DISPATCH_TOPOLOGY_REQUEST_SCHEMA_VERSION,
	COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_INTEGRATION,
	COMMAND_DISPATCH_TOPOLOGY_RUNTIME_DISPATCH_CLOSURE,
	COMMAND_DISPATCH_TOPOLOGY_RUNTIME_PERFORMABILITY,
	COMMAND_DISPATCH_TOPOLOGY_SCHEMA_VERSION,
	COMMAND_DISPATCH_TOPOLOGY_SCOPE,
	type BuildCommandDispatchTopologyRequest,
	type CommandDispatchPipelineNode,
	type CommandDispatchTopologyCoverage,
	type CommandDispatchTopologyEdge,
	type CommandDispatchTopologyIndexEntry,
	type CommandDispatchTopologyLayer,
	type CommandDispatchTopologySnapshot,
	type CommandDispatchTopologySourceLocation,
	type CommandDispatchTopologyValidationIssue,
	type CommandDispatchTopologyValidationIssueCode,
	type CommandDispatchTopologyValidationOptions,
	type CommandDispatchTopologyValidationResult
} from '../contracts/command-dispatch-topology.js';
import type {
	SemanticAssignmentRecord,
	SemanticAstNodeRecord,
	SemanticDeclarationRecord,
	SemanticInvocationSiteRecord,
	SemanticProvenanceId,
	SemanticReferenceRecord,
	SemanticSourceRecord,
	SemanticSymbolId,
	StaticSemanticSnapshot
} from '../contracts/semantic.js';
import type { FrozenSubject } from '../contracts/subject.js';
import { compareText, sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import { readFrozenSubjectArtifact } from '../subject/frozen-store.js';
import {
	commandDispatchPipelineNodeId,
	commandDispatchTopologyContentDigest,
	commandDispatchTopologyDerivationLayerId,
	commandDispatchTopologyEdgeId,
	commandDispatchTopologyGraphId,
	commandDispatchTopologyInferenceLayerId,
	commandDispatchTopologyInputDigest,
	commandDispatchTopologyRetainedCensusReference
} from './command-dispatch-topology-canonical.js';
import { validateCommandHandlerGraph } from './validate-command-handler-graph.js';

const REQUEST_KEYS = [
	'budgets',
	'commandBus',
	'commandHandlerGraphId',
	'operationVersion',
	'schemaVersion',
	'semanticSnapshotId',
	'subjectId'
] as const;
const BUDGET_KEYS = [
	'maxAstNodes',
	'maxDiagnostics',
	'maxEdges',
	'maxHandlerTargets',
	'maxNodes',
	'maxSourceBytes'
] as const;
const SELECTOR_KEYS = [
	'contentSha256',
	'declarationId',
	'logicalPath',
	'methodName',
	'programId',
	'projectConfigPath',
	'projectId',
	'sourceId'
] as const;
const TOP_LEVEL_KEYS = [
	'arrowObservationContentDigest',
	'arrowObservationId',
	'authorityTransfer',
	'baselineChange',
	'budgets',
	'canonicalProfile',
	'capabilities',
	'capabilityStatus',
	'commandBus',
	'commandHandlerGraphContentDigest',
	'commandHandlerGraphId',
	'commandHandlerGraphSchemaVersion',
	'commandHandlerPopulationTreatment',
	'contentDigest',
	'coverage',
	'edges',
	'forwardIndex',
	'fullJanCsaa007Conformance',
	'fullJanCsaa008Conformance',
	'gateEffect',
	'graphAuthority',
	'graphInputDigest',
	'graphKind',
	'health',
	'id',
	'integrationStrategy',
	'layers',
	'limitations',
	'method',
	'nodes',
	'operationVersion',
	'oracleChange',
	'producer',
	'registryStatus',
	'replacementEquivalence',
	'retainedCommandDispatchCensus',
	'retainedCommandDispatchCensusIntegration',
	'reverseIndex',
	'runtimeDispatchClosure',
	'runtimePerformability',
	'schemaVersion',
	'scope',
	'semanticExtractionVersion',
	'semanticSchemaVersion',
	'semanticSnapshotId',
	'subjectId'
] as const;
const RETAINED_CENSUS_KEYS = [
	'artifactBytes',
	'artifactContentSha256',
	'artifactPath',
	'authorityTransfer',
	'execution',
	'gateEffect',
	'integration',
	'oracleChange',
	'replacementEquivalence',
	'verifierAuthority'
] as const;
const COVERAGE_KEYS = [
	'candidateHandlerTargetEdges',
	'commandHandlerGraphHandlerTargets',
	'commandsLookupAssignments',
	'duplicatedCommandHandlerNodes',
	'duplicatedCommandRegistryEntries',
	'duplicatedHandlerRegistrations',
	'handlerInvocations',
	'handlersLookupAssignments',
	'missingHandlerGuards',
	'payloadValidationInvocations',
	'pipelineNodes',
	'reconciles',
	'referencedHandlerTargets',
	'representedPipelineFacts',
	'unresolvedHandlerTargets'
] as const;
const PIPELINE_NODE_KEYS = [
	'attribution',
	'commandBusDeclarationId',
	'commandHandlerGraphId',
	'commandsLookup',
	'graphId',
	'handlerInvocation',
	'handlersLookup',
	'id',
	'kind',
	'layerId',
	'methodName',
	'missingHandlerGuard',
	'payloadValidationInvocation',
	'programId',
	'projectId',
	'provenanceIds',
	'semanticSnapshotId',
	'sourceId',
	'sourceLocations',
	'subjectId'
] as const;
const LOOKUP_BINDING_KEYS = [
	'assignmentNodeId',
	'commandTypeReferenceId',
	'registryName',
	'registryReferenceId',
	'targetNodeId',
	'valueNodeId'
] as const;
const INVOCATION_BINDING_KEYS = [
	'calleeNodeId',
	'calleeReferenceId',
	'invocationId',
	'invocationNodeId'
] as const;
const PAYLOAD_VALIDATION_BINDING_KEYS = [
	...INVOCATION_BINDING_KEYS,
	'commandPayloadArgumentNodeId',
	'parsedValueNodeId',
	'schemaArgumentNodeId'
] as const;
const GUARD_BINDING_KEYS = [
	'conditionNodeId',
	'guardedHandlerReferenceId',
	'guardedHandlerValueNodeId',
	'guardStatementNodeId'
] as const;
const HANDLER_INVOCATION_BINDING_KEYS = [
	...INVOCATION_BINDING_KEYS,
	'commandArgumentNodeId',
	'contextArgumentNodeId',
	'parsedPayloadArgumentNodeId'
] as const;
const EDGE_KEYS = [
	'attribution',
	'commandHandlerGraphId',
	'graphId',
	'id',
	'inferenceBasis',
	'layerId',
	'method',
	'provenanceIds',
	'registeredCommandNames',
	'relationCode',
	'relationKind',
	'semanticSnapshotId',
	'source',
	'sourceLocations',
	'subjectId',
	'target'
] as const;
const INFERENCE_BASIS_KEYS = [
	'assumptions',
	'limitationKinds',
	'method',
	'rationale',
	'supportingInputIds'
] as const;
const ENDPOINT_KEYS = ['graphId', 'kind', 'nodeId'] as const;
const INDEX_KEYS = ['edgeIds', 'endpointOwner', 'graphId', 'nodeId'] as const;
const LAYER_KEYS = [
	'capability',
	'capabilityStatus',
	'commandHandlerGraphId',
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
	'registryStatus',
	'semanticSnapshotId',
	'subjectId'
] as const;
const LOCATION_KEYS = ['end', 'sourceId', 'start'] as const;
const LIMITATION_KEYS = ['kind', 'reason'] as const;

const TRANSPARENT_EXPRESSION_KINDS = new Set<number>([
	ts.SyntaxKind.AsExpression,
	ts.SyntaxKind.SatisfiesExpression,
	ts.SyntaxKind.TypeAssertionExpression,
	ts.SyntaxKind.ParenthesizedExpression,
	ts.SyntaxKind.NonNullExpression
]);

interface ValidationLimits {
	readonly maxIssues: number;
	readonly maxRecords: number;
	readonly maxStringCharacters: number;
}

interface SemanticIndexes {
	readonly assignmentsByNode: ReadonlyMap<string, SemanticAssignmentRecord[]>;
	readonly childrenByParent: ReadonlyMap<string, SemanticAstNodeRecord[]>;
	readonly declarationById: ReadonlyMap<string, SemanticDeclarationRecord>;
	readonly declarationsByNode: ReadonlyMap<string, SemanticDeclarationRecord[]>;
	readonly invocationByNode: ReadonlyMap<string, SemanticInvocationSiteRecord>;
	readonly nodeById: ReadonlyMap<string, SemanticAstNodeRecord>;
	readonly projectConfigById: ReadonlyMap<string, string>;
	readonly provenances: ReadonlySet<string>;
	readonly referenceById: ReadonlyMap<string, SemanticReferenceRecord>;
	readonly referencesByNode: ReadonlyMap<string, SemanticReferenceRecord[]>;
	readonly sourceById: ReadonlyMap<string, SemanticSourceRecord>;
}

function exactKeys(value: object, expected: readonly string[]): boolean {
	const keys = Reflect.ownKeys(value);
	if (keys.length !== expected.length || keys.some((key) => typeof key !== 'string')) return false;
	const actual = (keys as string[]).sort(compareText);
	const wanted = [...expected].sort(compareText);
	return actual.every((key, index) => key === wanted[index]);
}

function plainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		return false;
	const prototype = Reflect.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function same(left: unknown, right: unknown): boolean {
	return canonicalSemanticJson(left) === canonicalSemanticJson(right);
}

function sortedUnique<T extends string>(values: Iterable<T>): T[] {
	return [...new Set(values)].sort(compareText);
}

function addGrouped<Key, Value>(map: Map<Key, Value[]>, key: Key, value: Value): void {
	const values = map.get(key);
	if (values === undefined) map.set(key, [value]);
	else values.push(value);
}

function materializeOptions(
	options: CommandDispatchTopologyValidationOptions | undefined
): ValidationLimits {
	if (options === undefined)
		return { maxIssues: 1_000, maxRecords: 10_000_000, maxStringCharacters: 1_000_000_000 };
	if (!plainObject(options))
		throw new TypeError('Validation options must be an exact plain record.');
	const allowed = new Set(['maxIssues', 'maxRecords', 'maxStringCharacters']);
	const keys = Reflect.ownKeys(options);
	if (keys.some((key) => typeof key !== 'string' || !allowed.has(key)))
		throw new TypeError('Validation options contain an unsupported field.');
	for (const key of keys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(options, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new TypeError('Validation options must contain enumerable data properties only.');
	}
	const typedOptions = options as CommandDispatchTopologyValidationOptions;
	const limits: ValidationLimits = {
		maxIssues: typedOptions.maxIssues ?? 1_000,
		maxRecords: typedOptions.maxRecords ?? 10_000_000,
		maxStringCharacters: typedOptions.maxStringCharacters ?? 1_000_000_000
	};
	for (const [key, value] of Object.entries(limits))
		if (!Number.isSafeInteger(value) || value < 1)
			throw new TypeError(`${key} must be a positive safe integer.`);
	return limits;
}

interface InspectionFailure {
	readonly budget: boolean;
	readonly message: string;
	readonly path: string;
}

interface InspectionFrame {
	readonly exit: boolean;
	readonly path: string;
	readonly value: unknown;
}

interface InspectionCounters {
	characters: number;
	records: number;
}

/** Charge a string population against the character budget; true once the budget is exceeded. */
function chargeCharacters(
	state: InspectionCounters,
	characters: number,
	limits: Pick<ValidationLimits, 'maxStringCharacters'>
): boolean {
	state.characters += characters;
	return state.characters > limits.maxStringCharacters;
}

/** A dense array carries exactly its own index keys plus `length`. */
function denseArrayKey(key: PropertyKey, length: number): boolean {
	if (key === 'length') return true;
	if (typeof key !== 'string') return false;
	const index = Number(key);
	return Number.isSafeInteger(index) && index >= 0 && index < length && String(index) === key;
}

/**
 * The checks that MUST run BEFORE `Reflect.ownKeys`, and the reason this is split in two.
 *
 * ⚠ THIS SPLIT IS LOAD-BEARING, NOT COSMETIC. The array-population budget refusal is a PRE-ADMISSION
 * bound: it exists so a hostile array is rejected before anything materializes a per-element key
 * population. `Reflect.ownKeys` on an array of length N allocates N+1 index strings, so calling it
 * first turns a clean `BUDGET_EXHAUSTED` outcome into an out-of-memory abort of the whole process —
 * the exact denial this validator is here to refuse. A decomposition briefly hoisted the `ownKeys`
 * call above these checks; it type-checked, and every test passed.
 *
 * Failure precedence must stay: prototype -> array budget -> symbol keys -> density.
 */
function containerPreKeyFailure(
	current: object,
	path: string,
	admissibleRecords: number
): InspectionFailure | null {
	const array = Array.isArray(current) ? current : null;
	const prototype = Reflect.getPrototypeOf(current);
	if (
		(array !== null && prototype !== Array.prototype) ||
		(array === null && prototype !== Object.prototype && prototype !== null)
	)
		return { budget: false, message: 'Containers must have plain prototypes.', path };
	if (array !== null && array.length > admissibleRecords)
		return {
			budget: true,
			message: 'Structural record budget cannot admit the array population.',
			path
		};
	return null;
}

/** The checks that need the key population, run only once the container is admitted. */
function containerKeyFailure(
	current: object,
	keys: readonly PropertyKey[],
	path: string
): InspectionFailure | null {
	const array = Array.isArray(current) ? current : null;
	if (keys.some((key) => typeof key !== 'string'))
		return { budget: false, message: 'Containers may not have symbol keys.', path };
	if (array !== null) {
		const length = array.length;
		if (keys.length !== length + 1 || keys.some((key) => !denseArrayKey(key, length)))
			return {
				budget: false,
				message: 'Arrays must be dense and may not carry extra properties.',
				path
			};
	}
	return null;
}

/** Enqueue every own data member of an admitted container, charging its key characters. */
function enqueueContainerMembers(
	current: object,
	keys: readonly PropertyKey[],
	path: string,
	state: InspectionCounters,
	limits: Pick<ValidationLimits, 'maxStringCharacters'>,
	pending: InspectionFrame[]
): InspectionFailure | null {
	const array = Array.isArray(current);
	for (const key of keys) {
		if (array && key === 'length') continue;
		const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			return {
				budget: false,
				message: 'Properties must be enumerable data properties.',
				path: `${path}.${String(key)}`
			};
		if (chargeCharacters(state, String(key).length, limits))
			return {
				budget: true,
				message: 'String-character budget exceeded while inspecting keys.',
				path
			};
		pending.push({
			exit: false,
			path: array ? `${path}[${String(key)}]` : `${path}.${String(key)}`,
			value: descriptor.value
		});
	}
	return null;
}

/** Inspect one pending frame; a non-null result is the refusal that ends the whole walk. */
function inspectFrame(
	frame: InspectionFrame,
	state: InspectionCounters,
	limits: Pick<ValidationLimits, 'maxRecords' | 'maxStringCharacters'>,
	active: WeakSet<object>,
	pending: InspectionFrame[]
): InspectionFailure | null {
	const current = frame.value;
	if (frame.exit) {
		active.delete(current as object);
		return null;
	}
	state.records += 1;
	if (state.records > limits.maxRecords)
		return {
			budget: true,
			message: `Structural record budget exceeded: ${state.records} > ${limits.maxRecords}.`,
			path: frame.path
		};
	if (typeof current === 'string') {
		if (chargeCharacters(state, current.length, limits))
			return {
				budget: true,
				message: `String-character budget exceeded: ${state.characters} > ${limits.maxStringCharacters}.`,
				path: frame.path
			};
		return null;
	}
	if (
		current === null ||
		typeof current === 'boolean' ||
		(typeof current === 'number' && Number.isFinite(current))
	)
		return null;
	if (typeof current !== 'object')
		return { budget: false, message: 'Value contains a non-JSON member.', path: frame.path };
	if (isProxy(current))
		return { budget: false, message: 'Value contains a Proxy.', path: frame.path };
	if (active.has(current))
		return { budget: false, message: 'Value contains a cyclic container.', path: frame.path };
	// Order matters: the pre-admission checks gate `Reflect.ownKeys`, they do not follow it.
	const preKey = containerPreKeyFailure(current, frame.path, limits.maxRecords - state.records);
	if (preKey !== null) return preKey;
	const keys = Reflect.ownKeys(current);
	const shape = containerKeyFailure(current, keys, frame.path);
	if (shape !== null) return shape;
	active.add(current);
	pending.push({ exit: true, path: frame.path, value: current });
	return enqueueContainerMembers(current, keys, frame.path, state, limits, pending);
}

/** Inspect own data descriptors before a canonicalizer can observe hostile values. */
function inspectPlainData(
	value: unknown,
	limits: Pick<ValidationLimits, 'maxRecords' | 'maxStringCharacters'>,
	rootPath = '$'
): InspectionFailure | null {
	const pending: InspectionFrame[] = [{ exit: false, path: rootPath, value }];
	const active = new WeakSet<object>();
	const state: InspectionCounters = { characters: 0, records: 0 };
	while (pending.length > 0) {
		const failure = inspectFrame(pending.pop()!, state, limits, active, pending);
		if (failure !== null) return failure;
	}
	return null;
}

function semanticIndexes(snapshot: StaticSemanticSnapshot): SemanticIndexes {
	const unique = <Value, Key extends string>(
		values: readonly Value[],
		key: (value: Value) => Key,
		name: string
	): Map<Key, Value> => {
		const result = new Map(values.map((value) => [key(value), value]));
		if (result.size !== values.length)
			throw new Error(`Semantic ${name} identities are duplicated.`);
		return result;
	};
	const nodeById = unique(snapshot.astNodes, (node) => node.id, 'AST node');
	const sourceById = unique(snapshot.sources, (source) => source.id, 'source');
	const declarationById = unique(snapshot.declarations, (item) => item.id, 'declaration');
	const referenceById = unique(snapshot.references, (item) => item.id, 'reference');
	const invocationByNode = unique(snapshot.invocations, (item) => item.nodeId, 'invocation node');
	const provenances = new Set(snapshot.provenances.map((item) => item.id));
	if (provenances.size !== snapshot.provenances.length)
		throw new Error('Semantic provenance identities are duplicated.');
	for (const node of snapshot.astNodes)
		if (!sourceById.has(node.sourceId)) throw new Error(`AST node ${node.id} has no source.`);
	const childrenByParent = new Map<string, SemanticAstNodeRecord[]>();
	for (const node of snapshot.astNodes)
		if (node.parentId !== null) addGrouped(childrenByParent, node.parentId, node);
	for (const children of childrenByParent.values())
		children.sort(
			(left, right) =>
				left.siblingOrdinal - right.siblingOrdinal ||
				left.start - right.start ||
				compareText(left.id, right.id)
		);
	const assignmentsByNode = new Map<string, SemanticAssignmentRecord[]>();
	for (const assignment of snapshot.assignments)
		addGrouped(assignmentsByNode, assignment.nodeId, assignment);
	const declarationsByNode = new Map<string, SemanticDeclarationRecord[]>();
	for (const declaration of snapshot.declarations)
		if (declaration.nodeId !== null)
			addGrouped(declarationsByNode, declaration.nodeId, declaration);
	const referencesByNode = new Map<string, SemanticReferenceRecord[]>();
	for (const reference of snapshot.references)
		addGrouped(referencesByNode, reference.nodeId, reference);
	return {
		assignmentsByNode,
		childrenByParent,
		declarationById,
		declarationsByNode,
		invocationByNode,
		nodeById,
		projectConfigById: new Map(
			snapshot.projects.map((project) => [project.id, project.configPath])
		),
		provenances,
		referenceById,
		referencesByNode,
		sourceById
	};
}

function descendants(
	root: SemanticAstNodeRecord,
	model: SemanticIndexes,
	includeRoot = false
): SemanticAstNodeRecord[] {
	const result: SemanticAstNodeRecord[] = includeRoot ? [root] : [];
	const pending = [...(model.childrenByParent.get(root.id) ?? [])].reverse();
	while (pending.length > 0) {
		const node = pending.pop()!;
		result.push(node);
		const children = model.childrenByParent.get(node.id) ?? [];
		for (let index = children.length - 1; index >= 0; index -= 1) pending.push(children[index]!);
	}
	return result;
}

function directChildren(
	node: SemanticAstNodeRecord,
	model: SemanticIndexes
): readonly SemanticAstNodeRecord[] {
	return model.childrenByParent.get(node.id) ?? [];
}

function exactOne<Value>(values: readonly Value[], description: string): Value {
	if (values.length !== 1)
		throw new Error(`Expected exactly one ${description}; found ${values.length}.`);
	return values[0]!;
}

function exactReference(
	node: SemanticAstNodeRecord,
	model: SemanticIndexes,
	roles: readonly SemanticReferenceRecord['role'][]
): SemanticReferenceRecord {
	return exactOne(
		(model.referencesByNode.get(node.id) ?? []).filter((reference) =>
			roles.includes(reference.role)
		),
		`semantic reference at ${node.id}`
	);
}

function resolvedSymbol(reference: SemanticReferenceRecord, description: string): SemanticSymbolId {
	if (reference.resolvedSymbolId === null)
		throw new Error(`${description} does not resolve to a semantic symbol.`);
	return reference.resolvedSymbolId;
}

function location(node: SemanticAstNodeRecord): CommandDispatchTopologySourceLocation {
	return { end: node.end, sourceId: node.sourceId, start: node.start };
}

function mergeLocations(
	...populations: readonly (readonly CommandDispatchTopologySourceLocation[])[]
): CommandDispatchTopologySourceLocation[] {
	const unique = new Map<string, CommandDispatchTopologySourceLocation>();
	for (const item of populations.flat())
		unique.set(`${item.sourceId}\0${item.start}\0${item.end}`, item);
	return [...unique.values()].sort(
		(left, right) =>
			compareText(left.sourceId, right.sourceId) || left.start - right.start || left.end - right.end
	);
}

function referenceProvenances(reference: SemanticReferenceRecord): SemanticProvenanceId[] {
	return [reference.resolutionProvenanceId, reference.structuralProvenanceId];
}

interface LookupFact {
	readonly assignment: SemanticAssignmentRecord;
	readonly commandBaseReference: SemanticReferenceRecord;
	readonly commandTypeReference: SemanticReferenceRecord;
	readonly registryReference: SemanticReferenceRecord;
	readonly target: SemanticAstNodeRecord;
	readonly targetReference: SemanticReferenceRecord;
	readonly value: SemanticAstNodeRecord;
}

/** Select the `const <localName> = <REGISTRY>[...]` initializer shape inside the method. */
function registryLookupBinding(
	assignment: SemanticAssignmentRecord,
	methodNodes: ReadonlySet<string>,
	localName: 'spec' | 'handler',
	model: SemanticIndexes
): { readonly target: SemanticAstNodeRecord; readonly value: SemanticAstNodeRecord } | null {
	if (assignment.assignmentKind !== 'INITIALIZER' || assignment.valueNodeId === null) return null;
	if (!methodNodes.has(assignment.nodeId)) return null;
	const target = model.nodeById.get(assignment.targetNodeId);
	const value = model.nodeById.get(assignment.valueNodeId);
	if (
		target?.kind !== ts.SyntaxKind.Identifier ||
		target.syntacticIdentifierText !== localName ||
		value?.kind !== ts.SyntaxKind.ElementAccessExpression
	)
		return null;
	return { target, value };
}

/** Strip supported transparent wrappers; null when the registry expression shape is unsupported. */
function transparentRegistryIdentifier(
	node: SemanticAstNodeRecord,
	model: SemanticIndexes
): SemanticAstNodeRecord | null {
	let registryNode = node;
	while (TRANSPARENT_EXPRESSION_KINDS.has(registryNode.kind)) {
		const expressionChildren = directChildren(registryNode, model).filter(
			(child) =>
				child.kind === ts.SyntaxKind.Identifier || TRANSPARENT_EXPRESSION_KINDS.has(child.kind)
		);
		if (expressionChildren.length !== 1) return null;
		registryNode = expressionChildren[0]!;
	}
	return registryNode;
}

/** Select the exact `command.commandType` element-access key grammar. */
function commandTypeKeyNodes(
	key: SemanticAstNodeRecord,
	model: SemanticIndexes
): { readonly base: SemanticAstNodeRecord; readonly member: SemanticAstNodeRecord } | null {
	try {
		const keyChildren = directChildren(key, model);
		if (
			key.kind !== ts.SyntaxKind.PropertyAccessExpression ||
			keyChildren.length !== 2 ||
			keyChildren[0]!.kind !== ts.SyntaxKind.Identifier ||
			keyChildren[0]!.syntacticIdentifierText !== 'command' ||
			keyChildren[1]!.kind !== ts.SyntaxKind.Identifier ||
			keyChildren[1]!.syntacticIdentifierText !== 'commandType'
		)
			return null;
		return { base: keyChildren[0]!, member: keyChildren[1]! };
	} catch {
		return null;
	}
}

function lookupFact(
	methodNodes: ReadonlySet<string>,
	registryName: 'COMMANDS' | 'HANDLERS',
	localName: 'spec' | 'handler',
	model: SemanticIndexes,
	snapshot: StaticSemanticSnapshot
): LookupFact {
	const matches: LookupFact[] = [];
	for (const assignment of snapshot.assignments) {
		const binding = registryLookupBinding(assignment, methodNodes, localName, model);
		if (binding === null) continue;
		const elementChildren = directChildren(binding.value, model);
		if (elementChildren.length !== 2) continue;
		const registryNode = transparentRegistryIdentifier(elementChildren[0]!, model);
		// S6582 APPLIED here, and REFUSED at the `retainedBytes` guard below — the difference is the
		// right-hand operands. Here they are pure property comparisons, so short-circuiting to `continue`
		// on a null node is identical either way. There, the right operand is `sha256(...)`, which THROWS
		// on a missing buffer, so the explicit `=== undefined` limb is load-bearing. Same rule, opposite
		// answer, decided by what the guard is protecting.
		if (
			registryNode?.kind !== ts.SyntaxKind.Identifier ||
			registryNode.syntacticIdentifierText !== registryName
		)
			continue;
		const keyNodes = commandTypeKeyNodes(elementChildren[1]!, model);
		if (keyNodes === null) continue;
		const registryReference = exactReference(registryNode, model, ['SYMBOL_USE']);
		const commandBaseReference = exactReference(keyNodes.base, model, ['SYMBOL_USE']);
		const commandTypeReference = exactReference(keyNodes.member, model, ['MEMBER_NAME']);
		const targetReference = exactReference(binding.target, model, ['DECLARATION_NAME']);
		matches.push({
			assignment,
			commandBaseReference,
			commandTypeReference,
			registryReference,
			target: binding.target,
			targetReference,
			value: binding.value
		});
	}
	return exactOne(matches, `${registryName} lookup assignment`);
}

interface PayloadValidationFact {
	readonly assignment: SemanticAssignmentRecord;
	readonly calleeReference: SemanticReferenceRecord;
	readonly commandArgumentBaseReference: SemanticReferenceRecord;
	readonly commandPayloadArgument: SemanticAstNodeRecord;
	readonly invocation: Extract<SemanticInvocationSiteRecord, { invocationKind: 'CALL' }>;
	readonly invocationNode: SemanticAstNodeRecord;
	readonly parsedTarget: SemanticAstNodeRecord;
	readonly parsedTargetReference: SemanticReferenceRecord;
	readonly schemaArgument: SemanticAstNodeRecord;
	readonly specArgumentBaseReference: SemanticReferenceRecord;
}

function propertyAccess(
	node: SemanticAstNodeRecord,
	baseName: string,
	memberName: string,
	model: SemanticIndexes
): { readonly base: SemanticAstNodeRecord; readonly member: SemanticAstNodeRecord } {
	if (node.kind !== ts.SyntaxKind.PropertyAccessExpression)
		throw new Error(`Expected ${baseName}.${memberName} PropertyAccessExpression.`);
	const children = directChildren(node, model);
	if (
		children.length !== 2 ||
		children[0]!.kind !== ts.SyntaxKind.Identifier ||
		children[0]!.syntacticIdentifierText !== baseName ||
		children[1]!.kind !== ts.SyntaxKind.Identifier ||
		children[1]!.syntacticIdentifierText !== memberName
	)
		throw new Error(`Expected exact direct ${baseName}.${memberName} property-access grammar.`);
	return { base: children[0]!, member: children[1]! };
}

function payloadValidationFact(
	methodNodes: ReadonlySet<string>,
	model: SemanticIndexes,
	snapshot: StaticSemanticSnapshot
): PayloadValidationFact {
	const matches: PayloadValidationFact[] = [];
	for (const assignment of snapshot.assignments) {
		if (assignment.assignmentKind !== 'INITIALIZER' || assignment.valueNodeId === null) continue;
		if (!methodNodes.has(assignment.nodeId)) continue;
		const parsedTarget = model.nodeById.get(assignment.targetNodeId);
		const invocationNode = model.nodeById.get(assignment.valueNodeId);
		const invocation = model.invocationByNode.get(assignment.valueNodeId);
		if (
			parsedTarget?.kind !== ts.SyntaxKind.Identifier ||
			parsedTarget.syntacticIdentifierText !== 'parsed' ||
			invocationNode?.kind !== ts.SyntaxKind.CallExpression ||
			invocation?.invocationKind !== 'CALL'
		)
			continue;
		const callee = model.nodeById.get(invocation.calleeNodeId);
		if (
			callee?.kind !== ts.SyntaxKind.Identifier ||
			callee.syntacticIdentifierText !== 'validateAgainst'
		)
			continue;
		if (invocation.argumentNodeIds.length !== 3) continue;
		const schemaArgument = model.nodeById.get(invocation.argumentNodeIds[0]!);
		const commandPayloadArgument = model.nodeById.get(invocation.argumentNodeIds[1]!);
		if (schemaArgument === undefined || commandPayloadArgument === undefined) continue;
		try {
			const specAccess = propertyAccess(schemaArgument, 'spec', 'payload', model);
			const commandAccess = propertyAccess(commandPayloadArgument, 'command', 'payload', model);
			matches.push({
				assignment,
				calleeReference: exactReference(callee, model, ['SYMBOL_USE']),
				commandArgumentBaseReference: exactReference(commandAccess.base, model, ['SYMBOL_USE']),
				commandPayloadArgument,
				invocation,
				invocationNode,
				parsedTarget,
				parsedTargetReference: exactReference(parsedTarget, model, ['DECLARATION_NAME']),
				schemaArgument,
				specArgumentBaseReference: exactReference(specAccess.base, model, ['SYMBOL_USE'])
			});
		} catch {
			continue;
		}
	}
	return exactOne(matches, 'validateAgainst payload-validation assignment');
}

interface GuardFact {
	readonly condition: SemanticAstNodeRecord;
	readonly handlerReference: SemanticReferenceRecord;
	readonly handlerValue: SemanticAstNodeRecord;
	readonly statement: SemanticAstNodeRecord;
}

function guardFact(methodRoot: SemanticAstNodeRecord, model: SemanticIndexes): GuardFact {
	const matches: GuardFact[] = [];
	for (const statement of descendants(methodRoot, model).filter(
		(node) => node.kind === ts.SyntaxKind.IfStatement
	)) {
		const conditions = directChildren(statement, model).filter(
			(node) =>
				node.kind === ts.SyntaxKind.PrefixUnaryExpression &&
				node.operatorKind === ts.SyntaxKind.ExclamationToken
		);
		if (conditions.length !== 1) continue;
		const condition = conditions[0]!;
		const handlerCandidates = directChildren(condition, model).filter(
			(node) => node.kind === ts.SyntaxKind.Identifier && node.syntacticIdentifierText === 'handler'
		);
		if (handlerCandidates.length !== 1) continue;
		const handlerValue = handlerCandidates[0]!;
		matches.push({
			condition,
			handlerReference: exactReference(handlerValue, model, ['SYMBOL_USE']),
			handlerValue,
			statement
		});
	}
	return exactOne(matches, 'missing-handler guard');
}

interface HandlerInvocationFact {
	readonly callee: SemanticAstNodeRecord;
	readonly calleeReference: SemanticReferenceRecord;
	readonly commandArgument: SemanticAstNodeRecord;
	readonly commandArgumentReference: SemanticReferenceRecord;
	readonly contextArgument: SemanticAstNodeRecord;
	readonly invocation: Extract<SemanticInvocationSiteRecord, { invocationKind: 'CALL' }>;
	readonly invocationNode: SemanticAstNodeRecord;
	readonly parsedArgumentBaseReference: SemanticReferenceRecord;
	readonly parsedPayloadArgument: SemanticAstNodeRecord;
}

function handlerInvocationFact(
	methodNodes: ReadonlySet<string>,
	model: SemanticIndexes,
	snapshot: StaticSemanticSnapshot
): HandlerInvocationFact {
	const matches: HandlerInvocationFact[] = [];
	for (const invocation of snapshot.invocations) {
		if (invocation.invocationKind !== 'CALL' || !methodNodes.has(invocation.nodeId)) continue;
		const invocationNode = model.nodeById.get(invocation.nodeId);
		const callee = model.nodeById.get(invocation.calleeNodeId);
		if (
			invocationNode?.kind !== ts.SyntaxKind.CallExpression ||
			callee?.kind !== ts.SyntaxKind.Identifier ||
			callee.syntacticIdentifierText !== 'handler' ||
			invocation.argumentNodeIds.length !== 3
		)
			continue;
		const contextArgument = model.nodeById.get(invocation.argumentNodeIds[0]!);
		const commandArgument = model.nodeById.get(invocation.argumentNodeIds[1]!);
		const parsedPayloadArgument = model.nodeById.get(invocation.argumentNodeIds[2]!);
		if (
			contextArgument?.kind !== ts.SyntaxKind.Identifier ||
			contextArgument.syntacticIdentifierText !== 'ctx' ||
			commandArgument?.kind !== ts.SyntaxKind.Identifier ||
			commandArgument.syntacticIdentifierText !== 'command' ||
			parsedPayloadArgument === undefined
		)
			continue;
		try {
			const parsedAccess = propertyAccess(parsedPayloadArgument, 'parsed', 'value', model);
			matches.push({
				callee,
				calleeReference: exactReference(callee, model, ['SYMBOL_USE']),
				commandArgument,
				commandArgumentReference: exactReference(commandArgument, model, ['SYMBOL_USE']),
				contextArgument,
				invocation,
				invocationNode,
				parsedArgumentBaseReference: exactReference(parsedAccess.base, model, ['SYMBOL_USE']),
				parsedPayloadArgument
			});
		} catch {
			continue;
		}
	}
	return exactOne(matches, 'handler invocation');
}

interface ExpectedTopology {
	readonly coverage: CommandDispatchTopologyCoverage;
	readonly edges: readonly CommandDispatchTopologyEdge[];
	readonly forwardIndex: readonly CommandDispatchTopologyIndexEntry[];
	readonly graphId: CommandDispatchTopologySnapshot['id'];
	readonly graphInputDigest: string;
	readonly layers: readonly [CommandDispatchTopologyLayer, CommandDispatchTopologyLayer];
	readonly node: CommandDispatchPipelineNode;
	readonly retainedCensus: CommandDispatchTopologySnapshot['retainedCommandDispatchCensus'];
	readonly reverseIndex: readonly CommandDispatchTopologyIndexEntry[];
	readonly selector: BuildCommandDispatchTopologyRequest['commandBus'];
	readonly sourceBytes: number;
}

interface CommandBusSelection {
	readonly declaration: SemanticDeclarationRecord;
	readonly methodRoot: SemanticAstNodeRecord;
	readonly selector: BuildCommandDispatchTopologyRequest['commandBus'];
	readonly source: SemanticSourceRecord;
	readonly sourceBytes: Uint8Array;
}

/** Re-select the frozen command-bus method and prove its semantic and artifact identity. */
function commandBusSelection(
	snapshot: StaticSemanticSnapshot,
	model: SemanticIndexes,
	subject: FrozenSubject
): CommandBusSelection {
	const projects = snapshot.projects.filter(
		(project) => project.configPath === COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_PROJECT_CONFIG_PATH
	);
	const project = exactOne(projects, 'selected command-bus semantic project');
	const sources = snapshot.sources.filter(
		(source) =>
			source.projectId === project.id &&
			source.logicalPath === COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_LOGICAL_PATH &&
			source.analysisDisposition === 'DEEP_INDEXED'
	);
	const source = exactOne(sources, 'selected deep-indexed command-bus source');
	const declarations = snapshot.declarations.filter(
		(declaration) =>
			declaration.sourceId === source.id &&
			declaration.name === COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_METHOD_NAME &&
			declaration.kind === ts.SyntaxKind.MethodDeclaration &&
			declaration.nodeId !== null
	);
	const declaration = exactOne(declarations, 'dispatchStamped method declaration');
	const methodRoot = model.nodeById.get(declaration.nodeId!);
	if (methodRoot?.kind !== ts.SyntaxKind.MethodDeclaration)
		throw new Error('The selected dispatch method declaration has no exact AST method node.');
	const selector = {
		contentSha256: source.contentSha256,
		declarationId: declaration.id,
		logicalPath: COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_LOGICAL_PATH,
		methodName: COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_METHOD_NAME,
		programId: source.programId,
		projectConfigPath: COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_PROJECT_CONFIG_PATH,
		projectId: source.projectId,
		sourceId: source.id
	} as const;

	const sourceArtifacts = subject.artifacts.filter(
		(artifact) => artifact.path === COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_LOGICAL_PATH
	);
	const sourceArtifact = exactOne(sourceArtifacts, 'frozen command-bus artifact');
	const sourceBytes = readFrozenSubjectArtifact(
		subject,
		COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_LOGICAL_PATH
	);
	if (sourceBytes === undefined)
		throw new Error('The frozen command-bus source bytes are unavailable.');
	if (
		sha256(sourceBytes) !== source.contentSha256 ||
		sourceArtifact.sha256 !== source.contentSha256 ||
		sourceArtifact.bytes !== sourceBytes.byteLength ||
		source.bytes !== sourceBytes.byteLength
	)
		throw new Error('The command-bus semantic source and frozen artifact identity differ.');
	return { declaration, methodRoot, selector, source, sourceBytes };
}

/** The retained census artifact must reproduce byte-for-byte before it can be referenced. */
function verifiedRetainedCensus(
	subject: FrozenSubject
): CommandDispatchTopologySnapshot['retainedCommandDispatchCensus'] {
	const retainedArtifacts = subject.artifacts.filter(
		(artifact) => artifact.path === 'verif/command-dispatch-census.test.ts'
	);
	const retainedArtifact = exactOne(retainedArtifacts, 'retained command-dispatch census artifact');
	const retainedBytes = readFrozenSubjectArtifact(subject, retainedArtifact.path);
	if (
		// S6582 REFUSED — see build-command-event-contract-overlay.ts: the explicit `=== undefined` limb
		// is the only thing keeping `sha256` from running on a missing buffer, and the declared `number`
		// type of `.bytes` hides that from the type-checker.
		retainedBytes === undefined ||
		retainedBytes.byteLength !== retainedArtifact.bytes ||
		sha256(retainedBytes) !== retainedArtifact.sha256
	)
		throw new Error('The retained command-dispatch census artifact identity does not reproduce.');
	return commandDispatchTopologyRetainedCensusReference(subject);
}

interface DispatchPipelineFacts {
	readonly commandsLookup: LookupFact;
	readonly guard: GuardFact;
	readonly handlerInvocation: HandlerInvocationFact;
	readonly handlersLookup: LookupFact;
	readonly payloadValidation: PayloadValidationFact;
}

/** Every method-local dispatch binding must flow through the one selected parameter symbol. */
function verifyDispatchLocalSymbolFlow(
	facts: DispatchPipelineFacts,
	commandSymbol: SemanticSymbolId
): void {
	const { commandsLookup, guard, handlerInvocation, handlersLookup, payloadValidation } = facts;
	for (const [description, reference] of [
		['COMMANDS lookup command base', commandsLookup.commandBaseReference],
		['HANDLERS lookup command base', handlersLookup.commandBaseReference],
		['payload-validation command base', payloadValidation.commandArgumentBaseReference],
		['handler invocation command argument', handlerInvocation.commandArgumentReference]
	] as const)
		if (resolvedSymbol(reference, description) !== commandSymbol)
			throw new Error(`${description} does not resolve to the selected method parameter.`);
	if (
		resolvedSymbol(commandsLookup.commandTypeReference, 'COMMANDS commandType member') !==
		resolvedSymbol(handlersLookup.commandTypeReference, 'HANDLERS commandType member')
	)
		throw new Error('The two registry lookups do not use the same resolved commandType member.');
	const specSymbol = resolvedSymbol(commandsLookup.targetReference, 'spec declaration');
	if (
		resolvedSymbol(payloadValidation.specArgumentBaseReference, 'payload-validation spec base') !==
		specSymbol
	)
		throw new Error('Payload validation does not consume the selected COMMANDS lookup result.');
	const parsedSymbol = resolvedSymbol(
		payloadValidation.parsedTargetReference,
		'parsed declaration'
	);
	if (
		resolvedSymbol(handlerInvocation.parsedArgumentBaseReference, 'handler parsed-value base') !==
		parsedSymbol
	)
		throw new Error('Handler invocation does not consume the selected validation result binding.');
	const handlerSymbol = resolvedSymbol(handlersLookup.targetReference, 'handler declaration');
	if (
		resolvedSymbol(guard.handlerReference, 'guarded handler') !== handlerSymbol ||
		resolvedSymbol(handlerInvocation.calleeReference, 'invoked handler') !== handlerSymbol
	)
		throw new Error('The handler lookup, guard, and invocation do not share one local symbol.');
}

/** The registry and validator references must resolve to the predecessor-selected declarations. */
function verifyDispatchRegistryResolution(
	facts: DispatchPipelineFacts,
	commandHandlerGraph: CommandHandlerGraphSnapshot,
	model: SemanticIndexes
): void {
	const { commandsLookup, handlersLookup, payloadValidation } = facts;
	const handlerRegistryDeclaration = model.declarationById.get(
		commandHandlerGraph.handlerRegistry.declarationId
	);
	if (
		handlerRegistryDeclaration?.symbolId === null ||
		handlerRegistryDeclaration?.symbolId === undefined ||
		resolvedSymbol(handlersLookup.registryReference, 'HANDLERS registry reference') !==
			handlerRegistryDeclaration.symbolId
	)
		throw new Error('The HANDLERS lookup does not resolve to the predecessor registry selector.');
	if (
		commandsLookup.registryReference.resolutionState !== 'RESOLVED_ALIAS' &&
		commandsLookup.registryReference.resolutionState !== 'RESOLVED_DIRECT'
	)
		throw new Error('The COMMANDS lookup registry reference is unresolved.');
	if (
		payloadValidation.calleeReference.resolutionState !== 'RESOLVED_ALIAS' &&
		payloadValidation.calleeReference.resolutionState !== 'RESOLVED_DIRECT'
	)
		throw new Error('The validateAgainst callee reference is unresolved.');
}

/** The five pipeline facts must occur in canonical lexical order at five distinct locations. */
function dispatchPipelineSourceLocations(
	facts: DispatchPipelineFacts,
	model: SemanticIndexes
): CommandDispatchTopologySourceLocation[] {
	const { commandsLookup, guard, handlerInvocation, handlersLookup, payloadValidation } = facts;
	const orderedStarts = [
		model.nodeById.get(commandsLookup.assignment.nodeId)?.start,
		payloadValidation.invocationNode.start,
		model.nodeById.get(handlersLookup.assignment.nodeId)?.start,
		guard.statement.start,
		handlerInvocation.invocationNode.start
	];
	if (
		orderedStarts.includes(undefined) ||
		orderedStarts.some((start, index) => index > 0 && orderedStarts[index - 1]! >= start!)
	)
		throw new Error('The selected dispatch pipeline facts are not in canonical lexical order.');
	const commandAssignmentNode = model.nodeById.get(commandsLookup.assignment.nodeId);
	const handlerAssignmentNode = model.nodeById.get(handlersLookup.assignment.nodeId);
	if (commandAssignmentNode === undefined || handlerAssignmentNode === undefined)
		throw new Error('A selected lookup assignment node is absent.');
	const sourceLocations = mergeLocations(
		[location(commandAssignmentNode)],
		[location(payloadValidation.invocationNode)],
		[location(handlerAssignmentNode)],
		[location(guard.statement)],
		[location(handlerInvocation.invocationNode)]
	);
	if (sourceLocations.length !== 5)
		throw new Error('The dispatch pipeline does not produce five distinct source locations.');
	return sourceLocations;
}

/** Collect, and prove known, the semantic provenance the pipeline node will publish. */
function dispatchNodeProvenances(
	facts: DispatchPipelineFacts,
	source: SemanticSourceRecord,
	declaration: SemanticDeclarationRecord,
	model: SemanticIndexes
): SemanticProvenanceId[] {
	const serializedReferences = [
		facts.commandsLookup.commandTypeReference,
		facts.commandsLookup.registryReference,
		facts.handlersLookup.commandTypeReference,
		facts.handlersLookup.registryReference,
		facts.payloadValidation.calleeReference,
		facts.guard.handlerReference,
		facts.handlerInvocation.calleeReference
	];
	const nodeProvenances = sortedUnique<SemanticProvenanceId>([
		source.provenanceId,
		...(source.syntaxProvenanceId === null ? [] : [source.syntaxProvenanceId]),
		declaration.bindingProvenanceId,
		declaration.structuralProvenanceId,
		...serializedReferences.flatMap(referenceProvenances)
	]);
	for (const provenanceId of nodeProvenances)
		if (!model.provenances.has(provenanceId))
			throw new Error('The dispatch pipeline references unknown semantic provenance.');
	return nodeProvenances;
}

/** The predecessor graph must supply both a target population and its registration support. */
function handlerTargetComposition(commandHandlerGraph: CommandHandlerGraphSnapshot) {
	const targetNodes = commandHandlerGraph.nodes.filter(
		(candidate): candidate is HandlerTargetNode => candidate.kind === 'HANDLER_TARGET'
	);
	const registrationNodes = new Map(
		commandHandlerGraph.nodes
			.filter(
				(candidate): candidate is HandlerRegistrationNode =>
					candidate.kind === 'HANDLER_REGISTRATION'
			)
			.map((candidate) => [candidate.id, candidate])
	);
	if (targetNodes.length === 0)
		throw new Error('The predecessor graph has no handler-target population to compose.');
	const supportEdges = commandHandlerGraph.edges.filter(
		(edge) => edge.relationKind === 'HANDLER_REGISTRATION_TO_TARGET'
	);
	if (supportEdges.length === 0)
		throw new Error('The predecessor graph has no registration-to-target support population.');
	return { registrationNodes, supportEdges, targetNodes };
}

/** Compose one candidate edge for every predecessor handler target that has registration support. */
function candidateHandlerTargetEdges(
	composition: ReturnType<typeof handlerTargetComposition>,
	commandHandlerGraph: CommandHandlerGraphSnapshot,
	snapshot: StaticSemanticSnapshot,
	node: CommandDispatchPipelineNode,
	graphId: CommandDispatchTopologySnapshot['id'],
	inferenceLayerId: CommandDispatchPipelineNode['layerId']
): CommandDispatchTopologyEdge[] {
	const { registrationNodes, supportEdges, targetNodes } = composition;
	const edges: CommandDispatchTopologyEdge[] = [];
	for (const target of targetNodes) {
		const supports = supportEdges.filter((edge) => edge.target.nodeId === target.id);
		if (supports.length === 0) continue;
		const registrations = supports.map((edge) => {
			const registration = registrationNodes.get(edge.source.nodeId);
			if (registration === undefined)
				throw new Error('A predecessor registration-to-target edge has no source registration.');
			return registration;
		});
		const registeredCommandNames = sortedUnique(registrations.map((item) => item.commandName));
		const inferenceBasis = {
			assumptions: [
				'The runtime command.commandType value may select any statically registered HANDLERS entry represented by the predecessor graph.'
			],
			limitationKinds: [
				'HANDLER_TARGET_EDGES_ARE_CANDIDATE_ONLY',
				'CONTROL_FLOW_AND_PATH_FEASIBILITY_NOT_ANALYZED',
				'RUNTIME_DISPATCH_NOT_CLAIMED'
			] as const,
			method: COMMAND_DISPATCH_TOPOLOGY_METHOD,
			rationale:
				'The selected dispatch pipeline indexes HANDLERS by command.commandType and invokes the resulting handler; without runtime values or control-flow evidence, every registered handler target is a candidate.',
			supportingInputIds: sortedUnique([
				node.id,
				target.id,
				...supports.map((edge) => edge.id),
				...registrations.map((registration) => registration.id)
			])
		};
		const sourceEndpoint = { graphId, kind: 'STATIC_DISPATCH_PIPELINE' as const, nodeId: node.id };
		const targetEndpoint = {
			graphId: commandHandlerGraph.id,
			kind: 'HANDLER_TARGET' as const,
			nodeId: target.id
		};
		const provenanceIds = sortedUnique<SemanticProvenanceId>([
			...node.provenanceIds,
			...target.provenanceIds,
			...supports.flatMap((edge) => edge.provenanceIds),
			...registrations.flatMap((registration) => registration.provenanceIds)
		]);
		const edge: CommandDispatchTopologyEdge = {
			attribution: 'CANDIDATE',
			commandHandlerGraphId: commandHandlerGraph.id,
			graphId,
			id: commandDispatchTopologyEdgeId({
				graphId,
				inferenceBasis,
				registeredCommandNames,
				relationCode: 'IMPL-JPWB-CD-DISPATCH-TARGET-001',
				relationKind: 'STATIC_DISPATCH_PIPELINE_TO_HANDLER_TARGET',
				source: sourceEndpoint,
				target: targetEndpoint
			}),
			inferenceBasis,
			layerId: inferenceLayerId,
			method: COMMAND_DISPATCH_TOPOLOGY_METHOD,
			provenanceIds,
			registeredCommandNames,
			relationCode: 'IMPL-JPWB-CD-DISPATCH-TARGET-001',
			relationKind: 'STATIC_DISPATCH_PIPELINE_TO_HANDLER_TARGET',
			semanticSnapshotId: snapshot.id,
			source: sourceEndpoint,
			sourceLocations: mergeLocations(
				node.sourceLocations,
				target.sourceLocations,
				...supports.map((support) => support.sourceLocations),
				...registrations.map((registration) => registration.sourceLocations)
			),
			subjectId: snapshot.subjectId,
			target: targetEndpoint
		};
		edges.push(edge);
	}
	edges.sort((left, right) => compareText(left.id, right.id));
	if (edges.length === 0)
		throw new Error('No predecessor handler target has registration support.');
	return edges;
}

function expectedTopology(
	request: BuildCommandDispatchTopologyRequest,
	snapshot: StaticSemanticSnapshot,
	commandHandlerGraph: CommandHandlerGraphSnapshot,
	arrowObservation: ArrowCommandCensusObservation,
	subject: FrozenSubject
): ExpectedTopology {
	const model = semanticIndexes(snapshot);
	const { declaration, methodRoot, selector, source, sourceBytes } = commandBusSelection(
		snapshot,
		model,
		subject
	);
	const retainedCensus = verifiedRetainedCensus(subject);

	const methodNodePopulation = descendants(methodRoot, model, true);
	const methodNodes = new Set(methodNodePopulation.map((node) => node.id));
	const commandParameters = snapshot.declarations.filter(
		(item) =>
			item.sourceId === source.id &&
			item.name === 'command' &&
			item.kind === ts.SyntaxKind.Parameter &&
			item.nodeId !== null &&
			methodNodes.has(item.nodeId)
	);
	const commandParameter = exactOne(commandParameters, 'dispatchStamped command parameter');
	if (commandParameter.symbolId === null)
		throw new Error('The dispatchStamped command parameter has no semantic symbol.');

	const commandsLookup = lookupFact(methodNodes, 'COMMANDS', 'spec', model, snapshot);
	const handlersLookup = lookupFact(methodNodes, 'HANDLERS', 'handler', model, snapshot);
	const payloadValidation = payloadValidationFact(methodNodes, model, snapshot);
	const guard = guardFact(methodRoot, model);
	const handlerInvocation = handlerInvocationFact(methodNodes, model, snapshot);
	const facts: DispatchPipelineFacts = {
		commandsLookup,
		guard,
		handlerInvocation,
		handlersLookup,
		payloadValidation
	};

	const commandSymbol = commandParameter.symbolId;
	verifyDispatchLocalSymbolFlow(facts, commandSymbol);
	verifyDispatchRegistryResolution(facts, commandHandlerGraph, model);

	const sourceLocations = dispatchPipelineSourceLocations(facts, model);
	const nodeProvenances = dispatchNodeProvenances(facts, source, declaration, model);

	const graphInputDigest = commandDispatchTopologyInputDigest(
		request,
		snapshot,
		commandHandlerGraph,
		arrowObservation,
		subject
	);
	const graphId = commandDispatchTopologyGraphId({
		canonicalProfile: COMMAND_DISPATCH_TOPOLOGY_CANONICAL_PROFILE,
		commandHandlerGraphId: commandHandlerGraph.id,
		graphInputDigest,
		method: COMMAND_DISPATCH_TOPOLOGY_METHOD,
		operationVersion: COMMAND_DISPATCH_TOPOLOGY_OPERATION_VERSION,
		schemaVersion: COMMAND_DISPATCH_TOPOLOGY_SCHEMA_VERSION,
		semanticSnapshotId: snapshot.id,
		subjectId: snapshot.subjectId
	});
	const derivationLayerId = commandDispatchTopologyDerivationLayerId(graphId);
	const inferenceLayerId = commandDispatchTopologyInferenceLayerId(graphId);
	const node: CommandDispatchPipelineNode = {
		attribution: 'EXACT_STATIC_SYNTAX',
		commandBusDeclarationId: declaration.id,
		commandHandlerGraphId: commandHandlerGraph.id,
		commandsLookup: {
			assignmentNodeId: commandsLookup.assignment.nodeId,
			commandTypeReferenceId: commandsLookup.commandTypeReference.id,
			registryName: 'COMMANDS',
			registryReferenceId: commandsLookup.registryReference.id,
			targetNodeId: commandsLookup.target.id,
			valueNodeId: commandsLookup.value.id
		},
		graphId,
		handlerInvocation: {
			calleeNodeId: handlerInvocation.callee.id,
			calleeReferenceId: handlerInvocation.calleeReference.id,
			commandArgumentNodeId: handlerInvocation.commandArgument.id,
			contextArgumentNodeId: handlerInvocation.contextArgument.id,
			invocationId: handlerInvocation.invocation.id,
			invocationNodeId: handlerInvocation.invocationNode.id,
			parsedPayloadArgumentNodeId: handlerInvocation.parsedPayloadArgument.id
		},
		handlersLookup: {
			assignmentNodeId: handlersLookup.assignment.nodeId,
			commandTypeReferenceId: handlersLookup.commandTypeReference.id,
			registryName: 'HANDLERS',
			registryReferenceId: handlersLookup.registryReference.id,
			targetNodeId: handlersLookup.target.id,
			valueNodeId: handlersLookup.value.id
		},
		id: commandDispatchPipelineNodeId(graphId, declaration.id),
		kind: 'STATIC_DISPATCH_PIPELINE',
		layerId: derivationLayerId,
		methodName: COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_METHOD_NAME,
		missingHandlerGuard: {
			conditionNodeId: guard.condition.id,
			guardedHandlerReferenceId: guard.handlerReference.id,
			guardedHandlerValueNodeId: guard.handlerValue.id,
			guardStatementNodeId: guard.statement.id
		},
		payloadValidationInvocation: {
			calleeNodeId: model.nodeById.get(payloadValidation.invocation.calleeNodeId)!.id,
			calleeReferenceId: payloadValidation.calleeReference.id,
			commandPayloadArgumentNodeId: payloadValidation.commandPayloadArgument.id,
			invocationId: payloadValidation.invocation.id,
			invocationNodeId: payloadValidation.invocationNode.id,
			parsedValueNodeId: payloadValidation.parsedTarget.id,
			schemaArgumentNodeId: payloadValidation.schemaArgument.id
		},
		programId: source.programId,
		projectId: source.projectId,
		provenanceIds: nodeProvenances,
		semanticSnapshotId: snapshot.id,
		sourceId: source.id,
		sourceLocations,
		subjectId: snapshot.subjectId
	};

	const composition = handlerTargetComposition(commandHandlerGraph);
	const { registrationNodes, supportEdges, targetNodes } = composition;
	const edges = candidateHandlerTargetEdges(
		composition,
		commandHandlerGraph,
		snapshot,
		node,
		graphId,
		inferenceLayerId
	);
	const registrationsWithSupport = new Set(supportEdges.map((edge) => edge.source.nodeId));
	const targetsWithSupport = new Set(supportEdges.map((edge) => edge.target.nodeId));
	const unresolvedHandlerTargets = [...registrationNodes.keys()].filter(
		(id) => !registrationsWithSupport.has(id)
	).length;
	const coverage: CommandDispatchTopologyCoverage = {
		candidateHandlerTargetEdges: edges.length,
		commandHandlerGraphHandlerTargets: targetNodes.length,
		commandsLookupAssignments: 1,
		duplicatedCommandHandlerNodes: 0,
		duplicatedCommandRegistryEntries: 0,
		duplicatedHandlerRegistrations: 0,
		handlerInvocations: 1,
		handlersLookupAssignments: 1,
		missingHandlerGuards: 1,
		payloadValidationInvocations: 1,
		pipelineNodes: 1,
		reconciles:
			edges.length === targetsWithSupport.size &&
			edges.length === targetNodes.length &&
			registrationsWithSupport.size + unresolvedHandlerTargets === registrationNodes.size &&
			edges.every(
				(edge) =>
					edge.registeredCommandNames.length > 0 &&
					edge.inferenceBasis.supportingInputIds.length >= 4
			),
		referencedHandlerTargets: edges.length,
		representedPipelineFacts: 5,
		unresolvedHandlerTargets
	};
	if (!coverage.reconciles)
		throw new Error('The independently derived dispatch coverage does not reconcile.');

	const forwardIndex: readonly CommandDispatchTopologyIndexEntry[] = [
		{
			edgeIds: edges.map((edge) => edge.id),
			endpointOwner: 'COMMAND_DISPATCH_TOPOLOGY',
			graphId,
			nodeId: node.id
		}
	];
	const reverseIndex: readonly CommandDispatchTopologyIndexEntry[] = edges
		.map((edge) => ({
			edgeIds: [edge.id],
			endpointOwner: 'COMMAND_HANDLER_GRAPH' as const,
			graphId: commandHandlerGraph.id,
			nodeId: edge.target.nodeId
		}))
		.sort((left, right) => compareText(left.nodeId, right.nodeId));
	const derivationLayer: CommandDispatchTopologyLayer = {
		capability: COMMAND_DISPATCH_TOPOLOGY_DERIVATION_CAPABILITY,
		capabilityStatus: COMMAND_DISPATCH_TOPOLOGY_CAPABILITY_STATUS,
		commandHandlerGraphId: commandHandlerGraph.id,
		coverage,
		edgeIds: [],
		graphId,
		id: derivationLayerId,
		kind: 'JPWB_COMMAND_DISPATCH_DERIVATION',
		limitations: COMMAND_DISPATCH_TOPOLOGY_LIMITATIONS.map((item) => ({ ...item })),
		method: COMMAND_DISPATCH_TOPOLOGY_METHOD,
		nodeIds: [node.id],
		ordinal: 0,
		producer: { ...snapshot.provider },
		provenanceIds: [...node.provenanceIds],
		registryStatus: COMMAND_DISPATCH_TOPOLOGY_REGISTRY_STATUS,
		semanticSnapshotId: snapshot.id,
		subjectId: snapshot.subjectId
	};
	const inferenceLayer: CommandDispatchTopologyLayer = {
		capability: COMMAND_DISPATCH_TOPOLOGY_INFERENCE_CAPABILITY,
		capabilityStatus: COMMAND_DISPATCH_TOPOLOGY_CAPABILITY_STATUS,
		commandHandlerGraphId: commandHandlerGraph.id,
		coverage,
		edgeIds: edges.map((edge) => edge.id),
		graphId,
		id: inferenceLayerId,
		kind: 'JPWB_COMMAND_DISPATCH_HANDLER_TARGET_INFERENCE',
		limitations: COMMAND_DISPATCH_TOPOLOGY_LIMITATIONS.map((item) => ({ ...item })),
		method: COMMAND_DISPATCH_TOPOLOGY_METHOD,
		nodeIds: [],
		ordinal: 1,
		producer: { ...snapshot.provider },
		provenanceIds: sortedUnique(edges.flatMap((edge) => edge.provenanceIds)),
		registryStatus: COMMAND_DISPATCH_TOPOLOGY_REGISTRY_STATUS,
		semanticSnapshotId: snapshot.id,
		subjectId: snapshot.subjectId
	};
	return {
		coverage,
		edges,
		forwardIndex,
		graphId,
		graphInputDigest,
		layers: [derivationLayer, inferenceLayer],
		node,
		retainedCensus,
		reverseIndex,
		selector,
		sourceBytes: sourceBytes.byteLength
	};
}

function requestShapeValid(request: BuildCommandDispatchTopologyRequest): boolean {
	return (
		plainObject(request) &&
		exactKeys(request, REQUEST_KEYS) &&
		plainObject(request.budgets) &&
		exactKeys(request.budgets, BUDGET_KEYS) &&
		BUDGET_KEYS.every(
			(key) => Number.isSafeInteger(request.budgets[key]) && request.budgets[key] >= 1
		) &&
		plainObject(request.commandBus) &&
		exactKeys(request.commandBus, SELECTOR_KEYS)
	);
}

function exactNestedShape(graph: CommandDispatchTopologySnapshot): boolean {
	if (
		!Array.isArray(graph.capabilities) ||
		!Array.isArray(graph.limitations) ||
		!Array.isArray(graph.nodes) ||
		!Array.isArray(graph.edges) ||
		!Array.isArray(graph.forwardIndex) ||
		!Array.isArray(graph.layers) ||
		!Array.isArray(graph.reverseIndex) ||
		!plainObject(graph.budgets) ||
		!exactKeys(graph.budgets, BUDGET_KEYS) ||
		!plainObject(graph.commandBus) ||
		!exactKeys(graph.commandBus, SELECTOR_KEYS) ||
		!plainObject(graph.coverage) ||
		!exactKeys(graph.coverage, COVERAGE_KEYS) ||
		!plainObject(graph.retainedCommandDispatchCensus) ||
		!exactKeys(graph.retainedCommandDispatchCensus, RETAINED_CENSUS_KEYS) ||
		graph.limitations.some((item) => !plainObject(item) || !exactKeys(item, LIMITATION_KEYS))
	)
		return false;
	if (graph.nodes.length !== 1) return false;
	const node = graph.nodes[0];
	if (
		!plainObject(node) ||
		!exactKeys(node, PIPELINE_NODE_KEYS) ||
		!Array.isArray(node.provenanceIds) ||
		!Array.isArray(node.sourceLocations) ||
		!plainObject(node.commandsLookup) ||
		!exactKeys(node.commandsLookup, LOOKUP_BINDING_KEYS) ||
		!plainObject(node.handlersLookup) ||
		!exactKeys(node.handlersLookup, LOOKUP_BINDING_KEYS) ||
		!plainObject(node.payloadValidationInvocation) ||
		!exactKeys(node.payloadValidationInvocation, PAYLOAD_VALIDATION_BINDING_KEYS) ||
		!plainObject(node.missingHandlerGuard) ||
		!exactKeys(node.missingHandlerGuard, GUARD_BINDING_KEYS) ||
		!plainObject(node.handlerInvocation) ||
		!exactKeys(node.handlerInvocation, HANDLER_INVOCATION_BINDING_KEYS)
	)
		return false;
	if (node.sourceLocations.some((item) => !plainObject(item) || !exactKeys(item, LOCATION_KEYS)))
		return false;
	if (
		graph.edges.some(
			(edge) =>
				!plainObject(edge) ||
				!exactKeys(edge, EDGE_KEYS) ||
				!Array.isArray(edge.provenanceIds) ||
				!Array.isArray(edge.registeredCommandNames) ||
				!Array.isArray(edge.sourceLocations) ||
				!plainObject(edge.inferenceBasis) ||
				!exactKeys(edge.inferenceBasis, INFERENCE_BASIS_KEYS) ||
				!Array.isArray(edge.inferenceBasis.assumptions) ||
				!Array.isArray(edge.inferenceBasis.limitationKinds) ||
				!Array.isArray(edge.inferenceBasis.supportingInputIds) ||
				!plainObject(edge.source) ||
				!exactKeys(edge.source, ENDPOINT_KEYS) ||
				!plainObject(edge.target) ||
				!exactKeys(edge.target, ENDPOINT_KEYS) ||
				edge.sourceLocations.some((item) => !plainObject(item) || !exactKeys(item, LOCATION_KEYS))
		)
	)
		return false;
	if (
		graph.layers.length !== 2 ||
		graph.layers.some(
			(layer) =>
				!plainObject(layer) ||
				!exactKeys(layer, LAYER_KEYS) ||
				!Array.isArray(layer.edgeIds) ||
				!Array.isArray(layer.limitations) ||
				!Array.isArray(layer.nodeIds) ||
				!Array.isArray(layer.provenanceIds) ||
				!plainObject(layer.coverage) ||
				!exactKeys(layer.coverage, COVERAGE_KEYS) ||
				layer.limitations.some((item) => !plainObject(item) || !exactKeys(item, LIMITATION_KEYS))
		) ||
		graph.forwardIndex.some(
			(entry) =>
				!plainObject(entry) || !exactKeys(entry, INDEX_KEYS) || !Array.isArray(entry.edgeIds)
		) ||
		graph.reverseIndex.some(
			(entry) =>
				!plainObject(entry) || !exactKeys(entry, INDEX_KEYS) || !Array.isArray(entry.edgeIds)
		)
	)
		return false;
	return true;
}

function orderedUnique(values: readonly string[]): boolean {
	return (
		new Set(values).size === values.length &&
		values.every((value, index) => index === 0 || values[index - 1]! < value)
	);
}

type AddIssue = (
	code: CommandDispatchTopologyValidationIssueCode,
	message: string,
	path: string
) => void;

interface DispatchValidationInputs {
	readonly arrowObservation: ArrowCommandCensusObservation;
	readonly commandHandlerGraph: CommandHandlerGraphSnapshot;
	readonly request: BuildCommandDispatchTopologyRequest;
	readonly snapshot: StaticSemanticSnapshot;
	readonly subject: FrozenSubject;
}

/** The caller options are refused before any budget exists to bound the inspection. */
function invalidOptionsResult(error: unknown): CommandDispatchTopologyValidationResult {
	return {
		issues: [
			{
				code: 'INVALID_SHAPE',
				message:
					error instanceof Error
						? `Validation options are invalid: ${error.message}`
						: 'Validation options are invalid.',
				path: '$options'
			}
		],
		state: 'INVALID'
	};
}

/** A hostile-value inspection failure is the sole issue the validator can report. */
function inspectionFailureResult(
	inspected: InspectionFailure
): CommandDispatchTopologyValidationResult {
	return {
		issues: [
			{
				code: inspected.budget ? 'VALIDATION_BUDGET_EXHAUSTED' : 'INVALID_SHAPE',
				message: inspected.message,
				path: inspected.path
			}
		],
		state: inspected.budget ? 'BUDGET_EXHAUSTED' : 'INVALID'
	};
}

function derivationFailureMessage(error: unknown): string {
	return error instanceof Error
		? `Independent topology derivation failed closed: ${error.message}`
		: 'Independent topology derivation failed closed.';
}

/** Admit the graph only when request, top-level, and nested field sets are all exact. */
function shapeValidatedGraph(
	graphValue: unknown,
	request: BuildCommandDispatchTopologyRequest,
	add: AddIssue
): CommandDispatchTopologySnapshot | null {
	if (!requestShapeValid(request)) {
		add('INVALID_SHAPE', 'The build request is not an exact valid plain record.', '$request');
		return null;
	}
	if (!plainObject(graphValue) || !exactKeys(graphValue, TOP_LEVEL_KEYS)) {
		add('INVALID_SHAPE', 'The graph top-level field set is invalid.', '$');
		return null;
	}
	const graph = graphValue as unknown as CommandDispatchTopologySnapshot;
	if (graph.schemaVersion !== COMMAND_DISPATCH_TOPOLOGY_SCHEMA_VERSION)
		add(
			'UNSUPPORTED_SCHEMA_VERSION',
			'Command-dispatch topology schema version is unsupported.',
			'$.schemaVersion'
		);
	if (!exactNestedShape(graph)) {
		add('INVALID_SHAPE', 'A graph nested field set or tuple cardinality is invalid.', '$');
		return null;
	}
	return graph;
}

/** Dispatch-topology validation is performable only on a project-, syntax-, and symbol-bearing snapshot. */
function requiredSemanticCapabilities(snapshot: StaticSemanticSnapshot, add: AddIssue): boolean {
	if (
		(['TS_PROJECT', 'TS_SYNTAX', 'TS_SYMBOL'] as const).every((required) =>
			snapshot.capabilities.some(
				(capability) => capability.capability === required && capability.state !== 'UNSUPPORTED'
			)
		)
	)
		return true;
	add(
		'INPUT_BINDING_MISMATCH',
		'TS_PROJECT, TS_SYNTAX, and TS_SYMBOL are required for dispatch-topology validation.',
		'$input.semanticSnapshot.capabilities'
	);
	return false;
}

/** Graph, request, snapshot, predecessor, observation, and frozen subject must name one subject. */
function addInputBindingIssues(
	graph: CommandDispatchTopologySnapshot,
	inputs: DispatchValidationInputs,
	add: AddIssue
): void {
	const { arrowObservation, commandHandlerGraph, request, snapshot, subject } = inputs;
	if (
		request.schemaVersion !== COMMAND_DISPATCH_TOPOLOGY_REQUEST_SCHEMA_VERSION ||
		request.operationVersion !== COMMAND_DISPATCH_TOPOLOGY_OPERATION_VERSION
	)
		add('INVALID_VALUE', 'Request schema or operation version is invalid.', '$request');
	if (
		request.subjectId !== snapshot.subjectId ||
		request.subjectId !== commandHandlerGraph.subjectId ||
		request.subjectId !== arrowObservation.subjectId ||
		request.subjectId !== subject.descriptor.subjectId ||
		graph.subjectId !== request.subjectId
	)
		add(
			'INPUT_BINDING_MISMATCH',
			'Graph, request, snapshot, predecessor, observation, and frozen subject identities differ.',
			'$.subjectId'
		);
	if (
		request.semanticSnapshotId !== snapshot.id ||
		commandHandlerGraph.semanticSnapshotId !== snapshot.id ||
		graph.semanticSnapshotId !== snapshot.id
	)
		add(
			'INPUT_BINDING_MISMATCH',
			'The semantic snapshot identity binding is invalid.',
			'$.semanticSnapshotId'
		);
	if (
		request.commandHandlerGraphId !== commandHandlerGraph.id ||
		graph.commandHandlerGraphId !== commandHandlerGraph.id ||
		graph.commandHandlerGraphContentDigest !== commandHandlerGraph.contentDigest ||
		graph.commandHandlerGraphSchemaVersion !== commandHandlerGraph.schemaVersion
	)
		add(
			'INPUT_BINDING_MISMATCH',
			'The predecessor command-handler graph binding is invalid.',
			'$.commandHandlerGraphId'
		);
	if (
		commandHandlerGraph.arrowObservationId !== arrowObservation.id ||
		graph.arrowObservationId !== arrowObservation.id ||
		graph.arrowObservationContentDigest !== arrowObservation.contentDigest
	)
		add(
			'INPUT_BINDING_MISMATCH',
			'The retained arrow observation binding is invalid.',
			'$.arrowObservationId'
		);
}

/** Selector, retained census, input digest, and identity must reproduce from independent derivation. */
function addExpectedDerivationIssues(
	graph: CommandDispatchTopologySnapshot,
	expected: ExpectedTopology,
	request: BuildCommandDispatchTopologyRequest,
	add: AddIssue
): void {
	if (!same(request.commandBus, expected.selector) || !same(graph.commandBus, expected.selector))
		add(
			'SELECTOR_MISMATCH',
			'The selected command-bus method does not equal independent semantic selection.',
			'$.commandBus'
		);
	if (!same(graph.retainedCommandDispatchCensus, expected.retainedCensus))
		add(
			'INPUT_BINDING_MISMATCH',
			'The retained command-dispatch census reference is invalid.',
			'$.retainedCommandDispatchCensus'
		);
	if (graph.graphInputDigest !== expected.graphInputDigest)
		add(
			'INPUT_BINDING_MISMATCH',
			'The graph input digest does not reproduce from exact inputs.',
			'$.graphInputDigest'
		);
	if (graph.id !== expected.graphId)
		add('GRAPH_ID_MISMATCH', 'The graph identity does not reproduce.', '$.id');
}

/** The metadata, nonclaim, and per-edge constant surface is fixed by this operation version. */
function addConstantSurfaceIssues(
	graph: CommandDispatchTopologySnapshot,
	snapshot: StaticSemanticSnapshot,
	add: AddIssue
): void {
	const constantSurface = {
		authorityTransfer: COMMAND_DISPATCH_TOPOLOGY_AUTHORITY_TRANSFER,
		baselineChange: COMMAND_DISPATCH_TOPOLOGY_BASELINE_CHANGE,
		canonicalProfile: COMMAND_DISPATCH_TOPOLOGY_CANONICAL_PROFILE,
		capabilities: [
			COMMAND_DISPATCH_TOPOLOGY_DERIVATION_CAPABILITY,
			COMMAND_DISPATCH_TOPOLOGY_INFERENCE_CAPABILITY
		],
		capabilityStatus: COMMAND_DISPATCH_TOPOLOGY_CAPABILITY_STATUS,
		commandHandlerPopulationTreatment:
			COMMAND_DISPATCH_TOPOLOGY_COMMAND_HANDLER_POPULATION_TREATMENT,
		fullJanCsaa007Conformance: COMMAND_DISPATCH_TOPOLOGY_FULL_JAN_CSAA_007_CONFORMANCE,
		fullJanCsaa008Conformance: COMMAND_DISPATCH_TOPOLOGY_FULL_JAN_CSAA_008_CONFORMANCE,
		gateEffect: COMMAND_DISPATCH_TOPOLOGY_GATE_EFFECT,
		graphAuthority: COMMAND_DISPATCH_TOPOLOGY_GRAPH_AUTHORITY,
		graphKind: 'JPWB_COMMAND_DISPATCH_STATIC_TOPOLOGY_OVERLAY',
		health: 'PARTIAL',
		integrationStrategy: COMMAND_DISPATCH_TOPOLOGY_INTEGRATION_STRATEGY,
		limitations: COMMAND_DISPATCH_TOPOLOGY_LIMITATIONS,
		method: COMMAND_DISPATCH_TOPOLOGY_METHOD,
		operationVersion: COMMAND_DISPATCH_TOPOLOGY_OPERATION_VERSION,
		oracleChange: COMMAND_DISPATCH_TOPOLOGY_ORACLE_CHANGE,
		producer: snapshot.provider,
		registryStatus: COMMAND_DISPATCH_TOPOLOGY_REGISTRY_STATUS,
		replacementEquivalence: COMMAND_DISPATCH_TOPOLOGY_REPLACEMENT_EQUIVALENCE,
		retainedCommandDispatchCensusIntegration: COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_INTEGRATION,
		runtimeDispatchClosure: COMMAND_DISPATCH_TOPOLOGY_RUNTIME_DISPATCH_CLOSURE,
		runtimePerformability: COMMAND_DISPATCH_TOPOLOGY_RUNTIME_PERFORMABILITY,
		scope: COMMAND_DISPATCH_TOPOLOGY_SCOPE,
		semanticExtractionVersion: snapshot.extractionVersion,
		semanticSchemaVersion: snapshot.schemaVersion
	};
	const actualConstantSurface = {
		authorityTransfer: graph.authorityTransfer,
		baselineChange: graph.baselineChange,
		canonicalProfile: graph.canonicalProfile,
		capabilities: graph.capabilities,
		capabilityStatus: graph.capabilityStatus,
		commandHandlerPopulationTreatment: graph.commandHandlerPopulationTreatment,
		fullJanCsaa007Conformance: graph.fullJanCsaa007Conformance,
		fullJanCsaa008Conformance: graph.fullJanCsaa008Conformance,
		gateEffect: graph.gateEffect,
		graphAuthority: graph.graphAuthority,
		graphKind: graph.graphKind,
		health: graph.health,
		integrationStrategy: graph.integrationStrategy,
		limitations: graph.limitations,
		method: graph.method,
		operationVersion: graph.operationVersion,
		oracleChange: graph.oracleChange,
		producer: graph.producer,
		registryStatus: graph.registryStatus,
		replacementEquivalence: graph.replacementEquivalence,
		retainedCommandDispatchCensusIntegration: graph.retainedCommandDispatchCensusIntegration,
		runtimeDispatchClosure: graph.runtimeDispatchClosure,
		runtimePerformability: graph.runtimePerformability,
		scope: graph.scope,
		semanticExtractionVersion: graph.semanticExtractionVersion,
		semanticSchemaVersion: graph.semanticSchemaVersion
	};
	if (!same(actualConstantSurface, constantSurface))
		add('INVALID_VALUE', 'Graph metadata or nonclaim surface is invalid.', '$');
	if (
		graph.edges.some(
			(edge) =>
				edge.attribution !== 'CANDIDATE' ||
				edge.method !== COMMAND_DISPATCH_TOPOLOGY_METHOD ||
				edge.relationCode !== 'IMPL-JPWB-CD-DISPATCH-TARGET-001' ||
				edge.relationKind !== 'STATIC_DISPATCH_PIPELINE_TO_HANDLER_TARGET' ||
				edge.source.kind !== 'STATIC_DISPATCH_PIPELINE' ||
				edge.target.kind !== 'HANDLER_TARGET'
		)
	)
		add(
			'INVALID_VALUE',
			'An edge attribution, method, relation, or endpoint-kind constant is invalid.',
			'$.edges'
		);
}

/** Node, edge, coverage, layer, and index populations must reproduce and stay canonical. */
function addPopulationIssues(
	graph: CommandDispatchTopologySnapshot,
	expected: ExpectedTopology,
	add: AddIssue
): void {
	if (!same(graph.nodes, [expected.node]))
		add(
			'POPULATION_MISMATCH',
			'The dispatch pipeline node does not independently reproduce.',
			'$.nodes'
		);
	if (!same(graph.edges, expected.edges))
		add(
			'POPULATION_MISMATCH',
			'The candidate handler-target edge population does not independently reproduce.',
			'$.edges'
		);
	if (!same(graph.coverage, expected.coverage))
		add('RECONCILIATION_MISMATCH', 'Coverage does not independently reconcile.', '$.coverage');
	if (!same(graph.layers, expected.layers))
		add('RECONCILIATION_MISMATCH', 'Layer partitions do not independently reconcile.', '$.layers');
	if (
		!same(graph.forwardIndex, expected.forwardIndex) ||
		!same(graph.reverseIndex, expected.reverseIndex)
	)
		add(
			'NONCANONICAL_ORDER',
			'Forward or reverse indexes are invalid or noncanonical.',
			'$.forwardIndex'
		);
	if (
		!orderedUnique(graph.edges.map((edge) => edge.id)) ||
		!orderedUnique(graph.nodes.map((node) => node.id)) ||
		new Set(graph.edges.map((edge) => edge.target.nodeId)).size !== graph.edges.length
	)
		add(
			'POPULATION_DUPLICATION',
			'Graph node, edge, or referenced-target identities are duplicated or unordered.',
			'$.edges'
		);
}

/** Recorded budgets are the caller's operation guard; the independent populations must fit them. */
function addBudgetIssues(
	graph: CommandDispatchTopologySnapshot,
	expected: ExpectedTopology,
	inputs: DispatchValidationInputs,
	add: AddIssue
): void {
	const { request, snapshot } = inputs;
	for (const [path, actual, maximum] of [
		['$.budgets.maxAstNodes', snapshot.astNodes.length, graph.budgets.maxAstNodes],
		['$.budgets.maxEdges', expected.edges.length, graph.budgets.maxEdges],
		[
			'$.budgets.maxHandlerTargets',
			expected.coverage.commandHandlerGraphHandlerTargets,
			graph.budgets.maxHandlerTargets
		],
		['$.budgets.maxNodes', 1, graph.budgets.maxNodes],
		['$.budgets.maxSourceBytes', expected.sourceBytes, graph.budgets.maxSourceBytes]
	] as const)
		if (actual > maximum)
			add(
				'VALIDATION_BUDGET_EXHAUSTED',
				`Graph population exceeds its caller operation guard: ${actual} > ${maximum}.`,
				path
			);
	if (!same(graph.budgets, request.budgets))
		add('INPUT_BINDING_MISMATCH', 'Recorded graph budgets differ from the request.', '$.budgets');
	if (graph.contentDigest !== commandDispatchTopologyContentDigest(graph))
		add('CONTENT_DIGEST_MISMATCH', 'Graph content digest does not reproduce.', '$.contentDigest');
}

/**
 * Independently validate the bounded JPWB static dispatch overlay. The validator re-selects
 * every semantic site and composes predecessor targets; it never trusts builder coverage.
 */
export function validateCommandDispatchTopology(
	graphValue: unknown,
	request: BuildCommandDispatchTopologyRequest,
	snapshot: StaticSemanticSnapshot,
	commandHandlerGraph: CommandHandlerGraphSnapshot,
	arrowObservation: ArrowCommandCensusObservation,
	subject: FrozenSubject,
	options?: CommandDispatchTopologyValidationOptions
): CommandDispatchTopologyValidationResult {
	let limits: ValidationLimits;
	try {
		limits = materializeOptions(options);
	} catch (error) {
		return invalidOptionsResult(error);
	}
	const inspected = inspectPlainData(graphValue, limits);
	if (inspected !== null) return inspectionFailureResult(inspected);
	const issues: CommandDispatchTopologyValidationIssue[] = [];
	const add = (
		code: CommandDispatchTopologyValidationIssueCode,
		message: string,
		path: string
	): void => {
		if (issues.length < limits.maxIssues) issues.push({ code, message, path });
	};
	try {
		const graph = shapeValidatedGraph(graphValue, request, add);
		if (graph === null) return { issues, state: 'INVALID' };
		if (!requiredSemanticCapabilities(snapshot, add)) return { issues, state: 'INVALID' };
		const inputs: DispatchValidationInputs = {
			arrowObservation,
			commandHandlerGraph,
			request,
			snapshot,
			subject
		};
		const upstreamValidation = validateCommandHandlerGraph(
			commandHandlerGraph,
			snapshot,
			arrowObservation,
			subject,
			{
				maxIssues: 1_000,
				maxRecords: 10_000_000,
				maxStringCharacters: 1_000_000_000
			}
		);
		if (upstreamValidation.state !== 'VALID')
			add(
				'INPUT_BINDING_MISMATCH',
				`The predecessor command-handler graph is not independently valid (${upstreamValidation.state}).`,
				'$input.commandHandlerGraph'
			);
		addInputBindingIssues(graph, inputs, add);

		const expected = expectedTopology(
			request,
			snapshot,
			commandHandlerGraph,
			arrowObservation,
			subject
		);
		addExpectedDerivationIssues(graph, expected, request, add);
		addConstantSurfaceIssues(graph, snapshot, add);
		addPopulationIssues(graph, expected, add);
		addBudgetIssues(graph, expected, inputs, add);
	} catch (error) {
		add('POPULATION_MISMATCH', derivationFailureMessage(error), '$');
	}
	if (issues.length === 0) return { issues: [], state: 'VALID' };
	return {
		issues,
		state: issues.some((issue) => issue.code === 'VALIDATION_BUDGET_EXHAUSTED')
			? 'BUDGET_EXHAUSTED'
			: 'INVALID'
	};
}

/** Builder-facing name; it intentionally executes the same independent public derivation. */
export const validateConstructedCommandDispatchTopology = validateCommandDispatchTopology;
