/**
 * Tier-3 full-TUI adapter for the Goose CLI — the DEFAULT Phase-9 executor.
 *
 * Drives an interactive `goose session` over the SessionDriver through a
 * research → plan → implement flow. Turn control is PERCEPTION-DRIVEN: the
 * classifier (busy / modal / prompt / idle / normal + echo-excluded
 * agent-content signature) decides state; this adapter is only POLICY:
 *
 *   busy            → wait (a spinner is work, not a stall)
 *   prompt          → answer (clarification / act-on-plan / clear-history)
 *   modal           → accept the default (Enter) under the ActionGuard
 *   idle + NEW agent content since our send → the turn is complete
 *   timeout window with no state/content change and not busy → stall
 *
 * This subsumes the heuristic generations that live calibration burned
 * through (growth guard, spinner-excluded progress signature, last-line idle
 * predicate) — each failed on a real goose behavior (echo fast-settle,
 * mid-work kill, hint-suffixed input box) that the classifier now models.
 *
 * Task delivery is FILE-BASED (multi-line pastes fragment in a TUI input):
 * the full spec is written to `.janumicode/task-specs/` and the session gets
 * one short instruction referencing it. With `usePlanMode`, the spec is first
 * READ in normal mode (tools available) so the planner — a separate,
 * possibly tool-less model — has the content in conversation context.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { SessionDriver, type SessionDriverOptions, type SessionLogEvent } from '../sessionDriver';
import { resolveExecutorIdleTimeoutMs } from '../executorTimeouts';
import { checkAction } from '../perception/actionGuard';
import type { Detection } from '../perception/classifier';
import { GOOSE_MARKERS, type PerceptionMarkers } from '../perception/detectors';
import { sanitizeResponderReply, type ExecutorEscalation, type SessionResponder } from '../responder';
import type { PtySpawner, ScreenModel } from '../types';
import type { AdapterTier, ExecutorAdapter, ExecutorTaskOutcome, ExecutorTaskRequest } from '../adapter';

export interface GooseTuiConfig {
  /** Executable + args that open an interactive session. */
  command: string;
  sessionArgs: string[];
  /** Sent to unblock a generic clarifying question. */
  clarificationResponse: string;
  /** Use native `/plan` mode (separate planner model; see env threading). */
  usePlanMode: boolean;
  planEnterCommand: string;
  planExitCommand: string;
  /** Goose's post-plan "act on this plan?" question (native /plan mode). */
  planActionPattern: RegExp;
  planActionResponse: string;
  /** Goose's "clear message history?" question (native /plan mode). */
  clearHistoryPattern: RegExp;
  clearHistoryResponse: string;
  /** Stall window (ms): a window with no progress and no busy state = stall. */
  perTurnTimeoutMs: number;
  /** Max ANSWERED interactions before giving up (infinite Q&A protection). */
  maxTurns: number;
  /**
   * Completion sentinel. A goose TURN ends whenever the model emits text
   * without tool calls — which is NOT task completion (live: the agent
   * settled mid-thought, "Let's search for similar modules.", zero files
   * written). The task instruction requires ending with this marker; an idle
   * settle WITHOUT it gets a continuation nudge instead of being declared done.
   */
  completionMarker: string;
  continueNudge: string;
  cols: number;
  rows: number;
  /** Perception marker overrides (goose UI updates = config tweak). */
  markers?: PerceptionMarkers;
}

export const DEFAULT_GOOSE_TUI_CONFIG: GooseTuiConfig = {
  command: 'goose',
  sessionArgs: ['session'],
  clarificationResponse: 'Proceed with the most reasonable interpretation based on the task specification you read; do not ask further questions.',
  // Prompt-level RPI in normal session mode is the default: the agent keeps
  // file/shell tools for EVERY step. Native /plan (usePlanMode:true) needs
  // GOOSE_PLANNER_* (or GOOSE_*) env configured to a capable model.
  usePlanMode: false,
  planEnterCommand: '/plan',
  planExitCommand: '/endplan',
  planActionPattern: /act on (the|this) plan|\[a\]ct|proceed with (the|this) plan\?/i,
  planActionResponse: 'Yes — act on the plan now.',
  clearHistoryPattern: /clear (the |your |message )?history|clear messages/i,
  clearHistoryResponse: 'No, keep the message history and act on the plan.',
  // Local models legitimately take minutes per turn; this is a STALL window,
  // not a work limit — busy states and content progress extend waiting.
  perTurnTimeoutMs: 300_000,
  maxTurns: 12,
  completionMarker: 'TASK COMPLETE',
  // NOTE: never let the marker be the FINAL token of anything we type — the
  // TUI echoes and wraps our input, and the final wrapped fragment (the only
  // short one) could then be exactly the marker line, which is echo-exempt.
  continueNudge: 'Continue working — you have not finished. Proceed through your plan, implement the task fully, verify the completion criteria, and only then end your final message with the exact line: TASK COMPLETE (that text alone on its own line).',
  cols: 210,
  rows: 40,
};

export interface GooseTuiAdapterOptions {
  config?: Partial<GooseTuiConfig>;
  /** Forwarded to the SessionDriver — governed-stream ingestion of turns. */
  onLog?: (e: SessionLogEvent) => void;
  /**
   * LLM-backed surrogate for the human side of the session: answers the
   * agent's clarifying questions FROM THE TASK SPEC and composes contextual
   * continuation nudges. Optional — without it (or when it returns null /
   * throws) the adapter uses its canned responses, so tests and degraded
   * runs keep today's deterministic behavior. Replies are sanitized
   * (single line, no slash commands, no completion sentinel) and still pass
   * the ActionGuard.
   */
  responder?: SessionResponder;
  /**
   * Human-escalation sink for a clarifying question the spec-grounded responder
   * could NOT answer (attended runs only). Unlike mimo's compose API, the goose
   * PTY can inject the human's reply — it is typed straight into the session.
   * Absent headless; on null/throw the adapter falls back to the canned
   * clarification response, so it never deadlocks.
   */
  onEscalate?: ExecutorEscalation;
  /** Screen-model factory (tests inject the synchronous TerminalScreen). */
  screenFactory?: () => ScreenModel;
  /** Injected clock (testability); defaults to Date.now in runtime. */
  nowFn?: () => number;
  setTimeoutFn?: NonNullable<SessionDriverOptions['setTimeoutFn']>;
  clearTimeoutFn?: NonNullable<SessionDriverOptions['clearTimeoutFn']>;
}

export class GooseTuiAdapter implements ExecutorAdapter {
  readonly tier: AdapterTier = 'full_tui';
  private readonly cfg: GooseTuiConfig;
  /** Markers with the completion sentinel echo-exempted (our own instruction
   *  contains the sentinel, so the agent's emission of it would otherwise be
   *  filtered as echo and completion would be undetectable). */
  private readonly markers: PerceptionMarkers;
  /** Full task spec for the current run — grounding for the responder. */
  private taskSpec = '';
  /**
   * Per-turn stall window for the CURRENT run: a full window with no progress
   * and no busy state = stall. Driven by the shared executor idle policy
   * (`req.idleTimeoutSeconds`) so a long-but-active RPI turn is never cut; the
   * absolute ceiling is `budgetMs` (wall-clock). Distinct from `perTurnTimeoutMs`,
   * which stays short for STARTUP input-ready detection.
   */
  private stallWindowMs = 0;

  constructor(
    private readonly spawner: PtySpawner,
    private readonly opts: GooseTuiAdapterOptions = {},
  ) {
    this.cfg = { ...DEFAULT_GOOSE_TUI_CONFIG, ...(opts.config ?? {}) };
    const base = this.cfg.markers ?? GOOSE_MARKERS;
    this.markers = { ...base, echoExempt: [...(base.echoExempt ?? []), this.cfg.completionMarker] };
  }

  async run(req: ExecutorTaskRequest): Promise<ExecutorTaskOutcome> {
    const now = this.opts.nowFn ?? (() => Date.now());
    const started = now();
    this.taskSpec = req.prompt;
    const driver = new SessionDriver(this.spawner, {
      defaultTimeoutMs: this.cfg.perTurnTimeoutMs,
      cols: this.cfg.cols,
      rows: this.cfg.rows,
      screen: this.opts.screenFactory?.(),
      onLog: this.opts.onLog,
      setTimeoutFn: this.opts.setTimeoutFn,
      clearTimeoutFn: this.opts.clearTimeoutFn,
    });

    let timedOut = false;
    let lastDetection: Detection | null = null;
    try {
      const env = this.buildSessionEnv(req.env);

      driver.start({ command: this.cfg.command, args: this.cfg.sessionArgs, cwd: req.cwd, env });
      // ConPTY size nudge: the slice-142 capture shows goose rendering for a
      // different width than requested (ESC[..;188H on a 120-col request); an
      // explicit resize after spawn forces a winsize propagation.
      driver.resize(this.cfg.cols, this.cfg.rows);

      // Session budget (wall-clock ceiling) + per-turn stall window (idle) both
      // come from the shared executor policy via the request, so goose inherits
      // the same generous backstops as every other executor. Stall detection is
      // the primary net; budgetMs is the absolute backstop.
      const budgetMs = Math.max((req.timeoutSeconds ?? 600) * 1000, 1_800_000);
      this.stallWindowMs = req.idleTimeoutSeconds
        ? req.idleTimeoutSeconds * 1000
        : resolveExecutorIdleTimeoutMs();
      const deadline = started + budgetMs;

      // Ready = the input box is visible.
      const ready = await driver.waitForDetection((d) => d.inputReady, this.cfg.perTurnTimeoutMs, this.markers);
      lastDetection = ready.detection;
      if (ready.reason === 'timeout') timedOut = true;

      if (!driver.exited && !timedOut) {
        const specPath = this.writeTaskSpec(req);
        const flow = this.cfg.usePlanMode
          ? await this.runPlanModeFlow(driver, specPath, deadline, now)
          : await this.runDirectFlow(driver, specPath, deadline, now);
        timedOut = flow.timedOut;
        lastDetection = flow.detection ?? lastDetection;
      }

      const finalDetection = lastDetection ?? driver.classify(this.markers);
      return {
        tier: this.tier,
        exitCode: driver.exitCode,
        // Agent content (echo-excluded) is the meaningful result text.
        finalText: finalDetection.agentContentSig || driver.snapshot().text,
        rawOutput: driver.rawOutput(),
        timedOut,
        durationMs: now() - started,
      };
    } finally {
      driver.end();
    }
  }

  /**
   * Build the session env: thread provider/model into the session (goose
   * session has no CLI flags for these; without env it silently uses goose's
   * config default) + the PLANNER pair, which /plan warns about and falls back
   * from. `req.env` wins when the caller already set a var.
   */
  private buildSessionEnv(reqEnv: Record<string, string> | undefined): Record<string, string> {
    const env: Record<string, string> = { ...(reqEnv ?? {}) };
    const provider = process.env.JANUMICODE_GOOSE_PROVIDER;
    const model = process.env.JANUMICODE_GOOSE_MODEL;
    if (provider && !env.GOOSE_PROVIDER) env.GOOSE_PROVIDER = provider;
    if (model && !env.GOOSE_MODEL) env.GOOSE_MODEL = model;
    const plannerProvider = process.env.JANUMICODE_GOOSE_PLANNER_PROVIDER ?? provider;
    const plannerModel = process.env.JANUMICODE_GOOSE_PLANNER_MODEL ?? model;
    if (plannerProvider && !env.GOOSE_PLANNER_PROVIDER) env.GOOSE_PLANNER_PROVIDER = plannerProvider;
    if (plannerModel && !env.GOOSE_PLANNER_MODEL) env.GOOSE_PLANNER_MODEL = plannerModel;
    // Model reasoning visible in the PTY stream; random "thinking…" spinner
    // phrases off (they churn the screen model for no signal).
    if (!env.GOOSE_CLI_SHOW_THINKING) env.GOOSE_CLI_SHOW_THINKING = 'true';
    if (!env.GOOSE_RANDOM_THINKING_MESSAGES) env.GOOSE_RANDOM_THINKING_MESSAGES = 'false';
    return env;
  }

  /**
   * Native /plan flow: pre-read the spec in normal mode (tools available) so
   * the planner model has it in conversation context, enter plan mode, run the
   * task prompt (completion-gated), then exit plan mode. Each step is guarded
   * by driver liveness + the accumulated timeout, exactly as inline.
   */
  private async runPlanModeFlow(
    driver: SessionDriver,
    specPath: string,
    deadline: number,
    now: () => number,
  ): Promise<{ timedOut: boolean; detection: Detection | null }> {
    let timedOut = false;
    let detection: Detection | null = null;
    // Pre-read sequencing: have the MAIN agent (tools available) read the spec
    // into conversation context, THEN enter plan mode — the planner model may
    // not have file tools.
    timedOut = (await this.exchange(driver,
      'Read the file "' + specPath + '" now and summarize the task it specifies in a few sentences. Do not start implementing yet.',
      deadline, now, 'pre-read')).timedOut || timedOut;
    if (!driver.exited && !timedOut) {
      timedOut = (await this.exchange(driver, this.cfg.planEnterCommand, deadline, now, 'enter-plan-mode')).timedOut || timedOut;
    }
    if (!driver.exited && !timedOut) {
      const r = await this.exchange(driver,
        'Create a plan for the task you just read, then act on it: implement the task fully and verify its completion criteria. '
        + this.relativePathRule()
        + this.sentinelInstruction(),
        deadline, now, 'task-prompt', /* requireCompletion */ true);
      timedOut = r.timedOut || timedOut;
      detection = r.detection ?? detection;
    }
    if (!driver.exited) {
      await this.exchange(driver, this.cfg.planExitCommand, deadline, now, 'exit-plan-mode');
    }
    return { timedOut, detection };
  }

  /**
   * Default prompt-level RPI: one completion-gated instruction carrying the
   * 3-step research → plan → implement discipline.
   */
  private async runDirectFlow(
    driver: SessionDriver,
    specPath: string,
    deadline: number,
    now: () => number,
  ): Promise<{ timedOut: boolean; detection: Detection | null }> {
    const r = await this.exchange(driver,
      'Read the file "' + specPath + '" now — it is your complete task specification. '
      + 'Work in three steps: (1) RESEARCH — read the spec, then inspect the workspace: the write-scope directory, the canonical shared-module paths it names, and any existing implementations you should import or extend; '
      + '(2) PLAN — state a short plan consistent with what you found; '
      + '(3) IMPLEMENT — write the code and tests, honoring the write scope and the Shared Module Ownership rules, and verify the completion criteria. '
      + 'Do not ask me questions; make reasonable decisions and proceed to completion. '
      + this.relativePathRule()
      + this.sentinelInstruction(),
      deadline, now, 'task-prompt', /* requireCompletion */ true);
    return { timedOut: r.timedOut, detection: r.detection };
  }

  /**
   * Send one line, then drive the conversation until the turn completes:
   * answer prompts (clarification / act-on-plan / clear-history), accept
   * modal defaults, keep waiting through busy/progressing states, stall out
   * on a dead window, and respect the overall deadline.
   */
  private async exchange(
    driver: SessionDriver,
    line: string,
    deadline: number,
    now: () => number,
    label?: string,
    requireCompletion = false,
  ): Promise<{ timedOut: boolean; detection: Detection | null }> {
    let sigAtSend = driver.classify(this.markers).agentContentSig;
    this.guardedSendLine(driver, line, label ?? line.slice(0, 40));

    let answered = 0;
    let lastSig = sigAtSend;
    for (;;) {
      const remaining = deadline - now();
      if (remaining <= 0) return { timedOut: true, detection: null };
      // Stall window = the shared idle policy (generous), capped by wall-clock
      // remaining. A full window with no busy state + no content change = stall.
      const windowMs = Math.min(this.stallWindowMs, remaining);

      // A prompt/modal/idle only SETTLES the wait when agent content changed
      // since our last send — the previous question stays on the transcript
      // after we answer it, and without this the loop instantly re-matches
      // the STALE prompt and re-answers (answer spam, found via fake-PTY
      // trace before it could double-send to live goose).
      const r = await driver.waitForDetection(
        (d) => this.turnSettled(d, sigAtSend),
        windowMs,
        this.markers,
      );
      const d = r.detection;
      if (r.reason === 'exit') return { timedOut: false, detection: d };
      if (r.reason === 'timeout') {
        // Busy or progressing → keep waiting; dead window → stall.
        if (d.kind === 'busy' || d.agentContentSig !== lastSig) { lastSig = d.agentContentSig; continue; }
        return { timedOut: true, detection: d };
      }
      // matched — decide the turn's next move (finish / nudge / accept / answer).
      const step = await this.handleMatch(driver, d, requireCompletion, answered);
      if (step.kind === 'return') return { timedOut: step.timedOut, detection: step.detection };
      answered = step.answered;
      sigAtSend = step.sig;
      lastSig = step.sig;
    }
  }

  /**
   * A prompt/modal/idle SETTLES the wait only when agent content changed since
   * our last send — otherwise the loop re-matches the stale (already-answered)
   * prompt and re-answers it (answer spam).
   */
  private turnSettled(d: Detection, sigAtSend: string): boolean {
    return d.agentContentSig !== sigAtSend
      && (d.kind === 'prompt' || d.kind === 'modal' || d.kind === 'idle');
  }

  /**
   * Handle a settled detection: finish on the completion sentinel, nudge an
   * idle mid-thought turn, accept a modal default, or answer a prompt. Returns
   * either a terminal result or the updated (answered, signature) state for the
   * next wait window; in every continue case sigAtSend and lastSig track the
   * same signature.
   */
  private async handleMatch(
    driver: SessionDriver,
    d: Detection,
    requireCompletion: boolean,
    answered: number,
  ): Promise<
    | { kind: 'return'; timedOut: boolean; detection: Detection | null }
    | { kind: 'continue'; answered: number; sig: string }
  > {
    // The sentinel is AUTHORITATIVE over the classified kind: a short final
    // turn ("Implemented. / TASK COMPLETE") can leave a stale question inside
    // the wrap-tolerant last-3-lines prompt window, classifying as `prompt` —
    // without this, the loop re-answers the already-answered question instead
    // of finishing (caught by the responder fake-PTY test).
    if (requireCompletion && this.hasCompletionMarker(d.agentContentSig)) {
      return { kind: 'return', timedOut: false, detection: d };
    }
    if (d.kind === 'idle') {
      // A goose TURN ends whenever the model emits plain text — that is NOT
      // task completion (live finding: the agent settled mid-thought with zero
      // files written). With requireCompletion, only the sentinel ends the
      // exchange; otherwise nudge it to continue (bounded by maxTurns).
      if (!requireCompletion) return { kind: 'return', timedOut: false, detection: d };
      if (++answered > this.cfg.maxTurns) return { kind: 'return', timedOut: true, detection: d };
      const sig = await this.sendContinuationNudge(driver, d.agentContentSig);
      return { kind: 'continue', answered, sig };
    }
    if (++answered > this.cfg.maxTurns) return { kind: 'return', timedOut: true, detection: d };
    if (d.kind === 'modal') {
      // Accept the dialog's default under the guard.
      if (checkAction(d, { type: 'key', key: 'enter' }).allowed) driver.sendKey('enter');
      return { kind: 'continue', answered, sig: d.agentContentSig };
    }
    // prompt — answer it, then re-classify for the post-send (echoed) signature.
    const answer = await this.resolvePromptAnswer(d);
    this.guardedSendLine(driver, answer, 'clarification-answer');
    return { kind: 'continue', answered, sig: driver.classify(this.markers).agentContentSig };
  }

  /**
   * Compose and send a continuation nudge for an idle mid-thought turn.
   * Contextual steering beats a generic cattle prod: let the responder read
   * what the agent just said and compose the continuation; the sentinel
   * requirement is re-stated deterministically by US, never left to the
   * responder (sanitize strips it from LLM output). Returns the post-send
   * agent-content signature.
   */
  private async sendContinuationNudge(driver: SessionDriver, agentContentSig: string): Promise<string> {
    const nudge = await this.respondVia('nudge', '', agentContentSig);
    this.guardedSendLine(
      driver,
      nudge === null ? this.cfg.continueNudge : nudge + ' ' + this.sentinelInstruction(),
      'continue-nudge',
    );
    return driver.classify(this.markers).agentContentSig;
  }

  /**
   * Pick a prompt's answer by what is being asked. The two PROTOCOL prompts
   * (/plan flow control) stay canned — they are yes/no rails, not questions
   * about the task. Everything else is a real clarifying question: the
   * spec-grounded responder answers it FIRST (the 566s live session died on
   * numbered questions whose answers were all in the spec); if it can't, escalate
   * to the human (attended) and type THEIR reply — the PTY can inject it, unlike
   * mimo's compose API; canned deflection is the last resort.
   */
  private async resolvePromptAnswer(d: Detection): Promise<string> {
    const q = d.line ?? '';
    // The responder gets the trailing content BLOCK, not just the detected
    // line — numbered clarification questions span several lines and the
    // detected prompt line is only the final one.
    const questionBlock = d.agentContentSig.split('\n').slice(-8).join('\n') || q;
    if (this.cfg.planActionPattern.test(q)) return this.cfg.planActionResponse;
    if (this.cfg.clearHistoryPattern.test(q)) return this.cfg.clearHistoryResponse;
    return (await this.respondVia('question', questionBlock, d.agentContentSig))
      ?? (await this.escalateVia(questionBlock, d.agentContentSig))
      ?? this.cfg.clarificationResponse;
  }

  /**
   * The sentinel sentence appended to every task instruction and nudge. The
   * trailing clause is LOAD-BEARING, not flavor: the TUI echoes and wraps
   * what we type, and the final wrapped fragment is the only short one — if
   * the marker were the last token, that fragment could render as exactly
   * the marker line, which is echo-exempt → instant false completion.
   */
  private sentinelInstruction(): string {
    return 'When everything is implemented and verified, end your final message with the exact line: '
      + this.cfg.completionMarker + ' (that text alone on its own line).';
  }

  /**
   * Sandbox discipline: every goose session is spawned with cwd = the project
   * root, so relative paths suffice. Absolute paths are the escape vector —
   * weak models mangle the long literal (dropped hyphens, escape-sequence
   * mashing) into directories OUTSIDE the project, even above the workspace.
   * Stated on every task turn so it survives plan-mode's fresh context.
   */
  private relativePathRule(): string {
    return 'IMPORTANT — file paths: you are already inside the project root (your current directory). '
      + 'Create and edit files using paths RELATIVE to it (e.g. `src/foo.ts`). '
      + 'NEVER use an absolute path, never `cd` out of this directory, and never include the workspace path in a filename — '
      + 'writes outside the project directory are rejected and discarded. ';
  }

  /**
   * Completion = the marker as its own content LINE (exact, or with a short
   * decoration prefix like "◆ "), never a substring match — our own echoed
   * instruction contains the marker mid-sentence, and interior wrapped echo
   * fragments like "exact line: TASK COMPLETE" must not count. (Those are
   * normally echo-filtered; this check is the second independent layer.)
   */
  private hasCompletionMarker(sig: string): boolean {
    const marker = this.cfg.completionMarker;
    return sig.split('\n').some((l) => {
      const t = l.trim();
      return t === marker || (t.endsWith(marker) && t.length <= marker.length + 4 && !t.endsWith(': ' + marker));
    });
  }

  /**
   * Ask the injected responder for a reply; null on any failure path
   * (unconfigured, returned null/empty, threw) so callers use the canned
   * fallback. Replies are sanitized to one guarded TUI-safe line: never a
   * slash command, never the completion sentinel (only the AGENT may declare
   * completion — our sends are echo-exempt for the marker, so a sentinel
   * typed by us would end the task instantly).
   */
  private async respondVia(
    kind: 'question' | 'nudge',
    question: string,
    agentContext: string,
  ): Promise<string | null> {
    const responder = this.opts.responder;
    if (!responder) return null;
    try {
      const raw = await responder({
        kind,
        question,
        // Tail only: enough to carry the numbered questions / last thought,
        // without shipping the whole transcript to a small fast model.
        agentContext: agentContext.slice(-4000),
        taskSpec: this.taskSpec,
      });
      return sanitizeResponderReply(raw, this.cfg.completionMarker);
    } catch {
      return null;
    }
  }

  /**
   * Escalate a clarifying question the spec-grounded responder could NOT answer
   * to the human (attended runs only; the sink is wired only when attended). The
   * human's reply is typed straight into the PTY — the injection the mimo
   * compose API cannot do. Null on any failure path (no sink, no/blank answer,
   * threw) so the caller falls back to the canned clarification response. The
   * reply is sanitized to one guarded TUI-safe line, same as {@link respondVia}.
   */
  private async escalateVia(question: string, agentContext: string): Promise<string | null> {
    const onEscalate = this.opts.onEscalate;
    if (!onEscalate) return null;
    try {
      const raw = await onEscalate({
        question,
        agentContext: agentContext.slice(-4000),
        taskSpec: this.taskSpec,
      });
      return sanitizeResponderReply(raw, this.cfg.completionMarker);
    } catch {
      return null;
    }
  }

  private guardedSendLine(driver: SessionDriver, text: string, label: string): void {
    const d = driver.classify(this.markers);
    const verdict = checkAction(d, { type: 'text', text });
    if (!verdict.allowed && d.kind === 'busy') {
      // Policy bug guard — never type over a working agent. The caller's
      // wait loop re-evaluates state; the send is dropped.
      return;
    }
    driver.sendLine(text, label);
  }

  /** Materialize the full task spec to a file the agent reads. */
  private writeTaskSpec(req: ExecutorTaskRequest): string {
    // Prefer the caller-provided (control-plane) spec dir so no `.janumicode`
    // is created inside the agent's cwd. The agent receives the absolute path
    // returned below, so the spec's location is independent of cwd.
    const dir = req.taskSpecDir ?? path.join(req.cwd, '.janumicode', 'task-specs');
    fs.mkdirSync(dir, { recursive: true });
    const name = `task-spec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.md`;
    const abs = path.join(dir, name);
    fs.writeFileSync(abs, req.prompt, 'utf-8');
    // Hand the agent a RELATIVE reference (relative to its cwd), never an
    // absolute path. The agent anchors its writes on the spec path's directory;
    // an absolute path is the longest literal string it echoes and weak models
    // mangle it into out-of-sandbox paths. A relative ref keeps the agent
    // anchored on its cwd (= project root), and the agent's read tool resolves
    // it against the session cwd. POSIX-normalized + `./`-prefixed for clarity.
    const rel = path.relative(req.cwd, abs).split(path.sep).join('/');
    return rel.startsWith('.') || rel.startsWith('/') ? rel : `./${rel}`;
  }
}
