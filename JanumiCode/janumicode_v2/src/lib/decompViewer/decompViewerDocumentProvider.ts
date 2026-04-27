/**
 * Decomposition Viewer Custom Document Provider.
 *
 * Backed by a workflow_run id (passed via URI query) rather than a
 * physical file. Mirrors the Canvas document pattern.
 *
 * Two URI shapes are supported:
 *   - `janumicode-decomp-viewer:/active`           → run-agnostic;
 *     editor resolves the run dynamically each tick via the DB
 *     `getActiveWorkflowRun()` resolver. This is the form persisted
 *     by VS Code tab restore — survives DB swaps cleanly.
 *   - `janumicode-decomp-viewer:/workflow/<id>?workflowRunId=<id>`
 *     → pinned to a specific run. Used when the user explicitly
 *     picks an older run from the picker.
 *
 * `pinnedWorkflowRunId` is the parsed id when pinned, or `null` for
 * the `/active` form. The editor's snapshot loop uses this:
 *   - non-null → query that exact id (with stale-id error frame if
 *     the run is gone from the DB)
 *   - null     → call the resolver each tick.
 */

import * as vscode from 'vscode';

export class DecompViewerDocument implements vscode.CustomDocument {
  readonly uri: vscode.Uri;
  /** Specific workflow_run_id when the URI pins one; null for `/active`. */
  readonly pinnedWorkflowRunId: string | null;
  /**
   * Back-compat alias: the legacy `workflowRunId` field exposed by
   * earlier versions. New code should use `pinnedWorkflowRunId` to
   * make the "may-be-null" semantics explicit.
   * @deprecated use pinnedWorkflowRunId
   */
  readonly workflowRunId: string;

  private _isDisposed = false;
  private readonly _onDidDispose = new vscode.EventEmitter<void>();
  readonly onDidDispose = this._onDidDispose.event;

  constructor(uri: vscode.Uri) {
    this.uri = uri;
    // The /active path is run-agnostic and carries no id.
    if (uri.path === '/active' || uri.path.endsWith('/active')) {
      this.pinnedWorkflowRunId = null;
      this.workflowRunId = '';
      return;
    }
    const query = new URLSearchParams(uri.query);
    const fromQuery = query.get('workflowRunId');
    const fromPath = uri.path.split('/').pop() ?? '';
    const id = fromQuery ?? fromPath;
    this.pinnedWorkflowRunId = id || null;
    this.workflowRunId = id;
  }

  dispose(): void {
    if (!this._isDisposed) {
      this._isDisposed = true;
      this._onDidDispose.fire();
    }
  }
}
