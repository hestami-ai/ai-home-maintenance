import { lstatSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, parse, posix, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import type { ProgramRecipe } from '../../contracts/subject.js';
import { TYPESCRIPT_PROVIDER_VERSION } from '../../contracts/semantic.js';
import {
	MATERIALIZED_ARRAY_PATH_OPTIONS,
	MATERIALIZED_SCALAR_PATH_OPTIONS,
	ProgramRecipePolicyError,
	validateProgramRecipeLogicalPath,
	validateProgramRecipePolicy
} from '../../semantic/program-recipe-policy.js';

export {
	MATERIALIZED_ARRAY_PATH_OPTIONS,
	MATERIALIZED_SCALAR_PATH_OPTIONS,
	PRESERVED_NON_PATH_OPTIONS,
	REJECTED_PATH_OPTIONS
} from '../../semantic/program-recipe-policy.js';

export interface MaterializedProgramRecipe {
	readonly compilerOptions: ts.CompilerOptions;
	readonly configFilePath: string;
	readonly projectReferences: readonly ts.ProjectReference[];
	readonly rootNames: readonly string[];
}

export class ProgramRecipeMaterializationError extends Error {
	constructor(
		readonly code: 'INVALID_RECIPE' | 'PATH_ESCAPE' | 'VERSION_MISMATCH',
		message: string
	) {
		super(message);
		this.name = 'ProgramRecipeMaterializationError';
	}
}

function invalid(message: string): never {
	throw new ProgramRecipeMaterializationError('INVALID_RECIPE', message);
}

function logicalPath(value: unknown, field: string, allowRepositoryRoot = false): string {
	return validateProgramRecipeLogicalPath(
		value,
		field,
		Number.MAX_SAFE_INTEGER,
		allowRepositoryRoot
	);
}

function inside(root: string, candidate: string): boolean {
	const fromRoot = relative(root, candidate);
	return (
		fromRoot === '' ||
		(!isAbsolute(fromRoot) && fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`))
	);
}

function canonicalRepositoryRoot(repositoryRoot: unknown): string {
	if (typeof repositoryRoot !== 'string' || !isAbsolute(repositoryRoot))
		invalid('Repository root must be an absolute existing directory at the runtime boundary.');
	const rootSegments = repositoryRoot.slice(parse(repositoryRoot).root.length).split(/[\\/]/u);
	if (rootSegments.some((segment) => segment === '.' || segment === '..'))
		invalid('Repository root must not contain unresolved dot segments.');
	let stats;
	try {
		stats = statSync(repositoryRoot);
	} catch {
		invalid('Repository root must be an absolute existing directory at the runtime boundary.');
	}
	if (!stats.isDirectory())
		invalid('Repository root must be an absolute existing directory at the runtime boundary.');
	try {
		return realpathSync.native(repositoryRoot);
	} catch {
		invalid('Repository root could not be canonicalized.');
	}
}

function canonicalizeCandidate(
	repositoryRoot: string,
	lexicalCandidate: string,
	field: string
): string {
	if (!inside(repositoryRoot, lexicalCandidate))
		throw new ProgramRecipeMaterializationError(
			'PATH_ESCAPE',
			`${field} escapes the repository root.`
		);
	let existingAncestor = lexicalCandidate;
	const tail: string[] = [];
	while (existingAncestor !== repositoryRoot) {
		try {
			lstatSync(existingAncestor);
			break;
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code;
			if (code !== 'ENOENT' && code !== 'ENOTDIR')
				invalid(`${field} could not be inspected for path confinement.`);
			tail.unshift(basename(existingAncestor));
			existingAncestor = dirname(existingAncestor);
		}
	}
	let canonicalAncestor: string;
	try {
		canonicalAncestor = realpathSync.native(existingAncestor);
	} catch {
		invalid(`${field} could not be canonicalized for path confinement.`);
	}
	const canonicalCandidate = resolve(canonicalAncestor, ...tail);
	if (!inside(repositoryRoot, canonicalCandidate))
		throw new ProgramRecipeMaterializationError(
			'PATH_ESCAPE',
			`${field} escapes the repository root through filesystem indirection.`
		);
	return canonicalCandidate;
}

function materializePath(repositoryRoot: string, value: unknown, field: string): string {
	const logical = logicalPath(value, field, true);
	const lexicalCandidate =
		logical === '.' ? repositoryRoot : resolve(repositoryRoot, ...logical.split('/'));
	return canonicalizeCandidate(repositoryRoot, lexicalCandidate, field);
}

function validatePathSubstitutions(
	paths: Readonly<Record<string, readonly string[]>>,
	repositoryRoot: string,
	effectiveBase: string
): void {
	for (const [pattern, substitutions] of Object.entries(paths)) {
		for (const [index, substitution] of substitutions.entries()) {
			const field = `compilerOptions.paths.${pattern}[${index}]`;
			if (
				substitution.length === 0 ||
				substitution.includes('\\') ||
				substitution.startsWith('/') ||
				/^[A-Za-z]:/u.test(substitution) ||
				substitution.split('/').includes('')
			)
				invalid(`${field} must be a non-absolute slash-form TypeScript path substitution.`);
			const lexicalCandidate = resolve(effectiveBase, ...substitution.split('/'));
			canonicalizeCandidate(repositoryRoot, lexicalCandidate, field);
		}
	}
}

function materializeProgramRecipeUnsafe(
	recipeValue: unknown,
	repositoryRootValue: unknown
): MaterializedProgramRecipe {
	const repositoryRoot = canonicalRepositoryRoot(repositoryRootValue);
	if (ts.version !== TYPESCRIPT_PROVIDER_VERSION) {
		throw new ProgramRecipeMaterializationError(
			'VERSION_MISMATCH',
			`ProgramRecipe requires TypeScript ${TYPESCRIPT_PROVIDER_VERSION}; runtime is ${ts.version}.`
		);
	}
	const recipe = validateProgramRecipePolicy(recipeValue);

	const compilerOptions: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(recipe.compilerOptions)) {
		if (MATERIALIZED_SCALAR_PATH_OPTIONS.has(key)) {
			compilerOptions[key] = materializePath(repositoryRoot, value, `compilerOptions.${key}`);
			continue;
		}
		if (MATERIALIZED_ARRAY_PATH_OPTIONS.has(key)) {
			const paths = value as readonly string[];
			compilerOptions[key] = paths.map((entry, index) =>
				materializePath(repositoryRoot, entry, `compilerOptions.${key}[${index}]`)
			);
			continue;
		}
		compilerOptions[key] = value;
	}
	if (recipe.compilerOptions.paths !== undefined) {
		const declaredBaseLogical =
			typeof recipe.compilerOptions.baseUrl === 'string'
				? recipe.compilerOptions.baseUrl
				: recipe.compilerOptions.pathsBasePath;
		const effectiveBaseLogical =
			typeof declaredBaseLogical === 'string'
				? declaredBaseLogical
				: posix.dirname(recipe.configPath);
		const effectiveBase = materializePath(
			repositoryRoot,
			effectiveBaseLogical,
			'compilerOptions.paths effective base'
		);
		validatePathSubstitutions(
			recipe.compilerOptions.paths as Readonly<Record<string, readonly string[]>>,
			repositoryRoot,
			effectiveBase
		);
		if (
			recipe.compilerOptions.baseUrl === undefined &&
			recipe.compilerOptions.pathsBasePath === undefined
		)
			compilerOptions.pathsBasePath = effectiveBase;
	}

	return {
		compilerOptions: compilerOptions as ts.CompilerOptions,
		configFilePath: materializePath(repositoryRoot, recipe.configPath, 'configPath'),
		projectReferences: recipe.projectReferences.map((path) => ({
			path: materializePath(repositoryRoot, path, 'projectReferences')
		})),
		rootNames: recipe.rootNames.map((path) => materializePath(repositoryRoot, path, 'rootNames'))
	};
}

export function materializeProgramRecipe(
	recipe: ProgramRecipe,
	repositoryRoot: string
): MaterializedProgramRecipe {
	try {
		return materializeProgramRecipeUnsafe(recipe, repositoryRoot);
	} catch (error) {
		if (error instanceof ProgramRecipeMaterializationError) throw error;
		if (error instanceof ProgramRecipePolicyError)
			throw new ProgramRecipeMaterializationError(error.code, error.message);
		throw new ProgramRecipeMaterializationError(
			'INVALID_RECIPE',
			'ProgramRecipe could not be read as inert, valid wire data.'
		);
	}
}
