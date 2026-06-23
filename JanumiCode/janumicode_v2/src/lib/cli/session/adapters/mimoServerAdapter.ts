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
import { parseModelRef, type MimoClient, type MimoSseEvent, type PermissionResponse } from '../../mimo/mimoClient';
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
   * Relay-mode permission resolver. When `permissionMode === 'relay'` and this
   * is absent, a default resolver surfaces each ask (via `onLog`) and answers
   * with `JANUMICODE_MIMO_PERMISSION_DEFAULT` (default `once`). Inject a
   * human-routed resolver here for true supervised approval.
   */
  permissionDecider?: MimoPermissionDecider;
}

export class MimoServerAdapter implements ExecutorAdapter {
  readonly tier: AdapterTier = 'agentic_server';
  private readonly cfg: MimoConfig;

  private readonly decider?: MimoPermissionDecider;

  constructor(private readonly opts: MimoServerAdapterOptions = {}) {
    this.cfg = opts.config ?? resolveMimoConfig();
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

    const sse = new AbortController();
    let finalText = '';
    const rawParts: string[] = [];
    let sawIdle = false;
    let idleResolve: (() => void) | undefined;
    const idle = new Promise<void>((r) => { idleResolve = r; });

    // Consume SSE concurrently: forward text → onLog, accumulate final text,
    // resolve on this session's `session.idle`, route permission asks.
    const consume = (async () => {
      try {
        for await (const ev of client.streamEvents(sse.signal)) {
          if (eventSessionId(ev) && eventSessionId(ev) !== sessionId) continue;
          rawParts.push(JSON.stringify(ev));
          if (ev.type === 'message.part.delta') {
            const p = ev.properties as { field?: string; delta?: string };
            if (p.field === 'text' && typeof p.delta === 'string') {
              finalText += p.delta;
              this.opts.onLog?.({ kind: 'data', chunk: p.delta });
            }
          } else if (ev.type === 'session.idle') {
            sawIdle = true;
            idleResolve?.();
          } else if (isPermissionAsk(ev)) {
            await this.handlePermission(client, sessionId, ev);
          }
        }
      } catch {
        /* aborted on completion/timeout — expected */
      }
    })();

    const model = parseModelRef(this.cfg.model);
    const timeoutMs = Math.max((req.timeoutSeconds ?? 1800), 60) * 1000;
    let timedOut = false;
    const timeout = new Promise<void>((resolve) => setTimeout(() => { timedOut = true; resolve(); }, timeoutMs));

    let finish = '';
    const send = client
      .sendMessage(sessionId, { agent: this.cfg.agent, model, text: req.prompt })
      .then((r) => { finish = r.finish; })
      .catch((err) => { getLogger().warn('workflow', 'mimo sendMessage error', { error: err instanceof Error ? err.message : String(err) }); });

    // Completion = the message POST returns OR session.idle OR timeout.
    await Promise.race([send, idle, timeout]);
    if (timedOut) {
      await client.abort(sessionId);
    } else {
      // settle the POST and let any trailing idle flush briefly
      await Promise.race([send, delay(2000)]);
      if (!sawIdle) await Promise.race([idle, delay(1500)]);
    }
    sse.abort();
    await consume;

    return {
      tier: this.tier,
      exitCode: timedOut ? 1 : (finish === 'stop' || finish === '' ? 0 : 1),
      finalText: finalText || (finish ? `(${finish})` : ''),
      rawOutput: rawParts.join('\n'),
      timedOut,
      durationMs: Date.now() - started,
    };
  }

  private async handlePermission(client: MimoClient, sessionId: string, ev: MimoSseEvent): Promise<void> {
    const ask = permissionAsk(ev);
    if (!ask) return;
    // Static mode has no decider: deny any unexpected ask (safe — the static
    // policy should never produce one).
    let response: PermissionResponse = 'reject';
    if (this.decider) {
      try { response = await this.decider(ask); }
      catch { response = 'reject'; }
    }
    await client.respondPermission(sessionId, ask.permissionId, response);
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
