/**
 * Phase 6 — Implementation Planning.
 * Based on JanumiCode Spec v2.3, §4 Phase 6.
 *
 * Sub-phases:
 *   6.1 — Implementation Task Decomposition (Implementation Planner LLM call)
 *   6.2 — Implementation Plan Mirror and Menu (human review)
 *   6.3 — Approval (phase gate)
 */

import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type { PhaseId } from '../../types/records';
import { getLogger } from '../../logging';
import { extractPriorPhaseContext } from './phaseContext';
import { buildPhaseContextPacket, type PhaseContextPacketResult } from './dmrContext';

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

    // ── Gather prior phase outputs ──────────────────────────────
    const allArtifacts = engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced');
    const prior = extractPriorPhaseContext(allArtifacts);

    const componentSummary = `PROJECT TYPE: ${prior.projectTypeDescription}\n\n${prior.componentModel?.summary ?? 'No component model available'}`;
    const techSpecsSummary = [
      prior.dataModels?.summary ?? 'No data models',
      prior.apiDefinitions?.summary ?? 'No API definitions',
      prior.errorHandlingStrategies?.summary ?? '',
      prior.configurationParameters?.summary ?? '',
    ].filter(Boolean).join('\n\n');
    const derivedFromIds = prior.allRecordIds;

    // ── 6.1 — Implementation Task Decomposition ──────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '6.1');

    const dmr61 = await buildPhaseContextPacket(ctx, {
      subPhaseId: '6.1',
      requestingAgentRole: 'implementation_planner',
      query: `Implementation task decomposition for: ${componentSummary.slice(0, 400)}`,
      detailFileLabel: 'p6_1_tasks',
      requiredOutputSpec: 'implementation_plan JSON — tasks with component_id, dependencies, completion_criteria',
    });

    const planContent = await this.runTaskDecomposition(
      ctx, componentSummary, techSpecsSummary, dmr61,
    );

    const planRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '6',
      sub_phase_id: '6.1',
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

    // ── 6.2 — Mirror and Menu ─────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '6.2');

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
      sub_phase_id: '6.2',
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
    engine.stateMachine.setSubPhase(workflowRun.id, '6.3');

    // Consistency check
    const consistencyReport = this.runConsistencyCheck(planContent);

    const consistencyRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '6',
      sub_phase_id: '6.3',
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
      sub_phase_id: '6.3',
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
    const template = engine.templateLoader.findTemplate('implementation_planner', '06_1_implementation_task_decomposition');

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
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    // LLM throws propagate to engine catch (halts workflow).
    const result = await engine.llmCaller.call({
      provider: 'ollama',
      model: process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b',
      prompt: rendered.rendered,
      responseFormat: 'json',
      temperature: 0.4,
      traceContext: {
        workflowRunId: ctx.workflowRun.id,
        phaseId: '6',
        subPhaseId: '6.1',
        agentRole: 'implementation_planner',
        label: 'Phase 6.1 — Implementation Task Decomposition',
      },
    });

    const parsed = result.parsed as Record<string, unknown> | null;
    const ip = parsed?.implementation_plan ?? parsed;
    const data = (Array.isArray(ip) ? ip[0] : ip) as Partial<ImplementationPlan> | null;
    if (data?.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
      return { tasks: data.tasks as ImplementationTask[] };
    }
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
