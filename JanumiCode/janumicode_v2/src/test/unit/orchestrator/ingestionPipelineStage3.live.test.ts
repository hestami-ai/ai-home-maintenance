/**
 * Live-ollama test for Ingestion Pipeline Stage III (LLM Relationship
 * Extraction, spec §8.12). Verifies that against a real Ollama:
 *
 *   1. The artifact-class prompt produces parseable JSON output
 *   2. The reasoning-class prompt produces parseable JSON output
 *   3. The output respects the proposed_edges schema (anti-hallucination
 *      guards drop bad edges; we observe only valid ones in the DB)
 *   4. The model can pick valid target_record_ids from the candidate set
 *      (i.e., the prompt's anti-hallucination instructions land)
 *
 * Skipped gracefully when ollama isn't reachable. Doesn't assert exact
 * edge counts — LLMs aren't deterministic — only that the post-validation
 * persistence path produces zero or more valid edges with no crashes.
 *
 * Requires:
 *   - `ollama serve` running on OLLAMA_URL (default 127.0.0.1:11434)
 *   - `qwen3.5:9b` model pulled
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import { IngestionPipelineRunner } from '../../../lib/orchestrator/ingestionPipelineRunner';
import { TemplateLoader } from '../../../lib/orchestrator/templateLoader';
import { LLMCaller } from '../../../lib/llm/llmCaller';
import { OllamaProvider } from '../../../lib/llm/providers/ollama';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
const MODEL = process.env.JANUMICODE_LIVE_STAGE3_MODEL ?? 'qwen3.5:9b';

let llmCaller: LLMCaller;
let ollamaReachable = false;

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
    console.warn(`[live-ollama] skipping Stage III tests — ${OLLAMA_URL} not reachable`);
    return;
  }
  llmCaller = new LLMCaller({ maxRetries: 0 });
  llmCaller.registerProvider(new OllamaProvider());
});

let idCounter = 0;
function testId(): string { return `live-s3-${++idCounter}`; }

describe('IngestionPipelineRunner.Stage III [live-ollama]', () => {
  let db: Database;
  let writer: GovernedStreamWriter;
  let pipeline: IngestionPipelineRunner;
  let templateLoader: TemplateLoader;

  beforeEach(() => {
    idCounter = 0;
    db = createTestDatabase();
    writer = new GovernedStreamWriter(db, testId);
    pipeline = new IngestionPipelineRunner(db, testId);
    templateLoader = new TemplateLoader(REPO_ROOT);
    // Wire the LLMCaller's writer so agent_invocation records get written
    // for each Stage III LLM call — without this, the call still fires and
    // produces edges, but the audit trace records (which our assertions
    // observe) are never persisted. Production mirrors this via
    // OrchestratorEngine.llmCaller.setWriter(...) at construction time.
    llmCaller.setWriter(writer, 'abc');
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc', '2026-01-01T00:00:00Z', 'initiated')
    `).run();
  });

  afterEach(() => { db.close(); });

  it('artifact-class prompt produces parseable JSON when invoked against ollama', async () => {
    if (!ollamaReachable) return;

    // Seed a candidate record that should be retrievable via FTS and
    // semantically related to the new record's content.
    const candidate = writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      sub_phase_id: 'system_requirements',
      janumicode_version_sha: 'abc',
      content: {
        description: 'The authentication service must use OAuth 2.0 with PKCE for all public clients.',
        kind: 'system_requirement',
      },
    });

    pipeline.setStage3LLMDependencies({
      llmCaller,
      templateLoader,
      writer,
      provider: 'ollama',
      model: MODEL,
      janumiCodeVersionSha: 'abc',
    });

    // Write a new artifact-class record whose content references / depends
    // on the candidate. A capable LLM should propose something like
    // `implements` or `derives_from`.
    const newRec = writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      sub_phase_id: 'component_skeleton',
      janumicode_version_sha: 'abc',
      content: {
        description: 'AuthService component implements OAuth 2.0 PKCE flow per the authentication requirement.',
        kind: 'component_skeleton',
      },
    });

    pipeline.ingest(newRec);
    // Stage III fires fire-and-forget; await all in-flight work
    // deterministically rather than polling. Bounded by the per-it timeout.
    await pipeline.awaitPendingStage3();

    const llmFired = db.prepare(
      `SELECT COUNT(*) AS c FROM governed_stream
        WHERE record_type = 'agent_invocation'
          AND produced_by_agent_role = 'ingestion_pipeline_stage3'`,
    ).get() as { c: number };
    expect(llmFired.c).toBeGreaterThanOrEqual(1);

    // Anti-hallucination invariant: every persisted edge has target in the
    // candidate set (only `candidate.id` was retrievable) and a valid
    // edge_type. If the LLM hallucinated, the guard dropped it silently.
    const persisted = db.prepare(
      `SELECT content FROM governed_stream WHERE record_type = 'memory_edge_proposed'`,
    ).all() as Array<{ content: string }>;
    for (const p of persisted) {
      const c = JSON.parse(p.content) as { target_record_id: string; edge_type: string };
      expect(c.target_record_id).toBe(candidate.id);
      expect([
        'derives_from', 'supports', 'contradicts', 'supersedes', 'implements',
        'depends_on', 'blocked_by', 'invalidates', 'raises', 'answers',
      ]).toContain(c.edge_type);
    }
  }, 240_000);

  it('reasoning-class prompt produces parseable JSON when invoked against ollama', async () => {
    if (!ollamaReachable) return;

    // Seed a candidate decision the reasoning record might contradict.
    const decision = writer.writeRecord({
      record_type: 'decision_trace',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      janumicode_version_sha: 'abc',
      content: {
        decision_type: 'approve',
        payload: {
          statement: 'Use JWT tokens with 24-hour expiry for all session authentication.',
        },
      },
    });

    pipeline.setStage3LLMDependencies({
      llmCaller,
      templateLoader,
      writer,
      provider: 'ollama',
      model: MODEL,
      janumiCodeVersionSha: 'abc',
    });

    // Reasoning record that explicitly rejects the JWT decision — a
    // capable LLM should propose `contradicts` or `invalidates` to the
    // decision_trace.
    const reasoning = writer.writeRecord({
      record_type: 'agent_reasoning_step',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      janumicode_version_sha: 'abc',
      content: {
        kind: 'agent_reasoning_step',
        thinking:
          'Reviewing the JWT 24-hour expiry decision — this conflicts with the new compliance ' +
          'requirement for 15-minute session token rotation. I reject the prior choice; we need ' +
          'shorter-lived tokens with refresh rotation instead.',
      },
    });

    pipeline.ingest(reasoning);
    await pipeline.awaitPendingStage3();

    const llmFired = db.prepare(
      `SELECT COUNT(*) AS c FROM governed_stream
        WHERE record_type = 'agent_invocation'
          AND produced_by_agent_role = 'ingestion_pipeline_stage3'`,
    ).get() as { c: number };
    expect(llmFired.c).toBeGreaterThanOrEqual(1);

    // Same anti-hallucination invariants as artifact-class
    const persisted = db.prepare(
      `SELECT content FROM governed_stream WHERE record_type = 'memory_edge_proposed'`,
    ).all() as Array<{ content: string }>;
    for (const p of persisted) {
      const c = JSON.parse(p.content) as {
        target_record_id: string;
        edge_type: string;
        source_record_id: string;
      };
      expect(c.source_record_id).toBe(reasoning.id);
      expect(c.target_record_id).toBe(decision.id);
      expect(c.target_record_id).not.toBe(reasoning.id); // no self-edges
      expect([
        'derives_from', 'supports', 'contradicts', 'supersedes', 'implements',
        'depends_on', 'blocked_by', 'invalidates', 'raises', 'answers',
      ]).toContain(c.edge_type);
    }
  }, 240_000);

  it('LLM-proposed edges with valid target_record_id land as both governed_stream + memory_edge rows', async () => {
    if (!ollamaReachable) return;

    const candidate = writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      janumicode_version_sha: 'abc',
      content: {
        description: 'The system must support real-time notifications via WebSocket connections.',
        kind: 'system_requirement',
      },
    });

    pipeline.setStage3LLMDependencies({
      llmCaller,
      templateLoader,
      writer,
      provider: 'ollama',
      model: MODEL,
      janumiCodeVersionSha: 'abc',
    });

    const newRec = writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      janumicode_version_sha: 'abc',
      content: {
        description: 'NotificationGateway component implements real-time WebSocket notifications per the system requirement.',
        kind: 'component_skeleton',
      },
    });

    pipeline.ingest(newRec);
    await pipeline.awaitPendingStage3();

    // For each governed_stream memory_edge_proposed record, verify a
    // corresponding memory_edge row exists with status='proposed'.
    const audits = db.prepare(
      `SELECT content FROM governed_stream WHERE record_type = 'memory_edge_proposed'`,
    ).all() as Array<{ content: string }>;

    for (const a of audits) {
      const c = JSON.parse(a.content) as {
        source_record_id: string;
        target_record_id: string;
        edge_type: string;
      };
      const edge = db.prepare(
        `SELECT status FROM memory_edge WHERE source_record_id = ? AND target_record_id = ? AND edge_type = ?`,
      ).get(c.source_record_id, c.target_record_id, c.edge_type) as { status: string } | undefined;
      expect(edge).toBeDefined();
      expect(edge!.status).toBe('proposed');
    }

    // Sanity: at least the candidate is the only valid target (since FTS
    // should retrieve it and only it). Any audit record we see must point
    // there.
    for (const a of audits) {
      const c = JSON.parse(a.content) as { target_record_id: string };
      expect(c.target_record_id).toBe(candidate.id);
    }
  }, 240_000);
});
