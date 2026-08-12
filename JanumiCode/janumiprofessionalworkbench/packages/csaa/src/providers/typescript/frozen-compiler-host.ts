import ts from 'typescript';
import { isAbsolute } from 'node:path';
import { isProxy } from 'node:util/types';
import type { SemanticBudgets } from '../../contracts/semantic.js';
import type { FrozenSubject, ProgramRecipe } from '../../contracts/subject.js';
import { sha256 } from '../../inventory/canonical.js';
import { canonicalSemanticJson } from '../../semantic/canonical.js';
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
	type VerifiedCompilerCapture
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

interface InspectedHostArray {
	readonly field: string;
	readonly length: number;
	readonly value: readonly string[];
}

function inspectHostArray(
	value: readonly string[] | undefined,
	field: string,
	maxEntries: number
): InspectedHostArray {
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
	budgets: SemanticBudgets
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
			budgets.maxDirectoryEntries
		),
		inspectHostArray(
			effectiveExtensions,
			'CompilerHost readDirectory extensions',
			budgets.maxDirectoryEntries
		),
		inspectHostArray(
			includesValue,
			'CompilerHost readDirectory includes',
			budgets.maxDirectoryEntries
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
		const ownKeys = Reflect.ownKeys(value.value);
		if (
			ownKeys.length !== value.length + 1 ||
			ownKeys.some(
				(key) => typeof key !== 'string' || (key !== 'length' && !/^(?:0|[1-9][0-9]*)$/u.test(key))
			)
		)
			throw new CompilerInputCaptureError(
				'INVALID_QUERY',
				`${value.field} must not contain holes, symbols, or expando properties.`
			);
		const result: string[] = [];
		for (let index = 0; index < value.length; index += 1) {
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
				Buffer.byteLength(canonicalSemanticJson(descriptor.value), 'utf8') +
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
		normalized.set(value.field, Object.freeze([...new Set(result)].sort()));
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
		const swapped = body.slice();
		for (let index = 0; index < swapped.length; index += 2)
			[swapped[index], swapped[index + 1]] = [swapped[index + 1]!, swapped[index]!];
		return new TextDecoder('utf-16le', { fatal: true }).decode(swapped);
	}
	const start =
		bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
	return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(start));
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
	readonly capture: (query: CompilerInputQuery) => CapturedCompilerInput;
	readonly poison: () => void;
	readonly repositoryRoot: string;
	readonly toAbsolute: (logicalPath: string) => string;
	readonly toLogical: (path: string) => string;
	readonly toLogicalPath: (path: string) => string;
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
			return action();
		} catch (error) {
			input.poison();
			throw error;
		}
	};
	const queryPath = (path: string): string => boundedHostPath(path, input, input.toLogical);
	const readFile = (fileName: string): string | undefined =>
		attempt(() => {
			const captured = input.capture({ logicalPath: queryPath(fileName), operation: 'READ_FILE' });
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
		});
	const host: ExtendedCompilerHost = {
		createHash: (data) => sha256(data),
		directoryExists(directoryName) {
			return attempt(() => {
				const observation = input.capture({
					logicalPath: queryPath(directoryName),
					operation: 'DIRECTORY_EXISTS'
				}).observation;
				return observation.operation === 'DIRECTORY_EXISTS' && observation.result === 'DIRECTORY';
			});
		},
		fileExists(fileName) {
			return attempt(() => {
				const observation = input.capture({
					logicalPath: queryPath(fileName),
					operation: 'FILE_EXISTS'
				}).observation;
				return observation.operation === 'FILE_EXISTS' && observation.result === 'PRESENT';
			});
		},
		getCanonicalFileName(fileName) {
			return host.useCaseSensitiveFileNames() ? fileName : fileName.toLowerCase();
		},
		getCurrentDirectory() {
			return attempt(() => {
				input.capture({ logicalPath: '.', operation: 'CURRENT_DIRECTORY' });
				return input.repositoryRoot;
			});
		},
		getDefaultLibFileName: () => ts.getDefaultLibFilePath(materialized.compilerOptions),
		getDirectories(directoryName) {
			return attempt(() => {
				const observation = input.capture({
					logicalPath: queryPath(directoryName),
					operation: 'GET_DIRECTORIES'
				}).observation;
				return observation.operation === 'GET_DIRECTORIES'
					? observation.resultEntries.map(input.toAbsolute)
					: [];
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
					input.budgets
				);
				const observation = input.capture({
					depth: depth ?? null,
					...parameters,
					logicalPath: boundedHostPath(rootDir, input, input.toLogical),
					operation: 'READ_DIRECTORY'
				}).observation;
				return observation.operation === 'READ_DIRECTORY'
					? observation.resultEntries.map(input.toAbsolute)
					: [];
			});
		},
		readFile,
		realpath(path) {
			return attempt(() => {
				const observation = input.capture({
					logicalPath: queryPath(path),
					operation: 'REALPATH'
				}).observation;
				return observation.operation === 'REALPATH' && observation.result === 'RESOLVED'
					? input.toAbsolute(observation.resolvedLogicalPath)
					: path;
			});
		},
		toLogicalPath: (path) => attempt(() => boundedHostPath(path, input, input.toLogicalPath)),
		useCaseSensitiveFileNames() {
			return attempt(() => {
				const observation = input.capture({
					logicalPath: '.',
					operation: 'USE_CASE_SENSITIVE_FILE_NAMES'
				}).observation;
				return (
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

function freezeSnapshot<T>(value: T): T {
	if (value !== null && typeof value === 'object') {
		for (const child of Object.values(value as Record<string, unknown>)) freezeSnapshot(child);
		Object.freeze(value);
	}
	return value;
}

function snapshotMaterializedRecipe(
	materialized: MaterializedProgramRecipe
): MaterializedProgramRecipe {
	try {
		canonicalSemanticJson(materialized);
		return freezeSnapshot(structuredClone(materialized));
	} catch (error) {
		if (error instanceof CompilerInputCaptureError) throw error;
		throw new CompilerInputCaptureError(
			'INVALID_QUERY',
			'Materialized compiler recipe is not inert canonical data.'
		);
	}
}

function materializedRecipeDigest(materialized: MaterializedProgramRecipe): string {
	try {
		return sha256(canonicalSemanticJson(materialized));
	} catch (error) {
		if (error instanceof CompilerInputCaptureError) throw error;
		throw new CompilerInputCaptureError(
			'INVALID_QUERY',
			'Materialized compiler recipe is not inert canonical data.'
		);
	}
}

function recipeIdentity(
	recipe: ProgramRecipe,
	materialized: MaterializedProgramRecipe
): { readonly materializedRecipeDigest: string; readonly projectResolutionDigest: string } {
	try {
		const validated = validateProgramRecipePolicy(recipe);
		return Object.freeze({
			materializedRecipeDigest: materializedRecipeDigest(materialized),
			projectResolutionDigest: validated.projectResolutionDigest
		});
	} catch (error) {
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
	repositoryRoot: string
): void {
	try {
		const expected = materializeProgramRecipe(recipe, repositoryRoot);
		if (canonicalSemanticJson(expected) !== canonicalSemanticJson(materialized))
			throw new CompilerInputCaptureError(
				'INVALID_QUERY',
				'Materialized compiler inputs do not reproduce the authoritative ProgramRecipe projection.'
			);
	} catch (error) {
		if (error instanceof CompilerInputCaptureError) throw error;
		throw new CompilerInputCaptureError(
			'INVALID_QUERY',
			'Materialized compiler inputs could not be related to the authoritative ProgramRecipe.'
		);
	}
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
				const snapshot = snapshotMaterializedRecipe(materialized);
				assertExactMaterializedProjection(recipe, snapshot, paths.repositoryRoot);
				recipeIdentity(recipe, snapshot);
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
					capture: (query) => journal.capture(query, key)
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
				const snapshot = snapshotMaterializedRecipe(materialized);
				recipeIdentity(recipe, snapshot);
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
					capture: (query) => journal.replay(query, key)
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
