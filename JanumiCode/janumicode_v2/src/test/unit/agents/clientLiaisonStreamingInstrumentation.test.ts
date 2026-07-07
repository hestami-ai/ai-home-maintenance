/**
 * Increment 1 — Liaison streaming instrumentation.
 *
 * The synthesizer's LLM call now carries a `traceContext` (agentRole
 * `client_liaison`) and the agent's PriorityLLMCaller is wired with the
 * engine's writer. Together these make every open-query answer:
 *   1. write an `agent_invocation` (+ `agent_output`) record — previously
 *      the liaison's LLM calls were entirely uninstrumented/invisible; and
 *   2. emit `llm:stream_chunk` events for live token streaming (the webview
 *      renders them via the existing streamingStore path).
 *
 * This test proves (1) end-to-end through the real driveWorkflow harness
 * (GPU-free, MockLLMProvider) and that the labelled priority-lane events
 * now identify the liaison. It also guards that instrumentation did not
 * break the user-visible answer or spawn a reasoning-review pass on the
 * chat turn (the review harness hook is deliberately not attached to the
 * liaison caller).
 */

import { describe, it, expect } from 'vitest';
import { driveWorkflow, type CapturedStream } from '../../helpers/workflowDriver';
import { makeUserInput } from '../../../lib/agents/clientLiaisonAgent';
import type { CapabilityContext } from '../../../lib/agents/clientLiaison/capabilities/index';

const BLOOM_FIXTURE = {
  match: 'Intent Domain Bloom',
  parsedJson: {
    candidate_product_concepts: [
      {
        id: 'c1',
        name: 'Personal task tracker',
        description: 'Local CLI todo with SQLite storage.',
        who_it_serves: 'Solo developers',
        problem_it_solves: 'Terminal-native task management',
        assumptions: ['Local SQLite storage'],
        constraints: ['No network calls'],
        open_questions: ['How are recurring tasks handled?'],
      },
    ],
  },
};

const SYNTHESIS_FIXTURE = {
  match: 'Intent Statement Synthesis',
  parsedJson: {
    product_concept: {
      name: 'Personal CLI todo',
      description: 'Personal task tracker',
      who_it_serves: 'Solo developers',
      problem_it_solves: 'Terminal-native task management',
    },
    confirmed_assumptions: [],
    confirmed_constraints: ['No network calls'],
    out_of_scope: ['Team features'],
  },
};

describe('Client Liaison streaming instrumentation (Increment 1)', () => {
  let stream: CapturedStream | null = null;

  function tearDown() {
    if (stream) {
      stream.cleanup();
      stream = null;
    }
  }

  it('instruments the synthesizer answer as a client_liaison agent_invocation', async () => {
    stream = await driveWorkflow({
      intent: 'Build a CLI todo app',
      llmFixtures: { bloom: BLOOM_FIXTURE, synthesis: SYNTHESIS_FIXTURE },
    });

    try {
      const runId = stream.workflowRunId;
      if (!runId) throw new Error('driveWorkflow did not start a run');

      const { liaison, engine } = stream;
      const db = liaison.getDB();
      const run = engine.stateMachine.getWorkflowRun(runId);
      const ctx: CapabilityContext = {
        workspaceId: 'test-workspace',
        workspaceRoot: '/ws',
        activeRun: run,
        currentPhase: run?.current_phase_id ?? '1',
        currentSubPhase: run?.current_sub_phase_id ?? null,
        runStatus: run?.status ?? null,
        orchestrator: engine,
        db,
        eventBus: engine.eventBus,
        embedding: stream.engine['embedding'] ?? ({} as never),
      };

      // Baseline: no liaison agent_invocation exists before the open query.
      const before = db
        .getRecordsByType('agent_invocation', runId)
        .filter((r) => r.produced_by_agent_role === 'client_liaison');

      const response = await liaison.handleUserInput(
        makeUserInput({
          text: 'Why did we choose SQLite for storage?',
          inputMode: 'open_query',
          workflowRunId: runId,
          currentPhaseId: '1',
        }),
        ctx,
      );

      // Answer still works (instrumentation is transparent to the user).
      expect(response.responseText.length).toBeGreaterThan(0);

      // A client_liaison agent_invocation now exists that did not before —
      // proof that setWriter + traceContext are both wired.
      const after = db
        .getRecordsByType('agent_invocation', runId)
        .filter((r) => r.produced_by_agent_role === 'client_liaison');
      expect(after.length).toBeGreaterThan(before.length);

      const invocation = after[after.length - 1];
      expect((invocation.content as { label?: string }).label).toBe(
        'Client Liaison — response',
      );

      // The invocation is properly rooted in the run + phase (streamable).
      expect(invocation.workflow_run_id).toBe(runId);

      // Instrumentation must not trigger a reasoning-review pass on the chat
      // turn (the review harness hook is not attached to the liaison caller).
      const reviews = db
        .getRecordsByType('reasoning_review_record', runId)
        .filter((r) => r.derived_from_record_ids?.includes(invocation.id));
      expect(reviews.length).toBe(0);
    } finally {
      tearDown();
    }
  });

  it('labels the priority-lane events as the client liaison', async () => {
    stream = await driveWorkflow({
      intent: 'Build a CLI todo app',
      llmFixtures: { bloom: BLOOM_FIXTURE, synthesis: SYNTHESIS_FIXTURE },
    });

    try {
      const runId = stream.workflowRunId;
      if (!runId) throw new Error('driveWorkflow did not start a run');

      const { liaison, engine } = stream;
      const db = liaison.getDB();
      const run = engine.stateMachine.getWorkflowRun(runId);
      const ctx: CapabilityContext = {
        workspaceId: 'test-workspace',
        workspaceRoot: '/ws',
        activeRun: run,
        currentPhase: run?.current_phase_id ?? '1',
        currentSubPhase: run?.current_sub_phase_id ?? null,
        runStatus: run?.status ?? null,
        orchestrator: engine,
        db,
        eventBus: engine.eventBus,
        embedding: stream.engine['embedding'] ?? ({} as never),
      };

      await liaison.handleUserInput(
        makeUserInput({
          text: 'What is the current status?',
          inputMode: 'open_query',
          workflowRunId: runId,
          currentPhaseId: '1',
        }),
        ctx,
      );

      const liaisonStarts = stream.events.filter(
        (e) =>
          e.type === 'llm:started' &&
          (e.payload as { agentRole?: string | null }).agentRole === 'client_liaison',
      );
      expect(liaisonStarts.length).toBeGreaterThan(0);
    } finally {
      tearDown();
    }
  });
});
