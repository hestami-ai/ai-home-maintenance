/**
 * Clarification thread handlers for the Governed Stream webview.
 * Manages the "Ask More" mode where users can ask follow-up questions
 * about verification claims and review items.
 */

import { vscode } from './types';
import type { ClarificationThread } from './types';
import { state } from './state';
import { escapeHtmlClient, simpleMd } from './utils';

export function handleToggleAskMore(itemId: string): void {
	const responseArea = document.querySelector('[data-clarification-item="' + itemId + '"]');
	if (!responseArea) { return; }
	const textarea = responseArea.querySelector('textarea') as HTMLTextAreaElement | null;
	if (!textarea) { return; }
	const toolbar = responseArea.querySelector('.response-toolbar');
	if (!toolbar) { return; }
	const toggleBtn = toolbar.querySelector('.ask-more-toggle') as HTMLButtonElement | null;
	const messagesEl = document.getElementById('clarification-messages-' + itemId);

	const currentMode = state.clarificationMode[itemId] || 'respond';
	if (currentMode === 'respond') {
		// Switch to Ask More mode
		state.clarificationMode[itemId] = 'askmore';
		state.savedResponseText[itemId] = textarea.value;
		textarea.value = '';
		textarea.placeholder = 'Ask a follow-up question...';
		responseArea.classList.add('askmore-mode');
		if (toggleBtn) {
			toggleBtn.textContent = 'Back to Response';
			toggleBtn.classList.add('active');
		}

		// Replace charcount with Send button
		const charcount = toolbar.querySelector('[class*="charcount"]') as HTMLElement | null;
		if (charcount) { charcount.style.display = 'none'; }
		let sendBtn = toolbar.querySelector('.clarification-send-btn') as HTMLButtonElement | null;
		if (!sendBtn) {
			sendBtn = document.createElement('button');
			sendBtn.className = 'clarification-send-btn';
			sendBtn.setAttribute('data-action', 'clarification-send');
			sendBtn.setAttribute('data-clarification-item', itemId);
			sendBtn.textContent = 'Send';
			toolbar.insertBefore(sendBtn, toggleBtn);
		} else {
			sendBtn.style.display = '';
		}

		// Show conversation messages if any exist
		if (messagesEl && messagesEl.children.length > 0) {
			messagesEl.style.display = 'block';
		}

		// Initialize conversation array if needed
		if (!state.clarificationConversations[itemId]) {
			state.clarificationConversations[itemId] = [];
		}

		textarea.focus();
	} else {
		// Switch back to Respond mode
		state.clarificationMode[itemId] = 'respond';
		textarea.value = state.savedResponseText[itemId] || '';
		textarea.placeholder = textarea.getAttribute('data-original-placeholder') || 'Type your response...';
		responseArea.classList.remove('askmore-mode');
		if (toggleBtn) {
			toggleBtn.textContent = 'Ask More';
			toggleBtn.classList.remove('active');
		}

		// Restore charcount, hide Send button
		const charcount2 = toolbar.querySelector('[class*="charcount"]') as HTMLElement | null;
		if (charcount2) { charcount2.style.display = ''; }
		const sendBtn2 = toolbar.querySelector('.clarification-send-btn') as HTMLElement | null;
		if (sendBtn2) { sendBtn2.style.display = 'none'; }

		// Hide conversation messages
		if (messagesEl) { messagesEl.style.display = 'none'; }

		// Trigger charcount update for the restored text
		textarea.dispatchEvent(new Event('input', { bubbles: true }));
	}
}

export function handleClarificationSend(itemId: string): void {
	const responseArea = document.querySelector('[data-clarification-item="' + itemId + '"]');
	if (!responseArea) { return; }
	const textarea = responseArea.querySelector('textarea') as HTMLTextAreaElement | null;
	if (!textarea) { return; }
	const text = textarea.value.trim();
	if (!text || state.clarificationPending[itemId]) { return; }

	const history = state.clarificationConversations[itemId] || [];
	history.push({ role: 'user', content: text });
	state.clarificationConversations[itemId] = history;
	appendClarificationMessage(itemId, 'human', text);
	textarea.value = '';

	state.clarificationPending[itemId] = true;
	appendClarificationMessage(itemId, 'loading', '');

	// Show messages container
	const messagesEl = document.getElementById('clarification-messages-' + itemId);
	if (messagesEl) { messagesEl.style.display = 'block'; }

	const toggleBtn = document.querySelector('.ask-more-toggle[data-clarification-item="' + itemId + '"]') as HTMLElement | null;
	const context = toggleBtn ? toggleBtn.dataset.clarificationContext || '' : '';

	vscode.postMessage({
		type: 'clarificationMessage',
		itemId: itemId,
		itemContext: context,
		history: history,
	});
}

export function handleClarificationResponse(itemId: string, response: string | undefined, error: string | undefined, elapsedMs?: number, model?: string): void {
	state.clarificationPending[itemId] = false;
	const loading = document.getElementById('clarification-loading-' + itemId);
	if (loading && loading.parentNode) { loading.parentNode.removeChild(loading); }

	if (error) {
		appendClarificationMessage(itemId, 'error', error);
	} else if (response) {
		if (!state.clarificationConversations[itemId]) {
			state.clarificationConversations[itemId] = [];
		}
		state.clarificationConversations[itemId].push({ role: 'assistant', content: response });
		appendClarificationMessage(itemId, 'assistant', response, elapsedMs, model);
	}
}

export function appendClarificationMessage(itemId: string, role: string, content: string, elapsedMs?: number, model?: string): void {
	const container = document.getElementById('clarification-messages-' + itemId);
	if (!container) { return; }
	const div = document.createElement('div');
	div.className = 'clarification-msg clarification-msg-' + role;
	if (role === 'loading') {
		div.id = 'clarification-loading-' + itemId;
		div.innerHTML = '<span class="clarification-loading-dots">Thinking...</span>';
	} else if (role === 'assistant') {
		let meta = '';
		if (elapsedMs) {
			const secs = (elapsedMs / 1000).toFixed(1);
			meta = '<div class="clarification-meta">' + secs + 's' +
				(model ? ' \u00B7 ' + escapeHtmlClient(model) : '') + '</div>';
		}
		div.innerHTML = simpleMd(content) + meta;
	} else {
		div.textContent = content;
	}
	container.appendChild(div);
	container.scrollTop = container.scrollHeight;
}

export function restoreClarificationThreads(threads: ClarificationThread[]): void {
	if (!threads || !Array.isArray(threads)) { return; }
	for (let i = 0; i < threads.length; i++) {
		const thread = threads[i];
		state.clarificationConversations[thread.itemId] = thread.messages.map(function (m) {
			return { role: m.role, content: m.content };
		});
		// Render the messages into the DOM
		const container = document.getElementById('clarification-messages-' + thread.itemId);
		if (container && thread.messages.length > 0) {
			for (let j = 0; j < thread.messages.length; j++) {
				const msg = thread.messages[j];
				const cssRole = msg.role === 'user' ? 'human' : msg.role;
				appendClarificationMessage(thread.itemId, cssRole, msg.content);
			}
		}
	}
}
