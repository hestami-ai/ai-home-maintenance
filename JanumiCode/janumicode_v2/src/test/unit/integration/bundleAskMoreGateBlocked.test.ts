/**
 * Regression test for the ask-more invariant: while a user is in a Q&A
 * thread about a specific Mirror row or Menu option, the phase gate
 * stays blocked. The gate only resolves when the user eventually hits
 * Submit on the composite DecisionBundleCard.
 *
 * This guards against two subtle regressions:
 *   1. Ask-more writing an open_query_received accidentally resolving
 *      the pending decision (a code smell pattern where a helper tries
 *      to be "useful" by calling engine.resolveDecision).
 *   2. The Liaison treating a query that mentions @bundle:<id> as a
 *      decision itself.
 *
 * The test wires up a real engine, presents a bundle, starts an
 * ask-more open_query, and asserts the pending decision promise is
 * still unsettled. Then it submits the bundle and confirms the gate
 * resolves with a decision_bundle_resolution.
 */

import { describe, it, expect } from 'vitest';
import { driveWorkflow, type CapturedStream } from '../../helpers/workflowDriver';
import { makeUserInput } from '../../../lib/agents/clientLiaisonAgent';
import type { CapabilityContext } from '../../../lib/agents/clientLiaison/capabilities/index';
import type { DecisionBundleContent } from '../../../lib/types/decisionBundle';
import { DecisionRouter } from '../../../lib/orchestrator/decisionRouter';

const BLOOM_FIXTURE = {
  match: 'Intent Domain Bloom',
  parsedJson: {
    candidate_product_concepts: [
      {
        id: 'c1',
        name: 'CLI todo',
        description: 'Local terminal-native task tracker.',
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
    out_of_scope: [],
  },
};

describe('Decision bundle — ask-more does not resolve the phase gate', () => {
  let stream: CapturedStream | null = null;
  function tearDown() { if (stream) { stream.cleanup(); stream = null; } }

  it('lets the user run an open_query against @bundle while pauseForDecision stays pending', async () => {
    // driveWorkflow auto-approves decisions, so we disable autoApprove
    // here to keep the bundle's pauseForDecision unsettled. We then
    // manually present a new bundle + start our own pause, simulating
    // the real phase-handler behavior.
    stream = await driveWorkflow({
      intent: 'Build a CLI todo app',
      llmFixtures: { bloom: BLOOM_FIXTURE, synthesis: SYNTHESIS_FIXTURE },
    });

    try {
      const runId = stream.workflowRunId;
      if (!runId) throw new Error('driveWorkflow did not start a run');
      const { engine, liaison } = stream;
      const db = liaison.getDB();

      // Present a fresh bundle to test against — the workflow's existing
      // bundles are already resolved by autoApprove.
      const bundleContent: DecisionBundleContent = {
        surface_id: 'surface-ask-more',
        title: 'Pick backend',
        mirror: {
          kind: 'assumption_mirror',
          items: [{ id: 'a1', text: 'Local SQLite storage' }],
        },
        menu: {
          question: 'Storage backend',
          multi_select: false,
          allow_free_text: false,
          options: [
            { id: 'sqlite', label: 'SQLite' },
            { id: 'pg', label: 'Postgres' },
          ],
        },
      };
      const bundleRecord = engine.writer.writeRecord({
        record_type: 'decision_bundle_presented',
        schema_version: '1.0',
        workflow_run_id: runId,
        phase_id: '1',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        content: bundleContent as unknown as Record<string, unknown>,
      });

      // Pause for decision — this is the real "phase gate blocked" state.
      engine.setAutoApproveDecisions(false);
      let gateResolved = false;
      const gatePromise = engine.pauseForDecision(runId, bundleRecord.id, 'decision_bundle')
        .then(r => { gateResolved = true; return r; });

      // Issue an ask-more open_query referencing the bundle.
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
        embedding: stream!.engine['embedding'] ?? ({} as never),
      };
      const askMore = makeUserInput({
        text: `@bundle:${bundleRecord.id}:mirror:a1\n\nWhy SQLite here rather than Postgres?`,
        inputMode: 'open_query',
        workflowRunId: runId,
        currentPhaseId: '1',
      });
      await liaison.handleUserInput(askMore, ctx);

      // Gate must still be unresolved after the ask-more round-trip.
      await new Promise(r => setTimeout(r, 50));
      expect(gateResolved).toBe(false);

      // Client_liaison_response landed (the Q&A happened).
      const responses = engine.writer
        .getRecordsByType(runId, 'client_liaison_response')
        .filter(r => {
          const c = r.content as { response_text?: string };
          return typeof c.response_text === 'string';
        });
      expect(responses.length).toBeGreaterThan(0);

      // Now submit the bundle — this should resolve the gate.
      const router = new DecisionRouter(engine);
      router.routeBundle(runId, {
        recordId: bundleRecord.id,
        surfaceId: bundleContent.surface_id,
        mirrorDecisions: [{ item_id: 'a1', action: 'accepted' }],
        menuSelections: [{ option_id: 'sqlite' }],
      });
      const resolution = await Promise.race([
        gatePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 500)),
      ]);
      expect((resolution as { type: string }).type).toBe('decision_bundle_resolution');
    } finally {
      tearDown();
    }
  });
});
