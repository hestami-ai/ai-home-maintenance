/**
 * Client-Side JavaScript for the Governed Stream Webview
 * Runs inside the VS Code webview context.
 * Exported as a string to be injected into a <script> tag.
 *
 * All event handling uses addEventListener (not inline handlers)
 * to comply with the nonce-based Content Security Policy.
 */

export function getClientScript(): string {
	return `
		(function () {
			const vscode = acquireVsCodeApi();

			// ===== MESSAGE HANDLING =====

			window.addEventListener('message', function (event) {
				var msg = event.data;
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
				}
			});

			function handleFullUpdate(data) {
				var streamArea = document.getElementById('stream-content');
				if (streamArea && data.streamHtml) {
					streamArea.innerHTML = data.streamHtml;
					scrollToBottom();
				}
			}

			function handleTurnAdded(data) {
				var streamArea = document.getElementById('stream-content');
				if (streamArea && data.html) {
					streamArea.insertAdjacentHTML('beforeend', data.html);
					scrollToBottom();
				}
			}

			function handleClaimUpdated(data) {
				var claimElements = document.querySelectorAll('[data-claim-id="' + data.claimId + '"]');
				claimElements.forEach(function (el) {
					var badge = el.querySelector('.verdict-badge');
					if (badge) {
						badge.className = 'verdict-badge ' + getVerdictClass(data.status);
						badge.innerHTML = getVerdictIcon(data.status) + ' ' + data.status;
					}
				});
			}

			function handlePhaseChanged(data) {
				vscode.postMessage({ type: 'refresh' });
			}

			function handleGateTriggered(data) {
				vscode.postMessage({ type: 'refresh' });
			}

			function handleGateResolved(data) {
				var gateCard = document.querySelector('[data-gate-id="' + data.gateId + '"]');
				if (gateCard) {
					gateCard.style.opacity = '0.5';
					gateCard.style.pointerEvents = 'none';
					var header = gateCard.querySelector('.gate-header');
					if (header) {
						header.innerHTML = '&#x2705; Gate Resolved: ' + (data.action || 'Decision made');
					}
					gateCard.querySelectorAll('.gate-btn').forEach(function (btn) {
						btn.disabled = true;
					});
				}
			}

			// ===== INTAKE HANDLERS =====

			function handleIntakePlanUpdated(data) {
				// Refresh the full view to show updated plan
				vscode.postMessage({ type: 'refresh' });
			}

			// ===== DIALOGUE TITLE HANDLER =====

			function handleDialogueTitleUpdated(data) {
				if (!data || !data.dialogueId || !data.title) return;
				// Update the switcher trigger label if this is the active dialogue
				var trigger = document.querySelector('.switcher-trigger');
				if (trigger) {
					var title = data.title.length > 30 ? data.title.substring(0, 30) : data.title;
					trigger.innerHTML = escapeHtmlClient(title) + ' &#x25BE;';
				}
				// Update the switcher item for this dialogue
				var switcherItem = document.querySelector('.switcher-item[data-dialogue-id="' + data.dialogueId + '"] .switcher-title');
				if (switcherItem) {
					var itemTitle = data.title.length > 40 ? data.title.substring(0, 40) : data.title;
					switcherItem.textContent = itemTitle;
				}
				// Update the dialogue start marker title
				var markerTitle = document.querySelector('#dialogue-' + data.dialogueId + ' .dialogue-marker-title');
				if (markerTitle) {
					markerTitle.textContent = data.title.length > 60 ? data.title.substring(0, 60) : data.title;
				}
			}

			// ===== TEXT COMMAND HANDLERS =====

			function handleSystemMessage(data) {
				var streamArea = document.getElementById('stream-content');
				if (streamArea && data.message) {
					var html = '<div class="system-message">' +
						'<span class="system-message-icon">&#x2139;&#xFE0E;</span> ' +
						escapeHtmlClient(data.message) +
					'</div>';
					streamArea.insertAdjacentHTML('beforeend', html);
					scrollToBottom();
				}
			}

			function handleCommandOptions(data) {
				var streamArea = document.getElementById('stream-content');
				if (streamArea && data.options) {
					var html = '<div class="command-options-card">' +
						'<div class="command-options-prompt">' + escapeHtmlClient(data.prompt) + '</div>' +
						'<div class="command-options-chips">';

					for (var i = 0; i < data.options.length; i++) {
						var opt = data.options[i];
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

			// ===== VERDICT HELPERS =====

			function getVerdictClass(status) {
				switch (status) {
					case 'VERIFIED': return 'verified';
					case 'DISPROVED': return 'disproved';
					case 'UNKNOWN': return 'unknown';
					case 'CONDITIONAL': return 'conditional';
					default: return 'pending';
				}
			}

			function getVerdictIcon(status) {
				switch (status) {
					case 'VERIFIED': return '&#x2705;';
					case 'DISPROVED': return '&#x274C;';
					case 'UNKNOWN': return '&#x2753;';
					case 'CONDITIONAL': return '&#x26A0;';
					default: return '&#x26AA;';
				}
			}

			// ===== GATE DECISION =====

			var gateRationales = {};

			function handleRationaleInput(gateId, text) {
				gateRationales[gateId] = text;
				var charCount = document.getElementById('charcount-' + gateId);
				if (charCount) {
					charCount.textContent = text.length + ' / 10 min';
				}

				var gateCard = document.querySelector('[data-gate-id="' + gateId + '"]');
				if (gateCard) {
					gateCard.querySelectorAll('.gate-btn').forEach(function (btn) {
						btn.disabled = text.length < 10;
					});
				}
			}

			function submitGateDecision(gateId, action) {
				var rationale = gateRationales[gateId] || '';
				if (rationale.length < 10) {
					return;
				}
				vscode.postMessage({
					type: 'gateDecision',
					gateId: gateId,
					action: action,
					rationale: rationale,
				});
			}

			// ===== VERIFICATION GATE =====

			var verificationClaimRationales = {};

			function handleClaimRationaleInput(claimId, text) {
				verificationClaimRationales[claimId] = text;
				var charCount = document.getElementById('vg-charcount-' + claimId);
				if (charCount) {
					charCount.textContent = text.length + ' / 10 min';
				}
				// Check if all blocking claims have rationale >= 10 chars to enable "Accept Risks" button
				updateAcceptRisksButton();
			}

			function updateAcceptRisksButton() {
				var acceptBtn = document.querySelector('.verification-btn.accept-risks');
				if (!acceptBtn) return;
				var blockingCount = parseInt(acceptBtn.dataset.blockingCount || '0', 10);
				if (blockingCount === 0) {
					acceptBtn.disabled = false;
					return;
				}
				// Find all blocking claim textareas
				var textareas = document.querySelectorAll('.verification-claim-response textarea[data-claim-rationale]');
				var allHaveRationale = true;
				textareas.forEach(function (ta) {
					var claimId = ta.dataset.claimRationale;
					var text = verificationClaimRationales[claimId] || '';
					if (text.length < 10) {
						allHaveRationale = false;
					}
				});
				acceptBtn.disabled = !allHaveRationale;
			}

			function handleVerificationGateDecision(gateId, action) {
				if (action === 'OVERRIDE') {
					// Collect all per-claim rationales
					vscode.postMessage({
						type: 'verificationGateDecision',
						gateId: gateId,
						action: 'OVERRIDE',
						claimRationales: verificationClaimRationales,
					});
				} else {
					vscode.postMessage({
						type: 'verificationGateDecision',
						gateId: gateId,
						action: action,
					});
				}
			}

			// ===== REVIEW GATE =====

			var reviewItemRationales = {};
			var reviewOverallRationale = '';

			function handleReviewItemRationaleInput(itemKey, text) {
				reviewItemRationales[itemKey] = text;
				var charCount = document.getElementById('review-charcount-' + itemKey);
				if (charCount) {
					charCount.textContent = text.length + ' / 10 min';
				}
				updateReviewApproveButton();
			}

			function handleReviewOverallInput(gateId, text) {
				reviewOverallRationale = text;
				var charCount = document.getElementById('review-overall-charcount-' + gateId);
				if (charCount) {
					charCount.textContent = text.length + ' characters';
				}
				updateReviewApproveButton();
			}

			function updateReviewApproveButton() {
				// Target only the active (non-resolved) review card's approve button.
				// Resolved cards wrap buttons in .review-actions.resolved — skip those.
				var approveBtn = document.querySelector('.review-actions:not(.resolved) .review-btn.approve-execute');
				if (!approveBtn) return;
				var disabledTip = 'Provide overall feedback or respond to at least one item above (min 10 characters) to enable this button.';
				var enabledTip = 'Accept all findings and proceed to execution.';
				var needsCount = parseInt(approveBtn.dataset.needsDecisionCount || '0', 10);
				if (needsCount === 0) {
					approveBtn.disabled = false;
					approveBtn.title = enabledTip;
					return;
				}
				// Enable when user provides overall feedback (>= 10 chars)
				// OR has responded to at least one needs-decision item (>= 10 chars).
				// Per-item textareas are optional detail, not mandatory gatekeeping.
				var enabled = false;
				if (reviewOverallRationale.length >= 10) {
					enabled = true;
				} else {
					var textareas = document.querySelectorAll('.review-item-response textarea[data-review-item-rationale]');
					textareas.forEach(function (ta) {
						var key = ta.dataset.reviewItemRationale;
						var text = reviewItemRationales[key] || '';
						if (text.length >= 10) {
							enabled = true;
						}
					});
				}
				approveBtn.disabled = !enabled;
				approveBtn.title = enabled ? enabledTip : disabledTip;
			}

			function handleReviewGateDecision(gateId, action) {
				if (action === 'APPROVE') {
					vscode.postMessage({
						type: 'reviewGateDecision',
						gateId: gateId,
						action: 'APPROVE',
						itemRationales: reviewItemRationales,
						overallFeedback: reviewOverallRationale,
					});
				} else {
					vscode.postMessage({
						type: 'reviewGateDecision',
						gateId: gateId,
						action: action,
						overallFeedback: reviewOverallRationale,
					});
				}
			}

			// ===== INTAKE QUESTION RESPONSES =====

			var intakeQuestionResponses = {};

			function handleIntakeQuestionInput(questionId, text) {
				intakeQuestionResponses[questionId] = text;
				var charCount = document.querySelector('[data-charcount-for="' + questionId + '"]');
				if (charCount) {
					charCount.textContent = text.length + ' chars';
				}
				updateIntakeSubmitBar();
			}

			function updateIntakeSubmitBar() {
				var bar = document.getElementById('intake-questions-submit-bar');
				var btn = document.getElementById('intake-submit-btn');
				var countEl = document.getElementById('intake-submit-count');
				if (!bar) return;

				var count = 0;
				var keys = Object.keys(intakeQuestionResponses);
				for (var k = 0; k < keys.length; k++) {
					if (intakeQuestionResponses[keys[k]].trim().length > 0) {
						count++;
					}
				}

				if (count > 0) {
					bar.style.display = 'flex';
					if (btn) btn.disabled = false;
					if (countEl) countEl.textContent = count + (count === 1 ? ' response' : ' responses');
				} else {
					bar.style.display = 'none';
					if (btn) btn.disabled = true;
					if (countEl) countEl.textContent = '0 responses';
				}
			}

			function handleIntakeSubmitResponses() {
				var parts = [];
				var keys = Object.keys(intakeQuestionResponses);
				for (var k = 0; k < keys.length; k++) {
					var id = keys[k];
					var text = intakeQuestionResponses[id].trim();
					if (text) {
						// Look up the original question text from the textarea data attribute
						var textarea = document.querySelector('.intake-question-textarea[data-intake-question-id="' + id + '"]');
						var questionText = textarea ? (textarea.dataset.intakeQuestionText || '') : '';
						if (questionText) {
							parts.push('[Re: ' + id + ': "' + questionText + '"] ' + text);
						} else {
							parts.push('[Re: ' + id + '] ' + text);
						}
					}
				}
				if (parts.length === 0) return;

				var finalText = parts.join('\\n');
				vscode.postMessage({
					type: 'submitInput',
					text: finalText,
					attachments: [],
				});

				// Clear state
				intakeQuestionResponses = {};
				var textareas = document.querySelectorAll('.intake-question-textarea');
				textareas.forEach(function (ta) {
					ta.value = '';
				});
				var charcounts = document.querySelectorAll('.intake-question-charcount');
				charcounts.forEach(function (el) {
					el.textContent = '0 chars';
				});
				updateIntakeSubmitBar();
			}

			function disableIntakeApprovalButtons(clickedBtn) {
				var container = clickedBtn.closest('.intake-approval-actions');
				if (!container) return;
				var buttons = container.querySelectorAll('button');
				buttons.forEach(function (btn) { btn.disabled = true; });
				clickedBtn.classList.add('was-selected');
			}

			// ===== ASK MORE — MODE TOGGLE ON RESPONSE TEXTAREAS =====

			// State: saved response text per item (preserved while in Ask More mode)
			var savedResponseText = {};
			// State: current mode per item ('respond' or 'askmore')
			var clarificationMode = {};

			function handleToggleAskMore(itemId) {
				var responseArea = document.querySelector('[data-clarification-item="' + itemId + '"]');
				if (!responseArea) return;
				var textarea = responseArea.querySelector('textarea');
				if (!textarea) return;
				var toolbar = responseArea.querySelector('.response-toolbar');
				if (!toolbar) return;
				var toggleBtn = toolbar.querySelector('.ask-more-toggle');
				var messagesEl = document.getElementById('clarification-messages-' + itemId);

				var currentMode = clarificationMode[itemId] || 'respond';
				if (currentMode === 'respond') {
					// Switch to Ask More mode
					clarificationMode[itemId] = 'askmore';
					savedResponseText[itemId] = textarea.value;
					textarea.value = '';
					textarea.placeholder = 'Ask a follow-up question...';
					responseArea.classList.add('askmore-mode');
					if (toggleBtn) {
						toggleBtn.textContent = 'Back to Response';
						toggleBtn.classList.add('active');
					}

					// Replace charcount with Send button
					var charcount = toolbar.querySelector('[class*="charcount"]');
					if (charcount) { charcount.style.display = 'none'; }
					var sendBtn = toolbar.querySelector('.clarification-send-btn');
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
					if (!clarificationConversations[itemId]) {
						clarificationConversations[itemId] = [];
					}

					textarea.focus();
				} else {
					// Switch back to Respond mode
					clarificationMode[itemId] = 'respond';
					textarea.value = savedResponseText[itemId] || '';
					textarea.placeholder = textarea.getAttribute('data-original-placeholder') || 'Type your response...';
					responseArea.classList.remove('askmore-mode');
					if (toggleBtn) {
						toggleBtn.textContent = 'Ask More';
						toggleBtn.classList.remove('active');
					}

					// Restore charcount, hide Send button
					var charcount2 = toolbar.querySelector('[class*="charcount"]');
					if (charcount2) { charcount2.style.display = ''; }
					var sendBtn2 = toolbar.querySelector('.clarification-send-btn');
					if (sendBtn2) { sendBtn2.style.display = 'none'; }

					// Hide conversation messages
					if (messagesEl) { messagesEl.style.display = 'none'; }

					// Trigger charcount update for the restored text
					textarea.dispatchEvent(new Event('input', { bubbles: true }));
				}
			}

			function handleClarificationSend(itemId) {
				var responseArea = document.querySelector('[data-clarification-item="' + itemId + '"]');
				if (!responseArea) return;
				var textarea = responseArea.querySelector('textarea');
				if (!textarea) return;
				var text = textarea.value.trim();
				if (!text || clarificationPending[itemId]) return;

				var history = clarificationConversations[itemId] || [];
				history.push({ role: 'user', content: text });
				clarificationConversations[itemId] = history;
				appendClarificationMessage(itemId, 'human', text);
				textarea.value = '';

				clarificationPending[itemId] = true;
				appendClarificationMessage(itemId, 'loading', '');

				// Show messages container
				var messagesEl = document.getElementById('clarification-messages-' + itemId);
				if (messagesEl) { messagesEl.style.display = 'block'; }

				var toggleBtn = document.querySelector('.ask-more-toggle[data-clarification-item="' + itemId + '"]');
				var context = toggleBtn ? toggleBtn.dataset.clarificationContext : '';

				vscode.postMessage({
					type: 'clarificationMessage',
					itemId: itemId,
					itemContext: context,
					history: history,
				});
			}

			function handleClarificationResponse(itemId, response, error, elapsedMs, model) {
				clarificationPending[itemId] = false;
				var loading = document.getElementById('clarification-loading-' + itemId);
				if (loading) { loading.parentNode.removeChild(loading); }

				if (error) {
					appendClarificationMessage(itemId, 'error', error);
				} else if (response) {
					if (!clarificationConversations[itemId]) {
						clarificationConversations[itemId] = [];
					}
					clarificationConversations[itemId].push({ role: 'assistant', content: response });
					appendClarificationMessage(itemId, 'assistant', response, elapsedMs, model);
				}
			}

			function simpleMd(text) {
				var s = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
				var lines = s.split('\\n');
				var out = [];
				var inList = false;
				for (var i = 0; i < lines.length; i++) {
					var line = lines[i];
					if (line.trim() === '') {
						if (inList) { out.push('</ul>'); inList = false; }
						continue;
					}
					var hm = line.match(/^(#{1,4})\\s+(.*)$/);
					if (hm) {
						if (inList) { out.push('</ul>'); inList = false; }
						out.push('<strong>' + hm[2] + '</strong>');
						continue;
					}
					var lm = line.match(/^\\s*[-*]\\s+(.*)$/);
					if (lm) {
						if (!inList) { out.push('<ul>'); inList = true; }
						out.push('<li>' + inlineFmt(lm[1]) + '</li>');
						continue;
					}
					if (inList) { out.push('</ul>'); inList = false; }
					out.push('<p style="margin:2px 0;">' + inlineFmt(line) + '</p>');
				}
				if (inList) { out.push('</ul>'); }
				return out.join('');
			}
			function inlineFmt(t) {
				return t
					.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
					.replace(/\\*(.+?)\\*/g, '<em>$1</em>')
					.replace(new RegExp('\\x60([^\\x60]+)\\x60', 'g'), '<code>$1</code>');
			}

			function appendClarificationMessage(itemId, role, content, elapsedMs, model) {
				var container = document.getElementById('clarification-messages-' + itemId);
				if (!container) return;
				var div = document.createElement('div');
				div.className = 'clarification-msg clarification-msg-' + role;
				if (role === 'loading') {
					div.id = 'clarification-loading-' + itemId;
					div.innerHTML = '<span class="clarification-loading-dots">Thinking...</span>';
				} else if (role === 'assistant') {
					var meta = '';
					if (elapsedMs) {
						var secs = (elapsedMs / 1000).toFixed(1);
						meta = '<div class="clarification-meta">' + secs + 's' +
							(model ? ' \\u00B7 ' + escapeHtmlClient(model) : '') + '</div>';
					}
					div.innerHTML = simpleMd(content) + meta;
				} else {
					div.textContent = content;
				}
				container.appendChild(div);
				container.scrollTop = container.scrollHeight;
			}

			// Restore clarification threads loaded from the database
			function restoreClarificationThreads(threads) {
				if (!threads || !Array.isArray(threads)) return;
				for (var i = 0; i < threads.length; i++) {
					var thread = threads[i];
					clarificationConversations[thread.itemId] = thread.messages.map(function (m) {
						return { role: m.role, content: m.content };
					});
					// Render the messages into the DOM
					var container = document.getElementById('clarification-messages-' + thread.itemId);
					if (container && thread.messages.length > 0) {
						for (var j = 0; j < thread.messages.length; j++) {
							var msg = thread.messages[j];
							var cssRole = msg.role === 'user' ? 'human' : msg.role;
							appendClarificationMessage(thread.itemId, cssRole, msg.content);
						}
					}
				}
			}

			// ===== INPUT AREA =====

			var attachedFiles = [];
			var recentMentions = [];
			var RECENT_MENTIONS_MAX = 5;
			var cachedFileList = [];

			// --- Inline clarification thread state ---
			var clarificationConversations = {};
			var clarificationPending = {};
			var mentionSelectedIndex = -1;
			var mentionDebounceTimer = null;
			var MENTION_DEBOUNCE_MS = 150;
			var mentionActive = false;
			var mentionAtIndex = -1;

			// --- File type icon map ---
			var FILE_ICONS = {
				md: '&#x1F4DD;', txt: '&#x1F4DD;', rst: '&#x1F4DD;',
				ts: '&#x1F7E6;', tsx: '&#x1F7E6;', js: '&#x1F7E8;', jsx: '&#x1F7E8;',
				json: '&#x1F4CB;', yaml: '&#x1F4CB;', yml: '&#x1F4CB;',
				py: '&#x1F40D;', rs: '&#x2699;', go: '&#x1F7E6;', java: '&#x2615;',
				css: '&#x1F3A8;', html: '&#x1F310;', sql: '&#x1F5C4;',
			};

			function getFileIcon(filePath) {
				var ext = (filePath.split('.').pop() || '').toLowerCase();
				return FILE_ICONS[ext] || '&#x1F4C4;';
			}

			function getFileName(filePath) {
				return filePath.split(/[\\/]/).pop() || filePath;
			}

			function getFileFolder(filePath) {
				var parts = filePath.split(/[\\/]/);
				return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
			}

			// --- Fuzzy matching ---
			function fuzzyMatch(query, text) {
				if (!query) return true;
				var q = query.toLowerCase();
				var t = text.toLowerCase();
				// Substring match first (fast path)
				if (t.indexOf(q) >= 0) return true;
				// Character-by-character fuzzy
				var qi = 0;
				for (var ti = 0; ti < t.length && qi < q.length; ti++) {
					if (t[ti] === q[qi]) qi++;
				}
				return qi === q.length;
			}

			function fuzzyScore(query, text) {
				if (!query) return 0;
				var q = query.toLowerCase();
				var t = text.toLowerCase();
				var name = getFileName(text).toLowerCase();
				// Exact name match = highest
				if (name === q) return 100;
				// Name starts with query
				if (name.indexOf(q) === 0) return 80;
				// Name contains query
				if (name.indexOf(q) >= 0) return 60;
				// Path contains query
				if (t.indexOf(q) >= 0) return 40;
				// Fuzzy match
				return 20;
			}

			// --- Serialize contenteditable composer to text ---
			function serializeComposer() {
				var composer = document.getElementById('user-input');
				if (!composer) return { text: '' };

				var text = '';

				composer.childNodes.forEach(function (node) {
					if (node.nodeType === Node.TEXT_NODE) {
						text += node.textContent;
					} else if (node.nodeType === Node.ELEMENT_NODE) {
						if (node.nodeName === 'BR') {
							text += '\\n';
						} else {
							text += node.textContent;
						}
					}
				});

				return { text: text.trim() };
			}

			function clearComposer() {
				var composer = document.getElementById('user-input');
				if (composer) {
					composer.innerHTML = '';
					updateComposerEmpty(composer);
				}
			}

			function composerIsEmpty() {
				var composer = document.getElementById('user-input');
				if (!composer) return true;
				return composer.textContent.trim() === '';
			}

			function updateComposerEmpty(composer) {
				if (!composer) return;
				var isEmpty = composer.textContent.trim() === '';
				composer.dataset.empty = isEmpty ? 'true' : 'false';
			}

			// --- Submit ---
			function submitInput() {
				var result = serializeComposer();
				if (!result.text && attachedFiles.length === 0) return;

				vscode.postMessage({
					type: 'submitInput',
					text: result.text,
					attachments: attachedFiles.slice(),
				});

				clearComposer();
				attachedFiles = [];
				updateAttachmentsDisplay();
				hideMentionDropdown();
			}

			// --- Unified Attachment/Mention Model ---

			function addAttachment(filePath) {
				if (attachedFiles.indexOf(filePath) === -1) {
					attachedFiles.push(filePath);
					updateAttachmentsDisplay();
					// Track in recent mentions
					recentMentions = recentMentions.filter(function (f) { return f !== filePath; });
					recentMentions.unshift(filePath);
					if (recentMentions.length > RECENT_MENTIONS_MAX) {
						recentMentions = recentMentions.slice(0, RECENT_MENTIONS_MAX);
					}
				}
			}

			function removeAttachment(filePath) {
				attachedFiles = attachedFiles.filter(function (f) { return f !== filePath; });
				// Also remove @mention text from textarea
				removeMentionTextForFile(filePath);
				updateAttachmentsDisplay();
			}

			function removeMentionTextForFile(filePath) {
				var composer = document.getElementById('user-input');
				if (!composer) return;
				var name = getFileName(filePath);
				var needle = '@' + name;
				// Walk text nodes and remove the mention text
				composer.childNodes.forEach(function (node) {
					if (node.nodeType === Node.TEXT_NODE) {
						var idx = node.textContent.indexOf(needle);
						if (idx >= 0) {
							var end = idx + needle.length;
							if (end < node.textContent.length && node.textContent[end] === ' ') { end++; }
							node.textContent = node.textContent.substring(0, idx) + node.textContent.substring(end);
						}
					}
				});
				updateComposerEmpty(composer);
			}

			function updateAttachmentsDisplay() {
				var container = document.getElementById('input-attachments');
				if (!container) return;

				if (attachedFiles.length === 0) {
					container.style.display = 'none';
					container.innerHTML = '';
					return;
				}

				container.style.display = 'flex';
				container.innerHTML = attachedFiles.map(function (f) {
					var name = getFileName(f);
					var icon = getFileIcon(f);
					var folder = getFileFolder(f);
					var folderHtml = folder ? '<span class="chip-folder">' + escapeHtmlClient(folder) + '/</span>' : '';
					return '<span class="attachment-chip" title="' + escapeHtmlClient(f) + '">' +
						'<span class="chip-icon">' + icon + '</span>' +
						folderHtml +
						'<span class="chip-name">' + escapeHtmlClient(name) + '</span>' +
						'<span class="remove-attachment" data-action="remove-attachment" data-file="' + escapeHtmlClient(f) + '">&times;</span>' +
					'</span>';
				}).join('');
			}

			// --- @-Mention Dropdown ---

			function insertMention(filePath) {
				var composer = document.getElementById('user-input');
				if (!composer) return;

				var fileName = getFileName(filePath);

				// Replace the @query text in the contenteditable with @filename
				if (mentionAtIndex >= 0) {
					var sel = window.getSelection();
					if (sel && sel.rangeCount > 0) {
						var range = sel.getRangeAt(0);
						// Find and replace the @query in the anchor text node
						var anchorNode = sel.anchorNode;
						if (anchorNode && anchorNode.nodeType === Node.TEXT_NODE) {
							var fullText = anchorNode.textContent;
						var atIdx = fullText.lastIndexOf('@', sel.anchorOffset);
						if (atIdx >= 0) {
							anchorNode.textContent =
								fullText.substring(0, atIdx) + '@' + fileName + ' ' +
								fullText.substring(sel.anchorOffset);
							// Move cursor after inserted mention
							var newRange = document.createRange();
							newRange.setStart(anchorNode, atIdx + fileName.length + 2);
							newRange.collapse(true);
							sel.removeAllRanges();
							sel.addRange(newRange);
						}
						}
					}
				}

				addAttachment(filePath);
				hideMentionDropdown();
				updateComposerEmpty(composer);
				composer.focus();
			}

			function hideMentionDropdown() {
				var dropdown = document.getElementById('mention-dropdown');
				if (dropdown) { dropdown.remove(); }
				mentionActive = false;
				mentionSelectedIndex = -1;
				mentionAtIndex = -1;
			}

			function filterAndShowMentions(query) {
				// Filter cached file list with fuzzy matching
				var matches = cachedFileList.filter(function (f) {
					return fuzzyMatch(query, f);
				});

				// Sort by score (best match first)
				matches.sort(function (a, b) {
					return fuzzyScore(query, b) - fuzzyScore(query, a);
				});

				// Limit results
				matches = matches.slice(0, 15);

				// If no query and we have recent mentions, prepend them
				if (!query && recentMentions.length > 0) {
					var recents = recentMentions.filter(function (r) {
						return attachedFiles.indexOf(r) === -1;
					});
					if (recents.length > 0) {
						// Remove recents from matches to avoid duplicates
						matches = matches.filter(function (m) {
							return recents.indexOf(m) === -1;
						});
						matches = recents.concat(matches).slice(0, 15);
					}
				}

				// Filter out already-attached files
				matches = matches.filter(function (f) {
					return attachedFiles.indexOf(f) === -1;
				});

				showMentionDropdown(matches, query);
			}

			function showMentionDropdown(files, query) {
				var existing = document.getElementById('mention-dropdown');
				if (existing) { existing.remove(); }

				if (files.length === 0) {
					mentionActive = false;
					return;
				}

				mentionActive = true;
				mentionSelectedIndex = 0;

				var inputArea = document.querySelector('.input-area');
				if (!inputArea) return;

				// Group files by folder
				var groups = {};
				var groupOrder = [];
				files.forEach(function (f) {
					var folder = getFileFolder(f) || '(root)';
					if (!groups[folder]) {
						groups[folder] = [];
						groupOrder.push(folder);
					}
					groups[folder].push(f);
				});

				var html = '<div id="mention-dropdown" class="mention-dropdown visible">';

				// Show recent section header if applicable
				var isRecentSection = !query && recentMentions.length > 0;
				var itemIndex = 0;

				groupOrder.forEach(function (folder) {
					html += '<div class="mention-group-header">' + escapeHtmlClient(folder) + '</div>';
					groups[folder].forEach(function (f) {
						var name = getFileName(f);
						var icon = getFileIcon(f);
						var isRecent = recentMentions.indexOf(f) >= 0 && isRecentSection;
						var selectedClass = itemIndex === 0 ? ' selected' : '';
						html += '<div class="mention-item' + selectedClass + '" data-file-path="' + escapeHtmlClient(f) + '" data-mention-index="' + itemIndex + '">' +
							'<span class="mention-item-icon">' + icon + '</span>' +
							'<span class="mention-item-name">' + highlightMatch(escapeHtmlClient(name), query) + '</span>' +
							(isRecent ? '<span class="mention-recent-badge">recent</span>' : '') +
						'</div>';
						itemIndex++;
					});
				});

				html += '</div>';

				inputArea.style.position = 'relative';
				inputArea.insertAdjacentHTML('afterbegin', html);

				// Handle clicks on mention items
				var dropdown = document.getElementById('mention-dropdown');
				if (dropdown) {
					dropdown.addEventListener('click', function (e) {
						var item = e.target.closest('.mention-item');
						if (item && item.dataset.filePath) {
							insertMention(item.dataset.filePath);
						}
					});
				}
			}

			function highlightMatch(escapedName, query) {
				if (!query) return escapedName;
				var lowerName = escapedName.toLowerCase();
				var lowerQuery = query.toLowerCase();
				var idx = lowerName.indexOf(lowerQuery);
				if (idx >= 0) {
					return escapedName.substring(0, idx) +
						'<span class="mention-highlight">' + escapedName.substring(idx, idx + query.length) + '</span>' +
						escapedName.substring(idx + query.length);
				}
				return escapedName;
			}

			// --- Keyboard Navigation ---

			function mentionNavigate(direction) {
				var items = document.querySelectorAll('.mention-item');
				if (items.length === 0) return;

				// Remove current selection
				if (mentionSelectedIndex >= 0 && mentionSelectedIndex < items.length) {
					items[mentionSelectedIndex].classList.remove('selected');
				}

				// Move index
				mentionSelectedIndex += direction;
				if (mentionSelectedIndex < 0) mentionSelectedIndex = items.length - 1;
				if (mentionSelectedIndex >= items.length) mentionSelectedIndex = 0;

				// Apply new selection
				items[mentionSelectedIndex].classList.add('selected');
				items[mentionSelectedIndex].scrollIntoView({ block: 'nearest' });
			}

			function mentionConfirmSelection() {
				var items = document.querySelectorAll('.mention-item');
				if (mentionSelectedIndex >= 0 && mentionSelectedIndex < items.length) {
					var item = items[mentionSelectedIndex];
					if (item.dataset.filePath) {
						insertMention(item.dataset.filePath);
					}
				}
			}

			// --- Debounced mention query ---

			function debouncedMentionQuery(query) {
				if (mentionDebounceTimer) {
					clearTimeout(mentionDebounceTimer);
				}
				mentionDebounceTimer = setTimeout(function () {
					// If we have a cached file list, filter client-side
					if (cachedFileList.length > 0) {
						filterAndShowMentions(query);
					} else {
						// Request file list from extension host (first time)
						vscode.postMessage({ type: 'requestMentionSuggestions', query: query || '' });
					}
				}, MENTION_DEBOUNCE_MS);
			}

			// ===== SCROLL & NAVIGATION =====

			function scrollToBottom() {
				var streamArea = document.querySelector('.stream-area');
				if (streamArea) {
					streamArea.scrollTop = streamArea.scrollHeight;
				}
			}

			function scrollToClaim(claimId) {
				var el = document.querySelector('[data-claim-id="' + claimId + '"]');
				if (el) {
					el.scrollIntoView({ behavior: 'smooth', block: 'center' });
					el.style.outline = '2px solid var(--vscode-focusBorder)';
					setTimeout(function () {
						el.style.outline = '';
					}, 2000);
				}
			}

			function scrollToClaimsByStatus(status) {
				var badges = document.querySelectorAll('.verdict-badge.' + status.toLowerCase());
				if (badges.length > 0) {
					var parent = badges[0].closest('.claim-item, .rich-card');
					if (parent) {
						parent.scrollIntoView({ behavior: 'smooth', block: 'center' });
					}
				}
			}

			// ===== SESSION ID =====

			function copySessionId(sessionId) {
				navigator.clipboard.writeText(sessionId).then(function () {
					vscode.postMessage({ type: 'copySessionId', sessionId: sessionId });
				}).catch(function () {
					vscode.postMessage({ type: 'copySessionId', sessionId: sessionId });
				});
			}

			// ===== SETTINGS PANEL =====

			var settingsPanelVisible = false;

			function escapeHtmlClient(str) {
				var div = document.createElement('div');
				div.textContent = str;
				return div.innerHTML;
			}

			function handleShowSettings(data) {
				settingsPanelVisible = data.visible;
				var panel = document.getElementById('settings-panel');
				var streamArea = document.querySelector('.stream-area');
				var inputArea = document.querySelector('.input-area');

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

			function handleKeyStatusUpdate(data) {
				var container = document.getElementById('settings-roles');
				if (!container || !data.roles) return;

				container.innerHTML = data.roles.map(function (role) {
					var statusClass = role.hasKey ? 'set' : 'not-set';
					var statusIcon = role.hasKey ? '&#x2713;' : '&#x2717;';
					var statusText = role.hasKey ? 'Set' : 'Not Set';
					var clearDisabled = role.hasKey ? '' : 'disabled';
					var btnLabel = role.hasKey ? 'Update' : 'Set Key';

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

			function handleSetInputEnabled(data) {
				var composer = document.getElementById('user-input');
				var btn = document.getElementById('submit-btn');
				var wrapper = document.querySelector('.composer-wrapper');
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

			function handleSetProcessing(data) {
				var existing = document.getElementById('processing-indicator');
				if (!data.active) {
					if (existing) { existing.remove(); }
					return;
				}
				var phase = escapeHtmlClient(data.phase || 'Processing');
				var detail = data.detail ? escapeHtmlClient(data.detail) : '';
				var html = '<div id="processing-indicator" class="processing-indicator">' +
					'<div class="processing-spinner"></div>' +
					'<div class="processing-label">' +
						'<div class="processing-phase">' + phase + '<span class="processing-dots"></span></div>' +
						(detail ? '<div class="processing-detail">' + detail + '</div>' : '') +
					'</div>' +
				'</div>';
				if (existing) {
					existing.outerHTML = html;
				} else {
					var streamArea = document.getElementById('stream-content');
					if (streamArea) {
						streamArea.insertAdjacentHTML('beforeend', html);
						scrollToBottom();
					}
				}
			}

			function handleErrorOccurred(data) {
				var streamArea = document.getElementById('stream-content');
				if (streamArea) {
					var html = '<div class="warning-card">' +
						'<div class="warning-header">' +
							'<span>&#x26A0;&#xFE0F;</span> Error: ' + escapeHtmlClient(data.code || 'UNKNOWN') +
						'</div>' +
						'<div class="card-content">' + escapeHtmlClient(data.message || 'An error occurred') + '</div>' +
					'</div>';
					streamArea.insertAdjacentHTML('beforeend', html);
					scrollToBottom();
				}
			}

			// ===== COMMAND BLOCK HANDLING =====

			var CMD_MAX_LINES = 50;
			var cmdBlockLineCounts = {};

			function handleCommandActivity(data) {
				if (!data || !data.commandId) return;
				var blockId = 'cmd-' + data.commandId;
				var existing = document.getElementById(blockId);

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

			function getCommandIcon(commandType) {
				switch (commandType) {
					case 'cli_invocation': return '&#x1F4BB;';
					case 'llm_api_call': return '&#x2728;';
					case 'role_invocation': return '&#x1F916;';
					default: return '&#x2699;';
				}
			}

			function getTypeLabel(commandType) {
				switch (commandType) {
					case 'cli_invocation': return 'CLI';
					case 'llm_api_call': return 'API';
					case 'role_invocation': return 'Role';
					default: return 'CMD';
				}
			}

			function formatTime(isoStr) {
				try {
					// Normalize SQLite datetime format (no T/Z) to ISO 8601 for consistent UTC parsing
					var normalized = isoStr;
					if (isoStr && isoStr.indexOf('T') === -1) {
						normalized = isoStr.replace(' ', 'T') + 'Z';
					}
					var d = new Date(normalized);
					return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
				} catch (e) { return ''; }
			}

			function createCommandBlock(blockId, data) {
				var streamArea = document.getElementById('stream-content');
				if (!streamArea) return;

				// Remove existing if somehow duplicated
				var dup = document.getElementById(blockId);
				if (dup) dup.remove();

				var collapsed = data.collapsed ? '' : ' expanded';
				var icon = getCommandIcon(data.commandType);
				var typeLabel = getTypeLabel(data.commandType);
				var time = data.timestamp ? formatTime(data.timestamp) : '';

				var html = '<div id="' + blockId + '" class="command-block status-running' + collapsed + '" data-command-id="' + escapeHtmlClient(data.commandId) + '">' +
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
				var processingEl = document.getElementById('processing-indicator');
				if (processingEl) {
					processingEl.insertAdjacentHTML('beforebegin', html);
				} else {
					streamArea.insertAdjacentHTML('beforeend', html);
				}
				cmdBlockLineCounts[blockId] = data.summary ? 1 : 0;
				scrollToBottom();
			}

			function appendCommandOutput(blockId, data) {
				var block = document.getElementById(blockId);
				if (!block) {
					// Block not yet created - auto-create it
					createCommandBlock(blockId, data);
					return;
				}

				var output = block.querySelector('.command-block-output');
				if (!output) return;

				// Handle stdin lineType as a collapsible expandable block
				if (data.lineType === 'stdin' && data.detail) {
					var stdinLabel = data.summary || '\u2500\u2500 stdin \u2500\u2500';
					var stdinHtml =
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
					cmdBlockLineCounts[blockId] = (cmdBlockLineCounts[blockId] || 0) + 1;
					scrollToBottom();
					return;
				}

				var lineCount = cmdBlockLineCounts[blockId] || 0;
				var lines = [];

				if (data.summary) {
					lines.push('<span class="cmd-line summary">' + escapeHtmlClient(data.summary) + '</span>');
				}
				if (data.detail) {
					lines.push('<span class="cmd-line detail">' + escapeHtmlClient(data.detail) + '</span>');
				}

				if (lines.length === 0) return;

				var newCount = lineCount + lines.length;

				if (newCount <= CMD_MAX_LINES) {
					output.insertAdjacentHTML('beforeend', lines.join(''));
					cmdBlockLineCounts[blockId] = newCount;
				} else if (lineCount < CMD_MAX_LINES) {
					// Add remaining lines up to limit
					var remaining = CMD_MAX_LINES - lineCount;
					output.insertAdjacentHTML('beforeend', lines.slice(0, remaining).join(''));
					cmdBlockLineCounts[blockId] = CMD_MAX_LINES;
					// Add truncation notice
					var body = block.querySelector('.command-block-body');
					if (body && !body.querySelector('.command-block-truncated')) {
						body.insertAdjacentHTML('beforeend',
							'<div class="command-block-truncated">' +
								'<button data-action="show-more-cmd" data-block-id="' + blockId + '">Show all output</button>' +
							'</div>'
						);
					}
				}
				// else: already truncated, skip

				// Auto-scroll the body to bottom
				var body = block.querySelector('.command-block-body');
				if (body) {
					body.scrollTop = body.scrollHeight;
				}
				scrollToBottom();
			}

			function formatByteSize(len) {
				if (len < 1024) return len + ' chars';
				var kb = (len / 1024).toFixed(1);
				return kb + ' KB';
			}

			function toggleStdinBlock(stdinEl) {
				if (!stdinEl) return;
				if (stdinEl.className.indexOf('expanded') >= 0) {
					stdinEl.className = stdinEl.className.replace(' expanded', '');
				} else {
					stdinEl.className += ' expanded';
				}
			}

			function completeCommandBlock(blockId, data) {
				var block = document.getElementById(blockId);
				if (!block) return;

				block.className = block.className.replace('status-running', 'status-success');
				var statusEl = block.querySelector('.command-block-status');
				if (statusEl) {
					statusEl.className = 'command-block-status success';
					statusEl.innerHTML = '&#x2705;';
				}

				if (data.summary) {
					appendCommandOutput(blockId, data);
				}
			}

			function errorCommandBlock(blockId, data) {
				var block = document.getElementById(blockId);
				if (!block) {
					createCommandBlock(blockId, data);
					block = document.getElementById(blockId);
				}
				if (!block) return;

				block.className = block.className.replace('status-running', 'status-error');
				// Also expand on error so user sees the problem
				if (block.className.indexOf('expanded') === -1) {
					block.className += ' expanded';
				}
				var statusEl = block.querySelector('.command-block-status');
				if (statusEl) {
					statusEl.className = 'command-block-status error';
					statusEl.innerHTML = '&#x274C;';
				}

				var output = block.querySelector('.command-block-output');
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

				// Add retry action bar
				var body = block.querySelector('.command-block-body');
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

			function toggleCommandBlock(blockEl) {
				if (!blockEl) return;
				if (blockEl.className.indexOf('expanded') >= 0) {
					blockEl.className = blockEl.className.replace(' expanded', '');
				} else {
					blockEl.className += ' expanded';
				}
			}

			function showMoreCommandOutput(blockId) {
				var block = document.getElementById(blockId);
				if (!block) return;
				// Remove the truncation limit - allow unlimited lines
				cmdBlockLineCounts[blockId] = 0;
				CMD_MAX_LINES = 99999;
				var truncEl = block.querySelector('.command-block-truncated');
				if (truncEl) truncEl.remove();
			}

			// ===== TOOL CALL CARD HANDLING =====

			var pendingToolCards = {};

			function handleToolCallActivity(data) {
				if (!data || !data.commandId) return;
				var blockId = 'cmd-' + data.commandId;

				if (data.action === 'tool_call') {
					createToolCard(blockId, data);
				} else if (data.action === 'tool_result') {
					completeToolCard(blockId, data);
				}
			}

			function createToolCard(blockId, data) {
				var block = document.getElementById(blockId);
				if (!block) return;
				var output = block.querySelector('.command-block-output');
				if (!output) return;

				var cardId = 'tool-' + (data.toolUseId || Date.now());
				var toolName = escapeHtmlClient(data.toolName || 'Tool');
				var time = data.timestamp ? formatTime(data.timestamp) : '';

				var bodyHtml = buildToolCardBody(data.toolName || 'Tool', data.input || '', '', false);

				var html =
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
					pendingToolCards[data.toolUseId] = cardId;
				}
				scrollToBottom();
			}

			function completeToolCard(blockId, data) {
				var cardId = data.toolUseId ? pendingToolCards[data.toolUseId] : null;
				var card = cardId ? document.getElementById(cardId) : null;

				if (!card) {
					// No matching pending card - create a standalone completed card
					var block = document.getElementById(blockId);
					if (!block) return;
					var output = block.querySelector('.command-block-output');
					if (!output) return;

					var standaloneId = 'tool-' + (data.toolUseId || Date.now());
					var toolName = escapeHtmlClient(data.toolName || 'Tool');
					var time = data.timestamp ? formatTime(data.timestamp) : '';
					var dotClass = data.status === 'error' ? 'error' : 'success';
					var bodyHtml = buildToolCardBody(data.toolName || 'Tool', data.input || '', data.output || '', true);

					var html =
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
				var dot = card.querySelector('.tool-call-dot');
				if (dot) {
					dot.className = 'tool-call-dot ' + (data.status === 'error' ? 'error' : 'success');
				}

				// Rebuild body with output included
				var header = card.querySelector('.tool-call-header');
				var headerHtml = header ? header.outerHTML : '';
				var bodyHtml = buildToolCardBody(data.toolName || 'Tool', data.input || '', data.output || '', true);
				card.innerHTML = headerHtml + bodyHtml;

				if (data.toolUseId) {
					delete pendingToolCards[data.toolUseId];
				}
				scrollToBottom();
			}

			function buildToolCardBody(toolName, input, output, hasOutput) {
				var lowerName = (toolName || '').toLowerCase();
				var html = '';

				// Bash/command_exec: IN + OUT code blocks
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

				// Read/file_read: path inline, output as code block
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

				// Glob: pattern inline, results below
				if (/glob/i.test(lowerName)) {
					if (input) {
						html += '<div class="tool-card-inline">' + escapeHtmlClient(input) + '</div>';
					}
					if (hasOutput && output) {
						html += '<div class="tool-card-results">' + escapeHtmlClient(output) + '</div>';
					}
					return html;
				}

				// Write/Edit: path inline only
				if (/write|edit|create/i.test(lowerName)) {
					if (input) {
						html += '<div class="tool-card-inline">' + escapeHtmlClient(input) + '</div>';
					}
					return html;
				}

				// Generic: IN + OUT code blocks
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

			function toggleSettingsPanel() {
				settingsPanelVisible = !settingsPanelVisible;
				handleShowSettings({ visible: settingsPanelVisible });
				// Notify extension host so _settingsPanelVisible stays in sync
				vscode.postMessage({ type: 'settingsVisibilityChanged', visible: settingsPanelVisible });
			}

			function requestSetKey(role) {
				vscode.postMessage({
					type: 'setApiKey',
					role: role,
				});
			}

			function requestClearKey(role) {
				vscode.postMessage({
					type: 'clearApiKey',
					role: role,
				});
			}

			// ===== EVENT DELEGATION (replaces all inline handlers) =====

			// Click delegation - handles all data-action clicks
			document.addEventListener('click', function (event) {
				var target = event.target;
				// Walk up to find the nearest element with data-action
				// Guard against text nodes and SVG nodes that have no dataset
				while (target && target !== document && !(target.dataset && target.dataset.action)) {
					target = target.parentElement;
				}
				if (!target || !target.dataset || !target.dataset.action) return;

				var action = target.dataset.action;
				switch (action) {
					case 'copy-session':
						copySessionId(target.dataset.sessionId);
						break;
					case 'scroll-to-status':
						scrollToClaimsByStatus(target.dataset.status);
						break;
					case 'gate-decision':
						submitGateDecision(target.dataset.gateId, target.dataset.gateAction);
						break;
					case 'verification-gate-decision':
						handleVerificationGateDecision(target.dataset.gateId, target.dataset.gateAction);
						break;
					case 'review-gate-decision':
						handleReviewGateDecision(target.dataset.gateId, target.dataset.gateAction);
						break;
					case 'toggle-review-group':
						var reviewGroup = target.closest('.review-group');
						if (reviewGroup) { reviewGroup.classList.toggle('collapsed'); }
						break;
					case 'toggle-verification-nonblocking':
						var nbContainer = target.closest('.verification-nonblocking');
						if (nbContainer) { nbContainer.classList.toggle('expanded'); }
						break;
					case 'toggle-settings':
						toggleSettingsPanel();
						break;
					case 'set-key':
						requestSetKey(target.dataset.role);
						break;
					case 'clear-key':
						requestClearKey(target.dataset.role);
						break;
					case 'remove-attachment':
						if (target.dataset.file) {
							removeAttachment(target.dataset.file);
						}
						break;
					case 'toggle-card':
						var collapsibleCard = target.closest('.collapsible-card');
						if (collapsibleCard) { collapsibleCard.classList.toggle('expanded'); }
						break;
					case 'toggle-command':
						var cmdBlock = target.closest('.command-block');
						toggleCommandBlock(cmdBlock);
						break;
					case 'toggle-stdin':
						var stdinBlock = target.closest('.cmd-stdin-block');
						toggleStdinBlock(stdinBlock);
						break;
					case 'show-more-cmd':
						if (target.dataset.blockId) {
							showMoreCommandOutput(target.dataset.blockId);
						}
						break;
					case 'intake-submit-responses':
						handleIntakeSubmitResponses();
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
					case 'toggle-intake-plan':
						var planCard = target.closest('.intake-plan-preview');
						if (planCard) {
							planCard.classList.toggle('expanded');
							var chevron = planCard.querySelector('.intake-plan-chevron');
							if (chevron) {
								chevron.innerHTML = planCard.classList.contains('expanded') ? '&#x25BC;' : '&#x25B6;';
							}
						}
						break;
					case 'retry-phase':
						vscode.postMessage({ type: 'retryPhase' });
						target.disabled = true;
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
							var switcherDd = document.getElementById('switcher-dropdown');
							if (switcherDd) { switcherDd.classList.remove('visible'); }
						}
						break;
					case 'scroll-to-dialogue':
						if (target.dataset.dialogueId) {
							var dialogueEl = document.getElementById('dialogue-' + target.dataset.dialogueId);
							if (dialogueEl) {
								dialogueEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
								dialogueEl.classList.add('scroll-highlight');
								setTimeout(function () { dialogueEl.classList.remove('scroll-highlight'); }, 2000);
							}
						}
						break;
					case 'toggle-switcher':
						var dd = document.getElementById('switcher-dropdown');
						if (dd) { dd.classList.toggle('visible'); }
						break;
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
							kind: target.dataset.optionKind,
							gateId: target.dataset.gateId || null,
						});
						// Disable all chips in the group and highlight the selected one
						var chipsCard = target.closest('.command-options-card');
						if (chipsCard) {
							chipsCard.querySelectorAll('.command-option-chip').forEach(function (btn) {
								btn.disabled = true;
							});
							target.classList.add('was-selected');
						}
						break;
				}
			});

			// Click-outside handler to dismiss switcher dropdown
			document.addEventListener('click', function (event) {
				var switcher = document.querySelector('.dialogue-switcher');
				var dd = document.getElementById('switcher-dropdown');
				if (dd && dd.classList.contains('visible') && switcher && !switcher.contains(event.target)) {
					dd.classList.remove('visible');
				}
			}, true);

			// Attach file button - asks extension host to show file picker
			var attachBtn = document.getElementById('attach-file-btn');
			if (attachBtn) {
				attachBtn.addEventListener('click', function () {
					vscode.postMessage({ type: 'pickFile' });
				});
			}

			// Listen for messages from extension host (file list, file attached)
			window.addEventListener('message', function (event) {
				var msg = event.data;
				if (msg.type === 'mentionSuggestions') {
					cachedFileList = msg.files || [];
					if (mentionActive && mentionAtIndex >= 0) {
						filterAndShowMentions(getMentionQueryAtCursor());
					}
				}
				if (msg.type === 'fileAttached') {
					addAttachment(msg.filePath);
				}
			});

			// Get the current @-mention query from cursor position in contenteditable
			function getMentionQueryAtCursor() {
				var sel = window.getSelection();
				if (!sel || sel.rangeCount === 0) return '';
				var node = sel.anchorNode;
				if (!node || node.nodeType !== Node.TEXT_NODE) return '';
				var textBefore = node.textContent.substring(0, sel.anchorOffset);
				var atMatch = textBefore.match(/@([^\\s]*)$/);
				return atMatch ? atMatch[1] : '';
			}

			// Input delegation - handles gate rationale textareas and composer @-mention
			document.addEventListener('input', function (event) {
				var target = event.target;
				if (target.dataset && target.dataset.gateRationale) {
					handleRationaleInput(target.dataset.gateRationale, target.value);
				}
				if (target.dataset && target.dataset.claimRationale) {
					handleClaimRationaleInput(target.dataset.claimRationale, target.value);
				}
				if (target.dataset && target.dataset.reviewItemRationale) {
					handleReviewItemRationaleInput(target.dataset.reviewItemRationale, target.value);
				}
				if (target.dataset && target.dataset.reviewOverallRationale) {
					handleReviewOverallInput(target.dataset.reviewOverallRationale, target.value);
				}
				if (target.dataset && target.dataset.intakeQuestionId && target.classList.contains('intake-question-textarea')) {
					handleIntakeQuestionInput(target.dataset.intakeQuestionId, target.value);
				}
				if (target.id === 'user-input') {
					updateComposerEmpty(target);
					// Detect @ trigger for mentions
					var query = getMentionQueryAtCursor();
					var sel = window.getSelection();
					if (sel && sel.rangeCount > 0) {
						var node = sel.anchorNode;
						if (node && node.nodeType === Node.TEXT_NODE) {
							var textBefore = node.textContent.substring(0, sel.anchorOffset);
							if (textBefore.match(/@([^\\s]*)$/)) {
								mentionAtIndex = textBefore.lastIndexOf('@');
								debouncedMentionQuery(query);
								return;
							}
						}
					}
					hideMentionDropdown();
				}
			});

			// Keydown delegation — Enter to send clarification in Ask More mode
			document.addEventListener('keydown', function (event) {
				var target = event.target;
				if (!target || !target.tagName) return;
				// In Ask More mode, Enter (without Shift) in the textarea sends the question
				if (target.tagName === 'TEXTAREA' && event.key === 'Enter' && !event.shiftKey) {
					var responseArea = target.closest('[data-clarification-item]');
					if (responseArea) {
						var itemId = responseArea.dataset.clarificationItem;
						if (itemId && clarificationMode[itemId] === 'askmore') {
							event.preventDefault();
							handleClarificationSend(itemId);
						}
					}
				}
			});

			// Direct listeners for the composer contenteditable
			var userInput = document.getElementById('user-input');
			if (userInput) {
				// Paste: strip HTML, insert plain text only via Selection API
				userInput.addEventListener('paste', function (event) {
					event.preventDefault();
					var text = event.clipboardData ? event.clipboardData.getData('text/plain') : '';
					if (!text) return;
					var sel = window.getSelection();
					if (!sel || sel.rangeCount === 0) return;
					var range = sel.getRangeAt(0);
					range.deleteContents();
					var node = document.createTextNode(text);
					range.insertNode(node);
					range.setStartAfter(node);
					range.collapse(true);
					sel.removeAllRanges();
					sel.addRange(range);
					updateComposerEmpty(userInput);
				});

				userInput.addEventListener('keydown', function (event) {
					// Keyboard navigation when mention dropdown is active
					if (mentionActive) {
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
					// Enter = submit, Shift+Enter = newline
					if (event.key === 'Enter' && !event.shiftKey) {
						event.preventDefault();
						submitInput();
						return;
					}
					if (event.key === 'Enter' && event.shiftKey) {
						event.preventDefault();
						var sel2 = window.getSelection();
						if (sel2 && sel2.rangeCount > 0) {
							var range2 = sel2.getRangeAt(0);
							range2.deleteContents();
							var br = document.createElement('br');
							range2.insertNode(br);
							range2.setStartAfter(br);
							range2.collapse(true);
							sel2.removeAllRanges();
							sel2.addRange(range2);
							updateComposerEmpty(userInput);
						}
					}
				});

				// Dismiss mention dropdown on blur (with delay for click handling)
				userInput.addEventListener('blur', function () {
					setTimeout(function () {
						var active = document.activeElement;
						var dropdown = document.getElementById('mention-dropdown');
						if (dropdown && dropdown.contains(active)) return;
						hideMentionDropdown();
					}, 200);
				});
			}

			var submitBtn = document.getElementById('submit-btn');
			if (submitBtn) {
				submitBtn.addEventListener('click', function () {
					submitInput();
				});
			}

			// ===== INITIAL SCROLL =====
			setTimeout(scrollToBottom, 100);
		})();
	`;
}
