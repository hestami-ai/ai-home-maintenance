/**
 * Entry point for the Governed Stream webview client.
 * Sets up message routing, event delegation, and direct element listeners.
 *
 * Compiled by esbuild to dist/webview/governedStream.js as an IIFE bundle
 * and loaded via <script src="..."> in the webview HTML.
 */

import { vscode } from './types';
import type { IncomingMessage } from './types';
import { state, restoreMmpState, restoreDrafts } from './state';
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
	handleMirrorDecision,
	handleMirrorEdit,
	handleMirrorRationale,
	handleMenuSelect,
	handleMenuCustomInput,
	handlePreMortemDecision,
	handlePreMortemRationale,
	handleMMPSubmit,
	handleBulkMirrorAction,
	handleBulkPreMortemAction,
	applyPendingMmpDecisions,
} from './mmp';
import {
	handleSpeechToggle,
	handleSpeechRecordingStarted,
	handleSpeechTranscribing,
	handleSpeechResult,
	handleSpeechError,
	handleSpeechCapability,
} from './speech';
import {
	toggleFindWidget,
	closeFindWidget,
	openFindWidget,
	onFindInput,
	findNext,
	findPrev,
} from './findWidget';

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
		case 'pendingMmpDecisionsLoaded':
			// Merge pending decisions into JS state (visual state handled by server-side rendering)
			applyPendingMmpDecisions(msg.decisions);
			break;
		case 'draftsLoaded':
			restoreDrafts(msg.drafts);
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
		case 'openFindWidget':
			openFindWidget();
			break;
	}
});

// ===== EVENT DELEGATION =====

// Click delegation — handles all data-action clicks
document.addEventListener('click', function (event: MouseEvent) {
	// Don't intercept clicks on form elements — they have their own input handlers
	const clickedEl = event.target as HTMLElement;
	if (clickedEl.tagName === 'TEXTAREA' || clickedEl.tagName === 'INPUT' || clickedEl.tagName === 'SELECT') { return; }

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
		case 'toggle-find':
			toggleFindWidget();
			break;
		case 'close-find':
			closeFindWidget();
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
		case 'generate-document':
			vscode.postMessage({ type: 'generateDocument' });
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
		// MMP (Mirror & Menu Protocol) actions
		case 'mirror-accept':
			if (target.dataset.mmpItem && target.dataset.mmpCard) {
				handleMirrorDecision(target.dataset.mmpItem, target.dataset.mmpCard, 'accepted');
			}
			break;
		case 'mirror-reject':
			if (target.dataset.mmpItem && target.dataset.mmpCard) {
				handleMirrorDecision(target.dataset.mmpItem, target.dataset.mmpCard, 'rejected');
			}
			break;
		case 'mirror-defer':
			if (target.dataset.mmpItem && target.dataset.mmpCard) {
				handleMirrorDecision(target.dataset.mmpItem, target.dataset.mmpCard, 'deferred');
			}
			break;
		case 'mirror-edit':
			if (target.dataset.mmpItem && target.dataset.mmpCard) {
				handleMirrorEdit(target.dataset.mmpItem, target.dataset.mmpCard);
			}
			break;
		case 'mirror-rationale':
			if (target.dataset.mmpItem && target.dataset.mmpCard) {
				handleMirrorRationale(target.dataset.mmpItem, target.dataset.mmpCard);
			}
			break;
		case 'menu-select':
			if (target.dataset.mmpMenuId && target.dataset.mmpOptionId && target.dataset.mmpCard) {
				handleMenuSelect(target.dataset.mmpMenuId, target.dataset.mmpOptionId, target.dataset.mmpCard);
			}
			break;
		case 'premortem-accept':
			if (target.dataset.mmpItem && target.dataset.mmpCard) {
				handlePreMortemDecision(target.dataset.mmpItem, target.dataset.mmpCard, 'accepted');
			}
			break;
		case 'premortem-reject':
			if (target.dataset.mmpItem && target.dataset.mmpCard) {
				handlePreMortemDecision(target.dataset.mmpItem, target.dataset.mmpCard, 'rejected');
			}
			break;
		case 'mmp-bulk':
			if (target.dataset.mmpCard && target.dataset.mmpBulkAction) {
				handleBulkMirrorAction(target.dataset.mmpCard, target.dataset.mmpBulkAction as 'accept' | 'reject' | 'defer');
			}
			break;
		case 'mmp-bulk-pm':
			if (target.dataset.mmpCard && target.dataset.mmpBulkAction) {
				handleBulkPreMortemAction(target.dataset.mmpCard, target.dataset.mmpBulkAction as 'accept' | 'reject');
			}
			break;
		case 'mmp-submit':
			if (target.dataset.mmpCard) {
				handleMMPSubmit(target.dataset.mmpCard);
			}
			break;
		// Reasoning Review actions
		case 'review-acknowledge': {
			const card = target.closest('.reasoning-review-card') as HTMLElement | null;
			if (card) {
				card.style.opacity = '0.4';
				card.style.pointerEvents = 'none';
				const actions = card.querySelector('.review-actions') as HTMLElement | null;
				if (actions) { actions.innerHTML = '<span style="font-size:12px;color:var(--vscode-descriptionForeground)">Acknowledged</span>'; }
			}
			break;
		}
		case 'review-rerun':
			vscode.postMessage({ type: 'reviewRerun' });
			break;
		case 'review-guidance': {
			const card = target.closest('.reasoning-review-card') as HTMLElement | null;
			if (card) {
				let guidanceArea = card.querySelector('.review-guidance-area') as HTMLElement | null;
				if (!guidanceArea) {
					guidanceArea = document.createElement('div');
					guidanceArea.className = 'review-guidance-area';
					guidanceArea.innerHTML =
						'<textarea class="review-guidance-input" placeholder="Add your guidance for the re-run..." rows="3"></textarea>' +
						'<button class="mmp-btn review-action-btn" data-action="review-guidance-submit">Submit &amp; Re-run</button>';
					const actions = card.querySelector('.review-actions');
					if (actions) { actions.before(guidanceArea); }
				} else {
					guidanceArea.classList.toggle('visible');
				}
				const ta = guidanceArea.querySelector('textarea') as HTMLTextAreaElement | null;
				if (ta) { ta.focus(); }
			}
			break;
		}
		case 'review-guidance-submit': {
			const card = target.closest('.reasoning-review-card') as HTMLElement | null;
			const ta = card?.querySelector('.review-guidance-input') as HTMLTextAreaElement | null;
			const guidance = ta?.value?.trim() ?? '';
			vscode.postMessage({ type: 'reviewRerun', guidance });
			break;
		}
		case 'toggle-speech':
			if (target.dataset.speechTarget) {
				handleSpeechToggle(target.dataset.speechTarget);
			}
			break;
		// Architecture gate actions
		case 'architecture-approve':
			if (target.dataset.dialogueId && target.dataset.docId) {
				vscode.postMessage({
					type: 'architectureGateDecision',
					action: 'APPROVE',
					dialogueId: target.dataset.dialogueId,
					docId: target.dataset.docId,
				});
				// Disable all gate buttons
				const approveCard = target.closest('.architecture-gate');
				if (approveCard) {
					approveCard.querySelectorAll('.gate-btn').forEach(function (btn) {
						(btn as HTMLButtonElement).disabled = true;
					});
				}
			}
			break;
		case 'architecture-revise': {
			if (target.dataset.dialogueId && target.dataset.docId) {
				// Toggle feedback textarea visibility
				const reviseCard = target.closest('.architecture-gate');
				const feedbackArea = reviseCard?.querySelector('.architecture-feedback-area') as HTMLElement | null;
				if (feedbackArea) {
					const isVisible = feedbackArea.classList.contains('visible');
					if (isVisible) {
						// Submit the feedback
						const textarea = feedbackArea.querySelector('textarea') as HTMLTextAreaElement | null;
						const feedback = textarea?.value.trim() || '';
						if (feedback.length < 10) {
							// Flash the textarea to indicate more input needed
							feedbackArea.classList.add('shake');
							setTimeout(function () { feedbackArea.classList.remove('shake'); }, 500);
							break;
						}
						vscode.postMessage({
							type: 'architectureGateDecision',
							action: 'REVISE',
							dialogueId: target.dataset.dialogueId,
							docId: target.dataset.docId,
							feedback: feedback,
						});
						// Disable all gate buttons
						reviseCard?.querySelectorAll('.gate-btn').forEach(function (btn) {
							(btn as HTMLButtonElement).disabled = true;
						});
					} else {
						feedbackArea.classList.add('visible');
						const textarea = feedbackArea.querySelector('textarea') as HTMLTextAreaElement | null;
						if (textarea) { textarea.focus(); }
						// Change button text to indicate submit
						target.textContent = 'Submit Feedback';
					}
				}
			}
			break;
		}
		case 'architecture-skip':
			if (target.dataset.dialogueId && target.dataset.docId) {
				vscode.postMessage({
					type: 'architectureGateDecision',
					action: 'SKIP',
					dialogueId: target.dataset.dialogueId,
					docId: target.dataset.docId,
				});
				const skipCard = target.closest('.architecture-gate');
				if (skipCard) {
					skipCard.querySelectorAll('.gate-btn').forEach(function (btn) {
						(btn as HTMLButtonElement).disabled = true;
					});
				}
			}
			break;
		case 'architecture-decompose-deeper':
			if (target.dataset.dialogueId && target.dataset.docId) {
				vscode.postMessage({
					type: 'architectureDecomposeDeeper',
					dialogueId: target.dataset.dialogueId,
					docId: target.dataset.docId,
				});
				const deeperCard = target.closest('.architecture-gate');
				if (deeperCard) {
					deeperCard.querySelectorAll('.gate-btn').forEach(function (btn) {
						(btn as HTMLButtonElement).disabled = true;
					});
				}
				target.textContent = 'Decomposing...';
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
	// MMP textarea inputs
	if (target.dataset && target.dataset.mmpCustomTextarea && target.dataset.mmpCard) {
		handleMenuCustomInput(target.dataset.mmpCustomTextarea, target.dataset.mmpCard, (target as HTMLTextAreaElement).value);
	}
	if (target.dataset && target.dataset.mmpPmRationale && target.dataset.mmpCard) {
		handlePreMortemRationale(target.dataset.mmpPmRationale, target.dataset.mmpCard, (target as HTMLTextAreaElement).value);
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

// ===== FIND WIDGET WIRING =====

// Find input: live search on typing, Enter/Shift+Enter for next/prev, Escape to close
const findInput = document.getElementById('find-input') as HTMLInputElement | null;
if (findInput) {
	findInput.addEventListener('input', onFindInput);
	findInput.addEventListener('keydown', function (event: KeyboardEvent) {
		if (event.key === 'Enter' && event.shiftKey) {
			event.preventDefault();
			findPrev();
		} else if (event.key === 'Enter') {
			event.preventDefault();
			findNext();
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			closeFindWidget();
		}
	});
}

const findNextBtn = document.getElementById('find-next-btn');
if (findNextBtn) { findNextBtn.addEventListener('click', findNext); }

const findPrevBtn = document.getElementById('find-prev-btn');
if (findPrevBtn) { findPrevBtn.addEventListener('click', findPrev); }

const findCloseBtn = document.getElementById('find-close-btn');
if (findCloseBtn) { findCloseBtn.addEventListener('click', closeFindWidget); }

// ===== RESTORE MMP STATE INTO JS =====
// Restore decision state from webview state API so click handlers can toggle correctly.
// Visual state is handled by server-side rendering (classes baked into HTML).
restoreMmpState();

// ===== INITIAL SCROLL =====
setTimeout(scrollToBottom, 100);
