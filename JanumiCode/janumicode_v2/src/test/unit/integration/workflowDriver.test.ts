/**
 * Layer A regression tests — workflowDriver harness.
 *
 * These tests pin the contract of `driveWorkflow()` so that any future engine
 * change that breaks the in-process bootstrap is caught immediately. The
 * harness is the bread-and-butter debug loop for the rest of Wave 5b — every
 * subsequent section will be validated by spinning up a driver, asserting on
 * the captured stream, and iterating in <1s.
 */

import { describe, it, expect } from 'vitest';
import {
  driveWorkflow,
  recordsOfType,
  formatStream,
  type CapturedStream,
} from '../../helpers/workflowDriver';

const BLOOM_FIXTURE = {
  match: 'Intent Domain Bloom',
  parsedJson: {
    candidate_product_concepts: [
      {
        id: 'c1',
        name: 'Personal task tracker',
        description: 'A single-user CLI todo app for tracking personal tasks.',
        who_it_serves: 'Solo developers',
        problem_it_solves: 'Lightweight, terminal-native task management',
        assumptions: ['No multi-user support', 'Local SQLite storage'],
        constraints: ['No network calls'],
        open_questions: ['How are recurring tasks handled?'],
      },
      {
        id: 'c2',
        name: 'Team task tracker',
        description: 'A multi-user CLI for shared team task lists via a central server.',
        who_it_serves: 'Small dev teams',
        problem_it_solves: 'Lightweight team coordination',
        assumptions: ['Server-backed', 'Role-based permissions'],
        constraints: ['Requires running a backend'],
        open_questions: ['What auth mechanism?'],
      },
    ],
  },
};

const SYNTHESIS_FIXTURE = {
  match: 'Intent Statement Synthesis',
  parsedJson: {
    product_concept: {
      name: 'Personal CLI todo',
      description: 'Personal task tracker for individual developers',
      who_it_serves: 'Solo developers',
      problem_it_solves: 'Terminal-native task management',
    },
    confirmed_assumptions: [
      {
        assumption_id: 'assumption-001',
        assumption: 'No multi-user support',
        confirmed_by_record_id: 'adjudicated-001',
      },
      {
        assumption_id: 'assumption-002',
        assumption: 'Local SQLite storage',
        confirmed_by_record_id: 'adjudicated-001',
      },
    ],
    confirmed_constraints: ['No network calls'],
    out_of_scope: ['Team features'],
  },
};

describe('Layer A — workflowDriver', () => {
  let stream: CapturedStream | null = null;

  function tearDown() {
    if (stream) {
      stream.cleanup();
      stream = null;
    }
  }

  it('drives a fresh workflow from intent to a quiescent Phase 1 in under 5s', async () => {
    stream = await driveWorkflow({
      intent: 'Build a CLI todo app for personal use',
      llmFixtures: {
        bloom: BLOOM_FIXTURE,
        synthesis: SYNTHESIS_FIXTURE,
      },
    });

    try {
      expect(stream.workflowRunId).toBeTruthy();
      expect(stream.durationMs).toBeLessThan(5000);

      // The driver should have produced a meaningful record stream — not just
      // the bare workflow_initiated record. With auto-approve on, Phase 1
      // marches through bloom → mirror → menu → synthesis → approval → gate.
      expect(stream.records.length).toBeGreaterThan(5);

      // The user's intent must be captured in a raw_intent_received record.
      const rawIntents = recordsOfType(stream, 'raw_intent_received');
      expect(rawIntents.length).toBeGreaterThanOrEqual(1);
      const rawIntent = rawIntents[0];
      // The Liaison handleUserInput writes the user-input record; whether the
      // text comes from there or from startWorkflowRun, at least one of them
      // must contain the user prompt.
      const allRawIntentText = rawIntents
        .map((r) => (r.content as { text?: string }).text ?? '')
        .join(' ');
      expect(allRawIntentText).toContain('Build a CLI todo app');
    } finally {
      tearDown();
    }
  });

  it('captures phase:started events for both Phase 0 and Phase 1', async () => {
    stream = await driveWorkflow({
      intent: 'Test phase event capture',
      llmFixtures: { bloom: BLOOM_FIXTURE, synthesis: SYNTHESIS_FIXTURE },
    });

    try {
      const phaseStarted = stream.events.filter((e) => e.type === 'phase:started');
      const phaseIds = phaseStarted.map(
        (e) => (e.payload as { phaseId?: string }).phaseId,
      );
      expect(phaseIds).toContain('0');
      expect(phaseIds).toContain('1');
    } finally {
      tearDown();
    }
  });

  it('every captured record has a record_type and is structured-clone safe', async () => {
    stream = await driveWorkflow({
      intent: 'Structured clone safety check',
      llmFixtures: { bloom: BLOOM_FIXTURE, synthesis: SYNTHESIS_FIXTURE },
    });

    try {
      for (const record of stream.records) {
        expect(record.record_type).toBeTruthy();
        // structuredClone catches the same Proxy-leak failure mode as VS
        // Code's webview postMessage. If the workflow ever produces a record
        // wrapped in a Svelte $state Proxy or with a function field, this
        // assertion fires.
        expect(() => structuredClone(record)).not.toThrow();
      }
    } finally {
      tearDown();
    }
  });

  it('auto-approve mode resolves all pending decisions without hanging', async () => {
    // The whole point of auto-approve: the test doesn't have to drive
    // mirror approvals manually. Phase 1's bloom mirror, prune menu, and
    // intent_statement approval mirror all auto-resolve.
    stream = await driveWorkflow({
      intent: 'Auto-approve smoke test',
      autoApprove: true,
      llmFixtures: { bloom: BLOOM_FIXTURE, synthesis: SYNTHESIS_FIXTURE },
    });

    try {
      // After Phase 1 completes (or is paused at the gate), the engine
      // should have no lingering pending decisions in its in-memory map.
      // Reach into the private map via bracket-access — this is a regression
      // signal so we want to be specific about it.
      const pendingMap = stream.engine['pendingDecisions'] as Map<string, unknown>;
      expect(pendingMap.size).toBe(0);
    } finally {
      tearDown();
    }
  });

  it('formatStream produces a readable debug summary', async () => {
    stream = await driveWorkflow({
      intent: 'Debug formatter test',
      llmFixtures: { bloom: BLOOM_FIXTURE, synthesis: SYNTHESIS_FIXTURE },
    });

    try {
      const formatted = formatStream(stream);
      expect(formatted).toContain('Captured workflow stream');
      expect(formatted).toContain('raw_intent_received');
    } finally {
      tearDown();
    }
  });

  it('returns a LiaisonResponse with the expected shape', async () => {
    stream = await driveWorkflow({
      intent: 'Response shape test',
      llmFixtures: { bloom: BLOOM_FIXTURE, synthesis: SYNTHESIS_FIXTURE },
    });

    try {
      expect(stream.response).toBeDefined();
      expect(stream.response.queryId).toBeTruthy();
      expect(typeof stream.response.responseText).toBe('string');
      expect(Array.isArray(stream.response.provenanceRecordIds)).toBe(true);
      // workflow_initiation is the classification for raw intents.
      expect(stream.response.queryType).toBe('workflow_initiation');
    } finally {
      tearDown();
    }
  });

  it('does not leak the in-memory database after cleanup()', async () => {
    stream = await driveWorkflow({
      intent: 'Cleanup test',
      llmFixtures: { bloom: BLOOM_FIXTURE, synthesis: SYNTHESIS_FIXTURE },
    });

    const dbHandle = stream.db;
    stream.cleanup();
    stream = null;

    // After cleanup the DB should be closed. Trying to prepare a statement
    // throws "TypeError: The database connection is not open" or similar.
    expect(() => dbHandle.prepare('SELECT 1')).toThrow();
  });
});
