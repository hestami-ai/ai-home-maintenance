/**
 * Smoke tests for the cycle_controller sub-phase handler.
 *
 * Today the handler is minimum-viable (always terminates with
 * 'frontier_empty'). These tests cover that contract; loop activation
 * (b.4) will extend the test surface significantly.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runCycleControllerSubPhase } from '../../../lib/orchestrator/phases/cycleController';
import { createTestEngine, type TestEngine } from '../../helpers/createTestEngine';
import type { CycleIterationContent } from '../../../lib/types/records';

describe('runCycleControllerSubPhase — minimum viable', async () => {
  let engine: TestEngine;

  beforeEach(async () => {
    engine = await createTestEngine();
  });

  afterEach(() => {
    engine.cleanup();
  });

  it('writes a cycle_iteration record with termination_reason=frontier_empty', async () => {
    const run = engine.engine.stateMachine.createWorkflowRun({
      id: 'wf-1', workspace_id: 'ws-1', janumicode_version_sha: 'test',
    });
    const result = await runCycleControllerSubPhase({ workflowRun: run, engine: engine.engine });
    expect(result.termination_reason).toBe('frontier_empty');
    expect(result.cycleRestartTo).toBeUndefined();

    const records = engine.engine.writer.getRecordsByType(run.id, 'cycle_iteration');
    expect(records).toHaveLength(1);
    const content = records[0].content as unknown as CycleIterationContent;
    expect(content.kind).toBe('cycle_iteration');
    expect(content.termination_reason).toBe('frontier_empty');
    expect(content.cycle_number).toBe(0);
  });

  it('propagates atomic_leaves_produced + deferred_leaves_remaining telemetry', async () => {
    const run = engine.engine.stateMachine.createWorkflowRun({
      id: 'wf-2', workspace_id: 'ws-2', janumicode_version_sha: 'test',
    });
    await runCycleControllerSubPhase(
      { workflowRun: run, engine: engine.engine },
      { atomicLeavesProduced: 12, deferredLeavesRemaining: 3 },
    );
    const records = engine.engine.writer.getRecordsByType(run.id, 'cycle_iteration');
    const content = records[0].content as unknown as CycleIterationContent;
    expect(content.atomic_leaves_produced).toBe(12);
    expect(content.deferred_leaves_remaining).toBe(3);
  });

  it('sets the workflow_run current_sub_phase_id to cycle_controller', async () => {
    const run = engine.engine.stateMachine.createWorkflowRun({
      id: 'wf-3', workspace_id: 'ws-3', janumicode_version_sha: 'test',
    });
    await runCycleControllerSubPhase({ workflowRun: run, engine: engine.engine });
    const updated = engine.engine.stateMachine.getWorkflowRun(run.id);
    expect(updated?.current_sub_phase_id).toBe('cycle_controller');
  });
});

describe('runCycleControllerSubPhase — decision logic', async () => {
  let engine: TestEngine;
  let run: ReturnType<TestEngine['engine']['stateMachine']['createWorkflowRun']>;

  beforeEach(async () => {
    engine = await createTestEngine();
    run = engine.engine.stateMachine.createWorkflowRun({
      id: 'wf-cyc', workspace_id: 'ws-cyc', janumicode_version_sha: 'test',
    });
  });

  afterEach(() => {
    engine.cleanup();
  });

  function writeFailure(failuresByPacket: Record<string, string[]>): void {
    const codeCount = Object.values(failuresByPacket).reduce((n, arr) => n + arr.length, 0);
    engine.engine.writer.writeRecord({
      record_type: 'packet_synthesis_failure',
      schema_version: '1.0',
      workflow_run_id: run.id,
      phase_id: '9',
      sub_phase_id: 'packet_synthesis',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: 'test',
      derived_from_record_ids: [],
      content: {
        kind: 'packet_synthesis_failure',
        schemaVersion: '1.0',
        failures_by_packet: failuresByPacket,
        cross_packet_failures: {},
        total_packets: Object.keys(failuresByPacket).length,
        failed_packets: Object.keys(failuresByPacket).length,
        total_blocking_failures: codeCount,
        total_advisory_findings: 0,
        total_ai_proposed_root_count: 0,
      },
    });
  }

  it('routes orphan-story failure to Phase 6', async () => {
    writeFailure({
      'pkt-A': ['P1_NO_USER_STORY: packet pkt-A has no user stories'],
    });
    const result = await runCycleControllerSubPhase({ workflowRun: run, engine: engine.engine });
    expect(result.cycleRestartTo).toBe('6');
  });

  it('routes orphan-AC-no-test failure to Phase 7', async () => {
    writeFailure({
      'pkt-A': ['P3_AC_NO_TEST: US-001/AC-001 has no test case'],
    });
    const result = await runCycleControllerSubPhase({ workflowRun: run, engine: engine.engine });
    expect(result.cycleRestartTo).toBe('7');
  });

  it('routes orphan-US-no-eval failure to Phase 8', async () => {
    writeFailure({
      'pkt-A': ['P4_USER_STORY_NO_EVAL: US-001 has no evaluation criterion'],
    });
    const result = await runCycleControllerSubPhase({ workflowRun: run, engine: engine.engine });
    expect(result.cycleRestartTo).toBe('8');
  });

  it('Phase 6 routing wins when multiple failure classes present', async () => {
    writeFailure({
      'pkt-A': ['P3_AC_NO_TEST: US-001/AC-001 has no test case'],
      'pkt-B': ['P1_NO_USER_STORY: packet pkt-B has no user stories'],
      'pkt-C': ['P4_USER_STORY_NO_EVAL: US-001 has no evaluation criterion'],
    });
    const result = await runCycleControllerSubPhase({ workflowRun: run, engine: engine.engine });
    expect(result.cycleRestartTo).toBe('6');
  });

  it('terminates when no failure records exist (frontier_empty)', async () => {
    const result = await runCycleControllerSubPhase({ workflowRun: run, engine: engine.engine });
    expect(result.termination_reason).toBe('frontier_empty');
    expect(result.cycleRestartTo).toBeUndefined();
  });

  it('terminates when failure record has zero blocking failures', async () => {
    engine.engine.writer.writeRecord({
      record_type: 'packet_synthesis_failure',
      schema_version: '1.0',
      workflow_run_id: run.id,
      phase_id: '9',
      sub_phase_id: 'packet_synthesis',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: 'test',
      derived_from_record_ids: [],
      content: {
        kind: 'packet_synthesis_failure',
        schemaVersion: '1.0',
        failures_by_packet: {},
        cross_packet_failures: {},
        total_packets: 0, failed_packets: 0,
        total_blocking_failures: 0, total_advisory_findings: 0, total_ai_proposed_root_count: 0,
      },
    });
    const result = await runCycleControllerSubPhase({ workflowRun: run, engine: engine.engine });
    expect(result.cycleRestartTo).toBeUndefined();
    expect(result.termination_reason).toBe('frontier_empty');
  });

  it('at ceiling, presents mirror; auto-approve mode resolves to ceiling_hit_accepted', async () => {
    // Force current_cycle_number to 5 (default max). Auto-approve mode
    // returns synthetic decision_bundle_resolution with no selection,
    // which the ceiling mirror interprets as "accept and advance".
    engine.engine.db.prepare(
      `UPDATE workflow_runs SET current_cycle_number = 5, max_cycles_per_release = 5 WHERE id = ?`,
    ).run(run.id);
    const refreshed = engine.engine.stateMachine.getWorkflowRun(run.id)!;
    writeFailure({ 'pkt-A': ['P1_NO_USER_STORY'] });
    const result = await runCycleControllerSubPhase({ workflowRun: refreshed, engine: engine.engine });
    expect(result.termination_reason).toBe('ceiling_hit_accepted');
    expect(result.cycleRestartTo).toBeUndefined();
    expect(result.abort).toBeFalsy();
  });

  it('terminates with zero_progress when delta cycle produces no new atomic leaves', async () => {
    engine.engine.db.prepare(
      `UPDATE workflow_runs SET current_cycle_number = 1 WHERE id = ?`,
    ).run(run.id);
    const refreshed = engine.engine.stateMachine.getWorkflowRun(run.id)!;
    writeFailure({ 'pkt-A': ['P1_NO_USER_STORY'] });
    const result = await runCycleControllerSubPhase(
      { workflowRun: refreshed, engine: engine.engine },
      { atomicLeavesProduced: 0, deferredLeavesRemaining: 0 },
    );
    expect(result.termination_reason).toBe('zero_progress');
    expect(result.cycleRestartTo).toBeUndefined();
  });

  it('cycle 0 with zero atomic leaves still loops (zero-progress only fires from cycle 1+)', async () => {
    writeFailure({ 'pkt-A': ['P1_NO_USER_STORY'] });
    const result = await runCycleControllerSubPhase(
      { workflowRun: run, engine: engine.engine },
      { atomicLeavesProduced: 0, deferredLeavesRemaining: 0 },
    );
    expect(result.cycleRestartTo).toBe('6');
  });
});

describe('cycle_controller ceiling mirror', async () => {
  let engine: TestEngine;
  let run: ReturnType<TestEngine['engine']['stateMachine']['createWorkflowRun']>;

  beforeEach(async () => {
    engine = await createTestEngine();
    run = engine.engine.stateMachine.createWorkflowRun({
      id: 'wf-mirror', workspace_id: 'ws-mirror', janumicode_version_sha: 'test',
    });
    // Force ceiling-hit: cycle 5 + max 5 means cycle+1 (6) > max.
    engine.engine.db.prepare(
      `UPDATE workflow_runs SET current_cycle_number = 5, max_cycles_per_release = 5 WHERE id = ?`,
    ).run(run.id);
    // Seed an unresolved coherence failure so the controller actually
    // reaches the ceiling branch.
    engine.engine.writer.writeRecord({
      record_type: 'packet_synthesis_failure',
      schema_version: '1.0',
      workflow_run_id: run.id,
      phase_id: '9',
      sub_phase_id: 'packet_synthesis',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: 'test',
      derived_from_record_ids: [],
      content: {
        kind: 'packet_synthesis_failure', schemaVersion: '1.0',
        failures_by_packet: { 'pkt-A': ['P1_NO_USER_STORY'] },
        cross_packet_failures: {},
        total_packets: 1, failed_packets: 1,
        total_blocking_failures: 1, total_advisory_findings: 0, total_ai_proposed_root_count: 0,
      },
    });
  });

  afterEach(() => engine.cleanup());

  it('auto-approve with no override defaults to accept (ceiling_hit_accepted)', async () => {
    const refreshed = engine.engine.stateMachine.getWorkflowRun(run.id)!;
    const result = await runCycleControllerSubPhase({ workflowRun: refreshed, engine: engine.engine });
    expect(result.termination_reason).toBe('ceiling_hit_accepted');
    expect(result.cycleRestartTo).toBeUndefined();
    expect(result.abort).toBeFalsy();
  });

  it('operator extend → raises max_cycles_per_release by 3 and signals cycleRestartTo', async () => {
    engine.engine.setDecisionOverrides(new Map([['cycle_controller', 'extend']]));
    const refreshed = engine.engine.stateMachine.getWorkflowRun(run.id)!;
    const result = await runCycleControllerSubPhase({ workflowRun: refreshed, engine: engine.engine });
    expect(result.cycleRestartTo).toBe('6');
    expect(result.abort).toBeFalsy();
    const updated = engine.engine.stateMachine.getWorkflowRun(run.id);
    expect(updated?.max_cycles_per_release).toBe(8);   // 5 + 3
  });

  it('operator abort → returns abort flag, no cycleRestartTo', async () => {
    engine.engine.setDecisionOverrides(new Map([['cycle_controller', 'abort']]));
    const refreshed = engine.engine.stateMachine.getWorkflowRun(run.id)!;
    const result = await runCycleControllerSubPhase({ workflowRun: refreshed, engine: engine.engine });
    expect(result.termination_reason).toBe('phase_failure');
    expect(result.abort).toBe(true);
    expect(result.cycleRestartTo).toBeUndefined();
  });

  it('operator explicit accept → ceiling_hit_accepted', async () => {
    engine.engine.setDecisionOverrides(new Map([['cycle_controller', 'accept']]));
    const refreshed = engine.engine.stateMachine.getWorkflowRun(run.id)!;
    const result = await runCycleControllerSubPhase({ workflowRun: refreshed, engine: engine.engine });
    expect(result.termination_reason).toBe('ceiling_hit_accepted');
    expect(result.abort).toBeFalsy();
  });
});

describe('StateMachine.cycleRestartPhase', async () => {
  let engine: TestEngine;

  beforeEach(async () => { engine = await createTestEngine(); });
  afterEach(() => engine.cleanup());

  it('allows Phase 9 → Phase 6 back-transition and bumps cycle counter', async () => {
    const run = engine.engine.stateMachine.createWorkflowRun({
      id: 'wf-restart', workspace_id: 'ws', janumicode_version_sha: 'test',
    });
    // Move the run to Phase 9 (use raw SQL — advancePhase enforces forward steps).
    engine.engine.db.prepare(`UPDATE workflow_runs SET current_phase_id = '9' WHERE id = ?`).run(run.id);

    const result = engine.engine.stateMachine.cycleRestartPhase(run.id, '6');
    expect(result.success).toBe(true);
    expect(result.previousPhase).toBe('9');
    expect(result.newPhase).toBe('6');

    const updated = engine.engine.stateMachine.getWorkflowRun(run.id)!;
    expect(updated.current_phase_id).toBe('6');
    expect(updated.current_cycle_number).toBe(1);
  });

  it('rejects back-transition from non-Phase-9 origin', async () => {
    const run = engine.engine.stateMachine.createWorkflowRun({
      id: 'wf-r2', workspace_id: 'ws', janumicode_version_sha: 'test',
    });
    engine.engine.db.prepare(`UPDATE workflow_runs SET current_phase_id = '5' WHERE id = ?`).run(run.id);
    const result = engine.engine.stateMachine.cycleRestartPhase(run.id, '6');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/only valid from Phase 9/);
  });

  it('rejects unauthorized targets (e.g. Phase 2)', async () => {
    const run = engine.engine.stateMachine.createWorkflowRun({
      id: 'wf-r3', workspace_id: 'ws', janumicode_version_sha: 'test',
    });
    engine.engine.db.prepare(`UPDATE workflow_runs SET current_phase_id = '9' WHERE id = ?`).run(run.id);
    const result = engine.engine.stateMachine.cycleRestartPhase(run.id, '2');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/only allows targets 6, 7, 8/);
  });
});
