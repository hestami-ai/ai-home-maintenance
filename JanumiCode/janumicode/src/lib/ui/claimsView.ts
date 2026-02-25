/**
 * Claims Tracker Webview Provider
 * Implements Phase 8.3: Claims display with status, verdicts, and filtering
 * Shows all claims with criticality grouping and status tracking
 */

import * as vscode from 'vscode';
import type { Claim, Verdict } from '../types';
import { getDatabase } from '../database';
import { getLogger, isLoggerInitialized } from '../logging';

/**
 * Claims View Provider
 * Provides the claims tracker webview
 */
export class ClaimsViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'janumicode.claimsView';

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
				case 'selectClaim':
					this._handleClaimSelection(data.claimId);
					break;
				case 'filterStatus':
					this._filterByStatus(data.status);
					break;
			}
		});
	}

	/**
	 * Refresh the claims view
	 */
	public refresh() {
		if (this._view) {
			this._view.webview.postMessage({ type: 'refresh' });
			this._updateContent();
		}
	}

	/**
	 * Update content with latest claims data
	 */
	private _updateContent() {
		if (!this._view) {
			return;
		}

		const claimsData = this._getClaimsData();
		this._view.webview.postMessage({
			type: 'update',
			data: claimsData,
		});
	}

	/**
	 * Get claims data from database
	 */
	private _getClaimsData() {
		const db = getDatabase();
		if (!db) {
			return { claims: [], verdicts: [] };
		}

		// Get all claims
		const claims = db
			.prepare(
				`
			SELECT claim_id, statement, introduced_by, criticality,
			       status, dialogue_id, turn_id, created_at
			FROM claims
			ORDER BY created_at DESC
		`
			)
			.all() as Claim[];

		// Get verdicts for these claims
		const verdicts = db
			.prepare(
				`
			SELECT verdict_id, claim_id, verdict, constraints_ref,
			       evidence_ref, rationale, timestamp
			FROM verdicts
		`
			)
			.all() as Verdict[];

		return { claims, verdicts };
	}

	/**
	 * Handle claim selection
	 */
	private _handleClaimSelection(claimId: string) {
		// Show claim details
		vscode.window.showInformationMessage(`Selected claim: ${claimId}`);
	}

	/**
	 * Filter claims by status
	 */
	private _filterByStatus(status: string) {
		// Implement filtering logic
		if (isLoggerInitialized()) {
			getLogger().child({ component: 'ui:claims' }).debug('Filtering by status', { status });
		}
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
			<title>JanumiCode Claims</title>
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

				.filter-group {
					display: flex;
					gap: 5px;
					margin-bottom: 15px;
				}

				.filter-btn {
					background: var(--vscode-button-secondaryBackground);
					color: var(--vscode-button-secondaryForeground);
					border: none;
					padding: 4px 10px;
					border-radius: 2px;
					cursor: pointer;
					font-size: 11px;
				}

				.filter-btn.active {
					background: var(--vscode-button-background);
					color: var(--vscode-button-foreground);
				}

				.claims-section {
					margin-bottom: 20px;
				}

				.section-header {
					font-weight: 600;
					font-size: 13px;
					margin-bottom: 10px;
					padding: 5px 0;
					border-bottom: 1px solid var(--vscode-panel-border);
				}

				.claim {
					margin-bottom: 10px;
					padding: 10px;
					background: var(--vscode-editor-background);
					border-left: 3px solid var(--vscode-panel-border);
					border-radius: 2px;
					cursor: pointer;
				}

				.claim:hover {
					background: var(--vscode-list-hoverBackground);
				}

				.claim.critical {
					border-left-color: #F44336;
				}

				.claim.non-critical {
					border-left-color: #2196F3;
				}

				.claim-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: 6px;
				}

				.status-badge {
					display: inline-block;
					padding: 2px 8px;
					border-radius: 3px;
					font-size: 10px;
					font-weight: 600;
					text-transform: uppercase;
				}

				.status-badge.open {
					background: #9E9E9E33;
					color: #9E9E9E;
				}

				.status-badge.verified {
					background: #4CAF5033;
					color: #4CAF50;
				}

				.status-badge.conditional {
					background: #FF980033;
					color: #FF9800;
				}

				.status-badge.disproved {
					background: #F4433633;
					color: #F44336;
				}

				.status-badge.unknown {
					background: #9C27B033;
					color: #9C27B0;
				}

				.criticality-badge {
					display: inline-block;
					padding: 2px 8px;
					border-radius: 3px;
					font-size: 10px;
					font-weight: 600;
					text-transform: uppercase;
					margin-left: 6px;
				}

				.criticality-badge.critical {
					background: #F4433633;
					color: #F44336;
				}

				.criticality-badge.non-critical {
					background: #2196F333;
					color: #2196F3;
				}

				.claim-statement {
					margin-top: 6px;
					line-height: 1.4;
					font-size: 13px;
				}

				.claim-meta {
					margin-top: 6px;
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

				.stats {
					display: flex;
					gap: 15px;
					margin-bottom: 15px;
					padding: 10px;
					background: var(--vscode-editor-background);
					border-radius: 2px;
					font-size: 12px;
				}

				.stat-item {
					display: flex;
					flex-direction: column;
				}

				.stat-label {
					color: var(--vscode-descriptionForeground);
					font-size: 10px;
					text-transform: uppercase;
				}

				.stat-value {
					font-weight: 600;
					font-size: 16px;
					margin-top: 2px;
				}
			</style>
		</head>
		<body>
			<div class="header">
				<h2>Claims Tracker</h2>
			</div>

			<div id="stats-container"></div>

			<div class="filter-group">
				<button class="filter-btn active" onclick="filterByStatus('all')">All</button>
				<button class="filter-btn" onclick="filterByStatus('OPEN')">Open</button>
				<button class="filter-btn" onclick="filterByStatus('VERIFIED')">Verified</button>
				<button class="filter-btn" onclick="filterByStatus('DISPROVED')">Disproved</button>
				<button class="filter-btn" onclick="filterByStatus('UNKNOWN')">Unknown</button>
			</div>

			<div id="claims-container">
				<div class="empty-state">
					<div class="empty-state-icon">📋</div>
					<p>No claims yet</p>
					<p style="font-size: 12px;">Claims will appear here as they are created</p>
				</div>
			</div>

			<script>
				const vscode = acquireVsCodeApi();
				let allClaims = [];
				let currentFilter = 'all';

				function filterByStatus(status) {
					currentFilter = status;

					// Update filter buttons
					document.querySelectorAll('.filter-btn').forEach(btn => {
						btn.classList.remove('active');
					});
					event.target.classList.add('active');

					// Re-render with filter
					renderClaims(allClaims);
				}

				function selectClaim(claimId) {
					vscode.postMessage({ type: 'selectClaim', claimId });
				}

				function getCriticalityClass(criticality) {
					return criticality.toLowerCase().replace('_', '-');
				}

				function getStatusClass(status) {
					return status.toLowerCase();
				}

				function renderStats(claims) {
					const stats = {
						total: claims.length,
						critical: claims.filter(c => c.criticality === 'CRITICAL').length,
						open: claims.filter(c => c.status === 'OPEN').length,
						verified: claims.filter(c => c.status === 'VERIFIED').length,
					};

					document.getElementById('stats-container').innerHTML = \`
						<div class="stats">
							<div class="stat-item">
								<span class="stat-label">Total</span>
								<span class="stat-value">\${stats.total}</span>
							</div>
							<div class="stat-item">
								<span class="stat-label">Critical</span>
								<span class="stat-value">\${stats.critical}</span>
							</div>
							<div class="stat-item">
								<span class="stat-label">Open</span>
								<span class="stat-value">\${stats.open}</span>
							</div>
							<div class="stat-item">
								<span class="stat-label">Verified</span>
								<span class="stat-value">\${stats.verified}</span>
							</div>
						</div>
					\`;
				}

				function renderClaims(claims) {
					allClaims = claims;
					const container = document.getElementById('claims-container');

					// Filter claims
					let filteredClaims = claims;
					if (currentFilter !== 'all') {
						filteredClaims = claims.filter(c => c.status === currentFilter);
					}

					if (filteredClaims.length === 0) {
						container.innerHTML = \`
							<div class="empty-state">
								<div class="empty-state-icon">📋</div>
								<p>No claims found</p>
							</div>
						\`;
						return;
					}

					// Group by criticality
					const critical = filteredClaims.filter(c => c.criticality === 'CRITICAL');
					const nonCritical = filteredClaims.filter(c => c.criticality === 'NON_CRITICAL');

					let html = '';

					if (critical.length > 0) {
						html += '<div class="claims-section">';
						html += '<div class="section-header">Critical Claims</div>';
						html += critical.map(claim => \`
							<div class="claim critical" onclick="selectClaim('\${claim.claim_id}')">
								<div class="claim-header">
									<div>
										<span class="status-badge \${getStatusClass(claim.status)}">\${claim.status}</span>
										<span class="criticality-badge critical">CRITICAL</span>
									</div>
								</div>
								<div class="claim-statement">\${claim.statement}</div>
								<div class="claim-meta">
									Introduced by \${claim.introduced_by} • Turn #\${claim.turn_id}
								</div>
							</div>
						\`).join('');
						html += '</div>';
					}

					if (nonCritical.length > 0) {
						html += '<div class="claims-section">';
						html += '<div class="section-header">Non-Critical Claims</div>';
						html += nonCritical.map(claim => \`
							<div class="claim non-critical" onclick="selectClaim('\${claim.claim_id}')">
								<div class="claim-header">
									<div>
										<span class="status-badge \${getStatusClass(claim.status)}">\${claim.status}</span>
									</div>
								</div>
								<div class="claim-statement">\${claim.statement}</div>
								<div class="claim-meta">
									Introduced by \${claim.introduced_by} • Turn #\${claim.turn_id}
								</div>
							</div>
						\`).join('');
						html += '</div>';
					}

					container.innerHTML = html;
					renderStats(claims);
				}

				// Listen for messages from extension
				window.addEventListener('message', event => {
					const message = event.data;
					switch (message.type) {
						case 'update':
							renderClaims(message.data.claims);
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
