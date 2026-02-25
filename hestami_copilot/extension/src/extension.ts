/**
 * Hestami Court - VS Code Extension
 *
 * AI-assisted software development with Historian-based governance.
 * Provides a conversation canvas with four personas and phase-gated progression.
 */

import * as vscode from 'vscode';
import { HistorianClient } from './historian-client';
import { ConversationViewProvider } from './views/conversation';
import { FeatureTreeProvider } from './views/feature';
import { VerdictTreeProvider } from './views/verdict';
import { StepTreeProvider } from './views/step';

let historianClient: HistorianClient;

export function activate(context: vscode.ExtensionContext) {
  console.log('Hestami Court extension activating...');

  // Get configuration
  const config = vscode.workspace.getConfiguration('hestami-court');
  const historianUrl = config.get<string>('historianUrl') || 'http://localhost:8000';
  const bundleBuilderUrl = config.get<string>('bundleBuilderUrl') || 'http://localhost:3001';

  // Initialize Historian client
  historianClient = new HistorianClient(historianUrl, bundleBuilderUrl);

  // Register view providers
  const conversationProvider = new ConversationViewProvider(context.extensionUri, historianClient);
  const featureProvider = new FeatureTreeProvider();
  const verdictProvider = new VerdictTreeProvider();
  const stepProvider = new StepTreeProvider();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('hestami-court.conversation', conversationProvider),
    vscode.window.registerTreeDataProvider('hestami-court.feature', featureProvider),
    vscode.window.registerTreeDataProvider('hestami-court.verdicts', verdictProvider),
    vscode.window.registerTreeDataProvider('hestami-court.steps', stepProvider)
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('hestami-court.startSession', () => {
      vscode.window.showInformationMessage('Starting Hestami Court session...');
      conversationProvider.startNewSession();
    }),

    vscode.commands.registerCommand('hestami-court.submitProposal', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const selection = editor.selection;
      const text = editor.document.getText(selection.isEmpty ? undefined : selection);

      try {
        const result = await historianClient.adjudicate({
          action_id: `AP-${Date.now()}`,
          feature: 'Manual submission',
          description: text.substring(0, 500),
          steps: [text],
          expected_outcome: 'As described',
        });

        verdictProvider.addVerdict(result);
        vscode.window.showInformationMessage(`Adjudication: ${result.status}`);
      } catch (error) {
        vscode.window.showErrorMessage(`Adjudication failed: ${error}`);
      }
    }),

    vscode.commands.registerCommand('hestami-court.showVerdicts', () => {
      vscode.commands.executeCommand('hestami-court.verdicts.focus');
    }),

    vscode.commands.registerCommand('hestami-court.linkSpec', async () => {
      const files = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { 'Markdown': ['md'] },
        title: 'Select Specification Document',
      });

      if (files && files.length > 0) {
        featureProvider.linkSpec(files[0]);
        vscode.window.showInformationMessage(`Linked spec: ${files[0].fsPath}`);
      }
    }),

    vscode.commands.registerCommand('hestami-court.recordDecision', async () => {
      const summary = await vscode.window.showInputBox({
        prompt: 'Decision summary',
        placeHolder: 'Brief description of the decision...',
      });

      if (summary) {
        const details = await vscode.window.showInputBox({
          prompt: 'Decision details (rationale)',
          placeHolder: 'Why was this decision made?',
        });

        if (details) {
          // Record decision trace
          vscode.window.showInformationMessage(`Decision recorded: ${summary}`);
        }
      }
    })
  );

  console.log('Hestami Court extension activated');
}

export function deactivate() {
  console.log('Hestami Court extension deactivated');
}
