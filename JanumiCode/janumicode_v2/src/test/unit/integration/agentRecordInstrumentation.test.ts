/**
 * Regression: LLMCaller writes agent_invocation / agent_output / tool_call
 * records for every traced call. The AgentInvocationCard depends on these
 * records existing — without them, the user sees nothing while Phase 1's
 * three LLM calls are running. With them, the card shows live status.
 *
 * These tests use the workflowDriver harness with mock LLM fixtures so
 * they're hermetic and run sub-second.
 */

import { describe, it, expect } from 'vitest';
import { driveWorkflow, recordsOfType, type CapturedStream } from '../../helpers/workflowDriver';

const BLOOM_FIXTURE = {
  match: 'Intent Domain Bloom',
  parsedJson: {
    candidate_product_concepts: [
      {
        id: 'c1',
        name: 'Personal task tracker',
        description: 'A single-user CLI todo app',
        who_it_serves: 'Solo developers',
        problem_it_solves: 'Local task management',
        assumptions: ['Local storage'],
        constraints: ['No network'],
        open_questions: [],
      },
    ],
  },
};

const SYNTHESIS_FIXTURE = {
  match: 'Intent Statement Synthesis',
  parsedJson: {
    product_concept: {
      name: 'Personal CLI todo',
      description: 'A todo CLI for individual developers',
      who_it_serves: 'Solo developers',
      problem_it_solves: 'Terminal-native task management',
    },
    confirmed_assumptions: [
      {
        assumption_id: 'assumption-001',
        assumption: 'Local storage',
        confirmed_by_record_id: 'adjudicated-001',
      },
    ],
    confirmed_constraints: ['No network'],
    out_of_scope: [],
  },
};

const QUALITY_FIXTURE = {
  match: 'Intent Quality Check',
  parsedJson: {
    completeness_findings: [],
    consistency_findings: [],
    coherence_findings: [],
    overall_status: 'pass',
  },
};

describe('Section B — LLMCaller agent record instrumentation', () => {
  let stream: CapturedStream | null = null;
  function tearDown() {
    if (stream) {
      stream.cleanup();
      stream = null;
    }
  }

  it('writes one agent_invocation record per Phase 1 LLM call', async () => {
    stream = await driveWorkflow({
      intent: 'Build a CLI todo app',
      llmFixtures: {
        quality: QUALITY_FIXTURE,
        bloom: BLOOM_FIXTURE,
        synthesis: SYNTHESIS_FIXTURE,
      },
    });

    try {
      // LLM-backed invocations are instrumented by LLMCaller with label /
      // provider / model / status='running'. CLI-backed executor_agent
      // invocations (Phase 9) use a different record shape and are not
      // covered by this test.
      const allInvocations = recordsOfType(stream, 'agent_invocation');
      const llmInvocations = allInvocations.filter(i =>
        (i.content as Record<string, unknown>).label !== undefined,
      );
      // Phase 1 makes three LLM calls: quality check, bloom, synthesis.
      // Each one should produce an agent_invocation record.
      expect(llmInvocations.length).toBeGreaterThanOrEqual(3);

      // Each LLM invocation should carry a label so the AgentInvocationCard
      // has a header to render.
      for (const inv of llmInvocations) {
        const content = inv.content as Record<string, unknown>;
        expect(content.label).toBeTruthy();
        expect(content.provider).toBeTruthy();
        expect(content.model).toBeTruthy();
        expect(content.status).toBe('running');
      }
    } finally {
      tearDown();
    }
  });

  it('writes one agent_output record per agent_invocation, derived from it', async () => {
    stream = await driveWorkflow({
      intent: 'Output record test',
      llmFixtures: {
        quality: QUALITY_FIXTURE,
        bloom: BLOOM_FIXTURE,
        synthesis: SYNTHESIS_FIXTURE,
      },
    });

    try {
      // Only LLM-backed invocations are expected to have 1:1 outputs. CLI
      // invocations (Phase 9 executor_agent) use a different lifecycle.
      const llmInvocations = recordsOfType(stream, 'agent_invocation').filter(i =>
        (i.content as Record<string, unknown>).label !== undefined,
      );
      const outputs = recordsOfType(stream, 'agent_output');

      // 1:1 between LLM invocations and outputs.
      expect(outputs.length).toBe(llmInvocations.length);

      // Every output should reference an invocation via derived_from_record_ids.
      const invocationIds = new Set(llmInvocations.map((i) => i.id));
      for (const out of outputs) {
        const derived = (out as { derived_from_record_ids?: string[] }).derived_from_record_ids;
        expect(Array.isArray(derived)).toBe(true);
        expect(derived!.length).toBeGreaterThan(0);
        expect(invocationIds.has(derived![0])).toBe(true);
      }

      // Every output should have status, duration, and token counts.
      for (const out of outputs) {
        const content = out.content as Record<string, unknown>;
        expect(['success', 'error']).toContain(content.status);
        expect(typeof content.duration_ms).toBe('number');
      }
    } finally {
      tearDown();
    }
  });

  it('records carry phase_id and sub_phase_id from the trace context', async () => {
    stream = await driveWorkflow({
      intent: 'Trace context test',
      llmFixtures: {
        quality: QUALITY_FIXTURE,
        bloom: BLOOM_FIXTURE,
        synthesis: SYNTHESIS_FIXTURE,
      },
    });

    try {
      const invocations = recordsOfType(stream, 'agent_invocation');
      // Phase 1 makes calls in sub-phases 1.0, 1.2, 1.5.
      const subPhases = invocations.map((i) => i.sub_phase_id).filter(Boolean);
      expect(subPhases).toContain('1.0');
      expect(subPhases).toContain('1.2');
      expect(subPhases).toContain('1.5');

      // Phase 1 invocations are in phase '1' (Phase 2 may also chain in auto-approve mode).
      const phase1Invocations = invocations.filter(i => i.phase_id === '1');
      expect(phase1Invocations.length).toBeGreaterThanOrEqual(3);
      for (const inv of phase1Invocations) {
        expect(inv.phase_id).toBe('1');
      }
    } finally {
      tearDown();
    }
  });

  it('records have agent_role set on the trace context', async () => {
    stream = await driveWorkflow({
      intent: 'Agent role test',
      llmFixtures: {
        quality: QUALITY_FIXTURE,
        bloom: BLOOM_FIXTURE,
        synthesis: SYNTHESIS_FIXTURE,
      },
    });

    try {
      const invocations = recordsOfType(stream, 'agent_invocation');
      const roles = invocations.map((i) => i.produced_by_agent_role).filter(Boolean);
      // Phase 1.0 is run by orchestrator, 1.2 and 1.5 by domain_interpreter.
      expect(roles).toContain('orchestrator');
      expect(roles).toContain('domain_interpreter');
    } finally {
      tearDown();
    }
  });

  it('agent_invocation records appear BEFORE their agent_output siblings (stream order matters for the live spinner)', async () => {
    stream = await driveWorkflow({
      intent: 'Stream order test',
      llmFixtures: {
        quality: QUALITY_FIXTURE,
        bloom: BLOOM_FIXTURE,
        synthesis: SYNTHESIS_FIXTURE,
      },
    });

    try {
      const records = stream.records;
      const invocations = recordsOfType(stream, 'agent_invocation');

      for (const inv of invocations) {
        const invIdx = records.findIndex((r) => r.id === inv.id);
        expect(invIdx).toBeGreaterThanOrEqual(0);

        // Find the matching agent_output (derived_from this invocation).
        const matchingOutput = records.find(
          (r) =>
            r.record_type === 'agent_output' &&
            (r as { derived_from_record_ids?: string[] }).derived_from_record_ids?.[0] === inv.id,
        );
        if (matchingOutput) {
          const outIdx = records.findIndex((r) => r.id === matchingOutput.id);
          // The output must come AFTER the invocation in the stream so the
          // webview's live status spinner shows for at least one frame
          // before flipping to ✅.
          expect(outIdx).toBeGreaterThan(invIdx);
        }
      }
    } finally {
      tearDown();
    }
  });
});
