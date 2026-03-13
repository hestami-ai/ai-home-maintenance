/**
 * Core message handlers for the Governed Stream webview.
 * These handle the primary incoming messages from the extension host
 * that update the stream display, settings, and processing state.
 */

import { vscode } from './types';
import type {
	FullUpdateData,
	TurnAddedData,
	ClaimUpdatedData,
	GateResolvedData,
	ShowSettingsData,
	KeyStatusUpdateData,
	SetInputEnabledData,
	SetProcessingData,
	SetInputThinkingData,
	QaExchangeAddedData,
	ErrorOccurredData,
	SystemMessageData,
	CommandOptionsData,
	DialogueTitleUpdatedData,
	QaThinkingStartData,
	QaThinkingProgressData,
	QaThinkingCompleteData,
} from './types';
import { state } from './state';
import { escapeHtmlClient, simpleMd, formatTime, getVerdictClass, getVerdictIcon, scrollToBottom } from './utils';

export function handleFullUpdate(data: FullUpdateData): void {
	const streamArea = document.getElementById('stream-content');
	if (streamArea && data.streamHtml) {
		streamArea.innerHTML = data.streamHtml;
		scrollToBottom();
	}
}

export function handleTurnAdded(data: TurnAddedData): void {
	const streamArea = document.getElementById('stream-content');
	if (streamArea && data.html) {
		streamArea.insertAdjacentHTML('beforeend', data.html);
		scrollToBottom();
	}
}

export function handleClaimUpdated(data: ClaimUpdatedData): void {
	const claimElements = document.querySelectorAll('[data-claim-id="' + data.claimId + '"]');
	claimElements.forEach(function (el) {
		const badge = el.querySelector('.verdict-badge');
		if (badge) {
			badge.className = 'verdict-badge ' + getVerdictClass(data.status);
			badge.innerHTML = getVerdictIcon(data.status) + ' ' + data.status;
		}
	});
}

export function handlePhaseChanged(_data: unknown): void {
	vscode.postMessage({ type: 'refresh' });
}

export function handleGateTriggered(_data: unknown): void {
	vscode.postMessage({ type: 'refresh' });
}

export function handleGateResolved(data: GateResolvedData): void {
	const gateCard = document.querySelector('[data-gate-id="' + data.gateId + '"]');
	if (gateCard) {
		(gateCard as HTMLElement).style.opacity = '0.5';
		(gateCard as HTMLElement).style.pointerEvents = 'none';
		const header = gateCard.querySelector('.gate-header');
		if (header) {
			header.innerHTML = '&#x2705; Gate Resolved: ' + (data.action || 'Decision made');
		}
		gateCard.querySelectorAll('.gate-btn').forEach(function (btn) {
			(btn as HTMLButtonElement).disabled = true;
		});
	}
}

export function handleIntakePlanUpdated(_data: unknown): void {
	vscode.postMessage({ type: 'refresh' });
}

export function handleDialogueTitleUpdated(data: DialogueTitleUpdatedData): void {
	if (!data || !data.dialogueId || !data.title) { return; }
	// Update the switcher trigger label if this is the active dialogue
	const trigger = document.querySelector('.switcher-trigger');
	if (trigger) {
		const title = data.title.length > 30 ? data.title.substring(0, 30) : data.title;
		trigger.innerHTML = escapeHtmlClient(title) + ' &#x25BE;';
	}
	// Update the switcher item for this dialogue
	const switcherItem = document.querySelector('.switcher-item[data-dialogue-id="' + data.dialogueId + '"] .switcher-title');
	if (switcherItem) {
		const itemTitle = data.title.length > 40 ? data.title.substring(0, 40) : data.title;
		switcherItem.textContent = itemTitle;
	}
	// Update the dialogue start marker title
	const markerTitle = document.querySelector('#dialogue-' + data.dialogueId + ' .dialogue-marker-title');
	if (markerTitle) {
		markerTitle.textContent = data.title.length > 60 ? data.title.substring(0, 60) : data.title;
	}
}

export function handleSystemMessage(data: SystemMessageData): void {
	const streamArea = document.getElementById('stream-content');
	if (streamArea && data.message) {
		const html = '<div class="system-message">' +
			'<span class="system-message-icon">&#x2139;&#xFE0E;</span>' +
			'<div class="system-message-body">' + simpleMd(data.message) + '</div>' +
			'</div>';
		streamArea.insertAdjacentHTML('beforeend', html);
		scrollToBottom();
	}
}

export function handleCommandOptions(data: CommandOptionsData): void {
	const streamArea = document.getElementById('stream-content');
	if (streamArea && data.options) {
		let html = '<div class="command-options-card">' +
			'<div class="command-options-prompt">' + escapeHtmlClient(data.prompt) + '</div>' +
			'<div class="command-options-chips">';

		for (let i = 0; i < data.options.length; i++) {
			const opt = data.options[i];
			html += '<button class="command-option-chip" ' +
				'data-action="execute-command-option" ' +
				'data-option-kind="' + escapeHtmlClient(opt.kind) + '" ' +
				(opt.gateId ? 'data-gate-id="' + escapeHtmlClient(opt.gateId) + '" ' : '') +
				'title="' + escapeHtmlClient(opt.description) + '">' +
				escapeHtmlClient(opt.label) +
				'</button>';
		}

		html += '</div></div>';
		streamArea.insertAdjacentHTML('beforeend', html);
		scrollToBottom();
	}
}

export function handleShowSettings(data: ShowSettingsData): void {
	state.settingsPanelVisible = data.visible;
	const panel = document.getElementById('settings-panel');
	const streamArea = document.querySelector('.stream-area') as HTMLElement | null;
	const inputArea = document.querySelector('.input-area') as HTMLElement | null;

	if (panel) {
		panel.style.display = data.visible ? 'block' : 'none';
	}
	if (streamArea) {
		streamArea.style.display = data.visible ? 'none' : '';
	}
	if (inputArea) {
		inputArea.style.display = data.visible ? 'none' : '';
	}
}

export function handleKeyStatusUpdate(data: KeyStatusUpdateData): void {
	const container = document.getElementById('settings-roles');
	if (!container || !data.roles) { return; }

	container.innerHTML = data.roles.map(function (role) {
		const statusClass = role.hasKey ? 'set' : 'not-set';
		const statusIcon = role.hasKey ? '&#x2713;' : '&#x2717;';
		const statusText = role.hasKey ? 'Set' : 'Not Set';
		const clearDisabled = role.hasKey ? '' : 'disabled';
		const btnLabel = role.hasKey ? 'Update' : 'Set Key';

		return '<div class="settings-role-row">' +
			'<div class="settings-role-info">' +
				'<div class="settings-role-name">' + escapeHtmlClient(role.displayName) + '</div>' +
				'<div class="settings-role-provider">Provider: ' + escapeHtmlClient(role.provider) + '</div>' +
			'</div>' +
			'<div class="settings-role-status ' + statusClass + '">' +
				statusIcon + ' ' + statusText +
			'</div>' +
			'<div class="settings-role-actions">' +
				'<button class="settings-btn set-key" data-action="set-key" data-role="' + escapeHtmlClient(role.role) + '">' +
					btnLabel +
				'</button>' +
				'<button class="settings-btn clear-key" ' + clearDisabled +
					' data-action="clear-key" data-role="' + escapeHtmlClient(role.role) + '">Clear</button>' +
			'</div>' +
		'</div>';
	}).join('');
}

export function handleSetInputEnabled(data: SetInputEnabledData): void {
	const composer = document.getElementById('user-input') as HTMLElement | null;
	const btn = document.getElementById('submit-btn') as HTMLButtonElement | null;
	const wrapper = document.querySelector('.composer-wrapper') as HTMLElement | null;
	if (composer) {
		composer.contentEditable = data.enabled ? 'true' : 'false';
		composer.style.opacity = data.enabled ? '' : '0.4';
		composer.style.pointerEvents = data.enabled ? '' : 'none';
	}
	if (wrapper) {
		wrapper.style.opacity = data.enabled ? '' : '0.4';
	}
	if (btn) { btn.disabled = !data.enabled; }
}

export function handleSetProcessing(data: SetProcessingData): void {
	const existing = document.getElementById('processing-indicator');
	if (!data.active) {
		if (existing) { existing.remove(); }
		return;
	}
	const phase = escapeHtmlClient(data.phase || 'Processing');
	const detail = data.detail ? escapeHtmlClient(data.detail) : '';
	const html = '<div id="processing-indicator" class="processing-indicator">' +
		'<div class="processing-spinner"></div>' +
		'<div class="processing-label">' +
			'<div class="processing-phase">' + phase + '<span class="processing-dots"></span></div>' +
			(detail ? '<div class="processing-detail">' + detail + '</div>' : '') +
		'</div>' +
		'<button class="cancel-btn" data-action="cancel-workflow" title="Cancel execution">Cancel</button>' +
	'</div>';
	if (existing) {
		existing.outerHTML = html;
	} else {
		const streamArea = document.getElementById('stream-content');
		if (streamArea) {
			streamArea.insertAdjacentHTML('beforeend', html);
			scrollToBottom();
		}
	}
}

export interface PermissionRequestedData {
	permissionId: string;
	tool: string;
	input: Record<string, unknown>;
}

export function handlePermissionRequested(data: PermissionRequestedData): void {
	const streamArea = document.getElementById('stream-content');
	if (!streamArea || !data.permissionId) { return; }

	const escapedId = escapeHtmlClient(data.permissionId);
	const escapedTool = escapeHtmlClient(data.tool || 'Unknown');

	// Build human-readable input summary
	let inputSummary = '';
	if (data.input) {
		const cmd = data.input.command;
		const fp = data.input.file_path || data.input.path;
		if (typeof cmd === 'string') {
			inputSummary = 'Command: ' + escapeHtmlClient(cmd.substring(0, 200));
		} else if (typeof fp === 'string') {
			inputSummary = 'File: ' + escapeHtmlClient(fp);
		} else {
			const keys = Object.keys(data.input).filter(function (k) { return k !== '_permissionId'; });
			if (keys.length > 0) {
				inputSummary = keys.map(function (k) {
					const v = data.input[k];
					return escapeHtmlClient(k) + ': ' + escapeHtmlClient(typeof v === 'string' ? v.substring(0, 100) : JSON.stringify(v).substring(0, 100));
				}).join(', ');
			}
		}
	}

	const html = '<div class="permission-card" data-permission-id="' + escapedId + '">' +
		'<div class="permission-header">' +
			'<span class="permission-icon">&#x1F512;</span>' +
			'<span>Tool Permission Requested</span>' +
		'</div>' +
		'<div class="permission-body">' +
			'<div class="permission-tool-name">' + escapedTool + '</div>' +
			(inputSummary ? '<div class="permission-input">' + inputSummary + '</div>' : '') +
		'</div>' +
		'<div class="permission-actions">' +
			'<button class="permission-btn permission-approve" ' +
				'data-action="permission-approve" ' +
				'data-permission-id="' + escapedId + '">Approve</button>' +
			'<button class="permission-btn permission-approve-all" ' +
				'data-action="permission-approve-all" ' +
				'data-permission-id="' + escapedId + '">Approve All (' + escapedTool + ')</button>' +
			'<button class="permission-btn permission-deny" ' +
				'data-action="permission-deny" ' +
				'data-permission-id="' + escapedId + '">Deny</button>' +
		'</div>' +
	'</div>';

	streamArea.insertAdjacentHTML('beforeend', html);
	scrollToBottom();
}

export function handleErrorOccurred(data: ErrorOccurredData): void {
	const streamArea = document.getElementById('stream-content');
	if (streamArea) {
		const html = '<div class="warning-card">' +
			'<div class="warning-header">' +
				'<span>&#x26A0;&#xFE0F;</span> Error: ' + escapeHtmlClient(data.code || 'UNKNOWN') +
			'</div>' +
			'<div class="card-content">' + escapeHtmlClient(data.message || 'An error occurred') + '</div>' +
		'</div>';
		streamArea.insertAdjacentHTML('beforeend', html);
		scrollToBottom();
	}
}

// ===== Settings Panel =====

export function toggleSettingsPanel(): void {
	state.settingsPanelVisible = !state.settingsPanelVisible;
	handleShowSettings({ visible: state.settingsPanelVisible });
	vscode.postMessage({ type: 'settingsVisibilityChanged', visible: state.settingsPanelVisible });
}

export function requestSetKey(role: string): void {
	vscode.postMessage({ type: 'setApiKey', role: role });
}

export function requestClearKey(role: string): void {
	vscode.postMessage({ type: 'clearApiKey', role: role });
}

// ===== Input Thinking State =====

export function handleSetInputThinking(data: SetInputThinkingData): void {
	const btn = document.getElementById('submit-btn') as HTMLButtonElement | null;
	const composer = document.getElementById('user-input');

	if (!btn) { return; }

	if (data.active) {
		btn.classList.add('thinking');
		btn.title = 'Stop (Esc)';
		btn.disabled = false;
		if (composer) {
			composer.contentEditable = 'false';
			composer.style.opacity = '0.6';
		}
	} else {
		btn.classList.remove('thinking');
		btn.title = 'Send (Enter)';
		if (composer) {
			composer.contentEditable = 'true';
			composer.style.opacity = '';
		}
	}
}

// ===== Q&A Exchange =====

export function handleQaExchangeAdded(data: QaExchangeAddedData): void {
	const streamArea = document.getElementById('stream-content');
	if (!streamArea || !data.question) { return; }

	const ts = data.timestamp ? formatTime(data.timestamp) : '';
	const html = '<div class="qa-exchange-card">' +
		'<div class="qa-exchange-question">' +
			'<span class="qa-exchange-icon">&#x2753;</span>' +
			'<div class="qa-exchange-question-text">' + escapeHtmlClient(data.question) + '</div>' +
			(ts ? '<span class="qa-exchange-time">' + ts + '</span>' : '') +
		'</div>' +
		'<div class="qa-exchange-answer">' +
			'<span class="qa-exchange-icon">&#x2139;&#xFE0E;</span>' +
			'<div class="qa-exchange-answer-body">' + simpleMd(data.answer) + '</div>' +
		'</div>' +
	'</div>';
	streamArea.insertAdjacentHTML('beforeend', html);
	scrollToBottom();
}

// ===== Q&A Thinking (Streaming Progress) =====

/**
 * Create a Q&A card with the question header and a spinner in the body.
 * The body area will show streaming status lines during processing.
 */
export function handleQaThinkingStart(data: QaThinkingStartData): void {
	const streamArea = document.getElementById('stream-content');
	if (!streamArea || !data.question) { return; }

	// Remove any previous thinking card (defensive)
	const existing = document.getElementById('qa-thinking-card');
	if (existing) { existing.remove(); }

	const ts = data.timestamp ? formatTime(data.timestamp) : '';
	const html = '<div id="qa-thinking-card" class="qa-exchange-card qa-thinking">' +
		'<div class="qa-exchange-question">' +
			'<span class="qa-exchange-icon">&#x2753;</span>' +
			'<div class="qa-exchange-question-text">' + escapeHtmlClient(data.question) + '</div>' +
			(ts ? '<span class="qa-exchange-time">' + ts + '</span>' : '') +
		'</div>' +
		'<div class="qa-exchange-answer">' +
			'<span class="qa-exchange-icon">' +
				'<span class="qa-thinking-spinner"></span>' +
			'</span>' +
			'<div class="qa-exchange-answer-body qa-thinking-body">' +
			'</div>' +
		'</div>' +
	'</div>';
	streamArea.insertAdjacentHTML('beforeend', html);
	scrollToBottom();
}

/**
 * Append a status line to the thinking Q&A card body.
 */
export function handleQaThinkingProgress(data: QaThinkingProgressData): void {
	const thinkingBody = document.querySelector('#qa-thinking-card .qa-thinking-body');
	if (!thinkingBody || !data.step) { return; }

	const lineHtml = '<div class="qa-thinking-step">' +
		'<span class="qa-thinking-step-dot"></span>' +
		escapeHtmlClient(data.step) +
	'</div>';
	thinkingBody.insertAdjacentHTML('beforeend', lineHtml);
	scrollToBottom();
}

/**
 * Replace the thinking body with the final formatted answer.
 * Removes the spinner, the qa-thinking class, and the temporary ID.
 */
export function handleQaThinkingComplete(data: QaThinkingCompleteData): void {
	const card = document.getElementById('qa-thinking-card');
	if (!card) {
		// Fallback: if card disappeared (e.g., fullUpdate during thinking),
		// render as a normal complete Q&A card
		if (data.answer) {
			handleQaExchangeAdded({
				question: '',
				answer: data.answer,
				timestamp: data.timestamp,
			});
		}
		return;
	}

	// Remove thinking class and ID
	card.removeAttribute('id');
	card.classList.remove('qa-thinking');

	// Replace spinner icon with info icon
	const answerSection = card.querySelector('.qa-exchange-answer');
	if (answerSection) {
		const iconSpan = answerSection.querySelector('.qa-exchange-icon');
		if (iconSpan) {
			iconSpan.innerHTML = '&#x2139;&#xFE0E;';
		}
	}

	// Replace body content with formatted answer
	const body = card.querySelector('.qa-thinking-body');
	if (body) {
		body.className = 'qa-exchange-answer-body';
		body.innerHTML = simpleMd(data.answer);
	}

	// Update timestamp if provided
	if (data.timestamp) {
		const timeSpan = card.querySelector('.qa-exchange-time');
		if (timeSpan) {
			timeSpan.textContent = formatTime(data.timestamp);
		}
	}

	scrollToBottom();
}
