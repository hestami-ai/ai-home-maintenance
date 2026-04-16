/**
 * CLI integration smoke tests.
 *
 * Spawns the built CLI (`dist/cli/janumicode.js`) as a child process and
 * asserts the three properties the virtuous-cycle loop depends on:
 *
 *   1. `--json` produces a parseable HarnessResult on stdout with no
 *      logger lines mixed in, so a coding agent can read it via stdout
 *      alone.
 *   2. Exit codes map predictably:
 *         0 = success, 1 = partial/failed, 2 = exception, 4 = bootstrap.
 *   3. The gap report carries `failed_at_phase` / `failed_at_sub_phase`
 *      so machine consumers can `.failed_at_phase` directly instead of
 *      inferring it from nested arrays.
 *
 * The tests are marked `.skipIf` when the built CLI isn't present so
 * `pnpm test` still works on a clean checkout — the signal here is
 * "run after build", and CI typically runs build first.
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const CLI_PATH = path.join(REPO_ROOT, 'dist', 'cli', 'janumicode.js');
const HESTAMI_FIXTURE_DIR = path.join(
  REPO_ROOT,
  'src',
  'test',
  'fixtures',
  'hestami-product-description',
);
const WORKSPACE = path.join(REPO_ROOT, 'test-workspace');

const cliBuilt = fs.existsSync(CLI_PATH);
const hestamiFixturesPresent = fs.existsSync(HESTAMI_FIXTURE_DIR);
const workspacePresent = fs.existsSync(WORKSPACE);

function runCli(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync('node', [CLI_PATH, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 120_000,
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? -1,
  };
}

describe.skipIf(!cliBuilt)('CLI smoke — bootstrap errors', () => {
  it('exits 4 with JSON error envelope when --workspace does not exist', () => {
    const { stdout, stderr, exitCode } = runCli([
      'run',
      '--intent', 'anything',
      '--workspace', path.join(REPO_ROOT, '__definitely_not_here__'),
      '--llm-mode', 'mock',
      '--json',
    ]);
    expect(exitCode).toBe(4);
    // JSON envelope goes to stderr so stdout can carry the (absent)
    // HarnessResult without contamination. Consumers reading stderr
    // on a non-zero exit should always get a parseable object.
    const parsed = JSON.parse(stderr.trim()) as { error_type: string; message: string };
    expect(parsed.error_type).toBe('bootstrap_error');
    expect(parsed.message).toMatch(/Workspace path does not exist/);
    expect(stdout).toBe('');
  });

  it('exits 4 when --resume-from-db points at a missing file', () => {
    const { stderr, exitCode } = runCli([
      'run',
      '--intent', 'anything',
      '--workspace', REPO_ROOT,
      '--llm-mode', 'mock',
      '--resume-from-db', path.join(REPO_ROOT, '__missing_db__.db'),
      '--resume-at-phase', '2',
      '--json',
    ]);
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stderr.trim()) as { error_type: string; message: string };
    expect(parsed.error_type).toBe('bootstrap_error');
    expect(parsed.message).toMatch(/Resume DB does not exist/);
  });

  it('exits 4 when --decision-overrides is not valid JSON', () => {
    const { stderr, exitCode } = runCli([
      'run',
      '--intent', 'anything',
      '--workspace', REPO_ROOT,
      '--llm-mode', 'mock',
      '--decision-overrides', '{not:valid',
      '--json',
    ]);
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stderr.trim()) as { error_type: string; message: string };
    expect(parsed.error_type).toBe('bootstrap_error');
    expect(parsed.message).toMatch(/Invalid --decision-overrides/);
  });
});

describe.skipIf(!cliBuilt || !hestamiFixturesPresent || !workspacePresent)(
  'CLI smoke — success path with Hestami fixtures',
  () => {
    it('emits clean parseable JSON on stdout with --json, logs to stderr', () => {
      const { stdout, stderr, exitCode } = runCli([
        'run',
        '--intent', 'Review "specs/hestami-ai-real-property-os(2)/Hestami AI Real Property OS and Platform Product Description.md" and prepare for implementation.',
        '--workspace', WORKSPACE,
        '--llm-mode', 'mock',
        '--auto-approve',
        '--phase-limit', '1',
        '--fixture-dir', HESTAMI_FIXTURE_DIR,
        '--json',
      ]);

      // `--phase-limit 1` never reaches Phase 10 so status is "partial"
      // even though Phases 0 + 1 fully succeeded. Exit 1 is the
      // virtuous-cycle "gap found, fix, rerun" signal.
      expect(exitCode).toBe(1);

      // stdout must be parseable JSON with no logger lines mixed in.
      // If this ever breaks, the logging handler regressed and the
      // coding agent's stdout parser will choke.
      expect(stdout.length).toBeGreaterThan(0);
      const result = JSON.parse(stdout) as {
        status: string;
        phasesCompleted: string[];
        gapReport?: { failed_at_phase?: string };
      };
      expect(result.status).toBe('partial');
      expect(result.phasesCompleted).toContain('0');
      expect(result.phasesCompleted).toContain('1');
      expect(result.gapReport?.failed_at_phase).toBeDefined();

      // Logger should have written at least something to stderr during
      // the run — if it didn't, the handler routing broke.
      expect(stderr).toMatch(/workflow/i);
    });

    it('writes the gap report file when --gap-report is passed', () => {
      const gapPath = path.join(
        WORKSPACE,
        '.janumicode',
        'test-harness',
        `smoke-gap-${Date.now()}.json`,
      );
      const { exitCode } = runCli([
        'run',
        '--intent', 'Review "specs/hestami-ai-real-property-os(2)/Hestami AI Real Property OS and Platform Product Description.md" and prepare for implementation.',
        '--workspace', WORKSPACE,
        '--llm-mode', 'mock',
        '--auto-approve',
        '--phase-limit', '1',
        '--fixture-dir', HESTAMI_FIXTURE_DIR,
        '--gap-report', gapPath,
      ]);
      expect(exitCode).toBe(1);
      expect(fs.existsSync(gapPath)).toBe(true);
      const gap = JSON.parse(fs.readFileSync(gapPath, 'utf8')) as {
        failed_at_phase: string;
        phase: string;
      };
      expect(gap.failed_at_phase).toBeDefined();
      // Legacy `phase` pointer stays aligned with the new explicit one.
      expect(gap.phase).toBe(gap.failed_at_phase);
      fs.unlinkSync(gapPath);
    });
  },
);
