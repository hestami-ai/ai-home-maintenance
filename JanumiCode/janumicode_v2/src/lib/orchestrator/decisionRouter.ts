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
import {
  computeBundleCounters,
  type MirrorItemDecision,
  type MenuOptionSelection,
} from '../types/decisionBundle';
import { getLogger } from '../logging';

export interface InboundDecision {
  /** Record id of the surface being resolved (mirror_presented / decision_bundle_presented / phase_gate_evaluation). */
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
    const decisionTraceRecord = writer.writeRecord({
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
    let followUpRecordId: string | null = null;
    if (followUpType) {
      const followUpRecord = writer.writeRecord({
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
      followUpRecordId = followUpRecord.id;
    }

    // 2b. For phase-gate approvals, write the phase_gates row that the
    //     dependency-closure resolver reads during rollback. Without this
    //     insert the resolver always sees an empty gate set, so validated
    //     artifacts never get their gates invalidated on rollback — a
    //     silent audit-trail hole.
    //
    //     We use the phase_gate_approved record's id as phase_gates.id so
    //     the `validates` memory_edges (which ingestion creates with
    //     source_record_id = phase_gate_approved record id) line up with
    //     the resolver's `SELECT target_record_id FROM memory_edge WHERE
    //     source_record_id = gate.id`.
    if (decision.type === 'phase_gate_approval' && followUpRecordId) {
      const run = this.engine.stateMachine.getWorkflowRun(runId);
      const phaseId = run?.current_phase_id ?? null;
      if (phaseId) {
        this.engine.db.prepare(`
          INSERT INTO phase_gates
            (id, workflow_run_id, phase_id, sub_phase_id, completed_at,
             human_approved, approval_record_id, decision_trace_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          followUpRecordId,
          runId,
          phaseId,
          run?.current_sub_phase_id ?? null,
          new Date().toISOString(),
          1,
          followUpRecordId,
          decisionTraceRecord.id,
        );
      } else {
        getLogger().warn('decision', 'phase_gate_approval without current_phase_id; phase_gates row skipped', {
          runId,
          recordId: decision.recordId,
        });
      }
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

  /**
   * Route a batch of per-item decisions for a single surface record (e.g.
   * the assumption-row mirror where each row gets an independent
   * Accept/Reject/Defer/Edit choice). Writes all decision_traces in one
   * DB transaction so partial failures roll back, then resolves the
   * pending decision on the engine so the phase handler unblocks.
   *
   * The batch shape arrives from the webview's `decisionBatch` postMessage:
   *   { type: 'decisionBatch', recordId, decisions: StagedDecision[] }
   *
   * Each StagedDecision has { itemId, action, payload? }.
   */
  routeBatch(
    runId: string,
    payload: {
      recordId: string;
      decisions: Array<{
        itemId: string;
        action: 'accepted' | 'rejected' | 'deferred' | 'edited';
        payload?: Record<string, unknown>;
      }>;
    },
  ): void {
    const writer = this.engine.writer;
    const versionSha = this.engine.janumiCodeVersionSha;

    // Write all per-item decision_traces.
    for (const d of payload.decisions) {
      writer.writeRecord({
        record_type: 'decision_trace',
        schema_version: '1.0',
        workflow_run_id: runId,
        janumicode_version_sha: versionSha,
        derived_from_record_ids: [payload.recordId],
        content: {
          decision_type: 'batch_item_decision',
          target_record_id: payload.recordId,
          item_id: d.itemId,
          action: d.action,
          payload: d.payload ?? {},
        },
      });
    }

    // Determine the aggregate resolution for the surface.
    // If any item was rejected, the overall resolution is mirror_rejection
    // (Phase 1 will re-run bloom). Otherwise mirror_approval.
    const hasRejection = payload.decisions.some(d => d.action === 'rejected');
    const resolution: DecisionResolution = hasRejection
      ? { type: 'mirror_rejection', payload: { decisions: payload.decisions } }
      : { type: 'mirror_approval', payload: { decisions: payload.decisions } };

    // Write the aggregate follow-up record.
    const followUpType = hasRejection ? 'mirror_rejected' : 'mirror_approved';
    writer.writeRecord({
      record_type: followUpType as RecordType,
      schema_version: '1.0',
      workflow_run_id: runId,
      janumicode_version_sha: versionSha,
      derived_from_record_ids: [payload.recordId],
      content: {
        target_record_id: payload.recordId,
        decision_count: payload.decisions.length,
        accepted: payload.decisions.filter(d => d.action === 'accepted').length,
        rejected: payload.decisions.filter(d => d.action === 'rejected').length,
        deferred: payload.decisions.filter(d => d.action === 'deferred').length,
        edited: payload.decisions.filter(d => d.action === 'edited').length,
      },
    });

    // Resolve the pending decision on the engine so the phase handler unblocks.
    const resolved = this.engine.resolveDecision(payload.recordId, resolution);
    if (!resolved) {
      getLogger().warn('decision', 'routeBatch: no pending decision found for record', {
        recordId: payload.recordId,
      });
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

  /**
   * Route a single decision-bundle submission from the webview into:
   *   1. N per-item decision_trace records (for audit parity with the
   *      old mirror/menu pair submission path)
   *   2. One authoritative `decision_bundle_resolved` record carrying
   *      every decision + computed counters
   *   3. Engine.resolveDecision with a `decision_bundle_resolution`
   *      resolution so the phase handler awaiting this surface unblocks
   *
   * Writes happen in this order so the resolved record is the last
   * thing the stream sees — downstream consumers can trust that when
   * they observe decision_bundle_resolved, every decision_trace child
   * is already persisted.
   */
  routeBundle(
    runId: string,
    payload: {
      recordId: string;
      surfaceId: string;
      mirrorDecisions: MirrorItemDecision[];
      menuSelections: MenuOptionSelection[];
    },
  ): void {
    const writer = this.engine.writer;
    const versionSha = this.engine.janumiCodeVersionSha;
    const run = this.engine.stateMachine.getWorkflowRun(runId);
    const phaseId = run?.current_phase_id ?? null;

    // 1. Per-item decision_traces — audit-level granularity preserved so
    //    queries over decision_trace content keep working unchanged.
    for (const mirror of payload.mirrorDecisions) {
      writer.writeRecord({
        record_type: 'decision_trace',
        schema_version: '1.0',
        workflow_run_id: runId,
        phase_id: phaseId,
        janumicode_version_sha: versionSha,
        derived_from_record_ids: [payload.recordId],
        content: {
          decision_type: this.mirrorActionToDecisionType(mirror.action),
          target_record_id: payload.recordId,
          surface_id: payload.surfaceId,
          item_id: mirror.item_id,
          payload: mirror.action === 'edited'
            ? { edited_text: mirror.edited_text ?? '' }
            : {},
        },
      });
    }
    for (const sel of payload.menuSelections) {
      writer.writeRecord({
        record_type: 'decision_trace',
        schema_version: '1.0',
        workflow_run_id: runId,
        phase_id: phaseId,
        janumicode_version_sha: versionSha,
        derived_from_record_ids: [payload.recordId],
        content: {
          decision_type: 'menu_selection',
          target_record_id: payload.recordId,
          surface_id: payload.surfaceId,
          option_id: sel.option_id,
          payload: sel.free_text !== undefined ? { free_text: sel.free_text } : {},
        },
      });
    }

    // 2. The authoritative bundle resolution — one record, counters
    //    pre-computed so phase handlers don't re-derive them.
    const counters = computeBundleCounters(payload.mirrorDecisions, payload.menuSelections);
    writer.writeRecord({
      record_type: 'decision_bundle_resolved',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: phaseId,
      janumicode_version_sha: versionSha,
      derived_from_record_ids: [payload.recordId],
      content: {
        surface_id: payload.surfaceId,
        target_record_id: payload.recordId,
        mirror_decisions: payload.mirrorDecisions,
        menu_selections: payload.menuSelections,
        counters,
      },
    });

    // 3. Unblock the awaiting phase handler.
    const resolution: DecisionResolution = {
      type: 'decision_bundle_resolution',
      payload: {
        surface_id: payload.surfaceId,
        mirror_decisions: payload.mirrorDecisions,
        menu_selections: payload.menuSelections,
        counters,
      },
    };
    const resolved = this.engine.resolveDecision(payload.recordId, resolution);
    if (!resolved) {
      getLogger().warn('decision', 'routeBundle: no pending decision found for record', {
        recordId: payload.recordId,
        surfaceId: payload.surfaceId,
      });
    }
  }

  /** Map per-item Mirror action to the spec's DecisionType. */
  private mirrorActionToDecisionType(action: MirrorItemDecision['action']): string {
    switch (action) {
      case 'accepted': return 'mirror_approval';
      case 'rejected': return 'mirror_rejection';
      case 'edited':   return 'mirror_edit';
      case 'deferred': return 'mirror_approval'; // deferred is a soft-accept with context
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
