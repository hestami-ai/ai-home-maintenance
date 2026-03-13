/**
 * Entry point for the Governed Stream webview client.
 * Sets up message routing, event delegation, and direct element listeners.
 *
 * Compiled by esbuild to dist/webview/governedStream.js as an IIFE bundle
 * and loaded via <script src="..."> in the webview HTML.
 */

import { vscode } from './types';
import type { IncomingMessage } from './types';
import { state } from './state';
import { scrollToBottom, scrollToClaimsByStatus, copySessionId } from './utils';
import {
	handleFullUpdate,
	handleTurnAdded,
	handleClaimUpdated,
	handlePhaseChanged,
	handleGateTriggered,
	handleGateResolved,
	handleIntakePlanUpdated,
	handleDialogueTitleUpdated,
	handleSystemMessage,
	handleCommandOptions,
	handleShowSettings,
	handleKeyStatusUpdate,
	handleSetInputEnabled,
	handleSetProcessing,
	handleSetInputThinking,
	handleQaExchangeAdded,
	handleQaThinkingStart,
	handleQaThinkingProgress,
	handleQaThinkingComplete,
	handleErrorOccurred,
	handlePermissionRequested,
	toggleSettingsPanel,
	requestSetKey,
	requestClearKey,
} from './messageHandlers';
import { submitGateDecision, handleVerificationGateDecision, handleReviewGateDecision } from './gates';
import { handleIntakeSubmitResponses, disableIntakeApprovalButtons, handleIntakeModeSelection, handleIntakeAskDomain } from './intake';
import { handleToggleAskMore, handleClarificationSend, handleClarificationResponse, restoreClarificationThreads } from './clarification';
import {
	submitInput,
	addAttachment,
	removeAttachment,
	updateComposerEmpty,
	hideMentionDropdown,
	insertMention,
	filterAndShowMentions,
	getMentionQueryAtCursor,
	debouncedMentionQuery,
	mentionNavigate,
	mentionConfirmSelection,
} from './composer';
import { handleCommandActivity, handleToolCallActivity, toggleCommandBlock, toggleStdinBlock, showMoreCommandOutput } from './commandBlocks';
import { handleRationaleInput, handleClaimRationaleInput, handleReviewItemRationaleInput, handleReviewOverallInput } from './gates';
import { handleIntakeQuestionInput } from './intake';
import {
	handleSpeechToggle,
	handleSpeechRecordingStarted,
	handleSpeechTranscribing,
	handleSpeechResult,
	handleSpeechError,
	handleSpeechCapability,
} from './speech';

// ===== MESSAGE HANDLING =====

window.addEventListener('message', function (event: MessageEvent) {
	const msg = event.data as IncomingMessage;
	switch (msg.type) {
		case 'fullUpdate':
			handleFullUpdate(msg.data);
			break;
		case 'turnAdded':
			handleTurnAdded(msg.data);
			break;
		case 'claimUpdated':
			handleClaimUpdated(msg.data);
			break;
		case 'phaseChanged':
			handlePhaseChanged(msg.data);
			break;
		case 'gateTriggered':
			handleGateTriggered(msg.data);
			break;
		case 'gateResolved':
			handleGateResolved(msg.data);
			break;
		case 'showSettings':
			handleShowSettings(msg.data);
			break;
		case 'keyStatusUpdate':
			handleKeyStatusUpdate(msg.data);
			break;
		case 'setInputEnabled':
			handleSetInputEnabled(msg.data);
			break;
		case 'setProcessing':
			handleSetProcessing(msg.data);
			break;
		case 'setInputThinking':
			handleSetInputThinking(msg.data);
			break;
		case 'qaExchangeAdded':
			handleQaExchangeAdded(msg.data);
			break;
		case 'qaThinkingStart':
			handleQaThinkingStart(msg.data);
			break;
		case 'qaThinkingProgress':
			handleQaThinkingProgress(msg.data);
			break;
		case 'qaThinkingComplete':
			handleQaThinkingComplete(msg.data);
			break;
		case 'errorOccurred':
			handleErrorOccurred(msg.data);
			break;
		case 'commandActivity':
			handleCommandActivity(msg.data);
			break;
		case 'toolCallActivity':
			handleToolCallActivity(msg.data);
			break;
		case 'intakePlanUpdated':
			handleIntakePlanUpdated(msg.data);
			break;
		case 'dialogueTitleUpdated':
			handleDialogueTitleUpdated(msg.data);
			break;
		case 'systemMessage':
			handleSystemMessage(msg.data);
			break;
		case 'commandOptions':
			handleCommandOptions(msg.data);
			break;
		case 'clarificationResponse':
			handleClarificationResponse(msg.itemId, msg.response, msg.error, msg.elapsedMs, msg.model);
			break;
		case 'clarificationThreadsLoaded':
			restoreClarificationThreads(msg.threads);
			break;
		case 'mentionSuggestions':
			state.cachedFileList = msg.files || [];
			if (state.mentionActive && state.mentionAtIndex >= 0) {
				filterAndShowMentions(getMentionQueryAtCursor());
			}
			break;
		case 'permissionRequested':
			handlePermissionRequested(msg.data);
			break;
		case 'fileAttached':
			addAttachment(msg.filePath);
			break;
		case 'speechRecordingStarted':
			handleSpeechRecordingStarted(msg.data.targetInputId);
			break;
		case 'speechTranscribing':
			handleSpeechTranscribing(msg.data.targetInputId);
			break;
		case 'speechResult':
			handleSpeechResult(msg.data.targetInputId, msg.data.text);
			break;
		case 'speechError':
			handleSpeechError(msg.data.targetInputId, msg.data.error);
			break;
		case 'speechCapability':
			handleSpeechCapability(msg.data.enabled, msg.data.soxAvailable);
			break;
	}
});

// ===== EVENT DELEGATION =====

// Click delegation — handles all data-action clicks
document.addEventListener('click', function (event: MouseEvent) {
	let target = event.target as HTMLElement | null;
	// Walk up to find the nearest element with data-action
	while (target && target !== document.documentElement && !(target.dataset && target.dataset.action)) {
		target = target.parentElement;
	}
	if (!target || !target.dataset || !target.dataset.action) { return; }

	const action = target.dataset.action;
	switch (action) {
		case 'copy-session':
			copySessionId(target.dataset.sessionId || '');
			break;
		case 'scroll-to-status':
			scrollToClaimsByStatus(target.dataset.status || '');
			break;
		case 'gate-decision':
			submitGateDecision(target.dataset.gateId || '', target.dataset.gateAction || '');
			break;
		case 'verification-gate-decision':
			handleVerificationGateDecision(target.dataset.gateId || '', target.dataset.gateAction || '');
			break;
		case 'review-gate-decision':
			handleReviewGateDecision(target.dataset.gateId || '', target.dataset.gateAction || '');
			break;
		case 'toggle-review-group': {
			const reviewGroup = target.closest('.review-group');
			if (reviewGroup) { reviewGroup.classList.toggle('collapsed'); }
			break;
		}
		case 'toggle-verification-nonblocking': {
			const nbContainer = target.closest('.verification-nonblocking');
			if (nbContainer) { nbContainer.classList.toggle('expanded'); }
			break;
		}
		case 'toggle-settings':
			toggleSettingsPanel();
			break;
		case 'set-key':
			requestSetKey(target.dataset.role || '');
			break;
		case 'clear-key':
			requestClearKey(target.dataset.role || '');
			break;
		case 'remove-attachment':
			if (target.dataset.file) {
				removeAttachment(target.dataset.file);
			}
			break;
		case 'toggle-card': {
			const collapsibleCard = target.closest('.collapsible-card');
			if (collapsibleCard) { collapsibleCard.classList.toggle('expanded'); }
			break;
		}
		case 'toggle-coverage-evidence': {
			const row = target.closest('.coverage-domain-row') as HTMLElement | null;
			if (row && row.classList.contains('has-evidence')) {
				row.classList.toggle('expanded');
				const details = row.nextElementSibling as HTMLElement | null;
				if (details && details.classList.contains('coverage-evidence-details')) {
					details.classList.toggle('expanded');
				}
			}
			break;
		}
		case 'toggle-command': {
			const cmdBlock = target.closest('.command-block') as HTMLElement | null;
			toggleCommandBlock(cmdBlock);
			break;
		}
		case 'toggle-stdin': {
			const stdinBlock = target.closest('.cmd-stdin-block') as HTMLElement | null;
			toggleStdinBlock(stdinBlock);
			break;
		}
		case 'show-more-cmd':
			if (target.dataset.blockId) {
				showMoreCommandOutput(target.dataset.blockId);
			}
			break;
		case 'intake-submit-responses':
			handleIntakeSubmitResponses();
			break;
		case 'intake-select-mode':
			handleIntakeModeSelection(target);
			break;
		case 'intake-ask-domain':
			handleIntakeAskDomain(target);
			break;
		case 'intake-checkpoint-continue':
			// Just collapse the checkpoint card — user continues naturally
			{
				const cpCard = target.closest('.intake-checkpoint');
				if (cpCard) {
					cpCard.classList.remove('expanded');
					cpCard.classList.add('resolved');
				}
			}
			break;
		case 'intake-switch-to-walkthrough':
		case 'intake-switch-to-conversational':
			// Switch mode from DOMAIN_GUIDED to fill coverage gaps
			{
				const mode = target.dataset.intakeMode;
				if (mode) {
					handleIntakeModeSelection(target);
					const card = target.closest('.intake-checkpoint');
					if (card) {
						card.classList.remove('expanded');
						card.classList.add('resolved');
					}
				}
			}
			break;
		case 'intake-skip-gathering':
			vscode.postMessage({ type: 'intakeSkipGathering' });
			(target as HTMLButtonElement).disabled = true;
			target.textContent = 'Skipping...';
			break;
		case 'intake-finalize-plan':
			vscode.postMessage({ type: 'intakeFinalizePlan' });
			break;
		case 'intake-approve-plan':
			disableIntakeApprovalButtons(target);
			vscode.postMessage({ type: 'intakeApprovePlan' });
			break;
		case 'intake-continue-discussing':
			disableIntakeApprovalButtons(target);
			vscode.postMessage({ type: 'intakeContinueDiscussing' });
			break;
		case 'toggle-intake-plan': {
			const planCard = target.closest('.intake-plan-preview');
			if (planCard) {
				planCard.classList.toggle('expanded');
				const chevron = planCard.querySelector('.intake-plan-chevron');
				if (chevron) {
					chevron.innerHTML = planCard.classList.contains('expanded') ? '&#x25BC;' : '&#x25B6;';
				}
			}
			break;
		}
		case 'retry-phase':
			vscode.postMessage({ type: 'retryPhase' });
			(target as HTMLButtonElement).disabled = true;
			target.textContent = 'Retrying...';
			break;
		case 'clear-database':
			vscode.postMessage({ type: 'clearDatabase' });
			break;
		case 'export-stream':
			vscode.postMessage({ type: 'exportStream' });
			break;
		case 'resume-dialogue':
			if (target.dataset.dialogueId) {
				vscode.postMessage({ type: 'resumeDialogue', dialogueId: target.dataset.dialogueId });
			}
			break;
		case 'switch-dialogue':
			if (target.dataset.dialogueId) {
				vscode.postMessage({ type: 'switchDialogue', dialogueId: target.dataset.dialogueId });
				const switcherDd = document.getElementById('switcher-dropdown');
				if (switcherDd) { switcherDd.classList.remove('visible'); }
			}
			break;
		case 'scroll-to-dialogue':
			if (target.dataset.dialogueId) {
				const dialogueEl = document.getElementById('dialogue-' + target.dataset.dialogueId);
				if (dialogueEl) {
					dialogueEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
					dialogueEl.classList.add('scroll-highlight');
					setTimeout(function () { dialogueEl.classList.remove('scroll-highlight'); }, 2000);
				}
			}
			break;
		case 'toggle-switcher': {
			const dd = document.getElementById('switcher-dropdown');
			if (dd) { dd.classList.toggle('visible'); }
			break;
		}
		case 'toggle-askmore':
			if (target.dataset.clarificationItem) {
				handleToggleAskMore(target.dataset.clarificationItem);
			}
			break;
		case 'clarification-send':
			if (target.dataset.clarificationItem) {
				handleClarificationSend(target.dataset.clarificationItem);
			}
			break;
		case 'execute-command-option':
			vscode.postMessage({
				type: 'executeRetryAction',
				kind: target.dataset.optionKind || '',
				gateId: target.dataset.gateId || null,
			});
			// Disable all chips in the group and highlight the selected one
			{
				const chipsCard = target.closest('.command-options-card');
				if (chipsCard) {
					chipsCard.querySelectorAll('.command-option-chip').forEach(function (btn) {
						(btn as HTMLButtonElement).disabled = true;
					});
					target.classList.add('was-selected');
				}
			}
			break;
		case 'toggle-speech':
			if (target.dataset.speechTarget) {
				handleSpeechToggle(target.dataset.speechTarget);
			}
			break;
		case 'cancel-workflow':
			vscode.postMessage({ type: 'cancelWorkflow' });
			break;
		case 'permission-approve':
		case 'permission-approve-all':
		case 'permission-deny': {
			const permId = target.dataset.permissionId;
			if (permId) {
				const approved = action !== 'permission-deny';
				const approveAll = action === 'permission-approve-all';
				vscode.postMessage({
					type: 'permissionDecision',
					permissionId: permId,
					approved: approved,
					approveAll: approveAll,
				});
				// Disable all buttons in this card and show result
				const card = target.closest('.permission-card');
				if (card) {
					card.querySelectorAll('.permission-btn').forEach(function (btn) {
						(btn as HTMLButtonElement).disabled = true;
					});
					card.classList.add(approved ? 'permission-approved' : 'permission-denied');
					const header = card.querySelector('.permission-header');
					if (header) {
						let label = '&#x274C; Permission Denied';
						if (approved) {
							label = approveAll ? '&#x2705; Permission Granted (All)' : '&#x2705; Permission Granted';
						}
						header.innerHTML = label;
					}
				}
			}
			break;
		}
	}
});

// Click-outside handler to dismiss switcher dropdown
document.addEventListener('click', function (event: MouseEvent) {
	const switcher = document.querySelector('.dialogue-switcher');
	const dd = document.getElementById('switcher-dropdown');
	if (dd && dd.classList.contains('visible') && switcher && !switcher.contains(event.target as Node)) {
		dd.classList.remove('visible');
	}
}, true);

// Attach file button — asks extension host to show file picker
const attachBtn = document.getElementById('attach-file-btn');
if (attachBtn) {
	attachBtn.addEventListener('click', function () {
		vscode.postMessage({ type: 'pickFile' });
	});
}

// Input delegation — handles gate rationale textareas and composer @-mention
document.addEventListener('input', function (event: Event) {
	const target = event.target as HTMLElement;
	if (target.dataset && target.dataset.gateRationale) {
		handleRationaleInput(target.dataset.gateRationale, (target as HTMLTextAreaElement).value);
	}
	if (target.dataset && target.dataset.claimRationale) {
		handleClaimRationaleInput(target.dataset.claimRationale, (target as HTMLTextAreaElement).value);
	}
	if (target.dataset && target.dataset.reviewItemRationale) {
		handleReviewItemRationaleInput(target.dataset.reviewItemRationale, (target as HTMLTextAreaElement).value);
	}
	if (target.dataset && target.dataset.reviewOverallRationale) {
		handleReviewOverallInput(target.dataset.reviewOverallRationale, (target as HTMLTextAreaElement).value);
	}
	if (target.dataset && target.dataset.intakeQuestionId && target.classList.contains('intake-question-textarea')) {
		handleIntakeQuestionInput(target.dataset.intakeQuestionId, (target as HTMLTextAreaElement).value);
	}
	if (target.id === 'user-input') {
		updateComposerEmpty(target);
		// Detect @ trigger for mentions
		const query = getMentionQueryAtCursor();
		const sel = window.getSelection();
		if (sel && sel.rangeCount > 0) {
			const node = sel.anchorNode;
			if (node && node.nodeType === Node.TEXT_NODE) {
				const textBefore = node.textContent!.substring(0, sel.anchorOffset);
				if (textBefore.match(/@([^\s]*)$/)) {
					state.mentionAtIndex = textBefore.lastIndexOf('@');
					debouncedMentionQuery(query);
					return;
				}
			}
		}
		hideMentionDropdown();
	}
});

// Keydown delegation — Enter to send clarification in Ask More mode
document.addEventListener('keydown', function (event: KeyboardEvent) {
	const target = event.target as HTMLElement | null;
	if (!target || !target.tagName) { return; }
	if (target.tagName === 'TEXTAREA' && event.key === 'Enter' && !event.shiftKey) {
		const responseArea = target.closest('[data-clarification-item]') as HTMLElement | null;
		if (responseArea) {
			const itemId = responseArea.dataset.clarificationItem;
			if (itemId && state.clarificationMode[itemId] === 'askmore') {
				event.preventDefault();
				handleClarificationSend(itemId);
			}
		}
	}
});

// Direct listeners for the composer contenteditable
const userInput = document.getElementById('user-input');
if (userInput) {
	// Paste: strip HTML, insert plain text only via Selection API
	userInput.addEventListener('paste', function (event: ClipboardEvent) {
		event.preventDefault();
		const text = event.clipboardData ? event.clipboardData.getData('text/plain') : '';
		if (!text) { return; }
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0) { return; }
		const range = sel.getRangeAt(0);
		range.deleteContents();
		const node = document.createTextNode(text);
		range.insertNode(node);
		range.setStartAfter(node);
		range.collapse(true);
		sel.removeAllRanges();
		sel.addRange(range);
		updateComposerEmpty(userInput);
	});

	userInput.addEventListener('keydown', function (event: KeyboardEvent) {
		// Keyboard navigation when mention dropdown is active
		if (state.mentionActive) {
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				mentionNavigate(1);
				return;
			}
			if (event.key === 'ArrowUp') {
				event.preventDefault();
				mentionNavigate(-1);
				return;
			}
			if (event.key === 'Enter') {
				event.preventDefault();
				mentionConfirmSelection();
				return;
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				hideMentionDropdown();
				return;
			}
			if (event.key === 'Tab') {
				event.preventDefault();
				mentionConfirmSelection();
				return;
			}
		}
		// Escape during speech recording = cancel recording
		if (event.key === 'Escape' && state.speechRecordingTarget) {
			event.preventDefault();
			vscode.postMessage({ type: 'speechCancel' });
			return;
		}
		// Escape during thinking = cancel
		if (event.key === 'Escape') {
			if (document.getElementById('submit-btn')?.classList.contains('thinking')) {
				event.preventDefault();
				vscode.postMessage({ type: 'cancelThinking' });
				return;
			}
		}
		// Enter = submit, Shift+Enter = newline
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			submitInput();
			return;
		}
		if (event.key === 'Enter' && event.shiftKey) {
			event.preventDefault();
			const sel = window.getSelection();
			if (sel && sel.rangeCount > 0) {
				const range = sel.getRangeAt(0);
				range.deleteContents();
				const br = document.createElement('br');
				range.insertNode(br);
				range.setStartAfter(br);
				range.collapse(true);
				sel.removeAllRanges();
				sel.addRange(range);
				updateComposerEmpty(userInput);
			}
		}
	});

	// Dismiss mention dropdown on blur (with delay for click handling)
	userInput.addEventListener('blur', function () {
		setTimeout(function () {
			const active = document.activeElement;
			const dropdown = document.getElementById('mention-dropdown');
			if (dropdown && dropdown.contains(active)) { return; }
			hideMentionDropdown();
		}, 200);
	});
}

const submitBtn = document.getElementById('submit-btn');
if (submitBtn) {
	submitBtn.addEventListener('click', function () {
		if (submitBtn.classList.contains('thinking')) {
			vscode.postMessage({ type: 'cancelThinking' });
		} else {
			submitInput();
		}
	});
}

// ===== INITIAL SCROLL =====
setTimeout(scrollToBottom, 100);
