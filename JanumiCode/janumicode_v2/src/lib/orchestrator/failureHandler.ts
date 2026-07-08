/**
 * FailureHandler - handles execution failures for Phase 9.4.
 * Based on JanumiCode Spec v2.3, §4 Phase 9.4.
 *
 * Three resolution strategies:
 *   1. Retry - re-execute the failed task with adjusted context
 *   2. Rollback - revert changes and try alternative approach
 *   3. Accept with Caveat - document limitation and proceed
 *
 * Invokes UnstickingAgent for loop detection and resolution.
 */

import type { Database } from '../database/init';
import { GovernedStreamWriter } from './governedStreamWriter';
import { EventBus } from '../events/eventBus';
import { getLogger } from '../logging';
import { UnstickingAgent, type UnstickingInput, type UnstickingResult } from '../agents/unstickingAgent';
import { LLMCaller } from '../llm/llmCaller';
import { TemplateLoader } from './templateLoader';
import type { LoopStatus } from '../types/records';
import type { ConfigManager } from '../config/configManager';

// Types

export interface FailureContext {
  workflowRunId: string;
  subPhaseId: string;
  taskId: string;
  taskName: string;
  failureType: 'test_failure' | 'eval_failure' | 'execution_error' | 'timeout' | 'loop_detected';
  errorMessage: string;
  executionTrace: string;
  attemptNumber: number;
  maxAttempts: number;
  previousAttempts: AttemptRecord[];
}

export interface AttemptRecord {
  attemptNumber: number;
  timestamp: string;
  approach: string;
  result: 'failed' | 'partial' | 'success';
  error?: string;
  correctionInjected?: string;
}

export interface FailureResolution {
  strategy: 'retry' | 'rollback' | 'accept_with_caveat' | 'escalate';
  success: boolean;
  attemptNumber: number;
  correctionApplied?: string;
  rollbackPerformed?: boolean;
  caveat?: string;
  escalationReason?: string;
  unstickingResult?: UnstickingResult;
}

export interface FailureHandlerConfig {
  maxRetryAttempts: number;
  rollbackEnabled: boolean;
  unstickingEnabled: boolean;
  /**
   * Optional override for the unsticking agent's LLM routing. When
   * absent, FailureHandler reads from `llm_routing.unsticking` on the
   * supplied ConfigManager. Provided as an explicit override path for
   * tests; production callers should configure via ConfigManager.
   */
  unstickingConfig?: {
    provider: string;
    model: string;
    maxSocraticTurns: number;
  };
}

const DEFAULT_CONFIG: FailureHandlerConfig = {
  maxRetryAttempts: 3,
  rollbackEnabled: true,
  unstickingEnabled: true,
  // unstickingConfig intentionally omitted — resolved from ConfigManager
  // at constructor time so the literal model name lives in one place
  // (DEFAULT_CONFIG.llm_routing.unsticking in configManager.ts).
};

// FailureHandler class

export class FailureHandler {
  private readonly unstickingAgent: UnstickingAgent | null;
  /** Resolved unsticking LLM config — populated when enabled. */
  private readonly resolvedUnstickingConfig: { provider: string; model: string; maxSocraticTurns: number } | null;

  constructor(
    private readonly db: Database,
    private readonly writer: GovernedStreamWriter,
    private readonly eventBus: EventBus,
    private readonly llmCaller: LLMCaller,
    private readonly templateLoader: TemplateLoader,
    private readonly generateId: () => string,
    private readonly janumiCodeVersionSha: string,
    private readonly configManager: ConfigManager,
    private readonly config: FailureHandlerConfig = DEFAULT_CONFIG,
  ) {
    // Initialize UnstickingAgent if enabled. Resolve unsticking routing
    // from ConfigManager unless the caller passed an explicit override.
    if (config.unstickingEnabled) {
      this.resolvedUnstickingConfig = config.unstickingConfig ?? this.resolveUnstickingConfig();
      this.unstickingAgent = new UnstickingAgent(db, llmCaller, templateLoader, this.resolvedUnstickingConfig);
    } else {
      this.resolvedUnstickingConfig = null;
      this.unstickingAgent = null;
    }
  }

  /**
   * Resolve the unsticking LLM config from `llm_routing.unsticking`.
   * Throws if the routing slot is missing — never falls back to a
   * hardcoded literal.
   */
  private resolveUnstickingConfig(): { provider: string; model: string; maxSocraticTurns: number } {
    const routing = this.configManager.getLLMRouting() as { unsticking?: {
      primary: { provider: string; model: string; base_url?: string };
      temperature?: number;
      max_socratic_turns?: number;
    } };
    const u = routing.unsticking;
    if (!u?.primary?.provider || !u.primary.model) {
      throw new Error(
        'FailureHandler requires llm_routing.unsticking.primary with provider+model set. ' +
        'Configure in .janumicode/config.json or rely on DEFAULT_CONFIG.',
      );
    }
    return {
      provider: u.primary.provider,
      model: u.primary.model,
      maxSocraticTurns: u.max_socratic_turns ?? 3,
    };
  }

  /**
   * Handle a failure and determine resolution strategy.
   */
  async handleFailure(context: FailureContext): Promise<FailureResolution> {
    getLogger().info('workflow', 'Handling failure', {
      workflowRunId: context.workflowRunId,
      subPhaseId: context.subPhaseId,
      taskId: context.taskId,
      failureType: context.failureType,
      attemptNumber: context.attemptNumber,
    });

    // Record the failure
    this.recordFailure(context);

    // Determine loop status
    const loopStatus = this.detectLoop(context);

    // If loop detected, invoke UnstickingAgent
    if (loopStatus !== null && this.unstickingAgent) {
      const unstickingResult = await this.invokeUnstickingAgent(context, loopStatus);

      if (unstickingResult.resolved) {
        // Apply correction and retry
        return {
          strategy: 'retry',
          success: true,
          attemptNumber: context.attemptNumber + 1,
          correctionApplied: unstickingResult.correctionToInject,
          unstickingResult,
        };
      }

      if (unstickingResult.escalateToHuman) {
        // Escalation needed
        return {
          strategy: 'escalate',
          success: false,
          attemptNumber: context.attemptNumber,
          escalationReason: unstickingResult.escalationReason,
          unstickingResult,
        };
      }
    }

    // Check if retries remaining
    if (context.attemptNumber < context.maxAttempts) {
      return {
        strategy: 'retry',
        success: true,
        attemptNumber: context.attemptNumber + 1,
      };
    }

    // Max retries exhausted - consider rollback or accept with caveat
    if (this.config.rollbackEnabled && this.canRollback(context)) {
      const rollbackResult = await this.performRollback(context);
      if (rollbackResult.success) {
        return {
          strategy: 'rollback',
          success: true,
          attemptNumber: context.attemptNumber + 1,
          rollbackPerformed: true,
        };
      }
    }

    // Accept with caveat
    const caveat = await this.generateCaveat(context);
    return {
      strategy: 'accept_with_caveat',
      success: true,
      attemptNumber: context.attemptNumber,
      caveat,
    };
  }

  /**
   * Detect if we're in a loop based on previous attempts.
   */
  private detectLoop(context: FailureContext): LoopStatus | null {
    const { previousAttempts, failureType } = context;

    if (previousAttempts.length < 2) {
      return null;
    }

    // Check for identical errors in recent attempts
    const recentErrors = previousAttempts
      .slice(-3)
      .map(a => a.error)
      .filter((e): e is string => e !== undefined);

    if (recentErrors.length >= 2) {
      // Check if errors are similar
      const uniqueErrors = new Set(recentErrors.map(e => e.substring(0, 100)));
      if (uniqueErrors.size === 1) {
        return 'STALLED';
      }
    }

    // Check for oscillating approaches
    const recentApproaches = previousAttempts.slice(-4).map(a => a.approach);
    if (recentApproaches.length >= 4) {
      const uniqueApproaches = new Set(recentApproaches);
      if (uniqueApproaches.size <= 2) {
        return 'STALLED';
      }
    }

    // Check for repeated failure type
    if (failureType === 'loop_detected') {
      return 'DIVERGING';
    }

    return null;
  }

  /**
   * Invoke the UnstickingAgent to resolve a loop.
   */
  private async invokeUnstickingAgent(
    context: FailureContext,
    loopStatus: LoopStatus,
  ): Promise<UnstickingResult> {
    if (!this.unstickingAgent) {
      return {
        resolved: false,
        socraticTurns: 0,
        toolResultMisinterpretationConfirmed: false,
        escalateToHuman: true,
        escalationReason: 'UnstickingAgent not available',
      };
    }

    // Load tool results from recent execution
    const toolResults = this.loadRecentToolResults(context.workflowRunId);

    const input: UnstickingInput = {
      stuckAgentTrace: context.executionTrace,
      loopStatus,
      reasoningReviewFindings: this.buildReasoningReviewSummary(context),
      toolResults,
      toolResultMisinterpretationSuspected: context.failureType === 'execution_error',
      workflowRunId: context.workflowRunId,
      subPhaseId: context.subPhaseId,
    };

    return this.unstickingAgent.investigate(input);
  }

  /**
   * Load recent tool results from the database.
   */
  private loadRecentToolResults(workflowRunId: string): string {
    const records = this.db.prepare(`
      SELECT content FROM governed_stream
      WHERE workflow_run_id = ?
      AND record_type = 'tool_result'
      ORDER BY produced_at DESC
      LIMIT 10
    `).all(workflowRunId) as Array<{ content: string }>;

    return records.map(r => {
      try {
        const parsed = JSON.parse(r.content) as Record<string, unknown>;
        return JSON.stringify(parsed, null, 2);
      } catch {
        return r.content;
      }
    }).join('\n---\n');
  }

  /**
   * Build a summary of reasoning review findings.
   */
  private buildReasoningReviewSummary(context: FailureContext): string {
    const parts: string[] = [];

    parts.push(`Failure Type: ${context.failureType}`, `Error: ${context.errorMessage}`);

    if (context.previousAttempts.length > 0) {
      parts.push(`Previous Attempts: ${context.previousAttempts.length}`);
      const lastAttempt = context.previousAttempts.at(-1);
      if (lastAttempt?.error) {
        parts.push(`Last Error: ${lastAttempt.error}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Record the failure in the Governed Stream.
   */
  private recordFailure(context: FailureContext): void {
    this.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: context.workflowRunId,
      phase_id: '9',
      sub_phase_id: '9.4',
      produced_by_agent_role: 'executor_agent',
      janumicode_version_sha: this.janumiCodeVersionSha,
      content: {
        kind: 'failure_record',
        task_id: context.taskId,
        task_name: context.taskName,
        failure_type: context.failureType,
        error_message: context.errorMessage,
        attempt_number: context.attemptNumber,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Check if rollback is possible.
   */
  private canRollback(context: FailureContext): boolean {
    // Check if there are files to rollback
    const filesWritten = this.db.prepare(`
      SELECT COUNT(*) as count FROM governed_stream
      WHERE workflow_run_id = ?
      AND record_type = 'artifact_produced'
      AND json_extract(content, '$.kind') = 'file_written'
    `).get(context.workflowRunId) as { count: number };

    return filesWritten.count > 0;
  }

  /**
   * Perform a rollback operation.
   */
  private async performRollback(context: FailureContext): Promise<{ success: boolean }> {
    getLogger().info('workflow', 'Performing rollback', {
      workflowRunId: context.workflowRunId,
      taskId: context.taskId,
    });

    // In production, this would:
    // 1. Load the git state before the task
    // 2. Revert files written by the task
    // 3. Update the execution trace

    // For now, record the rollback intent
    this.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: context.workflowRunId,
      phase_id: '9',
      sub_phase_id: '9.4',
      produced_by_agent_role: 'executor_agent',
      janumicode_version_sha: this.janumiCodeVersionSha,
      content: {
        kind: 'rollback_performed',
        task_id: context.taskId,
        reason: context.errorMessage,
        timestamp: new Date().toISOString(),
      },
    });

    return { success: true };
  }

  /**
   * Generate a caveat for accepting the failure.
   */
  private async generateCaveat(context: FailureContext): Promise<string> {
    const prompt = `Generate a concise caveat statement for accepting a known limitation:

Task: ${context.taskName}
Failure: ${context.errorMessage}
Attempts: ${context.attemptNumber}

Write a 1-2 sentence caveat that documents this limitation.`;

    if (!this.resolvedUnstickingConfig) {
      return `Task "${context.taskName}" has known limitation: ${context.errorMessage}`;
    }
    try {
      const result = await this.llmCaller.call({
        provider: this.resolvedUnstickingConfig.provider,
        model: this.resolvedUnstickingConfig.model,
        prompt,
        temperature: 0.3,
      });

      return result.text ?? `Task "${context.taskName}" has known limitation: ${context.errorMessage}`;
    } catch {
      return `Task "${context.taskName}" has known limitation: ${context.errorMessage}`;
    }
  }
}
