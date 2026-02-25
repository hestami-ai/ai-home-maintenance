/**
 * Feature Panel Tree View
 *
 * Shows linked specifications and coverage matrix.
 */

import * as vscode from 'vscode';

interface FeatureItem {
  id: string;
  label: string;
  type: 'spec' | 'section' | 'requirement';
  uri?: vscode.Uri;
  children?: FeatureItem[];
}

export class FeatureTreeProvider implements vscode.TreeDataProvider<FeatureItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<FeatureItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private linkedSpecs: FeatureItem[] = [];

  getTreeItem(element: FeatureItem): vscode.TreeItem {
    const item = new vscode.TreeItem(
      element.label,
      element.children ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
    );

    item.contextValue = element.type;
    item.id = element.id;

    if (element.uri) {
      item.resourceUri = element.uri;
      item.command = {
        command: 'vscode.open',
        title: 'Open Spec',
        arguments: [element.uri],
      };
    }

    switch (element.type) {
      case 'spec':
        item.iconPath = new vscode.ThemeIcon('file-text');
        break;
      case 'section':
        item.iconPath = new vscode.ThemeIcon('symbol-namespace');
        break;
      case 'requirement':
        item.iconPath = new vscode.ThemeIcon('checklist');
        break;
    }

    return item;
  }

  getChildren(element?: FeatureItem): FeatureItem[] {
    if (!element) {
      return this.linkedSpecs;
    }
    return element.children || [];
  }

  linkSpec(uri: vscode.Uri): void {
    const filename = uri.fsPath.split(/[/\\]/).pop() || 'Unknown';
    const specId = filename.replace(/\.md$/i, '').toUpperCase();

    this.linkedSpecs.push({
      id: specId,
      label: filename,
      type: 'spec',
      uri,
      children: [
        {
          id: `${specId}#overview`,
          label: 'Overview',
          type: 'section',
        },
        {
          id: `${specId}#requirements`,
          label: 'Requirements',
          type: 'section',
          children: [
            {
              id: `${specId}#req-1`,
              label: 'Requirement 1 (placeholder)',
              type: 'requirement',
            },
          ],
        },
      ],
    });

    this._onDidChangeTreeData.fire(undefined);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}
