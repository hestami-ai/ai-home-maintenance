import { isProxy } from 'node:util/types';

import type { CallGraphSourceRegionNode } from '../contracts/call-graph.js';
import type { ModuleDependencyGraphSourceNode } from '../contracts/graph.js';
import {
	LOGICAL_GRAPH_COMPOSITION_AUTHORITY_TRANSFER,
	LOGICAL_GRAPH_COMPOSITION_CANONICAL_PROFILE,
	LOGICAL_GRAPH_COMPOSITION_CAPABILITY,
	LOGICAL_GRAPH_COMPOSITION_CAPABILITY_STATUS,
	LOGICAL_GRAPH_COMPOSITION_CURRENTNESS,
	LOGICAL_GRAPH_COMPOSITION_FRESHNESS,
	LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_007_CONFORMANCE,
	LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_008_CONFORMANCE,
	LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_009_CONFORMANCE,
	LOGICAL_GRAPH_COMPOSITION_GATE_EFFECT,
	LOGICAL_GRAPH_COMPOSITION_GRAPH_AUTHORITY,
	LOGICAL_GRAPH_COMPOSITION_METHOD,
	LOGICAL_GRAPH_COMPOSITION_NONCLAIMS,
	LOGICAL_GRAPH_COMPOSITION_OPERATION_VERSION,
	LOGICAL_GRAPH_COMPOSITION_PROGRESS_SCHEMA_VERSION,
	LOGICAL_GRAPH_COMPOSITION_REQUEST_SCHEMA_VERSION,
	LOGICAL_GRAPH_COMPOSITION_SCHEMA_VERSION,
	LOGICAL_GRAPH_COMPOSITION_SELECTION,
	type BuildLogicalGraphCompositionOptions,
	type BuildLogicalGraphCompositionRequest,
	type LogicalGraphCompositionBuildOutcome,
	type LogicalGraphCompositionCallLayerBinding,
	type LogicalGraphCompositionCallLayerReference,
	type LogicalGraphCompositionCoverage,
	type LogicalGraphCompositionCrossLink,
	type LogicalGraphCompositionDiagnostic,
	type LogicalGraphCompositionInputs,
	type LogicalGraphCompositionLayerBindings,
	type LogicalGraphCompositionModuleDependencyLayerBinding,
	type LogicalGraphCompositionModuleDependencyLayerReference,
	type LogicalGraphCompositionProgressEvent,
	type LogicalGraphCompositionProgressPhase,
	type LogicalGraphCompositionSnapshot,
	type LogicalGraphCompositionSourceIdentity
} from '../contracts/logical-graph-composition.js';
import { compareText } from '../inventory/canonical.js';
import { canonicalSemanticJson, isUnicodeScalarString } from '../semantic/canonical.js';
import {
	logicalGraphCompositionContentDigest,
	logicalGraphCompositionCrossLinkId,
	logicalGraphCompositionId,
	logicalGraphCompositionInputDigest,
	logicalGraphCompositionLayerId
} from './logical-graph-composition-canonical.js';
import { validateCallGraph } from './validate-call-graph.js';
import { validateModuleDependencyGraph } from './validate-graph.js';
import { validateConstructedLogicalGraphComposition } from './validate-logical-graph-composition.js';

const INPUT_KEYS = ['callGraph', 'moduleDependencyGraph', 'request', 'semanticSnapshot'] as const;
const REQUEST_KEYS = [
	'budgets',
	'operationVersion',
	'schemaVersion',
	'selection',
	'semanticSnapshotId',
	'sourceLayers',
	'subjectId'
] as const;
const BUDGET_KEYS = [
	'maxCallEdges',
	'maxCallNodes',
	'maxConflictRecords',
	'maxDiagnostics',
	'maxEligibleSourceNodes',
	'maxInputRecords',
	'maxInputStringCharacters',
	'maxLinks',
	'maxModuleDependencyEdges',
	'maxModuleDependencyNodes',
	'maxOutputRecords',
	'maxTraversalSteps',
	'maxUnmatchedRecords'
] as const;
const SELECTION_KEYS = [
	'callNodePopulation',
	'compositionMode',
	'conflictTreatment',
	'consistencyFields',
	'crossLinkRelation',
	'joinKey',
	'layerOrder',
	'moduleNodePopulation'
] as const;
const MODULE_LAYER_REFERENCE_KEYS = [
	'canonicalProfile',
	'contentDigest',
	'graphId',
	'graphInputDigest',
	'graphKind',
	'layerId',
	'method',
	'operationVersion',
	'ordinal',
	'producer',
	'role',
	'schemaVersion',
	'semanticExtractionVersion',
	'semanticSchemaVersion',
	'semanticSnapshotId',
	'subjectId'
] as const;
const CALL_LAYER_REFERENCE_KEYS = MODULE_LAYER_REFERENCE_KEYS;

interface TelemetryRecorder {
	complete(counts?: Readonly<Record<string, number>>, detailCode?: string | null): void;
	fail(counts?: Readonly<Record<string, number>>, detailCode?: string | null): void;
	finish<Outcome extends LogicalGraphCompositionBuildOutcome>(outcome: Outcome): Outcome;
	start(
		phase: LogicalGraphCompositionProgressPhase,
		counts?: Readonly<Record<string, number>>
	): void;
}

class CompositionFailure extends Error {
	constructor(
		readonly code: LogicalGraphCompositionDiagnostic['code'],
		message: string,
		readonly phase: LogicalGraphCompositionDiagnostic['phase'],
		readonly path: string | null = null
	) {
		super(message);
	}
}

interface PlainDataUsage {
	readonly records: number;
	readonly stringCharacters: number;
}

function preflightLimits(value: unknown): {
	readonly maxInputRecords: number;
	readonly maxInputStringCharacters: number;
} {
	const input = exactPlainRecord(value, INPUT_KEYS, '$inputs');
	const request = exactPlainRecord(input.request, REQUEST_KEYS, '$inputs.request');
	const budgets = exactPlainRecord(request.budgets, BUDGET_KEYS, '$inputs.request.budgets');
	for (const key of ['maxInputRecords', 'maxInputStringCharacters'] as const)
		if (!Number.isSafeInteger(budgets[key]) || (budgets[key] as number) < 1)
			throw new TypeError(`$inputs.request.budgets.${key} must be a positive safe integer.`);
	return {
		maxInputRecords: budgets.maxInputRecords as number,
		maxInputStringCharacters: budgets.maxInputStringCharacters as number
	};
}

function preflightPlainData(
	value: unknown,
	limits: { readonly maxInputRecords: number; readonly maxInputStringCharacters: number }
): PlainDataUsage {
	type Work =
		| { readonly kind: 'LEAVE'; readonly value: object }
		| { readonly kind: 'VISIT'; readonly value: unknown };
	const pending: Work[] = [{ kind: 'VISIT', value }];
	const active = new WeakSet<object>();
	let records = 0;
	let stringCharacters = 0;
	while (pending.length > 0) {
		const work = pending.pop()!;
		if (work.kind === 'LEAVE') {
			active.delete(work.value);
			continue;
		}
		records += 1;
		if (records > limits.maxInputRecords)
			throw new CompositionFailure(
				'BUDGET_EXCEEDED',
				`Input plain-data record budget exceeded: ${records} > ${limits.maxInputRecords}.`,
				'REQUEST',
				'$.request.budgets.maxInputRecords'
			);
		if (typeof work.value === 'string') {
			if (!isUnicodeScalarString(work.value))
				throw new TypeError('Input strings must contain Unicode scalar text.');
			stringCharacters += work.value.length;
			if (stringCharacters > limits.maxInputStringCharacters)
				throw new CompositionFailure(
					'BUDGET_EXCEEDED',
					`Input string-character budget exceeded: ${stringCharacters} > ${limits.maxInputStringCharacters}.`,
					'REQUEST',
					'$.request.budgets.maxInputStringCharacters'
				);
			continue;
		}
		if (
			work.value === null ||
			typeof work.value === 'boolean' ||
			(typeof work.value === 'number' &&
				Number.isSafeInteger(work.value) &&
				!Object.is(work.value, -0))
		)
			continue;
		if (typeof work.value !== 'object' || isProxy(work.value))
			throw new TypeError('Input must contain only inert JSON-compatible plain data.');
		if (active.has(work.value)) throw new TypeError('Input plain data may not contain cycles.');
		active.add(work.value);
		pending.push({ kind: 'LEAVE', value: work.value });
		if (Array.isArray(work.value)) {
			if (Reflect.getPrototypeOf(work.value) !== Array.prototype)
				throw new TypeError('Input arrays must use Array.prototype.');
			const count = work.value.length;
			const keys = Reflect.ownKeys(work.value);
			if (keys.some((key) => typeof key !== 'string'))
				throw new TypeError('Input arrays may not contain symbol keys.');
			for (const key of keys as string[]) {
				if (key === 'length') continue;
				stringCharacters += key.length;
				if (stringCharacters > limits.maxInputStringCharacters)
					throw new CompositionFailure(
						'BUDGET_EXCEEDED',
						`Input string-character budget exceeded: ${stringCharacters} > ${limits.maxInputStringCharacters}.`,
						'REQUEST',
						'$.request.budgets.maxInputStringCharacters'
					);
				if (!isUnicodeScalarString(key))
					throw new TypeError('Input array keys must contain Unicode scalar text.');
			}
			if (
				keys.length !== count + 1 ||
				(keys as string[]).some((key) => key !== 'length' && !/^(?:0|[1-9][0-9]*)$/u.test(key))
			)
				throw new TypeError('Input arrays must be dense exact data arrays.');
			if (records + count > limits.maxInputRecords)
				throw new CompositionFailure(
					'BUDGET_EXCEEDED',
					'Input array population exceeds the plain-data record budget.',
					'REQUEST',
					'$.request.budgets.maxInputRecords'
				);
			for (let index = count - 1; index >= 0; index -= 1) {
				const descriptor = Reflect.getOwnPropertyDescriptor(work.value, String(index));
				if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
					throw new TypeError('Input arrays must contain enumerable data elements.');
				pending.push({ kind: 'VISIT', value: descriptor.value });
			}
			continue;
		}
		const prototype = Reflect.getPrototypeOf(work.value);
		if (prototype !== Object.prototype && prototype !== null)
			throw new TypeError('Input records must use a plain prototype.');
		const keys = Reflect.ownKeys(work.value);
		if (keys.some((key) => typeof key !== 'string'))
			throw new TypeError('Input records may not contain symbol keys.');
		if (records + keys.length > limits.maxInputRecords)
			throw new CompositionFailure(
				'BUDGET_EXCEEDED',
				'Input property population exceeds the plain-data record budget.',
				'REQUEST',
				'$.request.budgets.maxInputRecords'
			);
		for (const key of [...(keys as string[])].reverse()) {
			stringCharacters += key.length;
			if (stringCharacters > limits.maxInputStringCharacters)
				throw new CompositionFailure(
					'BUDGET_EXCEEDED',
					`Input string-character budget exceeded: ${stringCharacters} > ${limits.maxInputStringCharacters}.`,
					'REQUEST',
					'$.request.budgets.maxInputStringCharacters'
				);
			if (!isUnicodeScalarString(key))
				throw new TypeError('Input record keys must contain Unicode scalar text.');
			const descriptor = Reflect.getOwnPropertyDescriptor(work.value, key);
			if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
				throw new TypeError('Input records must contain enumerable data properties.');
			pending.push({ kind: 'VISIT', value: descriptor.value });
		}
	}
	return { records, stringCharacters };
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

function assertOrdinaryArray(value: unknown, path: string): asserts value is unknown[] {
	if (!Array.isArray(value) || isProxy(value) || Reflect.getPrototypeOf(value) !== Array.prototype)
		throw new TypeError(`${path} must be an exact ordinary array.`);
}

function shallowPlainRecord(value: unknown, path: string): Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		throw new TypeError(`${path} must be a plain data record.`);
	return value as Record<string, unknown>;
}

function exactJson(value: unknown, expected: unknown, path: string): void {
	if (canonicalSemanticJson(value) !== canonicalSemanticJson(expected))
		throw new TypeError(`${path} does not match the exact supported value.`);
}

function materializeInputs(value: unknown): LogicalGraphCompositionInputs {
	const input = exactPlainRecord(value, INPUT_KEYS, '$inputs');
	const requestRecord = exactPlainRecord(input.request, REQUEST_KEYS, '$inputs.request');
	const budgets = exactPlainRecord(requestRecord.budgets, BUDGET_KEYS, '$inputs.request.budgets');
	for (const key of BUDGET_KEYS)
		if (!Number.isSafeInteger(budgets[key]) || (budgets[key] as number) < 0)
			throw new TypeError(`$inputs.request.budgets.${key} must be a nonnegative safe integer.`);
	if ((budgets.maxDiagnostics as number) < 1 || (budgets.maxDiagnostics as number) > 100_000)
		throw new TypeError(
			'$inputs.request.budgets.maxDiagnostics must be positive and no greater than 100000.'
		);
	if (budgets.maxConflictRecords !== 0 || budgets.maxUnmatchedRecords !== 0)
		throw new TypeError(
			'$inputs.request frontier budgets must remain zero for the exact refuse-incompatible-input method.'
		);
	for (const key of [
		'operationVersion',
		'schemaVersion',
		'semanticSnapshotId',
		'subjectId'
	] as const)
		if (typeof requestRecord[key] !== 'string' || requestRecord[key] === '')
			throw new TypeError(`$inputs.request.${key} must be nonempty text.`);
	if (requestRecord.schemaVersion !== LOGICAL_GRAPH_COMPOSITION_REQUEST_SCHEMA_VERSION)
		throw new TypeError('Unsupported logical composition request schema version.');
	if (requestRecord.operationVersion !== LOGICAL_GRAPH_COMPOSITION_OPERATION_VERSION)
		throw new TypeError('Unsupported logical composition operation version.');
	const selection = exactPlainRecord(
		requestRecord.selection,
		SELECTION_KEYS,
		'$inputs.request.selection'
	);
	assertOrdinaryArray(selection.consistencyFields, '$inputs.request.selection.consistencyFields');
	assertOrdinaryArray(selection.layerOrder, '$inputs.request.selection.layerOrder');
	exactJson(selection, LOGICAL_GRAPH_COMPOSITION_SELECTION, '$inputs.request.selection');
	assertOrdinaryArray(requestRecord.sourceLayers, '$inputs.request.sourceLayers');
	if (requestRecord.sourceLayers.length !== 2)
		throw new TypeError('$inputs.request.sourceLayers must contain exactly two layer references.');
	const moduleLayer = exactPlainRecord(
		requestRecord.sourceLayers[0],
		MODULE_LAYER_REFERENCE_KEYS,
		'$inputs.request.sourceLayers[0]'
	);
	const callLayer = exactPlainRecord(
		requestRecord.sourceLayers[1],
		CALL_LAYER_REFERENCE_KEYS,
		'$inputs.request.sourceLayers[1]'
	);
	if (moduleLayer.role !== 'MODULE_DEPENDENCY' || moduleLayer.ordinal !== 0)
		throw new TypeError('$inputs.request.sourceLayers[0] has an invalid role or ordinal.');
	if (callLayer.role !== 'CALL' || callLayer.ordinal !== 1)
		throw new TypeError('$inputs.request.sourceLayers[1] has an invalid role or ordinal.');
	const snapshot = shallowPlainRecord(input.semanticSnapshot, '$inputs.semanticSnapshot');
	const moduleGraph = shallowPlainRecord(
		input.moduleDependencyGraph,
		'$inputs.moduleDependencyGraph'
	);
	const callGraph = shallowPlainRecord(input.callGraph, '$inputs.callGraph');
	for (const [path, record, keys] of [
		['$inputs.semanticSnapshot', snapshot, ['sources']],
		['$inputs.moduleDependencyGraph', moduleGraph, ['nodes', 'edges', 'limitations', 'layers']],
		['$inputs.callGraph', callGraph, ['nodes', 'edges', 'limitations', 'layers']]
	] as const)
		for (const key of keys) assertOrdinaryArray(record[key], `${path}.${key}`);
	return {
		callGraph: input.callGraph as LogicalGraphCompositionInputs['callGraph'],
		moduleDependencyGraph:
			input.moduleDependencyGraph as LogicalGraphCompositionInputs['moduleDependencyGraph'],
		request: {
			...(requestRecord as unknown as BuildLogicalGraphCompositionRequest),
			budgets: { ...(budgets as unknown as BuildLogicalGraphCompositionRequest['budgets']) },
			selection: LOGICAL_GRAPH_COMPOSITION_SELECTION,
			sourceLayers: [
				{
					...(moduleLayer as unknown as LogicalGraphCompositionModuleDependencyLayerReference),
					producer: {
						...(moduleLayer.producer as LogicalGraphCompositionModuleDependencyLayerReference['producer'])
					}
				},
				{
					...(callLayer as unknown as LogicalGraphCompositionCallLayerReference),
					producer: {
						...(callLayer.producer as LogicalGraphCompositionCallLayerReference['producer'])
					}
				}
			]
		},
		semanticSnapshot: input.semanticSnapshot as LogicalGraphCompositionInputs['semanticSnapshot']
	};
}

function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
	if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value;
	const object = value as object;
	if (seen.has(object)) return value;
	seen.add(object);
	for (const key of Reflect.ownKeys(object)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(object, key);
		if (descriptor !== undefined && 'value' in descriptor) deepFreeze(descriptor.value, seen);
	}
	return Object.freeze(value);
}

function clonePlainData<Value>(value: Value, seen = new WeakMap<object, unknown>()): Value {
	if (value === null || typeof value !== 'object') return value;
	const object = value as object;
	const previous = seen.get(object);
	if (previous !== undefined) return previous as Value;
	if (Array.isArray(value)) {
		const result: unknown[] = [];
		seen.set(object, result);
		for (const item of value) result.push(clonePlainData(item, seen));
		return result as Value;
	}
	const result: Record<string, unknown> = {};
	seen.set(object, result);
	for (const key of Object.keys(object))
		result[key] = clonePlainData((object as Record<string, unknown>)[key], seen);
	return result as Value;
}

function boundedCounts(counts: Readonly<Record<string, number>>): Readonly<Record<string, number>> {
	const result: Record<string, number> = {};
	for (const key of Object.keys(counts).sort(compareText).slice(0, 16)) {
		const value = counts[key];
		if (Number.isSafeInteger(value) && value! >= 0) result[key] = value!;
	}
	return Object.freeze(result);
}

function telemetry(options: BuildLogicalGraphCompositionOptions | undefined): TelemetryRecorder {
	let sink: ((event: LogicalGraphCompositionProgressEvent) => void) | undefined;
	try {
		if (options !== undefined) {
			const record = exactPlainRecord(options, ['onProgress'], '$options');
			if (typeof record.onProgress === 'function')
				sink = record.onProgress as (event: LogicalGraphCompositionProgressEvent) => void;
		}
	} catch {
		// Telemetry is out of band and never changes evidence or outcome.
	}
	const events: LogicalGraphCompositionProgressEvent[] = [];
	let active: LogicalGraphCompositionProgressPhase | null = null;
	let sequence = 0;
	const emit = (
		phase: LogicalGraphCompositionProgressPhase,
		state: LogicalGraphCompositionProgressEvent['state'],
		counts: Readonly<Record<string, number>>,
		detailCode: string | null
	): void => {
		events.push(
			Object.freeze({
				counts: boundedCounts(counts),
				detailCode,
				phase,
				schemaVersion: LOGICAL_GRAPH_COMPOSITION_PROGRESS_SCHEMA_VERSION,
				sequence: sequence++,
				state
			})
		);
	};
	const close = (
		state: LogicalGraphCompositionProgressEvent['state'],
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
		finish<Outcome extends LogicalGraphCompositionBuildOutcome>(outcome: Outcome): Outcome {
			if (active !== null) close('FAILED', { interrupted: 1 }, 'INTERRUPTED');
			const frozen = deepFreeze(outcome);
			if (sink !== undefined) {
				const frozenEvents = Object.freeze([...events]);
				queueMicrotask(() => {
					for (const event of frozenEvents)
						try {
							sink!(event);
						} catch {
							// Deferred observer failures are isolated.
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

function unavailable(
	code: LogicalGraphCompositionDiagnostic['code'],
	message: string,
	phase: LogicalGraphCompositionDiagnostic['phase'],
	path: string | null = null
): LogicalGraphCompositionBuildOutcome {
	return { diagnostics: [{ code, message, path, phase }], outcome: 'unavailable' };
}

function sourceIdentity(
	node: ModuleDependencyGraphSourceNode | CallGraphSourceRegionNode
): LogicalGraphCompositionSourceIdentity {
	return {
		analysisDisposition: node.analysisDisposition,
		logicalPath: node.logicalPath,
		programId: node.programId,
		projectId: node.projectId,
		semanticSourceId: node.semanticSourceId
	};
}

function uniqueBySourceId<Node extends ModuleDependencyGraphSourceNode | CallGraphSourceRegionNode>(
	nodes: readonly Node[]
): Map<string, Node> {
	const result = new Map<string, Node>();
	for (const node of [...nodes].sort(
		(left, right) =>
			compareText(left.semanticSourceId, right.semanticSourceId) || compareText(left.id, right.id)
	)) {
		result.set(node.semanticSourceId, node);
	}
	return result;
}

function exactLayerReferences(
	inputs: LogicalGraphCompositionInputs
): LogicalGraphCompositionInputs['request']['sourceLayers'] {
	const { callGraph, moduleDependencyGraph } = inputs;
	return [
		{
			canonicalProfile: moduleDependencyGraph.canonicalProfile,
			contentDigest: moduleDependencyGraph.contentDigest,
			graphId: moduleDependencyGraph.id,
			graphInputDigest: moduleDependencyGraph.graphInputDigest,
			graphKind: moduleDependencyGraph.graphKind,
			layerId: moduleDependencyGraph.layers[0].id,
			method: moduleDependencyGraph.method,
			operationVersion: moduleDependencyGraph.operationVersion,
			ordinal: 0,
			producer: { ...moduleDependencyGraph.producer },
			role: 'MODULE_DEPENDENCY',
			schemaVersion: moduleDependencyGraph.schemaVersion,
			semanticExtractionVersion: moduleDependencyGraph.semanticExtractionVersion,
			semanticSchemaVersion: moduleDependencyGraph.semanticSchemaVersion,
			semanticSnapshotId: moduleDependencyGraph.semanticSnapshotId,
			subjectId: moduleDependencyGraph.subjectId
		},
		{
			canonicalProfile: callGraph.canonicalProfile,
			contentDigest: callGraph.contentDigest,
			graphId: callGraph.id,
			graphInputDigest: callGraph.graphInputDigest,
			graphKind: callGraph.graphKind,
			layerId: callGraph.layers[0].id,
			method: callGraph.method,
			operationVersion: callGraph.operationVersion,
			ordinal: 1,
			producer: { ...callGraph.producer },
			role: 'CALL',
			schemaVersion: callGraph.schemaVersion,
			semanticExtractionVersion: callGraph.semanticExtractionVersion,
			semanticSchemaVersion: callGraph.semanticSchemaVersion,
			semanticSnapshotId: callGraph.semanticSnapshotId,
			subjectId: callGraph.subjectId
		}
	];
}

function validationSummary(
	issues: readonly { readonly code: string; readonly message: string; readonly path: string }[]
): string {
	return issues
		.slice(0, 3)
		.map((issue) => `${issue.code}@${issue.path}: ${issue.message}`)
		.join(', ');
}

/** Compose the exact validated module-dependency and call layers by source occurrence only. */
export function buildLogicalGraphComposition(
	inputsValue: unknown,
	options?: BuildLogicalGraphCompositionOptions
): LogicalGraphCompositionBuildOutcome {
	const progress = telemetry(options);
	progress.start('REQUEST_BIND');
	let inputs: LogicalGraphCompositionInputs;
	try {
		const limits = preflightLimits(inputsValue);
		const usage = preflightPlainData(inputsValue, limits);
		inputs = materializeInputs(inputsValue);
		progress.complete({
			inputPreflightRecords: usage.records,
			inputPreflightStringCharacters: usage.stringCharacters
		});
	} catch (error) {
		const code =
			error instanceof CompositionFailure && error.code === 'BUDGET_EXCEEDED'
				? 'BUDGET_EXCEEDED'
				: 'REQUEST_INVALID';
		progress.fail({ diagnostics: 1 }, code);
		return progress.finish(
			unavailable(
				code,
				error instanceof Error ? error.message : 'Logical graph composition request is invalid.',
				'REQUEST',
				error instanceof CompositionFailure ? error.path : null
			)
		);
	}
	const { callGraph, moduleDependencyGraph, request, semanticSnapshot } = inputs;
	try {
		progress.start('INPUT_IDENTITY_RECONCILE');
		if (
			request.subjectId !== semanticSnapshot.subjectId ||
			request.subjectId !== moduleDependencyGraph.subjectId ||
			request.subjectId !== callGraph.subjectId ||
			request.semanticSnapshotId !== semanticSnapshot.id ||
			request.semanticSnapshotId !== moduleDependencyGraph.semanticSnapshotId ||
			request.semanticSnapshotId !== callGraph.semanticSnapshotId
		)
			throw new CompositionFailure(
				'INPUT_IDENTITY_MISMATCH',
				'Request, snapshot, and both predecessor graphs must share exact subject and snapshot identities.',
				'BIND'
			);
		const expectedLayers = exactLayerReferences(inputs);
		if (canonicalSemanticJson(request.sourceLayers) !== canonicalSemanticJson(expectedLayers))
			throw new CompositionFailure(
				'LAYER_BINDING_INVALID',
				'Request sourceLayers do not exactly bind the supplied predecessor graph layers.',
				'BIND',
				'$.request.sourceLayers'
			);
		if (
			moduleDependencyGraph.semanticExtractionVersion !== semanticSnapshot.extractionVersion ||
			callGraph.semanticExtractionVersion !== semanticSnapshot.extractionVersion ||
			moduleDependencyGraph.semanticSchemaVersion !== semanticSnapshot.schemaVersion ||
			callGraph.semanticSchemaVersion !== semanticSnapshot.schemaVersion
		)
			throw new CompositionFailure(
				'INPUT_IDENTITY_MISMATCH',
				'Predecessor schema or extraction identities differ from the exact semantic snapshot.',
				'BIND'
			);
		progress.complete({ identities: 3, reconciledGraphs: 2, sourceLayers: 2 });

		progress.start('INPUT_BUDGET');
		const inputRecords =
			moduleDependencyGraph.nodes.length +
			moduleDependencyGraph.edges.length +
			callGraph.nodes.length +
			callGraph.edges.length;
		for (const [path, actual, maximum] of [
			[
				'maxModuleDependencyNodes',
				moduleDependencyGraph.nodes.length,
				request.budgets.maxModuleDependencyNodes
			],
			[
				'maxModuleDependencyEdges',
				moduleDependencyGraph.edges.length,
				request.budgets.maxModuleDependencyEdges
			],
			['maxCallNodes', callGraph.nodes.length, request.budgets.maxCallNodes],
			['maxCallEdges', callGraph.edges.length, request.budgets.maxCallEdges],
			['maxInputRecords', inputRecords, request.budgets.maxInputRecords]
		] as const)
			if (actual > maximum)
				throw new CompositionFailure(
					'BUDGET_EXCEEDED',
					`${path} exceeded: ${actual} > ${maximum}.`,
					'BIND',
					`$.request.budgets.${path}`
				);
		progress.complete({ inputRecords });

		progress.start('MODULE_DEPENDENCY_GRAPH_VALIDATE');
		const moduleValidation = validateModuleDependencyGraph(
			moduleDependencyGraph,
			semanticSnapshot,
			{ maxIssues: Math.min(request.budgets.maxDiagnostics, 100_000) }
		);
		if (moduleValidation.state !== 'VALID')
			throw new CompositionFailure(
				'MODULE_DEPENDENCY_GRAPH_INVALID',
				`Module-dependency predecessor is invalid (${validationSummary(moduleValidation.issues)}).`,
				'VALIDATE'
			);
		progress.complete({ issues: 0 });

		progress.start('CALL_GRAPH_VALIDATE');
		const callValidation = validateCallGraph(callGraph, semanticSnapshot, {
			maxIssues: Math.min(request.budgets.maxDiagnostics, 100_000)
		});
		if (callValidation.state !== 'VALID')
			throw new CompositionFailure(
				'CALL_GRAPH_INVALID',
				`Call predecessor is invalid (${validationSummary(callValidation.issues)}).`,
				'VALIDATE'
			);
		progress.complete({ issues: 0 });

		progress.start('SOURCE_OCCURRENCE_JOIN');
		const moduleSources = moduleDependencyGraph.nodes.filter(
			(node): node is ModuleDependencyGraphSourceNode => node.kind === 'SOURCE'
		);
		const callSources = callGraph.nodes.filter(
			(node): node is CallGraphSourceRegionNode => node.kind === 'SOURCE_REGION'
		);
		const eligible = moduleSources.length + callSources.length;
		if (eligible > request.budgets.maxEligibleSourceNodes)
			throw new CompositionFailure(
				'BUDGET_EXCEEDED',
				`maxEligibleSourceNodes exceeded: ${eligible} > ${request.budgets.maxEligibleSourceNodes}.`,
				'JOIN',
				'$.request.budgets.maxEligibleSourceNodes'
			);
		const traversalSteps = inputRecords + eligible;
		if (traversalSteps > request.budgets.maxTraversalSteps)
			throw new CompositionFailure(
				'BUDGET_EXCEEDED',
				`maxTraversalSteps exceeded: ${traversalSteps} > ${request.budgets.maxTraversalSteps}.`,
				'JOIN',
				'$.request.budgets.maxTraversalSteps'
			);
		const moduleBySource = uniqueBySourceId(moduleSources);
		const callBySource = uniqueBySourceId(callSources);
		const snapshotSources = new Map(
			[...semanticSnapshot.sources]
				.sort((left, right) => compareText(left.id, right.id))
				.map((source) => [source.id, source] as const)
		);
		const inputDigest = logicalGraphCompositionInputDigest(inputs);
		const compositionId = logicalGraphCompositionId({
			inputDigest,
			semanticSnapshotId: semanticSnapshot.id,
			subjectId: semanticSnapshot.subjectId
		});
		const sourceIds = [...snapshotSources.keys()].sort(compareText);
		if (sourceIds.length > request.budgets.maxLinks)
			throw new CompositionFailure(
				'BUDGET_EXCEEDED',
				`maxLinks exceeded: ${sourceIds.length} > ${request.budgets.maxLinks}.`,
				'JOIN',
				'$.request.budgets.maxLinks'
			);
		const crossLinks = sourceIds.map(
			(semanticSourceId, ordinal): LogicalGraphCompositionCrossLink => {
				const moduleNode = moduleBySource.get(semanticSourceId)!;
				const callNode = callBySource.get(semanticSourceId)!;
				const moduleIdentity = sourceIdentity(moduleNode);
				return {
					basis: 'EXACT_SEMANTIC_SOURCE_ID_WITH_COORDINATE_CONSISTENCY',
					callSourceRegion: {
						graphId: callGraph.id,
						kind: 'SOURCE_REGION',
						layerId: callGraph.layers[0].id,
						nodeId: callNode.id
					},
					id: logicalGraphCompositionCrossLinkId(compositionId, semanticSourceId),
					moduleDependencySource: {
						graphId: moduleDependencyGraph.id,
						kind: 'SOURCE',
						layerId: moduleDependencyGraph.layers[0].id,
						nodeId: moduleNode.id
					},
					ordinal,
					relationKind: 'SAME_SEMANTIC_SOURCE_OCCURRENCE',
					sourceIdentity: moduleIdentity
				};
			}
		);
		progress.complete({ crossLinks: crossLinks.length, eligibleSourceNodes: eligible });

		progress.start('POPULATION_RECONCILE');
		const coverage: LogicalGraphCompositionCoverage = {
			callEligibleSourceRegions: callSources.length,
			callInputEdges: callGraph.edges.length,
			callInputNodes: callGraph.nodes.length,
			callPopulationReconciles: true,
			chargedInputTraversalSteps: traversalSteps,
			conflictingSemanticSources: 0,
			crossLinks: crossLinks.length,
			exactSemanticSourceIdCandidates: snapshotSources.size,
			linkedSemanticSources: crossLinks.length,
			linkPopulationReconciles: true,
			moduleEligibleSourceNodes: moduleSources.length,
			moduleInputEdges: moduleDependencyGraph.edges.length,
			moduleInputNodes: moduleDependencyGraph.nodes.length,
			modulePopulationReconciles: true,
			sourceIdentityPopulationReconciles: true,
			unmatchedCallSources: 0,
			unmatchedModuleSources: 0
		};
		progress.complete({ conflicts: 0, unmatchedSources: 0 });

		progress.start('MATERIALIZE');
		const moduleLimitations = clonePlainData(moduleDependencyGraph.limitations);
		const callLimitations = clonePlainData(callGraph.limitations);
		const moduleBinding: LogicalGraphCompositionModuleDependencyLayerBinding = {
			compositionId,
			id: logicalGraphCompositionLayerId(compositionId, 'MODULE_DEPENDENCY'),
			ordinal: 0,
			role: 'MODULE_DEPENDENCY',
			sourceClosure: moduleDependencyGraph.coverage.closure,
			sourceCoverage: clonePlainData(moduleDependencyGraph.coverage),
			sourceEdgeIds: moduleDependencyGraph.edges.map((edge) => edge.id),
			sourceEpistemic: moduleDependencyGraph.epistemic,
			sourceGraph: clonePlainData(request.sourceLayers[0]),
			sourceHealth: moduleDependencyGraph.health,
			sourceLimitations: moduleLimitations,
			sourceNodeIds: moduleDependencyGraph.nodes.map((node) => node.id)
		};
		const callBinding: LogicalGraphCompositionCallLayerBinding = {
			compositionId,
			id: logicalGraphCompositionLayerId(compositionId, 'CALL'),
			ordinal: 1,
			role: 'CALL',
			sourceClosure: callGraph.coverage.closure,
			sourceCoverage: clonePlainData(callGraph.coverage),
			sourceEdgeIds: callGraph.edges.map((edge) => edge.id),
			sourceEpistemic: clonePlainData(callGraph.epistemic),
			sourceGraph: clonePlainData(request.sourceLayers[1]),
			sourceHealth: callGraph.health,
			sourceLimitations: callLimitations,
			sourceNodeIds: callGraph.nodes.map((node) => node.id)
		};
		const layers: LogicalGraphCompositionLayerBindings = [moduleBinding, callBinding];
		const inheritedLimitations = [
			...moduleLimitations.map((limitation, limitationOrdinal) => ({
				layerOrdinal: 0 as const,
				layerRole: 'MODULE_DEPENDENCY' as const,
				limitation,
				limitationOrdinal,
				sourceGraphId: moduleDependencyGraph.id
			})),
			...callLimitations.map((limitation, limitationOrdinal) => ({
				layerOrdinal: 1 as const,
				layerRole: 'CALL' as const,
				limitation,
				limitationOrdinal,
				sourceGraphId: callGraph.id
			}))
		];
		const outputRecords = 1 + 2 + inheritedLimitations.length + crossLinks.length;
		if (outputRecords > request.budgets.maxOutputRecords)
			throw new CompositionFailure(
				'BUDGET_EXCEEDED',
				`maxOutputRecords exceeded: ${outputRecords} > ${request.budgets.maxOutputRecords}.`,
				'MATERIALIZE',
				'$.request.budgets.maxOutputRecords'
			);
		progress.complete({ inheritedLimitations: inheritedLimitations.length, outputRecords });

		progress.start('SERIALIZE');
		const content = {
			authorityTransfer: LOGICAL_GRAPH_COMPOSITION_AUTHORITY_TRANSFER,
			budgets: clonePlainData(request.budgets),
			canonicalProfile: LOGICAL_GRAPH_COMPOSITION_CANONICAL_PROFILE,
			capability: LOGICAL_GRAPH_COMPOSITION_CAPABILITY,
			capabilityStatus: LOGICAL_GRAPH_COMPOSITION_CAPABILITY_STATUS,
			closure:
				moduleDependencyGraph.coverage.closure === 'CLOSED' &&
				callGraph.coverage.closure === 'CLOSED_WITHIN_DECLARED_METHOD'
					? ('CLOSED_WITHIN_SELECTED_CONTRIBUTING_LAYER_METHODS' as const)
					: ('OPEN' as const),
			compositionClosure: 'EXACT_FOR_SELECTED_VALIDATED_LAYERS_AND_MAPPING_RULE' as const,
			conflicts: [] as const,
			coverage,
			crossLinks,
			currentness: LOGICAL_GRAPH_COMPOSITION_CURRENTNESS,
			freshness: LOGICAL_GRAPH_COMPOSITION_FRESHNESS,
			fullJanCsaa007Conformance: LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_007_CONFORMANCE,
			fullJanCsaa008Conformance: LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_008_CONFORMANCE,
			fullJanCsaa009Conformance: LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_009_CONFORMANCE,
			gateEffect: LOGICAL_GRAPH_COMPOSITION_GATE_EFFECT,
			graphAuthority: LOGICAL_GRAPH_COMPOSITION_GRAPH_AUTHORITY,
			health: 'PARTIAL' as const,
			id: compositionId,
			inheritedLimitations,
			inputDigest,
			layers,
			method: LOGICAL_GRAPH_COMPOSITION_METHOD,
			nonclaims: LOGICAL_GRAPH_COMPOSITION_NONCLAIMS,
			operationVersion: LOGICAL_GRAPH_COMPOSITION_OPERATION_VERSION,
			resultCompleteness: 'COMPLETE_FOR_DECLARED_TWO_LAYER_REFERENCE_COMPOSITION' as const,
			schemaVersion: LOGICAL_GRAPH_COMPOSITION_SCHEMA_VERSION,
			selection: clonePlainData(LOGICAL_GRAPH_COMPOSITION_SELECTION),
			semanticSnapshotId: semanticSnapshot.id,
			sourceLayers: clonePlainData(request.sourceLayers),
			subjectId: semanticSnapshot.subjectId,
			truncation: { reason: null, state: 'NOT_TRUNCATED' as const },
			unmatchedSources: [] as const
		};
		const composition: LogicalGraphCompositionSnapshot = {
			...content,
			contentDigest: logicalGraphCompositionContentDigest(content)
		};
		progress.complete({ compositionRecords: outputRecords });

		progress.start('COMPOSITION_VALIDATE');
		const validation = validateConstructedLogicalGraphComposition(
			composition,
			inputs,
			inputDigest,
			{
				maxInputRecords: request.budgets.maxInputRecords,
				maxInputStringCharacters: request.budgets.maxInputStringCharacters,
				maxIssues: request.budgets.maxDiagnostics,
				maxRecords: request.budgets.maxInputRecords,
				maxStringCharacters: request.budgets.maxInputStringCharacters
			}
		);
		if (validation.state !== 'VALID')
			throw new CompositionFailure(
				'COMPOSITION_VALIDATION_FAILED',
				`Constructed composition failed independent validation (${validation.state}: ${validationSummary(validation.issues)}).`,
				'VALIDATE'
			);
		progress.complete({ issues: 0 });
		return progress.finish({ composition, diagnostics: [], outcome: 'partial' });
	} catch (error) {
		const failure =
			error instanceof CompositionFailure
				? error
				: new CompositionFailure(
						'INPUT_POPULATION_MISMATCH',
						error instanceof Error ? error.message : 'Logical graph composition failed closed.',
						'JOIN'
					);
		progress.fail({ diagnostics: 1 }, failure.code);
		return progress.finish(unavailable(failure.code, failure.message, failure.phase, failure.path));
	}
}
