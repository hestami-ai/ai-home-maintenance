/**
 * Cycle controller sub-phase — decision logic.
 *
 * Runs as the final sub-phase of Phase 9 (9.9). Decides whether to:
 *   - terminate the workflow (no coherence failures, or no progress, or
 *     ceiling hit)
 *   - loop back to the appropriate upstream phase (6, 7, or 8) to fill
 *     the gaps surfaced by packet_synthesis coherence failures
 *
 * The back-transition is signaled via PhaseResult.cycleRestartTo, which
 * the orchestrator's main loop honors by calling
 * StateMachine.cycleRestartPhase.
 *
 * Routing priority: the EARLIEST upstream phase that has unresolved
 * failures wins. The natural cascade is:
 *   - P1 / P6 failures (no user story, no component contract) → Phase 6
 *   - P3 failures (orphan AC, no test case) → Phase 7
 *   - P4 / P5 failures (no eval criterion) → Phase 8
 * If multiple failure classes exist, route to the earliest phase that
 * could fix any of them — subsequent cycles will progress further down
 * the cascade as gaps close.
 *
 * Ceiling: if `current_cycle_number + 1 > max_cycles_per_release`, the
 * controller terminates with `ceiling_hit` instead of looping. No
 * operator mirror in this push — that's b.4-mirrors.
 *
 * See docs/design/iterative-implementation-backlog.md §4 and
 * docs/design/implementation-packet-synthesis.md §5.
 */

import { getLogger } from '../../logging';
import type { OrchestratorEngine } from '../orchestratorEngine';
import type {
  CycleIterationContent,
  PacketSynthesisFailureContent,
  PhaseId,
  WorkflowRun,
} from '../../types/records';

/** Default ceiling — operator can override via `--max-cycles-per-release` (CLI plumbing is b.4-mirrors). */
const DEFAULT_MAX_CYCLES_PER_RELEASE = 5;

/**
 * Backlog mirror — placeholder.
 *
 * The iterative-implementation-backlog design specifies a separate mirror
 * that triggers AFTER the last non-Backlog release saturates AND Backlog
 * records exist. It asks the operator whether to iterate the Backlog
 * "release" as its own cycle pass. The default is no (leave as documented
 * gap).
 *
 * Today this mirror would never fire because release-major iteration
 * (cycling per-release rather than per-coherence-failure) is not yet
 * implemented. The cycle_controller currently loops on coherence failures
 * across the whole governed stream, not within a specific release. When
 * release-major iteration lands, this stub should be replaced with a
 * real mirror at the end of each non-Backlog release's saturation. For
 * now, calling this is a no-op — kept here so the design surface is
 * discoverable from the code.
 *
 * See docs/design/iterative-implementation-backlog.md §7 "Backlog release".
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function backlogMirrorStub(_ctx: CycleControllerContext): void {
  // Intentionally empty. Implementation deferred until release-major
  // iteration is plumbed (separate effort from b.4).
}

export interface CycleControllerContext {
  workflowRun: WorkflowRun;
  engine: OrchestratorEngine;
}

export type CycleTerminationReason = CycleIterationContent['termination_reason'];

export interface CycleControllerResult {
  recordId: string;
  termination_reason: CycleTerminationReason;
  /**
   * When set, the orchestrator back-transitions the workflow to this
   * phase via StateMachine.cycleRestartPhase. The Phase 9 handler
   * surfaces this on its PhaseResult.cycleRestartTo so the orchestrator
   * main loop sees it.
   */
  cycleRestartTo?: PhaseId;
  /**
   * Set true when the operator selected `abort` at the ceiling mirror.
   * Phase 9's wrapping handler returns success:false in this case so
   * the orchestrator main loop logs the failure and halts.
   */
  abort?: boolean;
}

/**
 * Examine the latest packet_synthesis_failure record (if any) and
 * decide where the next cycle should resume from. Returns null when
 * no failures exist (terminate the run).
 */
function decideRestartTarget(
  ctx: CycleControllerContext,
): { target: PhaseId; reason: string } | null {
  const failures = ctx.engine.writer.getRecordsByType(ctx.workflowRun.id, 'packet_synthesis_failure');
  if (failures.length === 0) return null;
  // Take the most-recent failure record — the synthesizer writes one
  // per pass, and a coherent later pass would have left this stream
  // empty for the current cycle.
  const latest = failures[failures.length - 1].content as unknown as PacketSynthesisFailureContent;
  if (!latest || latest.total_blocking_failures === 0) return null;

  // Tally failure codes across all packets.
  const codes = new Set<string>();
  for (const list of Object.values(latest.failures_by_packet ?? {})) {
    for (const item of list) {
      const code = item.split(':')[0] ?? '';
      if (code) codes.add(code);
    }
  }
  for (const code of Object.keys(latest.cross_packet_failures ?? {})) codes.add(code);

  // Phase 6 has the heaviest leverage — fix orphan stories / missing
  // component contract first, because those changes typically generate
  // new tasks that themselves need tests + evals.
  if (codes.has('P1_NO_USER_STORY') || codes.has('P6_COMPONENT_CONTRACT_MISSING') || codes.has('C2_ATOMIC_TASK_HAS_NO_PACKET')) {
    return { target: '6', reason: 'orphan story or missing component contract — route to Phase 6 task delta' };
  }
  if (codes.has('P3_AC_NO_TEST')) {
    return { target: '7', reason: 'AC with no test case — route to Phase 7 test delta' };
  }
  if (codes.has('P4_USER_STORY_NO_EVAL') || codes.has('P5_NFR_NO_EVAL')) {
    return { target: '8', reason: 'US/NFR with no eval criterion — route to Phase 8 eval delta' };
  }
  // Other failure modes (P2 — defensive, P7 — invented references)
  // are usually upstream-data bugs that no delta cycle will fix.
  // Terminate with a non-blocking warning rather than loop forever.
  return null;
}

/**
 * Present the ceiling mirror to the operator and translate their choice
 * into a CycleControllerResult-shaped outcome. Auto-approve mode returns
 * synthetic resolution → default "accept and advance".
 */
async function presentCeilingMirror(
  ctx: CycleControllerContext,
  target: { target: PhaseId; reason: string },
  cycleNumber: number,
  maxCycles: number,
): Promise<{ outcome: 'extend' | 'accept' | 'abort'; extendBy?: number }> {
  const { workflowRun, engine } = ctx;
  const bundleId = `cycle-ceiling-${workflowRun.id}-${cycleNumber}`;
  const bundleRec = engine.writer.writeRecord({
    record_type: 'decision_bundle_presented',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '9',
    sub_phase_id: 'cycle_controller',
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [],
    content: {
      kind: 'decision_bundle',
      bundle_id: bundleId,
      bundle_type: 'menu_decision',
      title: 'Cycle ceiling reached',
      context: `The packet_synthesis coherence verifier still has unresolved failures after ${cycleNumber} cycle(s) (max ${maxCycles}). Failure cluster: ${target.reason}. Pick how to proceed.`,
      menu: {
        question: 'How should the workflow proceed?',
        multi_select: false,
        allow_free_text: false,
        options: [
          { id: 'extend', label: 'Extend ceiling by 3 cycles', description: 'Raise max_cycles_per_release by 3 and try the delta loop again.' },
          { id: 'accept', label: 'Accept and advance (default)', description: 'Terminate this iteration, write a ceiling_hit_accepted marker, proceed to Phase 10. Remaining gaps stay as documented coverage holes.', recommended: true },
          { id: 'abort', label: 'Abort the workflow run', description: 'Fail the run. Use this when the coherence failures point at a deeper upstream defect that needs human triage.' },
        ],
      },
    } as Record<string, unknown>,
  });
  engine.eventBus.emit('menu:presented', { menuId: bundleId, options: ['extend', 'accept', 'abort'] });

  const resolution = await engine.pauseForDecision(workflowRun.id, bundleRec.id, 'decision_bundle');
  const selections = resolution.payload?.menu_selections as Array<{ option_id?: string }> | undefined;
  const choice = selections?.[0]?.option_id;
  if (choice === 'extend') return { outcome: 'extend', extendBy: 3 };
  if (choice === 'abort') return { outcome: 'abort' };
  // Default (no selection / auto-approve / explicit accept).
  return { outcome: 'accept' };
}

export async function runCycleControllerSubPhase(
  ctx: CycleControllerContext,
  options: {
    atomicLeavesProduced: number;
    deferredLeavesRemaining: number;
  } = { atomicLeavesProduced: 0, deferredLeavesRemaining: 0 },
): Promise<CycleControllerResult> {
  const { workflowRun, engine } = ctx;
  engine.stateMachine.setSubPhase(workflowRun.id, 'cycle_controller');
  const logger = getLogger();

  const cycleNumber = workflowRun.current_cycle_number ?? 0;
  const releaseOrdinal = workflowRun.current_release_ordinal ?? null;
  const maxCycles = workflowRun.max_cycles_per_release ?? DEFAULT_MAX_CYCLES_PER_RELEASE;
  const startedAt = new Date().toISOString();

  // Decide.
  let termination: CycleTerminationReason = 'frontier_empty';
  let cycleRestartTo: PhaseId | undefined;
  let abort = false;

  const target = decideRestartTarget(ctx);
  if (!target) {
    termination = 'frontier_empty';
  } else if (cycleNumber + 1 > maxCycles) {
    // Ceiling would be hit. Surface to operator (or auto-resolve in
    // auto-approve mode). See implementation-packet-synthesis design §5.
    const decision = await presentCeilingMirror(ctx, target, cycleNumber, maxCycles);
    if (decision.outcome === 'extend' && decision.extendBy) {
      // Raise the ceiling, then loop as if ceiling had not been hit.
      const newMax = maxCycles + decision.extendBy;
      engine.db.prepare(
        `UPDATE workflow_runs SET max_cycles_per_release = ? WHERE id = ?`,
      ).run(newMax, workflowRun.id);
      logger.info('workflow', 'cycle_controller: operator extended ceiling — looping', {
        workflow_run_id: workflowRun.id,
        cycle_number: cycleNumber,
        new_max: newMax,
        target_phase: target.target,
      });
      termination = 'frontier_empty';      // placeholder for the ongoing loop
      cycleRestartTo = target.target;
    } else if (decision.outcome === 'abort') {
      termination = 'phase_failure';
      abort = true;
      logger.warn('workflow', 'cycle_controller: operator aborted workflow at ceiling mirror', {
        workflow_run_id: workflowRun.id,
        cycle_number: cycleNumber,
      });
    } else {
      // accept (default; auto-approve also lands here).
      termination = 'ceiling_hit_accepted';
      logger.info('workflow', 'cycle_controller: ceiling accepted — proceeding to Phase 10 with remaining gaps documented', {
        workflow_run_id: workflowRun.id,
        cycle_number: cycleNumber,
        unresolved_reason: target.reason,
      });
    }
  } else if (cycleNumber >= 1 && options.atomicLeavesProduced === 0) {
    // Delta cycle produced no new atomic leaves AND coherence still
    // fails — looping again will just repeat the same failures. Stop.
    termination = 'zero_progress';
    logger.warn('workflow', 'cycle_controller: zero progress this cycle — terminating', {
      workflow_run_id: workflowRun.id,
      cycle_number: cycleNumber,
      reason: target.reason,
    });
  } else {
    // Loop. termination_reason on the persisted record is the planned
    // outcome of this controller invocation — for an ongoing loop we
    // use 'frontier_empty' as a placeholder (the iteration is "complete
    // as far as this controller is concerned"; the NEXT cycle's
    // controller will write its own record). The cycleRestartTo field
    // is what actually drives the loop.
    termination = 'frontier_empty';
    cycleRestartTo = target.target;
    logger.info('workflow', 'cycle_controller: looping', {
      workflow_run_id: workflowRun.id,
      cycle_number: cycleNumber,
      target_phase: target.target,
      reason: target.reason,
    });
  }

  const content: CycleIterationContent = {
    kind: 'cycle_iteration',
    schemaVersion: '1.0',
    release_id: null,
    release_ordinal: releaseOrdinal,
    cycle_number: cycleNumber,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    termination_reason: termination,
    atomic_leaves_produced: options.atomicLeavesProduced,
    deferred_leaves_remaining: options.deferredLeavesRemaining,
  };
  const record = engine.writer.writeRecord({
    record_type: 'cycle_iteration',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '9',
    sub_phase_id: 'cycle_controller',
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [],
    content: content as unknown as Record<string, unknown>,
  });

  return { recordId: record.id, termination_reason: termination, cycleRestartTo, abort };
}
