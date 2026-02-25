/**
 * INTAKE Conversation Engine
 * Implements the conversational planning phase where Human and Technical Expert
 * collaborate to produce a structured implementation plan.
 *
 * Three main functions:
 * - executeIntakeConversationTurn: handles a single conversation turn (DISCUSSING)
 * - executeIntakePlanFinalization: synthesizes conversation into final plan (SYNTHESIZING)
 * - executeIntakePlanApproval: stores approved plan, transitions to PROPOSE (AWAITING_APPROVAL)
 *
 * Context management uses a sliding window (last N raw turns) plus structured
 * accumulation (summaries of older turns) to bound token growth.
 */

import type { Result, Phase } from '../types';
import { Role, SpeechAct } from '../types';
import type { PhaseExecutionResult } from './orchestrator';
import type {
	IntakePlanDocument,
	IntakeAccumulation,
	IntakeConversationTurn,
} from '../types/intake';
import { IntakeSubState } from '../types/intake';
import {
	getOrCreateIntakeConversation,
	getRecentIntakeTurns,
	getIntakeTurnsInRange,
} from '../events/reader';
import {
	writeIntakeTurn,
	updateIntakeConversation,
} from '../events/writer';
import { writeDialogueTurn } from '../events/writer';
import { resolveProviderForRole } from '../cli/providerResolver';
import {
	invokeIntakeTechnicalExpert,
	invokeIntakePlanSynthesis,
} from '../roles/technicalExpertIntake';
import {
	getWorkflowState,
	updateWorkflowMetadata,
	transitionWorkflow,
	TransitionTrigger,
} from './stateMachine';
import {
	emitIntakeTurnCompleted,
	emitIntakePlanUpdated,
	emitIntakePlanFinalized,
	emitIntakePlanApproved,
	emitWorkflowCommand,
	emitCLIActivity,
} from '../integration/eventBus';
import { getLogger, isLoggerInitialized } from '../logging';
import { randomUUID } from 'node:crypto';

// ==================== CONSTANTS ====================

/** Number of recent turns to keep in full (raw) in the context window */
const INTAKE_CONTEXT_WINDOW_SIZE = 6;

/** When turns outside the sliding window exceed this count, trigger accumulation */
const INTAKE_ACCUMULATION_THRESHOLD = 4;

/** Maximum token budget for INTAKE context (excluding system prompt) */
const INTAKE_MAX_CONTEXT_TOKENS = 8000;

/** Default token budget for INTAKE invocations */
const INTAKE_DEFAULT_TOKEN_BUDGET = 10000;

// ==================== CONVERSATION TURN ====================

/**
 * Execute a single INTAKE conversation turn.
 *
 * 1. Get conversation state
 * 2. Resolve Technical Expert CLI provider
 * 3. Invoke Technical Expert in INTAKE mode
 * 4. Store turn in intake_turns; update intake_conversations with new draft plan
 * 5. Record audit turn in dialogue_turns
 * 6. Trigger accumulation if needed
 * 7. Emit events
 * 8. Return { awaitingInput: true } to stay in INTAKE
 *
 * @param dialogueId Dialogue ID
 * @param humanMessage The human's latest message
 * @returns Result containing PhaseExecutionResult with awaitingInput: true
 */
export async function executeIntakeConversationTurn(
	dialogueId: string,
	humanMessage: string
): Promise<Result<PhaseExecutionResult>> {
	try {
		// 1. Get conversation state
		const convResult = getOrCreateIntakeConversation(dialogueId);
		if (!convResult.success) {
			return convResult as unknown as Result<PhaseExecutionResult>;
		}
		const conv = convResult.value;
		const turnNumber = conv.turnCount + 1;

		// 2. Resolve Technical Expert CLI provider
		const providerResult = await resolveProviderForRole(Role.TECHNICAL_EXPERT);
		if (!providerResult.success) {
			return providerResult as Result<PhaseExecutionResult>;
		}

		// 3. Invoke Technical Expert in INTAKE mode (with streaming for tool activity observability)
		const intakeCommandId = randomUUID();
		emitWorkflowCommand({
			dialogueId,
			commandId: intakeCommandId,
			action: 'start',
			commandType: 'cli_invocation',
			label: `Technical Expert — INTAKE Turn ${turnNumber}`,
			summary: `Processing: ${humanMessage.substring(0, 120)}`,
			status: 'running',
			timestamp: new Date().toISOString(),
		});

		const expertResult = await invokeIntakeTechnicalExpert({
			dialogueId,
			humanMessage,
			currentPlan: conv.draftPlan,
			turnNumber,
			provider: providerResult.value,
			tokenBudget: INTAKE_DEFAULT_TOKEN_BUDGET,
			onEvent: (event) => {
				emitCLIActivity(dialogueId, {
					...event,
					role: Role.TECHNICAL_EXPERT,
					phase: 'INTAKE' as Phase,
				});
			},
		});

		emitWorkflowCommand({
			dialogueId,
			commandId: intakeCommandId,
			action: expertResult.success ? 'complete' : 'error',
			commandType: 'cli_invocation',
			label: `Technical Expert — INTAKE Turn ${turnNumber}`,
			summary: expertResult.success
				? 'Turn completed'
				: `Error: ${expertResult.error?.message ?? 'Unknown'}`,
			timestamp: new Date().toISOString(),
		});

		if (!expertResult.success) {
			return expertResult as Result<PhaseExecutionResult>;
		}

		const response = expertResult.value;

		// 4. Store turn and update conversation state
		const turnWriteResult = writeIntakeTurn({
			dialogueId,
			turnNumber,
			humanMessage,
			expertResponse: response,
			planSnapshot: response.updatedPlan,
			tokenCount: estimateTokenCount(humanMessage, response.conversationalResponse),
		});

		if (!turnWriteResult.success) {
			return turnWriteResult as unknown as Result<PhaseExecutionResult>;
		}

		const updateResult = updateIntakeConversation(dialogueId, {
			turnCount: turnNumber,
			draftPlan: response.updatedPlan,
		});

		if (!updateResult.success) {
			return updateResult as unknown as Result<PhaseExecutionResult>;
		}

		// 5. Record audit trail in dialogue_turns
		writeDialogueTurn({
			dialogue_id: dialogueId,
			role: Role.TECHNICAL_EXPERT,
			phase: 'INTAKE' as Phase,
			speech_act: SpeechAct.EVIDENCE,
			content_ref: `intake_turn:${turnNumber}`,
		});

		// 6. Trigger accumulation if needed
		await maybeAccumulateOlderTurns(dialogueId, turnNumber);

		// 7. Emit events
		emitIntakeTurnCompleted(
			dialogueId,
			turnNumber,
			response.conversationalResponse,
			response.updatedPlan.version
		);
		emitIntakePlanUpdated(dialogueId, response.updatedPlan);

		// 8. Self-loop transition: INTAKE → INTAKE
		transitionWorkflow(
			dialogueId,
			'INTAKE' as Phase,
			TransitionTrigger.INTAKE_TURN_COMPLETE,
			{ turnNumber, planVersion: response.updatedPlan.version }
		);

		// Return awaiting input — stay in INTAKE, wait for next human message
		return {
			success: true,
			value: {
				phase: 'INTAKE' as Phase,
				success: true,
				awaitingInput: true,
				metadata: {
					turnNumber,
					planVersion: response.updatedPlan.version,
					conversationalResponse: response.conversationalResponse,
					suggestedQuestions: response.suggestedQuestions,
					codebaseFindings: response.codebaseFindings,
				},
				timestamp: new Date().toISOString(),
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to execute INTAKE conversation turn'),
		};
	}
}

// ==================== PLAN FINALIZATION ====================

/**
 * Execute INTAKE plan finalization (synthesis).
 *
 * 1. Get full conversation state + all turns
 * 2. Invoke Technical Expert with synthesis prompt
 * 3. Store finalized plan
 * 4. Update sub-state to AWAITING_APPROVAL
 * 5. Emit events
 * 6. Return { gateTriggered: true } to show approve/revise UI
 *
 * @param dialogueId Dialogue ID
 * @returns Result containing PhaseExecutionResult with gateTriggered: true
 */
export async function executeIntakePlanFinalization(
	dialogueId: string
): Promise<Result<PhaseExecutionResult>> {
	try {
		// 1. Get conversation state
		const convResult = getOrCreateIntakeConversation(dialogueId);
		if (!convResult.success) {
			return convResult as unknown as Result<PhaseExecutionResult>;
		}
		const conv = convResult.value;

		// 2. Resolve provider and invoke synthesis
		const providerResult = await resolveProviderForRole(Role.TECHNICAL_EXPERT);
		if (!providerResult.success) {
			return providerResult as Result<PhaseExecutionResult>;
		}

		const synthesisCommandId = randomUUID();
		emitWorkflowCommand({
			dialogueId,
			commandId: synthesisCommandId,
			action: 'start',
			commandType: 'cli_invocation',
			label: 'Technical Expert — Plan Synthesis',
			summary: 'Synthesizing conversation into final plan',
			status: 'running',
			timestamp: new Date().toISOString(),
		});

		const synthesisResult = await invokeIntakePlanSynthesis({
			dialogueId,
			currentPlan: conv.draftPlan,
			provider: providerResult.value,
			tokenBudget: INTAKE_DEFAULT_TOKEN_BUDGET,
			onEvent: (event) => {
				emitCLIActivity(dialogueId, {
					...event,
					role: Role.TECHNICAL_EXPERT,
					phase: 'INTAKE' as Phase,
				});
			},
		});

		emitWorkflowCommand({
			dialogueId,
			commandId: synthesisCommandId,
			action: synthesisResult.success ? 'complete' : 'error',
			commandType: 'cli_invocation',
			label: 'Technical Expert — Plan Synthesis',
			summary: synthesisResult.success
				? 'Synthesis completed'
				: `Error: ${synthesisResult.error?.message ?? 'Unknown'}`,
			timestamp: new Date().toISOString(),
		});

		if (!synthesisResult.success) {
			return synthesisResult as Result<PhaseExecutionResult>;
		}

		const finalizedPlan = synthesisResult.value.updatedPlan;

		// 3. Store finalized plan
		const updateResult = updateIntakeConversation(dialogueId, {
			subState: IntakeSubState.AWAITING_APPROVAL,
			finalizedPlan,
		});

		if (!updateResult.success) {
			return updateResult as unknown as Result<PhaseExecutionResult>;
		}

		// 4. Record audit trail
		writeDialogueTurn({
			dialogue_id: dialogueId,
			role: Role.TECHNICAL_EXPERT,
			phase: 'INTAKE' as Phase,
			speech_act: SpeechAct.EVIDENCE,
			content_ref: `intake_finalized_plan:v${finalizedPlan.version}`,
		});

		// 5. Transition: INTAKE → INTAKE (with PLAN_FINALIZED trigger)
		transitionWorkflow(
			dialogueId,
			'INTAKE' as Phase,
			TransitionTrigger.INTAKE_PLAN_FINALIZED,
			{ planVersion: finalizedPlan.version }
		);

		// 6. Emit events
		emitIntakePlanFinalized(dialogueId, finalizedPlan);

		// Return gateTriggered to show approve/revise UI
		return {
			success: true,
			value: {
				phase: 'INTAKE' as Phase,
				success: true,
				gateTriggered: true,
				metadata: {
					finalizedPlan,
					synthesisResponse: synthesisResult.value.conversationalResponse,
				},
				timestamp: new Date().toISOString(),
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to finalize INTAKE plan'),
		};
	}
}

// ==================== PLAN APPROVAL ====================

/**
 * Execute INTAKE plan approval.
 *
 * 1. Get finalized plan from intake_conversations
 * 2. Store in workflow metadata as approvedIntakePlan
 * 3. Return { nextPhase: PROPOSE } to advance workflow
 *
 * @param dialogueId Dialogue ID
 * @returns PhaseExecutionResult with nextPhase: PROPOSE
 */
export function executeIntakePlanApproval(
	dialogueId: string
): Result<PhaseExecutionResult> {
	try {
		// 1. Get finalized plan
		const convResult = getOrCreateIntakeConversation(dialogueId);
		if (!convResult.success) {
			return convResult as unknown as Result<PhaseExecutionResult>;
		}
		const conv = convResult.value;

		if (!conv.finalizedPlan) {
			return {
				success: false,
				error: new Error(
					'Cannot approve: no finalized plan exists. Run finalization first.'
				),
			};
		}

		// 2. Store approved plan in workflow metadata
		updateWorkflowMetadata(dialogueId, {
			approvedIntakePlan: conv.finalizedPlan,
		});

		// 3. Record audit trail
		writeDialogueTurn({
			dialogue_id: dialogueId,
			role: Role.HUMAN,
			phase: 'INTAKE' as Phase,
			speech_act: SpeechAct.DECISION,
			content_ref: `intake_plan_approved:v${conv.finalizedPlan.version}`,
		});

		// 4. Emit event
		emitIntakePlanApproved(dialogueId);

		// Return nextPhase: PROPOSE to advance workflow
		return {
			success: true,
			value: {
				phase: 'INTAKE' as Phase,
				success: true,
				nextPhase: 'PROPOSE' as Phase,
				metadata: {
					approvedPlanVersion: conv.finalizedPlan.version,
					approvedPlanTitle: conv.finalizedPlan.title,
				},
				timestamp: new Date().toISOString(),
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to approve INTAKE plan'),
		};
	}
}

// ==================== CONTEXT MANAGEMENT ====================

/**
 * Check if older turns need to be accumulated (summarized) and do so if needed.
 *
 * Strategy:
 * - Keep last INTAKE_CONTEXT_WINDOW_SIZE turns in raw form
 * - When turns outside the window exceed INTAKE_ACCUMULATION_THRESHOLD,
 *   summarize them into an IntakeAccumulation record
 *
 * @param dialogueId Dialogue ID
 * @param currentTurnNumber The turn number just completed
 */
async function maybeAccumulateOlderTurns(
	dialogueId: string,
	currentTurnNumber: number
): Promise<void> {
	try {
		// Calculate how many turns are outside the sliding window
		const outsideWindowCount = currentTurnNumber - INTAKE_CONTEXT_WINDOW_SIZE;

		if (outsideWindowCount < INTAKE_ACCUMULATION_THRESHOLD) {
			return; // Not enough turns outside the window to warrant accumulation
		}

		// Get conversation state
		const convResult = getOrCreateIntakeConversation(dialogueId);
		if (!convResult.success) {
			return;
		}
		const conv = convResult.value;

		// Determine what turn range needs accumulation
		// Find the highest turn already accumulated
		const highestAccumulated = conv.accumulations.length > 0
			? Math.max(
					...conv.accumulations.map((a) => a.summarizedTurnRange[1])
				)
			: 0;

		// Turns to accumulate: from (highestAccumulated + 1) to (currentTurnNumber - INTAKE_CONTEXT_WINDOW_SIZE)
		const fromTurn = highestAccumulated + 1;
		const toTurn = currentTurnNumber - INTAKE_CONTEXT_WINDOW_SIZE;

		if (fromTurn > toTurn) {
			return; // Nothing new to accumulate
		}

		// Get the turns to accumulate
		const turnsResult = getIntakeTurnsInRange(dialogueId, fromTurn - 1, toTurn);
		if (!turnsResult.success || turnsResult.value.length === 0) {
			return;
		}

		const turnsToAccumulate = turnsResult.value;

		// Create accumulation via lightweight summarization
		// For now, do a simple extraction-based accumulation (no LLM call)
		// In future, this could use a lightweight CLI invocation for better summaries
		const accumulation = createLocalAccumulation(
			turnsToAccumulate,
			fromTurn,
			toTurn
		);

		// Append to existing accumulations
		const updatedAccumulations = [...conv.accumulations, accumulation];

		updateIntakeConversation(dialogueId, {
			accumulations: updatedAccumulations,
		});

		if (isLoggerInitialized()) {
			getLogger()
				.child({ component: 'intakePhase' })
				.info(`Accumulated turns ${fromTurn}-${toTurn} for dialogue ${dialogueId}`);
		}
	} catch (error) {
		// Accumulation failure is non-fatal — log and continue
		if (isLoggerInitialized()) {
			getLogger()
				.child({ component: 'intakePhase' })
				.warn('Failed to accumulate older turns', {
					dialogueId,
					error: error instanceof Error ? error.message : String(error),
				});
		}
	}
}

/**
 * Create a local (non-LLM) accumulation from turns.
 * Produces a summary by extracting key phrases from human messages
 * and expert response highlights.
 */
function createLocalAccumulation(
	turns: IntakeConversationTurn[],
	fromTurn: number,
	toTurn: number
): IntakeAccumulation {
	// Build summary from turn content
	const summaryParts: string[] = [];
	const extractedItems: IntakeAccumulation['extractedItems'] = [];

	for (const turn of turns) {
		// Summarize the human's message (first 200 chars)
		const humanSummary =
			turn.humanMessage.length > 200
				? turn.humanMessage.substring(0, 200) + '...'
				: turn.humanMessage;
		summaryParts.push(`Turn ${turn.turnNumber}: Human asked: "${humanSummary}"`);

		// Extract key response points (first 200 chars of expert response)
		const expertSummary =
			turn.expertResponse.conversationalResponse.length > 200
				? turn.expertResponse.conversationalResponse.substring(0, 200) + '...'
				: turn.expertResponse.conversationalResponse;
		summaryParts.push(`  Expert: ${expertSummary}`);

		// Carry forward any extracted items from the plan snapshot
		for (const item of turn.planSnapshot.requirements) {
			if (item.extractedFromTurnId === turn.turnNumber) {
				extractedItems.push(item);
			}
		}
		for (const item of turn.planSnapshot.decisions) {
			if (item.extractedFromTurnId === turn.turnNumber) {
				extractedItems.push(item);
			}
		}
		for (const item of turn.planSnapshot.constraints) {
			if (item.extractedFromTurnId === turn.turnNumber) {
				extractedItems.push(item);
			}
		}
	}

	const summary = summaryParts.join('\n');

	// Estimate token count
	const tokenCount = Math.ceil(summary.length / 4);

	return {
		summarizedTurnRange: [fromTurn, toTurn],
		summary,
		extractedItems,
		tokenCount,
		timestamp: new Date().toISOString(),
	};
}

// ==================== HELPERS ====================

/**
 * Rough token count estimate for a conversation turn
 */
function estimateTokenCount(humanMessage: string, expertResponse: string): number {
	return Math.ceil((humanMessage.length + expertResponse.length) / 4);
}
