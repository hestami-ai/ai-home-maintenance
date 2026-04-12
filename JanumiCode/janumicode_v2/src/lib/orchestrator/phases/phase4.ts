/**
 * Phase 4 — Architecture Definition.
 * Based on JanumiCode Spec v2.3, §4 Phase 4.
 *
 * Sub-phases:
 *   4.1 — Software Domain Identification
 *   4.2 — Component Decomposition
 *   4.3 — Architectural Decision Capture
 *   4.4 — Architecture Mirror and Menu (with implementability review)
 *   4.5 — Consistency Check and Approval
 */

import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type { PhaseId } from '../../types/records';
import { writeAndIngestArtifact, presentMirror } from './phaseUtils';

export class Phase4Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '4';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];

    // ── 4.1 — Software Domain Identification ──────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '4.1');

    const domainsContent = {
      domains: [],
    };

    const domainsRecord = writeAndIngestArtifact(engine, {
      artifactType: 'software_domains',
      workflowRunId: workflowRun.id,
      phaseId: '4',
      subPhaseId: '4.1',
      agentRole: 'architecture_agent',
      content: domainsContent,
    });
    if (domainsRecord) artifactIds.push(domainsRecord.id);

    // ── 4.2 — Component Decomposition ─────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '4.2');

    const componentContent = {
      components: [],
    };

    const componentRecord = writeAndIngestArtifact(engine, {
      artifactType: 'component_model',
      workflowRunId: workflowRun.id,
      phaseId: '4',
      subPhaseId: '4.2',
      agentRole: 'architecture_agent',
      content: componentContent,
      derivedFromIds: domainsRecord ? [domainsRecord.id] : [],
    });
    if (componentRecord) artifactIds.push(componentRecord.id);

    // Run invariant check on component model
    const invariantResult = engine.invariantChecker.check('component_model', componentContent, '4');
    if (!invariantResult.overall_pass) {
      // Record the violation
      engine.writer.writeRecord({
        record_type: 'invariant_violation_record',
        schema_version: '1.0',
        workflow_run_id: workflowRun.id,
        phase_id: '4',
        sub_phase_id: '4.2',
        produced_by_agent_role: 'orchestrator',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        content: {
          artifact_type: 'component_model',
          violations: invariantResult.violations,
        },
      });
    }

    // ── 4.3 — Architectural Decision Capture ──────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '4.3');

    const adrsContent = {
      adrs: [],
    };

    const adrsRecord = writeAndIngestArtifact(engine, {
      artifactType: 'architectural_decisions',
      workflowRunId: workflowRun.id,
      phaseId: '4',
      subPhaseId: '4.3',
      agentRole: 'architecture_agent',
      content: adrsContent,
    });
    if (adrsRecord) artifactIds.push(adrsRecord.id);

    // ── 4.4 — Mirror and Menu (implementability review) ───────
    engine.stateMachine.setSubPhase(workflowRun.id, '4.4');
    if (componentRecord) presentMirror(engine, componentRecord.id, 'component_model', componentContent);

    // ── 4.5 — Consistency Check and Approval ──────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '4.5');
    engine.eventBus.emit('phase_gate:pending', { phaseId: '4' });

    return { success: true, artifactIds };
  }
}
