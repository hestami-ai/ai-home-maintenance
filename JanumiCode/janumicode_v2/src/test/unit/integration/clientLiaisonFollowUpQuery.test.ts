/**
 * Virtuous-cycle integration test for the Universal Router.
 *
 * Drives a normal workflow to quiescence with MockLLMProvider fixtures,
 * then issues a follow-up `open_query` through the Client Liaison Agent
 * and asserts the end-to-end machinery works:
 *
 *   1. `open_query_received` + `client_liaison_response` pair written
 *      to the governed stream, linked via `derived_from_record_ids`.
 *   2. `getRecentConversationTurns()` pairs them correctly, so the
 *      synthesizer's multi-turn history is populated on the next turn.
 *   3. The Retriever delegated to DMR (by default the classifier falls
 *      back to `ambient_clarification`, which is a DMR-delegated query
 *      type) — we verify by checking that DMR's own governed-stream
 *      records (`retrieval_brief_record`, `context_packet`) appear.
 *
 * This is the closest unit-scope reproduction of the user-facing loop:
 * build → question → answer → question again. If any of the plumbing
 * between Liaison, Retriever, DMR, and the governed stream breaks,
 * this test fails long before anyone boots the CLI.
 */

import { describe, it, expect } from 'vitest';
import {
  driveWorkflow,
  type CapturedStream,
} from '../../helpers/workflowDriver';
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
    confirmed_assumptions: [
      {
        assumption_id: 'assumption-001',
        assumption: 'Local SQLite storage',
        confirmed_by_record_id: 'adjudicated-001',
      },
    ],
    confirmed_constraints: ['No network calls'],
    out_of_scope: ['Team features'],
  },
};

describe('Client Liaison follow-up open-query (virtuous cycle)', () => {
  let stream: CapturedStream | null = null;

  function tearDown() {
    if (stream) {
      stream.cleanup();
      stream = null;
    }
  }

  it('round-trips an open_query through DMR delegation and writes the full record pair', async () => {
    stream = await driveWorkflow({
      intent: 'Build a CLI todo app',
      llmFixtures: {
        bloom: BLOOM_FIXTURE,
        synthesis: SYNTHESIS_FIXTURE,
      },
    });

    try {
      const runId = stream.workflowRunId;
      expect(runId).toBeTruthy();
      if (!runId) throw new Error('driveWorkflow did not start a run');

      const { liaison, engine } = stream;
      const db = liaison.getDB();

      // Build an open-query follow-up — the kind of thing a user types
      // after the build finishes: "why did we go with SQLite?".
      const followUp = makeUserInput({
        text: 'Why did we choose SQLite for storage?',
        inputMode: 'open_query',
        workflowRunId: runId,
        currentPhaseId: '1',
      });

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

      const response = await liaison.handleUserInput(followUp, ctx);

      // 1. Response shape.
      expect(response.queryId).toBeTruthy();
      expect(typeof response.responseText).toBe('string');
      // In mock mode the synthesizer LLM returns empty text; the agent's
      // fallback surfaces a visible message so the user isn't left hanging.
      expect(response.responseText.length).toBeGreaterThan(0);

      // 2. Record pair landed in the stream.
      const openQueries = db.getRecordsByType('open_query_received', runId);
      const responses = db.getRecordsByType('client_liaison_response', runId);

      const queryRec = openQueries.find(
        r => (r.content as { text?: string }).text === 'Why did we choose SQLite for storage?',
      );
      expect(queryRec).toBeDefined();
      if (!queryRec) throw new Error('unreachable');

      const responseRec = responses.find(
        r => r.derived_from_record_ids?.includes(queryRec.id),
      );
      expect(responseRec).toBeDefined();
      expect(responseRec?.derived_from_record_ids).toContain(queryRec?.id);

      // 3. Multi-turn history pairs correctly — the next synthesizer call
      //    would see this turn in its conversation_history.
      const turns = db.getRecentConversationTurns(runId, 5);
      expect(turns.length).toBeGreaterThan(0);
      const matched = turns.find(t => t.queryRecord.id === queryRec?.id);
      expect(matched).toBeDefined();
      expect(matched?.responseRecord.id).toBe(responseRec?.id);

      // 4. DMR was invoked — it writes its own governed-stream records
      //    (retrieval_brief_record, context_packet) when attached to a
      //    writer. Check the stream includes at least one of these, which
      //    proves the Retriever dispatched to DMR rather than the legacy
      //    FTS-only path.
      const dmrBriefs = db.getRecordsByType('retrieval_brief_record', runId);
      const dmrPackets = db.getRecordsByType('context_packet', runId);
      expect(dmrBriefs.length + dmrPackets.length).toBeGreaterThan(0);
    } finally {
      tearDown();
    }
  });

  it('two sequential open-queries produce two paired turns in order', async () => {
    stream = await driveWorkflow({
      intent: 'Build a CLI todo app',
      llmFixtures: {
        bloom: BLOOM_FIXTURE,
        synthesis: SYNTHESIS_FIXTURE,
      },
    });

    try {
      const runId = stream.workflowRunId;
      if (!runId) throw new Error('driveWorkflow did not start a run');

      const { liaison, engine } = stream;
      const db = liaison.getDB();
      const run = engine.stateMachine.getWorkflowRun(runId);

      const buildCtx = (): CapabilityContext => ({
        workspaceId: 'test-workspace',
        workspaceRoot: '/ws',
        activeRun: run,
        currentPhase: run?.current_phase_id ?? '1',
        currentSubPhase: run?.current_sub_phase_id ?? null,
        runStatus: run?.status ?? null,
        orchestrator: engine,
        db,
        eventBus: engine.eventBus,
        embedding: stream!.engine['embedding'] ?? ({} as never),
      });

      await liaison.handleUserInput(
        makeUserInput({
          text: 'Question one',
          inputMode: 'open_query',
          workflowRunId: runId,
          currentPhaseId: '1',
        }),
        buildCtx(),
      );
      // Small spacing so produced_at is strictly monotonic between turns.
      await new Promise((r) => setTimeout(r, 2));
      await liaison.handleUserInput(
        makeUserInput({
          text: 'Question two',
          inputMode: 'open_query',
          workflowRunId: runId,
          currentPhaseId: '1',
        }),
        buildCtx(),
      );

      const turns = db.getRecentConversationTurns(runId, 5);
      // Collect the query texts — there may be workflow-internal response
      // records too (e.g. a workflow_initiation response from driveWorkflow),
      // but the two open-query turns must appear.
      const texts = turns.map(t => t.queryRecord.content.text as string);
      expect(texts).toContain('Question one');
      expect(texts).toContain('Question two');

      // Oldest-first ordering means 'Question one' appears before 'Question two'.
      const idxOne = texts.indexOf('Question one');
      const idxTwo = texts.indexOf('Question two');
      expect(idxOne).toBeLessThan(idxTwo);
    } finally {
      tearDown();
    }
  });
});
