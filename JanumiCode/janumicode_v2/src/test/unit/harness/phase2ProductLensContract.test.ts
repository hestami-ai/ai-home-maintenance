/**
 * Phase 2 product-lens contract + traceability invariants.
 *
 * Pins:
 *   - getPhaseContract('2', 'product') → PHASE2_CONTRACT_PRODUCT.
 *   - validateRequirementsProductTraceability catches FR/NFR with empty
 *     or unknown traces_to.
 *   - validateJourneyCoverageByFRs flags journeys that no FR traces to.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import {
  getPhaseContract,
  PHASE2_CONTRACT,
  PHASE2_CONTRACT_PRODUCT,
} from '../../../test/harness/phaseContracts';
import { validateLineage } from '../../../test/harness/lineageValidator';

describe('Wave 5 — Phase 2 product-lens contract + invariants', () => {
  it('routes Phase 2 product-classified runs to PHASE2_CONTRACT_PRODUCT', () => {
    expect(getPhaseContract('2', 'product')).toBe(PHASE2_CONTRACT_PRODUCT);
  });

  it('falls back to PHASE2_CONTRACT for non-product lenses', () => {
    for (const lens of ['feature', 'bug', 'infra', 'legal', 'unclassified'] as const) {
      expect(getPhaseContract('2', lens), `lens=${lens}`).toBe(PHASE2_CONTRACT);
    }
    expect(getPhaseContract('2')).toBe(PHASE2_CONTRACT);
  });
});

describe('Wave 5 — traceability + journey coverage invariants', () => {
  let db: Database;
  let writer: GovernedStreamWriter;
  const runId = 'run-phase2-traceability';

  beforeEach(() => {
    db = createTestDatabase();
    let counter = 0;
    writer = new GovernedStreamWriter(db, () => `rec-${++counter}`);
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status, current_phase_id, intent_lens)
      VALUES (?, 'ws', 'sha', ?, 'in_progress', '2', 'product')
    `).run(runId, now);
  });

  afterEach(() => { db.close(); });

  /** Minimal handoff with one journey + one V&V target for traceability lookup. */
  function seedHandoff(): void {
    writer.writeRecord({
      record_type: 'product_description_handoff',
      schema_version: '1.1',
      workflow_run_id: runId,
      phase_id: '1',
      sub_phase_id: '1.6',
      produced_by_agent_role: 'domain_interpreter',
      janumicode_version_sha: 'sha',
      content: {
        kind: 'product_description_handoff',
        userJourneys: [{ id: 'UJ-1', title: 't' }, { id: 'UJ-2', title: 't2' }],
        entityProposals: [{ id: 'ENT-USER' }],
        vvRequirements: [{ id: 'VV-1' }],
        technicalConstraints: [{ id: 'TECH-1' }],
      },
    });
  }

  function seedFR(userStories: Array<{ id: string; traces_to?: string[] }>): void {
    writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: '2',
      sub_phase_id: '2.1',
      produced_by_agent_role: 'requirements_agent',
      janumicode_version_sha: 'sha',
      content: { kind: 'functional_requirements', user_stories: userStories.map(s => ({
        id: s.id, role: 'u', action: 'a', outcome: 'o',
        acceptance_criteria: [{ id: 'AC-1', description: 'd', measurable_condition: 'c' }],
        priority: 'high' as const, traces_to: s.traces_to,
      })) },
    });
  }

  function seedNFR(reqs: Array<{ id: string; traces_to?: string[]; applies_to_requirements?: string[] }>): void {
    writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: '2',
      sub_phase_id: '2.2',
      produced_by_agent_role: 'requirements_agent',
      janumicode_version_sha: 'sha',
      content: { kind: 'non_functional_requirements', requirements: reqs.map(r => ({
        id: r.id, category: 'security' as const, description: 'd', threshold: 't',
        measurement_method: 'm', traces_to: r.traces_to,
        applies_to_requirements: r.applies_to_requirements,
      })) },
    });
  }

  // 2.3/2.4/2.5 records needed to satisfy required_artifacts; we don't
  // care about their content for the traceability tests.
  function seedTailRecords(): void {
    writer.writeRecord({
      record_type: 'mirror_presented', schema_version: '1.0', workflow_run_id: runId,
      phase_id: '2', sub_phase_id: '2.3', produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: 'sha', content: { kind: 'requirements_mirror' },
    });
    writer.writeRecord({
      record_type: 'artifact_produced', schema_version: '1.0', workflow_run_id: runId,
      phase_id: '2', sub_phase_id: '2.4', produced_by_agent_role: 'consistency_checker',
      janumicode_version_sha: 'sha', content: { kind: 'consistency_report', overall_pass: true },
    });
    writer.writeRecord({
      record_type: 'mirror_presented', schema_version: '1.0', workflow_run_id: runId,
      phase_id: '2', sub_phase_id: '2.5', produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: 'sha', content: { kind: 'attestation' },
    });
    writer.writeRecord({
      record_type: 'phase_gate_evaluation', schema_version: '1.0', workflow_run_id: runId,
      phase_id: '2', sub_phase_id: '2.5', produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: 'sha', content: { kind: 'phase_gate', phase_id: '2' },
    });
  }

  it('passes when every FR/NFR has valid traces_to resolving into the handoff', () => {
    seedHandoff();
    seedFR([
      { id: 'US-1', traces_to: ['UJ-1', 'ENT-USER'] },
      { id: 'US-2', traces_to: ['UJ-2'] },
    ]);
    seedNFR([{ id: 'NFR-1', traces_to: ['VV-1', 'TECH-1'] }]);
    seedTailRecords();
    const result = validateLineage(db, runId, ['2']);
    expect(result.valid, `gaps: ${JSON.stringify(result.gaps, null, 2)}`).toBe(true);
  });

  it('fails an FR with empty traces_to', () => {
    seedHandoff();
    seedFR([{ id: 'US-1', traces_to: ['UJ-1'] }, { id: 'US-2', traces_to: [] }]);
    seedNFR([{ id: 'NFR-1', traces_to: ['VV-1'] }]);
    seedTailRecords();
    const result = validateLineage(db, runId, ['2']);
    expect(result.valid).toBe(false);
    const gap = result.gaps.find(g => g.expected.field === 'functional_requirements.user_stories[id=US-2].traces_to');
    expect(gap, 'expected a gap for US-2 empty traces_to').toBeDefined();
  });

  it('fails an NFR whose traces_to points at a non-existent handoff item', () => {
    seedHandoff();
    seedFR([{ id: 'US-1', traces_to: ['UJ-1'] }, { id: 'US-2', traces_to: ['UJ-2'] }]);
    seedNFR([{ id: 'NFR-1', traces_to: ['UJ-99'] }]); // UJ-99 does not exist
    seedTailRecords();
    const result = validateLineage(db, runId, ['2']);
    expect(result.valid).toBe(false);
    const gap = result.gaps.find(g => g.summary.includes('non_functional_requirements.requirements[id=NFR-1]'));
    expect(gap).toBeDefined();
    expect(gap!.observed.value).toContain('UJ-99');
  });

  it('passes when applies_to_requirements references real FR ids', () => {
    seedHandoff();
    seedFR([{ id: 'US-1', traces_to: ['UJ-1'] }, { id: 'US-2', traces_to: ['UJ-2'] }]);
    seedNFR([{ id: 'NFR-1', traces_to: ['VV-1'], applies_to_requirements: ['US-1', 'US-2'] }]);
    seedTailRecords();
    const result = validateLineage(db, runId, ['2']);
    expect(result.valid, `gaps: ${JSON.stringify(result.gaps, null, 2)}`).toBe(true);
  });

  it('fails an NFR whose applies_to_requirements references a non-existent FR id (qwen trace-id confusion)', () => {
    seedHandoff();
    seedFR([{ id: 'US-1', traces_to: ['UJ-1'] }, { id: 'US-2', traces_to: ['UJ-2'] }]);
    // NFR-1 references US-99 which does not exist among FRs.
    seedNFR([{ id: 'NFR-1', traces_to: ['VV-1'], applies_to_requirements: ['US-99'] }]);
    seedTailRecords();
    const result = validateLineage(db, runId, ['2']);
    expect(result.valid).toBe(false);
    const gap = result.gaps.find(g => g.expected.field === 'non_functional_requirements.requirements[id=NFR-1].applies_to_requirements');
    expect(gap, 'expected applies_to_requirements gap for NFR-1').toBeDefined();
    expect(gap!.observed.value).toContain('US-99');
  });

  it('warns when a journey has no FR tracing to it', () => {
    seedHandoff();
    // UJ-2 is not covered.
    seedFR([{ id: 'US-1', traces_to: ['UJ-1'] }]);
    seedNFR([{ id: 'NFR-1', traces_to: ['VV-1'] }]);
    seedTailRecords();
    const result = validateLineage(db, runId, ['2']);
    const gap = result.gaps.find(g => g.expected.field === 'userJourneys[id=UJ-2].coverage');
    expect(gap, 'expected coverage gap for UJ-2').toBeDefined();
  });
});
