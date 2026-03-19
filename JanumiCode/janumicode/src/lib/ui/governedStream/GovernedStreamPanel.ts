/**
 * Governed Stream WebviewView Provider
 * Implements the unified "Governed Stream" sidebar view as described in the UI/UX Design Spec.
 * Uses event bus for real-time updates instead of polling.
 */

import * as vscode from 'vscode';
import { getEventBus, emitDialogueResumed } from '../../integration/eventBus';
import { aggregateStreamState, type GovernedStreamState } from './dataAggregator';
import { processHumanGateDecision, type HumanGateDecisionInput } from '../../workflow/humanGateHandling';
import { HumanAction, Role, ClaimEventType, Phase, ClaimStatus, GateStatus } from '../../types';
import { getStyles } from './html/styles';
import { renderStickyHeader, renderStream, renderInputArea, renderEmptyState, renderRichCard, renderSettingsPanel, setSpeechEnabled, setSoxAvailable } from './html/components';
import { getDialogueEventById, getClaims, getOrCreateIntakeConversation } from '../../events/reader';
import { getSecretKeyManager } from '../../config/secretKeyManager';
import { getProviderForRole } from '../../config/manager';
import { clearRoleProviderCache } from '../../llm/roleManager';
import {
	startDialogueWithWorkflow,
	executeWorkflowCycle,
	advanceDialogueWithWorkflow,
} from '../../integration/dialogueOrchestrator';
import { abandonDialogue, getActiveDialogue, resumeDialogue } from '../../dialogue/lifecycle';
import { clearAllData } from '../../database/init';
import { generateDialogueTitle } from '../../llm/titleGenerator';
import { getConfig } from '../../config';
import { subscribeCommandPersistence, completeCommand, appendCommandOutput as appendCommandOutputToDB } from '../../workflow/commandStore';
import { IntakeSubState, IntakeMode } from '../../types/intake';
import { updateIntakeConversation, writeClaimEvent, writeQaExchange, writeDialogueEvent } from '../../events/writer';
import { getCoverageGaps, getPartialDomains, DOMAIN_SEQUENCE } from '../../workflow/domainCoverageTracker';
import { getWorkflowState, updateWorkflowMetadata, transitionWorkflow, TransitionTrigger } from '../../workflow/stateMachine';
import { resolveGate, getGate, getGatesForDialogue } from '../../workflow/gates';
import { getDatabase } from '../../database';
import { parseTextCommand, interpretInput, escalateQuery, assessRetryableActions, type ParsedCommand, type RetryableAction, type QaProgressCallback } from './textCommands';
import { killAllActiveProcesses } from '../../cli/spawnUtils';
import { getActivePermissionBridge, setActivePermissionBridge } from '../../mcp/permissionBridge';
import { runNarrativeCuration } from '../../curation/narrativeCurator';
import { CurationMode } from '../../types/narrativeCurator';
import { askClarification } from '../../clarification/clarificationExpert';
import { saveClarificationThread, getClarificationThreads } from '../../clarification/clarificationStore';
import { SpeechToTextService, resolveSpeechConfig } from '../../speech/speechToTextService';

/**
 * WebviewViewProvider for the Governed Stream sidebar view.
 */
export class GovernedStreamViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'janumicode.governedStream';

	private _view?: vscode.WebviewView;
	private _eventUnsubscribers: (() => void)[] = [];
	private _activeDialogueId: string | null = null;
	private _settingsPanelVisible = false;
	private _isProcessing = false;
	private _disposed = false;
	private _thinkingCancelled = false;
	private _processingPhase = '';
	private _processingDetail = '';
	private _activeCLICommandId: string | null = null;
	private readonly _pendingToolCalls: Map<string, import('../../cli/types').CLIActivityEvent> = new Map();
	/** Suppress the next dialogue:turn_added event (the initial turn is already included in the dialogue:started full re-render) */
	private _suppressNextTurnAdded = false;
	private _speechService: SpeechToTextService | null = null;
	private _speechTargetInputId: string | null = null;
	/** AbortController for the current workflow cycle — aborted on cancel/dispose */
	private _workflowAbortController: AbortController | null = null;
	constructor(private readonly _extensionUri: vscode.Uri) {}

	/**
	 * Called by VS Code when the webview view is first made visible.
	 */
	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	): void {
		console.log('[GovernedStream] resolveWebviewView called');
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri],
		};

		// Restore active dialogue from database (survives VS Code restart)
		try {
			const activeResult = getActiveDialogue();
			if (activeResult.success && activeResult.value) {
				this._activeDialogueId = activeResult.value.dialogue_id;
				console.log('[GovernedStream] Restored active dialogue:', this._activeDialogueId);
			}
		} catch (e) {
			console.error('[GovernedStream] Error restoring active dialogue:', e);
		}

		// Set initial HTML
		try {
			this._update();
			console.log('[GovernedStream] Initial render complete');
		} catch (e) {
			console.error('[GovernedStream] Error in initial _update():', e);
		}

		// Handle visibility changes
		// Note: with retainContextWhenHidden, the DOM stays alive — no need to re-render.
		// Re-rendering would destroy input state (typed text, attached files, etc.).

		// Handle messages from the webview
		webviewView.webview.onDidReceiveMessage(
			(message) => this._handleMessage(message)
		);

		// Handle disposal
		webviewView.onDidDispose(() => this._cleanup());

		// Subscribe to event bus
		this._subscribeToEvents();

		// Start persisting workflow commands to DB (idempotent — only subscribes once)
		subscribeCommandPersistence();

		// Send speech capability status (checks SoX availability) and listen for config changes
		this._sendSpeechCapability();
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('janumicode.speech')) {
				this._getSpeechService().resetAvailabilityCache();
				this._sendSpeechCapability();
			}
		});
	}

	/**
	 * Send a message to the webview to open the find widget
	 */
	public openFindWidget(): void {
		if (!this._view) { return; }
		this._view.webview.postMessage({ type: 'openFindWidget' });
	}

	/**
	 * Toggle the settings panel visibility in the webview
	 */
	public async toggleSettingsPanel(): Promise<void> {
		if (!this._view) {
			return;
		}

		this._settingsPanelVisible = !this._settingsPanelVisible;

		if (this._settingsPanelVisible) {
			const keyStatus = await this._getKeyStatus();
			this._view.webview.postMessage({
				type: 'showSettings',
				data: { visible: true },
			});
			this._view.webview.postMessage({
				type: 'keyStatusUpdate',
				data: { roles: keyStatus },
			});
		} else {
			this._view.webview.postMessage({
				type: 'showSettings',
				data: { visible: false },
			});
		}
	}

	/**
	 * Start a new dialogue sequence in the stream.
	 * Abandons the current active dialogue if one exists mid-workflow,
	 * resets the active pointer, and optionally submits a goal immediately.
	 */
	public async startNewDialogue(goal?: string): Promise<void> {
		// Abandon current dialogue if it hasn't completed
		if (this._activeDialogueId) {
			abandonDialogue(this._activeDialogueId);
			this._activeDialogueId = null;
		}

		if (goal) {
			await this._handleSubmitInput(goal);
		} else {
			this._update();
		}
	}

	/**
	 * Subscribe to event bus for real-time updates
	 */
	private _subscribeToEvents(): void {
		const bus = getEventBus();

		// Dialogue events → append turn to stream
		this._eventUnsubscribers.push(
			bus.on('dialogue:turn_added', (payload) => {
				this._activeDialogueId = payload.dialogueId;
				// Skip if suppressed — the initial turn is already included
				// in the dialogue:started full re-render
				if (this._suppressNextTurnAdded) {
					this._suppressNextTurnAdded = false;
					return;
				}
				this._handleTurnAdded(payload.turnId);
			})
		);

		this._eventUnsubscribers.push(
			bus.on('dialogue:started', (payload) => {
				this._activeDialogueId = payload.dialogueId;
				// Full re-render includes the initial turn; suppress the
				// immediately following dialogue:turn_added to avoid a duplicate
				this._suppressNextTurnAdded = true;
				this._update();
			})
		);

		// Workflow events
		this._eventUnsubscribers.push(
			bus.on('workflow:phase_changed', (payload) => {
				// Update processing indicator with current phase
				if (this._isProcessing) {
					const phaseLabels: Record<string, string> = {
						INTAKE: 'Intake',
						PROPOSE: 'Generating proposal',
						ASSUMPTION_SURFACING: 'Surfacing assumptions',
						VERIFY: 'Verifying claims',
						HISTORICAL_CHECK: 'Checking history',
						REVIEW: 'Awaiting review',
						EXECUTE: 'Executing',
						VALIDATE: 'Validating',
						COMMIT: 'Committing',
						REPLAN: 'Replanning',
					};
					const label = phaseLabels[payload.currentPhase] || payload.currentPhase;
					this._postProcessing(true, label, `Phase: ${payload.currentPhase}`);
				}

				this._view?.webview.postMessage({
					type: 'phaseChanged',
					data: payload,
				});
				// Full update to refresh header stepper and insert milestone
				this._update();
			})
		);

		this._eventUnsubscribers.push(
			bus.on('workflow:gate_triggered', (payload) => {
				// Clear stale processing indicator — the phase is done, gate is now active
				this._isProcessing = false;
				this._postProcessing(false);
				this._postInputEnabled(true);

				this._view?.webview.postMessage({
					type: 'gateTriggered',
					data: payload,
				});
				this._update();
			})
		);

		this._eventUnsubscribers.push(
			bus.on('workflow:gate_resolved', (payload) => {
				this._view?.webview.postMessage({
					type: 'gateResolved',
					data: { gateId: payload.gateId, action: payload.action },
				});
			})
		);

		// Claim events → update verdict badge in-place
		this._eventUnsubscribers.push(
			bus.on('claim:verified', (payload) => {
				this._view?.webview.postMessage({
					type: 'claimUpdated',
					data: { claimId: payload.claimId, status: 'VERIFIED' },
				});
				// Also update the health bar
				this._update();
			})
		);

		this._eventUnsubscribers.push(
			bus.on('claim:disproved', (payload) => {
				this._view?.webview.postMessage({
					type: 'claimUpdated',
					data: { claimId: payload.claimId, status: 'DISPROVED' },
				});
				this._update();
			})
		);

		// Workflow completed → clear active dialogue pointer
		this._eventUnsubscribers.push(
			bus.on('workflow:completed', () => {
				this._activeDialogueId = null;
				this._update();
			})
		);

		// Error events → show in stream
		this._eventUnsubscribers.push(
			bus.on('error:occurred', (payload) => {
				this._view?.webview.postMessage({
					type: 'errorOccurred',
					data: { code: payload.code, message: payload.message },
				});
			})
		);

		// Phase failure → re-render to show retry button in static HTML
		this._eventUnsubscribers.push(
			bus.on('workflow:phase_failed', (payload) => {
				if (payload.dialogueId === this._activeDialogueId) {
					this._update();
				}
			})
		);

		// Workflow command events → command blocks in stream
		this._eventUnsubscribers.push(
			bus.on('workflow:command', (payload) => {
				// Track active CLI command ID so cli:activity events route correctly
				if ((payload.commandType === 'cli_invocation' || payload.commandType === 'role_invocation')
					&& payload.action === 'start') {
					this._activeCLICommandId = payload.commandId;
				}
				this._view?.webview.postMessage({
					type: 'commandActivity',
					data: payload,
				});
			})
		);

		// CLI activity events → persist + forward to webview
		this._eventUnsubscribers.push(
			bus.on('cli:activity', (payload) => {
				const evt = payload.event;
				const commandId = this._activeCLICommandId;
				if (!commandId) {
					return;
				}

				// === COMPLETE: finalize the command block ===
				if (evt.eventType === 'complete') {
					const status = evt.status === 'error' ? 'error' : 'success';
					completeCommand(commandId, status, undefined, evt.timestamp);
					if (evt.summary) {
						appendCommandOutputToDB(commandId, 'summary', evt.summary, evt.timestamp);
					}
					this._activeCLICommandId = null;
					this._pendingToolCalls.clear();
					this._view?.webview.postMessage({
						type: 'commandActivity',
						data: { commandId, action: 'complete', commandType: 'cli_invocation', status, timestamp: evt.timestamp },
					});
					return;
				}

				// === TOOL CALL: buffer and emit structured card ===
				if (evt.eventType === 'tool_call' || evt.eventType === 'command_exec' ||
					evt.eventType === 'file_read' || evt.eventType === 'file_write') {
					const toolUseId = evt.toolUseId ?? `anon-${Date.now()}`;
					this._pendingToolCalls.set(toolUseId, evt);

					// Persist as tool_input
					const toolInputContent = JSON.stringify({
						toolName: evt.toolName,
						input: evt.input,
						filePath: evt.filePath,
					});
					appendCommandOutputToDB(commandId, 'tool_input', toolInputContent, evt.timestamp, evt.toolName);

					// Forward structured tool_call to webview
					this._view?.webview.postMessage({
						type: 'toolCallActivity',
						data: {
							commandId,
							toolUseId,
							action: 'tool_call',
							toolName: evt.toolName ?? 'Tool',
							input: evt.input,
							filePath: evt.filePath,
							eventType: evt.eventType,
							timestamp: evt.timestamp,
						},
					});
					return;
				}

				// === TOOL RESULT: pair with pending tool_call ===
				if (evt.eventType === 'tool_result') {
					let pairedCall: import('../../cli/types').CLIActivityEvent | undefined;
					const toolUseId = evt.toolUseId;

					if (toolUseId && this._pendingToolCalls.has(toolUseId)) {
						pairedCall = this._pendingToolCalls.get(toolUseId);
						this._pendingToolCalls.delete(toolUseId);
					} else if (this._pendingToolCalls.size > 0) {
						// Fallback: pair with the most recent pending call
						const lastKey = Array.from(this._pendingToolCalls.keys()).pop()!;
						pairedCall = this._pendingToolCalls.get(lastKey);
						this._pendingToolCalls.delete(lastKey);
					}

					// Resolve tool metadata: prefer paired call, fall back to fields on the result event itself
					const resolvedToolName = pairedCall?.toolName ?? evt.toolName ?? 'Tool';
					const resolvedInput = pairedCall?.input ?? evt.input;
					const resolvedFilePath = pairedCall?.filePath ?? evt.filePath;

					// If no paired tool_call was persisted, create a synthetic tool_input
					// so the static renderer can pair it with the tool_output on rebuild.
					if (!pairedCall) {
						const syntheticInput = JSON.stringify({
							toolName: resolvedToolName,
							input: resolvedInput,
							filePath: resolvedFilePath,
						});
						appendCommandOutputToDB(commandId, 'tool_input', syntheticInput, evt.timestamp, resolvedToolName);
					}

					// Persist as tool_output
					const toolOutputContent = JSON.stringify({
						toolName: resolvedToolName,
						output: evt.output ?? evt.summary,
						status: evt.status,
					});
					appendCommandOutputToDB(commandId, 'tool_output', toolOutputContent, evt.timestamp, resolvedToolName);

					// Forward structured tool_result to webview
					this._view?.webview.postMessage({
						type: 'toolCallActivity',
						data: {
							commandId,
							toolUseId: toolUseId ?? pairedCall?.toolUseId,
							action: 'tool_result',
							toolName: resolvedToolName,
							input: resolvedInput,
							output: evt.output ?? evt.summary,
							filePath: resolvedFilePath,
							eventType: evt.eventType,
							status: evt.status ?? 'success',
							timestamp: evt.timestamp,
						},
					});
					return;
				}

				// === STDIN: collapsible stdin block ===
				if (evt.eventType === 'stdin') {
					if (evt.detail) {
						appendCommandOutputToDB(commandId, 'stdin', evt.detail, evt.timestamp);
					}
					this._view?.webview.postMessage({
						type: 'commandActivity',
						data: {
							commandId,
							action: 'output',
							commandType: 'cli_invocation',
							lineType: 'stdin',
							summary: evt.summary,
							detail: evt.detail,
							timestamp: evt.timestamp,
						},
					});
					return;
				}

				// === ERROR: persist and forward ===
				if (evt.eventType === 'error') {
					if (evt.summary) {
						appendCommandOutputToDB(commandId, 'error', evt.summary, evt.timestamp);
					}
					if (evt.detail && evt.detail !== evt.summary) {
						appendCommandOutputToDB(commandId, 'error', evt.detail, evt.timestamp);
					}
					this._view?.webview.postMessage({
						type: 'commandActivity',
						data: {
							commandId,
							action: 'error',
							commandType: 'cli_invocation',
							summary: evt.summary,
							detail: evt.detail !== evt.summary ? evt.detail : undefined,
							status: 'error',
							timestamp: evt.timestamp,
						},
					});
					return;
				}

				// === MESSAGE / INIT: flat text — only emit summary OR detail, not both ===
				const displayText = evt.detail || evt.summary;
				if (displayText) {
					const lineType = evt.detail ? 'detail' : 'summary';
					appendCommandOutputToDB(commandId, lineType, displayText, evt.timestamp);
				}
				this._view?.webview.postMessage({
					type: 'commandActivity',
					data: {
						commandId,
						action: 'output',
						commandType: 'cli_invocation',
						summary: !evt.detail ? evt.summary : undefined,
						detail: evt.detail || undefined,
						timestamp: evt.timestamp,
					},
				});
			})
		);

		// Permission request events → surface permission card in webview
		this._eventUnsubscribers.push(
			bus.on('permission:requested', (payload) => {
				this._view?.webview.postMessage({
					type: 'permissionRequested',
					data: {
						permissionId: payload.permissionId,
						tool: payload.tool,
						input: payload.input,
					},
				});
			})
		);

		// INTAKE conversation events → refresh to show updated conversation
		this._eventUnsubscribers.push(
			bus.on('intake:turn_completed', () => {
				this._update();
			})
		);

		this._eventUnsubscribers.push(
			bus.on('intake:plan_updated', (payload) => {
				this._view?.webview.postMessage({
					type: 'intakePlanUpdated',
					data: { plan: payload.plan },
				});
			})
		);

		this._eventUnsubscribers.push(
			bus.on('intake:plan_finalized', () => {
				this._update();
			})
		);

		this._eventUnsubscribers.push(
			bus.on('intake:plan_approved', () => {
				this._update();
			})
		);

		// Adaptive INTAKE events → refresh to show mode selector, coverage, checkpoints
		this._eventUnsubscribers.push(
			bus.on('intake:mode_selected', () => {
				this._update();
			})
		);

		this._eventUnsubscribers.push(
			bus.on('intake:domain_coverage_updated', () => {
				this._update();
			})
		);

		this._eventUnsubscribers.push(
			bus.on('intake:checkpoint_triggered', () => {
				this._update();
			})
		);

		this._eventUnsubscribers.push(
			bus.on('intake:domain_transition', () => {
				this._update();
			})
		);

		this._eventUnsubscribers.push(
			bus.on('intake:classifier_result', () => {
				this._update();
			})
		);

		this._eventUnsubscribers.push(
			bus.on('intake:gathering_skipped', () => {
				this._update();
			})
		);

		// Dialogue navigation events
		this._eventUnsubscribers.push(
			bus.on('dialogue:resumed', (payload) => {
				this._activeDialogueId = payload.dialogueId;
				this._update();
			})
		);

		this._eventUnsubscribers.push(
			bus.on('dialogue:title_updated', (payload) => {
				this._view?.webview.postMessage({
					type: 'dialogueTitleUpdated',
					data: { dialogueId: payload.dialogueId, title: payload.title },
				});
			})
		);
	}

	/**
	 * Handle a new turn being added — try incremental append first
	 */
	private _handleTurnAdded(turnId: number): void {
		if (!this._view) {
			return;
		}

		const eventResult = getDialogueEventById(turnId);
		if (!eventResult.success || !eventResult.value) {
			// Fallback to full update
			this._update();
			return;
		}

		const event = eventResult.value;
		const claimsResult = getClaims({ dialogue_id: event.dialogue_id });
		const turnClaims = claimsResult.success
			? claimsResult.value.filter((c) => c.turn_id === turnId)
			: [];

		const html = renderRichCard(event, turnClaims);

		this._view.webview.postMessage({
			type: 'turnAdded',
			data: { html },
		});
	}

	/**
	 * Handle messages from the webview
	 */
	/**
	 * Safely run an async handler from _handleMessage. Catches rejections
	 * so they don't become unhandled (common during extension shutdown).
	 */
	private _safeAsync(fn: () => Promise<unknown> | void): void {
		if (this._disposed) return;
		Promise.resolve(fn()).catch(err => {
			// Suppress "Canceled" and "Channel has been closed" errors during disposal
			if (this._disposed) return;
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.includes('Canceled') || msg.includes('Channel has been closed')) return;
			console.error('[GovernedStream] Unhandled async error:', msg);
		});
	}

	private _handleMessage(message: { type: string; [key: string]: unknown }): void {
		if (this._disposed) return;

		switch (message.type) {
			case 'refresh':
				this._update();
				break;

			case 'submitInput':
				this._safeAsync(() => this._handleSubmitInput(message.text as string));
				break;

			case 'gateDecision':
				this._safeAsync(() => this._handleGateDecisionAndResume(
					message.gateId as string,
					message.action as string,
					message.rationale as string
				));
				break;

			case 'copySessionId':
				vscode.env.clipboard.writeText(message.sessionId as string);
				vscode.window.showInformationMessage('Session ID copied to clipboard');
				break;

			case 'requestKeyStatus':
				this._safeAsync(() => this._sendKeyStatus());
				break;

			case 'setApiKey':
				this._safeAsync(() => this._handleSetApiKey(message.role as string));
				break;

			case 'clearApiKey':
				this._safeAsync(() => this._handleClearApiKey(message.role as string));
				break;

			case 'pickFile':
				this._safeAsync(() => this._handlePickFile());
				break;

			case 'requestMentionSuggestions':
				this._safeAsync(() => this._handleMentionSuggestions(message.query as string));
				break;

			case 'retryPhase':
				this._safeAsync(() => this._handleRetryPhase());
				break;

			case 'intakeFinalizePlan':
				this._safeAsync(() => this._handleIntakeFinalize());
				break;

			case 'intakeApprovePlan':
				this._safeAsync(() => this._handleIntakeApprove());
				break;

			case 'intakeContinueDiscussing':
				this._safeAsync(() => this._handleIntakeContinueDiscussing());
				break;

			case 'intakeSkipGathering':
				this._safeAsync(() => this._handleIntakeSkipGathering());
				break;

			case 'intakeModeSelected':
				this._safeAsync(() => this._handleIntakeModeSelected(message.mode as string));
				break;

			case 'resumeDialogue':
				this._safeAsync(() => this._handleResumeDialogue(message.dialogueId as string));
				break;

			case 'switchDialogue':
				this._safeAsync(() => this._handleSwitchDialogue(message.dialogueId as string));
				break;

			case 'clearDatabase':
				this._safeAsync(() => this._handleClearDatabase());
				break;

			case 'exportStream':
				this._safeAsync(() => this._handleExportStream());
				break;

			case 'generateDocument':
				this._safeAsync(() => this._handleGenerateDocument());
				break;

			case 'reviewRerun':
				this._safeAsync(() => this._handleReviewRerun(message.guidance as string | undefined));
				break;

			case 'settingsVisibilityChanged':
				this._settingsPanelVisible = message.visible as boolean;
				break;

			case 'verificationGateDecision':
				this._safeAsync(() => this._handleVerificationGateDecision(
					message.gateId as string,
					message.action as string,
					message.claimRationales as Record<string, string> | undefined
				));
				break;

			case 'reviewGateDecision':
				this._safeAsync(() => this._handleReviewGateDecision(
					message.gateId as string,
					message.action as string,
					message.itemRationales as Record<string, string> | undefined,
					message.overallFeedback as string | undefined
				));
				break;

			case 'executeRetryAction':
				this._safeAsync(() => this._executeRetryAction({
					kind: message.kind as RetryableAction['kind'],
					label: message.kind as string,
					description: '',
					gateId: (message.gateId as string) || undefined,
				}));
				break;

			case 'clarificationMessage':
				this._safeAsync(() => this._handleClarificationMessage(message));
				break;

			case 'permissionDecision':
				this._safeAsync(() => this._handlePermissionDecision(message));
				break;

			case 'cancelWorkflow':
				this._safeAsync(() => this._handleCancel());
				break;

			case 'cancelThinking':
				this._thinkingCancelled = true;
				this._postInputThinking(false);
				this._postQaThinkingComplete('*(Cancelled)*');
				break;

			case 'mmpPartialSave':
				this._handleMmpPartialSave(message);
				break;

			case 'architectureGateDecision':
				this._safeAsync(() => this._handleArchitectureGateDecision(message));
				break;

			case 'architectureDecomposeDeeper':
				this._safeAsync(() => this._handleArchitectureDecomposeDeeper(message));
				break;

			case 'mmpSubmit':
				this._safeAsync(() => this._handleMMPSubmit(message));
				break;

			case 'reviewMmpDecision':
				this._safeAsync(() => this._handleReviewMmpDecision(message));
				break;

			case 'speechStart':
				this._handleSpeechStart(message.targetInputId as string);
				break;

			case 'speechStop':
				this._handleSpeechStop();
				break;

			case 'speechCancel':
				this._handleSpeechCancel();
				break;
		}
	}

	/**
	 * Handle user input submission — starts or advances the governed workflow
	 */
	private async _handleSubmitInput(text: string): Promise<void> {
		if (!text.trim()) { return; }

		// Cancel/abort command — checked BEFORE the _isProcessing guard
		// so users can always cancel even when execution is in progress.
		const cancelCheck = parseTextCommand(text);
		if (cancelCheck?.command === 'cancel') {
			await this._handleCancel();
			return;
		}

		if (this._isProcessing) { return; }

		// Smart text command parsing — two-tier intent detection
		// Tier 1: instant alias map (retry, redo, approve, ok, etc.)
		const parsed = parseTextCommand(text);

		if (parsed && this._activeDialogueId) {
			const handled = await this._handleTextCommand(parsed);
			if (handled) { return; }
			// Not handled (e.g., no open gate for "approve") — fall through
		}

		// Tier 2/3: LLM-mediated classification and escalation.
		// Wrap in thinking indicator — the spinner shows while the LLM calls run.
		this._thinkingCancelled = false;
		this._postInputThinking(true);
		try {
			// Tier 2: LLM-mediated natural language interpretation
			// Fires for any active dialogue — handles questions, commands with parameters, etc.
			if (!parsed && this._activeDialogueId) {
				const progressCb: QaProgressCallback = (step) => this._postQaThinkingProgress(step);
				const action = await interpretInput(text, this._activeDialogueId, progressCb);
				if (this._thinkingCancelled) { return; }
				if (action) {
					if (action.action === 'answer') {
						// Show the Q&A card immediately with question header + spinner
						this._postQaThinkingStart(text);

						if (action.needsEscalation && this._activeDialogueId) {
							// Tier 3: Escalate to deep context + FTS + workspace query
							const escalated = await escalateQuery(text, this._activeDialogueId, progressCb);
							if (this._thinkingCancelled) {
								this._postQaThinkingComplete('*(Cancelled)*');
								return;
							}
							if (escalated && escalated.action === 'answer') {
								this._postQaThinkingComplete(escalated.response);
								this._persistQaOnly(text, escalated.response);
								return;
							}
						}
						// Use Tier 2 answer (complete or partial fallback)
						this._postQaThinkingComplete(action.response);
						this._persistQaOnly(text, action.response);
						return;
					} else if (action.action === 'cancel') {
						await this._handleCancel();
						return;
					} else if (action.action === 'navigate') {
						const handled = await this._handleNavigateCommand(action.target);
						if (handled) { return; }
					} else if (action.action === 'save_output') {
						const handled = await this._handleSaveOutputCommand(action.filePath);
						if (handled) { return; }
					} else if (action.action !== 'freetext') {
						// retry, approve, reframe, override
						const commandParsed: ParsedCommand = {
							command: action.action,
							args: action.rationale ?? text,
							raw: text,
						};
						const handled = await this._handleTextCommand(commandParsed);
						if (handled) { return; }
					}
					// freetext or unhandled action — fall through to normal submission
				}
			}

			// ── Tier 2.5: LLM Orchestrator ──────────────────────────────
			// If Tier 2 returned freetext and we have an active dialogue, try
			// composing a plan from primitives before falling to Tier 3/freetext.
			if (this._activeDialogueId) {
				try {
					const { generatePlan } = await import('../../orchestrator/planner.js');
					const { executePlan } = await import('../../orchestrator/executor.js');
					const plan = await generatePlan(
						text,
						this._activeDialogueId,
						(_msg: string) => this._postInputThinking(true),
					);
					if (plan && plan.steps.length > 0) {
						const result = await executePlan(
							plan,
							this._activeDialogueId,
							this._createUIChannel(),
						);
						if (result.success) {
							this._update();
							return;
						}
						// Plan failed — fall through to Tier 3 / freetext guard
					}
				} catch {
					// Orchestrator unavailable — fall through silently
				}
			}

			// Freetext guard: when gates are open, block new instructions from reaching
			// the dialogue submission path (which creates dead HUMAN DECISION turns).
			// If Tier 2 failed or returned freetext, try Tier 3 as a fallback —
			// it will answer questions and return null for actual freetext.
			if (this._activeDialogueId) {
				const gatesResult = getGatesForDialogue(this._activeDialogueId, GateStatus.OPEN);
				if (gatesResult.success && gatesResult.value.length > 0) {
					// Tier 2 was unavailable or misclassified — let Tier 3 decide
					const progressCb: QaProgressCallback = (step) => this._postQaThinkingProgress(step);
					this._postQaThinkingStart(text);
					const escalated = await escalateQuery(text, this._activeDialogueId, progressCb);
					if (this._thinkingCancelled) {
						this._postQaThinkingComplete('*(Cancelled)*');
						return;
					}
					if (escalated && escalated.action === 'answer') {
						this._postQaThinkingComplete(escalated.response);
						this._persistQaOnly(text, escalated.response);
						return;
					}
					// Tier 3 didn't produce an answer — remove thinking card, this is genuine freetext
					this._postQaThinkingComplete('*(No answer found — this looks like an instruction, not a question)*');
					this._postSystemMessage(
						'There are open gates requiring a decision. ' +
						'Use approve, retry, override, reframe, or cancel — ' +
						'or ask a question about the current state.'
					);
					return;
				}
			}
		} finally {
			this._postInputThinking(false);
		}

		this._isProcessing = true;
		this._postInputEnabled(false);
		this._postProcessing(true, 'Starting', 'Initializing workflow');

		try {
			if (this._activeDialogueId) {
				// Check if we're in INTAKE phase — route input differently
				const wsResult = getWorkflowState(this._activeDialogueId);
				const currentPhase = wsResult.success ? wsResult.value.current_phase : '';

				if (currentPhase === 'INTAKE') {
					// INTAKE mode: store message in metadata and run cycle
					updateWorkflowMetadata(this._activeDialogueId, {
						pendingIntakeInput: text,
					});

					// Write human_message event immediately so the prompt is visible during processing
					writeDialogueEvent({
						dialogue_id: this._activeDialogueId,
						event_type: 'human_message',
						role: 'HUMAN',
						phase: 'INTAKE',
						speech_act: 'DECISION',
						summary: text.length > 120 ? text.substring(0, 120) + '...' : text,
						content: text,
					});

					this._postProcessing(true, 'Planning', 'Discussing with Technical Expert');
					await this._runWorkflowCycle();
				} else {
					// Non-INTAKE: standard advance path
					const config = await getConfig();
					const result = await advanceDialogueWithWorkflow({
						dialogueId: this._activeDialogueId,
						role: Role.HUMAN,
						content: text,
						llmConfig: config.llmConfig,
						tokenBudget: config.tokenBudget,
						advanceWorkflow: false,
					});

					if (!result.success) {
						vscode.window.showErrorMessage(`Failed to advance dialogue: ${result.error.message}`);
						return;
					}

					// Run workflow cycle and await it (keeps input disabled during execution)
					await this._runWorkflowCycle();
				}
			} else {
				// First message — start a new dialogue + workflow
				const config = await getConfig();
				const result = startDialogueWithWorkflow({
					goal: text,
					llmConfig: config.llmConfig,
					tokenBudget: config.tokenBudget,
				});

				if (!result.success) {
					vscode.window.showErrorMessage(`Failed to start dialogue: ${result.error.message}`);
					return;
				}

				this._activeDialogueId = result.value.dialogue.dialogue_id;

				// Write human_message event immediately so the prompt is visible during processing
				writeDialogueEvent({
					dialogue_id: this._activeDialogueId,
					event_type: 'human_message',
					role: 'HUMAN',
					phase: 'INTAKE',
					speech_act: 'DECISION',
					summary: text.length > 120 ? text.substring(0, 120) + '...' : text,
					content: text,
				});

				// Fire-and-forget title generation
				generateDialogueTitle(this._activeDialogueId, text).catch(() => {});

				// Run workflow cycle and await it
				await this._runWorkflowCycle();
			}
		} finally {
			this._isProcessing = false;
			this._postProcessing(false);
			this._postInputEnabled(true);
		}
	}

	/**
	 * Run the async workflow cycle
	 */
	private async _runWorkflowCycle(): Promise<void> {
		if (!this._activeDialogueId || this._disposed) {
			return;
		}

		// Create a fresh AbortController for this cycle — aborted on cancel/dispose
		this._workflowAbortController?.abort();
		this._workflowAbortController = new AbortController();

		// Set module-level signal so all spawn functions auto-inherit it
		const { setWorkflowAbortSignal } = await import('../../cli/spawnUtils.js');
		setWorkflowAbortSignal(this._workflowAbortController.signal);

		try {
			const config = await getConfig();
			const result = await executeWorkflowCycle(
				this._activeDialogueId,
				config.llmConfig,
				config.tokenBudget,
				20
			);

			if (this._disposed) return;

			if (!result.success) {
				// Suppress abort errors during disposal
				if (result.error.message === 'Aborted') return;
				vscode.window.showErrorMessage(`Workflow error: ${result.error.message}`);
				this._update();
				return;
			}

			if (result.value.completed) {
				this._activeDialogueId = null;
				vscode.window.showInformationMessage('Workflow completed successfully.');
			}

			// Always refresh the view after a workflow cycle completes
			this._update();
		} finally {
			setWorkflowAbortSignal(undefined);
			this._workflowAbortController = null;
		}
	}

	/**
	 * Enable or disable the webview input area
	 */
	private _postInputEnabled(enabled: boolean): void {
		this._view?.webview.postMessage({
			type: 'setInputEnabled',
			data: { enabled },
		});
	}

	/**
	 * Signal the webview to show/hide the thinking spinner on the submit button.
	 * Used during Tier 2/3 LLM classification before the heavier setProcessing indicator.
	 */
	private _postInputThinking(active: boolean): void {
		this._view?.webview.postMessage({
			type: 'setInputThinking',
			data: { active },
		});
	}

	/**
	 * Persist a Q&A exchange to the database and render the card in the webview.
	 */
	private _persistAndRenderQa(question: string, answer: string): void {
		if (this._activeDialogueId) {
			const wsResult = getWorkflowState(this._activeDialogueId);
			const phase = wsResult.success ? wsResult.value.current_phase : undefined;
			writeQaExchange({ dialogueId: this._activeDialogueId, question, answer, phase });
		}
		this._view?.webview.postMessage({
			type: 'qaExchangeAdded',
			data: { question, answer, timestamp: new Date().toISOString() },
		});
	}

	/**
	 * Persist a Q&A exchange to the database only (no webview message).
	 * Used when the card is already rendered via the thinking lifecycle.
	 */
	private _persistQaOnly(question: string, answer: string): void {
		if (this._activeDialogueId) {
			const wsResult = getWorkflowState(this._activeDialogueId);
			const phase = wsResult.success ? wsResult.value.current_phase : undefined;
			writeQaExchange({ dialogueId: this._activeDialogueId, question, answer, phase });
		}
	}

	/** Create a Q&A card with the question header and a spinner body. */
	private _postQaThinkingStart(question: string): void {
		this._view?.webview.postMessage({
			type: 'qaThinkingStart',
			data: { question, timestamp: new Date().toISOString() },
		});
	}

	/** Append a progress step to the thinking Q&A card. */
	private _postQaThinkingProgress(step: string): void {
		this._view?.webview.postMessage({
			type: 'qaThinkingProgress',
			data: { step },
		});
	}

	/** Replace the thinking body with the final formatted answer. */
	private _postQaThinkingComplete(answer: string): void {
		this._view?.webview.postMessage({
			type: 'qaThinkingComplete',
			data: { answer, timestamp: new Date().toISOString() },
		});
	}

	/**
	 * Show or hide the processing indicator in the webview
	 */
	private _postProcessing(active: boolean, phase?: string, detail?: string): void {
		if (phase !== undefined) { this._processingPhase = phase; }
		if (detail !== undefined) { this._processingDetail = detail; }
		this._view?.webview.postMessage({
			type: 'setProcessing',
			data: { active, phase: phase ?? this._processingPhase, detail: detail ?? this._processingDetail },
		});
	}

	/**
	 * Handle INTAKE finalize plan request.
	 * Sets sub-state to SYNTHESIZING and runs the workflow cycle.
	 */
	/**
	 * Handle retry of a failed workflow phase.
	 * Re-runs the workflow cycle — the orchestrator will check for cached raw output
	 * and attempt re-parse before falling through to a fresh CLI invocation.
	 */
	private async _handleRetryPhase(): Promise<void> {
		if (!this._activeDialogueId || this._isProcessing) {
			return;
		}

		this._isProcessing = true;
		this._postInputEnabled(false);
		this._postProcessing(true, 'Retrying', 'Re-executing failed phase');

		try {
			await this._runWorkflowCycle();
		} finally {
			this._isProcessing = false;
			this._postProcessing(false);
			this._postInputEnabled(true);
		}
	}

	/**
	 * Handle user cancel/abort command.
	 * Kills all active CLI processes, stops the permission bridge,
	 * resets the UI processing state, and shows a cancellation message.
	 */
	private async _handleCancel(): Promise<void> {
		// Abort the workflow cycle — this kills CLI processes via AbortSignal
		this._workflowAbortController?.abort();
		this._workflowAbortController = null;

		// Also kill any processes not covered by the signal (e.g. started before this cycle)
		const killed = killAllActiveProcesses();

		// Stop permission bridge if active
		const bridge = getActivePermissionBridge();
		if (bridge) {
			await bridge.stop().catch(() => {});
			setActivePermissionBridge(null);
		}

		// Reset UI processing state
		this._isProcessing = false;
		this._postProcessing(false);
		this._postInputEnabled(true);

		// Show cancellation message in the stream
		const detail = killed > 0 ? ` (${killed} process${killed > 1 ? 'es' : ''} terminated)` : '';
		this._view?.webview.postMessage({
			type: 'systemMessage',
			data: { message: `Workflow cancelled by user${detail}. You can start a new task or resume.` },
		});

		// Refresh view to show current state
		this._update();
	}

	private async _handleIntakeFinalize(): Promise<void> {
		if (!this._activeDialogueId || this._isProcessing) {
			return;
		}

		this._isProcessing = true;
		this._postInputEnabled(false);
		this._postProcessing(true, 'Finalizing', 'Synthesizing plan from conversation');

		try {
			updateIntakeConversation(this._activeDialogueId, {
				subState: IntakeSubState.SYNTHESIZING,
			});
			await this._runWorkflowCycle();
		} finally {
			this._isProcessing = false;
			this._postProcessing(false);
			this._postInputEnabled(true);
		}
	}

	/**
	 * Handle INTAKE plan approval.
	 * Sets sub-state to AWAITING_APPROVAL and runs the workflow cycle to transition to PROPOSE.
	 */
	private async _handleIntakeApprove(): Promise<void> {
		if (!this._activeDialogueId || this._isProcessing) {
			return;
		}

		this._isProcessing = true;
		this._postInputEnabled(false);
		this._postProcessing(true, 'Approving', 'Approving plan and advancing to Architecture');

		try {
			console.log('[GovernedStream] _handleIntakeApprove: starting workflow cycle');
			// Sub-state should already be AWAITING_APPROVAL — cycle runs approval + transitions to ARCHITECTURE
			await this._runWorkflowCycle();
			console.log('[GovernedStream] _handleIntakeApprove: workflow cycle complete');
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error('[GovernedStream] _handleIntakeApprove error:', msg);
			vscode.window.showErrorMessage(`Plan approval error: ${msg}`);
		} finally {
			this._isProcessing = false;
			this._postProcessing(false);
			this._postInputEnabled(true);
			this._update();
		}
	}

	/**
	 * Handle reverting from AWAITING_APPROVAL back to DISCUSSING.
	 * Allows the Human to continue refining the plan.
	 */
	private _handleIntakeContinueDiscussing(): void {
		if (!this._activeDialogueId) {
			return;
		}

		updateIntakeConversation(this._activeDialogueId, {
			subState: IntakeSubState.DISCUSSING,
		});
		this._update();
	}

	/**
	 * Handle skipping the GATHERING sub-state — transition directly to DISCUSSING.
	 */
	private _handleIntakeSkipGathering(): void {
		if (!this._activeDialogueId) {
			return;
		}

		updateIntakeConversation(this._activeDialogueId, {
			subState: IntakeSubState.DISCUSSING,
		});

		getEventBus().emit('intake:gathering_skipped', {
			dialogueId: this._activeDialogueId,
		});

		this._update();
	}

	private _handleIntakeModeSelected(mode: string): void {
		if (!this._activeDialogueId) {
			return;
		}

		// Validate mode string
		const validModes = Object.values(IntakeMode) as string[];
		if (!validModes.includes(mode)) {
			return;
		}

		const updates: Record<string, unknown> = {
			intakeMode: mode as IntakeMode,
		};

		// When switching to STATE_DRIVEN, set currentDomain to the first uncovered domain
		if (mode === IntakeMode.STATE_DRIVEN) {
			const convResult = getOrCreateIntakeConversation(this._activeDialogueId);
			if (convResult.success && convResult.value.domainCoverage) {
				const gaps = getCoverageGaps(convResult.value.domainCoverage);
				const partials = getPartialDomains(convResult.value.domainCoverage);
				const firstTarget = gaps.length > 0 ? gaps[0]
					: partials.length > 0 ? partials[0]
					: DOMAIN_SEQUENCE[0];
				updates.currentDomain = firstTarget;
			} else {
				updates.currentDomain = DOMAIN_SEQUENCE[0];
			}
		}

		updateIntakeConversation(this._activeDialogueId, updates);

		const bus = getEventBus();
		bus.emit('intake:mode_selected', {
			dialogueId: this._activeDialogueId,
			mode: mode as IntakeMode,
			source: 'user' as const,
		});

		this._update();
	}

	/**
	 * Handle an architecture gate decision (Approve / Revise / Skip) from the webview buttons.
	 */
	private async _handleArchitectureGateDecision(message: { type: string; [key: string]: unknown }): Promise<void> {
		if (!this._activeDialogueId || this._isProcessing) {
			return;
		}

		const action = message.action as string;
		const dialogueId = message.dialogueId as string;
		const docId = message.docId as string;
		const feedback = message.feedback as string | undefined;

		if (!action || !dialogueId) {
			return;
		}

		// Find the architecture gate for this dialogue
		const gates = getGatesForDialogue(dialogueId);
		if (!gates.success) {
			vscode.window.showErrorMessage('Failed to find architecture gate');
			return;
		}
		const pendingGate = gates.value.find(g => g.status === GateStatus.OPEN);
		if (!pendingGate) {
			vscode.window.showErrorMessage('No pending architecture gate found');
			return;
		}

		// Record human decision for audit trail and resolvedAction tracking
		const { captureHumanDecision } = await import('../../roles/human.js');
		const humanAction = action === 'APPROVE' ? HumanAction.APPROVE
			: action === 'SKIP' ? HumanAction.OVERRIDE
			: HumanAction.REFRAME;
		const rationale = action === 'REVISE'
			? (feedback || 'Requested architecture changes')
			: `Architecture ${action.toLowerCase()}`;
		const decisionResult = captureHumanDecision({
			gateId: pendingGate.gate_id,
			action: humanAction,
			rationale,
			decisionMaker: 'human-user',
		});

		// Resolve the gate
		const decisionId = decisionResult.success ? decisionResult.value.decision_id : `arch-${action.toLowerCase()}-${Date.now()}`;
		resolveGate({
			gateId: pendingGate.gate_id,
			decisionId,
			resolution: action === 'APPROVE' ? 'approved'
				: action === 'SKIP' ? 'skipped'
				: `revision requested: ${feedback?.substring(0, 100) ?? ''}`,
		});

		// Call the architecture-specific handler
		const { handleArchitectureGateResolution } = await import('../../workflow/architecturePhase.js');
		const result = handleArchitectureGateResolution(
			dialogueId,
			action as 'APPROVE' | 'REVISE' | 'SKIP',
			feedback
		);

		if (!result.success) {
			vscode.window.showErrorMessage(`Architecture gate decision failed: ${result.error.message}`);
			return;
		}

		const { nextPhase } = result.value;

		this._update();

		// If transitioning to PROPOSE or staying in ARCHITECTURE, resume workflow
		if (nextPhase) {
			// Transition to the next phase
			transitionWorkflow(dialogueId, nextPhase, TransitionTrigger.GATE_RESOLVED);
			await this._resumeAfterGate();
		} else {
			// Staying in ARCHITECTURE (REVISE → loop back to DESIGNING)
			await this._resumeAfterGate();
		}
	}

	/**
	 * Handle a "Decompose Deeper" request from the webview.
	 * Resolves the current architecture gate and sets up the deeper decomposition pass.
	 */
	private async _handleArchitectureDecomposeDeeper(message: { type: string; [key: string]: unknown }): Promise<void> {
		if (!this._activeDialogueId || this._isProcessing) {
			return;
		}

		const dialogueId = message.dialogueId as string;

		if (!dialogueId) {
			return;
		}

		// Find and resolve the pending architecture gate
		const gates = getGatesForDialogue(dialogueId);
		if (!gates.success) {
			vscode.window.showErrorMessage('Failed to find architecture gate');
			return;
		}
		const pendingGate = gates.value.find(g => g.status === GateStatus.OPEN);
		if (!pendingGate) {
			vscode.window.showErrorMessage('No pending architecture gate found');
			return;
		}

		// Record human decision
		const { captureHumanDecision } = await import('../../roles/human.js');
		const decisionResult = captureHumanDecision({
			gateId: pendingGate.gate_id,
			action: HumanAction.REFRAME,
			rationale: 'Requested deeper decomposition',
			decisionMaker: 'human-user',
		});

		const decisionId = decisionResult.success ? decisionResult.value.decision_id : `arch-deepen-${Date.now()}`;
		resolveGate({
			gateId: pendingGate.gate_id,
			decisionId,
			resolution: 'decompose deeper requested',
		});

		// Set up the deeper decomposition
		const { handleArchitectureDecomposeDeeper } = await import('../../workflow/architecturePhase.js');
		const result = handleArchitectureDecomposeDeeper(dialogueId);

		if (!result.success) {
			vscode.window.showErrorMessage(`Decompose deeper failed: ${result.error.message}`);
			return;
		}

		this._update();
		await this._resumeAfterGate();
	}

	/**
	 * Handle partial MMP save — persists in-progress decisions to SQLite
	 * so they survive VS Code restarts.
	 */
	private _handleMmpPartialSave(message: { type: string; [key: string]: unknown }): void {
		if (!this._activeDialogueId) return;
		try {
			const { savePendingMmpDecisions } = require('../../database/pendingMmpStore');
			savePendingMmpDecisions(
				this._activeDialogueId,
				message.cardId as string,
				{
					mirrorDecisions: message.mirrorDecisions as Record<string, { status: string; editedText?: string }> || {},
					menuSelections: message.menuSelections as Record<string, { selectedOptionId: string; customResponse?: string }> || {},
					preMortemDecisions: message.preMortemDecisions as Record<string, { status: string; rationale?: string }> || {},
					productEdits: message.productEdits as Record<string, string> || {},
				}
			);
		} catch { /* non-critical — fail silently */ }
	}

	/**
	 * Handle MMP (Mirror & Menu Protocol) submission from the webview.
	 * Formats decisions as structured text and feeds them back into the INTAKE cycle.
	 */
	private async _handleMMPSubmit(message: { type: string; [key: string]: unknown }): Promise<void> {
		if (!this._activeDialogueId || this._isProcessing) {
			return;
		}

		const mirrorDecisions = message.mirrorDecisions as Record<string, { status: string; editedText?: string; text?: string }> || {};
		const menuSelections = message.menuSelections as Record<string, { selectedOptionId: string; customResponse?: string; question?: string; selectedLabel?: string }> || {};
		const preMortemDecisions = message.preMortemDecisions as Record<string, { status: string; rationale?: string; assumption?: string }> || {};

		// Format decisions as structured text for the next conversation turn.
		// Include the human-readable text so the agent can interpret decisions without
		// needing to look up opaque IDs.
		const lines: string[] = ['[MMP Decisions]'];

		// Mirror decisions
		const mirrorEntries = Object.entries(mirrorDecisions);
		if (mirrorEntries.length > 0) {
			for (const [id, decision] of mirrorEntries) {
				const text = decision.text ? `"${decision.text}"` : id;
				if (decision.status === 'accepted') {
					lines.push(`ACCEPTED: ${text}`);
				} else if (decision.status === 'rejected') {
					lines.push(`REJECTED: ${text}`);
				} else if (decision.status === 'deferred') {
					lines.push(`DEFERRED: ${text}`);
				} else if (decision.status === 'edited' && decision.editedText) {
					lines.push(`EDITED: ${text} → "${decision.editedText}"`);
				}
			}
		}

		// Menu selections
		const menuEntries = Object.entries(menuSelections);
		if (menuEntries.length > 0) {
			for (const [id, selection] of menuEntries) {
				const question = selection.question ? `"${selection.question}"` : id;
				if (selection.selectedOptionId === 'OTHER' && selection.customResponse) {
					lines.push(`SELECTED: ${question} → OTHER: "${selection.customResponse}"`);
				} else {
					const label = selection.selectedLabel || selection.selectedOptionId;
					lines.push(`SELECTED: ${question} → "${label}"`);
				}
			}
		}

		// Pre-Mortem decisions
		const pmEntries = Object.entries(preMortemDecisions);
		if (pmEntries.length > 0) {
			for (const [id, decision] of pmEntries) {
				const text = decision.assumption ? `"${decision.assumption}"` : id;
				if (decision.status === 'accepted') {
					lines.push(`RISK_ACCEPTED: ${text}`);
				} else if (decision.status === 'rejected') {
					lines.push(`RISK_REJECTED: ${text}${decision.rationale ? ' — Reason: "' + decision.rationale + '"' : ''}`);
				}
			}
		}

		// Product discovery inline edits (vision/description corrections)
		const productEdits = message.productEdits as Record<string, string> | undefined;
		if (productEdits) {
			for (const [field, value] of Object.entries(productEdits)) {
				if (value) {
					lines.push(`PRODUCT_EDIT (${field}): "${value}"`);
				}
			}
		}

		const formattedText = lines.join('\n');

		// Delete pending partial decisions now that the user has committed
		try {
			const { deletePendingMmpDecisions } = require('../../database/pendingMmpStore');
			const cardId = message.cardId as string;
			if (cardId) { deletePendingMmpDecisions(this._activeDialogueId, cardId); }
		} catch { /* non-critical */ }

		// Route through the normal INTAKE submission path
		this._isProcessing = true;
		this._postInputEnabled(false);
		this._postProcessing(true, 'Planning', 'Processing your decisions');

		try {
			updateWorkflowMetadata(this._activeDialogueId, {
				pendingIntakeInput: formattedText,
			});

			writeDialogueEvent({
				dialogue_id: this._activeDialogueId,
				event_type: 'human_message',
				role: 'HUMAN',
				phase: 'INTAKE',
				speech_act: 'DECISION',
				summary: `MMP decisions: ${mirrorEntries.length} mirror, ${menuEntries.length} menu, ${pmEntries.length} risk`,
				content: formattedText,
			});

			this._postProcessing(true, 'Planning', 'Discussing with Technical Expert');
			await this._runWorkflowCycle();
		} finally {
			this._isProcessing = false;
			this._postProcessing(false);
			this._postInputEnabled(true);
		}
	}

	/**
	 * Handle MMP decisions submitted from a review gate context.
	 * Converts MMP pre-mortem/menu/mirror decisions into the itemRationales
	 * format expected by _handleReviewGateDecision.
	 */
	private async _handleReviewMmpDecision(
		message: { type: string; [key: string]: unknown },
	): Promise<void> {
		const gateId = message.gateId as string;
		if (!gateId || !this._activeDialogueId) { return; }

		// Delete pending partial decisions
		try {
			const { deletePendingMmpDecisions } = require('../../database/pendingMmpStore');
			const cardId = message.cardId as string;
			if (cardId) { deletePendingMmpDecisions(this._activeDialogueId, cardId); }
		} catch { /* non-critical */ }

		const preMortemDecisions = (message.preMortemDecisions ?? {}) as Record<
			string, { status: string; rationale?: string; assumption?: string }
		>;
		const menuSelections = (message.menuSelections ?? {}) as Record<
			string, { selectedOptionId: string; customResponse?: string; question?: string; selectedLabel?: string }
		>;

		// Convert MMP decisions to itemRationales keyed by claim_id
		const itemRationales: Record<string, string> = {};
		let hasRejectedRisks = false;

		// Pre-mortem items: REV-RISK-{claim_id} → extract claim_id
		for (const [id, decision] of Object.entries(preMortemDecisions)) {
			const claimId = id.startsWith('REV-RISK-') ? id.substring('REV-RISK-'.length) : null;
			if (!claimId || claimId.startsWith('FINDING-')) { continue; }

			if (decision.status === 'accepted') {
				itemRationales[claimId] = `[MMP] Risk accepted: ${decision.assumption ?? 'claim risk acknowledged'}`;
			} else {
				hasRejectedRisks = true;
				const reason = decision.rationale ? ` — ${decision.rationale}` : '';
				itemRationales[claimId] = `[MMP] Risk rejected: ${decision.assumption ?? 'claim risk blocked'}${reason}`;
			}
		}

		// Menu items: REV-MENU-{claim_id} → extract claim_id
		for (const [id, selection] of Object.entries(menuSelections)) {
			const claimId = id.startsWith('REV-MENU-') ? id.substring('REV-MENU-'.length) : null;
			if (!claimId) { continue; }

			const label = selection.selectedLabel || selection.selectedOptionId;
			if (label === 'Block on this') { hasRejectedRisks = true; }
			itemRationales[claimId] = `[MMP] Decision: ${label}`;
		}

		// Build overall feedback summary
		const overallParts = Object.entries(itemRationales).map(
			([key, rationale]) => `${key}: ${rationale}`
		);
		const overallFeedback = overallParts.length > 0
			? `[MMP Review Decisions]\n${overallParts.join('\n')}`
			: 'MMP review decisions submitted';

		const action = hasRejectedRisks ? 'REFRAME' : 'APPROVE';
		await this._handleReviewGateDecision(gateId, action, itemRationales, overallFeedback);
	}

	/**
	 * Resume an abandoned dialogue — sets it back to ACTIVE and switches to it.
	 */
	private _handleResumeDialogue(dialogueId: string): void {
		const result = resumeDialogue(dialogueId);
		if (!result.success) {
			vscode.window.showErrorMessage(`Failed to resume dialogue: ${result.error.message}`);
			return;
		}

		this._activeDialogueId = dialogueId;
		emitDialogueResumed(dialogueId);
		this._update();
	}

	/**
	 * Switch the view to a different dialogue (view-only, no status change).
	 */
	private _handleSwitchDialogue(dialogueId: string): void {
		this._activeDialogueId = dialogueId;
		this._update();
	}

	/**
	 * Clear all dialogue data after user confirmation.
	 */
	private async _handleClearDatabase(): Promise<void> {
		const confirm = await vscode.window.showWarningMessage(
			'Are you sure you want to clear all history? This will delete all dialogues, claims, and workflow data. This cannot be undone.',
			{ modal: true },
			'Clear All History'
		);

		if (confirm !== 'Clear All History') {
			return;
		}

		const result = clearAllData();
		if (!result.success) {
			vscode.window.showErrorMessage(`Failed to clear database: ${result.error.message}`);
			return;
		}

		this._activeDialogueId = null;
		this._update();
		vscode.window.showInformationMessage('All history has been cleared.');
	}

	/**
	 * Export the governed stream to a markdown file for debugging
	 */
	private async _handleExportStream(): Promise<void> {
		const { exportDialogueMarkdown } = await import('../../export/streamExporter.js');
		const { aggregateStreamState } = await import('./dataAggregator.js');

		const state = aggregateStreamState(this._activeDialogueId ?? undefined);
		const dialogueId = this._activeDialogueId ?? 'all';

		const markdown = exportDialogueMarkdown(dialogueId, state, {
			scope: this._activeDialogueId ? 'current_dialogue' : 'all_dialogues',
			includeStdin: true,
			includeCommandOutput: true,
		});

		const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-').substring(0, 19);
		const filename = `governed-stream-${dialogueId.substring(0, 8)}-${timestamp}.md`;

		// Write to docs/exports directory
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			vscode.window.showErrorMessage('No workspace folder open. Cannot export stream.');
			return;
		}

		const exportDir = vscode.Uri.joinPath(workspaceFolders[0].uri, 'docs', 'exports');
		await vscode.workspace.fs.createDirectory(exportDir);

		const filePath = vscode.Uri.joinPath(exportDir, filename);
		await vscode.workspace.fs.writeFile(filePath, Buffer.from(markdown, 'utf-8'));

		// Open the file
		const doc = await vscode.workspace.openTextDocument(filePath);
		await vscode.window.showTextDocument(doc);

		vscode.window.showInformationMessage(`Exported governed stream to ${filename}`);
	}

	/**
	 * Generate a prose document from the current dialogue's structured data.
	 * Shows a QuickPick of available document types, calls the LLM, stores
	 * the result in SQLite, and opens it in a read-only editor tab.
	 */
	private async _handleGenerateDocument(): Promise<void> {
		const dialogueId = this._activeDialogueId;
		if (!dialogueId) {
			vscode.window.showWarningMessage('No active dialogue. Start a dialogue first.');
			return;
		}

		// Lazy imports to avoid loading document modules at startup
		const { getAvailableDocuments } = await import('../../documents/registry.js');
		const { generateDocument } = await import('../../documents/generator.js');
		const { upsertGeneratedDocument } = await import('../../documents/documentStore.js');

		// Get available document types for this dialogue
		const available = getAvailableDocuments(dialogueId);
		if (available.length === 0) {
			vscode.window.showInformationMessage(
				'No document types are available for this dialogue yet. ' +
				'The dialogue needs to progress past INTAKE before documents can be generated.'
			);
			return;
		}

		// Show multi-select QuickPick
		const picked = await vscode.window.showQuickPick(
			available.map(def => ({
				label: def.label,
				description: def.type,
				detail: def.description,
				definition: def,
			})),
			{
				placeHolder: 'Select one or more document types to generate',
				title: 'Generate Documents',
				canPickMany: true,
			}
		);

		if (!picked || picked.length === 0) {
			return; // user cancelled
		}

		// Generate all selected documents with progress
		const results = await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: `Generating ${picked.length} document(s)...`,
				cancellable: false,
			},
			async (progress) => {
				const generated: Array<{ title: string; content: string; label: string }> = [];
				for (let i = 0; i < picked.length; i++) {
					const item = picked[i];
					progress.report({
						message: `(${i + 1}/${picked.length}) ${item.label}`,
						increment: (100 / picked.length),
					});

					try {
						const result = await generateDocument(dialogueId, item.definition);

						// Store in SQLite (upsert)
						upsertGeneratedDocument(
							dialogueId,
							result.documentType,
							result.title,
							result.content,
						);

						generated.push({ title: result.title, content: result.content, label: item.label });
					} catch (err) {
						const msg = err instanceof Error ? err.message : String(err);
						vscode.window.showErrorMessage(`Failed to generate ${item.label}: ${msg}`);
					}
				}
				return generated;
			}
		);

		if (results.length === 0) {
			return;
		}

		// Open each generated document in an editor tab
		for (const result of results) {
			const doc = await vscode.workspace.openTextDocument({
				content: result.content,
				language: 'markdown',
			});
			await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
		}

		// Offer batch export
		const labels = results.map(r => r.label).join(', ');
		const exportChoice = await vscode.window.showInformationMessage(
			`Generated: ${labels}`,
			'Export All to Files',
			'Dismiss'
		);

		if (exportChoice === 'Export All to Files') {
			for (const result of results) {
				await this._exportDocumentContent(result.title, result.content);
			}
		}
	}

	/**
	 * Export a document's markdown content to a user-chosen file.
	 */
	private async _exportDocumentContent(title: string, content: string): Promise<void> {
		const suggestedName = title.toLowerCase().replaceAll(/\s+/g, '-') + '.md';
		const uri = await vscode.window.showSaveDialog({
			defaultUri: vscode.Uri.file(suggestedName),
			filters: { 'Markdown': ['md'] },
			title: 'Export Document',
		});

		if (!uri) {
			return;
		}

		await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
		vscode.window.showInformationMessage(`Document exported to ${uri.fsPath}`);
	}

	/**
	 * Handle a gate decision from the webview
	 */
	private _handleGateDecision(gateId: string, action: string, rationale: string): void {
		if (rationale.length < 10) {
			vscode.window.showWarningMessage('Rationale must be at least 10 characters.');
			return;
		}

		const humanAction = action as HumanAction;
		if (!Object.values(HumanAction).includes(humanAction)) {
			vscode.window.showErrorMessage(`Invalid action: ${action}`);
			return;
		}

		const input: HumanGateDecisionInput = {
			gateId,
			action: humanAction,
			rationale,
			decisionMaker: 'human-user',
		};

		const result = processHumanGateDecision(input);

		if (result.success) {
			vscode.window.showInformationMessage(`Gate ${action.toLowerCase()}d successfully.`);
			this._update();
			// Fire-and-forget: curate human feedback for future agent context
			if (this._activeDialogueId) {
				runNarrativeCuration(this._activeDialogueId, CurationMode.FEEDBACK).catch(() => {});
			}
		} else {
			vscode.window.showErrorMessage(`Gate decision failed: ${result.error.message}`);
		}
	}

	/**
	 * Handle a gate decision from the webview card buttons.
	 * Wraps the generic gate decision with repair-escalation awareness:
	 * if the gate is a repair escalation, reset the failed unit to READY and resume.
	 */
	private async _handleGateDecisionAndResume(
		gateId: string,
		action: string,
		rationale: string
	): Promise<void> {
		// Read gate metadata BEFORE resolving (so we know what kind of gate this is)
		let isRepairEscalation = false;
		let repairUnitId: string | undefined;
		try {
			const db = getDatabase();
			if (db) {
				const row = db.prepare(
					'SELECT metadata FROM gate_metadata WHERE gate_id = ?'
				).get(gateId) as { metadata: string } | undefined;
				if (row) {
					const meta = JSON.parse(row.metadata) as Record<string, unknown>;
					if (meta.condition === 'REPAIR_ESCALATION') {
						isRepairEscalation = true;
						repairUnitId = meta.unit_id as string | undefined;
					}
				}
			}
		} catch { /* metadata read failed — proceed without repair handling */ }

		// Reset the failed unit to READY before resolving the gate
		if (isRepairEscalation && repairUnitId) {
			const { updateTaskUnitStatus } = await import('../../database/makerStore.js');
			const { TaskUnitStatus } = await import('../../types/maker.js');
			updateTaskUnitStatus(repairUnitId, TaskUnitStatus.READY);
		}

		// Resolve the gate via the generic handler
		this._handleGateDecision(gateId, action, rationale);

		// Resume workflow if this was a repair escalation
		if (isRepairEscalation) {
			await this._resumeAfterGate();
		}
	}

	/**
	 * Handle a verification gate decision from the webview
	 */
	private async _handleVerificationGateDecision(
		gateId: string,
		action: string,
		claimRationales?: Record<string, string>
	): Promise<void> {
		if (!this._activeDialogueId) {
			return;
		}

		switch (action) {
			case 'OVERRIDE': {
				// Store per-claim override events for audit trail
				if (claimRationales) {
					for (const [claimId, rationale] of Object.entries(claimRationales)) {
						if (rationale && rationale.trim().length > 0) {
							writeClaimEvent({
								claim_id: claimId,
								event_type: ClaimEventType.OVERRIDDEN,
								source: Role.HUMAN,
								evidence_ref: rationale.trim(),
							});
						}
					}
				}

				// Build combined rationale from per-claim responses
				const combinedRationale = Object.entries(claimRationales ?? {})
					.filter(([, r]) => r.trim().length > 0)
					.map(([id, r]) => `[${id}]: ${r.trim()}`)
					.join('\n');

				// Resolve gate via existing infrastructure
				const input: HumanGateDecisionInput = {
					gateId,
					action: HumanAction.OVERRIDE,
					rationale: combinedRationale || 'Risk accepted by human',
					decisionMaker: 'human-user',
				};
				const result = processHumanGateDecision(input);

				if (result.success) {
					vscode.window.showInformationMessage('Verification risks accepted. Continuing workflow.');
					await this._resumeAfterGate();
				} else {
					vscode.window.showErrorMessage(`Gate decision failed: ${result.error.message}`);
				}
				break;
			}

			case 'RETRY_VERIFY': {
				// Resolve the gate so workflow can re-enter VERIFY
				const gateResult = getGate(gateId);
				if (!gateResult.success) {
					vscode.window.showErrorMessage(`Failed to get gate: ${gateResult.error.message}`);
					return;
				}

				// Capture decision for audit
				const retryInput: HumanGateDecisionInput = {
					gateId,
					action: HumanAction.REJECT,
					rationale: 'Retrying verification — claims reset to OPEN',
					decisionMaker: 'human-user',
				};
				const decisionResult = processHumanGateDecision(retryInput);

				// REJECT doesn't auto-resolve, so resolve manually
				if (decisionResult.success) {
					resolveGate({
						gateId,
						decisionId: decisionResult.value.decision_id,
						resolution: 'Retrying verification',
					});
				}

				// Reset blocking claims back to OPEN and delete old verdicts
				const db = getDatabase();
				if (db) {
					for (const claimId of gateResult.value.blocking_claims) {
						db.prepare('UPDATE claims SET status = ? WHERE claim_id = ?')
							.run(ClaimStatus.OPEN, claimId);
						db.prepare('DELETE FROM verdicts WHERE claim_id = ?')
							.run(claimId);
					}
				}

				// Re-run workflow cycle (stays in VERIFY since claims are OPEN again)
				this._isProcessing = true;
				this._postInputEnabled(false);
				this._postProcessing(true, 'Retrying verification', 'Re-verifying claims');
				try {
					await this._runWorkflowCycle();
				} finally {
					this._isProcessing = false;
					this._postProcessing(false);
					this._postInputEnabled(true);
				}
				break;
			}

			case 'REFRAME': {
				// Capture decision for audit
				const reframeInput: HumanGateDecisionInput = {
					gateId,
					action: HumanAction.REFRAME,
					rationale: 'User requested replanning after verification',
					decisionMaker: 'human-user',
				};
				const reframeResult = processHumanGateDecision(reframeInput);

				// REFRAME doesn't auto-resolve, so resolve manually
				if (reframeResult.success) {
					resolveGate({
						gateId,
						decisionId: reframeResult.value.decision_id,
						resolution: 'Replanning after verification failure',
					});
				}

				// Transition workflow to REPLAN
				transitionWorkflow(
					this._activeDialogueId,
					Phase.REPLAN,
					TransitionTrigger.REPLAN_REQUIRED,
					{ reason: 'Verification gate reframe' }
				);

				this._update();
				vscode.window.showInformationMessage('Workflow returned to replanning.');
				break;
			}
		}

		// Fire-and-forget: curate human feedback for future agent context
		runNarrativeCuration(this._activeDialogueId, CurationMode.FEEDBACK).catch(() => {});
	}

	/**
	 * Handle review gate decisions: APPROVE or REFRAME (request changes)
	 */
	private async _handleReviewGateDecision(
		gateId: string,
		action: string,
		itemRationales?: Record<string, string>,
		overallFeedback?: string
	): Promise<void> {
		if (!this._activeDialogueId) {
			return;
		}

		switch (action) {
			case 'APPROVE': {
				// Build combined rationale from per-item responses + overall
				const parts: string[] = [];
				if (itemRationales) {
					for (const [key, rationale] of Object.entries(itemRationales)) {
						if (rationale && rationale.trim().length > 0) {
							parts.push(`[${key}]: ${rationale.trim()}`);

							// Write claim override events for claim-type keys (contain hyphens like UUIDs)
							if (!key.startsWith('finding-')) {
								writeClaimEvent({
									claim_id: key,
									event_type: ClaimEventType.OVERRIDDEN,
									source: Role.HUMAN,
									evidence_ref: rationale.trim(),
								});
							}
						}
					}
				}
				if (overallFeedback && overallFeedback.trim()) {
					parts.push(`[Overall]: ${overallFeedback.trim()}`);
				}

				const combinedRationale = parts.join('\n') || 'Approved after review';

				// Resolve gate via existing infrastructure
				const input: HumanGateDecisionInput = {
					gateId,
					action: HumanAction.APPROVE,
					rationale: combinedRationale,
					decisionMaker: 'human-user',
				};
				const result = processHumanGateDecision(input);

				if (result.success) {
					// Transition from REVIEW → EXECUTE so the next workflow cycle
					// runs executeExecutePhase instead of re-entering executeReviewPhase.
					transitionWorkflow(
						this._activeDialogueId!,
						Phase.EXECUTE,
						TransitionTrigger.PHASE_COMPLETE
					);
					vscode.window.showInformationMessage('Review approved. Continuing to execution.');
					await this._resumeAfterGate();
				} else {
					vscode.window.showErrorMessage(`Review decision failed: ${result.error.message}`);
				}
				break;
			}

			case 'REFRAME': {
				// Build combined rationale from per-item responses + overall feedback
				const reframeParts: string[] = [];
				if (itemRationales) {
					for (const [key, rat] of Object.entries(itemRationales)) {
						if (rat && rat.trim().length > 0) {
							reframeParts.push(`[${key}]: ${rat.trim()}`);

							// Record human feedback as claim events for audit trail
							if (!key.startsWith('finding-')) {
								writeClaimEvent({
									claim_id: key,
									event_type: ClaimEventType.OVERRIDDEN,
									source: Role.HUMAN,
									evidence_ref: `Review feedback (reframe): ${rat.trim()}`,
								});
							}
						}
					}
				}
				if (overallFeedback && overallFeedback.trim()) {
					reframeParts.push(overallFeedback.trim());
				}
				const rationale = reframeParts.length > 0
					? reframeParts.join('\n')
					: 'Changes requested after review';

				const reframeInput: HumanGateDecisionInput = {
					gateId,
					action: HumanAction.REFRAME,
					rationale,
					decisionMaker: 'human-user',
				};
				const reframeResult = processHumanGateDecision(reframeInput);

				// REFRAME doesn't auto-resolve, so resolve manually
				if (reframeResult.success) {
					resolveGate({
						gateId,
						decisionId: reframeResult.value.decision_id,
						resolution: 'Changes requested after review',
					});
				}

				// Reset blocking CRITICAL claims to OPEN so the REPLAN → PROPOSE
				// cycle can proceed. The new proposal will surface fresh assumptions
				// that get re-verified, incorporating the human's review feedback.
				const reframeDb = getDatabase();
				if (reframeDb) {
					const blockingClaims = reframeDb.prepare(
						`SELECT claim_id FROM claims
						 WHERE dialogue_id = ?
						   AND criticality = 'CRITICAL'
						   AND (status = 'DISPROVED' OR status = 'UNKNOWN')`
					).all(this._activeDialogueId) as Array<{ claim_id: string }>;

					for (const { claim_id } of blockingClaims) {
						reframeDb.prepare('UPDATE claims SET status = ? WHERE claim_id = ?')
							.run(ClaimStatus.OPEN, claim_id);
						reframeDb.prepare('DELETE FROM verdicts WHERE claim_id = ?')
							.run(claim_id);
					}
				}

				// Store review feedback so the REPLAN → PROPOSE cycle can use it
				updateWorkflowMetadata(this._activeDialogueId, {
					replanRationale: rationale,
				});

				// Transition workflow to REPLAN
				transitionWorkflow(
					this._activeDialogueId,
					Phase.REPLAN,
					TransitionTrigger.REPLAN_REQUIRED,
					{ reason: 'Review gate: changes requested' }
				);

				vscode.window.showInformationMessage('Changes requested — replanning proposal.');
				await this._resumeAfterGate();
				break;
			}
		}

		// Fire-and-forget: curate human feedback for future agent context
		if (this._activeDialogueId) {
			runNarrativeCuration(this._activeDialogueId, CurationMode.FEEDBACK).catch(() => {});
		}
	}

	/**
	 * Handle an inline clarification message from the webview.
	 * Makes a lightweight LLM call, persists the thread, and posts the response back.
	 */
	private async _handleClarificationMessage(message: { [key: string]: unknown }): Promise<void> {
		const itemId = message.itemId as string;
		const itemContext = message.itemContext as string;
		const history = message.history as Array<{ role: 'user' | 'assistant'; content: string }>;

		if (!this._activeDialogueId) {
			this._view?.webview.postMessage({
				type: 'clarificationResponse',
				itemId,
				error: 'No active dialogue',
			});
			return;
		}

		const result = await askClarification(itemContext, history);

		if (result.success) {
			// Persist the full conversation (including the new assistant response) to DB
			const now = new Date().toISOString();
			const fullHistory = [
				...history.map((m) => ({ ...m, timestamp: now })),
				{ role: 'assistant' as const, content: result.value.content, timestamp: now },
			];
			saveClarificationThread(this._activeDialogueId, itemId, itemContext, fullHistory);
		}

		this._view?.webview.postMessage({
			type: 'clarificationResponse',
			itemId,
			response: result.success ? result.value.content : undefined,
			elapsedMs: result.success ? result.value.elapsedMs : undefined,
			model: result.success ? result.value.model : undefined,
			error: result.success ? undefined : result.error.message,
		});
	}

	/**
	 * Handle a permission decision from the webview.
	 * Emits the decision on the event bus so the permission bridge can resolve
	 * the pending Promise and respond to the MCP server.
	 */
	private _handlePermissionDecision(message: { [key: string]: unknown }): void {
		const permissionId = message.permissionId as string;
		const approved = message.approved as boolean;
		const approveAll = message.approveAll as boolean | undefined;

		if (!permissionId) { return; }

		getEventBus().emit('permission:decided', {
			permissionId,
			approved,
			approveAll,
			reason: approved ? 'Approved by human' : 'Denied by human',
		});
	}

	/**
	 * Resume the workflow cycle after a gate has been resolved
	 */
	private async _resumeAfterGate(): Promise<void> {
		if (!this._activeDialogueId) {
			return;
		}

		this._isProcessing = true;
		this._postInputEnabled(false);
		this._postProcessing(true, 'Resuming', 'Continuing workflow after gate resolution');

		try {
			await this._runWorkflowCycle();
		} finally {
			this._isProcessing = false;
			this._postProcessing(false);
			this._postInputEnabled(true);
		}
	}

	// ==================== SMART TEXT COMMANDS ====================

	/**
	 * Handle a parsed text command. Returns true if handled, false to fall through.
	 */
	private async _handleTextCommand(parsed: ParsedCommand): Promise<boolean> {
		if (!this._activeDialogueId) { return false; }

		switch (parsed.command) {
			case 'retry':
				return this._handleRetryCommand();
			case 'resume':
				return this._handleResumeCommand();
			case 'approve':
				return this._handleApproveCommand(parsed.args);
			case 'reframe':
				return this._handleReframeCommand(parsed.args);
			case 'override':
				return this._handleOverrideCommand(parsed.args);
			case 'save-output':
				return this._handleSaveOutputCommand(parsed.args);
			case 'navigate':
				return this._handleNavigateCommand(parsed.args);
			case 'adopt':
				return this._handleAdoptCommand();
			default:
				return false;
		}
	}

	/**
	 * Handle the "retry" command — assess retryable actions and execute or offer choices.
	 */
	private async _handleRetryCommand(): Promise<boolean> {
		if (!this._activeDialogueId) { return false; }

		const actions = assessRetryableActions(this._activeDialogueId);

		if (actions.length === 0) {
			this._postSystemMessage('Nothing to retry. No failed phases or open gates that support retry.');
			return true;
		}

		if (actions.length === 1) {
			await this._executeRetryAction(actions[0]);
			return true;
		}

		// Multiple retry options — show clickable chips
		this._postCommandOptions('retry', 'Multiple retry options available:', actions);
		return true;
	}

	/**
	 * Handle the "resume" command — resume workflow from where it stopped.
	 * Detects phase checkpoints, failed phases, gates, and stalled workflows.
	 */
	private async _handleResumeCommand(): Promise<boolean> {
		if (!this._activeDialogueId) { return false; }

		const wsResult = getWorkflowState(this._activeDialogueId);
		if (!wsResult.success) {
			this._postSystemMessage('No active workflow to resume.');
			return true;
		}

		const metadata = JSON.parse(wsResult.value.metadata);
		const currentPhase = wsResult.value.current_phase;

		// Case 1: Phase checkpoint with a failed step — resume from that step
		if (metadata.phaseCheckpoint?.phase === currentPhase) {
			const steps = metadata.phaseCheckpoint.steps as Record<string, { status: string }>;
			const failedStep = Object.entries(steps).find(([, s]) => s.status === 'failed');
			const completedCount = Object.values(steps).filter(s => s.status === 'completed').length;

			if (failedStep) {
				this._postSystemMessage(
					`Resuming ${currentPhase} from step: ${failedStep[0]} (${completedCount} steps already completed)`
				);
			} else {
				this._postSystemMessage(
					`Resuming ${currentPhase} (${completedCount} steps completed)`
				);
			}

			// Clear failure flags — PhaseRunner will handle step skipping
			updateWorkflowMetadata(this._activeDialogueId, {
				lastFailedPhase: undefined,
				lastError: undefined,
			});
			await this._resumeWorkflow();
			return true;
		}

		// Case 2: Failed phase recorded — resume the failed phase
		if (metadata.lastFailedPhase) {
			this._postSystemMessage(
				`Resuming from failed phase: ${metadata.lastFailedPhase}` +
				(metadata.lastError ? ` (${metadata.lastError})` : '')
			);
			updateWorkflowMetadata(this._activeDialogueId, {
				lastFailedPhase: undefined,
				lastError: undefined,
			});
			await this._resumeWorkflow();
			return true;
		}

		// Case 3: Open gates — need a decision, not resume
		const gatesResult = getGatesForDialogue(this._activeDialogueId, GateStatus.OPEN);
		const openGates = gatesResult.success ? gatesResult.value : [];
		if (openGates.length > 0) {
			this._postSystemMessage(
				'Workflow is waiting for a gate decision. Use "approve", "reframe", or "override".'
			);
			return true;
		}

		// Case 4: INTAKE phase — waiting for user input
		if (currentPhase === Phase.INTAKE) {
			this._postSystemMessage(
				'Workflow is in INTAKE phase, waiting for your input. Type your requirements or goals.'
			);
			return true;
		}

		// Case 5: Workflow at COMMIT — already completed
		if (currentPhase === Phase.COMMIT) {
			this._postSystemMessage('Workflow already completed.');
			return true;
		}

		// Case 6: Idle at a non-terminal, non-gated phase — try to advance
		this._postSystemMessage(`Resuming workflow from ${currentPhase} phase.`);
		await this._resumeWorkflow();
		return true;
	}

	/**
	 * Resume the workflow cycle with processing state management.
	 */
	private async _resumeWorkflow(): Promise<void> {
		if (!this._activeDialogueId || this._isProcessing) { return; }

		this._isProcessing = true;
		this._postInputEnabled(false);
		this._postProcessing(true, 'Resuming', 'Resuming workflow');

		try {
			await this._runWorkflowCycle();
		} finally {
			this._isProcessing = false;
			this._postProcessing(false);
			this._postInputEnabled(true);
		}
	}

	/**
	 * Handle the "approve" command — approve the current open gate or INTAKE plan.
	 */
	private async _handleApproveCommand(argsText: string): Promise<boolean> {
		if (!this._activeDialogueId) { return false; }

		const wsResult = getWorkflowState(this._activeDialogueId);
		if (!wsResult.success) { return false; }

		const currentPhase = wsResult.value.current_phase;

		// Check for open gates
		const gatesResult = getGatesForDialogue(this._activeDialogueId, GateStatus.OPEN);
		const openGates = gatesResult.success ? gatesResult.value : [];

		if (openGates.length === 0) {
			if (currentPhase === Phase.INTAKE) {
				await this._handleIntakeApprove();
				return true;
			}
			this._postSystemMessage('No open gates to approve.');
			return true;
		}

		const rationale = argsText.length >= 10
			? argsText
			: 'Approved via text command';

		const gate = openGates[0];

		if (currentPhase === Phase.REVIEW) {
			await this._handleReviewGateDecision(gate.gate_id, 'APPROVE', undefined, rationale);
		} else {
			this._handleGateDecision(gate.gate_id, 'APPROVE', rationale);
		}

		return true;
	}

	/**
	 * Handle the "reframe" command — reframe the current open gate.
	 */
	private async _handleReframeCommand(argsText: string): Promise<boolean> {
		if (!this._activeDialogueId) { return false; }

		const gatesResult = getGatesForDialogue(this._activeDialogueId, GateStatus.OPEN);
		const openGates = gatesResult.success ? gatesResult.value : [];

		if (openGates.length === 0) {
			this._postSystemMessage('No open gates to reframe.');
			return true;
		}

		const rationale = argsText.length >= 10
			? argsText
			: 'Reframe requested via text command';

		const gate = openGates[0];
		const wsResult = getWorkflowState(this._activeDialogueId);
		const currentPhase = wsResult.success ? wsResult.value.current_phase : '';

		if (currentPhase === Phase.REVIEW) {
			await this._handleReviewGateDecision(gate.gate_id, 'REFRAME', undefined, rationale);
		} else if (currentPhase === Phase.VERIFY) {
			await this._handleVerificationGateDecision(gate.gate_id, 'REFRAME');
		} else {
			this._handleGateDecision(gate.gate_id, 'REFRAME', rationale);
		}

		return true;
	}

	/**
	 * Handle the "override" command — override the current open gate.
	 */
	private async _handleOverrideCommand(argsText: string): Promise<boolean> {
		if (!this._activeDialogueId) { return false; }

		const gatesResult = getGatesForDialogue(this._activeDialogueId, GateStatus.OPEN);
		const openGates = gatesResult.success ? gatesResult.value : [];

		if (openGates.length === 0) {
			this._postSystemMessage('No open gates to override.');
			return true;
		}

		const rationale = argsText.length >= 10
			? argsText
			: 'Override via text command (risk accepted)';

		const gate = openGates[0];
		const wsResult = getWorkflowState(this._activeDialogueId);
		const currentPhase = wsResult.success ? wsResult.value.current_phase : '';

		if (currentPhase === Phase.VERIFY) {
			await this._handleVerificationGateDecision(gate.gate_id, 'OVERRIDE');
		} else {
			this._handleGateDecision(gate.gate_id, 'OVERRIDE', rationale);
		}

		return true;
	}

	/**
	 * Handle the "save-output" command — extract executor output from gate metadata and write to file.
	 */
	private async _handleSaveOutputCommand(argsText: string): Promise<boolean> {
		if (!this._activeDialogueId) { return false; }

		const filePath = argsText.trim();
		if (!filePath) {
			this._postSystemMessage('Usage: save <path> — specify the file path to write executor output to.');
			return true;
		}

		// Find the most recent open REPAIR_ESCALATION gate
		const gatesResult = getGatesForDialogue(this._activeDialogueId, GateStatus.OPEN);
		const openGates = gatesResult.success ? gatesResult.value : [];

		let executorOutput: string | undefined;

		// Try gate_metadata for executor_output
		for (const gate of openGates) {
			try {
				const db = getDatabase();
				if (!db) { continue; }
				const row = db.prepare(
					'SELECT metadata FROM gate_metadata WHERE gate_id = ?'
				).get(gate.gate_id) as { metadata: string } | undefined;
				if (row) {
					const meta = JSON.parse(row.metadata) as Record<string, unknown>;
					if (meta.executor_output && typeof meta.executor_output === 'string') {
						executorOutput = meta.executor_output;
						break;
					}
				}
			} catch { /* continue to next gate */ }
		}

		if (!executorOutput) {
			this._postSystemMessage('No executor output found in gate metadata. The gate may not have captured output.');
			return true;
		}

		// Resolve path relative to workspace root
		const workspaceFolders = vscode.workspace.workspaceFolders;
		const baseUri = workspaceFolders?.[0]?.uri;
		if (!baseUri) {
			this._postSystemMessage('No workspace folder open.');
			return true;
		}

		try {
			const targetUri = vscode.Uri.joinPath(baseUri, filePath);
			await vscode.workspace.fs.writeFile(targetUri, Buffer.from(executorOutput, 'utf-8'));
			this._postSystemMessage(`Executor output saved to ${filePath} (${executorOutput.length} chars)`);
		} catch (err) {
			this._postSystemMessage(`Failed to write file: ${err instanceof Error ? err.message : String(err)}`);
		}

		return true;
	}

	/**
	 * Handle a reasoning review re-run — re-invoke the last CLI agent with reviewer
	 * concerns (and optional user guidance) injected as correction context.
	 */
	private async _handleReviewRerun(guidance?: string): Promise<void> {
		if (!this._activeDialogueId) { return; }

		// Build correction text from the most recent reasoning review event
		const db = getDatabase();
		if (!db) { return; }

		const reviewEvent = db.prepare(`
			SELECT content, detail FROM dialogue_events
			WHERE dialogue_id = ? AND event_type = 'reasoning_review'
			ORDER BY event_id DESC LIMIT 1
		`).get(this._activeDialogueId) as { content: string; detail: string } | undefined;

		if (!reviewEvent) {
			this._postSystemMessage('No reasoning review found to re-run with.');
			return;
		}

		const detail = JSON.parse(reviewEvent.detail ?? '{}');
		const concerns = (detail.concerns ?? []) as Array<{ summary: string; recommendation: string }>;
		const corrections = concerns.map((c: { summary: string; recommendation: string }) =>
			`- ${c.summary}: ${c.recommendation}`
		).join('\n');

		const correctionText = [
			'[Reasoning Review Corrections]',
			corrections,
			...(guidance ? [`\n[Human Guidance]\n${guidance}`] : []),
		].join('\n');

		// Feed the corrections as input and re-run the workflow cycle
		updateWorkflowMetadata(this._activeDialogueId, {
			pendingIntakeInput: correctionText,
		});

		this._postSystemMessage('Re-running with reasoning review corrections...');
		this._isProcessing = true;
		this._postInputEnabled(false);
		this._postProcessing(true, 'Re-running', 'Applying reasoning corrections');

		try {
			await this._runWorkflowCycle();
		} finally {
			this._isProcessing = false;
			this._postProcessing(false);
			this._postInputEnabled(true);
		}
	}

	/**
	 * Handle an adopt command — inject cached CLI output into DB and advance workflow.
	 */
	private async _handleAdoptCommand(): Promise<boolean> {
		if (!this._activeDialogueId) { return false; }

		const { adoptCachedOutput } = await import('../../workflow/outputAdopter.js');

		this._postSystemMessage('Adopting cached CLI output...');

		const result = await adoptCachedOutput(this._activeDialogueId);

		if (!result.success) {
			this._postSystemMessage(`Adopt failed: ${result.error.message}`);
			return true;
		}

		const { parsedType, fieldsAdopted, warnings } = result.value;
		const fieldsStr = fieldsAdopted.join(', ');
		this._postSystemMessage(
			`Adopted ${parsedType}: ${fieldsStr}` +
			(warnings.length > 0 ? `\nWarnings: ${warnings.join('; ')}` : '')
		);

		// Refresh UI and resume workflow
		this._update();
		await this._runWorkflowCycle();

		return true;
	}

	/**
	 * Handle a navigation command — resolve the target, assess safety, and execute.
	 */
	private async _handleNavigateCommand(targetText: string): Promise<boolean> {
		if (!this._activeDialogueId || !targetText.trim()) return false;

		const { resolveNavigationTarget, assessNavigation, getAvailableTargets } = await import('../../workflow/navigationResolver.js');
		const { transitionWorkflow, updateWorkflowMetadata, getWorkflowState, TransitionTrigger } = await import('../../workflow/stateMachine.js');

		const wsResult = getWorkflowState(this._activeDialogueId);
		if (!wsResult.success) return false;
		const currentPhase = wsResult.value.current_phase as Phase;
		const metadata = wsResult.value.metadata ? JSON.parse(wsResult.value.metadata) : {};

		// Resolve fuzzy target
		const target = resolveNavigationTarget(targetText, currentPhase, metadata);
		if (!target) {
			this._postSystemMessage(
				`Could not resolve "${targetText}" to a known phase or sub-phase.\n${getAvailableTargets(currentPhase)}`
			);
			return true;
		}

		// Assess safety
		const assessment = assessNavigation(target, currentPhase, this._activeDialogueId);

		// Show warning for forward skips
		if (assessment.warning) {
			this._postSystemMessage(assessment.warning);
		}

		// Clean up open gates if going backward
		if (assessment.requiresGateCleanup) {
			try {
				const db = (await import('../../database/index.js')).getDatabase();
				if (db) {
					db.prepare(
						`UPDATE gates SET status = 'RESOLVED', resolution = ?, updated_at = datetime('now') WHERE dialogue_id = ? AND status = 'OPEN'`
					).run(`Superseded by navigation to ${target.majorPhase}${target.subPhase ? '/' + target.subPhase : ''}`, this._activeDialogueId);
				}
			} catch { /* non-critical */ }

			// Clear error metadata
			updateWorkflowMetadata(this._activeDialogueId, {
				lastFailedPhase: undefined,
				lastError: undefined,
			});
		}

		// Execute transition
		if (target.subPhase && target.subPhaseOwner) {
			// Ensure we're in the right major phase first
			if (currentPhase !== target.majorPhase) {
				transitionWorkflow(this._activeDialogueId, target.majorPhase, TransitionTrigger.MANUAL_OVERRIDE, {
					source: 'navigation',
				});
			}
			// Set the sub-phase
			if (target.subPhaseOwner === 'INTAKE') {
				const { updateIntakeConversation } = await import('../../events/writer.js');
				updateIntakeConversation(this._activeDialogueId, { subState: target.subPhase as import('../../types/intake').IntakeSubState });
			} else if (target.subPhaseOwner === 'ARCHITECTURE') {
				// If navigating to DECOMPOSING, clear existing architecture document
				// to avoid UNIQUE constraint violations on re-decomposition
				if (target.subPhase === 'DECOMPOSING' && metadata.architectureDocId) {
					try {
						const { deleteArchitectureDocument } = await import('../../database/architectureStore.js');
						deleteArchitectureDocument(metadata.architectureDocId);
					} catch { /* non-critical — document may not exist */ }
				}
				updateWorkflowMetadata(this._activeDialogueId, {
					architectureSubState: target.subPhase,
					architectureDocId: target.subPhase === 'DECOMPOSING' ? null : metadata.architectureDocId,
					humanFeedback: null,
					validationAttempts: 0,
				});
			}
		} else {
			// Major phase transition
			transitionWorkflow(this._activeDialogueId, target.majorPhase, TransitionTrigger.MANUAL_OVERRIDE, {
				source: 'navigation',
			});
		}

		const label = target.subPhase
			? `${target.majorPhase} \u2192 ${target.subPhase}`
			: target.majorPhase;
		this._postSystemMessage(`Navigating to ${label}...`);

		this._isProcessing = true;
		this._postInputEnabled(false);
		this._postProcessing(true, 'Navigating', `Moving to ${label}`);

		try {
			await this._runWorkflowCycle();
		} finally {
			this._isProcessing = false;
			this._postProcessing(false);
			this._postInputEnabled(true);
		}

		return true;
	}

	/**
	 * Execute a specific retry action by dispatching to existing handler methods.
	 */
	private async _executeRetryAction(action: RetryableAction): Promise<void> {
		switch (action.kind) {
			case 'retry_verification':
				if (action.gateId) {
					await this._handleVerificationGateDecision(action.gateId, 'RETRY_VERIFY');
				}
				break;

			case 'retry_repair':
				if (action.gateId) {
					// Reset the failed unit to READY so it gets picked up for re-execution
					if (action.unitId) {
						const { updateTaskUnitStatus } = await import('../../database/makerStore.js');
						const { TaskUnitStatus } = await import('../../types/maker.js');
						updateTaskUnitStatus(action.unitId, TaskUnitStatus.READY);
					}
					this._handleGateDecision(
						action.gateId,
						'OVERRIDE',
						'Retry repair via text command'
					);
					await this._resumeAfterGate();
				}
				break;

			case 'retry_phase':
				await this._handleRetryPhase();
				break;
		}
	}

	/**
	 * Create a UIChannel bridge for the orchestrator executor.
	 * Adapts panel methods to the UIChannel interface without direct coupling.
	 */
	private _createUIChannel(): import('../../primitives/types').UIChannel {
		return {
			postSystemMessage: (msg) => this._postSystemMessage(msg),
			postProcessing: (active, phase?, detail?) => this._postProcessing(active, phase, detail),
			postInputEnabled: (enabled) => this._postInputEnabled(enabled),
			update: () => this._update(),
			runWorkflowCycle: () => this._runWorkflowCycle(),
		};
	}

	/**
	 * Post a system information message to the webview stream.
	 */
	private _postSystemMessage(message: string): void {
		this._view?.webview.postMessage({
			type: 'systemMessage',
			data: { message },
		});
	}

	/**
	 * Post clickable option chips to the webview for multi-choice commands.
	 */
	private _postCommandOptions(
		command: string,
		prompt: string,
		actions: RetryableAction[]
	): void {
		this._view?.webview.postMessage({
			type: 'commandOptions',
			data: {
				command,
				prompt,
				options: actions.map((a) => ({
					kind: a.kind,
					label: a.label,
					description: a.description,
					gateId: a.gateId,
				})),
			},
		});
	}

	private static readonly ROLE_DISPLAY_NAMES: Record<string, string> = {
		executor: 'Executor',
		technicalExpert: 'Technical Expert',
		verifier: 'Verifier',
		historianInterpreter: 'Historian-Interpreter',
	};

	private static readonly ALL_ROLES = ['executor', 'technicalExpert', 'verifier', 'historianInterpreter'];

	/**
	 * Get the current key status for all roles
	 */
	private async _getKeyStatus(): Promise<Array<{
		role: string;
		displayName: string;
		provider: string;
		hasKey: boolean;
	}>> {
		const manager = getSecretKeyManager();
		const results = [];

		for (const role of GovernedStreamViewProvider.ALL_ROLES) {
			const provider = getProviderForRole(role);
			const key = await manager.getApiKey(role, provider);
			results.push({
				role,
				displayName: GovernedStreamViewProvider.ROLE_DISPLAY_NAMES[role] ?? role,
				provider,
				hasKey: !!key,
			});
		}

		return results;
	}

	/**
	 * Send current key status to the webview
	 */
	private async _sendKeyStatus(): Promise<void> {
		const keyStatus = await this._getKeyStatus();
		this._view?.webview.postMessage({
			type: 'keyStatusUpdate',
			data: { roles: keyStatus },
		});
	}

	/**
	 * Handle a set API key request from the webview
	 */
	private async _handleSetApiKey(role: string): Promise<void> {
		const displayName = GovernedStreamViewProvider.ROLE_DISPLAY_NAMES[role] ?? role;
		const provider = getProviderForRole(role);

		const key = await vscode.window.showInputBox({
			password: true,
			prompt: `Enter ${provider} API key for ${displayName}`,
			placeHolder: 'sk-...',
			ignoreFocusOut: true,
		});

		if (!key) {
			return; // User cancelled
		}

		const trimmedKey = key.trim();
		if (!trimmedKey) {
			vscode.window.showWarningMessage('API key cannot be empty.');
			return;
		}

		const manager = getSecretKeyManager();
		await manager.setApiKey(role, trimmedKey);
		clearRoleProviderCache();

		await this._sendKeyStatus();
		vscode.window.showInformationMessage(`API key set for ${displayName}`);
	}

	/**
	 * Handle a clear API key request from the webview
	 */
	private async _handleClearApiKey(role: string): Promise<void> {
		const displayName = GovernedStreamViewProvider.ROLE_DISPLAY_NAMES[role] ?? role;
		const manager = getSecretKeyManager();
		await manager.deleteApiKey(role);
		clearRoleProviderCache();

		await this._sendKeyStatus();
		vscode.window.showInformationMessage(`API key cleared for ${displayName}`);
	}

	/**
	 * Handle file picker request from webview — opens VS Code file dialog
	 */
	private async _handlePickFile(): Promise<void> {
		const uris = await vscode.window.showOpenDialog({
			canSelectMany: false,
			openLabel: 'Attach File',
			filters: {
				'Documents': ['md', 'txt', 'json', 'yaml', 'yml', 'rst'],
				'Code': ['ts', 'js', 'py', 'rs', 'go', 'java', 'tsx', 'jsx'],
				'All Files': ['*'],
			},
		});

		if (!uris || uris.length === 0) {
			return;
		}

		const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		const filePath = uris[0].fsPath;
		const relativePath = workspaceRoot
			? filePath.replace(workspaceRoot, '').replace(/^[\\/]/, '')
			: filePath;

		this._view?.webview.postMessage({
			type: 'fileAttached',
			filePath: relativePath,
		});
	}

	/**
	 * Handle @-mention suggestion request from webview.
	 * Returns a broad file list for client-side fuzzy filtering and caching.
	 */
	private async _handleMentionSuggestions(_query: string): Promise<void> {
		const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!workspaceRoot) {
			return;
		}

		const excludePattern = '{**/node_modules/**,**/dist/**,**/.git/**,**/out/**,**/.vscode/**}';

		try {
			// Return a broad set of mentionable files — client does fuzzy filtering
			const files = await vscode.workspace.findFiles('**/*', excludePattern, 200);
			const relativePaths = files
				.map((f) => f.fsPath.replace(workspaceRoot, '').replace(/^[\\/]/, ''))
				.sort((a, b) => a.localeCompare(b));

			this._view?.webview.postMessage({
				type: 'mentionSuggestions',
				files: relativePaths,
			});
		} catch {
			// Silently fail — mention suggestions are best-effort
		}
	}

	/**
	 * Full update: re-render the entire webview HTML
	 */
	private _update(): void {
		if (!this._view) {
			return;
		}
		const speechSetting = vscode.workspace.getConfiguration('janumicode.speech').get('enabled', true);
		setSpeechEnabled(speechSetting);
		setSoxAvailable(this._speechService?.soxAvailable ?? false);
		const state = aggregateStreamState(this._activeDialogueId ?? undefined);
		this._view.webview.html = this._getHtmlForWebview(state, this._view.webview);

		// Restore settings panel state if it was open before the re-render
		if (this._settingsPanelVisible) {
			this._restoreSettingsState();
		}

		// Restore processing indicator if workflow is actively running
		if (this._isProcessing) {
			this._postProcessing(true, this._processingPhase, this._processingDetail);
		}

		// Restore persisted clarification threads
		this._postClarificationThreads();

		// Restore pending MMP decisions from SQLite
		this._postPendingMmpDecisions();
	}

	/**
	 * Load pending MMP decisions from SQLite and send to webview for DOM restoration.
	 */
	private _postPendingMmpDecisions(): void {
		if (!this._activeDialogueId || !this._view) return;
		try {
			const { getPendingMmpDecisions } = require('../../database/pendingMmpStore');
			const result = getPendingMmpDecisions(this._activeDialogueId);
			if (result.success && Object.keys(result.value).length > 0) {
				this._view.webview.postMessage({
					type: 'pendingMmpDecisionsLoaded',
					decisions: result.value,
				});
			}
		} catch { /* table may not exist yet */ }
	}

	/**
	 * Load clarification threads from DB and send to the webview for restoration.
	 */
	private _postClarificationThreads(): void {
		if (!this._activeDialogueId || !this._view) return;
		try {
			const threads = getClarificationThreads(this._activeDialogueId);
			if (threads.length > 0) {
				this._view.webview.postMessage({
					type: 'clarificationThreadsLoaded',
					threads,
				});
			}
		} catch {
			// Table may not exist if V13 migration hasn't been applied yet
		}
	}

	/**
	 * Restore settings panel visibility and key status after a full re-render
	 */
	private async _restoreSettingsState(): Promise<void> {
		if (!this._settingsPanelVisible) {
			return;
		}
		const keyStatus = await this._getKeyStatus();
		this._view?.webview.postMessage({
			type: 'showSettings',
			data: { visible: true },
		});
		this._view?.webview.postMessage({
			type: 'keyStatusUpdate',
			data: { roles: keyStatus },
		});
	}

	/**
	 * Compose the full HTML document for the webview
	 */
	private _getHtmlForWebview(state: GovernedStreamState, webview: vscode.Webview): string {
		const nonce = getNonce();

		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'governedStream.js')
		);

		const headerHtml = renderStickyHeader(state);

		// Load pending MMP decisions from SQLite for server-side rendering
		let pendingDecisions: Record<string, import('./html/components').PendingMmpSnapshot> | undefined;
		if (this._activeDialogueId) {
			try {
				const { getPendingMmpDecisions } = require('../../database/pendingMmpStore');
				const result = getPendingMmpDecisions(this._activeDialogueId);
				if (result.success && Object.keys(result.value).length > 0) {
					pendingDecisions = {};
					for (const [cardId, pending] of Object.entries(result.value)) {
						pendingDecisions[cardId] = {
							mirrorDecisions: (pending as { mirrorDecisions: Record<string, { status: string; editedText?: string }> }).mirrorDecisions,
							menuSelections: (pending as { menuSelections: Record<string, { selectedOptionId: string; customResponse?: string }> }).menuSelections,
							preMortemDecisions: (pending as { preMortemDecisions: Record<string, { status: string; rationale?: string }> }).preMortemDecisions,
						};
					}
				}
			} catch { /* table may not exist yet */ }
		}

		const streamHtml = state.streamItems.length > 0
			? renderStream(state.streamItems, state.intakeState, pendingDecisions)
			: renderEmptyState();
		const gateContext = state.currentPhase === 'VERIFY' && state.openGates.length > 0
			? 'Review verification results above and choose an action'
			: state.currentPhase === 'REVIEW' && state.openGates.length > 0
			? 'Review the summary above and approve or request changes'
			: undefined;
		const inputHtml = renderInputArea(state.currentPhase, state.openGates.length > 0, gateContext, this._isProcessing);

		const settingsPanelHtml = renderSettingsPanel();

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}' ${webview.cspSource};">
	<title>Governed Stream</title>
	<style nonce="${nonce}">
		${getStyles()}
	</style>
</head>
<body>
	<div class="governed-stream-container">
		<div class="find-widget" id="find-widget">
			<input type="text" class="find-input" id="find-input" placeholder="Find" spellcheck="false" autocomplete="off" />
			<span class="find-match-count" id="find-match-count"></span>
			<button class="find-btn" id="find-prev-btn" title="Previous match (Shift+Enter)">&#x2191;</button>
			<button class="find-btn" id="find-next-btn" title="Next match (Enter)">&#x2193;</button>
			<button class="find-btn" id="find-close-btn" data-action="close-find" title="Close (Escape)">&times;</button>
		</div>
		${headerHtml}
		<div class="stream-area">
			<div id="stream-content">
				${streamHtml}
			</div>
		</div>
		${settingsPanelHtml}
		${inputHtml}
	</div>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}

	/**
	 * Clean up event bus subscriptions
	 */
	// ==================== SPEECH-TO-TEXT ====================

	private _getSpeechService(): SpeechToTextService {
		if (!this._speechService) {
			this._speechService = new SpeechToTextService();
		}
		return this._speechService;
	}

	private async _sendSpeechCapability(): Promise<void> {
		const cfg = vscode.workspace.getConfiguration('janumicode.speech');
		const enabled = cfg.get<boolean>('enabled', true);

		if (!enabled) {
			this._view?.webview.postMessage({ type: 'speechCapability', data: { enabled: false, soxAvailable: false } });
			return;
		}

		// Check if SoX is actually installed
		const recPath = cfg.get<string>('soxRecPath', 'rec');
		const svc = this._getSpeechService();
		const soxAvailable = await svc.checkSoxAvailable(recPath);

		if (!soxAvailable) {
			const hint = process.platform === 'win32'
				? 'Install: choco install sox.portable (or download from https://sox.sourceforge.net/)'
				: process.platform === 'darwin'
					? 'Install: brew install sox'
					: 'Install: sudo apt install sox';
			vscode.window.showWarningMessage(
				`Speech-to-text requires SoX but 'rec' was not found. ${hint}`,
			);
		}

		this._view?.webview.postMessage({ type: 'speechCapability', data: { enabled, soxAvailable } });
	}

	private async _handleSpeechStart(targetInputId: string): Promise<void> {
		try {
			const config = await resolveSpeechConfig();
			const svc = this._getSpeechService();

			if (svc.isRecording) {
				// Already recording — stop first
				await this._handleSpeechStop();
				return;
			}

			this._speechTargetInputId = targetInputId;
			await svc.startRecording(config);

			this._view?.webview.postMessage({
				type: 'speechRecordingStarted',
				data: { targetInputId },
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this._view?.webview.postMessage({
				type: 'speechError',
				data: { targetInputId, error: message },
			});
		}
	}

	private async _handleSpeechStop(): Promise<void> {
		const svc = this._getSpeechService();
		const targetInputId = this._speechTargetInputId || '';

		try {
			this._view?.webview.postMessage({
				type: 'speechTranscribing',
				data: { targetInputId },
			});

			const wavPath = await svc.stopRecording();
			const config = await resolveSpeechConfig();
			const text = await svc.transcribe(wavPath, config);

			this._view?.webview.postMessage({
				type: 'speechResult',
				data: { targetInputId, text },
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this._view?.webview.postMessage({
				type: 'speechError',
				data: { targetInputId, error: message },
			});
		} finally {
			this._speechTargetInputId = null;
		}
	}

	private _handleSpeechCancel(): void {
		const svc = this._getSpeechService();
		svc.cancel();
		if (this._speechTargetInputId) {
			this._view?.webview.postMessage({
				type: 'speechError',
				data: { targetInputId: this._speechTargetInputId, error: 'Recording cancelled' },
			});
			this._speechTargetInputId = null;
		}
	}

	// ==================== CLEANUP ====================

	private _cleanup(): void {
		this._disposed = true;
		this._isProcessing = false;
		// Abort any in-flight workflow cycle — kills CLI processes via signal
		this._workflowAbortController?.abort();
		this._workflowAbortController = null;
		this._getSpeechService().cancel();
		for (const unsub of this._eventUnsubscribers) {
			unsub();
		}
		this._eventUnsubscribers = [];
		this._view = undefined;
	}
}

/**
 * Generate a random nonce for Content Security Policy
 */
function getNonce(): string {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
