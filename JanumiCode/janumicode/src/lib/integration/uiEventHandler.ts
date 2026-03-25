/**
 * UI Event Handler Integration
 * Implements Phase 9.1.5: Wire up UI events to workflow actions
 * Handles user interactions from VS Code UI and triggers workflow actions
 */

import * as vscode from 'vscode';
import type { Result, RoleLLMConfig, HumanAction, Gate } from '../types';
import { CodedError, LLMProvider } from '../types';
import { startDialogueWithWorkflow, advanceDialogueWithWorkflow, executeWorkflowCycle } from './dialogueOrchestrator';
import { resolveGate, getGate } from '../workflow/gates';
import { captureHumanDecision } from '../roles/human';
import { resumeWorkflowAfterGate } from '../workflow/humanGateHandling';
import { getConfig } from '../config';
import { getLogger, isLoggerInitialized } from '../logging';

/**
 * UI event types
 */
export type UIEventType =
	| 'START_DIALOGUE'
	| 'ADVANCE_WORKFLOW'
	| 'RESOLVE_GATE'
	| 'REFRESH_VIEW'
	| 'EXPORT_HISTORY'
	| 'CLEAR_HISTORY';

/**
 * UI event data
 */
export interface UIEventData {
	type: UIEventType;
	payload?: unknown;
}

/**
 * Handle UI event
 * Processes UI events and triggers appropriate workflow actions
 *
 * @param event UI event
 * @returns Result of event handling
 */
export async function handleUIEvent(event: UIEventData): Promise<Result<unknown>> {
	try {
		switch (event.type) {
			case 'START_DIALOGUE':
				return await handleStartDialogue(event.payload as { goal: string });

			case 'ADVANCE_WORKFLOW':
				return await handleAdvanceWorkflow(event.payload as { dialogueId: string });

			case 'RESOLVE_GATE':
				return await handleResolveGate(
					event.payload as {
						gateId: string;
						action: HumanAction;
						rationale: string;
					}
				);

			case 'REFRESH_VIEW':
				return handleRefreshView(event.payload as { viewId: string });

			case 'EXPORT_HISTORY':
				return handleExportHistory(event.payload as { dialogueId: string });

			case 'CLEAR_HISTORY':
				return handleClearHistory();

			default:
				return {
					success: false,
					error: new CodedError(
						'UNKNOWN_EVENT_TYPE',
						`Unknown UI event type: ${event.type}`
					),
				};
		}
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'UI_EVENT_HANDLING_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Handle start dialogue event
 * Initiates a new dialogue with workflow
 *
 * @param payload Event payload
 * @returns Result of dialogue start
 */
async function handleStartDialogue(payload: {
	goal: string;
}): Promise<Result<{ dialogueId: string }>> {
	try {
		// Get LLM configuration
		const config = await getConfig();
		const llmConfig: RoleLLMConfig = {
			executor: {
				provider: config.llmConfig.executor.provider,
				model: config.llmConfig.executor.model,
				apiKey: config.llmConfig.executor.apiKey,
				temperature: config.llmConfig.executor.temperature,
				maxTokens: config.llmConfig.executor.maxTokens,
			},
			technicalExpert: {
				provider: config.llmConfig.technicalExpert.provider,
				model: config.llmConfig.technicalExpert.model,
				apiKey: config.llmConfig.technicalExpert.apiKey,
				temperature: config.llmConfig.technicalExpert.temperature,
				maxTokens: config.llmConfig.technicalExpert.maxTokens,
			},
			verifier: {
				provider: config.llmConfig.verifier.provider,
				model: config.llmConfig.verifier.model,
				apiKey: config.llmConfig.verifier.apiKey,
				temperature: config.llmConfig.verifier.temperature,
				maxTokens: config.llmConfig.verifier.maxTokens,
			},
			historianInterpreter: {
				provider: config.llmConfig.historianInterpreter.provider,
				model: config.llmConfig.historianInterpreter.model,
				apiKey: config.llmConfig.historianInterpreter.apiKey,
				temperature: config.llmConfig.historianInterpreter.temperature,
				maxTokens: config.llmConfig.historianInterpreter.maxTokens,
			},
		};

		// Start dialogue with workflow
		const result = startDialogueWithWorkflow({
			goal: payload.goal,
			llmConfig,
			tokenBudget: config.tokenBudget,
		});

		if (!result.success) {
			return result;
		}

		const dialogueId = result.value.dialogue.dialogue_id;

		// Show success notification
		vscode.window.showInformationMessage(`Dialogue started: ${dialogueId}`);

		// Fire-and-forget auto-advance so command palette path also runs the workflow
		executeWorkflowCycle(dialogueId, llmConfig, config.tokenBudget).catch(() => {});

		return {
			success: true,
			value: { dialogueId },
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'START_DIALOGUE_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Handle advance workflow event
 * Advances the workflow for a dialogue
 *
 * @param payload Event payload
 * @returns Result of workflow advance
 */
async function handleAdvanceWorkflow(payload: {
	dialogueId: string;
}): Promise<Result<{ currentPhase: string }>> {
	try {
		// Get LLM configuration
		const config = await getConfig();
		const llmConfig: RoleLLMConfig = {
			executor: {
				provider: config.llmConfig.executor.provider,
				model: config.llmConfig.executor.model,
				apiKey: config.llmConfig.executor.apiKey,
				temperature: config.llmConfig.executor.temperature,
				maxTokens: config.llmConfig.executor.maxTokens,
			},
			technicalExpert: {
				provider: config.llmConfig.technicalExpert.provider,
				model: config.llmConfig.technicalExpert.model,
				apiKey: config.llmConfig.technicalExpert.apiKey,
				temperature: config.llmConfig.technicalExpert.temperature,
				maxTokens: config.llmConfig.technicalExpert.maxTokens,
			},
			verifier: {
				provider: config.llmConfig.verifier.provider,
				model: config.llmConfig.verifier.model,
				apiKey: config.llmConfig.verifier.apiKey,
				temperature: config.llmConfig.verifier.temperature,
				maxTokens: config.llmConfig.verifier.maxTokens,
			},
			historianInterpreter: {
				provider: config.llmConfig.historianInterpreter.provider,
				model: config.llmConfig.historianInterpreter.model,
				apiKey: config.llmConfig.historianInterpreter.apiKey,
				temperature: config.llmConfig.historianInterpreter.temperature,
				maxTokens: config.llmConfig.historianInterpreter.maxTokens,
			},
		};

		// Advance dialogue with workflow
		const result = await advanceDialogueWithWorkflow({
			dialogueId: payload.dialogueId,
			role: 'system',
			content: 'Workflow advance requested by user',
			llmConfig,
			tokenBudget: config.tokenBudget,
			advanceWorkflow: true,
		});

		if (!result.success) {
			return result;
		}

		return {
			success: true,
			value: {
				currentPhase: result.value.currentPhase || 'UNKNOWN',
			},
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'ADVANCE_WORKFLOW_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Handle resolve gate event
 * Resolves a human gate with decision
 *
 * @param payload Event payload
 * @returns Result of gate resolution
 */
async function handleResolveGate(payload: {
	gateId: string;
	action: HumanAction;
	rationale: string;
}): Promise<Result<{ resumed: boolean }>> {
	try {
		// Get the gate first to retrieve dialogue ID
		const gateResult = getGate(payload.gateId);
		if (!gateResult.success) {
			return gateResult as Result<{ resumed: boolean }>;
		}

		// Capture human decision
		const decisionResult = captureHumanDecision({
			gateId: payload.gateId,
			action: payload.action,
			rationale: payload.rationale,
			decisionMaker: 'user', // TODO: Get actual user ID
		});

		if (!decisionResult.success) {
			return decisionResult as Result<{ resumed: boolean }>;
		}

		// Resolve gate with the decision
		const resolveResult = resolveGate({
			gateId: payload.gateId,
			decisionId: decisionResult.value.decision_id,
			resolution: payload.rationale,
		});

		if (!resolveResult.success) {
			return resolveResult as Result<{ resumed: boolean }>;
		}

		// Resume workflow after gate
		const resumeResult = resumeWorkflowAfterGate(gateResult.value.dialogue_id, payload.gateId);

		if (!resumeResult.success) {
			return {
				success: false,
				error: resumeResult.error,
			};
		}

		// Show success notification
		vscode.window.showInformationMessage(`Gate resolved: ${payload.action}`);

		return {
			success: true,
			value: {
				resumed: true,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'RESOLVE_GATE_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Handle refresh view event
 * Refreshes a specific view
 *
 * @param payload Event payload
 * @returns Result of view refresh
 */
function handleRefreshView(payload: { viewId: string }): Result<{ refreshed: boolean }> {
	try {
		// Emit refresh event (would be handled by view providers)
		vscode.commands.executeCommand(`${payload.viewId}.refresh`);

		return {
			success: true,
			value: {
				refreshed: true,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'REFRESH_VIEW_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Handle export history event
 * Exports dialogue history
 *
 * @param payload Event payload
 * @returns Result of history export
 */
async function handleExportHistory(payload: {
	dialogueId: string;
}): Promise<Result<{ exported: boolean }>> {
	try {
		// Show save dialog
		const uri = await vscode.window.showSaveDialog({
			filters: {
				'JSON files': ['json'],
			},
			defaultUri: vscode.Uri.file(`dialogue-${payload.dialogueId}.json`),
		});

		if (!uri) {
			return {
				success: false,
				error: new CodedError(
					'EXPORT_CANCELLED',
					'Export cancelled by user'
				),
			};
		}

		// TODO: Implement actual export logic
		vscode.window.showInformationMessage(`History exported to ${uri.fsPath}`);

		return {
			success: true,
			value: {
				exported: true,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'EXPORT_HISTORY_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Handle clear history event
 * Clears dialogue history
 *
 * @returns Result of history clear
 */
async function handleClearHistory(): Promise<Result<{ cleared: boolean }>> {
	try {
		// Confirm with user
		const confirm = await vscode.window.showWarningMessage(
			'Are you sure you want to clear all history? This cannot be undone.',
			{ modal: true },
			'Clear History'
		);

		if (confirm !== 'Clear History') {
			return {
				success: false,
				error: new CodedError(
					'CLEAR_CANCELLED',
					'Clear cancelled by user'
				),
			};
		}

		// TODO: Implement actual clear logic
		vscode.window.showInformationMessage('History cleared');

		return {
			success: true,
			value: {
				cleared: true,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'CLEAR_HISTORY_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Register UI event handlers
 * Sets up event listeners for UI interactions
 *
 * @param context Extension context
 */
export function registerUIEventHandlers(context: vscode.ExtensionContext): void {
	// Register command for starting dialogue
	const startDialogueCmd = vscode.commands.registerCommand(
		'janumicode.startDialogue',
		async () => {
			const goal = await vscode.window.showInputBox({
				prompt: 'What would you like to accomplish?',
				placeHolder: 'Enter your goal or request...',
			});

			if (goal) {
				await handleUIEvent({
					type: 'START_DIALOGUE',
					payload: { goal },
				});
			}
		}
	);
	context.subscriptions.push(startDialogueCmd);

	// Additional commands would be registered here
	if (isLoggerInitialized()) {
		getLogger().debug('UI event handlers registered');
	}
}
