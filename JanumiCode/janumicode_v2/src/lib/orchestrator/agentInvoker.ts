/**
 * AgentInvoker — routes invocations to CLIInvoker or LLMCaller.
 * Based on JanumiCode Spec v2.3, §7.8.
 *
 * CLI-backed agents: spawns child process via CLIInvoker.
 * Direct LLM API agents: calls LLMCaller directly.
 */

import { CLIInvoker, type CLIInvocationResult } from '../cli/cliInvoker';
import { selectExecutorAdapter } from '../cli/session/capabilityRegistry';
import type { ExecutorTaskOutcome } from '../cli/session/adapter';
import type { ResponderInput, SessionResponder } from '../cli/session/responder';
import { type OutputParser } from '../cli/outputParser';
import { LLMCaller, type LLMCallOptions, type LLMCallResult } from '../llm/llmCaller';
import { InvocationLogFile } from '../llm/invocationLogger';
import { buildLogFilenamePrefix } from '../llm/llmCaller';
import type { GovernedStreamWriter } from './governedStreamWriter';
import type { AgentRole, PhaseId } from '../types/records';
import { getLogger } from '../logging';
import { emit as aoddEmit } from '../aodd';
import { setInvocation } from '../trace/traceContext';

export interface CLITraceContext {
  workflowRunId: string;
  phaseId?: PhaseId | null;
  subPhaseId?: string | null;
  agentRole?: AgentRole | null;
  /** Human-readable label for the invocation card header. */
  label?: string;
  /** Phase 9 task identifier — surfaced into the agent_invocation
   *  record's `task_id` field so trace consumers can correlate across
   *  task boundaries. */
  taskId?: string;
}

/** Routing for the session-responder LLM (llm_routing.session_responder). */
export interface SessionResponderRoute {
  provider: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * The responder is the OPERATOR persona: it answers on behalf of the human
 * the TUI thinks it is talking to. Spec-grounded, decisive, never reflective
 * — a question back, a hedge, or a stop instruction from this seat stalls
 * the session it exists to unstall. Output constraints mirror what the
 * adapter's sanitizer enforces (one line, no slash commands, no completion
 * sentinel) so well-behaved replies pass through unmodified.
 */
const SESSION_RESPONDER_SYSTEM =
  'You are the operator supervising an automated coding agent that is working in an interactive terminal session. '
  + 'The agent has paused and is waiting for your input. The task specification is the source of truth. '
  + 'Rules: answer concrete questions concretely using the specification (answer EVERY question if several are numbered); '
  + 'when the specification is silent, make the most reasonable conventional choice and state it as a firm decision; '
  + 'only reference file paths and module names that appear in the task specification or in the agent\'s own output — never introduce new paths; '
  + 'keep every file instruction inside the write scope the specification states for this task; '
  + 'never ask the agent a question back; never tell it to stop or wait; never include slash commands; '
  + 'never write the phrase TASK COMPLETE. '
  + 'Reply with plain text only — a few sentences at most, formatted as a single line (no line breaks).';

/** The ask comes FIRST (a reader — human or model — should not have to scroll
 *  16KB of spec to learn what is being asked), and the reply instruction is
 *  restated at the end after the grounding context. */
function renderSessionResponderPrompt(input: ResponderInput): string {
  const ask = input.kind === 'question'
    ? '## The agent asked\n' + (input.question || '(see the end of its recent output below)')
    : '## The agent stopped without finishing the task\n'
      + 'Its turn ended mid-work — see its recent output below.';
  const reply = input.kind === 'question'
    ? '## Reply with the operator answer that unblocks it (one line):'
    : '## Reply with a one-line continuation instruction telling it specifically what to do next to finish:';
  return ask
    + '\n\n## Task specification\n' + clipSpec(input.taskSpec)
    + '\n\n## Recent agent output (tail)\n' + (input.agentContext || '(none)')
    + '\n\n' + reply;
}

/** Keep the responder call small: head + tail of long specs (completion
 *  criteria conventionally sit at the end; identity/scope at the start). */
function clipSpec(spec: string, maxChars = 16_000): string {
  if (spec.length <= maxChars) return spec;
  const head = Math.floor(maxChars * 0.7);
  const tail = maxChars - head;
  return spec.slice(0, head) + '\n…[specification clipped]…\n' + spec.slice(-tail);
}

// ── Types ───────────────────────────────────────────────────────────

export type BackingTool =
  | 'mimo_cli'
  | 'claude_code_cli'
  | 'gemini_cli'
  | 'goose_cli'
  | 'codex_cli'
  | 'direct_llm_api';

export interface AgentInvocationOptions {
  /** Agent role name */
  agentRole: string;
  /** Backing tool type */
  backingTool: BackingTool;
  /** Invocation ID for tracking */
  invocationId: string;
  /** Stdin content (CLI agents) or prompt (LLM API agents) */
  prompt: string;
  /** System prompt (LLM API agents) */
  system?: string;
  /** Working directory (CLI agents) */
  cwd: string;
  /** Environment variables (CLI agents) */
  env?: Record<string, string>;
  /** LLM provider (direct_llm_api only) */
  provider?: string;
  /** LLM model (direct_llm_api only) */
  model?: string;
  /** Response format */
  responseFormat?: 'json' | 'text';
  /** Temperature */
  temperature?: number;
  /**
   * When true, invoke the CLI in fully-unattended mode (e.g.
   * Claude Code's `--dangerously-skip-permissions`). For roles like
   * Phase 9's executor in calibration runs, where the agent must
   * be able to run Bash to verify its own work and there is no human
   * in the loop to approve permission requests. Production CLI / VS
   * Code use cases leave this false so permission prompts surface to
   * the human as designed.
   *
   * Calibration runners flip this on per-invocation rather than
   * relying on the existing process-wide JANUMICODE_CLAUDE_SKIP_PERMISSIONS
   * env var so the policy is explicit at each call site rather than
   * a hidden global.
   */
  unattendedSkipPermissions?: boolean;
  /**
   * Optional trace context. When provided together with an attached
   * writer (see setWriter), invokeCLI() writes a full agent_invocation
   * record on entry (capturing the exact command + args + stdin + cwd),
   * streams each stdout/stderr chunk as an agent_output_chunk record,
   * and writes a final agent_output record on exit. Matches the
   * instrumentation the LLMCaller does for direct API calls.
   */
  traceContext?: CLITraceContext;
}

export interface AgentInvocationResult {
  /** Whether the invocation succeeded */
  success: boolean;
  /** CLI result (CLI-backed agents) */
  cliResult?: CLIInvocationResult;
  /** LLM result (direct LLM API agents) */
  llmResult?: LLMCallResult;
  /** Error message if failed */
  error?: string;
}

// ── AgentInvoker ────────────────────────────────────────────────────

export class AgentInvoker {
  private readonly cliInvoker = new CLIInvoker();
  private readonly outputParsers = new Map<string, OutputParser>();
  private writer: GovernedStreamWriter | null = null;
  private versionSha = 'dev';
  private eventBus: import('../events/eventBus').EventBus | null = null;
  private liveLogDir: string | null = null;
  private sessionResponderRoute: SessionResponderRoute | null = null;

  constructor(
    private readonly llmCaller: LLMCaller,
    private readonly cliConfig: {
      timeoutSeconds: number;
      idleTimeoutSeconds: number;
      noContentTimeoutSeconds: number;
      bufferMaxEvents: number;
    },
  ) {}

  /**
   * Attach a GovernedStreamWriter so invokeCLI() can write
   * agent_invocation / agent_output records for every subprocess-backed
   * agent, matching what LLMCaller already writes for API-backed ones.
   * Optional: when no writer is attached, instrumentation is silently
   * skipped. Streaming chunks are routed via the EventBus instead of the
   * writer (see setEventBus).
   */
  setWriter(writer: GovernedStreamWriter, versionSha: string): void {
    this.writer = writer;
    this.versionSha = versionSha;
  }

  /**
   * Attach an EventBus so live stdout/stderr from CLI invocations can be
   * streamed to the webview as `llm:stream_chunk` events without bloating
   * the governed_stream table.
   */
  setEventBus(eventBus: import('../events/eventBus').EventBus): void {
    this.eventBus = eventBus;
  }

  /**
   * Configure the per-invocation live log directory for CLI invocations.
   * Mirrors LLMCaller.setLiveLogDir so CLI calls (Goose, Claude Code,
   * Gemini, Codex) write a tailable `.log` file under
   * `<dir>/<phase>_<sub>__<invocation>.log` containing the full stdin
   * sent to the subprocess, streaming stdout/stderr, and a trailer
   * with final text + reasoning chain. Optional — when unset, no
   * live log file is written.
   */
  setLiveLogDir(dir: string | null): void {
    this.liveLogDir = dir;
  }

  /**
   * Configure the SESSION RESPONDER — the LLM that plays the human side of
   * an interactive executor session (answers the coding agent's clarifying
   * questions FROM THE TASK SPEC, composes contextual continuation nudges).
   * Read from `llm_routing.session_responder` by the engine. When unset,
   * interactive adapters fall back to their canned responses.
   */
  setSessionResponderRoute(route: SessionResponderRoute | null): void {
    this.sessionResponderRoute = route;
  }

  /**
   * Build the responder closure handed to the interactive executor adapter.
   * Lives here (not the session layer) because this is where LLMCaller +
   * routing + trace context meet. Every Q→A pair is a real llmCaller.call,
   * so it lands in the governed stream as a session_responder
   * agent_invocation/agent_output pair — reviewable after the run.
   * Returns null inside the closure on any failure so the adapter degrades
   * to canned responses instead of stalling the session.
   */
  private buildSessionResponder(options: AgentInvocationOptions): SessionResponder | undefined {
    const route = this.sessionResponderRoute;
    if (!route) return undefined;
    const trace = options.traceContext;
    return async (input: ResponderInput) => {
      try {
        const result = await this.llmCaller.call({
          provider: route.provider,
          model: route.model,
          baseUrl: route.baseUrl,
          system: SESSION_RESPONDER_SYSTEM,
          prompt: renderSessionResponderPrompt(input),
          responseFormat: 'text',
          temperature: route.temperature ?? 0.2,
          maxTokens: route.maxTokens ?? 600,
          traceContext: trace
            ? {
                workflowRunId: trace.workflowRunId,
                phaseId: trace.phaseId ?? null,
                subPhaseId: trace.subPhaseId ?? null,
                agentRole: 'session_responder',
                // Kind in the label: a log reader must be able to tell a
                // nudge (no question existed) from a question-answer without
                // scrolling the prompt (live confusion, slice-142 review).
                label: (trace.label ?? 'executor session') + ' — responder (' + input.kind + ')',
              }
            : undefined,
        });
        return result.text?.trim() || null;
      } catch (err) {
        getLogger().warn('workflow', 'session responder call failed — using canned fallback', {
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      }
    };
  }

  /**
   * Register an output parser for a backing tool.
   */
  registerOutputParser(backingTool: string, parser: OutputParser): void {
    this.outputParsers.set(backingTool, parser);
  }

  /**
   * Enumerate the backing tools that have an output parser registered.
   * Used by validateLLMRouting to verify that a role configured with a
   * CLI backing has the parser it'll need at invocation time.
   */
  getRegisteredBackingTools(): string[] {
    return Array.from(this.outputParsers.keys());
  }

  /**
   * Invoke an agent.
   */
  async invoke(options: AgentInvocationOptions): Promise<AgentInvocationResult> {
    if (options.backingTool === 'direct_llm_api') {
      return this.invokeLLM(options);
    }
    return this.invokeCLI(options);
  }

  private async invokeCLI(options: AgentInvocationOptions): Promise<AgentInvocationResult> {
    const parser = this.outputParsers.get(options.backingTool);
    if (!parser) {
      return {
        success: false,
        error: `No output parser registered for backing tool: ${options.backingTool}`,
      };
    }

    parser.reset();

    const { command, args } = this.buildCLICommand(options);

    if (options.backingTool === 'goose_cli') {
      // Goose only surfaces model reasoning when asked (env-driven, no CLI
      // flag), and its random "thinking…" spinner phrases are noise in
      // captured streams. Applied to BOTH goose paths — this env flows to
      // the structured `goose run` spawn and to the interactive TUI
      // adapter (req.env) below. options.env spreads last so callers can
      // still override either var per invocation.
      options = {
        ...options,
        env: {
          GOOSE_CLI_SHOW_THINKING: 'true',
          GOOSE_RANDOM_THINKING_MESSAGES: 'false',
          ...options.env,
        },
      };
    }

    // Persist the invocation envelope up front. Captures the EXACT command
    // line, arguments, stdin, cwd, and env we're about to run — so the
    // AgentInvocationCard can show "Gemini CLI: gemini --prompt ..." and
    // the user can see what was actually fed to the subprocess, not just
    // what the agent role was.
    const invocationRecordId = this.writeCLIInvocationRecord(options, command, args);
    const startedAt = Date.now();
    let chunkSequence = 0;
    let cumulativeChars = 0;
    // Publish the active invocation_id into TraceCtx so any AODD event
    // fired during this CLI invocation (log.*, record.*, etc.) carries
    // it in the envelope. Cleared in the finally below.
    if (invocationRecordId) setInvocation(invocationRecordId);

    // (executor dispatch + agent invocation events are emitted by
    // executorAgent.ts as agent.invocation_started/completed AODD events.
    // Earlier this layer fired duplicate lifecycle events; with the
    // legacy lifecycle stream retired, the upstream pair is the
    // canonical surface.)
    const traceSubPhaseId = options.traceContext?.subPhaseId ?? undefined;
    const traceAgentRole = options.traceContext?.agentRole ?? null;

    // Open the per-invocation live log (parity with LLMCaller). Writes
    // a header carrying the full stdin upfront, appends chunks as they
    // stream, and writes a trailer on completion with final text +
    // reasoning. Lets `tail -f .janumicode/live/<id>.log` show live CLI
    // progress without waiting on DB commits.
    const ctx = options.traceContext;
    const filenamePrefix = buildLogFilenamePrefix(
      ctx?.phaseId ?? null,
      ctx?.subPhaseId ?? null,
    );
    const writeRawTokenStream = process.env.JANUMICODE_LLM_LIVE_RAW_STREAM === '1';
    const logFile = invocationRecordId && this.liveLogDir
      ? new InvocationLogFile(this.liveLogDir, invocationRecordId, {
          filenamePrefix,
          writeRawTokenStream,
        })
      : null;
    if (logFile) {
      logFile.writeHeader({
        invocationId: invocationRecordId!,
        provider: options.backingTool,
        model: options.model ?? options.backingTool,
        agentRole: ctx?.agentRole ?? null,
        phaseId: ctx?.phaseId ?? null,
        subPhaseId: ctx?.subPhaseId ?? null,
        label: ctx?.label ?? this.backingToolDisplayName(options.backingTool),
        prompt: options.prompt,
        system: options.system ?? null,
        startedAt: new Date().toISOString(),
      });
    }

    // Emit llm:started so the ActivityStrip / live monitor sees the CLI
    // invocation the same way it sees direct LLM calls. Mirrors
    // LLMCaller.call(). `provider` carries the backing tool name so
    // operators can tell the lane apart.
    this.eventBus?.emit('llm:started', {
      provider: options.backingTool,
      lane: 'phase',
      label: ctx?.label ?? null,
      agentRole: ctx?.agentRole ?? null,
      subPhaseId: ctx?.subPhaseId ?? null,
    });

    // ── Executor adapter selection (M4) ──────────────────────────────
    // For Phase-9 executor tasks the DEFAULT is the highest interactive tier
    // the CLI supports — the mandatory filesystem research→plan→implement step
    // is TUI-resident (phases 1–8 are FS-blind). The structured one-shot path
    // (below) is the fallback when the CLI has no interactive adapter or the
    // PTY substrate (node-pty) is unavailable. Live chunks from the session are
    // forwarded into the same output-chunk + live-log plumbing.
    const interactiveSel = options.agentRole === 'executor_agent'
      ? selectExecutorAdapter(options.backingTool, {
          cwd: options.cwd,
          env: options.env,
          responder: this.buildSessionResponder(options),
          onLog: (e) => {
            if (e.kind !== 'data') return;
            cumulativeChars += e.chunk.length;
            logFile?.writeChunk({ channel: 'stdout', msSinceStart: Date.now() - startedAt, cumulativeChars, text: e.chunk });
            this.writeCLIOutputChunk(invocationRecordId, options, 'stdout', e.chunk, chunkSequence++);
          },
        })
      : { adapter: null, fallbackReason: 'no_interactive_adapter' as const };
    if (interactiveSel.adapter) {
      getLogger().info('workflow', 'executor: routing through interactive TUI session adapter', {
        backing_tool: options.backingTool,
      });
    } else if (options.agentRole === 'executor_agent' && interactiveSel.fallbackReason === 'pty_unavailable') {
      getLogger().warn('workflow', 'executor: node-pty unavailable — falling back to one-shot structured executor (run `npm install node-pty` for interactive research→plan→implement)', {
        backing_tool: options.backingTool,
      });
    }

    try {
      let result: CLIInvocationResult;
      let finalText: string;
      let reasoningText = '';

      if (interactiveSel.adapter) {
        // Tier-2/3 interactive session (PTY). The adapter spawns + drives the
        // CLI's own plan/research mode and returns the settled outcome.
        const outcome = await interactiveSel.adapter.run({
          command,
          args,
          cwd: options.cwd,
          prompt: options.prompt,
          // Write the task spec at the PROJECT ROOT (the agent's own cwd).
          // Weak interactive models anchor their writes on the spec file's
          // directory rather than the PTY cwd (slice-149: gemma created
          // `<specDir>/implementations/...`). Putting the spec at the project
          // root keeps the agent's anchored writes INSIDE the sandbox and
          // aligned with where the gates expect the dependency manifest — and
          // never under `.janumicode` (control plane or otherwise).
          taskSpecDir: options.cwd,
          env: options.env,
          timeoutSeconds: this.cliConfig.timeoutSeconds,
          idleTimeoutSeconds: this.cliConfig.idleTimeoutSeconds,
        });
        result = adaptOutcomeToCliResult(outcome);
        finalText = outcome.finalText || (result.stdoutText ?? '');
      } else {
        result = await this.cliInvoker.invoke({
          command,
          args,
          stdinContent: options.prompt,
          cwd: options.cwd,
          env: options.env,
          timeoutSeconds: this.cliConfig.timeoutSeconds,
          idleTimeoutSeconds: this.cliConfig.idleTimeoutSeconds,
          noContentTimeoutSeconds: this.cliConfig.noContentTimeoutSeconds,
          bufferMaxEvents: this.cliConfig.bufferMaxEvents,
          outputParser: parser,
          onStdoutChunk: (text) => {
            cumulativeChars += text.length;
            logFile?.writeChunk({
              channel: 'stdout',
              msSinceStart: Date.now() - startedAt,
              cumulativeChars,
              text,
            });
            this.writeCLIOutputChunk(invocationRecordId, options, 'stdout', text, chunkSequence++);
          },
          onStderrChunk: (text) => {
            cumulativeChars += text.length;
            logFile?.writeChunk({
              channel: 'stderr',
              msSinceStart: Date.now() - startedAt,
              cumulativeChars,
              text,
            });
            this.writeCLIOutputChunk(invocationRecordId, options, 'stderr', text, chunkSequence++);
          },
        });

        // Best-effort extraction of final text + reasoning from the parsed
        // event stream — parity with the LLM agent_output shape (text +
        // thinking). Imported lazily to avoid a circular module reference
        // (orchestratorEngine imports agentInvoker).
        finalText = result.stdoutText ?? '';
        try {
          const { extractFinalText, extractReasoningText } = await import('./orchestratorEngine.js');
          finalText = extractFinalText(result.events) || (result.stdoutText ?? '');
          reasoningText = extractReasoningText(result.events) ?? '';
        } catch {
          /* fall back to raw stdoutText */
        }
      }

      const errorMessage = this.resolveCLIError(result);
      const success = result.exitCode === 0 && !result.timedOut && !result.idledOut;

      const { agentOutputId } = this.writeCLIOutputRecord(
        invocationRecordId,
        options,
        result,
        Date.now() - startedAt,
        success ? null : errorMessage ?? 'CLI invocation failed',
        finalText,
        reasoningText,
      );

      // (Invocation-completion is emitted at the executorAgent layer as
      // agent.invocation_completed. Earlier this layer fired the same
      // status change as a duplicate lifecycle event; with the legacy
      // lifecycle stream retired, only the upstream pair remains.)

      logFile?.writeFinal({
        status: success ? 'success' : 'error',
        text: finalText,
        thinking: reasoningText || null,
        inputTokens: null,
        outputTokens: null,
        durationMs: Date.now() - startedAt,
        retryAttempts: 0,
        errorMessage: success ? undefined : errorMessage ?? 'CLI invocation failed',
      });

      // Fire the reasoning-review hook on successful CLI completions so
      // Phase 9 executor calls (Goose, Claude Code) get the same advisory
      // review coverage as direct LLM calls. We construct a minimal
      // LLMCallResult-shaped envelope from the CLI invocation; tool-call
      // events and stderr are intentionally omitted from the prompt the
      // reviewer sees — per cal-24 design, tool-call output bloats the
      // review prompt without surfacing reasoning flaws the reviewer can
      // act on. `text` is the synthesized final response (best-effort
      // extraction); `thinking` is left empty until per-CLI-tool reasoning
      // extractors are wired (a separate task).
      if (success && agentOutputId && options.traceContext) {
        const reviewResult = {
          text: finalText,
          parsed: null,
          thinking: reasoningText || undefined,
          toolCalls: [],
          provider: options.backingTool,
          model: options.model ?? options.backingTool,
          inputTokens: null,
          outputTokens: null,
          usedFallback: false,
          retryAttempts: 0,
        };
        await this.llmCaller.runReviewerHook(
          invocationRecordId,
          agentOutputId,
          { traceContext: options.traceContext, prompt: options.prompt },
          reviewResult,
        );
      }

      return {
        success,
        cliResult: result,
        error: errorMessage,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.writeCLIOutputRecord(invocationRecordId, options, null, Date.now() - startedAt, msg, '', '');
      logFile?.writeFinal({
        status: 'error',
        text: '',
        thinking: null,
        inputTokens: null,
        outputTokens: null,
        durationMs: Date.now() - startedAt,
        retryAttempts: 0,
        errorMessage: msg,
      });
      return {
        success: false,
        error: msg,
      };
    } finally {
      // Clear the invocation_id we set above so subsequent emits in the
      // same TraceCtx frame don't inherit a stale id.
      if (invocationRecordId) setInvocation(null);
      this.eventBus?.emit('llm:finished', {
        provider: options.backingTool,
        lane: 'phase',
        durationMs: Date.now() - startedAt,
        label: ctx?.label ?? null,
        agentRole: ctx?.agentRole ?? null,
        subPhaseId: ctx?.subPhaseId ?? null,
      });
    }
  }

  // ── Governed-stream instrumentation for CLI invocations ────────────

  private writeCLIInvocationRecord(
    options: AgentInvocationOptions,
    command: string,
    args: string[],
  ): string | null {
    if (!this.writer) {
      // Precondition gate. Emit so the "why is agent_output missing?"
      // question has a grep-able answer. ts-18 surfaced exactly this
      // category of silent gap; observability prevents recurrence.
      aoddEmit('agent.output_skipped', {
        invocation_id: options.invocationId ?? '',
        reason: 'writer_not_attached',
      });
      return null;
    }
    if (!options.traceContext) {
      aoddEmit('agent.output_skipped', {
        invocation_id: options.invocationId ?? '',
        reason: 'no_trace_context',
      });
      return null;
    }
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
          provider: options.backingTool,
          model: options.backingTool,
          label: ctx.label ?? `${this.backingToolDisplayName(options.backingTool)}`,
          response_format: options.responseFormat ?? 'text',
          status: 'running',
          started_at: new Date().toISOString(),
          prompt: options.prompt,
          command,
          args,
          command_line: [command, ...args.map(a => this.quoteArg(a))].join(' '),
          cwd: options.cwd,
          env: options.env ?? null,
          invocation_id: options.invocationId,
          ...(ctx.taskId ? { task_id: ctx.taskId } : {}),
        },
      });
      return record.id;
    } catch (err) {
      // Previously this catch was silent. ts-18 archaeology suggests
      // sidecar-DB-shutdown races caused some writes to throw here and
      // be lost. Now we surface the failure both to stderr and as a
      // lifecycle event so the operator can correlate it with the
      // session-abort path.
      const message = err instanceof Error ? err.message : String(err);
      getLogger().warn('agent', 'agent_invocation write failed', {
        workflow_run_id: ctx.workflowRunId,
        sub_phase_id: ctx.subPhaseId ?? null,
        task_id: ctx.taskId ?? null,
        error: message,
      });
      aoddEmit('agent.output_write_failed', {
        invocation_id: options.invocationId ?? '',
        error: { message },
      });
      return null;
    }
  }

  private writeCLIOutputChunk(
    invocationId: string | null,
    options: AgentInvocationOptions,
    channel: 'stdout' | 'stderr',
    text: string,
    sequence: number,
  ): void {
    if (!invocationId || !options.traceContext) return;
    this.eventBus?.emit('llm:stream_chunk', {
      invocationId,
      sequence,
      channel,
      text,
    });
  }

  private writeCLIOutputRecord(
    invocationId: string | null,
    options: AgentInvocationOptions,
    result: CLIInvocationResult | null,
    durationMs: number,
    errorMessage: string | null,
    text: string = '',
    thinking: string = '',
  ): { agentOutputId: string | null } {
    // Precondition gates — the load-bearing observability fix from FU1.
    // ts-18 ran 20 CLI executor invocations to terminal state, yet zero
    // agent_output records landed. The most plausible root cause was the
    // sidecar-DB process shutting down before this method completed,
    // throwing inside writeRecord and being silently swallowed by the
    // original catch. Now each gate emits a distinct lifecycle event so
    // the operator can grep for the cause.
    if (!this.writer) {
      aoddEmit('agent.output_skipped', {
        invocation_id: invocationId ?? '',
        reason: 'writer_not_attached',
      });
      return { agentOutputId: null };
    }
    if (!invocationId) {
      aoddEmit('agent.output_skipped', {
        invocation_id: '',
        reason: 'no_invocation_id_upstream_write_failed',
      });
      return { agentOutputId: null };
    }
    if (!options.traceContext) {
      aoddEmit('agent.output_skipped', {
        invocation_id: invocationId,
        reason: 'no_trace_context',
      });
      return { agentOutputId: null };
    }
    const ctx = options.traceContext;
    const status = errorMessage === null ? 'success' : 'error';
    try {
      const rec = this.writer.writeRecord({
        record_type: 'agent_output',
        schema_version: '1.0',
        workflow_run_id: ctx.workflowRunId,
        phase_id: ctx.phaseId ?? null,
        sub_phase_id: ctx.subPhaseId ?? null,
        produced_by_agent_role: ctx.agentRole ?? null,
        janumicode_version_sha: this.versionSha,
        derived_from_record_ids: [invocationId],
        content: {
          status,
          provider: options.backingTool,
          model: options.model ?? options.backingTool,
          // Parity with LLMCaller.agent_output: surface the final
          // response text and the reasoning chain so the card and the
          // reasoning-review hook see the same shape regardless of
          // backing.
          text,
          thinking: thinking || null,
          // Token usage stays null — CLI parsers don't extract it
          // reliably (Codex reports it in turn.completed but Goose /
          // Claude Code / Gemini do not).
          input_tokens: null,
          output_tokens: null,
          duration_ms: durationMs,
          exit_code: result?.exitCode ?? null,
          timed_out: result?.timedOut ?? false,
          idled_out: result?.idledOut ?? false,
          event_count: result?.events.length ?? 0,
          bytes_stdout: result?.stdoutText ? Buffer.byteLength(result.stdoutText) : 0,
          bytes_stderr: result?.stderr ? Buffer.byteLength(result.stderr) : 0,
          stderr: result?.stderr ?? '',
          error_message: errorMessage,
        },
      });
      return { agentOutputId: rec.id };
    } catch (err) {
      // Previously silent (/* best-effort */). Surfacing the failure
      // because of the ts-18 root-cause investigation: sidecar shutdown
      // / DB-closed errors here directly produce "executor stuck in
      // running" symptoms. A logged warning + lifecycle event gives the
      // operator a concrete signal instead of a silent gap.
      const message = err instanceof Error ? err.message : String(err);
      getLogger().warn('agent', 'agent_output write failed', {
        workflow_run_id: ctx.workflowRunId,
        sub_phase_id: ctx.subPhaseId ?? null,
        task_id: ctx.taskId ?? null,
        invocation_id: invocationId,
        error: message,
      });
      aoddEmit('agent.output_write_failed', {
        invocation_id: invocationId,
        error: { message },
      });
      return { agentOutputId: null };
    }
  }

  private resolveCLIError(result: CLIInvocationResult): string | undefined {
    if (result.timedOut) return 'Process timed out';
    if (result.idledOut) return 'Process idle timeout';
    if (result.exitCode !== 0) return `Process exited with code ${result.exitCode}`;
    return undefined;
  }

  private backingToolDisplayName(backingTool: string): string {
    switch (backingTool) {
      case 'claude_code_cli': return 'Claude Code CLI';
      case 'gemini_cli':      return 'Gemini CLI';
      case 'goose_cli':       return 'Goose CLI';
      case 'codex_cli':       return 'Codex CLI';
      case 'mimo_cli':        return 'mimo';
      default:                return backingTool;
    }
  }

  /**
   * Best-effort shell quoting for display in the invocation card. This
   * isn't a security boundary — we never re-exec this string — so naive
   * quoting is fine.
   */
  private quoteArg(arg: string): string {
    if (arg === '') return '""';
    if (/^[A-Za-z0-9._\-\/=]+$/.test(arg)) return arg;
    return `"${arg.replace(/"/g, '\\"')}"`;
  }

  private async invokeLLM(options: AgentInvocationOptions): Promise<AgentInvocationResult> {
    if (!options.provider || !options.model) {
      return {
        success: false,
        error: 'direct_llm_api requires provider and model',
      };
    }

    try {
      const callOptions: LLMCallOptions = {
        provider: options.provider,
        model: options.model,
        system: options.system,
        prompt: options.prompt,
        responseFormat: options.responseFormat,
        temperature: options.temperature,
      };

      const result = await this.llmCaller.call(callOptions);
      return { success: true, llmResult: result };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Build the spawn command + args for a CLI backing tool. For Claude
   * Code specifically:
   *
   *   - Prompt is fed via STDIN (CLIInvoker pipes `options.prompt` to
   *     stdin already). Passing the prompt on the command line via `-p
   *     <huge string>` breaks on realistic Phase 9 task contexts — the
   *     OS arg-length limit is ~32KB on Windows and the task prompt
   *     routinely runs 20-50KB.
   *   - `-p` with empty string selects non-interactive mode without
   *     supplying the prompt, so Claude Code reads from stdin.
   *   - `--output-format stream-json` + `--verbose` is required for
   *     line-oriented NDJSON the OutputParser can consume. Without
   *     `--verbose`, stream-json mode aggregates instead of streaming.
   *   - `--permission-mode acceptEdits` auto-approves Edit/Write/Patch
   *     tools so the coding agent can actually write files without a
   *     human in the loop. This is the "virtuous cycle" contract —
   *     harness runs unattended or they aren't headless at all.
   *   - `--add-dir <cwd>` gives Claude Code explicit write access to
   *     the working tree.
    *   - `options.model` lets callers select a model per invocation.
    *     `JANUMICODE_CLAUDE_MODEL` remains the process-level fallback
    *     when the invocation does not specify one explicitly.
   *
   * Two opt-in knobs via env vars to stay conservative by default:
   *
   *   - `JANUMICODE_CLAUDE_SKIP_PERMISSIONS=1` upgrades to
   *     `--dangerously-skip-permissions` for fully unattended runs.
   *   - `JANUMICODE_CLAUDE_EXTRA_ARGS` is a shell-safe space-delimited
   *     string appended verbatim, for flags not worth wiring formally.
   */
  private buildCLICommand(options: AgentInvocationOptions): { command: string; args: string[] } {
    switch (options.backingTool) {
      case 'claude_code_cli': {
        const args: string[] = [
          '-p', '',
          '--output-format', 'stream-json',
          '--verbose',
          '--add-dir', options.cwd,
        ];
        // Permission mode resolution, in priority order:
        //   1. options.unattendedSkipPermissions — per-invocation
        //      override set by callers that know the call is
        //      definitionally headless (e.g. Phase 9 executor in
        //      calibration mode).
        //   2. JANUMICODE_CLAUDE_SKIP_PERMISSIONS=1 — process-wide
        //      env override, kept for backward compat.
        //   3. Default — `acceptEdits`. Auto-approves Edit/Write/
        //      Patch but Bash and other tool calls still surface
        //      permission requests to the human / IDE.
        if (options.unattendedSkipPermissions || process.env.JANUMICODE_CLAUDE_SKIP_PERMISSIONS === '1') {
          args.push('--dangerously-skip-permissions');
        } else {
          args.push('--permission-mode', 'acceptEdits');
        }
        const model = options.model ?? process.env.JANUMICODE_CLAUDE_MODEL;
        if (model) args.push('--model', model);
        const extra = process.env.JANUMICODE_CLAUDE_EXTRA_ARGS;
        if (extra) {
          for (const a of extra.split(/\s+/).filter(Boolean)) args.push(a);
        }
        return { command: 'claude', args };
      }
      case 'gemini_cli': {
        // Gemini CLI treats piped stdin as a positional prompt. Passing
        // `--prompt` AT THE SAME TIME makes it error with
        //   Cannot use both a positional prompt and the --prompt (-p) flag together
        // Since `options.prompt` is always piped to stdin by
        // CLIInvoker, we route the prompt through stdin only. Gemini
        // auto-detects non-interactive mode when stdin is piped, so
        // `-p` is not required.
        //
        // Env knobs mirror the Claude Code / Goose hooks for symmetry:
        //   JANUMICODE_GEMINI_MODEL      — `--model <name>` (per-invocation
        //                                  options.model wins)
        //   JANUMICODE_GEMINI_YOLO=1     — add `--yolo` to auto-approve
        //                                  tool calls unattended (Phase 9
        //                                  executor). Off by default so the
        //                                  Orchestrator's JSON-only calls
        //                                  don't need a dangerous flag.
        //   JANUMICODE_GEMINI_EXTRA_ARGS — verbatim space-delimited flags
        const args: string[] = [];
        if (process.env.JANUMICODE_GEMINI_YOLO === '1') args.push('--yolo');
        const model = options.model ?? process.env.JANUMICODE_GEMINI_MODEL;
        if (model) args.push('--model', model);
        const extra = process.env.JANUMICODE_GEMINI_EXTRA_ARGS;
        if (extra) {
          for (const a of extra.split(/\s+/).filter(Boolean)) args.push(a);
        }
        return { command: 'gemini', args };
      }
      case 'goose_cli': {
        // Goose `run` reads the instruction body from stdin when
        // `-i -` is passed. Same rationale as Claude Code: realistic
        // Phase 9 prompts run 20-50KB and would blow past the OS
        // argv-length cap if we inlined them with `-t <text>`.
        //
        // Flags:
        //   --no-session          — headless runs don't want Goose's
        //                           session DB polluting the workspace
        //   --output-format stream-json — line-delimited NDJSON for
        //                           the OutputParser
        //   --quiet               — suppress Goose's banner + spinner
        //                           so only the stream-json lines hit
        //                           stdout (banner goes to stderr)
        //   --with-builtin developer — wires file/shell tools so the
        //                           coding agent can actually write
        //                           to --add-dir (no equivalent flag
        //                           in Goose; relies on --working-dir
        //                           + developer extension's sandbox)
        //
        // Env knobs mirror the Claude Code hooks so operators can
        // steer both agents with the same mental model:
        //   JANUMICODE_GOOSE_PROVIDER — `--provider <name>` override
        //   JANUMICODE_GOOSE_MODEL    — `--model <name>` override
        //                               (per-invocation options.model
        //                               wins if set)
        //   JANUMICODE_GOOSE_MAX_TURNS — safety cap on unattended runs
        //   JANUMICODE_GOOSE_EXTRA_ARGS — space-delimited extras
        const args: string[] = [
          'run',
          '-i', '-',
          '--no-session',
          '--quiet',
          '--output-format', 'stream-json',
          '--with-builtin', 'developer',
        ];
        const provider = process.env.JANUMICODE_GOOSE_PROVIDER;
        if (provider) args.push('--provider', provider);
        const model = options.model ?? process.env.JANUMICODE_GOOSE_MODEL;
        if (model) args.push('--model', model);
        const maxTurns = process.env.JANUMICODE_GOOSE_MAX_TURNS;
        if (maxTurns) args.push('--max-turns', maxTurns);
        const extra = process.env.JANUMICODE_GOOSE_EXTRA_ARGS;
        if (extra) {
          for (const a of extra.split(/\s+/).filter(Boolean)) args.push(a);
        }
        return { command: 'goose', args };
      }
      case 'codex_cli': {
        // `codex exec --sandbox read-only --json -` runs non-interactively
        // and reads the prompt from stdin (the `-` sentinel). Ported from
        // v1 (janumicode/src/lib/cli/providers/codexCli.ts:buildCodexArgs).
        //   --sandbox read-only  — OS-level read-only enforcement
        //   --json               — JSONL event output (Responses API shape)
        //   -                    — consume stdin as prompt
        // The cliInvoker always pipes `options.prompt` to stdin, so argv
        // stays small. Critical on Windows where cmd.exe's ~8191-char
        // ARG_MAX kills invocations that put the whole spec-inlined
        // prompt on the command line.
        const codexArgs = ['exec', '--sandbox', 'read-only', '--json'];
        if (options.model) {
          codexArgs.push('--model', options.model);
        }
        codexArgs.push('-');
        return {
          command: 'codex',
          args: codexArgs,
        };
      }
      case 'mimo_cli': {
        // mimo runs as a Phase-9 executor via the `mimo serve` HTTP/SSE server
        // adapter (MimoServerAdapter), which manages its own server process and
        // ignores this command/args pair (the request's cwd drives session
        // binding; the binary/port/agent come from mimoServerManager via
        // JANUMICODE_MIMO_* env). buildCLICommand is still called before the
        // adapter is selected, so return a harmless placeholder rather than
        // throwing on the default branch.
        return { command: 'mimo', args: ['serve'] };
      }
      default:
        throw new Error(`Unknown backing tool: ${options.backingTool}`);
    }
  }
}

/**
 * Map an interactive-session outcome into the {@link CLIInvocationResult} shape
 * the rest of the executor path consumes (output record, reviewer hook, file
 * detection). The session produces no parsed event stream, so `events` is empty
 * and the agent's settled text rides in `stdoutText` / the caller's finalText.
 * A self-ended session (we `/endplan` + kill) reports a null exit → treated as
 * exit 0 (completed); a non-zero exit or timeout is preserved as a failure.
 */
function adaptOutcomeToCliResult(o: ExecutorTaskOutcome): CLIInvocationResult {
  return {
    exitCode: o.exitCode ?? 0,
    timedOut: o.timedOut,
    idledOut: false,
    noContentTimedOut: false,
    events: [],
    stdoutText: o.rawOutput,
    stderr: '',
    durationMs: o.durationMs,
  };
}
