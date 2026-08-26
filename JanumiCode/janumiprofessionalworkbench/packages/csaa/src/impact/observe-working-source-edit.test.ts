import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import type { CapturedArtifactRecord } from '../contracts/subject.js';
import {
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_SAFETY_CEILINGS,
	type WorkingSourceEditObservationBudgets
} from '../contracts/working-source-edit-impact-candidate-report.js';
import { sha256 } from '../inventory/canonical.js';
import {
	bindWorkingSourceEditObservation,
	isWorkingSourceEditObservationError,
	observeWorkingSourceEdit,
	sameWorkingSourceEditCapture,
	verifyWorkingSourceEditObservation,
	workingSourceEditTextRanges,
	type WorkingSourceEditObservationError
} from './observe-working-source-edit.js';

const temporaryRoots: string[] = [];

afterEach(() => {
	for (const root of temporaryRoots.splice(0))
		rmSync(root, { force: true, maxRetries: 10, recursive: true, retryDelay: 100 });
});

function testGitEnvironment(): NodeJS.ProcessEnv {
	const environment: NodeJS.ProcessEnv = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (key.toUpperCase().startsWith('GIT_')) continue;
		if (value !== undefined) environment[key] = value;
	}
	return {
		...environment,
		GIT_CONFIG_NOSYSTEM: '1',
		GIT_LITERAL_PATHSPECS: '1',
		GIT_OPTIONAL_LOCKS: '0',
		GIT_TERMINAL_PROMPT: '0',
		LANG: 'C',
		LC_ALL: 'C'
	};
}

function git(root: string, args: readonly string[], input?: Uint8Array): Uint8Array {
	const result = spawnSync('git', args, {
		cwd: root,
		encoding: 'buffer',
		env: testGitEnvironment(),
		input: input === undefined ? Buffer.alloc(0) : Buffer.from(input),
		maxBuffer: 4 * 1024 * 1024,
		shell: false,
		windowsHide: true
	});
	if (result.error !== undefined || result.status !== 0)
		throw new Error(`Temporary Git fixture command failed: ${args[0] ?? 'unknown'}`);
	return Uint8Array.from(result.stdout ?? Buffer.alloc(0));
}

function gitText(root: string, args: readonly string[], input?: Uint8Array): string {
	return new TextDecoder().decode(git(root, args, input)).trim();
}

interface TestRepository {
	readonly headOid: string;
	readonly root: string;
}

function repository(
	files: Readonly<Record<string, string | Uint8Array>>,
	objectFormat?: 'sha1' | 'sha256'
): TestRepository {
	const root = mkdtempSync(join(tmpdir(), 'csaa-working-edit-'));
	temporaryRoots.push(root);
	git(root, [
		'init',
		'--quiet',
		...(objectFormat === undefined ? [] : [`--object-format=${objectFormat}`])
	]);
	git(root, ['config', 'user.email', 'csaa-test@example.invalid']);
	git(root, ['config', 'user.name', 'CSAA Test']);
	git(root, ['config', 'core.autocrlf', 'false']);
	for (const [path, content] of Object.entries(files)) {
		const absolutePath = join(root, ...path.split('/'));
		mkdirSync(dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, content);
	}
	git(root, ['add', '-A']);
	git(root, ['commit', '--quiet', '-m', 'fixture base']);
	return { headOid: gitText(root, ['rev-parse', 'HEAD']), root };
}

function supportsSha256Repositories(): boolean {
	const root = mkdtempSync(join(tmpdir(), 'csaa-working-edit-sha256-probe-'));
	try {
		const result = spawnSync('git', ['init', '--quiet', '--object-format=sha256'], {
			cwd: root,
			encoding: 'buffer',
			env: testGitEnvironment(),
			input: Buffer.alloc(0),
			shell: false,
			windowsHide: true
		});
		return result.error === undefined && result.status === 0;
	} finally {
		rmSync(root, { force: true, maxRetries: 10, recursive: true, retryDelay: 100 });
	}
}

const SHA256_REPOSITORIES_SUPPORTED = supportsSha256Repositories();

function budgets(
	overrides: Partial<WorkingSourceEditObservationBudgets> = {}
): WorkingSourceEditObservationBudgets {
	return {
		...WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_SAFETY_CEILINGS.observation,
		...overrides
	};
}

function observationError(action: () => unknown): WorkingSourceEditObservationError {
	try {
		action();
	} catch (error) {
		if (isWorkingSourceEditObservationError(error)) return error;
		throw error;
	}
	throw new Error('Expected working-source-edit observation to fail.');
}

function observe(
	repository: TestRepository,
	logicalPath: string,
	rootLocator = repository.root,
	observationBudgets = budgets()
) {
	return observeWorkingSourceEdit({
		budgets: observationBudgets,
		expectedHeadOid: repository.headOid,
		logicalPath,
		rootLocator
	});
}

describe('working source edit observation', () => {
	it('rejects invalid observation budgets, roots, paths, base identities, clocks, and provider lookup', () => {
		const validRoot = mkdtempSync(join(tmpdir(), 'csaa-working-edit-admission-'));
		temporaryRoots.push(validRoot);
		const valid = {
			budgets: budgets(),
			expectedHeadOid: 'a'.repeat(40),
			logicalPath: 'source.ts',
			rootLocator: validRoot
		};
		for (const invalidBudget of [
			budgets({ maxGitMetadataBytes: 0 }),
			budgets({ maxGitOperationDurationMs: -0 }),
			budgets({
				maxSourceBytes:
					WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_SAFETY_CEILINGS.observation.maxSourceBytes + 1
			})
		])
			expect(
				observationError(() => observeWorkingSourceEdit({ ...valid, budgets: invalidBudget })).code
			).toBe('OBSERVATION_BUDGET_INVALID');

		const ordinaryFile = join(validRoot, 'ordinary-file');
		writeFileSync(ordinaryFile, 'file');
		for (const rootLocator of ['relative', join(validRoot, 'missing'), ordinaryFile])
			expect(observationError(() => observeWorkingSourceEdit({ ...valid, rootLocator })).code).toBe(
				'REPOSITORY_ROOT_INVALID'
			);

		const pathCases: readonly [string, string, string][] = [
			['bad\0path', 'SOURCE_PATH_INVALID', 'incompatible'],
			['bad\ud800', 'SOURCE_PATH_INVALID', 'incompatible'],
			['../escape.ts', 'SOURCE_PATH_INVALID', 'incompatible'],
			['x'.repeat(valid.budgets.maxPathCharacters + 1), 'SOURCE_PATH_INVALID', 'resource-refused']
		];
		for (const [logicalPath, code, state] of pathCases)
			expect(
				observationError(() => observeWorkingSourceEdit({ ...valid, logicalPath }))
			).toMatchObject({ code, state });
		expect(
			observationError(() =>
				observeWorkingSourceEdit({ ...valid, expectedHeadOid: 'A'.repeat(40) })
			).code
		).toBe('BASE_COMMIT_OID_INVALID');
		const nonRepositoryError = observationError(() => observeWorkingSourceEdit(valid));
		expect(nonRepositoryError).toMatchObject({
			code: 'GIT_OPERATION_FAILED',
			stage: 'GIT_PROVIDER'
		});

		const bareRoot = mkdtempSync(join(tmpdir(), 'csaa-working-edit-bare-'));
		temporaryRoots.push(bareRoot);
		git(bareRoot, ['init', '--bare', '--quiet']);
		expect(
			observationError(() => observeWorkingSourceEdit({ ...valid, rootLocator: bareRoot }))
		).toMatchObject({ code: 'GIT_WORKTREE_REQUIRED', stage: 'GIT_PROVIDER' });

		const subject = repository({ 'source.ts': 'export const value = 1;\n' });
		writeFileSync(join(subject.root, 'source.ts'), 'export const value = 2;\n');
		const observable = {
			budgets: budgets(),
			expectedHeadOid: subject.headOid,
			logicalPath: 'source.ts',
			rootLocator: subject.root
		};
		expect(
			observationError(() =>
				observeWorkingSourceEdit(observable, {
					clockSources: {
						monotonicNow: () => {
							throw new Error('clock failed');
						},
						wallNow: () => 1
					}
				})
			).code
		).toBe('GIT_OBSERVATION_CLOCK_FAILED');
		let monotonicCalls = 0;
		expect(
			observationError(() =>
				observeWorkingSourceEdit(observable, {
					clockSources: {
						monotonicNow: () => {
							monotonicCalls += 1;
							if (monotonicCalls === 1) return 0;
							throw new Error('clock failed after admission');
						},
						wallNow: () => 1
					}
				})
			).code
		).toBe('GIT_OBSERVATION_CLOCK_FAILED');
		expect(
			observationError(() =>
				observeWorkingSourceEdit(observable, {
					clockSources: {
						monotonicNow: () => 0,
						wallNow: () => Number.MAX_SAFE_INTEGER
					}
				})
			).code
		).toBe('GIT_OBSERVATION_CLOCK_FAILED');

		const pathEntries = Object.keys(process.env).filter((key) => key.toUpperCase() === 'PATH');
		const inherited = pathEntries.map((key) => [key, process.env[key]] as const);
		try {
			for (const key of pathEntries) delete process.env[key];
			expect(observationError(() => observeWorkingSourceEdit(observable)).code).toBe(
				'GIT_PROVIDER_UNAVAILABLE'
			);
		} finally {
			for (const [key, value] of inherited) if (value !== undefined) process.env[key] = value;
		}
		expect(isWorkingSourceEditObservationError(new Error('ordinary'))).toBe(false);
	});

	it('captures one nested raw edit with literal path identity while ignoring other-path state', () => {
		const before = 'export const face = "\ud83c\ude00";\n';
		const after = 'export const face = "\ud83d\ude00";\n';
		const subject = repository({
			'workspace/[literal] source file.ts': before,
			'workspace/other.ts': 'export const other = 1;\n'
		});
		const nestedRoot = join(subject.root, 'workspace');
		writeFileSync(join(nestedRoot, '[literal] source file.ts'), after);
		writeFileSync(join(nestedRoot, 'other.ts'), 'export const other = 2;\n');
		git(subject.root, ['add', '--', 'workspace/other.ts']);
		writeFileSync(join(nestedRoot, 'untracked.ts'), 'export const ignored = true;\n');

		const first = observe(subject, '[literal] source file.ts', nestedRoot);
		const second = observe(subject, '[literal] source file.ts', nestedRoot);
		const changedAt = before.indexOf('\ud83c\ude00');

		expect(first.observation.source.logicalPath).toBe('[literal] source file.ts');
		expect(first.observation.source.repositoryPath).toBe('workspace/[literal] source file.ts');
		expect(first.observation.git.headOid).toBe(subject.headOid);
		expect(first.observation.git.indexBlobOid).toBe(first.observation.git.treeBlobOid);
		expect(first.observation.source.before.sha256).toBe(sha256(before));
		expect(first.observation.source.after.sha256).toBe(sha256(after));
		expect(first.observation.change.beforeRange).toEqual({
			endUtf16: changedAt + 2,
			startUtf16: changedAt
		});
		expect(first.observation.change.afterRange).toEqual({
			endUtf16: changedAt + 2,
			startUtf16: changedAt
		});
		expect(first.observation.evidenceSha256).toBe(second.observation.evidenceSha256);
		expect(first.currentBytes).toEqual(second.currentBytes);

		const artifact: CapturedArtifactRecord = {
			bytes: first.currentBytes.byteLength,
			canonicalPathKey: '[literal] source file.ts',
			disposition: 'ANALYZED',
			path: '[literal] source file.ts',
			primaryClass: 'PRODUCTION_SOURCE',
			reason: 'fixture',
			roles: ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'PRODUCTION'],
			sha256: sha256(first.currentBytes)
		};
		const bound = bindWorkingSourceEditObservation(first, artifact);
		expect(bound.evidenceSha256).toBe(first.observation.evidenceSha256);
		expect(bound.source.after.artifact).toEqual(artifact);
		expect(bound.source.after.binding).toBe('RAW_CURRENT_BYTES_MATCH_FROZEN_SUBJECT_ARTIFACT');
		expect(
			observationError(() =>
				bindWorkingSourceEditObservation(first, { ...artifact, bytes: artifact.bytes + 1 })
			).code
		).toBe('FROZEN_SUBJECT_ARTIFACT_MISMATCH');
	});

	it('refuses a selected source with no raw byte difference', () => {
		const subject = repository({ 'source.ts': 'export const value = 1;\n' });
		const error = observationError(() => observe(subject, 'source.ts'));
		expect(error.code).toBe('SOURCE_UNCHANGED');
		expect(error.stage).toBe('TEXTUAL_CHANGE');
	});

	it('refuses a staged blob or mode divergence from the immutable HEAD entry', () => {
		const subject = repository({ 'source.ts': 'export const value = 1;\n' });
		writeFileSync(join(subject.root, 'source.ts'), 'export const value = 2;\n');
		git(subject.root, ['add', '--', 'source.ts']);
		const error = observationError(() => observe(subject, 'source.ts'));
		expect(error.code).toBe('INDEX_DIVERGES_FROM_HEAD');
		expect(error.stage).toBe('INDEX');
	});

	it('refuses deletion and an untracked path without repository-wide status enumeration', () => {
		const deleted = repository({ 'source.ts': 'export const value = 1;\n' });
		unlinkSync(join(deleted.root, 'source.ts'));
		expect(observationError(() => observe(deleted, 'source.ts')).code).toBe('SOURCE_READ_FAILED');

		const untracked = repository({ 'tracked.ts': 'export const tracked = true;\n' });
		writeFileSync(join(untracked.root, 'source.ts'), 'export const value = 2;\n');
		expect(observationError(() => observe(untracked, 'source.ts')).code).toBe(
			'HEAD_TREE_ENTRY_MISSING'
		);

		const directoryReplacement = repository({ 'source.ts': 'export const value = 1;\n' });
		unlinkSync(join(directoryReplacement.root, 'source.ts'));
		mkdirSync(join(directoryReplacement.root, 'source.ts'));
		expect(observationError(() => observe(directoryReplacement, 'source.ts')).code).toBe(
			'SOURCE_NOT_REGULAR'
		);
	});

	it('refuses a symlink-mode immutable tree entry before reading the worktree path', () => {
		const subject = repository({ 'tracked.ts': 'export const tracked = true;\n' });
		const linkBlob = gitText(
			subject.root,
			['hash-object', '-w', '--stdin'],
			Buffer.from('tracked.ts')
		);
		git(subject.root, ['update-index', '--add', '--cacheinfo', '120000', linkBlob, 'link.ts']);
		git(subject.root, ['commit', '--quiet', '-m', 'add link entry']);
		const withLink = { ...subject, headOid: gitText(subject.root, ['rev-parse', 'HEAD']) };
		const error = observationError(() => observe(withLink, 'link.ts'));
		expect(error.code).toBe('HEAD_TREE_ENTRY_NOT_REGULAR');
		expect(error.stage).toBe('HEAD_TREE');
	});

	it('refuses malformed UTF-8 and valid UTF-8 containing a binary NUL', () => {
		const subject = repository({ 'source.ts': 'export const value = 1;\n' });
		writeFileSync(join(subject.root, 'source.ts'), Buffer.from([0xff, 0xfe]));
		expect(observationError(() => observe(subject, 'source.ts')).code).toBe('SOURCE_INVALID_UTF8');

		writeFileSync(join(subject.root, 'source.ts'), Buffer.from([0x61, 0, 0x62]));
		expect(observationError(() => observe(subject, 'source.ts')).code).toBe(
			'SOURCE_BINARY_UNSUPPORTED'
		);
	});

	it('uses surrogate-safe deterministic UTF-16 single-envelope boundaries', () => {
		expect(workingSourceEditTextRanges('A\ud83c\ude00B', 'A\ud83d\ude00B')).toEqual({
			afterRange: { endUtf16: 3, startUtf16: 1 },
			beforeRange: { endUtf16: 3, startUtf16: 1 }
		});
		expect(workingSourceEditTextRanges('prefix tail', 'prefix longer tail')).toEqual({
			afterRange: { endUtf16: 14, startUtf16: 7 },
			beforeRange: { endUtf16: 7, startUtf16: 7 }
		});
		expect(workingSourceEditTextRanges('A😀x', 'A😁x')).toEqual({
			afterRange: { endUtf16: 3, startUtf16: 1 },
			beforeRange: { endUtf16: 3, startUtf16: 1 }
		});
	});

	it('refuses source and Git metadata resource excess with safe typed diagnostics', () => {
		const subject = repository({ 'source.ts': 'export const value = 1;\n' });
		writeFileSync(join(subject.root, 'source.ts'), 'export const value = 2;\n');
		const sourceError = observationError(() =>
			observe(subject, 'source.ts', subject.root, budgets({ maxSourceBytes: 4 }))
		);
		expect(sourceError.code).toBe('SOURCE_SIZE_BUDGET_EXCEEDED');
		expect(sourceError.state).toBe('resource-refused');

		const metadataError = observationError(() =>
			observe(subject, 'source.ts', subject.root, budgets({ maxGitMetadataBytes: 1 }))
		);
		expect(metadataError.state).toBe('resource-refused');
		expect(metadataError.message).not.toContain(subject.root);
	});

	it('refuses an over-budget nested repository path and a base OID of the wrong object format', () => {
		const subject = repository({ 'nested/source.ts': 'export const value = 1;\n' });
		writeFileSync(join(subject.root, 'nested', 'source.ts'), 'export const value = 2;\n');
		const nestedRoot = join(subject.root, 'nested');
		expect(
			observationError(() =>
				observe(
					subject,
					'source.ts',
					nestedRoot,
					budgets({ maxPathCharacters: 'source.ts'.length })
				)
			).code
		).toBe('SOURCE_PATH_BUDGET_EXCEEDED');
		expect(
			observationError(() =>
				observeWorkingSourceEdit({
					budgets: budgets(),
					expectedHeadOid: 'a'.repeat(64),
					logicalPath: 'nested/source.ts',
					rootLocator: subject.root
				})
			).code
		).toBe('BASE_COMMIT_OBJECT_FORMAT_MISMATCH');
	});

	it('scrubs inherited Git redirection and unsafe empty or repository PATH entries', () => {
		const subject = repository({
			'nested/source.ts': 'export const nested = 1;\n',
			'source.ts': 'export const value = 1;\n'
		});
		const decoy = repository({ 'source.ts': 'export const decoy = true;\n' });
		writeFileSync(join(subject.root, 'source.ts'), 'export const value = 2;\n');
		writeFileSync(join(subject.root, 'nested', 'source.ts'), 'export const nested = 2;\n');
		writeFileSync(join(subject.root, '.gitattributes'), 'source.ts filter=csaa-hostile\n');
		git(subject.root, ['config', 'filter.csaa-hostile.clean', 'false']);
		git(subject.root, ['config', 'filter.csaa-hostile.smudge', 'false']);
		git(subject.root, ['config', 'filter.csaa-hostile.process', 'false']);
		const decoyExecutableRoot = mkdtempSync(join(tmpdir(), 'csaa-working-edit-decoy-bin-'));
		temporaryRoots.push(decoyExecutableRoot);
		mkdirSync(join(decoyExecutableRoot, process.platform === 'win32' ? 'git.exe' : 'git'));
		const inherited = new Map<string, string | undefined>();
		for (const key of [
			'GIT_DIR',
			'GIT_INDEX_FILE',
			'GIT_OBJECT_DIRECTORY',
			'GIT_PAGER',
			'GIT_WORK_TREE',
			'LD_AUDIT',
			'LD_PRELOAD',
			'PAGER',
			'PATH'
		])
			inherited.set(key, process.env[key]);
		try {
			process.env.GIT_DIR = join(decoy.root, '.git');
			process.env.GIT_INDEX_FILE = join(decoy.root, '.git', 'index');
			process.env.GIT_OBJECT_DIRECTORY = join(decoy.root, '.git', 'objects');
			process.env.GIT_PAGER = 'false';
			process.env.GIT_WORK_TREE = decoy.root;
			if (process.platform === 'linux') {
				process.env.LD_AUDIT = '/csaa/definitely-missing-audit-library.so';
				process.env.LD_PRELOAD = '/csaa/definitely-missing-preload-library.so';
			}
			process.env.PAGER = 'false';
			process.env.PATH = [
				join(subject.root, 'missing-bin'),
				join(subject.root, 'source.ts'),
				decoyExecutableRoot,
				subject.root,
				'',
				process.env.PATH ?? ''
			].join(delimiter);
			const capture = observe(subject, 'source.ts');
			expect(capture.observation.git.headOid).toBe(subject.headOid);
			expect(capture.observation.source.after.sha256).toBe(sha256('export const value = 2;\n'));
			const nestedCapture = observe(subject, 'source.ts', join(subject.root, 'nested'));
			expect(nestedCapture.observation.source.repositoryPath).toBe('nested/source.ts');
		} finally {
			for (const [key, value] of inherited)
				if (value === undefined) delete process.env[key];
				else process.env[key] = value;
		}
	});

	it('classifies a selected index disappearance during the close-window recheck as stale', () => {
		const subject = repository({ 'source.ts': 'export const value = 1;\n' });
		writeFileSync(join(subject.root, 'source.ts'), 'export const value = 2;\n');
		const error = observationError(() =>
			observeWorkingSourceEdit(
				{
					budgets: budgets(),
					expectedHeadOid: subject.headOid,
					logicalPath: 'source.ts',
					rootLocator: subject.root
				},
				{
					beforeCurrentnessRecheck: () => {
						git(subject.root, ['update-index', '--force-remove', '--', 'source.ts']);
					}
				}
			)
		);
		expect(error).toMatchObject({
			code: 'INDEX_ENTRY_CHANGED',
			stage: 'CURRENTNESS',
			state: 'stale'
		});
	});

	it('applies one aggregate monotonic deadline across Git invocations in an observation', () => {
		const subject = repository({ 'source.ts': 'export const value = 1;\n' });
		writeFileSync(join(subject.root, 'source.ts'), 'export const value = 2;\n');
		let monotonicMs = 0;
		const error = observationError(() =>
			observeWorkingSourceEdit(
				{
					budgets: budgets({ maxGitOperationDurationMs: 30_000 }),
					expectedHeadOid: subject.headOid,
					logicalPath: 'source.ts',
					rootLocator: subject.root
				},
				{
					clockSources: {
						monotonicNow: () => {
							const current = monotonicMs;
							monotonicMs += 10_000;
							return current;
						},
						wallNow: () => 1_000
					}
				}
			)
		);
		expect(error).toMatchObject({
			code: 'GIT_OBSERVATION_TIMEOUT',
			state: 'resource-refused'
		});
	});

	it('observes the selected raw edit from an actual linked worktree', () => {
		const subject = repository({ 'source.ts': 'export const value = 1;\n' });
		const worktreeParent = mkdtempSync(join(tmpdir(), 'csaa-working-edit-linked-parent-'));
		temporaryRoots.push(worktreeParent);
		const linkedRoot = join(worktreeParent, 'linked');
		git(subject.root, ['worktree', 'add', '--quiet', '--detach', linkedRoot, subject.headOid]);
		writeFileSync(join(linkedRoot, 'source.ts'), 'export const value = 2;\n');
		const capture = observe({ headOid: subject.headOid, root: linkedRoot }, 'source.ts');
		expect(capture.observation.git.headOid).toBe(subject.headOid);
		expect(capture.observation.source.after.sha256).toBe(sha256('export const value = 2;\n'));
		expect(existsSync(join(linkedRoot, '.git'))).toBe(true);
	});

	it.runIf(SHA256_REPOSITORIES_SUPPORTED)(
		'observes exact full SHA-256 Git object identities',
		() => {
			const subject = repository({ 'source.ts': 'export const value = 1;\n' }, 'sha256');
			writeFileSync(join(subject.root, 'source.ts'), 'export const value = 2;\n');
			const capture = observe(subject, 'source.ts');
			expect(capture.observation.git.objectFormat).toBe('sha256');
			expect(capture.observation.git.headOid).toMatch(/^[0-9a-f]{64}$/u);
			expect(capture.observation.git.treeBlobOid).toMatch(/^[0-9a-f]{64}$/u);
		}
	);

	it('marks HEAD mismatch and final raw-byte re-observation failure as stale', () => {
		const subject = repository({ 'source.ts': 'export const value = 1;\n' });
		writeFileSync(join(subject.root, 'source.ts'), 'export const value = 2;\n');
		const mismatch = observationError(() =>
			observeWorkingSourceEdit({
				budgets: budgets(),
				expectedHeadOid: '0'.repeat(subject.headOid.length),
				logicalPath: 'source.ts',
				rootLocator: subject.root
			})
		);
		expect(mismatch.code).toBe('GIT_HEAD_MISMATCH');
		expect(mismatch.state).toBe('stale');

		const capture = observe(subject, 'source.ts');
		writeFileSync(join(subject.root, 'source.ts'), 'export const value = 3;\n');
		const stale = observationError(() => verifyWorkingSourceEditObservation(capture));
		expect(stale.code).toBe('WORKING_SOURCE_EDIT_OBSERVATION_STALE');
		expect(stale.stage).toBe('CURRENTNESS');
		expect(stale.state).toBe('stale');
	});

	it('fails closed when currentness setup throws or current bytes change, and re-verifies exact captures', () => {
		const subject = repository({ 'source.ts': 'export const value = 1;\n' });
		const edited = 'export const value = 2;\n';
		writeFileSync(join(subject.root, 'source.ts'), edited);
		const options = {
			budgets: budgets(),
			expectedHeadOid: subject.headOid,
			logicalPath: 'source.ts',
			rootLocator: subject.root
		};
		expect(
			observationError(() =>
				observeWorkingSourceEdit(options, {
					beforeCurrentnessRecheck() {
						throw new Error('synthetic setup failure');
					}
				})
			)
		).toMatchObject({ code: 'CURRENTNESS_RECHECK_SETUP_FAILED', state: 'failed' });

		writeFileSync(join(subject.root, 'source.ts'), edited);
		expect(
			observationError(() =>
				observeWorkingSourceEdit(options, {
					beforeCurrentnessRecheck() {
						writeFileSync(join(subject.root, 'source.ts'), 'export const value = 3;\n');
					}
				})
			)
		).toMatchObject({ code: 'SOURCE_CHANGED_DURING_CAPTURE', state: 'stale' });

		writeFileSync(join(subject.root, 'source.ts'), edited);
		const capture = observeWorkingSourceEdit(options);
		const verified = verifyWorkingSourceEditObservation(capture);
		expect(sameWorkingSourceEditCapture(capture, verified)).toBe(true);
		expect(
			observationError(() =>
				verifyWorkingSourceEditObservation({
					...capture,
					budgets: budgets({ maxGitMetadataBytes: 1 })
				})
			)
		).toMatchObject({ state: 'resource-refused' });
		expect(
			sameWorkingSourceEditCapture(capture, {
				...verified,
				currentBytes: Uint8Array.of(0)
			})
		).toBe(false);

		const vanished = repository({ 'source.ts': 'export const value = 1;\n' });
		writeFileSync(join(vanished.root, 'source.ts'), 'export const value = 2;\n');
		const vanishedCapture = observe(vanished, 'source.ts');
		unlinkSync(join(vanished.root, 'source.ts'));
		expect(
			observationError(() => verifyWorkingSourceEditObservation(vanishedCapture))
		).toMatchObject({
			code: 'WORKING_SOURCE_EDIT_OBSERVATION_STALE',
			state: 'stale'
		});
	});
});
