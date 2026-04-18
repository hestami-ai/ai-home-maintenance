// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import DmrPipelineCard from '../../../../webview/components/DmrPipelineCard.svelte';
import { mountComponent, makeFakeRecord } from '../../../helpers/svelteTestHelpers';

function makeDmrPipelineRecord(overrides: Record<string, unknown> = {}) {
  return makeFakeRecord({
    record_type: 'dmr_pipeline' as never,
    produced_by_agent_role: 'deep_memory_research' as never,
    content: {
      kind: 'dmr_pipeline',
      pipeline_id: 'pipeline-abc',
      requesting_agent_role: 'domain_interpreter',
      scope_tier: 'current_run',
      query: 'Intent bloom context for: Review Hestami spec …',
      stages: [
        { stage: 1, name: 'Query Decomposition', kind: 'llm', status: 'completed', started_at: '2026-04-18T09:00:00.000Z', completed_at: '2026-04-18T09:00:05.000Z', output_summary: '5 entities, 2 decision types' },
        { stage: 2, name: 'Broad Candidate Harvest', kind: 'deterministic', status: 'completed', started_at: '2026-04-18T09:00:05.000Z', completed_at: '2026-04-18T09:00:06.000Z', output_summary: '18 candidates' },
        { stage: 3, name: 'Materiality Scoring', kind: 'deterministic', status: 'completed', started_at: '2026-04-18T09:00:06.000Z', completed_at: '2026-04-18T09:00:06.500Z', output_summary: '12 scored' },
        { stage: 4, name: 'Relationship Expansion', kind: 'deterministic', status: 'completed', started_at: '2026-04-18T09:00:06.500Z', completed_at: '2026-04-18T09:00:07.000Z', output_summary: '14 expanded' },
        { stage: 5, name: 'Supersession Analysis', kind: 'deterministic', status: 'completed', started_at: '2026-04-18T09:00:07.000Z', completed_at: '2026-04-18T09:00:07.200Z', output_summary: '0 chains, 0 contradictions' },
        { stage: 6, name: 'Gap Detection', kind: 'deterministic', status: 'completed', started_at: '2026-04-18T09:00:07.200Z', completed_at: '2026-04-18T09:00:07.400Z', output_summary: '1 unavailable, 0 gaps' },
        { stage: 7, name: 'Context Packet Synthesis', kind: 'llm', status: 'completed', started_at: '2026-04-18T09:00:07.400Z', completed_at: '2026-04-18T09:00:15.000Z', output_summary: 'completeness: partial_low' },
      ],
      completeness_status: 'partial_low',
      ...overrides,
    },
  });
}

describe('DmrPipelineCard', () => {
  it('renders all 7 stages in one card with stage names + kinds', () => {
    const record = makeDmrPipelineRecord();
    const { container, cleanup } = mountComponent(DmrPipelineCard, { record });
    try {
      expect(container.querySelector('.card-dmr')).toBeTruthy();
      expect(container.textContent).toContain('Deep Memory Research');
      // Every stage name must appear — users were seeing only Stage 1
      // and Stage 7 before this card existed.
      expect(container.textContent).toContain('Query Decomposition');
      expect(container.textContent).toContain('Broad Candidate Harvest');
      expect(container.textContent).toContain('Materiality Scoring');
      expect(container.textContent).toContain('Relationship Expansion');
      expect(container.textContent).toContain('Supersession Analysis');
      expect(container.textContent).toContain('Gap Detection');
      expect(container.textContent).toContain('Context Packet Synthesis');
      // Stage kinds render so the user can see which are LLM vs
      // deterministic (the answer to "why don't I see cards for 2-6?").
      const llmTags = container.querySelectorAll('.stage-kind-llm');
      expect(llmTags.length).toBe(2); // stages 1 and 7
      const detTags = container.querySelectorAll('.stage-kind-deterministic');
      expect(detTags.length).toBe(5); // stages 2-6
    } finally {
      cleanup();
    }
  });

  it('shows completeness status in the header', () => {
    const record = makeDmrPipelineRecord();
    const { container, cleanup } = mountComponent(DmrPipelineCard, { record });
    try {
      expect(container.textContent).toContain('completeness: partial_low');
    } finally {
      cleanup();
    }
  });

  it('renders per-stage output summaries', () => {
    const record = makeDmrPipelineRecord();
    const { container, cleanup } = mountComponent(DmrPipelineCard, { record });
    try {
      expect(container.textContent).toContain('5 entities, 2 decision types');
      expect(container.textContent).toContain('18 candidates');
      expect(container.textContent).toContain('completeness: partial_low');
    } finally {
      cleanup();
    }
  });

  it('shows duration for completed stages with both timestamps', () => {
    const record = makeDmrPipelineRecord();
    const { container, cleanup } = mountComponent(DmrPipelineCard, { record });
    try {
      // Stage 1 took 5 seconds per the fixture; formatter renders as "5.0s"
      const durations = Array.from(container.querySelectorAll('.stage-duration'))
        .map((el) => el.textContent?.trim() ?? '');
      expect(durations).toContain('5.0s');
    } finally {
      cleanup();
    }
  });

  it('handles missing / pending stages without crashing', () => {
    const record = makeDmrPipelineRecord({
      stages: [
        { stage: 1, name: 'Query Decomposition', kind: 'llm', status: 'pending', started_at: null, completed_at: null },
        { stage: 7, name: 'Context Packet Synthesis', kind: 'llm', status: 'pending', started_at: null, completed_at: null },
      ],
    });
    const { container, cleanup } = mountComponent(DmrPipelineCard, { record });
    try {
      expect(container.querySelector('.card-dmr')).toBeTruthy();
      expect(container.textContent).toContain('Query Decomposition');
    } finally {
      cleanup();
    }
  });
});
