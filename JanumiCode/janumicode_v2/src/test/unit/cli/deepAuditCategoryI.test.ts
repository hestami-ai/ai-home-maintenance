/**
 * Characterization test for deep-audit category I (Phase 9 executor
 * lifecycle). Pins the CURRENT observable behavior of categoryI_executors so
 * the S3776 decomposition (extraction of collectTerminalInvocationIds /
 * collectAgentOutputInvocationIds / executorLifecycleFinding) is verified
 * behavior-preserving.
 *
 * Behavior captured (from the original inline implementation):
 *   - `terminal` set = invocation_record_id of every lifecycle event whose
 *     event === 'executor.invocation_status_change' AND to ∈ {completed,failed}
 *   - `hasOutput` set = invocation_record_id of every `agent_output` artifact
 *   - only `agent_invocation` artifacts with phase_id === '9' are inspected
 *   - backing = content.backing_tool ?? content.provider ?? ''; the artifact is
 *     skipped unless /cli/ matches backing OR backing is 'goose_cli' /
 *     'claude_code_cli'
 *   - matching is keyed on the invocation artifact's own record_id (against
 *     agent_output.invocation_record_id and lifecycle.invocation_record_id)
 *   - neither output nor terminal  → one BLOCK finding
 *   - terminal reached but no output → one WARN finding
 *   - has output → no finding
 *   - ref is `task:${JSON.stringify(c.task_id ?? '?')}`; findings carry no
 *     `details` field and are emitted in artifact order
 */

import { describe, it, expect } from 'vitest';
import {
  categoryI_executors,
  type DbArtifact,
  type LifecycleEvent,
} from '../../../cli/deep-audit';

function artifact(
  record_type: string,
  content: Record<string, unknown>,
  over: Partial<DbArtifact> = {},
): DbArtifact {
  return {
    record_id: 'rec-1',
    record_type,
    phase_id: '9',
    sub_phase_id: '9.1',
    produced_at: '2026-01-01T00:00:00Z',
    kind: undefined,
    content,
    ...over,
  };
}

function invocation(over: Partial<DbArtifact> = {}, content: Record<string, unknown> = {}): DbArtifact {
  return artifact('agent_invocation', { backing_tool: 'goose_cli', ...content }, over);
}

function statusEvent(over: Partial<LifecycleEvent> = {}): LifecycleEvent {
  return {
    ts: '2026-01-01T00:00:00Z',
    event: 'executor.invocation_status_change',
    workflow_run_id: 'run-1',
    ...over,
  };
}

describe('categoryI_executors (characterization)', () => {
  it('flags a stuck invocation (no output, no terminal) as BLOCK', () => {
    const res = categoryI_executors(
      [invocation({ record_id: 'inv-1' }, { task_id: 'T-1' })],
      [],
    );
    expect(res).toEqual([
      {
        category: 'I',
        severity: 'BLOCK',
        phase_id: '9',
        sub_phase_id: '9.1',
        record_id: 'inv-1',
        ref: 'task:"T-1"',
        message:
          'Phase 9 executor invocation has neither agent_output nor terminal status_change (stuck or output-write failed)',
      },
    ]);
  });

  it('flags terminal-but-no-output (completed) as WARN', () => {
    const res = categoryI_executors(
      [invocation({ record_id: 'inv-2' }, { task_id: 'T-2', backing_tool: 'claude_code_cli' })],
      [statusEvent({ to: 'completed', invocation_record_id: 'inv-2' })],
    );
    expect(res).toEqual([
      {
        category: 'I',
        severity: 'WARN',
        phase_id: '9',
        sub_phase_id: '9.1',
        record_id: 'inv-2',
        ref: 'task:"T-2"',
        message:
          'Phase 9 executor invocation has no agent_output (reached terminal status_change, but DB record-write may have failed)',
      },
    ]);
  });

  it('treats a failed terminal status the same as completed (WARN)', () => {
    const res = categoryI_executors(
      [invocation({ record_id: 'inv-8' }, { task_id: 'T-8' })],
      [statusEvent({ to: 'failed', invocation_record_id: 'inv-8' })],
    );
    expect(res).toHaveLength(1);
    expect(res[0].severity).toBe('WARN');
  });

  it('produces no finding when a matching agent_output exists', () => {
    const res = categoryI_executors(
      [
        invocation({ record_id: 'inv-3' }, { task_id: 'T-3' }),
        artifact('agent_output', { invocation_record_id: 'inv-3' }, { record_id: 'out-3' }),
      ],
      [],
    );
    expect(res).toEqual([]);
  });

  it('skips invocations whose backing is neither /cli/ nor an executor CLI', () => {
    const res = categoryI_executors(
      [invocation({ record_id: 'inv-4' }, { task_id: 'T-4', backing_tool: undefined, provider: 'anthropic' })],
      [],
    );
    expect(res).toEqual([]);
  });

  it('treats a provider ending in _cli as an executor backing (BLOCK when stuck)', () => {
    const res = categoryI_executors(
      [invocation({ record_id: 'inv-5' }, { task_id: 'T-5', backing_tool: undefined, provider: 'mimo_cli' })],
      [],
    );
    expect(res).toHaveLength(1);
    expect(res[0].severity).toBe('BLOCK');
  });

  it('skips an empty-string backing_tool (does not fall through to provider)', () => {
    const res = categoryI_executors(
      [invocation({ record_id: 'inv-6' }, { task_id: 'T-6', backing_tool: '', provider: 'goose_cli' })],
      [],
    );
    expect(res).toEqual([]);
  });

  it('ignores non-phase-9 invocations', () => {
    const res = categoryI_executors(
      [invocation({ record_id: 'inv-p8', phase_id: '8' }, { task_id: 'T' })],
      [],
    );
    expect(res).toEqual([]);
  });

  it('ignores non-agent_invocation records', () => {
    const res = categoryI_executors(
      [artifact('artifact_produced', { backing_tool: 'goose_cli', task_id: 'T' }, { record_id: 'ap-1' })],
      [],
    );
    expect(res).toEqual([]);
  });

  it('does not count a non-terminal status (running) toward terminal', () => {
    const res = categoryI_executors(
      [invocation({ record_id: 'inv-7' }, { task_id: 'T-7' })],
      [statusEvent({ to: 'running', invocation_record_id: 'inv-7' })],
    );
    expect(res).toHaveLength(1);
    expect(res[0].severity).toBe('BLOCK');
  });

  it('does not count a completed status on the wrong event type', () => {
    const res = categoryI_executors(
      [invocation({ record_id: 'inv-9' }, { task_id: 'T-9' })],
      [statusEvent({ event: 'something.else', to: 'completed', invocation_record_id: 'inv-9' })],
    );
    expect(res).toHaveLength(1);
    expect(res[0].severity).toBe('BLOCK');
  });

  it('falls back to task:"?" when task_id is absent', () => {
    const res = categoryI_executors(
      [invocation({ record_id: 'inv-10' })],
      [],
    );
    expect(res).toHaveLength(1);
    expect(res[0].ref).toBe('task:"?"');
  });

  it('accumulates findings across multiple invocations in artifact order', () => {
    const res = categoryI_executors(
      [
        invocation({ record_id: 'inv-a' }, { task_id: 'A' }), // stuck → BLOCK
        invocation({ record_id: 'inv-b' }, { task_id: 'B' }), // terminal → WARN
      ],
      [statusEvent({ to: 'completed', invocation_record_id: 'inv-b' })],
    );
    expect(res.map((f) => [f.record_id, f.severity, f.ref])).toEqual([
      ['inv-a', 'BLOCK', 'task:"A"'],
      ['inv-b', 'WARN', 'task:"B"'],
    ]);
  });
});
