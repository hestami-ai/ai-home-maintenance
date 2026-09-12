import { closeSync, fstatSync, lstatSync, openSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
	GENERATED_CONTEXT_SVELTE_KIT_SYNC_GENERATOR_ID,
	type GeneratedContextExecutionManifest,
	type GeneratedContextGeneratorIdentity
} from '../contracts/subject.js';
import { canonicalJson, compareText, sha256 } from '../inventory/canonical.js';
import { observeSvelteKitExecution } from './svelte-kit-execution-closure.js';

export const SVELTE_KIT_SYNC_GENERATOR_ID =
	GENERATED_CONTEXT_SVELTE_KIT_SYNC_GENERATOR_ID;
export const SVELTE_KIT_PACKAGE_NAME = '@sveltejs/kit' as const;
export const SVELTE_KIT_GENERATOR_ENTRY = 'node_modules/@sveltejs/kit/svelte-kit.js' as const;
export const SVELTE_KIT_GENERATOR_MANIFEST = 'node_modules/@sveltejs/kit/package.json' as const;
export const SVELTE_KIT_LOCKFILE = 'bun.lock' as const;
export const RPH_DEMO_GENERATED_CONTEXT_PATH = 'apps/rph-demo/.svelte-kit/tsconfig.json' as const;
export const RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH =
	'verif/csaa/rph-demo.svelte-kit.generated-context.evidence.json' as const;
export const RPH_DEMO_PROJECT_ROOT = 'apps/rph-demo' as const;

const MAX_PACKAGE_FILES = 10_000;
const MAX_PACKAGE_DIRECTORIES = 5_000;
const MAX_PACKAGE_DEPTH = 64;
const MAX_PACKAGE_BYTES = 128 * 1024 * 1024;
const MAX_LOCKFILE_BYTES = 16 * 1024 * 1024;
const MAX_OBSERVATION_DURATION_MS = 30_000;
const VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,127}$/u;
const INTEGRITY_PATTERN = /^sha512-[A-Za-z0-9+/]+={0,2}$/u;

interface InstalledPackageManifest {
	readonly name: typeof SVELTE_KIT_PACKAGE_NAME;
	readonly version: string;
}

interface InstalledPackageFile {
	readonly bytes: number;
	readonly path: string;
	readonly sha256: string;
}

export interface DirectSvelteKitPackageObservation {
	readonly entryPath: string;
	readonly generator: GeneratedContextGeneratorIdentity;
	readonly lockIntegrity: string;
	readonly packageFileCount: number;
	readonly packageTreeDigest: string;
}

function readBounded(path: string, maxBytes: number, label: string): Buffer {
	const pathBefore = lstatSync(path, { bigint: true });
	if (!pathBefore.isFile() || pathBefore.isSymbolicLink())
		throw new Error(`${label} is not a regular file.`);
	if (pathBefore.size > BigInt(maxBytes)) throw new Error(`${label} exceeds its byte limit.`);
	const descriptor = openSync(path, 'r');
	try {
		const openedBefore = fstatSync(descriptor, { bigint: true });
		if (!openedBefore.isFile() || openedBefore.size > BigInt(maxBytes))
			throw new Error(`${label} exceeds its byte limit or changed type.`);
		const bytes = readFileSync(descriptor);
		const openedAfter = fstatSync(descriptor, { bigint: true });
		const pathAfter = lstatSync(path, { bigint: true });
		if (
			bytes.byteLength > maxBytes ||
			openedBefore.dev !== openedAfter.dev ||
			openedBefore.ino !== openedAfter.ino ||
			openedBefore.size !== openedAfter.size ||
			openedBefore.mtimeNs !== openedAfter.mtimeNs ||
			pathBefore.dev !== pathAfter.dev ||
			pathBefore.ino !== pathAfter.ino ||
			pathBefore.size !== pathAfter.size ||
			pathBefore.mtimeNs !== pathAfter.mtimeNs ||
			pathAfter.dev !== openedAfter.dev ||
			pathAfter.ino !== openedAfter.ino
		)
			throw new Error(`${label} changed during its bounded read.`);
		return bytes;
	} finally {
		closeSync(descriptor);
	}
}

function validVersion(value: unknown): value is string {
	return typeof value === 'string' && VERSION_PATTERN.test(value);
}

function parseInstalledManifest(bytes: Buffer): InstalledPackageManifest {
	let value: unknown;
	try {
		value = JSON.parse(bytes.toString('utf8'));
	} catch {
		throw new Error('Installed @sveltejs/kit package manifest is malformed.');
	}
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Installed @sveltejs/kit package manifest has an invalid shape.');
	const record = value as Record<string, unknown>;
	if (record.name !== SVELTE_KIT_PACKAGE_NAME || !validVersion(record.version))
		throw new Error('Installed @sveltejs/kit package identity is invalid.');
	return { name: SVELTE_KIT_PACKAGE_NAME, version: record.version };
}

function lockResolution(lockBytes: Buffer): {
	readonly integrity: string;
	readonly version: string;
} {
	const text = lockBytes.toString('utf8');
	const pattern =
		/^ *"@sveltejs\/kit": *\["@sveltejs\/kit@([^"]+)",.*"(sha512-[A-Za-z0-9+/]+={0,2})"\], *$/gmu;
	const matches = [...text.matchAll(pattern)];
	if (matches.length !== 1)
		throw new Error('bun.lock must contain exactly one closed @sveltejs/kit package resolution.');
	const version = matches[0]?.[1];
	const integrity = matches[0]?.[2];
	if (!validVersion(version) || typeof integrity !== 'string' || !INTEGRITY_PATTERN.test(integrity))
		throw new Error('bun.lock contains an invalid @sveltejs/kit package resolution.');
	return { integrity, version };
}

function packageFiles(packageRoot: string): readonly InstalledPackageFile[] {
	const deadline = Date.now() + MAX_OBSERVATION_DURATION_MS;
	const rootStatus = lstatSync(packageRoot);
	if (!rootStatus.isDirectory())
		throw new Error('Installed @sveltejs/kit package root is not a regular directory.');
	const files: InstalledPackageFile[] = [];
	let totalBytes = 0;
	let directoryCount = 0;
	const visit = (directory: string, depth: number): void => {
		if (Date.now() > deadline)
			throw new Error('Installed @sveltejs/kit package traversal exceeded its duration limit.');
		if (depth > MAX_PACKAGE_DEPTH)
			throw new Error('Installed @sveltejs/kit package tree exceeds its depth limit.');
		directoryCount += 1;
		if (directoryCount > MAX_PACKAGE_DIRECTORIES)
			throw new Error('Installed @sveltejs/kit package tree exceeds its directory limit.');
		const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
			compareText(left.name, right.name)
		);
		for (const entry of entries) {
			const absolute = join(directory, entry.name);
			if (entry.isSymbolicLink())
				throw new Error('Installed @sveltejs/kit package tree contains a symbolic link.');
			if (entry.isDirectory()) {
				visit(absolute, depth + 1);
				continue;
			}
			if (!entry.isFile())
				throw new Error('Installed @sveltejs/kit package tree contains an unsupported entry.');
			if (files.length >= MAX_PACKAGE_FILES)
				throw new Error('Installed @sveltejs/kit package tree exceeds its file limit.');
			const bytes = readBounded(absolute, MAX_PACKAGE_BYTES, 'Installed package file');
			totalBytes += bytes.byteLength;
			if (totalBytes > MAX_PACKAGE_BYTES)
				throw new Error('Installed @sveltejs/kit package tree exceeds its byte limit.');
			files.push({
				bytes: bytes.byteLength,
				path: relative(packageRoot, absolute).replaceAll('\\', '/'),
				sha256: sha256(bytes)
			});
		}
	};
	visit(packageRoot, 0);
	return files.sort((left, right) => compareText(left.path, right.path));
}

export function observeDirectSvelteKitPackageIdentity(
	repositoryRoot: string
): DirectSvelteKitPackageObservation {
	const root = resolve(repositoryRoot);
	const packageRoot = resolve(root, 'node_modules/@sveltejs/kit');
	const manifestBytes = readBounded(
		resolve(root, SVELTE_KIT_GENERATOR_MANIFEST),
		1024 * 1024,
		'Installed @sveltejs/kit package manifest'
	);
	const installed = parseInstalledManifest(manifestBytes);
	const locked = lockResolution(
		readBounded(resolve(root, SVELTE_KIT_LOCKFILE), MAX_LOCKFILE_BYTES, 'bun.lock')
	);
	if (installed.version !== locked.version)
		throw new Error('Installed and lockfile-resolved @sveltejs/kit versions differ.');
	const files = packageFiles(packageRoot);
	if (!files.some((file) => file.path === 'svelte-kit.js'))
		throw new Error('Installed @sveltejs/kit package entry is absent from its package tree.');
	const packageTreeDigest = sha256(canonicalJson(files));
	const implementationDigest = sha256(
		canonicalJson({
			identityMethod: 'direct-kit-package-diagnostic/1.0.0',
			installed: {
				name: installed.name,
				packageTreeDigest,
				version: installed.version
			},
			locked: {
				integrity: locked.integrity,
				name: SVELTE_KIT_PACKAGE_NAME,
				version: locked.version
			}
		})
	);
	return {
		entryPath: resolve(root, SVELTE_KIT_GENERATOR_ENTRY),
		generator: {
			id: SVELTE_KIT_SYNC_GENERATOR_ID,
			implementationDigest,
			version: installed.version
		},
		lockIntegrity: locked.integrity,
		packageFileCount: files.length,
		packageTreeDigest
	};
}

export interface SvelteKitSyncGeneratorObservation {
	readonly entryPath: string;
	readonly executionManifest: GeneratedContextExecutionManifest;
	readonly generator: GeneratedContextGeneratorIdentity;
	readonly nodeExecutable: string;
}

export function observeSvelteKitSyncGenerator(
	repositoryRoot: string
): SvelteKitSyncGeneratorObservation {
	const execution = observeSvelteKitExecution(repositoryRoot);
	const kit = execution.manifest.packages.find((record) => record.name === SVELTE_KIT_PACKAGE_NAME);
	if (kit === undefined)
		throw new Error('Installed execution closure does not contain @sveltejs/kit.');
	const entryPath = resolve(repositoryRoot, SVELTE_KIT_GENERATOR_ENTRY);
	const entryStatus = lstatSync(entryPath);
	if (!entryStatus.isFile() || entryStatus.isSymbolicLink())
		throw new Error('Installed @sveltejs/kit execution entry is unavailable.');
	return {
		entryPath,
		executionManifest: execution.manifest,
		generator: {
			id: SVELTE_KIT_SYNC_GENERATOR_ID,
			implementationDigest: execution.implementationDigest,
			version: kit.version
		},
		nodeExecutable: execution.nodeExecutable
	};
}
