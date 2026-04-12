/**
 * Phase 0.5 — Cross-Run Impact Analysis (conditional).
 * Based on JanumiCode Spec v2.3, §4 Phase 0.5.
 *
 * Only executes when a prior_decision_override references a Phase-Gate-Certified
 * Interface Contract, API Definition, or Data Model from a prior Workflow Run.
 *
 * Sub-phases:
 *   0.5.1 — Impact Enumeration (Consistency Checker)
 *   0.5.2 — Refactoring Decision (human)
 */

import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type { PhaseId } from '../../types/records';
import { writeAndIngestArtifact } from './phaseUtils';

export class Phase05Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '0.5';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];

    // ── 0.5.1 — Impact Enumeration ────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '0.5.1');

    // Build the cross-run impact report
    const impactContent = {
      changed_interface_id: '',
      affected_artifact_ids: [],
      affected_file_paths: [],
      estimated_refactoring_task_count: 0,
      estimated_file_count: 0,
      dependency_chain: [],
      modification_type: 'additive' as const,
    };

    const impactRecord = writeAndIngestArtifact(engine, {
      artifactType: 'cross_run_impact_report',
      workflowRunId: workflowRun.id,
      phaseId: '0.5',
      subPhaseId: '0.5.1',
      agentRole: 'consistency_checker',
      content: impactContent,
    });
    if (impactRecord) artifactIds.push(impactRecord.id);

    // Cascade Threshold Check (deterministic)
    const config = engine['configManager'].get();
    const taskThreshold = config.cross_run_refactoring.cascade_threshold_task_count;
    const fileThreshold = config.cross_run_refactoring.cascade_threshold_file_count;

    if (impactContent.estimated_refactoring_task_count > taskThreshold ||
        impactContent.estimated_file_count > fileThreshold) {
      // Hard stop — present cascade threshold menu
      engine.eventBus.emit('menu:presented', {
        menuId: 'cascade-threshold',
        options: [
          'Proceed — accept full refactoring scope',
          'Redesign interface change to reduce cascade',
          'Abandon interface change, pursue additive approach',
        ],
      });
    }

    // ── 0.5.2 — Refactoring Decision ─────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '0.5.2');

    // Present impact report as Mirror for human decision
    engine.eventBus.emit('phase_gate:pending', { phaseId: '0.5' });

    return { success: true, artifactIds };
  }
}
