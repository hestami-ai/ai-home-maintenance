import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestEngine, type TestEngine } from '../../../helpers/createTestEngine';
import { Phase05Handler } from '../../../../lib/orchestrator/phases/phase05';
import { Phase10Handler } from '../../../../lib/orchestrator/phases/phase10';
import type { OrchestratorEngine } from '../../../../lib/orchestrator/orchestratorEngine';

// ── Seeding helpers ──────────────────────────────────────────────────

const PRIOR_RUN = 'prior-run';
const CUR_RUN = 'current-run';

function ensurePriorRun(engine: OrchestratorEngine): void {
  if (!engine.stateMachine.getWorkflowRun(PRIOR_RUN)) {
    engine.stateMachine.createWorkflowRun({ id: PRIOR_RUN, workspace_id: 'ws', janumicode_version_sha: 'sha' });
  }
}

function seedPriorCertifiedInterface(engine: OrchestratorEngine, opts?: { kind?: string }): string {
  ensurePriorRun(engine);
  const kind = opts?.kind ?? 'interface_contracts';
  // Prior-run interface artifact.
  const iface = engine.writer.writeRecord({
    record_type: 'artifact_produced',
    schema_version: '1.0',
    workflow_run_id: PRIOR_RUN,
    phase_id: '3',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    content: { kind, contracts: [{ id: 'IC-1', protocol: 'rest' }, { id: 'IC-2', protocol: 'rest' }] },
  });
  // Prior-run phase_gate_approved + validates edge → certified.
  const gate = engine.writer.writeRecord({
    record_type: 'phase_gate_approved',
    schema_version: '1.0',
    workflow_run_id: PRIOR_RUN,
    janumicode_version_sha: engine.janumiCodeVersionSha,
    content: { target_record_id: 'gate-eval', approved_artifact_ids: [iface.id] },
  });
  engine.db.prepare(`
    INSERT INTO memory_edge (id, source_record_id, target_record_id, edge_type, asserted_by, asserted_at, authority_level, status)
    VALUES (?, ?, ?, 'validates', 'ingestion_pipeline', ?, 6, 'system_asserted')
  `).run('edge-1', gate.id, iface.id, new Date().toISOString());
  return iface.id;
}

function writeOverride(engine: OrchestratorEngine, supersededId: string, runId = CUR_RUN): string {
  const trace = engine.writer.writeRecord({
    record_type: 'decision_trace',
    schema_version: '1.0',
    workflow_run_id: runId,
    phase_id: '1',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    content: {
      decision_type: 'prior_decision_override',
      target_record_id: supersededId,
      superseded_record_id: supersededId,
    },
  });
  return trace.id;
}

describe('Phase 0.5 cross-run impact — trigger detection (spec §4 Phase 0.5 entry)', () => {
  let te: TestEngine;
  let engine: OrchestratorEngine;

  beforeEach(async () => {
    te = await createTestEngine({ autoApprove: true });
    engine = te.engine;
    engine.stateMachine.createWorkflowRun({ id: CUR_RUN, workspace_id: 'ws', janumicode_version_sha: 'sha' });
  });
  afterEach(() => te.cleanup());

  it('triggers for a prior-run, certified, interface-kind override', () => {
    const ifaceId = seedPriorCertifiedInterface(engine);
    writeOverride(engine, ifaceId);
    const trig = engine.detectCrossRunImpactTrigger(CUR_RUN);
    expect(trig).not.toBeNull();
    expect(trig!.changedInterfaceId).toBe(ifaceId);
    expect(trig!.priorWorkflowRunId).toBe(PRIOR_RUN);
    expect(trig!.interfaceKind).toBe('interface_contracts');
  });

  it('does NOT trigger when the override target is a non-interface kind', () => {
    ensurePriorRun(engine);
    const boundary = engine.writer.writeRecord({
      record_type: 'artifact_produced', schema_version: '1.0', workflow_run_id: PRIOR_RUN,
      janumicode_version_sha: 'sha', content: { kind: 'system_boundary' },
    });
    const gate = engine.writer.writeRecord({
      record_type: 'phase_gate_approved', schema_version: '1.0', workflow_run_id: PRIOR_RUN,
      janumicode_version_sha: 'sha', content: {},
    });
    engine.db.prepare(`INSERT INTO memory_edge (id, source_record_id, target_record_id, edge_type, asserted_by, asserted_at, authority_level, status) VALUES (?,?,?,'validates','ip',?,6,'system_asserted')`)
      .run('e2', gate.id, boundary.id, new Date().toISOString());
    writeOverride(engine, boundary.id);
    expect(engine.detectCrossRunImpactTrigger(CUR_RUN)).toBeNull();
  });

  it('does NOT trigger when the interface is uncertified (no validates edge)', () => {
    ensurePriorRun(engine);
    const iface = engine.writer.writeRecord({
      record_type: 'artifact_produced', schema_version: '1.0', workflow_run_id: PRIOR_RUN,
      janumicode_version_sha: 'sha', content: { kind: 'interface_contracts', contracts: [] },
    });
    writeOverride(engine, iface.id);
    expect(engine.detectCrossRunImpactTrigger(CUR_RUN)).toBeNull();
  });

  it('does NOT trigger for a within-run override (same workflow run)', () => {
    const iface = engine.writer.writeRecord({
      record_type: 'artifact_produced', schema_version: '1.0', workflow_run_id: CUR_RUN,
      janumicode_version_sha: 'sha', content: { kind: 'interface_contracts', contracts: [] },
    });
    const gate = engine.writer.writeRecord({
      record_type: 'phase_gate_approved', schema_version: '1.0', workflow_run_id: CUR_RUN,
      janumicode_version_sha: 'sha', content: {},
    });
    engine.db.prepare(`INSERT INTO memory_edge (id, source_record_id, target_record_id, edge_type, asserted_by, asserted_at, authority_level, status) VALUES (?,?,?,'validates','ip',?,6,'system_asserted')`)
      .run('e3', gate.id, iface.id, new Date().toISOString());
    writeOverride(engine, iface.id, CUR_RUN);
    expect(engine.detectCrossRunImpactTrigger(CUR_RUN)).toBeNull();
  });
});

describe('Phase 0.5 handler — enumeration + refactoring decision (spec §4 Phase 0.5.1/0.5.2)', () => {
  let te: TestEngine;
  let engine: OrchestratorEngine;

  beforeEach(async () => {
    te = await createTestEngine({ autoApprove: true });
    engine = te.engine;
    engine.stateMachine.createWorkflowRun({ id: CUR_RUN, workspace_id: 'ws', janumicode_version_sha: 'sha' });
    const ifaceId = seedPriorCertifiedInterface(engine);
    writeOverride(engine, ifaceId);
    engine.stateMachine.setCrossRunImpactTriggered(CUR_RUN, true);
    engine.stateMachine.advancePhase(CUR_RUN, '0.5');
  });
  afterEach(() => te.cleanup());

  function run() {
    const workflowRun = engine.stateMachine.getWorkflowRun(CUR_RUN)!;
    return new Phase05Handler().execute({ workflowRun, engine });
  }

  it('Proceed (default) → cross_run_impact_report + refactoring_scope + gate', async () => {
    const res = await run();
    expect(res.success).toBe(true);
    expect(res.reviseTo).toBeUndefined();

    const reports = engine.writer.getRecordsByType(CUR_RUN, 'cross_run_impact_report');
    expect(reports).toHaveLength(1);
    expect((reports[0].content as Record<string, unknown>).modification_type).toBe('breaking');

    const scopes = engine.writer.getRecordsByType(CUR_RUN, 'refactoring_scope');
    expect(scopes).toHaveLength(1);
    const tasks = (scopes[0].content as Record<string, unknown>).refactoring_tasks as Array<Record<string, unknown>>;
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    expect(tasks[0].task_type).toBe('refactoring');

    // #2: the task carries a self-contained, executor-readable directive with
    // the previous definition, the new one, and the member diff — NOT just UUIDs.
    const instr = tasks[0].refactoring_instructions as string;
    expect(instr).toContain('Cross-Run Refactoring Instruction');
    expect(instr).toContain('What specifically changed');
    expect(instr).toContain('Previous definition');
    expect(instr).toContain('New definition');
    // The old interface body (IC-1/IC-2 from the seeded contract) must be inlined.
    expect(instr).toContain('IC-1');

    // The impact report carries the member-level diff + definition snapshots.
    const report = reports[0].content as Record<string, unknown>;
    expect(report.diff).toBeDefined();
    expect(report.old_definition).toBeDefined();

    const gates = engine.writer.getRecordsByType(CUR_RUN, 'phase_gate_evaluation');
    expect(gates.some(g => (g.content as Record<string, unknown>).phase_id === '0.5')).toBe(true);
  });

  it('Revise (index_1) → reviseTo "1", no refactoring_scope', async () => {
    engine.setDecisionOverrides(new Map([['refactoring_decision', 'index_1']]));
    const res = await run();
    expect(res.reviseTo).toBe('1');
    expect(engine.writer.getRecordsByType(CUR_RUN, 'refactoring_scope')).toHaveLength(0);
  });

  it('Accept divergence (index_2) → technical_debt_record, no refactoring_scope', async () => {
    engine.setDecisionOverrides(new Map([['refactoring_decision', 'index_2']]));
    const res = await run();
    expect(res.success).toBe(true);
    expect(res.reviseTo).toBeUndefined();
    expect(engine.writer.getRecordsByType(CUR_RUN, 'technical_debt_record')).toHaveLength(1);
    expect(engine.writer.getRecordsByType(CUR_RUN, 'refactoring_scope')).toHaveLength(0);
  });
});

describe('Phase 10.1 — cross_run_modification verification (spec §4 Phase 10.1 gate criterion)', () => {
  let te: TestEngine;
  let engine: OrchestratorEngine;

  beforeEach(async () => {
    te = await createTestEngine({ autoApprove: true });
    engine = te.engine;
    engine.stateMachine.createWorkflowRun({ id: CUR_RUN, workspace_id: 'ws', janumicode_version_sha: 'sha' });
    engine.stateMachine.setCrossRunImpactTriggered(CUR_RUN, true);
    // Advance to phase 10.
    for (const p of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const) {
      engine.stateMachine.advancePhase(CUR_RUN, p);
    }
    // A refactoring_scope with one task.
    engine.writer.writeRecord({
      record_type: 'refactoring_scope', schema_version: '1.0', workflow_run_id: CUR_RUN,
      janumicode_version_sha: 'sha',
      content: { kind: 'refactoring_scope', cross_run_impact_report_id: 'rep-1', refactoring_tasks: [{ id: 'REFACTOR-1' }] },
    });
  });
  afterEach(() => te.cleanup());

  it('blocks when a Refactoring Task has no cross_run_modification', async () => {
    const workflowRun = engine.stateMachine.getWorkflowRun(CUR_RUN)!;
    await new Phase10Handler().execute({ workflowRun, engine });
    const report = engine.writer.getRecordsByType(CUR_RUN, 'artifact_produced')
      .find(r => (r.content as Record<string, unknown>).kind === 'consistency_report');
    expect(report).toBeDefined();
    const content = report!.content as Record<string, unknown>;
    expect(content.overall_pass).toBe(false);
    expect((content.blocking_failures as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  it('passes when every Refactoring Task produced a cross_run_modification', async () => {
    engine.writer.writeRecord({
      record_type: 'cross_run_modification', schema_version: '1.0', workflow_run_id: CUR_RUN,
      janumicode_version_sha: 'sha',
      content: { kind: 'cross_run_modification', refactoring_task_id: 'REFACTOR-1', verification_passed: true },
    });
    const workflowRun = engine.stateMachine.getWorkflowRun(CUR_RUN)!;
    await new Phase10Handler().execute({ workflowRun, engine });
    const report = engine.writer.getRecordsByType(CUR_RUN, 'artifact_produced')
      .find(r => (r.content as Record<string, unknown>).kind === 'consistency_report');
    expect((report!.content as Record<string, unknown>).overall_pass).toBe(true);
  });
});
