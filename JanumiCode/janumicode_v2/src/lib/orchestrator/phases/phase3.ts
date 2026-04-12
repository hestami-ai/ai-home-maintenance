/**
 * Phase 3 — System Specification.
 * Based on JanumiCode Spec v2.3, §4 Phase 3.
 *
 * Sub-phases:
 *   3.1 — System Boundary Definition
 *   3.2 — System Requirements Derivation
 *   3.3 — Interface Contract Specification
 *   3.4 — System Specification Mirror and Menu
 *   3.5 — Consistency Check and Approval
 */

import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type { PhaseId } from '../../types/records';
import { writeAndIngestArtifact, presentMirror } from './phaseUtils';

export class Phase3Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '3';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];

    // ── 3.1 — System Boundary Definition ──────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '3.1');

    const boundaryContent = {
      in_scope: [],
      out_of_scope: [],
      external_systems: [],
    };

    const boundaryRecord = writeAndIngestArtifact(engine, {
      artifactType: 'system_boundary',
      workflowRunId: workflowRun.id,
      phaseId: '3',
      subPhaseId: '3.1',
      agentRole: 'systems_agent',
      content: boundaryContent,
    });
    if (boundaryRecord) artifactIds.push(boundaryRecord.id);

    // ── 3.2 — System Requirements Derivation ──────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '3.2');

    const sysReqContent = {
      items: [],
    };

    const sysReqRecord = writeAndIngestArtifact(engine, {
      artifactType: 'system_requirements',
      workflowRunId: workflowRun.id,
      phaseId: '3',
      subPhaseId: '3.2',
      agentRole: 'systems_agent',
      content: sysReqContent,
      derivedFromIds: boundaryRecord ? [boundaryRecord.id] : [],
    });
    if (sysReqRecord) artifactIds.push(sysReqRecord.id);

    // ── 3.3 — Interface Contract Specification ────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '3.3');

    const contractsContent = {
      contracts: [],
    };

    const contractsRecord = writeAndIngestArtifact(engine, {
      artifactType: 'interface_contracts',
      workflowRunId: workflowRun.id,
      phaseId: '3',
      subPhaseId: '3.3',
      agentRole: 'systems_agent',
      content: contractsContent,
    });
    if (contractsRecord) artifactIds.push(contractsRecord.id);

    // ── 3.4 — Mirror and Menu ─────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '3.4');
    if (boundaryRecord) presentMirror(engine, boundaryRecord.id, 'system_boundary', boundaryContent);

    // ── 3.5 — Consistency Check and Approval ──────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '3.5');
    engine.eventBus.emit('phase_gate:pending', { phaseId: '3' });

    return { success: true, artifactIds };
  }
}
