import ts from 'typescript';
import { isAbsolute } from 'node:path';
import { isProxy } from 'node:util/types';
import type { SemanticBudgets } from '../../contracts/semantic.js';
import type { FrozenSubject, ProgramRecipe } from '../../contracts/subject.js';
import { sha256 } from '../../inventory/canonical.js';
import { canonicalSemanticJsonWitnessWithProgress } from '../../semantic/canonical.js';
import type { SemanticOperationClock } from '../../semantic/operation-budget-ledger.js';
import { validateProgramRecipePolicy } from '../../semantic/program-recipe-policy.js';
import type { StaticSemanticOperationBudgetProviderBinding } from '../../semantic/operation-budget-provider-binding.js';
import {
	CompilerInputCaptureError,
	CompilerInputJournal,
	LiveCompilerInputReader,
	ReplayCompilerInputJournal,
	issueReplayCompilerInputOperationBudgetWitness,
	normalizeSemanticBudgets,
	type CapturedCompilerInput,
	type CapturedCompilerProjectEvidence,
	type CompilerInputQuery,
	type CompilerInputOperationBudgetWitness,
	type FrozenCompilerCapture,
	type VerifiedCompilerCapture,
	type VerifiedCompilerProjectInputEntry,
	type VerifiedCompilerProjectInputLookup
} from './compiler-input-journal.js';
import { FrozenCompilerPathResolver } from './compiler-paths.js';
import {
	materializeProgramRecipe,
	type MaterializedProgramRecipe
} from './materialize-program-recipe.js';

export interface ExtendedCompilerHost extends ts.CompilerHost {
	readDirectory(
		rootDir: string,
		extensions?: readonly string[],
		excludes?: readonly string[],
		includes?: readonly string[],
		depth?: number
	): string[];
	toLogicalPath(fileName: string): string;
}

export interface CapturingCompilerEnvironment {
	createProjectHost(
		recipe: ProgramRecipe,
		materialized: MaterializedProgramRecipe
	): ExtendedCompilerHost;
	currentProjectEvidence(projectKey: string): CapturedCompilerProjectEvidence;
	finalizeCapture(): FrozenCompilerCapture;
}

export interface ReplayCompilerEnvironment {
	assertFullyConsumed(): void;
	assertProjectConsumed(projectKey: string): void;
	createProjectHost(
		recipe: ProgramRecipe,
		materialized: MaterializedProgramRecipe
	): ExtendedCompilerHost;
	issueRecheckOperationBudgetWitness(
		binding: StaticSemanticOperationBudgetProviderBinding
	): CompilerInputOperationBudgetWitness;
}

export interface CapturingCompilerHostSession {
	readonly environment: CapturingCompilerEnvironment;
	finalizeCapture(): FrozenCompilerCapture;
	readonly host: ExtendedCompilerHost;
}

export interface ReplayCompilerHostSession {
	readonly environment: ReplayCompilerEnvironment;
	assertFullyConsumed(): void;
	readonly host: ExtendedCompilerHost;
}

/** @internal Callbacks for one fresh CompilerHost backed only by a verified project lookup. */
export interface VerifiedCompilerProjectInputHostCallbacks {
	readonly assertWithinDeadline: () => void;
	readonly onInput: (
		entry: VerifiedCompilerProjectInputEntry,
		sourceEncoding: VerifiedCompilerSourceEncoding | null
	) => void;
}

export type VerifiedCompilerSourceEncoding = 'UTF16BE_BOM' | 'UTF16LE_BOM' | 'UTF8' | 'UTF8_BOM';

class CompilerHostProgressError extends Error {
	constructor(readonly original: unknown) {
		super('Compiler host resource progress callback failed.');
		this.name = 'CompilerHostProgressError';
	}
}

function guardedHostProgress(onProgress: () => void): () => void {
	return () => {
		try {
			onProgress();
		} catch (error) {
			throw new CompilerHostProgressError(error);
		}
	};
}

interface InspectedHostArray {
	readonly field: string;
	readonly length: number;
	readonly value: readonly string[];
}

function inspectHostArray(
	value: readonly string[] | undefined,
	field: string,
	maxEntries: number,
	onProgress: () => void
): InspectedHostArray {
	onProgress();
	if (value === undefined) return Object.freeze({ field, length: 0, value: Object.freeze([]) });
	if (isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype)
		throw new CompilerInputCaptureError('INVALID_QUERY', `${field} must be an inert array.`);
	const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
	const length =
		lengthDescriptor !== undefined && 'value' in lengthDescriptor
			? lengthDescriptor.value
			: undefined;
	if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0)
		throw new CompilerInputCaptureError(
			'INVALID_QUERY',
			`${field} must have a valid inert length.`
		);
	if (length > maxEntries)
		throw new CompilerInputCaptureError(
			'BUDGET_EXCEEDED',
			`${field} exceeds the CompilerHost parameter-count budget.`
		);
	return Object.freeze({ field, length, value });
}

function normalizeReadDirectoryArrays(
	extensionsValue: readonly string[] | undefined,
	excludesValue: readonly string[] | undefined,
	includesValue: readonly string[] | undefined,
	budgets: SemanticBudgets,
	onProgress: () => void
): {
	readonly excludes: readonly string[];
	readonly extensions: readonly string[];
	readonly includes: readonly string[];
} {
	const effectiveExtensions = extensionsValue === undefined ? Object.freeze(['']) : extensionsValue;
	const inspected = [
		inspectHostArray(
			excludesValue,
			'CompilerHost readDirectory excludes',
			budgets.maxDirectoryEntries,
			onProgress
		),
		inspectHostArray(
			effectiveExtensions,
			'CompilerHost readDirectory extensions',
			budgets.maxDirectoryEntries,
			onProgress
		),
		inspectHostArray(
			includesValue,
			'CompilerHost readDirectory includes',
			budgets.maxDirectoryEntries,
			onProgress
		)
	];
	const totalEntries = inspected.reduce((total, value) => total + value.length, 0);
	if (!Number.isSafeInteger(totalEntries) || totalEntries > budgets.maxDirectoryEntries)
		throw new CompilerInputCaptureError(
			'BUDGET_EXCEEDED',
			'CompilerHost readDirectory parameters exceed their cumulative entry budget.'
		);
	let metadataBytes = 0;
	const normalized = new Map<string, readonly string[]>();
	for (const value of inspected) {
		onProgress();
		const ownKeys = Reflect.ownKeys(value.value);
		onProgress();
		let exactKeys = ownKeys.length === value.length + 1;
		for (const key of ownKeys) {
			onProgress();
			if (typeof key !== 'string' || (key !== 'length' && !/^(?:0|[1-9][0-9]*)$/u.test(key)))
				exactKeys = false;
		}
		if (!exactKeys)
			throw new CompilerInputCaptureError(
				'INVALID_QUERY',
				`${value.field} must not contain holes, symbols, or expando properties.`
			);
		const result: string[] = [];
		for (let index = 0; index < value.length; index += 1) {
			onProgress();
			const descriptor = Object.getOwnPropertyDescriptor(value.value, String(index));
			if (
				descriptor === undefined ||
				!descriptor.enumerable ||
				!('value' in descriptor) ||
				typeof descriptor.value !== 'string'
			)
				throw new CompilerInputCaptureError(
					'INVALID_QUERY',
					`${value.field} must be a dense string data array.`
				);
			if (descriptor.value.length > budgets.maxPathCharacters)
				throw new CompilerInputCaptureError(
					'BUDGET_EXCEEDED',
					`${value.field} contains a string beyond the path-character budget.`
				);
			const addition =
				canonicalSemanticJsonWitnessWithProgress(descriptor.value, onProgress).bytes +
				(metadataBytes === 0 ? 0 : 1);
			if (
				!Number.isSafeInteger(metadataBytes + addition) ||
				metadataBytes + addition > budgets.maxCompilerInputMetadataBytes
			)
				throw new CompilerInputCaptureError(
					'BUDGET_EXCEEDED',
					'CompilerHost readDirectory parameters exceed their UTF-8 metadata budget.'
				);
			metadataBytes += addition;
			result.push(descriptor.value);
		}
		const unique = new Set<string>();
		for (const entry of result) {
			onProgress();
			unique.add(entry);
		}
		const ordered: string[] = [];
		for (const entry of unique) {
			onProgress();
			ordered.push(entry);
		}
		ordered.sort((left, right) => {
			onProgress();
			const length = Math.min(left.length, right.length);
			for (let index = 0; index < length; index += 1) {
				onProgress();
				const difference = left.charCodeAt(index) - right.charCodeAt(index);
				if (difference !== 0) return difference < 0 ? -1 : 1;
			}
			return left.length < right.length ? -1 : left.length > right.length ? 1 : 0;
		});
		normalized.set(value.field, Object.freeze(ordered));
	}
	return Object.freeze({
		excludes: normalized.get('CompilerHost readDirectory excludes')!,
		extensions: normalized.get('CompilerHost readDirectory extensions')!,
		includes: normalized.get('CompilerHost readDirectory includes')!
	});
}

function decodeCompilerText(bytes: Uint8Array): string {
	if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
		const body = bytes.subarray(2);
		if (body.byteLength % 2 !== 0)
			throw new TypeError('UTF-16LE compiler input must contain complete code units.');
		return new TextDecoder('utf-16le', { fatal: true }).decode(body);
	}
	if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
		const body = bytes.subarray(2);
		if (body.byteLength % 2 !== 0)
			throw new TypeError('UTF-16BE compiler input must contain complete code units.');
		return new TextDecoder('utf-16be', { fatal: true }).decode(body);
	}
	const start =
		bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
	return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(start));
}

function compilerSourceEncoding(
	bytes: Uint8Array | undefined
): VerifiedCompilerSourceEncoding | null {
	if (bytes === undefined) return null;
	if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return 'UTF16LE_BOM';
	if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return 'UTF16BE_BOM';
	return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
		? 'UTF8_BOM'
		: 'UTF8';
}

function scriptKind(fileName: string): ts.ScriptKind {
	if (/\.tsx$/iu.test(fileName)) return ts.ScriptKind.TSX;
	if (/\.[cm]?jsx?$/iu.test(fileName))
		return /x$/iu.test(fileName) ? ts.ScriptKind.JSX : ts.ScriptKind.JS;
	if (/\.json$/iu.test(fileName)) return ts.ScriptKind.JSON;
	return ts.ScriptKind.TS;
}

interface HostInput {
	readonly assertWithinDeadline: () => void;
	readonly budgets: SemanticBudgets;
	readonly poison: () => void;
	readonly repositoryRoot: string;
	readonly toAbsolute: (logicalPath: string) => string;
	readonly toLogical: (path: string) => string;
	readonly toLogicalPath: (path: string) => string;
	readonly withCaptured: <Result>(
		query: CompilerInputQuery,
		consumer: (entry: CapturedCompilerInput) => Result
	) => Result;
}

function assertRawHostPath(
	path: unknown,
	input: Pick<HostInput, 'budgets' | 'repositoryRoot'>
): asserts path is string {
	if (typeof path !== 'string')
		throw new CompilerInputCaptureError(
			'INVALID_QUERY',
			'CompilerHost path parameters must be strings.'
		);
	const prefixAllowance = isAbsolute(path) ? input.repositoryRoot.length + 1 : 0;
	if (path.length > input.budgets.maxPathCharacters + prefixAllowance)
		throw new CompilerInputCaptureError(
			'BUDGET_EXCEEDED',
			'CompilerHost path parameter exceeds its pre-conversion path-character budget.'
		);
}

function boundedHostPath(
	path: unknown,
	input: Pick<HostInput, 'budgets' | 'repositoryRoot'>,
	map: (value: string) => string
): string {
	assertRawHostPath(path, input);
	const logicalPath = map(path);
	if (logicalPath.length > input.budgets.maxPathCharacters)
		throw new CompilerInputCaptureError(
			'BUDGET_EXCEEDED',
			'CompilerHost logical path exceeds its exact path-character budget.'
		);
	return logicalPath;
}

function preflightMaterializedConfigPath(
	materialized: unknown,
	input: Pick<HostInput, 'budgets' | 'repositoryRoot'>
): void {
	if (
		materialized === null ||
		typeof materialized !== 'object' ||
		isProxy(materialized) ||
		Array.isArray(materialized)
	)
		throw new CompilerInputCaptureError(
			'INVALID_QUERY',
			'Materialized compiler recipe must be inert before project-key inspection.'
		);
	const prototype = Object.getPrototypeOf(materialized);
	if (prototype !== Object.prototype && prototype !== null)
		throw new CompilerInputCaptureError(
			'INVALID_QUERY',
			'Materialized compiler recipe must be a plain wire object.'
		);
	const descriptor = Object.getOwnPropertyDescriptor(materialized, 'configFilePath');
	if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
		throw new CompilerInputCaptureError(
			'INVALID_QUERY',
			'Materialized compiler recipe must carry an inert configFilePath.'
		);
	assertRawHostPath(descriptor.value, input);
}

function createHost(
	materialized: MaterializedProgramRecipe,
	input: HostInput
): ExtendedCompilerHost {
	const attempt = <T>(action: () => T): T => {
		try {
			input.assertWithinDeadline();
			const result = action();
			input.assertWithinDeadline();
			return result;
		} catch (error) {
			input.poison();
			throw error;
		}
	};
	const queryPath = (path: string): string => boundedHostPath(path, input, input.toLogical);
	const readFile = (fileName: string): string | undefined =>
		attempt(() => {
			return input.withCaptured(
				{ logicalPath: queryPath(fileName), operation: 'READ_FILE' },
				(captured) => {
					if (
						captured.observation.operation !== 'READ_FILE' ||
						captured.observation.result !== 'PRESENT' ||
						captured.bytes === undefined
					)
						return undefined;
					try {
						return decodeCompilerText(captured.bytes);
					} catch {
						throw new CompilerInputCaptureError(
							'INVALID_CAPTURE',
							`Compiler input bytes are not valid supported source text: ${captured.observation.logicalPath}.`
						);
					}
				}
			);
		});
	const host: ExtendedCompilerHost = {
		createHash: (data) => attempt(() => sha256(data)),
		directoryExists(directoryName) {
			return attempt(() => {
				return input.withCaptured(
					{
						logicalPath: queryPath(directoryName),
						operation: 'DIRECTORY_EXISTS'
					},
					({ observation }) =>
						observation.operation === 'DIRECTORY_EXISTS' && observation.result === 'DIRECTORY'
				);
			});
		},
		fileExists(fileName) {
			return attempt(() => {
				return input.withCaptured(
					{
						logicalPath: queryPath(fileName),
						operation: 'FILE_EXISTS'
					},
					({ observation }) =>
						observation.operation === 'FILE_EXISTS' && observation.result === 'PRESENT'
				);
			});
		},
		getCanonicalFileName(fileName) {
			return host.useCaseSensitiveFileNames() ? fileName : fileName.toLowerCase();
		},
		getCurrentDirectory() {
			return attempt(() => {
				input.withCaptured({ logicalPath: '.', operation: 'CURRENT_DIRECTORY' }, () => undefined);
				return input.repositoryRoot;
			});
		},
		getDefaultLibFileName: () =>
			attempt(() => ts.getDefaultLibFilePath(materialized.compilerOptions)),
		getDirectories(directoryName) {
			return attempt(() => {
				return input.withCaptured(
					{
						logicalPath: queryPath(directoryName),
						operation: 'GET_DIRECTORIES'
					},
					({ observation }) => {
						if (observation.operation !== 'GET_DIRECTORIES') return [];
						const result: string[] = [];
						for (const logicalPath of observation.resultEntries) {
							input.assertWithinDeadline();
							result.push(input.toAbsolute(logicalPath));
						}
						return result;
					}
				);
			});
		},
		getEnvironmentVariable: () => undefined,
		getNewLine: () => '\n',
		getSourceFile(fileName, languageVersion, onError) {
			try {
				return attempt(() => {
					const text = readFile(fileName);
					return text === undefined
						? undefined
						: ts.createSourceFile(fileName, text, languageVersion, true, scriptKind(fileName));
				});
			} catch (error) {
				onError?.(error instanceof Error ? error.message : 'Compiler source read failed.');
				throw error;
			}
		},
		readDirectory(rootDir, extensions, excludes, includes, depth) {
			return attempt(() => {
				assertRawHostPath(rootDir, input);
				const parameters = normalizeReadDirectoryArrays(
					extensions,
					excludes,
					includes,
					input.budgets,
					input.assertWithinDeadline
				);
				return input.withCaptured(
					{
						depth: depth ?? null,
						...parameters,
						logicalPath: boundedHostPath(rootDir, input, input.toLogical),
						operation: 'READ_DIRECTORY'
					},
					({ observation }) => {
						if (observation.operation !== 'READ_DIRECTORY') return [];
						const result: string[] = [];
						for (const logicalPath of observation.resultEntries) {
							input.assertWithinDeadline();
							result.push(input.toAbsolute(logicalPath));
						}
						return result;
					}
				);
			});
		},
		readFile,
		realpath(path) {
			return attempt(() => {
				return input.withCaptured(
					{
						logicalPath: queryPath(path),
						operation: 'REALPATH'
					},
					({ observation }) =>
						observation.operation === 'REALPATH' && observation.result === 'RESOLVED'
							? input.toAbsolute(observation.resolvedLogicalPath)
							: path
				);
			});
		},
		toLogicalPath: (path) => attempt(() => boundedHostPath(path, input, input.toLogicalPath)),
		useCaseSensitiveFileNames() {
			return attempt(() => {
				return input.withCaptured(
					{
						logicalPath: '.',
						operation: 'USE_CASE_SENSITIVE_FILE_NAMES'
					},
					({ observation }) =>
						observation.operation === 'USE_CASE_SENSITIVE_FILE_NAMES' &&
						observation.result === 'CASE_SENSITIVE'
				);
			});
		},
		writeFile() {
			return attempt(() => {
				throw new CompilerInputCaptureError(
					'CONTEXT_UNAVAILABLE',
					'Semantic analysis CompilerHost is read-only and cannot emit subject files.'
				);
			});
		}
	};
	return Object.freeze(host);
}

function canonicalProjectKey(
	materialized: MaterializedProgramRecipe,
	input: Pick<HostInput, 'budgets' | 'repositoryRoot' | 'toLogical'>
): string {
	try {
		return boundedHostPath(materialized.configFilePath, input, input.toLogical);
	} catch (error) {
		if (error instanceof CompilerInputCaptureError) throw error;
		throw new CompilerInputCaptureError(
			'INVALID_QUERY',
			'Compiler project attribution key is outside the frozen path authority.'
		);
	}
}

interface MaterializedRecipeSnapshot {
	readonly digest: string;
	readonly value: MaterializedProgramRecipe;
}

interface MaterializedRecipeCloneBudget {
	readonly maximum: number;
	nodes: number;
}

function cloneCanonicalSnapshotValue(
	value: unknown,
	onProgress: () => void,
	budget: MaterializedRecipeCloneBudget
): unknown {
	onProgress();
	budget.nodes += 1;
	if (!Number.isSafeInteger(budget.nodes) || budget.nodes > budget.maximum)
		throw new CompilerInputCaptureError(
			'BUDGET_EXCEEDED',
			'Materialized compiler recipe exceeds its bounded snapshot population.'
		);
	if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
	if (typeof value === 'number') return value;
	if (typeof value !== 'object' || isProxy(value))
		throw new TypeError('Materialized compiler recipe contains a non-data value.');
	if (Array.isArray(value)) {
		if (Reflect.getPrototypeOf(value) !== Array.prototype)
			throw new TypeError('Materialized compiler recipe arrays must use Array.prototype.');
		const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
		const length =
			lengthDescriptor !== undefined && 'value' in lengthDescriptor
				? lengthDescriptor.value
				: undefined;
		if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0)
			throw new TypeError('Materialized compiler recipe contains an invalid array length.');
		if (length > budget.maximum - budget.nodes)
			throw new CompilerInputCaptureError(
				'BUDGET_EXCEEDED',
				'Materialized compiler recipe array exceeds its bounded snapshot population.'
			);
		onProgress();
		const ownKeys = Reflect.ownKeys(value);
		onProgress();
		let exactKeys = ownKeys.length === length + 1;
		for (const key of ownKeys) {
			onProgress();
			if (typeof key !== 'string' || (key !== 'length' && !/^(?:0|[1-9][0-9]*)$/u.test(key)))
				exactKeys = false;
		}
		if (!exactKeys)
			throw new TypeError('Materialized compiler recipe arrays must be dense exact data arrays.');
		const result: unknown[] = [];
		for (let index = 0; index < length; index += 1) {
			onProgress();
			const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
			if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
				throw new TypeError('Materialized compiler recipe arrays must contain data elements.');
			result.push(cloneCanonicalSnapshotValue(descriptor.value, onProgress, budget));
		}
		return Object.freeze(result);
	}
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new TypeError('Materialized compiler recipe records must use a plain prototype.');
	onProgress();
	const ownKeys = Reflect.ownKeys(value);
	onProgress();
	if (ownKeys.length > budget.maximum - budget.nodes)
		throw new CompilerInputCaptureError(
			'BUDGET_EXCEEDED',
			'Materialized compiler recipe record exceeds its bounded snapshot population.'
		);
	const result: Record<string, unknown> = {};
	for (const key of ownKeys) {
		onProgress();
		if (typeof key !== 'string')
			throw new TypeError('Materialized compiler recipe records must not contain symbol keys.');
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			throw new TypeError('Materialized compiler recipe records must contain data properties.');
		Object.defineProperty(result, key, {
			configurable: true,
			enumerable: true,
			value: cloneCanonicalSnapshotValue(descriptor.value, onProgress, budget),
			writable: true
		});
	}
	return Object.freeze(result);
}

function compareTextWithProgress(left: string, right: string, onProgress: () => void): number {
	const length = Math.min(left.length, right.length);
	for (let index = 0; index < length; index += 1) {
		onProgress();
		const difference = left.charCodeAt(index) - right.charCodeAt(index);
		if (difference !== 0) return difference < 0 ? -1 : 1;
	}
	return left.length < right.length ? -1 : left.length > right.length ? 1 : 0;
}

function sameCanonicalSnapshotValue(
	left: unknown,
	right: unknown,
	onProgress: () => void
): boolean {
	onProgress();
	if (typeof left !== typeof right) return false;
	if (left === null || right === null) return left === right;
	if (typeof left !== 'object' || typeof right !== 'object') {
		if (typeof left === 'string' && typeof right === 'string')
			return compareTextWithProgress(left, right, onProgress) === 0;
		return left === right;
	}
	if (Array.isArray(left) || Array.isArray(right)) {
		if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
		for (let index = 0; index < left.length; index += 1) {
			onProgress();
			if (!sameCanonicalSnapshotValue(left[index], right[index], onProgress)) return false;
		}
		return true;
	}
	const leftKeys = Object.keys(left).sort((first, second) =>
		compareTextWithProgress(first, second, onProgress)
	);
	onProgress();
	const rightKeys = Object.keys(right).sort((first, second) =>
		compareTextWithProgress(first, second, onProgress)
	);
	onProgress();
	if (leftKeys.length !== rightKeys.length) return false;
	for (let index = 0; index < leftKeys.length; index += 1) {
		onProgress();
		const key = leftKeys[index]!;
		if (
			compareTextWithProgress(key, rightKeys[index]!, onProgress) !== 0 ||
			!sameCanonicalSnapshotValue(
				(left as Record<string, unknown>)[key],
				(right as Record<string, unknown>)[key],
				onProgress
			)
		)
			return false;
	}
	return true;
}

function snapshotMaterializedRecipe(
	materialized: MaterializedProgramRecipe,
	maxNodes: number,
	onProgress: () => void = () => undefined
): MaterializedRecipeSnapshot {
	const progress = guardedHostProgress(onProgress);
	try {
		const value = cloneCanonicalSnapshotValue(materialized, progress, {
			maximum: maxNodes,
			nodes: 0
		}) as MaterializedProgramRecipe;
		const digest = canonicalSemanticJsonWitnessWithProgress(value, progress).sha256;
		progress();
		return Object.freeze({ digest, value });
	} catch (error) {
		if (error instanceof CompilerHostProgressError) throw error.original;
		if (error instanceof CompilerInputCaptureError) throw error;
		throw new CompilerInputCaptureError(
			'INVALID_QUERY',
			'Materialized compiler recipe is not inert canonical data.'
		);
	}
}

function recipeIdentity(
	recipe: ProgramRecipe,
	materializedRecipeDigest: string,
	onProgress: () => void = () => undefined
): { readonly materializedRecipeDigest: string; readonly projectResolutionDigest: string } {
	const progress = guardedHostProgress(onProgress);
	try {
		progress();
		const validated = validateProgramRecipePolicy(recipe);
		progress();
		return Object.freeze({
			materializedRecipeDigest,
			projectResolutionDigest: validated.projectResolutionDigest
		});
	} catch (error) {
		if (error instanceof CompilerHostProgressError) throw error.original;
		if (error instanceof CompilerInputCaptureError) throw error;
		throw new CompilerInputCaptureError(
			'INVALID_QUERY',
			'Authoritative compiler ProgramRecipe is invalid.'
		);
	}
}

function assertExactMaterializedProjection(
	recipe: ProgramRecipe,
	materialized: MaterializedProgramRecipe,
	repositoryRoot: string,
	onProgress: () => void = () => undefined
): void {
	const progress = guardedHostProgress(onProgress);
	try {
		progress();
		const expected = materializeProgramRecipe(recipe, repositoryRoot);
		progress();
		if (!sameCanonicalSnapshotValue(expected, materialized, progress))
			throw new CompilerInputCaptureError(
				'INVALID_QUERY',
				'Materialized compiler inputs do not reproduce the authoritative ProgramRecipe projection.'
			);
	} catch (error) {
		if (error instanceof CompilerHostProgressError) throw error.original;
		if (error instanceof CompilerInputCaptureError) throw error;
		throw new CompilerInputCaptureError(
			'INVALID_QUERY',
			'Materialized compiler inputs could not be related to the authoritative ProgramRecipe.'
		);
	}
}

function createBoundVerifiedCompilerProjectInputHost(
	materialized: MaterializedProgramRecipe,
	lookup: VerifiedCompilerProjectInputLookup,
	budgets: SemanticBudgets,
	callbacks: VerifiedCompilerProjectInputHostCallbacks,
	repositoryRoot: string
): ExtendedCompilerHost {
	let poisoned = false;
	const poison = (): void => {
		poisoned = true;
	};
	const host = createHost(materialized, {
		assertWithinDeadline: () => {
			if (poisoned)
				throw new CompilerInputCaptureError(
					'INVALID_CAPTURE',
					'Verified compiler project input host is poisoned by an earlier failed operation.'
				);
			callbacks.assertWithinDeadline();
		},
		budgets,
		withCaptured<Result>(
			query: CompilerInputQuery,
			consumer: (entry: CapturedCompilerInput) => Result
		): Result {
			let consumed = false;
			let result: Result | undefined;
			const found = lookup.withAttributedQueryForVerifiedHost(
				query,
				callbacks.assertWithinDeadline,
				(entry) => {
					callbacks.onInput(
						Object.freeze({
							attributedInvocationCount: entry.attributedInvocationCount,
							observation: entry.observation,
							query: entry.query
						}),
						compilerSourceEncoding(entry.bytes)
					);
					result = consumer(entry);
					consumed = true;
				}
			);
			callbacks.assertWithinDeadline();
			if (!found || !consumed)
				throw new CompilerInputCaptureError(
					'CONTEXT_UNAVAILABLE',
					'Fresh compiler Program requested an input absent from the verified project attribution.'
				);
			return result as Result;
		},
		poison,
		repositoryRoot,
		toAbsolute(logicalPath) {
			const absolutePath = lookup.toRecordedAbsolute(logicalPath);
			callbacks.assertWithinDeadline();
			return absolutePath;
		},
		toLogical(path) {
			const logicalPath = lookup.toRecordedLogical(path);
			callbacks.assertWithinDeadline();
			return logicalPath;
		},
		toLogicalPath(path) {
			const logicalPath = lookup.toRecordedLogical(path);
			callbacks.assertWithinDeadline();
			return logicalPath;
		}
	});
	callbacks.assertWithinDeadline();
	return host;
}

/**
 * @internal Creates one read-only CompilerHost whose complete filesystem authority is the exact
 * project-attributed verified capture. A query absent from that capture fails closed; this helper
 * never consults `ts.sys`, the live filesystem, or a fallback host.
 */
export function createVerifiedCompilerProjectInputHost(
	recipe: ProgramRecipe,
	materializedValue: MaterializedProgramRecipe,
	lookup: VerifiedCompilerProjectInputLookup,
	budgetsValue: SemanticBudgets,
	callbacks: VerifiedCompilerProjectInputHostCallbacks
): ExtendedCompilerHost {
	const budgets = normalizeSemanticBudgets(budgetsValue);
	const repositoryRoot = lookup.toRecordedAbsolute('.');
	callbacks.assertWithinDeadline();
	preflightMaterializedConfigPath(materializedValue, { budgets, repositoryRoot });
	const snapshot = snapshotMaterializedRecipe(
		materializedValue,
		budgets.maxSnapshotBytes,
		callbacks.assertWithinDeadline
	);
	const materialized = snapshot.value;
	const identity = recipeIdentity(recipe, snapshot.digest, callbacks.assertWithinDeadline);
	const projectKey = canonicalProjectKey(materialized, {
		budgets,
		repositoryRoot,
		toLogical(path) {
			const logicalPath = lookup.toRecordedLogical(path);
			callbacks.assertWithinDeadline();
			return logicalPath;
		}
	});
	if (
		projectKey !== lookup.attribution.projectKey ||
		identity.materializedRecipeDigest !== lookup.attribution.materializedRecipeDigest ||
		identity.projectResolutionDigest !== lookup.attribution.projectResolutionDigest
	)
		throw new CompilerInputCaptureError(
			'INVALID_CAPTURE',
			'Verified compiler project lookup does not reproduce the requested ProgramRecipe.'
		);
	return createBoundVerifiedCompilerProjectInputHost(
		materialized,
		lookup,
		budgets,
		callbacks,
		repositoryRoot
	);
}

/**
 * @internal Trust-only CAP013 path. The exact attached semantic-snapshot capability has already
 * proved and publicly validated the ProgramRecipe; this path independently binds the checkpointed
 * materialized projection and its retained resolution digest without repeating legacy recipe
 * policy/canonical materialization.
 */
export function createPrevalidatedVerifiedCompilerProjectInputHost(
	materializedValue: MaterializedProgramRecipe,
	projectResolutionDigest: string,
	lookup: VerifiedCompilerProjectInputLookup,
	budgetsValue: SemanticBudgets,
	callbacks: VerifiedCompilerProjectInputHostCallbacks
): ExtendedCompilerHost {
	const budgets = normalizeSemanticBudgets(budgetsValue);
	const repositoryRoot = lookup.toRecordedAbsolute('.');
	callbacks.assertWithinDeadline();
	preflightMaterializedConfigPath(materializedValue, { budgets, repositoryRoot });
	const snapshot = snapshotMaterializedRecipe(
		materializedValue,
		budgets.maxSnapshotBytes,
		callbacks.assertWithinDeadline
	);
	const materialized = snapshot.value;
	const projectKey = canonicalProjectKey(materialized, {
		budgets,
		repositoryRoot,
		toLogical(path) {
			const logicalPath = lookup.toRecordedLogical(path);
			callbacks.assertWithinDeadline();
			return logicalPath;
		}
	});
	callbacks.assertWithinDeadline();
	if (
		projectKey !== lookup.attribution.projectKey ||
		snapshot.digest !== lookup.attribution.materializedRecipeDigest ||
		projectResolutionDigest !== lookup.attribution.projectResolutionDigest
	)
		throw new CompilerInputCaptureError(
			'INVALID_CAPTURE',
			'Prevalidated compiler project lookup does not reproduce the attached semantic snapshot.'
		);
	return createBoundVerifiedCompilerProjectInputHost(
		materialized,
		lookup,
		budgets,
		callbacks,
		repositoryRoot
	);
}

export function createCapturingCompilerEnvironment(
	subject: FrozenSubject,
	repositoryRoot: string,
	budgetsValue: SemanticBudgets,
	startedAtMs = Date.now(),
	clock: SemanticOperationClock = Date.now
): CapturingCompilerEnvironment {
	const budgets = normalizeSemanticBudgets(budgetsValue);
	const caseSensitive = ts.sys.useCaseSensitiveFileNames;
	const paths = new FrozenCompilerPathResolver(subject, repositoryRoot, caseSensitive);
	const reader = new LiveCompilerInputReader(subject, paths, caseSensitive);
	const journal = new CompilerInputJournal(reader, budgets, startedAtMs, clock);
	const projectKeys = new Set<string>();
	let finalized = false;
	let poisoned = false;
	const poison = (): void => {
		poisoned = true;
		journal.poison();
	};
	return Object.freeze({
		createProjectHost(
			recipe: ProgramRecipe,
			materialized: MaterializedProgramRecipe
		): ExtendedCompilerHost {
			if (finalized)
				throw new CompilerInputCaptureError(
					'INVALID_CAPTURE',
					'Capturing compiler environment is already finalized.'
				);
			if (poisoned)
				throw new CompilerInputCaptureError(
					'INVALID_CAPTURE',
					'Capturing compiler environment is poisoned by an earlier failed operation.'
				);
			try {
				if (projectKeys.size >= budgets.maxProjects)
					throw new CompilerInputCaptureError(
						'BUDGET_EXCEEDED',
						'Capturing compiler environment exceeded its project budget.'
					);
				journal.assertWithinDeadline();
				preflightMaterializedConfigPath(materialized, {
					budgets,
					repositoryRoot: paths.repositoryRoot
				});
				const capturedSnapshot = snapshotMaterializedRecipe(
					materialized,
					budgets.maxSnapshotBytes,
					() => journal.assertWithinDeadline()
				);
				const snapshot = capturedSnapshot.value;
				assertExactMaterializedProjection(recipe, snapshot, paths.repositoryRoot, () =>
					journal.assertWithinDeadline()
				);
				recipeIdentity(recipe, capturedSnapshot.digest, () => journal.assertWithinDeadline());
				const hostInput = {
					assertWithinDeadline: () => journal.assertWithinDeadline(),
					budgets,
					poison,
					repositoryRoot: paths.repositoryRoot,
					toAbsolute: (path: string) => paths.toAbsolute(path),
					toLogical: (path: string) => paths.toRecordedLogical(path),
					toLogicalPath: (path: string) => paths.toRecordedLogical(path)
				};
				const key = canonicalProjectKey(snapshot, hostInput);
				if (projectKeys.has(key))
					throw new CompilerInputCaptureError(
						'INVALID_QUERY',
						`Capturing compiler environment already created project host ${key}.`
					);
				journal.registerProject(key, recipe, snapshot);
				for (const aliasPath of paths.workspaceAliasRoots())
					journal.capture({ logicalPath: aliasPath, operation: 'REALPATH' }, key);
				journal.assertWithinDeadline();
				const host = createHost(snapshot, {
					...hostInput,
					withCaptured: <Result>(
						query: CompilerInputQuery,
						consumer: (entry: CapturedCompilerInput) => Result
					): Result => consumer(journal.capture(query, key))
				});
				journal.assertWithinDeadline();
				projectKeys.add(key);
				return host;
			} catch (error) {
				poison();
				throw error;
			}
		},
		currentProjectEvidence(projectKey: string): CapturedCompilerProjectEvidence {
			if (finalized)
				throw new CompilerInputCaptureError(
					'INVALID_CAPTURE',
					'Capturing compiler environment is already finalized.'
				);
			if (poisoned)
				throw new CompilerInputCaptureError(
					'INVALID_CAPTURE',
					'Capturing compiler environment is poisoned by an earlier failed operation.'
				);
			try {
				return journal.currentProjectEvidence(projectKey);
			} catch (error) {
				poison();
				throw error;
			}
		},
		finalizeCapture(): FrozenCompilerCapture {
			if (finalized)
				throw new CompilerInputCaptureError(
					'INVALID_CAPTURE',
					'Capturing compiler environment is already finalized.'
				);
			if (poisoned)
				throw new CompilerInputCaptureError(
					'INVALID_CAPTURE',
					'Capturing compiler environment is poisoned by an earlier failed operation.'
				);
			finalized = true;
			return journal.finalizeCapture();
		}
	});
}

export function createReplayCompilerEnvironment(
	subject: FrozenSubject,
	capture: VerifiedCompilerCapture
): ReplayCompilerEnvironment {
	const journal = new ReplayCompilerInputJournal(subject, capture);
	const projectKeys = new Set<string>();
	let finalized = false;
	let poisoned = false;
	const poison = (): void => {
		poisoned = true;
		journal.poison();
	};
	const environment: ReplayCompilerEnvironment = {
		assertFullyConsumed() {
			if (poisoned)
				throw new CompilerInputCaptureError(
					'INVALID_CAPTURE',
					'Replay compiler environment is poisoned by an earlier failed operation.'
				);
			try {
				journal.assertFullyConsumed();
				finalized = true;
			} catch (error) {
				poison();
				throw error;
			}
		},
		assertProjectConsumed(projectKey: string) {
			if (finalized)
				throw new CompilerInputCaptureError(
					'INVALID_CAPTURE',
					'Replay compiler environment is already finalized.'
				);
			if (poisoned)
				throw new CompilerInputCaptureError(
					'INVALID_CAPTURE',
					'Replay compiler environment is poisoned by an earlier failed operation.'
				);
			try {
				journal.assertProjectConsumed(projectKey);
			} catch (error) {
				poison();
				throw error;
			}
		},
		createProjectHost(
			recipe: ProgramRecipe,
			materialized: MaterializedProgramRecipe
		): ExtendedCompilerHost {
			if (finalized)
				throw new CompilerInputCaptureError(
					'INVALID_CAPTURE',
					'Replay compiler environment is already finalized.'
				);
			if (poisoned)
				throw new CompilerInputCaptureError(
					'INVALID_CAPTURE',
					'Replay compiler environment is poisoned by an earlier failed operation.'
				);
			try {
				if (projectKeys.size >= journal.maxProjects)
					throw new CompilerInputCaptureError(
						'BUDGET_EXCEEDED',
						'Replay compiler environment exceeded its project budget.'
					);
				journal.assertWithinDeadline();
				preflightMaterializedConfigPath(materialized, {
					budgets: journal.semanticBudgets,
					repositoryRoot: journal.repositoryRoot
				});
				const replaySnapshot = snapshotMaterializedRecipe(
					materialized,
					journal.semanticBudgets.maxSnapshotBytes,
					() => journal.assertWithinDeadline()
				);
				const snapshot = replaySnapshot.value;
				recipeIdentity(recipe, replaySnapshot.digest, () => journal.assertWithinDeadline());
				const hostInput = {
					assertWithinDeadline: () => journal.assertWithinDeadline(),
					budgets: journal.semanticBudgets,
					poison,
					repositoryRoot: journal.repositoryRoot,
					toAbsolute: (path: string) => journal.toRecordedAbsolute(path),
					toLogical: (path: string) => journal.toRecordedLogical(path),
					toLogicalPath: (path: string) => journal.toRecordedLogical(path)
				};
				const key = canonicalProjectKey(snapshot, hostInput);
				if (projectKeys.has(key))
					throw new CompilerInputCaptureError(
						'INVALID_QUERY',
						`Replay compiler environment already created project host ${key}.`
					);
				journal.registerProject(key, recipe, snapshot);
				for (const aliasPath of journal.workspaceAliasRoots())
					journal.replay({ logicalPath: aliasPath, operation: 'REALPATH' }, key);
				journal.assertWithinDeadline();
				const host = createHost(snapshot, {
					...hostInput,
					withCaptured: <Result>(
						query: CompilerInputQuery,
						consumer: (entry: CapturedCompilerInput) => Result
					): Result => consumer(journal.replay(query, key))
				});
				journal.assertWithinDeadline();
				projectKeys.add(key);
				return host;
			} catch (error) {
				poison();
				throw error;
			}
		},
		issueRecheckOperationBudgetWitness(
			binding: StaticSemanticOperationBudgetProviderBinding
		): CompilerInputOperationBudgetWitness {
			if (!finalized)
				throw new CompilerInputCaptureError(
					'INVALID_CAPTURE',
					'Replay compiler environment must prove exact full consumption before issuing a budget witness.'
				);
			if (poisoned)
				throw new CompilerInputCaptureError(
					'INVALID_CAPTURE',
					'Replay compiler environment is poisoned by an earlier failed operation.'
				);
			return issueReplayCompilerInputOperationBudgetWitness(binding, journal);
		}
	};
	return Object.freeze(environment);
}

export function createCapturingCompilerHost(
	subject: FrozenSubject,
	repositoryRoot: string,
	recipe: ProgramRecipe,
	materialized: MaterializedProgramRecipe,
	budgets: SemanticBudgets,
	startedAtMs = Date.now(),
	clock: SemanticOperationClock = Date.now
): CapturingCompilerHostSession {
	const environment = createCapturingCompilerEnvironment(
		subject,
		repositoryRoot,
		budgets,
		startedAtMs,
		clock
	);
	return Object.freeze({
		environment,
		finalizeCapture: () => environment.finalizeCapture(),
		host: environment.createProjectHost(recipe, materialized)
	});
}

export function createReplayCompilerHost(
	subject: FrozenSubject,
	recipe: ProgramRecipe,
	materialized: MaterializedProgramRecipe,
	capture: VerifiedCompilerCapture
): ReplayCompilerHostSession {
	const environment = createReplayCompilerEnvironment(subject, capture);
	return Object.freeze({
		assertFullyConsumed: () => environment.assertFullyConsumed(),
		environment,
		host: environment.createProjectHost(recipe, materialized)
	});
}
