/**
 * Reasoning Review — inspects an agent's Execution Trace against the flaw taxonomy.
 * Based on JanumiCode Spec v2.3, §8.1.
 *
 * Single stateless LLM API call. Primary provider: configurable.
 * Receives a Trace Selection (excluding tool results).
 * Produces a reasoning_review_record.
 *
 * Prompt is loaded from .janumicode/prompts/cross_cutting/reasoning_review.system.md
 * — single source of truth for both production and probe tests.
 */

import { LLMCaller } from '../llm/llmCaller';
import { ContextBuilder, type TraceRecord } from '../orchestrator/contextBuilder';
import { TemplateLoader } from '../orchestrator/templateLoader';
import type { ReasoningFlawType } from '../types/records';

// ── Types ───────────────────────────────────────────────────────────

export interface ReasoningReviewInput {
  /** Trace records from the agent invocation */
  traceRecords: TraceRecord[];
  /** Whether the agent is an Executor Agent (affects trace selection) */
  isExecutorAgent: boolean;
  /** Required output specification from the prompt template */
  requiredOutputSpec: string;
  /** Phase Gate criteria for the current phase */
  phaseGateCriteria: string;
  /** The final output artifact (for comparison) */
  finalOutput: string;
  /** Governing ADR IDs (for implementation_divergence checks) */
  governingAdrIds?: string[];
  /** Completion criteria (for completeness_shortcut checks) */
  completionCriteria?: string;
  /** Sub-phase ID */
  subPhaseId: string;
  /**
   * Workflow run ID — threaded into the LLM trace context so fixture
   * capture and writer instrumentation can attribute the review call to
   * the correct phase/sub-phase. Without this, captured fixtures land
   * in an `unknown__00` bucket instead of `phase_NN/`.
   */
  workflowRunId?: string;
}

export interface ReasoningReviewResult {
  overallPass: boolean;
  flaws: ReasoningFlaw[];
  traceSelectionRecordIds: string[];
  traceSamplingApplied: boolean;
  traceStrideN: number | null;
  reviewedOutputRecordId?: string;
  subPhaseId: string;
}

export interface ReasoningFlaw {
  flawType: ReasoningFlawType;
  severity: 'high' | 'low';
  description: string;
  evidence: string;
  governingAdrId?: string;
  completionCriteriaId?: string;
  recommendedAction: ReasoningFlawAction;
}

export type ReasoningFlawAction =
  | 'retry'
  | 'escalate'
  | 'accept_with_caveat'
  | 'return_to_phase4'
  | 'escalate_to_unsticking';

export interface ReasoningReviewConfig {
  provider: string;
  model: string;
  traceMaxTokens: number;
  temperature: number;
  janumiCodeVersionSha: string;
}

const TEMPLATE_KEY = 'cross_cutting/reasoning_review.system';

// ── ReasoningReview ─────────────────────────────────────────────────

export class ReasoningReview {
  constructor(
    private readonly llmCaller: LLMCaller,
    private readonly contextBuilder: ContextBuilder,
    private readonly templateLoader: TemplateLoader,
    private readonly config: ReasoningReviewConfig,
  ) {}

  /**
   * Run Reasoning Review on an agent's execution trace.
   */
  async review(input: ReasoningReviewInput): Promise<ReasoningReviewResult> {
    // Build trace selection
    const traceSelection = this.contextBuilder.buildTraceSelection(
      input.traceRecords,
      input.isExecutorAgent,
      this.config.traceMaxTokens,
    );

    // Build the trace text for the LLM
    const traceText = this.buildTraceText(input.traceRecords, traceSelection.selectedRecordIds);

    // Render the prompt from the template file
    const prompt = this.renderPrompt(input, traceText);

    // Call LLM
    const llmResult = await this.llmCaller.call({
      provider: this.config.provider,
      model: this.config.model,
      prompt,
      responseFormat: 'json',
      temperature: this.config.temperature,
      traceContext: input.workflowRunId
        ? {
            workflowRunId: input.workflowRunId,
            phaseId: input.subPhaseId.split('.')[0],
            subPhaseId: input.subPhaseId,
            agentRole: 'reasoning_review',
          }
        : undefined,
    });

    // Parse result
    return this.parseResult(llmResult.parsed, traceSelection, input.subPhaseId);
  }

  /**
   * Build the trace text from selected records.
   */
  private buildTraceText(
    allRecords: TraceRecord[],
    selectedIds: string[],
  ): string {
    const selectedSet = new Set(selectedIds);
    const selected = allRecords.filter(r => selectedSet.has(r.id));

    return selected.map(r => {
      const prefix = r.type === 'agent_self_correction'
        ? '[SELF-CORRECTION]'
        : r.type === 'tool_call'
        ? '[TOOL CALL]'
        : '[REASONING]';
      return `${prefix} (seq ${r.sequencePosition}):\n${r.content}`;
    }).join('\n\n---\n\n');
  }

  /**
   * Render the prompt from the template file — single source of truth.
   */
  private renderPrompt(input: ReasoningReviewInput, traceText: string): string {
    const template = this.templateLoader.getTemplate(TEMPLATE_KEY);

    if (!template) {
      throw new Error(
        `Reasoning Review prompt template not found: ${TEMPLATE_KEY}. ` +
        `Ensure .janumicode/prompts/cross_cutting/reasoning_review.system.md exists.`,
      );
    }

    // Build optional variable content
    let governingAdrs = '';
    if (input.governingAdrIds?.length) {
      governingAdrs = `Governing ADR IDs (for implementation_divergence checks): ${input.governingAdrIds.join(', ')}`;
    }

    let completionCriteria = '';
    if (input.completionCriteria) {
      completionCriteria = `Completion Criteria (for completeness_shortcut checks):\n${input.completionCriteria}`;
    }

    const result = this.templateLoader.render(template, {
      trace_selection: traceText,
      required_output_specification: input.requiredOutputSpec,
      phase_gate_criteria: input.phaseGateCriteria,
      final_output: input.finalOutput,
      governing_adrs: governingAdrs,
      completion_criteria: completionCriteria,
      janumicode_version_sha: this.config.janumiCodeVersionSha,
    });

    return result.rendered;
  }

  /**
   * Parse the LLM response into a structured result.
   */
  private parseResult(
    parsed: Record<string, unknown> | null,
    traceSelection: { selectedRecordIds: string[]; samplingApplied: boolean; strideN: number | null },
    subPhaseId: string,
  ): ReasoningReviewResult {
    if (!parsed) {
      return {
        overallPass: false,
        flaws: [{
          flawType: 'unsupported_assumption',
          severity: 'high',
          description: 'Reasoning Review failed to produce valid JSON output',
          evidence: 'LLM response was not parseable as JSON',
          recommendedAction: 'retry',
        }],
        traceSelectionRecordIds: traceSelection.selectedRecordIds,
        traceSamplingApplied: traceSelection.samplingApplied,
        traceStrideN: traceSelection.strideN,
        subPhaseId,
      };
    }

    const flaws: ReasoningFlaw[] = [];
    const rawFlaws = parsed.flaws as Record<string, unknown>[] | undefined;

    if (Array.isArray(rawFlaws)) {
      for (const f of rawFlaws) {
        flaws.push({
          flawType: (f.flaw_type as ReasoningFlawType) ?? 'unsupported_assumption',
          severity: (f.severity as 'high' | 'low') ?? 'high',
          description: (f.description as string) ?? '',
          evidence: (f.evidence as string) ?? '',
          governingAdrId: f.governing_adr_id as string | undefined,
          completionCriteriaId: f.completion_criteria_id as string | undefined,
          recommendedAction: (f.recommended_action as ReasoningFlawAction) ?? 'retry',
        });
      }
    }

    return {
      overallPass: (parsed.overall_pass as boolean) ?? flaws.length === 0,
      flaws,
      traceSelectionRecordIds: traceSelection.selectedRecordIds,
      traceSamplingApplied: traceSelection.samplingApplied,
      traceStrideN: traceSelection.strideN,
      subPhaseId,
    };
  }
}
