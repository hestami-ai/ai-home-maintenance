import { isProxy } from 'node:util/types';
import ts from 'typescript';

import {
	COMMAND_EVENT_CONTRACT_OVERLAY_AUTHORITY_TRANSFER,
	COMMAND_EVENT_CONTRACT_OVERLAY_BASELINE_CHANGE,
	COMMAND_EVENT_CONTRACT_OVERLAY_CANONICAL_PROFILE,
	COMMAND_EVENT_CONTRACT_OVERLAY_CAPABILITY_STATUS,
	COMMAND_EVENT_CONTRACT_OVERLAY_DERIVATION_CAPABILITY,
	COMMAND_EVENT_CONTRACT_OVERLAY_FULL_JAN_CSAA_007_CONFORMANCE,
	COMMAND_EVENT_CONTRACT_OVERLAY_FULL_JAN_CSAA_008_CONFORMANCE,
	COMMAND_EVENT_CONTRACT_OVERLAY_GATE_EFFECT,
	COMMAND_EVENT_CONTRACT_OVERLAY_GRAPH_AUTHORITY,
	COMMAND_EVENT_CONTRACT_OVERLAY_INFERENCE_CAPABILITY,
	COMMAND_EVENT_CONTRACT_OVERLAY_INTEGRATION_STRATEGY,
	COMMAND_EVENT_CONTRACT_OVERLAY_LIMITATIONS,
	COMMAND_EVENT_CONTRACT_OVERLAY_METHOD,
	COMMAND_EVENT_CONTRACT_OVERLAY_OPERATION_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_ORACLE_CHANGE,
	COMMAND_EVENT_CONTRACT_OVERLAY_PROGRESS_SCHEMA_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_STATUS,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPLACEMENT_EQUIVALENCE,
	COMMAND_EVENT_CONTRACT_OVERLAY_REQUEST_SCHEMA_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_RUNTIME_EMISSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_RUNTIME_PERFORMABILITY,
	COMMAND_EVENT_CONTRACT_OVERLAY_SCHEMA_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_SCOPE,
	COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
	type BuildCommandEventContractOverlayOptions,
	type BuildCommandEventContractOverlayRequest,
	type CommandEventContractBoundContribution,
	type CommandEventContractCommandRecord,
	type CommandEventContractDeclaredLink,
	type CommandEventContractEventRecord,
	type CommandEventContractFrontier,
	type CommandEventContractHandlerReference,
	type CommandEventContractOverlayBuildInputs,
	type CommandEventContractOverlayBuildOutcome,
	type CommandEventContractOverlayCoverage,
	type CommandEventContractOverlayDiagnostic,
	type CommandEventContractOverlayId,
	type CommandEventContractOverlayIndexEntry,
	type CommandEventContractOverlayLayer,
	type CommandEventContractOverlayProgressEvent,
	type CommandEventContractOverlayProgressPhase,
	type CommandEventContractOverlaySnapshot,
	type CommandEventContractPinnedEmission,
	type CommandEventContractRegistrySelector
} from '../contracts/command-event-contract-overlay.js';
import type {
	CommandHandlerGraphNode,
	CommandRegistryEntryNode
} from '../contracts/command-handler-graph.js';
import type {
	SemanticAstNodeRecord,
	SemanticDeclarationRecord,
	SemanticReferenceRecord,
	SemanticSourceRecord,
	SemanticSymbolRecord,
	StaticSemanticSnapshot
} from '../contracts/semantic.js';
import type { CapturedArtifactRecord, FrozenSubject } from '../contracts/subject.js';
import { compareText, sha256 } from '../inventory/canonical.js';
import { validateArrowCommandCensusObservation } from '../providers/jpwb-arrow-command-census/validate-arrow-command-census.js';
import { isFrozenSubjectCapability, readFrozenSubjectArtifact } from '../subject/frozen-store.js';
import {
	commandEventContractBoundContributionId,
	commandEventContractCommandId,
	commandEventContractDeclaredLinkId,
	commandEventContractDerivationLayerId,
	commandEventContractEventId,
	commandEventContractFrontierId,
	commandEventContractInferenceLayerId,
	commandEventContractOverlayContentDigest,
	commandEventContractOverlayId,
	commandEventContractOverlayInputDigest,
	commandEventContractPinnedEmissionId,
	commandEventContractRetainedCensusArtifactSelector,
	commandEventContractRetainedCensusReference,
	commandEventContractVocabArtifactSelector
} from './command-event-contract-overlay-canonical.js';
import { commandHandlerGraphInputDigest } from './command-handler-graph-canonical.js';
import { validateConstructedCommandEventContractOverlay } from './validate-command-event-contract-overlay.js';
import { validateConstructedCommandHandlerGraph } from './validate-command-handler-graph.js';

const INPUT_KEYS = [
	'arrowObservation',
	'commandHandlerGraph',
	'commandHandlerRequest',
	'request',
	'semanticSnapshot',
	'subject'
] as const;
const REQUEST_KEYS = [
	'arrowObservationId',
	'budgets',
	'commandHandlerGraphId',
	'commandRegistry',
	'eventRegistry',
	'operationVersion',
	'retainedCensusArtifact',
	'schemaVersion',
	'semanticSnapshotId',
	'subjectId',
	'vocabArtifact'
] as const;
const BUDGET_KEYS = [
	'maxAstNodes',
	'maxBoundContributions',
	'maxCommands',
	'maxDeclaredLinks',
	'maxDiagnostics',
	'maxEventContracts',
	'maxFrontiers',
	'maxPinnedEmissions',
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
const ARTIFACT_SELECTOR_KEYS = ['artifactBytes', 'artifactContentSha256', 'artifactPath'] as const;
const SNAPSHOT_SHELL_KEYS = [
	'aliases',
	'assignabilityRequests',
	'assignments',
	'astNodes',
	'astTraversalProfile',
	'budgets',
	'canonicalProfile',
	'capabilities',
	'compilerInputs',
	'contextDigest',
	'declarationCandidates',
	'declarations',
	'diagnostics',
	'extractionVersion',
	'expectedEmpty',
	'fullJanCsaa007Conformance',
	'health',
	'id',
	'invocations',
	'limitations',
	'literals',
	'moduleExports',
	'moduleResolutions',
	'operationVersion',
	'overloadSets',
	'populations',
	'programs',
	'projects',
	'provenances',
	'provider',
	'references',
	'requestedCapabilities',
	'schemaVersion',
	'scopes',
	'signatureParameters',
	'signatures',
	'sources',
	'subjectId',
	'symbols',
	'typeParameters',
	'typeRelations',
	'types'
] as const;
const SUBJECT_SHELL_KEYS = [
	'artifacts',
	'descriptor',
	'diagnostics',
	'excludedArtifacts',
	'generatedContexts',
	'population',
	'projects',
	'request',
	'workspaces'
] as const;
const GRAPH_SHELL_KEYS = [
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
const SHA256 = /^[a-f0-9]{64}$/u;

interface TelemetryRecorder {
	complete(counts?: Readonly<Record<string, number>>, detailCode?: string | null): void;
	fail(counts?: Readonly<Record<string, number>>, detailCode?: string | null): void;
	finish<Outcome extends CommandEventContractOverlayBuildOutcome>(outcome: Outcome): Outcome;
	start(
		phase: CommandEventContractOverlayProgressPhase,
		counts?: Readonly<Record<string, number>>
	): void;
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

function selectorRecord(
	value: unknown,
	exportName: 'COMMANDS' | 'EVENTS',
	path: string
): CommandEventContractRegistrySelector {
	const record = exactPlainRecord(value, SELECTOR_KEYS, path);
	for (const key of SELECTOR_KEYS)
		if (typeof record[key] !== 'string' || (record[key] as string).length === 0)
			throw new TypeError(`${path}.${key} must be nonempty text.`);
	if (record.exportName !== exportName)
		throw new TypeError(`${path}.exportName must be ${exportName}.`);
	if (record.logicalPath !== COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH)
		throw new TypeError(`${path}.logicalPath is unsupported.`);
	if (record.projectConfigPath !== COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH)
		throw new TypeError(`${path}.projectConfigPath is unsupported.`);
	if (!SHA256.test(record.contentSha256 as string))
		throw new TypeError(`${path}.contentSha256 must be lowercase SHA-256.`);
	return { ...(record as unknown as CommandEventContractRegistrySelector) };
}

function artifactSelectorRecord(
	value: unknown,
	artifactPath:
		| typeof COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH
		| typeof COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
	path: string
): BuildCommandEventContractOverlayRequest['retainedCensusArtifact'] {
	const record = exactPlainRecord(value, ARTIFACT_SELECTOR_KEYS, path);
	if (!Number.isSafeInteger(record.artifactBytes) || (record.artifactBytes as number) < 0)
		throw new TypeError(`${path}.artifactBytes must be a nonnegative safe integer.`);
	if (
		typeof record.artifactContentSha256 !== 'string' ||
		!SHA256.test(record.artifactContentSha256)
	)
		throw new TypeError(`${path}.artifactContentSha256 must be lowercase SHA-256.`);
	if (record.artifactPath !== artifactPath)
		throw new TypeError(`${path}.artifactPath is unsupported.`);
	return {
		artifactBytes: record.artifactBytes as number,
		artifactContentSha256: record.artifactContentSha256,
		artifactPath
	};
}

function assertRequestBudgets(budgets: Record<string, unknown>): void {
	for (const key of BUDGET_KEYS)
		if (
			!Number.isSafeInteger(budgets[key]) ||
			(budgets[key] as number) < (key === 'maxDiagnostics' ? 1 : 0)
		)
			throw new TypeError(
				`$inputs.request.budgets.${key} must be a ${
					key === 'maxDiagnostics' ? 'positive' : 'nonnegative'
				} safe integer.`
			);
}

function assertRequestIdentityText(requestRecord: Record<string, unknown>): void {
	for (const key of [
		'arrowObservationId',
		'commandHandlerGraphId',
		'operationVersion',
		'schemaVersion',
		'semanticSnapshotId',
		'subjectId'
	] as const)
		if (typeof requestRecord[key] !== 'string' || (requestRecord[key] as string).length === 0)
			throw new TypeError(`$inputs.request.${key} must be nonempty text.`);
}

function materializeInputs(value: unknown): CommandEventContractOverlayBuildInputs {
	const input = exactPlainRecord(value, INPUT_KEYS, '$inputs');
	const semanticSnapshot = exactPlainRecord(
		input.semanticSnapshot,
		SNAPSHOT_SHELL_KEYS,
		'$inputs.semanticSnapshot'
	);
	const commandHandlerGraph = exactPlainRecord(
		input.commandHandlerGraph,
		GRAPH_SHELL_KEYS,
		'$inputs.commandHandlerGraph'
	);
	const arrowObservation = shallowDataRecord(input.arrowObservation, '$inputs.arrowObservation');
	if (!isFrozenSubjectCapability(input.subject))
		throw new TypeError('$inputs.subject must be one attached FrozenSubject capability.');
	const subject = exactPlainRecord(input.subject, SUBJECT_SHELL_KEYS, '$inputs.subject');
	for (const [path, record, arrayKeys] of [
		[
			'$inputs.semanticSnapshot',
			semanticSnapshot,
			[
				'aliases',
				'assignabilityRequests',
				'assignments',
				'astNodes',
				'capabilities',
				'compilerInputs',
				'declarationCandidates',
				'declarations',
				'diagnostics',
				'invocations',
				'limitations',
				'literals',
				'moduleExports',
				'moduleResolutions',
				'overloadSets',
				'populations',
				'programs',
				'projects',
				'provenances',
				'references',
				'requestedCapabilities',
				'scopes',
				'signatureParameters',
				'signatures',
				'sources',
				'symbols',
				'typeParameters',
				'typeRelations',
				'types'
			]
		],
		['$inputs.commandHandlerGraph', commandHandlerGraph, ['edges', 'nodes']],
		['$inputs.subject', subject, ['artifacts']],
		['$inputs.arrowObservation', arrowObservation, ['declaredArrows', 'declaredSites']]
	] as const)
		for (const key of arrayKeys) assertOrdinaryArray(record[key], `${path}.${key}`);
	shallowDataRecord(subject.descriptor, '$inputs.subject.descriptor');
	shallowDataRecord(semanticSnapshot.budgets, '$inputs.semanticSnapshot.budgets');
	shallowDataRecord(semanticSnapshot.provider, '$inputs.semanticSnapshot.provider');
	const requestRecord = exactPlainRecord(input.request, REQUEST_KEYS, '$inputs.request');
	const budgets = exactPlainRecord(requestRecord.budgets, BUDGET_KEYS, '$inputs.request.budgets');
	assertRequestBudgets(budgets);
	assertRequestIdentityText(requestRecord);
	if (requestRecord.schemaVersion !== COMMAND_EVENT_CONTRACT_OVERLAY_REQUEST_SCHEMA_VERSION)
		throw new TypeError('Unsupported command-event overlay request schema version.');
	if (requestRecord.operationVersion !== COMMAND_EVENT_CONTRACT_OVERLAY_OPERATION_VERSION)
		throw new TypeError('Unsupported command-event overlay operation version.');
	const commandRegistry = selectorRecord(
		requestRecord.commandRegistry,
		'COMMANDS',
		'$inputs.request.commandRegistry'
	);
	const eventRegistry = selectorRecord(
		requestRecord.eventRegistry,
		'EVENTS',
		'$inputs.request.eventRegistry'
	);
	const retainedCensusArtifact = artifactSelectorRecord(
		requestRecord.retainedCensusArtifact,
		COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
		'$inputs.request.retainedCensusArtifact'
	);
	const vocabArtifact = artifactSelectorRecord(
		requestRecord.vocabArtifact,
		COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
		'$inputs.request.vocabArtifact'
	);
	const commandHandlerRequestRecord = exactPlainRecord(
		input.commandHandlerRequest,
		[
			'arrowObservationId',
			'budgets',
			'commandRegistry',
			'handlerRegistry',
			'operationVersion',
			'schemaVersion',
			'semanticSnapshotId',
			'subjectId'
		],
		'$inputs.commandHandlerRequest'
	);
	const commandHandlerBudgets = exactPlainRecord(
		commandHandlerRequestRecord.budgets,
		[
			'maxAstNodes',
			'maxCommandRegistryEntries',
			'maxEdges',
			'maxFrontiers',
			'maxHandlerRegistryEntries',
			'maxNodes',
			'maxSourceBytes'
		],
		'$inputs.commandHandlerRequest.budgets'
	);
	const commandHandlerCommandRegistry = exactPlainRecord(
		commandHandlerRequestRecord.commandRegistry,
		SELECTOR_KEYS,
		'$inputs.commandHandlerRequest.commandRegistry'
	);
	const commandHandlerHandlerRegistry = exactPlainRecord(
		commandHandlerRequestRecord.handlerRegistry,
		SELECTOR_KEYS,
		'$inputs.commandHandlerRequest.handlerRegistry'
	);
	return {
		...(input as unknown as CommandEventContractOverlayBuildInputs),
		commandHandlerRequest: {
			...(commandHandlerRequestRecord as unknown as CommandEventContractOverlayBuildInputs['commandHandlerRequest']),
			budgets: {
				...(commandHandlerBudgets as unknown as CommandEventContractOverlayBuildInputs['commandHandlerRequest']['budgets'])
			},
			commandRegistry: {
				...(commandHandlerCommandRegistry as unknown as CommandEventContractOverlayBuildInputs['commandHandlerRequest']['commandRegistry'])
			},
			handlerRegistry: {
				...(commandHandlerHandlerRegistry as unknown as CommandEventContractOverlayBuildInputs['commandHandlerRequest']['handlerRegistry'])
			}
		},
		request: {
			...(requestRecord as unknown as BuildCommandEventContractOverlayRequest),
			budgets: { ...(budgets as unknown as BuildCommandEventContractOverlayRequest['budgets']) },
			commandRegistry,
			eventRegistry,
			retainedCensusArtifact,
			vocabArtifact
		}
	};
}

function shallowDataRecord(value: unknown, path: string): Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		throw new TypeError(`${path} must be an exact plain data record.`);
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new TypeError(`${path} must have a plain prototype.`);
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key !== 'string') throw new TypeError(`${path} may not have symbol keys.`);
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new TypeError(`${path}.${key} must be an enumerable data property.`);
	}
	return value as Record<string, unknown>;
}

function assertOrdinaryArray(value: unknown, path: string): asserts value is unknown[] {
	if (!Array.isArray(value) || isProxy(value) || Reflect.getPrototypeOf(value) !== Array.prototype)
		throw new TypeError(`${path} must be an exact ordinary array.`);
	const length = Reflect.getOwnPropertyDescriptor(value, 'length');
	if (
		length === undefined ||
		!('value' in length) ||
		!Number.isSafeInteger(length.value) ||
		(length.value as number) < 0
	)
		throw new TypeError(`${path} has an invalid length descriptor.`);
}

function unavailable(
	code: CommandEventContractOverlayDiagnostic['code'],
	message: string,
	phase: CommandEventContractOverlayDiagnostic['phase'],
	path: string | null = null
): CommandEventContractOverlayBuildOutcome {
	return { diagnostics: [{ code, message, path, phase }], outcome: 'unavailable' };
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
	options: BuildCommandEventContractOverlayOptions | undefined
): TelemetryRecorder {
	let sink: ((event: CommandEventContractOverlayProgressEvent) => void) | undefined;
	try {
		if (options !== undefined) {
			const record = exactPlainRecord(options, ['onProgress'], '$options');
			if (typeof record.onProgress === 'function')
				sink = record.onProgress as (event: CommandEventContractOverlayProgressEvent) => void;
		}
	} catch {
		// Telemetry is out of band and malformed options cannot affect evidence.
	}
	const events: CommandEventContractOverlayProgressEvent[] = [];
	let active: CommandEventContractOverlayProgressPhase | null = null;
	let sequence = 0;
	const emit = (
		phase: CommandEventContractOverlayProgressPhase,
		state: CommandEventContractOverlayProgressEvent['state'],
		counts: Readonly<Record<string, number>>,
		detailCode: string | null
	): void => {
		events.push(
			Object.freeze({
				counts: boundedCounts(counts),
				detailCode,
				phase,
				schemaVersion: COMMAND_EVENT_CONTRACT_OVERLAY_PROGRESS_SCHEMA_VERSION,
				sequence: sequence++,
				state
			})
		);
	};
	const close = (
		state: CommandEventContractOverlayProgressEvent['state'],
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
		finish<Outcome extends CommandEventContractOverlayBuildOutcome>(outcome: Outcome): Outcome {
			if (active !== null) close('FAILED', { interrupted: 1 }, 'INTERRUPTED');
			const frozen = deepFreezeConstructed(outcome);
			if (sink !== undefined) {
				const frozenEvents = Object.freeze([...events]);
				queueMicrotask(() => {
					for (const event of frozenEvents)
						try {
							sink!(event);
						} catch {
							// Telemetry is intentionally deferred and cannot alter the outcome.
						}
				});
			}
			return frozen;
		},
		start(phase, counts = {}): void {
			if (active !== null) close('FAILED', { interrupted: 1 }, 'INTERRUPTED');
			active = phase;
			emit(phase, 'STARTED', counts, null);
		}
	};
}

function sortedUnique<Id extends string>(values: Iterable<Id>): Id[] {
	return [...new Set(values)].sort(compareText);
}

function exactOne<Value>(values: readonly Value[], description: string): Value {
	if (values.length !== 1)
		throw new Error(`${description} must have exactly one member; found ${values.length}.`);
	return values[0]!;
}

function validationSummary(
	issues: readonly { readonly code: string; readonly message: string; readonly path: string }[]
): string {
	return issues
		.slice(0, 3)
		.map((issue) => `${issue.code}@${issue.path}: ${issue.message}`)
		.join(', ');
}

function decodeUtf8(bytes: Uint8Array, description: string): string {
	const body =
		bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
			? bytes.subarray(3)
			: bytes;
	try {
		return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(body);
	} catch {
		throw new Error(`${description} is not fatal-decodable UTF-8.`);
	}
}

function uniqueMap<Value, Key>(
	values: readonly Value[],
	key: (value: Value) => Key,
	description: string
): Map<Key, Value> {
	const result = new Map<Key, Value>();
	for (const value of values) {
		const identity = key(value);
		if (result.has(identity)) throw new Error(`${description} identities are not unique.`);
		result.set(identity, value);
	}
	return result;
}

function addGrouped<Key, Value>(map: Map<Key, Value[]>, key: Key, value: Value): void {
	const values = map.get(key);
	if (values === undefined) map.set(key, [value]);
	else values.push(value);
}

interface SelectedSemanticModel {
	readonly declarationById: ReadonlyMap<string, SemanticDeclarationRecord>;
	readonly nodesBySpan: ReadonlyMap<string, SemanticAstNodeRecord[]>;
	readonly referenceByNode: ReadonlyMap<string, SemanticReferenceRecord[]>;
	readonly symbolById: ReadonlyMap<string, SemanticSymbolRecord>;
}

function selectedSymbolIds(
	declarations: readonly SemanticDeclarationRecord[],
	references: readonly SemanticReferenceRecord[]
): Set<string> {
	const symbolIds = new Set<string>();
	for (const declaration of declarations)
		if (declaration.symbolId !== null) symbolIds.add(declaration.symbolId);
	for (const reference of references)
		if (reference.resolvedSymbolId !== null) symbolIds.add(reference.resolvedSymbolId);
	return symbolIds;
}

function selectedNodesBySpan(
	nodes: readonly SemanticAstNodeRecord[],
	nodeById: ReadonlyMap<string, SemanticAstNodeRecord>
): Map<string, SemanticAstNodeRecord[]> {
	const nodesBySpan = new Map<string, SemanticAstNodeRecord[]>();
	for (const node of nodes) {
		if (node.parentId !== null && !nodeById.has(node.parentId))
			throw new Error(`Selected semantic node ${node.id} has no selected parent.`);
		addGrouped(nodesBySpan, `${node.kind}\0${node.start}\0${node.end}`, node);
	}
	return nodesBySpan;
}

function selectedReferencesByNode(
	references: readonly SemanticReferenceRecord[],
	nodeById: ReadonlyMap<string, SemanticAstNodeRecord>,
	symbolById: ReadonlyMap<string, SemanticSymbolRecord>
): Map<string, SemanticReferenceRecord[]> {
	const referenceByNode = new Map<string, SemanticReferenceRecord[]>();
	for (const reference of references) {
		if (!nodeById.has(reference.nodeId))
			throw new Error(`Selected semantic reference ${reference.id} has no selected node.`);
		if (reference.resolvedSymbolId !== null && !symbolById.has(reference.resolvedSymbolId))
			throw new Error(`Selected semantic reference ${reference.id} has no selected symbol.`);
		addGrouped(referenceByNode, reference.nodeId, reference);
	}
	return referenceByNode;
}

function selectedSemanticModel(
	snapshot: StaticSemanticSnapshot,
	source: SemanticSourceRecord
): SelectedSemanticModel {
	const nodes = snapshot.astNodes.filter((node) => node.sourceId === source.id);
	const nodeById = uniqueMap(nodes, (node) => node.id, 'Selected semantic AST node');
	const declarations = snapshot.declarations.filter(
		(declaration) => declaration.sourceId === source.id
	);
	const declarationById = uniqueMap(
		declarations,
		(declaration) => declaration.id,
		'Selected semantic declaration'
	);
	const references = snapshot.references.filter((reference) => reference.sourceId === source.id);
	const symbolIds = selectedSymbolIds(declarations, references);
	const symbols = snapshot.symbols.filter((symbol) => symbolIds.has(symbol.id));
	const symbolById = uniqueMap(symbols, (symbol) => symbol.id, 'Selected semantic symbol');
	const nodesBySpan = selectedNodesBySpan(nodes, nodeById);
	const referenceByNode = selectedReferencesByNode(references, nodeById, symbolById);
	for (const declaration of declarations)
		if (declaration.nodeId !== null && !nodeById.has(declaration.nodeId))
			throw new Error(`Selected semantic declaration ${declaration.id} has no selected node.`);
	return { declarationById, nodesBySpan, referenceByNode, symbolById };
}

function parseTypescript(text: string, path: string): ts.SourceFile {
	const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const diagnostics = (
		source as ts.SourceFile & {
			readonly parseDiagnostics?: readonly ts.Diagnostic[];
		}
	).parseDiagnostics;
	if (diagnostics !== undefined && diagnostics.length > 0)
		throw new Error(`${path} has TypeScript parse diagnostics.`);
	return source;
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
	let current = expression;
	while (
		ts.isAsExpression(current) ||
		ts.isSatisfiesExpression(current) ||
		ts.isTypeAssertionExpression(current) ||
		ts.isParenthesizedExpression(current) ||
		ts.isNonNullExpression(current)
	)
		current = current.expression;
	return current;
}

function staticPropertyName(name: ts.PropertyName): string | null {
	if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name))
		return name.text;
	return null;
}

function propertyMap(
	object: ts.ObjectLiteralExpression,
	description: string
): ReadonlyMap<string, ts.PropertyAssignment> {
	const result = new Map<string, ts.PropertyAssignment>();
	for (const member of object.properties) {
		if (!ts.isPropertyAssignment(member))
			throw new Error(`${description} contains an unsupported member form.`);
		const name = staticPropertyName(member.name);
		if (name === null || name.trim().length === 0)
			throw new Error(`${description} contains a computed or blank member name.`);
		if (result.has(name)) throw new Error(`${description} contains duplicate member ${name}.`);
		result.set(name, member);
	}
	return result;
}

function stringLiteral(expression: ts.Expression, description: string): ts.StringLiteralLike {
	const value = unwrapExpression(expression);
	if (!ts.isStringLiteral(value) && !ts.isNoSubstitutionTemplateLiteral(value))
		throw new Error(`${description} must be one exact static string literal.`);
	if (value.text.trim().length === 0) throw new Error(`${description} may not be blank.`);
	return value;
}

function semanticNode(
	node: ts.Node,
	sourceFile: ts.SourceFile,
	model: SelectedSemanticModel,
	description: string
): SemanticAstNodeRecord {
	const key = `${node.kind}\0${node.getStart(sourceFile, false)}\0${node.getEnd()}`;
	return exactOne(model.nodesBySpan.get(key) ?? [], `${description} semantic node`);
}

function frozenArtifact(
	subject: FrozenSubject,
	path: string
): { readonly artifact: CapturedArtifactRecord; readonly bytes: Uint8Array } {
	const artifact = exactOne(
		subject.artifacts.filter((candidate) => candidate.path === path),
		`Frozen ${path} artifact`
	);
	const bytes = readFrozenSubjectArtifact(subject, path);
	// S6582 REFUSED: the explicit `=== undefined` limb is what keeps `sha256` from being reached with a
	// missing buffer. Under `bytes?.byteLength`, an artifact whose `bytes` is undefined AT RUNTIME makes
	// `undefined !== undefined` false, the `||` evaluates its right operand, and `update(undefined)`
	// throws a raw TypeError instead of this closed refusal. `artifact.bytes` is declared `number`, so
	// optional-chain narrowing hides the hole from the type-checker. Kept identical to the sibling
	// `validate-command-event-contract-overlay.ts`, which states the same guard the same way.
	if (
		bytes === undefined ||
		bytes.byteLength !== artifact.bytes ||
		sha256(bytes) !== artifact.sha256
	)
		throw new Error(`Frozen ${path} bytes do not reproduce their exact artifact identity.`);
	return { artifact, bytes };
}

function selectedRegistrySource(inputs: CommandEventContractOverlayBuildInputs): {
	readonly bytes: Uint8Array;
	readonly source: SemanticSourceRecord;
} {
	const { semanticSnapshot: snapshot, subject } = inputs;
	const project = exactOne(
		snapshot.projects.filter(
			(candidate) => candidate.configPath === COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH
		),
		'Generated-registry semantic project'
	);
	const program = exactOne(
		snapshot.programs.filter((candidate) => candidate.id === project.programId),
		'Generated-registry semantic Program'
	);
	if (program.projectId !== project.id)
		throw new Error('Generated-registry semantic project/program ownership is inconsistent.');
	const source = exactOne(
		snapshot.sources.filter(
			(candidate) =>
				candidate.logicalPath === COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH &&
				candidate.projectId === project.id &&
				candidate.programId === program.id &&
				candidate.analysisDisposition === 'DEEP_INDEXED'
		),
		'Generated-registry deep semantic source'
	);
	const { artifact, bytes } = frozenArtifact(subject, COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH);
	if (
		source.id !== inputs.request.commandRegistry.sourceId ||
		source.id !== inputs.request.eventRegistry.sourceId ||
		source.projectId !== inputs.request.commandRegistry.projectId ||
		source.projectId !== inputs.request.eventRegistry.projectId ||
		source.programId !== inputs.request.commandRegistry.programId ||
		source.programId !== inputs.request.eventRegistry.programId ||
		source.contentSha256 !== inputs.request.commandRegistry.contentSha256 ||
		source.contentSha256 !== inputs.request.eventRegistry.contentSha256 ||
		source.contentSha256 !== artifact.sha256 ||
		source.bytes !== bytes.byteLength ||
		artifact.bytes !== bytes.byteLength
	)
		throw new Error('Generated-registry selector, semantic source, and frozen bytes differ.');
	return { bytes, source };
}

/** Selects the exact JPWB generated registry and retained artifact identities for this overlay. */
export function selectJpwbCommandEventContractOverlayInputs(
	snapshot: StaticSemanticSnapshot,
	subject: FrozenSubject
): {
	readonly commandRegistry: CommandEventContractRegistrySelector;
	readonly eventRegistry: CommandEventContractRegistrySelector;
	readonly retainedCensusArtifact: BuildCommandEventContractOverlayRequest['retainedCensusArtifact'];
	readonly vocabArtifact: BuildCommandEventContractOverlayRequest['vocabArtifact'];
} {
	const project = exactOne(
		snapshot.projects.filter(
			(candidate) => candidate.configPath === COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH
		),
		'Generated-registry semantic project'
	);
	const program = exactOne(
		snapshot.programs.filter((candidate) => candidate.id === project.programId),
		'Generated-registry semantic Program'
	);
	if (program.projectId !== project.id)
		throw new Error('Generated-registry semantic project/program ownership is inconsistent.');
	const source = exactOne(
		snapshot.sources.filter(
			(candidate) =>
				candidate.logicalPath === COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH &&
				candidate.projectId === project.id &&
				candidate.programId === program.id &&
				candidate.analysisDisposition === 'DEEP_INDEXED'
		),
		'Generated-registry deep semantic source'
	);
	const select = (exportName: 'COMMANDS' | 'EVENTS'): CommandEventContractRegistrySelector => {
		const declaration = exactOne(
			snapshot.declarations.filter(
				(candidate) =>
					candidate.sourceId === source.id &&
					candidate.name === exportName &&
					candidate.kind === ts.SyntaxKind.VariableDeclaration &&
					candidate.nodeId !== null
			),
			`${exportName} semantic declaration`
		);
		return {
			contentSha256: source.contentSha256,
			declarationId: declaration.id,
			exportName,
			logicalPath: COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH,
			programId: source.programId,
			projectConfigPath: COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH,
			projectId: source.projectId,
			sourceId: source.id
		};
	};
	return {
		commandRegistry: select('COMMANDS'),
		eventRegistry: select('EVENTS'),
		retainedCensusArtifact: commandEventContractRetainedCensusArtifactSelector(subject),
		vocabArtifact: commandEventContractVocabArtifactSelector(subject)
	};
}

interface RegistryParse {
	readonly commandProperties: readonly ts.PropertyAssignment[];
	readonly eventProperties: readonly ts.PropertyAssignment[];
	readonly sourceFile: ts.SourceFile;
}

function registryDeclaration(
	sourceFile: ts.SourceFile,
	exportName: 'COMMANDS' | 'EVENTS',
	selector: CommandEventContractRegistrySelector,
	inputs: CommandEventContractOverlayBuildInputs,
	model: SelectedSemanticModel
): ts.VariableDeclaration {
	const declarations: {
		readonly declaration: ts.VariableDeclaration;
		readonly flags: ts.NodeFlags;
	}[] = [];
	for (const statement of sourceFile.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		for (const declaration of statement.declarationList.declarations)
			if (ts.isIdentifier(declaration.name) && declaration.name.text === exportName)
				declarations.push({ declaration, flags: statement.declarationList.flags });
	}
	const selected = exactOne(declarations, `${exportName} top-level declaration`);
	if ((selected.flags & ts.NodeFlags.Const) === 0)
		throw new Error(`${exportName} must be a top-level const declaration.`);
	const semanticDeclaration = exactOne(
		inputs.semanticSnapshot.declarations.filter(
			(declaration) =>
				declaration.sourceId === selector.sourceId &&
				declaration.name === exportName &&
				declaration.kind === ts.SyntaxKind.VariableDeclaration &&
				declaration.nodeId !== null
		),
		`${exportName} semantic declaration`
	);
	const declarationNode = semanticNode(
		selected.declaration,
		sourceFile,
		model,
		`${exportName} declaration`
	);
	if (
		selector.declarationId !== semanticDeclaration.id ||
		semanticDeclaration.nodeId !== declarationNode.id
	)
		throw new Error(`${exportName} request selector does not bind its exact declaration.`);
	return selected.declaration;
}

function parseRegistries(
	inputs: CommandEventContractOverlayBuildInputs,
	model: SelectedSemanticModel,
	selected: ReturnType<typeof selectedRegistrySource>
): RegistryParse {
	const text = decodeUtf8(selected.bytes, COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH);
	if (text.length !== selected.source.textLength)
		throw new Error('Generated-registry frozen text length differs from semantic identity.');
	const sourceFile = parseTypescript(text, COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH);
	const commands = registryDeclaration(
		sourceFile,
		'COMMANDS',
		inputs.request.commandRegistry,
		inputs,
		model
	);
	const events = registryDeclaration(
		sourceFile,
		'EVENTS',
		inputs.request.eventRegistry,
		inputs,
		model
	);
	if (commands.initializer === undefined || events.initializer === undefined)
		throw new Error('Generated registries must have exact initializers.');
	const commandObject = unwrapExpression(commands.initializer);
	const eventObject = unwrapExpression(events.initializer);
	if (!ts.isObjectLiteralExpression(commandObject) || !ts.isObjectLiteralExpression(eventObject))
		throw new Error('Generated registry initializers must be object literals.');
	return {
		commandProperties: [...propertyMap(commandObject, 'COMMANDS registry').values()],
		eventProperties: [...propertyMap(eventObject, 'EVENTS registry').values()],
		sourceFile
	};
}

interface ParsedEventContract {
	readonly aggregateType: string;
	readonly aggregateTypeNode: SemanticAstNodeRecord;
	readonly eventName: string;
	readonly nameNode: SemanticAstNodeRecord;
	readonly payloadDeclaration: SemanticDeclarationRecord;
	readonly payloadNode: SemanticAstNodeRecord;
	readonly payloadReference: SemanticReferenceRecord;
	readonly payloadSymbol: SemanticSymbolRecord;
	readonly propertyNode: SemanticAstNodeRecord;
}

interface ParsedDeclaredEvent {
	readonly eventName: string;
	readonly eventNameNode: SemanticAstNodeRecord;
	readonly propertyNode: SemanticAstNodeRecord;
}

interface ParsedCommandDeclaration {
	readonly additional: readonly ParsedDeclaredEvent[];
	readonly commandName: string;
	readonly nameNode: SemanticAstNodeRecord;
	readonly primary: ParsedDeclaredEvent;
	readonly propertyNode: SemanticAstNodeRecord;
}

function parseEventContracts(
	properties: readonly ts.PropertyAssignment[],
	sourceFile: ts.SourceFile,
	source: SemanticSourceRecord,
	model: SelectedSemanticModel
): ParsedEventContract[] {
	const parsed = properties.map((property): ParsedEventContract => {
		const eventName = staticPropertyName(property.name);
		if (eventName === null || eventName.trim().length === 0)
			throw new Error('EVENTS contains a computed or blank event name.');
		const value = unwrapExpression(property.initializer);
		if (!ts.isObjectLiteralExpression(value))
			throw new Error(`EVENTS.${eventName} is not an exact object literal.`);
		const fields = propertyMap(value, `EVENTS.${eventName}`);
		const payload = fields.get('payload');
		const aggregate = fields.get('aggregateType');
		if (payload === undefined || aggregate === undefined)
			throw new Error(`EVENTS.${eventName} lacks payload or aggregateType.`);
		const aggregateLiteral = stringLiteral(
			aggregate.initializer,
			`EVENTS.${eventName}.aggregateType`
		);
		const payloadExpression = unwrapExpression(payload.initializer);
		if (!ts.isIdentifier(payloadExpression))
			throw new Error(`EVENTS.${eventName}.payload is not one exact schema reference.`);
		const payloadNode = semanticNode(
			payloadExpression,
			sourceFile,
			model,
			`EVENTS.${eventName}.payload`
		);
		const payloadReference = exactOne(
			(model.referenceByNode.get(payloadNode.id) ?? []).filter(
				(reference) =>
					(reference.role === 'SYMBOL_USE' || reference.role === 'IMPORT_EXPORT_BINDING') &&
					reference.resolvedSymbolId !== null &&
					(reference.resolutionState === 'RESOLVED_DIRECT' ||
						reference.resolutionState === 'RESOLVED_ALIAS')
			),
			`EVENTS.${eventName}.payload resolved reference`
		);
		const payloadSymbol = model.symbolById.get(payloadReference.resolvedSymbolId!);
		if (payloadSymbol === undefined)
			throw new Error(`EVENTS.${eventName}.payload terminal symbol is absent.`);
		const payloadDeclaration = exactOne(
			payloadSymbol.declarationIds
				.map((id) => model.declarationById.get(id))
				.filter(
					(declaration): declaration is SemanticDeclarationRecord =>
						declaration?.sourceId === source.id && declaration.name === `${eventName}PayloadSchema`
				),
			`EVENTS.${eventName} terminal payload declaration`
		);
		return {
			aggregateType: aggregateLiteral.text,
			aggregateTypeNode: semanticNode(
				aggregateLiteral,
				sourceFile,
				model,
				`EVENTS.${eventName}.aggregateType`
			),
			eventName,
			nameNode: semanticNode(property.name, sourceFile, model, `EVENTS.${eventName} name`),
			payloadDeclaration,
			payloadNode,
			payloadReference,
			payloadSymbol,
			propertyNode: semanticNode(property, sourceFile, model, `EVENTS.${eventName}`)
		};
	});
	if (new Set(parsed.map((item) => item.eventName)).size !== parsed.length)
		throw new Error('EVENTS contains duplicate event names.');
	return parsed.sort((left, right) => compareText(left.eventName, right.eventName));
}

function parseCommandDeclarations(
	properties: readonly ts.PropertyAssignment[],
	sourceFile: ts.SourceFile,
	model: SelectedSemanticModel
): ParsedCommandDeclaration[] {
	const parsed = properties.map((property): ParsedCommandDeclaration => {
		const commandName = staticPropertyName(property.name);
		if (commandName === null || commandName.trim().length === 0)
			throw new Error('COMMANDS contains a computed or blank command name.');
		const value = unwrapExpression(property.initializer);
		if (!ts.isObjectLiteralExpression(value))
			throw new Error(`COMMANDS.${commandName} is not an exact object literal.`);
		const fields = propertyMap(value, `COMMANDS.${commandName}`);
		const primaryProperty = fields.get('emitsEvent');
		if (primaryProperty === undefined)
			throw new Error(`COMMANDS.${commandName}.emitsEvent is absent.`);
		const primaryLiteral = stringLiteral(
			primaryProperty.initializer,
			`COMMANDS.${commandName}.emitsEvent`
		);
		const primary: ParsedDeclaredEvent = {
			eventName: primaryLiteral.text,
			eventNameNode: semanticNode(
				primaryLiteral,
				sourceFile,
				model,
				`COMMANDS.${commandName}.emitsEvent literal`
			),
			propertyNode: semanticNode(
				primaryProperty,
				sourceFile,
				model,
				`COMMANDS.${commandName}.emitsEvent property`
			)
		};
		const additionalProperty = fields.get('alsoEmitsEvents');
		const additional: ParsedDeclaredEvent[] = [];
		if (additionalProperty !== undefined) {
			const expression = unwrapExpression(additionalProperty.initializer);
			if (!ts.isArrayLiteralExpression(expression))
				throw new Error(`COMMANDS.${commandName}.alsoEmitsEvents is not an exact array literal.`);
			const propertyNode = semanticNode(
				additionalProperty,
				sourceFile,
				model,
				`COMMANDS.${commandName}.alsoEmitsEvents property`
			);
			for (const element of expression.elements) {
				if (ts.isSpreadElement(element) || ts.isOmittedExpression(element))
					throw new Error(`COMMANDS.${commandName}.alsoEmitsEvents is open or sparse.`);
				const literal = stringLiteral(element, `COMMANDS.${commandName}.alsoEmitsEvents member`);
				additional.push({
					eventName: literal.text,
					eventNameNode: semanticNode(
						literal,
						sourceFile,
						model,
						`COMMANDS.${commandName}.alsoEmitsEvents member`
					),
					propertyNode
				});
			}
			if (new Set(additional.map((item) => item.eventName)).size !== additional.length)
				throw new Error(`COMMANDS.${commandName}.alsoEmitsEvents contains duplicates.`);
		}
		if (additional.some((item) => item.eventName === primary.eventName))
			throw new Error(`COMMANDS.${commandName} repeats its primary event as an additional event.`);
		return {
			additional,
			commandName,
			nameNode: semanticNode(property.name, sourceFile, model, `COMMANDS.${commandName} name`),
			primary,
			propertyNode: semanticNode(property, sourceFile, model, `COMMANDS.${commandName}`)
		};
	});
	if (new Set(parsed.map((item) => item.commandName)).size !== parsed.length)
		throw new Error('COMMANDS contains duplicate command names.');
	return parsed.sort((left, right) => compareText(left.commandName, right.commandName));
}

function graphNodeMaps(graph: CommandEventContractOverlayBuildInputs['commandHandlerGraph']): {
	readonly commandByName: ReadonlyMap<string, CommandRegistryEntryNode>;
	readonly nodeById: ReadonlyMap<string, CommandHandlerGraphNode>;
} {
	const nodeById = uniqueMap(graph.nodes, (node) => node.id, 'Command-handler graph node');
	const commands = graph.nodes.filter(
		(node): node is CommandRegistryEntryNode => node.kind === 'COMMAND_REGISTRY_ENTRY'
	);
	return {
		commandByName: uniqueMap(commands, (node) => node.commandName, 'Command registry name'),
		nodeById
	};
}

function handlerReferences(
	command: CommandRegistryEntryNode,
	graph: CommandEventContractOverlayBuildInputs['commandHandlerGraph'],
	nodeById: ReadonlyMap<string, CommandHandlerGraphNode>
): CommandEventContractHandlerReference[] {
	const registrationEdges = graph.edges.filter(
		(edge) =>
			edge.relationKind === 'COMMAND_REGISTRY_ENTRY_TO_HANDLER_REGISTRATION' &&
			edge.source.nodeId === command.id
	);
	if (registrationEdges.length === 0) return [];
	const registrationEdge = exactOne(
		registrationEdges,
		`Command ${command.commandName} registration edge`
	);
	const registration = nodeById.get(registrationEdge.target.nodeId);
	if (registration?.kind !== 'HANDLER_REGISTRATION')
		throw new Error(`Command ${command.commandName} registration endpoint is invalid.`);
	const targetEdges = graph.edges.filter(
		(edge) =>
			edge.relationKind === 'HANDLER_REGISTRATION_TO_TARGET' &&
			edge.source.nodeId === registration.id
	);
	if (targetEdges.length === 0)
		return [
			{
				registrationNodeId: registration.id,
				supportingEdgeIds: [registrationEdge.id],
				targetNodeId: null,
				upstreamAttribution: 'UNRESOLVED'
			}
		];
	const targetEdge = exactOne(targetEdges, `Command ${command.commandName} handler-target edge`);
	const target = nodeById.get(targetEdge.target.nodeId);
	if (target?.kind !== 'HANDLER_TARGET')
		throw new Error(`Command ${command.commandName} handler-target endpoint is invalid.`);
	return [
		{
			registrationNodeId: registration.id,
			supportingEdgeIds: sortedUnique([registrationEdge.id, targetEdge.id]),
			targetNodeId: target.id,
			upstreamAttribution: targetEdge.attribution
		}
	];
}

interface GeneratedPopulation {
	readonly commands: readonly CommandEventContractCommandRecord[];
	readonly declaredLinks: readonly CommandEventContractDeclaredLink[];
	readonly eventContracts: readonly CommandEventContractEventRecord[];
	readonly missing: readonly {
		readonly commandId: CommandEventContractCommandRecord['id'];
		readonly eventName: string;
	}[];
}

function generatedPopulation(
	overlayId: CommandEventContractOverlayId,
	commands: readonly ParsedCommandDeclaration[],
	events: readonly ParsedEventContract[],
	inputs: CommandEventContractOverlayBuildInputs
): GeneratedPopulation {
	const graph = graphNodeMaps(inputs.commandHandlerGraph);
	const eventContracts = events.map((event): CommandEventContractEventRecord => ({
		aggregateType: event.aggregateType,
		aggregateTypeNodeId: event.aggregateTypeNode.id,
		eventName: event.eventName,
		id: commandEventContractEventId(overlayId, event.eventName),
		nameNodeId: event.nameNode.id,
		payloadDeclarationId: event.payloadDeclaration.id,
		payloadNodeId: event.payloadNode.id,
		payloadReferenceId: event.payloadReference.id,
		payloadSymbolId: event.payloadSymbol.id,
		propertyNodeId: event.propertyNode.id,
		sourceId: event.propertyNode.sourceId
	}));
	const eventByName = new Map(eventContracts.map((event) => [event.eventName, event]));
	const mutableCommands: {
		readonly linkIds: CommandEventContractDeclaredLink['id'][];
		readonly record: Omit<CommandEventContractCommandRecord, 'declaredLinkIds'>;
	}[] = [];
	const declaredLinks: CommandEventContractDeclaredLink[] = [];
	const missing: GeneratedPopulation['missing'][number][] = [];
	for (const parsed of commands) {
		const graphCommand = graph.commandByName.get(parsed.commandName);
		if (graphCommand === undefined)
			throw new Error(
				`Generated command ${parsed.commandName} is absent from the predecessor graph.`
			);
		if (
			graphCommand.nameNodeId !== parsed.nameNode.id ||
			graphCommand.propertyNodeId !== parsed.propertyNode.id ||
			graphCommand.sourceId !== inputs.request.commandRegistry.sourceId
		)
			throw new Error(
				`Generated command ${parsed.commandName} differs from predecessor graph identity.`
			);
		const commandId = commandEventContractCommandId(overlayId, parsed.commandName);
		const linkIds: CommandEventContractDeclaredLink['id'][] = [];
		const declarations: readonly (ParsedDeclaredEvent & {
			readonly ordinal: number;
			readonly role: 'PRIMARY' | 'ADDITIONAL';
		})[] = [
			{ ...parsed.primary, ordinal: 0, role: 'PRIMARY' },
			...parsed.additional.map((item, index) => ({
				...item,
				ordinal: index + 1,
				role: 'ADDITIONAL' as const
			}))
		];
		for (const declaration of declarations) {
			const event = eventByName.get(declaration.eventName);
			if (event === undefined) {
				missing.push({ commandId, eventName: declaration.eventName });
				continue;
			}
			const id = commandEventContractDeclaredLinkId({
				commandName: parsed.commandName,
				eventName: declaration.eventName,
				ordinal: declaration.ordinal,
				overlayId,
				role: declaration.role
			});
			linkIds.push(id);
			declaredLinks.push({
				attribution: 'EXACT',
				commandId,
				commandName: parsed.commandName,
				eventId: event.id,
				eventName: declaration.eventName,
				eventNameNodeId: declaration.eventNameNode.id,
				id,
				ordinal: declaration.ordinal,
				role: declaration.role,
				supportingNodeIds: sortedUnique([
					parsed.propertyNode.id,
					declaration.propertyNode.id,
					declaration.eventNameNode.id
				])
			});
		}
		mutableCommands.push({
			linkIds,
			record: {
				commandHandlerGraphId: inputs.commandHandlerGraph.id,
				commandName: parsed.commandName,
				commandNodeId: graphCommand.id,
				handlerReferences: handlerReferences(
					graphCommand,
					inputs.commandHandlerGraph,
					graph.nodeById
				),
				id: commandId,
				nameNodeId: parsed.nameNode.id,
				propertyNodeId: parsed.propertyNode.id
			}
		});
	}
	if (graph.commandByName.size !== commands.length)
		throw new Error('Generated COMMANDS and predecessor command population sizes differ.');
	declaredLinks.sort(
		(left, right) =>
			compareText(left.commandName, right.commandName) ||
			left.ordinal - right.ordinal ||
			compareText(left.id, right.id)
	);
	return {
		commands: mutableCommands
			.map((item): CommandEventContractCommandRecord => ({
				...item.record,
				declaredLinkIds: [...item.linkIds].sort(compareText)
			}))
			.sort((left, right) => compareText(left.commandName, right.commandName)),
		declaredLinks,
		eventContracts,
		missing
	};
}

function plainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		return false;
	const prototype = Reflect.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

interface VocabCommand {
	readonly additionalEvents: readonly string[];
	readonly commandName: string;
	readonly from: string | null;
	readonly machine: string | null;
	readonly ordinal: number;
	readonly primaryEvent: string;
	readonly to: string | null;
}

interface VocabBinding {
	readonly commandName: string;
	readonly eventName: string;
	readonly from: string | null;
	readonly machine: string | null;
	readonly ordinal: number;
	readonly to: string | null;
}

interface VocabPopulation {
	readonly bindings: readonly VocabBinding[];
	readonly commands: readonly VocabCommand[];
	readonly eventNames: ReadonlySet<string>;
}

function optionalString(
	record: Record<string, unknown>,
	key: string,
	description: string
): string | null {
	const value = record[key];
	if (value === undefined || value === null) return null;
	if (typeof value !== 'string')
		throw new Error(`${description}.${key} must be text when present.`);
	return value;
}

function requiredName(record: Record<string, unknown>, key: string, description: string): string {
	const value = record[key];
	if (typeof value !== 'string' || value.trim().length === 0)
		throw new Error(`${description}.${key} must be nonblank text.`);
	return value;
}

function assertJsonNoDuplicateKeys(text: string): void {
	const source = ts.parseJsonText(COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH, text);
	const diagnostics = (
		source as ts.JsonSourceFile & {
			readonly parseDiagnostics?: readonly ts.Diagnostic[];
		}
	).parseDiagnostics;
	if (diagnostics !== undefined && diagnostics.length > 0)
		throw new Error('Vocab artifact has JSON parse diagnostics.');
	const visit = (node: ts.Node): void => {
		if (ts.isObjectLiteralExpression(node)) {
			const names = new Set<string>();
			for (const property of node.properties) {
				if (!ts.isPropertyAssignment(property))
					throw new Error('Vocab JSON contains an unsupported object member.');
				const name = staticPropertyName(property.name);
				if (name === null || names.has(name))
					throw new Error('Vocab JSON contains a duplicate or computed object key.');
				names.add(name);
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
}

function parseVocab(text: string): VocabPopulation {
	assertJsonNoDuplicateKeys(text);
	const value: unknown = JSON.parse(text);
	if (!plainObject(value)) throw new Error('Vocab root must be an object.');
	if (
		!Array.isArray(value.commands) ||
		!Array.isArray(value.events) ||
		!Array.isArray(value.bindings)
	)
		throw new Error('Vocab commands, events, and bindings must be arrays.');
	const commands = value.commands.map((entry, ordinal): VocabCommand => {
		if (!plainObject(entry)) throw new Error(`Vocab command ${ordinal} must be an object.`);
		const additional = entry.alsoEmitsEvents;
		if (additional !== undefined && !Array.isArray(additional))
			throw new Error(`Vocab command ${ordinal}.alsoEmitsEvents must be an array.`);
		const additionalEvents = (additional ?? []).map((item, index) => {
			if (typeof item !== 'string' || item.trim().length === 0)
				throw new Error(`Vocab command ${ordinal}.alsoEmitsEvents[${index}] is invalid.`);
			return item;
		});
		if (new Set(additionalEvents).size !== additionalEvents.length)
			throw new Error(`Vocab command ${ordinal} repeats an additional event.`);
		const commandName = requiredName(entry, 'commandType', `Vocab command ${ordinal}`);
		const primaryEvent = requiredName(entry, 'emitsEvent', `Vocab command ${ordinal}`);
		if (additionalEvents.includes(primaryEvent))
			throw new Error(`Vocab command ${ordinal} repeats its primary event.`);
		return {
			additionalEvents,
			commandName,
			from: optionalString(entry, 'drivesFrom', `Vocab command ${ordinal}`),
			machine: optionalString(entry, 'drivesMachine', `Vocab command ${ordinal}`),
			ordinal,
			primaryEvent,
			to: optionalString(entry, 'drivesTo', `Vocab command ${ordinal}`)
		};
	});
	if (new Set(commands.map((command) => command.commandName)).size !== commands.length)
		throw new Error('Vocab contains duplicate command names.');
	const eventNames = value.events.map((entry, ordinal) => {
		if (!plainObject(entry)) throw new Error(`Vocab event ${ordinal} must be an object.`);
		return requiredName(entry, 'eventType', `Vocab event ${ordinal}`);
	});
	if (new Set(eventNames).size !== eventNames.length)
		throw new Error('Vocab contains duplicate event names.');
	const eventSet = new Set(eventNames);
	const commandByName = new Map(commands.map((command) => [command.commandName, command]));
	for (const command of commands)
		for (const eventName of [command.primaryEvent, ...command.additionalEvents])
			if (!eventSet.has(eventName))
				throw new Error(`Vocab command ${command.commandName} names unknown event ${eventName}.`);
	const bindings = value.bindings.map((entry, ordinal): VocabBinding => {
		if (!plainObject(entry)) throw new Error(`Vocab binding ${ordinal} must be an object.`);
		const commandName = requiredName(entry, 'commandType', `Vocab binding ${ordinal}`);
		const eventName = requiredName(entry, 'eventType', `Vocab binding ${ordinal}`);
		const command = commandByName.get(commandName);
		if (command === undefined) throw new Error(`Vocab binding ${ordinal} names unknown command.`);
		if (!eventSet.has(eventName)) throw new Error(`Vocab binding ${ordinal} names unknown event.`);
		if (![command.primaryEvent, ...command.additionalEvents].includes(eventName))
			throw new Error(`Vocab binding ${ordinal} conflicts with command ${commandName}.`);
		return {
			commandName,
			eventName,
			from: optionalString(entry, 'from', `Vocab binding ${ordinal}`),
			machine: optionalString(entry, 'machine', `Vocab binding ${ordinal}`),
			ordinal,
			to: optionalString(entry, 'to', `Vocab binding ${ordinal}`)
		};
	});
	const bindingIdentities = bindings.map((binding) =>
		JSON.stringify([
			binding.commandName,
			binding.eventName,
			binding.machine,
			binding.from,
			binding.to
		])
	);
	if (new Set(bindingIdentities).size !== bindingIdentities.length)
		throw new Error('Vocab contains duplicate exact transition-binding rows.');
	return { bindings, commands, eventNames: eventSet };
}

function boundContributions(
	overlayId: CommandEventContractOverlayId,
	vocab: VocabPopulation
): CommandEventContractBoundContribution[] {
	return [
		...vocab.commands.map((command): CommandEventContractBoundContribution => ({
			commandName: command.commandName,
			eventName: command.primaryEvent,
			from: command.from,
			id: commandEventContractBoundContributionId({
				commandName: command.commandName,
				eventName: command.primaryEvent,
				ordinal: command.ordinal,
				overlayId,
				sourceKind: 'COMMAND_PRIMARY'
			}),
			machine: command.machine,
			ordinal: command.ordinal,
			sourceKind: 'COMMAND_PRIMARY',
			to: command.to
		})),
		...vocab.bindings.map((binding): CommandEventContractBoundContribution => ({
			commandName: binding.commandName,
			eventName: binding.eventName,
			from: binding.from,
			id: commandEventContractBoundContributionId({
				commandName: binding.commandName,
				eventName: binding.eventName,
				ordinal: binding.ordinal,
				overlayId,
				sourceKind: 'TRANSITION_BINDING'
			}),
			machine: binding.machine,
			ordinal: binding.ordinal,
			sourceKind: 'TRANSITION_BINDING',
			to: binding.to
		}))
	].sort(
		(left, right) =>
			compareText(left.sourceKind, right.sourceKind) ||
			left.ordinal - right.ordinal ||
			compareText(left.commandName, right.commandName) ||
			compareText(left.eventName, right.eventName)
	);
}

function propertyAccess(expression: ts.Expression, receiver: string, property: string): boolean {
	const unwrapped = unwrapExpression(expression);
	return (
		ts.isPropertyAccessExpression(unwrapped) &&
		ts.isIdentifier(unwrapped.expression) &&
		unwrapped.expression.text === receiver &&
		unwrapped.name.text === property
	);
}

function emptyArray(expression: ts.Expression): boolean {
	const unwrapped = unwrapExpression(expression);
	return ts.isArrayLiteralExpression(unwrapped) && unwrapped.elements.length === 0;
}

function retainedBoundSpread(
	expression: ts.Expression,
	populationName: 'bindings' | 'commands',
	valueName: 'emitsEvent' | 'eventType'
): boolean {
	const call = unwrapExpression(expression);
	if (
		!ts.isCallExpression(call) ||
		call.arguments.length !== 1 ||
		!ts.isPropertyAccessExpression(call.expression) ||
		call.expression.name.text !== 'flatMap'
	)
		return false;
	const population = unwrapExpression(call.expression.expression);
	if (
		!ts.isBinaryExpression(population) ||
		population.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken ||
		!propertyAccess(population.left, 'vocab', populationName) ||
		!emptyArray(population.right)
	)
		return false;
	const callback = unwrapExpression(call.arguments[0]!);
	if (
		!ts.isArrowFunction(callback) ||
		callback.parameters.length !== 1 ||
		!ts.isIdentifier(callback.parameters[0]!.name) ||
		ts.isBlock(callback.body)
	)
		return false;
	const parameter = callback.parameters[0]!.name.text;
	const conditional = unwrapExpression(callback.body);
	if (
		!ts.isConditionalExpression(conditional) ||
		!propertyAccess(conditional.condition, parameter, valueName) ||
		!emptyArray(conditional.whenFalse)
	)
		return false;
	const truthy = unwrapExpression(conditional.whenTrue);
	return (
		ts.isArrayLiteralExpression(truthy) &&
		truthy.elements.length === 1 &&
		!ts.isSpreadElement(truthy.elements[0]!) &&
		!ts.isOmittedExpression(truthy.elements[0]!) &&
		propertyAccess(truthy.elements[0]!, parameter, valueName)
	);
}

function assertRetainedBoundFormula(sourceFile: ts.SourceFile): void {
	const declarations: {
		readonly declaration: ts.VariableDeclaration;
		readonly flags: ts.NodeFlags;
	}[] = [];
	for (const statement of sourceFile.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		for (const declaration of statement.declarationList.declarations)
			if (ts.isIdentifier(declaration.name) && declaration.name.text === 'BOUND')
				declarations.push({ declaration, flags: statement.declarationList.flags });
	}
	const selected = exactOne(declarations, 'Retained BOUND declaration');
	const initializer = selected.declaration.initializer;
	if (
		(selected.flags & ts.NodeFlags.Const) === 0 ||
		initializer === undefined ||
		!ts.isNewExpression(unwrapExpression(initializer))
	)
		throw new Error('Retained BOUND must be one top-level const Set initializer.');
	const construction = unwrapExpression(initializer) as ts.NewExpression;
	if (
		!ts.isIdentifier(construction.expression) ||
		construction.expression.text !== 'Set' ||
		construction.typeArguments?.length !== 1 ||
		construction.typeArguments[0]!.kind !== ts.SyntaxKind.StringKeyword ||
		construction.arguments?.length !== 1
	)
		throw new Error('Retained BOUND must be one exact Set<string> construction.');
	const array = unwrapExpression(construction.arguments[0]!);
	if (
		!ts.isArrayLiteralExpression(array) ||
		array.elements.length !== 2 ||
		!ts.isSpreadElement(array.elements[0]!) ||
		!ts.isSpreadElement(array.elements[1]!) ||
		!retainedBoundSpread(array.elements[0]!.expression, 'commands', 'emitsEvent') ||
		!retainedBoundSpread(array.elements[1]!.expression, 'bindings', 'eventType')
	)
		throw new Error('Retained BOUND formula no longer has the supported exact set derivation.');
}

function parsePinnedEmissions(
	overlayId: CommandEventContractOverlayId,
	text: string
): CommandEventContractPinnedEmission[] {
	const sourceFile = parseTypescript(text, COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH);
	assertRetainedBoundFormula(sourceFile);
	const declarations: {
		readonly declaration: ts.VariableDeclaration;
		readonly flags: ts.NodeFlags;
	}[] = [];
	for (const statement of sourceFile.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		for (const declaration of statement.declarationList.declarations)
			if (ts.isIdentifier(declaration.name) && declaration.name.text === 'EMITTED_2026_08_04')
				declarations.push({ declaration, flags: statement.declarationList.flags });
	}
	const selected = exactOne(declarations, 'Retained EMITTED_2026_08_04 declaration');
	if ((selected.flags & ts.NodeFlags.Const) === 0 || selected.declaration.initializer === undefined)
		throw new Error('Retained EMITTED_2026_08_04 must be one top-level const initializer.');
	const initializer = unwrapExpression(selected.declaration.initializer);
	if (
		!ts.isNewExpression(initializer) ||
		!ts.isIdentifier(initializer.expression) ||
		initializer.expression.text !== 'Set' ||
		(initializer.typeArguments?.length ?? 0) > 0 ||
		initializer.arguments?.length !== 1
	)
		throw new Error('Retained EMITTED_2026_08_04 must be a direct untyped Set construction.');
	const array = unwrapExpression(initializer.arguments[0]!);
	if (!ts.isArrayLiteralExpression(array))
		throw new Error('Retained EMITTED_2026_08_04 Set input must be one array literal.');
	const names = array.elements.map((element, ordinal) => {
		if (ts.isSpreadElement(element) || ts.isOmittedExpression(element))
			throw new Error('Retained EMITTED_2026_08_04 array is open or sparse.');
		return { eventName: stringLiteral(element, `Pinned emission ${ordinal}`).text, ordinal };
	});
	if (new Set(names.map((item) => item.eventName)).size !== names.length)
		throw new Error('Retained EMITTED_2026_08_04 contains duplicate names.');
	return names.map((item): CommandEventContractPinnedEmission => ({
		eventName: item.eventName,
		id: commandEventContractPinnedEmissionId({ ...item, overlayId }),
		ordinal: item.ordinal,
		retainedMeasurement: 'EMITTED_2026_08_04'
	}));
}

function validatePredecessors(
	inputs: CommandEventContractOverlayBuildInputs,
	telemetry: TelemetryRecorder
): void {
	const { request, semanticSnapshot: snapshot } = inputs;
	if (!isFrozenSubjectCapability(inputs.subject))
		throw new Error(
			'SUBJECT_CAPABILITY_UNAVAILABLE\0One attached FrozenSubject capability is required.'
		);
	if (
		!Array.isArray(snapshot.capabilities) ||
		!Array.isArray(snapshot.projects) ||
		!Array.isArray(snapshot.programs) ||
		!Array.isArray(snapshot.sources) ||
		!Array.isArray(snapshot.astNodes) ||
		!Array.isArray(snapshot.declarations) ||
		!Array.isArray(snapshot.references) ||
		!Array.isArray(snapshot.symbols)
	)
		throw new Error('SEMANTIC_CAPABILITY_UNAVAILABLE\0The semantic snapshot shape is unavailable.');
	const subjectIds = [
		inputs.subject.descriptor.subjectId,
		snapshot.subjectId,
		inputs.arrowObservation.subjectId,
		inputs.commandHandlerGraph.subjectId
	];
	if (subjectIds.some((subjectId) => subjectId !== request.subjectId))
		throw new Error('INPUT_IDENTITY_MISMATCH\0Predecessor subject identities do not reconcile.');
	if (
		request.semanticSnapshotId !== snapshot.id ||
		request.arrowObservationId !== inputs.arrowObservation.id ||
		request.commandHandlerGraphId !== inputs.commandHandlerGraph.id ||
		inputs.commandHandlerGraph.semanticSnapshotId !== snapshot.id ||
		inputs.commandHandlerGraph.arrowObservationId !== inputs.arrowObservation.id
	)
		throw new Error('INPUT_IDENTITY_MISMATCH\0Predecessor product identities do not reconcile.');
	if (
		!(['TS_PROJECT', 'TS_SYNTAX', 'TS_SYMBOL'] as const).every((required) =>
			snapshot.capabilities.some(
				(capability) => capability.capability === required && capability.state !== 'UNSUPPORTED'
			)
		)
	)
		throw new Error(
			'SEMANTIC_CAPABILITY_UNAVAILABLE\0TS_PROJECT, TS_SYNTAX, and TS_SYMBOL evidence are required.'
		);

	telemetry.start('ARROW_VALIDATE');
	const arrowValidation = validateArrowCommandCensusObservation(
		inputs.arrowObservation,
		inputs.subject,
		{ maxIssues: request.budgets.maxDiagnostics }
	);
	if (arrowValidation.state !== 'VALID') {
		telemetry.fail({ diagnostics: arrowValidation.issues.length }, arrowValidation.state);
		throw new Error(`ARROW_OBSERVATION_INVALID\0${validationSummary(arrowValidation.issues)}`);
	}
	telemetry.complete({ diagnostics: 0 });

	telemetry.start('HANDLER_GRAPH_VALIDATE');
	const graphInputDigest = commandHandlerGraphInputDigest(
		inputs.commandHandlerRequest,
		snapshot,
		inputs.arrowObservation
	);
	if (inputs.commandHandlerGraph.graphInputDigest !== graphInputDigest)
		throw new Error(
			'COMMAND_HANDLER_GRAPH_INVALID\0The command-handler graph does not match its explicit predecessor request.'
		);
	const graphValidation = validateConstructedCommandHandlerGraph(
		inputs.commandHandlerGraph,
		snapshot,
		inputs.arrowObservation,
		inputs.subject,
		graphInputDigest,
		{
			maxIssues: request.budgets.maxDiagnostics,
			maxRecords: 10_000_000,
			maxStringCharacters: 1_000_000_000
		}
	);
	if (graphValidation.state !== 'VALID') {
		telemetry.fail({ diagnostics: graphValidation.issues.length }, graphValidation.state);
		throw new Error(`COMMAND_HANDLER_GRAPH_INVALID\0${validationSummary(graphValidation.issues)}`);
	}
	telemetry.complete({
		edges: inputs.commandHandlerGraph.edges.length,
		nodes: inputs.commandHandlerGraph.nodes.length
	});
}

function sameArtifactSelector(
	left: BuildCommandEventContractOverlayRequest['vocabArtifact'],
	right: BuildCommandEventContractOverlayRequest['vocabArtifact']
): boolean {
	return (
		left.artifactBytes === right.artifactBytes &&
		left.artifactContentSha256 === right.artifactContentSha256 &&
		left.artifactPath === right.artifactPath
	);
}

function assertGeneratedVocabParity(
	commands: readonly ParsedCommandDeclaration[],
	events: readonly ParsedEventContract[],
	vocab: VocabPopulation
): void {
	const generatedCommandByName = new Map(commands.map((command) => [command.commandName, command]));
	if (generatedCommandByName.size !== vocab.commands.length)
		throw new Error('Generated COMMANDS and vocab command populations differ.');
	for (const vocabCommand of vocab.commands) {
		const generated = generatedCommandByName.get(vocabCommand.commandName);
		if (
			generated?.primary.eventName !== vocabCommand.primaryEvent ||
			generated.additional.length !== vocabCommand.additionalEvents.length ||
			generated.additional.some(
				(item, index) => item.eventName !== vocabCommand.additionalEvents[index]
			)
		)
			throw new Error(
				`Generated COMMANDS.${vocabCommand.commandName} differs from its exact vocab declaration.`
			);
	}
	const generatedEvents = new Set(events.map((event) => event.eventName));
	if (
		generatedEvents.size !== vocab.eventNames.size ||
		[...generatedEvents].some((eventName) => !vocab.eventNames.has(eventName))
	)
		throw new Error('Generated EVENTS and vocab event populations differ.');
}

function frontierReason(kind: CommandEventContractFrontier['frontierKind']): string {
	switch (kind) {
		case 'COMMAND_WITHOUT_TRANSITION_BINDING':
			return 'The command has no retained transition-binding row; declaration presence does not prove behavioral absence.';
		case 'DECLARED_NEITHER_BOUND_NOR_PINNED_EMITTED':
			return 'The EVENTS contract is neither retained BOUND nor present in the dated pinned EMITTED set.';
		case 'GENERATED_EVENT_SCHEMA_UNRESOLVED':
			return 'The generated command event declaration has no exact EVENTS payload-contract entry.';
		case 'GENERATED_RETAINED_BOUND_SET_MISMATCH':
			return 'Generated command-declared and retained BOUND event-name sets differ.';
		case 'PINNED_EMITTED_NOT_RETAINED_BOUND':
			return 'The dated retained EMITTED set names an event absent from retained BOUND.';
		case 'RETAINED_BOUND_NOT_PINNED_EMITTED':
			return 'Retained BOUND names an event absent from the dated pinned EMITTED set.';
		case 'UNSUPPORTED_GENERATED_EVENT_DECLARATION':
			return 'A generated event declaration is outside the supported exact compiler-backed grammar.';
		case 'UNSUPPORTED_RETAINED_CENSUS_GRAMMAR':
			return 'The retained event-surface census is outside the supported exact static grammar.';
		case 'UNSUPPORTED_VOCAB_BINDING':
			return 'A vocab binding is outside the supported exact static grammar.';
	}
}

function makeFrontier(
	overlayId: CommandEventContractOverlayId,
	frontierKind: CommandEventContractFrontier['frontierKind'],
	commandId: CommandEventContractFrontier['commandId'],
	eventId: CommandEventContractFrontier['eventId'],
	eventName: string | null
): CommandEventContractFrontier {
	return {
		commandId,
		eventId,
		eventName,
		frontierKind,
		id: commandEventContractFrontierId({
			commandId,
			eventId,
			eventName,
			frontierKind,
			overlayId
		}),
		reason: frontierReason(frontierKind)
	};
}

function indexEntry(
	input: CommandEventContractOverlayIndexEntry
): CommandEventContractOverlayIndexEntry {
	return {
		boundContributionIds: sortedUnique(input.boundContributionIds),
		commandIds: sortedUnique(input.commandIds),
		declaredLinkIds: sortedUnique(input.declaredLinkIds),
		eventIds: sortedUnique(input.eventIds),
		frontierIds: sortedUnique(input.frontierIds),
		key: input.key,
		pinnedEmissionIds: sortedUnique(input.pinnedEmissionIds)
	};
}

function buildIndexes(input: {
	readonly boundContributions: readonly CommandEventContractBoundContribution[];
	readonly commands: readonly CommandEventContractCommandRecord[];
	readonly declaredLinks: readonly CommandEventContractDeclaredLink[];
	readonly eventContracts: readonly CommandEventContractEventRecord[];
	readonly frontiers: readonly CommandEventContractFrontier[];
	readonly pinnedEmissions: readonly CommandEventContractPinnedEmission[];
}): {
	readonly forwardIndex: readonly CommandEventContractOverlayIndexEntry[];
	readonly reverseIndex: readonly CommandEventContractOverlayIndexEntry[];
} {
	const forwardIndex = input.commands.map((command) => {
		const links = input.declaredLinks.filter((link) => link.commandId === command.id);
		const commandContributions = input.boundContributions.filter(
			(item) => item.commandName === command.commandName
		);
		const eventNames = new Set([
			...links.map((link) => link.eventName),
			...commandContributions.map((item) => item.eventName)
		]);
		return indexEntry({
			boundContributionIds: commandContributions.map((item) => item.id),
			commandIds: [command.id],
			declaredLinkIds: links.map((link) => link.id),
			eventIds: input.eventContracts
				.filter((event) => eventNames.has(event.eventName))
				.map((event) => event.id),
			frontierIds: input.frontiers
				.filter(
					(frontier) =>
						frontier.commandId === command.id ||
						(frontier.eventName !== null && eventNames.has(frontier.eventName))
				)
				.map((frontier) => frontier.id),
			key: command.commandName,
			pinnedEmissionIds: input.pinnedEmissions
				.filter((item) => eventNames.has(item.eventName))
				.map((item) => item.id)
		});
	});
	const eventKeys = sortedUnique([
		...input.eventContracts.map((event) => event.eventName),
		...input.declaredLinks.map((link) => link.eventName),
		...input.boundContributions.map((item) => item.eventName),
		...input.pinnedEmissions.map((item) => item.eventName),
		...input.frontiers.flatMap((frontier) =>
			frontier.eventName === null ? [] : [frontier.eventName]
		)
	]);
	const reverseIndex = eventKeys.map((eventName) => {
		const links = input.declaredLinks.filter((link) => link.eventName === eventName);
		const boundCommandNames = new Set(
			input.boundContributions
				.filter((item) => item.eventName === eventName)
				.map((item) => item.commandName)
		);
		return indexEntry({
			boundContributionIds: input.boundContributions
				.filter((item) => item.eventName === eventName)
				.map((item) => item.id),
			commandIds: [
				...links.map((link) => link.commandId),
				...input.commands
					.filter((command) => boundCommandNames.has(command.commandName))
					.map((command) => command.id)
			],
			declaredLinkIds: links.map((link) => link.id),
			eventIds: input.eventContracts
				.filter((event) => event.eventName === eventName)
				.map((event) => event.id),
			frontierIds: input.frontiers
				.filter((frontier) => frontier.eventName === eventName)
				.map((frontier) => frontier.id),
			key: eventName,
			pinnedEmissionIds: input.pinnedEmissions
				.filter((item) => item.eventName === eventName)
				.map((item) => item.id)
		});
	});
	return { forwardIndex, reverseIndex };
}

function failureMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}

function overlayDiagnosticCode(
	error: unknown,
	encodedCode: string | undefined
): CommandEventContractOverlayDiagnostic['code'] {
	if (error instanceof RangeError) return 'BUDGET_EXCEEDED';
	const knownCodes = new Set<CommandEventContractOverlayDiagnostic['code']>([
		'ARROW_OBSERVATION_INVALID',
		'COMMAND_HANDLER_GRAPH_INVALID',
		'INPUT_IDENTITY_MISMATCH',
		'INPUT_POPULATION_MISMATCH',
		'SEMANTIC_CAPABILITY_UNAVAILABLE',
		'SUBJECT_CAPABILITY_UNAVAILABLE',
		'UNSUPPORTED_GENERATED_REGISTRY',
		'UNSUPPORTED_RETAINED_CENSUS',
		'UNSUPPORTED_VOCAB'
	]);
	if (knownCodes.has(encodedCode as CommandEventContractOverlayDiagnostic['code']))
		return encodedCode as CommandEventContractOverlayDiagnostic['code'];
	return 'INPUT_POPULATION_MISMATCH';
}

function bindOverlayArtifacts(inputs: CommandEventContractOverlayBuildInputs): {
	readonly retainedFrozen: ReturnType<typeof frozenArtifact>;
	readonly selected: ReturnType<typeof selectedRegistrySource>;
	readonly sourceBytes: number;
	readonly vocabFrozen: ReturnType<typeof frozenArtifact>;
} {
	const selected = selectedRegistrySource(inputs);
	const vocabFrozen = frozenArtifact(inputs.subject, COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH);
	const retainedFrozen = frozenArtifact(
		inputs.subject,
		COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH
	);
	const vocabSelector = commandEventContractVocabArtifactSelector(inputs.subject);
	const retainedSelector = commandEventContractRetainedCensusArtifactSelector(inputs.subject);
	if (
		!sameArtifactSelector(inputs.request.vocabArtifact, vocabSelector) ||
		!sameArtifactSelector(inputs.request.retainedCensusArtifact, retainedSelector)
	)
		throw new Error('INPUT_IDENTITY_MISMATCH\0Retained artifact selectors do not reconcile.');
	return {
		retainedFrozen,
		selected,
		sourceBytes:
			selected.bytes.byteLength + vocabFrozen.bytes.byteLength + retainedFrozen.bytes.byteLength,
		vocabFrozen
	};
}

function parseGeneratedRegistrySurface(
	inputs: CommandEventContractOverlayBuildInputs,
	model: SelectedSemanticModel,
	selected: ReturnType<typeof selectedRegistrySource>
): {
	readonly parsedCommands: ParsedCommandDeclaration[];
	readonly parsedEvents: ParsedEventContract[];
} {
	try {
		const registries = parseRegistries(inputs, model, selected);
		const parsedCommands = parseCommandDeclarations(
			registries.commandProperties,
			registries.sourceFile,
			model
		);
		const parsedEvents = parseEventContracts(
			registries.eventProperties,
			registries.sourceFile,
			selected.source,
			model
		);
		return { parsedCommands, parsedEvents };
	} catch (error) {
		throw new Error(
			`UNSUPPORTED_GENERATED_REGISTRY\0${
				error instanceof Error ? error.message : 'Generated registry parsing failed.'
			}`
		);
	}
}

function parseVocabArtifact(bytes: Uint8Array): VocabPopulation {
	try {
		return parseVocab(decodeUtf8(bytes, COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH));
	} catch (error) {
		throw new Error(
			`UNSUPPORTED_VOCAB\0${error instanceof Error ? error.message : 'Vocab parsing failed.'}`
		);
	}
}

function parseRetainedCensusArtifact(
	overlayId: CommandEventContractOverlayId,
	bytes: Uint8Array
): CommandEventContractPinnedEmission[] {
	try {
		return parsePinnedEmissions(
			overlayId,
			decodeUtf8(bytes, COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH)
		);
	} catch (error) {
		throw new Error(
			`UNSUPPORTED_RETAINED_CENSUS\0${
				error instanceof Error ? error.message : 'Retained census parsing failed.'
			}`
		);
	}
}

function declaredSurfaceFrontiers(
	overlayId: CommandEventContractOverlayId,
	generated: GeneratedPopulation,
	transitionBoundCommands: ReadonlySet<string>,
	boundEventNames: ReadonlySet<string>,
	pinnedEventNames: ReadonlySet<string>
): CommandEventContractFrontier[] {
	const frontiers: CommandEventContractFrontier[] = [];
	for (const command of generated.commands)
		if (!transitionBoundCommands.has(command.commandName))
			frontiers.push(
				makeFrontier(overlayId, 'COMMAND_WITHOUT_TRANSITION_BINDING', command.id, null, null)
			);
	for (const missing of generated.missing)
		frontiers.push(
			makeFrontier(
				overlayId,
				'GENERATED_EVENT_SCHEMA_UNRESOLVED',
				missing.commandId,
				null,
				missing.eventName
			)
		);
	for (const event of generated.eventContracts)
		if (!boundEventNames.has(event.eventName) && !pinnedEventNames.has(event.eventName))
			frontiers.push(
				makeFrontier(
					overlayId,
					'DECLARED_NEITHER_BOUND_NOR_PINNED_EMITTED',
					null,
					event.id,
					event.eventName
				)
			);
	return frontiers;
}

function retainedSurfaceFrontiers(
	overlayId: CommandEventContractOverlayId,
	eventByName: ReadonlyMap<string, CommandEventContractEventRecord>,
	declaredEventNames: ReadonlySet<string>,
	boundEventNames: ReadonlySet<string>,
	pinnedEventNames: ReadonlySet<string>
): CommandEventContractFrontier[] {
	const frontiers: CommandEventContractFrontier[] = [];
	for (const eventName of sortedUnique([...declaredEventNames, ...boundEventNames]))
		if (declaredEventNames.has(eventName) !== boundEventNames.has(eventName))
			frontiers.push(
				makeFrontier(
					overlayId,
					'GENERATED_RETAINED_BOUND_SET_MISMATCH',
					null,
					eventByName.get(eventName)?.id ?? null,
					eventName
				)
			);
	for (const eventName of sortedUnique(pinnedEventNames))
		if (!boundEventNames.has(eventName))
			frontiers.push(
				makeFrontier(
					overlayId,
					'PINNED_EMITTED_NOT_RETAINED_BOUND',
					null,
					eventByName.get(eventName)?.id ?? null,
					eventName
				)
			);
	for (const eventName of sortedUnique(boundEventNames))
		if (!pinnedEventNames.has(eventName))
			frontiers.push(
				makeFrontier(
					overlayId,
					'RETAINED_BOUND_NOT_PINNED_EMITTED',
					null,
					eventByName.get(eventName)?.id ?? null,
					eventName
				)
			);
	return frontiers;
}

function overlayCoverage(
	generated: GeneratedPopulation,
	contributions: readonly CommandEventContractBoundContribution[],
	pinnedEmissions: readonly CommandEventContractPinnedEmission[],
	frontiers: readonly CommandEventContractFrontier[],
	boundEventNames: ReadonlySet<string>,
	declaredEventNames: ReadonlySet<string>
): CommandEventContractOverlayCoverage {
	const commandWithoutBinding = frontiers.filter(
		(frontier) => frontier.frontierKind === 'COMMAND_WITHOUT_TRANSITION_BINDING'
	).length;
	const declaredNeither = frontiers.filter(
		(frontier) => frontier.frontierKind === 'DECLARED_NEITHER_BOUND_NOR_PINNED_EMITTED'
	).length;
	const generatedDifferences = frontiers.filter(
		(frontier) => frontier.frontierKind === 'GENERATED_RETAINED_BOUND_SET_MISMATCH'
	).length;
	const pinnedNotBound = frontiers.filter(
		(frontier) => frontier.frontierKind === 'PINNED_EMITTED_NOT_RETAINED_BOUND'
	).length;
	const boundNotPinned = frontiers.filter(
		(frontier) => frontier.frontierKind === 'RETAINED_BOUND_NOT_PINNED_EMITTED'
	).length;
	return {
		additionalDeclaredLinks: generated.declaredLinks.filter((link) => link.role === 'ADDITIONAL')
			.length,
		boundContributions: contributions.length,
		boundDistinctEvents: boundEventNames.size,
		boundRepeatedContributions: contributions.length - boundEventNames.size,
		commandDeclaredDistinctEvents: declaredEventNames.size,
		commandDeclaredLinks: generated.declaredLinks.length,
		commands: generated.commands.length,
		commandsWithoutTransitionBinding: commandWithoutBinding,
		declaredNeitherBoundNorPinned: declaredNeither,
		eventContracts: generated.eventContracts.length,
		frontiers: frontiers.length,
		generatedBoundSetDifferences: generatedDifferences,
		missingEventContracts: generated.missing.length,
		pinnedEmissions: pinnedEmissions.length,
		pinnedEmittedNotBound: pinnedNotBound,
		primaryDeclaredLinks: generated.declaredLinks.filter((link) => link.role === 'PRIMARY').length,
		reconciles: generated.missing.length === 0 && generatedDifferences === 0,
		retainedBoundNotPinnedEmitted: boundNotPinned
	};
}

/** Builds a deterministic static command-to-event-contract overlay. */
export function buildCommandEventContractOverlay(
	inputsValue: CommandEventContractOverlayBuildInputs,
	options?: BuildCommandEventContractOverlayOptions
): CommandEventContractOverlayBuildOutcome {
	const telemetry = createTelemetry(options);
	telemetry.start('REQUEST_BIND');
	let inputs: CommandEventContractOverlayBuildInputs;
	try {
		inputs = materializeInputs(inputsValue);
	} catch (error) {
		telemetry.fail({ diagnostics: 1 }, 'REQUEST_INVALID');
		return telemetry.finish(
			unavailable(
				'REQUEST_INVALID',
				failureMessage(error, 'Invalid command-event overlay inputs.'),
				'REQUEST'
			)
		);
	}
	telemetry.complete();
	let diagnosticPhase: CommandEventContractOverlayDiagnostic['phase'] = 'BIND';
	try {
		const { budgets } = inputs.request;
		if (inputs.semanticSnapshot.astNodes.length > budgets.maxAstNodes)
			throw new RangeError('maxAstNodes exceeded.');
		validatePredecessors(inputs, telemetry);
		const inputDigest = commandEventContractOverlayInputDigest(inputs);
		const overlayId = commandEventContractOverlayId({
			inputDigest,
			semanticSnapshotId: inputs.semanticSnapshot.id,
			subjectId: inputs.request.subjectId
		});

		telemetry.start('ARTIFACT_BIND');
		const { retainedFrozen, selected, sourceBytes, vocabFrozen } = bindOverlayArtifacts(inputs);
		if (sourceBytes > budgets.maxSourceBytes) throw new RangeError('maxSourceBytes exceeded.');
		telemetry.complete({ artifacts: 3, sourceBytes });

		telemetry.start('GENERATED_REGISTRY_PARSE');
		diagnosticPhase = 'PARSE';
		const model = selectedSemanticModel(inputs.semanticSnapshot, selected.source);
		const { parsedCommands, parsedEvents } = parseGeneratedRegistrySurface(inputs, model, selected);
		if (parsedCommands.length > budgets.maxCommands) throw new RangeError('maxCommands exceeded.');
		if (parsedEvents.length > budgets.maxEventContracts)
			throw new RangeError('maxEventContracts exceeded.');
		telemetry.complete({ commands: parsedCommands.length, events: parsedEvents.length });

		telemetry.start('VOCAB_PARSE');
		const vocab = parseVocabArtifact(vocabFrozen.bytes);
		assertGeneratedVocabParity(parsedCommands, parsedEvents, vocab);
		const contributions = boundContributions(overlayId, vocab);
		if (contributions.length > budgets.maxBoundContributions)
			throw new RangeError('maxBoundContributions exceeded.');
		telemetry.complete({ bindings: vocab.bindings.length, contributions: contributions.length });

		telemetry.start('RETAINED_CENSUS_PARSE');
		const pinnedEmissions = parseRetainedCensusArtifact(overlayId, retainedFrozen.bytes);
		if (pinnedEmissions.length > budgets.maxPinnedEmissions)
			throw new RangeError('maxPinnedEmissions exceeded.');
		telemetry.complete({ pinnedEmissions: pinnedEmissions.length });

		telemetry.start('COMMAND_EVENT_JOIN');
		diagnosticPhase = 'RECONCILE';
		const generated = generatedPopulation(overlayId, parsedCommands, parsedEvents, inputs);
		if (generated.declaredLinks.length > budgets.maxDeclaredLinks)
			throw new RangeError('maxDeclaredLinks exceeded.');
		telemetry.complete({ declaredLinks: generated.declaredLinks.length });

		telemetry.start('SURFACE_RECONCILE');
		const eventByName = new Map(generated.eventContracts.map((event) => [event.eventName, event]));
		const declaredEventNames = new Set(generated.declaredLinks.map((link) => link.eventName));
		const boundEventNames = new Set(contributions.map((contribution) => contribution.eventName));
		const pinnedEventNames = new Set(pinnedEmissions.map((emission) => emission.eventName));
		const transitionBoundCommands = new Set(vocab.bindings.map((binding) => binding.commandName));
		const frontiers = [
			...declaredSurfaceFrontiers(
				overlayId,
				generated,
				transitionBoundCommands,
				boundEventNames,
				pinnedEventNames
			),
			...retainedSurfaceFrontiers(
				overlayId,
				eventByName,
				declaredEventNames,
				boundEventNames,
				pinnedEventNames
			)
		];
		frontiers.sort((left, right) => compareText(left.id, right.id));
		if (frontiers.length > budgets.maxFrontiers) throw new RangeError('maxFrontiers exceeded.');
		telemetry.complete({ frontiers: frontiers.length });

		const coverage = overlayCoverage(
			generated,
			contributions,
			pinnedEmissions,
			frontiers,
			boundEventNames,
			declaredEventNames
		);
		const { forwardIndex, reverseIndex } = buildIndexes({
			boundContributions: contributions,
			commands: generated.commands,
			declaredLinks: generated.declaredLinks,
			eventContracts: generated.eventContracts,
			frontiers,
			pinnedEmissions
		});
		const derivationLayer: CommandEventContractOverlayLayer = {
			boundContributionIds: contributions.map((record) => record.id),
			capability: COMMAND_EVENT_CONTRACT_OVERLAY_DERIVATION_CAPABILITY,
			capabilityStatus: COMMAND_EVENT_CONTRACT_OVERLAY_CAPABILITY_STATUS,
			commandIds: generated.commands.map((record) => record.id),
			declaredLinkIds: generated.declaredLinks.map((record) => record.id),
			eventIds: generated.eventContracts.map((record) => record.id),
			frontierIds: frontiers.map((record) => record.id),
			id: commandEventContractDerivationLayerId(overlayId),
			kind: 'JPWB_COMMAND_EVENT_CONTRACT_DERIVATION',
			ordinal: 0,
			overlayId,
			pinnedEmissionIds: pinnedEmissions.map((record) => record.id)
		};
		const inferenceLayer: CommandEventContractOverlayLayer = {
			boundContributionIds: [],
			capability: COMMAND_EVENT_CONTRACT_OVERLAY_INFERENCE_CAPABILITY,
			capabilityStatus: COMMAND_EVENT_CONTRACT_OVERLAY_CAPABILITY_STATUS,
			commandIds: [],
			declaredLinkIds: [],
			eventIds: [],
			frontierIds: [],
			id: commandEventContractInferenceLayerId(overlayId),
			kind: 'JPWB_COMMAND_EVENT_CONTRACT_INFERENCE',
			ordinal: 1,
			overlayId,
			pinnedEmissionIds: []
		};

		telemetry.start('MATERIALIZE');
		diagnosticPhase = 'MATERIALIZE';
		const content = {
			arrowObservationContentDigest: inputs.arrowObservation.contentDigest,
			arrowObservationId: inputs.arrowObservation.id,
			authorityTransfer: COMMAND_EVENT_CONTRACT_OVERLAY_AUTHORITY_TRANSFER,
			baselineChange: COMMAND_EVENT_CONTRACT_OVERLAY_BASELINE_CHANGE,
			boundContributions: contributions,
			budgets: { ...budgets },
			canonicalProfile: COMMAND_EVENT_CONTRACT_OVERLAY_CANONICAL_PROFILE,
			capabilities: [
				COMMAND_EVENT_CONTRACT_OVERLAY_DERIVATION_CAPABILITY,
				COMMAND_EVENT_CONTRACT_OVERLAY_INFERENCE_CAPABILITY
			] as const,
			capabilityStatus: COMMAND_EVENT_CONTRACT_OVERLAY_CAPABILITY_STATUS,
			commandHandlerGraphContentDigest: inputs.commandHandlerGraph.contentDigest,
			commandHandlerGraphId: inputs.commandHandlerGraph.id,
			commandRegistry: { ...inputs.request.commandRegistry },
			commands: generated.commands,
			coverage,
			declaredLinks: generated.declaredLinks,
			eventContracts: generated.eventContracts,
			eventRegistry: { ...inputs.request.eventRegistry },
			forwardIndex,
			frontiers,
			fullJanCsaa007Conformance: COMMAND_EVENT_CONTRACT_OVERLAY_FULL_JAN_CSAA_007_CONFORMANCE,
			fullJanCsaa008Conformance: COMMAND_EVENT_CONTRACT_OVERLAY_FULL_JAN_CSAA_008_CONFORMANCE,
			gateEffect: COMMAND_EVENT_CONTRACT_OVERLAY_GATE_EFFECT,
			graphAuthority: COMMAND_EVENT_CONTRACT_OVERLAY_GRAPH_AUTHORITY,
			health: 'PARTIAL' as const,
			id: overlayId,
			inputDigest,
			integrationStrategy: COMMAND_EVENT_CONTRACT_OVERLAY_INTEGRATION_STRATEGY,
			layers: [derivationLayer, inferenceLayer] as const,
			limitations: COMMAND_EVENT_CONTRACT_OVERLAY_LIMITATIONS.map((limitation) => ({
				...limitation
			})),
			method: COMMAND_EVENT_CONTRACT_OVERLAY_METHOD,
			operationVersion: COMMAND_EVENT_CONTRACT_OVERLAY_OPERATION_VERSION,
			oracleChange: COMMAND_EVENT_CONTRACT_OVERLAY_ORACLE_CHANGE,
			pinnedEmissions,
			producer: { ...inputs.semanticSnapshot.provider },
			registryStatus: COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_STATUS,
			replacementEquivalence: COMMAND_EVENT_CONTRACT_OVERLAY_REPLACEMENT_EQUIVALENCE,
			retainedCensus: commandEventContractRetainedCensusReference(inputs.subject),
			reverseIndex,
			runtimeEmission: COMMAND_EVENT_CONTRACT_OVERLAY_RUNTIME_EMISSION,
			runtimePerformability: COMMAND_EVENT_CONTRACT_OVERLAY_RUNTIME_PERFORMABILITY,
			schemaVersion: COMMAND_EVENT_CONTRACT_OVERLAY_SCHEMA_VERSION,
			scope: COMMAND_EVENT_CONTRACT_OVERLAY_SCOPE,
			semanticSnapshotId: inputs.semanticSnapshot.id,
			subjectId: inputs.request.subjectId,
			vocabArtifact: { ...inputs.request.vocabArtifact }
		};
		const overlay: CommandEventContractOverlaySnapshot = {
			...content,
			contentDigest: commandEventContractOverlayContentDigest(content)
		};
		telemetry.complete({ records: generated.commands.length + generated.eventContracts.length });
		telemetry.start('SERIALIZE');
		telemetry.complete({ bytes: JSON.stringify(overlay).length });
		telemetry.start('OVERLAY_VALIDATE');
		diagnosticPhase = 'VALIDATE';
		const validation = validateConstructedCommandEventContractOverlay(overlay, inputs, {
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
		return telemetry.finish({ diagnostics: [], outcome: 'partial', overlay });
	} catch (error) {
		const message = failureMessage(error, 'Command-event overlay failed closed.');
		const [encodedCode, detail] = message.split('\0', 2);
		const code = overlayDiagnosticCode(error, encodedCode);
		telemetry.fail({ diagnostics: 1 }, code);
		return telemetry.finish(unavailable(code, detail ?? message, diagnosticPhase));
	}
}
