/**
 * General card renderers for the webview: milestones, dialogue markers,
 * rich turn cards, Q&A exchanges, and empty state.
 */

import { esc, formatTimestamp, formatPhaseLabel, simpleMarkdownToHtml, renderContentWithMarkdown } from './utils';
import type { DialogueEvent, Claim, Verdict } from './streamTypes';
import { SpeechAct, Role } from './streamTypes';

// ==================== Constants ====================

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

// ==================== Helpers ====================

function roleClass(role: string): string {
	return `role-${role.toLowerCase()}`;
}

export function verdictClass(status: string): string {
	switch (status) {
		case 'VERIFIED': return 'verified';
		case 'DISPROVED': return 'disproved';
		case 'UNKNOWN': return 'unknown';
		case 'CONDITIONAL': return 'conditional';
		default: return 'pending';
	}
}

export function verdictIcon(status: string): string {
	switch (status) {
		case 'VERIFIED': return '&#x2705;';
		case 'DISPROVED': return '&#x274C;';
		case 'UNKNOWN': return '&#x2753;';
		case 'CONDITIONAL': return '&#x26A0;';
		default: return '&#x26AA;';
	}
}

// ==================== Milestone Divider ====================

export function renderMilestoneDivider(phase: string, timestamp: string): string {
	return `
		<div class="milestone-divider">
			<div class="milestone-line"></div>
			<span class="milestone-label">Entering ${formatPhaseLabel(phase)} Phase</span>
			<span class="milestone-timestamp">${formatTimestamp(timestamp)}</span>
			<div class="milestone-line"></div>
		</div>
	`;
}

// ==================== Dialogue Start Marker ====================

export function renderDialogueStartMarker(dialogueId: string, goal: string, title: string | null, timestamp: string): string {
	const displayTitle = title ?? goal.substring(0, 60);
	const showGoalSeparately = title !== null && title !== goal;

	return `
		<div class="dialogue-start-marker" id="dialogue-${esc(dialogueId)}" data-dialogue-id="${esc(dialogueId)}">
			<div class="dialogue-marker-line"></div>
			<div class="dialogue-marker-content">
				<span class="dialogue-marker-icon">&#x1F4CD;</span>
				<span class="dialogue-marker-title" data-action="scroll-to-dialogue" data-dialogue-id="${esc(dialogueId)}">${esc(displayTitle)}</span>
				<span class="dialogue-marker-time">${formatTimestamp(timestamp)}</span>
			</div>
			${showGoalSeparately ? `<div class="dialogue-marker-goal">${esc(goal)}</div>` : ''}
			<div class="dialogue-marker-line"></div>
		</div>
	`;
}

// ==================== Dialogue End Marker ====================

export function renderDialogueEndMarker(dialogueId: string, status: string, timestamp: string): string {
	const statusLabel = status === 'COMPLETED' ? 'Completed' : 'Abandoned';
	const statusIcon = status === 'COMPLETED' ? '&#x2705;' : '&#x23F9;';
	const statusClass = status === 'COMPLETED' ? 'completed' : 'abandoned';
	const resumeBtn = status === 'ABANDONED'
		? `<button class="resume-btn" data-action="resume-dialogue" data-dialogue-id="${esc(dialogueId)}">Resume</button>`
		: '';

	return `
		<div class="dialogue-end-marker ${statusClass}" data-dialogue-id="${esc(dialogueId)}">
			<div class="dialogue-end-line"></div>
			<span class="dialogue-end-badge">${statusIcon} ${statusLabel}</span>
			${resumeBtn}
			<span class="dialogue-end-time">${formatTimestamp(timestamp)}</span>
			<div class="dialogue-end-line"></div>
		</div>
	`;
}

// ==================== Empty State ====================

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

// ==================== Q&A Exchange Card ====================

export function renderQaExchangeCard(question: string, answer: string, timestamp: string): string {
	return `
		<div class="qa-exchange-card">
			<div class="qa-exchange-question">
				<span class="qa-exchange-icon">&#x2753;</span>
				<div class="qa-exchange-question-text">${esc(question)}</div>
				<span class="qa-exchange-time">${formatTimestamp(timestamp)}</span>
			</div>
			<div class="qa-exchange-answer">
				<span class="qa-exchange-icon">&#x2139;&#xFE0E;</span>
				<div class="qa-exchange-answer-body">${simpleMarkdownToHtml(answer)}</div>
			</div>
		</div>
	`;
}

// ==================== Rich Card (Generic Turn) ====================

export function renderRichCard(turn: DialogueEvent, claims: Claim[], verdict?: Verdict): string {
	const rc = roleClass(turn.role);
	const icon = ROLE_ICONS[turn.role] ?? 'comment';
	const label = ROLE_LABELS[turn.role] ?? turn.role;

	const claimsHtml = claims.length > 0
		? `<ul class="claims-list">${claims.map((c) => renderClaimItem(c)).join('')}</ul>`
		: '';

	const verdictHtml = verdict
		? `<div style="margin-top: 8px;">${renderVerdictBadge(verdict)}</div>`
		: '';

	const contentHtml = renderTurnContent(turn);

	return `
		<div class="rich-card ${rc} collapsible-card expanded" data-turn-id="${turn.event_id}">
			<div class="collapsible-card-header card-header" data-action="toggle-card">
				<span class="card-chevron">&#x25B6;</span>
				<div class="card-header-left">
					<span class="role-icon codicon codicon-${icon}"></span>
					<span class="role-badge ${rc}">${esc(label)}</span>
					<span class="speech-act-tag">${esc(turn.speech_act)}</span>
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

// ==================== Turn Content ====================

export function renderTurnContent(turn: DialogueEvent): string {
	const contentRef = turn.content ?? turn.summary;
	if (turn.speech_act === SpeechAct.ASSUMPTION) {
		return renderAssumptionContent(contentRef);
	}
	if (turn.speech_act === SpeechAct.CLAIM && turn.phase === 'PROPOSE') {
		return renderProposalContent(contentRef);
	}
	return renderContentWithMarkdown(contentRef);
}

export function renderAssumptionContent(contentRef: string): string {
	try {
		const assumptions = JSON.parse(contentRef);
		if (!Array.isArray(assumptions) || assumptions.length === 0) {
			return `<div class="card-content">${esc(contentRef)}</div>`;
		}

		const items = assumptions.map((a: { statement?: string; criticality?: string; rationale?: string }) => {
			const criticality = a.criticality ?? 'UNKNOWN';
			const critClass = criticality === 'CRITICAL' ? 'critical' : 'non-critical';
			return `
				<div class="assumption-item">
					<div class="assumption-header">
						<span class="assumption-criticality ${critClass}">${esc(criticality)}</span>
						<span class="assumption-statement">${esc(a.statement ?? '')}</span>
					</div>
					${a.rationale ? `<div class="assumption-rationale">${esc(a.rationale)}</div>` : ''}
				</div>
			`;
		}).join('');

		return `<div class="assumption-list">${items}</div>`;
	} catch {
		return `<div class="card-content">${esc(contentRef)}</div>`;
	}
}

export function renderProposalContent(contentRef: string): string {
	let text = contentRef;
	try {
		const parsed = JSON.parse(contentRef);
		if (typeof parsed === 'string') {
			text = parsed;
		}
	} catch { /* use raw contentRef */ }
	return renderContentWithMarkdown(text);
}

// ==================== Claim Item ====================

export function renderClaimItem(claim: Claim): string {
	const vc = verdictClass(claim.status);
	const vi = verdictIcon(claim.status);
	return `
		<li class="claim-item" data-claim-id="${esc(claim.claim_id)}">
			<span class="verdict-badge ${vc}">${vi} ${esc(claim.status)}</span>
			<span>${esc(claim.statement)}</span>
		</li>
	`;
}

// ==================== Verdict Badge ====================

export function renderVerdictBadge(verdict: Verdict): string {
	const vc = verdictClass(verdict.verdict);
	const vi = verdictIcon(verdict.verdict);
	return `
		<span class="verdict-badge ${vc}">
			${vi} ${esc(verdict.verdict)}
		</span>
		${verdict.rationale ? `<span style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-left: 6px;">${esc(verdict.rationale)}</span>` : ''}
	`;
}
