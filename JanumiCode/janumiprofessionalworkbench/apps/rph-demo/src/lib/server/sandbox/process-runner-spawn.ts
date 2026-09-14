// SPIKE (spike/tool-execution) — the HOST's real ProcessRunner: `spawn` with a timeout.
//
// ⛔ NO SHELL. `shell: false` is the default and it is load-bearing: with a shell, `argv` stops being a vector
// and becomes a string the model can inject into, and the containment the workspace enforces on PATHS would be
// bypassed by a redirect. The model names a program and its arguments; nothing interprets metacharacters.
//
// ⚠ THE KILL IS OBSERVED, NOT INFERRED. `child_process` reports `signal` when it terminated the process for
// the timeout, so `timedOut` is a fact rather than a guess made from an exit code — §36.2 separates TIMEOUT
// from TOOL_FAILURE and a caller mapping to that taxonomy needs the two told apart.
import { spawn } from 'node:child_process';
import type { ProcessRunOutcome, ProcessRunRequest, ProcessRunner } from '@janumipwb/rph-ports';

/** Cap on captured output, so a runaway producer cannot exhaust the host's memory through a step's record. */
const MAX_CAPTURE_BYTES = 64 * 1024;

export function createSpawnProcessRunner(): ProcessRunner {
	return {
		kind: 'REAL',
		run(request: ProcessRunRequest): Promise<ProcessRunOutcome> {
			const [program, ...args] = request.argv;
			if (!program)
				return Promise.resolve({
					ran: false,
					refusedBecause: 'argv was empty, so no program was named and nothing was run.'
				});
			const startedAt = Date.now();
			return new Promise<ProcessRunOutcome>((resolvePromise) => {
				let stdout = '';
				let stderr = '';
				let settled = false;
				const finish = (outcome: ProcessRunOutcome): void => {
					if (settled) return;
					settled = true;
					resolvePromise(outcome);
				};
				let child;
				try {
					child = spawn(program, args, {
						cwd: request.cwd,
						timeout: request.timeoutMs,
						killSignal: 'SIGKILL',
						shell: false,
						windowsHide: true
					});
				} catch (e) {
					finish({
						ran: false,
						refusedBecause: `The process could not be started: ${e instanceof Error ? e.message : String(e)}`
					});
					return;
				}
				child.stdout?.on('data', (d: Buffer) => {
					if (stdout.length < MAX_CAPTURE_BYTES) stdout += d.toString('utf8');
				});
				child.stderr?.on('data', (d: Buffer) => {
					if (stderr.length < MAX_CAPTURE_BYTES) stderr += d.toString('utf8');
				});
				// ⚠ A SPAWN FAILURE IS `error`, NOT A THROW. An ENOENT for a program that is not installed
				// arrives asynchronously; treating it as "ran with a bad exit code" would record a tool failure
				// where the truth is that the tool was never there.
				child.on('error', (e: Error) => {
					finish({ ran: false, refusedBecause: `The process could not be started: ${e.message}` });
				});
				child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
					finish({
						ran: true,
						exitCode: code,
						timedOut: signal !== null && code === null,
						stdout: stdout.slice(0, MAX_CAPTURE_BYTES),
						stderr: stderr.slice(0, MAX_CAPTURE_BYTES),
						durationMs: Date.now() - startedAt
					});
				});
			});
		}
	};
}
