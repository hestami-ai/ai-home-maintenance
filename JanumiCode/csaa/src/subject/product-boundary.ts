import { lstatSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import { compareText } from '../inventory/canonical.js';
import { isInsideRoot } from './paths.js';

const EXCLUDED = new Set([
	'.svelte-kit',
	'.turbo',
	'build',
	'coverage',
	'dist',
	'e2e-results',
	'node_modules',
	'playwright-report',
	'test-results'
]);
const SOURCE = /\.[cm]?[jt]sx?$|\.svelte$/;

export interface ProductBoundaryViolation {
	readonly moduleSpecifier: string;
	readonly path: string;
}

export interface ProductBoundaryResult {
	readonly inspectedFiles: number;
	readonly perimeter: readonly ['apps', 'packages'];
	readonly violations: readonly ProductBoundaryViolation[];
}

function slash(path: string): string {
	return path.split(sep).join('/');
}

function moduleSpecifiers(source: string): string[] {
	const preprocessed = ts.preProcessFile(source, true, true);
	return [
		...preprocessed.importedFiles,
		...preprocessed.referencedFiles,
		...preprocessed.typeReferenceDirectives
	]
		.map((reference) => reference.fileName)
		.sort(compareText);
}

function targetsCsaa(repositoryRoot: string, sourcePath: string, specifier: string): boolean {
	if (specifier === '@janumipwb/csaa' || specifier.startsWith('@janumipwb/csaa/')) return true;
	if (!specifier.startsWith('.')) return false;
	const candidate = resolve(dirname(sourcePath), specifier);
	const csaaRoot = resolve(repositoryRoot, 'packages', 'csaa');
	return candidate === csaaRoot || isInsideRoot(csaaRoot, candidate);
}

export function inspectProductBoundary(repositoryRootInput: string): ProductBoundaryResult {
	const repositoryRoot = realpathSync(repositoryRootInput);
	const files: string[] = [];
	const roots = [
		...readdirSync(resolve(repositoryRoot, 'packages'), { withFileTypes: true })
			.filter((entry) => entry.isDirectory() && entry.name.startsWith('rph-'))
			.map((entry) => resolve(repositoryRoot, 'packages', entry.name)),
		...readdirSync(resolve(repositoryRoot, 'apps'), { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => resolve(repositoryRoot, 'apps', entry.name))
	];
	const visited = new Set<string>();
	const walk = (path: string) => {
		const info = lstatSync(path);
		if (info.isSymbolicLink()) {
			const target = realpathSync(path);
			if (!isInsideRoot(repositoryRoot, target)) {
				throw new Error(
					`Product-boundary symlink escapes repository root: ${slash(relative(repositoryRoot, path))}`
				);
			}
			walk(target);
			return;
		}
		if (info.isFile()) {
			if (SOURCE.test(path)) files.push(path);
			return;
		}
		if (!info.isDirectory() || EXCLUDED.has(basename(path))) return;
		const real = realpathSync(path);
		if (visited.has(real)) return;
		visited.add(real);
		for (const entry of readdirSync(path, { withFileTypes: true }).sort((left, right) =>
			compareText(left.name, right.name)
		)) {
			if (!EXCLUDED.has(entry.name)) walk(resolve(path, entry.name));
		}
	};
	for (const root of roots) {
		if (statSync(root).isDirectory()) walk(root);
	}
	const violations: ProductBoundaryViolation[] = [];
	files.sort(compareText);
	for (const path of files) {
		for (const specifier of moduleSpecifiers(readFileSync(path, 'utf8'))) {
			if (targetsCsaa(repositoryRoot, path, specifier)) {
				violations.push({
					moduleSpecifier: specifier,
					path: slash(relative(repositoryRoot, path))
				});
			}
		}
	}
	return { inspectedFiles: files.length, perimeter: ['apps', 'packages'], violations };
}
