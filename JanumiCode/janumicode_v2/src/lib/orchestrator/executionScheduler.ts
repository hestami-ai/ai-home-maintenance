/**
 * Wave R — Phase 9 release-plan execution scheduler.
 *
 * Replaces Phase 9's flat `for (const task of orderedTasks) { ... }` with
 * a wave-based scheduler that:
 *   - slices the leaf-task set into ordered execution waves derived
 *     from the `release_plan` (one wave per release ordinal)
 *   - within each wave, runs leaves in dependency topo-sort
 *   - retries each leaf up to `leaf_retry_budget` times with augmented
 *     context (prior reasoning_review flaws + test failures)
 *   - quarantines on retry exhaustion (does NOT block the wave)
 *   - runs a wave gate at the end of each wave (auto-approve permitted
 *     for unattended runs)
 *   - rolls back the wave's writes via a captured workspace snapshot
 *     when the gate is rejected
 *   - finally runs a deferred-batch wave to retry every quarantined
 *     leaf with prior trace context
 *
 * See docs/waveR_phase9_release_execution.md.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getLogger } from '../logging';
import type { OrchestratorEngine } from './orchestratorEngine';
import type { GovernedStreamWriter } from './governedStreamWriter';
import type { GovernedStreamRecord, ImplementationPacketContent } from '../types/records';
import type {
  ExecutionWaveCompletedContent,
  ExecutionWaveStartedContent,
  ExecutionWaveKind,
  QuarantineAttemptEntry,
  TaskQuarantineContent,
} from '../types/records';
import { formatPacketAsExecutorContext } from './phases/packetSynthesis/packetContextFormatter';
import type { ExecutionContextBuilder, ImplementationTask as CtxTask } from './executionContextBuilder';
import type { ExecutorAgent, ExecutionTask, ExecutionResult } from '../agents/executorAgent';
import type { ReasoningReviewFindingRecordContent } from '../types/records';
import {
  captureWaveSnapshot,
  diffWaveSnapshots,
  type FileSnapshot,
  type WaveDiffSummary,
} from './workspaceSnapshot';
import { LeafTestRunner, type LeafTestRunnerConfig, type LeafTestRunResult } from './leafTestRunner';
import { resolveGateCommands, type GateCommand } from './gateCommands';
import { runGateCommands } from './gateRunner';
import type { ReconEnforcement } from './phases/phase9Recon';
import { normalizeComponentDirForStack, resolveWriteScopeForComponent } from './phases/layoutContract';
import { QuarantineLedger } from './quarantineLedger';
import { WaveGate, type WaveGateOutcome } from './waveGate';
import { buildPhaseContextPacket } from './phases/dmrContext';
import type { PhaseContext } from './orchestratorEngine';
import type { ScaffoldManifest } from './phases/scaffoldSynthesis';
import type { ModuleOwnershipPlan } from './phases/moduleOwnershipPlanner';

// ── Public types ───────────────────────────────────────────────────

export interface SchedulerLeaf extends CtxTask {
  /** Inherited from Wave 6/8 — null = backlog (run in last wave). */
  release_id?: string | null;
  release_ordinal?: number | null;
  /** Wave 8 leaf node id when leaf came from a recursive tree. */
  _leaf_node_id?: string;
  /**
   * Set on the deterministic Phase-9 composition-root injection ("make it
   * run"). Grants a scoped exemption from the Lever-2b ROOT-CONFIG
   * protection — this leaf owns dependency installs / entrypoint scripts in
   * package.json — while the shared dir stays protected for it too.
   */
  _composition_root?: boolean;
}

export interface SchedulerReleaseEntry {
  release_id: string | null;
  release_ordinal: number | null;
  release_name?: string;
}

export interface ExecutionSchedulerConfig {
  leafRetryBudget: number;
  deferredRetryBudget: number;
  autoApproveWaveGates: boolean;
  testsPerLeaf: LeafTestRunnerConfig;
  /** Max repair sessions in the Stage-0.5 stabilization loop (default 2). */
  stabilizationBudget?: number;
}

/** Stage 0.5 — what the global gates still complain about after the closing
 *  act (composition root + bounded repair loop) gives up. Null = green / no
 *  detectable gates. Feeds the honest Phase-9 gate. */
export interface StabilizationResidual {
  failingGateNames: string[];
  repairAttempts: number;
  evidence: string;
}

export interface ExecutionScheduleResult {
  totalWaves: number;
  successfulLeafCount: number;
  quarantinedLeafCount: number;
  rescuedLeafCount: number;
  terminallyDeferredLeafCount: number;
  rejectedWaveCount: number;
  waveOutcomes: Array<{
    waveNumber: number;
    waveKind: ExecutionWaveKind;
    successful: number;
    quarantined: number;
    decision: WaveGateOutcome['decision'];
  }>;
  invocationIds: string[];
  /** Ids of every leaf that completed successfully across all waves
   *  (including rescued deferred leaves). Used by Phase 9.1 to emit a
   *  cross_run_modification for each completed Refactoring Task. */
  successfulLeafIds: string[];
  /** Stage 0.5 — unresolved global-gate failures after the closing act, or
   *  null when the workspace's gates are green / no detectable gates. */
  stabilizationResidual: StabilizationResidual | null;
}

// ── Scheduler ──────────────────────────────────────────────────────

export class ExecutionScheduler {
  private readonly leafTestRunner: LeafTestRunner;
  private readonly quarantineLedger: QuarantineLedger;
  private readonly waveGate: WaveGate;

  /**
   * Implementation packet lookup, keyed by task_id. When set (by Phase 9
   * after packet_synthesis runs), the per-leaf executor invocation
   * prepends the rendered packet context to stdinText so the executor
   * sees user stories, ACs, component contract, data models, APIs, test
   * cases, eval criteria, active constraints, and compliance items —
   * not just the bare task. See implementation-packet-synthesis.md §6.
   */
  private packetByTaskId: Map<string, ImplementationPacketContent> | null = null;

  /**
   * Lever 2a/2b — the scaffold manifest (resolved project profile, canonical
   * shared files, protected paths, conventions). When set (by Phase 9 after
   * scaffold_synthesis), the executor context lists the shared modules with
   * an "import, don't reinvent" directive, and the post-leaf guard quarantines
   * any leaf that writes into a protected path (the shared dir or root config).
   */
  private scaffoldManifest: ScaffoldManifest | null = null;

  /**
   * Tier-A module-ownership plan (Phase 9.0a). When set, each leaf's prompt
   * gets a two-sided "Shared Module Ownership" section — the modules this
   * task's component OWNS (produce at the canonical path) and CONSUMES (import
   * from the canonical specifier; do NOT reinvent) — and the wave scheduler
   * runs producer components before their consumers.
   */
  private ownershipPlan: ModuleOwnershipPlan | null = null;

  constructor(
    private readonly engine: OrchestratorEngine,
    private readonly writer: GovernedStreamWriter,
    private readonly executionContextBuilder: ExecutionContextBuilder,
    private readonly executorAgent: ExecutorAgent,
    private readonly artifacts: Parameters<ExecutionContextBuilder['buildTaskContext']>[3],
    private readonly config: ExecutionSchedulerConfig,
    private readonly generateId: () => string,
  ) {
    this.leafTestRunner = new LeafTestRunner(writer, config.testsPerLeaf);
    this.quarantineLedger = new QuarantineLedger(writer);
    this.waveGate = new WaveGate(engine);
  }

  /**
   * Inject the packet-by-task-id map. Called by Phase 9 after
   * packet_synthesis emits implementation_packet records. When set, the
   * scheduler prepends the rendered packet context to each leaf's stdin.
   */
  setPacketContext(packetByTaskId: Map<string, ImplementationPacketContent>): void {
    this.packetByTaskId = packetByTaskId;
  }

  /**
   * Inject the scaffold manifest (Lever 2a). Called by Phase 9 after
   * scaffold_synthesis. Drives the "import, don't reinvent" executor section
   * and the post-leaf write-scope guard.
   */
  /**
   * Stage 1+2 inc.2 — recon-authored enforcement substrate (per-area protected
   * paths, canonical modules, conventions). When set it SUPERSEDES the
   * (TS-shaped) scaffold manifest for the write-scope guard + executor
   * "import, don't reinvent" directives — the polyglot enforcement path.
   */
  private reconEnforcement: ReconEnforcement | null = null;
  setReconEnforcement(enforcement: ReconEnforcement): void {
    this.reconEnforcement = enforcement;
  }

  /** Protected paths in force — recon enforcement wins, else the scaffold manifest. */
  private effectiveProtectedPaths(): string[] {
    if (this.reconEnforcement) return this.reconEnforcement.protected_paths;
    return this.scaffoldManifest?.protected_paths ?? [];
  }

  /** Primary stack in force (recon wins, else scaffold profile, else node). */
  private effectiveStack(): string {
    return this.reconEnforcement?.primary_stack ?? this.scaffoldManifest?.profile.language ?? 'node';
  }

  /**
   * Resolve a leaf's write scope from its `component_id` using the stack's
   * directory convention. Phase 9 is the SOLE authority for component_id→dir —
   * it's the first phase that knows the stack — so the persisted (Phase-6,
   * pre-language) hyphenated `write_directory_paths` are a stale placeholder we
   * REPLACE here. With one resolution feeding every prompt site (orientation,
   * write-scope, snapshot, union), the dir is consistent and stack-correct, for
   * resume AND fresh. GREENFIELD ONLY — brownfield keeps the recon-detected real
   * directories. Returns null to leave the persisted paths untouched.
   */
  private resolveLeafWriteScope(leaf: SchedulerLeaf): string[] | null {
    return resolveWriteScopeForComponent({
      componentId: leaf.component_id,
      isCompositionRoot: !!leaf._composition_root,
      stack: this.effectiveStack(),
      // recon's workspace_kind is authoritative; else fall back to the scaffold
      // profile source (brownfield_detected ⇒ brownfield).
      workspaceKind: this.reconEnforcement?.workspace_kind,
      scaffoldSource: this.reconEnforcement ? undefined : this.scaffoldManifest?.profile.source,
    });
  }

  setScaffoldManifest(manifest: ScaffoldManifest): void {
    this.scaffoldManifest = manifest;
  }

  /** Inject the Tier-A module-ownership plan (Phase 9.0a). */
  setOwnershipPlan(plan: ModuleOwnershipPlan): void {
    this.ownershipPlan = plan;
  }

  /**
   * Render the two-sided "Shared Module Ownership" directive for a task's
   * component: the shared modules this component OWNS (it must produce them at
   * the canonical path so consumers can import them) and CONSUMES (import from
   * the canonical specifier — do NOT reinvent). This replaces the phantom
   * cross-component `read_directory_paths` guidance with real, single-home
   * import targets — the fix for divergent-duplicate modules. Empty string when
   * no plan or nothing applies to this component.
   */
  private renderOwnershipDirective(componentId: string | undefined): string {
    const plan = this.ownershipPlan;
    if (!plan || !componentId) return '';
    const owns = plan.shared_modules.filter((m) => m.owner_component_id === componentId);
    const consumes = plan.shared_modules.filter(
      (m) => m.owner_component_id !== componentId && m.consumer_component_ids.includes(componentId),
    );
    if (owns.length === 0 && consumes.length === 0) return '';

    const lines: string[] = ['## Shared Module Ownership (single-home — prevents divergent duplicates)', ''];
    if (owns.length > 0) {
      lines.push('Your component OWNS these shared modules — implement each at its canonical path so other components import (not re-create) it:');
      for (const m of owns) {
        lines.push(`- \`${m.basename}\` → produce at \`${m.canonical_path}\` (consumed by: ${m.consumer_component_ids.filter((c) => c !== componentId).join(', ') || 'others'})`);
      }
      lines.push('');
    }
    if (consumes.length > 0) {
      lines.push('Your task DEPENDS ON these shared modules owned elsewhere — IMPORT them; do NOT create your own copy:');
      for (const m of consumes) {
        const owner = m.owner_component_id === 'shared' ? 'the shared scaffold' : m.owner_component_id;
        // Stack-neutral: give the specifier + canonical path and let the agent
        // write the import in its own language's idiom (the specifier is already
        // stack-idiomatic — python dotted, rust crate::, ts @alias).
        lines.push(`- \`${m.basename}\` — import the existing shared module \`${m.import_specifier}\` (at \`${m.canonical_path}\`, owned by ${owner}) using your stack's import syntax`);
      }
      lines.push('');
    }
    lines.push('Do NOT invent a second implementation of any module above under your own directory.');
    return lines.join('\n');
  }

  /**
   * Stable-sort leaves so producer components precede their consumers, using a
   * component rank derived from the ownership plan's `ordering_edges` (Kahn —
   * owners get a lower rank than the components that depend on them). Pure
   * reordering; the subsequent topo-sort still enforces real task deps. A
   * dependency cycle among components degrades gracefully (tied ranks → stable
   * original order). No-op when no plan.
   */
  private biasLeavesByOwnership(leaves: SchedulerLeaf[]): SchedulerLeaf[] {
    const plan = this.ownershipPlan;
    if (!plan || plan.ordering_edges.length === 0) return leaves;

    const comps = new Set<string>();
    for (const l of leaves) if (l.component_id) comps.add(l.component_id);
    const indeg = new Map<string, number>();
    const out = new Map<string, string[]>();
    for (const c of comps) { indeg.set(c, 0); out.set(c, []); }
    for (const e of plan.ordering_edges) {
      if (!comps.has(e.before_component_id) || !comps.has(e.after_component_id)) continue;
      out.get(e.before_component_id)!.push(e.after_component_id);
      indeg.set(e.after_component_id, (indeg.get(e.after_component_id) ?? 0) + 1);
    }
    // Kahn rank: BFS layers from indegree-0 producers.
    const rank = new Map<string, number>();
    let frontier = [...comps].filter((c) => (indeg.get(c) ?? 0) === 0);
    let r = 0;
    const seen = new Set<string>();
    while (frontier.length > 0) {
      const next: string[] = [];
      for (const c of frontier) {
        if (seen.has(c)) continue;
        seen.add(c);
        rank.set(c, r);
        for (const m of out.get(c) ?? []) {
          const d = (indeg.get(m) ?? 0) - 1;
          indeg.set(m, d);
          if (d <= 0 && !seen.has(m)) next.push(m);
        }
      }
      frontier = next;
      r++;
    }
    const rankOf = (c: string | undefined): number => (c && rank.has(c) ? rank.get(c)! : Number.MAX_SAFE_INTEGER);
    // Stable sort: decorate with original index to preserve order within a rank.
    return leaves
      .map((l, i) => ({ l, i }))
      .sort((a, b) => (rankOf(a.l.component_id) - rankOf(b.l.component_id)) || (a.i - b.i))
      .map((x) => x.l);
  }

  async run(input: {
    workflowRunId: string;
    workspacePath: string;
    janumiCodeVersionSha: string;
    leaves: SchedulerLeaf[];
    releases: SchedulerReleaseEntry[];
    /** Stage 1+2: recon-authored per-area global gates. When present they
     *  supersede the stabilization loop's generic manifest-detection resolver. */
    globalGates?: GateCommand[];
  }): Promise<ExecutionScheduleResult> {
    const { workflowRunId, workspacePath, janumiCodeVersionSha, leaves, releases } = input;
    const logger = getLogger();

    // ── Leaf-level resume ───────────────────────────────────────────
    // Skip leaves that already PASSED in a prior (pre-resume) execution of
    // this run. Their implementation files persist on disk (a resume rolls
    // back DB records but not the workspace), so re-running them is wasted
    // work — and on a slow local executor, re-doing the ~half that already
    // succeeded is the difference between "picks up where it left off" and
    // "starts Phase 9 over".
    // The composition root is NOT a normal backlog leaf — it is the closing
    // act (Stage 0.5). Pull it out of the wave set so it runs AFTER the
    // deferred wave (its predecessors must all have had their last chance);
    // the old placement let it run in the backlog wave before deferred
    // rescues, inheriting their failures by construction.
    const closingLeaves = leaves.filter(l => l._composition_root);
    const normalLeaves = closingLeaves.length > 0 ? leaves.filter(l => !l._composition_root) : leaves;

    const priorDone = this.loadPriorSuccessfulLeafIds(workflowRunId);
    const skippedLeaves = priorDone.size > 0 ? normalLeaves.filter(l => priorDone.has(l.id)) : [];
    const leavesToRun = skippedLeaves.length > 0 ? normalLeaves.filter(l => !priorDone.has(l.id)) : normalLeaves;
    if (skippedLeaves.length > 0) {
      logger.info('workflow', 'Wave R: resume — skipping leaves that already succeeded', {
        skipped: skippedLeaves.length, remaining: leavesToRun.length,
      });
    }
    const seededSuccessIds = skippedLeaves.map(l => l.id);

    const waves = sliceLeavesIntoWaves(leavesToRun, releases);

    // Persist scheduling totals up front.
    this.updateRunTotals(workflowRunId, { total_execution_waves: waves.length });

    const result: ExecutionScheduleResult = {
      totalWaves: waves.length,
      successfulLeafCount: seededSuccessIds.length,
      quarantinedLeafCount: 0,
      rescuedLeafCount: 0,
      terminallyDeferredLeafCount: 0,
      rejectedWaveCount: 0,
      waveOutcomes: [],
      invocationIds: [],
      successfulLeafIds: [...seededSuccessIds],
      stabilizationResidual: null,
    };
    if (waves.length === 0) {
      logger.info('workflow', 'Wave R: no normal leaves to execute (all skipped or none); proceeding to closing act');
    }

    let waveNumber = 0;
    for (const wave of waves) {
      waveNumber++;
      const outcome = await this.runWave({
        wave,
        waveNumber,
        workflowRunId,
        workspacePath,
        janumiCodeVersionSha,
        retryBudget: this.config.leafRetryBudget,
        attemptHintBuilder: null,
      });
      result.successfulLeafCount += outcome.successCount;
      result.quarantinedLeafCount += outcome.quarantineCount;
      result.successfulLeafIds.push(...outcome.successfulLeafIds);
      result.invocationIds.push(...outcome.invocationIds);
      result.waveOutcomes.push({
        waveNumber,
        waveKind: wave.kind,
        successful: outcome.successCount,
        quarantined: outcome.quarantineCount,
        decision: outcome.gateDecision,
      });
      if (outcome.gateDecision === 'rejected') {
        result.rejectedWaveCount++;
        logger.warn('workflow', 'Wave R: wave rejected — workspace reverted; subsequent waves still run', {
          wave_number: waveNumber,
        });
      }
      this.updateRunTotals(workflowRunId, { current_execution_wave: waveNumber });
    }

    // Deferred-batch wave for any quarantined leaves.
    const pending = this.quarantineLedger.pendingForRun(workflowRunId);
    if (pending.length > 0) {
      logger.info('workflow', 'Wave R: starting deferred-batch wave', {
        leaves: pending.length,
      });
      waveNumber++;
      const idByLeaf = new Map<string, SchedulerLeaf>();
      for (const l of leaves) idByLeaf.set(l.id, l);
      const deferredLeaves = pending
        .map(p => idByLeaf.get(p.leaf_task_id))
        .filter((l): l is SchedulerLeaf => l !== undefined);
      const priorByLeaf = new Map<string, TaskQuarantineContent>(
        pending.map(p => [p.leaf_task_id, p]),
      );
      const outcome = await this.runWave({
        wave: {
          kind: 'deferred_batch',
          release_id: null,
          release_ordinal: null,
          release_name: 'Deferred batch',
          leaves: deferredLeaves,
        },
        waveNumber,
        workflowRunId,
        workspacePath,
        janumiCodeVersionSha,
        retryBudget: this.config.deferredRetryBudget,
        attemptHintBuilder: leafId => {
          const prior = priorByLeaf.get(leafId);
          return prior ? QuarantineLedger.buildAugmentedContext(prior) : null;
        },
      });
      // Mark rescued / terminally-deferred for each deferred leaf.
      for (const leaf of deferredLeaves) {
        const wasSuccess = outcome.successfulLeafIds.has(leaf.id);
        const additionalAttempts = outcome.attemptsByLeaf.get(leaf.id) ?? [];
        if (wasSuccess) {
          this.quarantineLedger.updateRescueStatus({
            workflowRunId,
            janumiCodeVersionSha,
            leafTaskId: leaf.id,
            rescueStatus: 'rescued',
            additionalAttempts,
            reason: 'rescued in deferred-batch wave',
          });
          result.rescuedLeafCount++;
          result.successfulLeafIds.push(leaf.id);
        } else {
          this.quarantineLedger.updateRescueStatus({
            workflowRunId,
            janumiCodeVersionSha,
            leafTaskId: leaf.id,
            rescueStatus: 'terminally_deferred',
            additionalAttempts,
            reason: 'failed in deferred-batch wave',
          });
          result.terminallyDeferredLeafCount++;
        }
      }
      result.invocationIds.push(...outcome.invocationIds);
      result.waveOutcomes.push({
        waveNumber,
        waveKind: 'deferred_batch',
        successful: outcome.successCount,
        quarantined: outcome.quarantineCount,
        decision: outcome.gateDecision,
      });
      result.totalWaves = waveNumber;
      this.updateRunTotals(workflowRunId, {
        current_execution_wave: waveNumber,
        total_execution_waves: waveNumber,
      });
    }

    this.updateRunTotals(workflowRunId, {
      quarantined_leaf_count: result.quarantinedLeafCount,
      terminally_deferred_leaf_count: result.terminallyDeferredLeafCount,
    });

    // ── Closing act (Stage 0.5) — runs AFTER every wave incl. deferred ──
    // 1. Composition root (wiring agent) — moved here from the backlog wave.
    // 2. Stabilization loop — run the workspace's global gates and, while red,
    //    launch a repair-mandated agent session with the failure evidence,
    //    re-run, bounded by stabilizationBudget; record the honest residual.
    await this.runClosingAct({
      closingLeaves, workflowRunId, workspacePath, janumiCodeVersionSha, waveNumber, result,
      globalGates: input.globalGates,
    });

    return result;
  }

  /**
   * Stage 0.5 closing act: composition-root wiring, then a bounded
   * gate→repair→re-gate stabilization loop over the workspace's GLOBAL gates.
   * Stack-agnostic: the gate commands come from the generic manifest-detection
   * resolver (Stage 1+2 swaps in recon-authored per-area gates without
   * touching this loop). No detectable gates ⇒ the loop is a no-op.
   */
  private async runClosingAct(input: {
    closingLeaves: SchedulerLeaf[];
    workflowRunId: string;
    workspacePath: string;
    janumiCodeVersionSha: string;
    waveNumber: number;
    result: ExecutionScheduleResult;
    globalGates?: GateCommand[];
  }): Promise<void> {
    const { closingLeaves, workflowRunId, workspacePath, janumiCodeVersionSha, result } = input;
    const logger = getLogger();
    let waveNumber = input.waveNumber;

    // 1. Composition-root wiring leaf(s), as their own wave after deferred.
    if (closingLeaves.length > 0) {
      waveNumber++;
      const outcome = await this.runWave({
        wave: {
          kind: 'single',
          release_id: null,
          release_ordinal: null,
          release_name: 'Composition root',
          leaves: closingLeaves,
        },
        waveNumber,
        workflowRunId,
        workspacePath,
        janumiCodeVersionSha,
        retryBudget: this.config.leafRetryBudget,
        attemptHintBuilder: null,
      });
      result.successfulLeafCount += outcome.successCount;
      result.quarantinedLeafCount += outcome.quarantineCount;
      result.successfulLeafIds.push(...outcome.successfulLeafIds);
      result.invocationIds.push(...outcome.invocationIds);
      result.totalWaves = waveNumber;
      result.waveOutcomes.push({
        waveNumber, waveKind: 'single',
        successful: outcome.successCount, quarantined: outcome.quarantineCount,
        decision: outcome.gateDecision,
      });
    }

    // 2. Stabilization loop over the GLOBAL gates. Prefer recon-authored
    // per-area gates (Stage 1+2); fall back to the generic manifest-detection
    // resolver (Stage 0.5) when recon produced none.
    const gates = (input.globalGates && input.globalGates.length > 0)
      ? input.globalGates
      : resolveGateCommands(workspacePath);
    if (gates.length === 0) {
      logger.info('workflow', 'Wave R: stabilization — no gates (recon empty + no detectable single-stack); skipping', {
        workflow_run_id: workflowRunId,
      });
      return;
    }
    const budget = this.config.stabilizationBudget ?? 2;
    logger.info('workflow', 'Wave R: stabilization loop starting', {
      workflow_run_id: workflowRunId, gates: gates.map(g => g.name), repair_budget: budget,
    });

    let summary = runGateCommands(workspacePath, gates);
    let repairAttempts = 0;
    while (!summary.allPassed && repairAttempts < budget) {
      repairAttempts++;
      logger.warn('workflow', 'Wave R: stabilization — global gates RED, launching repair session', {
        workflow_run_id: workflowRunId, attempt: repairAttempts,
        failing: summary.results.filter(r => !r.passed).map(r => r.gate.name),
      });
      const invId = await this.runStabilizationRepair({
        evidence: summary.failureEvidence, attempt: repairAttempts,
        workflowRunId, workspacePath, janumiCodeVersionSha,
      });
      if (invId) result.invocationIds.push(invId);
      summary = runGateCommands(workspacePath, gates);
    }

    if (summary.allPassed) {
      logger.info('workflow', 'Wave R: stabilization — global gates GREEN', {
        workflow_run_id: workflowRunId, repair_attempts: repairAttempts,
      });
      result.stabilizationResidual = null;
    } else {
      const failingGateNames = summary.results.filter(r => !r.passed).map(r => r.gate.name);
      logger.warn('workflow', 'Wave R: stabilization — gates still RED after budget (honest residual recorded)', {
        workflow_run_id: workflowRunId, repair_attempts: repairAttempts, failing: failingGateNames,
      });
      result.stabilizationResidual = {
        failingGateNames, repairAttempts, evidence: summary.failureEvidence.slice(0, 4000),
      };
    }
  }

  /**
   * Launch one repair-mandated executor session: the workspace fails its global
   * gates; here is the evidence; fix it and re-run the gates yourself until
   * green. Distinct from a feature leaf — the failing workspace IS the task.
   * Returns the invocation id, or null on a hard executor failure.
   */
  private async runStabilizationRepair(input: {
    evidence: string;
    attempt: number;
    workflowRunId: string;
    workspacePath: string;
    janumiCodeVersionSha: string;
  }): Promise<string | null> {
    const { evidence, attempt, workflowRunId, workspacePath, janumiCodeVersionSha } = input;
    const task: ExecutionTask = {
      id: `task-stabilization-repair-${attempt}`,
      taskType: 'standard',
      componentId: 'stabilization',
      componentResponsibility: 'Workspace stabilization: make the global verification gates pass.',
      description:
        'STABILIZATION REPAIR. The workspace fails its global verification gates (full output below). '
        + 'Investigate the failures, fix the code/configuration/dependencies that cause them, and re-run '
        + 'the gates yourself until they pass. Do not add features; only resolve what blocks the gates. '
        + 'Prefer the canonical shared modules and each component\'s existing public surface; do not '
        + 'rewrite component internals beyond what the failures require.',
      completionCriteria: [
        { criterionId: 'CC-STAB-001', description: 'The workspace global gates (typecheck + full test suite + build) all pass.' },
      ],
      writeDirectoryPaths: ['src'],
    };
    const stdin =
      `# Stabilization Repair (attempt ${attempt})\n\n`
      + `The workspace failed its global verification gates. Fix the workspace so every gate passes, `
      + `then verify by re-running the gates.\n\n## Failing gate evidence\n\n${evidence}\n`;
    try {
      const r = await this.executorAgent.execute(task, workflowRunId, stdin, workspacePath, janumiCodeVersionSha);
      return r.invocationId;
    } catch (err) {
      getLogger().warn('workflow', 'Wave R: stabilization repair session threw (continuing)', {
        workflow_run_id: workflowRunId, attempt, error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Leaf-level resume support: the ids of leaves that PASSED in any prior
   * execution of this run. Unioned from every `execution_wave_completed`
   * record's `successful_leaf_ids` across ALL versions — a resume rolls these
   * records back to `is_current_version=0`, but they remain in the DB and are
   * still the authority on what already succeeded (and the leaves' written
   * files persist on disk). Empty on a fresh run (no prior wave-completed
   * records), so this is naturally a no-op except on resume.
   */
  private loadPriorSuccessfulLeafIds(workflowRunId: string): Set<string> {
    const done = new Set<string>();
    try {
      const rows = this.engine.db.prepare(
        `SELECT content FROM governed_stream
          WHERE workflow_run_id = ? AND record_type = 'execution_wave_completed'`,
      ).all(workflowRunId) as Array<{ content: string }>;
      for (const r of rows) {
        try {
          const ids = (JSON.parse(r.content) as { successful_leaf_ids?: unknown }).successful_leaf_ids;
          if (Array.isArray(ids)) {
            for (const id of ids) if (typeof id === 'string') done.add(id);
          }
        } catch { /* skip unparseable */ }
      }
    } catch { /* table/schema drift — no skip */ }
    return done;
  }

  // ── per-wave loop ──────────────────────────────────────────────

  private async runWave(input: {
    wave: WaveSlice;
    waveNumber: number;
    workflowRunId: string;
    workspacePath: string;
    janumiCodeVersionSha: string;
    retryBudget: number;
    attemptHintBuilder: ((leafId: string) => string | null) | null;
  }): Promise<{
    successCount: number;
    quarantineCount: number;
    successfulLeafIds: Set<string>;
    quarantinedLeafIds: Set<string>;
    attemptsByLeaf: Map<string, QuarantineAttemptEntry[]>;
    gateDecision: WaveGateOutcome['decision'];
    invocationIds: string[];
  }> {
    const { wave, waveNumber, workflowRunId, workspacePath, janumiCodeVersionSha } = input;
    const logger = getLogger();
    const startedAt = new Date().toISOString();

    // SINGLE WRITE-SCOPE AUTHORITY: resolve each leaf's component_id → the
    // stack-correct directory (Phase 9 is the first phase that knows the stack;
    // the persisted Phase-6 paths predate the language). This is the ONE choke
    // point before the pre-wave snapshot and the per-leaf prompt build, so the
    // orientation, write-scope constraint, snapshot, and union all read one
    // consistent dir — ending the hyphen/underscore fragmentation (greenfield).
    for (const leaf of wave.leaves) {
      const resolved = this.resolveLeafWriteScope(leaf);
      if (resolved) leaf.write_directory_paths = resolved;
    }

    // Producer-before-consumer bias (Tier-A): pre-order the wave's leaves by
    // their component's ownership rank BEFORE the topo-sort. The topo-sort
    // seeds its ready-queue in input order, so this makes producer components
    // run ahead of their consumers wherever real task-dependencies leave the
    // order free — so a shared module's owner implements it before consumers
    // reach for it — WITHOUT overriding any genuine dependency_task_ids edge.
    const idsInWave = new Set(wave.leaves.map(l => l.id));
    const biased = this.biasLeavesByOwnership(wave.leaves);
    const topo = topoSortRespectingWave(biased, idsInWave);

    // Component distribution for telemetry.
    const distribution: Record<string, number> = {};
    for (const l of wave.leaves) {
      distribution[l.component_id] = (distribution[l.component_id] ?? 0) + 1;
    }

    const startContent: ExecutionWaveStartedContent = {
      kind: 'execution_wave_started',
      wave_number: waveNumber,
      release_id: wave.release_id,
      release_ordinal: wave.release_ordinal,
      release_name: wave.release_name,
      wave_kind: wave.kind,
      leaf_count: wave.leaves.length,
      started_at: startedAt,
      leaf_distribution_by_component: distribution,
      leaf_ids: wave.leaves.map(l => l.id),
    };
    this.writer.writeRecord({
      record_type: 'execution_wave_started',
      schema_version: '1.0',
      workflow_run_id: workflowRunId,
      phase_id: '9',
      sub_phase_id: '9.1',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: janumiCodeVersionSha,
      derived_from_record_ids: [],
      content: startContent as unknown as Record<string, unknown>,
    });

    // Tier-2 lifecycle: dispatch order per wave. ts-18's alphabetical
    // (Phase 9 dispatch ordering used to fire a dedicated lifecycle
    // event for grep-able diagnostics. With the legacy lifecycle stream
    // retired, the dispatch order is captured in the sub-phase summary
    // via the per-task `record.added` events that follow.)
    logger.info('workflow', 'Wave R: wave started', {
      wave_number: waveNumber, kind: wave.kind, leaves: wave.leaves.length,
      release: wave.release_name ?? wave.release_id ?? '(none)',
    });

    // Capture pre-wave snapshot across the union of write_directory_paths.
    const writeDirs = uniqueWritePaths(wave.leaves);
    const preSnapshot = captureWaveSnapshot(writeDirs, workspacePath);

    // Per-leaf execution.
    const successfulLeafIds = new Set<string>();
    const quarantinedLeafIds = new Set<string>();
    const attemptsByLeaf = new Map<string, QuarantineAttemptEntry[]>();
    const invocationIds: string[] = [];
    const reasoningReviewSummary: Record<string, number> = {};
    const testTotals = { passed: 0, failed: 0, skipped: 0, leaves_with_failing_tests: 0 };

    for (const leaf of topo) {
      const attempts: QuarantineAttemptEntry[] = [];
      let leafPassed = false;
      // Test files this leaf authors, accumulated across its attempts — the
      // file-level ownership evidence the per-leaf verdict is scoped to.
      const ownedTestFiles = new Set<string>();
      let priorFailureContext: string | null = input.attemptHintBuilder
        ? input.attemptHintBuilder(leaf.id)
        : null;

      for (let attempt = 1; attempt <= input.retryBudget; attempt++) {
        const attemptOutcome = await this.runLeafAttempt({
          leaf,
          attemptNumber: attempt,
          waveNumber,
          workflowRunId,
          workspacePath,
          janumiCodeVersionSha,
          augmentedContext: priorFailureContext,
          ownedTestFiles,
        });
        invocationIds.push(attemptOutcome.invocationId);
        attempts.push(attemptOutcome.entry);
        if (attemptOutcome.testResult) {
          testTotals.passed += attemptOutcome.testResult.passedCount;
          testTotals.failed += attemptOutcome.testResult.failedCount;
          testTotals.skipped += attemptOutcome.testResult.skippedCount;
          if (attemptOutcome.testResult.failedCount > 0) testTotals.leaves_with_failing_tests++;
        }
        if (attemptOutcome.entry.outcome === 'passed') {
          leafPassed = true;
          break;
        }
        // Tally reasoning_review flaws for the wave summary.
        for (const f of attemptOutcome.entry.reasoning_review_flaws ?? []) {
          reasoningReviewSummary[f.flaw_type] = (reasoningReviewSummary[f.flaw_type] ?? 0) + 1;
        }
        if (attempt < input.retryBudget) {
          priorFailureContext = buildRetryContext(attempts, attemptOutcome.entry);
        }
      }

      attemptsByLeaf.set(leaf.id, attempts);
      if (leafPassed) {
        successfulLeafIds.add(leaf.id);
      } else {
        quarantinedLeafIds.add(leaf.id);
        const lastAttempt = attempts[attempts.length - 1];
        const reason = lastAttempt?.outcome === 'reasoning_review_failed'
          ? `reasoning_review_failed (${(lastAttempt.reasoning_review_flaws ?? []).map(f => f.flaw_type).join(', ') || 'unspecified'})`
          : lastAttempt?.outcome === 'tests_failed'
            ? `tests_failed (${(lastAttempt.test_failures ?? []).slice(0, 3).join(', ') || 'unspecified'})`
            : `execution_failed (${lastAttempt?.error_message ?? 'unspecified'})`;
        // For deferred-batch waves, the existing quarantine entry is
        // updated with rescue_status by the outer caller — don't enqueue
        // a new one. For release waves, this is the first quarantine.
        if (wave.kind !== 'deferred_batch') {
          this.quarantineLedger.enqueue({
            workflowRunId,
            janumiCodeVersionSha,
            leafTaskId: leaf.id,
            leafNodeId: leaf._leaf_node_id ?? null,
            waveNumber,
            releaseId: wave.release_id,
            releaseOrdinal: wave.release_ordinal,
            attempts,
            reason,
          });
        }
      }
    }

    // Post-wave snapshot diff.
    const postSnapshot = captureWaveSnapshot(writeDirs, workspacePath);
    const diff = diffWaveSnapshots(preSnapshot, postSnapshot);

    const completedAt = new Date().toISOString();
    const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    const completedContent: ExecutionWaveCompletedContent = {
      kind: 'execution_wave_completed',
      wave_number: waveNumber,
      release_id: wave.release_id,
      release_ordinal: wave.release_ordinal,
      release_name: wave.release_name,
      wave_kind: wave.kind,
      leaf_count: wave.leaves.length,
      successful_count: successfulLeafIds.size,
      quarantined_count: quarantinedLeafIds.size,
      started_at: startedAt,
      completed_at: completedAt,
      duration_ms: durationMs,
      files_written_count: diff.created,
      files_modified_count: diff.modified,
      files_deleted_count: diff.deleted,
      test_summary: {
        total_passed: testTotals.passed,
        total_failed: testTotals.failed,
        total_skipped: testTotals.skipped,
        leaves_with_failing_tests: testTotals.leaves_with_failing_tests,
      },
      reasoning_review_summary: reasoningReviewSummary,
      successful_leaf_ids: [...successfulLeafIds],
      quarantined_leaf_ids: [...quarantinedLeafIds],
    };
    this.writer.writeRecord({
      record_type: 'execution_wave_completed',
      schema_version: '1.0',
      workflow_run_id: workflowRunId,
      phase_id: '9',
      sub_phase_id: '9.1',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: janumiCodeVersionSha,
      derived_from_record_ids: [],
      content: completedContent as unknown as Record<string, unknown>,
    });

    // Wave gate.
    const gateOutcome = await this.waveGate.runGate({
      workflowRunId,
      janumiCodeVersionSha,
      waveNumber,
      waveKind: wave.kind,
      releaseId: wave.release_id,
      releaseOrdinal: wave.release_ordinal,
      releaseName: wave.release_name,
      completedSummary: completedContent,
      diffSummary: diff,
      autoApprove: this.config.autoApproveWaveGates,
    });

    return {
      successCount: successfulLeafIds.size,
      quarantineCount: quarantinedLeafIds.size,
      successfulLeafIds,
      quarantinedLeafIds,
      attemptsByLeaf,
      gateDecision: gateOutcome.decision,
      invocationIds,
    };
  }

  // ── per-leaf attempt ───────────────────────────────────────────

  private async runLeafAttempt(input: {
    leaf: SchedulerLeaf;
    attemptNumber: number;
    waveNumber: number;
    workflowRunId: string;
    workspacePath: string;
    janumiCodeVersionSha: string;
    augmentedContext: string | null;
    /** Accumulates, across this leaf's attempts, the test files it authored —
     *  the file-level ownership evidence the verdict is scoped to. */
    ownedTestFiles: Set<string>;
  }): Promise<{ entry: QuarantineAttemptEntry; invocationId: string; testResult: LeafTestRunResult | null }> {
    const { leaf, attemptNumber, waveNumber, workflowRunId, workspacePath, janumiCodeVersionSha, augmentedContext, ownedTestFiles } = input;
    const logger = getLogger();
    const contextFileId = this.generateId();

    // Per-task DMR call — pulls active_constraints + material findings
    // scoped to this specific task. Phases 5-8 call DMR for their own
    // work; Phase 9 follows the same pattern so the executor sees
    // task-relevant constraints rather than only the constitutional
    // invariants the builder would surface by default. DMR failure is
    // non-fatal: buildTaskContext falls back to its builder-time
    // active_constraints option.
    const dmrPacket = await this.fetchDmrPacketForTask(leaf, workflowRunId);

    // The task's implementation packet is the single coherent source of its
    // scoped context — pass it into the builder so the detail bundle's
    // test_cases + evaluation_criteria come from the packet (root/leaf-safe,
    // task-scoped) rather than the raw-artifact re-derivation, and the
    // detail file stays consistent with the prepended packet block below.
    const packet = this.packetByTaskId?.get(leaf.id);

    let stdinText = this.executionContextBuilder.buildTaskContext(
      leaf as unknown as CtxTask,
      workflowRunId,
      contextFileId,
      this.artifacts,
      undefined,
      dmrPacket,
      this.reconEnforcement
        ? {
            conventions: this.reconEnforcement.conventions,
            sharedDir: '', // recon is per-area; the conventions carry the aliases/paths
            canonicalFiles: this.reconEnforcement.canonical_modules.map(m => m.path),
            protectedPaths: this.reconEnforcement.protected_paths,
            language: this.reconEnforcement.primary_stack,
          }
        : this.scaffoldManifest
          ? {
              conventions: this.scaffoldManifest.conventions,
              sharedDir: this.scaffoldManifest.profile.shared_dir,
              canonicalFiles: this.scaffoldManifest.canonical_files,
              protectedPaths: this.scaffoldManifest.protected_paths,
              language: this.scaffoldManifest.profile.language,
            }
          : null,
      packet,
    ).stdin.text;

    // Prepend the implementation packet's bundled context when available.
    // The packet carries user stories + ACs + tests + eval criteria +
    // component contract + active constraints + compliance items — the
    // structural ts-16 fix that gives the executor the full context it
    // needs without inventing.
    //
    // Path N item 6: when a packet is being prepended, the legacy
    // template's Component Context / Component Model Summary / Test
    // Cases / Evaluation Criteria sections duplicate what the packet
    // already provides (and historically with broken renderings —
    // `Responsibility: undefined`, 8 unrelated eval criteria, etc.).
    // The packet block is the canonical source; collapse the legacy
    // sections to a single-line pointer when packet is present.
    //
    // Path N item 5/8: prepend a workspace orientation block. In ts-17
    // the executor looped "Let me check the workspace structure" eight
    // times before concluding the workspace was empty. Telling it
    // upfront — workspace root, greenfield/existing flag, and which
    // write-scope paths exist — removes that loop entirely.
    if (packet) {
      // Normalize the orientation's write-scope paths to the stack's package
      // convention (python: hyphen→underscore) so the top-of-prompt orientation
      // and the "## Write Scope Constraint" section agree — a mismatch re-creates
      // the directory-contradiction deadlock (slice-156).
      const stackLang = this.reconEnforcement?.primary_stack ?? this.scaffoldManifest?.profile.language;
      const orientation = buildWorkspaceOrientation(
        workspacePath,
        (leaf.write_directory_paths ?? []).map(p => normalizeComponentDirForStack(p, stackLang)),
      );
      const packetContext = formatPacketAsExecutorContext(packet);
      const ownership = this.renderOwnershipDirective(leaf.component_id);
      stdinText = collapseLegacySectionsWhenPacketPresent(stdinText);
      stdinText = `${orientation}${ownership ? `\n\n${ownership}` : ''}\n\n${packetContext}\n\n${stdinText}`;
    }

    // Engineering Constitution — craft standard inlined into EVERY attempt (each
    // retry is a fresh session). slice-151 showed the executor READ the inlined
    // doc but never acted on it: it was framed purely ADVISORY, buried as the
    // prompt tail, and craft doesn't affect the test/typecheck gate the model
    // optimises for (a probe confirmed the model reads the content fine — the
    // `<engineering_constitution>` tags don't filter it). So we now (a) LEAD with
    // a short, specific, actionable craft directive framed as VERIFIED (the
    // Phase-10 craft-conformance check), to pull it into the model's optimisation
    // target, then (b) inline the full doc as the detailed reference. Still
    // SUBORDINATE to the task spec / completion criteria / technical constraints
    // (those always win) to avoid the slice-139 "everything authoritative" mess.
    const constitutionPath = this.reconEnforcement?.engineering_constitution_path
      ?? this.scaffoldManifest?.engineering_constitution_path;
    if (constitutionPath) {
      // Resolve to ABSOLUTE against the control-plane workspace root before
      // reading. The path can arrive RELATIVE (`.janumicode/…`), and the
      // executor's cwd is the projectRoot sandbox, so a relative read resolves
      // to `<projectRoot>/.janumicode/…` and THROWS — slice-151 had 15/45 leaves
      // silently fall back to an unreadable path-reference for exactly this
      // reason. The orchestrator reads the control plane directly (the agent
      // never needs filesystem access to it).
      const constitutionAbs = path.isAbsolute(constitutionPath)
        ? constitutionPath
        : path.join(this.engine.workspacePath, constitutionPath);
      const CONSTITUTION_MAX_CHARS = 80_000;
      let constitutionBody = '';
      try {
        constitutionBody = fs.readFileSync(constitutionAbs, 'utf8').trim();
      } catch (err) {
        getLogger().warn('workflow', 'executionScheduler: could not read engineering constitution to inline; falling back to path reference', {
          path: constitutionAbs, error: err instanceof Error ? err.message : String(err),
        });
      }
      let truncatedNote = '';
      if (constitutionBody.length > CONSTITUTION_MAX_CHARS) {
        constitutionBody = constitutionBody.slice(0, CONSTITUTION_MAX_CHARS);
        truncatedNote = '\n\n[NOTE: engineering constitution truncated to fit the prompt budget.]';
      }
      const craftLead =
        'Craft requirements for THIS task (subordinate ONLY to its specification, completion criteria, and technical constraints — those always win):\n'
        + '- Every exported function / class / module carries a brief doc comment stating WHY it exists and citing the completion criterion, acceptance criterion, or constraint it satisfies (e.g. `// CC-001: …`, `// per SR-005`).\n'
        + '- Comment the non-obvious "why", not the "what"; prefer self-documenting names over narration; leave no commented-out code.\n'
        + '- Apply proportionally to the scope of THIS leaf (no app-wide health checks in an ordinary leaf). These are VERIFIED after the run by a Phase-10 craft-conformance check — treat them as a soft completion requirement.';
      stdinText += '\n\n## Engineering Constitution (required craft standard — verified at Phase 10)\n';
      if (constitutionBody) {
        stdinText += craftLead + '\n\nFull standard (detailed reference) below:\n'
          + '<engineering_constitution>\n'
          + constitutionBody
          + '\n</engineering_constitution>'
          + truncatedNote;
      } else {
        // Read failed (file genuinely missing) — keep the actionable craft lead;
        // it stands on its own without the full doc.
        stdinText += craftLead + `\n\n(Full standard at \`${constitutionAbs}\` was unavailable to inline.)`;
      }
    }

    if (augmentedContext) {
      stdinText = `${stdinText}\n\n## RETRY CONTEXT\n\n${augmentedContext}`;
    }

    const execTask: ExecutionTask = {
      id: leaf.id,
      taskType: leaf.task_type,
      componentId: leaf.component_id,
      componentResponsibility: leaf.component_responsibility,
      description: leaf.description,
      completionCriteria: leaf.completion_criteria.map(c => ({
        criterionId: c.criterion_id,
        description: c.description,
      })),
      writeDirectoryPaths: leaf.write_directory_paths ?? [],
      expectedPreStateHash: leaf.expected_pre_state_hash,
      verificationStep: leaf.verification_step,
    };

    let executionResult: ExecutionResult;
    try {
      executionResult = await this.executorAgent.execute(
        execTask,
        workflowRunId,
        stdinText,
        workspacePath,
        janumiCodeVersionSha,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('workflow', 'Wave R: executor invocation threw', {
        leaf: leaf.id, attempt: attemptNumber, error: message,
      });
      return {
        invocationId: 'unknown',
        testResult: null,
        entry: {
          attempt_number: attemptNumber,
          invocation_id: 'unknown',
          outcome: 'execution_failed',
          error_message: message,
          files_written_count: 0,
        },
      };
    }

    if (!executionResult.success) {
      return {
        invocationId: executionResult.invocationId,
        testResult: null,
        entry: {
          attempt_number: attemptNumber,
          invocation_id: executionResult.invocationId,
          outcome: 'execution_failed',
          error_message: executionResult.error,
          files_written_count: executionResult.filesWritten.length,
        },
      };
    }

    // Lever 2b — write-scope guard. A leaf must IMPORT the shared modules
    // and root project config the scaffold step owns; it must never write
    // into a protected path (the shared dir or a root config file). A
    // violation is the fragmentation/divergence symptom itself (a leaf
    // re-creating package.json or its own copy of a shared module), so we
    // quarantine + retry with explicit "import, don't reinvent" context.
    // Sandbox-escape guard (defense-in-depth behind the relative-path steering).
    // A write whose resolved path lands OUTSIDE the project root is the most
    // severe violation — the agent mangled an absolute path into a directory
    // beyond the sandbox (slice-150 created garbage as high as the drive root).
    // Never exempt (not even the composition root): nothing legitimately writes
    // outside the project. Quarantine + retry with feedback, and best-effort
    // delete the exact escaped files the agent reported (safe — known agent
    // creations outside the sandbox).
    const sandboxEscapes = detectSandboxEscapes(executionResult.filesWritten, workspacePath);
    if (sandboxEscapes.length > 0) {
      logger.error('workflow', 'SANDBOX ESCAPE: leaf wrote OUTSIDE the project root (quarantining + cleaning up)', {
        leaf: leaf.id, attempt: attemptNumber, escapes: sandboxEscapes,
      });
      for (const esc of sandboxEscapes) {
        try { fs.rmSync(esc, { force: true }); } catch { /* dir or locked — leave for operator */ }
      }
      return {
        invocationId: executionResult.invocationId,
        testResult: null,
        entry: {
          attempt_number: attemptNumber,
          invocation_id: executionResult.invocationId,
          outcome: 'reasoning_review_failed',
          reasoning_review_flaws: [{
            flaw_type: 'write_scope_violation',
            severity: 'high',
            description:
              'Wrote files OUTSIDE the project root using absolute or parent (`..`) paths — these are rejected: ' +
              sandboxEscapes.join(', ') +
              '. Write ONLY paths relative to your current directory (the project root); never absolute paths.',
          }],
          files_written_count: executionResult.filesWritten.length,
        },
      };
    }

    let scopeViolations = this.detectWriteScopeViolations(executionResult.filesWritten, workspacePath);
    if (scopeViolations.length > 0 && leaf._composition_root) {
      // The composition root OWNS root-config edits (dependency installs,
      // entrypoint scripts). Only directory-prefix protections (the shared
      // dir) still apply to it.
      const dirPrefixes = this.effectiveProtectedPaths().filter((p) => p.endsWith('/'));
      scopeViolations = scopeViolations.filter((rel) =>
        dirPrefixes.some((p) => rel === p.slice(0, -1) || rel.startsWith(p)));
    }
    if (scopeViolations.length > 0) {
      logger.warn('workflow', 'Wave R: leaf wrote into protected scaffold scope (quarantining)', {
        leaf: leaf.id, attempt: attemptNumber, violations: scopeViolations,
      });
      return {
        invocationId: executionResult.invocationId,
        testResult: null,
        entry: {
          attempt_number: attemptNumber,
          invocation_id: executionResult.invocationId,
          outcome: 'reasoning_review_failed',
          reasoning_review_flaws: [{
            flaw_type: 'write_scope_violation',
            severity: 'high',
            description:
              'Wrote into protected scaffold paths. Import the canonical shared ' +
              'modules / root config instead of recreating them: ' +
              scopeViolations.join(', '),
          }],
          files_written_count: executionResult.filesWritten.length,
        },
      };
    }

    // Reasoning review — Phase 9 gating policy.
    //
    // Reviews are universal in v2: every successful agent_output (including
    // the executor's CLI invocation just above) is reviewed by the
    // LLMCaller hook synchronously, producing a `reasoning_review_record`
    // linked to its agent_output via `derived_from_record_ids`. There's
    // therefore no separate review call here — we read the record the
    // hook already produced and apply Phase-9 gating policy on top:
    //   any HIGH-severity concern → quarantine the leaf and retry.
    //
    // If the per-call hook hasn't produced a review record (review
    // disabled, skipped, or not yet flushed), Phase 9 treats the task as
    // tentatively passing — gating absence is not a failure mode by
    // design (advisory, never blocking unless we explicitly opt in).
    const highSeverityFindings = findHighSeverityHarnessFindingsForInvocation(
      this.engine.db,
      workflowRunId,
      executionResult.invocationId,
    );
    if (highSeverityFindings.length > 0) {
      return {
        invocationId: executionResult.invocationId,
        testResult: null,
        entry: {
          attempt_number: attemptNumber,
          invocation_id: executionResult.invocationId,
          outcome: 'reasoning_review_failed',
          reasoning_review_flaws: highSeverityFindings.map(f => ({
            flaw_type: f.summary.slice(0, 80),
            severity: f.severity.toLowerCase(),
            description: f.detail,
          })),
          files_written_count: executionResult.filesWritten.length,
        },
      };
    }

    // Record the test files THIS attempt authored (file-level ownership
    // evidence), accumulated across the leaf's attempts so a test written in an
    // earlier attempt still scopes the verdict even if a later attempt only
    // touched the implementation.
    for (const w of executionResult.filesWritten) {
      if (w.operation === 'delete') continue;
      const rel = path.relative(workspacePath, w.filePath).split(path.sep).join('/');
      if (rel && !rel.startsWith('..') && isTestFilePath(rel)) ownedTestFiles.add(rel);
    }

    // Per-leaf test execution. Scoped to the leaf's OWN test files when it
    // authored any (file-level attribution); else its write directories.
    const testResult = await this.leafTestRunner.run({
      leafTaskId: leaf.id,
      attemptNumber,
      waveNumber,
      workflowRunId,
      janumiCodeVersionSha,
      workspacePath,
      writeDirectoryPaths: leaf.write_directory_paths ?? [],
      ownTestFiles: [...ownedTestFiles],
    });

    if (!testResult.passed) {
      return {
        invocationId: executionResult.invocationId,
        testResult,
        entry: {
          attempt_number: attemptNumber,
          invocation_id: executionResult.invocationId,
          outcome: 'tests_failed',
          test_failures: [
            `${testResult.failedCount} failed / ${testResult.passedCount} passed (exit ${testResult.exitCode ?? 'n/a'})`,
            ...(testResult.stderrExcerpt ? [testResult.stderrExcerpt.slice(0, 500)] : []),
          ],
          files_written_count: executionResult.filesWritten.length,
        },
      };
    }

    return {
      invocationId: executionResult.invocationId,
      testResult,
      entry: {
        attempt_number: attemptNumber,
        invocation_id: executionResult.invocationId,
        outcome: 'passed',
        files_written_count: executionResult.filesWritten.length,
      },
    };
  }

  // ── helpers ────────────────────────────────────────────────────

  /**
   * Lever 2b — detect writes into protected scaffold paths. Returns the
   * workspace-relative paths a leaf wrote that fall under a manifest
   * protected prefix (the shared dir) or that ARE a protected root config
   * file. Deny-only: it does NOT enforce the full write_directory_paths
   * allow-list (too aggressive), only the scaffold-owned scope. No-op when
   * no scaffold manifest is set.
   */
  private detectWriteScopeViolations(
    filesWritten: Array<{ filePath: string; operation: 'create' | 'modify' | 'delete' }>,
    workspacePath: string,
  ): string[] {
    const protectedPaths = this.effectiveProtectedPaths();
    if (protectedPaths.length === 0) return [];
    const violations = new Set<string>();
    for (const w of filesWritten) {
      if (w.operation === 'delete') continue;
      const rel = path.relative(workspacePath, w.filePath).split(path.sep).join('/');
      if (!rel || rel.startsWith('..')) continue; // outside workspace — not this guard's concern
      for (const p of protectedPaths) {
        const isDirPrefix = p.endsWith('/');
        if (isDirPrefix ? (rel === p.slice(0, -1) || rel.startsWith(p)) : rel === p) {
          violations.add(rel);
          break;
        }
      }
    }
    return [...violations];
  }

  /**
   * Per-task DMR call. Constructs a structured query that names the
   * task's component_id, FRs/NFRs (derived from completion_criteria
   * artifact_refs + technical_spec_ids), and seeds
   * `knownRelevantRecordIds` from `task.derived_from_record_ids` so the
   * Stage 2 harvest hits the motivating artifacts at materiality=1.0.
   *
   * Failures are non-fatal — `buildPhaseContextPacket` already returns
   * a sentinel empty packet on error. The executor still gets a usable
   * prompt; only the active_constraints + per-task DMR detail are
   * missing.
   */
  /**
   * Latest current-version `artifact_produced` record id for each requested
   * `content.kind`, scoped to the run. Used to seed the executor-task DMR with
   * the task's real technical context (component model, data models, APIs,
   * test plan, eval plans) so those out-rank governance records.
   */
  private latestArtifactIdsByKind(workflowRunId: string, kinds: string[]): string[] {
    const out: string[] = [];
    try {
      const stmt = this.engine.db.prepare(
        `SELECT id FROM governed_stream
           WHERE workflow_run_id = ? AND record_type = 'artifact_produced'
             AND is_current_version = 1
             AND json_extract(content, '$.kind') = ?
           ORDER BY rowid DESC LIMIT 1`,
      );
      for (const kind of kinds) {
        const row = stmt.get(workflowRunId, kind) as { id: string } | undefined;
        if (row?.id) out.push(row.id);
      }
    } catch (err) {
      getLogger().debug('workflow', 'latestArtifactIdsByKind lookup failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return out;
  }

  private async fetchDmrPacketForTask(
    leaf: SchedulerLeaf,
    workflowRunId: string,
  ): Promise<{ activeConstraintsText: string; detailFileContent: string; detailFilePath: string } | null> {
    try {
      const componentId = leaf.component_id ?? 'unknown';
      const specIds = leaf.technical_spec_ids ?? [];
      const criterionRefs = (leaf.completion_criteria ?? [])
        .map(c => c.artifact_ref).filter(Boolean) as string[];
      const idTokens = [...new Set([componentId, ...specIds, ...criterionRefs])]
        .filter(s => s && s !== 'unknown').slice(0, 20);
      const query = idTokens.length > 0
        ? `Implementation of task ${leaf.id} on component ${componentId} referencing ${idTokens.join(', ')}. Retrieve governing constraints, technical specs, and known conflicts.`
        : `Implementation of task ${leaf.id} on component ${componentId}. Retrieve governing constraints and technical specs.`;

      const known: string[] = [];
      if (leaf.derived_from_record_ids) for (const id of leaf.derived_from_record_ids) known.push(id);
      // Seed the task's upstream TECHNICAL artifacts so they enter the DMR
      // findings at max materiality (known-relevant = 1.0) rather than being
      // out-ranked by authority-7 governance. Without this the executor DMR
      // surfaced only constitutional invariants and no component/data-model/
      // test context (slice-138). Latest current-version record per kind.
      for (const id of this.latestArtifactIdsByKind(workflowRunId, [
        'component_model', 'data_models', 'api_definitions', 'interface_contracts',
        'test_plan', 'functional_evaluation_plan', 'quality_evaluation_plan',
      ])) known.push(id);

      const ctxShim: PhaseContext = {
        workflowRun: {
          id: workflowRunId,
          current_phase_id: '9',
        } as PhaseContext['workflowRun'],
        engine: this.engine,
      } as unknown as PhaseContext;

      const packet = await buildPhaseContextPacket(ctxShim, {
        subPhaseId: `9.1_${leaf.id}`,
        requestingAgentRole: 'executor_agent',
        query,
        scopeTier: 'all_runs',
        knownRelevantRecordIds: known,
        focusComponentId: componentId,
        detailFileLabel: `9_1_task_${leaf.id}`,
        requiredOutputSpec: 'Implementation artifacts + tests per completion criteria',
      });

      if (!packet.packet) return null;
      // Suppress a governance-only / empty DMR side channel: with the
      // constitutional invariants excluded and the task's technical artifacts
      // seeded, a packet with zero material findings means DMR resolved nothing
      // task-relevant — attaching it would only add a boilerplate reference.
      const findingCount = packet.packet.materialFindings?.length ?? 0;
      if (findingCount === 0) {
        getLogger().debug('workflow', 'per-task DMR resolved no task-relevant findings; omitting DMR reference', {
          leaf: leaf.id,
        });
        return null;
      }
      return {
        activeConstraintsText: packet.activeConstraintsText,
        detailFileContent: packet.detailFileContent,
        detailFilePath: packet.detailFilePath,
      };
    } catch (err) {
      getLogger().warn('workflow', 'per-task DMR call failed; proceeding without DMR context', {
        leaf: leaf.id,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  private updateRunTotals(
    workflowRunId: string,
    columns: Partial<{
      current_execution_wave: number;
      total_execution_waves: number;
      quarantined_leaf_count: number;
      terminally_deferred_leaf_count: number;
    }>,
  ): void {
    const sets: string[] = [];
    const values: Array<number | string> = [];
    for (const [k, v] of Object.entries(columns)) {
      sets.push(`${k} = ?`);
      values.push(v as number);
    }
    if (sets.length === 0) return;
    values.push(workflowRunId);
    try {
      this.engine.db.prepare(`UPDATE workflow_runs SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    } catch (err) {
      getLogger().warn('workflow', 'Wave R: updateRunTotals failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

// ── Internal types & helpers ───────────────────────────────────────

interface WaveSlice {
  kind: ExecutionWaveKind;
  release_id: string | null;
  release_ordinal: number | null;
  release_name?: string;
  leaves: SchedulerLeaf[];
}

/** Whether a workspace-relative path is a test file (common conventions across
 *  vitest/jest/pytest/go/rust): `*.test.*` / `*.spec.*` / `*_test.*` /
 *  `test_*` basenames, or a path under a `__tests__` / `tests` directory. */
export function isTestFilePath(rel: string): boolean {
  const p = rel.replace(/\\/g, '/').toLowerCase();
  const base = p.split('/').pop() ?? p;
  if (/\.(test|spec)\.[a-z0-9]+$/.test(base)) return true;
  if (/(^|[._-])test[._-]/.test(base) || /_test\.[a-z0-9]+$/.test(base)) return true;
  return /(^|\/)(__tests__|tests?)\//.test(p);
}

/** Slice leaves into ordered waves keyed by release_ordinal. Backlog
 *  (release_id=null) lands in a dedicated final wave. When no releases
 *  are available, falls back to a single-wave-everything mode. */
export function sliceLeavesIntoWaves(
  leaves: SchedulerLeaf[],
  releases: SchedulerReleaseEntry[],
): WaveSlice[] {
  if (leaves.length === 0) return [];
  if (releases.length === 0) {
    return [{
      kind: 'single',
      release_id: null,
      release_ordinal: null,
      release_name: 'Single wave (no release plan)',
      leaves,
    }];
  }
  const byRelease = new Map<string, SchedulerLeaf[]>();
  const backlog: SchedulerLeaf[] = [];
  for (const l of leaves) {
    const rid = l.release_id ?? null;
    if (rid == null) backlog.push(l);
    else {
      const arr = byRelease.get(rid) ?? [];
      arr.push(l);
      byRelease.set(rid, arr);
    }
  }
  const sortedReleases = [...releases].sort(
    (a, b) => (a.release_ordinal ?? Number.MAX_SAFE_INTEGER) - (b.release_ordinal ?? Number.MAX_SAFE_INTEGER),
  );
  const waves: WaveSlice[] = [];
  for (const rel of sortedReleases) {
    const id = rel.release_id;
    const arr = id ? byRelease.get(id) ?? [] : [];
    if (arr.length === 0) continue;
    waves.push({
      kind: 'release',
      release_id: id,
      release_ordinal: rel.release_ordinal,
      release_name: rel.release_name,
      leaves: arr,
    });
  }
  if (backlog.length > 0) {
    waves.push({
      kind: 'release',
      release_id: null,
      release_ordinal: null,
      release_name: 'Backlog',
      leaves: backlog,
    });
  }
  return waves;
}

/**
 * Topological sort over leaves restricted to deps within the wave.
 * Cross-wave dependencies (deps that point at leaf-ids not in this
 * wave) are dropped from the in-wave graph — they're already satisfied
 * by execution order across waves.
 */
export function topoSortRespectingWave(
  leaves: SchedulerLeaf[],
  inWave: Set<string>,
): SchedulerLeaf[] {
  const byId = new Map<string, SchedulerLeaf>();
  for (const l of leaves) byId.set(l.id, l);
  const indeg = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const l of leaves) {
    indeg.set(l.id, 0);
    outgoing.set(l.id, []);
  }
  for (const l of leaves) {
    for (const dep of l.dependency_task_ids ?? []) {
      if (!inWave.has(dep)) continue; // cross-wave dep ignored here
      if (!byId.has(dep)) continue;
      outgoing.get(dep)!.push(l.id);
      indeg.set(l.id, (indeg.get(l.id) ?? 0) + 1);
    }
  }
  const queue: string[] = [];
  for (const [id, deg] of indeg) if (deg === 0) queue.push(id);
  const ordered: SchedulerLeaf[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    ordered.push(byId.get(id)!);
    for (const next of outgoing.get(id) ?? []) {
      const d = (indeg.get(next) ?? 0) - 1;
      indeg.set(next, d);
      if (d === 0) queue.push(next);
    }
  }
  if (ordered.length < leaves.length) {
    // Cycle — append remaining in input order so they still run.
    const placed = new Set(ordered.map(o => o.id));
    for (const l of leaves) if (!placed.has(l.id)) ordered.push(l);
    getLogger().warn('workflow', 'Wave R: topo-sort detected dependency cycle', {
      cycle_leaves: leaves.filter(l => !placed.has(l.id)).map(l => l.id),
    });
  }
  return ordered;
}

/**
 * Path N item 6: when an implementation_packet is being prepended, the
 * legacy executor template's Component Context / Component Model
 * Summary / Test Cases / Evaluation Criteria sections become redundant
 * (and historically carried broken renderings). The packet block above
 * is canonical. Collapse the body of each duplicate section to a
 * single-line pointer; keep the heading for navigation continuity.
 *
 * Replacements operate on the rendered template body; section headers
 * are matched verbatim against the strings in
 * implementation_task_execution.system.md. A section "body" is
 * everything from the heading line's newline up to (but not including)
 * the next `## ` or `# ` heading.
 */
/**
 * Path N item 5/8: tell the executor where it is, whether the workspace
 * is greenfield, and which write-scope paths already exist. Without
 * this, the ts-17 executor looped "Let me check the workspace
 * structure" eight times before deciding to create from scratch.
 *
 * The block is short (≤ 12 lines for typical tasks) and goes at the
 * very top of stdin so the executor sees it before any of the bulky
 * context. Existence checks are synchronous against the local
 * filesystem — safe because the scheduler runs in the orchestrator
 * process which already has read access to the workspace.
 */
/**
 * Detect writes that landed OUTSIDE the project root. Catches the
 * absolute-path-mangling escape: the agent builds an absolute path from the
 * workspace path it was shown, corrupts it, and the write lands beyond the
 * sandbox (slice-150 created garbage as high as the drive root). `filesWritten`
 * includes goose's announced tool-event writes (resolved to absolute), so
 * reported escapes are visible here. Returns POSIX absolute paths of escapes.
 */
export function detectSandboxEscapes(
  filesWritten: Array<{ filePath: string; operation: 'create' | 'modify' | 'delete' }>,
  projectRoot: string,
): string[] {
  const escapes = new Set<string>();
  for (const w of filesWritten) {
    if (w.operation === 'delete') continue;
    const abs = path.isAbsolute(w.filePath) ? w.filePath : path.resolve(projectRoot, w.filePath);
    const rel = path.relative(projectRoot, abs);
    // Outside the project root iff the relative path climbs out (`..`) or is
    // itself absolute (e.g. a different drive letter on Windows).
    if (rel !== '' && (rel.startsWith('..') || path.isAbsolute(rel))) {
      escapes.add(abs.split(path.sep).join('/'));
    }
  }
  return [...escapes];
}

export function buildWorkspaceOrientation(workspacePath: string, writeDirectoryPaths: string[]): string {
  const lines: string[] = [];
  lines.push('# Workspace Orientation');
  lines.push('');
  // Steer the agent to RELATIVE paths. We deliberately do NOT print the
  // absolute workspace root: it is the longest literal string the agent
  // echoes, and weak models mangle it into out-of-sandbox absolute paths
  // (dropped hyphens, escape-sequence mashing) that escape the project dir.
  // The agent's current working directory IS the project root, so relative
  // paths suffice — and a mistyped RELATIVE path still stays inside the
  // sandbox, whereas a mistyped ABSOLUTE path does not.
  lines.push('You are running INSIDE the project root — it is your current working directory (`.`).');
  lines.push('Write every file using a path RELATIVE to it (e.g. `src/foo.ts`, `internal/x/y.go`).');
  lines.push('NEVER use an absolute path and never `cd` out of this directory — writes outside it are rejected.');

  let workspaceExists = false;
  let workspaceEntryCount = 0;
  try {
    workspaceExists = fs.existsSync(workspacePath) && fs.statSync(workspacePath).isDirectory();
    if (workspaceExists) {
      workspaceEntryCount = fs.readdirSync(workspacePath).filter((name) => !name.startsWith('.')).length;
    }
  } catch {
    // Filesystem probe is best-effort; defaults stay (workspace not visible).
  }

  if (!workspaceExists) {
    lines.push('Workspace state: **not yet created** — orchestrator will mkdir on first write.');
  } else if (workspaceEntryCount === 0) {
    lines.push('Workspace state: **greenfield** (empty directory; no prior source files).');
  } else {
    lines.push(`Workspace state: **existing** (${workspaceEntryCount} top-level entries present; treat as brownfield — read before write).`);
  }

  if (writeDirectoryPaths.length > 0) {
    lines.push('');
    lines.push('Write-scope paths (you may create or modify ONLY these):');
    for (const rel of writeDirectoryPaths) {
      const abs = path.isAbsolute(rel) ? rel : path.join(workspacePath, rel);
      let exists = false;
      try { exists = fs.existsSync(abs); } catch { exists = false; }
      const flag = exists ? 'exists' : 'does not exist — create it';
      lines.push(`- \`${rel}\` (${flag})`);
    }
  }

  lines.push('');
  lines.push('_Do not spend tool calls probing the workspace structure — the information above is authoritative._');
  return lines.join('\n');
}

export function collapseLegacySectionsWhenPacketPresent(stdinText: string): string {
  const sections = [
    'Component Context',
    'Component Model Summary',
    'Test Cases to Implement',
    'Evaluation Criteria (filtered to this task\'s component)',
  ];
  const pointer = '_(See **Implementation Packet Context** block above — packet is the canonical source.)_';
  let out = stdinText;
  for (const heading of sections) {
    // Escape regex metacharacters in the heading literal.
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(## ${escaped}\\n)[\\s\\S]*?(?=\\n## |\\n# |$)`, 'g');
    out = out.replace(re, `$1${pointer}\n`);
  }
  return out;
}

function uniqueWritePaths(leaves: SchedulerLeaf[]): string[] {
  const set = new Set<string>();
  for (const l of leaves) {
    for (const p of l.write_directory_paths ?? []) set.add(p);
  }
  return [...set];
}

function buildRetryContext(
  attempts: QuarantineAttemptEntry[],
  last: QuarantineAttemptEntry,
): string {
  const lines: string[] = [];
  lines.push(`Prior attempt ${last.attempt_number} failed with outcome=${last.outcome}.`);
  if (last.error_message) lines.push(`Error: ${last.error_message}`);
  if (last.reasoning_review_flaws && last.reasoning_review_flaws.length > 0) {
    lines.push('Reasoning review flagged:');
    for (const f of last.reasoning_review_flaws) {
      lines.push(`  - [${f.severity}] ${f.flaw_type}${f.description ? `: ${f.description}` : ''}`);
    }
    lines.push('Address each flaw above by adjusting your approach for this retry.');
  }
  if (last.test_failures && last.test_failures.length > 0) {
    lines.push('Test failures from prior attempt:');
    for (const f of last.test_failures) lines.push(`  - ${f}`);
    lines.push('Make the failing tests pass before declaring success.');
  }
  if (attempts.length >= 2) {
    lines.push(`This is retry ${attempts.length}/${attempts.length}; do not repeat the prior approach.`);
  }
  return lines.join('\n');
}

/**
 * Look up HIGH-severity reasoning_review_finding_record entries the
 * harness produced for a given executor invocation (Track D Commit 10).
 *
 * Replaces the prior single-pass `reasoning_review_record` lookup. The
 * harness writes one parent `reasoning_review_harness_record` per
 * agent_output, then one `reasoning_review_finding_record` per finding
 * (per validator). Phase 9's quarantine policy continues to fire on
 * any HIGH severity finding from any validator — exactly matching the
 * old "any HIGH concern" semantics, just plumbed across multiple
 * records instead of one.
 *
 * Walks `agent_invocation → agent_output → reasoning_review_harness_record
 * → reasoning_review_finding_record` via derived_from_record_ids.
 */
function findHighSeverityHarnessFindingsForInvocation(
  db: import('../database/init').Database,
  workflowRunId: string,
  invocationId: string,
): Array<{ summary: string; detail: string; severity: string }> {
  // Find the agent_output(s) derived from the invocation.
  const outputRows = db.prepare(`
    SELECT id FROM governed_stream
    WHERE workflow_run_id = ?
      AND record_type = 'agent_output'
      AND is_current_version = 1
      AND json_extract(derived_from_record_ids, '$') LIKE ?
  `).all(workflowRunId, `%${invocationId}%`) as Array<{ id: string }>;
  if (outputRows.length === 0) return [];

  // Find the harness record(s) derived from any of those outputs.
  const harnessIds: string[] = [];
  for (const out of outputRows) {
    const harnessRows = db.prepare(`
      SELECT id FROM governed_stream
      WHERE workflow_run_id = ?
        AND record_type = 'reasoning_review_harness_record'
        AND is_current_version = 1
        AND json_extract(derived_from_record_ids, '$') LIKE ?
    `).all(workflowRunId, `%${out.id}%`) as Array<{ id: string }>;
    for (const r of harnessRows) harnessIds.push(r.id);
  }
  if (harnessIds.length === 0) return [];

  const high: Array<{ summary: string; detail: string; severity: string }> = [];
  for (const hid of harnessIds) {
    const findingRows = db.prepare(`
      SELECT content FROM governed_stream
      WHERE workflow_run_id = ?
        AND record_type = 'reasoning_review_finding_record'
        AND is_current_version = 1
        AND json_extract(derived_from_record_ids, '$') LIKE ?
    `).all(workflowRunId, `%${hid}%`) as Array<{ content: string }>;
    for (const row of findingRows) {
      try {
        const c = JSON.parse(row.content) as ReasoningReviewFindingRecordContent;
        if (c.severity === 'HIGH') {
          high.push({ summary: c.summary, detail: c.detail, severity: c.severity });
        }
      } catch {
        /* tolerate partially-written rows */
      }
    }
  }
  return high;
}

function emptyScheduleResult(): ExecutionScheduleResult {
  return {
    totalWaves: 0,
    successfulLeafCount: 0,
    quarantinedLeafCount: 0,
    rescuedLeafCount: 0,
    terminallyDeferredLeafCount: 0,
    rejectedWaveCount: 0,
    waveOutcomes: [],
    invocationIds: [],
    successfulLeafIds: [],
    stabilizationResidual: null,
  };
}

// Force-exported types referenced from outside that TS would otherwise
// elide if no value is exported alongside them.
export type { FileSnapshot, WaveDiffSummary };
export type { GovernedStreamRecord };
