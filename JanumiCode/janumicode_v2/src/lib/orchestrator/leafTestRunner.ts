/**
 * Wave R — per-leaf test runner.
 *
 * Run after each successful executor invocation. Resolves a test command
 * from `package.json` / `pyproject.toml` / explicit override, runs it
 * (scoped to the leaf's write directories where possible), parses
 * pass/fail counts from output, and returns a structured result the
 * scheduler folds into its retry decision.
 *
 * Distinct from `testRunner.ts` (the wave-aggregate reporter). This
 * runner answers "did the executor's writes for THIS leaf hold up?"
 * during the per-leaf retry loop.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getLogger } from '../logging';
import type { GovernedStreamWriter } from './governedStreamWriter';
import type { TaskTestResultContent } from '../types/records';

export interface LeafTestRunInput {
  leafTaskId: string;
  attemptNumber: number;
  waveNumber: number;
  workflowRunId: string;
  janumiCodeVersionSha: string;
  workspacePath: string;
  /** Leaf's `write_directory_paths` — used to scope tests when supported. */
  writeDirectoryPaths: string[];
  /** Optional explicit per-leaf test command. */
  explicitCommand?: string;
}

export interface LeafTestRunResult {
  passed: boolean;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  exitCode: number | null;
  durationMs: number;
  stdoutExcerpt?: string;
  stderrExcerpt?: string;
  resolvedCommand?: string;
  skippedReason?: string;
}

export type TestCommandResolution =
  | 'package_json_scripts'
  | 'explicit_per_leaf'
  | 'framework_autodetect';

export interface LeafTestRunnerConfig {
  enabled: boolean;
  resolution: TestCommandResolution;
  timeoutMs: number;
}

export class LeafTestRunner {
  constructor(
    private readonly writer: GovernedStreamWriter,
    private readonly config: LeafTestRunnerConfig,
  ) {}

  async run(input: LeafTestRunInput): Promise<LeafTestRunResult> {
    if (!this.config.enabled) {
      const result = this.skippedResult('tests_per_leaf disabled in config');
      this.recordResult(input, result);
      return result;
    }
    const cmd = this.resolveCommand(input);
    if (!cmd) {
      const result = this.skippedResult('no test command resolved');
      this.recordResult(input, result);
      return result;
    }
    const startedAt = Date.now();
    let exitCode: number | null = null;
    let stdout = '';
    let stderr = '';
    try {
      const proc = spawnSync(cmd.executable, cmd.args, {
        cwd: input.workspacePath,
        timeout: this.config.timeoutMs,
        encoding: 'utf-8',
        shell: false,
        env: { ...process.env, CI: '1' },
      });
      exitCode = typeof proc.status === 'number' ? proc.status : null;
      stdout = proc.stdout ?? '';
      stderr = proc.stderr ?? '';
      if (proc.error) {
        stderr += `\n${proc.error.message}`;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      stderr = msg;
    }
    const durationMs = Date.now() - startedAt;
    const counts = parseTestCounts(stdout, stderr);
    const passed = (exitCode === 0)
      && counts.failed === 0
      && (counts.passed > 0 || counts.skipped > 0 || counts.passed + counts.failed + counts.skipped === 0);
    const result: LeafTestRunResult = {
      passed,
      passedCount: counts.passed,
      failedCount: counts.failed,
      skippedCount: counts.skipped,
      exitCode,
      durationMs,
      stdoutExcerpt: stdout.slice(-4000),
      stderrExcerpt: stderr.slice(-4000),
      resolvedCommand: `${cmd.executable} ${cmd.args.join(' ')}`,
    };
    this.recordResult(input, result);
    return result;
  }

  private skippedResult(reason: string): LeafTestRunResult {
    return {
      passed: true,
      passedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      exitCode: null,
      durationMs: 0,
      skippedReason: reason,
    };
  }

  private resolveCommand(
    input: LeafTestRunInput,
  ): { executable: string; args: string[] } | null {
    if (input.explicitCommand) {
      const parts = splitCommand(input.explicitCommand);
      if (parts.length > 0) {
        return { executable: parts[0], args: parts.slice(1) };
      }
    }
    if (this.config.resolution === 'explicit_per_leaf') return null;
    if (
      this.config.resolution === 'package_json_scripts'
      || this.config.resolution === 'framework_autodetect'
    ) {
      const pkgPath = path.join(input.workspacePath, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
            scripts?: Record<string, string>;
          };
          if (pkg.scripts && pkg.scripts.test) {
            const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
            return { executable: npm, args: ['test', '--silent'] };
          }
        } catch (err) {
          getLogger().warn('workflow', 'leafTestRunner: failed to read package.json', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
    if (this.config.resolution === 'framework_autodetect') {
      const pyprojectPath = path.join(input.workspacePath, 'pyproject.toml');
      if (fs.existsSync(pyprojectPath)) {
        return { executable: 'pytest', args: ['-q'] };
      }
      const cargoPath = path.join(input.workspacePath, 'Cargo.toml');
      if (fs.existsSync(cargoPath)) {
        return { executable: 'cargo', args: ['test', '--quiet'] };
      }
      const goModPath = path.join(input.workspacePath, 'go.mod');
      if (fs.existsSync(goModPath)) {
        return { executable: 'go', args: ['test', './...'] };
      }
    }
    return null;
  }

  private recordResult(input: LeafTestRunInput, result: LeafTestRunResult): void {
    const content: TaskTestResultContent = {
      kind: 'task_test_result',
      leaf_task_id: input.leafTaskId,
      attempt_number: input.attemptNumber,
      wave_number: input.waveNumber,
      test_command: result.resolvedCommand,
      passed_count: result.passedCount,
      failed_count: result.failedCount,
      skipped_count: result.skippedCount,
      exit_code: result.exitCode,
      duration_ms: result.durationMs,
      stdout_excerpt: result.stdoutExcerpt,
      stderr_excerpt: result.stderrExcerpt,
      executed_at: new Date().toISOString(),
      skipped_reason: result.skippedReason,
    };
    this.writer.writeRecord({
      record_type: 'task_test_result',
      schema_version: '1.0',
      workflow_run_id: input.workflowRunId,
      phase_id: '9',
      sub_phase_id: '9.1',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: input.janumiCodeVersionSha,
      derived_from_record_ids: [],
      content: content as unknown as Record<string, unknown>,
    });
  }
}

function splitCommand(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean);
}

/**
 * Parse pass/fail/skip counts from a runner's combined output. Handles
 * vitest, jest, npm-test-text-summary, node:test, mocha, pytest. Best-
 * effort — returns zeros when nothing matches; the caller still gates
 * on exit code.
 */
export function parseTestCounts(stdout: string, stderr: string): {
  passed: number; failed: number; skipped: number;
} {
  const text = `${stdout}\n${stderr}`;
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  const vitestPassFail = /Tests\s+(?:(\d+)\s+failed[^|]*\|\s*)?(\d+)\s+passed(?:\s*\|\s*(\d+)\s+skipped)?/i.exec(text);
  if (vitestPassFail) {
    failed = vitestPassFail[1] ? Number.parseInt(vitestPassFail[1], 10) : 0;
    passed = Number.parseInt(vitestPassFail[2], 10);
    skipped = vitestPassFail[3] ? Number.parseInt(vitestPassFail[3], 10) : 0;
    return { passed, failed, skipped };
  }

  const jestSummary = /Tests:\s+(?:(\d+)\s+failed,\s*)?(?:(\d+)\s+skipped,\s*)?(\d+)\s+passed,\s+\d+\s+total/i.exec(text);
  if (jestSummary) {
    failed = jestSummary[1] ? Number.parseInt(jestSummary[1], 10) : 0;
    skipped = jestSummary[2] ? Number.parseInt(jestSummary[2], 10) : 0;
    passed = Number.parseInt(jestSummary[3], 10);
    return { passed, failed, skipped };
  }

  const nodeTest = /[#ℹ]\s*pass\s+(\d+)/i.exec(text);
  const nodeFail = /[#ℹ]\s*fail\s+(\d+)/i.exec(text);
  const nodeSkip = /[#ℹ]\s*skipped\s+(\d+)/i.exec(text);
  if (nodeTest || nodeFail || nodeSkip) {
    passed = nodeTest ? Number.parseInt(nodeTest[1], 10) : 0;
    failed = nodeFail ? Number.parseInt(nodeFail[1], 10) : 0;
    skipped = nodeSkip ? Number.parseInt(nodeSkip[1], 10) : 0;
    return { passed, failed, skipped };
  }

  const pytest = /=+\s*(?:(\d+)\s+failed,?\s*)?(?:(\d+)\s+passed,?\s*)?(?:(\d+)\s+skipped,?\s*)?[\w\s,.]*=+/i.exec(text);
  if (pytest) {
    failed = pytest[1] ? Number.parseInt(pytest[1], 10) : 0;
    passed = pytest[2] ? Number.parseInt(pytest[2], 10) : 0;
    skipped = pytest[3] ? Number.parseInt(pytest[3], 10) : 0;
    if (passed + failed + skipped > 0) return { passed, failed, skipped };
  }

  return { passed: 0, failed: 0, skipped: 0 };
}
