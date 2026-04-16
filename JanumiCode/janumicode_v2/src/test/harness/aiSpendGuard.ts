/**
 * AI Spend Guard - Track and limit AI API costs.
 *
 * Provides:
 *   - Real-time cost tracking
 *   - Provider-specific pricing
 *   - Budget alerts
 *   - Cost breakdown by phase/role
 */

import type { Database } from '../../lib/database/init';

export interface PricingTier {
  provider: string;
  model: string;
  inputCostPer1k: number;
  outputCostPer1k: number;
}

// Approximate pricing as of 2024 (USD per 1K tokens)
export const DEFAULT_PRICING: PricingTier[] = [
  // Anthropic
  { provider: 'anthropic', model: 'claude-3-opus', inputCostPer1k: 0.015, outputCostPer1k: 0.075 },
  { provider: 'anthropic', model: 'claude-3-sonnet', inputCostPer1k: 0.003, outputCostPer1k: 0.015 },
  { provider: 'anthropic', model: 'claude-3-haiku', inputCostPer1k: 0.00025, outputCostPer1k: 0.00125 },
  { provider: 'anthropic', model: 'claude-3.5-sonnet', inputCostPer1k: 0.003, outputCostPer1k: 0.015 },
  { provider: 'anthropic', model: 'claude-3.5-haiku', inputCostPer1k: 0.0008, outputCostPer1k: 0.004 },

  // OpenAI
  { provider: 'openai', model: 'gpt-4-turbo', inputCostPer1k: 0.01, outputCostPer1k: 0.03 },
  { provider: 'openai', model: 'gpt-4', inputCostPer1k: 0.03, outputCostPer1k: 0.06 },
  { provider: 'openai', model: 'gpt-4o', inputCostPer1k: 0.005, outputCostPer1k: 0.015 },
  { provider: 'openai', model: 'gpt-4o-mini', inputCostPer1k: 0.00015, outputCostPer1k: 0.0006 },
  { provider: 'openai', model: 'gpt-3.5-turbo', inputCostPer1k: 0.0005, outputCostPer1k: 0.0015 },

  // Google
  { provider: 'google', model: 'gemini-1.5-pro', inputCostPer1k: 0.00125, outputCostPer1k: 0.005 },
  { provider: 'google', model: 'gemini-1.5-flash', inputCostPer1k: 0.000075, outputCostPer1k: 0.0003 },
  { provider: 'google', model: 'gemini-2.0-flash', inputCostPer1k: 0.0001, outputCostPer1k: 0.0004 },
  { provider: 'google', model: 'gemini-2.5-flash', inputCostPer1k: 0.000075, outputCostPer1k: 0.0003 },

  // Ollama (local, free)
  { provider: 'ollama', model: '*', inputCostPer1k: 0, outputCostPer1k: 0 },

  // Mock (testing, free)
  { provider: 'mock', model: '*', inputCostPer1k: 0, outputCostPer1k: 0 },
];

export interface SpendRecord {
  provider: string;
  model: string;
  phaseId: string | null;
  subPhaseId: string | null;
  agentRole: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  timestamp: string;
}

export interface SpendSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  byProvider: Record<string, { input: number; output: number; cost: number }>;
  byPhase: Record<string, { input: number; output: number; cost: number }>;
  byRole: Record<string, { input: number; output: number; cost: number }>;
  records: SpendRecord[];
}

export interface BudgetAlert {
  type: 'warning' | 'limit' | 'critical';
  threshold: number;
  actual: number;
  message: string;
}

/**
 * AI Spend Guard for tracking and limiting costs.
 */
export class AISpendGuard {
  private readonly pricing: Map<string, PricingTier> = new Map();
  private readonly records: SpendRecord[] = [];
  private readonly budgetUsd: number;
  private readonly warningThreshold: number;
  private readonly alerts: BudgetAlert[] = [];

  constructor(
    pricing: PricingTier[] = DEFAULT_PRICING,
    budgetUsd = 1.0,
    warningThreshold = 0.5,
  ) {
    this.budgetUsd = budgetUsd;
    this.warningThreshold = warningThreshold;

    for (const tier of pricing) {
      const key = `${tier.provider}:${tier.model}`;
      this.pricing.set(key, tier);
      // Also add provider-level default
      if (!this.pricing.has(`${tier.provider}:*`)) {
        this.pricing.set(`${tier.provider}:*`, tier);
      }
    }
  }

  /**
   * Record an LLM call.
   */
  recordCall(options: {
    provider: string;
    model: string;
    phaseId?: string | null;
    subPhaseId?: string | null;
    agentRole?: string | null;
    inputTokens: number;
    outputTokens: number;
  }): SpendRecord {
    const cost = this.calculateCost(options.provider, options.model, options.inputTokens, options.outputTokens);

    const record: SpendRecord = {
      provider: options.provider,
      model: options.model,
      phaseId: options.phaseId ?? null,
      subPhaseId: options.subPhaseId ?? null,
      agentRole: options.agentRole ?? null,
      inputTokens: options.inputTokens,
      outputTokens: options.outputTokens,
      costUsd: cost,
      timestamp: new Date().toISOString(),
    };

    this.records.push(record);
    this.checkBudget();

    return record;
  }

  /**
   * Get current spend summary.
   */
  getSummary(): SpendSummary {
    const summary: SpendSummary = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUsd: 0,
      byProvider: {},
      byPhase: {},
      byRole: {},
      records: [...this.records],
    };

    for (const record of this.records) {
      summary.totalInputTokens += record.inputTokens;
      summary.totalOutputTokens += record.outputTokens;
      summary.totalCostUsd += record.costUsd;

      // By provider
      if (!summary.byProvider[record.provider]) {
        summary.byProvider[record.provider] = { input: 0, output: 0, cost: 0 };
      }
      summary.byProvider[record.provider].input += record.inputTokens;
      summary.byProvider[record.provider].output += record.outputTokens;
      summary.byProvider[record.provider].cost += record.costUsd;

      // By phase
      const phase = record.phaseId ?? 'unknown';
      if (!summary.byPhase[phase]) {
        summary.byPhase[phase] = { input: 0, output: 0, cost: 0 };
      }
      summary.byPhase[phase].input += record.inputTokens;
      summary.byPhase[phase].output += record.outputTokens;
      summary.byPhase[phase].cost += record.costUsd;

      // By role
      const role = record.agentRole ?? 'unknown';
      if (!summary.byRole[role]) {
        summary.byRole[role] = { input: 0, output: 0, cost: 0 };
      }
      summary.byRole[role].input += record.inputTokens;
      summary.byRole[role].output += record.outputTokens;
      summary.byRole[role].cost += record.costUsd;
    }

    return summary;
  }

  /**
   * Get budget alerts.
   */
  getAlerts(): BudgetAlert[] {
    return [...this.alerts];
  }

  /**
   * Check if budget is exceeded.
   */
  isOverBudget(): boolean {
    const summary = this.getSummary();
    return summary.totalCostUsd > this.budgetUsd;
  }

  /**
   * Check if budget is at warning level.
   */
  isAtWarningLevel(): boolean {
    const summary = this.getSummary();
    return summary.totalCostUsd >= this.budgetUsd * this.warningThreshold;
  }

  /**
   * Reset the guard for a new run.
   */
  reset(): void {
    this.records.length = 0;
    this.alerts.length = 0;
  }

  /**
   * Load spend records from database.
   */
  loadFromDatabase(db: Database, workflowRunId: string): void {
    const llmCalls = db.prepare(`
      SELECT 
        phase_id,
        sub_phase_id,
        content->>'$.provider' as provider,
        content->>'$.model' as model,
        content->>'$.agentRole' as agent_role,
        content->>'$.inputTokens' as input_tokens,
        content->>'$.outputTokens' as output_tokens,
        produced_at
      FROM governed_stream
      WHERE workflow_run_id = ?
        AND record_type = 'agent_invocation'
    `).all(workflowRunId) as Array<{
      phase_id: string | null;
      sub_phase_id: string | null;
      provider: string | null;
      model: string | null;
      agent_role: string | null;
      input_tokens: string | null;
      output_tokens: string | null;
      produced_at: string;
    }>;

    for (const call of llmCalls) {
      const input = Number.parseInt(call.input_tokens ?? '0', 10) || 0;
      const output = Number.parseInt(call.output_tokens ?? '0', 10) || 0;

      this.records.push({
        provider: call.provider ?? 'unknown',
        model: call.model ?? 'unknown',
        phaseId: call.phase_id,
        subPhaseId: call.sub_phase_id,
        agentRole: call.agent_role,
        inputTokens: input,
        outputTokens: output,
        costUsd: this.calculateCost(call.provider ?? 'unknown', call.model ?? 'unknown', input, output),
        timestamp: call.produced_at,
      });
    }

    this.checkBudget();
  }

  private calculateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
    // Try exact match first
    const exactKey = `${provider}:${model}`;
    let tier = this.pricing.get(exactKey);

    // Fall back to provider default
    if (!tier) {
      tier = this.pricing.get(`${provider}:*`);
    }

    if (!tier) {
      // Unknown provider - assume free
      return 0;
    }

    const inputCost = (inputTokens / 1000) * tier.inputCostPer1k;
    const outputCost = (outputTokens / 1000) * tier.outputCostPer1k;

    return inputCost + outputCost;
  }

  private checkBudget(): void {
    const summary = this.getSummary();
    const cost = summary.totalCostUsd;

    // Check critical (100%)
    if (cost >= this.budgetUsd) {
      this.addAlert({
        type: 'critical',
        threshold: this.budgetUsd,
        actual: cost,
        message: `Budget exceeded: $${cost.toFixed(4)} of $${this.budgetUsd} budget`,
      });
    }
    // Check warning (50% by default)
    else if (cost >= this.budgetUsd * this.warningThreshold) {
      this.addAlert({
        type: 'warning',
        threshold: this.budgetUsd * this.warningThreshold,
        actual: cost,
        message: `Budget warning: $${cost.toFixed(4)} of $${this.budgetUsd} budget (${Math.round(this.warningThreshold * 100)}%)`,
      });
    }
  }

  private addAlert(alert: BudgetAlert): void {
    // Avoid duplicate alerts of the same type
    if (!this.alerts.some(a => a.type === alert.type)) {
      this.alerts.push(alert);
    }
  }
}

/**
 * Create a spend guard from environment variables.
 */
export function createSpendGuardFromEnv(): AISpendGuard {
  const budgetUsd = Number(process.env.JANUMICODE_BUDGET_USD ?? 1);
  const warningThreshold = Number(process.env.JANUMICODE_BUDGET_WARNING ?? 0.5);
  return new AISpendGuard(DEFAULT_PRICING, budgetUsd, warningThreshold);
}
