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
  ) {
    this.documentProvider = new CanvasDocumentProvider();
    this.dataProvider = new CanvasDataProvider(db);
  }

  /**
   * Register the custom editor provider with VS Code.
   */
  static register(
    context: vscode.ExtensionContext,
    db: Database,
  ): vscode.Disposable {
    const provider = new CanvasEditorProvider(context.extensionUri, db);

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
   * Resolve the custom editor for a document.
   */
  resolveCustomEditor(
    document: CanvasCustomDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken,
  ): Thenable<void> {
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
    const html = this.buildCanvasHtml(webviewPanel.webview, document.workflowRunId);
    webviewPanel.webview.html = html;

    // Handle messages from webview
    const messageDisposable = webviewPanel.webview.onDidReceiveMessage(
      (message) => this.handleWebviewMessage(document, message),
    );

    // Clean up on dispose
    webviewPanel.onDidDispose(() => {
      messageDisposable.dispose();
    });

    // Initialize canvas data
    return this.initializeCanvas(document, webviewPanel, token);
  }

  /**
   * Build the HTML for the Architecture Canvas webview.
   *
   * Uses the JanumiCode design system CSS for styling.
   */
  private buildCanvasHtml(webview: vscode.Webview, workflowRunId: string): string {
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
<body data-workflow-run-id="${workflowRunId}">
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
    // Load data from database
    const nodes = this.dataProvider.loadNodes(document.workflowRunId);
    const edges = this.dataProvider.loadEdges(document.workflowRunId);
    const layout = this.dataProvider.loadLayout(document.workflowRunId);

    const initMessage: CanvasOutboundMessage = {
      type: 'init',
      nodes,
      edges,
      layout,
    };

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
          this.dataProvider.saveLayoutPosition(
            document.workflowRunId,
            msg.nodeId,
            msg.x,
            msg.y,
          );
        }
        break;

      case 'getNodeDetails':
        // Wave 11: Return node details for detail panel
        break;

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
