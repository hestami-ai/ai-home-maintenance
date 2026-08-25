import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	type ResolveSubjectRequest
} from '../contracts/subject.js';
import { verifyFrozenSubject } from './freshness.js';
import { parseGitProviderVersion } from './observe-working-change-set.js';
import { resolveSubject } from './resolve-subject.js';
import { resolveWorkingSubject } from './resolve-working-subject.js';

const roots: string[] = [];

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

function fixture(objectFormat: 'sha1' | 'sha256' = 'sha1'): {
	readonly repository: string;
	readonly subject: string;
} {
	const repository = mkdtempSync(join(tmpdir(), 'csaa-working-subject-'));
	roots.push(repository);
	const subject = join(repository, 'subject');
	write(
		repository,
		'subject/package.json',
		JSON.stringify({ name: 'fixture', private: true, workspaces: ['packages/*'] })
	);
	write(
		repository,
		'subject/packages/demo/package.json',
		JSON.stringify({ name: '@fixture/demo', private: true })
	);
	write(
		repository,
		'subject/packages/demo/tsconfig.json',
		JSON.stringify({ compilerOptions: { strict: true }, include: ['src'] })
	);
	write(repository, 'subject/packages/demo/src/index.ts', 'export const value = 1;\n');
	write(repository, 'subject/packages/demo/src/delete-me.ts', 'export const removed = true;\n');
	write(
		repository,
		'subject/packages/demo/src/copy-source.ts',
		'export const uniqueCopy = true;\n'
	);
	write(repository, 'subject/verif/result.json', '{"before":true}\n');
	git(
		repository,
		'init',
		'--quiet',
		...(objectFormat === 'sha256' ? ['--object-format=sha256'] : [])
	);
	git(repository, 'config', 'user.email', 'fixture@example.invalid');
	git(repository, 'config', 'user.name', 'Fixture');
	git(repository, 'add', '--all');
	git(repository, 'commit', '--quiet', '-m', 'fixture');
	return { repository, subject };
}

function request(root: string, outputs: readonly string[] = []): ResolveSubjectRequest {
	return {
		budgets: {
			maxBytes: 16 * 1024 * 1024,
			maxConfigDepth: 32,
			maxDiagnostics: 1_000,
			maxDurationMs: 30_000,
			maxFiles: 10_000,
			maxProjects: 100
		},
		filters: { exclude: [], include: [] },
		operationVersion: 'fixture-working-subject/1.0.0',
		outputs,
		policyVersion: SUBJECT_POLICY_VERSION,
		rootLocator: root,
		schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
		scope: { kind: 'REPOSITORY' },
		subjectKind: 'WORKTREE'
	};
}

function resolved(root: string, outputs: readonly string[] = []) {
	const outcome = resolveWorkingSubject(request(root, outputs));
	if (outcome.outcome !== 'resolved') throw new Error(JSON.stringify(outcome));
	expect(outcome.outcome).toBe('resolved');
	return outcome.subject;
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('Git-bound Working Change Set subject resolution', () => {
	it('accepts bounded printable provider suffixes without truncating their identity', () => {
		expect(parseGitProviderVersion('git version 2.39.3 (Apple Git-146)')).toBe(
			'2.39.3 (Apple Git-146)'
		);
		expect(parseGitProviderVersion('git version 2.39.3\tspoofed')).toBeNull();
		expect(parseGitProviderVersion(`git version ${'x'.repeat(257)}`)).toBeNull();
	});

	it('binds a clean nested subject and preserves Git-aware currentness', () => {
		const { subject } = fixture();
		const frozen = resolved(subject);
		expect(frozen.workingChangeSet).toMatchObject({
			checkoutId: '.',
			dirtyState: 'CLEAN',
			entries: [],
			includedUntrackedEntries: [],
			repositoryPrefix: 'subject'
		});
		expect(frozen.workingChangeSet?.baseRevision).toMatch(/^[0-9a-f]{40}$/u);
		expect(frozen.descriptor).toMatchObject({
			dirtyState: 'CLEAN',
			parentRevision: null,
			revision: frozen.workingChangeSet?.baseRevision
		});
		expect(Object.isFrozen(frozen.workingChangeSet?.entries)).toBe(true);
		expect(Object.isFrozen(frozen.workingChangeSet?.git)).toBe(true);
		expect(verifyFrozenSubject(frozen, { rootLocator: subject })).toMatchObject({
			changedPaths: [],
			state: 'CURRENT'
		});
	}, 15_000);

	it('records modified, deleted, and included untracked frozen bytes', () => {
		const { subject } = fixture();
		write(subject, 'packages/demo/src/index.ts', 'export const value = 2;\n');
		rmSync(join(subject, 'packages/demo/src/delete-me.ts'));
		write(subject, 'packages/demo/src/new.ts', 'export const added = true;\n');
		const frozen = resolved(subject);
		expect(frozen.workingChangeSet?.dirtyState).toBe('DIRTY');
		expect(frozen.descriptor).toMatchObject({
			dirtyState: 'DIRTY',
			parentRevision: frozen.workingChangeSet?.baseRevision,
			revision: null
		});
		expect(frozen.workingChangeSet?.entries.map((entry) => entry.kind)).toEqual([
			'DELETE',
			'MODIFY'
		]);
		expect(frozen.workingChangeSet?.includedUntrackedEntries).toEqual([
			expect.objectContaining({
				kind: 'ADD',
				after: expect.objectContaining({ path: 'packages/demo/src/new.ts' })
			})
		]);
		expect(verifyFrozenSubject(frozen, { rootLocator: subject }).state).toBe('CURRENT');
		write(subject, 'packages/demo/src/index.ts', 'export const value = 3;\n');
		expect(verifyFrozenSubject(frozen, { rootLocator: subject }).state).toBe('STALE');
	}, 15_000);

	it('refuses replacement after a final descriptor read on both reconciliation attempts', () => {
		const { subject } = fixture();
		const target = join(subject, 'packages/demo/src/index.ts');
		let replacements = 0;
		const outcome = resolveWorkingSubject(request(subject), {
			afterFinalArtifactRead: (_attempt, path) => {
				if (path !== 'packages/demo/src/index.ts') return;
				replacements += 1;
				writeFileSync(target, `export const value = ${String(100 + replacements)};\n`, 'utf8');
			}
		});
		expect(replacements).toBe(2);
		expect(outcome).toMatchObject({
			diagnostics: [
				expect.objectContaining({ code: 'WORKING_CHANGE_SET_CHANGED_DURING_RESOLUTION' })
			],
			outcome: 'unavailable'
		});
	}, 15_000);

	it('keeps staged intermediates visible when analyzed bytes differ from the index', () => {
		const { repository, subject } = fixture();
		write(subject, 'packages/demo/src/index.ts', 'export const value = 2;\n');
		git(repository, 'add', 'subject/packages/demo/src/index.ts');
		write(subject, 'packages/demo/src/index.ts', 'export const value = 3;\n');
		const frozen = resolved(subject);
		expect(frozen.workingChangeSet?.entries).toEqual([
			expect.objectContaining({
				kind: 'MODIFY',
				after: expect.objectContaining({ sha256: expect.any(String) })
			})
		]);
		expect(frozen.workingChangeSet?.excludedLocalState).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: 'INDEX_DIFFERS_FROM_ANALYZED_BYTES',
					path: 'packages/demo/src/index.ts'
				})
			])
		);
	}, 15_000);

	it('infers only exact unique rename and copy lineage', () => {
		const { subject } = fixture();
		renameSync(
			join(subject, 'packages/demo/src/delete-me.ts'),
			join(subject, 'packages/demo/src/renamed.ts')
		);
		write(
			subject,
			'packages/demo/src/copied.ts',
			readFileSync(join(subject, 'packages/demo/src/copy-source.ts'), 'utf8')
		);
		const frozen = resolved(subject);
		expect(frozen.workingChangeSet?.includedUntrackedEntries.map((entry) => entry.kind)).toEqual([
			'COPY',
			'RENAME'
		]);
		expect(frozen.workingChangeSet?.entries).toEqual([]);
	});

	it('emits artifact-kind evidence beside an exact cross-class copy', () => {
		const { subject } = fixture();
		write(
			subject,
			'packages/demo/copied.md',
			readFileSync(join(subject, 'packages/demo/src/copy-source.ts'), 'utf8')
		);
		const frozen = resolved(subject);
		expect(frozen.workingChangeSet?.includedUntrackedEntries.map((entry) => entry.kind)).toEqual([
			'ARTIFACT_KIND_CHANGE',
			'COPY'
		]);
	}, 15_000);

	it('falls back to add and delete when exact lineage has a retained-source ambiguity', () => {
		const { repository, subject } = fixture();
		write(subject, 'packages/demo/src/retained-duplicate.ts', 'export const removed = true;\n');
		git(repository, 'add', '--all');
		git(repository, 'commit', '--quiet', '-m', 'duplicate base source');
		renameSync(
			join(subject, 'packages/demo/src/delete-me.ts'),
			join(subject, 'packages/demo/src/ambiguous.ts')
		);
		const frozen = resolved(subject);
		expect(frozen.workingChangeSet?.entries.map((entry) => entry.kind)).toEqual(['DELETE']);
		expect(frozen.workingChangeSet?.includedUntrackedEntries.map((entry) => entry.kind)).toEqual([
			'ADD'
		]);
	}, 15_000);

	it('distinguishes staged additions and deletions from selected untracked inputs', () => {
		const { repository, subject } = fixture();
		write(subject, 'packages/demo/src/staged-add.ts', 'export const staged = true;\n');
		rmSync(join(subject, 'packages/demo/src/delete-me.ts'));
		git(repository, 'add', '--all');
		const frozen = resolved(subject);
		expect(frozen.workingChangeSet?.entries.map((entry) => entry.kind)).toEqual(['ADD', 'DELETE']);
		expect(frozen.workingChangeSet?.includedUntrackedEntries).toEqual([]);
	}, 15_000);

	it('keeps index-only state outside subject identity while making a later staging-only change stale', () => {
		const { repository, subject } = fixture();
		write(subject, 'packages/demo/src/index.ts', 'export const value = 2;\n');
		git(repository, 'add', 'subject/packages/demo/src/index.ts');
		write(subject, 'packages/demo/src/index.ts', 'export const value = 1;\n');
		const frozen = resolved(subject);
		expect(frozen.workingChangeSet).toMatchObject({
			dirtyState: 'CLEAN',
			entries: [],
			includedUntrackedEntries: []
		});
		expect(frozen.descriptor).toMatchObject({
			dirtyState: 'CLEAN',
			parentRevision: null,
			revision: frozen.workingChangeSet?.baseRevision
		});
		expect(frozen.workingChangeSet?.excludedLocalState).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: 'INDEX_DIFFERS_FROM_ANALYZED_BYTES',
					path: 'packages/demo/src/index.ts'
				})
			])
		);
		git(repository, 'reset', '--quiet', 'HEAD', '--', 'subject/packages/demo/src/index.ts');
		expect(verifyFrozenSubject(frozen, { rootLocator: subject }).state).toBe('STALE');
	}, 15_000);

	it('preserves binary and Unicode path bytes as selected untracked evidence', () => {
		const { subject } = fixture();
		const path = 'packages/demo/src/données-二进制.bin';
		const absolute = join(subject, ...path.split('/'));
		mkdirSync(dirname(absolute), { recursive: true });
		writeFileSync(absolute, Buffer.from([0, 255, 1, 2, 0, 128]));
		const frozen = resolved(subject);
		expect(frozen.workingChangeSet?.includedUntrackedEntries).toEqual([
			expect.objectContaining({
				after: expect.objectContaining({ path, sha256: expect.stringMatching(/^[0-9a-f]{64}$/u) }),
				kind: 'ADD'
			})
		]);
	}, 15_000);

	it('supports SHA-256 Git object identities when the provider does', () => {
		const { subject } = fixture('sha256');
		const frozen = resolved(subject);
		expect(frozen.workingChangeSet).toMatchObject({
			git: { objectFormat: 'sha256', providerId: 'git' }
		});
		expect(frozen.workingChangeSet?.baseRevision).toMatch(/^[0-9a-f]{64}$/u);
	}, 15_000);

	it('keeps serialized evidence complete while byte capabilities remain process-local', () => {
		const { subject } = fixture();
		const plain = resolveSubject(request(subject));
		if (plain.outcome !== 'resolved') throw new Error(JSON.stringify(plain));
		const frozen = resolved(subject);
		expect(frozen.descriptor.subjectId).not.toBe(plain.subject.descriptor.subjectId);
		const serialized = JSON.parse(JSON.stringify(frozen)) as typeof frozen;
		expect(serialized.workingChangeSet).toEqual(frozen.workingChangeSet);
		expect(serialized.descriptor).toEqual(frozen.descriptor);
		expect(Object.isFrozen(frozen.workingChangeSet?.includedUntrackedEntries)).toBe(true);
	}, 15_000);

	it('keeps declared generated outputs outside change identity and dirty state', () => {
		const { repository, subject } = fixture();
		write(subject, 'verif/result.json', '{"after":true}\n');
		const frozen = resolved(subject, ['verif/result.json']);
		expect(frozen.workingChangeSet).toMatchObject({
			dirtyState: 'CLEAN',
			entries: [],
			includedUntrackedEntries: []
		});
		expect(frozen.workingChangeSet?.excludedLocalState).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: 'DECLARED_OUTPUT', path: 'verif/result.json' })
			])
		);
		write(subject, 'verif/result.json', '{"after":2}\n');
		expect(verifyFrozenSubject(frozen, { rootLocator: subject }).state).toBe('CURRENT');
		git(repository, 'add', 'subject/verif/result.json');
		expect(verifyFrozenSubject(frozen, { rootLocator: subject }).state).toBe('CURRENT');
		const rebound = resolved(subject, ['verif/result.json']);
		expect(rebound.descriptor.subjectId).toBe(frozen.descriptor.subjectId);
		expect(rebound.workingChangeSet?.worktreeStateDigest).toBe(
			frozen.workingChangeSet?.worktreeStateDigest
		);
	}, 15_000);

	it('preserves tracked executable modes when Git ignores filesystem mode bits', () => {
		const { repository, subject } = fixture();
		git(repository, 'update-index', '--chmod=+x', 'subject/packages/demo/src/copy-source.ts');
		git(repository, 'commit', '--quiet', '-m', 'executable base mode');
		git(repository, 'config', 'core.filemode', 'false');
		const frozen = resolved(subject);
		expect(frozen.workingChangeSet).toMatchObject({
			dirtyState: 'CLEAN',
			entries: [],
			includedUntrackedEntries: []
		});
	}, 15_000);

	it('retries one Git race and refuses a Git state that changes across both attempts', () => {
		const first = fixture();
		let firstHookCalls = 0;
		const recovered = resolveWorkingSubject(request(first.subject), {
			afterInitialGitObservation: () => {
				firstHookCalls += 1;
				if (firstHookCalls === 1)
					write(first.subject, 'packages/demo/src/index.ts', 'export const value = 2;\n');
			}
		});
		expect(recovered.outcome).toBe('resolved');
		expect(firstHookCalls).toBe(2);

		const second = fixture();
		let value = 1;
		const refused = resolveWorkingSubject(request(second.subject), {
			beforeFinalGitObservation: () => {
				value += 1;
				write(second.subject, 'packages/demo/src/index.ts', `export const value = ${value};\n`);
			}
		});
		expect(refused).toMatchObject({
			diagnostics: [
				expect.objectContaining({ code: 'WORKING_CHANGE_SET_CHANGED_DURING_RESOLUTION' })
			],
			outcome: 'unavailable'
		});
	}, 20_000);

	it('fails closed for assume-unchanged index entries', () => {
		const { repository, subject } = fixture();
		git(repository, 'update-index', '--assume-unchanged', 'subject/packages/demo/src/index.ts');
		expect(resolveWorkingSubject(request(subject))).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'WORKING_CHANGE_SET_INCOMPATIBLE' })],
			outcome: 'incompatible'
		});
	});

	it('classifies sparse-checkout state as an incompatible subject', () => {
		const { repository, subject } = fixture();
		git(repository, 'config', 'core.sparseCheckout', 'true');
		expect(resolveWorkingSubject(request(subject))).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'WORKING_CHANGE_SET_INCOMPATIBLE' })],
			outcome: 'incompatible'
		});
	});

	it('refuses automatic checkout line-ending transformations', () => {
		const { repository, subject } = fixture();
		git(repository, 'config', 'core.autocrlf', 'true');
		expect(resolveWorkingSubject(request(subject))).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'WORKING_CHANGE_SET_INCOMPATIBLE' })],
			outcome: 'incompatible'
		});
	});

	it('admits core.autocrlf=input as raw-worktree-byte comparable', () => {
		const { repository, subject } = fixture();
		git(repository, 'config', 'core.autocrlf', 'input');
		write(subject, 'packages/demo/src/index.ts', 'export const value = 2;\r\n');
		const frozen = resolved(subject);
		expect(frozen.workingChangeSet?.git.rawByteComparison).toMatchObject({
			coreAutoCrlf: 'input',
			state: 'RAW_WORKTREE_BYTES_COMPARABLE'
		});
		expect(frozen.workingChangeSet?.entries).toEqual([
			expect.objectContaining({
				after: expect.objectContaining({ path: 'packages/demo/src/index.ts' }),
				kind: 'MODIFY'
			})
		]);
	});

	it('refuses selected paths governed by Git working-tree transform attributes', () => {
		const { repository, subject } = fixture();
		write(subject, '.gitattributes', '*.ts text\n');
		git(repository, 'add', 'subject/.gitattributes');
		git(repository, 'commit', '--quiet', '-m', 'text transform');
		expect(resolveWorkingSubject(request(subject))).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'WORKING_CHANGE_SET_INCOMPATIBLE' })],
			outcome: 'incompatible'
		});
	});

	it('refuses a selected Git symlink entry as incompatible without dereferencing it', () => {
		const { repository, subject } = fixture();
		write(subject, 'packages/demo/src/link.ts', 'packages/demo/src/index.ts\n');
		const oid = git(repository, 'hash-object', '-w', 'subject/packages/demo/src/link.ts');
		git(
			repository,
			'update-index',
			'--add',
			'--cacheinfo',
			`120000,${oid},subject/packages/demo/src/link.ts`
		);
		git(repository, 'commit', '--quiet', '-m', 'symlink entry');
		expect(resolveWorkingSubject(request(subject))).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'WORKING_CHANGE_SET_INCOMPATIBLE' })],
			outcome: 'incompatible'
		});
	});

	it('honors the aggregate Git observation byte budget', () => {
		const { subject } = fixture();
		const bounded = request(subject);
		expect(
			resolveWorkingSubject({
				...bounded,
				budgets: { ...bounded.budgets, maxBytes: 8 }
			})
		).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'WORKING_CHANGE_SET_UNAVAILABLE' })],
			outcome: 'unavailable'
		});
	});

	it('binds linked-worktree identity separately from the common Git directory', () => {
		const { repository } = fixture();
		const linked = mkdtempSync(join(tmpdir(), 'csaa-linked-worktree-'));
		rmSync(linked, { force: true, recursive: true });
		roots.push(linked);
		git(repository, 'worktree', 'add', '--quiet', '--detach', linked);
		const frozen = resolved(join(linked, 'subject'));
		expect(frozen.workingChangeSet).toMatchObject({
			dirtyState: 'CLEAN',
			repositoryPrefix: 'subject'
		});
		expect(frozen.workingChangeSet?.checkoutId).toMatch(/^worktrees\//u);
	}, 15_000);

	it('scrubs inherited Git redirection and skips repository-local PATH entries', () => {
		const { repository, subject } = fixture();
		const originalPath = process.env.PATH;
		const originalGitDirectory = process.env.GIT_DIR;
		const originalGitWorkTree = process.env.GIT_WORK_TREE;
		try {
			process.env.PATH = `${subject}${delimiter}${delimiter}${originalPath ?? ''}`;
			process.env.GIT_DIR = join(repository, 'missing-git-directory');
			process.env.GIT_WORK_TREE = join(repository, 'missing-worktree');
			expect(resolved(subject).workingChangeSet?.baseRevision).toMatch(/^[0-9a-f]{40}$/u);
		} finally {
			if (originalPath === undefined) delete process.env.PATH;
			else process.env.PATH = originalPath;
			if (originalGitDirectory === undefined) delete process.env.GIT_DIR;
			else process.env.GIT_DIR = originalGitDirectory;
			if (originalGitWorkTree === undefined) delete process.env.GIT_WORK_TREE;
			else process.env.GIT_WORK_TREE = originalGitWorkTree;
		}
	}, 15_000);
});
