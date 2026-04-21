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
import { InvocationLogFile, LoopDetector } from './invocationLogger';

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
  /**
   * Optional AbortSignal. When fired, the underlying provider is
   * expected to cancel the in-flight HTTP request. Ollama streaming
   * honors this via fetch/http.request aborts. Used by the CLI's
   * session abort plumbing so `waitForQuiescence` stall detection
   * can unblock a hung LLM call.
   */
  abortSignal?: AbortSignal;
}

export interface LLMCallResult {
  /** Response text (empty string when the model returned only tool calls) */
  text: string;
  /** Parsed JSON (if responseFormat is 'json') */
  parsed: Record<string, unknown> | null;
  /** Thinking/reasoning chain from thinking-mode models (e.g. qwen3.5). */
  thinking?: string;
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

/**
 * Optional chunk callback the LLMCaller passes into the provider's call()
 * when the provider implements streaming. Providers that don't stream
 * simply ignore it. Each chunk carries the raw string delta as it
 * arrives; the LLMCaller persists it as an `agent_output_chunk` record so
 * the AgentInvocationCard can render output live instead of waiting for
 * the final agent_output.
 */
export interface LLMStreamingCallOptions extends LLMCallOptions {
  onChunk?: (chunk: LLMStreamChunk) => void;
  /**
   * Optional abort signal — providers that support it should listen
   * for `aborted` and tear down the in-flight HTTP request. The
   * LLMCaller wires this to a loop detector so a runaway stream
   * (qwen3 thinking spiral) can be killed without waiting on the
   * idle-stall timer (which doesn't fire when chunks are arriving).
   */
  abortSignal?: AbortSignal;
}

export interface LLMStreamChunk {
  /** The text delta (may be empty on non-text chunks like 'thinking'). */
  text: string;
  /**
   * Channel — the UI renders each differently:
   *   - 'response' / 'thinking' — LLM API responses
   *   - 'stdout' / 'stderr'     — CLI subprocess output
   */
  channel: 'response' | 'thinking' | 'stdout' | 'stderr';
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
  private _inFlightCount = 0;
  private eventBus: import('../events/eventBus').EventBus | null = null;
  private liveLogDir: string | null = null;

  constructor(private readonly config: LLMCallerConfig) {}

  /**
   * Configure a directory where per-invocation live log files are
   * written. Each call opens `<liveLogDir>/<invocationId>.log`, appends
   * chunks as they stream, and writes a final-state trailer when done.
   * Use this to `tail -f` a live Ollama call from another terminal
   * instead of waiting on governed_stream DB commits.
   */
  setLiveLogDir(dir: string | null): void {
    this.liveLogDir = dir;
  }

  /**
   * Attach an EventBus so every call() emits `llm:started` / `llm:finished`
   * with the traceContext's label, agentRole, and subPhaseId. The
   * ActivityStrip in the webview subscribes to these events to show
   * WHAT is currently being processed — without this, the strip would
   * report "Idle" throughout phase execution because only the
   * PriorityLLMCaller (used by the Client Liaison) emits them.
   */
  setEventBus(eventBus: import('../events/eventBus').EventBus): void {
    this.eventBus = eventBus;
  }

  /** Number of LLM calls currently in-flight. Used by quiescence detection. */
  get inFlightCount(): number { return this._inFlightCount; }

  /**
   * Register a provider adapter.
   */
  registerProvider(adapter: LLMProviderAdapter): void {
    this.providers.set(adapter.name, adapter);
  }

  /**
   * Return the names of every registered provider adapter. Used by
   * OrchestratorEngine.validateLLMRouting() to check that providers
   * referenced in config are actually wired up.
   */
  getRegisteredProviderNames(): string[] {
    return Array.from(this.providers.keys());
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
    this._inFlightCount++;

    // Open the per-invocation live log (C8). Writes the prompt header
    // immediately, then appends chunks as they stream, and a trailer on
    // completion. Lets `tail -f .janumicode/live/<id>.log` show live
    // model progress independent of DB commits.
    const logFile = invocationId && this.liveLogDir
      ? new InvocationLogFile(this.liveLogDir, invocationId)
      : null;
    if (logFile) {
      logFile.writeHeader({
        invocationId: invocationId!,
        provider: options.provider,
        model: options.model,
        agentRole: options.traceContext?.agentRole ?? null,
        phaseId: options.traceContext?.phaseId ?? null,
        subPhaseId: options.traceContext?.subPhaseId ?? null,
        label: options.traceContext?.label ?? null,
        prompt: options.prompt,
        system: options.system ?? null,
        startedAt: new Date().toISOString(),
      });
    }

    // Emit llm:started so the ActivityStrip shows what is running. Plain
    // LLMCaller has no queue, so we don't emit llm:queued — started fires
    // the moment the call enters this method.
    const trace = options.traceContext;
    this.eventBus?.emit('llm:started', {
      provider: options.provider,
      lane: 'phase',
      label: trace?.label ?? null,
      agentRole: trace?.agentRole ?? null,
      subPhaseId: trace?.subPhaseId ?? null,
    });

    try {
      // Try primary provider with retries
      let lastError: LLMError | null = null;
      let retryAttempts = 0;

      // Attach streaming callback so providers that support it can emit
      // agent_output_chunk records as tokens arrive. Adapters that don't
      // stream just ignore the extra field on the options object.
      let chunkSequence = 0;
      let cumulativeChars = 0;
      // Loop detector + abort controller. The detector watches the
      // streamed text for n-gram repetition; if it fires, we trip the
      // abort signal so the provider can tear down the in-flight HTTP
      // request. Otherwise a runaway qwen3 thinking spiral keeps
      // emitting plausible tokens forever and the stall timer never
      // fires (chunks ARE arriving — they're just semantically stuck).
      const loopDetector = new LoopDetector();
      const abortController = new AbortController();
      let abortReason: string | null = null;
      // Union the caller-provided abort signal (e.g. session abort from
      // waitForQuiescence stall) with our internal one. When the caller's
      // signal fires, we abort the internal controller so the provider's
      // HTTP request tears down cleanly.
      if (options.abortSignal) {
        const external = options.abortSignal;
        const onExternalAbort = () => {
          abortReason ??= 'session abort (external signal)';
          if (!abortController.signal.aborted) abortController.abort();
        };
        if (external.aborted) onExternalAbort();
        else external.addEventListener('abort', onExternalAbort, { once: true });
      }
      // Runtime size-budget cap — a third stall signature complementing
      // records-idle (silent hang) and LoopDetector (n-gram repetition).
      // When a call's cumulative streamed chars exceed this budget, the
      // model is almost certainly stuck in verbose-but-not-converging
      // thinking mode: it's actively emitting tokens but given the
      // context window (e.g. 262144 for qwen3.5:9b), there's no
      // budget left for a final response. Observed cal-3 signature:
      // 2.3MB .log file, 228K thinking chars, no FINAL TEXT ever
      // produced. Default 800000 chars (~200K tokens) leaves headroom
      // for legitimate long outputs while aborting runaway thinking.
      const maxResponseChars = Number.parseInt(
        process.env.JANUMICODE_LLM_MAX_RESPONSE_CHARS ?? '800000', 10);
      const streamingOptions: LLMStreamingCallOptions = {
        ...options,
        abortSignal: abortController.signal,
        onChunk: (chunk) => {
          cumulativeChars += chunk.text.length;
          logFile?.writeChunk({
            channel: chunk.channel,
            msSinceStart: Date.now() - startedAt,
            cumulativeChars,
            text: chunk.text,
          });
          this.writeOutputChunk(invocationId, options, chunk, chunkSequence++);
          if (!abortReason) {
            const reason = loopDetector.observe(chunk.text);
            if (reason) {
              abortReason = reason;
              abortController.abort();
              return;
            }
            if (maxResponseChars > 0 && cumulativeChars > maxResponseChars) {
              abortReason = `max_response_chars exceeded (${cumulativeChars} > ${maxResponseChars}) — likely context-budget starvation in thinking mode`;
              abortController.abort();
            }
          }
        },
      };

      for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
        try {
          const result = await adapter.call(streamingOptions);
          result.retryAttempts = retryAttempts;
          this.writeOutputRecords(invocationId, options, result, Date.now() - startedAt, null);
          logFile?.writeFinal({
            status: 'success',
            text: result.text,
            thinking: result.thinking ?? null,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            durationMs: Date.now() - startedAt,
            retryAttempts,
          });
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
            const fallbackOptions: LLMStreamingCallOptions = {
              ...options,
              provider: this.config.fallback.provider,
              model: this.config.fallback.model,
              onChunk: (chunk) => {
                this.writeOutputChunk(invocationId, options, chunk, chunkSequence++);
              },
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
      logFile?.writeFinal({
        status: 'error',
        text: '',
        thinking: null,
        inputTokens: null,
        outputTokens: null,
        durationMs: Date.now() - startedAt,
        retryAttempts,
        errorMessage: lastError?.message ?? 'unknown',
      });
      throw lastError ?? new LLMError('LLM call failed', 'unknown');
    } finally {
      this._inFlightCount--;
      this.eventBus?.emit('llm:finished', {
        provider: options.provider,
        lane: 'phase',
        durationMs: Date.now() - startedAt,
        label: trace?.label ?? null,
        agentRole: trace?.agentRole ?? null,
        subPhaseId: trace?.subPhaseId ?? null,
      });
    }
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
          // Persist the full input so the card can display it. Users asked
          // for end-to-end visibility — the prompt is the single most
          // valuable thing to see when debugging an agent invocation.
          prompt: options.prompt,
          system: options.system ?? null,
          temperature: options.temperature ?? null,
          max_tokens: options.maxTokens ?? null,
          tools: options.tools ?? [],
        },
      });
      return record.id;
    } catch {
      return null;
    }
  }

  /**
   * Forward a streaming chunk for the in-flight invocation as an event.
   * Previously each chunk was persisted as an `agent_output_chunk` record,
   * but with thinking-mode models that emit thousands of tokens per call,
   * the DB grew by ~20K rows per phase — pushing the snapshot payload past
   * the SharedArrayBuffer's 4MB ceiling on the next webview restore. The
   * `agent_output` record carries the authoritative full text + thinking,
   * so chunks only need transient delivery to the webview for live UI.
   */
  writeOutputChunk(
    invocationId: string | null,
    options: LLMCallOptions,
    chunk: LLMStreamChunk,
    sequence: number,
  ): void {
    if (!invocationId || !options.traceContext) return;
    this.eventBus?.emit('llm:stream_chunk', {
      invocationId,
      sequence,
      channel: chunk.channel,
      text: chunk.text,
    });
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
          // Persist the full thinking chain so the card can keep it
          // visible after completion — thinking is often more valuable
          // than the final response for debugging reasoning failures.
          thinking: result.thinking ?? null,
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
