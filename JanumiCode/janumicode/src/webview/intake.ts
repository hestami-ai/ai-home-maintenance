/**
 * Intake question response handlers for the Governed Stream webview.
 * Manages the intake phase where users respond to clarifying questions.
 */

import { vscode } from './types';
import { state, persistDrafts } from './state';

export function handleIntakeQuestionInput(questionId: string, text: string): void {
	state.intakeQuestionResponses[questionId] = text;
	persistDrafts();
	const charCount = document.querySelector('[data-charcount-for="' + questionId + '"]');
	if (charCount) {
		charCount.textContent = text.length + ' chars';
	}
	updateIntakeSubmitBar();
}

export function updateIntakeSubmitBar(): void {
	const bar = document.getElementById('intake-questions-submit-bar');
	const btn = document.getElementById('intake-submit-btn') as HTMLButtonElement | null;
	const countEl = document.getElementById('intake-submit-count');
	if (!bar) { return; }

	let count = 0;
	const keys = Object.keys(state.intakeQuestionResponses);
	for (let k = 0; k < keys.length; k++) {
		if (state.intakeQuestionResponses[keys[k]].trim().length > 0) {
			count++;
		}
	}

	if (count > 0) {
		bar.style.display = 'flex';
		if (btn) { btn.disabled = false; }
		if (countEl) { countEl.textContent = count + (count === 1 ? ' response' : ' responses'); }
	} else {
		bar.style.display = 'none';
		if (btn) { btn.disabled = true; }
		if (countEl) { countEl.textContent = '0 responses'; }
	}
}

export function handleIntakeSubmitResponses(): void {
	const parts: string[] = [];
	const keys = Object.keys(state.intakeQuestionResponses);
	for (let k = 0; k < keys.length; k++) {
		const id = keys[k];
		const text = state.intakeQuestionResponses[id].trim();
		if (text) {
			const textarea = document.querySelector('.intake-question-textarea[data-intake-question-id="' + id + '"]') as HTMLTextAreaElement | null;
			const questionText = textarea ? (textarea.dataset.intakeQuestionText || '') : '';
			if (questionText) {
				parts.push('[Re: ' + id + ': "' + questionText + '"] ' + text);
			} else {
				parts.push('[Re: ' + id + '] ' + text);
			}
		}
	}
	if (parts.length === 0) { return; }

	const finalText = parts.join('\n');
	vscode.postMessage({
		type: 'submitInput',
		text: finalText,
		attachments: [],
	});

	// Show pending state — don't freeze or clear yet (wait for host ack)
	const btn = document.getElementById('intake-submit-btn') as HTMLButtonElement | null;
	if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }
}

/** Host accepted the intake submit — freeze UI and clear drafts. */
export function handleIntakeSubmitAccepted(): void {
	state.intakeQuestionResponses = {};
	vscode.postMessage({ type: 'draftClear', category: 'intake_response' });

	const textareas = document.querySelectorAll('.intake-question-textarea') as NodeListOf<HTMLTextAreaElement>;
	textareas.forEach(function (ta) {
		ta.readOnly = true;
		ta.classList.add('submitted');
	});

	const bar = document.getElementById('intake-questions-submit-bar');
	const submitBtn = document.getElementById('intake-submit-btn') as HTMLButtonElement | null;
	const countEl = document.getElementById('intake-submit-count');
	if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitted'; }
	if (countEl) { countEl.textContent = 'Responses submitted'; }
	if (bar) { bar.classList.add('submitted'); }

	const askMoreBtns = document.querySelectorAll('.ask-more-toggle') as NodeListOf<HTMLButtonElement>;
	askMoreBtns.forEach(function (b) { b.disabled = true; });
}

/** Host rejected the intake submit — restore button. */
export function handleIntakeSubmitRejected(reason: string): void {
	console.warn('[Intake:SubmitRejected]', reason);
	const btn = document.getElementById('intake-submit-btn') as HTMLButtonElement | null;
	if (btn) { btn.disabled = false; btn.textContent = 'Submit Responses'; }
}

export function disableIntakeApprovalButtons(clickedBtn: HTMLElement): void {
	const container = clickedBtn.closest('.intake-approval-actions');
	if (!container) { return; }
	const buttons = container.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
	buttons.forEach(function (btn) { btn.disabled = true; });
	clickedBtn.classList.add('was-selected');
}

export function handleIntakeModeSelection(target: HTMLElement): void {
	const mode = target.dataset.intakeMode;
	if (!mode) { return; }

	// Disable all mode buttons and mark selected
	const container = target.closest('.intake-mode-options');
	if (container) {
		const buttons = container.querySelectorAll('.intake-mode-btn') as NodeListOf<HTMLButtonElement>;
		buttons.forEach(function (btn) { btn.disabled = true; });
		target.classList.add('was-selected');
	}

	vscode.postMessage({ type: 'intakeModeSelected', mode });
}

export function handleIntakeAskDomain(target: HTMLElement): void {
	const domainLabel = target.dataset.domainLabel;
	if (!domainLabel) { return; }

	// Disable the clicked button
	(target as HTMLButtonElement).disabled = true;
	target.classList.add('was-selected');

	vscode.postMessage({
		type: 'submitInput',
		text: 'Tell me about ' + domainLabel + ' considerations for this project.',
		attachments: [],
	});
}
