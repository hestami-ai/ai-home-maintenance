import { isProxy } from 'node:util/types';
import ts from 'typescript';

import {
	GUARD_CLASSIFICATION_OVERLAY_AUTHORITY_TRANSFER,
	GUARD_CLASSIFICATION_OVERLAY_BASELINE_CHANGE,
	GUARD_CLASSIFICATION_OVERLAY_CANONICAL_PROFILE,
	GUARD_CLASSIFICATION_OVERLAY_CAPABILITY_STATUS,
	GUARD_CLASSIFICATION_OVERLAY_DERIVATION_CAPABILITY,
	GUARD_CLASSIFICATION_OVERLAY_FULL_JAN_CSAA_007_CONFORMANCE,
	GUARD_CLASSIFICATION_OVERLAY_FULL_JAN_CSAA_008_CONFORMANCE,
	GUARD_CLASSIFICATION_OVERLAY_GATE_EFFECT,
	GUARD_CLASSIFICATION_OVERLAY_GRAPH_AUTHORITY,
	GUARD_CLASSIFICATION_OVERLAY_INFERENCE_CAPABILITY,
	GUARD_CLASSIFICATION_OVERLAY_INTEGRATION_STRATEGY,
	GUARD_CLASSIFICATION_OVERLAY_LIMITATIONS,
	GUARD_CLASSIFICATION_OVERLAY_METHOD,
	GUARD_CLASSIFICATION_OVERLAY_OPERATION_VERSION,
	GUARD_CLASSIFICATION_OVERLAY_ORACLE_CHANGE,
	GUARD_CLASSIFICATION_OVERLAY_REGISTRY_STATUS,
	GUARD_CLASSIFICATION_OVERLAY_REPLACEMENT_EQUIVALENCE,
	GUARD_CLASSIFICATION_OVERLAY_REQUEST_SCHEMA_VERSION,
	GUARD_CLASSIFICATION_OVERLAY_RUNTIME_ENFORCEMENT,
	GUARD_CLASSIFICATION_OVERLAY_RUNTIME_PERFORMABILITY,
	GUARD_CLASSIFICATION_OVERLAY_SCHEMA_VERSION,
	GUARD_CLASSIFICATION_OVERLAY_SCOPE,
	type GuardClassificationOverlayAnchorSite,
	type GuardClassificationOverlayBuildInputs,
	type GuardClassificationOverlayClassificationId,
	type GuardClassificationOverlayClassificationRecord,
	type GuardClassificationOverlayCommandEvidenceLink,
	type GuardClassificationOverlayCoverage,
	type GuardClassificationOverlayFrontier,
	type GuardClassificationOverlayHandlerLink,
	type GuardClassificationOverlayId,
	type GuardClassificationOverlayIndexEntry,
	type GuardClassificationOverlayLayer,
	type GuardClassificationOverlayOccurrenceRecord,
	type GuardClassificationOverlaySnapshot,
	type GuardClassificationOverlayValidationIssue,
	type GuardClassificationOverlayValidationOptions,
	type GuardClassificationOverlayValidationResult
} from '../contracts/guard-classification-overlay.js';
import type {
	CommandArrowOccurrenceNode,
	CommandArrowSiteNode,
	CommandHandlerGraphEdge,
	CommandHandlerGraphNodeId,
	CommandHandlerGraphNode,
	HandlerTargetNode
} from '../contracts/command-handler-graph.js';
import type {
	SemanticAstNodeRecord,
	SemanticDeclarationRecord,
	SemanticSourceRecord,
	StaticSemanticSnapshot
} from '../contracts/semantic.js';
import type {
	StateMachineGraphEdge,
	StateMachineGraphStateNode,
	StateMachineTopologyLegalTransitionRecord
} from '../contracts/state-machine-graph.js';
import { compareText, sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import { isFrozenSubjectCapability, readFrozenSubjectArtifact } from '../subject/frozen-store.js';
import { validateArrowCommandCensusObservation } from '../providers/jpwb-arrow-command-census/validate-arrow-command-census.js';
import { validateGuardEnforcementLedgerObservation } from '../providers/jpwb-guard-enforcement-ledger/validate-guard-enforcement-ledger.js';
import { validateStateMachineTopologyObservation } from '../providers/jpwb-state-machines/validate-state-machine-observation.js';
import {
	guardClassificationFrontierId,
	guardClassificationOverlayContentDigest,
	guardClassificationOverlayId,
	guardClassificationOverlayInputDigest,
	guardClassificationOverlayLayerId,
	guardClassificationRecordId,
	guardCommandEvidenceLinkId,
	guardEnforcementAnchorSiteId,
	guardEnforcementHandlerLinkId,
	guardOccurrenceRecordId
} from './guard-classification-overlay-canonical.js';
import { commandHandlerGraphInputDigest } from './command-handler-graph-canonical.js';
import { validateConstructedCommandHandlerGraph } from './validate-command-handler-graph.js';
import { validateStateMachineGraph } from './validate-state-machine-graph.js';

const STATE_SOURCE_PATH = 'packages/rph-domain/src/transitions.data.ts';
const MACHINE_EXCLUSIONS_PATH = 'packages/rph-domain/src/machine-exclusions.ts';
const APPLICATION_PROJECT_PATH = 'packages/rph-application/tsconfig.json';
const ENFORCING_SITE = /^(packages\/rph-application\/src\/handlers\/[^/:]+\.ts):[1-9][0-9]*$/u;

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

const INPUT_KEYS = [
	'arrowObservation',
	'commandHandlerGraph',
	'commandHandlerRequest',
	'guardObservation',
	'request',
	'semanticSnapshot',
	'stateGraph',
	'stateGraphRequest',
	'stateObservation',
	'subject'
] as const;
const REQUEST_KEYS = [
	'arrowObservationId',
	'budgets',
	'commandHandlerGraphId',
	'guardObservationId',
	'operationVersion',
	'schemaVersion',
	'semanticSnapshotId',
	'stateGraphId',
	'stateObservationId',
	'subjectId'
] as const;
const BUDGET_KEYS = [
	'maxAnchorSites',
	'maxAstNodes',
	'maxCommandEvidenceLinks',
	'maxDiagnostics',
	'maxFrontiers',
	'maxGuardOccurrences',
	'maxGuardRecords',
	'maxHandlerLinks',
	'maxSourceBytes',
	'maxStateEvidenceRefs'
] as const;

interface ValidationLimits {
	readonly maxDepth: number;
	readonly maxInputRecords: number;
	readonly maxInputStringCharacters: number;
	readonly maxIssues: number;
	readonly maxRecords: number;
	readonly maxStringCharacters: number;
}

interface InspectionFailure {
	readonly budget: boolean;
	readonly message: string;
	readonly path: string;
}

function inspectRecordShell(
	value: unknown,
	path: string,
	expectedKeys?: readonly string[]
): InspectionFailure | null {
	if (!plainObject(value))
		return { budget: false, message: 'Expected an exact plain record.', path };
	const keys = Reflect.ownKeys(value);
	if (keys.some((key) => typeof key !== 'string'))
		return { budget: false, message: 'Record may not have symbol keys.', path };
	if (expectedKeys !== undefined && !exactKeys(value, expectedKeys))
		return { budget: false, message: 'Record field set is invalid.', path };
	for (const key of keys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			return {
				budget: false,
				message: 'Record fields must be enumerable data properties.',
				path: `${path}.${String(key)}`
			};
	}
	return null;
}

function inspectArrayShell(
	value: unknown,
	path: string,
	remainingRecords: number
): InspectionFailure | null {
	if (!Array.isArray(value) || isProxy(value) || Reflect.getPrototypeOf(value) !== Array.prototype)
		return { budget: false, message: 'Expected an exact ordinary array.', path };
	const length = Reflect.getOwnPropertyDescriptor(value, 'length');
	if (
		length === undefined ||
		!('value' in length) ||
		!Number.isSafeInteger(length.value) ||
		(length.value as number) < 0
	)
		return { budget: false, message: 'Array length descriptor is invalid.', path };
	if ((length.value as number) > remainingRecords)
		return { budget: true, message: 'Input record budget cannot admit array population.', path };
	const keys = Reflect.ownKeys(value);
	if (keys.length !== (length.value as number) + 1)
		return { budget: false, message: 'Array must be dense and carry no extra properties.', path };
	for (const key of keys) {
		if (key === 'length') continue;
		if (typeof key !== 'string')
			return { budget: false, message: 'Array may not have symbol keys.', path };
		const index = Number(key);
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (
			!Number.isSafeInteger(index) ||
			index < 0 ||
			index >= (length.value as number) ||
			String(index) !== key ||
			descriptor === undefined ||
			!descriptor.enumerable ||
			!('value' in descriptor)
		)
			return { budget: false, message: 'Array population is sparse or accessor-backed.', path };
	}
	return null;
}

function plainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		return false;
	const prototype = Reflect.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function exactKeys(value: object, expected: readonly string[]): boolean {
	const keys = Reflect.ownKeys(value);
	if (keys.length !== expected.length || keys.some((key) => typeof key !== 'string')) return false;
	return (keys as string[])
		.sort(compareText)
		.every((key, index) => key === [...expected].sort(compareText)[index]);
}

function same(left: unknown, right: unknown): boolean {
	return canonicalSemanticJson(left) === canonicalSemanticJson(right);
}

function sortedUnique<Id extends string>(values: Iterable<Id>): Id[] {
	return [...new Set(values)].sort(compareText);
}

function materializeOptions(
	options: GuardClassificationOverlayValidationOptions | undefined
): ValidationLimits {
	const defaults: ValidationLimits = {
		maxDepth: 100_000,
		maxInputRecords: 10_000_000,
		maxInputStringCharacters: 1_000_000_000,
		maxIssues: 1_000,
		maxRecords: 10_000_000,
		maxStringCharacters: 1_000_000_000
	};
	if (options === undefined) return defaults;
	if (!plainObject(options))
		throw new TypeError('Validation options must be an exact plain record.');
	const allowed = new Set(Object.keys(defaults));
	const keys = Reflect.ownKeys(options);
	if (keys.some((key) => typeof key !== 'string' || !allowed.has(key)))
		throw new TypeError('Validation options contain an unsupported field.');
	const result = { ...defaults };
	for (const key of keys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(options, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new TypeError('Validation options must contain enumerable data properties only.');
		if (!Number.isSafeInteger(descriptor.value) || (descriptor.value as number) < 1)
			throw new TypeError(`${String(key)} must be a positive safe integer.`);
		(result as unknown as Record<string, number>)[String(key)] = descriptor.value as number;
	}
	return result;
}

/** Descriptor-only hostile-shape inspection performed before canonicalizers or predecessor validators. */
function inspectPlainData(
	roots: readonly { readonly path: string; readonly value: unknown }[],
	limits: {
		readonly maxDepth: number;
		readonly maxRecords: number;
		readonly maxStringCharacters: number;
	}
): InspectionFailure | null {
	type Frame = {
		readonly depth: number;
		readonly exit: boolean;
		readonly path: string;
		readonly value: unknown;
	};
	const pending: Frame[] = roots
		.map((root) => ({ depth: 0, exit: false, path: root.path, value: root.value }))
		.reverse();
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
		if (frame.depth > limits.maxDepth)
			return {
				budget: true,
				message: `Structural depth budget exceeded: ${frame.depth} > ${limits.maxDepth}.`,
				path: frame.path
			};
		records += 1;
		if (records > limits.maxRecords)
			return {
				budget: true,
				message: `Structural record budget exceeded: ${records} > ${limits.maxRecords}.`,
				path: frame.path
			};
		if (typeof current === 'string') {
			stringCharacters += current.length;
			if (stringCharacters > limits.maxStringCharacters)
				return {
					budget: true,
					message: `String-character budget exceeded: ${stringCharacters} > ${limits.maxStringCharacters}.`,
					path: frame.path
				};
			continue;
		}
		if (
			current === null ||
			typeof current === 'boolean' ||
			(typeof current === 'number' && Number.isFinite(current) && !Object.is(current, -0))
		)
			continue;
		if (typeof current !== 'object')
			return {
				budget: false,
				message: 'Value contains a non-canonical JSON member.',
				path: frame.path
			};
		if (isProxy(current))
			return { budget: false, message: 'Value contains a Proxy.', path: frame.path };
		if (active.has(current))
			return { budget: false, message: 'Value contains a cyclic container.', path: frame.path };
		const array = Array.isArray(current);
		const prototype = Reflect.getPrototypeOf(current);
		if (
			(array && prototype !== Array.prototype) ||
			(!array && prototype !== Object.prototype && prototype !== null)
		)
			return { budget: false, message: 'Containers must have plain prototypes.', path: frame.path };
		let arrayLength = 0;
		if (array) {
			const descriptor = Reflect.getOwnPropertyDescriptor(current, 'length');
			if (
				descriptor === undefined ||
				!('value' in descriptor) ||
				!Number.isSafeInteger(descriptor.value) ||
				(descriptor.value as number) < 0
			)
				return { budget: false, message: 'Array length descriptor is invalid.', path: frame.path };
			arrayLength = descriptor.value as number;
			if (arrayLength > limits.maxRecords - records)
				return {
					budget: true,
					message: 'Structural record budget cannot admit the array population.',
					path: frame.path
				};
		}
		const keys = Reflect.ownKeys(current);
		if (keys.length > limits.maxRecords - records)
			return {
				budget: true,
				message: 'Structural record budget cannot admit the container properties.',
				path: frame.path
			};
		if (keys.some((key) => typeof key !== 'string'))
			return { budget: false, message: 'Containers may not have symbol keys.', path: frame.path };
		if (array) {
			const dense = (key: PropertyKey): boolean => {
				if (key === 'length') return true;
				if (typeof key !== 'string') return false;
				const index = Number(key);
				return (
					Number.isSafeInteger(index) && index >= 0 && index < arrayLength && String(index) === key
				);
			};
			if (keys.length !== arrayLength + 1 || keys.some((key) => !dense(key)))
				return {
					budget: false,
					message: 'Arrays must be dense and may not carry extra properties.',
					path: frame.path
				};
		}
		active.add(current);
		pending.push({ ...frame, exit: true });
		for (const key of keys) {
			if (array && key === 'length') continue;
			const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
			if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
				return {
					budget: false,
					message: 'Properties must be enumerable data properties.',
					path: `${frame.path}.${String(key)}`
				};
			stringCharacters += String(key).length;
			if (stringCharacters > limits.maxStringCharacters)
				return {
					budget: true,
					message: 'String-character budget exceeded while inspecting keys.',
					path: frame.path
				};
			pending.push({
				depth: frame.depth + 1,
				exit: false,
				path: array ? `${frame.path}[${String(key)}]` : `${frame.path}.${String(key)}`,
				value: descriptor.value
			});
		}
	}
	return null;
}

function invalidResult(
	code: GuardClassificationOverlayValidationIssue['code'],
	path: string,
	message: string,
	budget = false
): GuardClassificationOverlayValidationResult {
	return {
		issues: [{ code, message, path }],
		state: budget ? 'BUDGET_EXHAUSTED' : 'INVALID'
	};
}

interface SemanticModel {
	readonly anchorSourcesByPath: ReadonlyMap<string, SemanticSourceRecord[]>;
	readonly assignmentsByNode: ReadonlyMap<string, StaticSemanticSnapshot['assignments'][number][]>;
	readonly declarationById: ReadonlyMap<string, SemanticDeclarationRecord>;
	readonly invocationByNode: ReadonlyMap<string, StaticSemanticSnapshot['invocations'][number]>;
	readonly nodeById: ReadonlyMap<string, SemanticAstNodeRecord>;
	readonly nodesBySource: ReadonlyMap<string, SemanticAstNodeRecord[]>;
	readonly referencesByNode: ReadonlyMap<string, StaticSemanticSnapshot['references'][number][]>;
	readonly sourceById: ReadonlyMap<string, SemanticSourceRecord>;
	readonly symbolById: ReadonlyMap<string, StaticSemanticSnapshot['symbols'][number]>;
}

interface CommandModel {
	readonly edgeById: ReadonlyMap<string, CommandHandlerGraphEdge>;
	readonly edges: readonly CommandHandlerGraphEdge[];
	readonly nodeById: ReadonlyMap<string, CommandHandlerGraphNode>;
	readonly occurrenceByObservationArrow: ReadonlyMap<string, CommandArrowOccurrenceNode>;
	readonly siteByObservationSite: ReadonlyMap<string, CommandArrowSiteNode>;
	readonly targetById: ReadonlyMap<string, HandlerTargetNode>;
}

interface StateModel {
	readonly edgeById: ReadonlyMap<string, StateMachineGraphEdge>;
	readonly stateNodeByObservationState: ReadonlyMap<string, StateMachineGraphStateNode>;
}

interface AnchorFact {
	readonly anchorText: string;
	readonly callable: SemanticAstNodeRecord;
	readonly callableAncestors: readonly SemanticAstNodeRecord[];
	readonly currentLine: number;
	readonly end: number;
	readonly id: GuardClassificationOverlayAnchorSite['id'];
	readonly path: string;
	readonly programId: GuardClassificationOverlayAnchorSite['programId'];
	readonly projectId: GuardClassificationOverlayAnchorSite['projectId'];
	readonly sourceId: GuardClassificationOverlayAnchorSite['sourceId'];
	readonly start: number;
}

interface ExpectedDerivation {
	readonly expected: GuardClassificationOverlaySnapshot;
	readonly sourceBytes: number;
}

function uniqueIndex<Value, Key extends string>(
	values: readonly Value[],
	key: (value: Value) => Key,
	description: string
): Map<Key, Value> {
	const result = new Map<Key, Value>();
	for (const value of values) {
		const id = key(value);
		if (result.has(id)) throw new Error(`${description} identity ${id} is duplicated.`);
		result.set(id, value);
	}
	return result;
}

function grouped<Key, Value>(map: Map<Key, Value[]>, key: Key, value: Value): void {
	const values = map.get(key);
	if (values === undefined) map.set(key, [value]);
	else values.push(value);
}

function semanticModel(inputs: GuardClassificationOverlayBuildInputs): SemanticModel {
	const snapshot = inputs.semanticSnapshot;
	const enforcementPaths = new Set<string>();
	for (const guard of inputs.guardObservation.guards) {
		const match = guard.enforcingSite === null ? null : ENFORCING_SITE.exec(guard.enforcingSite);
		if (match !== null) enforcementPaths.add(match[1]!);
	}
	const factoryTargetNodeIds = new Set(
		inputs.commandHandlerGraph.nodes.flatMap((node) =>
			node.kind === 'HANDLER_TARGET' && node.bodyKind === 'FACTORY_CALL_RESULT_CANDIDATE'
				? [node.nodeId]
				: []
		)
	);

	const projectConfigById = new Map<string, string>();
	const projectProgramById = new Map<string, string>();
	for (const project of snapshot.projects) {
		projectConfigById.set(project.id, project.configPath);
		projectProgramById.set(project.id, project.programId);
	}
	const programProjectById = new Map<string, string>();
	for (const program of snapshot.programs) programProjectById.set(program.id, program.projectId);
	const anchorSourcesByPath = new Map<string, SemanticSourceRecord[]>();
	const sourceById = new Map<string, SemanticSourceRecord>();
	const anchorSourceIds = new Set<string>();
	for (const source of snapshot.sources) {
		if (
			!enforcementPaths.has(source.logicalPath) ||
			source.analysisDisposition !== 'DEEP_INDEXED' ||
			projectConfigById.get(source.projectId) !== APPLICATION_PROJECT_PATH
		)
			continue;
		if (
			programProjectById.get(source.programId) !== source.projectId ||
			projectProgramById.get(source.projectId) !== source.programId
		)
			throw new Error(`Semantic source ${source.id} has inconsistent project/program ownership.`);
		sourceById.set(source.id, source);
		anchorSourceIds.add(source.id);
		grouped(anchorSourcesByPath, source.logicalPath, source);
	}

	const invocationByNode = new Map<string, StaticSemanticSnapshot['invocations'][number]>();
	const calleeNodeIds = new Set<string>();
	for (const invocation of snapshot.invocations) {
		if (!factoryTargetNodeIds.has(invocation.nodeId)) continue;
		invocationByNode.set(invocation.nodeId, invocation);
		calleeNodeIds.add(invocation.calleeNodeId);
	}
	const referencesByNode = new Map<string, StaticSemanticSnapshot['references'][number][]>();
	const symbolIds = new Set<string>();
	for (const reference of snapshot.references) {
		if (!calleeNodeIds.has(reference.nodeId)) continue;
		grouped(referencesByNode, reference.nodeId, reference);
		if (reference.resolvedSymbolId !== null) symbolIds.add(reference.resolvedSymbolId);
	}
	const symbolById = new Map<string, StaticSemanticSnapshot['symbols'][number]>();
	const declarationIds = new Set<string>();
	for (const symbol of snapshot.symbols) {
		if (!symbolIds.has(symbol.id)) continue;
		symbolById.set(symbol.id, symbol);
		for (const declarationId of symbol.declarationIds) declarationIds.add(declarationId);
	}
	const declarationById = new Map<string, SemanticDeclarationRecord>();
	const declarationNodeIds = new Set<string>();
	for (const declaration of snapshot.declarations) {
		if (!declarationIds.has(declaration.id)) continue;
		declarationById.set(declaration.id, declaration);
		if (declaration.nodeId !== null) declarationNodeIds.add(declaration.nodeId);
	}
	const assignmentsByNode = new Map<string, StaticSemanticSnapshot['assignments'][number][]>();
	const explicitNodeIds = new Set<string>(declarationNodeIds);
	for (const assignment of snapshot.assignments) {
		if (!declarationNodeIds.has(assignment.targetNodeId)) continue;
		grouped(assignmentsByNode, assignment.targetNodeId, assignment);
		if (assignment.valueNodeId !== null) explicitNodeIds.add(assignment.valueNodeId);
	}
	const nodeById = new Map<string, SemanticAstNodeRecord>();
	const nodesBySource = new Map<string, SemanticAstNodeRecord[]>();
	for (const node of snapshot.astNodes) {
		if (!anchorSourceIds.has(node.sourceId) && !explicitNodeIds.has(node.id)) continue;
		const source = sourceById.get(node.sourceId);
		if (
			source !== undefined &&
			(!Number.isSafeInteger(node.start) ||
				!Number.isSafeInteger(node.end) ||
				node.start < 0 ||
				node.end < node.start ||
				node.end > source.textLength)
		)
			throw new Error(`Semantic AST node ${node.id} has an invalid source span.`);
		nodeById.set(node.id, node);
		if (source !== undefined) grouped(nodesBySource, node.sourceId, node);
	}
	return {
		anchorSourcesByPath,
		assignmentsByNode,
		declarationById,
		invocationByNode,
		nodeById,
		nodesBySource,
		referencesByNode,
		sourceById,
		symbolById
	};
}

function commandModel(inputs: GuardClassificationOverlayBuildInputs): CommandModel {
	const nodeById = uniqueIndex(
		inputs.commandHandlerGraph.nodes,
		(node) => node.id,
		'Command graph node'
	);
	const edgeById = uniqueIndex(
		inputs.commandHandlerGraph.edges,
		(edge) => edge.id,
		'Command graph edge'
	);
	const occurrences = inputs.commandHandlerGraph.nodes.filter(
		(node): node is CommandArrowOccurrenceNode => node.kind === 'DECLARED_ARROW_OCCURRENCE'
	);
	const sites = inputs.commandHandlerGraph.nodes.filter(
		(node): node is CommandArrowSiteNode => node.kind === 'DECLARED_ARROW_SITE'
	);
	return {
		edgeById,
		edges: inputs.commandHandlerGraph.edges,
		nodeById,
		occurrenceByObservationArrow: uniqueIndex(
			occurrences,
			(node) => node.observationArrowId,
			'Command occurrence observation-arrow'
		),
		siteByObservationSite: uniqueIndex(
			sites,
			(node) => node.observationSiteId,
			'Command site observation-site'
		),
		targetById: new Map(
			inputs.commandHandlerGraph.nodes
				.filter((node): node is HandlerTargetNode => node.kind === 'HANDLER_TARGET')
				.map((node) => [node.id, node])
		)
	};
}

function stateModel(inputs: GuardClassificationOverlayBuildInputs): StateModel {
	return {
		edgeById: uniqueIndex(inputs.stateGraph.edges, (edge) => edge.id, 'State graph edge'),
		stateNodeByObservationState: uniqueIndex(
			inputs.stateGraph.nodes.filter(
				(node): node is StateMachineGraphStateNode => node.kind === 'STATE'
			),
			(node) => node.observationStateId,
			'State graph observation-state'
		)
	};
}

function decodeCompilerText(bytes: Uint8Array): string {
	return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function lineAt(text: string, position: number): number {
	let line = 1;
	for (let index = 0; index < position; index += 1) if (text.charCodeAt(index) === 10) line += 1;
	return line;
}

function callableAncestors(
	node: SemanticAstNodeRecord,
	model: SemanticModel
): readonly SemanticAstNodeRecord[] {
	let current: SemanticAstNodeRecord | undefined = node;
	const callables: SemanticAstNodeRecord[] = [];
	const seen = new Set<string>();
	while (current !== undefined) {
		if (seen.has(current.id)) throw new Error('Semantic AST parent chain is cyclic.');
		seen.add(current.id);
		if (CALLABLE_KINDS.has(current.kind)) callables.push(current);
		if (current.parentId === null) break;
		current = model.nodeById.get(current.parentId);
		if (current === undefined)
			throw new Error(`Semantic AST parent ${node.parentId ?? ''} is absent.`);
	}
	if (callables.length === 0) throw new Error(`Anchor node ${node.id} has no callable ancestor.`);
	return callables;
}

function callableFromDeclaration(
	declaration: SemanticDeclarationRecord,
	model: SemanticModel
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

function factoryCallableForTarget(
	target: HandlerTargetNode,
	model: SemanticModel
): SemanticAstNodeRecord | null {
	if (target.bodyKind !== 'FACTORY_CALL_RESULT_CANDIDATE') return null;
	const invocation = model.invocationByNode.get(target.nodeId);
	if (invocation === undefined) return null;
	const references = (model.referencesByNode.get(invocation.calleeNodeId) ?? []).filter(
		(reference) => reference.resolvedSymbolId !== null
	);
	if (references.length !== 1) return null;
	const symbol = model.symbolById.get(references[0]!.resolvedSymbolId!);
	if (symbol === undefined) return null;
	const callables = symbol.declarationIds
		.map((id) => model.declarationById.get(id))
		.filter((item): item is SemanticDeclarationRecord => item !== undefined)
		.map((declaration) => callableFromDeclaration(declaration, model))
		.filter((item): item is SemanticAstNodeRecord => item !== null);
	return callables.length === 1 ? callables[0]! : null;
}

function assertFrozenBinding(
	inputs: GuardClassificationOverlayBuildInputs,
	path: string,
	expected: { readonly bytes: number; readonly contentSha256?: string; readonly sha256?: string }
): Uint8Array {
	const artifacts = inputs.subject.artifacts.filter((artifact) => artifact.path === path);
	if (artifacts.length !== 1)
		throw new Error(`Frozen artifact ${path} is not represented exactly once.`);
	const bytes = readFrozenSubjectArtifact(inputs.subject, path);
	const digest = bytes === undefined ? null : sha256(bytes);
	const expectedDigest = expected.contentSha256 ?? expected.sha256;
	if (
		bytes === undefined ||
		bytes.byteLength !== expected.bytes ||
		bytes.byteLength !== artifacts[0]!.bytes ||
		digest !== expectedDigest ||
		digest !== artifacts[0]!.sha256
	)
		throw new Error(`Frozen artifact ${path} does not match its exact recorded identity.`);
	return bytes;
}

function assertSharedArtifacts(inputs: GuardClassificationOverlayBuildInputs): void {
	const state = inputs.stateObservation.artifact;
	if (state.path !== STATE_SOURCE_PATH)
		throw new Error(`State-machine observation must bind ${STATE_SOURCE_PATH}.`);
	const guardState = inputs.guardObservation.artifactSet.artifacts.filter(
		(artifact) => artifact.path === STATE_SOURCE_PATH
	);
	const arrowState = inputs.arrowObservation.artifactSet.artifacts.filter(
		(artifact) => artifact.path === STATE_SOURCE_PATH
	);
	if (guardState.length !== 1 || arrowState.length !== 1)
		throw new Error('The retained observations do not bind exactly one shared transition source.');
	for (const artifact of [guardState[0]!, arrowState[0]!])
		if (
			artifact.bytes !== state.bytes ||
			artifact.canonicalPathKey !== state.canonicalPathKey ||
			artifact.primaryClass !== state.primaryClass ||
			artifact.sha256 !== state.sha256
		)
			throw new Error('The retained transition-source identities disagree.');
	assertFrozenBinding(inputs, STATE_SOURCE_PATH, state);

	const guardExclusions = inputs.guardObservation.artifactSet.artifacts.filter(
		(artifact) => artifact.path === MACHINE_EXCLUSIONS_PATH
	);
	const arrowExclusions = inputs.arrowObservation.artifactSet.artifacts.filter(
		(artifact) => artifact.path === MACHINE_EXCLUSIONS_PATH
	);
	if (guardExclusions.length !== 1 || arrowExclusions.length !== 1)
		throw new Error(
			'The retained observations do not bind exactly one shared machine-exclusions source.'
		);
	if (
		guardExclusions[0]!.bytes !== arrowExclusions[0]!.bytes ||
		guardExclusions[0]!.canonicalPathKey !== arrowExclusions[0]!.canonicalPathKey ||
		guardExclusions[0]!.primaryClass !== arrowExclusions[0]!.primaryClass ||
		guardExclusions[0]!.sha256 !== arrowExclusions[0]!.sha256
	)
		throw new Error('The retained machine-exclusion identities disagree.');
	assertFrozenBinding(inputs, MACHINE_EXCLUSIONS_PATH, guardExclusions[0]!);
}

function anchorFact(
	overlayId: GuardClassificationOverlayId,
	path: string,
	anchorText: string,
	inputs: GuardClassificationOverlayBuildInputs,
	model: SemanticModel
): AnchorFact {
	const artifacts = inputs.subject.artifacts.filter((artifact) => artifact.path === path);
	if (artifacts.length !== 1)
		throw new Error(`Frozen artifact ${path} is not represented exactly once.`);
	const bytes = assertFrozenBinding(inputs, path, artifacts[0]!);
	const text = decodeCompilerText(bytes);
	const sources = (model.anchorSourcesByPath.get(path) ?? []).filter(
		(source) =>
			source.bytes === bytes.byteLength &&
			source.contentSha256 === artifacts[0]!.sha256 &&
			source.textLength === text.length
	);
	if (sources.length !== 1)
		throw new Error(`Expected exactly one deep-indexed application semantic source for ${path}.`);
	const source = sources[0]!;
	const start = text.indexOf(anchorText);
	if (start < 0 || text.indexOf(anchorText, start + 1) >= 0)
		throw new Error(`Enforcement anchor in ${path} is absent or non-unique.`);
	const end = start + anchorText.length;
	const containing = (model.nodesBySource.get(source.id) ?? [])
		.filter((node) => node.start <= start && node.end >= end)
		.sort(
			(left, right) =>
				left.end - left.start - (right.end - right.start) || compareText(left.id, right.id)
		);
	if (containing.length === 0)
		throw new Error(`Enforcement anchor in ${path} has no containing AST node.`);
	if (
		containing.length > 1 &&
		containing[0]!.start === containing[1]!.start &&
		containing[0]!.end === containing[1]!.end
	)
		throw new Error(`Enforcement anchor in ${path} has indistinguishable containing AST nodes.`);
	const callables = callableAncestors(containing[0]!, model);
	const callable = callables[0]!;
	return {
		anchorText,
		callable,
		callableAncestors: callables,
		currentLine: lineAt(text, start),
		end,
		id: guardEnforcementAnchorSiteId({ anchorText, end, overlayId, sourceId: source.id, start }),
		path,
		programId: source.programId,
		projectId: source.projectId,
		sourceId: source.id,
		start
	};
}

function exactLegalTransition(
	inputs: GuardClassificationOverlayBuildInputs,
	machine: string,
	from: string,
	to: string,
	guardText: string
): StateMachineTopologyLegalTransitionRecord {
	const machineIds = new Set(
		inputs.stateObservation.machines
			.filter((record) => record.name === machine)
			.map((record) => record.id)
	);
	const matches = inputs.stateObservation.legalTransitions.filter(
		(record) =>
			machineIds.has(record.machineId) &&
			record.from === from &&
			record.to === to &&
			record.guard === guardText
	);
	if (matches.length !== 1)
		throw new Error(
			`Expected one legal transition for ${machine}/${from}/${to}/${guardText}; found ${matches.length}.`
		);
	return matches[0]!;
}

function stateEvidenceIds(
	legal: StateMachineTopologyLegalTransitionRecord,
	inputs: GuardClassificationOverlayBuildInputs,
	model: StateModel
): GuardClassificationOverlayOccurrenceRecord['stateGraphEdgeIds'] {
	const source = model.stateNodeByObservationState.get(legal.fromStateId);
	const target = model.stateNodeByObservationState.get(legal.toStateId);
	if (source === undefined || target === undefined)
		throw new Error(`Legal transition ${legal.id} has no exact state-graph endpoints.`);
	const guarded = inputs.stateObservation.guardedTransitions.filter(
		(record) => record.legalTransitionId === legal.id
	);
	const expectedRecords: readonly { readonly id: string; readonly relationKind: string }[] =
		guarded.length === 0
			? [{ id: legal.id, relationKind: 'LEGAL_TRANSITION' }]
			: guarded.map((record) => ({
					id: record.id,
					relationKind: 'GUARDED_LEGAL_TRANSITION'
				}));
	const edges: StateMachineGraphEdge[] = [];
	for (const expected of expectedRecords) {
		const matches = inputs.stateGraph.edges.filter(
			(edge) =>
				edge.observationRecordId === expected.id &&
				edge.relationKind === expected.relationKind &&
				edge.source.nodeId === source.id &&
				edge.target.nodeId === target.id
		);
		if (matches.length === 0)
			throw new Error(`State observation record ${expected.id} has no exact state-graph evidence.`);
		edges.push(...matches);
	}
	return sortedUnique(edges.map((edge) => edge.id));
}

function incidentEdges(
	edges: readonly CommandHandlerGraphEdge[],
	relationKind: CommandHandlerGraphEdge['relationKind'],
	predicate: (edge: CommandHandlerGraphEdge) => boolean
): CommandHandlerGraphEdge[] {
	return edges.filter((edge) => edge.relationKind === relationKind && predicate(edge));
}

function commandEvidenceLink(
	overlayId: GuardClassificationOverlayId,
	occurrenceId: GuardClassificationOverlayOccurrenceRecord['id'],
	observationArrowId: GuardClassificationOverlayCommandEvidenceLink['observationArrowId'],
	inputs: GuardClassificationOverlayBuildInputs,
	model: CommandModel
): GuardClassificationOverlayCommandEvidenceLink {
	const occurrence = model.occurrenceByObservationArrow.get(observationArrowId);
	if (occurrence === undefined)
		throw new Error(`Declared arrow ${observationArrowId} has no exact command-graph occurrence.`);
	const site = model.siteByObservationSite.get(occurrence.observationSiteId);
	if (site === undefined)
		throw new Error(`Declared arrow ${observationArrowId} has no exact command-graph site.`);
	const siteOccurrence = incidentEdges(
		model.edges,
		'ARROW_SITE_TO_OCCURRENCE',
		(edge) => edge.source.nodeId === site.id && edge.target.nodeId === occurrence.id
	);
	if (siteOccurrence.length !== 1)
		throw new Error(
			`Declared arrow ${observationArrowId} has a non-unique site-to-occurrence edge.`
		);
	const supporting: CommandHandlerGraphEdge[] = [...siteOccurrence];
	const targets: CommandHandlerGraphNodeId[] = [];
	const targetSite = incidentEdges(
		model.edges,
		'HANDLER_TARGET_TO_ARROW_SITE',
		(edge) => edge.target.nodeId === site.id
	);
	if (targetSite.length > 0) {
		supporting.push(...targetSite);
		targets.push(...targetSite.map((edge) => edge.source.nodeId));
	} else {
		const commandSite = incidentEdges(
			model.edges,
			'COMMAND_REGISTRY_ENTRY_TO_TABLE_ARROW_SITE',
			(edge) => edge.target.nodeId === site.id
		);
		supporting.push(...commandSite);
		for (const commandEdge of commandSite) {
			const registrations = incidentEdges(
				model.edges,
				'COMMAND_REGISTRY_ENTRY_TO_HANDLER_REGISTRATION',
				(edge) => edge.source.nodeId === commandEdge.source.nodeId
			);
			supporting.push(...registrations);
			for (const registration of registrations) {
				const registrationTargets = incidentEdges(
					model.edges,
					'HANDLER_REGISTRATION_TO_TARGET',
					(edge) => edge.source.nodeId === registration.target.nodeId
				);
				supporting.push(...registrationTargets);
				targets.push(...registrationTargets.map((edge) => edge.target.nodeId));
			}
		}
	}
	const handlerTargetNodeIds = sortedUnique(targets);
	if (handlerTargetNodeIds.some((id) => !model.targetById.has(id)))
		throw new Error(`Command evidence for ${observationArrowId} references a non-target node.`);
	return {
		attribution: 'EXACT_RETAINED_TUPLE_CORRELATION',
		commandHandlerGraphId: inputs.commandHandlerGraph.id,
		commandOccurrenceNodeId: occurrence.id,
		commandSiteNodeId: site.id,
		handlerTargetNodeIds,
		id: guardCommandEvidenceLinkId({
			commandOccurrenceNodeId: occurrence.id,
			occurrenceId,
			overlayId
		}),
		observationArrowId,
		occurrenceId,
		siteAttribution: site.attribution,
		supportingEdgeIds: sortedUnique(supporting.map((edge) => edge.id))
	};
}

function indexOrder(
	left: GuardClassificationOverlayIndexEntry,
	right: GuardClassificationOverlayIndexEntry
): number {
	return (
		compareText(left.key, right.key) ||
		compareText(
			left.classificationIds[0] ?? left.occurrenceIds[0] ?? '',
			right.classificationIds[0] ?? right.occurrenceIds[0] ?? ''
		)
	);
}

function deriveExpected(inputs: GuardClassificationOverlayBuildInputs): ExpectedDerivation {
	const semantic = semanticModel(inputs);
	const command = commandModel(inputs);
	const state = stateModel(inputs);
	const inputDigest = guardClassificationOverlayInputDigest(inputs);
	const overlayId = guardClassificationOverlayId({
		inputDigest,
		semanticSnapshotId: inputs.semanticSnapshot.id,
		subjectId: inputs.request.subjectId
	});
	const classificationIdByGuard = new Map(
		inputs.guardObservation.guards.map((guard) => [
			guard.id,
			guardClassificationRecordId(overlayId, guard.id)
		])
	);
	if (classificationIdByGuard.size !== inputs.guardObservation.guards.length)
		throw new Error('Guard ledger guard identities are duplicated.');

	const commandEvidenceLinks: GuardClassificationOverlayCommandEvidenceLink[] = [];
	const occurrenceDrafts: GuardClassificationOverlayOccurrenceRecord[] = [];
	const frontiers: GuardClassificationOverlayFrontier[] = [];
	for (const arrow of inputs.guardObservation.guardedArrows) {
		const classificationId = classificationIdByGuard.get(arrow.guardId);
		if (classificationId === undefined)
			throw new Error(`Guarded arrow ${arrow.id} references an absent guard record.`);
		const occurrenceId = guardOccurrenceRecordId(overlayId, arrow.id);
		const legal = exactLegalTransition(
			inputs,
			arrow.machine,
			arrow.from,
			arrow.to,
			arrow.guardText
		);
		const matches = inputs.arrowObservation.declaredArrows.filter(
			(candidate) =>
				candidate.machine === arrow.machine &&
				candidate.from === arrow.from &&
				candidate.to === arrow.to
		);
		const links = matches
			.map((match) => commandEvidenceLink(overlayId, occurrenceId, match.id, inputs, command))
			.sort((left, right) => compareText(left.id, right.id));
		commandEvidenceLinks.push(...links);
		const frontierIds: GuardClassificationOverlayOccurrenceRecord['frontierIds'][number][] = [];
		if (links.length === 0) {
			const frontier: GuardClassificationOverlayFrontier = {
				anchorSiteId: null,
				classificationId,
				frontierKind: 'NO_RETAINED_DECLARED_ARROW_EVIDENCE',
				id: guardClassificationFrontierId({
					anchorSiteId: null,
					classificationId,
					frontierKind: 'NO_RETAINED_DECLARED_ARROW_EVIDENCE',
					occurrenceId,
					overlayId
				}),
				occurrenceId,
				reason:
					'No declared-arrow occurrence in the retained census matches this exact machine/from/to tuple.'
			};
			frontiers.push(frontier);
			frontierIds.push(frontier.id);
		}
		occurrenceDrafts.push({
			arrowId: arrow.id,
			classificationId,
			commandEvidenceLinkIds: links.map((link) => link.id),
			frontierIds,
			from: arrow.from,
			guardText: arrow.guardText,
			id: occurrenceId,
			legalTransitionId: legal.id,
			machine: arrow.machine,
			stateGraphEdgeIds: stateEvidenceIds(legal, inputs, state),
			to: arrow.to
		});
	}
	commandEvidenceLinks.sort((left, right) => compareText(left.id, right.id));
	occurrenceDrafts.sort((left, right) => compareText(left.id, right.id));

	const occurrencesByClassification = new Map<
		GuardClassificationOverlayClassificationId,
		GuardClassificationOverlayOccurrenceRecord[]
	>();
	for (const occurrence of occurrenceDrafts)
		grouped(occurrencesByClassification, occurrence.classificationId, occurrence);
	const anchorByKey = new Map<string, AnchorFact>();
	const anchorClassifications = new Map<string, GuardClassificationOverlayClassificationId[]>();
	for (const guard of inputs.guardObservation.guards) {
		if (guard.enforcingAnchor === null && guard.enforcingSite === null) continue;
		if (guard.enforcingSite === null || guard.enforcingAnchor === null)
			throw new Error(`Guard citation ${guard.id} lacks an exact site or anchor.`);
		const match = ENFORCING_SITE.exec(guard.enforcingSite);
		if (match === null)
			throw new Error(`ENFORCED guard ${guard.id} has an unsupported site grammar.`);
		const path = match[1]!;
		const key = `${path}\0${guard.enforcingAnchor}`;
		let fact = anchorByKey.get(key);
		if (fact === undefined) {
			fact = anchorFact(overlayId, path, guard.enforcingAnchor, inputs, semantic);
			anchorByKey.set(key, fact);
		}
		grouped(anchorClassifications, fact.id, classificationIdByGuard.get(guard.id)!);
	}
	const anchorByClassification = new Map<string, AnchorFact>();
	for (const [anchorId, ids] of anchorClassifications) {
		const fact = [...anchorByKey.values()].find((item) => item.id === anchorId)!;
		for (const id of ids) anchorByClassification.set(id, fact);
	}

	const classifications: GuardClassificationOverlayClassificationRecord[] =
		inputs.guardObservation.guards
			.map((guard): GuardClassificationOverlayClassificationRecord => {
				const id = classificationIdByGuard.get(guard.id)!;
				const anchor = anchorByClassification.get(id);
				if (guard.ledgerState === 'STALE' || guard.ledgerState === 'UNCLASSIFIED') {
					const frontierKind =
						guard.ledgerState === 'STALE' ? 'STALE_LEDGER_ROW' : 'UNCLASSIFIED_GUARD_TEXT';
					frontiers.push({
						anchorSiteId: null,
						classificationId: id,
						frontierKind,
						id: guardClassificationFrontierId({
							anchorSiteId: null,
							classificationId: id,
							frontierKind,
							occurrenceId: null,
							overlayId
						}),
						occurrenceId: null,
						reason:
							guard.ledgerState === 'STALE'
								? 'The retained guard-classification row is stale and is not promoted by this overlay.'
								: 'The retained guard text has no classification and remains an explicit frontier.'
					});
				}
				return {
					anchorSiteId: anchor?.id ?? null,
					disposition: guard.disposition,
					enforcingAnchor: guard.enforcingAnchor,
					enforcingSite: guard.enforcingSite,
					evidence: guard.evidence,
					guardId: guard.id,
					guardText: guard.guardText,
					id,
					ledgerState: guard.ledgerState,
					occurrenceIds: sortedUnique(
						(occurrencesByClassification.get(id) ?? []).map((occurrence) => occurrence.id)
					)
				};
			})
			.sort((left, right) => compareText(left.id, right.id));

	const handlerLinks: GuardClassificationOverlayHandlerLink[] = [];
	const anchorSites: GuardClassificationOverlayAnchorSite[] = [];
	for (const fact of [...anchorByKey.values()].sort((left, right) =>
		compareText(left.id, right.id)
	)) {
		const containingCallableIds = new Set(fact.callableAncestors.map((callable) => callable.id));
		const classificationIds = sortedUnique(anchorClassifications.get(fact.id) ?? []);
		const anchorFrontierIds: GuardClassificationOverlayFrontier['id'][] = [];
		for (const classificationId of classificationIds) {
			const occurrenceIds = (occurrencesByClassification.get(classificationId) ?? []).map(
				(occurrence) => occurrence.id
			);
			const links = commandEvidenceLinks.filter((link) =>
				occurrenceIds.includes(link.occurrenceId)
			);
			const exactTargets = new Map<HandlerTargetNode['id'], HandlerTargetNode>();
			for (const link of links)
				for (const targetId of link.handlerTargetNodeIds) {
					const target = command.targetById.get(targetId);
					if (target?.bodyKind === 'DIRECT_FUNCTION' && containingCallableIds.has(target.nodeId))
						exactTargets.set(target.id, target);
				}
			if (exactTargets.size === 1) {
				const target = [...exactTargets.values()][0]!;
				const targetNodeIds = [target.id] as const;
				handlerLinks.push({
					anchorSiteId: fact.id,
					attribution: 'EXACT',
					commandHandlerGraphId: inputs.commandHandlerGraph.id,
					id: guardEnforcementHandlerLinkId({
						anchorSiteId: fact.id,
						attribution: 'EXACT',
						overlayId,
						targetNodeIds
					}),
					kind: 'EXACT_HANDLER_TARGET',
					supportingEdgeIds: sortedUnique(
						links
							.filter((link) => link.handlerTargetNodeIds.includes(target.id))
							.flatMap((link) => link.supportingEdgeIds)
					),
					targetNodeIds
				});
				continue;
			}
			const factoryTargets = new Map<
				HandlerTargetNode['id'],
				{ readonly callable: SemanticAstNodeRecord; readonly target: HandlerTargetNode }
			>();
			for (const link of links)
				for (const targetId of link.handlerTargetNodeIds) {
					const target = command.targetById.get(targetId);
					if (target === undefined) continue;
					const factoryCallable = factoryCallableForTarget(target, semantic);
					if (factoryCallable !== null && containingCallableIds.has(factoryCallable.id))
						factoryTargets.set(target.id, { callable: factoryCallable, target });
				}
			const factoryCallableIds = sortedUnique(
				[...factoryTargets.values()].map((match) => match.callable.id)
			);
			const frontierKind =
				factoryTargets.size > 0 && factoryCallableIds.length === 1
					? 'FACTORY_HANDLER_ATTRIBUTION_CANDIDATE'
					: 'HELPER_CALL_FLOW_UNRESOLVED';
			if (factoryTargets.size > 0 && factoryCallableIds.length === 1) {
				const factoryCallableNodeId = factoryCallableIds[0]!;
				const targetNodeIds = sortedUnique(factoryTargets.keys());
				handlerLinks.push({
					anchorSiteId: fact.id,
					attribution: 'CANDIDATE',
					commandHandlerGraphId: inputs.commandHandlerGraph.id,
					factoryCallableNodeId,
					id: guardEnforcementHandlerLinkId({
						anchorSiteId: fact.id,
						attribution: 'CANDIDATE',
						factoryCallableNodeId,
						overlayId,
						targetNodeIds
					}),
					kind: 'FACTORY_SHARED_CANDIDATE',
					supportingEdgeIds: sortedUnique(
						links
							.filter((link) =>
								link.handlerTargetNodeIds.some((targetId) => factoryTargets.has(targetId))
							)
							.flatMap((link) => link.supportingEdgeIds)
					),
					targetNodeIds
				});
			}
			const frontier: GuardClassificationOverlayFrontier = {
				anchorSiteId: fact.id,
				classificationId,
				frontierKind,
				id: guardClassificationFrontierId({
					anchorSiteId: fact.id,
					classificationId,
					frontierKind,
					occurrenceId: null,
					overlayId
				}),
				occurrenceId: null,
				reason:
					frontierKind === 'FACTORY_HANDLER_ATTRIBUTION_CANDIDATE'
						? 'The anchor is contained by a shared factory callable; registered factory-result targets remain candidates.'
						: 'The anchor callable is not an exact registered handler target or a resolved shared factory callable; helper call flow is not modeled.'
			};
			frontiers.push(frontier);
			anchorFrontierIds.push(frontier.id);
		}
		const localHandlerLinks = handlerLinks.filter((link) => link.anchorSiteId === fact.id);
		anchorSites.push({
			anchorText: fact.anchorText,
			callableNodeId: fact.callable.id,
			classificationIds,
			currentLine: fact.currentLine,
			end: fact.end,
			frontierIds: sortedUnique(anchorFrontierIds),
			handlerLinkIds: sortedUnique(localHandlerLinks.map((link) => link.id)),
			id: fact.id,
			path: fact.path,
			programId: fact.programId,
			projectId: fact.projectId,
			sourceId: fact.sourceId,
			start: fact.start
		});
	}
	const deduplicatedHandlerLinks = [
		...new Map(handlerLinks.map((link) => [link.id, link])).values()
	];
	handlerLinks.splice(0, handlerLinks.length, ...deduplicatedHandlerLinks);
	handlerLinks.sort((left, right) => compareText(left.id, right.id));
	frontiers.sort((left, right) => compareText(left.id, right.id));
	anchorSites.sort((left, right) => compareText(left.id, right.id));
	const occurrences = occurrenceDrafts
		.map((occurrence): GuardClassificationOverlayOccurrenceRecord => ({
			...occurrence,
			frontierIds: sortedUnique(
				frontiers
					.filter(
						(frontier) =>
							frontier.classificationId === occurrence.classificationId &&
							(frontier.occurrenceId === null || frontier.occurrenceId === occurrence.id)
					)
					.map((frontier) => frontier.id)
			)
		}))
		.sort((left, right) => compareText(left.id, right.id));

	const occurrenceById = new Map(occurrences.map((occurrence) => [occurrence.id, occurrence]));
	const classificationById = new Map(
		classifications.map((classification) => [classification.id, classification])
	);
	const anchorSiteById = new Map(anchorSites.map((anchor) => [anchor.id, anchor]));
	const handlerLinksByAnchor = new Map<string, GuardClassificationOverlayHandlerLink[]>();
	for (const link of handlerLinks) grouped(handlerLinksByAnchor, link.anchorSiteId, link);
	const frontiersForClassification = (
		classificationId: string
	): GuardClassificationOverlayFrontier['id'][] =>
		sortedUnique(
			frontiers
				.filter((frontier) => frontier.classificationId === classificationId)
				.map((frontier) => frontier.id)
		);
	const forwardIndex = classifications
		.map((classification): GuardClassificationOverlayIndexEntry => {
			const occurrences = classification.occurrenceIds.map((id) => occurrenceById.get(id)!);
			const anchor =
				classification.anchorSiteId === null
					? undefined
					: anchorSiteById.get(classification.anchorSiteId);
			return {
				anchorSiteIds: anchor === undefined ? [] : [anchor.id],
				classificationIds: [classification.id],
				commandEvidenceLinkIds: sortedUnique(
					occurrences.flatMap((occurrence) => occurrence.commandEvidenceLinkIds)
				),
				frontierIds: frontiersForClassification(classification.id),
				handlerLinkIds: sortedUnique(
					(handlerLinksByAnchor.get(anchor?.id ?? '') ?? []).map((link) => link.id)
				),
				key: classification.guardText,
				occurrenceIds: classification.occurrenceIds
			};
		})
		.sort(indexOrder);
	const reverseIndex = occurrences
		.map((occurrence): GuardClassificationOverlayIndexEntry => {
			const classification = classificationById.get(occurrence.classificationId)!;
			const anchor =
				classification.anchorSiteId === null
					? undefined
					: anchorSiteById.get(classification.anchorSiteId);
			return {
				anchorSiteIds: anchor === undefined ? [] : [anchor.id],
				classificationIds: [classification.id],
				commandEvidenceLinkIds: occurrence.commandEvidenceLinkIds,
				frontierIds: occurrence.frontierIds,
				handlerLinkIds: sortedUnique(
					(handlerLinksByAnchor.get(anchor?.id ?? '') ?? []).map((link) => link.id)
				),
				key: `${occurrence.machine}\0${occurrence.from}\0${occurrence.to}`,
				occurrenceIds: [occurrence.id]
			};
		})
		.sort(indexOrder);

	const dispositionCounts = [...new Set(classifications.map((item) => item.disposition))]
		.sort((left, right) =>
			left === null ? (right === null ? 0 : -1) : right === null ? 1 : compareText(left, right)
		)
		.map((disposition) => ({
			count: classifications.filter((item) => item.disposition === disposition).length,
			disposition
		}));
	const stateEvidenceRefs = occurrences.reduce(
		(sum, occurrence) => sum + occurrence.stateGraphEdgeIds.length,
		0
	);
	const coverage: GuardClassificationOverlayCoverage = {
		anchorSites: anchorSites.length,
		candidateFactoryHandlerLinks: handlerLinks.filter(
			(link) => link.kind === 'FACTORY_SHARED_CANDIDATE'
		).length,
		classifications: classifications.length,
		commandEvidenceLinks: commandEvidenceLinks.length,
		commandEvidenceOccurrences: occurrences.filter(
			(occurrence) => occurrence.commandEvidenceLinkIds.length > 0
		).length,
		directHandlerLinks: handlerLinks.filter((link) => link.kind === 'EXACT_HANDLER_TARGET').length,
		dispositionCounts,
		expectedClassifications: inputs.guardObservation.guards.length,
		expectedCommandEvidenceLinks: inputs.guardObservation.guardedArrows.reduce(
			(sum, arrow) =>
				sum +
				inputs.arrowObservation.declaredArrows.filter(
					(candidate) =>
						candidate.machine === arrow.machine &&
						candidate.from === arrow.from &&
						candidate.to === arrow.to
				).length,
			0
		),
		expectedOccurrences: inputs.guardObservation.guardedArrows.length,
		expectedStateEvidenceRefs: stateEvidenceRefs,
		frontiers: frontiers.length,
		helperFrontiers: frontiers.filter(
			(frontier) => frontier.frontierKind === 'HELPER_CALL_FLOW_UNRESOLVED'
		).length,
		noCommandEvidenceFrontiers: frontiers.filter(
			(frontier) => frontier.frontierKind === 'NO_RETAINED_DECLARED_ARROW_EVIDENCE'
		).length,
		occurrences: occurrences.length,
		reconciles:
			classifications.length === inputs.guardObservation.guards.length &&
			occurrences.length === inputs.guardObservation.guardedArrows.length &&
			commandEvidenceLinks.length ===
				inputs.guardObservation.guardedArrows.reduce(
					(sum, arrow) =>
						sum +
						inputs.arrowObservation.declaredArrows.filter(
							(candidate) =>
								candidate.machine === arrow.machine &&
								candidate.from === arrow.from &&
								candidate.to === arrow.to
						).length,
					0
				),
		stateEvidenceRefs
	};
	const exactHandlerLinkIds = handlerLinks
		.filter((link) => link.attribution === 'EXACT')
		.map((link) => link.id);
	const candidateHandlerLinkIds = handlerLinks
		.filter((link) => link.attribution === 'CANDIDATE')
		.map((link) => link.id);
	const derivationLayer: GuardClassificationOverlayLayer = {
		capability: GUARD_CLASSIFICATION_OVERLAY_DERIVATION_CAPABILITY,
		capabilityStatus: GUARD_CLASSIFICATION_OVERLAY_CAPABILITY_STATUS,
		classificationIds: classifications.map((classification) => classification.id),
		commandEvidenceLinkIds: commandEvidenceLinks.map((link) => link.id),
		frontierIds: frontiers
			.filter((frontier) =>
				[
					'NO_RETAINED_DECLARED_ARROW_EVIDENCE',
					'STALE_LEDGER_ROW',
					'UNCLASSIFIED_GUARD_TEXT'
				].includes(frontier.frontierKind)
			)
			.map((frontier) => frontier.id),
		handlerLinkIds: exactHandlerLinkIds,
		id: guardClassificationOverlayLayerId(overlayId, 'DERIVATION'),
		kind: 'JPWB_GUARD_CLASSIFICATION_DERIVATION',
		occurrenceIds: occurrences.map((occurrence) => occurrence.id),
		ordinal: 0,
		overlayId
	};
	const inferenceLayer: GuardClassificationOverlayLayer = {
		capability: GUARD_CLASSIFICATION_OVERLAY_INFERENCE_CAPABILITY,
		capabilityStatus: GUARD_CLASSIFICATION_OVERLAY_CAPABILITY_STATUS,
		classificationIds: [],
		commandEvidenceLinkIds: [],
		frontierIds: frontiers
			.filter((frontier) =>
				['FACTORY_HANDLER_ATTRIBUTION_CANDIDATE', 'HELPER_CALL_FLOW_UNRESOLVED'].includes(
					frontier.frontierKind
				)
			)
			.map((frontier) => frontier.id),
		handlerLinkIds: candidateHandlerLinkIds,
		id: guardClassificationOverlayLayerId(overlayId, 'INFERENCE'),
		kind: 'JPWB_GUARD_HANDLER_INFERENCE',
		occurrenceIds: [],
		ordinal: 1,
		overlayId
	};
	const content = {
		anchorSites,
		arrowObservationContentDigest: inputs.arrowObservation.contentDigest,
		arrowObservationId: inputs.arrowObservation.id,
		authorityTransfer: GUARD_CLASSIFICATION_OVERLAY_AUTHORITY_TRANSFER,
		baselineChange: GUARD_CLASSIFICATION_OVERLAY_BASELINE_CHANGE,
		budgets: inputs.request.budgets,
		canonicalProfile: GUARD_CLASSIFICATION_OVERLAY_CANONICAL_PROFILE,
		capabilities: [
			GUARD_CLASSIFICATION_OVERLAY_DERIVATION_CAPABILITY,
			GUARD_CLASSIFICATION_OVERLAY_INFERENCE_CAPABILITY
		] as const,
		capabilityStatus: GUARD_CLASSIFICATION_OVERLAY_CAPABILITY_STATUS,
		classifications,
		commandEvidenceLinks,
		commandHandlerGraphContentDigest: inputs.commandHandlerGraph.contentDigest,
		commandHandlerGraphId: inputs.commandHandlerGraph.id,
		coverage,
		forwardIndex,
		frontiers,
		fullJanCsaa007Conformance: GUARD_CLASSIFICATION_OVERLAY_FULL_JAN_CSAA_007_CONFORMANCE,
		fullJanCsaa008Conformance: GUARD_CLASSIFICATION_OVERLAY_FULL_JAN_CSAA_008_CONFORMANCE,
		gateEffect: GUARD_CLASSIFICATION_OVERLAY_GATE_EFFECT,
		graphAuthority: GUARD_CLASSIFICATION_OVERLAY_GRAPH_AUTHORITY,
		guardObservationContentDigest: inputs.guardObservation.contentDigest,
		guardObservationId: inputs.guardObservation.id,
		handlerLinks,
		health: 'PARTIAL' as const,
		id: overlayId,
		inputDigest,
		integrationStrategy: GUARD_CLASSIFICATION_OVERLAY_INTEGRATION_STRATEGY,
		layers: [derivationLayer, inferenceLayer] as const,
		limitations: GUARD_CLASSIFICATION_OVERLAY_LIMITATIONS,
		method: GUARD_CLASSIFICATION_OVERLAY_METHOD,
		occurrences,
		operationVersion: GUARD_CLASSIFICATION_OVERLAY_OPERATION_VERSION,
		oracleChange: GUARD_CLASSIFICATION_OVERLAY_ORACLE_CHANGE,
		producer: inputs.semanticSnapshot.provider,
		registryStatus: GUARD_CLASSIFICATION_OVERLAY_REGISTRY_STATUS,
		replacementEquivalence: GUARD_CLASSIFICATION_OVERLAY_REPLACEMENT_EQUIVALENCE,
		reverseIndex,
		runtimeEnforcement: GUARD_CLASSIFICATION_OVERLAY_RUNTIME_ENFORCEMENT,
		runtimePerformability: GUARD_CLASSIFICATION_OVERLAY_RUNTIME_PERFORMABILITY,
		schemaVersion: GUARD_CLASSIFICATION_OVERLAY_SCHEMA_VERSION,
		scope: GUARD_CLASSIFICATION_OVERLAY_SCOPE,
		semanticSnapshotId: inputs.semanticSnapshot.id,
		stateGraphContentDigest: inputs.stateGraph.contentDigest,
		stateGraphId: inputs.stateGraph.id,
		stateObservationContentDigest: inputs.stateObservation.contentDigest,
		stateObservationId: inputs.stateObservation.id,
		subjectId: inputs.request.subjectId
	};
	const expected: GuardClassificationOverlaySnapshot = {
		...content,
		contentDigest: guardClassificationOverlayContentDigest(content)
	};
	const sourceBytesByPath = new Map<string, number>();
	for (const anchor of anchorSites)
		sourceBytesByPath.set(anchor.path, semantic.sourceById.get(anchor.sourceId)!.bytes);
	const sourceBytes = [...sourceBytesByPath.values()].reduce((sum, bytes) => sum + bytes, 0);
	return { expected, sourceBytes };
}

function requestValid(inputs: GuardClassificationOverlayBuildInputs): boolean {
	const request = inputs.request;
	return (
		plainObject(inputs) &&
		exactKeys(inputs, INPUT_KEYS) &&
		plainObject(request) &&
		exactKeys(request, REQUEST_KEYS) &&
		plainObject(request.budgets) &&
		exactKeys(request.budgets, BUDGET_KEYS) &&
		(Object.values(request.budgets) as unknown[]).every(
			(value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1
		) &&
		request.schemaVersion === GUARD_CLASSIFICATION_OVERLAY_REQUEST_SCHEMA_VERSION &&
		request.operationVersion === GUARD_CLASSIFICATION_OVERLAY_OPERATION_VERSION
	);
}

function inputIdentityValid(inputs: GuardClassificationOverlayBuildInputs): boolean {
	const { request } = inputs;
	const subjectId = inputs.subject.descriptor.subjectId;
	return (
		request.subjectId === subjectId &&
		inputs.arrowObservation.subjectId === subjectId &&
		inputs.commandHandlerGraph.subjectId === subjectId &&
		inputs.commandHandlerRequest.subjectId === subjectId &&
		inputs.guardObservation.subjectId === subjectId &&
		inputs.guardObservation.artifactSet.subjectId === subjectId &&
		inputs.semanticSnapshot.subjectId === subjectId &&
		inputs.stateGraph.subjectId === subjectId &&
		inputs.stateGraphRequest.subjectId === subjectId &&
		inputs.stateObservation.subjectId === subjectId &&
		request.arrowObservationId === inputs.arrowObservation.id &&
		request.commandHandlerGraphId === inputs.commandHandlerGraph.id &&
		request.guardObservationId === inputs.guardObservation.id &&
		request.semanticSnapshotId === inputs.semanticSnapshot.id &&
		request.stateGraphId === inputs.stateGraph.id &&
		request.stateObservationId === inputs.stateObservation.id &&
		inputs.commandHandlerRequest.arrowObservationId === inputs.arrowObservation.id &&
		inputs.commandHandlerRequest.semanticSnapshotId === inputs.semanticSnapshot.id &&
		inputs.commandHandlerGraph.arrowObservationId === inputs.arrowObservation.id &&
		inputs.commandHandlerGraph.semanticSnapshotId === inputs.semanticSnapshot.id &&
		inputs.stateGraphRequest.observationId === inputs.stateObservation.id &&
		inputs.stateGraphRequest.semanticSnapshotId === inputs.semanticSnapshot.id &&
		inputs.stateGraph.semanticSnapshotId === inputs.semanticSnapshot.id
	);
}

function predecessorIssue(
	inputs: GuardClassificationOverlayBuildInputs,
	limits: ValidationLimits
): string | null {
	const maxIssues = Math.min(limits.maxIssues, 100_000);
	const guard = validateGuardEnforcementLedgerObservation(inputs.guardObservation, inputs.subject, {
		maxIssues,
		maxRecords: limits.maxInputRecords,
		maxStringCharacters: limits.maxInputStringCharacters
	});
	if (guard.state !== 'VALID')
		return `Guard observation is not independently valid (${guard.state}).`;
	const stateObservation = validateStateMachineTopologyObservation(
		inputs.stateObservation,
		inputs.subject
	);
	if (stateObservation.state !== 'VALID')
		return `State observation is not independently valid (${stateObservation.state}).`;
	const stateGraph = validateStateMachineGraph(
		inputs.stateGraph,
		inputs.stateGraphRequest,
		inputs.semanticSnapshot,
		inputs.stateObservation,
		{ maxIssues }
	);
	if (stateGraph.state !== 'VALID')
		return `State graph is not independently valid (${stateGraph.state}).`;
	const arrow = validateArrowCommandCensusObservation(inputs.arrowObservation, inputs.subject, {
		maxIssues
	});
	if (arrow.state !== 'VALID')
		return `Arrow observation is not independently valid (${arrow.state}).`;
	const command = validateConstructedCommandHandlerGraph(
		inputs.commandHandlerGraph,
		inputs.semanticSnapshot,
		inputs.arrowObservation,
		inputs.subject,
		commandHandlerGraphInputDigest(
			inputs.commandHandlerRequest,
			inputs.semanticSnapshot,
			inputs.arrowObservation
		),
		{
			maxIssues,
			maxRecords: limits.maxInputRecords,
			maxStringCharacters: limits.maxInputStringCharacters
		}
	);
	if (command.state !== 'VALID')
		return `Command-handler graph is not independently valid (${command.state}).`;
	return null;
}

/**
 * Independently validates the bounded guard-classification overlay from explicit predecessor
 * requests and products. No candidate-derived request or candidate population is trusted.
 */
export function validateGuardClassificationOverlay(
	value: unknown,
	inputs: GuardClassificationOverlayBuildInputs,
	options?: GuardClassificationOverlayValidationOptions
): GuardClassificationOverlayValidationResult {
	let limits: ValidationLimits;
	try {
		limits = materializeOptions(options);
	} catch (error) {
		return invalidResult(
			'SHAPE_INVALID',
			'$options',
			error instanceof Error ? error.message : 'Validation options are invalid.'
		);
	}
	const candidateInspection = inspectPlainData([{ path: '$', value }], {
		maxDepth: limits.maxDepth,
		maxRecords: limits.maxRecords,
		maxStringCharacters: limits.maxStringCharacters
	});
	if (candidateInspection !== null)
		return invalidResult(
			candidateInspection.budget ? 'BUDGET_EXHAUSTED' : 'SHAPE_INVALID',
			candidateInspection.path,
			candidateInspection.message,
			candidateInspection.budget
		);
	const inputShell = inspectRecordShell(inputs, '$inputs');
	if (inputShell !== null)
		return invalidResult('SHAPE_INVALID', inputShell.path, inputShell.message);
	if (!isFrozenSubjectCapability(inputs.subject))
		return invalidResult(
			'INPUT_INVALID',
			'$inputs.subject',
			'FrozenSubject bytes capability is unavailable.'
		);
	const inputInspection = inspectPlainData(
		[
			{ path: '$inputs.request', value: inputs.request },
			{ path: '$inputs.commandHandlerRequest', value: inputs.commandHandlerRequest },
			{ path: '$inputs.guardObservation', value: inputs.guardObservation },
			{ path: '$inputs.stateObservation', value: inputs.stateObservation },
			{ path: '$inputs.stateGraphRequest', value: inputs.stateGraphRequest },
			{ path: '$inputs.stateGraph', value: inputs.stateGraph },
			{ path: '$inputs.arrowObservation', value: inputs.arrowObservation },
			{ path: '$inputs.commandHandlerGraph', value: inputs.commandHandlerGraph }
		],
		{
			maxDepth: limits.maxDepth,
			maxRecords: limits.maxInputRecords,
			maxStringCharacters: limits.maxInputStringCharacters
		}
	);
	if (inputInspection !== null)
		return invalidResult(
			inputInspection.budget ? 'BUDGET_EXHAUSTED' : 'SHAPE_INVALID',
			inputInspection.path,
			inputInspection.message,
			inputInspection.budget
		);
	const semanticShell = inspectRecordShell(inputs.semanticSnapshot, '$inputs.semanticSnapshot');
	if (semanticShell !== null)
		return invalidResult('SHAPE_INVALID', semanticShell.path, semanticShell.message);
	let remainingSemanticRecords = limits.maxInputRecords;
	for (const name of [
		'capabilities',
		'projects',
		'programs',
		'sources',
		'astNodes',
		'assignments',
		'references',
		'invocations',
		'declarations',
		'symbols'
	] as const) {
		const population = inputs.semanticSnapshot[name];
		const shell = inspectArrayShell(
			population,
			`$inputs.semanticSnapshot.${name}`,
			remainingSemanticRecords
		);
		if (shell !== null)
			return invalidResult(
				shell.budget ? 'BUDGET_EXHAUSTED' : 'SHAPE_INVALID',
				shell.path,
				shell.message,
				shell.budget
			);
		remainingSemanticRecords -= population.length;
	}
	try {
		if (!requestValid(inputs))
			return invalidResult(
				'INPUT_INVALID',
				'$inputs.request',
				'Build inputs or request do not have the exact supported shape and constants.'
			);
		if (!inputIdentityValid(inputs))
			return invalidResult(
				'INPUT_INVALID',
				'$inputs',
				'Explicit requests and predecessor products do not share exact identities.'
			);
		const requiredCapabilities = ['TS_PROJECT', 'TS_SYNTAX', 'TS_SYMBOL'] as const;
		if (
			!requiredCapabilities.every((required) =>
				inputs.semanticSnapshot.capabilities.some(
					(capability) => capability.capability === required && capability.state !== 'UNSUPPORTED'
				)
			)
		)
			return invalidResult(
				'INPUT_INVALID',
				'$inputs.semanticSnapshot.capabilities',
				'TS_PROJECT, TS_SYNTAX, and TS_SYMBOL are required.'
			);
		const upstream = predecessorIssue(inputs, limits);
		if (upstream !== null) return invalidResult('INPUT_INVALID', '$inputs', upstream);
		assertSharedArtifacts(inputs);
		const { expected, sourceBytes } = deriveExpected(inputs);
		const populations = [
			['maxAnchorSites', expected.anchorSites.length, inputs.request.budgets.maxAnchorSites],
			['maxAstNodes', inputs.semanticSnapshot.astNodes.length, inputs.request.budgets.maxAstNodes],
			[
				'maxCommandEvidenceLinks',
				expected.commandEvidenceLinks.length,
				inputs.request.budgets.maxCommandEvidenceLinks
			],
			['maxFrontiers', expected.frontiers.length, inputs.request.budgets.maxFrontiers],
			[
				'maxGuardOccurrences',
				expected.occurrences.length,
				inputs.request.budgets.maxGuardOccurrences
			],
			['maxGuardRecords', expected.classifications.length, inputs.request.budgets.maxGuardRecords],
			['maxHandlerLinks', expected.handlerLinks.length, inputs.request.budgets.maxHandlerLinks],
			['maxSourceBytes', sourceBytes, inputs.request.budgets.maxSourceBytes],
			[
				'maxStateEvidenceRefs',
				expected.coverage.stateEvidenceRefs,
				inputs.request.budgets.maxStateEvidenceRefs
			]
		] as const;
		const exceeded = populations.find(([, actual, maximum]) => actual > maximum);
		if (exceeded !== undefined)
			return invalidResult(
				'BUDGET_EXHAUSTED',
				`$inputs.request.budgets.${exceeded[0]}`,
				`Caller operation guard exceeded: ${exceeded[1]} > ${exceeded[2]}.`,
				true
			);
		if (!same(value, expected))
			return invalidResult(
				'POPULATION_MISMATCH',
				'$',
				'Overlay does not exactly reproduce the independently derived canonical population.'
			);
		return { issues: [], state: 'VALID' };
	} catch (error) {
		return invalidResult(
			'POPULATION_MISMATCH',
			'$',
			error instanceof Error
				? `Independent overlay derivation failed closed: ${error.message}`
				: 'Independent overlay derivation failed closed.'
		);
	}
}

/** Builder-facing name; it intentionally executes the same independent public derivation. */
export const validateConstructedGuardClassificationOverlay = validateGuardClassificationOverlay;
