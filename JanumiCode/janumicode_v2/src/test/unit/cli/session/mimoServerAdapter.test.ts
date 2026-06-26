import { describe, it, expect, vi } from 'vitest';
import { eventSessionId, isPermissionAsk, permissionAsk, defaultRelayDecider, MimoServerAdapter } from '../../../../lib/cli/session/adapters/mimoServerAdapter';
import type { MimoSseEvent } from '../../../../lib/cli/mimo/mimoClient';
import type { ExecutorTaskRequest } from '../../../../lib/cli/session/adapter';

const ev = (type: string, properties: Record<string, unknown>): MimoSseEvent => ({ type, properties });

// ── run() lifecycle tests: completion = self-report (session.idle / POST),
//    backstops = idle-watchdog + wall-clock (Option 4). Mock the server manager
//    so no real `mimo serve` is spawned; drive a fake client per test. ──
let currentClient: unknown = null;
vi.mock('../../../../lib/cli/mimo/mimoServerManager', async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, MimoServerManager: { ensure: async () => ({ client: currentClient, baseUrl: 'http://x', proc: {} }) } };
});

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface FakeOpts { send: 'resolve' | 'reject' | 'hang'; finish?: string }
class FakeClient {
  aborted = false;
  constructor(private readonly events: MimoSseEvent[], private readonly o: FakeOpts) {}
  async createSession() { return 'ses_1'; }
  async *streamEvents(signal: AbortSignal): AsyncGenerator<MimoSseEvent> {
    for (const e of this.events) { yield e; await delay(3); }
    // Stay open (like a live SSE stream) until the adapter aborts it.
    await new Promise<void>((res) => {
      if (signal.aborted) return res();
      signal.addEventListener('abort', () => res(), { once: true });
    });
  }
  async sendMessage(): Promise<{ finish: string; info: Record<string, unknown> }> {
    if (this.o.send === 'reject') throw new Error('fetch failed');
    if (this.o.send === 'hang') return new Promise(() => { /* never resolves */ });
    await delay(3);
    return { finish: this.o.finish ?? 'stop', info: {} };
  }
  async abort() { this.aborted = true; }
  async respondPermission() { /* noop */ }
}

const cfg = { binary: 'mimo', model: 'mimo/mimo-auto', agent: 'compose', permissionMode: 'static' as const };
const reqFor = (extra: Partial<ExecutorTaskRequest> = {}): ExecutorTaskRequest =>
  ({ cwd: '/proj', prompt: 'implement it', ...extra } as unknown as ExecutorTaskRequest);

describe('MimoServerAdapter.run — self-termination + backstops', () => {
  it('completes on session.idle (self-report), not a wall-clock', async () => {
    currentClient = new FakeClient([ev('message.part.delta', { sessionID: 'ses_1', field: 'text', delta: 'hello world' }), ev('session.idle', { sessionID: 'ses_1' })], { send: 'hang' });
    const adapter = new MimoServerAdapter({ config: cfg, idleTimeoutMs: 5000, wallclockTimeoutMs: 6000, watchdogTickMs: 10 });
    const out = await adapter.run(reqFor());
    expect(out.timedOut).toBe(false);
    expect(out.exitCode).toBe(0);
    expect(out.finalText).toContain('hello world');
    expect((currentClient as FakeClient).aborted).toBe(false);
  });

  it('idle-watchdog aborts a silent (zero-event) turn via the proper abort path', async () => {
    currentClient = new FakeClient([], { send: 'hang' }); // no events, POST never returns
    const adapter = new MimoServerAdapter({ config: cfg, idleTimeoutMs: 40, wallclockTimeoutMs: 10_000, watchdogTickMs: 10 });
    const out = await adapter.run(reqFor());
    expect(out.timedOut).toBe(true);
    expect(out.exitCode).toBe(1);
    expect((currentClient as FakeClient).aborted).toBe(true);
  });

  it('honors req.idleTimeoutSeconds (shared policy from AgentInvoker) when no opt override', async () => {
    currentClient = new FakeClient([], { send: 'hang' }); // silent turn → idle-watchdog
    // No idleTimeoutMs opt → the adapter must use req.idleTimeoutSeconds (40ms here).
    const adapter = new MimoServerAdapter({ config: cfg, watchdogTickMs: 10 });
    const out = await adapter.run(reqFor({ idleTimeoutSeconds: 0.04, timeoutSeconds: 10 }));
    expect(out.timedOut).toBe(true);
    expect((currentClient as FakeClient).aborted).toBe(true);
  });

  it('a FAILED sendMessage POST is non-terminal when SSE still completes the turn', async () => {
    currentClient = new FakeClient([ev('message.part.delta', { sessionID: 'ses_1', field: 'text', delta: 'partial' }), ev('session.idle', { sessionID: 'ses_1' })], { send: 'reject' });
    const adapter = new MimoServerAdapter({ config: cfg, idleTimeoutMs: 5000, wallclockTimeoutMs: 6000, watchdogTickMs: 10 });
    const out = await adapter.run(reqFor());
    expect(out.timedOut).toBe(false);          // POST rejection did NOT trip a backstop — SSE idle won
    expect((currentClient as FakeClient).aborted).toBe(false);
    expect(out.finalText).toContain('partial');
  });

  it('post-failure grace aborts a DEAD connection (POST failed + no SSE) without waiting out the 24h idle', async () => {
    // POST rejects and the SSE stream yields nothing → the connection is dead.
    // The grace must abort in ~ms here (env override), NOT after the 24h idle.
    process.env.JANUMICODE_EXECUTOR_POST_FAILURE_GRACE_S = '0.03';
    try {
      currentClient = new FakeClient([], { send: 'reject' });
      const adapter = new MimoServerAdapter({ config: cfg, idleTimeoutMs: 60_000, wallclockTimeoutMs: 70_000, watchdogTickMs: 10 });
      const out = await adapter.run(reqFor());
      expect(out.timedOut).toBe(true);                       // grace tripped, not the 24h idle
      expect((currentClient as FakeClient).aborted).toBe(true);
    } finally {
      delete process.env.JANUMICODE_EXECUTOR_POST_FAILURE_GRACE_S;
    }
  });
});

describe('MimoServerAdapter event helpers', () => {
  it('eventSessionId reads properties.sessionID', () => {
    expect(eventSessionId(ev('session.idle', { sessionID: 'ses_9' }))).toBe('ses_9');
    expect(eventSessionId(ev('file.edited', { file: 'x' }))).toBeUndefined();
  });

  it('isPermissionAsk recognizes only permission.asked', () => {
    expect(isPermissionAsk(ev('permission.asked', {}))).toBe(true);
    expect(isPermissionAsk(ev('permission.replied', {}))).toBe(false);
    expect(isPermissionAsk(ev('message.part.delta', {}))).toBe(false);
  });

  it('permissionAsk extracts id, tool, filepath from the live shape', () => {
    const live = ev('permission.asked', {
      id: 'per_abc', sessionID: 'ses_1', permission: 'edit',
      patterns: ['Users\\x'], metadata: { filepath: 'C:/proj/add.go', diff: '...' }, always: ['*'],
    });
    expect(permissionAsk(live)).toMatchObject({ permissionId: 'per_abc', tool: 'edit', filepath: 'C:/proj/add.go' });
  });

  it('permissionAsk returns null for non-asks or missing id', () => {
    expect(permissionAsk(ev('message.updated', {}))).toBeNull();
    expect(permissionAsk(ev('permission.asked', { permission: 'edit' }))).toBeNull();
  });

  it('defaultRelayDecider answers per env (default once) and logs the ask', async () => {
    const logs: string[] = [];
    const decider = defaultRelayDecider((e) => { if (e.kind === 'data') logs.push(e.chunk); });
    const res = await decider({ permissionId: 'per_1', tool: 'edit', filepath: '/p/x.go', raw: ev('permission.asked', {}) });
    expect(res).toBe('once'); // default
    expect(logs.join('')).toMatch(/permission.*edit/);
  });

  it('constructs without side effects (server starts lazily in run)', () => {
    const adapter = new MimoServerAdapter({ config: { binary: 'mimo', model: 'mimo/mimo-auto', agent: 'compose', permissionMode: 'static' } });
    expect(adapter.tier).toBe('agentic_server');
  });
});
