/**
 * Phase 8 — Evaluation Planning.
 * Based on JanumiCode Spec v2.3, §4 Phase 8.
 *
 * Sub-phases:
 *   8.1 — Functional Evaluation Design (Eval Design Agent LLM call)
 *   8.2 — Quality Evaluation Design (from same LLM response)
 *   8.3 — Reasoning Evaluation Design (from same LLM response)
 *   8.4 — Evaluation Plan Mirror and Menu (human review)
 *   8.5 — Approval (phase gate)
 *
 * The prompt template requests all three evaluation plans in a single
 * LLM call. The response is split into three separate artifacts.
 */

import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type { PhaseId } from '../../types/records';
import { getLogger } from '../../logging';
import { extractPriorPhaseContext } from './phaseContext';
import { buildPhaseContextPacket, type PhaseContextPacketResult } from './dmrContext';

// ── Artifact shape interfaces ──────────────────────────────────────

interface FunctionalEvalCriterion {
  functional_requirement_id: string;
  evaluation_method: string;
  success_condition: string;
}

interface QualityEvalCriterion {
  nfr_id: string;
  category: string;
  evaluation_tool: string;
  threshold: string;
  measurement_method: string;
  fallback_if_tool_unavailable?: string;
}

interface ReasoningScenario {
  id: string;
  description: string;
  pass_criteria: string;
}

interface EvalDesignResult {
  functional_evaluation_plan: { criteria: FunctionalEvalCriterion[] };
  quality_evaluation_plan: { criteria: QualityEvalCriterion[] };
  reasoning_evaluation_plan: { scenarios: ReasoningScenario[]; ai_subsystems_detected: boolean };
}

// ── Handler ────────────────────────────────────────────────────────

export class Phase8Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '8';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];

    // ── Gather prior phase outputs ──────────────────────────────
    const allArtifacts = engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced');
    const prior = extractPriorPhaseContext(allArtifacts);

    const nfrSummary = prior.nonFunctionalRequirements?.summary ?? 'No NFRs available';
    const testPlanSummary = prior.testPlan
      ? `(read-only — do not duplicate test cases)\n${prior.testPlan.summary}`
      : 'No test plan available';
    const derivedFromIds = prior.allRecordIds;

    // ── 8.1–8.3 — Evaluation Design (single LLM call) ────────
    engine.stateMachine.setSubPhase(workflowRun.id, '8.1');

    const dmr81 = await buildPhaseContextPacket(ctx, {
      subPhaseId: '8.1',
      requestingAgentRole: 'eval_design_agent',
      query: `Evaluation design for test plan and NFRs: ${nfrSummary.slice(0, 400)}`,
      detailFileLabel: 'p8_1_evals',
      requiredOutputSpec: 'functional_evaluation_plan, quality_evaluation_plan, reasoning_evaluation_plan',
    });

    const evalResult = await this.runEvaluationDesign(ctx, testPlanSummary, nfrSummary, dmr81);

    // Write functional evaluation plan
    const funcEvalRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '8',
      sub_phase_id: '8.1',
      produced_by_agent_role: 'eval_design_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: derivedFromIds,
      content: { kind: 'functional_evaluation_plan', ...evalResult.functional_evaluation_plan },
    });
    artifactIds.push(funcEvalRecord.id);
    engine.ingestionPipeline.ingest(funcEvalRecord);

    // Write quality evaluation plan
    engine.stateMachine.setSubPhase(workflowRun.id, '8.2');

    const qualityEvalRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '8',
      sub_phase_id: '8.2',
      produced_by_agent_role: 'eval_design_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [funcEvalRecord.id],
      content: { kind: 'quality_evaluation_plan', ...evalResult.quality_evaluation_plan },
    });
    artifactIds.push(qualityEvalRecord.id);
    engine.ingestionPipeline.ingest(qualityEvalRecord);

    // Write reasoning evaluation plan
    engine.stateMachine.setSubPhase(workflowRun.id, '8.3');

    const reasoningEvalRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '8',
      sub_phase_id: '8.3',
      produced_by_agent_role: 'eval_design_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [funcEvalRecord.id],
      content: { kind: 'reasoning_evaluation_plan', ...evalResult.reasoning_evaluation_plan },
    });
    artifactIds.push(reasoningEvalRecord.id);
    engine.ingestionPipeline.ingest(reasoningEvalRecord);

    // ── 8.4 — Mirror and Menu ─────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '8.4');

    const evalMirror = engine.mirrorGenerator.generate({
      artifactId: funcEvalRecord.id,
      artifactType: 'evaluation_plan',
      content: {
        functional_criteria: evalResult.functional_evaluation_plan.criteria.length,
        quality_criteria: evalResult.quality_evaluation_plan.criteria.length,
        reasoning_scenarios: evalResult.reasoning_evaluation_plan.scenarios.length,
        ai_subsystems_detected: evalResult.reasoning_evaluation_plan.ai_subsystems_detected,
      },
    });

    const mirrorRecord = engine.writer.writeRecord({
      record_type: 'mirror_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '8',
      sub_phase_id: '8.4',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [funcEvalRecord.id, qualityEvalRecord.id, reasoningEvalRecord.id],
      content: {
        kind: 'evaluation_plan_mirror',
        mirror_id: evalMirror.mirrorId,
        artifact_id: funcEvalRecord.id,
        artifact_type: 'evaluation_plan',
        fields: evalMirror.fields,
        functional_criteria_count: evalResult.functional_evaluation_plan.criteria.length,
        quality_criteria_count: evalResult.quality_evaluation_plan.criteria.length,
        reasoning_scenarios_count: evalResult.reasoning_evaluation_plan.scenarios.length,
      },
    });
    artifactIds.push(mirrorRecord.id);
    engine.eventBus.emit('mirror:presented', { mirrorId: evalMirror.mirrorId, artifactType: 'evaluation_plan' });

    try {
      const resolution = await engine.pauseForDecision(workflowRun.id, mirrorRecord.id, 'mirror');
      if (resolution.type === 'mirror_rejection') {
        return { success: false, error: 'User rejected evaluation plan', artifactIds };
      }
    } catch (err) {
      getLogger().warn('workflow', 'Phase 8 review failed', { error: String(err) });
      return { success: false, error: 'Evaluation plan review failed', artifactIds };
    }

    // ── 8.5 — Approval ────────────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '8.5');

    const gateRecord = engine.writer.writeRecord({
      record_type: 'phase_gate_evaluation',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '8',
      sub_phase_id: '8.5',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [funcEvalRecord.id, qualityEvalRecord.id, reasoningEvalRecord.id],
      content: {
        kind: 'phase_gate',
        phase_id: '8',
        functional_eval_record_id: funcEvalRecord.id,
        quality_eval_record_id: qualityEvalRecord.id,
        reasoning_eval_record_id: reasoningEvalRecord.id,
        has_unresolved_warnings: false,
        has_high_severity_flaws: false,
      },
    });
    artifactIds.push(gateRecord.id);
    engine.eventBus.emit('phase_gate:pending', { phaseId: '8' });

    return { success: true, artifactIds };
  }

  // ── LLM call helper ───────────────────────────────────────────

  private async runEvaluationDesign(
    ctx: PhaseContext, testPlanSummary: string, nfrSummary: string,
    dmr: PhaseContextPacketResult,
  ): Promise<EvalDesignResult> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('eval_design_agent', '08_1_evaluation_design');

    const fallback: EvalDesignResult = {
      functional_evaluation_plan: { criteria: [{ functional_requirement_id: 'US-001', evaluation_method: 'Manual inspection', success_condition: 'Core functionality works as specified' }] },
      quality_evaluation_plan: { criteria: [{ nfr_id: 'NFR-001', category: 'performance', evaluation_tool: 'load_testing', threshold: 'p95 < 500ms', measurement_method: 'Run load test with representative workload', fallback_if_tool_unavailable: 'Manual timing with curl' }] },
      reasoning_evaluation_plan: { scenarios: [], ai_subsystems_detected: false },
    };

    if (!template) return fallback;

    const rendered = engine.templateLoader.render(template, {
      active_constraints: dmr.activeConstraintsText,
      test_plan_summary: testPlanSummary,
      non_functional_requirements_summary: nfrSummary,
      compliance_context_summary: 'No compliance regimes',
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    try {
      const result = await engine.llmCaller.call({
        provider: 'ollama', model: process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b',
        prompt: rendered.rendered, responseFormat: 'json', temperature: 0.4,
        traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '8', subPhaseId: '8.1', agentRole: 'eval_design_agent', label: 'Phase 8.1-8.3 — Evaluation Design' },
      });

      const parsed = result.parsed as Record<string, unknown> | null;
      if (!parsed) return fallback;

      // Extract the three plans from the response — LLM may nest them
      const funcPlan = (parsed.functional_evaluation_plan ?? { criteria: parsed.criteria ?? [] }) as { criteria: FunctionalEvalCriterion[] };
      const qualPlan = (parsed.quality_evaluation_plan ?? { criteria: [] }) as { criteria: QualityEvalCriterion[] };
      const reasPlan = (parsed.reasoning_evaluation_plan ?? { scenarios: [], ai_subsystems_detected: false }) as { scenarios: ReasoningScenario[]; ai_subsystems_detected: boolean };

      return {
        functional_evaluation_plan: { criteria: Array.isArray(funcPlan.criteria) ? funcPlan.criteria : [] },
        quality_evaluation_plan: { criteria: Array.isArray(qualPlan.criteria) ? qualPlan.criteria : [] },
        reasoning_evaluation_plan: {
          scenarios: Array.isArray(reasPlan.scenarios) ? reasPlan.scenarios : [],
          ai_subsystems_detected: reasPlan.ai_subsystems_detected ?? false,
        },
      };
    } catch (err) {
      getLogger().warn('workflow', 'Evaluation design failed', { error: String(err) });
      return fallback;
    }
  }
}
