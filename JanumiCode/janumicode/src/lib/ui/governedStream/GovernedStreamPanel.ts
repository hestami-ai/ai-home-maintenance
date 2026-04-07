/**
 * Governed Stream WebviewView Provider
 * Implements the unified "Governed Stream" sidebar view as described in the UI/UX Design Spec.
 * Uses event bus for real-time updates instead of polling.
 */

import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import { runWithTrace } from '../../logging/traceContext';
import { getLogger, isLoggerInitialized } from '../../logging';
import { getEventBus, emitDialogueResumed } from '../../integration/eventBus';
import { aggregateStreamState, type GovernedStreamState } from './dataAggregator';
import { Role, Phase, GateStatus } from '../../types';
import { getStyles } from './html/styles';
import { renderStickyHeader, renderStream, renderInputArea, renderEmptyState, renderSettingsPanel, setSpeechEnabled, setSoxAvailable, PHASE_PLACEHOLDERS } from './html/components';
// getSecretKeyManager, getProviderForRole, clearRoleProviderCache moved to panelApiKeys.ts
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
import { writeQaExchange, writeDialogueEvent } from '../../events/writer';
import { getWorkflowState, updateWorkflowMetadata } from '../../workflow/stateMachine';
import { getGatesForDialogue } from '../../workflow/gates';
import { getDatabase } from '../../database';
import { parseTextCommand, interpretInput, escalateQuery, assessRetryableActions, type ParsedCommand, type RetryableAction, type QaProgressCallback } from './textCommands';
import { killAllActiveProcesses } from '../../cli/spawnUtils';
import { getActivePermissionBridge, setActivePermissionBridge } from '../../mcp/permissionBridge';
import { askClarification } from '../../clarification/clarificationExpert';
import { saveClarificationThread, getClarificationThreads } from '../../clarification/clarificationStore';
import * as apiKeys from './panelApiKeys';
import * as fileAssist from './panelFileAssist';
import { SpeechHandler } from './panelSpeech';
import type { PanelContext } from './panelContext';
import * as panelGates from './panelGates';
import * as panelMmp from './panelMmp';
import { updateFindingRating } from '../../database/validationStore';
import * as panelIntake from './panelIntake';
import * as panelArchitecture from './panelArchitecture';
import * as panelExport from './panelExport';
import { SessionRecorder, pickRecordingFile } from './sessionRecorder';

/**
 * WebviewViewProvider for the Governed Stream sidebar view.
 */
export class GovernedStreamViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'janumicode.governedStream';

	/** Public accessor for the current dialogue ID (used by Architecture Explorer command). */
	public get activeDialogueId(): string | null { return this._activeDialogueId; }

	private _view?: vscode.WebviewView;
	private _eventUnsubscribers: (() => void)[] = [];
	private _activeDialogueId: string | null = null;
	private _settingsPanelVisible = false;
	private _isProcessing = false;
	private _disposed = false;
	private _thinkingCancelled = false;
	private _processingPhase = '';
	private _processingDetail = '';
	private _activityMonitorInterval: ReturnType<typeof setInterval> | null = null;
	private _processingStartedAt = 0;
	private _activeCLICommandId: string | null = null;
	private readonly _pendingToolCalls: Map<string, import('../../cli/types').CLIActivityEvent> = new Map();
	/** Suppress the next dialogue:turn_added event (the initial turn is already included in the dialogue:started full re-render) */
	private _suppressNextTurnAdded = false;
	private readonly _speechHandler = new SpeechHandler();
	private readonly _recorder = new SessionRecorder();

	/** Create a PanelContext adapter for delegating to extracted handler modules. */
	private _ctx(): PanelContext {
		 
		const self = this;
		return {
			get activeDialogueId() { return self._activeDialogueId; },
			set activeDialogueId(v) { self._activeDialogueId = v; },
			get isProcessing() { return self._isProcessing; },
			set isProcessing(v) { self._isProcessing = v; },
			get view() { return self._view; },
			postProcessing: (active, phase?, detail?) => this._postProcessing(active, phase, detail),
			postInputEnabled: (enabled) => this._postInputEnabled(enabled),
			postToWebview: (msg) => this._postToWebview(msg),
			update: () => this._update(),
			runWorkflowCycle: () => this._runWorkflowCycle(),
			resumeAfterGate: () => this._resumeAfterGate(),
		};
	}
	/** AbortController for the current workflow cycle — aborted on cancel/dispose */
	private _workflowAbortController: AbortController | null = null;
	/** Debounce timer for coalescing rapid _update() calls */
	private _pendingUpdateTimer: ReturnType<typeof setTimeout> | null = null;
	/** Highest event_id rendered in the stream — used for incremental appends */
	private _lastRenderedEventId = 0;
	/** Fingerprint of last rendered stream — used to skip redundant re-renders */
	private _lastStreamFingerprint = '';
	/** Disposable for the configuration change watcher */
	private _configWatcherDisposable?: vscode.Disposable;
	constructor(private readonly _extensionUri: vscode.Uri) {}

	/**
	 * Called by VS Code when the webview view is first made visible.
	 */
	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	): void {
		const log = isLoggerInitialized() ? getLogger().child({ component: 'governedStream' }) : undefined;
		log?.info('resolveWebviewView');
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
				log?.info('restoredActiveDialogue', { dialogueId: this._activeDialogueId });
			}
		} catch (e) {
			log?.error('restoreActiveDialogueFailed', { error: e });
		}

		// Reconcile orphaned CLI commands from previous session crash/restart
		try {
			const { reconcileOrphanedCommands } = require('../../workflow/commandStore');
			const result = reconcileOrphanedCommands();
			if (result.success && result.value > 0) {
				log?.info('reconciledOrphanedCommands', { count: result.value });
			}
		} catch (e) {
			log?.error('reconcileOrphanedCommandsFailed', { error: e });
		}

		// Reconcile stale transition graph versions from previous extension versions
		try {
			const { reconcileStaleTransitionGraphs } = require('../../workflow/stateMachine');
			const result = reconcileStaleTransitionGraphs();
			if (result.success && result.value > 0) {
				log?.info('reconciledStaleTransitionGraphs', { count: result.value });
			}
		} catch (e) {
			log?.error('reconcileTransitionGraphsFailed', { error: e });
		}

		// Clear stale phase checkpoints from active dialogue (prevents orphaned step cache from causing stale resume)
		if (this._activeDialogueId) {
			try {
				updateWorkflowMetadata(this._activeDialogueId, { phaseCheckpoint: undefined });
			} catch { /* non-critical */ }
		}

		// Set initial shell HTML (header + empty stream + input + script)
		// Stream content is populated via hydrate message after the webview script signals ready
		try {
			const state = aggregateStreamState(this._activeDialogueId ?? undefined);
			webviewView.webview.html = this._getHtmlForWebview(state, webviewView.webview);
			log?.info('shellHtmlSet', { status: 'waitingForWebviewReady' });
		} catch (e) {
			log?.error('initialRenderFailed', { error: e });
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
		this._configWatcherDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('janumicode.speech')) {
				this._speechHandler.service.resetAvailabilityCache();
				this._sendSpeechCapability();
			}
		});
	}

	/**
	 * Replay a previously recorded session file into the webview.
	 * @param filePath Absolute path to a .janumicode/recordings/*.jsonl file.
	 */
	public async replaySession(filePath: string): Promise<void> {
		if (!this._view) { return; }
		const config = vscode.workspace.getConfiguration('janumicode');
		const delayMs = config.get<number>('recorder.replayDelayMs', 80);
		await SessionRecorder.replay(filePath, (payload) => this._postToWebview(payload), delayMs);
	}

	/**
	 * Send a message to the webview to open the find widget
	 */
	public openFindWidget(): void {
		if (!this._view) { return; }
		this._postToWebview({ type: 'openFindWidget' });
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
			this._postToWebview({
				type: 'showSettings',
				data: { visible: true },
			});
			await this._sendKeyStatus();
		} else {
			this._postToWebview({
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
				this._scheduleUpdate();
			})
		);

		// Workflow events
		this._eventUnsubscribers.push(
			bus.on('workflow:phase_changed', (payload) => {
				// Update processing indicator with current phase
				if (this._isProcessing) {
					const phaseLabels: Record<string, string> = {
						INTAKE: 'Intake',
						ARCHITECTURE: 'Architecture',
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

				this._postToWebview({
					type: 'phaseChanged',
					data: payload,
				});
				// Update header stepper immediately so sub-phase progress is visible.
				// _scheduleUpdate is also queued but will skip the full stream hydrate
				// while _isProcessing is true (see _scheduleUpdate guard).
				if (this._isProcessing) {
					this._postHeaderUpdate();
				}
				this._scheduleUpdate();
			})
		);

		// Reasoning review completed — inject card into webview immediately
		this._eventUnsubscribers.push(
			bus.on('reasoning:review_ready' as never, ((payload: { commandId: string; dialogueId: string; review: Record<string, unknown> }) => {
				if (payload.dialogueId === this._activeDialogueId) {
					this._postToWebview({
						type: 'reasoningReviewReady',
						data: payload,
					});
				}
			}) as never)
		);

		this._eventUnsubscribers.push(
			bus.on('workflow:gate_triggered', (payload) => {
				// Only handle gates for the active dialogue
				if ((payload as { dialogueId?: string }).dialogueId &&
					(payload as { dialogueId?: string }).dialogueId !== this._activeDialogueId) {
					return;
				}
				// Clear processing indicator — the phase is done, gate is now active
				this._isProcessing = false;
				this._postProcessing(false);
				this._postInputEnabled(true);
				this._stopActivityMonitor();

				this._postToWebview({
					type: 'gateTriggered',
					data: payload,
				});
				this._scheduleUpdate();
			})
		);

		this._eventUnsubscribers.push(
			bus.on('workflow:gate_resolved', (payload) => {
				this._postToWebview({
					type: 'gateResolved',
					data: { gateId: payload.gateId, action: payload.action },
				});
			})
		);

		// Claim events → update verdict badge in-place
		this._eventUnsubscribers.push(
			bus.on('claim:verified', (payload) => {
				this._postToWebview({
					type: 'claimUpdated',
					data: { claimId: payload.claimId, status: 'VERIFIED' },
				});
				// Also update the health bar
				this._scheduleUpdate();
			})
		);

		this._eventUnsubscribers.push(
			bus.on('claim:disproved', (payload) => {
				this._postToWebview({
					type: 'claimUpdated',
					data: { claimId: payload.claimId, status: 'DISPROVED' },
				});
				this._scheduleUpdate();
			})
		);

		// Workflow completed → clear active dialogue pointer
		this._eventUnsubscribers.push(
			bus.on('workflow:completed', () => {
				this._activeDialogueId = null;
				this._scheduleUpdate();
			})
		);

		// Error events → show in stream
		this._eventUnsubscribers.push(
			bus.on('error:occurred', (payload) => {
				this._postToWebview({
					type: 'errorOccurred',
					data: { code: payload.code, message: payload.message },
				});
			})
		);

		// Phase failure → surface error in stream + stop processing indicator + re-render
		this._eventUnsubscribers.push(
			bus.on('workflow:phase_failed', (payload) => {
				if (payload.dialogueId !== this._activeDialogueId) { return; }

				// Stop the processing spinner immediately
				this._postProcessing(false);

				// Show the error in the stream so the user knows why the workflow stopped.
				// Without this the stream just "freezes" with no indication of failure.
				this._postSystemMessage(
					`⚠ Phase ${payload.phase} failed: ${payload.error}\nType a message or click Retry to resume.`
				);

				// Re-render to show retry button in static HTML
				this._scheduleUpdate();
			})
		);

		// Workflow command events → command blocks in stream + processing label + header update
		this._eventUnsubscribers.push(
			bus.on('workflow:command', (payload) => {
				// Track active CLI command ID so cli:activity events route correctly
				if ((payload.commandType === 'cli_invocation' || payload.commandType === 'role_invocation')
					&& payload.action === 'start') {
					this._activeCLICommandId = payload.commandId;
					// Update processing indicator with the command label
					if (this._isProcessing && payload.label) {
						this._postProcessing(true, payload.label, this._processingDetail);
					}
					// Refresh header breadcrumb to reflect current sub-phase
					this._postHeaderUpdate();
				}
				this._postToWebview({
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
					this._postToWebview({
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
					this._postToWebview({
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
					this._postToWebview({
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
					this._postToWebview({
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
					this._postToWebview({
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
				this._postToWebview({
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
				this._postToWebview({
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
				this._postToWebview({
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
			bus.on('intake:engineering_domain_coverage_updated', () => {
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
				this._postToWebview({
					type: 'dialogueTitleUpdated',
					data: { dialogueId: payload.dialogueId, title: payload.title },
				});
			})
		);
	}

	/**
	 * Handle a new turn being added — try incremental append first
	 */
	private _handleTurnAdded(_turnId: number): void {
		if (!this._view || !this._activeDialogueId) {
			this._update();
			return;
		}

		// Build the stream state and send the most recently added item as a
		// structured StreamItem. The webview renderer handles all card types
		// (including architecture_capabilities, architecture_design, etc.)
		// so we never need the legacy renderRichCard HTML-blob path here.
		const streamState = aggregateStreamState(this._activeDialogueId);
		const items = streamState.streamItems;
		if (!items.length) {
			this._update();
			return;
		}

		const newItem = items[items.length - 1];
		this._postToWebview({ type: 'streamItemAdded', item: newItem });
	}

	/**
	 * Handle messages from the webview
	 */
	/**
	 * Safely run an async handler from _handleMessage. Catches rejections
	 * so they don't become unhandled (common during extension shutdown).
	 */
	private _safeAsync(fn: () => Promise<unknown> | void): void {
		if (this._disposed) {return;}
		Promise.resolve(fn()).catch(err => {
			// Suppress "Canceled" and "Channel has been closed" errors during disposal
			if (this._disposed) {return;}
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.includes('Canceled') || msg.includes('Channel has been closed')) {return;}
			const asyncLog = isLoggerInitialized() ? getLogger().child({ component: 'governedStream' }) : undefined;
			asyncLog?.error('unhandledAsyncError', { error: msg });
		});
	}

	private _handleMessage(message: { type: string; [key: string]: unknown }): void {
		if (this._disposed) {return;}

		switch (message.type) {
			case 'webviewReady':
				// Webview script has loaded and is ready to receive messages
				{
				const msgLog = isLoggerInitialized() ? getLogger().child({ component: 'governedStream' }) : undefined;
				msgLog?.info('webviewReady', { action: 'sendingInitialHydration' });
				}
				this._update();
				break;
			case 'refresh':
				// Block full re-renders while the workflow is actively processing.
				// The webview sends 'refresh' in response to 'phaseChanged' messages, but
				// re-rendering mid-processing inserts architecture cards out of order.
				if (this._isProcessing) {
					this._postHeaderUpdate();
				} else {
					this._update();
				}
				break;

			case 'submitInput':
				this._safeAsync(() => runWithTrace(this._activeDialogueId ?? 'unknown', 'submitInput', () =>
					this._handleSubmitInput(message.text as string)
				));
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

			case 'pauseWorkflow':
				this._safeAsync(async () => {
					if (this._isProcessing) {
						const { requestWorkflowPause } = await import('../../integration/dialogueOrchestrator.js');
						requestWorkflowPause();
						this._postSystemMessage('Pause requested — workflow will stop after the current phase completes.');
						this._postProcessing(true, this._processingPhase, 'Pausing after current phase...');
					}
				});
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

			case 'draftSave':
				this._handleDraftSave(message);
				break;

			case 'draftClear':
				this._handleDraftClear(message);
				break;

			case 'architectureGateDecision':
				this._safeAsync(() => this._handleArchitectureGateDecision(message));
				break;

			case 'openArchitectureExplorer':
				vscode.commands.executeCommand(
					'janumicode.openArchitectureExplorer',
					message.dialogueId || this._activeDialogueId
				);
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

			case 'validationFeedback':
				updateFindingRating(message.findingId as string, message.useful as boolean);
				this._scheduleUpdate();
				break;

			case 'recordingToggle':
				this._safeAsync(() => this._handleRecordingToggle());
				break;
		}
	}

	/** Toggle session recording on/off and notify the webview of the new state. */
	private async _handleRecordingToggle(): Promise<void> {
		if (this._recorder.isActive) {
			const filePath = await this._recorder.stop();
			this._postToWebview({ type: 'recordingState', active: false, path: filePath ?? undefined });
			if (filePath) {
				const basename = filePath.split(/[/\\]/).pop() ?? filePath;
				const action = await vscode.window.showInformationMessage(
					`Recording saved: ${basename}`,
					'Open Folder',
					'Replay'
				);
				if (action === 'Open Folder') {
					const dir = filePath.substring(0, filePath.lastIndexOf(filePath.split(/[/\\]/).pop()!));
					await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(filePath));
					void dir; // suppress unused variable warning
				} else if (action === 'Replay') {
					await vscode.commands.executeCommand('janumicode.replaySession', filePath);
				}
			}
		} else {
			this._recorder.start(this._activeDialogueId ?? 'unknown');
			this._postToWebview({ type: 'recordingState', active: true });
		}
	}

	/**
	 * Handle user input submission — starts or advances the governed workflow
	 */
	private async _handleSubmitInput(text: string): Promise<void> {
		if (!text.trim()) { return; }

		// Cancel, navigate, retry — checked BEFORE the _isProcessing guard
		// so users can always cancel, navigate, or retry even when execution
		// is in progress or stuck after an error.
		const preCheck = parseTextCommand(text);
		if (preCheck?.command === 'cancel') {
			await this._handleCancel();
			return;
		}
		if (preCheck?.command === 'pause') {
			if (this._isProcessing) {
				const { requestWorkflowPause } = await import('../../integration/dialogueOrchestrator.js');
				requestWorkflowPause();
				this._postSystemMessage('Pause requested — workflow will stop after the current phase completes.');
				// Update processing label to show pause is pending
				this._postProcessing(true, this._processingPhase, 'Pausing after current phase...');
			} else {
				this._postSystemMessage('No workflow is running. Nothing to pause.');
			}
			return;
		}
		if (preCheck && (preCheck.command === 'navigate' || preCheck.command === 'retry') && this._activeDialogueId) {
			if (this._isProcessing) { await this._handleCancel(); }
			const handled = await this._handleTextCommand(preCheck);
			if (handled) { return; }
		}

		if (this._isProcessing) {
			this._postSystemMessage(
				'A workflow is currently running. Use **pause** to stop after the current phase, **cancel** to stop immediately, or **navigate** / **retry** to redirect.'
			);
			this._postToWebview({ type: 'intakeSubmitRejected', reason: 'Processing in progress' });
			this._postToWebview({ type: 'composerSubmitRejected', reason: 'Processing in progress' });
			return;
		}

		// Ack the submit so the webview can freeze/clear UI
		this._postToWebview({ type: 'intakeSubmitAccepted' });
		this._postToWebview({ type: 'composerSubmitAccepted' });

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
		this._startActivityMonitor();

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
			this._stopActivityMonitor();
			// Full hydration to render final state from DB
			this._update();
		}
	}

	/**
	 * Run the async workflow cycle
	 */
	private async _runWorkflowCycle(): Promise<void> {
		const cycleLog = isLoggerInitialized() ? getLogger().child({ component: 'governedStream' }) : undefined;
		cycleLog?.debug('runWorkflowCycleEntered', { dialogueId: this._activeDialogueId?.slice(0, 8) ?? null, disposed: this._disposed, isProcessing: this._isProcessing });
		if (!this._activeDialogueId || this._disposed) {
			cycleLog?.debug('runWorkflowCycleEarlyReturn', { reason: 'noDialogueIdOrDisposed' });
			return;
		}

		// Clear any pending pause from a previous cycle
		import('../../integration/dialogueOrchestrator.js').then(m => m.clearWorkflowPause()).catch(() => {});

		// Create a fresh AbortController for this cycle — aborted on cancel/dispose
		this._workflowAbortController?.abort();
		this._workflowAbortController = new AbortController();

		// Set module-level signal so all spawn functions auto-inherit it
		const { setWorkflowAbortSignal } = await import('../../cli/spawnUtils.js');
		setWorkflowAbortSignal(this._workflowAbortController.signal);

		try {
			const config = await getConfig();
			let iterationLimitHit = true;

			// Auto-continue when iteration limit is hit (architecture sub-state loops can
			// exhaust a single cycle). Cap at 5 continuation rounds as a safety net.
			for (let round = 0; round < 5 && iterationLimitHit; round++) {
				const result = await executeWorkflowCycle(
					this._activeDialogueId!,
					config.llmConfig,
					config.tokenBudget,
				);

				if (this._disposed) { return; }

				if (!result.success) {
					if (result.error.message === 'Aborted') { return; }
					vscode.window.showErrorMessage(`Workflow error: ${result.error.message}`);
					this._update();
					return;
				}

				iterationLimitHit = result.value.iterationLimitHit === true;

				if (result.value.completed) {
					this._activeDialogueId = null;
					vscode.window.showInformationMessage('Workflow completed successfully.');
					break;
				}

				if (result.value.gateTriggered || result.value.awaitingInput) {
					break;
				}
			}

			// Always refresh the view after a workflow cycle completes
			this._update();
		} finally {
			setWorkflowAbortSignal(undefined);
			this._workflowAbortController = null;
		}
	}

	/**
	 * Central postMessage helper — records the payload for session replay, then forwards it to the webview.
	 * All internal `this._postToWebview(...)` calls are routed through this method.
	 */
	private _postToWebview(payload: unknown): void {
		this._recorder.record(payload);
		this._view?.webview.postMessage(payload);
	}

	/**
	 * Enable or disable the webview input area
	 */
	private _postInputEnabled(enabled: boolean): void {
		this._postToWebview({
			type: 'setInputEnabled',
			data: { enabled },
		});
	}

	/**
	 * Signal the webview to show/hide the thinking spinner on the submit button.
	 * Used during Tier 2/3 LLM classification before the heavier setProcessing indicator.
	 */
	private _postInputThinking(active: boolean): void {
		this._postToWebview({
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
		this._postToWebview({
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
		this._postToWebview({
			type: 'qaThinkingStart',
			data: { question, timestamp: new Date().toISOString() },
		});
	}

	/** Append a progress step to the thinking Q&A card. */
	private _postQaThinkingProgress(step: string): void {
		this._postToWebview({
			type: 'qaThinkingProgress',
			data: { step },
		});
	}

	/** Replace the thinking body with the final formatted answer. */
	private _postQaThinkingComplete(answer: string): void {
		this._postToWebview({
			type: 'qaThinkingComplete',
			data: { answer, timestamp: new Date().toISOString() },
		});
	}

	/**
	 * Send only a header update to the webview (breadcrumb, phase stepper)
	 * without triggering a full hydration that would destroy client-side content.
	 */
	private _postHeaderUpdate(): void {
		if (!this._view) { return; }
		const state = aggregateStreamState(this._activeDialogueId ?? undefined);
		const headerHtml = renderStickyHeader(state);
		this._postToWebview({ type: 'headerUpdate', data: { headerHtml } });
	}

	/**
	 * Show or hide the processing indicator in the webview
	 */
	private _postProcessing(active: boolean, phase?: string, detail?: string): void {
		if (phase !== undefined) { this._processingPhase = phase; }
		if (detail !== undefined) { this._processingDetail = detail; }
		this._postToWebview({
			type: 'setProcessing',
			data: { active, phase: phase ?? this._processingPhase, detail: detail ?? this._processingDetail },
		});
	}

	/**
	 * Start a heartbeat-based activity monitor that:
	 * 1. Sends elapsed time to the webview for display
	 * 2. Self-heals: restores indicator if CLI processes are active but indicator is off
	 *
	 * Note: the monitor does NOT auto-clear _isProcessing. Between CLI process exits
	 * (e.g., Context Engineer finishes, Architect hasn't started yet) there are brief
	 * windows with zero active processes. Only the orchestrator's finally block should
	 * clear _isProcessing.
	 */
	private _startActivityMonitor(): void {
		this._processingStartedAt = Date.now();
		this._stopActivityMonitor();
		this._activityMonitorInterval = setInterval(async () => {
			try {
				const { getActiveProcessCount } = await import('../../cli/spawnUtils.js');
				const processCount = getActiveProcessCount();
				const elapsed = Date.now() - this._processingStartedAt;

				if (this._isProcessing) {
					// Ensure indicator is visible and update elapsed time
					this._postProcessing(true, this._processingPhase, this._processingDetail);
					this._postToWebview({
						type: 'updateProcessingElapsed',
						data: { elapsed, processCount },
					});
				} else if (processCount > 0) {
					// Processes running but indicator is off — restore it
					this._isProcessing = true;
					this._postProcessing(true, 'Processing', 'Active CLI process detected');
				}
			} catch {
				// Non-critical monitoring — ignore errors
			}
		}, 3000);
	}

	private _stopActivityMonitor(): void {
		if (this._activityMonitorInterval) {
			clearInterval(this._activityMonitorInterval);
			this._activityMonitorInterval = null;
		}
	}

	/**
	 * Run an async function with processing indicator active.
	 * Guarantees the indicator is cleared even if the function throws.
	 */
	private async _withProcessing<T>(phase: string, detail: string, fn: () => Promise<T>): Promise<T> {
		this._isProcessing = true;
		this._postProcessing(true, phase, detail);
		this._startActivityMonitor();
		try {
			return await fn();
		} finally {
			this._isProcessing = false;
			this._postProcessing(false);
			this._stopActivityMonitor();
		}
	}

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
		this._startActivityMonitor();

		try {
			await this._runWorkflowCycle();
		} finally {
			this._isProcessing = false;
			this._postProcessing(false);
			this._postInputEnabled(true);
			this._stopActivityMonitor();
			// Full hydration to render final state from DB
			this._update();
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
		this._stopActivityMonitor();

		// Refresh view to show current state from DB
		this._update();

		// Show cancellation message AFTER hydration so it appears on top of the final state
		const detail = killed > 0 ? ` (${killed} process${killed > 1 ? 'es' : ''} terminated)` : '';
		this._postToWebview({
			type: 'systemMessage',
			data: { message: `Workflow cancelled by user${detail}. You can start a new task or resume.` },
		});
	}

	// INTAKE phase handlers — delegated to panelIntake.ts
	private async _handleIntakeFinalize(): Promise<void> {
		await panelIntake.handleIntakeFinalize(this._ctx());
	}

	private async _handleIntakeApprove(): Promise<void> {
		await panelIntake.handleIntakeApprove(this._ctx());
	}
	private _handleIntakeContinueDiscussing(): void {
		panelIntake.handleIntakeContinueDiscussing(this._ctx());
	}
	private _handleIntakeSkipGathering(): void {
		panelIntake.handleIntakeSkipGathering(this._ctx());
	}
	private _handleIntakeModeSelected(mode: string): void {
		panelIntake.handleIntakeModeSelected(this._ctx(), mode);
	}

	// Architecture handlers — delegated to panelArchitecture.ts
	private async _handleArchitectureGateDecision(message: { type: string; [key: string]: unknown }): Promise<void> {
		await panelArchitecture.handleArchitectureGateDecision(this._ctx(), message);
	}
	private async _handleArchitectureDecomposeDeeper(message: { type: string; [key: string]: unknown }): Promise<void> {
		await panelArchitecture.handleArchitectureDecomposeDeeper(this._ctx(), message);
	}

	/**
	 * Handle partial MMP save — persists in-progress decisions to SQLite
	 * so they survive VS Code restarts.
	 */
	// MMP/Draft handlers — delegated to panelMmp.ts
	private _handleMmpPartialSave(message: { type: string; [key: string]: unknown }): void {
		panelMmp.handleMmpPartialSave(this._activeDialogueId, message);
	}
	private _handleDraftSave(message: { type: string; drafts?: Array<{ category: string; itemKey: string; value: string }> }): void {
		panelMmp.handleDraftSave(this._activeDialogueId, message);
	}
	private _handleDraftClear(message: { type: string; category?: string }): void {
		panelMmp.handleDraftClear(this._activeDialogueId, message);
	}

	private async _handleMMPSubmit(message: { type: string; [key: string]: unknown }): Promise<void> {
		await runWithTrace(this._activeDialogueId ?? 'unknown', 'mmpSubmit', () =>
			panelMmp.handleMMPSubmit(this._ctx(), message)
		);
	}

	/**
	 * Handle MMP decisions submitted from a review gate context.
	 * Converts MMP pre-mortem/menu/mirror decisions into the itemRationales
	 * format expected by _handleReviewGateDecision.
	 */
	private async _handleReviewMmpDecision(message: { type: string; [key: string]: unknown }): Promise<void> {
		const result = panelMmp.buildReviewMmpDecision(this._activeDialogueId, message);
		if (result) {
			await panelGates.handleReviewGateDecision(this._ctx(), result.gateId, result.action, result.itemRationales, result.overallFeedback);
		}
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
		await panelExport.handleExportStream(this._activeDialogueId);
	}

	/**
	 * Generate a prose document from the current dialogue's structured data.
	 * Shows a QuickPick of available document types, calls the LLM, stores
	 * the result in SQLite, and opens it in a read-only editor tab.
	 */
	private async _handleGenerateDocument(): Promise<void> {
		await panelExport.handleGenerateDocument(this._activeDialogueId);
	}

	/**
	 * Export a document's markdown content to a user-chosen file.
	 */
	private async _exportDocumentContent(title: string, content: string): Promise<void> {
		await panelExport.exportDocumentContent(title, content);
	}

	/**
	 * Handle a gate decision from the webview
	 */
	private _handleGateDecision(gateId: string, action: string, rationale: string): void {
		runWithTrace(this._activeDialogueId ?? 'unknown', 'gateDecision', () =>
			panelGates.handleGateDecision(this._ctx(), gateId, action, rationale)
		);
	}

	/**
	 * Handle a gate decision from the webview card buttons.
	 * Wraps the generic gate decision with repair-escalation awareness:
	 * if the gate is a repair escalation, reset the failed unit to READY and resume.
	 */
	private async _handleGateDecisionAndResume(gateId: string, action: string, rationale: string): Promise<void> {
		await runWithTrace(this._activeDialogueId ?? 'unknown', 'gateDecision', () =>
			panelGates.handleGateDecisionAndResume(this._ctx(), gateId, action, rationale)
		);
	}

	/**
	 * Handle a verification gate decision from the webview
	 */
	private async _handleVerificationGateDecision(gateId: string, action: string, claimRationales?: Record<string, string>): Promise<void> {
		await runWithTrace(this._activeDialogueId ?? 'unknown', 'verificationGate', () =>
			panelGates.handleVerificationGateDecision(this._ctx(), gateId, action, claimRationales)
		);
	}

	/**
	 * Handle review gate decisions: APPROVE or REFRAME (request changes)
	 */
	private async _handleReviewGateDecision(gateId: string, action: string, itemRationales?: Record<string, string>, overallFeedback?: string): Promise<void> {
		await runWithTrace(this._activeDialogueId ?? 'unknown', 'reviewGate', () =>
			panelGates.handleReviewGateDecision(this._ctx(), gateId, action, itemRationales, overallFeedback)
		);
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
			this._postToWebview({
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

		this._postToWebview({
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

		if (!permissionId) {
			this._postToWebview({ type: 'permissionDecisionRejected', permissionId: permissionId || '', reason: 'No permission ID' });
			return;
		}

		try {
			getEventBus().emit('permission:decided', {
				permissionId,
				approved,
				approveAll,
				reason: approved ? 'Approved by human' : 'Denied by human',
			});
			this._postToWebview({ type: 'permissionDecisionAccepted', permissionId, approved });
		} catch (err) {
			this._postToWebview({ type: 'permissionDecisionRejected', permissionId, reason: err instanceof Error ? err.message : 'Permission decision failed' });
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
		this._startActivityMonitor();

		try {
			await this._runWorkflowCycle();
		} finally {
			this._isProcessing = false;
			this._postProcessing(false);
			this._postInputEnabled(true);
			this._stopActivityMonitor();
			// Full hydration to render final state from DB
			this._update();
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
		this._startActivityMonitor();

		try {
			await this._runWorkflowCycle();
		} finally {
			this._isProcessing = false;
			this._postProcessing(false);
			this._postInputEnabled(true);
			this._stopActivityMonitor();
			// Full hydration to render final state from DB
			this._update();
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
		await panelExport.handleReviewRerun(this._activeDialogueId, this._view, guidance);
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
		if (!this._activeDialogueId || !targetText.trim()) {return false;}

		const { resolveNavigationTarget, assessNavigation, getAvailableTargets } = await import('../../workflow/navigationResolver.js');
		const { transitionWorkflow, updateWorkflowMetadata, getWorkflowState, TransitionTrigger } = await import('../../workflow/stateMachine.js');

		const wsResult = getWorkflowState(this._activeDialogueId);
		if (!wsResult.success) {return false;}
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

		// Show processing indicator and refresh only the header (not full hydration,
		// which would destroy client-side system messages and the processing indicator)
		this._isProcessing = true;
		this._postInputEnabled(false);
		this._postProcessing(true, label, `Navigating to ${label}`);
		this._startActivityMonitor();

		// Refresh just the header breadcrumb — not the full stream
		this._postHeaderUpdate();

		try {
			await this._runWorkflowCycle();
		} finally {
			this._isProcessing = false;
			this._postProcessing(false);
			this._postInputEnabled(true);
			this._stopActivityMonitor();
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
		this._postToWebview({
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
		this._postToWebview({
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

	/**
	 * API key management — delegated to panelApiKeys.ts
	 */
	// API key management — delegated to panelApiKeys.ts
	private async _sendKeyStatus(): Promise<void> {
		if (this._view) {await apiKeys.sendKeyStatus(this._view.webview);}
	}
	private async _handleSetApiKey(role: string): Promise<void> {
		if (this._view) {await apiKeys.handleSetApiKey(role, this._view.webview);}
	}
	private async _handleClearApiKey(role: string): Promise<void> {
		if (this._view) {await apiKeys.handleClearApiKey(role, this._view.webview);}
	}

	// File picker and mention — delegated to panelFileAssist.ts
	private async _handlePickFile(): Promise<void> {
		if (this._view) {await fileAssist.handlePickFile(this._view.webview);}
	}
	private async _handleMentionSuggestions(_query: string): Promise<void> {
		if (this._view) {await fileAssist.handleMentionSuggestions(this._view.webview);}
	}

	/**
	 * Full update: re-render the entire webview HTML
	 */
	/**
	 * Schedule a debounced _update(). Coalesces rapid events (e.g., phase change + gate trigger)
	 * into a single re-render. Use this for event-driven updates; use _update() directly
	 * for user-initiated actions that need immediate feedback.
	 *
	 * During active processing the full stream re-render is suppressed: only the header/stepper
	 * is refreshed. Architecture sub-phase transitions write new cards (capabilities, design, etc.)
	 * to the DB with timestamps that sort them BETWEEN existing CLI command cards, causing those
	 * cards to appear mid-stream unexpectedly. Blocking the full hydrate during processing
	 * prevents this; the complete stream is re-rendered once processing stops.
	 */
	private _scheduleUpdate(): void {
		if (this._pendingUpdateTimer) {return;}
		this._pendingUpdateTimer = setTimeout(() => {
			this._pendingUpdateTimer = null;
			if (this._isProcessing) {
				// Processing is active — only refresh the header/stepper so sub-phase
				// progress is visible without disrupting the stream card order.
				this._postHeaderUpdate();
				return;
			}
			this._incrementalOrFullUpdate();
		}, 100);
	}

	/**
	 * Try an incremental update: if the stream content hasn't changed since last render,
	 * skip the expensive HTML regeneration. Falls back to full _update() if items changed.
	 */
	private _incrementalOrFullUpdate(): void {
		if (!this._view || !this._activeDialogueId) {
			this._update();
			return;
		}

		const state = aggregateStreamState(this._activeDialogueId);
		const itemCount = state.streamItems.length;
		const lastType = itemCount > 0 ? state.streamItems[itemCount - 1].type : '';
		const claimHealth = state.claimHealth
			? `${state.claimHealth.verified}:${state.claimHealth.disproved}:${state.claimHealth.open}`
			: '';
		const fingerprint = `${itemCount}:${lastType}:${state.currentPhase}:${state.openGates.length}:${claimHealth}`;

		if (fingerprint === this._lastStreamFingerprint) {
			// Stream truly unchanged — skip re-render
			if (this._isProcessing) {
				this._postProcessing(true, this._processingPhase, this._processingDetail);
			}
			return;
		}

		this._lastStreamFingerprint = fingerprint;
		this._update();
	}

	private _update(): void {
		if (!this._view) {
			return;
		}
		const speechSetting = vscode.workspace.getConfiguration('janumicode.speech').get('enabled', true);
		setSpeechEnabled(speechSetting);
		setSoxAvailable(this._speechHandler.soxAvailable);
		const state = aggregateStreamState(this._activeDialogueId ?? undefined);

		// Load pending MMP decisions for client-side rendering
		let pendingDecisions: Record<string, unknown> | undefined;
		if (this._activeDialogueId) {
			try {
				const { getPendingMmpDecisions } = require('../../database/pendingMmpStore');
				const result = getPendingMmpDecisions(this._activeDialogueId);
				if (result.success && Object.keys(result.value).length > 0) {
					pendingDecisions = result.value;
				}
			} catch { /* table may not exist yet */ }
		}

		// Build header server-side (complex state deps)
		const headerHtml = renderStickyHeader(state);
		const gateContext = state.currentPhase === 'VERIFY' && state.openGates.length > 0
			? 'Review verification results above and choose an action'
			: state.currentPhase === 'REVIEW' && state.openGates.length > 0
			? 'Review the summary above and approve or request changes'
			: undefined;

		// ── Diagnostic logging ──
		{
			const hydrateLog = isLoggerInitialized() ? getLogger().child({ component: 'governedStream' }) : undefined;
			const items = state.streamItems as Array<{ type: string }>;
			hydrateLog?.debug('hydrateSending', { itemCount: items.length, types: items.map((it, i) => `${i}:${it.type}`) });
			const typeCounts: Record<string, number> = {};
			for (const it of items) { typeCounts[it.type] = (typeCounts[it.type] || 0) + 1; }
			for (const [t, c] of Object.entries(typeCounts)) {
				if (c > 1) { hydrateLog?.warn('hydrateDuplicateType', { duplicateType: t, count: c }); }
			}
		}
		// ── End diagnostic logging ──

		// Send hydrate message — webview renders stream items client-side and updates input area surgically
		this._postToWebview({
			type: 'hydrate',
			items: state.streamItems,
			headerHtml,
			inputState: {
				phase: state.currentPhase,
				isProcessing: this._isProcessing,
				hasOpenGates: state.openGates.length > 0,
				gateContext,
				placeholder: PHASE_PLACEHOLDERS[state.currentPhase] ?? 'Enter your message...',
			},
			pendingDecisions,
		});

		// Update fingerprint after render
		const itemCount = state.streamItems.length;
		const lastType = itemCount > 0 ? state.streamItems[itemCount - 1].type : '';
		const ch = state.claimHealth ? `${state.claimHealth.verified}:${state.claimHealth.disproved}:${state.claimHealth.open}` : '';
		this._lastStreamFingerprint = `${itemCount}:${lastType}:${state.currentPhase}:${state.openGates.length}:${ch}`;

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

		// Restore user input drafts from SQLite
		this._postDrafts();
	}

	/**
	 * Load user input drafts from SQLite and send to webview for DOM restoration.
	 */
	private _postDrafts(): void {
		if (!this._activeDialogueId || !this._view) {return;}
		try {
			const { getDrafts } = require('../../database/draftStore');
			const result = getDrafts(this._activeDialogueId);
			if (result.success && Object.keys(result.value).length > 0) {
				this._postToWebview({
					type: 'draftsLoaded',
					drafts: result.value,
				});
			}
		} catch { /* table may not exist yet */ }
	}

	/**
	 * Load pending MMP decisions from SQLite and send to webview for DOM restoration.
	 */
	private _postPendingMmpDecisions(): void {
		if (!this._activeDialogueId || !this._view) {return;}
		try {
			const { getPendingMmpDecisions } = require('../../database/pendingMmpStore');
			const result = getPendingMmpDecisions(this._activeDialogueId);
			if (result.success && Object.keys(result.value).length > 0) {
				const pendLog = isLoggerInitialized() ? getLogger().child({ component: 'governedStream' }) : undefined;
				const cardIds = Object.keys(result.value);
				pendLog?.debug('postPendingSending', { cardCount: cardIds.length, cardIds });
				for (const [cid, decisions] of Object.entries(result.value)) {
					const d = decisions as { mirrorDecisions?: Record<string, unknown>; menuSelections?: Record<string, unknown>; preMortemDecisions?: Record<string, unknown> };
					pendLog?.debug('postPendingCard', { cardId: cid, mirrorKeys: Object.keys(d.mirrorDecisions ?? {}), menuKeys: Object.keys(d.menuSelections ?? {}), pmKeys: Object.keys(d.preMortemDecisions ?? {}) });
				}
				this._postToWebview({
					type: 'pendingMmpDecisionsLoaded',
					decisions: result.value,
				});
			} else {
				const noPendLog = isLoggerInitialized() ? getLogger().child({ component: 'governedStream' }) : undefined;
				noPendLog?.debug('postPendingNone', { dialogueId: this._activeDialogueId });
			}
		} catch (err) {
			const errLog = isLoggerInitialized() ? getLogger().child({ component: 'governedStream' }) : undefined;
			errLog?.error('postPendingError', { error: err });
		}
	}

	/**
	 * Load clarification threads from DB and send to the webview for restoration.
	 */
	private _postClarificationThreads(): void {
		if (!this._activeDialogueId || !this._view) {return;}
		try {
			const threads = getClarificationThreads(this._activeDialogueId);
			if (threads.length > 0) {
				this._postToWebview({
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
		this._postToWebview({
			type: 'showSettings',
			data: { visible: true },
		});
		await this._sendKeyStatus();
	}

	/**
	 * Compose the full HTML document for the webview
	 */
	private _getHtmlForWebview(state: GovernedStreamState, webview: vscode.Webview): string {
		const nonce = getNonce();

		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'governedStream.js')
		);

		// Shell HTML: header + empty stream + settings + static input area
		// Stream content rendered client-side via hydrate/reconcile; input area updated surgically via inputState
		const headerHtml = renderStickyHeader(state);
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
		<div id="header-container">${headerHtml}</div>
		<div class="stream-area">
			<div id="stream-content">
				<!-- Stream content rendered client-side via hydrate message -->
			</div>
			<div id="processing-container">
				<!-- Processing indicator: inside stream-area for scrolling, but below stream-content so hydration won't destroy it -->
			</div>
		</div>
		${settingsPanelHtml}
		<div id="input-container">${inputHtml}</div>
	</div>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}

	/**
	 * Clean up event bus subscriptions
	 */
	// ==================== SPEECH-TO-TEXT ====================
	// Delegated to panelSpeech.ts — SpeechHandler owns service lifecycle and recording state

	private async _sendSpeechCapability(): Promise<void> {
		if (this._view) {await this._speechHandler.sendCapability(this._view.webview);}
	}
	private async _handleSpeechStart(targetInputId: string): Promise<void> {
		if (this._view) {await this._speechHandler.handleStart(targetInputId, this._view.webview);}
	}
	private async _handleSpeechStop(): Promise<void> {
		if (this._view) {await this._speechHandler.handleStop(this._view.webview);}
	}
	private _handleSpeechCancel(): void {
		if (this._view) {this._speechHandler.handleCancel(this._view.webview);}
	}

	// ==================== CLEANUP ====================

	private _cleanup(): void {
		const cleanupLog = isLoggerInitialized() ? getLogger().child({ component: 'governedStream' }) : undefined;
		cleanupLog?.info('cleanupStarted');
		this._disposed = true;
		this._isProcessing = false;
		this._stopActivityMonitor();
		// Clear pending debounce timer to prevent post-dispose firing
		if (this._pendingUpdateTimer) {
			clearTimeout(this._pendingUpdateTimer);
			this._pendingUpdateTimer = null;
		}
		// Dispose configuration watcher
		this._configWatcherDisposable?.dispose();
		this._configWatcherDisposable = undefined;
		// Abort any in-flight workflow cycle — kills CLI processes via signal
		this._workflowAbortController?.abort();
		this._workflowAbortController = null;
		this._speechHandler.cancel();
		for (const unsub of this._eventUnsubscribers) {
			unsub();
		}
		this._eventUnsubscribers = [];
		this._view = undefined;
		cleanupLog?.info('cleanupComplete');
	}
}

/**
 * Generate a random nonce for Content Security Policy
 */
function getNonce(): string {
	return randomBytes(24).toString('base64url');
}
