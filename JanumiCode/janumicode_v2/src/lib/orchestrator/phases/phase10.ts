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
    engine.stateMachine.setSubPhase(workflowRun.id, '10.1');

    const consistencyRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '10',
      sub_phase_id: '10.1',
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
    engine.stateMachine.setSubPhase(workflowRun.id, '10.2');

    const commitRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '10',
      sub_phase_id: '10.2',
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
    engine.stateMachine.setSubPhase(workflowRun.id, '10.3');

    const allArtifacts = engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced');
    const decisionTraces = engine.writer.getRecordsByType(workflowRun.id, 'decision_trace');

    // Get intent statement summary
    const intentRecord = allArtifacts.find(
      r => (r.content as Record<string, unknown>).kind === 'intent_statement',
    );
    const intentContent = intentRecord?.content as Record<string, unknown> | undefined;
    const intentSummary = intentContent
      ? `${(intentContent.product_concept as Record<string, unknown>)?.name ?? 'Unknown'}: ${(intentContent.product_concept as Record<string, unknown>)?.description ?? ''}`.slice(0, 300)
      : 'Workflow run completed';

    const summaryRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '10',
      sub_phase_id: '10.3',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [commitRecord.id],
      content: {
        kind: 'workflow_run_summary',
        run_id: workflowRun.id,
        intent_statement_summary: intentSummary,
        key_decisions: decisionTraces.length,
        artifacts_produced: allArtifacts.length,
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
      content: { artifacts_produced: allArtifacts.length, key_decisions: decisionTraces.length },
    });

    const mirrorRecord = engine.writer.writeRecord({
      record_type: 'mirror_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '10',
      sub_phase_id: '10.3',
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
      sub_phase_id: '10.3',
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
