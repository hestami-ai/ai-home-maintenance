/**
 * DecisionRouter — translates webview decision messages into engine state
 * changes. Called by GovernedStreamViewProvider when the user clicks
 * Approve/Reject/Submit on a Mirror, Menu, or Phase Gate card.
 *
 * Responsibilities:
 *   1. Write a `decision_trace` record so the decision is auditable.
 *   2. Write the typed follow-up record (mirror_approved, mirror_rejected,
 *      mirror_edited, phase_gate_approved, etc.) so the recordsStore can
 *      mark the surface as resolved.
 *   3. Resolve the pending decision in the engine (unblocks the awaiting
 *      phase handler that called pauseForDecision).
 *   4. For phase_gate_approval, advance to the next phase and kick off
 *      its execution.
 */

import type { OrchestratorEngine, DecisionResolution } from './orchestratorEngine';
import type { PhaseId, RecordType } from '../types/records';
import { PHASE_ORDER } from '../types/records';
import { getLogger } from '../logging';

export interface InboundDecision {
  /** Record id of the surface being resolved (mirror_presented / menu_presented / phase_gate_evaluation). */
  recordId: string;
  /** Decision type — matches the spec's DecisionType union. */
  type:
    | 'mirror_approval'
    | 'mirror_rejection'
    | 'mirror_edit'
    | 'menu_selection'
    | 'phase_gate_approval'
    | 'phase_gate_rejection'
    | 'system_proposal_approval'
    | 'system_proposal_rejection';
  /** Decision-type-specific payload (e.g. selected option ids, edited content). */
  payload?: Record<string, unknown>;
}

export class DecisionRouter {
  constructor(private readonly engine: OrchestratorEngine) {}

  route(runId: string, decision: InboundDecision): void {
    const versionSha = this.engine.janumiCodeVersionSha;
    const writer = this.engine.writer;

    // 1. Write the decision_trace record.
    writer.writeRecord({
      record_type: 'decision_trace',
      schema_version: '1.0',
      workflow_run_id: runId,
      janumicode_version_sha: versionSha,
      derived_from_record_ids: [decision.recordId],
      content: {
        decision_type: decision.type,
        target_record_id: decision.recordId,
        payload: decision.payload ?? {},
      },
    });

    // 2. Write the typed follow-up record.
    const followUpType = this.followUpRecordType(decision.type);
    if (followUpType) {
      writer.writeRecord({
        record_type: followUpType,
        schema_version: '1.0',
        workflow_run_id: runId,
        janumicode_version_sha: versionSha,
        derived_from_record_ids: [decision.recordId],
        content: {
          target_record_id: decision.recordId,
          payload: decision.payload ?? {},
        },
      });
    }

    // 3. Resolve the pending decision.
    const resolution: DecisionResolution = {
      type: decision.type,
      payload: decision.payload,
    };
    const resolved = this.engine.resolveDecision(decision.recordId, resolution);
    if (!resolved) {
      getLogger().warn('decision', 'No pending decision found for record', {
        recordId: decision.recordId,
        type: decision.type,
      });
    }

    // 4. Phase Gate approval triggers next phase.
    if (decision.type === 'phase_gate_approval') {
      const next = this.computeNextPhase(runId);
      if (next) {
        const ok = this.engine.advanceToNextPhase(runId, next);
        if (ok) {
          // Fire-and-forget the next phase. Errors flow through the eventBus.
          this.engine.executeCurrentPhase(runId).catch(err => {
            this.engine.eventBus.emit('error:occurred', {
              message: `Phase ${next} execution failed: ${err}`,
              context: runId,
            });
          });
        }
      } else {
        // No next phase — workflow complete.
        this.engine.stateMachine.completeWorkflowRun(runId);
        this.engine.eventBus.emit('workflow:completed', { workflowRunId: runId });
      }
    }
  }

  private followUpRecordType(type: InboundDecision['type']): RecordType | null {
    switch (type) {
      case 'mirror_approval': return 'mirror_approved';
      case 'mirror_rejection': return 'mirror_rejected';
      case 'mirror_edit': return 'mirror_edited';
      case 'phase_gate_approval': return 'phase_gate_approved';
      case 'phase_gate_rejection': return 'phase_gate_rejected';
      case 'menu_selection':
      case 'system_proposal_approval':
      case 'system_proposal_rejection':
        return null; // captured solely by the decision_trace record
    }
  }

  private computeNextPhase(runId: string): PhaseId | null {
    const run = this.engine.stateMachine.getWorkflowRun(runId);
    if (!run?.current_phase_id) return null;
    const idx = PHASE_ORDER.indexOf(run.current_phase_id);
    if (idx < 0 || idx >= PHASE_ORDER.length - 1) return null;
    return PHASE_ORDER[idx + 1];
  }
}
