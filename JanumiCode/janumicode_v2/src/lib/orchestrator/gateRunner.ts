/**
 * GateRunner — execute a {@link GateCommand}[] and report pass/fail + the
 * compact failure evidence a repair agent needs (Stage 0.5 stabilization).
 *
 * Stack-agnostic: it spawns whatever command the gate names. Mirrors
 * leafTestRunner's proven Windows spawn semantics (`shell` on win32 — the
 * CVE-2024-27980 hardening makes `shell:false` throw EINVAL on `.cmd` shims)
 * and its "no tests found ≠ failure" rule.
 */

import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import type { GateCommand } from './gateCommands';
import { parseTestCounts } from './leafTestRunner';

export interface GateResult {
  gate: GateCommand;
  passed: boolean;
  exitCode: number | null;
  durationMs: number;
  stdoutExcerpt: string;
  stderrExcerpt: string;
}

export interface GateRunSummary {
  allPassed: boolean;
  results: GateResult[];
  /** Compact failing-gate evidence (commands + output tails) for a repair agent. */
  failureEvidence: string;
}

export function runGateCommands(workspacePath: string, gates: GateCommand[]): GateRunSummary {
  const results: GateResult[] = [];
  for (const gate of gates) {
    const started = Date.now();
    let exitCode: number | null = null;
    let stdout = '';
    let stderr = '';
    try {
      const proc = spawnSync(gate.command, gate.args, {
        cwd: gate.cwd ? path.join(workspacePath, gate.cwd) : workspacePath,
        timeout: gate.timeoutMs,
        encoding: 'utf-8',
        // win32: shell resolves .cmd/.bat shims (npm, npx, gradle) via PATHEXT;
        // shell:false would EINVAL on them.
        shell: process.platform === 'win32',
        windowsHide: true,
        env: { ...process.env, CI: '1' },
      });
      exitCode = typeof proc.status === 'number' ? proc.status : null;
      stdout = proc.stdout ?? '';
      stderr = proc.stderr ?? '';
      if (proc.error) stderr += `\n${proc.error.message}`;
    } catch (err) {
      stderr = err instanceof Error ? err.message : String(err);
    }
    results.push({
      gate,
      passed: gatePassed(gate, exitCode, stdout, stderr),
      exitCode,
      durationMs: Date.now() - started,
      stdoutExcerpt: stdout.slice(-4000),
      stderrExcerpt: stderr.slice(-4000),
    });
  }
  return {
    allPassed: results.every((r) => r.passed),
    results,
    failureEvidence: buildFailureEvidence(results),
  };
}

function gatePassed(gate: GateCommand, exitCode: number | null, stdout: string, stderr: string): boolean {
  // A scoped test run that found no test files is not a failure (mirrors
  // leafTestRunner) — relevant for `test`-kind gates only.
  if (gate.kind === 'test' && /no test files? (found|matched)/i.test(`${stdout}\n${stderr}`)) {
    return true;
  }
  return exitCode === 0;
}

function buildFailureEvidence(results: GateResult[]): string {
  const failing = results.filter((r) => !r.passed);
  if (failing.length === 0) return '';
  return failing
    .map((r) => {
      const cmd = `${r.gate.command} ${r.gate.args.join(' ')}`.trim();
      const out = (r.stdoutExcerpt + '\n' + r.stderrExcerpt).trim().slice(-1500);
      return `### Gate FAILED: ${r.gate.name} (${r.gate.kind}) — exit ${r.exitCode ?? 'n/a'}\n`
        + `command: ${cmd}\n` + (out ? `output:\n${out}` : '(no output)');
    })
    .join('\n\n');
}
