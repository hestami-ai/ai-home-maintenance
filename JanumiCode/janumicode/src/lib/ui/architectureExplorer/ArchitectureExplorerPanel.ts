/**
 * Architecture Explorer — a full-editor WebviewPanel that renders the
 * architecture decomposition as an interactive tree with cross-references
 * and reasoning review concerns. Live-updates as the architecture phase proceeds.
 */
import * as vscode from 'vscode';
import { getArchitectureDocumentForDialogue } from '../../database/architectureStore';
import { getDatabase } from '../../database/init';
import { getEventBus } from '../../integration/eventBus';
import {
	renderCapabilityTree,
	renderComponentTree,
	renderDataModels,
	renderInterfaces,
	renderImplementationSequence,
	renderCrosswalk,
	renderValidationFindings,
	buildConcernMap,
} from './renderTree';
import { getExplorerStyles } from './explorerStyles';

let instance: ArchitectureExplorerPanel | undefined;

export function openArchitectureExplorer(
	dialogueId: string,
	_extensionUri: vscode.Uri
): void {
	if (instance) {
		instance.reveal(dialogueId);
	} else {
		instance = new ArchitectureExplorerPanel(dialogueId);
	}
}

class ArchitectureExplorerPanel {
	private readonly _panel: vscode.WebviewPanel;
	private _dialogueId: string;
	private _eventUnsubscribers: (() => void)[] = [];
	private _refreshTimer: ReturnType<typeof setTimeout> | null = null;
	private _currentSubPhase = '';
	private _disposed = false;

	constructor(dialogueId: string) {
		this._dialogueId = dialogueId;

		this._panel = vscode.window.createWebviewPanel(
			'janumicode.architectureExplorer',
			'Architecture Explorer',
			vscode.ViewColumn.One,
			{ enableScripts: true, retainContextWhenHidden: true }
		);

		this._panel.onDidDispose(() => this._cleanup());

		this._panel.webview.onDidReceiveMessage(message => {
			if (message.type === 'refresh') {
				this._refreshContent();
			}
		});

		this._subscribeToEvents();
		this._refreshContent();
	}

	public reveal(dialogueId: string): void {
		this._dialogueId = dialogueId;
		this._panel.reveal(vscode.ViewColumn.One);
		this._refreshContent();
	}

	// ── EVENT SUBSCRIPTIONS ──

	private _subscribeToEvents(): void {
		const bus = getEventBus();

		this._eventUnsubscribers.push(
			// Refresh when architecture-related commands complete
			bus.on('workflow:command', (payload) => {
				if (this._disposed) { return; }
				const label = (payload as { label?: string }).label ?? '';
				const action = (payload as { action?: string }).action ?? '';
				if (shouldRefreshOnCommand(label, action)) {
					this._scheduleRefresh();
				}
			}),
			// Track sub-phase progress
			bus.on('workflow:phase_changed', (payload) => {
				if (this._disposed) { return; }
				const p = payload as { currentPhase?: string; currentSubPhase?: string };
				if (p.currentPhase === 'ARCHITECTURE' && p.currentSubPhase) {
					this._currentSubPhase = p.currentSubPhase;
					this._postProgress(p.currentSubPhase);
				}
			}),
			// Refresh when a gate is triggered (validation complete, presenting)
			bus.on('workflow:gate_triggered', () => {
				if (this._disposed) { return; }
				this._scheduleRefresh();
			}),
		);
	}

	// ── DEBOUNCED REFRESH ──

	private _scheduleRefresh(): void {
		if (this._refreshTimer) { clearTimeout(this._refreshTimer); }
		this._refreshTimer = setTimeout(() => {
			this._refreshTimer = null;
			if (!this._disposed) { this._refreshContent(); }
		}, 2000);
	}

	private _postProgress(subPhase: string): void {
		if (this._disposed) { return; }
		this._panel.webview.postMessage({
			type: 'architectureProgress',
			data: { subPhase },
		});
	}

	// ── CONTENT RENDERING ──

	private _refreshContent(): void {
		const docResult = getArchitectureDocumentForDialogue(this._dialogueId);
		if (!docResult.success || !docResult.value) {
			this._panel.webview.html = getErrorHtml(
				'No architecture document found yet. The explorer will update automatically as the architecture phase proceeds.'
			);
			return;
		}

		const doc = docResult.value;
		const reviewJsonStrings = loadReviewConcerns(this._dialogueId);
		const concerns = buildConcernMap(reviewJsonStrings, doc);

		const capabilitiesHtml = renderCapabilityTree(doc, concerns);
		const componentsHtml = renderComponentTree(doc, concerns);
		const dataModelsHtml = renderDataModels(doc);
		const interfacesHtml = renderInterfaces(doc);
		const implSequenceHtml = renderImplementationSequence(doc);
		const crosswalkHtml = renderCrosswalk(doc);
		const validationHtml = renderValidationFindings(doc.validation_findings ?? []);

		const generalConcerns = concerns.get('__general__') ?? [];
		const generalConcernsHtml = generalConcerns.length > 0
			? `<div style="margin-top:8px;"><h3>General Concerns</h3>`
				+ generalConcerns.map(c =>
					`<div class="concern-badge ${c.severity}">&#x26A0; ${c.severity}: ${c.summary}</div>`
				).join('')
				+ `</div>`
			: '';

		const styles = getExplorerStyles();
		const subPhaseLabel = this._currentSubPhase
			? `<span class="progress-indicator" id="progress-indicator"><span class="progress-spinner"></span> ${escapeHtml(this._currentSubPhase)}</span>`
			: '';

		this._panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<style>${styles}</style>
</head>
<body>
	<div class="explorer-header">
		<h1>Architecture Explorer</h1>
		<span class="meta">v${doc.version} | ${doc.capabilities.length} capabilities | ${doc.components.length} components | ${doc.data_models.length} data models | ${doc.interfaces.length} interfaces</span>
		${subPhaseLabel}
		<span class="meta" style="margin-left:auto;">Goal alignment: ${doc.goal_alignment_score !== null && doc.goal_alignment_score !== undefined ? Math.round(doc.goal_alignment_score * 100) + '%' : 'N/A'}</span>
	</div>

	<div class="tab-bar">
		<button class="tab-btn active" data-tab="capabilities">Capabilities</button>
		<button class="tab-btn" data-tab="components">Components</button>
		<button class="tab-btn" data-tab="data-models">Data Models</button>
		<button class="tab-btn" data-tab="interfaces">Interfaces</button>
		<button class="tab-btn" data-tab="impl-sequence">Impl Sequence</button>
		<button class="tab-btn" data-tab="crosswalk">Crosswalk</button>
		<button class="tab-btn" data-tab="validation">Validation</button>
	</div>

	<div class="tab-content active" id="tab-capabilities">${capabilitiesHtml}</div>
	<div class="tab-content" id="tab-components">${componentsHtml}</div>
	<div class="tab-content" id="tab-data-models">${dataModelsHtml}</div>
	<div class="tab-content" id="tab-interfaces">${interfacesHtml}</div>
	<div class="tab-content" id="tab-impl-sequence">${implSequenceHtml}</div>
	<div class="tab-content" id="tab-crosswalk">${crosswalkHtml}</div>
	<div class="tab-content" id="tab-validation">
		${validationHtml}
		${generalConcernsHtml}
	</div>

	<script>
		(function() {
			const vscode = acquireVsCodeApi();

			// Tab switching — preserve active tab across refreshes
			let activeTab = 'capabilities';
			document.querySelectorAll('.tab-btn').forEach(btn => {
				btn.addEventListener('click', () => {
					document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
					document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
					btn.classList.add('active');
					activeTab = btn.dataset.tab || 'capabilities';
					const tabEl = document.getElementById('tab-' + activeTab);
					if (tabEl) { tabEl.classList.add('active'); }
				});
			});

			// Tree node expand/collapse
			document.addEventListener('click', e => {
				const target = e.target;
				if (target.classList && target.classList.contains('tree-chevron') && target.dataset.toggle) {
					const childrenEl = document.getElementById('children-' + target.dataset.toggle);
					if (childrenEl) {
						childrenEl.classList.toggle('collapsed');
						target.classList.toggle('expanded');
					}
				}
			});

			// Handle live progress updates from extension host. We never use
			// innerHTML with the message payload — sub-phase strings come from
			// workflow state that may be influenced by user input/LLM output and
			// must be treated as untrusted text. Build DOM nodes and assign via
			// textContent to neutralize any HTML/script content.
			function setIndicator(indicator, subPhase) {
				indicator.textContent = '';
				const spinner = document.createElement('span');
				spinner.className = 'progress-spinner';
				indicator.appendChild(spinner);
				indicator.appendChild(document.createTextNode(' ' + String(subPhase)));
			}
			window.addEventListener('message', event => {
				const msg = event.data;
				if (msg.type === 'architectureProgress') {
					let indicator = document.getElementById('progress-indicator');
					if (!indicator) {
						const header = document.querySelector('.explorer-header');
						if (!header) { return; }
						indicator = document.createElement('span');
						indicator.id = 'progress-indicator';
						indicator.className = 'progress-indicator';
						header.appendChild(indicator);
					}
					setIndicator(indicator, msg.data.subPhase);
				}
			});
		})();
	</script>
</body>
</html>`;
	}

	// ── CLEANUP ──

	private _cleanup(): void {
		this._disposed = true;
		if (this._refreshTimer) {
			clearTimeout(this._refreshTimer);
			this._refreshTimer = null;
		}
		for (const unsub of this._eventUnsubscribers) { unsub(); }
		this._eventUnsubscribers = [];
		instance = undefined;
	}
}

/**
 * Predicate: should the explorer refresh in response to a workflow:command event?
 * Architecture-related commands include:
 *   - completion of architecture phase commands ("Architect — ...", action 'complete')
 *   - per-pass output of the Recursive Decomposition local planner (action 'output')
 * Exported so the subscription filter can be tested without spinning up a webview.
 */
export function shouldRefreshOnCommand(label: string, action: string): boolean {
	const isArchLabel = label.includes('Architect')
		|| label.includes('ARCHITECTURE')
		|| label.includes('Recursive Decomposition');
	if (!isArchLabel) { return false; }
	return action === 'complete' || action === 'output';
}

// ── HELPERS ──

function loadReviewConcerns(dialogueId: string): string[] {
	try {
		const database = getDatabase();
		if (!database) { return []; }
		const rows = database.prepare(`
			SELECT wco.content
			FROM workflow_command_outputs wco
			JOIN workflow_commands wc ON wc.command_id = wco.command_id
			WHERE wc.dialogue_id = ?
			  AND wco.line_type = 'reasoning_review'
			  AND (wc.label LIKE '%Architect%' OR wc.label LIKE '%ARCHITECTURE%')
			ORDER BY wc.started_at DESC
		`).all(dialogueId) as Array<{ content: string }>;
		return rows.map(r => r.content);
	} catch {
		return [];
	}
}

function escapeHtml(s: string): string {
	return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function getErrorHtml(message: string): string {
	return `<!DOCTYPE html>
<html><body style="font-family:sans-serif;padding:20px;color:var(--vscode-foreground);background:var(--vscode-editor-background);">
	<h2>Architecture Explorer</h2>
	<p>${message}</p>
	<p style="opacity:0.6;font-size:12px;">This view will refresh automatically when architecture data becomes available.</p>
</body></html>`;
}
