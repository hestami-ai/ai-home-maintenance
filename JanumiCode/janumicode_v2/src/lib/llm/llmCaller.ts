/**
 * LLMCaller — stateless LLM API calls with retry, backoff, and fallback.
 * Based on JanumiCode Spec v2.3, §7.12.
 *
 * Used by: Reasoning Review, Narrative Memory, Domain Compliance Review,
 * Orchestrator reasoning calls, Deep Memory Research, Ingestion Pipeline Stage III.
 *
 * Wave 5b instrumentation: when a `GovernedStreamWriter` is attached via
 * `setWriter(...)`, every call() writes:
 *   - one `agent_invocation` record BEFORE the call (status: 'running')
 *   - one `agent_output` record AFTER the call (status: 'success' | 'error',
 *     with token counts, duration, tool_calls if any), derived from the
 *     invocation
 *   - one `tool_call` record per native tool call returned, derived from the
 *     invocation
 *
 * Phase handlers pass a `traceContext` (workflow_run_id, phase_id,
 * sub_phase_id, agent_role) so the records get stamped correctly. Without
 * a writer or trace context, instrumentation is a no-op.
 */

import type { GovernedStreamWriter } from '../orchestrator/governedStreamWriter';
import type { AgentRole } from '../types/records';

// ── Types ───────────────────────────────────────────────────────────

/**
 * Provider-agnostic tool definition for native function-calling.
 * Translates to Anthropic `tool_use`, Ollama `tools`, OpenAI `tool_calls`.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for the tool's parameters. */
  input_schema: Record<string, unknown>;
}

export interface ToolCall {
  /** Tool name (matches a registered Capability name). */
  name: string;
  /** Parsed parameter object validated against the tool's input_schema. */
  params: Record<string, unknown>;
  /** Provider-assigned id for tool_use → tool_result roundtrips (optional). */
  id?: string;
}

export interface LLMTraceContext {
  workflowRunId: string;
  phaseId?: string | null;
  subPhaseId?: string | null;
  agentRole?: AgentRole | null;
  /**
   * Human-readable label for the invocation. Shown in the AgentInvocationCard
   * header (e.g. "Phase 1.0 — Intent Quality Check"). Falls back to
   * "<provider> <model>" when omitted.
   */
  label?: string;
}

export interface LLMCallOptions {
  /** Provider name */
  provider: string;
  /** Model name */
  model: string;
  /** System prompt */
  system?: string;
  /** User prompt */
  prompt: string;
  /** Response format */
  responseFormat?: 'json' | 'text';
  /** Temperature (0-2) */
  temperature?: number;
  /** Max output tokens */
  maxTokens?: number;
  /** Tools available for native function calling. */
  tools?: ToolDefinition[];
  /** Tool selection strategy. Defaults to `auto` when tools are provided. */
  toolChoice?: 'auto' | 'none' | 'required' | { name: string };
  /**
   * Workflow context — used by the writer instrumentation to stamp
   * agent_invocation/agent_output/tool_call records with the right
   * workflow_run_id / phase_id / agent_role. Optional: when missing or
   * when no writer is attached, instrumentation is skipped silently.
   */
  traceContext?: LLMTraceContext;
}

export interface LLMCallResult {
  /** Response text (empty string when the model returned only tool calls) */
  text: string;
  /** Parsed JSON (if responseFormat is 'json') */
  parsed: Record<string, unknown> | null;
  /** Tool calls returned by the model, if any. */
  toolCalls: ToolCall[];
  /** Provider used (may differ from requested if fallback triggered) */
  provider: string;
  /** Model used */
  model: string;
  /** Input token count (if reported by provider) */
  inputTokens: number | null;
  /** Output token count (if reported by provider) */
  outputTokens: number | null;
  /** Whether a fallback model was used */
  usedFallback: boolean;
  /** Number of retry attempts */
  retryAttempts: number;
}

export interface LLMProviderAdapter {
  /** Provider name */
  name: string;
  /** Make an API call */
  call(options: LLMCallOptions): Promise<LLMCallResult>;
}

export interface LLMCallerConfig {
  /** Maximum retries per provider (default: 3) */
  maxRetries: number;
  /** Fallback provider+model (optional) */
  fallback?: { provider: string; model: string };
}

// ── Error Types ─────────────────────────────────────────────────────

export type LLMErrorType =
  | 'rate_limit'        // HTTP 429
  | 'service_unavailable' // HTTP 503/504
  | 'auth_error'        // HTTP 401/403
  | 'schema_error'      // HTTP 400
  | 'model_error'       // HTTP 500
  | 'context_exceeded'  // HTTP 400 with context length message
  | 'network_timeout'
  | 'unknown';

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly errorType: LLMErrorType,
    public readonly httpStatus?: number,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

// ── LLMCaller ───────────────────────────────────────────────────────

export class LLMCaller {
  private providers = new Map<string, LLMProviderAdapter>();
  private writer: GovernedStreamWriter | null = null;
  private versionSha = 'dev';

  constructor(private readonly config: LLMCallerConfig) {}

  /**
   * Register a provider adapter.
   */
  registerProvider(adapter: LLMProviderAdapter): void {
    this.providers.set(adapter.name, adapter);
  }

  /**
   * Attach a GovernedStreamWriter so every call() writes
   * agent_invocation / agent_output / tool_call records. The OrchestratorEngine
   * wires this in its constructor (see engine.constructor → llmCaller.setWriter).
   * Without a writer attached, instrumentation is silently skipped.
   */
  setWriter(writer: GovernedStreamWriter, versionSha: string): void {
    this.writer = writer;
    this.versionSha = versionSha;
  }

  /**
   * Make an LLM API call with retry and fallback. When a writer is attached
   * AND options.traceContext is set, also writes the agent_invocation /
   * agent_output / tool_call records that the AgentInvocationCard renders.
   */
  async call(options: LLMCallOptions): Promise<LLMCallResult> {
    const adapter = this.providers.get(options.provider);
    if (!adapter) {
      throw new LLMError(
        `No provider adapter registered for: ${options.provider}`,
        'unknown',
      );
    }

    // Pre-call instrumentation: write agent_invocation BEFORE the call so the
    // webview sees it as 'running' immediately. The card flips to ✅/❌ when
    // the agent_output record arrives.
    const invocationId = this.writeInvocationRecord(options);
    const startedAt = Date.now();

    // Try primary provider with retries
    let lastError: LLMError | null = null;
    let retryAttempts = 0;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await adapter.call(options);
        result.retryAttempts = retryAttempts;
        this.writeOutputRecords(invocationId, options, result, Date.now() - startedAt, null);
        return result;
      } catch (err) {
        retryAttempts++;
        lastError = err instanceof LLMError ? err : new LLMError(
          err instanceof Error ? err.message : String(err),
          'unknown',
        );

        if (!this.isRetryable(lastError)) break;

        // Backoff before retry
        const delay = this.getBackoffDelay(lastError, attempt);
        if (delay > 0) {
          await this.sleep(delay);
        }
      }
    }

    // Try fallback provider if configured
    if (this.config.fallback) {
      const fallbackAdapter = this.providers.get(this.config.fallback.provider);
      if (fallbackAdapter) {
        try {
          const fallbackOptions = {
            ...options,
            provider: this.config.fallback.provider,
            model: this.config.fallback.model,
          };
          const result = await fallbackAdapter.call(fallbackOptions);
          result.usedFallback = true;
          result.retryAttempts = retryAttempts;
          this.writeOutputRecords(invocationId, fallbackOptions, result, Date.now() - startedAt, null);
          return result;
        } catch {
          // Fallback also failed — throw original error
        }
      }
    }

    // All retries + fallback exhausted: write a final error output record so
    // the AgentInvocationCard's status flips from running → error.
    this.writeOutputRecords(invocationId, options, null, Date.now() - startedAt, lastError);
    throw lastError ?? new LLMError('LLM call failed', 'unknown');
  }

  // ── Instrumentation helpers ─────────────────────────────────────

  /**
   * Write the agent_invocation record before the LLM call. Returns the
   * invocation id (or null when instrumentation is disabled), which the
   * agent_output and tool_call records use as their derived_from anchor.
   */
  private writeInvocationRecord(options: LLMCallOptions): string | null {
    if (!this.writer || !options.traceContext) return null;
    const ctx = options.traceContext;
    try {
      const record = this.writer.writeRecord({
        record_type: 'agent_invocation',
        schema_version: '1.0',
        workflow_run_id: ctx.workflowRunId,
        phase_id: ctx.phaseId ?? null,
        sub_phase_id: ctx.subPhaseId ?? null,
        produced_by_agent_role: ctx.agentRole ?? null,
        janumicode_version_sha: this.versionSha,
        content: {
          provider: options.provider,
          model: options.model,
          label: ctx.label ?? `${options.provider} ${options.model}`,
          response_format: options.responseFormat ?? 'text',
          tool_count: options.tools?.length ?? 0,
          status: 'running',
          started_at: new Date().toISOString(),
        },
      });
      return record.id;
    } catch {
      return null;
    }
  }

  /**
   * Write the agent_output record after the LLM call returns (success or
   * error). On success, also writes one tool_call record per native tool
   * invocation in the result. All children point at the parent invocation
   * via derived_from_record_ids so the AgentInvocationCard can group them.
   */
  private writeOutputRecords(
    invocationId: string | null,
    options: LLMCallOptions,
    result: LLMCallResult | null,
    durationMs: number,
    error: LLMError | null,
  ): void {
    if (!this.writer || !invocationId || !options.traceContext) return;
    const ctx = options.traceContext;

    try {
      this.writer.writeRecord({
        record_type: 'agent_output',
        schema_version: '1.0',
        workflow_run_id: ctx.workflowRunId,
        phase_id: ctx.phaseId ?? null,
        sub_phase_id: ctx.subPhaseId ?? null,
        produced_by_agent_role: ctx.agentRole ?? null,
        janumicode_version_sha: this.versionSha,
        derived_from_record_ids: [invocationId],
        content: result ? {
          status: 'success',
          provider: result.provider,
          model: result.model,
          text: result.text,
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
          duration_ms: durationMs,
          tool_call_count: result.toolCalls?.length ?? 0,
          retry_attempts: result.retryAttempts,
          used_fallback: result.usedFallback,
        } : {
          status: 'error',
          provider: options.provider,
          model: options.model,
          duration_ms: durationMs,
          error_type: error?.errorType ?? 'unknown',
          error_message: error?.message ?? 'Unknown error',
          retry_attempts: error ? this.config.maxRetries : 0,
        },
      });
    } catch {
      /* instrumentation must never break the call path */
    }

    // One tool_call record per native tool call in the result.
    if (result?.toolCalls?.length) {
      for (const tc of result.toolCalls) {
        try {
          this.writer.writeRecord({
            record_type: 'tool_call',
            schema_version: '1.0',
            workflow_run_id: ctx.workflowRunId,
            phase_id: ctx.phaseId ?? null,
            sub_phase_id: ctx.subPhaseId ?? null,
            produced_by_agent_role: ctx.agentRole ?? null,
            janumicode_version_sha: this.versionSha,
            derived_from_record_ids: [invocationId],
            content: {
              tool_name: tc.name,
              parameters: tc.params,
              tool_use_id: tc.id ?? null,
            },
          });
        } catch {
          /* instrumentation must never break the call path */
        }
      }
    }
  }

  /**
   * Determine if an error is retryable per §7.12.
   */
  private isRetryable(error: LLMError): boolean {
    switch (error.errorType) {
      case 'rate_limit':        // 429 — retry with backoff
      case 'service_unavailable': // 503/504 — retry with backoff
      case 'network_timeout':   // Retry once
        return true;
      case 'model_error':       // 500 — retry once
        return true;
      case 'auth_error':        // 401/403 — no retry
      case 'schema_error':      // 400 — no retry (prompt template bug)
      case 'context_exceeded':  // 400 — no retry (escalate)
        return false;
      default:
        return false;
    }
  }

  /**
   * Calculate backoff delay in milliseconds.
   */
  private getBackoffDelay(error: LLMError, attempt: number): number {
    switch (error.errorType) {
      case 'rate_limit':
        return 5000 * Math.pow(2, attempt); // 5s, 10s, 20s
      case 'service_unavailable':
        return 10000 * Math.pow(2, attempt); // 10s, 20s, 40s
      case 'network_timeout':
        return 0; // Retry immediately once
      case 'model_error':
        return 5000; // Fixed 5s
      default:
        return 5000 * Math.pow(2, attempt);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
