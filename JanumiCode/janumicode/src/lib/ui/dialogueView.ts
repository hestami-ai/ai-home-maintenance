/**
 * Dialogue Panel Webview Provider
 * Implements Phase 8.2: Dialogue display with turns, claims, and evidence
 * Shows the complete dialogue history with role-based rendering
 */

import * as vscode from 'vscode';
import type { DialogueEvent, Claim } from '../types';
import { getDatabase } from '../database';

/**
 * Dialogue View Provider
 * Provides the dialogue panel webview
 */
export class DialogueViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'janumicode.dialogueView';

	private _view?: vscode.WebviewView;

	constructor(private readonly _extensionUri: vscode.Uri) {}

	/**
	 * Resolve webview view
	 */
	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri],
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		// Handle messages from the webview
		webviewView.webview.onDidReceiveMessage((data) => {
			switch (data.type) {
				case 'refresh':
					this.refresh();
					break;
				case 'selectTurn':
					this._handleTurnSelection(data.turnId);
					break;
			}
		});
	}

	/**
	 * Refresh the dialogue view
	 */
	public refresh() {
		if (this._view) {
			this._view.webview.postMessage({ type: 'refresh' });
			this._updateContent();
		}
	}

	/**
	 * Update content with latest dialogue data
	 */
	private _updateContent() {
		if (!this._view) {
			return;
		}

		const dialogueData = this._getDialogueData();
		this._view.webview.postMessage({
			type: 'update',
			data: dialogueData,
		});
	}

	/**
	 * Get dialogue data from database
	 */
	private _getDialogueData() {
		const db = getDatabase();
		if (!db) {
			return { turns: [], claims: [] };
		}

		// Get recent dialogue turns (limit to last 100)
		const turns = db
			.prepare(
				`
			SELECT event_id AS turn_id, dialogue_id, role, phase, speech_act,
			       event_type, summary, COALESCE(content, summary) AS content_ref, timestamp
			FROM dialogue_events
			ORDER BY timestamp DESC
			LIMIT 100
		`
			)
			.all() as (DialogueEvent & { content_ref: string })[];

		// Get recent claims
		const claims = db
			.prepare(
				`
			SELECT claim_id, statement, introduced_by, criticality,
			       status, dialogue_id, turn_id, created_at
			FROM claims
			ORDER BY created_at DESC
			LIMIT 50
		`
			)
			.all() as Claim[];

		return { turns: turns.reverse(), claims };
	}

	/**
	 * Handle turn selection
	 */
	private _handleTurnSelection(turnId: number) {
		// Could open detailed turn view or jump to related claims
		vscode.window.showInformationMessage(`Selected turn: ${turnId}`);
	}

	/**
	 * Get HTML for webview
	 */
	private _getHtmlForWebview(webview: vscode.Webview): string {
		return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>JanumiCode Dialogue</title>
			<style>
				body {
					padding: 10px;
					color: var(--vscode-foreground);
					font-family: var(--vscode-font-family);
					font-size: var(--vscode-font-size);
				}

				.header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: 15px;
					padding-bottom: 10px;
					border-bottom: 1px solid var(--vscode-panel-border);
				}

				.header h2 {
					margin: 0;
					font-size: 16px;
					font-weight: 600;
				}

				.refresh-btn {
					background: var(--vscode-button-background);
					color: var(--vscode-button-foreground);
					border: none;
					padding: 4px 12px;
					border-radius: 2px;
					cursor: pointer;
					font-size: 12px;
				}

				.refresh-btn:hover {
					background: var(--vscode-button-hoverBackground);
				}

				.turn {
					margin-bottom: 15px;
					padding: 10px;
					background: var(--vscode-editor-background);
					border-left: 3px solid var(--vscode-panel-border);
					border-radius: 2px;
				}

				.turn.human {
					border-left-color: #4CAF50;
				}

				.turn.executor {
					border-left-color: #2196F3;
				}

				.turn.verifier {
					border-left-color: #FF9800;
				}

				.turn.technical-expert {
					border-left-color: #9C27B0;
				}

				.turn.historian {
					border-left-color: #00BCD4;
				}

				.turn-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: 8px;
				}

				.role-badge {
					display: inline-block;
					padding: 2px 8px;
					border-radius: 3px;
					font-size: 11px;
					font-weight: 600;
					text-transform: uppercase;
				}

				.role-badge.human {
					background: #4CAF5033;
					color: #4CAF50;
				}

				.role-badge.executor {
					background: #2196F333;
					color: #2196F3;
				}

				.role-badge.verifier {
					background: #FF980033;
					color: #FF9800;
				}

				.role-badge.technical-expert {
					background: #9C27B033;
					color: #9C27B0;
				}

				.role-badge.historian {
					background: #00BCD433;
					color: #00BCD4;
				}

				.timestamp {
					font-size: 11px;
					color: var(--vscode-descriptionForeground);
				}

				.turn-content {
					margin-top: 8px;
					line-height: 1.5;
					word-wrap: break-word;
				}

				.phase-tag {
					display: inline-block;
					padding: 1px 6px;
					border-radius: 2px;
					font-size: 10px;
					background: var(--vscode-badge-background);
					color: var(--vscode-badge-foreground);
					margin-left: 8px;
				}

				.empty-state {
					text-align: center;
					padding: 40px 20px;
					color: var(--vscode-descriptionForeground);
				}

				.empty-state-icon {
					font-size: 48px;
					margin-bottom: 10px;
				}
			</style>
		</head>
		<body>
			<div class="header">
				<h2>Dialogue History</h2>
				<button class="refresh-btn" onclick="refresh()">Refresh</button>
			</div>

			<div id="dialogue-container">
				<div class="empty-state">
					<div class="empty-state-icon">💬</div>
					<p>No dialogue turns yet</p>
					<p style="font-size: 12px;">Start a new dialogue to see turns here</p>
				</div>
			</div>

			<script>
				const vscode = acquireVsCodeApi();

				function refresh() {
					vscode.postMessage({ type: 'refresh' });
				}

				function selectTurn(turnId) {
					vscode.postMessage({ type: 'selectTurn', turnId });
				}

				function formatTimestamp(timestamp) {
					const date = new Date(timestamp);
					return date.toLocaleString();
				}

				function getRoleClass(role) {
					return role.toLowerCase().replace('_', '-');
				}

				function renderTurns(turns) {
					const container = document.getElementById('dialogue-container');

					if (turns.length === 0) {
						container.innerHTML = \`
							<div class="empty-state">
								<div class="empty-state-icon">💬</div>
								<p>No dialogue turns yet</p>
								<p style="font-size: 12px;">Start a new dialogue to see turns here</p>
							</div>
						\`;
						return;
					}

					container.innerHTML = turns.map(turn => \`
						<div class="turn \${getRoleClass(turn.role)}" onclick="selectTurn(\${turn.turn_id})">
							<div class="turn-header">
								<div>
									<span class="role-badge \${getRoleClass(turn.role)}">\${turn.role}</span>
									<span class="phase-tag">\${turn.phase}</span>
								</div>
								<span class="timestamp">\${formatTimestamp(turn.timestamp)}</span>
							</div>
							<div class="turn-content">
								<strong>\${turn.speech_act}:</strong> \${turn.content_ref}
							</div>
						</div>
					\`).join('');
				}

				// Listen for messages from extension
				window.addEventListener('message', event => {
					const message = event.data;
					switch (message.type) {
						case 'update':
							renderTurns(message.data.turns);
							break;
					}
				});

				// Auto-refresh every 5 seconds
				setInterval(refresh, 5000);

				// Initial load
				refresh();
			</script>
		</body>
		</html>`;
	}
}
