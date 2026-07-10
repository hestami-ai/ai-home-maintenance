/**
 * Characterization tests for auditPause.ts.
 *
 * These pin the CURRENT observable behavior of auditPauseSync and
 * auditPhaseExitPauseSync (early-return branches, cascade-skip, marker
 * emission, ack resolution + file moves, abort/timeout throws, exact
 * stderr strings) so a behavior-preserving cognitive-complexity refactor
 * can be verified against them.
 *
 * Blocking is avoided two ways:
 *   - timeout paths use ackTimeoutSeconds:0 so the wait loop exits before
 *     the first Atomics.wait.
 *   - resolution paths pre-create the ack file so existsSync short-circuits
 *     the loop on its first iteration. The exact ack basename embeds the
 *     module-global monotonic `seq`; a throwaway "probe" pause reveals the
 *     current seq (read from the marker it writes) so the next call's seq
 *     is known without exporting the counter.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Database } from '../../../lib/database/init';
import {
  configureAuditPause,
  auditPauseSync,
  auditPhaseExitPauseSync,
} from '../../../lib/orchestrator/auditPause';

const countZeroDb = {
  prepare: () => ({ get: () => ({ n: 0 }) }),
} as unknown as Database;

const throwDb = {
  prepare: () => {
    throw new Error('boom');
  },
} as unknown as Database;

describe('auditPause', () => {
  let ws: string;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  const origEnv = process.env.JANUMICODE_AUDIT_PAUSE;

  const pending = () => path.join(ws, '.janumicode', 'audit', 'pending');
  const acks = () => path.join(ws, '.janumicode', 'audit', 'acks');
  const done = () => path.join(ws, '.janumicode', 'audit', 'done');
  const ls = (dir: string): string[] =>
    fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
  const stderr = (): string =>
    stderrSpy.mock.calls.map((c) => String(c[0])).join('');

  /** Run a throwaway timeout pause and return the seq of the marker it wrote. */
  const probeSeq = (): number => {
    configureAuditPause({ workspaceRoot: ws, ackTimeoutSeconds: 0, pollIntervalMs: 5 });
    expect(() =>
      auditPauseSync({
        workflowRunId: 'wf',
        priorPhaseId: '1',
        priorSubPhaseId: 'probe',
        nextSubPhaseId: 'x',
      }),
    ).toThrow(/timed out/);
    const file = ls(pending()).find((f) => f.includes('probe'));
    if (!file) throw new Error('probe marker not found');
    return JSON.parse(fs.readFileSync(path.join(pending(), file), 'utf8')).seq as number;
  };

  beforeEach(() => {
    ws = fs.mkdtempSync(path.join(os.tmpdir(), 'auditpause-'));
    process.env.JANUMICODE_AUDIT_PAUSE = '1';
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    configureAuditPause(null);
    if (origEnv === undefined) delete process.env.JANUMICODE_AUDIT_PAUSE;
    else process.env.JANUMICODE_AUDIT_PAUSE = origEnv;
    fs.rmSync(ws, { recursive: true, force: true });
  });

  it('is a no-op when JANUMICODE_AUDIT_PAUSE != 1', () => {
    process.env.JANUMICODE_AUDIT_PAUSE = '0';
    configureAuditPause({ workspaceRoot: ws });
    expect(() =>
      auditPauseSync({
        workflowRunId: 'wf',
        priorPhaseId: '1',
        priorSubPhaseId: 's',
        nextSubPhaseId: 't',
      }),
    ).not.toThrow();
    expect(fs.existsSync(pending())).toBe(false);
    expect(stderr()).toBe('');
  });

  it('cascade-skips (no marker) when db reports 0 fresh invocations', () => {
    configureAuditPause({ workspaceRoot: ws, db: countZeroDb });
    auditPauseSync({
      workflowRunId: 'wf',
      priorPhaseId: '1',
      priorSubPhaseId: 'sub_a',
      nextSubPhaseId: 'sub_b',
    });
    expect(stderr()).toContain('SKIP (cascade) prior=sub_a next=sub_b');
    expect(stderr()).toContain('no fresh LLM invocations this process');
    expect(ls(pending())).toEqual([]);
  });

  it('falls through to pause (WARN) when the cascade query throws', () => {
    configureAuditPause({ workspaceRoot: ws, ackTimeoutSeconds: 0, pollIntervalMs: 5, db: throwDb });
    expect(() =>
      auditPauseSync({
        workflowRunId: 'wf',
        priorPhaseId: '1',
        priorSubPhaseId: 'sub_a',
        nextSubPhaseId: 'sub_b',
      }),
    ).toThrow(/timed out/);
    const s = stderr();
    expect(s).toContain('WARN cascade-skip query failed (boom)');
    expect(s).toContain('falling through to pause');
    expect(ls(pending()).some((f) => f.includes('sub_a'))).toBe(true);
  });

  it('throws a timeout error and writes the marker when no ack appears', () => {
    configureAuditPause({ workspaceRoot: ws, ackTimeoutSeconds: 0, pollIntervalMs: 5 });
    expect(() =>
      auditPauseSync({
        workflowRunId: 'wf',
        priorPhaseId: '2',
        priorSubPhaseId: 'plan',
        nextSubPhaseId: 'next',
      }),
    ).toThrow(/\[audit-pause\] timed out waiting for ack at sub_phase\.exited "plan" after 0s/);
    expect(ls(pending()).some((f) => f.includes('plan'))).toBe(true);
    expect(stderr()).toContain('PAUSED at sub_phase.exited prior=plan next=next');
  });

  it('resolves and moves marker+ack to done on a continue ack', () => {
    const seq = probeSeq() + 1;
    const basename = `${String(seq).padStart(4, '0')}__phase1__sub_a`;
    fs.writeFileSync(
      path.join(acks(), `${basename}.ack`),
      JSON.stringify({ action: 'continue' }),
      'utf8',
    );
    configureAuditPause({ workspaceRoot: ws, ackTimeoutSeconds: 2, pollIntervalMs: 5 });
    auditPauseSync({
      workflowRunId: 'wf',
      priorPhaseId: '1',
      priorSubPhaseId: 'sub_a',
      nextSubPhaseId: 'sub_b',
    });
    expect(ls(done())).toContain(`${basename}.json`);
    expect(ls(done())).toContain(`${basename}.ack`);
    expect(ls(pending())).not.toContain(`${basename}.json`);
    expect(ls(acks())).not.toContain(`${basename}.ack`);
    expect(stderr()).toContain(`resumed seq=${seq}`);
  });

  it('throws the abort error and moves files to done on an abort ack', () => {
    const seq = probeSeq() + 1;
    const basename = `${String(seq).padStart(4, '0')}__phase1__sub_a`;
    fs.writeFileSync(
      path.join(acks(), `${basename}.ack`),
      JSON.stringify({ action: 'abort', reason: 'nope' }),
      'utf8',
    );
    configureAuditPause({ workspaceRoot: ws, ackTimeoutSeconds: 2, pollIntervalMs: 5 });
    expect(() =>
      auditPauseSync({
        workflowRunId: 'wf',
        priorPhaseId: '1',
        priorSubPhaseId: 'sub_a',
        nextSubPhaseId: 'sub_b',
      }),
    ).toThrow('aborted by audit agent at sub_phase.exited "sub_a": nope');
    expect(ls(done())).toContain(`${basename}.json`);
    expect(ls(done())).toContain(`${basename}.ack`);
  });

  it('phase-exit is a no-op when priorSubPhaseId is null', () => {
    configureAuditPause({ workspaceRoot: ws });
    auditPhaseExitPauseSync({
      workflowRunId: 'wf',
      priorPhaseId: '1',
      priorSubPhaseId: null,
      nextPhaseId: '2',
    });
    expect(ls(pending())).toEqual([]);
    expect(stderr()).toBe('');
  });

  it('phase-exit cascade-skips when db reports 0 fresh invocations', () => {
    configureAuditPause({ workspaceRoot: ws, db: countZeroDb });
    auditPhaseExitPauseSync({
      workflowRunId: 'wf',
      priorPhaseId: '1',
      priorSubPhaseId: 'last',
      nextPhaseId: '2',
    });
    const s = stderr();
    expect(s).toContain('SKIP (cascade) phase_exit prior_phase=1 last_sub=last next_phase=2');
    expect(s).toContain('no fresh LLM invocations');
    expect(ls(pending())).toEqual([]);
  });

  it('phase-exit resolves on a continue ack, moves files to done, and stamps the marker kind', () => {
    const seq = probeSeq() + 1;
    const basename = `${String(seq).padStart(4, '0')}__phase1_exit__lastsub_last`;
    fs.writeFileSync(
      path.join(acks(), `${basename}.ack`),
      JSON.stringify({ action: 'continue' }),
      'utf8',
    );
    configureAuditPause({ workspaceRoot: ws, ackTimeoutSeconds: 2, pollIntervalMs: 5 });
    auditPhaseExitPauseSync({
      workflowRunId: 'wf',
      priorPhaseId: '1',
      priorSubPhaseId: 'last',
      nextPhaseId: '2',
    });
    expect(ls(done())).toContain(`${basename}.json`);
    expect(ls(done())).toContain(`${basename}.ack`);
    expect(stderr()).toContain(`resumed phase_exit seq=${seq}`);
    const marker = JSON.parse(
      fs.readFileSync(path.join(done(), `${basename}.json`), 'utf8'),
    );
    expect(marker.kind).toBe('phase_exit');
    expect(marker.next_phase_id).toBe('2');
    expect(marker.next_sub_phase_id).toBe('<phase_exit>');
  });
});
