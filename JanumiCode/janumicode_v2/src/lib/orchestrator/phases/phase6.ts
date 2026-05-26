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
} from '../../types/records';
import { getLogger } from '../../logging';
import { extractPriorPhaseContext, buildEffectiveComponentView } from './phaseContext';
import { buildPhaseContextPacket, type PhaseContextPacketResult } from './dmrContext';
import { pickItemsArray } from '../parsedResponseHelpers';
import { runTaskSaturationLoop } from './phase6_1a';
import { runPhase6CycleDelta } from './runCycleDelta';

// ── Artifact shape interfaces ──────────────────────────────────────

interface CompletionCriterion {
  criterion_id: string;
  description: string;
  verification_method: 'schema_check' | 'invariant' | 'output_comparison' | 'test_execution';
  artifact_ref?: string;
}

interface ImplementationTask {
  id: string;
  task_type: 'standard' | 'refactoring';
  component_id: string;
  component_responsibility: string;
  description: string;
  technical_spec_ids?: string[];
  backing_tool: string;
  dependency_task_ids?: string[];
  estimated_complexity: 'low' | 'medium' | 'high';
  complexity_flag?: string;
  completion_criteria: CompletionCriterion[];
  write_directory_paths?: string[];
  read_directory_paths?: string[];
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
    });

    const rawPlan = await this.runTaskDecomposition(
      ctx, componentSummary, techSpecsSummary, dmr61,
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

    const planRecord = engine.writer.writeRecord({
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
      rootTasks = planContent.tasks.map((t, taskIdx) => {
        // cal-26 surfaced three LLM-output shape defects the prompt didn't
        // explicitly forbid; coerce them defensively here so downstream
        // saturation/render code sees a clean shape regardless of whether
        // the (rewritten) prompt also enforces them. Logged via the
        // post-coercion warning in normalizeRootTaskShape() below.
        return normalizeRootTaskShape(t as unknown as Record<string, unknown>, taskIdx, constraintIds);
      });
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

    if (rootTasks.length > 0) {
      await runTaskSaturationLoop(ctx, {
        technicalConstraints,
        componentSummary,
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

    return { success: true, artifactIds };
  }

  // ── LLM call helper ───────────────────────────────────────────

  private async runTaskDecomposition(
    ctx: PhaseContext, componentSummary: string, techSpecsSummary: string,
    dmr: PhaseContextPacketResult,
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
        backing_tool: 'code_editor',
        estimated_complexity: 'medium',
        completion_criteria: [{
          criterion_id: 'CC-001',
          description: 'Module compiles and passes basic tests',
          verification_method: 'test_execution',
        }],
      }],
    };

    if (!template) return fallback;

    const rendered = engine.templateLoader.render(template, {
      active_constraints: dmr.activeConstraintsText,
      component_model_summary: componentSummary,
      technical_specs_summary: techSpecsSummary,
      detail_file_path: dmr.detailFilePath,
      detail_file_content: dmr.detailFileContent,
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    // LLM throws propagate to engine catch (halts workflow).
    // Route through requirements_agent routing for llamacpp via
    // llama-swap. See phase3.ts for the rationale.
    const result = await engine.callForRole('requirements_agent', {
      prompt: rendered.rendered,
      responseFormat: 'json',
      temperature: 0.4,
      traceContext: {
        workflowRunId: ctx.workflowRun.id,
        phaseId: '6',
        subPhaseId: 'task_skeleton',
        agentRole: 'implementation_planner',
        label: 'Phase 6.1 — Implementation Task Decomposition',
      },
    });

    // Defensive parse — see parsedResponseHelpers.ts. cal-21 happened
    // to use the schema-key envelope here so didn't lose data, but
    // the model is free to switch to `{ implementation_plan: [...] }`
    // on retry. Same migration as Phase 3-5.
    const parsed = result.parsed as Record<string, unknown> | null;
    // qwen3.5-35b-a3b often nests as { implementation_plan: { tasks: [...] } }
    // rather than the flatter { implementation_plan: [...] } / { tasks: [...] }
    // shapes pickItemsArray expects. Unwrap one level when we see the nested
    // object envelope so the 25-task plan isn't silently dropped to fallback.
    const ip = parsed && typeof parsed.implementation_plan === 'object' && !Array.isArray(parsed.implementation_plan)
      ? parsed.implementation_plan as Record<string, unknown>
      : null;
    const tasks =
      pickItemsArray<ImplementationTask>(parsed, ['implementation_plan', 'tasks']) ??
      (ip ? pickItemsArray<ImplementationTask>(ip, ['tasks', 'implementation_plan']) : null);
    if (tasks && tasks.length > 0) return { tasks };
    return fallback;
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
 *   - `backing_tool` set to a language name like "Python" outside the
 *     active_constraints stack (hallucinated from training data)
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
      const description = typeof cobj.description === 'string'
        ? cobj.description
        : (typeof cobj.text === 'string' ? cobj.text : '(missing description)');
      if (typeof cobj.criterion_id !== 'string') drifts.push('completion_criteria_missing_id');
      if (typeof cobj.description !== 'string') drifts.push('completion_criteria_missing_description');
      const verification_method = typeof cobj.verification_method === 'string'
        ? cobj.verification_method as TaskCompletionCriterion['verification_method']
        : 'test_execution';
      const artifact_ref = typeof cobj.artifact_ref === 'string' ? cobj.artifact_ref : undefined;
      return { criterion_id, description, verification_method, artifact_ref };
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

  // 3. `backing_tool` constraint check: warn (do not auto-correct) when
  // the LLM picks a language name outside the active_constraints stack.
  // Auto-correcting is risky — the safer behavior is to flag, let the
  // saturation pass's stricter prompt re-emit a sensible value, and surface
  // the rate via warning logs.
  const KNOWN_BACKING_TOOLS = new Set([
    'claude_code_cli', 'codex_cli', 'gemini_cli', 'goose_cli', 'code_editor', 'direct_llm_api',
  ]);
  const backing_tool = typeof t.backing_tool === 'string' ? t.backing_tool : undefined;
  if (backing_tool && !KNOWN_BACKING_TOOLS.has(backing_tool)) {
    drifts.push(`backing_tool_outside_known_set:${backing_tool}`);
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
    component_id: typeof t.component_id === 'string' ? t.component_id : '',
    component_responsibility: typeof t.component_responsibility === 'string' ? t.component_responsibility : '',
    backing_tool,
    estimated_complexity: t.estimated_complexity as DecompositionTask['estimated_complexity'],
    complexity_flag: typeof t.complexity_flag === 'string' ? t.complexity_flag : undefined,
    completion_criteria,
    write_directory_paths: Array.isArray(t.write_directory_paths)
      ? t.write_directory_paths.filter((p): p is string => typeof p === 'string').map(normalizeWorkspacePath)
      : [],
    read_directory_paths: Array.isArray(t.read_directory_paths)
      ? t.read_directory_paths.filter((p): p is string => typeof p === 'string').map(normalizeWorkspacePath)
      : [],
    dependency_task_ids: Array.isArray(t.dependency_task_ids)
      ? t.dependency_task_ids.filter((p): p is string => typeof p === 'string')
      : [],
    active_constraints: constraintIds,
    traces_to: Array.isArray((t as Record<string, unknown>).technical_spec_ids)
      ? ((t as Record<string, unknown>).technical_spec_ids as unknown[]).filter((p): p is string => typeof p === 'string')
      : (Array.isArray(t.traces_to) ? t.traces_to.filter((p): p is string => typeof p === 'string') : []),
  };
}
