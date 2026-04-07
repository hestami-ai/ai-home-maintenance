/**
 * Shared CLI Process Spawn Utilities
 * Provides Windows-compatible spawn with rich error diagnostics.
 * Used by all RoleCLIProvider implementations (Claude Code, Gemini, Codex).
 *
 * Key fixes:
 * - Uses `shell: true` on Windows so .cmd/.bat wrappers are found via PATH
 * - Enriches ENOENT errors with resolved path, PATH dirs, and platform info
 * - Logs the full command being attempted before spawning
 */

import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import * as vscode from 'vscode';
import { getLogger, isLoggerInitialized } from '../logging';
import { CodedError } from '../types';

const IS_WINDOWS = process.platform === 'win32';

// ==================== ACTIVE PROCESS REGISTRY ====================

/** Tracks all active CLI child processes so they can be killed on cancel. */
const activeProcesses = new Set<ChildProcess>();

/**
 * Module-level AbortSignal for the current workflow cycle.
 * Set by the panel before starting a cycle, cleared after completion.
 * Spawn functions read this automatically when no explicit signal is provided.
 */
let _workflowSignal: AbortSignal | undefined;

/**
 * Resolve the working directory for a CLI spawn.
 * Uses explicit option → VS Code workspace → REJECT (no process.cwd() fallback).
 * Throws CodedError if no workspace is available — prevents CLI agents from
 * running in the VS Code installation directory.
 */
export function resolveWorkingDirectory(explicit?: string): string {
	if (explicit) { return explicit; }
	const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (wsFolder) { return wsFolder; }
	throw new CodedError(
		'NO_WORKSPACE',
		'No workspace folder is open. JanumiCode requires an open workspace to run CLI agents. ' +
		'Open a folder or workspace first (File → Open Folder).',
	);
}

/** Set the module-level workflow abort signal. */
export function setWorkflowAbortSignal(signal: AbortSignal | undefined): void {
	_workflowSignal = signal;
}

/** Get the current workflow abort signal. */
export function getWorkflowAbortSignal(): AbortSignal | undefined {
	return _workflowSignal;
}

/**
 * Kill all active CLI child processes.
 * Called when the user cancels/aborts a running workflow.
 * @returns Number of processes that were sent kill signals.
 */
export function killAllActiveProcesses(): number {
	let killed = 0;
	for (const proc of activeProcesses) {
		try {
			if (IS_WINDOWS && proc.pid) {
				// On Windows with shell:true, proc.kill() may not reach the child tree.
				// Use taskkill /T /F to kill the entire process tree.
				spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { shell: true });
			} else {
				proc.kill('SIGTERM');
			}
			killed++;
		} catch { /* process may already be dead */ }
	}
	activeProcesses.clear();
	return killed;
}

/** Get count of currently active CLI processes. */
export function getActiveProcessCount(): number {
	return activeProcesses.size;
}

/**
 * Wire an AbortSignal to kill a child process.
 * Returns an unsubscribe function to call on process close/error.
 */
function wireAbortSignal(proc: ChildProcess, signal?: AbortSignal): () => void {
	if (!signal) {return () => {};}
	const onAbort = () => {
		try {
			if (IS_WINDOWS && proc.pid) {
				spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { shell: true });
			} else {
				proc.kill('SIGTERM');
			}
		} catch { /* process may already be dead */ }
	};
	signal.addEventListener('abort', onAbort, { once: true });
	return () => signal.removeEventListener('abort', onAbort);
}

/**
 * Build spawn options with Windows compatibility.
 * On Windows, `shell: true` is required so that Node can resolve
 * `.cmd` / `.bat` wrappers created by npm/npx.
 */
function buildSpawnOptions(cwd: string, timeout: number): SpawnOptions {
	return {
		cwd,
		stdio: ['pipe', 'pipe', 'pipe'] as const,
		timeout,
		...(IS_WINDOWS ? { shell: true } : {}),
	};
}

/**
 * Enrich a spawn error with diagnostic context.
 * Turns the opaque "spawn gemini ENOENT" into an actionable message.
 */
function enrichSpawnError(error: Error, command: string, cwd: string): Error {
	const isEnoent = (error as NodeJS.ErrnoException).code === 'ENOENT'
		|| error.message.includes('ENOENT');

	if (!isEnoent) {
		return error;
	}

	const pathDirs = (process.env.PATH || process.env.Path || '')
		.split(IS_WINDOWS ? ';' : ':')
		.filter(Boolean);

	const diagnostic = [
		`CLI binary not found: "${command}"`,
		``,
		`Platform: ${process.platform} (${process.arch})`,
		`Working directory: ${cwd}`,
		`Shell mode: ${IS_WINDOWS ? 'enabled (Windows)' : 'disabled'}`,
		`PATH directories searched (${pathDirs.length}):`,
		...pathDirs.slice(0, 15).map((d) => `  • ${d}`),
		...(pathDirs.length > 15 ? [`  ... and ${pathDirs.length - 15} more`] : []),
		``,
		`Troubleshooting:`,
		`  1. Verify the CLI is installed: run "${command} --version" in your terminal`,
		`  2. If installed via npm, ensure the npm global bin directory is in your PATH`,
		`  3. On Windows, you may need to restart VS Code after installing CLI tools`,
		`  4. You can set a custom path in Settings: janumicode.cli.providers.<provider>.path`,
	].join('\n');

	const enriched = new Error(diagnostic);
	enriched.name = 'CLINotFoundError';
	(enriched as NodeJS.ErrnoException).code = 'ENOENT';

	// Log full diagnostic for the output channel
	if (isLoggerInitialized()) {
		getLogger().child({ component: 'cli-spawn' }).error(diagnostic, {
			command,
			cwd,
			platform: process.platform,
			pathDirCount: pathDirs.length,
		});
	}

	return enriched;
}

/**
 * Spawn a CLI process with stdin piping and collect all output.
 * Windows-compatible: uses shell mode so .cmd/.bat wrappers are resolved.
 */
export function spawnCLIWithStdin(
	command: string,
	args: string[],
	cwd: string,
	timeout: number,
	stdinContent: string,
	signal?: AbortSignal,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	if (isLoggerInitialized()) {
		getLogger().child({ component: 'cli-spawn' }).debug('Spawning CLI process', {
			command,
			args: args.join(' '),
			cwd,
			timeout,
			stdinLength: stdinContent.length,
		});
	}

	return new Promise((resolve, reject) => {
		const effectiveSignal = signal ?? _workflowSignal;
		if (effectiveSignal?.aborted) {
			return reject(new Error('Aborted'));
		}

		const opts = buildSpawnOptions(cwd, timeout);
		const proc = spawn(command, args, opts);
		activeProcesses.add(proc);
		const unwireAbort = wireAbortSignal(proc, effectiveSignal);

		const stdoutChunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];

		proc.stdout!.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
		proc.stderr!.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

		proc.on('close', (code) => {
			unwireAbort();
			activeProcesses.delete(proc);
			const stdout = Buffer.concat(stdoutChunks).toString('utf-8').trim();
			const stderr = Buffer.concat(stderrChunks).toString('utf-8').trim();

			if (isLoggerInitialized()) {
				getLogger().child({ component: 'cli-spawn' }).debug('CLI process exited', {
					command,
					exitCode: code ?? 1,
					stdoutLength: stdout.length,
					stderrLength: stderr.length,
				});
			}

			resolve({ stdout, stderr, exitCode: code ?? 1 });
		});

		proc.on('error', (err) => {
			unwireAbort();
			activeProcesses.delete(proc);
			reject(enrichSpawnError(err, command, cwd));
		});

		// Swallow EPIPE errors on stdin — if the child exits before we finish
		// writing, the EPIPE would otherwise crash the extension host as an
		// unhandled error. The process exit/close handler will surface the failure.
		proc.stdin!.on('error', () => {});
		proc.stdin!.write(stdinContent);
		proc.stdin!.end();
	});
}

/**
 * Spawn a CLI process with stdin piping and stream stdout line-by-line.
 * Windows-compatible: uses shell mode so .cmd/.bat wrappers are resolved.
 */
export function spawnCLIStreamingWithStdin(
	command: string,
	args: string[],
	cwd: string,
	timeout: number,
	stdinContent: string,
	onLine: (line: string) => void,
	signal?: AbortSignal,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	if (isLoggerInitialized()) {
		getLogger().child({ component: 'cli-spawn' }).debug('Spawning streaming CLI process', {
			command,
			args: args.join(' '),
			cwd,
			timeout,
		});
	}

	return new Promise((resolve, reject) => {
		const effectiveSignal = signal ?? _workflowSignal;
		if (effectiveSignal?.aborted) {
			return reject(new Error('Aborted'));
		}

		if (isLoggerInitialized()) {
			getLogger().child({ component: 'cliSpawn' }).debug('Spawning streaming CLI process (pre-spawn)', {
				command,
				args: args.join(' '),
				cwd,
				timeout,
				stdinLength: stdinContent.length,
			});
		}

		const opts = buildSpawnOptions(cwd, timeout);
		const proc = spawn(command, args, opts);
		activeProcesses.add(proc);
		const unwireAbort = wireAbortSignal(proc, effectiveSignal);

		const stderrChunks: Buffer[] = [];
		let fullStdout = '';
		let lineBuffer = '';

		proc.stdout!.on('data', (chunk: Buffer) => {
			const text = chunk.toString('utf-8');
			fullStdout += text;

			lineBuffer += text;
			const lines = lineBuffer.split('\n');
			lineBuffer = lines.pop() || '';
			for (const line of lines) {
				const trimmed = line.trim();
				if (trimmed) {
					onLine(trimmed);
				}
			}
		});

		proc.stderr!.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

		proc.on('close', (code) => {
			unwireAbort();
			activeProcesses.delete(proc);
			if (lineBuffer.trim()) {
				onLine(lineBuffer.trim());
			}
			resolve({
				stdout: fullStdout.trim(),
				stderr: Buffer.concat(stderrChunks).toString('utf-8').trim(),
				exitCode: code ?? 1,
			});
		});

		proc.on('error', (err) => {
			unwireAbort();
			activeProcesses.delete(proc);
			reject(enrichSpawnError(err, command, cwd));
		});

		// Swallow EPIPE on stdin (child may exit before write completes)
		proc.stdin!.on('error', () => {});
		proc.stdin!.write(stdinContent);
		proc.stdin!.end();
	});
}
