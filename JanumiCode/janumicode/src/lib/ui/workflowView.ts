/**
 * Workflow Status View Provider
 * Implements Phase 8.4: Workflow state display with progress and gates
 * Shows current phase, progress, and active gates
 */

import * as vscode from 'vscode';
import type { WorkflowState } from '../workflow';
import type { Gate } from '../types';
import { getDatabase } from '../database';

/**
 * Workflow View Provider
 * Provides the workflow status webview
 */
export class WorkflowViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'janumicode.workflowView';

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
			}
		});
	}

	/**
	 * Refresh the workflow view
	 */
	public refresh() {
		if (this._view) {
			this._view.webview.postMessage({ type: 'refresh' });
			this._updateContent();
		}
	}

	/**
	 * Update content with latest workflow data
	 */
	private _updateContent() {
		if (!this._view) {
			return;
		}

		const workflowData = this._getWorkflowData();
		this._view.webview.postMessage({
			type: 'update',
			data: workflowData,
		});
	}

	/**
	 * Get workflow data from database
	 */
	private _getWorkflowData() {
		const db = getDatabase();
		if (!db) {
			return { states: [], gates: [] };
		}

		// Get workflow states
		const states = db
			.prepare(
				`
			SELECT state_id, dialogue_id, current_phase, previous_phase,
			       metadata, created_at, updated_at
			FROM workflow_states
			ORDER BY updated_at DESC
			LIMIT 10
		`
			)
			.all() as WorkflowState[];

		// Get open gates
		const gates = db
			.prepare(
				`
			SELECT gate_id, dialogue_id, reason, status,
			       blocking_claims, created_at, resolved_at
			FROM gates
			WHERE status = 'OPEN'
			ORDER BY created_at DESC
		`
			)
			.all() as (Omit<Gate, 'blocking_claims'> & { blocking_claims: string })[];

		// Parse blocking_claims JSON
		const parsedGates: Gate[] = gates.map((gate) => ({
			...gate,
			blocking_claims: JSON.parse(gate.blocking_claims) as string[],
		}));

		return { states, gates: parsedGates };
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
			<title>JanumiCode Workflow</title>
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

				.current-phase {
					margin-bottom: 20px;
					padding: 15px;
					background: var(--vscode-editor-background);
					border-left: 4px solid #2196F3;
					border-radius: 2px;
				}

				.phase-name {
					font-size: 18px;
					font-weight: 600;
					color: #2196F3;
					margin-bottom: 5px;
				}

				.phase-meta {
					font-size: 11px;
					color: var(--vscode-descriptionForeground);
				}

				.workflow-progress {
					margin-bottom: 20px;
				}

				.progress-bar {
					display: flex;
					gap: 2px;
					margin-top: 10px;
				}

				.progress-step {
					flex: 1;
					height: 8px;
					background: var(--vscode-input-background);
					border-radius: 2px;
				}

				.progress-step.complete {
					background: #4CAF50;
				}

				.progress-step.current {
					background: #2196F3;
				}

				.gates-section {
					margin-bottom: 20px;
				}

				.section-title {
					font-weight: 600;
					font-size: 13px;
					margin-bottom: 10px;
					padding: 5px 0;
					border-bottom: 1px solid var(--vscode-panel-border);
				}

				.gate {
					margin-bottom: 10px;
					padding: 10px;
					background: var(--vscode-editor-background);
					border-left: 3px solid #FF9800;
					border-radius: 2px;
				}

				.gate-reason {
					font-weight: 500;
					margin-bottom: 5px;
				}

				.gate-meta {
					font-size: 11px;
					color: var(--vscode-descriptionForeground);
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
				<h2>Workflow Status</h2>
			</div>

			<div id="workflow-container">
				<div class="empty-state">
					<div class="empty-state-icon">⚙️</div>
					<p>No active workflow</p>
					<p style="font-size: 12px;">Start a dialogue to see workflow status</p>
				</div>
			</div>

			<script>
				const vscode = acquireVsCodeApi();

				const PHASES = [
					'INTAKE', 'PROPOSE', 'ASSUMPTION_SURFACING', 'VERIFY',
					'HISTORICAL_CHECK', 'REVIEW', 'EXECUTE', 'VALIDATE', 'COMMIT'
				];

				function getPhaseIndex(phase) {
					return PHASES.indexOf(phase);
				}

				function renderWorkflow(states, gates) {
					const container = document.getElementById('workflow-container');

					if (states.length === 0) {
						container.innerHTML = \`
							<div class="empty-state">
								<div class="empty-state-icon">⚙️</div>
								<p>No active workflow</p>
								<p style="font-size: 12px;">Start a dialogue to see workflow status</p>
							</div>
						\`;
						return;
					}

					const currentState = states[0];
					const phaseIndex = getPhaseIndex(currentState.current_phase);

					let html = \`
						<div class="current-phase">
							<div class="phase-name">\${currentState.current_phase}</div>
							<div class="phase-meta">
								Updated: \${new Date(currentState.updated_at).toLocaleString()}
							</div>
						</div>

						<div class="workflow-progress">
							<div class="section-title">Workflow Progress</div>
							<div class="progress-bar">
								\${PHASES.map((phase, index) => {
									let className = 'progress-step';
									if (index < phaseIndex) className += ' complete';
									if (index === phaseIndex) className += ' current';
									return \`<div class="\${className}" title="\${phase}"></div>\`;
								}).join('')}
							</div>
						</div>
					\`;

					if (gates.length > 0) {
						html += '<div class="gates-section">';
						html += '<div class="section-title">Active Gates</div>';
						html += gates.map(gate => \`
							<div class="gate">
								<div class="gate-reason">\${gate.reason}</div>
								<div class="gate-meta">
									\${gate.blocking_claims.length} blocking claim(s) • Created: \${new Date(gate.created_at).toLocaleString()}
								</div>
							</div>
						\`).join('');
						html += '</div>';
					}

					container.innerHTML = html;
				}

				// Listen for messages from extension
				window.addEventListener('message', event => {
					const message = event.data;
					switch (message.type) {
						case 'update':
							renderWorkflow(message.data.states, message.data.gates);
							break;
					}
				});

				// Auto-refresh every 5 seconds
				setInterval(() => {
					vscode.postMessage({ type: 'refresh' });
				}, 5000);

				// Initial load
				vscode.postMessage({ type: 'refresh' });
			</script>
		</body>
		</html>`;
	}
}
