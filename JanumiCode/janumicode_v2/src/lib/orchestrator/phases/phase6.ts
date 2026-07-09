/**
 * Phase 6 — Implementation Planning.
 * Based on JanumiCode Spec v2.3, §4 Phase 6.
 *
 * Sub-phases:
 *   6.1 — Implementation Task Decomposition (Implementation Planner LLM call)
 *   6.2 — Implementation Plan Mirror and Menu (human review)
 *   6.3 — Approval (phase gate)
 */

import { randomUUID } from 'node:crypto';
import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type {
  PhaseId,
  TechnicalConstraint,
  DecompositionTask,
  TaskCompletionCriterion,
  TaskDecompositionNodeContent,
  GovernedStreamRecord,
} from '../../types/records';
import { getLogger } from '../../logging';
import { extractPriorPhaseContext, buildEffectiveComponentView, type PriorPhaseContext } from './phaseContext';
import { buildPhaseContextPacket, type PhaseContextPacketResult } from './dmrContext';
import { pickItemsArray } from '../parsedResponseHelpers';
import { runTaskSaturationLoop } from './phase6_1a';
import { runPhase6CycleDelta } from './runCycleDelta';
import { runDownstreamScopeGatekeeper } from './downstreamGatekeeper';
import { canonicalComponentDir } from './layoutContract';
import { resolveAgainstOracle, resolveTechId } from '../idResolver';
import { buildRequirementLineage } from './packetSynthesis/idResolution';
import { emit as aoddEmit } from '../../aodd';

// ── Artifact shape interfaces ──────────────────────────────────────

interface CompletionCriterion {
  criterion_id: string;
  description: string;
  verification_method: 'schema_check' | 'invariant' | 'output_comparison' | 'test_execution';
  artifact_ref?: string;
  /** Leaf AC id(s) this criterion verifies — validated against the task's
   *  cited leaf-AC set; non-members dropped. See normalizeRootTaskShape. */
  verifies_acceptance_criteria?: string[];
}

interface ImplementationTask {
  id: string;
  task_type: 'standard' | 'refactoring';
  component_id: string;
  component_responsibility: string;
  description: string;
  technical_spec_ids?: string[];
  /** IDs this task implements/satisfies — leaf AC-* (coverage), res-*, TECH-*, SR-*, US-*, NFR-*, comp-*. */
  traces_to?: string[];
  dependency_task_ids?: string[];
  estimated_complexity: 'low' | 'medium' | 'high';
  complexity_flag?: string;
  completion_criteria: CompletionCriterion[];
  write_directory_paths?: string[];
  read_directory_paths?: string[];
  // ── Refactoring-task fields (Phase 0.5 → 6 → 9.1 chain) ──────────
  // Present only on `task_type:'refactoring'` tasks injected from a
  // refactoring_scope. Carried through buildEffectiveTaskView so Phase 9.1
  // can run the idempotency protocol and emit cross_run_modification.
  target_artifact_id?: string;
  target_workflow_run_id?: string;
  changed_interface_id?: string;
  expected_pre_state_hash?: string;
  verification_step?: string;
  modification_type?: 'additive' | 'breaking' | 'non_breaking';
  cross_run_impact_report_id?: string;
  refactoring_instructions?: string;
}

interface ImplementationPlan {
  tasks: ImplementationTask[];
  total_tasks?: number;
  complexity_flagged_count?: number;
  refactoring_tasks_included?: boolean;
}

// ── Handler ────────────────────────────────────────────────────────

export class Phase6Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '6';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];

    // ── Cycle-delta short-circuit ───────────────────────────────
    // When this invocation is a cycle restart from the cycle_controller,
    // skip the normal LLM-driven task synthesis and just fill the gaps
    // identified by the latest packet_synthesis_failure record.
    // See docs/design/iterative-implementation-backlog.md §3.
    if ((workflowRun.current_cycle_number ?? 0) > 0) {
      return runPhase6CycleDelta(ctx);
    }

    // ── Gather prior phase outputs ──────────────────────────────
    const allArtifacts = engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced');
    const prior = extractPriorPhaseContext(allArtifacts);

    // Wave 7 — prefer Phase 4.2a leaf components when available so the
    // implementation planner sees the decomposed leaf set (one task per
    // leaf+responsibility), not the coarse root component_model.
    const componentDecompositionNodes = engine.writer.getRecordsByType(
      workflowRun.id, 'component_decomposition_node',
    );
    const effectiveComponents = buildEffectiveComponentView(componentDecompositionNodes, prior);
    if (effectiveComponents.source === 'leaves') {
      getLogger().info('workflow', 'Phase 6: consuming Wave 7 component leaves', {
        leafCount: effectiveComponents.leafCount,
        rootCount: effectiveComponents.rootCount,
      });
    }
    const componentSummary = `PROJECT TYPE: ${prior.projectTypeDescription}\n\n${effectiveComponents.summary || (prior.componentModel?.summary ?? 'No component model available')}`;
    // PA-1: per-component scoped context so a single-task decomposition sees ITS
    // component, not the whole ~46-component backlog (which drove wrong-node
    // decomposition — the model latched onto a foreign component in the corpus).
    const componentSummaryById = buildComponentSummaryById(
      effectiveComponents.components as Array<Record<string, unknown>>,
      prior.projectTypeDescription,
    );
    // Cross-cutting NFR concerns (Lever 1a) — delivered so the planner does NOT
    // emit standalone tasks/subtrees for them (the analytics/failover sprawl).
    const crossCuttingSummary = prior.crossCuttingConstraints?.summary
      ?? '(no cross-cutting NFR concerns)';
    // Hard rule #7 of the task_skeleton template: every Technical
    // Specification id must appear in at least one task's traces_to[].
    // The audit's older roll-up dropped system_requirements (SR-*) and
    // interface_contracts (IC-*); when the model spontaneously cited
    // them (Hestami-shaped specs), the ids were fabricated. Include
    // both so the model can ground citations and so the validator can
    // verify coverage.
    const techSpecsSummary = [
      prior.systemRequirements?.summary ?? '',
      prior.interfaceContracts?.summary ?? '',
      prior.dataModels?.summary ?? 'No data models',
      prior.apiDefinitions?.summary ?? 'No API definitions',
      prior.errorHandlingStrategies?.summary ?? '',
      prior.configurationParameters?.summary ?? '',
    ].filter(Boolean).join('\n\n');
    const derivedFromIds = prior.allRecordIds;

    // ── 6.1 — Implementation Task Decomposition ──────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'task_skeleton');

    const componentIds = effectiveComponents.components
      .map(c => (typeof c.id === 'string' ? c.id : ''))
      .filter(Boolean);
    const frUserStories = (prior.functionalRequirements?.content.user_stories as Array<Record<string, unknown>>) ?? [];
    const frIds = frUserStories.map(s => (typeof s.id === 'string' ? s.id : '')).filter(Boolean);
    const dmr61Seeds = [
      ...(prior.componentModel ? [prior.componentModel.recordId] : []),
      ...(prior.dataModels ? [prior.dataModels.recordId] : []),
      ...(prior.apiDefinitions ? [prior.apiDefinitions.recordId] : []),
      ...(prior.functionalRequirements ? [prior.functionalRequirements.recordId] : []),
      ...(prior.systemRequirements ? [prior.systemRequirements.recordId] : []),
      ...(prior.interfaceContracts ? [prior.interfaceContracts.recordId] : []),
      ...(prior.errorHandlingStrategies ? [prior.errorHandlingStrategies.recordId] : []),
      ...(prior.configurationParameters ? [prior.configurationParameters.recordId] : []),
    ];
    const dmr61 = await buildPhaseContextPacket(ctx, {
      subPhaseId: 'task_skeleton',
      requestingAgentRole: 'implementation_planner',
      query: `Implementation task decomposition for components ${componentIds.join(', ')} per data_models ${prior.dataModels?.recordId ?? 'unknown'}, api_definitions ${prior.apiDefinitions?.recordId ?? 'unknown'}, FRs ${frIds.join(', ')}.`,
      knownRelevantRecordIds: dmr61Seeds,
      detailFileLabel: 'p6_1_tasks',
      requiredOutputSpec: 'implementation_plan JSON — tasks with component_id, dependencies, completion_criteria',
      // PA-13(2b): task_skeleton injects active_constraints at the top of the
      // prompt (GOVERNING CONSTRAINTS), so the inlined detail file must NOT
      // re-render the same governing statements. Disk file stays full for P9.
      inlineOmitsGoverning: true,
    });

    // Wave 8 — feed the FR-saturation LEAF acceptance criteria into task
    // generation so each task cites the specific leaf ACs it implements
    // (task→leaf-AC binding). Same leaf set Phase 7 tests bind to. The id set
    // is the structural membership oracle for traces_to validation at exit.
    const requirementDecompositionNodes = engine.writer.getRecordsByType(workflowRun.id, 'requirement_decomposition_node');
    const leafAcceptanceCriteria = collectLeafAcceptanceCriteria(requirementDecompositionNodes);
    const leafAcIdSet = new Set(leafAcceptanceCriteria.flatMap((s) => s.acs.map((a) => a.id)));
    // Oracles for bounded id-drift resolution (Fix 1): the real component +
    // technical-constraint id sets a task may reference.
    const componentIdOracle = new Set(componentIds);

    // PA-3: root→leaf AC lineage binding. buildRequirementLineage(...).canonicalize
    // is a STRUCTURAL leaf→root tree-walk (no regex — hard project rule). Both a
    // component's US traces and each leaf-AC group's owning story canonicalize to
    // the root display_key, giving a deterministic component→leaf-AC map so each
    // per-component task_skeleton call sees ONLY its own component's ACs in full
    // (others id-only). Coverage stays safe by construction: the model still SEES
    // every AC id, and the reconciliation loop over the FULL leafAcIdSet below is
    // the hard backstop that closes any AC a scoped menu omitted.
    const reqLineage = buildRequirementLineage([...allArtifacts, ...requirementDecompositionNodes]);
    // PA-3 (secondary axis): per-component technical-specs slice (data_models +
    // api_definitions by component_id). SR-reachability slice deferred pending
    // live validation (tech-specs have no reconciliation backstop).
    const techSpecsSummaryById = buildTechSpecsSummaryById(componentIds, prior);

    const rawPlan = await this.runTaskDecomposition(
      ctx,
      effectiveComponents.components as Array<Record<string, unknown>>,
      prior.projectTypeDescription,
      techSpecsSummary,
      crossCuttingSummary,
      dmr61,
      leafAcceptanceCriteria,
      reqLineage.canonicalize,
      techSpecsSummaryById,
    );

    // Normalize write/read paths to workspace-relative form. cal-21
    // failed Phase 9 with "Write scope is unreachable: /opt/hestami/
    // PROP/LIFECYCLE — Linux path that doesn't exist on this Windows
    // system." The LLM emits absolute Linux paths because the Hestami
    // spec uses them; the executor needs paths it can resolve under
    // workspacePath on any OS.
    const planContent: ImplementationPlan = {
      ...rawPlan,
      tasks: rawPlan.tasks.map(t => ({
        ...t,
        write_directory_paths: t.write_directory_paths?.map(normalizeWorkspacePath),
        read_directory_paths: t.read_directory_paths?.map(normalizeWorkspacePath),
      })),
    };

    // ── Cross-run refactoring injection (spec §4 Phase 0.5 → §4 Phase 6) ──
    // When Phase 0.5 produced a refactoring_scope, append its Refactoring
    // Tasks to the plan so the record carries them (refactoring_tasks_included
    // recomputes true) and Phase 10.1 can enumerate them. These tasks are kept
    // OUT of the scope gatekeeper (they target prior-run artifacts, not current
    // components) and OUT of saturation (they are already atomic) — handled
    // below. `injectedRefactoringTasks` is the authoritative set used for both.
    const injectedRefactoringTasks = workflowRun.cross_run_impact_triggered
      ? this.loadRefactoringTasks(ctx)
      : [];
    if (injectedRefactoringTasks.length > 0) {
      planContent.tasks.push(...injectedRefactoringTasks);
      getLogger().info('workflow', 'Phase 6: injected cross-run Refactoring Tasks', {
        workflow_run_id: workflowRun.id,
        count: injectedRefactoringTasks.length,
      });
    }
    const isRefactoringTaskId = new Set(injectedRefactoringTasks.map(t => t.id));

    let planRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '6',
      sub_phase_id: 'task_skeleton',
      produced_by_agent_role: 'implementation_planner',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: derivedFromIds,
      content: {
        kind: 'implementation_plan',
        ...planContent,
        total_tasks: planContent.tasks.length,
        complexity_flagged_count: planContent.tasks.filter(t => t.complexity_flag).length,
        refactoring_tasks_included: planContent.tasks.some(t => t.task_type === 'refactoring'),
      },
    });
    artifactIds.push(planRecord.id);
    engine.ingestionPipeline.ingest(planRecord);

    // Phase-exit scope gatekeeper. Cross-checks each task against the
    // accepted components (Phase 4.2 post-gatekeeper). A task whose
    // component_id is absent from the accepted set serves a component
    // that was previously dropped — it's stale and would generate an
    // unbacked packet at Phase 9.
    const taskPrune = await runDownstreamScopeGatekeeper(ctx, {
      phaseId: '6',
      subPhaseId: 'task_skeleton',
      bloomDescription: 'implementation tasks',
      // Refactoring tasks target prior-run artifacts (not current components),
      // so the "component_id must be in Accepted Components" overlay would
      // wrongly drop them. Exclude them from the gatekeeper candidate set.
      items: planContent.tasks.filter(t => !isRefactoringTaskId.has(t.id)).map(t => ({
        id: t.id,
        // ImplementationTask has no short `name` field — the full task
        // text lives in `description`, which is already routed to the
        // gatekeeper via the field below. Keeping the label compact.
        label: `${t.id} [component: ${t.component_id ?? '?'}]`,
        description: t.description,
        tradeoffs: t.component_responsibility ?? undefined,
      })),
      originalArtifactId: planRecord.id,
      overlay: 'DROP tasks whose `component_id` is NOT in Accepted Components — those components were pruned upstream and any task tied to them is stale. DROP tasks that describe work explicitly Out-of-Scope in upstream Intent Constraints. KEEP infrastructure/cross-cutting tasks (CI, observability) when their component anchor is accepted.',
    });
    if (!taskPrune.skipped && taskPrune.dropped.length > 0) {
      const keptTaskSet = new Set(taskPrune.kept_ids);
      // Refactoring tasks were never gatekeeper candidates — always retain them.
      const prunedTasks = planContent.tasks.filter(
        t => keptTaskSet.has(t.id) || isRefactoringTaskId.has(t.id),
      );
      const prunedPlanContent: ImplementationPlan = { ...planContent, tasks: prunedTasks };
      const prunedPlanRecord = engine.writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: workflowRun.id,
        phase_id: '6',
        sub_phase_id: 'task_skeleton',
        produced_by_agent_role: 'implementation_planner',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        derived_from_record_ids: [planRecord.id],
        content: {
          kind: 'implementation_plan',
          ...prunedPlanContent,
          total_tasks: prunedPlanContent.tasks.length,
          complexity_flagged_count: prunedPlanContent.tasks.filter(t => t.complexity_flag).length,
          refactoring_tasks_included: prunedPlanContent.tasks.some(t => t.task_type === 'refactoring'),
        },
      });
      engine.writer.supersedByRollback(planRecord.id, prunedPlanRecord.id);
      engine.ingestionPipeline.ingest(prunedPlanRecord);
      planContent.tasks = prunedTasks;
      planRecord = prunedPlanRecord;
      artifactIds.push(prunedPlanRecord.id);
    }

    // ── 6.1a — Recursive Task Decomposition (Wave 8) ──────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'task_saturation');

    const techConstraintsRecord = engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced')
      .find(r => (r.content as Record<string, unknown>).kind === 'technical_constraints_discovery');
    const technicalConstraints: TechnicalConstraint[] = techConstraintsRecord
      ? (((techConstraintsRecord.content as Record<string, unknown>).technicalConstraints) as TechnicalConstraint[] ?? [])
      : [];

    // Resume guard — skip seeding when depth-0 nodes already exist.
    const existingTaskRoots = engine.writer.getRecordsByType(workflowRun.id, 'task_decomposition_node')
      .filter(r => (r.content as unknown as TaskDecompositionNodeContent).depth === 0);
    let rootTasks: DecompositionTask[];
    let rootNodeRecordIds: string[];
    let rootLogicalIds: string[];
    if (existingTaskRoots.length > 0) {
      getLogger().info('workflow', 'Phase 6.1a RESUME: depth-0 task nodes already present', {
        existingRoots: existingTaskRoots.length,
      });
      rootTasks = existingTaskRoots.map(r => (r.content as unknown as TaskDecompositionNodeContent).task);
      rootNodeRecordIds = existingTaskRoots.map(r => r.id);
      rootLogicalIds = existingTaskRoots.map(r => (r.content as unknown as TaskDecompositionNodeContent).node_id);
    } else {
      const constraintIds = technicalConstraints.map(t => t.id);
      // Standard tasks get decomposed by saturation. Refactoring tasks are
      // already atomic (one prior-run artifact each) — they must NOT be
      // decomposed, so they are seeded separately as depth-0 `atomic` leaf
      // nodes below and excluded from the saturation root set here.
      rootTasks = planContent.tasks
        .filter(t => !isRefactoringTaskId.has(t.id))
        .map((t, taskIdx) => {
          // cal-26 surfaced three LLM-output shape defects the prompt didn't
          // explicitly forbid; coerce them defensively here so downstream
          // saturation/render code sees a clean shape regardless of whether
          // the (rewritten) prompt also enforces them. Logged via the
          // post-coercion warning in normalizeRootTaskShape() below.
          return normalizeRootTaskShape(t as unknown as Record<string, unknown>, taskIdx, constraintIds, 'src', leafAcIdSet, componentIdOracle, new Set(constraintIds));
        });
      // Seed refactoring tasks as terminal (atomic) leaves so Phase 9 consumes
      // them unchanged via getFrozenTaskLeaves (status === 'atomic').
      for (const rt of injectedRefactoringTasks) {
        const logicalNodeId = randomUUID();
        const refLeaf = engine.writer.writeRecord({
          record_type: 'task_decomposition_node',
          schema_version: '1.0',
          workflow_run_id: workflowRun.id,
          phase_id: '6',
          sub_phase_id: 'task_saturation',
          produced_by_agent_role: 'implementation_planner',
          janumicode_version_sha: engine.janumiCodeVersionSha,
          derived_from_record_ids: [planRecord.id],
          content: {
            kind: 'task_decomposition_node',
            node_id: logicalNodeId,
            parent_node_id: null,
            display_key: rt.id,
            root_task_id: logicalNodeId,
            depth: 0,
            pass_number: 0,
            status: 'atomic',
            task: {
              id: rt.id,
              name: rt.id,
              description: rt.description,
              task_type: 'refactoring',
              component_id: rt.component_id,
              component_responsibility: rt.component_responsibility,
              estimated_complexity: rt.estimated_complexity,
              completion_criteria: rt.completion_criteria,
              write_directory_paths: rt.write_directory_paths,
              dependency_task_ids: rt.dependency_task_ids,
              // Idempotency fields the Phase 9.1 executor reads.
              expected_pre_state_hash: rt.expected_pre_state_hash,
              verification_step: rt.verification_step,
              // Self-contained refactoring directive (old/new def + diff + files).
              refactoring_instructions: rt.refactoring_instructions,
            },
            surfaced_assumption_ids: [],
            release_id: null,
            release_ordinal: 0,
          } satisfies TaskDecompositionNodeContent,
        });
        artifactIds.push(refLeaf.id);
      }
      rootNodeRecordIds = [];
      rootLogicalIds = [];
      for (const rt of rootTasks) {
        const logicalNodeId = randomUUID();
        const rec = engine.writer.writeRecord({
          record_type: 'task_decomposition_node',
          schema_version: '1.0',
          workflow_run_id: workflowRun.id,
          phase_id: '6',
          sub_phase_id: 'task_saturation',
          produced_by_agent_role: 'implementation_planner',
          janumicode_version_sha: engine.janumiCodeVersionSha,
          derived_from_record_ids: [planRecord.id],
          content: {
            kind: 'task_decomposition_node',
            node_id: logicalNodeId,
            parent_node_id: null,
            display_key: rt.id,
            root_task_id: logicalNodeId,
            depth: 0,
            pass_number: 0,
            status: 'pending',
            task: rt,
            surfaced_assumption_ids: [],
            release_id: null,
            release_ordinal: null,
          } satisfies TaskDecompositionNodeContent,
        });
        rootNodeRecordIds.push(rec.id);
        rootLogicalIds.push(logicalNodeId);
        artifactIds.push(rec.id);
      }
    }

    // task→AC coverage report (visibility only — honest gaps, NO backfill).
    if (leafAcceptanceCriteria.length > 0) {
      const acCoverage = computeTaskAcCoverage(rootTasks, leafAcceptanceCriteria);
      const acCoverageRecord = engine.writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: workflowRun.id,
        phase_id: '6',
        sub_phase_id: 'task_skeleton',
        produced_by_agent_role: 'implementation_planner',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        derived_from_record_ids: [planRecord.id],
        content: acCoverage as unknown as Record<string, unknown>,
      });
      artifactIds.push(acCoverageRecord.id);
      if (acCoverage.gaps.length > 0) {
        getLogger().warn('workflow', 'Phase 6 task→AC coverage gaps (honest — not backfilled)', {
          workflow_run_id: workflowRun.id,
          uncovered: acCoverage.gaps.length,
          total: acCoverage.total_leaf_acs,
        });
      }
    }

    if (rootTasks.length > 0) {
      await runTaskSaturationLoop(ctx, {
        technicalConstraints,
        componentSummary,
        componentSummaryById,
        rootTasks,
        rootNodeRecordIds,
        rootLogicalIds,
      });
    }

    // ── 6.2 — Mirror and Menu ─────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'implementation_plan_synthesis');

    const planMirror = engine.mirrorGenerator.generate({
      artifactId: planRecord.id,
      artifactType: 'implementation_plan',
      content: {
        total_tasks: planContent.tasks.length,
        complexity_flagged: planContent.tasks.filter(t => t.complexity_flag).map(t => t.id),
      },
    });

    const mirrorRecord = engine.writer.writeRecord({
      record_type: 'mirror_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '6',
      sub_phase_id: 'implementation_plan_synthesis',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [planRecord.id],
      content: {
        kind: 'implementation_plan_mirror',
        mirror_id: planMirror.mirrorId,
        artifact_id: planRecord.id,
        artifact_type: 'implementation_plan',
        fields: planMirror.fields,
        total_tasks: planContent.tasks.length,
        complexity_flagged_count: planContent.tasks.filter(t => t.complexity_flag).length,
      },
    });
    artifactIds.push(mirrorRecord.id);
    engine.eventBus.emit('mirror:presented', {
      mirrorId: planMirror.mirrorId,
      artifactType: 'implementation_plan',
    });

    try {
      const resolution = await engine.pauseForDecision(
        workflowRun.id, mirrorRecord.id, 'mirror',
      );
      if (resolution.type === 'mirror_rejection') {
        return { success: false, error: 'User rejected implementation plan', artifactIds };
      }
    } catch (err) {
      getLogger().warn('workflow', 'Phase 6 review failed', { error: String(err) });
      return { success: false, error: 'Implementation plan review failed', artifactIds };
    }

    // ── 6.3 — Approval ────────────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'implementation_plan_gate');

    // Consistency check
    const consistencyReport = this.runConsistencyCheck(planContent);

    const consistencyRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '6',
      sub_phase_id: 'implementation_plan_gate',
      produced_by_agent_role: 'consistency_checker',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [planRecord.id],
      content: { kind: 'consistency_report', ...consistencyReport },
    });
    artifactIds.push(consistencyRecord.id);
    engine.ingestionPipeline.ingest(consistencyRecord);

    // Phase Gate
    const gateRecord = engine.writer.writeRecord({
      record_type: 'phase_gate_evaluation',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '6',
      sub_phase_id: 'implementation_plan_gate',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [planRecord.id, consistencyRecord.id],
      content: {
        kind: 'phase_gate',
        phase_id: '6',
        implementation_plan_record_id: planRecord.id,
        consistency_pass: consistencyReport.overall_pass,
        has_unresolved_warnings: consistencyReport.warnings.length > 0,
        has_high_severity_flaws: !consistencyReport.overall_pass,
      },
    });
    artifactIds.push(gateRecord.id);
    engine.eventBus.emit('phase_gate:pending', { phaseId: '6' });
    aoddEmit('gate.pending', { gate_kind: 'phase_gate' });

    return { success: true, artifactIds };
  }

  // ── Cross-run refactoring (spec §4 Phase 0.5 → Phase 6) ───────

  /**
   * Read the current run's `refactoring_scope` (produced by Phase 0.5.2
   * "Proceed") and map each Refactoring Task into the ImplementationTask shape
   * the plan + saturation expect. The cross-run idempotency fields
   * (target_artifact_id, expected_pre_state_hash, modification_type, …) are
   * carried through so they persist in the implementation_plan record; Phase
   * 9.1 reads them back (from the refactoring_scope) to emit
   * cross_run_modification. Returns [] when no scope exists.
   */
  private loadRefactoringTasks(ctx: PhaseContext): ImplementationTask[] {
    const { engine, workflowRun } = ctx;
    const scopes = engine.writer.getRecordsByType(workflowRun.id, 'refactoring_scope');
    if (scopes.length === 0) return [];
    // Newest scope wins (a revise loop could produce more than one).
    const scope = scopes.reduce((a, b) => (a.produced_at >= b.produced_at ? a : b));
    const content = scope.content as Record<string, unknown>;
    const rawTasks = Array.isArray(content.refactoring_tasks) ? content.refactoring_tasks : [];
    const out: ImplementationTask[] = [];
    for (const raw of rawTasks as Array<Record<string, unknown>>) {
      const id = typeof raw.id === 'string' ? raw.id : null;
      if (!id) continue;
      const targetArtifactId = typeof raw.target_artifact_id === 'string' ? raw.target_artifact_id : '';
      const description = typeof raw.description === 'string' ? raw.description : `Refactoring task ${id}`;
      const modType = raw.modification_type;
      out.push({
        id,
        task_type: 'refactoring',
        // A refactoring task has NO current component — it modifies a prior-run
        // artifact. Use a stable, human-readable anchor (NOT the prior-run UUID,
        // which produced confusing "Component: <uuid> — (no name)" noise and
        // matched nothing in the current run). The substantive content reaches
        // the executor via `refactoring_instructions`, not component-keyed
        // channels (component context / packet / tests all legitimately empty).
        component_id: 'cross_run_refactoring',
        component_responsibility: `Cross-run refactoring of prior-run artifact ${targetArtifactId || '(unknown)'}`,
        description,
        estimated_complexity: 'medium',
        completion_criteria: [{
          criterion_id: `${id}-VERIFY`,
          description: typeof raw.verification_step === 'string'
            ? raw.verification_step
            : 'Confirm prior-run artifact conforms to the revised interface.',
          verification_method: 'test_execution',
        }],
        write_directory_paths: Array.isArray(raw.write_directory_paths)
          ? (raw.write_directory_paths as string[])
          : [],
        dependency_task_ids: Array.isArray(raw.dependency_task_ids)
          ? (raw.dependency_task_ids as string[])
          : [],
        target_artifact_id: targetArtifactId,
        target_workflow_run_id: typeof raw.target_workflow_run_id === 'string' ? raw.target_workflow_run_id : undefined,
        changed_interface_id: typeof raw.changed_interface_id === 'string' ? raw.changed_interface_id : undefined,
        expected_pre_state_hash: typeof raw.expected_pre_state_hash === 'string' ? raw.expected_pre_state_hash : '',
        verification_step: typeof raw.verification_step === 'string' ? raw.verification_step : undefined,
        modification_type: (modType === 'additive' || modType === 'breaking' || modType === 'non_breaking')
          ? modType
          : undefined,
        cross_run_impact_report_id: typeof content.cross_run_impact_report_id === 'string'
          ? content.cross_run_impact_report_id
          : undefined,
        refactoring_instructions: typeof raw.refactoring_instructions === 'string'
          ? raw.refactoring_instructions
          : undefined,
      });
    }
    return out;
  }

  // ── LLM call helper ───────────────────────────────────────────

  /**
   * Phase 6.1 task decomposition — PER-COMPONENT chunking + coverage-driven
   * reconciliation (replaces the single monolithic call).
   *
   * The monolithic call asked one LLM response to emit ~100-200 tasks covering
   * all 300+ leaf ACs across 60+ components. That output size made local dense
   * models loop / time out, and even the rare 30-min "success" covered only
   * ~41% of leaf ACs (the model can't reconcile the full component×AC space in
   * one shot). See project_gemma4_31b_decomposition_divergence.
   *
   * Instead: one BOUNDED call per component (its responsibilities + the full AC
   * menu as a passive lookup → a few tasks each), then the orchestrator owns the
   * 100%-coverage guarantee — a deterministic check finds leaf ACs no task
   * covered and routes them back through focused reconciliation passes until the
   * check is clean (or the budget is spent → an honest, non-fabricated gap).
   * Responsibility coverage is structural (every component is visited); AC
   * coverage is closed by the reconciliation loop.
   */
  private async runTaskDecomposition(
    ctx: PhaseContext,
    components: Array<Record<string, unknown>>,
    projectTypeDescription: string,
    techSpecsSummary: string,
    crossCuttingSummary: string,
    dmr: PhaseContextPacketResult,
    leafAcceptanceCriteria: LeafAcceptanceCriteria[],
    // PA-3: STRUCTURAL leaf→root tree-walk (buildRequirementLineage.canonicalize).
    canonicalize: (id: string) => string,
    // PA-3: per-component tech-specs slice; empty map ⇒ full-summary fallback.
    techSpecsSummaryById: Record<string, string> = {},
  ): Promise<ImplementationPlan> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('implementation_planner', 'task_skeleton');

    const fallback: ImplementationPlan = {
      tasks: [{
        id: 'TASK-001',
        task_type: 'standard',
        component_id: 'COMP-001',
        component_responsibility: 'Implement core application logic',
        description: 'Set up the project structure and implement the primary module',
        estimated_complexity: 'medium',
        completion_criteria: [{
          criterion_id: 'CC-001',
          description: 'Module compiles and passes basic tests',
          verification_method: 'test_execution',
        }],
      }],
    };

    const leafComponents = components.filter(c => typeof c.id === 'string' && (c.id as string).length > 0);
    if (!template || leafComponents.length === 0) return fallback;

    const allTasks: ImplementationTask[] = [];
    const seenIds = new Set<string>();
    const pushUnique = (tasks: ImplementationTask[]): number => {
      let added = 0;
      for (const t of tasks) {
        const id = typeof t.id === 'string' ? t.id : '';
        if (id && seenIds.has(id)) continue; // dedup across chunks
        if (id) seenIds.add(id);
        allTasks.push(t);
        added++;
      }
      return added;
    };

    // ── Per-component generation: ONE bounded call per leaf component ──
    const fellOpenComponents: string[] = [];
    for (const component of leafComponents) {
      const cid = String(component.id);
      const block = `PROJECT TYPE: ${projectTypeDescription}\n\n${renderComponentBlockForTask(component)}`;
      // PA-3: scope the AC menu to THIS component's own leaf ACs (owned = full
      // text; others = id-only appendix so they stay citable). Falls back to the
      // full menu when no owned ACs resolve (unresolved traces / namespace drift)
      // so coverage can never regress below the pre-scoping baseline.
      const componentRoots = componentRootStorySet(component, canonicalize);
      // Fail-safe VISIBILITY (PA-3 stop-and-fix): the fallback below is SILENT, so a
      // component→requirement id-namespace break (cal-38: 30/30 fell open, undetected)
      // reads as success. Track fall-opens and log the rate after the loop.
      const anyOwned = leafAcceptanceCriteria.some(
        (l) => componentRoots.has(canonicalize(l.leafDisplayKey ?? l.leafStoryId)),
      );
      if (!anyOwned) fellOpenComponents.push(cid);
      const scopedAcMenu = renderScopedAcceptanceCriteriaMenu(
        leafAcceptanceCriteria,
        componentRoots,
        canonicalize,
      );
      const rendered = engine.templateLoader.render(template, {
        active_constraints: dmr.activeConstraintsText,
        acceptance_criteria_menu: scopedAcMenu,
        component_model_summary: block,
        technical_specs_summary: techSpecsSummaryById[cid] ?? techSpecsSummary,
        cross_cutting_constraints_summary: crossCuttingSummary,
        detail_file_path: dmr.detailFilePath,
        detail_file_content: dmr.detailFileContent,
        janumicode_version_sha: engine.janumiCodeVersionSha,
      });
      if (rendered.missing_variables.length > 0) continue;
      try {
        const result = await engine.callForRole('requirements_agent', {
          prompt: rendered.rendered,
          responseFormat: 'json',
          temperature: 0.4,
          traceContext: {
            workflowRunId: ctx.workflowRun.id,
            phaseId: '6',
            subPhaseId: 'task_skeleton',
            agentRole: 'implementation_planner',
            label: `Phase 6.1 — Task Decomposition (${cid})`,
          },
        });
        const tasks = parseImplementationTasks(result.parsed as Record<string, unknown> | null);
        for (const t of tasks) backfillTracesFromCriteria(t);
        pushUnique(tasks);
      } catch (err) {
        // One component's failure must not sink the whole phase — log and move
        // on; the reconciliation pass below catches any ACs it would have covered.
        getLogger().warn('workflow', 'Phase 6.1 per-component generation failed — continuing', {
          component_id: cid, error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (fellOpenComponents.length > 0) {
      const rate = fellOpenComponents.length / Math.max(1, leafComponents.length);
      const msg = `Phase 6.1 AC-menu scoping fell open to the FULL inventory for `
        + `${fellOpenComponents.length}/${leafComponents.length} components (${Math.round(rate * 100)}%)`;
      const meta = { workflow_run_id: ctx.workflowRun.id, sample: fellOpenComponents.slice(0, 10), rate };
      if (rate >= 1) {
        getLogger().error('workflow', `${msg} — 100% fallback = component→requirement id-namespace break (structural defect, not per-component no-trace)`, meta);
      } else {
        getLogger().warn('workflow', msg, meta);
      }
    }

    if (allTasks.length === 0) return fallback;

    // ── Coverage-driven reconciliation: orchestrator owns the 100% guarantee ──
    // Each pass partitions the still-uncovered ACs into BOUNDED batches (one
    // call per batch) so the model never reasons over the whole orphan set at
    // once — the same "chunk the reasoning" insight as per-component generation.
    const leafAcIdSet = new Set(leafAcceptanceCriteria.flatMap(s => s.acs.map(a => a.id)));
    const maxReconPasses = Math.max(0, Number.parseInt(process.env.JANUMICODE_P6_RECON_PASSES ?? '2', 10) || 0);
    const maxAcsPerBatch = Math.max(1, Number.parseInt(process.env.JANUMICODE_P6_RECON_BATCH_AC ?? '25', 10) || 25);
    for (let pass = 1; pass <= maxReconPasses; pass++) {
      const uncovered = computeUncoveredAcIds(allTasks, leafAcIdSet);
      if (uncovered.size === 0) break;
      const batches = chunkUncoveredByStory(uncovered, leafAcceptanceCriteria, maxAcsPerBatch);
      getLogger().info('workflow', 'Phase 6.1 reconciliation pass — covering orphan leaf ACs in bounded batches', {
        pass, uncovered: uncovered.size, total: leafAcIdSet.size, batches: batches.length, max_acs_per_batch: maxAcsPerBatch,
      });
      let addedThisPass = 0;
      for (let b = 0; b < batches.length; b++) {
        const batch = batches[b];
        const reconTasks = await this.reconcileUncoveredAcs(
          ctx, batch, leafAcceptanceCriteria, leafComponents, techSpecsSummary, dmr,
          { pass, batchIndex: b + 1, batchCount: batches.length },
        );
        // Robust crediting: accept a recon task only if it covers a
        // still-uncovered AC in THIS batch via traces_to ∪ CC verifies.
        const useful = reconTasks.filter(t => taskCoversAny(t, batch));
        addedThisPass += pushUnique(useful);
      }
      if (addedThisPass === 0) break; // whole pass made no forward progress → stop (residual logged)
    }

    const residual = computeUncoveredAcIds(allTasks, leafAcIdSet);
    if (residual.size > 0) {
      getLogger().warn(
        'workflow',
        'Phase 6.1 residual uncovered leaf ACs after reconciliation (honest gap — upstream component/FR divergence, not fabricated)',
        summarizeResidualDivergence(residual, leafAcceptanceCriteria, leafAcIdSet.size),
      );
    } else if (leafAcIdSet.size > 0) {
      getLogger().info('workflow', 'Phase 6.1 leaf-AC coverage complete (100%)', {
        total: leafAcIdSet.size, tasks: allTasks.length,
      });
    }

    return { tasks: allTasks };
  }

  /**
   * Reconciliation pass: emit tasks for the leaf ACs no per-component call
   * covered. Small/focused — sees only the uncovered ACs + a compact component
   * menu (routing target), so the model does bounded reasoning, not the
   * monolithic mapping. Returns [] on failure (caller logs the residual gap).
   */
  private async reconcileUncoveredAcs(
    ctx: PhaseContext,
    uncovered: Set<string>,
    leafAcceptanceCriteria: LeafAcceptanceCriteria[],
    components: Array<Record<string, unknown>>,
    techSpecsSummary: string,
    dmr: PhaseContextPacketResult,
    batchInfo?: { pass: number; batchIndex: number; batchCount: number },
  ): Promise<ImplementationTask[]> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('implementation_planner', 'task_reconciliation');
    if (!template) return [];
    const rendered = engine.templateLoader.render(template, {
      active_constraints: dmr.activeConstraintsText,
      uncovered_acceptance_criteria: renderUncoveredAcsMenu(uncovered, leafAcceptanceCriteria),
      component_menu: renderComponentMenu(components),
      technical_specs_summary: techSpecsSummary,
    });
    if (rendered.missing_variables.length > 0) return [];
    const label = batchInfo
      ? `Phase 6.1 — Coverage Reconciliation (pass ${batchInfo.pass}, batch ${batchInfo.batchIndex}/${batchInfo.batchCount}, ${uncovered.size} ACs)`
      : `Phase 6.1 — Coverage Reconciliation (${uncovered.size} orphan ACs)`;
    try {
      const result = await engine.callForRole('requirements_agent', {
        prompt: rendered.rendered,
        responseFormat: 'json',
        temperature: 0.4,
        traceContext: {
          workflowRunId: ctx.workflowRun.id,
          phaseId: '6',
          subPhaseId: 'task_skeleton',
          agentRole: 'implementation_planner',
          label,
        },
      });
      // Confirm the parse: distinguish a parse failure (parsed == null, even
      // after json_repair) from a model that returned a well-formed-but-empty
      // task list — a silently-dropped batch reads as "covered" when it wasn't.
      const parsed = result.parsed as Record<string, unknown> | null;
      const tasks = parseImplementationTasks(parsed);
      if (tasks.length === 0) {
        getLogger().warn('workflow', 'Phase 6.1 reconciliation batch yielded no usable tasks', {
          label, parse_failed: parsed == null, ac_count: uncovered.size,
        });
        return [];
      }
      for (const t of tasks) backfillTracesFromCriteria(t);
      return tasks;
    } catch (err) {
      getLogger().warn('workflow', 'Phase 6.1 reconciliation call failed', {
        label, error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  /** Deterministic consistency check. */
  private runConsistencyCheck(
    plan: ImplementationPlan,
  ): { overall_pass: boolean; traceability_results: unknown[]; semantic_findings: unknown[]; blocking_failures: string[]; warnings: string[] } {
    const blockingFailures: string[] = [];
    const warnings: string[] = [];
    const traceability: unknown[] = [];

    // IP-001: Every task has at least one completion criterion
    const noCriteria = plan.tasks.filter(t => !t.completion_criteria || t.completion_criteria.length === 0);
    if (noCriteria.length > 0) {
      blockingFailures.push('tasks-without-completion-criteria');
      traceability.push({
        assertion: 'Every task has at least one completion criterion (IP-001)',
        pass: false,
        failures: noCriteria.map(t => ({ item_id: t.id, explanation: `Task ${t.id} has no completion criteria` })),
      });
    }

    // IP-002: Every task has component_responsibility
    const noResp = plan.tasks.filter(t => !t.component_responsibility);
    if (noResp.length > 0) {
      blockingFailures.push('tasks-without-component-responsibility');
      traceability.push({
        assertion: 'Every task has a component_responsibility (IP-002)',
        pass: false,
        failures: noResp.map(t => ({ item_id: t.id, explanation: `Task ${t.id} has no component_responsibility` })),
      });
    }

    // Circular dependency check
    const taskIds = new Set(plan.tasks.map(t => t.id));
    const depGraph = new Map<string, string[]>();
    for (const task of plan.tasks) {
      depGraph.set(task.id, (task.dependency_task_ids ?? []).filter(id => taskIds.has(id)));
    }
    const cycles = this.detectCycles(depGraph);
    if (cycles.length > 0) {
      warnings.push('circular-task-dependencies');
      traceability.push({
        assertion: 'No circular task dependencies',
        pass: false,
        failures: cycles.map(c => ({ item_id: c.join('->'), explanation: `Circular dependency: ${c.join(' -> ')}` })),
      });
    }

    // Complexity flags — warn if high-complexity tasks exist
    const highComplexity = plan.tasks.filter(t => t.estimated_complexity === 'high');
    if (highComplexity.length > 0) {
      warnings.push('high-complexity-tasks');
      traceability.push({
        assertion: 'High-complexity tasks should be reviewed',
        pass: true,
        failures: highComplexity.map(t => ({
          item_id: t.id,
          explanation: t.complexity_flag ?? `Task ${t.id} rated high complexity`,
        })),
      });
    }

    return {
      overall_pass: blockingFailures.length === 0,
      traceability_results: traceability,
      semantic_findings: [],
      blocking_failures: blockingFailures,
      warnings,
    };
  }

  private detectCycles(graph: Map<string, string[]>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const dfs = (node: string, path: string[]) => {
      if (inStack.has(node)) {
        const start = path.indexOf(node);
        if (start >= 0) cycles.push(path.slice(start).concat(node));
        return;
      }
      if (visited.has(node)) return;
      visited.add(node);
      inStack.add(node);
      for (const n of graph.get(node) ?? []) dfs(n, [...path, node]);
      inStack.delete(node);
    };
    for (const node of graph.keys()) dfs(node, []);
    return cycles;
  }
}

/**
 * Coerce an LLM-emitted directory path into a workspace-relative
 * form that the Phase 9 executor can resolve regardless of host OS.
 *
 * The Hestami product spec uses absolute Linux paths
 * (`/opt/hestami/PROP/LIFECYCLE`, `/var/hestami/COMM/SCHEDULER`),
 * and qwen-3.5:9b faithfully reproduces them in task specs. Phase 9
 * then tried to write to `/opt/hestami/...` on Windows and got blocked
 * by the executor's write-scope guard, which is why cal-21 produced
 * 21 "Write scope is unreachable" results instead of code.
 *
 * Normalization rules:
 *   1. Backslashes → forward slashes.
 *   2. Strip leading `/opt/`, `/var/`, `/usr/`, `/srv/` system roots
 *      so the remainder reads as a workspace-relative subtree.
 *   3. Strip leading `/` and `./`.
 *   4. Collapse double slashes.
 *   5. Reject empty or `.` (shouldn't be a write scope).
 *
 * Input:   `/opt/hestami/PROP/LIFECYCLE`
 * Output:  `hestami/PROP/LIFECYCLE`
 *
 * The Phase 9 executor resolves the result against `workspacePath`,
 * so this gives a fully portable spec.
 */
export function normalizeWorkspacePath(p: string): string {
  if (!p) return p;
  let out = p.replaceAll('\\', '/');

  // Strip Windows drive letters (e.g. `E:/Projects/.../src/foo` → after this
  // step the leading `/` strip below gets us to the relative path). cal-26
  // surfaced LLM-emitted absolute Windows paths into the project's actual
  // source tree (E:/Projects/hestami-ai/janumicode_v2/src/components/...),
  // which the prior normalizer left intact. The executor would then write
  // into the live extension code rather than the workspace sandbox.
  const driveMatch = /^([A-Za-z]):\//.exec(out);
  if (driveMatch) {
    out = out.slice(driveMatch[0].length);
  }

  // Strip absolute Linux system-root prefixes that won't exist under
  // workspacePath. Order matters — match longest first.
  for (const root of ['/opt/', '/var/', '/usr/', '/srv/']) {
    if (out.startsWith(root)) { out = out.slice(root.length); break; }
  }

  // If the post-strip path still references the JanumiCode project root
  // (Projects/hestami-ai/JanumiCode/janumicode_v2/), strip everything up
  // through the trailing `/janumicode_v2/` so we end up with a path
  // that's relative to the calibration workspace, not the project source.
  // This prevents a Phase 9 executor from writing into the live extension
  // code when the LLM emits absolute paths from training data.
  const projectRootRe = /(?:^|\/)janumicode_v2\//;
  const projectMatch = projectRootRe.exec(out);
  if (projectMatch) {
    out = out.slice(projectMatch.index + projectMatch[0].length);
  }

  // Strip leading `/` or `./`.
  while (out.startsWith('/') || out.startsWith('./')) {
    out = out.startsWith('./') ? out.slice(2) : out.slice(1);
  }
  // Collapse runs of slashes.
  out = out.replaceAll(/\/+/g, '/');
  // Trim trailing slash for stability.
  if (out.endsWith('/') && out.length > 1) out = out.slice(0, -1);
  return out;
}

// ── Leaf acceptance-criteria menu (task→leaf-AC binding) ───────────

export interface LeafAcceptanceCriteria {
  leafStoryId: string;
  storyText: string;
  /**
   * PA-3: the leaf decomposition node's `content.display_key` — the id form the
   * lineage tree-walk (canonicalize) keys on. Falls back to `leafStoryId` when
   * absent. Captured so a collision-suffixed leaf whose display_key differs from
   * `user_story.id` still binds to its root component correctly.
   */
  leafDisplayKey?: string;
  acs: Array<{ id: string; text: string }>;
}

/**
 * Collect the FR-saturation LEAF acceptance criteria — the authoritative AC
 * inventory each Phase-6 task binds against. Reads the atomic FR-rooted
 * `requirement_decomposition_node` leaves (latest-per-node, supersession-aware),
 * each carrying `user_story.acceptance_criteria[]`. This is the same leaf set
 * Phase 7 tests reference, so task↔test alignment becomes structural.
 */
export function collectLeafAcceptanceCriteria(records: GovernedStreamRecord[]): LeafAcceptanceCriteria[] {
  const latestByNodeId = new Map<string, GovernedStreamRecord>();
  for (const r of records) {
    if (r.record_type !== 'requirement_decomposition_node') continue;
    const c = r.content as Record<string, unknown>;
    if (c.kind && c.kind !== 'requirement_decomposition_node') continue;
    if (c.root_kind && c.root_kind !== 'fr') continue;
    if (c.status !== 'atomic') continue;
    const nodeId = typeof c.node_id === 'string' ? c.node_id : null;
    if (!nodeId) continue;
    const existing = latestByNodeId.get(nodeId);
    if (!existing || r.produced_at > existing.produced_at) latestByNodeId.set(nodeId, r);
  }
  const out: LeafAcceptanceCriteria[] = [];
  for (const r of latestByNodeId.values()) {
    const content = r.content as Record<string, unknown>;
    const story = content.user_story as Record<string, unknown> | undefined;
    if (!story || typeof story.id !== 'string') continue;
    const acsRaw = Array.isArray(story.acceptance_criteria) ? story.acceptance_criteria : [];
    const acs = (acsRaw as Array<Record<string, unknown>>)
      .filter((a) => a && typeof a.id === 'string' && (a.id as string).length > 0)
      .map((a) => {
        let text = '';
        if (typeof a.description === 'string') text = a.description;
        else if (typeof a.text === 'string') text = a.text;
        return { id: a.id as string, text };
      });
    if (acs.length === 0) continue;
    const storyText = [story.role, story.action, story.outcome]
      .filter((x): x is string => typeof x === 'string' && x.length > 0).join(' / ')
      || (typeof story.description === 'string' ? story.description : '');
    // PA-3: capture the leaf node's own display_key for canonicalize() — the
    // structural id the tree-walk keys on (collision-safe when it diverges from
    // user_story.id under suffixing).
    const leafDisplayKey = typeof content.display_key === 'string' ? content.display_key : undefined;
    out.push({ leafStoryId: story.id, storyText, leafDisplayKey, acs });
  }
  return out;
}

export interface TaskAcCoverageReport {
  kind: 'task_ac_coverage_report';
  total_leaf_acs: number;
  covered: number;
  gaps: Array<{ acceptance_criterion_id: string; leaf_story_id: string }>;
  coverage_percentage: number;
}

/**
 * Deterministic task→AC coverage: every leaf AC should be cited by ≥1 task's
 * traces_to. Reports uncovered ACs as honest gaps (visibility, NO fabrication)
 * — mirrors Phase-7 runCoverageAnalysis / the Phase-8 evaluation_coverage_report.
 */
export function computeTaskAcCoverage(
  tasks: Array<{ traces_to?: string[] }>,
  leaves: LeafAcceptanceCriteria[],
): TaskAcCoverageReport {
  const cited = new Set<string>();
  for (const t of tasks) for (const id of asStringArray(t.traces_to)) cited.add(id);
  const gaps: Array<{ acceptance_criterion_id: string; leaf_story_id: string }> = [];
  let total = 0;
  for (const l of leaves) {
    for (const ac of l.acs) {
      total++;
      if (!cited.has(ac.id)) gaps.push({ acceptance_criterion_id: ac.id, leaf_story_id: l.leafStoryId });
    }
  }
  return {
    kind: 'task_ac_coverage_report',
    total_leaf_acs: total,
    covered: total - gaps.length,
    gaps,
    coverage_percentage: total > 0 ? Math.round(((total - gaps.length) / total) * 100) : 100,
  };
}

/** Render the leaf-AC menu for the task_skeleton prompt — grouped by leaf story. */
export function renderAcceptanceCriteriaMenu(leaves: LeafAcceptanceCriteria[]): string {
  if (leaves.length === 0) return '(no leaf acceptance criteria available)';
  const lines: string[] = [];
  for (const l of leaves) {
    lines.push(`- ${l.leafStoryId}${l.storyText ? ` — ${l.storyText}` : ''}`);
    for (const ac of l.acs) lines.push(`  - ${ac.id}${ac.text ? `: ${ac.text}` : ''}`);
  }
  return lines.join('\n');
}

/**
 * PA-3: the set of ROOT user-story ids a component serves. Reads the component's
 * US traces — `traces_to` (root view) or `satisfies_requirement_ids` (the leaf
 * view carries the ROOT component_model's `US-*` traces here; the 2026-07-05 fix
 * at phaseContext.ts stopped it from mis-seeding this field with `res-*`
 * responsibility ids) — and maps each id through the STRUCTURAL leaf→root
 * tree-walk `canonicalize` (never regex). Empty when a component genuinely has
 * no resolvable US traces, which drives the (now-logged) full-menu fallback.
 */
export function componentRootStorySet(
  component: Record<string, unknown>,
  canonicalize: (id: string) => string,
): Set<string> {
  const raw = component.traces_to ?? component.satisfies_requirement_ids ?? [];
  const ids = Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === 'string' && x.length > 0)
    : [];
  const roots = new Set<string>();
  for (const id of ids) roots.add(canonicalize(id));
  return roots;
}

/**
 * PA-3: render the leaf-AC menu SCOPED to one component. Partition leaves into
 * OWNED (canonicalize(leafDisplayKey ?? leafStoryId) ∈ componentRoots) vs OTHER.
 * OWNED render in full (grouped format, with descriptive text) so the model
 * binds tasks to its own component's ACs; OTHER collapse to a compact id-only
 * appendix so every AC id stays citable (kills the foreign-component text bloat
 * without hiding any id).
 *
 * FALLBACK: when OWNED is empty (unresolved traces / id-namespace drift) return
 * the FULL menu — identical to the pre-scoping behaviour, so AC coverage can
 * never regress below baseline. Mirrors the established *ById + full-summary
 * fallback pattern (PA-1/2/4).
 */
export function renderScopedAcceptanceCriteriaMenu(
  leaves: LeafAcceptanceCriteria[],
  componentRoots: Set<string>,
  canonicalize: (id: string) => string,
): string {
  if (leaves.length === 0) return renderAcceptanceCriteriaMenu(leaves);
  const owned: LeafAcceptanceCriteria[] = [];
  const other: LeafAcceptanceCriteria[] = [];
  for (const l of leaves) {
    const root = canonicalize(l.leafDisplayKey ?? l.leafStoryId);
    if (componentRoots.has(root)) owned.push(l);
    else other.push(l);
  }
  // No owned leaves resolved → coverage-safe full-menu fallback.
  if (owned.length === 0) return renderAcceptanceCriteriaMenu(leaves);
  const sections: string[] = [renderAcceptanceCriteriaMenu(owned)];
  const otherIds = [...new Set(other.flatMap((l) => l.acs.map((a) => a.id)))];
  if (otherIds.length > 0) {
    sections.push(
      '',
      '# Other-component acceptance-criteria ids (reference lookup only, NOT this call coverage target):',
      otherIds.map((id) => `- ${id}`).join('\n'),
    );
  }
  return sections.join('\n');
}

// ── Phase 6.1 per-component chunking helpers ──────────────────────────

/**
 * Render ONE component as a Component-Model-Summary block (same shape
 * buildEffectiveComponentView emits) so a per-component task_skeleton call sees
 * exactly the single component it is scoped to.
 */
export function renderComponentBlockForTask(component: Record<string, unknown>): string {
  const id = typeof component.id === 'string' ? component.id : '';
  const name = typeof component.name === 'string' ? component.name : id;
  const dk = typeof component._leaf_display_key === 'string' ? component._leaf_display_key : id;
  const tierRaw = component._leaf_tier;
  const tier = typeof tierRaw === 'number' || typeof tierRaw === 'string' ? String(tierRaw) : '?';
  const root = typeof component._leaf_root_display_key === 'string' ? component._leaf_root_display_key : '';
  const releaseOrdinal = component._leaf_release_ordinal;
  const release = typeof releaseOrdinal === 'number' || typeof releaseOrdinal === 'string' ? `Release ${String(releaseOrdinal)}` : 'Backlog';
  const resps = Array.isArray(component.responsibilities)
    ? (component.responsibilities as Array<Record<string, unknown>>)
        .map(r => {
          let txt = '';
          if (typeof r.description === 'string') txt = r.description;
          else if (typeof r.statement === 'string') txt = r.statement;
          return `  - ${txt}`;
        })
        .join('\n')
    : '';
  const header = root ? `${dk} (Tier ${tier} leaf under ${root}): ${name}` : `${dk}: ${name}`;
  return `[${release}] ${header}\n${resps}`;
}

/**
 * Build the per-component scoped-context map used to scope `component_context`
 * in task decomposition/saturation to ONE component instead of the whole
 * catalog.
 *
 * PA-1 completion (component leaf id-form binding): a task references its
 * component by the LEAF `display_key` (Phase 4.2a decomposes roots into leaves),
 * but `buildEffectiveComponentView` keys each leaf record by `component.id` — a
 * DIFFERENT id form under collision-suffixing. Keying only by `id` meant ~50% of
 * live task_saturation calls (cal-31) missed and fell back to the full 53-component
 * catalog. So key the SAME leaf block by every id form a task might carry: the
 * component `id`, the leaf `display_key`, and the leaf `node_id`. Root-source
 * components (no `_leaf_*` fields) simply key by `id` — unchanged behaviour.
 */
export function buildComponentSummaryById(
  components: Array<Record<string, unknown>>,
  projectTypeDescription: string,
): Record<string, string> {
  const byId: Record<string, string> = {};
  for (const c of components) {
    const summary = `PROJECT TYPE: ${projectTypeDescription}\n\n${renderComponentBlockForTask(c)}`;
    for (const k of [c.id, c._leaf_display_key, c._leaf_node_id]) {
      if (typeof k === 'string' && k) byId[k] = summary;
    }
  }
  return byId;
}

/**
 * PA-3 (secondary axis): per-component technical-specs summary. Slices
 * `data_models` + `api_definitions` by `component_id` (both carry it) so a
 * per-component task_skeleton call sees ITS specs, not the all-component
 * roll-up. SR / IC / error / config blocks stay FULL — the
 * system_requirements-by-source-reachability slice is DEFERRED pending live
 * validation (tech-specs have no reconciliation backstop, unlike ACs).
 *
 * A component whose DM + API slice is BOTH empty gets NO entry; the per-component
 * loop then falls back to the full `techSpecsSummary` (`?? techSpecsSummary`), so
 * spec visibility never regresses.
 */
export function buildTechSpecsSummaryById(
  componentIds: string[],
  prior: PriorPhaseContext,
): Record<string, string> {
  const rawModels = prior.dataModels?.content.models;
  const models = Array.isArray(rawModels) ? rawModels as Array<Record<string, unknown>> : [];
  const rawDefs = prior.apiDefinitions?.content.definitions;
  const defs = Array.isArray(rawDefs) ? rawDefs as Array<Record<string, unknown>> : [];
  const byId: Record<string, string> = {};
  for (const cid of componentIds) {
    const myModels = models.filter((m) => m.component_id === cid);
    const myDefs = defs.filter((d) => d.component_id === cid);
    // PA-3: SR-reachability slice deferred pending live validation (no recon backstop)
    if (myModels.length === 0 && myDefs.length === 0) continue; // → full-summary fallback at call site
    byId[cid] = [
      prior.systemRequirements?.summary ?? '',
      prior.interfaceContracts?.summary ?? '',
      renderDataModelsSlice(myModels),
      renderApiDefinitionsSlice(myDefs),
      prior.errorHandlingStrategies?.summary ?? '',
      prior.configurationParameters?.summary ?? '',
    ].filter(Boolean).join('\n\n');
  }
  return byId;
}

/** Render a component-scoped slice of data_models (same shape as summarizeDataModels). */
function renderDataModelsSlice(models: Array<Record<string, unknown>>): string {
  if (models.length === 0) return '';
  const lines = models.map((m) => {
    const entities = Array.isArray(m.entities) ? m.entities as Array<Record<string, unknown>> : [];
    const entList = entities.map((e) => {
      const fields = Array.isArray(e.fields) ? e.fields as Array<Record<string, unknown>> : [];
      return `    ${e.name}: ${fields.map((f) => `${f.name}:${f.type}`).join(', ')}`;
    }).join('\n');
    return `  Component ${m.component_id}:\n${entList}`;
  });
  return `${models.length} Data Models:\n${lines.join('\n')}`;
}

/** Render a component-scoped slice of api_definitions (same shape as summarizeApiDefinitions). */
function renderApiDefinitionsSlice(defs: Array<Record<string, unknown>>): string {
  if (defs.length === 0) return '';
  const lines = defs.map((d) => {
    const endpoints = Array.isArray(d.endpoints) ? d.endpoints as Array<Record<string, unknown>> : [];
    const epList = endpoints.map((e) => {
      const auth = typeof e.auth_requirement === 'string' ? e.auth_requirement : 'none';
      return `    ${e.method} ${e.path} (auth: ${auth})`;
    }).join('\n');
    return `  Component ${d.component_id}:\n${epList}`;
  });
  return `${defs.length} API Definitions:\n${lines.join('\n')}`;
}

/** Compact component menu (id + responsibilities) — the routing target for reconciliation. */
export function renderComponentMenu(components: Array<Record<string, unknown>>): string {
  const lines: string[] = [];
  for (const c of components) {
    const id = typeof c.id === 'string' ? c.id : '';
    if (!id) continue;
    const name = typeof c.name === 'string' ? c.name : id;
    lines.push(`- ${id}: ${name}`);
    if (Array.isArray(c.responsibilities)) {
      for (const r of c.responsibilities as Array<Record<string, unknown>>) {
        let txt = '';
        if (typeof r.description === 'string') txt = r.description;
        else if (typeof r.statement === 'string') txt = r.statement;
        if (txt) lines.push(`    - ${txt}`);
      }
    }
  }
  return lines.length > 0 ? lines.join('\n') : '(no components)';
}

/**
 * Coerce an LLM-emitted field to a string[] at the deterministic boundary.
 * Tolerates the model emitting a non-array where the schema wants a list of ids:
 * cal-29 P6.1 reconciliation emitted `verifies_acceptance_criteria: true`
 * (a boolean shorthand for "yes, this verifies the AC"), and `for..of true`
 * threw "boolean true is not iterable", crashing every reconciliation batch.
 * Non-arrays → []; non-string members are dropped.
 */
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Coerce an LLM-emitted field (e.g. `completion_criteria`) to an array of objects, tolerating non-arrays. */
function asRecordArray(v: unknown): Array<Record<string, unknown>> {
  return Array.isArray(v)
    ? v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
    : [];
}

/**
 * Promote leaf-AC ids the model placed only in a criterion's
 * `verifies_acceptance_criteria` up into the task's top-level `traces_to` (the
 * canonical AC-coverage field downstream binding reads). Smoke-testing the
 * per-component prompt showed gemma4:31b reliably puts the AC ids in the CC
 * field ("this criterion verifies AC-X") and the higher-level US / SR ids in
 * `traces_to` — a reasonable reading, but it leaves `traces_to` without the leaf
 * ACs. This deterministic bridge makes coverage robust to that variation
 * instead of relying on the prompt to place ids in an exact field. Reads every
 * field through asStringArray/asRecordArray so a non-array LLM value can never
 * crash the pass (the cal-29 `verifies_acceptance_criteria: true` failure).
 */
export function backfillTracesFromCriteria(task: ImplementationTask): void {
  const fromCc = new Set<string>();
  for (const cc of asRecordArray(task.completion_criteria)) {
    for (const ac of asStringArray(cc.verifies_acceptance_criteria)) {
      if (ac.startsWith('AC-')) fromCc.add(ac);
    }
  }
  if (fromCc.size === 0) return;
  const existing = new Set(asStringArray(task.traces_to));
  const merged = [...asStringArray(task.traces_to)];
  for (const ac of fromCc) if (!existing.has(ac)) merged.push(ac);
  task.traces_to = merged;
}

/**
 * Leaf AC ids covered by no task — the reconciliation work-list. Counts an AC
 * as covered if it appears in a task's `traces_to` OR in any criterion's
 * `verifies_acceptance_criteria` (the two binding fields the model uses
 * interchangeably).
 */
export function computeUncoveredAcIds(
  tasks: Array<{ traces_to?: string[]; completion_criteria?: Array<{ verifies_acceptance_criteria?: string[] }> }>,
  leafAcIdSet: Set<string>,
): Set<string> {
  const cited = new Set<string>();
  for (const t of tasks) {
    for (const id of asStringArray(t.traces_to)) cited.add(id);
    for (const cc of asRecordArray(t.completion_criteria)) for (const ac of asStringArray(cc.verifies_acceptance_criteria)) cited.add(ac);
  }
  const out = new Set<string>();
  for (const ac of leafAcIdSet) if (!cited.has(ac)) out.add(ac);
  return out;
}

/** Render only the uncovered ACs (grouped by their owning leaf story) for the reconciliation prompt. */
export function renderUncoveredAcsMenu(uncovered: Set<string>, leaves: LeafAcceptanceCriteria[]): string {
  const lines: string[] = [];
  for (const l of leaves) {
    const acs = l.acs.filter(a => uncovered.has(a.id));
    if (acs.length === 0) continue;
    lines.push(`- ${l.leafStoryId}${l.storyText ? ` — ${l.storyText}` : ''}`);
    for (const ac of acs) lines.push(`  - ${ac.id}${ac.text ? `: ${ac.text}` : ''}`);
  }
  return lines.length > 0 ? lines.join('\n') : '';
}

/**
 * Partition the uncovered leaf ACs into BOUNDED batches so each reconciliation
 * call does small, focused routing instead of the monolithic single call.
 *
 * Why this exists: the first reconciliation design handed ALL orphan ACs to one
 * call. On cal-29 that was 170 orphans → a ~16-minute, 25,826-output-token
 * response that parsed slowly and whose tasks were dropped (coverage stuck at
 * 44%). That is the SAME monolithic-scale failure the per-component generation
 * chunking was designed to avoid — applied here too: cap each call to
 * `maxAcsPerBatch` orphan ACs (bounded output → reliable parse + credit).
 *
 * ACs are grouped by their owning leaf story and kept together (a story is the
 * cohesive routing unit — its ACs share one behaviour). Stories are packed
 * greedily up to the budget; a single story whose orphan-AC count alone exceeds
 * the budget becomes its own (over-budget) batch rather than being split across
 * calls. Every uncovered id lands in exactly one batch (the uncovered set is
 * derived from these same leaves, so there are no story-less orphans).
 */
export function chunkUncoveredByStory(
  uncovered: Set<string>,
  leaves: LeafAcceptanceCriteria[],
  maxAcsPerBatch: number,
): Set<string>[] {
  const budget = Math.max(1, maxAcsPerBatch);
  const batches: Set<string>[] = [];
  let current = new Set<string>();
  for (const l of leaves) {
    const acIds = l.acs.filter(a => uncovered.has(a.id)).map(a => a.id);
    if (acIds.length === 0) continue;
    // Flush before adding a story that would overflow a non-empty batch — keeps
    // each story's ACs in a single batch.
    if (current.size > 0 && current.size + acIds.length > budget) {
      batches.push(current);
      current = new Set<string>();
    }
    for (const id of acIds) current.add(id);
    // A story that fills (or, alone, overflows) the budget closes the batch.
    if (current.size >= budget) {
      batches.push(current);
      current = new Set<string>();
    }
  }
  if (current.size > 0) batches.push(current);
  return batches;
}

/**
 * Robust coverage test: does this task cover ANY id in `idSet` via its
 * top-level `traces_to` OR any criterion's `verifies_acceptance_criteria`? The
 * model uses the two fields interchangeably (see backfillTracesFromCriteria), so
 * crediting must read both rather than relying on the canonical field alone.
 */
export function taskCoversAny(
  task: { traces_to?: string[]; completion_criteria?: Array<{ verifies_acceptance_criteria?: string[] }> },
  idSet: Set<string>,
): boolean {
  for (const id of asStringArray(task.traces_to)) if (idSet.has(id)) return true;
  for (const cc of asRecordArray(task.completion_criteria)) {
    for (const id of asStringArray(cc.verifies_acceptance_criteria)) if (idSet.has(id)) return true;
  }
  return false;
}

/**
 * Precisely characterize the residual uncovered leaf ACs as upstream
 * component/FR divergence. After per-component generation AND bounded
 * reconciliation routing, any AC still uncovered belongs to a leaf user story
 * that NO component claimed — i.e. the component model is too coarse to deliver
 * that requirement. Grouping the residual by owning leaf story (largest gaps
 * first) turns a bare count into an actionable map of WHICH stories diverge, so
 * the deferred upstream-coarseness issue is precisely quantified, not just
 * flagged.
 */
export function summarizeResidualDivergence(
  residual: Set<string>,
  leaves: LeafAcceptanceCriteria[],
  totalAcs: number,
): {
  uncovered: number;
  total: number;
  coverage_pct: number;
  orphan_story_count: number;
  stories: Array<{ leaf_story_id: string; story_text?: string; orphan_ac_count: number; ac_ids: string[] }>;
} {
  const stories: Array<{ leaf_story_id: string; story_text?: string; orphan_ac_count: number; ac_ids: string[] }> = [];
  for (const l of leaves) {
    const acIds = l.acs.filter(a => residual.has(a.id)).map(a => a.id);
    if (acIds.length === 0) continue;
    stories.push({ leaf_story_id: l.leafStoryId, story_text: l.storyText, orphan_ac_count: acIds.length, ac_ids: acIds });
  }
  stories.sort((a, b) => b.orphan_ac_count - a.orphan_ac_count);
  const covered = totalAcs - residual.size;
  return {
    uncovered: residual.size,
    total: totalAcs,
    coverage_pct: totalAcs > 0 ? Math.round((covered / totalAcs) * 1000) / 10 : 100,
    orphan_story_count: stories.length,
    stories,
  };
}

/**
 * Extract the tasks array from an LLM JSON result, tolerating the nested
 * envelopes Phase 6 has historically seen (`{tasks:[]}`,
 * `{implementation_plan:[]}`, `{implementation_plan:{tasks:[]}}`).
 */
export function parseImplementationTasks(parsed: Record<string, unknown> | null): ImplementationTask[] {
  const ip = parsed && typeof parsed.implementation_plan === 'object' && !Array.isArray(parsed.implementation_plan)
    ? parsed.implementation_plan as Record<string, unknown>
    : null;
  const tasks =
    pickItemsArray<ImplementationTask>(parsed, ['implementation_plan', 'tasks']) ??
    (ip ? pickItemsArray<ImplementationTask>(ip, ['tasks', 'implementation_plan']) : null);
  return tasks ?? [];
}

/**
 * Coerce a Phase 6.1 LLM-emitted task into the canonical DecompositionTask
 * shape that Phase 6.1a saturation + downstream consumers expect.
 *
 * cal-26 surfaced three classes of LLM-output drift the prompt didn't
 * forbid:
 *   - missing `name` field (LLM omitted it; we fell back to t.id, which
 *     made sibling context render as `task-N: task-N`)
 *   - `completion_criteria` emitted as array of strings, not objects
 *     (renderer printed `[undefined] undefined` per item)
 *
 * The Phase 6 prompt rewrite (Track B) tightens the contract; this helper
 * (Track A) catches whatever the LLM still drifts on. Logs a single
 * structured warning per task that needed coercion so calibration can
 * surface the rate.
 */
export function normalizeRootTaskShape(
  raw: Record<string, unknown>,
  taskIdx: number,
  constraintIds: string[],
  srcRoot = 'src',
  leafAcIds?: Set<string>,
  componentOracle?: Set<string>,
  techOracle?: Set<string>,
): DecompositionTask {
  const t = raw as Partial<DecompositionTask> & Record<string, unknown>;
  const drifts: string[] = [];

  // 1. `name` fallback: prompt should require it; if missing, derive from
  // description (truncated) before falling back to id.
  let name = typeof t.name === 'string' && t.name.trim().length > 0 ? t.name : null;
  if (!name) {
    const desc = typeof t.description === 'string' ? t.description.trim() : '';
    if (desc.length > 0) {
      name = desc.length > 80 ? `${desc.slice(0, 77)}...` : desc;
      drifts.push('name_missing_derived_from_description');
    } else {
      name = String(t.id ?? `task-${taskIdx + 1}`);
      drifts.push('name_missing_fell_back_to_id');
    }
  }

  // 2. `completion_criteria` shape coercion: accept array of strings
  // (cal-26 LLM behavior) by lifting each into an object with a synthetic
  // criterion_id and verification_method=test_execution. Empty / missing
  // arrays surface as a single placeholder so downstream invariants
  // (Invariant IP-001 — at least one CC per task) can flag rather than
  // crash on undefined access.
  // CC→AC validation: keep only AC ids the LLM cited that are genuinely in
  // this task's leaf-AC set (regex-free membership; never invents). When the
  // task carries no leaf-AC set (lineage absent), pass the cited ids through
  // untouched rather than dropping all — coverage > precision when unknown.
  const validateVerifiesAcs = (cobj: Record<string, unknown>): string[] | undefined => {
    const rawIds = cobj.verifies_acceptance_criteria ?? cobj.verifies_acs ?? cobj.acceptance_criterion_ids;
    if (!Array.isArray(rawIds)) return undefined;
    const cited = rawIds.filter((x): x is string => typeof x === 'string' && x.length > 0);
    if (cited.length === 0) return undefined;
    if (!leafAcIds || leafAcIds.size === 0) return cited;
    const kept = cited.filter(id => leafAcIds.has(id));
    if (kept.length < cited.length) drifts.push('completion_criteria_verifies_ac_dropped_nonmember');
    return kept.length > 0 ? kept : undefined;
  };

  const rawCC = Array.isArray(t.completion_criteria) ? t.completion_criteria : [];
  const completion_criteria: TaskCompletionCriterion[] = rawCC.map((c, idx) => {
    if (typeof c === 'string') {
      drifts.push('completion_criteria_string_coerced');
      return {
        criterion_id: `CC-${String(idx + 1).padStart(3, '0')}`,
        description: c,
        verification_method: 'test_execution',
      };
    }
    if (c && typeof c === 'object') {
      const cobj = c as unknown as Record<string, unknown>;
      const criterion_id = typeof cobj.criterion_id === 'string'
        ? cobj.criterion_id
        : `CC-${String(idx + 1).padStart(3, '0')}`;
      let description: string;
      if (typeof cobj.description === 'string') description = cobj.description;
      else if (typeof cobj.text === 'string') description = cobj.text;
      else description = '(missing description)';
      if (typeof cobj.criterion_id !== 'string') drifts.push('completion_criteria_missing_id');
      if (typeof cobj.description !== 'string') drifts.push('completion_criteria_missing_description');
      const verification_method = typeof cobj.verification_method === 'string'
        ? cobj.verification_method as TaskCompletionCriterion['verification_method']
        : 'test_execution';
      const artifact_ref = typeof cobj.artifact_ref === 'string' ? cobj.artifact_ref : undefined;
      const verifies_acceptance_criteria = validateVerifiesAcs(cobj);
      return { criterion_id, description, verification_method, artifact_ref, verifies_acceptance_criteria };
    }
    drifts.push('completion_criteria_unparseable');
    return {
      criterion_id: `CC-${String(idx + 1).padStart(3, '0')}`,
      description: '(unparseable completion criterion)',
      verification_method: 'test_execution',
    };
  });
  if (completion_criteria.length === 0) {
    drifts.push('completion_criteria_empty');
  }

  // Deterministic write-scope (Project Layout Contract): the orchestrator owns
  // directories, the LLM owns task semantics. Override the LLM-invented
  // write_directory_paths with the canonical component dir so every task on a
  // component lands in the same place (no stray ./shared, no per-leaf layout
  // drift). The discarded LLM value is logged as a drift metric.
  let componentId = typeof t.component_id === 'string' ? t.component_id : '';
  // Resolve LLM separator/case drift in component_id against the real
  // component-model id set (the oracle). The planner routinely emits
  // `comp-redirect_handling_service` for the canonical
  // `comp-redirect-handling-service`; bounded similarity resolution maps it
  // back so the index / gatekeeper / packets see a real id (no exact-naming
  // dependency on the LLM).
  if (componentId && componentOracle) {
    const resolved = resolveAgainstOracle(componentId, componentOracle);
    if (resolved && resolved !== componentId) {
      drifts.push(`component_id_resolved:${componentId}→${resolved}`);
      componentId = resolved;
    }
  }
  const canonicalDir = canonicalComponentDir(componentId || 'unknown', srcRoot);
  const llmWriteDirs = Array.isArray(t.write_directory_paths)
    ? t.write_directory_paths.filter((p): p is string => typeof p === 'string').map(normalizeWorkspacePath)
    : [];
  if (llmWriteDirs.length > 0 && llmWriteDirs[0] !== canonicalDir) {
    drifts.push(`write_dirs_overridden:[${llmWriteDirs.join(',')}]→${canonicalDir}`);
  }

  // traces_to — accept `technical_spec_ids` alias, else `traces_to`. When the
  // leaf-AC set is supplied, VALIDATE cited AC ids STRUCTURALLY: an `AC-`
  // prefixed id (namespace classification, not a regex reduction) must be an
  // exact member of the leaf-AC set; non-members are LLM-invented refs and are
  // dropped (logged as drift). Non-AC ids (res-*/TECH-*/SR-*/comp-*) pass through.
  let rawTraces: string[];
  if (Array.isArray((t as Record<string, unknown>).technical_spec_ids)) {
    rawTraces = ((t as Record<string, unknown>).technical_spec_ids as unknown[]).filter((p): p is string => typeof p === 'string');
  } else if (Array.isArray(t.traces_to)) {
    rawTraces = t.traces_to.filter((p): p is string => typeof p === 'string');
  } else {
    rawTraces = [];
  }
  let traces_to = rawTraces;
  if (leafAcIds) {
    const droppedAcRefs = rawTraces.filter((id) => id.startsWith('AC-') && !leafAcIds.has(id));
    if (droppedAcRefs.length > 0) {
      traces_to = rawTraces.filter((id) => !id.startsWith('AC-') || leafAcIds.has(id));
      drifts.push(`invalid_ac_refs_dropped:[${droppedAcRefs.join(',')}]`);
    }
  }
  // Resolve drifted comp-*/TECH-* ids in traces_to against their oracles, so
  // P7 doesn't flag a real component/constraint referenced under a drifted id.
  if (componentOracle || techOracle) {
    traces_to = traces_to.map((id) => {
      if (componentOracle && id.startsWith('comp')) return resolveAgainstOracle(id, componentOracle) ?? id;
      // PA-9: suffix/separator-aware TECH resolution (the generic resolver misses
      // the canonical "-1" enumeration suffix, e.g. TECH-CERBOS → TECH-CERBOS-1).
      if (techOracle && id.startsWith('TECH-')) return resolveTechId(id, techOracle) ?? id;
      return id;
    });
  }

  if (drifts.length > 0) {
    getLogger().warn('workflow', 'Phase 6.1 task shape drift coerced', {
      task_id: t.id,
      task_idx: taskIdx,
      drifts,
    });
  }

  return {
    id: String(t.id ?? `task-${taskIdx + 1}`),
    name,
    description: typeof t.description === 'string' ? t.description : '',
    task_type: t.task_type as DecompositionTask['task_type'],
    component_id: componentId,
    component_responsibility: typeof t.component_responsibility === 'string' ? t.component_responsibility : '',
    estimated_complexity: t.estimated_complexity as DecompositionTask['estimated_complexity'],
    complexity_flag: typeof t.complexity_flag === 'string' ? t.complexity_flag : undefined,
    completion_criteria,
    write_directory_paths: [canonicalDir],
    read_directory_paths: Array.isArray(t.read_directory_paths)
      ? t.read_directory_paths.filter((p): p is string => typeof p === 'string').map(normalizeWorkspacePath)
      : [],
    dependency_task_ids: Array.isArray(t.dependency_task_ids)
      ? t.dependency_task_ids.filter((p): p is string => typeof p === 'string')
      : [],
    active_constraints: constraintIds,
    traces_to,
  };
}
