/**
 * SD-5 — Phase 2.1 FR-bloom skeleton pass, per-journey chunking.
 *
 * The former single-call skeleton asked one JSON to enumerate EVERY user story
 * across EVERY journey. gpt-oss:20b (cal-34) produced valid content but as a
 * ~7K-char array that truncated mid-stream; json_repair exhausted and the
 * artifact fell back to an empty roster, starving the whole functional
 * pipeline. `runSkeletonPass` now fans out ONE focused `fr_bloom_skeleton` call
 * per accepted journey via the shared `chunkedCoverageBloom` helper, so each
 * call emits a small, parseable US JSON.
 *
 * These tests pin the behaviours that fix that failure:
 *  (a) anti-monolith — each generation prompt carries exactly ONE journey id;
 *  (b) collision-free ids — two journeys both emitting US-001 merge to unique
 *      sequential US-### with no story dropped;
 *  (c) coverage — an uncovered journey drives a per-journey reconciliation retry
 *      and surfaces to autoFlagDroppedJourneys as residual; a self-declared
 *      unreached journey is NOT treated as an uncovered gap (no retry, agent
 *      reason preserved);
 *  (d) no fabrication — a failing journey chunk contributes [] with no fake US;
 *  (e) shape preserved — the pass returns {stories, unreached} and the whole
 *      runFrBloomThreePass still produces a coherent result (traces intact,
 *      enrichment consumes the merged stories).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../../lib/database/init';
import { ConfigManager } from '../../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../../lib/orchestrator/orchestratorEngine';
import type { PhaseContext } from '../../../../lib/orchestrator/orchestratorEngine';
import {
  runSkeletonPass,
  runFrBloomThreePass,
  type FrBloomDeps,
} from '../../../../lib/orchestrator/phases/phase2/frBloomThreePass';
import { SYSTEM_INFERRED_JOURNEY_REASON } from '../../../../lib/orchestrator/phases/phase2/autoFlagDroppedJourneys';
import type { PhaseContextPacketResult } from '../../../../lib/orchestrator/phases/dmrContext';
import type { ProductDescriptionHandoffContent, UserJourney } from '../../../../lib/types/records';
import { MockLLMProvider } from '../../../helpers/mockLLMProvider';

const extensionPath = path.resolve(__dirname, '..', '..', '..', '..', '..');
const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-fr-skel-'));

// Minimal formatters that embed the id so anti-monolith prompt assertions work.
// The pass injects these via FrBloomDeps.format, so the test controls exactly
// what text lands in the rendered prompt.
const format = {
  formatJourneys: (js: Array<{ id: string; title?: string }>) =>
    js.length ? js.map(j => `- ${j.id}: ${j.title ?? j.id}`).join('\n') : '(none)',
  formatEntities: (es: Array<{ id: string }>) => (es.length ? es.map(e => `- ${e.id}`).join('\n') : '(none)'),
  formatWorkflows: (ws: Array<{ id: string }>) => (ws.length ? ws.map(w => `- ${w.id}`).join('\n') : '(none)'),
  formatExtractedItems: (items: Array<{ id: string }>) => (items.length ? items.map(i => `- ${i.id}`).join('\n') : '(none)'),
  formatVocabulary: (terms: Array<{ id: string }>) => (terms.length ? terms.map(t => `- ${t.id}`).join('\n') : '(none)'),
} as unknown as FrBloomDeps['format'];

function makeJourney(id: string): UserJourney {
  return {
    id,
    personaId: 'P1',
    title: `Journey ${id}`,
    scenario: `Scenario for ${id}`,
    steps: [],
    acceptanceCriteria: [],
    implementationPhase: 'Phase 1',
  } as UserJourney;
}

/** A per-journey skeleton fixture returning ONE US that covers the journey. */
function skeletonFixture(
  mock: MockLLMProvider,
  journeyId: string,
  opts: { storyId?: string } = {},
): void {
  mock.setFixture(journeyId, {
    parsedJson: {
      user_stories: [{
        id: opts.storyId ?? 'US-001',
        role: 'User',
        action: `use ${journeyId}`,
        outcome: 'value delivered',
        priority: 'high',
        traces_to: [journeyId, 'ENT-CORE'],
        acceptance_criteria: [
          { id: 'AC-001', description: 'seed', measurable_condition: `seed condition for ${journeyId}` },
        ],
      }],
      unreached_journeys: [],
    },
  });
}

/** A per-journey skeleton fixture that produces NO US (the cal-34 empty case). */
function emptyFixture(mock: MockLLMProvider, journeyId: string): void {
  mock.setFixture(journeyId, { parsedJson: { user_stories: [], unreached_journeys: [] } });
}

/** A per-journey skeleton fixture that self-declares the journey unreached. */
function unreachedFixture(mock: MockLLMProvider, journeyId: string, reason: string): void {
  mock.setFixture(journeyId, {
    parsedJson: { user_stories: [], unreached_journeys: [{ journey_id: journeyId, reason }] },
  });
}

/**
 * Register the Pass-2 enrichment fixture LAST so it sits at the FRONT of the
 * mock's fixture list (setFixture unshifts; first substring match wins). The
 * enrichment prompt also contains a journey id, so it MUST be matched before the
 * per-journey skeleton fixtures — this ordering guarantees that.
 */
function registerEnrichment(mock: MockLLMProvider): void {
  mock.setFixture('Acceptance-Criteria Enrichment', {
    parsedJson: {
      acceptance_criteria: [
        { id: 'AC-001', description: 'happy path', measurable_condition: 'enriched condition one' },
        { id: 'AC-002', description: 'failure mode', measurable_condition: 'enriched condition two' },
      ],
    },
  });
}

describe('SD-5 — runSkeletonPass per-journey chunking', () => {
  let db: Database;
  let engine: OrchestratorEngine;
  let mock: MockLLMProvider;
  let prevRecon: string | undefined;

  beforeEach(() => {
    db = createTestDatabase();
    const cm = new ConfigManager();
    engine = new OrchestratorEngine(db, cm, workspacePath, extensionPath);
    engine.setAutoApproveDecisions(true);
    mock = new MockLLMProvider();
    engine.llmCaller.registerProvider(mock.bindAsProvider('llamacpp'));
    engine.configManager.setRequirementsAgentRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'llamacpp', model: 'qwen3.5:9b' },
      temperature: 0.4,
    });
    // Default OFF so generation-only tests get exactly one call per journey;
    // reconciliation tests opt in explicitly.
    prevRecon = process.env.JANUMICODE_P2_FR_RECON_PASSES;
    process.env.JANUMICODE_P2_FR_RECON_PASSES = '0';
  });

  afterEach(() => {
    if (prevRecon === undefined) delete process.env.JANUMICODE_P2_FR_RECON_PASSES;
    else process.env.JANUMICODE_P2_FR_RECON_PASSES = prevRecon;
    db.close();
  });

  function makeDeps(journeys: UserJourney[]): FrBloomDeps {
    const { run } = engine.startWorkflowRun('ws', 'test');
    const handoff = {
      productVision: 'Vision',
      userJourneys: journeys,
      entityProposals: [{ id: 'ENT-CORE' }],
      workflowProposals: [],
      complianceExtractedItems: [],
      canonicalVocabulary: [],
      openQuestions: [],
    } as unknown as ProductDescriptionHandoffContent;
    const dmr: PhaseContextPacketResult = {
      packet: null,
      activeConstraintsText: 'No active constraints.',
      detailFilePath: '(not available)',
      detailFileContent: 'DMR detail content — contains no journey ids.',
      derivedFromRecordIds: [],
    };
    const ctx = { engine, workflowRun: { id: run.id } } as unknown as PhaseContext;
    return { ctx, handoff, dmr, intentSummary: 'Intent summary.', format };
  }

  const IDS = ['UJ-ALPHA', 'UJ-BRAVO', 'UJ-CHARLIE'];

  function skeletonGenPrompts(): string[] {
    return mock.getCallLog()
      .filter(c =>
        c.options.traceContext?.subPhaseId === 'fr_bloom_skeleton' &&
        (c.options.traceContext?.label ?? '').includes('Skeleton Bloom'))
      .map(c => c.options.prompt ?? '');
  }

  it('(a) anti-monolith: each generation prompt carries exactly ONE journey id', async () => {
    const journeys = IDS.map(makeJourney);
    for (const id of IDS) skeletonFixture(mock, id);

    const out = await runSkeletonPass(makeDeps(journeys));

    // One focused call per journey — never a single all-journeys prompt.
    const prompts = skeletonGenPrompts();
    expect(prompts).toHaveLength(3);
    for (const p of prompts) {
      const present = IDS.filter(id => p.includes(id));
      expect(present, `prompt must scope to exactly one journey, saw: ${present.join(',')}`).toHaveLength(1);
    }
    // Sanity: all three journeys got covered across the fan-out.
    expect(out.stories).toHaveLength(3);
  });

  it('(b) collision-free ids: two journeys both emitting US-001 merge to unique sequential US-###', async () => {
    const journeys = [makeJourney('UJ-ALPHA'), makeJourney('UJ-BRAVO')];
    skeletonFixture(mock, 'UJ-ALPHA', { storyId: 'US-001' });
    skeletonFixture(mock, 'UJ-BRAVO', { storyId: 'US-001' }); // same raw id — must NOT be dropped

    const out = await runSkeletonPass(makeDeps(journeys));

    expect(out.stories).toHaveLength(2);
    expect(out.stories.map(s => s.id).sort()).toEqual(['US-001', 'US-002']);
    // Both journeys survive as distinct stories (no dedup collapse).
    const tracedJourneys = new Set(
      out.stories.flatMap(s => (s.traces_to ?? []).filter(t => t.startsWith('UJ-'))),
    );
    expect(tracedJourneys).toEqual(new Set(['UJ-ALPHA', 'UJ-BRAVO']));
  });

  it('(c-i) reconciliation recovers a transiently-missed journey via a focused, cache-busting retry prompt', async () => {
    process.env.JANUMICODE_P2_FR_RECON_PASSES = '1';
    const journeys = [makeJourney('UJ-OK'), makeJourney('UJ-GAP')];
    skeletonFixture(mock, 'UJ-OK');
    emptyFixture(mock, 'UJ-GAP'); // generation produces nothing for this journey
    // The reconciliation retry uses a DISTINCT focused prompt ("COVERAGE
    // RECONCILIATION"), so it is not swallowed by the llmCaller prompt-cache and
    // can be answered independently — here it recovers the missed journey.
    mock.setFixture('COVERAGE RECONCILIATION', {
      parsedJson: {
        user_stories: [{
          id: 'US-001', role: 'User', action: 'use UJ-GAP', outcome: 'value', priority: 'high',
          traces_to: ['UJ-GAP', 'ENT-CORE'],
          acceptance_criteria: [{ id: 'AC-001', description: 'seed', measurable_condition: 'recovered condition' }],
        }],
        unreached_journeys: [],
      },
    });
    registerEnrichment(mock);

    const skel = await runSkeletonPass(makeDeps(journeys));

    // A per-journey reconciliation retry fired for the missed journey only.
    const reconciledGap = mock.getCallLog().some(c =>
      (c.options.prompt ?? '').includes('COVERAGE RECONCILIATION') &&
      (c.options.prompt ?? '').includes('UJ-GAP'));
    expect(reconciledGap, 'UJ-GAP should trigger a focused reconciliation call').toBe(true);
    const reconciledOk = mock.getCallLog().some(c =>
      (c.options.prompt ?? '').includes('COVERAGE RECONCILIATION') &&
      (c.options.prompt ?? '').includes('UJ-OK'));
    expect(reconciledOk, 'a covered journey must not be reconciled').toBe(false);

    // The gap is now covered — a story traces to UJ-GAP.
    const tracedJourneys = new Set(
      skel.stories.flatMap(s => (s.traces_to ?? []).filter(t => t.startsWith('UJ-'))),
    );
    expect(tracedJourneys.has('UJ-GAP')).toBe(true);
    expect(skel.unreached.map(u => u.journey_id)).not.toContain('UJ-GAP');
  });

  it('(c-ii) a still-uncovered journey surfaces to autoFlagDroppedJourneys as an honest residual', async () => {
    process.env.JANUMICODE_P2_FR_RECON_PASSES = '1';
    const journeys = [makeJourney('UJ-OK'), makeJourney('UJ-GAP')];
    skeletonFixture(mock, 'UJ-OK');
    emptyFixture(mock, 'UJ-GAP'); // and no reconciliation fixture → stays uncovered
    registerEnrichment(mock);

    const result = await runFrBloomThreePass(makeDeps(journeys));

    // Downstream backstop declares the residual journey unreached (never fabricated).
    expect(result.unreachedJourneys).toContainEqual({
      journey_id: 'UJ-GAP',
      reason: SYSTEM_INFERRED_JOURNEY_REASON,
    });
    // The covered journey's story is preserved (partial success, not wiped).
    expect(result.userStories.some(s => (s.traces_to ?? []).includes('UJ-OK'))).toBe(true);
  });

  it('(c-iii) a self-declared unreached journey is NOT treated as an uncovered gap (no retry, agent reason preserved)', async () => {
    process.env.JANUMICODE_P2_FR_RECON_PASSES = '1'; // reconciliation ON — must still skip a deferral
    const journeys = [makeJourney('UJ-COVERED'), makeJourney('UJ-DEFER')];
    skeletonFixture(mock, 'UJ-COVERED');
    unreachedFixture(mock, 'UJ-DEFER', 'covered by a sibling journey');
    registerEnrichment(mock);

    const skel = await runSkeletonPass(makeDeps(journeys));
    // The deferral is carried through as an agent declaration.
    expect(skel.unreached).toContainEqual({ journey_id: 'UJ-DEFER', reason: 'covered by a sibling journey' });
    // A legitimately-deferred journey is NOT reconciled.
    const reconciledDefer = mock.getCallLog().some(c =>
      (c.options.prompt ?? '').includes('COVERAGE RECONCILIATION') &&
      (c.options.prompt ?? '').includes('UJ-DEFER'));
    expect(reconciledDefer, 'a self-declared unreached journey must not be retried').toBe(false);

    // End-to-end: the agent reason survives (NOT overwritten with the
    // system-inferred silent-drop reason) — proving it was never seen as a gap.
    const result = await runFrBloomThreePass(makeDeps(journeys));
    const defer = result.unreachedJourneys.find(u => u.journey_id === 'UJ-DEFER');
    expect(defer?.reason).toBe('covered by a sibling journey');
    expect(defer?.reason).not.toBe(SYSTEM_INFERRED_JOURNEY_REASON);
  });

  it('(d) no fabrication: a failing journey chunk contributes [] with no fake US', async () => {
    const journeys = [makeJourney('UJ-GOOD'), makeJourney('UJ-FAIL')];
    skeletonFixture(mock, 'UJ-GOOD');
    // UJ-FAIL has NO fixture → default empty JSON → parses to [] (the cal-34
    // malformed/truncated → empty fallback failure mode).

    const out = await runSkeletonPass(makeDeps(journeys));

    // Exactly one real story (from UJ-GOOD); nothing fabricated for UJ-FAIL.
    expect(out.stories).toHaveLength(1);
    const allTraces = out.stories.flatMap(s => s.traces_to ?? []);
    expect(allTraces).toContain('UJ-GOOD');
    expect(allTraces).not.toContain('UJ-FAIL');
    // The single story carries a real deterministic id, not a placeholder.
    expect(out.stories[0].id).toBe('US-001');
  });

  it('(e) shape preserved: runFrBloomThreePass produces a coherent result over the merged stories', async () => {
    const journeys = [makeJourney('UJ-ALPHA'), makeJourney('UJ-BRAVO')];
    skeletonFixture(mock, 'UJ-ALPHA');
    skeletonFixture(mock, 'UJ-BRAVO');
    registerEnrichment(mock);

    const result = await runFrBloomThreePass(makeDeps(journeys));

    // Same {stories, unreached}-derived shape flows all the way through.
    expect(result.userStories).toHaveLength(2);
    expect(result.userStories.map(s => s.id).sort()).toEqual(['US-001', 'US-002']);

    // traces_to intact after self-heal — every journey is covered.
    const tracedJourneys = new Set(
      result.userStories.flatMap(s => (s.traces_to ?? []).filter(t => t.startsWith('UJ-'))),
    );
    expect(tracedJourneys).toEqual(new Set(['UJ-ALPHA', 'UJ-BRAVO']));

    // Enrichment consumed the merged stories (seed→full AC list).
    expect(result.userStories.every(s => s.acceptance_criteria.length === 2)).toBe(true);

    // No blocking journey-coverage gap — the spine is complete.
    const blockingCoverage = result.coverageGaps.filter(
      g => g.check === 'journey_fr_coverage' && g.severity === 'blocking',
    );
    expect(blockingCoverage).toEqual([]);
  });
});
