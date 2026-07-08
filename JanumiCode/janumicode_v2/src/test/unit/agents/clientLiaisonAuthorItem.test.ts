/**
 * Increment 6 — AUTHOR mode (authorItem).
 *
 * A user manually adds an item (e.g. a user journey the bloom under-
 * generated). It must land as a HUMAN-AUTHORED artifact at HumanEdited
 * authority — NOT the Authority-1 Exploratory default a bloom-sub-phase
 * artifact_produced would otherwise get (reverse authority-laundering) — with
 * a human role + provenance so a later scoped re-bloom's gatekeeper can spare
 * it. GPU-free (MockLLMProvider + in-memory DB).
 */

import { describe, it, expect, afterEach } from 'vitest';
import { driveWorkflow, type CapturedStream } from '../../helpers/workflowDriver';
import { AuthorityLevel } from '../../../lib/types/records';
import type { CapabilityContext } from '../../../lib/agents/clientLiaison/capabilities/index';

const BLOOM_FIXTURE = {
  match: 'Intent Domain Bloom',
  parsedJson: {
    candidate_product_concepts: [
      { id: 'c1', name: 'x', description: 'y', who_it_serves: 'z', problem_it_solves: 'w', assumptions: [], constraints: [], open_questions: [] },
    ],
  },
};
const SYNTHESIS_FIXTURE = {
  match: 'Intent Statement Synthesis',
  parsedJson: {
    product_concept: { name: 'x', description: 'y', who_it_serves: 'z', problem_it_solves: 'w' },
    confirmed_assumptions: [], confirmed_constraints: [], out_of_scope: [],
  },
};

describe('authorItem — AUTHOR mode (Increment 6)', () => {
  let stream: CapturedStream | null = null;
  afterEach(() => { stream?.cleanup(); stream = null; });

  it('mints a human-authored artifact at HumanEdited with human role + provenance', async () => {
    stream = await driveWorkflow({
      intent: 'Build a CLI todo app',
      llmFixtures: { bloom: BLOOM_FIXTURE, synthesis: SYNTHESIS_FIXTURE },
    });
    const runId = stream.workflowRunId;
    if (!runId) throw new Error('no run');
    const { liaison, engine } = stream;
    const db = liaison.getDB();
    const run = engine.stateMachine.getWorkflowRun(runId);
    const ctx: CapabilityContext = {
      workspaceId: 'w', workspaceRoot: '/w', activeRun: run,
      currentPhase: run?.current_phase_id ?? '1', currentSubPhase: null,
      runStatus: run?.status ?? null, orchestrator: engine, db,
      eventBus: engine.eventBus, embedding: stream.engine['embedding'] ?? ({} as never),
    };

    const { result } = await liaison.runCapability(
      'authorItem',
      {
        kind: 'user_journey',
        title: 'Admin exports a compliance report',
        description: 'As an admin, I can export a compliance report as PDF.',
      },
      ctx,
    );

    const recordId = (result as { recordId: string }).recordId;
    const rec = db.getRecordById(recordId);
    expect(rec).toBeDefined();
    expect(rec!.record_type).toBe('artifact_produced');
    // The load-bearing assertion: HumanEdited (4), NOT Exploratory (1).
    expect(rec!.authority_level).toBe(AuthorityLevel.HumanEdited);
    expect(rec!.produced_by_agent_role).toBe('human_author');
    const content = rec!.content as { provenance?: string; item_kind?: string; authored_by?: string };
    expect(content.provenance).toBe('human_authored');
    expect(content.authored_by).toBe('user');
    expect(content.item_kind).toBe('user_journey');
  });
});

describe('submitItemFeedback — REFINE feedback (Increment 5)', () => {
  let stream: CapturedStream | null = null;
  afterEach(() => { stream?.cleanup(); stream = null; });

  it('records inert human_item_feedback anchored to the target item, leaving it untouched', async () => {
    stream = await driveWorkflow({
      intent: 'Build a CLI todo app',
      llmFixtures: { bloom: BLOOM_FIXTURE, synthesis: SYNTHESIS_FIXTURE },
    });
    const runId = stream.workflowRunId;
    if (!runId) throw new Error('no run');
    const { liaison, engine } = stream;
    const db = liaison.getDB();
    const run = engine.stateMachine.getWorkflowRun(runId);
    const ctx: CapabilityContext = {
      workspaceId: 'w', workspaceRoot: '/w', activeRun: run,
      currentPhase: run?.current_phase_id ?? '1', currentSubPhase: null,
      runStatus: run?.status ?? null, orchestrator: engine, db,
      eventBus: engine.eventBus, embedding: stream.engine['embedding'] ?? ({} as never),
    };

    // Any existing record serves as the feedback target.
    const target = db.getRecentRecords(runId, 1)[0];
    expect(target).toBeDefined();
    const targetAuthorityBefore = target.authority_level;

    const { result } = await liaison.runCapability(
      'submitItemFeedback',
      {
        targetRecordId: target.id,
        feedbackText: 'This should also cover the admin persona.',
        anchorItemId: 'US-3',
        scope: 'item',
      },
      ctx,
    );

    const fb = db.getRecordById((result as { recordId: string }).recordId);
    expect(fb).toBeDefined();
    expect(fb!.record_type).toBe('human_item_feedback');
    expect(fb!.authority_level).toBe(AuthorityLevel.HumanEdited);
    expect(fb!.derived_from_record_ids).toContain(target.id);
    const content = fb!.content as { feedback_text?: string; anchor_item_id?: string; provenance?: string };
    expect(content.feedback_text).toBe('This should also cover the admin persona.');
    expect(content.anchor_item_id).toBe('US-3');
    expect(content.provenance).toBe('human_authored');

    // The target item is INERT — unchanged (a new current version was NOT minted).
    const targetAfter = db.getRecordById(target.id);
    expect(targetAfter!.authority_level).toBe(targetAuthorityBefore);
  });
});
