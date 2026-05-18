/**
 * Tests for findingsLookup — the bridge between the persisted harness
 * records and the MitigationEngine input.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../../lib/database/init';
import { GovernedStreamWriter } from '../../../../lib/orchestrator/governedStreamWriter';
import { loadMostRecentFindings } from '../../../../lib/review/mitigation/findingsLookup';

let idCounter = 0;
function testId(): string { return `lookup-${++idCounter}`; }

describe('loadMostRecentFindings', () => {
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

  it('returns empty when no harness records exist for the sub-phase', () => {
    const result = loadMostRecentFindings(db, 'run-1', 'business_domains_bloom');
    expect(result.findings).toEqual([]);
    expect(result.findingRecordIds.size).toBe(0);
    expect(result.harnessRecordId).toBeNull();
  });

  it('returns findings of the most recent harness record for the sub-phase', () => {
    // Two harness records on the same sub-phase, second is "most recent"
    const harness1 = writer.writeRecord({
      record_type: 'reasoning_review_harness_record',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      sub_phase_id: 'business_domains_bloom',
      janumicode_version_sha: 'abc',
      content: { kind: 'reasoning_review_harness', harness_id: 'h-1' },
    });
    const harness2 = writer.writeRecord({
      record_type: 'reasoning_review_harness_record',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      sub_phase_id: 'business_domains_bloom',
      janumicode_version_sha: 'abc',
      content: { kind: 'reasoning_review_harness', harness_id: 'h-2' },
    });

    // Finding for the OLDER harness — should NOT be returned
    writer.writeRecord({
      record_type: 'reasoning_review_finding_record',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      sub_phase_id: 'business_domains_bloom',
      janumicode_version_sha: 'abc',
      content: {
        kind: 'reasoning_review_finding',
        harness_id: harness1.id,
        validator_id: 'spec_boundary_respect_bloom',
        severity: 'HIGH',
        finding_type: 'excluded_concept_proposed',
        summary: 'OLD finding',
        location: 'domains[0]',
        detail: '',
        recommendation: '',
      },
    });

    // Findings for the NEWER harness — should be returned
    writer.writeRecord({
      record_type: 'reasoning_review_finding_record',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      sub_phase_id: 'business_domains_bloom',
      janumicode_version_sha: 'abc',
      content: {
        kind: 'reasoning_review_finding',
        harness_id: harness2.id,
        validator_id: 'spec_boundary_respect_bloom',
        severity: 'HIGH',
        finding_type: 'excluded_concept_proposed',
        summary: 'NEW finding',
        location: 'domains[2]',
        detail: '',
        recommendation: '',
        target_field: 'domains',
        target_identifier: 'D-AUTH',
      },
    });

    const result = loadMostRecentFindings(db, 'run-1', 'business_domains_bloom');
    expect(result.harnessRecordId).toBe(harness2.id);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].summary).toBe('NEW finding');
    expect(result.findings[0].targetField).toBe('domains');
    expect(result.findings[0].targetIdentifier).toBe('D-AUTH');
    expect(result.findingRecordIds.get(result.findings[0])).toBeDefined();
  });

  it('returns empty findings when harness has no findings (passed validator)', () => {
    const harness = writer.writeRecord({
      record_type: 'reasoning_review_harness_record',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      sub_phase_id: 'business_domains_bloom',
      janumicode_version_sha: 'abc',
      content: { kind: 'reasoning_review_harness', harness_id: 'h-clean' },
    });

    const result = loadMostRecentFindings(db, 'run-1', 'business_domains_bloom');
    expect(result.harnessRecordId).toBe(harness.id);
    expect(result.findings).toEqual([]);
  });

  it('ignores harness records from other sub-phases', () => {
    const harnessOther = writer.writeRecord({
      record_type: 'reasoning_review_harness_record',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      sub_phase_id: 'user_journey_bloom',
      janumicode_version_sha: 'abc',
      content: { kind: 'reasoning_review_harness', harness_id: 'h-other' },
    });
    writer.writeRecord({
      record_type: 'reasoning_review_finding_record',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      sub_phase_id: 'user_journey_bloom',
      janumicode_version_sha: 'abc',
      content: {
        kind: 'reasoning_review_finding',
        harness_id: harnessOther.id,
        validator_id: 'spec_boundary_respect_bloom',
        severity: 'HIGH',
        finding_type: 'excluded_concept_proposed',
        summary: 'Other sub-phase finding',
        location: '',
        detail: '',
        recommendation: '',
      },
    });

    const result = loadMostRecentFindings(db, 'run-1', 'business_domains_bloom');
    expect(result.harnessRecordId).toBeNull();
    expect(result.findings).toEqual([]);
  });
});
