/**
 * Phase 5 — Technical Specification.
 * Based on JanumiCode Spec v2.3, §4 Phase 5.
 *
 * Sub-phases:
 *   5.1 — Data Model Specification
 *   5.2 — API Definition
 *   5.3 — Error Handling Strategy Specification
 *   5.4 — Configuration Parameter Specification
 *   5.5 — Technical Specification Mirror and Menu
 *   5.6 — Consistency Check and Approval
 */

import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type { PhaseId } from '../../types/records';
import { writeAndIngestArtifact, presentMirror } from './phaseUtils';

export class Phase5Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '5';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];

    // ── 5.1 — Data Model Specification ────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '5.1');

    const dataModelsContent = {
      models: [],
    };

    const dataModelsRecord = writeAndIngestArtifact(engine, {
      artifactType: 'data_models',
      workflowRunId: workflowRun.id,
      phaseId: '5',
      subPhaseId: '5.1',
      agentRole: 'technical_spec_agent',
      content: dataModelsContent,
    });
    if (dataModelsRecord) artifactIds.push(dataModelsRecord.id);

    // ── 5.2 — API Definition ──────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '5.2');

    const apiContent = {
      definitions: [],
    };

    const apiRecord = writeAndIngestArtifact(engine, {
      artifactType: 'api_definitions',
      workflowRunId: workflowRun.id,
      phaseId: '5',
      subPhaseId: '5.2',
      agentRole: 'technical_spec_agent',
      content: apiContent,
    });
    if (apiRecord) artifactIds.push(apiRecord.id);

    // ── 5.3 — Error Handling Strategy ─────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '5.3');

    const errorHandlingContent = {
      strategies: [],
    };

    const errorRecord = writeAndIngestArtifact(engine, {
      artifactType: 'error_handling_strategies',
      workflowRunId: workflowRun.id,
      phaseId: '5',
      subPhaseId: '5.3',
      agentRole: 'technical_spec_agent',
      content: errorHandlingContent,
    });
    if (errorRecord) artifactIds.push(errorRecord.id);

    // ── 5.4 — Configuration Parameters ────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '5.4');

    const configParamsContent = {
      params: [],
    };

    const configRecord = writeAndIngestArtifact(engine, {
      artifactType: 'configuration_parameters',
      workflowRunId: workflowRun.id,
      phaseId: '5',
      subPhaseId: '5.4',
      agentRole: 'technical_spec_agent',
      content: configParamsContent,
    });
    if (configRecord) artifactIds.push(configRecord.id);

    // ── 5.5 — Mirror and Menu ─────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '5.5');
    if (dataModelsRecord) presentMirror(engine, dataModelsRecord.id, 'data_models', dataModelsContent);

    // ── 5.6 — Consistency Check and Approval ──────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '5.6');
    engine.eventBus.emit('phase_gate:pending', { phaseId: '5' });

    return { success: true, artifactIds };
  }
}
