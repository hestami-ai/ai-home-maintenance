/**
 * Speech-to-Text Webview Module
 *
 * Handles mic button interactions, visual state updates, and text insertion
 * for the speech-to-text feature. Audio recording and transcription happen
 * in the extension host — this module manages the UI side.
 */

import { vscode } from './types';
import { state } from './state';
import { scrollToBottom } from './utils';

// ==================== CLICK HANDLER ====================

/**
 * Called when a mic button with data-action="toggle-speech" is clicked.
 */
export function handleSpeechToggle(targetInputId: string): void {
	if (state.speechRecordingTarget === targetInputId) {
		// Currently recording for this target — stop
		vscode.postMessage({ type: 'speechStop' });
	} else if (state.speechRecordingTarget) {
		// Already recording for a different target — ignore (one at a time)
		return;
	} else {
		// Not recording — start
		vscode.postMessage({ type: 'speechStart', targetInputId });
	}
}

// ==================== INCOMING MESSAGE HANDLERS ====================

export function handleSpeechRecordingStarted(targetInputId: string): void {
	state.speechRecordingTarget = targetInputId;
	updateMicButtonState(targetInputId, 'recording');
}

export function handleSpeechTranscribing(targetInputId: string): void {
	updateMicButtonState(targetInputId, 'transcribing');
}

export function handleSpeechResult(targetInputId: string, text: string): void {
	state.speechRecordingTarget = null;
	updateMicButtonState(targetInputId, 'idle');
	insertTextIntoTarget(targetInputId, text);
}

export function handleSpeechError(targetInputId: string, error: string): void {
	state.speechRecordingTarget = null;
	updateMicButtonState(targetInputId, 'idle');
	showSpeechError(targetInputId, error);
}

export function handleSpeechCapability(enabled: boolean, soxAvailable: boolean): void {
	state.speechEnabled = enabled;
	state.soxAvailable = soxAvailable;

	const disabledTitle = 'Speech-to-text requires SoX. Install the SoX "rec" command to enable.';

	document.querySelectorAll<HTMLButtonElement>('.mic-btn').forEach((btn) => {
		btn.style.display = enabled ? '' : 'none';
		if (enabled) {
			btn.disabled = !soxAvailable;
			btn.title = soxAvailable ? 'Click to record voice input' : disabledTitle;
		}
	});
}

// ==================== PRIVATE: UI STATE ====================

function updateMicButtonState(
	targetInputId: string,
	newState: 'idle' | 'recording' | 'transcribing',
): void {
	const btn = document.querySelector<HTMLElement>(
		`.mic-btn[data-speech-target="${targetInputId}"]`,
	);
	if (!btn) { return; }

	btn.classList.remove('recording', 'transcribing');

	if (newState === 'recording') {
		btn.classList.add('recording');
		btn.title = 'Click to stop recording';
	} else if (newState === 'transcribing') {
		btn.classList.add('transcribing');
		btn.title = 'Transcribing...';
	} else {
		btn.title = 'Click to record voice input';
	}
}

function showSpeechError(targetInputId: string, error: string): void {
	const btn = document.querySelector<HTMLElement>(
		`.mic-btn[data-speech-target="${targetInputId}"]`,
	);
	if (!btn) { return; }

	btn.title = `Error: ${error}`;
	btn.classList.add('speech-error');
	setTimeout(() => {
		btn.classList.remove('speech-error');
		btn.title = 'Click to record voice input';
	}, 4000);
}

// ==================== PRIVATE: TEXT INSERTION ====================

function insertTextIntoTarget(targetInputId: string, text: string): void {
	if (targetInputId === 'user-input') {
		insertIntoComposer(text);
	} else {
		insertIntoTextarea(targetInputId, text);
	}
}

/**
 * Insert text into the main composer (contenteditable div).
 */
function insertIntoComposer(text: string): void {
	const composer = document.getElementById('user-input');
	if (!composer) { return; }

	const existing = composer.textContent?.trim() || '';
	if (existing) {
		composer.textContent = existing + ' ' + text;
	} else {
		composer.textContent = text;
	}
	composer.dataset.empty = 'false';

	// Place cursor at end
	const range = document.createRange();
	range.selectNodeContents(composer);
	range.collapse(false);
	const sel = window.getSelection();
	if (sel) {
		sel.removeAllRanges();
		sel.addRange(range);
	}

	scrollToBottom();
}

/**
 * Insert text into a textarea identified by data attributes.
 * targetInputId format: "attrName:attrValue" e.g. "gate-rationale:GATE-123"
 */
function insertIntoTextarea(targetInputId: string, text: string): void {
	const colonIdx = targetInputId.indexOf(':');
	if (colonIdx === -1) { return; }

	const attrName = targetInputId.substring(0, colonIdx);
	const attrValue = targetInputId.substring(colonIdx + 1);

	const textarea = document.querySelector<HTMLTextAreaElement>(
		`textarea[data-${attrName}="${attrValue}"]`,
	);
	if (!textarea) { return; }

	const existing = textarea.value.trim();
	textarea.value = existing ? existing + ' ' + text : text;

	// Dispatch input event to trigger charcount updates and button enables
	textarea.dispatchEvent(new Event('input', { bubbles: true }));
	textarea.focus();
}
