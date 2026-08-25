import { spawnSync } from 'node:child_process';
import {
	closeSync,
	existsSync,
	fstatSync,
	fsyncSync,
	lstatSync,
	mkdirSync,
	openSync,
	readFileSync,
	readdirSync,
	realpathSync,
	renameSync,
	rmSync,
	unlinkSync,
	writeFileSync
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import {
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	type FrozenSubject,
	type GeneratedContextEvidenceRecord
} from '../contracts/subject.js';
import { canonicalJson, sha256 } from '../inventory/canonical.js';
import { verifyFrozenSubject } from '../subject/freshness.js';
import {
	createGeneratedContextEvidenceRecord,
	generatedContextInputManifest,
	parseGeneratedContextEvidenceRecord
} from '../subject/generated-context.js';
import { resolveSubject } from '../subject/resolve-subject.js';
import {
	observeSvelteKitSyncGenerator,
	RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH,
	RPH_DEMO_GENERATED_CONTEXT_PATH,
	RPH_DEMO_PROJECT_ROOT,
	SVELTE_KIT_SYNC_GENERATOR_ID,
	type SvelteKitSyncGeneratorObservation
} from '../subject/svelte-kit-generator.js';

export const GENERATED_CONTEXT_EVIDENCE_OPERATION_VERSION =
	'jan-csaa-generated-context-evidence-runner/1.0.0' as const;
const MAX_SYNC_OUTPUT_BYTES = 4 * 1024 * 1024;
const MAX_SYNC_DIAGNOSTIC_CHARACTERS = 8 * 1024;
const MAX_EVIDENCE_BYTES = 16 * 1024 * 1024;
const SYNC_TIMEOUT_MS = 120_000;
const EVIDENCE_LOCK_SUFFIX = '.lock' as const;

function sanitizeSyncDiagnostic(value: string): string {
	let sanitized = '';
	for (const character of value) {
		const code = character.codePointAt(0)!;
		sanitized +=
			code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127
				? '\uFFFD'
				: character;
		if (sanitized.length >= MAX_SYNC_DIAGNOSTIC_CHARACTERS) break;
	}
	return sanitized.slice(0, MAX_SYNC_DIAGNOSTIC_CHARACTERS);
}

export type GeneratedContextEvidenceMode = 'check' | 'write';

export interface GeneratedContextEvidenceDifference {
	readonly actualBytes: number | null;
	readonly actualSha256: string | null;
	readonly expectedBytes: number;
	readonly expectedSha256: string;
	readonly path: typeof RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH;
}

export interface RunGeneratedContextEvidenceOptions {
	readonly mode: GeneratedContextEvidenceMode;
	readonly repositoryRoot: string;
}

/** Internal test-only seams; intentionally omitted from the package root API. */
export interface RunGeneratedContextEvidenceTestOptions extends RunGeneratedContextEvidenceOptions {
	/** Test-only injection after an atomic commit, used to prove rollback. */
	readonly afterCommit?: () => void;
	/** Test-only injection immediately before compare-and-swap publication. */
	readonly beforeCommit?: () => void;
	/** Test-only injection during reversible scratch restoration. */
	readonly beforeTransactionPrepareRestore?: () => void;
	/** Test-only injection before post-commit backup cleanup. */
	readonly beforeTransactionCleanup?: () => void;
	/** Test-only generator observation seam. */
	readonly observeGenerator?: (repositoryRoot: string) => SvelteKitSyncGeneratorObservation;
	/** Test-only synchronization seam. */
	readonly synchronize?: (
		observation: SvelteKitSyncGeneratorObservation,
		subject: FrozenSubject
	) => void;
	/** Test-only opt-in to the production empty-generated-root transaction. */
	readonly isolateGeneratedOutput?: boolean;
}

export interface RunGeneratedContextEvidenceResult {
	readonly cleanup: {
		readonly retainedPaths: readonly string[];
		readonly state: 'COMPLETE' | 'NOT_APPLICABLE' | 'PENDING';
	};
	readonly difference: GeneratedContextEvidenceDifference | null;
	readonly mode: GeneratedContextEvidenceMode;
	readonly ok: boolean;
	readonly record: GeneratedContextEvidenceRecord;
	readonly subjectId: string;
}

function assertRegularExistingFile(path: string, label: string): void {
	if (!existsSync(path)) return;
	const status = lstatSync(path);
	if (!status.isFile() || status.isSymbolicLink())
		throw new Error(`${label} is not a regular file.`);
}

function inside(root: string, path: string): boolean {
	const rel = relative(root, path);
	return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
}

function directoryEntryExists(path: string): boolean {
	try {
		lstatSync(path);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}

function assertMutationPathConfined(repositoryRoot: string, target: string, label: string): void {
	const root = resolve(repositoryRoot);
	const resolvedTarget = resolve(target);
	if (!inside(root, resolvedTarget)) throw new Error(`${label} escapes the repository.`);
	const rootStatus = lstatSync(root);
	if (!rootStatus.isDirectory() || rootStatus.isSymbolicLink())
		throw new Error('Generated-context repository root is not a physical directory.');
	const physicalRoot = realpathSync(root);
	let current = root;
	for (const segment of relative(root, dirname(resolvedTarget)).split(sep).filter(Boolean)) {
		current = resolve(current, segment);
		if (!existsSync(current)) break;
		const status = lstatSync(current);
		if (!status.isDirectory() || status.isSymbolicLink())
			throw new Error(`${label} parent contains a link or non-directory entry.`);
		if (!inside(physicalRoot, realpathSync(current)))
			throw new Error(`${label} parent escapes the physical repository.`);
	}
}

function assertExistingTreeContainsNoLinks(
	repositoryRoot: string,
	treeRoot: string,
	label: string
): void {
	assertMutationPathConfined(repositoryRoot, resolve(treeRoot, '.csaa-write-probe'), label);
	if (!existsSync(treeRoot)) return;
	const rootStatus = lstatSync(treeRoot);
	if (!rootStatus.isDirectory() || rootStatus.isSymbolicLink())
		throw new Error(`${label} is not a physical directory.`);
	let entries = 0;
	const visit = (directory: string): void => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			entries += 1;
			if (entries > 100_000) throw new Error(`${label} exceeds its entry limit.`);
			const absolute = resolve(directory, entry.name);
			const status = lstatSync(absolute);
			if (entry.isSymbolicLink() || status.isSymbolicLink())
				throw new Error(`${label} contains a symbolic-link escape.`);
			if (entry.isDirectory() && status.isDirectory()) visit(absolute);
			else if (entry.isFile() && status.isFile()) {
				if (status.nlink !== 1) throw new Error(`${label} contains a hard-linked file escape.`);
			} else throw new Error(`${label} contains an unsupported or replaced entry.`);
		}
	};
	visit(treeRoot);
}

function boundReadGrantPaths(
	repositoryRoot: string,
	observation: SvelteKitSyncGeneratorObservation,
	subject: FrozenSubject
): readonly string[] {
	const inputManifest = generatedContextInputManifest(
		subject.artifacts,
		RPH_DEMO_GENERATED_CONTEXT_PATH,
		RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH
	);
	const inputs = new Set(inputManifest.map((record) => record.path));
	const packages = new Set(observation.executionManifest.packages.map((record) => record.locator));
	for (const grant of observation.executionManifest.repositoryReadGrants) {
		if (grant.kind === 'FILE') {
			if (!inputs.has(grant.path))
				throw new Error(`Generated-context file read grant is not a bound input: ${grant.path}`);
			const absolute = resolve(repositoryRoot, ...grant.path.split('/'));
			assertMutationPathConfined(repositoryRoot, absolute, 'Generated-context file read grant');
			const status = lstatSync(absolute);
			if (!status.isFile() || status.isSymbolicLink() || status.nlink !== 1)
				throw new Error(
					`Generated-context file read grant is not a private physical file: ${grant.path}`
				);
			if (!inside(realpathSync(repositoryRoot), realpathSync(absolute)))
				throw new Error(`Generated-context file read grant escapes the repository: ${grant.path}`);
		}
		if (grant.kind === 'ABSENT_PATH') {
			const absolute = resolve(repositoryRoot, ...grant.path.split('/'));
			assertMutationPathConfined(repositoryRoot, absolute, 'Generated-context absent-path grant');
			if (directoryEntryExists(absolute))
				throw new Error(`Generated-context required-absent path is now present: ${grant.path}`);
		}
		if (grant.kind === 'DIRECTORY') {
			const absolute = resolve(repositoryRoot, ...grant.path.split('/'));
			const status = lstatSync(absolute);
			if (!status.isDirectory() || status.isSymbolicLink())
				throw new Error(`Generated-context directory read grant is not physical: ${grant.path}`);
			if (!inside(realpathSync(repositoryRoot), realpathSync(absolute)))
				throw new Error(
					`Generated-context directory read grant escapes the repository: ${grant.path}`
				);
			let files = 0;
			const visit = (directory: string): void => {
				for (const entry of readdirSync(directory, { withFileTypes: true })) {
					const child = resolve(directory, entry.name);
					const childStatus = lstatSync(child);
					if (entry.isSymbolicLink() || childStatus.isSymbolicLink())
						throw new Error(
							`Generated-context directory read grant contains a link: ${grant.path}`
						);
					if (entry.isDirectory() && childStatus.isDirectory()) {
						if (entry.name === 'node_modules')
							throw new Error(
								`Generated-context directory read grant contains unbound nested node_modules: ${grant.path}`
							);
						visit(child);
						continue;
					}
					if (!entry.isFile() || !childStatus.isFile() || childStatus.nlink !== 1)
						throw new Error(
							`Generated-context directory read grant contains an unsupported entry: ${grant.path}`
						);
					files += 1;
					if (files > 100_000)
						throw new Error(`Generated-context directory read grant exceeds its file limit.`);
					const logical = relative(repositoryRoot, child).replaceAll('\\', '/');
					if (!packages.has(grant.path) && !inputs.has(logical))
						throw new Error(`Generated-context readable file is not a bound input: ${logical}`);
				}
			};
			visit(absolute);
		}
	}
	return observation.executionManifest.repositoryReadGrants.map((grant) =>
		resolve(repositoryRoot, ...grant.path.split('/'))
	);
}

interface GeneratedOutputTransaction {
	readonly complete: (beforeCleanup?: () => void) => RunGeneratedContextEvidenceResult['cleanup'];
	readonly prepareCommit: (beforeRestore?: () => void) => void;
	readonly resetForReplay: () => void;
	readonly restore: () => void;
}

let generatedOutputTransactionSequence = 0;

function beginGeneratedOutputTransaction(repositoryRoot: string): GeneratedOutputTransaction {
	const generatedRoot = resolve(repositoryRoot, RPH_DEMO_PROJECT_ROOT, '.svelte-kit');
	const scratchRoot = resolve(repositoryRoot, 'node_modules', '.vite-temp');
	const nonce = `${String(process.pid)}-${String((generatedOutputTransactionSequence += 1))}`;
	const originalBackup = resolve(
		repositoryRoot,
		'node_modules',
		`.csaa-generated-context-original-${nonce}`
	);
	const replayBackup = resolve(
		repositoryRoot,
		'node_modules',
		`.csaa-generated-context-replay-${nonce}`
	);
	const scratchBackup = resolve(
		repositoryRoot,
		'node_modules',
		`.csaa-generated-context-scratch-${nonce}`
	);
	for (const backup of [originalBackup, replayBackup, scratchBackup]) {
		assertMutationPathConfined(repositoryRoot, backup, 'Generated-output transaction backup');
		if (existsSync(backup)) throw new Error('Generated-output transaction backup already exists.');
	}
	assertExistingTreeContainsNoLinks(
		repositoryRoot,
		generatedRoot,
		'SvelteKit generated-output root'
	);
	assertExistingTreeContainsNoLinks(repositoryRoot, scratchRoot, 'Vite execution scratch root');
	const originalExisted = existsSync(generatedRoot);
	const scratchExisted = existsSync(scratchRoot);
	let originalMoved = false;
	let scratchMoved = false;
	let generatedCreated = false;
	let scratchCreated = false;
	try {
		if (originalExisted) {
			renameSync(generatedRoot, originalBackup);
			originalMoved = true;
		}
		if (scratchExisted) {
			renameSync(scratchRoot, scratchBackup);
			scratchMoved = true;
		}
		mkdirSync(generatedRoot, { recursive: false });
		generatedCreated = true;
		mkdirSync(scratchRoot, { recursive: false });
		scratchCreated = true;
	} catch (error) {
		if (scratchCreated) rmSync(scratchRoot, { force: true, recursive: true });
		if (generatedCreated) rmSync(generatedRoot, { force: true, recursive: true });
		if (scratchMoved) renameSync(scratchBackup, scratchRoot);
		if (originalMoved && !existsSync(generatedRoot)) renameSync(originalBackup, generatedRoot);
		throw error;
	}
	let active = true;
	let scratchRestored = false;
	const clearPhysicalRoot = (path: string, label: string): void => {
		assertExistingTreeContainsNoLinks(repositoryRoot, path, label);
		if (existsSync(path)) rmSync(path, { force: true, recursive: true });
	};
	return {
		complete: (beforeCleanup) => {
			if (!active) return { retainedPaths: [], state: 'COMPLETE' };
			if (!scratchRestored)
				throw new Error('Generated-output transaction was not prepared for commit.');
			try {
				beforeCleanup?.();
				for (const backup of [replayBackup, originalBackup]) {
					if (!existsSync(backup)) continue;
					assertExistingTreeContainsNoLinks(
						repositoryRoot,
						backup,
						'Generated-output transaction backup'
					);
					rmSync(backup, { force: true, recursive: true });
				}
			} catch {
				active = false;
				return {
					retainedPaths: [replayBackup, originalBackup]
						.filter((path) => directoryEntryExists(path))
						.map((path) => relative(repositoryRoot, path).replaceAll('\\', '/')),
					state: 'PENDING'
				};
			}
			active = false;
			return { retainedPaths: [], state: 'COMPLETE' };
		},
		prepareCommit: (beforeRestore) => {
			if (!active) throw new Error('Generated-output transaction is no longer active.');
			if (scratchRestored) return;
			clearPhysicalRoot(scratchRoot, 'Vite execution scratch root');
			beforeRestore?.();
			if (scratchExisted) {
				assertExistingTreeContainsNoLinks(
					repositoryRoot,
					scratchBackup,
					'Vite execution scratch backup'
				);
				renameSync(scratchBackup, scratchRoot);
			}
			scratchRestored = true;
		},
		resetForReplay: () => {
			if (!active) throw new Error('Generated-output transaction is no longer active.');
			assertExistingTreeContainsNoLinks(
				repositoryRoot,
				generatedRoot,
				'SvelteKit first-replay output root'
			);
			renameSync(generatedRoot, replayBackup);
			mkdirSync(generatedRoot, { recursive: false });
			clearPhysicalRoot(scratchRoot, 'Vite execution scratch root');
			mkdirSync(scratchRoot, { recursive: false });
		},
		restore: () => {
			if (!active) return;
			clearPhysicalRoot(generatedRoot, 'SvelteKit generated-output root');
			if (existsSync(replayBackup)) {
				assertExistingTreeContainsNoLinks(
					repositoryRoot,
					replayBackup,
					'Generated-output replay backup'
				);
				rmSync(replayBackup, { force: true, recursive: true });
			}
			if (originalExisted) {
				assertExistingTreeContainsNoLinks(
					repositoryRoot,
					originalBackup,
					'Generated-output original backup'
				);
				renameSync(originalBackup, generatedRoot);
			}
			if (!scratchRestored) {
				clearPhysicalRoot(scratchRoot, 'Vite execution scratch root');
				if (scratchExisted) {
					assertExistingTreeContainsNoLinks(
						repositoryRoot,
						scratchBackup,
						'Vite execution scratch backup'
					);
					renameSync(scratchBackup, scratchRoot);
				}
			}
			active = false;
		}
	};
}

function readExistingEvidence(path: string): Buffer | null {
	if (!existsSync(path)) return null;
	assertRegularExistingFile(path, 'Generated-context evidence target');
	const descriptor = openSync(path, 'r');
	try {
		const before = fstatSync(descriptor, { bigint: true });
		if (!before.isFile() || before.size > BigInt(MAX_EVIDENCE_BYTES))
			throw new Error('Generated-context evidence target exceeds its byte limit.');
		const bytes = readFileSync(descriptor);
		const after = fstatSync(descriptor, { bigint: true });
		const pathAfter = (() => {
			try {
				return lstatSync(path, { bigint: true });
			} catch {
				throw new Error('Generated-context evidence target changed during its bounded read.');
			}
		})();
		if (
			bytes.byteLength > MAX_EVIDENCE_BYTES ||
			before.dev !== after.dev ||
			before.ino !== after.ino ||
			before.size !== after.size ||
			before.mtimeNs !== after.mtimeNs ||
			!pathAfter.isFile() ||
			pathAfter.isSymbolicLink() ||
			after.dev !== pathAfter.dev ||
			after.ino !== pathAfter.ino ||
			after.size !== pathAfter.size ||
			after.mtimeNs !== pathAfter.mtimeNs
		)
			throw new Error('Generated-context evidence target changed during its bounded read.');
		return bytes;
	} finally {
		closeSync(descriptor);
	}
}

function synchronizeSvelteKit(
	repositoryRoot: string,
	observation: SvelteKitSyncGeneratorObservation,
	subject: FrozenSubject
): void {
	const generatedRoot = resolve(repositoryRoot, RPH_DEMO_PROJECT_ROOT, '.svelte-kit');
	const scratchRoot = resolve(repositoryRoot, 'node_modules', '.vite-temp');
	if (
		observation.executionManifest.generatedOutputRoot.path !==
		`${RPH_DEMO_PROJECT_ROOT}/.svelte-kit`
	)
		throw new Error(
			'Generated-context execution manifest names an unexpected generated-output root.'
		);
	if (observation.executionManifest.scratchRoots[0].path !== 'node_modules/.vite-temp')
		throw new Error('Generated-context execution manifest names an unexpected scratch root.');
	assertExistingTreeContainsNoLinks(
		repositoryRoot,
		generatedRoot,
		'SvelteKit generated-output root'
	);
	const readGrants = boundReadGrantPaths(repositoryRoot, observation, subject);
	const result = spawnSync(
		observation.nodeExecutable,
		[
			'--permission',
			'--allow-addons',
			'--allow-child-process',
			...readGrants.map((path) => `--allow-fs-read=${path}`),
			`--allow-fs-read=${generatedRoot}`,
			`--allow-fs-read=${scratchRoot}`,
			`--allow-fs-write=${generatedRoot}`,
			`--allow-fs-write=${scratchRoot}`,
			observation.entryPath,
			'sync',
			'--mode',
			'production'
		],
		{
			cwd: resolve(repositoryRoot, RPH_DEMO_PROJECT_ROOT),
			env: Object.fromEntries(
				observation.executionManifest.environment.map(({ name, value }) => [name, value])
			),
			encoding: 'utf8',
			maxBuffer: MAX_SYNC_OUTPUT_BYTES,
			shell: false,
			timeout: SYNC_TIMEOUT_MS,
			windowsHide: true
		}
	);
	if (result.error !== undefined)
		throw new Error(`SvelteKit synchronization could not run: ${result.error.message}`);
	if (result.status !== 0) {
		const diagnostic = sanitizeSyncDiagnostic(
			`${result.stderr ?? ''}\n${result.stdout ?? ''}`.trim()
		);
		throw new Error(
			`SvelteKit synchronization failed with exit code ${String(result.status)}.${diagnostic === '' ? '' : ` Output: ${diagnostic}`}`
		);
	}
	assertExistingTreeContainsNoLinks(
		repositoryRoot,
		generatedRoot,
		'SvelteKit generated-output root'
	);
}

function sameGenerator(
	left: SvelteKitSyncGeneratorObservation,
	right: SvelteKitSyncGeneratorObservation
): boolean {
	return (
		canonicalJson({ executionManifest: left.executionManifest, generator: left.generator }) ===
		canonicalJson({ executionManifest: right.executionManifest, generator: right.generator })
	);
}

function resolveEvidenceSubject(repositoryRoot: string): FrozenSubject {
	const outcome = resolveSubject({
		budgets: {
			maxBytes: 256 * 1024 * 1024,
			maxConfigDepth: 64,
			maxDiagnostics: 10_000,
			maxDurationMs: 120_000,
			maxFiles: 100_000,
			maxProjects: 1_000
		},
		filters: { exclude: [], include: [] },
		operationVersion: GENERATED_CONTEXT_EVIDENCE_OPERATION_VERSION,
		outputs: [
			RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH,
			`${RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH}${EVIDENCE_LOCK_SUFFIX}`
		],
		policyVersion: SUBJECT_POLICY_VERSION,
		rootLocator: repositoryRoot,
		schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
		scope: { kind: 'REPOSITORY' },
		subjectKind: 'WORKTREE'
	});
	if (outcome.outcome !== 'resolved')
		throw new Error(
			`Generated-context subject resolution ${outcome.outcome}: ${outcome.diagnostics
				.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
				.join('; ')}`
		);
	return outcome.subject;
}

function stageAtomic(path: string, content: Uint8Array): string {
	if (content.byteLength > MAX_EVIDENCE_BYTES)
		throw new Error('Generated-context evidence exceeds its byte limit.');
	mkdirSync(dirname(path), { recursive: true });
	const temporary = `${path}.csaa-${process.pid}-${Date.now()}.tmp`;
	let descriptor: number | null = null;
	try {
		descriptor = openSync(temporary, 'wx');
		writeFileSync(descriptor, content);
		fsyncSync(descriptor);
		closeSync(descriptor);
		descriptor = null;
		if (!readFileSync(temporary).equals(Buffer.from(content)))
			throw new Error('Staged generated-context evidence failed exact-byte validation.');
		return temporary;
	} catch (error) {
		if (descriptor !== null) closeSync(descriptor);
		if (existsSync(temporary)) unlinkSync(temporary);
		throw error;
	}
}

function restoreAfterFailure(
	path: string,
	previous: Buffer | null,
	published: Buffer,
	error: unknown
): never {
	try {
		if (!readExistingEvidence(path)?.equals(published))
			throw new Error(
				`Generated-context evidence changed concurrently after publication; newer bytes were preserved. Original failure: ${String(error)}`
			);
		if (previous === null) {
			if (existsSync(path)) unlinkSync(path);
		} else {
			const rollback = stageAtomic(path, previous);
			renameSync(rollback, path);
		}
	} catch (rollbackError) {
		throw new Error(
			`Generated-context evidence publication and rollback failed: ${String(error)}; ${String(
				rollbackError
			)}`
		);
	}
	throw error;
}

function publishAtomic(
	path: string,
	content: string,
	previous: Buffer | null,
	options: { readonly afterCommit?: () => void; readonly beforeCommit?: () => void }
): void {
	assertRegularExistingFile(path, 'Generated-context evidence target');
	const published = Buffer.from(content, 'utf8');
	let temporary: string | null = stageAtomic(path, published);
	try {
		options.beforeCommit?.();
		const beforeCommit = readExistingEvidence(path);
		if (
			(previous === null && beforeCommit !== null) ||
			(previous !== null && !beforeCommit?.equals(previous))
		)
			throw new Error('Generated-context evidence target changed before publication.');
		renameSync(temporary, path);
		temporary = null;
		options.afterCommit?.();
		if (!readExistingEvidence(path)?.equals(published))
			throw new Error('Committed generated-context evidence failed exact-byte validation.');
	} catch (error) {
		if (temporary !== null && existsSync(temporary)) unlinkSync(temporary);
		if (temporary !== null) throw error;
		restoreAfterFailure(path, previous, published, error);
	}
}

interface EvidenceLock {
	readonly content: string;
	readonly path: string;
}

function acquireEvidenceLock(target: string): EvidenceLock {
	const path = `${target}${EVIDENCE_LOCK_SUFFIX}`;
	mkdirSync(dirname(path), { recursive: true });
	const content = canonicalJson({
		operation: GENERATED_CONTEXT_EVIDENCE_OPERATION_VERSION,
		pid: process.pid
	});
	let descriptor: number | null = null;
	try {
		descriptor = openSync(path, 'wx');
		writeFileSync(descriptor, content, 'utf8');
		fsyncSync(descriptor);
		closeSync(descriptor);
		descriptor = null;
		return { content, path };
	} catch (error) {
		if (descriptor !== null) closeSync(descriptor);
		throw new Error(`Generated-context evidence publication lock is unavailable: ${String(error)}`);
	}
}

function releaseEvidenceLock(lock: EvidenceLock): void {
	if (!readExistingEvidence(lock.path)?.equals(Buffer.from(lock.content, 'utf8')))
		throw new Error('Generated-context evidence publication lock changed concurrently.');
	unlinkSync(lock.path);
}

function assertEvidenceInputsCurrent(
	repositoryRoot: string,
	subject: FrozenSubject,
	expectedGenerator: SvelteKitSyncGeneratorObservation,
	observeGenerator: (repositoryRoot: string) => SvelteKitSyncGeneratorObservation,
	phase: 'before publication' | 'after publication' | 'before check completion'
): void {
	const freshness = verifyFrozenSubject(subject, { rootLocator: repositoryRoot });
	if (freshness.state !== 'CURRENT') throw new Error(`Generated-context subject changed ${phase}.`);
	const actualGenerator = observeGenerator(repositoryRoot);
	if (!sameGenerator(expectedGenerator, actualGenerator))
		throw new Error(`SvelteKit generator identity changed ${phase}.`);
}

function inputManifestForSubject(subject: FrozenSubject) {
	return generatedContextInputManifest(
		subject.artifacts,
		RPH_DEMO_GENERATED_CONTEXT_PATH,
		RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH
	);
}

function assertInitialInputManifest(
	expected: ReturnType<typeof inputManifestForSubject>,
	actualSubject: FrozenSubject,
	phase: string
): void {
	if (canonicalJson(inputManifestForSubject(actualSubject)) !== canonicalJson(expected))
		throw new Error(`Generated-context authored inputs changed ${phase}.`);
}

function difference(expected: string, actual: Buffer): GeneratedContextEvidenceDifference {
	return {
		actualBytes: actual.byteLength,
		actualSha256: sha256(actual),
		expectedBytes: Buffer.byteLength(expected),
		expectedSha256: sha256(expected),
		path: RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH
	};
}

function runGeneratedContextEvidenceUnlocked(
	options: RunGeneratedContextEvidenceTestOptions,
	initialEvidence: Buffer | null | undefined = undefined
): RunGeneratedContextEvidenceResult {
	const repositoryRoot = resolve(options.repositoryRoot);
	const target = resolve(repositoryRoot, RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH);
	assertMutationPathConfined(repositoryRoot, target, 'Generated-context evidence target');
	assertRegularExistingFile(target, 'Generated-context evidence target');
	if (options.mode === 'check') {
		const actual = readExistingEvidence(target);
		if (actual === null) throw new Error('Required generated-context evidence is absent.');
		const recorded = parseGeneratedContextEvidenceRecord(actual);
		if (recorded.generator.id !== SVELTE_KIT_SYNC_GENERATOR_ID)
			throw new Error('Generated-context evidence names an unsupported generator.');
		const subject = resolveEvidenceSubject(repositoryRoot);
		const record = createGeneratedContextEvidenceRecord({
			evidenceSource: RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH,
			executionManifest: recorded.executionManifest,
			generatedContextPath: RPH_DEMO_GENERATED_CONTEXT_PATH,
			generator: recorded.generator,
			subject
		});
		const freshness = verifyFrozenSubject(subject, { rootLocator: repositoryRoot });
		if (freshness.state !== 'CURRENT')
			throw new Error('Generated-context subject changed before check completion.');
		if (!readExistingEvidence(target)?.equals(actual))
			throw new Error('Generated-context evidence changed before check completion.');
		const expected = canonicalJson(record);
		const expectedBytes = Buffer.from(expected, 'utf8');
		return {
			cleanup: { retainedPaths: [], state: 'NOT_APPLICABLE' },
			difference: actual.equals(expectedBytes) ? null : difference(expected, actual),
			mode: options.mode,
			ok: actual.equals(expectedBytes),
			record,
			subjectId: subject.descriptor.subjectId
		};
	}
	const observeGenerator = options.observeGenerator ?? observeSvelteKitSyncGenerator;
	const beforeSync = observeGenerator(repositoryRoot);
	let generator = beforeSync;
	let replayRecord: GeneratedContextEvidenceRecord | null = null;
	const synchronize =
		options.synchronize ??
		((observation, subject) => synchronizeSvelteKit(repositoryRoot, observation, subject));
	const executionSubject = resolveEvidenceSubject(repositoryRoot);
	const executionInputManifest = inputManifestForSubject(executionSubject);
	const evidencePreimage =
		initialEvidence === undefined ? readExistingEvidence(target) : initialEvidence;
	assertEvidenceInputsCurrent(
		repositoryRoot,
		executionSubject,
		beforeSync,
		observeGenerator,
		'before publication'
	);
	const outputTransaction =
		options.synchronize === undefined || options.isolateGeneratedOutput === true
			? beginGeneratedOutputTransaction(repositoryRoot)
			: null;
	let evidencePublished = false;
	try {
		synchronize(beforeSync, executionSubject);
		generator = observeGenerator(repositoryRoot);
		if (!sameGenerator(beforeSync, generator))
			throw new Error('SvelteKit generator identity changed during synchronization.');
		const firstSubject = resolveEvidenceSubject(repositoryRoot);
		assertInitialInputManifest(executionInputManifest, firstSubject, 'during synchronization');
		replayRecord = createGeneratedContextEvidenceRecord({
			evidenceSource: RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH,
			executionManifest: generator.executionManifest,
			generatedContextPath: RPH_DEMO_GENERATED_CONTEXT_PATH,
			generator: generator.generator,
			subject: firstSubject
		});
		assertEvidenceInputsCurrent(
			repositoryRoot,
			firstSubject,
			generator,
			observeGenerator,
			'before publication'
		);
		outputTransaction?.resetForReplay();
		synchronize(generator, firstSubject);
		const replayGenerator = observeGenerator(repositoryRoot);
		if (!sameGenerator(generator, replayGenerator))
			throw new Error('SvelteKit generator identity changed during deterministic replay.');
		generator = replayGenerator;
		const subject = resolveEvidenceSubject(repositoryRoot);
		assertInitialInputManifest(executionInputManifest, subject, 'during deterministic replay');
		const record = createGeneratedContextEvidenceRecord({
			evidenceSource: RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH,
			executionManifest: generator.executionManifest,
			generatedContextPath: RPH_DEMO_GENERATED_CONTEXT_PATH,
			generator: generator.generator,
			subject
		});
		if (
			replayRecord !== null &&
			canonicalJson({
				generatedOutputManifest: replayRecord.generatedOutputManifest,
				inputManifest: replayRecord.inputManifest
			}) !==
				canonicalJson({
					generatedOutputManifest: record.generatedOutputManifest,
					inputManifest: record.inputManifest
				})
		)
			throw new Error('SvelteKit synchronization did not reproduce identical bound manifests.');
		assertEvidenceInputsCurrent(
			repositoryRoot,
			subject,
			generator,
			observeGenerator,
			'before publication'
		);
		assertInitialInputManifest(executionInputManifest, subject, 'before publication');
		outputTransaction?.prepareCommit(options.beforeTransactionPrepareRestore);
		const expected = canonicalJson(record);
		publishAtomic(target, expected, evidencePreimage, {
			afterCommit: () => {
				options.afterCommit?.();
				const currentSubject = resolveEvidenceSubject(repositoryRoot);
				assertInitialInputManifest(executionInputManifest, currentSubject, 'after publication');
				assertEvidenceInputsCurrent(
					repositoryRoot,
					subject,
					generator,
					observeGenerator,
					'after publication'
				);
			},
			beforeCommit: options.beforeCommit
		});
		evidencePublished = true;
		const cleanup = outputTransaction?.complete(options.beforeTransactionCleanup) ?? {
			retainedPaths: [],
			state: 'NOT_APPLICABLE' as const
		};
		return {
			cleanup,
			difference: null,
			mode: options.mode,
			ok: true,
			record,
			subjectId: subject.descriptor.subjectId
		};
	} catch (error) {
		if (outputTransaction === null || evidencePublished) throw error;
		try {
			outputTransaction.restore();
		} catch (rollbackError) {
			throw new AggregateError(
				[error, rollbackError],
				'Generated-context operation and generated-output rollback both failed.'
			);
		}
		throw error;
	}
}

function runGeneratedContextEvidenceWithTestOptions(
	options: RunGeneratedContextEvidenceTestOptions
): RunGeneratedContextEvidenceResult {
	if (options.mode === 'check') return runGeneratedContextEvidenceUnlocked(options);
	const repositoryRoot = resolve(options.repositoryRoot);
	const target = resolve(repositoryRoot, RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH);
	assertMutationPathConfined(repositoryRoot, target, 'Generated-context evidence target');
	const lock = acquireEvidenceLock(target);
	let operation:
		| { readonly kind: 'FAILURE'; readonly error: unknown }
		| { readonly kind: 'SUCCESS'; readonly result: RunGeneratedContextEvidenceResult };
	try {
		const initialEvidence = readExistingEvidence(target);
		operation = {
			kind: 'SUCCESS',
			result: runGeneratedContextEvidenceUnlocked(options, initialEvidence)
		};
	} catch (error) {
		operation = { error, kind: 'FAILURE' };
	}
	let release: { readonly kind: 'FAILURE'; readonly error: unknown } | { readonly kind: 'SUCCESS' };
	try {
		releaseEvidenceLock(lock);
		release = { kind: 'SUCCESS' };
	} catch (error) {
		release = { error, kind: 'FAILURE' };
	}
	if (operation.kind === 'FAILURE' && release.kind === 'FAILURE')
		throw new AggregateError(
			[operation.error, release.error],
			'Generated-context operation and publication-lock release both failed.'
		);
	if (operation.kind === 'FAILURE') throw operation.error;
	if (release.kind === 'FAILURE') throw release.error;
	return operation.result;
}

export function runGeneratedContextEvidence(
	options: RunGeneratedContextEvidenceOptions
): RunGeneratedContextEvidenceResult {
	return runGeneratedContextEvidenceWithTestOptions(options);
}

/** @internal Test-only export; do not re-export from the package root. */
export function runGeneratedContextEvidenceForTest(
	options: RunGeneratedContextEvidenceTestOptions
): RunGeneratedContextEvidenceResult {
	return runGeneratedContextEvidenceWithTestOptions(options);
}
