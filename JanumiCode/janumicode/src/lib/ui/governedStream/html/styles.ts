/**
 * CSS Styles for Governed Stream Webview
 * Uses VS Code CSS variables for theme compatibility.
 * Role colors use vscode-charts-* variables per the design spec.
 */

export function getStyles(): string {
	return `
		/* ===== RESET & BASE ===== */
		*,
		*::before,
		*::after {
			box-sizing: border-box;
			margin: 0;
			padding: 0;
		}

		html, body {
			height: 100%;
			overflow: hidden;
			color: var(--vscode-foreground);
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			background: var(--vscode-sideBar-background);
		}

		/* ===== LAYOUT: 3-zone grid ===== */
		.governed-stream-container {
			display: flex;
			flex-direction: column;
			height: 100vh;
			position: relative;
		}

		/* ===== RESIZABLE CARDS ===== */
		/* Applied directly via .resizable-card on the card's own element */

		/* ===== ZONE 1: STICKY HEADER ===== */
		.sticky-header {
			position: sticky;
			top: 0;
			z-index: 100;
			background: var(--vscode-sideBar-background);
			border-bottom: 1px solid var(--vscode-widget-border);
			padding: 10px 16px;
			flex-shrink: 0;
		}

		.header-top-row {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 8px;
		}

		.header-title {
			font-size: 15px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			color: var(--vscode-descriptionForeground);
		}

		.session-id {
			font-size: 13px;
			color: var(--vscode-descriptionForeground);
			cursor: pointer;
			padding: 2px 6px;
			border-radius: 3px;
			font-family: var(--vscode-editor-font-family);
		}

		.session-id:hover {
			background: var(--vscode-list-hoverBackground);
		}

		/* Phase Stepper */
		.phase-stepper {
			display: flex;
			align-items: center;
			gap: 2px;
			margin-bottom: 8px;
			overflow-x: auto;
			scrollbar-width: thin;
		}

		.phase-step {
			display: flex;
			align-items: center;
			gap: 2px;
			flex-shrink: 0;
		}

		.phase-dot {
			width: 8px;
			height: 8px;
			border-radius: 50%;
			background: var(--vscode-widget-border);
			transition: all 0.2s ease;
		}

		.phase-dot.completed {
			background: var(--vscode-charts-green);
		}

		.phase-dot.current {
			background: var(--vscode-charts-blue);
			box-shadow: 0 0 0 2px var(--vscode-editor-background), 0 0 0 4px var(--vscode-charts-blue);
		}

		.phase-dot.pending {
			background: var(--vscode-widget-border);
		}

		.phase-label {
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
			text-transform: uppercase;
			letter-spacing: 0.3px;
			white-space: nowrap;
		}

		.phase-label.current {
			color: var(--vscode-charts-blue);
			font-weight: 600;
		}

		.phase-label.completed {
			color: var(--vscode-charts-green);
		}

		.phase-connector {
			width: 12px;
			height: 1px;
			background: var(--vscode-widget-border);
			flex-shrink: 0;
		}

		.phase-connector.completed {
			background: var(--vscode-charts-green);
		}

		/* Claim Health Bar */
		.claim-health-bar {
			display: flex;
			gap: 12px;
			align-items: center;
			flex-wrap: wrap;
		}

		.health-item {
			display: flex;
			align-items: center;
			gap: 4px;
			font-size: 13px;
			cursor: pointer;
		}

		.health-item:hover {
			opacity: 0.8;
		}

		.health-dot {
			width: 6px;
			height: 6px;
			border-radius: 50%;
		}

		.health-dot.verified { background: var(--vscode-charts-green); }
		.health-dot.unknown { background: var(--vscode-charts-yellow); }
		.health-dot.disproved { background: var(--vscode-charts-red); }
		.health-dot.open { background: var(--vscode-charts-blue); }
		.health-dot.conditional { background: var(--vscode-charts-orange, #ff9800); }

		.health-count {
			font-weight: 600;
			font-family: var(--vscode-editor-font-family);
		}

		.health-label {
			color: var(--vscode-descriptionForeground);
		}

		/* ── Sub-Phase Progress Diagram ── */
		.subphase-progress-row {
			min-height: 20px;
		}
		.subphase-diagram {
			display: flex;
			align-items: center;
			gap: 0;
			overflow-x: auto;
			padding: 2px 0;
		}
		.subphase-step {
			display: flex;
			align-items: center;
			gap: 3px;
			white-space: nowrap;
			padding: 2px 4px;
			border-radius: 3px;
			font-size: 11px;
			position: relative;
		}
		.subphase-icon {
			font-size: 10px;
			line-height: 1;
		}
		.subphase-label {
			color: var(--vscode-descriptionForeground);
		}
		.subphase-step.completed .subphase-icon {
			color: var(--vscode-charts-green, #89d185);
		}
		.subphase-step.completed .subphase-label {
			color: var(--vscode-charts-green, #89d185);
			opacity: 0.8;
		}
		.subphase-step.active {
			background: color-mix(in srgb, var(--vscode-focusBorder) 15%, transparent);
		}
		.subphase-step.active .subphase-icon {
			color: var(--vscode-focusBorder);
			animation: pulse-icon 1.5s ease-in-out infinite;
		}
		.subphase-step.active .subphase-label {
			color: var(--vscode-foreground);
			font-weight: 600;
		}
		.subphase-step.retry {
			background: color-mix(in srgb, var(--vscode-charts-orange, #ff9800) 12%, transparent);
		}
		.subphase-step.retry .subphase-icon {
			color: var(--vscode-charts-orange, #ff9800);
		}
		.subphase-step.retry .subphase-label {
			color: var(--vscode-charts-orange, #ff9800);
			font-weight: 600;
		}
		.subphase-step.pending .subphase-icon {
			color: var(--vscode-descriptionForeground);
			opacity: 0.4;
		}
		.subphase-step.pending .subphase-label {
			opacity: 0.4;
		}
		.subphase-retry-badge {
			font-size: 9px;
			font-weight: 700;
			color: var(--vscode-charts-orange, #ff9800);
			background: color-mix(in srgb, var(--vscode-charts-orange, #ff9800) 15%, transparent);
			padding: 0 3px;
			border-radius: 3px;
			line-height: 14px;
		}
		.subphase-connector {
			width: 12px;
			height: 1px;
			background: var(--vscode-descriptionForeground);
			opacity: 0.3;
			flex-shrink: 0;
		}
		.subphase-connector.retry {
			background: var(--vscode-charts-orange, #ff9800);
			opacity: 0.6;
			height: 2px;
		}
		@keyframes pulse-icon {
			0%, 100% { opacity: 1; }
			50% { opacity: 0.4; }
		}
		/* Task graph sub-phase progress bar */
		.subphase-task-progress {
			display: flex;
			align-items: center;
			gap: 8px;
		}
		.subphase-task-bar {
			flex: 1;
			height: 4px;
			background: color-mix(in srgb, var(--vscode-descriptionForeground) 20%, transparent);
			border-radius: 2px;
			overflow: hidden;
		}
		.subphase-task-fill {
			height: 100%;
			background: var(--vscode-charts-green, #89d185);
			border-radius: 2px;
			transition: width 0.3s ease;
		}
		.subphase-task-label {
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
			white-space: nowrap;
		}
		.subphase-task-failed { color: var(--vscode-charts-red, #f14c4c); }
		.subphase-task-active { color: var(--vscode-charts-blue, #3794ff); }

		/* ===== ZONE 2: GOVERNED STREAM ===== */
		.stream-area {
			flex: 1;
			overflow-y: auto;
			padding: 12px 16px;
			scroll-behavior: smooth;
		}

		/* Phase Milestone Divider */
		.milestone-divider {
			display: flex;
			align-items: center;
			gap: 12px;
			margin: 16px 0;
			user-select: none;
		}

		.milestone-line {
			flex: 1;
			height: 1px;
			background: var(--vscode-widget-border);
		}

		.milestone-label {
			font-size: 13px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			color: var(--vscode-descriptionForeground);
			white-space: nowrap;
			padding: 3px 10px;
			border-radius: 10px;
			background: var(--vscode-welcomePage-tileBackground, var(--vscode-editor-background));
			border: 1px solid var(--vscode-widget-border);
		}

		.milestone-timestamp {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			font-family: var(--vscode-editor-font-family);
		}

		/* ===== DIALOGUE BOUNDARY MARKERS ===== */
		.dialogue-start-marker {
			margin: 20px 0 12px;
			user-select: none;
		}

		.dialogue-marker-line {
			height: 2px;
			background: linear-gradient(to right, transparent, var(--vscode-charts-blue), transparent);
			margin: 4px 0;
		}

		.dialogue-marker-content {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 6px 0;
		}

		.dialogue-marker-icon {
			font-size: 16px;
		}

		.dialogue-marker-label {
			font-size: 13px;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			color: var(--vscode-charts-blue);
		}

		.dialogue-marker-id {
			font-size: 12px;
			font-family: var(--vscode-editor-font-family);
			color: var(--vscode-descriptionForeground);
			padding: 1px 6px;
			background: var(--vscode-badge-background);
			color: var(--vscode-badge-foreground);
			border-radius: 3px;
		}

		.dialogue-marker-time {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			font-family: var(--vscode-editor-font-family);
			margin-left: auto;
		}

		.dialogue-marker-goal {
			padding: 6px 10px;
			font-size: 14px;
			line-height: 1.5;
			color: var(--vscode-foreground);
			background: color-mix(in srgb, var(--vscode-charts-blue) 6%, var(--vscode-editor-background));
			border-radius: 4px;
			border-left: 3px solid var(--vscode-charts-blue);
		}

		.dialogue-end-marker {
			display: flex;
			align-items: center;
			gap: 10px;
			margin: 12px 0 20px;
			user-select: none;
		}

		.dialogue-end-line {
			flex: 1;
			height: 1px;
			background: var(--vscode-widget-border);
		}

		.dialogue-end-badge {
			font-size: 12px;
			font-weight: 600;
			padding: 2px 10px;
			border-radius: 10px;
			white-space: nowrap;
		}

		.dialogue-end-marker.completed .dialogue-end-badge {
			background: color-mix(in srgb, var(--vscode-charts-green) 15%, transparent);
			color: var(--vscode-charts-green);
		}

		.dialogue-end-marker.abandoned .dialogue-end-badge {
			background: color-mix(in srgb, var(--vscode-descriptionForeground) 15%, transparent);
			color: var(--vscode-descriptionForeground);
		}

		.dialogue-end-time {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			font-family: var(--vscode-editor-font-family);
		}

		/* ===== RICH CARDS (Base) ===== */
		/* ===== GENERIC COLLAPSIBLE CARD PATTERN ===== */

		.collapsible-card-header {
			display: flex;
			align-items: center;
			gap: 6px;
			cursor: pointer;
			user-select: none;
			padding: 8px 10px;
			border-radius: 3px;
			margin: -8px -10px 0 -10px;
			transition: background 0.1s;
		}

		.collapsible-card-header:hover {
			background: var(--vscode-list-hoverBackground);
		}

		.card-chevron {
			font-size: 10px;
			width: 10px;
			text-align: center;
			flex-shrink: 0;
			color: var(--vscode-descriptionForeground);
			transition: transform 0.15s ease;
			opacity: 0.7;
		}

		.collapsible-card.expanded .card-chevron {
			transform: rotate(90deg);
		}

		.collapsible-card-body {
			display: none;
			padding-top: 8px;
		}

		.collapsible-card.expanded .collapsible-card-body {
			display: block;
		}

		/* ===== RICH CARD ===== */

		.rich-card {
			margin-bottom: 12px;
			padding: 12px;
			background: var(--vscode-welcomePage-tileBackground, var(--vscode-sideBar-background));
			border: 1px solid var(--vscode-widget-border);
			border-left: 3px solid var(--vscode-widget-border);
			border-radius: 4px;
			transition: border-color 0.15s ease;
		}

		.rich-card:hover {
			border-color: var(--vscode-focusBorder);
		}

		.card-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
		}

		.card-header-left {
			display: flex;
			align-items: center;
			gap: 8px;
		}

		.role-icon {
			font-size: 16px;
			width: 20px;
			text-align: center;
		}

		.role-badge {
			display: inline-block;
			padding: 2px 8px;
			border-radius: 3px;
			font-size: 12px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.3px;
		}

		.speech-act-tag {
			display: inline-block;
			padding: 1px 6px;
			border-radius: 2px;
			font-size: 11px;
			background: var(--vscode-badge-background);
			color: var(--vscode-badge-foreground);
		}

		.card-timestamp {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			font-family: var(--vscode-editor-font-family);
		}

		.card-content {
			margin-top: 8px;
			line-height: 1.6;
			word-wrap: break-word;
			white-space: pre-wrap;
		}

		.card-content code {
			font-family: var(--vscode-editor-font-family);
			background: var(--vscode-textCodeBlock-background);
			padding: 1px 4px;
			border-radius: 2px;
			font-size: 0.9em;
		}

		/* Markdown-rendered card content */
		.card-content-md {
			white-space: normal;
		}
		.card-content-md h1, .card-content-md h2, .card-content-md h3, .card-content-md h4 {
			margin: 12px 0 6px 0;
			color: var(--vscode-foreground);
			font-weight: 600;
		}
		.card-content-md h1 { font-size: 1.3em; }
		.card-content-md h2 { font-size: 1.15em; }
		.card-content-md h3 { font-size: 1.05em; }
		.card-content-md h4 { font-size: 1em; }
		.card-content-md p {
			margin: 4px 0;
		}
		.card-content-md ul {
			margin: 4px 0;
			padding-left: 20px;
		}
		.card-content-md li {
			margin: 2px 0;
		}
		.card-content-md pre {
			background: var(--vscode-textCodeBlock-background);
			padding: 8px 10px;
			border-radius: 4px;
			overflow-x: auto;
			margin: 6px 0;
			font-size: 0.88em;
		}
		.card-content-md pre code {
			background: none;
			padding: 0;
		}
		.card-content-md hr {
			border: none;
			border-top: 1px solid var(--vscode-editorWidget-border);
			margin: 10px 0;
		}

		/* Role Color Variants */
		.rich-card.role-human {
			border-left-color: var(--vscode-charts-blue);
		}
		.role-badge.role-human {
			background: color-mix(in srgb, var(--vscode-charts-blue) 20%, transparent);
			color: var(--vscode-charts-blue);
		}

		.rich-card.role-executor {
			border-left-color: var(--vscode-charts-green);
		}
		.role-badge.role-executor {
			background: color-mix(in srgb, var(--vscode-charts-green) 20%, transparent);
			color: var(--vscode-charts-green);
		}

		.rich-card.role-verifier {
			border-left-color: var(--vscode-charts-red);
		}
		.role-badge.role-verifier {
			background: color-mix(in srgb, var(--vscode-charts-red) 20%, transparent);
			color: var(--vscode-charts-red);
		}

		.rich-card.role-technical_expert {
			border-left-color: var(--vscode-charts-yellow);
		}
		.role-badge.role-technical_expert {
			background: color-mix(in srgb, var(--vscode-charts-yellow) 20%, transparent);
			color: var(--vscode-charts-yellow);
		}

		.rich-card.role-historian {
			border-left-color: var(--vscode-charts-purple);
		}
		.role-badge.role-historian {
			background: color-mix(in srgb, var(--vscode-charts-purple) 20%, transparent);
			color: var(--vscode-charts-purple);
		}

		.role-badge.role-architect {
			background: color-mix(in srgb, var(--vscode-charts-orange) 20%, transparent);
			color: var(--vscode-charts-orange);
		}

		/* ===== ARCHITECTURE PHASE GROUP ===== */
		.architecture-phase-group {
			border: 1px solid color-mix(in srgb, var(--vscode-charts-orange) 30%, var(--vscode-widget-border));
			border-radius: 8px;
			margin: 12px 0;
			padding: 0;
			background: color-mix(in srgb, var(--vscode-charts-orange) 3%, var(--vscode-editor-background));
			overflow: hidden;
		}
		.architecture-phase-group-header {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 10px 14px;
			background: color-mix(in srgb, var(--vscode-charts-orange) 8%, var(--vscode-editor-background));
			border-bottom: 1px solid color-mix(in srgb, var(--vscode-charts-orange) 20%, var(--vscode-widget-border));
			font-size: 13px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			color: var(--vscode-charts-orange);
		}
		.architecture-phase-group-header .codicon {
			font-size: 16px;
		}
		.architecture-phase-group .card {
			margin: 8px 10px;
			border-radius: 6px;
		}
		.architecture-phase-group .card:last-child {
			margin-bottom: 10px;
		}

		.architecture-card {
			padding: 12px;
			background: var(--vscode-welcomePage-tileBackground, var(--vscode-sideBar-background));
			border: 1px solid var(--vscode-widget-border);
			border-radius: 6px;
		}
		.architecture-card .card-header {
			margin-bottom: 10px;
		}
		.architecture-card .card-title {
			font-weight: 600;
			font-size: 14px;
		}
		.architecture-card .card-meta {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
		}
		.architecture-card .card-body {
			font-size: 13px;
			line-height: 1.5;
		}

		/* Architecture gate — human review card within the architecture family */
		.architecture-gate {
			border-left: 3px solid var(--vscode-charts-yellow);
		}
		.architecture-gate.gate-pending {
			background: color-mix(in srgb, var(--vscode-charts-yellow) 4%, var(--vscode-welcomePage-tileBackground, var(--vscode-sideBar-background)));
		}

		.architecture-table {
			width: 100%;
			border-collapse: collapse;
			font-size: 13px;
			margin-top: 6px;
		}
		.architecture-table th {
			text-align: left;
			padding: 4px 8px;
			border-bottom: 1px solid var(--vscode-widget-border);
			color: var(--vscode-descriptionForeground);
			font-weight: 600;
			font-size: 12px;
			text-transform: uppercase;
			letter-spacing: 0.3px;
		}
		.architecture-table td {
			padding: 4px 8px;
			border-bottom: 1px solid color-mix(in srgb, var(--vscode-widget-border) 50%, transparent);
		}
		.architecture-table .comp-parent-row td {
			padding: 8px 8px 4px;
			border-bottom: none;
			background: color-mix(in srgb, var(--vscode-charts-blue) 6%, transparent);
		}
		.architecture-table .comp-parent-row .comp-child-count {
			font-weight: normal;
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
		}
		.architecture-table .comp-child-row td {
			padding-left: 24px;
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
		}
		.architecture-table .comp-child-row td:first-child {
			padding-left: 24px;
		}

		/* ===== Enriched Architecture Design Card ===== */

		.arch-section-summary {
			font-weight: 600;
			font-size: 13px;
			cursor: pointer;
			padding: 6px 0;
			color: var(--vscode-foreground);
		}
		.arch-section-content {
			padding: 4px 0 8px;
		}
		.arch-empty {
			color: var(--vscode-descriptionForeground);
			font-style: italic;
			padding: 8px 0;
		}

		/* --- Component Cards --- */
		.arch-component-card {
			border: 1px solid var(--vscode-widget-border);
			border-radius: 5px;
			padding: 10px 12px;
			margin-bottom: 8px;
			background: color-mix(in srgb, var(--vscode-editor-background) 50%, var(--vscode-sideBar-background));
		}
		.arch-child-card {
			border-color: color-mix(in srgb, var(--vscode-widget-border) 60%, transparent);
			margin-left: 16px;
			margin-bottom: 6px;
			padding: 8px 10px;
		}
		.arch-comp-header {
			display: flex;
			align-items: baseline;
			gap: 8px;
			margin-bottom: 6px;
		}
		.arch-comp-id {
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
		}
		.arch-comp-label {
			font-size: 13px;
		}
		.arch-comp-body {
			font-size: 12px;
			line-height: 1.5;
		}
		.arch-comp-responsibility {
			margin-bottom: 4px;
			color: var(--vscode-foreground);
		}
		.arch-comp-rationale {
			margin-bottom: 4px;
			color: var(--vscode-descriptionForeground);
			font-style: italic;
		}
		.arch-rationale-label,
		.arch-detail-label {
			font-weight: 600;
			font-style: normal;
			color: var(--vscode-descriptionForeground);
			margin-right: 4px;
		}
		.arch-comp-badges {
			display: flex;
			flex-wrap: wrap;
			gap: 4px;
			margin: 4px 0;
		}
		.arch-badge {
			display: inline-block;
			font-size: 11px;
			padding: 1px 6px;
			border-radius: 3px;
			white-space: nowrap;
		}
		.arch-badge-workflow {
			background: color-mix(in srgb, var(--vscode-charts-blue) 15%, transparent);
			color: var(--vscode-charts-blue);
		}
		.arch-badge-dep {
			background: color-mix(in srgb, var(--vscode-charts-orange) 12%, transparent);
			color: var(--vscode-charts-orange);
		}
		.arch-badge-type {
			background: color-mix(in srgb, var(--vscode-charts-purple) 15%, transparent);
			color: var(--vscode-charts-purple);
		}
		.arch-comp-tech,
		.arch-comp-scope,
		.arch-comp-interactions {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			margin-top: 2px;
		}
		.arch-sub-components {
			margin-top: 6px;
		}
		.arch-sub-components summary {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			cursor: pointer;
		}
		.arch-children {
			margin-top: 4px;
		}

		/* --- Domain Model Cards --- */
		.arch-model-card {
			border: 1px solid var(--vscode-widget-border);
			border-radius: 5px;
			padding: 10px 12px;
			margin-bottom: 8px;
			background: color-mix(in srgb, var(--vscode-editor-background) 50%, var(--vscode-sideBar-background));
		}
		.arch-model-header {
			display: flex;
			align-items: baseline;
			gap: 8px;
			margin-bottom: 4px;
		}
		.arch-model-desc {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			margin-bottom: 6px;
		}
		.arch-fields-table {
			width: 100%;
			border-collapse: collapse;
			font-size: 12px;
			margin: 4px 0 6px;
		}
		.arch-fields-table th {
			text-align: left;
			padding: 3px 6px;
			border-bottom: 1px solid var(--vscode-widget-border);
			color: var(--vscode-descriptionForeground);
			font-weight: 600;
			font-size: 11px;
			text-transform: uppercase;
		}
		.arch-fields-table td {
			padding: 2px 6px;
			border-bottom: 1px solid color-mix(in srgb, var(--vscode-widget-border) 40%, transparent);
		}
		.arch-required {
			color: var(--vscode-charts-orange);
			font-size: 11px;
			font-weight: 500;
		}
		.arch-optional {
			color: var(--vscode-descriptionForeground);
			font-size: 11px;
		}
		.arch-relationships {
			margin: 6px 0;
		}
		.arch-relationship {
			display: flex;
			align-items: baseline;
			gap: 6px;
			font-size: 12px;
			padding: 2px 0;
		}
		.arch-rel-arrow {
			color: var(--vscode-charts-blue);
			font-weight: bold;
		}
		.arch-rel-type {
			color: var(--vscode-descriptionForeground);
			font-size: 11px;
		}
		.arch-rel-desc {
			color: var(--vscode-descriptionForeground);
			font-style: italic;
		}
		.arch-invariants {
			font-size: 12px;
			margin-top: 4px;
		}
		.arch-invariants ul {
			margin: 2px 0 0 16px;
			padding: 0;
		}
		.arch-invariants li {
			padding: 1px 0;
			color: var(--vscode-descriptionForeground);
		}

		/* --- Interface Cards --- */
		.arch-interface-card {
			border: 1px solid var(--vscode-widget-border);
			border-radius: 5px;
			padding: 10px 12px;
			margin-bottom: 8px;
			background: color-mix(in srgb, var(--vscode-editor-background) 50%, var(--vscode-sideBar-background));
		}
		.arch-iface-header {
			display: flex;
			align-items: baseline;
			gap: 8px;
			margin-bottom: 4px;
		}
		.arch-iface-desc {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			margin-bottom: 6px;
		}
		.arch-contract {
			margin: 4px 0 6px;
		}
		.arch-contract pre {
			background: var(--vscode-textCodeBlock-background);
			border: 1px solid var(--vscode-widget-border);
			border-radius: 4px;
			padding: 8px 10px;
			font-size: 12px;
			line-height: 1.4;
			overflow-x: auto;
			white-space: pre-wrap;
			word-break: break-word;
			margin: 0;
		}
		.arch-iface-endpoints {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			margin: 4px 0;
		}
		.arch-iface-workflows {
			display: flex;
			flex-wrap: wrap;
			gap: 4px;
			margin-top: 4px;
		}

		/* --- Implementation Roadmap --- */
		.arch-roadmap-step {
			border-left: 2px solid var(--vscode-widget-border);
			padding: 6px 0 6px 12px;
			margin-bottom: 4px;
		}
		.arch-step-header {
			display: flex;
			align-items: baseline;
			gap: 8px;
			margin-bottom: 4px;
		}
		.arch-step-desc {
			font-size: 12px;
			color: var(--vscode-foreground);
			margin-bottom: 4px;
		}
		.arch-step-meta {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
		}
		.arch-step-meta > div {
			margin-top: 2px;
		}
		.arch-complexity-high {
			background: color-mix(in srgb, var(--vscode-errorForeground) 15%, transparent);
			color: var(--vscode-errorForeground);
		}
		.arch-complexity-medium {
			background: color-mix(in srgb, var(--vscode-charts-yellow) 15%, transparent);
			color: var(--vscode-charts-yellow);
		}
		.arch-complexity-low {
			background: color-mix(in srgb, var(--vscode-charts-green) 15%, transparent);
			color: var(--vscode-charts-green);
		}

		.validation-score {
			display: inline-flex;
			align-items: center;
			gap: 8px;
			padding: 4px 12px;
			border-radius: 4px;
			font-weight: 600;
			margin-bottom: 8px;
		}
		.validation-score.score-good {
			background: color-mix(in srgb, var(--vscode-charts-green) 15%, transparent);
			color: var(--vscode-charts-green);
		}
		.validation-score.score-warn {
			background: color-mix(in srgb, var(--vscode-charts-yellow) 15%, transparent);
			color: var(--vscode-charts-yellow);
		}
		.validation-score.score-bad {
			background: color-mix(in srgb, var(--vscode-errorForeground) 15%, transparent);
			color: var(--vscode-errorForeground);
		}
		.validation-findings {
			margin: 8px 0 4px;
			padding-left: 20px;
		}
		.validation-findings li {
			padding: 2px 0;
			font-size: 13px;
		}
		.status-pass {
			color: var(--vscode-charts-green);
		}
		.status-fail {
			color: var(--vscode-charts-yellow);
		}

		.architecture-gate.gate-pending .gate-actions {
			display: flex;
			gap: 8px;
			margin-top: 10px;
		}
		.architecture-gate .gate-btn {
			padding: 6px 14px;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-size: 13px;
			font-weight: 500;
		}
		.architecture-gate .gate-btn-approve {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
		}
		.architecture-gate .gate-btn-approve:hover {
			background: var(--vscode-button-hoverBackground);
		}
		.architecture-gate .gate-btn-revise {
			background: color-mix(in srgb, var(--vscode-charts-yellow) 20%, transparent);
			color: var(--vscode-charts-yellow);
		}
		.architecture-gate .gate-btn-skip {
			background: color-mix(in srgb, var(--vscode-descriptionForeground) 15%, transparent);
			color: var(--vscode-descriptionForeground);
		}
		.architecture-gate .gate-btn-deeper {
			background: color-mix(in srgb, var(--vscode-charts-blue) 15%, transparent);
			color: var(--vscode-charts-blue);
		}
		.architecture-gate .gate-btn-deeper:hover:not(:disabled) {
			background: color-mix(in srgb, var(--vscode-charts-blue) 25%, transparent);
		}
		.architecture-gate .gate-btn-deeper:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
		.gate-approved { border-left: 3px solid var(--vscode-charts-green); }
		.gate-skipped { border-left: 3px solid var(--vscode-descriptionForeground); }
		.gate-revised { border-left: 3px solid var(--vscode-charts-yellow); }
		.gate-deepened { border-left: 3px solid var(--vscode-charts-blue); }

		/* ===== DECOMPOSITION BREADCRUMB ===== */
		.decomposition-breadcrumb {
			margin: 8px 0 10px;
			padding: 8px 12px;
			border-radius: 4px;
			background: color-mix(in srgb, var(--vscode-editor-foreground) 4%, transparent);
			border: 1px solid color-mix(in srgb, var(--vscode-widget-border) 50%, transparent);
		}
		.decomposition-label {
			font-size: 11px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.3px;
			color: var(--vscode-descriptionForeground);
			margin-bottom: 6px;
		}
		.decomposition-levels {
			display: flex;
			align-items: center;
			gap: 2px;
			flex-wrap: wrap;
		}
		.decomposition-level {
			font-size: 12px;
			padding: 2px 6px;
			border-radius: 3px;
			color: color-mix(in srgb, var(--vscode-descriptionForeground) 60%, transparent);
		}
		.decomposition-level.completed {
			color: var(--vscode-charts-green);
		}
		.decomposition-level.active {
			font-weight: 700;
			color: var(--vscode-editor-foreground);
			background: color-mix(in srgb, var(--vscode-charts-blue) 15%, transparent);
			border: 1px solid color-mix(in srgb, var(--vscode-charts-blue) 30%, transparent);
		}
		.decomposition-arrow {
			font-size: 11px;
			color: color-mix(in srgb, var(--vscode-descriptionForeground) 40%, transparent);
			margin: 0 1px;
		}

		/* ===== ARCHITECTURE FEEDBACK TEXTAREA ===== */
		.architecture-feedback-area {
			display: none;
			margin-top: 8px;
		}
		.architecture-feedback-area.visible {
			display: block;
		}
		.architecture-feedback-area textarea {
			width: 100%;
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border: 1px solid var(--vscode-input-border, var(--vscode-widget-border));
			border-radius: 4px;
			padding: 6px 8px;
			font-family: var(--vscode-font-family);
			font-size: 13px;
			resize: vertical;
			box-sizing: border-box;
		}
		.architecture-feedback-area.shake textarea {
			animation: shake 0.3s ease-in-out;
			border-color: var(--vscode-errorForeground);
		}
		@keyframes shake {
			0%, 100% { transform: translateX(0); }
			25% { transform: translateX(-4px); }
			75% { transform: translateX(4px); }
		}

		/* ===== CLAIMS LIST (inside cards) ===== */
		.claims-list {
			margin-top: 8px;
			padding-left: 0;
			list-style: none;
		}

		.claim-item {
			display: flex;
			align-items: flex-start;
			gap: 6px;
			padding: 4px 0;
			font-size: 14px;
		}

		.claim-item + .claim-item {
			border-top: 1px solid var(--vscode-widget-border);
		}

		/* ===== ASSUMPTION LIST (structured rendering) ===== */
		.assumption-list {
			display: flex;
			flex-direction: column;
			gap: 6px;
			padding: 4px 0;
		}

		.assumption-item {
			padding: 8px 10px;
			border-radius: 4px;
			background: color-mix(in srgb, var(--vscode-editor-foreground) 4%, transparent);
			border-left: 3px solid var(--vscode-widget-border);
		}

		.assumption-item:has(.assumption-criticality.critical) {
			border-left-color: var(--vscode-charts-red);
		}

		.assumption-header {
			display: flex;
			align-items: flex-start;
			gap: 8px;
		}

		.assumption-criticality {
			display: inline-block;
			padding: 1px 6px;
			border-radius: 2px;
			font-size: 12px;
			font-weight: 700;
			letter-spacing: 0.3px;
			white-space: nowrap;
			flex-shrink: 0;
			margin-top: 1px;
		}

		.assumption-criticality.critical {
			background: color-mix(in srgb, var(--vscode-charts-red) 20%, transparent);
			color: var(--vscode-charts-red);
		}

		.assumption-criticality.non-critical {
			background: color-mix(in srgb, var(--vscode-charts-yellow) 20%, transparent);
			color: var(--vscode-charts-yellow);
		}

		.assumption-statement {
			font-size: 14px;
			line-height: 1.4;
		}

		.assumption-rationale {
			margin-top: 4px;
			padding-left: 2px;
			font-size: 13px;
			color: var(--vscode-descriptionForeground);
			line-height: 1.4;
		}

		/* Verdict Badges */
		.verdict-badge {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			padding: 2px 8px;
			border-radius: 10px;
			font-size: 12px;
			font-weight: 600;
			white-space: nowrap;
		}

		.verdict-badge.pending {
			background: var(--vscode-widget-border);
			color: var(--vscode-descriptionForeground);
		}

		.verdict-badge.verified {
			background: color-mix(in srgb, var(--vscode-charts-green) 20%, transparent);
			color: var(--vscode-charts-green);
		}

		.verdict-badge.unknown {
			background: color-mix(in srgb, var(--vscode-charts-yellow) 20%, transparent);
			color: var(--vscode-charts-yellow);
		}

		.verdict-badge.disproved {
			background: color-mix(in srgb, var(--vscode-charts-red) 20%, transparent);
			color: var(--vscode-charts-red);
		}

		.verdict-badge.conditional {
			background: color-mix(in srgb, var(--vscode-charts-orange, #ff9800) 20%, transparent);
			color: var(--vscode-charts-orange, #ff9800);
		}

		/* Historian Adjudication Badges */
		.adjudication-badge {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			padding: 2px 8px;
			border-radius: 10px;
			font-size: 12px;
			font-weight: 600;
			white-space: nowrap;
		}

		.adjudication-badge.consistent {
			background: color-mix(in srgb, var(--vscode-charts-green) 15%, transparent);
			color: var(--vscode-charts-green);
		}

		.adjudication-badge.inconsistent {
			background: color-mix(in srgb, var(--vscode-charts-red) 15%, transparent);
			color: var(--vscode-charts-red);
		}

		.adjudication-badge.adj-conditional {
			background: color-mix(in srgb, var(--vscode-charts-yellow) 15%, transparent);
			color: var(--vscode-charts-yellow);
		}

		.adjudication-badge.adj-unknown {
			background: color-mix(in srgb, var(--vscode-widget-border) 40%, transparent);
			color: var(--vscode-descriptionForeground);
		}

		/* ===== VERIFIER EVIDENCE LOG ===== */
		.evidence-log {
			margin-top: 8px;
			max-height: 120px;
			overflow-y: auto;
			padding: 6px 8px;
			background: var(--vscode-textCodeBlock-background);
			border-radius: 3px;
			font-family: var(--vscode-editor-font-family);
			font-size: 13px;
			line-height: 1.5;
		}

		/* ===== HUMAN GATE CARD ===== */
		.gate-card {
			margin-bottom: 12px;
			padding: 14px;
			background: color-mix(in srgb, var(--vscode-charts-yellow) 5%, var(--vscode-editor-background));
			border: 2px solid var(--vscode-charts-yellow);
			border-radius: 4px;
		}

		.gate-card .collapsible-card-header {
			margin: -8px -10px 0 -10px;
		}

		.gate-header {
			display: flex;
			align-items: center;
			gap: 8px;
			font-weight: 600;
			font-size: 15px;
		}

		.gate-icon {
			font-size: 18px;
		}

		.gate-context {
			font-size: 14px;
			line-height: 1.5;
			margin-bottom: 12px;
			color: var(--vscode-descriptionForeground);
		}

		.gate-blocking-claims {
			margin-bottom: 12px;
			padding: 8px;
			background: var(--vscode-textCodeBlock-background);
			border-radius: 3px;
		}

		.gate-blocking-claims h4 {
			font-size: 13px;
			text-transform: uppercase;
			color: var(--vscode-descriptionForeground);
			margin-bottom: 4px;
		}

		.gate-rationale {
			margin-bottom: 12px;
		}

		.gate-rationale label {
			display: block;
			font-size: 13px;
			font-weight: 600;
			margin-bottom: 4px;
			color: var(--vscode-descriptionForeground);
		}

		.gate-rationale textarea {
			width: 100%;
			min-height: 60px;
			padding: 8px;
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border: 1px solid var(--vscode-input-border, var(--vscode-widget-border));
			border-radius: 3px;
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			resize: vertical;
		}

		.gate-rationale textarea:focus {
			outline: none;
			border-color: var(--vscode-focusBorder);
		}

		.gate-char-count {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			text-align: right;
			margin-top: 2px;
		}

		/* ===== GATE EVALUATION (Enriched Failure Analysis) ===== */

		.gate-evaluation {
			margin: 8px 0;
			padding: 10px;
			border-radius: 4px;
			background: color-mix(in srgb, var(--vscode-editor-foreground) 4%, transparent);
			border-left: 3px solid var(--vscode-charts-orange, #d19a66);
		}

		.gate-eval-status {
			margin-bottom: 6px;
		}

		.gate-eval-badge {
			display: inline-block;
			font-size: 14px;
			font-weight: 600;
			padding: 2px 8px;
			border-radius: 3px;
		}

		.gate-eval-badge.completed-with-errors {
			background: var(--vscode-charts-yellow, #e5c07b);
			color: #000;
		}

		.gate-eval-badge.partially-completed {
			background: var(--vscode-charts-orange, #d19a66);
			color: #000;
		}

		.gate-eval-badge.blocked {
			background: var(--vscode-charts-purple, #c678dd);
			color: #fff;
		}

		.gate-eval-badge.failed {
			background: var(--vscode-errorForeground, #e06c75);
			color: #fff;
		}

		.gate-eval-summary {
			font-size: 15px;
			margin-bottom: 8px;
			line-height: 1.4;
		}

		.gate-eval-section h4 {
			font-size: 13px;
			text-transform: uppercase;
			opacity: 0.7;
			margin: 8px 0 4px;
			letter-spacing: 0.5px;
		}

		.gate-eval-section ul {
			margin: 0;
			padding-left: 16px;
			font-size: 14px;
		}

		.gate-eval-section li {
			margin-bottom: 3px;
			line-height: 1.3;
		}

		.gate-eval-recovery {
			margin-top: 8px;
			padding: 6px 10px;
			border-radius: 4px;
			background: color-mix(in srgb, var(--vscode-charts-green) 15%, transparent);
			border: 1px solid color-mix(in srgb, var(--vscode-charts-green) 40%, transparent);
			font-size: 14px;
		}

		.gate-eval-recovery code {
			background: color-mix(in srgb, var(--vscode-editor-foreground) 10%, transparent);
			padding: 1px 4px;
			border-radius: 2px;
		}

		/* ===== PERMISSION CARDS ===== */

		.permission-card {
			border: 1px solid var(--vscode-charts-orange);
			border-radius: 6px;
			margin: 8px 0;
			padding: 12px;
			background: color-mix(in srgb, var(--vscode-charts-orange) 6%, var(--vscode-editor-background));
		}

		.permission-header {
			display: flex;
			align-items: center;
			gap: 6px;
			font-weight: 600;
			font-size: 15px;
			margin-bottom: 8px;
		}

		.permission-icon {
			font-size: 16px;
		}

		.permission-body {
			margin-bottom: 10px;
		}

		.permission-tool-name {
			font-family: var(--vscode-editor-font-family);
			font-size: 15px;
			font-weight: 600;
			color: var(--vscode-charts-orange);
			margin-bottom: 4px;
		}

		.permission-input {
			font-family: var(--vscode-editor-font-family);
			font-size: 14px;
			opacity: 0.8;
			white-space: pre-wrap;
			word-break: break-all;
			max-height: 80px;
			overflow: hidden;
		}

		.permission-actions {
			display: flex;
			gap: 8px;
			flex-wrap: wrap;
		}

		.permission-btn {
			padding: 5px 12px;
			border: none;
			border-radius: 3px;
			cursor: pointer;
			font-size: 14px;
			font-weight: 600;
			font-family: var(--vscode-font-family);
			transition: opacity 0.15s;
		}
		.permission-btn:hover { opacity: 0.85; }
		.permission-btn:disabled { opacity: 0.5; cursor: default; }

		.permission-approve {
			background: var(--vscode-charts-green);
			color: #000;
		}

		.permission-approve-all {
			background: var(--vscode-charts-blue);
			color: #fff;
		}

		.permission-deny {
			background: var(--vscode-errorForeground);
			color: #fff;
		}

		.permission-card.permission-approved {
			border-color: var(--vscode-charts-green);
			opacity: 0.7;
		}

		.permission-card.permission-denied {
			border-color: var(--vscode-errorForeground);
			opacity: 0.7;
		}

		.gate-actions {
			display: flex;
			gap: 8px;
			flex-wrap: wrap;
		}

		.gate-btn {
			padding: 6px 14px;
			border: none;
			border-radius: 3px;
			cursor: pointer;
			font-size: 14px;
			font-weight: 600;
			font-family: var(--vscode-font-family);
			transition: opacity 0.15s;
		}

		.gate-btn:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}

		.gate-btn:not(:disabled):hover {
			opacity: 0.85;
		}

		.gate-btn.was-selected {
			outline: 2px solid var(--vscode-focusBorder);
			outline-offset: 1px;
			opacity: 0.8 !important;
		}

		.intake-approval-actions.resolved {
			opacity: 0.7;
		}

		.gate-btn.approve {
			background: var(--vscode-charts-green);
			color: var(--vscode-editor-background);
		}

		.gate-btn.reject {
			background: var(--vscode-charts-red);
			color: var(--vscode-editor-background);
		}

		.gate-btn.override {
			background: var(--vscode-charts-yellow);
			color: var(--vscode-editor-background);
		}

		.gate-btn.reframe {
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
		}

		/* ===== RESOLVED GATE STATES ===== */
		.gate-card.resolved,
		.verification-gate-card.resolved,
		.review-gate-card.resolved,
		.intake-approval-gate.resolved {
			opacity: 0.7;
			pointer-events: none;
		}

		.gate-resolved-badge {
			display: inline-block;
			font-size: 13px;
			font-weight: 600;
			padding: 2px 8px;
			border-radius: 3px;
			background: color-mix(in srgb, var(--vscode-charts-green, #89d185) 15%, var(--vscode-editor-background));
			color: var(--vscode-charts-green, #89d185);
			margin-left: 8px;
		}

		/* ===== VERIFICATION GATE CARD ===== */
		.verification-gate-card {
			margin-bottom: 12px;
			padding: 14px;
			background: color-mix(in srgb, var(--vscode-charts-yellow) 5%, var(--vscode-editor-background));
			border-left: 3px solid var(--vscode-charts-yellow);
			border-radius: 4px;
		}

		.verification-gate-header {
			display: flex;
			align-items: center;
			gap: 8px;
			font-weight: 600;
			font-size: 15px;
			margin-bottom: 10px;
		}

		.verification-summary-bar {
			display: flex;
			gap: 16px;
			padding: 8px 12px;
			margin-bottom: 12px;
			background: var(--vscode-textCodeBlock-background);
			border-radius: 3px;
			flex-wrap: wrap;
		}

		.verification-summary-item {
			display: flex;
			align-items: center;
			gap: 4px;
			font-size: 14px;
		}

		.verification-summary-count {
			font-weight: 700;
			font-size: 16px;
		}

		.verification-claims-group {
			margin-bottom: 10px;
		}

		.verification-group-header {
			font-size: 13px;
			font-weight: 600;
			text-transform: uppercase;
			color: var(--vscode-descriptionForeground);
			margin-bottom: 6px;
			padding-bottom: 4px;
			border-bottom: 1px solid var(--vscode-widget-border);
		}

		.verification-claim-row {
			padding: 8px;
			margin-bottom: 6px;
			background: var(--vscode-textCodeBlock-background);
			border-radius: 3px;
		}

		.verification-claim-header {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 4px;
			flex-wrap: wrap;
		}

		.verification-claim-criticality {
			font-size: 12px;
			font-weight: 600;
			padding: 1px 6px;
			border-radius: 2px;
			text-transform: uppercase;
		}

		.verification-claim-criticality.critical {
			background: color-mix(in srgb, var(--vscode-charts-red) 20%, transparent);
			color: var(--vscode-charts-red);
		}

		.verification-claim-criticality.non-critical {
			background: color-mix(in srgb, var(--vscode-descriptionForeground) 15%, transparent);
			color: var(--vscode-descriptionForeground);
		}

		.assumption-type-badge {
			font-size: 11px;
			font-weight: 600;
			padding: 1px 5px;
			border-radius: 2px;
			text-transform: uppercase;
			background: color-mix(in srgb, var(--vscode-charts-blue) 15%, transparent);
			color: var(--vscode-charts-blue);
			letter-spacing: 0.3px;
		}

		/* ===== ASK MORE — TOGGLE MODE ON RESPONSE TEXTAREAS ===== */
		.response-toolbar {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-top: 2px;
		}
		.ask-more-toggle {
			font-size: 13px;
			padding: 2px 8px;
			background: transparent;
			color: var(--vscode-textLink-foreground);
			border: 1px solid var(--vscode-textLink-foreground);
			border-radius: 3px;
			cursor: pointer;
			opacity: 0.7;
		}
		.ask-more-toggle:hover { opacity: 1; }
		.ask-more-toggle.active {
			background: var(--vscode-textLink-foreground);
			color: var(--vscode-editor-background);
			opacity: 1;
		}

		/* Clarification conversation messages (above textarea in Ask More mode) */
		.clarification-messages {
			max-height: 250px;
			overflow-y: auto;
			margin-bottom: 6px;
			padding: 6px;
			border-left: 2px solid var(--vscode-textLink-foreground);
			background: color-mix(in srgb, var(--vscode-textLink-foreground) 4%, transparent);
			border-radius: 0 4px 4px 0;
		}
		.clarification-msg {
			padding: 6px 10px;
			margin-bottom: 6px;
			border-radius: 6px;
			font-size: 14px;
			line-height: 1.4;
			word-wrap: break-word;
		}
		.clarification-msg:last-child { margin-bottom: 0; }
		.clarification-msg-human {
			background: color-mix(in srgb, var(--vscode-charts-blue) 12%, transparent);
			margin-left: 30%;
			text-align: right;
		}
		.clarification-msg-assistant {
			background: var(--vscode-textCodeBlock-background);
			margin-right: 30%;
		}
		.clarification-msg-error {
			color: var(--vscode-errorForeground);
			font-style: italic;
		}
		.clarification-meta {
			margin-top: 4px;
			font-size: 12px;
			opacity: 0.5;
			text-align: right;
		}
		.clarification-loading-dots {
			opacity: 0.6;
			font-style: italic;
		}
		/* Send button shown in Ask More mode (replaces charcount) */
		.clarification-send-btn {
			padding: 4px 10px;
			font-size: 13px;
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			border-radius: 3px;
			cursor: pointer;
		}
		.clarification-send-btn:hover {
			background: var(--vscode-button-hoverBackground);
		}

		/* Textarea border highlight when in Ask More mode */
		.askmore-mode textarea {
			border-color: var(--vscode-textLink-foreground);
		}

		.verification-claim-statement {
			font-size: 14px;
			line-height: 1.4;
		}

		.verification-claim-rationale {
			font-size: 13px;
			color: var(--vscode-descriptionForeground);
			margin-top: 4px;
			padding-left: 8px;
			border-left: 2px solid var(--vscode-widget-border);
			font-style: italic;
		}

		.verification-claim-response {
			margin-top: 6px;
		}

		.verification-claim-response textarea {
			width: 100%;
			min-height: 40px;
			padding: 6px 8px;
			font-size: 13px;
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border: 1px solid var(--vscode-input-border);
			border-radius: 3px;
			font-family: var(--vscode-font-family);
			resize: vertical;
			box-sizing: border-box;
		}

		.verification-claim-response textarea:focus {
			outline: none;
			border-color: var(--vscode-focusBorder);
		}

		.verification-claim-response label {
			display: block;
			font-size: 12px;
			margin-bottom: 3px;
			color: var(--vscode-descriptionForeground);
		}

		.verification-claim-charcount {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			margin-top: 2px;
			text-align: right;
		}

		.verification-nonblocking {
			margin-top: 8px;
		}

		.verification-nonblocking-toggle {
			font-size: 13px;
			color: var(--vscode-descriptionForeground);
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 4px;
			padding: 4px 0;
		}

		.verification-nonblocking-toggle:hover {
			color: var(--vscode-foreground);
		}

		.verification-nonblocking-body {
			display: none;
			margin-top: 6px;
		}

		.verification-nonblocking.expanded .verification-nonblocking-body {
			display: block;
		}

		.verification-nonblocking.expanded .verification-nonblocking-chevron {
			transform: rotate(90deg);
		}

		.verification-nonblocking-chevron {
			font-size: 12px;
			transition: transform 0.15s;
		}

		.verification-actions {
			display: flex;
			gap: 8px;
			flex-wrap: wrap;
			margin-top: 12px;
			padding-top: 12px;
			border-top: 1px solid var(--vscode-widget-border);
		}

		.verification-btn {
			padding: 8px 16px;
			border: none;
			border-radius: 3px;
			cursor: pointer;
			font-size: 14px;
			font-weight: 600;
			font-family: var(--vscode-font-family);
			transition: opacity 0.15s;
		}

		.verification-btn:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}

		.verification-btn:not(:disabled):hover {
			opacity: 0.85;
		}

		.verification-btn.accept-risks {
			background: var(--vscode-charts-yellow);
			color: var(--vscode-editor-background);
		}

		.verification-btn.retry-verify {
			background: var(--vscode-charts-blue);
			color: var(--vscode-editor-background);
		}

		.verification-btn.replan {
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
		}

		/* ===== REVIEW GATE CARD ===== */
		.review-gate-card {
			margin-bottom: 16px;
			padding: 16px;
			background: color-mix(in srgb, var(--vscode-charts-purple, #b180d7) 6%, var(--vscode-editor-background));
			border: 1px solid var(--vscode-charts-purple, #b180d7);
			border-left: 3px solid var(--vscode-charts-purple, #b180d7);
			border-radius: 6px;
		}

		.review-gate-header {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 4px;
			font-weight: 600;
			font-size: 16px;
		}

		.review-gate-subtitle {
			color: var(--vscode-descriptionForeground);
			font-size: 14px;
			margin-bottom: 12px;
		}

		.review-dashboard-bar {
			display: flex;
			gap: 12px;
			flex-wrap: wrap;
			padding: 8px 12px;
			background: color-mix(in srgb, var(--vscode-editor-foreground) 5%, var(--vscode-editor-background));
			border-radius: 4px;
			margin-bottom: 12px;
			font-size: 14px;
		}

		.review-dashboard-item {
			display: flex;
			align-items: center;
			gap: 4px;
		}

		.review-dashboard-item .count {
			font-weight: 600;
		}

		.review-group {
			margin: 8px 0;
			border: 1px solid var(--vscode-editorWidget-border);
			border-radius: 6px;
			overflow: hidden;
		}

		.review-group-header {
			cursor: pointer;
			padding: 8px 12px;
			display: flex;
			align-items: center;
			gap: 8px;
			font-weight: 600;
			font-size: 14px;
			user-select: none;
		}

		.review-group-header .card-chevron {
			font-size: 12px;
			transition: transform 0.15s;
		}

		.review-group:not(.collapsed) .review-group-header .card-chevron {
			transform: rotate(90deg);
		}

		.review-group.collapsed .review-group-body {
			display: none;
		}

		.review-group.needs-decision .review-group-header {
			background: color-mix(in srgb, var(--vscode-charts-red, #f14c4c) 10%, var(--vscode-editor-background));
		}

		.review-group.awareness .review-group-header {
			background: color-mix(in srgb, var(--vscode-charts-yellow, #cca700) 10%, var(--vscode-editor-background));
		}

		.review-group.all-clear .review-group-header {
			background: color-mix(in srgb, var(--vscode-charts-green, #89d185) 10%, var(--vscode-editor-background));
		}

		.review-item-row {
			padding: 10px 12px;
			border-bottom: 1px solid var(--vscode-editorWidget-border);
		}

		.review-item-row:last-child {
			border-bottom: none;
		}

		.review-item-header {
			display: flex;
			align-items: flex-start;
			gap: 8px;
			margin-bottom: 4px;
		}

		.review-item-statement {
			font-size: 14px;
			line-height: 1.4;
		}

		.review-item-rationale {
			font-style: italic;
			color: var(--vscode-descriptionForeground);
			font-size: 13px;
			margin: 4px 0 4px 24px;
			padding-left: 8px;
			border-left: 2px solid var(--vscode-editorWidget-border);
		}

		/* Historian Adjudication Details (below Verifier rationale) */
		.review-item-adjudication {
			margin: 6px 0 4px 24px;
			padding: 6px 10px;
			background: color-mix(in srgb, var(--vscode-textCodeBlock-background) 60%, transparent);
			border-radius: 4px;
			border-left: 2px solid var(--vscode-descriptionForeground);
		}

		.adjudication-rationale {
			font-style: italic;
			color: var(--vscode-descriptionForeground);
			font-size: 13px;
			line-height: 1.4;
			margin-bottom: 4px;
		}

		.adjudication-citations {
			display: flex;
			flex-wrap: wrap;
			gap: 4px;
			margin-top: 4px;
		}

		.citation-tag {
			display: inline-block;
			padding: 1px 6px;
			border-radius: 8px;
			font-family: var(--vscode-editor-font-family);
			font-size: 11px;
			background: var(--vscode-badge-background);
			color: var(--vscode-badge-foreground);
			white-space: nowrap;
		}

		.adjudication-conflicts,
		.adjudication-conditions,
		.adjudication-queries {
			margin-top: 6px;
			font-size: 13px;
			line-height: 1.4;
		}

		.adjudication-conflicts {
			color: var(--vscode-charts-red);
		}

		.adjudication-conditions {
			color: var(--vscode-charts-yellow);
		}

		.adjudication-queries {
			color: var(--vscode-descriptionForeground);
		}

		.adjudication-conflicts strong,
		.adjudication-conditions strong,
		.adjudication-queries strong {
			font-size: 12px;
			text-transform: uppercase;
			letter-spacing: 0.3px;
		}

		.adjudication-conflicts ul,
		.adjudication-conditions ul,
		.adjudication-queries ul {
			margin: 2px 0 0 0;
			padding-left: 18px;
		}

		.adjudication-conflicts li,
		.adjudication-conditions li,
		.adjudication-queries li {
			margin-bottom: 2px;
		}

		.review-finding-context {
			font-style: italic;
			color: var(--vscode-descriptionForeground);
			font-size: 13px;
			margin: 4px 0 4px 24px;
		}

		.review-item-response {
			margin: 6px 0 0 24px;
		}

		.review-item-response textarea {
			width: 100%;
			min-height: 36px;
			padding: 6px 8px;
			border: 1px solid var(--vscode-input-border);
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			font-family: var(--vscode-font-family);
			font-size: 14px;
			border-radius: 3px;
			resize: vertical;
			box-sizing: border-box;
		}

		.review-item-charcount {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			text-align: right;
			margin-top: 2px;
		}

		.review-overall-section {
			margin-top: 12px;
			padding-top: 12px;
			border-top: 1px solid var(--vscode-editorWidget-border);
		}

		.review-overall-section label {
			display: block;
			font-size: 14px;
			font-weight: 600;
			margin-bottom: 4px;
		}

		.review-overall-section textarea {
			width: 100%;
			min-height: 50px;
			padding: 6px 8px;
			border: 1px solid var(--vscode-input-border);
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			font-family: var(--vscode-font-family);
			font-size: 14px;
			border-radius: 3px;
			resize: vertical;
			box-sizing: border-box;
		}

		.review-actions {
			display: flex;
			gap: 8px;
			flex-wrap: wrap;
			margin-top: 12px;
			padding-top: 12px;
			border-top: 1px solid var(--vscode-widget-border);
		}

		.review-btn {
			padding: 8px 16px;
			border: none;
			border-radius: 3px;
			cursor: pointer;
			font-size: 14px;
			font-weight: 600;
			font-family: var(--vscode-font-family);
			transition: opacity 0.15s;
		}

		.review-btn:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}

		.review-btn:not(:disabled):hover {
			opacity: 0.85;
		}

		.review-btn.approve-execute {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
		}

		.review-btn.request-changes {
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
		}

		/* Resolved review gate: decision record */
		.review-resolved-decision {
			margin-top: 12px;
			padding-top: 12px;
			border-top: 1px solid var(--vscode-editorWidget-border);
		}

		.review-resolved-action {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 8px 12px;
			border-radius: 4px;
			font-size: 14px;
			font-weight: 600;
		}

		.review-resolved-action.approved {
			background: color-mix(in srgb, var(--vscode-charts-green, #4caf50) 12%, var(--vscode-editor-background));
			border-left: 3px solid var(--vscode-charts-green, #4caf50);
		}

		.review-resolved-action.reframed {
			background: color-mix(in srgb, var(--vscode-charts-yellow, #ffb300) 12%, var(--vscode-editor-background));
			border-left: 3px solid var(--vscode-charts-yellow, #ffb300);
		}

		.review-resolved-action-label {
			flex: 1;
		}

		.review-resolved-timestamp {
			font-weight: 400;
			font-size: 13px;
			color: var(--vscode-descriptionForeground);
		}

		.review-resolved-rationale {
			margin-top: 8px;
			padding: 8px 12px;
			background: color-mix(in srgb, var(--vscode-editor-foreground) 4%, var(--vscode-editor-background));
			border-radius: 4px;
			border-left: 2px solid var(--vscode-editorWidget-border);
		}

		.review-resolved-rationale label {
			display: block;
			font-size: 13px;
			font-weight: 600;
			margin-bottom: 4px;
			color: var(--vscode-descriptionForeground);
		}

		.review-resolved-rationale-text {
			font-size: 14px;
			line-height: 1.5;
			white-space: pre-wrap;
		}

		.review-actions.resolved {
			opacity: 0.6;
		}

		.review-btn.was-selected {
			outline: 2px solid var(--vscode-focusBorder);
			outline-offset: 1px;
			opacity: 1 !important;
		}

		/* ===== WARNING CARD ===== */
		.warning-card {
			margin-bottom: 12px;
			padding: 12px;
			background: color-mix(in srgb, var(--vscode-charts-orange, #ff9800) 8%, var(--vscode-editor-background));
			border: 1px solid var(--vscode-charts-orange, #ff9800);
			border-left: 3px solid var(--vscode-charts-orange, #ff9800);
			border-radius: 4px;
		}

		.warning-header {
			display: flex;
			align-items: center;
			gap: 6px;
			font-weight: 600;
			font-size: 14px;
			margin-bottom: 6px;
		}

		/* ===== INTAKE INLINE QUESTION RESPONSES ===== */
		.intake-question-response {
			margin-top: 6px;
		}
		.intake-question-textarea {
			width: 100%;
			min-height: 40px;
			padding: 6px 8px;
			border: 1px solid var(--vscode-input-border);
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border-radius: 4px;
			font-family: var(--vscode-font-family);
			font-size: 14px;
			resize: vertical;
			box-sizing: border-box;
		}
		.intake-question-textarea:focus {
			outline: 1px solid var(--vscode-focusBorder);
		}
		.intake-question-charcount {
			display: block;
			text-align: right;
			font-size: 0.8em;
			color: var(--vscode-descriptionForeground);
			margin-top: 2px;
		}
		.intake-questions-submit-bar {
			display: flex;
			align-items: center;
			justify-content: flex-end;
			gap: 10px;
			padding: 8px 16px;
			margin-top: 8px;
			border-top: 1px solid var(--vscode-editorWidget-border);
		}
		.intake-questions-submit-count {
			font-size: 13px;
			color: var(--vscode-descriptionForeground);
		}
		.intake-questions-submit-btn {
			padding: 6px 16px;
			border: none;
			border-radius: 4px;
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			cursor: pointer;
			font-size: 14px;
		}
		.intake-questions-submit-btn:hover {
			background: var(--vscode-button-hoverBackground);
		}
		.intake-questions-submit-btn:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
		.intake-question-textarea.submitted {
			opacity: 0.7;
			cursor: default;
			border-color: transparent;
			background: color-mix(in srgb, var(--vscode-input-background) 50%, transparent);
			resize: none;
		}
		.intake-questions-submit-bar.submitted {
			opacity: 0.7;
		}

		/* ===== ZONE 3: CONTEXTUAL INPUT AREA ===== */
		.input-area {
			position: sticky;
			bottom: 0;
			z-index: 100;
			background: var(--vscode-sideBar-background);
			border-top: 1px solid var(--vscode-widget-border);
			padding: 12px 16px;
			flex-shrink: 0;
		}

		.input-actions {
			display: flex;
			gap: 8px;
			margin-bottom: 8px;
		}

		.input-action-btn {
			padding: 4px 12px;
			border: 1px solid var(--vscode-button-background);
			background: transparent;
			color: var(--vscode-button-background);
			border-radius: 3px;
			cursor: pointer;
			font-size: 13px;
			font-family: var(--vscode-font-family);
			transition: all 0.15s;
		}

		.input-action-btn:hover {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
		}

		/* --- Composer (contenteditable rich input) --- */
		.composer-wrapper {
			background: var(--vscode-input-background);
			border: 1px solid var(--vscode-input-border, var(--vscode-widget-border));
			border-radius: 4px;
			display: flex;
			flex-direction: column;
			transition: border-color 0.15s;
		}

		.composer-wrapper:focus-within {
			border-color: var(--vscode-focusBorder);
		}

		/* Replying-to token bar inside composer */
		.composer-tokens {
			display: none;
			flex-wrap: wrap;
			align-items: center;
			gap: 4px;
			padding: 6px 10px 0 10px;
		}

		.composer-tokens-label {
			font-size: 12px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.3px;
			color: var(--vscode-descriptionForeground);
			flex-shrink: 0;
		}

		.composer-token-tag {
			display: inline-flex;
			align-items: center;
			gap: 3px;
			padding: 1px 6px;
			background: color-mix(in srgb, var(--vscode-charts-blue) 18%, var(--vscode-input-background));
			border: 1px solid var(--vscode-charts-blue);
			color: var(--vscode-charts-blue);
			border-radius: 10px;
			font-size: 12px;
			font-weight: 600;
			font-family: var(--vscode-editor-font-family);
			max-width: 180px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.composer-token-remove {
			cursor: pointer;
			opacity: 0.7;
			margin-left: 2px;
			flex-shrink: 0;
		}

		.composer-token-remove:hover {
			opacity: 1;
		}

		/* The editable text area */
		.composer-input {
			flex: 1;
			min-height: 36px;
			max-height: 120px;
			overflow-y: auto;
			padding: 8px 10px;
			color: var(--vscode-input-foreground);
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			line-height: 1.4;
			outline: none;
			word-wrap: break-word;
			white-space: pre-wrap;
		}

		/* Placeholder via CSS */
		.composer-input[data-empty="true"]::before {
			content: attr(data-placeholder);
			color: var(--vscode-input-placeholderForeground);
			pointer-events: none;
			position: absolute;
		}

		/* Composer footer: toolbar + send button */
		.composer-footer {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 4px 6px 4px 10px;
			border-top: 1px solid var(--vscode-widget-border);
			gap: 8px;
		}

		.composer-footer-left {
			display: flex;
			align-items: center;
			gap: 6px;
			flex: 1;
			min-width: 0;
		}

		.input-submit-btn {
			width: 32px;
			height: 32px;
			padding: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			border-radius: 50%;
			cursor: pointer;
			font-size: 18px;
			font-weight: 700;
			transition: background 0.15s;
			flex-shrink: 0;
		}

		.input-submit-btn:hover {
			background: var(--vscode-button-hoverBackground);
		}

		.input-submit-btn:disabled {
			opacity: 0.3;
			cursor: not-allowed;
		}

		.input-submit-btn.thinking {
			background: var(--vscode-inputValidation-warningBorder, #c57a1a);
		}

		.input-submit-btn.thinking:hover {
			background: var(--vscode-errorForeground, #f44747);
		}

		.submit-icon {
			line-height: 1;
		}

		.submit-spinner {
			display: none;
			width: 14px;
			height: 14px;
			border: 2px solid rgba(255,255,255,0.3);
			border-top-color: var(--vscode-button-foreground);
			border-radius: 50%;
			animation: processingSpinnerRotate 0.8s linear infinite;
		}

		.input-submit-btn.thinking .submit-icon {
			display: none;
		}

		.input-submit-btn.thinking .submit-spinner {
			display: block;
		}

		/* --- Input Toolbar (inside composer footer) --- */
		.input-toolbar {
			display: flex;
			align-items: center;
			gap: 6px;
			margin-top: 6px;
		}

		.input-toolbar-btn {
			padding: 3px 8px;
			background: transparent;
			color: var(--vscode-descriptionForeground);
			border: 1px solid var(--vscode-widget-border);
			border-radius: 3px;
			cursor: pointer;
			font-size: 13px;
			font-family: var(--vscode-font-family);
			transition: all 0.15s;
			flex-shrink: 0;
		}

		.input-toolbar-btn:hover {
			background: var(--vscode-toolbar-hoverBackground, rgba(90,93,94,0.31));
			color: var(--vscode-foreground);
			border-color: var(--vscode-focusBorder);
		}

		.input-toolbar-hint {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			margin-left: auto;
			opacity: 0.6;
			line-height: 1.4;
		}

		.input-toolbar-hint kbd {
			display: inline-block;
			padding: 0 4px;
			font-size: 12px;
			font-family: var(--vscode-editor-font-family, monospace);
			background: var(--vscode-keybindingLabel-background, rgba(128,128,128,0.17));
			border: 1px solid var(--vscode-keybindingLabel-border, rgba(128,128,128,0.3));
			border-radius: 3px;
			line-height: 1.6;
		}

		/* --- Attached Files --- */
		.input-attachments {
			display: flex;
			flex-wrap: wrap;
			gap: 4px;
			margin-bottom: 6px;
		}

		.attachment-chip {
			display: inline-flex;
			align-items: center;
			gap: 3px;
			padding: 2px 6px 2px 4px;
			background: var(--vscode-badge-background);
			color: var(--vscode-badge-foreground);
			border-radius: 10px;
			font-size: 13px;
			max-width: 260px;
			white-space: nowrap;
			transition: opacity 0.15s;
		}

		.attachment-chip:hover {
			opacity: 0.85;
		}

		.attachment-chip .chip-icon {
			font-size: 14px;
			flex-shrink: 0;
		}

		.attachment-chip .chip-folder {
			color: var(--vscode-badge-foreground);
			opacity: 0.6;
			font-size: 12px;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.attachment-chip .chip-name {
			overflow: hidden;
			text-overflow: ellipsis;
			font-weight: 500;
		}

		.attachment-chip .remove-attachment {
			cursor: pointer;
			opacity: 0.6;
			font-size: 16px;
			line-height: 1;
			margin-left: 2px;
			flex-shrink: 0;
		}

		.attachment-chip .remove-attachment:hover {
			opacity: 1;
		}

		/* --- Mention Autocomplete Dropdown --- */
		.mention-dropdown {
			position: absolute;
			bottom: 100%;
			left: 0;
			right: 0;
			max-height: 260px;
			overflow-y: auto;
			background: var(--vscode-editorSuggestWidget-background, var(--vscode-editor-background));
			border: 1px solid var(--vscode-editorSuggestWidget-border, var(--vscode-widget-border));
			border-radius: 4px;
			box-shadow: 0 4px 12px rgba(0,0,0,0.35);
			z-index: 200;
			display: none;
			margin-bottom: 4px;
		}

		.mention-dropdown.visible {
			display: block;
		}

		.mention-group-header {
			padding: 4px 10px 2px;
			font-size: 12px;
			font-weight: 600;
			color: var(--vscode-descriptionForeground);
			text-transform: uppercase;
			letter-spacing: 0.5px;
			opacity: 0.7;
			border-top: 1px solid var(--vscode-widget-border);
		}

		.mention-group-header:first-child {
			border-top: none;
		}

		.mention-item {
			padding: 5px 10px;
			cursor: pointer;
			font-size: 14px;
			display: flex;
			align-items: center;
			gap: 6px;
		}

		.mention-item:hover,
		.mention-item.selected {
			background: var(--vscode-editorSuggestWidget-selectedBackground, var(--vscode-list-hoverBackground));
		}

		.mention-item-icon {
			flex-shrink: 0;
			font-size: 15px;
			width: 18px;
			text-align: center;
		}

		.mention-item-name {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.mention-highlight {
			color: var(--vscode-editorSuggestWidget-highlightForeground, var(--vscode-focusBorder));
			font-weight: 600;
		}

		.mention-recent-badge {
			font-size: 11px;
			padding: 0 4px;
			border-radius: 3px;
			background: var(--vscode-badge-background);
			color: var(--vscode-badge-foreground);
			margin-left: auto;
			flex-shrink: 0;
			opacity: 0.8;
		}

		/* ===== EMPTY STATE ===== */
		.empty-state {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			padding: 60px 20px;
			color: var(--vscode-descriptionForeground);
			text-align: center;
		}

		.empty-state-icon {
			font-size: 48px;
			margin-bottom: 12px;
			opacity: 0.5;
		}

		.empty-state h3 {
			font-size: 16px;
			margin-bottom: 6px;
			color: var(--vscode-foreground);
		}

		.empty-state p {
			font-size: 14px;
		}

		/* ===== SCROLLBAR STYLING ===== */
		.stream-area::-webkit-scrollbar {
			width: 8px;
		}

		.stream-area::-webkit-scrollbar-track {
			background: transparent;
		}

		.stream-area::-webkit-scrollbar-thumb {
			background: var(--vscode-scrollbarSlider-background);
			border-radius: 4px;
		}

		.stream-area::-webkit-scrollbar-thumb:hover {
			background: var(--vscode-scrollbarSlider-hoverBackground);
		}

		/* ===== UTILITY ===== */
		.codicon {
			font-family: codicon;
			font-size: inherit;
		}

		.sr-only {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
		}

		/* ===== SETTINGS PANEL (API Key Management) ===== */
		.settings-panel {
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			z-index: 200;
			background: var(--vscode-editor-background);
			overflow-y: auto;
			padding: 16px;
			display: none;
		}

		.settings-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 12px;
			padding-bottom: 10px;
			border-bottom: 1px solid var(--vscode-widget-border);
		}

		.settings-title {
			font-size: 16px;
			font-weight: 600;
			color: var(--vscode-foreground);
			margin: 0;
		}

		.settings-close-btn {
			background: none;
			border: none;
			color: var(--vscode-foreground);
			font-size: 20px;
			cursor: pointer;
			padding: 2px 6px;
			border-radius: 3px;
			line-height: 1;
		}

		.settings-close-btn:hover {
			background: var(--vscode-list-hoverBackground);
		}

		.settings-description {
			font-size: 14px;
			color: var(--vscode-descriptionForeground);
			margin-bottom: 16px;
			line-height: 1.5;
		}

		.settings-roles {
			display: flex;
			flex-direction: column;
			gap: 10px;
		}

		.settings-loading {
			text-align: center;
			padding: 20px;
			color: var(--vscode-descriptionForeground);
			font-size: 14px;
		}

		.settings-role-row {
			display: flex;
			align-items: center;
			gap: 10px;
			padding: 10px 12px;
			background: var(--vscode-welcomePage-tileBackground, var(--vscode-sideBar-background));
			border: 1px solid var(--vscode-widget-border);
			border-radius: 4px;
		}

		.settings-role-info {
			flex: 1;
			min-width: 0;
		}

		.settings-role-name {
			font-size: 15px;
			font-weight: 600;
			color: var(--vscode-foreground);
			margin-bottom: 2px;
		}

		.settings-role-provider {
			font-size: 13px;
			color: var(--vscode-descriptionForeground);
		}

		.settings-role-status {
			display: flex;
			align-items: center;
			gap: 4px;
			font-size: 13px;
			font-weight: 600;
			white-space: nowrap;
			flex-shrink: 0;
		}

		.settings-role-status.set {
			color: var(--vscode-charts-green);
		}

		.settings-role-status.not-set {
			color: var(--vscode-charts-red);
		}

		.settings-role-actions {
			display: flex;
			gap: 6px;
			flex-shrink: 0;
		}

		.settings-btn {
			padding: 4px 10px;
			border: none;
			border-radius: 3px;
			cursor: pointer;
			font-size: 13px;
			font-weight: 600;
			font-family: var(--vscode-font-family);
			transition: opacity 0.15s;
		}

		.settings-btn:hover {
			opacity: 0.85;
		}

		.settings-btn:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}

		.settings-btn.set-key {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
		}

		.settings-btn.set-key:hover:not(:disabled) {
			background: var(--vscode-button-hoverBackground);
		}

		.settings-btn.clear-key {
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
		}

		.settings-footer {
			margin-top: 16px;
			padding-top: 12px;
			border-top: 1px solid var(--vscode-widget-border);
		}

		.settings-hint {
			font-size: 13px;
			color: var(--vscode-descriptionForeground);
			line-height: 1.5;
		}

		.settings-divider {
			margin: 16px 0;
			border-top: 1px solid var(--vscode-widget-border);
		}

		.settings-section {
			margin-top: 4px;
		}

		.settings-section-title {
			margin: 0 0 6px 0;
			font-size: 14px;
			font-weight: 600;
			color: var(--vscode-foreground);
		}

		.settings-btn.danger {
			background: var(--vscode-inputValidation-errorBorder, #be1100);
			color: #fff;
			margin-top: 8px;
		}

		.settings-btn.danger:hover:not(:disabled) {
			opacity: 0.85;
		}

		/* ===== PROCESSING INDICATOR ===== */

		.processing-indicator {
			display: flex;
			align-items: center;
			gap: 10px;
			padding: 10px 14px;
			margin: 8px 0;
			background: var(--vscode-welcomePage-tileBackground, var(--vscode-sideBar-background));
			border: 1px solid var(--vscode-widget-border);
			border-radius: 6px;
			font-size: 14px;
			color: var(--vscode-descriptionForeground);
			animation: processingFadeIn 0.2s ease-out;
		}

		.processing-spinner {
			width: 16px;
			height: 16px;
			border: 2px solid var(--vscode-widget-border);
			border-top-color: var(--vscode-progressBar-background, var(--vscode-button-background));
			border-radius: 50%;
			animation: processingSpinnerRotate 0.8s linear infinite;
			flex-shrink: 0;
		}

		.processing-label {
			flex: 1;
			min-width: 0;
		}

		.processing-phase {
			font-weight: 600;
			color: var(--vscode-foreground);
		}

		.processing-detail {
			margin-top: 2px;
			font-size: 13px;
			opacity: 0.8;
		}

		.cancel-btn {
			flex-shrink: 0;
			padding: 3px 10px;
			font-size: 13px;
			border: 1px solid var(--vscode-button-secondaryBorder, var(--vscode-widget-border));
			border-radius: 3px;
			background: transparent;
			color: var(--vscode-descriptionForeground);
			cursor: pointer;
			opacity: 0.7;
		}
		.cancel-btn:hover {
			opacity: 1;
			background: color-mix(in srgb, var(--vscode-errorForeground) 15%, transparent);
			color: var(--vscode-errorForeground);
			border-color: var(--vscode-errorForeground);
		}

		/* Processing cancel bar — embedded in input area above composer */
		.processing-cancel-bar {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 6px 10px;
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			background: color-mix(in srgb, var(--vscode-focusBorder) 8%, var(--vscode-editor-background));
			border-radius: 4px;
			margin-bottom: 4px;
		}
		.processing-cancel-label {
			display: flex;
			align-items: center;
			gap: 6px;
		}
		.processing-spinner-inline {
			display: inline-block;
			width: 12px;
			height: 12px;
			border: 2px solid var(--vscode-descriptionForeground);
			border-top-color: transparent;
			border-radius: 50%;
			animation: processingSpinnerRotate 0.8s linear infinite;
		}

		.processing-dots::after {
			content: '';
			animation: processingDots 1.5s steps(4, end) infinite;
		}

		@keyframes processingSpinnerRotate {
			to { transform: rotate(360deg); }
		}

		@keyframes processingFadeIn {
			from { opacity: 0; transform: translateY(4px); }
			to { opacity: 1; transform: translateY(0); }
		}

		@keyframes processingDots {
			0%   { content: ''; }
			25%  { content: '.'; }
			50%  { content: '..'; }
			75%  { content: '...'; }
			100% { content: ''; }
		}

		/* ===== COMMAND BLOCKS (Terminal-style) ===== */

		.command-block {
			margin-bottom: 10px;
			border: 1px solid var(--vscode-widget-border);
			border-radius: 4px;
			overflow: hidden;
			font-family: var(--vscode-editor-font-family, monospace);
			font-size: 13px;
			animation: processingFadeIn 0.2s ease-out;
		}

		.command-block.status-running {
			border-left: 3px solid var(--vscode-charts-blue);
		}

		.command-block.status-success {
			border-left: 3px solid var(--vscode-charts-green);
		}

		.command-block.status-error {
			border-left: 3px solid var(--vscode-charts-red);
		}

		.command-block-header {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 6px 10px;
			background: var(--vscode-textCodeBlock-background);
			cursor: pointer;
			user-select: none;
			min-height: 28px;
		}

		.command-block-header:hover {
			background: var(--vscode-list-hoverBackground);
		}

		.command-block-chevron {
			font-size: 12px;
			width: 14px;
			text-align: center;
			flex-shrink: 0;
			transition: transform 0.15s ease;
			color: var(--vscode-descriptionForeground);
		}

		.command-block.expanded .command-block-chevron {
			transform: rotate(90deg);
		}

		.command-block-icon {
			font-size: 14px;
			flex-shrink: 0;
			width: 16px;
			text-align: center;
		}

		.command-block-label {
			flex: 1;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			font-weight: 600;
			font-size: 13px;
		}

		.command-block-type {
			font-size: 11px;
			padding: 1px 5px;
			border-radius: 3px;
			background: var(--vscode-badge-background);
			color: var(--vscode-badge-foreground);
			text-transform: uppercase;
			letter-spacing: 0.3px;
			flex-shrink: 0;
		}

		.command-block-status {
			font-size: 12px;
			flex-shrink: 0;
		}

		.command-block-status.running {
			color: var(--vscode-charts-blue);
		}

		.command-block-status.success {
			color: var(--vscode-charts-green);
		}

		.command-block-status.error {
			color: var(--vscode-charts-red);
		}

		.command-block-spinner {
			display: inline-block;
			width: 10px;
			height: 10px;
			border: 1.5px solid var(--vscode-widget-border);
			border-top-color: var(--vscode-charts-blue);
			border-radius: 50%;
			animation: processingSpinnerRotate 0.8s linear infinite;
		}

		.command-block-time {
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
			flex-shrink: 0;
		}

		.command-block-review-badge {
			font-size: 10px;
			padding: 1px 6px;
			border-radius: 8px;
			background: rgba(255, 180, 0, 0.2);
			color: #ffb400;
			border: 1px solid rgba(255, 180, 0, 0.3);
			flex-shrink: 0;
			white-space: nowrap;
		}

		.command-block-body {
			display: none;
			max-height: 300px;
			overflow-y: auto;
			background: color-mix(in srgb, var(--vscode-textCodeBlock-background) 80%, var(--vscode-editor-background));
			border-top: 1px solid var(--vscode-widget-border);
		}

		.command-block.expanded .command-block-body {
			display: block;
		}

		.command-block-output {
			padding: 8px 10px;
			white-space: pre-wrap;
			word-break: break-all;
			line-height: 1.5;
			color: var(--vscode-foreground);
			font-size: 13px;
		}

		.command-block-output .cmd-line {
			display: block;
			padding: 1px 0;
		}

		.command-block-output .cmd-line.summary {
			color: var(--vscode-foreground);
		}

		.command-block-output .cmd-line.detail {
			color: var(--vscode-descriptionForeground);
			font-size: 12px;
		}

		.command-block-output .cmd-line.error {
			color: var(--vscode-charts-red);
		}

		.command-block-output .cmd-line.success {
			color: var(--vscode-charts-green);
		}

		.command-block-truncated {
			padding: 4px 10px 6px;
			text-align: center;
		}

		.command-block-truncated button {
			background: transparent;
			border: 1px solid var(--vscode-widget-border);
			color: var(--vscode-descriptionForeground);
			padding: 2px 10px;
			border-radius: 3px;
			cursor: pointer;
			font-size: 12px;
			font-family: var(--vscode-font-family);
		}

		.command-block-truncated button:hover {
			background: var(--vscode-list-hoverBackground);
			color: var(--vscode-foreground);
		}

		.command-block-body::-webkit-scrollbar {
			width: 6px;
		}

		.command-block-body::-webkit-scrollbar-track {
			background: transparent;
		}

		.command-block-body::-webkit-scrollbar-thumb {
			background: var(--vscode-scrollbarSlider-background);
			border-radius: 3px;
		}

		/* ===== RETRY ACTION BAR (inside failed command blocks) ===== */

		.command-block-actions {
			display: flex;
			gap: 8px;
			padding: 8px 12px;
			border-top: 1px solid var(--vscode-panel-border);
		}

		.command-block-retry-btn {
			padding: 4px 12px;
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
			border: none;
			border-radius: 3px;
			cursor: pointer;
			font-size: 13px;
			font-weight: 600;
			font-family: var(--vscode-font-family);
			transition: background 0.15s;
		}

		.command-block-retry-btn:hover {
			background: var(--vscode-button-secondaryHoverBackground);
		}

		.command-block-retry-btn:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}

		/* ===== STDIN EXPANDABLE BLOCKS (inside command blocks) ===== */

		.cmd-stdin-block {
			margin: 4px 0;
			border: 1px solid var(--vscode-widget-border);
			border-radius: 3px;
			overflow: hidden;
		}

		.cmd-stdin-header {
			display: flex;
			align-items: center;
			gap: 6px;
			padding: 3px 8px;
			background: color-mix(in srgb, var(--vscode-textCodeBlock-background) 60%, var(--vscode-editor-background));
			cursor: pointer;
			user-select: none;
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
		}

		.cmd-stdin-header:hover {
			background: var(--vscode-list-hoverBackground);
			color: var(--vscode-foreground);
		}

		.cmd-stdin-chevron {
			font-size: 10px;
			width: 10px;
			text-align: center;
			flex-shrink: 0;
			transition: transform 0.15s ease;
		}

		.cmd-stdin-block.expanded .cmd-stdin-chevron {
			transform: rotate(90deg);
		}

		.cmd-stdin-label {
			flex: 1;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			font-weight: 500;
		}

		.cmd-stdin-size {
			font-size: 11px;
			opacity: 0.7;
			flex-shrink: 0;
		}

		.cmd-stdin-content {
			display: none;
			max-height: 400px;
			overflow-y: auto;
			border-top: 1px solid var(--vscode-widget-border);
		}

		.cmd-stdin-block.expanded .cmd-stdin-content {
			display: block;
		}

		.cmd-stdin-content pre {
			margin: 0;
			padding: 8px 10px;
			font-family: var(--vscode-editor-font-family, monospace);
			font-size: 12px;
			line-height: 1.4;
			white-space: pre-wrap;
			word-break: break-all;
			color: var(--vscode-descriptionForeground);
			background: transparent;
		}

		.cmd-stdin-content::-webkit-scrollbar {
			width: 6px;
		}

		.cmd-stdin-content::-webkit-scrollbar-track {
			background: transparent;
		}

		.cmd-stdin-content::-webkit-scrollbar-thumb {
			background: var(--vscode-scrollbarSlider-background);
			border-radius: 3px;
		}

		/* ===== TOOL CALL CARDS (inside command blocks) ===== */

		.tool-call-card {
			margin: 6px 0;
			padding: 8px 10px;
			background: var(--vscode-textCodeBlock-background);
			border-radius: 4px;
			border-left: 3px solid var(--vscode-widget-border);
			font-family: var(--vscode-editor-font-family, monospace);
			font-size: 13px;
		}

		.tool-call-header {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 6px;
		}

		.tool-call-dot {
			width: 8px;
			height: 8px;
			border-radius: 50%;
			flex-shrink: 0;
		}

		.tool-call-dot.success {
			background: var(--vscode-charts-green);
		}

		.tool-call-dot.error {
			background: var(--vscode-charts-red);
		}

		.tool-call-dot.running {
			background: var(--vscode-charts-blue);
			animation: toolDotPulse 1.5s ease-in-out infinite;
		}

		@keyframes toolDotPulse {
			0%, 100% { opacity: 1; }
			50% { opacity: 0.4; }
		}

		.tool-call-name {
			font-weight: 700;
			font-size: 14px;
			color: var(--vscode-foreground);
		}

		.tool-call-time {
			margin-left: auto;
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
		}

		.tool-call-body {
			padding-left: 16px;
		}

		.tool-card-section {
			margin-bottom: 4px;
		}

		.tool-card-label {
			display: inline-block;
			font-size: 11px;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			padding: 1px 5px;
			border-radius: 2px;
			margin-bottom: 3px;
			background: color-mix(in srgb, var(--vscode-descriptionForeground) 20%, transparent);
			color: var(--vscode-descriptionForeground);
		}

		.tool-card-code {
			padding: 6px 8px;
			background: color-mix(in srgb, #000 30%, var(--vscode-editor-background));
			border-radius: 3px;
			white-space: pre-wrap;
			word-break: break-all;
			line-height: 1.5;
			color: var(--vscode-foreground);
			max-height: 200px;
			overflow-y: auto;
		}

		.tool-card-output {
			color: var(--vscode-descriptionForeground);
			max-height: 150px;
		}

		.tool-card-output-small {
			max-height: 80px;
			font-size: 12px;
		}

		.tool-card-inline {
			padding: 2px 0;
			color: var(--vscode-foreground);
			font-size: 13px;
		}

		.tool-card-inline code {
			padding: 1px 4px;
			background: var(--vscode-textCodeBlock-background);
			border-radius: 2px;
		}

		.tool-card-results {
			padding: 4px 8px;
			background: color-mix(in srgb, #000 20%, var(--vscode-editor-background));
			border-radius: 3px;
			white-space: pre-wrap;
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			max-height: 120px;
			overflow-y: auto;
			margin-top: 4px;
		}

		.tool-card-code::-webkit-scrollbar,
		.tool-card-results::-webkit-scrollbar {
			width: 6px;
		}

		.tool-card-code::-webkit-scrollbar-track,
		.tool-card-results::-webkit-scrollbar-track {
			background: transparent;
		}

		.tool-card-code::-webkit-scrollbar-thumb,
		.tool-card-results::-webkit-scrollbar-thumb {
			background: var(--vscode-scrollbarSlider-background);
			border-radius: 3px;
		}

		/* ===== INTAKE CONVERSATION PHASE ===== */

		/* --- Intake Turn Card (paired Human + Expert) --- */
		.intake-turn-card {
			padding: 8px 10px;
			margin-bottom: 14px;
			animation: processingFadeIn 0.2s ease-out;
		}

		.intake-turn-header {
			display: flex;
			align-items: center;
			gap: 6px;
			margin-bottom: 6px;
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
		}

		.intake-turn-number {
			font-weight: 600;
			font-family: var(--vscode-editor-font-family);
			padding: 1px 6px;
			background: var(--vscode-badge-background);
			color: var(--vscode-badge-foreground);
			border-radius: 3px;
		}

		.intake-turn-time {
			margin-left: auto;
			font-family: var(--vscode-editor-font-family);
		}

		.intake-message {
			padding: 10px 12px;
			border-radius: 6px;
			font-size: 14px;
			line-height: 1.6;
			word-wrap: break-word;
			white-space: normal;
			margin-bottom: 10px;
		}

		.intake-message + .intake-message {
			margin-top: 6px;
		}

		.intake-message-role {
			display: block;
			font-size: 12px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.3px;
			margin-bottom: 4px;
		}

		.intake-message.intake-human {
			background: color-mix(in srgb, var(--vscode-charts-blue) 8%, var(--vscode-editor-background));
			border-left: 3px solid var(--vscode-charts-blue);
		}

		.intake-message.intake-human .intake-message-role {
			color: var(--vscode-charts-blue);
		}

		.intake-message.intake-expert {
			background: color-mix(in srgb, var(--vscode-charts-yellow) 8%, var(--vscode-editor-background));
			border-left: 3px solid var(--vscode-charts-yellow);
		}

		.intake-message.intake-expert .intake-message-role {
			color: var(--vscode-charts-yellow);
		}

		/* --- Suggested Questions & Codebase Findings --- */
		.intake-suggestions,
		.intake-findings {
			margin-top: 8px;
			padding: 8px 10px;
			background: var(--vscode-textCodeBlock-background);
			border-radius: 4px;
			font-size: 13px;
		}

		.intake-suggestions-label,
		.intake-findings-label {
			font-size: 12px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.3px;
			color: var(--vscode-descriptionForeground);
			margin-bottom: 4px;
		}

		.intake-suggestions ul,
		.intake-findings ul {
			margin: 0;
			padding-left: 16px;
			list-style: disc;
		}

		.intake-suggestions li,
		.intake-findings li {
			padding: 2px 0;
			color: var(--vscode-foreground);
			line-height: 1.5;
		}

		/* --- Inline question items with Reply button --- */
		.question-item {
			display: flex;
			flex-wrap: wrap;
			align-items: baseline;
			gap: 4px 8px;
		}

		.question-item-text {
			flex: 1;
			min-width: 0;
		}

		.intake-question-response {
			flex-basis: 100%;
		}

		.intake-findings li {
			font-family: var(--vscode-editor-font-family);
			font-size: 13px;
		}

		/* --- Intake Plan Preview Card --- */
		.intake-plan-preview {
			margin-bottom: 14px;
			border-radius: 6px;
			overflow: hidden;
			animation: processingFadeIn 0.2s ease-out;
		}

		.intake-plan-preview.intake-plan-draft {
			border: 2px dashed var(--vscode-widget-border);
		}

		.intake-plan-preview.intake-plan-final {
			border: 2px solid var(--vscode-charts-green);
		}

		.intake-plan-header {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 10px 12px;
			background: var(--vscode-welcomePage-tileBackground, var(--vscode-sideBar-background));
			cursor: pointer;
			user-select: none;
		}

		.intake-plan-header:hover {
			background: var(--vscode-list-hoverBackground);
		}

		.intake-plan-icon {
			font-size: 16px;
			flex-shrink: 0;
		}

		.intake-plan-title {
			flex: 1;
			min-width: 0;
			font-size: 14px;
			font-weight: 600;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.intake-plan-version {
			font-size: 11px;
			padding: 1px 6px;
			border-radius: 10px;
			font-weight: 600;
			font-family: var(--vscode-editor-font-family);
			flex-shrink: 0;
		}

		.intake-plan-draft .intake-plan-version {
			background: color-mix(in srgb, var(--vscode-charts-yellow) 20%, transparent);
			color: var(--vscode-charts-yellow);
		}

		.intake-plan-final .intake-plan-version {
			background: color-mix(in srgb, var(--vscode-charts-green) 20%, transparent);
			color: var(--vscode-charts-green);
		}

		.intake-plan-chevron {
			font-size: 12px;
			width: 14px;
			text-align: center;
			flex-shrink: 0;
			transition: transform 0.15s ease;
			color: var(--vscode-descriptionForeground);
		}

		.intake-plan-preview.expanded .intake-plan-chevron {
			transform: rotate(90deg);
		}

		.intake-plan-body {
			display: none;
			padding: 12px;
			background: var(--vscode-editor-background);
			border-top: 1px solid var(--vscode-widget-border);
		}

		.intake-plan-preview.expanded .intake-plan-body {
			display: block;
		}

		.intake-plan-summary {
			font-size: 14px;
			line-height: 1.6;
			margin-bottom: 12px;
			color: var(--vscode-foreground);
		}

		.intake-plan-section {
			margin-bottom: 10px;
		}

		.intake-plan-section:last-child {
			margin-bottom: 0;
		}

		.intake-plan-section-title {
			font-size: 13px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.3px;
			color: var(--vscode-descriptionForeground);
			margin-bottom: 4px;
			padding-bottom: 3px;
			border-bottom: 1px solid var(--vscode-widget-border);
		}

		.intake-plan-section ul {
			margin: 0;
			padding-left: 16px;
			list-style: disc;
		}

		.intake-plan-section li {
			padding: 2px 0;
			font-size: 14px;
			line-height: 1.5;
		}

		.intake-plan-section .plan-item-type {
			display: inline-block;
			font-size: 11px;
			padding: 0 4px;
			border-radius: 2px;
			margin-right: 4px;
			font-weight: 600;
			text-transform: uppercase;
			background: var(--vscode-badge-background);
			color: var(--vscode-badge-foreground);
		}

		.intake-plan-approach {
			padding: 8px 10px;
			background: var(--vscode-textCodeBlock-background);
			border-radius: 4px;
			font-size: 14px;
			line-height: 1.6;
			white-space: pre-wrap;
		}

		.intake-plan-notes {
			padding: 8px 10px;
			background: var(--vscode-textCodeBlock-background);
			border-radius: 4px;
			font-family: var(--vscode-editor-font-family);
			font-size: 13px;
			line-height: 1.5;
		}

		.intake-plan-notes li {
			font-family: var(--vscode-editor-font-family);
		}

		/* --- Intake Approval Gate --- */
		.intake-approval-gate {
			margin-bottom: 14px;
			padding: 16px;
			background: color-mix(in srgb, var(--vscode-charts-green) 5%, var(--vscode-editor-background));
			border: 2px solid var(--vscode-charts-green);
			border-radius: 6px;
			animation: processingFadeIn 0.2s ease-out;
		}

		.intake-approval-header {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 10px;
			font-size: 15px;
			font-weight: 600;
		}

		.intake-approval-header .gate-icon {
			font-size: 20px;
		}

		.intake-approval-description {
			font-size: 14px;
			color: var(--vscode-descriptionForeground);
			line-height: 1.5;
			margin-bottom: 14px;
		}

		.intake-approval-actions {
			display: flex;
			gap: 10px;
			flex-wrap: wrap;
		}

		.intake-approval-actions .gate-btn {
			padding: 8px 18px;
			font-size: 14px;
		}

		.intake-approval-actions .gate-btn.approve {
			background: var(--vscode-charts-green);
			color: var(--vscode-editor-background);
		}

		.intake-approval-actions .gate-btn.reframe {
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
		}

		/* --- Intake Finalize Bar --- */
		.intake-finalize-bar {
			display: flex;
			align-items: center;
			gap: 10px;
			margin: 12px 0;
			padding: 10px 14px;
			background: var(--vscode-welcomePage-tileBackground, var(--vscode-sideBar-background));
			border: 1px solid var(--vscode-widget-border);
			border-radius: 6px;
			animation: processingFadeIn 0.2s ease-out;
		}

		.intake-finalize-hint {
			flex: 1;
			font-size: 13px;
			color: var(--vscode-descriptionForeground);
			line-height: 1.4;
		}

		.intake-finalize-btn {
			padding: 6px 16px;
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-size: 14px;
			font-weight: 600;
			font-family: var(--vscode-font-family);
			white-space: nowrap;
			transition: background 0.15s;
			flex-shrink: 0;
		}

		.intake-finalize-btn:hover {
			background: var(--vscode-button-hoverBackground);
		}

		.intake-finalize-btn:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}

		.intake-finalize-bar.resolved {
			opacity: 0.7;
			border-color: var(--vscode-charts-green, #89d185);
			background: color-mix(in srgb, var(--vscode-charts-green, #89d185) 5%, var(--vscode-editor-background));
		}

		/* ===== DIALOGUE NAVIGATION: RESUME, SWITCHER, SCROLL ===== */

		/* --- Resume Button (in dialogue end marker) --- */
		.resume-btn {
			padding: 3px 12px;
			font-size: 12px;
			font-weight: 600;
			font-family: var(--vscode-font-family);
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			border-radius: 10px;
			cursor: pointer;
			white-space: nowrap;
			transition: opacity 0.15s;
		}

		.resume-btn:hover {
			background: var(--vscode-button-hoverBackground);
		}

		/* --- Dialogue Marker Title (clickable) --- */
		.dialogue-marker-title {
			font-size: 14px;
			font-weight: 700;
			color: var(--vscode-charts-blue);
			cursor: pointer;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			max-width: 70%;
		}

		.dialogue-marker-title:hover {
			text-decoration: underline;
		}

		/* --- Dialogue Switcher Dropdown --- */
		.dialogue-switcher {
			position: relative;
		}

		.switcher-trigger {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			max-width: 200px;
			padding: 3px 8px;
			font-size: 13px;
			font-family: var(--vscode-font-family);
			background: transparent;
			color: var(--vscode-descriptionForeground);
			border: 1px solid var(--vscode-widget-border);
			border-radius: 3px;
			cursor: pointer;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.switcher-trigger:hover {
			background: var(--vscode-list-hoverBackground);
			color: var(--vscode-foreground);
			border-color: var(--vscode-focusBorder);
		}

		.switcher-dropdown {
			display: none;
			position: absolute;
			top: 100%;
			right: 0;
			min-width: 240px;
			max-width: 320px;
			max-height: 300px;
			overflow-y: auto;
			background: var(--vscode-editorSuggestWidget-background, var(--vscode-editor-background));
			border: 1px solid var(--vscode-editorSuggestWidget-border, var(--vscode-widget-border));
			border-radius: 4px;
			box-shadow: 0 4px 12px rgba(0,0,0,0.35);
			z-index: 300;
			margin-top: 4px;
		}

		.switcher-dropdown.visible {
			display: block;
		}

		.switcher-item {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 6px 10px;
			cursor: pointer;
			font-size: 13px;
			transition: background 0.1s;
		}

		.switcher-item:hover {
			background: var(--vscode-list-hoverBackground);
		}

		.switcher-item.selected {
			background: color-mix(in srgb, var(--vscode-charts-blue) 12%, transparent);
		}

		.switcher-status {
			font-size: 12px;
			flex-shrink: 0;
			width: 16px;
			text-align: center;
		}

		.switcher-title {
			flex: 1;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			font-weight: 500;
		}

		.switcher-phase {
			font-size: 11px;
			padding: 1px 5px;
			border-radius: 3px;
			background: var(--vscode-badge-background);
			color: var(--vscode-badge-foreground);
			text-transform: uppercase;
			letter-spacing: 0.3px;
			flex-shrink: 0;
			white-space: nowrap;
		}

		.switcher-dropdown::-webkit-scrollbar {
			width: 6px;
		}

		.switcher-dropdown::-webkit-scrollbar-track {
			background: transparent;
		}

		.switcher-dropdown::-webkit-scrollbar-thumb {
			background: var(--vscode-scrollbarSlider-background);
			border-radius: 3px;
		}

		/* --- Scroll Highlight Animation --- */
		.scroll-highlight {
			animation: scrollHighlightFlash 2s ease-out;
		}

		@keyframes scrollHighlightFlash {
			0% { background: color-mix(in srgb, var(--vscode-charts-blue) 25%, transparent); }
			100% { background: transparent; }
		}

		/* ===== MAKER: Human-Facing State Badge ===== */
		.human-facing-state-badge {
			display: inline-flex;
			align-items: center;
			gap: 6px;
			padding: 2px 10px;
			border-radius: 10px;
			font-size: 13px;
			font-weight: 600;
			white-space: nowrap;
		}

		.hfs-label {
			letter-spacing: 0.3px;
		}

		.hfs-unit {
			font-weight: 400;
			font-size: 12px;
			opacity: 0.85;
			max-width: 120px;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.hfs-understanding {
			background: color-mix(in srgb, var(--vscode-charts-blue) 15%, transparent);
			color: var(--vscode-charts-blue);
		}

		.hfs-framing {
			background: color-mix(in srgb, var(--vscode-charts-purple) 15%, transparent);
			color: var(--vscode-charts-purple);
		}

		.hfs-needs-input {
			background: color-mix(in srgb, var(--vscode-charts-yellow) 15%, transparent);
			color: var(--vscode-charts-yellow);
		}

		.hfs-planning {
			background: color-mix(in srgb, var(--vscode-charts-purple) 15%, transparent);
			color: var(--vscode-charts-purple);
		}

		.hfs-verifying {
			background: color-mix(in srgb, var(--vscode-charts-orange, #ff9800) 15%, transparent);
			color: var(--vscode-charts-orange, #ff9800);
		}

		.hfs-executing {
			background: color-mix(in srgb, var(--vscode-charts-green) 15%, transparent);
			color: var(--vscode-charts-green);
		}

		.hfs-repairing {
			background: color-mix(in srgb, var(--vscode-charts-yellow) 15%, transparent);
			color: var(--vscode-charts-yellow);
			animation: hfsRepairPulse 2s ease-in-out infinite;
		}

		@keyframes hfsRepairPulse {
			0%, 100% { opacity: 1; }
			50% { opacity: 0.7; }
		}

		.hfs-blocked {
			background: color-mix(in srgb, var(--vscode-charts-red) 15%, transparent);
			color: var(--vscode-charts-red);
		}

		.hfs-complete {
			background: color-mix(in srgb, var(--vscode-charts-green) 15%, transparent);
			color: var(--vscode-charts-green);
		}

		/* ===== MAKER: Task Graph Progress Bar ===== */
		.task-graph-progress {
			margin-bottom: 6px;
		}

		.task-graph-progress-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 3px;
		}

		.task-graph-progress-label {
			font-size: 12px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.3px;
			color: var(--vscode-descriptionForeground);
		}

		.task-graph-progress-count {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			font-family: var(--vscode-editor-font-family);
		}

		.task-graph-progress-bar {
			height: 4px;
			background: var(--vscode-widget-border);
			border-radius: 2px;
			display: flex;
			overflow: hidden;
		}

		.task-graph-bar-fill {
			height: 100%;
			transition: width 0.3s ease;
		}

		.task-graph-bar-fill.completed {
			background: var(--vscode-charts-green);
		}

		.task-graph-bar-fill.in-progress {
			background: var(--vscode-charts-blue);
			animation: taskBarPulse 1.5s ease-in-out infinite;
		}

		@keyframes taskBarPulse {
			0%, 100% { opacity: 1; }
			50% { opacity: 0.6; }
		}

		.task-graph-bar-fill.failed {
			background: var(--vscode-charts-red);
		}

		/* ===== TEXT COMMAND: System Message ===== */
		.system-message {
			display: flex;
			align-items: flex-start;
			gap: 6px;
			padding: 8px 12px;
			margin: 6px 0;
			font-size: 14px;
			color: var(--vscode-descriptionForeground);
			background: var(--vscode-editor-inactiveSelectionBackground, color-mix(in srgb, var(--vscode-foreground) 5%, transparent));
			border-radius: 4px;
			border-left: 3px solid var(--vscode-focusBorder);
		}

		.system-message-icon {
			flex-shrink: 0;
			font-size: 15px;
		}

		.system-message-body {
			flex: 1;
			min-width: 0;
		}

		.system-message-body .md-p {
			margin: 2px 0;
		}

		.system-message-body ul,
		.system-message-body ol {
			margin: 4px 0;
			padding-left: 20px;
		}

		.system-message-body li {
			margin: 2px 0;
		}

		.system-message-body code {
			background: var(--vscode-textCodeBlock-background, rgba(255,255,255,0.06));
			padding: 1px 4px;
			border-radius: 3px;
			font-family: var(--vscode-editor-font-family);
			font-size: 13px;
		}

		/* ===== Q&A Exchange Card ===== */
		.qa-exchange-card {
			margin: 6px 0;
			border-radius: 6px;
			border: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.08));
			background: var(--vscode-welcomePage-tileBackground, var(--vscode-sideBar-background));
			overflow: hidden;
		}

		.qa-exchange-question {
			display: flex;
			align-items: flex-start;
			gap: 8px;
			padding: 8px 12px;
			background: color-mix(in srgb, var(--vscode-button-background) 10%, transparent);
			border-bottom: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.06));
		}

		.qa-exchange-question-text {
			flex: 1;
			font-size: 14px;
			font-weight: 600;
			color: var(--vscode-foreground);
			min-width: 0;
		}

		.qa-exchange-answer {
			display: flex;
			align-items: flex-start;
			gap: 8px;
			padding: 8px 12px;
		}

		.qa-exchange-answer-body {
			flex: 1;
			font-size: 14px;
			color: var(--vscode-descriptionForeground);
			min-width: 0;
		}

		.qa-exchange-answer-body .md-p {
			margin: 2px 0;
		}

		.qa-exchange-answer-body ul,
		.qa-exchange-answer-body ol {
			margin: 4px 0;
			padding-left: 20px;
		}

		.qa-exchange-answer-body li {
			margin: 2px 0;
		}

		.qa-exchange-answer-body code {
			background: var(--vscode-textCodeBlock-background, rgba(255,255,255,0.06));
			padding: 1px 4px;
			border-radius: 3px;
			font-family: var(--vscode-editor-font-family);
			font-size: 13px;
		}

		.qa-exchange-icon {
			flex-shrink: 0;
			font-size: 15px;
			line-height: 1.4;
		}

		.qa-exchange-time {
			flex-shrink: 0;
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			opacity: 0.7;
		}

		/* ===== Q&A Thinking Card (Streaming Progress) ===== */
		.qa-exchange-card.qa-thinking {
			border-left: 3px solid var(--vscode-charts-blue);
		}

		.qa-thinking-spinner {
			display: inline-block;
			width: 12px;
			height: 12px;
			border: 1.5px solid var(--vscode-widget-border);
			border-top-color: var(--vscode-charts-blue);
			border-radius: 50%;
			animation: processingSpinnerRotate 0.8s linear infinite;
		}

		.qa-thinking-body {
			min-height: 20px;
			padding: 2px 0;
		}

		.qa-thinking-step {
			display: flex;
			align-items: center;
			gap: 6px;
			padding: 2px 0;
			font-size: 13px;
			color: var(--vscode-descriptionForeground);
			animation: processingFadeIn 0.2s ease-out;
		}

		.qa-thinking-step-dot {
			width: 5px;
			height: 5px;
			border-radius: 50%;
			background: var(--vscode-charts-blue);
			flex-shrink: 0;
		}

		/* ===== TEXT COMMAND: Option Chips ===== */
		.command-options-card {
			padding: 12px;
			margin: 6px 0;
			background: var(--vscode-welcomePage-tileBackground, var(--vscode-sideBar-background));
			border: 1px solid var(--vscode-widget-border);
			border-radius: 6px;
		}

		.command-options-prompt {
			font-size: 14px;
			color: var(--vscode-foreground);
			margin-bottom: 8px;
			font-weight: 600;
		}

		.command-options-chips {
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
		}

		.command-option-chip {
			padding: 6px 14px;
			font-size: 14px;
			border: 1px solid var(--vscode-button-border, var(--vscode-focusBorder));
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
			border-radius: 16px;
			cursor: pointer;
			transition: background 0.15s, border-color 0.15s;
			font-family: var(--vscode-font-family);
		}

		.command-option-chip:hover:not(:disabled) {
			background: var(--vscode-button-secondaryHoverBackground);
			border-color: var(--vscode-focusBorder);
		}

		.command-option-chip:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		.command-option-chip.was-selected {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			opacity: 0.85;
		}

		/* ===== SPEECH-TO-TEXT MIC BUTTON ===== */
		.mic-btn {
			position: relative;
			width: 24px;
			height: 24px;
			padding: 0;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			background: transparent;
			color: var(--vscode-descriptionForeground);
			border: 1px solid var(--vscode-widget-border);
			border-radius: 50%;
			cursor: pointer;
			font-size: 14px;
			transition: all 0.2s;
			flex-shrink: 0;
		}

		.mic-btn:hover:not(:disabled) {
			background: var(--vscode-toolbar-hoverBackground, rgba(90,93,94,0.31));
			color: var(--vscode-foreground);
			border-color: var(--vscode-focusBorder);
		}

		.mic-btn .mic-icon {
			line-height: 1;
		}

		.mic-btn .mic-recording-dot {
			display: none;
			position: absolute;
			top: 2px;
			right: 2px;
			width: 6px;
			height: 6px;
			background: var(--vscode-errorForeground, #f44747);
			border-radius: 50%;
		}

		/* Recording state */
		.mic-btn.recording {
			background: color-mix(in srgb, var(--vscode-errorForeground, #f44747) 15%, transparent);
			border-color: var(--vscode-errorForeground, #f44747);
			color: var(--vscode-errorForeground, #f44747);
		}

		.mic-btn.recording .mic-recording-dot {
			display: block;
			animation: micPulse 1s ease-in-out infinite;
		}

		@keyframes micPulse {
			0%, 100% { opacity: 1; transform: scale(1); }
			50% { opacity: 0.4; transform: scale(1.3); }
		}

		/* Transcribing state */
		.mic-btn.transcribing {
			opacity: 0.6;
			cursor: wait;
			border-color: var(--vscode-charts-yellow, #cca700);
		}

		.mic-btn.transcribing .mic-icon {
			animation: processingSpinnerRotate 0.8s linear infinite;
		}

		/* Error flash */
		.mic-btn.speech-error {
			border-color: var(--vscode-errorForeground, #f44747);
			color: var(--vscode-errorForeground, #f44747);
		}

		.mic-btn:disabled {
			opacity: 0.3;
			cursor: not-allowed;
		}

		/* Larger mic button in the main composer footer */
		.composer-footer-left .mic-btn {
			width: 28px;
			height: 28px;
			font-size: 16px;
		}

		/* ===== INTAKE MODE SELECTOR ===== */
		.intake-mode-selector {
			margin-bottom: 14px;
			animation: processingFadeIn 0.2s ease-out;
		}

		.intake-mode-rationale {
			font-size: 13px;
			color: var(--vscode-descriptionForeground);
			margin-bottom: 10px;
			line-height: 1.5;
		}

		.intake-mode-options {
			display: flex;
			flex-direction: column;
			gap: 6px;
		}

		.intake-mode-btn {
			display: flex;
			flex-direction: column;
			gap: 2px;
			padding: 10px 12px;
			border: 1px solid var(--vscode-widget-border);
			border-radius: 6px;
			background: var(--vscode-editor-background);
			cursor: pointer;
			text-align: left;
			transition: all 0.15s;
			font-family: var(--vscode-font-family);
		}

		.intake-mode-btn:hover:not(:disabled) {
			border-color: var(--vscode-focusBorder);
			background: var(--vscode-list-hoverBackground);
		}

		.intake-mode-btn.recommended {
			border-color: var(--vscode-charts-blue);
			background: color-mix(in srgb, var(--vscode-charts-blue) 8%, var(--vscode-editor-background));
		}

		.intake-mode-btn:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		.intake-mode-btn.was-selected {
			border-color: var(--vscode-charts-green);
			background: color-mix(in srgb, var(--vscode-charts-green) 10%, var(--vscode-editor-background));
			opacity: 1;
		}

		.intake-mode-btn-icon {
			font-size: 18px;
		}

		.intake-mode-btn-label {
			font-size: 14px;
			font-weight: 600;
			color: var(--vscode-foreground);
		}

		.intake-mode-btn-desc {
			font-size: 13px;
			color: var(--vscode-descriptionForeground);
			line-height: 1.4;
		}

		.intake-mode-recommended {
			font-size: 12px;
			font-weight: 600;
			color: var(--vscode-charts-blue);
		}

		/* ===== DOMAIN COVERAGE SIDEBAR ===== */
		.domain-coverage-sidebar {
			margin: 12px 0;
			padding: 10px 12px;
			border: 1px solid var(--vscode-widget-border);
			border-radius: 6px;
			background: var(--vscode-welcomePage-tileBackground, var(--vscode-sideBar-background));
			animation: processingFadeIn 0.2s ease-out;
		}

		.coverage-sidebar-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 6px;
		}

		.coverage-sidebar-title {
			font-size: 13px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.3px;
			color: var(--vscode-descriptionForeground);
		}

		.coverage-sidebar-pct {
			font-size: 14px;
			font-weight: 700;
			color: var(--vscode-foreground);
			font-family: var(--vscode-editor-font-family);
		}

		.coverage-sidebar-bar {
			height: 4px;
			background: var(--vscode-widget-border);
			border-radius: 2px;
			overflow: hidden;
			margin-bottom: 6px;
		}

		.coverage-bar-fill {
			height: 100%;
			background: var(--vscode-charts-green);
			border-radius: 2px;
			transition: width 0.3s ease;
		}

		.coverage-sidebar-stats {
			display: flex;
			gap: 8px;
			margin-bottom: 8px;
			font-size: 12px;
		}

		.coverage-stat {
			font-family: var(--vscode-editor-font-family);
		}

		.coverage-stat.adequate {
			color: var(--vscode-charts-green);
		}

		.coverage-stat.partial {
			color: var(--vscode-charts-yellow);
		}

		.coverage-stat.none {
			color: var(--vscode-charts-red);
		}

		.coverage-domain-list {
			display: flex;
			flex-direction: column;
			gap: 2px;
		}

		.coverage-domain-row {
			display: flex;
			align-items: center;
			gap: 6px;
			padding: 2px 4px;
			border-radius: 3px;
			font-size: 13px;
			position: relative;
		}

		.coverage-domain-row:hover {
			background: var(--vscode-list-hoverBackground);
		}

		.coverage-dot {
			width: 8px;
			height: 8px;
			border-radius: 50%;
			flex-shrink: 0;
		}

		.coverage-dot.coverage-adequate {
			background: var(--vscode-charts-green);
		}

		.coverage-dot.coverage-partial {
			background: var(--vscode-charts-yellow);
		}

		.coverage-dot.coverage-none {
			background: var(--vscode-charts-red);
			opacity: 0.5;
		}

		.coverage-domain-label {
			flex: 1;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			color: var(--vscode-foreground);
		}

		.coverage-level-tag {
			font-size: 11px;
			padding: 0 4px;
			border-radius: 3px;
			font-weight: 600;
			font-family: var(--vscode-editor-font-family);
			flex-shrink: 0;
		}

		.coverage-level-tag.coverage-adequate {
			color: var(--vscode-charts-green);
			background: color-mix(in srgb, var(--vscode-charts-green) 15%, transparent);
		}

		.coverage-level-tag.coverage-partial {
			color: var(--vscode-charts-yellow);
			background: color-mix(in srgb, var(--vscode-charts-yellow) 15%, transparent);
		}

		.coverage-level-tag.coverage-none {
			color: var(--vscode-charts-red);
			background: color-mix(in srgb, var(--vscode-charts-red) 10%, transparent);
			opacity: 0.6;
		}

		.coverage-domain-row.has-evidence {
			cursor: pointer;
		}

		.coverage-row-chevron {
			font-size: 10px;
			color: var(--vscode-descriptionForeground);
			transition: transform 0.15s ease;
			flex-shrink: 0;
			width: 10px;
			text-align: center;
		}

		.coverage-domain-row.expanded .coverage-row-chevron {
			transform: rotate(90deg);
		}

		.coverage-evidence-details {
			display: none;
			padding: 4px 8px 6px 24px;
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			border-left: 2px solid var(--vscode-widget-border);
			margin-left: 7px;
			margin-bottom: 4px;
			max-height: 150px;
			overflow-y: auto;
		}

		.coverage-evidence-details.expanded {
			display: block;
		}

		.coverage-evidence-details ul {
			margin: 0;
			padding-left: 12px;
			list-style: disc;
		}

		.coverage-evidence-details li {
			padding: 2px 0;
			line-height: 1.5;
			word-break: break-word;
		}

		.coverage-evidence-details .no-evidence {
			font-style: italic;
			opacity: 0.6;
			list-style: none;
			margin-left: -12px;
		}

		/* ===== INTAKE CHECKPOINT CARD ===== */
		.intake-checkpoint {
			margin-bottom: 14px;
			animation: processingFadeIn 0.2s ease-out;
		}

		.checkpoint-summary {
			margin-bottom: 10px;
		}

		.checkpoint-bar {
			height: 6px;
			background: var(--vscode-widget-border);
			border-radius: 3px;
			overflow: hidden;
			margin-bottom: 6px;
		}

		.checkpoint-stats {
			font-size: 13px;
			color: var(--vscode-descriptionForeground);
			font-family: var(--vscode-editor-font-family);
		}

		.checkpoint-suggestions {
			margin-bottom: 10px;
		}

		.checkpoint-suggestions-label {
			font-size: 12px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.3px;
			color: var(--vscode-descriptionForeground);
			margin-bottom: 6px;
		}

		.checkpoint-domain-btn {
			display: inline-block;
			margin: 2px 4px 2px 0;
			padding: 4px 10px;
			font-size: 13px;
			border: 1px solid var(--vscode-button-border, var(--vscode-focusBorder));
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
			border-radius: 12px;
			cursor: pointer;
			transition: background 0.15s;
			font-family: var(--vscode-font-family);
		}

		.checkpoint-domain-btn:hover:not(:disabled) {
			background: var(--vscode-button-secondaryHoverBackground);
			border-color: var(--vscode-focusBorder);
		}

		.checkpoint-domain-btn:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		.checkpoint-domain-btn.was-selected {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			opacity: 0.85;
		}

		.checkpoint-actions {
			display: flex;
			gap: 8px;
			margin-top: 8px;
		}

		.checkpoint-gap-prompt {
			margin-top: 10px;
			margin-bottom: 4px;
			font-weight: 600;
			color: var(--vscode-foreground);
			font-size: 14px;
		}

		/* ===== INTAKE GATHERING PHASE ===== */

		.gathering-turn {
			border-left-color: var(--vscode-charts-purple, #b180d7);
		}

		.gathering-turn .intake-turn-header {
			background: color-mix(in srgb, var(--vscode-charts-purple, #b180d7) 5%, var(--vscode-editor-background));
		}

		.intake-domain-badge {
			display: inline-block;
			font-size: 12px;
			font-weight: 600;
			padding: 1px 8px;
			border-radius: 10px;
			background: color-mix(in srgb, var(--vscode-charts-purple, #b180d7) 15%, transparent);
			color: var(--vscode-charts-purple, #b180d7);
			white-space: nowrap;
		}

		.intake-domain-notes {
			margin-top: 8px;
			padding: 8px 12px;
			background: color-mix(in srgb, var(--vscode-charts-purple, #b180d7) 4%, var(--vscode-textCodeBlock-background));
			border-left: 2px solid var(--vscode-charts-purple, #b180d7);
			border-radius: 3px;
		}

		.intake-domain-notes ul {
			margin: 0;
			padding-left: 16px;
		}

		.intake-domain-notes li {
			font-size: 14px;
			line-height: 1.5;
			margin-bottom: 4px;
		}

		.intake-gathering-footer {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 12px;
			margin-top: 12px;
			padding: 10px 14px;
			background: color-mix(in srgb, var(--vscode-charts-purple, #b180d7) 5%, var(--vscode-editor-background));
			border: 1px solid color-mix(in srgb, var(--vscode-charts-purple, #b180d7) 20%, var(--vscode-widget-border));
			border-radius: 6px;
		}

		.intake-gathering-guidance {
			width: 100%;
			font-size: 14px;
			color: var(--vscode-descriptionForeground);
			font-style: italic;
			line-height: 1.4;
		}

		.intake-gathering-progress {
			flex: 1;
		}

		.intake-gathering-progress-label {
			display: block;
			font-size: 13px;
			font-weight: 600;
			color: var(--vscode-charts-purple, #b180d7);
			margin-bottom: 4px;
		}

		.intake-gathering-progress-bar {
			height: 4px;
			background: var(--vscode-widget-border);
			border-radius: 2px;
			overflow: hidden;
		}

		.intake-gathering-progress-fill {
			height: 100%;
			background: var(--vscode-charts-purple, #b180d7);
			border-radius: 2px;
			transition: width 0.3s ease;
		}

		.intake-skip-gathering-btn {
			padding: 6px 14px;
			border: 1px solid var(--vscode-button-secondaryBackground);
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
			border-radius: 3px;
			cursor: pointer;
			font-size: 14px;
			font-weight: 600;
			font-family: var(--vscode-font-family);
			white-space: nowrap;
			transition: opacity 0.15s;
		}

		.intake-skip-gathering-btn:hover {
			opacity: 0.85;
		}

		.intake-skip-gathering-btn:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}

		/* ===== INTAKE DOMAIN TRANSITION CARD ===== */

		.intake-domain-transition {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 4px;
			margin: 12px 0;
			padding: 10px 16px;
			background: color-mix(in srgb, var(--vscode-charts-purple, #b180d7) 5%, var(--vscode-editor-background));
			border: 1px solid color-mix(in srgb, var(--vscode-charts-purple, #b180d7) 20%, var(--vscode-widget-border));
			border-radius: 6px;
		}

		.domain-transition-completed {
			display: flex;
			align-items: center;
			gap: 6px;
			font-size: 14px;
		}

		.domain-transition-check {
			font-size: 16px;
		}

		.domain-transition-label {
			font-weight: 600;
			color: var(--vscode-charts-green);
		}

		.domain-transition-status {
			font-size: 12px;
			padding: 1px 6px;
			border-radius: 8px;
			background: color-mix(in srgb, var(--vscode-charts-green) 15%, transparent);
			color: var(--vscode-charts-green);
		}

		.domain-transition-arrow {
			color: var(--vscode-charts-purple, #b180d7);
			font-size: 12px;
		}

		.domain-transition-next {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 2px;
		}

		.domain-transition-next-label {
			font-size: 14px;
			font-weight: 600;
			color: var(--vscode-charts-purple, #b180d7);
		}

		.domain-transition-next-desc {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			text-align: center;
		}

		/* ===== INTAKE GATHERING COMPLETE BANNER ===== */

		.intake-gathering-complete-banner {
			display: flex;
			gap: 12px;
			margin: 12px 0;
			padding: 12px 16px;
			background: color-mix(in srgb, var(--vscode-charts-green) 5%, var(--vscode-editor-background));
			border: 1px solid color-mix(in srgb, var(--vscode-charts-green) 25%, var(--vscode-widget-border));
			border-radius: 6px;
		}

		.gathering-complete-icon {
			font-size: 24px;
		}

		.gathering-complete-content {
			flex: 1;
		}

		.gathering-complete-title {
			font-size: 15px;
			font-weight: 600;
			color: var(--vscode-charts-green);
		}

		.gathering-complete-stats {
			font-size: 13px;
			color: var(--vscode-descriptionForeground);
			margin-top: 2px;
		}

		.gathering-complete-hint {
			font-size: 13px;
			font-style: italic;
			color: var(--vscode-descriptionForeground);
			margin-top: 4px;
		}

		/* ===== CURRENT DOMAIN HIGHLIGHT IN SIDEBAR ===== */

		.coverage-domain-row.current-domain {
			background: color-mix(in srgb, var(--vscode-charts-purple, #b180d7) 8%, transparent);
			border-radius: 3px;
		}

		.coverage-current-indicator {
			font-size: 10px;
			color: var(--vscode-charts-purple, #b180d7);
			margin-right: 2px;
		}

		/* ==================== ANALYSIS CARD (INVERTED FLOW) ==================== */

		.intake-analysis-card {
			margin: 12px 0;
			padding: 14px 16px;
			background: color-mix(in srgb, var(--vscode-charts-blue, #4fc1ff) 5%, var(--vscode-editor-background));
			border: 1px solid color-mix(in srgb, var(--vscode-charts-blue, #4fc1ff) 20%, var(--vscode-widget-border));
			border-radius: 6px;
		}

		.intake-analysis-header {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 10px;
		}

		.intake-analysis-icon { font-size: 18px; }

		.intake-analysis-title {
			font-size: 15px;
			font-weight: 600;
			color: var(--vscode-charts-blue, #4fc1ff);
		}

		.intake-analysis-body {
			font-size: 14px;
			line-height: 1.5;
			color: var(--vscode-foreground);
		}

		.intake-analysis-findings {
			margin-top: 10px;
			border-top: 1px solid var(--vscode-widget-border);
			padding-top: 8px;
		}

		.intake-analysis-findings-header {
			font-size: 13px;
			font-weight: 600;
			color: var(--vscode-descriptionForeground);
			cursor: pointer;
		}

		.intake-analysis-findings-list {
			margin: 6px 0 0 0;
			padding-left: 20px;
			font-size: 12px;
			font-family: var(--vscode-editor-font-family), monospace;
			color: var(--vscode-descriptionForeground);
		}

		.intake-analysis-findings-list li {
			margin-bottom: 3px;
		}

		/* ==================== PROPOSAL CARD (INVERTED FLOW) ==================== */

		/* ── Product Discovery Card (PRODUCT_REVIEW sub-state) ── */

		.intake-product-discovery-card {
			margin: 12px 0;
			padding: 16px;
			background: color-mix(in srgb, var(--vscode-charts-green, #89d185) 5%, var(--vscode-editor-background));
			border: 1px solid color-mix(in srgb, var(--vscode-charts-green, #89d185) 20%, var(--vscode-widget-border));
			border-left: 3px solid var(--vscode-charts-green, #89d185);
			border-radius: 6px;
		}

		.intake-product-discovery-header {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 12px;
		}

		.intake-product-discovery-icon { font-size: 18px; }

		.intake-product-discovery-title {
			font-size: 16px;
			font-weight: 600;
		}

		.intake-product-discovery-intro {
			margin-bottom: 12px;
			color: var(--vscode-descriptionForeground);
			font-size: 13px;
		}

		/* Product Discovery inline edit areas */
		.pd-inline-edit {
			margin-top: 6px;
		}
		.pd-inline-edit-area {
			width: 100%;
			min-height: 36px;
			padding: 6px 8px;
			font-family: var(--vscode-font-family);
			font-size: 12px;
			color: var(--vscode-input-foreground);
			background: var(--vscode-input-background);
			border: 1px solid var(--vscode-input-border, var(--vscode-widget-border));
			border-radius: 4px;
			resize: vertical;
			box-sizing: border-box;
		}
		.pd-inline-edit-area:focus {
			outline: 1px solid var(--vscode-focusBorder);
			border-color: var(--vscode-focusBorder);
		}
		.pd-inline-edit-area::placeholder {
			color: var(--vscode-input-placeholderForeground);
		}

		/* ── Proposer-Validator Cards ── */
		.proposer-card {
			margin: 12px 0;
			padding: 16px;
			border-radius: 6px;
		}
		.proposer-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
		.proposer-card-icon { font-size: 18px; }
		.proposer-card-title { font-size: 16px; font-weight: 600; }
		.proposer-card-intro { margin-bottom: 12px; color: var(--vscode-descriptionForeground); font-size: 13px; }
		.proposer-section { margin-bottom: 12px; }
		.proposer-section-label { font-weight: 600; margin-bottom: 6px; font-size: 13px; color: var(--vscode-descriptionForeground); }

		.proposer-domains-card {
			background: color-mix(in srgb, var(--vscode-charts-blue, #3794ff) 5%, var(--vscode-editor-background));
			border: 1px solid color-mix(in srgb, var(--vscode-charts-blue, #3794ff) 20%, var(--vscode-widget-border));
			border-left: 3px solid var(--vscode-charts-blue, #3794ff);
		}
		.proposer-journeys-card {
			background: color-mix(in srgb, var(--vscode-charts-purple, #b180d7) 5%, var(--vscode-editor-background));
			border: 1px solid color-mix(in srgb, var(--vscode-charts-purple, #b180d7) 20%, var(--vscode-widget-border));
			border-left: 3px solid var(--vscode-charts-purple, #b180d7);
		}
		.proposer-entities-card {
			background: color-mix(in srgb, var(--vscode-terminal-ansiCyan, #11a8cd) 5%, var(--vscode-editor-background));
			border: 1px solid color-mix(in srgb, var(--vscode-terminal-ansiCyan, #11a8cd) 20%, var(--vscode-widget-border));
			border-left: 3px solid var(--vscode-terminal-ansiCyan, #11a8cd);
		}
		.proposer-integrations-card {
			background: color-mix(in srgb, var(--vscode-charts-orange, #d18616) 5%, var(--vscode-editor-background));
			border: 1px solid color-mix(in srgb, var(--vscode-charts-orange, #d18616) 20%, var(--vscode-widget-border));
			border-left: 3px solid var(--vscode-charts-orange, #d18616);
		}

		.proposer-domain-item, .proposer-journey-item, .proposer-workflow-item,
		.proposer-entity-item, .proposer-integration-item, .proposer-persona-item {
			padding: 8px 0;
			border-bottom: 1px solid var(--vscode-widget-border);
		}
		.proposer-domain-desc, .proposer-entity-desc { font-size: 13px; margin-top: 4px; }
		.proposer-domain-meta, .proposer-entity-meta { font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 2px; }
		.proposer-domain-rationale { font-size: 12px; color: var(--vscode-descriptionForeground); font-style: italic; margin-top: 2px; }

		/* Inline MMP buttons within proposer item cards */
		.proposer-inline-mmp {
			padding: 8px 0;
			border-bottom: 1px solid var(--vscode-widget-border);
		}
		.proposer-inline-mmp .mmp-mirror-item-actions {
			margin-top: 6px;
		}
		.proposer-inline-mmp .mmp-mirror-item-edit-area {
			margin-top: 4px;
		}
		.proposer-inline-mmp .clarification-response-area {
			display: none;
			margin-top: 6px;
			padding: 6px;
			border-radius: 4px;
			background: color-mix(in srgb, var(--vscode-charts-blue) 5%, var(--vscode-editor-background));
			border: 1px solid var(--vscode-widget-border);
		}
		.proposer-inline-mmp .clarification-response-area.askmore-mode {
			display: block;
		}
		.proposer-inline-mmp .clarification-messages {
			display: none;
			max-height: 200px;
			overflow-y: auto;
			margin-bottom: 6px;
		}
		.proposer-inline-mmp .mmp-askmore {
			border-color: var(--vscode-charts-blue);
			color: var(--vscode-charts-blue);
		}

		/* Collapsible domain group sections */
		.proposer-domain-group {
			margin-bottom: 6px;
			border: 1px solid var(--vscode-widget-border);
			border-radius: 4px;
			overflow: hidden;
		}
		.proposer-domain-group-header {
			padding: 6px 12px;
			font-weight: 600;
			font-size: 13px;
			cursor: pointer;
			background: color-mix(in srgb, var(--vscode-foreground) 5%, var(--vscode-editor-background));
			list-style: none;
		}
		.proposer-domain-group-header::-webkit-details-marker { display: none; }
		.proposer-domain-group-header::before {
			content: '▶ ';
			font-size: 10px;
			transition: transform 0.15s;
			display: inline-block;
		}
		.proposer-domain-group[open] > .proposer-domain-group-header::before {
			transform: rotate(90deg);
		}
		.proposer-domain-group-count {
			font-weight: 400;
			color: var(--vscode-descriptionForeground);
		}
		.proposer-domain-group-body {
			padding: 4px 12px 8px;
		}

		/* MMP category badges for proposer types */
		.mmp-category-badge.entity { background: var(--vscode-terminal-ansiCyan, #11a8cd); }
		.mmp-category-badge.domain { background: var(--vscode-charts-blue, #3794ff); }
		.mmp-category-badge.integration { background: var(--vscode-charts-orange, #d18616); }
		.mmp-category-badge.journey { background: var(--vscode-charts-purple, #b180d7); }
		.mmp-category-badge.persona { background: var(--vscode-charts-green, #89d185); }
		.mmp-category-badge.workflow { background: var(--vscode-charts-yellow, #e5c07b); color: #000; }
		.mmp-category-badge.ux { background: var(--vscode-charts-red, #f14c4c); }

		/* ── Technical Proposal Card ── */

		.intake-proposal-card {
			margin: 12px 0;
			padding: 16px;
			background: color-mix(in srgb, var(--vscode-charts-purple, #b180d7) 5%, var(--vscode-editor-background));
			border: 1px solid color-mix(in srgb, var(--vscode-charts-purple, #b180d7) 20%, var(--vscode-widget-border));
			border-radius: 6px;
		}

		.intake-proposal-header {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 12px;
		}

		.intake-proposal-icon { font-size: 18px; }

		.intake-proposal-title {
			font-size: 16px;
			font-weight: 600;
			color: var(--vscode-charts-purple, #b180d7);
		}

		.intake-proposal-plan-title {
			font-size: 15px;
			font-weight: 600;
			color: var(--vscode-foreground);
			margin-bottom: 8px;
		}

		.intake-proposal-summary {
			font-size: 14px;
			line-height: 1.5;
			color: var(--vscode-foreground);
			margin-bottom: 12px;
		}

		.intake-proposal-approach {
			margin-bottom: 12px;
			padding: 10px 12px;
			background: color-mix(in srgb, var(--vscode-charts-purple, #b180d7) 3%, var(--vscode-editor-background));
			border-left: 3px solid var(--vscode-charts-purple, #b180d7);
			border-radius: 0 4px 4px 0;
		}

		.intake-proposal-approach-label {
			font-size: 12px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			color: var(--vscode-charts-purple, #b180d7);
			margin-bottom: 4px;
		}

		.intake-proposal-approach-body {
			font-size: 14px;
			line-height: 1.5;
			color: var(--vscode-foreground);
		}

		.intake-proposal-coverage {
			margin-bottom: 12px;
			padding: 8px 12px;
			background: color-mix(in srgb, var(--vscode-foreground) 3%, var(--vscode-editor-background));
			border-radius: 4px;
		}

		.intake-proposal-coverage-bar {
			display: flex;
			justify-content: space-between;
			align-items: center;
		}

		.intake-proposal-coverage-label {
			font-size: 13px;
			font-weight: 600;
			color: var(--vscode-foreground);
		}

		.intake-proposal-coverage-pct {
			font-size: 14px;
			font-weight: 600;
			color: var(--vscode-charts-green);
		}

		.intake-proposal-coverage-stats {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			margin-top: 2px;
		}

		.intake-proposal-footer {
			font-size: 13px;
			font-style: italic;
			color: var(--vscode-descriptionForeground);
			padding-top: 8px;
			border-top: 1px solid var(--vscode-widget-border);
		}

		/* ===== PRODUCT DISCOVERY IN PROPOSAL ===== */

		.intake-proposal-product {
			margin: 10px 0;
			border: 1px solid var(--vscode-widget-border);
			border-radius: 6px;
			overflow: hidden;
		}

		.intake-proposal-product-header {
			font-weight: 600;
			font-size: 13px;
			padding: 8px 12px;
			cursor: pointer;
			background: var(--vscode-editor-background);
		}

		.intake-proposal-product-body {
			padding: 8px 12px;
		}

		.intake-proposal-product-section {
			margin-bottom: 10px;
		}

		.intake-proposal-product-label {
			font-weight: 600;
			font-size: 12px;
			text-transform: uppercase;
			color: var(--vscode-descriptionForeground);
			margin-bottom: 4px;
		}

		.intake-proposal-product-text {
			font-size: 13px;
			line-height: 1.5;
		}

		.intake-proposal-persona {
			margin-bottom: 8px;
			padding: 6px 8px;
			background: var(--vscode-editor-background);
			border-radius: 4px;
		}

		.intake-proposal-persona-id {
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
		}

		.intake-proposal-persona-desc {
			font-size: 12px;
			margin-top: 2px;
		}

		.intake-proposal-persona-goals,
		.intake-proposal-persona-pains {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			margin-top: 2px;
		}

		.intake-proposal-journey {
			margin-bottom: 10px;
			padding: 6px 8px;
			background: var(--vscode-editor-background);
			border-radius: 4px;
		}

		.intake-proposal-journey-priority {
			font-size: 11px;
			padding: 1px 6px;
			border-radius: 3px;
			font-weight: 600;
		}

		.intake-proposal-journey-priority.badge-mvp {
			background: var(--vscode-charts-green);
			color: var(--vscode-editor-background);
		}

		.intake-proposal-journey-priority.badge-v2 {
			background: var(--vscode-charts-blue);
			color: var(--vscode-editor-background);
		}

		.intake-proposal-journey-priority.badge-future {
			background: var(--vscode-charts-yellow);
			color: var(--vscode-editor-background);
		}

		.intake-proposal-journey-scenario {
			font-size: 12px;
			margin-top: 4px;
			color: var(--vscode-descriptionForeground);
		}

		.intake-proposal-journey-steps {
			margin: 4px 0 4px 16px;
			font-size: 12px;
		}

		.intake-proposal-journey-ac {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			font-style: italic;
		}

		.intake-proposal-phasing {
			font-size: 13px;
			margin-bottom: 4px;
		}

		.intake-proposal-phasing-rationale {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
		}

		/* ===== MIRROR & MENU PROTOCOL (MMP) ===== */

		/* --- Shared MMP Card Container --- */
		.mmp-card {
			margin: 10px 0;
			border: 1px solid var(--vscode-widget-border);
			border-radius: 6px;
			overflow: hidden;
		}

		.mmp-card-header {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 8px 12px;
			font-weight: 600;
			font-size: 13px;
		}

		.mmp-card-header-icon {
			font-size: 16px;
		}

		.mmp-card-body {
			padding: 4px 12px 12px;
		}

		/* --- Mirror Card --- */
		.mmp-mirror-card .mmp-card-header {
			background: color-mix(in srgb, var(--vscode-charts-blue) 12%, transparent);
			color: var(--vscode-charts-blue);
			border-bottom: 1px solid color-mix(in srgb, var(--vscode-charts-blue) 25%, transparent);
		}

		.mmp-mirror-steelman {
			font-size: 13px;
			color: var(--vscode-foreground);
			padding: 8px 0;
			line-height: 1.5;
			font-style: italic;
			border-bottom: 1px solid var(--vscode-widget-border);
			margin-bottom: 8px;
		}

		.mmp-mirror-item {
			padding: 8px 10px;
			border: 1px solid var(--vscode-widget-border);
			border-radius: 4px;
			margin-bottom: 6px;
			transition: border-color 0.15s;
		}

		.mmp-mirror-item:hover {
			border-color: var(--vscode-focusBorder);
		}

		.mmp-mirror-item.accepted {
			border-color: var(--vscode-charts-green);
			background: color-mix(in srgb, var(--vscode-charts-green) 6%, transparent);
		}

		.mmp-mirror-item.rejected {
			border-color: var(--vscode-charts-red);
			background: color-mix(in srgb, var(--vscode-charts-red) 6%, transparent);
			opacity: 0.8;
		}

		.mmp-mirror-item.deferred {
			border-color: var(--vscode-charts-orange, #d18616);
			background: color-mix(in srgb, var(--vscode-charts-orange, #d18616) 6%, transparent);
			opacity: 0.85;
		}

		.mmp-mirror-item.edited {
			border-color: var(--vscode-charts-yellow);
			background: color-mix(in srgb, var(--vscode-charts-yellow) 6%, transparent);
		}

		.mmp-mirror-item-header {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 4px;
		}

		.mmp-mirror-item-text {
			flex: 1;
			font-size: 13px;
			line-height: 1.4;
		}
		.mmp-hidden-text {
			display: none !important;
		}

		.mmp-mirror-item-rationale {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			margin-top: 4px;
			padding-left: 10px;
			border-left: 2px solid var(--vscode-widget-border);
			display: none;
		}

		.mmp-mirror-item-rationale.visible {
			display: block;
		}

		.mmp-mirror-item-actions {
			display: flex;
			gap: 4px;
			margin-top: 6px;
		}

		.mmp-mirror-item-edit-area {
			display: none;
			margin-top: 6px;
		}

		.mmp-mirror-item-edit-area.visible {
			display: block;
		}

		.mmp-mirror-item-edit-area textarea {
			width: 100%;
			min-height: 36px;
			padding: 6px 8px;
			border: 1px solid var(--vscode-input-border);
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border-radius: 4px;
			font-family: var(--vscode-font-family);
			font-size: 13px;
			resize: vertical;
		}

		.mmp-mirror-item-edit-area textarea:focus {
			outline: 1px solid var(--vscode-focusBorder);
		}

		/* --- Category Badges --- */
		.mmp-category-badge {
			display: inline-block;
			padding: 1px 6px;
			border-radius: 3px;
			font-size: 10px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			white-space: nowrap;
			flex-shrink: 0;
		}

		.mmp-category-badge.intent {
			background: color-mix(in srgb, var(--vscode-charts-blue) 20%, transparent);
			color: var(--vscode-charts-blue);
		}

		.mmp-category-badge.scope {
			background: color-mix(in srgb, var(--vscode-charts-green) 20%, transparent);
			color: var(--vscode-charts-green);
		}

		.mmp-category-badge.constraint {
			background: color-mix(in srgb, var(--vscode-charts-orange) 20%, transparent);
			color: var(--vscode-charts-orange);
		}

		.mmp-category-badge.priority {
			background: color-mix(in srgb, var(--vscode-charts-purple) 20%, transparent);
			color: var(--vscode-charts-purple);
		}

		.mmp-category-badge.anti-goal {
			background: color-mix(in srgb, var(--vscode-charts-red) 20%, transparent);
			color: var(--vscode-charts-red);
		}

		/* --- MMP Toggle Buttons --- */
		.mmp-btn {
			padding: 2px 8px;
			border: 1px solid var(--vscode-button-secondaryBackground);
			border-radius: 3px;
			background: transparent;
			color: var(--vscode-foreground);
			cursor: pointer;
			font-size: 12px;
			font-family: var(--vscode-font-family);
			transition: all 0.15s;
		}

		.mmp-btn:hover {
			background: var(--vscode-button-secondaryHoverBackground);
		}

		.mmp-btn.mmp-accept {
			border-color: var(--vscode-charts-green);
			color: var(--vscode-charts-green);
		}

		.mmp-btn.mmp-accept.selected {
			background: var(--vscode-charts-green);
			color: var(--vscode-editor-background);
		}

		.mmp-btn.mmp-reject {
			border-color: var(--vscode-charts-red);
			color: var(--vscode-charts-red);
		}

		.mmp-btn.mmp-reject.selected {
			background: var(--vscode-charts-red);
			color: var(--vscode-editor-background);
		}

		.mmp-btn.mmp-defer {
			border-color: var(--vscode-charts-orange, #d18616);
			color: var(--vscode-charts-orange, #d18616);
		}

		.mmp-btn.mmp-defer.selected {
			background: var(--vscode-charts-orange, #d18616);
			color: var(--vscode-editor-background);
		}

		.mmp-btn.mmp-edit {
			border-color: var(--vscode-charts-yellow);
			color: var(--vscode-charts-yellow);
		}

		.mmp-btn.mmp-edit.selected {
			background: var(--vscode-charts-yellow);
			color: var(--vscode-editor-background);
		}

		.mmp-btn.mmp-rationale-toggle {
			border-color: var(--vscode-descriptionForeground);
			color: var(--vscode-descriptionForeground);
			font-size: 11px;
		}

		.mmp-btn:disabled {
			opacity: 0.5;
			cursor: default;
		}

		/* --- Resolved (read-only) state for Mirror items --- */
		.mmp-mirror-item.resolved {
			opacity: 0.8;
		}

		.mmp-mirror-item.resolved .mmp-mirror-item-actions {
			display: none;
		}

		.mmp-mirror-item.resolved .mmp-mirror-item-edit-area {
			display: none;
		}

		.mmp-resolved-badge {
			display: inline-block;
			padding: 1px 6px;
			border-radius: 3px;
			font-size: 10px;
			font-weight: 600;
			text-transform: uppercase;
		}

		.mmp-resolved-badge.accepted {
			background: color-mix(in srgb, var(--vscode-charts-green) 20%, transparent);
			color: var(--vscode-charts-green);
		}

		.mmp-resolved-badge.rejected {
			background: color-mix(in srgb, var(--vscode-charts-red) 20%, transparent);
			color: var(--vscode-charts-red);
		}

		.mmp-resolved-badge.deferred {
			background: color-mix(in srgb, var(--vscode-charts-orange, #d18616) 20%, transparent);
			color: var(--vscode-charts-orange, #d18616);
		}

		.mmp-resolved-badge.edited {
			background: color-mix(in srgb, var(--vscode-charts-yellow) 20%, transparent);
			color: var(--vscode-charts-yellow);
		}

		/* --- Menu Card --- */
		.mmp-menu-card .mmp-card-header {
			background: color-mix(in srgb, var(--vscode-charts-purple) 12%, transparent);
			color: var(--vscode-charts-purple);
			border-bottom: 1px solid color-mix(in srgb, var(--vscode-charts-purple) 25%, transparent);
		}

		.mmp-menu-item {
			margin-bottom: 12px;
		}

		.mmp-menu-item:last-child {
			margin-bottom: 0;
		}

		.mmp-menu-question {
			font-size: 13px;
			font-weight: 600;
			margin-bottom: 4px;
		}

		.mmp-menu-context {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			margin-bottom: 8px;
			line-height: 1.4;
		}

		.mmp-menu-options {
			display: flex;
			flex-direction: column;
			gap: 4px;
		}

		.mmp-option-card {
			padding: 8px 10px;
			border: 1px solid var(--vscode-widget-border);
			border-radius: 4px;
			cursor: pointer;
			transition: all 0.15s;
		}

		.mmp-option-card:hover {
			border-color: var(--vscode-focusBorder);
			background: color-mix(in srgb, var(--vscode-focusBorder) 5%, transparent);
		}

		.mmp-option-card.selected {
			border-color: var(--vscode-charts-purple);
			background: color-mix(in srgb, var(--vscode-charts-purple) 10%, transparent);
		}

		.mmp-option-card.recommended {
			border-left: 3px solid var(--vscode-charts-yellow);
		}

		.mmp-option-card.recommended.selected {
			border-left-color: var(--vscode-charts-purple);
		}

		.mmp-option-header {
			display: flex;
			align-items: center;
			gap: 6px;
			margin-bottom: 2px;
		}

		.mmp-option-radio {
			width: 14px;
			height: 14px;
			border: 2px solid var(--vscode-widget-border);
			border-radius: 50%;
			flex-shrink: 0;
			display: flex;
			align-items: center;
			justify-content: center;
		}

		.mmp-option-card.selected .mmp-option-radio {
			border-color: var(--vscode-charts-purple);
		}

		.mmp-option-card.selected .mmp-option-radio::after {
			content: '';
			width: 8px;
			height: 8px;
			border-radius: 50%;
			background: var(--vscode-charts-purple);
		}

		.mmp-option-label {
			font-size: 13px;
			font-weight: 500;
		}

		.mmp-option-recommended-badge {
			font-size: 10px;
			padding: 0px 5px;
			border-radius: 3px;
			background: color-mix(in srgb, var(--vscode-charts-yellow) 20%, transparent);
			color: var(--vscode-charts-yellow);
			font-weight: 600;
		}

		.mmp-option-description {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			margin-left: 20px;
			line-height: 1.4;
		}

		.mmp-option-tradeoffs {
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
			margin-left: 20px;
			margin-top: 2px;
			font-style: italic;
			opacity: 0.8;
		}

		/* Menu "Other" option with textarea */
		.mmp-option-card.other-option {
			border-style: dashed;
		}

		.mmp-menu-custom-textarea {
			width: 100%;
			min-height: 36px;
			padding: 6px 8px;
			border: 1px solid var(--vscode-input-border);
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border-radius: 4px;
			font-family: var(--vscode-font-family);
			font-size: 13px;
			resize: vertical;
			margin-top: 6px;
			display: none;
		}

		.mmp-option-card.other-option.selected .mmp-menu-custom-textarea {
			display: block;
		}

		.mmp-menu-custom-textarea:focus {
			outline: 1px solid var(--vscode-focusBorder);
		}

		/* Resolved menu items (read-only) */
		.mmp-menu-item.resolved .mmp-option-card {
			cursor: default;
			opacity: 0.7;
		}

		.mmp-menu-item.resolved .mmp-option-card.selected {
			opacity: 1;
		}

		.mmp-menu-item.resolved .mmp-option-card:not(.selected) {
			display: none;
		}

		/* --- Pre-Mortem Card --- */
		.mmp-premortem-card .mmp-card-header {
			background: color-mix(in srgb, var(--vscode-charts-orange) 12%, transparent);
			color: var(--vscode-charts-orange);
			border-bottom: 1px solid color-mix(in srgb, var(--vscode-charts-orange) 25%, transparent);
		}

		.mmp-premortem-summary {
			font-size: 13px;
			color: var(--vscode-foreground);
			padding: 8px 0;
			line-height: 1.5;
			border-bottom: 1px solid var(--vscode-widget-border);
			margin-bottom: 8px;
		}

		.mmp-premortem-item {
			padding: 8px 10px;
			border: 1px solid var(--vscode-widget-border);
			border-radius: 4px;
			margin-bottom: 6px;
			transition: border-color 0.15s;
		}

		.mmp-premortem-item:hover {
			border-color: var(--vscode-focusBorder);
		}

		.mmp-premortem-item.accepted {
			border-color: var(--vscode-charts-green);
			background: color-mix(in srgb, var(--vscode-charts-green) 6%, transparent);
		}

		.mmp-premortem-item.rejected {
			border-color: var(--vscode-charts-red);
			background: color-mix(in srgb, var(--vscode-charts-red) 6%, transparent);
		}

		.mmp-premortem-item-header {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 4px;
		}

		.mmp-severity-badge {
			display: inline-block;
			padding: 1px 6px;
			border-radius: 3px;
			font-size: 10px;
			font-weight: 600;
			text-transform: uppercase;
			flex-shrink: 0;
		}

		.mmp-severity-badge.low {
			background: color-mix(in srgb, var(--vscode-descriptionForeground) 20%, transparent);
			color: var(--vscode-descriptionForeground);
		}

		.mmp-severity-badge.medium {
			background: color-mix(in srgb, var(--vscode-charts-yellow) 20%, transparent);
			color: var(--vscode-charts-yellow);
		}

		.mmp-severity-badge.high {
			background: color-mix(in srgb, var(--vscode-charts-orange) 20%, transparent);
			color: var(--vscode-charts-orange);
		}

		.mmp-severity-badge.critical {
			background: color-mix(in srgb, var(--vscode-charts-red) 20%, transparent);
			color: var(--vscode-charts-red);
		}

		.mmp-premortem-assumption {
			font-size: 13px;
			font-weight: 500;
			flex: 1;
		}

		.mmp-premortem-failure {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			margin-top: 4px;
			padding-left: 10px;
			border-left: 2px solid var(--vscode-charts-orange);
			line-height: 1.4;
		}

		.mmp-premortem-mitigation {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			margin-top: 4px;
			padding-left: 10px;
			border-left: 2px solid var(--vscode-charts-green);
			line-height: 1.4;
		}

		.mmp-premortem-item-actions {
			display: flex;
			gap: 4px;
			margin-top: 6px;
		}

		.mmp-premortem-rationale-area {
			display: none;
			margin-top: 6px;
		}

		.mmp-premortem-rationale-area.visible {
			display: block;
		}

		.mmp-premortem-rationale-area textarea {
			width: 100%;
			min-height: 36px;
			padding: 6px 8px;
			border: 1px solid var(--vscode-input-border);
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border-radius: 4px;
			font-family: var(--vscode-font-family);
			font-size: 13px;
			resize: vertical;
		}

		.mmp-premortem-rationale-area textarea:focus {
			outline: 1px solid var(--vscode-focusBorder);
		}

		/* Resolved pre-mortem items */
		.mmp-premortem-item.resolved {
			opacity: 0.8;
		}

		.mmp-premortem-item.resolved .mmp-premortem-item-actions {
			display: none;
		}

		.mmp-premortem-item.resolved .mmp-premortem-rationale-area {
			display: none;
		}

		/* --- MMP Submit Bar --- */
		.mmp-submit-bar {
			display: flex;
			align-items: center;
			justify-content: flex-end;
			gap: 10px;
			padding: 8px 12px;
			margin-top: 8px;
			border-top: 1px solid var(--vscode-editorWidget-border);
		}

		.mmp-submit-progress {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
		}

		.mmp-submit-progress .complete {
			color: var(--vscode-charts-green);
		}

		.mmp-submit-btn {
			padding: 6px 16px;
			border: none;
			border-radius: 4px;
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			cursor: pointer;
			font-size: 14px;
			font-family: var(--vscode-font-family);
		}

		.mmp-submit-btn:hover {
			background: var(--vscode-button-hoverBackground);
		}

		.mmp-submit-btn:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		.mmp-submit-bar.submitted {
			opacity: 0.7;
		}

		.mmp-submit-bar.submitted .mmp-submit-btn {
			cursor: default;
		}

		/* --- MMP separator between cards --- */
		.mmp-section-separator {
			height: 1px;
			background: var(--vscode-widget-border);
			margin: 8px 0;
		}

		/* ===== FIND WIDGET ===== */
		.find-widget {
			display: none;
			position: absolute;
			top: 0;
			right: 0;
			z-index: 300;
			background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
			border: 1px solid var(--vscode-widget-border);
			border-top: none;
			border-radius: 0 0 0 6px;
			padding: 6px 8px;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
			align-items: center;
			gap: 4px;
		}
		.find-widget.visible {
			display: flex;
		}
		.find-input {
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border: 1px solid var(--vscode-input-border, var(--vscode-widget-border));
			border-radius: 3px;
			padding: 3px 6px;
			font-size: 12px;
			font-family: var(--vscode-font-family);
			width: 180px;
			outline: none;
		}
		.find-input:focus {
			border-color: var(--vscode-focusBorder);
		}
		.find-match-count {
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
			min-width: 70px;
			text-align: center;
			white-space: nowrap;
		}
		.find-btn {
			background: transparent;
			border: 1px solid transparent;
			color: var(--vscode-foreground);
			cursor: pointer;
			padding: 2px 5px;
			border-radius: 3px;
			font-size: 14px;
			line-height: 1;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		.find-btn:hover {
			background: var(--vscode-toolbar-hoverBackground);
		}
		.find-btn:active {
			background: var(--vscode-toolbar-activeBackground, var(--vscode-toolbar-hoverBackground));
		}
		mark.find-highlight {
			background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 92, 0, 0.33));
			color: inherit;
			border-radius: 2px;
			padding: 0;
		}
		mark.find-highlight-active {
			background: var(--vscode-editor-findMatchBackground, rgba(255, 150, 50, 0.6));
			outline: 1px solid var(--vscode-editor-findMatchBorder, rgba(255, 150, 50, 0.8));
		}
		.header-find-btn {
			background: transparent;
			border: none;
			color: var(--vscode-foreground);
			cursor: pointer;
			padding: 2px 6px;
			border-radius: 3px;
			font-size: 14px;
			line-height: 1;
			opacity: 0.7;
		}
		.header-find-btn:hover {
			background: var(--vscode-toolbar-hoverBackground);
			opacity: 1;
		}

		/* ===== PROCESSING: Disable all interactive elements during workflow cycles ===== */
		.stream-processing .gate-btn,
		.stream-processing .mmp-submit-btn,
		.stream-processing .mmp-btn,
		.stream-processing .mmp-option-card,
		.stream-processing .intake-approval-actions button,
		.stream-processing .intake-questions-submit-btn,
		.stream-processing .intake-finalize-btn,
		.stream-processing textarea {
			pointer-events: none !important;
			opacity: 0.5 !important;
			cursor: not-allowed !important;
		}

		/* ==================== REASONING REVIEW CARD ==================== */

		.reasoning-review-card {
			border-radius: 6px;
			padding: 12px;
			margin: 8px 0;
			border-left: 3px solid var(--vscode-editorWarning-foreground, #cca700);
			background: color-mix(in srgb, var(--vscode-editorWarning-foreground, #cca700) 6%, var(--vscode-editor-background));
		}
		.reasoning-review-card.review-severity-high {
			border-left-color: var(--vscode-errorForeground, #f44747);
			background: color-mix(in srgb, var(--vscode-errorForeground, #f44747) 6%, var(--vscode-editor-background));
		}
		.reasoning-review-card.review-severity-low {
			border-left-color: var(--vscode-charts-blue, #3794ff);
			background: color-mix(in srgb, var(--vscode-charts-blue, #3794ff) 6%, var(--vscode-editor-background));
		}
		.review-header {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 8px;
		}
		.review-icon { font-size: 16px; }
		.review-title { font-weight: 600; font-size: 14px; }
		.review-meta { margin-left: auto; font-size: 11px; color: var(--vscode-descriptionForeground); }
		.review-assessment {
			font-size: 13px;
			color: var(--vscode-descriptionForeground);
			margin-bottom: 10px;
			font-style: italic;
		}
		.review-concern {
			padding: 8px;
			border-radius: 4px;
			background: color-mix(in srgb, var(--vscode-widget-border) 30%, var(--vscode-editor-background));
			margin-bottom: 6px;
		}
		.review-concern-header {
			display: flex;
			align-items: center;
			gap: 8px;
		}
		.review-severity-badge {
			font-size: 10px;
			font-weight: 700;
			padding: 1px 6px;
			border-radius: 3px;
			text-transform: uppercase;
			letter-spacing: 0.5px;
		}
		.review-sev-high { background: var(--vscode-errorForeground, #f44747); color: #fff; }
		.review-sev-medium { background: var(--vscode-editorWarning-foreground, #cca700); color: #000; }
		.review-sev-low { background: var(--vscode-charts-blue, #3794ff); color: #fff; }
		.review-concern-summary { font-size: 13px; font-weight: 500; }
		.review-concern-details { margin-top: 6px; font-size: 12px; }
		.review-concern-details summary { cursor: pointer; color: var(--vscode-textLink-foreground); }
		.review-concern-detail, .review-concern-location, .review-concern-recommendation {
			margin-top: 4px;
			color: var(--vscode-descriptionForeground);
			line-height: 1.5;
		}
		.review-actions {
			display: flex;
			gap: 8px;
			margin-top: 10px;
			padding-top: 8px;
			border-top: 1px solid var(--vscode-widget-border);
		}
		.review-action-btn {
			font-size: 12px;
			padding: 4px 10px;
		}
		.review-guidance-area {
			margin-top: 8px;
			margin-bottom: 8px;
		}
		.review-guidance-input {
			width: 100%;
			padding: 6px 8px;
			font-size: 12px;
			font-family: var(--vscode-editor-font-family);
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border: 1px solid var(--vscode-input-border);
			border-radius: 4px;
			resize: vertical;
			margin-bottom: 6px;
		}
	`;
}
