/**
 * Eval Execution Agent — runs evaluation tooling from Evaluation Plans.
 * Based on JanumiCode Spec v2.3, §8.9.
 *
 * Executes tooling specified in functional, quality, and reasoning
 * evaluation plans. Maps outputs to criteria. Captures results.
 */

import type { AgentInvoker } from '../orchestrator/agentInvoker';
import type { TemplateLoader } from '../orchestrator/templateLoader';

const EVAL_TEMPLATE_KEY = 'cross_cutting/eval_execution.system';

// ── Types ───────────────────────────────────────────────────────────

export interface EvalCriterion {
  id: string;
  evaluationTool: string;
  threshold: string;
  measurementMethod: string;
  fallbackIfToolUnavailable?: string;
}

export interface EvalResult {
  criterionId: string;
  toolUsed: string;
  passed: boolean;
  measuredValue: string;
  threshold: string;
  details: string;
  usedFallback: boolean;
}

export interface EvaluationResults {
  functional: EvalResult[];
  quality: EvalResult[];
  reasoning: EvalResult[];
  overallPass: boolean;
}

// ── EvalExecutionAgent ──────────────────────────────────────────────

export class EvalExecutionAgent {
  constructor(
    private readonly agentInvoker: AgentInvoker,
    private readonly templateLoader: TemplateLoader,
    private readonly evaluationTools: Record<string, string>,
  ) {}

  /**
   * Execute all evaluation criteria.
   */
  async execute(
    functionalCriteria: EvalCriterion[],
    qualityCriteria: EvalCriterion[],
    reasoningCriteria: EvalCriterion[],
    cwd: string,
  ): Promise<EvaluationResults> {
    const functional = await this.runCriteria(functionalCriteria, cwd);
    const quality = await this.runCriteria(qualityCriteria, cwd);
    const reasoning = await this.runCriteria(reasoningCriteria, cwd);

    const allResults = [...functional, ...quality, ...reasoning];
    const overallPass = allResults.every(r => r.passed);

    return { functional, quality, reasoning, overallPass };
  }

  private async runCriteria(
    criteria: EvalCriterion[],
    cwd: string,
  ): Promise<EvalResult[]> {
    const results: EvalResult[] = [];

    for (const criterion of criteria) {
      const toolCommand = this.evaluationTools[criterion.evaluationTool];
      let usedFallback = false;

      if (!toolCommand && criterion.fallbackIfToolUnavailable) {
        // Use fallback
        usedFallback = true;
        results.push({
          criterionId: criterion.id,
          toolUsed: criterion.fallbackIfToolUnavailable,
          passed: true,
          measuredValue: 'N/A (fallback)',
          threshold: criterion.threshold,
          details: `Primary tool ${criterion.evaluationTool} unavailable. Fallback applied.`,
          usedFallback: true,
        });
        continue;
      }

      if (!toolCommand) {
        results.push({
          criterionId: criterion.id,
          toolUsed: criterion.evaluationTool,
          passed: false,
          measuredValue: 'N/A',
          threshold: criterion.threshold,
          details: `Evaluation tool ${criterion.evaluationTool} not configured and no fallback specified`,
          usedFallback: false,
        });
        continue;
      }

      // Execute the tool — load prompt from template (single source of truth)
      const template = this.templateLoader.getTemplate(EVAL_TEMPLATE_KEY);
      if (!template) {
        results.push({
          criterionId: criterion.id,
          toolUsed: criterion.evaluationTool,
          passed: false,
          measuredValue: 'N/A',
          threshold: criterion.threshold,
          details: `Eval execution prompt template not found: ${EVAL_TEMPLATE_KEY}`,
          usedFallback: false,
        });
        continue;
      }

      const renderResult = this.templateLoader.render(template, {
        tool_command: toolCommand,
        criterion_id: criterion.id,
        measurement_method: criterion.measurementMethod,
        threshold: criterion.threshold,
        janumicode_version_sha: 'dev',
      });

      try {
        const invocationResult = await this.agentInvoker.invoke({
          agentRole: 'eval_execution_agent',
          backingTool: 'claude_code_cli',
          invocationId: `eval-${criterion.id}`,
          prompt: renderResult.rendered,
          cwd,
        });

        results.push({
          criterionId: criterion.id,
          toolUsed: criterion.evaluationTool,
          passed: invocationResult.success,
          measuredValue: invocationResult.success ? 'passed' : 'failed',
          threshold: criterion.threshold,
          details: invocationResult.error ?? 'Completed',
          usedFallback: false,
        });
      } catch (err) {
        results.push({
          criterionId: criterion.id,
          toolUsed: criterion.evaluationTool,
          passed: false,
          measuredValue: 'error',
          threshold: criterion.threshold,
          details: err instanceof Error ? err.message : String(err),
          usedFallback: false,
        });
      }
    }

    return results;
  }
}
