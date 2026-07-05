/**
 * PA-10 — the per-node parent block in each saturation loop (task / entity /
 * component) must surface the node's OWN inherited active_constraints (narrowed
 * TECH-* ids). Before: only the global GOVERNING CONSTRAINTS menu was injected,
 * so the model reconstructed which constraints apply to THIS node from
 * instructional examples → wrong/omitted TECH-* on children (correctness, not
 * economy). These pure formatters now render the inherited-constraints line.
 */
import { describe, it, expect } from 'vitest';
import { formatRootTaskForPrompt } from '../../../../lib/orchestrator/phases/phase6_1a';
import { formatEntityForPrompt } from '../../../../lib/orchestrator/phases/phase5_1a';
import { formatRootComponentForPrompt } from '../../../../lib/orchestrator/phases/phase4_2a';
import type { DecompositionTask, DecompositionEntity, DecompositionComponent } from '../../../../lib/types/records';

const task = (active: string[]): DecompositionTask => ({
  id: 'task-1', name: 'T', description: 'd', component_id: 'comp-a', component_responsibility: 'r',
  completion_criteria: [], active_constraints: active,
} as unknown as DecompositionTask);

const entity = (active: string[]): DecompositionEntity => ({
  id: 'DM-x', name: 'X', fields: [{ name: 'id', type: 'uuid' }], relationships: [], active_constraints: active,
} as unknown as DecompositionEntity);

const component = (active: string[]): DecompositionComponent => ({
  id: 'comp-a', name: 'A', responsibilities: [{ id: 'r1', description: 'd' }], dependencies: [], active_constraints: active,
} as unknown as DecompositionComponent);

describe('PA-10 — parent blocks surface inherited active_constraints', () => {
  it('task parent block lists the inherited TECH-* ids', () => {
    const out = formatRootTaskForPrompt(task(['TECH-BUN', 'TECH-POSTGRES']));
    expect(out).toContain('Active constraints (inherited');
    expect(out).toContain('TECH-BUN');
    expect(out).toContain('TECH-POSTGRES');
  });

  it('entity parent block lists the inherited TECH-* ids', () => {
    const out = formatEntityForPrompt(entity(['TECH-POSTGRES']));
    expect(out).toContain('Active constraints (inherited');
    expect(out).toContain('TECH-POSTGRES');
  });

  it('component parent block lists the inherited TECH-* ids', () => {
    const out = formatRootComponentForPrompt(component(['TECH-BUN']));
    expect(out).toContain('Active constraints (inherited');
    expect(out).toContain('TECH-BUN');
  });

  it('renders (none inherited) rather than an empty/undefined slot when the node has no constraints', () => {
    expect(formatRootTaskForPrompt(task([]))).toContain('(none inherited)');
    expect(formatEntityForPrompt(entity([]))).toContain('(none inherited)');
    expect(formatRootComponentForPrompt(component([]))).toContain('(none inherited)');
  });
});
