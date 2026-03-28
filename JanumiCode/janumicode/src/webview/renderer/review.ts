/**
 * Reasoning review card renderer for the webview.
 */

import { esc, formatTimestamp } from './utils';

// ==================== Reasoning Review Card ====================

export function renderReasoningReviewCard(
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
				'<span class="review-concern-summary">' + esc(c.summary) + '</span>' +
			'</div>' +
			'<details class="review-concern-details">' +
				'<summary>Details &amp; recommendation</summary>' +
				'<div class="review-concern-detail">' + esc(c.detail) + '</div>' +
				(c.location ? '<div class="review-concern-location"><em>Location:</em> ' + esc(c.location) + '</div>' : '') +
				'<div class="review-concern-recommendation"><strong>Recommendation:</strong> ' + esc(c.recommendation) + '</div>' +
			'</details>' +
		'</div>';
	}).join('');

	const promptHtml = reviewPrompt
		? '<details class="review-prompt-details">' +
			'<summary>&#x1F4DD; Review Prompt</summary>' +
			'<pre class="review-prompt-content">' + esc(reviewPrompt) + '</pre>' +
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
				' &middot; ' + esc(reviewerModel) +
				' &middot; ' + formatTimestamp(timestamp) + '</span>' +
		'</div>' +
		'<div class="review-assessment">' + esc(overallAssessment) + '</div>' +
		'<div class="review-concerns">' + concernsHtml + '</div>' +
		promptHtml +
		'<div class="review-actions">' +
			'<button class="mmp-btn review-action-btn" data-action="review-acknowledge">Acknowledge</button>' +
			'<button class="mmp-btn review-action-btn" data-action="review-rerun">Re-run with corrections</button>' +
			'<button class="mmp-btn review-action-btn" data-action="review-guidance">Add guidance</button>' +
		'</div>' +
	'</div>';
}
