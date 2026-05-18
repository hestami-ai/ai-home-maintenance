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

import { getLogger } from '../logging';
import type { OrchestratorEngine } from './orchestratorEngine';
import type { GovernedStreamWriter } from './governedStreamWriter';
import type { GovernedStreamRecord } from '../types/records';
import type {
  ExecutionWaveCompletedContent,
  ExecutionWaveStartedContent,
  ExecutionWaveKind,
  QuarantineAttemptEntry,
  TaskQuarantineContent,
} from '../types/records';
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
import { QuarantineLedger } from './quarantineLedger';
import { WaveGate, type WaveGateOutcome } from './waveGate';
import { buildPhaseContextPacket } from './phases/dmrContext';
import type { PhaseContext } from './orchestratorEngine';

// ── Public types ───────────────────────────────────────────────────

export interface SchedulerLeaf extends CtxTask {
  /** Inherited from Wave 6/8 — null = backlog (run in last wave). */
  release_id?: string | null;
  release_ordinal?: number | null;
  /** Wave 8 leaf node id when leaf came from a recursive tree. */
  _leaf_node_id?: string;
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
}

// ── Scheduler ──────────────────────────────────────────────────────

export class ExecutionScheduler {
  private readonly leafTestRunner: LeafTestRunner;
  private readonly quarantineLedger: QuarantineLedger;
  private readonly waveGate: WaveGate;

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

  async run(input: {
    workflowRunId: string;
    workspacePath: string;
    janumiCodeVersionSha: string;
    leaves: SchedulerLeaf[];
    releases: SchedulerReleaseEntry[];
  }): Promise<ExecutionScheduleResult> {
    const { workflowRunId, workspacePath, janumiCodeVersionSha, leaves, releases } = input;
    const logger = getLogger();

    const waves = sliceLeavesIntoWaves(leaves, releases);
    if (waves.length === 0) {
      logger.info('workflow', 'Wave R: no leaves to execute; skipping scheduler');
      return emptyScheduleResult();
    }

    // Persist scheduling totals up front.
    this.updateRunTotals(workflowRunId, { total_execution_waves: waves.length });

    const result: ExecutionScheduleResult = {
      totalWaves: waves.length,
      successfulLeafCount: 0,
      quarantinedLeafCount: 0,
      rescuedLeafCount: 0,
      terminallyDeferredLeafCount: 0,
      rejectedWaveCount: 0,
      waveOutcomes: [],
      invocationIds: [],
    };

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

    return result;
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

    // Topo-sort within the wave (only on dependencies that point at
    // leaves IN this wave; cross-wave deps are honored by the outer
    // wave-order loop, since later waves run after earlier ones).
    const idsInWave = new Set(wave.leaves.map(l => l.id));
    const topo = topoSortRespectingWave(wave.leaves, idsInWave);

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
  }): Promise<{ entry: QuarantineAttemptEntry; invocationId: string; testResult: LeafTestRunResult | null }> {
    const { leaf, attemptNumber, waveNumber, workflowRunId, workspacePath, janumiCodeVersionSha, augmentedContext } = input;
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

    let stdinText = this.executionContextBuilder.buildTaskContext(
      leaf as unknown as CtxTask,
      workflowRunId,
      contextFileId,
      this.artifacts,
      undefined,
      dmrPacket,
    ).stdin.text;

    if (augmentedContext) {
      stdinText = `${stdinText}\n\n## RETRY CONTEXT\n\n${augmentedContext}`;
    }

    const execTask: ExecutionTask = {
      id: leaf.id,
      taskType: leaf.task_type,
      componentId: leaf.component_id,
      componentResponsibility: leaf.component_responsibility,
      description: leaf.description,
      backingTool: leaf.backing_tool,
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

    // Per-leaf test execution.
    const testResult = await this.leafTestRunner.run({
      leafTaskId: leaf.id,
      attemptNumber,
      waveNumber,
      workflowRunId,
      janumiCodeVersionSha,
      workspacePath,
      writeDirectoryPaths: leaf.write_directory_paths ?? [],
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
  private async fetchDmrPacketForTask(
    leaf: SchedulerLeaf,
    workflowRunId: string,
  ): Promise<{ activeConstraintsText: string; detailFileContent: string } | null> {
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
        detailFileLabel: `9_1_task_${leaf.id}`,
        requiredOutputSpec: 'Implementation artifacts + tests per completion criteria',
      });

      if (!packet.packet) return null;
      return {
        activeConstraintsText: packet.activeConstraintsText,
        detailFileContent: packet.detailFileContent,
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
  };
}

// Force-exported types referenced from outside that TS would otherwise
// elide if no value is exported alongside them.
export type { FileSnapshot, WaveDiffSummary };
export type { GovernedStreamRecord };
