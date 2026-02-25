/**
 * Court Panel Tree View
 *
 * Shows verdicts, conflicts, and verification queries.
 */

import * as vscode from 'vscode';
import type { AdjudicationResponse } from '@hestami/contracts';

interface VerdictItem {
  id: string;
  label: string;
  type: 'verdict' | 'conflict' | 'condition' | 'query' | 'evidence';
  status?: string;
  description?: string;
  children?: VerdictItem[];
}

export class VerdictTreeProvider implements vscode.TreeDataProvider<VerdictItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<VerdictItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private verdicts: VerdictItem[] = [];

  getTreeItem(element: VerdictItem): vscode.TreeItem {
    const item = new vscode.TreeItem(
      element.label,
      element.children ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
    );

    item.contextValue = element.type;
    item.id = element.id;
    item.description = element.description;

    switch (element.type) {
      case 'verdict':
        switch (element.status) {
          case 'CONSISTENT':
            item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
            break;
          case 'INCONSISTENT':
            item.iconPath = new vscode.ThemeIcon('x', new vscode.ThemeColor('testing.iconFailed'));
            break;
          case 'CONDITIONAL':
            item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('testing.iconQueued'));
            break;
          case 'UNKNOWN':
            item.iconPath = new vscode.ThemeIcon('question', new vscode.ThemeColor('testing.iconSkipped'));
            break;
        }
        break;
      case 'conflict':
        item.iconPath = new vscode.ThemeIcon('error');
        break;
      case 'condition':
        item.iconPath = new vscode.ThemeIcon('warning');
        break;
      case 'query':
        item.iconPath = new vscode.ThemeIcon('question');
        break;
      case 'evidence':
        item.iconPath = new vscode.ThemeIcon('references');
        break;
    }

    return item;
  }

  getChildren(element?: VerdictItem): VerdictItem[] {
    if (!element) {
      return this.verdicts;
    }
    return element.children || [];
  }

  addVerdict(response: AdjudicationResponse): void {
    const verdictId = response.action_id || `verdict-${Date.now()}`;
    const children: VerdictItem[] = [];

    // Add conflicts
    if (response.conflicts && response.conflicts.length > 0) {
      for (let i = 0; i < response.conflicts.length; i++) {
        children.push({
          id: `${verdictId}-conflict-${i}`,
          label: response.conflicts[i] || 'Unknown conflict',
          type: 'conflict',
        });
      }
    }

    // Add conditions
    if (response.conditions && response.conditions.length > 0) {
      for (let i = 0; i < response.conditions.length; i++) {
        children.push({
          id: `${verdictId}-condition-${i}`,
          label: response.conditions[i] || 'Unknown condition',
          type: 'condition',
        });
      }
    }

    // Add verification queries
    if (response.verification_queries && response.verification_queries.length > 0) {
      for (let i = 0; i < response.verification_queries.length; i++) {
        children.push({
          id: `${verdictId}-query-${i}`,
          label: response.verification_queries[i] || 'Unknown query',
          type: 'query',
        });
      }
    }

    // Add evidence citations
    if (response.evidence && response.evidence.length > 0) {
      for (let i = 0; i < response.evidence.length; i++) {
        const e = response.evidence[i];
        children.push({
          id: `${verdictId}-evidence-${i}`,
          label: e?.id || 'Unknown source',
          type: 'evidence',
          description: e?.excerpt?.substring(0, 50) + '...',
        });
      }
    }

    const verdictItem: VerdictItem = {
      id: verdictId,
      label: `${response.action_id || 'Proposal'}: ${response.status}`,
      type: 'verdict',
      status: response.status,
      description: response.comments?.substring(0, 50),
      children: children.length > 0 ? children : undefined,
    };

    this.verdicts.unshift(verdictItem);
    this._onDidChangeTreeData.fire(undefined);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  clear(): void {
    this.verdicts = [];
    this._onDidChangeTreeData.fire(undefined);
  }
}
