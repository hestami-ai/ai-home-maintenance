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
	type CommandArrowSiteNode,
	type CommandHandlerFrontierKind,
	type CommandHandlerFrontierNode,
	type CommandHandlerGraphCoverage,
	type CommandHandlerGraphEdge,
	type CommandHandlerGraphIndexEntry,
	type CommandHandlerGraphLayer,
	type CommandHandlerGraphNode,
	type CommandHandlerGraphNodeId,
	type CommandHandlerGraphSnapshot,
	type CommandHandlerRegistrySelector,
	type HandlerTargetNode
} from '../contracts/command-handler-graph.js';
import type {
	SemanticAstNodeRecord,
	SemanticDeclarationRecord,
	SemanticInvocationSiteRecord,
	SemanticProvenanceId,
	SemanticReferenceRecord,
	SemanticSourceRecord,
	SemanticSourceId,
	SemanticSymbolId,
	SemanticSymbolRecord,
	StaticSemanticSnapshot
} from '../contracts/semantic.js';
import type { FrozenSubject } from '../contracts/subject.js';
import { compareText, sha256 } from '../inventory/canonical.js';
import { validateArrowCommandCensusObservation } from '../providers/jpwb-arrow-command-census/validate-arrow-command-census.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
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

export type CommandHandlerGraphValidationIssueCode =
	| 'ARROW_OBSERVATION_INVALID'
	| 'AUTHORITY_MISMATCH'
	| 'BUDGET_EXHAUSTED'
	| 'CONTENT_DIGEST_MISMATCH'
	| 'COVERAGE_MISMATCH'
	| 'DANGLING_ENDPOINT'
	| 'DANGLING_SEMANTIC_REFERENCE'
	| 'DUPLICATE_ID'
	| 'FIELD_SET_INVALID'
	| 'IDENTITY_MISMATCH'
	| 'INDEX_MISMATCH'
	| 'LIMITATION_MISMATCH'
	| 'ORDER_INVALID'
	| 'REGISTRY_POPULATION_MISMATCH'
	| 'SHAPE_INVALID'
	| 'SNAPSHOT_BINDING_MISMATCH'
	| 'SOURCE_BINDING_MISMATCH';

export interface CommandHandlerGraphValidationIssue {
	readonly code: CommandHandlerGraphValidationIssueCode;
	readonly message: string;
	readonly path: string;
}

export interface CommandHandlerGraphValidationOptions {
	/** Reporting budget only; it never makes an invalid graph valid. */
	readonly maxIssues?: number;
	/** Plain-data traversal budget applied before canonicalization or property reads. */
	readonly maxRecords?: number;
	/** Aggregate keys and string-value budget applied during plain-data traversal. */
	readonly maxStringCharacters?: number;
}

export type CommandHandlerGraphValidationResult =
	| { readonly issues: readonly []; readonly state: 'VALID' }
	| {
			readonly issues: readonly CommandHandlerGraphValidationIssue[];
			readonly state: 'BUDGET_EXHAUSTED' | 'INVALID';
	  };

const COMMAND_CATALOG_PATH = 'packages/rph-contracts/src/messages.ts';
const COMMAND_CATALOG_PROJECT = 'packages/rph-contracts/tsconfig.json';
const HANDLER_REGISTRY_PATH = 'packages/rph-application/src/handlers/registry.ts';
const HANDLER_REGISTRY_PROJECT = 'packages/rph-application/tsconfig.json';
const DOMAIN_PROJECT = 'packages/rph-domain/tsconfig.json';
const STEP_COMMAND_SPEC_PATH = 'packages/rph-domain/src/step-command-spec.ts';
const PWU_COMMAND_SPEC_PATH = 'packages/rph-domain/src/pwu-lifecycle-command-spec.ts';

const TOP_LEVEL_KEYS = [
	'arrowObservationId',
	'authorityTransfer',
	'baselineChange',
	'budgets',
	'canonicalProfile',
	'capabilities',
	'capabilityStatus',
	'commandDispatchCensusIntegration',
	'commandRegistry',
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
	'handlerRegistry',
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
	'retainedArrowVerifierAuthority',
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
const COVERAGE_KEYS = [
	'arrowAttributionClosure',
	'candidateEdges',
	'commandRegistryClosure',
	'commandsWithArrowEvidence',
	'commandsWithoutArrowEvidence',
	'directHandlerArrowSites',
	'discoveredArrowOccurrences',
	'discoveredArrowSites',
	'discoveredCommandRegistryEntries',
	'discoveredHandlerRegistryEntries',
	'edges',
	'exactCommandRegistrations',
	'exactEdges',
	'factorySharedArrowSites',
	'frontierNodes',
	'handlerTargets',
	'missingHandlerRegistrations',
	'reconciles',
	'representedArrowOccurrences',
	'representedArrowSites',
	'representedCommandRegistryEntries',
	'representedHandlerRegistryEntries',
	'tableCommandArrowSites',
	'undeclaredHandlerRegistrations'
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
	'registryStatus',
	'semanticSnapshotId',
	'subjectId'
] as const;
const COMMON_NODE_KEYS = [
	'graphId',
	'id',
	'kind',
	'layerId',
	'provenanceIds',
	'semanticSnapshotId',
	'sourceLocations',
	'subjectId'
] as const;
const COMMAND_NODE_KEYS = [
	...COMMON_NODE_KEYS,
	'commandName',
	'declarationId',
	'nameNodeId',
	'programId',
	'projectId',
	'propertyNodeId',
	'sourceId'
] as const;
const REGISTRATION_NODE_KEYS = [
	...COMMON_NODE_KEYS,
	'commandName',
	'handlerAliasSymbolId',
	'handlerName',
	'handlerTerminalSymbolId',
	'nameNodeId',
	'programId',
	'projectId',
	'propertyNodeId',
	'sourceId',
	'targetNodeId',
	'targetReferenceId'
] as const;
const TARGET_NODE_KEYS = [
	...COMMON_NODE_KEYS,
	'bodyKind',
	'declarationIds',
	'handlerName',
	'nodeId',
	'programId',
	'projectId',
	'sourceId',
	'symbolId'
] as const;
const SITE_NODE_KEYS = [
	...COMMON_NODE_KEYS,
	'attribution',
	'observationSiteId',
	'observationSource',
	'semanticSiteNodeId',
	'sourceId'
] as const;
const OCCURRENCE_NODE_KEYS = [
	...COMMON_NODE_KEYS,
	'arrowKey',
	'from',
	'machine',
	'observationArrowId',
	'observationSiteId',
	'ordinalAtSite',
	'to'
] as const;
const FRONTIER_NODE_KEYS = [...COMMON_NODE_KEYS, 'frontierKind', 'reason'] as const;
const EDGE_KEYS = [
	'attribution',
	'graphId',
	'id',
	'inferenceBasis',
	'layerId',
	'method',
	'provenanceIds',
	'relationCode',
	'relationKind',
	'semanticSnapshotId',
	'source',
	'sourceLocations',
	'subjectId',
	'target'
] as const;
const ENDPOINT_KEYS = ['kind', 'nodeId'] as const;
const INFERENCE_BASIS_KEYS = [
	'assumptions',
	'limitationKinds',
	'method',
	'rationale',
	'supportingInputIds'
] as const;
const INDEX_ENTRY_KEYS = ['edgeIds', 'nodeId'] as const;
const LOCATION_KEYS = ['end', 'sourceId', 'start'] as const;
const OBSERVATION_SOURCE_KEYS = ['line', 'locator', 'path'] as const;

const COMMAND_FRONTIERS = new Set<CommandHandlerFrontierKind>([
	'COMMAND_WITHOUT_DECLARED_ARROW_EVIDENCE',
	'MISSING_HANDLER_REGISTRATION'
]);
const REGISTRATION_FRONTIERS = new Set<CommandHandlerFrontierKind>([
	'FACTORY_HANDLER_TARGET_NOT_CONFIRMED',
	'UNDECLARED_HANDLER_REGISTRATION',
	'UNRESOLVED_HANDLER_TARGET'
]);
const SITE_FRONTIERS = new Set<CommandHandlerFrontierKind>([
	'FACTORY_SITE_ATTRIBUTION_AMBIGUOUS',
	'SITE_OWNER_NOT_REGISTERED_HANDLER'
]);
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

interface SemanticIndexes {
	readonly assignmentsByNode: ReadonlyMap<string, StaticSemanticSnapshot['assignments'][number][]>;
	readonly childrenByParent: ReadonlyMap<string, SemanticAstNodeRecord[]>;
	readonly declarationById: ReadonlyMap<string, SemanticDeclarationRecord>;
	readonly declarationsByNode: ReadonlyMap<string, SemanticDeclarationRecord[]>;
	readonly invocationByNode: ReadonlyMap<string, SemanticInvocationSiteRecord>;
	readonly nodeById: ReadonlyMap<string, SemanticAstNodeRecord>;
	readonly programById: ReadonlyMap<string, StaticSemanticSnapshot['programs'][number]>;
	readonly projectById: ReadonlyMap<string, StaticSemanticSnapshot['projects'][number]>;
	readonly provenanceIds: ReadonlySet<string>;
	readonly referencesByNode: ReadonlyMap<string, SemanticReferenceRecord[]>;
	readonly sourceById: ReadonlyMap<string, SemanticSourceRecord>;
	readonly symbolById: ReadonlyMap<string, SemanticSymbolRecord>;
}

interface RegistryFact {
	readonly commandName: string;
	readonly declaration: SemanticDeclarationRecord | null;
	readonly nameNode: SemanticAstNodeRecord;
	readonly propertyNode: SemanticAstNodeRecord;
	readonly source: SemanticSourceRecord;
	readonly valueNode: SemanticAstNodeRecord;
}

type RegistryFactSelector = Omit<CommandHandlerRegistrySelector, 'exportName'> & {
	readonly exportName: string;
};

interface HandlerFact {
	readonly aliasSymbolId: SemanticSymbolId | null;
	readonly bodyKind: HandlerTargetNode['bodyKind'] | null;
	readonly factoryCallableNodeId: string | null;
	readonly handlerName: string;
	readonly member: RegistryFact;
	readonly reference: SemanticReferenceRecord | null;
	readonly targetNode: SemanticAstNodeRecord | null;
	readonly terminalSymbol: SemanticSymbolRecord | null;
}

interface ExpectedSite {
	readonly attribution: CommandArrowSiteNode['attribution'];
	readonly directCommandNames: readonly string[];
	readonly factoryCommandNames: readonly string[];
	readonly node: SemanticAstNodeRecord | null;
	readonly provenanceIds: readonly SemanticProvenanceId[];
	readonly source: SemanticSourceRecord | null;
	readonly sourceLocations: CommandArrowSiteNode['sourceLocations'];
	readonly tableCommandName: string | null;
}

interface ValidationBudgets {
	readonly maxIssues: number;
	readonly maxRecords: number;
	readonly maxStringCharacters: number;
}

function exactKeys(value: object, expected: readonly string[]): boolean {
	const keys = Reflect.ownKeys(value);
	if (keys.length !== expected.length || keys.some((key) => typeof key !== 'string')) return false;
	const actual = (keys as string[]).sort(compareText);
	const wanted = [...expected].sort(compareText);
	return actual.every((key, index) => key === wanted[index]);
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

function plainObject(value: unknown): boolean {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		return false;
	const prototype = Reflect.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function materializeOptions(
	options: CommandHandlerGraphValidationOptions | undefined
): ValidationBudgets {
	if (options === undefined)
		return { maxIssues: 1_000, maxRecords: 10_000_000, maxStringCharacters: 1_000_000_000 };
	if (!plainObject(options))
		throw new TypeError('Validation options must be an exact plain record.');
	const allowed = new Set(['maxIssues', 'maxRecords', 'maxStringCharacters']);
	const optionKeys = Reflect.ownKeys(options);
	if (optionKeys.some((key) => typeof key !== 'string' || !allowed.has(key)))
		throw new TypeError('Validation options contain an unsupported field.');
	for (const key of optionKeys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(options, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new TypeError('Validation options must contain enumerable data properties only.');
	}
	const defaults = {
		maxIssues: 1_000,
		maxRecords: 10_000_000,
		maxStringCharacters: 1_000_000_000
	};
	const result = {
		maxIssues: options.maxIssues ?? defaults.maxIssues,
		maxRecords: options.maxRecords ?? defaults.maxRecords,
		maxStringCharacters: options.maxStringCharacters ?? defaults.maxStringCharacters
	};
	for (const [key, value] of Object.entries(result))
		if (!Number.isSafeInteger(value) || value < 1)
			throw new TypeError(`${key} must be a positive safe integer.`);
	return result;
}

/**
 * Inspects only own data descriptors. Accessors, Proxies, sparse arrays,
 * exotic prototypes, cycles, functions, symbols, and non-JSON numbers fail
 * before any canonicalizer or semantic validator can observe them.
 */
function inspectPlainData(
	value: unknown,
	limits: Pick<ValidationBudgets, 'maxRecords' | 'maxStringCharacters'>
): { readonly budget: boolean; readonly message: string; readonly path: string } | null {
	type Frame = { readonly exit: boolean; readonly path: string; readonly value: unknown };
	const pending: Frame[] = [{ exit: false, path: '$', value }];
	const active = new WeakSet<object>();
	let records = 0;
	let stringCharacters = 0;
	while (pending.length > 0) {
		const frame = pending.pop()!;
		const current = frame.value;
		if (frame.exit) {
			active.delete(current as object);
			continue;
		}
		records += 1;
		if (records > limits.maxRecords)
			return {
				budget: true,
				message: `Graph structural record budget exceeded: ${records} > ${limits.maxRecords}.`,
				path: frame.path
			};
		if (typeof current === 'string') {
			stringCharacters += current.length;
			if (stringCharacters > limits.maxStringCharacters)
				return {
					budget: true,
					message: `Graph string-character budget exceeded: ${stringCharacters} > ${limits.maxStringCharacters}.`,
					path: frame.path
				};
			continue;
		}
		if (
			current === null ||
			typeof current === 'boolean' ||
			(typeof current === 'number' && Number.isFinite(current))
		)
			continue;
		if (typeof current !== 'object')
			return { budget: false, message: 'Graph contains a non-JSON value.', path: frame.path };
		if (isProxy(current))
			return { budget: false, message: 'Graph contains a Proxy value.', path: frame.path };
		if (active.has(current))
			return { budget: false, message: 'Graph contains a cyclic container.', path: frame.path };
		const array = Array.isArray(current);
		const prototype = Reflect.getPrototypeOf(current);
		if (
			(array && prototype !== Array.prototype) ||
			(!array && prototype !== Object.prototype && prototype !== null)
		)
			return {
				budget: false,
				message: 'Graph containers must have plain prototypes.',
				path: frame.path
			};
		if (array && current.length > limits.maxRecords - records)
			return {
				budget: true,
				message: `Graph structural record budget cannot admit array population: ${current.length} elements exceed ${limits.maxRecords - records} remaining records.`,
				path: frame.path
			};
		const keys = Reflect.ownKeys(current);
		if (keys.some((key) => typeof key !== 'string'))
			return {
				budget: false,
				message: 'Graph containers may not have symbol keys.',
				path: frame.path
			};
		if (array) {
			const isDenseArrayKey = (key: PropertyKey): boolean => {
				if (key === 'length') return true;
				if (typeof key !== 'string') return false;
				const index = Number(key);
				return (
					Number.isSafeInteger(index) &&
					index >= 0 &&
					index < current.length &&
					String(index) === key
				);
			};
			if (keys.length !== current.length + 1 || keys.some((key) => !isDenseArrayKey(key)))
				return {
					budget: false,
					message: 'Graph arrays must be dense and may not carry extra properties.',
					path: frame.path
				};
		}
		active.add(current);
		pending.push({ exit: true, path: frame.path, value: current });
		for (const key of keys) {
			if (array && key === 'length') continue;
			const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
			if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable)
				return {
					budget: false,
					message: 'Graph properties must be enumerable data properties.',
					path: `${frame.path}.${String(key)}`
				};
			stringCharacters += String(key).length;
			if (stringCharacters > limits.maxStringCharacters)
				return {
					budget: true,
					message: `Graph string-character budget exceeded: ${stringCharacters} > ${limits.maxStringCharacters}.`,
					path: frame.path
				};
			pending.push({
				exit: false,
				path: array ? `${frame.path}[${String(key)}]` : `${frame.path}.${String(key)}`,
				value: descriptor.value
			});
		}
	}
	return null;
}

function semanticIndexes(snapshot: StaticSemanticSnapshot): SemanticIndexes {
	const uniqueMap = <T, Key extends string>(
		values: readonly T[],
		key: (value: T) => Key,
		population: string
	): Map<Key, T> => {
		const map = new Map(values.map((value) => [key(value), value]));
		if (map.size !== values.length)
			throw new Error(`Semantic ${population} identities are not unique.`);
		return map;
	};
	const nodeById = uniqueMap(snapshot.astNodes, (node) => node.id, 'AST node');
	const sourceById = uniqueMap(snapshot.sources, (source) => source.id, 'source');
	const declarationById = uniqueMap(
		snapshot.declarations,
		(declaration) => declaration.id,
		'declaration'
	);
	const symbolById = uniqueMap(snapshot.symbols, (symbol) => symbol.id, 'symbol');
	const invocationByNode = uniqueMap(
		snapshot.invocations,
		(invocation) => invocation.nodeId,
		'invocation'
	);
	const projectById = uniqueMap(snapshot.projects, (project) => project.id, 'project');
	const programById = uniqueMap(snapshot.programs, (program) => program.id, 'program');
	const provenanceIds = new Set(snapshot.provenances.map((provenance) => provenance.id));
	if (provenanceIds.size !== snapshot.provenances.length)
		throw new Error('Semantic provenance identities are not unique.');
	const childrenByParent = new Map<string, SemanticAstNodeRecord[]>();
	for (const node of snapshot.astNodes) {
		if (!sourceById.has(node.sourceId)) throw new Error(`AST node ${node.id} has no source.`);
		if (node.parentId !== null) {
			if (!nodeById.has(node.parentId)) throw new Error(`AST node ${node.id} has no parent node.`);
			addGrouped(childrenByParent, node.parentId, node);
		}
	}
	for (const children of childrenByParent.values())
		children.sort((a, b) => compareText(a.id, b.id));
	const assignmentsByNode = new Map<string, StaticSemanticSnapshot['assignments'][number][]>();
	for (const assignment of snapshot.assignments)
		addGrouped(assignmentsByNode, assignment.nodeId, assignment);
	const declarationsByNode = new Map<string, SemanticDeclarationRecord[]>();
	for (const declaration of snapshot.declarations) {
		if (!sourceById.has(declaration.sourceId))
			throw new Error(`Declaration ${declaration.id} has no source.`);
		if (declaration.nodeId !== null)
			addGrouped(declarationsByNode, declaration.nodeId, declaration);
	}
	const referencesByNode = new Map<string, SemanticReferenceRecord[]>();
	for (const reference of snapshot.references) {
		if (!sourceById.has(reference.sourceId) || !nodeById.has(reference.nodeId))
			throw new Error(`Reference ${reference.id} has a dangling source or node.`);
		addGrouped(referencesByNode, reference.nodeId, reference);
	}
	return {
		assignmentsByNode,
		childrenByParent,
		declarationById,
		declarationsByNode,
		invocationByNode,
		nodeById,
		programById,
		projectById,
		provenanceIds,
		referencesByNode,
		sourceById,
		symbolById
	};
}

function memberName(node: SemanticAstNodeRecord, snapshot: StaticSemanticSnapshot): string | null {
	if (node.syntacticIdentifierText !== null) return node.syntacticIdentifierText;
	const literals = snapshot.literals.filter(
		(literal) =>
			literal.nodeId === node.id &&
			literal.valueState === 'EXACT' &&
			typeof literal.value === 'string'
	);
	return literals.length === 1 ? (literals[0]!.value as string) : null;
}

function unwrapRegistryObjectLiteral(
	model: SemanticIndexes,
	initialNode: SemanticAstNodeRecord | undefined
): SemanticAstNodeRecord | undefined {
	let node = initialNode;
	while (node !== undefined && TRANSPARENT_EXPRESSION_KINDS.has(node.kind)) {
		const expressionChildren = (model.childrenByParent.get(node.id) ?? []).filter(
			(child) =>
				child.kind === ts.SyntaxKind.ObjectLiteralExpression ||
				TRANSPARENT_EXPRESSION_KINDS.has(child.kind)
		);
		if (expressionChildren.length !== 1) return undefined;
		node = expressionChildren[0];
	}
	return node?.kind === ts.SyntaxKind.ObjectLiteralExpression ? node : undefined;
}

function registryFacts(
	snapshot: StaticSemanticSnapshot,
	model: SemanticIndexes,
	selector: RegistryFactSelector
): RegistryFact[] {
	const independentlySelectedSources = snapshot.sources.filter(
		(source) =>
			source.logicalPath === selector.logicalPath &&
			model.projectById.get(source.projectId)?.configPath === selector.projectConfigPath &&
			source.analysisDisposition === 'DEEP_INDEXED'
	);
	const source = model.sourceById.get(selector.sourceId);
	const project = model.projectById.get(selector.projectId);
	const program = model.programById.get(selector.programId);
	const declaration = model.declarationById.get(selector.declarationId);
	const independentlySelectedDeclarations = snapshot.declarations.filter(
		(candidate) =>
			candidate.sourceId === selector.sourceId &&
			candidate.name === selector.exportName &&
			candidate.nodeId !== null &&
			candidate.kind === ts.SyntaxKind.VariableDeclaration
	);
	if (
		independentlySelectedSources.length !== 1 ||
		independentlySelectedSources[0]?.id !== selector.sourceId ||
		independentlySelectedDeclarations.length !== 1 ||
		independentlySelectedDeclarations[0]?.id !== selector.declarationId ||
		source === undefined ||
		project === undefined ||
		program === undefined ||
		declaration === undefined ||
		source.logicalPath !== selector.logicalPath ||
		source.contentSha256 !== selector.contentSha256 ||
		source.projectId !== selector.projectId ||
		source.programId !== selector.programId ||
		project.configPath !== selector.projectConfigPath ||
		program.projectId !== selector.projectId ||
		source.analysisDisposition !== 'DEEP_INDEXED' ||
		declaration.sourceId !== selector.sourceId ||
		declaration.name !== selector.exportName ||
		declaration.nodeId === null ||
		declaration.kind !== ts.SyntaxKind.VariableDeclaration
	)
		throw new Error(
			`Registry selector ${selector.exportName} does not bind one exact semantic declaration.`
		);
	const initializerAssignments = (model.assignmentsByNode.get(declaration.nodeId) ?? []).filter(
		(assignment) => assignment.assignmentKind === 'INITIALIZER' && assignment.valueNodeId !== null
	);
	if (initializerAssignments.length !== 1)
		throw new Error(`Registry ${selector.exportName} must have one normalized initializer.`);
	const objectNode = unwrapRegistryObjectLiteral(
		model,
		model.nodeById.get(initializerAssignments[0]!.valueNodeId!)
	);
	if (objectNode === undefined)
		throw new Error(`Registry ${selector.exportName} initializer is not an object literal.`);
	const properties = model.childrenByParent.get(objectNode.id) ?? [];
	if (properties.some((node) => node.kind !== ts.SyntaxKind.PropertyAssignment))
		throw new Error(`Registry ${selector.exportName} has an unsupported member form.`);
	const facts = properties.map((propertyNode): RegistryFact => {
		const assignments = (model.assignmentsByNode.get(propertyNode.id) ?? []).filter(
			(assignment) => assignment.assignmentKind === 'INITIALIZER' && assignment.valueNodeId !== null
		);
		if (assignments.length !== 1)
			throw new Error(`Registry member ${propertyNode.id} has no exact normalized binding.`);
		const nameNode = model.nodeById.get(assignments[0]!.targetNodeId);
		const valueNode = model.nodeById.get(assignments[0]!.valueNodeId!);
		if (nameNode === undefined || valueNode === undefined)
			throw new Error(`Registry member ${propertyNode.id} has a dangling endpoint.`);
		const commandName = memberName(nameNode, snapshot);
		if (commandName === null || commandName.length === 0)
			throw new Error(`Registry member ${propertyNode.id} has an unsupported computed name.`);
		const declarations = model.declarationsByNode.get(propertyNode.id) ?? [];
		if (declarations.length > 1)
			throw new Error(`Registry member ${commandName} has ambiguous declarations.`);
		return {
			commandName,
			declaration: declarations[0] ?? null,
			nameNode,
			propertyNode,
			source,
			valueNode
		};
	});
	const names = facts.map((fact) => fact.commandName);
	if (new Set(names).size !== names.length)
		throw new Error(`Registry ${selector.exportName} contains duplicate command names.`);
	return facts.sort((left, right) => compareText(left.commandName, right.commandName));
}

function assertFrozenSourceBinding(subject: FrozenSubject, source: SemanticSourceRecord): void {
	const artifacts = subject.artifacts.filter((artifact) => artifact.path === source.logicalPath);
	if (artifacts.length !== 1)
		throw new Error(`Frozen source ${source.logicalPath} is not represented exactly once.`);
	const bytes = readFrozenSubjectArtifact(subject, source.logicalPath);
	if (
		bytes === undefined ||
		bytes.byteLength !== source.bytes ||
		bytes.byteLength !== artifacts[0]!.bytes ||
		sha256(bytes) !== source.contentSha256 ||
		sha256(bytes) !== artifacts[0]!.sha256
	)
		throw new Error(`Frozen source ${source.logicalPath} does not match semantic identity.`);
}

function callableFromDeclaration(
	declaration: SemanticDeclarationRecord,
	model: SemanticIndexes
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

function handlerFacts(members: readonly RegistryFact[], model: SemanticIndexes): HandlerFact[] {
	return members.map((member): HandlerFact => {
		const handlerName = member.valueNode.syntacticIdentifierText;
		if (handlerName === null)
			return {
				aliasSymbolId: null,
				bodyKind: null,
				factoryCallableNodeId: null,
				handlerName: '<unsupported>',
				member,
				reference: null,
				targetNode: null,
				terminalSymbol: null
			};
		const references = (model.referencesByNode.get(member.valueNode.id) ?? []).filter(
			(reference) => reference.role === 'SYMBOL_USE' || reference.role === 'IMPORT_EXPORT_BINDING'
		);
		const resolved = references.filter((reference) => reference.resolvedSymbolId !== null);
		if (resolved.length !== 1)
			return {
				aliasSymbolId: null,
				bodyKind: null,
				factoryCallableNodeId: null,
				handlerName,
				member,
				reference: references.length === 1 ? references[0]! : null,
				targetNode: null,
				terminalSymbol: null
			};
		const reference = resolved[0]!;
		const aliasSymbolId = reference.symbolId;
		const terminalSymbol = model.symbolById.get(reference.resolvedSymbolId!);
		if (terminalSymbol === undefined)
			return {
				aliasSymbolId,
				bodyKind: null,
				factoryCallableNodeId: null,
				handlerName,
				member,
				reference,
				targetNode: null,
				terminalSymbol: null
			};
		const declarations = terminalSymbol.declarationIds
			.map((id) => model.declarationById.get(id))
			.filter((item): item is SemanticDeclarationRecord => item !== undefined);
		const callables = declarations
			.map((declaration) => callableFromDeclaration(declaration, model))
			.filter((item): item is SemanticAstNodeRecord => item !== null);
		if (callables.length === 1)
			return {
				aliasSymbolId,
				bodyKind: 'DIRECT_FUNCTION',
				factoryCallableNodeId: null,
				handlerName,
				member,
				reference,
				targetNode: callables[0]!,
				terminalSymbol
			};
		const initializers = declarations.flatMap((declaration) =>
			declaration.nodeId === null
				? []
				: (model.assignmentsByNode.get(declaration.nodeId) ?? []).filter(
						(assignment) =>
							assignment.assignmentKind === 'INITIALIZER' && assignment.valueNodeId !== null
					)
		);
		if (initializers.length === 1) {
			const invocation = model.invocationByNode.get(initializers[0]!.valueNodeId!);
			const valueNode = model.nodeById.get(initializers[0]!.valueNodeId!);
			if (invocation !== undefined && valueNode?.kind === ts.SyntaxKind.CallExpression) {
				const factoryReferences = (
					model.referencesByNode.get(invocation.calleeNodeId) ?? []
				).filter((item) => item.resolvedSymbolId !== null);
				if (factoryReferences.length === 1) {
					const factorySymbol = model.symbolById.get(factoryReferences[0]!.resolvedSymbolId!);
					const factoryCallables =
						factorySymbol?.declarationIds
							.map((id) => model.declarationById.get(id))
							.filter((item): item is SemanticDeclarationRecord => item !== undefined)
							.map((item) => callableFromDeclaration(item, model))
							.filter((item): item is SemanticAstNodeRecord => item !== null) ?? [];
					if (factoryCallables.length === 1)
						return {
							aliasSymbolId,
							bodyKind: 'FACTORY_CALL_RESULT_CANDIDATE',
							factoryCallableNodeId: factoryCallables[0]!.id,
							handlerName,
							member,
							reference,
							targetNode: valueNode,
							terminalSymbol
						};
				}
			}
		}
		return {
			aliasSymbolId,
			bodyKind: null,
			factoryCallableNodeId: null,
			handlerName,
			member,
			reference,
			targetNode: null,
			terminalSymbol
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
		if (body.byteLength % 2 !== 0) throw new Error('UTF-16LE source has an odd byte count.');
		return new TextDecoder('utf-16le', { fatal: true, ignoreBOM: true }).decode(body);
	}
	if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
		const body = bytes.subarray(2);
		if (body.byteLength % 2 !== 0) throw new Error('UTF-16BE source has an odd byte count.');
		return new TextDecoder('utf-16be', { fatal: true, ignoreBOM: true }).decode(body);
	}
	const body =
		bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
			? bytes.subarray(3)
			: bytes;
	return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(body);
}

function lineAt(text: string, position: number): number {
	let line = 1;
	for (let index = 0; index < position; index += 1) if (text.charCodeAt(index) === 10) line += 1;
	return line;
}

function callableAncestors(
	node: SemanticAstNodeRecord,
	model: SemanticIndexes
): SemanticAstNodeRecord[] {
	const out: SemanticAstNodeRecord[] = [];
	let parentId = node.parentId;
	const seen = new Set<string>();
	while (parentId !== null) {
		if (seen.has(parentId)) throw new Error('Semantic AST parent chain is cyclic.');
		seen.add(parentId);
		const parent = model.nodeById.get(parentId);
		if (parent === undefined) throw new Error(`Semantic AST parent ${parentId} is absent.`);
		if (CALLABLE_KINDS.has(parent.kind)) out.push(parent);
		parentId = parent.parentId;
	}
	return out;
}

function exactSelector(
	selector: CommandHandlerRegistrySelector,
	exportName: 'COMMANDS' | 'HANDLERS'
): boolean {
	return (
		plainObject(selector) &&
		exactKeys(selector, SELECTOR_KEYS) &&
		selector.exportName === exportName &&
		selector.logicalPath ===
			(exportName === 'COMMANDS' ? COMMAND_CATALOG_PATH : HANDLER_REGISTRY_PATH) &&
		selector.projectConfigPath ===
			(exportName === 'COMMANDS' ? COMMAND_CATALOG_PROJECT : HANDLER_REGISTRY_PROJECT) &&
		/^[a-f0-9]{64}$/u.test(selector.contentSha256)
	);
}

function expectedIndexes(
	nodes: readonly CommandHandlerGraphNode[],
	edges: readonly CommandHandlerGraphEdge[],
	direction: 'FORWARD' | 'REVERSE'
): CommandHandlerGraphIndexEntry[] {
	const grouped = new Map(nodes.map((node) => [node.id, [] as CommandHandlerGraphEdge['id'][]]));
	for (const edge of edges) {
		const endpoint = direction === 'FORWARD' ? edge.source.nodeId : edge.target.nodeId;
		grouped.get(endpoint)?.push(edge.id);
	}
	return [...grouped.entries()]
		.map(([nodeId, edgeIds]) => ({ edgeIds: edgeIds.sort(compareText), nodeId }))
		.sort((left, right) => compareText(left.nodeId, right.nodeId));
}

function locationsForNode(
	node: SemanticAstNodeRecord,
	sourceId: SemanticSourceId
): readonly {
	readonly end: number;
	readonly sourceId: SemanticSourceId;
	readonly start: number;
}[] {
	return [{ end: node.end, sourceId, start: node.start }];
}

function expectedSites(
	snapshot: StaticSemanticSnapshot,
	observation: ArrowCommandCensusObservation,
	subject: FrozenSubject,
	model: SemanticIndexes,
	handlers: readonly HandlerFact[],
	commands: ReadonlySet<string>
): ReadonlyMap<string, ExpectedSite> {
	const directByCallable = new Map<string, string[]>();
	const factoryByCallable = new Map<string, string[]>();
	for (const handler of handlers) {
		if (handler.bodyKind === 'DIRECT_FUNCTION' && handler.targetNode !== null)
			addGrouped(directByCallable, handler.targetNode.id, handler.member.commandName);
		if (handler.factoryCallableNodeId !== null)
			addGrouped(factoryByCallable, handler.factoryCallableNodeId, handler.member.commandName);
	}
	type TableName = 'STEP_COMMAND_SPECS' | 'PWU_LIFECYCLE_COMMAND_SPECS';
	type TableRegistry = {
		readonly members: ReadonlyMap<string, RegistryFact>;
		readonly source: SemanticSourceRecord;
	};
	const tableRegistry = (tableName: TableName, logicalPath: string): TableRegistry | null => {
		if (!observation.declaredSites.some((site) => site.source.locator.startsWith(`${tableName}.`)))
			return null;
		const sources = snapshot.sources.filter(
			(source) =>
				source.logicalPath === logicalPath &&
				model.projectById.get(source.projectId)?.configPath === DOMAIN_PROJECT &&
				source.analysisDisposition === 'DEEP_INDEXED'
		);
		if (sources.length !== 1) return null;
		const source = sources[0]!;
		assertFrozenSourceBinding(subject, source);
		const declarations = snapshot.declarations.filter(
			(declaration) =>
				declaration.sourceId === source.id &&
				declaration.name === tableName &&
				declaration.nodeId !== null &&
				declaration.kind === ts.SyntaxKind.VariableDeclaration
		);
		if (declarations.length !== 1)
			throw new Error(`Registry ${tableName} does not bind one exact semantic declaration.`);
		const members = registryFacts(snapshot, model, {
			contentSha256: source.contentSha256,
			declarationId: declarations[0]!.id,
			exportName: tableName,
			logicalPath,
			programId: source.programId,
			projectConfigPath: DOMAIN_PROJECT,
			projectId: source.projectId,
			sourceId: source.id
		});
		return { members: new Map(members.map((member) => [member.commandName, member])), source };
	};
	const tableRegistries = new Map<TableName, TableRegistry | null>([
		['STEP_COMMAND_SPECS', tableRegistry('STEP_COMMAND_SPECS', STEP_COMMAND_SPEC_PATH)],
		[
			'PWU_LIFECYCLE_COMMAND_SPECS',
			tableRegistry('PWU_LIFECYCLE_COMMAND_SPECS', PWU_COMMAND_SPEC_PATH)
		]
	]);
	const sourceText = new Map<string, string>();
	const textFor = (source: SemanticSourceRecord): string => {
		const cached = sourceText.get(source.id);
		if (cached !== undefined) return cached;
		assertFrozenSourceBinding(subject, source);
		const bytes = readFrozenSubjectArtifact(subject, source.logicalPath);
		if (bytes === undefined) throw new Error(`Frozen source ${source.logicalPath} is unavailable.`);
		if (bytes.byteLength !== source.bytes || sha256(bytes) !== source.contentSha256)
			throw new Error(`Frozen source ${source.logicalPath} differs from semantic identity.`);
		const text = decodeCompilerText(bytes);
		if (text.length !== source.textLength)
			throw new Error(`Frozen source ${source.logicalPath} differs from semantic text length.`);
		sourceText.set(source.id, text);
		return text;
	};
	const byId = new Map<string, ExpectedSite>();
	for (const site of observation.declaredSites) {
		const table = /^(STEP_COMMAND_SPECS|PWU_LIFECYCLE_COMMAND_SPECS)\.([^\s.]+)$/u.exec(
			site.source.locator
		);
		if (table !== null) {
			const tableName = table[1] as TableName;
			const commandName = table[2]!;
			const registry = tableRegistries.get(tableName) ?? null;
			const source = registry?.source ?? null;
			const member = registry?.members.get(commandName) ?? null;
			const exact = commands.has(commandName) && source !== null && member !== null;
			byId.set(site.id, {
				attribution: exact ? 'TABLE_COMMAND' : 'UNRESOLVED',
				directCommandNames: [],
				factoryCommandNames: [],
				node: member?.propertyNode ?? null,
				provenanceIds: source === null ? [] : sourceProvenance(source),
				source,
				sourceLocations:
					source === null || member === null
						? []
						: locationsForNode(member.propertyNode, source.id),
				tableCommandName: exact ? commandName : null
			});
			continue;
		}
		let source: SemanticSourceRecord | null = null;
		let invocationNode: SemanticAstNodeRecord | null = null;
		let attribution: CommandArrowSiteNode['attribution'] = 'UNRESOLVED';
		let directCommandNames: string[] = [];
		let factoryCommandNames: string[] = [];
		if (site.source.path !== null && site.source.line !== null) {
			const candidates = snapshot.sources.filter(
				(item) =>
					item.logicalPath === site.source.path &&
					model.projectById.get(item.projectId)?.configPath === HANDLER_REGISTRY_PROJECT &&
					item.analysisDisposition === 'DEEP_INDEXED'
			);
			if (candidates.length === 1) {
				source = candidates[0]!;
				const text = textFor(source);
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
						const direct = directByCallable.get(ancestors[0]?.id ?? '') ?? [];
						if (direct.length > 0) {
							attribution = 'DIRECT_HANDLER';
							directCommandNames = sortedUnique(direct);
						} else {
							factoryCommandNames = sortedUnique(
								ancestors.flatMap((ancestor) => factoryByCallable.get(ancestor.id) ?? [])
							);
							if (factoryCommandNames.length > 0) attribution = 'FACTORY_SHARED';
						}
					}
				}
			}
		}
		byId.set(site.id, {
			attribution,
			directCommandNames,
			factoryCommandNames,
			node: invocationNode,
			provenanceIds: source === null ? [] : sourceProvenance(source),
			source,
			sourceLocations:
				invocationNode === null || source === null
					? []
					: locationsForNode(invocationNode, source.id),
			tableCommandName: null
		});
	}
	if (byId.size !== observation.declaredSites.length)
		throw new Error('Arrow observation site identities are not unique.');
	return byId;
}

function frontierAnchor(node: CommandHandlerFrontierNode): {
	readonly anchorId: CommandHandlerGraphNodeId;
	readonly field: 'commandNodeId' | 'registrationNodeId' | 'siteNodeId';
} | null {
	if (COMMAND_FRONTIERS.has(node.frontierKind) && 'commandNodeId' in node)
		return { anchorId: node.commandNodeId, field: 'commandNodeId' };
	if (REGISTRATION_FRONTIERS.has(node.frontierKind) && 'registrationNodeId' in node)
		return { anchorId: node.registrationNodeId, field: 'registrationNodeId' };
	if (SITE_FRONTIERS.has(node.frontierKind) && 'siteNodeId' in node)
		return { anchorId: node.siteNodeId, field: 'siteNodeId' };
	return null;
}

function exactNodeKeys(node: CommandHandlerGraphNode): readonly string[] {
	switch (node.kind) {
		case 'COMMAND_REGISTRY_ENTRY':
			return COMMAND_NODE_KEYS;
		case 'HANDLER_REGISTRATION':
			return REGISTRATION_NODE_KEYS;
		case 'HANDLER_TARGET':
			return TARGET_NODE_KEYS;
		case 'DECLARED_ARROW_SITE':
			return SITE_NODE_KEYS;
		case 'DECLARED_ARROW_OCCURRENCE':
			return OCCURRENCE_NODE_KEYS;
		case 'FRONTIER': {
			const anchor = frontierAnchor(node);
			return anchor === null ? FRONTIER_NODE_KEYS : [...FRONTIER_NODE_KEYS, anchor.field];
		}
	}
}

function exactLayerForNode(
	node: CommandHandlerGraphNode,
	derivationLayerId: string,
	inferenceLayerId: string
): string {
	return node.kind === 'FRONTIER' ||
		(node.kind === 'HANDLER_TARGET' && node.bodyKind === 'FACTORY_CALL_RESULT_CANDIDATE')
		? inferenceLayerId
		: derivationLayerId;
}

function expectedEdgeRelation(
	edge: Pick<CommandHandlerGraphEdge, 'relationKind'>
): CommandHandlerGraphEdge['relationCode'] {
	switch (edge.relationKind) {
		case 'COMMAND_REGISTRY_ENTRY_TO_HANDLER_REGISTRATION':
			return 'IMPL-JPWB-CH-COMMAND-REGISTRATION-001';
		case 'HANDLER_REGISTRATION_TO_TARGET':
			return 'IMPL-JPWB-CH-REGISTRATION-TARGET-001';
		case 'HANDLER_TARGET_TO_ARROW_SITE':
			return 'IMPL-JPWB-CH-TARGET-ARROW-SITE-001';
		case 'COMMAND_REGISTRY_ENTRY_TO_TABLE_ARROW_SITE':
			return 'IMPL-JPWB-CH-COMMAND-TABLE-SITE-001';
		case 'ARROW_SITE_TO_OCCURRENCE':
			return 'IMPL-JPWB-CH-SITE-ARROW-001';
	}
}

function inferredEdgeKey(edge: CommandHandlerGraphEdge): string {
	return `${edge.relationKind}\0${edge.attribution}\0${edge.source.nodeId}\0${edge.target.nodeId}`;
}

const FRONTIER_REASONS: Readonly<Record<CommandHandlerFrontierKind, string>> = {
	COMMAND_WITHOUT_DECLARED_ARROW_EVIDENCE:
		'The retained arrow census reports no attributable transition declaration for this command; no absence-of-effect conclusion follows.',
	FACTORY_HANDLER_TARGET_NOT_CONFIRMED:
		'The registry initializer is a factory call; its returned callable is represented only as a candidate target.',
	FACTORY_SITE_ATTRIBUTION_AMBIGUOUS:
		'The retained site is inside a shared factory and pooled arrow ranges cannot be partitioned among factory instances.',
	MISSING_HANDLER_REGISTRATION: 'The declared command has no static HANDLERS registry entry.',
	SITE_OWNER_NOT_REGISTERED_HANDLER:
		'The retained source site does not resolve to one supported registered handler or exact command table entry.',
	UNDECLARED_HANDLER_REGISTRATION: 'The HANDLERS registry entry has no declared COMMANDS key.',
	UNRESOLVED_HANDLER_TARGET:
		'The registered handler does not resolve to one supported normalized callable target.'
};

interface ExpectedFrontier {
	readonly anchorField: 'commandNodeId' | 'registrationNodeId' | 'siteNodeId';
	readonly anchorId: CommandHandlerGraphNodeId;
	readonly frontierKind: CommandHandlerFrontierKind;
	readonly provenanceIds: readonly SemanticProvenanceId[];
	readonly reason: string;
	readonly sourceLocations: CommandHandlerFrontierNode['sourceLocations'];
}

function expectedFrontiers(input: {
	readonly commandNodes: ReadonlyMap<
		string,
		Extract<CommandHandlerGraphNode, { kind: 'COMMAND_REGISTRY_ENTRY' }>
	>;
	readonly commandsWithEvidence: ReadonlySet<string>;
	readonly handlerFacts: readonly HandlerFact[];
	readonly registrationNodes: ReadonlyMap<
		string,
		Extract<CommandHandlerGraphNode, { kind: 'HANDLER_REGISTRATION' }>
	>;
	readonly siteNodes: ReadonlyMap<
		string,
		Extract<CommandHandlerGraphNode, { kind: 'DECLARED_ARROW_SITE' }>
	>;
	readonly sites: ReadonlyMap<string, ExpectedSite>;
}): ExpectedFrontier[] {
	const out: ExpectedFrontier[] = [];
	const add = (
		frontierKind: CommandHandlerFrontierKind,
		anchorField: ExpectedFrontier['anchorField'],
		anchor: CommandHandlerGraphNode
	): void => {
		out.push({
			anchorField,
			anchorId: anchor.id,
			frontierKind,
			provenanceIds: anchor.provenanceIds,
			reason: FRONTIER_REASONS[frontierKind],
			sourceLocations: anchor.sourceLocations
		});
	};
	for (const [name, command] of input.commandNodes) {
		if (!input.registrationNodes.has(name))
			add('MISSING_HANDLER_REGISTRATION', 'commandNodeId', command);
		if (!input.commandsWithEvidence.has(name))
			add('COMMAND_WITHOUT_DECLARED_ARROW_EVIDENCE', 'commandNodeId', command);
	}
	for (const fact of input.handlerFacts) {
		const registration = input.registrationNodes.get(fact.member.commandName);
		if (registration === undefined) continue;
		if (!input.commandNodes.has(fact.member.commandName))
			add('UNDECLARED_HANDLER_REGISTRATION', 'registrationNodeId', registration);
		if (fact.bodyKind === null)
			add('UNRESOLVED_HANDLER_TARGET', 'registrationNodeId', registration);
		if (fact.bodyKind === 'FACTORY_CALL_RESULT_CANDIDATE')
			add('FACTORY_HANDLER_TARGET_NOT_CONFIRMED', 'registrationNodeId', registration);
	}
	for (const [siteId, fact] of input.sites) {
		const site = input.siteNodes.get(siteId);
		if (site === undefined) continue;
		if (fact.attribution === 'FACTORY_SHARED')
			add('FACTORY_SITE_ATTRIBUTION_AMBIGUOUS', 'siteNodeId', site);
		if (
			fact.attribution === 'UNRESOLVED' ||
			(fact.attribution === 'TABLE_COMMAND' && fact.tableCommandName === null)
		)
			add('SITE_OWNER_NOT_REGISTERED_HANDLER', 'siteNodeId', site);
	}
	return out;
}

function validateCommandHandlerGraphInternal(
	value: unknown,
	snapshot: StaticSemanticSnapshot,
	observation: ArrowCommandCensusObservation,
	subject: FrozenSubject,
	expectedInputDigest: string,
	options?: CommandHandlerGraphValidationOptions
): CommandHandlerGraphValidationResult {
	let limits: ValidationBudgets;
	try {
		limits = materializeOptions(options);
	} catch (error) {
		return {
			issues: [
				{
					code: 'SHAPE_INVALID',
					message: error instanceof Error ? error.message : 'Validation options are invalid.',
					path: '$validationOptions'
				}
			],
			state: 'INVALID'
		};
	}
	const issues: CommandHandlerGraphValidationIssue[] = [];
	const add = (
		code: CommandHandlerGraphValidationIssueCode,
		message: string,
		path: string
	): void => {
		if (issues.length < limits.maxIssues) issues.push({ code, message, path });
	};
	try {
		const inspected = inspectPlainData(value, limits);
		if (inspected !== null) {
			add(
				inspected.budget ? 'BUDGET_EXHAUSTED' : 'SHAPE_INVALID',
				inspected.message,
				inspected.path
			);
			return {
				issues,
				state: inspected.budget ? 'BUDGET_EXHAUSTED' : 'INVALID'
			};
		}
		if (!plainObject(value)) {
			add('SHAPE_INVALID', 'Graph must be a plain data object.', '$');
			return { issues, state: 'INVALID' };
		}
		if (!exactKeys(value as object, TOP_LEVEL_KEYS))
			add('FIELD_SET_INVALID', 'Graph field population is not exact.', '$');
		const graph = value as unknown as CommandHandlerGraphSnapshot;
		if (
			!Array.isArray(graph.nodes) ||
			!Array.isArray(graph.edges) ||
			!Array.isArray(graph.layers) ||
			!Array.isArray(graph.forwardIndex) ||
			!Array.isArray(graph.reverseIndex) ||
			!Array.isArray(graph.limitations) ||
			!Array.isArray(graph.capabilities)
		) {
			add('SHAPE_INVALID', 'Graph populations must be arrays.', '$');
			return { issues, state: 'INVALID' };
		}
		if (
			graph.subjectId !== snapshot.subjectId ||
			graph.subjectId !== observation.subjectId ||
			graph.subjectId !== subject.descriptor.subjectId ||
			graph.semanticSnapshotId !== snapshot.id ||
			graph.arrowObservationId !== observation.id ||
			graph.semanticSchemaVersion !== snapshot.schemaVersion ||
			graph.semanticExtractionVersion !== snapshot.extractionVersion
		)
			add(
				'SNAPSHOT_BINDING_MISMATCH',
				'Graph, semantic snapshot, arrow observation, and frozen subject identities do not agree.',
				'$'
			);
		const observationValidation = validateArrowCommandCensusObservation(observation, subject, {
			maxIssues: 1
		});
		if (observationValidation.state !== 'VALID')
			add(
				'ARROW_OBSERVATION_INVALID',
				observationValidation.issues[0]?.message ?? 'Arrow observation validation failed.',
				'$validationInput.arrowObservation'
			);
		if (!plainObject(graph.budgets) || !exactKeys(graph.budgets, BUDGET_KEYS))
			add('FIELD_SET_INVALID', 'Graph budgets are not an exact record.', '$.budgets');
		else
			for (const key of BUDGET_KEYS)
				if (!Number.isSafeInteger(graph.budgets[key]) || graph.budgets[key] < 1)
					add('SHAPE_INVALID', 'Budget must be a positive safe integer.', `$.budgets.${key}`);
		if (!exactSelector(graph.commandRegistry, 'COMMANDS'))
			add('SOURCE_BINDING_MISMATCH', 'COMMANDS selector is not exact.', '$.commandRegistry');
		if (!exactSelector(graph.handlerRegistry, 'HANDLERS'))
			add('SOURCE_BINDING_MISMATCH', 'HANDLERS selector is not exact.', '$.handlerRegistry');
		if (
			graph.canonicalProfile !== COMMAND_HANDLER_GRAPH_CANONICAL_PROFILE ||
			graph.capabilityStatus !== COMMAND_HANDLER_GRAPH_CAPABILITY_STATUS ||
			graph.graphKind !== 'JPWB_COMMAND_HANDLER_STATIC_PROJECTION' ||
			graph.health !== 'PARTIAL' ||
			graph.method !== COMMAND_HANDLER_GRAPH_METHOD ||
			graph.operationVersion !== COMMAND_HANDLER_GRAPH_OPERATION_VERSION ||
			graph.schemaVersion !== COMMAND_HANDLER_GRAPH_SCHEMA_VERSION ||
			!same(graph.capabilities, [
				COMMAND_HANDLER_GRAPH_DERIVATION_CAPABILITY,
				COMMAND_HANDLER_GRAPH_INFERENCE_CAPABILITY
			]) ||
			graph.registryStatus !== COMMAND_HANDLER_GRAPH_REGISTRY_STATUS ||
			graph.scope !== COMMAND_HANDLER_GRAPH_SCOPE
		)
			add('IDENTITY_MISMATCH', 'Graph profile or capability metadata is invalid.', '$');
		if (
			graph.retainedArrowVerifierAuthority !==
				COMMAND_HANDLER_GRAPH_RETAINED_ARROW_VERIFIER_AUTHORITY ||
			graph.graphAuthority !== COMMAND_HANDLER_GRAPH_GRAPH_AUTHORITY ||
			graph.authorityTransfer !== COMMAND_HANDLER_GRAPH_AUTHORITY_TRANSFER ||
			graph.integrationStrategy !== COMMAND_HANDLER_GRAPH_INTEGRATION_STRATEGY ||
			graph.gateEffect !== COMMAND_HANDLER_GRAPH_GATE_EFFECT ||
			graph.oracleChange !== COMMAND_HANDLER_GRAPH_ORACLE_CHANGE ||
			graph.baselineChange !== COMMAND_HANDLER_GRAPH_BASELINE_CHANGE ||
			graph.replacementEquivalence !== COMMAND_HANDLER_GRAPH_REPLACEMENT_EQUIVALENCE ||
			graph.commandDispatchCensusIntegration !==
				COMMAND_HANDLER_GRAPH_COMMAND_DISPATCH_CENSUS_INTEGRATION ||
			graph.runtimeDispatchClosure !== COMMAND_HANDLER_GRAPH_RUNTIME_DISPATCH_CLOSURE ||
			graph.runtimePerformability !== COMMAND_HANDLER_GRAPH_RUNTIME_PERFORMABILITY ||
			graph.fullJanCsaa007Conformance !== COMMAND_HANDLER_GRAPH_FULL_JAN_CSAA_007_CONFORMANCE ||
			graph.fullJanCsaa008Conformance !== COMMAND_HANDLER_GRAPH_FULL_JAN_CSAA_008_CONFORMANCE
		)
			add(
				'AUTHORITY_MISMATCH',
				'Authority, gate, oracle, integration, runtime, or conformance boundary is invalid.',
				'$'
			);
		if (!same(graph.limitations, COMMAND_HANDLER_GRAPH_LIMITATIONS))
			add('LIMITATION_MISMATCH', 'Graph limitations are absent or incompatible.', '$.limitations');
		if (graph.graphInputDigest !== expectedInputDigest)
			add('IDENTITY_MISMATCH', 'Graph input digest is invalid.', '$.graphInputDigest');
		const expectedGraphId = commandHandlerGraphId({
			arrowObservationId: observation.id,
			canonicalProfile: COMMAND_HANDLER_GRAPH_CANONICAL_PROFILE,
			graphInputDigest: expectedInputDigest,
			method: COMMAND_HANDLER_GRAPH_METHOD,
			operationVersion: COMMAND_HANDLER_GRAPH_OPERATION_VERSION,
			schemaVersion: COMMAND_HANDLER_GRAPH_SCHEMA_VERSION,
			semanticSnapshotId: snapshot.id,
			subjectId: snapshot.subjectId
		});
		if (graph.id !== expectedGraphId)
			add('IDENTITY_MISMATCH', 'Graph identity does not reproduce.', '$.id');
		if (graph.contentDigest !== commandHandlerGraphContentDigest(graph))
			add('CONTENT_DIGEST_MISMATCH', 'Graph content digest does not reproduce.', '$.contentDigest');
		if (!same(graph.producer, snapshot.provider))
			add(
				'SNAPSHOT_BINDING_MISMATCH',
				'Graph producer differs from snapshot provider.',
				'$.producer'
			);

		const model = semanticIndexes(snapshot);
		const commandFacts = registryFacts(snapshot, model, graph.commandRegistry);
		const registrationFacts = registryFacts(snapshot, model, graph.handlerRegistry);
		if (commandFacts.length === 0)
			add(
				'SHAPE_INVALID',
				'The selected JPWB COMMANDS registry is unexpectedly empty.',
				'$.commandRegistry'
			);
		if (registrationFacts.length === 0)
			add(
				'SHAPE_INVALID',
				'The selected JPWB HANDLERS registry is unexpectedly empty.',
				'$.handlerRegistry'
			);
		assertFrozenSourceBinding(
			subject,
			commandFacts[0]?.source ?? model.sourceById.get(graph.commandRegistry.sourceId)!
		);
		assertFrozenSourceBinding(
			subject,
			registrationFacts[0]?.source ?? model.sourceById.get(graph.handlerRegistry.sourceId)!
		);
		const handlers = handlerFacts(registrationFacts, model);
		const commandNames = new Set(commandFacts.map((fact) => fact.commandName));
		const expectedSiteFacts = expectedSites(
			snapshot,
			observation,
			subject,
			model,
			handlers,
			commandNames
		);
		const derivationLayerId = commandHandlerDerivationLayerId(expectedGraphId);
		const inferenceLayerId = commandHandlerInferenceLayerId(expectedGraphId);
		const nodeIds = graph.nodes.map((node) => node.id);
		if (
			new Set(nodeIds).size !== nodeIds.length ||
			nodeIds.some((id, index) => index > 0 && nodeIds[index - 1]! >= id)
		)
			add('ORDER_INVALID', 'Graph node identities must be unique and strictly ordered.', '$.nodes');
		const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
		const commandNodes = new Map<
			string,
			Extract<CommandHandlerGraphNode, { kind: 'COMMAND_REGISTRY_ENTRY' }>
		>();
		const registrationNodes = new Map<
			string,
			Extract<CommandHandlerGraphNode, { kind: 'HANDLER_REGISTRATION' }>
		>();
		const targetNodes = new Map<
			string,
			Extract<CommandHandlerGraphNode, { kind: 'HANDLER_TARGET' }>
		>();
		const siteNodes = new Map<
			string,
			Extract<CommandHandlerGraphNode, { kind: 'DECLARED_ARROW_SITE' }>
		>();
		const occurrenceNodes = new Map<
			string,
			Extract<CommandHandlerGraphNode, { kind: 'DECLARED_ARROW_OCCURRENCE' }>
		>();
		const frontierNodes: CommandHandlerFrontierNode[] = [];
		for (const [index, node] of graph.nodes.entries()) {
			const path = `$.nodes[${index}]`;
			if (!plainObject(node) || !exactKeys(node, exactNodeKeys(node))) {
				add('FIELD_SET_INVALID', 'Graph node field population is invalid.', path);
				continue;
			}
			if (
				node.graphId !== graph.id ||
				node.semanticSnapshotId !== graph.semanticSnapshotId ||
				node.subjectId !== graph.subjectId ||
				node.layerId !== exactLayerForNode(node, derivationLayerId, inferenceLayerId) ||
				!Array.isArray(node.provenanceIds) ||
				!Array.isArray(node.sourceLocations) ||
				!same(node.provenanceIds, sortedUnique(node.provenanceIds)) ||
				(node.provenanceIds as readonly string[]).some((id: string) => !model.provenanceIds.has(id))
			)
				add('IDENTITY_MISMATCH', 'Graph node common binding is invalid.', path);
			for (const [locationIndex, location] of node.sourceLocations.entries())
				if (
					!plainObject(location) ||
					!exactKeys(location, LOCATION_KEYS) ||
					!Number.isSafeInteger(location.start) ||
					!Number.isSafeInteger(location.end) ||
					location.start < 0 ||
					location.end < location.start ||
					!model.sourceById.has(location.sourceId)
				)
					add(
						'DANGLING_SEMANTIC_REFERENCE',
						'Graph node source location is invalid.',
						`${path}.sourceLocations[${locationIndex}]`
					);
			switch (node.kind) {
				case 'COMMAND_REGISTRY_ENTRY':
					if (commandNodes.has(node.commandName))
						add('DUPLICATE_ID', 'Command name is represented more than once.', path);
					commandNodes.set(node.commandName, node);
					break;
				case 'HANDLER_REGISTRATION':
					if (registrationNodes.has(node.commandName))
						add('DUPLICATE_ID', 'Handler registration name is represented more than once.', path);
					registrationNodes.set(node.commandName, node);
					break;
				case 'HANDLER_TARGET':
					targetNodes.set(node.id, node);
					break;
				case 'DECLARED_ARROW_SITE':
					if (siteNodes.has(node.observationSiteId))
						add('DUPLICATE_ID', 'Observation site is represented more than once.', path);
					siteNodes.set(node.observationSiteId, node);
					break;
				case 'DECLARED_ARROW_OCCURRENCE':
					if (occurrenceNodes.has(node.observationArrowId))
						add('DUPLICATE_ID', 'Observation arrow is represented more than once.', path);
					occurrenceNodes.set(node.observationArrowId, node);
					break;
				case 'FRONTIER':
					frontierNodes.push(node);
					break;
			}
		}

		for (const fact of commandFacts) {
			const node = commandNodes.get(fact.commandName);
			const expectedId = commandRegistryEntryNodeId(expectedGraphId, fact.propertyNode.id);
			if (
				node === undefined ||
				node.id !== expectedId ||
				node.declarationId !== (fact.declaration?.id ?? null) ||
				node.nameNodeId !== fact.nameNode.id ||
				node.propertyNodeId !== fact.propertyNode.id ||
				node.sourceId !== fact.source.id ||
				node.programId !== fact.source.programId ||
				node.projectId !== fact.source.projectId ||
				!same(node.provenanceIds, declarationProvenance(fact.declaration, fact.source)) ||
				!same(node.sourceLocations, locationsForNode(fact.nameNode, fact.source.id))
			)
				add(
					'REGISTRY_POPULATION_MISMATCH',
					`Command registry entry ${fact.commandName} does not reproduce.`,
					'$.nodes'
				);
		}
		if (
			commandNodes.size !== commandFacts.length ||
			[...commandNodes.keys()].some((name) => !commandNames.has(name))
		)
			add(
				'REGISTRY_POPULATION_MISMATCH',
				'Command registry node population differs from independent semantic derivation.',
				'$.nodes'
			);

		const handlerByName = new Map(handlers.map((fact) => [fact.member.commandName, fact]));
		for (const fact of handlers) {
			const node = registrationNodes.get(fact.member.commandName);
			const expectedId = handlerRegistrationNodeId(expectedGraphId, fact.member.propertyNode.id);
			if (
				node === undefined ||
				node.id !== expectedId ||
				node.handlerName !== fact.handlerName ||
				node.handlerAliasSymbolId !== fact.aliasSymbolId ||
				node.handlerTerminalSymbolId !== (fact.terminalSymbol?.id ?? null) ||
				node.nameNodeId !== fact.member.nameNode.id ||
				node.propertyNodeId !== fact.member.propertyNode.id ||
				node.targetNodeId !== fact.member.valueNode.id ||
				node.targetReferenceId !== (fact.reference?.id ?? null) ||
				node.sourceId !== fact.member.source.id ||
				node.programId !== fact.member.source.programId ||
				node.projectId !== fact.member.source.projectId ||
				!same(
					node.provenanceIds,
					referenceProvenance(fact.reference, fact.terminalSymbol, fact.member.source)
				) ||
				!same(
					node.sourceLocations,
					locationsForNode(fact.member.propertyNode, fact.member.source.id)
				)
			)
				add(
					'REGISTRY_POPULATION_MISMATCH',
					`Handler registration ${fact.member.commandName} does not reproduce.`,
					'$.nodes'
				);
		}
		if (
			registrationNodes.size !== handlers.length ||
			[...registrationNodes.keys()].some((name) => !handlerByName.has(name))
		)
			add(
				'REGISTRY_POPULATION_MISMATCH',
				'Handler registration node population differs from independent semantic derivation.',
				'$.nodes'
			);

		const expectedTargetIds = new Set<string>();
		const targetByCommand = new Map<
			string,
			Extract<CommandHandlerGraphNode, { kind: 'HANDLER_TARGET' }>
		>();
		for (const fact of handlers) {
			if (fact.bodyKind === null || fact.targetNode === null || fact.terminalSymbol === null)
				continue;
			const expectedId = handlerTargetNodeId(expectedGraphId, {
				nodeId: fact.targetNode.id,
				symbolId: fact.terminalSymbol.id
			});
			expectedTargetIds.add(expectedId);
			const node = targetNodes.get(expectedId);
			const source = model.sourceById.get(fact.targetNode.sourceId);
			if (
				node === undefined ||
				source === undefined ||
				node.bodyKind !== fact.bodyKind ||
				node.handlerName !== fact.handlerName ||
				node.nodeId !== fact.targetNode.id ||
				node.symbolId !== fact.terminalSymbol.id ||
				node.sourceId !== source.id ||
				node.programId !== source.programId ||
				node.projectId !== source.projectId ||
				!same(node.declarationIds, [...fact.terminalSymbol.declarationIds].sort(compareText)) ||
				!same(
					node.provenanceIds,
					sortedUnique([...sourceProvenance(source), fact.terminalSymbol.provenanceId])
				) ||
				!same(node.sourceLocations, locationsForNode(fact.targetNode, source.id))
			)
				add(
					'REGISTRY_POPULATION_MISMATCH',
					`Handler target for ${fact.member.commandName} does not reproduce.`,
					'$.nodes'
				);
			if (node !== undefined) targetByCommand.set(fact.member.commandName, node);
		}
		if (
			targetNodes.size !== expectedTargetIds.size ||
			[...targetNodes.keys()].some((id) => !expectedTargetIds.has(id))
		)
			add(
				'REGISTRY_POPULATION_MISMATCH',
				'Handler target population differs from independent semantic derivation.',
				'$.nodes'
			);

		const observationSites = new Map<
			string,
			ArrowCommandCensusObservation['declaredSites'][number]
		>(observation.declaredSites.map((site) => [site.id, site]));
		for (const site of observation.declaredSites) {
			const node = siteNodes.get(site.id);
			const fact = expectedSiteFacts.get(site.id)!;
			if (
				node === undefined ||
				node.id !== commandArrowSiteNodeId(expectedGraphId, site.id) ||
				node.attribution !== fact.attribution ||
				!same(node.observationSource, site.source) ||
				node.semanticSiteNodeId !== (fact.node?.id ?? null) ||
				node.sourceId !== (fact.source?.id ?? null) ||
				!same(node.provenanceIds, fact.provenanceIds) ||
				!same(node.sourceLocations, fact.sourceLocations)
			)
				add('REGISTRY_POPULATION_MISMATCH', `Arrow site ${site.id} does not reproduce.`, '$.nodes');
			if (
				node !== undefined &&
				(!plainObject(node.observationSource) ||
					!exactKeys(node.observationSource, OBSERVATION_SOURCE_KEYS))
			)
				add('FIELD_SET_INVALID', 'Observation source field set is invalid.', '$.nodes');
		}
		if (
			siteNodes.size !== observation.declaredSites.length ||
			[...siteNodes.keys()].some((id) => !observationSites.has(id))
		)
			add(
				'REGISTRY_POPULATION_MISMATCH',
				'Arrow site population differs from validated observation.',
				'$.nodes'
			);

		const observationArrows = new Map<
			string,
			ArrowCommandCensusObservation['declaredArrows'][number]
		>(observation.declaredArrows.map((arrow) => [arrow.id, arrow]));
		for (const arrow of observation.declaredArrows) {
			const node = occurrenceNodes.get(arrow.id);
			const site = siteNodes.get(arrow.siteId);
			if (
				node === undefined ||
				site === undefined ||
				node.id !== commandArrowOccurrenceNodeId(expectedGraphId, arrow.id) ||
				node.arrowKey !== arrow.arrowKey ||
				node.from !== arrow.from ||
				node.machine !== arrow.machine ||
				node.observationSiteId !== arrow.siteId ||
				node.ordinalAtSite !== arrow.ordinalAtSite ||
				node.to !== arrow.to ||
				!same(node.provenanceIds, site?.provenanceIds) ||
				!same(node.sourceLocations, site?.sourceLocations)
			)
				add(
					'REGISTRY_POPULATION_MISMATCH',
					`Arrow occurrence ${arrow.id} does not reproduce.`,
					'$.nodes'
				);
		}
		if (
			occurrenceNodes.size !== observation.declaredArrows.length ||
			[...occurrenceNodes.keys()].some((id) => !observationArrows.has(id))
		)
			add(
				'REGISTRY_POPULATION_MISMATCH',
				'Arrow occurrence population differs from validated observation.',
				'$.nodes'
			);

		const commandsWithEvidence = new Set<string>();
		for (const fact of expectedSiteFacts.values()) {
			if (fact.tableCommandName !== null && commandNames.has(fact.tableCommandName))
				commandsWithEvidence.add(fact.tableCommandName);
			for (const name of fact.directCommandNames)
				if (commandNames.has(name)) commandsWithEvidence.add(name);
			for (const name of fact.factoryCommandNames)
				if (commandNames.has(name)) commandsWithEvidence.add(name);
		}
		const expectedFrontierPopulation = expectedFrontiers({
			commandNodes,
			commandsWithEvidence,
			handlerFacts: handlers,
			registrationNodes,
			siteNodes,
			sites: expectedSiteFacts
		});
		const expectedFrontierIds = new Set<string>();
		for (const expected of expectedFrontierPopulation) {
			const canonicalInput =
				expected.anchorField === 'commandNodeId'
					? { commandNodeId: expected.anchorId, frontierKind: expected.frontierKind }
					: expected.anchorField === 'registrationNodeId'
						? { frontierKind: expected.frontierKind, registrationNodeId: expected.anchorId }
						: { frontierKind: expected.frontierKind, siteNodeId: expected.anchorId };
			const id = commandHandlerFrontierNodeId(expectedGraphId, canonicalInput as never);
			expectedFrontierIds.add(id);
			const node = nodesById.get(id);
			if (
				node?.kind !== 'FRONTIER' ||
				node.frontierKind !== expected.frontierKind ||
				node.reason !== expected.reason ||
				frontierAnchor(node)?.field !== expected.anchorField ||
				frontierAnchor(node)?.anchorId !== expected.anchorId ||
				!same(node.provenanceIds, expected.provenanceIds) ||
				!same(node.sourceLocations, expected.sourceLocations)
			)
				add(
					'REGISTRY_POPULATION_MISMATCH',
					`Expected frontier ${expected.frontierKind} is absent or invalid.`,
					'$.nodes'
				);
		}
		if (
			frontierNodes.length !== expectedFrontierIds.size ||
			frontierNodes.some((node) => !expectedFrontierIds.has(node.id))
		)
			add(
				'REGISTRY_POPULATION_MISMATCH',
				'Frontier population differs from independent derivation.',
				'$.nodes'
			);

		const inferenceBasisForRegistration = (
			registration: Extract<CommandHandlerGraphNode, { kind: 'HANDLER_REGISTRATION' }>,
			target: Extract<CommandHandlerGraphNode, { kind: 'HANDLER_TARGET' }>
		) => ({
			assumptions: ['The registered factory call returns a callable command handler.'],
			limitationKinds: ['FACTORY_ARROW_ATTRIBUTION_OPEN'] as const,
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
		});
		const inferenceBasisForSite = (
			target: Extract<CommandHandlerGraphNode, { kind: 'HANDLER_TARGET' }>,
			site: Extract<CommandHandlerGraphNode, { kind: 'DECLARED_ARROW_SITE' }>
		) => ({
			assumptions: [
				'A retained arrow site inside the shared factory may belong to this registered factory result.'
			],
			limitationKinds: ['FACTORY_ARROW_ATTRIBUTION_OPEN'] as const,
			method: COMMAND_HANDLER_GRAPH_METHOD,
			rationale:
				'The site is lexically enclosed by the resolved factory callable, but retained pooled literals cannot partition occurrences by factory instance.',
			supportingInputIds: sortedUnique([
				target.nodeId,
				target.symbolId,
				site.observationSiteId,
				...(site.semanticSiteNodeId === null ? [] : [site.semanticSiteNodeId])
			])
		});
		type ExpectedEdge = {
			readonly attribution: CommandHandlerGraphEdge['attribution'];
			readonly inferenceBasis: CommandHandlerGraphEdge['inferenceBasis'];
			readonly relationCode: CommandHandlerGraphEdge['relationCode'];
			readonly relationKind: CommandHandlerGraphEdge['relationKind'];
			readonly source: CommandHandlerGraphNode;
			readonly target: CommandHandlerGraphNode;
		};
		const expectedEdges = new Map<string, ExpectedEdge>();
		const expectEdge = (
			relationKind: CommandHandlerGraphEdge['relationKind'],
			attribution: CommandHandlerGraphEdge['attribution'],
			source: CommandHandlerGraphNode,
			target: CommandHandlerGraphNode,
			inferenceBasis: CommandHandlerGraphEdge['inferenceBasis'] = null
		): void => {
			const edge = {
				attribution,
				inferenceBasis,
				relationCode: expectedEdgeRelation({ relationKind } as CommandHandlerGraphEdge),
				relationKind,
				source,
				target
			};
			const key = `${relationKind}\0${attribution}\0${source.id}\0${target.id}`;
			if (expectedEdges.has(key)) throw new Error(`Expected edge ${key} is duplicated.`);
			expectedEdges.set(key, edge);
		};
		for (const [name, command] of commandNodes) {
			const registration = registrationNodes.get(name);
			if (registration !== undefined)
				expectEdge(
					'COMMAND_REGISTRY_ENTRY_TO_HANDLER_REGISTRATION',
					'EXACT',
					command,
					registration
				);
		}
		for (const [name, registration] of registrationNodes) {
			const target = targetByCommand.get(name);
			if (target === undefined) continue;
			if (target.bodyKind === 'DIRECT_FUNCTION')
				expectEdge('HANDLER_REGISTRATION_TO_TARGET', 'EXACT', registration, target);
			else
				expectEdge(
					'HANDLER_REGISTRATION_TO_TARGET',
					'CANDIDATE',
					registration,
					target,
					inferenceBasisForRegistration(registration, target)
				);
		}
		for (const [siteId, fact] of expectedSiteFacts) {
			const site = siteNodes.get(siteId);
			if (site === undefined) continue;
			if (fact.tableCommandName !== null) {
				const command = commandNodes.get(fact.tableCommandName);
				if (command !== undefined)
					expectEdge('COMMAND_REGISTRY_ENTRY_TO_TABLE_ARROW_SITE', 'EXACT', command, site);
			}
			const directTargets = new Map(
				fact.directCommandNames.flatMap((commandName) => {
					const target = targetByCommand.get(commandName);
					return target === undefined ? [] : [[target.id, target] as const];
				})
			);
			for (const target of directTargets.values())
				expectEdge('HANDLER_TARGET_TO_ARROW_SITE', 'EXACT', target, site);
			const factoryTargets = new Map(
				fact.factoryCommandNames.flatMap((commandName) => {
					const target = targetByCommand.get(commandName);
					return target === undefined ? [] : [[target.id, target] as const];
				})
			);
			for (const target of factoryTargets.values())
				expectEdge(
					'HANDLER_TARGET_TO_ARROW_SITE',
					'CANDIDATE',
					target,
					site,
					inferenceBasisForSite(target, site)
				);
		}
		for (const arrow of observation.declaredArrows) {
			const site = siteNodes.get(arrow.siteId);
			const occurrence = occurrenceNodes.get(arrow.id);
			if (site !== undefined && occurrence !== undefined)
				expectEdge('ARROW_SITE_TO_OCCURRENCE', 'EXACT', site, occurrence);
		}

		const edgeIds = graph.edges.map((edge) => edge.id);
		if (
			new Set(edgeIds).size !== edgeIds.length ||
			edgeIds.some((id, index) => index > 0 && edgeIds[index - 1]! >= id)
		)
			add('ORDER_INVALID', 'Graph edge identities must be unique and strictly ordered.', '$.edges');
		const actualEdgeKeys = new Set<string>();
		const canonicalLocations = (
			left: CommandHandlerGraphNode['sourceLocations'],
			right: CommandHandlerGraphNode['sourceLocations']
		): CommandHandlerGraphEdge['sourceLocations'] => {
			const unique = new Map<string, CommandHandlerGraphEdge['sourceLocations'][number]>();
			for (const location of [...left, ...right])
				unique.set(`${location.sourceId}\0${location.start}\0${location.end}`, location);
			return [...unique.values()].sort(
				(a, b) => compareText(a.sourceId, b.sourceId) || a.start - b.start || a.end - b.end
			);
		};
		for (const [index, edge] of graph.edges.entries()) {
			const path = `$.edges[${index}]`;
			if (!plainObject(edge) || !exactKeys(edge, EDGE_KEYS)) {
				add('FIELD_SET_INVALID', 'Graph edge field population is invalid.', path);
				continue;
			}
			if (
				!plainObject(edge.source) ||
				!plainObject(edge.target) ||
				!exactKeys(edge.source, ENDPOINT_KEYS) ||
				!exactKeys(edge.target, ENDPOINT_KEYS)
			) {
				add('FIELD_SET_INVALID', 'Graph edge endpoints are invalid.', path);
				continue;
			}
			const source = nodesById.get(edge.source.nodeId);
			const target = nodesById.get(edge.target.nodeId);
			if (
				source === undefined ||
				target === undefined ||
				edge.source.kind !== source.kind ||
				edge.target.kind !== target.kind
			) {
				add('DANGLING_ENDPOINT', 'Graph edge endpoint is absent or kind-incompatible.', path);
				continue;
			}
			const key = inferredEdgeKey(edge);
			actualEdgeKeys.add(key);
			const expected = expectedEdges.get(key);
			const edgeMismatches = [
				[expected === undefined, 'population'],
				[edge.relationCode !== expectedEdgeRelation(edge), 'relation-code'],
				[edge.relationCode !== expected?.relationCode, 'expected-relation-code'],
				[
					expected === undefined || !same(edge.inferenceBasis, expected.inferenceBasis),
					'inference-basis'
				],
				[edge.graphId !== graph.id, 'graph-id'],
				[
					edge.layerId !== (edge.attribution === 'EXACT' ? derivationLayerId : inferenceLayerId),
					'layer'
				],
				[edge.method !== COMMAND_HANDLER_GRAPH_METHOD, 'method'],
				[edge.semanticSnapshotId !== snapshot.id, 'semantic-snapshot-id'],
				[edge.subjectId !== snapshot.subjectId, 'subject-id'],
				[
					!same(
						edge.provenanceIds,
						sortedUnique([...source.provenanceIds, ...target.provenanceIds])
					),
					'provenance'
				],
				[
					!same(
						edge.sourceLocations,
						canonicalLocations(source.sourceLocations, target.sourceLocations)
					),
					'source-locations'
				]
			] as const;
			const failedDimensions = edgeMismatches
				.filter(([failed]) => failed)
				.map(([, dimension]) => dimension);
			if (failedDimensions.length > 0)
				add(
					'REGISTRY_POPULATION_MISMATCH',
					`Graph edge is not independently supported (${failedDimensions.join(', ')}).`,
					path
				);
			if (
				(edge.attribution === 'EXACT' && edge.inferenceBasis !== null) ||
				(edge.attribution === 'CANDIDATE' &&
					(!plainObject(edge.inferenceBasis) ||
						!exactKeys(edge.inferenceBasis, INFERENCE_BASIS_KEYS)))
			)
				add('FIELD_SET_INVALID', 'Edge inference basis is incompatible with attribution.', path);
			const expectedId = commandHandlerGraphEdgeId({
				attribution: edge.attribution,
				graphId: graph.id,
				inferenceBasis: edge.inferenceBasis,
				relationCode: edge.relationCode,
				relationKind: edge.relationKind,
				source: edge.source,
				target: edge.target
			});
			if (edge.id !== expectedId)
				add('IDENTITY_MISMATCH', 'Graph edge identity does not reproduce.', `${path}.id`);
		}
		if (
			actualEdgeKeys.size !== expectedEdges.size ||
			[...expectedEdges.keys()].some((key) => !actualEdgeKeys.has(key))
		)
			add(
				'REGISTRY_POPULATION_MISMATCH',
				'Graph edge population differs from independent derivation.',
				'$.edges'
			);

		for (const [path, index] of [
			['$.forwardIndex', graph.forwardIndex],
			['$.reverseIndex', graph.reverseIndex]
		] as const)
			if (
				index.some(
					(entry) =>
						!plainObject(entry) ||
						!exactKeys(entry, INDEX_ENTRY_KEYS) ||
						!Array.isArray(entry.edgeIds)
				)
			)
				add('FIELD_SET_INVALID', 'Graph index entry field set is invalid.', path);
		if (!same(graph.forwardIndex, expectedIndexes(graph.nodes, graph.edges, 'FORWARD')))
			add('INDEX_MISMATCH', 'Forward index does not reproduce.', '$.forwardIndex');
		if (!same(graph.reverseIndex, expectedIndexes(graph.nodes, graph.edges, 'REVERSE')))
			add('INDEX_MISMATCH', 'Reverse index does not reproduce.', '$.reverseIndex');

		const missingHandlerRegistrations = commandFacts.filter(
			(command) => !handlerByName.has(command.commandName)
		).length;
		const undeclaredHandlerRegistrations = handlers.filter(
			(handler) => !commandNames.has(handler.member.commandName)
		).length;
		const expectedEdgeValues = [...expectedEdges.values()];
		const expectedNodeCount =
			commandFacts.length +
			registrationFacts.length +
			expectedTargetIds.size +
			observation.declaredSites.length +
			observation.declaredArrows.length +
			expectedFrontierPopulation.length;
		const expectedCoverage: CommandHandlerGraphCoverage = {
			arrowAttributionClosure: 'OPEN',
			candidateEdges: expectedEdgeValues.filter((edge) => edge.attribution === 'CANDIDATE').length,
			commandRegistryClosure:
				missingHandlerRegistrations === 0 && undeclaredHandlerRegistrations === 0
					? 'CLOSED'
					: 'OPEN',
			commandsWithArrowEvidence: commandsWithEvidence.size,
			commandsWithoutArrowEvidence: commandFacts.length - commandsWithEvidence.size,
			directHandlerArrowSites: [...expectedSiteFacts.values()].filter(
				(site) => site.attribution === 'DIRECT_HANDLER'
			).length,
			discoveredArrowOccurrences: observation.declaredArrows.length,
			discoveredArrowSites: observation.declaredSites.length,
			discoveredCommandRegistryEntries: commandFacts.length,
			discoveredHandlerRegistryEntries: registrationFacts.length,
			edges: expectedEdges.size,
			exactCommandRegistrations: commandFacts.length - missingHandlerRegistrations,
			exactEdges: expectedEdgeValues.filter((edge) => edge.attribution === 'EXACT').length,
			factorySharedArrowSites: [...expectedSiteFacts.values()].filter(
				(site) => site.attribution === 'FACTORY_SHARED'
			).length,
			frontierNodes: expectedFrontierPopulation.length,
			handlerTargets: expectedTargetIds.size,
			missingHandlerRegistrations,
			reconciles: true,
			representedArrowOccurrences: observation.declaredArrows.length,
			representedArrowSites: observation.declaredSites.length,
			representedCommandRegistryEntries: commandFacts.length,
			representedHandlerRegistryEntries: registrationFacts.length,
			tableCommandArrowSites: [...expectedSiteFacts.values()].filter(
				(site) => site.attribution === 'TABLE_COMMAND'
			).length,
			undeclaredHandlerRegistrations
		};
		if (!plainObject(graph.coverage) || !exactKeys(graph.coverage, COVERAGE_KEYS))
			add('FIELD_SET_INVALID', 'Coverage field set is invalid.', '$.coverage');
		if (!same(graph.coverage, expectedCoverage))
			add('COVERAGE_MISMATCH', 'Coverage counters do not independently reconcile.', '$.coverage');

		const uniqueConsumedPaths = new Set<string>([
			graph.commandRegistry.logicalPath,
			graph.handlerRegistry.logicalPath,
			...[...expectedSiteFacts.values()].flatMap((site) =>
				site.source === null ? [] : [site.source.logicalPath]
			)
		]);
		let consumedSourceBytes = 0;
		for (const logicalPath of uniqueConsumedPaths) {
			const artifacts = subject.artifacts.filter((artifact) => artifact.path === logicalPath);
			if (artifacts.length !== 1)
				add(
					'SOURCE_BINDING_MISMATCH',
					`Consumed source ${logicalPath} is not represented exactly once in the frozen subject.`,
					'$validationInput.subject'
				);
			else consumedSourceBytes += artifacts[0]!.bytes;
		}
		for (const [path, actual, maximum] of [
			['$.budgets.maxAstNodes', snapshot.astNodes.length, graph.budgets.maxAstNodes],
			[
				'$.budgets.maxCommandRegistryEntries',
				commandFacts.length,
				graph.budgets.maxCommandRegistryEntries
			],
			['$.budgets.maxEdges', expectedEdges.size, graph.budgets.maxEdges],
			['$.budgets.maxFrontiers', expectedFrontierPopulation.length, graph.budgets.maxFrontiers],
			[
				'$.budgets.maxHandlerRegistryEntries',
				registrationFacts.length,
				graph.budgets.maxHandlerRegistryEntries
			],
			['$.budgets.maxNodes', expectedNodeCount, graph.budgets.maxNodes],
			['$.budgets.maxSourceBytes', consumedSourceBytes, graph.budgets.maxSourceBytes]
		] as const)
			if (actual > maximum)
				add(
					'BUDGET_EXHAUSTED',
					`Graph population exceeds its recorded caller operation guard: ${actual} > ${maximum}.`,
					path
				);

		const derivationNodes = graph.nodes.filter((node) => node.layerId === derivationLayerId);
		const inferenceNodes = graph.nodes.filter((node) => node.layerId === inferenceLayerId);
		const derivationEdges = graph.edges.filter((edge) => edge.layerId === derivationLayerId);
		const inferenceEdges = graph.edges.filter((edge) => edge.layerId === inferenceLayerId);
		const expectedLayers = [
			{
				capability: COMMAND_HANDLER_GRAPH_DERIVATION_CAPABILITY,
				edges: derivationEdges,
				id: derivationLayerId,
				kind: 'JPWB_COMMAND_HANDLER_DERIVATION',
				nodes: derivationNodes,
				ordinal: 0
			},
			{
				capability: COMMAND_HANDLER_GRAPH_INFERENCE_CAPABILITY,
				edges: inferenceEdges,
				id: inferenceLayerId,
				kind: 'JPWB_COMMAND_HANDLER_INFERENCE',
				nodes: inferenceNodes,
				ordinal: 1
			}
		] as const;
		if (graph.layers.length !== 2)
			add('FIELD_SET_INVALID', 'Exactly two graph layers are required.', '$.layers');
		for (const [index, expected] of expectedLayers.entries()) {
			const layer = graph.layers[index] as CommandHandlerGraphLayer | undefined;
			const path = `$.layers[${index}]`;
			const provenanceIds = sortedUnique(
				expected.nodes
					.flatMap((node) => node.provenanceIds)
					.concat(expected.edges.flatMap((edge) => edge.provenanceIds))
			);
			if (
				layer === undefined ||
				!plainObject(layer) ||
				!exactKeys(layer, LAYER_KEYS) ||
				layer.id !== expected.id ||
				layer.graphId !== graph.id ||
				layer.capability !== expected.capability ||
				layer.kind !== expected.kind ||
				layer.ordinal !== expected.ordinal ||
				layer.capabilityStatus !== COMMAND_HANDLER_GRAPH_CAPABILITY_STATUS ||
				layer.registryStatus !== COMMAND_HANDLER_GRAPH_REGISTRY_STATUS ||
				layer.method !== COMMAND_HANDLER_GRAPH_METHOD ||
				layer.semanticSnapshotId !== snapshot.id ||
				layer.subjectId !== snapshot.subjectId ||
				!same(layer.producer, graph.producer) ||
				!same(layer.limitations, graph.limitations) ||
				!same(layer.coverage, graph.coverage) ||
				!same(layer.provenanceIds, provenanceIds) ||
				!same(
					layer.nodeIds,
					expected.nodes.map((node) => node.id)
				) ||
				!same(
					layer.edgeIds,
					expected.edges.map((edge) => edge.id)
				)
			)
				add('IDENTITY_MISMATCH', 'Graph layer does not reconcile with its partition.', path);
		}

		const finalState = issues.some((issue) => issue.code === 'BUDGET_EXHAUSTED')
			? 'BUDGET_EXHAUSTED'
			: 'INVALID';
		return issues.length === 0 ? { issues: [], state: 'VALID' } : { issues, state: finalState };
	} catch (error) {
		add(
			'SHAPE_INVALID',
			error instanceof Error
				? `Validation failed closed: ${error.message}`
				: 'Validation failed closed on hostile or malformed input.',
			'$'
		);
		return { issues, state: 'INVALID' };
	}
}

export function validateConstructedCommandHandlerGraph(
	graph: unknown,
	snapshot: StaticSemanticSnapshot,
	observation: ArrowCommandCensusObservation,
	subject: FrozenSubject,
	expectedInputDigest: string,
	options?: CommandHandlerGraphValidationOptions
): CommandHandlerGraphValidationResult {
	return validateCommandHandlerGraphInternal(
		graph,
		snapshot,
		observation,
		subject,
		expectedInputDigest,
		options
	);
}

export function validateCommandHandlerGraph(
	graph: unknown,
	snapshot: StaticSemanticSnapshot,
	observation: ArrowCommandCensusObservation,
	subject: FrozenSubject,
	options?: CommandHandlerGraphValidationOptions
): CommandHandlerGraphValidationResult {
	let limits: ValidationBudgets;
	try {
		limits = materializeOptions(options);
		const inspected = inspectPlainData(graph, limits);
		if (inspected !== null)
			return {
				issues: [
					{
						code: inspected.budget ? 'BUDGET_EXHAUSTED' : 'SHAPE_INVALID',
						message: inspected.message,
						path: inspected.path
					}
				],
				state: inspected.budget ? 'BUDGET_EXHAUSTED' : 'INVALID'
			};
		if (!plainObject(graph) || !exactKeys(graph as object, TOP_LEVEL_KEYS))
			throw new TypeError('Graph top-level shape is invalid.');
		const candidate = graph as unknown as CommandHandlerGraphSnapshot;
		const request: BuildCommandHandlerGraphRequest = {
			arrowObservationId: candidate.arrowObservationId,
			budgets: candidate.budgets,
			commandRegistry: candidate.commandRegistry,
			handlerRegistry: candidate.handlerRegistry,
			operationVersion: COMMAND_HANDLER_GRAPH_OPERATION_VERSION,
			schemaVersion: COMMAND_HANDLER_GRAPH_REQUEST_SCHEMA_VERSION,
			semanticSnapshotId: candidate.semanticSnapshotId,
			subjectId: candidate.subjectId
		};
		return validateCommandHandlerGraphInternal(
			graph,
			snapshot,
			observation,
			subject,
			commandHandlerGraphInputDigest(request, snapshot, observation),
			options
		);
	} catch (error) {
		return {
			issues: [
				{
					code: 'SHAPE_INVALID',
					message:
						error instanceof Error
							? `Validation input inspection failed closed: ${error.message}`
							: 'Validation input inspection failed closed.',
					path: '$'
				}
			],
			state: 'INVALID'
		};
	}
}
