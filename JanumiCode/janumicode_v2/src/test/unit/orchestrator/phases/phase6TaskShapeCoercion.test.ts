/**
 * Phase 6 Track A: code-side robustness for LLM-output drift.
 * Tests normalizeWorkspacePath (path discipline) and normalizeRootTaskShape
 * (CC coercion, name fallback, backing_tool warning).
 *
 * cal-26 surfaced three classes of drift the prompt didn't forbid:
 *   - missing `name` → fallback to id (rendered as `task-N: task-N`)
 *   - `completion_criteria` as array of strings → renderer printed undefined
 *   - `backing_tool: "Python"` outside the active_constraints stack
 *   - `write_directory_paths` as absolute Windows paths into the live
 *     project source tree
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeWorkspacePath,
  normalizeRootTaskShape,
} from '../../../../lib/orchestrator/phases/phase6';

describe('normalizeWorkspacePath', () => {
  it('strips Linux system roots', () => {
    expect(normalizeWorkspacePath('/opt/foo/bar')).toBe('foo/bar');
    expect(normalizeWorkspacePath('/var/log/app')).toBe('log/app');
    expect(normalizeWorkspacePath('/usr/local/bin')).toBe('local/bin');
  });

  it('strips Windows drive letters (cal-26 fix)', () => {
    expect(normalizeWorkspacePath('E:/foo/bar')).toBe('foo/bar');
    expect(normalizeWorkspacePath('C:/Users/me/proj')).toBe('Users/me/proj');
    expect(normalizeWorkspacePath('e:/lower-case-drive')).toBe('lower-case-drive');
  });

  it('strips through janumicode_v2/ to prevent writes into live source tree', () => {
    const live = 'E:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/components/comp-foo';
    expect(normalizeWorkspacePath(live)).toBe('src/components/comp-foo');
  });

  it('handles backslash separators (Windows path style)', () => {
    expect(normalizeWorkspacePath('E:\\Projects\\janumicode_v2\\src\\foo')).toBe('src/foo');
  });

  it('leaves already-relative paths alone', () => {
    expect(normalizeWorkspacePath('src/server/auth')).toBe('src/server/auth');
    expect(normalizeWorkspacePath('./src/foo')).toBe('src/foo');
  });

  it('collapses repeated slashes and trailing slash', () => {
    expect(normalizeWorkspacePath('src//foo///bar/')).toBe('src/foo/bar');
  });

  it('handles empty string', () => {
    expect(normalizeWorkspacePath('')).toBe('');
  });
});

describe('normalizeRootTaskShape', () => {
  const constraints = ['TECH-NODEJS-BUN-1', 'TECH-POSTGRES-1'];

  it('returns clean shape when LLM emits a well-formed task', () => {
    const raw = {
      id: 'task-001',
      name: 'Implement auth middleware',
      description: 'Verify session tokens against Better-Auth.',
      task_type: 'standard',
      component_id: 'comp-auth',
      component_responsibility: 'Verify identity',
      estimated_complexity: 'medium',
      completion_criteria: [
        { criterion_id: 'CC-001', description: 'Returns 401 on bad token', verification_method: 'test_execution' },
      ],
      write_directory_paths: ['src/auth/middleware'],
      read_directory_paths: ['src/shared/auth'],
      dependency_task_ids: ['task-000'],
    };
    const t = normalizeRootTaskShape(raw, 0, constraints);
    expect(t.id).toBe('task-001');
    expect(t.name).toBe('Implement auth middleware');
    expect(t.completion_criteria).toHaveLength(1);
    expect(t.completion_criteria[0].criterion_id).toBe('CC-001');
    expect(t.active_constraints).toEqual(constraints);
  });

  it('derives name from description when LLM omits name (cal-26 fix)', () => {
    const raw = {
      id: 'task-004',
      description: 'Implement proxy logic to verify Better-Auth session.',
      component_id: 'comp-x',
      component_responsibility: 'r',
      completion_criteria: [],
    };
    const t = normalizeRootTaskShape(raw, 3, constraints);
    expect(t.name).toBe('Implement proxy logic to verify Better-Auth session.');
  });

  it('truncates long descriptions when deriving name', () => {
    const longDesc = 'This is a very long description that exceeds the eighty character limit for a task name field';
    const raw = { id: 't', description: longDesc, component_id: 'c', component_responsibility: 'r', completion_criteria: [] };
    const t = normalizeRootTaskShape(raw, 0, constraints);
    expect(t.name.length).toBeLessThanOrEqual(80);
    expect(t.name.endsWith('...')).toBe(true);
  });

  it('falls back to id when both name and description are missing', () => {
    const raw = { id: 'task-007', component_id: 'c', component_responsibility: 'r', completion_criteria: [] };
    const t = normalizeRootTaskShape(raw, 6, constraints);
    expect(t.name).toBe('task-007');
  });

  it('coerces string completion_criteria to objects (cal-26 fix)', () => {
    const raw = {
      id: 'task-004',
      description: 'foo',
      component_id: 'c',
      component_responsibility: 'r',
      completion_criteria: [
        'Implementation code committed to source control.',
        'Tests verify claim propagation accuracy.',
      ],
    };
    const t = normalizeRootTaskShape(raw, 0, constraints);
    expect(t.completion_criteria).toHaveLength(2);
    expect(t.completion_criteria[0]).toMatchObject({
      criterion_id: 'CC-001',
      description: 'Implementation code committed to source control.',
      verification_method: 'test_execution',
    });
    expect(t.completion_criteria[1].criterion_id).toBe('CC-002');
  });

  it('coerces objects with `text` field instead of `description`', () => {
    const raw = {
      id: 't', description: 'd', component_id: 'c', component_responsibility: 'r',
      completion_criteria: [{ text: 'A test condition', criterion_id: 'CC-99' }],
    };
    const t = normalizeRootTaskShape(raw, 0, constraints);
    expect(t.completion_criteria[0].description).toBe('A test condition');
    expect(t.completion_criteria[0].criterion_id).toBe('CC-99');
  });

  it('OVERRIDES write paths with the deterministic canonical component dir; normalizes read paths', () => {
    // Project Layout Contract: write_directory_paths is no longer the
    // LLM-invented value — it is deterministically derived from component_id
    // (here comp-foo → src/foo). read_directory_paths stays LLM-driven (just
    // normalized) since a task legitimately reads other components/shared.
    const raw = {
      id: 't', description: 'd', component_id: 'comp-foo', component_responsibility: 'r',
      completion_criteria: [],
      write_directory_paths: [
        'E:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/components/comp-foo',
        '/opt/old-spec/path',
      ],
      read_directory_paths: ['./src/shared/models'],
    };
    const t = normalizeRootTaskShape(raw, 0, constraints);
    expect(t.write_directory_paths).toEqual(['src/foo']);
    expect(t.read_directory_paths).toEqual(['src/shared/models']);
  });

  it('REGRESSION: ignores LLM-emitted backing_tool field (removed 2026-05-27)', () => {
    // Task-level `backing_tool` was descriptive metadata that the
    // executor never used for routing (routing is config-driven via
    // llm_routing.executor.primary.backing_tool). The field was
    // removed to stop confusing readers. This test pins that
    // re-introducing it on the LLM side does NOT cause it to surface
    // on DecompositionTask (no auto-include from raw input).
    const raw = {
      id: 'task-004', description: 'd', component_id: 'c', component_responsibility: 'r',
      backing_tool: 'Python',
      completion_criteria: [],
    };
    const t = normalizeRootTaskShape(raw, 0, constraints);
    expect((t as unknown as { backing_tool?: unknown }).backing_tool).toBeUndefined();
  });

  it('uses technical_spec_ids as traces_to when present (Phase 5 → Phase 6 wiring)', () => {
    const raw = {
      id: 't', description: 'd', component_id: 'c', component_responsibility: 'r',
      completion_criteria: [],
      technical_spec_ids: ['spec-001', 'spec-002'],
    };
    const t = normalizeRootTaskShape(raw, 0, constraints);
    expect(t.traces_to).toEqual(['spec-001', 'spec-002']);
  });
});
