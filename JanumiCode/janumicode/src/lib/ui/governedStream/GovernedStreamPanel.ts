/**
 * Governed Stream WebviewView Provider
 * Implements the unified "Governed Stream" sidebar view as described in the UI/UX Design Spec.
 * Uses event bus for real-time updates instead of polling.
 */

import * as vscode from 'vscode';
import { getEventBus, emitDialogueResumed } from '../../integration/eventBus';
import { aggregateStreamState, type GovernedStreamState } from './dataAggregator';
import { processHumanGateDecision, type HumanGateDecisionInput } from '../../workflow/humanGateHandling';
import { HumanAction, Role, ClaimEventType, Phase, ClaimStatus } from '../../types';
import { getStyles } from './html/styles';
import { renderStickyHeader, renderStream, renderInputArea, renderEmptyState, renderRichCard, renderSettingsPanel } from './html/components';
import { getClientScript } from './html/script';
import { getDialogueTurnById, getClaims } from '../../events/reader';
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
import { IntakeSubState } from '../../types/intake';
import { updateIntakeConversation, writeClaimEvent } from '../../events/writer';
import { getWorkflowState, updateWorkflowMetadata, transitionWorkflow, TransitionTrigger } from '../../workflow/stateMachine';
import { resolveGate, getGate } from '../../workflow/gates';
import { getDatabase } from '../../database';

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
	private _processingPhase = '';
	private _processingDetail = '';
	private _activeCLICommandId: string | null = null;
	private _pendingToolCalls: Map<string, import('../../cli/types').CLIActivityEvent> = new Map();
	/** Suppress the next dialogue:turn_added event (the initial turn is already included in the dialogue:started full re-render) */
	private _suppressNextTurnAdded = false;

	constructor(private readonly _extensionUri: vscode.Uri) {}

	/**
	 * Called by VS Code when the webview view is first made visible.
	 */
	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	): void {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri],
		};

		// Restore active dialogue from database (survives VS Code restart)
		const activeResult = getActiveDialogue();
		if (activeResult.success && activeResult.value) {
			this._activeDialogueId = activeResult.value.dialogue_id;
		}

		// Set initial HTML
		this._update();

		// Handle visibility changes
		webviewView.onDidChangeVisibility(() => {
			if (webviewView.visible) {
				this._update();
			}
		});

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
				if (payload.commandType === 'cli_invocation' && payload.action === 'start') {
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

		const turnResult = getDialogueTurnById(turnId);
		if (!turnResult.success || !turnResult.value) {
			// Fallback to full update
			this._update();
			return;
		}

		const turn = turnResult.value;
		const claimsResult = getClaims({ dialogue_id: turn.dialogue_id });
		const turnClaims = claimsResult.success
			? claimsResult.value.filter((c) => c.turn_id === turnId)
			: [];

		const html = renderRichCard(turn, turnClaims);

		this._view.webview.postMessage({
			type: 'turnAdded',
			data: { html },
		});
	}

	/**
	 * Handle messages from the webview
	 */
	private _handleMessage(message: { type: string; [key: string]: unknown }): void {
		switch (message.type) {
			case 'refresh':
				this._update();
				break;

			case 'submitInput':
				this._handleSubmitInput(message.text as string);
				break;

			case 'gateDecision':
				this._handleGateDecision(
					message.gateId as string,
					message.action as string,
					message.rationale as string
				);
				break;

			case 'copySessionId':
				vscode.env.clipboard.writeText(message.sessionId as string);
				vscode.window.showInformationMessage('Session ID copied to clipboard');
				break;

			case 'requestKeyStatus':
				this._sendKeyStatus();
				break;

			case 'setApiKey':
				this._handleSetApiKey(message.role as string);
				break;

			case 'clearApiKey':
				this._handleClearApiKey(message.role as string);
				break;

			case 'pickFile':
				this._handlePickFile();
				break;

			case 'requestMentionSuggestions':
				this._handleMentionSuggestions(message.query as string);
				break;

			case 'retryPhase':
				this._handleRetryPhase();
				break;

			case 'intakeFinalizePlan':
				this._handleIntakeFinalize();
				break;

			case 'intakeApprovePlan':
				this._handleIntakeApprove();
				break;

			case 'intakeContinueDiscussing':
				this._handleIntakeContinueDiscussing();
				break;

			case 'resumeDialogue':
				this._handleResumeDialogue(message.dialogueId as string);
				break;

			case 'switchDialogue':
				this._handleSwitchDialogue(message.dialogueId as string);
				break;

			case 'clearDatabase':
				this._handleClearDatabase();
				break;

			case 'exportStream':
				this._handleExportStream();
				break;

			case 'settingsVisibilityChanged':
				this._settingsPanelVisible = message.visible as boolean;
				break;

			case 'verificationGateDecision':
				this._handleVerificationGateDecision(
					message.gateId as string,
					message.action as string,
					message.claimRationales as Record<string, string> | undefined
				);
				break;

			case 'reviewGateDecision':
				this._handleReviewGateDecision(
					message.gateId as string,
					message.action as string,
					message.itemRationales as Record<string, string> | undefined,
					message.overallFeedback as string | undefined
				);
				break;
		}
	}

	/**
	 * Handle user input submission — starts or advances the governed workflow
	 */
	private async _handleSubmitInput(text: string): Promise<void> {
		if (!text.trim() || this._isProcessing) {
			return;
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
		if (!this._activeDialogueId) {
			return;
		}

		const config = await getConfig();
		const result = await executeWorkflowCycle(
			this._activeDialogueId,
			config.llmConfig,
			config.tokenBudget,
			20
		);

		if (!result.success) {
			vscode.window.showErrorMessage(`Workflow error: ${result.error.message}`);
			this._update();
			return;
		}

		if (result.value.completed) {
			this._activeDialogueId = null;
			vscode.window.showInformationMessage('Workflow completed successfully.');
		}

		// Always refresh the view after a workflow cycle completes — ensures
		// gate cards (review, verification) appear even if the event-based
		// _update() fired too early or the gate creation event wasn't emitted.
		this._update();
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
		this._postProcessing(true, 'Approving', 'Approving plan and advancing to PROPOSE');

		try {
			// Sub-state should already be AWAITING_APPROVAL, just run the cycle
			await this._runWorkflowCycle();
		} finally {
			this._isProcessing = false;
			this._postProcessing(false);
			this._postInputEnabled(true);
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
		} else {
			vscode.window.showErrorMessage(`Gate decision failed: ${result.error.message}`);
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
		const state = aggregateStreamState(this._activeDialogueId ?? undefined);
		this._view.webview.html = this._getHtmlForWebview(state);

		// Restore settings panel state if it was open before the re-render
		if (this._settingsPanelVisible) {
			this._restoreSettingsState();
		}

		// Restore processing indicator if workflow is actively running
		if (this._isProcessing) {
			this._postProcessing(true, this._processingPhase, this._processingDetail);
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
	private _getHtmlForWebview(state: GovernedStreamState): string {
		const nonce = getNonce();

		const headerHtml = renderStickyHeader(state);

		const streamHtml = state.streamItems.length > 0
			? renderStream(state.streamItems, state.intakeState)
			: renderEmptyState();
		const gateContext = state.currentPhase === 'VERIFY' && state.openGates.length > 0
			? 'Review verification results above and choose an action'
			: state.currentPhase === 'REVIEW' && state.openGates.length > 0
			? 'Review the summary above and approve or request changes'
			: undefined;
		const inputHtml = renderInputArea(state.currentPhase, state.openGates.length > 0, gateContext);

		const settingsPanelHtml = renderSettingsPanel();

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
	<title>Governed Stream</title>
	<style nonce="${nonce}">
		${getStyles()}
	</style>
</head>
<body>
	<div class="governed-stream-container">
		${headerHtml}
		<div class="stream-area">
			<div id="stream-content">
				${streamHtml}
			</div>
		</div>
		${settingsPanelHtml}
		${inputHtml}
	</div>
	<script nonce="${nonce}">
		${getClientScript()}
	</script>
</body>
</html>`;
	}

	/**
	 * Clean up event bus subscriptions
	 */
	private _cleanup(): void {
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
