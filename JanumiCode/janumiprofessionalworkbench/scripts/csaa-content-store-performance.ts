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
import { arch, cpus, platform } from 'node:os';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	contentAddressedStorePerformanceImplementationSourceDigest,
	measureContentAddressedStorePerformance,
	type ContentAddressedStorePerformanceEvidence,
	type ContentAddressedStorePerformanceEnvironment,
	type ContentAddressedStorePerformanceImplementationSource,
	validateContentAddressedStorePerformanceEvidence
} from '../packages/csaa/src/persistence/measure-content-addressed-file-store-performance.js';
import { canonicalSemanticJson } from '../packages/csaa/src/semantic/canonical.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EVIDENCE_RELATIVE_PATH = 'verif/csaa/dwp-007.content-addressed-store.cold-warm.evidence.json';
const EVIDENCE_PATH = resolve(ROOT, EVIDENCE_RELATIVE_PATH);
const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
const MAX_EVIDENCE_BYTES = 2 * 1024 * 1024;
const IMPLEMENTATION_SOURCE_PATHS = Object.freeze([
	'packages/csaa/src/persistence/content-addressed-file-store.ts',
	'packages/csaa/src/persistence/measure-content-addressed-file-store-performance.ts',
	'scripts/csaa-content-store-performance.ts'
] as const);

type Mode = '--check' | '--write';

class UsageError extends Error {}

function mode(argv: readonly string[]): Mode {
	if (argv.length !== 1 || (argv[0] !== '--check' && argv[0] !== '--write'))
		throw new UsageError('Usage: bun scripts/csaa-content-store-performance.ts --write|--check');
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

function confinedPath(relativePath: string): string {
	const absolute = resolve(ROOT, relativePath);
	const fromRoot = relative(ROOT, absolute);
	if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || resolve(ROOT, fromRoot) !== absolute)
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

function sourceSet(): readonly ContentAddressedStorePerformanceImplementationSource[] {
	return Object.freeze(
		IMPLEMENTATION_SOURCE_PATHS.map((path) => {
			const absolute = confinedPath(path);
			assertOrdinaryFile(absolute, `Implementation source ${path}`, MAX_SOURCE_BYTES);
			const before = lstatSync(absolute);
			const bytes = readFileSync(absolute);
			const after = lstatSync(absolute);
			if (
				before.size !== after.size ||
				before.mtimeMs !== after.mtimeMs ||
				bytes.byteLength !== after.size
			)
				throw new Error(`Implementation source changed while it was read: ${path}`);
			return Object.freeze({
				path,
				sha256: createHash('sha256').update(bytes).digest('hex')
			});
		})
	);
}

function runtimeEnvironment(): ContentAddressedStorePerformanceEnvironment {
	const bunVersion = process.versions['bun'];
	return Object.freeze({
		architecture: arch(),
		cpuModel: cpus()[0]?.model ?? 'UNAVAILABLE',
		engine: bunVersion === undefined ? 'node' : 'bun',
		engineVersion: bunVersion ?? process.versions.node,
		platform: platform()
	});
}

function evidenceText(evidence: ContentAddressedStorePerformanceEvidence): string {
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
		assertOrdinaryFile(path, 'Existing performance evidence', MAX_EVIDENCE_BYTES);
	} catch (error) {
		if (!isErrno(error, 'ENOENT')) throw error;
	}
}

function atomicWrite(path: string, text: string): void {
	const parent = dirname(path);
	const parentStatus = lstatSync(parent);
	if (parentStatus.isSymbolicLink() || !parentStatus.isDirectory())
		throw new Error('The performance evidence parent is not an ordinary directory.');
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
	implementationSourceDigest: string
): ContentAddressedStorePerformanceEvidence {
	assertOrdinaryFile(EVIDENCE_PATH, 'Checked-in performance evidence', MAX_EVIDENCE_BYTES);
	const text = readFileSync(EVIDENCE_PATH, 'utf8');
	let parsed: unknown;
	try {
		parsed = JSON.parse(text) as unknown;
	} catch {
		throw new Error('The checked-in performance evidence is not JSON.');
	}
	const evidence = validateContentAddressedStorePerformanceEvidence(
		parsed,
		implementationSourceDigest
	);
	if (evidenceText(evidence) !== text)
		throw new Error('The checked-in performance evidence is not canonical JSON.');
	return evidence;
}

function summary(
	state: 'CANONICAL_AND_SOURCE_CURRENT' | 'WRITTEN_EMPIRICAL_EVIDENCE',
	evidence: ContentAddressedStorePerformanceEvidence
): string {
	return `${canonicalSemanticJson({
		evidencePath: EVIDENCE_RELATIVE_PATH,
		implementationSourceDigest: evidence.implementationSourceDigest,
		observedWarmMedianLowerThanColdMedian:
			evidence.measurement.observedWarmMedianLowerThanColdMedian,
		samples: evidence.configuration.samples,
		state,
		verdict: evidence.assessment.verdict
	})}\n`;
}

function main(): void {
	const selectedMode = mode(process.argv.slice(2));
	const sourcesBefore = sourceSet();
	const digestBefore = contentAddressedStorePerformanceImplementationSourceDigest(sourcesBefore);
	if (selectedMode === '--check') {
		const evidence = checkedEvidence(digestBefore);
		process.stdout.write(summary('CANONICAL_AND_SOURCE_CURRENT', evidence));
		return;
	}
	const evidence = measureContentAddressedStorePerformance({
		environment: runtimeEnvironment(),
		implementationSources: sourcesBefore
	});
	const sourcesAfter = sourceSet();
	if (canonicalSemanticJson(sourcesBefore) !== canonicalSemanticJson(sourcesAfter))
		throw new Error('Implementation sources changed during performance measurement.');
	atomicWrite(EVIDENCE_PATH, evidenceText(evidence));
	process.stdout.write(summary('WRITTEN_EMPIRICAL_EVIDENCE', evidence));
}

try {
	main();
} catch (cause) {
	const usage = cause instanceof UsageError;
	const message = cause instanceof Error ? cause.message : String(cause);
	process.stderr.write(`${message}\n`);
	process.exitCode = usage ? 2 : 1;
}
