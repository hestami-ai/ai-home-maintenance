/**
 * Type definitions for the Governed Stream webview client.
 * Defines the VS Code webview API, incoming/outgoing message protocols,
 * and shared interfaces used across webview modules.
 */

// ===== VS Code Webview API =====

export interface VsCodeApi {
	postMessage(message: OutgoingMessage): void;
	getState(): unknown;
	setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

/** Singleton VS Code API instance — shared across all webview modules */
export const vscode: VsCodeApi = acquireVsCodeApi();

// ===== Incoming Messages (Extension Host → Webview) =====

export interface FullUpdateData {
	streamHtml?: string;
}

export interface TurnAddedData {
	html?: string;
}

export interface ClaimUpdatedData {
	claimId: string;
	status: string;
}

export interface GateResolvedData {
	gateId: string;
	action?: string;
}

export interface ShowSettingsData {
	visible: boolean;
}

export interface RoleKeyStatus {
	role: string;
	displayName: string;
	provider: string;
	hasKey: boolean;
}

export interface KeyStatusUpdateData {
	roles: RoleKeyStatus[];
}

export interface SetInputEnabledData {
	enabled: boolean;
}

export interface SetProcessingData {
	active: boolean;
	phase?: string;
	detail?: string;
}

export interface SetInputThinkingData {
	active: boolean;
}

export interface QaExchangeAddedData {
	question: string;
	answer: string;
	timestamp: string;
}

export interface QaThinkingStartData {
	question: string;
	timestamp: string;
}

export interface QaThinkingProgressData {
	step: string;
}

export interface QaThinkingCompleteData {
	answer: string;
	timestamp: string;
}

export interface ErrorOccurredData {
	code?: string;
	message?: string;
}

export interface CommandActivityData {
	commandId: string;
	action: 'start' | 'output' | 'complete' | 'error';
	commandType?: string;
	label?: string;
	summary?: string;
	detail?: string;
	timestamp?: string;
	collapsed?: boolean;
	lineType?: string;
}

export interface ToolCallActivityData {
	commandId: string;
	action: 'tool_call' | 'tool_result';
	toolUseId?: string;
	toolName?: string;
	input?: string;
	output?: string;
	status?: string;
	timestamp?: string;
}

export interface DialogueTitleUpdatedData {
	dialogueId: string;
	title: string;
}

export interface SystemMessageData {
	message: string;
}

export interface CommandOption {
	kind: string;
	label: string;
	description: string;
	gateId?: string;
}

export interface CommandOptionsData {
	prompt: string;
	options: CommandOption[];
}

export interface ClarificationThreadMessage {
	role: string;
	content: string;
}

export interface ClarificationThread {
	itemId: string;
	messages: ClarificationThreadMessage[];
}

// ===== Speech-to-Text Messages =====

export interface SpeechRecordingStartedData {
	targetInputId: string;
}

export interface SpeechTranscribingData {
	targetInputId: string;
}

export interface SpeechResultData {
	targetInputId: string;
	text: string;
}

export interface SpeechErrorData {
	targetInputId: string;
	error: string;
}

export interface SpeechCapabilityData {
	enabled: boolean;
	soxAvailable: boolean;
}

export interface IntakeModeOptionsData {
	modes: Array<{ mode: string; label: string; description: string; recommended: boolean }>;
	rationale: string;
}

export interface DomainCoverageUpdateData {
	coverage: Record<string, { domain: string; level: string; evidence: string[]; turnNumbers: number[] }>;
	percentage: number;
}

export interface IntakeCheckpointData {
	turnNumber: number;
	percentage: number;
	suggestedDomains: Array<{ domain: string; label: string }>;
}

export interface InputState {
	phase: string;
	isProcessing: boolean;
	hasOpenGates: boolean;
	gateContext?: string;
	placeholder: string;
}

export type IncomingMessage =
	| { type: 'fullUpdate'; data: FullUpdateData }
	| { type: 'turnAdded'; data: TurnAddedData }
	| { type: 'claimUpdated'; data: ClaimUpdatedData }
	| { type: 'phaseChanged'; data: unknown }
	| { type: 'gateTriggered'; data: unknown }
	| { type: 'gateResolved'; data: GateResolvedData }
	| { type: 'showSettings'; data: ShowSettingsData }
	| { type: 'keyStatusUpdate'; data: KeyStatusUpdateData }
	| { type: 'setInputEnabled'; data: SetInputEnabledData }
	| { type: 'setProcessing'; data: SetProcessingData }
	| { type: 'updateProcessingElapsed'; data: { elapsed: number; processCount: number } }
	| { type: 'reasoningReviewReady'; data: { commandId: string; dialogueId: string; review: { concerns: Array<{ severity: string; summary: string; detail: string; location?: string; recommendation?: string }>; overallAssessment: string; reviewerModel: string; durationMs?: number; reviewPrompt?: string; failed?: boolean } } }
	| { type: 'setInputThinking'; data: SetInputThinkingData }
	| { type: 'qaExchangeAdded'; data: QaExchangeAddedData }
	| { type: 'qaThinkingStart'; data: QaThinkingStartData }
	| { type: 'qaThinkingProgress'; data: QaThinkingProgressData }
	| { type: 'qaThinkingComplete'; data: QaThinkingCompleteData }
	| { type: 'errorOccurred'; data: ErrorOccurredData }
	| { type: 'commandActivity'; data: CommandActivityData }
	| { type: 'toolCallActivity'; data: ToolCallActivityData }
	| { type: 'intakePlanUpdated'; data: unknown }
	| { type: 'intakeModeOptions'; data: IntakeModeOptionsData }
	| { type: 'engineeringDomainCoverageUpdate'; data: DomainCoverageUpdateData }
	| { type: 'intakeCheckpoint'; data: IntakeCheckpointData }
	| { type: 'dialogueTitleUpdated'; data: DialogueTitleUpdatedData }
	| { type: 'systemMessage'; data: SystemMessageData }
	| { type: 'commandOptions'; data: CommandOptionsData }
	| { type: 'clarificationResponse'; itemId: string; response?: string; error?: string; elapsedMs?: number; model?: string }
	| { type: 'clarificationThreadsLoaded'; threads: ClarificationThread[] }
	| { type: 'permissionRequested'; data: { permissionId: string; tool: string; input: Record<string, unknown> } }
	| { type: 'mentionSuggestions'; files: string[] }
	| { type: 'fileAttached'; filePath: string }
	| { type: 'speechRecordingStarted'; data: SpeechRecordingStartedData }
	| { type: 'speechTranscribing'; data: SpeechTranscribingData }
	| { type: 'speechResult'; data: SpeechResultData }
	| { type: 'speechError'; data: SpeechErrorData }
	| { type: 'speechCapability'; data: SpeechCapabilityData }
	| { type: 'openFindWidget' }
	| { type: 'pendingMmpDecisionsLoaded'; decisions: Record<string, { mirrorDecisions: Record<string, { status: string; editedText?: string }>; menuSelections: Record<string, { selectedOptionId: string; customResponse?: string }>; preMortemDecisions: Record<string, { status: string; rationale?: string }>; productEdits: Record<string, string> }> }
	| { type: 'draftsLoaded'; drafts: Record<string, Record<string, string>> }
	| { type: 'hydrate'; items: unknown[]; headerHtml: string; inputState: InputState; pendingDecisions?: Record<string, unknown> }
	| { type: 'streamItemAdded'; item: unknown }
	| { type: 'headerUpdate'; data: { headerHtml: string } }
	| { type: 'recordingState'; active: boolean; path?: string }
	| { type: 'clearStream' }
	| { type: 'mmpSubmitAccepted'; cardId: string }
	| { type: 'mmpSubmitRejected'; cardId: string; reason: string }
	| { type: 'gateDecisionAccepted'; gateId: string }
	| { type: 'gateDecisionRejected'; gateId: string; reason: string }
	| { type: 'intakeSubmitAccepted' }
	| { type: 'intakeSubmitRejected'; reason: string }
	| { type: 'architectureGateAccepted'; action: string }
	| { type: 'architectureGateRejected'; reason: string }
	| { type: 'composerSubmitAccepted' }
	| { type: 'composerSubmitRejected'; reason: string }
	| { type: 'permissionDecisionAccepted'; permissionId: string; approved: boolean }
	| { type: 'permissionDecisionRejected'; permissionId: string; reason: string };

// ===== Outgoing Messages (Webview → Extension Host) =====

export type OutgoingMessage =
	| { type: 'refresh' }
	| { type: 'webviewReady' }
	| { type: 'gateDecision'; gateId: string; action: string; rationale: string }
	| { type: 'verificationGateDecision'; gateId: string; action: string; claimRationales?: Record<string, string> }
	| { type: 'reviewGateDecision'; gateId: string; action: string; itemRationales?: Record<string, string>; overallFeedback?: string }
	| { type: 'submitInput'; text: string; attachments: string[] }
	| { type: 'copySessionId'; sessionId: string }
	| { type: 'setApiKey'; role: string }
	| { type: 'clearApiKey'; role: string }
	| { type: 'settingsVisibilityChanged'; visible: boolean }
	| { type: 'requestMentionSuggestions'; query: string }
	| { type: 'pickFile' }
	| { type: 'intakeFinalizePlan' }
	| { type: 'intakeApprovePlan' }
	| { type: 'intakeContinueDiscussing' }
	| { type: 'intakeModeSelected'; mode: string }
	| { type: 'retryPhase' }
	| { type: 'clearDatabase' }
	| { type: 'exportStream' }
	| { type: 'resumeDialogue'; dialogueId: string }
	| { type: 'switchDialogue'; dialogueId: string }
	| { type: 'clarificationMessage'; itemId: string; itemContext: string; history: Array<{ role: string; content: string }> }
	| { type: 'executeRetryAction'; kind: string; gateId: string | null }
	| { type: 'permissionDecision'; permissionId: string; approved: boolean; approveAll?: boolean }
	| { type: 'cancelWorkflow' }
	| { type: 'pauseWorkflow' }
	| { type: 'cancelThinking' }
	| { type: 'intakeSkipGathering' }
	| { type: 'reviewMmpDecision'; gateId: string; cardId: string; mirrorDecisions: Record<string, { status: string; editedText?: string; text?: string }>; menuSelections: Record<string, { selectedOptionId: string; customResponse?: string; question?: string; selectedLabel?: string }>; preMortemDecisions: Record<string, { status: string; rationale?: string; assumption?: string }> }
	| { type: 'mmpSubmit'; cardId: string; mirrorDecisions: Record<string, { status: string; editedText?: string; text?: string }>; menuSelections: Record<string, { selectedOptionId: string; customResponse?: string; question?: string; selectedLabel?: string }>; preMortemDecisions: Record<string, { status: string; rationale?: string; assumption?: string }>; productEdits?: Record<string, string> }
	| { type: 'architectureGateDecision'; action: string; dialogueId: string; docId: string; feedback?: string }
	| { type: 'architectureDecomposeDeeper'; dialogueId: string; docId: string }
	| { type: 'openArchitectureExplorer'; dialogueId: string }
	| { type: 'mmpPartialSave'; cardId: string; mirrorDecisions: Record<string, { status: string; editedText?: string }>; menuSelections: Record<string, { selectedOptionId: string; customResponse?: string }>; preMortemDecisions: Record<string, { status: string; rationale?: string }> }
	| { type: 'speechStart'; targetInputId: string }
	| { type: 'speechStop' }
	| { type: 'speechCancel' }
	| { type: 'generateDocument' }
	| { type: 'reviewRerun'; guidance?: string }
	| { type: 'draftSave'; drafts: Array<{ category: string; itemKey: string; value: string }> }
	| { type: 'draftClear'; category?: string }
	| { type: 'validationFeedback'; findingId: string; useful: boolean }
	| { type: 'recordingToggle' };
