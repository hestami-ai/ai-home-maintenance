/**
 * Two-run semantic-supersession injection — the faithful, end-to-end exercise
 * of the DMR's supersession capability (spec §5.2: semantic supersession is
 * ACROSS Workflow Runs).
 *
 * Run 1 establishes a governing decision. Run 2 injects a
 * prior_decision_override of it via engine.injectPriorDecisionOverride (the
 * headless override-injection mechanism). The override:
 *   - resolves the prior governing record by selector,
 *   - writes a new governing artifact (the human's superseding position),
 *   - writes a prior_decision_override decision_trace + ingests it → a
 *     system_asserted `supersedes` edge (superseding → superseded).
 *
 * The DMR (all_runs scope) Stage 5 must then surface a supersession_chain
 * marking run-1's record superseded. If this passes, the whole faithful path
 * works; a headless run with this injection would show supersession_chains
 * populate live.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Database } from '../../lib/database/init';
import { createTestDatabase } from '../../lib/database/init';
import { ConfigManager } from '../../lib/config/configManager';
import { OrchestratorEngine } from '../../lib/orchestrator/orchestratorEngine';
import { DeepMemoryResearchAgent, type MaterialityWeights } from '../../lib/agents/deepMemoryResearch';
import { LLMCaller } from '../../lib/llm/llmCaller';

const weights: MaterialityWeights = {
  semantic_similarity: 0.2, constraint_relevance: 0.25, authority_level: 0.2,
  temporal_recency: 0.15, causal_relevance: 0.1, contradiction_signal: 0.1,
};

describe('DMR semantic supersession — two-run override injection', () => {
  let db: Database;
  let engine: OrchestratorEngine;
  let dmr: DeepMemoryResearchAgent;

  beforeEach(() => {
    db = createTestDatabase();
    const configManager = new ConfigManager();
    const extensionPath = path.resolve(__dirname, '..', '..', '..');
    const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-test-ws-'));
    engine = new OrchestratorEngine(db, configManager, workspacePath, extensionPath);
    // Standalone deterministic DMR over the SAME db (no templateLoader → no
    // Stage-7 LLM; supersession_chains come from the deterministic Stage 5).
    dmr = new DeepMemoryResearchAgent(engine.db, new LLMCaller({ maxRetries: 0 }), weights);
  });

  afterEach(() => db.close());

  it('surfaces a supersession_chain in run 2 after overriding a run-1 governing record', async () => {
    // ── Run 1: establish a governing interface contract ──────────────
    const run1 = engine.startWorkflowRun('ws-1', 'establish').run;
    const original = engine.writer.writeRecord({
      record_type: 'artifact_produced', schema_version: '1.0', workflow_run_id: run1.id,
      phase_id: '3', janumicode_version_sha: engine.janumiCodeVersionSha,
      content: { kind: 'interface_contract', statement: 'Auth: API tokens required on all endpoints.' },
    });

    // ── Run 2: human overrides it (semantic supersession, cross-run) ──
    const run2 = engine.startWorkflowRun('ws-1', 'override').run;
    const traceId = engine.injectPriorDecisionOverride(run2.id, {
      afterPhase: '1',
      superseded: { recordType: 'artifact_produced', contentMatch: 'API tokens required' },
      superseding: { statement: 'Auth: none — endpoints are public (overrides the prior token requirement).', kind: 'interface_contract' },
    });
    expect(traceId, 'override should resolve + write a decision_trace').toBeTruthy();

    // A system_asserted supersedes edge now runs superseding → original.
    const edge = db.prepare(
      `SELECT source_record_id, target_record_id FROM memory_edge
       WHERE edge_type='supersedes' AND status='system_asserted'`,
    ).get() as { source_record_id: string; target_record_id: string } | undefined;
    expect(edge, 'a supersedes edge should exist').toBeDefined();
    expect(edge?.target_record_id).toBe(original.id);
    expect(edge?.source_record_id).not.toBe(traceId); // not the trace — the new governing artifact

    // ── DMR (all_runs) must surface the chain marking run-1 superseded ─
    const packet = await dmr.research({
      requestingAgentRole: 'systems_agent', scopeTier: 'all_runs',
      query: 'interface contract auth endpoints governing decision',
      knownRelevantRecordIds: [original.id, edge!.source_record_id, traceId!],
      workflowRunId: run2.id, phaseId: '3', subPhaseId: 'system_requirements',
    });

    expect(packet.supersessionChains.length, 'DMR should surface a supersession chain').toBeGreaterThan(0);
    const superseded = packet.supersessionChains.flatMap(
      c => c.chain.filter(e => e.position === 'superseded').map(e => e.recordId),
    );
    expect(superseded).toContain(original.id);
  });

  it('is a no-op when the superseded selector resolves nothing', () => {
    const run = engine.startWorkflowRun('ws-1', 't').run;
    const traceId = engine.injectPriorDecisionOverride(run.id, {
      afterPhase: '1',
      superseded: { recordType: 'artifact_produced', contentMatch: 'does-not-exist-anywhere' },
    });
    expect(traceId).toBeNull();
    const edges = db.prepare(`SELECT COUNT(*) AS n FROM memory_edge WHERE edge_type='supersedes'`).get() as { n: number };
    expect(edges.n).toBe(0);
  });
});
