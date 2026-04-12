/**
 * GovernedStreamViewProvider — the VS Code webview view provider for the
 * JanumiCode sidebar. Replaces the inline stub in extension.ts.
 *
 * Responsibilities:
 *   - Build the webview HTML with nonce-based CSP and load the bundled
 *     Svelte client.
 *   - Subscribe to engine events (record:added, phase:started, phase:completed,
 *     phase_gate:pending, error:occurred, llm:queued/started/finished,
 *     decision:requested) and forward them as outbound postMessage calls.
 *   - Route inbound postMessage payloads (submitIntent, submitOpenQuery,
 *     pickFile, resolveMention, decision) to the orchestrator, Liaison, or
 *     DecisionRouter as appropriate.
 *   - Handle webview reload by rebuilding the snapshot from the database
 *     and re-creating any unresolved pending decisions.
 */

import * as vscode from 'vscode';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Database } from '../database/init';
import type { OrchestratorEngine } from '../orchestrator/orchestratorEngine';
import type { DecisionRouter, InboundDecision } from '../orchestrator/decisionRouter';
import type { ClientLiaisonAgent } from '../agents/clientLiaisonAgent';
import { makeUserInput } from '../agents/clientLiaisonAgent';
import type { CapabilityContext } from '../agents/clientLiaison/capabilities/index';
import type {
  GovernedStreamRecord,
  PhaseId,
  WorkflowRun,
  AuthorityLevel,
  AgentRole,
  WorkflowRunStatus,
} from '../types/records';
import type { MentionExtensionHost } from '../agents/clientLiaison/mentionResolver';
import type { MentionCandidate } from '../agents/clientLiaison/types';
import type { SerializedRecord } from '../events/eventBus';
import { getLogger } from '../logging';

export interface WorkflowSession {
  currentRunId: string | null;
}

interface InboundMessage {
  type: string;
  [key: string]: unknown;
}

export class GovernedStreamViewProvider implements vscode.WebviewViewProvider {
  private webview: vscode.Webview | null = null;
  private readonly disposers: Array<() => void> = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly engine: OrchestratorEngine,
    private readonly db: Database,
    private readonly liaison: ClientLiaisonAgent,
    private readonly decisionRouter: DecisionRouter,
    private readonly session: WorkflowSession,
    private readonly workspaceId: string,
    private readonly workspaceRoot: string,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    getLogger().info('ui', 'resolveWebviewView called by VS Code');
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    this.webview = view.webview;
    try {
      view.webview.html = this.buildHtml(view.webview);
      getLogger().info('ui', 'webview HTML set', {
        htmlBytes: view.webview.html.length,
      });
    } catch (err) {
      getLogger().error('ui', 'Failed to build webview HTML', {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    // Inbound messages
    view.webview.onDidReceiveMessage((msg: InboundMessage) => {
      // Webview-side errors are forwarded so they show up in the extension's
      // output channel rather than the inaccessible webview devtools console.
      if (msg.type === 'webviewError') {
        getLogger().error('ui', 'Webview runtime error', {
          message: (msg as { message?: string }).message,
          stack: (msg as { stack?: string }).stack,
          source: (msg as { source?: string }).source,
        });
        return;
      }
      if (msg.type === 'webviewLog') {
        const level = (msg as { level?: string }).level ?? 'info';
        const text = (msg as { message?: string }).message ?? '';
        if (level === 'error') {
          getLogger().error('ui', `[webview] ${text}`);
        } else if (level === 'warn') {
          getLogger().warn('ui', `[webview] ${text}`);
        } else {
          getLogger().info('ui', `[webview] ${text}`);
        }
        return;
      }

      this.handleMessage(msg).catch((err) => {
        getLogger().warn('ui', 'Webview message handler failed', {
          type: msg.type,
          error: String(err),
        });
        this.post({ type: 'error', message: String(err) });
      });
    });

    // Outbound: forward eventBus events to the webview.
    const off1 = this.engine.eventBus.on('record:added', (p) => {
      this.post({ type: 'addRecord', record: p.record });
    });
    const off2 = this.engine.eventBus.on('phase:started', (p) => {
      this.post({ type: 'phaseUpdate', event: 'phase:started', payload: p });
    });
    const off3 = this.engine.eventBus.on('phase:completed', (p) => {
      this.post({ type: 'phaseUpdate', event: 'phase:completed', payload: p });
    });
    const off4 = this.engine.eventBus.on('phase_gate:pending', (p) => {
      this.post({ type: 'phaseUpdate', event: 'phase_gate:pending', payload: p });
    });
    const off5 = this.engine.eventBus.on('error:occurred', (p) => {
      this.post({ type: 'error', message: p.message, context: p.context });
    });
    const off6 = this.engine.eventBus.on('llm:queued', (p) => {
      this.post({ type: 'llmStatus', event: 'queued', payload: p });
    });
    const off7 = this.engine.eventBus.on('llm:started', (p) => {
      this.post({ type: 'llmStatus', event: 'started', payload: p });
    });
    const off8 = this.engine.eventBus.on('llm:finished', (p) => {
      this.post({ type: 'llmStatus', event: 'finished', payload: p });
    });

    this.disposers.push(off1, off2, off3, off4, off5, off6, off7, off8);

    view.onDidDispose(() => {
      for (const d of this.disposers) d();
      this.disposers.length = 0;
      this.webview = null;
    });
  }

  /** Focus the sidebar (used by the startWorkflowRun command). */
  async focusComposer(): Promise<void> {
    await vscode.commands.executeCommand('janumicode.governedStream.focus');
  }

  postFindFocus(): void {
    this.post({ type: 'focusFind' });
  }

  /**
   * Build a CapabilityContext for direct command/slash invocation. Used by
   * the showWorkflowStatus command.
   */
  getCapabilityContext(): CapabilityContext {
    const activeRun = this.session.currentRunId
      ? this.engine.stateMachine.getWorkflowRun(this.session.currentRunId)
      : null;
    return this.buildCapabilityContext(activeRun);
  }

  // ── Inbound message routing ───────────────────────────────────

  private async handleMessage(msg: InboundMessage): Promise<void> {
    switch (msg.type) {
      case 'webviewReady':
        await this.handleWebviewReady();
        return;
      case 'submitIntent':
        await this.handleSubmitIntent(msg as unknown as { text: string; attachments?: string[]; references?: never[] });
        return;
      case 'submitOpenQuery':
        await this.handleSubmitOpenQuery(msg as unknown as { text: string; references?: never[]; forceCapability?: string });
        return;
      case 'pickFile':
        await this.handlePickFile(msg as unknown as { requestId: string; multiple?: boolean });
        return;
      case 'resolveMention':
        await this.handleResolveMention(msg as unknown as { requestId: string; query: string; types?: never[] });
        return;
      case 'decision':
        this.handleDecision(msg as unknown as { recordId: string; decision: InboundDecision });
        return;
      default:
        getLogger().debug('ui', 'Unhandled webview message', { type: msg.type });
    }
  }

  private async handleWebviewReady(): Promise<void> {
    // Recover the latest workflow run if the session lost its currentRunId
    // (e.g. on a webview reload).
    if (!this.session.currentRunId) {
      const latest = this.liaison.getDB().getCurrentWorkflowRun();
      if (latest) {
        this.session.currentRunId = latest.id;
      }
    }

    // Build the snapshot from the database.
    const records = this.session.currentRunId
      ? this.loadAllRecordsForRun(this.session.currentRunId)
      : [];
    this.post({
      type: 'snapshot',
      records: records.map((r) => this.serialize(r)),
    });

    // Send phase update so the composer mode flips to Open Query.
    if (this.session.currentRunId) {
      const run = this.engine.stateMachine.getWorkflowRun(this.session.currentRunId);
      if (run?.current_phase_id) {
        this.post({
          type: 'phaseUpdate',
          event: 'phase:started',
          payload: { phaseId: run.current_phase_id },
        });
      }

      // Re-create pending decisions so the user can resume mid-flow after reload.
      const pending = this.liaison.getDB().getPendingDecisions(this.session.currentRunId);
      for (const surface of pending) {
        const surfaceType = this.surfaceTypeOf(surface.record_type);
        if (surfaceType) {
          // Fire-and-forget — the user will resolve via the next decision message.
          void this.engine.recreatePendingFromRecord(
            this.session.currentRunId,
            surface.id,
            surfaceType,
          );
        }
      }
    }
  }

  private async handleSubmitIntent(msg: {
    text: string;
    attachments?: string[];
  }): Promise<void> {
    if (this.session.currentRunId) {
      const existing = this.engine.stateMachine.getWorkflowRun(this.session.currentRunId);
      if (existing && (existing.status === 'in_progress' || existing.status === 'initiated')) {
        this.post({
          type: 'error',
          message: 'A workflow is already active. Ask a question or wait for it to finish.',
        });
        return;
      }
    }

    // Build a UserInput.
    const input = makeUserInput({
      text: msg.text,
      attachments: (msg.attachments ?? []).map((uri) => ({
        uri,
        name: path.basename(uri),
        type: 'file' as const,
      })),
      inputMode: 'raw_intent',
      workflowRunId: null,
      currentPhaseId: null,
    });

    // The Liaison will classify as workflow_initiation, dispatch startWorkflow.
    const ctx = this.buildCapabilityContext(null);
    const response = await this.liaison.handleUserInput(input, ctx);

    // After startWorkflow runs, the engine has a new active run id; update the session.
    const newRun = this.liaison.getDB().getCurrentWorkflowRun();
    if (newRun) this.session.currentRunId = newRun.id;

    if (response.escalatedToOrchestrator) {
      // Already handled inside handleUserInput
    }
  }

  private async handleSubmitOpenQuery(msg: {
    text: string;
    forceCapability?: string;
  }): Promise<void> {
    if (!this.session.currentRunId) {
      this.post({
        type: 'error',
        message: 'No active workflow. Type your intent first to start one.',
      });
      return;
    }
    const activeRun = this.engine.stateMachine.getWorkflowRun(this.session.currentRunId);
    const input = makeUserInput({
      text: msg.text,
      inputMode: 'open_query',
      workflowRunId: this.session.currentRunId,
      currentPhaseId: activeRun?.current_phase_id ?? null,
      forceCapability: msg.forceCapability,
    });
    const ctx = this.buildCapabilityContext(activeRun);
    await this.liaison.handleUserInput(input, ctx);
  }

  private async handlePickFile(msg: { requestId: string; multiple?: boolean }): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: msg.multiple ?? true,
      canSelectFiles: true,
      canSelectFolders: false,
    });
    this.post({
      type: 'pickFileResult',
      requestId: msg.requestId,
      uris: (uris ?? []).map((u) => ({ fsPath: u.fsPath, basename: path.basename(u.fsPath) })),
    });
  }

  private async handleResolveMention(msg: {
    requestId: string;
    query: string;
    types?: Array<'file' | 'symbol' | 'decision' | 'constraint' | 'phase' | 'run'>;
  }): Promise<void> {
    const candidates = await this.liaison.resolveMention(msg.query, msg.types);
    this.post({
      type: 'mentionCandidates',
      requestId: msg.requestId,
      candidates,
    });
  }

  private handleDecision(msg: { recordId: string; decision: InboundDecision }): void {
    if (!this.session.currentRunId) {
      this.post({ type: 'error', message: 'No active workflow run.' });
      return;
    }
    this.decisionRouter.route(this.session.currentRunId, msg.decision);
  }

  // ── Helpers ───────────────────────────────────────────────────

  private buildCapabilityContext(activeRun: WorkflowRun | null): CapabilityContext {
    return {
      workspaceId: this.workspaceId,
      workspaceRoot: this.workspaceRoot,
      activeRun,
      currentPhase: activeRun?.current_phase_id ?? null,
      currentSubPhase: activeRun?.current_sub_phase_id ?? null,
      runStatus: activeRun?.status ?? null,
      orchestrator: this.engine,
      db: this.liaison.getDB(),
      eventBus: this.engine.eventBus,
      embedding: (this.liaison as unknown as { config: { embeddingService: import('../embedding/embeddingService').EmbeddingService } }).config.embeddingService,
    };
  }

  private surfaceTypeOf(recordType: string): 'mirror' | 'menu' | 'decision_bundle' | 'phase_gate' | null {
    switch (recordType) {
      case 'mirror_presented': return 'mirror';
      case 'menu_presented': return 'menu';
      case 'decision_bundle_presented': return 'decision_bundle';
      case 'phase_gate_evaluation': return 'phase_gate';
      default: return null;
    }
  }

  private loadAllRecordsForRun(runId: string): GovernedStreamRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM governed_stream
          WHERE workflow_run_id = ? AND is_current_version = 1
          ORDER BY produced_at ASC`,
      )
      .all(runId) as Record<string, unknown>[];
    return rows.map((r) => this.rowToRecord(r));
  }

  private serialize(record: GovernedStreamRecord): SerializedRecord {
    return {
      id: record.id,
      record_type: record.record_type,
      phase_id: record.phase_id,
      sub_phase_id: record.sub_phase_id,
      produced_by_agent_role: record.produced_by_agent_role,
      produced_at: record.produced_at,
      authority_level: record.authority_level,
      quarantined: record.quarantined,
      content: record.content,
    };
  }

  private rowToRecord(row: Record<string, unknown>): GovernedStreamRecord {
    return {
      id: row.id as string,
      record_type: row.record_type as never,
      schema_version: row.schema_version as string,
      workflow_run_id: row.workflow_run_id as string,
      phase_id: (row.phase_id as string) || null,
      sub_phase_id: (row.sub_phase_id as string) || null,
      produced_by_agent_role: (row.produced_by_agent_role as AgentRole) || null,
      produced_by_record_id: (row.produced_by_record_id as string) || null,
      produced_at: row.produced_at as string,
      effective_at: (row.effective_at as string) || null,
      janumicode_version_sha: row.janumicode_version_sha as string,
      authority_level: row.authority_level as AuthorityLevel,
      derived_from_system_proposal: !!(row.derived_from_system_proposal as number),
      is_current_version: !!(row.is_current_version as number),
      superseded_by_id: (row.superseded_by_id as string) || null,
      superseded_at: (row.superseded_at as string) || null,
      superseded_by_record_id: (row.superseded_by_record_id as string) || null,
      source_workflow_run_id: row.source_workflow_run_id as string,
      derived_from_record_ids: JSON.parse((row.derived_from_record_ids as string) || '[]'),
      quarantined: !!(row.quarantined as number),
      sanitized: !!(row.sanitized as number),
      sanitized_fields: JSON.parse((row.sanitized_fields as string) || '[]'),
      content: JSON.parse(row.content as string),
    };
  }

  private buildHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'main.js'),
    );
    const nonce = this.generateNonce();

    getLogger().info('ui', 'Building webview HTML', {
      scriptUri: scriptUri.toString(),
      cspSource: webview.cspSource,
    });

    // Static fallback inside #app: Svelte's mount() will replace it on success.
    // If we still see this content in the webview after load, it means the
    // bundled script either failed to load (404, CSP) or threw before mount().
    // The inline error-capture script forwards any uncaught error to the
    // extension host's output channel via postMessage.
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             style-src ${webview.cspSource} 'unsafe-inline';
             script-src 'nonce-${nonce}' ${webview.cspSource};">
  <title>Governed Stream</title>
  <style>
    html, body { margin: 0; padding: 0; height: 100vh; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
    }
    #app { height: 100vh; display: flex; flex-direction: column; }
    .boot-fallback {
      padding: 24px 16px;
      text-align: center;
      opacity: 0.75;
    }
    .boot-fallback h2 { margin: 0 0 8px; font-size: 1.05em; }
    .boot-fallback p { margin: 4px 0; font-size: 0.85em; }
    .boot-fallback .hint { margin-top: 16px; opacity: 0.6; font-size: 0.8em; }
  </style>
</head>
<body>
  <div id="app">
    <div class="boot-fallback">
      <h2>JanumiCode v2</h2>
      <p>Loading webview…</p>
      <p class="hint">If this message persists, the bundled UI failed to load. Check the JanumiCode Logs output channel.</p>
    </div>
  </div>
  <script nonce="${nonce}">
    // Capture errors before the bundle loads so even bundle-load failures
    // get reported back to the extension host.
    (function () {
      var vscode = acquireVsCodeApi();
      window.__janumiVscode = vscode;
      function post(type, data) {
        try { vscode.postMessage(Object.assign({ type: type }, data)); } catch (e) { /* nothing we can do */ }
      }
      window.addEventListener('error', function (e) {
        post('webviewError', {
          message: e.message,
          source: e.filename + ':' + e.lineno + ':' + e.colno,
          stack: e.error && e.error.stack ? String(e.error.stack) : undefined,
        });
      });
      window.addEventListener('unhandledrejection', function (e) {
        var reason = e.reason;
        post('webviewError', {
          message: 'unhandledrejection: ' + (reason && reason.message ? reason.message : String(reason)),
          stack: reason && reason.stack ? String(reason.stack) : undefined,
        });
      });
      post('webviewLog', { level: 'info', message: 'inline bootstrap script ran; about to load main.js' });
    })();
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private generateNonce(): string {
    return randomUUID().replace(/-/g, '');
  }

  private post(message: Record<string, unknown>): void {
    if (!this.webview) return;
    void this.webview.postMessage(message);
  }
}

/** Default extension-host implementation of the MentionResolver's host adapter. */
export function buildExtensionHost(): MentionExtensionHost {
  return {
    findFiles: async (query: string): Promise<MentionCandidate[]> => {
      try {
        const uris = await vscode.workspace.findFiles(`**/*${query}*`, '**/node_modules/**', 20);
        return uris.map((u) => ({
          type: 'file' as const,
          id: u.fsPath,
          label: path.basename(u.fsPath),
          detail: vscode.workspace.asRelativePath(u),
          uri: u.toString(),
        }));
      } catch {
        return [];
      }
    },
    findSymbols: async (query: string): Promise<MentionCandidate[]> => {
      try {
        const symbols = (await vscode.commands.executeCommand(
          'vscode.executeWorkspaceSymbolProvider',
          query,
        )) as Array<{ name: string; location: { uri: vscode.Uri; range: vscode.Range } }>;
        return (symbols ?? []).slice(0, 10).map((s) => ({
          type: 'symbol' as const,
          id: `${s.location.uri.fsPath}:${s.name}`,
          label: s.name,
          detail: path.basename(s.location.uri.fsPath),
        }));
      } catch {
        return [];
      }
    },
  };
}

// Re-export so the workflow status check works regardless of import path.
export type { WorkflowRunStatus };
