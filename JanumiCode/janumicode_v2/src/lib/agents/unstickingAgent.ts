/**
 * Unsticking Agent — investigates and resolves stuck agent situations.
 * Based on JanumiCode Spec v2.3, §8.6.
 *
 * Two simultaneous investigation modes:
 *   Mode 1 — Socratic Elicitation: ask the stuck agent what would help
 *   Mode 2 — Environmental Detective: independent reasoning from workspace context
 *
 * Has access to full Governed Stream including tool results — primary
 * diagnostic resource for Tool Result Misinterpretation.
 */

import { LLMCaller } from '../llm/llmCaller';
import { TemplateLoader } from '../orchestrator/templateLoader';
import type { Database } from '../database/init';
import type { LoopStatus } from '../types/records';

const TOOL_REVIEW_TEMPLATE_KEY = 'cross_cutting/unsticking_tool_result_review.system';
const SOCRATIC_TEMPLATE_KEY = 'cross_cutting/unsticking_socratic_turn.system';

// ── Types ───────────────────────────────────────────────────────────

export interface UnstickingInput {
  /** The stuck agent's execution trace summary */
  stuckAgentTrace: string;
  /** Loop status classification */
  loopStatus: LoopStatus;
  /** Reasoning Review findings that triggered unsticking */
  reasoningReviewFindings: string;
  /** Tool results from the Governed Stream (unique to Unsticking Agent) */
  toolResults?: string;
  /** Whether Tool Result Misinterpretation is suspected */
  toolResultMisinterpretationSuspected: boolean;
  /** Workflow Run ID */
  workflowRunId: string;
  /** Sub-Phase ID of the stuck agent */
  subPhaseId: string;
}

export interface UnstickingResult {
  resolved: boolean;
  /** The resolution (if found) */
  resolution?: string;
  /** Socratic turns taken */
  socraticTurns: number;
  /** Whether Tool Result Misinterpretation was confirmed */
  toolResultMisinterpretationConfirmed: boolean;
  /** Correction to inject into the stuck agent's next context */
  correctionToInject?: string;
  /** Whether escalation to human is needed */
  escalateToHuman: boolean;
  /** Escalation reason */
  escalationReason?: string;
}

export interface UnstickingConfig {
  provider: string;
  model: string;
  maxSocraticTurns: number;
}

// ── UnstickingAgent ─────────────────────────────────────────────────

export class UnstickingAgent {
  constructor(
    private readonly db: Database,
    private readonly llmCaller: LLMCaller,
    private readonly templateLoader: TemplateLoader,
    private readonly config: UnstickingConfig,
  ) {}

  /**
   * Investigate and attempt to resolve a stuck situation.
   */
  async investigate(input: UnstickingInput): Promise<UnstickingResult> {
    let socraticTurns = 0;
    let toolResultMisinterpretationConfirmed = false;

    // Mode 2: Environmental Detective — check tool results if suspected
    if (input.toolResultMisinterpretationSuspected && input.toolResults) {
      const toolReview = await this.reviewToolResults(input);
      if (toolReview.misinterpretationConfirmed) {
        toolResultMisinterpretationConfirmed = true;
        return {
          resolved: true,
          resolution: toolReview.correction,
          socraticTurns: 0,
          toolResultMisinterpretationConfirmed: true,
          correctionToInject: toolReview.correction,
          escalateToHuman: false,
        };
      }
    }

    // Mode 1: Socratic Elicitation
    for (let turn = 0; turn < this.config.maxSocraticTurns; turn++) {
      socraticTurns++;

      const question = await this.generateSocraticQuestion(input, turn);
      if (!question) break;

      // In production, the question would be sent to the stuck agent
      // and its response analyzed. For now, we simulate the investigation.
      const response = await this.analyzeSocraticResponse(input, question);

      if (response.resolutionFound) {
        return {
          resolved: true,
          resolution: response.resolution,
          socraticTurns,
          toolResultMisinterpretationConfirmed,
          correctionToInject: response.resolution,
          escalateToHuman: false,
        };
      }
    }

    // Dialogue loop detection: 3 turns without progress → escalate
    return {
      resolved: false,
      socraticTurns,
      toolResultMisinterpretationConfirmed,
      escalateToHuman: true,
      escalationReason: `Unsticking Agent exhausted ${socraticTurns} Socratic turns without resolution for ${input.loopStatus} loop in ${input.subPhaseId}`,
    };
  }

  /**
   * Review tool results for Tool Result Misinterpretation.
   * Only the Unsticking Agent has access to tool results in the Governed Stream.
   * Prompt is loaded from cross_cutting/unsticking_tool_result_review.system.md
   */
  private async reviewToolResults(input: UnstickingInput): Promise<{
    misinterpretationConfirmed: boolean;
    correction?: string;
  }> {
    const template = this.templateLoader.getTemplate(TOOL_REVIEW_TEMPLATE_KEY);
    if (!template) return { misinterpretationConfirmed: false };

    // LLM throws propagate — a failed unsticking call is unrecoverable
    // because the pipeline can't decide whether the stuck agent
    // misinterpreted its tool result without this review. Better to
    // halt than to silently return "no misinterpretation confirmed".
    const renderResult = this.templateLoader.render(template, {
      stuck_agent_trace: input.stuckAgentTrace,
      tool_results: input.toolResults ?? '',
      reasoning_review_findings: input.reasoningReviewFindings,
      janumicode_version_sha: 'dev',
    });

    const result = await this.llmCaller.call({
      provider: this.config.provider,
      model: this.config.model,
      prompt: renderResult.rendered,
      responseFormat: 'json',
      temperature: 0.2,
    });

    if (result.parsed) {
      return {
        misinterpretationConfirmed: (result.parsed.misinterpretation_confirmed as boolean) ?? false,
        correction: result.parsed.correction as string | undefined,
      };
    }

    return { misinterpretationConfirmed: false };
  }

  private async generateSocraticQuestion(
    input: UnstickingInput,
    turnNumber: number,
  ): Promise<string | null> {
    const template = this.templateLoader.getTemplate(SOCRATIC_TEMPLATE_KEY);
    if (!template) return null;

    // LLM throws propagate — a failed Socratic-question generation
    // means we can't ask the human the right question, which is the
    // whole point of this path. Halting is better than asking a
    // fallback question.
    const renderResult = this.templateLoader.render(template, {
      loop_status: input.loopStatus,
      sub_phase_id: input.subPhaseId,
      reasoning_review_findings: input.reasoningReviewFindings,
      stuck_agent_trace_summary: input.stuckAgentTrace,
      turn_number: String(turnNumber + 1),
      janumicode_version_sha: 'dev',
    });

    const result = await this.llmCaller.call({
      provider: this.config.provider,
      model: this.config.model,
      prompt: renderResult.rendered,
      temperature: 0.5,
    });

    return result.text || null;
  }

  private async analyzeSocraticResponse(
    _input: UnstickingInput,
    _question: string,
  ): Promise<{ resolutionFound: boolean; resolution?: string }> {
    // In production, this would analyze the stuck agent's actual response
    // For now, return no resolution found (triggers escalation)
    return { resolutionFound: false };
  }
}
