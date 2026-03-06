/**

 * HTML Component Templates for Governed Stream

 * Each function returns an HTML string for a specific card type.

 */



import type { DialogueTurn, Claim, Verdict, Gate } from '../../../types';

import { Role, Phase, ClaimStatus, GateStatus, SpeechAct } from '../../../types';

import type { GovernedStreamState, ClaimHealthSummary, StreamItem, DialogueSummary, ReviewItem, ReviewSummary } from '../dataAggregator';

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



export function renderHumanGateCard(gate: Gate, blockingClaims: Claim[], resolvedAction?: string): string {
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
					<div class="gate-char-count" id="charcount-${escapeHtml(gate.gate_id)}">0 / 10 min</div>
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
				<div class="verification-claim-response">
					<label>Your response (min 10 characters)</label>
					<textarea
						placeholder="Explain why you accept this risk or disagree with the finding..."
						data-claim-rationale="${escapeHtml(claim.claim_id)}"
						data-gate-id="${escapeHtml(gate.gate_id)}"
					></textarea>
					<div class="verification-claim-charcount" id="vg-charcount-${escapeHtml(claim.claim_id)}">0 / 10 min</div>
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
					<span style="font-size: 11px;">&#x1F4DC; Findings</span>
				</div>
			` : ''}
		</div>
	`;

	// Render a single review item row
	function renderReviewItemRow(item: ReviewItem, showResponse: boolean): string {
		if (item.kind === 'claim' && item.claim) {
			return renderReviewClaimRow(item.claim, item.verdict, showResponse);
		} else if (item.kind === 'finding' && item.findingText) {
			return renderReviewFindingRow(item.findingText, item.findingIndex ?? 0, showResponse);
		}
		return '';
	}

	function renderReviewClaimRow(claim: Claim, verdict: Verdict | undefined, showResponse: boolean): string {
		const critClass = claim.criticality === 'CRITICAL' ? 'critical' : 'non-critical';
		const rationale = verdict?.rationale;

		let html = `
			<div class="review-item-row" data-claim-id="${escapeHtml(claim.claim_id)}">
				<div class="review-item-header">
					<span class="verdict-badge ${verdictClass(claim.status)}">${verdictIcon(claim.status)} ${escapeHtml(claim.status)}</span>
					<span class="verification-claim-criticality ${critClass}">${escapeHtml(claim.criticality)}</span>
				</div>
				<div class="review-item-statement">${escapeHtml(claim.statement)}</div>
		`;

		if (rationale) {
			html += `<div class="review-item-rationale">Verifier: ${escapeHtml(rationale)}</div>`;
		}

		if (showResponse && !isResolved) {
			html += `
				<div class="review-item-response">
					<textarea
						placeholder="Explain your decision on this claim..."
						data-review-item-rationale="${escapeHtml(claim.claim_id)}"
						data-gate-id="${gateId}"
					></textarea>
					<div class="review-item-charcount" id="review-charcount-${escapeHtml(claim.claim_id)}">0 / 10 min</div>
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
				<div class="review-item-response">
					<textarea
						placeholder="Your response to this finding..."
						data-review-item-rationale="${escapeHtml(findingKey)}"
						data-gate-id="${gateId}"
					></textarea>
					<div class="review-item-charcount" id="review-charcount-${escapeHtml(findingKey)}">0 / 10 min</div>
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
					${awareness.map((item) => renderReviewItemRow(item, false)).join('')}
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
				<div class="review-item-charcount" id="review-overall-charcount-${gateId}">0 characters</div>
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

						<span class="input-toolbar-hint">Type <kbd>@</kbd> to mention files &middot; <kbd>Enter</kbd> send &middot; <kbd>Shift+Enter</kbd> newline</span>

					</div>

					<button class="input-submit-btn" id="submit-btn">Send</button>

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



export function renderIntakeTurnCard(
	turn: IntakeConversationTurn,
	timestamp: string,
	commandBlocks?: Array<{ command: WorkflowCommandRecord; outputs: WorkflowCommandOutput[] }>,
	isLatest?: boolean,
): string {

	const expertResponse = turn.expertResponse;

	const suggestionsHtml = expertResponse.suggestedQuestions && expertResponse.suggestedQuestions.length > 0

		? `<div class="intake-suggestions">

				<span class="intake-suggestions-label">Consider asking:</span>

				<ul>${expertResponse.suggestedQuestions.map((q, i) => {
					const qId = `SQ-${i + 1}`;
					if (isLatest) {
						return `<li class="question-item">
							<span class="question-item-text">${escapeHtml(q)}</span>
							<div class="intake-question-response">
								<textarea class="intake-question-textarea"
									data-intake-question-id="${qId}"
									data-intake-question-text="${escapeHtml(q)}"
									placeholder="Type your response..."
									rows="2"></textarea>
								<span class="intake-question-charcount" data-charcount-for="${qId}">0 chars</span>
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



	const openQuestionsHtml = plan.openQuestions.length > 0

		? `<div class="intake-plan-section">

				<h5>Open Questions (${plan.openQuestions.length})</h5>

				<ul>${plan.openQuestions.map((q) => {
					if (isLatest) {
						return `<li class="question-item">
							<span class="question-item-text"><strong>[${escapeHtml(q.id)}]</strong> ${escapeHtml(q.text)}</span>
							<div class="intake-question-response">
								<textarea class="intake-question-textarea"
									data-intake-question-id="${escapeHtml(q.id)}"
									data-intake-question-text="${escapeHtml(q.text)}"
									placeholder="Type your answer..."
									rows="2"></textarea>
								<span class="intake-question-charcount" data-charcount-for="${escapeHtml(q.id)}">0 chars</span>
							</div>
						</li>`;
					} else {
						return `<li class="question-item"><span class="question-item-text"><strong>[${escapeHtml(q.id)}]</strong> ${escapeHtml(q.text)}</span></li>`;
					}
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

				return renderHumanGateCard(item.gate, item.blockingClaims, item.resolvedAction);

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

			default:

				return '';

		}

	}).join('');



	// Add finalize button or resolved marker based on INTAKE sub-state
	if (intakeState && intakeState.turnCount > 0) {
		if (intakeState.subState === 'DISCUSSING') {
			html += renderIntakeQuestionsSubmitBar();
			html += renderIntakeFinalizeButton();
		} else if (intakeState.subState === 'SYNTHESIZING' || intakeState.subState === 'AWAITING_APPROVAL') {
			html += renderIntakeFinalizeResolved();
		}
	}



	return html;

}

