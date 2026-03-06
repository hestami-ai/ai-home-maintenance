/**
 * Dialogue Orchestrator Integration
 * Implements Phase 9.1.1: Wire up dialogue system to workflow orchestrator
 * Coordinates dialogue turns with workflow phase execution
 */

import type { Result, Dialogue, DialogueTurn, RoleLLMConfig } from '../types';
import { CodedError, Phase, Role, SpeechAct } from '../types';
import { createDialogueSession, getDialogueSession, createAndAddTurn, createDialogueRecord, completeDialogue } from '../dialogue';
import { initializeWorkflowState, getWorkflowState } from '../workflow';
import { advanceWorkflow, type WorkflowProviders } from '../workflow/orchestrator';
import { hasOpenGates } from '../workflow/gates';
import { getProviderForRole, clearRoleProviderCache } from '../llm/roleManager';
import { getDatabase } from '../database';
import {
	emitDialogueStarted,
	emitDialogueTurnAdded,
	emitError,
} from './eventBus';

/**
 * Start dialogue with workflow options
 */
export interface StartDialogueWithWorkflowOptions {
	/** Initial user goal/prompt */
	goal: string;
	/** LLM configuration for all roles */
	llmConfig: RoleLLMConfig;
	/** Token budget for workflow execution */
	tokenBudget?: number;
	/** Additional metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Start dialogue with workflow result
 */
export interface StartDialogueWithWorkflowResult {
	/** Created dialogue */
	dialogue: Dialogue;
	/** Initial dialogue turn */
	turn: DialogueTurn;
	/** Whether workflow was initialized */
	workflowInitialized: boolean;
}

/**
 * Advance dialogue with workflow options
 */
export interface AdvanceDialogueWithWorkflowOptions {
	/** Dialogue ID */
	dialogueId: string;
	/** Role making the turn */
	role: string;
	/** Content of the turn */
	content: string;
	/** LLM configuration */
	llmConfig: RoleLLMConfig;
	/** Token budget */
	tokenBudget?: number;
	/** Whether to advance workflow after turn */
	advanceWorkflow?: boolean;
}

/**
 * Advance dialogue with workflow result
 */
export interface AdvanceDialogueWithWorkflowResult {
	/** Created dialogue turn */
	turn: DialogueTurn;
	/** Whether workflow was advanced */
	workflowAdvanced: boolean;
	/** Current workflow phase (if advanced) */
	currentPhase?: string;
}

/**
 * Start a new dialogue with workflow initialization
 * Creates dialogue, adds initial turn, and initializes workflow state
 *
 * @param options Start options
 * @returns Result with dialogue, turn, and workflow status
 */
export function startDialogueWithWorkflow(
	options: StartDialogueWithWorkflowOptions
): Result<StartDialogueWithWorkflowResult> {
	try {
		// Create new dialogue session
		const dialogueResult = createDialogueSession();

		if (!dialogueResult.success) {
			return dialogueResult;
		}

		const dialogue = dialogueResult.value;

		// Add initial turn with user goal (HUMAN role only allows DECISION speech act)
		const turnResult = createAndAddTurn({
			dialogue_id: dialogue.dialogue_id,
			role: Role.HUMAN,
			phase: Phase.INTAKE,
			speech_act: SpeechAct.DECISION,
			content_ref: options.goal,
			related_claims: [],
		});

		if (!turnResult.success) {
			return turnResult;
		}

		const turn = turnResult.value;

		// Initialize workflow state with goal in metadata
		const workflowResult = initializeWorkflowState(dialogue.dialogue_id, {
			goal: options.goal,
		});

		if (!workflowResult.success) {
			return {
				success: false,
				error: new CodedError(
					'WORKFLOW_INIT_FAILED',
					`Failed to initialize workflow: ${workflowResult.error.message}`
				),
			};
		}

		// Persist dialogue lifecycle record for multi-dialogue stream
		createDialogueRecord(dialogue.dialogue_id, options.goal);

		// Emit events so UI subscribers update
		emitDialogueStarted(dialogue.dialogue_id, options.goal);
		emitDialogueTurnAdded(dialogue.dialogue_id, turn.turn_id, Role.HUMAN);

		return {
			success: true,
			value: {
				dialogue,
				turn,
				workflowInitialized: true,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'START_DIALOGUE_WORKFLOW_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Advance dialogue with optional workflow execution
 * Adds a dialogue turn and optionally advances the workflow
 *
 * @param options Advance options
 * @returns Result with turn and workflow status
 */
export async function advanceDialogueWithWorkflow(
	options: AdvanceDialogueWithWorkflowOptions
): Promise<Result<AdvanceDialogueWithWorkflowResult>> {
	try {
		// Get current workflow state to determine phase
		const stateResult = getWorkflowState(options.dialogueId);
		const currentPhase = stateResult.success
			? stateResult.value.current_phase
			: Phase.INTAKE;

		// Add dialogue turn with actual content (speech act must match role constraints)
		const resolvedRole = (options.role as Role) ?? Role.HUMAN;
		const speechAct = resolvedRole === Role.HUMAN ? SpeechAct.DECISION : SpeechAct.CLAIM;
		const turnResult = createAndAddTurn({
			dialogue_id: options.dialogueId,
			role: resolvedRole,
			phase: currentPhase,
			speech_act: speechAct,
			content_ref: options.content,
			related_claims: [],
		});

		if (!turnResult.success) {
			return turnResult;
		}

		const turn = turnResult.value;
		emitDialogueTurnAdded(options.dialogueId, turn.turn_id, options.role);

		// Optionally advance the workflow
		if (options.advanceWorkflow) {
			const executorResult = await getProviderForRole('executor');
			const verifierResult = await getProviderForRole('verifier');
			const historianResult = await getProviderForRole('historianInterpreter');

			if (!executorResult.success || !verifierResult.success || !historianResult.success) {
				return {
					success: true,
					value: {
						turn,
						workflowAdvanced: false,
						currentPhase: currentPhase as string,
					},
				};
			}

			const providers: WorkflowProviders = {
				executor: executorResult.value,
				verifier: verifierResult.value,
				historianInterpreter: historianResult.value,
			};

			const workflowResult = await advanceWorkflow(
				options.dialogueId,
				providers,
				options.tokenBudget ?? 10000
			);

			return {
				success: true,
				value: {
					turn,
					workflowAdvanced: workflowResult.success,
					currentPhase: workflowResult.success
						? (workflowResult.value.nextPhase as string) ?? (workflowResult.value.phase as string)
						: (currentPhase as string),
				},
			};
		}

		return {
			success: true,
			value: {
				turn,
				workflowAdvanced: false,
				currentPhase: currentPhase as string,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'ADVANCE_DIALOGUE_WORKFLOW_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Get dialogue with workflow status
 * Retrieves dialogue and current workflow state
 *
 * @param dialogueId Dialogue ID
 * @returns Result with dialogue and workflow info
 */
export function getDialogueWithWorkflow(dialogueId: string): Result<{
	dialogue: Dialogue;
	currentPhase: string;
	hasOpenGates: boolean;
}> {
	try {
		// Get dialogue session
		const dialogueResult = getDialogueSession(dialogueId);

		if (!dialogueResult.success) {
			return {
				success: false,
				error: dialogueResult.error,
			};
		}

		if (!dialogueResult.value) {
			return {
				success: false,
				error: new CodedError(
					'DIALOGUE_NOT_FOUND',
					`Dialogue not found: ${dialogueId}`
				),
			};
		}

		// Get workflow state
		const stateResult = getWorkflowState(dialogueId);

		if (!stateResult.success) {
			return {
				success: false,
				error: new CodedError(
					'WORKFLOW_STATE_NOT_FOUND',
					'Workflow state not found for dialogue'
				),
			};
		}

		// Check for open gates
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new CodedError(
					'DATABASE_NOT_INITIALIZED',
					'Database not initialized'
				),
			};
		}

		const gateCount = db
			.prepare(
				`
			SELECT COUNT(*) as count
			FROM gates
			WHERE dialogue_id = ? AND status = 'OPEN'
		`
			)
			.get(dialogueId) as { count: number };

		return {
			success: true,
			value: {
				dialogue: dialogueResult.value,
				currentPhase: stateResult.value.current_phase,
				hasOpenGates: gateCount.count > 0,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'GET_DIALOGUE_WORKFLOW_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Execute complete workflow cycle
 * Runs workflow until completion, gate, or error
 *
 * @param dialogueId Dialogue ID
 * @param llmConfig LLM configuration
 * @param tokenBudget Token budget
 * @param maxPhases Maximum phases to execute (safety limit)
 * @returns Result with execution summary
 */
export async function executeWorkflowCycle(
	dialogueId: string,
	llmConfig: RoleLLMConfig,
	tokenBudget: number = 10000,
	maxPhases: number = 20
): Promise<
	Result<{
		phasesExecuted: number;
		finalPhase: string;
		gateTriggered: boolean;
		awaitingInput: boolean;
		completed: boolean;
	}>
> {
	try {
		// Clear cached providers so fresh API keys are resolved each cycle
		clearRoleProviderCache();

		// Resolve actual LLM provider instances from roleManager
		const executorResult = await getProviderForRole('executor');
		if (!executorResult.success) {
			return {
				success: false,
				error: new CodedError(
					'PROVIDER_INIT_FAILED',
					`Failed to initialize executor provider: ${executorResult.error.message}`
				),
			};
		}

		const verifierResult = await getProviderForRole('verifier');
		if (!verifierResult.success) {
			return {
				success: false,
				error: new CodedError(
					'PROVIDER_INIT_FAILED',
					`Failed to initialize verifier provider: ${verifierResult.error.message}`
				),
			};
		}

		const historianResult = await getProviderForRole('historianInterpreter');
		if (!historianResult.success) {
			return {
				success: false,
				error: new CodedError(
					'PROVIDER_INIT_FAILED',
					`Failed to initialize historian provider: ${historianResult.error.message}`
				),
			};
		}

		const providers: WorkflowProviders = {
			executor: executorResult.value,
			verifier: verifierResult.value,
			historianInterpreter: historianResult.value,
		};

		let phasesExecuted = 0;
		let gateTriggered = false;
		let awaitingInput = false;
		let completed = false;
		let finalPhase = '';

		for (let i = 0; i < maxPhases; i++) {
			// Check for open gates before advancing
			const gatesResult = hasOpenGates(dialogueId);
			if (gatesResult.success && gatesResult.value) {
				gateTriggered = true;
				const stateResult = getWorkflowState(dialogueId);
				finalPhase = stateResult.success ? stateResult.value.current_phase : 'UNKNOWN';
				break;
			}

			// Advance one phase
			const result = await advanceWorkflow(dialogueId, providers, tokenBudget);

			if (!result.success) {
				emitError('WORKFLOW_ADVANCE_FAILED', result.error.message, { dialogueId });
				// Return what we have so far rather than failing entirely
				const stateResult = getWorkflowState(dialogueId);
				finalPhase = stateResult.success ? stateResult.value.current_phase : 'UNKNOWN';
				break;
			}

			phasesExecuted++;
			finalPhase = (result.value.nextPhase ?? result.value.phase) as string;

			// Check if workflow completed (reached COMMIT).
			// Use result.value.phase (the actual executed phase) rather than
			// finalPhase (which prefers nextPhase and could be something else).
			if ((result.value.phase as string) === Phase.COMMIT) {
				completed = true;
				finalPhase = Phase.COMMIT;
				completeDialogue(dialogueId);
				break;
			}

			// Check if a gate was triggered during this phase
			if (result.value.gateTriggered) {
				gateTriggered = true;
				break;
			}

			// Check if phase is awaiting human input (INTAKE conversation)
			if (result.value.awaitingInput) {
				awaitingInput = true;
				break;
			}
		}

		return {
			success: true,
			value: {
				phasesExecuted,
				finalPhase,
				gateTriggered,
				awaitingInput,
				completed,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'WORKFLOW_CYCLE_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}
