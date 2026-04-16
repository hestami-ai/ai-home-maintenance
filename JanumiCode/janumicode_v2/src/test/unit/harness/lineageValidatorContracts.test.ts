/**
 * Regression tests for the realigned phase contracts + lineage validator.
 *
 * Before this rewrite, the harness oracle was aligned to a generic
 * Requirements/Architecture/Commit workflow and matched by bare
 * record_type strings like `requirements_extracted`. JanumiCode v2.3
 * actually carries almost every artifact on `artifact_produced` with
 * `content.kind` as the discriminator — so the old oracle always
 * reported phantom gaps against names no handler ever wrote.
 *
 * These tests pin:
 *   1. `required_artifacts` matching honors the record_type +
 *      content.kind + sub_phase_id tuple.
 *   2. `validateLineage` surfaces missing artifacts as MissingRecord
 *      gaps with the right phase + sub_phase_id.
 *   3. Optional artifacts (brownfield-only, conditional) do NOT fail.
 *   4. Per-phase invariants run and produce AssertionFailures.
 *   5. Phase 1's composite bundle is recognized as its own surface
 *      (no regression back to expecting mirror_presented+menu_presented).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import { validateLineage, buildGapReport } from '../../../lib/../test/harness/lineageValidator';
import {
  PHASE0_CONTRACT,
  PHASE1_CONTRACT,
  PHASE4_CONTRACT,
  getRequiredArtifacts,
} from '../../harness/phaseContracts';
import type { PhaseId } from '../../../lib/types/records';

let idCounter = 0;
const nextId = () => `lv-${++idCounter}`;

describe('Phase contracts — shape', () => {
  it('Phase 0 required_artifacts use record_type=artifact_produced + content_kind', () => {
    const byKind = PHASE0_CONTRACT.required_artifacts
      .filter((a) => a.record_type === 'artifact_produced')
      .map((a) => a.content_kind);
    expect(byKind).toContain('workspace_classification');
    expect(byKind).toContain('collision_risk_report');
    // Brownfield-only entries are marked optional so greenfield runs don't
    // fail for not having them.
    const brownfield = PHASE0_CONTRACT.required_artifacts.filter((a) => a.optional);
    expect(brownfield.length).toBeGreaterThan(0);
  });

  it('Phase 1 includes decision_bundle_presented at sub-phase 1.3, not a mirror+menu pair', () => {
    const types = PHASE1_CONTRACT.required_artifacts.map((a) => a.record_type);
    expect(types).toContain('decision_bundle_presented');
    // menu_presented was removed from the codebase entirely; the oracle
    // must not regress back to expecting it.
    expect(types).not.toContain('menu_presented');
  });

  it('Every phase contract has at least one required artifact', () => {
    const phases: PhaseId[] = ['0', '0.5', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    for (const p of phases) {
      const artifacts = getRequiredArtifacts(p);
      expect(artifacts.length, `phase ${p} must have required artifacts`).toBeGreaterThan(0);
    }
  });
});

describe('validateLineage — missing artifacts', () => {
  let db: Database;
  let writer: GovernedStreamWriter;
  const runId = 'run-lv-1';

  beforeEach(() => {
    idCounter = 0;
    db = createTestDatabase();
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES (?, 'ws-1', 'dev', '2026-01-01T00:00:00Z', 'in_progress')
    `).run(runId);
    writer = new GovernedStreamWriter(db, nextId);
  });

  afterEach(() => { db.close(); });

  function writeArtifact(kind: string, subPhase: string, phaseId: PhaseId, role?: string): void {
    writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: phaseId,
      sub_phase_id: subPhase,
      produced_by_agent_role: (role ?? 'orchestrator') as never,
      janumicode_version_sha: 'dev',
      content: { kind },
    });
  }

  it('reports Phase 0 missing collision_risk_report as a MissingRecord gap', () => {
    // Only write workspace_classification, skip collision_risk_report.
    writeArtifact('workspace_classification', '0.1', '0');
    const result = validateLineage(db, runId, ['0']);
    expect(result.valid).toBe(false);
    const missingKinds = result.missingRecords.map((m) => m.record_type);
    expect(missingKinds).toContain('artifact_produced[kind=collision_risk_report]');
    expect(missingKinds).not.toContain('artifact_produced[kind=workspace_classification]');
  });

  it('does NOT report greenfield-only runs missing brownfield-only artifacts', () => {
    writeArtifact('workspace_classification', '0.1', '0');
    writeArtifact('collision_risk_report', '0.4', '0');
    // external_file_ingested / ingested_artifact_index / prior_decision_summary
    // are all brownfield-only and marked optional in the contract.
    const result = validateLineage(db, runId, ['0']);
    const missingKinds = result.missingRecords.map((m) => m.record_type);
    expect(missingKinds).not.toContain('artifact_produced[kind=external_file_ingested]');
    expect(missingKinds).not.toContain('artifact_produced[kind=ingested_artifact_index]');
    expect(missingKinds).not.toContain('artifact_produced[kind=prior_decision_summary]');
  });

  it('sub_phase_id is part of the match — same kind in a different sub-phase does not count', () => {
    // Write workspace_classification but at the wrong sub-phase.
    writeArtifact('workspace_classification', '0.3', '0'); // wrong sub-phase
    writeArtifact('collision_risk_report', '0.4', '0');
    const result = validateLineage(db, runId, ['0']);
    const missing = result.missingRecords
      .map((m) => `${m.record_type}@${m.sub_phase ?? ''}`)
      .filter((s) => s.startsWith('artifact_produced[kind=workspace_classification]'));
    expect(missing.length).toBeGreaterThan(0);
  });
});

describe('validateLineage — invariants', () => {
  let db: Database;
  let writer: GovernedStreamWriter;
  const runId = 'run-lv-2';

  beforeEach(() => {
    idCounter = 0;
    db = createTestDatabase();
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES (?, 'ws-1', 'dev', '2026-01-01T00:00:00Z', 'in_progress')
    `).run(runId);
    writer = new GovernedStreamWriter(db, nextId);
  });

  afterEach(() => { db.close(); });

  it('validateArchitectureComponents fires when component_model has fewer than 2 components', () => {
    // Satisfy every Phase 4 required_artifact so only the invariant drives
    // the failure — otherwise MissingRecord gaps would dominate.
    const roleByKind: Record<string, string> = {
      software_domains: 'architecture_agent',
      component_model: 'architecture_agent',
      architectural_decisions: 'architecture_agent',
      consistency_report: 'consistency_checker',
    };
    const phase4Art: Array<[string, string]> = [
      ['software_domains', '4.1'],
      ['component_model', '4.2'],
      ['architectural_decisions', '4.3'],
      ['consistency_report', '4.5'],
    ];
    for (const [kind, sub] of phase4Art) {
      if (kind === 'component_model') {
        writer.writeRecord({
          record_type: 'artifact_produced',
          schema_version: '1.0',
          workflow_run_id: runId,
          phase_id: '4',
          sub_phase_id: sub,
          produced_by_agent_role: 'architecture_agent',
          janumicode_version_sha: 'dev',
          content: { kind, components: [{ name: 'only-one' }] },
        });
      } else {
        writer.writeRecord({
          record_type: 'artifact_produced',
          schema_version: '1.0',
          workflow_run_id: runId,
          phase_id: '4',
          sub_phase_id: sub,
          produced_by_agent_role: roleByKind[kind] as never,
          janumicode_version_sha: 'dev',
          content: { kind },
        });
      }
    }
    writer.writeRecord({
      record_type: 'mirror_presented',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: '4',
      sub_phase_id: '4.4',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: 'dev',
      content: { kind: 'architecture_mirror' },
    });
    writer.writeRecord({
      record_type: 'phase_gate_evaluation',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: '4',
      sub_phase_id: '4.5',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: 'dev',
      content: { kind: 'phase_gate' },
    });

    const result = validateLineage(db, runId, ['4']);
    const assertionNames = result.assertionFailures.map((a) => a.assertion);
    expect(assertionNames).toContain('architecture_has_components');
  });

  it('Phase 4 contract mentions architecture_has_components invariant', () => {
    const names = PHASE4_CONTRACT.invariants.map((i) => i.name);
    expect(names).toContain('architecture_has_components');
  });
});

describe('buildGapReport — failed_at_phase derivation', () => {
  it('populates failed_at_phase/failed_at_sub_phase from caller hints', () => {
    const report = buildGapReport(
      { valid: false, missingRecords: [], violations: [], assertionFailures: [] },
      '5',
      '5.2',
    );
    expect(report.failed_at_phase).toBe('5');
    expect(report.failed_at_sub_phase).toBe('5.2');
    // Legacy fields stay aligned so existing consumers don't break.
    expect(report.phase).toBe('5');
    expect(report.subPhase).toBe('5.2');
  });

  it('derives sub_phase from first missing record when caller omits it', () => {
    const report = buildGapReport(
      {
        valid: false,
        missingRecords: [
          {
            record_type: 'artifact_produced[kind=functional_requirements]',
            phase: '2',
            sub_phase: '2.1',
            reason: 'Phase 2.1 must produce functional_requirements.',
          },
        ],
        violations: [],
        assertionFailures: [],
      },
      '2',
    );
    expect(report.failed_at_phase).toBe('2');
    expect(report.failed_at_sub_phase).toBe('2.1');
  });

  it('derives sub_phase from first assertion failure when no missing records', () => {
    const report = buildGapReport(
      {
        valid: false,
        missingRecords: [],
        violations: [],
        assertionFailures: [
          {
            phase: '6',
            sub_phase: '6.1',
            assertion: 'tasks_have_estimates',
            expected: 'true',
            actual: 'false',
          },
        ],
      },
      '6',
    );
    expect(report.failed_at_phase).toBe('6');
    expect(report.failed_at_sub_phase).toBe('6.1');
  });

  it('ignores "unknown" sub_phase sentinel from legacy assertion rows', () => {
    // Some older assertion rows carry sub_phase: "unknown" — that's not
    // a real locality signal, so the derivation should leave
    // failed_at_sub_phase undefined rather than propagate the sentinel.
    const report = buildGapReport(
      {
        valid: false,
        missingRecords: [],
        violations: [],
        assertionFailures: [
          {
            phase: '9',
            sub_phase: 'unknown',
            assertion: 'tests_have_results',
            expected: 'true',
            actual: 'false',
          },
        ],
      },
      '9',
    );
    expect(report.failed_at_phase).toBe('9');
    expect(report.failed_at_sub_phase).toBeUndefined();
  });
});
