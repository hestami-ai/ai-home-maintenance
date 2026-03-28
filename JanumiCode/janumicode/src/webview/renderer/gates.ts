/**
 * Gate card renderers for the webview: human gates, verification gates,
 * review gates, permission cards, and warning cards.
 */

import { esc, formatTimestamp } from './utils';
import { verdictClass, verdictIcon } from './cards';
import type { Gate, Claim, Verdict, ReviewItem, ReviewSummary, ClaimAdjudication } from './streamTypes';
import { GateStatus, ClaimStatus } from './streamTypes';
import { renderMMPSection, synthesizeReviewMMP } from './mmpRenderer';
import type { PendingMmpSnapshot } from './streamTypes';

// ==================== Helpers ====================

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

function renderAskMoreToggle(itemId: string, itemContext: string): string {
	const escaped = esc(itemId);
	const escapedCtx = esc(itemContext);
	return `<button class="ask-more-toggle" data-action="toggle-askmore"
		data-clarification-item="${escaped}"
		data-clarification-context="${escapedCtx}">Ask More</button>`;
}

function renderMicButton(_targetInputId: string): string {
	// Mic button rendering is controlled by the extension host via flags.
	// In CSR mode, return empty — speech buttons are managed by the webview speech module.
	return '';
}

// ==================== Adjudication Details ====================

export function renderAdjudicationDetails(adj: ClaimAdjudication): string {
	let html = '<div class="review-item-adjudication">';
	html += `<div class="adjudication-rationale">Historian: ${esc(adj.rationale)}</div>`;

	if (adj.citations.length > 0) {
		html += '<div class="adjudication-citations">';
		for (const cite of adj.citations) {
			html += `<span class="citation-tag">${esc(cite)}</span>`;
		}
		html += '</div>';
	}

	if (adj.conflicts && adj.conflicts.length > 0) {
		html += '<div class="adjudication-conflicts"><strong>Conflicts:</strong><ul>';
		for (const conflict of adj.conflicts) {
			html += `<li>${esc(conflict)}</li>`;
		}
		html += '</ul></div>';
	}

	if (adj.conditions && adj.conditions.length > 0) {
		html += '<div class="adjudication-conditions"><strong>Conditions:</strong><ul>';
		for (const cond of adj.conditions) {
			html += `<li>${esc(cond)}</li>`;
		}
		html += '</ul></div>';
	}

	if (adj.verification_queries && adj.verification_queries.length > 0) {
		html += '<div class="adjudication-queries"><strong>Missing evidence:</strong><ul>';
		for (const q of adj.verification_queries) {
			html += `<li>${esc(q)}</li>`;
		}
		html += '</ul></div>';
	}

	html += '</div>';
	return html;
}

// ==================== Gate Evaluation ====================

export function renderGateEvaluation(metadata?: Record<string, unknown>): string {
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
	const summary = evaluation.summary ? esc(evaluation.summary) : '';

	const deliverables = Array.isArray(evaluation.deliverables) ? evaluation.deliverables : [];
	const issues = Array.isArray(evaluation.issues) ? evaluation.issues : [];
	const recommendations = Array.isArray(evaluation.recommendations) ? evaluation.recommendations : [];

	let html = `<div class="gate-evaluation">`;
	html += `<div class="gate-eval-status"><span class="gate-eval-badge ${esc(statusClass)}">${icon} ${esc(label)}</span></div>`;
	if (summary) {
		html += `<div class="gate-eval-summary">${summary}</div>`;
	}
	if (deliverables.length > 0) {
		html += `<div class="gate-eval-section"><h4>Deliverables</h4><ul>${deliverables.map((d) => `<li>${esc(String(d))}</li>`).join('')}</ul></div>`;
	}
	if (issues.length > 0) {
		html += `<div class="gate-eval-section"><h4>Issues</h4><ul>${issues.map((i) => `<li>${esc(String(i))}</li>`).join('')}</ul></div>`;
	}
	if (recommendations.length > 0) {
		html += `<div class="gate-eval-section"><h4>Recommendations</h4><ul>${recommendations.map((r) => `<li>${esc(String(r))}</li>`).join('')}</ul></div>`;
	}
	if (evaluation.contentRecoverable) {
		const suggestedPath = evaluation.intendedFilePath
			? esc(evaluation.intendedFilePath)
			: '&lt;path&gt;';
		html += `<div class="gate-eval-recovery">Content recoverable &mdash; type <code>save ${suggestedPath}</code> to write the file</div>`;
	}
	html += `</div>`;
	return html;
}

// ==================== Human Gate Card ====================

export function renderHumanGateCard(gate: Gate, blockingClaims: Claim[], resolvedAction?: string, metadata?: Record<string, unknown>): string {
	const isResolved = gate.status === GateStatus.RESOLVED;

	const claimsListHtml = blockingClaims.length > 0
		? blockingClaims.map((c) => `
			<li class="claim-item" data-claim-id="${esc(c.claim_id)}">
				<span class="verdict-badge ${verdictClass(c.status)}">${verdictIcon(c.status)} ${esc(c.status)}</span>
				<span>${esc(c.statement)}</span>
			</li>
		`).join('')
		: '<li class="claim-item">No specific claims linked</li>';

	const headerText = isResolved
		? `&#x2705; Gate Resolved: ${esc(resolvedAction ?? 'Decision made')} &mdash; ${esc(gate.reason)}`
		: `Human Decision Required: ${esc(gate.reason)}`;

	const headerIcon = isResolved ? '&#x2705;' : '&#x1F6A7;';
	const expandedClass = isResolved ? '' : 'expanded';
	const resolvedClass = isResolved ? ' resolved' : '';

	const evaluationHtml = renderGateEvaluation(metadata);

	return `
		<div class="gate-card collapsible-card ${expandedClass}${resolvedClass}" data-gate-id="${esc(gate.gate_id)}">
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
					<label for="rationale-${esc(gate.gate_id)}">Rationale (required, min 10 characters)</label>
					<textarea
						id="rationale-${esc(gate.gate_id)}"
						placeholder="Explain your decision..."
						data-gate-rationale="${esc(gate.gate_id)}"
					></textarea>
					<div class="response-toolbar">
						<div class="gate-char-count" id="charcount-${esc(gate.gate_id)}">0 / 10 min</div>
						${renderMicButton('gate-rationale:' + gate.gate_id)}
					</div>
				</div>
				<div class="gate-actions">
					<button class="gate-btn approve" disabled data-gate-id="${esc(gate.gate_id)}" data-action="gate-decision" data-gate-action="APPROVE">Approve</button>
					<button class="gate-btn reject" disabled data-gate-id="${esc(gate.gate_id)}" data-action="gate-decision" data-gate-action="REJECT">Reject</button>
					<button class="gate-btn override" disabled data-gate-id="${esc(gate.gate_id)}" data-action="gate-decision" data-gate-action="OVERRIDE">Override</button>
					<button class="gate-btn reframe" disabled data-gate-id="${esc(gate.gate_id)}" data-action="gate-decision" data-gate-action="REFRAME">Reframe</button>
				</div>
				`}
			</div>
		</div>
	`;
}

// ==================== Verification Gate Card ====================

export function renderVerificationGateCard(
	gate: Gate,
	allClaims: Claim[],
	verdicts: Verdict[],
	blockingClaims: Claim[],
	resolvedAction?: string
): string {
	const isResolved = gate.status === GateStatus.RESOLVED;
	const verdictByClaim = new Map<string, Verdict>();
	for (const v of verdicts) {
		verdictByClaim.set(v.claim_id, v);
	}

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

	const blockingIds = new Set(blockingClaims.map((c) => c.claim_id));
	const nonBlockingClaims = allClaims.filter((c) => !blockingIds.has(c.claim_id));
	const blockingCount = blockingClaims.length;

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

	function renderClaimRow(claim: Claim, showResponse: boolean): string {
		const verdict = verdictByClaim.get(claim.claim_id);
		const critClass = claim.criticality === 'CRITICAL' ? 'critical' : 'non-critical';
		const rationale = verdict?.rationale;

		let html = `
			<div class="verification-claim-row" data-claim-id="${esc(claim.claim_id)}">
				<div class="verification-claim-header">
					<span class="verdict-badge ${verdictClass(claim.status)}">${verdictIcon(claim.status)} ${esc(claim.status)}</span>
					<span class="verification-claim-criticality ${critClass}">${esc(claim.criticality)}</span>
				</div>
				<div class="verification-claim-statement">${esc(claim.statement)}</div>
		`;

		if (rationale) {
			html += `<div class="verification-claim-rationale">Verifier: ${esc(rationale)}</div>`;
		}

		if (showResponse && !isResolved) {
			html += `
				<div class="verification-claim-response" data-clarification-item="${esc(claim.claim_id)}">
					<label>Your response (min 10 characters)</label>
					<div class="clarification-messages" id="clarification-messages-${esc(claim.claim_id)}" style="display:none;"></div>
					<textarea
						placeholder="Explain why you accept this risk or disagree with the finding..."
						data-claim-rationale="${esc(claim.claim_id)}"
						data-gate-id="${esc(gate.gate_id)}"
					></textarea>
					<div class="response-toolbar">
						<div class="verification-claim-charcount" id="vg-charcount-${esc(claim.claim_id)}">0 / 10 min</div>
						${renderMicButton('claim-rationale:' + claim.claim_id)}
						${renderAskMoreToggle(claim.claim_id, claim.statement)}
					</div>
				</div>
			`;
		}

		html += '</div>';
		return html;
	}

	const blockingHtml = blockingClaims.length > 0
		? `
			<div class="verification-claims-group">
				<div class="verification-group-header">&#x1F6A8; Blocking — ${blockingCount} critical claim${blockingCount !== 1 ? 's' : ''} requiring response</div>
				${blockingClaims.map((c) => renderClaimRow(c, true)).join('')}
			</div>
		`
		: '';

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

	const actionsHtml = isResolved ? '' : `
		<div class="verification-actions">
			<button class="verification-btn accept-risks" disabled
				data-action="verification-gate-decision"
				data-gate-id="${esc(gate.gate_id)}"
				data-gate-action="OVERRIDE"
				data-blocking-count="${blockingCount}">
				Accept Risks &amp; Continue
			</button>
			<button class="verification-btn retry-verify"
				data-action="verification-gate-decision"
				data-gate-id="${esc(gate.gate_id)}"
				data-gate-action="RETRY_VERIFY">
				Retry Verification
			</button>
			<button class="verification-btn replan"
				data-action="verification-gate-decision"
				data-gate-id="${esc(gate.gate_id)}"
				data-gate-action="REFRAME">
				Replan
			</button>
		</div>
	`;

	const resolvedBadge = isResolved
		? `<span class="gate-resolved-badge">&#x2705; ${esc(resolvedAction ?? 'Resolved')}</span>`
		: '';

	const headerText = isResolved
		? `Verification Complete ${resolvedBadge}`
		: `Verification Complete: ${blockingCount} claim${blockingCount !== 1 ? 's' : ''} need${blockingCount === 1 ? 's' : ''} attention`;

	return `
		<div class="verification-gate-card${isResolved ? ' resolved' : ''}" data-gate-id="${esc(gate.gate_id)}">
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

// ==================== Review Gate Card ====================

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
	const gateId = esc(gate.gate_id);
	const isResolved = gate.status === GateStatus.RESOLVED;

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
			? `<span class="assumption-type-badge">${esc(claim.assumption_type)}</span>`
			: '';

		const adjBadge = adjudication
			? `<span class="adjudication-badge ${adjudicationClass(adjudication.verdict)}">${adjudicationIcon(adjudication.verdict)} ${esc(adjudication.verdict)}</span>`
			: '';

		let html = `
			<div class="review-item-row" data-claim-id="${esc(claim.claim_id)}">
				<div class="review-item-header">
					<span class="verdict-badge ${verdictClass(claim.status)}">${verdictIcon(claim.status)} ${esc(claim.status)}</span>
					<span class="verification-claim-criticality ${critClass}">${esc(claim.criticality)}</span>
					${typeBadge}
					${adjBadge}
				</div>
				<div class="review-item-statement">${esc(claim.statement)}</div>
		`;

		if (rationale) {
			html += `<div class="review-item-rationale">Verifier: ${esc(rationale)}</div>`;
		}

		if (adjudication) {
			html += renderAdjudicationDetails(adjudication);
		}

		if (showResponse && !isResolved) {
			html += `
				<div class="review-item-response" data-clarification-item="${esc(claim.claim_id)}">
					<div class="clarification-messages" id="clarification-messages-${esc(claim.claim_id)}" style="display:none;"></div>
					<textarea
						placeholder="Explain your decision on this claim..."
						data-review-item-rationale="${esc(claim.claim_id)}"
						data-gate-id="${gateId}"
					></textarea>
					<div class="response-toolbar">
						<div class="review-item-charcount" id="review-charcount-${esc(claim.claim_id)}">0 / 10 min</div>
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
				<div class="review-item-statement">${esc(text)}</div>
				<div class="review-finding-context">This is an observation from the Historian about patterns or precedents in the workflow. Consider whether it affects your decision to proceed.</div>
		`;

		if (showResponse && !isResolved) {
			html += `
				<div class="review-item-response" data-clarification-item="${esc(findingKey)}">
					<div class="clarification-messages" id="clarification-messages-${esc(findingKey)}" style="display:none;"></div>
					<textarea
						placeholder="Your response to this finding..."
						data-review-item-rationale="${esc(findingKey)}"
						data-gate-id="${gateId}"
					></textarea>
					<div class="response-toolbar">
						<div class="review-item-charcount" id="review-charcount-${esc(findingKey)}">0 / 10 min</div>
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

	// Synthesize MMP
	const reviewMMP = synthesizeReviewMMP(reviewItems, summary, _historianFindings);
	const mmpCardId = 'REV-' + gate.gate_seq;
	const hasMmpInteraction = !!reviewMMP && !isResolved;

	let reviewGroupsHtml: string;
	if (hasMmpInteraction) {
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

	// Overall feedback / decision history
	const needsCount = needsDecision.length;
	let overallHtml: string;
	let actionsHtml: string;

	if (isResolved) {
		const isApproved = resolvedAction === 'APPROVE' || resolvedAction === 'OVERRIDE';
		const actionLabel = isApproved ? 'Approved & Continued to Execute' : 'Changes Requested';
		const actionIcon = isApproved ? '&#x2705;' : '&#x1F504;';
		const resolvedTime = gate.resolved_at ? formatTimestamp(gate.resolved_at) : '';

		const rationaleLines: string[] = [];
		if (resolvedRationale) {
			for (const line of resolvedRationale.split('\n')) {
				const trimmed = line.trim();
				if (trimmed) { rationaleLines.push(trimmed); }
			}
		}

		const rationaleHtml = rationaleLines.length > 0
			? `<div class="review-resolved-rationale">
				<label>Your feedback:</label>
				<div class="review-resolved-rationale-text">${rationaleLines.map((l) => esc(l)).join('<br>')}</div>
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
		? `<span class="gate-resolved-badge">&#x2705; ${esc(resolvedAction === 'APPROVE' ? 'Approved' : resolvedAction === 'REFRAME' ? 'Changes Requested' : resolvedAction ?? 'Resolved')}</span>`
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

// ==================== Permission Card ====================

export function renderPermissionCard(permissionId: string, tool: string, input: Record<string, unknown>): string {
	const escapedId = esc(permissionId);
	const escapedTool = esc(tool);

	let inputSummary = '';
	if (input.command) {
		inputSummary = `Command: ${esc(String(input.command).substring(0, 200))}`;
	} else if (input.file_path || input.path) {
		inputSummary = `File: ${esc(String(input.file_path || input.path))}`;
	} else if (input.pattern) {
		inputSummary = `Pattern: ${esc(String(input.pattern))}`;
	} else {
		const keys = Object.keys(input).filter(k => k !== '_permissionId');
		if (keys.length > 0) {
			inputSummary = keys.map(k => `${esc(k)}: ${esc(String(input[k]).substring(0, 100))}`).join(', ');
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

// ==================== Warning Card ====================

export function renderWarningCard(message: string): string {
	return `
		<div class="warning-card collapsible-card expanded">
			<div class="collapsible-card-header warning-header" data-action="toggle-card">
				<span class="card-chevron">&#x25B6;</span>
				<span>&#x26A0;&#xFE0F;</span>
				<span>Historical Contradiction Detected</span>
			</div>
			<div class="collapsible-card-body">
				<div class="card-content">${esc(message)}</div>
			</div>
		</div>
	`;
}
