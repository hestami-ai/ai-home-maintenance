import { isProxy } from 'node:util/types';
import ts from 'typescript';

import type { ArrowCommandCensusObservation } from '../contracts/arrow-command-census.js';
import type {
	CommandHandlerGraphEdge,
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
	type CommandDispatchHandlerInvocationSemanticBinding,
	type CommandDispatchLookupSemanticBinding,
	type CommandDispatchMissingHandlerGuardSemanticBinding,
	type CommandDispatchPayloadValidationSemanticBinding,
	type CommandDispatchPipelineNode,
	type CommandDispatchTopologyBuildDiagnostic,
	type CommandDispatchTopologyBuildDiagnosticCode,
	type CommandDispatchTopologyBuildOutcome,
	type CommandDispatchTopologyCommandBusSelector,
	type CommandDispatchTopologyCoverage,
	type CommandDispatchTopologyEdge,
	type CommandDispatchTopologyIndexEntry,
	type CommandDispatchTopologyInferenceBasis,
	type CommandDispatchTopologyLayer,
	type CommandDispatchTopologySourceLocation
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
import { canonicalSemanticJsonWitness } from '../semantic/canonical.js';
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
import { validateCommandDispatchTopology } from './validate-command-dispatch-topology.js';

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
const MAX_PROGRESS_COUNTS = 16;
const TRANSPARENT_EXPRESSION_KINDS = new Set<number>([
	ts.SyntaxKind.AsExpression,
	ts.SyntaxKind.SatisfiesExpression,
	ts.SyntaxKind.TypeAssertionExpression,
	ts.SyntaxKind.ParenthesizedExpression,
	ts.SyntaxKind.NonNullExpression
]);

export type { CommandDispatchTopologyBuildDiagnosticCode };

export const COMMAND_DISPATCH_TOPOLOGY_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-command-dispatch-topology-progress/1.0.0' as const;

export type CommandDispatchTopologyProgressPhase =
	| 'REQUEST_BIND'
	| 'UPSTREAM_GRAPH_VALIDATE'
	| 'DISPATCH_SOURCE_SELECT'
	| 'DISPATCH_SITE_DISCOVERY'
	| 'KEY_BINDING_RESOLVE'
	| 'LOOKUP_FLOW_RESOLVE'
	| 'TARGET_COMPOSE'
	| 'GRAPH_MATERIALIZE'
	| 'SERIALIZE'
	| 'GRAPH_VALIDATE';

export interface CommandDispatchTopologyProgressEvent {
	readonly counts: Readonly<Record<string, number>>;
	readonly monotonicDurationMs: number;
	readonly phase: CommandDispatchTopologyProgressPhase;
	readonly schemaVersion: typeof COMMAND_DISPATCH_TOPOLOGY_PROGRESS_SCHEMA_VERSION;
	readonly state: 'STARTED' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
	readonly timestamp: string;
	readonly wallDurationMs: number;
}

export interface BuildCommandDispatchTopologyOptions {
	/** Out-of-band telemetry only; the sink cannot affect graph evidence or outcome. */
	readonly onProgress?: (event: CommandDispatchTopologyProgressEvent) => void;
}

interface ProgressRecorder {
	complete(counts?: Readonly<Record<string, number>>): void;
	fail(counts?: Readonly<Record<string, number>>): void;
	skip(
		phase: CommandDispatchTopologyProgressPhase,
		counts?: Readonly<Record<string, number>>
	): void;
	start(
		phase: CommandDispatchTopologyProgressPhase,
		counts?: Readonly<Record<string, number>>
	): void;
}

interface SemanticIndexes {
	readonly aliasesBySymbol: ReadonlyMap<
		SemanticSymbolId,
		StaticSemanticSnapshot['aliases'][number]
	>;
	readonly assignmentByNode: ReadonlyMap<SemanticAstNodeRecord['id'], SemanticAssignmentRecord[]>;
	readonly childrenByParent: ReadonlyMap<SemanticAstNodeRecord['id'], SemanticAstNodeRecord[]>;
	readonly declarationById: ReadonlyMap<string, SemanticDeclarationRecord>;
	readonly invocationByNode: ReadonlyMap<SemanticAstNodeRecord['id'], SemanticInvocationSiteRecord>;
	readonly nodeById: ReadonlyMap<SemanticAstNodeRecord['id'], SemanticAstNodeRecord>;
	readonly projectConfigById: ReadonlyMap<string, string>;
	readonly referencesByNode: ReadonlyMap<SemanticAstNodeRecord['id'], SemanticReferenceRecord[]>;
	readonly sourceById: ReadonlyMap<string, SemanticSourceRecord>;
}

interface LookupFact {
	readonly assignment: SemanticAssignmentRecord;
	readonly binding: CommandDispatchLookupSemanticBinding;
	readonly commandBaseSymbolId: SemanticSymbolId;
	readonly commandTypeSymbolId: SemanticSymbolId;
	readonly localSymbolId: SemanticSymbolId;
	readonly registrySymbolId: SemanticSymbolId;
	readonly sourceLocation: CommandDispatchTopologySourceLocation;
}

interface ValidationFact {
	readonly binding: CommandDispatchPayloadValidationSemanticBinding;
	readonly commandBaseSymbolId: SemanticSymbolId;
	readonly localSymbolId: SemanticSymbolId;
	readonly sourceLocation: CommandDispatchTopologySourceLocation;
}

interface GuardFact {
	readonly binding: CommandDispatchMissingHandlerGuardSemanticBinding;
	readonly sourceLocation: CommandDispatchTopologySourceLocation;
}

interface InvocationFact {
	readonly binding: CommandDispatchHandlerInvocationSemanticBinding;
	readonly sourceLocation: CommandDispatchTopologySourceLocation;
}

function diagnostic(
	code: CommandDispatchTopologyBuildDiagnostic['code'],
	message: string,
	phase: CommandDispatchTopologyBuildDiagnostic['phase'],
	path: string | null = null
): CommandDispatchTopologyBuildDiagnostic {
	return { code, message, path, phase };
}

function unavailable(
	code: CommandDispatchTopologyBuildDiagnostic['code'],
	message: string,
	phase: CommandDispatchTopologyBuildDiagnostic['phase'],
	path: string | null = null
): CommandDispatchTopologyBuildOutcome {
	return { diagnostics: [diagnostic(code, message, phase, path)], outcome: 'unavailable' };
}

function exactPlainRecord(
	value: unknown,
	keys: readonly string[],
	path: string
): Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		throw new TypeError(`${path} must be an exact plain data record.`);
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new TypeError(`${path} must have a plain prototype.`);
	const own = Reflect.ownKeys(value);
	if (
		own.length !== keys.length ||
		own.some((key) => typeof key !== 'string' || !keys.includes(key))
	)
		throw new TypeError(`${path} field population is not exact.`);
	for (const key of keys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new TypeError(`${path}.${key} must be an enumerable data property.`);
	}
	return value as Record<string, unknown>;
}

function materializeRequest(value: unknown): BuildCommandDispatchTopologyRequest {
	const record = exactPlainRecord(value, REQUEST_KEYS, '$request');
	const budgets = exactPlainRecord(record.budgets, BUDGET_KEYS, '$request.budgets');
	const commandBus = exactPlainRecord(record.commandBus, SELECTOR_KEYS, '$request.commandBus');
	for (const key of BUDGET_KEYS)
		if (!Number.isSafeInteger(budgets[key]) || (budgets[key] as number) < 1)
			throw new TypeError(`$request.budgets.${key} must be a positive safe integer.`);
	for (const key of SELECTOR_KEYS)
		if (typeof commandBus[key] !== 'string' || (commandBus[key] as string).length === 0)
			throw new TypeError(`$request.commandBus.${key} must be nonempty text.`);
	for (const key of REQUEST_KEYS.filter((key) => key !== 'budgets' && key !== 'commandBus'))
		if (typeof record[key] !== 'string' || (record[key] as string).length === 0)
			throw new TypeError(`$request.${key} must be nonempty text.`);
	if (record.schemaVersion !== COMMAND_DISPATCH_TOPOLOGY_REQUEST_SCHEMA_VERSION)
		throw new TypeError('Unsupported command-dispatch topology request schema version.');
	if (record.operationVersion !== COMMAND_DISPATCH_TOPOLOGY_OPERATION_VERSION)
		throw new TypeError('Unsupported command-dispatch topology operation version.');
	if (
		commandBus.logicalPath !== COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_LOGICAL_PATH ||
		commandBus.projectConfigPath !== COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_PROJECT_CONFIG_PATH ||
		commandBus.methodName !== COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_METHOD_NAME
	)
		throw new TypeError('The command-bus selector is outside the exact supported JPWB surface.');
	return {
		...(record as unknown as BuildCommandDispatchTopologyRequest),
		budgets: { ...(budgets as unknown as BuildCommandDispatchTopologyRequest['budgets']) },
		commandBus: { ...(commandBus as unknown as CommandDispatchTopologyCommandBusSelector) }
	};
}

function boundedCounts(counts: Readonly<Record<string, number>>): Readonly<Record<string, number>> {
	const result: Record<string, number> = {};
	for (const key of Object.keys(counts).sort(compareText).slice(0, MAX_PROGRESS_COUNTS)) {
		const value = counts[key];
		if (Number.isSafeInteger(value) && value! >= 0) result[key] = value!;
	}
	return result;
}

function safeProgressSink(
	options: BuildCommandDispatchTopologyOptions | undefined
): ((event: CommandDispatchTopologyProgressEvent) => void) | undefined {
	if (options === undefined || options === null || typeof options !== 'object' || isProxy(options))
		return undefined;
	try {
		const prototype = Reflect.getPrototypeOf(options);
		if (prototype !== Object.prototype && prototype !== null) return undefined;
		if (Reflect.ownKeys(options).some((key) => key !== 'onProgress')) return undefined;
		const descriptor = Reflect.getOwnPropertyDescriptor(options, 'onProgress');
		return descriptor !== undefined &&
			descriptor.enumerable &&
			'value' in descriptor &&
			typeof descriptor.value === 'function'
			? (descriptor.value as (event: CommandDispatchTopologyProgressEvent) => void)
			: undefined;
	} catch {
		return undefined;
	}
}

function createProgressRecorder(
	options: BuildCommandDispatchTopologyOptions | undefined
): ProgressRecorder {
	const sink = safeProgressSink(options);
	let active: {
		readonly monotonicStarted: number;
		readonly phase: CommandDispatchTopologyProgressPhase;
		readonly wallStarted: number;
	} | null = null;
	const emit = (
		phase: CommandDispatchTopologyProgressPhase,
		state: CommandDispatchTopologyProgressEvent['state'],
		counts: Readonly<Record<string, number>>,
		monotonicDurationMs: number,
		wallDurationMs: number
	): void => {
		if (sink === undefined) return;
		try {
			const event = Object.freeze({
				counts: Object.freeze({ ...boundedCounts(counts) }),
				monotonicDurationMs: Math.max(0, monotonicDurationMs),
				phase,
				schemaVersion: COMMAND_DISPATCH_TOPOLOGY_PROGRESS_SCHEMA_VERSION,
				state,
				timestamp: new Date().toISOString(),
				wallDurationMs: Math.max(0, wallDurationMs)
			});
			sink(event);
		} catch {
			// The telemetry sink is deliberately unable to affect evidence or outcome.
		}
	};
	const close = (
		state: CommandDispatchTopologyProgressEvent['state'],
		counts: Readonly<Record<string, number>>
	): void => {
		if (active === null) return;
		emit(
			active.phase,
			state,
			counts,
			performance.now() - active.monotonicStarted,
			Date.now() - active.wallStarted
		);
		active = null;
	};
	return {
		complete(counts = {}): void {
			close('COMPLETED', counts);
		},
		fail(counts = {}): void {
			close('FAILED', counts);
		},
		skip(phase, counts = {}): void {
			emit(phase, 'SKIPPED', counts, 0, 0);
		},
		start(phase, counts = {}): void {
			if (active !== null) close('FAILED', { interrupted: 1 });
			active = { monotonicStarted: performance.now(), phase, wallStarted: Date.now() };
			emit(phase, 'STARTED', counts, 0, 0);
		}
	};
}

function addGrouped<Key, Value>(map: Map<Key, Value[]>, key: Key, value: Value): void {
	const values = map.get(key);
	if (values === undefined) map.set(key, [value]);
	else values.push(value);
}

function sortedUnique<T extends string>(values: Iterable<T>): T[] {
	return [...new Set(values)].sort(compareText);
}

function uniqueSourceLocations(
	locations: readonly CommandDispatchTopologySourceLocation[]
): CommandDispatchTopologySourceLocation[] {
	const unique = new Map<string, CommandDispatchTopologySourceLocation>();
	for (const location of locations)
		unique.set(`${location.sourceId}\0${location.start}\0${location.end}`, location);
	return [...unique.values()].sort(
		(left, right) =>
			compareText(left.sourceId, right.sourceId) || left.start - right.start || left.end - right.end
	);
}

function indexes(snapshot: StaticSemanticSnapshot): SemanticIndexes {
	const assignmentByNode = new Map<SemanticAstNodeRecord['id'], SemanticAssignmentRecord[]>();
	const childrenByParent = new Map<SemanticAstNodeRecord['id'], SemanticAstNodeRecord[]>();
	const referencesByNode = new Map<SemanticAstNodeRecord['id'], SemanticReferenceRecord[]>();
	for (const assignment of snapshot.assignments)
		addGrouped(assignmentByNode, assignment.nodeId, assignment);
	for (const node of snapshot.astNodes)
		if (node.parentId !== null) addGrouped(childrenByParent, node.parentId, node);
	for (const reference of snapshot.references)
		addGrouped(referencesByNode, reference.nodeId, reference);
	for (const children of childrenByParent.values())
		children.sort(
			(left, right) => left.siblingOrdinal - right.siblingOrdinal || left.start - right.start
		);
	return {
		aliasesBySymbol: new Map(snapshot.aliases.map((alias) => [alias.aliasSymbolId, alias])),
		assignmentByNode,
		childrenByParent,
		declarationById: new Map(
			snapshot.declarations.map((declaration) => [declaration.id, declaration])
		),
		invocationByNode: new Map(
			snapshot.invocations.map((invocation) => [invocation.nodeId, invocation])
		),
		nodeById: new Map(snapshot.astNodes.map((node) => [node.id, node])),
		projectConfigById: new Map(
			snapshot.projects.map((project) => [project.id, project.configPath])
		),
		referencesByNode,
		sourceById: new Map(snapshot.sources.map((source) => [source.id, source]))
	};
}

function descendants(root: SemanticAstNodeRecord, model: SemanticIndexes): SemanticAstNodeRecord[] {
	const result: SemanticAstNodeRecord[] = [];
	const pending = [root];
	while (pending.length > 0) {
		const current = pending.pop()!;
		result.push(current);
		const children = model.childrenByParent.get(current.id) ?? [];
		for (let index = children.length - 1; index >= 0; index -= 1) pending.push(children[index]!);
	}
	return result;
}

function sourceLocation(node: SemanticAstNodeRecord): CommandDispatchTopologySourceLocation {
	return { end: node.end, sourceId: node.sourceId, start: node.start };
}

function exactReference(
	node: SemanticAstNodeRecord,
	role: SemanticReferenceRecord['role'],
	model: SemanticIndexes
): SemanticReferenceRecord {
	const references = (model.referencesByNode.get(node.id) ?? []).filter(
		(reference) => reference.role === role
	);
	if (references.length !== 1 || references[0]!.resolvedSymbolId === null)
		throw new Error(`${node.syntacticIdentifierText ?? node.id} has no exact ${role} binding.`);
	return references[0]!;
}

function terminalSymbolId(
	reference: SemanticReferenceRecord,
	model: SemanticIndexes
): SemanticSymbolId {
	if (reference.resolvedSymbolId === null)
		throw new Error('A required semantic symbol is unresolved.');
	const alias = model.aliasesBySymbol.get(reference.resolvedSymbolId);
	if (alias === undefined) return reference.resolvedSymbolId;
	if (alias.terminalSymbolId === null)
		throw new Error('A required semantic alias has no terminal symbol identity.');
	return alias.terminalSymbolId;
}

function directPropertyAccess(
	node: SemanticAstNodeRecord,
	baseName: string,
	memberName: string,
	model: SemanticIndexes
): { readonly base: SemanticAstNodeRecord; readonly member: SemanticAstNodeRecord } {
	if (node.kind !== ts.SyntaxKind.PropertyAccessExpression)
		throw new Error(`Expected ${baseName}.${memberName} as a direct property access.`);
	const children = model.childrenByParent.get(node.id) ?? [];
	if (children.length !== 2)
		throw new Error(`${baseName}.${memberName} must have exactly two direct children.`);
	const [base, member] = children;
	if (
		base?.kind !== ts.SyntaxKind.Identifier ||
		base.syntacticIdentifierText !== baseName ||
		member?.kind !== ts.SyntaxKind.Identifier ||
		member.syntacticIdentifierText !== memberName
	)
		throw new Error(`${baseName}.${memberName} has noncanonical direct children.`);
	return { base, member };
}

function unwrapRegistryIdentifier(
	node: SemanticAstNodeRecord,
	registryName: 'COMMANDS' | 'HANDLERS',
	model: SemanticIndexes
): SemanticAstNodeRecord {
	let current = node;
	const visited = new Set<string>();
	while (TRANSPARENT_EXPRESSION_KINDS.has(current.kind)) {
		if (visited.has(current.id)) throw new Error('Transparent expression cycle detected.');
		visited.add(current.id);
		const expressionChildren = (model.childrenByParent.get(current.id) ?? []).filter(
			(child) =>
				child.kind === ts.SyntaxKind.Identifier || TRANSPARENT_EXPRESSION_KINDS.has(child.kind)
		);
		if (expressionChildren.length !== 1)
			throw new Error('A transparent registry expression must have one expression child.');
		current = expressionChildren[0]!;
	}
	if (current.kind !== ts.SyntaxKind.Identifier || current.syntacticIdentifierText !== registryName)
		throw new Error(`The lookup base is not the exact ${registryName} identifier.`);
	return current;
}

function assignmentFor(
	name: string,
	methodNodes: readonly SemanticAstNodeRecord[],
	model: SemanticIndexes
): { readonly assignment: SemanticAssignmentRecord; readonly target: SemanticAstNodeRecord } {
	const methodIds = new Set(methodNodes.map((node) => node.id));
	const matches = [...model.assignmentByNode.values()]
		.flat()
		.filter(
			(assignment) =>
				assignment.assignmentKind === 'INITIALIZER' &&
				assignment.valueNodeId !== null &&
				methodIds.has(assignment.nodeId)
		)
		.flatMap((assignment) => {
			const target = model.nodeById.get(assignment.targetNodeId);
			return target?.kind === ts.SyntaxKind.Identifier && target.syntacticIdentifierText === name
				? [{ assignment, target }]
				: [];
		});
	if (matches.length !== 1) throw new Error(`Expected one normalized ${name} initializer.`);
	return matches[0]!;
}

function lookupFact(
	registryName: 'COMMANDS' | 'HANDLERS',
	localName: 'handler' | 'spec',
	methodNodes: readonly SemanticAstNodeRecord[],
	model: SemanticIndexes
): LookupFact {
	const { assignment, target } = assignmentFor(localName, methodNodes, model);
	const value = model.nodeById.get(assignment.valueNodeId!);
	if (value?.kind !== ts.SyntaxKind.ElementAccessExpression)
		throw new Error(`${localName} is not initialized by an element lookup.`);
	const lookupChildren = model.childrenByParent.get(value.id) ?? [];
	if (lookupChildren.length !== 2)
		throw new Error(`${registryName} element access must have exactly two direct children.`);
	const registry = unwrapRegistryIdentifier(lookupChildren[0]!, registryName, model);
	const access = directPropertyAccess(lookupChildren[1]!, 'command', 'commandType', model);
	const registryReference = exactReference(registry, 'SYMBOL_USE', model);
	const commandTypeReference = exactReference(access.member, 'MEMBER_NAME', model);
	const commandBaseReference = exactReference(access.base, 'SYMBOL_USE', model);
	const localReference = exactReference(target, 'DECLARATION_NAME', model);
	return {
		assignment,
		binding: {
			assignmentNodeId: assignment.nodeId,
			commandTypeReferenceId: commandTypeReference.id,
			registryName,
			registryReferenceId: registryReference.id,
			targetNodeId: target.id,
			valueNodeId: value.id
		},
		commandBaseSymbolId: terminalSymbolId(commandBaseReference, model),
		commandTypeSymbolId: terminalSymbolId(commandTypeReference, model),
		localSymbolId: terminalSymbolId(localReference, model),
		registrySymbolId: terminalSymbolId(registryReference, model),
		sourceLocation: sourceLocation(model.nodeById.get(assignment.nodeId) ?? value)
	};
}

function validationFact(
	methodNodes: readonly SemanticAstNodeRecord[],
	model: SemanticIndexes,
	specSymbolId: SemanticSymbolId
): ValidationFact {
	const { assignment, target } = assignmentFor('parsed', methodNodes, model);
	const value = model.nodeById.get(assignment.valueNodeId!);
	const invocation = value === undefined ? undefined : model.invocationByNode.get(value.id);
	if (value?.kind !== ts.SyntaxKind.CallExpression || invocation?.invocationKind !== 'CALL')
		throw new Error('parsed must be initialized by one normalized call invocation.');
	if (invocation.argumentNodeIds.length !== 3)
		throw new Error('validateAgainst must have exactly three normalized arguments.');
	const callee = model.nodeById.get(invocation.calleeNodeId);
	if (
		callee?.kind !== ts.SyntaxKind.Identifier ||
		callee.syntacticIdentifierText !== 'validateAgainst'
	)
		throw new Error('The payload validator must be validateAgainst.');
	const schemaArgument = model.nodeById.get(invocation.argumentNodeIds[0]!);
	const payloadArgument = model.nodeById.get(invocation.argumentNodeIds[1]!);
	if (schemaArgument === undefined || payloadArgument === undefined)
		throw new Error('A validateAgainst argument is absent from the semantic snapshot.');
	const schemaAccess = directPropertyAccess(schemaArgument, 'spec', 'payload', model);
	const payloadAccess = directPropertyAccess(payloadArgument, 'command', 'payload', model);
	const schemaBase = exactReference(schemaAccess.base, 'SYMBOL_USE', model);
	if (terminalSymbolId(schemaBase, model) !== specSymbolId)
		throw new Error('validateAgainst does not consume the selected spec binding.');
	const calleeReference = exactReference(callee, 'SYMBOL_USE', model);
	const commandBaseReference = exactReference(payloadAccess.base, 'SYMBOL_USE', model);
	const localReference = exactReference(target, 'DECLARATION_NAME', model);
	return {
		binding: {
			calleeNodeId: callee.id,
			calleeReferenceId: calleeReference.id,
			commandPayloadArgumentNodeId: payloadArgument.id,
			invocationId: invocation.id,
			invocationNodeId: invocation.nodeId,
			parsedValueNodeId: target.id,
			schemaArgumentNodeId: schemaArgument.id
		},
		commandBaseSymbolId: terminalSymbolId(commandBaseReference, model),
		localSymbolId: terminalSymbolId(localReference, model),
		sourceLocation: sourceLocation(value)
	};
}

function guardFact(
	methodNodes: readonly SemanticAstNodeRecord[],
	model: SemanticIndexes,
	handlerSymbolId: SemanticSymbolId,
	minimumStart: number
): GuardFact {
	const matches = methodNodes.flatMap((statement) => {
		if (statement.kind !== ts.SyntaxKind.IfStatement || statement.start <= minimumStart) return [];
		const direct = model.childrenByParent.get(statement.id) ?? [];
		const conditions = direct.filter(
			(node) =>
				node.kind === ts.SyntaxKind.PrefixUnaryExpression &&
				node.operatorKind === ts.SyntaxKind.ExclamationToken
		);
		if (conditions.length !== 1) return [];
		const identifiers = (model.childrenByParent.get(conditions[0]!.id) ?? []).filter(
			(node) => node.kind === ts.SyntaxKind.Identifier && node.syntacticIdentifierText === 'handler'
		);
		return identifiers.length === 1
			? [{ condition: conditions[0]!, handler: identifiers[0]!, statement }]
			: [];
	});
	if (matches.length !== 1) throw new Error('Expected one direct missing-handler guard.');
	const match = matches[0]!;
	const handlerReference = exactReference(match.handler, 'SYMBOL_USE', model);
	if (terminalSymbolId(handlerReference, model) !== handlerSymbolId)
		throw new Error('The missing-handler guard does not consume the selected handler binding.');
	return {
		binding: {
			conditionNodeId: match.condition.id,
			guardedHandlerReferenceId: handlerReference.id,
			guardedHandlerValueNodeId: match.handler.id,
			guardStatementNodeId: match.statement.id
		},
		sourceLocation: sourceLocation(match.statement)
	};
}

function handlerInvocationFact(
	methodNodes: readonly SemanticAstNodeRecord[],
	model: SemanticIndexes,
	handlerSymbolId: SemanticSymbolId,
	parsedSymbolId: SemanticSymbolId,
	commandSymbolId: SemanticSymbolId,
	minimumStart: number
): InvocationFact {
	const methodIds = new Set(methodNodes.map((node) => node.id));
	const matches = [...model.invocationByNode.values()].filter((invocation) => {
		if (!methodIds.has(invocation.nodeId) || invocation.invocationKind !== 'CALL') return false;
		const node = model.nodeById.get(invocation.nodeId);
		const callee = model.nodeById.get(invocation.calleeNodeId);
		return (
			node !== undefined &&
			node.start > minimumStart &&
			callee?.kind === ts.SyntaxKind.Identifier &&
			callee.syntacticIdentifierText === 'handler'
		);
	});
	if (matches.length !== 1) throw new Error('Expected one normalized handler invocation.');
	const invocation = matches[0]!;
	if (invocation.argumentNodeIds.length !== 3)
		throw new Error('The handler invocation must have exactly three normalized arguments.');
	const invocationNode = model.nodeById.get(invocation.nodeId)!;
	const callee = model.nodeById.get(invocation.calleeNodeId)!;
	const contextArgument = model.nodeById.get(invocation.argumentNodeIds[0]!);
	const commandArgument = model.nodeById.get(invocation.argumentNodeIds[1]!);
	const parsedArgument = model.nodeById.get(invocation.argumentNodeIds[2]!);
	if (
		contextArgument?.kind !== ts.SyntaxKind.Identifier ||
		contextArgument.syntacticIdentifierText !== 'ctx' ||
		commandArgument?.kind !== ts.SyntaxKind.Identifier ||
		commandArgument.syntacticIdentifierText !== 'command' ||
		parsedArgument === undefined
	)
		throw new Error('The handler invocation arguments do not match ctx, command, parsed.value.');
	const parsedAccess = directPropertyAccess(parsedArgument, 'parsed', 'value', model);
	const calleeReference = exactReference(callee, 'SYMBOL_USE', model);
	const commandReference = exactReference(commandArgument, 'SYMBOL_USE', model);
	const parsedReference = exactReference(parsedAccess.base, 'SYMBOL_USE', model);
	if (
		terminalSymbolId(calleeReference, model) !== handlerSymbolId ||
		terminalSymbolId(commandReference, model) !== commandSymbolId ||
		terminalSymbolId(parsedReference, model) !== parsedSymbolId
	)
		throw new Error('The handler invocation does not consume the selected local bindings.');
	return {
		binding: {
			calleeNodeId: callee.id,
			calleeReferenceId: calleeReference.id,
			commandArgumentNodeId: commandArgument.id,
			contextArgumentNodeId: contextArgument.id,
			invocationId: invocation.id,
			invocationNodeId: invocation.nodeId,
			parsedPayloadArgumentNodeId: parsedArgument.id
		},
		sourceLocation: sourceLocation(invocationNode)
	};
}

function selectorEqual(
	left: CommandDispatchTopologyCommandBusSelector,
	right: CommandDispatchTopologyCommandBusSelector
): boolean {
	return SELECTOR_KEYS.every((key) => left[key] === right[key]);
}

function selectCommandBus(
	snapshot: StaticSemanticSnapshot,
	model: SemanticIndexes
): {
	readonly declaration: SemanticDeclarationRecord;
	readonly methodNode: SemanticAstNodeRecord;
	readonly selector: CommandDispatchTopologyCommandBusSelector;
	readonly source: SemanticSourceRecord;
} {
	const sources = snapshot.sources.filter(
		(source) =>
			source.logicalPath === COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_LOGICAL_PATH &&
			source.analysisDisposition === 'DEEP_INDEXED' &&
			model.projectConfigById.get(source.projectId) ===
				COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_PROJECT_CONFIG_PATH
	);
	const selected = sources.flatMap((source) =>
		snapshot.declarations.flatMap((declaration) => {
			if (
				declaration.sourceId !== source.id ||
				declaration.name !== COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_METHOD_NAME ||
				declaration.nodeId === null ||
				declaration.kind !== ts.SyntaxKind.MethodDeclaration
			)
				return [];
			const methodNode = model.nodeById.get(declaration.nodeId);
			return methodNode?.kind === ts.SyntaxKind.MethodDeclaration
				? [
						{
							declaration,
							methodNode,
							selector: {
								contentSha256: source.contentSha256,
								declarationId: declaration.id,
								logicalPath: COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_LOGICAL_PATH,
								methodName: COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_METHOD_NAME,
								programId: source.programId,
								projectConfigPath: COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_PROJECT_CONFIG_PATH,
								projectId: source.projectId,
								sourceId: source.id
							},
							source
						}
					]
				: [];
		})
	);
	if (selected.length !== 1)
		throw new Error(
			`Expected exactly one normalized dispatchStamped method; found ${selected.length}.`
		);
	return selected[0]!;
}

/** Independently select the exact normalized JPWB command-bus root. */
export function selectJpwbCommandDispatchTopology(
	snapshot: StaticSemanticSnapshot
): CommandDispatchTopologyCommandBusSelector {
	return { ...selectCommandBus(snapshot, indexes(snapshot)).selector };
}

function pipelineProvenance(
	declaration: SemanticDeclarationRecord,
	source: SemanticSourceRecord,
	bindings: readonly SemanticReferenceRecord[]
): SemanticProvenanceId[] {
	return sortedUnique([
		declaration.bindingProvenanceId,
		declaration.structuralProvenanceId,
		source.provenanceId,
		...(source.syntaxProvenanceId === null ? [] : [source.syntaxProvenanceId]),
		...bindings.flatMap((reference) => [
			reference.resolutionProvenanceId,
			reference.structuralProvenanceId
		])
	]);
}

function edgeProvenance(
	pipeline: CommandDispatchPipelineNode,
	target: HandlerTargetNode,
	upstreamEdges: readonly CommandHandlerGraphEdge[],
	registrations: readonly HandlerRegistrationNode[]
): SemanticProvenanceId[] {
	return sortedUnique([
		...pipeline.provenanceIds,
		...target.provenanceIds,
		...upstreamEdges.flatMap((edge) => edge.provenanceIds),
		...registrations.flatMap((registration) => registration.provenanceIds)
	]);
}

function layerProvenance(
	nodes: readonly CommandDispatchPipelineNode[],
	edges: readonly CommandDispatchTopologyEdge[]
): SemanticProvenanceId[] {
	return sortedUnique([
		...nodes.flatMap((node) => node.provenanceIds),
		...edges.flatMap((edge) => edge.provenanceIds)
	]);
}

/**
 * Build a static, implementation-local dispatch overlay from normalized semantic records only.
 * No subject source is decoded, reparsed, imported, or executed by this operation.
 */
export function buildCommandDispatchTopology(
	requestValue: unknown,
	snapshot: StaticSemanticSnapshot,
	commandHandlerGraph: CommandHandlerGraphSnapshot,
	arrowObservation: ArrowCommandCensusObservation,
	subject: FrozenSubject,
	options?: BuildCommandDispatchTopologyOptions
): CommandDispatchTopologyBuildOutcome {
	const progress = createProgressRecorder(options);
	progress.start('REQUEST_BIND');
	let request: BuildCommandDispatchTopologyRequest;
	try {
		request = materializeRequest(requestValue);
	} catch (error) {
		progress.fail({ diagnostics: 1 });
		return unavailable(
			'REQUEST_INVALID',
			error instanceof Error ? error.message : 'Invalid command-dispatch topology request.',
			'REQUEST'
		);
	}
	try {
		if (request.semanticSnapshotId !== snapshot.id) {
			progress.fail({ diagnostics: 1 });
			return unavailable(
				'SEMANTIC_SNAPSHOT_ID_MISMATCH',
				'The requested semantic snapshot identity does not match.',
				'REQUEST',
				'$.semanticSnapshotId'
			);
		}
		if (
			request.commandHandlerGraphId !== commandHandlerGraph.id ||
			commandHandlerGraph.semanticSnapshotId !== snapshot.id
		) {
			progress.fail({ diagnostics: 1 });
			return unavailable(
				'COMMAND_HANDLER_GRAPH_ID_MISMATCH',
				'The requested predecessor graph identity or semantic binding does not match.',
				'REQUEST',
				'$.commandHandlerGraphId'
			);
		}
		if (commandHandlerGraph.arrowObservationId !== arrowObservation.id) {
			progress.fail({ diagnostics: 1 });
			return unavailable(
				'ARROW_OBSERVATION_MISMATCH',
				'The predecessor graph is not bound to the supplied arrow observation.',
				'BIND'
			);
		}
		if (
			request.subjectId !== snapshot.subjectId ||
			request.subjectId !== commandHandlerGraph.subjectId ||
			request.subjectId !== arrowObservation.subjectId ||
			request.subjectId !== subject.descriptor.subjectId
		) {
			progress.fail({ diagnostics: 1 });
			return unavailable(
				'SUBJECT_ID_MISMATCH',
				'The request, semantic snapshot, predecessor graph, observation, and subject identities differ.',
				'BIND',
				'$.subjectId'
			);
		}
		let retainedCommandDispatchCensus: ReturnType<
			typeof commandDispatchTopologyRetainedCensusReference
		>;
		try {
			retainedCommandDispatchCensus = commandDispatchTopologyRetainedCensusReference(subject);
			const retainedBytes = readFrozenSubjectArtifact(
				subject,
				retainedCommandDispatchCensus.artifactPath
			);
			if (
				retainedBytes === undefined ||
				retainedBytes.byteLength !== retainedCommandDispatchCensus.artifactBytes ||
				sha256(retainedBytes) !== retainedCommandDispatchCensus.artifactContentSha256
			)
				throw new Error('The retained census bytes do not reproduce their frozen identity.');
		} catch (error) {
			progress.fail({ diagnostics: 1 });
			return unavailable(
				'RETAINED_CENSUS_ARTIFACT_MISMATCH',
				error instanceof Error
					? error.message
					: 'The retained command-dispatch census identity is unavailable.',
				'BIND'
			);
		}
		if (
			!(['TS_PROJECT', 'TS_SYNTAX', 'TS_SYMBOL'] as const).every((required) =>
				snapshot.capabilities.some(
					(capability) => capability.capability === required && capability.state !== 'UNSUPPORTED'
				)
			)
		) {
			progress.fail({ diagnostics: 1 });
			return unavailable(
				'SEMANTIC_CAPABILITY_UNAVAILABLE',
				'TS_PROJECT, TS_SYNTAX, and TS_SYMBOL are required for dispatch topology.',
				'BIND'
			);
		}
		progress.complete({ identities: 5, semanticCapabilities: 3 });

		progress.start('UPSTREAM_GRAPH_VALIDATE', {
			edges: commandHandlerGraph.edges.length,
			nodes: commandHandlerGraph.nodes.length
		});
		const upstreamValidation = validateCommandHandlerGraph(
			commandHandlerGraph,
			snapshot,
			arrowObservation,
			subject,
			{ maxIssues: 1_000, maxRecords: 10_000_000, maxStringCharacters: 1_000_000_000 }
		);
		if (upstreamValidation.state !== 'VALID') {
			progress.fail({ diagnostics: upstreamValidation.issues.length });
			return unavailable(
				'COMMAND_HANDLER_GRAPH_INVALID',
				`The predecessor command-handler graph is invalid (${upstreamValidation.state}).`,
				'BIND'
			);
		}
		progress.complete({ validationIssues: 0 });

		const model = indexes(snapshot);
		if (snapshot.astNodes.length > request.budgets.maxAstNodes)
			throw new RangeError(
				`maxAstNodes exceeded: ${snapshot.astNodes.length} > ${request.budgets.maxAstNodes}.`
			);
		progress.start('DISPATCH_SOURCE_SELECT', { semanticSources: snapshot.sources.length });
		let selected: ReturnType<typeof selectCommandBus>;
		try {
			selected = selectCommandBus(snapshot, model);
		} catch (error) {
			progress.fail({ diagnostics: 1 });
			return unavailable(
				'COMMAND_BUS_SELECTOR_MISMATCH',
				error instanceof Error ? error.message : 'The command-bus selector is ambiguous.',
				'BIND',
				'$.commandBus'
			);
		}
		if (!selectorEqual(request.commandBus, selected.selector)) {
			progress.fail({ diagnostics: 1 });
			return unavailable(
				'COMMAND_BUS_SELECTOR_MISMATCH',
				'The caller-selected command bus does not match the independently selected semantic root.',
				'BIND',
				'$.commandBus'
			);
		}
		const sourceArtifacts = subject.artifacts.filter(
			(artifact) => artifact.path === selected.source.logicalPath
		);
		if (
			sourceArtifacts.length !== 1 ||
			sourceArtifacts[0]!.sha256 !== selected.source.contentSha256 ||
			sourceArtifacts[0]!.bytes !== selected.source.bytes
		) {
			progress.fail({ diagnostics: 1 });
			return unavailable(
				'COMMAND_BUS_SELECTOR_MISMATCH',
				'The selected semantic source is not exactly bound to the frozen subject.',
				'BIND',
				'$.commandBus'
			);
		}
		if (selected.source.bytes > request.budgets.maxSourceBytes)
			throw new RangeError(
				`maxSourceBytes exceeded: ${selected.source.bytes} > ${request.budgets.maxSourceBytes}.`
			);
		progress.complete({ selectedSources: 1, sourceBytes: selected.source.bytes });

		progress.start('DISPATCH_SITE_DISCOVERY');
		const methodNodes = descendants(selected.methodNode, model);
		const commandsLookup = lookupFact('COMMANDS', 'spec', methodNodes, model);
		const handlersLookup = lookupFact('HANDLERS', 'handler', methodNodes, model);
		const validation = validationFact(methodNodes, model, commandsLookup.localSymbolId);
		const guard = guardFact(
			methodNodes,
			model,
			handlersLookup.localSymbolId,
			model.nodeById.get(handlersLookup.assignment.nodeId)!.start
		);
		const invocation = handlerInvocationFact(
			methodNodes,
			model,
			handlersLookup.localSymbolId,
			validation.localSymbolId,
			commandsLookup.commandBaseSymbolId,
			guard.sourceLocation.start
		);
		progress.complete({ dispatchFacts: 5, methodAstNodes: methodNodes.length });

		progress.start('KEY_BINDING_RESOLVE');
		const methodNodeIds = new Set(methodNodes.map((node) => node.id));
		const commandParameters = snapshot.declarations.filter(
			(declaration) =>
				declaration.sourceId === selected.source.id &&
				declaration.name === 'command' &&
				declaration.kind === ts.SyntaxKind.Parameter &&
				declaration.nodeId !== null &&
				methodNodeIds.has(declaration.nodeId)
		);
		if (commandParameters.length !== 1 || commandParameters[0]!.symbolId === null)
			throw new Error('The selected dispatch method must have one semantic command parameter.');
		const handlerRegistryDeclaration = model.declarationById.get(
			commandHandlerGraph.handlerRegistry.declarationId
		);
		const handlerRegistrySource = model.sourceById.get(
			commandHandlerGraph.handlerRegistry.sourceId
		);
		if (
			handlerRegistryDeclaration?.symbolId === null ||
			handlerRegistryDeclaration?.symbolId === undefined ||
			handlersLookup.registrySymbolId !== handlerRegistryDeclaration.symbolId ||
			handlerRegistrySource === undefined ||
			handlerRegistrySource.programId !== selected.source.programId ||
			handlerRegistrySource.projectId !== selected.source.projectId ||
			commandHandlerGraph.handlerRegistry.programId !== selected.source.programId ||
			commandHandlerGraph.handlerRegistry.projectId !== selected.source.projectId ||
			commandHandlerGraph.handlerRegistry.projectConfigPath !==
				COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_PROJECT_CONFIG_PATH
		)
			throw new Error('The HANDLERS lookup does not resolve to the predecessor registry.');
		if (
			commandsLookup.commandTypeSymbolId !== handlersLookup.commandTypeSymbolId ||
			commandsLookup.commandBaseSymbolId !== handlersLookup.commandBaseSymbolId ||
			commandsLookup.commandBaseSymbolId !== validation.commandBaseSymbolId ||
			commandsLookup.commandBaseSymbolId !== commandParameters[0]!.symbolId
		)
			throw new Error(
				'The dispatch lookups are not keyed by one exact command.commandType binding.'
			);
		const handlerCommandArgument = model.nodeById.get(invocation.binding.commandArgumentNodeId)!;
		if (
			terminalSymbolId(exactReference(handlerCommandArgument, 'SYMBOL_USE', model), model) !==
			commandsLookup.commandBaseSymbolId
		)
			throw new Error('The handler invocation consumes a different command binding.');
		progress.complete({ commandBindings: 1, commandTypeBindings: 1 });

		progress.start('LOOKUP_FLOW_RESOLVE');
		const orderedStarts = [
			commandsLookup.sourceLocation.start,
			validation.sourceLocation.start,
			handlersLookup.sourceLocation.start,
			guard.sourceLocation.start,
			invocation.sourceLocation.start
		];
		if (orderedStarts.some((value, index) => index > 0 && value <= orderedStarts[index - 1]!))
			throw new Error('The normalized dispatch pipeline is not in the required lexical order.');
		progress.complete({ orderedStages: 5 });

		progress.start('TARGET_COMPOSE');
		const targets = commandHandlerGraph.nodes
			.filter((node): node is HandlerTargetNode => node.kind === 'HANDLER_TARGET')
			.sort((left, right) => compareText(left.id, right.id));
		if (targets.length === 0)
			throw new Error('The predecessor graph has no handler-target population to compose.');
		if (targets.length > request.budgets.maxHandlerTargets)
			throw new RangeError(
				`maxHandlerTargets exceeded: ${targets.length} > ${request.budgets.maxHandlerTargets}.`
			);
		if (targets.length > request.budgets.maxEdges)
			throw new RangeError(`maxEdges exceeded: ${targets.length} > ${request.budgets.maxEdges}.`);
		if (request.budgets.maxNodes < 1)
			throw new RangeError('maxNodes cannot admit the pipeline node.');
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
		const allBindingReferences = [
			commandsLookup.binding.commandTypeReferenceId,
			commandsLookup.binding.registryReferenceId,
			handlersLookup.binding.commandTypeReferenceId,
			handlersLookup.binding.registryReferenceId,
			validation.binding.calleeReferenceId,
			guard.binding.guardedHandlerReferenceId,
			invocation.binding.calleeReferenceId
		].map((id) => {
			const reference = snapshot.references.find((candidate) => candidate.id === id);
			if (reference === undefined) throw new Error('A projected reference identity is absent.');
			return reference;
		});
		const pipelineNode: CommandDispatchPipelineNode = {
			attribution: 'EXACT_STATIC_SYNTAX',
			commandBusDeclarationId: selected.declaration.id,
			commandHandlerGraphId: commandHandlerGraph.id,
			commandsLookup: commandsLookup.binding as CommandDispatchPipelineNode['commandsLookup'],
			graphId,
			handlerInvocation: invocation.binding,
			handlersLookup: handlersLookup.binding as CommandDispatchPipelineNode['handlersLookup'],
			id: commandDispatchPipelineNodeId(graphId, selected.declaration.id),
			kind: 'STATIC_DISPATCH_PIPELINE',
			layerId: derivationLayerId,
			methodName: COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_METHOD_NAME,
			missingHandlerGuard: guard.binding,
			payloadValidationInvocation: validation.binding,
			programId: selected.source.programId,
			projectId: selected.source.projectId,
			provenanceIds: pipelineProvenance(
				selected.declaration,
				selected.source,
				allBindingReferences
			),
			semanticSnapshotId: snapshot.id,
			sourceId: selected.source.id,
			sourceLocations: uniqueSourceLocations([
				commandsLookup.sourceLocation,
				validation.sourceLocation,
				handlersLookup.sourceLocation,
				guard.sourceLocation,
				invocation.sourceLocation
			]),
			subjectId: snapshot.subjectId
		};
		if (pipelineNode.sourceLocations.length !== 5)
			throw new Error('The static dispatch pipeline must have five distinct fact locations.');
		const registrations = new Map(
			commandHandlerGraph.nodes
				.filter((node): node is HandlerRegistrationNode => node.kind === 'HANDLER_REGISTRATION')
				.map((node) => [node.id, node])
		);
		const upstreamByTarget = new Map<HandlerTargetNode['id'], CommandHandlerGraphEdge[]>();
		for (const edge of commandHandlerGraph.edges)
			if (edge.relationKind === 'HANDLER_REGISTRATION_TO_TARGET')
				addGrouped(upstreamByTarget, edge.target.nodeId, edge);
		const inferenceBasis = (
			target: HandlerTargetNode,
			upstreamEdges: readonly CommandHandlerGraphEdge[],
			registrationNodes: readonly HandlerRegistrationNode[]
		): CommandDispatchTopologyInferenceBasis => ({
			assumptions: [
				'The runtime command.commandType value may select any statically registered HANDLERS entry represented by the predecessor graph.'
			],
			limitationKinds: [
				'HANDLER_TARGET_EDGES_ARE_CANDIDATE_ONLY',
				'CONTROL_FLOW_AND_PATH_FEASIBILITY_NOT_ANALYZED',
				'RUNTIME_DISPATCH_NOT_CLAIMED'
			],
			method: COMMAND_DISPATCH_TOPOLOGY_METHOD,
			rationale:
				'The selected dispatch pipeline indexes HANDLERS by command.commandType and invokes the resulting handler; without runtime values or control-flow evidence, every registered handler target is a candidate.',
			supportingInputIds: sortedUnique([
				pipelineNode.id,
				target.id,
				...upstreamEdges.map((edge) => edge.id),
				...registrationNodes.map((registration) => registration.id)
			])
		});
		const edges = targets.map((target): CommandDispatchTopologyEdge => {
			const upstreamEdges = (upstreamByTarget.get(target.id) ?? []).sort((left, right) =>
				compareText(left.id, right.id)
			);
			if (upstreamEdges.length === 0)
				throw new Error(`Handler target ${target.id} has no upstream registration edge.`);
			const supportingRegistrations = upstreamEdges.map((edge) => {
				const registration = registrations.get(edge.source.nodeId);
				if (registration === undefined)
					throw new Error('An upstream target edge has no handler registration source.');
				return registration;
			});
			const registeredCommandNames = sortedUnique(
				supportingRegistrations.map((registration) => registration.commandName)
			);
			const basis = inferenceBasis(target, upstreamEdges, supportingRegistrations);
			const source = {
				graphId,
				kind: 'STATIC_DISPATCH_PIPELINE' as const,
				nodeId: pipelineNode.id
			};
			const targetEndpoint = {
				graphId: commandHandlerGraph.id,
				kind: 'HANDLER_TARGET' as const,
				nodeId: target.id
			};
			const edgeInput = {
				graphId,
				inferenceBasis: basis,
				registeredCommandNames,
				relationCode: 'IMPL-JPWB-CD-DISPATCH-TARGET-001' as const,
				relationKind: 'STATIC_DISPATCH_PIPELINE_TO_HANDLER_TARGET' as const,
				source,
				target: targetEndpoint
			};
			return {
				attribution: 'CANDIDATE',
				commandHandlerGraphId: commandHandlerGraph.id,
				...edgeInput,
				id: commandDispatchTopologyEdgeId(edgeInput),
				layerId: inferenceLayerId,
				method: COMMAND_DISPATCH_TOPOLOGY_METHOD,
				provenanceIds: edgeProvenance(pipelineNode, target, upstreamEdges, supportingRegistrations),
				semanticSnapshotId: snapshot.id,
				sourceLocations: uniqueSourceLocations([
					...pipelineNode.sourceLocations,
					...target.sourceLocations,
					...upstreamEdges.flatMap((edge) => edge.sourceLocations),
					...supportingRegistrations.flatMap((registration) => registration.sourceLocations)
				]),
				subjectId: snapshot.subjectId
			};
		});
		edges.sort((left, right) => compareText(left.id, right.id));
		progress.complete({ candidateEdges: edges.length, handlerTargets: targets.length });

		progress.start('GRAPH_MATERIALIZE');
		const registrationsWithSupport = new Set(
			commandHandlerGraph.edges
				.filter((edge) => edge.relationKind === 'HANDLER_REGISTRATION_TO_TARGET')
				.map((edge) => edge.source.nodeId)
		);
		const unresolvedHandlerTargets = [...registrations.keys()].filter(
			(registrationId) => !registrationsWithSupport.has(registrationId)
		).length;
		const coverage: CommandDispatchTopologyCoverage = {
			candidateHandlerTargetEdges: edges.length,
			commandHandlerGraphHandlerTargets: targets.length,
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
				registrationsWithSupport.size + unresolvedHandlerTargets === registrations.size &&
				edges.length === targets.length &&
				edges.every((edge) => edge.registeredCommandNames.length > 0),
			referencedHandlerTargets: edges.length,
			representedPipelineFacts: 5,
			unresolvedHandlerTargets
		};
		const forwardIndex: readonly CommandDispatchTopologyIndexEntry[] = [
			{
				edgeIds: edges.map((edge) => edge.id),
				endpointOwner: 'COMMAND_DISPATCH_TOPOLOGY',
				graphId,
				nodeId: pipelineNode.id
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
			limitations: COMMAND_DISPATCH_TOPOLOGY_LIMITATIONS.map((limitation) => ({ ...limitation })),
			method: COMMAND_DISPATCH_TOPOLOGY_METHOD,
			nodeIds: [pipelineNode.id],
			ordinal: 0,
			producer: { ...snapshot.provider },
			provenanceIds: layerProvenance([pipelineNode], []),
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
			limitations: COMMAND_DISPATCH_TOPOLOGY_LIMITATIONS.map((limitation) => ({ ...limitation })),
			method: COMMAND_DISPATCH_TOPOLOGY_METHOD,
			nodeIds: [],
			ordinal: 1,
			producer: { ...snapshot.provider },
			provenanceIds: layerProvenance([], edges),
			registryStatus: COMMAND_DISPATCH_TOPOLOGY_REGISTRY_STATUS,
			semanticSnapshotId: snapshot.id,
			subjectId: snapshot.subjectId
		};
		progress.complete({ edges: edges.length, nodes: 1 });

		progress.start('SERIALIZE');
		const content = {
			arrowObservationContentDigest: arrowObservation.contentDigest,
			arrowObservationId: arrowObservation.id,
			authorityTransfer: COMMAND_DISPATCH_TOPOLOGY_AUTHORITY_TRANSFER,
			baselineChange: COMMAND_DISPATCH_TOPOLOGY_BASELINE_CHANGE,
			budgets: { ...request.budgets },
			canonicalProfile: COMMAND_DISPATCH_TOPOLOGY_CANONICAL_PROFILE,
			capabilities: [
				COMMAND_DISPATCH_TOPOLOGY_DERIVATION_CAPABILITY,
				COMMAND_DISPATCH_TOPOLOGY_INFERENCE_CAPABILITY
			] as const,
			capabilityStatus: COMMAND_DISPATCH_TOPOLOGY_CAPABILITY_STATUS,
			commandBus: { ...request.commandBus },
			commandHandlerGraphContentDigest: commandHandlerGraph.contentDigest,
			commandHandlerGraphId: commandHandlerGraph.id,
			commandHandlerGraphSchemaVersion: commandHandlerGraph.schemaVersion,
			commandHandlerPopulationTreatment:
				COMMAND_DISPATCH_TOPOLOGY_COMMAND_HANDLER_POPULATION_TREATMENT,
			coverage,
			edges,
			forwardIndex,
			fullJanCsaa007Conformance: COMMAND_DISPATCH_TOPOLOGY_FULL_JAN_CSAA_007_CONFORMANCE,
			fullJanCsaa008Conformance: COMMAND_DISPATCH_TOPOLOGY_FULL_JAN_CSAA_008_CONFORMANCE,
			gateEffect: COMMAND_DISPATCH_TOPOLOGY_GATE_EFFECT,
			graphAuthority: COMMAND_DISPATCH_TOPOLOGY_GRAPH_AUTHORITY,
			graphInputDigest,
			graphKind: 'JPWB_COMMAND_DISPATCH_STATIC_TOPOLOGY_OVERLAY' as const,
			health: 'PARTIAL' as const,
			id: graphId,
			integrationStrategy: COMMAND_DISPATCH_TOPOLOGY_INTEGRATION_STRATEGY,
			layers: [derivationLayer, inferenceLayer] as const,
			limitations: COMMAND_DISPATCH_TOPOLOGY_LIMITATIONS.map((limitation) => ({ ...limitation })),
			method: COMMAND_DISPATCH_TOPOLOGY_METHOD,
			nodes: [pipelineNode] as const,
			operationVersion: COMMAND_DISPATCH_TOPOLOGY_OPERATION_VERSION,
			oracleChange: COMMAND_DISPATCH_TOPOLOGY_ORACLE_CHANGE,
			producer: { ...snapshot.provider },
			registryStatus: COMMAND_DISPATCH_TOPOLOGY_REGISTRY_STATUS,
			replacementEquivalence: COMMAND_DISPATCH_TOPOLOGY_REPLACEMENT_EQUIVALENCE,
			retainedCommandDispatchCensus,
			retainedCommandDispatchCensusIntegration:
				COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_INTEGRATION,
			reverseIndex,
			runtimeDispatchClosure: COMMAND_DISPATCH_TOPOLOGY_RUNTIME_DISPATCH_CLOSURE,
			runtimePerformability: COMMAND_DISPATCH_TOPOLOGY_RUNTIME_PERFORMABILITY,
			schemaVersion: COMMAND_DISPATCH_TOPOLOGY_SCHEMA_VERSION,
			scope: COMMAND_DISPATCH_TOPOLOGY_SCOPE,
			semanticExtractionVersion: snapshot.extractionVersion,
			semanticSchemaVersion: snapshot.schemaVersion,
			semanticSnapshotId: snapshot.id,
			subjectId: snapshot.subjectId
		};
		const graph = { ...content, contentDigest: commandDispatchTopologyContentDigest(content) };
		const canonicalBytes = canonicalSemanticJsonWitness(graph).bytes;
		progress.complete({ canonicalBytes });

		progress.start('GRAPH_VALIDATE', { edges: graph.edges.length, nodes: graph.nodes.length });
		const graphValidation = validateCommandDispatchTopology(
			graph,
			request,
			snapshot,
			commandHandlerGraph,
			arrowObservation,
			subject,
			{
				maxIssues: Math.min(request.budgets.maxDiagnostics, 1_000),
				maxRecords: 10_000_000,
				maxStringCharacters: 1_000_000_000
			}
		);
		if (graphValidation.state !== 'VALID') {
			progress.fail({ diagnostics: graphValidation.issues.length });
			const summary = graphValidation.issues
				.slice(0, 3)
				.map((issue) => `${issue.code}@${issue.path}: ${issue.message}`)
				.join(', ');
			return unavailable(
				'GRAPH_VALIDATION_FAILED',
				`Constructed command-dispatch topology failed validation (${graphValidation.state}${summary.length === 0 ? '' : `: ${summary}`}).`,
				'VALIDATE'
			);
		}
		progress.complete({ validationIssues: 0 });
		return {
			diagnostics: [
				diagnostic(
					'GRAPH_PARTIAL',
					'The implementation-local overlay represents the exact static dispatch pipeline and candidate predecessor handler targets; runtime dispatch and performability remain unclaimed.',
					'VALIDATE'
				)
			],
			graph,
			outcome: 'partial'
		};
	} catch (error) {
		const isBudget = error instanceof RangeError && /max[A-Z]/u.test(error.message);
		progress.fail({ diagnostics: 1 });
		return unavailable(
			isBudget ? 'BUDGET_EXCEEDED' : 'UNSUPPORTED_DISPATCH_PIPELINE',
			error instanceof Error
				? error.message
				: 'Command-dispatch topology construction failed closed.',
			'CLASSIFY'
		);
	}
}
