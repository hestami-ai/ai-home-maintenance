/**
 * Tests for embeddingService.extractEmbeddingText — the recursive content
 * walker that produces the text payload sent to the embedding backend.
 *
 * Covers the A.1 fix: previously this function only matched 6 specific
 * camelCase top-level keys, so most JanumiCode record types (snake_case +
 * nested) returned null and were never embedded. Now it walks recursively
 * and emits content for every record type except pure plumbing.
 */

import { describe, it, expect } from 'vitest';
import { extractEmbeddingText } from '../../../lib/embedding/embeddingService';
import type { GovernedStreamRecord, RecordType } from '../../../lib/types/records';

function makeRecord(record_type: RecordType, content: Record<string, unknown>): GovernedStreamRecord {
  return {
    id: 'r-1',
    record_type,
    schema_version: '1.0',
    workflow_run_id: 'run-1',
    phase_id: '1',
    sub_phase_id: null,
    produced_by_agent_role: null,
    produced_by_record_id: null,
    produced_at: '2026-05-11T00:00:00.000Z',
    effective_at: null,
    janumicode_version_sha: 'test',
    authority_level: 2,
    derived_from_system_proposal: false,
    is_current_version: true,
    superseded_by_id: null,
    superseded_at: null,
    superseded_by_record_id: null,
    source_workflow_run_id: 'run-1',
    derived_from_record_ids: [],
    quarantined: false,
    sanitized: false,
    sanitized_fields: [],
    content,
  };
}

describe('extractEmbeddingText', () => {
  it('returns null for pure-plumbing record types', () => {
    const skipped: RecordType[] = [
      'json_repair_record',
      'file_system_write_record',
      'mirror_presented',
      'decision_bundle_presented',
      'execution_wave_started',
      'execution_wave_completed',
      'workflow_run_closure',
    ];
    for (const t of skipped) {
      const rec = makeRecord(t, { summary: 'this should be ignored' });
      expect(extractEmbeddingText(rec)).toBeNull();
    }
  });

  it('returns text for reasoning-trail records (NOT skipped)', () => {
    // Reasoning trail is harvested + embedded — drift-detection requires it.
    const rec = makeRecord('agent_reasoning_step', {
      kind: 'agent_reasoning_step',
      thinking: 'I considered approach X but rejected it because Y',
    });
    const text = extractEmbeddingText(rec);
    expect(text).not.toBeNull();
    expect(text).toContain('rejected');
  });

  it('walks nested content recursively', () => {
    const rec = makeRecord('artifact_produced', {
      kind: 'business_domains_bloom',
      domains: [
        { name: 'Authentication', description: 'User identity and access' },
        { name: 'Billing', description: 'Subscription management' },
      ],
    });
    const text = extractEmbeddingText(rec);
    expect(text).toContain('Authentication');
    expect(text).toContain('User identity');
    expect(text).toContain('Billing');
    expect(text).toContain('Subscription management');
  });

  it('strips noisy metadata keys (timestamps, IDs, model config)', () => {
    const rec = makeRecord('artifact_produced', {
      kind: 'something',
      description: 'meaningful content',
      // Noisy keys whose string values should NOT appear in extracted text:
      id: 'noise-id-1234',
      workflow_run_id: 'run-9999',
      janumicode_version_sha: 'abc123',
      provider: 'ollama',
      model: 'qwen3:9b',
      started_at: '2026-05-11T00:00:00Z',
      duration_ms: 1234,
    });
    const text = extractEmbeddingText(rec) ?? '';
    expect(text).toContain('meaningful content');
    expect(text).not.toContain('noise-id-1234');
    expect(text).not.toContain('run-9999');
    expect(text).not.toContain('abc123');
    expect(text).not.toContain('ollama');
    expect(text).not.toContain('qwen3:9b');
  });

  it('returns null when no extractable strings remain after noise stripping', () => {
    const rec = makeRecord('artifact_produced', {
      id: 'just-noise',
      workflow_run_id: 'r1',
      duration_ms: 100,
    });
    expect(extractEmbeddingText(rec)).toBeNull();
  });

  it('truncates output at MAX_TEXT_CHARS (8000)', () => {
    const longText = 'x'.repeat(20000);
    const rec = makeRecord('artifact_produced', { description: longText });
    const text = extractEmbeddingText(rec) ?? '';
    expect(text.length).toBeLessThanOrEqual(8000);
  });

  it('handles array-valued content', () => {
    const rec = makeRecord('artifact_produced', {
      values: ['first item', 'second item', 'third item'],
    });
    const text = extractEmbeddingText(rec) ?? '';
    expect(text).toContain('first item');
    expect(text).toContain('second item');
    expect(text).toContain('third item');
  });

  it('extracts from decomposition node user_story structure', () => {
    const rec = makeRecord('requirement_decomposition_node', {
      kind: 'requirement_decomposition_node',
      node_id: 'US-001',  // noisy id, should NOT appear
      user_story: {
        role: 'authenticated user',
        action: 'reset my password',
        outcome: 'regain access without contacting support',
      },
    });
    const text = extractEmbeddingText(rec) ?? '';
    expect(text).toContain('authenticated user');
    expect(text).toContain('reset my password');
    expect(text).toContain('regain access');
    expect(text).not.toContain('US-001');
  });

  it('drops strings shorter than 2 chars', () => {
    const rec = makeRecord('artifact_produced', {
      x: 'a',
      y: 'meaningful',
    });
    const text = extractEmbeddingText(rec) ?? '';
    expect(text).not.toContain('a\n');
    expect(text).toContain('meaningful');
  });
});
