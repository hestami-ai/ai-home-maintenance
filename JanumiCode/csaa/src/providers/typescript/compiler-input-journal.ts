import {
	closeSync,
	fstatSync,
	openSync,
	opendirSync,
	readFileSync,
	realpathSync,
	statSync
} from 'node:fs';
import { isAbsolute, posix } from 'node:path';
import { isProxy } from 'node:util/types';
import {
	SEMANTIC_BUDGET_KEYS,
	type CompilerInputObservation,
	type SemanticBudgets,
	type SemanticContextInputId,
	type SemanticSourceTransformationRecord,
	type SourceOrigin
} from '../../contracts/semantic.js';
import type { FrozenSubject, ProgramRecipe } from '../../contracts/subject.js';
import { compareText, sha256 } from '../../inventory/canonical.js';
import {
	canonicalSemanticJson,
	canonicalSemanticJsonWitnessWithProgress
} from '../../semantic/canonical.js';
import {
	compilerInputClosureDigest,
	compilerInputResultDigest,
	semanticContextInputId
} from '../../semantic/ids.js';
import type {
	SemanticOperationClock,
	SemanticOperationPopulationClaimInput
} from '../../semantic/operation-budget-ledger.js';
import { validateProgramRecipePolicy } from '../../semantic/program-recipe-policy.js';
import type { StaticSemanticOperationBudgetProviderBinding } from '../../semantic/operation-budget-provider-binding.js';
import { readFrozenSubjectArtifact } from '../../subject/frozen-store.js';
import {
	SVELTE_VIRTUAL_SOURCE_IMPLEMENTATION_LIMITS,
	SvelteVirtualSourceError,
	transformSvelteVirtualSource,
	type SvelteVirtualSourceLimits
} from '../svelte/svelte-virtual-source.js';
import { CompilerPathError, FrozenCompilerPathResolver } from './compiler-paths.js';
import {
	materializeProgramRecipe,
	type MaterializedProgramRecipe
} from './materialize-program-recipe.js';

type WithoutIdentity<T> = T extends unknown ? Omit<T, 'id' | 'resultDigest'> : never;
type CompilerObservationPayload = WithoutIdentity<CompilerInputObservation>;

export type CompilerInputQuery =
	| {
			readonly logicalPath: string;
			readonly operation:
				'READ_FILE' | 'FILE_EXISTS' | 'DIRECTORY_EXISTS' | 'GET_DIRECTORIES' | 'REALPATH';
	  }
	| {
			readonly depth: number | null;
			readonly excludes: readonly string[];
			readonly extensions: readonly string[];
			readonly includes: readonly string[];
			readonly logicalPath: string;
			readonly operation: 'READ_DIRECTORY';
	  }
	| {
			readonly logicalPath: '.';
			readonly operation: 'CURRENT_DIRECTORY' | 'USE_CASE_SENSITIVE_FILE_NAMES';
	  };

export interface CapturedCompilerInput {
	readonly bytes?: Uint8Array;
	readonly observation: CompilerInputObservation;
	readonly query: CompilerInputQuery;
}

export interface CompilerInputEvidenceEntry {
	readonly observation: CompilerInputObservation;
	readonly query: CompilerInputQuery;
}

export interface CompilerProjectQueryAttribution {
	readonly invocationCount: number;
	readonly query: CompilerInputQuery;
}

export interface CompilerProjectAttribution {
	readonly contextInputIds: readonly SemanticContextInputId[];
	readonly materializedRecipeDigest: string;
	readonly projectKey: string;
	readonly projectResolutionDigest: string;
	readonly queryInvocations: readonly CompilerProjectQueryAttribution[];
}

/** A bounded, pre-finalization evidence view for one discarded capture projection. */
export interface CapturedCompilerProjectEvidence {
	readonly attribution: CompilerProjectAttribution;
	readonly observations: readonly CompilerInputObservation[];
}

declare const FROZEN_CAPTURE_BRAND: unique symbol;
declare const VERIFIED_CAPTURE_BRAND: unique symbol;

export interface FrozenCompilerCapture {
	readonly [FROZEN_CAPTURE_BRAND]: true;
	readonly closureDigest: string;
	readonly entries: readonly CompilerInputEvidenceEntry[];
	readonly observations: readonly CompilerInputObservation[];
	readonly projectAttributions: readonly CompilerProjectAttribution[];
}

export interface VerifiedCompilerCapture {
	readonly [VERIFIED_CAPTURE_BRAND]: true;
	readonly closureDigest: string;
	readonly entries: readonly CompilerInputEvidenceEntry[];
	readonly observations: readonly CompilerInputObservation[];
	readonly projectAttributions: readonly CompilerProjectAttribution[];
}

/** @internal Exact semantic-snapshot projection bound to a verified compiler capture. */
export interface VerifiedCompilerCaptureSnapshotBinding {
	readonly compilerInputs: readonly CompilerInputObservation[];
	readonly contextDigest: string;
	readonly subjectId: string;
}

/** @internal Exact project projection bound to a verified compiler capture. */
export interface VerifiedCompilerProjectInputProjectionBinding {
	readonly configPath: string;
	readonly contextInputIds: readonly SemanticContextInputId[];
	readonly materializedRecipeDigest: string;
	readonly programContextDigest: string;
	readonly projectResolutionDigest: string;
}

/** @internal One-project convenience binding including the shared snapshot projection. */
export interface VerifiedCompilerProjectInputBinding
	extends VerifiedCompilerCaptureSnapshotBinding, VerifiedCompilerProjectInputProjectionBinding {}

/** @internal Bulk binding that proves the global capture once before opening project views. */
export interface VerifiedCompilerProjectInputLookupSetBinding extends VerifiedCompilerCaptureSnapshotBinding {
	readonly projects: readonly VerifiedCompilerProjectInputProjectionBinding[];
}

/** @internal One immutable lookup paired with its exact configuration path. */
export interface VerifiedCompilerProjectInputLookupSetEntry {
	readonly configPath: string;
	readonly lookup: VerifiedCompilerProjectInputLookup;
}

/**
 * @internal Immutable retained query/observation evidence, a fresh caller-owned byte copy when
 * present, and the project-scoped query multiplicity.
 */
export interface VerifiedCompilerProjectInputEntry extends CapturedCompilerInput {
	readonly attributedInvocationCount: number;
}

/** @internal Mutable bytes are borrowed only for the dynamic extent of a trusted host callback. */
export interface BorrowedVerifiedCompilerProjectInputEntry extends CapturedCompilerInput {
	readonly attributedInvocationCount: number;
}

/**
 * @internal Immutable, non-consuming access to the recorded inputs attributed to one project.
 * This is deliberately not replay: repeated lookups do not consume captured multiplicity.
 */
export interface VerifiedCompilerProjectInputLookup {
	readonly attribution: CompilerProjectAttribution;
	readonly subjectId: string;
	lookupAttributedQuery(
		query: CompilerInputQuery,
		onProgress?: () => void
	): VerifiedCompilerProjectInputEntry | undefined;
	withAttributedQueryForVerifiedHost(
		query: CompilerInputQuery,
		onProgress: () => void,
		consumer: (entry: BorrowedVerifiedCompilerProjectInputEntry) => void
	): boolean;
	toRecordedAbsolute(logicalPath: string): string;
	toRecordedLogical(path: string): string;
}

declare const COMPILER_INPUT_OPERATION_BUDGET_WITNESS_BRAND: unique symbol;
export interface CompilerInputOperationBudgetWitness {
	readonly [COMPILER_INPUT_OPERATION_BUDGET_WITNESS_BRAND]: true;
}

export interface CompilerInputOperationBudgetQueryCharge {
	readonly invocationCount: number;
	readonly projectKey: string;
	readonly queryKey: string;
}

export interface CompilerInputOperationBudgetEvidence {
	readonly phase: 'CAPTURE' | 'RECHECK';
	readonly populationClaims: readonly SemanticOperationPopulationClaimInput[];
	readonly queryCharges: readonly CompilerInputOperationBudgetQueryCharge[];
}

export class CompilerInputCaptureError extends Error {
	constructor(
		readonly code:
			| 'BUDGET_EXCEEDED'
			| 'CONTEXT_CHANGED'
			| 'CONTEXT_UNAVAILABLE'
			| 'DUPLICATE_QUERY'
			| 'FROZEN_BYTES_UNAVAILABLE'
			| 'INVALID_CAPTURE'
			| 'INVALID_QUERY'
			| 'UNCONSUMED_QUERY'
			| 'UNRECORDED_QUERY',
		message: string
	) {
		super(message);
		this.name = 'CompilerInputCaptureError';
	}
}

interface CompilerInputReadLimits {
	readonly allowPresentRead: boolean;
	readonly clock?: SemanticOperationClock;
	readonly deadlineMs: number;
	readonly maxDirectoryEntries: number;
	readonly maxPathCharacters: number;
	readonly maxQueryMetadataBytes: number;
	readonly maxReadBytes: number;
	readonly onProgress?: () => void;
}

interface DirectoryScan {
	readonly entries: readonly string[];
	readonly scannedEntries: number;
}

const OPERATIONS = new Set([
	'READ_FILE',
	'FILE_EXISTS',
	'DIRECTORY_EXISTS',
	'GET_DIRECTORIES',
	'READ_DIRECTORY',
	'REALPATH',
	'CURRENT_DIRECTORY',
	'USE_CASE_SENSITIVE_FILE_NAMES'
]);
const ORIGINS = new Set<SourceOrigin>([
	'AUTHORED',
	'TEST',
	'VERIFICATION',
	'SCRIPT',
	'GENERATOR',
	'GENERATED',
	'GENERATED_DECLARATION',
	'WORKSPACE_BUILD_DECLARATION',
	'VIRTUAL',
	'EXTERNAL_DECLARATION',
	'TOOLCHAIN_LIBRARY',
	'CONFIGURATION',
	'UNKNOWN'
]);
const SHA256 = /^[a-f0-9]{64}$/u;
const MAX_QUERY_CHARACTERS = 1_000_000;
const DEFAULT_READ_LIMITS: CompilerInputReadLimits = {
	allowPresentRead: true,
	clock: Date.now,
	deadlineMs: Number.MAX_SAFE_INTEGER,
	maxDirectoryEntries: 100_000,
	maxPathCharacters: MAX_QUERY_CHARACTERS,
	maxQueryMetadataBytes: Number.MAX_SAFE_INTEGER,
	maxReadBytes: 128 * 1024 * 1024
};

function svelteTransformLimits(maxPathCharacters: number): SvelteVirtualSourceLimits {
	return Object.freeze({
		...SVELTE_VIRTUAL_SOURCE_IMPLEMENTATION_LIMITS,
		maxPathCharacters: Math.min(
			maxPathCharacters,
			SVELTE_VIRTUAL_SOURCE_IMPLEMENTATION_LIMITS.maxPathCharacters
		)
	});
}

function transformFrozenSvelte(
	authoredBytes: Uint8Array,
	authoredLogicalPath: string,
	maxPathCharacters: number
): { readonly bytes: Uint8Array; readonly evidence: SemanticSourceTransformationRecord } {
	try {
		const transformed = transformSvelteVirtualSource({
			authoredBytes,
			authoredLogicalPath,
			limits: svelteTransformLimits(maxPathCharacters)
		});
		return {
			bytes: new TextEncoder().encode(transformed.virtualSourceText),
			evidence: transformed.evidence
		};
	} catch (error) {
		if (error instanceof SvelteVirtualSourceError && error.code === 'BUDGET_EXCEEDED')
			fail('BUDGET_EXCEEDED', `Svelte virtual-source transformation exceeded its bound: ${authoredLogicalPath}.`);
		fail(
			'CONTEXT_UNAVAILABLE',
			`Frozen Svelte source could not be transformed by the pinned virtual-source adapter: ${authoredLogicalPath}.`
		);
	}
}

function fail(code: CompilerInputCaptureError['code'], message: string): never {
	throw new CompilerInputCaptureError(code, message);
}

class CompilerInputProgressError extends Error {
	constructor(readonly original: unknown) {
		super('Compiler input resource progress callback failed.');
		this.name = 'CompilerInputProgressError';
	}
}

function guardedProgress(onProgress: (() => void) | undefined): () => void {
	return () => {
		try {
			onProgress?.();
		} catch (error) {
			throw new CompilerInputProgressError(error);
		}
	};
}

function inertRecord(
	value: unknown,
	field: string,
	errorCode: CompilerInputCaptureError['code'],
	onProgress?: () => void,
	maxKeys = Number.MAX_SAFE_INTEGER
): Readonly<Record<string, unknown>> {
	try {
		onProgress?.();
		if (value === null || typeof value !== 'object' || isProxy(value) || Array.isArray(value))
			fail(errorCode, `${field} must be an inert wire object.`);
		const prototype = Object.getPrototypeOf(value);
		if (prototype !== Object.prototype && prototype !== null)
			fail(errorCode, `${field} must be an inert wire object.`);
		const keys = Reflect.ownKeys(value);
		if (keys.length > maxKeys) fail(errorCode, `${field} has unknown or missing fields.`);
		const result = Object.create(null) as Record<string, unknown>;
		for (const key of keys) {
			onProgress?.();
			if (typeof key !== 'string') fail(errorCode, `${field} must not contain symbol properties.`);
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
				fail(errorCode, `${field}.${key} must be an enumerable data property.`);
			result[key] = descriptor.value;
		}
		return Object.freeze(result);
	} catch (error) {
		if (error instanceof CompilerInputCaptureError || error instanceof CompilerInputProgressError)
			throw error;
		fail(errorCode, `${field} could not be inspected as inert wire data.`);
	}
}

function exactKeys(
	record: Readonly<Record<string, unknown>>,
	field: string,
	expected: readonly string[],
	errorCode: CompilerInputCaptureError['code'],
	onProgress?: () => void
): void {
	const actual = Object.keys(record).sort(compareText);
	const sortedExpected = [...expected].sort(compareText);
	if (actual.length !== sortedExpected.length)
		fail(errorCode, `${field} has unknown or missing fields.`);
	for (let index = 0; index < actual.length; index += 1) {
		onProgress?.();
		if (actual[index] !== sortedExpected[index])
			fail(errorCode, `${field} has unknown or missing fields.`);
	}
}

function inertDenseArray(
	value: unknown,
	field: string,
	maxLength: number,
	errorCode: CompilerInputCaptureError['code'],
	deadlineMs = Number.MAX_SAFE_INTEGER,
	clock: SemanticOperationClock = Date.now
): readonly unknown[] {
	try {
		if (value === null || typeof value !== 'object' || isProxy(value) || !Array.isArray(value))
			fail(errorCode, `${field} must be a dense inert array.`);
		if (Object.getPrototypeOf(value) !== Array.prototype)
			fail(errorCode, `${field} must use the intrinsic Array prototype.`);
		const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
		if (
			lengthDescriptor === undefined ||
			!('value' in lengthDescriptor) ||
			typeof lengthDescriptor.value !== 'number' ||
			!Number.isSafeInteger(lengthDescriptor.value) ||
			lengthDescriptor.value < 0 ||
			lengthDescriptor.value > maxLength
		)
			fail('BUDGET_EXCEEDED', `${field} exceeds its array bound.`);
		const length = lengthDescriptor.value;
		const keys = Reflect.ownKeys(value);
		const indexKeys = keys.filter(
			(key): key is string => typeof key === 'string' && key !== 'length'
		);
		if (
			keys.some(
				(key) => typeof key !== 'string' || (key !== 'length' && !/^(?:0|[1-9]\d*)$/u.test(key))
			) ||
			indexKeys.length !== length ||
			indexKeys.some((key) => Number(key) >= length)
		)
			fail(errorCode, `${field} must not contain holes, symbols, or expando properties.`);
		const result: unknown[] = [];
		for (let index = 0; index < length; index += 1) {
			checkDeadline({ clock, deadlineMs });
			const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
			if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
				fail(errorCode, `${field}[${index}] must be an enumerable data property.`);
			result.push(descriptor.value);
		}
		return Object.freeze(result);
	} catch (error) {
		if (error instanceof CompilerInputCaptureError) throw error;
		fail(errorCode, `${field} could not be inspected as a dense inert array.`);
	}
}

interface QueryParameterWork {
	entries: number;
	metadataBytes: number;
	readonly maxEntries: number;
	readonly maxMetadataBytes: number;
}

function compareUtf16Strings(left: string, right: string, onProgress?: () => void): number {
	const commonLength = Math.min(left.length, right.length);
	for (let index = 0; index < commonLength; index += 1) {
		onProgress?.();
		const leftUnit = left.charCodeAt(index);
		const rightUnit = right.charCodeAt(index);
		if (leftUnit !== rightUnit) return leftUnit < rightUnit ? -1 : 1;
	}
	onProgress?.();
	if (left.length === right.length) return 0;
	return left.length < right.length ? -1 : 1;
}

function visitUtf16String(value: string, onProgress: () => void): void {
	for (let index = 0; index < value.length; index += 1) onProgress();
}

interface StringArrayLimits {
	readonly clock?: SemanticOperationClock;
	readonly deadlineMs?: number;
	readonly maxCharacters?: number;
	readonly maxLength?: number;
	readonly onProgress?: () => void;
	readonly work?: QueryParameterWork;
}

function inertStringArrayLength(
	value: unknown,
	field: string,
	errorCode: CompilerInputCaptureError['code'],
	maxLength: number,
	work: QueryParameterWork | undefined
): number {
	if (value === null || typeof value !== 'object' || isProxy(value) || !Array.isArray(value))
		fail(errorCode, `${field} must be a dense inert string array.`);
	if (Object.getPrototypeOf(value) !== Array.prototype)
		fail(errorCode, `${field} must use the intrinsic Array prototype.`);
	const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
	if (
		lengthDescriptor === undefined ||
		!('value' in lengthDescriptor) ||
		typeof lengthDescriptor.value !== 'number' ||
		!Number.isSafeInteger(lengthDescriptor.value) ||
		lengthDescriptor.value < 0 ||
		lengthDescriptor.value > maxLength ||
		(work !== undefined && work.entries + lengthDescriptor.value > work.maxEntries)
	)
		fail('BUDGET_EXCEEDED', `${field} exceeds its cumulative array bound.`);
	return lengthDescriptor.value;
}

function assertDenseStringIndexKeys(
	keys: readonly (string | symbol)[],
	field: string,
	errorCode: CompilerInputCaptureError['code'],
	length: number,
	onProgress?: () => void
): void {
	let indexKeyCount = 0;
	let invalidKey = false;
	for (const key of keys) {
		onProgress?.();
		if (typeof key !== 'string') {
			invalidKey = true;
			continue;
		}
		if (key === 'length') continue;
		indexKeyCount += 1;
		if (!/^(?:0|[1-9]\d*)$/u.test(key) || Number(key) >= length) invalidKey = true;
	}
	if (invalidKey || indexKeyCount !== length)
		fail(errorCode, `${field} must not contain holes, symbols, or expando properties.`);
}

function chargeQueryParameterWork(
	work: QueryParameterWork,
	entryValue: string,
	index: number,
	onProgress?: () => void
): void {
	const addition =
		canonicalSemanticJsonWitnessWithProgress(entryValue, onProgress).bytes + (index === 0 ? 0 : 1);
	if (
		!Number.isSafeInteger(work.metadataBytes + addition) ||
		work.metadataBytes + addition > work.maxMetadataBytes
	)
		fail('BUDGET_EXCEEDED', 'Compiler input query exceeds its cumulative metadata-byte budget.');
	work.metadataBytes += addition;
	work.entries += 1;
}

function inertStringArray(
	value: unknown,
	field: string,
	errorCode: CompilerInputCaptureError['code'],
	limits: StringArrayLimits = {}
): readonly string[] {
	const {
		clock = Date.now,
		deadlineMs = Number.MAX_SAFE_INTEGER,
		maxCharacters = MAX_QUERY_CHARACTERS,
		maxLength = Number.MAX_SAFE_INTEGER,
		onProgress,
		work
	} = limits;
	try {
		onProgress?.();
		const length = inertStringArrayLength(value, field, errorCode, maxLength, work);
		const container = value as object;
		assertDenseStringIndexKeys(Reflect.ownKeys(container), field, errorCode, length, onProgress);
		const result: string[] = [];
		for (let index = 0; index < length; index += 1) {
			onProgress?.();
			checkDeadline({ clock, deadlineMs });
			const descriptor = Object.getOwnPropertyDescriptor(container, String(index));
			if (
				descriptor === undefined ||
				!descriptor.enumerable ||
				!('value' in descriptor) ||
				typeof descriptor.value !== 'string'
			)
				fail(errorCode, `${field}[${index}] must be an enumerable string data property.`);
			if (descriptor.value.length > maxCharacters)
				fail('BUDGET_EXCEEDED', `${field}[${index}] exceeds the string bound.`);
			if (work !== undefined) chargeQueryParameterWork(work, descriptor.value, index, onProgress);
			result.push(descriptor.value);
		}
		return result;
	} catch (error) {
		if (error instanceof CompilerInputCaptureError || error instanceof CompilerInputProgressError)
			throw error;
		fail(errorCode, `${field} could not be inspected as an inert string array.`);
	}
}

function canonicalStringSet(
	value: unknown,
	field: string,
	errorCode: CompilerInputCaptureError['code'],
	limits: StringArrayLimits = {}
): readonly string[] {
	const { clock = Date.now, deadlineMs = Number.MAX_SAFE_INTEGER, onProgress } = limits;
	const result = inertStringArray(value, field, errorCode, limits);
	for (let index = 1; index < result.length; index += 1) {
		onProgress?.();
		checkDeadline({ clock, deadlineMs });
		if (compareUtf16Strings(result[index - 1]!, result[index]!, onProgress) >= 0)
			fail(errorCode, `${field} must be sorted and duplicate-free.`);
	}
	return Object.freeze(result);
}

export function normalizeSemanticBudgets(value: unknown): SemanticBudgets {
	const record = inertRecord(value, 'SemanticBudgets', 'BUDGET_EXCEEDED');
	exactKeys(record, 'SemanticBudgets', SEMANTIC_BUDGET_KEYS, 'BUDGET_EXCEEDED');
	const normalized = Object.create(null) as Record<string, number>;
	for (const key of SEMANTIC_BUDGET_KEYS) {
		const budget = record[key];
		if (typeof budget !== 'number' || !Number.isSafeInteger(budget) || budget <= 0)
			fail('BUDGET_EXCEEDED', `Semantic budget ${key} must be a positive safe integer.`);
		normalized[key] = budget;
	}
	return Object.freeze(normalized) as SemanticBudgets;
}

function compilerProjectIdentity(
	recipeValue: ProgramRecipe,
	materializedValue: MaterializedProgramRecipe,
	maxPathCharacters: number,
	repositoryRoot?: string
): {
	readonly materializedRecipeDigest: string;
	readonly projectKey: string;
	readonly projectResolutionDigest: string;
} {
	try {
		const recipe = validateProgramRecipePolicy(recipeValue, maxPathCharacters);
		const materializedJson = canonicalSemanticJson(materializedValue);
		if (
			repositoryRoot !== undefined &&
			canonicalSemanticJson(materializeProgramRecipe(recipeValue, repositoryRoot)) !==
				materializedJson
		)
			fail(
				'INVALID_QUERY',
				'Materialized compiler inputs do not reproduce the authoritative ProgramRecipe projection.'
			);
		return Object.freeze({
			materializedRecipeDigest: sha256(materializedJson),
			projectKey: recipe.configPath,
			projectResolutionDigest: recipe.projectResolutionDigest
		});
	} catch (error) {
		if (error instanceof CompilerInputCaptureError) throw error;
		fail('INVALID_QUERY', 'Compiler project recipe binding is not inert, valid, and exact.');
	}
}

function attributionBindsRecipeIdentity(
	expected: CompilerProjectAttribution,
	identity: {
		readonly materializedRecipeDigest: string;
		readonly projectResolutionDigest: string;
	}
): boolean {
	return (
		expected.projectResolutionDigest === identity.projectResolutionDigest &&
		expected.materializedRecipeDigest === identity.materializedRecipeDigest
	);
}

type NormalizeQueryLimits = Pick<
	CompilerInputReadLimits,
	| 'clock'
	| 'deadlineMs'
	| 'maxDirectoryEntries'
	| 'maxPathCharacters'
	| 'maxQueryMetadataBytes'
	| 'onProgress'
>;

function normalizedQueryLogicalPath(
	record: Readonly<Record<string, unknown>>,
	maxPathCharacters: number,
	errorCode: CompilerInputCaptureError['code']
): string {
	if (typeof record.logicalPath !== 'string')
		fail(errorCode, 'CompilerInputQuery.logicalPath must be a string.');
	if (record.logicalPath.length > maxPathCharacters)
		fail('BUDGET_EXCEEDED', 'CompilerInputQuery.logicalPath exceeds its path-character budget.');
	return record.logicalPath;
}

function rootCompilerInputQuery(
	operation: 'CURRENT_DIRECTORY' | 'USE_CASE_SENSITIVE_FILE_NAMES',
	recordedLogicalPath: string,
	logicalPath: string,
	maxQueryMetadataBytes: number,
	errorCode: CompilerInputCaptureError['code'],
	checkpoint: () => void
): CompilerInputQuery {
	if (recordedLogicalPath !== '.' || logicalPath !== '.')
		fail(errorCode, `${operation} is fixed to the logical repository root.`);
	const query = Object.freeze({ logicalPath: '.' as const, operation });
	if (canonicalSemanticJsonWitnessWithProgress(query, checkpoint).bytes > maxQueryMetadataBytes)
		fail('BUDGET_EXCEEDED', 'Compiler input query exceeds its metadata-byte budget.');
	return query;
}

function readDirectoryCompilerInputQuery(
	record: Readonly<Record<string, unknown>>,
	logicalPath: string,
	limits: NormalizeQueryLimits,
	errorCode: CompilerInputCaptureError['code'],
	checkpoint: () => void
): CompilerInputQuery {
	if (
		record.depth !== null &&
		(typeof record.depth !== 'number' || !Number.isSafeInteger(record.depth) || record.depth < 0)
	)
		fail(errorCode, 'READ_DIRECTORY.depth must be null or a non-negative safe integer.');
	const emptyQuery = {
		depth: record.depth as number | null,
		excludes: Object.freeze([]),
		extensions: Object.freeze([]),
		includes: Object.freeze([]),
		logicalPath,
		operation: 'READ_DIRECTORY' as const
	};
	const work: QueryParameterWork = {
		entries: 0,
		maxEntries: limits.maxDirectoryEntries,
		maxMetadataBytes: limits.maxQueryMetadataBytes,
		metadataBytes: canonicalSemanticJsonWitnessWithProgress(emptyQuery, checkpoint).bytes
	};
	if (work.metadataBytes > work.maxMetadataBytes)
		fail('BUDGET_EXCEEDED', 'Compiler input query exceeds its metadata-byte budget.');
	const setLimits: StringArrayLimits = {
		clock: limits.clock,
		deadlineMs: limits.deadlineMs,
		maxCharacters: limits.maxPathCharacters,
		maxLength: limits.maxDirectoryEntries,
		onProgress: checkpoint,
		work
	};
	const excludes = canonicalStringSet(
		record.excludes,
		'CompilerInputQuery.excludes',
		errorCode,
		setLimits
	);
	const extensions = canonicalStringSet(
		record.extensions,
		'CompilerInputQuery.extensions',
		errorCode,
		setLimits
	);
	const includes = canonicalStringSet(
		record.includes,
		'CompilerInputQuery.includes',
		errorCode,
		setLimits
	);
	const query = Object.freeze({
		depth: record.depth as number | null,
		excludes,
		extensions,
		includes,
		logicalPath,
		operation: 'READ_DIRECTORY' as const
	});
	checkpoint();
	if (canonicalSemanticJsonWitnessWithProgress(query, checkpoint).bytes !== work.metadataBytes)
		fail('INVALID_QUERY', 'Compiler input query metadata accounting failed to reconcile.');
	return query;
}

function normalizeCompilerInputQuery(
	value: unknown,
	paths: FrozenCompilerPathResolver,
	limits: NormalizeQueryLimits = DEFAULT_READ_LIMITS,
	errorCode: CompilerInputCaptureError['code'] = 'INVALID_QUERY'
): CompilerInputQuery {
	const resourceProgress = guardedProgress(limits.onProgress);
	const checkpoint = (): void => {
		resourceProgress();
		checkDeadline(limits);
	};
	try {
		checkpoint();
		const record = inertRecord(value, 'CompilerInputQuery', errorCode, checkpoint, 6);
		const operation = record.operation;
		if (typeof operation !== 'string' || !OPERATIONS.has(operation))
			fail(errorCode, 'CompilerInputQuery.operation is not registered.');
		const expected =
			operation === 'READ_DIRECTORY'
				? ['depth', 'excludes', 'extensions', 'includes', 'logicalPath', 'operation']
				: ['logicalPath', 'operation'];
		exactKeys(record, 'CompilerInputQuery', expected, errorCode, checkpoint);
		const recordedLogicalPath = normalizedQueryLogicalPath(
			record,
			limits.maxPathCharacters,
			errorCode
		);
		visitUtf16String(recordedLogicalPath, checkpoint);
		checkpoint();
		const logicalPath = paths.canonicalRecordedLogical(recordedLogicalPath);
		checkpoint();
		if (operation === 'CURRENT_DIRECTORY' || operation === 'USE_CASE_SENSITIVE_FILE_NAMES')
			return rootCompilerInputQuery(
				operation,
				recordedLogicalPath,
				logicalPath,
				limits.maxQueryMetadataBytes,
				errorCode,
				checkpoint
			);
		if (operation === 'READ_DIRECTORY')
			return readDirectoryCompilerInputQuery(record, logicalPath, limits, errorCode, checkpoint);
		const query = Object.freeze({ logicalPath, operation }) as CompilerInputQuery;
		if (
			canonicalSemanticJsonWitnessWithProgress(query, checkpoint).bytes >
			limits.maxQueryMetadataBytes
		)
			fail('BUDGET_EXCEEDED', 'Compiler input query exceeds its metadata-byte budget.');
		return query;
	} catch (error) {
		if (error instanceof CompilerInputProgressError) throw error.original;
		if (error instanceof CompilerInputCaptureError || error instanceof CompilerPathError)
			throw error;
		fail(errorCode, 'CompilerInputQuery could not be read as inert wire data.');
	}
}

function compilerInputQueryKey(query: CompilerInputQuery): string {
	return canonicalSemanticJson(query);
}

function verifiedCompilerInputQueryBucketKey(
	query: CompilerInputQuery,
	onProgress?: () => void
): string {
	return canonicalSemanticJsonWitnessWithProgress(query, onProgress).sha256;
}

function sameStringArray(
	left: readonly string[],
	right: readonly string[],
	onProgress?: () => void
): boolean {
	onProgress?.();
	if (left.length !== right.length) return false;
	for (let index = 0; index < left.length; index += 1) {
		onProgress?.();
		if (compareUtf16Strings(left[index]!, right[index]!, onProgress) !== 0) return false;
	}
	return true;
}

function sameCompilerInputQuery(
	left: CompilerInputQuery,
	right: CompilerInputQuery,
	onProgress?: () => void
): boolean {
	onProgress?.();
	if (
		left.operation !== right.operation ||
		compareUtf16Strings(left.logicalPath, right.logicalPath, onProgress) !== 0
	)
		return false;
	if (left.operation !== 'READ_DIRECTORY' || right.operation !== 'READ_DIRECTORY') return true;
	return (
		left.depth === right.depth &&
		sameStringArray(left.excludes, right.excludes, onProgress) &&
		sameStringArray(left.extensions, right.extensions, onProgress) &&
		sameStringArray(left.includes, right.includes, onProgress)
	);
}

/** @internal Collision-safe exact discriminator for one fixed-size verified-query digest bucket. */
export function exactVerifiedCompilerInputQueryBucketEntry<
	T extends { readonly query: CompilerInputQuery }
>(
	bucket: readonly T[] | undefined,
	query: CompilerInputQuery,
	onProgress?: () => void
): T | undefined {
	let matched: T | undefined;
	for (const candidate of bucket ?? []) {
		onProgress?.();
		if (!sameCompilerInputQuery(candidate.query, query, onProgress)) continue;
		if (matched !== undefined)
			fail(
				'INVALID_CAPTURE',
				'Verified compiler input query bucket contains duplicate exact queries.'
			);
		matched = candidate;
	}
	onProgress?.();
	return matched;
}

function finalizeObservation(
	subjectId: string,
	payload: CompilerObservationPayload
): CompilerInputObservation {
	const resultDigest = compilerInputResultDigest(payload);
	return Object.freeze({
		...payload,
		id: semanticContextInputId({ ...payload, resultDigest, subjectId }),
		resultDigest
	}) as CompilerInputObservation;
}

function boundedObservation(
	subjectId: string,
	payload: CompilerObservationPayload,
	maxMetadataBytes: number
): CompilerInputObservation {
	const observation = finalizeObservation(subjectId, payload);
	if (observationBytes(observation) > maxMetadataBytes)
		fail(
			'BUDGET_EXCEEDED',
			'Compiler input observation exceeds its remaining exact metadata-byte budget.'
		);
	return observation;
}

function assertMinimumObservationBudget(
	subjectId: string,
	query: CompilerInputQuery,
	base: {
		readonly invocationCount: 1;
		readonly logicalPath: string;
		readonly origin: SourceOrigin;
	},
	caseSensitive: boolean,
	maxMetadataBytes: number
): void {
	let payload: CompilerObservationPayload;
	switch (query.operation) {
		case 'READ_FILE':
		case 'FILE_EXISTS':
		case 'REALPATH':
			payload = { ...base, operation: query.operation, result: 'ABSENT' } as CompilerObservationPayload;
			break;
		case 'DIRECTORY_EXISTS':
			payload = { ...base, operation: query.operation, result: 'DIRECTORY' };
			break;
		case 'GET_DIRECTORIES':
			payload = {
				...base,
				operation: query.operation,
				result: 'DIRECTORY',
				resultEntries: Object.freeze([]),
				scannedEntries: 0
			};
			break;
		case 'READ_DIRECTORY':
			payload = {
				...base,
				...query,
				result: 'DIRECTORY',
				resultEntries: Object.freeze([]),
				scannedEntries: 0
			};
			break;
		case 'CURRENT_DIRECTORY':
			payload = {
				...base,
				logicalPath: '.',
				operation: query.operation,
				resolvedLogicalPath: '.',
				result: 'RESOLVED'
			};
			break;
		case 'USE_CASE_SENSITIVE_FILE_NAMES':
			payload = {
				...base,
				logicalPath: '.',
				operation: query.operation,
				result: caseSensitive ? 'CASE_SENSITIVE' : 'CASE_INSENSITIVE'
			};
			break;
	}
	boundedObservation(subjectId, payload, maxMetadataBytes);
}

function withInvocationCount(
	subjectId: string,
	entry: CapturedCompilerInput,
	invocationCount: number
): CapturedCompilerInput {
	const { id: _id, resultDigest: _resultDigest, ...payload } = entry.observation;
	return cloneCaptured({
		...entry,
		observation: finalizeObservation(subjectId, {
			...payload,
			invocationCount
		} as CompilerObservationPayload)
	});
}

function absent(error: unknown): boolean {
	return (
		error !== null &&
		typeof error === 'object' &&
		'code' in error &&
		['ENOENT', 'ENOTDIR'].includes(String((error as { code: unknown }).code))
	);
}

function deadlineNow(clock: SemanticOperationClock): number {
	let now: unknown;
	try {
		now = clock();
	} catch {
		return fail('BUDGET_EXCEEDED', 'Semantic extraction duration clock failed closed.');
	}
	if (!Number.isSafeInteger(now) || (now as number) < 0)
		return fail('BUDGET_EXCEEDED', 'Semantic extraction duration clock is invalid.');
	return now as number;
}

function checkDeadline(limits: Pick<CompilerInputReadLimits, 'clock' | 'deadlineMs'>): void {
	if (deadlineNow(limits.clock ?? Date.now) > limits.deadlineMs)
		fail('BUDGET_EXCEEDED', 'Semantic extraction duration exceeded its producing budget.');
}

/** What a path resolves to on disk. Aliased because three sites return it. */
type StatKind = 'ABSENT' | 'DIRECTORY' | 'FILE';

function statKind(absolutePath: string): StatKind {
	try {
		const stat = statSync(absolutePath);
		if (stat.isDirectory()) return 'DIRECTORY';
		if (stat.isFile()) return 'FILE';
		return 'ABSENT';
	} catch (error) {
		if (absent(error)) return 'ABSENT';
		fail('CONTEXT_UNAVAILABLE', 'Compiler context metadata could not be read.');
	}
}

type StableFileStat = ReturnType<typeof statSync> & {
	readonly birthtimeNs: bigint;
	readonly ctimeNs: bigint;
	readonly dev: bigint;
	readonly ino: bigint;
	readonly mtimeNs: bigint;
	readonly size: bigint;
};

function stableStat(pathOrDescriptor: string | number): StableFileStat {
	return (
		typeof pathOrDescriptor === 'number'
			? fstatSync(pathOrDescriptor, { bigint: true })
			: statSync(pathOrDescriptor, { bigint: true })
	) as StableFileStat;
}

function sameStableFile(left: StableFileStat, right: StableFileStat): boolean {
	return (
		left.isFile() &&
		right.isFile() &&
		left.dev === right.dev &&
		left.ino === right.ino &&
		left.size === right.size &&
		left.mtimeNs === right.mtimeNs &&
		left.ctimeNs === right.ctimeNs &&
		left.birthtimeNs === right.birthtimeNs
	);
}

function readStableAuthorizedFile(
	absolutePath: string,
	logicalPath: string,
	paths: FrozenCompilerPathResolver,
	limits: CompilerInputReadLimits
): Uint8Array {
	let descriptor: number | undefined;
	try {
		const beforePath = stableStat(absolutePath);
		if (!beforePath.isFile())
			fail('CONTEXT_CHANGED', `Compiler context ceased to be a regular file: ${logicalPath}.`);
		if (beforePath.size > BigInt(limits.maxReadBytes))
			fail(
				'BUDGET_EXCEEDED',
				`Compiler context file exceeds the remaining byte budget: ${logicalPath}.`
			);
		descriptor = openSync(absolutePath, 'r');
		const beforeHandle = stableStat(descriptor);
		if (!sameStableFile(beforePath, beforeHandle))
			fail('CONTEXT_CHANGED', `Compiler context changed while it was opened: ${logicalPath}.`);
		const openedRealPath = realpathSync.native(absolutePath);
		const openedLogicalPath = paths.toLogical(openedRealPath);
		paths.assertLiveFilePermitted(openedLogicalPath);
		checkDeadline(limits);
		const bytes = new Uint8Array(readFileSync(descriptor));
		if (bytes.byteLength > limits.maxReadBytes)
			fail(
				'BUDGET_EXCEEDED',
				`Compiler context file exceeds the remaining byte budget: ${logicalPath}.`
			);
		const afterHandle = stableStat(descriptor);
		const afterPath = stableStat(absolutePath);
		if (
			!sameStableFile(beforeHandle, afterHandle) ||
			!sameStableFile(afterHandle, afterPath) ||
			realpathSync.native(absolutePath) !== openedRealPath
		)
			fail(
				'CONTEXT_CHANGED',
				`Compiler context changed during its stable-handle read: ${logicalPath}.`
			);
		return bytes;
	} catch (error) {
		if (error instanceof CompilerInputCaptureError || error instanceof CompilerPathError)
			throw error;
		if (absent(error))
			fail(
				'CONTEXT_CHANGED',
				`Compiler context disappeared during its stable-handle read: ${logicalPath}.`
			);
		return fail(
			'CONTEXT_UNAVAILABLE',
			`Compiler context could not be read through a stable handle: ${logicalPath}.`
		);
	} finally {
		if (descriptor !== undefined) {
			try {
				closeSync(descriptor);
			} catch {
				/* the primary read result governs */
			}
		}
	}
}

function uniqueSorted(values: readonly string[]): string[] {
	return [...new Set(values)].sort(compareText);
}

const RESERVED_CHARACTER_PATTERN = /[^\w\s/]/gu;
const REGEXP_SYNTAX_CHARACTERS = new Set([
	'\\',
	'^',
	'$',
	'.',
	'*',
	'+',
	'?',
	'(',
	')',
	'[',
	']',
	'{',
	'}',
	'|'
]);
const IMPLICIT_EXCLUDE = '(?!(?:node_modules|bower_components|jspm_packages)(?:/|$))';
const MATCH_ROOT = '/__csaa_match_root__';

type WildcardUsage = 'directories' | 'exclude' | 'files';

function wildcardFragments(usage: WildcardUsage): {
	readonly double: string;
	readonly single: string;
} {
	if (usage === 'files')
		return {
			double: `(?:/${IMPLICIT_EXCLUDE}[^/.][^/]*)*?`,
			single: String.raw`(?:[^./]|(?:\.(?!min\.js$))?)*`
		};
	if (usage === 'directories')
		return { double: `(?:/${IMPLICIT_EXCLUDE}[^/.][^/]*)*?`, single: '[^/]*' };
	return { double: '(?:/.+?)?', single: '[^/]*' };
}

function wildcardReplacement(match: string, single: string): string {
	if (match === '*') return single;
	if (match === '?') return '[^/]';
	if (REGEXP_SYNTAX_CHARACTERS.has(match)) return `\\${match}`;
	return match;
}

interface WildcardFragments {
	readonly double: string;
	readonly single: string;
}

function wildcardComponentPattern(
	component: string,
	usage: WildcardUsage,
	fragments: WildcardFragments
): string {
	if (usage === 'exclude')
		return component.replace(RESERVED_CHARACTER_PATTERN, (match) =>
			wildcardReplacement(match, fragments.single)
		);
	let remainder = component;
	let componentPattern = '';
	if (remainder.startsWith('*')) {
		componentPattern += `(?:[^./]${fragments.single})?`;
		remainder = remainder.slice(1);
	} else if (remainder.startsWith('?')) {
		componentPattern += '[^./]';
		remainder = remainder.slice(1);
	}
	componentPattern += remainder.replace(RESERVED_CHARACTER_PATTERN, (match) =>
		wildcardReplacement(match, fragments.single)
	);
	if (componentPattern === remainder) return componentPattern;
	return IMPLICIT_EXCLUDE + componentPattern;
}

function wildcardComponentsPattern(
	components: readonly string[],
	usage: WildcardUsage,
	fragments: WildcardFragments
): string {
	let subpattern = '';
	let written = false;
	let optional = 0;
	for (const component of components) {
		if (component === '**') subpattern += fragments.double;
		else {
			if (usage === 'directories') {
				subpattern += '(?:';
				optional += 1;
			}
			if (written) subpattern += '/';
			subpattern += wildcardComponentPattern(component, usage, fragments);
		}
		written = true;
	}
	while (optional > 0) {
		subpattern += ')?';
		optional -= 1;
	}
	return subpattern;
}

function wildcardSubpattern(
	spec: string,
	usage: WildcardUsage,
	appendImplicit = true
): string | undefined {
	if (spec.length === 0) return undefined;
	const normalized = posix.normalize(`${MATCH_ROOT}/${spec}`);
	const components = normalized.split('/');
	const last = components.at(-1)!;
	if (usage !== 'exclude' && last === '**') return undefined;
	if (appendImplicit && !/[.*?]/u.test(last)) components.push('**', '*');
	return wildcardComponentsPattern(components, usage, wildcardFragments(usage));
}

function stripTrailingSlashes(value: string): string {
	let end = value.length;
	while (end > 0 && value.charAt(end - 1) === '/') end -= 1;
	return value.slice(0, end);
}

function normalizeWildcardSpec(
	spec: string,
	queryRoot: string,
	paths: FrozenCompilerPathResolver
): string {
	if (isAbsolute(spec)) {
		const logical = paths.toRecordedLogical(spec);
		const relative = posix.relative(queryRoot === '.' ? '' : queryRoot, logical);
		if (relative === '..' || relative.startsWith('../'))
			fail('INVALID_QUERY', 'READ_DIRECTORY wildcard escaped its query root.');
		return relative === '' ? '.' : relative;
	}
	if (spec.length === 0) return '';
	const normalized = posix.normalize(spec.replaceAll('\\', '/').replace(/^\.\//u, ''));
	if (normalized === '..' || normalized.startsWith('../') || normalized.startsWith('/'))
		fail('INVALID_QUERY', 'READ_DIRECTORY wildcard escaped its query root.');
	return normalized === '.' ? '.' : stripTrailingSlashes(normalized);
}

function alternationGroup(patterns: readonly string[]): string {
	return patterns.map((pattern) => `(?:${pattern})`).join('|');
}

function includeDirectoryRegex(includeDirectories: readonly string[], flags: string): RegExp {
	if (includeDirectories.length === 0) return new RegExp('(?!)', flags);
	return new RegExp(`^(?:${alternationGroup(includeDirectories)})$`, flags);
}

class TypeScriptDirectoryMatcher {
	private readonly excludeDirectoryRootRegex: RegExp | undefined;
	private readonly excludeRegex: RegExp | undefined;
	private readonly includeDirectoryRegex: RegExp | undefined;
	private readonly includeFileRegexes: readonly RegExp[] | undefined;
	private readonly extensions: readonly string[];

	constructor(
		query: Extract<CompilerInputQuery, { operation: 'READ_DIRECTORY' }>,
		paths: FrozenCompilerPathResolver,
		limits: Pick<CompilerInputReadLimits, 'clock' | 'deadlineMs'>
	) {
		const flags = paths.caseSensitive ? '' : 'i';
		const build = (specs: readonly string[], usage: WildcardUsage): readonly string[] => {
			const patterns: string[] = [];
			for (const spec of specs) {
				checkDeadline(limits);
				const pattern = wildcardSubpattern(
					normalizeWildcardSpec(spec, query.logicalPath, paths),
					usage
				);
				if (pattern !== undefined) patterns.push(pattern);
			}
			return patterns;
		};
		const includes = build(query.includes, 'files');
		const includeDirectories = build(query.includes, 'directories');
		const excludes = build(query.excludes, 'exclude');
		const excludeDirectoryRoots = query.excludes
			.filter((spec) => /[\\/]$/u.test(spec))
			.map((spec) => {
				checkDeadline(limits);
				return wildcardSubpattern(
					normalizeWildcardSpec(spec, query.logicalPath, paths),
					'exclude',
					false
				);
			})
			.filter((pattern): pattern is string => pattern !== undefined);
		this.includeFileRegexes =
			query.includes.length === 0
				? undefined
				: includes.map((pattern) => {
						checkDeadline(limits);
						return new RegExp(`^${pattern}$`, flags);
					});
		this.includeDirectoryRegex =
			query.includes.length === 0 ? undefined : includeDirectoryRegex(includeDirectories, flags);
		this.excludeRegex =
			excludes.length === 0
				? undefined
				: new RegExp(`^(?:${alternationGroup(excludes)})(?:$|/)`, flags);
		this.excludeDirectoryRootRegex =
			excludeDirectoryRoots.length === 0
				? undefined
				: new RegExp(`^(?:${alternationGroup(excludeDirectoryRoots)})(?:$|/)`, flags);
		this.extensions = query.extensions;
		checkDeadline(limits);
	}

	file(relativePath: string): boolean {
		const candidate = `${MATCH_ROOT}/${relativePath}`;
		if (
			this.extensions.length === 0 ||
			!this.extensions.some(
				(extension) => candidate.length > extension.length && candidate.endsWith(extension)
			)
		)
			return false;
		if (this.excludeRegex?.test(candidate)) return false;
		return (
			this.includeFileRegexes === undefined ||
			this.includeFileRegexes.some((regex) => regex.test(candidate))
		);
	}

	directory(relativePath: string): boolean {
		const candidate = `${MATCH_ROOT}/${relativePath}`;
		return (
			(this.includeDirectoryRegex === undefined || this.includeDirectoryRegex.test(candidate)) &&
			!this.subtreeExcluded(relativePath)
		);
	}

	excluded(relativePath: string): boolean {
		return this.excludeRegex?.test(`${MATCH_ROOT}/${relativePath}`) ?? false;
	}

	subtreeExcluded(relativePath: string): boolean {
		const candidate = `${MATCH_ROOT}/${relativePath}`;
		return (
			(this.excludeRegex?.test(candidate) ?? false) ||
			(this.excludeDirectoryRootRegex?.test(candidate) ?? false)
		);
	}
}

class DirectoryResultBudget {
	private metadataBytes: number;
	private scannedEntries = 0;
	private readonly retained = new Set<string>();

	constructor(
		subjectId: string,
		emptyPayload: CompilerObservationPayload,
		private readonly limits: Pick<
			CompilerInputReadLimits,
			'maxDirectoryEntries' | 'maxPathCharacters' | 'maxQueryMetadataBytes'
		>
	) {
		this.metadataBytes = observationBytes(finalizeObservation(subjectId, emptyPayload));
		if (this.metadataBytes > limits.maxQueryMetadataBytes)
			fail(
				'BUDGET_EXCEEDED',
				'Compiler directory observation exceeds its remaining exact metadata-byte budget before traversal.'
			);
	}

	assertPath(logicalPath: string): void {
		if (logicalPath.length > this.limits.maxPathCharacters)
			fail(
				'BUDGET_EXCEEDED',
				'Compiler directory produced a path beyond its path-character budget.'
			);
	}

	noteScannedEntry(): void {
		this.assertCanScanEntry();
		const nextEntries = this.scannedEntries + 1;
		const digitBytes = String(nextEntries).length - String(this.scannedEntries).length;
		this.metadataBytes += digitBytes;
		this.scannedEntries = nextEntries;
	}

	assertCanScanEntry(): void {
		const nextEntries = this.scannedEntries + 1;
		if (!Number.isSafeInteger(nextEntries) || nextEntries > this.limits.maxDirectoryEntries)
			fail('BUDGET_EXCEEDED', 'Compiler directory query exceeded its scanned-entry budget.');
		const digitBytes = String(nextEntries).length - String(this.scannedEntries).length;
		if (this.metadataBytes + digitBytes > this.limits.maxQueryMetadataBytes)
			fail(
				'BUDGET_EXCEEDED',
				'Compiler directory observation exceeded its remaining exact metadata-byte budget while scanning.'
			);
	}

	retain(logicalPath: string): boolean {
		this.assertPath(logicalPath);
		if (this.retained.has(logicalPath)) return false;
		const addition =
			Buffer.byteLength(canonicalSemanticJson(logicalPath), 'utf8') +
			(this.retained.size === 0 ? 0 : 1);
		if (
			!Number.isSafeInteger(this.metadataBytes + addition) ||
			this.metadataBytes + addition > this.limits.maxQueryMetadataBytes
		)
			fail(
				'BUDGET_EXCEEDED',
				'Compiler directory observation exceeded its remaining exact metadata-byte budget while retaining results.'
			);
		this.metadataBytes += addition;
		this.retained.add(logicalPath);
		return true;
	}
}

function relativeFrom(root: string, candidate: string): string | undefined {
	if (root === '.') return candidate;
	const prefix = `${root}/`;
	return candidate.startsWith(prefix) ? candidate.slice(prefix.length) : undefined;
}

function scanVirtualDirectories(
	logicalPath: string,
	paths: FrozenCompilerPathResolver,
	limits: CompilerInputReadLimits,
	resultBudget: DirectoryResultBudget
): DirectoryScan {
	const children: string[] = [];
	let scannedEntries = 0;
	for (const child of paths.virtualChildren(logicalPath)) {
		checkDeadline(limits);
		resultBudget.assertPath(child.logicalPath);
		resultBudget.noteScannedEntry();
		scannedEntries += 1;
		if (scannedEntries > limits.maxDirectoryEntries)
			fail(
				'BUDGET_EXCEEDED',
				'Compiler virtual directory query exceeded its scanned-entry budget.'
			);
		if (child.kind === 'DIRECTORY' && resultBudget.retain(child.logicalPath))
			children.push(child.logicalPath);
	}
	return { entries: uniqueSorted(children), scannedEntries };
}

interface DirectoryFrame {
	readonly depth: number;
	readonly logicalPath: string;
}

interface VirtualScanContext {
	readonly limits: CompilerInputReadLimits;
	readonly matcher: TypeScriptDirectoryMatcher;
	readonly paths: FrozenCompilerPathResolver;
	readonly query: Extract<CompilerInputQuery, { operation: 'READ_DIRECTORY' }>;
	readonly resultBudget: DirectoryResultBudget;
	readonly results: string[];
}

function mayDescendIntoDirectory(
	query: Extract<CompilerInputQuery, { operation: 'READ_DIRECTORY' }>,
	currentDepth: number,
	matcher: TypeScriptDirectoryMatcher,
	relative: string
): boolean {
	return (
		(query.depth === null || query.depth === 0 || currentDepth + 1 < query.depth) &&
		matcher.directory(relative)
	);
}

function collectVirtualScanChildren(
	context: VirtualScanContext,
	current: DirectoryFrame,
	scannedEntries: number
): { readonly childDirectories: DirectoryFrame[]; readonly scannedEntries: number } {
	const { limits, matcher, query, resultBudget, results } = context;
	const childDirectories: DirectoryFrame[] = [];
	let scanned = scannedEntries;
	for (const child of context.paths.virtualChildren(current.logicalPath)) {
		checkDeadline(limits);
		resultBudget.assertPath(child.logicalPath);
		resultBudget.noteScannedEntry();
		scanned += 1;
		if (scanned > limits.maxDirectoryEntries)
			fail(
				'BUDGET_EXCEEDED',
				'Compiler virtual directory query exceeded its scanned-entry budget.'
			);
		const relative = relativeFrom(query.logicalPath, child.logicalPath);
		if (relative === undefined) continue;
		if (child.kind === 'DIRECTORY') {
			if (mayDescendIntoDirectory(query, current.depth, matcher, relative))
				childDirectories.push({ depth: current.depth + 1, logicalPath: child.logicalPath });
		} else if (matcher.file(relative) && resultBudget.retain(child.logicalPath))
			results.push(child.logicalPath);
	}
	return { childDirectories, scannedEntries: scanned };
}

function scanVirtualFiles(
	query: Extract<CompilerInputQuery, { operation: 'READ_DIRECTORY' }>,
	paths: FrozenCompilerPathResolver,
	limits: CompilerInputReadLimits,
	resultBudget: DirectoryResultBudget
): DirectoryScan {
	const matcher = new TypeScriptDirectoryMatcher(query, paths, limits);
	const results: string[] = [];
	const context: VirtualScanContext = { limits, matcher, paths, query, resultBudget, results };
	const stack: DirectoryFrame[] = [{ depth: 0, logicalPath: query.logicalPath }];
	let scannedEntries = 0;
	while (stack.length > 0) {
		checkDeadline(limits);
		const current = stack.pop()!;
		const collected = collectVirtualScanChildren(context, current, scannedEntries);
		scannedEntries = collected.scannedEntries;
		collected.childDirectories.reverse();
		for (const child of collected.childDirectories) stack.push(child);
	}
	return { entries: uniqueSorted(results), scannedEntries };
}

interface LiveDirectoryChild {
	readonly absolutePath: string;
	readonly kind: 'DIRECTORY' | 'FILE';
	readonly logicalPath: string;
	readonly observedLogicalPath: string;
}

function syntacticallyForbiddenFile(
	logicalPath: string,
	paths: FrozenCompilerPathResolver
): boolean {
	return posix.basename(logicalPath).includes('.') && !paths.isLiveFilePermitted(logicalPath);
}

interface DirectoryEntryKindProbe {
	isDirectory(): boolean;
	isFile(): boolean;
	isSymbolicLink(): boolean;
}

function openAuthorizedDirectory(
	absolutePath: string,
	logicalPath: string
): ReturnType<typeof opendirSync> {
	try {
		return opendirSync(absolutePath);
	} catch (error) {
		if (absent(error))
			fail(
				'CONTEXT_CHANGED',
				`Compiler directory disappeared during its bounded scan: ${logicalPath}.`
			);
		return fail(
			'CONTEXT_UNAVAILABLE',
			`Compiler directory could not be opened during its bounded scan: ${logicalPath}.`
		);
	}
}

function closeDirectoryQuietly(directory: ReturnType<typeof opendirSync>): void {
	try {
		directory.closeSync();
	} catch {
		/* the iterator can close itself */
	}
}

function excludedFileForPurpose(
	logicalPath: string,
	purpose: 'DIRECTORIES' | 'FILES',
	paths: FrozenCompilerPathResolver
): boolean {
	return purpose === 'DIRECTORIES' || !paths.isLiveFilePermitted(logicalPath);
}

function unusableDirectoryEntry(
	entry: DirectoryEntryKindProbe,
	logicalPath: string,
	purpose: 'DIRECTORIES' | 'FILES',
	paths: FrozenCompilerPathResolver
): boolean {
	if (entry.isFile() && excludedFileForPurpose(logicalPath, purpose, paths)) return true;
	if (entry.isSymbolicLink() && syntacticallyForbiddenFile(logicalPath, paths)) return true;
	return !entry.isDirectory() && !entry.isFile() && !entry.isSymbolicLink();
}

function enumeratedChildKind(entry: DirectoryEntryKindProbe, absolutePath: string): StatKind {
	if (entry.isDirectory()) return 'DIRECTORY';
	if (entry.isFile()) return 'FILE';
	return statKind(absolutePath);
}

function readAuthorizedChildren(
	logicalPath: string,
	paths: FrozenCompilerPathResolver,
	limits: CompilerInputReadLimits,
	purpose: 'DIRECTORIES' | 'FILES',
	resultBudget: DirectoryResultBudget,
	lexicallyExcluded: (
		identity: Readonly<Pick<LiveDirectoryChild, 'logicalPath' | 'observedLogicalPath'>>
	) => boolean = () => false
): { readonly children: readonly LiveDirectoryChild[]; readonly scannedEntries: number } {
	const absolutePath = paths.toAbsolute(logicalPath);
	const children: LiveDirectoryChild[] = [];
	let scannedEntries = 0;
	const directory = openAuthorizedDirectory(absolutePath, logicalPath);
	try {
		for (let entry = directory.readSync(); entry !== null; entry = directory.readSync()) {
			checkDeadline(limits);
			const identity = paths.enumeratedChildIdentity(logicalPath, entry.name);
			if (unusableDirectoryEntry(entry, identity.logicalPath, purpose, paths)) continue;
			resultBudget.assertPath(identity.logicalPath);
			if (scannedEntries >= limits.maxDirectoryEntries)
				fail('BUDGET_EXCEEDED', 'Compiler directory query exceeded its scanned-entry budget.');
			resultBudget.assertCanScanEntry();
			if (lexicallyExcluded(identity)) {
				resultBudget.noteScannedEntry();
				scannedEntries += 1;
				continue;
			}
			const authorized = paths.authorizeEnumeratedChild(logicalPath, entry.name);
			const kind = enumeratedChildKind(entry, authorized.absolutePath);
			if (kind === 'ABSENT')
				fail(
					'CONTEXT_CHANGED',
					`Compiler directory child disappeared during its bounded scan: ${identity.logicalPath}.`
				);
			if (kind === 'FILE' && excludedFileForPurpose(identity.logicalPath, purpose, paths)) continue;
			resultBudget.noteScannedEntry();
			scannedEntries += 1;
			if (scannedEntries > limits.maxDirectoryEntries)
				fail('BUDGET_EXCEEDED', 'Compiler directory query exceeded its scanned-entry budget.');
			children.push(Object.freeze({ ...authorized, kind }));
		}
	} finally {
		closeDirectoryQuietly(directory);
	}
	children.sort((left, right) => compareText(left.logicalPath, right.logicalPath));
	return { children, scannedEntries };
}

function scanLiveDirectories(
	logicalPath: string,
	paths: FrozenCompilerPathResolver,
	limits: CompilerInputReadLimits,
	resultBudget: DirectoryResultBudget
): DirectoryScan {
	const scanned = readAuthorizedChildren(logicalPath, paths, limits, 'DIRECTORIES', resultBudget);
	const results = scanned.children
		.filter((child) => child.kind === 'DIRECTORY' && resultBudget.retain(child.logicalPath))
		.map((child) => child.logicalPath);
	return { entries: uniqueSorted(results), scannedEntries: scanned.scannedEntries };
}

function resolvePhysicalDirectory(logicalPath: string, absolutePath: string): string {
	try {
		return realpathSync.native(absolutePath);
	} catch (error) {
		if (absent(error))
			fail(
				'CONTEXT_CHANGED',
				`Compiler directory disappeared during its bounded scan: ${logicalPath}.`
			);
		throw error;
	}
}

function collectLiveScanChildren(
	children: readonly LiveDirectoryChild[],
	query: Extract<CompilerInputQuery, { operation: 'READ_DIRECTORY' }>,
	current: DirectoryFrame,
	matcher: TypeScriptDirectoryMatcher,
	resultBudget: DirectoryResultBudget,
	results: string[]
): DirectoryFrame[] {
	const childDirectories: DirectoryFrame[] = [];
	for (const child of children) {
		const relative = relativeFrom(query.logicalPath, child.logicalPath);
		const observedRelative = relativeFrom(query.logicalPath, child.observedLogicalPath);
		if (relative === undefined || observedRelative === undefined) continue;
		if (child.kind === 'DIRECTORY') {
			if (mayDescendIntoDirectory(query, current.depth, matcher, observedRelative))
				childDirectories.push({ depth: current.depth + 1, logicalPath: child.logicalPath });
			continue;
		}
		if (!matcher.file(observedRelative)) continue;
		if (resultBudget.retain(child.logicalPath)) results.push(child.logicalPath);
	}
	return childDirectories;
}

function scanLiveFiles(
	query: Extract<CompilerInputQuery, { operation: 'READ_DIRECTORY' }>,
	paths: FrozenCompilerPathResolver,
	limits: CompilerInputReadLimits,
	resultBudget: DirectoryResultBudget
): DirectoryScan {
	const matcher = new TypeScriptDirectoryMatcher(query, paths, limits);
	const results: string[] = [];
	const stack: DirectoryFrame[] = [{ depth: 0, logicalPath: query.logicalPath }];
	const visited = new Set<string>();
	let scannedEntries = 0;
	while (stack.length > 0) {
		checkDeadline(limits);
		const current = stack.pop()!;
		const currentAbsolute = paths.toAbsolute(current.logicalPath);
		const physical = resolvePhysicalDirectory(current.logicalPath, currentAbsolute);
		if (visited.has(physical)) continue;
		visited.add(physical);
		const scanned = readAuthorizedChildren(
			current.logicalPath,
			paths,
			{ ...limits, maxDirectoryEntries: limits.maxDirectoryEntries - scannedEntries },
			'FILES',
			resultBudget,
			(identity) => {
				const relative = relativeFrom(query.logicalPath, identity.observedLogicalPath);
				return relative !== undefined && matcher.subtreeExcluded(relative);
			}
		);
		scannedEntries += scanned.scannedEntries;
		const childDirectories = collectLiveScanChildren(
			scanned.children,
			query,
			current,
			matcher,
			resultBudget,
			results
		);
		childDirectories.reverse();
		for (const child of childDirectories) stack.push(child);
	}
	return { entries: uniqueSorted(results), scannedEntries };
}

function mergeScans(scans: readonly DirectoryScan[]): DirectoryScan {
	return {
		entries: uniqueSorted(scans.flatMap((scan) => scan.entries)),
		scannedEntries: scans.reduce((total, scan) => total + scan.scannedEntries, 0)
	};
}

interface CompilerObservationBase {
	readonly invocationCount: 1;
	readonly logicalPath: string;
	readonly origin: SourceOrigin;
}

interface ObservationContext {
	readonly base: CompilerObservationBase;
	readonly emit: (payload: CompilerObservationPayload) => CompilerInputObservation;
	readonly limits: CompilerInputReadLimits;
	readonly liveRegion: boolean;
	readonly liveScanRegion: boolean;
	readonly subjectId: string;
	readonly virtualDirectory: boolean;
}

function boundaryObservation(
	query: CompilerInputQuery,
	base: CompilerObservationBase,
	emit: (payload: CompilerObservationPayload) => CompilerInputObservation
): CapturedCompilerInput {
	switch (query.operation) {
		case 'READ_FILE':
		case 'FILE_EXISTS':
		case 'REALPATH':
			return Object.freeze({
				observation: emit({
					...base,
					operation: query.operation,
					result: 'ABSENT'
				} as CompilerObservationPayload),
				query
			});
		case 'DIRECTORY_EXISTS':
			return Object.freeze({
				observation: emit({ ...base, operation: query.operation, result: 'NOT_DIRECTORY' }),
				query
			});
		case 'GET_DIRECTORIES':
			return Object.freeze({
				observation: emit({
					...base,
					operation: query.operation,
					result: 'NOT_DIRECTORY',
					resultEntries: Object.freeze([]),
					scannedEntries: 0
				}),
				query
			});
		case 'READ_DIRECTORY':
			return Object.freeze({
				observation: emit({
					...base,
					...query,
					result: 'NOT_DIRECTORY',
					resultEntries: Object.freeze([]),
					scannedEntries: 0
				}),
				query
			});
		case 'CURRENT_DIRECTORY':
		case 'USE_CASE_SENSITIVE_FILE_NAMES':
			return fail(
				'INVALID_QUERY',
				'Repository-root queries cannot use an outside-boundary identity.'
			);
	}
}

function remainingDirectoryEntries(
	limits: CompilerInputReadLimits,
	scans: readonly DirectoryScan[]
): CompilerInputReadLimits {
	return {
		...limits,
		maxDirectoryEntries:
			limits.maxDirectoryEntries - scans.reduce((total, scan) => total + scan.scannedEntries, 0)
	};
}

export class LiveCompilerInputReader {
	constructor(
		private readonly subject: FrozenSubject,
		readonly paths: FrozenCompilerPathResolver,
		private readonly caseSensitive: boolean
	) {}

	observe(
		queryValue: CompilerInputQuery,
		limits: CompilerInputReadLimits = DEFAULT_READ_LIMITS
	): CapturedCompilerInput {
		try {
			checkDeadline(limits);
			const query = normalizeCompilerInputQuery(queryValue, this.paths, limits);
			const origin =
				query.operation === 'CURRENT_DIRECTORY' ||
				query.operation === 'USE_CASE_SENSITIVE_FILE_NAMES'
					? 'CONFIGURATION'
					: this.paths.origin(query.logicalPath);
			const base = { invocationCount: 1, logicalPath: query.logicalPath, origin } as const;
			const subjectId = this.subject.descriptor.subjectId;
			const emit = (payload: CompilerObservationPayload): CompilerInputObservation =>
				boundedObservation(subjectId, payload, limits.maxQueryMetadataBytes);
			assertMinimumObservationBudget(
				subjectId,
				query,
				base,
				this.caseSensitive,
				limits.maxQueryMetadataBytes
			);
			if (this.paths.isBoundaryPath(query.logicalPath))
				return boundaryObservation(query, base, emit);
			const context: ObservationContext = {
				base,
				emit,
				limits,
				liveRegion: this.paths.isLiveDirectoryPermitted(query.logicalPath),
				liveScanRegion: this.paths.isLiveScanPermitted(query.logicalPath),
				subjectId,
				virtualDirectory: this.paths.isVirtualDirectory(query.logicalPath)
			};
			switch (query.operation) {
				case 'READ_FILE':
					return this.observeReadFile(query, context);
				case 'FILE_EXISTS':
					return this.observeFileExists(query, context);
				case 'DIRECTORY_EXISTS':
					return this.observeDirectoryExists(query, context);
				case 'GET_DIRECTORIES':
					return this.observeGetDirectories(query, context);
				case 'READ_DIRECTORY':
					return this.observeReadDirectory(query, context);
				case 'REALPATH':
					return this.observeRealpath(query, context);
				case 'CURRENT_DIRECTORY':
					return Object.freeze({
						observation: emit({
							...base,
							logicalPath: '.',
							operation: query.operation,
							resolvedLogicalPath: '.',
							result: 'RESOLVED'
						}),
						query
					});
				case 'USE_CASE_SENSITIVE_FILE_NAMES':
					return Object.freeze({
						observation: emit({
							...base,
							logicalPath: '.',
							operation: query.operation,
							result: this.caseSensitive ? 'CASE_SENSITIVE' : 'CASE_INSENSITIVE'
						}),
						query
					});
			}
		} catch (error) {
			if (error instanceof CompilerInputCaptureError || error instanceof CompilerPathError)
				throw error;
			fail(
				'CONTEXT_UNAVAILABLE',
				'Compiler input observation failed without exposing ambient filesystem details.'
			);
		}
	}

	private frozenArtifactBytes(artifact: {
		readonly bytes: number;
		readonly path: string;
		readonly sha256: string;
	}): Uint8Array {
		const bytes = readFrozenSubjectArtifact(this.subject, artifact.path);
		if (bytes === undefined || !bytesReproduceArtifact(bytes, artifact))
			fail(
				'FROZEN_BYTES_UNAVAILABLE',
				`Frozen bytes do not reproduce the captured identity for ${artifact.path}.`
			);
		return bytes;
	}

	private readLivePresentBytes(
		logicalPath: string,
		absolutePath: string,
		limits: CompilerInputReadLimits
	): Uint8Array {
		this.paths.assertLiveFilePermitted(logicalPath);
		if (!limits.allowPresentRead)
			fail('BUDGET_EXCEEDED', 'Compiler input closure exceeded its live-context file budget.');
		const bytes = readStableAuthorizedFile(absolutePath, logicalPath, this.paths, limits);
		const expectedDigest = this.paths.explicitContextDigest(logicalPath);
		if (expectedDigest !== undefined && sha256(bytes) !== expectedDigest)
			fail(
				'CONTEXT_CHANGED',
				`Explicit generated compiler context no longer reproduces its frozen digest: ${logicalPath}.`
			);
		return bytes;
	}

	private observeReadFile(
		query: CompilerInputQuery,
		context: ObservationContext
	): CapturedCompilerInput {
		const { base, emit, limits } = context;
		const absentRead = (): CapturedCompilerInput =>
			Object.freeze({
				observation: emit({ ...base, operation: 'READ_FILE', result: 'ABSENT' }),
				query
			});
		const artifact = this.paths.frozenArtifact(query.logicalPath);
		let bytes: Uint8Array | undefined;
		let byteBudgetClass:
			| 'FROZEN_SUBJECT'
			| 'LIVE_COMPILER_CONTEXT'
			| 'VIRTUAL_TRANSFORM'
			| undefined;
		let transformation: SemanticSourceTransformationRecord | undefined;
		if (artifact !== undefined) {
			bytes = this.frozenArtifactBytes(artifact);
			if (query.logicalPath.toLowerCase().endsWith('.svelte')) {
				const transformed = transformFrozenSvelte(
					bytes,
					query.logicalPath,
					limits.maxPathCharacters
				);
				bytes = transformed.bytes;
				transformation = transformed.evidence;
				byteBudgetClass = 'VIRTUAL_TRANSFORM';
			} else byteBudgetClass = 'FROZEN_SUBJECT';
		} else if (context.liveRegion && this.paths.isLiveFilePermitted(query.logicalPath)) {
			const absolutePath = this.paths.toAbsolute(query.logicalPath);
			const kind = statKind(absolutePath);
			if (kind === 'DIRECTORY') return absentRead();
			if (kind === 'FILE') {
				bytes = this.readLivePresentBytes(query.logicalPath, absolutePath, limits);
				byteBudgetClass = 'LIVE_COMPILER_CONTEXT';
			}
		}
		checkDeadline(limits);
		if (bytes === undefined || byteBudgetClass === undefined) return absentRead();
		const observation =
			transformation === undefined
				? emit({
						...base,
						byteBudgetClass: byteBudgetClass as 'FROZEN_SUBJECT' | 'LIVE_COMPILER_CONTEXT',
						contentBytes: bytes.byteLength,
						contentSha256: sha256(bytes),
						operation: 'READ_FILE',
						result: 'PRESENT'
					})
				: emit({
						...base,
						byteBudgetClass: 'VIRTUAL_TRANSFORM',
						contentBytes: bytes.byteLength,
						contentSha256: sha256(bytes),
						operation: 'READ_FILE',
						origin: 'VIRTUAL',
						result: 'PRESENT',
						transformation
					});
		return Object.freeze({ bytes: bytes.slice(), observation, query });
	}

	private fileExistsKind(
		logicalPath: string,
		frozen: boolean,
		permittedLiveFile: boolean
	): StatKind {
		if (frozen) return 'FILE';
		if (permittedLiveFile) return statKind(this.paths.toAbsolute(logicalPath));
		return 'ABSENT';
	}

	private observeFileExists(
		query: CompilerInputQuery,
		context: ObservationContext
	): CapturedCompilerInput {
		const { base, emit } = context;
		const artifact = this.paths.frozenArtifact(query.logicalPath);
		const permittedLiveFile =
			context.liveRegion && this.paths.isLiveFilePermitted(query.logicalPath);
		const kind = this.fileExistsKind(query.logicalPath, artifact !== undefined, permittedLiveFile);
		if (artifact === undefined && kind === 'FILE')
			this.paths.assertLiveFilePermitted(query.logicalPath);
		return Object.freeze({
			observation: emit({
				...base,
				operation: 'FILE_EXISTS',
				result: kind === 'FILE' ? 'PRESENT' : 'ABSENT'
			}),
			query
		});
	}

	private observeDirectoryExists(
		query: CompilerInputQuery,
		context: ObservationContext
	): CapturedCompilerInput {
		const { base, emit } = context;
		const exists =
			context.virtualDirectory ||
			(context.liveRegion && statKind(this.paths.toAbsolute(query.logicalPath)) === 'DIRECTORY');
		return Object.freeze({
			observation: emit({
				...base,
				operation: 'DIRECTORY_EXISTS',
				result: exists ? 'DIRECTORY' : 'NOT_DIRECTORY'
			}),
			query
		});
	}

	private observeGetDirectories(
		query: CompilerInputQuery,
		context: ObservationContext
	): CapturedCompilerInput {
		const { base, emit, limits } = context;
		const resultBudget = new DirectoryResultBudget(
			context.subjectId,
			{
				...base,
				operation: 'GET_DIRECTORIES',
				result: 'DIRECTORY',
				resultEntries: Object.freeze([]),
				scannedEntries: 0
			},
			limits
		);
		const liveDirectory =
			context.liveScanRegion && statKind(this.paths.toAbsolute(query.logicalPath)) === 'DIRECTORY';
		if (!context.virtualDirectory && !liveDirectory)
			return Object.freeze({
				observation: emit({
					...base,
					operation: 'GET_DIRECTORIES',
					result: 'NOT_DIRECTORY',
					resultEntries: Object.freeze([]),
					scannedEntries: 0
				}),
				query
			});
		const scans: DirectoryScan[] = [];
		if (context.virtualDirectory)
			scans.push(scanVirtualDirectories(query.logicalPath, this.paths, limits, resultBudget));
		if (liveDirectory)
			scans.push(
				scanLiveDirectories(
					query.logicalPath,
					this.paths,
					remainingDirectoryEntries(limits, scans),
					resultBudget
				)
			);
		const scan = mergeScans(scans);
		return Object.freeze({
			observation: emit({
				...base,
				operation: 'GET_DIRECTORIES',
				result: 'DIRECTORY',
				resultEntries: Object.freeze([...scan.entries]),
				scannedEntries: scan.scannedEntries
			}),
			query
		});
	}

	private observeReadDirectory(
		query: Extract<CompilerInputQuery, { operation: 'READ_DIRECTORY' }>,
		context: ObservationContext
	): CapturedCompilerInput {
		const { base, emit, limits } = context;
		const resultBudget = new DirectoryResultBudget(
			context.subjectId,
			{
				...base,
				...query,
				result: 'DIRECTORY',
				resultEntries: Object.freeze([]),
				scannedEntries: 0
			},
			limits
		);
		const liveDirectory =
			context.liveScanRegion && statKind(this.paths.toAbsolute(query.logicalPath)) === 'DIRECTORY';
		if (!context.virtualDirectory && !liveDirectory)
			return Object.freeze({
				observation: emit({
					...base,
					...query,
					result: 'NOT_DIRECTORY',
					resultEntries: Object.freeze([]),
					scannedEntries: 0
				}),
				query
			});
		const scans: DirectoryScan[] = [];
		if (context.virtualDirectory)
			scans.push(scanVirtualFiles(query, this.paths, limits, resultBudget));
		if (liveDirectory)
			scans.push(
				scanLiveFiles(query, this.paths, remainingDirectoryEntries(limits, scans), resultBudget)
			);
		const scan = mergeScans(scans);
		return Object.freeze({
			observation: emit({
				...base,
				...query,
				result: 'DIRECTORY',
				resultEntries: Object.freeze([...scan.entries]),
				scannedEntries: scan.scannedEntries
			}),
			query
		});
	}

	private observeRealpath(
		query: CompilerInputQuery,
		context: ObservationContext
	): CapturedCompilerInput {
		const { base, emit, limits } = context;
		const absentRealpath = (): CapturedCompilerInput =>
			Object.freeze({
				observation: emit({ ...base, operation: 'REALPATH', result: 'ABSENT' }),
				query
			});
		const resolvedFrozenLogical = this.paths.resolvedFrozenLogical(query.logicalPath);
		if (resolvedFrozenLogical !== undefined) {
			if (resolvedFrozenLogical.length > limits.maxPathCharacters)
				fail(
					'BUDGET_EXCEEDED',
					'Compiler REALPATH produced a path beyond its path-character budget.'
				);
			return Object.freeze({
				observation: emit({
					...base,
					operation: 'REALPATH',
					resolvedLogicalPath: resolvedFrozenLogical,
					result: 'RESOLVED'
				}),
				query
			});
		}
		if (!context.liveRegion || !this.paths.isLiveRealpathPermitted(query.logicalPath))
			return absentRealpath();
		const absolutePath = this.paths.toAbsolute(query.logicalPath);
		if (statKind(absolutePath) === 'ABSENT') return absentRealpath();
		const resolvedLogicalPath = this.paths.toLogical(realpathSync.native(absolutePath));
		if (resolvedLogicalPath.length > limits.maxPathCharacters)
			fail(
				'BUDGET_EXCEEDED',
				'Compiler REALPATH produced a path beyond its path-character budget.'
			);
		return Object.freeze({
			observation: emit({
				...base,
				operation: 'REALPATH',
				resolvedLogicalPath,
				result: 'RESOLVED'
			}),
			query
		});
	}
}

function freezeWire<T>(value: T): T {
	if (value !== null && typeof value === 'object' && !(value instanceof Uint8Array)) {
		for (const child of Object.values(value as Record<string, unknown>)) freezeWire(child);
		Object.freeze(value);
	}
	return value;
}

function cloneCaptured(entry: CapturedCompilerInput): CapturedCompilerInput {
	const query = freezeWire(structuredClone(entry.query));
	const observation = freezeWire(structuredClone(entry.observation));
	return Object.freeze({
		...(entry.bytes === undefined ? {} : { bytes: entry.bytes.slice() }),
		observation,
		query
	});
}

function observationBytes(observation: CompilerInputObservation): number {
	return Buffer.byteLength(canonicalSemanticJson(observation), 'utf8');
}

function compilerInputsMetadataBytes(observationByteSum: number, observationCount: number): number {
	return 2 + observationByteSum + Math.max(0, observationCount - 1);
}

function assertCapturedResultWithinPathBudget(
	observation: CompilerInputObservation,
	maxPathCharacters: number
): void {
	if (
		('resultEntries' in observation &&
			observation.resultEntries.some((entry) => entry.length > maxPathCharacters)) ||
		('resolvedLogicalPath' in observation &&
			observation.resolvedLogicalPath.length > maxPathCharacters)
	)
		fail('BUDGET_EXCEEDED', 'Compiler input result exceeded its path-character budget.');
}

class ProjectAttributionTracker {
	private readonly byProject = new Map<
		string,
		Map<string, { readonly query: CompilerInputQuery; count: number }>
	>();
	private readonly recipeDigests = new Map<
		string,
		{ readonly materializedRecipeDigest: string; readonly projectResolutionDigest: string }
	>();

	registerProject(
		projectKey: string,
		projectResolutionDigest: string,
		materializedRecipeDigest: string
	): void {
		if (this.recipeDigests.has(projectKey))
			fail('INVALID_QUERY', `Compiler project attribution is already registered: ${projectKey}.`);
		if (!SHA256.test(projectResolutionDigest) || !SHA256.test(materializedRecipeDigest))
			fail('INVALID_QUERY', 'Compiler recipe identity digest is invalid.');
		this.recipeDigests.set(
			projectKey,
			Object.freeze({ materializedRecipeDigest, projectResolutionDigest })
		);
		this.byProject.set(projectKey, new Map());
	}

	record(projectKey: string, query: CompilerInputQuery): void {
		const byQuery = this.byProject.get(projectKey);
		if (byQuery === undefined)
			fail('INVALID_QUERY', `Compiler query has no registered project attribution: ${projectKey}.`);
		const key = compilerInputQueryKey(query);
		const existing = byQuery.get(key);
		if (existing === undefined)
			byQuery.set(key, { count: 1, query: freezeWire(structuredClone(query)) });
		else existing.count += 1;
	}

	entry(
		projectKey: string,
		globalEntries: ReadonlyMap<string, CapturedCompilerInput>
	): CompilerProjectAttribution {
		const queries = this.byProject.get(projectKey);
		const identity = this.recipeDigests.get(projectKey);
		if (queries === undefined || identity === undefined)
			fail('INVALID_QUERY', `Compiler project attribution is not registered: ${projectKey}.`);
		const contextInputIds = new Set<SemanticContextInputId>();
		const queryInvocations = [...queries.entries()]
			.sort(([left], [right]) => compareText(left, right))
			.map(([key, value]) => {
				const global = globalEntries.get(key);
				if (global === undefined)
					fail(
						'INVALID_CAPTURE',
						`Project attribution references an absent compiler query: ${projectKey}.`
					);
				contextInputIds.add(global.observation.id);
				return Object.freeze({
					invocationCount: value.count,
					query: freezeWire(structuredClone(value.query))
				});
			});
		return Object.freeze({
			contextInputIds: Object.freeze([...contextInputIds].sort(compareText)),
			...identity,
			projectKey,
			queryInvocations: Object.freeze(queryInvocations)
		});
	}

	entries(
		globalEntries: ReadonlyMap<string, CapturedCompilerInput>
	): readonly CompilerProjectAttribution[] {
		const totals = new Map<string, number>();
		const result = [...this.byProject.keys()]
			.sort(compareText)
			.map((projectKey) => this.entry(projectKey, globalEntries));
		for (const attribution of result)
			for (const value of attribution.queryInvocations) {
				const key = compilerInputQueryKey(value.query);
				totals.set(key, (totals.get(key) ?? 0) + value.invocationCount);
			}
		for (const [key, entry] of globalEntries) {
			if ((totals.get(key) ?? 0) !== entry.observation.invocationCount)
				fail(
					'INVALID_CAPTURE',
					`Project attribution does not reconcile compiler query multiplicity for ${entry.query.operation} ${entry.query.logicalPath}.`
				);
		}
		return Object.freeze(result);
	}
}

export class CompilerInputJournal {
	private readonly entriesByQuery = new Map<string, CapturedCompilerInput>();
	private readonly attributions = new ProjectAttributionTracker();
	private contextBytes = 0;
	private contextFiles = 0;
	private directoryEntries = 0;
	private observationByteSum = 0;
	private queryInvocations = 0;
	private registeredProjects = 0;
	private readonly budgets: SemanticBudgets;
	private readonly deadlineMs: number;
	private finalized = false;
	private poisoned = false;

	constructor(
		private readonly reader: LiveCompilerInputReader,
		budgetsValue: SemanticBudgets,
		private readonly startedAtMs: number,
		private readonly clock: SemanticOperationClock = Date.now
	) {
		this.budgets = normalizeSemanticBudgets(budgetsValue);
		this.deadlineMs = startedAtMs + this.budgets.maxDurationMs;
		if (
			!Number.isSafeInteger(startedAtMs) ||
			startedAtMs < 0 ||
			startedAtMs > deadlineNow(clock) ||
			!Number.isSafeInteger(this.deadlineMs)
		)
			fail('BUDGET_EXCEEDED', 'Semantic extraction operation start or deadline is invalid.');
		if (compilerInputsMetadataBytes(0, 0) > this.budgets.maxCompilerInputMetadataBytes)
			fail('BUDGET_EXCEEDED', 'Empty compiler-input metadata exceeds its producing byte budget.');
	}

	assertWithinDeadline(): void {
		checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
	}

	registerProject(
		projectKey: string,
		recipe: ProgramRecipe,
		materialized: MaterializedProgramRecipe
	): void {
		if (this.finalized) fail('INVALID_CAPTURE', 'Compiler input capture is already finalized.');
		checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
		if (this.registeredProjects >= this.budgets.maxProjects)
			fail('BUDGET_EXCEEDED', 'Compiler input capture exceeded its project budget.');
		if (typeof projectKey !== 'string' || projectKey.length === 0)
			fail('INVALID_QUERY', 'Compiler project attribution key is invalid.');
		if (projectKey.length > this.budgets.maxPathCharacters)
			fail(
				'BUDGET_EXCEEDED',
				'Compiler project attribution key exceeds its path-character budget.'
			);
		const identity = compilerProjectIdentity(
			recipe,
			materialized,
			this.budgets.maxPathCharacters,
			this.reader.paths.repositoryRoot
		);
		checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
		if (projectKey !== identity.projectKey)
			fail(
				'INVALID_QUERY',
				'Compiler project attribution key must equal the authoritative ProgramRecipe config path.'
			);
		checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
		this.attributions.registerProject(
			projectKey,
			identity.projectResolutionDigest,
			identity.materializedRecipeDigest
		);
		this.registeredProjects += 1;
	}

	capture(queryValue: CompilerInputQuery, projectKey: string): CapturedCompilerInput {
		try {
			return this.captureActive(queryValue, projectKey);
		} catch (error) {
			this.poisoned = true;
			throw error;
		}
	}

	poison(): void {
		this.poisoned = true;
	}

	currentProjectEvidence(projectKey: string): CapturedCompilerProjectEvidence {
		if (this.finalized) fail('INVALID_CAPTURE', 'Compiler input capture is already finalized.');
		if (this.poisoned)
			fail('INVALID_CAPTURE', 'Compiler input capture is poisoned by an earlier failed query.');
		checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
		const attribution = this.attributions.entry(projectKey, this.entriesByQuery);
		const ids = new Set(attribution.contextInputIds);
		const observations = [...this.entriesByQuery.values()]
			.map((entry) => entry.observation)
			.filter((observation) => ids.has(observation.id))
			.sort((left, right) => compareText(left.id, right.id))
			.map((observation) => freezeWire(structuredClone(observation)));
		if (observations.length !== ids.size)
			fail(
				'INVALID_CAPTURE',
				`Captured compiler project evidence does not resolve every context input for ${projectKey}.`
			);
		checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
		return Object.freeze({ attribution, observations: Object.freeze(observations) });
	}

	private captureRepeatInvocation(
		key: string,
		existing: CapturedCompilerInput,
		query: CompilerInputQuery,
		projectKey: string
	): CapturedCompilerInput {
		const updated = withInvocationCount(
			this.reader.paths.subject.descriptor.subjectId,
			existing,
			existing.observation.invocationCount + 1
		);
		const nextByteSum =
			this.observationByteSum -
			observationBytes(existing.observation) +
			observationBytes(updated.observation);
		if (
			compilerInputsMetadataBytes(nextByteSum, this.entriesByQuery.size) >
			this.budgets.maxCompilerInputMetadataBytes
		)
			fail(
				'BUDGET_EXCEEDED',
				'Compiler input journal exceeded its exact emitted metadata-byte budget.'
			);
		this.entriesByQuery.set(key, updated);
		this.observationByteSum = nextByteSum;
		this.queryInvocations += 1;
		this.attributions.record(projectKey, query);
		const result = cloneCaptured(updated);
		checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
		return result;
	}

	private assertScannedEntryBudget(scannedEntries: number): void {
		if (
			!Number.isSafeInteger(this.directoryEntries + scannedEntries) ||
			this.directoryEntries + scannedEntries > this.budgets.maxDirectoryEntries
		)
			fail(
				'BUDGET_EXCEEDED',
				'Compiler input journal exceeded its scanned-directory-entry budget.'
			);
	}

	private nextLiveContextTotals(observation: CompilerInputObservation): {
		readonly contextBytes: number;
		readonly contextFiles: number;
	} {
		if (
			observation.operation !== 'READ_FILE' ||
			observation.result !== 'PRESENT' ||
			observation.byteBudgetClass !== 'LIVE_COMPILER_CONTEXT'
		)
			return { contextBytes: this.contextBytes, contextFiles: this.contextFiles };
		const contextFiles = this.contextFiles + 1;
		const contextBytes = this.contextBytes + observation.contentBytes;
		if (
			observation.contentBytes > this.budgets.maxContextFileBytes ||
			contextFiles > this.budgets.maxContextFiles ||
			!Number.isSafeInteger(contextBytes) ||
			contextBytes > this.budgets.maxContextBytes
		)
			fail(
				'BUDGET_EXCEEDED',
				'Compiler input closure exceeded its live-context file or byte budget.'
			);
		return { contextBytes, contextFiles };
	}

	private captureActive(queryValue: CompilerInputQuery, projectKey: string): CapturedCompilerInput {
		if (this.finalized) fail('INVALID_CAPTURE', 'Compiler input capture is already finalized.');
		if (this.poisoned)
			fail('INVALID_CAPTURE', 'Compiler input capture is poisoned by an earlier failed query.');
		checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
		if (projectKey.length === 0 || projectKey.length > this.budgets.maxPathCharacters)
			fail('INVALID_QUERY', 'Compiler project attribution key is invalid.');
		const query = normalizeCompilerInputQuery(queryValue, this.reader.paths, {
			clock: this.clock,
			deadlineMs: this.deadlineMs,
			maxDirectoryEntries: this.budgets.maxDirectoryEntries,
			maxPathCharacters: this.budgets.maxPathCharacters,
			maxQueryMetadataBytes: this.budgets.maxCompilerInputMetadataBytes
		});
		const key = compilerInputQueryKey(query);
		const existing = this.entriesByQuery.get(key);
		if (this.queryInvocations >= this.budgets.maxCompilerQueryInvocations)
			fail('BUDGET_EXCEEDED', 'Compiler input journal exceeded its query-invocation budget.');
		if (existing !== undefined)
			return this.captureRepeatInvocation(key, existing, query, projectKey);
		if (this.entriesByQuery.size >= this.budgets.maxCompilerQueries)
			fail('BUDGET_EXCEEDED', 'Compiler input journal exceeded its distinct-query budget.');
		const frozenRead =
			query.operation === 'READ_FILE' &&
			this.reader.paths.frozenArtifact(query.logicalPath) !== undefined;
		const captured = this.reader.observe(query, {
			allowPresentRead: frozenRead || this.contextFiles < this.budgets.maxContextFiles,
			clock: this.clock,
			deadlineMs: this.deadlineMs,
			maxDirectoryEntries: this.budgets.maxDirectoryEntries - this.directoryEntries,
			maxPathCharacters: this.budgets.maxPathCharacters,
			maxQueryMetadataBytes:
				this.budgets.maxCompilerInputMetadataBytes -
				compilerInputsMetadataBytes(this.observationByteSum, this.entriesByQuery.size),
			maxReadBytes: Math.min(
				this.budgets.maxContextFileBytes,
				this.budgets.maxContextBytes - this.contextBytes
			)
		});
		checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
		assertCapturedResultWithinPathBudget(captured.observation, this.budgets.maxPathCharacters);
		const scannedEntries = observationScannedEntries(captured.observation);
		this.assertScannedEntryBudget(scannedEntries);
		const nextContextTotals = this.nextLiveContextTotals(captured.observation);
		const nextByteSum = this.observationByteSum + observationBytes(captured.observation);
		if (
			compilerInputsMetadataBytes(nextByteSum, this.entriesByQuery.size + 1) >
			this.budgets.maxCompilerInputMetadataBytes
		)
			fail(
				'BUDGET_EXCEEDED',
				'Compiler input journal exceeded its exact emitted metadata-byte budget.'
			);
		const stored = cloneCaptured(captured);
		this.entriesByQuery.set(key, stored);
		this.contextFiles = nextContextTotals.contextFiles;
		this.contextBytes = nextContextTotals.contextBytes;
		this.directoryEntries += scannedEntries;
		this.observationByteSum = nextByteSum;
		this.queryInvocations += 1;
		this.attributions.record(projectKey, query);
		const result = cloneCaptured(stored);
		checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
		return result;
	}

	private entries(): readonly CapturedCompilerInput[] {
		return Object.freeze(
			[...this.entriesByQuery.values()]
				.sort((left, right) => compareText(left.observation.id, right.observation.id))
				.map(cloneCaptured)
		);
	}

	private observations(): readonly CompilerInputObservation[] {
		return Object.freeze(
			this.entries().map((entry) => freezeWire(structuredClone(entry.observation)))
		);
	}

	finalizeCapture(): FrozenCompilerCapture {
		if (this.finalized) fail('INVALID_CAPTURE', 'Compiler input capture is already finalized.');
		if (this.poisoned)
			fail('INVALID_CAPTURE', 'Compiler input capture is poisoned by an earlier failed query.');
		this.finalized = true;
		checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
		const entries = this.entries();
		checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
		validateJournalEntries(entries, this.reader.paths, this.budgets, this.deadlineMs, this.clock);
		checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
		const observations = this.observations();
		checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
		const projectAttributions = this.attributions.entries(this.entriesByQuery);
		checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
		const capture = createFrozenCompilerCapture({
			budgets: this.budgets,
			closureDigest: compilerInputClosureDigest(observations),
			clock: this.clock,
			entries,
			observations,
			paths: this.reader.paths,
			projectAttributions,
			reader: this.reader,
			startedAtMs: this.startedAtMs,
			subject: this.reader.paths.subject
		});
		checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
		return capture;
	}
}

function observationAllowedKeys(
	operation: string,
	result: string,
	byteBudgetClass: unknown
): readonly string[] {
	const base = [
		'id',
		'invocationCount',
		'logicalPath',
		'operation',
		'origin',
		'result',
		'resultDigest'
	];
	if (operation === 'READ_FILE' && result === 'PRESENT')
		return byteBudgetClass === 'VIRTUAL_TRANSFORM'
			? [...base, 'byteBudgetClass', 'contentBytes', 'contentSha256', 'transformation']
			: [...base, 'byteBudgetClass', 'contentBytes', 'contentSha256'];
	if (operation === 'GET_DIRECTORIES') return [...base, 'resultEntries', 'scannedEntries'];
	if (operation === 'READ_DIRECTORY')
		return [
			...base,
			'depth',
			'excludes',
			'extensions',
			'includes',
			'resultEntries',
			'scannedEntries'
		];
	if ((operation === 'REALPATH' || operation === 'CURRENT_DIRECTORY') && result === 'RESOLVED')
		return [...base, 'resolvedLogicalPath'];
	return base;
}

function inertBytes(value: unknown, field: string): Uint8Array {
	try {
		if (
			value === null ||
			typeof value !== 'object' ||
			isProxy(value) ||
			!(value instanceof Uint8Array) ||
			Object.getPrototypeOf(value) !== Uint8Array.prototype
		)
			fail('INVALID_CAPTURE', `${field} must be an inert Uint8Array.`);
		if (
			Reflect.ownKeys(value).some(
				(key) => typeof key !== 'string' || !/^(?:0|[1-9]\d*)$/u.test(key)
			)
		)
			fail('INVALID_CAPTURE', `${field} must not contain symbol or expando properties.`);
		return value.slice();
	} catch (error) {
		if (error instanceof CompilerInputCaptureError) throw error;
		fail('INVALID_CAPTURE', `${field} could not be inspected as inert bytes.`);
	}
}

function bytesReproduceArtifact(
	bytes: Uint8Array,
	artifact: { readonly bytes: number; readonly sha256: string }
): boolean {
	return bytes.byteLength === artifact.bytes && sha256(bytes) === artifact.sha256;
}

function assertCapturedEntryFields(entry: Readonly<Record<string, unknown>>): void {
	if (
		!Object.keys(entry).every((key) => ['bytes', 'observation', 'query'].includes(key)) ||
		!Object.hasOwn(entry, 'observation') ||
		!Object.hasOwn(entry, 'query')
	)
		fail('INVALID_CAPTURE', 'CapturedCompilerInput has unknown or missing fields.');
}

function assertCapturedObservationBinding(
	observation: Readonly<Record<string, unknown>>,
	query: CompilerInputQuery,
	paths: FrozenCompilerPathResolver
): void {
	const expectedOrigin =
		observation.byteBudgetClass === 'VIRTUAL_TRANSFORM'
			? 'VIRTUAL'
			: query.operation === 'CURRENT_DIRECTORY' || query.operation === 'USE_CASE_SENSITIVE_FILE_NAMES'
			? 'CONFIGURATION'
			: paths.recordedOrigin(query.logicalPath);
	if (
		observation.operation !== query.operation ||
		observation.logicalPath !== query.logicalPath ||
		typeof observation.origin !== 'string' ||
		!ORIGINS.has(observation.origin as SourceOrigin) ||
		observation.origin !== expectedOrigin
	)
		fail(
			'INVALID_CAPTURE',
			'Captured observation does not bind its canonical query and derived origin.'
		);
	if (
		typeof observation.invocationCount !== 'number' ||
		!Number.isSafeInteger(observation.invocationCount) ||
		observation.invocationCount < 1
	)
		fail('INVALID_CAPTURE', 'Captured observation invocation count is invalid.');
}

function capturedResultIsValidForOperation(operation: string, result: string): boolean {
	if (operation === 'READ_FILE' || operation === 'FILE_EXISTS')
		return ['PRESENT', 'ABSENT'].includes(result);
	if (
		operation === 'DIRECTORY_EXISTS' ||
		operation === 'GET_DIRECTORIES' ||
		operation === 'READ_DIRECTORY'
	)
		return ['DIRECTORY', 'NOT_DIRECTORY'].includes(result);
	if (operation === 'REALPATH') return ['RESOLVED', 'ABSENT'].includes(result);
	if (operation === 'CURRENT_DIRECTORY') return result === 'RESOLVED';
	return (
		operation === 'USE_CASE_SENSITIVE_FILE_NAMES' &&
		['CASE_SENSITIVE', 'CASE_INSENSITIVE'].includes(result)
	);
}

function assertCapturedReadDirectoryParameters(
	observation: Readonly<Record<string, unknown>>,
	query: CompilerInputQuery
): void {
	const readQuery = query as Extract<CompilerInputQuery, { operation: 'READ_DIRECTORY' }>;
	for (const key of ['depth', 'excludes', 'extensions', 'includes'] as const)
		if (canonicalSemanticJson(observation[key]) !== canonicalSemanticJson(readQuery[key]))
			fail('INVALID_CAPTURE', 'Captured READ_DIRECTORY parameters do not reproduce the query.');
}

function assertCapturedDirectoryResult(
	observation: Readonly<Record<string, unknown>>,
	result: string,
	paths: FrozenCompilerPathResolver,
	budgets: SemanticBudgets,
	deadlineMs: number,
	clock: SemanticOperationClock
): void {
	const entries = inertStringArray(
		observation.resultEntries,
		'CapturedCompilerInput.observation.resultEntries',
		'INVALID_CAPTURE',
		{
			clock,
			deadlineMs,
			maxCharacters: budgets.maxPathCharacters,
			maxLength: budgets.maxDirectoryEntries
		}
	);
	if (
		entries.some(
			(item, index) =>
				paths.canonicalRecordedLogical(item) !== item || (index > 0 && entries[index - 1]! >= item)
		) ||
		(result === 'NOT_DIRECTORY' && entries.length > 0)
	)
		fail('INVALID_CAPTURE', 'Captured directory result entries are not a canonical set.');
	if (
		typeof observation.scannedEntries !== 'number' ||
		!Number.isSafeInteger(observation.scannedEntries) ||
		observation.scannedEntries < entries.length ||
		(result === 'NOT_DIRECTORY' && observation.scannedEntries !== 0)
	)
		fail('INVALID_CAPTURE', 'Captured scanned-entry evidence is invalid.');
}

function assertCapturedPresentFileMetadata(
	observation: Readonly<Record<string, unknown>>,
	query: CompilerInputQuery,
	paths: FrozenCompilerPathResolver
): void {
	const artifact = paths.frozenArtifact(query.logicalPath);
	const expectedBudgetClass =
		artifact === undefined
			? 'LIVE_COMPILER_CONTEXT'
			: query.logicalPath.toLowerCase().endsWith('.svelte')
				? 'VIRTUAL_TRANSFORM'
				: 'FROZEN_SUBJECT';
	if (
		observation.byteBudgetClass !== expectedBudgetClass ||
		typeof observation.contentBytes !== 'number' ||
		!Number.isSafeInteger(observation.contentBytes) ||
		observation.contentBytes < 0 ||
		typeof observation.contentSha256 !== 'string' ||
		!SHA256.test(observation.contentSha256)
	)
		fail('INVALID_CAPTURE', 'Captured present file metadata or byte-budget class is invalid.');
	if (expectedBudgetClass === 'VIRTUAL_TRANSFORM') {
		if (observation.transformation === undefined)
			fail('INVALID_CAPTURE', 'Captured virtual source lacks transformation evidence.');
		try {
			canonicalSemanticJson(observation.transformation);
		} catch {
			fail('INVALID_CAPTURE', 'Captured virtual-source transformation evidence is not inert canonical data.');
		}
	}
}

function assertCapturedOperationEvidence(
	observation: Readonly<Record<string, unknown>>,
	query: CompilerInputQuery,
	result: string,
	paths: FrozenCompilerPathResolver,
	budgets: SemanticBudgets,
	deadlineMs: number,
	clock: SemanticOperationClock
): void {
	if (observation.operation === 'READ_DIRECTORY')
		assertCapturedReadDirectoryParameters(observation, query);
	if (observation.operation === 'GET_DIRECTORIES' || observation.operation === 'READ_DIRECTORY')
		assertCapturedDirectoryResult(observation, result, paths, budgets, deadlineMs, clock);
	if (observation.operation === 'READ_FILE' && result === 'PRESENT')
		assertCapturedPresentFileMetadata(observation, query, paths);
}

function assertCapturedResolvedPaths(
	observation: Readonly<Record<string, unknown>>,
	query: CompilerInputQuery,
	result: string,
	paths: FrozenCompilerPathResolver
): void {
	if (
		(observation.operation === 'REALPATH' || observation.operation === 'CURRENT_DIRECTORY') &&
		result === 'RESOLVED' &&
		(typeof observation.resolvedLogicalPath !== 'string' ||
			paths.canonicalRecordedLogical(observation.resolvedLogicalPath) !==
				observation.resolvedLogicalPath)
	)
		fail('INVALID_CAPTURE', 'Captured resolved logical path is not canonical.');
	if (
		observation.operation === 'CURRENT_DIRECTORY' &&
		(query.logicalPath !== '.' || observation.resolvedLogicalPath !== '.')
	)
		fail('INVALID_CAPTURE', 'Captured current directory is not the repository root.');
	if (
		observation.operation === 'USE_CASE_SENSITIVE_FILE_NAMES' &&
		result !== (paths.caseSensitive ? 'CASE_SENSITIVE' : 'CASE_INSENSITIVE')
	)
		fail('INVALID_CAPTURE', 'Captured case-sensitivity result does not match the path authority.');
}

function assertCapturedObservationIdentity(
	observation: Readonly<Record<string, unknown>>,
	paths: FrozenCompilerPathResolver
): void {
	if (
		typeof observation.id !== 'string' ||
		typeof observation.resultDigest !== 'string' ||
		!SHA256.test(observation.resultDigest)
	)
		fail('INVALID_CAPTURE', 'Captured observation identity fields are invalid.');
	const { id: _id, resultDigest: _resultDigest, ...payload } = observation;
	const expected = finalizeObservation(
		paths.subject.descriptor.subjectId,
		payload as CompilerObservationPayload
	);
	if (canonicalSemanticJson(expected) !== canonicalSemanticJson(observation))
		fail('INVALID_CAPTURE', 'Captured observation identity does not bind its exact result.');
}

function assertCapturedFrozenBytes(
	bytes: Uint8Array,
	observation: Readonly<Record<string, unknown>>,
	query: CompilerInputQuery,
	paths: FrozenCompilerPathResolver
): void {
	const artifact = paths.frozenArtifact(query.logicalPath);
	const authoritative =
		artifact === undefined ? undefined : readFrozenSubjectArtifact(paths.subject, artifact.path);
	if (
		artifact === undefined ||
		authoritative === undefined ||
		!bytesReproduceArtifact(authoritative, artifact)
	)
		fail('FROZEN_BYTES_UNAVAILABLE', `Frozen bytes are unavailable for ${query.logicalPath}.`);
	if (
		observation.contentBytes !== artifact.bytes ||
		observation.contentSha256 !== artifact.sha256 ||
		bytes.byteLength !== authoritative.byteLength ||
		bytes.some((byte, index) => byte !== authoritative[index])
	)
		fail(
			'INVALID_CAPTURE',
			`Captured frozen bytes do not reproduce the authoritative artifact: ${query.logicalPath}.`
		);
}

function assertCapturedVirtualBytes(
	bytes: Uint8Array,
	observation: Readonly<Record<string, unknown>>,
	query: CompilerInputQuery,
	paths: FrozenCompilerPathResolver,
	budgets: SemanticBudgets
): void {
	const artifact = paths.frozenArtifact(query.logicalPath);
	const authoritative =
		artifact === undefined ? undefined : readFrozenSubjectArtifact(paths.subject, artifact.path);
	if (
		artifact === undefined ||
		authoritative === undefined ||
		!bytesReproduceArtifact(authoritative, artifact)
	)
		fail('FROZEN_BYTES_UNAVAILABLE', `Frozen Svelte bytes are unavailable for ${query.logicalPath}.`);
	const expected = transformFrozenSvelte(
		authoritative,
		query.logicalPath,
		budgets.maxPathCharacters
	);
	if (
		canonicalSemanticJson(expected.evidence) !== canonicalSemanticJson(observation.transformation) ||
		expected.bytes.byteLength !== bytes.byteLength ||
		expected.bytes.some((byte, index) => byte !== bytes[index])
	)
		fail(
			'INVALID_CAPTURE',
			`Captured virtual bytes do not reproduce the authoritative frozen Svelte transform: ${query.logicalPath}.`
		);
}

function validateCapturedPresentBytes(
	entry: Readonly<Record<string, unknown>>,
	observation: Readonly<Record<string, unknown>>,
	query: CompilerInputQuery,
	paths: FrozenCompilerPathResolver,
	budgets: SemanticBudgets
): Uint8Array {
	const bytes = inertBytes(entry.bytes, 'CapturedCompilerInput.bytes');
	if (bytes.byteLength !== observation.contentBytes || sha256(bytes) !== observation.contentSha256)
		fail('INVALID_CAPTURE', 'Captured bytes do not reproduce the present file observation.');
	if (observation.byteBudgetClass === 'FROZEN_SUBJECT')
		assertCapturedFrozenBytes(bytes, observation, query, paths);
	if (observation.byteBudgetClass === 'VIRTUAL_TRANSFORM')
		assertCapturedVirtualBytes(bytes, observation, query, paths, budgets);
	return bytes;
}

function validateCapturedEntry(
	value: unknown,
	paths: FrozenCompilerPathResolver,
	budgets: SemanticBudgets,
	deadlineMs: number,
	clock: SemanticOperationClock = Date.now
): CapturedCompilerInput {
	try {
		const entry = inertRecord(value, 'CapturedCompilerInput', 'INVALID_CAPTURE');
		assertCapturedEntryFields(entry);
		const query = normalizeCompilerInputQuery(
			entry.query,
			paths,
			{
				clock,
				deadlineMs,
				maxDirectoryEntries: budgets.maxDirectoryEntries,
				maxPathCharacters: budgets.maxPathCharacters,
				maxQueryMetadataBytes: budgets.maxCompilerInputMetadataBytes
			},
			'INVALID_CAPTURE'
		);
		const observation = inertRecord(
			entry.observation,
			'CapturedCompilerInput.observation',
			'INVALID_CAPTURE'
		);
		if (typeof observation.operation !== 'string' || typeof observation.result !== 'string')
			fail('INVALID_CAPTURE', 'Captured observation operation and result must be strings.');
		exactKeys(
			observation,
			'CapturedCompilerInput.observation',
			observationAllowedKeys(
				observation.operation,
				observation.result,
				observation.byteBudgetClass
			),
			'INVALID_CAPTURE'
		);
		assertCapturedObservationBinding(observation, query, paths);
		const result = observation.result;
		if (!capturedResultIsValidForOperation(observation.operation, result))
			fail('INVALID_CAPTURE', 'Captured observation result is invalid for its operation.');
		assertCapturedOperationEvidence(observation, query, result, paths, budgets, deadlineMs, clock);
		assertCapturedResolvedPaths(observation, query, result, paths);
		assertCapturedObservationIdentity(observation, paths);
		const presentRead = observation.operation === 'READ_FILE' && result === 'PRESENT';
		exactKeys(
			entry,
			'CapturedCompilerInput',
			presentRead ? ['bytes', 'observation', 'query'] : ['observation', 'query'],
			'INVALID_CAPTURE'
		);
		if (!presentRead)
			return cloneCaptured({
				observation: observation as unknown as CompilerInputObservation,
				query
			});
		return cloneCaptured({
			bytes: validateCapturedPresentBytes(entry, observation, query, paths, budgets),
			observation: observation as unknown as CompilerInputObservation,
			query
		});
	} catch (error) {
		if (error instanceof CompilerInputCaptureError || error instanceof CompilerPathError)
			throw error;
		fail('INVALID_CAPTURE', 'CapturedCompilerInput could not be read as inert wire data.');
	}
}

interface ValidatedJournal {
	readonly entries: readonly CapturedCompilerInput[];
}

interface JournalEntryTotals {
	invocationCount: number;
	scannedEntries: number;
}

type LiveContextReadObservation = Extract<
	CompilerInputObservation,
	{ operation: 'READ_FILE'; result: 'PRESENT' }
>;

function observationScannedEntries(observation: CompilerInputObservation): number {
	return 'scannedEntries' in observation ? observation.scannedEntries : 0;
}

function accumulateJournalEntryTotals(
	entry: CapturedCompilerInput,
	totals: JournalEntryTotals,
	budgets: SemanticBudgets
): void {
	totals.invocationCount += entry.observation.invocationCount;
	if (
		!Number.isSafeInteger(totals.invocationCount) ||
		totals.invocationCount > budgets.maxCompilerQueryInvocations
	)
		fail('BUDGET_EXCEEDED', 'Compiler input journal exceeds its query-invocation budget.');
	totals.scannedEntries += observationScannedEntries(entry.observation);
	if (
		!Number.isSafeInteger(totals.scannedEntries) ||
		totals.scannedEntries > budgets.maxDirectoryEntries
	)
		fail('BUDGET_EXCEEDED', 'Compiler input journal exceeds its scanned-directory-entry budget.');
}

function noteJournalLiveContextRead(
	entry: CapturedCompilerInput,
	liveReads: Map<string, LiveContextReadObservation>,
	budgets: SemanticBudgets
): void {
	if (
		entry.observation.operation !== 'READ_FILE' ||
		entry.observation.result !== 'PRESENT' ||
		entry.observation.byteBudgetClass !== 'LIVE_COMPILER_CONTEXT'
	)
		return;
	if (entry.observation.contentBytes > budgets.maxContextFileBytes)
		fail('BUDGET_EXCEEDED', 'Compiler input journal contains an oversized live-context file.');
	liveReads.set(entry.observation.logicalPath, entry.observation);
}

function validateJournalEntries(
	entriesValue: unknown,
	paths: FrozenCompilerPathResolver,
	budgets: SemanticBudgets,
	deadlineMs: number,
	clock: SemanticOperationClock = Date.now
): ValidatedJournal {
	const values = inertDenseArray(
		entriesValue,
		'CapturedCompilerInput[]',
		budgets.maxCompilerQueries,
		'INVALID_CAPTURE',
		deadlineMs,
		clock
	);
	const entries: CapturedCompilerInput[] = [];
	const queryKeys = new Set<string>();
	const liveReads = new Map<string, LiveContextReadObservation>();
	const totals: JournalEntryTotals = { invocationCount: 0, scannedEntries: 0 };
	for (const value of values) {
		checkDeadline({ clock, deadlineMs });
		const entry = validateCapturedEntry(value, paths, budgets, deadlineMs, clock);
		const key = compilerInputQueryKey(entry.query);
		if (queryKeys.has(key))
			fail(
				'DUPLICATE_QUERY',
				`Compiler input journal contains duplicate query ${entry.query.operation} ${entry.query.logicalPath}.`
			);
		queryKeys.add(key);
		accumulateJournalEntryTotals(entry, totals, budgets);
		noteJournalLiveContextRead(entry, liveReads, budgets);
		entries.push(entry);
		checkDeadline({ clock, deadlineMs });
	}
	if (liveReads.size > budgets.maxContextFiles)
		fail('BUDGET_EXCEEDED', 'Compiler input journal exceeds its live-context file budget.');
	const contextBytes = [...liveReads.values()].reduce(
		(total, observation) => total + observation.contentBytes,
		0
	);
	if (!Number.isSafeInteger(contextBytes) || contextBytes > budgets.maxContextBytes)
		fail('BUDGET_EXCEEDED', 'Compiler input journal exceeds its live-context byte budget.');
	const observations = entries
		.map((entry) => entry.observation)
		.sort((left, right) => compareText(left.id, right.id));
	if (
		Buffer.byteLength(canonicalSemanticJson(observations), 'utf8') >
		budgets.maxCompilerInputMetadataBytes
	)
		fail(
			'BUDGET_EXCEEDED',
			'Compiler input journal exceeds its exact emitted metadata-byte budget.'
		);
	checkDeadline({ clock, deadlineMs });
	return { entries: Object.freeze(entries) };
}

interface CompilerCaptureState {
	readonly budgets: SemanticBudgets;
	readonly closureDigest: string;
	readonly clock: SemanticOperationClock;
	readonly entries: readonly CapturedCompilerInput[];
	readonly observations: readonly CompilerInputObservation[];
	readonly paths: FrozenCompilerPathResolver;
	readonly projectAttributions: readonly CompilerProjectAttribution[];
	readonly reader: LiveCompilerInputReader;
	readonly startedAtMs: number;
	readonly subject: FrozenSubject;
}

const FROZEN_CAPTURE_STATES = new WeakMap<object, CompilerCaptureState>();
const VERIFIED_CAPTURE_STATES = new WeakMap<object, CompilerCaptureState>();

function cloneAttributions(
	attributions: readonly CompilerProjectAttribution[]
): readonly CompilerProjectAttribution[] {
	return freezeWire(structuredClone(attributions));
}

function cloneState(state: CompilerCaptureState): CompilerCaptureState {
	return Object.freeze({
		...state,
		budgets: Object.freeze({ ...state.budgets }),
		entries: Object.freeze(state.entries.map(cloneCaptured)),
		observations: freezeWire(structuredClone(state.observations)),
		projectAttributions: cloneAttributions(state.projectAttributions)
	});
}

function publicEvidenceEntry(entry: CapturedCompilerInput): CompilerInputEvidenceEntry {
	return Object.freeze({
		observation: freezeWire(structuredClone(entry.observation)),
		query: freezeWire(structuredClone(entry.query))
	});
}

function publicCapture(
	state: CompilerCaptureState
): Omit<FrozenCompilerCapture, typeof FROZEN_CAPTURE_BRAND> {
	return Object.freeze({
		closureDigest: state.closureDigest,
		entries: Object.freeze(state.entries.map(publicEvidenceEntry)),
		observations: freezeWire(structuredClone(state.observations)),
		projectAttributions: cloneAttributions(state.projectAttributions)
	});
}

function createFrozenCompilerCapture(stateValue: CompilerCaptureState): FrozenCompilerCapture {
	const state = cloneState(stateValue);
	const capture = publicCapture(state) as FrozenCompilerCapture;
	FROZEN_CAPTURE_STATES.set(capture, state);
	return capture;
}

function createVerifiedCompilerCapture(stateValue: CompilerCaptureState): VerifiedCompilerCapture {
	const state = cloneState(stateValue);
	const capture = publicCapture(state) as VerifiedCompilerCapture;
	VERIFIED_CAPTURE_STATES.set(capture, state);
	return capture;
}

function frozenState(value: unknown): CompilerCaptureState {
	const state =
		value !== null && typeof value === 'object' ? FROZEN_CAPTURE_STATES.get(value) : undefined;
	if (state === undefined)
		fail(
			'INVALID_CAPTURE',
			'Compiler input recheck requires the exact finalized capture capability.'
		);
	return state;
}

function verifiedState(value: unknown): CompilerCaptureState {
	const state =
		value !== null && typeof value === 'object' ? VERIFIED_CAPTURE_STATES.get(value) : undefined;
	if (state === undefined)
		fail(
			'INVALID_CAPTURE',
			'Compiler input replay requires the exact verified capture capability.'
		);
	return state;
}

function assertVerifiedSnapshotBinding(
	state: CompilerCaptureState,
	subject: FrozenSubject,
	binding: VerifiedCompilerCaptureSnapshotBinding
): void {
	if (state.subject !== subject)
		fail(
			'INVALID_CAPTURE',
			'Verified compiler input lookup requires the exact captured FrozenSubject capability.'
		);
	if (
		binding.subjectId !== subject.descriptor.subjectId ||
		binding.contextDigest !== state.closureDigest ||
		binding.contextDigest !== compilerInputClosureDigest(binding.compilerInputs) ||
		canonicalSemanticJson(binding.compilerInputs) !== canonicalSemanticJson(state.observations)
	)
		fail(
			'INVALID_CAPTURE',
			'Verified compiler capture does not reproduce the exact semantic snapshot context closure.'
		);
}

/** @internal Proves the exact subject and global semantic-context binding without live reads. */
export function assertVerifiedCompilerCaptureSnapshotBinding(
	subject: FrozenSubject,
	capture: VerifiedCompilerCapture,
	binding: VerifiedCompilerCaptureSnapshotBinding
): void {
	assertVerifiedSnapshotBinding(verifiedState(capture), subject, binding);
}

function copyVerifiedProjectInputBytes(
	bytes: Uint8Array | undefined,
	onProgress?: () => void
): Uint8Array | undefined {
	onProgress?.();
	if (bytes === undefined) return undefined;
	const copy = new Uint8Array(bytes.byteLength);
	for (let offset = 0; offset < bytes.byteLength; offset += 256) {
		onProgress?.();
		const end = Math.min(offset + 256, bytes.byteLength);
		copy.set(bytes.subarray(offset, end), offset);
	}
	onProgress?.();
	return copy;
}

function materializeVerifiedProjectInputEntry(
	entry: CapturedCompilerInput,
	attributedInvocationCount: number,
	onProgress?: () => void
): VerifiedCompilerProjectInputEntry {
	const bytes = copyVerifiedProjectInputBytes(entry.bytes, onProgress);
	return Object.freeze({
		attributedInvocationCount,
		...(bytes === undefined ? {} : { bytes }),
		observation: entry.observation,
		query: entry.query
	});
}

function borrowedVerifiedProjectInputEntry(
	entry: CapturedCompilerInput,
	attributedInvocationCount: number
): BorrowedVerifiedCompilerProjectInputEntry {
	return Object.freeze({
		attributedInvocationCount,
		...(entry.bytes === undefined ? {} : { bytes: entry.bytes }),
		observation: entry.observation,
		query: entry.query
	});
}

interface AttributedCompilerEntry {
	readonly entry: CapturedCompilerInput;
	readonly invocationCount: number;
	readonly query: CompilerInputQuery;
}

function indexVerifiedCaptureEntryBuckets(
	entries: readonly CapturedCompilerInput[]
): Map<string, CapturedCompilerInput[]> {
	const entriesByQueryBucket = new Map<string, CapturedCompilerInput[]>();
	for (const entry of entries) {
		const bucketKey = verifiedCompilerInputQueryBucketKey(entry.query);
		const bucket = entriesByQueryBucket.get(bucketKey) ?? [];
		if (exactVerifiedCompilerInputQueryBucketEntry(bucket, entry.query) !== undefined)
			fail('INVALID_CAPTURE', 'Verified compiler capture repeats an exact compiler query.');
		bucket.push(entry);
		entriesByQueryBucket.set(bucketKey, bucket);
	}
	return entriesByQueryBucket;
}

function verifiedProjectAttributionBinds(
	attribution: CompilerProjectAttribution,
	projectBinding: VerifiedCompilerProjectInputProjectionBinding
): boolean {
	return (
		attribution.materializedRecipeDigest === projectBinding.materializedRecipeDigest &&
		attribution.projectResolutionDigest === projectBinding.projectResolutionDigest &&
		canonicalSemanticJson(attribution.contextInputIds) ===
			canonicalSemanticJson(projectBinding.contextInputIds)
	);
}

function requireVerifiedProjectAttribution(
	attributionsByProject: ReadonlyMap<string, CompilerProjectAttribution>,
	projectBinding: VerifiedCompilerProjectInputProjectionBinding
): CompilerProjectAttribution {
	const attribution = attributionsByProject.get(projectBinding.configPath);
	if (attribution !== undefined && verifiedProjectAttributionBinds(attribution, projectBinding))
		return attribution;
	return fail(
		'INVALID_CAPTURE',
		`Verified compiler capture does not reproduce project attribution ${projectBinding.configPath}.`
	);
}

function assertVerifiedProjectProgramContext(
	contextIds: ReadonlySet<SemanticContextInputId>,
	observationsById: ReadonlyMap<SemanticContextInputId, CompilerInputObservation>,
	projectBinding: VerifiedCompilerProjectInputProjectionBinding
): void {
	const projectObservations: CompilerInputObservation[] = [];
	for (const id of contextIds) {
		const observation = observationsById.get(id);
		if (observation !== undefined) projectObservations.push(observation);
	}
	if (
		projectObservations.length !== contextIds.size ||
		compilerInputClosureDigest(projectObservations) !== projectBinding.programContextDigest
	)
		fail(
			'INVALID_CAPTURE',
			`Verified compiler capture does not reproduce program context ${projectBinding.configPath}.`
		);
}

function indexAttributedEntryBuckets(
	attribution: CompilerProjectAttribution,
	entriesByQueryBucket: ReadonlyMap<string, CapturedCompilerInput[]>,
	configPath: string
): Map<string, AttributedCompilerEntry[]> {
	const attributedEntryBuckets = new Map<string, AttributedCompilerEntry[]>();
	for (const queryAttribution of attribution.queryInvocations) {
		const bucketKey = verifiedCompilerInputQueryBucketKey(queryAttribution.query);
		const entry = exactVerifiedCompilerInputQueryBucketEntry(
			entriesByQueryBucket.get(bucketKey),
			queryAttribution.query
		);
		if (entry === undefined)
			fail(
				'INVALID_CAPTURE',
				`Verified project attribution references an absent compiler query ${configPath}.`
			);
		const bucket = attributedEntryBuckets.get(bucketKey) ?? [];
		if (exactVerifiedCompilerInputQueryBucketEntry(bucket, queryAttribution.query) !== undefined)
			fail(
				'INVALID_CAPTURE',
				`Verified project attribution repeats a compiler query ${configPath}.`
			);
		bucket.push(
			Object.freeze({
				entry,
				invocationCount: queryAttribution.invocationCount,
				query: entry.query
			})
		);
		attributedEntryBuckets.set(bucketKey, bucket);
	}
	return attributedEntryBuckets;
}

/**
 * @internal Opens project-scoped, non-consuming views after proving the shared capture/snapshot
 * closure once. Global observations and queries are indexed once; each project then traverses only
 * its attributed IDs and query invocations.
 */
export function createVerifiedCompilerProjectInputLookupSet(
	subject: FrozenSubject,
	capture: VerifiedCompilerCapture,
	binding: VerifiedCompilerProjectInputLookupSetBinding
): readonly VerifiedCompilerProjectInputLookupSetEntry[] {
	const state = verifiedState(capture);
	assertVerifiedSnapshotBinding(state, subject, binding);
	const attributionsByProject = new Map(
		state.projectAttributions.map((attribution) => [attribution.projectKey, attribution] as const)
	);
	const observationsById = new Map(
		state.observations.map((observation) => [observation.id, observation] as const)
	);
	const entriesByQueryBucket = indexVerifiedCaptureEntryBuckets(state.entries);
	const lookupLimits = Object.freeze({
		deadlineMs: Number.MAX_SAFE_INTEGER,
		maxDirectoryEntries: state.budgets.maxDirectoryEntries,
		maxPathCharacters: state.budgets.maxPathCharacters,
		maxQueryMetadataBytes: state.budgets.maxCompilerInputMetadataBytes
	});
	const opened = new Set<string>();
	const lookups: VerifiedCompilerProjectInputLookupSetEntry[] = [];
	for (const projectBinding of binding.projects) {
		if (opened.has(projectBinding.configPath))
			fail(
				'INVALID_CAPTURE',
				`Verified compiler lookup binding repeats project ${projectBinding.configPath}.`
			);
		opened.add(projectBinding.configPath);
		const attribution = requireVerifiedProjectAttribution(attributionsByProject, projectBinding);
		assertVerifiedProjectProgramContext(
			new Set(attribution.contextInputIds),
			observationsById,
			projectBinding
		);
		const attributedEntryBuckets = indexAttributedEntryBuckets(
			attribution,
			entriesByQueryBucket,
			projectBinding.configPath
		);
		const locateAttributed = (
			queryValue: CompilerInputQuery,
			onProgress?: () => void
		): AttributedCompilerEntry | undefined => {
			onProgress?.();
			const query = normalizeCompilerInputQuery(queryValue, state.paths, {
				...lookupLimits,
				onProgress
			});
			const bucketKey = verifiedCompilerInputQueryBucketKey(query, onProgress);
			return exactVerifiedCompilerInputQueryBucketEntry(
				attributedEntryBuckets.get(bucketKey),
				query,
				onProgress
			);
		};
		const lookup: VerifiedCompilerProjectInputLookup = Object.freeze({
			attribution,
			lookupAttributedQuery(queryValue: CompilerInputQuery, onProgress?: () => void) {
				const attributed = locateAttributed(queryValue, onProgress);
				return attributed === undefined
					? undefined
					: materializeVerifiedProjectInputEntry(
							attributed.entry,
							attributed.invocationCount,
							onProgress
						);
			},
			withAttributedQueryForVerifiedHost(
				queryValue: CompilerInputQuery,
				onProgress: () => void,
				consumer: (entry: BorrowedVerifiedCompilerProjectInputEntry) => void
			) {
				const attributed = locateAttributed(queryValue, onProgress);
				if (attributed === undefined) return false;
				onProgress();
				consumer(borrowedVerifiedProjectInputEntry(attributed.entry, attributed.invocationCount));
				onProgress();
				return true;
			},
			subjectId: subject.descriptor.subjectId,
			toRecordedAbsolute(logicalPath: string) {
				return state.paths.toRecordedAbsolute(logicalPath);
			},
			toRecordedLogical(path: string) {
				return state.paths.toRecordedLogical(path);
			}
		});
		lookups.push(Object.freeze({ configPath: projectBinding.configPath, lookup }));
	}
	return Object.freeze(lookups);
}

/**
 * @internal Opens one project-scoped view. Bulk callers should use the lookup-set API so shared
 * capture proof and global indexes are constructed once.
 */
export function createVerifiedCompilerProjectInputLookup(
	subject: FrozenSubject,
	capture: VerifiedCompilerCapture,
	binding: VerifiedCompilerProjectInputBinding
): VerifiedCompilerProjectInputLookup {
	const lookups = createVerifiedCompilerProjectInputLookupSet(subject, capture, {
		compilerInputs: binding.compilerInputs,
		contextDigest: binding.contextDigest,
		projects: [binding],
		subjectId: binding.subjectId
	});
	const lookup = lookups[0]?.lookup;
	if (lookup === undefined)
		fail('INVALID_CAPTURE', 'Verified compiler project lookup could not be opened.');
	return lookup;
}

interface CompilerInputOperationBudgetWitnessState {
	readonly binding: StaticSemanticOperationBudgetProviderBinding;
	readonly budgetsDigest: string;
	consumed: boolean;
	readonly evidence: CompilerInputOperationBudgetEvidence;
}

const COMPILER_INPUT_OPERATION_BUDGET_WITNESS_STATES = new WeakMap<
	object,
	CompilerInputOperationBudgetWitnessState
>();
const FROZEN_CAPTURE_OPERATION_BUDGET_WITNESSES = new WeakMap<
	object,
	CompilerInputOperationBudgetWitness
>();
const REPLAY_OPERATION_BUDGET_WITNESSES = new WeakMap<
	object,
	CompilerInputOperationBudgetWitness
>();

interface CompletedReplayOperationBudgetSource {
	readonly actualAttributions: readonly CompilerProjectAttribution[];
	readonly captureState: CompilerCaptureState;
}

const COMPLETED_REPLAY_OPERATION_BUDGET_SOURCES = new WeakMap<
	object,
	CompletedReplayOperationBudgetSource
>();

function compilerInputOperationBudgetEvidence(
	state: CompilerCaptureState,
	phase: 'CAPTURE' | 'RECHECK',
	queryAttributions: readonly CompilerProjectAttribution[]
): CompilerInputOperationBudgetEvidence {
	const projects = state.projectAttributions
		.map((attribution) => attribution.projectKey)
		.sort(compareText);
	const compilerInputs = state.entries
		.map((entry) => compilerInputQueryKey(entry.query))
		.sort(compareText);
	const liveContext = state.observations
		.filter(
			(
				observation
			): observation is Extract<
				CompilerInputObservation,
				{ operation: 'READ_FILE'; result: 'PRESENT' }
			> =>
				observation.operation === 'READ_FILE' &&
				observation.result === 'PRESENT' &&
				observation.byteBudgetClass === 'LIVE_COMPILER_CONTEXT'
		)
		.sort((left, right) => compareText(left.id, right.id));
	const directoryContributions = state.observations
		.flatMap((observation) =>
			'scannedEntries' in observation && observation.scannedEntries > 0
				? [{ amount: observation.scannedEntries, key: observation.id }]
				: []
		)
		.sort((left, right) => compareText(left.key, right.key));
	const populationClaims: readonly SemanticOperationPopulationClaimInput[] = [
		{ members: projects, mode: 'COUNT', phase, population: 'PROJECTS' },
		{ members: compilerInputs, mode: 'COUNT', phase, population: 'COMPILER_INPUTS' },
		{
			contributions: [
				{
					amount: Buffer.byteLength(canonicalSemanticJson(state.observations), 'utf8'),
					key: 'canonical-compiler-input-array'
				}
			],
			mode: 'SUM',
			phase,
			population: 'COMPILER_INPUT_METADATA_BYTES'
		},
		{
			members: liveContext.map((observation) => observation.id),
			mode: 'COUNT',
			phase,
			population: 'CONTEXT_FILES'
		},
		{
			contributions: liveContext.flatMap((observation) =>
				observation.contentBytes > 0
					? [{ amount: observation.contentBytes, key: observation.id }]
					: []
			),
			mode: 'SUM',
			phase,
			population: 'CONTEXT_BYTES'
		},
		{
			contributions: directoryContributions,
			mode: 'SUM',
			phase,
			population: 'DIRECTORY_ENTRIES'
		}
	];
	const queryCharges: readonly CompilerInputOperationBudgetQueryCharge[] = queryAttributions
		.flatMap((attribution) =>
			attribution.queryInvocations.map((query) => ({
				invocationCount: query.invocationCount,
				projectKey: attribution.projectKey,
				queryKey: compilerInputQueryKey(query.query)
			}))
		)
		.sort(
			(left, right) =>
				compareText(left.projectKey, right.projectKey) || compareText(left.queryKey, right.queryKey)
		);
	return freezeWire(
		structuredClone({ phase, populationClaims, queryCharges })
	) as CompilerInputOperationBudgetEvidence;
}

function issueCompilerInputOperationBudgetWitness(
	capability: object,
	state: CompilerCaptureState,
	binding: StaticSemanticOperationBudgetProviderBinding,
	phase: 'CAPTURE' | 'RECHECK',
	issued: WeakMap<object, CompilerInputOperationBudgetWitness>,
	queryAttributions: readonly CompilerProjectAttribution[]
): CompilerInputOperationBudgetWitness {
	if (
		binding === null ||
		typeof binding !== 'object' ||
		isProxy(binding) ||
		Object.getPrototypeOf(binding) !== null ||
		!Object.isFrozen(binding) ||
		Reflect.ownKeys(binding).length !== 0
	)
		fail('INVALID_CAPTURE', 'Compiler-input budget witness requires an opaque operation binding.');
	const existing = issued.get(capability);
	if (existing !== undefined) return existing;
	const witness = Object.freeze(Object.create(null)) as CompilerInputOperationBudgetWitness;
	COMPILER_INPUT_OPERATION_BUDGET_WITNESS_STATES.set(witness, {
		binding,
		budgetsDigest: sha256(canonicalSemanticJson(state.budgets)),
		consumed: false,
		evidence: compilerInputOperationBudgetEvidence(state, phase, queryAttributions)
	});
	issued.set(capability, witness);
	return witness;
}

export function issueFrozenCompilerCaptureOperationBudgetWitness(
	binding: StaticSemanticOperationBudgetProviderBinding,
	capture: FrozenCompilerCapture
): CompilerInputOperationBudgetWitness {
	const state = frozenState(capture);
	return issueCompilerInputOperationBudgetWitness(
		capture,
		state,
		binding,
		'CAPTURE',
		FROZEN_CAPTURE_OPERATION_BUDGET_WITNESSES,
		state.projectAttributions
	);
}

/** @internal Consumed only by the fixed semantic operation budget session. */
export function takeCompilerInputOperationBudgetWitness(
	witness: CompilerInputOperationBudgetWitness,
	binding: StaticSemanticOperationBudgetProviderBinding,
	expectedPhase: 'CAPTURE' | 'RECHECK',
	expectedBudgetsDigest: string
): CompilerInputOperationBudgetEvidence {
	const state =
		witness !== null && typeof witness === 'object'
			? COMPILER_INPUT_OPERATION_BUDGET_WITNESS_STATES.get(witness)
			: undefined;
	if (state === undefined)
		fail('INVALID_CAPTURE', 'Compiler-input operation budget witness is not provider-issued.');
	if (
		state.binding !== binding ||
		state.evidence.phase !== expectedPhase ||
		state.budgetsDigest !== expectedBudgetsDigest
	)
		fail(
			'INVALID_CAPTURE',
			'Compiler-input operation budget witness does not bind the exact session, phase, and budgets.'
		);
	if (state.consumed)
		fail('INVALID_CAPTURE', 'Compiler-input operation budget witness is single-use.');
	state.consumed = true;
	return state.evidence;
}

function validateFinalizedState(
	state: CompilerCaptureState,
	deadlineMs: number
): readonly CapturedCompilerInput[] {
	const { entries } = validateJournalEntries(
		state.entries,
		state.paths,
		state.budgets,
		deadlineMs,
		state.clock
	);
	checkDeadline({ clock: state.clock, deadlineMs });
	const observations = entries
		.map((entry) => entry.observation)
		.sort((left, right) => compareText(left.id, right.id));
	if (
		canonicalSemanticJson(observations) !== canonicalSemanticJson(state.observations) ||
		state.closureDigest !== compilerInputClosureDigest(observations)
	)
		fail(
			'INVALID_CAPTURE',
			'Finalized compiler capture closure does not bind its exact observations.'
		);
	const entriesByQuery = new Map(
		entries.map((entry) => [compilerInputQueryKey(entry.query), entry] as const)
	);
	const projectKeys = new Set<string>();
	const totals = new Map<string, number>();
	for (const attribution of state.projectAttributions) {
		checkDeadline({ clock: state.clock, deadlineMs });
		if (
			projectKeys.has(attribution.projectKey) ||
			!SHA256.test(attribution.materializedRecipeDigest) ||
			!SHA256.test(attribution.projectResolutionDigest)
		)
			fail('INVALID_CAPTURE', 'Finalized compiler project attribution identity is invalid.');
		projectKeys.add(attribution.projectKey);
		const queryKeys = new Set<string>();
		const expectedIds = new Set<SemanticContextInputId>();
		for (const record of attribution.queryInvocations) {
			checkDeadline({ clock: state.clock, deadlineMs });
			const key = compilerInputQueryKey(record.query);
			const entry = entriesByQuery.get(key);
			if (
				entry === undefined ||
				queryKeys.has(key) ||
				!Number.isSafeInteger(record.invocationCount) ||
				record.invocationCount < 1
			)
				fail('INVALID_CAPTURE', 'Finalized compiler project attribution query is invalid.');
			queryKeys.add(key);
			expectedIds.add(entry.observation.id);
			totals.set(key, (totals.get(key) ?? 0) + record.invocationCount);
		}
		const expectedContextInputIds = [...expectedIds].sort(compareText);
		if (
			canonicalSemanticJson(expectedContextInputIds) !==
			canonicalSemanticJson(attribution.contextInputIds)
		)
			fail(
				'INVALID_CAPTURE',
				'Finalized compiler project context-input identities do not bind its exact queries.'
			);
	}
	for (const [key, entry] of entriesByQuery)
		if ((totals.get(key) ?? 0) !== entry.observation.invocationCount)
			fail(
				'INVALID_CAPTURE',
				'Finalized compiler project attribution does not reconcile global query multiplicity.'
			);
	checkDeadline({ clock: state.clock, deadlineMs });
	return entries;
}

function assertAliasTopology(state: CompilerCaptureState): void {
	try {
		if (!state.paths.assertWorkspaceAliasTopologyUnchanged())
			fail('CONTEXT_CHANGED', 'Workspace alias topology changed after compiler-input capture.');
	} catch (error) {
		if (error instanceof CompilerInputCaptureError && error.code === 'CONTEXT_CHANGED') throw error;
		if (error instanceof CompilerPathError)
			fail('CONTEXT_CHANGED', 'Workspace alias topology changed after compiler-input capture.');
		throw error;
	}
}

export function recheckCompilerInputJournal(
	captureValue: FrozenCompilerCapture
): VerifiedCompilerCapture {
	const state = frozenState(captureValue);
	const deadlineMs = state.startedAtMs + state.budgets.maxDurationMs;
	if (!Number.isSafeInteger(state.startedAtMs) || !Number.isSafeInteger(deadlineMs))
		fail('BUDGET_EXCEEDED', 'Compiler input recheck deadline is invalid.');
	checkDeadline({ clock: state.clock, deadlineMs });
	const entries = validateFinalizedState(state, deadlineMs);
	checkDeadline({ clock: state.clock, deadlineMs });
	assertAliasTopology(state);
	checkDeadline({ clock: state.clock, deadlineMs });
	let directoryEntries = 0;
	let contextBytes = 0;
	let contextFiles = 0;
	for (const expected of entries) {
		checkDeadline({ clock: state.clock, deadlineMs });
		const frozenRead =
			expected.observation.operation === 'READ_FILE' &&
			expected.observation.result === 'PRESENT' &&
			expected.observation.byteBudgetClass === 'FROZEN_SUBJECT';
		const actualOne = state.reader.observe(expected.query, {
			allowPresentRead: frozenRead || contextFiles < state.budgets.maxContextFiles,
			clock: state.clock,
			deadlineMs,
			maxDirectoryEntries: state.budgets.maxDirectoryEntries - directoryEntries,
			maxPathCharacters: state.budgets.maxPathCharacters,
			maxQueryMetadataBytes: state.budgets.maxCompilerInputMetadataBytes,
			maxReadBytes: Math.min(
				state.budgets.maxContextFileBytes,
				state.budgets.maxContextBytes - contextBytes
			)
		});
		const actual = withInvocationCount(
			state.subject.descriptor.subjectId,
			actualOne,
			expected.observation.invocationCount
		);
		directoryEntries +=
			'scannedEntries' in actual.observation ? actual.observation.scannedEntries : 0;
		if (
			actual.observation.operation === 'READ_FILE' &&
			actual.observation.result === 'PRESENT' &&
			actual.observation.byteBudgetClass === 'LIVE_COMPILER_CONTEXT'
		) {
			contextFiles += 1;
			contextBytes += actual.observation.contentBytes;
			if (
				contextFiles > state.budgets.maxContextFiles ||
				contextBytes > state.budgets.maxContextBytes
			)
				fail(
					'BUDGET_EXCEEDED',
					'Compiler input recheck exceeded its live-context file or byte budget.'
				);
		}
		if (
			canonicalSemanticJson(actual.observation) !== canonicalSemanticJson(expected.observation) ||
			(actual.bytes === undefined) !== (expected.bytes === undefined) ||
			(actual.bytes !== undefined &&
				expected.bytes !== undefined &&
				sha256(actual.bytes) !== sha256(expected.bytes))
		) {
			fail(
				'CONTEXT_CHANGED',
				`Compiler input changed between capture and replay: ${expected.observation.logicalPath}.`
			);
		}
		checkDeadline({ clock: state.clock, deadlineMs });
	}
	checkDeadline({ clock: state.clock, deadlineMs });
	assertAliasTopology(state);
	checkDeadline({ clock: state.clock, deadlineMs });
	const capture = createVerifiedCompilerCapture(state);
	checkDeadline({ clock: state.clock, deadlineMs });
	return capture;
}

export class ReplayCompilerInputJournal {
	private readonly attributions = new ProjectAttributionTracker();
	private readonly captureState: CompilerCaptureState;
	private readonly consumedByQuery = new Map<string, number>();
	private readonly entriesByQuery = new Map<string, CapturedCompilerInput>();
	private readonly budgets: SemanticBudgets;
	private readonly clock: SemanticOperationClock;
	private readonly deadlineMs: number;
	private finalized = false;
	private poisoned = false;
	private readonly paths: FrozenCompilerPathResolver;
	private replayCalls = 0;
	private registeredProjects = 0;
	private readonly expectedAttributions: readonly CompilerProjectAttribution[];

	constructor(subject: FrozenSubject, captureValue: VerifiedCompilerCapture) {
		const state = verifiedState(captureValue);
		if (state.subject !== subject)
			fail('INVALID_CAPTURE', 'Replay requires the exact FrozenSubject bound by verified capture.');
		this.budgets = state.budgets;
		this.clock = state.clock;
		this.captureState = state;
		this.paths = state.paths;
		this.expectedAttributions = state.projectAttributions;
		this.deadlineMs = state.startedAtMs + this.budgets.maxDurationMs;
		if (!Number.isSafeInteger(state.startedAtMs) || !Number.isSafeInteger(this.deadlineMs))
			fail('BUDGET_EXCEEDED', 'Replay deadline is invalid.');
		checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
		const entries = validateFinalizedState(state, this.deadlineMs);
		checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
		for (const entry of entries) {
			checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
			this.entriesByQuery.set(compilerInputQueryKey(entry.query), entry);
		}
		checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
	}

	get maxProjects(): number {
		return this.budgets.maxProjects;
	}

	get semanticBudgets(): SemanticBudgets {
		return this.budgets;
	}

	get repositoryRoot(): string {
		return this.paths.repositoryRoot;
	}

	assertWithinDeadline(): void {
		checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
	}

	toRecordedAbsolute(logicalPath: string): string {
		return this.paths.toRecordedAbsolute(logicalPath);
	}

	toRecordedLogical(path: string): string {
		return this.paths.toRecordedLogical(path);
	}

	workspaceAliasRoots(): readonly string[] {
		return this.paths.workspaceAliasRoots();
	}

	registerProject(
		projectKey: string,
		recipe: ProgramRecipe,
		materialized: MaterializedProgramRecipe
	): void {
		if (this.finalized) fail('INVALID_CAPTURE', 'Compiler input replay is already finalized.');
		checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
		if (this.registeredProjects >= this.budgets.maxProjects)
			fail('BUDGET_EXCEEDED', 'Compiler input replay exceeded its project budget.');
		if (typeof projectKey !== 'string' || projectKey.length === 0)
			fail('INVALID_QUERY', 'Compiler project attribution key is invalid.');
		if (projectKey.length > this.budgets.maxPathCharacters)
			fail(
				'BUDGET_EXCEEDED',
				'Compiler project attribution key exceeds its path-character budget.'
			);
		const identity = compilerProjectIdentity(recipe, materialized, this.budgets.maxPathCharacters);
		checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
		if (projectKey !== identity.projectKey)
			fail(
				'INVALID_QUERY',
				'Replay project attribution key must equal the authoritative ProgramRecipe config path.'
			);
		const expected = this.expectedAttributions.find(
			(attribution) => attribution.projectKey === projectKey
		);
		if (expected === undefined || !attributionBindsRecipeIdentity(expected, identity))
			fail(
				'INVALID_CAPTURE',
				`Replay compiler recipe identity does not reproduce capture for ${projectKey}.`
			);
		checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
		this.attributions.registerProject(
			projectKey,
			identity.projectResolutionDigest,
			identity.materializedRecipeDigest
		);
		this.registeredProjects += 1;
	}

	replay(queryValue: CompilerInputQuery, projectKey: string): CapturedCompilerInput {
		try {
			return this.replayActive(queryValue, projectKey);
		} catch (error) {
			this.poisoned = true;
			throw error;
		}
	}

	assertProjectConsumed(projectKey: string): void {
		try {
			if (this.finalized) fail('INVALID_CAPTURE', 'Compiler input replay is already finalized.');
			if (this.poisoned)
				fail('INVALID_CAPTURE', 'Compiler input replay is poisoned by an earlier failed query.');
			checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
			const expected = this.expectedAttributions.find(
				(attribution) => attribution.projectKey === projectKey
			);
			if (expected === undefined)
				fail('INVALID_CAPTURE', `Replay has no expected project attribution for ${projectKey}.`);
			const actual = this.attributions.entry(projectKey, this.entriesByQuery);
			if (canonicalSemanticJson(actual) !== canonicalSemanticJson(expected))
				fail(
					'UNCONSUMED_QUERY',
					`Replay did not reproduce the exact compiler-query attribution for ${projectKey}.`
				);
			checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
		} catch (error) {
			this.poisoned = true;
			throw error;
		}
	}

	poison(): void {
		this.poisoned = true;
	}

	private replayActive(queryValue: CompilerInputQuery, projectKey: string): CapturedCompilerInput {
		if (this.finalized) fail('INVALID_CAPTURE', 'Compiler input replay is already finalized.');
		if (this.poisoned)
			fail('INVALID_CAPTURE', 'Compiler input replay is poisoned by an earlier failed query.');
		checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
		if (projectKey.length === 0 || projectKey.length > this.budgets.maxPathCharacters)
			fail('INVALID_QUERY', 'Compiler project attribution key is invalid.');
		const query = normalizeCompilerInputQuery(queryValue, this.paths, {
			clock: this.clock,
			deadlineMs: this.deadlineMs,
			maxDirectoryEntries: this.budgets.maxDirectoryEntries,
			maxPathCharacters: this.budgets.maxPathCharacters,
			maxQueryMetadataBytes: this.budgets.maxCompilerInputMetadataBytes
		});
		const key = compilerInputQueryKey(query);
		const captured = this.entriesByQuery.get(key);
		if (captured === undefined)
			fail(
				'UNRECORDED_QUERY',
				`Replay attempted an unrecorded ${query.operation} query for ${query.logicalPath}.`
			);
		const consumed = this.consumedByQuery.get(key) ?? 0;
		if (consumed >= captured.observation.invocationCount)
			fail(
				'UNRECORDED_QUERY',
				`Replay exceeded captured multiplicity for ${query.operation} ${query.logicalPath}.`
			);
		this.replayCalls += 1;
		if (this.replayCalls > this.budgets.maxCompilerQueryInvocations)
			fail('BUDGET_EXCEEDED', 'Replay host exceeded its query-invocation budget.');
		this.consumedByQuery.set(key, consumed + 1);
		this.attributions.record(projectKey, query);
		const result = cloneCaptured(captured);
		checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
		return result;
	}

	assertFullyConsumed(): void {
		try {
			if (this.finalized) return;
			if (this.poisoned)
				fail('INVALID_CAPTURE', 'Compiler input replay is poisoned by an earlier failed query.');
			checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
			const mismatches = [...this.entriesByQuery.entries()].filter(
				([key, entry]) => (this.consumedByQuery.get(key) ?? 0) !== entry.observation.invocationCount
			);
			checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
			if (mismatches.length > 0)
				fail(
					'UNCONSUMED_QUERY',
					`Replay did not reproduce the exact multiplicity of ${mismatches.length} captured compiler queries.`
				);
			const actualAttributions = this.attributions.entries(this.entriesByQuery);
			checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
			if (
				canonicalSemanticJson(actualAttributions) !==
				canonicalSemanticJson(this.expectedAttributions)
			)
				fail(
					'INVALID_CAPTURE',
					'Replay per-project compiler-query attribution does not reproduce capture.'
				);
			checkDeadline({ clock: this.clock, deadlineMs: this.deadlineMs });
			this.finalized = true;
			COMPLETED_REPLAY_OPERATION_BUDGET_SOURCES.set(this, {
				actualAttributions,
				captureState: this.captureState
			});
		} catch (error) {
			this.poisoned = true;
			throw error;
		}
	}
}

/** @internal Issued only after exact replay consumption has been proved. */
export function issueReplayCompilerInputOperationBudgetWitness(
	binding: StaticSemanticOperationBudgetProviderBinding,
	replay: ReplayCompilerInputJournal
): CompilerInputOperationBudgetWitness {
	const source =
		replay !== null && typeof replay === 'object'
			? COMPLETED_REPLAY_OPERATION_BUDGET_SOURCES.get(replay)
			: undefined;
	if (source === undefined)
		fail(
			'INVALID_CAPTURE',
			'RECHECK CompilerHost budget witness requires the exact fully consumed replay capability.'
		);
	return issueCompilerInputOperationBudgetWitness(
		replay,
		source.captureState,
		binding,
		'RECHECK',
		REPLAY_OPERATION_BUDGET_WITNESSES,
		source.actualAttributions
	);
}
