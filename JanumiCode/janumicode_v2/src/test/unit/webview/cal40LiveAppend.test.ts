/**
 * Live-append stress V&V (gated on JANUMICODE_CAL40_DB).
 *
 * Exercises the FULL production live-append path end to end against the real
 * cal-40 clone, with the webview replaced by a real RecordsStore:
 *
 *   ReplayDriver.start()  → engine.eventBus.emit('record:added')
 *                         → provider `record:added` subscriber
 *                         → post({type:'addRecord', record})
 *                         → (fake webview) recordsStore.add(record)
 *
 * The store must stay ≤ cap AT EVERY STEP while all 9.5k real records stream
 * in — this is the original crash scenario (records arriving one-by-one and the
 * webview array growing without bound), now proven bounded on real data.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'node:fs';
import * as vscode from 'vscode';
import {
  GovernedStreamViewProvider,
  type WorkflowSession,
} from '../../../lib/webview/governedStreamViewProvider';
import { DecisionRouter } from '../../../lib/orchestrator/decisionRouter';
import { ReplayDriver } from '../../../lib/replay/replayDriver';
import { createTestEngine, type TestEngine } from '../../helpers/createTestEngine';
import { RecordsStore, type SerializedRecord } from '../../../webview/stores/records.svelte';

const CAL40 = process.env.JANUMICODE_CAL40_DB;
const run = CAL40 && fs.existsSync(CAL40) ? describe : describe.skip;

run('cal-40 live-append stress (gated on JANUMICODE_CAL40_DB)', () => {
  let te: TestEngine;
  let provider: GovernedStreamViewProvider;
  let store: RecordsStore;
  let runId: string;
  let fireReady: () => Promise<void>;
  const prevAppend = process.env.JANUMICODE_REPLAY_APPEND;

  beforeAll(async () => {
    // Append mode → handleWebviewReady starts the view EMPTY (no snapshot), so
    // every record arrives as a fresh delta through add().
    process.env.JANUMICODE_REPLAY_APPEND = '1';
    te = await createTestEngine({ dbPath: CAL40 });
    runId = (te.db.prepare('SELECT id FROM workflow_runs ORDER BY rowid LIMIT 1').get() as { id: string }).id;

    store = new RecordsStore(400);
    // Fake webview: route addRecord to the store exactly as App.svelte does;
    // ignore the empty snapshot / phase messages.
    let inbound: ((m: unknown) => void | Promise<void>) | null = null;
    const webview = {
      options: {}, html: '', cspSource: 'x', asWebviewUri: (u: vscode.Uri) => u,
      onDidReceiveMessage: (h: (m: unknown) => void | Promise<void>) => { inbound = h; return { dispose() {} }; },
      postMessage: async (m: unknown) => {
        const msg = m as { type: string; record?: SerializedRecord };
        if (msg.type === 'addRecord' && msg.record) store.add(msg.record);
        return true;
      },
    } as unknown as vscode.Webview;
    const view = { webview, onDidDispose: () => ({ dispose() {} }), visible: true, show: () => {} } as unknown as vscode.WebviewView;

    const session: WorkflowSession = { currentRunId: null };
    provider = new GovernedStreamViewProvider(
      vscode.Uri.file('/ext'),
      te.engine, te.db, te.liaison, new DecisionRouter(te.engine),
      session, 'ws', '/ws',
    );
    provider.resolveWebviewView(view);
    fireReady = async () => {
      if (!inbound) throw new Error('no handler');
      await inbound({ type: 'webviewReady' });
    };
  });

  afterAll(() => {
    if (prevAppend === undefined) delete process.env.JANUMICODE_REPLAY_APPEND;
    else process.env.JANUMICODE_REPLAY_APPEND = prevAppend;
    te?.cleanup();
  });

  it('stays bounded at every step while the full real run streams in', async () => {
    await fireReady();
    // Append mode must NOT stream the snapshot. It posts an empty one; a
    // handful of records may still arrive via async engine emissions during
    // startup (esp. on a more-complete phase-9 clone), so we assert the real
    // invariant — the window is nowhere near cap and no head-drop has fired —
    // rather than literal emptiness. A real "streamed the whole snapshot"
    // regression would fill the window to cap (400) and set hasOlder.
    expect(store.count).toBeLessThan(100);
    expect(store.hasOlder).toBe(false);

    const total = (te.db.prepare(
      'SELECT COUNT(*) AS n FROM governed_stream WHERE workflow_run_id = ? AND is_current_version = 1',
    ).get(runId) as { n: number }).n;

    const driver = new ReplayDriver({
      db: te.db, eventBus: te.engine.eventBus, runId, intervalMs: 4, batchSize: 100,
    });

    vi.useFakeTimers();
    let peak = 0;
    let ticks = 0;
    try {
      driver.start();
      while (store.totalCount < total && ticks < 100_000) {
        vi.advanceTimersByTime(4); // fire one batch
        peak = Math.max(peak, store.count);
        // The invariant under test: the window NEVER exceeds cap mid-stream.
        expect(store.count).toBeLessThanOrEqual(400);
        ticks++;
      }
    } finally {
      driver.stop();
      vi.useRealTimers();
    }

    // eslint-disable-next-line no-console
    console.log(`[cal-40 live-append] streamed ${store.totalCount}/${total} real records; peak window=${peak}; final window=${store.count}`);
    expect(store.totalCount).toBe(total);     // every record was delivered…
    expect(store.count).toBeLessThanOrEqual(400); // …but the window stayed bounded
    expect(peak).toBeLessThanOrEqual(400);
    expect(store.hasOlder).toBe(true);        // older records were dropped from the window
  }, 60_000);
});
