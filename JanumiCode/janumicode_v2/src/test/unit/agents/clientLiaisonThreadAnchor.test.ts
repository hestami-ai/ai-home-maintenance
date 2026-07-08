/**
 * Increment 4a/4b — conversation threads + item anchors.
 *
 *  - focusResolver.resolveAnchorSeed: record-id wins; item-id falls back to
 *    FTS; empty when absent.
 *  - handleUserInput stamps content.thread_id + anchor_item_id/anchor_kind on
 *    the turn records, and getRecentConversationTurns(runId, n, threadId)
 *    scopes history to one thread (a card sub-chat sees only its own turns).
 *
 * GPU-free (MockLLMProvider + in-memory DB).
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { resolveAnchorSeed } from '../../../lib/agents/clientLiaison/focusResolver';
import { driveWorkflow, type CapturedStream } from '../../helpers/workflowDriver';
import { makeUserInput } from '../../../lib/agents/clientLiaisonAgent';
import type { CapabilityContext } from '../../../lib/agents/clientLiaison/capabilities/index';

describe('focusResolver.resolveAnchorSeed (Increment 4b)', () => {
  it('uses the record id directly and does not touch FTS', () => {
    const ftsSpy = vi.fn(() => []);
    const seed = resolveAnchorSeed({ recordId: 'rec-1', itemId: 'US-003' }, { ftsSearch: ftsSpy } as never);
    expect(seed).toEqual(['rec-1']);
    expect(ftsSpy).not.toHaveBeenCalled();
  });

  it('falls back to FTS when only a semantic item id is known', () => {
    const db = { ftsSearch: () => [{ id: 'rec-from-fts' }] } as never;
    expect(resolveAnchorSeed({ itemId: 'US-003', kind: 'user_journey' }, db)).toEqual(['rec-from-fts']);
  });

  it('returns [] for a missing anchor and never throws on FTS error', () => {
    expect(resolveAnchorSeed(undefined, {} as never)).toEqual([]);
    const throwingDb = { ftsSearch: () => { throw new Error('fts down'); } } as never;
    expect(resolveAnchorSeed({ itemId: 'x' }, throwingDb)).toEqual([]);
  });
});

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

describe('conversation threads + anchor stamping (Increment 4a)', () => {
  let stream: CapturedStream | null = null;
  afterEach(() => { stream?.cleanup(); stream = null; });

  it('scopes conversation history by thread and stamps the card anchor', async () => {
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

    // Root-chat turn + a card sub-chat turn anchored to an item.
    await liaison.handleUserInput(
      makeUserInput({ text: 'root question', inputMode: 'open_query', workflowRunId: runId, currentPhaseId: '1', threadId: 'main' }),
      ctx,
    );
    await new Promise((r) => setTimeout(r, 2));
    await liaison.handleUserInput(
      makeUserInput({
        text: 'card question',
        inputMode: 'open_query',
        workflowRunId: runId,
        currentPhaseId: '1',
        threadId: 'card:UJ-1',
        anchor: { recordId: 'UJ-1', itemId: 'UJ-1', kind: 'user_journey' },
      }),
      ctx,
    );

    const mainTurns = db.getRecentConversationTurns(runId, 20, 'main');
    const cardTurns = db.getRecentConversationTurns(runId, 20, 'card:UJ-1');

    // The main thread contains the root question but NOT the card question.
    const mainTexts = mainTurns.map((t) => t.queryRecord.content.text as string);
    expect(mainTexts).toContain('root question');
    expect(mainTexts).not.toContain('card question');

    // The card sub-thread contains only its own turn.
    const cardTexts = cardTurns.map((t) => t.queryRecord.content.text as string);
    expect(cardTexts).toContain('card question');
    expect(cardTexts).not.toContain('root question');

    // The card turn's records carry the anchor discriminator.
    const cardResp = db
      .getRecordsByType('client_liaison_response', runId)
      .find((r) => (r.content as { thread_id?: string }).thread_id === 'card:UJ-1');
    expect(cardResp).toBeDefined();
    expect((cardResp!.content as { anchor_item_id?: string }).anchor_item_id).toBe('UJ-1');
    expect((cardResp!.content as { anchor_kind?: string }).anchor_kind).toBe('user_journey');
  });
});
