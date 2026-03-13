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
