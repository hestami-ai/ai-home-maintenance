/**
 * Canvas Custom Document Provider.
 *
 * Provides the document model for Architecture Canvas custom editors.
 * Each document represents a workflow run's architecture visualization.
 */

import * as vscode from 'vscode';

export interface CanvasDocument {
  readonly uri: vscode.Uri;
  readonly workflowRunId: string;
}

/**
 * Custom document for Architecture Canvas.
 * Backed by the workflow_runs table, not a physical file.
 */
export class CanvasCustomDocument implements vscode.CustomDocument, CanvasDocument {
  readonly uri: vscode.Uri;
  readonly workflowRunId: string;

  private _isDisposed = false;
  private readonly _onDidDispose = new vscode.EventEmitter<void>();
  readonly onDidDispose = this._onDidDispose.event;

  constructor(uri: vscode.Uri) {
    this.uri = uri;
    // Extract workflow run ID from URI query parameter
    const query = new URLSearchParams(uri.query);
    this.workflowRunId = query.get('workflowRunId') ?? uri.path.split('/').pop() ?? '';
  }

  dispose(): void {
    if (!this._isDisposed) {
      this._isDisposed = true;
      this._onDidDispose.fire();
    }
  }
}

/**
 * Provides custom documents for Architecture Canvas.
 * Handles the `janumicode-canvas:` scheme.
 */
export class CanvasDocumentProvider {
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<CanvasCustomDocument>>();
  readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  /**
   * Open a custom document for the given URI.
   */
  openCustomDocument(uri: vscode.Uri, _openContext: vscode.CustomDocumentOpenContext, _token: vscode.CancellationToken): CanvasCustomDocument {
    return new CanvasCustomDocument(uri);
  }

  /**
   * Resolve the custom editor for the document.
   * This is called by CanvasEditorProvider.
   */
  resolveCustomEditor(
    document: CanvasCustomDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): void {
    // Set up webview panel options
    webviewPanel.webview.options = {
      enableScripts: true,
      enableCommandUris: true,
    };

    // Handle disposal
    document.onDidDispose(() => {
      webviewPanel.dispose();
    });
  }

  /**
   * Save the document.
   * No-op for canvas documents as they're backed by the database.
   */
  saveCustomDocument(_document: CanvasCustomDocument, _token: vscode.CancellationToken): Thenable<void> {
    return Promise.resolve();
  }

  /**
   * Save the document as a different URI.
   * Not supported for canvas documents.
   */
  saveCustomDocumentAs(_document: CanvasCustomDocument, _destination: vscode.Uri, _token: vscode.CancellationToken): Thenable<void> {
    return Promise.reject(new Error('Save As is not supported for Architecture Canvas documents'));
  }

  /**
   * Revert the document to its saved state.
   * No-op for canvas documents.
   */
  revertCustomDocument(_document: CanvasCustomDocument, _token: vscode.CancellationToken): Thenable<void> {
    return Promise.resolve();
  }

  /**
   * Backup the document for hot exit.
   */
  backupCustomDocument(_document: CanvasCustomDocument, _context: vscode.CustomDocumentBackupContext, _token: vscode.CancellationToken): Thenable<vscode.CustomDocumentBackup> {
    return Promise.resolve({
      id: '',
      delete: () => {},
    });
  }
}
