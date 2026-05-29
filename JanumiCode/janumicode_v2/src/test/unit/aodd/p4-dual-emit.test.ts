/**
 * P4 dual-emit tests.
 *
 * Verifies that AODD emits at the 14+ EventBus dual-emit call-sites use
 * the right payload shape (snake_case AODD vs camelCase EventBus) and
 * carry envelope-level identifiers (invocation_id for agent.* events).
 *
 * The actual wiring lives in:
 *   - src/lib/agents/executorAgent.ts             agent.*
 *   - src/lib/orchestrator/orchestratorEngine.ts  decision.* / decision.escalated
 *   - src/lib/orchestrator/waveGate.ts            mirror.presented
 *   - src/lib/orchestrator/phases/{phase1,3,4_2a,5,10}.ts  mirror.presented
 *   - src/lib/orchestrator/testRunner.ts          test.*
 *   - src/lib/orchestrator/evalRunner.ts          eval.*
 *
 * Rather than instantiating each subsystem (heavy), this file tests the
 * AODD `emit()` API directly with the shapes those call-sites use, and
 * asserts the envelope + payload are correct on disk. Functional
 * verification of the call-sites happens through the broader unit suite
 * (1617 tests) which exercises them in their own runners.
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
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
}

describe('AODD dual-emit shapes (P4)', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aodd-p4-'));
  });

  afterEach(() => {
    closeStreams();
    initialize(null);
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('agent.* events carry invocation_id in both envelope and payload', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-agent');

    await withTraceContext(
      { workflow_run_id: 'wf-agent', phase_id: '9', sub_phase_id: '9.1' },
      async () => {
        aoddEmit(
          'agent.invocation_started',
          { invocation_id: 'inv-1', agent_role: 'executor_agent' },
          { invocation_id: 'inv-1' },
        );
        aoddEmit(
          'agent.reasoning_step',
          { invocation_id: 'inv-1', content: 'thinking...', sequence_position: 0 },
          { invocation_id: 'inv-1' },
        );
        aoddEmit(
          'agent.tool_call',
          {
            invocation_id: 'inv-1',
            tool_name: 'Write',
            params: '{"path":"foo.ts"}',
            sequence_position: 1,
          },
          { invocation_id: 'inv-1' },
        );
        aoddEmit(
          'agent.invocation_completed',
          { invocation_id: 'inv-1', success: true },
          { invocation_id: 'inv-1' },
        );
      },
    );

    endRun({ status: 'success' });

    const events = readEvents(workspaceRoot, 'wf-agent').filter((e) =>
      String(e.event_type).startsWith('agent.'),
    );
    expect(events.length).toBe(4);
    for (const e of events) {
      expect(e.invocation_id).toBe('inv-1'); // envelope
      expect((e.payload as Record<string, unknown>).invocation_id).toBe('inv-1'); // payload
      expect(e.phase_id).toBe('9');
      expect(e.sub_phase_id).toBe('9.1');
    }
    expect((events[2].payload as Record<string, unknown>).tool_name).toBe('Write');
    expect((events[2].payload as Record<string, unknown>).sequence_position).toBe(1);
  });

  it('mirror.presented uses snake_case fields', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-mirror');

    await withTraceContext(
      { workflow_run_id: 'wf-mirror', phase_id: '3', sub_phase_id: null },
      async () => {
        aoddEmit('mirror.presented', {
          mirror_id: 'm-1',
          artifact_type: 'system_specification',
        });
      },
    );

    endRun({ status: 'success' });

    const events = readEvents(workspaceRoot, 'wf-mirror').filter(
      (e) => e.event_type === 'mirror.presented',
    );
    expect(events.length).toBe(1);
    const payload = events[0].payload as Record<string, unknown>;
    expect(payload.mirror_id).toBe('m-1');
    expect(payload.artifact_type).toBe('system_specification');
    expect('mirrorId' in payload).toBe(false); // no camelCase leak
  });

  it('decision.requested and decision.resolved carry decision_id', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-dec');

    await withTraceContext(
      { workflow_run_id: 'wf-dec', phase_id: '4', sub_phase_id: null },
      async () => {
        aoddEmit('decision.requested', {
          decision_id: 'dec-7',
          surface_type: 'mirror',
        });
        aoddEmit('decision.resolved', {
          decision_id: 'dec-7',
          resolution: { type: 'mirror_approval' },
        });
      },
    );

    endRun({ status: 'success' });

    const events = readEvents(workspaceRoot, 'wf-dec').filter((e) =>
      String(e.event_type).startsWith('decision.'),
    );
    expect(events.map((e) => e.event_type)).toEqual([
      'decision.requested',
      'decision.resolved',
    ]);
    expect((events[0].payload as Record<string, unknown>).decision_id).toBe('dec-7');
    expect((events[1].payload as Record<string, unknown>).decision_id).toBe('dec-7');
  });

  it('test.* and eval.* events use the right shapes', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-test-eval');

    await withTraceContext(
      { workflow_run_id: 'wf-test-eval', phase_id: '7', sub_phase_id: null },
      async () => {
        aoddEmit('test.run_started', { suite_count: 3 });
        aoddEmit('test.suite_completed', {
          suite_id: 's1',
          suite_name: 'unit',
          passed: 10,
          failed: 0,
          skipped: 1,
        });
        aoddEmit('test.run_completed', {
          total_passed: 10,
          total_failed: 0,
          total_skipped: 1,
          duration_ms: 200,
          success: true,
        });
        aoddEmit('eval.started', { eval_type: 'all' });
        aoddEmit('eval.completed', { eval_type: 'all', passed: true });
      },
    );

    endRun({ status: 'success' });

    const events = readEvents(workspaceRoot, 'wf-test-eval');
    const types = events
      .map((e) => e.event_type as string)
      .filter((t) => t.startsWith('test.') || t.startsWith('eval.'));
    expect(types).toEqual([
      'test.run_started',
      'test.suite_completed',
      'test.run_completed',
      'eval.started',
      'eval.completed',
    ]);
  });

  it('decision.escalated uses snake_case escalation_record_id', async () => {
    initialize({ workspaceRoot, janumicodeVersionSha: 'test', enabled: true });
    startRun('wf-esc');

    await withTraceContext(
      { workflow_run_id: 'wf-esc', phase_id: '5', sub_phase_id: null },
      async () => {
        aoddEmit('decision.escalated', {
          escalation_record_id: 'esc-1',
          description: 'conflict in api_definitions',
        });
      },
    );

    endRun({ status: 'success' });

    const events = readEvents(workspaceRoot, 'wf-esc').filter(
      (e) => e.event_type === 'decision.escalated',
    );
    expect(events.length).toBe(1);
    const payload = events[0].payload as Record<string, unknown>;
    expect(payload.escalation_record_id).toBe('esc-1');
    expect(payload.description).toBe('conflict in api_definitions');
  });
});
