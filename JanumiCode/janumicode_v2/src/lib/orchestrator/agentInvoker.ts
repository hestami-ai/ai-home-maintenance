/**
 * AgentInvoker — routes invocations to CLIInvoker or LLMCaller.
 * Based on JanumiCode Spec v2.3, §7.8.
 *
 * CLI-backed agents: spawns child process via CLIInvoker.
 * Direct LLM API agents: calls LLMCaller directly.
 */

import { CLIInvoker, type CLIInvocationResult } from '../cli/cliInvoker';
import { type OutputParser } from '../cli/outputParser';
import { LLMCaller, type LLMCallOptions, type LLMCallResult } from '../llm/llmCaller';
import { InvocationLogFile } from '../llm/invocationLogger';
import { buildLogFilenamePrefix } from '../llm/llmCaller';
import type { GovernedStreamWriter } from './governedStreamWriter';
import type { AgentRole, PhaseId } from '../types/records';
import { emitTransformationStep } from '../trace/emit';
import { emitLifecycle } from '../trace/lifecycle';
import { getLogger } from '../logging';

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
  /** The task's declared infrastructure descriptor (e.g. "DBOS Middleware
   *  / PostgreSQL RLS Policies"), distinct from the executor tool actually
   *  invoked. Surfaced into the agent_invocation record's `backing_tool`
   *  field for audit; the executor tool itself is recorded in `provider`/
   *  `model`. */
  taskBackingTool?: string;
}

// ── Types ───────────────────────────────────────────────────────────

export type BackingTool =
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

    // Persist the invocation envelope up front. Captures the EXACT command
    // line, arguments, stdin, cwd, and env we're about to run — so the
    // AgentInvocationCard can show "Gemini CLI: gemini --prompt ..." and
    // the user can see what was actually fed to the subprocess, not just
    // what the agent role was.
    const invocationRecordId = this.writeCLIInvocationRecord(options, command, args);
    const startedAt = Date.now();
    let chunkSequence = 0;
    let cumulativeChars = 0;

    // Tier-1 lifecycle: executor.dispatched. ts-18's alphabetical-order
    // anti-pattern would have been visible in seconds with this in place
    // (one event per dispatch, in DB-insertion order).
    emitLifecycle('executor.dispatched', {
      workflow_run_id: options.traceContext?.workflowRunId ?? null,
      phase_id: options.traceContext?.phaseId ?? null,
      sub_phase_id: options.traceContext?.subPhaseId ?? null,
      backing_tool: options.backingTool,
      model: options.model ?? null,
      task_id: options.traceContext?.taskId ?? null,
      invocation_record_id: invocationRecordId,
      label: options.traceContext?.label ?? null,
      cwd: options.cwd ?? null,
    });
    emitLifecycle('executor.invocation_status_change', {
      workflow_run_id: options.traceContext?.workflowRunId ?? null,
      sub_phase_id: options.traceContext?.subPhaseId ?? null,
      invocation_record_id: invocationRecordId,
      task_id: options.traceContext?.taskId ?? null,
      from: null,
      to: 'running',
    });

    // Transformation trace: capture the materialized CLI invocation (command
    // + args + prompt). Paired with a cli_returned emit below. Both carry
    // `invocation_id` in metadata so the walk-back CLI can group them.
    const traceSubPhaseId = options.traceContext?.subPhaseId ?? undefined;
    const traceAgentRole = options.traceContext?.agentRole ?? null;
    const cliInvokedStepId = emitTransformationStep({
      step_type: 'cli_invoked',
      sub_phase_id_override: traceSubPhaseId,
      agent_role: traceAgentRole,
      payload: {
        backingTool: options.backingTool,
        model: options.model ?? null,
        command,
        args,
        cwd: options.cwd ?? null,
        prompt: options.prompt,
        system: options.system ?? null,
      },
      metadata: {
        invocation_id: invocationRecordId,
        task_id: options.traceContext?.taskId ?? null,
        label: options.traceContext?.label ?? null,
        prompt_size_chars: options.prompt.length,
      },
    });

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

    try {
      const result = await this.cliInvoker.invoke({
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

      const errorMessage = this.resolveCLIError(result);
      const success = result.exitCode === 0 && !result.timedOut && !result.idledOut;

      // Best-effort extraction of final text + reasoning from the parsed
      // event stream — parity with the LLM agent_output shape (text +
      // thinking). Imported lazily to avoid a circular module reference
      // (orchestratorEngine imports agentInvoker).
      let finalText = result.stdoutText ?? '';
      let reasoningText = '';
      try {
        const { extractFinalText, extractReasoningText } = await import('./orchestratorEngine.js');
        finalText = extractFinalText(result.events) || (result.stdoutText ?? '');
        reasoningText = extractReasoningText(result.events) ?? '';
      } catch {
        /* fall back to raw stdoutText */
      }

      const { agentOutputId } = this.writeCLIOutputRecord(
        invocationRecordId,
        options,
        result,
        Date.now() - startedAt,
        success ? null : errorMessage ?? 'CLI invocation failed',
        finalText,
        reasoningText,
      );

      // Tier-1 lifecycle: executor.invocation_status_change to terminal
      // state. This is the seam whose absence let ts-18's 20 executors
      // sit in `status="running"` forever. agent_output records are
      // separate; this event closes the loop unconditionally so the
      // orchestrator's stall watchdog can correlate.
      emitLifecycle('executor.invocation_status_change', {
        workflow_run_id: options.traceContext?.workflowRunId ?? null,
        sub_phase_id: options.traceContext?.subPhaseId ?? null,
        invocation_record_id: invocationRecordId,
        task_id: options.traceContext?.taskId ?? null,
        from: 'running',
        to: success ? 'completed' : 'failed',
        exit_code: result.exitCode,
        timed_out: result.timedOut,
        idled_out: result.idledOut,
        duration_ms: Date.now() - startedAt,
        agent_output_record_id: agentOutputId,
      });

      // Transformation trace: capture the CLI return. Critical because
      // CLI returns are the most opaque part of the pipeline (subprocess
      // output, stream parsing). Carries the parent's invocation_id +
      // step_id so walk-back can pair this with the cli_invoked step.
      emitTransformationStep({
        step_type: 'cli_returned',
        sub_phase_id_override: traceSubPhaseId,
        agent_role: traceAgentRole,
        output_record_id: agentOutputId ?? undefined,
        payload: {
          exitCode: result.exitCode,
          timedOut: result.timedOut,
          idledOut: result.idledOut,
          stdoutText: result.stdoutText ?? '',
          finalText,
          reasoningText: reasoningText || null,
        },
        duration_ms: Date.now() - startedAt,
        error: success ? undefined : { message: errorMessage ?? 'CLI invocation failed' },
        metadata: {
          invocation_id: invocationRecordId,
          parent_cli_invoked_step_id: cliInvokedStepId,
          status: success ? 'success' : 'error',
          stdout_chars: (result.stdoutText ?? '').length,
        },
      });

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
      // Precondition gate. Emit a lifecycle event so the "why is agent_output
      // missing?" question has a grep-able answer. ts-18 surfaced exactly
      // this category of silent gap; observability prevents recurrence.
      emitLifecycle('executor.agent_invocation_skipped', {
        workflow_run_id: options.traceContext?.workflowRunId ?? null,
        sub_phase_id: options.traceContext?.subPhaseId ?? null,
        task_id: options.traceContext?.taskId ?? null,
        reason: 'writer_not_attached',
      });
      return null;
    }
    if (!options.traceContext) {
      emitLifecycle('executor.agent_invocation_skipped', {
        reason: 'no_trace_context',
        backing_tool: options.backingTool,
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
          ...(ctx.taskBackingTool ? { backing_tool: ctx.taskBackingTool } : {}),
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
      emitLifecycle('executor.agent_invocation_write_failed', {
        workflow_run_id: ctx.workflowRunId,
        sub_phase_id: ctx.subPhaseId ?? null,
        task_id: ctx.taskId ?? null,
        error: message,
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
      emitLifecycle('executor.agent_output_skipped', {
        workflow_run_id: options.traceContext?.workflowRunId ?? null,
        sub_phase_id: options.traceContext?.subPhaseId ?? null,
        invocation_record_id: invocationId,
        task_id: options.traceContext?.taskId ?? null,
        reason: 'writer_not_attached',
      });
      return { agentOutputId: null };
    }
    if (!invocationId) {
      emitLifecycle('executor.agent_output_skipped', {
        workflow_run_id: options.traceContext?.workflowRunId ?? null,
        sub_phase_id: options.traceContext?.subPhaseId ?? null,
        task_id: options.traceContext?.taskId ?? null,
        reason: 'no_invocation_id_upstream_write_failed',
      });
      return { agentOutputId: null };
    }
    if (!options.traceContext) {
      emitLifecycle('executor.agent_output_skipped', {
        invocation_record_id: invocationId,
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
      emitLifecycle('executor.agent_output_write_failed', {
        workflow_run_id: ctx.workflowRunId,
        sub_phase_id: ctx.subPhaseId ?? null,
        invocation_record_id: invocationId,
        task_id: ctx.taskId ?? null,
        status,
        error_message: errorMessage,
        write_error: message,
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
      default:
        throw new Error(`Unknown backing tool: ${options.backingTool}`);
    }
  }
}
