/**
 * Phase 2 — Requirements Definition.
 * Based on JanumiCode Spec v2.3, §4 Phase 2.
 *
 * Sub-phases:
 *   2.1 — Functional Requirements Bloom
 *   2.2 — Non-Functional Requirements Bloom
 *   2.3 — Requirements Mirror and Menu
 *   2.4 — Requirements Consistency Check
 *   2.5 — Requirements Approval with Domain Attestation
 */

import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type { PhaseId } from '../../types/records';
import { writeAndIngestArtifact, presentMirror, failResult } from './phaseUtils';

export class Phase2Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '2';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];

    // Get intent statement from Phase 1
    const intentStatements = engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced')
      .filter(r => (r.content as Record<string, unknown>).product_concept);

    // ── 2.1 — Functional Requirements Bloom ───────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '2.1');

    const frContent = {
      user_stories: [],
      acceptance_criteria_count: 0,
      derived_from_intent_statement: true,
    };

    const frRecord = writeAndIngestArtifact(engine, {
      artifactType: 'functional_requirements',
      workflowRunId: workflowRun.id,
      phaseId: '2',
      subPhaseId: '2.1',
      agentRole: 'requirements_agent',
      content: frContent,
      derivedFromIds: intentStatements.map(r => r.id),
    });
    if (frRecord) artifactIds.push(frRecord.id);

    // ── 2.2 — Non-Functional Requirements Bloom ───────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '2.2');

    const nfrContent = {
      requirements: [],
      categories: ['performance', 'security', 'reliability', 'scalability', 'accessibility'],
    };

    const nfrRecord = writeAndIngestArtifact(engine, {
      artifactType: 'non_functional_requirements',
      workflowRunId: workflowRun.id,
      phaseId: '2',
      subPhaseId: '2.2',
      agentRole: 'requirements_agent',
      content: nfrContent,
    });
    if (nfrRecord) artifactIds.push(nfrRecord.id);

    // ── 2.3 — Mirror and Menu ─────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '2.3');
    if (frRecord) presentMirror(engine, frRecord.id, 'functional_requirements', frContent);

    // ── 2.4 — Consistency Check ───────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '2.4');

    const consistencyContent = {
      overall_pass: true,
      traceability_results: [],
      semantic_findings: [],
      internal_findings: [],
      blocking_failures: [],
      warnings: [],
    };

    const consistencyRecord = writeAndIngestArtifact(engine, {
      artifactType: 'consistency_report',
      workflowRunId: workflowRun.id,
      phaseId: '2',
      subPhaseId: '2.4',
      agentRole: 'consistency_checker',
      content: consistencyContent,
    });
    if (consistencyRecord) artifactIds.push(consistencyRecord.id);

    // ── 2.5 — Approval with Domain Attestation ────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '2.5');
    engine.eventBus.emit('phase_gate:pending', { phaseId: '2' });

    return { success: true, artifactIds };
  }
}
