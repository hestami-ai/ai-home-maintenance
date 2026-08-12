import { isProxy } from 'node:util/types';
import ts from 'typescript';

import type { ArrowCommandCensusObservation } from '../contracts/arrow-command-census.js';
import {
	COMMAND_HANDLER_GRAPH_AUTHORITY_TRANSFER,
	COMMAND_HANDLER_GRAPH_BASELINE_CHANGE,
	COMMAND_HANDLER_GRAPH_CANONICAL_PROFILE,
	COMMAND_HANDLER_GRAPH_CAPABILITY_STATUS,
	COMMAND_HANDLER_GRAPH_COMMAND_DISPATCH_CENSUS_INTEGRATION,
	COMMAND_HANDLER_GRAPH_DERIVATION_CAPABILITY,
	COMMAND_HANDLER_GRAPH_FULL_JAN_CSAA_007_CONFORMANCE,
	COMMAND_HANDLER_GRAPH_FULL_JAN_CSAA_008_CONFORMANCE,
	COMMAND_HANDLER_GRAPH_GATE_EFFECT,
	COMMAND_HANDLER_GRAPH_GRAPH_AUTHORITY,
	COMMAND_HANDLER_GRAPH_INFERENCE_CAPABILITY,
	COMMAND_HANDLER_GRAPH_INTEGRATION_STRATEGY,
	COMMAND_HANDLER_GRAPH_LIMITATIONS,
	COMMAND_HANDLER_GRAPH_METHOD,
	COMMAND_HANDLER_GRAPH_OPERATION_VERSION,
	COMMAND_HANDLER_GRAPH_ORACLE_CHANGE,
	COMMAND_HANDLER_GRAPH_REGISTRY_STATUS,
	COMMAND_HANDLER_GRAPH_REPLACEMENT_EQUIVALENCE,
	COMMAND_HANDLER_GRAPH_REQUEST_SCHEMA_VERSION,
	COMMAND_HANDLER_GRAPH_RETAINED_ARROW_VERIFIER_AUTHORITY,
	COMMAND_HANDLER_GRAPH_RUNTIME_DISPATCH_CLOSURE,
	COMMAND_HANDLER_GRAPH_RUNTIME_PERFORMABILITY,
	COMMAND_HANDLER_GRAPH_SCHEMA_VERSION,
	COMMAND_HANDLER_GRAPH_SCOPE,
	type BuildCommandHandlerGraphRequest,
	type CommandArrowOccurrenceNode,
	type CommandArrowSiteNode,
	type CommandHandlerFrontierNode,
	type CommandHandlerGraphBuildDiagnostic,
	type CommandHandlerGraphBuildOutcome,
	type CommandHandlerGraphCoverage,
	type CommandHandlerGraphEdge,
	type CommandHandlerGraphIndexEntry,
	type CommandHandlerGraphLayer,
	type CommandHandlerGraphLayerId,
	type CommandHandlerGraphNode,
	type CommandHandlerGraphNodeId,
	type CommandHandlerGraphSourceLocation,
	type CommandHandlerInferenceBasis,
	type CommandHandlerRegistrySelector,
	type CommandRegistryEntryNode,
	type HandlerRegistrationNode,
	type HandlerTargetNode
} from '../contracts/command-handler-graph.js';
import type {
	SemanticAstNodeRecord,
	SemanticDeclarationRecord,
	SemanticInvocationSiteRecord,
	SemanticProvenanceId,
	SemanticReferenceRecord,
	SemanticSourceRecord,
	SemanticSymbolId,
	SemanticSymbolRecord,
	StaticSemanticSnapshot
} from '../contracts/semantic.js';
import type { FrozenSubject } from '../contracts/subject.js';
import { compareText, sha256 } from '../inventory/canonical.js';
import { validateArrowCommandCensusObservation } from '../providers/jpwb-arrow-command-census/validate-arrow-command-census.js';
import { readFrozenSubjectArtifact } from '../subject/frozen-store.js';
import {
	commandArrowOccurrenceNodeId,
	commandArrowSiteNodeId,
	commandHandlerDerivationLayerId,
	commandHandlerFrontierNodeId,
	commandHandlerGraphContentDigest,
	commandHandlerGraphEdgeId,
	commandHandlerGraphId,
	commandHandlerGraphInputDigest,
	commandHandlerInferenceLayerId,
	commandRegistryEntryNodeId,
	handlerRegistrationNodeId,
	handlerTargetNodeId
} from './command-handler-graph-canonical.js';
import { validateConstructedCommandHandlerGraph } from './validate-command-handler-graph.js';

const COMMAND_CATALOG_PATH = 'packages/rph-contracts/src/messages.ts';
const COMMAND_CATALOG_PROJECT = 'packages/rph-contracts/tsconfig.json';
const HANDLER_REGISTRY_PATH = 'packages/rph-application/src/handlers/registry.ts';
const HANDLER_REGISTRY_PROJECT = 'packages/rph-application/tsconfig.json';
const DOMAIN_PROJECT = 'packages/rph-domain/tsconfig.json';
const STEP_COMMAND_SPEC_PATH = 'packages/rph-domain/src/step-command-spec.ts';
const PWU_COMMAND_SPEC_PATH = 'packages/rph-domain/src/pwu-lifecycle-command-spec.ts';

const REQUEST_KEYS = [
	'arrowObservationId',
	'budgets',
	'commandRegistry',
	'handlerRegistry',
	'operationVersion',
	'schemaVersion',
	'semanticSnapshotId',
	'subjectId'
] as const;
const BUDGET_KEYS = [
	'maxAstNodes',
	'maxCommandRegistryEntries',
	'maxEdges',
	'maxFrontiers',
	'maxHandlerRegistryEntries',
	'maxNodes',
	'maxSourceBytes'
] as const;
const SELECTOR_KEYS = [
	'contentSha256',
	'declarationId',
	'exportName',
	'logicalPath',
	'programId',
	'projectConfigPath',
	'projectId',
	'sourceId'
] as const;
const CALLABLE_KINDS = new Set<number>([
	ts.SyntaxKind.FunctionDeclaration,
	ts.SyntaxKind.MethodDeclaration,
	ts.SyntaxKind.Constructor,
	ts.SyntaxKind.GetAccessor,
	ts.SyntaxKind.SetAccessor,
	ts.SyntaxKind.FunctionExpression,
	ts.SyntaxKind.ArrowFunction,
	ts.SyntaxKind.ClassStaticBlockDeclaration
]);
const TRANSPARENT_EXPRESSION_KINDS = new Set<number>([
	ts.SyntaxKind.AsExpression,
	ts.SyntaxKind.SatisfiesExpression,
	ts.SyntaxKind.TypeAssertionExpression,
	ts.SyntaxKind.ParenthesizedExpression,
	ts.SyntaxKind.NonNullExpression
]);

export const COMMAND_HANDLER_GRAPH_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-command-handler-graph-progress/1.0.0' as const;

export type CommandHandlerGraphProgressPhase =
	| 'REQUEST_BIND'
	| 'OBSERVATION_VALIDATE'
	| 'ARTIFACT_READ'
	| 'CONTRACT_PARSE'
	| 'REGISTRY_PARSE'
	| 'BINDING_RESOLVE'
	| 'SITE_ATTRIBUTION'
	| 'GRAPH_MATERIALIZE'
	| 'SERIALIZE'
	| 'GRAPH_VALIDATE';

export interface CommandHandlerGraphProgressEvent {
	readonly details: Readonly<Record<string, unknown>>;
	readonly durationMs: number;
	readonly phase: CommandHandlerGraphProgressPhase;
	readonly schemaVersion: typeof COMMAND_HANDLER_GRAPH_PROGRESS_SCHEMA_VERSION;
	readonly state: 'STARTED' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
	readonly timestamp: string;
}

export interface BuildCommandHandlerGraphOptions {
	/** Out-of-band telemetry only; the sink cannot affect graph evidence or outcome. */
	readonly onProgress?: (event: CommandHandlerGraphProgressEvent) => void;
}

interface RegistryMember {
	readonly commandName: string;
	readonly declaration: SemanticDeclarationRecord | null;
	readonly nameNode: SemanticAstNodeRecord;
	readonly propertyNode: SemanticAstNodeRecord;
	readonly valueNode: SemanticAstNodeRecord;
}

interface HandlerBinding {
	readonly factoryCallableNodeId: SemanticAstNodeRecord['id'] | null;
	readonly handlerName: string;
	readonly handlerSymbol: SemanticSymbolRecord | null;
	readonly implementationNode: SemanticAstNodeRecord | null;
	readonly implementationState: 'DIRECT' | 'FACTORY_RESULT' | 'UNRESOLVED';
	readonly member: RegistryMember;
	readonly reference: SemanticReferenceRecord | null;
}

interface GraphIndexes {
	readonly assignmentsByNode: ReadonlyMap<
		SemanticAstNodeRecord['id'],
		StaticSemanticSnapshot['assignments'][number][]
	>;
	readonly childrenByParent: ReadonlyMap<SemanticAstNodeRecord['id'], SemanticAstNodeRecord[]>;
	readonly declarationById: ReadonlyMap<string, SemanticDeclarationRecord>;
	readonly declarationsByNode: ReadonlyMap<
		SemanticAstNodeRecord['id'],
		SemanticDeclarationRecord[]
	>;
	readonly invocationByNode: ReadonlyMap<SemanticAstNodeRecord['id'], SemanticInvocationSiteRecord>;
	readonly nodeById: ReadonlyMap<SemanticAstNodeRecord['id'], SemanticAstNodeRecord>;
	readonly projectConfigById: ReadonlyMap<string, string>;
	readonly provenances: ReadonlySet<SemanticProvenanceId>;
	readonly referencesByNode: ReadonlyMap<SemanticAstNodeRecord['id'], SemanticReferenceRecord[]>;
	readonly sourceById: ReadonlyMap<string, SemanticSourceRecord>;
	readonly symbolById: ReadonlyMap<SemanticSymbolId, SemanticSymbolRecord>;
}

interface ResolvedHandlerTarget {
	readonly binding: HandlerBinding;
	readonly node: HandlerTargetNode;
}

interface SiteProjection {
	readonly attribution: CommandArrowSiteNode['attribution'];
	readonly candidateTargetIds: readonly CommandHandlerGraphNodeId[];
	readonly commandName: string | null;
	readonly exactTargetIds: readonly CommandHandlerGraphNodeId[];
	readonly observation: ArrowCommandCensusObservation['declaredSites'][number];
	readonly provenanceIds: readonly SemanticProvenanceId[];
	readonly semanticSiteNodeId: SemanticAstNodeRecord['id'] | null;
	readonly sourceId: SemanticSourceRecord['id'] | null;
	readonly sourceLocations: readonly CommandHandlerGraphSourceLocation[];
}

interface ProgressRecorder {
	complete(details?: Readonly<Record<string, unknown>>): void;
	fail(code: string): void;
	start(phase: CommandHandlerGraphProgressPhase, details?: Readonly<Record<string, unknown>>): void;
}

function diagnostic(
	code: CommandHandlerGraphBuildDiagnostic['code'],
	message: string,
	phase: CommandHandlerGraphBuildDiagnostic['phase'],
	path: string | null = null
): CommandHandlerGraphBuildDiagnostic {
	return { code, message, path, phase };
}

function unavailable(
	code: CommandHandlerGraphBuildDiagnostic['code'],
	message: string,
	phase: CommandHandlerGraphBuildDiagnostic['phase'],
	path: string | null = null
): CommandHandlerGraphBuildOutcome {
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

function materializeRequest(value: unknown): BuildCommandHandlerGraphRequest {
	const record = exactPlainRecord(value, REQUEST_KEYS, '$request');
	const budgets = exactPlainRecord(record.budgets, BUDGET_KEYS, '$request.budgets');
	const commandRegistry = exactPlainRecord(
		record.commandRegistry,
		SELECTOR_KEYS,
		'$request.commandRegistry'
	);
	const handlerRegistry = exactPlainRecord(
		record.handlerRegistry,
		SELECTOR_KEYS,
		'$request.handlerRegistry'
	);
	for (const key of BUDGET_KEYS)
		if (!Number.isSafeInteger(budgets[key]) || (budgets[key] as number) < 1)
			throw new TypeError(`$request.budgets.${key} must be a positive safe integer.`);
	for (const [path, selector] of [
		['$request.commandRegistry', commandRegistry],
		['$request.handlerRegistry', handlerRegistry]
	] as const)
		for (const key of SELECTOR_KEYS)
			if (typeof selector[key] !== 'string' || (selector[key] as string).length === 0)
				throw new TypeError(`${path}.${key} must be nonempty text.`);
	if (commandRegistry.exportName !== 'COMMANDS')
		throw new TypeError('$request.commandRegistry.exportName must be COMMANDS.');
	if (handlerRegistry.exportName !== 'HANDLERS')
		throw new TypeError('$request.handlerRegistry.exportName must be HANDLERS.');
	for (const key of REQUEST_KEYS.filter(
		(key) => key !== 'budgets' && key !== 'commandRegistry' && key !== 'handlerRegistry'
	))
		if (typeof record[key] !== 'string' || (record[key] as string).length === 0)
			throw new TypeError(`$request.${key} must be nonempty text.`);
	if (record.schemaVersion !== COMMAND_HANDLER_GRAPH_REQUEST_SCHEMA_VERSION)
		throw new TypeError('Unsupported command-handler graph request schema version.');
	if (record.operationVersion !== COMMAND_HANDLER_GRAPH_OPERATION_VERSION)
		throw new TypeError('Unsupported command-handler graph operation version.');
	return {
		...(record as unknown as BuildCommandHandlerGraphRequest),
		budgets: { ...(budgets as unknown as BuildCommandHandlerGraphRequest['budgets']) },
		commandRegistry: { ...(commandRegistry as unknown as CommandHandlerRegistrySelector) },
		handlerRegistry: { ...(handlerRegistry as unknown as CommandHandlerRegistrySelector) }
	};
}

function safeProgressSink(
	options: BuildCommandHandlerGraphOptions | undefined
): ((event: CommandHandlerGraphProgressEvent) => void) | undefined {
	if (options === undefined || options === null || typeof options !== 'object' || isProxy(options))
		return undefined;
	try {
		const descriptor = Reflect.getOwnPropertyDescriptor(options, 'onProgress');
		return descriptor !== undefined &&
			'value' in descriptor &&
			typeof descriptor.value === 'function'
			? (descriptor.value as (event: CommandHandlerGraphProgressEvent) => void)
			: undefined;
	} catch {
		return undefined;
	}
}

function createProgressRecorder(
	options: BuildCommandHandlerGraphOptions | undefined
): ProgressRecorder {
	const sink = safeProgressSink(options);
	let active: {
		readonly phase: CommandHandlerGraphProgressPhase;
		readonly started: number;
	} | null = null;
	const emit = (
		phase: CommandHandlerGraphProgressPhase,
		state: CommandHandlerGraphProgressEvent['state'],
		details: Readonly<Record<string, unknown>>,
		durationMs: number
	): void => {
		if (sink === undefined) return;
		try {
			sink({
				details,
				durationMs: Math.max(0, durationMs),
				phase,
				schemaVersion: COMMAND_HANDLER_GRAPH_PROGRESS_SCHEMA_VERSION,
				state,
				timestamp: new Date().toISOString()
			});
		} catch {
			// Telemetry is deliberately unable to affect graph evidence or outcome.
		}
	};
	return {
		complete(details = {}): void {
			if (active === null) return;
			emit(active.phase, 'COMPLETED', details, performance.now() - active.started);
			active = null;
		},
		fail(code): void {
			if (active === null) return;
			emit(active.phase, 'FAILED', { diagnosticCode: code }, performance.now() - active.started);
			active = null;
		},
		start(phase, details = {}): void {
			if (active !== null)
				emit(
					active.phase,
					'FAILED',
					{ diagnosticCode: 'PHASE_INTERRUPTED' },
					performance.now() - active.started
				);
			active = { phase, started: performance.now() };
			emit(phase, 'STARTED', details, 0);
		}
	};
}

function addGrouped<Key, Value>(map: Map<Key, Value[]>, key: Key, value: Value): void {
	const group = map.get(key);
	if (group === undefined) map.set(key, [value]);
	else group.push(value);
}

function sortedUnique<T extends string>(values: Iterable<T>): T[] {
	return [...new Set(values)].sort(compareText);
}

function indexes(snapshot: StaticSemanticSnapshot): GraphIndexes {
	const nodeById = new Map(snapshot.astNodes.map((node) => [node.id, node]));
	const sourceById = new Map(snapshot.sources.map((source) => [source.id, source]));
	const declarationById = new Map(
		snapshot.declarations.map((declaration) => [declaration.id, declaration])
	);
	const symbolById = new Map(snapshot.symbols.map((symbol) => [symbol.id, symbol]));
	const provenances = new Set(snapshot.provenances.map((provenance) => provenance.id));
	if (
		nodeById.size !== snapshot.astNodes.length ||
		sourceById.size !== snapshot.sources.length ||
		declarationById.size !== snapshot.declarations.length ||
		symbolById.size !== snapshot.symbols.length ||
		provenances.size !== snapshot.provenances.length
	)
		throw new Error('Semantic input contains duplicate identities.');
	const childrenByParent = new Map<SemanticAstNodeRecord['id'], SemanticAstNodeRecord[]>();
	for (const node of snapshot.astNodes) {
		if (!sourceById.has(node.sourceId)) throw new Error(`AST node ${node.id} has no source.`);
		if (node.parentId !== null) addGrouped(childrenByParent, node.parentId, node);
	}
	for (const children of childrenByParent.values())
		children.sort((a, b) => compareText(a.id, b.id));
	const assignmentsByNode = new Map<
		SemanticAstNodeRecord['id'],
		StaticSemanticSnapshot['assignments'][number][]
	>();
	for (const assignment of snapshot.assignments)
		addGrouped(assignmentsByNode, assignment.nodeId, assignment);
	const declarationsByNode = new Map<SemanticAstNodeRecord['id'], SemanticDeclarationRecord[]>();
	for (const declaration of snapshot.declarations)
		if (declaration.nodeId !== null)
			addGrouped(declarationsByNode, declaration.nodeId, declaration);
	const referencesByNode = new Map<SemanticAstNodeRecord['id'], SemanticReferenceRecord[]>();
	for (const reference of snapshot.references)
		addGrouped(referencesByNode, reference.nodeId, reference);
	const invocationByNode = new Map(
		snapshot.invocations.map((invocation) => [invocation.nodeId, invocation])
	);
	if (invocationByNode.size !== snapshot.invocations.length)
		throw new Error('Semantic invocation nodes are not unique.');
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
		referencesByNode,
		sourceById,
		symbolById
	};
}

function ownedSources(
	snapshot: StaticSemanticSnapshot,
	model: GraphIndexes,
	logicalPath: string,
	projectConfigPath: string
): SemanticSourceRecord[] {
	return snapshot.sources.filter(
		(source) =>
			source.logicalPath === logicalPath &&
			model.projectConfigById.get(source.projectId) === projectConfigPath &&
			source.analysisDisposition === 'DEEP_INDEXED'
	);
}

function ownedSource(
	snapshot: StaticSemanticSnapshot,
	model: GraphIndexes,
	logicalPath: string,
	projectConfigPath: string
): SemanticSourceRecord {
	const candidates = ownedSources(snapshot, model, logicalPath, projectConfigPath);
	if (candidates.length !== 1)
		throw new Error(
			`Expected exactly one deep-indexed source for the selected logical path; found ${candidates.length}.`
		);
	return candidates[0]!;
}

function registryDeclaration(
	snapshot: StaticSemanticSnapshot,
	source: SemanticSourceRecord,
	name: string
): SemanticDeclarationRecord {
	const declarations = snapshot.declarations.filter(
		(declaration) =>
			declaration.sourceId === source.id &&
			declaration.name === name &&
			declaration.nodeId !== null &&
			declaration.kind === ts.SyntaxKind.VariableDeclaration
	);
	if (declarations.length !== 1)
		throw new Error(
			`Expected exactly one selected registry declaration; found ${declarations.length}.`
		);
	return declarations[0]!;
}

function registrySelector(
	snapshot: StaticSemanticSnapshot,
	model: GraphIndexes,
	logicalPath: string,
	projectConfigPath: string,
	exportName: 'COMMANDS' | 'HANDLERS'
): CommandHandlerRegistrySelector {
	const source = ownedSource(snapshot, model, logicalPath, projectConfigPath);
	const declaration = registryDeclaration(snapshot, source, exportName);
	return {
		contentSha256: source.contentSha256,
		declarationId: declaration.id,
		exportName,
		logicalPath,
		programId: source.programId,
		projectConfigPath,
		projectId: source.projectId,
		sourceId: source.id
	};
}

export function selectJpwbCommandHandlerRegistries(snapshot: StaticSemanticSnapshot): {
	readonly commandRegistry: CommandHandlerRegistrySelector;
	readonly handlerRegistry: CommandHandlerRegistrySelector;
} {
	const model = indexes(snapshot);
	return {
		commandRegistry: registrySelector(
			snapshot,
			model,
			COMMAND_CATALOG_PATH,
			COMMAND_CATALOG_PROJECT,
			'COMMANDS'
		),
		handlerRegistry: registrySelector(
			snapshot,
			model,
			HANDLER_REGISTRY_PATH,
			HANDLER_REGISTRY_PROJECT,
			'HANDLERS'
		)
	};
}

function selectorsEqual(
	left: CommandHandlerRegistrySelector,
	right: CommandHandlerRegistrySelector
): boolean {
	return SELECTOR_KEYS.every((key) => left[key] === right[key]);
}

function memberName(node: SemanticAstNodeRecord, snapshot: StaticSemanticSnapshot): string | null {
	if (node.syntacticIdentifierText !== null) return node.syntacticIdentifierText;
	const literal = snapshot.literals.find(
		(item) =>
			item.nodeId === node.id && item.valueState === 'EXACT' && typeof item.value === 'string'
	);
	return literal === undefined ? null : (literal.value as string);
}

function namedObjectRegistry(
	snapshot: StaticSemanticSnapshot,
	model: GraphIndexes,
	source: SemanticSourceRecord,
	name: string
): RegistryMember[] {
	const declaration = registryDeclaration(snapshot, source, name);
	const declarationAssignments = model.assignmentsByNode.get(declaration.nodeId!) ?? [];
	const initializer = declarationAssignments.filter(
		(assignment) => assignment.assignmentKind === 'INITIALIZER' && assignment.valueNodeId !== null
	);
	if (initializer.length !== 1)
		throw new Error('Selected registry has no exact normalized initializer.');
	let objectNode = model.nodeById.get(initializer[0]!.valueNodeId!);
	while (objectNode !== undefined && TRANSPARENT_EXPRESSION_KINDS.has(objectNode.kind)) {
		const expressionChildren = (model.childrenByParent.get(objectNode.id) ?? []).filter(
			(child) =>
				child.kind === ts.SyntaxKind.ObjectLiteralExpression ||
				TRANSPARENT_EXPRESSION_KINDS.has(child.kind)
		);
		if (expressionChildren.length !== 1) {
			objectNode = undefined;
			break;
		}
		objectNode = expressionChildren[0]!;
	}
	if (objectNode?.kind !== ts.SyntaxKind.ObjectLiteralExpression)
		throw new Error('Selected registry initializer is not a normalized object literal.');
	const propertyNodes = model.childrenByParent.get(objectNode.id) ?? [];
	if (propertyNodes.some((node) => node.kind !== ts.SyntaxKind.PropertyAssignment))
		throw new Error('Selected registry contains an unsupported member grammar.');
	const members = propertyNodes.map((propertyNode): RegistryMember => {
		const assignments = (model.assignmentsByNode.get(propertyNode.id) ?? []).filter(
			(assignment) => assignment.assignmentKind === 'INITIALIZER' && assignment.valueNodeId !== null
		);
		if (assignments.length !== 1)
			throw new Error('Selected registry member has no exact normalized value binding.');
		const assignment = assignments[0]!;
		const nameNode = model.nodeById.get(assignment.targetNodeId);
		const valueNode = model.nodeById.get(assignment.valueNodeId!);
		if (nameNode === undefined || valueNode === undefined)
			throw new Error('Selected registry member has a dangling normalized endpoint.');
		const commandName = memberName(nameNode, snapshot);
		if (commandName === null || commandName.length === 0)
			throw new Error('Selected registry member has an unsupported computed name.');
		const declarationsAtNode = model.declarationsByNode.get(propertyNode.id) ?? [];
		if (declarationsAtNode.length > 1)
			throw new Error('Selected registry member has ambiguous declarations.');
		return {
			commandName,
			declaration: declarationsAtNode[0] ?? null,
			nameNode,
			propertyNode,
			valueNode
		};
	});
	const names = members.map((member) => member.commandName);
	if (new Set(names).size !== names.length)
		throw new Error('Selected registry contains duplicate command names.');
	return members.sort((left, right) => compareText(left.commandName, right.commandName));
}

function callableFromDeclaration(
	declaration: SemanticDeclarationRecord,
	model: GraphIndexes
): SemanticAstNodeRecord | null {
	if (declaration.nodeId === null) return null;
	const declarationNode = model.nodeById.get(declaration.nodeId);
	if (declarationNode === undefined) return null;
	if (CALLABLE_KINDS.has(declarationNode.kind)) return declarationNode;
	const assignments = (model.assignmentsByNode.get(declarationNode.id) ?? []).filter(
		(assignment) => assignment.assignmentKind === 'INITIALIZER' && assignment.valueNodeId !== null
	);
	if (assignments.length !== 1) return null;
	const value = model.nodeById.get(assignments[0]!.valueNodeId!);
	return value !== undefined && CALLABLE_KINDS.has(value.kind) ? value : null;
}

function resolveHandlerBindings(
	members: readonly RegistryMember[],
	model: GraphIndexes
): HandlerBinding[] {
	return members.map((member): HandlerBinding => {
		const handlerName = member.valueNode.syntacticIdentifierText;
		if (handlerName === null)
			return {
				factoryCallableNodeId: null,
				handlerName: '<unsupported>',
				handlerSymbol: null,
				implementationNode: null,
				implementationState: 'UNRESOLVED',
				member,
				reference: null
			};
		const references = (model.referencesByNode.get(member.valueNode.id) ?? []).filter(
			(reference) => reference.role === 'SYMBOL_USE' || reference.role === 'IMPORT_EXPORT_BINDING'
		);
		const resolved = references.filter((reference) => reference.resolvedSymbolId !== null);
		if (resolved.length !== 1)
			return {
				factoryCallableNodeId: null,
				handlerName,
				handlerSymbol: null,
				implementationNode: null,
				implementationState: 'UNRESOLVED',
				member,
				reference: references.length === 1 ? references[0]! : null
			};
		const reference = resolved[0]!;
		const handlerSymbol = model.symbolById.get(reference.resolvedSymbolId!);
		if (handlerSymbol === undefined)
			return {
				factoryCallableNodeId: null,
				handlerName,
				handlerSymbol: null,
				implementationNode: null,
				implementationState: 'UNRESOLVED',
				member,
				reference
			};
		const declarations = handlerSymbol.declarationIds
			.map((id) => model.declarationById.get(id))
			.filter((item): item is SemanticDeclarationRecord => item !== undefined);
		const callables = declarations
			.map((declaration) => callableFromDeclaration(declaration, model))
			.filter((item): item is SemanticAstNodeRecord => item !== null);
		if (callables.length === 1)
			return {
				factoryCallableNodeId: null,
				handlerName,
				handlerSymbol,
				implementationNode: callables[0]!,
				implementationState: 'DIRECT',
				member,
				reference
			};
		const declarationInitializers = declarations.flatMap((declaration) =>
			declaration.nodeId === null
				? []
				: (model.assignmentsByNode.get(declaration.nodeId) ?? []).filter(
						(assignment) =>
							assignment.assignmentKind === 'INITIALIZER' && assignment.valueNodeId !== null
					)
		);
		if (declarationInitializers.length === 1) {
			const initializerNode = model.nodeById.get(declarationInitializers[0]!.valueNodeId!);
			const invocation = model.invocationByNode.get(declarationInitializers[0]!.valueNodeId!);
			if (initializerNode?.kind === ts.SyntaxKind.CallExpression && invocation !== undefined) {
				const factoryReferences = (
					model.referencesByNode.get(invocation.calleeNodeId) ?? []
				).filter((referenceItem) => referenceItem.resolvedSymbolId !== null);
				if (factoryReferences.length === 1) {
					const factory = model.symbolById.get(factoryReferences[0]!.resolvedSymbolId!);
					const factoryCallables =
						factory?.declarationIds
							.map((id) => model.declarationById.get(id))
							.filter((item): item is SemanticDeclarationRecord => item !== undefined)
							.map((item) => callableFromDeclaration(item, model))
							.filter((item): item is SemanticAstNodeRecord => item !== null) ?? [];
					if (factoryCallables.length === 1)
						return {
							factoryCallableNodeId: factoryCallables[0]!.id,
							handlerName,
							handlerSymbol,
							implementationNode: initializerNode,
							implementationState: 'FACTORY_RESULT',
							member,
							reference
						};
				}
			}
		}
		return {
			factoryCallableNodeId: null,
			handlerName,
			handlerSymbol,
			implementationNode: null,
			implementationState: 'UNRESOLVED',
			member,
			reference
		};
	});
}

function sourceProvenance(source: SemanticSourceRecord): SemanticProvenanceId[] {
	return sortedUnique([
		source.provenanceId,
		...(source.syntaxProvenanceId === null ? [] : [source.syntaxProvenanceId])
	]);
}

function declarationProvenance(
	declaration: SemanticDeclarationRecord | null,
	source: SemanticSourceRecord
): SemanticProvenanceId[] {
	return sortedUnique([
		...sourceProvenance(source),
		...(declaration === null
			? []
			: [declaration.bindingProvenanceId, declaration.structuralProvenanceId])
	]);
}

function referenceProvenance(
	reference: SemanticReferenceRecord | null,
	symbol: SemanticSymbolRecord | null,
	source: SemanticSourceRecord
): SemanticProvenanceId[] {
	return sortedUnique([
		...sourceProvenance(source),
		...(reference === null
			? []
			: [reference.resolutionProvenanceId, reference.structuralProvenanceId]),
		...(symbol === null ? [] : [symbol.provenanceId])
	]);
}

function decodeCompilerText(bytes: Uint8Array): string {
	if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
		const body = bytes.subarray(2);
		if (body.byteLength % 2 !== 0) throw new TypeError('Incomplete UTF-16LE source code unit.');
		return new TextDecoder('utf-16le', { fatal: true }).decode(body);
	}
	if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
		const body = bytes.subarray(2);
		if (body.byteLength % 2 !== 0) throw new TypeError('Incomplete UTF-16BE source code unit.');
		const swapped = body.slice();
		for (let index = 0; index < swapped.length; index += 2)
			[swapped[index], swapped[index + 1]] = [swapped[index + 1]!, swapped[index]!];
		return new TextDecoder('utf-16le', { fatal: true }).decode(swapped);
	}
	const start =
		bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
	return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(start));
}

function lineAt(text: string, offset: number): number {
	if (!Number.isSafeInteger(offset) || offset < 0 || offset > text.length)
		throw new RangeError('Semantic source offset is outside frozen source text.');
	let line = 1;
	for (let index = 0; index < offset; index += 1) if (text.charCodeAt(index) === 10) line += 1;
	return line;
}

function callableAncestors(
	node: SemanticAstNodeRecord,
	model: GraphIndexes
): SemanticAstNodeRecord[] {
	const result: SemanticAstNodeRecord[] = [];
	let parentId = node.parentId;
	while (parentId !== null) {
		const parent = model.nodeById.get(parentId);
		if (parent === undefined) throw new Error(`AST parent ${parentId} is absent.`);
		if (CALLABLE_KINDS.has(parent.kind)) result.push(parent);
		parentId = parent.parentId;
	}
	return result;
}

function makeIndexes(
	nodes: readonly CommandHandlerGraphNode[],
	edges: readonly CommandHandlerGraphEdge[],
	direction: 'FORWARD' | 'REVERSE'
): CommandHandlerGraphIndexEntry[] {
	const grouped = new Map<CommandHandlerGraphNodeId, CommandHandlerGraphEdge['id'][]>(
		nodes.map((node) => [node.id, []])
	);
	for (const edge of edges) {
		const endpoint = direction === 'FORWARD' ? edge.source.nodeId : edge.target.nodeId;
		const list = grouped.get(endpoint);
		if (list === undefined) throw new Error('Command-handler graph contains a dangling endpoint.');
		list.push(edge.id);
	}
	return [...grouped.entries()]
		.map(([nodeId, edgeIds]) => ({ edgeIds: edgeIds.sort(compareText), nodeId }))
		.sort((left, right) => compareText(left.nodeId, right.nodeId));
}

function mergeLocations(
	left: readonly CommandHandlerGraphSourceLocation[],
	right: readonly CommandHandlerGraphSourceLocation[]
): CommandHandlerGraphSourceLocation[] {
	const values = new Map<string, CommandHandlerGraphSourceLocation>();
	for (const location of [...left, ...right])
		values.set(`${location.sourceId}\0${location.start}\0${location.end}`, location);
	return [...values.values()].sort(
		(a, b) => compareText(a.sourceId, b.sourceId) || a.start - b.start || a.end - b.end
	);
}

function enforceBudgets(
	request: BuildCommandHandlerGraphRequest,
	input: {
		readonly astNodes: number;
		readonly commandRegistryEntries: number;
		readonly edges: number;
		readonly frontiers: number;
		readonly handlerRegistryEntries: number;
		readonly nodes: number;
		readonly sourceBytes: number;
	}
): void {
	for (const [name, actual, maximum] of [
		['maxAstNodes', input.astNodes, request.budgets.maxAstNodes],
		[
			'maxCommandRegistryEntries',
			input.commandRegistryEntries,
			request.budgets.maxCommandRegistryEntries
		],
		['maxEdges', input.edges, request.budgets.maxEdges],
		['maxFrontiers', input.frontiers, request.budgets.maxFrontiers],
		[
			'maxHandlerRegistryEntries',
			input.handlerRegistryEntries,
			request.budgets.maxHandlerRegistryEntries
		],
		['maxNodes', input.nodes, request.budgets.maxNodes],
		['maxSourceBytes', input.sourceBytes, request.budgets.maxSourceBytes]
	] as const)
		if (actual > maximum) throw new RangeError(`${name} exceeded: ${actual} > ${maximum}.`);
}

function layerProvenance(
	nodes: readonly CommandHandlerGraphNode[],
	edges: readonly CommandHandlerGraphEdge[]
): SemanticProvenanceId[] {
	return sortedUnique([
		...nodes.flatMap((node) => node.provenanceIds),
		...edges.flatMap((edge) => edge.provenanceIds)
	]);
}

export function buildCommandHandlerGraph(
	requestValue: unknown,
	snapshot: StaticSemanticSnapshot,
	observation: ArrowCommandCensusObservation,
	subject: FrozenSubject,
	options?: BuildCommandHandlerGraphOptions
): CommandHandlerGraphBuildOutcome {
	const progress = createProgressRecorder(options);
	progress.start('REQUEST_BIND');
	let request: BuildCommandHandlerGraphRequest;
	try {
		request = materializeRequest(requestValue);
	} catch (error) {
		progress.fail('REQUEST_INVALID');
		return unavailable(
			'REQUEST_INVALID',
			error instanceof Error ? error.message : 'Invalid command-handler graph request.',
			'REQUEST'
		);
	}
	if (request.semanticSnapshotId !== snapshot.id) {
		progress.fail('SEMANTIC_SNAPSHOT_ID_MISMATCH');
		return unavailable(
			'SEMANTIC_SNAPSHOT_ID_MISMATCH',
			'The requested semantic snapshot identity does not match.',
			'REQUEST',
			'$.semanticSnapshotId'
		);
	}
	if (request.arrowObservationId !== observation.id) {
		progress.fail('ARROW_OBSERVATION_ID_MISMATCH');
		return unavailable(
			'ARROW_OBSERVATION_ID_MISMATCH',
			'The requested arrow observation identity does not match.',
			'REQUEST',
			'$.arrowObservationId'
		);
	}
	if (
		request.subjectId !== snapshot.subjectId ||
		request.subjectId !== observation.subjectId ||
		request.subjectId !== subject.descriptor.subjectId
	) {
		progress.fail('SUBJECT_ID_MISMATCH');
		return unavailable(
			'SUBJECT_ID_MISMATCH',
			'The request, semantic snapshot, arrow observation, and frozen subject identities differ.',
			'BIND',
			'$.subjectId'
		);
	}
	if (
		!snapshot.capabilities.some(
			(capability) => capability.capability === 'TS_SYNTAX' && capability.state !== 'UNSUPPORTED'
		) ||
		!snapshot.capabilities.some(
			(capability) => capability.capability === 'TS_SYMBOL' && capability.state !== 'UNSUPPORTED'
		)
	) {
		progress.fail('SEMANTIC_CAPABILITY_UNAVAILABLE');
		return unavailable(
			'SEMANTIC_CAPABILITY_UNAVAILABLE',
			'TS_SYNTAX and TS_SYMBOL are required for the command-handler projection.',
			'BIND'
		);
	}

	try {
		const model = indexes(snapshot);
		if (snapshot.astNodes.length > request.budgets.maxAstNodes)
			throw new RangeError(
				`maxAstNodes exceeded: ${snapshot.astNodes.length} > ${request.budgets.maxAstNodes}.`
			);
		const selectedRegistries = selectJpwbCommandHandlerRegistries(snapshot);
		if (
			!selectorsEqual(request.commandRegistry, selectedRegistries.commandRegistry) ||
			!selectorsEqual(request.handlerRegistry, selectedRegistries.handlerRegistry)
		) {
			progress.fail('REGISTRY_SELECTOR_MISMATCH');
			return unavailable(
				'REGISTRY_SELECTOR_MISMATCH',
				'The caller-selected registry identities do not match the independently derived semantic roots.',
				'BIND'
			);
		}
		const commandSource = model.sourceById.get(request.commandRegistry.sourceId);
		const registrySource = model.sourceById.get(request.handlerRegistry.sourceId);
		if (commandSource === undefined || registrySource === undefined)
			throw new Error('A selected registry source is absent from the semantic snapshot.');
		progress.complete({ astNodes: snapshot.astNodes.length, registrySelectors: 2 });

		progress.start('OBSERVATION_VALIDATE', {
			declaredArrowOccurrences: observation.declaredArrows.length,
			declaredSites: observation.declaredSites.length
		});
		const observationValidation = validateArrowCommandCensusObservation(observation, subject);
		if (observationValidation.state !== 'VALID') {
			progress.fail('ARROW_OBSERVATION_INVALID');
			return unavailable(
				'ARROW_OBSERVATION_INVALID',
				`The arrow observation is not valid (${observationValidation.state}).`,
				'BIND'
			);
		}
		progress.complete({ validationState: observationValidation.state });

		progress.start('ARTIFACT_READ');
		const consumedPaths = new Set<string>();
		const sourceTextById = new Map<string, string>();
		const textFor = (source: SemanticSourceRecord): string => {
			const existing = sourceTextById.get(source.id);
			if (existing !== undefined) return existing;
			const bytes = readFrozenSubjectArtifact(subject, source.logicalPath);
			if (bytes === undefined) throw new Error('A consumed frozen source artifact is unavailable.');
			if (sha256(bytes) !== source.contentSha256)
				throw new Error('A consumed frozen source differs from its semantic content identity.');
			const text = decodeCompilerText(bytes);
			consumedPaths.add(source.logicalPath);
			sourceTextById.set(source.id, text);
			return text;
		};
		textFor(commandSource);
		textFor(registrySource);
		const directSourceByPath = new Map<string, SemanticSourceRecord | null>();
		for (const site of observation.declaredSites)
			if (
				site.source.path !== null &&
				site.source.line !== null &&
				!directSourceByPath.has(site.source.path)
			) {
				const candidates = ownedSources(
					snapshot,
					model,
					site.source.path,
					HANDLER_REGISTRY_PROJECT
				);
				const source = candidates.length === 1 ? candidates[0]! : null;
				directSourceByPath.set(site.source.path, source);
				if (source !== null) textFor(source);
			}
		const needsStepTable = observation.declaredSites.some((site) =>
			site.source.locator.startsWith('STEP_COMMAND_SPECS.')
		);
		const needsPwuTable = observation.declaredSites.some((site) =>
			site.source.locator.startsWith('PWU_LIFECYCLE_COMMAND_SPECS.')
		);
		const stepTableSources = needsStepTable
			? ownedSources(snapshot, model, STEP_COMMAND_SPEC_PATH, DOMAIN_PROJECT)
			: [];
		const pwuTableSources = needsPwuTable
			? ownedSources(snapshot, model, PWU_COMMAND_SPEC_PATH, DOMAIN_PROJECT)
			: [];
		const stepTableSource = stepTableSources.length === 1 ? stepTableSources[0]! : null;
		const pwuTableSource = pwuTableSources.length === 1 ? pwuTableSources[0]! : null;
		if (stepTableSource !== null) textFor(stepTableSource);
		if (pwuTableSource !== null) textFor(pwuTableSource);
		const consumedBytes = [...consumedPaths].reduce((total, path) => {
			const artifact = subject.artifacts.find((item) => item.path === path);
			return total + (artifact?.bytes ?? 0);
		}, 0);
		if (consumedBytes > request.budgets.maxSourceBytes)
			throw new RangeError(
				`maxSourceBytes exceeded: ${consumedBytes} > ${request.budgets.maxSourceBytes}.`
			);
		progress.complete({ sourceBytes: consumedBytes, sourceFiles: consumedPaths.size });

		progress.start('CONTRACT_PARSE');
		const commandMembers = namedObjectRegistry(snapshot, model, commandSource, 'COMMANDS');
		if (commandMembers.length > request.budgets.maxCommandRegistryEntries)
			throw new RangeError(
				`maxCommandRegistryEntries exceeded: ${commandMembers.length} > ${request.budgets.maxCommandRegistryEntries}.`
			);
		if (commandMembers.length === 0)
			throw new Error('The selected JPWB COMMANDS registry is unexpectedly empty.');
		progress.complete({ commandRegistryEntries: commandMembers.length });

		progress.start('REGISTRY_PARSE');
		const registrationMembers = namedObjectRegistry(snapshot, model, registrySource, 'HANDLERS');
		if (registrationMembers.length > request.budgets.maxHandlerRegistryEntries)
			throw new RangeError(
				`maxHandlerRegistryEntries exceeded: ${registrationMembers.length} > ${request.budgets.maxHandlerRegistryEntries}.`
			);
		if (registrationMembers.length === 0)
			throw new Error('The selected JPWB HANDLERS registry is unexpectedly empty.');
		progress.complete({ handlerRegistryEntries: registrationMembers.length });

		progress.start('BINDING_RESOLVE');
		const handlerBindings = resolveHandlerBindings(registrationMembers, model);
		const graphInputDigest = commandHandlerGraphInputDigest(request, snapshot, observation);
		const graphId = commandHandlerGraphId({
			arrowObservationId: observation.id,
			canonicalProfile: COMMAND_HANDLER_GRAPH_CANONICAL_PROFILE,
			graphInputDigest,
			method: COMMAND_HANDLER_GRAPH_METHOD,
			operationVersion: COMMAND_HANDLER_GRAPH_OPERATION_VERSION,
			schemaVersion: COMMAND_HANDLER_GRAPH_SCHEMA_VERSION,
			semanticSnapshotId: snapshot.id,
			subjectId: snapshot.subjectId
		});
		const derivationLayerId = commandHandlerDerivationLayerId(graphId);
		const inferenceLayerId = commandHandlerInferenceLayerId(graphId);
		const commandNodes = commandMembers.map((member): CommandRegistryEntryNode => ({
			commandName: member.commandName,
			declarationId: member.declaration?.id ?? null,
			graphId,
			id: commandRegistryEntryNodeId(graphId, member.propertyNode.id),
			kind: 'COMMAND_REGISTRY_ENTRY',
			layerId: derivationLayerId,
			nameNodeId: member.nameNode.id,
			programId: commandSource.programId,
			projectId: commandSource.projectId,
			propertyNodeId: member.propertyNode.id,
			provenanceIds: declarationProvenance(member.declaration, commandSource),
			semanticSnapshotId: snapshot.id,
			sourceId: commandSource.id,
			sourceLocations: [
				{ end: member.nameNode.end, sourceId: commandSource.id, start: member.nameNode.start }
			],
			subjectId: snapshot.subjectId
		}));
		const commandNodeByName = new Map(commandNodes.map((node) => [node.commandName, node]));
		const registrationNodes = handlerBindings.map((binding): HandlerRegistrationNode => ({
			commandName: binding.member.commandName,
			graphId,
			handlerAliasSymbolId: binding.reference?.symbolId ?? null,
			handlerName: binding.handlerName,
			handlerTerminalSymbolId: binding.reference?.resolvedSymbolId ?? null,
			id: handlerRegistrationNodeId(graphId, binding.member.propertyNode.id),
			kind: 'HANDLER_REGISTRATION',
			layerId: derivationLayerId,
			nameNodeId: binding.member.nameNode.id,
			programId: registrySource.programId,
			projectId: registrySource.projectId,
			propertyNodeId: binding.member.propertyNode.id,
			provenanceIds: referenceProvenance(binding.reference, binding.handlerSymbol, registrySource),
			semanticSnapshotId: snapshot.id,
			sourceId: registrySource.id,
			sourceLocations: [
				{
					end: binding.member.propertyNode.end,
					sourceId: registrySource.id,
					start: binding.member.propertyNode.start
				}
			],
			subjectId: snapshot.subjectId,
			targetNodeId: binding.member.valueNode.id,
			targetReferenceId: binding.reference?.id ?? null
		}));
		const registrationNodeByName = new Map(
			registrationNodes.map((node) => [node.commandName, node])
		);
		const targetNodeById = new Map<CommandHandlerGraphNodeId, HandlerTargetNode>();
		const resolvedTargets: ResolvedHandlerTarget[] = [];
		const targetByCommand = new Map<string, HandlerTargetNode>();
		for (const binding of handlerBindings) {
			if (binding.handlerSymbol === null || binding.implementationNode === null) continue;
			const implementationSource = model.sourceById.get(binding.implementationNode.sourceId);
			if (implementationSource === undefined)
				throw new Error('A resolved handler target source is absent.');
			const id = handlerTargetNodeId(graphId, {
				nodeId: binding.implementationNode.id,
				symbolId: binding.handlerSymbol.id
			});
			const candidate: HandlerTargetNode = {
				bodyKind:
					binding.implementationState === 'DIRECT'
						? 'DIRECT_FUNCTION'
						: 'FACTORY_CALL_RESULT_CANDIDATE',
				declarationIds: [...binding.handlerSymbol.declarationIds].sort(compareText),
				graphId,
				handlerName: binding.handlerSymbol.name,
				id,
				kind: 'HANDLER_TARGET',
				layerId: binding.implementationState === 'DIRECT' ? derivationLayerId : inferenceLayerId,
				nodeId: binding.implementationNode.id,
				programId: implementationSource.programId,
				projectId: implementationSource.projectId,
				provenanceIds: sortedUnique([
					...sourceProvenance(implementationSource),
					binding.handlerSymbol.provenanceId
				]),
				semanticSnapshotId: snapshot.id,
				sourceId: implementationSource.id,
				sourceLocations: [
					{
						end: binding.implementationNode.end,
						sourceId: implementationSource.id,
						start: binding.implementationNode.start
					}
				],
				subjectId: snapshot.subjectId,
				symbolId: binding.handlerSymbol.id
			};
			const existing = targetNodeById.get(id);
			if (
				existing !== undefined &&
				(existing.bodyKind !== candidate.bodyKind ||
					existing.handlerName !== candidate.handlerName ||
					existing.sourceId !== candidate.sourceId)
			)
				throw new Error('One handler-target identity produced incompatible normalized values.');
			const node = existing ?? candidate;
			targetNodeById.set(id, node);
			targetByCommand.set(binding.member.commandName, node);
			resolvedTargets.push({ binding, node });
		}
		progress.complete({
			directTargets: [...targetNodeById.values()].filter(
				(node) => node.bodyKind === 'DIRECT_FUNCTION'
			).length,
			factoryCandidateTargets: [...targetNodeById.values()].filter(
				(node) => node.bodyKind === 'FACTORY_CALL_RESULT_CANDIDATE'
			).length,
			resolvedRegistrations: targetByCommand.size,
			unresolvedRegistrations: handlerBindings.length - targetByCommand.size
		});

		progress.start('SITE_ATTRIBUTION');
		const directTargetsByCallable = new Map<string, HandlerTargetNode[]>();
		const factoryTargetsByCallable = new Map<string, HandlerTargetNode[]>();
		for (const resolved of resolvedTargets) {
			if (resolved.binding.implementationState === 'DIRECT')
				addGrouped(directTargetsByCallable, resolved.node.nodeId, resolved.node);
			else if (resolved.binding.factoryCallableNodeId !== null)
				addGrouped(factoryTargetsByCallable, resolved.binding.factoryCallableNodeId, resolved.node);
		}
		const tableMembers = new Map<
			'STEP_COMMAND_SPECS' | 'PWU_LIFECYCLE_COMMAND_SPECS',
			ReadonlyMap<string, RegistryMember>
		>();
		if (stepTableSource !== null)
			tableMembers.set(
				'STEP_COMMAND_SPECS',
				new Map(
					namedObjectRegistry(snapshot, model, stepTableSource, 'STEP_COMMAND_SPECS').map(
						(member) => [member.commandName, member]
					)
				)
			);
		if (pwuTableSource !== null)
			tableMembers.set(
				'PWU_LIFECYCLE_COMMAND_SPECS',
				new Map(
					namedObjectRegistry(snapshot, model, pwuTableSource, 'PWU_LIFECYCLE_COMMAND_SPECS').map(
						(member) => [member.commandName, member]
					)
				)
			);
		const siteProjections: SiteProjection[] = [];
		for (const site of observation.declaredSites) {
			const table = /^(STEP_COMMAND_SPECS|PWU_LIFECYCLE_COMMAND_SPECS)\.([^\s.]+)$/u.exec(
				site.source.locator
			);
			if (table !== null) {
				const tableName = table[1] as 'STEP_COMMAND_SPECS' | 'PWU_LIFECYCLE_COMMAND_SPECS';
				const commandName = table[2]!;
				const tableSource = tableName === 'STEP_COMMAND_SPECS' ? stepTableSource : pwuTableSource;
				const member = tableMembers.get(tableName)?.get(commandName) ?? null;
				const exact = commandNodeByName.has(commandName) && tableSource !== null && member !== null;
				siteProjections.push({
					attribution: exact ? 'TABLE_COMMAND' : 'UNRESOLVED',
					candidateTargetIds: [],
					commandName,
					exactTargetIds: [],
					observation: site,
					provenanceIds: tableSource === null ? [] : sourceProvenance(tableSource),
					semanticSiteNodeId: member?.propertyNode.id ?? null,
					sourceId: tableSource?.id ?? null,
					sourceLocations:
						tableSource === null || member === null
							? []
							: [
									{
										end: member.propertyNode.end,
										sourceId: tableSource.id,
										start: member.propertyNode.start
									}
								]
				});
				continue;
			}
			let source: SemanticSourceRecord | null = null;
			let invocationNode: SemanticAstNodeRecord | null = null;
			let attribution: CommandArrowSiteNode['attribution'] = 'UNRESOLVED';
			let exactTargetIds: CommandHandlerGraphNodeId[] = [];
			let candidateTargetIds: CommandHandlerGraphNodeId[] = [];
			if (site.source.path !== null && site.source.line !== null) {
				source = directSourceByPath.get(site.source.path) ?? null;
				if (source !== null) {
					const text = sourceTextById.get(source.id);
					if (text === undefined) throw new Error('A verified handler source text is absent.');
					const invocations = snapshot.invocations.filter((invocation) => {
						if (invocation.sourceId !== source!.id) return false;
						const node = model.nodeById.get(invocation.nodeId);
						const callee = model.nodeById.get(invocation.calleeNodeId);
						return (
							node !== undefined &&
							callee?.syntacticIdentifierText === 'advanceStatus' &&
							lineAt(text, node.start) === site.source.line
						);
					});
					if (invocations.length === 1) {
						invocationNode = model.nodeById.get(invocations[0]!.nodeId) ?? null;
						if (invocationNode !== null) {
							const ancestors = callableAncestors(invocationNode, model);
							const direct =
								ancestors.length === 0 ? [] : (directTargetsByCallable.get(ancestors[0]!.id) ?? []);
							if (direct.length > 0) {
								attribution = 'DIRECT_HANDLER';
								exactTargetIds = sortedUnique(direct.map((node) => node.id));
							} else {
								const candidates = ancestors.flatMap(
									(ancestor) => factoryTargetsByCallable.get(ancestor.id) ?? []
								);
								if (candidates.length > 0) {
									attribution = 'FACTORY_SHARED';
									candidateTargetIds = sortedUnique(candidates.map((node) => node.id));
								}
							}
						}
					}
				}
			}
			siteProjections.push({
				attribution,
				candidateTargetIds,
				commandName: null,
				exactTargetIds,
				observation: site,
				provenanceIds: source === null ? [] : sourceProvenance(source),
				semanticSiteNodeId: invocationNode?.id ?? null,
				sourceId: source?.id ?? null,
				sourceLocations:
					source === null || invocationNode === null
						? []
						: [{ end: invocationNode.end, sourceId: source.id, start: invocationNode.start }]
			});
		}
		progress.complete({
			directHandlerSites: siteProjections.filter((site) => site.attribution === 'DIRECT_HANDLER')
				.length,
			factorySharedSites: siteProjections.filter((site) => site.attribution === 'FACTORY_SHARED')
				.length,
			tableCommandSites: siteProjections.filter((site) => site.attribution === 'TABLE_COMMAND')
				.length,
			unresolvedSites: siteProjections.filter((site) => site.attribution === 'UNRESOLVED').length
		});

		progress.start('GRAPH_MATERIALIZE');
		const nodes: CommandHandlerGraphNode[] = [
			...commandNodes,
			...registrationNodes,
			...targetNodeById.values()
		];
		const edges: CommandHandlerGraphEdge[] = [];
		const frontiers: CommandHandlerFrontierNode[] = [];
		const commandsWithEvidence = new Set<string>();
		const commandsByTarget = new Map<CommandHandlerGraphNodeId, string[]>();
		for (const [commandName, target] of targetByCommand)
			addGrouped(commandsByTarget, target.id, commandName);

		const addCommandRegistrationEdge = (
			source: CommandRegistryEntryNode,
			target: HandlerRegistrationNode
		): void => {
			const identity = {
				attribution: 'EXACT' as const,
				graphId,
				inferenceBasis: null,
				relationCode: 'IMPL-JPWB-CH-COMMAND-REGISTRATION-001' as const,
				relationKind: 'COMMAND_REGISTRY_ENTRY_TO_HANDLER_REGISTRATION' as const,
				source: { kind: 'COMMAND_REGISTRY_ENTRY' as const, nodeId: source.id },
				target: { kind: 'HANDLER_REGISTRATION' as const, nodeId: target.id }
			};
			edges.push({
				...identity,
				id: commandHandlerGraphEdgeId(identity),
				layerId: derivationLayerId,
				method: COMMAND_HANDLER_GRAPH_METHOD,
				provenanceIds: sortedUnique([...source.provenanceIds, ...target.provenanceIds]),
				semanticSnapshotId: snapshot.id,
				sourceLocations: mergeLocations(source.sourceLocations, target.sourceLocations),
				subjectId: snapshot.subjectId
			});
		};
		const addRegistrationTargetEdge = (
			source: HandlerRegistrationNode,
			target: HandlerTargetNode,
			inferenceBasis: CommandHandlerInferenceBasis | null
		): void => {
			const attribution = inferenceBasis === null ? ('EXACT' as const) : ('CANDIDATE' as const);
			const identity = {
				attribution,
				graphId,
				inferenceBasis,
				relationCode: 'IMPL-JPWB-CH-REGISTRATION-TARGET-001' as const,
				relationKind: 'HANDLER_REGISTRATION_TO_TARGET' as const,
				source: { kind: 'HANDLER_REGISTRATION' as const, nodeId: source.id },
				target: { kind: 'HANDLER_TARGET' as const, nodeId: target.id }
			};
			if (inferenceBasis === null) {
				edges.push({
					...identity,
					attribution: 'EXACT',
					id: commandHandlerGraphEdgeId({ ...identity, attribution: 'EXACT' }),
					inferenceBasis: null,
					layerId: derivationLayerId,
					method: COMMAND_HANDLER_GRAPH_METHOD,
					provenanceIds: sortedUnique([...source.provenanceIds, ...target.provenanceIds]),
					semanticSnapshotId: snapshot.id,
					sourceLocations: mergeLocations(source.sourceLocations, target.sourceLocations),
					subjectId: snapshot.subjectId
				});
			} else
				edges.push({
					...identity,
					attribution: 'CANDIDATE',
					id: commandHandlerGraphEdgeId({ ...identity, attribution: 'CANDIDATE' }),
					inferenceBasis,
					layerId: inferenceLayerId,
					method: COMMAND_HANDLER_GRAPH_METHOD,
					provenanceIds: sortedUnique([...source.provenanceIds, ...target.provenanceIds]),
					semanticSnapshotId: snapshot.id,
					sourceLocations: mergeLocations(source.sourceLocations, target.sourceLocations),
					subjectId: snapshot.subjectId
				});
		};
		const addTargetSiteEdge = (
			source: HandlerTargetNode,
			target: CommandArrowSiteNode,
			inferenceBasis: CommandHandlerInferenceBasis | null
		): void => {
			const attribution = inferenceBasis === null ? ('EXACT' as const) : ('CANDIDATE' as const);
			const identity = {
				attribution,
				graphId,
				inferenceBasis,
				relationCode: 'IMPL-JPWB-CH-TARGET-ARROW-SITE-001' as const,
				relationKind: 'HANDLER_TARGET_TO_ARROW_SITE' as const,
				source: { kind: 'HANDLER_TARGET' as const, nodeId: source.id },
				target: { kind: 'DECLARED_ARROW_SITE' as const, nodeId: target.id }
			};
			if (inferenceBasis === null)
				edges.push({
					...identity,
					attribution: 'EXACT',
					id: commandHandlerGraphEdgeId({ ...identity, attribution: 'EXACT' }),
					inferenceBasis: null,
					layerId: derivationLayerId,
					method: COMMAND_HANDLER_GRAPH_METHOD,
					provenanceIds: sortedUnique([...source.provenanceIds, ...target.provenanceIds]),
					semanticSnapshotId: snapshot.id,
					sourceLocations: mergeLocations(source.sourceLocations, target.sourceLocations),
					subjectId: snapshot.subjectId
				});
			else
				edges.push({
					...identity,
					attribution: 'CANDIDATE',
					id: commandHandlerGraphEdgeId({ ...identity, attribution: 'CANDIDATE' }),
					inferenceBasis,
					layerId: inferenceLayerId,
					method: COMMAND_HANDLER_GRAPH_METHOD,
					provenanceIds: sortedUnique([...source.provenanceIds, ...target.provenanceIds]),
					semanticSnapshotId: snapshot.id,
					sourceLocations: mergeLocations(source.sourceLocations, target.sourceLocations),
					subjectId: snapshot.subjectId
				});
		};
		const addCommandTableSiteEdge = (
			source: CommandRegistryEntryNode,
			target: CommandArrowSiteNode
		): void => {
			const identity = {
				attribution: 'EXACT' as const,
				graphId,
				inferenceBasis: null,
				relationCode: 'IMPL-JPWB-CH-COMMAND-TABLE-SITE-001' as const,
				relationKind: 'COMMAND_REGISTRY_ENTRY_TO_TABLE_ARROW_SITE' as const,
				source: { kind: 'COMMAND_REGISTRY_ENTRY' as const, nodeId: source.id },
				target: { kind: 'DECLARED_ARROW_SITE' as const, nodeId: target.id }
			};
			edges.push({
				...identity,
				id: commandHandlerGraphEdgeId(identity),
				layerId: derivationLayerId,
				method: COMMAND_HANDLER_GRAPH_METHOD,
				provenanceIds: sortedUnique([...source.provenanceIds, ...target.provenanceIds]),
				semanticSnapshotId: snapshot.id,
				sourceLocations: mergeLocations(source.sourceLocations, target.sourceLocations),
				subjectId: snapshot.subjectId
			});
		};
		const addSiteOccurrenceEdge = (
			source: CommandArrowSiteNode,
			target: CommandArrowOccurrenceNode
		): void => {
			const identity = {
				attribution: 'EXACT' as const,
				graphId,
				inferenceBasis: null,
				relationCode: 'IMPL-JPWB-CH-SITE-ARROW-001' as const,
				relationKind: 'ARROW_SITE_TO_OCCURRENCE' as const,
				source: { kind: 'DECLARED_ARROW_SITE' as const, nodeId: source.id },
				target: { kind: 'DECLARED_ARROW_OCCURRENCE' as const, nodeId: target.id }
			};
			edges.push({
				...identity,
				id: commandHandlerGraphEdgeId(identity),
				layerId: derivationLayerId,
				method: COMMAND_HANDLER_GRAPH_METHOD,
				provenanceIds: sortedUnique([...source.provenanceIds, ...target.provenanceIds]),
				semanticSnapshotId: snapshot.id,
				sourceLocations: mergeLocations(source.sourceLocations, target.sourceLocations),
				subjectId: snapshot.subjectId
			});
		};
		const addCommandFrontier = (
			frontierKind: 'COMMAND_WITHOUT_DECLARED_ARROW_EVIDENCE' | 'MISSING_HANDLER_REGISTRATION',
			command: CommandRegistryEntryNode,
			reason: string
		): void => {
			const identity = { commandNodeId: command.id, frontierKind };
			frontiers.push({
				...identity,
				graphId,
				id: commandHandlerFrontierNodeId(graphId, identity),
				kind: 'FRONTIER',
				layerId: inferenceLayerId,
				provenanceIds: command.provenanceIds,
				reason,
				semanticSnapshotId: snapshot.id,
				sourceLocations: command.sourceLocations,
				subjectId: snapshot.subjectId
			});
		};
		const addRegistrationFrontier = (
			frontierKind:
				| 'FACTORY_HANDLER_TARGET_NOT_CONFIRMED'
				| 'UNDECLARED_HANDLER_REGISTRATION'
				| 'UNRESOLVED_HANDLER_TARGET',
			registration: HandlerRegistrationNode,
			reason: string
		): void => {
			const identity = { frontierKind, registrationNodeId: registration.id };
			frontiers.push({
				...identity,
				graphId,
				id: commandHandlerFrontierNodeId(graphId, identity),
				kind: 'FRONTIER',
				layerId: inferenceLayerId,
				provenanceIds: registration.provenanceIds,
				reason,
				semanticSnapshotId: snapshot.id,
				sourceLocations: registration.sourceLocations,
				subjectId: snapshot.subjectId
			});
		};
		const addSiteFrontier = (
			frontierKind: 'FACTORY_SITE_ATTRIBUTION_AMBIGUOUS' | 'SITE_OWNER_NOT_REGISTERED_HANDLER',
			site: CommandArrowSiteNode,
			reason: string
		): void => {
			const identity = { frontierKind, siteNodeId: site.id };
			frontiers.push({
				...identity,
				graphId,
				id: commandHandlerFrontierNodeId(graphId, identity),
				kind: 'FRONTIER',
				layerId: inferenceLayerId,
				provenanceIds: site.provenanceIds,
				reason,
				semanticSnapshotId: snapshot.id,
				sourceLocations: site.sourceLocations,
				subjectId: snapshot.subjectId
			});
		};

		for (const command of commandNodes) {
			const registration = registrationNodeByName.get(command.commandName);
			if (registration === undefined)
				addCommandFrontier(
					'MISSING_HANDLER_REGISTRATION',
					command,
					'The declared command has no static HANDLERS registry entry.'
				);
			else addCommandRegistrationEdge(command, registration);
		}
		for (const registration of registrationNodes) {
			if (!commandNodeByName.has(registration.commandName))
				addRegistrationFrontier(
					'UNDECLARED_HANDLER_REGISTRATION',
					registration,
					'The HANDLERS registry entry has no declared COMMANDS key.'
				);
			const target = targetByCommand.get(registration.commandName);
			if (target === undefined) {
				addRegistrationFrontier(
					'UNRESOLVED_HANDLER_TARGET',
					registration,
					'The registered handler does not resolve to one supported normalized callable target.'
				);
				continue;
			}
			if (target.bodyKind === 'DIRECT_FUNCTION')
				addRegistrationTargetEdge(registration, target, null);
			else {
				const inferenceBasis: CommandHandlerInferenceBasis = {
					assumptions: ['The registered factory call returns a callable command handler.'],
					limitationKinds: ['FACTORY_ARROW_ATTRIBUTION_OPEN'],
					method: COMMAND_HANDLER_GRAPH_METHOD,
					rationale:
						'The registry initializer is a compiler-resolved factory call, but callable return-value flow is not modeled.',
					supportingInputIds: sortedUnique([
						registration.propertyNodeId,
						registration.targetNodeId,
						...(registration.targetReferenceId === null ? [] : [registration.targetReferenceId]),
						target.nodeId,
						target.symbolId
					])
				};
				addRegistrationTargetEdge(registration, target, inferenceBasis);
				addRegistrationFrontier(
					'FACTORY_HANDLER_TARGET_NOT_CONFIRMED',
					registration,
					'The registry initializer is a factory call; its returned callable is represented only as a candidate target.'
				);
			}
		}

		const siteNodeByObservationId = new Map<string, CommandArrowSiteNode>();
		for (const projection of siteProjections) {
			const siteNode: CommandArrowSiteNode = {
				attribution: projection.attribution,
				graphId,
				id: commandArrowSiteNodeId(graphId, projection.observation.id),
				kind: 'DECLARED_ARROW_SITE',
				layerId: derivationLayerId,
				observationSiteId: projection.observation.id,
				observationSource: { ...projection.observation.source },
				provenanceIds: [...projection.provenanceIds].sort(compareText),
				semanticSiteNodeId: projection.semanticSiteNodeId,
				semanticSnapshotId: snapshot.id,
				sourceId: projection.sourceId,
				sourceLocations: [...projection.sourceLocations],
				subjectId: snapshot.subjectId
			};
			nodes.push(siteNode);
			siteNodeByObservationId.set(projection.observation.id, siteNode);
			if (projection.attribution === 'TABLE_COMMAND' && projection.commandName !== null) {
				const command = commandNodeByName.get(projection.commandName);
				if (command === undefined)
					throw new Error('An exact table attribution has no represented command.');
				addCommandTableSiteEdge(command, siteNode);
				commandsWithEvidence.add(command.commandName);
			} else if (projection.attribution === 'DIRECT_HANDLER') {
				for (const targetId of projection.exactTargetIds) {
					const target = targetNodeById.get(targetId);
					if (target === undefined || target.bodyKind !== 'DIRECT_FUNCTION')
						throw new Error('A direct site attribution has no direct handler target.');
					addTargetSiteEdge(target, siteNode, null);
					for (const commandName of commandsByTarget.get(target.id) ?? [])
						commandsWithEvidence.add(commandName);
				}
			} else if (projection.attribution === 'FACTORY_SHARED') {
				for (const targetId of projection.candidateTargetIds) {
					const target = targetNodeById.get(targetId);
					if (target === undefined || target.bodyKind !== 'FACTORY_CALL_RESULT_CANDIDATE')
						throw new Error('A factory site attribution has no factory-result candidate target.');
					const inferenceBasis: CommandHandlerInferenceBasis = {
						assumptions: [
							'A retained arrow site inside the shared factory may belong to this registered factory result.'
						],
						limitationKinds: ['FACTORY_ARROW_ATTRIBUTION_OPEN'],
						method: COMMAND_HANDLER_GRAPH_METHOD,
						rationale:
							'The site is lexically enclosed by the resolved factory callable, but retained pooled literals cannot partition occurrences by factory instance.',
						supportingInputIds: sortedUnique([
							target.nodeId,
							target.symbolId,
							siteNode.observationSiteId,
							...(siteNode.semanticSiteNodeId === null ? [] : [siteNode.semanticSiteNodeId])
						])
					};
					addTargetSiteEdge(target, siteNode, inferenceBasis);
					for (const commandName of commandsByTarget.get(target.id) ?? [])
						commandsWithEvidence.add(commandName);
				}
				addSiteFrontier(
					'FACTORY_SITE_ATTRIBUTION_AMBIGUOUS',
					siteNode,
					'The retained site is inside a shared factory and pooled arrow ranges cannot be partitioned among factory instances.'
				);
			} else
				addSiteFrontier(
					'SITE_OWNER_NOT_REGISTERED_HANDLER',
					siteNode,
					'The retained source site does not resolve to one supported registered handler or exact command table entry.'
				);
		}

		for (const arrow of observation.declaredArrows) {
			const siteNode = siteNodeByObservationId.get(arrow.siteId);
			if (siteNode === undefined) throw new Error('A declared arrow has no represented site.');
			const occurrence: CommandArrowOccurrenceNode = {
				arrowKey: arrow.arrowKey,
				from: arrow.from,
				graphId,
				id: commandArrowOccurrenceNodeId(graphId, arrow.id),
				kind: 'DECLARED_ARROW_OCCURRENCE',
				layerId: derivationLayerId,
				machine: arrow.machine,
				observationArrowId: arrow.id,
				observationSiteId: arrow.siteId,
				ordinalAtSite: arrow.ordinalAtSite,
				provenanceIds: siteNode.provenanceIds,
				semanticSnapshotId: snapshot.id,
				sourceLocations: siteNode.sourceLocations,
				subjectId: snapshot.subjectId,
				to: arrow.to
			};
			nodes.push(occurrence);
			addSiteOccurrenceEdge(siteNode, occurrence);
		}

		for (const command of commandNodes)
			if (!commandsWithEvidence.has(command.commandName))
				addCommandFrontier(
					'COMMAND_WITHOUT_DECLARED_ARROW_EVIDENCE',
					command,
					'The retained arrow census reports no attributable transition declaration for this command; no absence-of-effect conclusion follows.'
				);
		nodes.push(...frontiers);
		nodes.sort((left, right) => compareText(left.id, right.id));
		edges.sort((left, right) => compareText(left.id, right.id));
		enforceBudgets(request, {
			astNodes: snapshot.astNodes.length,
			commandRegistryEntries: commandMembers.length,
			edges: edges.length,
			frontiers: frontiers.length,
			handlerRegistryEntries: registrationMembers.length,
			nodes: nodes.length,
			sourceBytes: consumedBytes
		});
		const missingHandlerRegistrations = commandNodes.filter(
			(command) => !registrationNodeByName.has(command.commandName)
		).length;
		const undeclaredHandlerRegistrations = registrationNodes.filter(
			(registration) => !commandNodeByName.has(registration.commandName)
		).length;
		const exactCommandRegistrations = commandNodes.length - missingHandlerRegistrations;
		const exactEdges = edges.filter((edge) => edge.attribution === 'EXACT').length;
		const candidateEdges = edges.length - exactEdges;
		const coverage: CommandHandlerGraphCoverage = {
			arrowAttributionClosure: 'OPEN',
			candidateEdges,
			commandRegistryClosure:
				missingHandlerRegistrations === 0 && undeclaredHandlerRegistrations === 0
					? 'CLOSED'
					: 'OPEN',
			commandsWithArrowEvidence: commandsWithEvidence.size,
			commandsWithoutArrowEvidence: commandNodes.length - commandsWithEvidence.size,
			directHandlerArrowSites: siteProjections.filter(
				(site) => site.attribution === 'DIRECT_HANDLER'
			).length,
			discoveredArrowOccurrences: observation.declaredArrows.length,
			discoveredArrowSites: observation.declaredSites.length,
			discoveredCommandRegistryEntries: commandMembers.length,
			discoveredHandlerRegistryEntries: registrationMembers.length,
			edges: edges.length,
			exactCommandRegistrations,
			exactEdges,
			factorySharedArrowSites: siteProjections.filter(
				(site) => site.attribution === 'FACTORY_SHARED'
			).length,
			frontierNodes: frontiers.length,
			handlerTargets: targetNodeById.size,
			missingHandlerRegistrations,
			reconciles:
				exactCommandRegistrations + missingHandlerRegistrations === commandMembers.length &&
				exactCommandRegistrations + undeclaredHandlerRegistrations === registrationMembers.length &&
				siteNodeByObservationId.size === observation.declaredSites.length &&
				edges.filter((edge) => edge.relationKind === 'ARROW_SITE_TO_OCCURRENCE').length ===
					observation.declaredArrows.length,
			representedArrowOccurrences: nodes.filter((node) => node.kind === 'DECLARED_ARROW_OCCURRENCE')
				.length,
			representedArrowSites: siteNodeByObservationId.size,
			representedCommandRegistryEntries: commandNodes.length,
			representedHandlerRegistryEntries: registrationNodes.length,
			tableCommandArrowSites: siteProjections.filter((site) => site.attribution === 'TABLE_COMMAND')
				.length,
			undeclaredHandlerRegistrations
		};
		if (!coverage.reconciles) throw new Error('Command-handler graph coverage does not reconcile.');
		for (const provenanceId of sortedUnique(nodes.flatMap((node) => node.provenanceIds)))
			if (!model.provenances.has(provenanceId))
				throw new Error('The graph references an unknown semantic provenance.');
		const derivationNodes = nodes.filter((node) => node.layerId === derivationLayerId);
		const inferenceNodes = nodes.filter((node) => node.layerId === inferenceLayerId);
		const derivationEdges = edges.filter((edge) => edge.layerId === derivationLayerId);
		const inferenceEdges = edges.filter((edge) => edge.layerId === inferenceLayerId);
		if (
			derivationNodes.length + inferenceNodes.length !== nodes.length ||
			derivationEdges.length + inferenceEdges.length !== edges.length
		)
			throw new Error('Command-handler graph layers do not partition their populations.');
		const makeLayer = (
			layerId: CommandHandlerGraphLayerId,
			kind: CommandHandlerGraphLayer['kind'],
			layerNodes: readonly CommandHandlerGraphNode[],
			layerEdges: readonly CommandHandlerGraphEdge[]
		): CommandHandlerGraphLayer => {
			const common = {
				capabilityStatus: COMMAND_HANDLER_GRAPH_CAPABILITY_STATUS,
				coverage,
				edgeIds: layerEdges.map((edge) => edge.id),
				graphId,
				id: layerId,
				limitations: COMMAND_HANDLER_GRAPH_LIMITATIONS.map((item) => ({ ...item })),
				method: COMMAND_HANDLER_GRAPH_METHOD,
				nodeIds: layerNodes.map((node) => node.id),
				producer: { ...snapshot.provider },
				provenanceIds: layerProvenance(layerNodes, layerEdges),
				registryStatus: COMMAND_HANDLER_GRAPH_REGISTRY_STATUS,
				semanticSnapshotId: snapshot.id,
				subjectId: snapshot.subjectId
			};
			return kind === 'JPWB_COMMAND_HANDLER_DERIVATION'
				? {
						...common,
						capability: COMMAND_HANDLER_GRAPH_DERIVATION_CAPABILITY,
						kind,
						ordinal: 0
					}
				: {
						...common,
						capability: COMMAND_HANDLER_GRAPH_INFERENCE_CAPABILITY,
						kind,
						ordinal: 1
					};
		};
		const layers = [
			makeLayer(
				derivationLayerId,
				'JPWB_COMMAND_HANDLER_DERIVATION',
				derivationNodes,
				derivationEdges
			),
			makeLayer(inferenceLayerId, 'JPWB_COMMAND_HANDLER_INFERENCE', inferenceNodes, inferenceEdges)
		] as const;
		progress.complete({
			candidateEdges,
			edges: edges.length,
			exactEdges,
			frontiers: frontiers.length,
			nodes: nodes.length
		});

		progress.start('SERIALIZE');
		const content = {
			arrowObservationId: observation.id,
			authorityTransfer: COMMAND_HANDLER_GRAPH_AUTHORITY_TRANSFER,
			baselineChange: COMMAND_HANDLER_GRAPH_BASELINE_CHANGE,
			budgets: { ...request.budgets },
			canonicalProfile: COMMAND_HANDLER_GRAPH_CANONICAL_PROFILE,
			capabilities: [
				COMMAND_HANDLER_GRAPH_DERIVATION_CAPABILITY,
				COMMAND_HANDLER_GRAPH_INFERENCE_CAPABILITY
			] as const,
			capabilityStatus: COMMAND_HANDLER_GRAPH_CAPABILITY_STATUS,
			commandDispatchCensusIntegration: COMMAND_HANDLER_GRAPH_COMMAND_DISPATCH_CENSUS_INTEGRATION,
			commandRegistry: { ...request.commandRegistry },
			coverage,
			edges,
			forwardIndex: makeIndexes(nodes, edges, 'FORWARD'),
			fullJanCsaa007Conformance: COMMAND_HANDLER_GRAPH_FULL_JAN_CSAA_007_CONFORMANCE,
			fullJanCsaa008Conformance: COMMAND_HANDLER_GRAPH_FULL_JAN_CSAA_008_CONFORMANCE,
			gateEffect: COMMAND_HANDLER_GRAPH_GATE_EFFECT,
			graphAuthority: COMMAND_HANDLER_GRAPH_GRAPH_AUTHORITY,
			graphInputDigest,
			graphKind: 'JPWB_COMMAND_HANDLER_STATIC_PROJECTION' as const,
			handlerRegistry: { ...request.handlerRegistry },
			health: 'PARTIAL' as const,
			id: graphId,
			integrationStrategy: COMMAND_HANDLER_GRAPH_INTEGRATION_STRATEGY,
			layers,
			limitations: COMMAND_HANDLER_GRAPH_LIMITATIONS.map((item) => ({ ...item })),
			method: COMMAND_HANDLER_GRAPH_METHOD,
			nodes,
			operationVersion: COMMAND_HANDLER_GRAPH_OPERATION_VERSION,
			oracleChange: COMMAND_HANDLER_GRAPH_ORACLE_CHANGE,
			producer: { ...snapshot.provider },
			registryStatus: COMMAND_HANDLER_GRAPH_REGISTRY_STATUS,
			replacementEquivalence: COMMAND_HANDLER_GRAPH_REPLACEMENT_EQUIVALENCE,
			retainedArrowVerifierAuthority: COMMAND_HANDLER_GRAPH_RETAINED_ARROW_VERIFIER_AUTHORITY,
			reverseIndex: makeIndexes(nodes, edges, 'REVERSE'),
			runtimeDispatchClosure: COMMAND_HANDLER_GRAPH_RUNTIME_DISPATCH_CLOSURE,
			runtimePerformability: COMMAND_HANDLER_GRAPH_RUNTIME_PERFORMABILITY,
			schemaVersion: COMMAND_HANDLER_GRAPH_SCHEMA_VERSION,
			scope: COMMAND_HANDLER_GRAPH_SCOPE,
			semanticExtractionVersion: snapshot.extractionVersion,
			semanticSchemaVersion: snapshot.schemaVersion,
			semanticSnapshotId: snapshot.id,
			subjectId: snapshot.subjectId
		};
		const graph = { ...content, contentDigest: commandHandlerGraphContentDigest(content) };
		const canonicalBytes = new TextEncoder().encode(JSON.stringify(graph)).byteLength;
		progress.complete({
			canonicalBytes
		});

		progress.start('GRAPH_VALIDATE', { edges: graph.edges.length, nodes: graph.nodes.length });
		const validation = validateConstructedCommandHandlerGraph(
			graph,
			snapshot,
			observation,
			subject,
			graphInputDigest,
			{
				maxIssues: 1_000,
				// These are validator traversal guards over the already materialized graph wire, not
				// aliases for the independent graph-population or consumed-source budgets.
				maxRecords: Math.max(1, canonicalBytes),
				maxStringCharacters: Math.max(1, canonicalBytes)
			}
		);
		if (validation.state !== 'VALID') {
			progress.fail('GRAPH_VALIDATION_FAILED');
			const issueSummary = validation.issues
				.slice(0, 3)
				.map((issue) => `${issue.code}@${issue.path}: ${issue.message}`)
				.join(', ');
			return unavailable(
				'GRAPH_VALIDATION_FAILED',
				`Constructed command-handler graph failed validation (${validation.state}${issueSummary.length === 0 ? '' : `: ${issueSummary}`}).`,
				'VALIDATE'
			);
		}
		progress.complete({ validationState: validation.state });
		return {
			diagnostics: [
				diagnostic(
					'GRAPH_PARTIAL',
					'The projection closes supported static command registrations while retaining explicit factory, arrow-attribution, and runtime frontiers.',
					'VALIDATE'
				)
			],
			graph,
			outcome: 'partial'
		};
	} catch (error) {
		const isBudget = error instanceof RangeError && /max[A-Z]/u.test(error.message);
		const code = isBudget ? 'BUDGET_EXCEEDED' : 'INPUT_INVALID';
		progress.fail(code);
		return unavailable(
			code,
			error instanceof Error ? error.message : 'Command-handler graph construction failed.',
			'CLASSIFY'
		);
	}
}
