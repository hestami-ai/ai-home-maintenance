import { createHash } from 'node:crypto';

import type { BuildCallGraphRequest, CallGraphSourceRegionNode } from '../contracts/call-graph.js';
import {
	CALL_GRAPH_OPERATION_VERSION,
	CALL_GRAPH_REQUEST_SCHEMA_VERSION
} from '../contracts/call-graph.js';
import type {
	BuildModuleDependencyGraphRequest,
	ModuleDependencyGraphSourceNode
} from '../contracts/graph.js';
import {
	MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
	MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION
} from '../contracts/graph.js';
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
	LOGICAL_GRAPH_COMPOSITION_REQUEST_SCHEMA_VERSION,
	LOGICAL_GRAPH_COMPOSITION_SCHEMA_VERSION,
	LOGICAL_GRAPH_COMPOSITION_SELECTION,
	type LogicalGraphCompositionCallLayerBinding,
	type LogicalGraphCompositionCoverage,
	type LogicalGraphCompositionCrossLink,
	type LogicalGraphCompositionInputs,
	type LogicalGraphCompositionLayerBindings,
	type LogicalGraphCompositionModuleDependencyLayerBinding,
	type LogicalGraphCompositionSnapshot,
	type LogicalGraphCompositionSourceIdentity,
	type LogicalGraphCompositionValidationIssue,
	type LogicalGraphCompositionValidationOptions,
	type LogicalGraphCompositionValidationResult
} from '../contracts/logical-graph-composition.js';
import { compareText } from '../inventory/canonical.js';
import { isProxyValue, isUnicodeScalarString } from '../semantic/canonical.js';
import { logicalGraphCompositionInputDigest } from './logical-graph-composition-canonical.js';
import { validateCallGraph } from './validate-call-graph.js';
import { validateModuleDependencyGraph } from './validate-graph.js';

interface ClosedOptions {
	readonly maxDepth: number;
	readonly maxInputRecords: number;
	readonly maxInputStringCharacters: number;
	readonly maxIssues: number;
	readonly maxRecords: number;
	readonly maxStringCharacters: number;
}

/**
 * Opaque same-process proof that the exact predecessor objects were validated.
 * This type is intentionally not exported from the package root.
 */
export interface LogicalGraphCompositionPrevalidatedPredecessorWitness {
	readonly __logicalGraphCompositionPrevalidatedPredecessorWitness: never;
}

/** Opaque first-stage proof that the exact module predecessor validated successfully. */
export interface LogicalGraphCompositionValidatedModulePredecessorWitness {
	readonly __logicalGraphCompositionValidatedModulePredecessorWitness: never;
}

export interface LogicalGraphCompositionPrevalidationIssue {
	readonly code: string;
	readonly message: string;
	readonly path: string;
}

export type LogicalGraphCompositionModulePrevalidationResult =
	| {
			readonly issues: readonly [];
			readonly state: 'VALID';
			readonly witness: LogicalGraphCompositionValidatedModulePredecessorWitness;
	  }
	| {
			readonly issues: readonly LogicalGraphCompositionPrevalidationIssue[];
			readonly state: 'BUDGET_EXHAUSTED' | 'INVALID';
	  };

export type LogicalGraphCompositionCallPrevalidationResult =
	| {
			readonly inputDigest: string;
			readonly issues: readonly [];
			readonly state: 'VALID';
			readonly witness: LogicalGraphCompositionPrevalidatedPredecessorWitness;
	  }
	| {
			readonly issues: readonly LogicalGraphCompositionPrevalidationIssue[];
			readonly state: 'BUDGET_EXHAUSTED' | 'INVALID';
	  };

interface ValidatedModulePredecessorWitnessState {
	readonly callGraph: LogicalGraphCompositionInputs['callGraph'];
	consumed: boolean;
	readonly inputs: LogicalGraphCompositionInputs;
	readonly maxIssues: number;
	readonly moduleDependencyGraph: LogicalGraphCompositionInputs['moduleDependencyGraph'];
	readonly request: LogicalGraphCompositionInputs['request'];
	readonly semanticSnapshot: LogicalGraphCompositionInputs['semanticSnapshot'];
}

interface PrevalidatedPredecessorWitnessState {
	readonly callGraph: LogicalGraphCompositionInputs['callGraph'];
	consumed: boolean;
	readonly inputDigest: string;
	readonly inputs: LogicalGraphCompositionInputs;
	readonly maxIssues: number;
	readonly moduleDependencyGraph: LogicalGraphCompositionInputs['moduleDependencyGraph'];
	readonly request: LogicalGraphCompositionInputs['request'];
	readonly semanticSnapshot: LogicalGraphCompositionInputs['semanticSnapshot'];
}

const DEFAULT_OPTIONS: ClosedOptions = {
	maxDepth: 128,
	maxInputRecords: 10_000_000,
	maxInputStringCharacters: 1_000_000_000,
	maxIssues: 1_000,
	maxRecords: 10_000_000,
	maxStringCharacters: 1_000_000_000
};

const SHA256 = /^[0-9a-f]{64}$/u;
const INDEPENDENT_ID_ALGORITHM_VERSION = '1';
const validatedModulePredecessorWitnesses = new WeakMap<
	object,
	ValidatedModulePredecessorWitnessState
>();
const prevalidatedPredecessorWitnesses = new WeakMap<object, PrevalidatedPredecessorWitnessState>();

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
const LAYER_REFERENCE_KEYS = [
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
const SNAPSHOT_KEYS = [
	'authorityTransfer',
	'budgets',
	'canonicalProfile',
	'capability',
	'capabilityStatus',
	'closure',
	'compositionClosure',
	'conflicts',
	'contentDigest',
	'coverage',
	'crossLinks',
	'currentness',
	'freshness',
	'fullJanCsaa007Conformance',
	'fullJanCsaa008Conformance',
	'fullJanCsaa009Conformance',
	'gateEffect',
	'graphAuthority',
	'health',
	'id',
	'inheritedLimitations',
	'inputDigest',
	'layers',
	'method',
	'nonclaims',
	'operationVersion',
	'resultCompleteness',
	'schemaVersion',
	'selection',
	'semanticSnapshotId',
	'sourceLayers',
	'subjectId',
	'truncation',
	'unmatchedSources'
] as const;

/** Separate canonical encoder used only by the independent validator identity path. */
function independentCanonicalJson(value: unknown): string {
	const active = new WeakSet<object>();
	const encode = (input: unknown): string => {
		if (input === null) return 'null';
		if (typeof input === 'string') return JSON.stringify(input);
		if (typeof input === 'boolean') return input ? 'true' : 'false';
		if (typeof input === 'number') return JSON.stringify(input);
		const container = input as object;
		if (active.has(container)) throw new TypeError('Canonical input must be acyclic.');
		active.add(container);
		try {
			if (Array.isArray(container)) {
				const length = Reflect.getOwnPropertyDescriptor(container, 'length')!.value as number;
				const members: string[] = [];
				for (let index = 0; index < length; index += 1)
					members.push(encode(Reflect.getOwnPropertyDescriptor(container, String(index))!.value));
				return `[${members.join(',')}]`;
			}
			const keys = Reflect.ownKeys(container) as string[];
			const members: string[] = [];
			keys.sort(compareText);
			for (const key of keys)
				members.push(
					`${JSON.stringify(key)}:${encode(Reflect.getOwnPropertyDescriptor(container, key)!.value)}`
				);
			return `{${members.join(',')}}`;
		} finally {
			active.delete(container);
		}
	};
	return encode(value);
}

function independentSha256(value: string): string {
	return createHash('sha256').update(value, 'utf8').digest('hex');
}

function independentIdentity<Kind extends string>(
	prefix: string,
	domain: string,
	preimage: unknown
): Kind {
	return `${prefix}-${independentSha256(
		`${domain}\0${INDEPENDENT_ID_ALGORITHM_VERSION}\0${independentCanonicalJson(preimage)}`
	)}` as Kind;
}

function independentInputDigest(inputs: LogicalGraphCompositionInputs): string {
	return independentSha256(
		independentCanonicalJson({
			callGraph: {
				canonicalProfile: inputs.callGraph.canonicalProfile,
				contentDigest: inputs.callGraph.contentDigest,
				graphInputDigest: inputs.callGraph.graphInputDigest,
				graphKind: inputs.callGraph.graphKind,
				id: inputs.callGraph.id,
				layerId: inputs.callGraph.layers[0].id,
				method: inputs.callGraph.method,
				operationVersion: inputs.callGraph.operationVersion,
				producer: inputs.callGraph.producer,
				schemaVersion: inputs.callGraph.schemaVersion,
				semanticExtractionVersion: inputs.callGraph.semanticExtractionVersion,
				semanticSchemaVersion: inputs.callGraph.semanticSchemaVersion,
				semanticSnapshotId: inputs.callGraph.semanticSnapshotId,
				subjectId: inputs.callGraph.subjectId
			},
			moduleDependencyGraph: {
				canonicalProfile: inputs.moduleDependencyGraph.canonicalProfile,
				contentDigest: inputs.moduleDependencyGraph.contentDigest,
				graphInputDigest: inputs.moduleDependencyGraph.graphInputDigest,
				graphKind: inputs.moduleDependencyGraph.graphKind,
				id: inputs.moduleDependencyGraph.id,
				layerId: inputs.moduleDependencyGraph.layers[0].id,
				method: inputs.moduleDependencyGraph.method,
				operationVersion: inputs.moduleDependencyGraph.operationVersion,
				producer: inputs.moduleDependencyGraph.producer,
				schemaVersion: inputs.moduleDependencyGraph.schemaVersion,
				semanticExtractionVersion: inputs.moduleDependencyGraph.semanticExtractionVersion,
				semanticSchemaVersion: inputs.moduleDependencyGraph.semanticSchemaVersion,
				semanticSnapshotId: inputs.moduleDependencyGraph.semanticSnapshotId,
				subjectId: inputs.moduleDependencyGraph.subjectId
			},
			request: inputs.request,
			semanticSnapshot: {
				extractionVersion: inputs.semanticSnapshot.extractionVersion,
				id: inputs.semanticSnapshot.id,
				schemaVersion: inputs.semanticSnapshot.schemaVersion,
				subjectId: inputs.semanticSnapshot.subjectId
			}
		})
	);
}

function independentCompositionId(input: {
	readonly inputDigest: string;
	readonly semanticSnapshotId: string;
	readonly subjectId: string;
}): LogicalGraphCompositionSnapshot['id'] {
	return independentIdentity<LogicalGraphCompositionSnapshot['id']>(
		'logical-graph-composition',
		'JAN-CSAA-LOGICAL-GRAPH-COMPOSITION',
		{
			canonicalProfile: LOGICAL_GRAPH_COMPOSITION_CANONICAL_PROFILE,
			inputDigest: input.inputDigest,
			method: LOGICAL_GRAPH_COMPOSITION_METHOD,
			operationVersion: LOGICAL_GRAPH_COMPOSITION_OPERATION_VERSION,
			schemaVersion: LOGICAL_GRAPH_COMPOSITION_SCHEMA_VERSION,
			semanticSnapshotId: input.semanticSnapshotId,
			subjectId: input.subjectId
		}
	);
}

function independentLayerId(
	compositionId: LogicalGraphCompositionSnapshot['id'],
	role: 'CALL' | 'MODULE_DEPENDENCY'
): LogicalGraphCompositionSnapshot['layers'][number]['id'] {
	return independentIdentity<LogicalGraphCompositionSnapshot['layers'][number]['id']>(
		'logical-graph-composition-layer',
		'JAN-CSAA-LOGICAL-GRAPH-COMPOSITION-LAYER',
		{ compositionId, role }
	);
}

function independentCrossLinkId(
	compositionId: LogicalGraphCompositionSnapshot['id'],
	semanticSourceId: string
): LogicalGraphCompositionCrossLink['id'] {
	return independentIdentity<LogicalGraphCompositionCrossLink['id']>(
		'logical-graph-composition-link',
		'JAN-CSAA-LOGICAL-GRAPH-COMPOSITION-LINK',
		{ compositionId, relationKind: 'SAME_SEMANTIC_SOURCE_OCCURRENCE', semanticSourceId }
	);
}

function independentContentDigest(
	composition:
		LogicalGraphCompositionSnapshot | Omit<LogicalGraphCompositionSnapshot, 'contentDigest'>
): string {
	const content: Record<string, unknown> = {};
	for (const key of Reflect.ownKeys(composition)) {
		if (typeof key !== 'string' || key === 'contentDigest') continue;
		content[key] = Reflect.getOwnPropertyDescriptor(composition, key)!.value;
	}
	return independentSha256(independentCanonicalJson(content));
}

function issue(
	code: LogicalGraphCompositionValidationIssue['code'],
	message: string,
	path = '$'
): LogicalGraphCompositionValidationIssue {
	return { code, message, path };
}

function invalid(
	problem: LogicalGraphCompositionValidationIssue
): LogicalGraphCompositionValidationResult {
	return {
		issues: [problem],
		state: problem.code === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INVALID'
	};
}

function plainRecord(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxyValue(value))
		return false;
	const prototype = Reflect.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function safePositive(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function safeNonnegative(value: unknown): value is number {
	return (
		typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0)
	);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
	const keys = Reflect.ownKeys(value);
	return (
		keys.length === expected.length &&
		keys.every((key) => typeof key === 'string' && expected.includes(key)) &&
		keys.every((key) => {
			const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
			return descriptor !== undefined && descriptor.enumerable && 'value' in descriptor;
		})
	);
}

function closeOptions(
	value: LogicalGraphCompositionValidationOptions | undefined
): ClosedOptions | null {
	if (value === undefined) return DEFAULT_OPTIONS;
	if (!plainRecord(value)) return null;
	const allowed = new Set([
		'maxDepth',
		'maxInputRecords',
		'maxInputStringCharacters',
		'maxIssues',
		'maxRecords',
		'maxStringCharacters'
	]);
	if (Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !allowed.has(key)))
		return null;
	const result: Record<string, number> = { ...DEFAULT_OPTIONS };
	for (const key of allowed) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined) continue;
		if (!descriptor.enumerable || !('value' in descriptor) || !safePositive(descriptor.value))
			return null;
		result[key] = descriptor.value;
	}
	if (result.maxIssues! > 100_000) return null;
	return result as unknown as ClosedOptions;
}

type TreeLimits = Pick<ClosedOptions, 'maxDepth' | 'maxRecords' | 'maxStringCharacters'>;

interface TreeWalkCounters {
	characters: number;
	records: number;
}

type TreeVisitFrame = {
	readonly depth: number;
	readonly path: string;
	readonly state: 'VISIT';
	readonly value: unknown;
};

type TreeFrame = TreeVisitFrame | { readonly state: 'LEAVE'; readonly value: object };

/** Decides whether a string leaf is admissible, charging it to the character budget. */
function treeStringIssue(
	text: string,
	path: string,
	limits: TreeLimits,
	counters: TreeWalkCounters
): LogicalGraphCompositionValidationIssue | null {
	if (!isUnicodeScalarString(text))
		return issue('SHAPE_INVALID', 'Strings must contain Unicode scalar text.', path);
	counters.characters += text.length;
	if (counters.characters > limits.maxStringCharacters)
		return issue('BUDGET_EXHAUSTED', 'The descriptor string-character budget was exhausted.', path);
	return null;
}

/** Decides whether a non-null value is a directly acceptable scalar leaf. */
function isImmediateTreeScalar(value: unknown): boolean {
	return (
		typeof value === 'boolean' ||
		(typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0))
	);
}

/** Decides whether a container may be traversed at all. */
function treeContainerIssue(
	container: object,
	path: string,
	active: WeakSet<object>
): LogicalGraphCompositionValidationIssue | null {
	if (isProxyValue(container))
		return issue('SHAPE_INVALID', 'Proxy values are not accepted.', path);
	if (active.has(container)) return issue('SHAPE_INVALID', 'Cyclic data is not accepted.', path);
	const array = Array.isArray(container);
	const prototype = Reflect.getPrototypeOf(container);
	if (
		(array && prototype !== Array.prototype) ||
		(!array && prototype !== Object.prototype && prototype !== null)
	)
		return issue('SHAPE_INVALID', 'Containers must have ordinary prototypes.', path);
	return null;
}

/** Charges every own property key of a container to the character budget. */
function treeKeyCharacterIssue(
	keys: readonly PropertyKey[],
	array: boolean,
	path: string,
	limits: TreeLimits,
	counters: TreeWalkCounters
): LogicalGraphCompositionValidationIssue | null {
	for (const key of keys) {
		if (typeof key !== 'string' || (array && key === 'length')) continue;
		counters.characters += key.length;
		if (counters.characters > limits.maxStringCharacters)
			return issue(
				'BUDGET_EXHAUSTED',
				'The descriptor string-character budget was exhausted by a property key.',
				path
			);
	}
	return null;
}

/** Decides whether an array carries exactly its dense index keys and nothing else. */
function denseArrayIssue(
	keys: readonly PropertyKey[],
	length: number,
	path: string
): LogicalGraphCompositionValidationIssue | null {
	if (keys.length !== length + 1)
		return issue('SHAPE_INVALID', 'Arrays must be dense ordinary arrays.', path);
	if (
		keys.some((key) => {
			if (typeof key !== 'string') return true;
			if (key === 'length') return false;
			if (!/^(0|[1-9]\d*)$/u.test(key)) return true;
			const numericIndex = Number(key);
			return (
				!Number.isSafeInteger(numericIndex) ||
				numericIndex < 0 ||
				numericIndex >= length ||
				String(numericIndex) !== key
			);
		})
	)
		return issue('SHAPE_INVALID', 'Arrays must be dense without extra properties.', path);
	return null;
}

/** Enqueues one VISIT frame per child in reverse key order so children are popped in key order. */
function pushChildFramesIssue(
	frame: TreeVisitFrame,
	container: object,
	keys: readonly PropertyKey[],
	array: boolean,
	pending: TreeFrame[]
): LogicalGraphCompositionValidationIssue | null {
	for (let index = keys.length - 1; index >= 0; index -= 1) {
		const key = keys[index] as string;
		if (!isUnicodeScalarString(key))
			return issue('SHAPE_INVALID', 'Property keys must contain Unicode scalar text.', frame.path);
		if (array && key === 'length') continue;
		const descriptor = Reflect.getOwnPropertyDescriptor(container, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			return issue(
				'SHAPE_INVALID',
				'Properties must be enumerable data properties.',
				`${frame.path}.${key}`
			);
		pending.push({
			depth: frame.depth + 1,
			path: array ? `${frame.path}[${key}]` : `${frame.path}.${key}`,
			state: 'VISIT',
			value: descriptor.value
		});
	}
	return null;
}

/** Charges a container's population, marks it active, and enqueues its children. */
function traverseContainerIssue(
	frame: TreeVisitFrame,
	container: object,
	limits: TreeLimits,
	counters: TreeWalkCounters,
	active: WeakSet<object>,
	pending: TreeFrame[]
): LogicalGraphCompositionValidationIssue | null {
	const array = Array.isArray(container);
	let arrayLength: number | null = null;
	let keys: readonly PropertyKey[];
	if (array) {
		arrayLength = Reflect.getOwnPropertyDescriptor(container, 'length')!.value as number;
		if (arrayLength > limits.maxRecords - counters.records)
			return issue(
				'BUDGET_EXHAUSTED',
				'The descriptor record budget was exhausted by an array population.',
				frame.path
			);
		keys = Reflect.ownKeys(container);
	} else keys = Reflect.ownKeys(container);
	if (keys.some((key) => typeof key !== 'string'))
		return issue('SHAPE_INVALID', 'Symbol keys are not accepted.', frame.path);
	const keyCharacterIssue = treeKeyCharacterIssue(keys, array, frame.path, limits, counters);
	if (keyCharacterIssue !== null) return keyCharacterIssue;
	if (array) {
		const arrayIssue = denseArrayIssue(keys, arrayLength!, frame.path);
		if (arrayIssue !== null) return arrayIssue;
	}
	if (!array && keys.length > limits.maxRecords - counters.records)
		return issue(
			'BUDGET_EXHAUSTED',
			'The descriptor record budget was exhausted by a property population.',
			frame.path
		);
	active.add(container);
	pending.push({ state: 'LEAVE', value: container });
	return pushChildFramesIssue(frame, container, keys, array, pending);
}

/** Decides one pending VISIT frame, charging budgets and enqueueing any children. */
function visitFrameIssue(
	frame: TreeVisitFrame,
	limits: TreeLimits,
	counters: TreeWalkCounters,
	active: WeakSet<object>,
	pending: TreeFrame[]
): LogicalGraphCompositionValidationIssue | null {
	counters.records += 1;
	if (counters.records > limits.maxRecords)
		return issue('BUDGET_EXHAUSTED', 'The descriptor record budget was exhausted.', frame.path);
	if (frame.depth > limits.maxDepth)
		return issue('BUDGET_EXHAUSTED', 'The descriptor depth budget was exhausted.', frame.path);
	if (typeof frame.value === 'string')
		return treeStringIssue(frame.value, frame.path, limits, counters);
	if (frame.value === null || isImmediateTreeScalar(frame.value)) return null;
	if (typeof frame.value !== 'object')
		return issue('SHAPE_INVALID', 'Only JSON-compatible data values are accepted.', frame.path);
	const containerIssue = treeContainerIssue(frame.value, frame.path, active);
	if (containerIssue !== null) return containerIssue;
	return traverseContainerIssue(frame, frame.value, limits, counters, active, pending);
}

/** Descriptor-only traversal: no getter, iterator, toJSON, or user callback can run. */
function plainTreeIssue(
	value: unknown,
	limits: TreeLimits,
	rootPath: string
): LogicalGraphCompositionValidationIssue | null {
	const pending: TreeFrame[] = [{ depth: 0, path: rootPath, state: 'VISIT', value }];
	const active = new WeakSet<object>();
	const counters: TreeWalkCounters = { characters: 0, records: 0 };
	while (pending.length > 0) {
		const frame = pending.pop()!;
		if (frame.state === 'LEAVE') {
			active.delete(frame.value);
			continue;
		}
		const frameIssue = visitFrameIssue(frame, limits, counters, active, pending);
		if (frameIssue !== null) return frameIssue;
	}
	return null;
}

function inputShellIssue(value: unknown): LogicalGraphCompositionValidationIssue | null {
	if (!plainRecord(value) || !exactKeys(value, INPUT_KEYS))
		return issue(
			'INPUT_INVALID',
			'The composition input wrapper must be exact plain data.',
			'$inputs'
		);
	for (const key of [
		'callGraph',
		'moduleDependencyGraph',
		'request',
		'semanticSnapshot'
	] as const) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key)!;
		if (!plainRecord(descriptor.value))
			return issue('INPUT_INVALID', `${key} must be a plain data record.`, `$inputs.${key}`);
	}
	return null;
}

function requestIssue(
	inputs: LogicalGraphCompositionInputs
): LogicalGraphCompositionValidationIssue | null {
	const { request } = inputs;
	if (
		!plainRecord(request) ||
		!exactKeys(request, REQUEST_KEYS) ||
		!plainRecord(request.budgets) ||
		!exactKeys(request.budgets, BUDGET_KEYS) ||
		!plainRecord(request.selection) ||
		!exactKeys(request.selection, SELECTION_KEYS) ||
		!Array.isArray(request.selection.consistencyFields) ||
		!Array.isArray(request.selection.layerOrder) ||
		!Array.isArray(request.sourceLayers) ||
		request.sourceLayers.length !== 2 ||
		request.sourceLayers.some(
			(layer) => !plainRecord(layer) || !exactKeys(layer, LAYER_REFERENCE_KEYS)
		)
	)
		return issue('INPUT_INVALID', 'The composition request shell is not exact.', '$inputs.request');
	if (
		BUDGET_KEYS.some((key) => !safeNonnegative(request.budgets[key])) ||
		!safePositive(request.budgets.maxDiagnostics) ||
		!safePositive(request.budgets.maxInputRecords) ||
		!safePositive(request.budgets.maxInputStringCharacters) ||
		request.budgets.maxConflictRecords !== 0 ||
		request.budgets.maxUnmatchedRecords !== 0 ||
		request.budgets.maxDiagnostics > 100_000 ||
		request.schemaVersion !== LOGICAL_GRAPH_COMPOSITION_REQUEST_SCHEMA_VERSION ||
		request.operationVersion !== LOGICAL_GRAPH_COMPOSITION_OPERATION_VERSION ||
		independentCanonicalJson(request.selection) !==
			independentCanonicalJson(LOGICAL_GRAPH_COMPOSITION_SELECTION)
	)
		return issue('INPUT_INVALID', 'Request constants or budgets are invalid.', '$inputs.request');
	if (
		typeof request.subjectId !== 'string' ||
		request.subjectId.length === 0 ||
		typeof request.semanticSnapshotId !== 'string' ||
		request.semanticSnapshotId.length === 0 ||
		request.sourceLayers[0]?.role !== 'MODULE_DEPENDENCY' ||
		request.sourceLayers[0].ordinal !== 0 ||
		request.sourceLayers[1]?.role !== 'CALL' ||
		request.sourceLayers[1].ordinal !== 1
	)
		return issue(
			'INPUT_INVALID',
			'Request identities or layer order are invalid.',
			'$inputs.request'
		);
	return null;
}

function prevalidationInvalid(
	message: string,
	path = '$prevalidatedPredecessors'
): {
	readonly issues: readonly LogicalGraphCompositionPrevalidationIssue[];
	readonly state: 'INVALID';
} {
	return { issues: [{ code: 'PREVALIDATION_INVALID', message, path }], state: 'INVALID' };
}

/**
 * Validates the exact module predecessor and issues an opaque first-stage witness only on VALID.
 * This function is intentionally not exported from the package root.
 */
export function validateAndIssueLogicalGraphCompositionModulePredecessorWitness(
	inputs: LogicalGraphCompositionInputs,
	maxIssues: number
): LogicalGraphCompositionModulePrevalidationResult {
	try {
		if (
			arguments.length !== 2 ||
			inputShellIssue(inputs) !== null ||
			requestIssue(inputs) !== null ||
			!safePositive(maxIssues) ||
			maxIssues > 100_000 ||
			maxIssues !== Math.min(inputs.request.budgets.maxDiagnostics, 100_000)
		)
			return prevalidationInvalid('Module-predecessor witness arguments are invalid.');
		const validation = validateModuleDependencyGraph(
			inputs.moduleDependencyGraph,
			inputs.semanticSnapshot,
			{ maxIssues }
		);
		if (validation.state !== 'VALID') return validation;
		const witness = Object.freeze(
			Object.create(null)
		) as LogicalGraphCompositionValidatedModulePredecessorWitness;
		validatedModulePredecessorWitnesses.set(witness, {
			callGraph: inputs.callGraph,
			consumed: false,
			inputs,
			maxIssues,
			moduleDependencyGraph: inputs.moduleDependencyGraph,
			request: inputs.request,
			semanticSnapshot: inputs.semanticSnapshot
		});
		return { issues: [], state: 'VALID', witness };
	} catch {
		return prevalidationInvalid('Module-predecessor validation failed closed on hostile input.');
	}
}

/** Consumes the module-stage witness only after every exact binding matches. */
function takeValidatedModulePredecessorWitness(
	witness: LogicalGraphCompositionValidatedModulePredecessorWitness,
	inputs: LogicalGraphCompositionInputs,
	maxIssues: number
): boolean {
	if (witness === null || typeof witness !== 'object') return false;
	const state = validatedModulePredecessorWitnesses.get(witness);
	if (
		state === undefined ||
		state.consumed ||
		state.inputs !== inputs ||
		state.request !== inputs.request ||
		state.moduleDependencyGraph !== inputs.moduleDependencyGraph ||
		state.callGraph !== inputs.callGraph ||
		state.semanticSnapshot !== inputs.semanticSnapshot ||
		state.maxIssues !== maxIssues
	)
		return false;
	state.consumed = true;
	return true;
}

/**
 * Consumes an exact module-stage witness, validates the call predecessor, computes the exact
 * composition input digest, and issues the combined single-use witness only on VALID.
 *
 * @internal Between the two synchronous stages, callers must not await, expose the detached
 * materialized inputs to a callback, or mutate any bound object. The package root does not export
 * this trust-bound operation.
 */
export function validateAndIssueLogicalGraphCompositionCallPredecessorWitness(
	inputs: LogicalGraphCompositionInputs,
	moduleWitness: LogicalGraphCompositionValidatedModulePredecessorWitness,
	maxIssues: number
): LogicalGraphCompositionCallPrevalidationResult {
	try {
		if (
			arguments.length !== 3 ||
			inputShellIssue(inputs) !== null ||
			requestIssue(inputs) !== null ||
			!safePositive(maxIssues) ||
			maxIssues > 100_000 ||
			maxIssues !== Math.min(inputs.request.budgets.maxDiagnostics, 100_000)
		)
			return prevalidationInvalid('Call-predecessor witness arguments are invalid.');
		if (!takeValidatedModulePredecessorWitness(moduleWitness, inputs, maxIssues))
			return prevalidationInvalid(
				'The module-predecessor witness is invalid for these exact inputs.',
				'$validatedModulePredecessor'
			);
		const validation = validateCallGraph(inputs.callGraph, inputs.semanticSnapshot, { maxIssues });
		if (validation.state !== 'VALID') return validation;
		const inputDigest = logicalGraphCompositionInputDigest(inputs);
		const witness = Object.freeze(
			Object.create(null)
		) as LogicalGraphCompositionPrevalidatedPredecessorWitness;
		prevalidatedPredecessorWitnesses.set(witness, {
			callGraph: inputs.callGraph,
			consumed: false,
			inputDigest,
			inputs,
			maxIssues,
			moduleDependencyGraph: inputs.moduleDependencyGraph,
			request: inputs.request,
			semanticSnapshot: inputs.semanticSnapshot
		});
		return { inputDigest, issues: [], state: 'VALID', witness };
	} catch {
		return prevalidationInvalid('Call-predecessor validation failed closed on hostile input.');
	}
}

/** Consumes a witness only after every exact-object and effective-budget binding matches. */
function takePrevalidatedPredecessorWitness(
	witness: LogicalGraphCompositionPrevalidatedPredecessorWitness,
	inputs: LogicalGraphCompositionInputs,
	inputDigest: string,
	maxIssues: number
): boolean {
	if (witness === null || typeof witness !== 'object') return false;
	const state = prevalidatedPredecessorWitnesses.get(witness);
	if (
		state === undefined ||
		state.consumed ||
		state.inputs !== inputs ||
		state.request !== inputs.request ||
		state.moduleDependencyGraph !== inputs.moduleDependencyGraph ||
		state.callGraph !== inputs.callGraph ||
		state.semanticSnapshot !== inputs.semanticSnapshot ||
		state.inputDigest !== inputDigest ||
		state.maxIssues !== maxIssues
	)
		return false;
	state.consumed = true;
	return true;
}

function operationBudgetIssue(
	inputs: LogicalGraphCompositionInputs
): LogicalGraphCompositionValidationIssue | null {
	const { callGraph, moduleDependencyGraph, request, semanticSnapshot } = inputs;
	for (const [value, path] of [
		[moduleDependencyGraph.nodes, '$inputs.moduleDependencyGraph.nodes'],
		[moduleDependencyGraph.edges, '$inputs.moduleDependencyGraph.edges'],
		[moduleDependencyGraph.layers, '$inputs.moduleDependencyGraph.layers'],
		[moduleDependencyGraph.limitations, '$inputs.moduleDependencyGraph.limitations'],
		[callGraph.nodes, '$inputs.callGraph.nodes'],
		[callGraph.edges, '$inputs.callGraph.edges'],
		[callGraph.layers, '$inputs.callGraph.layers'],
		[callGraph.limitations, '$inputs.callGraph.limitations'],
		[semanticSnapshot.sources, '$inputs.semanticSnapshot.sources']
	] as const)
		if (!Array.isArray(value))
			return issue('INPUT_INVALID', 'A predecessor population is invalid.', path);
	if (
		moduleDependencyGraph.layers.length < 1 ||
		callGraph.layers.length < 1 ||
		!plainRecord(moduleDependencyGraph.layers[0]) ||
		!plainRecord(callGraph.layers[0])
	)
		return issue(
			'INPUT_INVALID',
			'Each predecessor must expose its contributing layer.',
			'$inputs'
		);

	const moduleSources = moduleDependencyGraph.nodes.reduce(
		(count, node) => count + (plainRecord(node) && node.kind === 'SOURCE' ? 1 : 0),
		0
	);
	const callSources = callGraph.nodes.reduce(
		(count, node) => count + (plainRecord(node) && node.kind === 'SOURCE_REGION' ? 1 : 0),
		0
	);
	const inputRecords =
		moduleDependencyGraph.nodes.length +
		moduleDependencyGraph.edges.length +
		callGraph.nodes.length +
		callGraph.edges.length;
	const eligibleSources = moduleSources + callSources;
	const traversalSteps = inputRecords + eligibleSources;
	const outputRecords =
		1 +
		2 +
		moduleDependencyGraph.limitations.length +
		callGraph.limitations.length +
		semanticSnapshot.sources.length;
	for (const [actual, maximum, path] of [
		[
			moduleDependencyGraph.nodes.length,
			request.budgets.maxModuleDependencyNodes,
			'$inputs.request.budgets.maxModuleDependencyNodes'
		],
		[
			moduleDependencyGraph.edges.length,
			request.budgets.maxModuleDependencyEdges,
			'$inputs.request.budgets.maxModuleDependencyEdges'
		],
		[callGraph.nodes.length, request.budgets.maxCallNodes, '$inputs.request.budgets.maxCallNodes'],
		[callGraph.edges.length, request.budgets.maxCallEdges, '$inputs.request.budgets.maxCallEdges'],
		[inputRecords, request.budgets.maxInputRecords, '$inputs.request.budgets.maxInputRecords'],
		[
			eligibleSources,
			request.budgets.maxEligibleSourceNodes,
			'$inputs.request.budgets.maxEligibleSourceNodes'
		],
		[
			traversalSteps,
			request.budgets.maxTraversalSteps,
			'$inputs.request.budgets.maxTraversalSteps'
		],
		[semanticSnapshot.sources.length, request.budgets.maxLinks, '$inputs.request.budgets.maxLinks'],
		[outputRecords, request.budgets.maxOutputRecords, '$inputs.request.budgets.maxOutputRecords']
	] as const)
		if (actual > maximum)
			return issue('BUDGET_EXHAUSTED', 'A composition operation budget was exhausted.', path);
	return null;
}

function inputBindingIssue(
	inputs: LogicalGraphCompositionInputs
): LogicalGraphCompositionValidationIssue | null {
	const { callGraph, moduleDependencyGraph, request, semanticSnapshot } = inputs;
	const moduleRequest: BuildModuleDependencyGraphRequest = {
		operationVersion: MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
		schemaVersion: MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: semanticSnapshot.id,
		subjectId: semanticSnapshot.subjectId
	};
	const callRequest: BuildCallGraphRequest = {
		operationVersion: CALL_GRAPH_OPERATION_VERSION,
		schemaVersion: CALL_GRAPH_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: semanticSnapshot.id,
		subjectId: semanticSnapshot.subjectId
	};
	if (
		request.subjectId !== semanticSnapshot.subjectId ||
		request.subjectId !== moduleDependencyGraph.subjectId ||
		request.subjectId !== callGraph.subjectId ||
		request.semanticSnapshotId !== semanticSnapshot.id ||
		request.semanticSnapshotId !== moduleDependencyGraph.semanticSnapshotId ||
		request.semanticSnapshotId !== callGraph.semanticSnapshotId ||
		moduleDependencyGraph.semanticExtractionVersion !== semanticSnapshot.extractionVersion ||
		callGraph.semanticExtractionVersion !== semanticSnapshot.extractionVersion ||
		moduleDependencyGraph.semanticSchemaVersion !== semanticSnapshot.schemaVersion ||
		callGraph.semanticSchemaVersion !== semanticSnapshot.schemaVersion ||
		moduleRequest.semanticSnapshotId !== moduleDependencyGraph.semanticSnapshotId ||
		moduleRequest.subjectId !== moduleDependencyGraph.subjectId ||
		callRequest.semanticSnapshotId !== callGraph.semanticSnapshotId ||
		callRequest.subjectId !== callGraph.subjectId
	)
		return issue(
			'INPUT_INVALID',
			'The request, semantic snapshot, and predecessor identities are incompatible.',
			'$inputs'
		);
	const expectedSourceLayers = sourceLayerReferences(inputs);
	if (
		independentCanonicalJson(request.sourceLayers) !==
		independentCanonicalJson(expectedSourceLayers)
	)
		return issue(
			'INPUT_INVALID',
			'The request does not exactly bind both predecessor layers.',
			'$inputs.request.sourceLayers'
		);
	return null;
}

function sourceLayerReferences(
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
			producer: moduleDependencyGraph.producer,
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
			producer: callGraph.producer,
			role: 'CALL',
			schemaVersion: callGraph.schemaVersion,
			semanticExtractionVersion: callGraph.semanticExtractionVersion,
			semanticSchemaVersion: callGraph.semanticSchemaVersion,
			semanticSnapshotId: callGraph.semanticSnapshotId,
			subjectId: callGraph.subjectId
		}
	];
}

type IndependentDerivation =
	| { readonly message: string; readonly path: string; readonly state: 'INVALID' }
	| { readonly composition: LogicalGraphCompositionSnapshot; readonly state: 'VALID' };

function deriveComposition(
	inputs: LogicalGraphCompositionInputs,
	knownInputDigest?: string
): IndependentDerivation {
	const { callGraph, moduleDependencyGraph, request, semanticSnapshot } = inputs;
	const expectedSourceLayers = sourceLayerReferences(inputs);

	const moduleSources = moduleDependencyGraph.nodes.filter(
		(node): node is ModuleDependencyGraphSourceNode => node.kind === 'SOURCE'
	);
	const callSources = callGraph.nodes.filter(
		(node): node is CallGraphSourceRegionNode => node.kind === 'SOURCE_REGION'
	);
	const inputRecords =
		moduleDependencyGraph.nodes.length +
		moduleDependencyGraph.edges.length +
		callGraph.nodes.length +
		callGraph.edges.length;
	const eligibleSources = moduleSources.length + callSources.length;
	const traversalSteps = inputRecords + eligibleSources;

	const moduleBySource = new Map<string, ModuleDependencyGraphSourceNode>(
		[...moduleSources]
			.sort(
				(left, right) =>
					compareText(left.semanticSourceId, right.semanticSourceId) ||
					compareText(left.id, right.id)
			)
			.map((node) => [node.semanticSourceId, node])
	);
	const callBySource = new Map<string, CallGraphSourceRegionNode>(
		[...callSources]
			.sort(
				(left, right) =>
					compareText(left.semanticSourceId, right.semanticSourceId) ||
					compareText(left.id, right.id)
			)
			.map((node) => [node.semanticSourceId, node])
	);
	const semanticSources = new Map(
		[...semanticSnapshot.sources]
			.sort((left, right) => compareText(left.id, right.id))
			.map((source) => [source.id, source] as const)
	);
	const recomputedInputDigest = independentInputDigest(inputs);
	if (knownInputDigest !== undefined && knownInputDigest !== recomputedInputDigest)
		return {
			message: 'The known input digest does not reproduce from the exact inputs.',
			path: '$validationInput.inputDigest',
			state: 'INVALID'
		};
	const inputDigest = recomputedInputDigest;
	const compositionId = independentCompositionId({
		inputDigest,
		semanticSnapshotId: semanticSnapshot.id,
		subjectId: semanticSnapshot.subjectId
	});
	const sourceIds = [...semanticSources.keys()].sort(compareText);
	const crossLinks: LogicalGraphCompositionCrossLink[] = [];
	for (const semanticSourceId of sourceIds) {
		const semanticSource = semanticSources.get(semanticSourceId)!;
		const moduleNode = moduleBySource.get(semanticSourceId)!;
		const callNode = callBySource.get(semanticSourceId)!;
		const expectedIdentity: LogicalGraphCompositionSourceIdentity = {
			analysisDisposition: semanticSource.analysisDisposition,
			logicalPath: semanticSource.logicalPath,
			programId: semanticSource.programId,
			projectId: semanticSource.projectId,
			semanticSourceId: semanticSource.id
		};
		crossLinks.push({
			basis: 'EXACT_SEMANTIC_SOURCE_ID_WITH_COORDINATE_CONSISTENCY',
			callSourceRegion: {
				graphId: callGraph.id,
				kind: 'SOURCE_REGION',
				layerId: callGraph.layers[0].id,
				nodeId: callNode.id
			},
			id: independentCrossLinkId(compositionId, semanticSourceId),
			moduleDependencySource: {
				graphId: moduleDependencyGraph.id,
				kind: 'SOURCE',
				layerId: moduleDependencyGraph.layers[0].id,
				nodeId: moduleNode.id
			},
			ordinal: crossLinks.length,
			relationKind: 'SAME_SEMANTIC_SOURCE_OCCURRENCE',
			sourceIdentity: expectedIdentity
		});
	}

	const coverage: LogicalGraphCompositionCoverage = {
		callEligibleSourceRegions: callSources.length,
		callInputEdges: callGraph.edges.length,
		callInputNodes: callGraph.nodes.length,
		callPopulationReconciles: true,
		chargedInputTraversalSteps: traversalSteps,
		conflictingSemanticSources: 0,
		crossLinks: crossLinks.length,
		exactSemanticSourceIdCandidates: semanticSources.size,
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
	const moduleBinding: LogicalGraphCompositionModuleDependencyLayerBinding = {
		compositionId,
		id: independentLayerId(compositionId, 'MODULE_DEPENDENCY'),
		ordinal: 0,
		role: 'MODULE_DEPENDENCY',
		sourceClosure: moduleDependencyGraph.coverage.closure,
		sourceCoverage: moduleDependencyGraph.coverage,
		sourceEdgeIds: moduleDependencyGraph.edges.map((edge) => edge.id),
		sourceEpistemic: moduleDependencyGraph.epistemic,
		sourceGraph: expectedSourceLayers[0],
		sourceHealth: moduleDependencyGraph.health,
		sourceLimitations: moduleDependencyGraph.limitations,
		sourceNodeIds: moduleDependencyGraph.nodes.map((node) => node.id)
	};
	const callBinding: LogicalGraphCompositionCallLayerBinding = {
		compositionId,
		id: independentLayerId(compositionId, 'CALL'),
		ordinal: 1,
		role: 'CALL',
		sourceClosure: callGraph.coverage.closure,
		sourceCoverage: callGraph.coverage,
		sourceEdgeIds: callGraph.edges.map((edge) => edge.id),
		sourceEpistemic: callGraph.epistemic,
		sourceGraph: expectedSourceLayers[1],
		sourceHealth: callGraph.health,
		sourceLimitations: callGraph.limitations,
		sourceNodeIds: callGraph.nodes.map((node) => node.id)
	};
	const layers: LogicalGraphCompositionLayerBindings = [moduleBinding, callBinding];
	const inheritedLimitations = [
		...moduleDependencyGraph.limitations.map((limitation, limitationOrdinal) => ({
			layerOrdinal: 0 as const,
			layerRole: 'MODULE_DEPENDENCY' as const,
			limitation,
			limitationOrdinal,
			sourceGraphId: moduleDependencyGraph.id
		})),
		...callGraph.limitations.map((limitation, limitationOrdinal) => ({
			layerOrdinal: 1 as const,
			layerRole: 'CALL' as const,
			limitation,
			limitationOrdinal,
			sourceGraphId: callGraph.id
		}))
	];
	const content = {
		authorityTransfer: LOGICAL_GRAPH_COMPOSITION_AUTHORITY_TRANSFER,
		budgets: request.budgets,
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
		selection: LOGICAL_GRAPH_COMPOSITION_SELECTION,
		semanticSnapshotId: semanticSnapshot.id,
		sourceLayers: expectedSourceLayers,
		subjectId: semanticSnapshot.subjectId,
		truncation: { reason: null, state: 'NOT_TRUNCATED' as const },
		unmatchedSources: [] as const
	};
	return {
		composition: { ...content, contentDigest: independentContentDigest(content) },
		state: 'VALID'
	};
}

/** Re-codes an input-wrapper tree issue as an input issue unless it is a budget exhaustion. */
function inputWrapperTreeIssue(
	inputsValue: unknown,
	limits: TreeLimits
): LogicalGraphCompositionValidationIssue | null {
	const treeIssue = plainTreeIssue(inputsValue, limits, '$inputs');
	if (treeIssue === null) return null;
	return treeIssue.code === 'BUDGET_EXHAUSTED'
		? treeIssue
		: { ...treeIssue, code: 'INPUT_INVALID' };
}

/** Decides whether both predecessor graphs are independently valid, module-dependency first. */
function predecessorValidationIssue(
	inputs: LogicalGraphCompositionInputs,
	maxIssues: number
): LogicalGraphCompositionValidationIssue | null {
	const moduleValidation = validateModuleDependencyGraph(
		inputs.moduleDependencyGraph,
		inputs.semanticSnapshot,
		{ maxIssues }
	);
	if (moduleValidation.state !== 'VALID')
		return issue(
			'INPUT_INVALID',
			'The module-dependency predecessor is not independently valid.',
			'$inputs.moduleDependencyGraph'
		);
	const callValidation = validateCallGraph(inputs.callGraph, inputs.semanticSnapshot, {
		maxIssues
	});
	if (callValidation.state !== 'VALID')
		return issue(
			'INPUT_INVALID',
			'The call predecessor is not independently valid.',
			'$inputs.callGraph'
		);
	return null;
}

/** Decides whether the candidate reproduces the independently derived composition exactly. */
function candidateAgreementIssue(
	candidate: LogicalGraphCompositionSnapshot,
	expected: LogicalGraphCompositionSnapshot
): LogicalGraphCompositionValidationIssue | null {
	if (candidate.inputDigest !== expected.inputDigest || candidate.id !== expected.id)
		return issue('IDENTITY_MISMATCH', 'The composition identity does not reproduce.', '$.id');
	if (candidate.contentDigest !== independentContentDigest(candidate))
		return issue(
			'CONTENT_DIGEST_MISMATCH',
			'The composition content digest is invalid.',
			'$.contentDigest'
		);
	if (independentCanonicalJson(candidate) !== independentCanonicalJson(expected))
		return issue(
			'POPULATION_MISMATCH',
			'The candidate differs from the independently derived logical graph composition.'
		);
	return null;
}

function validateInternal(
	value: unknown,
	inputsValue: unknown,
	options: LogicalGraphCompositionValidationOptions | undefined,
	knownInputDigest?: string,
	prevalidatedPredecessorWitness?: LogicalGraphCompositionPrevalidatedPredecessorWitness,
	predecessorsPrevalidated = false
): LogicalGraphCompositionValidationResult {
	const limits = closeOptions(options);
	if (limits === null)
		return invalid(issue('SHAPE_INVALID', 'Validation options are invalid.', '$options'));
	const candidateTreeIssue = plainTreeIssue(value, limits, '$');
	if (candidateTreeIssue !== null) return invalid(candidateTreeIssue);
	if (!plainRecord(value) || !exactKeys(value, SNAPSHOT_KEYS))
		return invalid(
			issue('SHAPE_INVALID', 'The logical graph composition snapshot shell must be exact.')
		);
	const shellIssue = inputShellIssue(inputsValue);
	if (shellIssue !== null) return invalid(shellIssue);

	// Inspect the entire wrapper under caller limits before reading even the nested request budgets.
	const broadInputTreeIssue = inputWrapperTreeIssue(inputsValue, {
		maxDepth: limits.maxDepth,
		maxRecords: limits.maxInputRecords,
		maxStringCharacters: limits.maxInputStringCharacters
	});
	if (broadInputTreeIssue !== null) return invalid(broadInputTreeIssue);
	const inputs = inputsValue as LogicalGraphCompositionInputs;
	const closedRequestIssue = requestIssue(inputs);
	if (closedRequestIssue !== null) return invalid(closedRequestIssue);

	// The request may impose tighter limits than the caller; it independently constrains the
	// complete graph, semantic-snapshot, and request tree before any predecessor validator runs.
	const inputLimits = {
		maxDepth: limits.maxDepth,
		maxRecords: Math.min(limits.maxInputRecords, inputs.request.budgets.maxInputRecords),
		maxStringCharacters: Math.min(
			limits.maxInputStringCharacters,
			inputs.request.budgets.maxInputStringCharacters
		)
	};
	if (
		inputLimits.maxRecords !== limits.maxInputRecords ||
		inputLimits.maxStringCharacters !== limits.maxInputStringCharacters
	) {
		const inputTreeIssue = inputWrapperTreeIssue(inputsValue, inputLimits);
		if (inputTreeIssue !== null) return invalid(inputTreeIssue);
	}
	const budgetIssue = operationBudgetIssue(inputs);
	if (budgetIssue !== null) return invalid(budgetIssue);
	const bindingIssue = inputBindingIssue(inputs);
	if (bindingIssue !== null) return invalid(bindingIssue);
	const maxIssues = Math.min(limits.maxIssues, inputs.request.budgets.maxDiagnostics, 100_000);
	if (predecessorsPrevalidated) {
		if (
			knownInputDigest === undefined ||
			prevalidatedPredecessorWitness === undefined ||
			!takePrevalidatedPredecessorWitness(
				prevalidatedPredecessorWitness,
				inputs,
				knownInputDigest,
				maxIssues
			)
		)
			return invalid(
				issue(
					'SHAPE_INVALID',
					'The prevalidated predecessor witness is invalid for these exact inputs.',
					'$prevalidatedPredecessors'
				)
			);
	} else {
		const predecessorIssue = predecessorValidationIssue(inputs, maxIssues);
		if (predecessorIssue !== null) return invalid(predecessorIssue);
	}
	const expected = deriveComposition(inputs, knownInputDigest);
	if (expected.state === 'INVALID')
		return invalid(issue('INPUT_INVALID', expected.message, expected.path));
	const candidate = value as unknown as LogicalGraphCompositionSnapshot;
	const agreementIssue = candidateAgreementIssue(candidate, expected.composition);
	if (agreementIssue !== null) return invalid(agreementIssue);
	return { issues: [], state: 'VALID' };
}

export function validateLogicalGraphComposition(
	value: unknown,
	inputs: LogicalGraphCompositionInputs,
	options?: LogicalGraphCompositionValidationOptions
): LogicalGraphCompositionValidationResult {
	if (arguments.length < 2 || arguments.length > 3)
		return invalid(
			issue('SHAPE_INVALID', 'The validator requires exactly two or three arguments.', '$arguments')
		);
	try {
		return validateInternal(value, inputs, options);
	} catch {
		return invalid(
			issue('SHAPE_INVALID', 'Logical graph composition validation failed closed on hostile input.')
		);
	}
}

/**
 * Producer-internal fast path. The known digest must be computed from the same
 * immutable-in-practice inputs immediately before synchronous construction.
 * Public validation always recomputes the exact input digest.
 */
export function validateConstructedLogicalGraphComposition(
	value: unknown,
	inputs: LogicalGraphCompositionInputs,
	knownInputDigest: string,
	options?: LogicalGraphCompositionValidationOptions
): LogicalGraphCompositionValidationResult {
	if (arguments.length < 3 || arguments.length > 4)
		return invalid(
			issue(
				'SHAPE_INVALID',
				'The constructed validator requires three or four arguments.',
				'$arguments'
			)
		);
	if (typeof knownInputDigest !== 'string' || !SHA256.test(knownInputDigest))
		return invalid(
			issue(
				'SHAPE_INVALID',
				'The known input digest must be lowercase SHA-256.',
				'$validationInput.inputDigest'
			)
		);
	try {
		return validateInternal(value, inputs, options, knownInputDigest);
	} catch {
		return invalid(
			issue('SHAPE_INVALID', 'Constructed logical graph composition validation failed closed.')
		);
	}
}

/**
 * Producer-internal single-use path that skips only repeated predecessor validation.
 * All candidate, input-tree, budget, binding, independent-derivation, identity, digest, and
 * population checks remain active. This function is intentionally not exported from the package root.
 */
export function validateConstructedLogicalGraphCompositionWithPrevalidatedPredecessors(
	value: unknown,
	inputs: LogicalGraphCompositionInputs,
	knownInputDigest: string,
	witness: LogicalGraphCompositionPrevalidatedPredecessorWitness,
	options?: LogicalGraphCompositionValidationOptions
): LogicalGraphCompositionValidationResult {
	if (arguments.length < 4 || arguments.length > 5)
		return invalid(
			issue(
				'SHAPE_INVALID',
				'The prevalidated constructed validator requires four or five arguments.',
				'$arguments'
			)
		);
	if (typeof knownInputDigest !== 'string' || !SHA256.test(knownInputDigest))
		return invalid(
			issue(
				'SHAPE_INVALID',
				'The known input digest must be lowercase SHA-256.',
				'$validationInput.inputDigest'
			)
		);
	try {
		return validateInternal(value, inputs, options, knownInputDigest, witness, true);
	} catch {
		return invalid(
			issue(
				'SHAPE_INVALID',
				'Prevalidated constructed logical graph composition validation failed closed.'
			)
		);
	}
}
