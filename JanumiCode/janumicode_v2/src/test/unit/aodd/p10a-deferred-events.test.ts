/**
 * Tests for the previously-deferred event clusters:
 *   - retry.scheduled / retry.attempted   (llmCaller.ts retry path)
 *   - audit.pause_emitted / audit.pause_resolved (auditPause.ts)
 *   - record.added / record.updated / record.quarantined (governedStreamWriter.ts)
 *   - gate.pending (all phase handlers)
 *   - context.assembled / context.detail_file_written (contextBuilder + dmrContext)
 *
 * The actual call-sites are exercised by other suites; this file pins
 * the AODD emit shapes for each event type so future refactors that
 * touch these payload contracts trip a loud test.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  closeStreams,
  emit as aoddEmit,
  endRun,
  initialize,
  startRun,
} from '../../../lib/aodd';
import { withTraceContext } from '../../../lib/trace/traceContext';

function readEvents(workspaceRoot: string, runId: string): Array<Record<string, unknown>> {
  const filepath = path.join(
    workspaceRoot,
    '.janumicode',
    'runs',
    runId,
    'aodd',
    'events.ndjson',
  );
  if (!fs.existsSync(filepath)) return [];
  return fs
    .readFileSync(filepath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

describe('Previously-deferred AODD event clusters', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aodd-deferred-'));
  });

  afterEach(() => {
    closeStreams();
    initialize(null);
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('retry.scheduled + retry.attempted carry attempt + reason', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-retry');
    await withTraceContext(
      { workflow_run_id: 'wf-retry', phase_id: '1', sub_phase_id: 's' },
      async () => {
        aoddEmit('retry.scheduled', { attempt: 1, reason: 'rate_limit' });
        aoddEmit('retry.attempted', { attempt: 1 });
      },
    );
    endRun({ status: 'success' });
    const evs = readEvents(workspaceRoot, 'wf-retry').filter((e) =>
      String(e.event_type).startsWith('retry.'),
    );
    expect(evs.map((e) => e.event_type)).toEqual([
      'retry.scheduled',
      'retry.attempted',
    ]);
    expect((evs[0].payload as Record<string, unknown>).reason).toBe('rate_limit');
    expect((evs[0].payload as Record<string, unknown>).attempt).toBe(1);
  });

  it('audit.pause_emitted + audit.pause_resolved carry seq + paths', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-audit');
    await withTraceContext(
      { workflow_run_id: 'wf-audit', phase_id: '4', sub_phase_id: 'x' },
      async () => {
        aoddEmit('audit.pause_emitted', {
          seq: 42,
          marker_path: '/ws/.janumicode/audit/pending/0042__phase4__x.json',
        });
        aoddEmit('audit.pause_resolved', {
          seq: 42,
          ack_path: '/ws/.janumicode/audit/acks/0042__phase4__x.ack',
          action: 'continue',
        });
      },
    );
    endRun({ status: 'success' });
    const evs = readEvents(workspaceRoot, 'wf-audit').filter((e) =>
      String(e.event_type).startsWith('audit.'),
    );
    expect(evs.map((e) => e.event_type)).toEqual([
      'audit.pause_emitted',
      'audit.pause_resolved',
    ]);
    expect((evs[0].payload as Record<string, unknown>).seq).toBe(42);
    expect((evs[1].payload as Record<string, unknown>).action).toBe('continue');
  });

  it('record.added / record.updated / record.quarantined shapes', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-records');
    await withTraceContext(
      { workflow_run_id: 'wf-records', phase_id: '1', sub_phase_id: 's' },
      async () => {
        aoddEmit('record.added', { record_id: 'r1', record_type: 'artifact_produced' });
        aoddEmit('record.updated', {
          record_id: 'r1',
          record_type: 'artifact_produced',
          field_diff: { changed: ['content'] },
        });
        aoddEmit('record.quarantined', {
          record_id: 'r1',
          record_type: 'artifact_produced',
          reason: 'reasoning_review_high_severity',
        });
      },
    );
    endRun({ status: 'success' });
    const types = readEvents(workspaceRoot, 'wf-records')
      .map((e) => e.event_type as string)
      .filter((t) => t.startsWith('record.'));
    expect(types).toEqual(['record.added', 'record.updated', 'record.quarantined']);
  });

  it('gate.pending carries gate_kind; gate.approved / gate.rejected shapes', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-gate');
    await withTraceContext(
      { workflow_run_id: 'wf-gate', phase_id: '2', sub_phase_id: null },
      async () => {
        aoddEmit('gate.pending', { gate_kind: 'phase_gate' });
        aoddEmit('gate.approved', { gate_kind: 'phase_gate' });
      },
    );
    await withTraceContext(
      { workflow_run_id: 'wf-gate', phase_id: '3', sub_phase_id: null },
      async () => {
        aoddEmit('gate.rejected', { gate_kind: 'phase_gate', reason: 'human disapproved' });
      },
    );
    endRun({ status: 'success' });
    const gateEvents = readEvents(workspaceRoot, 'wf-gate').filter((e) =>
      String(e.event_type).startsWith('gate.'),
    );
    expect(gateEvents.map((e) => e.event_type)).toEqual([
      'gate.pending',
      'gate.approved',
      'gate.rejected',
    ]);
    expect((gateEvents[2].payload as Record<string, unknown>).reason).toBe(
      'human disapproved',
    );
  });

  it('context.assembled + context.detail_file_written shapes', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-ctx');
    await withTraceContext(
      { workflow_run_id: 'wf-ctx', phase_id: '4', sub_phase_id: 'component_skeleton' },
      async () => {
        aoddEmit('context.assembled', {
          input_record_ids: ['rec-1', 'rec-2', 'rec-3'],
        });
        aoddEmit('context.detail_file_written', {
          path: '/ws/.janumicode/runs/wf-ctx/context/component_skeleton_inv-1.md',
          bytes: 18432,
        });
      },
    );
    endRun({ status: 'success' });
    const ctxEvents = readEvents(workspaceRoot, 'wf-ctx').filter((e) =>
      String(e.event_type).startsWith('context.'),
    );
    expect(ctxEvents.map((e) => e.event_type)).toEqual([
      'context.assembled',
      'context.detail_file_written',
    ]);
    expect(
      ((ctxEvents[0].payload as Record<string, unknown>).input_record_ids as string[])
        .length,
    ).toBe(3);
    expect((ctxEvents[1].payload as Record<string, unknown>).bytes).toBe(18432);
  });
});
