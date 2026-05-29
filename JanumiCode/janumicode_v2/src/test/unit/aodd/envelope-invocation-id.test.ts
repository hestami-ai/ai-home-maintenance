/**
 * Tests pinning the envelope-level `invocation_id` resolution behavior.
 *
 * Closes two gaps surfaced in workspace-105 trace inspection:
 *   1. record.added now carries `invocation_id` for invocation-bound
 *      record types (agent_output, tool_call, etc.) and for the
 *      agent_invocation record itself.
 *   2. AODD emit reads `invocation_id` from TraceCtx when the call-site
 *      hasn't passed an explicit override — so log.* events fired inside
 *      an LLM call inherit the active invocation id without the caller
 *      threading it manually.
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
import {
  setInvocation,
  withTraceContext,
} from '../../../lib/trace/traceContext';

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

describe('AODD envelope invocation_id (gap fixes)', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aodd-invid-'));
  });

  afterEach(() => {
    closeStreams();
    initialize(null);
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('emit inherits invocation_id from TraceCtx when no override is given', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-ctx-inv');

    await withTraceContext(
      { workflow_run_id: 'wf-ctx-inv', phase_id: '1', sub_phase_id: 's' },
      async () => {
        setInvocation('inv-active');
        try {
          // No explicit invocation_id on emit — should pick up from ctx.
          aoddEmit('log.info', {
            trace_id: 't',
            category: 'workflow',
            message: 'mid-invocation log',
          });
          aoddEmit('record.added', {
            record_id: 'r1',
            record_type: 'artifact_produced',
          });
        } finally {
          setInvocation(null);
        }
      },
    );

    endRun({ status: 'success' });

    const events = readEvents(workspaceRoot, 'wf-ctx-inv');
    const log = events.find((e) => e.event_type === 'log.info')!;
    const rec = events.find((e) => e.event_type === 'record.added')!;
    expect(log.invocation_id).toBe('inv-active');
    expect(rec.invocation_id).toBe('inv-active');
  });

  it('emit clears invocation_id after setInvocation(null)', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-clear');

    await withTraceContext(
      { workflow_run_id: 'wf-clear', phase_id: '1', sub_phase_id: 's' },
      async () => {
        setInvocation('inv-1');
        aoddEmit('log.info', {
          trace_id: 't',
          category: 'workflow',
          message: 'during invocation',
        });
        setInvocation(null);
        aoddEmit('log.info', {
          trace_id: 't',
          category: 'workflow',
          message: 'after invocation',
        });
      },
    );

    endRun({ status: 'success' });

    const events = readEvents(workspaceRoot, 'wf-clear').filter(
      (e) => e.event_type === 'log.info',
    );
    expect(events.length).toBe(2);
    expect(events[0].invocation_id).toBe('inv-1');
    expect(events[1].invocation_id).toBeNull();
  });

  it('explicit invocation_id override wins over TraceCtx', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-override');

    await withTraceContext(
      { workflow_run_id: 'wf-override', phase_id: '1', sub_phase_id: 's' },
      async () => {
        setInvocation('inv-from-ctx');
        aoddEmit(
          'agent.reasoning_step',
          {
            invocation_id: 'inv-from-payload',
            content: 'thinking',
            sequence_position: 0,
          },
          { invocation_id: 'inv-from-payload' },
        );
      },
    );

    endRun({ status: 'success' });

    const ev = readEvents(workspaceRoot, 'wf-override').find(
      (e) => e.event_type === 'agent.reasoning_step',
    )!;
    expect(ev.invocation_id).toBe('inv-from-payload');
  });

  it('emit outside any setInvocation window has invocation_id null', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-none');

    await withTraceContext(
      { workflow_run_id: 'wf-none', phase_id: '1', sub_phase_id: 's' },
      async () => {
        aoddEmit('log.info', {
          trace_id: 't',
          category: 'workflow',
          message: 'no invocation in flight',
        });
      },
    );

    endRun({ status: 'success' });

    const ev = readEvents(workspaceRoot, 'wf-none').find(
      (e) => e.event_type === 'log.info',
    )!;
    expect(ev.invocation_id).toBeNull();
  });
});
