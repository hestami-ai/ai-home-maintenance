import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import { DeepMemoryResearchAgent, type MaterialityWeights } from '../../../lib/agents/deepMemoryResearch';
import { LLMCaller } from '../../../lib/llm/llmCaller';

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

  describe('computeMateriality', () => {
    it('scores high-authority records higher', () => {
      const highAuth = agent.computeMateriality(
        { id: '1', recordType: 'artifact', authorityLevel: 7, governingStatus: 'active', summary: '', sourceRecordIds: [], materialityScore: 0 },
        { requestingAgentRole: 'test', scopeTier: 'current_run', query: '', knownRelevantRecordIds: [], workflowRunId: 'run-1', phaseId: '1', subPhaseId: '1.1' },
      );

      const lowAuth = agent.computeMateriality(
        { id: '2', recordType: 'artifact', authorityLevel: 1, governingStatus: 'active', summary: '', sourceRecordIds: [], materialityScore: 0 },
        { requestingAgentRole: 'test', scopeTier: 'current_run', query: '', knownRelevantRecordIds: [], workflowRunId: 'run-1', phaseId: '1', subPhaseId: '1.1' },
      );

      expect(highAuth).toBeGreaterThan(lowAuth);
    });

    it('scores contradicted records higher than non-contradicted', () => {
      const contradicted = agent.computeMateriality(
        { id: '1', recordType: 'artifact', authorityLevel: 5, governingStatus: 'contradicted', summary: '', sourceRecordIds: [], materialityScore: 0 },
        { requestingAgentRole: 'test', scopeTier: 'current_run', query: '', knownRelevantRecordIds: [], workflowRunId: 'run-1', phaseId: '1', subPhaseId: '1.1' },
      );

      const normal = agent.computeMateriality(
        { id: '2', recordType: 'artifact', authorityLevel: 5, governingStatus: 'active', summary: '', sourceRecordIds: [], materialityScore: 0 },
        { requestingAgentRole: 'test', scopeTier: 'current_run', query: '', knownRelevantRecordIds: [], workflowRunId: 'run-1', phaseId: '1', subPhaseId: '1.1' },
      );

      expect(contradicted).toBeGreaterThan(normal);
    });

    it('uses configurable weights', () => {
      const customWeights: MaterialityWeights = {
        ...defaultWeights,
        authority_level: 0.90, // Heavily weight authority
        semantic_similarity: 0.02,
        constraint_relevance: 0.02,
        temporal_recency: 0.02,
        causal_relevance: 0.02,
        contradiction_signal: 0.02,
      };

      const customAgent = new DeepMemoryResearchAgent(db, new LLMCaller({ maxRetries: 0 }), customWeights);

      const score = customAgent.computeMateriality(
        { id: '1', recordType: 'artifact', authorityLevel: 7, governingStatus: 'active', summary: '', sourceRecordIds: [], materialityScore: 0 },
        { requestingAgentRole: 'test', scopeTier: 'current_run', query: '', knownRelevantRecordIds: [], workflowRunId: 'run-1', phaseId: '1', subPhaseId: '1.1' },
      );

      // With 90% weight on authority, a level-7 record should score very high
      expect(score).toBeGreaterThan(0.8);
    });
  });

  describe('research (FTS harvest)', () => {
    it('finds records via FTS5 search', async () => {
      writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: { description: 'The authentication service handles user login and session management' },
      });

      const packet = await agent.research({
        requestingAgentRole: 'architecture_agent',
        scopeTier: 'current_run',
        query: 'authentication login session',
        knownRelevantRecordIds: [],
        workflowRunId: 'run-1',
        phaseId: '4',
        subPhaseId: '4.1',
      });

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

      const packet = await agent.research({
        requestingAgentRole: 'test',
        scopeTier: 'current_run',
        query: 'context',
        knownRelevantRecordIds: [record.id],
        workflowRunId: 'run-1',
        phaseId: '1',
        subPhaseId: '1.2',
      });

      // Known relevant record should appear in findings
      const found = packet.materialFindings.find(f => f.id === record.id);
      expect(found).toBeDefined();
      expect(found!.materialityScore).toBe(1.0);
    });
  });
});
