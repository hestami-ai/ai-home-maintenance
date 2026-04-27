/**
 * Canvas Custom Editor Provider.
 *
 * Registers the `janumicode-canvas:` custom editor scheme and provides
 * the HTML builder for the Architecture Canvas webview.
 *
 * Wave 4: Custom Editor Provider + HTML Builder
 */

import * as vscode from 'vscode';
import type { Database } from '../database/init';
import type { ClientLiaisonDB } from '../agents/clientLiaison/db';
import { getLogger } from '../logging';
import {
  CanvasCustomDocument,
  CanvasDocumentProvider,
} from './canvasDocumentProvider';
import { CanvasDataProvider } from './canvasDataProvider';
import type { CanvasOutboundMessage } from './types';

/**
 * Provides the Architecture Canvas custom editor.
 */
export class CanvasEditorProvider
  implements vscode.CustomReadonlyEditorProvider<CanvasCustomDocument> {
  private readonly documentProvider: CanvasDocumentProvider;
  private readonly dataProvider: CanvasDataProvider;

  constructor(
    private readonly extensionUri: vscode.Uri,
    db: Database,
    /**
     * DB-as-truth resolver for the active workflow run. Used when the
     * canvas URI is the run-agnostic `/active` form. Optional only for
     * backward compatibility with older callers; production registration
     * always passes the liaison DB so the canvas can self-resolve.
     */
    private readonly liaisonDb: ClientLiaisonDB | null = null,
  ) {
    this.documentProvider = new CanvasDocumentProvider();
    this.dataProvider = new CanvasDataProvider(db);
  }

  /** Run-agnostic URI — editor resolves the run dynamically. */
  static buildActiveUri(): vscode.Uri {
    return vscode.Uri.parse('janumicode-canvas:/active');
  }

  /** Pinned URI — used when the user explicitly picks an older run. */
  static buildPinnedUri(workflowRunId: string): vscode.Uri {
    return vscode.Uri.parse(
      `janumicode-canvas:${workflowRunId}?workflowRunId=${encodeURIComponent(workflowRunId)}`,
    );
  }

  /**
   * Register the custom editor provider with VS Code.
   */
  static register(
    context: vscode.ExtensionContext,
    db: Database,
    liaisonDb: ClientLiaisonDB,
  ): vscode.Disposable {
    const provider = new CanvasEditorProvider(context.extensionUri, db, liaisonDb);

    return vscode.window.registerCustomEditorProvider(
      'janumicode.canvas',
      provider,
      {
        supportsMultipleEditorsPerDocument: false,
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      },
    );
  }

  /**
   * Open a custom document.
   */
  openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    token: vscode.CancellationToken,
  ): CanvasCustomDocument {
    return this.documentProvider.openCustomDocument(uri, openContext, token);
  }

  /**
   * Resolve which workflow_run_id this canvas should attach to:
   *   - pinned URI (`/workflow/<id>`) → that exact id; if it no longer
   *     exists in the DB, surface a stale-id error frame.
   *   - run-agnostic URI (`/active`) → call the resolver. Pick whatever
   *     run is currently most relevant.
   * Returns null when there's no run to show.
   */
  private resolveRunId(
    document: CanvasCustomDocument,
  ): { id: string | null; reason: 'pinned' | 'active' | 'pinned_stale' | 'empty_db' | 'no_resolver' } {
    if (document.pinnedWorkflowRunId) {
      // For pinned URIs, fall back to the data provider as a presence
      // probe. Loading nodes is cheap; if any record exists for that
      // run the canvas can render. Treats absent runs as stale.
      const probe = this.dataProvider.loadNodes(document.pinnedWorkflowRunId);
      if (probe.length > 0) return { id: document.pinnedWorkflowRunId, reason: 'pinned' };
      // Probe miss may also mean "run exists but has no architecture
      // records yet" — let the resolver confirm. If the liaison DB
      // confirms the workflow_run row exists, treat it as a valid pin
      // (early-stage run, not stale).
      if (this.liaisonDb) {
        const status = this.liaisonDb.getWorkflowStatus(document.pinnedWorkflowRunId);
        if (status.run !== null) return { id: document.pinnedWorkflowRunId, reason: 'pinned' };
      }
      return { id: null, reason: 'pinned_stale' };
    }
    if (!this.liaisonDb) return { id: null, reason: 'no_resolver' };
    const active = this.liaisonDb.getActiveWorkflowRun();
    if (active) return { id: active.id, reason: 'active' };
    return { id: null, reason: 'empty_db' };
  }

  /**
   * Resolve the custom editor for a document.
   */
  resolveCustomEditor(
    document: CanvasCustomDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken,
  ): Thenable<void> {
    const log = getLogger();
    log.info('ui', 'canvas resolveCustomEditor called', {
      mode: document.pinnedWorkflowRunId ? 'pinned' : 'active',
      pinnedWorkflowRunId: document.pinnedWorkflowRunId,
    });
    webviewPanel.title = 'Architecture Canvas';
    // Configure webview
    webviewPanel.webview.options = {
      enableScripts: true,
      enableCommandUris: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'),
        vscode.Uri.joinPath(this.extensionUri, 'src', 'webview'),
      ],
    };

    // Build and set HTML
    const html = this.buildCanvasHtml(webviewPanel.webview);
    webviewPanel.webview.html = html;

    // Handle messages from webview. The 'ready' handshake is the
    // signal to push the init payload — without it, posting init
    // synchronously here races the webview script load and the
    // message gets dropped on the floor (silent blank canvas).
    let initialized = false;
    const sendInit = (): void => {
      if (initialized) return;
      initialized = true;
      void this.initializeCanvas(document, webviewPanel, token);
    };
    const messageDisposable = webviewPanel.webview.onDidReceiveMessage(
      (message) => {
        const m = message as { type?: string };
        if (m?.type === 'ready') {
          log.info('ui', 'canvas: received ready handshake — posting init');
          sendInit();
          return;
        }
        this.handleWebviewMessage(document, message);
      },
    );

    // Clean up on dispose
    webviewPanel.onDidDispose(() => {
      messageDisposable.dispose();
    });

    // Belt-and-suspenders: if for some reason the webview never sends
    // 'ready' (e.g. it crashed before mount), still post init after a
    // short timeout so the user sees data rather than a permanent
    // blank. The `initialized` guard keeps the ready path from
    // double-posting.
    setTimeout(() => {
      if (!initialized) {
        log.warn('ui', 'canvas: ready handshake not received within 2s — posting init anyway');
        sendInit();
      }
    }, 2000);

    return Promise.resolve();
  }

  /**
   * Build the HTML for the Architecture Canvas webview.
   *
   * Uses the JanumiCode design system CSS for styling.
   */
  private buildCanvasHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'canvas.js'),
    );
    const designSystemUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'src', 'webview', 'design-system.css'),
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource};">
  <link href="${designSystemUri}" rel="stylesheet">
  <title>Architecture Canvas</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: var(--surface-0);
    }
    #app {
      width: 100%;
      height: 100%;
    }
    canvas {
      display: block;
    }
  </style>
</head>
<body>
  <div id="app"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * Initialize canvas data by loading nodes and edges from the database.
   */
  private async initializeCanvas(
    document: CanvasCustomDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const log = getLogger();
    const resolved = this.resolveRunId(document);
    if (resolved.id === null) {
      let message: string;
      if (resolved.reason === 'pinned_stale') {
        message = `Workflow run '${document.pinnedWorkflowRunId}' was not found in the current database. The DB may have been swapped, or the run was removed. Use the JanumiCode: Open Architecture Canvas command to switch to the active run.`;
      } else if (resolved.reason === 'no_resolver') {
        message = 'Architecture Canvas is missing the workflow-run resolver. Reload the window or report this if it persists.';
      } else {
        message = 'No workflow runs found in the current database. Start a workflow or open a different database.';
      }
      log.warn('ui', 'canvas: no resolvable run', {
        reason: resolved.reason,
        pinned: document.pinnedWorkflowRunId,
      });
      // Canvas inbound messages don't include an explicit "error" type
      // (yet) — surface as an init with empty arrays and an
      // info-message banner via VS Code, so the user gets actionable
      // feedback. Webview shows the empty state cleanly.
      const emptyInit: CanvasOutboundMessage = {
        type: 'init',
        nodes: [],
        edges: [],
        layout: [],
      };
      webviewPanel.webview.postMessage(emptyInit);
      void vscode.window.showWarningMessage(message);
      return;
    }

    // Load data from database for the resolved run.
    const runId = resolved.id;
    log.info('ui', 'canvas: loading data', {
      workflowRunId: runId,
      reason: resolved.reason,
    });
    const t0 = Date.now();
    const nodes = this.dataProvider.loadNodes(runId);
    const edges = this.dataProvider.loadEdges(runId);
    const layout = this.dataProvider.loadLayout(runId);

    const initMessage: CanvasOutboundMessage = {
      type: 'init',
      nodes,
      edges,
      layout,
    };

    log.info('ui', 'canvas: posting init payload', {
      workflowRunId: runId,
      nodes: nodes.length,
      edges: edges.length,
      layout: layout.length,
      load_ms: Date.now() - t0,
    });
    webviewPanel.webview.postMessage(initMessage);
  }

  /**
   * Handle messages from the webview.
   */
  private handleWebviewMessage(
    document: CanvasCustomDocument,
    message: unknown,
  ): void {
    const msg = message as { type: string; nodeId?: string; x?: number; y?: number };

    switch (msg.type) {
      case 'persistPosition':
        if (msg.nodeId && msg.x !== undefined && msg.y !== undefined) {
          // Resolve the run id at message-handling time so layout
          // positions are persisted against whichever run is currently
          // displayed. Skip the write if the run can't be resolved.
          const resolved = this.resolveRunId(document);
          if (resolved.id) {
            this.dataProvider.saveLayoutPosition(
              resolved.id,
              msg.nodeId,
              msg.x,
              msg.y,
            );
          }
        }
        break;

      case 'getNodeDetails':
        // Wave 11: Return node details for detail panel
        break;

      case 'resetLayout': {
        const resolved = this.resolveRunId(document);
        if (resolved.id) {
          this.dataProvider.clearLayout(resolved.id);
        }
        break;
      }

      case 'fitAll':
        // Wave 12: Fit all nodes in viewport
        break;

      case 'fitPhase':
        // Wave 12: Fit specific phase in viewport
        break;

      case 'toggleDependencyEdges':
        // Wave 12: Toggle dependency edge visibility
        break;

      default:
        // Unknown message type
        break;
    }
  }
}
