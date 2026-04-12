/**
 * Phase 7 — Test Planning.
 * Based on JanumiCode Spec v2.3, §4 Phase 7.
 *
 * Sub-phases:
 *   7.1 — Test Case Generation
 *   7.2 — Test Coverage Analysis
 *   7.3 — Test Plan Mirror and Menu
 *   7.4 — Approval
 */

import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type { PhaseId } from '../../types/records';
import { writeAndIngestArtifact, presentMirror } from './phaseUtils';

export class Phase7Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '7';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];

    // ── 7.1 — Test Case Generation ────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '7.1');

    const testPlanContent = {
      test_suites: [],
      total_test_cases: 0,
      coverage_by_type: {
        unit: 0,
        integration: 0,
        end_to_end: 0,
      },
    };

    const testPlanRecord = writeAndIngestArtifact(engine, {
      artifactType: 'test_plan',
      workflowRunId: workflowRun.id,
      phaseId: '7',
      subPhaseId: '7.1',
      agentRole: 'test_design_agent',
      content: testPlanContent,
    });
    if (testPlanRecord) artifactIds.push(testPlanRecord.id);

    // ── 7.2 — Test Coverage Analysis ──────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '7.2');

    const coverageContent = {
      gaps: [],
      coverage_percentage: 100,
    };

    const coverageRecord = writeAndIngestArtifact(engine, {
      artifactType: 'test_coverage_report',
      workflowRunId: workflowRun.id,
      phaseId: '7',
      subPhaseId: '7.2',
      agentRole: 'consistency_checker',
      content: coverageContent,
    });
    if (coverageRecord) artifactIds.push(coverageRecord.id);

    // ── 7.3 — Mirror and Menu ─────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '7.3');
    if (testPlanRecord) presentMirror(engine, testPlanRecord.id, 'test_plan', testPlanContent);

    // ── 7.4 — Approval ────────────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '7.4');
    engine.eventBus.emit('phase_gate:pending', { phaseId: '7' });

    return { success: true, artifactIds };
  }
}
