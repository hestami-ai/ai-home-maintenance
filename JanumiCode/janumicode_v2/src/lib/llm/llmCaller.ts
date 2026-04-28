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
import { InvocationLogFile } from './invocationLogger';

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
  /**
   * Optional per-call provider base URL. When set, providers that
   * support per-call URL routing (currently `llamacpp`) target this
   * endpoint instead of the constructor-time default. Lets the
   * calibration harness point different roles at different
   * llama-server instances on different ports without registering
   * multiple provider adapters.
   *
   * Other providers (`ollama`, `openai`, `google`, `anthropic`) ignore
   * this field — they're constructor-configured. Adding it on the
   * call options surface keeps the route-resolver in phase handlers
   * one place to thread URL through.
   */
  baseUrl?: string;
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
   * LLMCaller wires this to the 1.5 MB size cap and the session abort
   * signal, so runaway thinking spirals can be killed without waiting
   * on the outer records-idle stall timer.
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
  | 'runaway_thinking'  // In-stream abort: invocation log size cap tripped (sampling variance can rescue next attempt)
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
    // Filename prefix encodes phase / sub-phase so operators scanning
    // .janumicode/live/ can find every call for a given sub-phase via
    // glob (e.g. `phase06_1__*.log`). Falls back to no prefix when
    // traceContext is absent (rare — typically only test fixtures).
    //
    // Raw-token-stream writing is opt-in via JANUMICODE_LLM_LIVE_RAW_STREAM=1.
    // Default off because cal-21 produced ~700 MB of live logs largely
    // from per-chunk lines; the trailer's full text + thinking chain
    // is what operators actually consume. Loop detection is unaffected
    // (bytesWritten is incremented in JS regardless of disk write).
    const filenamePrefix = buildLogFilenamePrefix(
      options.traceContext?.phaseId ?? null,
      options.traceContext?.subPhaseId ?? null,
    );
    const writeRawTokenStream = process.env.JANUMICODE_LLM_LIVE_RAW_STREAM === '1';
    const logFile = invocationId && this.liveLogDir
      ? new InvocationLogFile(this.liveLogDir, invocationId, {
          filenamePrefix,
          writeRawTokenStream,
        })
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
      // Invocation-log size cap — primary in-stream stall signature.
      // We measure the bytes written to the per-invocation .log file
      // (prompt + chunk metadata + streamed text), not just cumulative
      // stream chars, because a thinking-mode loop keeps growing the
      // log monotonically even when individual tokens are tiny. 1.5 MB
      // of log file = practically certain to be stuck. Retryable up to
      // maxRetries so sampling variance can rescue the next attempt.
      const maxLogFileBytes = Number.parseInt(
        process.env.JANUMICODE_LLM_MAX_LOG_FILE_BYTES ?? '1572864', 10);

      for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
        // Per-attempt abort + stream state so a retry starts with a
        // fresh budget. bytesBaseline captures the log-file size at
        // attempt start so the size-cap only measures THIS attempt's
        // growth — otherwise a failed attempt 1 at 1.5 MB would
        // instantly re-trip attempt 2 on the very first chunk.
        let cumulativeChars = 0;
        const bytesBaseline = logFile?.bytesWritten ?? 0;
        const abortController = new AbortController();
        let abortReason: string | null = null;
        // Union the caller-provided abort signal (session abort from
        // waitForQuiescence) with our internal one. Session abort is
        // non-retryable: the outer orchestrator is shutting down.
        let sessionAborted = false;
        let externalCleanup: (() => void) | null = null;
        if (options.abortSignal) {
          const external = options.abortSignal;
          const onExternalAbort = () => {
            sessionAborted = true;
            abortReason ??= 'session abort (external signal)';
            if (!abortController.signal.aborted) abortController.abort();
          };
          if (external.aborted) onExternalAbort();
          else {
            external.addEventListener('abort', onExternalAbort, { once: true });
            externalCleanup = () => external.removeEventListener('abort', onExternalAbort);
          }
        }
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
            if (!abortReason && maxLogFileBytes > 0 && logFile) {
              const attemptBytes = logFile.bytesWritten - bytesBaseline;
              if (attemptBytes > maxLogFileBytes) {
                abortReason = `invocation log size exceeded (${attemptBytes} > ${maxLogFileBytes} bytes this attempt) — likely runaway thinking`;
                abortController.abort();
              }
            }
          },
        };

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
          // Stream was aborted by our in-stream detectors — override the
          // provider's error with our own, marking session-aborts as
          // non-retryable and size/flail aborts as retryable.
          if (abortReason) {
            // Our in-stream detectors triggered an abort. Classify:
            //   - session abort → not retryable (outer orchestrator shutting down)
            //   - runaway-thinking (log-size cap tripped) → retryable; a
            //     fresh attempt gets a fresh log-file baseline and sampling
            //     variance can rescue it. This is distinct from a true
            //     HTTP 400 context_exceeded where the server itself
            //     rejects the request.
            const isRunawayThinking = (abortReason as string).includes('invocation log size exceeded');
            const errorType: LLMErrorType = sessionAborted
              ? 'unknown'
              : (isRunawayThinking ? 'runaway_thinking' : 'context_exceeded');
            lastError = new LLMError(
              `LLM stream aborted: ${abortReason}`,
              errorType,
              undefined,
              !sessionAborted,
            );
          } else if (err instanceof LLMError) {
            lastError = err;
          } else {
            const msg = err instanceof Error ? err.message : String(err);
            lastError = new LLMError(msg, 'unknown');
          }

          if (!this.isRetryable(lastError)) break;

          // Backoff before retry
          const delay = this.getBackoffDelay(lastError, attempt);
          if (delay > 0) {
            await this.sleep(delay);
          }
        } finally {
          externalCleanup?.();
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
      case 'runaway_thinking':  // In-stream log-size cap — sampling variance can rescue
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
      case 'runaway_thinking':
        return 2000; // Short pause — fresh attempt gets fresh baseline; sampling variance is the mechanism, not time
      default:
        return 5000 * Math.pow(2, attempt);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Build a filename prefix encoding phase/sub-phase for live log files.
 *
 *   phaseId='6', subPhaseId='6.1'  → 'phase06_1'
 *   phaseId='10', subPhaseId='10.2' → 'phase10_2'
 *   phaseId='3', subPhaseId='3.2a' → 'phase03_2a'
 *   phaseId='2', subPhaseId=null   → 'phase02'
 *   both null                       → null  (legacy unprefixed shape)
 *
 * The prefix is deterministic and glob-friendly so operators can find
 * all calls for a phase via `ls phase06_*` or for a specific sub-phase
 * via `ls phase06_1__*`. Padding phaseId to 2 digits keeps lexical sort
 * order matching numerical phase order through Phase 10.
 */
export function buildLogFilenamePrefix(
  phaseId: string | null,
  subPhaseId: string | null,
): string | null {
  if (!phaseId && !subPhaseId) return null;
  // Prefer subPhaseId because it carries the full path. When only
  // phaseId is present, we still emit `phaseNN` for grouping.
  const source = subPhaseId ?? phaseId ?? '';
  // Split on the first '.' — major phase is everything before it.
  const dotIdx = source.indexOf('.');
  const major = dotIdx >= 0 ? source.slice(0, dotIdx) : source;
  const minor = dotIdx >= 0 ? source.slice(dotIdx + 1) : '';
  // Strip non-id characters defensively (shouldn't be any in practice).
  const safeMinor = minor.replaceAll(/[^a-zA-Z0-9]/g, '_');
  const padded = major.padStart(2, '0');
  return safeMinor ? `phase${padded}_${safeMinor}` : `phase${padded}`;
}
