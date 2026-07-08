/**
 * Import-resolution / type validation of the GENERATED workspace.
 *
 * Runs `tsc --noEmit` against the generated codebase so the broken-import
 * class (the slice-127 six-ways-to-import-ClickStat, most non-resolving) is
 * actually surfaced. Bounded, non-fatal, report-only — the result is recorded
 * as advisory consistency findings, never blocks (per the detect+report
 * decision). Modeled on `installDependencies` in scaffoldSynthesis.ts.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getLogger } from '../../logging';

export interface TscValidationResult {
  /** Whether tsc was actually invoked (false = no binary found / no tsconfig). */
  ran: boolean;
  /** True when tsc exited 0 (or did not run). */
  passed: boolean;
  /** Parsed `Found N errors` count (0 when it passed or didn't run). */
  errorCount: number;
  /** First slice of tsc output for the report. */
  errorExcerpt: string;
}

function resolveTscCommand(workspacePath: string): { cmd: string; args: string[] } | null {
  const local = path.join(workspacePath, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
  if (fs.existsSync(local)) return { cmd: local, args: [] };
  // npx fallback — resolves a global/cached tsc; --no-install avoids a network fetch.
  return { cmd: 'npx', args: ['--no-install', 'tsc'] };
}

/** Parse the `Found N error(s)` line tsc prints; fall back to 0. */
function parseErrorCount(out: string): number {
  const m = out.match(/Found (\d+) errors?/);
  if (m) return Number.parseInt(m[1], 10);
  // No summary line — count "error TSxxxx" occurrences.
  const matches = out.match(/error TS\d+/g);
  return matches ? matches.length : 0;
}

export function runTscNoEmit(workspacePath: string, timeoutMs = 90_000): TscValidationResult {
  if (!fs.existsSync(path.join(workspacePath, 'tsconfig.json'))) {
    return { ran: false, passed: true, errorCount: 0, errorExcerpt: '' };
  }
  const resolved = resolveTscCommand(workspacePath);
  if (!resolved) return { ran: false, passed: true, errorCount: 0, errorExcerpt: '' };

  const started = Date.now();
  try {
    const res = spawnSync(resolved.cmd, [...resolved.args, '--noEmit', '--pretty', 'false'], {
      cwd: workspacePath,
      shell: process.platform === 'win32',
      windowsHide: true,
      timeout: timeoutMs,
      encoding: 'utf-8',
    });
    const out = `${res.stdout ?? ''}\n${res.stderr ?? ''}`;
    // spawnSync error (binary missing) → treat as "did not run", non-fatal.
    if (res.error) {
      getLogger().info('workflow', 'tscValidator: tsc not runnable — skipping', {
        error: res.error.message,
      });
      return { ran: false, passed: true, errorCount: 0, errorExcerpt: '' };
    }
    const errorCount = res.status === 0 ? 0 : parseErrorCount(out);
    const passed = res.status === 0;
    getLogger().info('workflow', 'tscValidator: tsc --noEmit complete', {
      passed, error_count: errorCount, duration_ms: Date.now() - started,
    });
    return { ran: true, passed, errorCount, errorExcerpt: out.slice(0, 2000) };
  } catch (err) {
    getLogger().warn('workflow', 'tscValidator: tsc threw (non-fatal)', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { ran: false, passed: true, errorCount: 0, errorExcerpt: '' };
  }
}
