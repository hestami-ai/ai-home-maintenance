import { isProxy } from 'node:util/types';
import type { ProgramRecipe } from '../contracts/subject.js';
import { TYPESCRIPT_PROVIDER_VERSION } from '../contracts/semantic.js';
import { isUnicodeScalarString } from './canonical.js';
import { programRecipeDigest } from './ids.js';

export const MATERIALIZED_SCALAR_PATH_OPTIONS = new Set([
	'baseUrl',
	'configFilePath',
	'declarationDir',
	'mapRoot',
	'out',
	'outDir',
	'outFile',
	'pathsBasePath',
	'rootDir',
	'sourceRoot',
	'tsBuildInfoFile'
]);
export const MATERIALIZED_ARRAY_PATH_OPTIONS = new Set(['rootDirs', 'typeRoots']);
export const PRESERVED_NON_PATH_OPTIONS = new Set([
	'customConditions',
	'lib',
	'moduleSuffixes',
	'paths',
	'types'
]);
export const REJECTED_PATH_OPTIONS = new Set(['generateCpuProfile', 'generateTrace', 'project']);

const PROGRAM_RECIPE_KEYS = [
	'compilerOptions',
	'configClosureDigest',
	'configPath',
	'kind',
	'projectReferences',
	'projectResolutionDigest',
	'provider',
	'rootNames'
] as const;
const PROVIDER_KEYS = ['id', 'version'] as const;
const SHA256 = /^[a-f0-9]{64}$/u;
const MAX_WIRE_NODES = 100_000;
const BOOLEAN_COMPILER_OPTIONS = new Set([
	'allowImportingTsExtensions',
	'allowJs',
	'allowArbitraryExtensions',
	'allowSyntheticDefaultImports',
	'allowUmdGlobalAccess',
	'allowUnreachableCode',
	'allowUnusedLabels',
	'alwaysStrict',
	'assumeChangesOnlyAffectDirectDependencies',
	'checkJs',
	'composite',
	'declaration',
	'declarationMap',
	'disableReferencedProjectLoad',
	'disableSizeLimit',
	'disableSolutionSearching',
	'disableSourceOfProjectReferenceRedirect',
	'downlevelIteration',
	'emitBOM',
	'emitDeclarationOnly',
	'emitDecoratorMetadata',
	'erasableSyntaxOnly',
	'esModuleInterop',
	'exactOptionalPropertyTypes',
	'experimentalDecorators',
	'forceConsistentCasingInFileNames',
	'importHelpers',
	'incremental',
	'inlineSourceMap',
	'inlineSources',
	'isolatedDeclarations',
	'isolatedModules',
	'keyofStringsOnly',
	'libReplacement',
	'noCheck',
	'noEmit',
	'noEmitHelpers',
	'noEmitOnError',
	'noErrorTruncation',
	'noFallthroughCasesInSwitch',
	'noImplicitAny',
	'noImplicitOverride',
	'noImplicitReturns',
	'noImplicitThis',
	'noImplicitUseStrict',
	'noLib',
	'noPropertyAccessFromIndexSignature',
	'noResolve',
	'noStrictGenericChecks',
	'noUncheckedIndexedAccess',
	'noUncheckedSideEffectImports',
	'noUnusedLocals',
	'noUnusedParameters',
	'preserveConstEnums',
	'preserveSymlinks',
	'preserveValueImports',
	'removeComments',
	'resolveJsonModule',
	'resolvePackageJsonExports',
	'resolvePackageJsonImports',
	'rewriteRelativeImportExtensions',
	'skipDefaultLibCheck',
	'skipLibCheck',
	'sourceMap',
	'strict',
	'strictBindCallApply',
	'strictBuiltinIteratorReturn',
	'strictFunctionTypes',
	'strictNullChecks',
	'strictPropertyInitialization',
	'stripInternal',
	'suppressExcessPropertyErrors',
	'suppressImplicitAnyIndexErrors',
	'traceResolution',
	'useDefineForClassFields',
	'useUnknownInCatchVariables',
	'verbatimModuleSyntax'
]);
const STRING_COMPILER_OPTIONS = new Set([
	'charset',
	'ignoreDeprecations',
	'jsxFactory',
	'jsxFragmentFactory',
	'jsxImportSource',
	'locale',
	'reactNamespace'
]);
const STRING_ARRAY_COMPILER_OPTIONS = new Set([
	'customConditions',
	'lib',
	'moduleSuffixes',
	'types'
]);
const ENUM_COMPILER_OPTIONS = new Map<string, ReadonlySet<number>>([
	['importsNotUsedAsValues', new Set([0, 1, 2])],
	['jsx', new Set([0, 1, 2, 3, 4, 5])],
	['module', new Set([0, 1, 2, 3, 4, 5, 6, 7, 99, 100, 101, 102, 199, 200])],
	['moduleDetection', new Set([1, 2, 3])],
	['moduleResolution', new Set([1, 2, 3, 99, 100])],
	['newLine', new Set([0, 1])],
	['target', new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 99, 100])]
]);

export class ProgramRecipePolicyError extends Error {
	constructor(
		readonly code: 'INVALID_RECIPE' | 'VERSION_MISMATCH',
		message: string
	) {
		super(message);
		this.name = 'ProgramRecipePolicyError';
	}
}

function invalid(message: string): never {
	throw new ProgramRecipePolicyError('INVALID_RECIPE', message);
}

function dataRecord(value: unknown, field: string): Readonly<Record<string, unknown>> {
	if (value === null || typeof value !== 'object' || isProxy(value) || Array.isArray(value))
		invalid(`${field} must be an inert wire object.`);
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		invalid(`${field} must be an inert wire object.`);
	const keys = Reflect.ownKeys(value);
	if (keys.some((key) => typeof key !== 'string'))
		invalid(`${field} must not contain symbol properties.`);
	const copy: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
	for (const key of keys as string[]) {
		if (!isUnicodeScalarString(key))
			invalid(`${field} keys must contain only Unicode scalar values.`);
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			invalid(`${field}.${key} must be an enumerable data property.`);
		copy[key] = descriptor.value;
	}
	return copy;
}

function exactDataRecord(
	value: unknown,
	field: string,
	expectedKeys: readonly string[]
): Readonly<Record<string, unknown>> {
	const record = dataRecord(value, field);
	const keys = Object.keys(record).sort();
	const expected = [...expectedKeys].sort();
	if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index]))
		invalid(`${field} must contain exactly: ${expected.join(', ')}.`);
	return record;
}

function wireArray(value: unknown, field: string): readonly unknown[] {
	if (value === null || typeof value !== 'object' || isProxy(value) || !Array.isArray(value))
		invalid(`${field} must be an inert wire array.`);
	const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
	const length =
		lengthDescriptor !== undefined && 'value' in lengthDescriptor
			? lengthDescriptor.value
			: undefined;
	if (
		typeof length !== 'number' ||
		!Number.isSafeInteger(length) ||
		length < 0 ||
		length > MAX_WIRE_NODES
	)
		invalid(`${field} exceeds the materialization item budget or has an invalid length.`);
	const keys = Reflect.ownKeys(value);
	if (
		keys.length !== length + 1 ||
		keys.some(
			(key) => typeof key !== 'string' || (key !== 'length' && !/^(?:0|[1-9][0-9]*)$/u.test(key))
		)
	)
		invalid(`${field} must be dense and contain no symbol or expando properties.`);
	const copy: unknown[] = [];
	for (let index = 0; index < length; index += 1) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			invalid(`${field}[${index}] must be an enumerable data property.`);
		copy.push(descriptor.value);
	}
	return copy;
}

function requiredString(
	record: Readonly<Record<string, unknown>>,
	key: string,
	field: string
): string {
	const value = record[key];
	if (typeof value !== 'string' || !isUnicodeScalarString(value))
		invalid(`${field}.${key} must be a Unicode-scalar string.`);
	return value;
}

function budgetedText(value: string, field: string, maxPathCharacters: number): string {
	if (!isUnicodeScalarString(value)) invalid(`${field} must contain only Unicode scalar values.`);
	if (value.length > maxPathCharacters)
		invalid(`${field} exceeds the producing path-character budget.`);
	return value;
}

export function validateProgramRecipeLogicalPath(
	value: unknown,
	field: string,
	maxPathCharacters = Number.MAX_SAFE_INTEGER,
	allowRepositoryRoot = false
): string {
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value.includes('\\') ||
		value.startsWith('/') ||
		/^[A-Za-z]:/u.test(value) ||
		(value === '.' && !allowRepositoryRoot) ||
		(value !== '.' &&
			value.split('/').some((segment) => segment === '' || segment === '.' || segment === '..'))
	) {
		invalid(`${field} must be one canonical repository-relative logical path.`);
	}
	return budgetedText(value, field, maxPathCharacters);
}

function canonicalStringSet(
	value: unknown,
	field: string,
	paths: boolean,
	maxPathCharacters: number,
	allowRepositoryRoot = false
): readonly string[] {
	const array = wireArray(value, field);
	const strings = array.map((entry, index) => {
		if (typeof entry !== 'string') invalid(`${field}[${index}] must be a string.`);
		if (!isUnicodeScalarString(entry))
			invalid(`${field}[${index}] must contain only Unicode scalar values.`);
		return paths
			? validateProgramRecipeLogicalPath(
					entry,
					`${field}[${index}]`,
					maxPathCharacters,
					allowRepositoryRoot
				)
			: entry;
	});
	if (strings.some((entry, index) => index > 0 && strings[index - 1]! >= entry))
		invalid(`${field} must be sorted and duplicate-free.`);
	const caseFolded = new Set<string>();
	for (const entry of strings) {
		const identity = entry.toLowerCase();
		if (caseFolded.has(identity))
			invalid(`${field} must not contain case-colliding path identities.`);
		caseFolded.add(identity);
	}
	return strings;
}

function stringArray(value: unknown, field: string): readonly string[] {
	return wireArray(value, field).map((entry, index) => {
		if (typeof entry !== 'string' || !isUnicodeScalarString(entry))
			invalid(`${field}[${index}] must be a Unicode-scalar string.`);
		return entry;
	});
}

function validatePathsOption(
	value: unknown,
	maxPathCharacters: number
): Readonly<Record<string, readonly string[]>> {
	const paths = dataRecord(value, 'compilerOptions.paths');
	return Object.fromEntries(
		Object.keys(paths).map((pattern) => {
			if (
				pattern.length === 0 ||
				pattern.length > maxPathCharacters ||
				pattern.includes('\\') ||
				pattern.startsWith('/') ||
				/^[A-Za-z]:/u.test(pattern)
			)
				invalid('compilerOptions.paths keys must be budgeted non-absolute slash-form patterns.');
			const substitutions = stringArray(paths[pattern], `compilerOptions.paths.${pattern}`);
			for (const [index, substitution] of substitutions.entries()) {
				if (
					substitution.length === 0 ||
					substitution.length > maxPathCharacters ||
					substitution.includes('\\') ||
					substitution.startsWith('/') ||
					/^[A-Za-z]:/u.test(substitution) ||
					substitution.split('/').some((segment) => segment === '')
				)
					invalid(
						`compilerOptions.paths.${pattern}[${index}] must be a budgeted non-absolute slash-form TypeScript path substitution.`
					);
			}
			return [pattern, substitutions];
		})
	);
}

function validateNonPathCompilerOption(
	key: string,
	value: unknown,
	maxPathCharacters: number
): unknown {
	if (BOOLEAN_COMPILER_OPTIONS.has(key)) {
		if (typeof value !== 'boolean') invalid(`compilerOptions.${key} must be boolean.`);
		return value;
	}
	if (STRING_COMPILER_OPTIONS.has(key)) {
		if (typeof value !== 'string' || !isUnicodeScalarString(value))
			invalid(`compilerOptions.${key} must be a Unicode-scalar string.`);
		return value;
	}
	if (STRING_ARRAY_COMPILER_OPTIONS.has(key)) return stringArray(value, `compilerOptions.${key}`);
	if (key === 'paths') return validatePathsOption(value, maxPathCharacters);
	if (key === 'maxNodeModuleJsDepth') {
		if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
			invalid('compilerOptions.maxNodeModuleJsDepth must be a non-negative safe integer.');
		return value;
	}
	const enumValues = ENUM_COMPILER_OPTIONS.get(key);
	if (enumValues !== undefined) {
		if (typeof value !== 'number' || !enumValues.has(value))
			invalid(
				`compilerOptions.${key} is outside the TypeScript ${TYPESCRIPT_PROVIDER_VERSION} enum domain.`
			);
		return value;
	}
	invalid(
		`Compiler option ${key} is not in the exact supported TypeScript ${TYPESCRIPT_PROVIDER_VERSION} Program option registry.`
	);
}

export interface ValidatedProgramRecipePolicy {
	readonly compilerOptions: Readonly<Record<string, unknown>>;
	readonly configClosureDigest: string;
	readonly configPath: string;
	readonly kind: ProgramRecipe['kind'];
	readonly projectReferences: readonly string[];
	readonly projectResolutionDigest: string;
	readonly provider: ProgramRecipe['provider'];
	readonly rootNames: readonly string[];
}

export function validateProgramRecipePolicy(
	recipeValue: unknown,
	maxPathCharacters = Number.MAX_SAFE_INTEGER
): ValidatedProgramRecipePolicy {
	if (!Number.isSafeInteger(maxPathCharacters) || maxPathCharacters <= 0)
		invalid('ProgramRecipe path-character budget must be a positive safe integer.');
	const recipe = exactDataRecord(recipeValue, 'ProgramRecipe', PROGRAM_RECIPE_KEYS);
	const provider = exactDataRecord(recipe.provider, 'ProgramRecipe.provider', PROVIDER_KEYS);
	const providerId = requiredString(provider, 'id', 'ProgramRecipe.provider');
	const providerVersion = requiredString(provider, 'version', 'ProgramRecipe.provider');
	if (providerId !== 'typescript' || providerVersion !== TYPESCRIPT_PROVIDER_VERSION)
		throw new ProgramRecipePolicyError(
			'VERSION_MISMATCH',
			`ProgramRecipe requires TypeScript ${TYPESCRIPT_PROVIDER_VERSION}.`
		);
	const kind = requiredString(recipe, 'kind', 'ProgramRecipe');
	if (!['PROJECT', 'BUILD', 'SOLUTION'].includes(kind))
		invalid('ProgramRecipe.kind is not registered.');
	const configClosureDigest = requiredString(recipe, 'configClosureDigest', 'ProgramRecipe');
	const projectResolutionDigest = requiredString(
		recipe,
		'projectResolutionDigest',
		'ProgramRecipe'
	);
	if (!SHA256.test(configClosureDigest) || !SHA256.test(projectResolutionDigest))
		invalid('ProgramRecipe digests must be lowercase SHA-256 values.');
	const configPath = validateProgramRecipeLogicalPath(
		recipe.configPath,
		'ProgramRecipe.configPath',
		maxPathCharacters
	);
	const rootNames = canonicalStringSet(
		recipe.rootNames,
		'ProgramRecipe.rootNames',
		true,
		maxPathCharacters
	);
	const projectReferences = canonicalStringSet(
		recipe.projectReferences,
		'ProgramRecipe.projectReferences',
		true,
		maxPathCharacters
	);
	const rawCompilerOptions = dataRecord(recipe.compilerOptions, 'ProgramRecipe.compilerOptions');
	const compilerOptions: Record<string, unknown> = {};
	for (const key of Object.keys(rawCompilerOptions)) {
		const value = rawCompilerOptions[key];
		if (REJECTED_PATH_OPTIONS.has(key))
			invalid(
				`Compiler option ${key} is a command-line path with effects outside Program construction and is not permitted.`
			);
		if (MATERIALIZED_SCALAR_PATH_OPTIONS.has(key))
			compilerOptions[key] = validateProgramRecipeLogicalPath(
				value,
				`compilerOptions.${key}`,
				maxPathCharacters,
				true
			);
		else if (MATERIALIZED_ARRAY_PATH_OPTIONS.has(key))
			compilerOptions[key] = canonicalStringSet(
				value,
				`compilerOptions.${key}`,
				true,
				maxPathCharacters,
				true
			);
		else compilerOptions[key] = validateNonPathCompilerOption(key, value, maxPathCharacters);
	}
	if (compilerOptions.configFilePath !== undefined && compilerOptions.configFilePath !== configPath)
		invalid('compilerOptions.configFilePath must exactly match ProgramRecipe.configPath.');
	const digestInput = {
		compilerOptions,
		configClosureDigest,
		configPath,
		kind: kind as ProgramRecipe['kind'],
		projectReferences,
		provider: { id: 'typescript' as const, version: providerVersion },
		rootNames
	};
	if (programRecipeDigest(digestInput) !== projectResolutionDigest)
		invalid('ProgramRecipe digest does not match its exact frozen preimage.');
	return { ...digestInput, projectResolutionDigest };
}
