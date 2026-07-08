/**
 * mimo executor adapter — drives the `compose` agent through a `mimo serve`
 * HTTP/SSE session instead of a PTY TUI.
 *
 * Flow: ensure a warm server bound to the project root → create a session →
 * consume the SSE `/event` stream (forward text to the live-log via `onLog`,
 * detect completion via `session.idle`, route permission `ask`s in relay mode)
 * → POST the task message (blocks to completion) → return an
 * {@link ExecutorTaskOutcome}.
 *
 * File-writes are NOT surfaced here: `executorAgent` derives them from its
 * filesystem snapshot of the leaf's write-scope (adapter-agnostic), and mimo's
 * `external_directory: deny` policy prevents out-of-project escapes at source.
 */

import type { AdapterTier, ExecutorAdapter, ExecutorTaskOutcome, ExecutorTaskRequest } from '../adapter';
import type { SessionLogEvent } from '../sessionDriver';
import { MimoServerManager, resolveMimoConfig, type MimoConfig } from '../../mimo/mimoServerManager';
import { resolveExecutorIdleTimeoutMs, resolveExecutorWallclockTimeoutMs } from '../executorTimeouts';
import { parseModelRef, type MimoClient, type MimoSseEvent, type PermissionResponse } from '../../mimo/mimoClient';
import { sanitizeResponderReply, type ExecutorEscalation, type SessionResponder } from '../responder';
import { getLogger } from '../../../logging';

/** A permission `ask` surfaced by mimo's SSE `permission.asked` event. */
export interface MimoPermissionAsk {
  permissionId: string;
  /** The permission/tool kind, e.g. `edit`, `bash`, `webfetch`, `external_directory`. */
  tool: string;
  /** Target file (for edit) or best-effort context. */
  filepath: string;
  raw: MimoSseEvent;
}

/** Decides how to answer a permission `ask` (relay/supervised mode). */
export type MimoPermissionDecider = (ask: MimoPermissionAsk) => Promise<PermissionResponse>;

export interface MimoServerAdapterOptions {
  onLog?: (e: SessionLogEvent) => void;
  config?: MimoConfig;
  /**
   * Whether a human is in the loop (= !unattendedSkipPermissions). Overrides the
   * resolved config's `attended` so the written mimocode.json `question` policy +
   * agent-prompt framing match this run. Attended sets `question:'ask'`, routing
   * a clarification to {@link responder}/{@link onEscalate}; headless keeps it
   * denied. Default (undefined) leaves the resolved config's value untouched.
   */
  attended?: boolean;
  /**
   * Spec-grounded voice-of-intent answerer. mimo's compose API is
   * non-conversational (a permission carries only approve/deny, no text answer),
   * so unlike the goose PTY the reply CANNOT be typed back into the turn — the
   * adapter uses the responder to COMPOSE + surface the answer for the audit
   * trail before rejecting the question so the agent self-resolves.
   */
  responder?: SessionResponder;
  /**
   * Human-escalation sink for a blocking clarification the responder can't
   * resolve (attended sessions). Surfaced for the audit trail; also cannot be
   * injected mid-turn. Absent headless.
   */
  onEscalate?: ExecutorEscalation;
  /**
   * Relay-mode permission resolver. When `permissionMode === 'relay'` and this
   * is absent, a default resolver surfaces each ask (via `onLog`) and answers
   * with `JANUMICODE_MIMO_PERMISSION_DEFAULT` (default `once`). Inject a
   * human-routed resolver here for true supervised approval.
   */
  permissionDecider?: MimoPermissionDecider;
  /** Idle-watchdog: abort after this much zero-progress (no SSE events). Test override. */
  idleTimeoutMs?: number;
  /** Wall-clock backstop: hard absolute max regardless of activity. Test override. */
  wallclockTimeoutMs?: number;
  /** How often the watchdog checks idle/wall-clock. Test override. */
  watchdogTickMs?: number;
  /** Post-POST-failure grace before declaring a dead connection. Test override. */
  postFailureGraceMs?: number;
}

// Executor lifecycle policy (Option 4) lives in the SHARED executorTimeouts
// module so every adapter inherits the same idle-watchdog + wall-clock backstops.
const WATCHDOG_TICK_MS_DEFAULT = 30_000;
// After the turn-blocking POST fails (genuine connection drop), how long to wait
// for SSE to prove the turn is still alive before declaring the connection dead.
// Far shorter than the 24h idle window so a dead mimo connection fails fast.
// Resolved per-run (not module-load) so env/opts overrides take effect.
function resolvePostFailureGraceMs(): number {
  const s = Number(process.env.JANUMICODE_EXECUTOR_POST_FAILURE_GRACE_S);
  return Number.isFinite(s) && s > 0 ? s * 1000 : 120_000;
}

export class MimoServerAdapter implements ExecutorAdapter {
  readonly tier: AdapterTier = 'agentic_server';
  private readonly cfg: MimoConfig;

  private readonly decider?: MimoPermissionDecider;
  private readonly responder?: SessionResponder;
  private readonly onEscalate?: ExecutorEscalation;

  constructor(private readonly opts: MimoServerAdapterOptions = {}) {
    const base = opts.config ?? resolveMimoConfig();
    // The invocation's attended flag (from the build context) wins over the
    // resolved default so the written policy + agent framing match this run's mode.
    this.cfg = opts.attended === undefined ? base : { ...base, attended: opts.attended };
    this.responder = opts.responder;
    this.onEscalate = opts.onEscalate;
    // Relay mode without an injected resolver gets a default that surfaces each
    // ask and answers per JANUMICODE_MIMO_PERMISSION_DEFAULT (default `once`).
    this.decider = opts.permissionDecider
      ?? (this.cfg.permissionMode === 'relay' ? defaultRelayDecider(opts.onLog) : undefined);
  }

  async run(req: ExecutorTaskRequest): Promise<ExecutorTaskOutcome> {
    const started = Date.now();
    const { client } = await MimoServerManager.ensure(req.cwd, this.cfg);
    const sessionId = await client.createSession();
    this.opts.onLog?.({ kind: 'spawn', command: this.cfg.binary, args: ['serve', '→', this.cfg.agent, sessionId] });

    // Precedence: explicit adapter opts (tests) > the request's shared-policy
    // values (set by AgentInvoker from executorTimeouts) > the shared resolver.
    const idleMs = this.opts.idleTimeoutMs
      ?? (req.idleTimeoutSeconds ? req.idleTimeoutSeconds * 1000 : undefined)
      ?? resolveExecutorIdleTimeoutMs();
    const wallMs = this.opts.wallclockTimeoutMs
      ?? (req.timeoutSeconds ? req.timeoutSeconds * 1000 : undefined)
      ?? resolveExecutorWallclockTimeoutMs(idleMs);
    const tickMs = this.opts.watchdogTickMs ?? WATCHDOG_TICK_MS_DEFAULT;
    const postFailureGraceMs = this.opts.postFailureGraceMs ?? resolvePostFailureGraceMs();

    const sse = new AbortController();
    let finalText = '';
    const rawParts: string[] = [];
    let sawIdle = false;
    let lastEventAt = Date.now();
    // >0 once the turn-blocking POST has FAILED. With undici's 300s cap removed,
    // a POST failure is a GENUINE connection drop (not a spurious timeout). The
    // turn MIGHT still be alive server-side (SSE keeps streaming) or genuinely
    // dead — so after a failure we fall back to a short grace: if SSE goes silent
    // for `POST_FAILURE_GRACE_MS`, the connection is dead → abort promptly rather
    // than waiting out the 24h idle window (which would hang the phase).
    let postFailedAt = 0;

    // Single completion latch — the FIRST reason wins.
    let settleDone!: () => void;
    const done = new Promise<void>((r) => { settleDone = r; });
    let completion: 'idle' | 'post' | 'idle_timeout' | 'wallclock' | 'post_failed' | '' = '';
    const settle = (reason: Exclude<typeof completion, ''>): void => {
      if (!completion) { completion = reason; settleDone(); }
    };

    // Consume SSE concurrently: forward text → onLog, accumulate final text,
    // mark progress (reset the idle clock), resolve on `session.idle`, route asks.
    const consume = (async () => {
      try {
        for await (const ev of client.streamEvents(sse.signal)) {
          if (eventSessionId(ev) && eventSessionId(ev) !== sessionId) continue;
          lastEventAt = Date.now();
          rawParts.push(JSON.stringify(ev));
          if (ev.type === 'message.part.delta') {
            const p = ev.properties as { field?: string; delta?: string };
            if (p.field === 'text' && typeof p.delta === 'string') {
              finalText += p.delta;
              this.opts.onLog?.({ kind: 'data', chunk: p.delta });
            }
          } else if (ev.type === 'session.idle') {
            sawIdle = true;
            settle('idle');
          } else if (isPermissionAsk(ev)) {
            // Pass the task spec + the agent's recent output tail so a `question`
            // ask can be routed to the spec-grounded responder with real context.
            await this.handlePermission(client, sessionId, ev, req.prompt, finalText.slice(-2000));
          }
        }
      } catch {
        /* aborted on completion/timeout — expected */
      }
    })();

    // Backstops fire ONLY on pathology — the executor self-terminates normally
    // via `session.idle` or the POST returning. The idle-watchdog measures
    // SILENCE (no events), never duration, so a long-but-active turn is safe.
    const watchdog = setInterval(() => {
      const now = Date.now();
      // Post-failure grace: a dead connection produces no further SSE — abort in
      // minutes, not 24h. A still-alive turn keeps streaming, refreshing lastEventAt.
      if (postFailedAt > 0 && now - Math.max(lastEventAt, postFailedAt) >= postFailureGraceMs) {
        settle('post_failed');
      } else if (now - lastEventAt >= idleMs) settle('idle_timeout');
      else if (now - started >= wallMs) settle('wallclock');
    }, tickMs);

    const model = parseModelRef(this.cfg.model);
    let finish = '';
    // Fire the turn. A SUCCESSFUL POST is a valid completion signal (the server
    // holds it open until the turn ends). A FAILED POST is logged but MUST NOT
    // terminate the turn — the SSE stream + watchdog remain authoritative, so a
    // transient client-side fetch error can't guillotine a healthy turn.
    void client
      .sendMessage(sessionId, { agent: this.cfg.agent, model, text: req.prompt })
      .then((r) => { finish = r.finish; settle('post'); })
      .catch((err) => {
        postFailedAt = Date.now();
        getLogger().warn('workflow', 'mimo sendMessage error (turn continues via SSE; post-failure grace armed)', {
          error: err instanceof Error ? err.message : String(err),
        });
      });

    await done;
    clearInterval(watchdog);
    // `completion` is assigned ONLY inside the watchdog + POST closures above,
    // which TS control-flow analysis can't follow — at this point it still
    // narrows `completion` to its '' initializer, so a direct `=== 'idle_timeout'`
    // is (wrongly) flagged TS2367 "no overlap". Read it through a widened string
    // for the backstop comparison; the runtime value is the reason that settled.
    const completionReason: string = completion;
    const aborted = completionReason === 'idle_timeout' || completionReason === 'wallclock' || completionReason === 'post_failed';
    if (aborted) {
      getLogger().warn('workflow', 'mimo turn aborted by backstop', { reason: completion, sessionId, idleMs, wallMs });
      await client.abort(sessionId);
    } else if (!sawIdle) {
      // Completed via the POST — let any trailing SSE deltas / `session.idle` flush.
      await delay(1500);
    }
    sse.abort();
    await consume;

    let exitCode: number;
    if (aborted) {
      exitCode = 1;
    } else if (finish === 'stop' || finish === '') {
      exitCode = 0;
    } else {
      exitCode = 1;
    }

    return {
      tier: this.tier,
      exitCode,
      finalText: finalText || (finish ? `(${finish})` : ''),
      rawOutput: rawParts.join('\n'),
      timedOut: aborted,
      durationMs: Date.now() - started,
    };
  }

  private async handlePermission(
    client: MimoClient,
    sessionId: string,
    ev: MimoSseEvent,
    taskSpec: string,
    agentTail: string,
  ): Promise<void> {
    const ask = permissionAsk(ev);
    if (!ask) return;
    // The clarify-with-the-user `question` tool (attended → policy `ask`) routes to
    // the voice-of-intent reviewer + human escalation instead of the file/shell
    // decider — a distinct handler because it produces an ANSWER, not an approval.
    if (ask.tool === 'question') {
      await this.handleQuestion(client, sessionId, ask, taskSpec, agentTail);
      return;
    }
    // Static mode has no decider: deny any unexpected ask (safe — the static
    // policy should never produce one).
    let response: PermissionResponse = 'reject';
    if (this.decider) {
      try { response = await this.decider(ask); }
      catch { response = 'reject'; }
    }
    await client.respondPermission(sessionId, ask.permissionId, response);
  }

  /**
   * Route a `question` ask to the spec-grounded responder (and, if it can't
   * answer, the human-escalation sink), surface the Q+A for the audit trail, then
   * REJECT. mimo's compose API is non-conversational — a permission response is
   * approve/deny only, with NO channel to hand a text answer to the paused tool
   * call — so we cannot inject the reply the way the goose PTY types it. Rejecting
   * returns control to the agent, which self-resolves per the execution-mode
   * directive; the surfaced answer/human decision is recorded for review. This is
   * the concrete per-adapter idiosyncrasy: goose answers-and-injects; mimo
   * observes-and-escalates. Never leaves the permission unanswered (would stall).
   */
  private async handleQuestion(
    client: MimoClient,
    sessionId: string,
    ask: MimoPermissionAsk,
    taskSpec: string,
    agentTail: string,
  ): Promise<void> {
    const question = questionText(ask.raw);
    let answer: string | null = null;
    if (this.responder) {
      try {
        answer = sanitizeResponderReply(
          await this.responder({ kind: 'question', question, agentContext: agentTail, taskSpec }),
        );
      } catch { answer = null; }
    }
    if (!answer && this.onEscalate) {
      try { answer = await this.onEscalate({ question, agentContext: agentTail, taskSpec }); }
      catch { answer = null; }
    }
    this.opts.onLog?.({
      kind: 'data',
      chunk: `\n[executor question] ${question}\n[voice-of-intent] ${answer ?? '(unanswered — proceed with spec-grounded best judgment)'}\n`,
    });
    getLogger().info('workflow', 'mimo executor question surfaced (compose API cannot inject the reply; agent self-resolves)', {
      sessionId, answered: answer != null, question: question.slice(0, 300),
    });
    // Reject so the paused tool call returns control to the agent (see above).
    await client.respondPermission(sessionId, ask.permissionId, 'reject');
  }
}

/** Default relay resolver: surface the ask, answer per env (default `once`). */
export function defaultRelayDecider(onLog?: (e: SessionLogEvent) => void): MimoPermissionDecider {
  const env = process.env.JANUMICODE_MIMO_PERMISSION_DEFAULT;
  const response: PermissionResponse = env === 'always' || env === 'reject' ? env : 'once';
  return async (ask) => {
    onLog?.({ kind: 'data', chunk: `\n[mimo permission] ${ask.tool} ${ask.filepath} → ${response}\n` });
    getLogger().info('workflow', 'mimo permission ask auto-resolved (relay default)', {
      tool: ask.tool, filepath: ask.filepath, response,
    });
    return response;
  };
}

// ── Pure event helpers (exported for tests) ──────────────────────────

export function eventSessionId(ev: MimoSseEvent): string | undefined {
  const sid = (ev.properties as { sessionID?: unknown }).sessionID;
  return typeof sid === 'string' ? sid : undefined;
}

/**
 * A permission `ask` event. Live shape (probe B):
 * `{type:"permission.asked", properties:{ id:"per_…", sessionID, permission:"edit",
 *   patterns:[…], metadata:{ filepath, diff }, always:["*"], tool:{…} }}`.
 */
export function isPermissionAsk(ev: MimoSseEvent): boolean {
  return ev.type === 'permission.asked';
}

/**
 * Best-effort extraction of the question text from a `question` permission ask.
 * mimo's `/doc` is a 2-path stub, so the exact `question`-tool metadata shape is
 * not contractually pinned — probe the common carrier fields (metadata.question/
 * prompt/message/text/query, then top-level title/description) and fall back to a
 * generic prompt so the responder still receives a well-formed ResponderInput
 * even if the field name drifts. Exported for unit tests.
 */
export function questionText(ev: MimoSseEvent): string {
  const p = ev.properties as { metadata?: Record<string, unknown>; title?: unknown; description?: unknown };
  const md = p.metadata ?? {};
  for (const k of ['question', 'prompt', 'message', 'text', 'query']) {
    const v = md[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  if (typeof p.title === 'string' && p.title.trim()) return p.title.trim();
  if (typeof p.description === 'string' && p.description.trim()) return p.description.trim();
  return 'The agent requested clarification (question text unavailable).';
}

export function permissionAsk(ev: MimoSseEvent): MimoPermissionAsk | null {
  if (!isPermissionAsk(ev)) return null;
  const p = ev.properties as {
    id?: unknown; permission?: unknown; metadata?: { filepath?: unknown };
  };
  const permissionId = typeof p.id === 'string' ? p.id : '';
  if (!permissionId) return null;
  return {
    permissionId,
    tool: typeof p.permission === 'string' ? p.permission : '',
    filepath: typeof p.metadata?.filepath === 'string' ? p.metadata.filepath : '',
    raw: ev,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
