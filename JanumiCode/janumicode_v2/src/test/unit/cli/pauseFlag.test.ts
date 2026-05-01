/**
 * Unit test for the operator pause-flag detector used by the CLI runner's
 * waitForQuiescence loop. Mocks out fs so the test doesn't touch the real
 * filesystem and asserts:
 *   - returns false when the flag is absent
 *   - returns true, deletes the flag, and writes the PAUSED_AT marker
 *     when the flag is present
 *   - the marker payload carries the workflow_run_id and an ISO timestamp
 */

import { describe, it, expect, vi } from 'vitest';
import * as path from 'node:path';
import { detectAndConsumePauseFlag, PAUSE_ABORT_REASON } from '../../../cli/runner';

function makeFsStub(initiallyPresent: boolean) {
  const calls: { existsSync: string[]; unlinkSync: string[]; writeFileSync: Array<{ p: string; data: string }>; mkdirSync: string[] } = {
    existsSync: [],
    unlinkSync: [],
    writeFileSync: [],
    mkdirSync: [],
  };
  const present = new Set<string>();
  return {
    calls,
    present,
    fs: {
      existsSync: vi.fn((p: string) => {
        calls.existsSync.push(p);
        return initiallyPresent && p.endsWith('PAUSE_REQUESTED');
      }) as unknown as typeof import('node:fs').existsSync,
      unlinkSync: vi.fn((p: string) => {
        calls.unlinkSync.push(p);
      }) as unknown as typeof import('node:fs').unlinkSync,
      writeFileSync: vi.fn((p: string, data: string | Buffer) => {
        calls.writeFileSync.push({ p, data: String(data) });
      }) as unknown as typeof import('node:fs').writeFileSync,
      mkdirSync: vi.fn((p: string) => {
        calls.mkdirSync.push(p);
        return undefined;
      }) as unknown as typeof import('node:fs').mkdirSync,
    },
  };
}

describe('detectAndConsumePauseFlag', () => {
  const workspace = path.resolve('/tmp/fake-ws');

  it('returns false and is a no-op when the flag is absent', () => {
    const stub = makeFsStub(false);
    const result = detectAndConsumePauseFlag(workspace, 'run-123', stub.fs);
    expect(result).toBe(false);
    expect(stub.calls.unlinkSync).toHaveLength(0);
    expect(stub.calls.writeFileSync).toHaveLength(0);
  });

  it('returns true, deletes the flag, and writes a PAUSED_AT marker when the flag is present', () => {
    const stub = makeFsStub(true);
    const result = detectAndConsumePauseFlag(workspace, 'run-123', stub.fs);
    expect(result).toBe(true);
    expect(stub.calls.unlinkSync).toHaveLength(1);
    expect(stub.calls.unlinkSync[0]).toContain('PAUSE_REQUESTED');
    expect(stub.calls.writeFileSync).toHaveLength(1);
    expect(stub.calls.writeFileSync[0].p).toContain('PAUSED_AT');
    const marker = JSON.parse(stub.calls.writeFileSync[0].data) as {
      workflow_run_id: string;
      paused_at: string;
    };
    expect(marker.workflow_run_id).toBe('run-123');
    expect(() => new Date(marker.paused_at).toISOString()).not.toThrow();
  });

  it('exposes a stable abort-reason string the runner uses for engine.abortSession', () => {
    expect(PAUSE_ABORT_REASON).toMatch(/operator paused/i);
  });
});
