/**
 * GovernedStreamViewProvider — executor-question escalation (attended Phase-9).
 *
 * The provider is the human answerer for a coding agent's blocking clarification
 * the spec-grounded responder could not resolve. escalateExecutorQuestion:
 *   - persists an `executor_question_presented` surface record (which rides
 *     record:added → addRecord to the webview as an ExecutorQuestionCard), and
 *   - returns a promise the awaiting adapter is blocked on.
 * The webview posts `executorQuestion:answer`; handleExecutorQuestionAnswer
 * resolves that promise with the human's free text (or null → self-resolve) and
 * writes an `executor_question_answered` follow-up.
 *
 * These tests pin: surface → answer → resolve, the audit follow-up, the
 * never-deadlock null paths (no run, no webview, empty answer), unknown-id
 * safety, and independent resolution of concurrent questions.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import {
  GovernedStreamViewProvider,
  type WorkflowSession,
} from '../../../lib/webview/governedStreamViewProvider';
import { DecisionRouter } from '../../../lib/orchestrator/decisionRouter';
import { createTestEngine, type TestEngine } from '../../helpers/createTestEngine';

interface PostedMessage { type: string; [key: string]: unknown; }
interface AddRecordMsg { type: string; record: { id: string; record_type: string; content: Record<string, unknown> }; }

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
    postMessage: async (msg: unknown) => { posted.push(msg as PostedMessage); return true; },
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

describe('GovernedStreamViewProvider — executor escalation', () => {
  let te: TestEngine;
  let provider: GovernedStreamViewProvider;
  let session: WorkflowSession;
  let fake: ReturnType<typeof makeFakeWebviewView>;
  const runId = 'run-esc-1';

  beforeEach(async () => {
    te = await createTestEngine({});
    te.db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES (?, 'ws-1', 'dev', '2026-01-01T00:00:00Z', 'in_progress')
    `).run(runId);
    session = { currentRunId: runId };
    provider = new GovernedStreamViewProvider(
      vscode.Uri.file('/ext') as unknown as vscode.Uri,
      te.engine, te.db, te.liaison, new DecisionRouter(te.engine), session, 'ws-1', '/ws',
    );
    fake = makeFakeWebviewView();
    provider.resolveWebviewView(fake.view);
  });

  afterEach(() => { fake.dispose(); te.cleanup(); });

  const surfaced = (): AddRecordMsg[] =>
    fake.posted.filter(
      (m) => m.type === 'addRecord' && (m as unknown as AddRecordMsg).record?.record_type === 'executor_question_presented',
    ) as unknown as AddRecordMsg[];

  it('surfaces the question as a card and resolves with the human answer + writes the audit follow-up', async () => {
    const p = provider.escalateExecutorQuestion({ question: 'Which DB engine?', agentContext: 'recent tail', taskSpec: 'SPEC body' });

    const cards = surfaced();
    expect(cards).toHaveLength(1);
    expect(cards[0].record.content.question).toBe('Which DB engine?');
    const recordId = cards[0].record.id;

    await fake.fire({ type: 'executorQuestion:answer', recordId, answer: 'Postgres 16' });
    await expect(p).resolves.toBe('Postgres 16');

    // Audit follow-up persisted with the answer + a back-reference.
    const answered = fake.posted.find(
      (m) => m.type === 'addRecord' && (m as unknown as AddRecordMsg).record?.record_type === 'executor_question_answered',
    ) as unknown as AddRecordMsg | undefined;
    expect(answered).toBeDefined();
    expect(answered!.record.content).toMatchObject({ answer: 'Postgres 16', target_record_id: recordId });
  });

  it('an empty/whitespace answer resolves null (executor self-resolves, no answer forced)', async () => {
    const p = provider.escalateExecutorQuestion({ question: 'Q?', agentContext: '', taskSpec: '' });
    const recordId = surfaced()[0].record.id;
    await fake.fire({ type: 'executorQuestion:answer', recordId, answer: '   ' });
    await expect(p).resolves.toBeNull();
  });

  it('returns null immediately when no run is active (never deadlocks)', async () => {
    session.currentRunId = null;
    await expect(
      provider.escalateExecutorQuestion({ question: 'Q', agentContext: '', taskSpec: '' }),
    ).resolves.toBeNull();
    expect(surfaced()).toHaveLength(0);
  });

  it('returns null when no webview is attached (detached session)', async () => {
    fake.dispose(); // fires onDidDispose → this.webview = null
    await expect(
      provider.escalateExecutorQuestion({ question: 'Q', agentContext: '', taskSpec: '' }),
    ).resolves.toBeNull();
  });

  it('an answer for an unknown/expired id is a warn + no-op, not a throw', async () => {
    await expect(
      fake.fire({ type: 'executorQuestion:answer', recordId: 'does-not-exist', answer: 'x' }),
    ).resolves.toBeUndefined();
  });

  it('resolves concurrent questions independently by record id', async () => {
    const p1 = provider.escalateExecutorQuestion({ question: 'Q1?', agentContext: '', taskSpec: '' });
    const p2 = provider.escalateExecutorQuestion({ question: 'Q2?', agentContext: '', taskSpec: '' });
    const cards = surfaced();
    expect(cards).toHaveLength(2);
    const [id1, id2] = cards.map((c) => c.record.id);

    // Answer out of order — each promise still gets its own answer.
    await fake.fire({ type: 'executorQuestion:answer', recordId: id2, answer: 'A2' });
    await fake.fire({ type: 'executorQuestion:answer', recordId: id1, answer: 'A1' });
    await expect(p1).resolves.toBe('A1');
    await expect(p2).resolves.toBe('A2');
  });
});
