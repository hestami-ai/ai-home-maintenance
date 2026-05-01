/**
 * Phase 10 — Commit and Deployment Initiation.
 * Based on JanumiCode Spec v2.3, §4 Phase 10.
 *
 * Sub-phases:
 *   10.1 — Pre-Commit Consistency Check (scaffold)
 *   10.2 — Commit Preparation (scaffold — no real git)
 *   10.3 — Workflow Run Closure
 *
 * This is a scaffold implementation. Real commit operations will be
 * implemented when git tooling integration is built.
 */

import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type { PhaseId } from '../../types/records';
import { getLogger } from '../../logging';

export class Phase10Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '10';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];

    // ── 10.1 — Pre-Commit Consistency Check ───────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'pre_commit_consistency_check');

    const consistencyRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '10',
      sub_phase_id: 'pre_commit_consistency_check',
      produced_by_agent_role: 'consistency_checker',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: {
        kind: 'consistency_report',
        overall_pass: true,
        traceability_results: [],
        semantic_findings: [],
        internal_findings: [],
        blocking_failures: [],
        warnings: [],
        scaffold: true,
      },
    });
    artifactIds.push(consistencyRecord.id);
    engine.ingestionPipeline.ingest(consistencyRecord);

    // ── 10.2 — Commit Preparation ─────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'commit_preparation');

    const commitRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '10',
      sub_phase_id: 'commit_preparation',
      produced_by_agent_role: 'executor_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [consistencyRecord.id],
      content: {
        kind: 'commit_record',
        commit_sha: '',
        branch: 'main',
        commit_message: `JanumiCode Workflow Run ${workflowRun.id}`,
        artifact_ids_committed: artifactIds,
        status: 'prepared',
        scaffold: true,
      },
    });
    artifactIds.push(commitRecord.id);
    engine.ingestionPipeline.ingest(commitRecord);

    // ── 10.3 — Workflow Run Closure ───────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'workflow_run_closure');

    // Use narrow queries here — a long calibration run produces thousands
    // of artifact_produced rows totalling tens of MB. Pulling the full
    // bodies through the sidecar RPC SAB (32MB cap) overflows it and
    // surfaces as "RPC error: offset is out of bounds" right at workflow
    // closure (observed end of cal-23). We only need cardinalities + the
    // single intent_statement record here.
    const artifactsCount = engine.writer.countRecordsByType(workflowRun.id, 'artifact_produced');
    const decisionTracesCount = engine.writer.countRecordsByType(workflowRun.id, 'decision_trace');

    const intentRecord = engine.writer.getArtifactByKind(workflowRun.id, 'intent_statement');
    const intentContent = intentRecord?.content as Record<string, unknown> | undefined;
    const intentSummary = intentContent
      ? `${(intentContent.product_concept as Record<string, unknown>)?.name ?? 'Unknown'}: ${(intentContent.product_concept as Record<string, unknown>)?.description ?? ''}`.slice(0, 300)
      : 'Workflow run completed';

    const summaryRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '10',
      sub_phase_id: 'workflow_run_closure',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [commitRecord.id],
      content: {
        kind: 'workflow_run_summary',
        run_id: workflowRun.id,
        intent_statement_summary: intentSummary,
        key_decisions: decisionTracesCount,
        artifacts_produced: artifactsCount,
        janumicode_version_sha: engine.janumiCodeVersionSha,
        completion_timestamp: new Date().toISOString(),
      },
    });
    artifactIds.push(summaryRecord.id);
    engine.ingestionPipeline.ingest(summaryRecord);

    // Mirror for final approval
    const closureMirror = engine.mirrorGenerator.generate({
      artifactId: summaryRecord.id,
      artifactType: 'workflow_run_summary',
      content: { artifacts_produced: artifactsCount, key_decisions: decisionTracesCount },
    });

    const mirrorRecord = engine.writer.writeRecord({
      record_type: 'mirror_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '10',
      sub_phase_id: 'workflow_run_closure',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [summaryRecord.id],
      content: {
        kind: 'workflow_closure_mirror',
        mirror_id: closureMirror.mirrorId,
        fields: closureMirror.fields,
      },
    });
    artifactIds.push(mirrorRecord.id);
    engine.eventBus.emit('mirror:presented', { mirrorId: closureMirror.mirrorId, artifactType: 'workflow_run_summary' });

    try {
      const resolution = await engine.pauseForDecision(workflowRun.id, mirrorRecord.id, 'mirror');
      if (resolution.type === 'mirror_rejection') {
        return { success: false, error: 'User rejected workflow closure', artifactIds };
      }
    } catch (err) {
      getLogger().warn('workflow', 'Phase 10 approval failed', { error: String(err) });
      return { success: false, error: 'Workflow closure failed', artifactIds };
    }

    // Mark workflow run as complete
    engine.stateMachine.completeWorkflowRun(workflowRun.id);
    engine.eventBus.emit('workflow:completed', { workflowRunId: workflowRun.id });

    // Phase Gate (final)
    const gateRecord = engine.writer.writeRecord({
      record_type: 'phase_gate_evaluation',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '10',
      sub_phase_id: 'workflow_run_closure',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [consistencyRecord.id, commitRecord.id, summaryRecord.id],
      content: {
        kind: 'phase_gate',
        phase_id: '10',
        consistency_pass: true,
        commit_status: 'prepared',
        workflow_status: 'completed',
        scaffold: true,
      },
    });
    artifactIds.push(gateRecord.id);

    return { success: true, artifactIds };
  }
}
