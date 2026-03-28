/**
 * Mirror & Menu Protocol (MMP) renderers for the webview.
 * Renders Mirror cards, Menu cards, Pre-Mortem cards, and submit bars.
 */

import { esc } from './utils';
import type { MMPPayload, MirrorItem, PendingMmpSnapshot, ReviewItem, ReviewSummary } from './streamTypes';

// ==================== Source Badge ====================

export function renderSourceBadge(source: string): string {
	const sourceMap: Record<string, { label: string; cssClass: string }> = {
		'document-specified': { label: 'DOC', cssClass: 'badge-source-doc' },
		'user-specified': { label: 'USER', cssClass: 'badge-source-user' },
		'domain-standard': { label: 'STANDARD', cssClass: 'badge-source-standard' },
		'ai-proposed': { label: 'AI', cssClass: 'badge-source-ai' },
	};
	const info = sourceMap[source] ?? { label: source.toUpperCase(), cssClass: 'badge-source-ai' };
	return '<span class="badge-source ' + info.cssClass + '" title="Source: ' + esc(source) + '">' + info.label + '</span>';
}

// ==================== MMP Section ====================

export function renderMMPSection(
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

	// Add submit bar for interactive MMP
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

// ==================== Mirror Card ====================

export function renderMirrorCard(
	mirror: NonNullable<MMPPayload['mirror']>,
	cardId: string,
	isLatest: boolean,
	pending?: PendingMmpSnapshot,
): string {
	const itemsHtml = mirror.items.map((item) => {
		const itemKey = cardId + ':' + item.id;
		const categoryClass = item.category;
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
				'Edited: ' + esc(item.editedText) + '</div>'
			: '';

		const sourceBadge = item.source ? renderSourceBadge(item.source) : '';

		return '<div class="mmp-mirror-item' + statusClass + resolvedClass + '" data-mmp-mirror-id="' + esc(item.id) + '" data-mmp-card="' + cardId + '">' +
			'<div class="mmp-mirror-item-header">' +
				'<span class="mmp-category-badge ' + categoryClass + '">' + esc(item.category) + '</span>' +
				sourceBadge +
				'<span class="mmp-mirror-item-text">' + esc(item.text) + '</span>' +
				resolvedBadge +
			'</div>' +
			(item.rationale
				? '<div class="mmp-mirror-item-rationale" id="rationale-' + itemKey + '">' +
					'<em>Rationale:</em> ' + esc(item.rationale) + '</div>'
				: '') +
			editedTextNote +
			(isLatest
				? '<div class="mmp-mirror-item-actions">' +
					'<button class="mmp-btn mmp-accept' + (pendingDecision?.status === 'accepted' ? ' selected' : '') + '" data-action="mirror-accept" data-mmp-item="' + esc(item.id) + '" data-mmp-card="' + cardId + '" title="Accept this assumption">\u2713 Accept</button>' +
					'<button class="mmp-btn mmp-reject' + (pendingDecision?.status === 'rejected' ? ' selected' : '') + '" data-action="mirror-reject" data-mmp-item="' + esc(item.id) + '" data-mmp-card="' + cardId + '" title="Reject this assumption">\u2717 Reject</button>' +
					'<button class="mmp-btn mmp-defer' + (pendingDecision?.status === 'deferred' ? ' selected' : '') + '" data-action="mirror-defer" data-mmp-item="' + esc(item.id) + '" data-mmp-card="' + cardId + '" title="Defer to a later phase">\u23F3 Defer</button>' +
					'<button class="mmp-btn mmp-edit' + (pendingDecision?.status === 'edited' ? ' selected' : '') + '" data-action="mirror-edit" data-mmp-item="' + esc(item.id) + '" data-mmp-card="' + cardId + '" title="Edit this assumption">\u270E Edit</button>' +
					(item.rationale
						? '<button class="mmp-btn mmp-rationale-toggle" data-action="mirror-rationale" data-mmp-item="' + esc(item.id) + '" data-mmp-card="' + cardId + '" title="Show rationale">Why?</button>'
						: '') +
				  '</div>' +
				  '<div class="mmp-mirror-item-edit-area" id="edit-area-' + itemKey + '">' +
					'<textarea data-mmp-edit-textarea="' + esc(item.id) + '" data-mmp-card="' + cardId + '" placeholder="Edit the assumption..." rows="2">' + esc(item.text) + '</textarea>' +
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
				? '<div class="mmp-mirror-steelman">' + esc(mirror.steelMan) + '</div>'
				: '') +
			itemsHtml +
		'</div>' +
	'</div>';
}

// ==================== Inline Mirror Buttons ====================

export function renderInlineMirrorButtons(
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

	let html = '<div class="mmp-mirror-item proposer-inline-mmp' + statusClass + '" data-mmp-mirror-id="' + esc(mirrorItemId) + '" data-mmp-card="' + cardId + '">';

	if (sourceBadge) { html += sourceBadge; }

	html += contentHtml;

	html += '<span class="mmp-mirror-item-text mmp-hidden-text">' + esc(mirrorText) + '</span>';

	if (isLatest) {
		const askMoreId = cardId + '-' + mirrorItemId;
		html += '<div class="mmp-mirror-item-actions">' +
			'<button class="mmp-btn mmp-accept' + (pendingDecision?.status === 'accepted' ? ' selected' : '') + '" data-action="mirror-accept" data-mmp-item="' + esc(mirrorItemId) + '" data-mmp-card="' + cardId + '" title="Accept">\u2713 Accept</button>' +
			'<button class="mmp-btn mmp-reject' + (pendingDecision?.status === 'rejected' ? ' selected' : '') + '" data-action="mirror-reject" data-mmp-item="' + esc(mirrorItemId) + '" data-mmp-card="' + cardId + '" title="Reject">\u2717 Reject</button>' +
			'<button class="mmp-btn mmp-defer' + (pendingDecision?.status === 'deferred' ? ' selected' : '') + '" data-action="mirror-defer" data-mmp-item="' + esc(mirrorItemId) + '" data-mmp-card="' + cardId + '" title="Defer">\u23F3 Defer</button>' +
			'<button class="mmp-btn mmp-edit' + (pendingDecision?.status === 'edited' ? ' selected' : '') + '" data-action="mirror-edit" data-mmp-item="' + esc(mirrorItemId) + '" data-mmp-card="' + cardId + '" title="Edit">\u270E Edit</button>' +
			'<button class="mmp-btn mmp-askmore ask-more-toggle" data-action="toggle-askmore" data-clarification-item="' + esc(askMoreId) + '" data-clarification-context="' + esc(mirrorText) + '" title="Ask a question about this item">Ask More</button>' +
			'</div>' +
			'<div class="mmp-mirror-item-edit-area" id="edit-area-' + itemKey + '">' +
			'<textarea data-mmp-edit-textarea="' + esc(mirrorItemId) + '" data-mmp-card="' + cardId + '" placeholder="Describe your changes or corrections..." rows="2"></textarea>' +
			'</div>' +
			'<div class="clarification-response-area" data-clarification-item="' + esc(askMoreId) + '">' +
			'<div class="clarification-messages" id="clarification-messages-' + esc(askMoreId) + '"></div>' +
			'<textarea placeholder="Ask about this item..." rows="2" data-original-placeholder="Ask about this item..."></textarea>' +
			'<div class="response-toolbar">' +
			'</div>' +
			'</div>';
	} else {
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

// ==================== Menu Card ====================

export function renderMenuCard(
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
				'data-mmp-menu-id="' + esc(item.id) + '" ' +
				'data-mmp-option-id="' + esc(opt.optionId) + '" ' +
				'data-mmp-card="' + cardId + '">' +
				'<div class="mmp-option-header">' +
					'<span class="mmp-option-radio"></span>' +
					'<span class="mmp-option-label">' + esc(opt.label) + '</span>' +
					(opt.recommended ? '<span class="mmp-option-recommended-badge">\u2605 Recommended</span>' : '') +
				'</div>' +
				(opt.description ? '<div class="mmp-option-description">' + esc(opt.description) + '</div>' : '') +
				(opt.tradeoffs ? '<div class="mmp-option-tradeoffs">Tradeoff: ' + esc(opt.tradeoffs) + '</div>' : '') +
			'</div>';
		}).join('');

		const otherOption = isLatest
			? '<div class="mmp-option-card other-option" ' +
				'data-action="menu-select" ' +
				'data-mmp-menu-id="' + esc(item.id) + '" ' +
				'data-mmp-option-id="OTHER" ' +
				'data-mmp-card="' + cardId + '">' +
				'<div class="mmp-option-header">' +
					'<span class="mmp-option-radio"></span>' +
					'<span class="mmp-option-label">Other</span>' +
				'</div>' +
				'<textarea class="mmp-menu-custom-textarea" ' +
					'data-mmp-custom-textarea="' + esc(item.id) + '" ' +
					'data-mmp-card="' + cardId + '" ' +
					'placeholder="Describe your preference..." rows="2"></textarea>' +
			  '</div>'
			: '';

		const customNote = !isLatest && item.selectedOptionId === 'OTHER' && item.customResponse
			? '<div style="font-size:12px;color:var(--vscode-descriptionForeground);margin-top:4px;font-style:italic;">Custom: ' +
				esc(item.customResponse) + '</div>'
			: '';

		return '<div class="mmp-menu-item' + resolvedClass + '">' +
			'<div class="mmp-menu-question">' + esc(item.question) + '</div>' +
			(item.context ? '<div class="mmp-menu-context">' + esc(item.context) + '</div>' : '') +
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

// ==================== Pre-Mortem Card ====================

export function renderPreMortemCard(
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

		return '<div class="mmp-premortem-item' + statusClass + resolvedClass + '" data-mmp-premortem-id="' + esc(item.id) + '" data-mmp-card="' + cardId + '">' +
			'<div class="mmp-premortem-item-header">' +
				'<span class="mmp-severity-badge ' + item.severity + '">' + esc(item.severity) + '</span>' +
				'<span class="mmp-premortem-assumption">' + esc(item.assumption) + '</span>' +
				resolvedBadge +
			'</div>' +
			'<div class="mmp-premortem-failure">' +
				'<strong>If this fails:</strong> ' + esc(item.failureScenario) +
			'</div>' +
			(item.mitigation
				? '<div class="mmp-premortem-mitigation">' +
					'<strong>Mitigation:</strong> ' + esc(item.mitigation) +
				  '</div>'
				: '') +
			(isLatest
				? '<div class="mmp-premortem-item-actions">' +
					'<button class="mmp-btn mmp-accept' + (pendingDecision?.status === 'accepted' ? ' selected' : '') + '" data-action="premortem-accept" data-mmp-item="' + esc(item.id) + '" data-mmp-card="' + cardId + '" title="Accept this risk">\u2713 Accept Risk</button>' +
					'<button class="mmp-btn mmp-reject' + (pendingDecision?.status === 'rejected' ? ' selected' : '') + '" data-action="premortem-reject" data-mmp-item="' + esc(item.id) + '" data-mmp-card="' + cardId + '" title="This risk is unacceptable">\u2717 Unacceptable</button>' +
				  '</div>' +
				  '<div class="mmp-premortem-rationale-area" id="pm-rationale-' + itemKey + '">' +
					'<textarea data-mmp-pm-rationale="' + esc(item.id) + '" data-mmp-card="' + cardId + '" placeholder="Why is this risk unacceptable?" rows="2"></textarea>' +
				  '</div>'
				: '') +
			(item.rationale && !isLatest
				? '<div style="font-size:12px;color:var(--vscode-descriptionForeground);margin-top:4px;font-style:italic;">Rationale: ' + esc(item.rationale) + '</div>'
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
				? '<div class="mmp-premortem-summary">' + esc(preMortem.summary) + '</div>'
				: '') +
			itemsHtml +
		'</div>' +
	'</div>';
}

// ==================== MMP Submit Bar ====================

function renderMMPSubmitBar(cardId: string, mmp?: MMPPayload, pending?: PendingMmpSnapshot): string {
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

// ==================== Synthesize Review MMP ====================

/**
 * Client-side stub for synthesizeReviewMMP.
 * In the webview, we don't have the full dataAggregator — this is a simplified
 * version that returns null so the review gate renders without MMP.
 * The actual MMP synthesis happens server-side and is passed via the stream data.
 */
export function synthesizeReviewMMP(
	_reviewItems: ReviewItem[],
	_summary: ReviewSummary,
	_historianFindings: string[],
): MMPPayload | null {
	// Review MMP synthesis requires the full dataAggregator logic.
	// In CSR mode, the server pre-synthesizes the MMP and includes it
	// in the stream item data. Return null here so the review gate
	// falls back to inline review groups.
	return null;
}
