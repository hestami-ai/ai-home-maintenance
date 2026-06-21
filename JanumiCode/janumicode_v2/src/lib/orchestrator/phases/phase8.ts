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
import type { PhaseId, PropertySpec } from '../../types/records';
import { getLogger } from '../../logging';
import { extractPriorPhaseContext } from './phaseContext';
import { buildRequirementLineage } from './packetSynthesis/idResolution';
import { buildPhaseContextPacket, type PhaseContextPacketResult } from './dmrContext';
import { runPhase8CycleDelta } from './runCycleDelta';
import { emit as aoddEmit } from '../../aodd';

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
  /**
   * Present when the NFR threshold is expressible as a generative property —
   * the measurement becomes "generate inputs from the domain, assert the
   * threshold invariant holds for all of them" rather than a manual inspection.
   */
  property_spec?: PropertySpec;
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

    // ── Cycle-delta short-circuit ───────────────────────────────
    if ((workflowRun.current_cycle_number ?? 0) > 0) {
      return runPhase8CycleDelta(ctx);
    }

    // ── Gather prior phase outputs ──────────────────────────────
    const allArtifacts = engine.writer.getRecordsByType(workflowRun.id, 'artifact_produced');
    const prior = extractPriorPhaseContext(allArtifacts);

    const frSummary = prior.functionalRequirements?.summary ?? 'No FRs available';
    const nfrSummary = prior.nonFunctionalRequirements?.summary ?? 'No NFRs available';
    const testPlanSummary = prior.testPlan
      ? `(read-only — do not duplicate test cases)\n${prior.testPlan.summary}`
      : 'No test plan available';
    const derivedFromIds = prior.allRecordIds;

    // ── 8.1–8.3 — Evaluation Design (single LLM call) ────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'evaluation_design');

    const frIds = ((prior.functionalRequirements?.content.user_stories as Array<Record<string, unknown>>) ?? [])
      .map(s => (typeof s.id === 'string' ? s.id : ''))
      .filter(Boolean);
    const nfrIds = ((prior.nonFunctionalRequirements?.content.requirements as Array<Record<string, unknown>>) ?? [])
      .map(n => (typeof n.id === 'string' ? n.id : ''))
      .filter(Boolean);
    const dmr81Seeds = [
      ...(prior.functionalRequirements ? [prior.functionalRequirements.recordId] : []),
      ...(prior.nonFunctionalRequirements ? [prior.nonFunctionalRequirements.recordId] : []),
      ...(prior.testPlan ? [prior.testPlan.recordId] : []),
    ];
    const dmr81 = await buildPhaseContextPacket(ctx, {
      subPhaseId: 'evaluation_design',
      requestingAgentRole: 'eval_design_agent',
      query: `Evaluation plans for FRs ${frIds.join(', ')} and NFRs ${nfrIds.join(', ')} against test_plan ${prior.testPlan?.recordId ?? 'unknown'}.`,
      knownRelevantRecordIds: dmr81Seeds,
      detailFileLabel: 'p8_1_evals',
      requiredOutputSpec: 'functional_evaluation_plan, quality_evaluation_plan, reasoning_evaluation_plan',
    });

    const evalResult = await this.runEvaluationDesign(ctx, testPlanSummary, frSummary, nfrSummary, dmr81);

    // ── Deterministic eval-target canonicalization (structural, no regex) ──
    // runEvaluationDesign (a single LLM call) emits `functional_requirement_id`s
    // as a chaotic mix of root (US-003) and scattered decomposed leaves
    // (US-007-2-1-D). A packet carries a DIFFERENT leaf of the same story, so it
    // finds no eval whose target matches → P4_USER_STORY_NO_EVAL. Collapse every
    // target to its decomposition-tree root so each story with any eval is
    // covered at root; the packet builder's P4 bridge then satisfies all its
    // leaves. Walk the real requirement_decomposition_node tree — never a regex.
    const lineage = buildRequirementLineage([
      ...allArtifacts,
      ...engine.writer.getRecordsByType(workflowRun.id, 'requirement_decomposition_node'),
    ]);
    evalResult.functional_evaluation_plan.criteria = canonicalizeFunctionalEvalTargets(
      evalResult.functional_evaluation_plan.criteria,
      lineage.canonicalize,
    );

    // ── Eval coverage report (visibility only — NO fabricated backfill) ──
    // Surface root US / NFR that the LLM left un-evaluated as honest gaps,
    // mirroring Phase-7's test_coverage_report. The genuine gaps remain blocking
    // P4/P5 failures downstream; this just makes them operator-visible.
    const evalCoverage = computeEvalCoverage(
      frIds, nfrIds,
      evalResult.functional_evaluation_plan.criteria,
      evalResult.quality_evaluation_plan.criteria,
    );
    const evalCoverageRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '8',
      sub_phase_id: 'evaluation_design',
      produced_by_agent_role: 'eval_design_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: derivedFromIds,
      content: { kind: 'evaluation_coverage_report', ...evalCoverage },
    });
    artifactIds.push(evalCoverageRecord.id);
    if (evalCoverage.gaps.length > 0) {
      getLogger().warn('workflow', 'Phase 8 evaluation coverage gaps (honest — not backfilled)', {
        workflow_run_id: workflowRun.id,
        gaps: evalCoverage.gaps.map((g) => g.requirement_id),
      });
    }

    // Write functional evaluation plan
    const funcEvalRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '8',
      sub_phase_id: 'evaluation_design',
      produced_by_agent_role: 'eval_design_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: derivedFromIds,
      content: { kind: 'functional_evaluation_plan', ...evalResult.functional_evaluation_plan },
    });
    artifactIds.push(funcEvalRecord.id);
    engine.ingestionPipeline.ingest(funcEvalRecord);

    // Write quality evaluation plan
    engine.stateMachine.setSubPhase(workflowRun.id, 'evaluation_metrics');

    const qualityEvalRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '8',
      sub_phase_id: 'evaluation_metrics',
      produced_by_agent_role: 'eval_design_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [funcEvalRecord.id],
      content: { kind: 'quality_evaluation_plan', ...evalResult.quality_evaluation_plan },
    });
    artifactIds.push(qualityEvalRecord.id);
    engine.ingestionPipeline.ingest(qualityEvalRecord);

    // Write reasoning evaluation plan
    engine.stateMachine.setSubPhase(workflowRun.id, 'evaluation_thresholds');

    const reasoningEvalRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '8',
      sub_phase_id: 'evaluation_thresholds',
      produced_by_agent_role: 'eval_design_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [funcEvalRecord.id],
      content: { kind: 'reasoning_evaluation_plan', ...evalResult.reasoning_evaluation_plan },
    });
    artifactIds.push(reasoningEvalRecord.id);
    engine.ingestionPipeline.ingest(reasoningEvalRecord);

    // ── 8.4 — Mirror and Menu ─────────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'evaluation_synthesis');

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
      sub_phase_id: 'evaluation_synthesis',
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
    engine.stateMachine.setSubPhase(workflowRun.id, 'evaluation_gate');

    const gateRecord = engine.writer.writeRecord({
      record_type: 'phase_gate_evaluation',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '8',
      sub_phase_id: 'evaluation_gate',
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
    aoddEmit('gate.pending', { gate_kind: 'phase_gate' });

    return { success: true, artifactIds };
  }

  // ── LLM call helper ───────────────────────────────────────────

  private async runEvaluationDesign(
    ctx: PhaseContext, testPlanSummary: string, frSummary: string, nfrSummary: string,
    dmr: PhaseContextPacketResult,
  ): Promise<EvalDesignResult> {
    const { engine } = ctx;
    const template = engine.templateLoader.findTemplate('eval_design_agent', 'evaluation_design');

    const fallback: EvalDesignResult = {
      functional_evaluation_plan: { criteria: [{ functional_requirement_id: 'US-001', evaluation_method: 'Manual inspection', success_condition: 'Core functionality works as specified' }] },
      quality_evaluation_plan: { criteria: [{ nfr_id: 'NFR-001', category: 'performance', evaluation_tool: 'load_testing', threshold: 'p95 < 500ms', measurement_method: 'Run load test with representative workload', fallback_if_tool_unavailable: 'Manual timing with curl' }] },
      reasoning_evaluation_plan: { scenarios: [], ai_subsystems_detected: false },
    };

    if (!template) return fallback;

    const rendered = engine.templateLoader.render(template, {
      active_constraints: dmr.activeConstraintsText,
      test_plan_summary: testPlanSummary,
      functional_requirements_summary: frSummary,
      non_functional_requirements_summary: nfrSummary,
      compliance_context_summary: 'No compliance regimes',
      janumicode_version_sha: engine.janumiCodeVersionSha,
    });
    if (rendered.missing_variables.length > 0) return fallback;

    // LLM throws propagate to engine catch (halts workflow).
    const result = await engine.callForRole('requirements_agent', {
      prompt: rendered.rendered, responseFormat: 'json', temperature: 0.4,
      traceContext: { workflowRunId: ctx.workflowRun.id, phaseId: '8', subPhaseId: 'evaluation_design', agentRole: 'eval_design_agent', label: 'Phase 8.1-8.3 — Evaluation Design' },
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
  }
}

// ── Pure helpers (exported for unit tests) ─────────────────────────

export interface EvaluationCoverageGap {
  requirement_id: string;
  kind: 'functional' | 'quality';
  reason: string;
}

/**
 * Reduce every functional eval criterion's `functional_requirement_id` to its
 * decomposition-tree root via `canonicalize` (structural — never a regex), and
 * dedupe by `(root_target, evaluation_method)`. Consolidates the LLM's mix of
 * root + scattered-leaf targets so each story with any eval is covered at root.
 */
export function canonicalizeFunctionalEvalTargets(
  criteria: FunctionalEvalCriterion[],
  canonicalize: (id: string) => string,
): FunctionalEvalCriterion[] {
  const seen = new Set<string>();
  const out: FunctionalEvalCriterion[] = [];
  for (const c of criteria) {
    const target = canonicalize(c.functional_requirement_id);
    const key = `${target}::${c.evaluation_method}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...c, functional_requirement_id: target });
  }
  return out;
}

/**
 * Deterministic eval-coverage report (visibility, NO backfill): every root US
 * should carry ≥1 functional criterion and every NFR ≥1 quality criterion.
 * Returns the un-covered ids as honest gaps + a coverage percentage. Mirrors
 * Phase-7's `runCoverageAnalysis`.
 */
export function computeEvalCoverage(
  frIds: string[],
  nfrIds: string[],
  funcCriteria: FunctionalEvalCriterion[],
  qualCriteria: QualityEvalCriterion[],
): { gaps: EvaluationCoverageGap[]; coverage_percentage: number } {
  const funcCovered = new Set(funcCriteria.map((c) => c.functional_requirement_id));
  const qualCovered = new Set(qualCriteria.map((c) => c.nfr_id));
  const usGaps = frIds.filter((id) => !funcCovered.has(id));
  const nfrGaps = nfrIds.filter((id) => !qualCovered.has(id));
  const total = (frIds.length + nfrIds.length) || 1;
  return {
    gaps: [
      ...usGaps.map((id): EvaluationCoverageGap => ({ requirement_id: id, kind: 'functional', reason: `No functional evaluation criterion targets ${id}` })),
      ...nfrGaps.map((id): EvaluationCoverageGap => ({ requirement_id: id, kind: 'quality', reason: `No quality evaluation criterion targets ${id}` })),
    ],
    coverage_percentage: Math.round(((total - usGaps.length - nfrGaps.length) / total) * 100),
  };
}
