/**
 * Tests for Stage III LLM Relationship Extraction (spec §8.12).
 *
 * Covers the dispatch + safety logic. Full end-to-end LLM behavior is
 * integration-tested separately (Stage III fires async and depends on the
 * real provider). These tests verify:
 *   - No-op when LLM deps not attached
 *   - No-op for plumbing record types
 *   - Dispatch picks the correct prompt template by record class
 *   - Anti-hallucination drops bad edges (post-LLM validation logic)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import { IngestionPipelineRunner } from '../../../lib/orchestrator/ingestionPipelineRunner';
import { TemplateLoader } from '../../../lib/orchestrator/templateLoader';
import { LLMCaller } from '../../../lib/llm/llmCaller';
import * as path from 'node:path';
import type { RecordType } from '../../../lib/types/records';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
let idCounter = 0;
function testId(): string { return `s3-${++idCounter}`; }

describe('IngestionPipelineRunner.runStageIIIRelationshipExtraction', () => {
  let db: Database;
  let writer: GovernedStreamWriter;
  let pipeline: IngestionPipelineRunner;

  beforeEach(() => {
    idCounter = 0;
    db = createTestDatabase();
    writer = new GovernedStreamWriter(db, testId);
    pipeline = new IngestionPipelineRunner(db, testId);
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc', '2026-01-01T00:00:00Z', 'initiated')
    `).run();
  });

  afterEach(() => { db.close(); });

  describe('no-op behaviors', () => {
    it('is a no-op when LLM dependencies are not attached', async () => {
      const record = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: { description: 'a thing' },
      });

      const result = pipeline.ingest(record);
      // Wait a tick for any fire-and-forget paths
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(result.errors.filter(e => e.includes('Stage III'))).toHaveLength(0);

      const proposedCount = db.prepare(
        `SELECT COUNT(*) AS c FROM governed_stream WHERE record_type = 'memory_edge_proposed'`,
      ).get() as { c: number };
      expect(proposedCount.c).toBe(0);
    });

    it.each<RecordType>([
      'json_repair_record',
      'file_system_write_record',
      'mirror_presented',
      'decision_bundle_presented',
      'execution_wave_started',
      'execution_wave_completed',
      'workflow_run_closure',
      'memory_edge_proposed',
      'memory_edge_confirmed',
      'dmr_pipeline',
      'retrieval_brief_record',
      'context_packet',
      'query_decomposition_record',
      'constitutional_invariant',
    ])('does not invoke LLM for plumbing record_type=%s', async (recordType) => {
      // Attach a mock LLMCaller whose .call should NEVER be invoked
      const mockCall = vi.fn().mockRejectedValue(new Error('Stage III should not fire for plumbing'));
      const mockLLM = { call: mockCall } as unknown as LLMCaller;
      const tl = new TemplateLoader(REPO_ROOT);

      pipeline.setStage3LLMDependencies({
        llmCaller: mockLLM,
        templateLoader: tl,
        writer,
        provider: 'mock',
        model: 'mock',
        janumiCodeVersionSha: 'abc',
      });

      const record = writer.writeRecord({
        record_type: recordType,
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: { something: 'value with words to match FTS' },
      });

      pipeline.ingest(record);
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(mockCall).not.toHaveBeenCalled();
    });
  });

  describe('LLM dispatch + anti-hallucination', () => {
    it('dispatches reasoning-class prompt for agent_reasoning_step', async () => {
      // Pre-populate a candidate so FTS has something to retrieve
      writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: { description: 'authentication service handles OAuth flow' },
      });

      const captured: Array<{ prompt: string }> = [];
      const mockCall = vi.fn().mockImplementation(async (args: { prompt: string }) => {
        captured.push({ prompt: args.prompt });
        return { parsed: { proposed_edges: [] }, jsonText: '{"proposed_edges":[]}' };
      });
      const mockLLM = { call: mockCall } as unknown as LLMCaller;
      const tl = new TemplateLoader(REPO_ROOT);

      pipeline.setStage3LLMDependencies({
        llmCaller: mockLLM,
        templateLoader: tl,
        writer,
        provider: 'mock',
        model: 'mock',
        janumiCodeVersionSha: 'abc',
      });

      const record = writer.writeRecord({
        record_type: 'agent_reasoning_step',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: {
          kind: 'agent_reasoning_step',
          thinking: 'I considered the authentication OAuth approach but rejected it',
        },
      });

      pipeline.ingest(record);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockCall).toHaveBeenCalled();
      // Reasoning-class prompt contains a phrase unique to that template
      const prompt = captured[0]?.prompt ?? '';
      expect(prompt).toContain('reasoning-trail');
    });

    it('dispatches artifact-class prompt for artifact_produced', async () => {
      writer.writeRecord({
        record_type: 'decision_trace',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: {
          decision_type: 'approve',
          payload: { description: 'authentication via OAuth approved' },
        },
      });

      const captured: Array<{ prompt: string }> = [];
      const mockCall = vi.fn().mockImplementation(async (args: { prompt: string }) => {
        captured.push({ prompt: args.prompt });
        return { parsed: { proposed_edges: [] }, jsonText: '{"proposed_edges":[]}' };
      });
      const mockLLM = { call: mockCall } as unknown as LLMCaller;
      const tl = new TemplateLoader(REPO_ROOT);

      pipeline.setStage3LLMDependencies({
        llmCaller: mockLLM,
        templateLoader: tl,
        writer,
        provider: 'mock',
        model: 'mock',
        janumiCodeVersionSha: 'abc',
      });

      const record = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: { description: 'authentication OAuth specification' },
      });

      pipeline.ingest(record);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockCall).toHaveBeenCalled();
      const prompt = captured[0]?.prompt ?? '';
      // Artifact-class prompt contains governance/artifact framing
      expect(prompt).toContain('governance');
      // Must NOT be reasoning-class
      expect(prompt).not.toContain('reasoning-trail');
    });

    it('drops edges with hallucinated target_record_id', async () => {
      // Set up one real candidate
      const candidate = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: { description: 'real candidate record' },
      });

      // Mock returns one edge to the real candidate + one edge to fabricated ID
      const mockCall = vi.fn().mockResolvedValue({
        parsed: {
          proposed_edges: [
            { edge_type: 'derives_from', target_record_id: candidate.id, confidence: 0.9, rationale: 'real' },
            { edge_type: 'derives_from', target_record_id: 'FABRICATED-ID-XYZ', confidence: 0.9, rationale: 'hallucinated' },
          ],
        },
        jsonText: '',
      });
      const mockLLM = { call: mockCall } as unknown as LLMCaller;

      pipeline.setStage3LLMDependencies({
        llmCaller: mockLLM,
        templateLoader: new TemplateLoader(REPO_ROOT),
        writer,
        provider: 'mock', model: 'mock', janumiCodeVersionSha: 'abc',
      });

      const newRec = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: { description: 'real candidate record similar content' },
      });

      pipeline.ingest(newRec);
      await new Promise(resolve => setTimeout(resolve, 100));

      const proposed = db.prepare(
        `SELECT content FROM governed_stream WHERE record_type = 'memory_edge_proposed'`,
      ).all() as Array<{ content: string }>;
      const targets = proposed.map(p => (JSON.parse(p.content) as { target_record_id: string }).target_record_id);
      expect(targets).toContain(candidate.id);
      expect(targets).not.toContain('FABRICATED-ID-XYZ');
    });

    it('drops edges with invalid edge_type not in vocabulary', async () => {
      const candidate = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: { description: 'candidate record' },
      });

      const mockCall = vi.fn().mockResolvedValue({
        parsed: {
          proposed_edges: [
            { edge_type: 'derives_from',     target_record_id: candidate.id, confidence: 0.9, rationale: 'ok' },
            { edge_type: 'frobulates',       target_record_id: candidate.id, confidence: 0.9, rationale: 'bad' },
            { edge_type: 'depends_violently_on', target_record_id: candidate.id, confidence: 0.9, rationale: 'bad' },
          ],
        },
        jsonText: '',
      });

      pipeline.setStage3LLMDependencies({
        llmCaller: { call: mockCall } as unknown as LLMCaller,
        templateLoader: new TemplateLoader(REPO_ROOT),
        writer,
        provider: 'mock', model: 'mock', janumiCodeVersionSha: 'abc',
      });

      const newRec = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: { description: 'candidate record similar' },
      });

      pipeline.ingest(newRec);
      await new Promise(resolve => setTimeout(resolve, 100));

      const proposed = db.prepare(
        `SELECT content FROM governed_stream WHERE record_type = 'memory_edge_proposed'`,
      ).all() as Array<{ content: string }>;
      const edgeTypes = proposed.map(p => (JSON.parse(p.content) as { edge_type: string }).edge_type);
      expect(edgeTypes).toContain('derives_from');
      expect(edgeTypes).not.toContain('frobulates');
      expect(edgeTypes).not.toContain('depends_violently_on');
    });

    it('drops self-edges (target = source)', async () => {
      const mockCall = vi.fn().mockImplementation(async (_args: unknown) => ({
        parsed: { proposed_edges: [] }, jsonText: '',
      }));

      // Custom mock returns a self-edge — but the implementation requires
      // target_record_id to be in the candidate set, which excludes self,
      // so this is mostly belt-and-suspenders. Verify it's enforced anyway.
      const recordToBeWritten = { id: '' };
      const mockCallSelf = vi.fn().mockImplementation(async (_args: unknown) => ({
        parsed: {
          proposed_edges: [
            { edge_type: 'derives_from', target_record_id: recordToBeWritten.id, confidence: 0.9, rationale: 'self' },
          ],
        },
        jsonText: '',
      }));

      pipeline.setStage3LLMDependencies({
        llmCaller: { call: mockCallSelf } as unknown as LLMCaller,
        templateLoader: new TemplateLoader(REPO_ROOT),
        writer,
        provider: 'mock', model: 'mock', janumiCodeVersionSha: 'abc',
      });

      const newRec = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: { description: 'self-referential content' },
      });
      recordToBeWritten.id = newRec.id;

      pipeline.ingest(newRec);
      await new Promise(resolve => setTimeout(resolve, 100));

      const proposed = db.prepare(
        `SELECT content FROM governed_stream WHERE record_type = 'memory_edge_proposed'`,
      ).all();
      expect(proposed).toHaveLength(0);
      // Avoid unused variable lint
      expect(mockCall).not.toHaveBeenCalled();
    });

    it('writes both governed_stream record AND memory_edge row for each accepted edge', async () => {
      const candidate = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: { description: 'governing requirement' },
      });

      const mockCall = vi.fn().mockResolvedValue({
        parsed: {
          proposed_edges: [
            { edge_type: 'implements', target_record_id: candidate.id, confidence: 0.85, rationale: 'realizes the requirement' },
          ],
        },
        jsonText: '',
      });

      pipeline.setStage3LLMDependencies({
        llmCaller: { call: mockCall } as unknown as LLMCaller,
        templateLoader: new TemplateLoader(REPO_ROOT),
        writer,
        provider: 'mock', model: 'mock', janumiCodeVersionSha: 'abc',
      });

      const newRec = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: { description: 'implementation of the governing requirement' },
      });

      pipeline.ingest(newRec);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Governed stream audit record
      const proposed = db.prepare(
        `SELECT content FROM governed_stream WHERE record_type = 'memory_edge_proposed'`,
      ).all() as Array<{ content: string }>;
      expect(proposed).toHaveLength(1);
      const proposedContent = JSON.parse(proposed[0].content) as {
        edge_type: string;
        source_record_id: string;
        target_record_id: string;
        confidence: number;
      };
      expect(proposedContent.edge_type).toBe('implements');
      expect(proposedContent.source_record_id).toBe(newRec.id);
      expect(proposedContent.target_record_id).toBe(candidate.id);

      // memory_edge graph row
      const edge = db.prepare(
        `SELECT edge_type, source_record_id, target_record_id, status FROM memory_edge
         WHERE source_record_id = ? AND target_record_id = ?`,
      ).get(newRec.id, candidate.id) as
        { edge_type: string; source_record_id: string; target_record_id: string; status: string };
      expect(edge.edge_type).toBe('implements');
      expect(edge.status).toBe('proposed');
    });
  });
});
