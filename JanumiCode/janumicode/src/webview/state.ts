/**
 * Shared mutable state for the Governed Stream webview.
 * Centralized here so all modules can read and write state
 * without circular dependency issues.
 */

// ===== Constants =====

export const FILE_ICONS: Record<string, string> = {
	md: '&#x1F4DD;', txt: '&#x1F4DD;', rst: '&#x1F4DD;',
	ts: '&#x1F7E6;', tsx: '&#x1F7E6;', js: '&#x1F7E8;', jsx: '&#x1F7E8;',
	json: '&#x1F4CB;', yaml: '&#x1F4CB;', yml: '&#x1F4CB;',
	py: '&#x1F40D;', rs: '&#x2699;', go: '&#x1F7E6;', java: '&#x2615;',
	css: '&#x1F3A8;', html: '&#x1F310;', sql: '&#x1F5C4;',
};

export const RECENT_MENTIONS_MAX = 5;
export const MENTION_DEBOUNCE_MS = 150;

// ===== Mutable State =====

export const state = {
	// Gate decision state
	gateRationales: {} as Record<string, string>,

	// Verification gate state
	verificationClaimRationales: {} as Record<string, string>,

	// Review gate state
	reviewItemRationales: {} as Record<string, string>,
	reviewOverallRationale: '',

	// Intake question state
	intakeQuestionResponses: {} as Record<string, string>,

	// Clarification thread state
	savedResponseText: {} as Record<string, string>,
	clarificationMode: {} as Record<string, string>,
	clarificationConversations: {} as Record<string, Array<{ role: string; content: string }>>,
	clarificationPending: {} as Record<string, boolean>,

	// File attachment/mention state
	attachedFiles: [] as string[],
	recentMentions: [] as string[],
	cachedFileList: [] as string[],

	// Mention UI state
	mentionSelectedIndex: -1,
	mentionDebounceTimer: null as ReturnType<typeof setTimeout> | null,
	mentionActive: false,
	mentionAtIndex: -1,

	// MMP (Mirror & Menu Protocol) state
	mmpMirrorDecisions: {} as Record<string, { status: string; editedText?: string }>,
	mmpMenuSelections: {} as Record<string, { selectedOptionId: string; customResponse?: string }>,
	mmpPreMortemDecisions: {} as Record<string, { status: string; rationale?: string }>,

	// Command block state
	cmdBlockLineCounts: {} as Record<string, number>,
	cmdMaxLines: 50,
	pendingToolCards: {} as Record<string, string>,

	// Settings state
	settingsPanelVisible: false,

	// Speech-to-text state
	speechRecordingTarget: null as string | null,
	speechEnabled: false,
	soxAvailable: false,
};

// ===== MMP State Persistence =====
// Survives webview re-renders and extension restarts within the same VS Code session.

import { vscode } from './types';

interface PersistedMmpState {
	mmpMirrorDecisions: typeof state.mmpMirrorDecisions;
	mmpMenuSelections: typeof state.mmpMenuSelections;
	mmpPreMortemDecisions: typeof state.mmpPreMortemDecisions;
}

/**
 * Save current MMP decisions to both VS Code webview state (survives re-renders)
 * and SQLite via the extension host (survives VS Code restarts).
 * @param cardId When provided, also posts mmpPartialSave to the extension host for durable persistence.
 */
export function persistMmpState(cardId?: string): void {
	// In-session persistence (webview state API)
	const existing = (vscode.getState() as Record<string, unknown>) || {};
	vscode.setState({
		...existing,
		mmpMirrorDecisions: state.mmpMirrorDecisions,
		mmpMenuSelections: state.mmpMenuSelections,
		mmpPreMortemDecisions: state.mmpPreMortemDecisions,
	});

	// Durable persistence (SQLite via extension host)
	if (cardId) {
		const prefix = cardId + ':';
		const mirrorDecisions: Record<string, { status: string; editedText?: string }> = {};
		const menuSelections: Record<string, { selectedOptionId: string; customResponse?: string }> = {};
		const preMortemDecisions: Record<string, { status: string; rationale?: string }> = {};

		for (const [key, val] of Object.entries(state.mmpMirrorDecisions)) {
			if (key.startsWith(prefix)) { mirrorDecisions[key] = val; }
		}
		for (const [key, val] of Object.entries(state.mmpMenuSelections)) {
			if (key.startsWith(prefix)) { menuSelections[key] = val; }
		}
		for (const [key, val] of Object.entries(state.mmpPreMortemDecisions)) {
			if (key.startsWith(prefix)) { preMortemDecisions[key] = val; }
		}

		vscode.postMessage({
			type: 'mmpPartialSave',
			cardId,
			mirrorDecisions,
			menuSelections,
			preMortemDecisions,
		});
	}
}

/** Restore MMP decisions from VS Code webview state. Call on script initialization. */
export function restoreMmpState(): void {
	const saved = vscode.getState() as PersistedMmpState | null;
	if (!saved) {return;}
	if (saved.mmpMirrorDecisions && typeof saved.mmpMirrorDecisions === 'object') {
		Object.assign(state.mmpMirrorDecisions, saved.mmpMirrorDecisions);
	}
	if (saved.mmpMenuSelections && typeof saved.mmpMenuSelections === 'object') {
		Object.assign(state.mmpMenuSelections, saved.mmpMenuSelections);
	}
	if (saved.mmpPreMortemDecisions && typeof saved.mmpPreMortemDecisions === 'object') {
		Object.assign(state.mmpPreMortemDecisions, saved.mmpPreMortemDecisions);
	}
}

// ===== User Input Draft Persistence (SQLite-backed) =====
// Survives webview re-renders, extension host restarts, and full VS Code restarts.
// Round-trip: webview → postMessage('draftSave') → host → SQLite upsert
//             host → postMessage('draftsLoaded') → webview → state + DOM

let _draftTimer: ReturnType<typeof setTimeout> | null = null;

/** Draft category constants matching the SQLite `webview_drafts.category` column. */
export const DRAFT_CATEGORY = {
	GATE_RATIONALE: 'gate_rationale',
	VERIFICATION_RATIONALE: 'verification_rationale',
	REVIEW_ITEM_RATIONALE: 'review_item_rationale',
	REVIEW_OVERALL: 'review_overall',
	INTAKE_RESPONSE: 'intake_response',
	ATTACHMENT: 'attachment',
	SAVED_RESPONSE: 'saved_response',
} as const;

/**
 * Persist all current user input drafts to SQLite via the extension host (debounced).
 * Call after any user input change (gate rationale, intake response, etc.).
 */
export function persistDrafts(): void {
	if (_draftTimer) {clearTimeout(_draftTimer);}
	_draftTimer = setTimeout(() => {
		const drafts: Array<{ category: string; itemKey: string; value: string }> = [];

		for (const [k, v] of Object.entries(state.gateRationales)) {
			if (v) {drafts.push({ category: DRAFT_CATEGORY.GATE_RATIONALE, itemKey: k, value: v });}
		}
		for (const [k, v] of Object.entries(state.verificationClaimRationales)) {
			if (v) {drafts.push({ category: DRAFT_CATEGORY.VERIFICATION_RATIONALE, itemKey: k, value: v });}
		}
		for (const [k, v] of Object.entries(state.reviewItemRationales)) {
			if (v) {drafts.push({ category: DRAFT_CATEGORY.REVIEW_ITEM_RATIONALE, itemKey: k, value: v });}
		}
		if (state.reviewOverallRationale) {
			drafts.push({ category: DRAFT_CATEGORY.REVIEW_OVERALL, itemKey: '', value: state.reviewOverallRationale });
		}
		for (const [k, v] of Object.entries(state.intakeQuestionResponses)) {
			if (v) {drafts.push({ category: DRAFT_CATEGORY.INTAKE_RESPONSE, itemKey: k, value: v });}
		}
		if (state.attachedFiles.length > 0) {
			drafts.push({ category: DRAFT_CATEGORY.ATTACHMENT, itemKey: '', value: JSON.stringify(state.attachedFiles) });
		}
		for (const [k, v] of Object.entries(state.savedResponseText)) {
			if (v) {drafts.push({ category: DRAFT_CATEGORY.SAVED_RESPONSE, itemKey: k, value: v });}
		}

		vscode.postMessage({ type: 'draftSave', drafts });
	}, 500);
}

/**
 * Restore user input drafts from SQLite data sent by the extension host.
 * Called when the host posts a 'draftsLoaded' message after _update().
 */
export function restoreDrafts(grouped: Record<string, Record<string, string>>): void {
	const g = grouped;
	if (g[DRAFT_CATEGORY.GATE_RATIONALE]) {
		Object.assign(state.gateRationales, g[DRAFT_CATEGORY.GATE_RATIONALE]);
	}
	if (g[DRAFT_CATEGORY.VERIFICATION_RATIONALE]) {
		Object.assign(state.verificationClaimRationales, g[DRAFT_CATEGORY.VERIFICATION_RATIONALE]);
	}
	if (g[DRAFT_CATEGORY.REVIEW_ITEM_RATIONALE]) {
		Object.assign(state.reviewItemRationales, g[DRAFT_CATEGORY.REVIEW_ITEM_RATIONALE]);
	}
	if (g[DRAFT_CATEGORY.REVIEW_OVERALL]?.['']) {
		state.reviewOverallRationale = g[DRAFT_CATEGORY.REVIEW_OVERALL][''];
	}
	if (g[DRAFT_CATEGORY.INTAKE_RESPONSE]) {
		Object.assign(state.intakeQuestionResponses, g[DRAFT_CATEGORY.INTAKE_RESPONSE]);
	}
	if (g[DRAFT_CATEGORY.ATTACHMENT]?.['']) {
		try {
			state.attachedFiles = JSON.parse(g[DRAFT_CATEGORY.ATTACHMENT]['']);
		} catch { /* ignore malformed */ }
	}
	if (g[DRAFT_CATEGORY.SAVED_RESPONSE]) {
		Object.assign(state.savedResponseText, g[DRAFT_CATEGORY.SAVED_RESPONSE]);
	}

	// Re-populate DOM textareas from restored state
	repopulateDraftInputs();
}

/**
 * Re-populate DOM textarea values and update associated char counters / button states
 * after state has been restored from SQLite.
 */
function repopulateDraftInputs(): void {
	// Gate rationales
	document.querySelectorAll<HTMLTextAreaElement>('textarea[data-gate-rationale]').forEach((ta) => {
		const gateId = ta.dataset.gateRationale;
		if (gateId && state.gateRationales[gateId]) {
			ta.value = state.gateRationales[gateId];
			const charCount = document.getElementById('charcount-' + gateId);
			if (charCount) {charCount.textContent = ta.value.length + ' / 10 min';}
			// Update button state
			const gateCard = document.querySelector('[data-gate-id="' + gateId + '"]');
			if (gateCard) {
				gateCard.querySelectorAll<HTMLButtonElement>('.gate-btn').forEach((btn) => {
					btn.disabled = ta.value.length < 10;
				});
			}
		}
	});

	// Verification claim rationales
	document.querySelectorAll<HTMLTextAreaElement>('textarea[data-claim-rationale]').forEach((ta) => {
		const claimId = ta.dataset.claimRationale;
		if (claimId && state.verificationClaimRationales[claimId]) {
			ta.value = state.verificationClaimRationales[claimId];
			const charCount = document.getElementById('vg-charcount-' + claimId);
			if (charCount) {charCount.textContent = ta.value.length + ' / 10 min';}
		}
	});

	// Review item rationales
	document.querySelectorAll<HTMLTextAreaElement>('textarea[data-review-item-rationale]').forEach((ta) => {
		const itemKey = ta.dataset.reviewItemRationale;
		if (itemKey && state.reviewItemRationales[itemKey]) {
			ta.value = state.reviewItemRationales[itemKey];
			const charCount = document.getElementById('review-charcount-' + itemKey);
			if (charCount) {charCount.textContent = ta.value.length + ' / 10 min';}
		}
	});

	// Review overall rationale
	document.querySelectorAll<HTMLTextAreaElement>('textarea[data-review-overall-rationale]').forEach((ta) => {
		if (state.reviewOverallRationale) {
			ta.value = state.reviewOverallRationale;
			const gateId = ta.dataset.reviewOverallRationale;
			if (gateId) {
				const charCount = document.getElementById('review-overall-charcount-' + gateId);
				if (charCount) {charCount.textContent = ta.value.length + ' characters';}
			}
		}
	});

	// Intake question responses
	document.querySelectorAll<HTMLTextAreaElement>('textarea[data-intake-question]').forEach((ta) => {
		const questionId = ta.dataset.intakeQuestion;
		if (questionId && state.intakeQuestionResponses[questionId]) {
			ta.value = state.intakeQuestionResponses[questionId];
		}
	});
}
