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
			background: var(--vscode-editor-background);
		}

		/* ===== LAYOUT: 3-zone grid ===== */
		.governed-stream-container {
			display: flex;
			flex-direction: column;
			height: 100vh;
			position: relative;
		}

		/* ===== ZONE 1: STICKY HEADER ===== */
		.sticky-header {
			position: sticky;
			top: 0;
			z-index: 100;
			background: var(--vscode-editor-background);
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
			font-size: 13px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			color: var(--vscode-descriptionForeground);
		}

		.session-id {
			font-size: 11px;
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
			font-size: 9px;
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
			font-size: 11px;
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
			font-size: 11px;
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
			font-size: 10px;
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
			font-size: 14px;
		}

		.dialogue-marker-label {
			font-size: 11px;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			color: var(--vscode-charts-blue);
		}

		.dialogue-marker-id {
			font-size: 10px;
			font-family: var(--vscode-editor-font-family);
			color: var(--vscode-descriptionForeground);
			padding: 1px 6px;
			background: var(--vscode-badge-background);
			color: var(--vscode-badge-foreground);
			border-radius: 3px;
		}

		.dialogue-marker-time {
			font-size: 10px;
			color: var(--vscode-descriptionForeground);
			font-family: var(--vscode-editor-font-family);
			margin-left: auto;
		}

		.dialogue-marker-goal {
			padding: 6px 10px;
			font-size: 12px;
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
			font-size: 10px;
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
			font-size: 10px;
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
			font-size: 8px;
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
			font-size: 14px;
			width: 20px;
			text-align: center;
		}

		.role-badge {
			display: inline-block;
			padding: 2px 8px;
			border-radius: 3px;
			font-size: 10px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.3px;
		}

		.speech-act-tag {
			display: inline-block;
			padding: 1px 6px;
			border-radius: 2px;
			font-size: 9px;
			background: var(--vscode-badge-background);
			color: var(--vscode-badge-foreground);
		}

		.card-timestamp {
			font-size: 10px;
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
			font-size: 12px;
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
			font-size: 10px;
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
			font-size: 12px;
			line-height: 1.4;
		}

		.assumption-rationale {
			margin-top: 4px;
			padding-left: 2px;
			font-size: 11px;
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
			font-size: 10px;
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

		/* ===== VERIFIER EVIDENCE LOG ===== */
		.evidence-log {
			margin-top: 8px;
			max-height: 120px;
			overflow-y: auto;
			padding: 6px 8px;
			background: var(--vscode-textCodeBlock-background);
			border-radius: 3px;
			font-family: var(--vscode-editor-font-family);
			font-size: 11px;
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
			font-size: 13px;
		}

		.gate-icon {
			font-size: 16px;
		}

		.gate-context {
			font-size: 12px;
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
			font-size: 11px;
			text-transform: uppercase;
			color: var(--vscode-descriptionForeground);
			margin-bottom: 4px;
		}

		.gate-rationale {
			margin-bottom: 12px;
		}

		.gate-rationale label {
			display: block;
			font-size: 11px;
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
			font-size: 10px;
			color: var(--vscode-descriptionForeground);
			text-align: right;
			margin-top: 2px;
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
			font-size: 12px;
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
			font-size: 12px;
			margin-bottom: 6px;
		}

		/* ===== ZONE 3: CONTEXTUAL INPUT AREA ===== */
		.input-area {
			position: sticky;
			bottom: 0;
			z-index: 100;
			background: var(--vscode-editor-background);
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
			font-size: 11px;
			font-family: var(--vscode-font-family);
			transition: all 0.15s;
		}

		.input-action-btn:hover {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
		}

		.input-row {
			display: flex;
			gap: 8px;
			align-items: flex-end;
		}

		.input-textarea {
			flex: 1;
			min-height: 36px;
			max-height: 120px;
			padding: 8px 10px;
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border: 1px solid var(--vscode-input-border, var(--vscode-widget-border));
			border-radius: 3px;
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			resize: none;
			line-height: 1.4;
		}

		.input-textarea:focus {
			outline: none;
			border-color: var(--vscode-focusBorder);
		}

		.input-submit-btn {
			padding: 8px 16px;
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			border-radius: 3px;
			cursor: pointer;
			font-size: 12px;
			font-weight: 600;
			font-family: var(--vscode-font-family);
			white-space: nowrap;
		}

		.input-submit-btn:hover {
			background: var(--vscode-button-hoverBackground);
		}

		.input-submit-btn:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}

		/* --- Input Toolbar --- */
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
			font-size: 11px;
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
			font-size: 10px;
			color: var(--vscode-descriptionForeground);
			margin-left: auto;
			opacity: 0.6;
			line-height: 1.4;
		}

		.input-toolbar-hint kbd {
			display: inline-block;
			padding: 0 4px;
			font-size: 10px;
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
			font-size: 11px;
			max-width: 260px;
			white-space: nowrap;
			transition: opacity 0.15s;
		}

		.attachment-chip:hover {
			opacity: 0.85;
		}

		.attachment-chip .chip-icon {
			font-size: 12px;
			flex-shrink: 0;
		}

		.attachment-chip .chip-folder {
			color: var(--vscode-badge-foreground);
			opacity: 0.6;
			font-size: 10px;
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
			font-size: 14px;
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
			font-size: 10px;
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
			font-size: 12px;
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
			font-size: 13px;
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
			font-size: 9px;
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
			font-size: 14px;
			margin-bottom: 6px;
			color: var(--vscode-foreground);
		}

		.empty-state p {
			font-size: 12px;
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
			font-size: 14px;
			font-weight: 600;
			color: var(--vscode-foreground);
			margin: 0;
		}

		.settings-close-btn {
			background: none;
			border: none;
			color: var(--vscode-foreground);
			font-size: 18px;
			cursor: pointer;
			padding: 2px 6px;
			border-radius: 3px;
			line-height: 1;
		}

		.settings-close-btn:hover {
			background: var(--vscode-list-hoverBackground);
		}

		.settings-description {
			font-size: 12px;
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
			font-size: 12px;
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
			font-size: 13px;
			font-weight: 600;
			color: var(--vscode-foreground);
			margin-bottom: 2px;
		}

		.settings-role-provider {
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
		}

		.settings-role-status {
			display: flex;
			align-items: center;
			gap: 4px;
			font-size: 11px;
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
			font-size: 11px;
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
			font-size: 11px;
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
			font-size: 12px;
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
			font-size: 12px;
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
			font-size: 11px;
			opacity: 0.8;
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
			font-size: 11px;
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
			font-size: 10px;
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
			font-size: 12px;
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
			font-size: 11px;
		}

		.command-block-type {
			font-size: 9px;
			padding: 1px 5px;
			border-radius: 3px;
			background: var(--vscode-badge-background);
			color: var(--vscode-badge-foreground);
			text-transform: uppercase;
			letter-spacing: 0.3px;
			flex-shrink: 0;
		}

		.command-block-status {
			font-size: 10px;
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
			font-size: 9px;
			color: var(--vscode-descriptionForeground);
			flex-shrink: 0;
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
			font-size: 11px;
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
			font-size: 10px;
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
			font-size: 10px;
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
			font-size: 11px;
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
			font-size: 10px;
			color: var(--vscode-descriptionForeground);
		}

		.cmd-stdin-header:hover {
			background: var(--vscode-list-hoverBackground);
			color: var(--vscode-foreground);
		}

		.cmd-stdin-chevron {
			font-size: 8px;
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
			font-size: 9px;
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
			font-size: 10px;
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
			font-size: 11px;
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
			font-size: 12px;
			color: var(--vscode-foreground);
		}

		.tool-call-time {
			margin-left: auto;
			font-size: 9px;
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
			font-size: 9px;
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
			font-size: 10px;
		}

		.tool-card-inline {
			padding: 2px 0;
			color: var(--vscode-foreground);
			font-size: 11px;
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
			font-size: 10px;
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
			margin-bottom: 14px;
			animation: processingFadeIn 0.2s ease-out;
		}

		.intake-turn-header {
			display: flex;
			align-items: center;
			gap: 6px;
			margin-bottom: 6px;
			font-size: 10px;
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
			font-size: 12px;
			line-height: 1.6;
			word-wrap: break-word;
			white-space: pre-wrap;
		}

		.intake-message + .intake-message {
			margin-top: 6px;
		}

		.intake-message-role {
			display: block;
			font-size: 10px;
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
			font-size: 11px;
		}

		.intake-suggestions-label,
		.intake-findings-label {
			font-size: 10px;
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

		.intake-findings li {
			font-family: var(--vscode-editor-font-family);
			font-size: 11px;
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
			font-size: 14px;
			flex-shrink: 0;
		}

		.intake-plan-title {
			flex: 1;
			min-width: 0;
			font-size: 12px;
			font-weight: 600;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.intake-plan-version {
			font-size: 9px;
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
			font-size: 10px;
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
			font-size: 12px;
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
			font-size: 11px;
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
			font-size: 12px;
			line-height: 1.5;
		}

		.intake-plan-section .plan-item-type {
			display: inline-block;
			font-size: 9px;
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
			font-size: 12px;
			line-height: 1.6;
			white-space: pre-wrap;
		}

		.intake-plan-notes {
			padding: 8px 10px;
			background: var(--vscode-textCodeBlock-background);
			border-radius: 4px;
			font-family: var(--vscode-editor-font-family);
			font-size: 11px;
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
			font-size: 13px;
			font-weight: 600;
		}

		.intake-approval-header .gate-icon {
			font-size: 18px;
		}

		.intake-approval-description {
			font-size: 12px;
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
			font-size: 12px;
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
			font-size: 11px;
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
			font-size: 12px;
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

		/* ===== DIALOGUE NAVIGATION: RESUME, SWITCHER, SCROLL ===== */

		/* --- Resume Button (in dialogue end marker) --- */
		.resume-btn {
			padding: 3px 12px;
			font-size: 10px;
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
			font-size: 12px;
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
			font-size: 11px;
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
			font-size: 11px;
			transition: background 0.1s;
		}

		.switcher-item:hover {
			background: var(--vscode-list-hoverBackground);
		}

		.switcher-item.selected {
			background: color-mix(in srgb, var(--vscode-charts-blue) 12%, transparent);
		}

		.switcher-status {
			font-size: 10px;
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
			font-size: 9px;
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
	`;
}
