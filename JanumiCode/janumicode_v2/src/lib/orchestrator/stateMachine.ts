/**
 * StateMachine — reads and writes current phase and sub-phase state.
 * Based on JanumiCode Spec v2.3, §4.
 *
 * All phases are mandatory. Execution is strictly sequential.
 * The Orchestrator cannot skip phases. Phases may only be revisited
 * through an explicit rollback authorized by the human.
 *
 * Phase 0.5 is conditional — reachable only from Phase 1 when a
 * prior_decision_override references a Phase-Gate-Certified Interface
 * Contract, API Definition, or Data Model. Transitions to Phase 2
 * on Phase Gate passage.
 */

import type { Database } from '../database/init';
import type { IntentLens, PhaseId, WorkflowRun, WorkflowRunStatus } from '../types/records';
import { PHASE_ORDER } from '../types/records';

// ── Valid Transitions ───────────────────────────────────────────────

/**
 * Standard forward transitions. Phase 0.5 has special rules.
 * Key: current phase → Value: set of valid next phases.
 */
const FORWARD_TRANSITIONS: Record<PhaseId, PhaseId[]> = {
  '0':   ['1'],
  '0.5': ['1', '2'],       // Can return to 1 ("revise override") or proceed to 2
  '1':   ['0.5', '2'],     // 0.5 only if prior_decision_override triggered
  '2':   ['3'],
  '3':   ['4'],
  '4':   ['5'],
  '5':   ['6'],
  '6':   ['7'],
  '7':   ['8'],
  '8':   ['9'],
  '9':   ['10'],
  '10':  [],                // Terminal
};

export interface TransitionResult {
  success: boolean;
  error?: string;
  previousPhase: PhaseId | null;
  newPhase: PhaseId;
}

export class StateMachine {
  constructor(private readonly db: Database) {}

  // ── Workflow Run lifecycle ──────────────────────────────────────

  /**
   * Create a new Workflow Run and set it to Phase 0.
   */
  createWorkflowRun(run: {
    id: string;
    workspace_id: string;
    janumicode_version_sha: string;
  }): WorkflowRun {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO workflow_runs (
        id, workspace_id, janumicode_version_sha, initiated_at,
        status, current_phase_id
      ) VALUES (?, ?, ?, ?, 'initiated', '0')
    `).run(run.id, run.workspace_id, run.janumicode_version_sha, now);

    return {
      id: run.id,
      workspace_id: run.workspace_id,
      janumicode_version_sha: run.janumicode_version_sha,
      initiated_at: now,
      completed_at: null,
      status: 'initiated',
      current_phase_id: '0',
      current_sub_phase_id: null,
      raw_intent_record_id: null,
      scope_classification_ref: null,
      compliance_context_ref: null,
      cross_run_impact_triggered: false,
      intent_lens: null,
    };
  }

  /**
   * Get the current Workflow Run state.
   */
  getWorkflowRun(runId: string): WorkflowRun | null {
    const row = this.db.prepare(
      'SELECT * FROM workflow_runs WHERE id = ?'
    ).get(runId) as Record<string, unknown> | undefined;

    if (!row) return null;

    return {
      id: row.id as string,
      workspace_id: row.workspace_id as string,
      janumicode_version_sha: row.janumicode_version_sha as string,
      initiated_at: row.initiated_at as string,
      completed_at: (row.completed_at as string) || null,
      status: row.status as WorkflowRunStatus,
      current_phase_id: (row.current_phase_id as PhaseId) || null,
      current_sub_phase_id: (row.current_sub_phase_id as string) || null,
      raw_intent_record_id: (row.raw_intent_record_id as string) || null,
      scope_classification_ref: (row.scope_classification_ref as string) || null,
      compliance_context_ref: (row.compliance_context_ref as string) || null,
      cross_run_impact_triggered: !!(row.cross_run_impact_triggered as number),
      intent_lens: (row.intent_lens as IntentLens) || null,
      decomposition_budget_calls_used: (row.decomposition_budget_calls_used as number) ?? 0,
      decomposition_fr_calls_used: (row.decomposition_fr_calls_used as number) ?? 0,
      decomposition_nfr_calls_used: (row.decomposition_nfr_calls_used as number) ?? 0,
      decomposition_max_depth_reached: (row.decomposition_max_depth_reached as number) ?? 0,
    };
  }

  // ── Phase transitions ──────────────────────────────────────────

  /**
   * Attempt to transition to the next phase.
   * Validates against FORWARD_TRANSITIONS.
   */
  advancePhase(runId: string, targetPhase: PhaseId): TransitionResult {
    const run = this.getWorkflowRun(runId);
    if (!run) {
      return {
        success: false,
        error: `Workflow run ${runId} not found`,
        previousPhase: null,
        newPhase: targetPhase,
      };
    }

    const currentPhase = run.current_phase_id;
    if (!currentPhase) {
      return {
        success: false,
        error: 'Workflow run has no current phase',
        previousPhase: null,
        newPhase: targetPhase,
      };
    }

    // Check if transition is valid
    const validTargets = FORWARD_TRANSITIONS[currentPhase];
    if (!validTargets || !validTargets.includes(targetPhase)) {
      return {
        success: false,
        error: `Invalid transition: ${currentPhase} → ${targetPhase}. Valid targets: [${validTargets?.join(', ') ?? 'none'}]`,
        previousPhase: currentPhase,
        newPhase: targetPhase,
      };
    }

    // Special validation for 0.5: only reachable from 1 when prior_decision_override triggered
    if (targetPhase === '0.5' && currentPhase === '1') {
      // The caller is responsible for setting cross_run_impact_triggered
      // before calling advancePhase. We just validate it's set.
      if (!run.cross_run_impact_triggered) {
        return {
          success: false,
          error: 'Phase 0.5 requires cross_run_impact_triggered to be set (prior_decision_override referencing a Phase-Gate-Certified Interface Contract, API Definition, or Data Model)',
          previousPhase: currentPhase,
          newPhase: targetPhase,
        };
      }
    }

    // Apply transition
    const status: WorkflowRunStatus = targetPhase === '10' ? 'in_progress' : 'in_progress';
    this.db.prepare(`
      UPDATE workflow_runs
      SET current_phase_id = ?, current_sub_phase_id = NULL, status = ?
      WHERE id = ?
    `).run(targetPhase, status, runId);

    return {
      success: true,
      previousPhase: currentPhase,
      newPhase: targetPhase,
    };
  }

  /**
   * Set the current sub-phase within the current phase.
   */
  setSubPhase(runId: string, subPhaseId: string): void {
    this.db.prepare(`
      UPDATE workflow_runs SET current_sub_phase_id = ? WHERE id = ?
    `).run(subPhaseId, runId);
  }

  /**
   * Set the intent lens classification on the workflow run.
   * Written by Phase 1.0a so downstream handlers can route lens-aware templates.
   */
  setIntentLens(runId: string, lens: IntentLens): void {
    this.db.prepare(`
      UPDATE workflow_runs SET intent_lens = ? WHERE id = ?
    `).run(lens, runId);
  }

  /**
   * Persist Wave 6 saturation-loop telemetry (LLM budget used + max
   * decomposition depth reached) so operators can inspect per-run
   * decomposition load without scanning the governed stream.
   */
  updateDecompositionTelemetry(
    runId: string,
    rootKind: 'fr' | 'nfr',
    kindCallsUsed: number,
    maxDepthReached: number,
  ): void {
    // Per-kind telemetry lives in its own column so a completed FR
    // saturation loop doesn't clobber NFR's baseline on resume (and
    // vice-versa). The aggregate `decomposition_budget_calls_used`
    // stays as a display-convenience sum, recomputed here.
    const kindCol = rootKind === 'nfr'
      ? 'decomposition_nfr_calls_used'
      : 'decomposition_fr_calls_used';
    const existing = this.db.prepare(
      `SELECT decomposition_fr_calls_used AS fr,
              decomposition_nfr_calls_used AS nfr,
              decomposition_max_depth_reached AS max_depth
         FROM workflow_runs WHERE id = ?`,
    ).get(runId) as { fr?: number; nfr?: number; max_depth?: number } | undefined;
    const fr = rootKind === 'fr' ? kindCallsUsed : (existing?.fr ?? 0);
    const nfr = rootKind === 'nfr' ? kindCallsUsed : (existing?.nfr ?? 0);
    const combinedMaxDepth = Math.max(existing?.max_depth ?? 0, maxDepthReached);
    this.db.prepare(`
      UPDATE workflow_runs
         SET ${kindCol} = ?,
             decomposition_budget_calls_used = ?,
             decomposition_max_depth_reached = ?
       WHERE id = ?
    `).run(kindCallsUsed, fr + nfr, combinedMaxDepth, runId);
  }

  /**
   * Mark the workflow run as completed.
   */
  completeWorkflowRun(runId: string): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE workflow_runs SET status = 'completed', completed_at = ? WHERE id = ?
    `).run(now, runId);
  }

  /**
   * Mark the workflow run as failed.
   */
  failWorkflowRun(runId: string): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE workflow_runs SET status = 'failed', completed_at = ? WHERE id = ?
    `).run(now, runId);
  }

  /**
   * Set the cross_run_impact_triggered flag.
   * Must be set before advancing to Phase 0.5.
   */
  setCrossRunImpactTriggered(runId: string, triggered: boolean): void {
    this.db.prepare(`
      UPDATE workflow_runs SET cross_run_impact_triggered = ? WHERE id = ?
    `).run(triggered ? 1 : 0, runId);
  }

  /**
   * Rollback to a prior phase. Validates the target is before the current phase.
   * Does NOT perform dependency closure rollback — that's the DependencyClosureResolver's job.
   */
  rollbackToPhase(runId: string, targetPhase: PhaseId): TransitionResult {
    const run = this.getWorkflowRun(runId);
    if (!run) {
      return {
        success: false,
        error: `Workflow run ${runId} not found`,
        previousPhase: null,
        newPhase: targetPhase,
      };
    }

    const currentPhase = run.current_phase_id;
    if (!currentPhase) {
      return {
        success: false,
        error: 'Workflow run has no current phase',
        previousPhase: null,
        newPhase: targetPhase,
      };
    }

    // Target must be before current in PHASE_ORDER
    const currentIdx = PHASE_ORDER.indexOf(currentPhase);
    const targetIdx = PHASE_ORDER.indexOf(targetPhase);

    if (targetIdx >= currentIdx) {
      return {
        success: false,
        error: `Rollback target ${targetPhase} must be before current phase ${currentPhase}`,
        previousPhase: currentPhase,
        newPhase: targetPhase,
      };
    }

    // Apply rollback
    this.db.prepare(`
      UPDATE workflow_runs
      SET current_phase_id = ?, current_sub_phase_id = NULL, status = 'in_progress'
      WHERE id = ?
    `).run(targetPhase, runId);

    return {
      success: true,
      previousPhase: currentPhase,
      newPhase: targetPhase,
    };
  }

  // ── Sub-Phase Execution Log ────────────────────────────────────

  /**
   * Log a sub-phase execution attempt.
   */
  logSubPhaseAttempt(entry: {
    id: string;
    workflow_run_id: string;
    phase_id: string;
    sub_phase_id: string;
    attempt_number: number;
  }): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO sub_phase_execution_log (
        id, workflow_run_id, phase_id, sub_phase_id,
        attempt_number, started_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'in_progress')
    `).run(
      entry.id, entry.workflow_run_id, entry.phase_id,
      entry.sub_phase_id, entry.attempt_number, now,
    );
  }

  /**
   * Complete a sub-phase execution attempt.
   */
  completeSubPhaseAttempt(
    attemptId: string,
    status: 'completed' | 'failed' | 'quarantined',
    loopStatus?: string,
  ): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE sub_phase_execution_log
      SET completed_at = ?, status = ?, loop_status = ?
      WHERE id = ?
    `).run(now, status, loopStatus ?? null, attemptId);
  }

  /**
   * Get the retry count for a sub-phase in the current run.
   */
  getRetryCount(workflowRunId: string, subPhaseId: string): number {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count FROM sub_phase_execution_log
      WHERE workflow_run_id = ? AND sub_phase_id = ?
    `).get(workflowRunId, subPhaseId) as { count: number } | undefined;

    return result?.count ?? 0;
  }
}
