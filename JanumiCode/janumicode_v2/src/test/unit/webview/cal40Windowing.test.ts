/**
 * Real-data V&V for the governed-stream pagination fix.
 *
 * Drives the ACTUAL GovernedStreamViewProvider against a real ~230 MB cal-40
 * clone and proves the windowed snapshot + keyset load-older stay bounded on
 * real record shapes (not synthetic). Gated on JANUMICODE_CAL40_DB (the clone
 * produced by scripts/replay/prep-replay-db.mjs); skips cleanly when absent so
 * it never blocks CI (we commit no fixtures).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as vscode from 'vscode';
import {
  GovernedStreamViewProvider,
  type WorkflowSession,
} from '../../../lib/webview/governedStreamViewProvider';
import { DecisionRouter } from '../../../lib/orchestrator/decisionRouter';
import { createTestEngine, type TestEngine } from '../../helpers/createTestEngine';
import { RecordsStore, type SerializedRecord } from '../../../webview/stores/records.svelte';

interface PostedMessage { type: string; [key: string]: unknown; }

function makeFakeWebviewView(): {
  view: vscode.WebviewView;
  posted: PostedMessage[];
  fire: (msg: unknown) => Promise<void>;
} {
  const posted: PostedMessage[] = [];
  let inbound: ((msg: unknown) => void | Promise<void>) | null = null;
  const webview = {
    options: {}, html: '', cspSource: 'vscode-webview://test',
    asWebviewUri: (u: vscode.Uri) => u,
    onDidReceiveMessage: (h: (m: unknown) => void | Promise<void>) => { inbound = h; return { dispose() {} }; },
    postMessage: async (m: unknown) => { posted.push(m as PostedMessage); return true; },
  } as unknown as vscode.Webview;
  const view = {
    webview,
    onDidDispose: () => ({ dispose() {} }),
    visible: true, show: () => {},
  } as unknown as vscode.WebviewView;
  return { view, posted, fire: async (m) => { if (!inbound) throw new Error('no handler'); await inbound(m); } };
}

const CAL40 = process.env.JANUMICODE_CAL40_DB;
const run = CAL40 && fs.existsSync(CAL40) ? describe : describe.skip;

run('cal-40 real-data windowing (gated on JANUMICODE_CAL40_DB)', () => {
  let te: TestEngine;
  let provider: GovernedStreamViewProvider;
  let posted: PostedMessage[];
  let fire: (m: unknown) => Promise<void>;

  beforeAll(async () => {
    te = await createTestEngine({ dbPath: CAL40 });
    const session: WorkflowSession = { currentRunId: null }; // force DB-as-truth resolution
    provider = new GovernedStreamViewProvider(
      vscode.Uri.file('/ext') as unknown as vscode.Uri,
      te.engine, te.db, te.liaison, new DecisionRouter(te.engine),
      session, 'ws', '/ws',
    );
    const fake = makeFakeWebviewView();
    posted = fake.posted;
    fire = fake.fire;
    provider.resolveWebviewView(fake.view);
  });

  afterAll(() => { te?.cleanup(); });

  it('resolves the run and delivers only the latest window, memory-bounded', async () => {
    const heapBefore = process.memoryUsage().heapUsed;
    await fire({ type: 'webviewReady' });
    const heapDelta = process.memoryUsage().heapUsed - heapBefore;

    const start = posted.find(m => m.type === 'snapshotStart')!;
    const total = start.totalCount as number;
    const windowSize = start.windowSize as number;
    const delivered = posted
      .filter(m => m.type === 'snapshotChunk')
      .reduce((n, m) => n + (m.records as unknown[]).length, 0);

    // Ground truth: the clone has thousands of current-version rows across
    // several phases; we deliver only the window.
    expect(total).toBeGreaterThan(1000);
    expect(delivered).toBe(Math.min(total, windowSize));
    expect(delivered).toBeLessThanOrEqual(windowSize);
    // No legacy unbounded 'snapshot' message.
    expect(posted.filter(m => m.type === 'snapshot').length).toBe(0);

    // Compare bytes: the window is a tiny fraction of the full run's content.
    const fullBytes = (te.db.prepare(
      `SELECT COALESCE(SUM(LENGTH(content)),0) AS b FROM governed_stream
        WHERE workflow_run_id = (SELECT id FROM workflow_runs ORDER BY rowid LIMIT 1) AND is_current_version = 1`,
    ).get() as { b: number }).b;
    const windowBytes = posted.filter(m => m.type === 'snapshotChunk')
      .flatMap(m => m.records as Array<{ content: unknown }>)
      .reduce((n, r) => n + JSON.stringify(r.content).length, 0);

    // eslint-disable-next-line no-console
    console.log(`[cal-40 V&V] total=${total} delivered=${delivered} windowBytes=${(windowBytes/1e6).toFixed(1)}MB fullBytes=${(fullBytes/1e6).toFixed(1)}MB heapDelta=${(heapDelta/1e6).toFixed(1)}MB`);
    expect(windowBytes).toBeLessThan(fullBytes); // window << full run
    // Windowed load must not balloon the JS heap the way loading all rows did.
    expect(heapDelta).toBeLessThan(150 * 1e6);
  });

  it('bounds the store while feeding the FULL real run through add() (crash-site repro→resolve)', () => {
    const rows = te.db.prepare(
      `SELECT id, record_type, phase_id, sub_phase_id, produced_by_agent_role, produced_at,
              authority_level, quarantined, derived_from_record_ids, content
         FROM governed_stream
        WHERE workflow_run_id = (SELECT id FROM workflow_runs ORDER BY rowid LIMIT 1)
          AND is_current_version = 1
        ORDER BY produced_at ASC, id ASC`,
    ).all() as Array<Record<string, unknown>>;

    const store = new RecordsStore(400);
    const heapBefore = process.memoryUsage().heapUsed;
    const t0 = performance.now();
    for (const r of rows) {
      let content: Record<string, unknown> = {};
      try { content = JSON.parse(r.content as string) as Record<string, unknown>; } catch { /* */ }
      let derived: string[] = [];
      try { derived = JSON.parse((r.derived_from_record_ids as string) ?? '[]') as string[]; } catch { /* */ }
      const rec: SerializedRecord = {
        id: r.id as string,
        record_type: r.record_type as string,
        phase_id: (r.phase_id as string) || null,
        sub_phase_id: (r.sub_phase_id as string) || null,
        produced_by_agent_role: (r.produced_by_agent_role as string) || null,
        produced_at: r.produced_at as string,
        authority_level: (r.authority_level as number) ?? 1,
        quarantined: !!(r.quarantined as number),
        derived_from_record_ids: derived,
        content,
      };
      store.add(rec); // this is the exact O(n²) path the old store took
    }
    const elapsed = performance.now() - t0;
    const heapDelta = process.memoryUsage().heapUsed - heapBefore;
    // eslint-disable-next-line no-console
    console.log(`[cal-40 store] fed ${rows.length} real records in ${elapsed.toFixed(0)}ms; window=${store.count}; heapDelta=${(heapDelta / 1e6).toFixed(1)}MB`);

    // The store stayed bounded no matter how many real records arrived.
    expect(store.count).toBeLessThanOrEqual(400);
    expect(store.totalCount).toBe(rows.length);
    // Real records exercise every relationship helper — none may throw, and an
    // invocation in the window must still resolve its children.
    for (const rec of store.records) {
      if (rec.record_type === 'agent_invocation') expect(Array.isArray(store.getChildren(rec.id))).toBe(true);
    }
    // Feeding a whole run must be fast (the pre-fix O(n²) path blows this budget).
    expect(elapsed).toBeLessThan(4000);
  });

  it('loadOlder returns an older keyset page disjoint from the window', async () => {
    const window = posted.filter(m => m.type === 'snapshotChunk')
      .flatMap(m => m.records as Array<{ id: string; produced_at: string }>);
    const oldest = window[0];
    posted.length = 0;
    await fire({ type: 'loadOlder', beforeProducedAt: oldest.produced_at, beforeId: oldest.id, limit: 200 });
    const older = posted.find(m => m.type === 'olderRecords') as
      | { records: Array<{ id: string }>; hasMore: boolean } | undefined;
    expect(older).toBeDefined();
    expect(older!.records.length).toBeGreaterThan(0);
    const windowIds = new Set(window.map(r => r.id));
    expect(older!.records.every(r => !windowIds.has(r.id))).toBe(true);
  });
});
