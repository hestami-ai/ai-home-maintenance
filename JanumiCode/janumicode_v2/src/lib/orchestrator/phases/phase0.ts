/**
 * Phase 0 — Workspace Initialization.
 * Based on JanumiCode Spec v2.3, §4 Phase 0.
 *
 * Sub-phases:
 *   0.1 — Workspace Classification (greenfield/brownfield)
 *   0.2 — Artifact Ingestion (brownfield only) [Wave 7]
 *   0.2b — Brownfield Continuity Check (brownfield only) [Wave 7]
 *   0.3 — Ingestion Review (brownfield only) [Wave 7]
 *   0.4 — Vocabulary Collision Check
 *
 * Phase Gate: workspace_classification valid, collision_risk_report produced, human approved.
 */

import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type { PhaseId } from '../../types/records';

export class Phase0Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '0';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];

    // ── Sub-Phase 0.1 — Workspace Classification ──────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '0.1');

    // Deterministic: check if workspace has prior workflow runs
    const priorRuns = engine.writer.getRecordsByType(
      workflowRun.id, 'artifact_produced', false,
    );

    const workspaceType = priorRuns.length === 0 ? 'greenfield' : 'brownfield';

    const classificationContent = {
      workspace_type: workspaceType,
      janumicode_version_sha: engine.janumiCodeVersionSha,
      existing_artifact_count: 0,
      prior_workflow_run_count: 0,
    };

    // Validate against schema
    const validation = engine.schemaValidator.validate(
      'workspace_classification',
      classificationContent,
    );

    if (!validation.valid) {
      return {
        success: false,
        error: `workspace_classification schema validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
        artifactIds,
      };
    }

    // Write the artifact
    const classificationRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '0',
      sub_phase_id: '0.1',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: classificationContent,
    });

    artifactIds.push(classificationRecord.id);
    engine.ingestionPipeline.ingest(classificationRecord);
    // Auto-emit happens inside writer.writeRecord() — no manual emit needed.

    // ── Sub-Phases 0.2, 0.2b, 0.3 — Brownfield (Wave 7) ─────
    // Skip for greenfield; brownfield handling added in Wave 7

    // ── Sub-Phase 0.4 — Vocabulary Collision Check ────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '0.4');

    // For greenfield with no product scope yet, produce a clean report
    const collisionContent = {
      aliases: [],
      collision_risks: [],
      overall_status: 'clean' as const,
    };

    const collisionValidation = engine.schemaValidator.validate(
      'collision_risk_report',
      collisionContent,
    );

    if (!collisionValidation.valid) {
      return {
        success: false,
        error: `collision_risk_report schema validation failed`,
        artifactIds,
      };
    }

    const collisionRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '0',
      sub_phase_id: '0.4',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: collisionContent,
    });

    artifactIds.push(collisionRecord.id);
    engine.ingestionPipeline.ingest(collisionRecord);
    // Auto-emit happens inside writer.writeRecord() — no manual emit needed.

    return { success: true, artifactIds };
  }
}
