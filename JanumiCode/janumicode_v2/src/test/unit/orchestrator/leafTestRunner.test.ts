/**
 * Characterization tests for the per-leaf test runner.
 *
 * Pins the CURRENT observable behavior of:
 *   - `parseTestCounts` across each recognized runner-output format
 *     (vitest / jest-style / node:test / pytest, incl. the pytest
 *     "banner matched but zero counts" fall-through). The cargo path and the
 *     no-match fallback are already covered in packetBuilder.test.ts.
 *   - `LeafTestRunner.resolveCommand` (private) command resolution across the
 *     explicit / package.json / framework-autodetect strategies.
 *
 * Added while decomposing both functions to reduce cognitive complexity; the
 * assertions are derived from the pre-refactor logic so they guard behavior.
 */
import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  LeafTestRunner,
  parseTestCounts,
  type LeafTestRunInput,
  type LeafTestRunnerConfig,
} from '../../../lib/orchestrator/leafTestRunner';
import type { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';

describe('parseTestCounts — runner output formats', () => {
  it('parses a vitest summary line (passed/failed/skipped)', () => {
    const stdout = 'Test Files  1 passed (1)\n     Tests  4 failed | 10 passed | 2 skipped (16)\n';
    expect(parseTestCounts(stdout, '')).toEqual({ passed: 10, failed: 4, skipped: 2 });
  });

  it('parses a vitest all-passed line (missing failed/skipped default to 0)', () => {
    expect(parseTestCounts('Tests  5 passed (5)', '')).toEqual({ passed: 5, failed: 0, skipped: 0 });
  });

  it('parses a jest-style summary line', () => {
    const stdout = 'Tests:       2 failed, 1 skipped, 7 passed, 10 total';
    expect(parseTestCounts(stdout, '')).toEqual({ passed: 7, failed: 2, skipped: 1 });
  });

  it('parses node:test tap-style counters', () => {
    const stdout = ['# tests 6', '# pass 3', '# fail 1', '# skipped 2'].join('\n');
    expect(parseTestCounts(stdout, '')).toEqual({ passed: 3, failed: 1, skipped: 2 });
  });

  it('parses a pytest banner (failed/passed/skipped)', () => {
    const stdout = '===== 1 failed, 2 passed, 3 skipped in 0.12s =====';
    expect(parseTestCounts(stdout, '')).toEqual({ passed: 2, failed: 1, skipped: 3 });
  });

  it('parses a pytest all-passed banner', () => {
    expect(parseTestCounts('==== 5 passed in 0.30s ====', '')).toEqual({ passed: 5, failed: 0, skipped: 0 });
  });

  it('falls through to zeros when a pytest banner has no counts', () => {
    // Banner matches but contributes no counts (sum === 0) — the runner does
    // NOT report from it and drops to the final zero fallback.
    expect(parseTestCounts('===== no tests ran in 0.01s =====', '')).toEqual({ passed: 0, failed: 0, skipped: 0 });
  });

  it('reads from stderr as well as stdout', () => {
    expect(parseTestCounts('', 'Tests  3 passed (3)')).toEqual({ passed: 3, failed: 0, skipped: 0 });
  });
});

describe('LeafTestRunner.resolveCommand — command resolution', () => {
  const writerStub = { writeRecord: () => {} } as unknown as GovernedStreamWriter;
  const tmpDirs: string[] = [];

  afterEach(() => {
    while (tmpDirs.length > 0) {
      const dir = tmpDirs.pop();
      if (dir) fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  const mkTmp = (): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leaf-test-runner-'));
    tmpDirs.push(dir);
    return dir;
  };

  const config = (resolution: LeafTestRunnerConfig['resolution']): LeafTestRunnerConfig => ({
    enabled: true,
    resolution,
    timeoutMs: 1000,
  });

  const baseInput = (workspacePath: string): LeafTestRunInput => ({
    leafTaskId: 'leaf-1',
    attemptNumber: 1,
    waveNumber: 1,
    workflowRunId: 'wf-1',
    janumiCodeVersionSha: 'sha',
    workspacePath,
    writeDirectoryPaths: [],
  });

  const resolve = (
    runner: LeafTestRunner,
    input: LeafTestRunInput,
  ): { executable: string; args: string[] } | null =>
    (runner as unknown as {
      resolveCommand: (i: LeafTestRunInput) => { executable: string; args: string[] } | null;
    }).resolveCommand(input);

  it('splits an explicit per-leaf command into executable + args', () => {
    const runner = new LeafTestRunner(writerStub, config('explicit_per_leaf'));
    const out = resolve(runner, { ...baseInput('/nonexistent'), explicitCommand: 'jest --run foo' });
    expect(out).toEqual({ executable: 'jest', args: ['--run', 'foo'] });
  });

  it('returns null for explicit_per_leaf with no explicit command', () => {
    const runner = new LeafTestRunner(writerStub, config('explicit_per_leaf'));
    expect(resolve(runner, baseInput('/nonexistent'))).toBeNull();
  });

  it('resolves npm test from package.json scripts.test', () => {
    const ws = mkTmp();
    fs.writeFileSync(path.join(ws, 'package.json'), JSON.stringify({ scripts: { test: 'vitest' } }));
    const runner = new LeafTestRunner(writerStub, config('package_json_scripts'));
    const out = resolve(runner, baseInput(ws));
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    expect(out).toEqual({ executable: npm, args: ['test', '--silent'] });
  });

  it('scopes npm test to existing write directories', () => {
    const ws = mkTmp();
    fs.writeFileSync(path.join(ws, 'package.json'), JSON.stringify({ scripts: { test: 'vitest' } }));
    fs.mkdirSync(path.join(ws, 'src'));
    const runner = new LeafTestRunner(writerStub, config('package_json_scripts'));
    const out = resolve(runner, { ...baseInput(ws), writeDirectoryPaths: ['src'] });
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    expect(out).toEqual({ executable: npm, args: ['test', '--silent', '--', 'src'] });
  });

  it('prefers own test files over write directories when scoping', () => {
    const ws = mkTmp();
    fs.writeFileSync(path.join(ws, 'package.json'), JSON.stringify({ scripts: { test: 'vitest' } }));
    fs.mkdirSync(path.join(ws, 'src'));
    fs.writeFileSync(path.join(ws, 'src', 'foo.test.ts'), '');
    const runner = new LeafTestRunner(writerStub, config('package_json_scripts'));
    const out = resolve(runner, {
      ...baseInput(ws),
      writeDirectoryPaths: ['src'],
      ownTestFiles: ['src/foo.test.ts'],
    });
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    expect(out).toEqual({ executable: npm, args: ['test', '--silent', '--', 'src/foo.test.ts'] });
  });

  it('returns null when package_json_scripts finds no package.json', () => {
    const ws = mkTmp();
    const runner = new LeafTestRunner(writerStub, config('package_json_scripts'));
    expect(resolve(runner, baseInput(ws))).toBeNull();
  });

  it('autodetects pytest from pyproject.toml when no package.json exists', () => {
    const ws = mkTmp();
    fs.writeFileSync(path.join(ws, 'pyproject.toml'), '[project]\nname = "x"\n');
    const runner = new LeafTestRunner(writerStub, config('framework_autodetect'));
    expect(resolve(runner, baseInput(ws))).toEqual({ executable: 'pytest', args: ['-q'] });
  });

  it('autodetects cargo from Cargo.toml', () => {
    const ws = mkTmp();
    fs.writeFileSync(path.join(ws, 'Cargo.toml'), '[package]\nname = "x"\n');
    const runner = new LeafTestRunner(writerStub, config('framework_autodetect'));
    expect(resolve(runner, baseInput(ws))).toEqual({ executable: 'cargo', args: ['test', '--quiet'] });
  });

  it('autodetects go from go.mod', () => {
    const ws = mkTmp();
    fs.writeFileSync(path.join(ws, 'go.mod'), 'module x\n');
    const runner = new LeafTestRunner(writerStub, config('framework_autodetect'));
    expect(resolve(runner, baseInput(ws))).toEqual({ executable: 'go', args: ['test', './...'] });
  });
});
