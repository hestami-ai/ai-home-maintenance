/**
 * EvalRunner - executes evaluations for Phase 9.3.
 * Based on JanumiCode Spec v2.3, §4 Phase 9.3.
 *
 * Runs functional, quality, and reasoning evaluations based on
 * the evaluation plan from Phase 8, and records results.
 */

import type { Database } from '../database/init';
import { GovernedStreamWriter } from './governedStreamWriter';
import { EventBus } from '../events/eventBus';
import { getLogger } from '../logging';
import { LLMCaller, type LLMCallResult } from '../llm/llmCaller';

// Types

export interface EvaluationCriterion {
  id: string;
  name: string;
  type: 'functional' | 'quality' | 'reasoning';
  description: string;
  evaluationTool: string;
  passingThreshold?: number;
  acceptanceCriterionId?: string;
}

export interface FunctionalEvalResult {
  criterionId: string;
  criterionName: string;
  passed: boolean;
  actualValue: string | number | boolean;
  expectedValue: string | number | boolean;
  notes?: string;
}

export interface QualityEvalResult {
  criterionId: string;
  criterionName: string;
  metric: string;
  actualValue: number;
  threshold: number;
  passed: boolean;
  details?: string;
}

export interface ReasoningEvalResult {
  criterionId: string;
  criterionName: string;
  passed: boolean;
  flawTypes: string[];
  severity: 'none' | 'low' | 'medium' | 'high';
  details?: string;
}

export interface EvalRunResult {
  functional: FunctionalEvalResult[];
  quality: QualityEvalResult[];
  reasoning: ReasoningEvalResult[];
  overallPass: boolean;
  durationMs: number;
  error?: string;
}

export interface EvalRunnerConfig {
  llmProvider: string;
  llmModel: string;
  timeoutSeconds: number;
}

const DEFAULT_CONFIG: EvalRunnerConfig = {
  llmProvider: 'gemini',
  llmModel: 'gemini-2.0-flash',
  timeoutSeconds: 120,
};

// EvalRunner class

export class EvalRunner {
  constructor(
    private readonly db: Database,
    private readonly writer: GovernedStreamWriter,
    private readonly eventBus: EventBus,
    private readonly llmCaller: LLMCaller,
    private readonly generateId: () => string,
    private readonly config: EvalRunnerConfig = DEFAULT_CONFIG,
  ) {}

  /**
   * Run all evaluations from the evaluation plan.
   */
  async runEvaluations(
    criteria: EvaluationCriterion[],
    implementationContext: {
      workflowRunId: string;
      workspacePath: string;
      executionSummary: Record<string, unknown>;
      testResults: Record<string, unknown>;
    },
    janumiCodeVersionSha: string,
  ): Promise<EvalRunResult> {
    const startTime = Date.now();
    const functional: FunctionalEvalResult[] = [];
    const quality: QualityEvalResult[] = [];
    const reasoning: ReasoningEvalResult[] = [];

    this.eventBus.emit('eval:started', {
      workflowRunId: implementationContext.workflowRunId,
      evalType: 'all',
    });

    // Group criteria by type
    const functionalCriteria = criteria.filter(c => c.type === 'functional');
    const qualityCriteria = criteria.filter(c => c.type === 'quality');
    const reasoningCriteria = criteria.filter(c => c.type === 'reasoning');

    // Run functional evaluations
    for (const criterion of functionalCriteria) {
      getLogger().info('workflow', 'Running functional evaluation', {
        criterionId: criterion.id,
        criterionName: criterion.name,
      });

      const result = await this.runFunctionalEval(criterion, implementationContext);
      functional.push(result);

      this.recordEvalResult(result, 'functional', implementationContext.workflowRunId, janumiCodeVersionSha);
    }

    // Run quality evaluations
    for (const criterion of qualityCriteria) {
      getLogger().info('workflow', 'Running quality evaluation', {
        criterionId: criterion.id,
        criterionName: criterion.name,
      });

      const result = await this.runQualityEval(criterion, implementationContext);
      quality.push(result);

      this.recordEvalResult(result, 'quality', implementationContext.workflowRunId, janumiCodeVersionSha);
    }

    // Run reasoning evaluations
    for (const criterion of reasoningCriteria) {
      getLogger().info('workflow', 'Running reasoning evaluation', {
        criterionId: criterion.id,
        criterionName: criterion.name,
      });

      const result = await this.runReasoningEval(criterion, implementationContext);
      reasoning.push(result);

      this.recordEvalResult(result, 'reasoning', implementationContext.workflowRunId, janumiCodeVersionSha);
    }

    const durationMs = Date.now() - startTime;
    const overallPass = functional.every(r => r.passed) &&
                        quality.every(r => r.passed) &&
                        reasoning.every(r => r.passed);

    this.eventBus.emit('eval:completed', {
      workflowRunId: implementationContext.workflowRunId,
      evalType: 'all',
      passed: overallPass,
    });

    return {
      functional,
      quality,
      reasoning,
      overallPass,
      durationMs,
    };
  }

  /**
   * Run a functional evaluation criterion.
   */
  private async runFunctionalEval(
    criterion: EvaluationCriterion,
    context: { workflowRunId: string; workspacePath: string; executionSummary: Record<string, unknown>; testResults: Record<string, unknown> },
  ): Promise<FunctionalEvalResult> {
    // For automated functional checks, use the evaluation tool
    switch (criterion.evaluationTool) {
      case 'test_suite_pass_rate':
        return this.evalTestSuitePassRate(criterion, context);
      case 'acceptance_criterion_met':
        return this.evalAcceptanceCriterion(criterion, context);
      case 'llm_judge':
        return this.evalLLMJudge(criterion, context);
      default:
        // Default to LLM-based evaluation
        return this.evalLLMJudge(criterion, context);
    }
  }

  /**
   * Evaluate test suite pass rate.
   */
  private evalTestSuitePassRate(
    criterion: EvaluationCriterion,
    context: { testResults: Record<string, unknown> },
  ): FunctionalEvalResult {
    const testResults = context.testResults;
    const totalPassed = typeof testResults.total_passed === 'number' ? testResults.total_passed : 0;
    const totalFailed = typeof testResults.total_failed === 'number' ? testResults.total_failed : 0;
    const totalSkipped = typeof testResults.total_skipped === 'number' ? testResults.total_skipped : 0;
    const totalTests = totalPassed + totalFailed + totalSkipped;
    const passRate = totalTests > 0 ? totalPassed / totalTests : 0;
    const threshold = criterion.passingThreshold ?? 1;

    return {
      criterionId: criterion.id,
      criterionName: criterion.name,
      passed: passRate >= threshold,
      actualValue: passRate,
      expectedValue: threshold,
      notes: `${totalPassed}/${totalTests} tests passed (${(passRate * 100).toFixed(1)}%)`,
    };
  }

  /**
   * Evaluate acceptance criterion via LLM judge.
   */
  private async evalAcceptanceCriterion(
    criterion: EvaluationCriterion,
    context: { executionSummary: Record<string, unknown>; workspacePath: string },
  ): Promise<FunctionalEvalResult> {
    const prompt = `Evaluate whether the following acceptance criterion is met:

Criterion: ${criterion.description}

Implementation Summary:
${JSON.stringify(context.executionSummary, null, 2)}

Respond with JSON: { "passed": boolean, "evidence": string, "confidence": number }`;

    try {
      const result = await this.llmCaller.call({
        provider: this.config.llmProvider,
        model: this.config.llmModel,
        prompt,
        responseFormat: 'json',
        temperature: 0,
      });

      const parsed = this.parseJsonResponse(result);
      const passed = typeof parsed?.passed === 'boolean' ? parsed.passed : false;
      const evidence = typeof parsed?.evidence === 'string' ? parsed.evidence : 'LLM evaluation';
      const confidence = parsed?.confidence ?? 'unknown';
      return {
        criterionId: criterion.id,
        criterionName: criterion.name,
        passed,
        actualValue: evidence,
        expectedValue: criterion.description,
        notes: `Confidence: ${confidence}`,
      };
    } catch (err) {
      return {
        criterionId: criterion.id,
        criterionName: criterion.name,
        passed: false,
        actualValue: 'Evaluation failed',
        expectedValue: criterion.description,
        notes: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Evaluate via LLM judge.
   */
  private async evalLLMJudge(
    criterion: EvaluationCriterion,
    context: { executionSummary: Record<string, unknown>; testResults: Record<string, unknown> },
  ): Promise<FunctionalEvalResult> {
    const prompt = `Evaluate the following criterion:

Criterion: ${criterion.name}
Description: ${criterion.description}

Implementation Context:
${JSON.stringify({ executionSummary: context.executionSummary, testResults: context.testResults }, null, 2)}

Respond with JSON: { "passed": boolean, "actual_value": string, "evidence": string }`;

    try {
      const result = await this.llmCaller.call({
        provider: this.config.llmProvider,
        model: this.config.llmModel,
        prompt,
        responseFormat: 'json',
        temperature: 0,
      });

      const parsed = this.parseJsonResponse(result);
      const passed = typeof parsed?.passed === 'boolean' ? parsed.passed : false;
      const actualValue = typeof parsed?.actual_value === 'string' ? parsed.actual_value : 'Unknown';
      const evidence = typeof parsed?.evidence === 'string' ? parsed.evidence : undefined;
      return {
        criterionId: criterion.id,
        criterionName: criterion.name,
        passed,
        actualValue,
        expectedValue: criterion.description,
        notes: evidence,
      };
    } catch (err) {
      return {
        criterionId: criterion.id,
        criterionName: criterion.name,
        passed: false,
        actualValue: 'Evaluation failed',
        expectedValue: criterion.description,
        notes: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Run a quality evaluation criterion.
   */
  private async runQualityEval(
    criterion: EvaluationCriterion,
    context: { executionSummary: Record<string, unknown>; workspacePath: string },
  ): Promise<QualityEvalResult> {
    // Quality metrics often use static analysis tools
    switch (criterion.evaluationTool) {
      case 'code_coverage':
        return this.evalCodeCoverage(criterion, context);
      case 'lint_pass_rate':
        return this.evalLintPassRate(criterion, context);
      case 'performance_benchmark':
        return this.evalPerformanceBenchmark(criterion, context);
      default:
        return this.evalQualityLLM(criterion, context);
    }
  }

  /**
   * Evaluate code coverage (placeholder).
   */
  private evalCodeCoverage(
    criterion: EvaluationCriterion,
    _context: { workspacePath: string },
  ): QualityEvalResult {
    // In production, would run coverage tool and parse results
    const threshold = criterion.passingThreshold ?? 80;
    return {
      criterionId: criterion.id,
      criterionName: criterion.name,
      metric: 'coverage_percentage',
      actualValue: 0, // Placeholder - would be actual coverage
      threshold,
      passed: false, // Placeholder
      details: 'Coverage analysis not yet implemented',
    };
  }

  /**
   * Evaluate lint pass rate (placeholder).
   */
  private evalLintPassRate(
    criterion: EvaluationCriterion,
    _context: { workspacePath: string },
  ): QualityEvalResult {
    const threshold = criterion.passingThreshold ?? 100;
    return {
      criterionId: criterion.id,
      criterionName: criterion.name,
      metric: 'lint_pass_rate',
      actualValue: 0, // Placeholder
      threshold,
      passed: false,
      details: 'Lint analysis not yet implemented',
    };
  }

  /**
   * Evaluate performance benchmark (placeholder).
   */
  private evalPerformanceBenchmark(
    criterion: EvaluationCriterion,
    _context: { workspacePath: string },
  ): QualityEvalResult {
    const threshold = criterion.passingThreshold ?? 1000; // ms
    return {
      criterionId: criterion.id,
      criterionName: criterion.name,
      metric: 'response_time_ms',
      actualValue: 0, // Placeholder
      threshold,
      passed: false,
      details: 'Performance benchmarking not yet implemented',
    };
  }

  /**
   * Evaluate quality via LLM.
   */
  private async evalQualityLLM(
    criterion: EvaluationCriterion,
    context: { executionSummary: Record<string, unknown> },
  ): Promise<QualityEvalResult> {
    const prompt = `Evaluate the following quality criterion:

Criterion: ${criterion.name}
Description: ${criterion.description}

Implementation Context:
${JSON.stringify(context.executionSummary, null, 2)}

Respond with JSON: { "score": number (0-100), "passed": boolean, "details": string }`;

    try {
      const result = await this.llmCaller.call({
        provider: this.config.llmProvider,
        model: this.config.llmModel,
        prompt,
        responseFormat: 'json',
        temperature: 0,
      });

      const parsed = this.parseJsonResponse(result);
      const threshold = criterion.passingThreshold ?? 70;
      const score = typeof parsed?.score === 'number' ? parsed.score : 0;
      const passed = typeof parsed?.passed === 'boolean' ? parsed.passed : false;
      const details = typeof parsed?.details === 'string' ? parsed.details : undefined;
      return {
        criterionId: criterion.id,
        criterionName: criterion.name,
        metric: 'llm_quality_score',
        actualValue: score,
        threshold,
        passed,
        details,
      };
    } catch (err) {
      return {
        criterionId: criterion.id,
        criterionName: criterion.name,
        metric: 'llm_quality_score',
        actualValue: 0,
        threshold: criterion.passingThreshold ?? 70,
        passed: false,
        details: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Run a reasoning evaluation criterion.
   */
  private async runReasoningEval(
    criterion: EvaluationCriterion,
    context: { executionSummary: Record<string, unknown>; workflowRunId: string },
  ): Promise<ReasoningEvalResult> {
    // Load execution traces for reasoning review
    const traces = this.loadExecutionTraces(context.workflowRunId);

    const prompt = `Review the following execution traces for reasoning flaws:

Criterion: ${criterion.name}
Description: ${criterion.description}

Execution Traces Summary:
${JSON.stringify(traces.slice(0, 10), null, 2)}

Identify any of the following flaw types:
- circular_reasoning
- false_dichotomy
- unsupported_assertion
- logical_inconsistency
- missing_evidence

Respond with JSON: {
  "passed": boolean,
  "flaw_types": string[],
  "severity": "none" | "low" | "medium" | "high",
  "details": string
}`;

    try {
      const result = await this.llmCaller.call({
        provider: this.config.llmProvider,
        model: this.config.llmModel,
        prompt,
        responseFormat: 'json',
        temperature: 0,
      });

      const parsed = this.parseJsonResponse(result);
      const passed = typeof parsed?.passed === 'boolean' ? parsed.passed : false;
      const flawTypes = Array.isArray(parsed?.flaw_types) ? parsed.flaw_types as string[] : [];
      const severity = (parsed?.severity as 'none' | 'low' | 'medium' | 'high') ?? 'none';
      const details = typeof parsed?.details === 'string' ? parsed.details : undefined;
      return {
        criterionId: criterion.id,
        criterionName: criterion.name,
        passed,
        flawTypes,
        severity,
        details,
      };
    } catch (err) {
      return {
        criterionId: criterion.id,
        criterionName: criterion.name,
        passed: false,
        flawTypes: ['evaluation_error'],
        severity: 'high',
        details: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Load execution traces from the database.
   */
  private loadExecutionTraces(workflowRunId: string): Array<Record<string, unknown>> {
    const records = this.db.prepare(`
      SELECT content FROM governed_stream
      WHERE workflow_run_id = ?
      AND record_type IN ('agent_reasoning_step', 'agent_self_correction', 'tool_call')
      ORDER BY produced_at ASC
      LIMIT 50
    `).all(workflowRunId) as Array<{ content: string }>;

    return records.map(r => {
      try {
        return JSON.parse(r.content) as Record<string, unknown>;
      } catch {
        return { raw: r.content };
      }
    });
  }

  /**
   * Parse JSON from LLM response.
   */
  private parseJsonResponse(result: LLMCallResult): Record<string, unknown> | null {
    const text = result.text ?? '';
    // Strip code fences if present
    const codeFenceMatch = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
    const braceMatch = /\{[\s\S]*\}/.exec(text);
    const jsonStr = codeFenceMatch?.[1] ?? braceMatch?.[0] ?? text;

    try {
      return JSON.parse(jsonStr.trim());
    } catch {
      return null;
    }
  }

  /**
   * Record evaluation result in the Governed Stream.
   */
  private recordEvalResult(
    result: FunctionalEvalResult | QualityEvalResult | ReasoningEvalResult,
    type: 'functional' | 'quality' | 'reasoning',
    workflowRunId: string,
    janumiCodeVersionSha: string,
  ): void {
    this.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRunId,
      phase_id: '9',
      sub_phase_id: '9.3',
      produced_by_agent_role: 'eval_execution_agent',
      janumicode_version_sha: janumiCodeVersionSha,
      content: {
        kind: 'evaluation_result',
        type,
        criterion_id: result.criterionId,
        criterion_name: result.criterionName,
        passed: result.passed,
        details: 'details' in result ? result.details : undefined,
      },
    });
  }
}
