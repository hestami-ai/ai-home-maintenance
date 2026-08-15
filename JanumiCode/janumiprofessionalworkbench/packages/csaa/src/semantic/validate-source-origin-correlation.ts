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
	SOURCE_ORIGIN_CORRELATION_REQUEST_SCHEMA_VERSION,
	SOURCE_ORIGIN_CORRELATION_SCHEMA_VERSION,
	SOURCE_ORIGIN_CORRELATION_SELECTION,
	type SourceOriginArtifactId,
	type SourceOriginCorrelationBuildInputs,
	type SourceOriginCorrelationId,
	type SourceOriginCorrelationRecordId,
	type SourceOriginCorrelationSnapshot,
	type SourceOriginCorrelationValidationIssue,
	type SourceOriginCorrelationValidationOptions,
	type SourceOriginCorrelationValidationResult,
	type SourceOriginEmissionId,
	type SourceOriginLocationId,
	type SourceOriginMapSegmentId,
	type SourceOriginMappingHealthId,
	type SourceOriginProgramSourceIdentity,
	type SourceOriginSourceMapId,
	type SourceOriginUnmappedGeneratedLineId
} from '../contracts/source-origin-correlation.js';
import {
	COMPILER_PROJECT_DECLARATION_EMISSION_VERSION,
	CompilerProjectDeclarationEmissionError,
	emitCompilerProjectDeclaration,
	type CompilerProjectDeclarationEmission
} from '../providers/typescript/compiler-project-declaration-emission.js';
import { validateStaticSemanticSnapshot } from './validate-snapshot.js';

type DeadlineCheckpoint = () => void;

interface ValidationProvider {
	readonly emitDeclaration: typeof emitCompilerProjectDeclaration;
	readonly monotonicNow: () => number;
}

/** @internal Immutable per-call defensive fault-injection surface; absent from the package root. */
export type SourceOriginCorrelationValidationProviderOverrides = Partial<ValidationProvider>;

const DIRECT_VALIDATION_PROVIDER: Readonly<ValidationProvider> = Object.freeze({
	emitDeclaration: emitCompilerProjectDeclaration,
	monotonicNow: () => performance.now()
});

interface ClosedOptions {
	readonly maxDepth: number;
	readonly maxDurationMs: number;
	readonly maxInputRecords: number;
	readonly maxInputStringCharacters: number;
	readonly maxIssues: number;
	readonly maxRecords: number;
	readonly maxStringCharacters: number;
}

const DEFAULT_OPTIONS: ClosedOptions = Object.freeze({
	maxDepth: 128,
	maxDurationMs: Number.MAX_SAFE_INTEGER,
	maxInputRecords: 10_000_000,
	maxInputStringCharacters: 1_000_000_000,
	maxIssues: 1_000,
	maxRecords: 10_000_000,
	maxStringCharacters: 1_000_000_000
});

const SHA256 = /^[0-9a-f]{64}$/u;
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const MAX_VLQ_DIGITS = 7;
const MAX_VLQ_UNSIGNED = 0x1_0000_0000;
const BYTE_HASH_CHUNK_SIZE = 64 * 1024;
const TEXT_HASH_CHUNK_SIZE = 4_096;
const HARD_MAX_CAPTURE_BYTES = 16 * 1024 * 1024;
const HARD_MAX_COMPILER_INPUT_ATTEMPTS = 2_000_000;
const HARD_MAX_DECODED_LINES = 1_000_000;
const HARD_MAX_DECODED_SEGMENTS = 500_000;
// The caller's positive safe-integer budget is the governed operation ceiling; validators may
// narrow it through local options, but v1 does not impose an undeclared fixed wall-clock cap.
const HARD_MAX_DURATION_MS = Number.MAX_SAFE_INTEGER;
const HARD_MAX_EMIT_BYTES = 16 * 1024 * 1024;
const HARD_MAX_EMIT_STRING_CHARACTERS = 16 * 1024 * 1024;
const HARD_MAX_INPUT_RECORDS = 4_000_000;
const HARD_MAX_INPUT_STRING_CHARACTERS = 128 * 1024 * 1024;
const HARD_MAX_PATH_CHARACTERS = 16_384;
const HARD_MAX_PROGRAM_SOURCE_FILES = 100_000;
const HARD_MAX_SOURCE_TEXT_CODE_UNITS = 16 * 1024 * 1024;
const HARD_MAX_MAPPINGS_CHARACTERS = 4 * 1024 * 1024;
const HARD_MAX_SOURCE_MAP_JSON_DEPTH = 256;
const HARD_MAX_SOURCE_MAP_JSON_RECORDS = 1_000_000;
const UINT8_ARRAY_SET = Uint8Array.prototype.set;
const UINT8_ARRAY_SUBARRAY = Uint8Array.prototype.subarray;
const TYPED_ARRAY_PROTOTYPE = Reflect.getPrototypeOf(Uint8Array.prototype) as object;
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
	TYPED_ARRAY_PROTOTYPE,
	'buffer'
)?.get;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
	TYPED_ARRAY_PROTOTYPE,
	'byteLength'
)?.get;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
	TYPED_ARRAY_PROTOTYPE,
	'byteOffset'
)?.get;

const INPUT_KEYS = Object.freeze([
	'declarationMapBytes',
	'frozenSubject',
	'request',
	'semanticSnapshot',
	'targetDeclarationBytes'
] as const);
const REQUEST_KEYS = Object.freeze([
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
] as const);
const BUDGET_KEYS = Object.freeze([
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
] as const);
const CAPTURE_DESCRIPTOR_KEYS = Object.freeze([
	'contentBytes',
	'contentSha256',
	'logicalPath'
] as const);
const SNAPSHOT_KEYS = Object.freeze([
	'analysisAuthority',
	'artifacts',
	'authorityTransfer',
	'budgets',
	'canonicalProfile',
	'canonicalizationWitness',
	'capability',
	'capabilityStatus',
	'closure',
	'contentDigest',
	'correlations',
	'coverage',
	'currentness',
	'emission',
	'freshness',
	'fullJanCsaa007Conformance',
	'fullJanCsaa008Conformance',
	'fullJanCsaa014Conformance',
	'gateEffect',
	'health',
	'id',
	'inputDigest',
	'locations',
	'mappingHealth',
	'method',
	'nonclaims',
	'operationVersion',
	'resultCompleteness',
	'schemaVersion',
	'segments',
	'selection',
	'semanticProgramId',
	'semanticProjectId',
	'semanticSnapshotId',
	'semanticSourceId',
	'semanticValidationWitness',
	'sourceMap',
	'subjectId',
	'truncation',
	'unmappedGeneratedLines'
] as const);
const SOURCE_MAP_JSON_KEYS = Object.freeze([
	'file',
	'mappings',
	'names',
	'sourceRoot',
	'sources',
	'version'
] as const);
const PROVIDER_RESULT_KEYS = Object.freeze([
	'emissionWitness',
	'materializedSource',
	'outputs',
	'selection',
	'version'
] as const);
const PROVIDER_SOURCE_KEYS = Object.freeze([
	'contentBytes',
	'contentSha256',
	'logicalPath',
	'semanticProgramId',
	'semanticProjectId',
	'semanticSourceId',
	'text',
	'textLength'
] as const);
const PROVIDER_OUTPUT_KEYS = Object.freeze([
	'bytes',
	'content',
	'contentSha256',
	'kind',
	'logicalPath',
	'sourceLogicalPath',
	'textLength',
	'writeByteOrderMark'
] as const);
const PROVIDER_SELECTION_KEYS = Object.freeze([
	'logicalPath',
	'semanticProgramId',
	'semanticProjectId',
	'semanticSourceId'
] as const);
const PROVIDER_WITNESS_KEYS = Object.freeze([
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
] as const);

function issue(
	code: SourceOriginCorrelationValidationIssue['code'],
	message: string,
	path = '$'
): SourceOriginCorrelationValidationIssue {
	return Object.freeze({ code, message, path });
}

function invalid(
	problem: SourceOriginCorrelationValidationIssue
): SourceOriginCorrelationValidationResult {
	return {
		issues: Object.freeze([problem]),
		state: problem.code === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INVALID'
	};
}

class ValidationAbort extends Error {
	constructor(readonly problem: SourceOriginCorrelationValidationIssue) {
		super(problem.message);
		this.name = 'ValidationAbort';
	}
}

class DerivationFailure extends Error {
	constructor(readonly problem: SourceOriginCorrelationValidationIssue) {
		super(problem.message);
		this.name = 'DerivationFailure';
	}
}

function failDerivation(
	code: SourceOriginCorrelationValidationIssue['code'],
	message: string,
	path = '$inputs'
): never {
	throw new DerivationFailure(issue(code, message, path));
}

function isProxyValue(value: unknown): boolean {
	return (
		value !== null && (typeof value === 'object' || typeof value === 'function') && isProxy(value)
	);
}

function plainRecord(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxyValue(value))
		return false;
	const prototype = Reflect.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
	const keys = Reflect.ownKeys(value);
	if (keys.length !== expected.length) return false;
	for (const key of keys) {
		if (typeof key !== 'string' || !expected.includes(key)) return false;
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			return false;
	}
	return true;
}

function ownDataValue(value: unknown, key: string): unknown {
	if (!plainRecord(value)) return undefined;
	const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
	return descriptor !== undefined && descriptor.enumerable && 'value' in descriptor
		? descriptor.value
		: undefined;
}

function safePositive(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function safeNonnegative(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isUnicodeScalarString(text: string, checkpoint: DeadlineCheckpoint): boolean {
	for (let index = 0; index < text.length; index += 1) {
		checkpoint();
		const code = text.charCodeAt(index);
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = text.charCodeAt(index + 1);
			if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff) return false;
			index += 1;
		} else if (code >= 0xdc00 && code <= 0xdfff) return false;
	}
	return true;
}

function closeOptions(
	value: SourceOriginCorrelationValidationOptions | undefined
): ClosedOptions | null {
	if (value === undefined) return DEFAULT_OPTIONS;
	if (!plainRecord(value)) return null;
	const allowed = Object.freeze([
		'maxDepth',
		'maxDurationMs',
		'maxInputRecords',
		'maxInputStringCharacters',
		'maxIssues',
		'maxRecords',
		'maxStringCharacters'
	] as const);
	const keys = Reflect.ownKeys(value);
	if (keys.length > allowed.length) return null;
	const result: Record<string, number> = { ...DEFAULT_OPTIONS };
	for (const key of keys) {
		if (typeof key !== 'string' || !allowed.includes(key as (typeof allowed)[number])) return null;
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (
			descriptor === undefined ||
			!descriptor.enumerable ||
			!('value' in descriptor) ||
			!safePositive(descriptor.value)
		)
			return null;
		result[key] = descriptor.value;
	}
	if (result.maxIssues! > 100_000) return null;
	return Object.freeze(result) as unknown as ClosedOptions;
}

function earlyRequestDuration(value: unknown): number | null {
	const request = ownDataValue(value, 'request');
	const budgets = ownDataValue(request, 'budgets');
	const duration = ownDataValue(budgets, 'maxDurationMs');
	return safePositive(duration) ? duration : null;
}

function closeProviderOverrides(
	value: SourceOriginCorrelationValidationProviderOverrides
): Readonly<ValidationProvider> | null {
	if (!plainRecord(value)) return null;
	const allowed = ['emitDeclaration', 'monotonicNow'] as const;
	const keys = Reflect.ownKeys(value);
	if (keys.length > allowed.length) return null;
	let emitDeclaration = DIRECT_VALIDATION_PROVIDER.emitDeclaration;
	let monotonicNow = DIRECT_VALIDATION_PROVIDER.monotonicNow;
	for (const key of keys) {
		if (typeof key !== 'string' || !allowed.includes(key as (typeof allowed)[number])) return null;
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (
			descriptor === undefined ||
			!descriptor.enumerable ||
			!('value' in descriptor) ||
			typeof descriptor.value !== 'function'
		)
			return null;
		if (key === 'emitDeclaration')
			emitDeclaration = descriptor.value as typeof emitCompilerProjectDeclaration;
		else monotonicNow = descriptor.value as () => number;
	}
	return Object.freeze({ emitDeclaration, monotonicNow });
}

interface PlainTreeStats {
	readonly records: number;
	readonly stringCharacters: number;
}

type PlainTreeResult =
	| { readonly problem: SourceOriginCorrelationValidationIssue; readonly state: 'INVALID' }
	| { readonly state: 'VALID'; readonly stats: PlainTreeStats };

/** Descriptor-only bounded traversal: no accessor, iterator, callback, or toJSON is invoked. */
function inspectPlainTree(
	value: unknown,
	limits: {
		readonly maxDepth: number;
		readonly maxRecords: number;
		readonly maxStringCharacters: number;
	},
	rootPath: string,
	malformedCode: 'INPUT_INVALID' | 'SHAPE_INVALID',
	checkpoint: DeadlineCheckpoint
): PlainTreeResult {
	type Path =
		| { readonly root: string; readonly state: 'ROOT' }
		| {
				readonly array: boolean;
				readonly key: string;
				readonly parent: Path;
				readonly state: 'CHILD';
		  };
	type Frame =
		| {
				readonly depth: number;
				readonly path: Path;
				readonly state: 'VISIT';
				readonly value: unknown;
		  }
		| {
				readonly array: boolean;
				readonly depth: number;
				readonly index: number;
				readonly keys: readonly PropertyKey[];
				readonly path: Path;
				readonly state: 'CHILDREN';
				readonly value: object;
		  };
	const pending: Frame[] = [
		{ depth: 0, path: { root: rootPath, state: 'ROOT' }, state: 'VISIT', value }
	];
	const active = new WeakSet<object>();
	let records = 0;
	let stringCharacters = 0;
	const pathText = (path: Path): string => {
		const children: Array<Extract<Path, { readonly state: 'CHILD' }>> = [];
		let current = path;
		while (current.state === 'CHILD') {
			checkpoint();
			children.push(current);
			current = current.parent;
		}
		let rendered = current.root;
		for (let index = children.length - 1; index >= 0; index -= 1) {
			checkpoint();
			const child = children[index]!;
			rendered += child.array ? `[${child.key}]` : `.${child.key}`;
		}
		return rendered;
	};
	const problem = (
		code: SourceOriginCorrelationValidationIssue['code'],
		message: string,
		path: Path
	) => ({ problem: issue(code, message, pathText(path)), state: 'INVALID' }) as const;
	while (pending.length > 0) {
		checkpoint();
		const frame = pending.pop()!;
		if (frame.state === 'CHILDREN') {
			let index = frame.index;
			let scheduledChild = false;
			while (index < frame.keys.length) {
				checkpoint();
				const key = frame.keys[index]!;
				index += 1;
				if (typeof key !== 'string' || (frame.array && key === 'length')) continue;
				const descriptor = Reflect.getOwnPropertyDescriptor(frame.value, key);
				if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
					return problem(
						malformedCode,
						'Properties must remain enumerable data properties during traversal.',
						{ array: frame.array, key, parent: frame.path, state: 'CHILD' }
					);
				pending.push({ ...frame, index });
				pending.push({
					depth: frame.depth + 1,
					path: { array: frame.array, key, parent: frame.path, state: 'CHILD' },
					state: 'VISIT',
					value: descriptor.value
				});
				scheduledChild = true;
				break;
			}
			if (!scheduledChild) active.delete(frame.value);
			continue;
		}
		records += 1;
		if (records > limits.maxRecords)
			return problem('BUDGET_EXHAUSTED', 'The descriptor record budget was exhausted.', frame.path);
		if (frame.depth > limits.maxDepth)
			return problem('BUDGET_EXHAUSTED', 'The descriptor depth budget was exhausted.', frame.path);
		const input = frame.value;
		if (typeof input === 'string') {
			if (!isUnicodeScalarString(input, checkpoint))
				return problem(malformedCode, 'Strings must contain Unicode scalar text.', frame.path);
			if (input.length > limits.maxStringCharacters - stringCharacters)
				return problem(
					'BUDGET_EXHAUSTED',
					'The descriptor string-character budget was exhausted.',
					frame.path
				);
			stringCharacters += input.length;
			continue;
		}
		if (
			input === null ||
			typeof input === 'boolean' ||
			(typeof input === 'number' &&
				Number.isFinite(input) &&
				(!Number.isInteger(input) || Number.isSafeInteger(input)) &&
				!Object.is(input, -0))
		)
			continue;
		if (typeof input !== 'object')
			return problem(malformedCode, 'Only JSON-compatible data values are accepted.', frame.path);
		if (isProxyValue(input))
			return problem(malformedCode, 'Proxy values are not accepted.', frame.path);
		if (active.has(input))
			return problem(malformedCode, 'Cyclic data is not accepted.', frame.path);
		const array = Array.isArray(input);
		const prototype = Reflect.getPrototypeOf(input);
		if (
			(array && prototype !== Array.prototype) ||
			(!array && prototype !== Object.prototype && prototype !== null)
		)
			return problem(malformedCode, 'Containers must have ordinary prototypes.', frame.path);
		let length = 0;
		if (array) {
			const lengthDescriptor = Reflect.getOwnPropertyDescriptor(input, 'length');
			if (
				lengthDescriptor === undefined ||
				!('value' in lengthDescriptor) ||
				!safeNonnegative(lengthDescriptor.value)
			)
				return problem(malformedCode, 'Arrays must have a valid ordinary length.', frame.path);
			length = lengthDescriptor.value;
			if (length > limits.maxRecords - records)
				return problem(
					'BUDGET_EXHAUSTED',
					'The descriptor record budget was exhausted by an array population.',
					frame.path
				);
		}
		const keys = Reflect.ownKeys(input);
		if (!array && keys.length > limits.maxRecords - records)
			return problem(
				'BUDGET_EXHAUSTED',
				'The descriptor record budget was exhausted by an object population.',
				frame.path
			);
		if (array) {
			if (keys.length !== length + 1)
				return problem(malformedCode, 'Arrays must be dense without extra properties.', frame.path);
		}
		for (const key of keys) {
			checkpoint();
			if (typeof key !== 'string')
				return problem(malformedCode, 'Symbol keys are not accepted.', frame.path);
			if (array && key === 'length') continue;
			if (key.length > limits.maxStringCharacters - stringCharacters)
				return problem(
					'BUDGET_EXHAUSTED',
					'The descriptor string-character budget was exhausted by a property key.',
					frame.path
				);
			stringCharacters += key.length;
			if (!isUnicodeScalarString(key, checkpoint))
				return problem(
					malformedCode,
					'Property keys must contain Unicode scalar text.',
					frame.path
				);
			if (array) {
				if (!/^(?:0|[1-9][0-9]*)$/u.test(key))
					return problem(
						malformedCode,
						'Arrays must be dense without extra properties.',
						frame.path
					);
				const index = Number(key);
				if (!Number.isSafeInteger(index) || index < 0 || index >= length || String(index) !== key)
					return problem(
						malformedCode,
						'Arrays must be dense without extra properties.',
						frame.path
					);
			}
			const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
			if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
				return problem(malformedCode, 'Properties must be enumerable data properties.', {
					array,
					key,
					parent: frame.path,
					state: 'CHILD'
				});
		}
		active.add(input);
		pending.push({
			array,
			depth: frame.depth,
			index: 0,
			keys,
			path: frame.path,
			state: 'CHILDREN',
			value: input
		});
	}
	return { state: 'VALID', stats: Object.freeze({ records, stringCharacters }) };
}

type CanonicalFrame =
	| {
			readonly index: number;
			readonly length: number;
			readonly state: 'ARRAY';
			readonly value: unknown[];
	  }
	| {
			readonly index: number;
			readonly keys: readonly string[];
			readonly object: object;
			readonly state: 'OBJECT';
	  }
	| { readonly state: 'VALUE'; readonly value: unknown };

function compareUtf16(left: string, right: string, checkpoint: DeadlineCheckpoint): number {
	const length = Math.min(left.length, right.length);
	for (let index = 0; index < length; index += 1) {
		checkpoint();
		const difference = left.charCodeAt(index) - right.charCodeAt(index);
		if (difference !== 0) return difference < 0 ? -1 : 1;
	}
	return left.length < right.length ? -1 : left.length > right.length ? 1 : 0;
}

function* jsonStringChunks(
	value: string,
	checkpoint: DeadlineCheckpoint
): Generator<string, void, undefined> {
	yield '"';
	let buffered = '';
	for (let index = 0; index < value.length; index += 1) {
		checkpoint();
		const code = value.charCodeAt(index);
		let encoded: string;
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = value.charCodeAt(index + 1);
			if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff)
				throw new TypeError('Canonical JSON rejects lone UTF-16 surrogates.');
			encoded = value.slice(index, index + 2);
			index += 1;
		} else if (code >= 0xdc00 && code <= 0xdfff)
			throw new TypeError('Canonical JSON rejects lone UTF-16 surrogates.');
		else if (code === 0x22) encoded = '\\"';
		else if (code === 0x5c) encoded = '\\\\';
		else if (code === 0x08) encoded = '\\b';
		else if (code === 0x09) encoded = '\\t';
		else if (code === 0x0a) encoded = '\\n';
		else if (code === 0x0c) encoded = '\\f';
		else if (code === 0x0d) encoded = '\\r';
		else encoded = code < 0x20 ? `\\u${code.toString(16).padStart(4, '0')}` : value[index]!;
		if (buffered.length + encoded.length > 1_024) {
			yield buffered;
			buffered = '';
		}
		buffered += encoded;
	}
	if (buffered.length > 0) yield buffered;
	yield '"';
}

function* canonicalChunks(
	value: unknown,
	checkpoint: DeadlineCheckpoint
): Generator<string, void, undefined> {
	const pending: CanonicalFrame[] = [{ state: 'VALUE', value }];
	while (pending.length > 0) {
		checkpoint();
		const frame = pending.pop()!;
		if (frame.state === 'ARRAY') {
			if (frame.index === frame.length) {
				yield ']';
				continue;
			}
			if (frame.index !== 0) yield ',';
			pending.push({ ...frame, index: frame.index + 1 });
			pending.push({
				state: 'VALUE',
				value: Reflect.getOwnPropertyDescriptor(frame.value, String(frame.index))!.value
			});
			continue;
		}
		if (frame.state === 'OBJECT') {
			if (frame.index === frame.keys.length) {
				yield '}';
				continue;
			}
			if (frame.index !== 0) yield ',';
			const key = frame.keys[frame.index]!;
			yield* jsonStringChunks(key, checkpoint);
			yield ':';
			pending.push({ ...frame, index: frame.index + 1 });
			pending.push({
				state: 'VALUE',
				value: Reflect.getOwnPropertyDescriptor(frame.object, key)!.value
			});
			continue;
		}
		const input = frame.value;
		if (input === null) {
			yield 'null';
			continue;
		}
		if (typeof input === 'string') {
			yield* jsonStringChunks(input, checkpoint);
			continue;
		}
		if (typeof input === 'boolean') {
			yield input ? 'true' : 'false';
			continue;
		}
		if (typeof input === 'number') {
			if (!Number.isFinite(input) || (Number.isInteger(input) && !Number.isSafeInteger(input)))
				throw new TypeError('Canonical JSON requires finite safe numbers.');
			yield JSON.stringify(input);
			continue;
		}
		if (typeof input !== 'object' || input === null)
			throw new TypeError('Canonical JSON received a non-data value.');
		if (Array.isArray(input)) {
			const length = Reflect.getOwnPropertyDescriptor(input, 'length')!.value as number;
			yield '[';
			pending.push({ index: 0, length, state: 'ARRAY', value: input });
			continue;
		}
		const keys = Reflect.ownKeys(input) as string[];
		keys.sort((left, right) => compareUtf16(left, right, checkpoint));
		yield '{';
		pending.push({ index: 0, keys, object: input, state: 'OBJECT' });
	}
}

function writeCanonical(
	value: unknown,
	write: (chunk: string) => void,
	checkpoint: DeadlineCheckpoint
): void {
	for (const chunk of canonicalChunks(value, checkpoint)) {
		checkpoint();
		write(chunk);
	}
}

function canonicalSha256(value: unknown, checkpoint: DeadlineCheckpoint): string {
	checkpoint();
	const hash = createHash('sha256');
	writeCanonical(value, (chunk) => hash.update(chunk, 'utf8'), checkpoint);
	checkpoint();
	return hash.digest('hex');
}

function domainDigest(domain: string, preimage: unknown, checkpoint: DeadlineCheckpoint): string {
	checkpoint();
	const hash = createHash('sha256');
	hash.update(domain, 'utf8');
	hash.update('\0', 'utf8');
	hash.update('1', 'utf8');
	hash.update('\0', 'utf8');
	writeCanonical(preimage, (chunk) => hash.update(chunk, 'utf8'), checkpoint);
	checkpoint();
	return hash.digest('hex');
}

function identity<Kind extends string>(
	prefix: string,
	domain: string,
	preimage: unknown,
	checkpoint: DeadlineCheckpoint
): Kind {
	return `${prefix}-${domainDigest(domain, preimage, checkpoint)}` as Kind;
}

interface CanonicalCursor {
	chunk: string;
	done: boolean;
	index: number;
	readonly iterator: Generator<string, void, undefined>;
}

function nextCanonicalCodeUnit(
	cursor: CanonicalCursor,
	checkpoint: DeadlineCheckpoint
): number | null {
	while (true) {
		checkpoint();
		if (cursor.index < cursor.chunk.length) return cursor.chunk.charCodeAt(cursor.index++);
		if (cursor.done) return null;
		const next = cursor.iterator.next();
		cursor.done = next.done === true;
		cursor.chunk = next.done === true ? '' : next.value;
		cursor.index = 0;
	}
}

function canonicalEqual(left: unknown, right: unknown, checkpoint: DeadlineCheckpoint): boolean {
	const leftCursor: CanonicalCursor = {
		chunk: '',
		done: false,
		index: 0,
		iterator: canonicalChunks(left, checkpoint)
	};
	const rightCursor: CanonicalCursor = {
		chunk: '',
		done: false,
		index: 0,
		iterator: canonicalChunks(right, checkpoint)
	};
	while (true) {
		checkpoint();
		const leftUnit = nextCanonicalCodeUnit(leftCursor, checkpoint);
		const rightUnit = nextCanonicalCodeUnit(rightCursor, checkpoint);
		if (leftUnit === null || rightUnit === null) return leftUnit === null && rightUnit === null;
		if (leftUnit !== rightUnit) return false;
	}
}

function checkedAdd(...values: readonly number[]): number {
	let total = 0;
	for (const value of values) {
		if (!safeNonnegative(value) || value > Number.MAX_SAFE_INTEGER - total)
			failDerivation('BUDGET_EXHAUSTED', 'Derived resource arithmetic exceeds safe-integer range.');
		total += value;
	}
	return total;
}

function checkedMultiply(left: number, right: number): number {
	if (
		!safeNonnegative(left) ||
		!safeNonnegative(right) ||
		(left !== 0 && right > Math.floor(Number.MAX_SAFE_INTEGER / left))
	)
		failDerivation('BUDGET_EXHAUSTED', 'Derived population arithmetic exceeds safe-integer range.');
	return left * right;
}

function bytesSha256(bytes: Readonly<Uint8Array>, checkpoint: DeadlineCheckpoint): string {
	const hash = createHash('sha256');
	for (let offset = 0; offset < bytes.byteLength; offset += BYTE_HASH_CHUNK_SIZE) {
		checkpoint();
		hash.update((bytes as Uint8Array).subarray(offset, offset + BYTE_HASH_CHUNK_SIZE));
	}
	checkpoint();
	return hash.digest('hex');
}

function textSha256(text: string, checkpoint: DeadlineCheckpoint): string {
	const hash = createHash('sha256');
	for (let offset = 0; offset < text.length; offset += TEXT_HASH_CHUNK_SIZE) {
		checkpoint();
		hash.update(text.slice(offset, offset + TEXT_HASH_CHUNK_SIZE), 'utf8');
	}
	checkpoint();
	return hash.digest('hex');
}

function utf8TextEvidence(
	text: string,
	checkpoint: DeadlineCheckpoint
): { readonly bytes: number; readonly contentSha256: string } {
	const hash = createHash('sha256');
	let bytes = 0;
	for (let offset = 0; offset < text.length;) {
		checkpoint();
		let end = Math.min(text.length, offset + TEXT_HASH_CHUNK_SIZE);
		if (
			end < text.length &&
			text.charCodeAt(end - 1) >= 0xd800 &&
			text.charCodeAt(end - 1) <= 0xdbff &&
			text.charCodeAt(end) >= 0xdc00 &&
			text.charCodeAt(end) <= 0xdfff
		)
			end += 1;
		const chunk = text.slice(offset, end);
		bytes = checkedAdd(bytes, Buffer.byteLength(chunk, 'utf8'));
		hash.update(chunk, 'utf8');
		offset = end;
	}
	checkpoint();
	return Object.freeze({ bytes, contentSha256: hash.digest('hex') });
}

function requestIssue(
	inputs: SourceOriginCorrelationBuildInputs,
	checkpoint: DeadlineCheckpoint
): SourceOriginCorrelationValidationIssue | null {
	const request = inputs.request;
	if (
		!plainRecord(request) ||
		!exactKeys(request, REQUEST_KEYS) ||
		!plainRecord(request.budgets) ||
		!exactKeys(request.budgets, BUDGET_KEYS) ||
		!plainRecord(request.targetDeclaration) ||
		!exactKeys(request.targetDeclaration, CAPTURE_DESCRIPTOR_KEYS) ||
		!plainRecord(request.declarationMap) ||
		!exactKeys(request.declarationMap, CAPTURE_DESCRIPTOR_KEYS)
	)
		return issue(
			'INPUT_INVALID',
			'The source-origin request shell must be exact plain data.',
			'$inputs.request'
		);
	for (const key of BUDGET_KEYS)
		if (!safePositive(request.budgets[key]))
			return issue(
				'INPUT_INVALID',
				`Request budget ${key} must be a positive safe integer.`,
				`$inputs.request.budgets.${key}`
			);
	if (
		request.budgets.maxDiagnostics > 100_000 ||
		request.budgets.maxEmitOutputs < 2 ||
		request.budgets.maxReadBytes < request.budgets.maxProgramReadBytes ||
		request.budgets.maxOutputRecords < 8 ||
		request.budgets.maxLocations < 2 ||
		request.budgets.maxCorrelations < 1 ||
		request.budgets.maxUnmappedGeneratedLines < 1
	)
		return issue(
			'INPUT_INVALID',
			'Request budgets cannot support the fixed v1 population.',
			'$inputs.request.budgets'
		);
	if (
		request.schemaVersion !== SOURCE_ORIGIN_CORRELATION_REQUEST_SCHEMA_VERSION ||
		request.operationVersion !== SOURCE_ORIGIN_CORRELATION_OPERATION_VERSION ||
		!canonicalEqual(request.selection, SOURCE_ORIGIN_CORRELATION_SELECTION, checkpoint)
	)
		return issue('INPUT_INVALID', 'Request constants or selection are invalid.', '$inputs.request');
	if (typeof request.subjectId !== 'string' || !SHA256.test(request.subjectId))
		return issue(
			'INPUT_INVALID',
			'Request subjectId must be lowercase SHA-256.',
			'$inputs.request.subjectId'
		);
	for (const key of [
		'semanticSnapshotId',
		'semanticProjectId',
		'semanticProgramId',
		'semanticSourceId'
	] as const) {
		const value = request[key];
		if (
			typeof value !== 'string' ||
			value.length === 0 ||
			value.length > HARD_MAX_PATH_CHARACTERS ||
			!isUnicodeScalarString(value, checkpoint)
		)
			return issue(
				'INPUT_INVALID',
				`Request ${key} must be bounded Unicode-scalar text.`,
				`$inputs.request.${key}`
			);
	}
	for (const [name, descriptor] of [
		['targetDeclaration', request.targetDeclaration],
		['declarationMap', request.declarationMap]
	] as const) {
		if (!safePositive(descriptor.contentBytes) || !SHA256.test(descriptor.contentSha256))
			return issue(
				'INPUT_INVALID',
				'Capture descriptors require a positive byte length and lowercase SHA-256.',
				`$inputs.request.${name}`
			);
		if (!validLogicalPath(descriptor.logicalPath, request.budgets.maxPathCharacters, checkpoint))
			return issue(
				'INPUT_INVALID',
				'Capture descriptor logical paths must be normalized repository-internal POSIX paths.',
				`$inputs.request.${name}.logicalPath`
			);
	}
	if (
		!request.targetDeclaration.logicalPath.endsWith('.d.ts') ||
		request.declarationMap.logicalPath !== `${request.targetDeclaration.logicalPath}.map`
	)
		return issue(
			'INPUT_INVALID',
			'The request must select one .d.ts target and its exact adjacent .d.ts.map.',
			'$inputs.request'
		);
	return null;
}

function validLogicalPath(
	value: unknown,
	maxCharacters: number,
	checkpoint: DeadlineCheckpoint
): value is string {
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value.length > Math.min(maxCharacters, HARD_MAX_PATH_CHARACTERS) ||
		value.startsWith('/') ||
		value.startsWith('\\') ||
		value.includes('\\') ||
		value.includes('?') ||
		value.includes('#') ||
		/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value) ||
		!isUnicodeScalarString(value, checkpoint)
	)
		return false;
	for (let index = 0; index < value.length; index += 1) {
		checkpoint();
		const code = value.charCodeAt(index);
		if (code <= 0x1f || code === 0x7f) return false;
	}
	const normalized = posix.normalize(value);
	if (
		normalized !== value ||
		normalized === '.' ||
		normalized === '..' ||
		normalized.startsWith('../')
	)
		return false;
	const pieces = value.split('/');
	return pieces.every((piece) => piece.length > 0 && piece !== '.' && piece !== '..');
}

function inputShellIssue(value: unknown): SourceOriginCorrelationValidationIssue | null {
	if (!plainRecord(value) || !exactKeys(value, INPUT_KEYS))
		return issue(
			'INPUT_INVALID',
			'The source-origin input wrapper must be an exact plain record.',
			'$inputs'
		);
	for (const key of ['request', 'frozenSubject', 'semanticSnapshot'] as const) {
		const member = Reflect.getOwnPropertyDescriptor(value, key)!.value;
		if (!plainRecord(member))
			return issue('INPUT_INVALID', `${key} must be an inert plain-data record.`, `$inputs.${key}`);
	}
	return null;
}

function inspectInputPlainData(
	inputs: SourceOriginCorrelationBuildInputs,
	limits: ClosedOptions,
	checkpoint: DeadlineCheckpoint
): PlainTreeStats {
	let records = 0;
	let stringCharacters = 0;
	for (const [path, root] of [
		['$inputs.request', inputs.request],
		['$inputs.frozenSubject', inputs.frozenSubject],
		['$inputs.semanticSnapshot', inputs.semanticSnapshot]
	] as const) {
		checkpoint();
		const maximumRecords = Math.min(
			limits.maxInputRecords,
			inputs.request.budgets.maxInputRecords,
			HARD_MAX_INPUT_RECORDS
		);
		const maximumCharacters = Math.min(
			limits.maxInputStringCharacters,
			inputs.request.budgets.maxInputStringCharacters,
			HARD_MAX_INPUT_STRING_CHARACTERS
		);
		const result = inspectPlainTree(
			root,
			{
				maxDepth: limits.maxDepth,
				maxRecords: maximumRecords - records,
				maxStringCharacters: maximumCharacters - stringCharacters
			},
			path,
			'INPUT_INVALID',
			checkpoint
		);
		if (result.state === 'INVALID') throw new ValidationAbort(result.problem);
		records = checkedAdd(records, result.stats.records);
		stringCharacters = checkedAdd(stringCharacters, result.stats.stringCharacters);
	}
	return Object.freeze({ records, stringCharacters });
}

function captureByteLength(value: unknown, path: string): number {
	if (
		value === null ||
		typeof value !== 'object' ||
		isProxyValue(value) ||
		Reflect.getPrototypeOf(value) !== Uint8Array.prototype
	)
		failDerivation(
			'INPUT_INVALID',
			'Caller captures must be ordinary unshared Uint8Array values.',
			path
		);
	let length: number;
	let offset: number;
	let buffer: unknown;
	let ordinaryBuffer: boolean;
	try {
		if (
			TYPED_ARRAY_BUFFER_GETTER === undefined ||
			TYPED_ARRAY_BYTE_LENGTH_GETTER === undefined ||
			TYPED_ARRAY_BYTE_OFFSET_GETTER === undefined
		)
			failDerivation('INPUT_INVALID', 'Typed-array intrinsic access is unavailable.', path);
		buffer = TYPED_ARRAY_BUFFER_GETTER.call(value);
		length = TYPED_ARRAY_BYTE_LENGTH_GETTER.call(value) as number;
		offset = TYPED_ARRAY_BYTE_OFFSET_GETTER.call(value) as number;
		ordinaryBuffer =
			buffer !== null &&
			typeof buffer === 'object' &&
			Reflect.getPrototypeOf(buffer) === ArrayBuffer.prototype;
	} catch {
		failDerivation('INPUT_INVALID', 'Caller capture inspection failed closed.', path);
	}
	if (!ordinaryBuffer || !safeNonnegative(length) || !safeNonnegative(offset))
		failDerivation('INPUT_INVALID', 'Caller capture intrinsic view metadata is invalid.', path);
	return length;
}

function copyCapture(
	value: Uint8Array,
	length: number,
	path: string,
	checkpoint: DeadlineCheckpoint
): Uint8Array {
	const copy = new Uint8Array(length);
	for (let offset = 0; offset < length; offset += BYTE_HASH_CHUNK_SIZE) {
		checkpoint();
		try {
			UINT8_ARRAY_SET.call(
				copy,
				UINT8_ARRAY_SUBARRAY.call(value, offset, Math.min(length, offset + BYTE_HASH_CHUNK_SIZE)),
				offset
			);
		} catch {
			failDerivation('INPUT_INVALID', 'Caller capture changed or detached during copying.', path);
		}
	}
	checkpoint();
	return copy;
}

function decodeUtf8(
	bytes: Readonly<Uint8Array>,
	label: string,
	maxCodeUnits: number,
	checkpoint: DeadlineCheckpoint
): string {
	checkpoint();
	let text: string;
	try {
		text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes as Uint8Array);
	} catch {
		failDerivation('INPUT_INVALID', `${label} must be exact well-formed UTF-8.`, '$inputs');
	}
	checkpoint();
	if (text.length > maxCodeUnits)
		failDerivation(
			'BUDGET_EXHAUSTED',
			`${label} exceeds its code-unit budget.`,
			'$inputs.request.budgets'
		);
	if (text.charCodeAt(0) === 0xfeff)
		failDerivation('INPUT_INVALID', `${label} must not contain a byte-order mark.`, '$inputs');
	if (!isUnicodeScalarString(text, checkpoint))
		failDerivation('INPUT_INVALID', `${label} must contain Unicode scalar text.`, '$inputs');
	return text;
}

interface DecodedSegment {
	readonly generatedColumn: number;
	readonly generatedLine: number;
	readonly lineSegmentOrdinal: number;
	readonly ordinal: number;
	readonly originalColumn: number;
	readonly originalLine: number;
	readonly sourceIndex: 0;
}

interface ParsedSourceMap {
	readonly file: string;
	readonly mappings: string;
	readonly rawSource: string;
	readonly segments: readonly DecodedSegment[];
	readonly generatedLines: number;
}

function sourceMapTopLevelKeys(text: string, checkpoint: DeadlineCheckpoint): readonly string[] {
	const keys: string[] = [];
	let braceDepth = 0;
	let bracketDepth = 0;
	let escaped = false;
	let inString = false;
	let stringStart = -1;
	for (let index = 0; index < text.length; index += 1) {
		checkpoint();
		const character = text[index]!;
		if (inString) {
			if (escaped) {
				escaped = false;
				continue;
			}
			if (character === '\\') {
				escaped = true;
				continue;
			}
			if (character !== '"') continue;
			inString = false;
			if (braceDepth !== 1 || bracketDepth !== 0) continue;
			let cursor = index + 1;
			while (cursor < text.length && /[\t\n\r ]/u.test(text[cursor]!)) {
				checkpoint();
				cursor += 1;
			}
			if (text[cursor] !== ':') continue;
			let key: unknown;
			try {
				key = JSON.parse(text.slice(stringStart, index + 1));
			} catch {
				failDerivation('INPUT_INVALID', 'Declaration map contains an invalid top-level key.');
			}
			if (typeof key !== 'string')
				failDerivation('INPUT_INVALID', 'Declaration map top-level keys must be strings.');
			keys.push(key);
			if (keys.length > SOURCE_MAP_JSON_KEYS.length)
				failDerivation('INPUT_INVALID', 'Declaration map contains more than six top-level keys.');
			continue;
		}
		if (character === '"') {
			inString = true;
			stringStart = index;
		} else if (character === '{') braceDepth += 1;
		else if (character === '}') braceDepth -= 1;
		else if (character === '[') bracketDepth += 1;
		else if (character === ']') bracketDepth -= 1;
	}
	return keys;
}

function encodeSignedVlq(value: number): string {
	let unsigned = value < 0 ? -value * 2 + 1 : value * 2;
	let encoded = '';
	do {
		let digit = unsigned % 32;
		unsigned = Math.floor(unsigned / 32);
		if (unsigned > 0) digit += 32;
		encoded += BASE64_ALPHABET[digit]!;
	} while (unsigned > 0);
	return encoded;
}

function decodeVlq(
	mappings: string,
	start: number,
	checkpoint: DeadlineCheckpoint
): { readonly next: number; readonly value: number } {
	let factor = 1;
	let index = start;
	let unsigned = 0;
	let digits = 0;
	for (;;) {
		checkpoint();
		if (index >= mappings.length || mappings[index] === ',' || mappings[index] === ';')
			failDerivation('INPUT_INVALID', 'Declaration map contains an unterminated VLQ.');
		const digit = BASE64_ALPHABET.indexOf(mappings[index]!);
		if (digit < 0)
			failDerivation('INPUT_INVALID', 'Declaration map contains a non-base64 VLQ digit.');
		digits += 1;
		if (digits > MAX_VLQ_DIGITS)
			failDerivation('INPUT_INVALID', 'Declaration map VLQ exceeds the v1 digit ceiling.');
		const contribution = (digit & 31) * factor;
		if (!Number.isSafeInteger(contribution) || !Number.isSafeInteger(unsigned + contribution))
			failDerivation('INPUT_INVALID', 'Declaration map VLQ exceeds safe-integer representation.');
		unsigned += contribution;
		index += 1;
		if ((digit & 32) === 0) break;
		factor *= 32;
		if (!Number.isSafeInteger(factor))
			failDerivation('INPUT_INVALID', 'Declaration map VLQ exceeds safe-integer representation.');
	}
	if (unsigned >= MAX_VLQ_UNSIGNED || unsigned === 1)
		failDerivation('INPUT_INVALID', 'Declaration map VLQ is outside the selected v1 domain.');
	const magnitude = Math.floor(unsigned / 2);
	const value = unsigned % 2 === 1 ? -magnitude : magnitude;
	if (mappings.slice(start, index) !== encodeSignedVlq(value))
		failDerivation('INPUT_INVALID', 'Declaration map VLQ is not canonically shortest.');
	return { next: index, value };
}

function boundedCoordinate(prior: number, delta: number, label: string): number {
	const value = prior + delta;
	if (!Number.isSafeInteger(value) || value < 0)
		failDerivation('INPUT_INVALID', `${label} is outside the nonnegative safe-integer domain.`);
	return value;
}

type JsonLexicalContainer =
	| {
			kind: 'ARRAY';
			state: 'COMMA_OR_END' | 'VALUE' | 'VALUE_OR_END';
	  }
	| {
			kind: 'OBJECT';
			state: 'COLON' | 'COMMA_OR_END' | 'KEY' | 'KEY_OR_END' | 'VALUE';
	  };

/**
 * Allocation-bounded JSON lexical census performed before `JSON.parse`. It counts JSON values
 * exactly like the later descriptor census (object member names are not values) and retains only
 * the active container stack, so hostile width cannot allocate a pre-parse token population.
 */
function preflightJsonStructure(
	text: string,
	maxDepth: number,
	maxRecords: number,
	checkpoint: DeadlineCheckpoint
): void {
	const containers: JsonLexicalContainer[] = [];
	let index = 0;
	let records = 0;
	let rootState: 'END' | 'VALUE' = 'VALUE';
	const invalidJson = (): never =>
		failDerivation(
			'INPUT_INVALID',
			'Declaration map is not valid JSON.',
			'$inputs.declarationMapBytes'
		);
	const skipWhitespace = (): void => {
		while (index < text.length) {
			checkpoint();
			const code = text.charCodeAt(index);
			if (code !== 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) break;
			index += 1;
		}
	};
	const scanString = (): void => {
		if (text.charCodeAt(index) !== 0x22) invalidJson();
		index += 1;
		while (index < text.length) {
			checkpoint();
			const code = text.charCodeAt(index);
			if (code === 0x22) {
				index += 1;
				return;
			}
			if (code <= 0x1f) invalidJson();
			if (code !== 0x5c) {
				index += 1;
				continue;
			}
			index += 1;
			if (index >= text.length) invalidJson();
			const escape = text[index]!;
			if ('"\\/bfnrt'.includes(escape)) {
				index += 1;
				continue;
			}
			if (escape !== 'u' || index + 4 >= text.length) invalidJson();
			for (let digit = 1; digit <= 4; digit += 1) {
				checkpoint();
				if (!/[0-9A-Fa-f]/u.test(text[index + digit]!)) invalidJson();
			}
			index += 5;
		}
		invalidJson();
	};
	const scanNumber = (): void => {
		if (text[index] === '-') index += 1;
		if (text[index] === '0') index += 1;
		else {
			if (index >= text.length || text[index]! < '1' || text[index]! > '9') invalidJson();
			while (index < text.length && text[index]! >= '0' && text[index]! <= '9') {
				checkpoint();
				index += 1;
			}
		}
		if (text[index] === '.') {
			index += 1;
			if (index >= text.length || text[index]! < '0' || text[index]! > '9') invalidJson();
			while (index < text.length && text[index]! >= '0' && text[index]! <= '9') {
				checkpoint();
				index += 1;
			}
		}
		if (text[index] === 'e' || text[index] === 'E') {
			index += 1;
			if (text[index] === '+' || text[index] === '-') index += 1;
			if (index >= text.length || text[index]! < '0' || text[index]! > '9') invalidJson();
			while (index < text.length && text[index]! >= '0' && text[index]! <= '9') {
				checkpoint();
				index += 1;
			}
		}
	};
	const acceptValue = (): void => {
		const depth = containers.length;
		if (depth > maxDepth)
			failDerivation(
				'BUDGET_EXHAUSTED',
				'Declaration map JSON exceeds the pre-parse depth ceiling.'
			);
		records += 1;
		if (records > maxRecords)
			failDerivation(
				'BUDGET_EXHAUSTED',
				'Declaration map JSON exceeds the pre-parse record ceiling.'
			);
		if (containers.length === 0) rootState = 'END';
		else containers[containers.length - 1]!.state = 'COMMA_OR_END';
		const token = text[index];
		if (token === '{') {
			index += 1;
			containers.push({ kind: 'OBJECT', state: 'KEY_OR_END' });
			return;
		}
		if (token === '[') {
			index += 1;
			containers.push({ kind: 'ARRAY', state: 'VALUE_OR_END' });
			return;
		}
		if (token === '"') {
			scanString();
			return;
		}
		if (token === '-' || (token !== undefined && token >= '0' && token <= '9')) {
			scanNumber();
			return;
		}
		for (const literal of ['true', 'false', 'null'] as const) {
			if (text.startsWith(literal, index)) {
				index += literal.length;
				return;
			}
		}
		invalidJson();
	};
	for (;;) {
		checkpoint();
		skipWhitespace();
		const current = containers[containers.length - 1];
		if (current === undefined) {
			if (rootState === 'VALUE') {
				if (index >= text.length) invalidJson();
				acceptValue();
				continue;
			}
			if (index !== text.length) invalidJson();
			return;
		}
		if (current.kind === 'OBJECT') {
			if (current.state === 'KEY_OR_END' && text[index] === '}') {
				index += 1;
				containers.pop();
				continue;
			}
			if (current.state === 'KEY_OR_END' || current.state === 'KEY') {
				if (text[index] !== '"') invalidJson();
				scanString();
				current.state = 'COLON';
				continue;
			}
			if (current.state === 'COLON') {
				if (text[index] !== ':') invalidJson();
				index += 1;
				current.state = 'VALUE';
				continue;
			}
			if (current.state === 'VALUE') {
				if (index >= text.length) invalidJson();
				acceptValue();
				continue;
			}
			if (text[index] === ',') {
				index += 1;
				current.state = 'KEY';
				continue;
			}
			if (text[index] === '}') {
				index += 1;
				containers.pop();
				continue;
			}
			invalidJson();
		}
		if (current.state === 'VALUE_OR_END' && text[index] === ']') {
			index += 1;
			containers.pop();
			continue;
		}
		if (current.state === 'VALUE_OR_END' || current.state === 'VALUE') {
			if (index >= text.length) invalidJson();
			acceptValue();
			continue;
		}
		if (text[index] === ',') {
			index += 1;
			current.state = 'VALUE';
			continue;
		}
		if (text[index] === ']') {
			index += 1;
			containers.pop();
			continue;
		}
		invalidJson();
	}
}

function parseSourceMap(
	text: string,
	budgets: SourceOriginCorrelationBuildInputs['request']['budgets'],
	checkpoint: DeadlineCheckpoint
): ParsedSourceMap {
	if (text.length > budgets.maxInputStringCharacters)
		failDerivation('BUDGET_EXHAUSTED', 'Declaration map text exceeds maxInputStringCharacters.');
	preflightJsonStructure(
		text,
		Math.min(budgets.maxSourceMapJsonDepth, HARD_MAX_SOURCE_MAP_JSON_DEPTH),
		Math.min(budgets.maxSourceMapJsonRecords, HARD_MAX_SOURCE_MAP_JSON_RECORDS),
		checkpoint
	);
	checkpoint();
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		failDerivation(
			'INPUT_INVALID',
			'Declaration map is not valid JSON.',
			'$inputs.declarationMapBytes'
		);
	}
	checkpoint();
	const jsonTree = inspectPlainTree(
		parsed,
		{
			maxDepth: Math.min(budgets.maxSourceMapJsonDepth, HARD_MAX_SOURCE_MAP_JSON_DEPTH),
			maxRecords: Math.min(budgets.maxSourceMapJsonRecords, HARD_MAX_SOURCE_MAP_JSON_RECORDS),
			maxStringCharacters: budgets.maxInputStringCharacters
		},
		'$inputs.declarationMapJson',
		'INPUT_INVALID',
		checkpoint
	);
	if (jsonTree.state === 'INVALID')
		failDerivation(
			jsonTree.problem.code,
			'Declaration map JSON exceeds its shape/resource profile.',
			jsonTree.problem.path
		);
	if (!plainRecord(parsed) || !exactKeys(parsed, SOURCE_MAP_JSON_KEYS))
		failDerivation('INPUT_INVALID', 'Declaration map must be one exact six-key object.');
	const rawKeys = sourceMapTopLevelKeys(text, checkpoint);
	if (
		rawKeys.length !== SOURCE_MAP_JSON_KEYS.length ||
		new Set(rawKeys).size !== rawKeys.length ||
		rawKeys.some(
			(key) => !SOURCE_MAP_JSON_KEYS.includes(key as (typeof SOURCE_MAP_JSON_KEYS)[number])
		)
	)
		failDerivation(
			'INPUT_INVALID',
			'Declaration map must contain each strict top-level key exactly once.'
		);
	const object = parsed;
	if (
		object.version !== 3 ||
		object.sourceRoot !== '' ||
		!Array.isArray(object.names) ||
		object.names.length !== 0 ||
		!Array.isArray(object.sources) ||
		object.sources.length !== 1 ||
		typeof object.file !== 'string' ||
		typeof object.mappings !== 'string' ||
		typeof object.sources[0] !== 'string'
	)
		failDerivation(
			'INPUT_INVALID',
			'Declaration map does not satisfy the strict flat Source Map v3 profile.'
		);
	if (
		object.file.length > budgets.maxPathCharacters ||
		object.sources[0].length > budgets.maxPathCharacters ||
		object.mappings.length > Math.min(budgets.maxMappingsCharacters, HARD_MAX_MAPPINGS_CHARACTERS)
	)
		failDerivation(
			'BUDGET_EXHAUSTED',
			'Declaration map path or mappings text exceeds request budgets.'
		);
	if (
		object.file.length === 0 ||
		object.sources[0].length === 0 ||
		object.file.includes('/') ||
		object.file.includes('\\') ||
		object.sources[0].startsWith('/') ||
		object.sources[0].startsWith('\\') ||
		object.sources[0].includes('\\') ||
		object.sources[0].includes('?') ||
		object.sources[0].includes('#') ||
		/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(object.sources[0]) ||
		!isUnicodeScalarString(object.file, checkpoint) ||
		!isUnicodeScalarString(object.sources[0], checkpoint)
	)
		failDerivation(
			'INPUT_INVALID',
			'Declaration map file/source paths are outside the selected path profile.'
		);
	const mappings = object.mappings;
	const segments: DecodedSegment[] = [];
	let generatedLine = 0;
	let generatedColumn = 0;
	let originalLine = 0;
	let originalColumn = 0;
	let sourceIndex = 0;
	let lineSegmentOrdinal = 0;
	let index = 0;
	if (budgets.maxDecodedMapLines < 1)
		failDerivation('BUDGET_EXHAUSTED', 'Declaration map line budget cannot admit one line.');
	while (index < mappings.length) {
		checkpoint();
		if (mappings[index] === ';') {
			generatedLine += 1;
			if (
				generatedLine + 1 > budgets.maxDecodedMapLines ||
				generatedLine + 1 > HARD_MAX_DECODED_LINES
			)
				failDerivation('BUDGET_EXHAUSTED', 'Declaration map exceeds the generated-line budget.');
			generatedColumn = 0;
			lineSegmentOrdinal = 0;
			index += 1;
			continue;
		}
		if (mappings[index] === ',')
			failDerivation('INPUT_INVALID', 'Declaration map contains an empty segment.');
		if (
			segments.length >= budgets.maxDecodedMapSegments ||
			segments.length >= HARD_MAX_DECODED_SEGMENTS
		)
			failDerivation('BUDGET_EXHAUSTED', 'Declaration map exceeds the decoded-segment budget.');
		const fields: number[] = [];
		while (index < mappings.length && mappings[index] !== ',' && mappings[index] !== ';') {
			if (fields.length >= 4)
				failDerivation(
					'INPUT_INVALID',
					'Every declaration-map segment must have exactly four fields.'
				);
			const decoded = decodeVlq(mappings, index, checkpoint);
			fields.push(decoded.value);
			index = decoded.next;
		}
		if (fields.length !== 4)
			failDerivation(
				'INPUT_INVALID',
				'Every declaration-map segment must have exactly four fields.'
			);
		const nextGeneratedColumn = boundedCoordinate(
			generatedColumn,
			fields[0]!,
			'Declaration-map generated column'
		);
		if (lineSegmentOrdinal > 0 && nextGeneratedColumn <= generatedColumn)
			failDerivation(
				'INPUT_INVALID',
				'Generated columns must be strictly increasing within a line.'
			);
		generatedColumn = nextGeneratedColumn;
		sourceIndex = boundedCoordinate(sourceIndex, fields[1]!, 'Declaration-map source index');
		if (sourceIndex !== 0)
			failDerivation('INPUT_INVALID', 'Every declaration-map segment must select sources[0].');
		originalLine = boundedCoordinate(originalLine, fields[2]!, 'Declaration-map original line');
		originalColumn = boundedCoordinate(
			originalColumn,
			fields[3]!,
			'Declaration-map original column'
		);
		segments.push({
			generatedColumn,
			generatedLine,
			lineSegmentOrdinal,
			ordinal: segments.length,
			originalColumn,
			originalLine,
			sourceIndex: 0
		});
		lineSegmentOrdinal += 1;
		if (index >= mappings.length) break;
		if (mappings[index] === ',') {
			index += 1;
			if (index >= mappings.length || mappings[index] === ',' || mappings[index] === ';')
				failDerivation('INPUT_INVALID', 'Declaration map contains an empty segment.');
		}
	}
	if (segments.length === 0)
		failDerivation('INPUT_INVALID', 'Declaration map must contain at least one mapped segment.');
	return {
		file: object.file,
		generatedLines: generatedLine + 1,
		mappings,
		rawSource: object.sources[0],
		segments
	};
}

interface TextLine {
	readonly endColumn: number;
	readonly endOffset: number;
	readonly line: number;
	readonly lineTerminatorWidth: 0 | 1 | 2;
	readonly startOffset: number;
}

type SparseTextLineBounds = ReadonlyMap<number, TextLine>;

function textLines(
	text: string,
	maxLines: number,
	checkpoint: DeadlineCheckpoint
): readonly TextLine[] {
	const lines: TextLine[] = [];
	let start = 0;
	let index = 0;
	while (index < text.length) {
		checkpoint();
		const code = text.charCodeAt(index);
		if (code !== 0x0a && code !== 0x0d) {
			index += 1;
			continue;
		}
		let width: 1 | 2 = 1;
		if (code === 0x0d && text.charCodeAt(index + 1) === 0x0a) width = 2;
		if (lines.length >= maxLines)
			failDerivation('BUDGET_EXHAUSTED', 'Text line population exceeds its request budget.');
		lines.push({
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
		if (lines.length >= maxLines)
			failDerivation('BUDGET_EXHAUSTED', 'Text line population exceeds its request budget.');
		lines.push({
			endColumn: text.length - start,
			endOffset: text.length,
			line: lines.length,
			lineTerminatorWidth: 0,
			startOffset: start
		});
	}
	return lines;
}

function sparseTextLineBounds(
	text: string,
	requestedLines: ReadonlySet<number>,
	maxRetainedLines: number,
	checkpoint: DeadlineCheckpoint
): SparseTextLineBounds {
	if (requestedLines.size > maxRetainedLines)
		failDerivation('BUDGET_EXHAUSTED', 'Sparse authored-line population exceeds its preflight.');
	const lines = new Map<number, TextLine>();
	const retain = (
		line: number,
		startOffset: number,
		endOffset: number,
		lineTerminatorWidth: 0 | 1 | 2
	): void => {
		if (!requestedLines.has(line)) return;
		if (lines.size >= maxRetainedLines)
			failDerivation('BUDGET_EXHAUSTED', 'Sparse authored-line population exceeds its preflight.');
		lines.set(line, {
			endColumn: endOffset - startOffset,
			endOffset,
			line,
			lineTerminatorWidth,
			startOffset
		});
	};
	let line = 0;
	let start = 0;
	let index = 0;
	while (index < text.length) {
		checkpoint();
		const code = text.charCodeAt(index);
		if (code !== 0x0a && code !== 0x0d) {
			index += 1;
			continue;
		}
		const width: 1 | 2 = code === 0x0d && text.charCodeAt(index + 1) === 0x0a ? 2 : 1;
		retain(line, start, index, width);
		line += 1;
		index += width;
		start = index;
	}
	if (start < text.length || text.length === 0) retain(line, start, text.length, 0);
	checkpoint();
	return lines;
}

function coordinateOffset(
	lines: readonly TextLine[],
	line: number,
	column: number,
	label: string
): number {
	const entry = lines[line];
	if (entry === undefined || column > entry.endColumn)
		failDerivation('INPUT_INVALID', `${label} does not resolve within the captured UTF-16 text.`);
	return entry.startOffset + column;
}

function sparseCoordinateOffset(
	lines: SparseTextLineBounds,
	line: number,
	column: number,
	label: string
): number {
	const entry = lines.get(line);
	if (entry === undefined || column > entry.endColumn)
		failDerivation('INPUT_INVALID', `${label} does not resolve within the captured UTF-16 text.`);
	return entry.startOffset + column;
}

/** @internal Direct-file-only regression seam for allocation-bounded sparse authored-line scans. */
export function sourceOriginCorrelationSparseAuthoredLineBoundsForTesting(
	text: string,
	requestedLineOrdinals: readonly number[],
	checkpointForTesting: DeadlineCheckpoint = () => undefined
): readonly TextLine[] {
	const requested = new Set<number>();
	for (const line of requestedLineOrdinals) {
		if (!safeNonnegative(line)) throw new TypeError('Requested line ordinals must be nonnegative.');
		requested.add(line);
	}
	return Object.freeze([
		...sparseTextLineBounds(text, requested, requested.size, checkpointForTesting).values()
	]);
}

function captureInputDigest(
	inputs: SourceOriginCorrelationBuildInputs,
	targetBytes: Readonly<Uint8Array>,
	mapBytes: Readonly<Uint8Array>,
	checkpoint: DeadlineCheckpoint
): string {
	return domainDigest(
		'JAN-CSAA-SOURCE-ORIGIN-CORRELATION-INPUT',
		{
			callerCaptures: {
				declarationMap: {
					contentBytes: mapBytes.byteLength,
					contentSha256: bytesSha256(mapBytes, checkpoint)
				},
				targetDeclaration: {
					contentBytes: targetBytes.byteLength,
					contentSha256: bytesSha256(targetBytes, checkpoint)
				}
			},
			frozenSubject: {
				fileManifestDigest: inputs.frozenSubject.descriptor.fileManifestDigest,
				operationVersion: inputs.frozenSubject.descriptor.operationVersion,
				policyVersion: inputs.frozenSubject.descriptor.policyVersion,
				schemaVersion: inputs.frozenSubject.descriptor.schemaVersion,
				subjectId: inputs.frozenSubject.descriptor.subjectId,
				subjectKind: inputs.frozenSubject.descriptor.subjectKind
			},
			request: inputs.request,
			semanticSnapshot: {
				canonicalProfile: inputs.semanticSnapshot.canonicalProfile,
				contextDigest: inputs.semanticSnapshot.contextDigest,
				extractionVersion: inputs.semanticSnapshot.extractionVersion,
				id: inputs.semanticSnapshot.id,
				operationVersion: inputs.semanticSnapshot.operationVersion,
				provider: inputs.semanticSnapshot.provider,
				schemaVersion: inputs.semanticSnapshot.schemaVersion,
				subjectId: inputs.semanticSnapshot.subjectId
			}
		},
		checkpoint
	);
}

function analysisIdentity(
	inputs: SourceOriginCorrelationBuildInputs,
	inputDigest: string,
	checkpoint: DeadlineCheckpoint
): SourceOriginCorrelationId {
	return identity<SourceOriginCorrelationId>(
		'source-origin-correlation',
		'JAN-CSAA-SOURCE-ORIGIN-CORRELATION',
		{
			canonicalProfile: SOURCE_ORIGIN_CORRELATION_CANONICAL_PROFILE,
			inputDigest,
			method: SOURCE_ORIGIN_CORRELATION_METHOD,
			operationVersion: SOURCE_ORIGIN_CORRELATION_OPERATION_VERSION,
			schemaVersion: SOURCE_ORIGIN_CORRELATION_SCHEMA_VERSION,
			semanticProgramId: inputs.request.semanticProgramId,
			semanticProjectId: inputs.request.semanticProjectId,
			semanticSnapshotId: inputs.request.semanticSnapshotId,
			semanticSourceId: inputs.request.semanticSourceId,
			subjectId: inputs.request.subjectId
		},
		checkpoint
	);
}

function childIdentity<Kind extends string>(
	prefix: string,
	domain: string,
	analysisId: SourceOriginCorrelationId,
	record: Readonly<Record<string, unknown>>,
	checkpoint: DeadlineCheckpoint
): Kind {
	return identity<Kind>(prefix, domain, { analysisId, ...record }, checkpoint);
}

function artifactIdentity(
	analysisId: SourceOriginCorrelationId,
	record: Readonly<Record<string, unknown>>,
	checkpoint: DeadlineCheckpoint
): SourceOriginArtifactId {
	return childIdentity<SourceOriginArtifactId>(
		'source-origin-artifact',
		'JAN-CSAA-SOURCE-ORIGIN-ARTIFACT',
		analysisId,
		record,
		checkpoint
	);
}

function sourceMapIdentity(
	analysisId: SourceOriginCorrelationId,
	record: Readonly<Record<string, unknown>>,
	checkpoint: DeadlineCheckpoint
): SourceOriginSourceMapId {
	return childIdentity<SourceOriginSourceMapId>(
		'source-origin-source-map',
		'JAN-CSAA-SOURCE-ORIGIN-SOURCE-MAP',
		analysisId,
		record,
		checkpoint
	);
}

function mappingHealthIdentity(
	analysisId: SourceOriginCorrelationId,
	record: Readonly<Record<string, unknown>>,
	checkpoint: DeadlineCheckpoint
): SourceOriginMappingHealthId {
	return childIdentity<SourceOriginMappingHealthId>(
		'source-origin-mapping-health',
		'JAN-CSAA-SOURCE-ORIGIN-MAPPING-HEALTH',
		analysisId,
		record,
		checkpoint
	);
}

function segmentIdentity(
	analysisId: SourceOriginCorrelationId,
	record: Readonly<Record<string, unknown>>,
	checkpoint: DeadlineCheckpoint
): SourceOriginMapSegmentId {
	return childIdentity<SourceOriginMapSegmentId>(
		'source-origin-map-segment',
		'JAN-CSAA-SOURCE-ORIGIN-MAP-SEGMENT',
		analysisId,
		record,
		checkpoint
	);
}

function locationIdentity(
	analysisId: SourceOriginCorrelationId,
	record: Readonly<Record<string, unknown>>,
	checkpoint: DeadlineCheckpoint
): SourceOriginLocationId {
	return childIdentity<SourceOriginLocationId>(
		'source-origin-location',
		'JAN-CSAA-SOURCE-ORIGIN-LOCATION',
		analysisId,
		record,
		checkpoint
	);
}

function exactCorrelationIdentity(
	analysisId: SourceOriginCorrelationId,
	record: Readonly<Record<string, unknown>>,
	checkpoint: DeadlineCheckpoint
): SourceOriginCorrelationRecordId {
	return childIdentity<SourceOriginCorrelationRecordId>(
		'source-origin-correlation-record',
		'JAN-CSAA-SOURCE-ORIGIN-CORRELATION-RECORD',
		analysisId,
		record,
		checkpoint
	);
}

function unmappedLineIdentity(
	analysisId: SourceOriginCorrelationId,
	record: Readonly<Record<string, unknown>>,
	checkpoint: DeadlineCheckpoint
): SourceOriginUnmappedGeneratedLineId {
	return childIdentity<SourceOriginUnmappedGeneratedLineId>(
		'source-origin-unmapped-generated-line',
		'JAN-CSAA-SOURCE-ORIGIN-UNMAPPED-GENERATED-LINE',
		analysisId,
		record,
		checkpoint
	);
}

function emissionIdentity(
	analysisId: SourceOriginCorrelationId,
	record: Readonly<Record<string, unknown>>,
	checkpoint: DeadlineCheckpoint
): SourceOriginEmissionId {
	return childIdentity<SourceOriginEmissionId>(
		'source-origin-emission',
		'JAN-CSAA-SOURCE-ORIGIN-EMISSION',
		analysisId,
		record,
		checkpoint
	);
}

function candidatePopulationIssue(
	value: Record<string, unknown>,
	budgets: SourceOriginCorrelationBuildInputs['request']['budgets']
): SourceOriginCorrelationValidationIssue | null {
	const arrayAt = (key: string): unknown[] | null => {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) return null;
		const candidate = descriptor.value;
		if (!Array.isArray(candidate) || isProxyValue(candidate)) return null;
		const length = Reflect.getOwnPropertyDescriptor(candidate, 'length')?.value;
		return safeNonnegative(length) ? candidate : null;
	};
	const artifacts = arrayAt('artifacts');
	const segments = arrayAt('segments');
	const locations = arrayAt('locations');
	const correlations = arrayAt('correlations');
	const unmapped = arrayAt('unmappedGeneratedLines');
	if (
		artifacts === null ||
		segments === null ||
		locations === null ||
		correlations === null ||
		unmapped === null
	)
		return issue('SHAPE_INVALID', 'Candidate population fields must be ordinary arrays.');
	if (artifacts.length !== 3)
		return issue(
			'POPULATION_MISMATCH',
			'Candidate must contain exactly three artifacts.',
			'$.artifacts'
		);
	if (
		segments.length < 1 ||
		segments.length > budgets.maxDecodedMapSegments ||
		segments.length > HARD_MAX_DECODED_SEGMENTS
	)
		return issue(
			'BUDGET_EXHAUSTED',
			'Candidate segment population exceeds hard request gates.',
			'$.segments'
		);
	if (
		locations.length !== checkedMultiply(segments.length, 2) ||
		locations.length > budgets.maxLocations
	)
		return issue(
			'POPULATION_MISMATCH',
			'Candidate location population cannot reconcile.',
			'$.locations'
		);
	if (correlations.length !== segments.length || correlations.length > budgets.maxCorrelations)
		return issue(
			'POPULATION_MISMATCH',
			'Candidate correlation population cannot reconcile.',
			'$.correlations'
		);
	if (unmapped.length !== 1 || unmapped.length > budgets.maxUnmappedGeneratedLines)
		return issue(
			'POPULATION_MISMATCH',
			'Candidate v1 unmapped-line population must be exactly the final trailer.',
			'$.unmappedGeneratedLines'
		);
	const outputRecords = checkedAdd(7, checkedMultiply(segments.length, 4), unmapped.length);
	if (outputRecords > budgets.maxOutputRecords)
		return issue('BUDGET_EXHAUSTED', 'Candidate output population exceeds maxOutputRecords.', '$');
	const sourceMap = ownDataValue(value, 'sourceMap');
	if (!plainRecord(sourceMap))
		return issue(
			'SHAPE_INVALID',
			'Candidate sourceMap must be an exact plain record.',
			'$.sourceMap'
		);
	for (const [key, expectedLength] of [
		['segmentIds', segments.length],
		['unmappedGeneratedLineIds', unmapped.length]
	] as const) {
		const population = ownDataValue(sourceMap, key);
		if (
			!Array.isArray(population) ||
			isProxyValue(population) ||
			population.length !== expectedLength
		)
			return issue(
				'POPULATION_MISMATCH',
				`Candidate sourceMap.${key} cannot reconcile.`,
				`$.sourceMap.${key}`
			);
	}
	return null;
}

interface BoundInputs {
	readonly manifestArtifact: SourceOriginCorrelationBuildInputs['frozenSubject']['artifacts'][number];
	readonly program: SourceOriginCorrelationBuildInputs['semanticSnapshot']['programs'][number];
	readonly project: SourceOriginCorrelationBuildInputs['semanticSnapshot']['projects'][number];
	readonly source: SourceOriginCorrelationBuildInputs['semanticSnapshot']['sources'][number];
}

function bindInputs(
	inputs: SourceOriginCorrelationBuildInputs,
	checkpoint: DeadlineCheckpoint
): BoundInputs {
	const request = inputs.request;
	if (
		request.subjectId !== inputs.frozenSubject.descriptor.subjectId ||
		request.subjectId !== inputs.semanticSnapshot.subjectId ||
		request.semanticSnapshotId !== inputs.semanticSnapshot.id
	)
		failDerivation(
			'INPUT_INVALID',
			'Request, FrozenSubject, and semantic identities do not reconcile.'
		);
	const unique = <Value>(
		values: readonly Value[],
		predicate: (value: Value) => boolean,
		label: string
	): Value => {
		let match: Value | undefined;
		let count = 0;
		for (const value of values) {
			checkpoint();
			if (!predicate(value)) continue;
			match = value;
			count += 1;
		}
		if (count !== 1 || match === undefined)
			failDerivation('INPUT_INVALID', `The exact selected ${label} is unavailable.`);
		return match;
	};
	const project = unique(
		inputs.semanticSnapshot.projects,
		(candidate) => candidate.id === request.semanticProjectId,
		'semantic project'
	);
	const program = unique(
		inputs.semanticSnapshot.programs,
		(candidate) => candidate.id === request.semanticProgramId,
		'semantic Program'
	);
	const source = unique(
		inputs.semanticSnapshot.sources,
		(candidate) => candidate.id === request.semanticSourceId,
		'semantic source'
	);
	let programSourceMembership = 0;
	for (const id of program.sourceIds) {
		checkpoint();
		if (id === source.id) programSourceMembership += 1;
	}
	let projectSourceMembership = 0;
	for (const id of project.sourceIds) {
		checkpoint();
		if (id === source.id) projectSourceMembership += 1;
	}
	if (
		project.programId !== program.id ||
		program.projectId !== project.id ||
		source.projectId !== project.id ||
		source.programId !== program.id ||
		source.origin !== 'AUTHORED' ||
		source.declarationFile ||
		source.rootFile !== true ||
		programSourceMembership !== 1 ||
		projectSourceMembership !== 1
	)
		failDerivation(
			'INPUT_INVALID',
			'Selected project, Program, and authored root source do not reconcile.'
		);
	if (!validLogicalPath(source.logicalPath, request.budgets.maxPathCharacters, checkpoint))
		failDerivation('INPUT_INVALID', 'Selected authored source path is invalid.');
	const manifestArtifact = unique(
		inputs.frozenSubject.artifacts,
		(candidate) => candidate.path === source.logicalPath,
		'FrozenSubject authored artifact'
	);
	if (manifestArtifact.bytes !== source.bytes || manifestArtifact.sha256 !== source.contentSha256)
		failDerivation(
			'INPUT_INVALID',
			'Authored source does not reconcile with the FrozenSubject manifest.'
		);
	return { manifestArtifact, program, project, source };
}

function programSourcePopulation(
	inputs: SourceOriginCorrelationBuildInputs,
	bound: BoundInputs,
	checkpoint: DeadlineCheckpoint
): readonly SourceOriginProgramSourceIdentity[] {
	const maximumSources = Math.min(
		inputs.request.budgets.maxProgramSourceFiles,
		HARD_MAX_PROGRAM_SOURCE_FILES
	);
	if (bound.program.sourceIds.length > maximumSources)
		failDerivation(
			'BUDGET_EXHAUSTED',
			'Selected Program source identifiers exceed the preallocation ceiling.'
		);
	const sources: SourceOriginProgramSourceIdentity[] = [];
	const seenPaths = new Set<string>();
	for (const candidate of inputs.semanticSnapshot.sources) {
		checkpoint();
		if (candidate.programId !== bound.program.id) continue;
		if (
			!validLogicalPath(candidate.logicalPath, inputs.request.budgets.maxPathCharacters, checkpoint)
		)
			failDerivation('INPUT_INVALID', 'Selected Program contains an invalid source path.');
		if (seenPaths.has(candidate.logicalPath))
			failDerivation('INPUT_INVALID', 'Selected Program repeats a logical source path.');
		if (sources.length >= maximumSources)
			failDerivation(
				'BUDGET_EXHAUSTED',
				'Selected Program source population exceeds the preallocation ceiling.'
			);
		seenPaths.add(candidate.logicalPath);
		sources.push({
			bytes: candidate.bytes,
			contentSha256: candidate.contentSha256,
			declarationFile: candidate.declarationFile,
			logicalPath: candidate.logicalPath,
			origin: candidate.origin,
			semanticSourceId: candidate.id
		});
	}
	if (sources.length !== bound.program.sourceIds.length || sources.length > maximumSources)
		failDerivation('INPUT_INVALID', 'Selected Program source population does not reconcile.');
	sources.sort((left, right) => {
		checkpoint();
		const pathOrder = compareUtf16(left.logicalPath, right.logicalPath, checkpoint);
		return pathOrder !== 0
			? pathOrder
			: compareUtf16(left.semanticSourceId, right.semanticSourceId, checkpoint);
	});
	return sources;
}

function denseArray(value: unknown, expectedLength: number): value is unknown[] {
	if (
		!Array.isArray(value) ||
		isProxyValue(value) ||
		Reflect.getPrototypeOf(value) !== Array.prototype
	)
		return false;
	const keys = Reflect.ownKeys(value);
	if (value.length !== expectedLength || keys.length !== expectedLength + 1) return false;
	for (let index = 0; index < expectedLength; index += 1) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			return false;
	}
	return keys.every(
		(key) =>
			typeof key === 'string' &&
			(key === 'length' || (/^(?:0|[1-9][0-9]*)$/u.test(key) && Number(key) < expectedLength))
	);
}

function providerRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
	return plainRecord(value) && exactKeys(value, keys);
}

function validateProviderEmission(
	value: unknown,
	inputs: SourceOriginCorrelationBuildInputs,
	bound: BoundInputs,
	programSources: readonly SourceOriginProgramSourceIdentity[],
	checkpoint: DeadlineCheckpoint
): CompilerProjectDeclarationEmission {
	if (!providerRecord(value, PROVIDER_RESULT_KEYS))
		failDerivation('INPUT_INVALID', 'Fresh declaration provider returned an invalid exact shell.');
	if (ownDataValue(value, 'version') !== COMPILER_PROJECT_DECLARATION_EMISSION_VERSION)
		failDerivation('INPUT_INVALID', 'Fresh declaration provider version is unsupported.');
	const outputsValue = ownDataValue(value, 'outputs');
	const sourceValue = ownDataValue(value, 'materializedSource');
	const selectionValue = ownDataValue(value, 'selection');
	const witnessValue = ownDataValue(value, 'emissionWitness');
	if (
		!denseArray(outputsValue, 2) ||
		!providerRecord(sourceValue, PROVIDER_SOURCE_KEYS) ||
		!providerRecord(selectionValue, PROVIDER_SELECTION_KEYS) ||
		!providerRecord(witnessValue, PROVIDER_WITNESS_KEYS)
	)
		failDerivation('INPUT_INVALID', 'Fresh declaration provider returned malformed evidence.');
	const outputs = outputsValue as CompilerProjectDeclarationEmission['outputs'];
	const maximumOutputCharacters = Math.min(
		inputs.request.budgets.maxEmitStringCharacters,
		HARD_MAX_EMIT_STRING_CHARACTERS
	);
	let outputCharacters = 0;
	for (let index = 0; index < outputs.length; index += 1) {
		checkpoint();
		const output = outputs[index];
		if (!providerRecord(output, PROVIDER_OUTPUT_KEYS))
			failDerivation(
				'INPUT_INVALID',
				'Fresh declaration provider returned a malformed output record.'
			);
		if (
			!safeNonnegative(output.bytes) ||
			!safeNonnegative(output.textLength) ||
			typeof output.content !== 'string' ||
			output.content.length !== output.textLength ||
			output.content.length > maximumOutputCharacters
		)
			failDerivation('INPUT_INVALID', 'Fresh declaration provider output evidence is invalid.');
		outputCharacters = checkedAdd(outputCharacters, output.content.length);
		if (outputCharacters > maximumOutputCharacters)
			failDerivation(
				'BUDGET_EXHAUSTED',
				'Fresh declaration provider output text exceeds the cumulative character ceiling.'
			);
	}
	for (let index = 0; index < outputs.length; index += 1) {
		checkpoint();
		const output = outputs[index]!;
		if (
			typeof output.contentSha256 !== 'string' ||
			!SHA256.test(output.contentSha256) ||
			typeof output.logicalPath !== 'string' ||
			!validLogicalPath(output.logicalPath, inputs.request.budgets.maxPathCharacters, checkpoint) ||
			output.sourceLogicalPath !== bound.source.logicalPath ||
			output.writeByteOrderMark !== false ||
			(output.kind !== 'DECLARATION' && output.kind !== 'DECLARATION_MAP') ||
			!isUnicodeScalarString(output.content, checkpoint)
		)
			failDerivation('INPUT_INVALID', 'Fresh declaration provider output evidence is invalid.');
	}
	const source = sourceValue as unknown as CompilerProjectDeclarationEmission['materializedSource'];
	const maximumSourceCharacters = Math.min(
		inputs.request.budgets.maxSourceTextCodeUnits,
		HARD_MAX_SOURCE_TEXT_CODE_UNITS
	);
	if (
		!safeNonnegative(source.contentBytes) ||
		!safeNonnegative(source.textLength) ||
		typeof source.text !== 'string' ||
		source.text.length !== source.textLength ||
		source.text.length > maximumSourceCharacters ||
		typeof source.contentSha256 !== 'string' ||
		!SHA256.test(source.contentSha256) ||
		source.logicalPath !== bound.source.logicalPath ||
		source.semanticProjectId !== bound.project.id ||
		source.semanticProgramId !== bound.program.id ||
		source.semanticSourceId !== bound.source.id ||
		source.contentBytes !== bound.source.bytes ||
		source.contentSha256 !== bound.source.contentSha256 ||
		source.textLength !== bound.source.textLength ||
		!isUnicodeScalarString(source.text, checkpoint)
	)
		failDerivation(
			'INPUT_INVALID',
			'Fresh declaration provider source materialization is invalid.'
		);
	const sourceTextEvidence = utf8TextEvidence(source.text, checkpoint);
	if (
		sourceTextEvidence.bytes !== bound.source.bytes ||
		sourceTextEvidence.contentSha256 !== bound.source.contentSha256
	)
		failDerivation(
			'INPUT_INVALID',
			'Fresh declaration provider source text bytes do not reconcile with the authored source.'
		);
	const selection = selectionValue as unknown as CompilerProjectDeclarationEmission['selection'];
	if (
		selection.logicalPath !== bound.source.logicalPath ||
		selection.semanticProgramId !== bound.program.id ||
		selection.semanticProjectId !== bound.project.id ||
		selection.semanticSourceId !== bound.source.id
	)
		failDerivation('INPUT_INVALID', 'Fresh declaration provider selection does not reconcile.');
	const witness = witnessValue as unknown as CompilerProjectDeclarationEmission['emissionWitness'];
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
		if (!safeNonnegative(witness[key]))
			failDerivation('INPUT_INVALID', `Fresh emission witness ${key} is invalid.`);
	for (const key of [
		'captureContextDigest',
		'compilerOptionsDigest',
		'materializedRecipeDigest',
		'programInputAttemptPopulationDigest',
		'programSourcePopulationDigest',
		'projectResolutionDigest'
	] as const) {
		const digest = witness[key];
		if (typeof digest !== 'string' || !SHA256.test(digest))
			failDerivation('INPUT_INVALID', `Fresh emission witness ${key} must be lowercase SHA-256.`);
	}
	const witnessOutputsValue = ownDataValue(witnessValue, 'outputs');
	if (!denseArray(witnessOutputsValue, outputs.length))
		failDerivation('INPUT_INVALID', 'Fresh emission witness output aliases are malformed.');
	for (let index = 0; index < outputs.length; index += 1) {
		checkpoint();
		const witnessOutput = witnessOutputsValue[index];
		const output = outputs[index]!;
		if (!providerRecord(witnessOutput, PROVIDER_OUTPUT_KEYS))
			failDerivation('INPUT_INVALID', 'Fresh emission witness output alias is malformed.');
		for (const key of PROVIDER_OUTPUT_KEYS) {
			const aliasValue = ownDataValue(witnessOutput, key);
			checkpoint();
			const reconciles = aliasValue === output[key];
			checkpoint();
			if (!reconciles) {
				checkpoint();
				failDerivation('INPUT_INVALID', 'Fresh emission witness output aliases do not reconcile.');
			}
		}
	}
	if (
		typeof witness.compilerVersion !== 'string' ||
		witness.compilerVersion.length === 0 ||
		witness.compilerVersion !== inputs.semanticSnapshot.provider.version ||
		witness.configPath !== bound.project.configPath ||
		witness.selectedSourceLogicalPath !== bound.source.logicalPath ||
		witness.semanticProgramId !== bound.program.id ||
		witness.semanticProjectId !== bound.project.id ||
		witness.semanticSourceId !== bound.source.id ||
		witness.declarationEmitCallbacksUseOnlyAttributedQueries !== true ||
		witness.programCallbacksWithinAttributedInvocationBounds !== true ||
		witness.programInputAttemptPopulationReconciles !== true ||
		witness.programSourceFilePopulationReconciles !== true ||
		witness.emitApi !== 'TYPESCRIPT_PUBLIC_PROGRAM_EMIT' ||
		witness.emitOnlyDtsFiles !== true ||
		witness.emitSkipped !== false ||
		witness.state !==
			'FRESH_PUBLIC_TYPESCRIPT_DECLARATION_EMISSION_OVER_VERIFIED_PROJECT_SCOPED_CAPTURE' ||
		!denseArray(witness.emitDiagnostics, 0) ||
		witness.programSourceFiles !== programSources.length ||
		witness.programCompilerInputAttempts < witness.declarationEmitCompilerInputAttempts ||
		witness.programReadBytes < witness.declarationEmitReadBytes ||
		witness.programCompilerInputAttempts - witness.declarationEmitCompilerInputAttempts >
			witness.attributedCompilerInputAttempts ||
		witness.programReadBytes - witness.declarationEmitReadBytes >
			witness.attributedProgramReadBytes ||
		witness.programPresentReadFileAttempts > witness.programCompilerInputAttempts
	)
		failDerivation(
			'INPUT_INVALID',
			'Fresh emission witness population or identity does not reconcile.'
		);
	if (
		witness.programCompilerInputAttempts > inputs.request.budgets.maxCompilerInputAttempts ||
		witness.programCompilerInputAttempts > HARD_MAX_COMPILER_INPUT_ATTEMPTS ||
		witness.programCompilerInputAttempts > inputs.request.budgets.maxInputRecords ||
		witness.programReadBytes > inputs.request.budgets.maxProgramReadBytes
	)
		failDerivation('BUDGET_EXHAUSTED', 'Fresh emission exceeds Program input/read budgets.');
	const expectedSourceDigest = domainDigest(
		'JAN-CSAA-SOURCE-ORIGIN-PROGRAM-SOURCE-POPULATION',
		programSources,
		checkpoint
	);
	if (witness.programSourcePopulationDigest !== expectedSourceDigest)
		failDerivation('INPUT_INVALID', 'Fresh emission Program source digest does not reconcile.');
	return value as unknown as CompilerProjectDeclarationEmission;
}

interface DeriveParameters {
	readonly checkpoint: DeadlineCheckpoint;
	readonly inputStats: PlainTreeStats;
	readonly inputs: SourceOriginCorrelationBuildInputs;
	readonly knownInputDigest?: string;
	readonly mapBytes: Readonly<Uint8Array>;
	readonly provider: Readonly<ValidationProvider>;
	readonly remainingDurationMs: () => number;
	readonly targetBytes: Readonly<Uint8Array>;
}

type DeriveResult =
	| { readonly analysis: SourceOriginCorrelationSnapshot; readonly state: 'VALID' }
	| { readonly problem: SourceOriginCorrelationValidationIssue; readonly state: 'INVALID' };

function derive(parameters: DeriveParameters): DeriveResult {
	const {
		checkpoint,
		inputStats,
		inputs,
		knownInputDigest,
		mapBytes,
		provider,
		remainingDurationMs,
		targetBytes
	} = parameters;
	try {
		const budgets = inputs.request.budgets;
		const callerCaptureBytes = checkedAdd(targetBytes.byteLength, mapBytes.byteLength);
		if (
			callerCaptureBytes > budgets.maxCallerCaptureBytes ||
			callerCaptureBytes > budgets.maxReadBytes ||
			callerCaptureBytes > HARD_MAX_CAPTURE_BYTES
		)
			failDerivation('BUDGET_EXHAUSTED', 'Caller captures exceed request read/capture budgets.');
		const targetSha256 = bytesSha256(targetBytes, checkpoint);
		const mapSha256 = bytesSha256(mapBytes, checkpoint);
		if (
			targetBytes.byteLength !== inputs.request.targetDeclaration.contentBytes ||
			targetSha256 !== inputs.request.targetDeclaration.contentSha256 ||
			mapBytes.byteLength !== inputs.request.declarationMap.contentBytes ||
			mapSha256 !== inputs.request.declarationMap.contentSha256
		)
			failDerivation(
				'INPUT_INVALID',
				'Caller capture bytes do not reconcile with request descriptors.'
			);
		const targetText = decodeUtf8(
			targetBytes,
			'Target declaration capture',
			budgets.maxEmitStringCharacters,
			checkpoint
		);
		const mapText = decodeUtf8(
			mapBytes,
			'Declaration-map capture',
			budgets.maxEmitStringCharacters,
			checkpoint
		);
		const callerCaptureCharacters = checkedAdd(targetText.length, mapText.length);
		if (callerCaptureCharacters > budgets.maxEmitStringCharacters)
			failDerivation('BUDGET_EXHAUSTED', 'Caller capture texts exceed maxEmitStringCharacters.');
		const parsedMap = parseSourceMap(mapText, budgets, checkpoint);
		const bound = bindInputs(inputs, checkpoint);
		if (
			bound.source.textLength >
			Math.min(budgets.maxSourceTextCodeUnits, HARD_MAX_SOURCE_TEXT_CODE_UNITS)
		)
			failDerivation(
				'BUDGET_EXHAUSTED',
				'Selected authored source text exceeds the pre-emission materialization ceiling.'
			);
		const decodedSegments = parsedMap.segments.length;
		const plannedLocations = checkedMultiply(decodedSegments, 2);
		const plannedCorrelations = decodedSegments;
		const plannedUnmappedGeneratedLines = 1;
		const outputRecords = checkedAdd(
			7,
			checkedMultiply(decodedSegments, 4),
			plannedUnmappedGeneratedLines
		);
		if (
			decodedSegments > budgets.maxDecodedMapSegments ||
			plannedLocations > budgets.maxLocations ||
			plannedCorrelations > budgets.maxCorrelations ||
			plannedUnmappedGeneratedLines > budgets.maxUnmappedGeneratedLines ||
			outputRecords > budgets.maxOutputRecords
		)
			failDerivation(
				'BUDGET_EXHAUSTED',
				'Derived correlation populations exceed preallocation ceilings.'
			);
		const resolvedSourcePath = posix.normalize(
			posix.join(posix.dirname(inputs.request.declarationMap.logicalPath), parsedMap.rawSource)
		);
		if (
			parsedMap.file !== posix.basename(inputs.request.targetDeclaration.logicalPath) ||
			!validLogicalPath(resolvedSourcePath, budgets.maxPathCharacters, checkpoint) ||
			resolvedSourcePath !== bound.source.logicalPath
		)
			failDerivation(
				'INPUT_INVALID',
				'Declaration-map target/source path identities do not reconcile.'
			);
		const programSources = programSourcePopulation(inputs, bound, checkpoint);
		const inputDigest =
			knownInputDigest ?? captureInputDigest(inputs, targetBytes, mapBytes, checkpoint);
		const analysisId = analysisIdentity(inputs, inputDigest, checkpoint);
		if (budgets.maxInputRecords <= 2 || budgets.maxReadBytes <= callerCaptureBytes)
			failDerivation(
				'BUDGET_EXHAUSTED',
				'Caller aggregate input/read budgets leave no positive Program residual.'
			);
		const residualInputRecords = budgets.maxInputRecords - 2;
		const residualReadBytes = budgets.maxReadBytes - callerCaptureBytes;
		const providerInputRecords = Math.min(
			budgets.maxCompilerInputAttempts,
			HARD_MAX_COMPILER_INPUT_ATTEMPTS,
			residualInputRecords
		);
		const providerReadBytes = Math.min(budgets.maxProgramReadBytes, residualReadBytes);
		const providerOutputBytes = Math.min(
			budgets.maxEmitBytes,
			HARD_MAX_EMIT_BYTES,
			callerCaptureBytes
		);
		const providerOutputStringCharacters = Math.min(
			budgets.maxEmitStringCharacters,
			HARD_MAX_EMIT_STRING_CHARACTERS,
			callerCaptureCharacters
		);
		if (
			providerOutputBytes !== callerCaptureBytes ||
			providerOutputStringCharacters !== callerCaptureCharacters
		)
			failDerivation(
				'BUDGET_EXHAUSTED',
				'Exact caller-captured outputs cannot fit the residual declaration-emission budget.'
			);

		const providerDuration = remainingDurationMs();
		checkpoint();
		let rawEmission: unknown;
		try {
			rawEmission = provider.emitDeclaration(
				{
					compilerProgramLimits: {
						maxDurationMs: providerDuration,
						maxProgramInputRecords: providerInputRecords,
						maxProgramReadBytes: providerReadBytes,
						maxProgramSourceFiles: budgets.maxProgramSourceFiles,
						maxTotalInputRecords: providerInputRecords,
						maxTotalReadBytes: residualReadBytes
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
					maxInputRecords: providerInputRecords,
					maxOutputBytes: providerOutputBytes,
					maxOutputFiles: budgets.maxEmitOutputs,
					maxOutputStringCharacters: providerOutputStringCharacters,
					maxPathCharacters: budgets.maxPathCharacters,
					maxProgramSourceFiles: budgets.maxProgramSourceFiles,
					maxReadBytes: providerReadBytes,
					maxTraversalSteps: budgets.maxTraversalSteps
				},
				Object.freeze({ checkpoint })
			);
		} catch (error) {
			checkpoint();
			if (error instanceof CompilerProjectDeclarationEmissionError)
				failDerivation(
					error.code === 'BUDGET_EXCEEDED' ? 'BUDGET_EXHAUSTED' : 'INPUT_INVALID',
					'Fresh public declaration emission failed closed.'
				);
			failDerivation('INPUT_INVALID', 'Fresh public declaration provider failed closed.');
		}
		checkpoint();
		const emission = validateProviderEmission(
			rawEmission,
			inputs,
			bound,
			programSources,
			checkpoint
		);
		checkpoint();
		const targetOutputs = emission.outputs.filter((output) => output.kind === 'DECLARATION');
		const mapOutputs = emission.outputs.filter((output) => output.kind === 'DECLARATION_MAP');
		if (targetOutputs.length !== 1 || mapOutputs.length !== 1)
			failDerivation('INPUT_INVALID', 'Fresh emission output kinds do not reconcile.');
		const targetOutput = targetOutputs[0]!;
		const mapOutput = mapOutputs[0]!;
		checkpoint();
		const targetContentReconciles = targetOutput.content === targetText;
		checkpoint();
		const mapContentReconciles = mapOutput.content === mapText;
		checkpoint();
		if (
			targetOutput.logicalPath !== inputs.request.targetDeclaration.logicalPath ||
			targetOutput.bytes !== targetBytes.byteLength ||
			targetOutput.contentSha256 !== targetSha256 ||
			!targetContentReconciles ||
			mapOutput.logicalPath !== inputs.request.declarationMap.logicalPath ||
			mapOutput.bytes !== mapBytes.byteLength ||
			mapOutput.contentSha256 !== mapSha256 ||
			!mapContentReconciles
		) {
			checkpoint();
			failDerivation('DERIVATION_MISMATCH', 'Fresh emission is not byte-equal to caller captures.');
		}

		const targetArtifactWithoutId = {
			artifactClass: 'GENERATED_DECLARATION' as const,
			bytes: targetBytes.byteLength,
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
		const targetArtifactId = artifactIdentity(analysisId, targetArtifactWithoutId, checkpoint);
		const targetArtifact = { ...targetArtifactWithoutId, id: targetArtifactId };
		const mapArtifactWithoutId = {
			artifactClass: 'SOURCE_MAP' as const,
			bytes: mapBytes.byteLength,
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
		const mapArtifactId = artifactIdentity(analysisId, mapArtifactWithoutId, checkpoint);
		const mapArtifact = { ...mapArtifactWithoutId, id: mapArtifactId };
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
		const authoredArtifactId = artifactIdentity(analysisId, authoredArtifactWithoutId, checkpoint);
		const authoredArtifact = { ...authoredArtifactWithoutId, id: authoredArtifactId };
		const artifacts = [targetArtifact, mapArtifact, authoredArtifact] as const;

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
		const providerWitness = emission.emissionWitness;
		const emissionWithoutId = {
			attributedCompilerInputAttempts: providerWitness.attributedCompilerInputAttempts,
			attributedProgramReadBytes: providerWitness.attributedProgramReadBytes,
			attributedUniqueQueries: providerWitness.attributedUniqueQueries,
			captureContextDigest: providerWitness.captureContextDigest,
			compilerOptionsDigest: providerWitness.compilerOptionsDigest,
			compilerVersion: providerWitness.compilerVersion,
			configPath: providerWitness.configPath,
			declarationEmitCallbacksUseOnlyAttributedQueries: true as const,
			declarationEmitCompilerInputAttempts: providerWitness.declarationEmitCompilerInputAttempts,
			declarationEmitReadBytes: providerWitness.declarationEmitReadBytes,
			emitApi: 'TYPESCRIPT_PUBLIC_PROGRAM_EMIT' as const,
			emitDiagnostics: [] as const,
			emitOnlyDtsFiles: true as const,
			emitSkipped: false as const,
			materializedRecipeDigest: providerWitness.materializedRecipeDigest,
			outputReconciliation:
				'EXACT_TARGET_DECLARATION_AND_EXTERNAL_DECLARATION_MAP_BYTE_EQUALITY' as const,
			outputs: emissionOutputs,
			programCallbacksWithinAttributedInvocationBounds: true as const,
			programCompilerInputAttempts: providerWitness.programCompilerInputAttempts,
			programInputAttemptPopulationDigest: providerWitness.programInputAttemptPopulationDigest,
			programInputAttemptPopulationReconciles: true as const,
			programPresentReadFileAttempts: providerWitness.programPresentReadFileAttempts,
			programReadBytes: providerWitness.programReadBytes,
			programSourceFiles: providerWitness.programSourceFiles,
			programSourceFilePopulationReconciles: true as const,
			programSourcePopulationDigest: providerWitness.programSourcePopulationDigest,
			projectResolutionDigest: providerWitness.projectResolutionDigest,
			selectedSourceLogicalPath: bound.source.logicalPath,
			semanticProgramId: bound.program.id,
			semanticProjectId: bound.project.id,
			semanticSourceId: bound.source.id,
			state:
				'FRESH_PUBLIC_TYPESCRIPT_DECLARATION_EMISSION_OVER_VERIFIED_PROJECT_SCOPED_CAPTURE' as const
		};
		const emissionRecord = {
			...emissionWithoutId,
			id: emissionIdentity(analysisId, emissionWithoutId, checkpoint)
		};

		const sourceMapWithoutChildren = {
			decodedLines: parsedMap.generatedLines,
			decodedSegments: parsedMap.segments.length,
			file: parsedMap.file,
			format: 'SOURCE_MAP_V3' as const,
			mapArtifactId,
			mappingEncoding: 'BASE64_VLQ' as const,
			mappingsCharacters: parsedMap.mappings.length,
			mappingsSha256: textSha256(parsedMap.mappings, checkpoint),
			names: [] as const,
			ordinal: 0,
			rawSources: [parsedMap.rawSource] as const,
			resolvedSourceArtifactIds: [authoredArtifactId] as const,
			sourceRoot: '' as const,
			sourcesContent: 'ABSENT' as const,
			targetArtifactId,
			version: 3 as const
		};
		const sourceMapId = sourceMapIdentity(analysisId, sourceMapWithoutChildren, checkpoint);
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
			mappedSegments: parsedMap.segments.length,
			ordinal: 0,
			reverseLookup: 'TOTAL_UNIQUE_OVER_COMPLETE_MAPPED_SEGMENT_POPULATION' as const,
			sourceArtifactIdentityMatches: true as const,
			sourcePathResolution: 'EXACT_REPOSITORY_INTERNAL' as const,
			state: 'EXACT' as const,
			targetArtifactIdentityMatches: true as const,
			unmappedGeneratedLinesExplicit: true as const
		};
		const mappingHealthId = mappingHealthIdentity(analysisId, mappingHealthWithoutId, checkpoint);
		const mappingHealth = { ...mappingHealthWithoutId, id: mappingHealthId };

		const targetLines = textLines(
			targetText,
			checkedAdd(Math.min(budgets.maxDecodedMapLines, HARD_MAX_DECODED_LINES), 1),
			checkpoint
		);
		const authoredLineOrdinals = new Set<number>();
		for (const decoded of parsedMap.segments) {
			checkpoint();
			if (
				!authoredLineOrdinals.has(decoded.originalLine) &&
				authoredLineOrdinals.size >= decodedSegments
			)
				failDerivation(
					'BUDGET_EXHAUSTED',
					'Sparse authored-line population exceeds the decoded-segment preflight.'
				);
			authoredLineOrdinals.add(decoded.originalLine);
		}
		const authoredLines = sparseTextLineBounds(
			emission.materializedSource.text,
			authoredLineOrdinals,
			decodedSegments,
			checkpoint
		);
		if (targetLines.length !== parsedMap.generatedLines + 1)
			failDerivation(
				'INPUT_INVALID',
				'Target declaration must contain exactly one final line beyond decoded mapping lines.'
			);
		const generatedLineMapped = new Uint8Array(parsedMap.generatedLines);
		checkpoint();
		if (generatedLineMapped.length !== parsedMap.generatedLines)
			failDerivation('BUDGET_EXHAUSTED', 'Generated-line tracking allocation failed closed.');
		const generatedCoordinates = new Set<string>();
		const authoredCoordinates = new Set<string>();
		const segmentRecords: Array<SourceOriginCorrelationSnapshot['segments'][number]> = [];
		const locationRecords: Array<SourceOriginCorrelationSnapshot['locations'][number]> = [];
		const correlationRecords: Array<SourceOriginCorrelationSnapshot['correlations'][number]> = [];
		for (const decoded of parsedMap.segments) {
			checkpoint();
			const generatedOffset = coordinateOffset(
				targetLines,
				decoded.generatedLine,
				decoded.generatedColumn,
				'Generated coordinate'
			);
			const authoredOffset = sparseCoordinateOffset(
				authoredLines,
				decoded.originalLine,
				decoded.originalColumn,
				'Authored coordinate'
			);
			const generatedKey = `${decoded.generatedLine}:${decoded.generatedColumn}`;
			const authoredKey = `${decoded.originalLine}:${decoded.originalColumn}`;
			if (generatedCoordinates.has(generatedKey) || authoredCoordinates.has(authoredKey))
				failDerivation('INPUT_INVALID', 'Mapped endpoint coordinates must be globally unique.');
			generatedCoordinates.add(generatedKey);
			authoredCoordinates.add(authoredKey);
			generatedLineMapped[decoded.generatedLine] = 1;
			const segmentWithoutId = {
				decodedFieldCount: 4 as const,
				generatedColumn: decoded.generatedColumn,
				generatedLine: decoded.generatedLine,
				lineSegmentOrdinal: decoded.lineSegmentOrdinal,
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
			const segmentId = segmentIdentity(analysisId, segmentWithoutId, checkpoint);
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
			const generatedLocationId = locationIdentity(
				analysisId,
				generatedLocationWithoutId,
				checkpoint
			);
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
			const authoredLocationId = locationIdentity(
				analysisId,
				authoredLocationWithoutId,
				checkpoint
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
				id: exactCorrelationIdentity(analysisId, correlationWithoutId, checkpoint)
			});
		}
		for (let line = 0; line < generatedLineMapped.length; line += 1) {
			checkpoint();
			if (generatedLineMapped[line] === 0)
				failDerivation('INPUT_INVALID', 'Only the required final trailer line may be unmapped.');
		}
		const trailerLine = targetLines[targetLines.length - 1]!;
		const expectedTrailer = `//# sourceMappingURL=${posix.basename(inputs.request.declarationMap.logicalPath)}`;
		const trailerContent = targetText.slice(trailerLine.startOffset, trailerLine.endOffset);
		if (trailerContent !== expectedTrailer)
			failDerivation(
				'INPUT_INVALID',
				'Target declaration lacks the exact final sourceMappingURL trailer.'
			);
		const unmappedWithoutId = {
			classification: 'SOURCE_MAPPING_URL_TRAILER' as const,
			contentSha256: textSha256(trailerContent, checkpoint),
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
		const unmappedRecord = {
			...unmappedWithoutId,
			id: unmappedLineIdentity(analysisId, unmappedWithoutId, checkpoint)
		};
		const unmappedRecords = [unmappedRecord] as const;
		const segmentIds: Array<SourceOriginCorrelationSnapshot['segments'][number]['id']> = [];
		for (const record of segmentRecords) {
			checkpoint();
			if (segmentIds.length >= budgets.maxDecodedMapSegments)
				failDerivation('BUDGET_EXHAUSTED', 'Source-map child identity budget was exhausted.');
			segmentIds.push(record.id);
		}
		const sourceMapRecord = {
			...sourceMapWithoutChildren,
			id: sourceMapId,
			segmentIds,
			unmappedGeneratedLineIds: [unmappedRecord.id]
		};

		const locations = locationRecords.length;
		const correlations = correlationRecords.length;
		const chargedInputRecords = checkedAdd(providerWitness.programCompilerInputAttempts, 2);
		const emitBytes = checkedAdd(targetOutput.bytes, mapOutput.bytes);
		const readBytes = checkedAdd(providerWitness.programReadBytes, callerCaptureBytes);
		const chargedTraversalSteps = checkedAdd(
			inputStats.records,
			inputStats.stringCharacters,
			checkedMultiply(3, callerCaptureBytes),
			mapText.length,
			parsedMap.mappings.length,
			targetText.length,
			emission.materializedSource.text.length,
			providerWitness.programCompilerInputAttempts,
			providerWitness.programSourceFiles,
			decodedSegments,
			outputRecords
		);
		if (
			segmentRecords.length !== decodedSegments ||
			parsedMap.generatedLines > budgets.maxDecodedMapLines ||
			locations !== plannedLocations ||
			correlations !== plannedCorrelations ||
			unmappedRecords.length !== plannedUnmappedGeneratedLines ||
			chargedInputRecords > budgets.maxInputRecords ||
			emitBytes > budgets.maxEmitBytes ||
			readBytes > budgets.maxReadBytes ||
			chargedTraversalSteps > budgets.maxTraversalSteps
		)
			failDerivation(
				'BUDGET_EXHAUSTED',
				'Derived populations exceed source-origin request budgets.'
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
			correlations,
			decodedLines: parsedMap.generatedLines,
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
			locations,
			mappingHealthRecords: 1 as const,
			mappingsCharacters: parsedMap.mappings.length,
			outputRecords,
			partialMappings: 0 as const,
			programCompilerInputAttemptPopulationReconciles: true as const,
			programCompilerInputAttempts: providerWitness.programCompilerInputAttempts,
			programPresentReadFileAttempts: providerWitness.programPresentReadFileAttempts,
			programReadBytes: providerWitness.programReadBytes,
			programSourceFilePopulationReconciles: true as const,
			programSourceFiles: providerWitness.programSourceFiles,
			readBytes,
			sourceMaps: 1 as const,
			unavailableMappings: 0 as const,
			unmappedGeneratedLinePopulationReconciles: true as const,
			unmappedGeneratedLines: unmappedRecords.length
		};
		const semanticValidationWitness = {
			context: 'FROZEN_SUBJECT' as const,
			frozenSubjectSha256: canonicalSha256(inputs.frozenSubject, checkpoint),
			method: 'VALIDATE_STATIC_SEMANTIC_SNAPSHOT_WITH_FROZEN_SUBJECT' as const,
			semanticSnapshotId: inputs.semanticSnapshot.id,
			semanticSnapshotSha256: canonicalSha256(inputs.semanticSnapshot, checkpoint),
			state: 'VALID' as const,
			subjectId: inputs.request.subjectId
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
			semanticValidationWitness,
			sourceMap: sourceMapRecord,
			subjectId: inputs.request.subjectId,
			truncation: { reason: null, state: 'NOT_TRUNCATED' as const },
			unmappedGeneratedLines: unmappedRecords
		};
		const analysis = {
			...content,
			contentDigest: domainDigest('JAN-CSAA-SOURCE-ORIGIN-CORRELATION-CONTENT', content, checkpoint)
		} as SourceOriginCorrelationSnapshot;
		checkpoint();
		return { analysis, state: 'VALID' };
	} catch (error) {
		if (error instanceof DerivationFailure) return { problem: error.problem, state: 'INVALID' };
		if (error instanceof ValidationAbort) return { problem: error.problem, state: 'INVALID' };
		return {
			problem: issue(
				'INPUT_INVALID',
				'Source-origin inputs could not be independently replayed.',
				'$inputs'
			),
			state: 'INVALID'
		};
	}
}

function validateInternal(
	value: unknown,
	inputsValue: unknown,
	optionsValue: SourceOriginCorrelationValidationOptions | undefined,
	provider: Readonly<ValidationProvider>,
	knownInputDigest?: string,
	semanticAlreadyValidated = false
): SourceOriginCorrelationValidationResult {
	let startedAt: number;
	try {
		startedAt = provider.monotonicNow();
	} catch {
		return invalid(issue('INPUT_INVALID', 'The validation operation clock is unavailable.'));
	}
	if (!Number.isFinite(startedAt) || startedAt < 0)
		return invalid(issue('INPUT_INVALID', 'The validation operation clock is unavailable.'));
	let lastObservedAt = startedAt;
	const options = closeOptions(optionsValue);
	if (options === null)
		return invalid(issue('SHAPE_INVALID', 'Validation options are invalid.', '$options'));
	let activeDurationMs = Math.min(
		options.maxDurationMs,
		earlyRequestDuration(inputsValue) ?? options.maxDurationMs,
		HARD_MAX_DURATION_MS
	);
	const remainingDuration = (): number => {
		let observed: number;
		try {
			observed = provider.monotonicNow();
		} catch {
			throw new ValidationAbort(
				issue('INPUT_INVALID', 'The validation monotonic clock failed closed.')
			);
		}
		if (!Number.isFinite(observed) || observed < startedAt || observed < lastObservedAt)
			throw new ValidationAbort(
				issue('INPUT_INVALID', 'The validation monotonic clock failed closed.')
			);
		lastObservedAt = observed;
		const elapsed = Math.floor(observed - startedAt);
		if (!safeNonnegative(elapsed))
			throw new ValidationAbort(
				issue('INPUT_INVALID', 'The validation monotonic elapsed time is invalid.')
			);
		const remaining = activeDurationMs - elapsed;
		if (!safePositive(remaining))
			throw new ValidationAbort(
				issue('BUDGET_EXHAUSTED', 'The validation duration budget was exhausted.')
			);
		return remaining;
	};
	const checkpoint = (): void => {
		remainingDuration();
	};
	try {
		checkpoint();
		if (!plainRecord(value) || !exactKeys(value, SNAPSHOT_KEYS))
			return invalid(
				issue('SHAPE_INVALID', 'The source-origin candidate snapshot shell must be exact.')
			);
		const shellProblem = inputShellIssue(inputsValue);
		if (shellProblem !== null) return invalid(shellProblem);
		const inputs = inputsValue as SourceOriginCorrelationBuildInputs;
		const initialRequestTree = inspectPlainTree(
			inputs.request,
			{
				maxDepth: options.maxDepth,
				maxRecords: Math.min(options.maxInputRecords, HARD_MAX_INPUT_RECORDS),
				maxStringCharacters: Math.min(
					options.maxInputStringCharacters,
					HARD_MAX_INPUT_STRING_CHARACTERS
				)
			},
			'$inputs.request',
			'INPUT_INVALID',
			checkpoint
		);
		if (initialRequestTree.state === 'INVALID') return invalid(initialRequestTree.problem);
		const requestProblem = requestIssue(inputs, checkpoint);
		if (requestProblem !== null) return invalid(requestProblem);
		activeDurationMs = Math.min(
			options.maxDurationMs,
			inputs.request.budgets.maxDurationMs,
			HARD_MAX_DURATION_MS
		);
		checkpoint();
		const inputStats = inspectInputPlainData(inputs, options, checkpoint);
		checkpoint();
		const populationProblem = candidatePopulationIssue(value, inputs.request.budgets);
		if (populationProblem !== null) return invalid(populationProblem);
		const candidateTree = inspectPlainTree(
			value,
			{
				maxDepth: options.maxDepth,
				maxRecords: options.maxRecords,
				maxStringCharacters: options.maxStringCharacters
			},
			'$',
			'SHAPE_INVALID',
			checkpoint
		);
		if (candidateTree.state === 'INVALID') return invalid(candidateTree.problem);
		const targetCaptureBytes = captureByteLength(
			inputs.targetDeclarationBytes,
			'$inputs.targetDeclarationBytes'
		);
		const mapCaptureBytes = captureByteLength(
			inputs.declarationMapBytes,
			'$inputs.declarationMapBytes'
		);
		const callerCaptureBytes = checkedAdd(targetCaptureBytes, mapCaptureBytes);
		const maximumCallerCaptureBytes = Math.min(
			inputs.request.budgets.maxCallerCaptureBytes,
			inputs.request.budgets.maxReadBytes,
			HARD_MAX_CAPTURE_BYTES
		);
		if (callerCaptureBytes > maximumCallerCaptureBytes)
			return invalid(
				issue(
					'BUDGET_EXHAUSTED',
					'Caller capture byte population exceeds request budgets.',
					'$inputs'
				)
			);
		const targetBytes = copyCapture(
			inputs.targetDeclarationBytes,
			targetCaptureBytes,
			'$inputs.targetDeclarationBytes',
			checkpoint
		);
		const mapBytes = copyCapture(
			inputs.declarationMapBytes,
			mapCaptureBytes,
			'$inputs.declarationMapBytes',
			checkpoint
		);
		if (!semanticAlreadyValidated) {
			checkpoint();
			const semanticRecords = Math.min(
				options.maxInputRecords,
				inputs.request.budgets.maxInputRecords,
				HARD_MAX_INPUT_RECORDS
			);
			const semanticStrings = Math.min(
				options.maxInputStringCharacters,
				inputs.request.budgets.maxInputStringCharacters,
				HARD_MAX_INPUT_STRING_CHARACTERS
			);
			const semanticIssues = Math.min(options.maxIssues, inputs.request.budgets.maxDiagnostics);
			const semantic = validateStaticSemanticSnapshot(
				inputs.semanticSnapshot,
				{
					maxDepth: options.maxDepth,
					maxDiagnostics: semanticIssues,
					maxIssues: semanticIssues,
					maxRecords: semanticRecords,
					maxReferenceChecks: semanticRecords,
					maxStringCharacters: semanticStrings
				},
				{ frozenSubject: inputs.frozenSubject }
			);
			checkpoint();
			if (semantic.state !== 'VALID')
				return invalid(
					issue(
						semantic.state === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INPUT_INVALID',
						'The StaticSemanticSnapshot is not valid for the exact FrozenSubject.',
						'$inputs.semanticSnapshot'
					)
				);
		}
		checkpoint();
		const expected = derive({
			checkpoint,
			inputStats,
			inputs,
			knownInputDigest,
			mapBytes,
			provider,
			remainingDurationMs: remainingDuration,
			targetBytes
		});
		if (expected.state === 'INVALID') return invalid(expected.problem);
		checkpoint();
		const candidate = value as unknown as SourceOriginCorrelationSnapshot;
		if (
			candidate.inputDigest !== expected.analysis.inputDigest ||
			candidate.id !== expected.analysis.id
		)
			return invalid(
				issue(
					'IDENTITY_MISMATCH',
					'The candidate source-origin identities do not reproduce from the exact inputs.'
				)
			);
		if (candidate.contentDigest !== expected.analysis.contentDigest)
			return invalid(
				issue(
					'CONTENT_DIGEST_MISMATCH',
					'The candidate source-origin content digest does not reproduce.',
					'$.contentDigest'
				)
			);
		if (!canonicalEqual(candidate, expected.analysis, checkpoint))
			return invalid(
				issue(
					'DERIVATION_MISMATCH',
					'The candidate differs from the independently replayed source-origin correlation.'
				)
			);
		checkpoint();
		return { issues: [], state: 'VALID' };
	} catch (error) {
		if (error instanceof ValidationAbort) return invalid(error.problem);
		if (error instanceof DerivationFailure) return invalid(error.problem);
		return invalid(issue('SHAPE_INVALID', 'Source-origin correlation validation failed closed.'));
	}
}

export function validateSourceOriginCorrelation(
	value: unknown,
	inputs: SourceOriginCorrelationBuildInputs,
	options?: SourceOriginCorrelationValidationOptions
): SourceOriginCorrelationValidationResult {
	if (arguments.length < 2 || arguments.length > 3)
		return invalid(
			issue('SHAPE_INVALID', 'The validator requires exactly two or three arguments.', '$arguments')
		);
	try {
		return validateInternal(value, inputs, options, DIRECT_VALIDATION_PROVIDER);
	} catch {
		return invalid(issue('SHAPE_INVALID', 'Source-origin correlation validation failed closed.'));
	}
}

/**
 * @internal Immutable per-call provider-fault seam. It is intentionally absent from the package
 * root; production and constructed entry points always bind the frozen direct provider.
 */
export function validateSourceOriginCorrelationWithProviderForTesting(
	value: unknown,
	inputs: SourceOriginCorrelationBuildInputs,
	providerOverrides: SourceOriginCorrelationValidationProviderOverrides,
	options?: SourceOriginCorrelationValidationOptions
): SourceOriginCorrelationValidationResult {
	if (arguments.length < 3 || arguments.length > 4)
		return invalid(
			issue(
				'SHAPE_INVALID',
				'The provider-test validator requires exactly three or four arguments.',
				'$arguments'
			)
		);
	try {
		const provider = closeProviderOverrides(providerOverrides);
		if (provider === null)
			return invalid(
				issue('SHAPE_INVALID', 'Validation provider overrides are invalid.', '$providerOverrides')
			);
		return validateInternal(value, inputs, options, provider);
	} catch {
		return invalid(issue('SHAPE_INVALID', 'Provider-test source-origin validation failed closed.'));
	}
}

/**
 * @internal Producer-only path with a trusted immediate precondition: the exact FrozenSubject and
 * StaticSemanticSnapshot object graph must have passed public semantic validation synchronously
 * beforehand. The known digest skips only redundant public input digesting/semantic validation;
 * capture copying, fresh emission, strict map decoding, every derived identity/population, and the
 * final exact comparison are repeated independently with the frozen direct provider.
 */
export function validateConstructedSourceOriginCorrelation(
	value: unknown,
	inputs: SourceOriginCorrelationBuildInputs,
	knownInputDigest: string,
	options?: SourceOriginCorrelationValidationOptions
): SourceOriginCorrelationValidationResult {
	if (arguments.length < 3 || arguments.length > 4)
		return invalid(
			issue(
				'SHAPE_INVALID',
				'The constructed validator requires exactly three or four arguments.',
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
		return validateInternal(
			value,
			inputs,
			options,
			DIRECT_VALIDATION_PROVIDER,
			knownInputDigest,
			true
		);
	} catch {
		return invalid(
			issue('SHAPE_INVALID', 'Constructed source-origin correlation validation failed closed.')
		);
	}
}
