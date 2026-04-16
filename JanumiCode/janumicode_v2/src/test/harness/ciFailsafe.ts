/**
 * CI Failsafe - Guardrails for CI/CD pipeline runs.
 *
 * Provides:
 *   - Maximum cost limits
 *   - Maximum duration limits
 *   - Error rate thresholds
 *   - Phase timeout detection
 *   - Automatic abort/pause mechanisms
 */

import type { Database } from '../../lib/database/init';
import type { PhaseId } from '../../lib/types/records';

export interface FailsafeConfig {
  /** Maximum allowed AI spend in USD */
  maxCostUsd: number;
  /** Maximum workflow duration in milliseconds */
  maxDurationMs: number;
  /** Maximum error rate (0-1) */
  maxErrorRate: number;
  /** Maximum time a single phase can take */
  maxPhaseDurationMs: number;
  /** Maximum total tokens across all LLM calls */
  maxTotalTokens: number;
  /** Action to take when failsafe triggers */
  defaultAction: 'abort' | 'warn' | 'pause_for_human';
}

export const DEFAULT_FAILSAFE_CONFIG: FailsafeConfig = {
  maxCostUsd: 1,
  maxDurationMs: 300000, // 5 minutes
  maxErrorRate: 0.1, // 10%
  maxPhaseDurationMs: 60000, // 1 minute per phase
  maxTotalTokens: 1000000, // 1M tokens
  defaultAction: 'abort',
};

export interface FailsafeStatus {
  healthy: boolean;
  triggers: FailsafeTrigger[];
  currentSpendUsd: number;
  currentDurationMs: number;
  currentErrorRate: number;
  currentPhase: PhaseId | null;
  currentPhaseDurationMs: number;
}

export interface FailsafeTrigger {
  type: FailsafeType;
  threshold: number;
  actual: number;
  message: string;
  action: 'abort' | 'warn' | 'pause_for_human';
  timestamp: string;
}

export type FailsafeType =
  | 'max_cost_exceeded'
  | 'max_duration_exceeded'
  | 'error_rate_exceeded'
  | 'phase_timeout'
  | 'token_limit_exceeded'
  | 'phase_stuck';

/**
 * Failsafe monitor for CI pipelines.
 */
export class CIFailsafe {
  private readonly config: FailsafeConfig;
  private readonly triggers: FailsafeTrigger[] = [];
  private startTime: number = Date.now();
  private phaseStartTime: number = Date.now();
  private currentPhase: PhaseId | null = null;
  private aborted = false;

  constructor(config: Partial<FailsafeConfig> = {}) {
    this.config = { ...DEFAULT_FAILSAFE_CONFIG, ...config };
  }

  /**
   * Start monitoring a workflow run.
   */
  start(phase: PhaseId | null = null): void {
    this.startTime = Date.now();
    this.phaseStartTime = Date.now();
    this.currentPhase = phase;
    this.triggers.length = 0;
    this.aborted = false;
  }

  /**
   * Update the current phase.
   */
  setPhase(phase: PhaseId | null): void {
    this.phaseStartTime = Date.now();
    this.currentPhase = phase;
  }

  /**
   * Check all failsafe conditions.
   */
  check(db: Database, workflowRunId: string): FailsafeStatus {
    const currentDurationMs = Date.now() - this.startTime;
    const currentPhaseDurationMs = Date.now() - this.phaseStartTime;
    const { currentSpendUsd, currentErrorRate, totalTokens } = this.analyzeSpend(db, workflowRunId);

    // Check duration
    if (currentDurationMs > this.config.maxDurationMs) {
      this.addTrigger({
        type: 'max_duration_exceeded',
        threshold: this.config.maxDurationMs,
        actual: currentDurationMs,
        message: `Workflow duration ${currentDurationMs}ms exceeds limit ${this.config.maxDurationMs}ms`,
        action: this.config.defaultAction,
        timestamp: new Date().toISOString(),
      });
    }

    // Check phase duration
    if (currentPhaseDurationMs > this.config.maxPhaseDurationMs && this.currentPhase) {
      this.addTrigger({
        type: 'phase_timeout',
        threshold: this.config.maxPhaseDurationMs,
        actual: currentPhaseDurationMs,
        message: `Phase ${this.currentPhase} duration ${currentPhaseDurationMs}ms exceeds limit`,
        action: 'warn',
        timestamp: new Date().toISOString(),
      });
    }

    // Check cost
    if (currentSpendUsd > this.config.maxCostUsd) {
      this.addTrigger({
        type: 'max_cost_exceeded',
        threshold: this.config.maxCostUsd,
        actual: currentSpendUsd,
        message: `AI spend $${currentSpendUsd.toFixed(4)} exceeds limit $${this.config.maxCostUsd}`,
        action: 'abort',
        timestamp: new Date().toISOString(),
      });
    }

    // Check error rate
    if (currentErrorRate > this.config.maxErrorRate) {
      this.addTrigger({
        type: 'error_rate_exceeded',
        threshold: this.config.maxErrorRate,
        actual: currentErrorRate,
        message: `Error rate ${(currentErrorRate * 100).toFixed(1)}% exceeds limit ${(this.config.maxErrorRate * 100)}%`,
        action: 'pause_for_human',
        timestamp: new Date().toISOString(),
      });
    }

    // Check token limit
    if (totalTokens > this.config.maxTotalTokens) {
      this.addTrigger({
        type: 'token_limit_exceeded',
        threshold: this.config.maxTotalTokens,
        actual: totalTokens,
        message: `Total tokens ${totalTokens} exceeds limit ${this.config.maxTotalTokens}`,
        action: 'warn',
        timestamp: new Date().toISOString(),
      });
    }

    return {
      healthy: this.triggers.length === 0 && !this.aborted,
      triggers: [...this.triggers],
      currentSpendUsd,
      currentDurationMs,
      currentErrorRate,
      currentPhase: this.currentPhase,
      currentPhaseDurationMs,
    };
  }

  /**
   * Check if the workflow should be aborted.
   */
  shouldAbort(): boolean {
    return this.aborted || this.triggers.some(t => t.action === 'abort');
  }

  /**
   * Check if the workflow should pause for human.
   */
  shouldPauseForHuman(): boolean {
    return this.triggers.some(t => t.action === 'pause_for_human');
  }

  /**
   * Get all triggers.
   */
  getTriggers(): FailsafeTrigger[] {
    return [...this.triggers];
  }

  /**
   * Mark the workflow as aborted.
   */
  abort(): void {
    this.aborted = true;
  }

  private addTrigger(trigger: FailsafeTrigger): void {
    // Avoid duplicate triggers
    if (!this.triggers.some(t => t.type === trigger.type)) {
      this.triggers.push(trigger);
    }
  }

  private analyzeSpend(db: Database, workflowRunId: string): {
    currentSpendUsd: number;
    currentErrorRate: number;
    totalTokens: number;
  } {
    // Get LLM call records
    const llmCalls = db.prepare(`
      SELECT 
        content->>'$.provider' as provider,
        content->>'$.inputTokens' as input_tokens,
        content->>'$.outputTokens' as output_tokens
      FROM governed_stream
      WHERE workflow_run_id = ?
        AND record_type = 'agent_invocation'
    `).all(workflowRunId) as Array<{
      provider: string | null;
      input_tokens: string | null;
      output_tokens: string | null;
    }>;

    // Get error count
    const counts = db.prepare(`
      SELECT 
        SUM(CASE WHEN record_type = 'error' THEN 1 ELSE 0 END) as errors,
        COUNT(*) as total
      FROM governed_stream
      WHERE workflow_run_id = ?
    `).get(workflowRunId) as { errors: number; total: number };

    // Pricing per 1M tokens (approximate)
    const pricing: Record<string, { input: number; output: number }> = {
      anthropic: { input: 3.0, output: 15.0 },
      openai: { input: 2.5, output: 10.0 },
      google: { input: 1.25, output: 5.0 },
      ollama: { input: 0, output: 0 },
      mock: { input: 0, output: 0 },
    };

    let totalInput = 0;
    let totalOutput = 0;
    let totalCost = 0;

    for (const call of llmCalls) {
      const input = Number.parseInt(call.input_tokens ?? '0', 10) || 0;
      const output = Number.parseInt(call.output_tokens ?? '0', 10) || 0;
      const provider = call.provider ?? 'mock';

      totalInput += input;
      totalOutput += output;

      const rates = pricing[provider] ?? { input: 0, output: 0 };
      totalCost += (input * rates.input + output * rates.output) / 1_000_000;
    }

    const errorRate = counts.total > 0 ? counts.errors / counts.total : 0;

    return {
      currentSpendUsd: totalCost,
      currentErrorRate: errorRate,
      totalTokens: totalInput + totalOutput,
    };
  }
}

/**
 * Create a failsafe monitor from environment variables.
 */
export function createFailsafeFromEnv(): CIFailsafe {
  return new CIFailsafe({
    maxCostUsd: Number(process.env.JANUMICODE_MAX_COST_USD ?? 1),
    maxDurationMs: Number(process.env.JANUMICODE_MAX_DURATION_MS ?? 300000),
    maxErrorRate: Number(process.env.JANUMICODE_MAX_ERROR_RATE ?? 0.1),
    maxPhaseDurationMs: Number(process.env.JANUMICODE_MAX_PHASE_DURATION_MS ?? 60000),
    maxTotalTokens: Number(process.env.JANUMICODE_MAX_TOTAL_TOKENS ?? 1000000),
    defaultAction: (process.env.JANUMICODE_FAILSAFE_ACTION as FailsafeConfig['defaultAction']) ?? 'abort',
  });
}
