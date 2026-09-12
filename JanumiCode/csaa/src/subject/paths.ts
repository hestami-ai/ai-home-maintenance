import { realpathSync, statSync } from 'node:fs';
import { isAbsolute, posix, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

export type PathPlatform = 'win32' | 'posix';

export interface ResolvedRepositoryPath {
	readonly absolutePath: string;
	readonly canonicalPathKey: string;
	readonly path: string;
	readonly realPath: string;
}

function slash(path: string): string {
	return path.replaceAll('\\', '/');
}

export function isInsideRoot(repositoryRoot: string, candidate: string): boolean {
	const rel = relative(repositoryRoot, candidate);
	return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

export function resolveRepositoryRoot(rootLocator: string): string {
	if (!isAbsolute(rootLocator)) {
		throw new Error(`Repository root must be absolute: ${rootLocator}`);
	}
	const root = realpathSync(rootLocator);
	if (!statSync(root).isDirectory()) {
		throw new Error(`Repository root is not a directory: ${rootLocator}`);
	}
	return root;
}

export function canonicalPathKey(path: string, platform?: PathPlatform | boolean): string {
	const canonical = assertCanonicalRelativePath(path);
	let caseSensitive: boolean;
	if (platform === undefined) {
		caseSensitive = ts.sys.useCaseSensitiveFileNames;
	} else if (typeof platform === 'boolean') {
		caseSensitive = platform;
	} else {
		caseSensitive = platform === 'posix';
	}
	return caseSensitive ? canonical : canonical.toLowerCase();
}

export function repositoryRelativePath(repositoryRoot: string, candidate: string): string {
	const realRoot = resolveRepositoryRoot(repositoryRoot);
	const absolute = isAbsolute(candidate) ? resolve(candidate) : resolve(realRoot, candidate);
	if (!isInsideRoot(realRoot, absolute)) {
		throw new Error(`Path escapes repository root: ${candidate}`);
	}
	const rel = slash(relative(realRoot, absolute));
	return assertCanonicalRelativePath(rel);
}

export function resolveExistingRepositoryPath(
	repositoryRoot: string,
	candidate: string,
	platform?: PathPlatform | boolean
): ResolvedRepositoryPath {
	const realRoot = resolveRepositoryRoot(repositoryRoot);
	const path = repositoryRelativePath(realRoot, candidate);
	const absolutePath = resolve(realRoot, ...path.split('/'));
	const realPath = realpathSync(absolutePath);
	if (!isInsideRoot(realRoot, realPath)) {
		throw new Error(`Symlink or path escapes repository root: ${candidate}`);
	}
	return { absolutePath, canonicalPathKey: canonicalPathKey(path, platform), path, realPath };
}

export function assertSafeExistingPath(repositoryRoot: string, candidate: string): string {
	return resolveExistingRepositoryPath(repositoryRoot, candidate).realPath;
}

export function assertCanonicalRelativePath(path: string): string {
	if (path.includes('\\')) throw new Error(`Non-canonical repository-relative path: ${path}`);
	const normalized = slash(path);
	if (
		normalized.length === 0 ||
		isAbsolute(path) ||
		/^[A-Za-z]:\//u.test(normalized) ||
		normalized.startsWith('/') ||
		normalized.endsWith('/') ||
		normalized.includes('//') ||
		normalized.split('/').some((part) => part === '' || part === '.' || part === '..') ||
		posix.normalize(normalized) !== normalized
	) {
		throw new Error(`Non-canonical repository-relative path: ${path}`);
	}
	return normalized;
}

export function assertNoCanonicalPathCollisions(
	paths: readonly string[],
	platform?: PathPlatform | boolean
): void {
	const seen = new Map<string, string>();
	for (const path of paths) {
		const key = canonicalPathKey(path, platform);
		const previous = seen.get(key);
		if (previous !== undefined && previous !== path) {
			throw new Error(`Canonical path collision: ${previous} and ${path}`);
		}
		if (previous !== undefined) throw new Error(`Duplicate repository path: ${path}`);
		seen.set(key, path);
	}
}
