export interface MutationGitOutcome {
	readonly error?: unknown;
	readonly signal: NodeJS.Signals | null;
	readonly status: number | null;
	readonly stdout: string | null;
}

export type MutationGitExecutor = (command: string, args: readonly string[]) => MutationGitOutcome;

export interface MutationTreeBaseline {
	readonly indexEntries: string;
}

function completedSuccessfully(outcome: MutationGitOutcome): boolean {
	return outcome.error === undefined && outcome.signal === null && outcome.status === 0;
}

/**
 * Captures the exact staged mutation baseline only when every tracked worktree byte matches the index.
 * Untracked files remain outside this instrument's subject because declared mutants only edit tracked files.
 */
export function captureMutationTreeBaseline(
	executeGit: MutationGitExecutor,
	paths: readonly string[]
): MutationTreeBaseline | null {
	const worktree = executeGit('git', ['diff', '--quiet', '--no-ext-diff', '--', ...paths]);
	if (!completedSuccessfully(worktree)) return null;

	const index = executeGit('git', ['ls-files', '--stage', '--', ...paths]);
	if (!completedSuccessfully(index) || index.stdout === null) return null;
	return Object.freeze({ indexEntries: index.stdout });
}

/** A mutation run remains valid only while both its worktree and its captured index population are unchanged. */
export function mutationTreeMatchesBaseline(
	executeGit: MutationGitExecutor,
	paths: readonly string[],
	baseline: MutationTreeBaseline
): boolean {
	const current = captureMutationTreeBaseline(executeGit, paths);
	return current !== null && current.indexEntries === baseline.indexEntries;
}
