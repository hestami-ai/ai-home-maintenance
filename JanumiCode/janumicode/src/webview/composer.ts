/**
 * Composer/input area handlers for the Governed Stream webview.
 * Manages the text input, @-mention dropdown, file attachments,
 * and message submission.
 */

import { vscode } from './types';
import { state, RECENT_MENTIONS_MAX, MENTION_DEBOUNCE_MS } from './state';
import { escapeHtmlClient, getFileIcon, getFileName, getFileFolder, fuzzyMatch, fuzzyScore, highlightMatch } from './utils';

// ===== Composer Serialization =====

export function serializeComposer(): { text: string } {
	const composer = document.getElementById('user-input');
	if (!composer) { return { text: '' }; }

	let text = '';

	composer.childNodes.forEach(function (node) {
		if (node.nodeType === Node.TEXT_NODE) {
			text += node.textContent;
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			if (node.nodeName === 'BR') {
				text += '\n';
			} else {
				text += node.textContent;
			}
		}
	});

	return { text: text.trim() };
}

export function clearComposer(): void {
	const composer = document.getElementById('user-input');
	if (composer) {
		composer.innerHTML = '';
		updateComposerEmpty(composer);
	}
}

export function composerIsEmpty(): boolean {
	const composer = document.getElementById('user-input');
	if (!composer) { return true; }
	return composer.textContent!.trim() === '';
}

export function updateComposerEmpty(composer: HTMLElement): void {
	if (!composer) { return; }
	const isEmpty = composer.textContent!.trim() === '';
	composer.dataset.empty = isEmpty ? 'true' : 'false';
}

// ===== Submit =====

export function submitInput(): void {
	const result = serializeComposer();
	if (!result.text && state.attachedFiles.length === 0) { return; }

	vscode.postMessage({
		type: 'submitInput',
		text: result.text,
		attachments: state.attachedFiles.slice(),
	});

	clearComposer();
	state.attachedFiles = [];
	updateAttachmentsDisplay();
	hideMentionDropdown();
}

// ===== Attachment Model =====

export function addAttachment(filePath: string): void {
	if (state.attachedFiles.indexOf(filePath) === -1) {
		state.attachedFiles.push(filePath);
		updateAttachmentsDisplay();
		// Track in recent mentions
		state.recentMentions = state.recentMentions.filter(function (f) { return f !== filePath; });
		state.recentMentions.unshift(filePath);
		if (state.recentMentions.length > RECENT_MENTIONS_MAX) {
			state.recentMentions = state.recentMentions.slice(0, RECENT_MENTIONS_MAX);
		}
	}
}

export function removeAttachment(filePath: string): void {
	state.attachedFiles = state.attachedFiles.filter(function (f) { return f !== filePath; });
	removeMentionTextForFile(filePath);
	updateAttachmentsDisplay();
}

export function removeMentionTextForFile(filePath: string): void {
	const composer = document.getElementById('user-input');
	if (!composer) { return; }
	const name = getFileName(filePath);
	const needle = '@' + name;
	composer.childNodes.forEach(function (node) {
		if (node.nodeType === Node.TEXT_NODE) {
			const idx = node.textContent!.indexOf(needle);
			if (idx >= 0) {
				let end = idx + needle.length;
				if (end < node.textContent!.length && node.textContent![end] === ' ') { end++; }
				node.textContent = node.textContent!.substring(0, idx) + node.textContent!.substring(end);
			}
		}
	});
	updateComposerEmpty(composer);
}

export function updateAttachmentsDisplay(): void {
	const container = document.getElementById('input-attachments');
	if (!container) { return; }

	if (state.attachedFiles.length === 0) {
		container.style.display = 'none';
		container.innerHTML = '';
		return;
	}

	container.style.display = 'flex';
	container.innerHTML = state.attachedFiles.map(function (f) {
		const name = getFileName(f);
		const icon = getFileIcon(f);
		const folder = getFileFolder(f);
		const folderHtml = folder ? '<span class="chip-folder">' + escapeHtmlClient(folder) + '/</span>' : '';
		return '<span class="attachment-chip" title="' + escapeHtmlClient(f) + '">' +
			'<span class="chip-icon">' + icon + '</span>' +
			folderHtml +
			'<span class="chip-name">' + escapeHtmlClient(name) + '</span>' +
			'<span class="remove-attachment" data-action="remove-attachment" data-file="' + escapeHtmlClient(f) + '">&times;</span>' +
		'</span>';
	}).join('');
}

// ===== @-Mention Dropdown =====

export function insertMention(filePath: string): void {
	const composer = document.getElementById('user-input');
	if (!composer) { return; }

	const fileName = getFileName(filePath);

	// Replace the @query text in the contenteditable with @filename
	if (state.mentionAtIndex >= 0) {
		const sel = window.getSelection();
		if (sel && sel.rangeCount > 0) {
			const anchorNode = sel.anchorNode;
			if (anchorNode && anchorNode.nodeType === Node.TEXT_NODE) {
				const fullText = anchorNode.textContent!;
				const atIdx = fullText.lastIndexOf('@', sel.anchorOffset);
				if (atIdx >= 0) {
					anchorNode.textContent =
						fullText.substring(0, atIdx) + '@' + fileName + ' ' +
						fullText.substring(sel.anchorOffset);
					// Move cursor after inserted mention
					const newRange = document.createRange();
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

export function hideMentionDropdown(): void {
	const dropdown = document.getElementById('mention-dropdown');
	if (dropdown) { dropdown.remove(); }
	state.mentionActive = false;
	state.mentionSelectedIndex = -1;
	state.mentionAtIndex = -1;
}

export function filterAndShowMentions(query: string): void {
	// Filter cached file list with fuzzy matching
	let matches = state.cachedFileList.filter(function (f) {
		return fuzzyMatch(query, f);
	});

	// Sort by score (best match first)
	matches.sort(function (a, b) {
		return fuzzyScore(query, b) - fuzzyScore(query, a);
	});

	// Limit results
	matches = matches.slice(0, 15);

	// If no query and we have recent mentions, prepend them
	if (!query && state.recentMentions.length > 0) {
		let recents = state.recentMentions.filter(function (r) {
			return state.attachedFiles.indexOf(r) === -1;
		});
		if (recents.length > 0) {
			matches = matches.filter(function (m) {
				return recents.indexOf(m) === -1;
			});
			matches = recents.concat(matches).slice(0, 15);
		}
	}

	// Filter out already-attached files
	matches = matches.filter(function (f) {
		return state.attachedFiles.indexOf(f) === -1;
	});

	showMentionDropdown(matches, query);
}

export function showMentionDropdown(files: string[], query: string): void {
	const existing = document.getElementById('mention-dropdown');
	if (existing) { existing.remove(); }

	if (files.length === 0) {
		state.mentionActive = false;
		return;
	}

	state.mentionActive = true;
	state.mentionSelectedIndex = 0;

	const inputArea = document.querySelector('.input-area') as HTMLElement | null;
	if (!inputArea) { return; }

	// Group files by folder
	const groups: Record<string, string[]> = {};
	const groupOrder: string[] = [];
	files.forEach(function (f) {
		const folder = getFileFolder(f) || '(root)';
		if (!groups[folder]) {
			groups[folder] = [];
			groupOrder.push(folder);
		}
		groups[folder].push(f);
	});

	let html = '<div id="mention-dropdown" class="mention-dropdown visible">';

	const isRecentSection = !query && state.recentMentions.length > 0;
	let itemIndex = 0;

	groupOrder.forEach(function (folder) {
		html += '<div class="mention-group-header">' + escapeHtmlClient(folder) + '</div>';
		groups[folder].forEach(function (f) {
			const name = getFileName(f);
			const icon = getFileIcon(f);
			const isRecent = state.recentMentions.indexOf(f) >= 0 && isRecentSection;
			const selectedClass = itemIndex === 0 ? ' selected' : '';
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
	const dropdown = document.getElementById('mention-dropdown');
	if (dropdown) {
		dropdown.addEventListener('click', function (e) {
			const item = (e.target as HTMLElement).closest('.mention-item') as HTMLElement | null;
			if (item && item.dataset.filePath) {
				insertMention(item.dataset.filePath);
			}
		});
	}
}

// ===== Keyboard Navigation =====

export function mentionNavigate(direction: number): void {
	const items = document.querySelectorAll('.mention-item');
	if (items.length === 0) { return; }

	if (state.mentionSelectedIndex >= 0 && state.mentionSelectedIndex < items.length) {
		items[state.mentionSelectedIndex].classList.remove('selected');
	}

	state.mentionSelectedIndex += direction;
	if (state.mentionSelectedIndex < 0) { state.mentionSelectedIndex = items.length - 1; }
	if (state.mentionSelectedIndex >= items.length) { state.mentionSelectedIndex = 0; }

	items[state.mentionSelectedIndex].classList.add('selected');
	items[state.mentionSelectedIndex].scrollIntoView({ block: 'nearest' });
}

export function mentionConfirmSelection(): void {
	const items = document.querySelectorAll('.mention-item');
	if (state.mentionSelectedIndex >= 0 && state.mentionSelectedIndex < items.length) {
		const item = items[state.mentionSelectedIndex] as HTMLElement;
		if (item.dataset.filePath) {
			insertMention(item.dataset.filePath);
		}
	}
}

// ===== Debounced Mention Query =====

export function debouncedMentionQuery(query: string): void {
	if (state.mentionDebounceTimer) {
		clearTimeout(state.mentionDebounceTimer);
	}
	state.mentionDebounceTimer = setTimeout(function () {
		if (state.cachedFileList.length > 0) {
			filterAndShowMentions(query);
		} else {
			vscode.postMessage({ type: 'requestMentionSuggestions', query: query || '' });
		}
	}, MENTION_DEBOUNCE_MS);
}

export function getMentionQueryAtCursor(): string {
	const sel = window.getSelection();
	if (!sel || sel.rangeCount === 0) { return ''; }
	const node = sel.anchorNode;
	if (!node || node.nodeType !== Node.TEXT_NODE) { return ''; }
	const textBefore = node.textContent!.substring(0, sel.anchorOffset);
	const atMatch = textBefore.match(/@([^\s]*)$/);
	return atMatch ? atMatch[1] : '';
}
