/**
 * Regression test for the paginated snapshot protocol.
 *
 * The bug this guards against: `loadAllRecordsForRun` returned every row
 * for a workflow in one shot, then `webviewReady` posted them as a single
 * `snapshot` message. When the governed_stream grew past ~5K rows (which
 * happened quickly with per-token chunk persistence), the response payload
 * exceeded the SharedArrayBuffer the sidecar RPC bridge uses to ferry
 * results back to the extension host, surfacing as `RPC error: offset is
 * out of bounds` on the next webview restore.
 *
 * The fix paginates the load via `LIMIT/OFFSET` and emits the snapshot to
 * the webview as a sequence:
 *
 *   snapshotStart → snapshotChunk × N → snapshotComplete
 *
 * This test pins the protocol order, the page-size boundary, and the
 * cumulative record count so a future "let's just send it all again"
 * refactor can't silently re-introduce the overflow.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import {
  GovernedStreamViewProvider,
  type WorkflowSession,
} from '../../../lib/webview/governedStreamViewProvider';
import { DecisionRouter } from '../../../lib/orchestrator/decisionRouter';
import { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import { createTestEngine, type TestEngine } from '../../helpers/createTestEngine';

interface PostedMessage { type: string; [key: string]: unknown; }

function makeFakeWebviewView(): {
  view: vscode.WebviewView;
  posted: PostedMessage[];
  fire: (msg: unknown) => Promise<void>;
  dispose: () => void;
} {
  const posted: PostedMessage[] = [];
  let inboundHandler: ((msg: unknown) => void | Promise<void>) | null = null;
  let disposeHandler: (() => void) | null = null;

  const webview = {
    options: {} as vscode.WebviewOptions,
    html: '',
    cspSource: 'vscode-webview://test',
    asWebviewUri: (uri: vscode.Uri) => uri,
    onDidReceiveMessage: (handler: (msg: unknown) => void | Promise<void>) => {
      inboundHandler = handler;
      return { dispose: () => { inboundHandler = null; } };
    },
    postMessage: async (msg: unknown) => {
      posted.push(msg as PostedMessage);
      return true;
    },
  } as unknown as vscode.Webview;

  const view = {
    webview,
    onDidDispose: (handler: () => void) => {
      disposeHandler = handler;
      return { dispose: () => { disposeHandler = null; } };
    },
    visible: true,
    show: () => {},
  } as unknown as vscode.WebviewView;

  return {
    view,
    posted,
    fire: async (msg) => {
      if (!inboundHandler) throw new Error('no inbound handler registered');
      await inboundHandler(msg);
    },
    dispose: () => { if (disposeHandler) disposeHandler(); },
  };
}

let idCounter = 0;
function testId(): string { return `pag-${++idCounter}`; }

describe('GovernedStreamViewProvider — paginated snapshot', () => {
  let te: TestEngine;
  let provider: GovernedStreamViewProvider;
  let session: WorkflowSession;
  let fake: ReturnType<typeof makeFakeWebviewView>;
  let runId: string;

  beforeEach(async () => {
    idCounter = 0;
    te = await createTestEngine({});
    runId = 'run-snap-1';

    // Seed a workflow run + enough records to span multiple pages
    // (PAGE_SIZE in the provider is 500). 1300 lands on three pages
    // (500 + 500 + 300) so we can assert the shape isn't off-by-one.
    te.db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES (?, 'ws-1', 'dev', '2026-01-01T00:00:00Z', 'in_progress')
    `).run(runId);

    const writer = new GovernedStreamWriter(te.db, testId);
    for (let i = 0; i < 1300; i++) {
      writer.writeRecord({
        record_type: 'agent_invocation',
        schema_version: '1.0',
        workflow_run_id: runId,
        phase_id: '1',
        janumicode_version_sha: 'dev',
        content: { sequence: i, label: `inv-${i}` },
      });
    }

    session = { currentRunId: runId };
    const decisionRouter = new DecisionRouter(te.engine);
    provider = new GovernedStreamViewProvider(
      vscode.Uri.file('/ext') as unknown as vscode.Uri,
      te.engine,
      te.db,
      te.liaison,
      decisionRouter,
      session,
      'ws-1',
      '/ws',
    );
    fake = makeFakeWebviewView();
    provider.resolveWebviewView(fake.view);
  });

  afterEach(() => {
    fake.dispose();
    te.cleanup();
  });

  it('emits snapshotStart → snapshotChunk × N → snapshotComplete in order', async () => {
    await fake.fire({ type: 'webviewReady' });

    const snapshotMessages = fake.posted.filter(
      m => m.type === 'snapshotStart' || m.type === 'snapshotChunk' || m.type === 'snapshotComplete',
    );
    const types = snapshotMessages.map(m => m.type);

    expect(types[0]).toBe('snapshotStart');
    expect(types[types.length - 1]).toBe('snapshotComplete');
    // Every middle message is a chunk.
    const middle = types.slice(1, -1);
    expect(middle.every(t => t === 'snapshotChunk')).toBe(true);
  });

  it('paginates at the page-size boundary (500 rows per chunk)', async () => {
    await fake.fire({ type: 'webviewReady' });

    const chunks = fake.posted.filter(m => m.type === 'snapshotChunk');
    // 1300 rows / 500 per page = 3 pages (500, 500, 300).
    expect(chunks.length).toBe(3);
    expect((chunks[0].records as unknown[]).length).toBe(500);
    expect((chunks[1].records as unknown[]).length).toBe(500);
    expect((chunks[2].records as unknown[]).length).toBe(300);
  });

  it('the union of chunked records equals the full row count for the run', async () => {
    await fake.fire({ type: 'webviewReady' });

    const chunks = fake.posted.filter(m => m.type === 'snapshotChunk');
    const total = chunks.reduce(
      (n, m) => n + (m.records as unknown[]).length,
      0,
    );
    expect(total).toBe(1300);
  });

  it('does not post a single legacy "snapshot" message anymore', async () => {
    // Belt-and-suspenders: a future refactor that re-introduces the
    // unbounded snapshot path would silently re-open the RPC overflow.
    // Assert the legacy message type is gone.
    await fake.fire({ type: 'webviewReady' });
    const legacy = fake.posted.filter(m => m.type === 'snapshot');
    expect(legacy.length).toBe(0);
  });

  it('posts an empty snapshot (no chunks) when the workflow has no records', async () => {
    // Reset to a fresh workflow with zero records, then trigger again.
    te.db.prepare('DELETE FROM governed_stream WHERE workflow_run_id = ?').run(runId);
    fake.posted.length = 0;
    await fake.fire({ type: 'webviewReady' });

    const snapshotMessages = fake.posted.filter(
      m => m.type === 'snapshotStart' || m.type === 'snapshotChunk' || m.type === 'snapshotComplete',
    );
    expect(snapshotMessages.map(m => m.type)).toEqual(['snapshotStart', 'snapshotComplete']);
  });
});
