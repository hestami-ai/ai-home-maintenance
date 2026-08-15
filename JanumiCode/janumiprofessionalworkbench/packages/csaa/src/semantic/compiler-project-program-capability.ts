import { posix } from 'node:path';
import { isProxy } from 'node:util/types';

import ts from 'typescript';

import {
	TYPESCRIPT_PROVIDER_VERSION,
	type CompilerInputObservation,
	type SemanticContextInputId,
	type SemanticProgramId,
	type SemanticProjectId,
	type StaticSemanticSnapshot
} from '../contracts/semantic.js';
import type { ProgramRecipe } from '../contracts/subject.js';
import {
	CompilerInputCaptureError,
	type CompilerInputQuery,
	type VerifiedCompilerProjectInputEntry,
	type VerifiedCompilerProjectInputLookup
} from '../providers/typescript/compiler-input-journal.js';
import {
	createPrevalidatedVerifiedCompilerProjectInputHost,
	type ExtendedCompilerHost,
	type VerifiedCompilerSourceEncoding
} from '../providers/typescript/frozen-compiler-host.js';
import {
	MATERIALIZED_ARRAY_PATH_OPTIONS,
	MATERIALIZED_SCALAR_PATH_OPTIONS,
	type MaterializedProgramRecipe
} from '../providers/typescript/materialize-program-recipe.js';
import { canonicalSemanticJsonWitnessWithProgress } from './canonical.js';
import { getStaticSemanticSnapshotCompilerProjectInputLookup } from './compiler-capture-capability.js';
import { createMonotonicOperationClock } from './monotonic-operation-clock.js';

export const COMPILER_PROJECT_PROGRAM_CAPABILITY_VERSION =
	'jan-csaa-verified-compiler-project-program/1.1.0' as const;

export type CompilerProjectProgramInputStage =
	| 'PROGRAM_CONSTRUCTION'
	| 'TYPE_CHECKER_CREATE'
	| 'CALLER_ANALYSIS'
	| 'DECLARATION_EMIT'
	| 'DECLARATION_ARTIFACT_PARSE';

export interface CompilerProjectProgramLimits {
	readonly maxDurationMs: number;
	readonly maxProgramInputRecords: number;
	readonly maxProgramReadBytes: number;
	readonly maxProgramSourceFiles: number;
	readonly maxTotalInputRecords: number;
	readonly maxTotalReadBytes: number;
}

export interface CompilerProjectProgramInputRecord {
	readonly attributedInvocationCount: number;
	readonly invocationOrdinal: number;
	readonly observation: CompilerInputObservation;
	readonly ordinal: number;
	readonly query: CompilerInputQuery;
	readonly stage: CompilerProjectProgramInputStage;
}

export interface CompilerProjectProgramEvidence {
	readonly attributedInputRecords: number;
	readonly attributedReadBytes: number;
	readonly attributedUniqueQueries: number;
	readonly artifactParseInputRecords: number;
	readonly artifactParseReadBytes: number;
	readonly compilerHostCallbacks: number;
	readonly compilerHostReadBytes: number;
	readonly configPath: string;
	readonly contextInputIds: readonly SemanticContextInputId[];
	readonly declarationEmitCallbacksUseOnlyAttributedQueries: true;
	readonly declarationEmitInputRecords: number;
	readonly declarationEmitReadBytes: number;
	readonly inputRecords: readonly CompilerProjectProgramInputRecord[];
	readonly materializedRecipeDigest: string;
	/** Every callback outside artifact-parse and declaration-emit replay stayed within its captured per-query invocation upper bound. */
	readonly programCallbacksWithinAttributedInvocationBounds: true;
	readonly programCompilerHostCallbacks: number;
	readonly programCompilerHostReadBytes: number;
	readonly programContextDigest: string;
	readonly programSourceFiles: number;
	readonly projectResolutionDigest: string;
	readonly semanticProgramId: SemanticProgramId;
	readonly semanticProjectId: SemanticProjectId;
	readonly state: 'VERIFIED_PROJECT_SCOPED_FRESH_PROGRAM';
	readonly subjectId: string;
	readonly version: typeof COMPILER_PROJECT_PROGRAM_CAPABILITY_VERSION;
}

/**
 * @internal Exact-object, non-portable compiler context. Calling `finalize` seals the input
 * journal; subsequent compiler-host reads fail closed.
 */
export interface CompilerProjectProgramSession {
	readonly checker: ts.TypeChecker;
	readonly configPath: string;
	readonly program: ts.Program;
	readonly semanticProgramId: SemanticProgramId;
	readonly semanticProjectId: SemanticProjectId;
	finalize(): CompilerProjectProgramEvidence;
	parseCapturedSourceFile(logicalPath: string): CompilerProjectParsedSource;
	toLogicalPath(path: string): string;
	withDeclarationEmit<Value>(operation: () => Value): Value;
}

/** @internal One explicit fresh CAP-001 parse sourced through a separately charged captured read. */
export interface CompilerProjectParsedSource {
	readonly contentBytes: number;
	readonly contentSha256: string;
	readonly encoding: 'UTF16BE_BOM' | 'UTF16LE_BOM' | 'UTF8' | 'UTF8_BOM';
	readonly inputRecordOrdinal: number;
	readonly logicalPath: string;
	readonly sourceFile: ts.SourceFile;
	readonly textLength: number;
}

export interface CompilerProjectProgramRuntimeOptions {
	/** Test-only clock. Production callers omit this and receive a monotonic wall-anchored clock. */
	readonly now?: () => number;
	/** Internal resource ledger hook invoked once before each accepted compiler-host callback. */
	readonly onInput?: (stage: CompilerProjectProgramInputStage) => void;
}

const LIMIT_KEYS = [
	'maxDurationMs',
	'maxProgramInputRecords',
	'maxProgramReadBytes',
	'maxProgramSourceFiles',
	'maxTotalInputRecords',
	'maxTotalReadBytes'
] as const;
const RESOURCE_CHECKPOINT_CADENCE = 256;

interface ResourceProgress {
	readonly finish: () => void;
	readonly step: () => void;
}

function fail(
	code: 'BUDGET_EXCEEDED' | 'CAPTURE_UNAVAILABLE' | 'INPUT_INVALID' | 'PROGRAM_UNAVAILABLE',
	message: string
): never {
	throw new CompilerProjectProgramCapabilityError(code, message);
}

function rethrowCaptureError(error: unknown): never {
	if (error instanceof CompilerProjectProgramCapabilityError) throw error;
	if (error instanceof CompilerInputCaptureError)
		fail(
			error.code === 'BUDGET_EXCEEDED' ? 'BUDGET_EXCEEDED' : 'CAPTURE_UNAVAILABLE',
			'Verified compiler input capture failed during fresh Program replay.'
		);
	throw error;
}

function captureBoundary<Value>(operation: () => Value): Value {
	try {
		return operation();
	} catch (error) {
		return rethrowCaptureError(error);
	}
}

function captureBoundHost(host: ExtendedCompilerHost): ExtendedCompilerHost {
	const descriptors = Object.getOwnPropertyDescriptors(host);
	for (const key of Reflect.ownKeys(descriptors)) {
		const descriptor = descriptors[key as keyof typeof descriptors];
		if (
			descriptor !== undefined &&
			'value' in descriptor &&
			typeof descriptor.value === 'function'
		) {
			const method = descriptor.value as (...args: readonly unknown[]) => unknown;
			descriptor.value = (...args: readonly unknown[]) =>
				captureBoundary(() => Reflect.apply(method, host, args));
		}
	}
	return Object.freeze(
		Object.defineProperties(Object.create(Object.getPrototypeOf(host)), descriptors)
	) as ExtendedCompilerHost;
}

export class CompilerProjectProgramCapabilityError extends Error {
	constructor(
		readonly code:
			'BUDGET_EXCEEDED' | 'CAPTURE_UNAVAILABLE' | 'INPUT_INVALID' | 'PROGRAM_UNAVAILABLE',
		message: string
	) {
		super(message);
		this.name = 'CompilerProjectProgramCapabilityError';
	}
}

function inertLimits(value: unknown): CompilerProjectProgramLimits {
	if (
		value === null ||
		typeof value !== 'object' ||
		isProxy(value) ||
		Array.isArray(value) ||
		(Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
	)
		fail('INPUT_INVALID', 'Compiler project Program limits must be an inert plain object.');
	const descriptors = Object.getOwnPropertyDescriptors(value);
	if (
		Reflect.ownKeys(descriptors).some((key) => typeof key !== 'string') ||
		Object.keys(descriptors).sort().join('\0') !== [...LIMIT_KEYS].sort().join('\0')
	)
		fail('INPUT_INVALID', 'Compiler project Program limits have an invalid exact key set.');
	const limits: Record<string, number> = {};
	for (const key of LIMIT_KEYS) {
		const descriptor = descriptors[key];
		if (
			descriptor === undefined ||
			!descriptor.enumerable ||
			!('value' in descriptor) ||
			typeof descriptor.value !== 'number' ||
			!Number.isSafeInteger(descriptor.value) ||
			descriptor.value < 0
		)
			fail(
				'INPUT_INVALID',
				`Compiler project Program limit ${key} must be a nonnegative safe integer.`
			);
		limits[key] = descriptor.value;
	}
	if (limits.maxDurationMs === 0)
		fail('INPUT_INVALID', 'Compiler project Program maxDurationMs must be positive.');
	const result = Object.freeze(limits) as unknown as CompilerProjectProgramLimits;
	if (
		result.maxTotalInputRecords < result.maxProgramInputRecords ||
		result.maxTotalReadBytes < result.maxProgramReadBytes
	)
		fail(
			'INPUT_INVALID',
			'Compiler project Program total limits must cover their Program-construction limits.'
		);
	return result;
}

function safeAdd(left: number, right: number, label: string): number {
	const value = left + right;
	if (!Number.isSafeInteger(value)) fail('BUDGET_EXCEEDED', `${label} exceeds safe-integer range.`);
	return value;
}

function safeMultiply(left: number, right: number, label: string): number {
	const value = left * right;
	if (!Number.isSafeInteger(value)) fail('BUDGET_EXCEEDED', `${label} exceeds safe-integer range.`);
	return value;
}

function resourceProgress(onProgress: () => void): ResourceProgress {
	let workSinceProgress = 0;
	onProgress();
	return {
		finish: onProgress,
		step(): void {
			workSinceProgress += 1;
			if (workSinceProgress < RESOURCE_CHECKPOINT_CADENCE) return;
			workSinceProgress = 0;
			onProgress();
		}
	};
}

function cloneValidatedRecipeOption(value: unknown, onProgress: () => void): unknown {
	onProgress();
	if (value === null || typeof value !== 'object') return value;
	if (Array.isArray(value)) {
		const result: unknown[] = [];
		for (const child of value) {
			onProgress();
			result.push(cloneValidatedRecipeOption(child, onProgress));
		}
		return result;
	}
	const result: Record<string, unknown> = {};
	for (const key of Object.keys(value)) {
		onProgress();
		result[key] = cloneValidatedRecipeOption(
			(value as Readonly<Record<string, unknown>>)[key],
			onProgress
		);
	}
	return result;
}

function materializeCapturedRecipe(
	recipeValue: ProgramRecipe,
	lookup: VerifiedCompilerProjectInputLookup,
	onProgress: () => void
): MaterializedProgramRecipe {
	const progress = resourceProgress(onProgress);
	if (!Object.isFrozen(recipeValue))
		fail(
			'CAPTURE_UNAVAILABLE',
			'Prevalidated compiler ProgramRecipe must be retained by the exact frozen semantic snapshot.'
		);
	const recipe = recipeValue;
	onProgress();
	const compilerOptions: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(recipe.compilerOptions)) {
		progress.step();
		if (MATERIALIZED_SCALAR_PATH_OPTIONS.has(key)) {
			compilerOptions[key] = lookup.toRecordedAbsolute(value as string);
			onProgress();
			continue;
		}
		if (MATERIALIZED_ARRAY_PATH_OPTIONS.has(key)) {
			const paths: string[] = [];
			for (const path of value as readonly string[]) {
				progress.step();
				paths.push(lookup.toRecordedAbsolute(path));
				onProgress();
			}
			compilerOptions[key] = paths;
			continue;
		}
		progress.step();
		compilerOptions[key] = cloneValidatedRecipeOption(value, onProgress);
		onProgress();
	}
	if (
		recipe.compilerOptions.paths !== undefined &&
		recipe.compilerOptions.baseUrl === undefined &&
		recipe.compilerOptions.pathsBasePath === undefined
	)
		compilerOptions.pathsBasePath = lookup.toRecordedAbsolute(posix.dirname(recipe.configPath));
	onProgress();
	const projectReferences: ts.ProjectReference[] = [];
	for (const path of recipe.projectReferences) {
		progress.step();
		projectReferences.push({ path: lookup.toRecordedAbsolute(path) });
		onProgress();
	}
	const rootNames: string[] = [];
	for (const path of recipe.rootNames) {
		progress.step();
		rootNames.push(lookup.toRecordedAbsolute(path));
		onProgress();
	}
	const materialized = {
		compilerOptions: compilerOptions as ts.CompilerOptions,
		configFilePath: lookup.toRecordedAbsolute(recipe.configPath),
		projectReferences,
		rootNames
	};
	progress.finish();
	return materialized;
}

function presentReadBytes(observation: CompilerInputObservation): number {
	return observation.operation === 'READ_FILE' && observation.result === 'PRESENT'
		? observation.contentBytes
		: 0;
}

function sourceScriptKind(logicalPath: string): ts.ScriptKind {
	if (/\.tsx$/iu.test(logicalPath)) return ts.ScriptKind.TSX;
	if (/\.[cm]?jsx?$/iu.test(logicalPath))
		return /x$/iu.test(logicalPath) ? ts.ScriptKind.JSX : ts.ScriptKind.JS;
	if (/\.json$/iu.test(logicalPath)) return ts.ScriptKind.JSON;
	return ts.ScriptKind.TS;
}

function sameStringArray(
	left: readonly string[],
	right: readonly string[],
	onProgress: () => void
): boolean {
	if (left.length !== right.length) return false;
	for (let index = 0; index < left.length; index += 1) {
		onProgress();
		if (!sameText(left[index]!, right[index]!, onProgress)) return false;
	}
	return true;
}

function sameText(left: string, right: string, onProgress: () => void): boolean {
	if (left.length !== right.length) return false;
	for (let index = 0; index < left.length; index += 1) {
		onProgress();
		if (left.charCodeAt(index) !== right.charCodeAt(index)) return false;
	}
	return true;
}

function compareText(left: string, right: string, onProgress: () => void): number {
	const length = Math.min(left.length, right.length);
	for (let index = 0; index < length; index += 1) {
		onProgress();
		const difference = left.charCodeAt(index) - right.charCodeAt(index);
		if (difference !== 0) return difference < 0 ? -1 : 1;
	}
	return left.length < right.length ? -1 : left.length > right.length ? 1 : 0;
}

function sameCompilerInputQuery(
	left: CompilerInputQuery,
	right: CompilerInputQuery,
	onProgress: () => void
): boolean {
	onProgress();
	if (
		left.operation !== right.operation ||
		!sameText(left.logicalPath, right.logicalPath, onProgress)
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

function exactProject(
	snapshot: StaticSemanticSnapshot,
	configPath: string,
	onProgress: () => void
): {
	readonly lookup: VerifiedCompilerProjectInputLookup;
	readonly program: StaticSemanticSnapshot['programs'][number];
	readonly project: StaticSemanticSnapshot['projects'][number];
} {
	if (!Object.isFrozen(snapshot))
		fail(
			'CAPTURE_UNAVAILABLE',
			'Fresh compiler Program requires the exact frozen semantic snapshot.'
		);
	if (typeof configPath !== 'string' || configPath.length === 0)
		fail('INPUT_INVALID', 'Compiler project Program configPath must be a nonempty string.');
	let project: StaticSemanticSnapshot['projects'][number] | undefined;
	let projectMatches = 0;
	for (const candidate of snapshot.projects) {
		onProgress();
		if (!sameText(candidate.configPath, configPath, onProgress)) continue;
		projectMatches += 1;
		project = candidate;
	}
	if (projectMatches !== 1 || project === undefined)
		fail('INPUT_INVALID', 'Compiler project Program requires one exact semantic project.');
	let program: StaticSemanticSnapshot['programs'][number] | undefined;
	let programMatches = 0;
	for (const candidate of snapshot.programs) {
		onProgress();
		if (candidate.id !== project.programId) continue;
		programMatches += 1;
		program = candidate;
	}
	if (programMatches !== 1 || program === undefined || program.projectId !== project.id)
		fail('INPUT_INVALID', 'Compiler project Program semantic project/program binding is invalid.');
	onProgress();
	const lookup = getStaticSemanticSnapshotCompilerProjectInputLookup(snapshot, configPath);
	onProgress();
	if (lookup === undefined)
		fail(
			'CAPTURE_UNAVAILABLE',
			'Exact semantic snapshot lacks a verified compiler project input capability.'
		);
	return { lookup, program, project };
}

/**
 * @internal Opens one fresh TypeScript Program and TypeChecker over only the exact verified
 * project-attributed capture attached to the supplied semantic snapshot object.
 */
export function createCompilerProjectProgramSession(
	snapshot: StaticSemanticSnapshot,
	configPath: string,
	limitsValue: unknown,
	runtimeOptions: CompilerProjectProgramRuntimeOptions = {}
): CompilerProjectProgramSession {
	const limits = inertLimits(limitsValue);
	const now = runtimeOptions.now ?? createMonotonicOperationClock().now;
	const onInput = runtimeOptions.onInput;
	const readClock = (): number => {
		try {
			return now();
		} catch {
			fail('BUDGET_EXCEEDED', 'Fresh compiler Program monotonic clock failed closed.');
		}
	};
	const startedAtMs = readClock();
	const assertWithinDeadline = (): void => {
		const current = readClock();
		const elapsedMs = current - startedAtMs;
		if (
			!Number.isSafeInteger(startedAtMs) ||
			startedAtMs < 0 ||
			!Number.isSafeInteger(current) ||
			!Number.isSafeInteger(elapsedMs) ||
			elapsedMs < 0 ||
			elapsedMs > limits.maxDurationMs
		)
			fail('BUDGET_EXCEEDED', 'Fresh compiler Program exceeded maxDurationMs.');
	};
	assertWithinDeadline();
	const setupProgress = resourceProgress(assertWithinDeadline);
	const bound = exactProject(snapshot, configPath, setupProgress.step);
	if (ts.version !== TYPESCRIPT_PROVIDER_VERSION || snapshot.provider.version !== ts.version)
		fail(
			'PROGRAM_UNAVAILABLE',
			'Fresh compiler Program TypeScript version does not match snapshot.'
		);

	if (bound.program.sourceIds.length > limits.maxProgramSourceFiles)
		fail('BUDGET_EXCEEDED', 'Semantic Program source population exceeds its fresh-Program budget.');
	const expectedSources: string[] = [];
	for (const source of snapshot.sources) {
		setupProgress.step();
		if (source.programId !== bound.program.id) continue;
		if (expectedSources.length >= bound.program.sourceIds.length)
			fail(
				'CAPTURE_UNAVAILABLE',
				'Semantic Program source IDs do not reproduce its exact source population.'
			);
		expectedSources.push(source.logicalPath);
	}
	expectedSources.sort((left, right) => {
		setupProgress.step();
		return compareText(left, right, setupProgress.step);
	});
	if (expectedSources.length !== bound.program.sourceIds.length)
		fail(
			'CAPTURE_UNAVAILABLE',
			'Semantic Program source IDs do not reproduce its exact source population.'
		);

	let attributedInputRecords = 0;
	let attributedReadBytes = 0;
	const attributedLimitsByInputId = new Map<SemanticContextInputId, number>();
	const attributedQueriesByInputId = new Map<SemanticContextInputId, CompilerInputQuery>();
	for (const attribution of bound.lookup.attribution.queryInvocations) {
		setupProgress.step();
		let found = false;
		captureBoundary(() =>
			bound.lookup.withAttributedQueryForVerifiedHost(
				attribution.query,
				setupProgress.step,
				(entry) => {
					found = true;
					if (
						entry.attributedInvocationCount !== attribution.invocationCount ||
						!sameCompilerInputQuery(entry.query, attribution.query, setupProgress.step)
					)
						fail(
							'CAPTURE_UNAVAILABLE',
							'Verified project attribution contains an unavailable query.'
						);
					const inputId = entry.observation.id;
					if (attributedLimitsByInputId.has(inputId))
						fail(
							'CAPTURE_UNAVAILABLE',
							'Verified project attribution repeats a context-input identity.'
						);
					attributedLimitsByInputId.set(inputId, attribution.invocationCount);
					attributedQueriesByInputId.set(inputId, attribution.query);
					attributedInputRecords = safeAdd(
						attributedInputRecords,
						attribution.invocationCount,
						'Attributed compiler input records'
					);
					attributedReadBytes = safeAdd(
						attributedReadBytes,
						safeMultiply(
							presentReadBytes(entry.observation),
							attribution.invocationCount,
							'Attributed compiler read bytes'
						),
						'Attributed compiler read bytes'
					);
					if (
						attributedInputRecords > limits.maxProgramInputRecords ||
						attributedReadBytes > limits.maxProgramReadBytes
					)
						fail(
							'BUDGET_EXCEEDED',
							'Verified project-attributed compiler inputs exceed the fresh-Program preflight budget.'
						);
				}
			)
		);
		assertWithinDeadline();
		if (!found)
			fail('CAPTURE_UNAVAILABLE', 'Verified project attribution contains an unavailable query.');
	}
	setupProgress.finish();

	let finalized = false;
	let declarationEmitActive = false;
	let stage: CompilerProjectProgramInputStage = 'PROGRAM_CONSTRUCTION';
	let compilerHostReadBytes = 0;
	let programCompilerHostCallbacks = 0;
	let programCompilerHostReadBytes = 0;
	let declarationEmitInputRecords = 0;
	let declarationEmitReadBytes = 0;
	let artifactParseInputRecords = 0;
	let artifactParseReadBytes = 0;
	let pendingArtifactEncoding: VerifiedCompilerSourceEncoding | null = null;
	const invocationCounts = new Map<SemanticContextInputId, number>();
	const inputRecords: CompilerProjectProgramInputRecord[] = [];
	const materialized = captureBoundary(() =>
		materializeCapturedRecipe(bound.project.programRecipe, bound.lookup, assertWithinDeadline)
	);
	assertWithinDeadline();
	const materializedRecipeDigest = canonicalSemanticJsonWitnessWithProgress(
		materialized,
		assertWithinDeadline
	).sha256;
	const materializedProjectKey = captureBoundary(() =>
		bound.lookup.toRecordedLogical(materialized.configFilePath)
	);
	assertWithinDeadline();
	if (
		!sameText(materializedProjectKey, bound.lookup.attribution.projectKey, assertWithinDeadline) ||
		materializedRecipeDigest !== bound.lookup.attribution.materializedRecipeDigest ||
		bound.project.programRecipe.projectResolutionDigest !==
			bound.lookup.attribution.projectResolutionDigest
	)
		fail(
			'CAPTURE_UNAVAILABLE',
			'Prevalidated semantic ProgramRecipe does not reproduce its verified project attribution.'
		);
	let host: ExtendedCompilerHost;
	try {
		const prevalidatedHost = createPrevalidatedVerifiedCompilerProjectInputHost(
			materialized,
			bound.project.programRecipe.projectResolutionDigest,
			bound.lookup,
			snapshot.budgets,
			{
				assertWithinDeadline() {
					if (finalized)
						fail('CAPTURE_UNAVAILABLE', 'Fresh compiler Program input journal is finalized.');
					assertWithinDeadline();
				},
				onInput(
					entry: VerifiedCompilerProjectInputEntry,
					sourceEncoding: VerifiedCompilerSourceEncoding | null
				) {
					assertWithinDeadline();
					const inputId = entry.observation.id;
					const invocationOrdinal = invocationCounts.get(inputId) ?? 0;
					const attributedLimit = attributedLimitsByInputId.get(inputId);
					const attributedQuery = attributedQueriesByInputId.get(inputId);
					if (
						attributedLimit === undefined ||
						attributedQuery === undefined ||
						entry.attributedInvocationCount !== attributedLimit ||
						!sameCompilerInputQuery(entry.query, attributedQuery, assertWithinDeadline)
					)
						fail(
							'CAPTURE_UNAVAILABLE',
							'Fresh compiler Program requested an input outside its exact attributed population.'
						);
					const declarationEmitStage = stage === 'DECLARATION_EMIT';
					const programStage = stage !== 'DECLARATION_ARTIFACT_PARSE' && !declarationEmitStage;
					if (programStage && invocationOrdinal >= attributedLimit)
						fail(
							'CAPTURE_UNAVAILABLE',
							'Fresh compiler Program exceeded an attributed query invocation population during construction.'
						);
					if (inputRecords.length >= limits.maxTotalInputRecords)
						fail('BUDGET_EXCEEDED', 'Fresh compiler Program exceeded maxTotalInputRecords.');
					if (programStage && programCompilerHostCallbacks >= limits.maxProgramInputRecords)
						fail('BUDGET_EXCEEDED', 'Fresh compiler Program exceeded maxProgramInputRecords.');
					onInput?.(stage);
					const readBytes = presentReadBytes(entry.observation);
					compilerHostReadBytes = safeAdd(
						compilerHostReadBytes,
						readBytes,
						'Fresh compiler Program read bytes'
					);
					if (compilerHostReadBytes > limits.maxTotalReadBytes)
						fail('BUDGET_EXCEEDED', 'Fresh compiler Program exceeded maxTotalReadBytes.');
					if (programStage) {
						programCompilerHostCallbacks += 1;
						programCompilerHostReadBytes = safeAdd(
							programCompilerHostReadBytes,
							readBytes,
							'Fresh compiler Program construction read bytes'
						);
						if (programCompilerHostReadBytes > limits.maxProgramReadBytes)
							fail('BUDGET_EXCEEDED', 'Fresh compiler Program exceeded maxProgramReadBytes.');
					}
					if (declarationEmitStage) {
						declarationEmitInputRecords += 1;
						declarationEmitReadBytes = safeAdd(
							declarationEmitReadBytes,
							readBytes,
							'Declaration-emission replay read bytes'
						);
					}
					if (stage === 'DECLARATION_ARTIFACT_PARSE') {
						artifactParseInputRecords += 1;
						artifactParseReadBytes = safeAdd(
							artifactParseReadBytes,
							readBytes,
							'Explicit declaration-artifact parse read bytes'
						);
						pendingArtifactEncoding = sourceEncoding;
					}
					inputRecords.push(
						Object.freeze({
							attributedInvocationCount: entry.attributedInvocationCount,
							invocationOrdinal,
							observation: entry.observation,
							ordinal: inputRecords.length,
							query: entry.query,
							stage
						})
					);
					invocationCounts.set(inputId, invocationOrdinal + 1);
					assertWithinDeadline();
				}
			}
		);
		assertWithinDeadline();
		host = captureBoundHost(prevalidatedHost);
		assertWithinDeadline();
	} catch (error) {
		if (
			error instanceof CompilerProjectProgramCapabilityError ||
			error instanceof CompilerInputCaptureError
		)
			return rethrowCaptureError(error);
		fail('PROGRAM_UNAVAILABLE', 'Fresh compiler Program host construction failed.');
	}

	let program: ts.Program;
	let checker: ts.TypeChecker;
	try {
		program = ts.createProgram({
			host,
			options: materialized.compilerOptions,
			projectReferences: materialized.projectReferences,
			rootNames: materialized.rootNames
		});
		assertWithinDeadline();
		stage = 'TYPE_CHECKER_CREATE';
		checker = program.getTypeChecker();
		assertWithinDeadline();
		stage = 'CALLER_ANALYSIS';
	} catch (error) {
		if (
			error instanceof CompilerProjectProgramCapabilityError ||
			error instanceof CompilerInputCaptureError
		)
			return rethrowCaptureError(error);
		fail('PROGRAM_UNAVAILABLE', 'Fresh compiler Program construction failed.');
	}
	assertWithinDeadline();
	const sourceProgress = resourceProgress(assertWithinDeadline);
	const programSourceFiles = program.getSourceFiles();
	assertWithinDeadline();
	if (programSourceFiles.length > limits.maxProgramSourceFiles)
		fail('BUDGET_EXCEEDED', 'Fresh compiler Program exceeded maxProgramSourceFiles.');
	const actualSources: string[] = [];
	for (const source of programSourceFiles) {
		sourceProgress.step();
		actualSources.push(captureBoundary(() => bound.lookup.toRecordedLogical(source.fileName)));
		assertWithinDeadline();
	}
	actualSources.sort((left, right) => {
		sourceProgress.step();
		return compareText(left, right, sourceProgress.step);
	});
	const actualSourceSet = new Set<string>();
	for (const logicalPath of actualSources) {
		sourceProgress.step();
		actualSourceSet.add(logicalPath);
	}
	let sourcesReconcile = actualSources.length === expectedSources.length;
	for (let index = 0; index < actualSources.length && sourcesReconcile; index += 1) {
		sourceProgress.step();
		if (!sameText(actualSources[index]!, expectedSources[index]!, sourceProgress.step))
			sourcesReconcile = false;
	}
	sourceProgress.finish();
	if (!sourcesReconcile)
		fail(
			'CAPTURE_UNAVAILABLE',
			'Fresh compiler Program does not reproduce the exact semantic Program source population.'
		);

	return Object.freeze({
		checker,
		configPath: bound.project.configPath,
		finalize(): CompilerProjectProgramEvidence {
			if (declarationEmitActive)
				fail('CAPTURE_UNAVAILABLE', 'Fresh compiler Program declaration emit is active.');
			if (finalized)
				fail('CAPTURE_UNAVAILABLE', 'Fresh compiler Program session is already finalized.');
			assertWithinDeadline();
			finalized = true;
			const finalizeProgress = resourceProgress(assertWithinDeadline);
			const contextInputIds: SemanticContextInputId[] = [];
			for (const id of bound.lookup.attribution.contextInputIds) {
				finalizeProgress.step();
				contextInputIds.push(id);
			}
			Object.freeze(contextInputIds);
			Object.freeze(inputRecords);
			const evidence = Object.freeze({
				attributedInputRecords,
				attributedReadBytes,
				attributedUniqueQueries: attributedLimitsByInputId.size,
				artifactParseInputRecords,
				artifactParseReadBytes,
				compilerHostCallbacks: inputRecords.length,
				compilerHostReadBytes,
				configPath: bound.project.configPath,
				contextInputIds,
				declarationEmitCallbacksUseOnlyAttributedQueries: true,
				declarationEmitInputRecords,
				declarationEmitReadBytes,
				inputRecords,
				materializedRecipeDigest: bound.lookup.attribution.materializedRecipeDigest,
				programCallbacksWithinAttributedInvocationBounds: true,
				programCompilerHostCallbacks,
				programCompilerHostReadBytes,
				programContextDigest: bound.program.contextDigest,
				programSourceFiles: actualSources.length,
				projectResolutionDigest: bound.lookup.attribution.projectResolutionDigest,
				semanticProgramId: bound.program.id,
				semanticProjectId: bound.project.id,
				state: 'VERIFIED_PROJECT_SCOPED_FRESH_PROGRAM',
				subjectId: bound.lookup.subjectId,
				version: COMPILER_PROJECT_PROGRAM_CAPABILITY_VERSION
			});
			finalizeProgress.finish();
			return evidence;
		},
		parseCapturedSourceFile(logicalPath: string): CompilerProjectParsedSource {
			if (declarationEmitActive)
				fail('CAPTURE_UNAVAILABLE', 'Fresh compiler Program declaration emit is active.');
			if (finalized)
				fail('CAPTURE_UNAVAILABLE', 'Fresh compiler Program session is already finalized.');
			if (
				typeof logicalPath !== 'string' ||
				logicalPath.length === 0 ||
				!actualSourceSet.has(logicalPath)
			)
				fail(
					'INPUT_INVALID',
					'Explicit compiler source parse requires one exact source in the fresh Program population.'
				);
			const priorStage = stage;
			stage = 'DECLARATION_ARTIFACT_PARSE';
			pendingArtifactEncoding = null;
			try {
				assertWithinDeadline();
				const absolutePath = captureBoundary(() => bound.lookup.toRecordedAbsolute(logicalPath));
				assertWithinDeadline();
				const text = host.readFile(absolutePath);
				assertWithinDeadline();
				if (text === undefined)
					fail('CAPTURE_UNAVAILABLE', 'Explicit compiler source parse lacks captured bytes.');
				const inputRecord = inputRecords[inputRecords.length - 1];
				if (
					inputRecord === undefined ||
					inputRecord.stage !== 'DECLARATION_ARTIFACT_PARSE' ||
					inputRecord.query.operation !== 'READ_FILE' ||
					inputRecord.query.logicalPath !== logicalPath ||
					inputRecord.observation.operation !== 'READ_FILE' ||
					inputRecord.observation.result !== 'PRESENT'
				)
					fail(
						'CAPTURE_UNAVAILABLE',
						'Explicit compiler source parse did not produce its exact captured-read witness.'
					);
				if (pendingArtifactEncoding === null)
					fail(
						'CAPTURE_UNAVAILABLE',
						'Explicit compiler source parse did not retain its fresh captured-byte evidence.'
					);
				const compilerOptions = program.getCompilerOptions();
				assertWithinDeadline();
				const sourceFile = ts.createSourceFile(
					logicalPath,
					text,
					compilerOptions.target ?? ts.ScriptTarget.Latest,
					true,
					sourceScriptKind(logicalPath)
				);
				assertWithinDeadline();
				return Object.freeze({
					contentBytes: inputRecord.observation.contentBytes,
					contentSha256: inputRecord.observation.contentSha256,
					encoding: pendingArtifactEncoding,
					inputRecordOrdinal: inputRecord.ordinal,
					logicalPath,
					sourceFile,
					textLength: text.length
				});
			} finally {
				pendingArtifactEncoding = null;
				stage = priorStage;
			}
		},
		program,
		semanticProgramId: bound.program.id,
		semanticProjectId: bound.project.id,
		toLogicalPath(path: string): string {
			assertWithinDeadline();
			const logicalPath = captureBoundary(() => bound.lookup.toRecordedLogical(path));
			assertWithinDeadline();
			return logicalPath;
		},
		withDeclarationEmit<Value>(operation: () => Value): Value {
			if (finalized)
				fail('CAPTURE_UNAVAILABLE', 'Fresh compiler Program session is already finalized.');
			if (declarationEmitActive)
				fail('CAPTURE_UNAVAILABLE', 'Fresh compiler Program declaration emit cannot reenter.');
			if (typeof operation !== 'function')
				fail('INPUT_INVALID', 'Fresh compiler Program declaration emit requires an operation.');
			assertWithinDeadline();
			const priorStage = stage;
			declarationEmitActive = true;
			stage = 'DECLARATION_EMIT';
			try {
				return operation();
			} finally {
				stage = priorStage;
				declarationEmitActive = false;
				assertWithinDeadline();
			}
		}
	});
}
