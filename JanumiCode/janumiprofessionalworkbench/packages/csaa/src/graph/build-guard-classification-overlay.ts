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

function semanticIndexes(
	snapshot: StaticSemanticSnapshot,
	enforcementPaths: ReadonlySet<string>,
	factoryTargetNodeIds: ReadonlySet<string>
): SemanticIndexes {
	const projectConfigById = new Map<string, string>();
	const projectProgramById = new Map<string, string>();
	for (const project of snapshot.projects) {
		projectConfigById.set(project.id, project.configPath);
		projectProgramById.set(project.id, project.programId);
	}
	const programProjectById = new Map<string, string>();
	for (const program of snapshot.programs) programProjectById.set(program.id, program.projectId);
	const anchorSourcesByPath = new Map<string, StaticSemanticSnapshot['sources'][number][]>();
	const anchorSourceIds = new Set<string>();
	for (const source of snapshot.sources) {
		if (
			!enforcementPaths.has(source.logicalPath) ||
			source.analysisDisposition !== 'DEEP_INDEXED' ||
			projectConfigById.get(source.projectId) !== APPLICATION_PROJECT
		)
			continue;
		if (
			programProjectById.get(source.programId) !== source.projectId ||
			projectProgramById.get(source.projectId) !== source.programId
		)
			throw new Error(
				'INPUT_POPULATION_MISMATCH\0An enforcement semantic source has inconsistent project/program ownership.'
			);
		addGrouped(anchorSourcesByPath, source.logicalPath, source);
		anchorSourceIds.add(source.id);
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
		addGrouped(referencesByNode, reference.nodeId, reference);
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
		addGrouped(assignmentsByNode, assignment.targetNodeId, assignment);
		if (assignment.valueNodeId !== null) explicitNodeIds.add(assignment.valueNodeId);
	}
	const nodeById = new Map<string, SemanticAstNodeRecord>();
	const nodesBySource = new Map<string, SemanticAstNodeRecord[]>();
	for (const node of snapshot.astNodes) {
		if (!anchorSourceIds.has(node.sourceId) && !explicitNodeIds.has(node.id)) continue;
		nodeById.set(node.id, node);
		if (anchorSourceIds.has(node.sourceId)) addGrouped(nodesBySource, node.sourceId, node);
	}
	return {
		anchorSourcesByPath,
		assignmentsByNode,
		declarationById,
		invocationByNode,
		nodeById,
		nodesBySource,
		referencesByNode,
		symbolById
	};
}

function decodeCompilerText(bytes: Uint8Array): string {
	return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function currentLine(text: string, offset: number): number {
	let line = 1;
	for (let index = 0; index < offset; index += 1) if (text.charCodeAt(index) === 10) line += 1;
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
	let targets: HandlerTargetNode[] = [];
	const targetSiteEdges = edges.filter(
		(edge) => edge.relationKind === 'HANDLER_TARGET_TO_ARROW_SITE' && edge.target.nodeId === site.id
	);
	if (targetSiteEdges.length > 0) {
		supporting.push(...targetSiteEdges);
		targets = targetSiteEdges.flatMap((edge) => {
			const target = nodes.get(edge.source.nodeId);
			return target?.kind === 'HANDLER_TARGET' ? [target] : [];
		});
	} else {
		const tableEdges = edges.filter(
			(edge) =>
				edge.relationKind === 'COMMAND_REGISTRY_ENTRY_TO_TABLE_ARROW_SITE' &&
				edge.target.nodeId === site.id
		);
		supporting.push(...tableEdges);
		for (const tableEdge of tableEdges) {
			const registrationEdges = edges.filter(
				(edge) =>
					edge.relationKind === 'COMMAND_REGISTRY_ENTRY_TO_HANDLER_REGISTRATION' &&
					edge.source.nodeId === tableEdge.source.nodeId
			);
			supporting.push(...registrationEdges);
			for (const registrationEdge of registrationEdges) {
				const targetEdges = edges.filter(
					(edge) =>
						edge.relationKind === 'HANDLER_REGISTRATION_TO_TARGET' &&
						edge.source.nodeId === registrationEdge.target.nodeId
				);
				supporting.push(...targetEdges);
				for (const targetEdge of targetEdges) {
					const target = nodes.get(targetEdge.target.nodeId);
					if (target?.kind === 'HANDLER_TARGET') targets.push(target);
				}
			}
		}
	}
	targets = [...new Map(targets.map((target) => [target.id, target])).values()].sort(
		(left, right) => compareText(left.id, right.id)
	);
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
	const artifact = inputs.subject.artifacts.filter((item) => item.path === path);
	if (artifact.length !== 1)
		throw new Error(
			'INPUT_POPULATION_MISMATCH\0An enforcement source is not unique in the subject.'
		);
	const bytes = readFrozenSubjectArtifact(inputs.subject, path);
	if (
		bytes === undefined ||
		bytes.byteLength !== artifact[0]!.bytes ||
		sha256(bytes) !== artifact[0]!.sha256
	)
		throw new Error('INPUT_POPULATION_MISMATCH\0Frozen enforcement source bytes do not reconcile.');
	const text = decodeCompilerText(bytes);
	const start = text.indexOf(guard.enforcingAnchor);
	if (start < 0 || text.indexOf(guard.enforcingAnchor, start + 1) >= 0)
		throw new Error(
			'UNSUPPORTED_HANDLER_CORRELATION\0An enforcing anchor is absent or non-unique in frozen source bytes.'
		);
	const end = start + guard.enforcingAnchor.length;
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
	const source = sources[0]!;
	const containing = (model.nodesBySource.get(source.id) ?? [])
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
	let node: SemanticAstNodeRecord | undefined = containing[0]!;
	const callableAncestors: SemanticAstNodeRecord[] = [];
	const seen = new Set<string>();
	while (node !== undefined) {
		if (seen.has(node.id))
			throw new Error('INPUT_POPULATION_MISMATCH\0An enforcement AST parent chain is cyclic.');
		seen.add(node.id);
		if (CALLABLE_KINDS.has(node.kind)) callableAncestors.push(node);
		if (node.parentId === null) break;
		const parentId = node.parentId;
		node = model.nodeById.get(parentId);
		if (node === undefined)
			throw new Error('INPUT_POPULATION_MISMATCH\0An enforcement AST ancestor is absent.');
	}
	if (callableAncestors.length === 0)
		throw new Error('UNSUPPORTED_HANDLER_CORRELATION\0No callable contains an enforcing anchor.');
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
			currentLine: currentLine(text, start),
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
		validatePredecessors(inputs, telemetry);
		const { request } = inputs;
		const budgets = request.budgets;
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
			subjectId: request.subjectId
		});
		const graphNodes = new Map(inputs.commandHandlerGraph.nodes.map((node) => [node.id, node]));
		const enforcementPaths = new Set(
			inputs.guardObservation.guards.flatMap((guard) => {
				const match =
					guard.enforcingSite === null ? null : ENFORCEMENT_SITE_PATTERN.exec(guard.enforcingSite);
				return match === null ? [] : [match[1]!];
			})
		);
		const factoryTargetNodeIds = new Set(
			inputs.commandHandlerGraph.nodes.flatMap((node) =>
				node.kind === 'HANDLER_TARGET' && node.bodyKind === 'FACTORY_CALL_RESULT_CANDIDATE'
					? [node.nodeId]
					: []
			)
		);
		const model = semanticIndexes(inputs.semanticSnapshot, enforcementPaths, factoryTargetNodeIds);
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
		const stateEdgesByLegal = new Map<string, (typeof inputs.stateGraph.edges)[number][]>();
		const guardedLegalIds = new Map(
			inputs.stateObservation.guardedTransitions.map((guarded) => [
				guarded.id,
				guarded.legalTransitionId
			])
		);
		for (const edge of inputs.stateGraph.edges) {
			const legalId =
				edge.relationKind === 'LEGAL_TRANSITION'
					? edge.observationRecordId
					: edge.relationKind === 'GUARDED_LEGAL_TRANSITION'
						? (guardedLegalIds.get(edge.observationRecordId as never) ?? edge.observationRecordId)
						: null;
			if (legalId !== null) addGrouped(stateEdgesByLegal, legalId, edge);
		}
		const arrowByTuple = new Map<
			string,
			(typeof inputs.arrowObservation.declaredArrows)[number][]
		>();
		for (const arrow of inputs.arrowObservation.declaredArrows)
			addGrouped(arrowByTuple, tuple(arrow.machine, arrow.from, arrow.to), arrow);
		const classifications = inputs.guardObservation.guards
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
		const classificationByGuardId = new Map(
			classifications.map((record) => [record.guardId, record])
		);
		const occurrenceDrafts: GuardClassificationOverlayOccurrenceRecord[] = [];
		const evidenceFacts: CommandEvidenceFact[] = [];
		telemetry.start('TRANSITION_JOIN', {
			occurrences: inputs.guardObservation.guardedArrows.length
		});
		for (const arrow of inputs.guardObservation.guardedArrows) {
			const key = tuple(arrow.machine, arrow.from, arrow.to);
			const legal = (legalByTuple.get(key) ?? []).filter((item) => item.guard === arrow.guardText);
			if (legal.length !== 1)
				throw new Error(
					'UNSUPPORTED_TRANSITION_JOIN\0A guard occurrence has no unique exact guarded legal-transition join.'
				);
			const edges = stateEdgesByLegal.get(legal[0]!.id) ?? [];
			if (edges.length === 0)
				throw new Error(
					'UNSUPPORTED_TRANSITION_JOIN\0A guarded transition has no state-graph evidence.'
				);
			const classification = classificationByGuardId.get(arrow.guardId);
			if (classification === undefined)
				throw new Error(
					'INPUT_POPULATION_MISMATCH\0A guard occurrence has no classification record.'
				);
			const id = guardOccurrenceRecordId(overlayId, arrow.id);
			const commandFacts = (arrowByTuple.get(key) ?? []).map((commandArrow) =>
				commandEvidenceForOccurrence(
					overlayId,
					id,
					commandArrow.id,
					graphNodes,
					inputs.commandHandlerGraph.edges,
					inputs.commandHandlerGraph.id
				)
			);
			evidenceFacts.push(...commandFacts);
			occurrenceDrafts.push({
				arrowId: arrow.id,
				classificationId: classification.id,
				commandEvidenceLinkIds: commandFacts.map((fact) => fact.link.id).sort(compareText),
				frontierIds: [],
				from: arrow.from,
				guardText: arrow.guardText,
				id,
				legalTransitionId: legal[0]!.id,
				machine: arrow.machine,
				stateGraphEdgeIds: sortedUnique(edges.map((edge) => edge.id)),
				to: arrow.to
			});
		}
		telemetry.complete({
			occurrences: occurrenceDrafts.length,
			stateEvidenceRefs: occurrenceDrafts.reduce(
				(sum, record) => sum + record.stateGraphEdgeIds.length,
				0
			)
		});
		if (evidenceFacts.length > budgets.maxCommandEvidenceLinks)
			throw new RangeError('maxCommandEvidenceLinks exceeded.');
		telemetry.start('COMMAND_EVIDENCE_JOIN', { links: evidenceFacts.length });
		telemetry.complete({ links: evidenceFacts.length });

		telemetry.start('ENFORCEMENT_ANCHOR_BIND');
		const anchorFactsById = new Map<GuardClassificationOverlayAnchorSite['id'], AnchorFact>();
		let sourceBytes = 0;
		const readSourcePaths = new Set<string>();
		for (const guard of inputs.guardObservation.guards) {
			if (guard.enforcingAnchor === null && guard.enforcingSite === null) continue;
			const classification = classificationByGuardId.get(guard.id)!;
			const fact = anchorFact(overlayId, guard, classification.id, inputs, model);
			const existing = anchorFactsById.get(fact.anchor.id);
			if (existing === undefined) {
				anchorFactsById.set(fact.anchor.id, fact);
				if (!readSourcePaths.has(fact.anchor.path)) {
					const artifact = inputs.subject.artifacts.find((item) => item.path === fact.anchor.path)!;
					sourceBytes += artifact.bytes;
					readSourcePaths.add(fact.anchor.path);
				}
			} else {
				anchorFactsById.set(fact.anchor.id, {
					...existing,
					anchor: {
						...existing.anchor,
						classificationIds: sortedUnique([...existing.classificationIds, classification.id])
					},
					classificationIds: sortedUnique([...existing.classificationIds, classification.id])
				});
			}
		}
		if (anchorFactsById.size > budgets.maxAnchorSites)
			throw new RangeError('maxAnchorSites exceeded.');
		if (sourceBytes > budgets.maxSourceBytes) throw new RangeError('maxSourceBytes exceeded.');
		telemetry.complete({ anchors: anchorFactsById.size, sourceBytes });

		const frontiers: GuardClassificationOverlayFrontier[] = [];
		const handlerLinks: GuardClassificationOverlayHandlerLink[] = [];
		const evidenceByOccurrence = new Map<string, CommandEvidenceFact[]>();
		for (const fact of evidenceFacts)
			addGrouped(evidenceByOccurrence, fact.link.occurrenceId, fact);
		const occurrenceByClassification = new Map<
			string,
			GuardClassificationOverlayOccurrenceRecord[]
		>();
		for (const occurrence of occurrenceDrafts)
			addGrouped(occurrenceByClassification, occurrence.classificationId, occurrence);
		const makeFrontier = (
			frontierKind: GuardClassificationOverlayFrontier['frontierKind'],
			classificationId: GuardClassificationOverlayFrontier['classificationId'],
			occurrenceId: GuardClassificationOverlayFrontier['occurrenceId'],
			anchorSiteId: GuardClassificationOverlayFrontier['anchorSiteId']
		): GuardClassificationOverlayFrontier => ({
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
		});
		for (const classification of classifications) {
			if (classification.ledgerState === 'STALE')
				frontiers.push(makeFrontier('STALE_LEDGER_ROW', classification.id, null, null));
			if (classification.ledgerState === 'UNCLASSIFIED')
				frontiers.push(makeFrontier('UNCLASSIFIED_GUARD_TEXT', classification.id, null, null));
		}
		for (const occurrence of occurrenceDrafts)
			if (occurrence.commandEvidenceLinkIds.length === 0)
				frontiers.push(
					makeFrontier(
						'NO_RETAINED_DECLARED_ARROW_EVIDENCE',
						occurrence.classificationId,
						occurrence.id,
						null
					)
				);
		telemetry.start('HANDLER_CORRELATE', { anchors: anchorFactsById.size });
		for (const anchorFactValue of anchorFactsById.values()) {
			const containingCallableIds = new Set(
				anchorFactValue.callableAncestors.map((callable) => callable.id)
			);
			for (const classificationId of anchorFactValue.classificationIds) {
				const facts = (occurrenceByClassification.get(classificationId) ?? []).flatMap(
					(occurrence) => evidenceByOccurrence.get(occurrence.id) ?? []
				);
				const exactTargets = new Map<string, HandlerTargetNode>();
				for (const fact of facts)
					for (const target of fact.targets)
						if (target.bodyKind === 'DIRECT_FUNCTION' && containingCallableIds.has(target.nodeId))
							exactTargets.set(target.id, target);
				if (exactTargets.size === 1) {
					const target = [...exactTargets.values()][0]!;
					const supporting = facts
						.filter((fact) => fact.targets.some((item) => item.id === target.id))
						.flatMap((fact) => fact.link.supportingEdgeIds);
					const targetNodeIds = [target.id] as const;
					handlerLinks.push({
						anchorSiteId: anchorFactValue.anchor.id,
						attribution: 'EXACT',
						commandHandlerGraphId: inputs.commandHandlerGraph.id,
						id: guardEnforcementHandlerLinkId({
							anchorSiteId: anchorFactValue.anchor.id,
							attribution: 'EXACT',
							overlayId,
							targetNodeIds
						}),
						kind: 'EXACT_HANDLER_TARGET',
						supportingEdgeIds: sortedUnique(supporting),
						targetNodeIds
					});
					continue;
				}
				const factoryTargets = new Map<
					HandlerTargetNode['id'],
					{ readonly callable: SemanticAstNodeRecord; readonly target: HandlerTargetNode }
				>();
				for (const fact of facts)
					for (const target of fact.targets) {
						const factoryCallable = factoryCallableForTarget(target, model);
						if (factoryCallable !== null && containingCallableIds.has(factoryCallable.id))
							factoryTargets.set(target.id, { callable: factoryCallable, target });
					}
				const factoryCallableIds = sortedUnique(
					[...factoryTargets.values()].map((match) => match.callable.id)
				);
				if (factoryTargets.size > 0 && factoryCallableIds.length === 1) {
					const factoryCallableNodeId = factoryCallableIds[0]!;
					const targetNodeIds = sortedUnique(factoryTargets.keys());
					const supporting = facts
						.filter((fact) => fact.targets.some((target) => factoryTargets.has(target.id)))
						.flatMap((fact) => fact.link.supportingEdgeIds);
					handlerLinks.push({
						anchorSiteId: anchorFactValue.anchor.id,
						attribution: 'CANDIDATE',
						commandHandlerGraphId: inputs.commandHandlerGraph.id,
						factoryCallableNodeId,
						id: guardEnforcementHandlerLinkId({
							anchorSiteId: anchorFactValue.anchor.id,
							attribution: 'CANDIDATE',
							factoryCallableNodeId,
							overlayId,
							targetNodeIds
						}),
						kind: 'FACTORY_SHARED_CANDIDATE',
						supportingEdgeIds: sortedUnique(supporting),
						targetNodeIds
					});
					frontiers.push(
						makeFrontier(
							'FACTORY_HANDLER_ATTRIBUTION_CANDIDATE',
							classificationId,
							null,
							anchorFactValue.anchor.id
						)
					);
				} else
					frontiers.push(
						makeFrontier(
							'HELPER_CALL_FLOW_UNRESOLVED',
							classificationId,
							null,
							anchorFactValue.anchor.id
						)
					);
			}
		}
		const deduplicatedHandlerLinks = [
			...new Map(handlerLinks.map((link) => [link.id, link])).values()
		];
		handlerLinks.splice(0, handlerLinks.length, ...deduplicatedHandlerLinks);
		if (handlerLinks.length > budgets.maxHandlerLinks)
			throw new RangeError('maxHandlerLinks exceeded.');
		if (frontiers.length > budgets.maxFrontiers) throw new RangeError('maxFrontiers exceeded.');
		telemetry.complete({ handlerLinks: handlerLinks.length });
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
		const anchorSites = [...anchorFactsById.values()]
			.map((fact): GuardClassificationOverlayAnchorSite => ({
				...fact.anchor,
				frontierIds: sortedUnique(
					fact.classificationIds.flatMap((id) =>
						(frontiersByClassification.get(id) ?? [])
							.filter((frontier) => frontier.anchorSiteId === fact.anchor.id)
							.map((frontier) => frontier.id)
					)
				),
				handlerLinkIds: sortedUnique(
					(linksByAnchor.get(fact.anchor.id) ?? []).map((link) => link.id)
				)
			}))
			.sort((left, right) => compareText(left.id, right.id));
		const anchorByClassification = new Map<string, GuardClassificationOverlayAnchorSite>();
		for (const anchor of anchorSites)
			for (const classificationId of anchor.classificationIds)
				anchorByClassification.set(classificationId, anchor);
		const completedClassifications = classifications.map((classification) => ({
			...classification,
			anchorSiteId: anchorByClassification.get(classification.id)?.id ?? null
		}));
		const occurrences = occurrenceDrafts
			.map((occurrence): GuardClassificationOverlayOccurrenceRecord => ({
				...occurrence,
				frontierIds: sortedUnique(
					(frontiersByClassification.get(occurrence.classificationId) ?? [])
						.filter(
							(frontier) =>
								frontier.occurrenceId === null || frontier.occurrenceId === occurrence.id
						)
						.map((frontier) => frontier.id)
				)
			}))
			.sort((left, right) => compareText(left.id, right.id));
		telemetry.complete({ frontiers: frontiers.length });

		const commandEvidenceLinks = evidenceFacts
			.map((fact) => fact.link)
			.sort((left, right) => compareText(left.id, right.id));
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
		const derivationLayer: GuardClassificationOverlayLayer = {
			capability: GUARD_CLASSIFICATION_OVERLAY_DERIVATION_CAPABILITY,
			capabilityStatus: GUARD_CLASSIFICATION_OVERLAY_CAPABILITY_STATUS,
			classificationIds: completedClassifications.map((record) => record.id),
			commandEvidenceLinkIds: commandEvidenceLinks.map((record) => record.id),
			frontierIds: derivationFrontierIds,
			handlerLinkIds: exactHandlerLinkIds,
			id: guardClassificationOverlayLayerId(overlayId, 'DERIVATION'),
			kind: 'JPWB_GUARD_CLASSIFICATION_DERIVATION',
			occurrenceIds: occurrences.map((record) => record.id),
			ordinal: 0,
			overlayId
		};
		const inferenceLayer: GuardClassificationOverlayLayer = {
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
		};
		const dispositionValues = [
			...new Set(completedClassifications.map((item) => item.disposition))
		].sort((left, right) => (left === null ? -1 : right === null ? 1 : compareText(left, right)));
		const stateEvidenceRefs = occurrences.reduce(
			(sum, record) => sum + record.stateGraphEdgeIds.length,
			0
		);
		if (stateEvidenceRefs > budgets.maxStateEvidenceRefs)
			throw new RangeError('maxStateEvidenceRefs exceeded.');
		const expectedCommandEvidenceLinks = inputs.guardObservation.guardedArrows.reduce(
			(sum, arrow) =>
				sum + (arrowByTuple.get(tuple(arrow.machine, arrow.from, arrow.to))?.length ?? 0),
			0
		);
		const coverage: GuardClassificationOverlayCoverage = {
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
				count: completedClassifications.filter((record) => record.disposition === disposition)
					.length,
				disposition
			})),
			expectedClassifications: inputs.guardObservation.guards.length,
			expectedCommandEvidenceLinks,
			expectedOccurrences: inputs.guardObservation.guardedArrows.length,
			expectedStateEvidenceRefs: stateEvidenceRefs,
			frontiers: frontiers.length,
			helperFrontiers: frontiers.filter(
				(item) => item.frontierKind === 'HELPER_CALL_FLOW_UNRESOLVED'
			).length,
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
		const anchorForClassification = (classificationId: string) =>
			anchorByClassification.get(classificationId);
		const forwardIndex = completedClassifications
			.map((classification) => {
				const classOccurrences = occurrenceByClassification.get(classification.id) ?? [];
				const anchor = anchorForClassification(classification.id);
				return indexEntry({
					anchorSiteIds: anchor === undefined ? [] : [anchor.id],
					classificationIds: [classification.id],
					commandEvidenceLinkIds: classOccurrences.flatMap((item) => item.commandEvidenceLinkIds),
					frontierIds:
						frontiersByClassification.get(classification.id)?.map((item) => item.id) ?? [],
					handlerLinkIds: anchor === undefined ? [] : anchor.handlerLinkIds,
					key: classification.guardText,
					occurrenceIds: classOccurrences.map((item) => item.id)
				});
			})
			.sort(
				(left, right) =>
					compareText(left.key, right.key) ||
					compareText(left.classificationIds[0]!, right.classificationIds[0]!)
			);
		const reverseIndex = occurrences
			.map((occurrence) => {
				const anchor = anchorForClassification(occurrence.classificationId);
				return indexEntry({
					anchorSiteIds: anchor === undefined ? [] : [anchor.id],
					classificationIds: [occurrence.classificationId],
					commandEvidenceLinkIds: occurrence.commandEvidenceLinkIds,
					frontierIds: occurrence.frontierIds,
					handlerLinkIds: anchor === undefined ? [] : anchor.handlerLinkIds,
					key: tuple(occurrence.machine, occurrence.from, occurrence.to),
					occurrenceIds: [occurrence.id]
				});
			})
			.sort(
				(left, right) =>
					compareText(left.key, right.key) ||
					compareText(left.occurrenceIds[0]!, right.occurrenceIds[0]!)
			);

		telemetry.start('MATERIALIZE');
		const content = {
			anchorSites,
			arrowObservationContentDigest: inputs.arrowObservation.contentDigest,
			arrowObservationId: inputs.arrowObservation.id,
			authorityTransfer: GUARD_CLASSIFICATION_OVERLAY_AUTHORITY_TRANSFER,
			baselineChange: GUARD_CLASSIFICATION_OVERLAY_BASELINE_CHANGE,
			budgets: { ...budgets },
			canonicalProfile: GUARD_CLASSIFICATION_OVERLAY_CANONICAL_PROFILE,
			capabilities: [
				GUARD_CLASSIFICATION_OVERLAY_DERIVATION_CAPABILITY,
				GUARD_CLASSIFICATION_OVERLAY_INFERENCE_CAPABILITY
			] as const,
			capabilityStatus: GUARD_CLASSIFICATION_OVERLAY_CAPABILITY_STATUS,
			classifications: completedClassifications,
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
			limitations: GUARD_CLASSIFICATION_OVERLAY_LIMITATIONS.map((item) => ({ ...item })),
			method: GUARD_CLASSIFICATION_OVERLAY_METHOD,
			occurrences,
			operationVersion: GUARD_CLASSIFICATION_OVERLAY_OPERATION_VERSION,
			oracleChange: GUARD_CLASSIFICATION_OVERLAY_ORACLE_CHANGE,
			producer: { ...inputs.semanticSnapshot.provider },
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
			subjectId: request.subjectId
		};
		const overlay: GuardClassificationOverlaySnapshot = {
			...content,
			contentDigest: guardClassificationOverlayContentDigest(content)
		};
		telemetry.complete({ records: completedClassifications.length + occurrences.length });
		telemetry.start('SERIALIZE');
		telemetry.complete({ bytes: JSON.stringify(overlay).length });
		telemetry.start('OVERLAY_VALIDATE');
		const validation = validateGuardClassificationOverlay(overlay, inputs, {
			maxInputRecords: 10_000_000,
			maxInputStringCharacters: 1_000_000_000,
			maxIssues: Math.min(budgets.maxDiagnostics, 1_000),
			maxRecords: 10_000_000,
			maxStringCharacters: 1_000_000_000
		});
		if (validation.state !== 'VALID') {
			telemetry.fail({ diagnostics: validation.issues.length }, validation.state);
			return telemetry.finish(
				unavailable(
					'OVERLAY_VALIDATION_FAILED',
					`Constructed overlay failed validation: ${validationSummary(validation.issues)}`,
					'VALIDATE'
				)
			);
		}
		telemetry.complete({ diagnostics: 0 });
		return telemetry.finish({
			diagnostics: [],
			outcome: 'partial',
			overlay
		} as GuardClassificationOverlayBuildOutcome);
	} catch (error) {
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
		const code =
			error instanceof RangeError
				? ('BUDGET_EXCEEDED' as const)
				: knownCodes.has(encodedCode as GuardClassificationOverlayDiagnostic['code'])
					? (encodedCode as GuardClassificationOverlayDiagnostic['code'])
					: ('INPUT_POPULATION_MISMATCH' as const);
		telemetry.fail({ diagnostics: 1 }, code);
		return telemetry.finish(unavailable(code, detail ?? message, 'CORRELATE'));
	}
}
