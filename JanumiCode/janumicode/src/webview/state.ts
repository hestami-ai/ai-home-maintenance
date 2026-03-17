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
	if (!saved) return;
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
