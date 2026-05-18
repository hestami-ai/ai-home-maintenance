/**
 * Tests for MitigationEngine + specBoundaryDrop handler.
 *
 * Verifies the deterministic mitigation loop:
 *   - HIGH spec_boundary_respect_bloom findings with target_field +
 *     target_identifier drop the offending bloom item
 *   - MEDIUM/LOW findings are skipped (v1 acts on HIGH only)
 *   - Findings without target_field/target_identifier are skipped
 *   - Other validators are skipped (no registered handler in v1)
 *   - Each applied mutation writes an `auto_mitigation_action` record
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../../lib/database/init';
import { GovernedStreamWriter } from '../../../../lib/orchestrator/governedStreamWriter';
import { MitigationEngine } from '../../../../lib/review/mitigation/mitigationEngine';
import type { ValidatorFinding } from '../../../../lib/review/harness/validatorRegistry';

let idCounter = 0;
function testId(): string { return `mit-${++idCounter}`; }

function makeFinding(overrides: Partial<ValidatorFinding> = {}): ValidatorFinding {
  return {
    validatorId: 'spec_boundary_respect_bloom',
    severity: 'HIGH',
    type: 'excluded_concept_proposed',
    summary: 'Bloom proposed an excluded concept',
    location: 'domains[2]: Authentication',
    detail: 'DEC-1 says No user accounts; this domain implies user identity',
    recommendation: 'remove the item',
    targetField: 'domains',
    targetIdentifier: 'D-AUTH',
    ...overrides,
  };
}

describe('MitigationEngine', () => {
  let db: Database;
  let writer: GovernedStreamWriter;

  beforeEach(() => {
    idCounter = 0;
    db = createTestDatabase();
    writer = new GovernedStreamWriter(db, testId);
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc', '2026-01-01T00:00:00Z', 'initiated')
    `).run();
  });

  afterEach(() => { db.close(); });

  function defaultContext(extra: Partial<Parameters<MitigationEngine['apply']>[2]> = {}) {
    return {
      writer,
      workflowRunId: 'run-1',
      phaseId: '1',
      subPhaseId: 'business_domains_bloom',
      janumiCodeVersionSha: 'abc',
      sourceArtifactRecordId: 'fake-source-id',
      findingRecordIds: new Map<ValidatorFinding, string>(),
      ...extra,
    };
  }

  describe('specBoundaryDropHandler — HIGH findings', () => {
    it('drops the offending domain by id and writes an auto_mitigation_action record', () => {
      const bloom = {
        domains: [
          { id: 'D-LINK', name: 'Link Sharing', description: 'core' },
          { id: 'D-CLICK', name: 'Link Clicking', description: 'core' },
          { id: 'D-AUTH', name: 'Authentication', description: 'OAuth flow' }, // to drop
        ],
        personas: [
          { id: 'P-1', name: 'Link Sharer' },
        ],
      };

      const finding = makeFinding({ targetField: 'domains', targetIdentifier: 'D-AUTH' });
      const engine = new MitigationEngine();
      const result = engine.apply([finding], bloom as unknown as Record<string, unknown>, defaultContext());

      expect(result.actionsApplied).toHaveLength(1);
      expect(result.findingsSkipped).toBe(0);
      expect(bloom.domains).toHaveLength(2);
      expect(bloom.domains.map(d => d.id)).toEqual(['D-LINK', 'D-CLICK']);

      // Audit record landed
      const rows = db.prepare(`SELECT content FROM governed_stream WHERE record_type='auto_mitigation_action'`).all() as Array<{ content: string }>;
      expect(rows).toHaveLength(1);
      const c = JSON.parse(rows[0].content) as Record<string, unknown>;
      expect(c.action_type).toBe('drop');
      expect(c.target_field).toBe('domains');
      expect(c.target_identifier).toBe('D-AUTH');
      expect(c.validator_id).toBe('spec_boundary_respect_bloom');
      expect((c.before_value as { id: string }).id).toBe('D-AUTH');
      expect(c.after_value).toBeNull();
    });

    it('drops by `name` when id field absent', () => {
      const bloom = {
        entities: [
          { name: 'Link' },
          { name: 'RateLimitDashboard' }, // to drop — no id field
        ],
      };
      const finding = makeFinding({ targetField: 'entities', targetIdentifier: 'RateLimitDashboard' });
      const engine = new MitigationEngine();
      engine.apply([finding], bloom as unknown as Record<string, unknown>, defaultContext());

      expect(bloom.entities).toHaveLength(1);
      expect(bloom.entities[0].name).toBe('Link');
    });

    it('handles multiple HIGH findings in one bloom (drops both)', () => {
      const bloom = {
        domains: [
          { id: 'D-LINK', name: 'Link Sharing' },
          { id: 'D-AUTH', name: 'Authentication' }, // drop
          { id: 'D-ANALYTICS', name: 'Analytics' }, // drop
          { id: 'D-CLICK', name: 'Link Clicking' },
        ],
      };

      const finding1 = makeFinding({ targetField: 'domains', targetIdentifier: 'D-AUTH' });
      const finding2 = makeFinding({ targetField: 'domains', targetIdentifier: 'D-ANALYTICS' });
      const engine = new MitigationEngine();
      const result = engine.apply([finding1, finding2], bloom as unknown as Record<string, unknown>, defaultContext());

      expect(result.actionsApplied).toHaveLength(2);
      expect(bloom.domains.map(d => d.id)).toEqual(['D-LINK', 'D-CLICK']);

      const rows = db.prepare(`SELECT COUNT(*) AS c FROM governed_stream WHERE record_type='auto_mitigation_action'`).get() as { c: number };
      expect(rows.c).toBe(2);
    });

    it('returns null skip (no mutation) when target_identifier not found', () => {
      const bloom = { domains: [{ id: 'D-LINK', name: 'Link Sharing' }] };
      const finding = makeFinding({ targetField: 'domains', targetIdentifier: 'D-NONEXISTENT' });
      const engine = new MitigationEngine();
      const result = engine.apply([finding], bloom as unknown as Record<string, unknown>, defaultContext());

      expect(result.actionsApplied).toHaveLength(0);
      expect(result.findingsSkipped).toBe(1);
      expect(bloom.domains).toHaveLength(1);

      const audits = db.prepare(`SELECT COUNT(*) AS c FROM governed_stream WHERE record_type='auto_mitigation_action'`).get() as { c: number };
      expect(audits.c).toBe(0);
    });

    it('returns null skip when target_field is not an array', () => {
      const bloom = { domains: 'not an array' };
      const finding = makeFinding({ targetField: 'domains', targetIdentifier: 'D-AUTH' });
      const engine = new MitigationEngine();
      const result = engine.apply([finding], bloom as unknown as Record<string, unknown>, defaultContext());

      expect(result.actionsApplied).toHaveLength(0);
      expect(result.findingsSkipped).toBe(1);
    });
  });

  describe('severity gating — v1 acts on HIGH only', () => {
    it.each(['MEDIUM', 'LOW'] as const)('skips %s severity findings', (severity) => {
      const bloom = { domains: [{ id: 'D-AUTH', name: 'Authentication' }] };
      const finding = makeFinding({ severity, targetField: 'domains', targetIdentifier: 'D-AUTH' });
      const engine = new MitigationEngine();
      const result = engine.apply([finding], bloom as unknown as Record<string, unknown>, defaultContext());

      expect(result.actionsApplied).toHaveLength(0);
      expect(result.findingsSkipped).toBe(1);
      expect(bloom.domains).toHaveLength(1); // not dropped
    });
  });

  describe('target field gating', () => {
    it('skips when targetField is missing', () => {
      const bloom = { domains: [{ id: 'D-AUTH' }] };
      const finding = makeFinding({ targetField: undefined, targetIdentifier: 'D-AUTH' });
      const engine = new MitigationEngine();
      const result = engine.apply([finding], bloom as unknown as Record<string, unknown>, defaultContext());

      expect(result.actionsApplied).toHaveLength(0);
      expect(result.findingsSkipped).toBe(1);
    });

    it('skips when targetIdentifier is missing', () => {
      const bloom = { domains: [{ id: 'D-AUTH' }] };
      const finding = makeFinding({ targetIdentifier: undefined });
      const engine = new MitigationEngine();
      const result = engine.apply([finding], bloom as unknown as Record<string, unknown>, defaultContext());

      expect(result.actionsApplied).toHaveLength(0);
      expect(result.findingsSkipped).toBe(1);
    });
  });

  describe('handler registry — only registered validators act', () => {
    it('skips findings from validators with no registered handler', () => {
      const bloom = { domains: [{ id: 'D-AUTH', name: 'Authentication' }] };
      const finding = makeFinding({
        validatorId: 'some_other_validator',
        targetField: 'domains',
        targetIdentifier: 'D-AUTH',
      });
      const engine = new MitigationEngine();
      const result = engine.apply([finding], bloom as unknown as Record<string, unknown>, defaultContext());

      expect(result.actionsApplied).toHaveLength(0);
      expect(result.findingsSkipped).toBe(1);
      expect(bloom.domains).toHaveLength(1);
    });

    it('honors a custom handler registry passed to the engine', () => {
      const customHandler = () => ({
        actionType: 'drop' as const,
        validatorId: 'custom_validator',
        findingType: 'custom_type',
        targetField: 'items',
        targetIdentifier: 'X',
        rationale: 'custom rationale',
        beforeValue: { id: 'X' },
        afterValue: null,
      });
      const engine = new MitigationEngine({
        handlers: new Map([['custom_validator', customHandler]]),
      });
      const bloom = { items: [{ id: 'X' }] };
      const finding = makeFinding({
        validatorId: 'custom_validator',
        type: 'custom_type',
        targetField: 'items',
        targetIdentifier: 'X',
      });
      const result = engine.apply([finding], bloom as unknown as Record<string, unknown>, defaultContext());

      expect(result.actionsApplied).toHaveLength(1);
    });
  });

  describe('audit trail', () => {
    it('cites the finding record id when available', () => {
      const bloom = { domains: [{ id: 'D-AUTH', name: 'Authentication' }] };
      const finding = makeFinding({ targetField: 'domains', targetIdentifier: 'D-AUTH' });
      const findingRecordIds = new Map<ValidatorFinding, string>([[finding, 'finding-record-99']]);

      const engine = new MitigationEngine();
      engine.apply([finding], bloom as unknown as Record<string, unknown>, defaultContext({ findingRecordIds }));

      const row = db.prepare(`SELECT content FROM governed_stream WHERE record_type='auto_mitigation_action'`).get() as { content: string };
      const c = JSON.parse(row.content) as Record<string, unknown>;
      expect(c.finding_record_id).toBe('finding-record-99');
    });

    it('writes audit records at authority_level=5', () => {
      const bloom = { domains: [{ id: 'D-AUTH', name: 'Authentication' }] };
      const finding = makeFinding({ targetField: 'domains', targetIdentifier: 'D-AUTH' });
      const engine = new MitigationEngine();
      engine.apply([finding], bloom as unknown as Record<string, unknown>, defaultContext());

      const row = db.prepare(`SELECT authority_level FROM governed_stream WHERE record_type='auto_mitigation_action'`).get() as { authority_level: number };
      expect(row.authority_level).toBe(5);
    });
  });
});
