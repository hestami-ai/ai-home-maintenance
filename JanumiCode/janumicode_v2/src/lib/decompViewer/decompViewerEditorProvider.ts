/**
 * Decomposition Viewer Custom Editor Provider.
 *
 * Registers a VS Code custom editor for the JanumiCode requirement
 * decomposition tree. The webview is a Svelte app (Option 7 Multi-Level
 * Accordion per docs/requirements viewer/decomp-viewer-visualization.md).
 *
 * Real-time: a 3-second polling loop (interval configurable via
 * `janumicode.decompViewer.pollIntervalMs`) queries the DB, compares the
 * snapshot's `revision` token to the last posted, and posts a
 * `snapshot_update` only when the revision changed. Cheap enough at
 * cal-19 scale (~850 nodes) to run without user-visible lag.
 *
 * Read-only for v1. MMP-decision message types are defined in types.ts
 * but their handlers here are no-ops (the webview keeps its buttons
 * disabled anyway).
 */

import * as vscode from 'vscode';
import type { Database } from '../database/init';
import { getLogger } from '../logging';
import type { ClientLiaisonDB } from '../agents/clientLiaison/db';
import { DecompViewerDataProvider } from './decompViewerDataProvider';
import { DecompViewerDocument } from './decompViewerDocumentProvider';
import type {
  DecompViewerInboundMessage,
  DecompViewerOutboundMessage,
  ViewerSnapshot,
} from './types';

const VIEW_TYPE = 'janumicode.decompViewer';
const DEFAULT_POLL_INTERVAL_MS = 3000;

export class DecompViewerEditorProvider
  implements vscode.CustomReadonlyEditorProvider<DecompViewerDocument>
{
  private readonly dataProvider: DecompViewerDataProvider;

  constructor(
    private readonly extensionUri: vscode.Uri,
    db: Database,
    /**
     * DB-as-truth resolver for the active workflow run. Called each tick
     * for `/active` URIs so the viewer adapts to DB swaps without any
     * in-memory session state.
     */
    private readonly liaisonDb: ClientLiaisonDB,
  ) {
    this.dataProvider = new DecompViewerDataProvider(db);
  }

  static register(
    context: vscode.ExtensionContext,
    db: Database,
    liaisonDb: ClientLiaisonDB,
  ): vscode.Disposable {
    const provider = new DecompViewerEditorProvider(context.extensionUri, db, liaisonDb);
    return vscode.window.registerCustomEditorProvider(
      VIEW_TYPE,
      provider,
      {
        supportsMultipleEditorsPerDocument: false,
        webviewOptions: { retainContextWhenHidden: true },
      },
    );
  }

  /**
   * Build a run-agnostic URI for the custom editor — the editor resolves
   * the actual run dynamically via `getActiveWorkflowRun()` each tick.
   * VS Code persists this URI verbatim across restarts; survives DB
   * swaps because resolution happens at read time, not URI construction.
   */
  static buildActiveUri(): vscode.Uri {
    return vscode.Uri.parse('janumicode-decomp-viewer:/active');
  }

  /**
   * Build a URI pinned to a specific workflow_run — used when the user
   * explicitly picks an older run from the picker. If the run is later
   * deleted, the viewer renders a stale-id error frame with a button
   * to switch back to the active run.
   */
  static buildPinnedUri(workflowRunId: string): vscode.Uri {
    return vscode.Uri.parse(
      `janumicode-decomp-viewer:/workflow/${workflowRunId}?workflowRunId=${encodeURIComponent(workflowRunId)}`,
    );
  }

  /** @deprecated use buildActiveUri / buildPinnedUri */
  static buildUri(workflowRunId: string): vscode.Uri {
    return this.buildPinnedUri(workflowRunId);
  }

  openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken,
  ): DecompViewerDocument {
    return new DecompViewerDocument(uri);
  }

  resolveCustomEditor(
    document: DecompViewerDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken,
  ): void {
    const log = getLogger();
    log.info('ui', 'resolveCustomEditor called', {
      mode: document.pinnedWorkflowRunId ? 'pinned' : 'active',
      pinnedWorkflowRunId: document.pinnedWorkflowRunId,
    });
    webviewPanel.webview.options = {
      enableScripts: true,
      enableCommandUris: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'),
        vscode.Uri.joinPath(this.extensionUri, 'src', 'webview'),
      ],
    };

    webviewPanel.title = 'Decomposition Viewer';
    webviewPanel.webview.html = this.buildHtml(webviewPanel.webview);
    log.info('ui', 'webview HTML set', { html_bytes: webviewPanel.webview.html.length });

    let lastPostedRevision: string | null = null;
    let lastResolvedRunId: string | null = null;
    const post = (msg: DecompViewerOutboundMessage) => webviewPanel.webview.postMessage(msg);

    /**
     * Resolve which workflow_run_id this snapshot tick should query:
     *  - pinned URI (`/workflow/<id>`) → that exact id; if it no longer
     *    exists in the DB, surface a stale-id error frame.
     *  - run-agnostic URI (`/active`) → call the resolver. Pick whatever
     *    run is currently most relevant (in-progress > most-recent-with-
     *    decomp > most-recent-of-any-kind).
     * Returns null when there's nothing meaningful to show — caller posts
     * an explicit empty-DB error frame.
     */
    const resolveRunId = (): { id: string | null; reason: 'pinned' | 'active' | 'pinned_stale' | 'empty_db' } => {
      if (document.pinnedWorkflowRunId) {
        const exists = this.liaisonDb.getWorkflowStatus(document.pinnedWorkflowRunId).run !== null;
        if (exists) return { id: document.pinnedWorkflowRunId, reason: 'pinned' };
        return { id: null, reason: 'pinned_stale' };
      }
      const active = this.liaisonDb.getActiveWorkflowRun();
      if (active) return { id: active.id, reason: 'active' };
      return { id: null, reason: 'empty_db' };
    };

    const postSnapshotIfChanged = (initial: boolean): ViewerSnapshot | null => {
      try {
        const resolved = resolveRunId();
        if (resolved.id === null) {
          // Don't spam the webview on every poll tick — only emit the
          // error frame on initial paint or when the resolver outcome
          // changes (e.g. went from pinned-ok to pinned-stale).
          if (initial || lastResolvedRunId !== null) {
            const message = resolved.reason === 'pinned_stale'
              ? `Workflow run '${document.pinnedWorkflowRunId}' was not found in the current database. The DB may have been swapped, or the run was removed. Use the JanumiCode: Open Decomposition Viewer command to switch to the active run.`
              : `No workflow runs found in the current database. Start a workflow or open a different database.`;
            log.warn('ui', 'no resolvable run for viewer', {
              reason: resolved.reason,
              pinned: document.pinnedWorkflowRunId,
            });
            post({ type: 'error', message });
            lastResolvedRunId = null;
            lastPostedRevision = null;
          }
          return null;
        }

        // If the resolver flipped to a different run since last poll
        // (e.g. a new workflow started), force a fresh init-style post.
        const runChanged = resolved.id !== lastResolvedRunId;
        const snapshot = this.dataProvider.getSnapshot(resolved.id);

        if (initial || runChanged) {
          lastResolvedRunId = resolved.id;
          lastPostedRevision = snapshot.revision;
          post({ type: 'init', snapshot });
          log.info('ui', runChanged && !initial ? 'run changed; re-init snapshot posted' : 'init snapshot posted', {
            workflowRunId: resolved.id,
            revision: snapshot.revision,
            nodes: snapshot.totals.nodes,
            roots: snapshot.totals.roots,
            assumptions: snapshot.totals.assumptions,
          });
          return snapshot;
        }
        if (snapshot.revision !== lastPostedRevision) {
          lastPostedRevision = snapshot.revision;
          post({ type: 'snapshot_update', snapshot });
          log.info('ui', 'snapshot_update posted', {
            revision: snapshot.revision,
            nodes: snapshot.totals.nodes,
          });
          return snapshot;
        }
        return null;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error('ui', 'snapshot query failed', { error: message });
        post({ type: 'error', message: `Failed to load snapshot: ${message}` });
        return null;
      }
    };

    // Message handling — v1 only `ready` and `refresh_requested` do work.
    const messageDisposable = webviewPanel.webview.onDidReceiveMessage(
      (raw: unknown) => {
        const msg = raw as DecompViewerInboundMessage;
        log.info('ui', 'inbound message from webview', { type: msg.type });
        switch (msg.type) {
          case 'ready':
            postSnapshotIfChanged(true);
            break;
          case 'refresh_requested':
            postSnapshotIfChanged(false);
            break;
          case 'mmp_accept':
          case 'mmp_reject':
          case 'mmp_defer':
          case 'mmp_edit':
          case 'mmp_accept_subtree':
          case 'mmp_reject_subtree':
            // v1: MMP is read-only. Acknowledge silently.
            break;
          default:
            // Unknown message kind — ignore.
            break;
        }
      },
    );

    // Polling loop for real-time updates.
    const pollIntervalMs =
      vscode.workspace.getConfiguration('janumicode.decompViewer')
        .get<number>('pollIntervalMs', DEFAULT_POLL_INTERVAL_MS)
      ?? DEFAULT_POLL_INTERVAL_MS;
    const timer = setInterval(() => postSnapshotIfChanged(false), pollIntervalMs);
    log.info('ui', 'polling loop started', { interval_ms: pollIntervalMs });

    // Post initial snapshot eagerly (before the webview sends 'ready')
    // so the first paint is fast. The 'ready' re-post is cheap since
    // the revision will match.
    postSnapshotIfChanged(true);

    const disposeAll = () => {
      clearInterval(timer);
      messageDisposable.dispose();
      log.info('ui', 'viewer disposed');
    };
    webviewPanel.onDidDispose(disposeAll);
    document.onDidDispose(disposeAll);
    token.onCancellationRequested(disposeAll);
  }

  private buildHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'decompViewer.js'),
    );
    const designSystemUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'src', 'webview', 'design-system.css'),
    );
    const csp = [
      "default-src 'none'",
      `script-src ${webview.cspSource}`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `img-src ${webview.cspSource} data:`,
      `font-src ${webview.cspSource}`,
    ].join('; ');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <link href="${designSystemUri}" rel="stylesheet">
  <title>Decomposition Viewer</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: var(--jc-surface);
      color: var(--jc-on-surface);
      font-family: var(--jc-font-body);
      font-size: 15px;
      line-height: 1.45;
    }
    #app {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
  </style>
</head>
<body>
  <div id="app"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
