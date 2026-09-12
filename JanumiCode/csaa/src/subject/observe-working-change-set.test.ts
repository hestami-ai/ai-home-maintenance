import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as gitReadonly from './git-readonly.js';
import {
	createGitObservationBudgetSession,
	observeGitWorkingState,
	observeRawByteComparisonPolicy,
	parseGitProviderVersion,
	readObservedGitBlob
} from './observe-working-change-set.js';

const roots: string[] = [];
const DEFAULT_BUDGETS = {
	maxBytes: 4 * 1024 * 1024,
	maxDurationMs: 30_000,
	maxFiles: 100
} as const;

function write(root: string, path: string, contents: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents, 'utf8');
}

function git(root: string, ...args: string[]): string {
	const result = spawnSync('git', args, {
		cwd: root,
		encoding: 'utf8',
		shell: false,
		windowsHide: true
	});
	if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
	return result.stdout.trim();
}

function gitWithInput(root: string, input: string, ...args: string[]): void {
	const result = spawnSync('git', args, {
		cwd: root,
		encoding: 'utf8',
		input,
		shell: false,
		windowsHide: true
	});
	if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
}

function fixture(): { readonly repository: string; readonly subject: string } {
	const repository = mkdtempSync(join(tmpdir(), 'csaa-git-observation-'));
	roots.push(repository);
	const subject = join(repository, 'subject');
	write(repository, 'subject/file.txt', 'committed bytes\n');
	write(repository, 'subject/rename-me.txt', 'rename source\n');
	git(repository, 'init', '--quiet');
	git(repository, 'config', 'user.email', 'fixture@example.invalid');
	git(repository, 'config', 'user.name', 'Fixture');
	git(repository, 'add', '--all');
	git(repository, 'commit', '--quiet', '-m', 'fixture');
	return { repository, subject };
}

afterEach(() => {
	for (const root of roots.splice(0))
		rmSync(root, { force: true, maxRetries: 10, recursive: true, retryDelay: 100 });
});

describe('Git working-state observation', () => {
	it('rejects provider output that does not carry the Git version prefix', () => {
		expect(parseGitProviderVersion('version 2.50.1')).toBeNull();
	});

	it('observes nested and repository-root subjects and retains blob and attribute capabilities', () => {
		const { repository, subject } = fixture();
		const nested = observeGitWorkingState(subject, DEFAULT_BUDGETS);
		expect(nested).toMatchObject({
			checkoutId: '.',
			objectFormat: 'sha1',
			repositoryPrefix: 'subject',
			statusRecords: []
		});
		expect(nested.baseTree.map(({ path }) => path)).toEqual(['file.txt', 'rename-me.txt']);
		expect(nested.index.map(({ path }) => path)).toEqual(['file.txt', 'rename-me.txt']);
		expect(Buffer.from(readObservedGitBlob(nested, nested.baseTree[0]!.oid)).toString('utf8')).toBe(
			'committed bytes\n'
		);
		expect(observeRawByteComparisonPolicy(nested, ['rename-me.txt', 'file.txt'])).toMatchObject({
			attributeManifestDigest: expect.stringMatching(/^[0-9a-f]{64}$/u),
			method: 'git-check-attr-transform-refusal/1.0.0',
			state: 'RAW_WORKTREE_BYTES_COMPARABLE'
		});
		expect(observeRawByteComparisonPolicy(nested, [])).toMatchObject({
			state: 'RAW_WORKTREE_BYTES_COMPARABLE'
		});

		const repositoryWide = observeGitWorkingState(repository, DEFAULT_BUDGETS);
		expect(repositoryWide.repositoryPrefix).toBe('');
		expect(repositoryWide.baseTree.map(({ path }) => path)).toEqual([
			'subject/file.txt',
			'subject/rename-me.txt'
		]);
	}, 15_000);

	it('reports ordinary, staged-rename, and untracked status records through one observation', () => {
		const { repository, subject } = fixture();
		write(subject, 'file.txt', 'working bytes\n');
		git(repository, 'mv', 'subject/rename-me.txt', 'subject/renamed.txt');
		write(subject, 'untracked.txt', 'new bytes\n');

		const observation = observeGitWorkingState(subject, DEFAULT_BUDGETS);
		expect(observation.statusRecords).toEqual(
			expect.arrayContaining([
				{ kind: 'ORDINARY', originalPath: null, path: 'subject/file.txt' },
				{
					kind: 'RENAMED_OR_COPIED',
					originalPath: 'subject/rename-me.txt',
					path: 'subject/renamed.txt'
				},
				{ kind: 'UNTRACKED', originalPath: null, path: 'subject/untracked.txt' }
			])
		);
	}, 15_000);

	it('enforces duration, output, and shared input/output observation budgets', () => {
		const { subject } = fixture();
		const durationSession = createGitObservationBudgetSession({
			maxBytes: DEFAULT_BUDGETS.maxBytes,
			maxDurationMs: 0
		});
		expect(() => observeGitWorkingState(subject, DEFAULT_BUDGETS, durationSession)).toThrow(
			'Git observation exceeded its duration budget.'
		);

		const emptySession = createGitObservationBudgetSession({ maxBytes: 0, maxDurationMs: 30_000 });
		expect(() => observeGitWorkingState(subject, DEFAULT_BUDGETS, emptySession)).toThrow(
			'Git observation exceeded its aggregate output-byte budget.'
		);

		const sharedSession = createGitObservationBudgetSession(DEFAULT_BUDGETS);
		const observation = observeGitWorkingState(subject, DEFAULT_BUDGETS, sharedSession);
		sharedSession.remainingOutputBytes = 1;
		expect(() => observeRawByteComparisonPolicy(observation, ['file.txt'])).toThrow(
			'Git observation exceeded its aggregate input/output-byte budget.'
		);
	}, 15_000);

	it('does not confer retained-byte authority on copied observation records', () => {
		const { subject } = fixture();
		const observation = observeGitWorkingState(subject, DEFAULT_BUDGETS);
		const detached = { ...observation };
		expect(() => readObservedGitBlob(observation, 'not-an-oid')).toThrow(
			'Git blob identity is invalid.'
		);
		expect(() => readObservedGitBlob(detached, observation.baseTree[0]!.oid)).toThrow(
			'Git observation budget capability is unavailable.'
		);
		expect(() => observeRawByteComparisonPolicy(detached, ['file.txt'])).toThrow(
			'Git observation budget capability is unavailable.'
		);
		expect(() => observeRawByteComparisonPolicy(observation, ['file.txt', 'file.txt'])).toThrow(
			'Raw-byte attribute population contains duplicate subject paths.'
		);
	}, 15_000);

	it('refuses a subject outside a non-bare Git worktree', () => {
		const root = mkdtempSync(join(tmpdir(), 'csaa-non-git-observation-'));
		roots.push(root);
		expect(() => observeGitWorkingState(root, DEFAULT_BUDGETS)).toThrow(
			'The requested subject is not inside a non-bare Git worktree.'
		);
	});

	it('refuses sparse, skip-worktree, and assume-unchanged repository state', () => {
		const sparse = fixture();
		git(sparse.repository, 'config', 'core.sparseCheckout', 'true');
		expect(() => observeGitWorkingState(sparse.subject, DEFAULT_BUDGETS)).toThrow(
			'Sparse Git checkout is unsupported by Working Change Set.'
		);

		const skipped = fixture();
		git(skipped.repository, 'update-index', '--skip-worktree', 'subject/file.txt');
		expect(() => observeGitWorkingState(skipped.subject, DEFAULT_BUDGETS)).toThrow(
			'Sparse or skip-worktree Git entries are unsupported.'
		);

		const assumed = fixture();
		git(assumed.repository, 'update-index', '--assume-unchanged', 'subject/file.txt');
		expect(() => observeGitWorkingState(assumed.subject, DEFAULT_BUDGETS)).toThrow(
			'Assume-unchanged Git entries are unsupported.'
		);
	}, 15_000);

	it('refuses unsafe automatic line-ending and selected-path attribute transformations', () => {
		const autoCrlf = fixture();
		git(autoCrlf.repository, 'config', 'core.autocrlf', 'true');
		const autoCrlfObservation = observeGitWorkingState(autoCrlf.subject, DEFAULT_BUDGETS);
		expect(() => observeRawByteComparisonPolicy(autoCrlfObservation, ['file.txt'])).toThrow(
			'core.autocrlf=true is unsupported because raw working bytes can differ from Git blobs.'
		);

		const attributed = fixture();
		write(attributed.subject, '.gitattributes', '*.txt text\n');
		const attributedObservation = observeGitWorkingState(attributed.subject, DEFAULT_BUDGETS);
		expect(() => observeRawByteComparisonPolicy(attributedObservation, ['file.txt'])).toThrow(
			'Git attribute text applies a working-tree transformation to a selected path.'
		);
	}, 15_000);

	it('refuses symlink and gitlink entries at both base-tree and index boundaries', () => {
		const symlink = fixture();
		const blobOid = git(symlink.repository, 'rev-parse', 'HEAD:subject/file.txt');
		git(
			symlink.repository,
			'update-index',
			'--add',
			'--cacheinfo',
			`120000,${blobOid},subject/link`
		);
		git(symlink.repository, 'commit', '--quiet', '-m', 'symlink entry');
		expect(() => observeGitWorkingState(symlink.subject, DEFAULT_BUDGETS)).toThrow(
			'Git symlink entries are unsupported by Working Change Set.'
		);

		const stagedSymlink = fixture();
		const stagedBlobOid = git(stagedSymlink.repository, 'rev-parse', 'HEAD:subject/file.txt');
		git(
			stagedSymlink.repository,
			'update-index',
			'--add',
			'--cacheinfo',
			`120000,${stagedBlobOid},subject/link`
		);
		expect(() => observeGitWorkingState(stagedSymlink.subject, DEFAULT_BUDGETS)).toThrow(
			'Git symlink entries are unsupported by Working Change Set.'
		);

		const gitlink = fixture();
		const commitOid = git(gitlink.repository, 'rev-parse', 'HEAD');
		git(
			gitlink.repository,
			'update-index',
			'--add',
			'--cacheinfo',
			`160000,${commitOid},subject/module`
		);
		git(gitlink.repository, 'commit', '--quiet', '-m', 'gitlink entry');
		expect(() => observeGitWorkingState(gitlink.subject, DEFAULT_BUDGETS)).toThrow(
			'Git base-tree record has an unsupported identity or object kind.'
		);

		const stagedGitlink = fixture();
		const stagedCommitOid = git(stagedGitlink.repository, 'rev-parse', 'HEAD');
		git(
			stagedGitlink.repository,
			'update-index',
			'--add',
			'--cacheinfo',
			`160000,${stagedCommitOid},subject/module`
		);
		expect(() => observeGitWorkingState(stagedGitlink.subject, DEFAULT_BUDGETS)).toThrow(
			'Gitlink entries are unsupported by Working Change Set.'
		);
	}, 15_000);

	it('refuses a genuinely unmerged staged index population', () => {
		const { repository, subject } = fixture();
		const baseOid = git(repository, 'rev-parse', 'HEAD:subject/file.txt');
		const competingOid = git(repository, 'rev-parse', 'HEAD:subject/rename-me.txt');
		git(repository, 'update-index', '--force-remove', 'subject/file.txt');
		gitWithInput(
			repository,
			[
				`100644 ${baseOid} 1\tsubject/file.txt`,
				`100644 ${baseOid} 2\tsubject/file.txt`,
				`100644 ${competingOid} 3\tsubject/file.txt`,
				''
			].join('\n'),
			'update-index',
			'--index-info'
		);
		expect(() => observeGitWorkingState(subject, DEFAULT_BUDGETS)).toThrow(
			'Unmerged Git index stages are unsupported by Working Change Set.'
		);
	}, 15_000);

	it('independently refuses an unmerged status population reported by the provider', () => {
		const { subject } = fixture();
		const runGitReadOnly = gitReadonly.runGitReadOnly;
		const provider = vi
			.spyOn(gitReadonly, 'runGitReadOnly')
			.mockImplementation((cwd, args, options) => {
				if (!args.includes('status')) return runGitReadOnly(cwd, args, options);
				const oid = '0'.repeat(40);
				return Buffer.from(
					`u UU N... 100644 100644 100644 100644 ${oid} ${oid} ${oid} subject/file.txt\0`
				);
			});
		try {
			expect(() => observeGitWorkingState(subject, DEFAULT_BUDGETS)).toThrow(
				'Unmerged Git status is unsupported by Working Change Set.'
			);
		} finally {
			provider.mockRestore();
		}
	}, 15_000);

	it('refuses malformed or unsupported identity and configuration metadata from the provider', () => {
		const { subject } = fixture();
		const cases = [
			{
				expected: 'Git object format is unsupported.',
				matches: (args: readonly string[]) => args.includes('--show-object-format'),
				output: 'sha512\n'
			},
			{
				expected: 'Git base revision is malformed or abbreviated.',
				matches: (args: readonly string[]) => args.includes('HEAD^{commit}'),
				output: 'abc123\n'
			},
			{
				expected: 'Git provider version is malformed.',
				matches: (args: readonly string[]) => args.includes('--version'),
				output: 'version withheld\n'
			},
			{
				expected: 'Git sparse-checkout configuration is malformed.',
				matches: (args: readonly string[]) => args.includes('core.sparseCheckout'),
				output: 'maybe\n'
			},
			{
				expected: 'Git file-mode configuration is malformed.',
				matches: (args: readonly string[]) => args.includes('core.filemode'),
				output: 'maybe\n'
			},
			{
				expected: 'Git automatic line-ending configuration is unsupported.',
				matches: (args: readonly string[]) => args.includes('core.autocrlf'),
				output: 'sometimes\n'
			}
		] as const;
		for (const { expected, matches, output } of cases) {
			const runGitReadOnly = gitReadonly.runGitReadOnly;
			const provider = vi
				.spyOn(gitReadonly, 'runGitReadOnly')
				.mockImplementation((cwd, args, options) =>
					matches(args) ? Buffer.from(output) : runGitReadOnly(cwd, args, options)
				);
			try {
				expect(() => observeGitWorkingState(subject, DEFAULT_BUDGETS), expected).toThrow(expected);
			} finally {
				provider.mockRestore();
			}
		}
	}, 15_000);

	it('enforces index-flag, base-tree, and status population budgets independently', () => {
		const indexLimited = fixture();
		expect(() =>
			observeGitWorkingState(indexLimited.subject, { ...DEFAULT_BUDGETS, maxFiles: 1 })
		).toThrow('Git index-flag population exceeds the file budget.');

		const baseLimited = fixture();
		git(baseLimited.repository, 'rm', '--cached', '--quiet', '-r', 'subject');
		expect(() =>
			observeGitWorkingState(baseLimited.subject, { ...DEFAULT_BUDGETS, maxFiles: 1 })
		).toThrow('Git base-tree population exceeds the file budget.');

		const statusLimited = fixture();
		for (let index = 0; index < 9; index += 1)
			write(statusLimited.subject, `untracked-${String(index)}.txt`, `${String(index)}\n`);
		expect(() =>
			observeGitWorkingState(statusLimited.subject, { ...DEFAULT_BUDGETS, maxFiles: 2 })
		).toThrow('Git status population exceeds the file budget.');
	}, 15_000);
});
