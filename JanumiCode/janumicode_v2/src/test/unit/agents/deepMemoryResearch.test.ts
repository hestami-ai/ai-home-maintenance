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
    it('Stage 1 uses deep_memory_query_decomposition template when loader + mock LLM are provided', async () => {
      const templateLoader = new TemplateLoader(REPO_ROOT);
      const mockLLM = new MockLLMProvider();
      // Match on the DMR Stage 1 prompt's signature substring
      mockLLM.setFixture('Query Decomposition', {
        parsedJson: {
          topic_entities: ['authentication', 'jwt'],
          decision_types_sought: ['mirror_approval'],
          temporal_scope: { from: '2025-01-01', to: '2026-01-01' },
          authority_levels_included: [6, 7],
          sources_in_scope: ['governed_stream_current_run'],
        },
      });
      const caller = new LLMCaller({ maxRetries: 0 });
      caller.registerProvider(mockLLM);
      caller.registerProvider(mockLLM.bindAsProvider('ollama'));

      const agentWithLLM = new DeepMemoryResearchAgent(
        db, caller, defaultWeights,
        { janumiCodeVersionSha: 'abc' },
        templateLoader,
      );

      const packet = await agentWithLLM.research(baseBrief({ query: 'jwt authentication' }));

      // Stage 1's LLM response should flow into queryDecomposition
      expect(packet.queryDecomposition.topicEntities).toContain('authentication');
      expect(packet.queryDecomposition.authorityLevelsIncluded).toEqual([6, 7]);
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
      caller.registerProvider(mockLLM.bindAsProvider('ollama'));

      const agentWithLLM = new DeepMemoryResearchAgent(
        db, caller, defaultWeights,
        { janumiCodeVersionSha: 'abc' },
        templateLoader,
      );

      const packet = await agentWithLLM.research(baseBrief({ query: 'thing' }));

      expect(packet.openQuestions.length).toBe(1);
      expect(packet.openQuestions[0].question).toBe('What is the target runtime?');
      expect(packet.completenessNarrative).toContain('Agents synthesized');
    });

    it('degrades to deterministic decomposition when LLM returns nothing parseable', async () => {
      const templateLoader = new TemplateLoader(REPO_ROOT);
      const mockLLM = new MockLLMProvider();
      // No fixtures — mock returns empty JSON for every call.
      const caller = new LLMCaller({ maxRetries: 0 });
      caller.registerProvider(mockLLM);
      caller.registerProvider(mockLLM.bindAsProvider('ollama'));

      const agentWithLLM = new DeepMemoryResearchAgent(
        db, caller, defaultWeights,
        { janumiCodeVersionSha: 'abc' },
        templateLoader,
      );

      const packet = await agentWithLLM.research(baseBrief({ query: 'hello world authentication' }));

      // Should still produce sensible topic entities from deterministic fallback
      expect(packet.queryDecomposition.topicEntities.length).toBeGreaterThan(0);
      expect(packet.queryDecomposition.sourcesInScope).toContain('governed_stream_current_run');
    });
  });
});
