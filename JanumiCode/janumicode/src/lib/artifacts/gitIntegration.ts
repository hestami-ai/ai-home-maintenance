/**
 * Git Integration Module
 * Implements Phase 3.2: Git tracking integration
 * Detects Git repositories and retrieves commit information
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { Result } from '../types';

const execAsync = promisify(exec);

/**
 * Git repository information
 */
export interface GitRepoInfo {
	/** Repository root path */
	root: string;
	/** Current branch name */
	branch: string;
	/** Current commit hash (full SHA) */
	commit: string;
	/** Short commit hash (7 characters) */
	commitShort: string;
	/** Whether working directory is clean */
	isClean: boolean;
}

/**
 * Git file information
 */
export interface GitFileInfo {
	/** File path relative to repo root */
	relativePath: string;
	/** Current commit hash for this file */
	commit: string;
	/** Whether file has uncommitted changes */
	isModified: boolean;
	/** Whether file is staged */
	isStaged: boolean;
}

/**
 * Detect if directory is in a Git repository
 * @param dirPath Directory path to check
 * @returns Result indicating if in Git repo
 */
export async function isGitRepository(
	dirPath: string
): Promise<Result<boolean>> {
	try {
		const { stdout } = await execAsync('git rev-parse --is-inside-work-tree', {
			cwd: dirPath,
			encoding: 'utf8',
		});
		return { success: true, value: stdout.trim() === 'true' };
	} catch (error) {
		// Not a git repository or git not available
		return { success: true, value: false };
	}
}

/**
 * Find Git repository root
 * @param dirPath Directory path to start search
 * @returns Result containing repository root path or null
 */
export async function findGitRoot(
	dirPath: string
): Promise<Result<string | null>> {
	try {
		const { stdout } = await execAsync('git rev-parse --show-toplevel', {
			cwd: dirPath,
			encoding: 'utf8',
		});
		return { success: true, value: stdout.trim() };
	} catch (error) {
		// Not a git repository
		return { success: true, value: null };
	}
}

/**
 * Get Git repository information
 * @param dirPath Directory path in repository
 * @returns Result containing repository information
 */
export async function getGitRepoInfo(
	dirPath: string
): Promise<Result<GitRepoInfo | null>> {
	try {
		// Check if in git repo
		const isRepoResult = await isGitRepository(dirPath);
		if (!isRepoResult.success || !isRepoResult.value) {
			return { success: true, value: null };
		}

		// Get repo root
		const rootResult = await findGitRoot(dirPath);
		if (!rootResult.success || !rootResult.value) {
			return { success: true, value: null };
		}
		const root = rootResult.value;

		// Get current branch
		const { stdout: branch } = await execAsync(
			'git rev-parse --abbrev-ref HEAD',
			{
				cwd: dirPath,
				encoding: 'utf8',
			}
		);

		// Get current commit hash
		const { stdout: commit } = await execAsync('git rev-parse HEAD', {
			cwd: dirPath,
			encoding: 'utf8',
		});

		// Get short commit hash
		const { stdout: commitShort } = await execAsync(
			'git rev-parse --short=7 HEAD',
			{
				cwd: dirPath,
				encoding: 'utf8',
			}
		);

		// Check if working directory is clean
		const { stdout: status } = await execAsync('git status --porcelain', {
			cwd: dirPath,
			encoding: 'utf8',
		});
		const isClean = status.trim() === '';

		return {
			success: true,
			value: {
				root,
				branch: branch.trim(),
				commit: commit.trim(),
				commitShort: commitShort.trim(),
				isClean,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get Git repository info'),
		};
	}
}

/**
 * Get Git file information
 * @param filePath Absolute file path
 * @param repoRoot Repository root path
 * @returns Result containing file information
 */
export async function getGitFileInfo(
	filePath: string,
	repoRoot: string
): Promise<Result<GitFileInfo | null>> {
	try {
		// Check if in git repo
		const isRepoResult = await isGitRepository(repoRoot);
		if (!isRepoResult.success || !isRepoResult.value) {
			return { success: true, value: null };
		}

		// Get relative path
		const relativePath = path.relative(repoRoot, filePath);

		// Get last commit for this file
		const { stdout: commit } = await execAsync(
			`git log -1 --format=%H -- "${relativePath}"`,
			{
				cwd: repoRoot,
				encoding: 'utf8',
			}
		);

		// Check file status
		const { stdout: status } = await execAsync(
			`git status --porcelain -- "${relativePath}"`,
			{
				cwd: repoRoot,
				encoding: 'utf8',
			}
		);

		const statusLine = status.trim();
		const isModified = statusLine.length > 0 && statusLine[1] === 'M';
		const isStaged = statusLine.length > 0 && statusLine[0] === 'M';

		return {
			success: true,
			value: {
				relativePath,
				commit: commit.trim(),
				isModified,
				isStaged,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get Git file info'),
		};
	}
}

/**
 * Get commit hash for current HEAD
 * @param dirPath Directory path in repository
 * @returns Result containing commit hash or null
 */
export async function getCurrentCommitHash(
	dirPath: string
): Promise<Result<string | null>> {
	try {
		const { stdout } = await execAsync('git rev-parse HEAD', {
			cwd: dirPath,
			encoding: 'utf8',
		});
		return { success: true, value: stdout.trim() };
	} catch (error) {
		// Not a git repository or no commits
		return { success: true, value: null };
	}
}

/**
 * Get short commit hash for current HEAD
 * @param dirPath Directory path in repository
 * @param length Length of short hash (default: 7)
 * @returns Result containing short commit hash or null
 */
export async function getCurrentCommitHashShort(
	dirPath: string,
	length = 7
): Promise<Result<string | null>> {
	try {
		const { stdout } = await execAsync(
			`git rev-parse --short=${length} HEAD`,
			{
				cwd: dirPath,
				encoding: 'utf8',
			}
		);
		return { success: true, value: stdout.trim() };
	} catch (error) {
		// Not a git repository or no commits
		return { success: true, value: null };
	}
}

/**
 * Check if file is tracked by Git
 * @param filePath Absolute file path
 * @param repoRoot Repository root path
 * @returns Result indicating if file is tracked
 */
export async function isFileTracked(
	filePath: string,
	repoRoot: string
): Promise<Result<boolean>> {
	try {
		const relativePath = path.relative(repoRoot, filePath);
		const { stdout } = await execAsync(`git ls-files -- "${relativePath}"`, {
			cwd: repoRoot,
			encoding: 'utf8',
		});
		return { success: true, value: stdout.trim() !== '' };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to check if file is tracked'),
		};
	}
}

/**
 * Get list of modified files in working directory
 * @param dirPath Directory path in repository
 * @returns Result containing array of modified file paths (relative to repo root)
 */
export async function getModifiedFiles(
	dirPath: string
): Promise<Result<string[]>> {
	try {
		const { stdout } = await execAsync('git status --porcelain', {
			cwd: dirPath,
			encoding: 'utf8',
		});

		const modifiedFiles: string[] = [];
		const lines = stdout.split('\n').filter((line) => line.trim() !== '');

		for (const line of lines) {
			// Parse git status output
			const status = line.substring(0, 2);
			const filePath = line.substring(3);

			// Check if file is modified (M in second position)
			if (status[1] === 'M' || status[0] === 'M') {
				modifiedFiles.push(filePath);
			}
		}

		return { success: true, value: modifiedFiles };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get modified files'),
		};
	}
}

/**
 * Get Git remote URL
 * @param dirPath Directory path in repository
 * @returns Result containing remote URL or null
 */
export async function getRemoteUrl(
	dirPath: string
): Promise<Result<string | null>> {
	try {
		const { stdout } = await execAsync('git remote get-url origin', {
			cwd: dirPath,
			encoding: 'utf8',
		});
		return { success: true, value: stdout.trim() };
	} catch (error) {
		// No remote configured
		return { success: true, value: null };
	}
}

/**
 * Check if Git is available on the system
 * @returns Result indicating if Git is available
 */
export async function isGitAvailable(): Promise<Result<boolean>> {
	try {
		await execAsync('git --version');
		return { success: true, value: true };
	} catch (error) {
		return { success: true, value: false };
	}
}
