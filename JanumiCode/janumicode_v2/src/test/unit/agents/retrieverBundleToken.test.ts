/**
 * Regression test for the Retriever's @bundle:<id> token parsing.
 *
 * The DecisionBundleCard's "Ask more" button prefills the composer with
 * `@bundle:<recordId>:<section>:<itemId>` so the Liaison can fetch the
 * bundle record as retrieval context and answer the follow-up with the
 * specific Mirror row / Menu option in mind.
 *
 * If this parsing regresses, ask-more devolves into a generic chat with
 * no anchor to the surface — exactly the UX failure the per-option
 * button is meant to avoid.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import { EmbeddingService } from '../../../lib/embedding/embeddingService';
import { ClientLiaisonDBImpl } from '../../../lib/agents/clientLiaison/db';
import { Retriever, extractBundleRecordIds } from '../../../lib/agents/clientLiaison/retriever';
import type { OpenQuery } from '../../../lib/agents/clientLiaison/types';
import type { DecisionBundleContent } from '../../../lib/types/decisionBundle';

let idCounter = 0;
function testId(): string { return `rt-${++idCounter}`; }

describe('Retriever — @bundle token resolution', () => {
  let db: Database;
  let writer: GovernedStreamWriter;
  let cdb: ClientLiaisonDBImpl;
  let embedding: EmbeddingService;
  let retriever: Retriever;

  beforeEach(() => {
    idCounter = 0;
    db = createTestDatabase();
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc', '2026-01-01T00:00:00Z', 'in_progress')
    `).run();
    writer = new GovernedStreamWriter(db, testId);
    embedding = new EmbeddingService(db, { provider: 'ollama', model: 'x', maxParallel: 1 });
    cdb = new ClientLiaisonDBImpl(db, embedding);
    retriever = new Retriever(cdb); // no engine → forces legacy path
  });

  afterEach(() => { db.close(); });

  function presentBundle(): { id: string; surfaceId: string } {
    const content: DecisionBundleContent = {
      surface_id: 'surface-phase-1',
      title: 'Confirm assumptions',
      mirror: {
        kind: 'assumption_mirror',
        items: [{ id: 'a1', text: 'Local SQLite storage' }],
      },
      menu: {
        question: 'Pick backend',
        multi_select: false,
        allow_free_text: false,
        options: [{ id: 'sqlite', label: 'SQLite' }],
      },
    };
    const rec = writer.writeRecord({
      record_type: 'decision_bundle_presented',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      phase_id: '1',
      janumicode_version_sha: 'abc',
      content: content as unknown as Record<string, unknown>,
    });
    return { id: rec.id, surfaceId: content.surface_id };
  }

  function q(text: string): OpenQuery {
    return {
      id: 'q-1',
      text,
      workflowRunId: 'run-1',
      currentPhaseId: '1',
      references: [],
    };
  }

  it('pulls the bundle record into retrieval when the query mentions @bundle:<id>', async () => {
    const { id: bundleId } = presentBundle();
    const result = await retriever.retrieve(
      'ambient_clarification',
      q(`@bundle:${bundleId}:mirror:a1\n\nWhy local SQLite? Any reason not to use Postgres?`),
    );
    expect(result.records.some(r => r.id === bundleId)).toBe(true);
  });

  it('still works when the token has only the record id (no section/item suffix)', async () => {
    const { id: bundleId } = presentBundle();
    const result = await retriever.retrieve(
      'rationale_request',
      q(`What does @bundle:${bundleId} represent?`),
    );
    expect(result.records.some(r => r.id === bundleId)).toBe(true);
  });

  describe('extractBundleRecordIds (regex helper)', () => {
    // Direct unit tests on the parser so we can assert exclusion
    // behavior without the retriever's pending-decision merge masking
    // the result.
    it('does not match @bundler (word-suffix, no colon)', () => {
      expect(extractBundleRecordIds('@bundler abc is not a mention')).toEqual([]);
    });
    it('does not match a bare @bundle without an id', () => {
      expect(extractBundleRecordIds('just @bundle alone')).toEqual([]);
    });
    it('extracts a single id from the tail-less form', () => {
      expect(extractBundleRecordIds('@bundle:abc-123')).toEqual(['abc-123']);
    });
    it('extracts and dedupes when the same id appears twice', () => {
      expect(extractBundleRecordIds('@bundle:abc @bundle:abc:mirror:a1')).toEqual(['abc']);
    });
    it('handles adjacent punctuation without eating the id', () => {
      expect(extractBundleRecordIds('see @bundle:abc, please')).toEqual(['abc']);
    });
  });

  it('dedupes bundle records referenced both via token and via a Reference', async () => {
    const { id: bundleId } = presentBundle();
    const result = await retriever.retrieve(
      'ambient_clarification',
      q(`@bundle:${bundleId}:mirror:a1`),
      // Simulate a @mention reference type that happens to share the id.
      [{ type: 'decision', id: bundleId, display: 'bundle surface-1' }],
    );
    const matches = result.records.filter(r => r.id === bundleId);
    expect(matches).toHaveLength(1);
  });

  it('extracts multiple distinct bundle ids from one query', async () => {
    const a = presentBundle();
    const b = presentBundle();
    const result = await retriever.retrieve(
      'ambient_clarification',
      q(`Contrast @bundle:${a.id}:mirror:a1 with @bundle:${b.id}:menu:sqlite`),
    );
    expect(result.records.some(r => r.id === a.id)).toBe(true);
    expect(result.records.some(r => r.id === b.id)).toBe(true);
  });
});
