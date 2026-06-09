/**
 * DMR Capability Exercise — does the Deep Memory Research agent actually
 * surface its two distinctive, human-decision-driven capabilities when fed
 * the inputs spec §8.4 / §5.2 say it should?
 *
 * The ts-120 audit found both capabilities DORMANT in headless/auto-approve
 * single-runs — because that mode generates none of their inputs:
 *   - active_constraints beyond the constitution needs authority ELEVATION,
 *     which requires a `validates` memory_edge from a `phase_gate_approved`
 *     record (human gate approval).
 *   - supersession_chains need a SEMANTIC supersession — a `supersedes`
 *     memory_edge created from a `prior_decision_override` decision_trace.
 *
 * These tests construct those inputs through the PRODUCTION chain
 * (GovernedStreamWriter → IngestionPipelineRunner → effectiveAuthority →
 * DeepMemoryResearchAgent) and assert the DMR surfaces them. If they pass,
 * the DMR logic is correct and the gap is purely that headless runs never
 * produce the inputs (so we need decision injection to exercise it). If they
 * fail, there is a real DMR bug.
 *
 * They also pin the two production-wiring gaps the audit found:
 *   GAP-1: DecisionRouter writes phase_gate_approved as {target_record_id,
 *          payload} — no top-level artifact_ids — so ingestion's
 *          extractArtifactIds returns [] and NO validates edge is created.
 *   GAP-2: DecisionRouter never calls ingestionPipeline.ingest() on the
 *          phase_gate_approved record, so Stage II never runs on it.
 * Both are asserted explicitly below so a future wiring fix flips them.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../lib/database/init';
import { GovernedStreamWriter } from '../../lib/orchestrator/governedStreamWriter';
import { IngestionPipelineRunner } from '../../lib/orchestrator/ingestionPipelineRunner';
import { DeepMemoryResearchAgent, type MaterialityWeights, type RetrievalBrief } from '../../lib/agents/deepMemoryResearch';
import { LLMCaller } from '../../lib/llm/llmCaller';

const weights: MaterialityWeights = {
  semantic_similarity: 0.20, constraint_relevance: 0.25, authority_level: 0.20,
  temporal_recency: 0.15, causal_relevance: 0.10, contradiction_signal: 0.10,
};

let n = 0;
const genId = (): string => `cap-${++n}`;

function brief(o: Partial<RetrievalBrief> = {}): RetrievalBrief {
  return {
    requestingAgentRole: 'test_agent', scopeTier: 'all_runs', query: 'governing decisions',
    knownRelevantRecordIds: [], workflowRunId: 'run-1', phaseId: '3', subPhaseId: 'system_requirements', ...o,
  };
}

function edgeCount(db: Database, type: string, status: string): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM memory_edge WHERE edge_type=? AND status=?').get(type, status) as { n: number }).n;
}

describe('DMR capability exercise — elevation + semantic supersession', () => {
  let db: Database;
  let writer: GovernedStreamWriter;
  let ingestion: IngestionPipelineRunner;
  let dmr: DeepMemoryResearchAgent;

  beforeEach(() => {
    n = 0;
    db = createTestDatabase();
    writer = new GovernedStreamWriter(db, genId);
    ingestion = new IngestionPipelineRunner(db, genId);
    // No templateLoader → Stage 7 LLM synthesis skipped; the deterministic
    // base packet (which is what carries active_constraints + supersession
    // chains) is what we're testing.
    dmr = new DeepMemoryResearchAgent(db, new LLMCaller({ maxRetries: 0 }), weights);
    for (const id of ['run-1', 'run-2']) {
      db.prepare(`INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
                  VALUES (?, 'ws-1', 'abc', '2026-01-01T00:00:00Z', 'initiated')`).run(id);
    }
  });
  afterEach(() => db.close());

  // ── Capability 1: authority elevation → active_constraints ──────────
  it('elevates a phase-gate-certified artifact into active_constraints (auth 2 → 6)', async () => {
    // A normal artifact at the default authority level (2).
    const artifact = writer.writeRecord({
      record_type: 'artifact_produced', schema_version: '1.0', workflow_run_id: 'run-1',
      janumicode_version_sha: 'abc',
      content: { kind: 'system_boundary', statement: 'The product is single-tenant; no multi-org support.' },
    });
    expect(artifact.authority_level).toBeLessThan(6);

    // A phase_gate_approved record that certifies it. NOTE: we put the
    // artifact id under top-level `artifact_ids` — the shape ingestion's
    // extractArtifactIds actually reads. (Production's DecisionRouter does
    // NOT — see GAP-1 test below.)
    const gate = writer.writeRecord({
      record_type: 'phase_gate_approved', schema_version: '1.0', workflow_run_id: 'run-1',
      janumicode_version_sha: 'abc',
      content: { kind: 'phase_gate_approved', artifact_ids: [artifact.id], phase_id: '3' },
    });
    // Drive the REAL ingestion → Stage II should create a `validates` edge.
    ingestion.ingest(gate);
    expect(edgeCount(db, 'validates', 'system_asserted')).toBe(1);

    const packet = await dmr.research(brief({
      query: 'system boundary single-tenant governing decision',
      knownRelevantRecordIds: [artifact.id],
    }));

    // The artifact must now be elevated to authority 6 and surface as an
    // active constraint (auth>=6 + governing). This is the channel that was
    // constitution-only in ts-120.
    const ac = packet.activeConstraints.find(c => c.id === artifact.id);
    expect(ac, 'gate-certified artifact should appear in active_constraints').toBeDefined();
    expect(ac?.authorityLevel).toBe(6);
  });

  // ── Capability 2: semantic supersession → supersession_chains ───────
  it('surfaces a semantic supersession chain from a prior_decision_override', async () => {
    // run-1 established a governing decision.
    const original = writer.writeRecord({
      record_type: 'artifact_produced', schema_version: '1.0', workflow_run_id: 'run-1',
      janumicode_version_sha: 'abc',
      content: { kind: 'interface_contract', statement: 'Auth: API tokens required on all endpoints.' },
    });
    // run-2 the human overrides it (semantic supersession, cross-run).
    const superseding = writer.writeRecord({
      record_type: 'artifact_produced', schema_version: '1.0', workflow_run_id: 'run-2',
      janumicode_version_sha: 'abc',
      content: { kind: 'interface_contract', statement: 'Auth: no auth — public endpoints (overrides prior).' },
    });
    const override = writer.writeRecord({
      record_type: 'decision_trace', schema_version: '1.0', workflow_run_id: 'run-2',
      janumicode_version_sha: 'abc',
      content: { decision_type: 'prior_decision_override', superseded_record_id: original.id, superseding_record_id: superseding.id },
    });
    // Drive REAL ingestion → Stage II should create a system_asserted
    // `supersedes` edge (override → original).
    ingestion.ingest(override);
    expect(edgeCount(db, 'supersedes', 'system_asserted')).toBe(1);

    const packet = await dmr.research(brief({
      scopeTier: 'all_runs',
      query: 'auth endpoints governing decision interface contract',
      // Seed all three so harvest is deterministic — Stage 5 then runs on them.
      knownRelevantRecordIds: [override.id, original.id, superseding.id],
    }));

    // DMR Stage 5 should surface a chain and mark the original superseded.
    expect(packet.supersessionChains.length, 'a semantic supersession should produce a chain').toBeGreaterThan(0);
    const supersededIds = packet.supersessionChains.flatMap(ch => ch.chain.filter(e => e.position === 'superseded').map(e => e.recordId));
    expect(supersededIds).toContain(original.id);
  });

  // ── extractArtifactIds contract guard ───────────────────────────────
  it('ingestion reads ONLY top-level artifact ids (payload-nested ids are ignored)', () => {
    // Pins the contract behind the GAP-1 fix: ingestion's extractArtifactIds
    // reads top-level artifact_ids/artifact_id/approved_artifact_ids only.
    // DecisionRouter now writes `approved_artifact_ids` top-level (fixed); this
    // guards that ids buried under `payload` (the OLD shape) still produce no
    // edge, so a regression to the old shape would be caught here.
    const artifact = writer.writeRecord({
      record_type: 'artifact_produced', schema_version: '1.0', workflow_run_id: 'run-1',
      janumicode_version_sha: 'abc', content: { kind: 'system_boundary', statement: 'x' },
    });
    const gate = writer.writeRecord({
      record_type: 'phase_gate_approved', schema_version: '1.0', workflow_run_id: 'run-1',
      janumicode_version_sha: 'abc',
      content: { target_record_id: 'surface-rec', payload: { artifact_ids: [artifact.id] } },
    });
    ingestion.ingest(gate);
    // Documents the gap: the artifact_ids are nested under payload, which
    // extractArtifactIds does not read → no elevation in real runs.
    expect(edgeCount(db, 'validates', 'system_asserted')).toBe(0);
  });
});
