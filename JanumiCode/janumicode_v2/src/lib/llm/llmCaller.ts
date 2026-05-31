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

import { createHash } from 'node:crypto';
import type { Database } from '../database/init';
import type { GovernedStreamWriter } from '../orchestrator/governedStreamWriter';
import type { AgentRole, PhaseId } from '../types/records';
import { InvocationLogFile } from './invocationLogger';
import {
  emit as aoddEmit,
  maybeSpillText,
  phaseIdToFilenameSegment,
  subPhaseIdToFilenameSegment,
} from '../aodd';
import { setInvocation } from '../trace/traceContext';

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
  /**
   * Optional schema hint — passed to the json_repair fallback when the
   * primary call's response can't be parsed. Free-form: a JSON Schema,
   * a TypeScript interface, or an example object literal. The repair
   * model uses it to constrain its repaired output to the expected
   * shape. Has no effect on the primary call itself.
   */
  expectedJsonSchema?: string;
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

/**
 * In-memory cache entry for an LLM call's reproducible output. Stored
 * under a sha256 of (provider, model, response_format, temperature,
 * max_tokens, system, prompt, tools, toolChoice). When call() hits
 * the cache, the live HTTP call is skipped and this output is returned
 * as-if it was freshly produced.
 */
interface CachedLLMOutput {
  text: string;
  parsed: Record<string, unknown> | null;
  thinking?: string;
  toolCalls: ToolCall[];
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  /** record_id of the agent_invocation that originally produced this output. */
  sourceInvocationId: string;
}

/**
 * Hook signature for the reasoning-review HARNESS dispatch (Track D
 * Commit 10 cutover). Invoked once per successful agent_output, with
 * the freshly-written records' ids and the full LLM result. Synchronous:
 * the LLMCaller awaits it before returning to the phase handler. The
 * hook itself decides whether to actually run the harness (the harness
 * loop-guard short-circuits for harness/json_repair internal calls).
 *
 * Replaces the prior single-pass `ReviewerHook` whose behaviour now
 * lives entirely inside `runReviewHarness`.
 */
export type ReviewHarnessHook = (params: {
  agentInvocationId: string;
  agentOutputId: string;
  traceContext: LLMTraceContext;
  prompt: string;
  result: LLMCallResult;
}) => Promise<void>;

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
  private reviewHarnessHook: ReviewHarnessHook | null = null;
  private jsonRepairRouting: import('./jsonRepairLLM').JsonRepairRouting | null = null;
  /**
   * LLM-call cache. Keyed by sha256(prompt + system + provider + model +
   * responseFormat + temperature + maxTokens + tools + toolChoice). When
   * a cache entry exists, call() returns the cached result instantly
   * without making the HTTP call. The cache is populated either from
   * the persisted governed_stream (via loadCacheFromDb on resume) or
   * from successful live calls within this session.
   *
   * Design: this is the resume-optimization seam. Per-handler sub-phase
   * skip would require per-phase deserialization logic; LLM-call caching
   * achieves ~95% of the wall-clock savings with one central change.
   * Phase handlers still run their full pipeline (parse, normalize,
   * persist) on cached outputs, but the expensive HTTP-to-Ollama hop
   * is bypassed.
   *
   * Caveats:
   *  - Cache hits skip the agent_invocation/agent_output write path,
   *    so the resumed run's DB does NOT gain duplicate invocation
   *    records for pre-target sub-phases — the originals remain
   *    is_current_version=1 and serve as the "what happened" history.
   *  - lifecycle + transformation_step events ARE still emitted for
   *    cache hits (with metadata.cache_hit=true) so the audit trail
   *    of the resumed session stays complete.
   */
  private llmCache = new Map<string, CachedLLMOutput>();

  constructor(private readonly config: LLMCallerConfig) {}

  /**
   * Compute the SHA256 cache key for a set of call options. Order of
   * fields here must stay stable across releases — changing it
   * invalidates every cached entry from prior runs. The hash inputs
   * mirror the agent_invocation.content fields persisted by
   * writeInvocationRecord() so loadCacheFromDb() can reconstruct the
   * exact same key from history.
   */
  private computeCacheKey(opts: {
    provider: string;
    model: string;
    responseFormat: string;
    temperature: number | null;
    maxTokens: number | null;
    system: string | null;
    prompt: string;
    tools: ToolDefinition[];
    toolChoice: LLMCallOptions['toolChoice'] | null;
  }): string {
    const canonical = JSON.stringify({
      p: opts.provider,
      m: opts.model,
      rf: opts.responseFormat,
      t: opts.temperature,
      mt: opts.maxTokens,
      s: opts.system ?? '',
      pr: opts.prompt,
      tl: opts.tools ?? [],
      tc: opts.toolChoice ?? null,
    });
    return createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Populate the in-memory LLM call cache from a prior run's persisted
   * agent_invocation + agent_output pairs in the governed_stream. Called
   * once during resume bootstrap (before phases re-execute) so that every
   * LLM call replayed below the resume cutoff returns instantly from the
   * cached output instead of re-hitting the provider.
   *
   * Only success-status outputs are cached — failed invocations are
   * intentionally re-executed on resume (sampling variance may rescue
   * them, and the operator likely fixed something to trigger the resume).
   *
   * Safe to call on a live writer DB: queries are read-only and the
   * cache map is process-local. Returns counts for logging.
   */
  loadCacheFromDb(
    db: import('../database/init').Database,
    workflowRunId: string,
  ): { entries: number; scanned: number; skipped: number } {
    let entries = 0;
    let skipped = 0;
    const invocations = db.prepare(`
      SELECT id, content FROM governed_stream
       WHERE workflow_run_id = ?
         AND record_type = 'agent_invocation'
         AND is_current_version = 1
    `).all(workflowRunId) as Array<{ id: string; content: string }>;

    const outputStmt = db.prepare(`
      SELECT content FROM governed_stream
       WHERE record_type = 'agent_output'
         AND is_current_version = 1
         AND derived_from_record_ids LIKE ?
       LIMIT 1
    `);

    for (const inv of invocations) {
      let invContent: Record<string, unknown>;
      try {
        invContent = JSON.parse(inv.content);
      } catch {
        skipped++;
        continue;
      }
      const outRow = outputStmt.get(`%${inv.id}%`) as { content: string } | undefined;
      if (!outRow) { skipped++; continue; }
      let outContent: Record<string, unknown>;
      try {
        outContent = JSON.parse(outRow.content);
      } catch {
        skipped++;
        continue;
      }
      if (outContent.status !== 'success') { skipped++; continue; }

      const key = this.computeCacheKey({
        provider: String(invContent.provider ?? ''),
        model: String(invContent.model ?? ''),
        responseFormat: String(invContent.response_format ?? 'text'),
        temperature: (invContent.temperature as number | null) ?? null,
        maxTokens: (invContent.max_tokens as number | null) ?? null,
        system: (invContent.system as string | null) ?? null,
        prompt: String(invContent.prompt ?? ''),
        tools: (invContent.tools as ToolDefinition[] | undefined) ?? [],
        toolChoice: null,
      });

      let parsed: Record<string, unknown> | null = null;
      const text = String(outContent.text ?? '');
      // The output record persists raw text; re-parse JSON responses on
      // load so callers that read result.parsed see the same value as
      // they would on a live call.
      if (invContent.response_format === 'json' && text.trim().length > 0) {
        try { parsed = JSON.parse(text); } catch { parsed = null; }
      }

      this.llmCache.set(key, {
        text,
        parsed,
        thinking: (outContent.thinking as string | undefined) ?? undefined,
        toolCalls: [],
        provider: String(outContent.provider ?? invContent.provider ?? ''),
        model: String(outContent.model ?? invContent.model ?? ''),
        inputTokens: (outContent.input_tokens as number | null) ?? null,
        outputTokens: (outContent.output_tokens as number | null) ?? null,
        sourceInvocationId: inv.id,
      });
      entries++;
    }
    return { entries, scanned: invocations.length, skipped };
  }

  /**
   * Configure the LLM-based JSON repair fallback (`json_repair` agent
   * role). When a call requests `responseFormat: 'json'` and the
   * provider's parsed output is null, the broken text is handed to a
   * dedicated repair sequence: primary model first, fallback model if
   * primary fails. Both attempts include the original prompt + system +
   * thinking chain as grounding context. Set to null to disable
   * (default — caller halts on parse failure).
   *
   * Single-GPU constraint: repair attempts run strictly sequentially.
   */
  setJsonRepairRouting(routing: import('./jsonRepairLLM').JsonRepairRouting | null): void {
    this.jsonRepairRouting = routing;
  }

  /**
   * Attach the reasoning-review HARNESS hook (Track D Commit 10).
   * Runs after every successful agent_output is written. Invoked
   * synchronously (awaited) so harness findings land in governed_stream
   * BEFORE the next phase runs. The harness's own loop-guard
   * short-circuits when the originating call's `agentRole` is
   * `harness` / `json_repair` / `reasoning_review` so this is safe to
   * unconditionally fire on every reviewable call.
   */
  setReviewHarnessHook(hook: ReviewHarnessHook | null): void {
    this.reviewHarnessHook = hook;
  }

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

    // Cache short-circuit (resume optimization). If this exact prompt was
    // already executed in a prior run that is being resumed, return the
    // cached output without hitting the provider. The agent_invocation /
    // agent_output records from the original run remain authoritative —
    // we don't re-write them. lifecycle + transformation_step ARE emitted
    // with cache_hit=true so the resumed session's audit trail stays
    // complete and walk-back can show "this call came from cache".
    if (this.llmCache.size > 0) {
      const cacheKey = this.computeCacheKey({
        provider: options.provider,
        model: options.model,
        responseFormat: options.responseFormat ?? 'text',
        temperature: options.temperature ?? null,
        maxTokens: options.maxTokens ?? null,
        system: options.system ?? null,
        prompt: options.prompt,
        tools: options.tools ?? [],
        toolChoice: options.toolChoice ?? null,
      });
      const cached = this.llmCache.get(cacheKey);
      if (cached) {
        const traceSubPhaseId = options.traceContext?.subPhaseId ?? undefined;
        const traceAgentRole = options.traceContext?.agentRole ?? null;
        const cachedResult: LLMCallResult = {
          text: cached.text,
          parsed: cached.parsed,
          thinking: cached.thinking,
          toolCalls: cached.toolCalls,
          provider: cached.provider,
          model: cached.model,
          inputTokens: cached.inputTokens,
          outputTokens: cached.outputTokens,
          usedFallback: false,
          retryAttempts: 0,
        };
        aoddEmit(
          'llm.cache_hit',
          {
            source_invocation_id: cached.sourceInvocationId,
            text: maybeSpillText(cached.text),
          },
          {
            sub_phase_id_override: traceSubPhaseId,
            agent_role: traceAgentRole ?? undefined,
          },
        );
        return cachedResult;
      }
    }

    // Pre-call instrumentation: write agent_invocation BEFORE the call so the
    // webview sees it as 'running' immediately. The card flips to ✅/❌ when
    // the agent_output record arrives.
    const invocationId = this.writeInvocationRecord(options);
    const startedAt = Date.now();
    this._inFlightCount++;
    // Publish the active invocation_id into TraceCtx so any AODD event
    // fired during this call (log.*, record.*, etc.) carries it in the
    // envelope without the caller threading it manually. Cleared in
    // the finally below.
    if (invocationId) setInvocation(invocationId);

    // Transformation trace: capture the materialized prompt at call entry
    // so walk-back can answer "what was the input to this LLM call?". The
    // four trace steps (prompt_materialized / llm_returned / json_parsed
    // or json_repaired) all share an `invocation_id` in their metadata so
    // the walk-back CLI can group them into a single call's chain even
    // without explicit parent_step_id linking.
    const traceSubPhaseId = options.traceContext?.subPhaseId ?? undefined;
    const traceAgentRole = options.traceContext?.agentRole ?? null;
    // AODD emits. prompt.materialized captures the finalized prompt;
    // llm.invoked marks the boundary just before the API call so
    // llm.returned / llm.failed can be paired with it on replay.
    const promptForAodd = maybeSpillText(options.prompt);
    const systemForAodd = options.system ? maybeSpillText(options.system) : undefined;
    if (invocationId) {
      aoddEmit(
        'prompt.materialized',
        { invocation_id: invocationId, final_prompt: promptForAodd },
        {
          invocation_id: invocationId,
          sub_phase_id_override: traceSubPhaseId,
          agent_role: traceAgentRole ?? undefined,
        },
      );
    }
    aoddEmit(
      'llm.invoked',
      {
        provider: options.provider,
        model: options.model,
        temperature: options.temperature ?? undefined,
        max_tokens: options.maxTokens ?? undefined,
        prompt: promptForAodd,
        ...(systemForAodd !== undefined ? { system: systemForAodd } : {}),
      },
      {
        invocation_id: invocationId ?? undefined,
        sub_phase_id_override: traceSubPhaseId,
        agent_role: traceAgentRole ?? undefined,
      },
    );

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
      // Tuning history (cal-26 cycle): tried 100 KB and 256 KB to catch
      // loops earlier; both falsely tripped on qwen3.5:9b's normal
      // verbose-but-converging thinking on bloom/discovery sub-phases
      // (user_journey_bloom hit 92 KB of legit deliberation before the
      // model started emitting JSON). Reverted to 1.5 MB — the real
      // loop pathology in cal-25 was at NFR saturation and is rare
      // enough that letting it run longer is acceptable.
      const maxLogFileBytes = Number.parseInt(
        process.env.JANUMICODE_LLM_MAX_LOG_FILE_BYTES ?? '1572864', 10);

      // Per-call wall-clock timeout — companion to the byte-cap retry.
      // The byte cap catches token-producing loops (log grows fast). It
      // does NOT catch silent hangs where the call produces no tokens
      // for a long time (cal-26 cycle: ollama call wedged for 15+ min,
      // records-idle stall fired session abort, deferred 9 nodes).
      // This timeout fires the same per-attempt abort path so the call
      // is retryable (sampling variance can rescue the next attempt).
      // Default 600 s — chosen after the Apriel-1.6:15b bake-off where a
      // legit system_workflow_bloom run completed in 8:11 (491s) on a
      // 22KB prompt. 240s and 180s defaults both timed out on Apriel
      // for the larger Phase-1 producer prompts. Pair with maxRetries=1
      // for a worst-case 1200s; pair with maxRetries=0 for a strict
      // 600s budget that fits inside the orchestrator's records-idle
      // stall (default 900s). Cal-27 ran with 300s × 3 = 900s exactly,
      // so a single hung node tied up the whole stall budget and
      // aborted the session — keep total maxCallSeconds × (1 + maxRetries)
      // under the stall ceiling when adjusting either knob.
      // Set to 0 to disable.
      const maxCallSeconds = Number.parseInt(
        process.env.JANUMICODE_LLM_MAX_CALL_SECONDS ?? '600', 10);

      // Line-repetition cap — fast-fail for degenerate-loop pathologies
      // (cal-27 NFR saturation: qwen3.5:9b emitted "* `1`: Count/status
      // check." 1000+ times before the wall-clock fired). When the same
      // non-trivial line appears N times CONSECUTIVELY, the model is
      // stuck in a low-entropy attractor and a fresh sampling pass is
      // the only way out — so we abort and let retry sample from a
      // different state. Threshold of 30 is well above any legitimate
      // enumeration. Consecutive-only avoids false positives on
      // legitimate JSON whose common fields (e.g. "actor": "System")
      // repeat many times across a list interspersed with other lines.
      // Set to 0 to disable.
      const maxRepeatedLine = Number.parseInt(
        process.env.JANUMICODE_LLM_MAX_REPEATED_LINE ?? '30', 10);

      // No-progress timer — primary silent-hang safety net. Resets on
      // every streaming chunk; aborts when no chunk has arrived for N
      // seconds. Replaces total-wall-clock as the precise "is the model
      // making progress?" signal — a slow-but-streaming valid output
      // (Phase 1 bloom prompts can stream 200+ KB over 5+ minutes)
      // never trips, while a wedged socket or paused generation does.
      // The total-wall-clock below is kept as an outer last-resort cap.
      // Default 90 s is generous enough for a model that pauses briefly
      // while emitting big tool-call payloads or thinking blocks. Set
      // to 0 to disable.
      const maxNoProgressSeconds = Number.parseInt(
        process.env.JANUMICODE_LLM_NO_PROGRESS_SECONDS ?? '90', 10);

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
        // Per-attempt line-repetition tracking (consecutive). Reset
        // every retry so sampling variance gets a clean slate.
        let lineBuffer = '';
        let lastLine: string | null = null;
        let consecutiveLineCount = 0;
        // No-progress timer — re-armed on every streaming chunk. Cleared
        // in every exit path (success, error, retry) below alongside
        // the wall-clock handle.
        let noProgressHandle: NodeJS.Timeout | null = null;
        const armNoProgressTimer = () => {
          if (noProgressHandle) clearTimeout(noProgressHandle);
          if (maxNoProgressSeconds <= 0) return;
          noProgressHandle = setTimeout(() => {
            if (abortReason) return;
            abortReason = `no-progress timeout (${maxNoProgressSeconds}s without a streaming chunk) — likely silent hang`;
            if (!abortController.signal.aborted) abortController.abort();
          }, maxNoProgressSeconds * 1000);
          noProgressHandle.unref?.();
        };
        // Arm initially so a provider that never emits a single chunk
        // (e.g. wedged socket before TTFB) still aborts.
        armNoProgressTimer();

        // Wall-clock timer — outer safety cap for adversarial cases
        // where a model pauses, emits a chunk every N-1 seconds (just
        // resetting no-progress), and never converges. Cleared in every
        // exit path (success, error, retry) below.
        let callTimeoutHandle: NodeJS.Timeout | null = null;
        if (maxCallSeconds > 0) {
          callTimeoutHandle = setTimeout(() => {
            if (abortReason) return;
            abortReason = `invocation wall-clock exceeded (${maxCallSeconds}s this attempt) — likely silent hang`;
            if (!abortController.signal.aborted) abortController.abort();
          }, maxCallSeconds * 1000);
          // Don't keep the process alive on this timer if the run otherwise finishes.
          callTimeoutHandle.unref?.();
        }
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
            // Re-arm the no-progress timer on every chunk — any chunk
            // (response text, thinking, even empty whitespace) counts
            // as forward progress from the streaming socket.
            armNoProgressTimer();
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
            // Consecutive-line-repetition detector: count identical
            // non-trivial lines that appear back-to-back with no other
            // line types between them. Cal-27 pathology: qwen3.5:9b
            // emitted "* `1`: Count/status check." 1000+ times with NO
            // other lines between — a true degenerate loop. Thin-slice
            // false-positive (initial design): `"actor": "System",`
            // repeats 100+ times across a list of workflows but is
            // INTERSPERSED with `"action"`, `"step_number"`, etc., so
            // the consecutive count resets every few lines and never
            // hits the threshold. The total-count variant flagged this
            // legitimate JSON output as a loop; consecutive-count does
            // not. Catches degenerate loops at ~10s while leaving valid
            // verbose JSON alone.
            if (!abortReason && maxRepeatedLine > 0) {
              lineBuffer += chunk.text;
              let nl = lineBuffer.indexOf('\n');
              while (nl !== -1) {
                const line = lineBuffer.slice(0, nl).trim();
                lineBuffer = lineBuffer.slice(nl + 1);
                if (line.length >= 8) {
                  if (line === lastLine) {
                    consecutiveLineCount++;
                  } else {
                    lastLine = line;
                    consecutiveLineCount = 1;
                  }
                  if (consecutiveLineCount >= maxRepeatedLine) {
                    const preview = line.length > 60 ? line.slice(0, 60) + '…' : line;
                    abortReason = `degenerate loop detected (line repeated ${consecutiveLineCount}× consecutively this attempt): "${preview}"`;
                    abortController.abort();
                    break;
                  }
                }
                nl = lineBuffer.indexOf('\n');
              }
            }
          },
        };

        try {
          const result = await adapter.call(streamingOptions);
          result.retryAttempts = retryAttempts;
          // Layer 2a — DETERMINISTIC structural recovery FIRST. Before the
          // expensive LLM repair, try cheap brace/bracket-balancing +
          // trailing-comma stripping (`tryParseJson`). Models reliably
          // miscount closers on deeply nested output (Phase 5
          // api_definitions); this salvages the model's REAL content
          // without an extra LLM round-trip or risk of semantic drift.
          if (
            options.responseFormat === 'json' &&
            !result.parsed &&
            typeof result.text === 'string' &&
            result.text.trim().length > 0 &&
            options.traceContext?.agentRole !== 'json_repair' &&
            options.traceContext?.agentRole !== 'reasoning_review'
          ) {
            const { tryParseJson } = await import('./jsonRecovery.js');
            const recov = tryParseJson(result.text);
            if (recov.parsed && recov.structurallyRepaired) {
              result.parsed = recov.parsed;
              aoddEmit(
                'repair.json_succeeded',
                { strategy: 'deterministic_structural', repaired: maybeSpillText(recov.jsonText ?? '') },
                { invocation_id: invocationId ?? undefined, sub_phase_id_override: traceSubPhaseId, agent_role: traceAgentRole ?? undefined },
              );
            }
          }
          // LLM-based JSON repair fallback (json_repair agent role): if
          // the call requested json and the response didn't parse, hand
          // the broken text to a dedicated repair sequence (primary →
          // fallback). Both attempts receive the original prompt +
          // system + thinking chain as grounding so the repair model
          // can produce a semantically faithful fix. Sequential by
          // design (single-GPU host). Skip the loop guard cases:
          //   - this call IS a repair call (agentRole === 'json_repair')
          //   - this call IS reasoning-review (separate domain)
          // Repair runs BEFORE persistence so result.parsed reflects
          // the repaired value when downstream consumers read it.
          if (
            options.responseFormat === 'json' &&
            !result.parsed &&
            typeof result.text === 'string' &&
            result.text.trim().length > 0 &&
            this.jsonRepairRouting &&
            options.traceContext?.agentRole !== 'json_repair' &&
            options.traceContext?.agentRole !== 'reasoning_review'
          ) {
            const { repairJsonViaLLM } = await import('./jsonRepairLLM.js');
            const repair = await repairJsonViaLLM(
              result.text,
              this.jsonRepairRouting,
              {
                originalPrompt: options.prompt,
                originalSystem: options.system ?? null,
                originalThinking: result.thinking ?? null,
                originalAgentRole: options.traceContext?.agentRole ?? null,
                expectedJsonSchema: options.expectedJsonSchema ?? null,
              },
              {
                workflowRunId: options.traceContext?.workflowRunId ?? '',
                phaseId: options.traceContext?.phaseId ?? null,
                subPhaseId: options.traceContext?.subPhaseId ?? null,
              },
              this,
            );
            if (repair.parsed) {
              result.parsed = repair.parsed;
            }
            // Always write a json_repair_record so the operator can see
            // exactly what was attempted (and what each attempt
            // returned). Useful even on success — confirms which model
            // ultimately produced the parsed output.
            this.writeJsonRepairRecord(invocationId, options, repair);
            // AODD emit. We synthesize `repair.json_succeeded` when
            // the repair recovered a parsed payload, `repair.json_failed`
            // otherwise. `strategy` is a coarse identifier — the per-attempt
            // detail lives in the json_repair_record DB row.
            if (repair.parsed !== null) {
              aoddEmit(
                'repair.json_succeeded',
                {
                  strategy: 'multi_attempt',
                  repaired: maybeSpillText(JSON.stringify(repair.parsed)),
                },
                {
                  invocation_id: invocationId ?? undefined,
                  sub_phase_id_override: traceSubPhaseId,
                  agent_role: 'json_repair',
                },
              );
            } else {
              aoddEmit(
                'repair.json_failed',
                {
                  strategy: 'multi_attempt',
                  error: { message: 'repair exhausted attempts' },
                },
                {
                  invocation_id: invocationId ?? undefined,
                  sub_phase_id_override: traceSubPhaseId,
                  agent_role: 'json_repair',
                },
              );
            }
          }
          const { agentOutputId } = this.writeOutputRecords(invocationId, options, result, Date.now() - startedAt, null);
          logFile?.writeFinal({
            status: 'success',
            text: result.text,
            thinking: result.thinking ?? null,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            durationMs: Date.now() - startedAt,
            retryAttempts,
          });
          const llmReturnedDurationMs = Date.now() - startedAt;
          aoddEmit(
            'llm.returned',
            {
              text: maybeSpillText(result.text),
              thinking: result.thinking ? maybeSpillText(result.thinking) : null,
              input_tokens: result.inputTokens,
              output_tokens: result.outputTokens,
              duration_ms: llmReturnedDurationMs,
              retry_attempts: result.retryAttempts,
            },
            {
              invocation_id: invocationId ?? undefined,
              sub_phase_id_override: traceSubPhaseId,
              agent_role: traceAgentRole ?? undefined,
            },
          );
          // Populate cache so within-session repeats of the same prompt
          // (and any future resume of THIS run) short-circuit. Only cache
          // successful calls — error results would mask provider recovery.
          if (invocationId) {
            const cacheKey = this.computeCacheKey({
              provider: options.provider,
              model: options.model,
              responseFormat: options.responseFormat ?? 'text',
              temperature: options.temperature ?? null,
              maxTokens: options.maxTokens ?? null,
              system: options.system ?? null,
              prompt: options.prompt,
              tools: options.tools ?? [],
              toolChoice: options.toolChoice ?? null,
            });
            this.llmCache.set(cacheKey, {
              text: result.text,
              parsed: result.parsed,
              thinking: result.thinking,
              toolCalls: result.toolCalls,
              provider: result.provider,
              model: result.model,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              sourceInvocationId: invocationId,
            });
          }
          await this.runReviewerHook(invocationId, agentOutputId, options, result);
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
            // Both byte-cap ("invocation log size exceeded") and wall-clock
            // ("invocation wall-clock exceeded") in-stream aborts are
            // treated as `runaway_thinking` — same retry semantics: a
            // fresh attempt gets fresh budget and sampling variance can
            // rescue it. Distinguish from true HTTP 400 context_exceeded
            // where the server rejects the request.
            const reason = abortReason as string;
            const isRunawayThinking =
              reason.includes('invocation log size exceeded') ||
              reason.includes('invocation wall-clock exceeded') ||
              reason.includes('degenerate loop detected') ||
              reason.includes('no-progress timeout');
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
          aoddEmit(
            'retry.scheduled',
            { attempt: retryAttempts, reason: lastError.message },
            {
              invocation_id: invocationId ?? undefined,
              sub_phase_id_override: traceSubPhaseId,
              agent_role: traceAgentRole ?? undefined,
            },
          );
          if (delay > 0) {
            await this.sleep(delay);
          }
          aoddEmit(
            'retry.attempted',
            { attempt: retryAttempts },
            {
              invocation_id: invocationId ?? undefined,
              sub_phase_id_override: traceSubPhaseId,
              agent_role: traceAgentRole ?? undefined,
            },
          );
        } finally {
          externalCleanup?.();
          if (callTimeoutHandle) clearTimeout(callTimeoutHandle);
          if (noProgressHandle) clearTimeout(noProgressHandle);
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
            const { agentOutputId } = this.writeOutputRecords(invocationId, fallbackOptions, result, Date.now() - startedAt, null);
            await this.runReviewerHook(invocationId, agentOutputId, fallbackOptions, result);
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
      // AODD emit: terminal llm.failed with the error.
      const llmFailedDurationMs = Date.now() - startedAt;
      aoddEmit(
        'llm.failed',
        {
          error: {
            message: lastError?.message ?? 'unknown',
            code: lastError?.errorType,
          },
          duration_ms: llmFailedDurationMs,
          retry_attempts: retryAttempts,
        },
        {
          invocation_id: invocationId ?? undefined,
          sub_phase_id_override: traceSubPhaseId,
          agent_role: traceAgentRole ?? undefined,
        },
      );
      throw lastError ?? new LLMError('LLM call failed', 'unknown');
    } finally {
      this._inFlightCount--;
      // Clear the invocation_id we set above so subsequent emits in the
      // same TraceCtx frame don't inherit a stale id.
      if (invocationId) setInvocation(null);
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
  ): { agentOutputId: string | null } {
    if (!this.writer || !invocationId || !options.traceContext) return { agentOutputId: null };
    const ctx = options.traceContext;

    let agentOutputId: string | null = null;
    try {
      const outputRec = this.writer.writeRecord({
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
      agentOutputId = outputRec.id;
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

    return { agentOutputId };
  }

  /**
   * Persist a `json_repair_record` summarising a json_repair sequence.
   * Always written when repair fires (success or failure) so operators
   * can see what was tried and what each attempt returned. The record
   * is keyed off the original invocation via derived_from_record_ids.
   */
  private writeJsonRepairRecord(
    originalInvocationId: string | null,
    options: LLMCallOptions,
    repair: import('./jsonRepairLLM').JsonRepairResult,
  ): void {
    if (!this.writer || !originalInvocationId || !options.traceContext) return;
    const ctx = options.traceContext;
    try {
      this.writer.writeRecord({
        record_type: 'json_repair_record',
        schema_version: '1.0',
        workflow_run_id: ctx.workflowRunId,
        phase_id: ctx.phaseId ?? null,
        sub_phase_id: ctx.subPhaseId ?? null,
        produced_by_agent_role: 'json_repair',
        janumicode_version_sha: this.versionSha,
        derived_from_record_ids: [originalInvocationId],
        content: {
          status: repair.parsed ? 'recovered' : 'exhausted',
          original_agent_role: ctx.agentRole ?? null,
          attempts: repair.attempts.map((a) => ({
            provider: a.routing.provider,
            model: a.routing.model,
            duration_ms: a.durationMs,
            success: !!a.parsed,
            error: a.error ?? null,
          })),
        },
      });
    } catch {
      // Best-effort diagnostic — don't fail the LLM call over it.
    }
  }

  /**
   * Invoke the reasoning-review hook on a successful agent_output.
   * Synchronous (awaited) so review findings land in governed_stream
   * before the next phase begins. Soft-fails: any error from the hook
   * is logged via console.warn and swallowed — the review feature must
   * never fail the underlying LLM call. The hook itself decides whether
   * to actually review (self-review guard, empty-output skip, etc.).
   *
   * Public so the AgentInvoker (CLI dispatch path) can fire it after
   * its own writeCLIOutputRecord — direct LLM calls and CLI dispatches
   * both produce reviewable agent_output records, and we want both
   * paths to flow through the same review pipeline.
   */
  async runReviewerHook(
    agentInvocationId: string | null,
    agentOutputId: string | null,
    options: { traceContext?: LLMTraceContext; prompt: string },
    result: LLMCallResult,
  ): Promise<void> {
    if (!this.reviewHarnessHook || !agentOutputId || !agentInvocationId || !options.traceContext) return;
    // Loop-guard: skip review for harness-internal / json_repair calls.
    // The harness's own loop-guard would also skip these, but checking
    // here avoids the call entirely.
    const role = options.traceContext.agentRole;
    if (role === 'json_repair' || role === 'harness' || role === 'reasoning_review') return;
    try {
      await this.reviewHarnessHook({
        agentInvocationId,
        agentOutputId,
        traceContext: options.traceContext,
        prompt: options.prompt,
        result,
      });
    } catch (err) {
      // The hook is responsible for writing its own soft-fail records;
      // a thrown error here means the hook itself crashed before it
      // could record anything. Swallow so we don't poison the LLM call.
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`reasoning-review hook crashed: ${msg}`);
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
 *   phaseId='2', subPhaseId='fr_saturation' → 'phase02_fr_saturation'
 *   phaseId='10', subPhaseId='commit_finalize' → 'phase10_commit_finalize'
 *   phaseId='0.5', subPhaseId='impact_enumeration' → 'phase00_5_impact_enumeration'
 *   phaseId='2', subPhaseId=null → 'phase02'
 *   both null → null
 *
 * Padding the phase number to 2 digits keeps lexical sort order matching
 * numerical phase order through Phase 10. The slug carries the
 * sub-phase identity verbatim — glob-friendly via `ls phase02_*` or
 * `ls phase02_fr_*` for a specific cluster.
 */
export function buildLogFilenamePrefix(
  phaseId: string | null,
  subPhaseId: string | null,
): string | null {
  if (!phaseId && !subPhaseId) return null;
  // Routed through the AODD canonicalization helper so the three ad-hoc
  // PhaseId stringifications across the codebase converge on one rule.
  // `phaseId` arrives typed as `string | null` from the Logger trace
  // context; at runtime it is always a valid PhaseId. The cast is
  // defensive only — phaseIdToFilenameSegment splits on '.' and pads
  // each component, which is a superset of valid PhaseId shapes.
  const phasePart = phaseId
    ? phaseIdToFilenameSegment(phaseId as PhaseId, { padded: true })
    : null;
  const subSafe = subPhaseId ? subPhaseIdToFilenameSegment(subPhaseId) : '';
  if (!phasePart) return `phase_${subSafe}`;
  if (!subSafe) return phasePart;
  return `${phasePart}_${subSafe}`;
}
