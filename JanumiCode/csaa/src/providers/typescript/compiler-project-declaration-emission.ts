import { createHash } from 'node:crypto';
import { isProxy } from 'node:util/types';

import ts from 'typescript';

import type {
	CompilerInputObservation,
	SemanticProgramId,
	SemanticProjectId,
	SemanticSourceId,
	SemanticSourceTransformationRecord,
	SourceOrigin,
	StaticSemanticSnapshot
} from '../../contracts/semantic.js';
import { TYPESCRIPT_PROVIDER_VERSION } from '../../contracts/semantic.js';
import type { SourceOriginProgramSourceIdentity } from '../../contracts/source-origin-correlation.js';
import type { FrozenSubject } from '../../contracts/subject.js';
import {
	canonicalSemanticJson,
	canonicalSemanticJsonWitnessWithProgress,
	isUnicodeScalarString
} from '../../semantic/canonical.js';
import {
	COMPILER_PROJECT_PROGRAM_CAPABILITY_VERSION,
	CompilerProjectProgramCapabilityError,
	createCompilerProjectProgramSession,
	type CompilerProjectProgramEvidence,
	type CompilerProjectProgramInputRecord,
	type CompilerProjectProgramLimits,
	type CompilerProjectProgramRuntimeOptions,
	type CompilerProjectProgramSession
} from '../../semantic/compiler-project-program-capability.js';
import { createMonotonicOperationClock } from '../../semantic/monotonic-operation-clock.js';
import {
	sourceOriginProgramInputAttemptPopulationDigest,
	sourceOriginProgramSourcePopulationDigest
} from '../../semantic/source-origin-correlation-canonical.js';
import { isFrozenSubjectCapability } from '../../subject/frozen-store.js';
import {
	SVELTE2TSX_PROVIDER_VERSION,
	SVELTE_PROVIDER_VERSION,
	SVELTE_TYPESCRIPT_PROVIDER_VERSION,
	SVELTE_VIRTUAL_SOURCE_ADAPTER_VERSION,
	SVELTE_VIRTUAL_SOURCE_ID_PROFILE,
	SVELTE_VIRTUAL_SOURCE_IMPLEMENTATION_LIMITS,
	SVELTE_VIRTUAL_SOURCE_SCHEMA_VERSION,
	SVELTE_VIRTUAL_SOURCE_TRANSFORM_PROFILE,
	svelteVirtualLogicalPath
} from '../svelte/svelte-virtual-source.js';
import { STRICT_SOURCE_MAP_V3_DECODER_VERSION } from '../source-map/decode-source-map-v3.js';
import type { CompilerInputQuery } from './compiler-input-journal.js';

export const COMPILER_PROJECT_DECLARATION_EMISSION_VERSION =
	'jan-csaa-compiler-project-declaration-emission/1.0.0' as const;

export interface CompilerProjectDeclarationEmissionInputs {
	readonly compilerProgramLimits: CompilerProjectProgramLimits;
	readonly frozenSubject: FrozenSubject;
	readonly logicalPath: string;
	readonly semanticProgramId: SemanticProgramId;
	readonly semanticProjectId: SemanticProjectId;
	readonly semanticSnapshot: StaticSemanticSnapshot;
	readonly semanticSourceId: SemanticSourceId;
}

export interface CompilerProjectDeclarationEmissionLimits {
	readonly maxDurationMs: number;
	readonly maxInputRecords: number;
	readonly maxOutputBytes: number;
	readonly maxOutputFiles: number;
	readonly maxOutputStringCharacters: number;
	readonly maxPathCharacters: number;
	readonly maxProgramSourceFiles: number;
	readonly maxReadBytes: number;
	readonly maxTraversalSteps: number;
}

export interface CompilerProjectDeclarationEmissionRuntimeOptions extends CompilerProjectProgramRuntimeOptions {
	/** An internal fail-closed hook invoked at bounded work and public-provider boundaries. */
	readonly checkpoint?: () => void;
}

export interface CompilerProjectDeclarationMaterializedSource {
	readonly contentBytes: number;
	readonly contentSha256: string;
	readonly logicalPath: string;
	readonly semanticProgramId: SemanticProgramId;
	readonly semanticProjectId: SemanticProjectId;
	readonly semanticSourceId: SemanticSourceId;
	readonly text: string;
	readonly textLength: number;
}

export interface CompilerProjectDeclarationOutput {
	readonly bytes: number;
	readonly content: string;
	readonly contentSha256: string;
	readonly kind: 'DECLARATION' | 'DECLARATION_MAP';
	readonly logicalPath: string;
	readonly sourceLogicalPath: string;
	readonly textLength: number;
	readonly writeByteOrderMark: false;
}

export interface CompilerProjectDeclarationEmissionWitness {
	readonly attributedCompilerInputAttempts: number;
	readonly attributedProgramReadBytes: number;
	readonly attributedUniqueQueries: number;
	readonly captureContextDigest: string;
	readonly compilerOptionsDigest: string;
	readonly compilerVersion: string;
	readonly configPath: string;
	readonly declarationEmitCallbacksUseOnlyAttributedQueries: true;
	readonly declarationEmitCompilerInputAttempts: number;
	readonly declarationEmitReadBytes: number;
	readonly emitApi: 'TYPESCRIPT_PUBLIC_PROGRAM_EMIT';
	readonly emitDiagnostics: readonly [];
	readonly emitOnlyDtsFiles: true;
	readonly emitSkipped: false;
	readonly materializedRecipeDigest: string;
	readonly outputs: readonly CompilerProjectDeclarationOutput[];
	readonly programCallbacksWithinAttributedInvocationBounds: true;
	readonly programCompilerInputAttempts: number;
	readonly programInputAttemptPopulationDigest: string;
	readonly programInputAttemptPopulationReconciles: true;
	readonly programPresentReadFileAttempts: number;
	readonly programReadBytes: number;
	readonly programSourceFiles: number;
	readonly programSourceFilePopulationReconciles: true;
	readonly programSourcePopulationDigest: string;
	readonly projectResolutionDigest: string;
	readonly semanticProgramId: SemanticProgramId;
	readonly semanticProjectId: SemanticProjectId;
	readonly semanticSourceId: SemanticSourceId;
	readonly selectedSourceLogicalPath: string;
	readonly state: 'FRESH_PUBLIC_TYPESCRIPT_DECLARATION_EMISSION_OVER_VERIFIED_PROJECT_SCOPED_CAPTURE';
}

export interface CompilerProjectDeclarationEmission {
	readonly emissionWitness: CompilerProjectDeclarationEmissionWitness;
	readonly materializedSource: CompilerProjectDeclarationMaterializedSource;
	readonly outputs: readonly CompilerProjectDeclarationOutput[];
	readonly selection: Readonly<{
		readonly logicalPath: string;
		readonly semanticProgramId: SemanticProgramId;
		readonly semanticProjectId: SemanticProjectId;
		readonly semanticSourceId: SemanticSourceId;
	}>;
	readonly version: typeof COMPILER_PROJECT_DECLARATION_EMISSION_VERSION;
}

export class CompilerProjectDeclarationEmissionError extends Error {
	constructor(
		readonly code:
			| 'BUDGET_EXCEEDED'
			| 'CAPTURE_UNAVAILABLE'
			| 'EMIT_UNAVAILABLE'
			| 'INPUT_INVALID'
			| 'OPTIONS_UNSUPPORTED'
			| 'PROVIDER_FAILURE'
			| 'SELECTION_UNAVAILABLE',
		message: string
	) {
		super(message);
		this.name = 'CompilerProjectDeclarationEmissionError';
	}
}

type DeclarationWriteFile = (
	fileName: string,
	data: string,
	writeByteOrderMark: boolean,
	onError?: (message: string) => void,
	sourceFiles?: readonly ts.SourceFile[]
) => void;

/** @internal Mutable only so focused tests can replace exact public TypeScript calls. */
export const compilerProjectDeclarationEmissionTypeScriptPublicApi = {
	emit(
		program: ts.Program,
		sourceFile: ts.SourceFile,
		writeFile: DeclarationWriteFile
	): ts.EmitResult {
		return program.emit(sourceFile, writeFile, undefined, true);
	},
	getCompilerOptions(program: ts.Program): ts.CompilerOptions {
		return program.getCompilerOptions();
	},
	getSourceFiles(program: ts.Program): readonly ts.SourceFile[] {
		return program.getSourceFiles();
	}
};

/** @internal Mutable only so focused tests can replace the exact fresh-Program capability. */
export const compilerProjectDeclarationEmissionCompilerProgramCapability = {
	createCompilerProjectProgramSession
};

const INPUT_KEYS = [
	'compilerProgramLimits',
	'frozenSubject',
	'logicalPath',
	'semanticProgramId',
	'semanticProjectId',
	'semanticSnapshot',
	'semanticSourceId'
] as const;
const EMIT_LIMIT_KEYS = [
	'maxDurationMs',
	'maxInputRecords',
	'maxOutputBytes',
	'maxOutputFiles',
	'maxOutputStringCharacters',
	'maxPathCharacters',
	'maxProgramSourceFiles',
	'maxReadBytes',
	'maxTraversalSteps'
] as const;
const PROGRAM_LIMIT_KEYS = [
	'maxDurationMs',
	'maxProgramInputRecords',
	'maxProgramReadBytes',
	'maxProgramSourceFiles',
	'maxTotalInputRecords',
	'maxTotalReadBytes'
] as const;
const RUNTIME_KEYS = ['checkpoint', 'now', 'onInput'] as const;
const RESOURCE_CHECKPOINT_CADENCE = 256;
const HARD_MAX_PATH_CHARACTERS = 16_384;
const HARD_MAX_IDENTITY_CHARACTERS = 16_384;
const HARD_MAX_PROGRAM_SOURCE_FILES = 100_000;
const HARD_MAX_SNAPSHOT_POPULATION = 1_000_000;
const HARD_MAX_EMITTED_FILES = 2;
const HARD_MAX_OUTPUT_STRING_CHARACTERS = 64 * 1024 * 1024;
const HARD_MAX_OUTPUT_BYTES = 64 * 1024 * 1024;
const HARD_MAX_COMPILER_OPTION_KEYS = 512;
const HARD_MAX_COMPILER_OPTION_DEPTH = 32;
const HARD_MAX_COMPILER_OPTION_ARRAY_LENGTH = 100_000;
const UTF8_HASH_CHUNK_CODE_UNITS = 4_096;

const PROGRAM_EVIDENCE_KEYS = [
	'attributedInputRecords',
	'attributedReadBytes',
	'attributedUniqueQueries',
	'artifactParseInputRecords',
	'artifactParseReadBytes',
	'compilerHostCallbacks',
	'compilerHostReadBytes',
	'configPath',
	'contextInputIds',
	'declarationEmitCallbacksUseOnlyAttributedQueries',
	'declarationEmitInputRecords',
	'declarationEmitReadBytes',
	'inputRecords',
	'materializedRecipeDigest',
	'programCallbacksWithinAttributedInvocationBounds',
	'programCompilerHostCallbacks',
	'programCompilerHostReadBytes',
	'programContextDigest',
	'programSourceFiles',
	'projectResolutionDigest',
	'semanticProgramId',
	'semanticProjectId',
	'state',
	'subjectId',
	'version'
] as const;

const PROGRAM_EVIDENCE_COUNT_KEYS = [
	'attributedInputRecords',
	'attributedReadBytes',
	'attributedUniqueQueries',
	'artifactParseInputRecords',
	'artifactParseReadBytes',
	'compilerHostCallbacks',
	'compilerHostReadBytes',
	'declarationEmitInputRecords',
	'declarationEmitReadBytes',
	'programCompilerHostCallbacks',
	'programCompilerHostReadBytes',
	'programSourceFiles'
] as const;
const SOURCE_ORIGIN_VALUES = Object.freeze({
	AUTHORED: true,
	CONFIGURATION: true,
	EXTERNAL_DECLARATION: true,
	GENERATED: true,
	GENERATED_DECLARATION: true,
	GENERATOR: true,
	SCRIPT: true,
	TEST: true,
	TOOLCHAIN_LIBRARY: true,
	UNKNOWN: true,
	VERIFICATION: true,
	VIRTUAL: true,
	WORKSPACE_BUILD_DECLARATION: true
} satisfies Readonly<Record<SourceOrigin, true>>);

function fail(code: CompilerProjectDeclarationEmissionError['code'], message: string): never {
	throw new CompilerProjectDeclarationEmissionError(code, message);
}

function fixedKeyContains(keys: readonly string[], candidate: string): boolean {
	for (const key of keys) if (key === candidate) return true;
	return false;
}

function safeAddEvidenceAmount(left: number, right: unknown, label: string): number {
	if (
		typeof right !== 'number' ||
		!Number.isSafeInteger(right) ||
		right < 0 ||
		right > Number.MAX_SAFE_INTEGER - left
	)
		fail('CAPTURE_UNAVAILABLE', `${label} is not a nonnegative safe population.`);
	return left + right;
}

function exactPlainObject(
	value: unknown,
	keys: readonly string[],
	label: string
): Readonly<Record<string, unknown>> {
	if (
		value === null ||
		typeof value !== 'object' ||
		Array.isArray(value) ||
		isProxy(value) ||
		(Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
	)
		fail('INPUT_INVALID', `${label} must be an inert plain object.`);
	const ownKeys = Reflect.ownKeys(value);
	if (ownKeys.length !== keys.length)
		fail('INPUT_INVALID', `${label} has an invalid exact key set.`);
	for (const key of ownKeys)
		if (typeof key !== 'string' || !fixedKeyContains(keys, key))
			fail('INPUT_INVALID', `${label} has an invalid exact key set.`);
	const result: Record<string, unknown> = {};
	for (const key of keys) {
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			fail('INPUT_INVALID', `${label}.${key} must be an enumerable data property.`);
		result[key] = descriptor.value;
	}
	return result;
}

type DeclarationEmissionOnInput = NonNullable<CompilerProjectProgramRuntimeOptions['onInput']>;

function optionalRuntimeOptions(value: unknown): CompilerProjectDeclarationEmissionRuntimeOptions {
	if (value === undefined) return Object.freeze({});
	if (
		value === null ||
		typeof value !== 'object' ||
		Array.isArray(value) ||
		isProxy(value) ||
		(Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
	)
		fail('INPUT_INVALID', 'Declaration-emission runtime options must be an inert plain object.');
	const ownKeys = Reflect.ownKeys(value);
	if (ownKeys.length > RUNTIME_KEYS.length)
		fail('INPUT_INVALID', 'Declaration-emission runtime options contain an unknown key.');
	for (const key of ownKeys)
		if (typeof key !== 'string' || !fixedKeyContains(RUNTIME_KEYS, key))
			fail('INPUT_INVALID', 'Declaration-emission runtime options contain an unknown key.');
	const result: {
		checkpoint?: () => void;
		now?: () => number;
		onInput?: DeclarationEmissionOnInput;
	} = {};
	for (const key of ownKeys as string[]) {
		const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
		if (
			!descriptor.enumerable ||
			!('value' in descriptor) ||
			typeof descriptor.value !== 'function'
		)
			fail(
				'INPUT_INVALID',
				`Declaration-emission runtime option ${key} must be an enumerable function.`
			);
		if (key === 'checkpoint') result.checkpoint = descriptor.value as () => void;
		else if (key === 'now') result.now = descriptor.value as () => number;
		else result.onInput = descriptor.value as DeclarationEmissionOnInput;
	}
	return Object.freeze(result);
}

function nonnegativeLimits<Keys extends readonly string[]>(
	value: unknown,
	keys: Keys,
	label: string
): Readonly<Record<Keys[number], number>> {
	const object = exactPlainObject(value, keys, label);
	const result: Record<string, number> = {};
	for (const key of keys) {
		const entry = object[key];
		if (typeof entry !== 'number' || !Number.isSafeInteger(entry) || entry < 0)
			fail('INPUT_INVALID', `${label}.${key} must be a nonnegative safe integer.`);
		result[key] = entry;
	}
	if (result.maxDurationMs === 0) fail('INPUT_INVALID', `${label}.maxDurationMs must be positive.`);
	return Object.freeze(result) as Readonly<Record<Keys[number], number>>;
}

function validateInputs(value: unknown): CompilerProjectDeclarationEmissionInputs {
	const inputs = exactPlainObject(value, INPUT_KEYS, 'Declaration-emission inputs');
	for (const key of [
		'logicalPath',
		'semanticProgramId',
		'semanticProjectId',
		'semanticSourceId'
	] as const) {
		const entry = inputs[key];
		const maximumCharacters =
			key === 'logicalPath' ? HARD_MAX_PATH_CHARACTERS : HARD_MAX_IDENTITY_CHARACTERS;
		if (
			typeof entry !== 'string' ||
			entry.length === 0 ||
			entry.length > maximumCharacters ||
			!isUnicodeScalarString(entry)
		)
			fail(
				'INPUT_INVALID',
				`Declaration-emission ${key} must be a nonempty Unicode-scalar string.`
			);
	}
	const frozenSubject = inputs.frozenSubject;
	if (
		!isFrozenSubjectCapability(frozenSubject) ||
		isProxy(frozenSubject) ||
		!Object.isFrozen(frozenSubject)
	)
		fail(
			'CAPTURE_UNAVAILABLE',
			'Declaration emission requires the exact FrozenSubject capability.'
		);
	const semanticSnapshot = inputs.semanticSnapshot;
	if (
		semanticSnapshot === null ||
		typeof semanticSnapshot !== 'object' ||
		isProxy(semanticSnapshot) ||
		!Object.isFrozen(semanticSnapshot)
	)
		fail(
			'CAPTURE_UNAVAILABLE',
			'Declaration emission requires the exact frozen semantic snapshot.'
		);
	return {
		compilerProgramLimits: nonnegativeLimits(
			inputs.compilerProgramLimits,
			PROGRAM_LIMIT_KEYS,
			'Declaration-emission compiler Program limits'
		) as unknown as CompilerProjectProgramLimits,
		frozenSubject,
		logicalPath: inputs.logicalPath as string,
		semanticProgramId: inputs.semanticProgramId as SemanticProgramId,
		semanticProjectId: inputs.semanticProjectId as SemanticProjectId,
		semanticSnapshot: semanticSnapshot as StaticSemanticSnapshot,
		semanticSourceId: inputs.semanticSourceId as SemanticSourceId
	};
}

function validateEmitLimits(value: unknown): CompilerProjectDeclarationEmissionLimits {
	return nonnegativeLimits(
		value,
		EMIT_LIMIT_KEYS,
		'Declaration-emission limits'
	) as unknown as CompilerProjectDeclarationEmissionLimits;
}

function mapSessionError(error: CompilerProjectProgramCapabilityError): never {
	if (error.code === 'BUDGET_EXCEEDED') fail('BUDGET_EXCEEDED', error.message);
	if (error.code === 'INPUT_INVALID') fail('INPUT_INVALID', error.message);
	if (error.code === 'CAPTURE_UNAVAILABLE') fail('CAPTURE_UNAVAILABLE', error.message);
	fail('PROVIDER_FAILURE', error.message);
}

interface ResourceLedger {
	readonly checkpoint: () => void;
	readonly preflight: (amount: number) => void;
	readonly remainingDurationMs: () => number;
	readonly step: (amount?: number) => void;
}

function resourceLedger(
	limits: CompilerProjectDeclarationEmissionLimits,
	runtime: CompilerProjectDeclarationEmissionRuntimeOptions
): ResourceLedger {
	let defaultNow: (() => number) | undefined;
	if (runtime.now === undefined) {
		try {
			defaultNow = createMonotonicOperationClock().now;
		} catch {
			fail('BUDGET_EXCEEDED', 'Declaration-emission monotonic clock failed closed.');
		}
	}
	const now = runtime.now ?? defaultNow!;
	const readClock = (): number => {
		try {
			return now();
		} catch {
			fail('BUDGET_EXCEEDED', 'Declaration-emission monotonic clock failed closed.');
		}
	};
	const startedAtMs = readClock();
	if (!Number.isSafeInteger(startedAtMs) || startedAtMs < 0)
		fail('BUDGET_EXCEEDED', 'Declaration-emission clock returned an invalid start time.');
	let lastNow = startedAtMs;
	let traversalSteps = 0;
	let workSinceCheckpoint = 0;
	const checkTime = (): number => {
		const current = readClock();
		if (
			!Number.isSafeInteger(current) ||
			current < lastNow ||
			current - startedAtMs > limits.maxDurationMs
		)
			fail('BUDGET_EXCEEDED', 'Declaration emission exceeded maxDurationMs.');
		lastNow = current;
		return current - startedAtMs;
	};
	const checkpoint = (): void => {
		checkTime();
		if (runtime.checkpoint !== undefined) {
			try {
				runtime.checkpoint();
			} catch {
				fail('BUDGET_EXCEEDED', 'Declaration-emission checkpoint failed closed.');
			}
			checkTime();
		}
	};
	return {
		checkpoint,
		preflight(amount: number): void {
			if (!Number.isSafeInteger(amount) || amount < 0)
				fail('BUDGET_EXCEEDED', 'Declaration-emission traversal preflight is invalid.');
			if (amount > limits.maxTraversalSteps - traversalSteps)
				fail('BUDGET_EXCEEDED', 'Declaration emission exceeded maxTraversalSteps.');
		},
		remainingDurationMs(): number {
			checkpoint();
			const remaining = limits.maxDurationMs - (lastNow - startedAtMs);
			if (remaining <= 0)
				fail('BUDGET_EXCEEDED', 'Declaration emission has no remaining inner-session duration.');
			return remaining;
		},
		step(amount = 1): void {
			if (!Number.isSafeInteger(amount) || amount < 0)
				fail('BUDGET_EXCEEDED', 'Declaration-emission traversal charge is invalid.');
			if (amount > limits.maxTraversalSteps - traversalSteps)
				fail('BUDGET_EXCEEDED', 'Declaration emission exceeded maxTraversalSteps.');
			traversalSteps += amount;
			workSinceCheckpoint += amount;
			if (workSinceCheckpoint < RESOURCE_CHECKPOINT_CADENCE) return;
			workSinceCheckpoint = 0;
			checkpoint();
		}
	};
}

function bracket<Value>(ledger: ResourceLedger, operation: () => Value): Value {
	ledger.checkpoint();
	try {
		const result = operation();
		ledger.checkpoint();
		return result;
	} catch (error) {
		if (
			error instanceof CompilerProjectDeclarationEmissionError &&
			error.code === 'BUDGET_EXCEEDED'
		)
			throw error;
		if (error instanceof CompilerProjectProgramCapabilityError && error.code === 'BUDGET_EXCEEDED')
			return mapSessionError(error);
		ledger.checkpoint();
		if (error instanceof CompilerProjectDeclarationEmissionError) throw error;
		if (error instanceof CompilerProjectProgramCapabilityError) return mapSessionError(error);
		fail('PROVIDER_FAILURE', 'Declaration-emission provider call failed closed.');
	}
}

function copiedDenseProviderArray<Value>(
	value: unknown,
	maximumLength: number,
	ledger: ResourceLedger,
	label: string,
	failureCode: CompilerProjectDeclarationEmissionError['code'] = 'PROVIDER_FAILURE'
): readonly Value[] {
	if (!Array.isArray(value) || isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype)
		fail(failureCode, `${label} must be an ordinary dense array.`);
	const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
	if (
		lengthDescriptor === undefined ||
		!('value' in lengthDescriptor) ||
		typeof lengthDescriptor.value !== 'number' ||
		!Number.isSafeInteger(lengthDescriptor.value) ||
		lengthDescriptor.value < 0 ||
		lengthDescriptor.value > maximumLength
	)
		fail(failureCode, `${label} has an invalid bounded length.`);
	const length = lengthDescriptor.value;
	ledger.checkpoint();
	const ownKeys = Reflect.ownKeys(value);
	ledger.checkpoint();
	if (ownKeys.length !== length + 1)
		fail(failureCode, `${label} contains properties outside its exact dense population.`);
	ledger.preflight(ownKeys.length);
	for (const key of ownKeys) {
		ledger.step();
		if (key === 'length') continue;
		if (typeof key !== 'string') fail(failureCode, `${label} contains a symbol property.`);
		const index = Number(key);
		if (!Number.isSafeInteger(index) || index < 0 || index >= length || String(index) !== key)
			fail(failureCode, `${label} contains a non-canonical index property.`);
	}
	ledger.preflight(length);
	const result: Value[] = [];
	for (let index = 0; index < length; index += 1) {
		ledger.step();
		const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			fail(failureCode, `${label} must contain only dense data entries.`);
		result.push(descriptor.value as Value);
	}
	return Object.freeze(result);
}

function checkedCompilerOptionText(value: string): string {
	if (value.length > HARD_MAX_PATH_CHARACTERS || !isUnicodeScalarString(value))
		fail('PROVIDER_FAILURE', 'Public TypeScript compiler options contain invalid text.');
	return value;
}

function checkedCompilerOptionNumber(value: number): number {
	if (!Number.isFinite(value))
		fail('PROVIDER_FAILURE', 'Public TypeScript compiler options contain a non-finite number.');
	return value;
}

function copiedCompilerOptionArray(
	value: unknown,
	ledger: ResourceLedger,
	ancestors: WeakSet<object>,
	depth: number
): readonly unknown[] {
	const entries = copiedDenseProviderArray<unknown>(
		value,
		HARD_MAX_COMPILER_OPTION_ARRAY_LENGTH,
		ledger,
		'Public TypeScript nested compiler-option array'
	);
	const copiedEntries: unknown[] = [];
	ledger.preflight(entries.length);
	for (const entry of entries)
		copiedEntries.push(copiedCompilerOptionValue(entry, ledger, ancestors, depth + 1));
	return Object.freeze(copiedEntries);
}

function copiedCompilerOptionRecord(
	value: object,
	ledger: ResourceLedger,
	ancestors: WeakSet<object>,
	depth: number
): Readonly<Record<string, unknown>> {
	if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
		fail('PROVIDER_FAILURE', 'Public TypeScript compiler options contain a non-plain object.');
	const keys = Reflect.ownKeys(value);
	if (keys.length > HARD_MAX_COMPILER_OPTION_KEYS)
		fail('PROVIDER_FAILURE', 'Public TypeScript nested compiler options exceed the key ceiling.');
	ledger.preflight(keys.length);
	const result: Record<string, unknown> = {};
	for (const key of keys) {
		ledger.step();
		if (typeof key !== 'string')
			fail('PROVIDER_FAILURE', 'Public TypeScript compiler options contain a symbol key.');
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			fail('PROVIDER_FAILURE', 'Public TypeScript compiler options contain an accessor.');
		result[key] = copiedCompilerOptionValue(descriptor.value, ledger, ancestors, depth + 1);
	}
	return Object.freeze(result);
}

function copiedCompilerOptionValue(
	value: unknown,
	ledger: ResourceLedger,
	ancestors: WeakSet<object>,
	depth: number
): unknown {
	ledger.step();
	if (value === null || value === undefined || typeof value === 'boolean') return value;
	if (typeof value === 'string') return checkedCompilerOptionText(value);
	if (typeof value === 'number') return checkedCompilerOptionNumber(value);
	if (typeof value !== 'object' || isProxy(value) || depth >= HARD_MAX_COMPILER_OPTION_DEPTH)
		fail('PROVIDER_FAILURE', 'Public TypeScript compiler options contain an unsupported value.');
	if (ancestors.has(value))
		fail('PROVIDER_FAILURE', 'Public TypeScript compiler options contain a cycle.');
	ancestors.add(value);
	try {
		if (Array.isArray(value)) return copiedCompilerOptionArray(value, ledger, ancestors, depth);
		return copiedCompilerOptionRecord(value, ledger, ancestors, depth);
	} finally {
		ancestors.delete(value);
	}
}

function copiedCompilerOptions(value: unknown, ledger: ResourceLedger): ts.CompilerOptions {
	if (
		value === null ||
		typeof value !== 'object' ||
		Array.isArray(value) ||
		isProxy(value) ||
		(Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
	)
		fail('PROVIDER_FAILURE', 'Public TypeScript compiler options must be an ordinary object.');
	const keys = Reflect.ownKeys(value);
	if (keys.length > HARD_MAX_COMPILER_OPTION_KEYS)
		fail('PROVIDER_FAILURE', 'Public TypeScript compiler options exceed the hard key ceiling.');
	ledger.preflight(keys.length);
	const result: Record<string, unknown> = {};
	for (const key of keys) {
		ledger.step();
		if (typeof key !== 'string')
			fail('PROVIDER_FAILURE', 'Public TypeScript compiler options contain a symbol key.');
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			fail('PROVIDER_FAILURE', 'Public TypeScript compiler options contain an accessor.');
		result[key] = copiedCompilerOptionValue(descriptor.value, ledger, new WeakSet(), 0);
	}
	return Object.freeze(result) as ts.CompilerOptions;
}

type DeclarationEmissionProgramEvidence = Pick<
	CompilerProjectProgramEvidence,
	| 'attributedInputRecords'
	| 'attributedReadBytes'
	| 'attributedUniqueQueries'
	| 'artifactParseInputRecords'
	| 'artifactParseReadBytes'
	| 'compilerHostCallbacks'
	| 'compilerHostReadBytes'
	| 'configPath'
	| 'declarationEmitCallbacksUseOnlyAttributedQueries'
	| 'declarationEmitInputRecords'
	| 'declarationEmitReadBytes'
	| 'inputRecords'
	| 'materializedRecipeDigest'
	| 'programCallbacksWithinAttributedInvocationBounds'
	| 'programCompilerHostCallbacks'
	| 'programCompilerHostReadBytes'
	| 'programContextDigest'
	| 'programSourceFiles'
	| 'projectResolutionDigest'
	| 'semanticProgramId'
	| 'semanticProjectId'
	| 'state'
	| 'subjectId'
	| 'version'
>;

function copiedBoundedProviderObject(
	value: unknown,
	maximumKeys: number,
	ledger: ResourceLedger,
	label: string
): Record<string, unknown> {
	if (
		value === null ||
		typeof value !== 'object' ||
		Array.isArray(value) ||
		isProxy(value) ||
		(Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
	)
		fail('PROVIDER_FAILURE', `${label} must be an ordinary object.`);
	const keys = Reflect.ownKeys(value);
	if (keys.length > maximumKeys) fail('PROVIDER_FAILURE', `${label} exceeds its key ceiling.`);
	ledger.preflight(keys.length);
	const copied: Record<string, unknown> = {};
	for (const key of keys) {
		ledger.step();
		if (typeof key !== 'string') fail('PROVIDER_FAILURE', `${label} contains a symbol key.`);
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			fail('PROVIDER_FAILURE', `${label} fields must be enumerable data properties.`);
		copied[key] = descriptor.value;
	}
	return copied;
}

function requireExactProviderKeys(
	value: Record<string, unknown>,
	keys: readonly string[],
	label: string
): void {
	const actualKeys = Object.keys(value);
	if (actualKeys.length !== keys.length)
		fail('CAPTURE_UNAVAILABLE', `${label} has an invalid exact key set.`);
	for (const key of actualKeys)
		if (!fixedKeyContains(keys, key))
			fail('CAPTURE_UNAVAILABLE', `${label} has an invalid exact key set.`);
}

function copiedStringArray(
	value: unknown,
	ledger: ResourceLedger,
	label: string
): readonly string[] {
	const entries = copiedDenseProviderArray<unknown>(
		value,
		HARD_MAX_SNAPSHOT_POPULATION,
		ledger,
		label
	);
	const result: string[] = [];
	ledger.preflight(entries.length);
	for (const entry of entries) {
		ledger.step();
		if (
			typeof entry !== 'string' ||
			entry.length > HARD_MAX_PATH_CHARACTERS ||
			!isUnicodeScalarString(entry)
		)
			fail('CAPTURE_UNAVAILABLE', `${label} contains invalid text.`);
		result.push(entry);
	}
	return Object.freeze(result);
}

function copiedProgramQuery(value: unknown, ledger: ResourceLedger): CompilerInputQuery {
	const query = copiedBoundedProviderObject(value, 6, ledger, 'Compiler Program input query');
	const operation = query.operation;
	const readDirectory = operation === 'READ_DIRECTORY';
	const simpleOperation =
		operation === 'READ_FILE' ||
		operation === 'FILE_EXISTS' ||
		operation === 'DIRECTORY_EXISTS' ||
		operation === 'GET_DIRECTORIES' ||
		operation === 'REALPATH' ||
		operation === 'CURRENT_DIRECTORY' ||
		operation === 'USE_CASE_SENSITIVE_FILE_NAMES';
	if (!readDirectory && !simpleOperation)
		fail('CAPTURE_UNAVAILABLE', 'Compiler Program input query has an unknown operation.');
	requireExactProviderKeys(
		query,
		readDirectory
			? ['depth', 'excludes', 'extensions', 'includes', 'logicalPath', 'operation']
			: ['logicalPath', 'operation'],
		'Compiler Program input query'
	);
	if (
		typeof query.logicalPath !== 'string' ||
		query.logicalPath.length === 0 ||
		query.logicalPath.length > HARD_MAX_PATH_CHARACTERS ||
		!isUnicodeScalarString(query.logicalPath) ||
		((operation === 'CURRENT_DIRECTORY' || operation === 'USE_CASE_SENSITIVE_FILE_NAMES') &&
			query.logicalPath !== '.')
	)
		fail('CAPTURE_UNAVAILABLE', 'Compiler Program input query has an invalid logical path.');
	if (readDirectory) {
		if (
			query.depth !== null &&
			(typeof query.depth !== 'number' || !Number.isSafeInteger(query.depth) || query.depth < 0)
		)
			fail('CAPTURE_UNAVAILABLE', 'Compiler Program READ_DIRECTORY depth is invalid.');
		query.excludes = copiedStringArray(
			query.excludes,
			ledger,
			'Compiler Program READ_DIRECTORY excludes'
		);
		query.extensions = copiedStringArray(
			query.extensions,
			ledger,
			'Compiler Program READ_DIRECTORY extensions'
		);
		query.includes = copiedStringArray(
			query.includes,
			ledger,
			'Compiler Program READ_DIRECTORY includes'
		);
	}
	return Object.freeze(query) as unknown as CompilerInputQuery;
}

/**
 * The exact variants whose only journalled fields are the operation and its status. Each disjunct
 * of the original condition pinned a distinct operation, so dispatching on the operation first is
 * the same predicate.
 */
function isProgramObservationStatusOnlyVariant(operation: unknown, result: unknown): boolean {
	if (operation === 'READ_FILE') return result === 'ABSENT';
	if (operation === 'FILE_EXISTS') return result === 'PRESENT' || result === 'ABSENT';
	if (operation === 'DIRECTORY_EXISTS') return result === 'DIRECTORY' || result === 'NOT_DIRECTORY';
	if (operation === 'REALPATH') return result === 'ABSENT';
	if (operation === 'USE_CASE_SENSITIVE_FILE_NAMES')
		return result === 'CASE_SENSITIVE' || result === 'CASE_INSENSITIVE';
	return false;
}

function programObservationDirectoryVariantKeys(
	operation: unknown,
	result: unknown
): readonly string[] | null {
	if (result !== 'DIRECTORY' && result !== 'NOT_DIRECTORY') return null;
	if (operation === 'GET_DIRECTORIES')
		return ['operation', 'result', 'resultEntries', 'scannedEntries'];
	if (operation === 'READ_DIRECTORY')
		return [
			'depth',
			'excludes',
			'extensions',
			'includes',
			'operation',
			'result',
			'resultEntries',
			'scannedEntries'
		];
	return null;
}

function programObservationVariantKeys(
	operation: unknown,
	result: unknown,
	byteBudgetClass: unknown
): readonly string[] {
	if (operation === 'READ_FILE' && result === 'PRESENT')
		return byteBudgetClass === 'VIRTUAL_TRANSFORM'
			? [
					'byteBudgetClass',
					'contentBytes',
					'contentSha256',
					'operation',
					'result',
					'transformation'
				]
			: ['byteBudgetClass', 'contentBytes', 'contentSha256', 'operation', 'result'];
	if (isProgramObservationStatusOnlyVariant(operation, result)) return ['operation', 'result'];
	const directoryKeys = programObservationDirectoryVariantKeys(operation, result);
	if (directoryKeys !== null) return directoryKeys;
	if (operation === 'REALPATH' && result === 'RESOLVED')
		return ['operation', 'resolvedLogicalPath', 'result'];
	if (operation === 'CURRENT_DIRECTORY' && result === 'RESOLVED')
		return ['operation', 'resolvedLogicalPath', 'result'];
	fail('CAPTURE_UNAVAILABLE', 'Compiler Program input observation has an invalid variant.');
}

function validateProgramObservationBaseFields(observation: Record<string, unknown>): void {
	if (
		typeof observation.id !== 'string' ||
		observation.id.length === 0 ||
		observation.id.length > HARD_MAX_IDENTITY_CHARACTERS ||
		!isUnicodeScalarString(observation.id) ||
		typeof observation.invocationCount !== 'number' ||
		!Number.isSafeInteger(observation.invocationCount) ||
		observation.invocationCount <= 0 ||
		typeof observation.logicalPath !== 'string' ||
		observation.logicalPath.length === 0 ||
		observation.logicalPath.length > HARD_MAX_PATH_CHARACTERS ||
		!isUnicodeScalarString(observation.logicalPath) ||
		typeof observation.origin !== 'string' ||
		!Object.hasOwn(SOURCE_ORIGIN_VALUES, observation.origin) ||
		typeof observation.resultDigest !== 'string' ||
		!/^[a-f0-9]{64}$/u.test(observation.resultDigest)
	)
		fail('CAPTURE_UNAVAILABLE', 'Compiler Program input observation base fields are invalid.');
}

function copiedTransformationInteger(value: unknown, maximum: number, label: string): number {
	if (
		typeof value !== 'number' ||
		!Number.isSafeInteger(value) ||
		value < 0 ||
		value > maximum
	)
		fail('CAPTURE_UNAVAILABLE', `${label} is outside its bounded nonnegative range.`);
	return value;
}

function copiedTransformationDigest(value: unknown, label: string): string {
	if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value))
		fail('CAPTURE_UNAVAILABLE', `${label} is not an exact SHA-256 digest.`);
	return value;
}

function copiedTransformationPath(value: unknown, label: string): string {
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value.length > SVELTE_VIRTUAL_SOURCE_IMPLEMENTATION_LIMITS.maxPathCharacters ||
		!isUnicodeScalarString(value)
	)
		fail('CAPTURE_UNAVAILABLE', `${label} is not a bounded Unicode-scalar path.`);
	return value;
}

function copiedProgramObservationTransformation(
	value: unknown,
	observation: Readonly<Record<string, unknown>>,
	ledger: ResourceLedger
): SemanticSourceTransformationRecord {
	const transformation = copiedBoundedProviderObject(
		value,
		8,
		ledger,
		'Compiler Program virtual-source transformation'
	);
	requireExactProviderKeys(
		transformation,
		[
			'adapter',
			'authored',
			'id',
			'idProfile',
			'schemaVersion',
			'sourceMap',
			'transformProfile',
			'virtual'
		],
		'Compiler Program virtual-source transformation'
	);
	const adapter = copiedBoundedProviderObject(
		transformation.adapter,
		5,
		ledger,
		'Compiler Program virtual-source adapter identity'
	);
	requireExactProviderKeys(
		adapter,
		['adapter', 'adapterVersion', 'svelte2tsxVersion', 'svelteVersion', 'typescriptVersion'],
		'Compiler Program virtual-source adapter identity'
	);
	if (
		adapter.adapter !== 'svelte2tsx' ||
		adapter.adapterVersion !== SVELTE_VIRTUAL_SOURCE_ADAPTER_VERSION ||
		adapter.svelte2tsxVersion !== SVELTE2TSX_PROVIDER_VERSION ||
		adapter.svelteVersion !== SVELTE_PROVIDER_VERSION ||
		adapter.typescriptVersion !== SVELTE_TYPESCRIPT_PROVIDER_VERSION
	)
		fail('CAPTURE_UNAVAILABLE', 'Compiler Program virtual-source adapter identity is invalid.');
	const authoredInput = copiedBoundedProviderObject(
		transformation.authored,
		6,
		ledger,
		'Compiler Program virtual-source authored descriptor'
	);
	requireExactProviderKeys(
		authoredInput,
		['contentBytes', 'contentCharacters', 'contentSha256', 'encoding', 'logicalPath', 'origin'],
		'Compiler Program virtual-source authored descriptor'
	);
	const authored = Object.freeze({
		contentBytes: copiedTransformationInteger(
			authoredInput.contentBytes,
			SVELTE_VIRTUAL_SOURCE_IMPLEMENTATION_LIMITS.maxAuthoredBytes,
			'Compiler Program virtual-source authored contentBytes'
		),
		contentCharacters: copiedTransformationInteger(
			authoredInput.contentCharacters,
			SVELTE_VIRTUAL_SOURCE_IMPLEMENTATION_LIMITS.maxAuthoredCharacters,
			'Compiler Program virtual-source authored contentCharacters'
		),
		contentSha256: copiedTransformationDigest(
			authoredInput.contentSha256,
			'Compiler Program virtual-source authored contentSha256'
		),
		encoding: authoredInput.encoding as 'UTF8_WITHOUT_BOM',
		logicalPath: copiedTransformationPath(
			authoredInput.logicalPath,
			'Compiler Program virtual-source authored logicalPath'
		),
		origin: authoredInput.origin as 'AUTHORED'
	});
	if (authored.encoding !== 'UTF8_WITHOUT_BOM' || authored.origin !== 'AUTHORED')
		fail('CAPTURE_UNAVAILABLE', 'Compiler Program virtual-source authored descriptor is invalid.');
	const sourceMapInput = copiedBoundedProviderObject(
		transformation.sourceMap,
		6,
		ledger,
		'Compiler Program virtual-source source-map evidence'
	);
	requireExactProviderKeys(
		sourceMapInput,
		[
			'canonicalJsonBytes',
			'canonicalJsonSha256',
			'decoderVersion',
			'generatedLines',
			'mappingState',
			'segmentCount'
		],
		'Compiler Program virtual-source source-map evidence'
	);
	const sourceMap = Object.freeze({
		canonicalJsonBytes: copiedTransformationInteger(
			sourceMapInput.canonicalJsonBytes,
			SVELTE_VIRTUAL_SOURCE_IMPLEMENTATION_LIMITS.maxMapCharacters,
			'Compiler Program virtual-source canonical map bytes'
		),
		canonicalJsonSha256: copiedTransformationDigest(
			sourceMapInput.canonicalJsonSha256,
			'Compiler Program virtual-source canonical map digest'
		),
		decoderVersion: sourceMapInput.decoderVersion as typeof STRICT_SOURCE_MAP_V3_DECODER_VERSION,
		generatedLines: copiedTransformationInteger(
			sourceMapInput.generatedLines,
			SVELTE_VIRTUAL_SOURCE_IMPLEMENTATION_LIMITS.maxGeneratedLines,
			'Compiler Program virtual-source generated line count'
		),
		mappingState: sourceMapInput.mappingState as 'EXACT_SEGMENT_POINTS_ONLY',
		segmentCount: copiedTransformationInteger(
			sourceMapInput.segmentCount,
			SVELTE_VIRTUAL_SOURCE_IMPLEMENTATION_LIMITS.maxMapSegments,
			'Compiler Program virtual-source map segment count'
		)
	});
	if (
		sourceMap.decoderVersion !== STRICT_SOURCE_MAP_V3_DECODER_VERSION ||
		sourceMap.mappingState !== 'EXACT_SEGMENT_POINTS_ONLY'
	)
		fail('CAPTURE_UNAVAILABLE', 'Compiler Program virtual-source source-map evidence is invalid.');
	const virtualInput = copiedBoundedProviderObject(
		transformation.virtual,
		6,
		ledger,
		'Compiler Program virtual-source virtual descriptor'
	);
	requireExactProviderKeys(
		virtualInput,
		['contentBytes', 'contentCharacters', 'contentSha256', 'logicalPath', 'origin', 'scriptKind'],
		'Compiler Program virtual-source virtual descriptor'
	);
	const virtual = Object.freeze({
		contentBytes: copiedTransformationInteger(
			virtualInput.contentBytes,
			SVELTE_VIRTUAL_SOURCE_IMPLEMENTATION_LIMITS.maxGeneratedBytes,
			'Compiler Program virtual-source virtual contentBytes'
		),
		contentCharacters: copiedTransformationInteger(
			virtualInput.contentCharacters,
			SVELTE_VIRTUAL_SOURCE_IMPLEMENTATION_LIMITS.maxGeneratedCharacters,
			'Compiler Program virtual-source virtual contentCharacters'
		),
		contentSha256: copiedTransformationDigest(
			virtualInput.contentSha256,
			'Compiler Program virtual-source virtual contentSha256'
		),
		logicalPath: copiedTransformationPath(
			virtualInput.logicalPath,
			'Compiler Program virtual-source virtual logicalPath'
		),
		origin: virtualInput.origin as 'VIRTUAL',
		scriptKind: virtualInput.scriptKind as 'JS' | 'TS'
	});
	if (virtual.origin !== 'VIRTUAL' || (virtual.scriptKind !== 'JS' && virtual.scriptKind !== 'TS'))
		fail('CAPTURE_UNAVAILABLE', 'Compiler Program virtual-source virtual descriptor is invalid.');
	let expectedVirtualPath: string;
	try {
		expectedVirtualPath = svelteVirtualLogicalPath(authored.logicalPath, virtual.scriptKind);
	} catch {
		return fail(
			'CAPTURE_UNAVAILABLE',
			'Compiler Program virtual-source logical paths are outside the exact adapter profile.'
		);
	}
	if (
		expectedVirtualPath !== virtual.logicalPath ||
		observation.logicalPath !== authored.logicalPath ||
		observation.origin !== 'VIRTUAL' ||
		observation.contentBytes !== virtual.contentBytes ||
		observation.contentSha256 !== virtual.contentSha256 ||
		transformation.idProfile !== SVELTE_VIRTUAL_SOURCE_ID_PROFILE ||
		transformation.schemaVersion !== SVELTE_VIRTUAL_SOURCE_SCHEMA_VERSION ||
		transformation.transformProfile !== SVELTE_VIRTUAL_SOURCE_TRANSFORM_PROFILE
	)
		fail(
			'CAPTURE_UNAVAILABLE',
			'Compiler Program virtual-source transformation does not bind its observation.'
		);
	const copied = Object.freeze({
		adapter: Object.freeze({
			adapter: 'svelte2tsx' as const,
			adapterVersion: SVELTE_VIRTUAL_SOURCE_ADAPTER_VERSION,
			svelte2tsxVersion: SVELTE2TSX_PROVIDER_VERSION,
			svelteVersion: SVELTE_PROVIDER_VERSION,
			typescriptVersion: SVELTE_TYPESCRIPT_PROVIDER_VERSION
		}),
		authored,
		id: copiedTransformationDigest(
			transformation.id,
			'Compiler Program virtual-source transformation ID'
		),
		idProfile: SVELTE_VIRTUAL_SOURCE_ID_PROFILE,
		schemaVersion: SVELTE_VIRTUAL_SOURCE_SCHEMA_VERSION,
		sourceMap,
		transformProfile: SVELTE_VIRTUAL_SOURCE_TRANSFORM_PROFILE,
		virtual
	});
	const expectedId = createHash('sha256')
		.update(
			canonicalSemanticJson({
				adapter: copied.adapter,
				authored: copied.authored,
				idProfile: copied.idProfile,
				sourceMap: copied.sourceMap,
				transformProfile: copied.transformProfile,
				virtual: copied.virtual
			}),
			'utf8'
		)
		.digest('hex');
	if (copied.id !== expectedId)
		fail('CAPTURE_UNAVAILABLE', 'Compiler Program virtual-source transformation ID is invalid.');
	return copied;
}

function validateProgramObservationReadFileEvidence(
	observation: Record<string, unknown>,
	ledger: ResourceLedger
): void {
	if (
		(observation.byteBudgetClass !== 'FROZEN_SUBJECT' &&
			observation.byteBudgetClass !== 'LIVE_COMPILER_CONTEXT' &&
			observation.byteBudgetClass !== 'VIRTUAL_TRANSFORM') ||
		typeof observation.contentBytes !== 'number' ||
		!Number.isSafeInteger(observation.contentBytes) ||
		observation.contentBytes < 0 ||
		typeof observation.contentSha256 !== 'string' ||
		!/^[a-f0-9]{64}$/u.test(observation.contentSha256)
	)
		fail('CAPTURE_UNAVAILABLE', 'Compiler Program READ_FILE content evidence is invalid.');
	if (observation.byteBudgetClass === 'VIRTUAL_TRANSFORM')
		observation.transformation = copiedProgramObservationTransformation(
			observation.transformation,
			observation,
			ledger
		);
	else if (observation.origin === 'VIRTUAL')
		fail(
			'CAPTURE_UNAVAILABLE',
			'Compiler Program virtual source requires VIRTUAL_TRANSFORM byte evidence.'
		);
}

function copiedProgramObservationDirectoryEntries(
	observation: Record<string, unknown>,
	ledger: ResourceLedger
): void {
	observation.resultEntries = copiedStringArray(
		observation.resultEntries,
		ledger,
		'Compiler Program directory result entries'
	);
	if (
		typeof observation.scannedEntries !== 'number' ||
		!Number.isSafeInteger(observation.scannedEntries) ||
		observation.scannedEntries < (observation.resultEntries as readonly string[]).length
	)
		fail('CAPTURE_UNAVAILABLE', 'Compiler Program directory scan count is invalid.');
}

function copiedProgramObservationReadDirectoryParameters(
	observation: Record<string, unknown>,
	ledger: ResourceLedger
): void {
	if (
		observation.depth !== null &&
		(typeof observation.depth !== 'number' ||
			!Number.isSafeInteger(observation.depth) ||
			observation.depth < 0)
	)
		fail('CAPTURE_UNAVAILABLE', 'Compiler Program READ_DIRECTORY depth is invalid.');
	observation.excludes = copiedStringArray(
		observation.excludes,
		ledger,
		'Compiler Program READ_DIRECTORY observation excludes'
	);
	observation.extensions = copiedStringArray(
		observation.extensions,
		ledger,
		'Compiler Program READ_DIRECTORY observation extensions'
	);
	observation.includes = copiedStringArray(
		observation.includes,
		ledger,
		'Compiler Program READ_DIRECTORY observation includes'
	);
}

function validateProgramObservationResolvedPath(
	observation: Record<string, unknown>,
	operation: unknown
): void {
	if (
		typeof observation.resolvedLogicalPath !== 'string' ||
		observation.resolvedLogicalPath.length === 0 ||
		observation.resolvedLogicalPath.length > HARD_MAX_PATH_CHARACTERS ||
		!isUnicodeScalarString(observation.resolvedLogicalPath) ||
		(operation === 'CURRENT_DIRECTORY' && observation.resolvedLogicalPath !== '.')
	)
		fail('CAPTURE_UNAVAILABLE', 'Compiler Program resolved logical path is invalid.');
}

function copiedProgramObservation(
	value: unknown,
	ledger: ResourceLedger
): CompilerInputObservation {
	const observation = copiedBoundedProviderObject(
		value,
		13,
		ledger,
		'Compiler Program input observation'
	);
	const operation = observation.operation;
	const result = observation.result;
	const baseKeys = ['id', 'invocationCount', 'logicalPath', 'origin', 'resultDigest'] as const;
	const variantKeys = programObservationVariantKeys(operation, result, observation.byteBudgetClass);
	requireExactProviderKeys(
		observation,
		[...baseKeys, ...variantKeys],
		'Compiler Program input observation'
	);
	validateProgramObservationBaseFields(observation);
	if (operation === 'READ_FILE' && result === 'PRESENT')
		validateProgramObservationReadFileEvidence(observation, ledger);
	if (operation === 'GET_DIRECTORIES' || operation === 'READ_DIRECTORY')
		copiedProgramObservationDirectoryEntries(observation, ledger);
	if (operation === 'READ_DIRECTORY')
		copiedProgramObservationReadDirectoryParameters(observation, ledger);
	if (result === 'RESOLVED') validateProgramObservationResolvedPath(observation, operation);
	return Object.freeze(observation) as unknown as CompilerInputObservation;
}

function copiedProgramInputRecord(
	value: unknown,
	ledger: ResourceLedger
): CompilerProjectProgramInputRecord {
	const record = copiedBoundedProviderObject(value, 6, ledger, 'Compiler Program input record');
	requireExactProviderKeys(
		record,
		['attributedInvocationCount', 'invocationOrdinal', 'observation', 'ordinal', 'query', 'stage'],
		'Compiler Program input record'
	);
	if (
		typeof record.attributedInvocationCount !== 'number' ||
		!Number.isSafeInteger(record.attributedInvocationCount) ||
		record.attributedInvocationCount <= 0 ||
		typeof record.invocationOrdinal !== 'number' ||
		!Number.isSafeInteger(record.invocationOrdinal) ||
		record.invocationOrdinal < 0 ||
		typeof record.ordinal !== 'number' ||
		!Number.isSafeInteger(record.ordinal) ||
		record.ordinal < 0 ||
		(record.stage !== 'PROGRAM_CONSTRUCTION' &&
			record.stage !== 'TYPE_CHECKER_CREATE' &&
			record.stage !== 'CALLER_ANALYSIS' &&
			record.stage !== 'DECLARATION_EMIT')
	)
		fail('CAPTURE_UNAVAILABLE', 'Compiler Program input record fields are invalid.');
	const query = copiedProgramQuery(record.query, ledger);
	const observation = copiedProgramObservation(record.observation, ledger);
	if (query.operation !== observation.operation || query.logicalPath !== observation.logicalPath)
		fail('CAPTURE_UNAVAILABLE', 'Compiler Program input query/observation do not reconcile.');
	if (
		query.operation === 'READ_DIRECTORY' &&
		observation.operation === 'READ_DIRECTORY' &&
		(query.depth !== observation.depth ||
			!sameTextPopulation(query.excludes, observation.excludes, ledger) ||
			!sameTextPopulation(query.extensions, observation.extensions, ledger) ||
			!sameTextPopulation(query.includes, observation.includes, ledger))
	)
		fail(
			'CAPTURE_UNAVAILABLE',
			'Compiler Program READ_DIRECTORY query/observation parameters do not reconcile.'
		);
	return Object.freeze({
		attributedInvocationCount: record.attributedInvocationCount,
		invocationOrdinal: record.invocationOrdinal,
		observation,
		ordinal: record.ordinal,
		query,
		stage: record.stage
	}) as CompilerProjectProgramInputRecord;
}

function copiedProgramEvidenceFields(
	value: unknown,
	ledger: ResourceLedger
): Record<string, unknown> {
	if (
		value === null ||
		typeof value !== 'object' ||
		Array.isArray(value) ||
		isProxy(value) ||
		(Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
	)
		fail('PROVIDER_FAILURE', 'Finalized compiler Program evidence must be an ordinary object.');
	const ownKeys = Reflect.ownKeys(value);
	if (ownKeys.length !== PROGRAM_EVIDENCE_KEYS.length)
		fail('PROVIDER_FAILURE', 'Finalized compiler Program evidence has an invalid key set.');
	const copied: Record<string, unknown> = {};
	ledger.preflight(PROGRAM_EVIDENCE_KEYS.length * 2);
	for (const key of ownKeys) {
		ledger.step();
		if (typeof key !== 'string' || !fixedKeyContains(PROGRAM_EVIDENCE_KEYS, key))
			fail('PROVIDER_FAILURE', 'Finalized compiler Program evidence has an invalid key set.');
	}
	for (const key of PROGRAM_EVIDENCE_KEYS) {
		ledger.step();
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			fail(
				'PROVIDER_FAILURE',
				'Finalized compiler Program evidence fields must be data properties.'
			);
		copied[key] = descriptor.value;
	}
	return copied;
}

function validateProgramEvidenceScalars(copied: Record<string, unknown>): void {
	for (const key of PROGRAM_EVIDENCE_COUNT_KEYS) {
		const entry = copied[key];
		if (typeof entry !== 'number' || !Number.isSafeInteger(entry) || entry < 0)
			fail(
				'CAPTURE_UNAVAILABLE',
				`Finalized compiler Program evidence ${key} must be a nonnegative safe integer.`
			);
	}
	if (
		copied.declarationEmitCallbacksUseOnlyAttributedQueries !== true ||
		copied.programCallbacksWithinAttributedInvocationBounds !== true
	)
		fail('CAPTURE_UNAVAILABLE', 'Finalized compiler Program evidence flags must be true.');
	if (
		copied.state !== 'VERIFIED_PROJECT_SCOPED_FRESH_PROGRAM' ||
		copied.version !== COMPILER_PROJECT_PROGRAM_CAPABILITY_VERSION
	)
		fail('CAPTURE_UNAVAILABLE', 'Finalized compiler Program evidence state/version is invalid.');
	for (const key of [
		'configPath',
		'materializedRecipeDigest',
		'programContextDigest',
		'projectResolutionDigest',
		'semanticProgramId',
		'semanticProjectId',
		'subjectId'
	] as const) {
		const entry = copied[key];
		if (
			typeof entry !== 'string' ||
			entry.length === 0 ||
			entry.length > HARD_MAX_IDENTITY_CHARACTERS ||
			!isUnicodeScalarString(entry)
		)
			fail('CAPTURE_UNAVAILABLE', `Finalized compiler Program evidence ${key} is invalid.`);
	}
}

function copiedProgramEvidence(
	value: unknown,
	ledger: ResourceLedger
): DeclarationEmissionProgramEvidence {
	const copied = copiedProgramEvidenceFields(value, ledger);
	validateProgramEvidenceScalars(copied);
	const borrowedInputRecords = copiedDenseProviderArray<
		CompilerProjectProgramEvidence['inputRecords'][number]
	>(
		copied.inputRecords,
		HARD_MAX_SNAPSHOT_POPULATION,
		ledger,
		'Finalized compiler Program input records'
	);
	const inputRecords: CompilerProjectProgramInputRecord[] = [];
	ledger.checkpoint();
	ledger.preflight(borrowedInputRecords.length);
	for (const record of borrowedInputRecords) {
		ledger.step();
		inputRecords.push(copiedProgramInputRecord(record, ledger));
	}
	Object.freeze(inputRecords);
	ledger.checkpoint();
	return Object.freeze({
		attributedInputRecords: copied.attributedInputRecords as number,
		attributedReadBytes: copied.attributedReadBytes as number,
		attributedUniqueQueries: copied.attributedUniqueQueries as number,
		artifactParseInputRecords: copied.artifactParseInputRecords as number,
		artifactParseReadBytes: copied.artifactParseReadBytes as number,
		compilerHostCallbacks: copied.compilerHostCallbacks as number,
		compilerHostReadBytes: copied.compilerHostReadBytes as number,
		configPath: copied.configPath as string,
		declarationEmitCallbacksUseOnlyAttributedQueries: true,
		declarationEmitInputRecords: copied.declarationEmitInputRecords as number,
		declarationEmitReadBytes: copied.declarationEmitReadBytes as number,
		inputRecords,
		materializedRecipeDigest: copied.materializedRecipeDigest as string,
		programCallbacksWithinAttributedInvocationBounds: true,
		programCompilerHostCallbacks: copied.programCompilerHostCallbacks as number,
		programCompilerHostReadBytes: copied.programCompilerHostReadBytes as number,
		programContextDigest: copied.programContextDigest as string,
		programSourceFiles: copied.programSourceFiles as number,
		projectResolutionDigest: copied.projectResolutionDigest as string,
		semanticProgramId: copied.semanticProgramId as SemanticProgramId,
		semanticProjectId: copied.semanticProjectId as SemanticProjectId,
		state: 'VERIFIED_PROJECT_SCOPED_FRESH_PROGRAM',
		subjectId: copied.subjectId as string,
		version: COMPILER_PROJECT_PROGRAM_CAPABILITY_VERSION
	});
}

function copiedEmitResult(
	value: unknown,
	ledger: ResourceLedger
): Readonly<{ readonly diagnostics: readonly []; readonly emitSkipped: boolean }> {
	if (
		value === null ||
		typeof value !== 'object' ||
		Array.isArray(value) ||
		isProxy(value) ||
		(Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
	)
		fail('PROVIDER_FAILURE', 'Public TypeScript emit result must be an ordinary object.');
	const skippedDescriptor = Object.getOwnPropertyDescriptor(value, 'emitSkipped');
	const diagnosticsDescriptor = Object.getOwnPropertyDescriptor(value, 'diagnostics');
	if (
		skippedDescriptor === undefined ||
		!('value' in skippedDescriptor) ||
		typeof skippedDescriptor.value !== 'boolean' ||
		diagnosticsDescriptor === undefined ||
		!('value' in diagnosticsDescriptor)
	)
		fail('PROVIDER_FAILURE', 'Public TypeScript emit result fields must be data properties.');
	const diagnosticsValue = diagnosticsDescriptor.value;
	if (
		!Array.isArray(diagnosticsValue) ||
		isProxy(diagnosticsValue) ||
		Object.getPrototypeOf(diagnosticsValue) !== Array.prototype
	)
		fail('PROVIDER_FAILURE', 'Public TypeScript emit diagnostics must be an ordinary array.');
	const lengthDescriptor = Object.getOwnPropertyDescriptor(diagnosticsValue, 'length');
	if (
		lengthDescriptor === undefined ||
		!('value' in lengthDescriptor) ||
		typeof lengthDescriptor.value !== 'number' ||
		!Number.isSafeInteger(lengthDescriptor.value) ||
		lengthDescriptor.value < 0
	)
		fail('PROVIDER_FAILURE', 'Public TypeScript emit diagnostics has an invalid length.');
	ledger.step();
	if (lengthDescriptor.value !== 0)
		fail('EMIT_UNAVAILABLE', 'Public TypeScript declaration emit returned diagnostics.');
	return Object.freeze({
		diagnostics: Object.freeze([]) as readonly [],
		emitSkipped: skippedDescriptor.value
	});
}

function uniqueMatch<Value>(
	values: readonly Value[],
	predicate: (value: Value) => boolean,
	ledger: ResourceLedger,
	message: string
): Value {
	ledger.preflight(values.length);
	let match: Value | undefined;
	let count = 0;
	for (const value of values) {
		ledger.step();
		if (!predicate(value)) continue;
		match = value;
		count += 1;
	}
	if (count !== 1 || match === undefined) fail('SELECTION_UNAVAILABLE', message);
	return match;
}

function exactMembershipCount(
	values: readonly string[],
	selected: string,
	ledger: ResourceLedger
): number {
	ledger.preflight(values.length);
	let count = 0;
	for (const value of values) {
		ledger.step();
		if (value === selected) count += 1;
	}
	return count;
}

function compareText(left: string, right: string, ledger: ResourceLedger): number {
	const length = Math.min(left.length, right.length);
	ledger.preflight(length);
	for (let index = 0; index < length; index += 1) {
		ledger.step();
		const difference = left.charCodeAt(index) - right.charCodeAt(index);
		if (difference !== 0) return difference < 0 ? -1 : 1;
	}
	if (left.length < right.length) return -1;
	if (left.length > right.length) return 1;
	return 0;
}

function sortedTextPopulation(
	values: readonly string[],
	ledger: ResourceLedger
): readonly string[] {
	ledger.preflight(values.length);
	let source: string[] = [];
	ledger.checkpoint();
	for (const value of values) {
		ledger.step();
		source.push(value);
	}
	let target = new Array<string>(source.length);
	ledger.checkpoint();
	for (let width = 1; width < source.length; width *= 2) {
		for (let start = 0; start < source.length; start += width * 2) {
			const middle = Math.min(start + width, source.length);
			const end = Math.min(start + width * 2, source.length);
			let left = start;
			let right = middle;
			let output = start;
			while (left < middle || right < end) {
				ledger.step();
				if (
					right >= end ||
					(left < middle && compareText(source[left]!, source[right]!, ledger) <= 0)
				)
					target[output++] = source[left++]!;
				else target[output++] = source[right++]!;
			}
		}
		[source, target] = [target, source];
		if (width > Math.floor(source.length / 2)) break;
	}
	Object.freeze(source);
	ledger.checkpoint();
	return source;
}

function sameTextPopulation(
	left: readonly string[],
	right: readonly string[],
	ledger: ResourceLedger
): boolean {
	if (left.length !== right.length) return false;
	ledger.preflight(left.length);
	for (let index = 0; index < left.length; index += 1) {
		ledger.step();
		if (compareText(left[index]!, right[index]!, ledger) !== 0) return false;
	}
	return true;
}

function sortedSourceIdentityPopulation(
	values: readonly SourceOriginProgramSourceIdentity[],
	ledger: ResourceLedger
): readonly SourceOriginProgramSourceIdentity[] {
	ledger.preflight(values.length);
	let source: SourceOriginProgramSourceIdentity[] = [];
	ledger.checkpoint();
	for (const value of values) {
		ledger.step();
		source.push(value);
	}
	let target = new Array<SourceOriginProgramSourceIdentity>(source.length);
	ledger.checkpoint();
	const compare = (
		left: SourceOriginProgramSourceIdentity,
		right: SourceOriginProgramSourceIdentity
	): number => {
		const pathOrder = compareText(left.logicalPath, right.logicalPath, ledger);
		return pathOrder !== 0
			? pathOrder
			: compareText(left.semanticSourceId, right.semanticSourceId, ledger);
	};
	for (let width = 1; width < source.length; width *= 2) {
		for (let start = 0; start < source.length; start += width * 2) {
			const middle = Math.min(start + width, source.length);
			const end = Math.min(start + width * 2, source.length);
			let left = start;
			let right = middle;
			let output = start;
			while (left < middle || right < end) {
				ledger.step();
				if (right >= end || (left < middle && compare(source[left]!, source[right]!) <= 0))
					target[output++] = source[left++]!;
				else target[output++] = source[right++]!;
			}
		}
		[source, target] = [target, source];
		if (width > Math.floor(source.length / 2)) break;
	}
	Object.freeze(source);
	ledger.checkpoint();
	return source;
}

function effectiveProgramLimits(
	programLimits: CompilerProjectProgramLimits,
	emitLimits: CompilerProjectDeclarationEmissionLimits,
	maxDurationMs: number
): CompilerProjectProgramLimits {
	return Object.freeze({
		maxDurationMs: Math.min(programLimits.maxDurationMs, maxDurationMs),
		maxProgramInputRecords: Math.min(
			programLimits.maxProgramInputRecords,
			emitLimits.maxInputRecords
		),
		maxProgramReadBytes: Math.min(programLimits.maxProgramReadBytes, emitLimits.maxReadBytes),
		maxProgramSourceFiles: Math.min(
			programLimits.maxProgramSourceFiles,
			emitLimits.maxProgramSourceFiles
		),
		maxTotalInputRecords: Math.min(programLimits.maxTotalInputRecords, emitLimits.maxInputRecords),
		maxTotalReadBytes: Math.min(programLimits.maxTotalReadBytes, emitLimits.maxReadBytes)
	});
}

interface Utf8Witness {
	readonly bytes: number;
	readonly sha256: string;
}

/**
 * The UTF-8 length of the code point starting at `index`, refusing lone UTF-16 surrogates. The
 * scan strides by code UNIT, so this reads code units directly rather than whole code points.
 */
function utf8EncodedByteLength(
	text: string,
	index: number,
	invalidTextCode: CompilerProjectDeclarationEmissionError['code'],
	label: string
): number {
	const first = text.charCodeAt(index);
	if (first <= 0x7f) return 1;
	if (first <= 0x7ff) return 2;
	if (first >= 0xd800 && first <= 0xdbff) {
		const second = text.charCodeAt(index + 1);
		if (index + 1 >= text.length || second < 0xdc00 || second > 0xdfff)
			fail(invalidTextCode, `${label} contains a lone UTF-16 surrogate.`);
		return 4;
	}
	if (first >= 0xdc00 && first <= 0xdfff)
		fail(invalidTextCode, `${label} contains a lone UTF-16 surrogate.`);
	return 3;
}

/** A four-byte UTF-8 encoding is exactly the one produced by a two-unit surrogate pair. */
function utf8CodeUnitStride(encodedBytes: number): number {
	return encodedBytes === 4 ? 2 : 1;
}

function utf8Witness(
	text: string,
	maxBytes: number,
	ledger: ResourceLedger,
	invalidTextCode: CompilerProjectDeclarationEmissionError['code'] = 'EMIT_UNAVAILABLE',
	label = 'Declaration output'
): Utf8Witness {
	let bytes = 0;
	let chunkStart = 0;
	const hash = createHash('sha256');
	for (let index = 0; index < text.length;) {
		ledger.step();
		const encodedBytes = utf8EncodedByteLength(text, index, invalidTextCode, label);
		if (encodedBytes > maxBytes - bytes)
			fail('BUDGET_EXCEEDED', 'Declaration emission exceeded maxOutputBytes.');
		bytes += encodedBytes;
		index += utf8CodeUnitStride(encodedBytes);
		if (index - chunkStart >= UTF8_HASH_CHUNK_CODE_UNITS) {
			hash.update(text.slice(chunkStart, index), 'utf8');
			chunkStart = index;
			ledger.checkpoint();
		}
	}
	if (chunkStart < text.length) hash.update(text.slice(chunkStart), 'utf8');
	ledger.checkpoint();
	return Object.freeze({ bytes, sha256: hash.digest('hex') });
}

type DeclarationEmissionInputRecord = DeclarationEmissionProgramEvidence['inputRecords'][number];

/** The exact stage ordering the finalized input-attempt population must be monotone in. */
function programInputRecordStageRank(stage: DeclarationEmissionInputRecord['stage']): number {
	if (stage === 'PROGRAM_CONSTRUCTION') return 0;
	if (stage === 'TYPE_CHECKER_CREATE') return 1;
	if (stage === 'CALLER_ANALYSIS') return 2;
	if (stage === 'DECLARATION_EMIT') return 3;
	return -1;
}

function programInputRecordOrdinalsAreInvalid(
	record: DeclarationEmissionInputRecord,
	index: number,
	stageRank: number,
	priorStageRank: number
): boolean {
	return (
		!Number.isSafeInteger(record.ordinal) ||
		record.ordinal < 0 ||
		!Number.isSafeInteger(record.invocationOrdinal) ||
		record.invocationOrdinal < 0 ||
		!Number.isSafeInteger(record.attributedInvocationCount) ||
		record.attributedInvocationCount <= 0 ||
		record.ordinal !== index ||
		stageRank < priorStageRank ||
		(record.stage !== 'DECLARATION_EMIT' &&
			record.invocationOrdinal >= record.attributedInvocationCount)
	);
}

function isPresentReadFileAttempt(record: DeclarationEmissionInputRecord): boolean {
	return (
		record.query.operation === 'READ_FILE' &&
		record.observation.operation === 'READ_FILE' &&
		record.observation.result === 'PRESENT'
	);
}

function declarationEmitReplayReadBytes(
	record: DeclarationEmissionInputRecord,
	declarationEmitReadBytes: number
): number {
	if (record.observation.operation === 'READ_FILE' && record.observation.result === 'PRESENT')
		return safeAddEvidenceAmount(
			declarationEmitReadBytes,
			record.observation.contentBytes,
			'Declaration-emission replay read bytes'
		);
	return declarationEmitReadBytes;
}

interface ProgramInputRecordPopulationSummary {
	readonly declarationEmitInputRecords: number;
	readonly declarationEmitReadBytes: number;
	readonly ordinalPopulationReconciles: boolean;
	readonly presentReadFileAttempts: number;
}

function summarizeProgramInputRecordPopulation(
	records: DeclarationEmissionProgramEvidence['inputRecords'],
	ledger: ResourceLedger
): ProgramInputRecordPopulationSummary {
	ledger.preflight(records.length);
	let presentReadFileAttempts = 0;
	let declarationEmitInputRecords = 0;
	let declarationEmitReadBytes = 0;
	let ordinalPopulationReconciles = true;
	let priorStageRank = 0;
	for (let index = 0; index < records.length; index += 1) {
		ledger.step();
		const record = records[index]!;
		const stageRank = programInputRecordStageRank(record.stage);
		if (programInputRecordOrdinalsAreInvalid(record, index, stageRank, priorStageRank))
			ordinalPopulationReconciles = false;
		if (stageRank >= 0) priorStageRank = stageRank;
		if (record.stage === 'DECLARATION_EMIT') {
			declarationEmitInputRecords += 1;
			declarationEmitReadBytes = declarationEmitReplayReadBytes(record, declarationEmitReadBytes);
		}
		if (isPresentReadFileAttempt(record)) presentReadFileAttempts += 1;
	}
	return Object.freeze({
		declarationEmitInputRecords,
		declarationEmitReadBytes,
		ordinalPopulationReconciles,
		presentReadFileAttempts
	});
}

interface EmissionWitnessInputs {
	readonly compilerOptionsDigest: string;
	readonly evidence: DeclarationEmissionProgramEvidence;
	readonly ledger: ResourceLedger;
	readonly limits: CompilerProjectDeclarationEmissionLimits;
	readonly outputs: readonly CompilerProjectDeclarationOutput[];
	readonly programSourcePopulationDigest: string;
	readonly selectedSourceLogicalPath: string;
	readonly semanticSourceId: SemanticSourceId;
}

function emissionWitness(
	witnessInputs: EmissionWitnessInputs
): CompilerProjectDeclarationEmissionWitness {
	const {
		compilerOptionsDigest,
		evidence,
		ledger,
		limits,
		outputs,
		programSourcePopulationDigest,
		selectedSourceLogicalPath,
		semanticSourceId
	} = witnessInputs;
	if (
		evidence.inputRecords.length > limits.maxInputRecords ||
		evidence.compilerHostCallbacks > limits.maxInputRecords ||
		evidence.compilerHostReadBytes > limits.maxReadBytes
	)
		fail('BUDGET_EXCEEDED', 'Declaration emission exceeded its input/read budgets.');
	const population = summarizeProgramInputRecordPopulation(evidence.inputRecords, ledger);
	if (
		!population.ordinalPopulationReconciles ||
		evidence.artifactParseInputRecords !== 0 ||
		evidence.artifactParseReadBytes !== 0 ||
		evidence.compilerHostCallbacks !==
			evidence.programCompilerHostCallbacks + evidence.declarationEmitInputRecords ||
		evidence.compilerHostReadBytes !==
			evidence.programCompilerHostReadBytes + evidence.declarationEmitReadBytes ||
		evidence.inputRecords.length !== evidence.compilerHostCallbacks ||
		evidence.programCompilerHostCallbacks > evidence.attributedInputRecords ||
		evidence.programCompilerHostReadBytes > evidence.attributedReadBytes ||
		population.declarationEmitInputRecords !== evidence.declarationEmitInputRecords ||
		population.declarationEmitReadBytes !== evidence.declarationEmitReadBytes
	)
		fail('CAPTURE_UNAVAILABLE', 'Finalized Program input-attempt population does not reconcile.');
	const inputRecordsDigest = bracket(ledger, () =>
		sourceOriginProgramInputAttemptPopulationDigest(evidence.inputRecords, () => ledger.step())
	);
	return Object.freeze({
		attributedCompilerInputAttempts: evidence.attributedInputRecords,
		attributedProgramReadBytes: evidence.attributedReadBytes,
		attributedUniqueQueries: evidence.attributedUniqueQueries,
		captureContextDigest: evidence.programContextDigest,
		compilerOptionsDigest,
		compilerVersion: TYPESCRIPT_PROVIDER_VERSION,
		configPath: evidence.configPath,
		declarationEmitCallbacksUseOnlyAttributedQueries:
			evidence.declarationEmitCallbacksUseOnlyAttributedQueries,
		declarationEmitCompilerInputAttempts: evidence.declarationEmitInputRecords,
		declarationEmitReadBytes: evidence.declarationEmitReadBytes,
		emitApi: 'TYPESCRIPT_PUBLIC_PROGRAM_EMIT',
		emitDiagnostics: Object.freeze([]) as readonly [],
		emitOnlyDtsFiles: true,
		emitSkipped: false,
		materializedRecipeDigest: evidence.materializedRecipeDigest,
		outputs,
		programCallbacksWithinAttributedInvocationBounds:
			evidence.programCallbacksWithinAttributedInvocationBounds,
		programCompilerInputAttempts: evidence.compilerHostCallbacks,
		programInputAttemptPopulationDigest: inputRecordsDigest,
		programInputAttemptPopulationReconciles: true,
		programPresentReadFileAttempts: population.presentReadFileAttempts,
		programReadBytes: evidence.compilerHostReadBytes,
		programSourceFiles: evidence.programSourceFiles,
		programSourceFilePopulationReconciles: true,
		programSourcePopulationDigest,
		projectResolutionDigest: evidence.projectResolutionDigest,
		semanticProgramId: evidence.semanticProgramId,
		semanticProjectId: evidence.semanticProjectId,
		semanticSourceId,
		selectedSourceLogicalPath,
		state: 'FRESH_PUBLIC_TYPESCRIPT_DECLARATION_EMISSION_OVER_VERIFIED_PROJECT_SCOPED_CAPTURE'
	});
}

type SemanticProgramSelection = StaticSemanticSnapshot['programs'][number];
type SemanticProjectSelection = StaticSemanticSnapshot['projects'][number];
type SemanticSourceSelection = StaticSemanticSnapshot['sources'][number];

function validateSelectionPreflight(
	inputs: CompilerProjectDeclarationEmissionInputs,
	limits: CompilerProjectDeclarationEmissionLimits
): void {
	if (
		inputs.semanticSnapshot.projects.length > HARD_MAX_SNAPSHOT_POPULATION ||
		inputs.semanticSnapshot.programs.length > HARD_MAX_SNAPSHOT_POPULATION ||
		inputs.semanticSnapshot.sources.length > HARD_MAX_SNAPSHOT_POPULATION ||
		inputs.semanticSnapshot.projects.length > limits.maxInputRecords ||
		inputs.semanticSnapshot.programs.length >
			limits.maxInputRecords - inputs.semanticSnapshot.projects.length ||
		inputs.semanticSnapshot.sources.length >
			limits.maxInputRecords -
				inputs.semanticSnapshot.projects.length -
				inputs.semanticSnapshot.programs.length
	)
		fail('BUDGET_EXCEEDED', 'Semantic snapshot selection populations exceed bounded preflight.');
	if (inputs.logicalPath.length > limits.maxPathCharacters)
		fail('BUDGET_EXCEEDED', 'Selected source path exceeds maxPathCharacters.');
}

function validateSelectionBindings(
	project: SemanticProjectSelection,
	program: SemanticProgramSelection,
	source: SemanticSourceSelection,
	limits: CompilerProjectDeclarationEmissionLimits,
	ledger: ResourceLedger
): void {
	if (
		project.sourceIds.length > HARD_MAX_PROGRAM_SOURCE_FILES ||
		program.sourceIds.length > HARD_MAX_PROGRAM_SOURCE_FILES ||
		project.sourceIds.length > limits.maxProgramSourceFiles ||
		program.sourceIds.length > limits.maxProgramSourceFiles
	)
		fail('BUDGET_EXCEEDED', 'Semantic project/Program source IDs exceed bounded preflight.');
	if (
		project.programId !== program.id ||
		program.projectId !== project.id ||
		source.programId !== program.id ||
		source.projectId !== project.id ||
		exactMembershipCount(program.sourceIds, source.id, ledger) !== 1 ||
		exactMembershipCount(project.sourceIds, source.id, ledger) !== 1
	)
		fail(
			'SELECTION_UNAVAILABLE',
			'Selected project, Program, and source bindings are inconsistent.'
		);
	if (source.origin !== 'AUTHORED' || source.declarationFile || source.rootFile !== true)
		fail(
			'SELECTION_UNAVAILABLE',
			'Declaration emission supports only one authored, root, non-declaration semantic source.'
		);
}

function validateExpectedProgramSourceCandidate(
	candidate: SemanticSourceSelection,
	acceptedSources: number,
	program: SemanticProgramSelection,
	limits: CompilerProjectDeclarationEmissionLimits,
	seenExpectedLogicalPaths: ReadonlySet<string>
): void {
	if (acceptedSources >= program.sourceIds.length)
		fail(
			'CAPTURE_UNAVAILABLE',
			'Semantic Program source population exceeds its exact source-ID population.'
		);
	if (
		acceptedSources >= HARD_MAX_PROGRAM_SOURCE_FILES ||
		acceptedSources >= limits.maxProgramSourceFiles
	)
		fail('BUDGET_EXCEEDED', 'Semantic Program source population exceeds its bounded gate.');
	if (
		candidate.logicalPath.length > HARD_MAX_PATH_CHARACTERS ||
		candidate.logicalPath.length > limits.maxPathCharacters
	)
		fail('BUDGET_EXCEEDED', 'Semantic Program source path exceeds maxPathCharacters.');
	if (seenExpectedLogicalPaths.has(candidate.logicalPath))
		fail('CAPTURE_UNAVAILABLE', 'Semantic Program repeats a logical source path.');
}

interface ExpectedProgramSourcePopulation {
	readonly expectedProgramSourcePaths: readonly string[];
	readonly expectedSourceIdentities: readonly SourceOriginProgramSourceIdentity[];
}

function collectExpectedProgramSourcePopulation(
	snapshot: StaticSemanticSnapshot,
	program: SemanticProgramSelection,
	limits: CompilerProjectDeclarationEmissionLimits,
	ledger: ResourceLedger
): ExpectedProgramSourcePopulation {
	ledger.preflight(snapshot.sources.length);
	const expectedProgramSourcePaths: string[] = [];
	const expectedSourceIdentities: SourceOriginProgramSourceIdentity[] = [];
	const seenExpectedLogicalPaths = new Set<string>();
	for (const candidate of snapshot.sources) {
		ledger.step();
		if (candidate.programId !== program.id) continue;
		validateExpectedProgramSourceCandidate(
			candidate,
			expectedProgramSourcePaths.length,
			program,
			limits,
			seenExpectedLogicalPaths
		);
		seenExpectedLogicalPaths.add(candidate.logicalPath);
		expectedProgramSourcePaths.push(candidate.logicalPath);
		expectedSourceIdentities.push(
			Object.freeze({
				bytes: candidate.bytes,
				contentSha256: candidate.contentSha256,
				declarationFile: candidate.declarationFile,
				logicalPath: candidate.logicalPath,
				origin: candidate.origin,
				semanticSourceId: candidate.id
			})
		);
	}
	if (expectedProgramSourcePaths.length !== program.sourceIds.length)
		fail('CAPTURE_UNAVAILABLE', 'Semantic Program source population does not reconcile.');
	return { expectedProgramSourcePaths, expectedSourceIdentities };
}

function freshProgramSourceLogicalPath(
	candidate: ts.SourceFile,
	session: CompilerProjectProgramSession,
	limits: CompilerProjectDeclarationEmissionLimits,
	ledger: ResourceLedger
): string {
	const fileName = bracket(ledger, () => candidate.fileName);
	if (
		typeof fileName !== 'string' ||
		fileName.length === 0 ||
		fileName.length > HARD_MAX_PATH_CHARACTERS ||
		fileName.length > limits.maxPathCharacters
	)
		fail('PROVIDER_FAILURE', 'Public TypeScript SourceFile lacks a valid fileName.');
	const logicalPath = bracket(ledger, () => session.toLogicalPath(fileName));
	if (
		logicalPath.length === 0 ||
		logicalPath.length > HARD_MAX_PATH_CHARACTERS ||
		logicalPath.length > limits.maxPathCharacters ||
		!isUnicodeScalarString(logicalPath)
	)
		fail('CAPTURE_UNAVAILABLE', 'Fresh Program returned an invalid logical source path.');
	return logicalPath;
}

interface FreshProgramSourceScan {
	readonly actualProgramSourcePaths: readonly string[];
	readonly selectedSourceFile: ts.SourceFile;
}

function scanFreshProgramSources(
	programSources: readonly ts.SourceFile[],
	session: CompilerProjectProgramSession,
	selectedLogicalPath: string,
	limits: CompilerProjectDeclarationEmissionLimits,
	ledger: ResourceLedger
): FreshProgramSourceScan {
	let selectedSourceFile: ts.SourceFile | undefined;
	let selectedProgramSourceMatches = 0;
	const seenLogicalPaths = new Set<string>();
	const actualProgramSourcePaths: string[] = [];
	ledger.preflight(programSources.length);
	for (const candidate of programSources) {
		ledger.step();
		const logicalPath = freshProgramSourceLogicalPath(candidate, session, limits, ledger);
		if (seenLogicalPaths.has(logicalPath))
			fail('CAPTURE_UNAVAILABLE', 'Fresh Program repeats a logical source path.');
		seenLogicalPaths.add(logicalPath);
		actualProgramSourcePaths.push(logicalPath);
		if (logicalPath !== selectedLogicalPath) continue;
		selectedProgramSourceMatches += 1;
		selectedSourceFile = candidate;
	}
	if (selectedProgramSourceMatches !== 1 || selectedSourceFile === undefined)
		fail('SELECTION_UNAVAILABLE', 'Selected semantic source is not exact in the fresh Program.');
	return { actualProgramSourcePaths, selectedSourceFile };
}

function materializedSelectedSourceText(
	selectedSourceFile: ts.SourceFile,
	source: SemanticSourceSelection,
	limits: CompilerProjectDeclarationEmissionLimits,
	ledger: ResourceLedger
): string {
	const selectedSourceText = bracket(ledger, () => selectedSourceFile.text);
	if (
		typeof selectedSourceText !== 'string' ||
		selectedSourceText.length !== source.textLength ||
		selectedSourceText.length > HARD_MAX_OUTPUT_STRING_CHARACTERS
	)
		fail('CAPTURE_UNAVAILABLE', 'Fresh Program selected source text does not reconcile.');
	const selectedSourceWitness = utf8Witness(
		selectedSourceText,
		Math.min(HARD_MAX_OUTPUT_BYTES, limits.maxReadBytes),
		ledger,
		'CAPTURE_UNAVAILABLE',
		'Fresh Program selected source text'
	);
	if (
		selectedSourceWitness.bytes !== source.bytes ||
		selectedSourceWitness.sha256 !== source.contentSha256
	)
		fail('CAPTURE_UNAVAILABLE', 'Fresh Program selected source content does not reconcile.');
	return selectedSourceText;
}

function validateDeclarationCompilerOptions(compilerOptions: ts.CompilerOptions): void {
	if (
		compilerOptions.declaration !== true ||
		compilerOptions.declarationMap !== true ||
		compilerOptions.noEmit === true ||
		compilerOptions.outFile !== undefined
	)
		fail(
			'OPTIONS_UNSUPPORTED',
			'Declaration emission requires declaration=true, declarationMap=true, noEmit must not be true, and outFile must be undefined.'
		);
}

function validateDeclarationOutputRequest(
	fileName: string,
	content: string,
	limits: CompilerProjectDeclarationEmissionLimits
): void {
	if (
		typeof fileName !== 'string' ||
		fileName.length === 0 ||
		fileName.length > HARD_MAX_PATH_CHARACTERS ||
		fileName.length > limits.maxPathCharacters ||
		typeof content !== 'string'
	)
		fail('EMIT_UNAVAILABLE', 'Declaration output path or content is invalid.');
	if (!isUnicodeScalarString(fileName))
		fail('EMIT_UNAVAILABLE', 'Declaration output path is not Unicode scalar text.');
}

function validateEmittedDeclarationSource(
	sourceFiles: readonly ts.SourceFile[] | undefined,
	session: CompilerProjectProgramSession,
	selectedLogicalPath: string,
	limits: CompilerProjectDeclarationEmissionLimits,
	ledger: ResourceLedger
): void {
	const emittedSourceFiles = copiedDenseProviderArray<ts.SourceFile>(
		sourceFiles,
		1,
		ledger,
		'Public TypeScript declaration-output source files',
		'EMIT_UNAVAILABLE'
	);
	if (emittedSourceFiles.length !== 1)
		fail(
			'EMIT_UNAVAILABLE',
			'Every declaration output must identify exactly one bounded source file.'
		);
	const emittedSourceFileName = bracket(ledger, () => emittedSourceFiles[0]!.fileName);
	if (
		typeof emittedSourceFileName !== 'string' ||
		emittedSourceFileName.length === 0 ||
		emittedSourceFileName.length > HARD_MAX_PATH_CHARACTERS ||
		emittedSourceFileName.length > limits.maxPathCharacters
	)
		fail('EMIT_UNAVAILABLE', 'Declaration output source fileName is invalid.');
	const emittedSourceLogicalPath = bracket(ledger, () =>
		session.toLogicalPath(emittedSourceFileName)
	);
	if (emittedSourceLogicalPath !== selectedLogicalPath)
		fail(
			'EMIT_UNAVAILABLE',
			'Every declaration output must identify the exact selected logical source.'
		);
}

function validateDeclarationOutputLogicalPath(
	logicalPath: string,
	limits: CompilerProjectDeclarationEmissionLimits
): void {
	if (
		logicalPath.length === 0 ||
		logicalPath.length > HARD_MAX_PATH_CHARACTERS ||
		logicalPath.length > limits.maxPathCharacters ||
		!isUnicodeScalarString(logicalPath)
	)
		fail('EMIT_UNAVAILABLE', 'Declaration output logical path is invalid.');
}

function declarationOutputKind(fileName: string): CompilerProjectDeclarationOutput['kind'] {
	if (fileName.endsWith('.d.ts.map')) return 'DECLARATION_MAP';
	if (fileName.endsWith('.d.ts')) return 'DECLARATION';
	fail('EMIT_UNAVAILABLE', 'Declaration emitter produced an output outside .d.ts.map and .d.ts.');
}

/**
 * @internal Produces exactly one declaration and one declaration map for an exact authored
 * source in a freshly reconstructed, project-scoped public TypeScript Program.
 */
export function emitCompilerProjectDeclaration(
	inputsValue: unknown,
	limitsValue: unknown,
	runtimeValue: unknown = undefined
): CompilerProjectDeclarationEmission {
	const inputs = validateInputs(inputsValue);
	const limits = validateEmitLimits(limitsValue);
	const runtime = optionalRuntimeOptions(runtimeValue);
	const ledger = resourceLedger(limits, runtime);
	ledger.checkpoint();
	validateSelectionPreflight(inputs, limits);
	const snapshot = inputs.semanticSnapshot;
	if (inputs.frozenSubject.descriptor.subjectId !== snapshot.subjectId)
		fail('CAPTURE_UNAVAILABLE', 'FrozenSubject and semantic snapshot subject identities differ.');
	const project = uniqueMatch(
		snapshot.projects,
		(candidate) => candidate.id === inputs.semanticProjectId,
		ledger,
		'Declaration emission requires one exact semantic project.'
	);
	const program = uniqueMatch(
		snapshot.programs,
		(candidate) => candidate.id === inputs.semanticProgramId,
		ledger,
		'Declaration emission requires one exact semantic Program.'
	);
	const source = uniqueMatch(
		snapshot.sources,
		(candidate) =>
			candidate.id === inputs.semanticSourceId && candidate.logicalPath === inputs.logicalPath,
		ledger,
		'Declaration emission requires one exact semantic source and logical path.'
	);
	validateSelectionBindings(project, program, source, limits, ledger);
	const expectedPopulation = collectExpectedProgramSourcePopulation(
		snapshot,
		program,
		limits,
		ledger
	);
	const expectedSortedSourcePaths = sortedTextPopulation(
		expectedPopulation.expectedProgramSourcePaths,
		ledger
	);
	const orderedSourceIdentities = sortedSourceIdentityPopulation(
		expectedPopulation.expectedSourceIdentities,
		ledger
	);

	const compilerLimits = effectiveProgramLimits(
		inputs.compilerProgramLimits,
		limits,
		ledger.remainingDurationMs()
	);
	const sessionRuntime = Object.freeze({
		now: runtime.now,
		onInput(stage: Parameters<NonNullable<CompilerProjectProgramRuntimeOptions['onInput']>>[0]) {
			ledger.checkpoint();
			try {
				runtime.onInput?.(stage);
			} finally {
				ledger.checkpoint();
			}
		}
	});
	const session = bracket(ledger, () =>
		compilerProjectDeclarationEmissionCompilerProgramCapability.createCompilerProjectProgramSession(
			snapshot,
			project.configPath,
			compilerLimits,
			sessionRuntime
		)
	);
	const programSourcesValue = bracket(ledger, () =>
		compilerProjectDeclarationEmissionTypeScriptPublicApi.getSourceFiles(session.program)
	);
	const programSources = bracket(ledger, () =>
		copiedDenseProviderArray<ts.SourceFile>(
			programSourcesValue,
			HARD_MAX_PROGRAM_SOURCE_FILES,
			ledger,
			'Public TypeScript Program source files'
		)
	);
	if (
		programSources.length > HARD_MAX_PROGRAM_SOURCE_FILES ||
		programSources.length > limits.maxProgramSourceFiles
	)
		fail('BUDGET_EXCEEDED', 'Declaration emission exceeded maxProgramSourceFiles.');
	const { actualProgramSourcePaths, selectedSourceFile } = scanFreshProgramSources(
		programSources,
		session,
		inputs.logicalPath,
		limits,
		ledger
	);
	if (bracket(ledger, () => selectedSourceFile.isDeclarationFile))
		fail('SELECTION_UNAVAILABLE', 'Fresh Program selected source is a declaration file.');
	const actualSortedSourcePaths = sortedTextPopulation(actualProgramSourcePaths, ledger);
	if (!sameTextPopulation(expectedSortedSourcePaths, actualSortedSourcePaths, ledger))
		fail('CAPTURE_UNAVAILABLE', 'Fresh Program source-file population does not reconcile.');
	const programSourcePopulationDigest = bracket(ledger, () =>
		sourceOriginProgramSourcePopulationDigest(orderedSourceIdentities, () => ledger.step())
	);
	const selectedSourceText = materializedSelectedSourceText(
		selectedSourceFile,
		source,
		limits,
		ledger
	);
	const materializedSource = Object.freeze({
		contentBytes: source.bytes,
		contentSha256: source.contentSha256,
		logicalPath: source.logicalPath,
		semanticProgramId: program.id,
		semanticProjectId: project.id,
		semanticSourceId: source.id,
		text: selectedSourceText,
		textLength: source.textLength
	});

	const compilerOptionsValue = bracket(ledger, () =>
		compilerProjectDeclarationEmissionTypeScriptPublicApi.getCompilerOptions(session.program)
	);
	const compilerOptions = bracket(ledger, () =>
		copiedCompilerOptions(compilerOptionsValue, ledger)
	);
	validateDeclarationCompilerOptions(compilerOptions);
	const compilerOptionsDigest = bracket(
		ledger,
		() => canonicalSemanticJsonWitnessWithProgress(compilerOptions, () => ledger.step()).sha256
	);

	const outputs: CompilerProjectDeclarationOutput[] = [];
	const rawOutputPaths = new Set<string>();
	const logicalOutputPaths = new Set<string>();
	let outputBytes = 0;
	let outputStringCharacters = 0;
	let declarationOutputs = 0;
	let declarationMapOutputs = 0;
	const writeFile: DeclarationWriteFile = (
		fileName,
		content,
		writeByteOrderMark,
		_onError,
		sourceFiles
	): void => {
		ledger.checkpoint();
		if (outputs.length >= HARD_MAX_EMITTED_FILES || outputs.length >= limits.maxOutputFiles)
			fail('BUDGET_EXCEEDED', 'Declaration emission exceeded maxOutputFiles.');
		validateDeclarationOutputRequest(fileName, content, limits);
		if (
			content.length > HARD_MAX_OUTPUT_STRING_CHARACTERS - outputStringCharacters ||
			content.length > limits.maxOutputStringCharacters - outputStringCharacters
		)
			fail('BUDGET_EXCEEDED', 'Declaration emission exceeded maxOutputStringCharacters.');
		outputStringCharacters += content.length;
		if (writeByteOrderMark !== false || content.codePointAt(0) === 0xfeff)
			fail('EMIT_UNAVAILABLE', 'Declaration outputs must be UTF-8 without a byte-order mark.');
		validateEmittedDeclarationSource(sourceFiles, session, inputs.logicalPath, limits, ledger);
		if (rawOutputPaths.has(fileName))
			fail('EMIT_UNAVAILABLE', 'Declaration emitter repeated an output file path.');
		const logicalPath = bracket(ledger, () => session.toLogicalPath(fileName));
		validateDeclarationOutputLogicalPath(logicalPath, limits);
		if (logicalOutputPaths.has(logicalPath))
			fail('EMIT_UNAVAILABLE', 'Declaration emitter repeated a normalized output path.');
		const kind = declarationOutputKind(fileName);
		const contentWitness = utf8Witness(
			content,
			Math.min(HARD_MAX_OUTPUT_BYTES - outputBytes, limits.maxOutputBytes - outputBytes),
			ledger
		);
		outputBytes += contentWitness.bytes;
		ledger.checkpoint();
		rawOutputPaths.add(fileName);
		logicalOutputPaths.add(logicalPath);
		outputs.push(
			Object.freeze({
				bytes: contentWitness.bytes,
				content,
				contentSha256: contentWitness.sha256,
				kind,
				logicalPath,
				sourceLogicalPath: inputs.logicalPath,
				textLength: content.length,
				writeByteOrderMark: false as const
			})
		);
		if (kind === 'DECLARATION') declarationOutputs += 1;
		else declarationMapOutputs += 1;
		ledger.checkpoint();
	};
	const emitResultValue = bracket(ledger, () =>
		session.withDeclarationEmit(() =>
			bracket(ledger, () =>
				compilerProjectDeclarationEmissionTypeScriptPublicApi.emit(
					session.program,
					selectedSourceFile,
					writeFile
				)
			)
		)
	);
	const emitResult = bracket(ledger, () => copiedEmitResult(emitResultValue, ledger));
	if (emitResult.emitSkipped !== false || emitResult.diagnostics.length !== 0)
		fail('EMIT_UNAVAILABLE', 'Public TypeScript declaration emit was skipped or diagnostic.');
	if (outputs.length !== 2 || declarationOutputs !== 1 || declarationMapOutputs !== 1)
		fail('EMIT_UNAVAILABLE', 'Declaration emission requires exactly one .d.ts and one .d.ts.map.');
	outputs.sort((left, right) => {
		if (left.kind === right.kind) return 0;
		if (left.kind === 'DECLARATION_MAP') return -1;
		return 1;
	});
	Object.freeze(outputs);

	const evidenceValue = bracket(ledger, () => session.finalize());
	const witness = bracket(ledger, () => {
		const evidence = copiedProgramEvidence(evidenceValue, ledger);
		if (
			evidence.subjectId !== snapshot.subjectId ||
			evidence.semanticProjectId !== project.id ||
			evidence.semanticProgramId !== program.id ||
			evidence.configPath !== project.configPath ||
			evidence.programSourceFiles !== programSources.length
		)
			fail(
				'CAPTURE_UNAVAILABLE',
				'Finalized compiler session does not reconcile the exact selection.'
			);
		return emissionWitness({
			compilerOptionsDigest,
			evidence,
			ledger,
			limits,
			outputs,
			programSourcePopulationDigest,
			selectedSourceLogicalPath: inputs.logicalPath,
			semanticSourceId: source.id
		});
	});
	ledger.checkpoint();
	return Object.freeze({
		emissionWitness: witness,
		materializedSource,
		outputs,
		selection: Object.freeze({
			logicalPath: inputs.logicalPath,
			semanticProgramId: program.id,
			semanticProjectId: project.id,
			semanticSourceId: source.id
		}),
		version: COMPILER_PROJECT_DECLARATION_EMISSION_VERSION
	});
}
