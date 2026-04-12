/**
 * Phase 8 — Evaluation Planning.
 * Based on JanumiCode Spec v2.3, §4 Phase 8.
 *
 * Sub-phases:
 *   8.1 — Functional Evaluation Design
 *   8.2 — Quality Evaluation Design
 *   8.3 — Reasoning Evaluation Design (AI subsystems only)
 *   8.4 — Evaluation Plan Mirror and Menu
 *   8.5 — Approval
 */

import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type { PhaseId } from '../../types/records';
import { writeAndIngestArtifact, presentMirror } from './phaseUtils';

export class Phase8Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '8';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];

    // ── 8.1 — Functional Evaluation Design ────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '8.1');

    const funcEvalContent = {
      criteria: [],
    };

    const funcEvalRecord = writeAndIngestArtifact(engine, {
      artifactType: 'functional_evaluation_plan',
      workflowRunId: workflowRun.id,
      phaseId: '8',
      subPhaseId: '8.1',
      agentRole: 'eval_design_agent',
      content: funcEvalContent,
    });
    if (funcEvalRecord) artifactIds.push(funcEvalRecord.id);

    // ── 8.2 — Quality Evaluation Design ───────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '8.2');

    const qualityEvalContent = {
      criteria: [],
    };

    const qualityEvalRecord = writeAndIngestArtifact(engine, {
      artifactType: 'quality_evaluation_plan',
      workflowRunId: workflowRun.id,
      phaseId: '8',
      subPhaseId: '8.2',
      agentRole: 'eval_design_agent',
      content: qualityEvalContent,
    });
    if (qualityEvalRecord) artifactIds.push(qualityEvalRecord.id);

    // ── 8.3 — Reasoning Evaluation Design (AI subsystems) ─────
    engine.stateMachine.setSubPhase(workflowRun.id, '8.3');

    const reasoningEvalContent = {
      scenarios: [],
      ai_subsystems_detected: false,
    };

    const reasoningEvalRecord = writeAndIngestArtifact(engine, {
      artifactType: 'reasoning_evaluation_plan',
      workflowRunId: workflowRun.id,
      phaseId: '8',
      subPhaseId: '8.3',
      agentRole: 'eval_design_agent',
      content: reasoningEvalContent,
    });
    if (reasoningEvalRecord) artifactIds.push(reasoningEvalRecord.id);

    // ── 8.4 — Mirror and Menu ─────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '8.4');
    if (funcEvalRecord) presentMirror(engine, funcEvalRecord.id, 'functional_evaluation_plan', funcEvalContent);

    // ── 8.5 — Approval ────────────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '8.5');
    engine.eventBus.emit('phase_gate:pending', { phaseId: '8' });

    return { success: true, artifactIds };
  }
}
