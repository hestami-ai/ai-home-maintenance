import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import { TemplateLoader } from '../../../lib/orchestrator/templateLoader';
import {
  DeepMemoryResearchAgent,
  contextPacketToJson,
  type MaterialityWeights,
  type RetrievalBrief,
  type ContextPacket,
} from '../../../lib/agents/deepMemoryResearch';
import { LLMCaller } from '../../../lib/llm/llmCaller';
import { MockLLMProvider } from '../../helpers/mockLLMProvider';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

let idCounter = 0;
function testId(): string { return `dmr-${++idCounter}`; }

const defaultWeights: MaterialityWeights = {
  semantic_similarity: 0.20,
  constraint_relevance: 0.25,
  authority_level: 0.20,
  temporal_recency: 0.15,
  causal_relevance: 0.10,
  contradiction_signal: 0.10,
};

function baseBrief(overrides: Partial<RetrievalBrief> = {}): RetrievalBrief {
  return {
    requestingAgentRole: 'test_agent',
    scopeTier: 'current_run',
    query: 'test query',
    knownRelevantRecordIds: [],
    workflowRunId: 'run-1',
    phaseId: '1',
    subPhaseId: '1.2',
    ...overrides,
  };
}

describe('DeepMemoryResearchAgent', () => {
  let db: Database;
  let writer: GovernedStreamWriter;
  let agent: DeepMemoryResearchAgent;

  beforeEach(() => {
    idCounter = 0;
    db = createTestDatabase();
    writer = new GovernedStreamWriter(db, testId);
    agent = new DeepMemoryResearchAgent(db, new LLMCaller({ maxRetries: 0 }), defaultWeights);

    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc', '2026-01-01T00:00:00Z', 'initiated')
    `).run();
  });

  afterEach(() => { db.close(); });

  // ── content-blindness fix: record-type-aware, component-scoped summaries ──
  describe('extractSummary distillation (via research)', () => {
    it('surfaces decision_trace rationale (not "") and scopes component_model to the focus component', async () => {
      const dt = writer.writeRecord({
        record_type: 'decision_trace', schema_version: '1.0', workflow_run_id: 'run-1',
        phase_id: '2', janumicode_version_sha: 'abc',
        content: {
          decision_type: 'menu_selection',
          human_selection: 'AES-256-GCM',
          rationale_captured: 'FIPS compliance required',
          context_presented: 'cipher choice',
        },
      });
      const cm = writer.writeRecord({
        record_type: 'artifact_produced', schema_version: '1.0', workflow_run_id: 'run-1',
        phase_id: '4', janumicode_version_sha: 'abc',
        content: {
          kind: 'component_model',
          components: [
            { id: 'comp-crypto-engine', responsibilities: [{ id: 'r1', statement: 'Encrypt and decrypt URLs with AES-256-GCM' }] },
            { id: 'comp-url-shortener', responsibilities: [{ id: 'r2', statement: 'Generate 6-character slugs' }] },
          ],
        },
      });

      const packet = await agent.research(baseBrief({
        scopeTier: 'all_runs',
        query: 'crypto engine governing decisions',
        knownRelevantRecordIds: [dt.id, cm.id],
        focusComponentId: 'comp-crypto-engine',
      }));

      const dtFinding = packet.materialFindings.find(f => f.id === dt.id);
      expect(dtFinding, 'decision_trace should surface as a material finding').toBeDefined();
      expect(dtFinding!.summary).not.toBe('');
      expect(dtFinding!.summary).toMatch(/AES-256-GCM|FIPS/);

      const cmFinding = packet.materialFindings.find(f => f.id === cm.id);
      expect(cmFinding, 'component_model should surface').toBeDefined();
      expect(cmFinding!.summary).not.toBe('[component_model]');
      expect(cmFinding!.summary).toContain('Encrypt and decrypt');       // focus component's responsibility
      expect(cmFinding!.summary).not.toContain('Generate 6-character');  // other component scoped OUT
    });

    it('summarises decision_traces from the fields the router actually writes (not "")', async () => {
      // Auto-approve bundle — content lives in attribution/auto_approved_by.
      const auto = writer.writeRecord({
        record_type: 'decision_trace', schema_version: '1.0', workflow_run_id: 'run-1',
        phase_id: '1', janumicode_version_sha: 'abc',
        content: {
          decision_type: 'decision_bundle_resolution', attribution: 'auto_approve',
          auto_approved: true, auto_approved_by: 'orchestrator_auto_approve',
          payload: { mirror_decisions: [], menu_selections: [] },
        },
      });
      // Menu selection — content lives in option_id.
      const menu = writer.writeRecord({
        record_type: 'decision_trace', schema_version: '1.0', workflow_run_id: 'run-1',
        phase_id: '1', janumicode_version_sha: 'abc',
        content: { decision_type: 'menu_selection', option_id: 'OPT-SLUG-6CHAR', payload: {} },
      });

      const packet = await agent.research(baseBrief({
        scopeTier: 'all_runs', query: 'governing decisions',
        knownRelevantRecordIds: [auto.id, menu.id],
      }));

      const a = packet.materialFindings.find(f => f.id === auto.id);
      expect(a!.summary).not.toBe('');
      expect(a!.summary).toMatch(/auto-approved/i);

      const m = packet.materialFindings.find(f => f.id === menu.id);
      expect(m!.summary).toContain('OPT-SLUG-6CHAR');
    });

    it('distills the certified governing collections (intent / FR / NFR) instead of `[kind]` labels', async () => {
      // These three are the highest-authority certified collections; their
      // substance lives in product_concept / user_stories / requirements —
      // fields the fast-path never reads, so they used to collapse to labels.
      const intent = writer.writeRecord({
        record_type: 'artifact_produced', schema_version: '1.0', workflow_run_id: 'run-1',
        phase_id: '1', janumicode_version_sha: 'abc',
        content: {
          kind: 'intent_statement',
          product_concept: { name: 'TinyURL tagline', description: 'A high-availability URL shortening service' },
          confirmed_constraints: ['GDPR data minimization'],
        },
      });
      const fr = writer.writeRecord({
        record_type: 'artifact_produced', schema_version: '1.0', workflow_run_id: 'run-1',
        phase_id: '2', janumicode_version_sha: 'abc',
        content: {
          kind: 'functional_requirements',
          user_stories: [
            { id: 'US-001', role: 'Link Sharer', action: 'convert a long URL into a 6-character slug', outcome: 'a compact identifier' },
          ],
        },
      });
      const nfr = writer.writeRecord({
        record_type: 'artifact_produced', schema_version: '1.0', workflow_run_id: 'run-1',
        phase_id: '2', janumicode_version_sha: 'abc',
        content: {
          kind: 'non_functional_requirements',
          requirements: [
            { id: 'NFR-002', category: 'security', description: 'At-rest encryption of all mapped URLs using AES-256' },
          ],
        },
      });

      const packet = await agent.research(baseBrief({
        scopeTier: 'all_runs', query: 'governing requirements',
        knownRelevantRecordIds: [intent.id, fr.id, nfr.id],
      }));

      const iFinding = packet.materialFindings.find(f => f.id === intent.id);
      expect(iFinding!.summary).not.toBe('[intent_statement]');
      expect(iFinding!.summary).toContain('high-availability URL shortening');

      const frFinding = packet.materialFindings.find(f => f.id === fr.id);
      expect(frFinding!.summary).not.toBe('[functional_requirements]');
      expect(frFinding!.summary).toContain('US-001');
      expect(frFinding!.summary).toContain('6-character slug');

      const nfrFinding = packet.materialFindings.find(f => f.id === nfr.id);
      expect(nfrFinding!.summary).not.toBe('[non_functional_requirements]');
      expect(nfrFinding!.summary).toContain('NFR-002');
      expect(nfrFinding!.summary).toMatch(/security|AES-256/);
    });

    it('distills a cross_run_modification (what was applied) instead of `[kind]`', async () => {
      const mod = writer.writeRecord({
        record_type: 'cross_run_modification', schema_version: '1.0', workflow_run_id: 'run-1',
        phase_id: '9', janumicode_version_sha: 'abc',
        content: {
          kind: 'cross_run_modification', modification_type: 'breaking',
          changed_interface_id: 'IC-DELETE-001', applied_status: 'applied',
          modified_artifact_id: 'abc-123',
        },
      });
      const packet = await agent.research(baseBrief({
        scopeTier: 'all_runs', query: 'cross-run modification applied',
        knownRelevantRecordIds: [mod.id],
      }));
      const f = packet.materialFindings.find(x => x.id === mod.id);
      expect(f!.summary).not.toBe('[cross_run_modification]');
      expect(f!.summary).toMatch(/breaking/);
      expect(f!.summary).toContain('IC-DELETE-001');
    });
  });

  // ── computeMateriality (legacy sync API) ──────────────────────────
  describe('computeMateriality', () => {
    it('scores high-authority records higher', () => {
      const highAuth = agent.computeMateriality(
        { id: '1', recordType: 'artifact', authorityLevel: 7, governingStatus: 'active', summary: '', sourceRecordIds: [], materialityScore: 0 },
        baseBrief(),
      );

      const lowAuth = agent.computeMateriality(
        { id: '2', recordType: 'artifact', authorityLevel: 1, governingStatus: 'active', summary: '', sourceRecordIds: [], materialityScore: 0 },
        baseBrief(),
      );

      expect(highAuth).toBeGreaterThan(lowAuth);
    });

    it('scores contradicted records higher than non-contradicted', () => {
      const contradicted = agent.computeMateriality(
        { id: '1', recordType: 'artifact', authorityLevel: 5, governingStatus: 'contradicted', summary: '', sourceRecordIds: [], materialityScore: 0 },
        baseBrief(),
      );

      const normal = agent.computeMateriality(
        { id: '2', recordType: 'artifact', authorityLevel: 5, governingStatus: 'active', summary: '', sourceRecordIds: [], materialityScore: 0 },
        baseBrief(),
      );

      expect(contradicted).toBeGreaterThan(normal);
    });

    it('uses configurable weights', () => {
      const customWeights: MaterialityWeights = {
        ...defaultWeights,
        authority_level: 0.90,
        semantic_similarity: 0.02,
        constraint_relevance: 0.02,
        temporal_recency: 0.02,
        causal_relevance: 0.02,
        contradiction_signal: 0.02,
      };

      const customAgent = new DeepMemoryResearchAgent(db, new LLMCaller({ maxRetries: 0 }), customWeights);

      const score = customAgent.computeMateriality(
        { id: '1', recordType: 'artifact', authorityLevel: 7, governingStatus: 'active', summary: '', sourceRecordIds: [], materialityScore: 0 },
        baseBrief(),
      );

      // With 90% weight on authority, a level-7 record should score very high
      expect(score).toBeGreaterThan(0.8);
    });
  });

  // ── Stage 2: Broad Candidate Harvest ──────────────────────────────
  describe('Stage 2 — Broad Candidate Harvest', () => {
    it('finds records via FTS5 search', async () => {
      writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: { description: 'The authentication service handles user login and session management' },
      });

      const packet = await agent.research(baseBrief({
        requestingAgentRole: 'architecture_agent',
        query: 'authentication login session',
        phaseId: '4',
        subPhaseId: '4.1',
      }));

      expect(packet.completenessStatus).toBeDefined();
      expect(packet.queryDecomposition.topicEntities.length).toBeGreaterThan(0);
    });

    it('executor_agent: excludes constitutional_invariant process-governance records (kept for other roles)', async () => {
      const invariant = writer.writeRecord({
        record_type: 'constitutional_invariant',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: { statement: 'Agents never exercise judgment; escalate to the human.' },
      });

      // Seeded as known-relevant so it is guaranteed a candidate; the executor
      // role filter still drops it (runs post-harvest, by record_type).
      const execPacket = await agent.research(baseBrief({
        requestingAgentRole: 'executor_agent',
        query: 'judgment escalation',
        knownRelevantRecordIds: [invariant.id],
      }));
      expect(execPacket.materialFindings.some(f => f.id === invariant.id)).toBe(false);

      // A non-executor role keeps it.
      const otherPacket = await agent.research(baseBrief({
        requestingAgentRole: 'architecture_agent',
        query: 'judgment escalation',
        knownRelevantRecordIds: [invariant.id],
      }));
      expect(otherPacket.materialFindings.some(f => f.id === invariant.id)).toBe(true);
    });

    it('includes known relevant records with max materiality', async () => {
      const record = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: { data: 'important context' },
      });

      const packet = await agent.research(baseBrief({
        query: 'context',
        knownRelevantRecordIds: [record.id],
      }));

      const found = packet.materialFindings.find(f => f.id === record.id);
      expect(found).toBeDefined();
      expect(found!.materialityScore).toBe(1.0);
    });

    it('includes high-authority records even without FTS match', async () => {
      // Authority-6 record whose content doesn't match the query at all
      const authRec = writer.writeRecord({
        record_type: 'phase_gate_approved',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        authority_level: 6,
        content: { summary: 'Completely unrelated governing decision' },
      });

      const packet = await agent.research(baseBrief({
        query: 'xylophone flibbertigibbet',
      }));

      const found = packet.materialFindings.find(f => f.id === authRec.id);
      expect(found).toBeDefined();
      expect(found!.authorityLevel).toBe(6);
    });

    it('respects current_run scope tier', async () => {
      // Record in a different run
      db.prepare(`
        INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
        VALUES ('other-run', 'ws-1', 'abc', '2026-01-01T00:00:00Z', 'initiated')
      `).run();

      writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'other-run',
        janumicode_version_sha: 'abc',
        content: { summary: 'authentication service from another run' },
      });

      const packet = await agent.research(baseBrief({
        query: 'authentication',
        scopeTier: 'current_run',
      }));

      // Should find nothing because the matching record is in a different run
      expect(packet.materialFindings.length).toBe(0);
    });
  });

  // ── Stage 3: Materiality Scoring — new dimensions ────────────────
  describe('Stage 3 — Materiality dimensions', () => {
    it('temporal recency: older records score lower', async () => {
      // Write two records with different effective_at timestamps
      const now = new Date();
      const longAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // ~1 year ago

      const recent = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        authority_level: 5,
        content: { description: 'recent matching content for query' },
      });

      const old = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        authority_level: 5,
        content: { description: 'old matching content for query' },
      });

      // Backdate the "old" record
      db.prepare(`UPDATE governed_stream SET effective_at = ? WHERE id = ?`)
        .run(longAgo.toISOString(), old.id);
      db.prepare(`UPDATE governed_stream SET effective_at = ? WHERE id = ?`)
        .run(now.toISOString(), recent.id);

      const packet = await agent.research(baseBrief({ query: 'matching content' }));

      const recentFinding = packet.materialFindings.find(f => f.id === recent.id);
      const oldFinding = packet.materialFindings.find(f => f.id === old.id);

      // Both should be found; recent should score higher
      expect(recentFinding).toBeDefined();
      expect(oldFinding).toBeDefined();
      expect(recentFinding!.materialityScore).toBeGreaterThan(oldFinding!.materialityScore);
    });

    it('causal relevance: records with more inbound edges score higher', async () => {
      // Record A: nothing points to it
      const a = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        authority_level: 5,
        content: { description: 'isolated record' },
      });

      // Record B: heavily referenced
      const b = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        authority_level: 5,
        content: { description: 'referenced record' },
      });

      // Insert 5 inbound edges on record B. Edges need real source records.
      for (let i = 0; i < 5; i++) {
        const src = writer.writeRecord({
          record_type: 'artifact_produced',
          schema_version: '1.0',
          workflow_run_id: 'run-1',
          janumicode_version_sha: 'abc',
          authority_level: 5,
          content: { description: `referring record ${i}` },
        });
        db.prepare(`
          INSERT INTO memory_edge (id, source_record_id, target_record_id, edge_type, asserted_by, asserted_at, authority_level, status)
          VALUES (?, ?, ?, 'derives_from', 'system', ?, 5, 'confirmed')
        `).run(`edge-${i}`, src.id, b.id, new Date().toISOString());
      }

      const packet = await agent.research(baseBrief({ query: 'record' }));

      const aFinding = packet.materialFindings.find(f => f.id === a.id);
      const bFinding = packet.materialFindings.find(f => f.id === b.id);

      expect(aFinding).toBeDefined();
      expect(bFinding).toBeDefined();
      expect(bFinding!.materialityScore).toBeGreaterThan(aFinding!.materialityScore);
    });

    it('materiality breakdown is surfaced on each finding', async () => {
      writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        authority_level: 6,
        content: { summary: 'governing constraint' },
      });

      const packet = await agent.research(baseBrief({ query: 'governing constraint' }));

      expect(packet.materialFindings.length).toBeGreaterThan(0);
      const f = packet.materialFindings[0];
      // Async path populates materialityBreakdown
      expect(f.materialityBreakdown).toBeDefined();
      expect(f.materialityBreakdown!.semanticSimilarity).toBeGreaterThanOrEqual(0);
      expect(f.materialityBreakdown!.constraintRelevance).toBeGreaterThan(0);
      expect(f.materialityBreakdown!.authorityScore).toBeCloseTo(6 / 7, 4);
    });
  });

  // ── Stage 5: Supersession and Contradiction Analysis ─────────────
  describe('Stage 5 — Supersession analysis', () => {
    it('marks superseded records and keeps supersedent active', async () => {
      const oldRec = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        authority_level: 5,
        content: { description: 'subject matter v1' },
      });
      const newRec = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        authority_level: 5,
        content: { description: 'subject matter v2' },
      });

      // newRec supersedes oldRec
      db.prepare(`
        INSERT INTO memory_edge (id, source_record_id, target_record_id, edge_type, asserted_by, asserted_at, authority_level, status)
        VALUES ('e1', ?, ?, 'supersedes', 'system', ?, 5, 'confirmed')
      `).run(newRec.id, oldRec.id, new Date().toISOString());

      const packet = await agent.research(baseBrief({ query: 'subject matter' }));

      const oldFinding = packet.materialFindings.find(f => f.id === oldRec.id);
      const newFinding = packet.materialFindings.find(f => f.id === newRec.id);

      expect(oldFinding?.governingStatus).toBe('superseded');
      expect(newFinding?.governingStatus).toBe('active');
      // Supersession chain should be present
      expect(packet.supersessionChains.length).toBeGreaterThan(0);
    });

    it('chain links carry distilled CONTENT (what changed), not just record ids', async () => {
      // The superseded record is NOT independently material (no FTS match for
      // the query) — its summary must still be distilled directly so the chain
      // says what was replaced. The superseding record's statement is the
      // human-override rule (cf. the real cross-run "delete-by-key removed").
      const prior = writer.writeRecord({
        record_type: 'artifact_produced', schema_version: '1.0', workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc', authority_level: 5,
        content: { kind: 'interface_contracts', contracts: [{ id: 'IC-DELETE-001', protocol: 'HTTP', auth_mechanism: 'api-key' }] },
      });
      const override = writer.writeRecord({
        record_type: 'artifact_produced', schema_version: '1.0', workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc', authority_level: 6,
        content: { kind: 'interface_contracts', statement: 'Human override: the delete-by-key endpoint is REMOVED from the contract.' },
      });
      db.prepare(`
        INSERT INTO memory_edge (id, source_record_id, target_record_id, edge_type, asserted_by, asserted_at, authority_level, status)
        VALUES ('e-ov', ?, ?, 'supersedes', 'system', ?, 6, 'system_asserted')
      `).run(override.id, prior.id, new Date().toISOString());

      // Query matches the override (so it's material) but not the prior contract.
      const packet = await agent.research(baseBrief({ scopeTier: 'all_runs', query: 'delete-by-key endpoint override removed' }));

      const chain = packet.supersessionChains.find(c => c.chain.some(l => l.recordId === override.id));
      expect(chain, 'a chain containing the override should exist').toBeDefined();
      const governing = chain!.chain.find(l => l.position === 'current_governing');
      const superseded = chain!.chain.find(l => l.position === 'superseded');
      expect(governing!.summary).toContain('delete-by-key endpoint is REMOVED');
      // superseded link distilled directly even though it wasn't a material finding
      expect(superseded!.summary).toContain('IC-DELETE-001');
    });

    it('captures contradictions via memory edges', async () => {
      const a = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        authority_level: 5,
        content: { description: 'claim A about thing' },
      });
      const b = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        authority_level: 5,
        content: { description: 'claim B about thing' },
      });

      db.prepare(`
        INSERT INTO memory_edge (id, source_record_id, target_record_id, edge_type, asserted_by, asserted_at, authority_level, status)
        VALUES ('e1', ?, ?, 'contradicts', 'system', ?, 5, 'confirmed')
      `).run(a.id, b.id, new Date().toISOString());

      const packet = await agent.research(baseBrief({ query: 'claim about thing' }));

      expect(packet.contradictions.length).toBeGreaterThan(0);
      expect(packet.contradictions[0].recordIds).toContain(a.id);
      expect(packet.contradictions[0].recordIds).toContain(b.id);
    });
  });

  // ── Stage 6: Gap Detection ────────────────────────────────────────
  describe('Stage 6 — Gap detection', () => {
    it('reports embedding-service-missing gap when no embedding is attached', async () => {
      // Agent constructed without embedding service
      const packet = await agent.research(baseBrief({ query: 'anything' }));

      expect(packet.coverageAssessment.knownGaps.some(g =>
        /[Ee]mbedding service not attached/.test(g),
      )).toBe(true);
    });

    it('reports external-source-unavailable when scope is all_runs_plus_external', async () => {
      const packet = await agent.research(baseBrief({
        query: 'anything',
        scopeTier: 'all_runs_plus_external',
      }));

      expect(packet.unavailableSources.length).toBeGreaterThan(0);
      expect(packet.unavailableSources.some(s => s.source === 'git_history')).toBe(true);
    });

    it('completeness_status downgrades when gaps or unavailable sources exist', async () => {
      const packet = await agent.research(baseBrief({ query: 'anything' }));
      // With no embedding service, at least partial_low
      expect(['partial_low', 'partial_medium', 'incomplete_high']).toContain(packet.completenessStatus);
    });
  });

  // ── Governed-stream record writing ────────────────────────────────
  describe('Record writing', () => {
    it('writes retrieval_brief_record, query_decomposition_record, and context_packet', async () => {
      const agentWithWriter = new DeepMemoryResearchAgent(
        db, new LLMCaller({ maxRetries: 0 }), defaultWeights,
        { janumiCodeVersionSha: 'abc' },
        undefined, undefined, writer,
      );

      await agentWithWriter.research(baseBrief({ query: 'test query' }));

      const briefs = db.prepare(
        `SELECT * FROM governed_stream WHERE record_type = 'retrieval_brief_record'`,
      ).all() as Array<Record<string, unknown>>;
      const decomps = db.prepare(
        `SELECT * FROM governed_stream WHERE record_type = 'query_decomposition_record'`,
      ).all() as Array<Record<string, unknown>>;
      const packets = db.prepare(
        `SELECT * FROM governed_stream WHERE record_type = 'context_packet'`,
      ).all() as Array<Record<string, unknown>>;

      expect(briefs.length).toBe(1);
      expect(decomps.length).toBe(1);
      expect(packets.length).toBe(1);

      // Provenance: decomp derives from brief, packet derives from both
      const decompContent = JSON.parse(decomps[0].content as string) as Record<string, unknown>;
      expect(decompContent.topic_entities).toBeDefined();
      expect(decompContent.kind).toBe('query_decomposition');

      const packetContent = JSON.parse(packets[0].content as string) as Record<string, unknown>;
      expect(packetContent.artifact_type).toBe('context_packet');
      expect(packetContent.schema_version).toBe('1.0');
    });

    it('skips record writing when no writer is attached', async () => {
      await agent.research(baseBrief({ query: 'test' }));

      const briefs = db.prepare(
        `SELECT COUNT(*) as n FROM governed_stream WHERE record_type = 'retrieval_brief_record'`,
      ).get() as { n: number };
      expect(briefs.n).toBe(0);
    });

    it('writes a single dmr_pipeline container record with all 7 stages', async () => {
      // Regression: before this, the UI saw only Stage 1 and Stage 7
      // cards because stages 2-6 are deterministic and wrote no
      // records. The container record makes all 7 stages visible.
      const agentWithWriter = new DeepMemoryResearchAgent(
        db, new LLMCaller({ maxRetries: 0 }), defaultWeights,
        { janumiCodeVersionSha: 'abc' },
        undefined, undefined, writer,
      );

      await agentWithWriter.research(baseBrief({ query: 'test query' }));

      const pipelines = db.prepare(
        `SELECT * FROM governed_stream WHERE record_type = 'dmr_pipeline'`,
      ).all() as Array<Record<string, unknown>>;
      expect(pipelines.length).toBe(1);

      const pipeline = pipelines[0];
      expect(pipeline.produced_by_agent_role).toBe('deep_memory_research');
      expect(pipeline.sub_phase_id).toBe('1.2');
      const content = JSON.parse(pipeline.content as string) as {
        kind: string;
        pipeline_id: string;
        stages: Array<{ stage: number; kind: string; status: string; name: string; output_summary?: string }>;
        completeness_status?: string;
      };
      expect(content.kind).toBe('dmr_pipeline');
      // pipeline_id should be patched to the record's own id via json_set.
      expect(content.pipeline_id).toBe(pipeline.id);
      expect(content.stages).toHaveLength(7);
      // Stage kinds: only Stage 7 is LLM. Stage 1 (query decomposition)
      // is deterministic — `decomposeQuery` makes no LLM call. Stages 2-6
      // are deterministic. The webview uses this to show "kind" chips so
      // the user understands which stages invoke a model.
      expect(content.stages[0].kind).toBe('deterministic');
      expect(content.stages[1].kind).toBe('deterministic');
      expect(content.stages[5].kind).toBe('deterministic');
      expect(content.stages[6].kind).toBe('llm');
      // Every stage must be marked completed at pipeline-write time.
      for (const s of content.stages) expect(s.status).toBe('completed');
      // Completeness carries through from the Context Packet.
      expect(content.completeness_status).toBeDefined();
    });

    it('dmr_pipeline stages[].output_record_id link to the Stage 1 + 7 detail records', async () => {
      // The webview's isReferencedByDmrPipeline() suppresses these
      // detail records at top-level and inlines them in DmrPipelineCard
      // — that visual grouping only works if output_record_id is set.
      const agentWithWriter = new DeepMemoryResearchAgent(
        db, new LLMCaller({ maxRetries: 0 }), defaultWeights,
        { janumiCodeVersionSha: 'abc' },
        undefined, undefined, writer,
      );

      await agentWithWriter.research(baseBrief({ query: 'test query' }));

      const decomp = db.prepare(
        `SELECT id FROM governed_stream WHERE record_type = 'query_decomposition_record'`,
      ).get() as { id: string };
      const packet = db.prepare(
        `SELECT id FROM governed_stream WHERE record_type = 'context_packet'`,
      ).get() as { id: string };
      const pipeline = db.prepare(
        `SELECT content FROM governed_stream WHERE record_type = 'dmr_pipeline'`,
      ).get() as { content: string };
      const content = JSON.parse(pipeline.content) as {
        stages: Array<{ stage: number; output_record_id?: string }>;
      };
      expect(content.stages[0].output_record_id).toBe(decomp.id);
      expect(content.stages[6].output_record_id).toBe(packet.id);
    });
  });

  // ── contextPacketToJson — snake_case conversion ──────────────────
  describe('contextPacketToJson', () => {
    it('converts camelCase packet to snake_case for spec compliance', () => {
      const packet: ContextPacket = {
        queryDecomposition: {
          topicEntities: ['auth'],
          decisionTypesSought: ['menu_selection'],
          temporalScope: { from: '2020-01-01', to: '2026-01-01' },
          authorityLevelsIncluded: [5, 6, 7],
          sourcesInScope: ['governed_stream_current_run'],
        },
        completenessStatus: 'complete',
        completenessNarrative: 'All sources queried',
        unavailableSources: [],
        materialFindings: [{
          id: 'r1',
          recordType: 'artifact',
          authorityLevel: 6,
          governingStatus: 'active',
          summary: 'finding',
          sourceRecordIds: ['r1'],
          materialityScore: 0.87,
        }],
        activeConstraints: [{ id: 'r1', statement: 'must X', authorityLevel: 6, sourceRecordIds: ['r1'] }],
        supersessionChains: [],
        contradictions: [],
        openQuestions: [],
        implicitDecisions: [],
        recommendedDrilldowns: [],
        coverageAssessment: {
          sourcesQueried: ['a'],
          sourcesUnavailable: [],
          knownGaps: [],
          confidence: 1.0,
        },
      };

      const json = contextPacketToJson(packet);

      expect(json.artifact_type).toBe('context_packet');
      expect(json.schema_version).toBe('1.0');
      expect((json.query_decomposition as Record<string, unknown>).topic_entities).toEqual(['auth']);
      expect((json.query_decomposition as Record<string, unknown>).authority_levels_included).toEqual([5, 6, 7]);
      expect(Array.isArray(json.material_findings)).toBe(true);
      const first = (json.material_findings as Array<Record<string, unknown>>)[0];
      expect(first.record_type).toBe('artifact');
      expect(first.authority_level).toBe(6);
      expect(first.governing_status).toBe('active');
      expect(first.source_record_ids).toEqual(['r1']);
      expect(first.materiality_score).toBe(0.87);
    });
  });

  // ── LLM-backed Stage 1 / Stage 7 integration ─────────────────────
  describe('LLM-backed stages with real templates', () => {
    it('Stage 1 produces deterministic decomposition from the brief query (LLM no longer invoked)', async () => {
      // Stage 1 was demoted to a pure deterministic path: the LLM
      // response is no longer consulted, so this test verifies the
      // deterministic shape rather than asserting mocked LLM output
      // flows through.
      const templateLoader = new TemplateLoader(REPO_ROOT);
      const mockLLM = new MockLLMProvider();
      const caller = new LLMCaller({ maxRetries: 0 });
      caller.registerProvider(mockLLM);
      caller.registerProvider(mockLLM.bindAsProvider('llamacpp'));

      const agentWithLLM = new DeepMemoryResearchAgent(
        db, caller, defaultWeights,
        { janumiCodeVersionSha: 'abc', model: 'test-model' },
        templateLoader,
      );

      const packet = await agentWithLLM.research(baseBrief({ query: 'jwt authentication for FR-1 and NFR-2' }));

      // Deterministic extractor: prose tokens stay lowercase, ID-shaped
      // tokens (FR-1, NFR-2) are preserved verbatim.
      expect(packet.queryDecomposition.topicEntities).toContain('FR-1');
      expect(packet.queryDecomposition.topicEntities).toContain('NFR-2');
      expect(packet.queryDecomposition.topicEntities).toContain('authentication');
      // Authority levels are rule-fixed.
      expect(packet.queryDecomposition.authorityLevelsIncluded).toEqual([5, 6, 7]);
      // New spec-conformance field.
      expect(packet.queryDecomposition.knownConflictZones).toEqual([]);
    });

    it('derives knownConflictZones from confirmed contradicts/supersedes edges (empty when none)', async () => {
      // No conflict edges → empty (the spec-conformance default).
      const clean = await agent.research(baseBrief({ scopeTier: 'all_runs', query: 'plain query' }));
      expect(clean.queryDecomposition.knownConflictZones).toEqual([]);

      // A confirmed supersedes edge between two interface_contracts makes that
      // subject a conflict zone.
      const prior = writer.writeRecord({
        record_type: 'artifact_produced', schema_version: '1.0', workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc', authority_level: 5,
        content: { kind: 'interface_contracts', statement: 'v1' },
      });
      const next = writer.writeRecord({
        record_type: 'artifact_produced', schema_version: '1.0', workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc', authority_level: 6,
        content: { kind: 'interface_contracts', statement: 'v2' },
      });
      db.prepare(`
        INSERT INTO memory_edge (id, source_record_id, target_record_id, edge_type, asserted_by, asserted_at, authority_level, status)
        VALUES ('cz-e', ?, ?, 'supersedes', 'system', ?, 6, 'system_asserted')
      `).run(next.id, prior.id, new Date().toISOString());

      const withConflict = await agent.research(baseBrief({ scopeTier: 'all_runs', query: 'plain query' }));
      expect(withConflict.queryDecomposition.knownConflictZones).toContain('interface_contracts');
    });

    it('preserves lowercase STRUCTURAL ids (comp-*/task-*) as high-priority id tokens', async () => {
      // The per-leaf executor query anchors on lowercase comp-*/task-* ids; the
      // old uppercase-only regex dropped them to noise tokens. They must now be
      // captured verbatim AND ranked ahead of prose (id tokens lead the list).
      const packet = await agent.research(baseBrief({
        query: 'Implementation of task task-comp-lifecycle-manager-delete on component comp-lifecycle-manager for us-001',
      }));
      const te = packet.queryDecomposition.topicEntities;
      expect(te).toContain('task-comp-lifecycle-manager-delete');
      expect(te).toContain('comp-lifecycle-manager');
      expect(te).toContain('us-001');
      // ID tokens lead, ahead of prose words like "implementation".
      expect(te.indexOf('comp-lifecycle-manager')).toBeLessThan(te.indexOf('implementation'));
    });

    it('Stage 7 enriches narrative with open_questions from LLM synthesis', async () => {
      const templateLoader = new TemplateLoader(REPO_ROOT);
      const mockLLM = new MockLLMProvider();
      mockLLM.setFixture('Query Decomposition', {
        parsedJson: {
          topic_entities: ['thing'],
          decision_types_sought: [],
          temporal_scope: { from: '2020-01-01', to: '2026-01-01' },
          authority_levels_included: [5, 6, 7],
          sources_in_scope: ['governed_stream_current_run'],
        },
      });
      mockLLM.setFixture('Context Packet Synthesis', {
        parsedJson: {
          decision_context_summary: 'Agents synthesized the following governing state.',
          completeness_narrative: 'Full coverage achieved.',
          open_questions: [
            { question: 'What is the target runtime?', still_unresolved: true, source_record_id: 'rec-1' },
          ],
        },
      });
      const caller = new LLMCaller({ maxRetries: 0 });
      caller.registerProvider(mockLLM);
      caller.registerProvider(mockLLM.bindAsProvider('llamacpp'));

      const agentWithLLM = new DeepMemoryResearchAgent(
        db, caller, defaultWeights,
        { janumiCodeVersionSha: 'abc', model: 'test-model' },
        templateLoader,
      );

      const packet = await agentWithLLM.research(baseBrief({ query: 'thing' }));

      expect(packet.openQuestions.length).toBe(1);
      expect(packet.openQuestions[0].question).toBe('What is the target runtime?');
      // After the Stage 7 split fix: decision_context_summary stays in its
      // own field rather than being concatenated into completenessNarrative.
      expect(packet.decisionContextSummary).toContain('Agents synthesized');
      expect(packet.completenessNarrative).toContain('Full coverage achieved');
    });

    it('degrades to deterministic decomposition when LLM returns nothing parseable', async () => {
      const templateLoader = new TemplateLoader(REPO_ROOT);
      const mockLLM = new MockLLMProvider();
      // No fixtures — mock returns empty JSON for every call.
      const caller = new LLMCaller({ maxRetries: 0 });
      caller.registerProvider(mockLLM);
      caller.registerProvider(mockLLM.bindAsProvider('llamacpp'));

      const agentWithLLM = new DeepMemoryResearchAgent(
        db, caller, defaultWeights,
        { janumiCodeVersionSha: 'abc', model: 'test-model' },
        templateLoader,
      );

      const packet = await agentWithLLM.research(baseBrief({ query: 'hello world authentication' }));

      // Should still produce sensible topic entities from deterministic fallback
      expect(packet.queryDecomposition.topicEntities.length).toBeGreaterThan(0);
      expect(packet.queryDecomposition.sourcesInScope).toContain('governed_stream_current_run');
    });
  });

  // ── A.3 fix — harvestByAuthority handles mixed-level requests ─────
  describe('harvestByAuthority (mixed-level requests)', () => {
    it('still harvests authority-5+ records when query decomposition includes levels < 5', async () => {
      // Regression: the old Math.min short-circuit returned [] when the
      // *lowest* requested level was below 5, even if 5+ levels were also
      // requested. Now we filter to the requested levels >= 5 first.
      writer.writeRecord({
        record_type: 'decision_trace',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: {
          decision_type: 'something',
          payload: { description: 'a governing decision about authentication' },
        },
      });

      // The deterministic decomposer asks for [5,6,7] — that should still
      // surface governance records regardless of broader requests. But the
      // bug previously fired when an *LLM-driven* decomposer returned a
      // wider set including lows. Verify the harvest finds the record.
      const packet = await agent.research(baseBrief({
        query: 'governing authentication decision',
      }));

      expect(packet.materialFindings.length).toBeGreaterThan(0);
    });
  });

  // ── A.2-revised — reasoning-trail deprioritization ────────────────
  describe('reasoning-trail deprioritization', () => {
    it('reasoning record scores lower than equivalent governance record', () => {
      // Same authority, same governing status, same id — only record_type differs.
      // The 0.4x multiplier should make the reasoning record score lower.
      const reasoningScore = agent.computeMateriality(
        {
          id: '1',
          recordType: 'agent_reasoning_step',
          authorityLevel: 2,
          governingStatus: 'active',
          summary: '',
          sourceRecordIds: [],
          materialityScore: 0,
        },
        baseBrief(),
      );

      const governanceScore = agent.computeMateriality(
        {
          id: '2',
          recordType: 'artifact_produced',
          authorityLevel: 2,
          governingStatus: 'active',
          summary: '',
          sourceRecordIds: [],
          materialityScore: 0,
        },
        baseBrief(),
      );

      expect(reasoningScore).toBeLessThan(governanceScore);
      // 0.4x ratio (with floating-point slack)
      expect(reasoningScore / governanceScore).toBeCloseTo(0.4, 1);
    });

    it.each([
      'agent_invocation',
      'agent_output',
      'agent_reasoning_step',
      'reasoning_review_finding_record',
      'reasoning_review_harness_record',
    ])('record_type=%s gets deprioritized', (recordType) => {
      const reasoning = agent.computeMateriality(
        { id: '1', recordType, authorityLevel: 5, governingStatus: 'active', summary: '', sourceRecordIds: [], materialityScore: 0 },
        baseBrief(),
      );
      const governance = agent.computeMateriality(
        { id: '2', recordType: 'artifact_produced', authorityLevel: 5, governingStatus: 'active', summary: '', sourceRecordIds: [], materialityScore: 0 },
        baseBrief(),
      );
      expect(reasoning).toBeLessThan(governance);
    });
  });

  // ── B.3/B.4 — effective authority surfaces phase-gate-certified records ──
  describe('effective authority via phase-gate-approved', () => {
    it('artifact referenced by phase_gate_approved appears as active_constraint', async () => {
      // Write an artifact at stored authority=2
      const artifact = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        sub_phase_id: 'system_requirements',
        janumicode_version_sha: 'abc',
        content: { description: 'authentication uses OAuth 2.0 with PKCE' },
      });

      // Write a phase_gate_approved record (authority=5 by writer rule)
      const gate = writer.writeRecord({
        record_type: 'phase_gate_approved',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: { phase_id: '3', approved_artifact_ids: [artifact.id] },
      });

      // Insert a `validates` memory_edge from the gate to the artifact —
      // this is what the spec says Stage II should produce, and it's what
      // buildAuthorityElevationIndex queries.
      db.prepare(`
        INSERT INTO memory_edge (id, source_record_id, target_record_id, edge_type, asserted_by, asserted_at, authority_level, status)
        VALUES ('e1', ?, ?, 'validates', 'test', ?, 5, 'system_asserted')
      `).run(gate.id, artifact.id, new Date().toISOString());

      const packet = await agent.research(baseBrief({
        query: 'authentication OAuth PKCE',
      }));

      // The artifact's effective authority is now 6, so it should appear
      // both in materialFindings (with authorityLevel=6) and as an
      // active_constraint (filter requires authorityLevel >= 6).
      const found = packet.materialFindings.find(f => f.id === artifact.id);
      expect(found).toBeDefined();
      expect(found!.authorityLevel).toBe(6);

      const constraint = packet.activeConstraints.find(c => c.id === artifact.id);
      expect(constraint).toBeDefined();
      expect(constraint!.authorityLevel).toBe(6);
    });

    it('constitutional_invariant records appear with authority=7', async () => {
      const inv = writer.writeRecord({
        record_type: 'constitutional_invariant',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        authority_level: 7,
        content: {
          kind: 'constitutional_invariant',
          invariant_id: 'CI-X',
          statement: 'The OAuth flow must use PKCE for all public clients',
          source_section: '1.5',
        },
      });

      const packet = await agent.research(baseBrief({
        query: 'OAuth PKCE public clients',
      }));

      const found = packet.materialFindings.find(f => f.id === inv.id);
      expect(found).toBeDefined();
      expect(found!.authorityLevel).toBe(7);

      const constraint = packet.activeConstraints.find(c => c.id === inv.id);
      expect(constraint).toBeDefined();
      expect(constraint!.authorityLevel).toBe(7);
    });
  });
});
