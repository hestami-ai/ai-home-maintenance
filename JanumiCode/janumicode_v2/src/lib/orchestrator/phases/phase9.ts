/**
 * Phase 9 — Execution.
 * Based on JanumiCode Spec v2.3, §4 Phase 9.
 *
 * Sub-phases:
 *   9.1 — Implementation Task Execution (invoke Executor Agent for each task)
 *   9.2 — Test Execution (run Vitest suites)
 *   9.3 — Evaluation Execution (functional, quality, reasoning)
 *   9.4 — Failure Handling (retry, rollback, or accept with caveat)
 *   9.5 — Completion Approval (phase gate)
 *
 * Uses ExecutionContextBuilder to assemble context payloads from upstream
 * artifacts, and ExecutorAgent to invoke CLI-backed coding agents.
 */

import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type {
  PhaseId,
  ReleasePlanContentV2,
  WaveGateDecisionContent,
  TaskQuarantineContent,
} from '../../types/records';
import { getLogger } from '../../logging';
import { ExecutorAgent, type ExecutorBackingTool } from '../../agents/executorAgent';
import { ExecutionContextBuilder, type ImplementationTask as CtxTask } from '../executionContextBuilder';
import { TestRunner, type TestSuite } from '../testRunner';
import { EvalRunner, type EvaluationCriterion } from '../evalRunner';
import { ExecutionScheduler, type SchedulerLeaf, type SchedulerReleaseEntry } from '../executionScheduler';
import { extractPriorPhaseContext, buildEffectiveTaskView, buildEffectiveTestPlanView } from './phaseContext';
import { runPacketSynthesisSubPhase } from './packetSynthesis';
import { runScaffoldSynthesis, copyEngineeringConstitution, type ScaffoldManifest } from './scaffoldSynthesis';
import { runScaffoldingAgentSubPhase } from './scaffoldingAgent';
import { runModuleOwnershipPlanningSubPhase, type ModuleOwnershipPlan } from './moduleOwnershipPlanner';
import { buildCompositionRootLeaf } from './compositionRoot';
import { runPhase9ReconSubPhase, reconGlobalGates, buildReconEnforcementManifest } from './phase9Recon';
import { runCycleControllerSubPhase, decideRestartTarget } from './cycleController';
import { randomUUID } from 'node:crypto';
import type { ImplementationPacketContent } from '../../types/records';
import { emit as aoddEmit } from '../../aodd';

export class Phase9Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '9';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];
    const generateId = () => randomUUID();

    // ── Initialize Execution Context Builder ───────────────────────
    const execContextBuilder = new ExecutionContextBuilder(
      engine.db,
      engine.writer,
      {
        stdinMaxTokens: 8000,
        detailFileMaxBytes: 100000,
        detailFilePathTemplate: `${engine.workspacePath}/.janumicode/runs/{workflow_run_id}/context/{sub_phase_id}_{invocation_id}.md`,
        workspacePath: engine.workspacePath,
        janumiCodeVersionSha: engine.janumiCodeVersionSha,
      },
      engine.templateLoader,
    );

    // ── Initialize Executor Agent ──────────────────────────────────
    // Resolve the executor backing tool from config:
    //   llm_routing.executor.primary.backing_tool — when set, picks
    //   which CLI runs Phase 9 tasks (claude_code_cli / goose_cli /
    //   gemini_cli / codex_cli). Default executor falls back to
    //   claude_code_cli when the config key is absent. cal-22+ uses
    //   goose_cli + ollama qwen-3.5:9b for cost containment.
    //
    // Env override: JANUMICODE_EXECUTOR_BACKING_TOOL takes precedence
    // over config so operators can flip executors per-run without
    // editing janumicode.json.
    const cfg = engine.configManager.get();
    const cfgExecutor = cfg.llm_routing.executor?.primary;
    const envExecutor = process.env.JANUMICODE_EXECUTOR_BACKING_TOOL;
    const executorBackingTool = (envExecutor ?? cfgExecutor?.backing_tool) as
      ExecutorBackingTool | undefined;
    // Calibration runs flip this on so the executor can run Bash to
    // self-verify (e.g. `node --test` to confirm the tests it just
    // wrote actually pass). Production CLI / VS Code use cases keep
    // it off so permission prompts surface to the human as designed.
    // Resolution: per-workflow config beats env var; default false.
    const cfgExecution = (cfg as unknown as { execution?: { unattended_skip_permissions?: boolean } }).execution;
    const unattendedSkipPermissions =
      cfgExecution?.unattended_skip_permissions === true
      || process.env.JANUMICODE_EXECUTOR_UNATTENDED === '1';
    // Workflow-level override (e.g. `--thin-slice` pins to goose_cli).
    // Read here so calibration runs route every Phase 9 task through a
    // single executor regardless of what Phase 6 planner emitted.
    const forcedExecutorBackingTool = (cfg as unknown as {
      workflow?: { force_executor_backing_tool?: ExecutorBackingTool };
    }).workflow?.force_executor_backing_tool ?? undefined;
    const executorAgent = new ExecutorAgent(
      engine.db,
      engine.agentInvoker,
      engine.writer,
      engine.eventBus,
      generateId,
      { executorBackingTool, unattendedSkipPermissions, forcedExecutorBackingTool },
    );

    // ── Extract artifacts from prior phases ────────────────────────
    const artifacts = execContextBuilder.extractArtifacts(workflowRun.id);
    const planRecord = engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced')
      .find(r => (r.content as Record<string, unknown>).kind === 'implementation_plan');

    // ── 9.0 — Packet Synthesis (NEW) ─────────────────────────
    // Bundles upstream context (user stories, ACs, NFRs, component
    // contract, data models, APIs, test cases, eval criteria, technical
    // constraints, compliance items) into one implementation_packet
    // per atomic Phase 6.1a task. Phase 9's executor then receives the
    // packet's rendered context — the structural ts-16 fix that gives
    // the executor everything it needs without inventing.
    // See docs/design/implementation-packet-synthesis.md.
    // setSubPhase BEFORE the work so the audit-pause hook fires at the
    // Phase 8 → 9 / packet_synthesis boundary, giving the operator a
    // chance to verify Phase 8 outputs before packet bundling begins.
    // The next setSubPhase below (implementation_task_execution) then
    // pauses on packet_synthesis EXIT — letting the operator verify
    // packet contents before any executor LLM call fires.
    // ── 9.0a — Scaffold Synthesis (Lever 2a) ─────────────────
    // BEFORE packet synthesis and any executor leaf: materialize ONE
    // canonical project config + a shared module directory from
    // interface_contracts + data_models, so leaves import shared modules
    // and conform to a single pinned convention instead of reinventing
    // dependencies divergently. The returned manifest (protected paths +
    // conventions + canonical files) is threaded to the scheduler so the
    // executor context says "import, don't reinvent" (2b) and the post-leaf
    // guard can quarantine writes into the shared/root scope.
    // ── 9.0(recon) — Reconnaissance (Stage 1+2, agentic kernel) ───
    // FIRST in Phase 9.0: with the filesystem facts + advisory intent in hand,
    // decide per-area stack + per-area verification gates (evidence-backed
    // JUDGMENT, deterministic fallback). Runs before ownership/scaffold/packet
    // so downstream reflects per-area decisions; its per-area gates feed the
    // stabilization loop. Increment 1: produced + gates consumed; kernel
    // author→enforce retirement is a later increment, so the deterministic
    // scaffold below still runs and the greenfield path is unaffected.
    engine.stateMachine.setSubPhase(workflowRun.id, 'reconnaissance');
    const reconPlan = await runPhase9ReconSubPhase({ workflowRun, engine });

    // ── 9.0a(i) — Module-Ownership Planning (Tier A coordination) ──
    // Deterministically resolve, from the leaf tasks' read-path demand + the
    // component sync_call graph + data-model ownership, a SINGLE owner +
    // canonical path per shared module and producer-before-consumer ordering.
    // Runs before scaffold so the layout can declare the canonical paths, and
    // is threaded to the scheduler for ordering + the executor's import
    // directives ("import X from <canonical>, owned by <component>; do NOT
    // reinvent") — the fix for the divergent-duplicate modules.
    engine.stateMachine.setSubPhase(workflowRun.id, 'module_ownership_planning');
    const ownershipPlan = runModuleOwnershipPlanningSubPhase({ workflowRun, engine });

    // ── 9.0 — Scaffolding (Stage 1+2 inc.2: REPLACE) ──────────────
    // The scaffolding AGENT authors the project skeleton from the recon plan
    // (per-area stack + canonical modules + aliases); the kernel only enforces.
    // The deterministic materializer is a CATASTROPHIC SAFETY NET (not a hybrid
    // fast-path): if the agent produced no primary dependency manifest — a
    // foundational failure that would break every downstream leaf — fall back
    // to it. Enforcement source matches whoever authored: recon when the agent
    // succeeded, the scaffold manifest when the safety net ran.
    engine.stateMachine.setSubPhase(workflowRun.id, 'scaffold_synthesis');
    const reconEnforcement = buildReconEnforcementManifest(reconPlan);
    reconEnforcement.engineering_constitution_path = copyEngineeringConstitution(
      engine.workspacePath,
      (cfg as unknown as { scaffold?: { engineering_constitution_path?: string } }).scaffold?.engineering_constitution_path,
    );
    let scaffoldManifest: ScaffoldManifest | null = null;
    const scaffoldingResult = await runScaffoldingAgentSubPhase({ workflowRun, engine }, reconPlan, executorAgent);
    if (!scaffoldingResult.producedPrimaryManifest) {
      getLogger().warn('workflow', 'Phase 9.0: scaffolding agent produced no primary manifest — catastrophic safety net (deterministic materializer)', {
        workflow_run_id: workflowRun.id, manifests_present: scaffoldingResult.manifestsPresent,
      });
      try {
        scaffoldManifest = runScaffoldSynthesis({ workflowRun, engine });
      } catch (err) {
        getLogger().warn('workflow', 'Phase 9.0a scaffold_synthesis safety-net failed (continuing without scaffold)', {
          workflow_run_id: workflowRun.id, error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    engine.stateMachine.setSubPhase(workflowRun.id, 'packet_synthesis');
    const packetResult = runPacketSynthesisSubPhase({ workflowRun, engine });
    const packetByTaskId = new Map<string, ImplementationPacketContent>();
    for (const p of packetResult.packets) {
      packetByTaskId.set(p.task.id, p);
    }
    getLogger().info('workflow', 'Phase 9.0 packet_synthesis complete', {
      workflow_run_id: workflowRun.id,
      packets_total: packetResult.packets.length,
      packets_failed: packetResult.failedPackets,
      blocking_failures: packetResult.totalBlockingFailures,
      advisory_findings: packetResult.totalAdvisoryFindings,
      ai_proposed_root_count: packetResult.totalAiProposedRoots,
    });

    // ── 9.0b — Pre-execution self-correction (Pillar D) ───────
    // With the id-integrity layer (Pillars A–C) the coherence failures are now
    // REAL (no false-P7 flood). If routable blocking failures remain, route
    // back to the responsible upstream phase to REGENERATE before executing on
    // broken packets — bounded by max_cycles_per_release. At/over the cap, or
    // when no delta phase can fix it, fall through to execution; the
    // end-of-Phase-9 cycle_controller surfaces the ceiling to the operator.
    if (packetResult.totalBlockingFailures > 0) {
      const cycleNumber = workflowRun.current_cycle_number ?? 0;
      const cfgMaxCycles = (cfg as unknown as { execution?: { max_cycles_per_release?: number } })
        .execution?.max_cycles_per_release ?? 3;
      const maxCycles = workflowRun.max_cycles_per_release ?? cfgMaxCycles;
      const restart = decideRestartTarget({ workflowRun, engine });
      if (restart && cycleNumber + 1 <= maxCycles) {
        getLogger().warn('workflow', 'Phase 9.0b: routable packet coherence failures — regenerating before execution', {
          workflow_run_id: workflowRun.id, target_phase: restart.target, reason: restart.reason,
          cycle_number: cycleNumber, max_cycles: maxCycles,
          blocking_failures: packetResult.totalBlockingFailures,
        });
        return { success: true, artifactIds, cycleRestartTo: restart.target };
      }
    }

    // ── 9.1 — Implementation Task Execution ───────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'implementation_task_execution');

    // Wave 8 — prefer Phase 6.1a leaf tasks when available so the
    // executor sees the decomposed atomic-unit set rather than the
    // coarse Phase 6.1 root plan. Falls back to the flat plan when no
    // tree exists.
    const allArtifactRecords = engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced');
    const priorForTasks = extractPriorPhaseContext(allArtifactRecords);
    const taskNodes = engine.writer.getRecordsByType(workflowRun.id, 'task_decomposition_node');
    const effectiveTasks = buildEffectiveTaskView(taskNodes, priorForTasks);
    if (effectiveTasks.source === 'leaves') {
      getLogger().info('workflow', 'Phase 9: consuming Wave 8 task leaves', {
        leafCount: effectiveTasks.leafCount,
        rootCount: effectiveTasks.rootCount,
      });
    }
    const tasks: CtxTask[] = (effectiveTasks.source === 'leaves'
      ? (effectiveTasks.tasks as unknown as CtxTask[])
      : (artifacts.implementationPlan ?? []));

    // ── Wave R — release-plan-driven execution scheduler ──────────
    // Replaces the prior flat for-loop with wave-based scheduling.
    // Reads the Phase 1.8 release_plan, slices leaves by release ordinal,
    // runs each wave with per-leaf retries + reasoning_review +
    // per-leaf tests + quarantine + wave gate, then a deferred-batch
    // wave for any quarantined leaves.
    const releasePlanRecord = allArtifactRecords.find(
      r => (r.content as Record<string, unknown>).kind === 'release_plan',
    );
    const releasePlan = releasePlanRecord
      ? (releasePlanRecord.content as unknown as ReleasePlanContentV2)
      : null;
    const releases: SchedulerReleaseEntry[] = releasePlan?.releases?.map(r => ({
      release_id: r.release_id,
      release_ordinal: r.ordinal,
      release_name: r.name,
    })) ?? [];

    // Cast leaves to SchedulerLeaf (enriches with release_id /
    // release_ordinal / _leaf_node_id from buildEffectiveTaskView).
    const schedulerLeaves: SchedulerLeaf[] = tasks.map(t => {
      const meta = t as unknown as Record<string, unknown>;
      return {
        ...t,
        release_id: (meta._leaf_release_id as string | undefined)
          ?? (meta.release_id as string | null | undefined)
          ?? null,
        release_ordinal: (meta._leaf_release_ordinal as number | null | undefined)
          ?? (meta.release_ordinal as number | null | undefined)
          ?? null,
        _leaf_node_id: meta._leaf_node_id as string | undefined,
      };
    });

    // Bakeoff/experiment lever: cap the implemented leaf set to the first N
    // (JANUMICODE_BAKEOFF_MAX_LEAVES). A model bakeoff measures per-leaf code
    // quality on a few representative leaves — running all ~20 is hours per
    // candidate. The composition root is injected AFTER this, so the capped
    // project still wires + gates. Unset/<=0 ⇒ no cap (normal runs).
    const leafCapRaw = Number.parseInt(process.env.JANUMICODE_BAKEOFF_MAX_LEAVES ?? '', 10);
    if (Number.isFinite(leafCapRaw) && leafCapRaw > 0 && schedulerLeaves.length > leafCapRaw) {
      getLogger().warn('workflow', 'Phase 9: BAKEOFF leaf cap applied — implementing a SUBSET', {
        workflow_run_id: workflowRun.id, cap: leafCapRaw, original_leaf_count: schedulerLeaves.length,
      });
      schedulerLeaves.length = leafCapRaw;
    }

    // Tier-A injection #3 — the COMPOSITION ROOT ("make it run"). Slice-144:
    // app bootstrap/wiring was nobody's task, so the run produced a parts bin
    // (no entrypoint, framework type-shimmed instead of installed). Injected
    // deterministically (not via Phase 6) because the NFR/operational gates
    // legitimately prune "start the server"-shaped items from functional
    // decomposition. Depends on every other leaf + carries no release →
    // lands last; owns the GLOBAL verification gate (src-wide write scope)
    // now that ordinary leaf gates are scoped to their own write dirs.
    if (schedulerLeaves.length > 0) {
      const icRecord = engine.writer.getArtifactByKind(workflowRun.id, 'interface_contracts');
      const icContracts = ((icRecord?.content as Record<string, unknown> | undefined)
        ?.contracts as Array<{ id: string; protocol?: string; data_format?: string }> | undefined) ?? [];
      schedulerLeaves.push(buildCompositionRootLeaf(schedulerLeaves, scaffoldManifest, icContracts));
      getLogger().info('workflow', 'Phase 9: composition-root leaf injected', {
        workflow_run_id: workflowRun.id,
        depends_on: schedulerLeaves.length - 1,
        contracts: icContracts.length,
      });
    }

    const scheduler = new ExecutionScheduler(
      engine,
      engine.writer,
      execContextBuilder,
      executorAgent,
      artifacts,
      {
        // Cap at 2 attempts (was 3). Calibrated from thin-slice-13
        // where extra retries past 2 dominated the wall-clock budget
        // without often yielding a successful task. The no-content
        // detector in cliInvoker already short-circuits stuck tasks
        // sooner than the per-call wall-clock used to, so each attempt
        // is also less likely to drag.
        leafRetryBudget: cfg.execution?.leaf_retry_budget ?? 2,
        deferredRetryBudget: cfg.execution?.deferred_retry_budget ?? 2,
        autoApproveWaveGates: cfg.execution?.auto_approve_wave_gates ?? false,
        testsPerLeaf: {
          enabled: cfg.execution?.tests_per_leaf?.enabled ?? true,
          resolution: cfg.execution?.tests_per_leaf?.test_command_resolution ?? 'package_json_scripts',
          timeoutMs: cfg.execution?.tests_per_leaf?.timeout_ms ?? 120_000,
        },
        stabilizationBudget: (cfg as unknown as { execution?: { stabilization_budget?: number } })
          .execution?.stabilization_budget ?? 2,
      },
      generateId,
    );

    // Inject the packet map so each leaf's executor invocation sees the
    // full bundled context (user stories, ACs, tests, etc.).
    if (packetByTaskId.size > 0) {
      scheduler.setPacketContext(packetByTaskId);
    }

    // Enforcement source matches whoever authored the skeleton: recon when the
    // scaffolding agent succeeded (the polyglot path), the scaffold manifest
    // when the deterministic safety net ran. Both feed the executor "import,
    // don't reinvent" directives + the post-leaf protected-path guard.
    if (scaffoldManifest) {
      scheduler.setScaffoldManifest(scaffoldManifest);
    } else {
      scheduler.setReconEnforcement(reconEnforcement);
    }

    // Tier-A coordination: hand the (deterministic, TS-shaped) ownership plan to
    // the scheduler ONLY on the safety-net path. Under the recon Replace path
    // it is superseded: the scaffolding agent pre-authors the canonical shared
    // modules and the recon enforcement's conventions already carry the
    // "import the canonical module, don't reinvent" directive — so applying the
    // deterministic plan too would duplicate/conflict (and mis-shape paths for a
    // non-TS area).
    if (ownershipPlan && scaffoldManifest) {
      scheduler.setOwnershipPlan(ownershipPlan);
    }

    const scheduleResult = await scheduler.run({
      workflowRunId: workflowRun.id,
      workspacePath: engine.workspacePath,
      janumiCodeVersionSha: engine.janumiCodeVersionSha,
      leaves: schedulerLeaves,
      releases,
      // Recon-authored per-area gates supersede the stabilization loop's
      // generic manifest-detection resolver (empty ⇒ scheduler falls back).
      globalGates: reconGlobalGates(reconPlan),
    });

    getLogger().info('workflow', 'Wave R: scheduler completed', {
      total_waves: scheduleResult.totalWaves,
      successful: scheduleResult.successfulLeafCount,
      quarantined: scheduleResult.quarantinedLeafCount,
      rescued: scheduleResult.rescuedLeafCount,
      terminally_deferred: scheduleResult.terminallyDeferredLeafCount,
      rejected_waves: scheduleResult.rejectedWaveCount,
    });

    const tasksCompleted = scheduleResult.successfulLeafCount;
    const tasksFailed = scheduleResult.terminallyDeferredLeafCount;
    const tasksQuarantined = scheduleResult.quarantinedLeafCount;

    const executionRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '9',
      sub_phase_id: 'implementation_task_execution',
      produced_by_agent_role: 'executor_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: planRecord ? [planRecord.id] : [],
      content: {
        kind: 'execution_summary',
        sub_phase: '9.1_implementation',
        tasks_attempted: schedulerLeaves.length,
        tasks_completed: tasksCompleted,
        tasks_failed: tasksFailed,
        tasks_quarantined: tasksQuarantined,
        rescued: scheduleResult.rescuedLeafCount,
        terminally_deferred: scheduleResult.terminallyDeferredLeafCount,
        wave_count: scheduleResult.totalWaves,
        rejected_waves: scheduleResult.rejectedWaveCount,
        execution_trace_count: scheduleResult.invocationIds.length,
        wave_outcomes: scheduleResult.waveOutcomes,
        // Closing-act stabilization outcome — the language-AGNOSTIC build/test
        // signal (per-stack GateCommands), as opposed to the TS-only tsc count
        // in the Phase-10 consistency_report. null ⇒ gates green or no gates.
        stabilization_residual: scheduleResult.stabilizationResidual,
        stabilization_gates_passed: scheduleResult.stabilizationResidual === null,
      },
    });
    artifactIds.push(executionRecord.id);
    engine.ingestionPipeline.ingest(executionRecord);

    // ── 9.1b — Cross-run modification records (spec §8.8, §10.1) ──
    // For each completed Refactoring Task (executed successfully OR skipped as
    // already-applied/idempotent), emit a cross_run_modification documenting
    // that this run changed a prior-run Implementation Artifact. Phase 10.1
    // verifies one exists per Refactoring Task before the commit gate.
    if (workflowRun.cross_run_impact_triggered) {
      artifactIds.push(...this.emitCrossRunModifications(ctx, effectiveTasks, scheduleResult));
    }

    // ── 9.2 — Test Execution ──────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'test_execution');

    // Wave 10 — prefer Phase 7.1a test leaves when available so the
    // wave-aggregate test runner sees decomposed atomic-step cases
    // rather than coarse Phase 7.1 root cases. Falls back to the flat
    // plan when no tree exists.
    const testNodes = engine.writer.getRecordsByType(workflowRun.id, 'test_decomposition_node');
    const effectiveTests = buildEffectiveTestPlanView(testNodes, priorForTasks);
    let testSuites: TestSuite[] = [];
    if (effectiveTests.source === 'leaves') {
      getLogger().info('workflow', 'Phase 9.2: consuming Wave 10 test leaves', {
        leafCount: effectiveTests.leafCount,
        rootCount: effectiveTests.rootCount,
      });
      // Adapt buildEffectiveTestPlanView shape into TestRunner suites.
      for (const s of effectiveTests.test_suites) {
        testSuites.push({
          id: s.suite_id,
          name: `${s.test_type.charAt(0).toUpperCase() + s.test_type.slice(1)} Tests (${s.component_id})`,
          type: s.test_type,
          testFilePaths: s.test_cases
            .map(tc => tc.test_file_path ?? '')
            .filter(p => p.length > 0),
          validatesTaskIds: [],
          coversCriteriaIds: s.test_cases.flatMap(tc => tc.acceptance_criterion_ids),
        });
      }
    } else {
      const testPlanRecord = engine.db.prepare(`
        SELECT content FROM governed_stream
        WHERE workflow_run_id = ? AND record_type = 'artifact_produced'
        AND json_extract(content, '$.kind') = 'test_plan'
        ORDER BY produced_at DESC LIMIT 1
      `).get(workflowRun.id) as { content: string } | undefined;
      testSuites = testPlanRecord
        ? this.extractTestSuites(testPlanRecord.content, generateId)
        : [];
    }

    const testRunner = new TestRunner(
      engine.db,
      engine.writer,
      engine.eventBus,
      generateId,
    );

    const testResults = await testRunner.runSuites(
      testSuites,
      engine.workspacePath,
      workflowRun.id,
      engine.janumiCodeVersionSha,
    );

    const testResultsRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '9',
      sub_phase_id: 'test_execution',
      produced_by_agent_role: 'executor_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [executionRecord.id],
      content: {
        kind: 'test_results',
        suite_results: testResults.suiteResults.map(sr => ({
          suite_id: sr.suiteId,
          suite_name: sr.suiteName,
          passed: sr.passed,
          failed: sr.failed,
          skipped: sr.skipped,
          duration_ms: sr.durationMs,
        })),
        total_passed: testResults.totalPassed,
        total_failed: testResults.totalFailed,
        total_skipped: testResults.totalSkipped,
        execution_order: ['unit', 'integration', 'end_to_end'],
      },
    });
    artifactIds.push(testResultsRecord.id);
    engine.ingestionPipeline.ingest(testResultsRecord);

    // ── 9.3 — Evaluation Execution ────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'evaluation_execution');

    // Load evaluation plan to get criteria
    const evalPlanRecord = engine.db.prepare(`
      SELECT content FROM governed_stream
      WHERE workflow_run_id = ? AND record_type = 'artifact_produced'
      AND json_extract(content, '$.kind') IN ('functional_evaluation_plan', 'quality_evaluation_plan', 'reasoning_evaluation_plan')
      ORDER BY produced_at DESC
    `).all(workflowRun.id) as Array<{ content: string }>;

    const evalCriteria: EvaluationCriterion[] = evalPlanRecord
      .flatMap(r => this.extractEvalCriteria(r.content, generateId));

    const evalRunner = new EvalRunner(
      engine.db,
      engine.writer,
      engine.eventBus,
      engine.llmCaller,
      generateId,
    );

    const evalResults = await evalRunner.runEvaluations(
      evalCriteria,
      {
        workflowRunId: workflowRun.id,
        workspacePath: engine.workspacePath,
        executionSummary: executionRecord.content,
        testResults: testResultsRecord.content,
      },
      engine.janumiCodeVersionSha,
    );

    const evalResultsRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '9',
      sub_phase_id: 'evaluation_execution',
      produced_by_agent_role: 'eval_execution_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [executionRecord.id, testResultsRecord.id],
      content: {
        kind: 'evaluation_results',
        functional: evalResults.functional.map(r => ({
          criterion_id: r.criterionId,
          criterion_name: r.criterionName,
          passed: r.passed,
        })),
        quality: evalResults.quality.map(r => ({
          criterion_id: r.criterionId,
          criterion_name: r.criterionName,
          metric: r.metric,
          passed: r.passed,
        })),
        reasoning: evalResults.reasoning.map(r => ({
          criterion_id: r.criterionId,
          criterion_name: r.criterionName,
          passed: r.passed,
          severity: r.severity,
        })),
        overall_pass: evalResults.overallPass,
      },
    });
    artifactIds.push(evalResultsRecord.id);
    engine.ingestionPipeline.ingest(evalResultsRecord);

    // ── 9.4 — Quarantine summary ───────────────────────────────
    // Wave R replaces the prior abort/skip failure handler with the
    // scheduler's per-leaf retry budget + quarantine ledger. Each
    // quarantined leaf already has a task_quarantine record. Roll up a
    // summary so downstream consumers (workflow run summary, future
    // brownfield retries) see the gap surface.
    if (tasksQuarantined > 0 || tasksFailed > 0) {
      engine.stateMachine.setSubPhase(workflowRun.id, 'execution_synthesis');

      const quarantineRecords = engine.writer.getRecordsByType(workflowRun.id, 'task_quarantine');
      const latestByLeaf = new Map<string, TaskQuarantineContent>();
      for (const r of quarantineRecords) {
        const c = r.content as unknown as TaskQuarantineContent;
        if (!latestByLeaf.has(c.leaf_task_id)) latestByLeaf.set(c.leaf_task_id, c);
      }
      const summary = engine.writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: workflowRun.id,
        phase_id: '9',
        sub_phase_id: 'execution_synthesis',
        produced_by_agent_role: 'orchestrator',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        derived_from_record_ids: [executionRecord.id],
        content: {
          kind: 'quarantine_summary',
          quarantined_count: tasksQuarantined,
          rescued_count: scheduleResult.rescuedLeafCount,
          terminally_deferred_count: tasksFailed,
          quarantined_leaves: [...latestByLeaf.values()].map(q => ({
            leaf_task_id: q.leaf_task_id,
            wave_number: q.wave_number,
            release_id: q.release_id,
            release_ordinal: q.release_ordinal,
            attempt_count: q.attempts.length,
            quarantine_reason: q.quarantine_reason,
            rescue_status: q.rescue_status,
          })),
        },
      });
      artifactIds.push(summary.id);
      engine.ingestionPipeline.ingest(summary);
    }

    // ── 9.5 — Final phase summary ──────────────────────────────
    // Wave R: per-wave gates already gated each release as it
    // finished. This sub-phase is now a thin terminal mirror that
    // aggregates across wave_gate_decision records and presents the
    // overall workflow execution outcome (test totals + eval pass +
    // wave decisions) for the final phase gate.
    engine.stateMachine.setSubPhase(workflowRun.id, 'execution_gate');

    const waveGateRecords = engine.writer.getRecordsByType(workflowRun.id, 'wave_gate_decision');
    const waveDecisions = waveGateRecords.map(r => r.content as unknown as WaveGateDecisionContent);
    const anyRejected = waveDecisions.some(d => d.decision === 'rejected');

    const execMirror = engine.mirrorGenerator.generate({
      artifactId: executionRecord.id,
      artifactType: 'execution_summary',
      content: {
        total_waves: scheduleResult.totalWaves,
        leaves_successful: tasksCompleted,
        leaves_quarantined: tasksQuarantined,
        leaves_rescued: scheduleResult.rescuedLeafCount,
        leaves_terminally_deferred: tasksFailed,
        rejected_waves: scheduleResult.rejectedWaveCount,
        tests_passed: testResults.totalPassed,
        tests_failed: testResults.totalFailed,
        eval_pass: evalResults.overallPass,
      },
    });

    const mirrorRecord = engine.writer.writeRecord({
      record_type: 'mirror_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '9',
      sub_phase_id: 'execution_gate',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [executionRecord.id, testResultsRecord.id, evalResultsRecord.id],
      content: {
        kind: 'execution_completion_mirror',
        mirror_id: execMirror.mirrorId,
        fields: execMirror.fields,
        wave_decisions: waveDecisions.map(d => ({
          wave_number: d.wave_number,
          wave_kind: d.wave_kind,
          decision: d.decision,
          rolled_back: d.rolled_back ?? false,
        })),
      },
    });
    artifactIds.push(mirrorRecord.id);
    engine.eventBus.emit('mirror:presented', { mirrorId: execMirror.mirrorId, artifactType: 'execution_summary' });

    // Auto-approve the terminal mirror under unattended/calibration
    // mode (the per-wave gates already had their own auto-approve
    // applied; surfacing this one too keeps the pause-free run path
    // coherent). Otherwise pause for the human.
    if (cfg.execution?.auto_approve_wave_gates !== true) {
      try {
        const resolution = await engine.pauseForDecision(workflowRun.id, mirrorRecord.id, 'mirror');
        if (resolution.type === 'mirror_rejection') {
          return { success: false, error: 'User rejected execution results', artifactIds };
        }
      } catch (err) {
        getLogger().warn('workflow', 'Phase 9 approval failed', { error: String(err) });
        return { success: false, error: 'Execution approval failed', artifactIds };
      }
    } else {
      getLogger().info('workflow', 'Wave R: terminal mirror auto-approved (auto_approve_wave_gates=true)');
    }
    void anyRejected;

    // Phase Gate — derived from REAL execution state, not hardcoded clean
    // (Stage 0). High-severity = something genuinely unresolved blocks the
    // run: terminally-deferred leaves, a rejected wave, failed global tests,
    // or failed evaluation.
    //
    // IMPORTANT: do NOT use scheduleResult.quarantinedLeafCount for high
    // severity — the scheduler ACCUMULATES it and never decrements it on a
    // deferred rescue (executionScheduler.ts: `quarantinedLeafCount +=` vs the
    // rescue path's `rescuedLeafCount++`), so a run whose quarantines were all
    // rescued would be falsely flagged. A quarantine that NEEDED a rescue is a
    // (resolved) warning, not a flaw. (A stabilization residual will OR into
    // has_high_severity_flaws in Stage 0.5 once that loop exists.)
    const execHighSeverity =
      scheduleResult.terminallyDeferredLeafCount > 0
      || scheduleResult.rejectedWaveCount > 0
      || scheduleResult.stabilizationResidual != null
      || testResults.totalFailed > 0
      || !evalResults.overallPass;
    const execUnresolvedWarnings =
      scheduleResult.quarantinedLeafCount > 0
      || testResults.totalSkipped > 0;
    const gateRecord = engine.writer.writeRecord({
      record_type: 'phase_gate_evaluation',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '9',
      sub_phase_id: 'execution_gate',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [executionRecord.id, testResultsRecord.id, evalResultsRecord.id],
      content: {
        kind: 'phase_gate',
        phase_id: '9',
        has_unresolved_warnings: execUnresolvedWarnings,
        has_high_severity_flaws: execHighSeverity,
      },
    });
    artifactIds.push(gateRecord.id);
    engine.eventBus.emit('phase_gate:pending', { phaseId: '9' });
    aoddEmit('gate.pending', { gate_kind: 'phase_gate' });

    // ── 9.9 — Cycle Controller ─────────────────────────────
    // Decides whether to terminate (advance to Phase 10) or loop back
    // to Phase 6/7/8 to fill gaps surfaced by packet_synthesis. The
    // orchestrator main loop honors PhaseResult.cycleRestartTo by
    // calling StateMachine.cycleRestartPhase.
    // See docs/design/iterative-implementation-backlog.md §4.
    const cycleResult = await runCycleControllerSubPhase({ workflowRun, engine }, {
      atomicLeavesProduced: scheduleResult.successfulLeafCount,
      deferredLeavesRemaining: scheduleResult.terminallyDeferredLeafCount,
    });
    artifactIds.push(cycleResult.recordId);

    if (cycleResult.abort) {
      return { success: false, error: 'Operator aborted at cycle ceiling mirror', artifactIds };
    }
    if (cycleResult.cycleRestartTo) {
      return { success: true, artifactIds, cycleRestartTo: cycleResult.cycleRestartTo };
    }
    return { success: true, artifactIds };
  }

  /**
   * Extract test suites from test_plan artifact content.
   */
  /**
   * Convert a Phase 7 test plan into TestRunner suites.
   *
   * Phase 7's prompt template emits test_plan as:
   *   { kind: 'test_plan', test_suites: [
   *       { suite_id, component_id, test_type, test_cases: [
   *           { test_case_id, type, acceptance_criterion_ids[],
   *             preconditions[], expected_outcome }
   *       ] }
   *   ] }
   *
   * The earlier extractor read `plan.test_cases` — a flat path that
   * doesn't exist in that shape, so cal-22b found zero test cases,
   * built zero suites, and Phase 9.2 reported `suite_results: []`.
   *
   * This walker handles both shapes (the nested production shape and
   * a legacy flat shape some fixtures may still use). Note the
   * deeper architectural limitation: Phase 7's test cases are prose
   * specifications, not test-file references. Without `testFilePaths`
   * the runner has nothing to execute. Wave R replaces this with
   * per-leaf test execution inside the executor loop where the
   * executor authors AND runs the tests against its own writes.
   */
  /**
   * Emit a `cross_run_modification` record for each completed Refactoring Task
   * (spec §8.8 / §10.1). "Completed" = executed successfully in the scheduler
   * OR skipped as already-applied (refactoring_skipped_idempotent — the
   * idempotency protocol treats a verified prior application as done). Metadata
   * (prior run, target artifact, modification_type, impact report) is read back
   * from the run's refactoring_scope, keyed by task id.
   */
  private emitCrossRunModifications(
    ctx: PhaseContext,
    effectiveTasks: { tasks: Array<Record<string, unknown>> },
    scheduleResult: { successfulLeafIds: string[] },
  ): string[] {
    const { engine, workflowRun } = ctx;
    const runId = workflowRun.id;
    const out: string[] = [];

    const refactoringLeafIds = effectiveTasks.tasks
      .filter(t => t.task_type === 'refactoring' && typeof t.id === 'string')
      .map(t => t.id as string);
    if (refactoringLeafIds.length === 0) return out;

    // Per-task metadata from the refactoring_scope (newest wins).
    const scopes = engine.writer.getRecordsByType(runId, 'refactoring_scope');
    const metaById = new Map<string, Record<string, unknown>>();
    let impactReportId = '';
    if (scopes.length > 0) {
      const scope = scopes.reduce((a, b) => (a.produced_at >= b.produced_at ? a : b));
      const content = scope.content as Record<string, unknown>;
      impactReportId = typeof content.cross_run_impact_report_id === 'string'
        ? content.cross_run_impact_report_id : '';
      const tasks = Array.isArray(content.refactoring_tasks) ? content.refactoring_tasks : [];
      for (const raw of tasks as Array<Record<string, unknown>>) {
        if (typeof raw.id === 'string') metaById.set(raw.id, raw);
      }
    }

    const succeeded = new Set(scheduleResult.successfulLeafIds);
    const skipped = new Set(
      engine.writer.getRecordsByType(runId, 'refactoring_skipped_idempotent')
        .map(r => (r.content as Record<string, unknown>).task_id)
        .filter((id): id is string => typeof id === 'string'),
    );

    for (const taskId of refactoringLeafIds) {
      const wasSkipped = skipped.has(taskId);
      if (!succeeded.has(taskId) && !wasSkipped) continue; // not completed → no record
      const meta = metaById.get(taskId) ?? {};
      const modType = meta.modification_type;
      const rec = engine.writer.writeRecord({
        record_type: 'cross_run_modification',
        schema_version: '1.0',
        workflow_run_id: runId,
        phase_id: '9',
        sub_phase_id: 'implementation_task_execution',
        produced_by_agent_role: 'executor_agent',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        derived_from_record_ids: impactReportId ? [impactReportId] : [],
        content: {
          kind: 'cross_run_modification',
          current_workflow_run_id: runId,
          prior_workflow_run_id: typeof meta.target_workflow_run_id === 'string' ? meta.target_workflow_run_id : null,
          modified_artifact_id: typeof meta.target_artifact_id === 'string' ? meta.target_artifact_id : null,
          changed_interface_id: typeof meta.changed_interface_id === 'string' ? meta.changed_interface_id : null,
          modification_type: (modType === 'additive' || modType === 'breaking' || modType === 'non_breaking') ? modType : null,
          refactoring_task_id: taskId,
          verification_passed: true,
          applied_status: wasSkipped ? 'skipped_idempotent' : 'applied',
          cross_run_impact_report_id: impactReportId || null,
        },
      });
      engine.ingestionPipeline.ingest(rec);
      out.push(rec.id);
    }
    if (out.length > 0) {
      getLogger().info('workflow', 'Phase 9.1: emitted cross_run_modification records', {
        workflow_run_id: runId, count: out.length,
      });
    }
    return out;
  }

  private extractTestSuites(
    testPlanContent: string,
    generateId: () => string,
  ): TestSuite[] {
    let plan: Record<string, unknown>;
    try {
      plan = JSON.parse(testPlanContent);
    } catch {
      getLogger().warn('workflow', 'Failed to parse test_plan content');
      return [];
    }

    const flatCases: Array<Record<string, unknown>> = [];
    const nestedSuites = (plan.test_suites ?? []) as Array<Record<string, unknown>>;
    if (Array.isArray(nestedSuites) && nestedSuites.length > 0) {
      // Production shape: walk each suite's test_cases.
      for (const ns of nestedSuites) {
        const cases = (ns.test_cases ?? []) as Array<Record<string, unknown>>;
        // Inherit the suite's test_type onto each case if the case
        // didn't set its own — Phase 7 puts the type on the suite.
        const suiteType = ns.test_type as string | undefined;
        for (const c of cases) {
          flatCases.push({ ...c, _inherited_type: suiteType, _suite_id: ns.suite_id });
        }
      }
    } else {
      // Legacy flat shape.
      const top = (plan.test_cases ?? []) as Array<Record<string, unknown>>;
      flatCases.push(...top);
    }

    const suites: TestSuite[] = [];

    // Group test cases by suite type
    const byType = new Map<string, Array<Record<string, unknown>>>();
    for (const tc of flatCases) {
      const type = (tc.suite_type ?? tc._inherited_type ?? tc.type ?? 'unit') as string;
      // Normalize Phase 7's `e2e` / `end_to_end` / `endToEnd` variants
      // onto the runner's internal label.
      const normalized = type === 'e2e' || type === 'endToEnd' ? 'end_to_end' : type;
      if (!byType.has(normalized)) byType.set(normalized, []);
      byType.get(normalized)!.push(tc);
    }

    // Build TestSuite objects
    for (const [type, cases] of byType) {
      suites.push({
        id: generateId(),
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} Tests`,
        type: type as 'unit' | 'integration' | 'end_to_end',
        testFilePaths: cases
          .map(c => (c.test_file_path ?? c.filePath ?? '') as string)
          .filter(p => p),
        validatesTaskIds: cases
          .flatMap(c => (c.validates_task_ids ?? []) as string[]),
        coversCriteriaIds: cases
          .flatMap(c => {
            // Phase 7 emits acceptance_criterion_ids as an array;
            // legacy fixtures used singular acceptance_criterion_id.
            const arr = c.acceptance_criterion_ids;
            if (Array.isArray(arr)) return arr.filter(id => typeof id === 'string') as string[];
            const single = (c.acceptance_criterion_id ?? c.criterion_id ?? '') as string;
            return single ? [single] : [];
          }),
      });
    }

    return suites;
  }

  /**
   * Extract evaluation criteria from evaluation plan artifact content.
   */
  /**
   * Convert a Phase 8 evaluation plan into the unified
   * EvaluationCriterion shape Phase 9.3's EvalRunner consumes.
   *
   * Phase 8 emits THREE distinct artifact kinds, each with its own
   * domain-specific field names:
   *   - `functional_evaluation_plan.criteria[]` — items shaped as
   *     `{ functional_requirement_id, evaluation_method, success_condition }`
   *   - `quality_evaluation_plan.criteria[]` — items shaped as
   *     `{ nfr_id, category, evaluation_tool, threshold, measurement_method }`
   *   - `reasoning_evaluation_plan.scenarios[]` — items shaped as
   *     `{ scenario_id, scenario_name, expected_reasoning, ... }`
   *
   * The earlier extractor expected a flat `c.name / c.description /
   * c.evaluation_tool` shape that Phase 8 never produces. Result:
   * cal-22b surfaced 22 "Unnamed criterion" entries with empty
   * descriptions, all marked failed regardless of actual evidence.
   *
   * This dispatcher reads the plan's `kind` to pick the right
   * field-mapping, normalizes each kind into EvaluationCriterion, and
   * fills `name` / `description` from whichever fields the LLM
   * actually populated.
   */
  private extractEvalCriteria(
    evalPlanContent: string,
    generateId: () => string,
  ): EvaluationCriterion[] {
    let plan: Record<string, unknown>;
    try {
      plan = JSON.parse(evalPlanContent);
    } catch {
      getLogger().warn('workflow', 'Failed to parse evaluation plan content');
      return [];
    }

    const kind = plan.kind as string | undefined;

    if (kind === 'functional_evaluation_plan') {
      return this.extractFunctionalCriteria(plan, generateId);
    }
    if (kind === 'quality_evaluation_plan') {
      return this.extractQualityCriteria(plan, generateId);
    }
    if (kind === 'reasoning_evaluation_plan') {
      return this.extractReasoningCriteria(plan, generateId);
    }
    // Unknown kind — fall back to legacy behaviour for any
    // already-shaped evaluation plans the LLM might emit. Keeps
    // backward compat for fixtures that match the old contract.
    return this.extractLegacyCriteria(plan, generateId);
  }

  private extractFunctionalCriteria(
    plan: Record<string, unknown>,
    generateId: () => string,
  ): EvaluationCriterion[] {
    const items = (plan.criteria ?? []) as Array<Record<string, unknown>>;
    return items.map(c => {
      const frId = (c.functional_requirement_id as string) ?? '';
      const method = (c.evaluation_method as string) ?? '';
      const condition = (c.success_condition as string) ?? '';
      const name = frId
        ? `Functional ${frId}${method ? ` (${method})` : ''}`
        : (method || 'Functional criterion');
      return {
        id: (c.id as string) ?? generateId(),
        name,
        type: 'functional' as const,
        description: condition,
        evaluationTool: method || 'llm_judge',
        acceptanceCriterionId: frId || undefined,
      };
    });
  }

  private extractQualityCriteria(
    plan: Record<string, unknown>,
    generateId: () => string,
  ): EvaluationCriterion[] {
    const items = (plan.criteria ?? []) as Array<Record<string, unknown>>;
    return items.map(c => {
      const nfrId = (c.nfr_id as string) ?? '';
      const category = (c.category as string) ?? '';
      const tool = (c.evaluation_tool as string) ?? '';
      const threshold = (c.threshold as string) ?? '';
      const measurement = (c.measurement_method as string) ?? '';
      const name = nfrId
        ? `Quality ${nfrId}${category ? ` — ${category}` : ''}`
        : (category || 'Quality criterion');
      const description = [threshold, measurement].filter(Boolean).join(' — ');
      return {
        id: (c.id as string) ?? generateId(),
        name,
        type: 'quality' as const,
        description,
        evaluationTool: tool || 'llm_judge',
        acceptanceCriterionId: nfrId || undefined,
      };
    });
  }

  private extractReasoningCriteria(
    plan: Record<string, unknown>,
    generateId: () => string,
  ): EvaluationCriterion[] {
    // Phase 8.3 emits scenarios, not criteria — each scenario tests a
    // different reasoning capability. Treat each scenario as one
    // criterion at this layer.
    const items = (plan.scenarios ?? plan.criteria ?? []) as Array<Record<string, unknown>>;
    return items.map(c => {
      const id = (c.scenario_id as string) ?? (c.id as string) ?? generateId();
      const name = (c.scenario_name as string) ?? (c.name as string) ?? `Reasoning scenario ${id}`;
      const description = (c.expected_reasoning as string) ?? (c.description as string) ?? '';
      return {
        id,
        name,
        type: 'reasoning' as const,
        description,
        evaluationTool: (c.evaluation_tool as string) ?? 'llm_judge',
      };
    });
  }

  private extractLegacyCriteria(
    plan: Record<string, unknown>,
    generateId: () => string,
  ): EvaluationCriterion[] {
    const planCriteria = (plan.criteria ?? plan.evaluation_criteria ?? []) as Array<Record<string, unknown>>;
    return planCriteria.map(c => {
      const type = (c.type ?? 'functional') as 'functional' | 'quality' | 'reasoning';
      return {
        id: (c.id as string) ?? generateId(),
        name: (c.name as string) ?? 'Unnamed criterion',
        type,
        description: (c.description as string) ?? '',
        evaluationTool: (c.evaluation_tool as string) ?? 'llm_judge',
        passingThreshold: c.passing_threshold as number | undefined,
        acceptanceCriterionId: c.acceptance_criterion_id as string | undefined,
      };
    });
  }
}
