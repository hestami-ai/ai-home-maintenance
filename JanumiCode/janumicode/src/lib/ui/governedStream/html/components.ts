/**

 * HTML Component Templates for Governed Stream

 * Each function returns an HTML string for a specific card type.

 */



import type { DialogueTurn, Claim, Verdict, Gate } from '../../../types';

import { Role, Phase, ClaimStatus, GateStatus, SpeechAct } from '../../../types';

import type { GovernedStreamState, ClaimHealthSummary, StreamItem, DialogueSummary, ReviewItem, ReviewSummary } from '../dataAggregator';

import { WORKFLOW_PHASES } from '../dataAggregator';

import { getHumanFacingStateClass } from '../../../workflow/humanFacingState';

import type { WorkflowCommandRecord, WorkflowCommandOutput } from '../../../workflow/commandStore';

import type { IntakePlanDocument, IntakeConversationTurn, IntakeGatheringTurnResponse } from '../../../types/intake';
import { isGatheringResponse } from '../../../types/intake';
import type { IntakeModeRecommendation, DomainCoverageMap, IntakeCheckpoint } from '../../../types';
import { IntakeMode, DomainCoverageLevel } from '../../../types';
import { DOMAIN_INFO, DOMAIN_SEQUENCE } from '../../../workflow/domainCoverageTracker';



// ==================== HELPERS ====================



function escapeHtml(str: string): string {

	return str

		.replace(/&/g, '&amp;')

		.replace(/</g, '&lt;')

		.replace(/>/g, '&gt;')

		.replace(/"/g, '&quot;')

		.replace(/'/g, '&#039;');

}



/**
 * Render the "Ask More" toggle button for a response toolbar.
 * Clicking switches the textarea between "Respond" and "Ask More" modes.
 */
function renderAskMoreToggle(itemId: string, itemContext: string): string {
	const escaped = escapeHtml(itemId);
	const escapedCtx = escapeHtml(itemContext);
	return `<button class="ask-more-toggle" data-action="toggle-askmore"
		data-clarification-item="${escaped}"
		data-clarification-context="${escapedCtx}">Ask More</button>`;
}

// ===== Speech-to-Text Mic Button =====

let _speechEnabled = false;
let _soxAvailable = false;

/** Called by GovernedStreamPanel before rendering to control mic button visibility. */
export function setSpeechEnabled(enabled: boolean): void {
	_speechEnabled = enabled;
}

/** Called by GovernedStreamPanel before rendering to control mic button disabled state. */
export function setSoxAvailable(available: boolean): void {
	_soxAvailable = available;
}

/** Render a mic button for a specific input area. Returns empty string if speech is disabled. */
function renderMicButton(targetInputId: string): string {
	if (!_speechEnabled) { return ''; }
	const disabled = !_soxAvailable ? ' disabled' : '';
	const title = _soxAvailable
		? 'Click to record voice input'
		: 'Speech-to-text requires SoX. Install the SoX &quot;rec&quot; command to enable.';
	return `<button class="mic-btn" data-action="toggle-speech"
		data-speech-target="${escapeHtml(targetInputId)}"
		title="${title}"${disabled}>
		<span class="mic-icon">&#x1F3A4;</span>
		<span class="mic-recording-dot"></span>
	</button>`;
}

/**
 * Lightweight markdown-to-HTML converter for turn content.
 * Handles headings, bold, italic, inline code, fenced code blocks,
 * unordered lists, and horizontal rules. Input is escaped first for safety.
 */
function simpleMarkdownToHtml(md: string): string {
	const escaped = escapeHtml(md);
	const lines = escaped.split('\n');
	const out: string[] = [];
	let inCodeBlock = false;
	let inList = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Fenced code blocks (``` )
		if (line.trimStart().startsWith('```')) {
			if (inList) { out.push('</ul>'); inList = false; }
			if (inCodeBlock) {
				out.push('</code></pre>');
				inCodeBlock = false;
			} else {
				out.push('<pre><code>');
				inCodeBlock = true;
			}
			continue;
		}
		if (inCodeBlock) {
			out.push(line);
			continue;
		}

		// Blank line — close list if open
		if (line.trim() === '') {
			if (inList) { out.push('</ul>'); inList = false; }
			continue;
		}

		// Horizontal rule
		if (/^-{3,}$/.test(line.trim())) {
			if (inList) { out.push('</ul>'); inList = false; }
			out.push('<hr>');
			continue;
		}

		// Headings
		const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
		if (headingMatch) {
			if (inList) { out.push('</ul>'); inList = false; }
			const level = headingMatch[1].length;
			out.push(`<h${level}>${applyInlineFormatting(headingMatch[2])}</h${level}>`);
			continue;
		}

		// Unordered list items (- item)
		const listMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
		if (listMatch) {
			if (!inList) { out.push('<ul>'); inList = true; }
			out.push(`<li>${applyInlineFormatting(listMatch[2])}</li>`);
			continue;
		}

		// Paragraph text
		if (inList) { out.push('</ul>'); inList = false; }
		out.push(`<p>${applyInlineFormatting(line)}</p>`);
	}

	if (inCodeBlock) { out.push('</code></pre>'); }
	if (inList) { out.push('</ul>'); }

	return out.join('\n');
}

/** Apply inline markdown formatting (bold, italic, inline code) to already-escaped text. */
function applyInlineFormatting(text: string): string {
	return text
		// Inline code: `code`
		.replace(/`([^`]+)`/g, '<code>$1</code>')
		// Bold: **text** or __text__
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/__([^_]+)__/g, '<strong>$1</strong>')
		// Italic: *text* or _text_
		.replace(/\*([^*]+)\*/g, '<em>$1</em>')
		.replace(/\b_([^_]+)_\b/g, '<em>$1</em>');
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

function adjudicationClass(verdict: string): string {
	switch (verdict) {
		case 'CONSISTENT': return 'consistent';
		case 'INCONSISTENT': return 'inconsistent';
		case 'CONDITIONAL': return 'adj-conditional';
		case 'UNKNOWN': return 'adj-unknown';
		default: return 'adj-unknown';
	}
}

function adjudicationIcon(verdict: string): string {
	switch (verdict) {
		case 'CONSISTENT': return '&#x1F3DB;';
		case 'INCONSISTENT': return '&#x26D4;';
		case 'CONDITIONAL': return '&#x26A0;';
		case 'UNKNOWN': return '&#x2753;';
		default: return '&#x2753;';
	}
}

function renderAdjudicationDetails(adj: NonNullable<ReviewItem['adjudication']>): string {
	let html = '<div class="review-item-adjudication">';
	html += `<div class="adjudication-rationale">Historian: ${escapeHtml(adj.rationale)}</div>`;

	if (adj.citations.length > 0) {
		html += '<div class="adjudication-citations">';
		for (const cite of adj.citations) {
			html += `<span class="citation-tag">${escapeHtml(cite)}</span>`;
		}
		html += '</div>';
	}

	if (adj.conflicts && adj.conflicts.length > 0) {
		html += '<div class="adjudication-conflicts"><strong>Conflicts:</strong><ul>';
		for (const conflict of adj.conflicts) {
			html += `<li>${escapeHtml(conflict)}</li>`;
		}
		html += '</ul></div>';
	}

	if (adj.conditions && adj.conditions.length > 0) {
		html += '<div class="adjudication-conditions"><strong>Conditions:</strong><ul>';
		for (const cond of adj.conditions) {
			html += `<li>${escapeHtml(cond)}</li>`;
		}
		html += '</ul></div>';
	}

	if (adj.verification_queries && adj.verification_queries.length > 0) {
		html += '<div class="adjudication-queries"><strong>Missing evidence:</strong><ul>';
		for (const q of adj.verification_queries) {
			html += `<li>${escapeHtml(q)}</li>`;
		}
		html += '</ul></div>';
	}

	html += '</div>';
	return html;
}


// ==================== STICKY HEADER ====================



export function renderStickyHeader(state: GovernedStreamState): string {

	const phaseSteps = renderPhaseSteps(state.currentPhase);

	const healthBar = renderClaimHealthBar(state.claimHealth);

	const switcherHtml = state.dialogueList.length > 0

		? renderDialogueSwitcher(state.dialogueList, state.activeDialogueId)

		: '';

	const humanStateHtml = renderHumanFacingStateBadge(state);

	const taskProgressHtml = renderTaskGraphProgressBar(state);

	return `

		<div class="sticky-header">

			<div class="header-top-row">

				<span class="header-title">Governed Stream</span>

				${humanStateHtml}

				${switcherHtml}

			</div>

			<div class="phase-stepper">${phaseSteps}</div>

			${taskProgressHtml}

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



// ==================== HUMAN-FACING STATE BADGE ====================

function renderHumanFacingStateBadge(state: GovernedStreamState): string {
	if (!state.humanFacingState) {
		return '';
	}

	const hfs = state.humanFacingState;
	const stateClass = getHumanFacingStateClass(hfs.state);

	return `
		<div class="human-facing-state-badge hfs-${stateClass}" title="${escapeHtml(hfs.detail)}">
			<span class="hfs-label">${escapeHtml(hfs.state)}</span>
			${hfs.currentUnit ? `<span class="hfs-unit">${escapeHtml(hfs.currentUnit)}</span>` : ''}
		</div>
	`;
}

// ==================== TASK GRAPH PROGRESS BAR ====================

function renderTaskGraphProgressBar(state: GovernedStreamState): string {
	if (!state.taskGraphProgress || state.taskGraphProgress.total === 0) {
		return '';
	}

	const p = state.taskGraphProgress;
	const percent = Math.round((p.completed / p.total) * 100);
	const failedPercent = Math.round((p.failed / p.total) * 100);
	const inProgressPercent = Math.round((p.in_progress / p.total) * 100);

	return `
		<div class="task-graph-progress">
			<div class="task-graph-progress-header">
				<span class="task-graph-progress-label">Task Units</span>
				<span class="task-graph-progress-count">${p.completed}/${p.total} complete${p.failed > 0 ? `, ${p.failed} failed` : ''}</span>
			</div>
			<div class="task-graph-progress-bar">
				<div class="task-graph-bar-fill completed" style="width: ${percent}%"></div>
				<div class="task-graph-bar-fill in-progress" style="width: ${inProgressPercent}%"></div>
				<div class="task-graph-bar-fill failed" style="width: ${failedPercent}%"></div>
			</div>
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



	return renderContentWithMarkdown(turn.content_ref);

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
 * Render text content, auto-detecting markdown and applying formatting.
 */
function renderContentWithMarkdown(text: string): string {
	if (/^#{1,4}\s|^\*\*|\n#{1,4}\s|\n```/.test(text)) {
		return `<div class="card-content card-content-md">${simpleMarkdownToHtml(text)}</div>`;
	}
	return `<div class="card-content">${escapeHtml(text)}</div>`;
}

/**

 * Unwrap JSON-stringified proposal text from content_ref.

 * Falls back to raw text if parsing fails.

 */

function renderProposalContent(contentRef: string): string {

	let text = contentRef;
	try {
		const parsed = JSON.parse(contentRef);
		if (typeof parsed === 'string') {
			text = parsed;
		}
	} catch { /* use raw contentRef */ }

	return renderContentWithMarkdown(text);

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



export function renderHumanGateCard(gate: Gate, blockingClaims: Claim[], resolvedAction?: string, metadata?: Record<string, unknown>): string {
	const isResolved = gate.status === GateStatus.RESOLVED;

	const claimsListHtml = blockingClaims.length > 0
		? blockingClaims.map((c) => `
			<li class="claim-item" data-claim-id="${escapeHtml(c.claim_id)}">
				<span class="verdict-badge ${verdictClass(c.status)}">${verdictIcon(c.status)} ${escapeHtml(c.status)}</span>
				<span>${escapeHtml(c.statement)}</span>
			</li>
		`).join('')
		: '<li class="claim-item">No specific claims linked</li>';

	const headerText = isResolved
		? `&#x2705; Gate Resolved: ${escapeHtml(resolvedAction ?? 'Decision made')} &mdash; ${escapeHtml(gate.reason)}`
		: `Human Decision Required: ${escapeHtml(gate.reason)}`;

	const headerIcon = isResolved ? '&#x2705;' : '&#x1F6A7;';
	const expandedClass = isResolved ? '' : 'expanded';
	const resolvedClass = isResolved ? ' resolved' : '';

	// Build evaluation context section if available
	const evaluationHtml = renderGateEvaluation(metadata);

	return `
		<div class="gate-card collapsible-card ${expandedClass}${resolvedClass}" data-gate-id="${escapeHtml(gate.gate_id)}">
			<div class="collapsible-card-header gate-header" data-action="toggle-card">
				<span class="card-chevron">&#x25B6;</span>
				<span class="gate-icon">${headerIcon}</span>
				<span>${headerText}</span>
			</div>
			<div class="collapsible-card-body">
				<div class="gate-context">
					${isResolved
						? 'This gate has been resolved. The decision is recorded below for reference.'
						: 'The workflow is blocked and requires your input before proceeding.'}
				</div>
				${evaluationHtml}
				<div class="gate-blocking-claims">
					<h4>Blocking Claims</h4>
					<ul class="claims-list">${claimsListHtml}</ul>
				</div>
				${isResolved ? '' : `
				<div class="gate-rationale">
					<label for="rationale-${escapeHtml(gate.gate_id)}">Rationale (required, min 10 characters)</label>
					<textarea
						id="rationale-${escapeHtml(gate.gate_id)}"
						placeholder="Explain your decision..."
						data-gate-rationale="${escapeHtml(gate.gate_id)}"
					></textarea>
					<div class="response-toolbar">
						<div class="gate-char-count" id="charcount-${escapeHtml(gate.gate_id)}">0 / 10 min</div>
						${renderMicButton('gate-rationale:' + gate.gate_id)}
					</div>
				</div>
				<div class="gate-actions">
					<button class="gate-btn approve" disabled data-gate-id="${escapeHtml(gate.gate_id)}" data-action="gate-decision" data-gate-action="APPROVE">Approve</button>
					<button class="gate-btn reject" disabled data-gate-id="${escapeHtml(gate.gate_id)}" data-action="gate-decision" data-gate-action="REJECT">Reject</button>
					<button class="gate-btn override" disabled data-gate-id="${escapeHtml(gate.gate_id)}" data-action="gate-decision" data-gate-action="OVERRIDE">Override</button>
					<button class="gate-btn reframe" disabled data-gate-id="${escapeHtml(gate.gate_id)}" data-action="gate-decision" data-gate-action="REFRAME">Reframe</button>
				</div>
				`}
			</div>
		</div>
	`;
}

/**
 * Render the evaluator analysis section for enriched repair escalation gates.
 * Returns empty string if no evaluation data is present.
 */
function renderGateEvaluation(metadata?: Record<string, unknown>): string {
	if (!metadata) { return ''; }
	const evaluation = metadata.evaluation as {
		completionStatus?: string;
		summary?: string;
		deliverables?: string[];
		issues?: string[];
		recommendations?: string[];
		contentRecoverable?: boolean;
		intendedFilePath?: string;
	} | undefined;
	if (!evaluation) { return ''; }

	const statusIcons: Record<string, string> = {
		'completed_with_errors': '&#x26A0;',
		'partially_completed': '&#x1F527;',
		'blocked': '&#x1F6AB;',
		'failed': '&#x274C;',
	};
	const statusLabels: Record<string, string> = {
		'completed_with_errors': 'Completed with errors',
		'partially_completed': 'Partially completed',
		'blocked': 'Blocked',
		'failed': 'Failed',
	};

	const status = evaluation.completionStatus || 'failed';
	const statusClass = status.replace(/_/g, '-');
	const icon = statusIcons[status] || '&#x2753;';
	const label = statusLabels[status] || status;
	const summary = evaluation.summary ? escapeHtml(evaluation.summary) : '';

	const deliverables = Array.isArray(evaluation.deliverables) ? evaluation.deliverables : [];
	const issues = Array.isArray(evaluation.issues) ? evaluation.issues : [];
	const recommendations = Array.isArray(evaluation.recommendations) ? evaluation.recommendations : [];

	let html = `<div class="gate-evaluation">`;
	html += `<div class="gate-eval-status"><span class="gate-eval-badge ${escapeHtml(statusClass)}">${icon} ${escapeHtml(label)}</span></div>`;
	if (summary) {
		html += `<div class="gate-eval-summary">${summary}</div>`;
	}
	if (deliverables.length > 0) {
		html += `<div class="gate-eval-section"><h4>Deliverables</h4><ul>${deliverables.map((d) => `<li>${escapeHtml(String(d))}</li>`).join('')}</ul></div>`;
	}
	if (issues.length > 0) {
		html += `<div class="gate-eval-section"><h4>Issues</h4><ul>${issues.map((i) => `<li>${escapeHtml(String(i))}</li>`).join('')}</ul></div>`;
	}
	if (recommendations.length > 0) {
		html += `<div class="gate-eval-section"><h4>Recommendations</h4><ul>${recommendations.map((r) => `<li>${escapeHtml(String(r))}</li>`).join('')}</ul></div>`;
	}
	if (evaluation.contentRecoverable) {
		const suggestedPath = evaluation.intendedFilePath
			? escapeHtml(evaluation.intendedFilePath)
			: '&lt;path&gt;';
		html += `<div class="gate-eval-recovery">Content recoverable &mdash; type <code>save ${suggestedPath}</code> to write the file</div>`;
	}
	html += `</div>`;
	return html;
}



// ==================== VERIFICATION GATE CARD ====================



export function renderVerificationGateCard(
	gate: Gate,
	allClaims: Claim[],
	verdicts: Verdict[],
	blockingClaims: Claim[],
	resolvedAction?: string
): string {
	const isResolved = gate.status === GateStatus.RESOLVED;
	// Build verdict lookup
	const verdictByClaim = new Map<string, Verdict>();
	for (const v of verdicts) {
		verdictByClaim.set(v.claim_id, v);
	}

	// Compute summary counts
	const counts = { verified: 0, disproved: 0, unknown: 0, conditional: 0, open: 0 };
	for (const c of allClaims) {
		switch (c.status) {
			case ClaimStatus.VERIFIED: counts.verified++; break;
			case ClaimStatus.DISPROVED: counts.disproved++; break;
			case ClaimStatus.UNKNOWN: counts.unknown++; break;
			case ClaimStatus.CONDITIONAL: counts.conditional++; break;
			default: counts.open++; break;
		}
	}

	// Split into blocking vs non-blocking
	const blockingIds = new Set(blockingClaims.map((c) => c.claim_id));
	const nonBlockingClaims = allClaims.filter((c) => !blockingIds.has(c.claim_id));

	const blockingCount = blockingClaims.length;

	// Render summary bar
	const summaryHtml = `
		<div class="verification-summary-bar">
			<div class="verification-summary-item">
				<span class="verification-summary-count">${counts.verified}</span>
				<span class="verdict-badge verified" style="font-size: 11px;">&#x2705; Verified</span>
			</div>
			<div class="verification-summary-item">
				<span class="verification-summary-count">${counts.disproved}</span>
				<span class="verdict-badge disproved" style="font-size: 11px;">&#x274C; Disproved</span>
			</div>
			<div class="verification-summary-item">
				<span class="verification-summary-count">${counts.unknown}</span>
				<span class="verdict-badge unknown" style="font-size: 11px;">&#x2753; Unknown</span>
			</div>
			<div class="verification-summary-item">
				<span class="verification-summary-count">${counts.conditional}</span>
				<span class="verdict-badge conditional" style="font-size: 11px;">&#x26A0; Conditional</span>
			</div>
			<div class="verification-summary-item">
				<span class="verification-summary-count">${counts.open}</span>
				<span class="verdict-badge pending" style="font-size: 11px;">&#x26AA; Open</span>
			</div>
		</div>
	`;

	// Render a single claim row
	function renderClaimRow(claim: Claim, showResponse: boolean): string {
		const verdict = verdictByClaim.get(claim.claim_id);
		const critClass = claim.criticality === 'CRITICAL' ? 'critical' : 'non-critical';
		const rationale = verdict?.rationale;

		let html = `
			<div class="verification-claim-row" data-claim-id="${escapeHtml(claim.claim_id)}">
				<div class="verification-claim-header">
					<span class="verdict-badge ${verdictClass(claim.status)}">${verdictIcon(claim.status)} ${escapeHtml(claim.status)}</span>
					<span class="verification-claim-criticality ${critClass}">${escapeHtml(claim.criticality)}</span>
				</div>
				<div class="verification-claim-statement">${escapeHtml(claim.statement)}</div>
		`;

		if (rationale) {
			html += `<div class="verification-claim-rationale">Verifier: ${escapeHtml(rationale)}</div>`;
		}

		if (showResponse && !isResolved) {
			html += `
				<div class="verification-claim-response" data-clarification-item="${escapeHtml(claim.claim_id)}">
					<label>Your response (min 10 characters)</label>
					<div class="clarification-messages" id="clarification-messages-${escapeHtml(claim.claim_id)}" style="display:none;"></div>
					<textarea
						placeholder="Explain why you accept this risk or disagree with the finding..."
						data-claim-rationale="${escapeHtml(claim.claim_id)}"
						data-gate-id="${escapeHtml(gate.gate_id)}"
					></textarea>
					<div class="response-toolbar">
						<div class="verification-claim-charcount" id="vg-charcount-${escapeHtml(claim.claim_id)}">0 / 10 min</div>
						${renderMicButton('claim-rationale:' + claim.claim_id)}
						${renderAskMoreToggle(claim.claim_id, claim.statement)}
					</div>
				</div>
			`;
		}

		html += '</div>';
		return html;
	}

	// Render blocking claims section
	const blockingHtml = blockingClaims.length > 0
		? `
			<div class="verification-claims-group">
				<div class="verification-group-header">&#x1F6A8; Blocking — ${blockingCount} critical claim${blockingCount !== 1 ? 's' : ''} requiring response</div>
				${blockingClaims.map((c) => renderClaimRow(c, true)).join('')}
			</div>
		`
		: '';

	// Render non-blocking claims in collapsible section
	const nonBlockingHtml = nonBlockingClaims.length > 0
		? `
			<div class="verification-nonblocking" data-action-container="verification-nonblocking">
				<div class="verification-nonblocking-toggle" data-action="toggle-verification-nonblocking">
					<span class="verification-nonblocking-chevron">&#x25B6;</span>
					${nonBlockingClaims.length} non-blocking claim${nonBlockingClaims.length !== 1 ? 's' : ''}
				</div>
				<div class="verification-nonblocking-body">
					${nonBlockingClaims.map((c) => renderClaimRow(c, false)).join('')}
				</div>
			</div>
		`
		: '';

	// Render action buttons (only when not resolved)
	const actionsHtml = isResolved ? '' : `
		<div class="verification-actions">
			<button class="verification-btn accept-risks" disabled
				data-action="verification-gate-decision"
				data-gate-id="${escapeHtml(gate.gate_id)}"
				data-gate-action="OVERRIDE"
				data-blocking-count="${blockingCount}">
				Accept Risks &amp; Continue
			</button>
			<button class="verification-btn retry-verify"
				data-action="verification-gate-decision"
				data-gate-id="${escapeHtml(gate.gate_id)}"
				data-gate-action="RETRY_VERIFY">
				Retry Verification
			</button>
			<button class="verification-btn replan"
				data-action="verification-gate-decision"
				data-gate-id="${escapeHtml(gate.gate_id)}"
				data-gate-action="REFRAME">
				Replan
			</button>
		</div>
	`;

	const resolvedBadge = isResolved
		? `<span class="gate-resolved-badge">&#x2705; ${escapeHtml(resolvedAction ?? 'Resolved')}</span>`
		: '';

	const headerText = isResolved
		? `Verification Complete ${resolvedBadge}`
		: `Verification Complete: ${blockingCount} claim${blockingCount !== 1 ? 's' : ''} need${blockingCount === 1 ? 's' : ''} attention`;

	return `
		<div class="verification-gate-card${isResolved ? ' resolved' : ''}" data-gate-id="${escapeHtml(gate.gate_id)}">
			<div class="verification-gate-header">
				<span>${isResolved ? '&#x2705;' : '&#x1F6E1;'}</span>
				<span>${headerText}</span>
			</div>
			${summaryHtml}
			${blockingHtml}
			${nonBlockingHtml}
			${actionsHtml}
		</div>
	`;
}



// ==================== REVIEW GATE CARD ====================

/**
 * Render the interactive Review Summary Card for the REVIEW phase.
 * Categorizes all claims and historian findings into three groups:
 * - Needs Your Decision (CRITICAL DISPROVED/UNKNOWN + high-severity findings)
 * - For Your Awareness (NON_CRITICAL flags, CONDITIONAL, informational findings)
 * - All Clear (VERIFIED claims)
 */
export function renderReviewGateCard(
	gate: Gate,
	_allClaims: Claim[],
	verdicts: Verdict[],
	_historianFindings: string[],
	reviewItems: ReviewItem[],
	summary: ReviewSummary,
	resolvedAction?: string,
	resolvedRationale?: string
): string {
	const gateId = escapeHtml(gate.gate_id);
	const isResolved = gate.status === GateStatus.RESOLVED;

	// Build verdict lookup for rationale display
	const verdictByClaim = new Map<string, Verdict>();
	for (const v of verdicts) {
		verdictByClaim.set(v.claim_id, v);
	}

	// Dashboard summary bar
	const dashboardHtml = `
		<div class="review-dashboard-bar">
			<div class="review-dashboard-item">
				<span class="count">${summary.verified}</span>
				<span class="verdict-badge verified" style="font-size: 11px;">&#x2705; Verified</span>
			</div>
			<div class="review-dashboard-item">
				<span class="count">${summary.disproved}</span>
				<span class="verdict-badge disproved" style="font-size: 11px;">&#x274C; Disproved</span>
			</div>
			<div class="review-dashboard-item">
				<span class="count">${summary.unknown}</span>
				<span class="verdict-badge unknown" style="font-size: 11px;">&#x2753; Unknown</span>
			</div>
			<div class="review-dashboard-item">
				<span class="count">${summary.conditional}</span>
				<span class="verdict-badge conditional" style="font-size: 11px;">&#x26A0; Conditional</span>
			</div>
			${summary.historianFindings > 0 ? `
				<div class="review-dashboard-item">
					<span class="count">${summary.historianFindings}</span>
					<span style="font-size: 13px;">&#x1F4DC; Findings</span>
				</div>
			` : ''}
		</div>
		${summary.adjudicationAvailable ? `
		<div class="review-dashboard-bar adjudication-dashboard" style="margin-top: 6px;">
			<div class="review-dashboard-item">
				<span class="count">${summary.consistent}</span>
				<span class="adjudication-badge consistent" style="font-size: 13px;">&#x1F3DB; Consistent</span>
			</div>
			<div class="review-dashboard-item">
				<span class="count">${summary.inconsistent}</span>
				<span class="adjudication-badge inconsistent" style="font-size: 13px;">&#x26D4; Inconsistent</span>
			</div>
			<div class="review-dashboard-item">
				<span class="count">${summary.adjConditional}</span>
				<span class="adjudication-badge adj-conditional" style="font-size: 13px;">&#x26A0; Conditional</span>
			</div>
			<div class="review-dashboard-item">
				<span class="count">${summary.adjUnknown}</span>
				<span class="adjudication-badge adj-unknown" style="font-size: 13px;">&#x2753; Unknown</span>
			</div>
		</div>
		` : ''}
	`;

	// Render a single review item row
	function renderReviewItemRow(item: ReviewItem, showResponse: boolean): string {
		if (item.kind === 'claim' && item.claim) {
			return renderReviewClaimRow(item.claim, item.verdict, item.adjudication, showResponse);
		} else if (item.kind === 'finding' && item.findingText) {
			return renderReviewFindingRow(item.findingText, item.findingIndex ?? 0, showResponse);
		}
		return '';
	}

	function renderReviewClaimRow(
		claim: Claim,
		verdict: Verdict | undefined,
		adjudication: ReviewItem['adjudication'],
		showResponse: boolean,
	): string {
		const critClass = claim.criticality === 'CRITICAL' ? 'critical' : 'non-critical';
		const rationale = verdict?.rationale;

		const typeBadge = claim.assumption_type
			? `<span class="assumption-type-badge">${escapeHtml(claim.assumption_type)}</span>`
			: '';

		// Adjudication badge (if available)
		const adjBadge = adjudication
			? `<span class="adjudication-badge ${adjudicationClass(adjudication.verdict)}">${adjudicationIcon(adjudication.verdict)} ${escapeHtml(adjudication.verdict)}</span>`
			: '';

		let html = `
			<div class="review-item-row" data-claim-id="${escapeHtml(claim.claim_id)}">
				<div class="review-item-header">
					<span class="verdict-badge ${verdictClass(claim.status)}">${verdictIcon(claim.status)} ${escapeHtml(claim.status)}</span>
					<span class="verification-claim-criticality ${critClass}">${escapeHtml(claim.criticality)}</span>
					${typeBadge}
					${adjBadge}
				</div>
				<div class="review-item-statement">${escapeHtml(claim.statement)}</div>
		`;

		if (rationale) {
			html += `<div class="review-item-rationale">Verifier: ${escapeHtml(rationale)}</div>`;
		}

		// Historian adjudication details
		if (adjudication) {
			html += renderAdjudicationDetails(adjudication);
		}

		if (showResponse && !isResolved) {
			html += `
				<div class="review-item-response" data-clarification-item="${escapeHtml(claim.claim_id)}">
					<div class="clarification-messages" id="clarification-messages-${escapeHtml(claim.claim_id)}" style="display:none;"></div>
					<textarea
						placeholder="Explain your decision on this claim..."
						data-review-item-rationale="${escapeHtml(claim.claim_id)}"
						data-gate-id="${gateId}"
					></textarea>
					<div class="response-toolbar">
						<div class="review-item-charcount" id="review-charcount-${escapeHtml(claim.claim_id)}">0 / 10 min</div>
						${renderMicButton('review-item:' + claim.claim_id)}
						${renderAskMoreToggle(claim.claim_id, claim.statement)}
					</div>
				</div>
			`;
		}

		html += '</div>';
		return html;
	}

	function renderReviewFindingRow(text: string, index: number, showResponse: boolean): string {
		const findingKey = `finding-${index}`;
		let html = `
			<div class="review-item-row" data-finding-index="${index}">
				<div class="review-item-header">
					<span style="font-size: 14px;">&#x1F4DC;</span>
					<span style="font-weight: 600; font-size: 11px;">HISTORIAN FINDING</span>
				</div>
				<div class="review-item-statement">${escapeHtml(text)}</div>
				<div class="review-finding-context">This is an observation from the Historian about patterns or precedents in the workflow. Consider whether it affects your decision to proceed.</div>
		`;

		if (showResponse && !isResolved) {
			html += `
				<div class="review-item-response" data-clarification-item="${escapeHtml(findingKey)}">
					<div class="clarification-messages" id="clarification-messages-${escapeHtml(findingKey)}" style="display:none;"></div>
					<textarea
						placeholder="Your response to this finding..."
						data-review-item-rationale="${escapeHtml(findingKey)}"
						data-gate-id="${gateId}"
					></textarea>
					<div class="response-toolbar">
						<div class="review-item-charcount" id="review-charcount-${escapeHtml(findingKey)}">0 / 10 min</div>
						${renderMicButton('review-item:' + findingKey)}
						${renderAskMoreToggle(findingKey, text)}
					</div>
				</div>
			`;
		}

		html += '</div>';
		return html;
	}

	// Group items by category
	const needsDecision = reviewItems.filter((i) => i.category === 'needs_decision');
	const awareness = reviewItems.filter((i) => i.category === 'awareness');
	const allClear = reviewItems.filter((i) => i.category === 'all_clear');

	// Needs Your Decision group (always open)
	const needsDecisionHtml = needsDecision.length > 0
		? `
			<div class="review-group needs-decision">
				<div class="review-group-header" data-action="toggle-review-group">
					<span class="card-chevron">&#x25B6;</span>
					&#x26A0; NEEDS YOUR DECISION (${needsDecision.length} item${needsDecision.length !== 1 ? 's' : ''})
				</div>
				<div class="review-group-body">
					${needsDecision.map((item) => renderReviewItemRow(item, true)).join('')}
				</div>
			</div>
		`
		: '';

	// For Your Awareness group (collapsed by default)
	const awarenessHtml = awareness.length > 0
		? `
			<div class="review-group awareness collapsed">
				<div class="review-group-header" data-action="toggle-review-group">
					<span class="card-chevron">&#x25B6;</span>
					&#x2139; FOR YOUR AWARENESS (${awareness.length} item${awareness.length !== 1 ? 's' : ''})
				</div>
				<div class="review-group-body">
					${awareness.map((item) => renderReviewItemRow(item, true)).join('')}
				</div>
			</div>
		`
		: '';

	// All Clear group (collapsed by default)
	const allClearHtml = allClear.length > 0
		? `
			<div class="review-group all-clear collapsed">
				<div class="review-group-header" data-action="toggle-review-group">
					<span class="card-chevron">&#x25B6;</span>
					&#x2705; ALL CLEAR (${allClear.length} item${allClear.length !== 1 ? 's' : ''})
				</div>
				<div class="review-group-body">
					${allClear.map((item) => renderReviewItemRow(item, false)).join('')}
				</div>
			</div>
		`
		: '';

	// Overall feedback / decision history section
	const needsCount = needsDecision.length;
	let overallHtml: string;
	let actionsHtml: string;

	if (isResolved) {
		// Show the user's recorded rationale and which action was taken
		const isApproved = resolvedAction === 'APPROVE' || resolvedAction === 'OVERRIDE';
		const actionLabel = isApproved ? 'Approved & Continued to Execute' : 'Changes Requested';
		const actionIcon = isApproved ? '&#x2705;' : '&#x1F504;';
		const resolvedTime = gate.resolved_at
			? formatTimestamp(gate.resolved_at)
			: '';

		// Parse per-item rationales from combined rationale text
		const rationaleLines: string[] = [];
		if (resolvedRationale) {
			for (const line of resolvedRationale.split('\n')) {
				const trimmed = line.trim();
				if (trimmed) {
					rationaleLines.push(trimmed);
				}
			}
		}

		const rationaleHtml = rationaleLines.length > 0
			? `<div class="review-resolved-rationale">
				<label>Your feedback:</label>
				<div class="review-resolved-rationale-text">${rationaleLines.map((l) => escapeHtml(l)).join('<br>')}</div>
			</div>`
			: '';

		overallHtml = `
			<div class="review-resolved-decision">
				<div class="review-resolved-action ${isApproved ? 'approved' : 'reframed'}">
					<span>${actionIcon}</span>
					<span class="review-resolved-action-label">${actionLabel}</span>
					${resolvedTime ? `<span class="review-resolved-timestamp">${resolvedTime}</span>` : ''}
				</div>
				${rationaleHtml}
			</div>
		`;

		// Show disabled buttons indicating which was pressed
		actionsHtml = `
			<div class="review-actions resolved">
				<button class="review-btn approve-execute ${isApproved ? 'was-selected' : ''}" disabled
					title="${isApproved ? 'This action was taken.' : ''}">
					Approve &amp; Continue to Execute
				</button>
				<button class="review-btn request-changes ${!isApproved ? 'was-selected' : ''}" disabled
					title="${!isApproved ? 'This action was taken.' : ''}">
					Request Changes
				</button>
			</div>
		`;
	} else {
		const approveTooltip = needsCount > 0
			? 'Provide overall feedback or respond to at least one item above (min 10 characters) to enable this button.'
			: '';
		overallHtml = `
			<div class="review-overall-section">
				<label>Overall Feedback (optional)</label>
				<textarea
					placeholder="Additional comments, concerns, or instructions for the workflow..."
					data-review-overall-rationale="${gateId}"
				></textarea>
				<div class="response-toolbar">
					<div class="review-item-charcount" id="review-overall-charcount-${gateId}">0 characters</div>
					${renderMicButton('review-overall:' + gateId)}
				</div>
			</div>
		`;
		actionsHtml = `
			<div class="review-actions">
				<button class="review-btn approve-execute" ${needsCount > 0 ? 'disabled' : ''}
					data-action="review-gate-decision"
					data-gate-id="${gateId}"
					data-gate-action="APPROVE"
					data-needs-decision-count="${needsCount}"
					title="${approveTooltip}">
					Approve &amp; Continue to Execute
				</button>
				<button class="review-btn request-changes"
					data-action="review-gate-decision"
					data-gate-id="${gateId}"
					data-gate-action="REFRAME"
					title="Send the proposal back for rework based on the verification and historian findings.">
					Request Changes
				</button>
			</div>
		`;
	}

	const resolvedBadge = isResolved
		? `<span class="gate-resolved-badge">&#x2705; ${escapeHtml(resolvedAction === 'APPROVE' ? 'Approved' : resolvedAction === 'REFRAME' ? 'Changes Requested' : resolvedAction ?? 'Resolved')}</span>`
		: '';

	const headerText = isResolved
		? `Review Summary ${resolvedBadge}`
		: 'Review Summary';

	const subtitle = isResolved
		? 'This review has been completed. The decision is recorded below for reference.'
		: 'Review findings from verification and historical analysis before proceeding to execution.';

	return `
		<div class="review-gate-card${isResolved ? ' resolved' : ''}" data-gate-id="${gateId}">
			<div class="review-gate-header">
				<span>${isResolved ? '&#x2705;' : '&#x1F4CB;'}</span>
				<span>${headerText}</span>
			</div>
			<div class="review-gate-subtitle">
				${subtitle}
			</div>
			${dashboardHtml}
			${needsDecisionHtml}
			${awarenessHtml}
			${allClearHtml}
			${overallHtml}
			${actionsHtml}
		</div>
	`;
}


// ==================== WARNING CARD ====================



// ==================== PERMISSION CARD ====================


export function renderPermissionCard(permissionId: string, tool: string, input: Record<string, unknown>): string {
	const escapedId = escapeHtml(permissionId);
	const escapedTool = escapeHtml(tool);

	// Build a human-readable summary of the tool input
	let inputSummary = '';
	if (input.command) {
		inputSummary = `Command: ${escapeHtml(String(input.command).substring(0, 200))}`;
	} else if (input.file_path || input.path) {
		inputSummary = `File: ${escapeHtml(String(input.file_path || input.path))}`;
	} else if (input.pattern) {
		inputSummary = `Pattern: ${escapeHtml(String(input.pattern))}`;
	} else {
		const keys = Object.keys(input).filter(k => k !== '_permissionId');
		if (keys.length > 0) {
			inputSummary = keys.map(k => `${escapeHtml(k)}: ${escapeHtml(String(input[k]).substring(0, 100))}`).join(', ');
		}
	}

	return `
		<div class="permission-card" data-permission-id="${escapedId}">
			<div class="permission-header">
				<span class="permission-icon">&#x1F512;</span>
				<span>Tool Permission Requested</span>
			</div>
			<div class="permission-body">
				<div class="permission-tool-name">${escapedTool}</div>
				${inputSummary ? `<div class="permission-input">${inputSummary}</div>` : ''}
			</div>
			<div class="permission-actions">
				<button class="permission-btn permission-approve"
					data-action="permission-approve"
					data-permission-id="${escapedId}">Approve</button>
				<button class="permission-btn permission-approve-all"
					data-action="permission-approve-all"
					data-permission-id="${escapedId}">Approve All (${escapedTool})</button>
				<button class="permission-btn permission-deny"
					data-action="permission-deny"
					data-permission-id="${escapedId}">Deny</button>
			</div>
		</div>
	`;
}


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
	[Phase.INTAKE]: 'Discuss your requirements...',
	[Phase.PROPOSE]: 'Ask a question or wait for the proposal...',
	[Phase.ASSUMPTION_SURFACING]: 'Ask about assumptions or wait...',
	[Phase.VERIFY]: 'Ask about results, approve, retry, or override...',
	[Phase.HISTORICAL_CHECK]: 'Ask about historical findings...',
	[Phase.REVIEW]: 'Approve, request changes, or ask a question...',
	[Phase.EXECUTE]: 'Ask about progress, save output, or cancel...',
	[Phase.VALIDATE]: 'Ask about validation results...',
	[Phase.COMMIT]: 'Ask about results or start a new task...',
	[Phase.REPLAN]: 'Provide feedback for replanning...',
};



export function renderInputArea(currentPhase: Phase, hasOpenGates: boolean, gateContext?: string): string {

	const placeholder = PHASE_PLACEHOLDERS[currentPhase] ?? 'Enter your message...';



	return `

		<div class="input-area">

			${hasOpenGates ? `<div class="input-actions"><span style="font-size: 11px; color: var(--vscode-charts-yellow);">&#x1F6A7; ${escapeHtml(gateContext || 'Gate is blocking \u2014 resolve above to continue')}</span></div>` : ''}

			<div class="input-attachments" id="input-attachments" style="display:none;"></div>

			<div class="composer-wrapper">

				<div
					class="composer-input"
					id="user-input"
					contenteditable="true"
					role="textbox"
					aria-multiline="true"
					aria-label="Message input"
					data-placeholder="${escapeHtml(placeholder)}"
					data-empty="true"
				></div>

				<div class="composer-footer">

					<div class="composer-footer-left">

						<button class="input-toolbar-btn" id="attach-file-btn" title="Attach workspace file">

							&#x1F4CE; Attach

						</button>

						${renderMicButton('user-input')}

						<span class="input-toolbar-hint">Natural language understood &middot; <kbd>@</kbd> mention files &middot; <kbd>Enter</kbd> send &middot; <kbd>Shift+Enter</kbd> newline</span>

					</div>

					<button class="input-submit-btn" id="submit-btn" title="Send (Enter)">
						<span class="submit-icon" id="submit-icon">&#x2191;</span>
						<span class="submit-spinner" id="submit-spinner"></span>
					</button>

				</div>

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

					Export the governed stream history for debugging or analysis.

				</div>

				<button class="settings-btn" data-action="export-stream">Export Stream</button>

				<div class="settings-divider"></div>

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


/**
 * Render a gathering-phase turn card (Expert as Interviewer — no plan output).
 * Shows domain badge, interviewer role, domain notes, and follow-up questions.
 */
function renderGatheringTurnCard(
	turn: IntakeConversationTurn,
	response: IntakeGatheringTurnResponse,
	timestamp: string,
	commandBlocks?: Array<{ command: WorkflowCommandRecord; outputs: WorkflowCommandOutput[] }>,
	isLatest?: boolean,
): string {
	const domainInfo = DOMAIN_INFO[response.focusDomain];
	const domainLabel = domainInfo ? domainInfo.label : response.focusDomain;

	const domainNotesHtml = response.domainNotes.length > 0
		? '<div class="intake-domain-notes"><ul>' +
			response.domainNotes.map((n) => '<li>' + escapeHtml(n) + '</li>').join('') +
			'</ul></div>'
		: '';

	const findingsHtml = response.codebaseFindings && response.codebaseFindings.length > 0
		? '<div class="intake-findings">' +
			'<span class="intake-findings-label">Codebase findings:</span>' +
			'<ul>' + response.codebaseFindings.map((f) => '<li><code>' + escapeHtml(f) + '</code></li>').join('') + '</ul>' +
			'</div>'
		: '';

	const followUpHtml = response.followUpQuestions && response.followUpQuestions.length > 0
		? '<div class="intake-suggestions">' +
			'<span class="intake-suggestions-label">Consider asking:</span>' +
			'<ul>' + response.followUpQuestions.map((q, i) => {
				const qId = 'GQ-T' + turn.turnNumber + '-' + (i + 1);
				if (isLatest) {
					return '<li class="question-item">' +
						'<span class="question-item-text">' + escapeHtml(q) + '</span>' +
						'<div class="intake-question-response" data-clarification-item="' + qId + '">' +
						'<div class="clarification-messages" id="clarification-messages-' + qId + '" style="display:none;"></div>' +
						'<textarea class="intake-question-textarea" data-intake-question-id="' + qId + '" data-intake-question-text="' + escapeHtml(q) + '" placeholder="Type your response..." rows="2"></textarea>' +
						'<div class="response-toolbar">' +
						'<span class="intake-question-charcount" data-charcount-for="' + qId + '">0 chars</span>' +
						renderMicButton('intake-question:' + qId) +
						renderAskMoreToggle(qId, q) +
						'</div></div></li>';
				}
				return '<li class="question-item"><span class="question-item-text">' + escapeHtml(q) + '</span></li>';
			}).join('') +
			'</ul></div>'
		: '';

	const humanPreview = escapeHtml(turn.humanMessage.substring(0, 60)) + (turn.humanMessage.length > 60 ? '\u2026' : '');

	return '<div class="intake-turn-card gathering-turn collapsible-card expanded" data-intake-turn="' + turn.turnNumber + '">' +
		'<div class="collapsible-card-header intake-turn-header" data-action="toggle-card">' +
		'<span class="card-chevron">&#x25B6;</span>' +
		'<span class="intake-turn-number">Turn ' + turn.turnNumber + '</span>' +
		'<span class="intake-domain-badge">' + escapeHtml(domainLabel) + '</span>' +
		'<span class="intake-turn-preview">' + humanPreview + '</span>' +
		'<span class="intake-turn-time">' + formatTimestamp(timestamp) + '</span>' +
		'</div>' +
		'<div class="collapsible-card-body">' +
		'<div class="intake-message intake-human">' +
		'<div class="card-header"><div class="card-header-left">' +
		'<span class="role-icon codicon codicon-account"></span>' +
		'<span class="role-badge role-human">Human</span>' +
		'</div></div>' +
		'<div class="card-content">' + escapeHtml(turn.humanMessage) + '</div>' +
		'</div>' +
		(commandBlocks && commandBlocks.length > 0
			? '<div class="intake-command-blocks" style="margin-top: 6px;">' + commandBlocks.map((cb) => renderCommandBlock(cb.command, cb.outputs)).join('') + '</div>'
			: '') +
		'<div class="intake-message intake-expert" style="margin-top: 6px;">' +
		'<div class="card-header"><div class="card-header-left">' +
		'<span class="role-icon codicon codicon-beaker"></span>' +
		'<span class="role-badge role-technical_expert">Interviewer</span>' +
		'<span class="intake-domain-badge">' + escapeHtml(domainLabel) + '</span>' +
		'</div></div>' +
		'<div class="card-content">' + simpleMarkdownToHtml(response.conversationalResponse) + '</div>' +
		domainNotesHtml +
		followUpHtml +
		findingsHtml +
		'</div></div></div>';
}

export function renderIntakeTurnCard(
	turn: IntakeConversationTurn,
	timestamp: string,
	commandBlocks?: Array<{ command: WorkflowCommandRecord; outputs: WorkflowCommandOutput[] }>,
	isLatest?: boolean,
): string {

	// Delegate to gathering-specific renderer for interviewer turns
	if (isGatheringResponse(turn.expertResponse)) {
		return renderGatheringTurnCard(turn, turn.expertResponse, timestamp, commandBlocks, isLatest);
	}

	const expertResponse = turn.expertResponse;

	const suggestionsHtml = expertResponse.suggestedQuestions && expertResponse.suggestedQuestions.length > 0

		? `<div class="intake-suggestions">

				<span class="intake-suggestions-label">Consider asking:</span>

				<ul>${expertResponse.suggestedQuestions.map((q, i) => {
					const qId = `SQ-T${turn.turnNumber}-${i + 1}`;
					if (isLatest) {
						return `<li class="question-item">
							<span class="question-item-text">${escapeHtml(q)}</span>
							<div class="intake-question-response" data-clarification-item="${qId}">
								<div class="clarification-messages" id="clarification-messages-${qId}" style="display:none;"></div>
								<textarea class="intake-question-textarea"
									data-intake-question-id="${qId}"
									data-intake-question-text="${escapeHtml(q)}"
									placeholder="Type your response..."
									rows="2"></textarea>
								<div class="response-toolbar">
									<span class="intake-question-charcount" data-charcount-for="${qId}">0 chars</span>
									${renderMicButton('intake-question:' + qId)}
									${renderAskMoreToggle(qId, q)}
								</div>
							</div>
						</li>`;
					} else {
						return `<li class="question-item"><span class="question-item-text">${escapeHtml(q)}</span></li>`;
					}
				}).join('')}</ul>

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

				<div class="intake-message intake-human">

					<div class="card-header">

						<div class="card-header-left">

							<span class="role-icon codicon codicon-account"></span>

							<span class="role-badge role-human">Human</span>

						</div>

					</div>

					<div class="card-content">${escapeHtml(turn.humanMessage)}</div>

				</div>

				${commandBlocks && commandBlocks.length > 0
					? `<div class="intake-command-blocks" style="margin-top: 6px;">${commandBlocks.map((cb) => renderCommandBlock(cb.command, cb.outputs)).join('')}</div>`
					: ''}

				<div class="intake-message intake-expert" style="margin-top: 6px;">

					<div class="card-header">

						<div class="card-header-left">

							<span class="role-icon codicon codicon-beaker"></span>

							<span class="role-badge role-technical_expert">Tech Expert</span>

							<span class="intake-plan-version">Plan v${expertResponse.updatedPlan.version}</span>

						</div>

					</div>

					<div class="card-content">${escapeHtml(expertResponse.conversationalResponse)}</div>

					${suggestionsHtml}

					${findingsHtml}

				</div>

			</div>

		</div>

	`;

}



export function renderIntakePlanPreview(plan: IntakePlanDocument, isFinal: boolean, isLatest?: boolean): string {

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



	// When isLatest, open questions are suppressed here because they duplicate
	// the "Consider Asking" section in the turn card above (which has interactive
	// textareas for the user to respond). For historical plans, show them read-only.
	const openQuestionsHtml = !isLatest && plan.openQuestions.length > 0
		? `<div class="intake-plan-section">
				<h5>Open Questions (${plan.openQuestions.length})</h5>
				<ul>${plan.openQuestions.map((q) => {
					return `<li class="question-item"><span class="question-item-text"><strong>[${escapeHtml(q.id)}]</strong> ${escapeHtml(q.text)}</span></li>`;
				}).join('')}</ul>
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



export function renderIntakeApprovalGate(_plan: IntakePlanDocument, dialogueId: string, resolved?: boolean, resolvedAction?: string): string {
	const isResolved = resolved === true;
	const expandedClass = isResolved ? '' : 'expanded';
	const resolvedClass = isResolved ? ' resolved' : '';

	const headerIcon = isResolved ? '&#x2705;' : '&#x1F4CB;';
	const headerText = isResolved
		? `Plan ${escapeHtml(resolvedAction ?? 'Decision Made')}`
		: 'Plan Ready for Approval';

	const contextText = isResolved
		? `This plan review has been completed. Decision: <strong>${escapeHtml(resolvedAction ?? 'Decision made')}</strong>`
		: 'The Technical Expert has synthesized your conversation into a final plan. Review the plan above and choose to approve or continue discussing.';

	return `
		<div class="intake-approval-gate collapsible-card ${expandedClass}${resolvedClass}" data-dialogue-id="${escapeHtml(dialogueId)}">
			<div class="collapsible-card-header gate-header" data-action="toggle-card">
				<span class="card-chevron">&#x25B6;</span>
				<span class="gate-icon">${headerIcon}</span>
				<span>${headerText}</span>
			</div>
			<div class="collapsible-card-body">
				<div class="gate-context">
					${contextText}
				</div>
				${isResolved ? `
				<div class="intake-approval-actions resolved">
					<button class="gate-btn approve ${resolvedAction === 'Approved' ? 'was-selected' : ''}" disabled
						title="${resolvedAction === 'Approved' ? 'This action was taken.' : ''}">Approve Plan</button>
					<button class="gate-btn reframe ${resolvedAction === 'Continued Discussing' ? 'was-selected' : ''}" disabled
						title="${resolvedAction === 'Continued Discussing' ? 'This action was taken.' : ''}">Continue Discussing</button>
				</div>
				` : `
				<div class="intake-approval-actions">
					<button class="gate-btn approve" data-action="intake-approve-plan">Approve Plan</button>
					<button class="gate-btn reframe" data-action="intake-continue-discussing">Continue Discussing</button>
				</div>
				`}
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


function renderIntakeQuestionsSubmitBar(): string {
	return `
		<div class="intake-questions-submit-bar" id="intake-questions-submit-bar" style="display:none;">
			<span class="intake-questions-submit-count" id="intake-submit-count">0 responses</span>
			<button class="intake-questions-submit-btn" id="intake-submit-btn"
				data-action="intake-submit-responses" disabled>
				Submit Responses
			</button>
		</div>
	`;
}

function renderIntakeFinalizeResolved(): string {
	return `
		<div class="intake-finalize-bar resolved">
			<span class="gate-icon">&#x2705;</span>
			<span class="intake-finalize-hint">Plan finalized and synthesized</span>
		</div>
	`;
}

function renderIntakeGatheringFooter(intakeState: NonNullable<GovernedStreamState['intakeState']>): string {
	const currentDomain = intakeState.currentDomain;
	const domainInfo = currentDomain ? DOMAIN_INFO[currentDomain as keyof typeof DOMAIN_INFO] : null;
	const currentIdx = currentDomain ? DOMAIN_SEQUENCE.indexOf(currentDomain as any) : -1;
	const mode = intakeState.intakeMode;
	const coverage = intakeState.domainCoverage;

	// Coverage-based progress for DOMAIN_GUIDED, domain-sequential for STATE_DRIVEN
	let progressLabel: string;
	let progressPercent: number;

	if (mode === 'DOMAIN_GUIDED' && coverage) {
		// For document-based: show coverage percentage (domains may advance non-sequentially)
		const total = DOMAIN_SEQUENCE.length;
		let covered = 0;
		for (const key of Object.keys(coverage)) {
			if (coverage[key as keyof typeof coverage] !== DomainCoverageLevel.NONE) {
				covered++;
			}
		}
		progressPercent = Math.round((covered / total) * 100);
		progressLabel = 'Analyzing documents \u2014 ' + covered + ' of ' + total + ' domains touched';
	} else if (currentIdx >= 0) {
		// STATE_DRIVEN: sequential domain walkthrough
		progressPercent = Math.round(((currentIdx + 1) / DOMAIN_SEQUENCE.length) * 100);
		progressLabel = 'Domain ' + (currentIdx + 1) + ' of ' + DOMAIN_SEQUENCE.length + ': ' + (domainInfo ? domainInfo.label : currentDomain);
	} else {
		progressPercent = 0;
		progressLabel = 'Gathering domain information';
	}

	// Guidance text: tell the user what to do next
	const guidanceText = mode === 'DOMAIN_GUIDED'
		? 'Answer any questions above, then submit to continue document analysis. Or type freely in the composer.'
		: 'Answer any questions above, then submit to continue the walkthrough. Or type freely in the composer.';

	return '<div class="intake-gathering-footer">' +
		'<div class="intake-gathering-guidance">' + escapeHtml(guidanceText) + '</div>' +
		'<div class="intake-gathering-progress">' +
		'<span class="intake-gathering-progress-label">' + escapeHtml(progressLabel) + '</span>' +
		'<div class="intake-gathering-progress-bar">' +
		'<div class="intake-gathering-progress-fill" style="width: ' + progressPercent + '%;"></div>' +
		'</div></div>' +
		'<button class="intake-skip-gathering-btn" data-action="intake-skip-gathering">' +
		'Skip to Plan Discussion &#x2192;' +
		'</button></div>';
}


// ==================== INTAKE MODE SELECTOR ====================

export function renderIntakeModeSelector(recommendation: IntakeModeRecommendation, resolved?: boolean, selectedMode?: string): string {
	const modeLabels: Record<string, { label: string; icon: string; description: string }> = {
		STATE_DRIVEN: {
			label: 'Guided Walkthrough',
			icon: '&#x1F4CB;',
			description: 'Sequential walk through 12 engineering domains with targeted questions',
		},
		DOMAIN_GUIDED: {
			label: 'Document-Based',
			icon: '&#x1F4C4;',
			description: 'Analyze provided documents, then explore uncovered domains',
		},
		HYBRID_CHECKPOINTS: {
			label: 'Conversational',
			icon: '&#x1F4AC;',
			description: 'Free-form discussion with periodic domain coverage checkpoints',
		},
	};

	const isResolved = resolved === true;
	const expandedClass = isResolved ? '' : 'expanded';
	const resolvedClass = isResolved ? ' resolved' : '';

	const headerIcon = isResolved ? '&#x2705;' : '&#x1F9ED;';
	const headerText = isResolved
		? `INTAKE Mode: ${modeLabels[selectedMode || recommendation.recommended]?.label || selectedMode}`
		: 'Select INTAKE Mode';

	let buttonsHtml = '';
	const modes = [IntakeMode.STATE_DRIVEN, IntakeMode.DOMAIN_GUIDED, IntakeMode.HYBRID_CHECKPOINTS];
	for (const mode of modes) {
		const info = modeLabels[mode];
		const isRecommended = mode === recommendation.recommended;
		const recommendedTag = isRecommended ? ' <span class="intake-mode-recommended">(Recommended)</span>' : '';

		if (isResolved) {
			const wasSelected = mode === selectedMode;
			buttonsHtml += `
				<button class="intake-mode-btn${wasSelected ? ' was-selected' : ''}" disabled>
					<span class="intake-mode-btn-icon">${info.icon}</span>
					<span class="intake-mode-btn-label">${info.label}${recommendedTag}</span>
					<span class="intake-mode-btn-desc">${info.description}</span>
				</button>`;
		} else {
			buttonsHtml += `
				<button class="intake-mode-btn${isRecommended ? ' recommended' : ''}"
					data-action="intake-select-mode" data-intake-mode="${mode}">
					<span class="intake-mode-btn-icon">${info.icon}</span>
					<span class="intake-mode-btn-label">${info.label}${recommendedTag}</span>
					<span class="intake-mode-btn-desc">${info.description}</span>
				</button>`;
		}
	}

	return `
		<div class="intake-mode-selector collapsible-card ${expandedClass}${resolvedClass}">
			<div class="collapsible-card-header gate-header" data-action="toggle-card">
				<span class="card-chevron">&#x25B6;</span>
				<span class="gate-icon">${headerIcon}</span>
				<span>${headerText}</span>
			</div>
			<div class="collapsible-card-body">
				<div class="intake-mode-rationale">
					${escapeHtml(recommendation.rationale)}
				</div>
				<div class="intake-mode-options">
					${buttonsHtml}
				</div>
			</div>
		</div>
	`;
}


// ==================== DOMAIN COVERAGE SIDEBAR ====================

export function renderDomainCoverageSidebar(coverage: DomainCoverageMap, currentDomain?: string | null): string {
	let domainsHtml = '';
	for (const domain of DOMAIN_SEQUENCE) {
		const entry = coverage[domain];
		const info = DOMAIN_INFO[domain];
		let dotClass: string;
		switch (entry.level) {
			case DomainCoverageLevel.ADEQUATE: dotClass = 'coverage-adequate'; break;
			case DomainCoverageLevel.PARTIAL: dotClass = 'coverage-partial'; break;
			default: dotClass = 'coverage-none'; break;
		}

		const hasEvidence = entry.evidence.length > 0;
		const isCurrentDomain = currentDomain && domain === currentDomain;
		const evidenceSnippets = hasEvidence
			? entry.evidence.map(e => '<li>' + escapeHtml(e) + '</li>').join('')
			: '<li class="no-evidence">No evidence yet</li>';
		const chevron = hasEvidence ? '<span class="coverage-row-chevron">&#x25B6;</span>' : '';
		const pointer = isCurrentDomain ? '<span class="coverage-current-indicator">&#x25B6;</span>' : '';

		domainsHtml +=
			'<div class="coverage-domain-row' + (hasEvidence ? ' has-evidence' : '') + (isCurrentDomain ? ' current-domain' : '') + '" title="' + escapeHtml(info.description) + '" data-action="toggle-coverage-evidence">' +
				chevron +
				pointer +
				'<span class="coverage-dot ' + dotClass + '"></span>' +
				'<span class="coverage-domain-label">' + escapeHtml(info.label) + '</span>' +
				'<span class="coverage-level-tag ' + dotClass + '">' + entry.level + '</span>' +
			'</div>' +
			'<div class="coverage-evidence-details"' + (hasEvidence ? '' : ' style="display:none"') + '>' +
				'<ul>' + evidenceSnippets + '</ul>' +
			'</div>';
	}

	// Compute summary
	let adequate = 0, partial = 0, none = 0;
	const total = DOMAIN_SEQUENCE.length;
	for (const domain of DOMAIN_SEQUENCE) {
		switch (coverage[domain].level) {
			case DomainCoverageLevel.ADEQUATE: adequate++; break;
			case DomainCoverageLevel.PARTIAL: partial++; break;
			default: none++; break;
		}
	}
	const percentage = Math.round(((adequate * 100) + (partial * 50)) / total);

	return `
		<div class="domain-coverage-sidebar">
			<div class="coverage-sidebar-header">
				<span class="coverage-sidebar-title">Domain Coverage</span>
				<span class="coverage-sidebar-pct">${percentage}%</span>
			</div>
			<div class="coverage-sidebar-bar">
				<div class="coverage-bar-fill" style="width: ${percentage}%"></div>
			</div>
			<div class="coverage-sidebar-stats">
				<span class="coverage-stat adequate">${adequate} adequate</span>
				<span class="coverage-stat partial">${partial} partial</span>
				<span class="coverage-stat none">${none} uncovered</span>
			</div>
			<div class="coverage-domain-list">
				${domainsHtml}
			</div>
		</div>
	`;
}


// ==================== INTAKE CHECKPOINT CARD ====================

export function renderIntakeCheckpoint(checkpoint: IntakeCheckpoint, resolved?: boolean): string {
	const isResolved = resolved === true;
	const expandedClass = isResolved ? '' : 'expanded';
	const resolvedClass = isResolved ? ' resolved' : '';

	const headerIcon = isResolved ? '&#x2705;' : '&#x1F4CA;';
	const headerText = isResolved
		? `Coverage Checkpoint (Turn ${checkpoint.turnNumber})`
		: `Coverage Checkpoint — Turn ${checkpoint.turnNumber}`;

	// Coverage summary from snapshot
	let adequate = 0, partial = 0, none = 0;
	const total = DOMAIN_SEQUENCE.length;
	for (const domain of DOMAIN_SEQUENCE) {
		const entry = checkpoint.coverageSnapshot[domain];
		switch (entry.level) {
			case DomainCoverageLevel.ADEQUATE: adequate++; break;
			case DomainCoverageLevel.PARTIAL: partial++; break;
			default: none++; break;
		}
	}
	const percentage = Math.round(((adequate * 100) + (partial * 50)) / total);

	// Suggested domain buttons
	let suggestionsHtml = '';
	if (checkpoint.suggestedDomains.length > 0 && !isResolved) {
		const domainBtns = checkpoint.suggestedDomains.map(d => {
			const info = DOMAIN_INFO[d];
			return `<button class="checkpoint-domain-btn"
				data-action="intake-ask-domain" data-domain-label="${escapeHtml(info.label)}">
				Ask about ${escapeHtml(info.label)}
			</button>`;
		}).join('');
		suggestionsHtml = `
			<div class="checkpoint-suggestions">
				<div class="checkpoint-suggestions-label">Suggested areas to explore:</div>
				${domainBtns}
			</div>`;
	}

	let actionsHtml = '';
	if (!isResolved) {
		if (checkpoint.offerModeSwitch) {
			// DOMAIN_GUIDED gap analysis: offer mode-switch to fill coverage gaps
			actionsHtml = `
				<div class="checkpoint-gap-prompt">How would you like to address uncovered domains?</div>
				<div class="checkpoint-actions">
					<button class="gate-btn approve" data-action="intake-switch-to-walkthrough"
						data-intake-mode="${IntakeMode.STATE_DRIVEN}">Walk Through Gaps</button>
					<button class="gate-btn" data-action="intake-switch-to-conversational"
						data-intake-mode="${IntakeMode.HYBRID_CHECKPOINTS}">Discuss Freely</button>
					<button class="gate-btn reframe" data-action="intake-finalize-plan">Finalize As-Is</button>
				</div>`;
		} else {
			actionsHtml = `
				<div class="checkpoint-actions">
					<button class="gate-btn approve" data-action="intake-checkpoint-continue">Continue Discussing</button>
					<button class="gate-btn reframe" data-action="intake-finalize-plan">Finalize Plan</button>
				</div>`;
		}
	}

	return `
		<div class="intake-checkpoint collapsible-card ${expandedClass}${resolvedClass}">
			<div class="collapsible-card-header gate-header" data-action="toggle-card">
				<span class="card-chevron">&#x25B6;</span>
				<span class="gate-icon">${headerIcon}</span>
				<span>${headerText}</span>
			</div>
			<div class="collapsible-card-body">
				<div class="checkpoint-summary">
					<div class="checkpoint-bar">
						<div class="coverage-bar-fill" style="width: ${percentage}%"></div>
					</div>
					<div class="checkpoint-stats">
						${percentage}% coverage: ${adequate} adequate, ${partial} partial, ${none} uncovered
					</div>
				</div>
				${suggestionsHtml}
				${actionsHtml}
			</div>
		</div>
	`;
}


// ==================== INTAKE DOMAIN TRANSITION CARD ====================

function renderDomainTransitionCard(
	fromLabel: string,
	toDomain: string | null,
	toLabel: string | null,
	toDescription: string | null,
): string {
	const completedHtml =
		'<div class="domain-transition-completed">' +
		'<span class="domain-transition-check">&#x2705;</span>' +
		'<span class="domain-transition-label">' + escapeHtml(fromLabel) + '</span>' +
		'<span class="domain-transition-status">Adequate</span>' +
		'</div>';

	let nextHtml: string;
	if (toDomain && toLabel) {
		nextHtml =
			'<div class="domain-transition-next">' +
			'<span class="domain-transition-next-label">Next: ' + escapeHtml(toLabel) + '</span>' +
			(toDescription
				? '<span class="domain-transition-next-desc">' + escapeHtml(toDescription) + '</span>'
				: '') +
			'</div>';
	} else {
		nextHtml =
			'<div class="domain-transition-next">' +
			'<span class="domain-transition-next-label">All domains explored</span>' +
			'</div>';
	}

	return '<div class="intake-domain-transition">' +
		completedHtml +
		'<div class="domain-transition-arrow">&#x25BC;</div>' +
		nextHtml +
		'</div>';
}


// ==================== INTAKE GATHERING COMPLETE BANNER ====================

function renderGatheringCompleteBanner(
	coverageSummary: { adequate: number; partial: number; none: number; percentage: number },
	intakeMode?: string | null,
): string {
	const isDocBased = intakeMode === 'DOMAIN_GUIDED';
	const title = isDocBased ? 'Document Analysis Complete' : 'All Domains Gathered';
	const hint = isDocBased
		? 'Initial document analysis is complete. You can now discuss the plan, answer follow-up questions, or finalize.'
		: 'The system will now synthesize your responses into a plan. You can also type additional context in the composer.';

	return '<div class="intake-gathering-complete-banner">' +
		'<div class="gathering-complete-icon">&#x1F4CB;</div>' +
		'<div class="gathering-complete-content">' +
		'<div class="gathering-complete-title">' + escapeHtml(title) + '</div>' +
		'<div class="gathering-complete-stats">' +
		coverageSummary.percentage + '% coverage &mdash; ' +
		coverageSummary.adequate + ' adequate, ' +
		coverageSummary.partial + ' partial, ' +
		coverageSummary.none + ' uncovered' +
		'</div>' +
		'<div class="gathering-complete-hint">' + escapeHtml(hint) + '</div>' +
		'</div></div>';
}


// ==================== ANALYSIS & PROPOSAL CARDS (INVERTED FLOW) ====================

function renderIntakeAnalysisCard(
	humanMessage: string,
	analysisSummary: string,
	codebaseFindings: string[],
	commandBlocks?: Array<{ command: WorkflowCommandRecord; outputs: WorkflowCommandOutput[] }>,
): string {
	let html = '';

	// Human message bubble (the user's original prompt)
	if (humanMessage) {
		html += '<div class="intake-message intake-human">' +
			'<div class="card-header"><div class="card-header-left">' +
			'<span class="role-icon codicon codicon-account"></span>' +
			'<span class="role-badge role-human">Human</span>' +
			'</div></div>' +
			'<div class="card-content">' + escapeHtml(humanMessage) + '</div>' +
			'</div>';
	}

	html += '<div class="intake-analysis-card">';

	// Header
	html += '<div class="intake-analysis-header">' +
		'<span class="intake-analysis-icon">&#x1F50D;</span>' +
		'<span class="intake-analysis-title">Technical Analysis</span>' +
		'</div>';

	// Command blocks (CLI activity during analysis)
	if (commandBlocks && commandBlocks.length > 0) {
		for (const block of commandBlocks) {
			html += renderCommandBlock(block.command, block.outputs);
		}
	}

	// Analysis summary
	html += '<div class="intake-analysis-body">' +
		simpleMarkdownToHtml(analysisSummary) +
		'</div>';

	// Codebase findings (collapsible)
	if (codebaseFindings.length > 0) {
		html += '<details class="intake-analysis-findings">' +
			'<summary class="intake-analysis-findings-header">Codebase Findings (' + codebaseFindings.length + ')</summary>' +
			'<ul class="intake-analysis-findings-list">';
		for (const finding of codebaseFindings) {
			html += '<li>' + escapeHtml(finding) + '</li>';
		}
		html += '</ul></details>';
	}

	html += '</div>';
	return html;
}

function renderIntakeProposalCard(
	title: string,
	summary: string,
	proposedApproach: string,
	domainCoverage: { adequate: number; partial: number; none: number; percentage: number },
): string {
	let html = '<div class="intake-proposal-card">';

	// Header
	html += '<div class="intake-proposal-header">' +
		'<span class="intake-proposal-icon">&#x1F4D0;</span>' +
		'<span class="intake-proposal-title">Proposed Technical Approach</span>' +
		'</div>';

	// Plan title
	if (title) {
		html += '<div class="intake-proposal-plan-title">' + escapeHtml(title) + '</div>';
	}

	// Summary
	if (summary) {
		html += '<div class="intake-proposal-summary">' +
			simpleMarkdownToHtml(summary) +
			'</div>';
	}

	// Proposed approach
	if (proposedApproach) {
		html += '<div class="intake-proposal-approach">' +
			'<div class="intake-proposal-approach-label">Approach</div>' +
			'<div class="intake-proposal-approach-body">' +
			simpleMarkdownToHtml(proposedApproach) +
			'</div></div>';
	}

	// Domain coverage summary
	html += '<div class="intake-proposal-coverage">' +
		'<div class="intake-proposal-coverage-bar">' +
		'<span class="intake-proposal-coverage-label">Domain Coverage</span>' +
		'<span class="intake-proposal-coverage-pct">' + domainCoverage.percentage + '%</span>' +
		'</div>' +
		'<div class="intake-proposal-coverage-stats">' +
		domainCoverage.adequate + ' adequate, ' +
		domainCoverage.partial + ' partial, ' +
		domainCoverage.none + ' uncovered' +
		'</div></div>';

	// Footer prompt
	html += '<div class="intake-proposal-footer">' +
		'Review the proposal above. Share feedback, priorities, or questions to refine the approach.' +
		'</div>';

	html += '</div>';
	return html;
}

// ==================== Q&A EXCHANGE CARD ====================

function renderQaExchangeCard(question: string, answer: string, timestamp: string): string {
	return `
		<div class="qa-exchange-card">
			<div class="qa-exchange-question">
				<span class="qa-exchange-icon">&#x2753;</span>
				<div class="qa-exchange-question-text">${escapeHtml(question)}</div>
				<span class="qa-exchange-time">${formatTimestamp(timestamp)}</span>
			</div>
			<div class="qa-exchange-answer">
				<span class="qa-exchange-icon">&#x2139;&#xFE0E;</span>
				<div class="qa-exchange-answer-body">${simpleMarkdownToHtml(answer)}</div>
			</div>
		</div>
	`;
}


// ==================== STREAM RENDERER ====================



export function renderStream(items: StreamItem[], intakeState?: GovernedStreamState['intakeState']): string {

	if (items.length === 0) {

		return renderEmptyState();

	}



	// Pre-scan to find the last intake_turn and intake_plan_preview indices
	let lastIntakeTurnIdx = -1;
	let lastIntakePlanIdx = -1;
	items.forEach((item, idx) => {
		if (item.type === 'intake_turn') lastIntakeTurnIdx = idx;
		if (item.type === 'intake_plan_preview') lastIntakePlanIdx = idx;
	});

	let html = items.map((item, idx) => {

		switch (item.type) {

			case 'milestone':

				return renderMilestoneDivider(item.phase, item.timestamp);

			case 'turn':

				return renderRichCard(item.turn, item.claims, item.verdict);

			case 'gate':

				return renderHumanGateCard(item.gate, item.blockingClaims, item.resolvedAction, item.metadata);

			case 'verification_gate':

				return renderVerificationGateCard(item.gate, item.allClaims, item.verdicts, item.blockingClaims, item.resolvedAction);

			case 'review_gate':

				return renderReviewGateCard(item.gate, item.allClaims, item.verdicts,
					item.historianFindings, item.reviewItems, item.summary, item.resolvedAction, item.resolvedRationale);

			case 'dialogue_start':

				return renderDialogueStartMarker(item.dialogueId, item.goal, item.title, item.timestamp);

			case 'dialogue_end':

				return renderDialogueEndMarker(item.dialogueId, item.status, item.timestamp);

			case 'command_block':

				return renderCommandBlock(item.command, item.outputs);

			case 'intake_turn':

				return renderIntakeTurnCard(item.turn, item.timestamp, item.commandBlocks, idx === lastIntakeTurnIdx);

			case 'intake_plan_preview':

				return renderIntakePlanPreview(item.plan, item.isFinal, idx === lastIntakePlanIdx);

			case 'intake_approval_gate':

				return renderIntakeApprovalGate(item.plan, item.dialogueId, item.resolved, item.resolvedAction);

			case 'qa_exchange':

				return renderQaExchangeCard(item.question, item.answer, item.timestamp);

			case 'intake_mode_selector':

				return renderIntakeModeSelector(item.recommendation, item.resolved, item.selectedMode);

			case 'intake_checkpoint':

				return renderIntakeCheckpoint(item.checkpoint, item.resolved);

			case 'intake_domain_transition':

				return renderDomainTransitionCard(item.fromLabel, item.toDomain, item.toLabel, item.toDescription);

			case 'intake_gathering_complete':

				return renderGatheringCompleteBanner(item.coverageSummary, item.intakeMode);

			case 'intake_analysis':

				return renderIntakeAnalysisCard(item.humanMessage, item.analysisSummary, item.codebaseFindings, item.commandBlocks);

			case 'intake_proposal':

				return renderIntakeProposalCard(item.title, item.summary, item.proposedApproach, item.domainCoverage);

			default:

				return '';

		}

	}).join('');



	// Add domain coverage sidebar after first turn completes (avoid showing 0% prematurely)
	if (intakeState && intakeState.domainCoverage && intakeState.turnCount > 0) {
		html += renderDomainCoverageSidebar(intakeState.domainCoverage, intakeState.currentDomain);
	}

	// Add finalize button or resolved marker based on INTAKE sub-state
	if (intakeState && intakeState.turnCount > 0) {
		if (intakeState.subState === 'GATHERING') {
			html += renderIntakeQuestionsSubmitBar();
			html += renderIntakeGatheringFooter(intakeState);
		} else if (intakeState.subState === 'DISCUSSING') {
			html += renderIntakeQuestionsSubmitBar();
			html += renderIntakeFinalizeButton();
		} else if (intakeState.subState === 'SYNTHESIZING' || intakeState.subState === 'AWAITING_APPROVAL') {
			html += renderIntakeFinalizeResolved();
		}
	}



	return html;

}

