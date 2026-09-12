import { isProxy } from 'node:util/types';
import ts from 'typescript';

import type {
	CommandArrowOccurrenceNode,
	CommandArrowSiteNode,
	CommandHandlerGraphEdge,
	CommandHandlerGraphNode,
	HandlerTargetNode
} from '../contracts/command-handler-graph.js';
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
	GUARD_CLASSIFICATION_OVERLAY_PROGRESS_SCHEMA_VERSION,
	GUARD_CLASSIFICATION_OVERLAY_REGISTRY_STATUS,
	GUARD_CLASSIFICATION_OVERLAY_REPLACEMENT_EQUIVALENCE,
	GUARD_CLASSIFICATION_OVERLAY_REQUEST_SCHEMA_VERSION,
	GUARD_CLASSIFICATION_OVERLAY_RUNTIME_ENFORCEMENT,
	GUARD_CLASSIFICATION_OVERLAY_RUNTIME_PERFORMABILITY,
	GUARD_CLASSIFICATION_OVERLAY_SCHEMA_VERSION,
	GUARD_CLASSIFICATION_OVERLAY_SCOPE,
	type BuildGuardClassificationOverlayOptions,
	type BuildGuardClassificationOverlayRequest,
	type GuardClassificationOverlayAnchorSite,
	type GuardClassificationOverlayBuildInputs,
	type GuardClassificationOverlayBuildOutcome,
	type GuardClassificationOverlayClassificationRecord,
	type GuardClassificationOverlayCommandEvidenceLink,
	type GuardClassificationOverlayCoverage,
	type GuardClassificationOverlayDiagnostic,
	type GuardClassificationOverlayFrontier,
	type GuardClassificationOverlayHandlerLink,
	type GuardClassificationOverlayIndexEntry,
	type GuardClassificationOverlayLayer,
	type GuardClassificationOverlayOccurrenceRecord,
	type GuardClassificationOverlayProgressEvent,
	type GuardClassificationOverlayProgressPhase,
	type GuardClassificationOverlaySnapshot
} from '../contracts/guard-classification-overlay.js';
import type { GuardEnforcementLedgerGuardRecord } from '../contracts/guard-enforcement-ledger.js';
import type {
	SemanticAstNodeRecord,
	SemanticDeclarationRecord,
	StaticSemanticSnapshot
} from '../contracts/semantic.js';
import type { StateMachineTopologyLegalTransitionRecord } from '../contracts/state-machine-graph.js';
import { compareText, sha256 } from '../inventory/canonical.js';
import { validateArrowCommandCensusObservation } from '../providers/jpwb-arrow-command-census/validate-arrow-command-census.js';
import { validateGuardEnforcementLedgerObservation } from '../providers/jpwb-guard-enforcement-ledger/validate-guard-enforcement-ledger.js';
import { validateStateMachineTopologyObservation } from '../providers/jpwb-state-machines/validate-state-machine-observation.js';
import { readFrozenSubjectArtifact } from '../subject/frozen-store.js';
import { commandHandlerGraphInputDigest } from './command-handler-graph-canonical.js';
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
import { stateMachineGraphInputDigest } from './state-machine-graph-input.js';
import { validateCommandHandlerGraph } from './validate-command-handler-graph.js';
import { validateGuardClassificationOverlay } from './validate-guard-classification-overlay.js';
import { validateStateMachineGraph } from './validate-state-machine-graph.js';

const APPLICATION_PROJECT = 'packages/rph-application/tsconfig.json';
const ENFORCEMENT_SITE_PATTERN = /^(packages\/rph-application\/src\/handlers\/.+\.ts):([1-9]\d*)$/u;
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

interface TelemetryRecorder {
	complete(counts?: Readonly<Record<string, number>>, detailCode?: string | null): void;
	fail(counts?: Readonly<Record<string, number>>, detailCode?: string | null): void;
	finish<Outcome extends GuardClassificationOverlayBuildOutcome>(outcome: Outcome): Outcome;
	start(
		phase: GuardClassificationOverlayProgressPhase,
		counts?: Readonly<Record<string, number>>
	): void;
}

interface SemanticIndexes {
	readonly anchorSourcesByPath: ReadonlyMap<string, StaticSemanticSnapshot['sources'][number][]>;
	readonly assignmentsByNode: ReadonlyMap<string, StaticSemanticSnapshot['assignments'][number][]>;
	readonly declarationById: ReadonlyMap<string, SemanticDeclarationRecord>;
	readonly invocationByNode: ReadonlyMap<string, StaticSemanticSnapshot['invocations'][number]>;
	readonly nodeById: ReadonlyMap<string, SemanticAstNodeRecord>;
	readonly nodesBySource: ReadonlyMap<string, SemanticAstNodeRecord[]>;
	readonly referencesByNode: ReadonlyMap<string, StaticSemanticSnapshot['references'][number][]>;
	readonly symbolById: ReadonlyMap<string, StaticSemanticSnapshot['symbols'][number]>;
}

interface CommandEvidenceFact {
	readonly link: GuardClassificationOverlayCommandEvidenceLink;
	readonly site: CommandArrowSiteNode;
	readonly targets: readonly HandlerTargetNode[];
}

interface AnchorFact {
	readonly anchor: GuardClassificationOverlayAnchorSite;
	readonly callable: SemanticAstNodeRecord;
	readonly callableAncestors: readonly SemanticAstNodeRecord[];
	readonly classificationIds: readonly GuardClassificationOverlayClassificationRecord['id'][];
}

function diagnostic(
	code: GuardClassificationOverlayDiagnostic['code'],
	message: string,
	phase: GuardClassificationOverlayDiagnostic['phase'],
	path: string | null = null
): GuardClassificationOverlayDiagnostic {
	return { code, message, path, phase };
}

function unavailable(
	code: GuardClassificationOverlayDiagnostic['code'],
	message: string,
	phase: GuardClassificationOverlayDiagnostic['phase'],
	path: string | null = null
): GuardClassificationOverlayBuildOutcome {
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

function materializeInputs(value: unknown): GuardClassificationOverlayBuildInputs {
	const input = exactPlainRecord(value, INPUT_KEYS, '$inputs');
	const requestRecord = exactPlainRecord(input.request, REQUEST_KEYS, '$inputs.request');
	const budgetRecord = exactPlainRecord(
		requestRecord.budgets,
		BUDGET_KEYS,
		'$inputs.request.budgets'
	);
	for (const key of BUDGET_KEYS)
		if (!Number.isSafeInteger(budgetRecord[key]) || (budgetRecord[key] as number) < 1)
			throw new TypeError(`$inputs.request.budgets.${key} must be a positive safe integer.`);
	for (const key of REQUEST_KEYS.filter((key) => key !== 'budgets'))
		if (typeof requestRecord[key] !== 'string' || (requestRecord[key] as string).length === 0)
			throw new TypeError(`$inputs.request.${key} must be nonempty text.`);
	if (requestRecord.schemaVersion !== GUARD_CLASSIFICATION_OVERLAY_REQUEST_SCHEMA_VERSION)
		throw new TypeError('Unsupported guard-classification overlay request schema version.');
	if (requestRecord.operationVersion !== GUARD_CLASSIFICATION_OVERLAY_OPERATION_VERSION)
		throw new TypeError('Unsupported guard-classification overlay operation version.');
	return {
		...(input as unknown as GuardClassificationOverlayBuildInputs),
		request: {
			...(requestRecord as unknown as BuildGuardClassificationOverlayRequest),
			budgets: { ...(budgetRecord as unknown as BuildGuardClassificationOverlayRequest['budgets']) }
		}
	};
}

function safeProgressSink(
	options: BuildGuardClassificationOverlayOptions | undefined
): ((event: GuardClassificationOverlayProgressEvent) => void) | undefined {
	if (options === undefined) return undefined;
	try {
		const record = exactPlainRecord(options, ['onProgress'], '$options');
		return typeof record.onProgress === 'function'
			? (record.onProgress as (event: GuardClassificationOverlayProgressEvent) => void)
			: undefined;
	} catch {
		return undefined;
	}
}

function boundedCounts(counts: Readonly<Record<string, number>>): Readonly<Record<string, number>> {
	const result: Record<string, number> = {};
	for (const key of Object.keys(counts).sort(compareText).slice(0, 16)) {
		const value = counts[key];
		if (Number.isSafeInteger(value) && value! >= 0) result[key] = value!;
	}
	return Object.freeze(result);
}

function deepFreezeConstructed<Value>(value: Value, seen = new WeakSet<object>()): Value {
	if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value;
	const object = value as object;
	if (seen.has(object)) return value;
	seen.add(object);
	for (const key of Reflect.ownKeys(object)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(object, key);
		if (descriptor !== undefined && 'value' in descriptor)
			deepFreezeConstructed(descriptor.value, seen);
	}
	return Object.freeze(value);
}

function createTelemetry(
	options: BuildGuardClassificationOverlayOptions | undefined
): TelemetryRecorder {
	const sink = safeProgressSink(options);
	const events: GuardClassificationOverlayProgressEvent[] = [];
	let active: GuardClassificationOverlayProgressPhase | null = null;
	let sequence = 0;
	const emit = (
		phase: GuardClassificationOverlayProgressPhase,
		state: GuardClassificationOverlayProgressEvent['state'],
		counts: Readonly<Record<string, number>>,
		detailCode: string | null
	): void => {
		events.push(
			Object.freeze({
				counts: boundedCounts(counts),
				detailCode,
				phase,
				schemaVersion: GUARD_CLASSIFICATION_OVERLAY_PROGRESS_SCHEMA_VERSION,
				sequence: sequence++,
				state
			})
		);
	};
	const close = (
		state: GuardClassificationOverlayProgressEvent['state'],
		counts: Readonly<Record<string, number>>,
		detailCode: string | null
	): void => {
		if (active === null) return;
		emit(active, state, counts, detailCode);
		active = null;
	};
	return {
		complete(counts = {}, detailCode = null): void {
			close('COMPLETED', counts, detailCode);
		},
		fail(counts = {}, detailCode = null): void {
			close('FAILED', counts, detailCode);
		},
		finish<Outcome extends GuardClassificationOverlayBuildOutcome>(outcome: Outcome): Outcome {
			if (active !== null) close('FAILED', { interrupted: 1 }, 'INTERRUPTED');
			const frozenOutcome = deepFreezeConstructed(outcome);
			if (sink !== undefined) {
				const frozenEvents = Object.freeze([...events]);
				queueMicrotask(() => {
					for (const event of frozenEvents)
						try {
							sink(event);
						} catch {
							// Telemetry is out of band and cannot affect constructed evidence.
						}
				});
			}
			return frozenOutcome;
		},
		start(phase, counts = {}): void {
			if (active !== null) close('FAILED', { interrupted: 1 }, 'INTERRUPTED');
			active = phase;
			emit(phase, 'STARTED', counts, null);
		}
	};
}

function addGrouped<Key, Value>(map: Map<Key, Value[]>, key: Key, value: Value): void {
	const values = map.get(key);
	if (values === undefined) map.set(key, [value]);
	else values.push(value);
}

function sortedUnique<Value extends string>(values: Iterable<Value>): Value[] {
	return [...new Set(values)].sort(compareText);
}

function tuple(machine: string, from: string, to: string): string {
	return `${machine}\0${from}\0${to}`;
}

interface ProjectOwnershipIndex {
	readonly programProjectById: ReadonlyMap<string, string>;
	readonly projectConfigById: ReadonlyMap<string, string>;
	readonly projectProgramById: ReadonlyMap<string, string>;
}

interface AnchorSourceIndex {
	readonly anchorSourceIds: ReadonlySet<string>;
	readonly anchorSourcesByPath: ReadonlyMap<string, StaticSemanticSnapshot['sources'][number][]>;
}

interface InvocationIndex {
	readonly calleeNodeIds: ReadonlySet<string>;
	readonly invocationByNode: ReadonlyMap<string, StaticSemanticSnapshot['invocations'][number]>;
}

interface ReferenceIndex {
	readonly referencesByNode: ReadonlyMap<string, StaticSemanticSnapshot['references'][number][]>;
	readonly symbolIds: ReadonlySet<string>;
}

interface SymbolIndex {
	readonly declarationIds: ReadonlySet<string>;
	readonly symbolById: ReadonlyMap<string, StaticSemanticSnapshot['symbols'][number]>;
}

interface DeclarationIndex {
	readonly declarationById: ReadonlyMap<string, SemanticDeclarationRecord>;
	readonly declarationNodeIds: ReadonlySet<string>;
}

interface AssignmentIndex {
	readonly assignmentsByNode: ReadonlyMap<string, StaticSemanticSnapshot['assignments'][number][]>;
	readonly explicitNodeIds: ReadonlySet<string>;
}

interface AstNodeIndex {
	readonly nodeById: ReadonlyMap<string, SemanticAstNodeRecord>;
	readonly nodesBySource: ReadonlyMap<string, SemanticAstNodeRecord[]>;
}

function projectOwnershipIndex(snapshot: StaticSemanticSnapshot): ProjectOwnershipIndex {
	const projectConfigById = new Map<string, string>();
	const projectProgramById = new Map<string, string>();
	for (const project of snapshot.projects) {
		projectConfigById.set(project.id, project.configPath);
		projectProgramById.set(project.id, project.programId);
	}
	const programProjectById = new Map<string, string>();
	for (const program of snapshot.programs) programProjectById.set(program.id, program.projectId);
	return { programProjectById, projectConfigById, projectProgramById };
}

function anchorSourceIndex(
	snapshot: StaticSemanticSnapshot,
	enforcementPaths: ReadonlySet<string>
): AnchorSourceIndex {
	const ownership = projectOwnershipIndex(snapshot);
	const anchorSourcesByPath = new Map<string, StaticSemanticSnapshot['sources'][number][]>();
	const anchorSourceIds = new Set<string>();
	for (const source of snapshot.sources) {
		if (
			!enforcementPaths.has(source.logicalPath) ||
			source.analysisDisposition !== 'DEEP_INDEXED' ||
			ownership.projectConfigById.get(source.projectId) !== APPLICATION_PROJECT
		)
			continue;
		if (
			ownership.programProjectById.get(source.programId) !== source.projectId ||
			ownership.projectProgramById.get(source.projectId) !== source.programId
		)
			throw new Error(
				'INPUT_POPULATION_MISMATCH\0An enforcement semantic source has inconsistent project/program ownership.'
			);
		addGrouped(anchorSourcesByPath, source.logicalPath, source);
		anchorSourceIds.add(source.id);
	}
	return { anchorSourceIds, anchorSourcesByPath };
}

function invocationIndex(
	snapshot: StaticSemanticSnapshot,
	factoryTargetNodeIds: ReadonlySet<string>
): InvocationIndex {
	const invocationByNode = new Map<string, StaticSemanticSnapshot['invocations'][number]>();
	const calleeNodeIds = new Set<string>();
	for (const invocation of snapshot.invocations) {
		if (!factoryTargetNodeIds.has(invocation.nodeId)) continue;
		invocationByNode.set(invocation.nodeId, invocation);
		calleeNodeIds.add(invocation.calleeNodeId);
	}
	return { calleeNodeIds, invocationByNode };
}

function referenceIndex(
	snapshot: StaticSemanticSnapshot,
	calleeNodeIds: ReadonlySet<string>
): ReferenceIndex {
	const referencesByNode = new Map<string, StaticSemanticSnapshot['references'][number][]>();
	const symbolIds = new Set<string>();
	for (const reference of snapshot.references) {
		if (!calleeNodeIds.has(reference.nodeId)) continue;
		addGrouped(referencesByNode, reference.nodeId, reference);
		if (reference.resolvedSymbolId !== null) symbolIds.add(reference.resolvedSymbolId);
	}
	return { referencesByNode, symbolIds };
}

function symbolIndex(
	snapshot: StaticSemanticSnapshot,
	symbolIds: ReadonlySet<string>
): SymbolIndex {
	const symbolById = new Map<string, StaticSemanticSnapshot['symbols'][number]>();
	const declarationIds = new Set<string>();
	for (const symbol of snapshot.symbols) {
		if (!symbolIds.has(symbol.id)) continue;
		symbolById.set(symbol.id, symbol);
		for (const declarationId of symbol.declarationIds) declarationIds.add(declarationId);
	}
	return { declarationIds, symbolById };
}

function declarationIndex(
	snapshot: StaticSemanticSnapshot,
	declarationIds: ReadonlySet<string>
): DeclarationIndex {
	const declarationById = new Map<string, SemanticDeclarationRecord>();
	const declarationNodeIds = new Set<string>();
	for (const declaration of snapshot.declarations) {
		if (!declarationIds.has(declaration.id)) continue;
		declarationById.set(declaration.id, declaration);
		if (declaration.nodeId !== null) declarationNodeIds.add(declaration.nodeId);
	}
	return { declarationById, declarationNodeIds };
}

function assignmentIndex(
	snapshot: StaticSemanticSnapshot,
	declarationNodeIds: ReadonlySet<string>
): AssignmentIndex {
	const assignmentsByNode = new Map<string, StaticSemanticSnapshot['assignments'][number][]>();
	const explicitNodeIds = new Set<string>(declarationNodeIds);
	for (const assignment of snapshot.assignments) {
		if (!declarationNodeIds.has(assignment.targetNodeId)) continue;
		addGrouped(assignmentsByNode, assignment.targetNodeId, assignment);
		if (assignment.valueNodeId !== null) explicitNodeIds.add(assignment.valueNodeId);
	}
	return { assignmentsByNode, explicitNodeIds };
}

function astNodeIndex(
	snapshot: StaticSemanticSnapshot,
	anchorSourceIds: ReadonlySet<string>,
	explicitNodeIds: ReadonlySet<string>
): AstNodeIndex {
	const nodeById = new Map<string, SemanticAstNodeRecord>();
	const nodesBySource = new Map<string, SemanticAstNodeRecord[]>();
	for (const node of snapshot.astNodes) {
		if (!anchorSourceIds.has(node.sourceId) && !explicitNodeIds.has(node.id)) continue;
		nodeById.set(node.id, node);
		if (anchorSourceIds.has(node.sourceId)) addGrouped(nodesBySource, node.sourceId, node);
	}
	return { nodeById, nodesBySource };
}

function semanticIndexes(
	snapshot: StaticSemanticSnapshot,
	enforcementPaths: ReadonlySet<string>,
	factoryTargetNodeIds: ReadonlySet<string>
): SemanticIndexes {
	const anchors = anchorSourceIndex(snapshot, enforcementPaths);
	const invocations = invocationIndex(snapshot, factoryTargetNodeIds);
	const references = referenceIndex(snapshot, invocations.calleeNodeIds);
	const symbols = symbolIndex(snapshot, references.symbolIds);
	const declarations = declarationIndex(snapshot, symbols.declarationIds);
	const assignments = assignmentIndex(snapshot, declarations.declarationNodeIds);
	const nodes = astNodeIndex(snapshot, anchors.anchorSourceIds, assignments.explicitNodeIds);
	return {
		anchorSourcesByPath: anchors.anchorSourcesByPath,
		assignmentsByNode: assignments.assignmentsByNode,
		declarationById: declarations.declarationById,
		invocationByNode: invocations.invocationByNode,
		nodeById: nodes.nodeById,
		nodesBySource: nodes.nodesBySource,
		referencesByNode: references.referencesByNode,
		symbolById: symbols.symbolById
	};
}

function decodeCompilerText(bytes: Uint8Array): string {
	return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function currentLine(text: string, offset: number): number {
	let line = 1;
	for (let index = 0; index < offset; index += 1) if (text.codePointAt(index) === 10) line += 1;
	return line;
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

function factoryCallableForTarget(
	target: HandlerTargetNode,
	model: SemanticIndexes
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

function validationSummary(
	issues: readonly { readonly code: string; readonly message: string; readonly path: string }[]
): string {
	return issues
		.slice(0, 3)
		.map((issue) => `${issue.code}@${issue.path}: ${issue.message}`)
		.join(', ');
}

function validatePredecessors(
	inputs: GuardClassificationOverlayBuildInputs,
	telemetry: TelemetryRecorder
): void {
	const { request } = inputs;
	telemetry.start('GUARD_VALIDATE', { records: inputs.guardObservation.guards.length });
	const guardValidation = validateGuardEnforcementLedgerObservation(
		inputs.guardObservation,
		inputs.subject,
		{
			maxIssues: request.budgets.maxDiagnostics,
			maxRecords: 10_000_000,
			maxStringCharacters: 1_000_000_000
		}
	);
	if (guardValidation.state !== 'VALID') {
		telemetry.fail({ diagnostics: guardValidation.issues.length }, guardValidation.state);
		throw new Error(`GUARD_OBSERVATION_INVALID\0${validationSummary(guardValidation.issues)}`);
	}
	telemetry.complete({ records: inputs.guardObservation.guards.length });

	telemetry.start('STATE_OBSERVATION_VALIDATE', {
		transitions: inputs.stateObservation.legalTransitions.length
	});
	const stateObservationValidation = validateStateMachineTopologyObservation(
		inputs.stateObservation,
		inputs.subject
	);
	if (stateObservationValidation.state !== 'VALID') {
		telemetry.fail(
			{ diagnostics: stateObservationValidation.issues.length },
			stateObservationValidation.state
		);
		throw new Error(
			`STATE_OBSERVATION_INVALID\0${validationSummary(stateObservationValidation.issues)}`
		);
	}
	telemetry.complete({ transitions: inputs.stateObservation.legalTransitions.length });

	telemetry.start('STATE_GRAPH_VALIDATE', { edges: inputs.stateGraph.edges.length });
	if (
		inputs.stateGraph.graphInputDigest !==
		stateMachineGraphInputDigest(
			inputs.stateGraphRequest,
			inputs.semanticSnapshot,
			inputs.stateObservation
		)
	)
		throw new Error(
			'STATE_GRAPH_INVALID\0The state graph does not match its explicit predecessor request.'
		);
	const stateGraphValidation = validateStateMachineGraph(
		inputs.stateGraph,
		inputs.stateGraphRequest,
		inputs.semanticSnapshot,
		inputs.stateObservation,
		{ maxIssues: request.budgets.maxDiagnostics }
	);
	if (stateGraphValidation.state !== 'VALID') {
		telemetry.fail({ diagnostics: stateGraphValidation.issues.length }, stateGraphValidation.state);
		throw new Error(`STATE_GRAPH_INVALID\0${validationSummary(stateGraphValidation.issues)}`);
	}
	telemetry.complete({ edges: inputs.stateGraph.edges.length });

	telemetry.start('ARROW_VALIDATE', { arrows: inputs.arrowObservation.declaredArrows.length });
	const arrowValidation = validateArrowCommandCensusObservation(
		inputs.arrowObservation,
		inputs.subject,
		{ maxIssues: request.budgets.maxDiagnostics }
	);
	if (arrowValidation.state !== 'VALID') {
		telemetry.fail({ diagnostics: arrowValidation.issues.length }, arrowValidation.state);
		throw new Error(`ARROW_OBSERVATION_INVALID\0${validationSummary(arrowValidation.issues)}`);
	}
	telemetry.complete({ arrows: inputs.arrowObservation.declaredArrows.length });

	telemetry.start('HANDLER_GRAPH_VALIDATE', {
		edges: inputs.commandHandlerGraph.edges.length,
		nodes: inputs.commandHandlerGraph.nodes.length
	});
	if (
		inputs.commandHandlerGraph.graphInputDigest !==
		commandHandlerGraphInputDigest(
			inputs.commandHandlerRequest,
			inputs.semanticSnapshot,
			inputs.arrowObservation
		)
	)
		throw new Error(
			'COMMAND_HANDLER_GRAPH_INVALID\0The command-handler graph does not match its explicit predecessor request.'
		);
	const handlerValidation = validateCommandHandlerGraph(
		inputs.commandHandlerGraph,
		inputs.semanticSnapshot,
		inputs.arrowObservation,
		inputs.subject,
		{
			maxIssues: request.budgets.maxDiagnostics,
			maxRecords: 10_000_000,
			maxStringCharacters: 1_000_000_000
		}
	);
	if (handlerValidation.state !== 'VALID') {
		telemetry.fail({ diagnostics: handlerValidation.issues.length }, handlerValidation.state);
		throw new Error(
			`COMMAND_HANDLER_GRAPH_INVALID\0${validationSummary(handlerValidation.issues)}`
		);
	}
	telemetry.complete({
		edges: inputs.commandHandlerGraph.edges.length,
		nodes: inputs.commandHandlerGraph.nodes.length
	});

	telemetry.start('SHARED_SOURCE_RECONCILE');
	const subjectIds = [
		inputs.semanticSnapshot.subjectId,
		inputs.stateObservation.subjectId,
		inputs.stateGraph.subjectId,
		inputs.arrowObservation.subjectId,
		inputs.commandHandlerGraph.subjectId,
		inputs.guardObservation.subjectId,
		inputs.subject.descriptor.subjectId
	];
	if (subjectIds.some((subjectId) => subjectId !== request.subjectId))
		throw new Error('INPUT_IDENTITY_MISMATCH\0Predecessor subject identities do not reconcile.');
	if (
		request.semanticSnapshotId !== inputs.semanticSnapshot.id ||
		request.stateObservationId !== inputs.stateObservation.id ||
		request.stateGraphId !== inputs.stateGraph.id ||
		request.arrowObservationId !== inputs.arrowObservation.id ||
		request.commandHandlerGraphId !== inputs.commandHandlerGraph.id ||
		request.guardObservationId !== inputs.guardObservation.id ||
		inputs.stateGraph.semanticSnapshotId !== inputs.semanticSnapshot.id ||
		inputs.commandHandlerGraph.semanticSnapshotId !== inputs.semanticSnapshot.id ||
		inputs.stateGraph.observationId !== inputs.stateObservation.id ||
		inputs.commandHandlerGraph.arrowObservationId !== inputs.arrowObservation.id
	)
		throw new Error('INPUT_IDENTITY_MISMATCH\0Predecessor product identities do not reconcile.');
	if (
		!(['TS_PROJECT', 'TS_SYNTAX', 'TS_SYMBOL'] as const).every((required) =>
			inputs.semanticSnapshot.capabilities.some(
				(capability) => capability.capability === required && capability.state !== 'UNSUPPORTED'
			)
		)
	)
		throw new Error(
			'SEMANTIC_CAPABILITY_UNAVAILABLE\0TS_PROJECT, TS_SYNTAX, and TS_SYMBOL evidence are required.'
		);
	telemetry.complete({ subjectIds: subjectIds.length });
}

function registrationHandlerTargets(
	edges: readonly CommandHandlerGraphEdge[],
	nodes: ReadonlyMap<string, CommandHandlerGraphNode>,
	registrationEdge: CommandHandlerGraphEdge,
	supporting: CommandHandlerGraphEdge[]
): HandlerTargetNode[] {
	const targetEdges = edges.filter(
		(edge) =>
			edge.relationKind === 'HANDLER_REGISTRATION_TO_TARGET' &&
			edge.source.nodeId === registrationEdge.target.nodeId
	);
	supporting.push(...targetEdges);
	const targets: HandlerTargetNode[] = [];
	for (const targetEdge of targetEdges) {
		const target = nodes.get(targetEdge.target.nodeId);
		if (target?.kind === 'HANDLER_TARGET') targets.push(target);
	}
	return targets;
}

function registryHandlerTargets(
	edges: readonly CommandHandlerGraphEdge[],
	nodes: ReadonlyMap<string, CommandHandlerGraphNode>,
	tableEdges: readonly CommandHandlerGraphEdge[],
	supporting: CommandHandlerGraphEdge[]
): HandlerTargetNode[] {
	const targets: HandlerTargetNode[] = [];
	for (const tableEdge of tableEdges) {
		const registrationEdges = edges.filter(
			(edge) =>
				edge.relationKind === 'COMMAND_REGISTRY_ENTRY_TO_HANDLER_REGISTRATION' &&
				edge.source.nodeId === tableEdge.source.nodeId
		);
		supporting.push(...registrationEdges);
		for (const registrationEdge of registrationEdges)
			targets.push(...registrationHandlerTargets(edges, nodes, registrationEdge, supporting));
	}
	return targets;
}

function handlerTargetsForSite(
	edges: readonly CommandHandlerGraphEdge[],
	nodes: ReadonlyMap<string, CommandHandlerGraphNode>,
	site: CommandArrowSiteNode,
	supporting: CommandHandlerGraphEdge[]
): HandlerTargetNode[] {
	const targetSiteEdges = edges.filter(
		(edge) => edge.relationKind === 'HANDLER_TARGET_TO_ARROW_SITE' && edge.target.nodeId === site.id
	);
	if (targetSiteEdges.length > 0) {
		supporting.push(...targetSiteEdges);
		return targetSiteEdges.flatMap((edge) => {
			const target = nodes.get(edge.source.nodeId);
			return target?.kind === 'HANDLER_TARGET' ? [target] : [];
		});
	}
	const tableEdges = edges.filter(
		(edge) =>
			edge.relationKind === 'COMMAND_REGISTRY_ENTRY_TO_TABLE_ARROW_SITE' &&
			edge.target.nodeId === site.id
	);
	supporting.push(...tableEdges);
	return registryHandlerTargets(edges, nodes, tableEdges, supporting);
}

function commandEvidenceForOccurrence(
	overlayId: GuardClassificationOverlaySnapshot['id'],
	occurrenceId: GuardClassificationOverlayOccurrenceRecord['id'],
	observationArrowId: GuardClassificationOverlayCommandEvidenceLink['observationArrowId'],
	nodes: ReadonlyMap<string, CommandHandlerGraphNode>,
	edges: readonly CommandHandlerGraphEdge[],
	graphId: GuardClassificationOverlayCommandEvidenceLink['commandHandlerGraphId']
): CommandEvidenceFact {
	const occurrences = [...nodes.values()].filter(
		(node): node is CommandArrowOccurrenceNode =>
			node.kind === 'DECLARED_ARROW_OCCURRENCE' && node.observationArrowId === observationArrowId
	);
	if (occurrences.length !== 1)
		throw new Error(
			'INPUT_POPULATION_MISMATCH\0A retained declared-arrow occurrence has no unique graph occurrence node.'
		);
	const occurrence = occurrences[0]!;
	const siteOccurrenceEdges = edges.filter(
		(edge) =>
			edge.relationKind === 'ARROW_SITE_TO_OCCURRENCE' && edge.target.nodeId === occurrence.id
	);
	if (siteOccurrenceEdges.length !== 1)
		throw new Error(
			'INPUT_POPULATION_MISMATCH\0A command occurrence has no unique retained site edge.'
		);
	const siteValue = nodes.get(siteOccurrenceEdges[0]!.source.nodeId);
	if (siteValue?.kind !== 'DECLARED_ARROW_SITE')
		throw new Error('INPUT_POPULATION_MISMATCH\0A command occurrence site endpoint is invalid.');
	const site = siteValue;
	const supporting = [...siteOccurrenceEdges];
	const targets = [
		...new Map(
			handlerTargetsForSite(edges, nodes, site, supporting).map((target) => [target.id, target])
		).values()
	].sort((left, right) => compareText(left.id, right.id));
	const link: GuardClassificationOverlayCommandEvidenceLink = {
		attribution: 'EXACT_RETAINED_TUPLE_CORRELATION',
		commandHandlerGraphId: graphId,
		commandOccurrenceNodeId: occurrence.id,
		commandSiteNodeId: site.id,
		handlerTargetNodeIds: targets.map((target) => target.id),
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
	return { link, site, targets };
}

function frozenEnforcementSource(
	inputs: GuardClassificationOverlayBuildInputs,
	path: string
): { readonly bytes: Uint8Array; readonly text: string } {
	const artifact = inputs.subject.artifacts.filter((item) => item.path === path);
	if (artifact.length !== 1)
		throw new Error(
			'INPUT_POPULATION_MISMATCH\0An enforcement source is not unique in the subject.'
		);
	const unreconciled =
		'INPUT_POPULATION_MISMATCH\0Frozen enforcement source bytes do not reconcile.';
	const bytes = readFrozenSubjectArtifact(inputs.subject, path);
	if (bytes === undefined) throw new Error(unreconciled);
	if (bytes.byteLength !== artifact[0]!.bytes || sha256(bytes) !== artifact[0]!.sha256)
		throw new Error(unreconciled);
	return { bytes, text: decodeCompilerText(bytes) };
}

function anchorOffsets(
	text: string,
	anchorText: string
): { readonly end: number; readonly start: number } {
	const start = text.indexOf(anchorText);
	if (start < 0 || text.includes(anchorText, start + 1))
		throw new Error(
			'UNSUPPORTED_HANDLER_CORRELATION\0An enforcing anchor is absent or non-unique in frozen source bytes.'
		);
	return { end: start + anchorText.length, start };
}

function anchorSemanticSource(
	model: SemanticIndexes,
	path: string,
	bytes: Uint8Array,
	text: string
): StaticSemanticSnapshot['sources'][number] {
	const sources = (model.anchorSourcesByPath.get(path) ?? []).filter(
		(source) =>
			source.bytes === bytes.byteLength &&
			source.contentSha256 === sha256(bytes) &&
			source.textLength === text.length
	);
	if (sources.length !== 1)
		throw new Error(
			'INPUT_POPULATION_MISMATCH\0An enforcement source has no unique deep semantic source binding.'
		);
	return sources[0]!;
}

function containingAnchorNode(
	model: SemanticIndexes,
	sourceId: string,
	start: number,
	end: number
): SemanticAstNodeRecord {
	const containing = (model.nodesBySource.get(sourceId) ?? [])
		.filter((node) => node.start <= start && node.end >= end)
		.sort(
			(left, right) =>
				left.end - left.start - (right.end - right.start) || compareText(left.id, right.id)
		);
	if (containing.length === 0)
		throw new Error(
			'UNSUPPORTED_HANDLER_CORRELATION\0No semantic AST node contains an enforcing anchor.'
		);
	if (
		containing.length > 1 &&
		containing[0]!.start === containing[1]!.start &&
		containing[0]!.end === containing[1]!.end
	)
		throw new Error(
			'UNSUPPORTED_HANDLER_CORRELATION\0An enforcing anchor has indistinguishable containing AST nodes.'
		);
	return containing[0]!;
}

function anchorCallableAncestors(
	model: SemanticIndexes,
	from: SemanticAstNodeRecord
): SemanticAstNodeRecord[] {
	let node: SemanticAstNodeRecord | undefined = from;
	const ancestors: SemanticAstNodeRecord[] = [];
	const seen = new Set<string>();
	while (node !== undefined) {
		if (seen.has(node.id))
			throw new Error('INPUT_POPULATION_MISMATCH\0An enforcement AST parent chain is cyclic.');
		seen.add(node.id);
		if (CALLABLE_KINDS.has(node.kind)) ancestors.push(node);
		if (node.parentId === null) break;
		const parentId = node.parentId;
		node = model.nodeById.get(parentId);
		if (node === undefined)
			throw new Error('INPUT_POPULATION_MISMATCH\0An enforcement AST ancestor is absent.');
	}
	if (ancestors.length === 0)
		throw new Error('UNSUPPORTED_HANDLER_CORRELATION\0No callable contains an enforcing anchor.');
	return ancestors;
}

function anchorFact(
	overlayId: GuardClassificationOverlaySnapshot['id'],
	guard: GuardEnforcementLedgerGuardRecord,
	classificationId: GuardClassificationOverlayClassificationRecord['id'],
	inputs: GuardClassificationOverlayBuildInputs,
	model: SemanticIndexes
): AnchorFact {
	if (guard.enforcingAnchor === null || guard.enforcingSite === null)
		throw new Error('UNSUPPORTED_HANDLER_CORRELATION\0An enforcement citation is incomplete.');
	const match = ENFORCEMENT_SITE_PATTERN.exec(guard.enforcingSite);
	if (match === null)
		throw new Error('UNSUPPORTED_HANDLER_CORRELATION\0An enforcement site has unsupported syntax.');
	const path = match[1]!;
	const frozen = frozenEnforcementSource(inputs, path);
	const { end, start } = anchorOffsets(frozen.text, guard.enforcingAnchor);
	const source = anchorSemanticSource(model, path, frozen.bytes, frozen.text);
	const callableAncestors = anchorCallableAncestors(
		model,
		containingAnchorNode(model, source.id, start, end)
	);
	const callable = callableAncestors[0]!;
	const id = guardEnforcementAnchorSiteId({
		anchorText: guard.enforcingAnchor,
		end,
		overlayId,
		sourceId: source.id,
		start
	});
	return {
		anchor: {
			anchorText: guard.enforcingAnchor,
			callableNodeId: callable.id,
			classificationIds: [classificationId],
			currentLine: currentLine(frozen.text, start),
			end,
			frontierIds: [],
			handlerLinkIds: [],
			id,
			path,
			programId: source.programId,
			projectId: source.projectId,
			sourceId: source.id,
			start
		},
		callable,
		callableAncestors,
		classificationIds: [classificationId]
	};
}

function frontierReason(kind: GuardClassificationOverlayFrontier['frontierKind']): string {
	switch (kind) {
		case 'NO_RETAINED_DECLARED_ARROW_EVIDENCE':
			return 'No declared-arrow occurrence in the retained census matches this exact machine/from/to tuple.';
		case 'STALE_LEDGER_ROW':
			return 'The retained guard-classification row is stale and is not promoted by this overlay.';
		case 'UNCLASSIFIED_GUARD_TEXT':
			return 'The retained guard text has no classification and remains an explicit frontier.';
		case 'FACTORY_HANDLER_ATTRIBUTION_CANDIDATE':
			return 'The anchor is contained by a shared factory callable; registered factory-result targets remain candidates.';
		case 'HELPER_CALL_FLOW_UNRESOLVED':
			return 'The anchor callable is not an exact registered handler target or a resolved shared factory callable; helper call flow is not modeled.';
	}
}

function indexEntry(
	input: GuardClassificationOverlayIndexEntry
): GuardClassificationOverlayIndexEntry {
	return {
		anchorSiteIds: sortedUnique(input.anchorSiteIds),
		classificationIds: sortedUnique(input.classificationIds),
		commandEvidenceLinkIds: sortedUnique(input.commandEvidenceLinkIds),
		frontierIds: sortedUnique(input.frontierIds),
		handlerLinkIds: sortedUnique(input.handlerLinkIds),
		key: input.key,
		occurrenceIds: sortedUnique(input.occurrenceIds)
	};
}

type StateGraphEdgeRecord = GuardClassificationOverlayBuildInputs['stateGraph']['edges'][number];
type DeclaredArrowRecord =
	GuardClassificationOverlayBuildInputs['arrowObservation']['declaredArrows'][number];
type GuardedArrowRecord =
	GuardClassificationOverlayBuildInputs['guardObservation']['guardedArrows'][number];
type GuardedTransitionRecord =
	GuardClassificationOverlayBuildInputs['stateObservation']['guardedTransitions'][number];
type GuardedLegalTransitionIndex = ReadonlyMap<
	GuardedTransitionRecord['id'],
	GuardedTransitionRecord['legalTransitionId']
>;

interface FactoryTargetMatch {
	readonly callable: SemanticAstNodeRecord;
	readonly target: HandlerTargetNode;
}

interface OverlayJoinIndexes {
	readonly arrowByTuple: ReadonlyMap<string, DeclaredArrowRecord[]>;
	readonly classificationByGuardId: ReadonlyMap<
		GuardClassificationOverlayClassificationRecord['guardId'],
		GuardClassificationOverlayClassificationRecord
	>;
	readonly classifications: readonly GuardClassificationOverlayClassificationRecord[];
	readonly graphNodes: ReadonlyMap<string, CommandHandlerGraphNode>;
	readonly legalByTuple: ReadonlyMap<string, StateMachineTopologyLegalTransitionRecord[]>;
	readonly model: SemanticIndexes;
	readonly stateEdgesByLegal: ReadonlyMap<string, StateGraphEdgeRecord[]>;
}

/** Loop working state threaded by reference so extracted phases never lose an accumulator write. */
interface OverlayBuildState {
	anchorFactsById: ReadonlyMap<GuardClassificationOverlayAnchorSite['id'], AnchorFact>;
	readonly evidenceFacts: CommandEvidenceFact[];
	readonly frontiers: GuardClassificationOverlayFrontier[];
	readonly handlerLinks: GuardClassificationOverlayHandlerLink[];
	readonly indexes: OverlayJoinIndexes;
	readonly inputDigest: string;
	readonly inputs: GuardClassificationOverlayBuildInputs;
	readonly occurrenceByClassification: Map<string, GuardClassificationOverlayOccurrenceRecord[]>;
	readonly occurrenceDrafts: GuardClassificationOverlayOccurrenceRecord[];
	readonly overlayId: GuardClassificationOverlaySnapshot['id'];
	readonly telemetry: TelemetryRecorder;
}

interface AnchorBindState {
	readonly factsById: Map<GuardClassificationOverlayAnchorSite['id'], AnchorFact>;
	readonly readSourcePaths: Set<string>;
	sourceBytes: number;
}

interface ReconciledOverlay {
	readonly anchorByClassification: ReadonlyMap<string, GuardClassificationOverlayAnchorSite>;
	readonly anchorSites: readonly GuardClassificationOverlayAnchorSite[];
	readonly completedClassifications: readonly GuardClassificationOverlayClassificationRecord[];
	readonly frontiersByClassification: ReadonlyMap<string, GuardClassificationOverlayFrontier[]>;
	readonly occurrences: readonly GuardClassificationOverlayOccurrenceRecord[];
}

interface OverlayContentParts {
	readonly commandEvidenceLinks: readonly GuardClassificationOverlayCommandEvidenceLink[];
	readonly coverage: GuardClassificationOverlayCoverage;
	readonly forwardIndex: readonly GuardClassificationOverlayIndexEntry[];
	readonly layers: readonly [GuardClassificationOverlayLayer, GuardClassificationOverlayLayer];
	readonly reverseIndex: readonly GuardClassificationOverlayIndexEntry[];
}

function overlayFrontier(
	overlayId: GuardClassificationOverlaySnapshot['id'],
	frontierKind: GuardClassificationOverlayFrontier['frontierKind'],
	classificationId: GuardClassificationOverlayFrontier['classificationId'],
	occurrenceId: GuardClassificationOverlayFrontier['occurrenceId'],
	anchorSiteId: GuardClassificationOverlayFrontier['anchorSiteId']
): GuardClassificationOverlayFrontier {
	return {
		anchorSiteId,
		classificationId,
		frontierKind,
		id: guardClassificationFrontierId({
			anchorSiteId,
			classificationId,
			frontierKind,
			occurrenceId,
			overlayId
		}),
		occurrenceId,
		reason: frontierReason(frontierKind)
	};
}

function enforcementPathSet(inputs: GuardClassificationOverlayBuildInputs): ReadonlySet<string> {
	return new Set(
		inputs.guardObservation.guards.flatMap((guard) => {
			const match =
				guard.enforcingSite === null ? null : ENFORCEMENT_SITE_PATTERN.exec(guard.enforcingSite);
			return match === null ? [] : [match[1]!];
		})
	);
}

function factoryTargetNodeIdSet(
	inputs: GuardClassificationOverlayBuildInputs
): ReadonlySet<string> {
	return new Set(
		inputs.commandHandlerGraph.nodes.flatMap((node) =>
			node.kind === 'HANDLER_TARGET' && node.bodyKind === 'FACTORY_CALL_RESULT_CANDIDATE'
				? [node.nodeId]
				: []
		)
	);
}

function legalTransitionIndex(
	inputs: GuardClassificationOverlayBuildInputs
): Map<string, StateMachineTopologyLegalTransitionRecord[]> {
	const machineNameById = new Map(
		inputs.stateObservation.machines.map((machine) => [machine.id, machine.name])
	);
	const legalByTuple = new Map<string, StateMachineTopologyLegalTransitionRecord[]>();
	for (const legal of inputs.stateObservation.legalTransitions) {
		const machine = machineNameById.get(legal.machineId);
		if (machine === undefined)
			throw new Error('INPUT_POPULATION_MISMATCH\0A legal transition has no machine.');
		addGrouped(legalByTuple, tuple(machine, legal.from, legal.to), legal);
	}
	return legalByTuple;
}

function legalTransitionIdForStateEdge(
	edge: StateGraphEdgeRecord,
	guardedLegalIds: GuardedLegalTransitionIndex
): string | null {
	if (edge.relationKind === 'LEGAL_TRANSITION') return edge.observationRecordId;
	if (edge.relationKind === 'GUARDED_LEGAL_TRANSITION')
		return guardedLegalIds.get(edge.observationRecordId as never) ?? edge.observationRecordId;
	return null;
}

function stateEdgeIndex(
	inputs: GuardClassificationOverlayBuildInputs
): Map<string, StateGraphEdgeRecord[]> {
	const stateEdgesByLegal = new Map<string, StateGraphEdgeRecord[]>();
	const guardedLegalIds = new Map(
		inputs.stateObservation.guardedTransitions.map((guarded) => [
			guarded.id,
			guarded.legalTransitionId
		])
	);
	for (const edge of inputs.stateGraph.edges) {
		const legalId = legalTransitionIdForStateEdge(edge, guardedLegalIds);
		if (legalId !== null) addGrouped(stateEdgesByLegal, legalId, edge);
	}
	return stateEdgesByLegal;
}

function declaredArrowIndex(
	inputs: GuardClassificationOverlayBuildInputs
): Map<string, DeclaredArrowRecord[]> {
	const arrowByTuple = new Map<string, DeclaredArrowRecord[]>();
	for (const arrow of inputs.arrowObservation.declaredArrows)
		addGrouped(arrowByTuple, tuple(arrow.machine, arrow.from, arrow.to), arrow);
	return arrowByTuple;
}

function classificationRecords(
	inputs: GuardClassificationOverlayBuildInputs,
	overlayId: GuardClassificationOverlaySnapshot['id']
): GuardClassificationOverlayClassificationRecord[] {
	return inputs.guardObservation.guards
		.map((guard): GuardClassificationOverlayClassificationRecord => ({
			anchorSiteId: null,
			disposition: guard.disposition,
			enforcingAnchor: guard.enforcingAnchor,
			enforcingSite: guard.enforcingSite,
			evidence: guard.evidence,
			guardId: guard.id,
			guardText: guard.guardText,
			id: guardClassificationRecordId(overlayId, guard.id),
			ledgerState: guard.ledgerState,
			occurrenceIds: guard.arrowIds
				.map((arrowId) => guardOccurrenceRecordId(overlayId, arrowId))
				.sort(compareText)
		}))
		.sort((left, right) => compareText(left.id, right.id));
}

function overlayJoinIndexes(
	inputs: GuardClassificationOverlayBuildInputs,
	overlayId: GuardClassificationOverlaySnapshot['id']
): OverlayJoinIndexes {
	const model = semanticIndexes(
		inputs.semanticSnapshot,
		enforcementPathSet(inputs),
		factoryTargetNodeIdSet(inputs)
	);
	const classifications = classificationRecords(inputs, overlayId);
	return {
		arrowByTuple: declaredArrowIndex(inputs),
		classificationByGuardId: new Map(classifications.map((record) => [record.guardId, record])),
		classifications,
		graphNodes: new Map(inputs.commandHandlerGraph.nodes.map((node) => [node.id, node])),
		legalByTuple: legalTransitionIndex(inputs),
		model,
		stateEdgesByLegal: stateEdgeIndex(inputs)
	};
}

function createBuildState(
	inputs: GuardClassificationOverlayBuildInputs,
	telemetry: TelemetryRecorder
): OverlayBuildState {
	const budgets = inputs.request.budgets;
	if (inputs.guardObservation.guards.length > budgets.maxGuardRecords)
		throw new RangeError('maxGuardRecords exceeded.');
	if (inputs.guardObservation.guardedArrows.length > budgets.maxGuardOccurrences)
		throw new RangeError('maxGuardOccurrences exceeded.');
	if (inputs.semanticSnapshot.astNodes.length > budgets.maxAstNodes)
		throw new RangeError('maxAstNodes exceeded.');
	const inputDigest = guardClassificationOverlayInputDigest(inputs);
	const overlayId = guardClassificationOverlayId({
		inputDigest,
		semanticSnapshotId: inputs.semanticSnapshot.id,
		subjectId: inputs.request.subjectId
	});
	return {
		anchorFactsById: new Map(),
		evidenceFacts: [],
		frontiers: [],
		handlerLinks: [],
		indexes: overlayJoinIndexes(inputs, overlayId),
		inputDigest,
		inputs,
		occurrenceByClassification: new Map(),
		occurrenceDrafts: [],
		overlayId,
		telemetry
	};
}

function occurrenceJoin(
	state: OverlayBuildState,
	arrow: GuardedArrowRecord
): {
	readonly draft: GuardClassificationOverlayOccurrenceRecord;
	readonly facts: readonly CommandEvidenceFact[];
} {
	const { indexes, inputs, overlayId } = state;
	const key = tuple(arrow.machine, arrow.from, arrow.to);
	const legal = (indexes.legalByTuple.get(key) ?? []).filter(
		(item) => item.guard === arrow.guardText
	);
	if (legal.length !== 1)
		throw new Error(
			'UNSUPPORTED_TRANSITION_JOIN\0A guard occurrence has no unique exact guarded legal-transition join.'
		);
	const edges = indexes.stateEdgesByLegal.get(legal[0]!.id) ?? [];
	if (edges.length === 0)
		throw new Error(
			'UNSUPPORTED_TRANSITION_JOIN\0A guarded transition has no state-graph evidence.'
		);
	const classification = indexes.classificationByGuardId.get(arrow.guardId);
	if (classification === undefined)
		throw new Error('INPUT_POPULATION_MISMATCH\0A guard occurrence has no classification record.');
	const id = guardOccurrenceRecordId(overlayId, arrow.id);
	const facts = (indexes.arrowByTuple.get(key) ?? []).map((commandArrow) =>
		commandEvidenceForOccurrence(
			overlayId,
			id,
			commandArrow.id,
			indexes.graphNodes,
			inputs.commandHandlerGraph.edges,
			inputs.commandHandlerGraph.id
		)
	);
	return {
		draft: {
			arrowId: arrow.id,
			classificationId: classification.id,
			commandEvidenceLinkIds: facts.map((fact) => fact.link.id).sort(compareText),
			frontierIds: [],
			from: arrow.from,
			guardText: arrow.guardText,
			id,
			legalTransitionId: legal[0]!.id,
			machine: arrow.machine,
			stateGraphEdgeIds: sortedUnique(edges.map((edge) => edge.id)),
			to: arrow.to
		},
		facts
	};
}

function joinTransitions(state: OverlayBuildState): void {
	const { inputs, telemetry } = state;
	telemetry.start('TRANSITION_JOIN', {
		occurrences: inputs.guardObservation.guardedArrows.length
	});
	for (const arrow of inputs.guardObservation.guardedArrows) {
		const joined = occurrenceJoin(state, arrow);
		state.evidenceFacts.push(...joined.facts);
		state.occurrenceDrafts.push(joined.draft);
	}
	telemetry.complete({
		occurrences: state.occurrenceDrafts.length,
		stateEvidenceRefs: state.occurrenceDrafts.reduce(
			(sum, record) => sum + record.stateGraphEdgeIds.length,
			0
		)
	});
	if (state.evidenceFacts.length > inputs.request.budgets.maxCommandEvidenceLinks)
		throw new RangeError('maxCommandEvidenceLinks exceeded.');
	telemetry.start('COMMAND_EVIDENCE_JOIN', { links: state.evidenceFacts.length });
	telemetry.complete({ links: state.evidenceFacts.length });
}

function recordAnchorFact(
	bind: AnchorBindState,
	fact: AnchorFact,
	classificationId: GuardClassificationOverlayClassificationRecord['id'],
	inputs: GuardClassificationOverlayBuildInputs
): void {
	const existing = bind.factsById.get(fact.anchor.id);
	if (existing !== undefined) {
		bind.factsById.set(fact.anchor.id, {
			...existing,
			anchor: {
				...existing.anchor,
				classificationIds: sortedUnique([...existing.classificationIds, classificationId])
			},
			classificationIds: sortedUnique([...existing.classificationIds, classificationId])
		});
		return;
	}
	bind.factsById.set(fact.anchor.id, fact);
	if (bind.readSourcePaths.has(fact.anchor.path)) return;
	const artifact = inputs.subject.artifacts.find((item) => item.path === fact.anchor.path)!;
	bind.sourceBytes += artifact.bytes;
	bind.readSourcePaths.add(fact.anchor.path);
}

function bindEnforcementAnchors(state: OverlayBuildState): void {
	const { indexes, inputs, overlayId, telemetry } = state;
	telemetry.start('ENFORCEMENT_ANCHOR_BIND');
	const bind: AnchorBindState = {
		factsById: new Map(),
		readSourcePaths: new Set(),
		sourceBytes: 0
	};
	for (const guard of inputs.guardObservation.guards) {
		if (guard.enforcingAnchor === null && guard.enforcingSite === null) continue;
		const classification = indexes.classificationByGuardId.get(guard.id)!;
		const fact = anchorFact(overlayId, guard, classification.id, inputs, indexes.model);
		recordAnchorFact(bind, fact, classification.id, inputs);
	}
	const budgets = inputs.request.budgets;
	if (bind.factsById.size > budgets.maxAnchorSites)
		throw new RangeError('maxAnchorSites exceeded.');
	if (bind.sourceBytes > budgets.maxSourceBytes) throw new RangeError('maxSourceBytes exceeded.');
	telemetry.complete({ anchors: bind.factsById.size, sourceBytes: bind.sourceBytes });
	state.anchorFactsById = bind.factsById;
}

function pushLedgerFrontiers(state: OverlayBuildState): void {
	for (const classification of state.indexes.classifications) {
		if (classification.ledgerState === 'STALE')
			state.frontiers.push(
				overlayFrontier(state.overlayId, 'STALE_LEDGER_ROW', classification.id, null, null)
			);
		if (classification.ledgerState === 'UNCLASSIFIED')
			state.frontiers.push(
				overlayFrontier(state.overlayId, 'UNCLASSIFIED_GUARD_TEXT', classification.id, null, null)
			);
	}
	for (const occurrence of state.occurrenceDrafts)
		if (occurrence.commandEvidenceLinkIds.length === 0)
			state.frontiers.push(
				overlayFrontier(
					state.overlayId,
					'NO_RETAINED_DECLARED_ARROW_EVIDENCE',
					occurrence.classificationId,
					occurrence.id,
					null
				)
			);
}

function exactHandlerTargets(
	facts: readonly CommandEvidenceFact[],
	containingCallableIds: ReadonlySet<string>
): Map<string, HandlerTargetNode> {
	const exactTargets = new Map<string, HandlerTargetNode>();
	for (const fact of facts)
		for (const target of fact.targets)
			if (target.bodyKind === 'DIRECT_FUNCTION' && containingCallableIds.has(target.nodeId))
				exactTargets.set(target.id, target);
	return exactTargets;
}

function factorySharedTargets(
	facts: readonly CommandEvidenceFact[],
	containingCallableIds: ReadonlySet<string>,
	model: SemanticIndexes
): Map<HandlerTargetNode['id'], FactoryTargetMatch> {
	const factoryTargets = new Map<HandlerTargetNode['id'], FactoryTargetMatch>();
	for (const fact of facts)
		for (const target of fact.targets) {
			const factoryCallable = factoryCallableForTarget(target, model);
			if (factoryCallable !== null && containingCallableIds.has(factoryCallable.id))
				factoryTargets.set(target.id, { callable: factoryCallable, target });
		}
	return factoryTargets;
}

function exactHandlerLink(
	state: OverlayBuildState,
	anchorSiteId: GuardClassificationOverlayAnchorSite['id'],
	target: HandlerTargetNode,
	facts: readonly CommandEvidenceFact[]
): GuardClassificationOverlayHandlerLink {
	const supporting = facts
		.filter((fact) => fact.targets.some((item) => item.id === target.id))
		.flatMap((fact) => fact.link.supportingEdgeIds);
	const targetNodeIds = [target.id] as const;
	return {
		anchorSiteId,
		attribution: 'EXACT',
		commandHandlerGraphId: state.inputs.commandHandlerGraph.id,
		id: guardEnforcementHandlerLinkId({
			anchorSiteId,
			attribution: 'EXACT',
			overlayId: state.overlayId,
			targetNodeIds
		}),
		kind: 'EXACT_HANDLER_TARGET',
		supportingEdgeIds: sortedUnique(supporting),
		targetNodeIds
	};
}

function factorySharedHandlerLink(
	state: OverlayBuildState,
	anchorSiteId: GuardClassificationOverlayAnchorSite['id'],
	factoryCallableNodeId: SemanticAstNodeRecord['id'],
	factoryTargets: ReadonlyMap<HandlerTargetNode['id'], FactoryTargetMatch>,
	facts: readonly CommandEvidenceFact[]
): GuardClassificationOverlayHandlerLink {
	const targetNodeIds = sortedUnique(factoryTargets.keys());
	const supporting = facts
		.filter((fact) => fact.targets.some((target) => factoryTargets.has(target.id)))
		.flatMap((fact) => fact.link.supportingEdgeIds);
	return {
		anchorSiteId,
		attribution: 'CANDIDATE',
		commandHandlerGraphId: state.inputs.commandHandlerGraph.id,
		factoryCallableNodeId,
		id: guardEnforcementHandlerLinkId({
			anchorSiteId,
			attribution: 'CANDIDATE',
			factoryCallableNodeId,
			overlayId: state.overlayId,
			targetNodeIds
		}),
		kind: 'FACTORY_SHARED_CANDIDATE',
		supportingEdgeIds: sortedUnique(supporting),
		targetNodeIds
	};
}

function correlateClassificationTargets(
	state: OverlayBuildState,
	anchorFactValue: AnchorFact,
	classificationId: GuardClassificationOverlayClassificationRecord['id'],
	containingCallableIds: ReadonlySet<string>,
	facts: readonly CommandEvidenceFact[]
): void {
	const anchorSiteId = anchorFactValue.anchor.id;
	const exactTargets = exactHandlerTargets(facts, containingCallableIds);
	if (exactTargets.size === 1) {
		const target = [...exactTargets.values()][0]!;
		state.handlerLinks.push(exactHandlerLink(state, anchorSiteId, target, facts));
		return;
	}
	const factoryTargets = factorySharedTargets(facts, containingCallableIds, state.indexes.model);
	const factoryCallableIds = sortedUnique(
		[...factoryTargets.values()].map((match) => match.callable.id)
	);
	if (factoryTargets.size > 0 && factoryCallableIds.length === 1) {
		state.handlerLinks.push(
			factorySharedHandlerLink(state, anchorSiteId, factoryCallableIds[0]!, factoryTargets, facts)
		);
		state.frontiers.push(
			overlayFrontier(
				state.overlayId,
				'FACTORY_HANDLER_ATTRIBUTION_CANDIDATE',
				classificationId,
				null,
				anchorSiteId
			)
		);
		return;
	}
	state.frontiers.push(
		overlayFrontier(
			state.overlayId,
			'HELPER_CALL_FLOW_UNRESOLVED',
			classificationId,
			null,
			anchorSiteId
		)
	);
}

function correlateAnchorEvidence(
	state: OverlayBuildState,
	anchorFactValue: AnchorFact,
	evidenceByOccurrence: ReadonlyMap<string, CommandEvidenceFact[]>
): void {
	const containingCallableIds = new Set(
		anchorFactValue.callableAncestors.map((callable) => callable.id)
	);
	for (const classificationId of anchorFactValue.classificationIds) {
		const facts = (state.occurrenceByClassification.get(classificationId) ?? []).flatMap(
			(occurrence) => evidenceByOccurrence.get(occurrence.id) ?? []
		);
		correlateClassificationTargets(
			state,
			anchorFactValue,
			classificationId,
			containingCallableIds,
			facts
		);
	}
}

function correlateHandlerEvidence(state: OverlayBuildState): void {
	const { inputs, telemetry } = state;
	const evidenceByOccurrence = new Map<string, CommandEvidenceFact[]>();
	for (const fact of state.evidenceFacts)
		addGrouped(evidenceByOccurrence, fact.link.occurrenceId, fact);
	for (const occurrence of state.occurrenceDrafts)
		addGrouped(state.occurrenceByClassification, occurrence.classificationId, occurrence);
	pushLedgerFrontiers(state);
	telemetry.start('HANDLER_CORRELATE', { anchors: state.anchorFactsById.size });
	for (const anchorFactValue of state.anchorFactsById.values())
		correlateAnchorEvidence(state, anchorFactValue, evidenceByOccurrence);
	const deduplicatedHandlerLinks = [
		...new Map(state.handlerLinks.map((link) => [link.id, link])).values()
	];
	state.handlerLinks.splice(0, state.handlerLinks.length, ...deduplicatedHandlerLinks);
	const budgets = inputs.request.budgets;
	if (state.handlerLinks.length > budgets.maxHandlerLinks)
		throw new RangeError('maxHandlerLinks exceeded.');
	if (state.frontiers.length > budgets.maxFrontiers) throw new RangeError('maxFrontiers exceeded.');
	telemetry.complete({ handlerLinks: state.handlerLinks.length });
}

function reconciledAnchorSite(
	fact: AnchorFact,
	frontiersByClassification: ReadonlyMap<string, GuardClassificationOverlayFrontier[]>,
	linksByAnchor: ReadonlyMap<string, GuardClassificationOverlayHandlerLink[]>
): GuardClassificationOverlayAnchorSite {
	return {
		...fact.anchor,
		frontierIds: sortedUnique(
			fact.classificationIds.flatMap((id) =>
				(frontiersByClassification.get(id) ?? [])
					.filter((frontier) => frontier.anchorSiteId === fact.anchor.id)
					.map((frontier) => frontier.id)
			)
		),
		handlerLinkIds: sortedUnique((linksByAnchor.get(fact.anchor.id) ?? []).map((link) => link.id))
	};
}

function reconciledOccurrence(
	occurrence: GuardClassificationOverlayOccurrenceRecord,
	frontiersByClassification: ReadonlyMap<string, GuardClassificationOverlayFrontier[]>
): GuardClassificationOverlayOccurrenceRecord {
	return {
		...occurrence,
		frontierIds: sortedUnique(
			(frontiersByClassification.get(occurrence.classificationId) ?? [])
				.filter(
					(frontier) => frontier.occurrenceId === null || frontier.occurrenceId === occurrence.id
				)
				.map((frontier) => frontier.id)
		)
	};
}

function anchorSitesByClassification(
	anchorSites: readonly GuardClassificationOverlayAnchorSite[]
): Map<string, GuardClassificationOverlayAnchorSite> {
	const anchorByClassification = new Map<string, GuardClassificationOverlayAnchorSite>();
	for (const anchor of anchorSites)
		for (const classificationId of anchor.classificationIds)
			anchorByClassification.set(classificationId, anchor);
	return anchorByClassification;
}

function reconcileFrontiers(state: OverlayBuildState): ReconciledOverlay {
	const { frontiers, handlerLinks, telemetry } = state;
	telemetry.start('FRONTIER_RECONCILE', { frontiers: frontiers.length });
	frontiers.sort((left, right) => compareText(left.id, right.id));
	handlerLinks.sort((left, right) => compareText(left.id, right.id));
	const frontiersByClassification = new Map<string, GuardClassificationOverlayFrontier[]>();
	const frontiersByOccurrence = new Map<string, GuardClassificationOverlayFrontier[]>();
	for (const frontier of frontiers) {
		if (frontier.classificationId !== null)
			addGrouped(frontiersByClassification, frontier.classificationId, frontier);
		if (frontier.occurrenceId !== null)
			addGrouped(frontiersByOccurrence, frontier.occurrenceId, frontier);
	}
	const linksByAnchor = new Map<string, GuardClassificationOverlayHandlerLink[]>();
	for (const link of handlerLinks) addGrouped(linksByAnchor, link.anchorSiteId, link);
	const anchorSites = [...state.anchorFactsById.values()]
		.map((fact) => reconciledAnchorSite(fact, frontiersByClassification, linksByAnchor))
		.sort((left, right) => compareText(left.id, right.id));
	const anchorByClassification = anchorSitesByClassification(anchorSites);
	const completedClassifications = state.indexes.classifications.map((classification) => ({
		...classification,
		anchorSiteId: anchorByClassification.get(classification.id)?.id ?? null
	}));
	const occurrences = state.occurrenceDrafts
		.map((occurrence) => reconciledOccurrence(occurrence, frontiersByClassification))
		.sort((left, right) => compareText(left.id, right.id));
	telemetry.complete({ frontiers: frontiers.length });
	return {
		anchorByClassification,
		anchorSites,
		completedClassifications,
		frontiersByClassification,
		occurrences
	};
}

function overlayLayers(
	state: OverlayBuildState,
	reconciled: ReconciledOverlay,
	commandEvidenceLinks: readonly GuardClassificationOverlayCommandEvidenceLink[]
): readonly [GuardClassificationOverlayLayer, GuardClassificationOverlayLayer] {
	const { frontiers, handlerLinks, overlayId } = state;
	const derivationFrontierIds = frontiers
		.filter((frontier) =>
			[
				'NO_RETAINED_DECLARED_ARROW_EVIDENCE',
				'STALE_LEDGER_ROW',
				'UNCLASSIFIED_GUARD_TEXT'
			].includes(frontier.frontierKind)
		)
		.map((frontier) => frontier.id);
	const inferenceFrontierIds = frontiers
		.filter((frontier) => !derivationFrontierIds.includes(frontier.id))
		.map((frontier) => frontier.id);
	const exactHandlerLinkIds = handlerLinks
		.filter((record) => record.attribution === 'EXACT')
		.map((record) => record.id);
	const candidateHandlerLinkIds = handlerLinks
		.filter((record) => record.attribution === 'CANDIDATE')
		.map((record) => record.id);
	return [
		{
			capability: GUARD_CLASSIFICATION_OVERLAY_DERIVATION_CAPABILITY,
			capabilityStatus: GUARD_CLASSIFICATION_OVERLAY_CAPABILITY_STATUS,
			classificationIds: reconciled.completedClassifications.map((record) => record.id),
			commandEvidenceLinkIds: commandEvidenceLinks.map((record) => record.id),
			frontierIds: derivationFrontierIds,
			handlerLinkIds: exactHandlerLinkIds,
			id: guardClassificationOverlayLayerId(overlayId, 'DERIVATION'),
			kind: 'JPWB_GUARD_CLASSIFICATION_DERIVATION',
			occurrenceIds: reconciled.occurrences.map((record) => record.id),
			ordinal: 0,
			overlayId
		},
		{
			capability: GUARD_CLASSIFICATION_OVERLAY_INFERENCE_CAPABILITY,
			capabilityStatus: GUARD_CLASSIFICATION_OVERLAY_CAPABILITY_STATUS,
			classificationIds: [],
			commandEvidenceLinkIds: [],
			frontierIds: inferenceFrontierIds,
			handlerLinkIds: candidateHandlerLinkIds,
			id: guardClassificationOverlayLayerId(overlayId, 'INFERENCE'),
			kind: 'JPWB_GUARD_HANDLER_INFERENCE',
			occurrenceIds: [],
			ordinal: 1,
			overlayId
		}
	];
}

function compareDisposition(
	left: GuardClassificationOverlayClassificationRecord['disposition'],
	right: GuardClassificationOverlayClassificationRecord['disposition']
): number {
	if (left === null) return -1;
	if (right === null) return 1;
	return compareText(left, right);
}

function overlayCoverage(
	state: OverlayBuildState,
	reconciled: ReconciledOverlay,
	commandEvidenceLinks: readonly GuardClassificationOverlayCommandEvidenceLink[],
	stateEvidenceRefs: number
): GuardClassificationOverlayCoverage {
	const { frontiers, handlerLinks, indexes, inputs } = state;
	const { anchorSites, completedClassifications, occurrences } = reconciled;
	const dispositionValues = [
		...new Set(completedClassifications.map((item) => item.disposition))
	].sort(compareDisposition);
	const expectedCommandEvidenceLinks = inputs.guardObservation.guardedArrows.reduce(
		(sum, arrow) =>
			sum + (indexes.arrowByTuple.get(tuple(arrow.machine, arrow.from, arrow.to))?.length ?? 0),
		0
	);
	return {
		anchorSites: anchorSites.length,
		candidateFactoryHandlerLinks: handlerLinks.filter((link) => link.attribution === 'CANDIDATE')
			.length,
		classifications: completedClassifications.length,
		commandEvidenceLinks: commandEvidenceLinks.length,
		commandEvidenceOccurrences: occurrences.filter(
			(record) => record.commandEvidenceLinkIds.length > 0
		).length,
		directHandlerLinks: handlerLinks.filter((link) => link.attribution === 'EXACT').length,
		dispositionCounts: dispositionValues.map((disposition) => ({
			count: completedClassifications.filter((record) => record.disposition === disposition).length,
			disposition
		})),
		expectedClassifications: inputs.guardObservation.guards.length,
		expectedCommandEvidenceLinks,
		expectedOccurrences: inputs.guardObservation.guardedArrows.length,
		expectedStateEvidenceRefs: stateEvidenceRefs,
		frontiers: frontiers.length,
		helperFrontiers: frontiers.filter((item) => item.frontierKind === 'HELPER_CALL_FLOW_UNRESOLVED')
			.length,
		noCommandEvidenceFrontiers: frontiers.filter(
			(item) => item.frontierKind === 'NO_RETAINED_DECLARED_ARROW_EVIDENCE'
		).length,
		occurrences: occurrences.length,
		reconciles:
			completedClassifications.length === inputs.guardObservation.guards.length &&
			occurrences.length === inputs.guardObservation.guardedArrows.length &&
			commandEvidenceLinks.length === expectedCommandEvidenceLinks,
		stateEvidenceRefs
	};
}

function forwardIndexEntry(
	state: OverlayBuildState,
	reconciled: ReconciledOverlay,
	classification: GuardClassificationOverlayClassificationRecord
): GuardClassificationOverlayIndexEntry {
	const classOccurrences = state.occurrenceByClassification.get(classification.id) ?? [];
	const anchor = reconciled.anchorByClassification.get(classification.id);
	return indexEntry({
		anchorSiteIds: anchor === undefined ? [] : [anchor.id],
		classificationIds: [classification.id],
		commandEvidenceLinkIds: classOccurrences.flatMap((item) => item.commandEvidenceLinkIds),
		frontierIds:
			reconciled.frontiersByClassification.get(classification.id)?.map((item) => item.id) ?? [],
		handlerLinkIds: anchor === undefined ? [] : anchor.handlerLinkIds,
		key: classification.guardText,
		occurrenceIds: classOccurrences.map((item) => item.id)
	});
}

function reverseIndexEntry(
	reconciled: ReconciledOverlay,
	occurrence: GuardClassificationOverlayOccurrenceRecord
): GuardClassificationOverlayIndexEntry {
	const anchor = reconciled.anchorByClassification.get(occurrence.classificationId);
	return indexEntry({
		anchorSiteIds: anchor === undefined ? [] : [anchor.id],
		classificationIds: [occurrence.classificationId],
		commandEvidenceLinkIds: occurrence.commandEvidenceLinkIds,
		frontierIds: occurrence.frontierIds,
		handlerLinkIds: anchor === undefined ? [] : anchor.handlerLinkIds,
		key: tuple(occurrence.machine, occurrence.from, occurrence.to),
		occurrenceIds: [occurrence.id]
	});
}

function overlayContentParts(
	state: OverlayBuildState,
	reconciled: ReconciledOverlay
): OverlayContentParts {
	const commandEvidenceLinks = state.evidenceFacts
		.map((fact) => fact.link)
		.sort((left, right) => compareText(left.id, right.id));
	const layers = overlayLayers(state, reconciled, commandEvidenceLinks);
	const stateEvidenceRefs = reconciled.occurrences.reduce(
		(sum, record) => sum + record.stateGraphEdgeIds.length,
		0
	);
	if (stateEvidenceRefs > state.inputs.request.budgets.maxStateEvidenceRefs)
		throw new RangeError('maxStateEvidenceRefs exceeded.');
	return {
		commandEvidenceLinks,
		coverage: overlayCoverage(state, reconciled, commandEvidenceLinks, stateEvidenceRefs),
		forwardIndex: reconciled.completedClassifications
			.map((classification) => forwardIndexEntry(state, reconciled, classification))
			.sort(
				(left, right) =>
					compareText(left.key, right.key) ||
					compareText(left.classificationIds[0]!, right.classificationIds[0]!)
			),
		layers,
		reverseIndex: reconciled.occurrences
			.map((occurrence) => reverseIndexEntry(reconciled, occurrence))
			.sort(
				(left, right) =>
					compareText(left.key, right.key) ||
					compareText(left.occurrenceIds[0]!, right.occurrenceIds[0]!)
			)
	};
}

function overlayContentRecord(
	state: OverlayBuildState,
	reconciled: ReconciledOverlay,
	parts: OverlayContentParts
) {
	const { inputs } = state;
	return {
		anchorSites: reconciled.anchorSites,
		arrowObservationContentDigest: inputs.arrowObservation.contentDigest,
		arrowObservationId: inputs.arrowObservation.id,
		authorityTransfer: GUARD_CLASSIFICATION_OVERLAY_AUTHORITY_TRANSFER,
		baselineChange: GUARD_CLASSIFICATION_OVERLAY_BASELINE_CHANGE,
		budgets: { ...inputs.request.budgets },
		canonicalProfile: GUARD_CLASSIFICATION_OVERLAY_CANONICAL_PROFILE,
		capabilities: [
			GUARD_CLASSIFICATION_OVERLAY_DERIVATION_CAPABILITY,
			GUARD_CLASSIFICATION_OVERLAY_INFERENCE_CAPABILITY
		] as const,
		capabilityStatus: GUARD_CLASSIFICATION_OVERLAY_CAPABILITY_STATUS,
		classifications: reconciled.completedClassifications,
		commandEvidenceLinks: parts.commandEvidenceLinks,
		commandHandlerGraphContentDigest: inputs.commandHandlerGraph.contentDigest,
		commandHandlerGraphId: inputs.commandHandlerGraph.id,
		coverage: parts.coverage,
		forwardIndex: parts.forwardIndex,
		frontiers: state.frontiers,
		fullJanCsaa007Conformance: GUARD_CLASSIFICATION_OVERLAY_FULL_JAN_CSAA_007_CONFORMANCE,
		fullJanCsaa008Conformance: GUARD_CLASSIFICATION_OVERLAY_FULL_JAN_CSAA_008_CONFORMANCE,
		gateEffect: GUARD_CLASSIFICATION_OVERLAY_GATE_EFFECT,
		graphAuthority: GUARD_CLASSIFICATION_OVERLAY_GRAPH_AUTHORITY,
		guardObservationContentDigest: inputs.guardObservation.contentDigest,
		guardObservationId: inputs.guardObservation.id,
		handlerLinks: state.handlerLinks,
		health: 'PARTIAL' as const,
		id: state.overlayId,
		inputDigest: state.inputDigest,
		integrationStrategy: GUARD_CLASSIFICATION_OVERLAY_INTEGRATION_STRATEGY,
		layers: parts.layers,
		limitations: GUARD_CLASSIFICATION_OVERLAY_LIMITATIONS.map((item) => ({ ...item })),
		method: GUARD_CLASSIFICATION_OVERLAY_METHOD,
		occurrences: reconciled.occurrences,
		operationVersion: GUARD_CLASSIFICATION_OVERLAY_OPERATION_VERSION,
		oracleChange: GUARD_CLASSIFICATION_OVERLAY_ORACLE_CHANGE,
		producer: { ...inputs.semanticSnapshot.provider },
		registryStatus: GUARD_CLASSIFICATION_OVERLAY_REGISTRY_STATUS,
		replacementEquivalence: GUARD_CLASSIFICATION_OVERLAY_REPLACEMENT_EQUIVALENCE,
		reverseIndex: parts.reverseIndex,
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
}

function materializeOverlay(
	state: OverlayBuildState,
	reconciled: ReconciledOverlay
): GuardClassificationOverlaySnapshot {
	const { telemetry } = state;
	const parts = overlayContentParts(state, reconciled);
	telemetry.start('MATERIALIZE');
	const content = overlayContentRecord(state, reconciled, parts);
	const overlay: GuardClassificationOverlaySnapshot = {
		...content,
		contentDigest: guardClassificationOverlayContentDigest(content)
	};
	telemetry.complete({
		records: reconciled.completedClassifications.length + reconciled.occurrences.length
	});
	telemetry.start('SERIALIZE');
	telemetry.complete({ bytes: JSON.stringify(overlay).length });
	return overlay;
}

function validateConstructedOverlay(
	state: OverlayBuildState,
	overlay: GuardClassificationOverlaySnapshot
): GuardClassificationOverlayBuildOutcome {
	const { inputs, telemetry } = state;
	telemetry.start('OVERLAY_VALIDATE');
	const validation = validateGuardClassificationOverlay(overlay, inputs, {
		maxInputRecords: 10_000_000,
		maxInputStringCharacters: 1_000_000_000,
		maxIssues: Math.min(inputs.request.budgets.maxDiagnostics, 1_000),
		maxRecords: 10_000_000,
		maxStringCharacters: 1_000_000_000
	});
	if (validation.state !== 'VALID') {
		telemetry.fail({ diagnostics: validation.issues.length }, validation.state);
		return unavailable(
			'OVERLAY_VALIDATION_FAILED',
			`Constructed overlay failed validation: ${validationSummary(validation.issues)}`,
			'VALIDATE'
		);
	}
	telemetry.complete({ diagnostics: 0 });
	return {
		diagnostics: [],
		outcome: 'partial',
		overlay
	} as GuardClassificationOverlayBuildOutcome;
}

function constructOverlayOutcome(
	inputs: GuardClassificationOverlayBuildInputs,
	telemetry: TelemetryRecorder
): GuardClassificationOverlayBuildOutcome {
	validatePredecessors(inputs, telemetry);
	const state = createBuildState(inputs, telemetry);
	joinTransitions(state);
	bindEnforcementAnchors(state);
	correlateHandlerEvidence(state);
	const reconciled = reconcileFrontiers(state);
	return validateConstructedOverlay(state, materializeOverlay(state, reconciled));
}

function failureDiagnosticCode(
	error: unknown,
	encodedCode: string | undefined,
	knownCodes: ReadonlySet<GuardClassificationOverlayDiagnostic['code']>
): GuardClassificationOverlayDiagnostic['code'] {
	if (error instanceof RangeError) return 'BUDGET_EXCEEDED';
	const declaredCode = encodedCode as GuardClassificationOverlayDiagnostic['code'];
	if (knownCodes.has(declaredCode)) return declaredCode;
	return 'INPUT_POPULATION_MISMATCH';
}

function overlayFailureOutcome(
	error: unknown,
	telemetry: TelemetryRecorder
): GuardClassificationOverlayBuildOutcome {
	const message =
		error instanceof Error ? error.message : 'Guard-classification overlay failed closed.';
	const [encodedCode, detail] = message.split('\0', 2);
	const knownCodes = new Set<GuardClassificationOverlayDiagnostic['code']>([
		'ARROW_OBSERVATION_INVALID',
		'COMMAND_HANDLER_GRAPH_INVALID',
		'GUARD_OBSERVATION_INVALID',
		'INPUT_IDENTITY_MISMATCH',
		'INPUT_POPULATION_MISMATCH',
		'SEMANTIC_CAPABILITY_UNAVAILABLE',
		'STATE_GRAPH_INVALID',
		'STATE_OBSERVATION_INVALID',
		'UNSUPPORTED_HANDLER_CORRELATION',
		'UNSUPPORTED_TRANSITION_JOIN'
	]);
	const code = failureDiagnosticCode(error, encodedCode, knownCodes);
	telemetry.fail({ diagnostics: 1 }, code);
	return telemetry.finish(unavailable(code, detail ?? message, 'CORRELATE'));
}

/**
 * Correlates retained guard classifications with already-normalized state and command evidence.
 * Source bytes are searched only for unique retained anchors; no source is reparsed or executed.
 */
export function buildGuardClassificationOverlay(
	inputsValue: GuardClassificationOverlayBuildInputs,
	options?: BuildGuardClassificationOverlayOptions
): GuardClassificationOverlayBuildOutcome {
	const telemetry = createTelemetry(options);
	telemetry.start('REQUEST_BIND');
	let inputs: GuardClassificationOverlayBuildInputs;
	try {
		inputs = materializeInputs(inputsValue);
	} catch (error) {
		telemetry.fail({ diagnostics: 1 }, 'REQUEST_INVALID');
		return telemetry.finish(
			unavailable(
				'REQUEST_INVALID',
				error instanceof Error ? error.message : 'Invalid guard-classification overlay inputs.',
				'REQUEST'
			)
		);
	}
	telemetry.complete();
	try {
		return telemetry.finish(constructOverlayOutcome(inputs, telemetry));
	} catch (error) {
		return overlayFailureOutcome(error, telemetry);
	}
}
