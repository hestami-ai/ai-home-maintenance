/**
 * Regression test for the client_liaison_response record produced when a
 * user submits a raw intent (the very first message that starts a workflow).
 *
 * The bug this guards against: handleUserInput skipped writing an input
 * record in raw_intent mode (the raw_intent_received is created later
 * inside engine.startWorkflowRun()) and therefore wrote the response
 * record with `derived_from_record_ids: []` and no phase/role. Three
 * downstream consequences:
 *
 *   1. The webview's conversationalSort had no anchor to pin the
 *      "Started workflow run…" card under the user's intent, so it
 *      landed at the bottom of the stream.
 *   2. The DB had a row of NULLs for phase_id, sub_phase_id, and
 *      produced_by_agent_role — making the record opaque to any audit
 *      query that filtered on those fields.
 *   3. There was no provenance link from the response back to the
 *      raw intent — breaking the conversation history pairing on the
 *      first turn.
 *
 * The fix wires the response record to the raw_intent_received via a
 * post-synthesis lookup, and stamps phase_id='0' + agent_role='client_liaison'.
 */

import { describe, it, expect } from 'vitest';
import { driveWorkflow, type CapturedStream } from '../../helpers/workflowDriver';

const BLOOM_FIXTURE = {
  match: 'Intent Domain Bloom',
  parsedJson: {
    candidate_product_concepts: [
      {
        id: 'c1',
        name: 'CLI todo',
        description: 'Local CLI todo tracker',
        who_it_serves: 'Solo developers',
        problem_it_solves: 'Terminal-native task management',
        assumptions: ['Local SQLite storage'],
        constraints: ['No network calls'],
        open_questions: [],
      },
    ],
  },
};

const SYNTHESIS_FIXTURE = {
  match: 'Intent Statement Synthesis',
  parsedJson: {
    product_concept: {
      name: 'CLI todo',
      description: 'Local CLI todo tracker',
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
    out_of_scope: [],
  },
};

describe('Client Liaison — raw_intent response provenance', () => {
  let stream: CapturedStream | null = null;
  function tearDown() {
    if (stream) { stream.cleanup(); stream = null; }
  }

  it('anchors the response to the raw_intent_received and stamps phase + agent role', async () => {
    stream = await driveWorkflow({
      intent: 'Build a CLI todo app',
      llmFixtures: { bloom: BLOOM_FIXTURE, synthesis: SYNTHESIS_FIXTURE },
    });

    try {
      const runId = stream.workflowRunId;
      expect(runId).toBeTruthy();
      if (!runId) throw new Error('driveWorkflow did not start a run');

      const db = stream.liaison.getDB();
      const rawIntents = db.getRecordsByType('raw_intent_received', runId);
      const responses = db.getRecordsByType('client_liaison_response', runId);

      expect(rawIntents.length).toBeGreaterThan(0);
      const rawIntent = rawIntents[rawIntents.length - 1];

      // The first liaison response (workflow_initiation reply) must point
      // back at the raw_intent_received via derived_from_record_ids.
      const initResponse = responses.find((r) => {
        const c = r.content as { query_type?: string };
        return c.query_type === 'workflow_initiation';
      });
      expect(initResponse).toBeDefined();
      expect(initResponse?.derived_from_record_ids).toContain(rawIntent.id);

      // And it must carry the metadata that lets audit queries / the
      // webview's conversationalSort treat it as a real Liaison record
      // rather than a row of NULLs.
      expect(initResponse?.phase_id).toBe('0');
      expect(initResponse?.produced_by_agent_role).toBe('client_liaison');
    } finally {
      tearDown();
    }
  });
});
