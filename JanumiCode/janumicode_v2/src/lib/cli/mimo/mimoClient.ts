/**
 * HTTP + SSE client for a running `mimo serve` (mimocode/OpenCode) instance.
 *
 * The Phase-9 mimo executor adapter drives a coding agent through the server
 * API rather than the fragile PTY TUI: create a session, POST a message
 * (agent=compose), and consume the global SSE `/event` stream — which delivers
 * fully structured events (text deltas, tool calls, file edits, session.idle)
 * that the `mimo run --format json` client hangs on for compose.
 *
 * Endpoints (discovered empirically — `/doc` is a 2-path stub):
 *   POST /session                                  → { id, directory, ... }
 *   POST /session/{id}/message                     → blocks to completion, returns the assistant message
 *   GET  /event                                    → SSE: `data: {type, properties}` per line (GLOBAL — filter by sessionID)
 *   POST /session/{id}/abort                       → cancel the running turn
 *   POST /session/{id}/permissions/{permissionID}  → answer a permission `ask`
 *
 * Transport-only: event interpretation lives in the adapter. Uses the global
 * `fetch` (Node 18+); injectable for tests.
 */

export interface MimoModel {
  providerID: string;
  modelID: string;
}

/** Parse a `provider/model` string (e.g. `mimo/mimo-auto`) into its parts. */
export function parseModelRef(ref: string): MimoModel {
  const slash = ref.indexOf('/');
  if (slash < 0) return { providerID: 'mimo', modelID: ref };
  return { providerID: ref.slice(0, slash), modelID: ref.slice(slash + 1) };
}

/** A decoded SSE event: every line is `data: {"type":..,"properties":{..}}`. */
export interface MimoSseEvent {
  type: string;
  properties: Record<string, unknown>;
}

export type PermissionResponse = 'once' | 'always' | 'reject';

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** Strip trailing `/` characters in linear time (ReDoS-safe replacement for `/\/+$/`). */
function stripTrailingSlashes(s: string): string {
  let end = s.length;
  while (end > 0 && s.codePointAt(end - 1) === 47) end--;
  return s.slice(0, end);
}

/**
 * A `compose` turn (research→plan→implement) can legitimately run for a long
 * time. Node's global `fetch` (undici) applies a default 300s
 * `headersTimeout`/`bodyTimeout`, so the blocking `sendMessage` POST — which the
 * server holds open until the turn finishes — was aborted at ~5 min with a
 * generic `fetch failed`, guillotining the executor mid-generation. A dedicated
 * Agent with both timeouts disabled keeps that connection alive; turn duration
 * is instead governed by the adapter's idle-watchdog + wall-clock backstop.
 *
 * CRITICAL: the no-timeout `Agent` MUST be paired with undici's OWN `fetch`, not
 * Node's BUILT-IN global `fetch`. Node bundles its own (older) undici; attaching
 * a dispatcher from the standalone `undici` package to global `fetch` throws
 * `invalid onRequestStart method` ("fetch failed") whenever the two undici
 * versions differ (observed: pkg 8.x vs Node built-in 7.x) — which silently
 * broke EVERY long-running turn-submit. Using `undici.fetch` keeps the client
 * and the dispatcher on the same undici version. Lazily constructed so tests
 * with an injected `fetchImpl` never load undici.
 */
let undiciLongRunning: { fetch: FetchLike; dispatcher: unknown } | null | undefined;
function getUndiciLongRunningClient(): { fetch: FetchLike; dispatcher: unknown } | null {
  if (undiciLongRunning === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const u = require('undici') as { fetch: FetchLike; Agent: new (o: unknown) => unknown };
      undiciLongRunning = { fetch: u.fetch, dispatcher: new u.Agent({ headersTimeout: 0, bodyTimeout: 0 }) };
    } catch {
      undiciLongRunning = null; // undici unavailable → default fetch (300s) applies
    }
  }
  return undiciLongRunning;
}

export class MimoClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {
    this.baseUrl = stripTrailingSlashes(baseUrl);
  }

  /**
   * `longRunning` POSTs (the turn-blocking `sendMessage`) use the no-timeout
   * dispatcher so undici's default 300s body/headers timeout can't abort them.
   */
  private async postJson(path: string, body: unknown, longRunning = false): Promise<Response> {
    const init: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    };
    const url = `${this.baseUrl}${path}`;
    // Long-running POSTs (the turn-blocking `sendMessage`) go through undici's
    // OWN fetch + no-timeout Agent so the 300s body/headers cap can't abort them.
    // Only when using the REAL global fetch — a test-injected `fetchImpl` (or a
    // non-undici runtime) is used verbatim with the default timeout.
    if (longRunning && this.fetchImpl === fetch) {
      const u = getUndiciLongRunningClient();
      if (u) return u.fetch(url, { ...init, dispatcher: u.dispatcher } as RequestInit);
    }
    return this.fetchImpl(url, init);
  }

  /** Create a session. Binds to the server's launch cwd (POST `directory` is ignored). */
  async createSession(): Promise<string> {
    const res = await this.postJson('/session', {});
    if (!res.ok) throw new Error(`mimo createSession failed: ${res.status} ${await safeText(res)}`);
    const json = (await res.json()) as { id?: string };
    if (!json.id) throw new Error('mimo createSession returned no id');
    return json.id;
  }

  /**
   * Send a message and await completion. The POST blocks until the agent
   * finishes its turn and returns the assistant message (`info.finish`). The
   * authoritative completion signal for streaming consumers is the SSE
   * `session.idle` event; this is the synchronous backstop.
   */
  async sendMessage(
    sessionId: string,
    opts: { agent: string; model: MimoModel; text: string },
  ): Promise<{ finish: string; info: Record<string, unknown> }> {
    const res = await this.postJson(`/session/${sessionId}/message`, {
      agent: opts.agent,
      model: opts.model,
      parts: [{ type: 'text', text: opts.text }],
    }, /* longRunning */ true);
    if (!res.ok) throw new Error(`mimo sendMessage failed: ${res.status} ${await safeText(res)}`);
    const json = (await res.json()) as { info?: Record<string, unknown> };
    const info = json.info ?? {};
    const finish =
      typeof info.finish === 'object' && info.finish !== null
        ? JSON.stringify(info.finish)
        : String((info.finish ?? '') as string | number | boolean);
    return { finish, info };
  }

  /** Cancel the running turn (used on timeout/idle-timeout). */
  async abort(sessionId: string): Promise<void> {
    try {
      await this.postJson(`/session/${sessionId}/abort`, {});
    } catch {
      /* best-effort */
    }
  }

  /** Answer a permission `ask` (relay/supervised mode). */
  async respondPermission(
    sessionId: string,
    permissionId: string,
    response: PermissionResponse,
  ): Promise<void> {
    await this.postJson(
      `/session/${sessionId}/permissions/${encodeURIComponent(permissionId)}`,
      { response },
    );
  }

  /**
   * Open the global SSE `/event` stream and yield decoded events until the
   * signal aborts or the stream ends. Caller filters by `properties.sessionID`.
   */
  async *streamEvents(signal?: AbortSignal): AsyncGenerator<MimoSseEvent> {
    const res = await this.fetchImpl(`${this.baseUrl}/event`, {
      headers: { Accept: 'text/event-stream' },
      signal,
    });
    if (!res.ok || !res.body) throw new Error(`mimo /event failed: ${res.status}`);
    yield* parseSse(byteStreamToText(res.body as ReadableStream<Uint8Array>));
  }
}

/** Decode an async byte stream to UTF-8 text chunks. */
async function* byteStreamToText(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  // ReadableStream is async-iterable in modern Node; fall back to a reader.
  const anyStream = stream as unknown as AsyncIterable<Uint8Array>;
  if (typeof anyStream[Symbol.asyncIterator] === 'function') {
    for await (const chunk of anyStream) yield decoder.decode(chunk, { stream: true });
    return;
  }
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    if (value) yield decoder.decode(value, { stream: true });
  }
}

/**
 * SSE line parser (pure, testable): buffers partial lines across chunks and
 * yields one decoded event per `data: {json}` line. mimo emits single-line
 * JSON payloads; malformed lines are skipped.
 */
export async function* parseSse(chunks: AsyncIterable<string>): AsyncGenerator<MimoSseEvent> {
  let buffer = '';
  for await (const chunk of chunks) {
    buffer += chunk;
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).replace(/\r$/, '');
      buffer = buffer.slice(nl + 1);
      const ev = decodeSseLine(line);
      if (ev) yield ev;
    }
  }
  const ev = decodeSseLine(buffer.replace(/\r$/, ''));
  if (ev) yield ev;
}

function decodeSseLine(line: string): MimoSseEvent | null {
  if (!line.startsWith('data:')) return null;
  const payload = line.slice(5).trimStart();
  if (!payload) return null;
  try {
    const obj = JSON.parse(payload) as Partial<MimoSseEvent>;
    if (obj && typeof obj.type === 'string') {
      return { type: obj.type, properties: (obj.properties as Record<string, unknown>) ?? {} };
    }
  } catch {
    /* skip non-JSON keepalives / partials */
  }
  return null;
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return '';
  }
}
