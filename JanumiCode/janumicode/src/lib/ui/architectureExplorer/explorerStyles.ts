/**
 * CSS styles for the Architecture Explorer webview panel.
 */
export function getExplorerStyles(): string {
	return `
		:root {
			--node-indent: 24px;
			--badge-bg: rgba(255, 255, 255, 0.08);
			--concern-high: #f44336;
			--concern-medium: #ff9800;
			--concern-low: #4caf50;
		}

		body {
			font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
			font-size: 13px;
			color: var(--vscode-foreground);
			background: var(--vscode-editor-background);
			margin: 0;
			padding: 0;
			line-height: 1.5;
		}

		.explorer-header {
			position: sticky;
			top: 0;
			z-index: 10;
			background: var(--vscode-editor-background);
			border-bottom: 1px solid var(--vscode-widget-border);
			padding: 8px 16px;
			display: flex;
			align-items: center;
			gap: 12px;
		}
		.explorer-header h1 {
			font-size: 14px;
			font-weight: 600;
			margin: 0;
		}
		.explorer-header .meta {
			font-size: 12px;
			opacity: 0.7;
		}

		/* Progress indicator */
		.progress-indicator {
			display: inline-flex;
			align-items: center;
			gap: 6px;
			padding: 2px 10px;
			border-radius: 3px;
			background: rgba(255, 152, 0, 0.12);
			color: var(--vscode-charts-orange);
			font-size: 12px;
			font-weight: 600;
			animation: progressFadeIn 0.3s ease;
		}
		@keyframes progressFadeIn {
			from { opacity: 0; } to { opacity: 1; }
		}
		.progress-spinner {
			display: inline-block;
			width: 12px;
			height: 12px;
			border: 2px solid rgba(255, 152, 0, 0.3);
			border-top-color: var(--vscode-charts-orange);
			border-radius: 50%;
			animation: progressSpin 0.8s linear infinite;
		}
		@keyframes progressSpin {
			to { transform: rotate(360deg); }
		}

		.tab-bar {
			display: flex;
			gap: 0;
			border-bottom: 1px solid var(--vscode-widget-border);
			background: var(--vscode-sideBar-background, var(--vscode-editor-background));
			padding: 0 16px;
		}
		.tab-btn {
			padding: 8px 16px;
			background: none;
			border: none;
			border-bottom: 2px solid transparent;
			color: var(--vscode-foreground);
			opacity: 0.7;
			cursor: pointer;
			font-size: 13px;
		}
		.tab-btn:hover { opacity: 1; }
		.tab-btn.active {
			opacity: 1;
			border-bottom-color: var(--vscode-textLink-foreground);
			font-weight: 600;
		}

		.tab-content {
			display: none;
			padding: 12px 16px;
		}
		.tab-content.active { display: block; }

		/* Tree nodes */
		.tree-node {
			margin: 0;
			padding: 0;
		}
		.tree-node-header {
			display: flex;
			align-items: flex-start;
			gap: 6px;
			padding: 4px 0;
			cursor: pointer;
			border-radius: 3px;
		}
		.tree-node-header:hover {
			background: var(--vscode-list-hoverBackground);
		}
		.tree-node-header.selected {
			background: var(--vscode-list-activeSelectionBackground);
			color: var(--vscode-list-activeSelectionForeground);
		}
		.tree-chevron {
			width: 16px;
			flex-shrink: 0;
			text-align: center;
			font-size: 10px;
			line-height: 20px;
			opacity: 0.6;
			transition: transform 0.15s;
		}
		.tree-chevron.expanded { transform: rotate(90deg); }
		.tree-node-id {
			font-family: var(--vscode-editor-font-family, monospace);
			font-size: 11px;
			opacity: 0.5;
			flex-shrink: 0;
			min-width: 120px;
		}
		.tree-node-label {
			font-weight: 600;
			flex-shrink: 0;
		}
		.tree-node-meta {
			font-size: 12px;
			opacity: 0.7;
			flex: 1;
		}
		.tree-children {
			margin-left: var(--node-indent);
			border-left: 1px solid var(--vscode-widget-border);
			padding-left: 4px;
		}
		.tree-children.collapsed { display: none; }

		/* Detail panel (below node when expanded) */
		.tree-node-detail {
			margin-left: calc(var(--node-indent) + 16px);
			padding: 4px 8px 8px;
			font-size: 12px;
			opacity: 0.85;
		}
		.tree-node-detail .detail-row {
			margin: 2px 0;
		}
		.tree-node-detail .detail-label {
			font-weight: 600;
			opacity: 0.7;
			margin-right: 4px;
		}

		/* Badges */
		.badge {
			display: inline-block;
			padding: 1px 6px;
			border-radius: 3px;
			font-size: 11px;
			background: var(--badge-bg);
			margin: 0 2px;
		}
		.badge-workflow { color: var(--vscode-textLink-foreground); }
		.badge-req { color: var(--vscode-charts-green); }
		.badge-dep { color: var(--vscode-charts-orange); }
		.badge-component { color: var(--vscode-charts-blue); }

		/* Concerns overlay */
		.concern-badge {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			padding: 2px 8px;
			border-radius: 3px;
			font-size: 11px;
			font-weight: 600;
			margin: 2px 0;
		}
		.concern-badge.HIGH { background: rgba(244, 67, 54, 0.15); color: var(--concern-high); }
		.concern-badge.MEDIUM { background: rgba(255, 152, 0, 0.15); color: var(--concern-medium); }
		.concern-badge.LOW { background: rgba(76, 175, 80, 0.15); color: var(--concern-low); }

		/* Validation findings */
		.validation-finding {
			padding: 4px 8px;
			margin: 2px 0;
			border-left: 3px solid var(--concern-medium);
			background: rgba(255, 152, 0, 0.05);
			font-size: 12px;
		}

		/* Data model cards */
		.data-model-card {
			border: 1px solid var(--vscode-widget-border);
			border-radius: 4px;
			margin: 8px 0;
			padding: 8px 12px;
		}
		.data-model-card h3 {
			margin: 0 0 4px;
			font-size: 13px;
		}
		.data-model-fields {
			font-family: var(--vscode-editor-font-family, monospace);
			font-size: 12px;
		}
		.data-model-fields .field-row {
			padding: 1px 0;
		}
		.field-required { font-weight: 600; }
		.field-optional { opacity: 0.7; }
		.data-model-relationships {
			margin-top: 4px;
			font-size: 12px;
		}
		.relationship-arrow {
			color: var(--vscode-textLink-foreground);
		}

		/* Implementation timeline */
		.impl-step {
			display: flex;
			align-items: flex-start;
			gap: 8px;
			padding: 6px 0;
			border-bottom: 1px solid var(--vscode-widget-border);
		}
		.impl-step-order {
			width: 24px;
			height: 24px;
			border-radius: 50%;
			background: var(--vscode-textLink-foreground);
			color: var(--vscode-editor-background);
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 11px;
			font-weight: 700;
			flex-shrink: 0;
		}
		.impl-step-body { flex: 1; }
		.impl-step-label { font-weight: 600; }
		.impl-step-desc { font-size: 12px; opacity: 0.8; }
		.complexity-badge {
			padding: 1px 6px;
			border-radius: 3px;
			font-size: 10px;
			font-weight: 600;
		}
		.complexity-LOW { background: rgba(76, 175, 80, 0.15); color: var(--concern-low); }
		.complexity-MEDIUM { background: rgba(255, 152, 0, 0.15); color: var(--concern-medium); }
		.complexity-HIGH { background: rgba(244, 67, 54, 0.15); color: var(--concern-high); }

		/* Crosswalk / traceability */
		.crosswalk-table {
			width: 100%;
			border-collapse: collapse;
			font-size: 12px;
		}
		.crosswalk-table th, .crosswalk-table td {
			padding: 4px 8px;
			border: 1px solid var(--vscode-widget-border);
			text-align: left;
		}
		.crosswalk-table th {
			background: var(--vscode-sideBar-background, var(--badge-bg));
			font-weight: 600;
		}

		/* Decomposition depth breadcrumb */
		.decomposition-breadcrumb {
			margin-bottom: 12px;
			padding: 8px 12px;
			background: var(--vscode-sideBar-background, rgba(255,255,255,0.03));
			border: 1px solid var(--vscode-widget-border);
			border-radius: 4px;
		}
		.breadcrumb-label {
			font-size: 11px;
			font-weight: 600;
			opacity: 0.6;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			margin-bottom: 4px;
		}
		.breadcrumb-stages {
			display: flex;
			align-items: center;
			gap: 4px;
			flex-wrap: wrap;
		}
		.breadcrumb-stage {
			padding: 3px 10px;
			border-radius: 3px;
			font-size: 12px;
		}
		.breadcrumb-stage.stage-complete {
			color: var(--vscode-charts-green);
			opacity: 0.7;
		}
		.breadcrumb-stage.stage-current {
			background: var(--vscode-textLink-foreground);
			color: var(--vscode-editor-background);
			font-weight: 600;
		}
		.breadcrumb-stage.stage-pending {
			opacity: 0.4;
		}
		.breadcrumb-arrow {
			opacity: 0.4;
			font-size: 11px;
		}

		/* Stopping criteria inline */
		.stopping-criteria {
			margin: 2px 0 4px calc(var(--node-indent) + 16px);
			font-size: 12px;
		}

		/* Summary stats bar */
		.stats-bar {
			display: flex;
			gap: 16px;
			padding: 8px 0;
			font-size: 12px;
			opacity: 0.8;
		}
		.stat-item strong { margin-right: 4px; }
	`;
}
