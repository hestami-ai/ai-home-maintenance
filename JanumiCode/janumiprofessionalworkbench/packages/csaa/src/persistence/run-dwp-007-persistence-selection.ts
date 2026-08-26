import { createHash, randomUUID } from 'node:crypto';
import {
	closeSync,
	fsyncSync,
	lstatSync,
	openSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { arch, platform } from 'node:os';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import {
	dwp007PersistenceSelectionImplementationSourceDigest,
	measureDwp007PersistenceSelection,
	type Dwp007PersistenceSelectionEvidence,
	type Dwp007PersistenceSelectionImplementationSource,
	validateDwp007PersistenceSelectionEvidence
} from './assess-dwp-007-persistence-selection.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const EVIDENCE_RELATIVE_PATH = 'verif/csaa/dwp-007.persistence-selection.evidence.json';
const BETTER_SQLITE3_ENTRY_RELATIVE_PATH = 'node_modules/better-sqlite3/lib/index.js';
const BETTER_SQLITE3_PACKAGE_RELATIVE_PATH = 'node_modules/better-sqlite3/package.json';
const CSAA_PACKAGE_RELATIVE_PATH = 'packages/csaa/package.json';
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_EVIDENCE_BYTES = 512 * 1024;
const IMPLEMENTATION_SOURCE_PATHS = Object.freeze([
	'bun.lock',
	'packages/csaa/package.json',
	'packages/csaa/src/persistence/assess-dwp-007-persistence-selection.ts',
	'packages/csaa/src/persistence/content-addressed-file-store.ts',
	'packages/csaa/src/persistence/run-dwp-007-persistence-selection.ts'
] as const);

type Mode = '--check' | '--write';

class UsageError extends Error {}

export interface Dwp007PersistenceSelectionCommandContext {
	readonly architecture: string;
	readonly argv: readonly string[];
	readonly bunExecutable: string;
	readonly bunVersion: string | undefined;
	readonly measure: typeof measureDwp007PersistenceSelection;
	readonly nodeExecutable: string;
	readonly platform: string;
	readonly repositoryRoot: string;
}

export interface Dwp007PersistenceSelectionCommandIo {
	readonly setExitCode: (exitCode: number) => void;
	readonly stderr: (text: string) => void;
	readonly stdout: (text: string) => void;
}

function mode(argv: readonly string[]): Mode {
	if (argv.length !== 1 || (argv[0] !== '--check' && argv[0] !== '--write'))
		throw new UsageError(
			'Usage: bun packages/csaa/src/persistence/run-dwp-007-persistence-selection.ts --write|--check'
		);
	return argv[0];
}

function isErrno(error: unknown, code: string): boolean {
	return (
		error !== null &&
		typeof error === 'object' &&
		'code' in error &&
		(error as { readonly code?: unknown }).code === code
	);
}

function confinedPath(root: string, relativePath: string): string {
	const absolute = resolve(root, relativePath);
	const fromRoot = relative(root, absolute);
	if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || resolve(root, fromRoot) !== absolute)
		throw new Error(`Configured path escapes the repository root: ${relativePath}`);
	return absolute;
}

function assertOrdinaryFile(path: string, label: string, maximumBytes: number): void {
	const status = lstatSync(path);
	if (status.isSymbolicLink() || !status.isFile())
		throw new Error(`${label} is not an ordinary file.`);
	if (status.size <= 0 || status.size > maximumBytes)
		throw new Error(`${label} has an invalid or excessive byte length.`);
}

function readStableFile(path: string, label: string, maximumBytes: number): Buffer {
	assertOrdinaryFile(path, label, maximumBytes);
	const before = lstatSync(path);
	const bytes = readFileSync(path);
	const after = lstatSync(path);
	if (
		before.size !== after.size ||
		before.mtimeMs !== after.mtimeMs ||
		bytes.byteLength !== after.size
	)
		throw new Error(`${label} changed while it was read.`);
	return bytes;
}

function sourceSet(
	repositoryRoot: string,
	implementationSourcePaths: readonly string[]
): readonly Dwp007PersistenceSelectionImplementationSource[] {
	return Object.freeze(
		implementationSourcePaths.map((path) => {
			const absolute = confinedPath(repositoryRoot, path);
			const bytes = readStableFile(absolute, `Implementation source ${path}`, MAX_SOURCE_BYTES);
			return Object.freeze({
				path,
				sha256: createHash('sha256').update(bytes).digest('hex')
			});
		})
	);
}

function parseJsonRecord(bytes: Buffer, label: string): Record<string, unknown> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(bytes.toString('utf8')) as unknown;
	} catch {
		throw new Error(`${label} is not valid JSON.`);
	}
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
		throw new Error(`${label} is not a JSON object.`);
	return parsed as Record<string, unknown>;
}

function betterSqlite3Version(packagePath: string, entryPath: string): string {
	const candidatePackage = parseJsonRecord(
		readStableFile(packagePath, 'Installed better-sqlite3 package', 128 * 1024),
		'Installed better-sqlite3 package'
	);
	if (
		typeof candidatePackage.version !== 'string' ||
		candidatePackage.version.length === 0 ||
		candidatePackage.version.length > 128
	)
		throw new Error('The installed better-sqlite3 package version is invalid.');
	assertOrdinaryFile(entryPath, 'Installed better-sqlite3 entry', MAX_SOURCE_BYTES);
	return candidatePackage.version;
}

function currentNodeVersion(nodeExecutable: string): string {
	const result = spawnSync(nodeExecutable, ['--version'], {
		encoding: 'utf8',
		maxBuffer: 4 * 1024,
		timeout: 5_000,
		windowsHide: true
	});
	const version = (result.stdout ?? '').trim();
	if (
		result.status !== 0 ||
		result.stderr !== '' ||
		!/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(version)
	)
		throw new Error('The current Node runtime version could not be measured.');
	return version;
}

function assertEnvironmentCurrent(
	evidence: Dwp007PersistenceSelectionEvidence,
	installedBetterSqlite3Version: string,
	context: Dwp007PersistenceSelectionCommandContext
): void {
	if (
		evidence.environment.architecture !== context.architecture ||
		evidence.environment.betterSqlite3Version !== installedBetterSqlite3Version ||
		evidence.environment.bunVersion !== context.bunVersion ||
		evidence.environment.nodeVersion !== currentNodeVersion(context.nodeExecutable) ||
		evidence.environment.platform !== context.platform
	)
		throw new Error('The checked-in DWP-007 selection evidence environment is stale.');
}

function assertCsaaDoesNotDeclareSqliteAdapter(packagePath: string): void {
	const manifest = parseJsonRecord(
		readStableFile(packagePath, 'CSAA package manifest', 512 * 1024),
		'CSAA package manifest'
	);
	for (const section of [
		'dependencies',
		'devDependencies',
		'peerDependencies',
		'optionalDependencies'
	]) {
		const dependencies = manifest[section];
		if (
			dependencies !== null &&
			typeof dependencies === 'object' &&
			!Array.isArray(dependencies) &&
			Object.hasOwn(dependencies, 'better-sqlite3')
		)
			throw new Error(
				'The CSAA package now declares better-sqlite3; the DWP-007 selection must be reassessed before evidence is regenerated.'
			);
	}
}

function evidenceText(evidence: Dwp007PersistenceSelectionEvidence): string {
	return `${canonicalSemanticJson(evidence)}\n`;
}

function fsyncDirectoryBestEffort(path: string): void {
	let descriptor: number | undefined;
	try {
		descriptor = openSync(path, 'r');
		fsyncSync(descriptor);
	} catch {
		// Directory fsync is unavailable on some supported Windows filesystems.
	} finally {
		if (descriptor !== undefined) closeSync(descriptor);
	}
}

function assertReplaceTarget(path: string): void {
	try {
		assertOrdinaryFile(path, 'Existing DWP-007 selection evidence', MAX_EVIDENCE_BYTES);
	} catch (error) {
		if (!isErrno(error, 'ENOENT')) throw error;
	}
}

function atomicWrite(path: string, text: string): void {
	const parent = dirname(path);
	const parentStatus = lstatSync(parent);
	if (parentStatus.isSymbolicLink() || !parentStatus.isDirectory())
		throw new Error('The DWP-007 selection evidence parent is not an ordinary directory.');
	assertReplaceTarget(path);
	const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`;
	let descriptor: number | undefined;
	try {
		descriptor = openSync(temporary, 'wx', 0o600);
		writeFileSync(descriptor, text, 'utf8');
		fsyncSync(descriptor);
		closeSync(descriptor);
		descriptor = undefined;
		renameSync(temporary, path);
		fsyncDirectoryBestEffort(parent);
	} finally {
		if (descriptor !== undefined) closeSync(descriptor);
		rmSync(temporary, { force: true });
	}
}

function checkedEvidence(
	evidencePath: string,
	implementationSourceDigest: string
): Dwp007PersistenceSelectionEvidence {
	assertOrdinaryFile(evidencePath, 'Checked-in DWP-007 selection evidence', MAX_EVIDENCE_BYTES);
	const text = readFileSync(evidencePath, 'utf8');
	let parsed: unknown;
	try {
		parsed = JSON.parse(text) as unknown;
	} catch {
		throw new Error('The checked-in DWP-007 selection evidence is not JSON.');
	}
	const evidence = validateDwp007PersistenceSelectionEvidence(parsed, implementationSourceDigest);
	if (evidenceText(evidence) !== text)
		throw new Error('The checked-in DWP-007 selection evidence is not canonical JSON.');
	return evidence;
}

function summary(
	state: 'CANONICAL_AND_SOURCE_CURRENT' | 'WRITTEN_TECHNICAL_SELECTION_EVIDENCE',
	evidence: Dwp007PersistenceSelectionEvidence,
	evidenceRelativePath: string
): string {
	return `${canonicalSemanticJson({
		acceptance: evidence.selection.acceptance,
		betterSqlite3BunOutcome: evidence.candidates.sqliteBetterSqlite3.probe.bunBetterSqlite3.outcome,
		evidencePath: evidenceRelativePath,
		implementationSourceDigest: evidence.implementationSourceDigest,
		selectedBackend: evidence.selection.selectedBackend,
		state
	})}\n`;
}

function defaultContext(): Dwp007PersistenceSelectionCommandContext {
	return {
		architecture: arch(),
		argv: process.argv.slice(2),
		bunExecutable: process.execPath,
		bunVersion: process.versions['bun'],
		measure: measureDwp007PersistenceSelection,
		nodeExecutable: 'node',
		platform: platform(),
		repositoryRoot: ROOT
	};
}

export function runDwp007PersistenceSelectionCommand(
	context: Dwp007PersistenceSelectionCommandContext
): string {
	const selectedMode = mode(context.argv);
	if (context.bunVersion === undefined || context.platform !== 'win32')
		throw new Error('DWP-007 selection evidence must be measured by the Bun runtime on Windows.');
	const betterSqlite3EntryPath = confinedPath(
		context.repositoryRoot,
		BETTER_SQLITE3_ENTRY_RELATIVE_PATH
	);
	const betterSqlite3PackagePath = confinedPath(
		context.repositoryRoot,
		BETTER_SQLITE3_PACKAGE_RELATIVE_PATH
	);
	const csaaPackagePath = confinedPath(context.repositoryRoot, CSAA_PACKAGE_RELATIVE_PATH);
	const evidencePath = confinedPath(context.repositoryRoot, EVIDENCE_RELATIVE_PATH);
	assertCsaaDoesNotDeclareSqliteAdapter(csaaPackagePath);
	const installedBetterSqlite3Version = betterSqlite3Version(
		betterSqlite3PackagePath,
		betterSqlite3EntryPath
	);
	const sourcesBefore = sourceSet(context.repositoryRoot, IMPLEMENTATION_SOURCE_PATHS);
	const digestBefore = dwp007PersistenceSelectionImplementationSourceDigest(sourcesBefore);
	if (selectedMode === '--check') {
		const evidence = checkedEvidence(evidencePath, digestBefore);
		assertEnvironmentCurrent(evidence, installedBetterSqlite3Version, context);
		return summary('CANONICAL_AND_SOURCE_CURRENT', evidence, EVIDENCE_RELATIVE_PATH);
	}
	const evidence = context.measure({
		betterSqlite3EntryPath,
		betterSqlite3Version: installedBetterSqlite3Version,
		bunExecutable: context.bunExecutable,
		environment: {
			architecture: context.architecture,
			bunVersion: context.bunVersion,
			codingAgentHost: 'BUN_PROCESS_HOST',
			platform: 'win32'
		},
		implementationSources: sourcesBefore,
		nodeExecutable: context.nodeExecutable
	});
	const sourcesAfter = sourceSet(context.repositoryRoot, IMPLEMENTATION_SOURCE_PATHS);
	if (canonicalSemanticJson(sourcesBefore) !== canonicalSemanticJson(sourcesAfter))
		throw new Error('Implementation sources changed during DWP-007 selection measurement.');
	atomicWrite(evidencePath, evidenceText(evidence));
	return summary('WRITTEN_TECHNICAL_SELECTION_EVIDENCE', evidence, EVIDENCE_RELATIVE_PATH);
}

export function runDwp007PersistenceSelectionMain(
	context: Dwp007PersistenceSelectionCommandContext = defaultContext(),
	io: Dwp007PersistenceSelectionCommandIo = {
		setExitCode: (exitCode) => {
			process.exitCode = exitCode;
		},
		stderr: (text) => process.stderr.write(text),
		stdout: (text) => process.stdout.write(text)
	}
): void {
	try {
		io.stdout(runDwp007PersistenceSelectionCommand(context));
	} catch (cause) {
		const usage = cause instanceof UsageError;
		const message = cause instanceof Error ? cause.message : String(cause);
		io.stderr(`${message}\n`);
		io.setExitCode(usage ? 2 : 1);
	}
}

if ((import.meta as ImportMeta & { readonly main?: boolean }).main === true)
	runDwp007PersistenceSelectionMain();
