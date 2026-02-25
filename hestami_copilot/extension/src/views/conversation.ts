/**
 * Conversation Canvas View Provider
 *
 * Single chat thread with four personas:
 * - Product Manager (human)
 * - Technical Expert (cloud agent)
 * - Executor (cloud agent)
 * - Historian (local agent)
 */

import * as vscode from 'vscode';
import type { HistorianClient } from '../historian-client';

export class ConversationViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private extensionUri: vscode.Uri;
  private historianClient: HistorianClient;

  constructor(extensionUri: vscode.Uri, historianClient: HistorianClient) {
    this.extensionUri = extensionUri;
    this.historianClient = historianClient;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml();

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'submit':
          await this.handleSubmit(message.text);
          break;
        case 'adjudicate':
          await this.handleAdjudicate(message.proposal);
          break;
      }
    });
  }

  startNewSession(): void {
    if (this.view) {
      this.view.webview.postMessage({ type: 'newSession' });
    }
  }

  private async handleSubmit(text: string): Promise<void> {
    // TODO: Implement conversation flow
    console.log('User submitted:', text);
  }

  private async handleAdjudicate(proposal: unknown): Promise<void> {
    try {
      const result = await this.historianClient.adjudicate(proposal as Record<string, unknown>);
      this.view?.webview.postMessage({ type: 'verdict', data: result });
    } catch (error) {
      this.view?.webview.postMessage({ type: 'error', message: String(error) });
    }
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hestami Court</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 10px;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }
    .conversation {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 10px;
    }
    .message {
      padding: 8px 12px;
      border-radius: 8px;
      max-width: 90%;
    }
    .message.user {
      background-color: var(--vscode-button-background);
      align-self: flex-end;
    }
    .message.assistant {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      align-self: flex-start;
    }
    .message .persona {
      font-size: 0.8em;
      opacity: 0.7;
      margin-bottom: 4px;
    }
    .input-area {
      display: flex;
      gap: 8px;
    }
    .input-area input {
      flex: 1;
      padding: 8px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 4px;
    }
    .input-area button {
      padding: 8px 16px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .input-area button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .status {
      font-size: 0.9em;
      padding: 8px;
      border-radius: 4px;
      margin-bottom: 10px;
    }
    .status.connected {
      background-color: var(--vscode-testing-iconPassed);
      color: white;
    }
    .status.disconnected {
      background-color: var(--vscode-testing-iconFailed);
      color: white;
    }
  </style>
</head>
<body>
  <div class="status disconnected" id="status">Connecting to Historian...</div>

  <div class="conversation" id="conversation">
    <div class="message assistant">
      <div class="persona">Technical Expert</div>
      Welcome to Hestami Court. Link a specification to begin.
    </div>
  </div>

  <div class="input-area">
    <input type="text" id="input" placeholder="Describe your implementation plan..." />
    <button id="submit">Send</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const input = document.getElementById('input');
    const submit = document.getElementById('submit');
    const conversation = document.getElementById('conversation');
    const status = document.getElementById('status');

    submit.addEventListener('click', () => {
      const text = input.value.trim();
      if (text) {
        addMessage('user', 'You', text);
        vscode.postMessage({ type: 'submit', text });
        input.value = '';
      }
    });

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        submit.click();
      }
    });

    window.addEventListener('message', (event) => {
      const message = event.data;
      switch (message.type) {
        case 'verdict':
          addMessage('assistant', 'Historian', formatVerdict(message.data));
          break;
        case 'newSession':
          conversation.innerHTML = '';
          addMessage('assistant', 'Technical Expert', 'New session started. Link a specification to begin.');
          break;
        case 'connected':
          status.textContent = 'Connected to Historian';
          status.className = 'status connected';
          break;
        case 'error':
          addMessage('assistant', 'System', 'Error: ' + message.message);
          break;
      }
    });

    function addMessage(type, persona, text) {
      const div = document.createElement('div');
      div.className = 'message ' + type;
      div.innerHTML = '<div class="persona">' + persona + '</div>' + text;
      conversation.appendChild(div);
      conversation.scrollTop = conversation.scrollHeight;
    }

    function formatVerdict(data) {
      return '<strong>Status: ' + data.status + '</strong><br>' +
        (data.conflicts?.length ? 'Conflicts: ' + data.conflicts.join(', ') + '<br>' : '') +
        (data.conditions?.length ? 'Conditions: ' + data.conditions.join(', ') + '<br>' : '') +
        (data.comments || '');
    }
  </script>
</body>
</html>`;
  }
}
