/**
 * Characterization test for the CLI runner's DB-path resolver, extracted
 * from runPipeline during the S3776 cognitive-complexity decomposition.
 * Pins the observable behavior of every branch so the extraction is
 * provably behavior-preserving:
 *
 *   - resumeFromDb  → copy the source DB to a fresh `resume-*.db` under the
 *                     harness dir, copy any -wal/-shm siblings that exist,
 *                     and return the copy's path.
 *   - dbPath (abs)  → return the explicit absolute path unchanged.
 *   - dbPath (rel)  → join it onto the harness dir.
 *   - neither       → mint a fresh `<timestamp>.db` under the harness dir.
 *   - resumeFromDb takes precedence over dbPath.
 *
 * `fs` is injected so the test never touches disk (mirrors the
 * detectAndConsumePauseFlag pattern in pauseFlag.test.ts).
 */

import { describe, it, expect, vi } from 'vitest';
import * as path from 'node:path';
import { resolveRunDbPath } from '../../../cli/runner';
import type { PipelineRunnerConfig } from '../../harness/types';

function makeConfig(partial: Partial<PipelineRunnerConfig>): PipelineRunnerConfig {
  return {
    workspacePath: '/ws',
    llmMode: 'mock',
    autoApprove: true,
    ...partial,
  } as PipelineRunnerConfig;
}

function makeFsStub(present: Set<string>) {
  const copyCalls: Array<{ src: string; dest: string }> = [];
  const existsCalls: string[] = [];
  return {
    copyCalls,
    existsCalls,
    fs: {
      copyFileSync: vi.fn((src: string, dest: string) => {
        copyCalls.push({ src, dest });
      }) as unknown as typeof import('node:fs').copyFileSync,
      existsSync: vi.fn((p: string) => {
        existsCalls.push(p);
        return present.has(p);
      }) as unknown as typeof import('node:fs').existsSync,
    },
  };
}

describe('resolveRunDbPath (characterization)', () => {
  const dbDir = path.join('/tmp', 'jc-harness');

  it('returns an explicit ABSOLUTE dbPath unchanged (no fs access)', () => {
    const abs = path.resolve('/data/explicit.db');
    const stub = makeFsStub(new Set());
    const out = resolveRunDbPath(makeConfig({ dbPath: abs }), dbDir, stub.fs);
    expect(out).toBe(abs);
    expect(stub.copyCalls).toHaveLength(0);
    expect(stub.existsCalls).toHaveLength(0);
  });

  it('joins a RELATIVE dbPath onto the harness dir', () => {
    const stub = makeFsStub(new Set());
    const out = resolveRunDbPath(makeConfig({ dbPath: 'sub/explicit.db' }), dbDir, stub.fs);
    expect(out).toBe(path.join(dbDir, 'sub/explicit.db'));
    expect(stub.copyCalls).toHaveLength(0);
  });

  it('mints a fresh <timestamp>.db under the harness dir when neither flag is set', () => {
    const stub = makeFsStub(new Set());
    const out = resolveRunDbPath(makeConfig({}), dbDir, stub.fs);
    expect(path.dirname(out)).toBe(dbDir);
    expect(path.basename(out)).toMatch(/^\d+\.db$/);
    expect(stub.copyCalls).toHaveLength(0);
  });

  it('copies ONLY the main DB when no -wal/-shm siblings exist', () => {
    const stub = makeFsStub(new Set());
    const out = resolveRunDbPath(makeConfig({ resumeFromDb: '/prior/run.db' }), dbDir, stub.fs);

    expect(path.dirname(out)).toBe(dbDir);
    expect(path.basename(out)).toMatch(/^resume-\d+\.db$/);
    // Main DB copied to the resolved path.
    expect(stub.copyCalls).toEqual([{ src: '/prior/run.db', dest: out }]);
    // Both sibling existence checks probed the SOURCE's -wal/-shm files.
    expect(stub.existsCalls).toContain('/prior/run.db-wal');
    expect(stub.existsCalls).toContain('/prior/run.db-shm');
  });

  it('also copies -wal and -shm siblings when they exist', () => {
    const stub = makeFsStub(new Set(['/prior/run.db-wal', '/prior/run.db-shm']));
    const out = resolveRunDbPath(makeConfig({ resumeFromDb: '/prior/run.db' }), dbDir, stub.fs);

    expect(stub.copyCalls).toHaveLength(3);
    expect(stub.copyCalls[0]).toEqual({ src: '/prior/run.db', dest: out });
    expect(stub.copyCalls).toContainEqual({ src: '/prior/run.db-wal', dest: out + '-wal' });
    expect(stub.copyCalls).toContainEqual({ src: '/prior/run.db-shm', dest: out + '-shm' });
  });

  it('gives resumeFromDb precedence over dbPath', () => {
    const stub = makeFsStub(new Set());
    const out = resolveRunDbPath(
      makeConfig({ resumeFromDb: '/prior/run.db', dbPath: path.resolve('/data/explicit.db') }),
      dbDir,
      stub.fs,
    );
    // Resume branch wins: a copy under the harness dir, not the explicit path.
    expect(path.basename(out)).toMatch(/^resume-\d+\.db$/);
    expect(stub.copyCalls[0]).toEqual({ src: '/prior/run.db', dest: out });
  });
});
