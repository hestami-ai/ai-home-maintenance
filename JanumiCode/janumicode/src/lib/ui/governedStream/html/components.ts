/**
 * HTML Component Templates for Governed Stream
 * Each function returns an HTML string for a specific card type.
 */

import type { DialogueTurn, Claim, Verdict, Gate } from '../../../types';
import { Role, Phase, ClaimStatus, SpeechAct } from '../../../types';
import type { GovernedStreamState, ClaimHealthSummary, StreamItem, DialogueSummary } from '../dataAggregator';
import { WORKFLOW_PHASES } from '../dataAggregator';
import type { WorkflowCommandRecord, WorkflowCommandOutput } from '../../../workflow/commandStore';
import type { IntakePlanDocument, IntakeConversationTurn } from '../../../types/intake';

// ==================== HELPERS ====================

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function formatTimestamp(iso: string): string {
	try {
		// Normalize SQLite datetime('now') format ("YYYY-MM-DD HH:MM:SS", UTC but no T/Z)
		// to ISO 8601 so JavaScript Date parses it as UTC, not local time.
		let normalized = iso;
		if (iso && !iso.includes('T')) {
			normalized = iso.replace(' ', 'T') + 'Z';
		}
		const d = new Date(normalized);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	} catch {
		return iso;
	}
}

function formatPhaseLabel(phase: Phase): string {
	return phase.replace(/_/g, ' ');
}

const ROLE_ICONS: Record<string, string> = {
	[Role.HUMAN]: 'account',
	[Role.EXECUTOR]: 'terminal',
	[Role.VERIFIER]: 'shield',
	[Role.TECHNICAL_EXPERT]: 'beaker',
	[Role.HISTORIAN]: 'history',
};

const ROLE_LABELS: Record<string, string> = {
	[Role.HUMAN]: 'Human',
	[Role.EXECUTOR]: 'Executor',
	[Role.VERIFIER]: 'Verifier',
	[Role.TECHNICAL_EXPERT]: 'Tech Expert',
	[Role.HISTORIAN]: 'Historian',
};

function roleClass(role: string): string {
	return `role-${role.toLowerCase()}`;
}

function verdictClass(status: string): string {
	switch (status) {
		case ClaimStatus.VERIFIED: return 'verified';
		case ClaimStatus.DISPROVED: return 'disproved';
		case ClaimStatus.UNKNOWN: return 'unknown';
		case ClaimStatus.CONDITIONAL: return 'conditional';
		default: return 'pending';
	}
}

function verdictIcon(status: string): string {
	switch (status) {
		case ClaimStatus.VERIFIED: return '&#x2705;';
		case ClaimStatus.DISPROVED: return '&#x274C;';
		case ClaimStatus.UNKNOWN: return '&#x2753;';
		case ClaimStatus.CONDITIONAL: return '&#x26A0;';
		default: return '&#x26AA;';
	}
}

// ==================== STICKY HEADER ====================

export function renderStickyHeader(state: GovernedStreamState): string {
	const phaseSteps = renderPhaseSteps(state.currentPhase);
	const healthBar = renderClaimHealthBar(state.claimHealth);
	const switcherHtml = state.dialogueList.length > 0
		? renderDialogueSwitcher(state.dialogueList, state.activeDialogueId)
		: '';

	return `
		<div class="sticky-header">
			<div class="header-top-row">
				<span class="header-title">Governed Stream</span>
				${switcherHtml}
			</div>
			<div class="phase-stepper">${phaseSteps}</div>
			<div class="claim-health-bar">${healthBar}</div>
		</div>
	`;
}

function renderDialogueSwitcher(dialogues: DialogueSummary[], activeDialogueId: string | null): string {
	const active = dialogues.find((d) => d.dialogueId === activeDialogueId);
	let activeLabel = 'Select dialogue';
	if (active) {
		const displayText = active.title ?? active.goal;
		activeLabel = escapeHtml(displayText.substring(0, 30));
	}

	const items = dialogues.map((d) => {
		const selected = d.dialogueId === activeDialogueId ? ' selected' : '';
		const statusIcon = d.status === 'ACTIVE' ? '&#x1F7E2;' : d.status === 'COMPLETED' ? '&#x2705;' : '&#x23F9;';
		const title = escapeHtml((d.title ?? d.goal).substring(0, 40));
		const phase = escapeHtml(formatPhaseLabel(d.currentPhase));
		return `
			<div class="switcher-item${selected}" data-action="switch-dialogue" data-dialogue-id="${escapeHtml(d.dialogueId)}">
				<span class="switcher-status">${statusIcon}</span>
				<span class="switcher-title">${title}</span>
				<span class="switcher-phase">${phase}</span>
			</div>
		`;
	}).join('');

	return `
		<div class="dialogue-switcher">
			<button class="switcher-trigger" data-action="toggle-switcher" title="Switch dialogue">
				${activeLabel} &#x25BE;
			</button>
			<div class="switcher-dropdown" id="switcher-dropdown">
				${items}
			</div>
		</div>
	`;
}

function renderPhaseSteps(currentPhase: Phase): string {
	const currentIdx = WORKFLOW_PHASES.indexOf(currentPhase);
	return WORKFLOW_PHASES.map((phase, i) => {
		let dotClass = 'pending';
		let labelClass = '';
		let connectorClass = '';

		if (i < currentIdx) {
			dotClass = 'completed';
			labelClass = 'completed';
			connectorClass = 'completed';
		} else if (i === currentIdx) {
			dotClass = 'current';
			labelClass = 'current';
		}

		const connector = i < WORKFLOW_PHASES.length - 1
			? `<div class="phase-connector ${connectorClass}"></div>`
			: '';

		return `
			<div class="phase-step">
				<div class="phase-dot ${dotClass}" title="${formatPhaseLabel(phase)}"></div>
				<span class="phase-label ${labelClass}">${formatPhaseLabel(phase)}</span>
			</div>
			${connector}
		`;
	}).join('');
}

function renderClaimHealthBar(health: ClaimHealthSummary): string {
	return `
		<div class="health-item" data-action="scroll-to-status" data-status="VERIFIED">
			<span class="health-dot verified"></span>
			<span class="health-count">${health.verified}</span>
			<span class="health-label">Verified</span>
		</div>
		<div class="health-item" data-action="scroll-to-status" data-status="UNKNOWN">
			<span class="health-dot unknown"></span>
			<span class="health-count">${health.unknown}</span>
			<span class="health-label">Unknown</span>
		</div>
		<div class="health-item" data-action="scroll-to-status" data-status="DISPROVED">
			<span class="health-dot disproved"></span>
			<span class="health-count">${health.disproved}</span>
			<span class="health-label">Disproved</span>
		</div>
		<div class="health-item" data-action="scroll-to-status" data-status="OPEN">
			<span class="health-dot open"></span>
			<span class="health-count">${health.open}</span>
			<span class="health-label">Open</span>
		</div>
	`;
}

// ==================== MILESTONE DIVIDER ====================

export function renderMilestoneDivider(phase: Phase, timestamp: string): string {
	return `
		<div class="milestone-divider">
			<div class="milestone-line"></div>
			<span class="milestone-label">Entering ${formatPhaseLabel(phase)} Phase</span>
			<span class="milestone-timestamp">${formatTimestamp(timestamp)}</span>
			<div class="milestone-line"></div>
		</div>
	`;
}

// ==================== RICH CARD (Generic Turn) ====================

export function renderRichCard(turn: DialogueTurn, claims: Claim[], verdict?: Verdict): string {
	const rc = roleClass(turn.role);
	const icon = ROLE_ICONS[turn.role] ?? 'comment';
	const label = ROLE_LABELS[turn.role] ?? turn.role;

	const claimsHtml = claims.length > 0
		? `<ul class="claims-list">${claims.map((c) => renderClaimItem(c)).join('')}</ul>`
		: '';

	const verdictHtml = verdict
		? `<div style="margin-top: 8px;">${renderVerdictBadge(verdict)}</div>`
		: '';

	// Render structured content based on speech act
	const contentHtml = renderTurnContent(turn);

	return `
		<div class="rich-card ${rc} collapsible-card expanded" data-turn-id="${turn.turn_id}">
			<div class="collapsible-card-header card-header" data-action="toggle-card">
				<span class="card-chevron">&#x25B6;</span>
				<div class="card-header-left">
					<span class="role-icon codicon codicon-${icon}"></span>
					<span class="role-badge ${rc}">${escapeHtml(label)}</span>
					<span class="speech-act-tag">${escapeHtml(turn.speech_act)}</span>
				</div>
				<span class="card-timestamp">${formatTimestamp(turn.timestamp)}</span>
			</div>
			<div class="collapsible-card-body">
				${contentHtml}
				${claimsHtml}
				${verdictHtml}
			</div>
		</div>
	`;
}

/**
 * Render turn content based on speech act type.
 * ASSUMPTION turns contain JSON arrays of assumption objects.
 * CLAIM turns in PROPOSE phase contain JSON-stringified proposal text.
 * All others render as plain escaped text.
 */
function renderTurnContent(turn: DialogueTurn): string {
	if (turn.speech_act === SpeechAct.ASSUMPTION) {
		return renderAssumptionContent(turn.content_ref);
	}

	if (turn.speech_act === SpeechAct.CLAIM && turn.phase === Phase.PROPOSE) {
		return renderProposalContent(turn.content_ref);
	}

	return `<div class="card-content">${escapeHtml(turn.content_ref)}</div>`;
}

/**
 * Parse and render assumption array from content_ref JSON.
 * Falls back to plain text if parsing fails.
 */
function renderAssumptionContent(contentRef: string): string {
	try {
		const assumptions = JSON.parse(contentRef);
		if (!Array.isArray(assumptions) || assumptions.length === 0) {
			return `<div class="card-content">${escapeHtml(contentRef)}</div>`;
		}

		const items = assumptions.map((a: { statement?: string; criticality?: string; rationale?: string }) => {
			const criticality = a.criticality ?? 'UNKNOWN';
			const critClass = criticality === 'CRITICAL' ? 'critical' : 'non-critical';
			return `
				<div class="assumption-item">
					<div class="assumption-header">
						<span class="assumption-criticality ${critClass}">${escapeHtml(criticality)}</span>
						<span class="assumption-statement">${escapeHtml(a.statement ?? '')}</span>
					</div>
					${a.rationale ? `<div class="assumption-rationale">${escapeHtml(a.rationale)}</div>` : ''}
				</div>
			`;
		}).join('');

		return `<div class="assumption-list">${items}</div>`;
	} catch {
		return `<div class="card-content">${escapeHtml(contentRef)}</div>`;
	}
}

/**
 * Unwrap JSON-stringified proposal text from content_ref.
 * Falls back to raw text if parsing fails.
 */
function renderProposalContent(contentRef: string): string {
	try {
		const text = JSON.parse(contentRef);
		if (typeof text === 'string') {
			return `<div class="card-content">${escapeHtml(text)}</div>`;
		}
	} catch { /* fall through */ }
	return `<div class="card-content">${escapeHtml(contentRef)}</div>`;
}

// ==================== CLAIM ITEM ====================

function renderClaimItem(claim: Claim): string {
	const vc = verdictClass(claim.status);
	const vi = verdictIcon(claim.status);
	return `
		<li class="claim-item" data-claim-id="${escapeHtml(claim.claim_id)}">
			<span class="verdict-badge ${vc}">${vi} ${escapeHtml(claim.status)}</span>
			<span>${escapeHtml(claim.statement)}</span>
		</li>
	`;
}

// ==================== VERDICT BADGE ====================

function renderVerdictBadge(verdict: Verdict): string {
	const vc = verdictClass(verdict.verdict);
	const vi = verdictIcon(verdict.verdict);
	return `
		<span class="verdict-badge ${vc}">
			${vi} ${escapeHtml(verdict.verdict)}
		</span>
		${verdict.rationale ? `<span style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-left: 6px;">${escapeHtml(verdict.rationale)}</span>` : ''}
	`;
}

// ==================== HUMAN GATE CARD ====================

export function renderHumanGateCard(gate: Gate, blockingClaims: Claim[]): string {
	const claimsListHtml = blockingClaims.length > 0
		? blockingClaims.map((c) => `
			<li class="claim-item" data-claim-id="${escapeHtml(c.claim_id)}">
				<span class="verdict-badge ${verdictClass(c.status)}">${verdictIcon(c.status)} ${escapeHtml(c.status)}</span>
				<span>${escapeHtml(c.statement)}</span>
			</li>
		`).join('')
		: '<li class="claim-item">No specific claims linked</li>';

	return `
		<div class="gate-card collapsible-card expanded" data-gate-id="${escapeHtml(gate.gate_id)}">
			<div class="collapsible-card-header gate-header" data-action="toggle-card">
				<span class="card-chevron">&#x25B6;</span>
				<span class="gate-icon">&#x1F6A7;</span>
				<span>Human Decision Required: ${escapeHtml(gate.reason)}</span>
			</div>
			<div class="collapsible-card-body">
				<div class="gate-context">
					The workflow is blocked and requires your input before proceeding.
				</div>
				<div class="gate-blocking-claims">
					<h4>Blocking Claims</h4>
					<ul class="claims-list">${claimsListHtml}</ul>
				</div>
				<div class="gate-rationale">
					<label for="rationale-${escapeHtml(gate.gate_id)}">Rationale (required, min 10 characters)</label>
					<textarea
						id="rationale-${escapeHtml(gate.gate_id)}"
						placeholder="Explain your decision..."
						data-gate-rationale="${escapeHtml(gate.gate_id)}"
					></textarea>
					<div class="gate-char-count" id="charcount-${escapeHtml(gate.gate_id)}">0 / 10 min</div>
				</div>
				<div class="gate-actions">
					<button class="gate-btn approve" disabled data-gate-id="${escapeHtml(gate.gate_id)}" data-action="gate-decision" data-gate-action="APPROVE">Approve</button>
					<button class="gate-btn reject" disabled data-gate-id="${escapeHtml(gate.gate_id)}" data-action="gate-decision" data-gate-action="REJECT">Reject</button>
					<button class="gate-btn override" disabled data-gate-id="${escapeHtml(gate.gate_id)}" data-action="gate-decision" data-gate-action="OVERRIDE">Override</button>
					<button class="gate-btn reframe" disabled data-gate-id="${escapeHtml(gate.gate_id)}" data-action="gate-decision" data-gate-action="REFRAME">Reframe</button>
				</div>
			</div>
		</div>
	`;
}

// ==================== WARNING CARD ====================

export function renderWarningCard(message: string): string {
	return `
		<div class="warning-card collapsible-card expanded">
			<div class="collapsible-card-header warning-header" data-action="toggle-card">
				<span class="card-chevron">&#x25B6;</span>
				<span>&#x26A0;&#xFE0F;</span>
				<span>Historical Contradiction Detected</span>
			</div>
			<div class="collapsible-card-body">
				<div class="card-content">${escapeHtml(message)}</div>
			</div>
		</div>
	`;
}

// ==================== INPUT AREA ====================

const PHASE_PLACEHOLDERS: Record<Phase, string> = {
	[Phase.INTAKE]: 'Discuss your requirements with the Technical Expert...',
	[Phase.PROPOSE]: 'Waiting for proposal...',
	[Phase.ASSUMPTION_SURFACING]: 'Assumptions are being surfaced...',
	[Phase.VERIFY]: 'Verification in progress...',
	[Phase.HISTORICAL_CHECK]: 'Checking historical precedents...',
	[Phase.REVIEW]: 'Provide review feedback...',
	[Phase.EXECUTE]: 'Execution in progress...',
	[Phase.VALIDATE]: 'Validation in progress...',
	[Phase.COMMIT]: 'Ready to commit changes...',
	[Phase.REPLAN]: 'Provide rationale for replanning...',
};

export function renderInputArea(currentPhase: Phase, hasOpenGates: boolean): string {
	const placeholder = PHASE_PLACEHOLDERS[currentPhase] ?? 'Enter your message...';

	return `
		<div class="input-area">
			${hasOpenGates ? '<div class="input-actions"><span style="font-size: 11px; color: var(--vscode-charts-yellow);">&#x1F6A7; Gate is blocking — resolve above to continue</span></div>' : ''}
			<div class="input-attachments" id="input-attachments" style="display:none;"></div>
			<div class="input-row">
				<textarea
					class="input-textarea"
					id="user-input"
					placeholder="${escapeHtml(placeholder)}"
				></textarea>
				<button
					class="input-submit-btn"
					id="submit-btn"
				>Send</button>
			</div>
			<div class="input-toolbar">
				<button class="input-toolbar-btn" id="attach-file-btn" title="Attach workspace file">
					&#x1F4CE; Attach
				</button>
				<span class="input-toolbar-hint">Type <kbd>@</kbd> to mention files &middot; <kbd>&#x2191;&#x2193;</kbd> navigate &middot; <kbd>Enter</kbd> select &middot; <kbd>Esc</kbd> dismiss</span>
			</div>
		</div>
	`;
}

// ==================== DIALOGUE BOUNDARY MARKERS ====================

export function renderDialogueStartMarker(dialogueId: string, goal: string, title: string | null, timestamp: string): string {
	const displayTitle = title ?? goal.substring(0, 60);
	const showGoalSeparately = title !== null && title !== goal;

	return `
		<div class="dialogue-start-marker" id="dialogue-${escapeHtml(dialogueId)}" data-dialogue-id="${escapeHtml(dialogueId)}">
			<div class="dialogue-marker-line"></div>
			<div class="dialogue-marker-content">
				<span class="dialogue-marker-icon">&#x1F4CD;</span>
				<span class="dialogue-marker-title" data-action="scroll-to-dialogue" data-dialogue-id="${escapeHtml(dialogueId)}">${escapeHtml(displayTitle)}</span>
				<span class="dialogue-marker-time">${formatTimestamp(timestamp)}</span>
			</div>
			${showGoalSeparately ? `<div class="dialogue-marker-goal">${escapeHtml(goal)}</div>` : ''}
			<div class="dialogue-marker-line"></div>
		</div>
	`;
}

export function renderDialogueEndMarker(dialogueId: string, status: string, timestamp: string): string {
	const statusLabel = status === 'COMPLETED' ? 'Completed' : 'Abandoned';
	const statusIcon = status === 'COMPLETED' ? '&#x2705;' : '&#x23F9;';
	const statusClass = status === 'COMPLETED' ? 'completed' : 'abandoned';
	const resumeBtn = status === 'ABANDONED'
		? `<button class="resume-btn" data-action="resume-dialogue" data-dialogue-id="${escapeHtml(dialogueId)}">Resume</button>`
		: '';

	return `
		<div class="dialogue-end-marker ${statusClass}" data-dialogue-id="${escapeHtml(dialogueId)}">
			<div class="dialogue-end-line"></div>
			<span class="dialogue-end-badge">${statusIcon} ${statusLabel}</span>
			${resumeBtn}
			<span class="dialogue-end-time">${formatTimestamp(timestamp)}</span>
			<div class="dialogue-end-line"></div>
		</div>
	`;
}

// ==================== EMPTY STATE ====================

export function renderEmptyState(): string {
	return `
		<div class="empty-state">
			<div class="empty-state-icon">&#x1F4AC;</div>
			<h3>No Dialogues Yet</h3>
			<p>Start a dialogue using the input below or the command palette.</p>
			<p style="margin-top: 8px; font-size: 11px;"><strong>JanumiCode: Start New Dialogue</strong></p>
		</div>
	`;
}

// ==================== SETTINGS PANEL ====================

export function renderSettingsPanel(): string {
	return `
		<div class="settings-panel" id="settings-panel">
			<div class="settings-header">
				<h3 class="settings-title">API Key Management</h3>
				<button class="settings-close-btn" data-action="toggle-settings" title="Close settings">&times;</button>
			</div>
			<div class="settings-description">
				Configure API keys for each LLM role. Keys are stored securely in VS Code's encrypted SecretStorage.
			</div>
			<div class="settings-roles" id="settings-roles">
				<div class="settings-loading">Loading key status...</div>
			</div>
			<div class="settings-footer">
				<div class="settings-hint">
					Keys can also be set via environment variables (e.g., ANTHROPIC_API_KEY).
					Environment variables take priority over stored keys.
				</div>
			</div>
			<div class="settings-divider"></div>
			<div class="settings-section">
				<h4 class="settings-section-title">Data Management</h4>
				<div class="settings-description">
					Clear all dialogue history, claims, and workflow data. This cannot be undone.
				</div>
				<button class="settings-btn danger" data-action="clear-database">Clear All History</button>
			</div>
		</div>
	`;
}

// ==================== COMMAND BLOCK RENDERER ====================

function getCommandIcon(commandType: string): string {
	switch (commandType) {
		case 'cli_invocation': return '&#x1F4BB;';
		case 'llm_api_call': return '&#x2728;';
		case 'role_invocation': return '&#x1F916;';
		default: return '&#x2699;';
	}
}

function getCommandTypeLabel(commandType: string): string {
	switch (commandType) {
		case 'cli_invocation': return 'CLI';
		case 'llm_api_call': return 'API';
		case 'role_invocation': return 'Role';
		default: return 'CMD';
	}
}

function getStatusIcon(status: string): string {
	switch (status) {
		case 'running': return '<span class="command-block-spinner"></span>';
		case 'success': return '&#x2705;';
		case 'error': return '&#x274C;';
		default: return '';
	}
}

/**
 * Render a structured tool-call card from paired tool_input / tool_output records.
 */
function renderToolCallCard(
	toolInput: WorkflowCommandOutput,
	toolOutput: WorkflowCommandOutput | null,
): string {
	let toolName = toolInput.tool_name ?? 'Tool';
	let input = '';
	let filePath: string | undefined;

	try {
		const parsed = JSON.parse(toolInput.content);
		toolName = parsed.toolName ?? toolName;
		input = parsed.input ?? '';
		filePath = parsed.filePath;
	} catch {
		input = toolInput.content;
	}

	let output = '';
	let status: 'success' | 'error' | 'running' = toolOutput ? 'success' : 'running';

	if (toolOutput) {
		try {
			const parsed = JSON.parse(toolOutput.content);
			output = parsed.output ?? '';
			status = parsed.status === 'error' ? 'error' : 'success';
		} catch {
			output = toolOutput.content;
		}
	}

	const timestamp = formatTimestamp(toolInput.timestamp);
	const bodyHtml = buildToolCardBodyHtml(toolName, input, output, filePath, !!toolOutput);

	return `
		<div class="tool-call-card">
			<div class="tool-call-header">
				<span class="tool-call-dot ${status}"></span>
				<span class="tool-call-name">${escapeHtml(toolName)}</span>
				<span class="tool-call-time">${timestamp}</span>
			</div>
			${bodyHtml}
		</div>
	`;
}

/**
 * Render a standalone tool_output record (no preceding tool_input).
 * Extracts tool metadata from the JSON content and renders a completed card.
 */
function renderStandaloneToolOutput(record: WorkflowCommandOutput): string {
	let toolName = record.tool_name ?? 'Tool';
	let output = '';
	let input = '';
	let status: 'success' | 'error' = 'success';

	try {
		const parsed = JSON.parse(record.content);
		toolName = parsed.toolName ?? toolName;
		output = parsed.output ?? '';
		status = parsed.status === 'error' ? 'error' : 'success';
	} catch {
		output = record.content;
	}

	const timestamp = formatTimestamp(record.timestamp);
	const bodyHtml = buildToolCardBodyHtml(toolName, input, output, undefined, true);

	return `
		<div class="tool-call-card">
			<div class="tool-call-header">
				<span class="tool-call-dot ${status}"></span>
				<span class="tool-call-name">${escapeHtml(toolName)}</span>
				<span class="tool-call-time">${timestamp}</span>
			</div>
			${bodyHtml}
		</div>
	`;
}

/**
 * Build the inner body HTML for a tool card, varying layout by tool type.
 */
function buildToolCardBodyHtml(
	toolName: string,
	input: string,
	output: string,
	filePath: string | undefined,
	hasOutput: boolean,
): string {
	const lowerName = toolName.toLowerCase();

	// Bash/command_exec: IN + OUT code blocks
	if (/bash|shell|command/i.test(lowerName)) {
		let html = '';
		if (input) {
			html += `<div class="tool-card-section">` +
				`<span class="tool-card-label">IN</span>` +
				`<div class="tool-card-code">${escapeHtml(input)}</div>` +
				`</div>`;
		}
		if (hasOutput && output) {
			html += `<div class="tool-card-section">` +
				`<span class="tool-card-label">OUT</span>` +
				`<div class="tool-card-code tool-card-output">${escapeHtml(output)}</div>` +
				`</div>`;
		}
		return html;
	}

	// Read/file_read: file path inline, output as code block
	if (/read/i.test(lowerName)) {
		let html = '';
		const displayPath = filePath ?? input;
		if (displayPath) {
			html += `<div class="tool-card-inline">${escapeHtml(displayPath)}</div>`;
		}
		if (hasOutput && output) {
			html += `<div class="tool-card-section">` +
				`<span class="tool-card-label">OUT</span>` +
				`<div class="tool-card-code tool-card-output">${escapeHtml(output)}</div>` +
				`</div>`;
		}
		return html;
	}

	// Glob: pattern inline, results below
	if (/glob/i.test(lowerName)) {
		let html = '';
		if (input) {
			html += `<div class="tool-card-inline">${escapeHtml(input)}</div>`;
		}
		if (hasOutput && output) {
			html += `<div class="tool-card-results">${escapeHtml(output)}</div>`;
		}
		return html;
	}

	// Write/Edit/file_write: file path inline only
	if (/write|edit|create/i.test(lowerName)) {
		const displayPath = filePath ?? input;
		if (displayPath) {
			return `<div class="tool-card-inline">${escapeHtml(displayPath)}</div>`;
		}
		return '';
	}

	// Generic: IN and OUT code blocks
	let html = '';
	if (input) {
		html += `<div class="tool-card-section">` +
			`<span class="tool-card-label">IN</span>` +
			`<div class="tool-card-code">${escapeHtml(input)}</div>` +
			`</div>`;
	}
	if (hasOutput && output) {
		html += `<div class="tool-card-section">` +
			`<span class="tool-card-label">OUT</span>` +
			`<div class="tool-card-code tool-card-output">${escapeHtml(output)}</div>` +
			`</div>`;
	}
	return html;
}

export function renderCommandBlock(
	command: WorkflowCommandRecord,
	outputs: WorkflowCommandOutput[],
): string {
	const blockId = `cmd-${escapeHtml(command.command_id)}`;
	const expandedClass = command.collapsed ? '' : ' expanded';
	const statusClass = `status-${command.status}`;
	const icon = getCommandIcon(command.command_type);
	const typeLabel = getCommandTypeLabel(command.command_type);
	const statusIcon = getStatusIcon(command.status);
	const time = formatTimestamp(command.started_at);

	// Build output lines with tool card support for tool_input/tool_output pairs
	let outputLines = '';
	let i = 0;
	while (i < outputs.length) {
		const o = outputs[i];

		// Tool input/output pairs get structured card treatment
		if (o.line_type === 'tool_input') {
			let toolOutput: WorkflowCommandOutput | null = null;
			if (i + 1 < outputs.length && outputs[i + 1].line_type === 'tool_output') {
				toolOutput = outputs[i + 1];
				i += 2;
			} else {
				i += 1;
			}
			outputLines += renderToolCallCard(o, toolOutput);
			continue;
		}

		// Standalone tool_output (no preceding tool_input) — render as a completed card
		if (o.line_type === 'tool_output') {
			outputLines += renderStandaloneToolOutput(o);
			i += 1;
			continue;
		}

		// Existing stdin collapsible block
		if (o.line_type === 'stdin') {
			const sizeLabel = o.content.length < 1024
				? `${o.content.length} chars`
				: `${(o.content.length / 1024).toFixed(1)} KB`;
			outputLines += `<div class="cmd-stdin-block">` +
				`<div class="cmd-stdin-header" data-action="toggle-stdin">` +
					`<span class="cmd-stdin-chevron">&#x25B6;</span>` +
					`<span class="cmd-stdin-label">── stdin ──</span>` +
					`<span class="cmd-stdin-size">${sizeLabel}</span>` +
				`</div>` +
				`<div class="cmd-stdin-content"><pre>${escapeHtml(o.content)}</pre></div>` +
			`</div>`;
			i += 1;
			continue;
		}

		// Flat line rendering (summary, detail, error)
		const lineClass = o.line_type === 'error' ? 'error' : o.line_type;
		outputLines += `<span class="cmd-line ${lineClass}">${escapeHtml(o.content)}</span>`;
		i += 1;
	}

	const retryBar = command.status === 'error'
		? `<div class="command-block-actions">
				<button class="command-block-retry-btn" data-action="retry-phase">Retry</button>
			</div>`
		: '';

	return `
		<div id="${blockId}" class="command-block ${statusClass}${expandedClass}" data-command-id="${escapeHtml(command.command_id)}">
			<div class="command-block-header" data-action="toggle-command">
				<span class="command-block-chevron">&#x25B6;</span>
				<span class="command-block-icon">${icon}</span>
				<span class="command-block-label">${escapeHtml(command.label)}</span>
				<span class="command-block-type">${typeLabel}</span>
				<span class="command-block-status ${command.status}">${statusIcon}</span>
				<span class="command-block-time">${time}</span>
			</div>
			<div class="command-block-body">
				<div class="command-block-output">${outputLines}</div>
				${retryBar}
			</div>
		</div>
	`;
}

// ==================== INTAKE CONVERSATION COMPONENTS ====================

export function renderIntakeTurnCard(turn: IntakeConversationTurn, timestamp: string): string {
	const expertResponse = turn.expertResponse;
	const suggestionsHtml = expertResponse.suggestedQuestions && expertResponse.suggestedQuestions.length > 0
		? `<div class="intake-suggestions">
				<span class="intake-suggestions-label">Consider asking:</span>
				<ul>${expertResponse.suggestedQuestions.map((q) => `<li>${escapeHtml(q)}</li>`).join('')}</ul>
			</div>`
		: '';

	const findingsHtml = expertResponse.codebaseFindings && expertResponse.codebaseFindings.length > 0
		? `<div class="intake-findings">
				<span class="intake-findings-label">Codebase findings:</span>
				<ul>${expertResponse.codebaseFindings.map((f) => `<li><code>${escapeHtml(f)}</code></li>`).join('')}</ul>
			</div>`
		: '';

	const humanPreview = escapeHtml(turn.humanMessage.substring(0, 60)) + (turn.humanMessage.length > 60 ? '\u2026' : '');

	return `
		<div class="intake-turn-card collapsible-card expanded" data-intake-turn="${turn.turnNumber}">
			<div class="collapsible-card-header intake-turn-header" data-action="toggle-card">
				<span class="card-chevron">&#x25B6;</span>
				<span class="intake-turn-number">Turn ${turn.turnNumber}</span>
				<span class="intake-turn-preview">${humanPreview}</span>
				<span class="intake-turn-time">${formatTimestamp(timestamp)}</span>
			</div>
			<div class="collapsible-card-body">
				<div class="intake-message intake-human collapsible-card expanded">
					<div class="collapsible-card-header card-header" data-action="toggle-card">
						<span class="card-chevron">&#x25B6;</span>
						<div class="card-header-left">
							<span class="role-icon codicon codicon-account"></span>
							<span class="role-badge role-human">Human</span>
						</div>
					</div>
					<div class="collapsible-card-body">
						<div class="card-content">${escapeHtml(turn.humanMessage)}</div>
					</div>
				</div>
				<div class="intake-message intake-expert collapsible-card expanded" style="margin-top: 6px;">
					<div class="collapsible-card-header card-header" data-action="toggle-card">
						<span class="card-chevron">&#x25B6;</span>
						<div class="card-header-left">
							<span class="role-icon codicon codicon-beaker"></span>
							<span class="role-badge role-technical_expert">Tech Expert</span>
							<span class="intake-plan-version">Plan v${expertResponse.updatedPlan.version}</span>
						</div>
					</div>
					<div class="collapsible-card-body">
						<div class="card-content">${escapeHtml(expertResponse.conversationalResponse)}</div>
						${suggestionsHtml}
						${findingsHtml}
					</div>
				</div>
			</div>
		</div>
	`;
}

export function renderIntakePlanPreview(plan: IntakePlanDocument, isFinal: boolean): string {
	const borderClass = isFinal ? 'intake-plan-final' : 'intake-plan-draft';
	const label = isFinal ? 'Final Plan' : 'Draft Plan';

	const requirementsHtml = plan.requirements.length > 0
		? `<div class="intake-plan-section">
				<h5>Requirements (${plan.requirements.length})</h5>
				<ul>${plan.requirements.map((r) => `<li><strong>[${escapeHtml(r.id)}]</strong> ${escapeHtml(r.text)}</li>`).join('')}</ul>
			</div>`
		: '';

	const decisionsHtml = plan.decisions.length > 0
		? `<div class="intake-plan-section">
				<h5>Decisions (${plan.decisions.length})</h5>
				<ul>${plan.decisions.map((d) => `<li><strong>[${escapeHtml(d.id)}]</strong> ${escapeHtml(d.text)}</li>`).join('')}</ul>
			</div>`
		: '';

	const constraintsHtml = plan.constraints.length > 0
		? `<div class="intake-plan-section">
				<h5>Constraints (${plan.constraints.length})</h5>
				<ul>${plan.constraints.map((c) => `<li><strong>[${escapeHtml(c.id)}]</strong> ${escapeHtml(c.text)}</li>`).join('')}</ul>
			</div>`
		: '';

	const openQuestionsHtml = plan.openQuestions.length > 0
		? `<div class="intake-plan-section">
				<h5>Open Questions (${plan.openQuestions.length})</h5>
				<ul>${plan.openQuestions.map((q) => `<li><strong>[${escapeHtml(q.id)}]</strong> ${escapeHtml(q.text)}</li>`).join('')}</ul>
			</div>`
		: '';

	const approachHtml = plan.proposedApproach
		? `<div class="intake-plan-section">
				<h5>Proposed Approach</h5>
				<p>${escapeHtml(plan.proposedApproach)}</p>
			</div>`
		: '';

	return `
		<div class="intake-plan-preview ${borderClass}">
			<div class="intake-plan-header" data-action="toggle-intake-plan">
				<span class="intake-plan-chevron">&#x25B6;</span>
				<span class="intake-plan-label">${label} v${plan.version}</span>
				${plan.title ? `<span class="intake-plan-title">${escapeHtml(plan.title)}</span>` : ''}
			</div>
			<div class="intake-plan-body">
				${plan.summary ? `<p class="intake-plan-summary">${escapeHtml(plan.summary)}</p>` : ''}
				${requirementsHtml}
				${decisionsHtml}
				${constraintsHtml}
				${openQuestionsHtml}
				${approachHtml}
			</div>
		</div>
	`;
}

export function renderIntakeApprovalGate(plan: IntakePlanDocument, dialogueId: string): string {
	return `
		<div class="intake-approval-gate collapsible-card expanded" data-dialogue-id="${escapeHtml(dialogueId)}">
			<div class="collapsible-card-header gate-header" data-action="toggle-card">
				<span class="card-chevron">&#x25B6;</span>
				<span class="gate-icon">&#x1F4CB;</span>
				<span>Plan Ready for Approval</span>
			</div>
			<div class="collapsible-card-body">
				<div class="gate-context">
					The Technical Expert has synthesized your conversation into a final plan.
					Review the plan above and choose to approve or continue discussing.
				</div>
				<div class="intake-approval-actions">
					<button class="gate-btn approve" data-action="intake-approve-plan">Approve Plan</button>
					<button class="gate-btn reframe" data-action="intake-continue-discussing">Continue Discussing</button>
				</div>
			</div>
		</div>
	`;
}

export function renderIntakeFinalizeButton(): string {
	return `
		<div class="intake-finalize-bar">
			<button class="intake-finalize-btn" data-action="intake-finalize-plan">
				Finalize Plan
			</button>
			<span class="intake-finalize-hint">Synthesize conversation into a final plan for approval</span>
		</div>
	`;
}

// ==================== STREAM RENDERER ====================

export function renderStream(items: StreamItem[], intakeState?: GovernedStreamState['intakeState']): string {
	if (items.length === 0) {
		return renderEmptyState();
	}

	let html = items.map((item) => {
		switch (item.type) {
			case 'milestone':
				return renderMilestoneDivider(item.phase, item.timestamp);
			case 'turn':
				return renderRichCard(item.turn, item.claims, item.verdict);
			case 'gate':
				return renderHumanGateCard(item.gate, item.blockingClaims);
			case 'dialogue_start':
				return renderDialogueStartMarker(item.dialogueId, item.goal, item.title, item.timestamp);
			case 'dialogue_end':
				return renderDialogueEndMarker(item.dialogueId, item.status, item.timestamp);
			case 'command_block':
				return renderCommandBlock(item.command, item.outputs);
			case 'intake_turn':
				return renderIntakeTurnCard(item.turn, item.timestamp);
			case 'intake_plan_preview':
				return renderIntakePlanPreview(item.plan, item.isFinal);
			case 'intake_approval_gate':
				return renderIntakeApprovalGate(item.plan, item.dialogueId);
			default:
				return '';
		}
	}).join('');

	// Add finalize button if in DISCUSSING state with at least one turn
	if (intakeState && intakeState.subState === 'DISCUSSING' && intakeState.turnCount > 0) {
		html += renderIntakeFinalizeButton();
	}

	return html;
}
