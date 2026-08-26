import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
	captureMutationTreeBaseline,
	mutationTreeMatchesBaseline,
	type MutationGitExecutor
} from '../scripts/mutants/tree-baseline.js';

const temporaryRepositories: string[] = [];

function gitExecutor(cwd: string): MutationGitExecutor {
	return (command, args) =>
		spawnSync(command, [...args], {
			cwd,
			encoding: 'utf8',
			windowsHide: true
		});
}

function git(cwd: string, args: readonly string[]): void {
	const result = spawnSync('git', [...args], { cwd, encoding: 'utf8', windowsHide: true });
	if (result.error !== undefined) throw result.error;
	if (result.status !== 0)
		throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
}

function repository(): { readonly cwd: string; readonly file: string } {
	const cwd = mkdtempSync(join(tmpdir(), 'jpwb-mutation-baseline-'));
	temporaryRepositories.push(cwd);
	const file = join(cwd, 'tracked.txt');
	git(cwd, ['init', '--quiet']);
	git(cwd, ['config', 'user.name', 'Mutation Baseline Test']);
	git(cwd, ['config', 'user.email', 'mutation-baseline@example.invalid']);
	writeFileSync(file, 'committed\n', 'utf8');
	git(cwd, ['add', 'tracked.txt']);
	git(cwd, ['commit', '--quiet', '-m', 'baseline']);
	return { cwd, file };
}

afterEach(() => {
	for (const path of temporaryRepositories.splice(0))
		rmSync(path, { force: true, recursive: true });
});

describe('mutation runner staged-index baseline', () => {
	it('admits staged candidate bytes but rejects unstaged or newly staged subject drift', () => {
		const { cwd, file } = repository();
		const executeGit = gitExecutor(cwd);
		const paths = ['tracked.txt'];

		const committed = captureMutationTreeBaseline(executeGit, paths);
		expect(committed).not.toBeNull();
		expect(mutationTreeMatchesBaseline(executeGit, paths, committed!)).toBe(true);

		writeFileSync(file, 'staged candidate\n', 'utf8');
		git(cwd, ['add', 'tracked.txt']);
		const staged = captureMutationTreeBaseline(executeGit, paths);
		expect(staged).not.toBeNull();
		expect(staged!.indexEntries).not.toBe(committed!.indexEntries);
		expect(mutationTreeMatchesBaseline(executeGit, paths, staged!)).toBe(true);

		writeFileSync(file, 'unstaged mutation\n', 'utf8');
		expect(mutationTreeMatchesBaseline(executeGit, paths, staged!)).toBe(false);

		git(cwd, ['checkout', '--', 'tracked.txt']);
		expect(mutationTreeMatchesBaseline(executeGit, paths, staged!)).toBe(true);

		writeFileSync(file, 'different staged candidate\n', 'utf8');
		git(cwd, ['add', 'tracked.txt']);
		expect(captureMutationTreeBaseline(executeGit, paths)).not.toBeNull();
		expect(mutationTreeMatchesBaseline(executeGit, paths, staged!)).toBe(false);
	});

	it('fails closed when Git cannot establish the baseline', () => {
		const missing = join(tmpdir(), `jpwb-mutation-baseline-missing-${process.pid}-${Date.now()}`);
		expect(captureMutationTreeBaseline(gitExecutor(missing), ['tracked.txt'])).toBeNull();
	});
});
