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
import type { GovernedStreamWriter } from '../orchestrator/governedStreamWriter';
import type { AgentRole, PhaseId } from '../types/records';
import { InvocationLogFile } from './invocationLogger';
import { resolveLlmTimeouts } from './llmTimeouts';
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

// ── Cache key ───────────────────────────────────────────────────────

export interface LLMCacheKeyInput {
  provider: string;
  model: string;
  responseFormat: string;
  temperature: number | null;
  maxTokens: number | null;
  system: string | null;
  prompt: string;
  tools: ToolDefinition[];
  toolChoice: LLMCallOptions['toolChoice'] | null;
}

/**
 * Canonical SHA-256 key for an LLM call, over the same fields
 * `writeInvocationRecord()` persists on the `agent_invocation` record. Shared
 * by the resume cache (`loadCacheFromDb`), the `call()` short-circuit, and the
 * DB-backed replay provider so all three agree on identity. Field order MUST
 * stay stable across releases — changing it invalidates every cached/replayed
 * entry.
 */
export function computeLLMCacheKey(opts: LLMCacheKeyInput): string {
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

// ── call() attempt machinery ────────────────────────────────────────

/** Per-attempt streaming budgets, resolved once per call(). */
interface AttemptBudgets {
  maxLogFileBytes: number;
  maxCallSeconds: number;
  maxRepeatedLine: number;
  maxNoProgressSeconds: number;
}

/** Discriminated result of a single provider attempt. */
type AttemptOutcome =
  | { kind: 'success'; result: LLMCallResult }
  | { kind: 'failure'; error: LLMError; retryAttempts: number };

/**
 * Shared per-call context threaded through the attempt/finalize/fail helpers:
 * the invocation id, the call start timestamp, the live log file, and the two
 * AODD trace overrides. Grouped so these helpers stay under the parameter cap.
 */
interface LlmCallContext {
  invocationId: string | null;
  startedAt: number;
  logFile: InvocationLogFile | null;
  traceSubPhaseId: string | undefined;
  traceAgentRole: AgentRole | null;
}

/**
 * Per-attempt abort machinery for a streaming LLM call — extracted from
 * call()'s retry loop so the streaming hot path and the timer/abort wiring
 * live in one cohesive, self-contained place. Owns:
 *   - the AbortController threaded into the provider,
 *   - a no-progress timer (re-armed on every chunk),
 *   - a wall-clock timer (outer last-resort cap),
 *   - the caller-supplied session-abort signal bridge,
 *   - the invocation-log byte cap and consecutive-line-repeat detectors.
 *
 * `abortReason` / `sessionAborted` are read by resolveAttemptError() after
 * the provider call rejects, exactly as the inline locals were. `cumulativeChars`
 * is read by handleStreamChunk() for the live-log writeChunk field. A fresh
 * guard is constructed per attempt so each retry starts with clean budgets
 * and line-repeat state.
 */
class StreamAbortGuard {
  readonly controller = new AbortController();
  abortReason: string | null = null;
  sessionAborted = false;
  cumulativeChars = 0;
  private noProgressHandle: NodeJS.Timeout | null = null;
  private readonly callTimeoutHandle: NodeJS.Timeout | null = null;
  private externalCleanup: (() => void) | null = null;
  private lineBuffer = '';
  private lastLine: string | null = null;
  private consecutiveLineCount = 0;
  private readonly bytesBaseline: number;

  constructor(
    private readonly budgets: AttemptBudgets,
    private readonly logFile: InvocationLogFile | null,
    externalSignal: AbortSignal | undefined,
  ) {
    // bytesBaseline captures the log-file size at attempt start so the
    // size-cap only measures THIS attempt's growth.
    this.bytesBaseline = logFile?.bytesWritten ?? 0;
    // Arm initially so a provider that never emits a single chunk (e.g. a
    // wedged socket before TTFB) still aborts.
    this.armNoProgressTimer();
    this.callTimeoutHandle = this.startWallClockTimer();
    this.attachExternalSignal(externalSignal);
  }

  // Shared by the no-progress and wall-clock timers: record the reason
  // (first-writer-wins) and abort the in-flight request.
  private timerAbort(reason: string): void {
    if (this.abortReason) return;
    this.abortReason = reason;
    if (!this.controller.signal.aborted) this.controller.abort();
  }

  // No-progress timer — re-armed on every streaming chunk; aborts when no
  // chunk has arrived for N seconds. Cleared/re-set here on each re-arm.
  armNoProgressTimer(): void {
    if (this.noProgressHandle) clearTimeout(this.noProgressHandle);
    if (this.budgets.maxNoProgressSeconds <= 0) return;
    this.noProgressHandle = setTimeout(
      () => this.timerAbort(
        `no-progress timeout (${this.budgets.maxNoProgressSeconds}s without a streaming chunk) — likely silent hang`,
      ),
      this.budgets.maxNoProgressSeconds * 1000,
    );
    this.noProgressHandle.unref?.();
  }

  // Wall-clock timer — outer safety cap for adversarial cases where a model
  // emits a chunk every N-1 seconds (resetting no-progress) and never converges.
  private startWallClockTimer(): NodeJS.Timeout | null {
    if (this.budgets.maxCallSeconds <= 0) return null;
    const handle = setTimeout(
      () => this.timerAbort(
        `invocation wall-clock exceeded (${this.budgets.maxCallSeconds}s this attempt) — likely silent hang`,
      ),
      this.budgets.maxCallSeconds * 1000,
    );
    // Don't keep the process alive on this timer if the run otherwise finishes.
    handle.unref?.();
    return handle;
  }

  // Union the caller-provided abort signal (session abort from
  // waitForQuiescence) with our internal one. Session abort is non-retryable.
  private attachExternalSignal(externalSignal: AbortSignal | undefined): void {
    if (!externalSignal) return;
    const external = externalSignal;
    const onExternalAbort = () => {
      this.sessionAborted = true;
      this.abortReason ??= 'session abort (external signal)';
      if (!this.controller.signal.aborted) this.controller.abort();
    };
    if (external.aborted) {
      onExternalAbort();
      return;
    }
    external.addEventListener('abort', onExternalAbort, { once: true });
    this.externalCleanup = () => external.removeEventListener('abort', onExternalAbort);
  }

  // Re-arm the no-progress timer and accumulate this chunk's char count —
  // any chunk counts as forward progress from the streaming socket.
  onChunkProgress(charCount: number): void {
    this.armNoProgressTimer();
    this.cumulativeChars += charCount;
  }

  // Invocation-log size cap — measured against THIS attempt's baseline so a
  // prior failed attempt's growth doesn't instantly re-trip the next one.
  checkByteCap(): void {
    if (this.abortReason || this.budgets.maxLogFileBytes <= 0 || !this.logFile) return;
    const attemptBytes = this.logFile.bytesWritten - this.bytesBaseline;
    if (attemptBytes > this.budgets.maxLogFileBytes) {
      this.abortReason = `invocation log size exceeded (${attemptBytes} > ${this.budgets.maxLogFileBytes} bytes this attempt) — likely runaway thinking`;
      this.controller.abort();
    }
  }

  // Consecutive-line-repetition detector — degenerate low-entropy loop guard.
  checkLineRepeat(chunkText: string): void {
    if (this.abortReason || this.budgets.maxRepeatedLine <= 0) return;
    const repeat = detectConsecutiveLineRepeat(
      { lineBuffer: this.lineBuffer, lastLine: this.lastLine, consecutiveLineCount: this.consecutiveLineCount },
      chunkText,
      this.budgets.maxRepeatedLine,
    );
    this.lineBuffer = repeat.lineBuffer;
    this.lastLine = repeat.lastLine;
    this.consecutiveLineCount = repeat.consecutiveLineCount;
    if (repeat.abortReason) {
      this.abortReason = repeat.abortReason;
      this.controller.abort();
    }
  }

  // Clear every timer/listener. Called in the attempt's finally block.
  cleanup(): void {
    this.externalCleanup?.();
    if (this.callTimeoutHandle) clearTimeout(this.callTimeoutHandle);
    if (this.noProgressHandle) clearTimeout(this.noProgressHandle);
  }
}

// ── LLMCaller ───────────────────────────────────────────────────────

export class LLMCaller {
  private readonly providers = new Map<string, LLMProviderAdapter>();
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
  private readonly llmCache = new Map<string, CachedLLMOutput>();

  constructor(private readonly config: LLMCallerConfig) {}

  /**
   * Compute the SHA256 cache key for a set of call options. Order of
   * fields here must stay stable across releases — changing it
   * invalidates every cached entry from prior runs. The hash inputs
   * mirror the agent_invocation.content fields persisted by
   * writeInvocationRecord() so loadCacheFromDb() can reconstruct the
   * exact same key from history.
   */
  private computeCacheKey(opts: LLMCacheKeyInput): string {
    return computeLLMCacheKey(opts);
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
        provider: (invContent.provider as string | null) ?? '',
        model: (invContent.model as string | null) ?? '',
        responseFormat: (invContent.response_format as string | null) ?? 'text',
        temperature: (invContent.temperature as number | null) ?? null,
        maxTokens: (invContent.max_tokens as number | null) ?? null,
        system: (invContent.system as string | null) ?? null,
        prompt: (invContent.prompt as string | null) ?? '',
        tools: (invContent.tools as ToolDefinition[] | undefined) ?? [],
        toolChoice: null,
      });

      let parsed: Record<string, unknown> | null = null;
      const text = (outContent.text as string | null) ?? '';
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
        provider: (outContent.provider as string | null) ?? (invContent.provider as string | null) ?? '',
        model: (outContent.model as string | null) ?? (invContent.model as string | null) ?? '',
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
    const cached = this.tryCacheHit(options);
    if (cached) return cached;

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

    // Transformation trace: the AODD steps for this call share an
    // `invocation_id` so the walk-back CLI can group them into one chain.
    // traceSubPhaseId / traceAgentRole are threaded into every emit below.
    const traceSubPhaseId = options.traceContext?.subPhaseId ?? undefined;
    const traceAgentRole = options.traceContext?.agentRole ?? null;
    this.emitCallStartAodd(options, invocationId, traceSubPhaseId, traceAgentRole);

    // Open the per-invocation live log (C8): writes the prompt header
    // immediately, appends chunks as they stream, and a trailer on
    // completion. See openLiveLog() for the filename-prefix (phase/sub-phase
    // glob) and raw-token-stream env-opt-in rationale.
    const logFile = this.openLiveLog(options, invocationId);

    // Emit llm:started so the ActivityStrip shows what is running. Plain
    // LLMCaller has no queue, so we don't emit llm:queued — started fires
    // the moment the call enters this method.
    const trace = options.traceContext;
    this.emitLlmStarted(options.provider, trace);

    try {
      // The retry loop, in-stream abort machinery, JSON-repair layers,
      // fallback provider, and terminal error path all live in
      // runWithRetryAndFallback() and its helpers (S3776 decomposition).
      return await this.runWithRetryAndFallback(
        adapter,
        options,
        invocationId,
        startedAt,
        logFile,
        traceSubPhaseId,
        traceAgentRole,
      );
    } finally {
      this._inFlightCount--;
      // Clear the invocation_id we set above so subsequent emits in the
      // same TraceCtx frame don't inherit a stale id.
      if (invocationId) setInvocation(null);
      this.emitLlmFinished(options.provider, trace, Date.now() - startedAt);
    }
  }

  // ── call() decomposition helpers ─────────────────────────────────

  /**
   * Cache short-circuit (resume optimization). Returns the cached result
   * when this exact prompt was already executed in a prior/current run, or
   * null when there is no hit (or the cache is empty). On a hit, emits
   * `llm.cache_hit` so the resumed session's audit trail stays complete.
   */
  private tryCacheHit(options: LLMCallOptions): LLMCallResult | null {
    if (this.llmCache.size === 0) return null;
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
    if (!cached) return null;
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

  /**
   * Emit the call-entry AODD steps: `prompt.materialized` (the finalized
   * prompt) and `llm.invoked` (the boundary just before the API call so
   * llm.returned / llm.failed can be paired with it on replay).
   */
  private emitCallStartAodd(
    options: LLMCallOptions,
    invocationId: string | null,
    traceSubPhaseId: string | undefined,
    traceAgentRole: AgentRole | null,
  ): void {
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
  }

  /**
   * Open the per-invocation live log (C8). Filename prefix encodes
   * phase / sub-phase so operators scanning .janumicode/live/ can glob a
   * given sub-phase (e.g. `phase06_1__*.log`); falls back to no prefix when
   * traceContext is absent. Raw-token-stream writing is opt-in via
   * JANUMICODE_LLM_LIVE_RAW_STREAM=1 (default off — cal-21 produced ~700 MB
   * of per-chunk lines; loop detection is unaffected because bytesWritten is
   * incremented in JS regardless of disk write).
   */
  private openLiveLog(
    options: LLMCallOptions,
    invocationId: string | null,
  ): InvocationLogFile | null {
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
    return logFile;
  }

  /** Emit `llm:started` so the ActivityStrip shows what is running. */
  private emitLlmStarted(provider: string, trace: LLMTraceContext | undefined): void {
    this.eventBus?.emit('llm:started', {
      provider,
      lane: 'phase',
      label: trace?.label ?? null,
      agentRole: trace?.agentRole ?? null,
      subPhaseId: trace?.subPhaseId ?? null,
    });
  }

  /** Emit `llm:finished` (in call()'s finally) so the strip leaves 'running'. */
  private emitLlmFinished(
    provider: string,
    trace: LLMTraceContext | undefined,
    durationMs: number,
  ): void {
    this.eventBus?.emit('llm:finished', {
      provider,
      lane: 'phase',
      durationMs,
      label: trace?.label ?? null,
      agentRole: trace?.agentRole ?? null,
      subPhaseId: trace?.subPhaseId ?? null,
    });
  }

  /**
   * Resolve the per-attempt streaming budgets once per call(). See the
   * StreamAbortGuard docs and llmTimeouts.ts for the tuning rationale
   * behind each knob (byte cap = runaway-thinking; wall-clock = adversarial
   * pauses; repeated-line = degenerate loop; no-progress = silent hang).
   */
  private resolveAttemptBudgets(options: LLMCallOptions): AttemptBudgets {
    const maxLogFileBytes = Number.parseInt(
      process.env.JANUMICODE_LLM_MAX_LOG_FILE_BYTES ?? '1572864', 10);
    const llmTimeouts = resolveLlmTimeouts(options.provider, options.model);
    const maxRepeatedLine = Number.parseInt(
      process.env.JANUMICODE_LLM_MAX_REPEATED_LINE ?? '30', 10);
    return {
      maxLogFileBytes,
      maxCallSeconds: llmTimeouts.maxCallSeconds,
      maxRepeatedLine,
      maxNoProgressSeconds: llmTimeouts.noProgressSeconds,
    };
  }

  /**
   * Drive the primary provider with retries, then the fallback provider, then
   * the terminal error path. Returns the successful result or throws the last
   * error (writing the terminal error record + AODD llm.failed first).
   */
  private async runWithRetryAndFallback(
    adapter: LLMProviderAdapter,
    options: LLMCallOptions,
    invocationId: string | null,
    startedAt: number,
    logFile: InvocationLogFile | null,
    traceSubPhaseId: string | undefined,
    traceAgentRole: AgentRole | null,
  ): Promise<LLMCallResult> {
    const budgets = this.resolveAttemptBudgets(options);
    // Shared chunk-sequence counter — persists across attempts AND the
    // fallback so llm:stream_chunk sequence numbers stay monotonic.
    const seqRef = { value: 0 };
    let lastError: LLMError | null = null;
    let retryAttempts = 0;
    const callContext: LlmCallContext = {
      invocationId, startedAt, logFile, traceSubPhaseId, traceAgentRole,
    };

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      const outcome = await this.runSingleAttempt(
        adapter, options, budgets, seqRef, retryAttempts, callContext,
      );
      if (outcome.kind === 'success') return outcome.result;
      retryAttempts = outcome.retryAttempts;
      lastError = outcome.error;
      if (!this.isRetryable(lastError)) break;
      await this.backoffBeforeRetry(
        lastError, attempt, retryAttempts, invocationId, traceSubPhaseId, traceAgentRole,
      );
    }

    const fallbackResult = await this.tryFallbackProvider(
      options, invocationId, startedAt, retryAttempts, seqRef,
    );
    if (fallbackResult) return fallbackResult;

    return this.failCall(
      options, retryAttempts, lastError, callContext,
    );
  }

  /**
   * Execute one provider attempt: build the streaming options (wiring the
   * per-attempt StreamAbortGuard's timers + in-stream detectors), call the
   * adapter, run the JSON recoveries + success finalization, and translate
   * a rejection into a classified {failure} outcome. The guard's timers are
   * always cleared in the finally.
   */
  private async runSingleAttempt(
    adapter: LLMProviderAdapter,
    options: LLMCallOptions,
    budgets: AttemptBudgets,
    seqRef: { value: number },
    retryAttempts: number,
    ctx: LlmCallContext,
  ): Promise<AttemptOutcome> {
    const { invocationId, startedAt, logFile, traceSubPhaseId, traceAgentRole } = ctx;
    const guard = new StreamAbortGuard(budgets, logFile, options.abortSignal);
    const streamingOptions: LLMStreamingCallOptions = {
      ...options,
      abortSignal: guard.controller.signal,
      onChunk: (chunk) => this.handleStreamChunk(
        chunk, guard, invocationId, options, startedAt, logFile, seqRef,
      ),
    };
    try {
      const result = await adapter.call(streamingOptions);
      result.retryAttempts = retryAttempts;
      await this.applyJsonRecoveries(options, result, invocationId, traceSubPhaseId, traceAgentRole);
      const finalized = await this.finalizeSuccess(
        options, result, retryAttempts, ctx,
      );
      return { kind: 'success', result: finalized };
    } catch (err) {
      const error = this.resolveAttemptError(err, guard.abortReason, guard.sessionAborted);
      return { kind: 'failure', error, retryAttempts: retryAttempts + 1 };
    } finally {
      guard.cleanup();
    }
  }

  /**
   * Streaming hot path for one chunk: re-arm the no-progress timer + tally
   * chars (via the guard), append to the live log, forward the chunk as an
   * event, then run the byte-cap and consecutive-line-repeat detectors.
   * Order matches the original inline callback exactly.
   */
  private handleStreamChunk(
    chunk: LLMStreamChunk,
    guard: StreamAbortGuard,
    invocationId: string | null,
    options: LLMCallOptions,
    startedAt: number,
    logFile: InvocationLogFile | null,
    seqRef: { value: number },
  ): void {
    guard.onChunkProgress(chunk.text.length);
    logFile?.writeChunk({
      channel: chunk.channel,
      msSinceStart: Date.now() - startedAt,
      cumulativeChars: guard.cumulativeChars,
      text: chunk.text,
    });
    this.writeOutputChunk(invocationId, options, chunk, seqRef.value++);
    guard.checkByteCap();
    guard.checkLineRepeat(chunk.text);
  }

  /**
   * Run the three JSON-recovery layers in order, each a no-op unless its
   * precondition holds: 2a deterministic structural, 2b LLM repair, 2c
   * thinking-channel recovery. Each mutates result.parsed in place, so a
   * layer that recovers short-circuits the later layers' `!result.parsed`
   * guards.
   */
  private async applyJsonRecoveries(
    options: LLMCallOptions,
    result: LLMCallResult,
    invocationId: string | null,
    traceSubPhaseId: string | undefined,
    traceAgentRole: AgentRole | null,
  ): Promise<void> {
    await this.recoverJsonStructurally(options, result, invocationId, traceSubPhaseId, traceAgentRole);
    await this.recoverJsonViaRepair(options, result, invocationId, traceSubPhaseId, traceAgentRole);
    await this.recoverJsonFromThinking(options, result, invocationId, traceSubPhaseId, traceAgentRole);
  }

  /**
   * Layer 2a — DETERMINISTIC structural recovery. Cheap brace/bracket
   * balancing + trailing-comma stripping (`tryParseJson`) before the
   * expensive LLM repair. Salvages the model's REAL content without an extra
   * round-trip or semantic-drift risk. Skipped for json_repair /
   * reasoning_review calls.
   */
  private async recoverJsonStructurally(
    options: LLMCallOptions,
    result: LLMCallResult,
    invocationId: string | null,
    traceSubPhaseId: string | undefined,
    traceAgentRole: AgentRole | null,
  ): Promise<void> {
    if (!(
      options.responseFormat === 'json' &&
      !result.parsed &&
      typeof result.text === 'string' &&
      result.text.trim().length > 0 &&
      options.traceContext?.agentRole !== 'json_repair' &&
      options.traceContext?.agentRole !== 'reasoning_review'
    )) return;
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

  /**
   * Layer 2b — LLM-based JSON repair. Hands the broken text to a dedicated
   * repair sequence (primary → fallback), grounded by the original prompt +
   * system + thinking chain. Sequential by design (single-GPU host). Always
   * writes a json_repair_record. Skipped for json_repair / reasoning_review
   * calls, and when no repair routing is configured.
   */
  private async recoverJsonViaRepair(
    options: LLMCallOptions,
    result: LLMCallResult,
    invocationId: string | null,
    traceSubPhaseId: string | undefined,
    traceAgentRole: AgentRole | null,
  ): Promise<void> {
    const routing = this.jsonRepairRouting;
    if (!(
      options.responseFormat === 'json' &&
      !result.parsed &&
      typeof result.text === 'string' &&
      result.text.trim().length > 0 &&
      routing &&
      options.traceContext?.agentRole !== 'json_repair' &&
      options.traceContext?.agentRole !== 'reasoning_review'
    )) return;
    const { repairJsonViaLLM } = await import('./jsonRepairLLM.js');
    const repair = await repairJsonViaLLM(
      result.text,
      routing,
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
    // Always write a json_repair_record so the operator can see exactly what
    // was attempted (and what each attempt returned) — useful even on success.
    this.writeJsonRepairRecord(invocationId, options, repair);
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

  /**
   * Layer 2c — THINKING-CHANNEL recovery. Some thinking-mode models emit
   * their ENTIRE answer into the THINKING channel and leave the response
   * channel EMPTY, so layers 2a/2b (which require non-empty text) never fire.
   * Hand the thinking to the SAME json_repair sequence in reasoning-channel
   * mode, grounded by the original prompt + schema — no re-generation. The
   * repair model's `_repair_error` sentinel is rejected so it can never
   * masquerade as the real parsed answer. See
   * project_gemma4_31b_decomposition_divergence.
   */
  private async recoverJsonFromThinking(
    options: LLMCallOptions,
    result: LLMCallResult,
    invocationId: string | null,
    traceSubPhaseId: string | undefined,
    traceAgentRole: AgentRole | null,
  ): Promise<void> {
    const routing = this.jsonRepairRouting;
    const thinkingText = result.thinking;
    if (!(
      options.responseFormat === 'json' &&
      !result.parsed &&
      (typeof result.text !== 'string' || result.text.trim().length === 0) &&
      typeof thinkingText === 'string' &&
      thinkingText.trim().length > 0 &&
      routing &&
      options.traceContext?.agentRole !== 'json_repair' &&
      options.traceContext?.agentRole !== 'reasoning_review'
    )) return;
    const { repairJsonViaLLM } = await import('./jsonRepairLLM.js');
    const recovery = await repairJsonViaLLM(
      thinkingText,
      routing,
      {
        originalPrompt: options.prompt,
        originalSystem: options.system ?? null,
        // brokenText already IS the thinking — don't duplicate it into the
        // grounding "ORIGINAL AGENT REASONING" section.
        originalThinking: null,
        originalAgentRole: options.traceContext?.agentRole ?? null,
        expectedJsonSchema: options.expectedJsonSchema ?? null,
        inputIsReasoningChannel: true,
      },
      {
        workflowRunId: options.traceContext?.workflowRunId ?? '',
        phaseId: options.traceContext?.phaseId ?? null,
        subPhaseId: options.traceContext?.subPhaseId ?? null,
      },
      this,
    );
    const recovered =
      recovery.parsed &&
      typeof recovery.parsed === 'object' &&
      !('_repair_error' in recovery.parsed)
        ? recovery.parsed
        : null;
    if (recovered) {
      result.parsed = recovered;
    }
    this.writeJsonRepairRecord(invocationId, options, recovery);
    aoddEmit(
      recovered ? 'repair.json_succeeded' : 'repair.json_failed',
      recovered
        ? { strategy: 'thinking_channel_recovery', repaired: maybeSpillText(JSON.stringify(recovered)) }
        : { strategy: 'thinking_channel_recovery', error: { message: 'thinking did not contain a recoverable answer' } },
      {
        invocation_id: invocationId ?? undefined,
        sub_phase_id_override: traceSubPhaseId,
        agent_role: 'json_repair',
      },
    );
  }

  /**
   * Finalize a successful attempt: write the agent_output (+ tool_call)
   * records, the live-log success trailer, the `llm.returned` AODD emit,
   * populate the in-session cache, and fire the reasoning-review hook. Returns
   * the same result object (with any repaired parsed value already applied).
   */
  private async finalizeSuccess(
    options: LLMCallOptions,
    result: LLMCallResult,
    retryAttempts: number,
    ctx: LlmCallContext,
  ): Promise<LLMCallResult> {
    const { invocationId, startedAt, logFile, traceSubPhaseId, traceAgentRole } = ctx;
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
    this.cacheSuccessfulResult(invocationId, options, result);
    await this.runReviewerHook(invocationId, agentOutputId, options, result);
    return result;
  }

  /**
   * Populate the in-memory cache so within-session repeats of the same prompt
   * (and any future resume of THIS run) short-circuit. Only successful calls
   * are cached — error results would mask provider recovery. No-op without an
   * invocationId (instrumentation disabled).
   */
  private cacheSuccessfulResult(
    invocationId: string | null,
    options: LLMCallOptions,
    result: LLMCallResult,
  ): void {
    if (!invocationId) return;
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

  /**
   * Classify a failed attempt into an LLMError. An in-stream abort
   * (guard.abortReason set) overrides the provider's error: byte-cap /
   * wall-clock / degenerate-loop / no-progress → runaway_thinking (retryable),
   * anything else → context_exceeded; a session abort → unknown +
   * non-retryable. Otherwise pass through the provider's LLMError, or wrap a
   * non-LLMError.
   */
  private resolveAttemptError(
    err: unknown,
    abortReason: string | null,
    sessionAborted: boolean,
  ): LLMError {
    if (abortReason) {
      const reason = abortReason;
      const isRunawayThinking =
        reason.includes('invocation log size exceeded') ||
        reason.includes('invocation wall-clock exceeded') ||
        reason.includes('degenerate loop detected') ||
        reason.includes('no-progress timeout');
      const abortErrorType: LLMErrorType = isRunawayThinking
        ? 'runaway_thinking'
        : 'context_exceeded';
      const errorType: LLMErrorType = sessionAborted ? 'unknown' : abortErrorType;
      return new LLMError(
        `LLM stream aborted: ${abortReason}`,
        errorType,
        undefined,
        !sessionAborted,
      );
    }
    if (err instanceof LLMError) return err;
    const msg = err instanceof Error ? err.message : String(err);
    return new LLMError(msg, 'unknown');
  }

  /**
   * Backoff + AODD retry emits between attempts: `retry.scheduled`, then the
   * (optional) sleep, then `retry.attempted`.
   */
  private async backoffBeforeRetry(
    lastError: LLMError,
    attempt: number,
    retryAttempts: number,
    invocationId: string | null,
    traceSubPhaseId: string | undefined,
    traceAgentRole: AgentRole | null,
  ): Promise<void> {
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
  }

  /**
   * Try the configured fallback provider once (no retries). Returns the
   * successful result (usedFallback=true, records + review hook written) or
   * null when there is no fallback, it isn't registered, or it also fails —
   * in which case the caller throws the primary error.
   */
  private async tryFallbackProvider(
    options: LLMCallOptions,
    invocationId: string | null,
    startedAt: number,
    retryAttempts: number,
    seqRef: { value: number },
  ): Promise<LLMCallResult | null> {
    if (!this.config.fallback) return null;
    const fallbackAdapter = this.providers.get(this.config.fallback.provider);
    if (!fallbackAdapter) return null;
    try {
      const fallbackOptions: LLMStreamingCallOptions = {
        ...options,
        provider: this.config.fallback.provider,
        model: this.config.fallback.model,
        onChunk: (chunk) => {
          this.writeOutputChunk(invocationId, options, chunk, seqRef.value++);
        },
      };
      const result = await fallbackAdapter.call(fallbackOptions);
      result.usedFallback = true;
      result.retryAttempts = retryAttempts;
      const { agentOutputId } = this.writeOutputRecords(invocationId, fallbackOptions, result, Date.now() - startedAt, null);
      await this.runReviewerHook(invocationId, agentOutputId, fallbackOptions, result);
      return result;
    } catch {
      // Fallback also failed — signal the caller to throw the primary error.
      return null;
    }
  }

  /**
   * Terminal error path: all retries + fallback exhausted. Writes the final
   * error output record (so the AgentInvocationCard flips running → error),
   * the live-log error trailer, and the terminal `llm.failed` AODD emit, then
   * throws the last error.
   */
  private failCall(
    options: LLMCallOptions,
    retryAttempts: number,
    lastError: LLMError | null,
    ctx: LlmCallContext,
  ): never {
    const { invocationId, startedAt, logFile, traceSubPhaseId, traceAgentRole } = ctx;
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

/**
 * Per-attempt state for the consecutive-line-repetition detector.
 * `lineBuffer` accumulates the tail of a chunk that has no trailing
 * newline yet; `lastLine` / `consecutiveLineCount` track the current
 * back-to-back run of an identical non-trivial line.
 */
export interface LineRepeatState {
  lineBuffer: string;
  lastLine: string | null;
  consecutiveLineCount: number;
}

/**
 * Truncate a matched line for the abort-reason preview: at most 60 chars
 * followed by an ellipsis when longer.
 */
function truncateLinePreview(line: string): string {
  return line.length > 60 ? line.slice(0, 60) + '…' : line;
}

/**
 * Consecutive-line-repetition detector — extracted from call()'s onChunk
 * callback so the streaming hot path stays flat. Appends `chunkText` to the
 * running `lineBuffer`, peels off every complete line, and counts identical
 * non-trivial (>= 8 trimmed chars) lines that appear back-to-back. When a
 * line crosses `maxRepeatedLine` consecutive occurrences the model is stuck
 * in a low-entropy attractor, so an `abortReason` string is returned (the
 * caller fires the AbortController).
 *
 * Behaviour is identical to the original inline loop: the 8-char floor, the
 * consecutive-only counting (the run resets to 1 when a different >= 8-char
 * line appears), and early-exit on the FIRST threshold crossing — the
 * returned `lineBuffer` / `lastLine` / `consecutiveLineCount` reflect the
 * exact state the inline `break` left behind. See project_gemma4_31b and the
 * cal-27 pathology comment at the call site for rationale.
 */
export function detectConsecutiveLineRepeat(
  state: LineRepeatState,
  chunkText: string,
  maxRepeatedLine: number,
): LineRepeatState & { abortReason: string | null } {
  let { lineBuffer, lastLine, consecutiveLineCount } = state;
  lineBuffer += chunkText;
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
        const preview = truncateLinePreview(line);
        return {
          lineBuffer,
          lastLine,
          consecutiveLineCount,
          abortReason: `degenerate loop detected (line repeated ${consecutiveLineCount}× consecutively this attempt): "${preview}"`,
        };
      }
    }
    nl = lineBuffer.indexOf('\n');
  }
  return { lineBuffer, lastLine, consecutiveLineCount, abortReason: null };
}
