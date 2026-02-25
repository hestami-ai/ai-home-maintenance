/**
 * Step Panel Tree View
 *
 * Shows current step contract, patch diff, and planned commands.
 */

import * as vscode from 'vscode';

interface StepItem {
  id: string;
  label: string;
  type: 'phase' | 'step' | 'command' | 'diff';
  status?: 'pending' | 'in_progress' | 'completed' | 'blocked';
  description?: string;
  children?: StepItem[];
}

export class StepTreeProvider implements vscode.TreeDataProvider<StepItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<StepItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private phases: StepItem[] = [
    {
      id: 'bootstrap',
      label: 'BOOTSTRAP',
      type: 'phase',
      status: 'pending',
      description: 'Link spec, compute feature ID',
      children: [
        { id: 'bootstrap-1', label: 'Link specification', type: 'step', status: 'pending' },
        { id: 'bootstrap-2', label: 'Compute feature ID', type: 'step', status: 'pending' },
      ],
    },
    {
      id: 'requirements',
      label: 'REQUIREMENTS_SHAPING',
      type: 'phase',
      status: 'pending',
      description: 'Human + Technical Expert',
      children: [
        { id: 'req-1', label: 'Clarify requirements', type: 'step', status: 'pending' },
        { id: 'req-2', label: 'Identify constraints', type: 'step', status: 'pending' },
      ],
    },
    {
      id: 'roadmap',
      label: 'ROADMAP_SYNTHESIS',
      type: 'phase',
      status: 'pending',
      description: 'Generate phased implementation',
      children: [
        { id: 'roadmap-1', label: 'Generate implementation plan', type: 'step', status: 'pending' },
        { id: 'roadmap-2', label: 'Adjudicate plan', type: 'step', status: 'pending' },
      ],
    },
    {
      id: 'execution',
      label: 'EXECUTION',
      type: 'phase',
      status: 'pending',
      description: 'Step loop with dual adjudication',
      children: [],
    },
  ];

  getTreeItem(element: StepItem): vscode.TreeItem {
    const item = new vscode.TreeItem(
      element.label,
      element.children ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
    );

    item.contextValue = element.type;
    item.id = element.id;
    item.description = element.description;

    // Set icon based on status
    switch (element.status) {
      case 'completed':
        item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
        break;
      case 'in_progress':
        item.iconPath = new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('testing.iconQueued'));
        break;
      case 'blocked':
        item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
        break;
      case 'pending':
      default:
        if (element.type === 'phase') {
          item.iconPath = new vscode.ThemeIcon('folder');
        } else if (element.type === 'step') {
          item.iconPath = new vscode.ThemeIcon('circle-outline');
        } else if (element.type === 'command') {
          item.iconPath = new vscode.ThemeIcon('terminal');
        } else if (element.type === 'diff') {
          item.iconPath = new vscode.ThemeIcon('diff');
        }
    }

    return item;
  }

  getChildren(element?: StepItem): StepItem[] {
    if (!element) {
      return this.phases;
    }
    return element.children || [];
  }

  setPhaseStatus(phaseId: string, status: StepItem['status']): void {
    const phase = this.phases.find((p) => p.id === phaseId);
    if (phase) {
      phase.status = status;
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  addStep(phaseId: string, step: Omit<StepItem, 'type'>): void {
    const phase = this.phases.find((p) => p.id === phaseId);
    if (phase) {
      if (!phase.children) {
        phase.children = [];
      }
      phase.children.push({ ...step, type: 'step' });
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  updateStep(stepId: string, status: StepItem['status']): void {
    for (const phase of this.phases) {
      const step = phase.children?.find((s) => s.id === stepId);
      if (step) {
        step.status = status;
        this._onDidChangeTreeData.fire(undefined);
        return;
      }
    }
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}
