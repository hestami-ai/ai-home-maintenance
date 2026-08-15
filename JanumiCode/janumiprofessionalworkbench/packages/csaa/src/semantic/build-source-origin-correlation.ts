import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import { isProxy } from 'node:util/types';

import {
	SOURCE_ORIGIN_CORRELATION_ARTIFACT_ROLE_ORDER,
	SOURCE_ORIGIN_CORRELATION_AUTHORITY,
	SOURCE_ORIGIN_CORRELATION_AUTHORITY_TRANSFER,
	SOURCE_ORIGIN_CORRELATION_CANONICAL_PROFILE,
	SOURCE_ORIGIN_CORRELATION_CAPABILITY,
	SOURCE_ORIGIN_CORRELATION_CAPABILITY_STATUS,
	SOURCE_ORIGIN_CORRELATION_CURRENTNESS,
	SOURCE_ORIGIN_CORRELATION_FRESHNESS,
	SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_007_CONFORMANCE,
	SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_008_CONFORMANCE,
	SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_014_CONFORMANCE,
	SOURCE_ORIGIN_CORRELATION_GATE_EFFECT,
	SOURCE_ORIGIN_CORRELATION_LOCATION_ROLE_ORDER,
	SOURCE_ORIGIN_CORRELATION_METHOD,
	SOURCE_ORIGIN_CORRELATION_NONCLAIMS,
	SOURCE_ORIGIN_CORRELATION_OPERATION_VERSION,
	SOURCE_ORIGIN_CORRELATION_PROGRESS_SCHEMA_VERSION,
	SOURCE_ORIGIN_CORRELATION_REQUEST_SCHEMA_VERSION,
	SOURCE_ORIGIN_CORRELATION_SCHEMA_VERSION,
	SOURCE_ORIGIN_CORRELATION_SELECTION,
	type BuildSourceOriginCorrelationOptions,
	type SourceOriginCorrelationBudgets,
	type SourceOriginCorrelationBuildInputs,
	type SourceOriginCorrelationBuildOutcome,
	type SourceOriginCorrelationDiagnostic,
	type SourceOriginCorrelationProgressEvent,
	type SourceOriginCorrelationProgressPhase,
	type SourceOriginCorrelationRequest,
	type SourceOriginCorrelationSnapshot,
	type SourceOriginProgramSourceIdentity
} from '../contracts/source-origin-correlation.js';
import type {
	SemanticProgramRecord,
	SemanticProjectRecord,
	SemanticSourceRecord
} from '../contracts/semantic.js';
import {
	COMPILER_PROJECT_DECLARATION_EMISSION_VERSION,
	CompilerProjectDeclarationEmissionError,
	emitCompilerProjectDeclaration,
	type CompilerProjectDeclarationEmission
} from '../providers/typescript/compiler-project-declaration-emission.js';
import {
	decodeSourceMapV3,
	SOURCE_MAP_V3_DECODER_IMPLEMENTATION_LIMITS,
	SourceMapV3DecodeError,
	type DecodedSourceMapV3
} from '../providers/source-map/decode-source-map-v3.js';
import { isFrozenSubjectCapability } from '../subject/frozen-store.js';
import { canonicalSemanticJsonWitnessWithProgress } from './canonical.js';
import { createMonotonicOperationClock } from './monotonic-operation-clock.js';
import {
	sourceOriginArtifactId,
	sourceOriginCorrelationContentDigest,
	sourceOriginCorrelationId,
	sourceOriginCorrelationInputDigest,
	sourceOriginEmissionId,
	sourceOriginExactCorrelationId,
	sourceOriginLocationId,
	sourceOriginMapSegmentId,
	sourceOriginMappingHealthId,
	sourceOriginProgramSourcePopulationDigest,
	sourceOriginSourceMapId,
	sourceOriginUnmappedGeneratedLineId
} from './source-origin-correlation-canonical.js';
import { validateConstructedSourceOriginCorrelation } from './validate-source-origin-correlation.js';
import { validateStaticSemanticSnapshot } from './validate-snapshot.js';

/** @internal Mutable only so direct-file tests can replace the exact fresh-emission boundary. */
export const sourceOriginCorrelationDeclarationEmissionProvider = {
	emitCompilerProjectDeclaration
};

const INPUT_KEYS = [
	'declarationMapBytes',
	'frozenSubject',
	'request',
	'semanticSnapshot',
	'targetDeclarationBytes'
] as const;
const REQUEST_KEYS = [
	'budgets',
	'declarationMap',
	'operationVersion',
	'schemaVersion',
	'selection',
	'semanticProgramId',
	'semanticProjectId',
	'semanticSnapshotId',
	'semanticSourceId',
	'subjectId',
	'targetDeclaration'
] as const;
const BUDGET_KEYS = [
	'maxCallerCaptureBytes',
	'maxCompilerInputAttempts',
	'maxCorrelations',
	'maxDecodedMapLines',
	'maxDecodedMapSegments',
	'maxDiagnostics',
	'maxDurationMs',
	'maxEmitBytes',
	'maxEmitOutputs',
	'maxEmitStringCharacters',
	'maxInputRecords',
	'maxInputStringCharacters',
	'maxLocations',
	'maxMappingsCharacters',
	'maxOutputRecords',
	'maxPathCharacters',
	'maxProgramReadBytes',
	'maxProgramSourceFiles',
	'maxReadBytes',
	'maxSourceMapJsonDepth',
	'maxSourceMapJsonRecords',
	'maxSourceTextCodeUnits',
	'maxTraversalSteps',
	'maxUnmappedGeneratedLines'
] as const;
const CAPTURE_DESCRIPTOR_KEYS = ['contentBytes', 'contentSha256', 'logicalPath'] as const;
const PROVIDER_RESULT_KEYS = [
	'emissionWitness',
	'materializedSource',
	'outputs',
	'selection',
	'version'
] as const;
const PROVIDER_SOURCE_KEYS = [
	'contentBytes',
	'contentSha256',
	'logicalPath',
	'semanticProgramId',
	'semanticProjectId',
	'semanticSourceId',
	'text',
	'textLength'
] as const;
const PROVIDER_OUTPUT_KEYS = [
	'bytes',
	'content',
	'contentSha256',
	'kind',
	'logicalPath',
	'sourceLogicalPath',
	'textLength',
	'writeByteOrderMark'
] as const;
const PROVIDER_SELECTION_KEYS = [
	'logicalPath',
	'semanticProgramId',
	'semanticProjectId',
	'semanticSourceId'
] as const;
const PROVIDER_WITNESS_KEYS = [
	'attributedCompilerInputAttempts',
	'attributedProgramReadBytes',
	'attributedUniqueQueries',
	'captureContextDigest',
	'compilerOptionsDigest',
	'compilerVersion',
	'configPath',
	'declarationEmitCallbacksUseOnlyAttributedQueries',
	'declarationEmitCompilerInputAttempts',
	'declarationEmitReadBytes',
	'emitApi',
	'emitDiagnostics',
	'emitOnlyDtsFiles',
	'emitSkipped',
	'materializedRecipeDigest',
	'outputs',
	'programCallbacksWithinAttributedInvocationBounds',
	'programCompilerInputAttempts',
	'programInputAttemptPopulationDigest',
	'programInputAttemptPopulationReconciles',
	'programPresentReadFileAttempts',
	'programReadBytes',
	'programSourceFiles',
	'programSourceFilePopulationReconciles',
	'programSourcePopulationDigest',
	'projectResolutionDigest',
	'selectedSourceLogicalPath',
	'semanticProgramId',
	'semanticProjectId',
	'semanticSourceId',
	'state'
] as const;
const SHA256 = /^[a-f0-9]{64}$/u;
const RESOURCE_CHECKPOINT_CADENCE = 256;
const BYTE_CHUNK_SIZE = 64 * 1024;
const TEXT_CHUNK_SIZE = 4_096;
const HARD_INPUT_DEPTH = 4_096;
const UINT8_ARRAY_PROTOTYPE = Uint8Array.prototype;
const ARRAY_BUFFER_PROTOTYPE = ArrayBuffer.prototype;
const TYPED_ARRAY_PROTOTYPE = Reflect.getPrototypeOf(UINT8_ARRAY_PROTOTYPE) as object;
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
	TYPED_ARRAY_PROTOTYPE,
	'buffer'
)!.get!;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
	TYPED_ARRAY_PROTOTYPE,
	'byteLength'
)!.get!;
const UINT8_ARRAY_SUBARRAY = UINT8_ARRAY_PROTOTYPE.subarray;
const UINT8_ARRAY_SET = UINT8_ARRAY_PROTOTYPE.set;
const REFLECT_APPLY = Reflect.apply;
const HARD_LIMITS = Object.freeze({
	maxCallerCaptureBytes: 16 * 1024 * 1024,
	maxCompilerInputAttempts: 2_000_000,
	maxCorrelations: 500_000,
	maxDecodedMapLines: 1_000_000,
	maxDecodedMapSegments: 500_000,
	maxDiagnostics: 100_000,
	maxDurationMs: Number.MAX_SAFE_INTEGER,
	maxEmitBytes: 16 * 1024 * 1024,
	maxEmitOutputs: 2,
	maxEmitStringCharacters: 16 * 1024 * 1024,
	maxInputRecords: 4_000_000,
	maxInputStringCharacters: 128 * 1024 * 1024,
	maxLocations: 1_000_000,
	maxMappingsCharacters: 4 * 1024 * 1024,
	maxOutputRecords: 2_100_000,
	maxPathCharacters: 16_384,
	maxProgramReadBytes: 512 * 1024 * 1024,
	maxProgramSourceFiles: 100_000,
	maxReadBytes: 528 * 1024 * 1024,
	maxSourceMapJsonDepth: 256,
	maxSourceMapJsonRecords: 1_000_000,
	maxSourceTextCodeUnits: 16 * 1024 * 1024,
	maxTraversalSteps: 250_000_000,
	maxUnmappedGeneratedLines: 1_000_000
} as const);

interface InputCensus {
	readonly records: number;
	readonly stringCharacters: number;
}

interface BoundSelection {
	readonly program: SemanticProgramRecord;
	readonly project: SemanticProjectRecord;
	readonly source: SemanticSourceRecord;
}

interface Deadline {
	readonly check: (phase: SourceOriginCorrelationProgressPhase) => void;
	readonly remaining: (phase: SourceOriginCorrelationProgressPhase) => number;
}

interface TelemetryRecorder {
	activePhase(): SourceOriginCorrelationProgressPhase | null;
	complete(counts?: Readonly<Record<string, number>>, detailCode?: string | null): void;
	fail(counts?: Readonly<Record<string, number>>, detailCode?: string | null): void;
	finish<Outcome extends SourceOriginCorrelationBuildOutcome>(outcome: Outcome): Outcome;
	start(
		phase: SourceOriginCorrelationProgressPhase,
		counts?: Readonly<Record<string, number>>
	): void;
}

class SourceOriginCorrelationFailure extends Error {
	constructor(
		readonly code: SourceOriginCorrelationDiagnostic['code'],
		message: string,
		readonly phase: SourceOriginCorrelationDiagnostic['phase'],
		readonly path: string | null = null
	) {
		super(message);
		this.name = 'SourceOriginCorrelationFailure';
	}
}

function fixedKeyContains(keys: readonly string[], candidate: string): boolean {
	for (const key of keys) if (key === candidate) return true;
	return false;
}

function exactPlainRecord(
	value: unknown,
	keys: readonly string[],
	path: string
): Readonly<Record<string, unknown>> {
	if (
		value === null ||
		typeof value !== 'object' ||
		Array.isArray(value) ||
		isProxy(value) ||
		(Reflect.getPrototypeOf(value) !== Object.prototype && Reflect.getPrototypeOf(value) !== null)
	)
		throw new TypeError(`${path} must be an inert exact-key plain data record.`);
	const ownKeys = Reflect.ownKeys(value);
	if (ownKeys.length !== keys.length)
		throw new TypeError(`${path} has an invalid exact key population.`);
	for (const key of ownKeys)
		if (typeof key !== 'string' || !fixedKeyContains(keys, key))
			throw new TypeError(`${path} has an invalid exact key population.`);
	const copy: Record<string, unknown> = {};
	for (const key of keys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new TypeError(`${path}.${key} must be an enumerable data property.`);
		copy[key] = descriptor.value;
	}
	return copy;
}

function checkedAdd(...values: readonly number[]): number {
	let total = 0;
	for (const value of values) {
		if (!Number.isSafeInteger(value) || value < 0 || value > Number.MAX_SAFE_INTEGER - total)
			throw new SourceOriginCorrelationFailure(
				'BUDGET_EXCEEDED',
				'A source-origin population exceeds safe-integer range.',
				'INPUT_BUDGET'
			);
		total += value;
	}
	return total;
}

function checkedMultiply(left: number, right: number): number {
	if (
		!Number.isSafeInteger(left) ||
		!Number.isSafeInteger(right) ||
		left < 0 ||
		right < 0 ||
		(left !== 0 && right > Math.floor(Number.MAX_SAFE_INTEGER / left))
	)
		throw new SourceOriginCorrelationFailure(
			'BUDGET_EXCEEDED',
			'A source-origin population exceeds safe-integer range.',
			'INPUT_BUDGET'
		);
	return left * right;
}

function unavailable(
	code: SourceOriginCorrelationDiagnostic['code'],
	message: string,
	phase: SourceOriginCorrelationDiagnostic['phase'],
	path: string | null = null
): SourceOriginCorrelationBuildOutcome {
	return {
		diagnostics: Object.freeze([Object.freeze({ code, message, path, phase })]),
		outcome: 'unavailable'
	};
}

function boundedCounts(counts: Readonly<Record<string, number>>): Readonly<Record<string, number>> {
	const result: Record<string, number> = {};
	let retained = 0;
	for (const key of Object.keys(counts)) {
		if (retained >= 16) break;
		const value = counts[key];
		if (!Number.isSafeInteger(value) || value! < 0) continue;
		result[key] = value!;
		retained += 1;
	}
	return Object.freeze(result);
}

function telemetry(options: BuildSourceOriginCorrelationOptions | undefined): TelemetryRecorder {
	let sink: ((event: SourceOriginCorrelationProgressEvent) => void) | undefined;
	try {
		if (options !== undefined) {
			const record = exactPlainRecord(options, ['onProgress'], '$options');
			if (typeof record.onProgress === 'function')
				sink = record.onProgress as (event: SourceOriginCorrelationProgressEvent) => void;
		}
	} catch {
		// Progress is out-of-band and never changes semantic evidence.
	}
	const events: SourceOriginCorrelationProgressEvent[] = [];
	let active: SourceOriginCorrelationProgressPhase | null = null;
	let sequence = 0;
	const emit = (
		phase: SourceOriginCorrelationProgressPhase,
		state: SourceOriginCorrelationProgressEvent['state'],
		counts: Readonly<Record<string, number>>,
		detailCode: string | null
	): void => {
		events.push(
			Object.freeze({
				counts: boundedCounts(counts),
				detailCode,
				phase,
				schemaVersion: SOURCE_ORIGIN_CORRELATION_PROGRESS_SCHEMA_VERSION,
				sequence: sequence++,
				state
			})
		);
	};
	const close = (
		state: SourceOriginCorrelationProgressEvent['state'],
		counts: Readonly<Record<string, number>>,
		detailCode: string | null
	): void => {
		if (active === null) return;
		emit(active, state, counts, detailCode);
		active = null;
	};
	return {
		activePhase(): SourceOriginCorrelationProgressPhase | null {
			return active;
		},
		complete(counts = {}, detailCode = null): void {
			close('COMPLETED', counts, detailCode);
		},
		fail(counts = {}, detailCode = null): void {
			close('FAILED', counts, detailCode);
		},
		finish<Outcome extends SourceOriginCorrelationBuildOutcome>(outcome: Outcome): Outcome {
			if (active !== null) close('FAILED', { interrupted: 1 }, 'INTERRUPTED');
			const frozen = Object.freeze(outcome) as Outcome;
			if (sink !== undefined) {
				const retained = Object.freeze([...events]);
				queueMicrotask(() => {
					for (const event of retained)
						try {
							sink!(event);
						} catch {
							// Observer failures remain isolated.
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

function preflightLimits(value: unknown): {
	readonly maxDurationMs: number;
	readonly maxInputRecords: number;
	readonly maxInputStringCharacters: number;
} {
	const inputs = exactPlainRecord(value, INPUT_KEYS, '$inputs');
	const request = exactPlainRecord(inputs.request, REQUEST_KEYS, '$inputs.request');
	const budgets = exactPlainRecord(request.budgets, BUDGET_KEYS, '$inputs.request.budgets');
	for (const key of ['maxDurationMs', 'maxInputRecords', 'maxInputStringCharacters'] as const) {
		const entry = budgets[key];
		if (typeof entry !== 'number' || !Number.isSafeInteger(entry) || entry < 1)
			throw new TypeError(`$inputs.request.budgets.${key} must be a positive safe integer.`);
	}
	return {
		maxDurationMs: Math.min(budgets.maxDurationMs as number, HARD_LIMITS.maxDurationMs),
		maxInputRecords: Math.min(budgets.maxInputRecords as number, HARD_LIMITS.maxInputRecords),
		maxInputStringCharacters: Math.min(
			budgets.maxInputStringCharacters as number,
			HARD_LIMITS.maxInputStringCharacters
		)
	};
}

function operationDeadline(
	clock: ReturnType<typeof createMonotonicOperationClock>,
	maxDurationMs: number
): Deadline {
	let lastNow = clock.startedAtMs;
	const check = (phase: SourceOriginCorrelationProgressPhase): void => {
		let current: number;
		try {
			current = clock.now();
		} catch {
			throw new SourceOriginCorrelationFailure(
				'BUDGET_EXCEEDED',
				'Source-origin monotonic clock failed closed.',
				phase,
				'$.request.budgets.maxDurationMs'
			);
		}
		if (
			!Number.isSafeInteger(current) ||
			current < lastNow ||
			current - clock.startedAtMs > maxDurationMs
		)
			throw new SourceOriginCorrelationFailure(
				'BUDGET_EXCEEDED',
				'Source-origin correlation exceeded maxDurationMs.',
				phase,
				'$.request.budgets.maxDurationMs'
			);
		lastNow = current;
	};
	return {
		check,
		remaining(phase): number {
			check(phase);
			const remaining = maxDurationMs - (lastNow - clock.startedAtMs);
			if (!Number.isSafeInteger(remaining) || remaining < 1)
				throw new SourceOriginCorrelationFailure(
					'BUDGET_EXCEEDED',
					'Source-origin correlation has no remaining provider duration.',
					phase,
					'$.request.budgets.maxDurationMs'
				);
			return remaining;
		}
	};
}

function positiveBudgets(value: unknown): SourceOriginCorrelationBudgets {
	const record = exactPlainRecord(value, BUDGET_KEYS, '$inputs.request.budgets');
	const result: Record<string, number> = {};
	for (const key of BUDGET_KEYS) {
		const entry = record[key];
		if (typeof entry !== 'number' || !Number.isSafeInteger(entry) || entry < 1)
			throw new SourceOriginCorrelationFailure(
				'REQUEST_INVALID',
				'Source-origin budgets must be positive safe integers.',
				'REQUEST_BIND',
				`$.request.budgets.${key}`
			);
		result[key] = entry;
	}
	return result as unknown as SourceOriginCorrelationBudgets;
}

function sameSelectionValue(actual: unknown, expected: unknown, deadline: Deadline): boolean {
	deadline.check('REQUEST_BIND');
	if (typeof expected === 'string') {
		if (typeof actual !== 'string' || actual.length !== expected.length) return false;
		for (let index = 0; index < expected.length; index += 1) {
			checkpointLoop(index, deadline, 'REQUEST_BIND');
			if (actual.charCodeAt(index) !== expected.charCodeAt(index)) return false;
		}
		return true;
	}
	if (Array.isArray(expected)) {
		if (
			!Array.isArray(actual) ||
			isProxy(actual) ||
			Reflect.getPrototypeOf(actual) !== Array.prototype ||
			actual.length !== expected.length
		)
			return false;
		deadline.check('REQUEST_BIND');
		const ownKeys = Reflect.ownKeys(actual);
		deadline.check('REQUEST_BIND');
		if (ownKeys.length !== expected.length + 1) return false;
		for (let keyIndex = 0; keyIndex < ownKeys.length; keyIndex += 1) {
			checkpointLoop(keyIndex, deadline, 'REQUEST_BIND');
			const key = ownKeys[keyIndex]!;
			if (key === 'length') continue;
			if (
				typeof key !== 'string' ||
				!/^(?:0|[1-9][0-9]*)$/u.test(key) ||
				Number(key) >= expected.length
			)
				return false;
		}
		for (let index = 0; index < expected.length; index += 1) {
			const descriptor = Reflect.getOwnPropertyDescriptor(actual, String(index));
			if (
				descriptor === undefined ||
				!descriptor.enumerable ||
				!('value' in descriptor) ||
				!sameSelectionValue(descriptor.value, expected[index], deadline)
			)
				return false;
		}
		return true;
	}
	if (expected === null || typeof expected !== 'object') return Object.is(actual, expected);
	const expectedRecord = expected as Readonly<Record<string, unknown>>;
	const keys = Object.keys(expectedRecord);
	let actualRecord: Readonly<Record<string, unknown>>;
	try {
		actualRecord = exactPlainRecord(actual, keys, '$inputs.request.selection');
	} catch {
		return false;
	}
	for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
		checkpointLoop(keyIndex, deadline, 'REQUEST_BIND');
		const key = keys[keyIndex]!;
		if (!sameSelectionValue(actualRecord[key], expectedRecord[key], deadline)) return false;
	}
	return true;
}

function materializeRequest(value: unknown, deadline: Deadline): SourceOriginCorrelationRequest {
	const record = exactPlainRecord(value, REQUEST_KEYS, '$inputs.request');
	const budgets = positiveBudgets(record.budgets);
	const target = exactPlainRecord(
		record.targetDeclaration,
		CAPTURE_DESCRIPTOR_KEYS,
		'$.inputs.request.targetDeclaration'
	);
	const map = exactPlainRecord(
		record.declarationMap,
		CAPTURE_DESCRIPTOR_KEYS,
		'$.inputs.request.declarationMap'
	);
	if (
		record.operationVersion !== SOURCE_ORIGIN_CORRELATION_OPERATION_VERSION ||
		record.schemaVersion !== SOURCE_ORIGIN_CORRELATION_REQUEST_SCHEMA_VERSION ||
		!sameSelectionValue(record.selection, SOURCE_ORIGIN_CORRELATION_SELECTION, deadline)
	)
		throw new SourceOriginCorrelationFailure(
			'UNSUPPORTED_REQUEST',
			'Source-origin request version or selection is unsupported.',
			'REQUEST_BIND'
		);
	if (
		budgets.maxDiagnostics > HARD_LIMITS.maxDiagnostics ||
		budgets.maxEmitOutputs < 2 ||
		budgets.maxReadBytes < budgets.maxProgramReadBytes ||
		budgets.maxOutputRecords < 8 ||
		budgets.maxLocations < 2 ||
		budgets.maxCorrelations < 1 ||
		budgets.maxUnmappedGeneratedLines < 1
	)
		throw new SourceOriginCorrelationFailure(
			'REQUEST_INVALID',
			'Source-origin budgets cannot support the fixed v1 population.',
			'REQUEST_BIND',
			'$.request.budgets'
		);
	for (const key of [
		'semanticProgramId',
		'semanticProjectId',
		'semanticSnapshotId',
		'semanticSourceId',
		'subjectId'
	] as const) {
		const entry = record[key];
		if (
			typeof entry !== 'string' ||
			entry.length === 0 ||
			entry.length > HARD_LIMITS.maxPathCharacters ||
			!checkpointedUnicodeScalarString(entry, deadline, 'REQUEST_BIND')
		)
			throw new SourceOriginCorrelationFailure(
				'REQUEST_INVALID',
				`Source-origin ${key} must be bounded nonempty Unicode scalar text.`,
				'REQUEST_BIND',
				`$.request.${key}`
			);
	}
	if (!SHA256.test(record.subjectId as string))
		throw new SourceOriginCorrelationFailure(
			'REQUEST_INVALID',
			'Source-origin subjectId must be lowercase SHA-256.',
			'REQUEST_BIND',
			'$.request.subjectId'
		);
	const descriptor = (
		input: Readonly<Record<string, unknown>>,
		path: string
	): SourceOriginCorrelationRequest['targetDeclaration'] => {
		if (
			typeof input.contentBytes !== 'number' ||
			!Number.isSafeInteger(input.contentBytes) ||
			(input.contentBytes as number) < 1 ||
			typeof input.contentSha256 !== 'string' ||
			!SHA256.test(input.contentSha256) ||
			typeof input.logicalPath !== 'string' ||
			input.logicalPath.length === 0 ||
			input.logicalPath.length >
				Math.min(budgets.maxPathCharacters, HARD_LIMITS.maxPathCharacters) ||
			!validLogicalPath(input.logicalPath, budgets.maxPathCharacters, deadline, 'REQUEST_BIND')
		)
			throw new SourceOriginCorrelationFailure(
				'REQUEST_INVALID',
				'Source-origin capture descriptor is invalid.',
				'REQUEST_BIND',
				path
			);
		return {
			contentBytes: input.contentBytes as number,
			contentSha256: input.contentSha256,
			logicalPath: input.logicalPath
		};
	};
	const targetDescriptor = descriptor(target, '$.request.targetDeclaration');
	const mapDescriptor = descriptor(map, '$.request.declarationMap');
	if (
		!targetDescriptor.logicalPath.endsWith('.d.ts') ||
		mapDescriptor.logicalPath !== `${targetDescriptor.logicalPath}.map` ||
		!validLogicalPath(
			targetDescriptor.logicalPath,
			budgets.maxPathCharacters,
			deadline,
			'REQUEST_BIND'
		) ||
		!validLogicalPath(
			mapDescriptor.logicalPath,
			budgets.maxPathCharacters,
			deadline,
			'REQUEST_BIND'
		)
	)
		throw new SourceOriginCorrelationFailure(
			'UNSUPPORTED_REQUEST',
			'Source-origin target/map paths must be one exact repository-relative .d.ts/.map pair.',
			'REQUEST_BIND'
		);
	return {
		budgets,
		declarationMap: mapDescriptor,
		operationVersion: SOURCE_ORIGIN_CORRELATION_OPERATION_VERSION,
		schemaVersion: SOURCE_ORIGIN_CORRELATION_REQUEST_SCHEMA_VERSION,
		selection: SOURCE_ORIGIN_CORRELATION_SELECTION,
		semanticProgramId:
			record.semanticProgramId as SourceOriginCorrelationRequest['semanticProgramId'],
		semanticProjectId:
			record.semanticProjectId as SourceOriginCorrelationRequest['semanticProjectId'],
		semanticSnapshotId:
			record.semanticSnapshotId as SourceOriginCorrelationRequest['semanticSnapshotId'],
		semanticSourceId: record.semanticSourceId as SourceOriginCorrelationRequest['semanticSourceId'],
		subjectId: record.subjectId as string,
		targetDeclaration: targetDescriptor
	};
}

function materializeInputs(value: unknown, deadline: Deadline): SourceOriginCorrelationBuildInputs {
	const record = exactPlainRecord(value, INPUT_KEYS, '$inputs');
	return {
		declarationMapBytes:
			record.declarationMapBytes as SourceOriginCorrelationBuildInputs['declarationMapBytes'],
		frozenSubject: record.frozenSubject as SourceOriginCorrelationBuildInputs['frozenSubject'],
		request: materializeRequest(record.request, deadline),
		semanticSnapshot:
			record.semanticSnapshot as SourceOriginCorrelationBuildInputs['semanticSnapshot'],
		targetDeclarationBytes:
			record.targetDeclarationBytes as SourceOriginCorrelationBuildInputs['targetDeclarationBytes']
	};
}

function checkpointLoop(
	index: number,
	deadline: Deadline,
	phase: SourceOriginCorrelationProgressPhase
): void {
	if (index % RESOURCE_CHECKPOINT_CADENCE === 0) deadline.check(phase);
}

function checkpointedUnicodeScalarString(
	value: string,
	deadline: Deadline,
	phase: SourceOriginCorrelationProgressPhase
): boolean {
	for (let index = 0; index < value.length; index += 1) {
		checkpointLoop(index, deadline, phase);
		const code = value.charCodeAt(index);
		if (code >= 0xd800 && code <= 0xdbff) {
			const trailing = value.charCodeAt(index + 1);
			if (!(trailing >= 0xdc00 && trailing <= 0xdfff)) {
				deadline.check(phase);
				return false;
			}
			index += 1;
		} else if (code >= 0xdc00 && code <= 0xdfff) {
			deadline.check(phase);
			return false;
		}
	}
	deadline.check(phase);
	return true;
}

/** The census has exactly three roots: request, FrozenSubject, and semanticSnapshot. */
function inputCensus(inputs: SourceOriginCorrelationBuildInputs, deadline: Deadline): InputCensus {
	const limits = inputs.request.budgets;
	const maximumRecords = Math.min(limits.maxInputRecords, HARD_LIMITS.maxInputRecords);
	const maximumStringCharacters = Math.min(
		limits.maxInputStringCharacters,
		HARD_LIMITS.maxInputStringCharacters
	);
	let records = 0;
	let stringCharacters = 0;
	for (const root of [inputs.request, inputs.frozenSubject, inputs.semanticSnapshot]) {
		type Frame = {
			depth: number;
			entered: boolean;
			index: number;
			keys: readonly PropertyKey[];
			value: unknown;
		};
		const pending: Frame[] = [{ depth: 0, entered: false, index: 0, keys: [], value: root }];
		const active = new WeakSet<object>();
		while (pending.length > 0) {
			deadline.check('INPUT_BUDGET');
			const frame = pending[pending.length - 1]!;
			if (frame.entered) {
				if (frame.index >= frame.keys.length) {
					active.delete(frame.value as object);
					pending.pop();
					continue;
				}
				const key = frame.keys[frame.index++]!;
				const array = Array.isArray(frame.value);
				if (typeof key !== 'string')
					throw new SourceOriginCorrelationFailure(
						'REQUEST_INVALID',
						'Symbol input keys are unsupported.',
						'INPUT_BUDGET'
					);
				if (array && key === 'length') continue;
				if (
					array &&
					(!/^(?:0|[1-9][0-9]*)$/u.test(key) || Number(key) >= (frame.value as unknown[]).length)
				)
					throw new SourceOriginCorrelationFailure(
						'REQUEST_INVALID',
						'Input arrays must be dense.',
						'INPUT_BUDGET'
					);
				const descriptor = Reflect.getOwnPropertyDescriptor(frame.value as object, key);
				if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
					throw new SourceOriginCorrelationFailure(
						'REQUEST_INVALID',
						'Input properties must be enumerable data properties.',
						'INPUT_BUDGET'
					);
				stringCharacters = checkedAdd(stringCharacters, key.length);
				if (stringCharacters > maximumStringCharacters)
					throw new SourceOriginCorrelationFailure(
						'BUDGET_EXCEEDED',
						'Input string-character budget was exhausted.',
						'INPUT_BUDGET'
					);
				pending.push({
					depth: frame.depth + 1,
					entered: false,
					index: 0,
					keys: [],
					value: descriptor.value
				});
				continue;
			}
			if (++records > maximumRecords)
				throw new SourceOriginCorrelationFailure(
					'BUDGET_EXCEEDED',
					'Input record budget was exhausted.',
					'INPUT_BUDGET'
				);
			if (frame.depth > HARD_INPUT_DEPTH)
				throw new SourceOriginCorrelationFailure(
					'BUDGET_EXCEEDED',
					'Input depth ceiling was exceeded.',
					'INPUT_BUDGET'
				);
			const value = frame.value;
			if (typeof value === 'string') {
				stringCharacters = checkedAdd(stringCharacters, value.length);
				if (stringCharacters > maximumStringCharacters)
					throw new SourceOriginCorrelationFailure(
						'BUDGET_EXCEEDED',
						'Input string-character budget was exhausted.',
						'INPUT_BUDGET'
					);
				if (!checkpointedUnicodeScalarString(value, deadline, 'INPUT_BUDGET'))
					throw new SourceOriginCorrelationFailure(
						'REQUEST_INVALID',
						'Input strings must contain Unicode scalar text.',
						'INPUT_BUDGET'
					);
				pending.pop();
				continue;
			}
			if (
				value === null ||
				typeof value === 'boolean' ||
				(typeof value === 'number' &&
					Number.isFinite(value) &&
					(!Number.isInteger(value) || Number.isSafeInteger(value)) &&
					!Object.is(value, -0))
			) {
				pending.pop();
				continue;
			}
			if (typeof value !== 'object' || isProxy(value))
				throw new SourceOriginCorrelationFailure(
					'REQUEST_INVALID',
					'Inputs must be inert JSON-compatible plain data.',
					'INPUT_BUDGET'
				);
			if (active.has(value))
				throw new SourceOriginCorrelationFailure(
					'REQUEST_INVALID',
					'Cyclic input data is unsupported.',
					'INPUT_BUDGET'
				);
			const array = Array.isArray(value);
			const prototype = Reflect.getPrototypeOf(value);
			if (
				(array && prototype !== Array.prototype) ||
				(!array && prototype !== Object.prototype && prototype !== null)
			)
				throw new SourceOriginCorrelationFailure(
					'REQUEST_INVALID',
					'Input containers must have ordinary prototypes.',
					'INPUT_BUDGET'
				);
			const remainingRecords = maximumRecords - records;
			let arrayLength: number | null = null;
			if (array) {
				deadline.check('INPUT_BUDGET');
				const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
				deadline.check('INPUT_BUDGET');
				if (
					lengthDescriptor === undefined ||
					lengthDescriptor.enumerable ||
					!('value' in lengthDescriptor) ||
					typeof lengthDescriptor.value !== 'number' ||
					!Number.isSafeInteger(lengthDescriptor.value) ||
					lengthDescriptor.value < 0
				)
					throw new SourceOriginCorrelationFailure(
						'REQUEST_INVALID',
						'Input arrays must have an ordinary length data property.',
						'INPUT_BUDGET'
					);
				arrayLength = lengthDescriptor.value;
				if (arrayLength > remainingRecords)
					throw new SourceOriginCorrelationFailure(
						'BUDGET_EXCEEDED',
						'Input array population exceeds the remaining record budget.',
						'INPUT_BUDGET'
					);
			}
			deadline.check('INPUT_BUDGET');
			const keys = Reflect.ownKeys(value);
			deadline.check('INPUT_BUDGET');
			if (!array && keys.length > remainingRecords)
				throw new SourceOriginCorrelationFailure(
					'BUDGET_EXCEEDED',
					'Input container population exceeds the remaining record budget.',
					'INPUT_BUDGET'
				);
			if (array) {
				if (keys.length !== arrayLength! + 1)
					throw new SourceOriginCorrelationFailure(
						'REQUEST_INVALID',
						'Input arrays must be dense.',
						'INPUT_BUDGET'
					);
			}
			active.add(value);
			frame.entered = true;
			frame.keys = keys;
		}
	}
	return Object.freeze({ records, stringCharacters });
}

function captureLength(value: unknown, path: string): number {
	if (value === null || typeof value !== 'object' || isProxy(value))
		throw new SourceOriginCorrelationFailure(
			'CAPTURE_INVALID',
			'Caller captures must be ordinary unshared Uint8Array values.',
			'CAPTURE_BIND',
			path
		);
	try {
		if (Reflect.getPrototypeOf(value) !== UINT8_ARRAY_PROTOTYPE) throw new TypeError();
		const buffer = REFLECT_APPLY(TYPED_ARRAY_BUFFER_GETTER, value, []) as ArrayBuffer;
		if (Reflect.getPrototypeOf(buffer) !== ARRAY_BUFFER_PROTOTYPE) throw new TypeError();
		const length = REFLECT_APPLY(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []) as number;
		if (!Number.isSafeInteger(length) || length < 0) throw new TypeError();
		return length;
	} catch {
		throw new SourceOriginCorrelationFailure(
			'CAPTURE_INVALID',
			'Caller capture inspection failed closed.',
			'CAPTURE_BIND',
			path
		);
	}
}

function copyCapture(
	value: Uint8Array,
	length: number,
	path: string,
	deadline: Deadline
): Uint8Array {
	const copy = new Uint8Array(length);
	for (let offset = 0; offset < length; offset += BYTE_CHUNK_SIZE) {
		deadline.check('CAPTURE_BIND');
		try {
			const chunk = REFLECT_APPLY(UINT8_ARRAY_SUBARRAY, value, [
				offset,
				Math.min(length, offset + BYTE_CHUNK_SIZE)
			]) as Uint8Array;
			REFLECT_APPLY(UINT8_ARRAY_SET, copy, [chunk, offset]);
		} catch {
			deadline.check('CAPTURE_BIND');
			throw new SourceOriginCorrelationFailure(
				'CAPTURE_INVALID',
				'Caller capture changed or detached while copying.',
				'CAPTURE_BIND',
				path
			);
		}
	}
	deadline.check('CAPTURE_BIND');
	return copy;
}

function bytesSha256(
	bytes: Uint8Array,
	deadline: Deadline,
	phase: SourceOriginCorrelationProgressPhase
): string {
	const hash = createHash('sha256');
	const length = REFLECT_APPLY(TYPED_ARRAY_BYTE_LENGTH_GETTER, bytes, []) as number;
	for (let offset = 0; offset < length; offset += BYTE_CHUNK_SIZE) {
		deadline.check(phase);
		hash.update(
			REFLECT_APPLY(UINT8_ARRAY_SUBARRAY, bytes, [
				offset,
				Math.min(length, offset + BYTE_CHUNK_SIZE)
			]) as Uint8Array
		);
	}
	deadline.check(phase);
	return hash.digest('hex');
}

function textSha256(
	text: string,
	deadline: Deadline,
	phase: SourceOriginCorrelationProgressPhase
): string {
	return textIdentity(text, deadline, phase).sha256;
}

function textIdentity(
	text: string,
	deadline: Deadline,
	phase: SourceOriginCorrelationProgressPhase
): { readonly bytes: number; readonly sha256: string } {
	const hash = createHash('sha256');
	let bytes = 0;
	for (let offset = 0; offset < text.length; offset += TEXT_CHUNK_SIZE) {
		deadline.check(phase);
		let end = Math.min(text.length, offset + TEXT_CHUNK_SIZE);
		if (
			end < text.length &&
			end > offset &&
			text.charCodeAt(end - 1) >= 0xd800 &&
			text.charCodeAt(end - 1) <= 0xdbff
		)
			end -= 1;
		const chunk = text.slice(offset, end);
		bytes = checkedAdd(bytes, Buffer.byteLength(chunk, 'utf8'));
		hash.update(chunk, 'utf8');
		offset = end - TEXT_CHUNK_SIZE;
	}
	deadline.check(phase);
	return Object.freeze({ bytes, sha256: hash.digest('hex') });
}

function textEqualsBytes(text: string, bytes: Uint8Array, deadline: Deadline): boolean {
	let byteOffset = 0;
	const encoder = new TextEncoder();
	for (let offset = 0; offset < text.length; offset += TEXT_CHUNK_SIZE) {
		deadline.check('EMISSION_RECONCILE');
		let end = Math.min(text.length, offset + TEXT_CHUNK_SIZE);
		if (
			end < text.length &&
			end > offset &&
			text.charCodeAt(end - 1) >= 0xd800 &&
			text.charCodeAt(end - 1) <= 0xdbff
		)
			end -= 1;
		const chunk = encoder.encode(text.slice(offset, end));
		deadline.check('EMISSION_RECONCILE');
		if (byteOffset + chunk.byteLength > bytes.byteLength) {
			deadline.check('EMISSION_RECONCILE');
			return false;
		}
		for (let index = 0; index < chunk.byteLength; index += 1) {
			checkpointLoop(index, deadline, 'EMISSION_RECONCILE');
			if (chunk[index] !== bytes[byteOffset + index]) {
				deadline.check('EMISSION_RECONCILE');
				return false;
			}
		}
		byteOffset += chunk.byteLength;
		offset = end - TEXT_CHUNK_SIZE;
	}
	deadline.check('EMISSION_RECONCILE');
	return byteOffset === bytes.byteLength;
}

function decodeUtf8(bytes: Uint8Array, maximum: number, label: string, deadline: Deadline): string {
	let text: string;
	deadline.check('CAPTURE_BIND');
	try {
		text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
	} catch {
		deadline.check('CAPTURE_BIND');
		throw new SourceOriginCorrelationFailure(
			'CAPTURE_INVALID',
			`${label} must be well-formed UTF-8.`,
			'CAPTURE_BIND'
		);
	}
	deadline.check('CAPTURE_BIND');
	if (text.length > maximum)
		throw new SourceOriginCorrelationFailure(
			'BUDGET_EXCEEDED',
			`${label} violates its bounded UTF-8 profile.`,
			'CAPTURE_BIND'
		);
	if (
		text.charCodeAt(0) === 0xfeff ||
		!checkpointedUnicodeScalarString(text, deadline, 'CAPTURE_BIND')
	)
		throw new SourceOriginCorrelationFailure(
			'CAPTURE_INVALID',
			`${label} violates its bounded UTF-8 profile.`,
			'CAPTURE_BIND'
		);
	return text;
}

function jsonLexicalPreflight(
	text: string,
	budgets: SourceOriginCorrelationBudgets,
	deadline: Deadline
): void {
	let depth = 0;
	let records = 0;
	let inString = false;
	let escaped = false;
	const maximumDepth = Math.min(budgets.maxSourceMapJsonDepth, HARD_LIMITS.maxSourceMapJsonDepth);
	const maximumRecords = Math.min(
		budgets.maxSourceMapJsonRecords,
		HARD_LIMITS.maxSourceMapJsonRecords
	);
	const charge = (): void => {
		records += 1;
		if (records > maximumRecords)
			throw new SourceOriginCorrelationFailure(
				'BUDGET_EXCEEDED',
				'Source-map JSON record budget was exhausted.',
				'SOURCE_MAP_PARSE'
			);
	};
	for (let index = 0; index < text.length; index += 1) {
		checkpointLoop(index, deadline, 'SOURCE_MAP_PARSE');
		const character = text[index]!;
		if (inString) {
			if (escaped) escaped = false;
			else if (character === '\\') escaped = true;
			else if (character === '"') {
				inString = false;
				let cursor = index + 1;
				while (cursor < text.length && /[\t\n\r ]/u.test(text[cursor]!)) {
					checkpointLoop(cursor, deadline, 'SOURCE_MAP_PARSE');
					cursor += 1;
				}
				if (text[cursor] !== ':') charge();
			}
			continue;
		}
		if (character === '"') {
			inString = true;
		} else if (character === '{' || character === '[') {
			charge();
			depth += 1;
			if (depth > maximumDepth)
				throw new SourceOriginCorrelationFailure(
					'BUDGET_EXCEEDED',
					'Source-map JSON depth budget was exhausted.',
					'SOURCE_MAP_PARSE'
				);
		} else if (character === '}' || character === ']') depth -= 1;
		else if (
			(character === '-' || /[0-9tfn]/u.test(character)) &&
			(index === 0 || /[\s[{,:]/u.test(text[index - 1]!))
		)
			charge();
	}
	deadline.check('SOURCE_MAP_PARSE');
}

function validLogicalPath(
	value: string,
	maximum: number,
	deadline: Deadline,
	phase: SourceOriginCorrelationProgressPhase = 'PROGRAM_BIND'
): boolean {
	if (value.length === 0 || value.length > Math.min(maximum, HARD_LIMITS.maxPathCharacters))
		return false;
	if (value.startsWith('/') || value.startsWith('\\')) return false;
	if (!checkpointedUnicodeScalarString(value, deadline, phase)) return false;
	let segmentStart = 0;
	const invalidSegment = (end: number): boolean => {
		const length = end - segmentStart;
		return (
			length === 0 ||
			(length === 1 && value.charCodeAt(segmentStart) === 0x2e) ||
			(length === 2 &&
				value.charCodeAt(segmentStart) === 0x2e &&
				value.charCodeAt(segmentStart + 1) === 0x2e)
		);
	};
	for (let index = 0; index < value.length; index += 1) {
		checkpointLoop(index, deadline, phase);
		const code = value.charCodeAt(index);
		if (code <= 0x1f || code === 0x7f || code === 0x5c || code === 0x3f || code === 0x23)
			return false;
		if (code === 0x2f) {
			if (invalidSegment(index)) return false;
			segmentStart = index + 1;
		}
	}
	deadline.check(phase);
	if (invalidSegment(value.length)) return false;
	deadline.check(phase);
	const hasUriOrDrivePrefix = /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value);
	deadline.check(phase);
	if (hasUriOrDrivePrefix) return false;
	const normalized = posix.normalize(value);
	deadline.check(phase);
	return (
		normalized === value &&
		normalized !== '.' &&
		normalized !== '..' &&
		!normalized.startsWith('../')
	);
}

function uniqueMatch<Value>(
	values: readonly Value[],
	predicate: (value: Value) => boolean,
	label: string,
	deadline: Deadline
): Value {
	let match: Value | undefined;
	let matches = 0;
	for (let index = 0; index < values.length; index += 1) {
		checkpointLoop(index, deadline, 'PROGRAM_BIND');
		if (!predicate(values[index]!)) continue;
		match = values[index];
		matches += 1;
	}
	if (matches !== 1 || match === undefined)
		throw new SourceOriginCorrelationFailure(
			'SOURCE_ORIGIN_UNAVAILABLE',
			`Exact selected ${label} is unavailable.`,
			'PROGRAM_BIND'
		);
	return match;
}

function bindSelection(
	inputs: SourceOriginCorrelationBuildInputs,
	deadline: Deadline
): BoundSelection {
	const request = inputs.request;
	if (
		request.subjectId !== inputs.frozenSubject.descriptor.subjectId ||
		request.subjectId !== inputs.semanticSnapshot.subjectId ||
		request.semanticSnapshotId !== inputs.semanticSnapshot.id
	)
		throw new SourceOriginCorrelationFailure(
			'INPUT_IDENTITY_MISMATCH',
			'Request, subject, and semantic snapshot identities differ.',
			'PROGRAM_BIND'
		);
	const project = uniqueMatch(
		inputs.semanticSnapshot.projects,
		(entry) => entry.id === request.semanticProjectId,
		'project',
		deadline
	);
	const program = uniqueMatch(
		inputs.semanticSnapshot.programs,
		(entry) => entry.id === request.semanticProgramId,
		'Program',
		deadline
	);
	const source = uniqueMatch(
		inputs.semanticSnapshot.sources,
		(entry) => entry.id === request.semanticSourceId,
		'source',
		deadline
	);
	let programMembership = 0;
	for (let index = 0; index < program.sourceIds.length; index += 1) {
		checkpointLoop(index, deadline, 'PROGRAM_BIND');
		if (program.sourceIds[index] === source.id) programMembership += 1;
	}
	let projectMembership = 0;
	for (let index = 0; index < project.sourceIds.length; index += 1) {
		checkpointLoop(index, deadline, 'PROGRAM_BIND');
		if (project.sourceIds[index] === source.id) projectMembership += 1;
	}
	if (
		project.programId !== program.id ||
		program.projectId !== project.id ||
		source.projectId !== project.id ||
		source.programId !== program.id ||
		source.origin !== 'AUTHORED' ||
		source.declarationFile ||
		!source.rootFile ||
		programMembership !== 1 ||
		projectMembership !== 1 ||
		!validLogicalPath(
			source.logicalPath,
			request.budgets.maxPathCharacters,
			deadline,
			'PROGRAM_BIND'
		)
	)
		throw new SourceOriginCorrelationFailure(
			'SOURCE_ORIGIN_UNAVAILABLE',
			'Selected source is not one exact authored Program root.',
			'PROGRAM_BIND'
		);
	const artifact = uniqueMatch(
		inputs.frozenSubject.artifacts,
		(entry) => entry.path === source.logicalPath,
		'FrozenSubject artifact',
		deadline
	);
	if (artifact.bytes !== source.bytes || artifact.sha256 !== source.contentSha256)
		throw new SourceOriginCorrelationFailure(
			'INPUT_IDENTITY_MISMATCH',
			'Authored source does not reconcile with the FrozenSubject manifest.',
			'PROGRAM_BIND'
		);
	return { program, project, source };
}

function compareUtf16(left: string, right: string, deadline?: Deadline): number {
	const length = Math.min(left.length, right.length);
	for (let index = 0; index < length; index += 1) {
		if (deadline !== undefined) checkpointLoop(index, deadline, 'PROGRAM_SOURCE_ACCOUNT');
		const difference = left.charCodeAt(index) - right.charCodeAt(index);
		if (difference !== 0) return difference < 0 ? -1 : 1;
	}
	return left.length < right.length ? -1 : left.length > right.length ? 1 : 0;
}

function programSources(
	inputs: SourceOriginCorrelationBuildInputs,
	bound: BoundSelection,
	deadline: Deadline
): readonly SourceOriginProgramSourceIdentity[] {
	const maximum = Math.min(
		inputs.request.budgets.maxProgramSourceFiles,
		HARD_LIMITS.maxProgramSourceFiles
	);
	if (bound.program.sourceIds.length > maximum)
		throw new SourceOriginCorrelationFailure(
			'BUDGET_EXCEEDED',
			'Program source population exceeds its budget.',
			'PROGRAM_SOURCE_ACCOUNT'
		);
	const result: SourceOriginProgramSourceIdentity[] = [];
	const paths = new Set<string>();
	for (let index = 0; index < inputs.semanticSnapshot.sources.length; index += 1) {
		checkpointLoop(index, deadline, 'PROGRAM_SOURCE_ACCOUNT');
		const source = inputs.semanticSnapshot.sources[index]!;
		if (source.programId !== bound.program.id) continue;
		if (
			!validLogicalPath(
				source.logicalPath,
				inputs.request.budgets.maxPathCharacters,
				deadline,
				'PROGRAM_SOURCE_ACCOUNT'
			) ||
			paths.has(source.logicalPath)
		)
			throw new SourceOriginCorrelationFailure(
				'INPUT_POPULATION_MISMATCH',
				'Program source paths are invalid or repeated.',
				'PROGRAM_SOURCE_ACCOUNT'
			);
		if (result.length >= maximum || paths.size >= maximum)
			throw new SourceOriginCorrelationFailure(
				'BUDGET_EXCEEDED',
				'Program source population exceeds its budget.',
				'PROGRAM_SOURCE_ACCOUNT'
			);
		paths.add(source.logicalPath);
		const identity: SourceOriginProgramSourceIdentity = {
			bytes: source.bytes,
			contentSha256: source.contentSha256,
			declarationFile: source.declarationFile,
			logicalPath: source.logicalPath,
			origin: source.origin,
			semanticSourceId: source.id
		};
		result.push(identity);
	}
	if (result.length !== bound.program.sourceIds.length)
		throw new SourceOriginCorrelationFailure(
			'INPUT_POPULATION_MISMATCH',
			'Program source population does not reconcile.',
			'PROGRAM_SOURCE_ACCOUNT'
		);
	result.sort((left, right) => {
		deadline.check('PROGRAM_SOURCE_ACCOUNT');
		return (
			compareUtf16(left.logicalPath, right.logicalPath, deadline) ||
			compareUtf16(left.semanticSourceId, right.semanticSourceId, deadline)
		);
	});
	return result;
}

interface TextLineBounds {
	readonly endColumn: number;
	readonly startOffset: number;
}

interface TextLine extends TextLineBounds {
	readonly content: string;
	readonly endOffset: number;
	readonly line: number;
	readonly lineTerminatorWidth: 0 | 1 | 2;
}

function textLines(text: string, maximum: number, deadline: Deadline): readonly TextLine[] {
	const lines: TextLine[] = [];
	let start = 0;
	let index = 0;
	while (index < text.length) {
		checkpointLoop(index, deadline, 'LOCATION_BIND');
		const code = text.charCodeAt(index);
		if (code !== 10 && code !== 13) {
			index += 1;
			continue;
		}
		const width: 1 | 2 = code === 13 && text.charCodeAt(index + 1) === 10 ? 2 : 1;
		if (lines.length >= maximum)
			throw new SourceOriginCorrelationFailure(
				'BUDGET_EXCEEDED',
				'Text line budget was exhausted.',
				'LOCATION_BIND'
			);
		lines.push({
			content: text.slice(start, index),
			endColumn: index - start,
			endOffset: index,
			line: lines.length,
			lineTerminatorWidth: width,
			startOffset: start
		});
		index += width;
		start = index;
	}
	if (start < text.length || text.length === 0) {
		if (lines.length >= maximum)
			throw new SourceOriginCorrelationFailure(
				'BUDGET_EXCEEDED',
				'Text line budget was exhausted.',
				'LOCATION_BIND'
			);
		lines.push({
			content: text.slice(start),
			endColumn: text.length - start,
			endOffset: text.length,
			line: lines.length,
			lineTerminatorWidth: 0,
			startOffset: start
		});
	}
	return lines;
}

function referencedTextLineBounds(
	text: string,
	referencedLines: ReadonlySet<number>,
	maximumRetainedLines: number,
	deadline: Deadline
): ReadonlyMap<number, TextLineBounds> {
	if (referencedLines.size > maximumRetainedLines)
		throw new SourceOriginCorrelationFailure(
			'BUDGET_EXCEEDED',
			'Authored source-map line population exceeds its segment bound.',
			'LOCATION_BIND'
		);
	const bounds = new Map<number, TextLineBounds>();
	let line = 0;
	let start = 0;
	const retain = (end: number): void => {
		if (!referencedLines.has(line)) return;
		if (bounds.size >= maximumRetainedLines)
			throw new SourceOriginCorrelationFailure(
				'BUDGET_EXCEEDED',
				'Authored source-map line population exceeds its segment bound.',
				'LOCATION_BIND'
			);
		bounds.set(line, { endColumn: end - start, startOffset: start });
	};
	let index = 0;
	let iterations = 0;
	while (index < text.length) {
		checkpointLoop(iterations++, deadline, 'LOCATION_BIND');
		const code = text.charCodeAt(index);
		if (code !== 10 && code !== 13) {
			index += 1;
			continue;
		}
		retain(index);
		if (bounds.size === referencedLines.size) {
			deadline.check('LOCATION_BIND');
			return bounds;
		}
		const width = code === 13 && text.charCodeAt(index + 1) === 10 ? 2 : 1;
		index += width;
		start = index;
		line += 1;
	}
	if (start < text.length || text.length === 0) retain(text.length);
	deadline.check('LOCATION_BIND');
	if (bounds.size !== referencedLines.size)
		throw new SourceOriginCorrelationFailure(
			'SOURCE_MAP_INVALID',
			'Source-map coordinate is outside captured UTF-16 text.',
			'LOCATION_BIND'
		);
	return bounds;
}

function coordinateOffset(entry: TextLineBounds | undefined, column: number): number {
	if (entry === undefined || column > entry.endColumn)
		throw new SourceOriginCorrelationFailure(
			'SOURCE_MAP_INVALID',
			'Source-map coordinate is outside captured UTF-16 text.',
			'LOCATION_BIND'
		);
	return entry.startOffset + column;
}

function denseDataValues(
	value: unknown,
	expectedLength: number,
	path: string,
	deadline: Deadline
): readonly unknown[] {
	deadline.check('EMISSION_RECONCILE');
	if (
		!Array.isArray(value) ||
		isProxy(value) ||
		Reflect.getPrototypeOf(value) !== Array.prototype ||
		value.length !== expectedLength
	)
		throw new SourceOriginCorrelationFailure(
			'EMISSION_FAILED',
			'Fresh emission arrays must be ordinary dense arrays.',
			'EMISSION_RECONCILE',
			path
		);
	deadline.check('EMISSION_RECONCILE');
	const keys = Reflect.ownKeys(value);
	deadline.check('EMISSION_RECONCILE');
	if (keys.length !== expectedLength + 1)
		throw new SourceOriginCorrelationFailure(
			'EMISSION_FAILED',
			'Fresh emission arrays have an invalid key population.',
			'EMISSION_RECONCILE',
			path
		);
	const result: unknown[] = [];
	for (let index = 0; index < expectedLength; index += 1) {
		checkpointLoop(index, deadline, 'EMISSION_RECONCILE');
		const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new SourceOriginCorrelationFailure(
				'EMISSION_FAILED',
				'Fresh emission arrays require enumerable data elements.',
				'EMISSION_RECONCILE',
				path
			);
		result.push(descriptor.value);
	}
	deadline.check('EMISSION_RECONCILE');
	return result;
}

function materializeProviderEmission(
	value: unknown,
	inputs: SourceOriginCorrelationBuildInputs,
	bound: BoundSelection,
	deadline: Deadline
): CompilerProjectDeclarationEmission {
	deadline.check('EMISSION_RECONCILE');
	try {
		const shell = exactPlainRecord(value, PROVIDER_RESULT_KEYS, '$emission');
		deadline.check('EMISSION_RECONCILE');
		if (shell.version !== COMPILER_PROJECT_DECLARATION_EMISSION_VERSION)
			throw new TypeError('unsupported provider version');
		const maximumOutputCharacters = Math.min(
			inputs.request.budgets.maxEmitStringCharacters,
			HARD_LIMITS.maxEmitStringCharacters
		);
		const readOutput = (entry: unknown, ordinal: number, path: string) => {
			deadline.check('EMISSION_RECONCILE');
			const record = exactPlainRecord(entry, PROVIDER_OUTPUT_KEYS, `${path}[${ordinal}]`);
			if (
				!Number.isSafeInteger(record.bytes) ||
				(record.bytes as number) < 0 ||
				!Number.isSafeInteger(record.textLength) ||
				(record.textLength as number) < 0 ||
				typeof record.content !== 'string' ||
				record.content.length !== record.textLength ||
				record.content.length > maximumOutputCharacters ||
				typeof record.contentSha256 !== 'string' ||
				!SHA256.test(record.contentSha256) ||
				typeof record.logicalPath !== 'string' ||
				!validLogicalPath(
					record.logicalPath,
					inputs.request.budgets.maxPathCharacters,
					deadline,
					'EMISSION_RECONCILE'
				) ||
				record.sourceLogicalPath !== bound.source.logicalPath ||
				record.writeByteOrderMark !== false ||
				(record.kind !== 'DECLARATION' && record.kind !== 'DECLARATION_MAP')
			)
				throw new TypeError('invalid output');
			return record;
		};
		const materializeOutput = (record: Readonly<Record<string, unknown>>) => {
			if (
				!checkpointedUnicodeScalarString(record.content as string, deadline, 'EMISSION_RECONCILE')
			)
				throw new TypeError('invalid output');
			return {
				bytes: record.bytes,
				content: record.content,
				contentSha256: record.contentSha256,
				kind: record.kind,
				logicalPath: record.logicalPath,
				sourceLogicalPath: record.sourceLogicalPath,
				textLength: record.textLength,
				writeByteOrderMark: false
			} as CompilerProjectDeclarationEmission['outputs'][number];
		};
		const materializePrimaryOutputPopulation = (population: unknown, path: string) => {
			const values = denseDataValues(population, 2, path, deadline);
			const records = [readOutput(values[0], 0, path), readOutput(values[1], 1, path)] as const;
			if (
				(records[0].content as string).length + (records[1].content as string).length >
				maximumOutputCharacters
			)
				throw new SourceOriginCorrelationFailure(
					'BUDGET_EXCEEDED',
					'Fresh declaration output strings exceed maxEmitStringCharacters.',
					'EMISSION_RECONCILE',
					path
				);
			deadline.check('EMISSION_RECONCILE');
			return [materializeOutput(records[0]), materializeOutput(records[1])] as const;
		};
		const outputs = materializePrimaryOutputPopulation(shell.outputs, '$emission.outputs');
		const sourceRecord = exactPlainRecord(
			shell.materializedSource,
			PROVIDER_SOURCE_KEYS,
			'$emission.materializedSource'
		);
		if (
			!Number.isSafeInteger(sourceRecord.contentBytes) ||
			(sourceRecord.contentBytes as number) < 0 ||
			!Number.isSafeInteger(sourceRecord.textLength) ||
			(sourceRecord.textLength as number) < 0 ||
			typeof sourceRecord.contentSha256 !== 'string' ||
			!SHA256.test(sourceRecord.contentSha256) ||
			typeof sourceRecord.logicalPath !== 'string' ||
			!validLogicalPath(
				sourceRecord.logicalPath,
				inputs.request.budgets.maxPathCharacters,
				deadline,
				'EMISSION_RECONCILE'
			) ||
			typeof sourceRecord.text !== 'string' ||
			sourceRecord.text.length !== sourceRecord.textLength ||
			sourceRecord.text.length >
				Math.min(
					inputs.request.budgets.maxSourceTextCodeUnits,
					HARD_LIMITS.maxSourceTextCodeUnits
				) ||
			!checkpointedUnicodeScalarString(sourceRecord.text, deadline, 'EMISSION_RECONCILE')
		)
			throw new TypeError('invalid source');
		for (const key of ['semanticProgramId', 'semanticProjectId', 'semanticSourceId'] as const) {
			const entry = sourceRecord[key];
			if (
				typeof entry !== 'string' ||
				entry.length > HARD_LIMITS.maxPathCharacters ||
				!checkpointedUnicodeScalarString(entry, deadline, 'EMISSION_RECONCILE')
			)
				throw new TypeError('invalid source identity');
		}
		const materializedSource = {
			contentBytes: sourceRecord.contentBytes,
			contentSha256: sourceRecord.contentSha256,
			logicalPath: sourceRecord.logicalPath,
			semanticProgramId: sourceRecord.semanticProgramId,
			semanticProjectId: sourceRecord.semanticProjectId,
			semanticSourceId: sourceRecord.semanticSourceId,
			text: sourceRecord.text,
			textLength: sourceRecord.textLength
		} as CompilerProjectDeclarationEmission['materializedSource'];
		const selectionRecord = exactPlainRecord(
			shell.selection,
			PROVIDER_SELECTION_KEYS,
			'$emission.selection'
		);
		for (const key of PROVIDER_SELECTION_KEYS) {
			const entry = selectionRecord[key];
			if (
				typeof entry !== 'string' ||
				entry.length > HARD_LIMITS.maxPathCharacters ||
				!checkpointedUnicodeScalarString(entry, deadline, 'EMISSION_RECONCILE')
			)
				throw new TypeError('invalid selection');
		}
		if (
			!validLogicalPath(
				selectionRecord.logicalPath as string,
				inputs.request.budgets.maxPathCharacters,
				deadline,
				'EMISSION_RECONCILE'
			)
		)
			throw new TypeError('invalid selection path');
		const selection = {
			logicalPath: selectionRecord.logicalPath,
			semanticProgramId: selectionRecord.semanticProgramId,
			semanticProjectId: selectionRecord.semanticProjectId,
			semanticSourceId: selectionRecord.semanticSourceId
		} as CompilerProjectDeclarationEmission['selection'];
		const witnessRecord = exactPlainRecord(
			shell.emissionWitness,
			PROVIDER_WITNESS_KEYS,
			'$emission.emissionWitness'
		);
		for (const key of [
			'attributedCompilerInputAttempts',
			'attributedProgramReadBytes',
			'attributedUniqueQueries',
			'declarationEmitCompilerInputAttempts',
			'declarationEmitReadBytes',
			'programCompilerInputAttempts',
			'programPresentReadFileAttempts',
			'programReadBytes',
			'programSourceFiles'
		] as const)
			if (!Number.isSafeInteger(witnessRecord[key]) || (witnessRecord[key] as number) < 0)
				throw new TypeError('invalid witness count');
		for (const key of [
			'captureContextDigest',
			'compilerOptionsDigest',
			'materializedRecipeDigest',
			'programInputAttemptPopulationDigest',
			'programSourcePopulationDigest',
			'projectResolutionDigest'
		] as const)
			if (typeof witnessRecord[key] !== 'string' || !SHA256.test(witnessRecord[key] as string))
				throw new TypeError('invalid witness digest');
		for (const key of [
			'compilerVersion',
			'configPath',
			'selectedSourceLogicalPath',
			'semanticProgramId',
			'semanticProjectId',
			'semanticSourceId'
		] as const) {
			const entry = witnessRecord[key];
			if (
				typeof entry !== 'string' ||
				entry.length > HARD_LIMITS.maxPathCharacters ||
				!checkpointedUnicodeScalarString(entry, deadline, 'EMISSION_RECONCILE')
			)
				throw new TypeError('invalid witness string');
		}
		for (const key of ['configPath', 'selectedSourceLogicalPath'] as const)
			if (
				!validLogicalPath(
					witnessRecord[key] as string,
					inputs.request.budgets.maxPathCharacters,
					deadline,
					'EMISSION_RECONCILE'
				)
			)
				throw new TypeError('invalid witness path');
		const witnessOutputValues = denseDataValues(
			witnessRecord.outputs,
			2,
			'$emission.emissionWitness.outputs',
			deadline
		);
		for (let index = 0; index < 2; index += 1) {
			const left = outputs[index]!;
			const right = exactPlainRecord(
				witnessOutputValues[index],
				PROVIDER_OUTPUT_KEYS,
				`$emission.emissionWitness.outputs[${index}]`
			);
			if (
				typeof right.bytes !== 'number' ||
				typeof right.content !== 'string' ||
				typeof right.contentSha256 !== 'string' ||
				typeof right.kind !== 'string' ||
				typeof right.logicalPath !== 'string' ||
				typeof right.sourceLogicalPath !== 'string' ||
				typeof right.textLength !== 'number' ||
				typeof right.writeByteOrderMark !== 'boolean'
			)
				throw new TypeError('witness output primitives are invalid');
			for (const key of PROVIDER_OUTPUT_KEYS) {
				deadline.check('EMISSION_RECONCILE');
				const equal = left[key] === right[key];
				deadline.check('EMISSION_RECONCILE');
				if (!equal) throw new TypeError('witness outputs differ');
			}
		}
		if (
			denseDataValues(
				witnessRecord.emitDiagnostics,
				0,
				'$emission.emissionWitness.emitDiagnostics',
				deadline
			).length !== 0 ||
			witnessRecord.declarationEmitCallbacksUseOnlyAttributedQueries !== true ||
			witnessRecord.emitApi !== 'TYPESCRIPT_PUBLIC_PROGRAM_EMIT' ||
			witnessRecord.emitOnlyDtsFiles !== true ||
			witnessRecord.emitSkipped !== false ||
			witnessRecord.programCallbacksWithinAttributedInvocationBounds !== true ||
			witnessRecord.programInputAttemptPopulationReconciles !== true ||
			witnessRecord.programSourceFilePopulationReconciles !== true ||
			witnessRecord.state !==
				'FRESH_PUBLIC_TYPESCRIPT_DECLARATION_EMISSION_OVER_VERIFIED_PROJECT_SCOPED_CAPTURE'
		)
			throw new TypeError('invalid witness constants');
		const emissionWitness = {
			...witnessRecord,
			emitDiagnostics: [] as const,
			outputs
		} as unknown as CompilerProjectDeclarationEmission['emissionWitness'];
		return {
			emissionWitness,
			materializedSource,
			outputs,
			selection,
			version: COMPILER_PROJECT_DECLARATION_EMISSION_VERSION
		};
	} catch (error) {
		if (error instanceof SourceOriginCorrelationFailure) throw error;
		deadline.check('EMISSION_RECONCILE');
		throw new SourceOriginCorrelationFailure(
			'EMISSION_FAILED',
			'Fresh declaration provider returned malformed or active evidence.',
			'EMISSION_RECONCILE'
		);
	}
}

function deepFreeze<Value>(value: Value, deadline: Deadline): Value {
	type Frame =
		| { index: number; readonly length: number; readonly state: 'ARRAY'; readonly value: unknown[] }
		| {
				index: number;
				readonly keys: readonly PropertyKey[];
				readonly state: 'OBJECT';
				readonly value: object;
		  };
	const pending: Frame[] = [];
	const seen = new WeakSet<object>();
	const frameFor = (entry: object): Frame => {
		if (Array.isArray(entry))
			return { index: 0, length: entry.length, state: 'ARRAY', value: entry };
		const keys = Reflect.ownKeys(entry);
		deadline.check('MATERIALIZE');
		return { index: 0, keys, state: 'OBJECT', value: entry };
	};
	if (value !== null && typeof value === 'object') {
		seen.add(value);
		pending.push(frameFor(value));
	}
	while (pending.length > 0) {
		deadline.check('MATERIALIZE');
		const frame = pending[pending.length - 1]!;
		const length = frame.state === 'ARRAY' ? frame.length : frame.keys.length;
		if (frame.index >= length) {
			Object.freeze(frame.value);
			deadline.check('MATERIALIZE');
			pending.pop();
			continue;
		}
		const key = frame.state === 'ARRAY' ? String(frame.index++) : frame.keys[frame.index++]!;
		const descriptor = Reflect.getOwnPropertyDescriptor(frame.value, key);
		if (
			descriptor === undefined ||
			!('value' in descriptor) ||
			descriptor.value === null ||
			typeof descriptor.value !== 'object' ||
			seen.has(descriptor.value)
		)
			continue;
		seen.add(descriptor.value);
		pending.push(frameFor(descriptor.value));
	}
	return value;
}

/**
 * Builds the bounded CAP-014 projection. The implementation below is intentionally staged; every
 * failure returns no partial analysis and one frozen diagnostic.
 */
export function buildSourceOriginCorrelation(
	inputsValue: unknown,
	options?: BuildSourceOriginCorrelationOptions
): SourceOriginCorrelationBuildOutcome {
	let clock: ReturnType<typeof createMonotonicOperationClock>;
	let progress: TelemetryRecorder;
	try {
		clock = createMonotonicOperationClock();
		progress = telemetry(options);
	} catch {
		return unavailable(
			'REQUEST_INVALID',
			'Source-origin operation clock or telemetry inspection failed closed.',
			'REQUEST_BIND'
		);
	}
	try {
		progress.start('REQUEST_BIND');
		const preflight = preflightLimits(inputsValue);
		const deadline = operationDeadline(clock, preflight.maxDurationMs);
		deadline.check('REQUEST_BIND');
		const inputs = materializeInputs(inputsValue, deadline);
		if (
			!isFrozenSubjectCapability(inputs.frozenSubject) ||
			isProxy(inputs.frozenSubject) ||
			!Object.isFrozen(inputs.frozenSubject) ||
			inputs.semanticSnapshot === null ||
			typeof inputs.semanticSnapshot !== 'object' ||
			isProxy(inputs.semanticSnapshot) ||
			!Object.isFrozen(inputs.semanticSnapshot)
		)
			throw new SourceOriginCorrelationFailure(
				'CAPTURE_INVALID',
				'Source-origin correlation requires exact frozen subject and semantic capabilities.',
				'REQUEST_BIND'
			);
		progress.complete();

		progress.start('INPUT_BUDGET');
		deadline.check('INPUT_BUDGET');
		const inputStats = inputCensus(inputs, deadline);
		progress.complete({
			inputRecords: inputStats.records,
			inputStringCharacters: inputStats.stringCharacters
		});

		progress.start('CAPTURE_BIND');
		const targetLength = captureLength(
			inputs.targetDeclarationBytes,
			'$inputs.targetDeclarationBytes'
		);
		const mapLength = captureLength(inputs.declarationMapBytes, '$inputs.declarationMapBytes');
		const callerCaptureBytes = checkedAdd(targetLength, mapLength);
		if (
			callerCaptureBytes >
				Math.min(inputs.request.budgets.maxCallerCaptureBytes, HARD_LIMITS.maxCallerCaptureBytes) ||
			callerCaptureBytes > inputs.request.budgets.maxReadBytes
		)
			throw new SourceOriginCorrelationFailure(
				'BUDGET_EXCEEDED',
				'Caller capture bytes exceed request or implementation ceilings.',
				'CAPTURE_BIND'
			);
		const targetBytes = copyCapture(
			inputs.targetDeclarationBytes as Uint8Array,
			targetLength,
			'$inputs.targetDeclarationBytes',
			deadline
		);
		const mapBytes = copyCapture(
			inputs.declarationMapBytes as Uint8Array,
			mapLength,
			'$inputs.declarationMapBytes',
			deadline
		);
		const targetSha256 = bytesSha256(targetBytes, deadline, 'CAPTURE_BIND');
		const mapSha256 = bytesSha256(mapBytes, deadline, 'CAPTURE_BIND');
		if (
			targetLength !== inputs.request.targetDeclaration.contentBytes ||
			targetSha256 !== inputs.request.targetDeclaration.contentSha256 ||
			mapLength !== inputs.request.declarationMap.contentBytes ||
			mapSha256 !== inputs.request.declarationMap.contentSha256
		)
			throw new SourceOriginCorrelationFailure(
				'INPUT_IDENTITY_MISMATCH',
				'Caller captures do not reconcile with declared length and SHA-256.',
				'CAPTURE_BIND'
			);
		const targetText = decodeUtf8(
			targetBytes,
			Math.min(inputs.request.budgets.maxEmitStringCharacters, HARD_LIMITS.maxEmitStringCharacters),
			'Target declaration capture',
			deadline
		);
		const mapText = decodeUtf8(
			mapBytes,
			Math.min(inputs.request.budgets.maxEmitStringCharacters, HARD_LIMITS.maxEmitStringCharacters),
			'Declaration-map capture',
			deadline
		);
		const callerCaptureStringCharacters = checkedAdd(targetText.length, mapText.length);
		if (
			callerCaptureStringCharacters >
			Math.min(inputs.request.budgets.maxEmitStringCharacters, HARD_LIMITS.maxEmitStringCharacters)
		)
			throw new SourceOriginCorrelationFailure(
				'BUDGET_EXCEEDED',
				'Caller capture strings exceed maxEmitStringCharacters.',
				'CAPTURE_BIND'
			);
		const capturedInputs: SourceOriginCorrelationBuildInputs = {
			...inputs,
			declarationMapBytes: mapBytes,
			targetDeclarationBytes: targetBytes
		};
		progress.complete({ callerCaptureBytes });

		progress.start('SEMANTIC_SNAPSHOT_VALIDATE');
		deadline.check('SEMANTIC_SNAPSHOT_VALIDATE');
		let semanticValidation: ReturnType<typeof validateStaticSemanticSnapshot>;
		try {
			semanticValidation = validateStaticSemanticSnapshot(
				inputs.semanticSnapshot,
				{
					maxDepth: HARD_INPUT_DEPTH,
					maxDiagnostics: Math.min(
						inputs.request.budgets.maxDiagnostics,
						HARD_LIMITS.maxDiagnostics
					),
					maxIssues: Math.min(inputs.request.budgets.maxDiagnostics, HARD_LIMITS.maxDiagnostics),
					maxRecords: Math.min(inputs.request.budgets.maxInputRecords, HARD_LIMITS.maxInputRecords),
					maxReferenceChecks: Math.min(
						inputs.request.budgets.maxInputRecords,
						HARD_LIMITS.maxInputRecords
					),
					maxStringCharacters: Math.min(
						inputs.request.budgets.maxInputStringCharacters,
						HARD_LIMITS.maxInputStringCharacters
					)
				},
				{ frozenSubject: inputs.frozenSubject }
			);
		} catch (error) {
			deadline.check('SEMANTIC_SNAPSHOT_VALIDATE');
			throw error;
		}
		deadline.check('SEMANTIC_SNAPSHOT_VALIDATE');
		if (semanticValidation.state !== 'VALID')
			throw new SourceOriginCorrelationFailure(
				semanticValidation.state === 'BUDGET_EXHAUSTED'
					? 'BUDGET_EXCEEDED'
					: 'SEMANTIC_SNAPSHOT_INVALID',
				'Static semantic snapshot is not independently valid for the FrozenSubject.',
				'SEMANTIC_SNAPSHOT_VALIDATE',
				semanticValidation.issues[0]?.path ?? null
			);
		const frozenSubjectWitness = canonicalSemanticJsonWitnessWithProgress(
			inputs.frozenSubject,
			() => deadline.check('SEMANTIC_SNAPSHOT_VALIDATE')
		);
		const semanticSnapshotWitness = canonicalSemanticJsonWitnessWithProgress(
			inputs.semanticSnapshot,
			() => deadline.check('SEMANTIC_SNAPSHOT_VALIDATE')
		);
		progress.complete({ validationIssues: 0 });

		progress.start('PROGRAM_BIND');
		const bound = bindSelection(inputs, deadline);
		if (
			bound.source.textLength >
			Math.min(inputs.request.budgets.maxSourceTextCodeUnits, HARD_LIMITS.maxSourceTextCodeUnits)
		)
			throw new SourceOriginCorrelationFailure(
				'BUDGET_EXCEEDED',
				'Selected authored source exceeds the pre-emission text ceiling.',
				'PROGRAM_BIND',
				'$.semanticSnapshot.sources'
			);
		progress.complete({ selectedSources: 1 });

		progress.start('PROGRAM_SOURCE_ACCOUNT');
		const sourcePopulation = programSources(inputs, bound, deadline);
		const expectedSourcePopulationDigest = sourceOriginProgramSourcePopulationDigest(
			sourcePopulation,
			() => deadline.check('PROGRAM_SOURCE_ACCOUNT')
		);
		progress.complete({ programSourceFiles: sourcePopulation.length });

		progress.start('SOURCE_MAP_PARSE');
		if (
			mapText.length >
			Math.min(
				inputs.request.budgets.maxInputStringCharacters,
				SOURCE_MAP_V3_DECODER_IMPLEMENTATION_LIMITS.maxInputCharacters
			)
		)
			throw new SourceOriginCorrelationFailure(
				'BUDGET_EXCEEDED',
				'Source-map input characters exceed budget.',
				'SOURCE_MAP_PARSE'
			);
		jsonLexicalPreflight(mapText, inputs.request.budgets, deadline);
		progress.complete({ mapCharacters: mapText.length });

		progress.start('SOURCE_MAP_DECODE');
		let decodedMap: DecodedSourceMapV3;
		try {
			decodedMap = decodeSourceMapV3(
				mapText,
				{
					maxCoordinate: Number.MAX_SAFE_INTEGER,
					maxGeneratedLines: Math.min(
						inputs.request.budgets.maxDecodedMapLines,
						SOURCE_MAP_V3_DECODER_IMPLEMENTATION_LIMITS.maxGeneratedLines
					),
					maxInputCharacters: Math.min(
						inputs.request.budgets.maxInputStringCharacters,
						SOURCE_MAP_V3_DECODER_IMPLEMENTATION_LIMITS.maxInputCharacters
					),
					maxMappingsCharacters: Math.min(
						inputs.request.budgets.maxMappingsCharacters,
						SOURCE_MAP_V3_DECODER_IMPLEMENTATION_LIMITS.maxMappingsCharacters
					),
					maxPathCharacters: Math.min(
						inputs.request.budgets.maxPathCharacters,
						SOURCE_MAP_V3_DECODER_IMPLEMENTATION_LIMITS.maxPathCharacters
					),
					maxSegments: Math.min(
						inputs.request.budgets.maxDecodedMapSegments,
						SOURCE_MAP_V3_DECODER_IMPLEMENTATION_LIMITS.maxSegments
					),
					maxVlqDigits: 7
				},
				{ onProgress: () => deadline.check('SOURCE_MAP_DECODE') }
			);
		} catch (error) {
			deadline.check('SOURCE_MAP_DECODE');
			if (error instanceof SourceMapV3DecodeError)
				throw new SourceOriginCorrelationFailure(
					error.code === 'BUDGET_EXCEEDED'
						? 'BUDGET_EXCEEDED'
						: error.code === 'SHAPE_INVALID'
							? 'SOURCE_MAP_UNSUPPORTED'
							: 'SOURCE_MAP_INVALID',
					'Declaration map failed strict Source Map v3 decoding.',
					'SOURCE_MAP_DECODE'
				);
			throw error;
		}
		const prospectiveSegments = decodedMap.segmentCount;
		const prospectiveLocations = checkedMultiply(prospectiveSegments, 2);
		const prospectiveOutputRecords = checkedAdd(8, checkedMultiply(prospectiveSegments, 4));
		if (
			prospectiveSegments >
				Math.min(inputs.request.budgets.maxDecodedMapSegments, HARD_LIMITS.maxDecodedMapSegments) ||
			prospectiveSegments >
				Math.min(inputs.request.budgets.maxCorrelations, HARD_LIMITS.maxCorrelations) ||
			prospectiveLocations >
				Math.min(inputs.request.budgets.maxLocations, HARD_LIMITS.maxLocations) ||
			prospectiveOutputRecords >
				Math.min(inputs.request.budgets.maxOutputRecords, HARD_LIMITS.maxOutputRecords)
		)
			throw new SourceOriginCorrelationFailure(
				'BUDGET_EXCEEDED',
				'Decoded map populations cannot fit output budgets.',
				'SOURCE_MAP_DECODE'
			);
		progress.complete({
			decodedLines: decodedMap.generatedLines,
			decodedSegments: decodedMap.segmentCount
		});

		progress.start('SOURCE_PATH_RESOLVE');
		deadline.check('SOURCE_PATH_RESOLVE');
		const resolvedSourcePath = posix.normalize(
			posix.join(posix.dirname(inputs.request.declarationMap.logicalPath), decodedMap.source)
		);
		deadline.check('SOURCE_PATH_RESOLVE');
		if (
			decodedMap.file !== posix.basename(inputs.request.targetDeclaration.logicalPath) ||
			!validLogicalPath(
				resolvedSourcePath,
				inputs.request.budgets.maxPathCharacters,
				deadline,
				'SOURCE_PATH_RESOLVE'
			) ||
			resolvedSourcePath !== bound.source.logicalPath
		)
			throw new SourceOriginCorrelationFailure(
				'SOURCE_ORIGIN_UNAVAILABLE',
				'Source-map target/source paths do not resolve exactly.',
				'SOURCE_PATH_RESOLVE'
			);
		progress.complete({ resolvedSources: 1 });

		const inputDigest = sourceOriginCorrelationInputDigest(capturedInputs, () =>
			deadline.check('PROGRAM_CONSTRUCT')
		);
		const analysisId = sourceOriginCorrelationId(
			{
				inputDigest,
				semanticProgramId: bound.program.id,
				semanticProjectId: bound.project.id,
				semanticSnapshotId: inputs.semanticSnapshot.id,
				semanticSourceId: bound.source.id,
				subjectId: inputs.request.subjectId
			},
			() => deadline.check('PROGRAM_CONSTRUCT')
		);

		progress.start('PROGRAM_CONSTRUCT');
		deadline.check('PROGRAM_CONSTRUCT');
		progress.complete({ selectedPrograms: 1 });

		progress.start('DECLARATION_EMIT');
		const providerDuration = deadline.remaining('DECLARATION_EMIT');
		const residualInputRecords = inputs.request.budgets.maxInputRecords - 2;
		const residualReadBytes = inputs.request.budgets.maxReadBytes - callerCaptureBytes;
		const providerInputRecords = Math.min(
			residualInputRecords,
			inputs.request.budgets.maxCompilerInputAttempts,
			HARD_LIMITS.maxCompilerInputAttempts
		);
		const providerReadBytes = Math.min(residualReadBytes, HARD_LIMITS.maxReadBytes);
		const providerOutputBytes = Math.min(
			inputs.request.budgets.maxEmitBytes,
			HARD_LIMITS.maxEmitBytes,
			callerCaptureBytes
		);
		const providerOutputStringCharacters = Math.min(
			inputs.request.budgets.maxEmitStringCharacters,
			HARD_LIMITS.maxEmitStringCharacters,
			callerCaptureStringCharacters
		);
		if (
			residualInputRecords < 1 ||
			residualReadBytes < 1 ||
			providerOutputBytes !== callerCaptureBytes ||
			providerOutputStringCharacters !== callerCaptureStringCharacters
		)
			throw new SourceOriginCorrelationFailure(
				'BUDGET_EXCEEDED',
				'No residual aggregate budget remains for exact fresh declaration emission.',
				'DECLARATION_EMIT'
			);
		let emissionValue: unknown;
		try {
			emissionValue =
				sourceOriginCorrelationDeclarationEmissionProvider.emitCompilerProjectDeclaration(
					{
						compilerProgramLimits: {
							maxDurationMs: providerDuration,
							maxProgramInputRecords: Math.min(
								inputs.request.budgets.maxCompilerInputAttempts,
								HARD_LIMITS.maxCompilerInputAttempts,
								providerInputRecords
							),
							maxProgramReadBytes: Math.min(
								inputs.request.budgets.maxProgramReadBytes,
								HARD_LIMITS.maxProgramReadBytes,
								providerReadBytes
							),
							maxProgramSourceFiles: Math.min(
								inputs.request.budgets.maxProgramSourceFiles,
								HARD_LIMITS.maxProgramSourceFiles
							),
							maxTotalInputRecords: providerInputRecords,
							maxTotalReadBytes: providerReadBytes
						},
						frozenSubject: inputs.frozenSubject,
						logicalPath: bound.source.logicalPath,
						semanticProgramId: bound.program.id,
						semanticProjectId: bound.project.id,
						semanticSnapshot: inputs.semanticSnapshot,
						semanticSourceId: bound.source.id
					},
					{
						maxDurationMs: providerDuration,
						maxInputRecords: Math.min(
							inputs.request.budgets.maxCompilerInputAttempts,
							HARD_LIMITS.maxCompilerInputAttempts,
							providerInputRecords
						),
						maxOutputBytes: providerOutputBytes,
						maxOutputFiles: Math.min(
							inputs.request.budgets.maxEmitOutputs,
							HARD_LIMITS.maxEmitOutputs
						),
						maxOutputStringCharacters: providerOutputStringCharacters,
						maxPathCharacters: Math.min(
							inputs.request.budgets.maxPathCharacters,
							HARD_LIMITS.maxPathCharacters
						),
						maxProgramSourceFiles: Math.min(
							inputs.request.budgets.maxProgramSourceFiles,
							HARD_LIMITS.maxProgramSourceFiles
						),
						maxReadBytes: Math.min(
							inputs.request.budgets.maxProgramReadBytes,
							HARD_LIMITS.maxProgramReadBytes,
							providerReadBytes
						),
						maxTraversalSteps: Math.min(
							inputs.request.budgets.maxTraversalSteps,
							HARD_LIMITS.maxTraversalSteps
						)
					},
					Object.freeze({ checkpoint: () => deadline.check('DECLARATION_EMIT') })
				);
		} catch (error) {
			deadline.check('DECLARATION_EMIT');
			if (error instanceof CompilerProjectDeclarationEmissionError) throw error;
			throw new SourceOriginCorrelationFailure(
				'EMISSION_FAILED',
				'Fresh declaration provider failed closed.',
				'DECLARATION_EMIT'
			);
		}
		deadline.check('DECLARATION_EMIT');
		progress.complete();

		progress.start('EMISSION_RECONCILE');
		const emission = materializeProviderEmission(emissionValue, inputs, bound, deadline);
		const witness = emission.emissionWitness;
		const targetOutputs = emission.outputs.filter((output) => output.kind === 'DECLARATION');
		const mapOutputs = emission.outputs.filter((output) => output.kind === 'DECLARATION_MAP');
		if (
			emission.version !== COMPILER_PROJECT_DECLARATION_EMISSION_VERSION ||
			targetOutputs.length !== 1 ||
			mapOutputs.length !== 1
		)
			throw new SourceOriginCorrelationFailure(
				'EMISSION_FAILED',
				'Fresh declaration provider returned an unsupported output population.',
				'EMISSION_RECONCILE'
			);
		const targetOutput = targetOutputs[0]!;
		const mapOutput = mapOutputs[0]!;
		const materializedTextIdentity = textIdentity(
			emission.materializedSource.text,
			deadline,
			'EMISSION_RECONCILE'
		);
		if (
			emission.selection.logicalPath !== bound.source.logicalPath ||
			emission.selection.semanticProgramId !== bound.program.id ||
			emission.selection.semanticProjectId !== bound.project.id ||
			emission.selection.semanticSourceId !== bound.source.id ||
			emission.materializedSource.logicalPath !== bound.source.logicalPath ||
			emission.materializedSource.semanticProgramId !== bound.program.id ||
			emission.materializedSource.semanticProjectId !== bound.project.id ||
			emission.materializedSource.semanticSourceId !== bound.source.id ||
			emission.materializedSource.contentBytes !== bound.source.bytes ||
			emission.materializedSource.contentSha256 !== bound.source.contentSha256 ||
			emission.materializedSource.textLength !== bound.source.textLength ||
			emission.materializedSource.text.length !== emission.materializedSource.textLength ||
			emission.materializedSource.text.length >
				Math.min(
					inputs.request.budgets.maxSourceTextCodeUnits,
					HARD_LIMITS.maxSourceTextCodeUnits
				) ||
			materializedTextIdentity.bytes !== bound.source.bytes ||
			materializedTextIdentity.sha256 !== bound.source.contentSha256
		)
			throw new SourceOriginCorrelationFailure(
				'EMISSION_FAILED',
				'Fresh emission source/selection evidence does not reconcile.',
				'EMISSION_RECONCILE'
			);
		if (
			targetOutput.logicalPath !== inputs.request.targetDeclaration.logicalPath ||
			targetOutput.bytes !== targetLength ||
			targetOutput.contentSha256 !== targetSha256 ||
			targetOutput.textLength !== targetOutput.content.length ||
			!textEqualsBytes(targetOutput.content, targetBytes, deadline) ||
			mapOutput.logicalPath !== inputs.request.declarationMap.logicalPath ||
			mapOutput.bytes !== mapLength ||
			mapOutput.contentSha256 !== mapSha256 ||
			mapOutput.textLength !== mapOutput.content.length ||
			!textEqualsBytes(mapOutput.content, mapBytes, deadline)
		)
			throw new SourceOriginCorrelationFailure(
				'EMISSION_OUTPUT_MISMATCH',
				'Fresh declaration outputs are not exactly byte-equal to caller captures.',
				'EMISSION_RECONCILE'
			);
		if (
			witness.semanticProgramId !== bound.program.id ||
			witness.semanticProjectId !== bound.project.id ||
			witness.semanticSourceId !== bound.source.id ||
			witness.selectedSourceLogicalPath !== bound.source.logicalPath ||
			witness.configPath !== bound.project.configPath ||
			witness.compilerVersion !== inputs.semanticSnapshot.provider.version ||
			witness.programSourceFiles !== sourcePopulation.length ||
			witness.programSourcePopulationDigest !== expectedSourcePopulationDigest ||
			witness.programCompilerInputAttempts >
				Math.min(
					inputs.request.budgets.maxCompilerInputAttempts,
					HARD_LIMITS.maxCompilerInputAttempts
				) ||
			witness.programReadBytes >
				Math.min(inputs.request.budgets.maxProgramReadBytes, HARD_LIMITS.maxProgramReadBytes) ||
			witness.declarationEmitCallbacksUseOnlyAttributedQueries !== true ||
			witness.programCallbacksWithinAttributedInvocationBounds !== true ||
			witness.programInputAttemptPopulationReconciles !== true ||
			witness.programSourceFilePopulationReconciles !== true ||
			witness.emitApi !== 'TYPESCRIPT_PUBLIC_PROGRAM_EMIT' ||
			witness.emitOnlyDtsFiles !== true ||
			witness.emitSkipped !== false ||
			witness.emitDiagnostics.length !== 0
		)
			throw new SourceOriginCorrelationFailure(
				'EMISSION_FAILED',
				'Fresh emission witness does not reconcile.',
				'EMISSION_RECONCILE'
			);
		progress.complete({ reconciledOutputs: 2 });

		progress.start('MATERIALIZE');
		const targetArtifactWithoutId = {
			artifactClass: 'GENERATED_DECLARATION' as const,
			bytes: targetLength,
			captureDescriptorReconciliation: 'EXACT_LOGICAL_PATH_LENGTH_AND_SHA256' as const,
			captureMethod: 'CALLER_SUPPLIED_IMMUTABLE_BYTE_COPY' as const,
			contentSha256: targetSha256,
			declarationFile: true as const,
			emissionReconciliation: 'EXACT_BYTE_EQUAL' as const,
			logicalPath: inputs.request.targetDeclaration.logicalPath,
			ordinal: 0,
			origin: 'GENERATED_DECLARATION' as const,
			role: SOURCE_ORIGIN_CORRELATION_ARTIFACT_ROLE_ORDER[0]
		};
		const targetArtifactId = sourceOriginArtifactId(analysisId, targetArtifactWithoutId, () =>
			deadline.check('MATERIALIZE')
		);
		const mapArtifactWithoutId = {
			artifactClass: 'SOURCE_MAP' as const,
			bytes: mapLength,
			captureDescriptorReconciliation: 'EXACT_LOGICAL_PATH_LENGTH_AND_SHA256' as const,
			captureMethod: 'CALLER_SUPPLIED_IMMUTABLE_BYTE_COPY' as const,
			contentSha256: mapSha256,
			emissionReconciliation: 'EXACT_BYTE_EQUAL' as const,
			logicalPath: inputs.request.declarationMap.logicalPath,
			mapRole: 'EXTERNAL_DECLARATION_MAP' as const,
			ordinal: 1,
			origin: 'GENERATED' as const,
			role: SOURCE_ORIGIN_CORRELATION_ARTIFACT_ROLE_ORDER[1]
		};
		const mapArtifactId = sourceOriginArtifactId(analysisId, mapArtifactWithoutId, () =>
			deadline.check('MATERIALIZE')
		);
		const authoredArtifactWithoutId = {
			artifactClass: 'AUTHORED_SOURCE' as const,
			bytes: bound.source.bytes,
			captureMethod: 'VERIFIED_PROJECT_SCOPED_PROGRAM_SOURCE' as const,
			contentSha256: bound.source.contentSha256,
			frozenSubjectManifestReconciliation: 'EXACT_LOGICAL_PATH_LENGTH_AND_SHA256' as const,
			logicalPath: bound.source.logicalPath,
			ordinal: 2,
			origin: bound.source.origin,
			programSourceReconciliation:
				'EXACT_LOGICAL_PATH_CONTENT_SHA256_AND_SEMANTIC_SOURCE_ID' as const,
			role: SOURCE_ORIGIN_CORRELATION_ARTIFACT_ROLE_ORDER[2],
			semanticProgramId: bound.program.id,
			semanticProjectId: bound.project.id,
			semanticSourceId: bound.source.id
		};
		const authoredArtifactId = sourceOriginArtifactId(analysisId, authoredArtifactWithoutId, () =>
			deadline.check('MATERIALIZE')
		);
		const artifacts = [
			{ ...targetArtifactWithoutId, id: targetArtifactId },
			{ ...mapArtifactWithoutId, id: mapArtifactId },
			{ ...authoredArtifactWithoutId, id: authoredArtifactId }
		] as const;
		const emissionOutputs = [
			{
				artifactId: targetArtifactId,
				bytes: targetOutput.bytes,
				contentSha256: targetOutput.contentSha256,
				logicalPath: targetOutput.logicalPath,
				ordinal: 0 as const,
				role: 'TARGET_DECLARATION' as const,
				sourceFileSemanticSourceIds: [bound.source.id] as const,
				writeByteOrderMark: false as const
			},
			{
				artifactId: mapArtifactId,
				bytes: mapOutput.bytes,
				contentSha256: mapOutput.contentSha256,
				logicalPath: mapOutput.logicalPath,
				ordinal: 1 as const,
				role: 'EXTERNAL_DECLARATION_MAP' as const,
				sourceFileSemanticSourceIds: [bound.source.id] as const,
				writeByteOrderMark: false as const
			}
		] as const;
		const emissionWithoutId = {
			attributedCompilerInputAttempts: witness.attributedCompilerInputAttempts,
			attributedProgramReadBytes: witness.attributedProgramReadBytes,
			attributedUniqueQueries: witness.attributedUniqueQueries,
			captureContextDigest: witness.captureContextDigest,
			compilerOptionsDigest: witness.compilerOptionsDigest,
			compilerVersion: witness.compilerVersion,
			configPath: witness.configPath,
			declarationEmitCallbacksUseOnlyAttributedQueries: true as const,
			declarationEmitCompilerInputAttempts: witness.declarationEmitCompilerInputAttempts,
			declarationEmitReadBytes: witness.declarationEmitReadBytes,
			emitApi: 'TYPESCRIPT_PUBLIC_PROGRAM_EMIT' as const,
			emitDiagnostics: [] as const,
			emitOnlyDtsFiles: true as const,
			emitSkipped: false as const,
			materializedRecipeDigest: witness.materializedRecipeDigest,
			outputReconciliation:
				'EXACT_TARGET_DECLARATION_AND_EXTERNAL_DECLARATION_MAP_BYTE_EQUALITY' as const,
			outputs: emissionOutputs,
			programCallbacksWithinAttributedInvocationBounds: true as const,
			programCompilerInputAttempts: witness.programCompilerInputAttempts,
			programInputAttemptPopulationDigest: witness.programInputAttemptPopulationDigest,
			programInputAttemptPopulationReconciles: true as const,
			programPresentReadFileAttempts: witness.programPresentReadFileAttempts,
			programReadBytes: witness.programReadBytes,
			programSourceFiles: witness.programSourceFiles,
			programSourceFilePopulationReconciles: true as const,
			programSourcePopulationDigest: witness.programSourcePopulationDigest,
			projectResolutionDigest: witness.projectResolutionDigest,
			selectedSourceLogicalPath: bound.source.logicalPath,
			semanticProgramId: bound.program.id,
			semanticProjectId: bound.project.id,
			semanticSourceId: bound.source.id,
			state:
				'FRESH_PUBLIC_TYPESCRIPT_DECLARATION_EMISSION_OVER_VERIFIED_PROJECT_SCOPED_CAPTURE' as const
		};
		const emissionRecord = {
			...emissionWithoutId,
			id: sourceOriginEmissionId(analysisId, emissionWithoutId, () => deadline.check('MATERIALIZE'))
		};
		const sourceMapWithoutChildren = {
			decodedLines: decodedMap.generatedLines,
			decodedSegments: decodedMap.segmentCount,
			file: decodedMap.file,
			format: 'SOURCE_MAP_V3' as const,
			mapArtifactId,
			mappingEncoding: 'BASE64_VLQ' as const,
			mappingsCharacters: decodedMap.mappings.length,
			mappingsSha256: textSha256(decodedMap.mappings, deadline, 'MATERIALIZE'),
			names: [] as const,
			ordinal: 0 as const,
			rawSources: [decodedMap.source] as const,
			resolvedSourceArtifactIds: [authoredArtifactId] as const,
			sourceRoot: '' as const,
			sourcesContent: 'ABSENT' as const,
			targetArtifactId,
			version: 3 as const
		};
		const sourceMapId = sourceOriginSourceMapId(analysisId, sourceMapWithoutChildren, () =>
			deadline.check('MATERIALIZE')
		);
		const mappingHealthWithoutId = {
			authoredCoordinatePopulationUnique: true as const,
			callerCapturePopulationReconciles: true as const,
			completeDecodedSegmentPopulation: true as const,
			correlationPopulationReconciles: true as const,
			emittedDeclarationMapMatchesCapture: true as const,
			emittedDeclarationMatchesCapture: true as const,
			generatedCoordinatePopulationUnique: true as const,
			mapArtifactIdentityMatches: true as const,
			mapParseHealth: 'VALID' as const,
			mappedSegments: decodedMap.segmentCount,
			ordinal: 0 as const,
			reverseLookup: 'TOTAL_UNIQUE_OVER_COMPLETE_MAPPED_SEGMENT_POPULATION' as const,
			sourceArtifactIdentityMatches: true as const,
			sourcePathResolution: 'EXACT_REPOSITORY_INTERNAL' as const,
			state: 'EXACT' as const,
			targetArtifactIdentityMatches: true as const,
			unmappedGeneratedLinesExplicit: true as const
		};
		const mappingHealthId = sourceOriginMappingHealthId(analysisId, mappingHealthWithoutId, () =>
			deadline.check('MATERIALIZE')
		);
		const mappingHealth = { ...mappingHealthWithoutId, id: mappingHealthId };

		progress.complete({ artifacts: 3 });
		progress.start('LOCATION_BIND');
		const targetLines = textLines(
			targetText,
			Math.min(inputs.request.budgets.maxDecodedMapLines + 1, HARD_LIMITS.maxDecodedMapLines + 1),
			deadline
		);
		const referencedAuthoredLines = new Set<number>();
		for (let index = 0; index < decodedMap.segments.length; index += 1) {
			checkpointLoop(index, deadline, 'LOCATION_BIND');
			const originalLine = decodedMap.segments[index]!.originalLine;
			if (referencedAuthoredLines.has(originalLine)) continue;
			if (referencedAuthoredLines.size >= prospectiveSegments)
				throw new SourceOriginCorrelationFailure(
					'BUDGET_EXCEEDED',
					'Authored source-map line population exceeds its segment bound.',
					'LOCATION_BIND'
				);
			referencedAuthoredLines.add(originalLine);
		}
		const authoredLines = referencedTextLineBounds(
			emission.materializedSource.text,
			referencedAuthoredLines,
			prospectiveSegments,
			deadline
		);
		if (targetLines.length !== decodedMap.generatedLines + 1)
			throw new SourceOriginCorrelationFailure(
				'SOURCE_MAP_INVALID',
				'Target must have exactly one final line beyond mapped lines.',
				'LOCATION_BIND'
			);
		const generatedMapped = new Uint8Array(decodedMap.generatedLines);
		deadline.check('LOCATION_BIND');
		const generatedCoordinates = new Set<string>();
		const authoredCoordinates = new Set<string>();
		const segmentRecords: SourceOriginCorrelationSnapshot['segments'][number][] = [];
		const locationRecords: SourceOriginCorrelationSnapshot['locations'][number][] = [];
		const correlationRecords: SourceOriginCorrelationSnapshot['correlations'][number][] = [];
		let priorLine = -1;
		let lineSegmentOrdinal = 0;
		for (const decoded of decodedMap.segments) {
			deadline.check('LOCATION_BIND');
			if (decoded.generatedLine !== priorLine) {
				priorLine = decoded.generatedLine;
				lineSegmentOrdinal = 0;
			}
			const generatedOffset = coordinateOffset(
				targetLines[decoded.generatedLine],
				decoded.generatedColumn
			);
			const authoredOffset = coordinateOffset(
				authoredLines.get(decoded.originalLine),
				decoded.originalColumn
			);
			const generatedKey = `${decoded.generatedLine}:${decoded.generatedColumn}`;
			const authoredKey = `${decoded.originalLine}:${decoded.originalColumn}`;
			if (generatedCoordinates.has(generatedKey) || authoredCoordinates.has(authoredKey))
				throw new SourceOriginCorrelationFailure(
					'SOURCE_MAP_INVALID',
					'Mapped endpoint coordinates must be globally unique.',
					'LOCATION_BIND'
				);
			if (
				generatedCoordinates.size >= prospectiveSegments ||
				authoredCoordinates.size >= prospectiveSegments ||
				segmentRecords.length >= prospectiveSegments ||
				locationRecords.length > prospectiveLocations - 2 ||
				correlationRecords.length >= prospectiveSegments
			)
				throw new SourceOriginCorrelationFailure(
					'BUDGET_EXCEEDED',
					'Derived correlation population exceeded its preflight bound.',
					'LOCATION_BIND'
				);
			generatedCoordinates.add(generatedKey);
			authoredCoordinates.add(authoredKey);
			generatedMapped[decoded.generatedLine] = 1;
			const segmentWithoutId = {
				decodedFieldCount: 4 as const,
				generatedColumn: decoded.generatedColumn,
				generatedLine: decoded.generatedLine,
				lineSegmentOrdinal,
				mapId: sourceMapId,
				nameIndex: null,
				ordinal: decoded.ordinal,
				originalColumn: decoded.originalColumn,
				originalLine: decoded.originalLine,
				sourceArtifactId: authoredArtifactId,
				sourceIndex: 0 as const,
				state: 'MAPPED' as const,
				targetArtifactId
			};
			lineSegmentOrdinal += 1;
			const segmentId = sourceOriginMapSegmentId(analysisId, segmentWithoutId, () =>
				deadline.check('LOCATION_BIND')
			);
			segmentRecords.push({ ...segmentWithoutId, id: segmentId });
			const generatedLocationWithoutId = {
				artifactId: targetArtifactId,
				column: decoded.generatedColumn,
				coordinateEncoding: 'ZERO_BASED_UTF16_CODE_UNIT' as const,
				line: decoded.generatedLine,
				offset: generatedOffset,
				ordinal: decoded.ordinal * 2,
				role: SOURCE_ORIGIN_CORRELATION_LOCATION_ROLE_ORDER[0],
				segmentId,
				width: 0 as const
			};
			const authoredLocationWithoutId = {
				artifactId: authoredArtifactId,
				column: decoded.originalColumn,
				coordinateEncoding: 'ZERO_BASED_UTF16_CODE_UNIT' as const,
				line: decoded.originalLine,
				offset: authoredOffset,
				ordinal: decoded.ordinal * 2 + 1,
				role: SOURCE_ORIGIN_CORRELATION_LOCATION_ROLE_ORDER[1],
				segmentId,
				width: 0 as const
			};
			const generatedLocationId = sourceOriginLocationId(
				analysisId,
				generatedLocationWithoutId,
				() => deadline.check('LOCATION_BIND')
			);
			const authoredLocationId = sourceOriginLocationId(analysisId, authoredLocationWithoutId, () =>
				deadline.check('LOCATION_BIND')
			);
			locationRecords.push(
				{ ...generatedLocationWithoutId, id: generatedLocationId },
				{ ...authoredLocationWithoutId, id: authoredLocationId }
			);
			const correlationWithoutId = {
				authoredLocationId,
				directionality: 'BIDIRECTIONAL_EXACT_ONE_TO_ONE' as const,
				generatedLocationId,
				kind: 'GENERATED_TO_AUTHORED_SOURCE_MAP_SEGMENT' as const,
				mapId: sourceMapId,
				mappingHealthId,
				ordinal: decoded.ordinal,
				segmentId,
				state: 'EXACT' as const
			};
			correlationRecords.push({
				...correlationWithoutId,
				id: sourceOriginExactCorrelationId(analysisId, correlationWithoutId, () =>
					deadline.check('LOCATION_BIND')
				)
			});
		}
		for (let index = 0; index < generatedMapped.length; index += 1) {
			checkpointLoop(index, deadline, 'LOCATION_BIND');
			if (generatedMapped[index] !== 1)
				throw new SourceOriginCorrelationFailure(
					'SOURCE_MAP_INVALID',
					'Every generated line before the trailer must contain a mapping.',
					'LOCATION_BIND'
				);
		}
		progress.complete({ locations: locationRecords.length });

		progress.start('CORRELATION_BIND');
		if (
			segmentRecords.length !== correlationRecords.length ||
			locationRecords.length !== checkedMultiply(segmentRecords.length, 2)
		)
			throw new SourceOriginCorrelationFailure(
				'INPUT_POPULATION_MISMATCH',
				'Segment/location/correlation populations do not reconcile.',
				'CORRELATION_BIND'
			);
		progress.complete({ correlations: correlationRecords.length });

		progress.start('UNMAPPED_LINE_BIND');
		const trailerLine = targetLines[targetLines.length - 1]!;
		const expectedTrailer = `//# sourceMappingURL=${posix.basename(inputs.request.declarationMap.logicalPath)}`;
		if (
			trailerLine.content !== expectedTrailer ||
			inputs.request.budgets.maxUnmappedGeneratedLines < 1
		)
			throw new SourceOriginCorrelationFailure(
				inputs.request.budgets.maxUnmappedGeneratedLines < 1
					? 'BUDGET_EXCEEDED'
					: 'SOURCE_MAP_INVALID',
				'Target lacks the exact final unmapped sourceMappingURL trailer.',
				'UNMAPPED_LINE_BIND'
			);
		const unmappedWithoutId = {
			classification: 'SOURCE_MAPPING_URL_TRAILER' as const,
			contentSha256: textSha256(trailerLine.content, deadline, 'UNMAPPED_LINE_BIND'),
			endColumn: trailerLine.endColumn,
			endOffset: trailerLine.endOffset,
			line: trailerLine.line,
			lineTerminatorWidth: trailerLine.lineTerminatorWidth,
			mapId: sourceMapId,
			ordinal: 0,
			reason: 'NO_DECODED_SOURCE_MAP_SEGMENT_FOR_REQUIRED_FINAL_SOURCE_MAPPING_URL_LINE' as const,
			startColumn: 0 as const,
			startOffset: trailerLine.startOffset,
			state: 'UNMAPPED' as const,
			targetArtifactId
		};
		const unmappedRecords = [
			{
				...unmappedWithoutId,
				id: sourceOriginUnmappedGeneratedLineId(analysisId, unmappedWithoutId, () =>
					deadline.check('UNMAPPED_LINE_BIND')
				)
			}
		] as const;
		const segmentIds: SourceOriginCorrelationSnapshot['sourceMap']['segmentIds'][number][] = [];
		for (let index = 0; index < segmentRecords.length; index += 1) {
			checkpointLoop(index, deadline, 'UNMAPPED_LINE_BIND');
			if (segmentIds.length >= prospectiveSegments)
				throw new SourceOriginCorrelationFailure(
					'BUDGET_EXCEEDED',
					'Segment ID population exceeded its preflight bound.',
					'UNMAPPED_LINE_BIND'
				);
			segmentIds.push(segmentRecords[index]!.id);
		}
		const sourceMapRecord = {
			...sourceMapWithoutChildren,
			id: sourceMapId,
			segmentIds,
			unmappedGeneratedLineIds: [unmappedRecords[0].id]
		};
		progress.complete({ unmappedGeneratedLines: 1 });

		progress.start('MATERIALIZE');
		const decodedSegments = segmentRecords.length;
		const outputRecords = checkedAdd(
			7,
			checkedMultiply(decodedSegments, 4),
			unmappedRecords.length
		);
		const chargedInputRecords = checkedAdd(witness.programCompilerInputAttempts, 2);
		const emitBytes = checkedAdd(targetOutput.bytes, mapOutput.bytes);
		const readBytes = checkedAdd(witness.programReadBytes, callerCaptureBytes);
		const chargedTraversalSteps = checkedAdd(
			inputStats.records,
			inputStats.stringCharacters,
			checkedMultiply(3, callerCaptureBytes),
			mapText.length,
			decodedMap.mappings.length,
			targetText.length,
			emission.materializedSource.text.length,
			witness.programCompilerInputAttempts,
			witness.programSourceFiles,
			decodedSegments,
			outputRecords
		);
		if (
			decodedSegments > inputs.request.budgets.maxDecodedMapSegments ||
			locationRecords.length > inputs.request.budgets.maxLocations ||
			correlationRecords.length > inputs.request.budgets.maxCorrelations ||
			outputRecords >
				Math.min(inputs.request.budgets.maxOutputRecords, HARD_LIMITS.maxOutputRecords) ||
			chargedInputRecords > inputs.request.budgets.maxInputRecords ||
			emitBytes > inputs.request.budgets.maxEmitBytes ||
			readBytes > inputs.request.budgets.maxReadBytes ||
			chargedTraversalSteps >
				Math.min(inputs.request.budgets.maxTraversalSteps, HARD_LIMITS.maxTraversalSteps)
		)
			throw new SourceOriginCorrelationFailure(
				'BUDGET_EXCEEDED',
				'Derived populations exceed request budgets.',
				'MATERIALIZE'
			);
		const coverage = {
			ambiguousMappings: 0 as const,
			artifacts: 3 as const,
			authoredLocations: decodedSegments,
			brokenMappings: 0 as const,
			callerCaptureBytes,
			callerCapturePopulationReconciles: true as const,
			callerCaptureRecords: 2 as const,
			chargedInputRecords,
			chargedTraversalSteps,
			conflictingMappings: 0 as const,
			correlationPopulationReconciles: true as const,
			correlations: correlationRecords.length,
			decodedLines: decodedMap.generatedLines,
			decodedSegmentPopulationReconciles: true as const,
			decodedSegments,
			emitBytes,
			emitDiagnostics: 0 as const,
			emitOutputs: 2 as const,
			emittedOutputPopulationReconciles: true as const,
			exactMappings: decodedSegments,
			generatedLocations: decodedSegments,
			inferredMappings: 0 as const,
			locationPopulationReconciles: true as const,
			locations: locationRecords.length,
			mappingHealthRecords: 1 as const,
			mappingsCharacters: decodedMap.mappings.length,
			outputRecords,
			partialMappings: 0 as const,
			programCompilerInputAttemptPopulationReconciles: true as const,
			programCompilerInputAttempts: witness.programCompilerInputAttempts,
			programPresentReadFileAttempts: witness.programPresentReadFileAttempts,
			programReadBytes: witness.programReadBytes,
			programSourceFilePopulationReconciles: true as const,
			programSourceFiles: witness.programSourceFiles,
			readBytes,
			sourceMaps: 1 as const,
			unavailableMappings: 0 as const,
			unmappedGeneratedLinePopulationReconciles: true as const,
			unmappedGeneratedLines: 1
		};
		const content = {
			analysisAuthority: SOURCE_ORIGIN_CORRELATION_AUTHORITY,
			artifacts,
			authorityTransfer: SOURCE_ORIGIN_CORRELATION_AUTHORITY_TRANSFER,
			budgets: inputs.request.budgets,
			canonicalProfile: SOURCE_ORIGIN_CORRELATION_CANONICAL_PROFILE,
			canonicalizationWitness: {
				algorithm: 'CANONICAL_SEMANTIC_JSON_PREFIXED_SHA256' as const,
				idAlgorithmVersion: '1' as const,
				inputDigest,
				state: 'INPUT_AND_DERIVED_POPULATIONS_RECONCILED' as const
			},
			capability: SOURCE_ORIGIN_CORRELATION_CAPABILITY,
			capabilityStatus: SOURCE_ORIGIN_CORRELATION_CAPABILITY_STATUS,
			closure: 'CLOSED_FOR_EXACT_REEMITTED_DECLARATION_MAP_DECODED_SEGMENT_POPULATION' as const,
			correlations: correlationRecords,
			coverage,
			currentness: SOURCE_ORIGIN_CORRELATION_CURRENTNESS,
			emission: emissionRecord,
			freshness: SOURCE_ORIGIN_CORRELATION_FRESHNESS,
			fullJanCsaa007Conformance: SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_007_CONFORMANCE,
			fullJanCsaa008Conformance: SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_008_CONFORMANCE,
			fullJanCsaa014Conformance: SOURCE_ORIGIN_CORRELATION_FULL_JAN_CSAA_014_CONFORMANCE,
			gateEffect: SOURCE_ORIGIN_CORRELATION_GATE_EFFECT,
			health: 'PARTIAL' as const,
			id: analysisId,
			inputDigest,
			locations: locationRecords,
			mappingHealth,
			method: SOURCE_ORIGIN_CORRELATION_METHOD,
			nonclaims: SOURCE_ORIGIN_CORRELATION_NONCLAIMS,
			operationVersion: SOURCE_ORIGIN_CORRELATION_OPERATION_VERSION,
			resultCompleteness:
				'COMPLETE_FOR_EVERY_DECODED_MAPPED_SEGMENT_WITH_EXPLICIT_UNMAPPED_GENERATED_LINES' as const,
			schemaVersion: SOURCE_ORIGIN_CORRELATION_SCHEMA_VERSION,
			segments: segmentRecords,
			selection: SOURCE_ORIGIN_CORRELATION_SELECTION,
			semanticProgramId: bound.program.id,
			semanticProjectId: bound.project.id,
			semanticSnapshotId: inputs.semanticSnapshot.id,
			semanticSourceId: bound.source.id,
			semanticValidationWitness: {
				context: 'FROZEN_SUBJECT' as const,
				frozenSubjectSha256: frozenSubjectWitness.sha256,
				method: 'VALIDATE_STATIC_SEMANTIC_SNAPSHOT_WITH_FROZEN_SUBJECT' as const,
				semanticSnapshotId: inputs.semanticSnapshot.id,
				semanticSnapshotSha256: semanticSnapshotWitness.sha256,
				state: 'VALID' as const,
				subjectId: inputs.request.subjectId
			},
			sourceMap: sourceMapRecord,
			subjectId: inputs.request.subjectId,
			truncation: { reason: null, state: 'NOT_TRUNCATED' as const },
			unmappedGeneratedLines: unmappedRecords
		};
		const analysis = {
			...content,
			contentDigest: sourceOriginCorrelationContentDigest(content, () =>
				deadline.check('MATERIALIZE')
			)
		} as SourceOriginCorrelationSnapshot;
		deepFreeze(analysis, deadline);
		progress.complete({ outputRecords });

		progress.start('SERIALIZE');
		canonicalSemanticJsonWitnessWithProgress(analysis, () => deadline.check('SERIALIZE'));
		progress.complete({ outputRecords });

		progress.start('ANALYSIS_VALIDATE');
		deadline.check('ANALYSIS_VALIDATE');
		let validation: ReturnType<typeof validateConstructedSourceOriginCorrelation>;
		try {
			validation = validateConstructedSourceOriginCorrelation(
				analysis,
				capturedInputs,
				inputDigest,
				{
					maxDepth: HARD_INPUT_DEPTH,
					maxDurationMs: deadline.remaining('ANALYSIS_VALIDATE'),
					maxInputRecords: Math.min(
						inputs.request.budgets.maxInputRecords,
						HARD_LIMITS.maxInputRecords
					),
					maxInputStringCharacters: Math.min(
						inputs.request.budgets.maxInputStringCharacters,
						HARD_LIMITS.maxInputStringCharacters
					),
					maxIssues: Math.min(inputs.request.budgets.maxDiagnostics, HARD_LIMITS.maxDiagnostics),
					maxRecords: Math.min(
						Number.MAX_SAFE_INTEGER,
						checkedAdd(inputStats.records, outputRecords, 1024)
					),
					maxStringCharacters: Math.min(
						Number.MAX_SAFE_INTEGER,
						checkedAdd(
							inputStats.stringCharacters,
							inputs.request.budgets.maxEmitStringCharacters,
							65_536
						)
					)
				}
			);
		} catch (error) {
			deadline.check('ANALYSIS_VALIDATE');
			throw error;
		}
		deadline.check('ANALYSIS_VALIDATE');
		if (validation.state !== 'VALID')
			throw new SourceOriginCorrelationFailure(
				validation.state === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXCEEDED' : 'VALIDATION_FAILED',
				`Constructed source-origin correlation failed independent validation: ${validation.issues[0]?.message ?? 'unknown issue'}`,
				'ANALYSIS_VALIDATE',
				validation.issues[0]?.path ?? null
			);
		progress.complete({ validationIssues: 0 });
		return progress.finish({ analysis, diagnostics: Object.freeze([]), outcome: 'partial' });
	} catch (error) {
		if (error instanceof CompilerProjectDeclarationEmissionError) {
			const code = error.code === 'BUDGET_EXCEEDED' ? 'BUDGET_EXCEEDED' : 'EMISSION_FAILED';
			progress.fail({}, code);
			return progress.finish(
				unavailable(code, 'Fresh declaration emission failed closed.', 'DECLARATION_EMIT')
			);
		}
		if (error instanceof SourceOriginCorrelationFailure) {
			progress.fail({}, error.code);
			return progress.finish(unavailable(error.code, error.message, error.phase, error.path));
		}
		progress.fail({}, 'REQUEST_INVALID');
		return progress.finish(
			unavailable(
				'REQUEST_INVALID',
				'Source-origin input inspection or derivation failed closed.',
				progress.activePhase() ?? 'REQUEST_BIND'
			)
		);
	}
}
