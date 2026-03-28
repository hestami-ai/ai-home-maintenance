/**
 * Command block and tool call card handlers for the Governed Stream webview.
 * Renders CLI invocations, API calls, and tool use activities as
 * collapsible blocks in the stream.
 */

import type { CommandActivityData, ToolCallActivityData, IncomingMessage } from './types';
import { state } from './state';
import { escapeHtmlClient, formatTime, formatByteSize, scrollToBottom } from './utils';

// ===== Command Block Handling =====

export function handleCommandActivity(data: CommandActivityData): void {
	if (!data || !data.commandId) { return; }
	const blockId = 'cmd-' + data.commandId;

	switch (data.action) {
		case 'start':
			createCommandBlock(blockId, data);
			break;
		case 'output':
			appendCommandOutput(blockId, data);
			break;
		case 'complete':
			completeCommandBlock(blockId, data);
			break;
		case 'error':
			errorCommandBlock(blockId, data);
			break;
	}
}

export function getCommandIcon(commandType: string | undefined): string {
	switch (commandType) {
		case 'cli_invocation': return '&#x1F4BB;';
		case 'llm_api_call': return '&#x2728;';
		case 'role_invocation': return '&#x1F916;';
		default: return '&#x2699;';
	}
}

export function getTypeLabel(commandType: string | undefined): string {
	switch (commandType) {
		case 'cli_invocation': return 'CLI';
		case 'llm_api_call': return 'API';
		case 'role_invocation': return 'Role';
		default: return 'CMD';
	}
}

export function createCommandBlock(blockId: string, data: CommandActivityData): void {
	const streamArea = document.getElementById('stream-content');
	if (!streamArea) { return; }

	// Remove existing if somehow duplicated
	const dup = document.getElementById(blockId);
	if (dup) { dup.remove(); }

	const collapsed = data.collapsed ? '' : ' expanded';
	const icon = getCommandIcon(data.commandType);
	const typeLabel = getTypeLabel(data.commandType);
	const time = data.timestamp ? formatTime(data.timestamp) : '';

	const html = '<div id="' + blockId + '" class="command-block status-running' + collapsed + '" data-command-id="' + escapeHtmlClient(data.commandId) + '">' +
		'<div class="command-block-header" data-action="toggle-command">' +
			'<span class="command-block-chevron">&#x25B6;</span>' +
			'<span class="command-block-icon">' + icon + '</span>' +
			'<span class="command-block-label">' + escapeHtmlClient(data.label || 'Command') + '</span>' +
			'<span class="command-block-type">' + typeLabel + '</span>' +
			'<span class="command-block-status running"><span class="command-block-spinner"></span></span>' +
			'<span class="command-block-time">' + time + '</span>' +
		'</div>' +
		'<div class="command-block-body">' +
			'<div class="command-block-output">' +
				(data.summary ? '<span class="cmd-line summary">' + escapeHtmlClient(data.summary) + '</span>' : '') +
			'</div>' +
		'</div>' +
	'</div>';

	// Insert before the processing indicator if it exists, otherwise at end
	const processingEl = document.getElementById('processing-indicator');
	if (processingEl) {
		processingEl.insertAdjacentHTML('beforebegin', html);
	} else {
		streamArea.insertAdjacentHTML('beforeend', html);
	}
	state.cmdBlockLineCounts[blockId] = data.summary ? 1 : 0;
	scrollToBottom();
}

export function appendCommandOutput(blockId: string, data: CommandActivityData): void {
	const block = document.getElementById(blockId);
	if (!block) {
		createCommandBlock(blockId, data);
		return;
	}

	const output = block.querySelector('.command-block-output');
	if (!output) { return; }

	// Handle stdin lineType as a collapsible expandable block
	if (data.lineType === 'stdin' && data.detail) {
		const stdinLabel = data.summary || '\u2500\u2500 stdin \u2500\u2500';
		const stdinHtml =
			'<div class="cmd-stdin-block">' +
				'<div class="cmd-stdin-header" data-action="toggle-stdin">' +
					'<span class="cmd-stdin-chevron">&#x25B6;</span>' +
					'<span class="cmd-stdin-label">' + escapeHtmlClient(stdinLabel) + '</span>' +
					'<span class="cmd-stdin-size">' + formatByteSize(data.detail.length) + '</span>' +
				'</div>' +
				'<div class="cmd-stdin-content">' +
					'<pre>' + escapeHtmlClient(data.detail) + '</pre>' +
				'</div>' +
			'</div>';
		output.insertAdjacentHTML('beforeend', stdinHtml);
		state.cmdBlockLineCounts[blockId] = (state.cmdBlockLineCounts[blockId] || 0) + 1;
		scrollToBottom();
		return;
	}

	const lineCount = state.cmdBlockLineCounts[blockId] || 0;
	const lines: string[] = [];

	if (data.summary) {
		lines.push('<span class="cmd-line summary">' + escapeHtmlClient(data.summary) + '</span>');
	}
	if (data.detail) {
		lines.push('<span class="cmd-line detail">' + escapeHtmlClient(data.detail) + '</span>');
	}

	if (lines.length === 0) { return; }

	const newCount = lineCount + lines.length;

	if (newCount <= state.cmdMaxLines) {
		output.insertAdjacentHTML('beforeend', lines.join(''));
		state.cmdBlockLineCounts[blockId] = newCount;
	} else if (lineCount < state.cmdMaxLines) {
		const remaining = state.cmdMaxLines - lineCount;
		output.insertAdjacentHTML('beforeend', lines.slice(0, remaining).join(''));
		state.cmdBlockLineCounts[blockId] = state.cmdMaxLines;
		const body = block.querySelector('.command-block-body');
		if (body && !body.querySelector('.command-block-truncated')) {
			body.insertAdjacentHTML('beforeend',
				'<div class="command-block-truncated">' +
					'<button data-action="show-more-cmd" data-block-id="' + blockId + '">Show all output</button>' +
				'</div>'
			);
		}
	}

	const body = block.querySelector('.command-block-body');
	if (body) {
		body.scrollTop = body.scrollHeight;
	}
	scrollToBottom();
}

export function completeCommandBlock(blockId: string, data: CommandActivityData): void {
	const block = document.getElementById(blockId);
	if (!block) { return; }

	block.className = block.className.replace('status-running', 'status-success');
	const statusEl = block.querySelector('.command-block-status');
	if (statusEl) {
		statusEl.className = 'command-block-status success';
		statusEl.innerHTML = '&#x2705;';
	}

	if (data.summary) {
		appendCommandOutput(blockId, data);
	}
}

export function errorCommandBlock(blockId: string, data: CommandActivityData): void {
	let block = document.getElementById(blockId);
	if (!block) {
		createCommandBlock(blockId, data);
		block = document.getElementById(blockId);
	}
	if (!block) { return; }

	block.className = block.className.replace('status-running', 'status-error');
	if (block.className.indexOf('expanded') === -1) {
		block.className += ' expanded';
	}
	const statusEl = block.querySelector('.command-block-status');
	if (statusEl) {
		statusEl.className = 'command-block-status error';
		statusEl.innerHTML = '&#x274C;';
	}

	const output = block.querySelector('.command-block-output');
	if (output && data.summary) {
		output.insertAdjacentHTML('beforeend',
			'<span class="cmd-line error">' + escapeHtmlClient(data.summary) + '</span>'
		);
	}
	if (output && data.detail) {
		output.insertAdjacentHTML('beforeend',
			'<span class="cmd-line error detail">' + escapeHtmlClient(data.detail) + '</span>'
		);
	}

	const body = block.querySelector('.command-block-body');
	if (body && !body.querySelector('.command-block-actions')) {
		body.insertAdjacentHTML('beforeend',
			'<div class="command-block-actions">' +
				'<button class="command-block-retry-btn" data-action="retry-phase">' +
					'Retry' +
				'</button>' +
			'</div>'
		);
	}
}

export function toggleCommandBlock(blockEl: HTMLElement | null): void {
	if (!blockEl) { return; }
	if (blockEl.className.indexOf('expanded') >= 0) {
		blockEl.className = blockEl.className.replace(' expanded', '');
	} else {
		blockEl.className += ' expanded';
	}
}

export function toggleStdinBlock(stdinEl: HTMLElement | null): void {
	if (!stdinEl) { return; }
	if (stdinEl.className.indexOf('expanded') >= 0) {
		stdinEl.className = stdinEl.className.replace(' expanded', '');
	} else {
		stdinEl.className += ' expanded';
	}
}

export function showMoreCommandOutput(blockId: string): void {
	const block = document.getElementById(blockId);
	if (!block) { return; }
	state.cmdBlockLineCounts[blockId] = 0;
	state.cmdMaxLines = 99999;
	const truncEl = block.querySelector('.command-block-truncated');
	if (truncEl) { truncEl.remove(); }
}

// ===== Tool Call Card Handling =====

export function handleToolCallActivity(data: ToolCallActivityData): void {
	if (!data || !data.commandId) { return; }
	const blockId = 'cmd-' + data.commandId;

	if (data.action === 'tool_call') {
		createToolCard(blockId, data);
	} else if (data.action === 'tool_result') {
		completeToolCard(blockId, data);
	}
}

export function createToolCard(blockId: string, data: ToolCallActivityData): void {
	const block = document.getElementById(blockId);
	if (!block) { return; }
	const output = block.querySelector('.command-block-output');
	if (!output) { return; }

	const cardId = 'tool-' + (data.toolUseId || Date.now());
	const toolName = escapeHtmlClient(data.toolName || 'Tool');
	const time = data.timestamp ? formatTime(data.timestamp) : '';

	const bodyHtml = buildToolCardBody(data.toolName || 'Tool', data.input || '', '', false);

	const html =
		'<div id="' + cardId + '" class="tool-call-card" data-tool-use-id="' + escapeHtmlClient(data.toolUseId || '') + '">' +
			'<div class="tool-call-header">' +
				'<span class="tool-call-dot running"></span>' +
				'<span class="tool-call-name">' + toolName + '</span>' +
				'<span class="tool-call-time">' + time + '</span>' +
			'</div>' +
			bodyHtml +
		'</div>';

	output.insertAdjacentHTML('beforeend', html);
	if (data.toolUseId) {
		state.pendingToolCards[data.toolUseId] = cardId;
	}
	scrollToBottom();
}

export function completeToolCard(blockId: string, data: ToolCallActivityData): void {
	const cardId = data.toolUseId ? state.pendingToolCards[data.toolUseId] : null;
	const card = cardId ? document.getElementById(cardId) : null;

	if (!card) {
		const block = document.getElementById(blockId);
		if (!block) { return; }
		const output = block.querySelector('.command-block-output');
		if (!output) { return; }

		const standaloneId = 'tool-' + (data.toolUseId || Date.now());
		const toolName = escapeHtmlClient(data.toolName || 'Tool');
		const time = data.timestamp ? formatTime(data.timestamp) : '';
		const dotClass = data.status === 'error' ? 'error' : 'success';
		const bodyHtml = buildToolCardBody(data.toolName || 'Tool', data.input || '', data.output || '', true);

		const html =
			'<div id="' + standaloneId + '" class="tool-call-card">' +
				'<div class="tool-call-header">' +
					'<span class="tool-call-dot ' + dotClass + '"></span>' +
					'<span class="tool-call-name">' + toolName + '</span>' +
					'<span class="tool-call-time">' + time + '</span>' +
				'</div>' +
				bodyHtml +
			'</div>';

		output.insertAdjacentHTML('beforeend', html);
		scrollToBottom();
		return;
	}

	// Update existing pending card
	const dot = card.querySelector('.tool-call-dot');
	if (dot) {
		dot.className = 'tool-call-dot ' + (data.status === 'error' ? 'error' : 'success');
	}

	const header = card.querySelector('.tool-call-header');
	const headerHtml = header ? header.outerHTML : '';
	const bodyHtml = buildToolCardBody(data.toolName || 'Tool', data.input || '', data.output || '', true);
	card.innerHTML = headerHtml + bodyHtml;

	if (data.toolUseId) {
		delete state.pendingToolCards[data.toolUseId];
	}
	scrollToBottom();
}

export function buildToolCardBody(toolName: string, input: string, output: string, hasOutput: boolean): string {
	const lowerName = (toolName || '').toLowerCase();
	let html = '';

	if (/bash|shell|command/i.test(lowerName)) {
		if (input) {
			html += '<div class="tool-card-section">' +
				'<span class="tool-card-label">IN</span>' +
				'<div class="tool-card-code">' + escapeHtmlClient(input) + '</div>' +
			'</div>';
		}
		if (hasOutput && output) {
			html += '<div class="tool-card-section">' +
				'<span class="tool-card-label">OUT</span>' +
				'<div class="tool-card-code tool-card-output">' + escapeHtmlClient(output) + '</div>' +
			'</div>';
		}
		return html;
	}

	if (/read/i.test(lowerName)) {
		if (input) {
			html += '<div class="tool-card-inline">' + escapeHtmlClient(input) + '</div>';
		}
		if (hasOutput && output) {
			html += '<div class="tool-card-section">' +
				'<span class="tool-card-label">OUT</span>' +
				'<div class="tool-card-code tool-card-output">' + escapeHtmlClient(output) + '</div>' +
			'</div>';
		}
		return html;
	}

	if (/glob/i.test(lowerName)) {
		if (input) {
			html += '<div class="tool-card-inline">' + escapeHtmlClient(input) + '</div>';
		}
		if (hasOutput && output) {
			html += '<div class="tool-card-results">' + escapeHtmlClient(output) + '</div>';
		}
		return html;
	}

	if (/write|edit|create/i.test(lowerName)) {
		if (input) {
			html += '<div class="tool-card-inline">' + escapeHtmlClient(input) + '</div>';
		}
		return html;
	}

	// Generic fallback
	if (input) {
		html += '<div class="tool-card-section">' +
			'<span class="tool-card-label">IN</span>' +
			'<div class="tool-card-code">' + escapeHtmlClient(input) + '</div>' +
		'</div>';
	}
	if (hasOutput && output) {
		html += '<div class="tool-card-section">' +
			'<span class="tool-card-label">OUT</span>' +
			'<div class="tool-card-code tool-card-output">' + escapeHtmlClient(output) + '</div>' +
		'</div>';
	}
	return html;
}

// ===== Reasoning Review Card Injection =====

/**
 * Inject a reasoning review card into the stream immediately after its
 * associated command block. Called when the host emits 'reasoningReviewReady'.
 */
export function injectReasoningReviewCard(data: {
	commandId: string;
	dialogueId: string;
	review: {
		concerns: Array<{ severity: string; summary: string; detail: string; location?: string; recommendation?: string }>;
		overallAssessment: string;
		reviewerModel: string;
		durationMs?: number;
		reviewPrompt?: string;
		failed?: boolean;
	};
}): void {
	const { commandId, review } = data;
	const blockId = 'cmd-' + commandId;
	const cmdBlock = document.getElementById(blockId);
	const streamArea = document.getElementById('stream-content');
	if (!streamArea) { return; }

	// Don't duplicate if review card already exists
	const reviewId = 'review-' + commandId;
	if (document.getElementById(reviewId)) { return; }

	const concerns = review.concerns ?? [];
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
				'<span class="review-concern-summary">' + escapeHtmlClient(c.summary) + '</span>' +
			'</div>' +
			'<details class="review-concern-details">' +
				'<summary>Details &amp; recommendation</summary>' +
				'<div class="review-concern-detail">' + escapeHtmlClient(c.detail ?? '') + '</div>' +
				(c.location ? '<div class="review-concern-location"><em>Location:</em> ' + escapeHtmlClient(c.location) + '</div>' : '') +
				(c.recommendation ? '<div class="review-concern-recommendation"><strong>Recommendation:</strong> ' + escapeHtmlClient(c.recommendation) + '</div>' : '') +
			'</details>' +
		'</div>';
	}).join('');

	const promptHtml = review.reviewPrompt
		? '<details class="review-prompt-details">' +
			'<summary>&#x1F4DD; Review Prompt</summary>' +
			'<pre class="review-prompt-content">' + escapeHtmlClient(review.reviewPrompt) + '</pre>' +
		  '</details>'
		: '';

	const now = new Date().toLocaleTimeString();
	const html = '<div id="' + reviewId + '" class="reasoning-review-card ' + severityClass + '">' +
		'<div class="review-header">' +
			'<span class="review-icon">&#x1F50D;</span>' +
			'<span class="review-title">Reasoning Review</span>' +
			'<span class="review-meta">' +
				(concerns.length > 0
					? concerns.length + ' concern' + (concerns.length !== 1 ? 's' : '')
					: review.failed ? 'Failed' : 'Clean') +
				' &middot; ' + escapeHtmlClient(review.reviewerModel) +
				' &middot; ' + now + '</span>' +
		'</div>' +
		'<div class="review-assessment">' + escapeHtmlClient(review.overallAssessment) + '</div>' +
		'<div class="review-concerns">' + concernsHtml + '</div>' +
		promptHtml +
		'<div class="review-actions">' +
			'<button class="mmp-btn review-action-btn" data-action="review-acknowledge">Acknowledge</button>' +
			'<button class="mmp-btn review-action-btn" data-action="review-rerun">Re-run with corrections</button>' +
			'<button class="mmp-btn review-action-btn" data-action="review-guidance">Add guidance</button>' +
		'</div>' +
	'</div>';

	// Insert after the associated command block, or at end of stream if not found
	if (cmdBlock) {
		cmdBlock.insertAdjacentHTML('afterend', html);
	} else {
		streamArea.insertAdjacentHTML('beforeend', html);
	}
	scrollToBottom();
}
