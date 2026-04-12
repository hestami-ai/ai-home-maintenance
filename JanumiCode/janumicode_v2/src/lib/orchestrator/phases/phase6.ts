/**
 * Phase 6 — Implementation Planning.
 * Based on JanumiCode Spec v2.3, §4 Phase 6.
 *
 * Sub-phases:
 *   6.1 — Implementation Task Decomposition
 *   6.2 — Implementation Plan Mirror and Menu
 *   6.3 — Approval
 */

import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type { PhaseId } from '../../types/records';
import { writeAndIngestArtifact, presentMirror } from './phaseUtils';

export class Phase6Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '6';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];

    // ── 6.1 — Implementation Task Decomposition ──────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '6.1');

    const planContent = {
      tasks: [],
      total_tasks: 0,
      complexity_flagged_count: 0,
      refactoring_tasks_included: false,
    };

    const planRecord = writeAndIngestArtifact(engine, {
      artifactType: 'implementation_plan',
      workflowRunId: workflowRun.id,
      phaseId: '6',
      subPhaseId: '6.1',
      agentRole: 'implementation_planner',
      content: planContent,
    });
    if (planRecord) artifactIds.push(planRecord.id);

    // Run invariant check on implementation plan
    const invariantResult = engine.invariantChecker.check('implementation_plan', planContent, '6');
    if (!invariantResult.overall_pass) {
      engine.writer.writeRecord({
        record_type: 'invariant_violation_record',
        schema_version: '1.0',
        workflow_run_id: workflowRun.id,
        phase_id: '6',
        sub_phase_id: '6.1',
        produced_by_agent_role: 'orchestrator',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        content: { artifact_type: 'implementation_plan', violations: invariantResult.violations },
      });
    }

    // Check for refactoring scope from Phase 0.5
    const run = engine.stateMachine.getWorkflowRun(workflowRun.id);
    if (run?.cross_run_impact_triggered) {
      // Include refactoring tasks from Phase 0.5 refactoring_scope
      // (placeholder — would merge refactoring tasks into the plan)
    }

    // ── 6.2 — Mirror and Menu ─────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '6.2');
    if (planRecord) presentMirror(engine, planRecord.id, 'implementation_plan', planContent);

    // ── 6.3 — Approval ────────────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '6.3');
    engine.eventBus.emit('phase_gate:pending', { phaseId: '6' });

    return { success: true, artifactIds };
  }
}
