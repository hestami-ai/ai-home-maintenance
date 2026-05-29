/**
 * Tests for the sub-phase-exit summary improvements:
 *   (1) `sub_phase.exited` triggers a focused summary write to disk
 *       immediately — not waiting for endRun.
 *   (2) `sub_phase.exited` payload carries real duration_ms (from
 *       entered/exited delta) and a status that reflects whether any
 *       failure marker fired during the sub-phase.
 *   (3) [Tested via run lifecycle, not here] The orchestrator covers
 *       the last sub-phase of each phase by emitting sub_phase.exited
 *       before phase.exited.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  closeStreams,
  consumeSubPhaseState,
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

function readSummary(
  workspaceRoot: string,
  runId: string,
  phaseId: string,
  subPhaseId: string,
): Record<string, unknown> | null {
  const p = path.join(
    workspaceRoot,
    '.janumicode',
    'runs',
    runId,
    'aodd',
    'summaries',
    `phase${phaseId}`,
    `${subPhaseId}.summary.json`,
  );
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

describe('Sub-phase exit summary + payload', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aodd-spexit-'));
  });

  afterEach(() => {
    closeStreams();
    initialize(null);
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('writes the sub-phase summary on sub_phase.exited (not waiting for endRun)', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-incremental');

    await withTraceContext(
      { workflow_run_id: 'wf-incremental', phase_id: '1', sub_phase_id: null },
      async () => {
        aoddEmit(
          'sub_phase.entered',
          { sub_phase_name: 'entities_bloom' },
          { sub_phase_id_override: 'entities_bloom' },
        );
        aoddEmit(
          'llm.invoked',
          { provider: 'a', model: 'claude-sonnet-4-6', prompt: 'p' },
          { sub_phase_id_override: 'entities_bloom', invocation_id: 'inv-1' },
        );
        aoddEmit(
          'llm.returned',
          {
            text: 'ok',
            thinking: null,
            input_tokens: 10,
            output_tokens: 5,
            duration_ms: 100,
            retry_attempts: 0,
          },
          { sub_phase_id_override: 'entities_bloom', invocation_id: 'inv-1' },
        );
        // Consume tracker state and synthesize the exit event the way
        // stateMachine.setSubPhase would.
        const exit = consumeSubPhaseState('entities_bloom');
        aoddEmit(
          'sub_phase.exited',
          { status: exit.status, duration_ms: exit.duration_ms },
          { sub_phase_id_override: 'entities_bloom' },
        );
      },
    );
    // Do NOT call endRun yet — we want to verify the summary landed mid-run.
    const summary = readSummary(workspaceRoot, 'wf-incremental', '1', 'entities_bloom');
    expect(summary).not.toBeNull();
    expect(summary!.phase_id).toBe('1');
    expect(summary!.sub_phase_id).toBe('entities_bloom');
    expect((summary!.who as Record<string, unknown>).model).toBe('claude-sonnet-4-6');

    endRun({ status: 'success' });
  });

  it('sub_phase.exited payload carries real duration_ms (>0)', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-duration');

    await withTraceContext(
      { workflow_run_id: 'wf-duration', phase_id: '1', sub_phase_id: null },
      async () => {
        aoddEmit(
          'sub_phase.entered',
          { sub_phase_name: 'x' },
          { sub_phase_id_override: 'x' },
        );
        // Force a small but measurable delta so duration > 0.
        await new Promise((r) => setTimeout(r, 12));
        const exit = consumeSubPhaseState('x');
        aoddEmit(
          'sub_phase.exited',
          { status: exit.status, duration_ms: exit.duration_ms },
          { sub_phase_id_override: 'x' },
        );
      },
    );
    endRun({ status: 'success' });

    const ev = readEvents(workspaceRoot, 'wf-duration').find(
      (e) => e.event_type === 'sub_phase.exited',
    )!;
    const payload = ev.payload as Record<string, unknown>;
    expect(typeof payload.duration_ms).toBe('number');
    expect(payload.duration_ms as number).toBeGreaterThan(0);
  });

  it('sub_phase.exited status reflects llm.failed during the sub-phase', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-failed-status');

    await withTraceContext(
      { workflow_run_id: 'wf-failed-status', phase_id: '1', sub_phase_id: null },
      async () => {
        aoddEmit(
          'sub_phase.entered',
          { sub_phase_name: 'broke' },
          { sub_phase_id_override: 'broke' },
        );
        aoddEmit(
          'llm.failed',
          {
            error: { message: 'boom' },
            duration_ms: 200,
            retry_attempts: 3,
          },
          { sub_phase_id_override: 'broke', invocation_id: 'inv-1' },
        );
        const exit = consumeSubPhaseState('broke');
        aoddEmit(
          'sub_phase.exited',
          { status: exit.status, duration_ms: exit.duration_ms },
          { sub_phase_id_override: 'broke' },
        );
      },
    );
    endRun({ status: 'failed', error: { message: 'phase failed' } });

    const ev = readEvents(workspaceRoot, 'wf-failed-status').find(
      (e) => e.event_type === 'sub_phase.exited',
    )!;
    expect((ev.payload as Record<string, unknown>).status).toBe('failed');
  });

  it('record.added of packet_synthesis_failure flips status to failed', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-pkt-failed');

    await withTraceContext(
      { workflow_run_id: 'wf-pkt-failed', phase_id: '9', sub_phase_id: null },
      async () => {
        aoddEmit(
          'sub_phase.entered',
          { sub_phase_name: 'packet_synthesis' },
          { sub_phase_id_override: 'packet_synthesis' },
        );
        aoddEmit(
          'record.added',
          { record_id: 'r1', record_type: 'packet_synthesis_failure' },
          { sub_phase_id_override: 'packet_synthesis' },
        );
        const exit = consumeSubPhaseState('packet_synthesis');
        aoddEmit(
          'sub_phase.exited',
          { status: exit.status, duration_ms: exit.duration_ms },
          { sub_phase_id_override: 'packet_synthesis' },
        );
      },
    );
    endRun({ status: 'partial' });

    const ev = readEvents(workspaceRoot, 'wf-pkt-failed').find(
      (e) => e.event_type === 'sub_phase.exited',
    )!;
    expect((ev.payload as Record<string, unknown>).status).toBe('failed');
  });
});
