/**

 * HTML Component Templates for Governed Stream

 * Each function returns an HTML string for a specific card type.

 */



import type { DialogueEvent, Claim, Verdict, Gate, IntakeModeRecommendation, EngineeringDomainCoverageMap, IntakeCheckpoint } from '../../../types';
import { Role, Phase, ClaimStatus, GateStatus, SpeechAct, IntakeMode, EngineeringDomainCoverageLevel } from '../../../types';

import type { GovernedStreamState, ClaimHealthSummary, StreamItem, DialogueSummary, ReviewItem, ReviewSummary } from '../dataAggregator';

import { WORKFLOW_PHASES, synthesizeReviewMMP } from '../dataAggregator';

import { getHumanFacingStateClass } from '../../../workflow/humanFacingState';

import type { WorkflowCommandRecord, WorkflowCommandOutput } from '../../../workflow/commandStore';

import type { IntakePlanDocument, IntakeConversationTurn, IntakeGatheringTurnResponse, IntakeTurnResponse } from '../../../types/intake';
import { isGatheringResponse } from '../../../types/intake';
import { DOMAIN_INFO, DOMAIN_SEQUENCE } from '../../../workflow/engineeringDomainCoverageTracker';
import type { MMPPayload } from '../../../types/mmp';



// ==================== HELPERS ====================



function escapeHtml(str: string): string {

	if (typeof str !== 'string') { str = String(str ?? ''); }

	return str

		.replaceAll('&', '&amp;')

		.replaceAll('<', '&lt;')

		.replaceAll('>', '&gt;')

		.replaceAll('"', '&quot;')

		.replaceAll("'", '&#039;');

}

/** Safely convert a value to a display string. Handles objects that LLMs return instead of plain strings. */
function stringifyItem(item: unknown): string {
	if (typeof item === 'string') {return item;}
	if (item === null || item === undefined) {return '';}
	if (typeof item === 'object') {
		// Try common field names LLMs use for single-value objects
		const obj = item as Record<string, unknown>;
		for (const key of ['text', 'description', 'metric', 'requirement', 'name', 'value', 'label', 'content']) {
			if (typeof obj[key] === 'string') {return obj[key] as string;}
		}
		// Fall back to joining all string values
		const parts = Object.entries(obj)
			.filter(([, v]) => typeof v === 'string' || typeof v === 'number')
			.map(([k, v]) => `${k}: ${v}`);
		if (parts.length > 0) {return parts.join(' | ');}
		return JSON.stringify(item);
	}
	return String(item);
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
	const disabled = _soxAvailable ? '' : ' disabled';
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
		.replaceAll(/`([^`]+)`/g, '<code>$1</code>')
		// Bold: **text** or __text__
		.replaceAll(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replaceAll(/__([^_]+)__/g, '<strong>$1</strong>')
		// Italic: *text* or _text_
		.replaceAll(/\*([^*]+)\*/g, '<em>$1</em>')
		.replaceAll(/\b_([^_]+)_\b/g, '<em>$1</em>');
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

	return phase.replaceAll('_', ' ');

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

	const subPhaseHtml = renderSubPhaseProgress(state);

	const switcherHtml = state.dialogueList.length > 0

		? renderDialogueSwitcher(state.dialogueList, state.activeDialogueId)

		: '';

	const humanStateHtml = renderHumanFacingStateBadge(state);

	const taskProgressHtml = renderTaskGraphProgressBar(state);

	return `

		<div class="sticky-header">

			<div class="header-top-row">

				<span class="header-title">Governed Stream</span>

				<button class="record-btn" data-action="recording-toggle" title="Record session">&#x23FA;</button>

				<button class="header-find-btn" data-action="toggle-find" title="Find (Ctrl+F)"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zm-5.242.156a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/></svg></button>

				${humanStateHtml}

				${switcherHtml}

			</div>

			<div class="phase-stepper">${phaseSteps}</div>

			${taskProgressHtml}

			<div class="subphase-progress-row">${subPhaseHtml}</div>

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

		const statusIcon = d.status === 'ACTIVE' ? '&#x1F7E2;'
			: d.status === 'COMPLETED' ? '&#x2705;'
			: '&#x23F9;';

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
	return '<div class="health-item" data-action="scroll-to-status" data-status="VERIFIED">' +
		'<span class="health-dot verified"></span>' +
		'<span class="health-count">' + health.verified + '</span>' +
		'<span class="health-label">Verified</span></div>' +
		'<div class="health-item" data-action="scroll-to-status" data-status="UNKNOWN">' +
		'<span class="health-dot unknown"></span>' +
		'<span class="health-count">' + health.unknown + '</span>' +
		'<span class="health-label">Unknown</span></div>' +
		'<div class="health-item" data-action="scroll-to-status" data-status="DISPROVED">' +
		'<span class="health-dot disproved"></span>' +
		'<span class="health-count">' + health.disproved + '</span>' +
		'<span class="health-label">Disproved</span></div>' +
		'<div class="health-item" data-action="scroll-to-status" data-status="OPEN">' +
		'<span class="health-dot open"></span>' +
		'<span class="health-count">' + health.open + '</span>' +
		'<span class="health-label">Open</span></div>';
}

// ==================== SUB-PHASE PROGRESS DIAGRAM ====================

/** Sub-phase step definition for the progress diagram */
interface SubPhaseStep {
	id: string;
	label: string;
	state: 'completed' | 'active' | 'pending' | 'retry';
	retryCount?: number;
}

/**
 * Render a contextual sub-phase progress diagram based on the current major phase.
 * Shows a branch-and-merge style flow with completed/active/pending indicators.
 */
function renderSubPhaseProgress(state: GovernedStreamState): string {
	const { currentPhase } = state;

	if (currentPhase === Phase.INTAKE && state.intakeState) {
		const plan = state.intakeState.currentPlan as Record<string, unknown> | null;
		const proposerPhase = plan?.proposerPhase as string | undefined;
		const preProposerReview = plan?.preProposerReview === true;
		return renderSubPhaseDiagram(buildIntakeSubPhases(state.intakeState.subState, state.intakeState.intakeMode, proposerPhase, preProposerReview));
	}
	if (currentPhase === Phase.ARCHITECTURE && state.architectureState) {
		return renderSubPhaseDiagram(buildArchitectureSubPhases(state.architectureState));
	}
	if ((currentPhase === Phase.VERIFY || currentPhase === Phase.HISTORICAL_CHECK) && state.claimHealth.total > 0) {
		return renderClaimHealthBar(state.claimHealth);
	}
	if (currentPhase === Phase.EXECUTE && state.taskGraphProgress) {
		return renderTaskSubPhases(state.taskGraphProgress);
	}
	// No sub-phase info available for this phase
	return '';
}

function buildIntakeSubPhases(subState: string, intakeMode: string | null, proposerPhase?: string, preProposerReview?: boolean): SubPhaseStep[] {
	// Proposer-Validator flow — show the full proposer sequence when in ANY proposer
	// or review sub-state, or when the intake mode is STATE_DRIVEN/DOCUMENT_BASED.
	const isProposerFlow = subState.startsWith('PROPOSING_')
		|| subState === 'PRODUCT_REVIEW'
		|| intakeMode === 'STATE_DRIVEN'
		|| intakeMode === 'DOCUMENT_BASED';
	if (isProposerFlow) {
		const steps = [
			{ id: 'INTENT_DISCOVERY', label: 'Discovery' },
			{ id: 'PROPOSING_BUSINESS_DOMAINS', label: 'Domains' },
			{ id: 'PROPOSING_JOURNEYS', label: 'Journeys' },
			{ id: 'PROPOSING_ENTITIES', label: 'Entities' },
			{ id: 'PROPOSING_INTEGRATIONS', label: 'Integrations' },
			{ id: 'SYNTHESIZING', label: 'Synthesize' },
			{ id: 'AWAITING_APPROVAL', label: 'Approve' },
		];
		// PRODUCT_REVIEW is a gate state — map it to the appropriate step:
		// - preProposerReview (after Intent Discovery): map to INTENT_DISCOVERY
		// - between proposer rounds: map to the proposer step that just completed
		let effectiveSubState = subState;
		if (subState === 'PRODUCT_REVIEW') {
			if (preProposerReview) {
				effectiveSubState = 'INTENT_DISCOVERY';
			} else if (proposerPhase) {
				const phaseToStep: Record<string | number, string> = {
					'BUSINESS_DOMAIN_MAPPING': 'PROPOSING_BUSINESS_DOMAINS',
					'JOURNEY_WORKFLOW': 'PROPOSING_JOURNEYS',
					'ENTITY_DATA_MODEL': 'PROPOSING_ENTITIES',
					'INTEGRATION_QUALITY': 'PROPOSING_INTEGRATIONS',
					1: 'PROPOSING_BUSINESS_DOMAINS',
					2: 'PROPOSING_JOURNEYS',
					3: 'PROPOSING_ENTITIES',
					4: 'PROPOSING_INTEGRATIONS',
				};
				effectiveSubState = phaseToStep[proposerPhase] ?? 'PROPOSING_BUSINESS_DOMAINS';
			}
		}
		return assignSubPhaseStates(steps, effectiveSubState);
	}
	// Standard inverted flow
	const steps = [
		{ id: 'INTENT_DISCOVERY', label: 'Discovery' },
		{ id: 'PROPOSING', label: 'Propose' },
		{ id: 'CLARIFYING', label: 'Clarify' },
		{ id: 'SYNTHESIZING', label: 'Synthesize' },
		{ id: 'AWAITING_APPROVAL', label: 'Approve' },
	];
	// PRODUCT_REVIEW maps to Discovery in standard flow too
	const effective = subState === 'PRODUCT_REVIEW' ? 'INTENT_DISCOVERY' : subState;
	return assignSubPhaseStates(steps, effective);
}

function buildArchitectureSubPhases(
	archState: NonNullable<GovernedStreamState['architectureState']>
): SubPhaseStep[] {
	const ordered = ['TECHNICAL_ANALYSIS', 'DECOMPOSING', 'MODELING', 'DESIGNING', 'SEQUENCING', 'VALIDATING', 'PRESENTING'];
	const labels: Record<string, string> = {
		TECHNICAL_ANALYSIS: 'Analyze', DECOMPOSING: 'Decompose', MODELING: 'Model', DESIGNING: 'Design',
		SEQUENCING: 'Sequence', VALIDATING: 'Validate', PRESENTING: 'Review',
	};
	const steps = assignSubPhaseStates(
		ordered.map(id => ({ id, label: labels[id] || id })),
		archState.subState
	);
	// Mark retry on VALIDATING or DESIGNING if validation has been attempted
	if (archState.validationAttempts > 0) {
		for (const step of steps) {
			if (step.id === 'VALIDATING' && step.state !== 'pending') {
				step.retryCount = archState.validationAttempts;
			}
			if (step.id === 'DESIGNING' && archState.validationAttempts > 0 && step.state === 'active') {
				step.state = 'retry';
				step.retryCount = archState.designIterations;
			}
			if (step.id === 'DECOMPOSING' && archState.validationAttempts > 0 && step.state === 'active') {
				step.state = 'retry';
			}
		}
	}
	return steps;
}

function renderTaskSubPhases(progress: NonNullable<GovernedStreamState['taskGraphProgress']>): string {
	const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
	return '<div class="subphase-task-progress">' +
		'<div class="subphase-task-bar">' +
		'<div class="subphase-task-fill" style="width:' + pct + '%"></div>' +
		'</div>' +
		'<span class="subphase-task-label">' + progress.completed + '/' + progress.total + ' tasks' +
		(progress.failed > 0 ? ' <span class="subphase-task-failed">(' + progress.failed + ' failed)</span>' : '') +
		(progress.in_progress > 0 ? ' <span class="subphase-task-active">(' + progress.in_progress + ' running)</span>' : '') +
		'</span></div>';
}

/** Assign completed/active/pending states based on current sub-state position in ordered list */
function assignSubPhaseStates(
	steps: Array<{ id: string; label: string }>,
	currentSubState: string
): SubPhaseStep[] {
	const currentIdx = steps.findIndex(s => s.id === currentSubState);
	return steps.map((step, idx) => ({
		...step,
		state: (idx < currentIdx ? 'completed'
			: idx === currentIdx ? 'active'
			: 'pending') as SubPhaseStep['state'],
	}));
}

/** Render the sub-phase diagram as a horizontal step flow */
function renderSubPhaseDiagram(steps: SubPhaseStep[]): string {
	let html = '<div class="subphase-diagram">';
	for (let i = 0; i < steps.length; i++) {
		const s = steps[i];
		const stateClass = s.state;
		const icon = s.state === 'completed' ? '&#x2713;'
			: s.state === 'active' ? '&#x25CF;'
			: s.state === 'retry' ? '&#x21BB;'
			: '&#x25CB;';
		html += '<div class="subphase-step ' + stateClass + '">' +
			'<span class="subphase-icon">' + icon + '</span>' +
			'<span class="subphase-label">' + escapeHtml(s.label) + '</span>';
		if (s.retryCount !== undefined && s.retryCount > 0) {
			html += '<span class="subphase-retry-badge">R' + s.retryCount + '</span>';
		}
		html += '</div>';
		if (i < steps.length - 1) {
			// Connector line — use retry style if going backward
			const nextStep = steps[i + 1];
			const connClass = nextStep.state === 'retry' ? 'subphase-connector retry' : 'subphase-connector';
			html += '<div class="' + connClass + '"></div>';
		}
	}
	html += '</div>';
	return html;
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



	// Render structured content based on speech act

	const contentHtml = renderTurnContent(turn);



	return `

		<div class="rich-card ${rc} collapsible-card expanded" data-turn-id="${turn.event_id}">

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

function renderTurnContent(turn: DialogueEvent): string {

	const contentRef = turn.content ?? turn.summary;

	if (turn.speech_act === SpeechAct.ASSUMPTION) {

		return renderAssumptionContent(contentRef);

	}



	if (turn.speech_act === SpeechAct.CLAIM && turn.phase === Phase.PROPOSE) {

		return renderProposalContent(contentRef);

	}



	return renderContentWithMarkdown(contentRef);

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
	const statusClass = status.replaceAll('_', '-');
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

	// Synthesize MMP from review findings (must be before hasMmpInteraction check)
	const reviewMMP = synthesizeReviewMMP(reviewItems, summary, _historianFindings);
	const mmpCardId = 'REV-' + gate.gate_seq;

	// When MMP is active and interactive, it becomes the primary interaction —
	// suppress duplicate review group rows and show a collapsed evidence detail section.
	const hasMmpInteraction = !!reviewMMP && !isResolved;

	let reviewGroupsHtml: string;
	if (hasMmpInteraction) {
		// Collapsed evidence detail section (MMP cards are primary above)
		reviewGroupsHtml = reviewItems.length > 0
			? `
				<div class="review-group evidence-detail collapsed">
					<div class="review-group-header" data-action="toggle-review-group">
						<span class="card-chevron">&#x25B6;</span>
						Detailed Evidence (${reviewItems.length} item${reviewItems.length !== 1 ? 's' : ''})
					</div>
					<div class="review-group-body">
						${reviewItems.map((item) => renderReviewItemRow(item, false)).join('')}
					</div>
				</div>
			`
			: '';
	} else {
		// Full review groups (no MMP or resolved state)
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

		reviewGroupsHtml = needsDecisionHtml + awarenessHtml + allClearHtml;
	}

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

	const reviewMmpHtml = reviewMMP
		? renderMMPSection(reviewMMP, mmpCardId, !isResolved, { type: 'review', gateId }, undefined)
		: '';

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
			${reviewMmpHtml}
			${reviewGroupsHtml}
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
	[Phase.ARCHITECTURE]: 'Review architecture or wait for decomposition...',
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



export function renderInputArea(currentPhase: Phase, hasOpenGates: boolean, gateContext?: string, isProcessing?: boolean): string {

	const placeholder = PHASE_PLACEHOLDERS[currentPhase] ?? 'Enter your message...';



	return `

		<div class="input-area">

			${isProcessing ? '<div class="input-actions processing-cancel-bar"><span class="processing-cancel-label"><span class="processing-spinner-inline"></span> Processing&hellip;</span><button class="cancel-btn" data-action="cancel-workflow" title="Cancel current operation">Cancel</button></div>' : ''}
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

					Generate a prose engineering document (PRD, Architecture Doc, etc.) from the current dialogue's data.

				</div>

				<button class="settings-btn" data-action="generate-document">Generate Document</button>

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

	hasReview?: boolean,

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



		// Reasoning reviews are now rendered as standalone stream items below the command block
		if (o.line_type === 'reasoning_review') {
			i += 1;
			continue;
		}

		// Flat line rendering (summary, detail, error)

		const lineClass = o.line_type === 'error' ? 'error' : o.line_type;

		outputLines += `<span class="cmd-line ${lineClass}">${escapeHtml(o.content)}</span>`;

		i += 1;

	}



	// Split output into visible/hidden sections for large outputs
	const OUTPUT_COLLAPSE_THRESHOLD = 20; // lines
	const OUTPUT_VISIBLE_LINES = 10;

	// Count rendered output lines (each <span class="cmd-line"> or <div class="cmd-*">)
	const lineMatches = outputLines.match(/<span class="cmd-line|<div class="cmd-stdin-block|<div class="tool-call-card/g);
	const outputLineCount = lineMatches ? lineMatches.length : 0;

	let outputHtml: string;
	if (outputLineCount > OUTPUT_COLLAPSE_THRESHOLD) {
		// Split output at the Nth line boundary
		const lineRegex = /(<span class="cmd-line[^>]*>.*?<\/span>|<div class="cmd-stdin-block[\s\S]*?<\/div>\s*<\/div>|<div class="tool-call-card[\s\S]*?<\/div>\s*<\/div>\s*<\/div>)/g;
		const allLines: string[] = [];
		let match: RegExpExecArray | null;
		let lastIndex = 0;
		while ((match = lineRegex.exec(outputLines)) !== null) {
			// Include any text between matches (whitespace, etc.)
			if (match.index > lastIndex) {
				const between = outputLines.slice(lastIndex, match.index);
				if (allLines.length > 0) { allLines[allLines.length - 1] += between; }
			}
			allLines.push(match[0]);
			lastIndex = match.index + match[0].length;
		}

		const visibleLines = allLines.slice(0, OUTPUT_VISIBLE_LINES).join('');
		const hiddenLines = allLines.slice(OUTPUT_VISIBLE_LINES).join('');
		const hiddenCount = allLines.length - OUTPUT_VISIBLE_LINES;
		const totalChars = outputLines.length;
		const sizeLabel = totalChars < 1024
			? `${totalChars} chars`
			: totalChars < 1048576
				? `${(totalChars / 1024).toFixed(1)} KB`
				: `${(totalChars / 1048576).toFixed(1)} MB`;

		outputHtml = `<div class="cmd-output-collapsed">`
			+ `<div class="cmd-output-visible">${visibleLines}</div>`
			+ `<div class="cmd-output-hidden" style="display:none;">${hiddenLines}</div>`
			+ `<button class="cmd-output-expand-btn" data-action="toggle-cmd-output" data-expand-label="Show ${hiddenCount} more lines (${sizeLabel})">`
			+ `Show ${hiddenCount} more lines (${sizeLabel})`
			+ `</button>`
			+ `</div>`;
	} else {
		outputHtml = outputLines;
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

				${hasReview ? '<span class="command-block-review-badge">&#x1F50D; Review</span>' : ''}

				<span class="command-block-time">${time}</span>

			</div>

			<div class="command-block-body">

				<div class="command-block-output">${outputHtml}</div>

				${retryBar}

			</div>

		</div>

	`;

}



// ==================== MIRROR & MENU PROTOCOL (MMP) COMPONENTS ====================

/**
 * Render a complete MMP section (Mirror + Menu + Pre-Mortem cards + submit bar).
 * Used by both intake turn cards and gate cards.
 * @param mmp The MMP payload to render
 * @param cardId Unique identifier for this MMP instance (e.g., "T3" for turn 3)
 * @param isLatest Whether this is the latest (interactive) turn — false renders read-only
 */
/** Pending MMP decisions loaded from SQLite — baked into HTML at render time. */
export interface PendingMmpSnapshot {
	mirrorDecisions: Record<string, { status: string; editedText?: string }>;
	menuSelections: Record<string, { selectedOptionId: string; customResponse?: string }>;
	preMortemDecisions: Record<string, { status: string; rationale?: string }>;
}

/** Render a small source attribution badge for MMP items */
function renderSourceBadge(source: string): string {
	const sourceMap: Record<string, { label: string; cssClass: string }> = {
		'document-specified': { label: 'DOC', cssClass: 'badge-source-doc' },
		'user-specified': { label: 'USER', cssClass: 'badge-source-user' },
		'domain-standard': { label: 'STANDARD', cssClass: 'badge-source-standard' },
		'ai-proposed': { label: 'AI', cssClass: 'badge-source-ai' },
	};
	const info = sourceMap[source] ?? { label: source.toUpperCase(), cssClass: 'badge-source-ai' };
	return '<span class="badge-source ' + info.cssClass + '" title="Source: ' + escapeHtml(source) + '">' + info.label + '</span>';
}

function renderMMPSection(
	mmp: MMPPayload,
	cardId: string,
	isLatest: boolean,
	context?: { type: string; gateId?: string },
	pending?: PendingMmpSnapshot,
): string {
	const parts: string[] = [];

	if (mmp.mirror) {
		parts.push(renderMirrorCard(mmp.mirror, cardId, isLatest, pending));
	}

	if (mmp.menu) {
		if (parts.length > 0) { parts.push('<div class="mmp-section-separator"></div>'); }
		parts.push(renderMenuCard(mmp.menu, cardId, isLatest, pending));
	}

	if (mmp.preMortem) {
		if (parts.length > 0) { parts.push('<div class="mmp-section-separator"></div>'); }
		parts.push(renderPreMortemCard(mmp.preMortem, cardId, isLatest, pending));
	}

	// Add submit bar for interactive MMP — with server-side progress
	if (isLatest && parts.length > 0) {
		parts.push(renderMMPSubmitBar(cardId, mmp, pending));
	}

	const contextAttrs = context
		? ` data-mmp-context="${context.type}" data-mmp-gate-id="${context.gateId ?? ''}"`
		: '';

	return parts.length > 0
		? '<div class="mmp-container" data-mmp-card-id="' + cardId + '"' + contextAttrs + '>' + parts.join('') + '</div>'
		: '';
}

/**
 * Render a Mirror card with per-item accept/reject/edit toggles.
 */
function renderMirrorCard(
	mirror: NonNullable<MMPPayload['mirror']>,
	cardId: string,
	isLatest: boolean,
	pending?: PendingMmpSnapshot,
): string {
	const itemsHtml = mirror.items.map((item) => {
		const itemKey = cardId + ':' + item.id;
		const categoryClass = item.category;
		// Check pending decisions for this item (baked into HTML at render time)
		const pendingDecision = pending?.mirrorDecisions[itemKey];
		const effectiveStatus = pendingDecision?.status ?? (item.status !== 'pending' ? item.status : null);
		const statusClass = effectiveStatus ? ' ' + effectiveStatus : '';
		const resolvedClass = !isLatest && item.status !== 'pending' ? ' resolved' : '';

		const resolvedBadge = !isLatest && item.status !== 'pending'
			? '<span class="mmp-resolved-badge ' + item.status + '">' +
				(item.status === 'accepted' ? '\u2713 Accepted' : item.status === 'rejected' ? '\u2717 Rejected' : item.status === 'deferred' ? '\u23F3 Deferred' : '\u270E Edited') +
				'</span>'
			: '';

		const editedTextNote = item.status === 'edited' && item.editedText
			? '<div class="mmp-mirror-item-edit-note" style="font-size:12px;color:var(--vscode-descriptionForeground);margin-top:4px;font-style:italic;">' +
				'Edited: ' + escapeHtml(item.editedText) + '</div>'
			: '';

		const sourceBadge = item.source ? renderSourceBadge(item.source) : '';

		return '<div class="mmp-mirror-item' + statusClass + resolvedClass + '" data-mmp-mirror-id="' + escapeHtml(item.id) + '" data-mmp-card="' + cardId + '">' +
			'<div class="mmp-mirror-item-header">' +
				'<span class="mmp-category-badge ' + categoryClass + '">' + escapeHtml(item.category) + '</span>' +
				sourceBadge +
				'<span class="mmp-mirror-item-text">' + escapeHtml(item.text) + '</span>' +
				resolvedBadge +
			'</div>' +
			(item.rationale
				? '<div class="mmp-mirror-item-rationale" id="rationale-' + itemKey + '">' +
					'<em>Rationale:</em> ' + escapeHtml(item.rationale) + '</div>'
				: '') +
			editedTextNote +
			(isLatest
				? '<div class="mmp-mirror-item-actions">' +
					'<button class="mmp-btn mmp-accept' + (pendingDecision?.status === 'accepted' ? ' selected' : '') + '" data-action="mirror-accept" data-mmp-item="' + escapeHtml(item.id) + '" data-mmp-card="' + cardId + '" title="Accept this assumption">\u2713 Accept</button>' +
					'<button class="mmp-btn mmp-reject' + (pendingDecision?.status === 'rejected' ? ' selected' : '') + '" data-action="mirror-reject" data-mmp-item="' + escapeHtml(item.id) + '" data-mmp-card="' + cardId + '" title="Reject this assumption">\u2717 Reject</button>' +
					'<button class="mmp-btn mmp-defer' + (pendingDecision?.status === 'deferred' ? ' selected' : '') + '" data-action="mirror-defer" data-mmp-item="' + escapeHtml(item.id) + '" data-mmp-card="' + cardId + '" title="Defer to a later phase">\u23F3 Defer</button>' +
					'<button class="mmp-btn mmp-edit' + (pendingDecision?.status === 'edited' ? ' selected' : '') + '" data-action="mirror-edit" data-mmp-item="' + escapeHtml(item.id) + '" data-mmp-card="' + cardId + '" title="Edit this assumption">\u270E Edit</button>' +
					(item.rationale
						? '<button class="mmp-btn mmp-rationale-toggle" data-action="mirror-rationale" data-mmp-item="' + escapeHtml(item.id) + '" data-mmp-card="' + cardId + '" title="Show rationale">Why?</button>'
						: '') +
				  '</div>' +
				  '<div class="mmp-mirror-item-edit-area" id="edit-area-' + itemKey + '">' +
					'<textarea data-mmp-edit-textarea="' + escapeHtml(item.id) + '" data-mmp-card="' + cardId + '" placeholder="Edit the assumption..." rows="2">' + escapeHtml(item.text) + '</textarea>' +
				  '</div>'
				: '') +
		'</div>';
	}).join('');

	return '<div class="mmp-card mmp-mirror-card">' +
		'<div class="mmp-card-header">' +
			'<span class="mmp-card-header-icon">\uD83D\uDCAD</span>' +
			'<span>Mirror: Here\'s what I understand</span>' +
		'</div>' +
		'<div class="mmp-card-body">' +
			(mirror.steelMan
				? '<div class="mmp-mirror-steelman">' + escapeHtml(mirror.steelMan) + '</div>'
				: '') +
			itemsHtml +
		'</div>' +
	'</div>';
}

/**
 * Render inline MMP mirror buttons for a single item (used by proposer cards).
 * Wraps the content in a `.mmp-mirror-item` container with proper data attributes
 * so the submit handler can find it. The `contentHtml` is the domain/journey/entity
 * card content that replaces the mirror item's re-listed description.
 */
function renderInlineMirrorButtons(
	mirrorItemId: string,
	mirrorText: string,
	cardId: string,
	isLatest: boolean,
	contentHtml: string,
	pending?: PendingMmpSnapshot,
	source?: string,
): string {
	const itemKey = cardId + ':' + mirrorItemId;
	const pendingDecision = pending?.mirrorDecisions[itemKey];
	const effectiveStatus = pendingDecision?.status ?? null;
	const statusClass = effectiveStatus ? ' ' + effectiveStatus : '';

	const sourceBadge = source ? renderSourceBadge(source) : '';

	let html = '<div class="mmp-mirror-item proposer-inline-mmp' + statusClass + '" data-mmp-mirror-id="' + escapeHtml(mirrorItemId) + '" data-mmp-card="' + cardId + '">';

	// Source attribution badge (DOC, AI, STANDARD, USER)
	if (sourceBadge) { html += sourceBadge; }

	// The actual content (domain description, entity details, etc.)
	html += contentHtml;

	// Hidden text for submit enrichment only (submit handler reads .mmp-mirror-item-text
	// to annotate decisions with human-readable context in the payload)
	html += '<span class="mmp-mirror-item-text mmp-hidden-text">' + escapeHtml(mirrorText) + '</span>';

	// Buttons (only when interactive)
	if (isLatest) {
		const askMoreId = cardId + '-' + mirrorItemId;
		html += '<div class="mmp-mirror-item-actions">' +
			'<button class="mmp-btn mmp-accept' + (pendingDecision?.status === 'accepted' ? ' selected' : '') + '" data-action="mirror-accept" data-mmp-item="' + escapeHtml(mirrorItemId) + '" data-mmp-card="' + cardId + '" title="Accept">\u2713 Accept</button>' +
			'<button class="mmp-btn mmp-reject' + (pendingDecision?.status === 'rejected' ? ' selected' : '') + '" data-action="mirror-reject" data-mmp-item="' + escapeHtml(mirrorItemId) + '" data-mmp-card="' + cardId + '" title="Reject">\u2717 Reject</button>' +
			'<button class="mmp-btn mmp-defer' + (pendingDecision?.status === 'deferred' ? ' selected' : '') + '" data-action="mirror-defer" data-mmp-item="' + escapeHtml(mirrorItemId) + '" data-mmp-card="' + cardId + '" title="Defer">\u23F3 Defer</button>' +
			'<button class="mmp-btn mmp-edit' + (pendingDecision?.status === 'edited' ? ' selected' : '') + '" data-action="mirror-edit" data-mmp-item="' + escapeHtml(mirrorItemId) + '" data-mmp-card="' + cardId + '" title="Edit">\u270E Edit</button>' +
			'<button class="mmp-btn mmp-askmore ask-more-toggle" data-action="toggle-askmore" data-clarification-item="' + escapeHtml(askMoreId) + '" data-clarification-context="' + escapeHtml(mirrorText) + '" title="Ask a question about this item">Ask More</button>' +
			'</div>' +
			'<div class="mmp-mirror-item-edit-area" id="edit-area-' + itemKey + '">' +
			'<textarea data-mmp-edit-textarea="' + escapeHtml(mirrorItemId) + '" data-mmp-card="' + cardId + '" placeholder="Describe your changes or corrections..." rows="2"></textarea>' +
			'</div>' +
			// Ask More clarification area (inline thread)
			'<div class="clarification-response-area" data-clarification-item="' + escapeHtml(askMoreId) + '">' +
			'<div class="clarification-messages" id="clarification-messages-' + escapeHtml(askMoreId) + '"></div>' +
			'<textarea placeholder="Ask about this item..." rows="2" data-original-placeholder="Ask about this item..."></textarea>' +
			'<div class="response-toolbar">' +
			'</div>' +
			'</div>';
	} else {
		// Readonly — show resolved badge if decided
		if (effectiveStatus) {
			const badge = effectiveStatus === 'accepted' ? '\u2713 Accepted' :
				effectiveStatus === 'rejected' ? '\u2717 Rejected' :
				effectiveStatus === 'deferred' ? '\u23F3 Deferred' : '\u270E Edited';
			html += '<span class="mmp-resolved-badge ' + effectiveStatus + '">' + badge + '</span>';
		}
	}

	html += '</div>';
	return html;
}

/**
 * Render a Menu card with selectable option cards.
 */
function renderMenuCard(
	menu: NonNullable<MMPPayload['menu']>,
	cardId: string,
	isLatest: boolean,
	pending?: PendingMmpSnapshot,
): string {
	const itemsHtml = menu.items.map((item) => {
		const menuKey = cardId + ':' + item.id;
		const pendingSelection = pending?.menuSelections[menuKey];
		const resolvedClass = !isLatest && item.selectedOptionId ? ' resolved' : '';

		const optionsHtml = item.options.map((opt) => {
			const isSelected = (pendingSelection?.selectedOptionId === opt.optionId) || item.selectedOptionId === opt.optionId;
			const selectedClass = isSelected ? ' selected' : '';
			const recommendedClass = opt.recommended ? ' recommended' : '';

			return '<div class="mmp-option-card' + selectedClass + recommendedClass + '" ' +
				(isLatest ? 'data-action="menu-select" ' : '') +
				'data-mmp-menu-id="' + escapeHtml(item.id) + '" ' +
				'data-mmp-option-id="' + escapeHtml(opt.optionId) + '" ' +
				'data-mmp-card="' + cardId + '">' +
				'<div class="mmp-option-header">' +
					'<span class="mmp-option-radio"></span>' +
					'<span class="mmp-option-label">' + escapeHtml(opt.label) + '</span>' +
					(opt.recommended ? '<span class="mmp-option-recommended-badge">\u2605 Recommended</span>' : '') +
				'</div>' +
				(opt.description ? '<div class="mmp-option-description">' + escapeHtml(opt.description) + '</div>' : '') +
				(opt.tradeoffs ? '<div class="mmp-option-tradeoffs">Tradeoff: ' + escapeHtml(opt.tradeoffs) + '</div>' : '') +
			'</div>';
		}).join('');

		// Add "Other" option for interactive items
		const otherOption = isLatest
			? '<div class="mmp-option-card other-option" ' +
				'data-action="menu-select" ' +
				'data-mmp-menu-id="' + escapeHtml(item.id) + '" ' +
				'data-mmp-option-id="OTHER" ' +
				'data-mmp-card="' + cardId + '">' +
				'<div class="mmp-option-header">' +
					'<span class="mmp-option-radio"></span>' +
					'<span class="mmp-option-label">Other</span>' +
				'</div>' +
				'<textarea class="mmp-menu-custom-textarea" ' +
					'data-mmp-custom-textarea="' + escapeHtml(item.id) + '" ' +
					'data-mmp-card="' + cardId + '" ' +
					'placeholder="Describe your preference..." rows="2"></textarea>' +
			  '</div>'
			: '';

		// Show custom response for resolved items
		const customNote = !isLatest && item.selectedOptionId === 'OTHER' && item.customResponse
			? '<div style="font-size:12px;color:var(--vscode-descriptionForeground);margin-top:4px;font-style:italic;">Custom: ' +
				escapeHtml(item.customResponse) + '</div>'
			: '';

		return '<div class="mmp-menu-item' + resolvedClass + '">' +
			'<div class="mmp-menu-question">' + escapeHtml(item.question) + '</div>' +
			(item.context ? '<div class="mmp-menu-context">' + escapeHtml(item.context) + '</div>' : '') +
			'<div class="mmp-menu-options">' +
				optionsHtml +
				otherOption +
			'</div>' +
			customNote +
		'</div>';
	}).join('');

	return '<div class="mmp-card mmp-menu-card">' +
		'<div class="mmp-card-header">' +
			'<span class="mmp-card-header-icon">\uD83D\uDCCB</span>' +
			'<span>Menu: Decisions needed</span>' +
		'</div>' +
		'<div class="mmp-card-body">' +
			itemsHtml +
		'</div>' +
	'</div>';
}

/**
 * Render a Pre-Mortem card with risk items.
 */
function renderPreMortemCard(
	preMortem: NonNullable<MMPPayload['preMortem']>,
	cardId: string,
	isLatest: boolean,
	pending?: PendingMmpSnapshot,
): string {
	const itemsHtml = preMortem.items.map((item) => {
		const itemKey = cardId + ':' + item.id;
		const pendingDecision = pending?.preMortemDecisions[itemKey];
		const effectiveStatus = pendingDecision?.status ?? (item.status !== 'pending' ? item.status : null);
		const statusClass = effectiveStatus ? ' ' + effectiveStatus : '';
		const resolvedClass = !isLatest && item.status !== 'pending' ? ' resolved' : '';

		const resolvedBadge = !isLatest && item.status !== 'pending'
			? '<span class="mmp-resolved-badge ' + item.status + '">' +
				(item.status === 'accepted' ? '\u2713 Risk Accepted' : '\u2717 Unacceptable') +
				'</span>'
			: '';

		return '<div class="mmp-premortem-item' + statusClass + resolvedClass + '" data-mmp-premortem-id="' + escapeHtml(item.id) + '" data-mmp-card="' + cardId + '">' +
			'<div class="mmp-premortem-item-header">' +
				'<span class="mmp-severity-badge ' + item.severity + '">' + escapeHtml(item.severity) + '</span>' +
				'<span class="mmp-premortem-assumption">' + escapeHtml(item.assumption) + '</span>' +
				resolvedBadge +
			'</div>' +
			'<div class="mmp-premortem-failure">' +
				'<strong>If this fails:</strong> ' + escapeHtml(item.failureScenario) +
			'</div>' +
			(item.mitigation
				? '<div class="mmp-premortem-mitigation">' +
					'<strong>Mitigation:</strong> ' + escapeHtml(item.mitigation) +
				  '</div>'
				: '') +
			(isLatest
				? '<div class="mmp-premortem-item-actions">' +
					'<button class="mmp-btn mmp-accept' + (pendingDecision?.status === 'accepted' ? ' selected' : '') + '" data-action="premortem-accept" data-mmp-item="' + escapeHtml(item.id) + '" data-mmp-card="' + cardId + '" title="Accept this risk">\u2713 Accept Risk</button>' +
					'<button class="mmp-btn mmp-reject' + (pendingDecision?.status === 'rejected' ? ' selected' : '') + '" data-action="premortem-reject" data-mmp-item="' + escapeHtml(item.id) + '" data-mmp-card="' + cardId + '" title="This risk is unacceptable">\u2717 Unacceptable</button>' +
				  '</div>' +
				  '<div class="mmp-premortem-rationale-area" id="pm-rationale-' + itemKey + '">' +
					'<textarea data-mmp-pm-rationale="' + escapeHtml(item.id) + '" data-mmp-card="' + cardId + '" placeholder="Why is this risk unacceptable?" rows="2"></textarea>' +
				  '</div>'
				: '') +
			(item.rationale && !isLatest
				? '<div style="font-size:12px;color:var(--vscode-descriptionForeground);margin-top:4px;font-style:italic;">Rationale: ' + escapeHtml(item.rationale) + '</div>'
				: '') +
		'</div>';
	}).join('');

	return '<div class="mmp-card mmp-premortem-card">' +
		'<div class="mmp-card-header">' +
			'<span class="mmp-card-header-icon">\u26A0\uFE0F</span>' +
			'<span>Pre-Mortem: Risks to evaluate</span>' +
		'</div>' +
		'<div class="mmp-card-body">' +
			(preMortem.summary
				? '<div class="mmp-premortem-summary">' + escapeHtml(preMortem.summary) + '</div>'
				: '') +
			itemsHtml +
		'</div>' +
	'</div>';
}

/**
 * Render the MMP submit bar with server-side progress tracking.
 */
function renderMMPSubmitBar(cardId: string, mmp?: MMPPayload, pending?: PendingMmpSnapshot): string {
	// Compute progress server-side
	const prefix = cardId + ':';
	let mirrorTotal = 0, mirrorDone = 0;
	let menuTotal = 0, menuDone = 0;
	let pmTotal = 0, pmDone = 0;
	if (mmp?.mirror) {
		mirrorTotal = mmp.mirror.items.length;
		for (const item of mmp.mirror.items) {
			if (pending?.mirrorDecisions[prefix + item.id] || item.status !== 'pending') { mirrorDone++; }
		}
	}
	if (mmp?.menu) {
		const menuIds = new Set(mmp.menu.items.map(m => m.id));
		menuTotal = menuIds.size;
		for (const id of menuIds) {
			if (pending?.menuSelections[prefix + id]) { menuDone++; }
		}
	}
	if (mmp?.preMortem) {
		pmTotal = mmp.preMortem.items.length;
		for (const item of mmp.preMortem.items) {
			if (pending?.preMortemDecisions[prefix + item.id] || item.status !== 'pending') { pmDone++; }
		}
	}
	const progressParts: string[] = [];
	if (mirrorTotal > 0) { progressParts.push('Mirror: ' + mirrorDone + '/' + mirrorTotal); }
	if (menuTotal > 0) { progressParts.push('Menu: ' + menuDone + '/' + menuTotal); }
	if (pmTotal > 0) { progressParts.push('Risks: ' + pmDone + '/' + pmTotal); }
	const progressHtml = progressParts.join(' &middot; ');

	// Bulk action buttons for Mirror and Pre-Mortem items
	const hasMirror = mirrorTotal > 0;
	const hasPm = pmTotal > 0;
	const bulkHtml = (hasMirror || hasPm)
		? '<div class="mmp-bulk-actions">' +
			(hasMirror
				? '<button class="mmp-bulk-btn mmp-bulk-accept" data-action="mmp-bulk" data-mmp-card="' + cardId + '" data-mmp-bulk-action="accept" title="Accept all Mirror items">&#x2713; Accept All</button>' +
				  '<button class="mmp-bulk-btn mmp-bulk-reject" data-action="mmp-bulk" data-mmp-card="' + cardId + '" data-mmp-bulk-action="reject" title="Reject all Mirror items">&#x2717; Reject All</button>' +
				  '<button class="mmp-bulk-btn mmp-bulk-defer" data-action="mmp-bulk" data-mmp-card="' + cardId + '" data-mmp-bulk-action="defer" title="Defer all Mirror items">&#x23F3; Defer All</button>'
				: '') +
			(hasPm
				? '<button class="mmp-bulk-btn mmp-bulk-accept-pm" data-action="mmp-bulk-pm" data-mmp-card="' + cardId + '" data-mmp-bulk-action="accept" title="Accept all risks">&#x2713; Accept All Risks</button>' +
				  '<button class="mmp-bulk-btn mmp-bulk-reject-pm" data-action="mmp-bulk-pm" data-mmp-card="' + cardId + '" data-mmp-bulk-action="reject" title="Reject all risks">&#x2717; Reject All Risks</button>'
				: '') +
			'</div>'
		: '';

	return '<div class="mmp-submit-bar" data-mmp-submit-bar="' + cardId + '">' +
		bulkHtml +
		'<span class="mmp-submit-progress" data-mmp-progress="' + cardId + '">' + progressHtml + '</span>' +
		'<button class="mmp-submit-btn" data-action="mmp-submit" data-mmp-card="' + cardId + '">Submit Decisions</button>' +
	'</div>';
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
	eventId?: number,
): string {
	const domainInfo = DOMAIN_INFO[response.focusEngineeringDomain];
	const domainLabel = domainInfo ? domainInfo.label : response.focusEngineeringDomain;

	const engineeringDomainNotesHtml = response.engineeringDomainNotes.length > 0
		? '<div class="intake-domain-notes"><ul>' +
			response.engineeringDomainNotes.map((n) => '<li>' + escapeHtml(n) + '</li>').join('') +
			'</ul></div>'
		: '';

	const findingsHtml = response.codebaseFindings && response.codebaseFindings.length > 0
		? '<div class="intake-findings">' +
			'<span class="intake-findings-label">Codebase findings:</span>' +
			'<ul>' + response.codebaseFindings.map((f) => '<li><code>' + escapeHtml(f) + '</code></li>').join('') + '</ul>' +
			'</div>'
		: '';

	// Prefer MMP over legacy followUpQuestions
	const hasMMP = response.mmp && (response.mmp.mirror || response.mmp.menu || response.mmp.preMortem);
	const mmpCardId = 'GT-' + (eventId ?? turn.turnNumber);
	const mmpHtml = hasMMP
		? renderMMPSection(response.mmp!, mmpCardId, !!isLatest)
		: '';

	const followUpHtml = !hasMMP && response.followUpQuestions && response.followUpQuestions.length > 0
		? '<div class="intake-suggestions">' +
			'<span class="intake-suggestions-label">Consider asking:</span>' +
			'<ul>' + response.followUpQuestions.map((q, i) => {
				const qId = 'GQ-T' + turn.turnNumber + '-' + (i + 1);
				if (isLatest) {
					return '<li class="question-item">' +
						'<span class="question-item-text">' + applyInlineFormatting(escapeHtml(q)) + '</span>' +
						'<div class="intake-question-response" data-clarification-item="' + qId + '">' +
						'<div class="clarification-messages" id="clarification-messages-' + qId + '" style="display:none;"></div>' +
						'<textarea class="intake-question-textarea" data-intake-question-id="' + qId + '" data-intake-question-text="' + escapeHtml(q) + '" placeholder="Type your response..." rows="2"></textarea>' +
						'<div class="response-toolbar">' +
						'<span class="intake-question-charcount" data-charcount-for="' + qId + '">0 chars</span>' +
						renderMicButton('intake-question:' + qId) +
						renderAskMoreToggle(qId, q) +
						'</div></div></li>';
				}
				return '<li class="question-item"><span class="question-item-text">' + applyInlineFormatting(escapeHtml(q)) + '</span></li>';
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
		engineeringDomainNotesHtml +
		mmpHtml +
		followUpHtml +
		findingsHtml +
		'</div></div></div>';
}

export function renderIntakeTurnCard(
	turn: IntakeConversationTurn,
	timestamp: string,
	commandBlocks?: Array<{ command: WorkflowCommandRecord; outputs: WorkflowCommandOutput[] }>,
	isLatest?: boolean,
	eventId?: number,
): string {

	// Delegate to gathering-specific renderer for interviewer turns
	if (isGatheringResponse(turn.expertResponse)) {
		return renderGatheringTurnCard(turn, turn.expertResponse, timestamp, commandBlocks, isLatest, eventId);
	}

	// After filtering out gathering responses above, the remaining type is
	// IntakeTurnResponse | IntakeAnalysisTurnResponse. Analysis turns are rendered
	// by renderIntakeAnalysisCard, not here, so narrow to IntakeTurnResponse.
	const expertResponse = turn.expertResponse as IntakeTurnResponse;

	// Prefer MMP over legacy suggestedQuestions
	const mmpSource = expertResponse.mmp;
	const hasMMP = mmpSource && (mmpSource.mirror || mmpSource.menu || mmpSource.preMortem);
	const mmpCardId = 'T-' + (eventId ?? turn.turnNumber);

	const mmpHtml = hasMMP
		? renderMMPSection(mmpSource!, mmpCardId, !!isLatest)
		: '';

	// Only render legacy suggestedQuestions if no MMP present
	const suggestionsHtml = !hasMMP && expertResponse.suggestedQuestions && expertResponse.suggestedQuestions.length > 0

		? `<div class="intake-suggestions">

				<span class="intake-suggestions-label">Consider asking:</span>

				<ul>${expertResponse.suggestedQuestions.map((q, i) => {
					const qId = `SQ-T${turn.turnNumber}-${i + 1}`;
					if (isLatest) {
						return `<li class="question-item">
							<span class="question-item-text">${applyInlineFormatting(escapeHtml(q))}</span>
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
						return `<li class="question-item"><span class="question-item-text">${applyInlineFormatting(escapeHtml(q))}</span></li>`;
					}
				}).join('')}</ul>

			</div>`

		: '';



	const findingsHtml = expertResponse.codebaseFindings && expertResponse.codebaseFindings.length > 0

		? `<div class="intake-findings">

				<span class="intake-findings-label">Codebase findings:</span>

				<ul>${expertResponse.codebaseFindings.map((f: string) => `<li><code>${escapeHtml(f)}</code></li>`).join('')}</ul>

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

					${mmpHtml}

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



	const requirements = plan.requirements ?? [];
	const decisions = plan.decisions ?? [];
	const constraints = plan.constraints ?? [];
	const openQuestions = plan.openQuestions ?? [];

	const requirementsHtml = requirements.length > 0

		? `<div class="intake-plan-section">

				<h5>Requirements (${requirements.length})</h5>

				<ul>${requirements.map((r) => `<li><strong>[${escapeHtml(r.id)}]</strong> ${escapeHtml(r.text)}</li>`).join('')}</ul>

			</div>`

		: '';



	const decisionsHtml = decisions.length > 0

		? `<div class="intake-plan-section">

				<h5>Decisions (${decisions.length})</h5>

				<ul>${decisions.map((d) => `<li><strong>[${escapeHtml(d.id)}]</strong> ${escapeHtml(d.text)}</li>`).join('')}</ul>

			</div>`

		: '';



	const constraintsHtml = constraints.length > 0

		? `<div class="intake-plan-section">

				<h5>Constraints (${constraints.length})</h5>

				<ul>${constraints.map((c) => `<li><strong>[${escapeHtml(c.id)}]</strong> ${escapeHtml(c.text)}</li>`).join('')}</ul>

			</div>`

		: '';



	// When isLatest, open questions are suppressed here because they duplicate
	// the "Consider Asking" section in the turn card above (which has interactive
	// textareas for the user to respond). For historical plans, show them read-only.
	const openQuestionsHtml = !isLatest && openQuestions.length > 0
		? `<div class="intake-plan-section">
				<h5>Open Questions (${openQuestions.length})</h5>
				<ul>${openQuestions.map((q) => {
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

	// Product artifacts
	const visionHtml = plan.productVision
		? `<div class="intake-plan-section">
				<h5>Product Vision</h5>
				<p>${escapeHtml(plan.productVision)}</p>
			</div>`
		: '';

	const descriptionHtml = plan.productDescription
		? `<div class="intake-plan-section">
				<h5>Product Description</h5>
				<p>${escapeHtml(plan.productDescription)}</p>
			</div>`
		: '';

	const personasHtml = plan.personas && plan.personas.length > 0
		? `<div class="intake-plan-section">
				<h5>Personas (${plan.personas.length})</h5>
				<ul>${plan.personas.map((p) =>
					`<li><strong>[${escapeHtml(p.id)}] ${escapeHtml(p.name)}</strong>: ${escapeHtml(p.description)}`
					+ ((p.goals ?? []).length > 0 ? `<br/><em>Goals:</em> ${p.goals.map(g => escapeHtml(g)).join('; ')}` : '')
					+ ((p.painPoints ?? []).length > 0 ? `<br/><em>Pain points:</em> ${p.painPoints.map(pp => escapeHtml(pp)).join('; ')}` : '')
					+ `</li>`
				).join('')}</ul>
			</div>`
		: '';

	const journeysHtml = plan.userJourneys && plan.userJourneys.length > 0
		? `<div class="intake-plan-section">
				<h5>User Journeys (${plan.userJourneys.length})</h5>
				<ul>${plan.userJourneys.map((j) => {
					const steps = (j.steps ?? []).filter(
						(s: { actor?: string; action?: string; expectedOutcome?: string }) =>
							s.actor || s.action || s.expectedOutcome
					);
					const ac = j.acceptanceCriteria ?? [];
					return `<li><strong>[${escapeHtml(j.id)}] ${escapeHtml(j.title)}</strong> <span class="badge">${escapeHtml(j.implementationPhase ?? j.priority ?? '')}</span>`
					+ `<br/>${escapeHtml(j.scenario)}`
					+ (steps.length > 0 ? `<ol>${steps.map((s: { actor?: string; action?: string; expectedOutcome?: string }) =>
						`<li>${escapeHtml(s.actor || '')} → ${escapeHtml(s.action || '')} → ${escapeHtml(s.expectedOutcome || '')}</li>`
					).join('')}</ol>` : '')
					+ (ac.length > 0 ? `<em>Acceptance:</em> ${ac.map(a => escapeHtml(a)).join('; ')}` : '')
					+ `</li>`;
				}).join('')}</ul>
			</div>`
		: '';

	const phasingHtml = plan.phasingStrategy && plan.phasingStrategy.length > 0
		? `<div class="intake-plan-section">
				<h5>Phasing Strategy</h5>
				<ul>${plan.phasingStrategy.map((ph) =>
					`<li><strong>${escapeHtml(ph.phase)}</strong>: ${escapeHtml(ph.description)}<br/><em>${escapeHtml(ph.rationale)}</em></li>`
				).join('')}</ul>
			</div>`
		: '';

	const metricsHtml = plan.successMetrics && plan.successMetrics.length > 0
		? `<div class="intake-plan-section">
				<h5>Success Metrics</h5>
				<ul>${plan.successMetrics.map((m) => `<li>${escapeHtml(stringifyItem(m))}</li>`).join('')}</ul>
			</div>`
		: '';

	const uxHtml = plan.uxRequirements && plan.uxRequirements.length > 0
		? `<div class="intake-plan-section">
				<h5>UX Requirements</h5>
				<ul>${plan.uxRequirements.map((u) => `<li>${escapeHtml(stringifyItem(u))}</li>`).join('')}</ul>
			</div>`
		: '';

	// Proposer artifacts — domains, entities, workflows, integrations, quality attributes
	const domainsHtml = plan.businessDomainProposals && plan.businessDomainProposals.length > 0
		? `<div class="intake-plan-section">
				<h5>Business Domains (${plan.businessDomainProposals.length})</h5>
				<ul>${plan.businessDomainProposals.map((d) =>
					`<li><strong>[${escapeHtml(d.id)}] ${escapeHtml(d.name)}</strong>: ${escapeHtml(d.description)}`
					+ (d.entityPreview?.length ? `<br/><em>Entities:</em> ${d.entityPreview.map(e => escapeHtml(e)).join(', ')}` : '')
					+ (d.workflowPreview?.length ? `<br/><em>Workflows:</em> ${d.workflowPreview.map(w => escapeHtml(w)).join(', ')}` : '')
					+ `</li>`
				).join('')}</ul>
			</div>`
		: '';

	const entitiesHtml = plan.entityProposals && plan.entityProposals.length > 0
		? `<div class="intake-plan-section">
				<h5>Data Entities (${plan.entityProposals.length})</h5>
				<ul>${plan.entityProposals.map((e) =>
					`<li><strong>[${escapeHtml(e.id)}] ${escapeHtml(e.name)}</strong> <span class="badge">${escapeHtml(e.businessDomainId)}</span>: ${escapeHtml(e.description)}`
					+ (e.keyAttributes?.length ? `<br/><em>Attributes:</em> ${e.keyAttributes.map(a => escapeHtml(a)).join(', ')}` : '')
					+ (e.relationships?.length ? `<br/><em>Relationships:</em> ${e.relationships.map(r => escapeHtml(r)).join(', ')}` : '')
					+ `</li>`
				).join('')}</ul>
			</div>`
		: '';

	const workflowsHtml = plan.workflowProposals && plan.workflowProposals.length > 0
		? `<div class="intake-plan-section">
				<h5>Workflows (${plan.workflowProposals.length})</h5>
				<ul>${plan.workflowProposals.map((w) =>
					`<li><strong>[${escapeHtml(w.id)}] ${escapeHtml(w.name)}</strong> <span class="badge">${escapeHtml(w.businessDomainId)}</span>: ${escapeHtml(w.description)}</li>`
				).join('')}</ul>
			</div>`
		: '';

	const integrationsHtml = plan.integrationProposals && plan.integrationProposals.length > 0
		? `<div class="intake-plan-section">
				<h5>Integrations (${plan.integrationProposals.length})</h5>
				<ul>${plan.integrationProposals.map((i) =>
					`<li><strong>[${escapeHtml(i.id)}] ${escapeHtml(i.name)}</strong> <span class="badge">${escapeHtml(i.category)}</span>: ${escapeHtml(i.description)}`
					+ (i.standardProviders?.length ? `<br/><em>Providers:</em> ${i.standardProviders.map(p => escapeHtml(p)).join(', ')}` : '')
					+ `</li>`
				).join('')}</ul>
			</div>`
		: '';

	const qualityHtml = plan.qualityAttributes && plan.qualityAttributes.length > 0
		? `<div class="intake-plan-section">
				<h5>Quality Attributes (${plan.qualityAttributes.length})</h5>
				<ul>${plan.qualityAttributes.map((q) => `<li>${escapeHtml(q)}</li>`).join('')}</ul>
			</div>`
		: '';

	const hasProposerArtifacts = domainsHtml || entitiesHtml || workflowsHtml || integrationsHtml || qualityHtml;

	// Combine product sections — show them before technical details when present
	const hasProductArtifacts = visionHtml || descriptionHtml || personasHtml || journeysHtml;

	return `

		<div class="intake-plan-preview ${borderClass}">

			<div class="intake-plan-header" data-action="toggle-intake-plan">

				<span class="intake-plan-chevron">&#x25B6;</span>

				<span class="intake-plan-label">${label} v${plan.version}</span>

				${plan.title ? `<span class="intake-plan-title">${escapeHtml(plan.title)}</span>` : ''}

			</div>

			<div class="intake-plan-body">

				${plan.summary ? `<p class="intake-plan-summary">${escapeHtml(plan.summary)}</p>` : ''}

				${hasProductArtifacts ? `${visionHtml}${descriptionHtml}${personasHtml}${journeysHtml}${phasingHtml}${metricsHtml}${uxHtml}` : ''}

				${requirementsHtml}

				${decisionsHtml}

				${constraintsHtml}

				${openQuestionsHtml}

				${approachHtml}

				${hasProposerArtifacts ? `${domainsHtml}${entitiesHtml}${workflowsHtml}${integrationsHtml}${qualityHtml}` : ''}

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
	const currentEngineeringDomain = intakeState.currentEngineeringDomain;
	const domainInfo = currentEngineeringDomain ? DOMAIN_INFO[currentEngineeringDomain as keyof typeof DOMAIN_INFO] : null;
	const currentIdx = currentEngineeringDomain ? DOMAIN_SEQUENCE.indexOf(currentEngineeringDomain as any) : -1;
	const mode = intakeState.intakeMode;
	const coverage = intakeState.engineeringDomainCoverage;

	// Coverage-based progress for DOCUMENT_BASED, domain-sequential for STATE_DRIVEN
	let progressLabel: string;
	let progressPercent: number;

	if (mode === 'DOCUMENT_BASED' && coverage) {
		// For document-based: show coverage percentage (domains may advance non-sequentially)
		const total = DOMAIN_SEQUENCE.length;
		let covered = 0;
		for (const key of Object.keys(coverage)) {
			if (coverage[key as keyof typeof coverage].level !== EngineeringDomainCoverageLevel.NONE) {
				covered++;
			}
		}
		progressPercent = Math.round((covered / total) * 100);
		progressLabel = 'Analyzing documents \u2014 ' + covered + ' of ' + total + ' domains touched';
	} else if (currentIdx >= 0) {
		// STATE_DRIVEN: sequential domain walkthrough
		progressPercent = Math.round(((currentIdx + 1) / DOMAIN_SEQUENCE.length) * 100);
		progressLabel = 'Domain ' + (currentIdx + 1) + ' of ' + DOMAIN_SEQUENCE.length + ': ' + (domainInfo ? domainInfo.label : currentEngineeringDomain);
	} else {
		progressPercent = 0;
		progressLabel = 'Gathering domain information';
	}

	// Guidance text: tell the user what to do next
	const guidanceText = mode === 'DOCUMENT_BASED'
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
		DOCUMENT_BASED: {
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
	const modes = [IntakeMode.STATE_DRIVEN, IntakeMode.DOCUMENT_BASED, IntakeMode.HYBRID_CHECKPOINTS];
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

export function renderDomainCoverageSidebar(coverage: EngineeringDomainCoverageMap, currentEngineeringDomain?: string | null): string {
	let domainsHtml = '';
	for (const domain of DOMAIN_SEQUENCE) {
		const entry = coverage[domain];
		const info = DOMAIN_INFO[domain];
		let dotClass: string;
		switch (entry.level) {
			case EngineeringDomainCoverageLevel.ADEQUATE: dotClass = 'coverage-adequate'; break;
			case EngineeringDomainCoverageLevel.PARTIAL: dotClass = 'coverage-partial'; break;
			default: dotClass = 'coverage-none'; break;
		}

		const hasEvidence = entry.evidence.length > 0;
		const isCurrentDomain = currentEngineeringDomain && domain === currentEngineeringDomain;
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
			case EngineeringDomainCoverageLevel.ADEQUATE: adequate++; break;
			case EngineeringDomainCoverageLevel.PARTIAL: partial++; break;
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
			case EngineeringDomainCoverageLevel.ADEQUATE: adequate++; break;
			case EngineeringDomainCoverageLevel.PARTIAL: partial++; break;
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
			// DOCUMENT_BASED gap analysis: offer mode-switch to fill coverage gaps
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
	const isDocBased = intakeMode === 'DOCUMENT_BASED';
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

	// Note: the human message is already rendered as a standalone 'human_message' event
	// earlier in the stream. Do NOT render it again here to avoid duplication.

	html += '<div class="intake-analysis-card">';

	// Header
	html += '<div class="intake-analysis-header">' +
		'<span class="intake-analysis-icon">&#x1F50D;</span>' +
		'<span class="intake-analysis-title">Intent Discovery</span>' +
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

/**
 * Render a Product Discovery card for PRODUCT_REVIEW sub-state.
 * Shows product artifacts (vision, personas, journeys, phasing) with MMP
 * for human review BEFORE the technical approach is shown.
 */
function renderIntakeProductDiscoveryCard(
	productFields: {
		requestCategory?: string;
		productVision?: string;
		productDescription?: string;
		personas?: Array<{ id: string; name: string; description: string; goals: string[]; painPoints: string[] }>;
		userJourneys?: Array<{ id: string; personaId: string; title: string; scenario: string; steps: Array<{ stepNumber: number; actor: string; action: string; expectedOutcome: string }>; acceptanceCriteria: string[]; priority: string }>;
		phasingStrategy?: Array<{ phase: string; description: string; journeyIds: string[]; rationale: string }>;
		successMetrics?: string[];
		uxRequirements?: string[];
	},
	mmpJson?: string,
	allPendingDecisions?: Record<string, PendingMmpSnapshot>,
	eventId?: number,
): string {
	let html = '<div class="intake-product-discovery-card">';

	// Header
	html += '<div class="intake-product-discovery-header">' +
		'<span class="intake-product-discovery-icon">&#x1F4CB;</span>' +
		'<span class="intake-product-discovery-title">Product Discovery</span>' +
		'</div>';

	// Intro text
	html += '<div class="intake-product-discovery-intro">' +
		'Review the product artifacts below. Accept, reject, or edit each assumption ' +
		'before proceeding to the technical approach.' +
		'</div>';

	// Reuse existing product artifacts renderer
	html += renderProposalProductArtifacts(productFields);

	// MMP section for interactive review
	if (mmpJson) {
		try {
			const mmp = JSON.parse(mmpJson) as MMPPayload;
			if (mmp.mirror || mmp.menu || mmp.preMortem) {
				const cardId = 'PD-REVIEW-' + (eventId ?? '0');
				html += renderMMPSection(mmp, cardId, true, { type: 'intake' }, allPendingDecisions?.[cardId]);
			}
		} catch { /* ignore parse errors */ }
	}

	html += '</div>';
	return html;
}

// ==================== PROPOSER-VALIDATOR CARDS ====================

function renderProposerDomainsCard(
	domains: Array<{ id: string; name: string; description: string; rationale: string; entityPreview: string[]; workflowPreview: string[] }>,
	personas: Array<{ id: string; name: string; description: string }>,
	mmpJson?: string,
	allPendingDecisions?: Record<string, PendingMmpSnapshot>,
	isLatest: boolean = true,
	eventId?: number,
): string {
	const cardId = 'PV-DOMAINS-' + (eventId ?? '0');
	const pending = allPendingDecisions?.[cardId];

	// Parse MMP to get mirror items (keyed by source ID) + menu/preMortem
	let mmp: import('../../../types/mmp').MMPPayload | null = null;
	const mirrorById = new Map<string, import('../../../types/mmp').MirrorItem>();
	if (mmpJson) {
		try {
			mmp = JSON.parse(mmpJson) as import('../../../types/mmp').MMPPayload;
			if (mmp.mirror) {
				for (const item of mmp.mirror.items) {
					mirrorById.set(item.id, item);
				}
			}
		} catch { /* ignore */ }
	}

	// Wrap entire card in MMP container so submit handler can scope queries
	let html = '<div class="mmp-container" data-mmp-card-id="' + cardId + '" data-mmp-context="intake">';
	html += '<div class="proposer-card proposer-domains-card">';
	html += '<div class="proposer-card-header"><span class="proposer-card-icon">&#x1F30D;</span>' +
		'<span class="proposer-card-title">Proposed Business Domains</span></div>';
	html += '<div class="proposer-card-intro">Review the proposed business domains and personas. Accept, reject, or edit each one.</div>';

	// Domains with inline MMP buttons
	if (domains.length > 0) {
		html += '<div class="proposer-section"><div class="proposer-section-label">Domains (' + domains.length + ')</div>';
		for (const d of domains) {
			const contentHtml =
				'<div class="proposer-domain-header">' +
				'<strong>' + escapeHtml(d.name) + '</strong> <code>' + escapeHtml(d.id) + '</code>' +
				'</div>' +
				'<div class="proposer-domain-desc">' + escapeHtml(d.description) + '</div>' +
				'<div class="proposer-domain-meta">Entities: ' + d.entityPreview.map(e => escapeHtml(e)).join(', ') +
				' | Workflows: ' + d.workflowPreview.map(w => escapeHtml(w)).join(', ') + '</div>' +
				'<div class="proposer-domain-rationale"><em>' + escapeHtml(d.rationale) + '</em></div>';

			const mirrorItem = mirrorById.get(d.id);
			if (mirrorItem) {
				html += renderInlineMirrorButtons(d.id, mirrorItem.text, cardId, isLatest, contentHtml, pending, mirrorItem.source);
			} else {
				// No mirror item for this domain — render content only
				html += '<div class="proposer-domain-item">' + contentHtml + '</div>';
			}
		}
		html += '</div>';
	}

	// Personas with inline MMP buttons
	if (personas.length > 0) {
		html += '<div class="proposer-section"><div class="proposer-section-label">Personas (' + personas.length + ')</div>';
		for (const p of personas) {
			const contentHtml = '<strong>' + escapeHtml(p.name) + '</strong>: ' + escapeHtml(p.description);
			const mirrorItem = mirrorById.get(p.id);
			if (mirrorItem) {
				html += renderInlineMirrorButtons(p.id, mirrorItem.text, cardId, isLatest, contentHtml, pending, mirrorItem.source);
			} else {
				html += '<div class="proposer-persona-item">' + contentHtml + '</div>';
			}
		}
		html += '</div>';
	}

	// Menu and Pre-Mortem cards (not 1:1 with domains — render separately)
	if (mmp) {
		if (mmp.menu && isLatest) {
			html += renderMenuCard(mmp.menu, cardId, isLatest, pending);
		}
		if (mmp.preMortem && isLatest) {
			html += renderPreMortemCard(mmp.preMortem, cardId, isLatest, pending);
		}
		// Submit bar
		if (isLatest) {
			html += renderMMPSubmitBar(cardId, mmp, pending);
		}
	}

	html += '</div>'; // proposer-card
	html += '</div>'; // mmp-container
	return html;
}

function renderProposerJourneysCard(
	journeys: Array<{ id: string; title: string; scenario: string; priority?: string }>,
	workflows: Array<{ id: string; name: string; description: string; businessDomainId: string }>,
	mmpJson?: string,
	allPendingDecisions?: Record<string, PendingMmpSnapshot>,
	isLatest: boolean = true,
	eventId?: number,
): string {
	const cardId = 'PV-JOURNEYS-' + (eventId ?? '0');
	const pending = allPendingDecisions?.[cardId];

	let mmp: import('../../../types/mmp').MMPPayload | null = null;
	const mirrorById = new Map<string, import('../../../types/mmp').MirrorItem>();
	if (mmpJson) {
		try {
			mmp = JSON.parse(mmpJson) as import('../../../types/mmp').MMPPayload;
			if (mmp.mirror) {
				for (const item of mmp.mirror.items) { mirrorById.set(item.id, item); }
			}
		} catch { /* ignore */ }
	}

	let html = '<div class="mmp-container" data-mmp-card-id="' + cardId + '" data-mmp-context="intake">';
	html += '<div class="proposer-card proposer-journeys-card">';
	html += '<div class="proposer-card-header"><span class="proposer-card-icon">&#x1F6A3;</span>' +
		'<span class="proposer-card-title">Proposed Journeys & Workflows</span></div>';
	html += '<div class="proposer-card-intro">Review the proposed user journeys and system workflows.</div>';

	// Journeys with inline buttons
	if (journeys.length > 0) {
		html += '<div class="proposer-section"><div class="proposer-section-label">User Journeys (' + journeys.length + ')</div>';
		for (const j of journeys) {
			const phase = (j as Record<string, unknown>).implementationPhase as string | undefined ?? j.priority ?? '';
			const source = (j as Record<string, unknown>).source as string | undefined ?? '';
			const contentHtml =
				'<strong>' + escapeHtml(j.title) + '</strong> ' +
				(phase ? '<span class="badge badge-phase">' + escapeHtml(phase) + '</span> ' : '') +
				(source ? '<span class="badge badge-source">' + escapeHtml(source) + '</span>' : '') +
				'<div>' + escapeHtml(j.scenario) + '</div>';
			const mirrorItem = mirrorById.get(j.id);
			if (mirrorItem) {
				html += renderInlineMirrorButtons(j.id, mirrorItem.text, cardId, isLatest, contentHtml, pending, mirrorItem.source);
			} else {
				html += '<div class="proposer-journey-item">' + contentHtml + '</div>';
			}
		}
		html += '</div>';
	}

	// Workflows with inline buttons
	if (workflows.length > 0) {
		const wfByDomain = new Map<string, typeof workflows>();
		for (const w of workflows) {
			const group = wfByDomain.get(w.businessDomainId) ?? [];
			group.push(w);
			wfByDomain.set(w.businessDomainId, group);
		}
		html += '<div class="proposer-section"><div class="proposer-section-label">System Workflows (' + workflows.length + ' across ' + wfByDomain.size + ' domains)</div>';
		for (const [businessDomainId, domainWorkflows] of wfByDomain) {
			html += '<details class="proposer-domain-group" open>' +
				'<summary class="proposer-domain-group-header">' + escapeHtml(businessDomainId) +
				' <span class="proposer-domain-group-count">(' + domainWorkflows.length + ')</span></summary>' +
				'<div class="proposer-domain-group-body">';
			for (const w of domainWorkflows) {
				const contentHtml =
					'<strong>' + escapeHtml(w.name) + '</strong>' +
					'<div>' + escapeHtml(w.description) + '</div>';
				const mirrorItem = mirrorById.get(w.id);
				if (mirrorItem) {
					html += renderInlineMirrorButtons(w.id, mirrorItem.text, cardId, isLatest, contentHtml, pending, mirrorItem.source);
				} else {
					html += '<div class="proposer-workflow-item">' + contentHtml + '</div>';
				}
			}
			html += '</div></details>';
		}
		html += '</div>';
	}

	// Menu/PreMortem + submit bar
	if (mmp) {
		if (mmp.menu && isLatest) { html += renderMenuCard(mmp.menu, cardId, isLatest, pending); }
		if (mmp.preMortem && isLatest) { html += renderPreMortemCard(mmp.preMortem, cardId, isLatest, pending); }
		if (isLatest) { html += renderMMPSubmitBar(cardId, mmp, pending); }
	}

	html += '</div></div>';
	return html;
}

function renderProposerEntitiesCard(
	entities: Array<{ id: string; name: string; description: string; businessDomainId: string; keyAttributes: string[]; relationships: string[] }>,
	mmpJson?: string,
	domainNames?: Record<string, string>,
	allPendingDecisions?: Record<string, PendingMmpSnapshot>,
	isLatest: boolean = true,
	eventId?: number,
): string {
	const cardId = 'PV-ENTITIES-' + (eventId ?? '0');
	const pending = allPendingDecisions?.[cardId];

	let mmp: import('../../../types/mmp').MMPPayload | null = null;
	const mirrorById = new Map<string, import('../../../types/mmp').MirrorItem>();
	if (mmpJson) {
		try {
			mmp = JSON.parse(mmpJson) as import('../../../types/mmp').MMPPayload;
			if (mmp.mirror) {
				for (const item of mmp.mirror.items) { mirrorById.set(item.id, item); }
			}
		} catch { /* ignore */ }
	}

	let html = '<div class="mmp-container" data-mmp-card-id="' + cardId + '" data-mmp-context="intake">';
	html += '<div class="proposer-card proposer-entities-card">';
	html += '<div class="proposer-card-header"><span class="proposer-card-icon">&#x1F4CA;</span>' +
		'<span class="proposer-card-title">Proposed Data Model</span></div>';

	const byDomain = new Map<string, typeof entities>();
	for (const e of entities) {
		const group = byDomain.get(e.businessDomainId) ?? [];
		group.push(e);
		byDomain.set(e.businessDomainId, group);
	}

	html += '<div class="proposer-card-intro">Review the proposed data entities — ' +
		entities.length + ' entities across ' + byDomain.size + ' domains.</div>';

	for (const [businessDomainId, domainEntities] of byDomain) {
		const domainName = domainNames?.[businessDomainId] ?? businessDomainId;
		html += '<details class="proposer-domain-group" open>' +
			'<summary class="proposer-domain-group-header">' +
			escapeHtml(domainName) + ' <span class="proposer-domain-group-count">(' +
			domainEntities.length + ' entit' + (domainEntities.length === 1 ? 'y' : 'ies') + ')</span></summary>' +
			'<div class="proposer-domain-group-body">';
		for (const e of domainEntities) {
			const contentHtml =
				'<strong>' + escapeHtml(e.name) + '</strong>' +
				'<div class="proposer-entity-desc">' + escapeHtml(e.description) + '</div>' +
				(e.keyAttributes.length > 0 ? '<div class="proposer-entity-meta">Attributes: ' + e.keyAttributes.map(a => escapeHtml(a)).join(', ') + '</div>' : '') +
				(e.relationships.length > 0 ? '<div class="proposer-entity-meta">Relationships: ' + e.relationships.map(r => escapeHtml(r)).join(', ') + '</div>' : '');
			const mirrorItem = mirrorById.get(e.id);
			if (mirrorItem) {
				html += renderInlineMirrorButtons(e.id, mirrorItem.text, cardId, isLatest, contentHtml, pending, mirrorItem.source);
			} else {
				html += '<div class="proposer-entity-item">' + contentHtml + '</div>';
			}
		}
		html += '</div></details>';
	}

	if (mmp) {
		if (mmp.menu && isLatest) { html += renderMenuCard(mmp.menu, cardId, isLatest, pending); }
		if (mmp.preMortem && isLatest) { html += renderPreMortemCard(mmp.preMortem, cardId, isLatest, pending); }
		if (isLatest) { html += renderMMPSubmitBar(cardId, mmp, pending); }
	}

	html += '</div></div>';
	return html;
}

function renderProposerIntegrationsCard(
	integrations: Array<{ id: string; name: string; category: string; description: string; standardProviders: string[]; ownershipModel: string }>,
	qualityAttributes: string[],
	mmpJson?: string,
	allPendingDecisions?: Record<string, PendingMmpSnapshot>,
	isLatest: boolean = true,
	eventId?: number,
): string {
	const cardId = 'PV-INTEGRATIONS-' + (eventId ?? '0');
	const pending = allPendingDecisions?.[cardId];

	let mmp: import('../../../types/mmp').MMPPayload | null = null;
	const mirrorById = new Map<string, import('../../../types/mmp').MirrorItem>();
	if (mmpJson) {
		try {
			mmp = JSON.parse(mmpJson) as import('../../../types/mmp').MMPPayload;
			if (mmp.mirror) {
				for (const item of mmp.mirror.items) { mirrorById.set(item.id, item); }
			}
		} catch { /* ignore */ }
	}

	let html = '<div class="mmp-container" data-mmp-card-id="' + cardId + '" data-mmp-context="intake">';
	html += '<div class="proposer-card proposer-integrations-card">';
	html += '<div class="proposer-card-header"><span class="proposer-card-icon">&#x1F517;</span>' +
		'<span class="proposer-card-title">Proposed Integrations & Quality</span></div>';
	html += '<div class="proposer-card-intro">Review the proposed integrations and quality attributes. Submit to generate the full product specification.</div>';

	if (integrations.length > 0) {
		const byCategory = new Map<string, typeof integrations>();
		for (const int of integrations) {
			const group = byCategory.get(int.category) ?? [];
			group.push(int);
			byCategory.set(int.category, group);
		}
		html += '<div class="proposer-section"><div class="proposer-section-label">Integrations (' + integrations.length + ' across ' + byCategory.size + ' categories)</div>';
		for (const [category, catIntegrations] of byCategory) {
			const catLabel = category.charAt(0).toUpperCase() + category.slice(1);
			html += '<details class="proposer-domain-group" open>' +
				'<summary class="proposer-domain-group-header">' + escapeHtml(catLabel) +
				' <span class="proposer-domain-group-count">(' + catIntegrations.length + ')</span></summary>' +
				'<div class="proposer-domain-group-body">';
			for (const int of catIntegrations) {
				const contentHtml =
					'<strong>' + escapeHtml(int.name) + '</strong>' +
					'<div>' + escapeHtml(int.description) + '</div>' +
					'<div class="proposer-entity-meta">Providers: ' + int.standardProviders.map(p => escapeHtml(p)).join(', ') +
					' | Ownership: ' + escapeHtml(int.ownershipModel) + '</div>';
				const mirrorItem = mirrorById.get(int.id);
				if (mirrorItem) {
					html += renderInlineMirrorButtons(int.id, mirrorItem.text, cardId, isLatest, contentHtml, pending, mirrorItem.source);
				} else {
					html += '<div class="proposer-integration-item">' + contentHtml + '</div>';
				}
			}
			html += '</div></details>';
		}
		html += '</div>';
	}

	// Quality attributes — these use synthetic IDs (PV-QA-N), render with inline buttons
	if (qualityAttributes.length > 0) {
		html += '<div class="proposer-section"><div class="proposer-section-label">Quality Attributes</div>';
		for (let i = 0; i < qualityAttributes.length; i++) {
			const qaId = `PV-QA-${i + 1}`;
			const contentHtml = escapeHtml(qualityAttributes[i]);
			const mirrorItem = mirrorById.get(qaId);
			if (mirrorItem) {
				html += renderInlineMirrorButtons(qaId, mirrorItem.text, cardId, isLatest, contentHtml, pending, mirrorItem.source);
			} else {
				html += '<div class="proposer-qa-item">' + contentHtml + '</div>';
			}
		}
		html += '</div>';
	}

	// Menu/PreMortem + submit bar
	if (mmp) {
		if (mmp.menu && isLatest) { html += renderMenuCard(mmp.menu, cardId, isLatest, pending); }
		if (mmp.preMortem && isLatest) { html += renderPreMortemCard(mmp.preMortem, cardId, isLatest, pending); }
		if (isLatest) { html += renderMMPSubmitBar(cardId, mmp, pending); }
	}

	html += '</div></div>';
	return html;
}

// ==================== INTAKE PROPOSAL CARD ====================

function renderIntakeProposalCard(
	title: string,
	summary: string,
	proposedApproach: string,
	engineeringDomainCoverage: { adequate: number; partial: number; none: number; percentage: number },
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
		'<span class="intake-proposal-coverage-pct">' + engineeringDomainCoverage.percentage + '%</span>' +
		'</div>' +
		'<div class="intake-proposal-coverage-stats">' +
		engineeringDomainCoverage.adequate + ' adequate, ' +
		engineeringDomainCoverage.partial + ' partial, ' +
		engineeringDomainCoverage.none + ' uncovered' +
		'</div></div>';

	// Footer prompt
	html += '<div class="intake-proposal-footer">' +
		'Review the approach above. Share feedback or questions to refine it.' +
		'</div>';

	html += '</div>';
	return html;
}

/**
 * Render product artifacts (vision, personas, user journeys, phasing) inside the proposal card.
 */
function renderProposalProductArtifacts(fields: {
	productVision?: string;
	productDescription?: string;
	personas?: Array<{ id: string; name: string; description: string; goals: string[]; painPoints: string[] }>;
	userJourneys?: Array<{ id: string; personaId: string; title: string; scenario: string; steps: Array<{ stepNumber: number; actor: string; action: string; expectedOutcome: string }>; acceptanceCriteria: string[]; priority: string }>;
	phasingStrategy?: Array<{ phase: string; description: string; journeyIds: string[]; rationale: string }>;
	successMetrics?: string[];
	uxRequirements?: string[];
}): string {
	let html = '';
	const hasAny = fields.productVision || fields.productDescription ||
		(fields.personas && fields.personas.length > 0) ||
		(fields.userJourneys && fields.userJourneys.length > 0);

	if (!hasAny) { return ''; }

	html += '<details class="intake-proposal-product" open>' +
		'<summary class="intake-proposal-product-header">Product Discovery</summary>' +
		'<div class="intake-proposal-product-body">';

	if (fields.productVision) {
		html += '<div class="intake-proposal-product-section">' +
			'<div class="intake-proposal-product-label">Vision</div>' +
			'<div class="intake-proposal-product-text">' + escapeHtml(fields.productVision) + '</div>' +
			'<div class="pd-inline-edit">' +
			'<textarea class="pd-inline-edit-area" data-pd-edit-field="vision" ' +
			'placeholder="Suggest changes to the vision statement..." rows="2"></textarea>' +
			'</div>' +
			'</div>';
	}

	if (fields.productDescription) {
		html += '<div class="intake-proposal-product-section">' +
			'<div class="intake-proposal-product-label">Product Description</div>' +
			'<div class="intake-proposal-product-text">' + escapeHtml(fields.productDescription) + '</div>' +
			'<div class="pd-inline-edit">' +
			'<textarea class="pd-inline-edit-area" data-pd-edit-field="description" ' +
			'placeholder="Suggest changes to the product description..." rows="2"></textarea>' +
			'</div>' +
			'</div>';
	}

	if (fields.personas && fields.personas.length > 0) {
		html += '<div class="intake-proposal-product-section">' +
			'<div class="intake-proposal-product-label">Personas</div>';
		for (let pIdx = 0; pIdx < fields.personas.length; pIdx++) {
			const p = fields.personas[pIdx];
			const pFieldId = 'persona:' + (p.name || 'Persona ' + (pIdx + 1));
			html += '<div class="intake-proposal-persona">' +
				'<strong>' + escapeHtml(p.name) + '</strong> ' +
				'<span class="intake-proposal-persona-id">[' + escapeHtml(p.id) + ']</span>' +
				'<div class="intake-proposal-persona-desc">' + escapeHtml(p.description) + '</div>';
			if ((p.goals ?? []).length > 0) {
				html += '<div class="intake-proposal-persona-goals">Goals: ' + p.goals.map(g => escapeHtml(g)).join('; ') + '</div>';
			}
			if ((p.painPoints ?? []).length > 0) {
				html += '<div class="intake-proposal-persona-pains">Pain points: ' + p.painPoints.map(pp => escapeHtml(pp)).join('; ') + '</div>';
			}
			html += '<div class="pd-inline-edit">' +
				'<textarea class="pd-inline-edit-area" data-pd-edit-field="' + escapeHtml(pFieldId) + '" ' +
				'placeholder="Clarify or correct this persona..." rows="1"></textarea>' +
				'</div>';
			html += '</div>';
		}
		html += '</div>';
	}

	if (fields.userJourneys && fields.userJourneys.length > 0) {
		html += '<div class="intake-proposal-product-section">' +
			'<div class="intake-proposal-product-label">User Journeys</div>';
		for (let jIdx = 0; jIdx < fields.userJourneys.length; jIdx++) {
			const j = fields.userJourneys[jIdx];
			const jFieldId = 'journey:' + (j.title || 'Journey ' + (jIdx + 1));
			html += '<div class="intake-proposal-journey">' +
				'<strong>' + escapeHtml(j.title) + '</strong> ' +
				'<span class="intake-proposal-journey-priority badge-' + j.priority.toLowerCase() + '">' + escapeHtml(j.priority) + '</span>' +
				'<div class="intake-proposal-journey-scenario">' + escapeHtml(j.scenario) + '</div>';
			// Only render steps that have actual content (LLM may return stub objects)
			const validSteps = (j.steps ?? []).filter(
				(s: { actor?: string; action?: string; expectedOutcome?: string }) =>
					s.actor || s.action || s.expectedOutcome
			);
			if (validSteps.length > 0) {
				html += '<ol class="intake-proposal-journey-steps">';
				for (const s of validSteps) {
					html += '<li>';
					if (s.actor) { html += '<strong>' + escapeHtml(s.actor) + '</strong>: '; }
					html += escapeHtml(s.action || '');
					if (s.expectedOutcome) { html += ' &rarr; ' + escapeHtml(s.expectedOutcome); }
					html += '</li>';
				}
				html += '</ol>';
			}
			if (j.acceptanceCriteria && j.acceptanceCriteria.length > 0) {
				html += '<div class="intake-proposal-journey-ac">Acceptance: ' +
					j.acceptanceCriteria.map(ac => escapeHtml(ac)).join('; ') + '</div>';
			}
			html += '<div class="pd-inline-edit">' +
				'<textarea class="pd-inline-edit-area" data-pd-edit-field="' + escapeHtml(jFieldId) + '" ' +
				'placeholder="Clarify or correct this journey..." rows="1"></textarea>' +
				'</div>';
			html += '</div>';
		}
		html += '</div>';
	}

	if (fields.phasingStrategy && fields.phasingStrategy.length > 0) {
		html += '<div class="intake-proposal-product-section">' +
			'<div class="intake-proposal-product-label">Phasing Strategy</div>';
		for (let phIdx = 0; phIdx < fields.phasingStrategy.length; phIdx++) {
			const ph = fields.phasingStrategy[phIdx];
			// Normalize phase label to sequential numbering (LLM may use arbitrary numbers)
			const phaseLabel = `Phase ${phIdx + 1}`;
			html += '<div class="intake-proposal-phasing">' +
				'<strong>' + escapeHtml(phaseLabel) + '</strong>: ' + escapeHtml(ph.description) +
				' <span class="intake-proposal-phasing-rationale">(' + escapeHtml(ph.rationale) + ')</span>' +
				'<div class="pd-inline-edit">' +
				'<textarea class="pd-inline-edit-area" data-pd-edit-field="' + escapeHtml('phase:' + phaseLabel) + '" ' +
				'placeholder="Clarify or correct this phase..." rows="1"></textarea>' +
				'</div>' +
				'</div>';
		}
		html += '</div>';
	}

	if (fields.successMetrics && fields.successMetrics.length > 0) {
		html += '<div class="intake-proposal-product-section">' +
			'<div class="intake-proposal-product-label">Success Metrics</div>' +
			'<ul>';
		for (let mIdx = 0; mIdx < fields.successMetrics.length; mIdx++) {
			const m = fields.successMetrics[mIdx];
			html += '<li>' + escapeHtml(m) +
				'<div class="pd-inline-edit">' +
				'<textarea class="pd-inline-edit-area" data-pd-edit-field="metric:' + escapeHtml(m.substring(0, 60)) + '" ' +
				'placeholder="Clarify or correct this metric..." rows="1"></textarea>' +
				'</div>' +
				'</li>';
		}
		html += '</ul></div>';
	}

	html += '</div></details>';
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


// ==================== REASONING REVIEW CARD ====================

function renderReasoningReviewCard(
	concerns: Array<{ severity: string; summary: string; detail: string; location: string; recommendation: string }>,
	overallAssessment: string,
	reviewerModel: string,
	timestamp: string,
	reviewPrompt?: string,
): string {
	const maxSeverity = concerns.length > 0 ? (concerns[0]?.severity ?? 'MEDIUM') : 'CLEAN';
	const severityClass = maxSeverity === 'HIGH' ? 'review-severity-high'
		: maxSeverity === 'MEDIUM' ? 'review-severity-medium'
		: maxSeverity === 'LOW' ? 'review-severity-low'
		: 'review-severity-clean';

	const concernsHtml = concerns.map((c) => {
		const sevBadge = c.severity === 'HIGH'
			? '<span class="review-severity-badge review-sev-high">HIGH</span>'
			: c.severity === 'MEDIUM'
			? '<span class="review-severity-badge review-sev-medium">MEDIUM</span>'
			: '<span class="review-severity-badge review-sev-low">LOW</span>';

		return '<div class="review-concern">' +
			'<div class="review-concern-header">' +
				sevBadge +
				'<span class="review-concern-summary">' + escapeHtml(c.summary) + '</span>' +
			'</div>' +
			'<details class="review-concern-details">' +
				'<summary>Details &amp; recommendation</summary>' +
				'<div class="review-concern-detail">' + escapeHtml(c.detail) + '</div>' +
				(c.location ? '<div class="review-concern-location"><em>Location:</em> ' + escapeHtml(c.location) + '</div>' : '') +
				'<div class="review-concern-recommendation"><strong>Recommendation:</strong> ' + escapeHtml(c.recommendation) + '</div>' +
			'</details>' +
		'</div>';
	}).join('');

	const promptHtml = reviewPrompt
		? '<details class="review-prompt-details">' +
			'<summary>&#x1F4DD; Review Prompt</summary>' +
			'<pre class="review-prompt-content">' + escapeHtml(reviewPrompt) + '</pre>' +
		  '</details>'
		: '';

	return '<div class="reasoning-review-card ' + severityClass + '">' +
		'<div class="review-header">' +
			'<span class="review-icon">&#x1F50D;</span>' +
			'<span class="review-title">Reasoning Review</span>' +
			'<span class="review-meta">' +
				(concerns.length > 0
					? concerns.length + ' concern' + (concerns.length !== 1 ? 's' : '')
					: 'Clean') +
				' &middot; ' + escapeHtml(reviewerModel) +
				' &middot; ' + formatTimestamp(timestamp) + '</span>' +
		'</div>' +
		'<div class="review-assessment">' + escapeHtml(overallAssessment) + '</div>' +
		'<div class="review-concerns">' + concernsHtml + '</div>' +
		promptHtml +
		'<div class="review-actions">' +
			'<button class="mmp-btn review-action-btn" data-action="review-acknowledge">Acknowledge</button>' +
			'<button class="mmp-btn review-action-btn" data-action="review-rerun">Re-run with corrections</button>' +
			'<button class="mmp-btn review-action-btn" data-action="review-guidance">Add guidance</button>' +
		'</div>' +
	'</div>';
}

// ==================== STREAM RENDERER ====================



export function renderStream(items: StreamItem[], intakeState?: GovernedStreamState['intakeState'], allPendingDecisions?: Record<string, PendingMmpSnapshot>): string {

	if (items.length === 0) {

		return renderEmptyState();

	}



	// Pre-scan to find the last intake_plan_preview index
	let lastIntakePlanIdx = -1;
	items.forEach((item, idx) => {
		if (item.type === 'intake_plan_preview') { lastIntakePlanIdx = idx; }
	});

	// Pre-scan to find the last proposer MMP card index (only the latest should be interactive)
	let lastProposerMmpIdx = -1;
	items.forEach((item, idx) => {
		if (item.type === 'intake_proposer_business_domains' || item.type === 'intake_proposer_journeys' ||
			item.type === 'intake_proposer_entities' || item.type === 'intake_proposer_integrations') {
			lastProposerMmpIdx = idx;
		}
	});

	// Helper to detect architecture-phase stream item types (including command blocks)
	const isArchitectureItem = (item: StreamItem): boolean => {
		if (item.type === 'architecture_capabilities' || item.type === 'architecture_design' ||
			item.type === 'architecture_validation' || item.type === 'architecture_gate') {
			return true;
		}
		if (item.type === 'command_block' && item.command.label.startsWith('Architect')) {
			return true;
		}
		return false;
	};

	let html = items.map((item, idx) => {
		let prefix = '';
		let suffix = '';

		// Wrap consecutive architecture cards in a visual group container
		if (isArchitectureItem(item)) {
			const prevIsArch = idx > 0 && isArchitectureItem(items[idx - 1]);
			const nextIsArch = idx < items.length - 1 && isArchitectureItem(items[idx + 1]);
			if (!prevIsArch) {
				prefix = '<div class="architecture-phase-group">' +
					'<div class="architecture-phase-group-header">' +
					'<span class="codicon codicon-layers"></span> Recursive Architecture Decomposition' +
					'</div>';
			}
			if (!nextIsArch) {
				suffix = '</div>';
			}
		}

		/** Make a card natively resizable by injecting resize styles.
		 *  Finds the first top-level element and adds inline resize styles directly. */
		const wrapResizable = (html: string) => {
			// Inject resize styles onto the card's root element
			return html.replace(/^(\s*<\w+)([\s>])/, '$1 style="resize:vertical;overflow:auto;height:400px;"$2');
		};

		const content = (() => { switch (item.type) {

			case 'human_message':

				return '<div class="intake-message intake-human">' +
					'<div class="card-header"><div class="card-header-left">' +
					'<span class="role-icon codicon codicon-account"></span>' +
					'<span class="role-badge role-human">Human</span>' +
					'</div></div>' +
					'<div class="card-content">' + escapeHtml(item.text) + '</div>' +
					'</div>';

			case 'milestone':

				return renderMilestoneDivider(item.phase, item.timestamp);

			case 'turn':

				return wrapResizable(renderRichCard(item.turn, item.claims, item.verdict));

			case 'gate':

				return renderHumanGateCard(item.gate, item.blockingClaims, item.resolvedAction, item.metadata);

			case 'verification_gate':

				return renderVerificationGateCard(item.gate, item.allClaims, item.verdicts, item.blockingClaims, item.resolvedAction);

			case 'review_gate':

				return wrapResizable(renderReviewGateCard(item.gate, item.allClaims, item.verdicts,
					item.historianFindings, item.reviewItems, item.summary, item.resolvedAction, item.resolvedRationale));

			case 'dialogue_start':

				return renderDialogueStartMarker(item.dialogueId, item.goal, item.title, item.timestamp);

			case 'dialogue_end':

				return renderDialogueEndMarker(item.dialogueId, item.status, item.timestamp);

			case 'command_block':

				return wrapResizable(renderCommandBlock(item.command, item.outputs, item.hasReview));

			case 'intake_turn':

				return wrapResizable(renderIntakeTurnCard(item.turn, item.timestamp, item.commandBlocks, item.isLatest ?? false, item.eventId));

			case 'intake_plan_preview':

				return renderIntakePlanPreview(item.plan, item.isFinal, idx === lastIntakePlanIdx);

			case 'intake_approval_gate':

				return renderIntakeApprovalGate(item.plan, item.dialogueId, item.resolved, item.resolvedAction);

			case 'qa_exchange':

				return renderQaExchangeCard(item.question, item.answer, item.timestamp);

			case 'reasoning_review':

				return renderReasoningReviewCard(item.concerns, item.overallAssessment, item.reviewerModel, item.timestamp, item.reviewPrompt);

			case 'intake_mode_selector':

				return renderIntakeModeSelector(item.recommendation, item.resolved, item.selectedMode);

			case 'intake_checkpoint':

				return renderIntakeCheckpoint(item.checkpoint, item.resolved);

			case 'intake_domain_transition':

				return renderDomainTransitionCard(item.fromLabel, item.toDomain, item.toLabel, item.toDescription);

			case 'intake_gathering_complete':

				return renderGatheringCompleteBanner(item.coverageSummary, item.intakeMode);

			case 'intake_analysis':

				return wrapResizable(renderIntakeAnalysisCard(item.humanMessage, item.analysisSummary, item.codebaseFindings, item.commandBlocks));

			case 'intake_product_discovery':

				return renderIntakeProductDiscoveryCard({
						requestCategory: item.requestCategory,
						productVision: item.productVision,
						productDescription: item.productDescription,
						personas: item.personas,
						userJourneys: item.userJourneys,
						phasingStrategy: item.phasingStrategy,
						successMetrics: item.successMetrics,
						uxRequirements: item.uxRequirements,
					}, item.mmpJson, allPendingDecisions, item.eventId);

			case 'intake_proposal':

				return renderIntakeProposalCard(item.title, item.summary, item.proposedApproach, item.engineeringDomainCoverage);

			case 'intake_proposer_business_domains':
				return wrapResizable(renderProposerDomainsCard(item.domains, item.personas, item.mmpJson, allPendingDecisions, idx === lastProposerMmpIdx, item.eventId));

			case 'intake_proposer_journeys':
				return wrapResizable(renderProposerJourneysCard(item.journeys, item.workflows, item.mmpJson, allPendingDecisions, idx === lastProposerMmpIdx, item.eventId));

			case 'intake_proposer_entities':
				return wrapResizable(renderProposerEntitiesCard(item.entities, item.mmpJson, item.domainNames, allPendingDecisions, idx === lastProposerMmpIdx, item.eventId));

			case 'intake_proposer_integrations':
				return wrapResizable(renderProposerIntegrationsCard(item.integrations, item.qualityAttributes, item.mmpJson, allPendingDecisions, idx === lastProposerMmpIdx, item.eventId));

			case 'architecture_capabilities':

				return wrapResizable(renderArchitectureCapabilitiesCard(item.capabilities, item.timestamp));

			case 'architecture_design':

				return wrapResizable(renderArchitectureDesignCard(item.components, item.dataModels, item.interfaces, item.implementationSequence, item.timestamp));

			case 'architecture_validation':

				return renderArchitectureValidationCard(item.score, item.findings, item.validated, item.timestamp);

			case 'architecture_gate':

				return renderArchitectureGateCard(item.docId, item.version, item.capabilities, item.components, item.goalAlignmentScore, item.dialogueId, item.resolved, item.resolvedAction, item.mmpJson, item.decompositionDepth, allPendingDecisions, item.eventId);

			default:

				return '';

		} })();

		return prefix + content + suffix;

	}).join('');



	// Add domain coverage sidebar only for legacy GATHERING/DISCUSSING flows
	// (not for proposer flow where domain coverage is handled by ARCHITECTURE)
	const isLegacyFlow = intakeState?.subState === 'GATHERING' || intakeState?.subState === 'DISCUSSING';
	if (isLegacyFlow && intakeState && intakeState.engineeringDomainCoverage && intakeState.turnCount > 0) {
		html += renderDomainCoverageSidebar(intakeState.engineeringDomainCoverage, intakeState.currentEngineeringDomain);
	}

	// Add finalize button or resolved marker based on INTAKE sub-state
	if (intakeState && intakeState.turnCount > 0) {
		if (intakeState.subState === 'GATHERING') {
			html += renderIntakeQuestionsSubmitBar();
			html += renderIntakeGatheringFooter(intakeState);
		} else if (intakeState.subState === 'DISCUSSING') {
			html += renderIntakeQuestionsSubmitBar();
			html += renderIntakeFinalizeButton();
		} else if (intakeState.subState === 'SYNTHESIZING') {
			html += '<div class="intake-finalize-bar"><span class="intake-finalize-hint">Synthesizing final plan...</span></div>';
		} else if (intakeState.subState === 'AWAITING_APPROVAL') {
			html += renderIntakeFinalizeResolved();
		} else if (intakeState.subState === 'INTENT_DISCOVERY') {
			html += '<div class="intake-finalize-bar"><span class="intake-finalize-hint">Analyzing documents and codebase...</span></div>';
		} else if (intakeState.subState === 'PROPOSING_BUSINESS_DOMAINS') {
			html += '<div class="intake-finalize-bar"><span class="intake-finalize-hint">Proposing business domains...</span></div>';
		} else if (intakeState.subState === 'PROPOSING_JOURNEYS') {
			html += '<div class="intake-finalize-bar"><span class="intake-finalize-hint">Proposing user journeys and workflows...</span></div>';
		} else if (intakeState.subState === 'PROPOSING_ENTITIES') {
			html += '<div class="intake-finalize-bar"><span class="intake-finalize-hint">Proposing data model...</span></div>';
		} else if (intakeState.subState === 'PROPOSING_INTEGRATIONS') {
			html += '<div class="intake-finalize-bar"><span class="intake-finalize-hint">Proposing integrations...</span></div>';
		} else if (intakeState.subState === 'PRODUCT_REVIEW') {
			// Product discovery: user reviews product artifacts via MMP before technical approach
			html += '<div class="intake-finalize-bar"><span class="intake-finalize-hint">Review product artifacts above and submit your decisions to continue.</span></div>';
		} else if (intakeState.subState === 'PROPOSING' || intakeState.subState === 'CLARIFYING') {
			// Inverted flow: expert proposed or is clarifying — show finalize + submit bar
			html += renderIntakeQuestionsSubmitBar();
			html += renderIntakeFinalizeButton();
		}
	}



	return html;

}


// ==================== ARCHITECTURE PHASE CARDS ====================

function renderArchitectureCapabilitiesCard(
	capabilities: Array<{ id: string; label: string; requirements: number; workflows: number; parentId: string | null }>,
	timestamp: string
): string {
	if (!capabilities.length) { return ''; }

	// Build hierarchy: top-level capabilities with children indented
	const topLevel = capabilities.filter(c => !c.parentId);
	const childrenByParent = new Map<string, typeof capabilities>();
	for (const cap of capabilities) {
		if (cap.parentId) {
			const siblings = childrenByParent.get(cap.parentId) ?? [];
			siblings.push(cap);
			childrenByParent.set(cap.parentId, siblings);
		}
	}

	let rows = '';
	for (const cap of topLevel) {
		rows += `<tr class="capability-top-level">
			<td><code>${escapeHtml(cap.id)}</code></td>
			<td><strong>${escapeHtml(cap.label)}</strong></td>
			<td>${cap.requirements}</td>
			<td>${cap.workflows}</td>
		</tr>`;
		const children = childrenByParent.get(cap.id) ?? [];
		for (const child of children) {
			rows += `<tr class="capability-child">
				<td><code>&nbsp;&nbsp;├ ${escapeHtml(child.id)}</code></td>
				<td>${escapeHtml(child.label)}</td>
				<td>${child.requirements}</td>
				<td>${child.workflows}</td>
			</tr>`;
		}
	}

	return `<div class="card architecture-card" data-timestamp="${escapeHtml(timestamp)}">
		<div class="card-header">
			<span class="role-badge role-architect">ARCHITECT</span>
			<span class="card-title">Capability Decomposition</span>
			<span class="card-meta">${topLevel.length} top-level, ${capabilities.length} total</span>
		</div>
		<div class="card-body">
			<table class="architecture-table">
				<thead><tr><th>ID</th><th>Capability</th><th>Reqs</th><th>Workflows</th></tr></thead>
				<tbody>${rows}</tbody>
			</table>
			<button class="gate-btn" data-action="open-architecture-explorer" style="margin-top:6px;">&#x1F50D; View Full Architecture</button>
		</div>
	</div>`;
}

function renderArchitectureDesignCard(
	components: Array<{ id: string; label: string; responsibility: string; rationale: string; parentId: string | null; workflowsServed: string[]; dependencies: string[]; interactionPatterns: string[]; technologyNotes: string; fileScope: string }>,
	dataModels: Array<{ id: string; entity: string; description: string; fields: Array<{ name: string; type: string; required: boolean }>; relationships: Array<{ targetModel: string; type: string; description: string }>; invariants: string[] }>,
	interfaces: Array<{ id: string; label: string; type: string; description: string; contract: string; providerComponent: string; consumerComponents: string[]; sourceWorkflows: string[] }>,
	implementationSequence: Array<{ id: string; label: string; description: string; componentsInvolved: string[]; dependencies: string[]; complexity: string; verificationMethod: string; sortOrder: number }>,
	timestamp: string
): string {
	// Build component hierarchy: group children under their parents
	const topLevel = components.filter(c => !c.parentId);
	const childrenByParent = new Map<string, typeof components>();
	for (const c of components) {
		if (c.parentId) {
			const existing = childrenByParent.get(c.parentId) || [];
			existing.push(c);
			childrenByParent.set(c.parentId, existing);
		}
	}
	const hasHierarchy = childrenByParent.size > 0;
	const parentCount = topLevel.length;
	const childCount = components.length - parentCount;

	// --- Section 1: Components (rich cards) ---
	function renderComponentCard(comp: typeof components[0], isChild: boolean): string {
		const badges: string[] = [];
		if (comp.workflowsServed.length > 0) {
			badges.push(...comp.workflowsServed.map(w => `<span class="arch-badge arch-badge-workflow">${escapeHtml(w)}</span>`));
		}
		if (comp.dependencies.length > 0) {
			badges.push(...comp.dependencies.map(d => `<span class="arch-badge arch-badge-dep">${escapeHtml(d)}</span>`));
		}

		const children = childrenByParent.get(comp.id) || [];
		const childSection = children.length > 0
			? `<details class="arch-sub-components">
				<summary>Sub-components (${children.length})</summary>
				<div class="arch-children">${children.map(ch => renderComponentCard(ch, true)).join('')}</div>
			</details>`
			: '';

		return `<div class="arch-component-card${isChild ? ' arch-child-card' : ''}">
			<div class="arch-comp-header">
				<code class="arch-comp-id">${escapeHtml(comp.id)}</code>
				<strong class="arch-comp-label">${escapeHtml(comp.label)}</strong>
			</div>
			<div class="arch-comp-body">
				<div class="arch-comp-responsibility">${escapeHtml(comp.responsibility)}</div>
				${comp.rationale ? `<div class="arch-comp-rationale"><span class="arch-rationale-label">Rationale:</span> ${escapeHtml(comp.rationale)}</div>` : ''}
				${badges.length > 0 ? `<div class="arch-comp-badges">${badges.join('')}</div>` : ''}
				${comp.technologyNotes ? `<div class="arch-comp-tech"><span class="arch-detail-label">Tech:</span> ${escapeHtml(comp.technologyNotes)}</div>` : ''}
				${comp.fileScope ? `<div class="arch-comp-scope"><span class="arch-detail-label">Scope:</span> <code>${escapeHtml(comp.fileScope)}</code></div>` : ''}
				${comp.interactionPatterns.length > 0 ? `<div class="arch-comp-interactions"><span class="arch-detail-label">Interactions:</span> ${comp.interactionPatterns.map(p => escapeHtml(p)).join('; ')}</div>` : ''}
			</div>
			${childSection}
		</div>`;
	}

	const componentCards = topLevel.map(c => renderComponentCard(c, false)).join('');

	// --- Section 2: Domain Model (entity cards with fields + relationships) ---
	const domainModelCards = dataModels.map(m => {
		const fieldRows = m.fields.map(f =>
			`<tr>
				<td><code>${escapeHtml(f.name)}</code></td>
				<td>${escapeHtml(f.type)}</td>
				<td>${f.required ? '<span class="arch-required">required</span>' : '<span class="arch-optional">optional</span>'}</td>
			</tr>`
		).join('');

		const relRows = m.relationships.map(r =>
			`<div class="arch-relationship">
				<span class="arch-rel-arrow">&rarr;</span>
				<strong>${escapeHtml(r.targetModel)}</strong>
				<span class="arch-rel-type">(${escapeHtml(r.type)})</span>
				<span class="arch-rel-desc">${escapeHtml(r.description)}</span>
			</div>`
		).join('');

		const invariantList = m.invariants.length > 0
			? `<div class="arch-invariants"><span class="arch-detail-label">Invariants:</span><ul>${m.invariants.map(inv => `<li>${escapeHtml(inv)}</li>`).join('')}</ul></div>`
			: '';

		return `<div class="arch-model-card">
			<div class="arch-model-header">
				<code class="arch-comp-id">${escapeHtml(m.id)}</code>
				<strong>${escapeHtml(m.entity)}</strong>
			</div>
			${m.description ? `<div class="arch-model-desc">${escapeHtml(m.description)}</div>` : ''}
			${m.fields.length > 0 ? `<table class="arch-fields-table">
				<thead><tr><th>Field</th><th>Type</th><th></th></tr></thead>
				<tbody>${fieldRows}</tbody>
			</table>` : ''}
			${relRows ? `<div class="arch-relationships">${relRows}</div>` : ''}
			${invariantList}
		</div>`;
	}).join('');

	// --- Section 3: Interfaces (contract cards) ---
	const interfaceCards = interfaces.map(iface => {
		const consumers = iface.consumerComponents.length > 0
			? iface.consumerComponents.map(c => escapeHtml(c)).join(', ')
			: 'none';
		const workflows = iface.sourceWorkflows.length > 0
			? iface.sourceWorkflows.map(w => `<span class="arch-badge arch-badge-workflow">${escapeHtml(w)}</span>`).join('')
			: '';

		return `<div class="arch-interface-card">
			<div class="arch-iface-header">
				<code class="arch-comp-id">${escapeHtml(iface.id)}</code>
				<strong>${escapeHtml(iface.label)}</strong>
				<span class="arch-badge arch-badge-type">${escapeHtml(iface.type)}</span>
			</div>
			${iface.description ? `<div class="arch-iface-desc">${escapeHtml(iface.description)}</div>` : ''}
			${iface.contract ? `<div class="arch-contract"><pre>${escapeHtml(iface.contract)}</pre></div>` : ''}
			<div class="arch-iface-endpoints">
				<span class="arch-detail-label">Provider:</span> <code>${escapeHtml(iface.providerComponent)}</code>
				<span class="arch-detail-label" style="margin-left:12px">Consumers:</span> ${consumers}
			</div>
			${workflows ? `<div class="arch-iface-workflows">${workflows}</div>` : ''}
		</div>`;
	}).join('');

	// --- Section 4: Implementation Roadmap (phased steps) ---
	const sortedSteps = [...implementationSequence].sort((a, b) => a.sortOrder - b.sortOrder);

	// Group steps into phases by complexity or sequential chunks
	const roadmapHtml = sortedSteps.map(step => {
		const depText = step.dependencies.length > 0
			? `<span class="arch-detail-label">Depends on:</span> ${step.dependencies.map(d => escapeHtml(d)).join(', ')}`
			: '';
		const compText = step.componentsInvolved.length > 0
			? step.componentsInvolved.map(c => `<code>${escapeHtml(c)}</code>`).join(', ')
			: '';
		const complexityClass = step.complexity === 'HIGH' ? 'arch-complexity-high'
			: step.complexity === 'MEDIUM' ? 'arch-complexity-medium'
			: 'arch-complexity-low';

		return `<div class="arch-roadmap-step">
			<div class="arch-step-header">
				<code class="arch-comp-id">${escapeHtml(step.id)}</code>
				<strong>${escapeHtml(step.label)}</strong>
				<span class="arch-badge ${complexityClass}">${escapeHtml(step.complexity)}</span>
			</div>
			<div class="arch-step-desc">${escapeHtml(step.description)}</div>
			<div class="arch-step-meta">
				${compText ? `<div><span class="arch-detail-label">Components:</span> ${compText}</div>` : ''}
				${depText ? `<div>${depText}</div>` : ''}
				${step.verificationMethod ? `<div><span class="arch-detail-label">Verify:</span> ${escapeHtml(step.verificationMethod)}</div>` : ''}
			</div>
		</div>`;
	}).join('');

	// --- Card meta ---
	const metaText = hasHierarchy
		? `${parentCount} top-level, ${childCount} sub-components, ${dataModels.length} models, ${interfaces.length} interfaces`
		: `${components.length} components, ${dataModels.length} models, ${interfaces.length} interfaces`;

	return `<div class="card architecture-card architecture-design-card" data-timestamp="${escapeHtml(timestamp)}">
		<div class="card-header">
			<span class="role-badge role-architect">ARCHITECT</span>
			<span class="card-title">Architecture Design</span>
			<span class="card-meta">${metaText}</span>
		</div>
		<div class="card-body">
			<details open>
				<summary class="arch-section-summary">Components (${components.length})</summary>
				<div class="arch-section-content">${componentCards || '<p class="arch-empty">No components defined.</p>'}</div>
			</details>
			${dataModels.length ? `<details>
				<summary class="arch-section-summary">Domain Model (${dataModels.length} entities)</summary>
				<div class="arch-section-content">${domainModelCards}</div>
			</details>` : ''}
			${interfaces.length ? `<details>
				<summary class="arch-section-summary">Interfaces (${interfaces.length})</summary>
				<div class="arch-section-content">${interfaceCards}</div>
			</details>` : ''}
			${sortedSteps.length ? `<details>
				<summary class="arch-section-summary">Implementation Roadmap (${sortedSteps.length} steps)</summary>
				<div class="arch-section-content">${roadmapHtml}</div>
			</details>` : ''}
			<button class="gate-btn" data-action="open-architecture-explorer" style="margin-top:6px;">&#x1F50D; View Full Architecture</button>
		</div>
	</div>`;
}

function renderArchitectureValidationCard(
	score: number | null,
	findings: string[],
	validated: boolean,
	timestamp: string
): string {
	const scoreDisplay = score !== null ? `${Math.round(score * 100)}%` : 'N/A';
	const scoreClass = score !== null
		? (score >= 0.8 ? 'score-good' : score >= 0.5 ? 'score-warn' : 'score-bad')
		: 'score-na';
	const statusLabel = validated ? 'Passed' : 'Needs Revision';
	const statusClass = validated ? 'status-pass' : 'status-fail';

	const findingsList = findings.length
		? `<ul class="validation-findings">${findings.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`
		: '<p class="no-findings">No findings — architecture looks good.</p>';

	return `<div class="card architecture-card validation-card" data-timestamp="${escapeHtml(timestamp)}">
		<div class="card-header">
			<span class="role-badge role-historian">HISTORIAN</span>
			<span class="card-title">Architecture Validation</span>
			<span class="card-meta ${statusClass}">${statusLabel}</span>
		</div>
		<div class="card-body">
			<div class="validation-score ${scoreClass}">
				<span class="score-label">Goal Alignment</span>
				<span class="score-value">${scoreDisplay}</span>
			</div>
			${findingsList}
		</div>
	</div>`;
}

function renderDecompositionBreadcrumb(depth: number): string {
	const levels = [
		{ label: 'Goal', level: -2 },
		{ label: 'Capabilities', level: -1 },
		{ label: 'Workflows', level: -1 },
		{ label: 'Components', level: 0 },
		{ label: 'Sub-components', level: 1 },
		{ label: 'Atomic Components', level: 2 },
	];

	const spans = levels.map(function (l) {
		let cls = 'decomposition-level';
		if (l.level < depth) { cls += ' completed'; }
		else if (l.level === depth) { cls += ' active'; }
		return '<span class="' + cls + '">' + l.label + '</span>';
	});

	return '<div class="decomposition-breadcrumb">'
		+ '<div class="decomposition-label">Decomposition Depth</div>'
		+ '<div class="decomposition-levels">' + spans.join('<span class="decomposition-arrow">&#x2192;</span>') + '</div>'
		+ '</div>';
}

function renderArchitectureGateCard(
	docId: string,
	version: number,
	capabilityCount: number,
	componentCount: number,
	goalAlignmentScore: number | null,
	dialogueId: string,
	resolved?: boolean,
	resolvedAction?: string,
	mmpJson?: string,
	decompositionDepth?: number,
	allPendingDecisions?: Record<string, PendingMmpSnapshot>,
	eventId?: number,
): string {
	const scoreDisplay = goalAlignmentScore !== null ? `${Math.round(goalAlignmentScore * 100)}%` : 'N/A';
	const depth = decompositionDepth ?? 0;

	// Parse MMP payload if present — only for unresolved (active) gates.
	// Resolved gates already had their decisions recorded; rendering their MMP items
	// would create duplicate DOM elements that interfere with progress counters.
	let mmpHtml = '';
	if (mmpJson && !resolved) {
		try {
			const mmp = JSON.parse(mmpJson) as MMPPayload;
			if (mmp.mirror || mmp.menu || mmp.preMortem) {
				const cardId = 'ARC-' + (eventId ?? docId + '-v' + version);
				mmpHtml = renderMMPSection(mmp, cardId, true, undefined, allPendingDecisions?.[cardId]);
			}
		} catch { /* ignore parse errors */ }
	}

	const breadcrumbHtml = renderDecompositionBreadcrumb(depth);

	if (resolved) {
		// resolvedAction comes from HumanAction enum: APPROVE, OVERRIDE (skip), REFRAME (revise/deepen)
		const actionLabel = resolvedAction === 'APPROVE' ? 'Approved'
			: resolvedAction === 'OVERRIDE' ? 'Skipped'
			: resolvedAction === 'SUPERSEDED' ? 'Superseded by newer review'
			: 'Revision Requested';
		const actionClass = resolvedAction === 'APPROVE' ? 'gate-approved'
			: resolvedAction === 'OVERRIDE' ? 'gate-skipped'
			: resolvedAction === 'SUPERSEDED' ? 'gate-skipped'
			: 'gate-revised';

		return '<div class="card architecture-card architecture-gate ' + actionClass + '">'
			+ '<div class="card-header">'
			+ '<span class="role-badge role-human">HUMAN</span>'
			+ '<span class="card-title">Architecture Review</span>'
			+ '<span class="card-meta">' + actionLabel + '</span>'
			+ '</div>'
			+ '<div class="card-body">'
			+ breadcrumbHtml
			+ '<p>Architecture v' + version + ': ' + capabilityCount + ' capabilities, ' + componentCount + ' components, goal alignment ' + scoreDisplay + '</p>'
			+ '<button class="gate-btn" data-action="open-architecture-explorer" data-dialogue-id="' + escapeHtml(dialogueId) + '" style="margin-top:4px;">&#x1F50D; View Architecture</button>'
			+ '</div>'
			+ '</div>';
	}

	const maxDepthReached = depth >= 2;
	const deeperBtnDisabled = maxDepthReached ? ' disabled' : '';
	const deeperBtnLabel = maxDepthReached ? 'Max Depth Reached' : 'Decompose Deeper';
	const deeperBtnTitle = maxDepthReached
		? 'Maximum decomposition depth (2 additional levels) has been reached'
		: 'Request one additional level of decomposition';

	return '<div class="card architecture-card architecture-gate gate-pending">'
		+ '<div class="card-header">'
		+ '<span class="role-badge role-human">HUMAN</span>'
		+ '<span class="card-title">Architecture Review Required</span>'
		+ '</div>'
		+ '<div class="card-body">'
		+ '<p>Architecture v' + version + ' is ready for review.</p>'
		+ '<ul>'
		+ '<li><strong>Capabilities:</strong> ' + capabilityCount + '</li>'
		+ '<li><strong>Components:</strong> ' + componentCount + '</li>'
		+ '<li><strong>Goal Alignment:</strong> ' + scoreDisplay + '</li>'
		+ '</ul>'
		+ breadcrumbHtml
		+ mmpHtml
		+ '<div class="architecture-feedback-area">'
		+ '<textarea placeholder="Describe what changes you want (min 10 characters)..." rows="3"></textarea>'
		+ '</div>'
		+ '<div class="gate-actions">'
		+ '<button class="gate-btn gate-btn-approve" data-action="architecture-approve" data-dialogue-id="' + escapeHtml(dialogueId) + '" data-doc-id="' + escapeHtml(docId) + '">Approve</button>'
		+ '<button class="gate-btn gate-btn-revise" data-action="architecture-revise" data-dialogue-id="' + escapeHtml(dialogueId) + '" data-doc-id="' + escapeHtml(docId) + '">Request Changes</button>'
		+ '<button class="gate-btn gate-btn-skip" data-action="architecture-skip" data-dialogue-id="' + escapeHtml(dialogueId) + '" data-doc-id="' + escapeHtml(docId) + '">Skip</button>'
		+ '<button class="gate-btn gate-btn-deeper" data-action="architecture-decompose-deeper" data-dialogue-id="' + escapeHtml(dialogueId) + '" data-doc-id="' + escapeHtml(docId) + '" title="' + deeperBtnTitle + '"' + deeperBtnDisabled + '>' + deeperBtnLabel + '</button>'
		+ '<button class="gate-btn" data-action="open-architecture-explorer" data-dialogue-id="' + escapeHtml(dialogueId) + '" style="margin-left:auto;">&#x1F50D; View Architecture</button>'
		+ '</div>'
		+ '</div>'
		+ '</div>';
}

