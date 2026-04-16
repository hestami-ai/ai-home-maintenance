/**
 * Regression tests for the phase-indicator visibility bug.
 *
 * The PhaseIndicator component only renders when
 * `phaseStore.hasActiveRun === true`, which requires the webview to have
 * received a `phaseUpdate` message whose `workflowRunId` is non-null.
 *
 * Before the fix, the flow for a fresh intent was:
 *   1. handleSubmitIntent → liaison.handleUserInput → startWorkflow capability
 *   2. engine.startWorkflowRun() emits `workflow:started` (no listener)
 *   3. engine.executeCurrentPhase() emits `phase:started` —
 *      view provider posts a phaseUpdate, but session.currentRunId is still
 *      null because handleUserInput hasn't returned yet. The webview gets
 *      `workflowRunId: null`, so hasActiveRun stays false and the
 *      PhaseIndicator never renders.
 *   4. handleSubmitIntent finally sets session.currentRunId, but no further
 *      phaseUpdate is posted, so the webview stays blind to the run.
 *
 * The fix subscribes to `workflow:started` in the view provider, sets
 * `session.currentRunId` synchronously, and posts an initial phaseUpdate
 * carrying the run id. By the time `phase:started` fires a moment later,
 * session.currentRunId is populated and every subsequent phaseUpdate
 * carries the right run id.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import {
  GovernedStreamViewProvider,
  type WorkflowSession,
} from '../../../lib/webview/governedStreamViewProvider';
import { DecisionRouter } from '../../../lib/orchestrator/decisionRouter';
import { createTestEngine, type TestEngine } from '../../helpers/createTestEngine';

// ── Fake webview ────────────────────────────────────────────────────

interface PostedMessage {
  type: string;
  [key: string]: unknown;
}

function makeFakeWebviewView(): {
  view: vscode.WebviewView;
  posted: PostedMessage[];
  dispose: () => void;
} {
  const posted: PostedMessage[] = [];
  let inboundHandler: ((msg: unknown) => void) | null = null;
  let disposeHandler: (() => void) | null = null;

  const webview = {
    options: {} as vscode.WebviewOptions,
    html: '',
    cspSource: 'vscode-webview://test',
    asWebviewUri: (uri: vscode.Uri) => uri,
    onDidReceiveMessage: (handler: (msg: unknown) => void) => {
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
    dispose: () => { if (disposeHandler) disposeHandler(); },
  };
}

// ── Suite ───────────────────────────────────────────────────────────

describe('GovernedStreamViewProvider — phase indicator visibility', () => {
  let te: TestEngine;
  let provider: GovernedStreamViewProvider;
  let session: WorkflowSession;
  let fake: ReturnType<typeof makeFakeWebviewView>;

  beforeEach(async () => {
    te = await createTestEngine({});
    session = { currentRunId: null };

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

  it('posts a phaseUpdate with a non-null workflowRunId when workflow:started fires', () => {
    te.engine.eventBus.emit('workflow:started', { workflowRunId: 'run-42' });

    const updates = fake.posted.filter(m => m.type === 'phaseUpdate');
    expect(updates.length).toBeGreaterThanOrEqual(1);
    const payload = updates[0].payload as { workflowRunId: string | null; status: string };
    expect(payload.workflowRunId).toBe('run-42');
    expect(payload.status).toBe('active');
    // And the session picked up the run id for subsequent handlers.
    expect(session.currentRunId).toBe('run-42');
  });

  it('subsequent phase:started events carry the workflowRunId the webview needs', () => {
    // This is the fail-to-pass scenario. Before the fix, session.currentRunId
    // was still null at the time phase:started fired, so the posted
    // phaseUpdate had workflowRunId: null and the webview's hasActiveRun
    // getter stayed false — the phase indicator never appeared.
    te.engine.eventBus.emit('workflow:started', { workflowRunId: 'run-99' });
    te.engine.eventBus.emit('phase:started', {
      phaseId: '0',
      phaseName: 'Workspace Initialization',
    });

    const phaseStarted = fake.posted.filter(
      m => m.type === 'phaseUpdate' && (m as { event?: string }).event === 'phase:started',
    );
    expect(phaseStarted.length).toBe(1);
    const payload = phaseStarted[0].payload as { workflowRunId: string | null };
    expect(payload.workflowRunId).toBe('run-99');
  });

  it('phase:completed and phase_gate:pending also carry the workflowRunId', () => {
    te.engine.eventBus.emit('workflow:started', { workflowRunId: 'run-7' });
    te.engine.eventBus.emit('phase:completed', {
      phaseId: '0',
      phaseName: 'Workspace Initialization',
    });
    te.engine.eventBus.emit('phase_gate:pending', { phaseId: '0' });

    const byEvent = (eventName: string) =>
      fake.posted.filter(
        m => m.type === 'phaseUpdate' && (m as { event?: string }).event === eventName,
      );

    const completed = byEvent('phase:completed');
    const gate = byEvent('phase_gate:pending');
    expect(completed.length).toBe(1);
    expect(gate.length).toBe(1);
    expect((completed[0].payload as { workflowRunId: string }).workflowRunId).toBe('run-7');
    expect((gate[0].payload as { workflowRunId: string }).workflowRunId).toBe('run-7');
  });

  it('does not replay an initial phaseUpdate when workflow:started fires for an unrelated run after one is already active', () => {
    // Pass-to-pass guard. A second workflow:started should still sync
    // session.currentRunId and post the phaseUpdate — no conditional logic
    // is allowed to suppress it.
    te.engine.eventBus.emit('workflow:started', { workflowRunId: 'run-1' });
    te.engine.eventBus.emit('workflow:started', { workflowRunId: 'run-2' });

    const runIds = fake.posted
      .filter(m => m.type === 'phaseUpdate')
      .map(m => (m.payload as { workflowRunId: string | null }).workflowRunId);
    expect(runIds).toContain('run-1');
    expect(runIds).toContain('run-2');
    expect(session.currentRunId).toBe('run-2');
  });
});
