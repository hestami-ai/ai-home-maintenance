/**
 * Live-ollama integration test for Deep Memory Research Agent.
 *
 * Exercises the Layer B remediation items (constitutional invariants,
 * bloom level-1 assignment, effectiveAuthority recompute via phase-gate
 * elevation, mirror_acknowledged → level 3) end-to-end through DMR's
 * research() — which runs real LLM calls for Stage 1 (Query Decomposition)
 * and Stage 7 (Context Packet Synthesis) against Ollama.
 *
 * Each B item lands its assertion on what comes out of `agent.research()`
 * against a fresh in-memory DB seeded with the relevant records.
 *
 * Skipped gracefully when ollama isn't reachable. Requires:
 *   - `ollama serve` running on OLLAMA_URL (default 127.0.0.1:11434)
 *   - `qwen3.5:9b` model pulled (or override via JANUMICODE_LIVE_DMR_MODEL)
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import { TemplateLoader } from '../../../lib/orchestrator/templateLoader';
import { DeepMemoryResearchAgent, type MaterialityWeights, type RetrievalBrief } from '../../../lib/agents/deepMemoryResearch';
import { LLMCaller } from '../../../lib/llm/llmCaller';
import { OllamaProvider } from '../../../lib/llm/providers/ollama';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
const MODEL = process.env.JANUMICODE_LIVE_DMR_MODEL ?? 'qwen3.5:9b';

let llmCaller: LLMCaller;
let ollamaReachable = false;

const defaultWeights: MaterialityWeights = {
  semantic_similarity: 0.20,
  constraint_relevance: 0.25,
  authority_level: 0.20,
  temporal_recency: 0.15,
  causal_relevance: 0.10,
  contradiction_signal: 0.10,
};

async function probeOllama(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    return res.ok;
  } catch {
    return false;
  }
}

beforeAll(async () => {
  ollamaReachable = await probeOllama();
  if (!ollamaReachable) {
    console.warn(`[live-ollama] skipping DMR tests — ${OLLAMA_URL} not reachable`);
    return;
  }
  llmCaller = new LLMCaller({ maxRetries: 0 });
  llmCaller.registerProvider(new OllamaProvider());
});

let idCounter = 0;
function testId(): string { return `live-dmr-${++idCounter}`; }

function baseBrief(overrides: Partial<RetrievalBrief> = {}): RetrievalBrief {
  return {
    requestingAgentRole: 'test_agent',
    scopeTier: 'current_run',
    query: 'governing decisions',
    knownRelevantRecordIds: [],
    workflowRunId: 'run-1',
    phaseId: '1',
    subPhaseId: '1.2',
    ...overrides,
  };
}

describe('DeepMemoryResearchAgent [live-ollama] — B-layer integration', () => {
  let db: Database;
  let writer: GovernedStreamWriter;
  let agent: DeepMemoryResearchAgent;

  beforeEach(() => {
    idCounter = 0;
    db = createTestDatabase();
    writer = new GovernedStreamWriter(db, testId);
    const templateLoader = new TemplateLoader(REPO_ROOT);
    agent = new DeepMemoryResearchAgent(
      db, llmCaller, defaultWeights,
      {
        janumiCodeVersionSha: 'abc',
        provider: 'ollama',
        model: MODEL,
      },
      templateLoader,
    );
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc', '2026-01-01T00:00:00Z', 'initiated')
    `).run();
  });

  afterEach(() => { db.close(); });

  // ── B.0/1 — Constitutional Invariant surfaces in active_constraints ──
  it('B.0/1: constitutional_invariant records surface with authority=7 in active_constraints', async () => {
    if (!ollamaReachable) return;

    const inv = writer.writeRecord({
      record_type: 'constitutional_invariant',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      phase_id: '0',
      sub_phase_id: 'workspace_classification',
      janumicode_version_sha: 'abc',
      authority_level: 7,
      content: {
        kind: 'constitutional_invariant',
        invariant_id: 'CI-3',
        statement: 'Every Phase Gate requires human approval. No automated gate passage.',
        source_section: '1.5',
      },
    });

    const packet = await agent.research(baseBrief({
      query: 'phase gate human approval automated',
    }));

    // The invariant should appear in active_constraints (authority>=6) and
    // its effective authority should be 7 even if the writer hadn't set it.
    const constraint = packet.activeConstraints.find(c => c.id === inv.id);
    expect(constraint).toBeDefined();
    expect(constraint!.authorityLevel).toBe(7);
    // And the statement text should round-trip
    expect(constraint!.statement).toContain('Phase Gate');
  }, 180_000);

  // ── B.2 — Bloom output at level 1 is harvestable but deprioritized ──
  it('B.2: artifact_produced from a bloom sub-phase carries authority_level=1', async () => {
    if (!ollamaReachable) return;

    // Writer should auto-assign level 1 for `*_bloom*` sub-phases
    const bloom = writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      phase_id: '1',
      sub_phase_id: 'business_domains_bloom',
      janumicode_version_sha: 'abc',
      content: {
        kind: 'business_domains_bloom',
        domains: [
          { name: 'Authentication', description: 'OAuth service for user identity and session handling' },
        ],
      },
    });

    expect(bloom.authority_level).toBe(1); // B.2 invariant verified at write time

    // Also test the enrichment form (mid-string `_bloom_`)
    const bloomEnrichment = writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      phase_id: '2',
      sub_phase_id: 'fr_bloom_enrichment',
      janumicode_version_sha: 'abc',
      content: {
        kind: 'fr_bloom_enrichment',
        functionalRequirements: [
          { id: 'FR-1', text: 'Users authenticate via OAuth' },
        ],
      },
    });
    expect(bloomEnrichment.authority_level).toBe(1);

    // DMR should still surface them in material_findings (they're memory-
    // bearing, just deprioritized) when running against real LLM stages.
    const packet = await agent.research(baseBrief({
      query: 'OAuth authentication users',
    }));

    const found = packet.materialFindings.find(f => f.id === bloom.id);
    expect(found).toBeDefined();
    expect(found!.authorityLevel).toBe(1);
  }, 180_000);

  // ── B.3 — Phase-gate certification elevates effective authority to 6 ──
  it('B.3: artifact referenced by phase_gate_approved becomes active_constraint via effective authority elevation', async () => {
    if (!ollamaReachable) return;

    // Artifact at stored authority 2 (default for artifact_produced)
    const artifact = writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      phase_id: '3',
      sub_phase_id: 'system_requirements',
      janumicode_version_sha: 'abc',
      content: {
        description: 'The notification system must support TLS 1.3 for all outbound webhooks.',
        kind: 'system_requirement',
      },
    });
    expect(artifact.authority_level).toBe(2);

    // Phase gate referencing the artifact
    const gate = writer.writeRecord({
      record_type: 'phase_gate_approved',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      janumicode_version_sha: 'abc',
      content: {
        phase_id: '3',
        approved_artifact_ids: [artifact.id],
      },
    });
    expect(gate.authority_level).toBe(5);

    // The `validates` edge that buildAuthorityElevationIndex queries
    db.prepare(`
      INSERT INTO memory_edge (id, source_record_id, target_record_id, edge_type, asserted_by, asserted_at, authority_level, status)
      VALUES ('e1', ?, ?, 'validates', 'test', ?, 5, 'system_asserted')
    `).run(gate.id, artifact.id, new Date().toISOString());

    const packet = await agent.research(baseBrief({
      query: 'notification system TLS webhooks',
    }));

    // The artifact's stored authority is 2; effective authority via the
    // validates edge from the phase gate should be 6.
    const found = packet.materialFindings.find(f => f.id === artifact.id);
    expect(found).toBeDefined();
    expect(found!.authorityLevel).toBe(6); // effective, not stored

    // Authority 6 → eligible for active_constraints
    const constraint = packet.activeConstraints.find(c => c.id === artifact.id);
    expect(constraint).toBeDefined();
    expect(constraint!.authorityLevel).toBe(6);
  }, 180_000);

  // ── B.5 — mirror_acknowledged writer case → level 3 ──
  it('B.5: mirror_acknowledged record carries authority_level=3', async () => {
    if (!ollamaReachable) return;

    const ack = writer.writeRecord({
      record_type: 'mirror_acknowledged',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      phase_id: '1',
      janumicode_version_sha: 'abc',
      content: {
        original_mirror_id: 'mirror-1',
        kind: 'mirror_acknowledged',
        note: 'Human acknowledged the OAuth integration mirror without edits.',
      },
    });
    expect(ack.authority_level).toBe(3); // B.5 invariant verified at write time

    // Run DMR — the acknowledgment record should be harvestable at the
    // stored authority level (no elevation in play here).
    const packet = await agent.research(baseBrief({
      query: 'OAuth integration mirror acknowledged',
    }));

    const found = packet.materialFindings.find(f => f.id === ack.id);
    expect(found).toBeDefined();
    expect(found!.authorityLevel).toBe(3);
  }, 180_000);

  // ── B.0/1 + B.3 combined: invariants and gate-certified artifacts both surface ──
  it('B.0/1 + B.3: a single research() call surfaces both constitutional invariants AND phase-gate-certified artifacts', async () => {
    if (!ollamaReachable) return;

    const inv = writer.writeRecord({
      record_type: 'constitutional_invariant',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      phase_id: '0',
      janumicode_version_sha: 'abc',
      authority_level: 7,
      content: {
        kind: 'constitutional_invariant',
        invariant_id: 'CI-9',
        statement: 'No governing constraint may be truncated silently. Governing constraints (Authority Level 6+) are always delivered in full.',
        source_section: '1.5',
      },
    });

    const artifact = writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      janumicode_version_sha: 'abc',
      content: {
        description: 'Stdin directives must include all Level 6+ active constraints without truncation.',
        kind: 'system_requirement',
      },
    });

    const gate = writer.writeRecord({
      record_type: 'phase_gate_approved',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      janumicode_version_sha: 'abc',
      content: { phase_id: '3', approved_artifact_ids: [artifact.id] },
    });

    db.prepare(`
      INSERT INTO memory_edge (id, source_record_id, target_record_id, edge_type, asserted_by, asserted_at, authority_level, status)
      VALUES ('e1', ?, ?, 'validates', 'test', ?, 5, 'system_asserted')
    `).run(gate.id, artifact.id, new Date().toISOString());

    const packet = await agent.research(baseBrief({
      query: 'governing constraints truncation stdin directives',
    }));

    // Both should appear as active constraints
    const invConstraint = packet.activeConstraints.find(c => c.id === inv.id);
    expect(invConstraint).toBeDefined();
    expect(invConstraint!.authorityLevel).toBe(7);

    const artifactConstraint = packet.activeConstraints.find(c => c.id === artifact.id);
    expect(artifactConstraint).toBeDefined();
    expect(artifactConstraint!.authorityLevel).toBe(6);

    // Sanity: at least 2 active constraints total
    expect(packet.activeConstraints.length).toBeGreaterThanOrEqual(2);
  }, 180_000);
});
