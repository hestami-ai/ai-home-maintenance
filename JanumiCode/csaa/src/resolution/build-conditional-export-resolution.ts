import { isProxy } from 'node:util/types';
import { TextDecoder } from 'node:util';

import ts from 'typescript';

import {
	CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY,
	CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY_TRANSFER,
	CONDITIONAL_EXPORT_RESOLUTION_CANONICAL_PROFILE,
	CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY,
	CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY_STATUS,
	CONDITIONAL_EXPORT_RESOLUTION_CURRENTNESS,
	CONDITIONAL_EXPORT_RESOLUTION_FRESHNESS,
	CONDITIONAL_EXPORT_RESOLUTION_FULL_JAN_CSAA_012_CONFORMANCE,
	CONDITIONAL_EXPORT_RESOLUTION_GATE_EFFECT,
	CONDITIONAL_EXPORT_RESOLUTION_METHOD,
	CONDITIONAL_EXPORT_RESOLUTION_NONCLAIMS,
	CONDITIONAL_EXPORT_RESOLUTION_OPERATION_VERSION,
	CONDITIONAL_EXPORT_RESOLUTION_PROGRESS_SCHEMA_VERSION,
	CONDITIONAL_EXPORT_RESOLUTION_REQUEST_SCHEMA_VERSION,
	CONDITIONAL_EXPORT_RESOLUTION_SCHEMA_VERSION,
	CONDITIONAL_EXPORT_RESOLUTION_SELECTION,
	type BuildConditionalExportResolutionOptions,
	type ConditionalExportBranchRecord,
	type ConditionalExportConsumerEnvironment,
	type ConditionalExportDecisionRecord,
	type ConditionalExportExactKeyOutcome,
	type ConditionalExportFrontierRecord,
	type ConditionalExportFrontierReason,
	type ConditionalExportManifestSourceSpan,
	type ConditionalExportManifestWitness,
	type ConditionalExportResolutionBuildInputs,
	type ConditionalExportResolutionBuildOutcome,
	type ConditionalExportResolutionCoverage,
	type ConditionalExportResolutionDiagnostic,
	type ConditionalExportResolutionProgressEvent,
	type ConditionalExportResolutionProgressPhase,
	type ConditionalExportResolutionRequest,
	type ConditionalExportResolutionSnapshot
} from '../contracts/conditional-export-resolution.js';
import {
	PROJECT_CONTEXT_GRAPH_REQUEST_SCHEMA_VERSION,
	type ProjectContextGraphBuildInputs
} from '../contracts/project-context-graph.js';
import { compareText, sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson, isUnicodeScalarString } from '../semantic/canonical.js';
import { isFrozenSubjectCapability, readFrozenSubjectArtifact } from '../subject/frozen-store.js';
import { validateProjectContextGraph } from '../graph/validate-project-context-graph.js';
import {
	conditionalExportBranchId,
	conditionalExportDecisionId,
	conditionalExportFrontierId,
	conditionalExportResolutionContentDigest,
	conditionalExportResolutionId,
	conditionalExportResolutionInputDigest,
	type ConditionalExportResolutionContent
} from './conditional-export-resolution-canonical.js';
import { validateConstructedConditionalExportResolution } from './validate-conditional-export-resolution.js';

const INPUT_KEYS = ['frozenSubject', 'projectContextGraph', 'request', 'semanticSnapshot'] as const;
const REQUEST_KEYS = [
	'budgets',
	'conditions',
	'consumer',
	'exportSubpath',
	'manifestPath',
	'moduleMode',
	'operationVersion',
	'packageName',
	'platform',
	'projectContextGraph',
	'schemaVersion',
	'selection',
	'semanticSnapshotId',
	'subjectId'
] as const;
const BUDGET_KEYS = [
	'maxAstNodes',
	'maxBranches',
	'maxConditionChecks',
	'maxDiagnostics',
	'maxFrontiers',
	'maxInputRecords',
	'maxInputStringCharacters',
	'maxManifestBytes',
	'maxOutputRecords',
	'maxTraversalSteps'
] as const;
const ZERO_CAPACITY_BUDGET_KEYS = new Set<(typeof BUDGET_KEYS)[number]>([
	'maxBranches',
	'maxConditionChecks',
	'maxFrontiers'
]);
const CONSUMER_KEYS = [
	'projectContextProgramId',
	'projectContextSourceId',
	'semanticProgramId',
	'semanticSourceId'
] as const;
const PROJECT_CONTEXT_REFERENCE_KEYS = ['contentDigest', 'graphId', 'inputDigest'] as const;
const SELECTION_KEYS = [
	'branchOrder',
	'conditionActivation',
	'conditionKeyNumericPropertyPolicy',
	'conditionPriority',
	'defaultCondition',
	'effectiveConditionOrder',
	'explicitConditions',
	'exportMap',
	'exportSubpath',
	'exportSubpathSyntax',
	'leafKinds',
	'manifestSource',
	'packagePopulation',
	'reservedExplicitConditions',
	'sourceSpanPolicy',
	'targetSyntax',
	'unsupportedTreatment'
] as const;
const RESERVED_EXPLICIT_CONDITIONS = new Set(['default', 'import', 'node', 'require']);
const SHA256 = /^[a-f0-9]{64}$/u;

interface PlainDataUsage {
	readonly records: number;
	readonly stringCharacters: number;
}

interface TelemetryRecorder {
	complete(counts?: Readonly<Record<string, number>>, detailCode?: string | null): void;
	fail(counts?: Readonly<Record<string, number>>, detailCode?: string | null): void;
	finish<Outcome extends ConditionalExportResolutionBuildOutcome>(outcome: Outcome): Outcome;
	start(
		phase: ConditionalExportResolutionProgressPhase,
		counts?: Readonly<Record<string, number>>
	): void;
}

class ConditionalExportFailure extends Error {
	constructor(
		readonly code: ConditionalExportResolutionDiagnostic['code'],
		message: string,
		readonly phase: ConditionalExportResolutionDiagnostic['phase'],
		readonly path: string | null = null
	) {
		super(message);
	}
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
	const ownKeys = Reflect.ownKeys(value);
	if (
		ownKeys.length !== keys.length ||
		ownKeys.some((key) => typeof key !== 'string' || !keys.includes(key))
	)
		throw new TypeError(`${path} field population is not exact.`);
	for (const key of keys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new TypeError(`${path}.${key} must be an enumerable data property.`);
	}
	return value as Record<string, unknown>;
}

function shallowPlainRecord(value: unknown, path: string): Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		throw new TypeError(`${path} must be a plain data record.`);
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new TypeError(`${path} must have a plain prototype.`);
	return value as Record<string, unknown>;
}

function assertOrdinaryArray(value: unknown, path: string): asserts value is unknown[] {
	if (!Array.isArray(value) || isProxy(value) || Reflect.getPrototypeOf(value) !== Array.prototype)
		throw new TypeError(`${path} must be an exact ordinary array.`);
}

function preflightLimits(value: unknown): {
	readonly maxInputRecords: number;
	readonly maxInputStringCharacters: number;
} {
	const inputs = exactPlainRecord(value, INPUT_KEYS, '$inputs');
	const request = exactPlainRecord(inputs.request, REQUEST_KEYS, '$inputs.request');
	const budgets = exactPlainRecord(request.budgets, BUDGET_KEYS, '$inputs.request.budgets');
	for (const key of ['maxInputRecords', 'maxInputStringCharacters'] as const)
		if (!Number.isSafeInteger(budgets[key]) || (budgets[key] as number) < 1)
			throw new TypeError(`$inputs.request.budgets.${key} must be a positive safe integer.`);
	return {
		maxInputRecords: budgets.maxInputRecords as number,
		maxInputStringCharacters: budgets.maxInputStringCharacters as number
	};
}

type PreflightWork =
	| { readonly kind: 'LEAVE'; readonly value: object }
	| { readonly kind: 'VISIT'; readonly value: unknown };

interface PreflightLimits {
	readonly maxInputRecords: number;
	readonly maxInputStringCharacters: number;
}

function chargePreflightRecord(records: number, limits: PreflightLimits): number {
	const total = records + 1;
	if (total > limits.maxInputRecords)
		throw new ConditionalExportFailure(
			'BUDGET_EXCEEDED',
			`Input plain-data record budget exceeded: ${total} > ${limits.maxInputRecords}.`,
			'REQUEST',
			'$.request.budgets.maxInputRecords'
		);
	return total;
}

function chargePreflightString(
	text: string,
	stringCharacters: number,
	limits: PreflightLimits
): number {
	if (!isUnicodeScalarString(text))
		throw new TypeError('Input strings must contain Unicode scalar text.');
	const total = stringCharacters + text.length;
	if (total > limits.maxInputStringCharacters)
		throw new ConditionalExportFailure(
			'BUDGET_EXCEEDED',
			`Input string-character budget exceeded: ${total} > ${limits.maxInputStringCharacters}.`,
			'REQUEST',
			'$.request.budgets.maxInputStringCharacters'
		);
	return total;
}

function isInertPreflightScalar(value: unknown): boolean {
	return (
		typeof value === 'boolean' ||
		(typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0))
	);
}

function chargePreflightArrayKeys(
	ownKeys: readonly string[],
	stringCharacters: number,
	limits: PreflightLimits
): number {
	let total = stringCharacters;
	for (const key of ownKeys) {
		if (key === 'length') continue;
		total += key.length;
		if (total > limits.maxInputStringCharacters)
			throw new ConditionalExportFailure(
				'BUDGET_EXCEEDED',
				'Input string-character budget exceeded by an array key.',
				'REQUEST',
				'$.request.budgets.maxInputStringCharacters'
			);
		if (!isUnicodeScalarString(key))
			throw new TypeError('Input array keys must contain Unicode scalar text.');
	}
	return total;
}

function pushPreflightArrayElements(
	array: readonly unknown[],
	count: number,
	pending: PreflightWork[]
): void {
	for (let index = count - 1; index >= 0; index -= 1) {
		const descriptor = Reflect.getOwnPropertyDescriptor(array, String(index));
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new TypeError('Input arrays must contain enumerable data elements.');
		pending.push({ kind: 'VISIT', value: descriptor.value });
	}
}

function expandArrayPreflightWork(
	array: readonly unknown[],
	pending: PreflightWork[],
	records: number,
	stringCharacters: number,
	limits: PreflightLimits
): number {
	if (Reflect.getPrototypeOf(array) !== Array.prototype)
		throw new TypeError('Input arrays must use Array.prototype.');
	const count = array.length;
	const ownKeys = Reflect.ownKeys(array);
	if (ownKeys.some((key) => typeof key !== 'string'))
		throw new TypeError('Input arrays may not contain symbol keys.');
	const total = chargePreflightArrayKeys(ownKeys as string[], stringCharacters, limits);
	if (
		ownKeys.length !== count + 1 ||
		(ownKeys as string[]).some((key) => key !== 'length' && !/^(?:0|[1-9]\d*)$/u.test(key))
	)
		throw new TypeError('Input arrays must be dense exact data arrays.');
	if (records + count > limits.maxInputRecords)
		throw new ConditionalExportFailure(
			'BUDGET_EXCEEDED',
			'Input array population exceeds the plain-data record budget.',
			'REQUEST',
			'$.request.budgets.maxInputRecords'
		);
	pushPreflightArrayElements(array, count, pending);
	return total;
}

function expandRecordPreflightWork(
	record: object,
	pending: PreflightWork[],
	records: number,
	stringCharacters: number,
	limits: PreflightLimits
): number {
	const prototype = Reflect.getPrototypeOf(record);
	if (prototype !== Object.prototype && prototype !== null)
		throw new TypeError('Input records must use a plain prototype.');
	const ownKeys = Reflect.ownKeys(record);
	if (ownKeys.some((key) => typeof key !== 'string'))
		throw new TypeError('Input records may not contain symbol keys.');
	if (records + ownKeys.length > limits.maxInputRecords)
		throw new ConditionalExportFailure(
			'BUDGET_EXCEEDED',
			'Input property population exceeds the plain-data record budget.',
			'REQUEST',
			'$.request.budgets.maxInputRecords'
		);
	let total = stringCharacters;
	for (const key of [...(ownKeys as string[])].reverse()) {
		total += key.length;
		if (total > limits.maxInputStringCharacters)
			throw new ConditionalExportFailure(
				'BUDGET_EXCEEDED',
				'Input string-character budget exceeded by a record key.',
				'REQUEST',
				'$.request.budgets.maxInputStringCharacters'
			);
		if (!isUnicodeScalarString(key))
			throw new TypeError('Input record keys must contain Unicode scalar text.');
		const descriptor = Reflect.getOwnPropertyDescriptor(record, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new TypeError('Input records must contain enumerable data properties.');
		pending.push({ kind: 'VISIT', value: descriptor.value });
	}
	return total;
}

function expandContainerPreflightWork(
	container: object,
	pending: PreflightWork[],
	records: number,
	stringCharacters: number,
	limits: PreflightLimits
): number {
	return Array.isArray(container)
		? expandArrayPreflightWork(container, pending, records, stringCharacters, limits)
		: expandRecordPreflightWork(container, pending, records, stringCharacters, limits);
}

function preflightPlainData(
	value: unknown,
	limits: { readonly maxInputRecords: number; readonly maxInputStringCharacters: number }
): PlainDataUsage {
	const pending: PreflightWork[] = [{ kind: 'VISIT', value }];
	const active = new WeakSet<object>();
	let records = 0;
	let stringCharacters = 0;
	while (pending.length > 0) {
		const work = pending.pop()!;
		if (work.kind === 'LEAVE') {
			active.delete(work.value);
			continue;
		}
		records = chargePreflightRecord(records, limits);
		if (typeof work.value === 'string') {
			stringCharacters = chargePreflightString(work.value, stringCharacters, limits);
			continue;
		}
		if (work.value === null || isInertPreflightScalar(work.value)) continue;
		if (typeof work.value !== 'object' || isProxy(work.value))
			throw new TypeError('Input must contain only inert JSON-compatible plain data.');
		if (active.has(work.value)) throw new TypeError('Input plain data may not contain cycles.');
		active.add(work.value);
		pending.push({ kind: 'LEAVE', value: work.value });
		stringCharacters = expandContainerPreflightWork(
			work.value,
			pending,
			records,
			stringCharacters,
			limits
		);
	}
	return { records, stringCharacters };
}

function exactJson(value: unknown, expected: unknown, path: string): void {
	if (canonicalSemanticJson(value) !== canonicalSemanticJson(expected))
		throw new TypeError(`${path} does not match the exact supported value.`);
}

function nonemptyScalarText(value: unknown, path: string): asserts value is string {
	if (typeof value !== 'string' || value.length === 0 || !isUnicodeScalarString(value))
		throw new TypeError(`${path} must be nonempty Unicode scalar text.`);
}

function safeSlashPath(value: string, allowDotRoot: boolean): boolean {
	if (allowDotRoot && value === '.') return true;
	if (!value.startsWith('./') || /[\\%?#*]/u.test(value)) return false;
	const segments = value.slice(2).split('/');
	if (segments.length === 0) return false;
	return segments.every(
		(segment) =>
			segment !== '' &&
			segment !== '.' &&
			segment !== '..' &&
			!/^\x6e\x6f\x64\x65\x5f\x6d\x6f\x64\x75\x6c\x65\x73$/i.test(segment)
	);
}

function isNumericConditionPropertyName(value: string): boolean {
	const numeric = Number(value);
	return String(numeric) === value && numeric >= 0 && numeric < 4_294_967_295;
}

function assertRequestBudgets(budgets: Record<string, unknown>): void {
	for (const key of BUDGET_KEYS) {
		const minimum = ZERO_CAPACITY_BUDGET_KEYS.has(key) ? 0 : 1;
		const budget = budgets[key];
		if (!Number.isSafeInteger(budget) || Object.is(budget, -0) || (budget as number) < minimum)
			throw new TypeError(
				`$inputs.request.budgets.${key} must be a ${minimum === 0 ? 'nonnegative' : 'positive'} safe integer.`
			);
	}
	if ((budgets.maxDiagnostics as number) > 100_000)
		throw new TypeError('$inputs.request.budgets.maxDiagnostics may not exceed 100000.');
}

function assertRequestScalars(request: Record<string, unknown>): void {
	for (const key of [
		'exportSubpath',
		'manifestPath',
		'operationVersion',
		'packageName',
		'schemaVersion',
		'semanticSnapshotId',
		'subjectId'
	] as const)
		nonemptyScalarText(request[key], `$inputs.request.${key}`);
	if (request.schemaVersion !== CONDITIONAL_EXPORT_RESOLUTION_REQUEST_SCHEMA_VERSION)
		throw new TypeError('Unsupported conditional-export request schema version.');
	if (request.operationVersion !== CONDITIONAL_EXPORT_RESOLUTION_OPERATION_VERSION)
		throw new TypeError('Unsupported conditional-export operation version.');
	if (request.moduleMode !== 'IMPORT' && request.moduleMode !== 'REQUIRE')
		throw new TypeError('$inputs.request.moduleMode is unsupported.');
	if (request.platform !== 'NEUTRAL' && request.platform !== 'NODE')
		throw new TypeError('$inputs.request.platform is unsupported.');
	if (!safeSlashPath(request.exportSubpath as string, true))
		throw new TypeError('$inputs.request.exportSubpath is outside the exact safe subpath syntax.');
	if (
		(request.manifestPath as string).startsWith('/') ||
		(request.manifestPath as string).includes('\\') ||
		(request.manifestPath as string)
			.split('/')
			.some((segment) => segment === '' || segment === '.' || segment === '..')
	)
		throw new TypeError('$inputs.request.manifestPath must be a canonical relative path.');
	if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/iu.test(request.packageName as string))
		throw new TypeError('$inputs.request.packageName is invalid.');
}

function assertExplicitConditions(conditions: readonly unknown[]): void {
	const conditionSet = new Set<string>();
	for (let index = 0; index < conditions.length; index += 1) {
		const condition = conditions[index];
		nonemptyScalarText(condition, `$inputs.request.conditions[${index}]`);
		if (isNumericConditionPropertyName(condition))
			throw new TypeError('Explicit conditions may not be canonical numeric property names.');
		if (RESERVED_EXPLICIT_CONDITIONS.has(condition) || conditionSet.has(condition))
			throw new TypeError('Explicit conditions must be unique and may not use reserved names.');
		conditionSet.add(condition);
	}
}

function assertContextReferenceDigests(contextReference: Record<string, unknown>): void {
	for (const key of PROJECT_CONTEXT_REFERENCE_KEYS)
		nonemptyScalarText(contextReference[key], `$inputs.request.projectContextGraph.${key}`);
	for (const key of ['contentDigest', 'inputDigest'] as const)
		if (!SHA256.test(contextReference[key] as string))
			throw new TypeError(`$inputs.request.projectContextGraph.${key} must be lowercase SHA-256.`);
}

function assertInputCollections(inputs: Record<string, unknown>): void {
	const frozenSubject = shallowPlainRecord(inputs.frozenSubject, '$inputs.frozenSubject');
	const semanticSnapshot = shallowPlainRecord(inputs.semanticSnapshot, '$inputs.semanticSnapshot');
	const projectContextGraph = shallowPlainRecord(
		inputs.projectContextGraph,
		'$inputs.projectContextGraph'
	);
	for (const [path, record, keys] of [
		['$inputs.frozenSubject', frozenSubject, ['artifacts', 'projects', 'workspaces']],
		['$inputs.semanticSnapshot', semanticSnapshot, ['programs', 'projects', 'sources']],
		['$inputs.projectContextGraph', projectContextGraph, ['programs', 'projects', 'sources']]
	] as const)
		for (const key of keys) assertOrdinaryArray(record[key], `${path}.${key}`);
}

function materializeInputs(value: unknown): ConditionalExportResolutionBuildInputs {
	const inputs = exactPlainRecord(value, INPUT_KEYS, '$inputs');
	const request = exactPlainRecord(inputs.request, REQUEST_KEYS, '$inputs.request');
	const budgets = exactPlainRecord(request.budgets, BUDGET_KEYS, '$inputs.request.budgets');
	assertRequestBudgets(budgets);
	assertRequestScalars(request);
	const conditions = request.conditions;
	assertOrdinaryArray(conditions, '$inputs.request.conditions');
	assertExplicitConditions(conditions);
	const consumer = exactPlainRecord(request.consumer, CONSUMER_KEYS, '$inputs.request.consumer');
	for (const key of CONSUMER_KEYS)
		nonemptyScalarText(consumer[key], `$inputs.request.consumer.${key}`);
	const contextReference = exactPlainRecord(
		request.projectContextGraph,
		PROJECT_CONTEXT_REFERENCE_KEYS,
		'$inputs.request.projectContextGraph'
	);
	assertContextReferenceDigests(contextReference);
	const selection = exactPlainRecord(
		request.selection,
		SELECTION_KEYS,
		'$inputs.request.selection'
	);
	assertOrdinaryArray(selection.leafKinds, '$inputs.request.selection.leafKinds');
	exactJson(selection, CONDITIONAL_EXPORT_RESOLUTION_SELECTION, '$inputs.request.selection');
	assertInputCollections(inputs);
	return {
		frozenSubject: inputs.frozenSubject as ConditionalExportResolutionBuildInputs['frozenSubject'],
		projectContextGraph:
			inputs.projectContextGraph as ConditionalExportResolutionBuildInputs['projectContextGraph'],
		request: {
			...(request as unknown as ConditionalExportResolutionRequest),
			budgets: { ...(budgets as unknown as ConditionalExportResolutionRequest['budgets']) },
			conditions: [...(conditions as string[])],
			consumer: {
				...(consumer as unknown as ConditionalExportResolutionRequest['consumer'])
			},
			projectContextGraph: {
				...(contextReference as unknown as ConditionalExportResolutionRequest['projectContextGraph'])
			},
			selection: CONDITIONAL_EXPORT_RESOLUTION_SELECTION
		},
		semanticSnapshot:
			inputs.semanticSnapshot as ConditionalExportResolutionBuildInputs['semanticSnapshot']
	};
}

function clonePlainData<Value>(value: Value, seen = new WeakMap<object, unknown>()): Value {
	if (value === null || typeof value !== 'object') return value;
	const object = value as object;
	const prior = seen.get(object);
	if (prior !== undefined) return prior as Value;
	if (Array.isArray(value)) {
		const result: unknown[] = [];
		seen.set(object, result);
		for (const child of value) result.push(clonePlainData(child, seen));
		return result as Value;
	}
	const result: Record<string, unknown> = {};
	seen.set(object, result);
	for (const key of Object.keys(object)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(object, key);
		if (descriptor === undefined || !('value' in descriptor)) continue;
		Object.defineProperty(result, key, {
			configurable: true,
			enumerable: true,
			value: clonePlainData(descriptor.value, seen),
			writable: true
		});
	}
	return result as Value;
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

function boundedCounts(counts: Readonly<Record<string, number>>): Readonly<Record<string, number>> {
	const result: Record<string, number> = {};
	for (const key of Object.keys(counts).sort(compareText).slice(0, 16)) {
		const value = counts[key];
		if (Number.isSafeInteger(value) && value! >= 0) result[key] = value!;
	}
	return Object.freeze(result);
}

function telemetry(
	options: BuildConditionalExportResolutionOptions | undefined
): TelemetryRecorder {
	let sink: ((event: ConditionalExportResolutionProgressEvent) => void) | undefined;
	try {
		if (options !== undefined) {
			const record = exactPlainRecord(options, ['onProgress'], '$options');
			if (typeof record.onProgress === 'function')
				sink = record.onProgress as (event: ConditionalExportResolutionProgressEvent) => void;
		}
	} catch {
		// Telemetry is out of band and never changes evidence or outcome.
	}
	const events: ConditionalExportResolutionProgressEvent[] = [];
	let active: ConditionalExportResolutionProgressPhase | null = null;
	let sequence = 0;
	const emit = (
		phase: ConditionalExportResolutionProgressPhase,
		state: ConditionalExportResolutionProgressEvent['state'],
		counts: Readonly<Record<string, number>>,
		detailCode: string | null
	): void => {
		events.push(
			Object.freeze({
				counts: boundedCounts(counts),
				detailCode,
				phase,
				schemaVersion: CONDITIONAL_EXPORT_RESOLUTION_PROGRESS_SCHEMA_VERSION,
				sequence: sequence++,
				state
			})
		);
	};
	const close = (
		state: ConditionalExportResolutionProgressEvent['state'],
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
		finish<Outcome extends ConditionalExportResolutionBuildOutcome>(outcome: Outcome): Outcome {
			if (active !== null) close('FAILED', { interrupted: 1 }, 'INTERRUPTED');
			const frozen = deepFreeze(outcome);
			if (sink !== undefined) {
				const frozenEvents = Object.freeze([...events]);
				queueMicrotask(() => {
					for (const event of frozenEvents)
						try {
							sink!(event);
						} catch {
							// Observer failures are isolated from resolution evidence.
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
	code: ConditionalExportResolutionDiagnostic['code'],
	message: string,
	phase: ConditionalExportResolutionDiagnostic['phase'],
	path: string | null = null
): ConditionalExportResolutionBuildOutcome {
	return { diagnostics: [{ code, message, path, phase }], outcome: 'unavailable' };
}

function checkedAdd(...values: readonly number[]): number {
	let total = 0;
	for (const value of values) {
		total += value;
		if (!Number.isSafeInteger(total))
			throw new ConditionalExportFailure(
				'BUDGET_EXCEEDED',
				'An exact operation population exceeds the safe-integer range.',
				'REQUEST'
			);
	}
	return total;
}

function saturatedMultiply(left: number, right: number): number {
	if (left === 0 || right === 0) return 0;
	return left > Math.floor(Number.MAX_SAFE_INTEGER / right)
		? Number.MAX_SAFE_INTEGER
		: left * right;
}

function saturatedAdd(left: number, right: number): number {
	return left > Number.MAX_SAFE_INTEGER - right ? Number.MAX_SAFE_INTEGER : left + right;
}

function span(sourceFile: ts.JsonSourceFile, node: ts.Node): ConditionalExportManifestSourceSpan {
	const start = node.getStart(sourceFile);
	return {
		coordinateSystem: 'UTF16_CODE_UNIT_ZERO_BASED_HALF_OPEN',
		length: node.end - start,
		start
	};
}

interface ParsedManifest {
	readonly astNodes: number;
	readonly declarationOrdinals: ReadonlyMap<ts.PropertyAssignment, number>;
	readonly exportsProperty: ts.PropertyAssignment | null;
	readonly importsProperty: ts.PropertyAssignment | null;
	readonly manifestWitness: ConditionalExportManifestWitness;
	readonly root: ts.ObjectLiteralExpression;
	readonly sourceFile: ts.JsonSourceFile;
}

function decodedPropertyName(
	property: ts.ObjectLiteralElementLike,
	sourceFile: ts.JsonSourceFile
): string {
	if (!ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.name))
		throw new ConditionalExportFailure(
			'MANIFEST_INVALID',
			'Every JSON object member must be a quoted PropertyAssignment.',
			'MANIFEST',
			`$manifest@${property.getStart(sourceFile)}`
		);
	if (!isUnicodeScalarString(property.name.text))
		throw new ConditionalExportFailure(
			'MANIFEST_INVALID',
			'Manifest property names must contain Unicode scalar text.',
			'MANIFEST',
			`$manifest@${property.name.getStart(sourceFile)}`
		);
	return property.name.text;
}

function decodedExportString(literal: ts.StringLiteral, sourceFile: ts.JsonSourceFile): string {
	if (!isUnicodeScalarString(literal.text))
		throw new ConditionalExportFailure(
			'MANIFEST_INVALID',
			'Decoded export string leaves must contain Unicode scalar text.',
			'MANIFEST',
			`$manifest@${literal.getStart(sourceFile)}`
		);
	return literal.text;
}

interface ManifestNodeScan {
	readonly declarationOrdinals: Map<ts.PropertyAssignment, number>;
	readonly nodes: ts.Node[];
}

function scanManifestNodes(sourceFile: ts.JsonSourceFile, maxAstNodes: number): ManifestNodeScan {
	const pending: ts.Node[] = [sourceFile];
	const nodes: ts.Node[] = [];
	const declarationOrdinals = new Map<ts.PropertyAssignment, number>();
	let declarationOrdinal = 0;
	while (pending.length > 0) {
		const node = pending.pop()!;
		nodes.push(node);
		if (nodes.length > maxAstNodes)
			throw new ConditionalExportFailure(
				'BUDGET_EXCEEDED',
				`maxAstNodes is ${maxAstNodes}, but parsing requires at least ${nodes.length}.`,
				'MANIFEST',
				'$.request.budgets.maxAstNodes'
			);
		if (ts.isPropertyAssignment(node)) declarationOrdinals.set(node, declarationOrdinal++);
		const children: ts.Node[] = [];
		ts.forEachChild(node, (child) => {
			children.push(child);
		});
		for (let index = children.length - 1; index >= 0; index -= 1) pending.push(children[index]!);
	}
	return { declarationOrdinals, nodes };
}

function manifestRootObject(sourceFile: ts.JsonSourceFile): ts.ObjectLiteralExpression {
	if (
		sourceFile.statements.length !== 1 ||
		!ts.isExpressionStatement(sourceFile.statements[0]!) ||
		!ts.isObjectLiteralExpression(sourceFile.statements[0]!.expression)
	)
		throw new ConditionalExportFailure(
			'MANIFEST_INVALID',
			'The exact package manifest root must be one JSON object.',
			'MANIFEST',
			'$manifest'
		);
	return sourceFile.statements[0].expression;
}

function assertUniqueManifestKeys(nodes: readonly ts.Node[], sourceFile: ts.JsonSourceFile): void {
	for (const node of nodes) {
		if (!ts.isObjectLiteralExpression(node)) continue;
		const names = new Set<string>();
		for (const property of node.properties) {
			const name = decodedPropertyName(property, sourceFile);
			if (names.has(name))
				throw new ConditionalExportFailure(
					'MANIFEST_INVALID',
					`The exact manifest contains duplicate decoded object key ${JSON.stringify(name)}.`,
					'MANIFEST',
					`$manifest@${property.getStart(sourceFile)}`
				);
			names.add(name);
		}
	}
}

function manifestRootProperties(
	root: ts.ObjectLiteralExpression,
	sourceFile: ts.JsonSourceFile
): Map<string, ts.PropertyAssignment> {
	const byName = new Map<string, ts.PropertyAssignment>();
	for (const property of root.properties)
		byName.set(decodedPropertyName(property, sourceFile), property as ts.PropertyAssignment);
	return byName;
}

function assertManifestPackageName(
	byName: ReadonlyMap<string, ts.PropertyAssignment>,
	workspaceName: string
): void {
	const nameProperty = byName.get('name');
	if (nameProperty === undefined || !ts.isStringLiteral(nameProperty.initializer))
		throw new ConditionalExportFailure(
			'MANIFEST_INVALID',
			'The exact workspace manifest must declare a string package name.',
			'MANIFEST',
			'$manifest.name'
		);
	if (nameProperty.initializer.text !== workspaceName)
		throw new ConditionalExportFailure(
			'INPUT_POPULATION_MISMATCH',
			'Raw manifest and FrozenSubject workspace package names differ.',
			'MANIFEST',
			'$manifest.name'
		);
}

function parseManifest(
	text: string,
	manifestPath: string,
	manifestBytes: Uint8Array,
	workspace: ConditionalExportResolutionBuildInputs['frozenSubject']['workspaces'][number],
	maxAstNodes: number
): ParsedManifest {
	const sourceFile = ts.parseJsonText(manifestPath, text);
	const parseDiagnostics = (
		sourceFile as ts.JsonSourceFile & {
			readonly parseDiagnostics?: readonly ts.Diagnostic[];
		}
	).parseDiagnostics;
	if (parseDiagnostics !== undefined && parseDiagnostics.length > 0)
		throw new ConditionalExportFailure(
			'MANIFEST_INVALID',
			'The exact frozen package manifest has JSON parse diagnostics.',
			'MANIFEST',
			'$manifest'
		);
	const { declarationOrdinals, nodes } = scanManifestNodes(sourceFile, maxAstNodes);
	const root = manifestRootObject(sourceFile);
	assertUniqueManifestKeys(nodes, sourceFile);
	const byName = manifestRootProperties(root, sourceFile);
	assertManifestPackageName(byName, workspace.name);
	const exportsProperty = byName.get('exports') ?? null;
	const importsProperty = byName.get('imports') ?? null;
	const exportsValueSpan =
		exportsProperty === null ? null : span(sourceFile, exportsProperty.initializer);
	const manifestWitness: ConditionalExportManifestWitness = {
		exportsPropertySpan: exportsProperty === null ? null : span(sourceFile, exportsProperty),
		exportsValueSha256:
			exportsValueSpan === null
				? null
				: sha256(
						text.slice(exportsValueSpan.start, exportsValueSpan.start + exportsValueSpan.length)
					),
		exportsValueSpan,
		importsPropertySpan: importsProperty === null ? null : span(sourceFile, importsProperty),
		manifestBytes: manifestBytes.byteLength,
		manifestPath,
		manifestSha256: sha256(manifestBytes),
		parseMethod: 'TYPESCRIPT_PARSE_JSON_TEXT',
		parserVersion: ts.version,
		rootSpan: span(sourceFile, root),
		sourceEncoding: 'UTF-8',
		workspaceKind: 'PACKAGE',
		workspaceName: workspace.name,
		workspacePath: workspace.path
	};
	return {
		astNodes: nodes.length,
		declarationOrdinals,
		exportsProperty,
		importsProperty,
		manifestWitness,
		root,
		sourceFile
	};
}

interface BranchSeed {
	readonly condition: string;
	readonly conditionMatch: ConditionalExportBranchRecord['conditionMatch'];
	readonly conditionPath: readonly string[];
	readonly declarationOrdinal: number;
	readonly depth: number;
	readonly exclusionReason: ConditionalExportBranchRecord['exclusionReason'];
	readonly keySpan: ConditionalExportManifestSourceSpan;
	readonly parentIndex: number | null;
	readonly target: string | null;
	readonly valueKind: ConditionalExportBranchRecord['valueKind'];
	readonly valueSpan: ConditionalExportManifestSourceSpan;
}
type FrontierSeed = Omit<ConditionalExportFrontierRecord, 'id' | 'ordinal'>;

interface ConditionTreeResult {
	readonly branches: BranchSeed[];
	readonly decisionLeafSeedIndex: number | null;
	readonly frontiers: FrontierSeed[];
	readonly state: 'BLOCKED_BY_NULL' | 'NO_MATCHING_CONDITION' | 'SELECTED_TARGET' | 'UNSUPPORTED';
	readonly target: string | null;
}

function declarationOrdinal(parsed: ParsedManifest, property: ts.PropertyAssignment): number {
	const ordinal = parsed.declarationOrdinals.get(property);
	if (ordinal === undefined)
		throw new ConditionalExportFailure(
			'MANIFEST_INVALID',
			'A parsed manifest property lacks its global declaration ordinal.',
			'MANIFEST'
		);
	return ordinal;
}

function conditionMatch(
	condition: string,
	request: ConditionalExportResolutionRequest
): ConditionalExportBranchRecord['conditionMatch'] {
	if (condition === 'default') return 'DEFAULT';
	if (request.conditions.includes(condition)) return 'EXPLICIT';
	if (condition === 'node' && request.platform === 'NODE') return 'PLATFORM';
	if (
		(condition === 'import' && request.moduleMode === 'IMPORT') ||
		(condition === 'require' && request.moduleMode === 'REQUIRE')
	)
		return 'MODULE_MODE';
	return 'INACTIVE';
}

function frontierSeed(
	parsed: ParsedManifest,
	property: ts.PropertyAssignment,
	declarationPath: readonly string[],
	impact: ConditionalExportFrontierRecord['impact'],
	reason: ConditionalExportFrontierReason,
	sourceNode: ts.Node
): FrontierSeed {
	return {
		declarationOrdinal: declarationOrdinal(parsed, property),
		declarationPath: [...declarationPath],
		impact,
		reason,
		sourceSpan: span(parsed.sourceFile, sourceNode)
	};
}

function compareFrontierSeed(left: FrontierSeed, right: FrontierSeed): number {
	if (left.declarationOrdinal !== right.declarationOrdinal)
		return left.declarationOrdinal - right.declarationOrdinal;
	if (left.sourceSpan.start !== right.sourceSpan.start)
		return left.sourceSpan.start - right.sourceSpan.start;
	const reasonOrder = compareText(left.reason, right.reason);
	return reasonOrder !== 0
		? reasonOrder
		: compareText(
				canonicalSemanticJson(left.declarationPath),
				canonicalSemanticJson(right.declarationPath)
			);
}

interface PendingConditionProperty {
	readonly ancestorsActive: boolean;
	readonly conditionPath: readonly string[];
	readonly parentIndex: number | null;
	readonly property: ts.PropertyAssignment;
}

interface ConditionTreeWalkState {
	readonly branches: BranchSeed[];
	decisionLeafSeedIndex: number | null;
	decisionState: ConditionTreeResult['state'] | null;
	decisionTarget: string | null;
	readonly frontiers: FrontierSeed[];
	readonly pending: PendingConditionProperty[];
	terminated: boolean;
}

interface ConditionLeafContext {
	readonly conditionPath: readonly string[];
	readonly declarationPath: readonly string[];
	readonly initializer: ts.Expression;
	readonly pathActive: boolean;
	readonly seedIndex: number;
	readonly target: string | null;
	readonly valueKind: ConditionalExportBranchRecord['valueKind'];
}

function frontierImpact(pathActive: boolean): ConditionalExportFrontierRecord['impact'] {
	return pathActive ? 'BLOCKS_SELECTED_DECISION' : 'OUTSIDE_SELECTED_DECISION';
}

function unsupportedValueKindReason(initializer: ts.Node): ConditionalExportFrontierReason {
	return ts.isArrayLiteralExpression(initializer)
		? 'EXPORT_ARRAY_FALLBACK_UNSUPPORTED'
		: 'UNSUPPORTED_EXPORT_VALUE_KIND';
}

function conditionValueKind(
	initializer: ts.Expression
): ConditionalExportBranchRecord['valueKind'] | null {
	if (ts.isObjectLiteralExpression(initializer)) return 'CONDITION_OBJECT';
	if (ts.isStringLiteral(initializer)) return 'STRING';
	if (initializer.kind === ts.SyntaxKind.NullKeyword) return 'NULL';
	return null;
}

function branchExclusionReason(
	priorTerminated: boolean,
	ancestorsActive: boolean,
	active: boolean
): ConditionalExportBranchRecord['exclusionReason'] {
	if (priorTerminated) return 'PRIOR_BRANCH_TERMINATED_EVALUATION';
	if (!ancestorsActive) return 'ANCESTOR_CONDITION_INACTIVE';
	if (!active) return 'CONDITION_INACTIVE';
	return null;
}

function assertNonNumericConditionName(
	condition: string,
	parsed: ParsedManifest,
	property: ts.PropertyAssignment
): void {
	if (isNumericConditionPropertyName(condition))
		throw new ConditionalExportFailure(
			'MANIFEST_INVALID',
			'Selected exact-key condition names must not be canonical numeric property names.',
			'MANIFEST',
			`$manifest@${property.name.getStart(parsed.sourceFile)}`
		);
}

function recordUnsupportedConditionValue(
	state: ConditionTreeWalkState,
	parsed: ParsedManifest,
	property: ts.PropertyAssignment,
	declarationPath: readonly string[],
	initializer: ts.Expression,
	pathActive: boolean
): void {
	state.frontiers.push(
		frontierSeed(
			parsed,
			property,
			declarationPath,
			frontierImpact(pathActive),
			unsupportedValueKindReason(initializer),
			initializer
		)
	);
	if (!pathActive) return;
	state.terminated = true;
	state.decisionState = 'UNSUPPORTED';
}

function applyStringConditionLeaf(
	state: ConditionTreeWalkState,
	parsed: ParsedManifest,
	property: ts.PropertyAssignment,
	leaf: ConditionLeafContext
): void {
	const safe = safeSlashPath(leaf.target!, false);
	if (!safe)
		state.frontiers.push(
			frontierSeed(
				parsed,
				property,
				leaf.declarationPath,
				frontierImpact(leaf.pathActive),
				'UNSUPPORTED_EXPORT_TARGET_SYNTAX',
				leaf.initializer
			)
		);
	if (!leaf.pathActive) return;
	state.terminated = true;
	if (safe) {
		state.decisionLeafSeedIndex = leaf.seedIndex;
		state.decisionState = 'SELECTED_TARGET';
		state.decisionTarget = leaf.target;
	} else state.decisionState = 'UNSUPPORTED';
}

function pushConditionChildren(
	state: ConditionTreeWalkState,
	initializer: ts.ObjectLiteralExpression,
	leaf: ConditionLeafContext
): void {
	for (let index = initializer.properties.length - 1; index >= 0; index -= 1)
		state.pending.push({
			ancestorsActive: leaf.pathActive,
			conditionPath: leaf.conditionPath,
			parentIndex: leaf.seedIndex,
			property: initializer.properties[index] as ts.PropertyAssignment
		});
}

function applyConditionValueKind(
	state: ConditionTreeWalkState,
	parsed: ParsedManifest,
	property: ts.PropertyAssignment,
	leaf: ConditionLeafContext
): void {
	if (leaf.valueKind === 'STRING') {
		applyStringConditionLeaf(state, parsed, property, leaf);
		return;
	}
	if (leaf.valueKind === 'NULL') {
		if (leaf.pathActive) {
			state.terminated = true;
			state.decisionLeafSeedIndex = leaf.seedIndex;
			state.decisionState = 'BLOCKED_BY_NULL';
		}
		return;
	}
	if (ts.isObjectLiteralExpression(leaf.initializer))
		pushConditionChildren(state, leaf.initializer, leaf);
}

function evaluateConditionTree(
	parsed: ParsedManifest,
	root: ts.ObjectLiteralExpression,
	request: ConditionalExportResolutionRequest
): ConditionTreeResult {
	const state: ConditionTreeWalkState = {
		branches: [],
		decisionLeafSeedIndex: null,
		decisionState: null,
		decisionTarget: null,
		frontiers: [],
		pending: [],
		terminated: false
	};
	for (let index = root.properties.length - 1; index >= 0; index -= 1)
		state.pending.push({
			ancestorsActive: true,
			conditionPath: [],
			parentIndex: null,
			property: root.properties[index] as ts.PropertyAssignment
		});
	while (state.pending.length > 0) {
		const frame = state.pending.pop()!;
		const condition = decodedPropertyName(frame.property, parsed.sourceFile);
		assertNonNumericConditionName(condition, parsed, frame.property);
		const path = [...frame.conditionPath, condition];
		const match = conditionMatch(condition, request);
		const active = match !== 'INACTIVE';
		const priorTerminated = state.terminated;
		const pathActive = !priorTerminated && frame.ancestorsActive && active;
		const initializer = frame.property.initializer;
		const declarationPath = ['exports', request.exportSubpath, ...path];
		const valueKind = conditionValueKind(initializer);
		if (valueKind === null) {
			recordUnsupportedConditionValue(
				state,
				parsed,
				frame.property,
				declarationPath,
				initializer,
				pathActive
			);
			continue;
		}
		const target = ts.isStringLiteral(initializer)
			? decodedExportString(initializer, parsed.sourceFile)
			: null;
		const seedIndex = state.branches.length;
		state.branches.push({
			condition,
			conditionMatch: match,
			conditionPath: path,
			declarationOrdinal: declarationOrdinal(parsed, frame.property),
			depth: path.length - 1,
			exclusionReason: branchExclusionReason(priorTerminated, frame.ancestorsActive, active),
			keySpan: span(parsed.sourceFile, frame.property.name),
			parentIndex: frame.parentIndex,
			target,
			valueKind,
			valueSpan: span(parsed.sourceFile, initializer)
		});
		applyConditionValueKind(state, parsed, frame.property, {
			conditionPath: path,
			declarationPath,
			initializer,
			pathActive,
			seedIndex,
			target,
			valueKind
		});
	}
	return {
		branches: state.branches,
		decisionLeafSeedIndex: state.decisionLeafSeedIndex,
		frontiers: state.frontiers,
		state: state.decisionState ?? 'NO_MATCHING_CONDITION',
		target: state.decisionTarget
	};
}

interface EvaluatedSurface {
	readonly branches: readonly BranchSeed[];
	readonly decisionLeafSeedIndex: number | null;
	readonly decisionState: ConditionalExportDecisionRecord['state'];
	readonly decisionTarget: string | null;
	readonly exactKeyComparisons: number;
	readonly exactKeyOutcome: ConditionalExportExactKeyOutcome;
	readonly frontiers: readonly FrontierSeed[];
}

function assertExportsKeyShape(exportsValue: ts.Expression, sourceFile: ts.JsonSourceFile): void {
	if (!ts.isObjectLiteralExpression(exportsValue)) return;
	const keys = exportsValue.properties.map((property) => decodedPropertyName(property, sourceFile));
	if (keys.some((key) => key.startsWith('.')) && keys.some((key) => !key.startsWith('.')))
		throw new ConditionalExportFailure(
			'MANIFEST_INVALID',
			'The manifest exports object must not mix subpath and condition keys.',
			'MANIFEST',
			'$manifest.exports'
		);
}

function rootStringExportDecisionState(
	request: ConditionalExportResolutionRequest,
	safe: boolean
): EvaluatedSurface['decisionState'] {
	if (request.exportSubpath !== '.') return 'NO_EXACT_EXPORT_KEY';
	if (safe) return 'SELECTED_TARGET';
	return 'UNSUPPORTED';
}

function rootExportsValueFrontierReason(
	exportsValue: ts.Expression
): ConditionalExportFrontierReason {
	if (ts.isArrayLiteralExpression(exportsValue)) return 'EXPORT_ARRAY_FALLBACK_UNSUPPORTED';
	if (ts.isObjectLiteralExpression(exportsValue)) return 'EXPORTS_ROOT_CONDITION_MAP_UNSUPPORTED';
	return 'UNSUPPORTED_EXPORT_VALUE_KIND';
}

function evaluateNonSubpathExports(
	parsed: ParsedManifest,
	request: ConditionalExportResolutionRequest,
	exportsProperty: ts.PropertyAssignment,
	frontiers: FrontierSeed[],
	rootKeyOutcome: () => ConditionalExportExactKeyOutcome
): EvaluatedSurface {
	const sourceFile = parsed.sourceFile;
	const exportsValue = exportsProperty.initializer;
	const impact =
		request.exportSubpath === '.' ? 'BLOCKS_SELECTED_DECISION' : 'OUTSIDE_SELECTED_DECISION';
	if (ts.isStringLiteral(exportsValue)) {
		const target = decodedExportString(exportsValue, sourceFile);
		const safe = safeSlashPath(target, false);
		if (!safe)
			frontiers.push(
				frontierSeed(
					parsed,
					exportsProperty,
					['exports'],
					impact,
					'UNSUPPORTED_EXPORT_TARGET_SYNTAX',
					exportsValue
				)
			);
		return {
			branches: [],
			decisionLeafSeedIndex: null,
			decisionState: rootStringExportDecisionState(request, safe),
			decisionTarget: request.exportSubpath === '.' && safe ? target : null,
			exactKeyComparisons: 1,
			exactKeyOutcome: rootKeyOutcome(),
			frontiers
		};
	}
	if (exportsValue.kind === ts.SyntaxKind.NullKeyword)
		return {
			branches: [],
			decisionLeafSeedIndex: null,
			decisionState: request.exportSubpath === '.' ? 'BLOCKED_BY_NULL' : 'NO_EXACT_EXPORT_KEY',
			decisionTarget: null,
			exactKeyComparisons: 1,
			exactKeyOutcome: rootKeyOutcome(),
			frontiers
		};
	frontiers.push(
		frontierSeed(
			parsed,
			exportsProperty,
			['exports'],
			impact,
			rootExportsValueFrontierReason(exportsValue),
			exportsValue
		)
	);
	return {
		branches: [],
		decisionLeafSeedIndex: null,
		decisionState: request.exportSubpath === '.' ? 'UNSUPPORTED' : 'NO_EXACT_EXPORT_KEY',
		decisionTarget: null,
		exactKeyComparisons: 1,
		exactKeyOutcome: rootKeyOutcome(),
		frontiers
	};
}

function selectExactSubpathProperty(
	parsed: ParsedManifest,
	request: ConditionalExportResolutionRequest,
	assignments: readonly ts.PropertyAssignment[],
	frontiers: FrontierSeed[]
): ts.PropertyAssignment | null {
	const sourceFile = parsed.sourceFile;
	let exactProperty: ts.PropertyAssignment | null = null;
	for (const property of assignments) {
		const name = decodedPropertyName(property, sourceFile);
		if (name.includes('*'))
			frontiers.push(
				frontierSeed(
					parsed,
					property,
					['exports', name],
					'OUTSIDE_SELECTED_DECISION',
					'EXPORT_PATTERN_KEY_UNSUPPORTED',
					property
				)
			);
		else if (name === request.exportSubpath) exactProperty = property;
	}
	return exactProperty;
}

function evaluateMissingExactSubpath(
	request: ConditionalExportResolutionRequest,
	assignments: readonly ts.PropertyAssignment[],
	frontiers: readonly FrontierSeed[]
): EvaluatedSurface {
	const adjusted = frontiers.map((frontier) =>
		frontier.reason === 'EXPORT_PATTERN_KEY_UNSUPPORTED'
			? { ...frontier, impact: 'BLOCKS_SELECTED_DECISION' as const }
			: frontier
	);
	const blocked = adjusted.some((frontier) => frontier.impact === 'BLOCKS_SELECTED_DECISION');
	return {
		branches: [],
		decisionLeafSeedIndex: null,
		decisionState: blocked ? 'UNSUPPORTED' : 'NO_EXACT_EXPORT_KEY',
		decisionTarget: null,
		exactKeyComparisons: assignments.length,
		exactKeyOutcome: { exportSubpath: request.exportSubpath, state: 'ABSENT' },
		frontiers: adjusted
	};
}

function evaluateExactSubpathValue(
	parsed: ParsedManifest,
	request: ConditionalExportResolutionRequest,
	exactProperty: ts.PropertyAssignment,
	exactKeyOutcome: ConditionalExportExactKeyOutcome,
	assignments: readonly ts.PropertyAssignment[],
	frontiers: FrontierSeed[]
): EvaluatedSurface {
	const sourceFile = parsed.sourceFile;
	const exactValue = exactProperty.initializer;
	if (ts.isStringLiteral(exactValue)) {
		const target = decodedExportString(exactValue, sourceFile);
		const safe = safeSlashPath(target, false);
		if (!safe)
			frontiers.push(
				frontierSeed(
					parsed,
					exactProperty,
					['exports', request.exportSubpath],
					'BLOCKS_SELECTED_DECISION',
					'UNSUPPORTED_EXPORT_TARGET_SYNTAX',
					exactValue
				)
			);
		return {
			branches: [],
			decisionLeafSeedIndex: null,
			decisionState: safe ? 'SELECTED_TARGET' : 'UNSUPPORTED',
			decisionTarget: safe ? target : null,
			exactKeyComparisons: assignments.length,
			exactKeyOutcome,
			frontiers
		};
	}
	if (exactValue.kind === ts.SyntaxKind.NullKeyword)
		return {
			branches: [],
			decisionLeafSeedIndex: null,
			decisionState: 'BLOCKED_BY_NULL',
			decisionTarget: null,
			exactKeyComparisons: assignments.length,
			exactKeyOutcome,
			frontiers
		};
	if (ts.isObjectLiteralExpression(exactValue)) {
		const evaluated = evaluateConditionTree(parsed, exactValue, request);
		return {
			branches: evaluated.branches,
			decisionLeafSeedIndex: evaluated.decisionLeafSeedIndex,
			decisionState: evaluated.state,
			decisionTarget: evaluated.target,
			exactKeyComparisons: assignments.length,
			exactKeyOutcome,
			frontiers: [...frontiers, ...evaluated.frontiers]
		};
	}
	frontiers.push(
		frontierSeed(
			parsed,
			exactProperty,
			['exports', request.exportSubpath],
			'BLOCKS_SELECTED_DECISION',
			unsupportedValueKindReason(exactValue),
			exactValue
		)
	);
	return {
		branches: [],
		decisionLeafSeedIndex: null,
		decisionState: 'UNSUPPORTED',
		decisionTarget: null,
		exactKeyComparisons: assignments.length,
		exactKeyOutcome,
		frontiers
	};
}

function evaluateSurface(
	parsed: ParsedManifest,
	request: ConditionalExportResolutionRequest
): EvaluatedSurface {
	const { exportsProperty, importsProperty, sourceFile } = parsed;
	const frontiers: FrontierSeed[] = [];
	if (importsProperty !== null)
		frontiers.push(
			frontierSeed(
				parsed,
				importsProperty,
				['imports'],
				'OUTSIDE_SELECTED_DECISION',
				'PACKAGE_IMPORTS_MAP_UNSUPPORTED',
				importsProperty
			)
		);
	if (exportsProperty === null)
		return {
			branches: [],
			decisionLeafSeedIndex: null,
			decisionState: 'NO_EXACT_EXPORT_KEY',
			decisionTarget: null,
			exactKeyComparisons: 0,
			exactKeyOutcome: { exportSubpath: request.exportSubpath, state: 'ABSENT' },
			frontiers
		};
	const exportsValue = exportsProperty.initializer;
	const exportsOrdinal = declarationOrdinal(parsed, exportsProperty);
	const rootKeyOutcome = (): ConditionalExportExactKeyOutcome =>
		request.exportSubpath === '.'
			? {
					declarationOrdinal: exportsOrdinal,
					exportSubpath: request.exportSubpath,
					keySpan: span(sourceFile, exportsProperty.name),
					matchKind: 'ROOT_DOT_SUGAR',
					state: 'MATCHED',
					valueSpan: span(sourceFile, exportsValue)
				}
			: { exportSubpath: request.exportSubpath, state: 'ABSENT' };

	assertExportsKeyShape(exportsValue, sourceFile);
	const explicitSubpathMap =
		ts.isObjectLiteralExpression(exportsValue) &&
		exportsValue.properties.every((property) =>
			decodedPropertyName(property, sourceFile).startsWith('.')
		);
	if (!explicitSubpathMap)
		return evaluateNonSubpathExports(parsed, request, exportsProperty, frontiers, rootKeyOutcome);

	const assignments = exportsValue.properties as ts.NodeArray<ts.PropertyAssignment>;
	const exactProperty = selectExactSubpathProperty(parsed, request, assignments, frontiers);
	if (exactProperty === null) return evaluateMissingExactSubpath(request, assignments, frontiers);
	const exactKeyOutcome: ConditionalExportExactKeyOutcome = {
		declarationOrdinal: declarationOrdinal(parsed, exactProperty),
		exportSubpath: request.exportSubpath,
		keySpan: span(sourceFile, exactProperty.name),
		matchKind: 'EXPLICIT_SUBPATH_KEY',
		state: 'MATCHED',
		valueSpan: span(sourceFile, exactProperty.initializer)
	};
	return evaluateExactSubpathValue(
		parsed,
		request,
		exactProperty,
		exactKeyOutcome,
		assignments,
		frontiers
	);
}

interface BoundConsumerAndManifest {
	readonly consumerEnvironment: ConditionalExportConsumerEnvironment;
	readonly manifestBytes: Uint8Array;
	readonly workspace: ConditionalExportResolutionBuildInputs['frozenSubject']['workspaces'][number];
}

function bindConsumerAndManifest(
	inputs: ConditionalExportResolutionBuildInputs
): BoundConsumerAndManifest {
	const { frozenSubject, projectContextGraph, request } = inputs;
	const workspaces = frozenSubject.workspaces.filter(
		(workspace) => workspace.name === request.packageName
	);
	if (
		workspaces.length !== 1 ||
		workspaces[0]!.kind !== 'PACKAGE' ||
		workspaces[0]!.manifestPath !== request.manifestPath
	)
		throw new ConditionalExportFailure(
			'INPUT_POPULATION_MISMATCH',
			'The request must identify one exact frozen workspace package and manifest.',
			'CONSUMER',
			'$.request.packageName'
		);
	const workspace = workspaces[0]!;
	const artifacts = frozenSubject.artifacts.filter(
		(artifact) => artifact.path === request.manifestPath
	);
	const manifestBytes = readFrozenSubjectArtifact(frozenSubject, request.manifestPath);
	if (artifacts.length !== 1 || manifestBytes === undefined)
		throw new ConditionalExportFailure(
			'MANIFEST_UNAVAILABLE',
			'The exact frozen package manifest bytes are unavailable.',
			'MANIFEST',
			'$.request.manifestPath'
		);
	const artifact = artifacts[0]!;
	if (manifestBytes.byteLength > request.budgets.maxManifestBytes)
		throw new ConditionalExportFailure(
			'BUDGET_EXCEEDED',
			`maxManifestBytes is ${request.budgets.maxManifestBytes}, but the exact manifest has ${manifestBytes.byteLength} bytes.`,
			'MANIFEST',
			'$.request.budgets.maxManifestBytes'
		);
	if (artifact.bytes !== manifestBytes.byteLength || artifact.sha256 !== sha256(manifestBytes))
		throw new ConditionalExportFailure(
			'INPUT_POPULATION_MISMATCH',
			'Frozen manifest bytes do not reproduce their captured artifact witness.',
			'MANIFEST',
			'$.frozenSubject.artifacts'
		);
	const programs = projectContextGraph.programs.filter(
		(program) => program.id === request.consumer.projectContextProgramId
	);
	const sources = projectContextGraph.sources.filter(
		(source) => source.id === request.consumer.projectContextSourceId
	);
	if (
		programs.length !== 1 ||
		sources.length !== 1 ||
		sources[0]!.programId !== programs[0]!.id ||
		programs[0]!.semanticProgramId !== request.consumer.semanticProgramId ||
		sources[0]!.semanticProgramId !== request.consumer.semanticProgramId ||
		sources[0]!.semanticSourceId !== request.consumer.semanticSourceId
	)
		throw new ConditionalExportFailure(
			'INPUT_POPULATION_MISMATCH',
			'The selected consumer must bind to one exact CAP-010 program and source.',
			'CONSUMER',
			'$.request.consumer'
		);
	const program = programs[0]!;
	const source = sources[0]!;
	return {
		consumerEnvironment: {
			conditionSemantics: 'MEMBERSHIP_ONLY_PRIORITY_FROM_MANIFEST_DECLARATION_ORDER',
			conditions: [...request.conditions],
			defaultConditionEnabled: true,
			effectiveConditions: [
				...request.conditions,
				...(request.platform === 'NODE' ? (['node'] as const) : []),
				request.moduleMode === 'IMPORT' ? 'import' : 'require'
			],
			logicalPath: source.logicalPath,
			moduleMode: request.moduleMode,
			platform: request.platform,
			projectContextProgramId: program.id,
			projectContextProjectId: program.projectId,
			projectContextSourceId: source.id,
			semanticProgramId: program.semanticProgramId,
			semanticProjectId: program.semanticProjectId,
			semanticSourceId: source.semanticSourceId
		},
		manifestBytes,
		workspace
	};
}

function cap010Inputs(
	inputs: ConditionalExportResolutionBuildInputs
): ProjectContextGraphBuildInputs {
	const graph = inputs.projectContextGraph;
	return {
		frozenSubject: inputs.frozenSubject,
		request: {
			budgets: graph.budgets,
			operationVersion: graph.operationVersion,
			schemaVersion: PROJECT_CONTEXT_GRAPH_REQUEST_SCHEMA_VERSION,
			selection: graph.selection,
			semanticSnapshotId: graph.semanticSnapshotId,
			subjectId: graph.subjectId
		},
		semanticSnapshot: inputs.semanticSnapshot
	};
}

function enforceOperationBudgets(
	request: ConditionalExportResolutionRequest,
	counts: {
		readonly astNodes: number;
		readonly branches: number;
		readonly conditionChecks: number;
		readonly frontiers: number;
		readonly outputRecords: number;
		readonly traversalSteps: number;
	}
): void {
	for (const [budget, actual] of [
		['maxAstNodes', counts.astNodes],
		['maxBranches', counts.branches],
		['maxConditionChecks', counts.conditionChecks],
		['maxFrontiers', counts.frontiers],
		['maxOutputRecords', counts.outputRecords],
		['maxTraversalSteps', counts.traversalSteps]
	] as const)
		if (actual > request.budgets[budget])
			throw new ConditionalExportFailure(
				'BUDGET_EXCEEDED',
				`${budget} is ${request.budgets[budget]}, but the exact required population is ${actual}.`,
				'REQUEST',
				`$.request.budgets.${budget}`
			);
}

function selectedBranchSeedIndexes(evaluated: EvaluatedSurface): Set<number> {
	const selectedSeedIndexes = new Set<number>();
	if (evaluated.decisionLeafSeedIndex === null) return selectedSeedIndexes;
	let current: number | null = evaluated.decisionLeafSeedIndex;
	while (current !== null) {
		selectedSeedIndexes.add(current);
		current = evaluated.branches[current]!.parentIndex;
	}
	return selectedSeedIndexes;
}

function branchEvaluation(
	seed: BranchSeed,
	ordinal: number,
	selectedSeedIndexes: ReadonlySet<number>
): ConditionalExportBranchRecord['evaluation'] {
	if (seed.exclusionReason !== null) return 'EXCLUDED';
	if (selectedSeedIndexes.has(ordinal)) return 'SELECTED';
	return 'CANDIDATE';
}

function resolutionCoverage(
	parsed: ParsedManifest,
	evaluated: EvaluatedSurface,
	branches: readonly ConditionalExportBranchRecord[],
	decision: ConditionalExportDecisionRecord,
	frontierRecords: number,
	chargedTraversalSteps: number,
	outputRecords: number
): ConditionalExportResolutionCoverage {
	const branchRecords = branches.length;
	return {
		astNodes: parsed.astNodes,
		blockedByNullDecisions: decision.state === 'BLOCKED_BY_NULL' ? 1 : 0,
		branchPopulationReconciles: true,
		branchRecords,
		candidateBranches: branches.filter((branch) => branch.evaluation === 'CANDIDATE').length,
		chargedTraversalSteps,
		conditionChecks: branchRecords,
		decisionPopulationReconciles: true,
		decisionRecords: 1,
		exactExportKeyComparisons: evaluated.exactKeyComparisons,
		exactExportKeyMatches: evaluated.exactKeyOutcome.state === 'MATCHED' ? 1 : 0,
		exactExportKeyMisses: evaluated.exactKeyOutcome.state === 'ABSENT' ? 1 : 0,
		excludedBranches: branches.filter((branch) => branch.evaluation === 'EXCLUDED').length,
		frontierPopulationReconciles: true,
		frontierRecords,
		manifestBytes: parsed.manifestWitness.manifestBytes,
		noExactExportKeyDecisions: decision.state === 'NO_EXACT_EXPORT_KEY' ? 1 : 0,
		noMatchingConditionDecisions: decision.state === 'NO_MATCHING_CONDITION' ? 1 : 0,
		outputRecords,
		selectedBranches: branches.filter((branch) => branch.evaluation === 'SELECTED').length,
		selectedConsumerPrograms: 1,
		selectedConsumerSources: 1,
		selectedManifests: 1,
		selectedTargetDecisions: decision.state === 'SELECTED_TARGET' ? 1 : 0,
		selectedWorkspacePackages: 1,
		unsupportedDecisions: decision.state === 'UNSUPPORTED' ? 1 : 0
	};
}

function materializeResolution(
	inputs: ConditionalExportResolutionBuildInputs,
	consumerEnvironment: ConditionalExportConsumerEnvironment,
	parsed: ParsedManifest,
	evaluated: EvaluatedSurface,
	inputDigest: string
): ConditionalExportResolutionSnapshot {
	const resolutionId = conditionalExportResolutionId({
		inputDigest,
		semanticSnapshotId: inputs.semanticSnapshot.id,
		subjectId: inputs.frozenSubject.descriptor.subjectId
	});
	const selectedSeedIndexes = selectedBranchSeedIndexes(evaluated);
	const branches = evaluated.branches.map((seed, ordinal): ConditionalExportBranchRecord => ({
		condition: seed.condition,
		conditionMatch: seed.conditionMatch,
		conditionPath: [...seed.conditionPath],
		declarationOrdinal: seed.declarationOrdinal,
		depth: seed.depth,
		evaluation: branchEvaluation(seed, ordinal, selectedSeedIndexes),
		exclusionReason: seed.exclusionReason,
		id: conditionalExportBranchId(resolutionId, {
			conditionPath: seed.conditionPath,
			declarationOrdinal: seed.declarationOrdinal,
			keySpan: seed.keySpan,
			ordinal,
			valueKind: seed.valueKind,
			valueSpan: seed.valueSpan
		}),
		keySpan: { ...seed.keySpan },
		ordinal,
		target: seed.target,
		valueKind: seed.valueKind,
		valueSpan: { ...seed.valueSpan }
	}));
	const orderedFrontiers = [...evaluated.frontiers].sort(compareFrontierSeed);
	const frontiers = orderedFrontiers.map((seed, ordinal): ConditionalExportFrontierRecord => ({
		declarationOrdinal: seed.declarationOrdinal,
		declarationPath: [...seed.declarationPath],
		id: conditionalExportFrontierId(resolutionId, {
			declarationOrdinal: seed.declarationOrdinal,
			declarationPath: seed.declarationPath,
			ordinal,
			reason: seed.reason,
			sourceSpan: seed.sourceSpan
		}),
		impact: seed.impact,
		ordinal,
		reason: seed.reason,
		sourceSpan: { ...seed.sourceSpan }
	}));
	const decisionBase = {
		basis: 'RAW_MANIFEST_DECLARATION_ORDER_FOR_EXACT_CONSUMER_ENVIRONMENT' as const,
		id: conditionalExportDecisionId(resolutionId),
		ordinal: 0 as const
	};
	const selectedBranchId =
		evaluated.decisionLeafSeedIndex === null ? null : branches[evaluated.decisionLeafSeedIndex]!.id;
	let decision: ConditionalExportDecisionRecord;
	if (evaluated.decisionState === 'SELECTED_TARGET') {
		if (evaluated.decisionTarget === null)
			throw new ConditionalExportFailure(
				'RESOLUTION_VALIDATION_FAILED',
				'A selected-target decision lacks its exact target.',
				'MATERIALIZE'
			);
		decision = {
			...decisionBase,
			selectedBranchId,
			state: 'SELECTED_TARGET',
			target: evaluated.decisionTarget
		};
	} else if (evaluated.decisionState === 'BLOCKED_BY_NULL') {
		decision = { ...decisionBase, selectedBranchId, state: 'BLOCKED_BY_NULL', target: null };
	} else {
		decision = {
			...decisionBase,
			selectedBranchId: null,
			state: evaluated.decisionState,
			target: null
		};
	}
	const branchRecords = branches.length;
	const frontierRecords = frontiers.length;
	const chargedTraversalSteps = checkedAdd(
		parsed.astNodes,
		evaluated.exactKeyComparisons,
		branchRecords,
		frontierRecords
	);
	const outputRecords = checkedAdd(1, branchRecords, frontierRecords);
	enforceOperationBudgets(inputs.request, {
		astNodes: parsed.astNodes,
		branches: branchRecords,
		conditionChecks: branchRecords,
		frontiers: frontierRecords,
		outputRecords,
		traversalSteps: chargedTraversalSteps
	});
	const coverage: ConditionalExportResolutionCoverage = resolutionCoverage(
		parsed,
		evaluated,
		branches,
		decision,
		frontierRecords,
		chargedTraversalSteps,
		outputRecords
	);
	const open = decision.state === 'UNSUPPORTED';
	const content: ConditionalExportResolutionContent = {
		authorityTransfer: CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY_TRANSFER,
		branches,
		budgets: { ...inputs.request.budgets },
		canonicalProfile: CONDITIONAL_EXPORT_RESOLUTION_CANONICAL_PROFILE,
		capability: CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY,
		capabilityStatus: CONDITIONAL_EXPORT_RESOLUTION_CAPABILITY_STATUS,
		closure: open
			? 'OPEN_FOR_SELECTED_EXACT_EXPORT_DECISION'
			: 'CLOSED_FOR_SELECTED_EXACT_EXPORT_DECISION',
		consumerEnvironment: clonePlainData(consumerEnvironment),
		coverage,
		currentness: CONDITIONAL_EXPORT_RESOLUTION_CURRENTNESS,
		decision,
		exactKeyOutcome: clonePlainData(evaluated.exactKeyOutcome),
		freshness: CONDITIONAL_EXPORT_RESOLUTION_FRESHNESS,
		frontiers,
		fullJanCsaa012Conformance: CONDITIONAL_EXPORT_RESOLUTION_FULL_JAN_CSAA_012_CONFORMANCE,
		gateEffect: CONDITIONAL_EXPORT_RESOLUTION_GATE_EFFECT,
		health: 'PARTIAL',
		id: resolutionId,
		inputDigest,
		manifestWitness: clonePlainData(parsed.manifestWitness),
		method: CONDITIONAL_EXPORT_RESOLUTION_METHOD,
		nonclaims: clonePlainData(CONDITIONAL_EXPORT_RESOLUTION_NONCLAIMS),
		operationVersion: CONDITIONAL_EXPORT_RESOLUTION_OPERATION_VERSION,
		projectContextGraph: { ...inputs.request.projectContextGraph },
		resolutionAuthority: CONDITIONAL_EXPORT_RESOLUTION_AUTHORITY,
		resultCompleteness: open
			? 'UNRESOLVED_SELECTED_CRITERION_WITH_EXPLICIT_FRONTIER'
			: 'COMPLETE_FOR_SELECTED_SUPPORTED_EXACT_EXPORT_CRITERION',
		schemaVersion: CONDITIONAL_EXPORT_RESOLUTION_SCHEMA_VERSION,
		selection: clonePlainData(CONDITIONAL_EXPORT_RESOLUTION_SELECTION),
		semanticSnapshotId: inputs.semanticSnapshot.id,
		subjectId: inputs.frozenSubject.descriptor.subjectId,
		truncation: { reason: null, state: 'NOT_TRUNCATED' }
	};
	return { ...content, contentDigest: conditionalExportResolutionContentDigest(content) };
}

export function buildConditionalExportResolution(
	inputsValue: unknown,
	options?: BuildConditionalExportResolutionOptions
): ConditionalExportResolutionBuildOutcome {
	const progress = telemetry(options);
	try {
		progress.start('REQUEST_BIND');
		const limits = preflightLimits(inputsValue);
		const usage = preflightPlainData(inputsValue, limits);
		const inputs = materializeInputs(inputsValue);
		if (!isFrozenSubjectCapability(inputs.frozenSubject))
			throw new ConditionalExportFailure(
				'REQUEST_INVALID',
				'An attached FrozenSubject capability is required.',
				'BIND',
				'$.frozenSubject'
			);
		if (
			inputs.request.subjectId !== inputs.frozenSubject.descriptor.subjectId ||
			inputs.request.subjectId !== inputs.semanticSnapshot.subjectId ||
			inputs.request.subjectId !== inputs.projectContextGraph.subjectId ||
			inputs.request.semanticSnapshotId !== inputs.semanticSnapshot.id ||
			inputs.request.semanticSnapshotId !== inputs.projectContextGraph.semanticSnapshotId ||
			inputs.request.projectContextGraph.graphId !== inputs.projectContextGraph.id ||
			inputs.request.projectContextGraph.contentDigest !==
				inputs.projectContextGraph.contentDigest ||
			inputs.request.projectContextGraph.inputDigest !== inputs.projectContextGraph.inputDigest
		)
			throw new ConditionalExportFailure(
				'INPUT_IDENTITY_MISMATCH',
				'Request, FrozenSubject, semantic snapshot, and CAP-010 identities do not agree.',
				'BIND'
			);
		progress.complete({
			inputRecords: usage.records,
			inputStringCharacters: usage.stringCharacters
		});

		progress.start('INPUT_BUDGET');
		progress.complete({
			maxInputRecords: inputs.request.budgets.maxInputRecords,
			maxInputStringCharacters: inputs.request.budgets.maxInputStringCharacters
		});

		progress.start('PROJECT_CONTEXT_GRAPH_VALIDATE');
		const predecessorValidation = validateProjectContextGraph(
			inputs.projectContextGraph,
			cap010Inputs(inputs),
			{
				maxDepth: 4_096,
				maxInputRecords: inputs.request.budgets.maxInputRecords,
				maxInputStringCharacters: inputs.request.budgets.maxInputStringCharacters,
				maxIssues: inputs.request.budgets.maxDiagnostics,
				maxRecords: inputs.request.budgets.maxInputRecords,
				maxStringCharacters: inputs.request.budgets.maxInputStringCharacters
			}
		);
		if (predecessorValidation.state !== 'VALID')
			throw new ConditionalExportFailure(
				predecessorValidation.state === 'BUDGET_EXHAUSTED'
					? 'BUDGET_EXCEEDED'
					: 'PROJECT_CONTEXT_GRAPH_INVALID',
				'The CAP-010 graph is not independently valid for the exact predecessors.',
				'VALIDATE',
				predecessorValidation.issues[0]?.path ?? null
			);
		progress.complete({ validationIssues: 0 });

		progress.start('CONSUMER_BIND');
		const bound = bindConsumerAndManifest(inputs);
		progress.complete({ consumerPrograms: 1, consumerSources: 1, workspacePackages: 1 });

		progress.start('MANIFEST_PARSE');
		let manifestText: string;
		try {
			manifestText = new TextDecoder('utf-8', { fatal: true }).decode(bound.manifestBytes);
		} catch {
			throw new ConditionalExportFailure(
				'MANIFEST_INVALID',
				'The exact frozen package manifest is not valid UTF-8.',
				'MANIFEST',
				'$manifest'
			);
		}
		const parsed = parseManifest(
			manifestText,
			inputs.request.manifestPath,
			bound.manifestBytes,
			bound.workspace,
			inputs.request.budgets.maxAstNodes
		);
		progress.complete({ astNodes: parsed.astNodes, manifestBytes: bound.manifestBytes.byteLength });

		progress.start('EXPORT_KEY_MATCH');
		const evaluated = evaluateSurface(parsed, inputs.request);
		progress.complete({
			exactKeyComparisons: evaluated.exactKeyComparisons,
			exactKeyMatches: evaluated.exactKeyOutcome.state === 'MATCHED' ? 1 : 0
		});

		progress.start('CONDITION_EVALUATE');
		const inputDigest = conditionalExportResolutionInputDigest(inputs, {
			consumerEnvironment: bound.consumerEnvironment,
			manifestWitness: parsed.manifestWitness
		});
		const resolution = materializeResolution(
			inputs,
			bound.consumerEnvironment,
			parsed,
			evaluated,
			inputDigest
		);
		progress.complete({
			branches: resolution.branches.length,
			conditionChecks: resolution.coverage.conditionChecks,
			frontiers: resolution.frontiers.length
		});

		progress.start('MATERIALIZE');
		progress.complete({ outputRecords: resolution.coverage.outputRecords });

		progress.start('SERIALIZE');
		canonicalSemanticJson(resolution);
		progress.complete({ outputRecords: resolution.coverage.outputRecords });

		progress.start('RESOLUTION_VALIDATE');
		const validationRecords = Math.max(
			512,
			saturatedAdd(
				inputs.request.budgets.maxInputRecords,
				saturatedMultiply(resolution.coverage.outputRecords, 64)
			)
		);
		const validationStrings = Math.max(
			16_384,
			saturatedAdd(
				inputs.request.budgets.maxInputStringCharacters,
				saturatedMultiply(resolution.coverage.outputRecords, 4_096)
			)
		);
		const validation = validateConstructedConditionalExportResolution(
			resolution,
			inputs,
			inputDigest,
			{
				maxDepth: 4_096,
				maxInputRecords: inputs.request.budgets.maxInputRecords,
				maxInputStringCharacters: inputs.request.budgets.maxInputStringCharacters,
				maxIssues: inputs.request.budgets.maxDiagnostics,
				maxRecords: validationRecords,
				maxStringCharacters: validationStrings
			}
		);
		if (validation.state !== 'VALID')
			throw new ConditionalExportFailure(
				validation.state === 'BUDGET_EXHAUSTED'
					? 'BUDGET_EXCEEDED'
					: 'RESOLUTION_VALIDATION_FAILED',
				'The constructed conditional-export resolution failed independent validation.',
				'VALIDATE',
				validation.issues[0]?.path ?? null
			);
		progress.complete({ validationIssues: 0 });
		return progress.finish({ diagnostics: [], outcome: 'partial', resolution });
	} catch (error) {
		if (error instanceof ConditionalExportFailure) {
			progress.fail({}, error.code);
			return progress.finish(unavailable(error.code, error.message, error.phase, error.path));
		}
		progress.fail({}, 'REQUEST_INVALID');
		return progress.finish(
			unavailable(
				'REQUEST_INVALID',
				error instanceof Error
					? `Conditional-export input inspection failed closed: ${error.message}`
					: 'Conditional-export input inspection failed closed.',
				'REQUEST'
			)
		);
	}
}
