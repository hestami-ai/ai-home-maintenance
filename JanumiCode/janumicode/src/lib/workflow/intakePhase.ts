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
	IntakeConversationState,
	DomainCoverageMap,
	IntakeGatheringTurnResponse,
} from '../types/intake';
import { IntakeSubState, IntakeMode, EngineeringDomain, isGatheringResponse } from '../types/intake';
import {
	getOrCreateIntakeConversation,
	getRecentIntakeTurns,
	getIntakeTurnsInRange,
	getGatheringTurns,
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
	invokeGatheringTechnicalExpert,
	invokeAnalyzingTechnicalExpert,
	CLARIFICATION_COMPLETE_TAG,
	MAX_CLARIFICATION_ROUNDS,
} from '../roles/technicalExpertIntake';
import {
	getWorkflowState,
	updateWorkflowMetadata,
	transitionWorkflow,
	TransitionTrigger,
} from './stateMachine';
import {
	getEventBus,
	emitIntakeTurnCompleted,
	emitIntakePlanUpdated,
	emitIntakePlanFinalized,
	emitIntakePlanApproved,
	emitWorkflowCommand,
	emitCLIActivity,
} from '../integration/eventBus';
import { getLogger, isLoggerInitialized } from '../logging';
import { randomUUID } from 'node:crypto';
import {
	initializeCoverageMap,
	updateCoverageFromExpert,
	updateCoverageFromLLM,
	shouldTriggerCheckpoint,
	buildCheckpoint,
	getNextDomain,
	isDomainAdequatelyCovered,
	getCoverageGaps,
	getPartialDomains,
	formatCoverageSummaryForPrompt,
	formatUncoveredDomainsForPrompt,
	seedCoverageFromAnalysis,
	DOMAIN_INFO,
	DOMAIN_SEQUENCE,
} from './domainCoverageTracker';

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
			domainCoverageContext: buildDomainCoverageContextForExpert(conv),
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

		// 4b. Update domain coverage if mode is set
		const coverageUpdates = await updateDomainCoverageAfterTurn(
			conv, humanMessage, response.conversationalResponse, turnNumber,
		);

		const updateResult = updateIntakeConversation(dialogueId, {
			turnCount: turnNumber,
			draftPlan: response.updatedPlan,
			...coverageUpdates,
		});

		if (!updateResult.success) {
			return updateResult as unknown as Result<PhaseExecutionResult>;
		}

		// 4c. Emit domain coverage event if tracking is active
		if (coverageUpdates.domainCoverage) {
			getEventBus().emit('intake:domain_coverage_updated', {
				dialogueId,
				coverage: coverageUpdates.domainCoverage,
			});
		}

		// 4d. Handle mode-specific post-turn logic
		const modeMetadata = handleModeSpecificPostTurn(
			dialogueId, conv, coverageUpdates, turnNumber,
		);

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
					...modeMetadata,
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
			domainCoverageContext: buildDomainCoverageContextForExpert(conv),
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

		// 2b. Enrich finalized plan with domain coverage gaps as open questions
		if (conv.domainCoverage) {
			const gaps = getCoverageGaps(conv.domainCoverage);
			for (const domain of gaps) {
				const info = DOMAIN_INFO[domain];
				const gapQuestion = {
					id: `Q-DOMAIN-${domain}`,
					type: 'OPEN_QUESTION' as const,
					text: `[Domain Gap: ${info.label}] ${info.description} — this domain was not discussed during INTAKE.`,
					extractedFromTurnId: conv.turnCount,
					timestamp: new Date().toISOString(),
				};
				// Avoid duplicates
				if (!finalizedPlan.openQuestions.some(q => q.id === gapQuestion.id)) {
					finalizedPlan.openQuestions.push(gapQuestion);
				}
			}
		}

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

		// 2. Store approved plan in workflow metadata (include domain coverage for downstream enrichment)
		const planForMetadata: Record<string, unknown> = { ...conv.finalizedPlan };
		if (conv.domainCoverage) {
			planForMetadata.domainCoverage = conv.domainCoverage;
		}
		updateWorkflowMetadata(dialogueId, {
			approvedIntakePlan: planForMetadata,
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

// ==================== DOMAIN COVERAGE HELPERS ====================

/**
 * Build domain coverage context string for injection into the Expert's system prompt.
 * Returns undefined if no mode is set (legacy behavior / no injection needed).
 */
function buildDomainCoverageContextForExpert(
	conv: IntakeConversationState,
): string | undefined {
	if (!conv.intakeMode || !conv.domainCoverage) {
		return undefined;
	}

	// Prepend gathered domain notes if any gathering turns exist
	// (happens when transitioning from GATHERING to DISCUSSING)
	const gatheringSummary = buildGatheringContextSummary(conv.dialogueId);
	const gatheringPrefix = gatheringSummary
		? gatheringSummary + '\n\n---\n\n'
		: '';

	switch (conv.intakeMode) {
		case IntakeMode.STATE_DRIVEN: {
			if (!conv.currentDomain) {
				// All domains visited — in DISCUSSING mode after gathering
				return gatheringPrefix + [
					'INTAKE MODE: State-Driven (All Domains Gathered)',
					'All 12 engineering domains have been explored during the gathering phase.',
					'Use the gathered domain notes above to produce a comprehensive plan.',
					'Do NOT re-ask questions that were already answered during gathering.',
					'',
					formatCoverageSummaryForPrompt(conv.domainCoverage),
				].join('\n');
			}
			const info = DOMAIN_INFO[conv.currentDomain];
			const domainIndex = DOMAIN_SEQUENCE.indexOf(conv.currentDomain);
			const topicAreas = info.keywords.join(', ');
			return gatheringPrefix + [
				'INTAKE MODE: State-Driven Domain Walkthrough',
				'',
				'CURRENT DOMAIN (' + (domainIndex + 1) + ' of ' + DOMAIN_SEQUENCE.length + '): ' + info.label,
				'Description: ' + info.description,
				'Topic areas: ' + topicAreas,
				'',
				'Your ENTIRE conversational response must be scoped to this domain.',
				'Ask 2-4 specific questions about the topics listed above.',
				'If you can find codebase evidence relevant to this domain, include it.',
				'When this domain is sufficiently explored, say so explicitly.',
				'',
				formatCoverageSummaryForPrompt(conv.domainCoverage),
			].join('\n');
		}
		case IntakeMode.DOMAIN_GUIDED: {
			return gatheringPrefix + [
				'INTAKE MODE: Domain-Guided Conversation',
				'The user provided substantial input. Naturally steer the conversation toward uncovered domains.',
				gatheringSummary ? 'Use the gathered domain notes above as the foundation for your plan.' : '',
				'',
				formatUncoveredDomainsForPrompt(conv.domainCoverage),
				'',
				formatCoverageSummaryForPrompt(conv.domainCoverage),
			].filter(Boolean).join('\n');
		}
		case IntakeMode.HYBRID_CHECKPOINTS: {
			return [
				'INTAKE MODE: Conversational with Periodic Checkpoints',
				'Continue the natural conversation but be aware of uncovered engineering domains.',
				'',
				formatCoverageSummaryForPrompt(conv.domainCoverage),
			].join('\n');
		}
	}
}

/**
 * Update domain coverage after a conversation turn.
 * Returns partial update fields for updateIntakeConversation().
 * Returns empty object if no mode is set (legacy behavior).
 */
async function updateDomainCoverageAfterTurn(
	conv: IntakeConversationState,
	humanMessage: string,
	expertResponse: string,
	turnNumber: number,
): Promise<{
	domainCoverage?: DomainCoverageMap;
	currentDomain?: EngineeringDomain | null;
}> {
	if (!conv.intakeMode || !conv.domainCoverage) {
		return {};
	}

	// LLM-based extraction (falls back to keyword matching if unavailable)
	let coverage = await updateCoverageFromLLM(conv.domainCoverage, humanMessage, expertResponse, turnNumber);

	// Also apply expert-reported structured coverage tags (these are authoritative)
	coverage = updateCoverageFromExpert(coverage, expertResponse, turnNumber);

	const result: {
		domainCoverage: DomainCoverageMap;
		currentDomain?: EngineeringDomain | null;
	} = { domainCoverage: coverage };

	// STATE_DRIVEN: advance current domain if adequately covered
	if (conv.intakeMode === IntakeMode.STATE_DRIVEN && conv.currentDomain) {
		if (isDomainAdequatelyCovered(coverage, conv.currentDomain)) {
			const nextDomain = getNextDomain(conv.currentDomain);
			result.currentDomain = nextDomain;
		}
	}

	return result;
}

/**
 * Handle mode-specific post-turn logic (checkpoints, domain transitions).
 * Returns additional metadata to include in the phase result.
 */
function handleModeSpecificPostTurn(
	dialogueId: string,
	conv: IntakeConversationState,
	coverageUpdates: { domainCoverage?: DomainCoverageMap; currentDomain?: EngineeringDomain | null },
	turnNumber: number,
): Record<string, unknown> {
	if (!conv.intakeMode) { return {}; }

	const metadata: Record<string, unknown> = {
		intakeMode: conv.intakeMode,
	};

	// STATE_DRIVEN: emit domain transition if domain changed
	if (conv.intakeMode === IntakeMode.STATE_DRIVEN && coverageUpdates.currentDomain !== undefined) {
		if (coverageUpdates.currentDomain !== conv.currentDomain) {
			getEventBus().emit('intake:domain_transition', {
				dialogueId,
				fromDomain: conv.currentDomain,
				toDomain: coverageUpdates.currentDomain,
			});
			metadata.domainTransition = {
				from: conv.currentDomain,
				to: coverageUpdates.currentDomain,
			};

			// Persist domain transition
			updateIntakeConversation(dialogueId, {
				currentDomain: coverageUpdates.currentDomain,
			});
		}
	}

	// DOMAIN_GUIDED: after the first analysis turn, offer mode-switch to fill gaps
	if (conv.intakeMode === IntakeMode.DOMAIN_GUIDED && coverageUpdates.domainCoverage && conv.checkpoints.length === 0) {
		const gaps = getCoverageGaps(coverageUpdates.domainCoverage);
		const partials = getPartialDomains(coverageUpdates.domainCoverage);
		if (gaps.length > 0 || partials.length > 0) {
			const checkpoint = buildCheckpoint(coverageUpdates.domainCoverage, turnNumber);
			checkpoint.offerModeSwitch = true;
			const updatedCheckpoints = [checkpoint];

			updateIntakeConversation(dialogueId, {
				checkpoints: updatedCheckpoints,
			});

			getEventBus().emit('intake:checkpoint_triggered', {
				dialogueId,
				checkpoint,
			});

			metadata.checkpoint = checkpoint;
		}
	}

	// HYBRID_CHECKPOINTS: check if a checkpoint should be triggered
	if (conv.intakeMode === IntakeMode.HYBRID_CHECKPOINTS && coverageUpdates.domainCoverage) {
		const lastCheckpointTurn = conv.checkpoints.length > 0
			? conv.checkpoints[conv.checkpoints.length - 1].turnNumber
			: 0;

		if (shouldTriggerCheckpoint(coverageUpdates.domainCoverage, turnNumber, lastCheckpointTurn)) {
			const checkpoint = buildCheckpoint(coverageUpdates.domainCoverage, turnNumber);
			const updatedCheckpoints = [...conv.checkpoints, checkpoint];

			updateIntakeConversation(dialogueId, {
				checkpoints: updatedCheckpoints,
			});

			getEventBus().emit('intake:checkpoint_triggered', {
				dialogueId,
				checkpoint,
			});

			metadata.checkpoint = checkpoint;
		}
	}

	return metadata;
}

// ==================== GATHERING PHASE ====================

/**
 * Execute a single INTAKE gathering turn.
 * Expert acts as interviewer: investigates one domain, asks questions, takes notes.
 * Does NOT produce a plan — returns IntakeGatheringTurnResponse metadata.
 */
export async function executeIntakeGatheringTurn(
	dialogueId: string,
	humanMessage: string,
): Promise<Result<PhaseExecutionResult>> {
	try {
		// 1. Get conversation state (mode + currentDomain already set)
		const convResult = getOrCreateIntakeConversation(dialogueId);
		if (!convResult.success) {
			return convResult as unknown as Result<PhaseExecutionResult>;
		}
		const conv = convResult.value;
		const turnNumber = conv.turnCount + 1;

		if (!conv.currentDomain) {
			return {
				success: false,
				error: new Error('GATHERING requires currentDomain to be set'),
			};
		}

		// 2. Resolve Technical Expert CLI provider
		const providerResult = await resolveProviderForRole(Role.TECHNICAL_EXPERT);
		if (!providerResult.success) {
			return providerResult as Result<PhaseExecutionResult>;
		}

		// 3. Build prior gathering context from earlier gathering turns
		const priorContext = buildGatheringContextSummary(dialogueId);

		// 4. Build domain-specific context for the interviewer
		const domainContext = buildGatheringDomainContext(conv);

		// 5. Invoke Expert in GATHERING mode
		const gatheringCommandId = randomUUID();
		emitWorkflowCommand({
			dialogueId,
			commandId: gatheringCommandId,
			action: 'start',
			commandType: 'cli_invocation',
			label: 'Interviewer — ' + DOMAIN_INFO[conv.currentDomain].label + ' (Turn ' + turnNumber + ')',
			summary: 'Gathering: ' + humanMessage.substring(0, 120),
			status: 'running',
			timestamp: new Date().toISOString(),
		});

		const expertResult = await invokeGatheringTechnicalExpert({
			dialogueId,
			humanMessage,
			currentDomain: conv.currentDomain,
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
			priorGatheringContext: priorContext || undefined,
			domainContext,
		});

		emitWorkflowCommand({
			dialogueId,
			commandId: gatheringCommandId,
			action: expertResult.success ? 'complete' : 'error',
			commandType: 'cli_invocation',
			label: 'Interviewer — ' + DOMAIN_INFO[conv.currentDomain].label + ' (Turn ' + turnNumber + ')',
			summary: expertResult.success
				? 'Gathering turn completed'
				: 'Error: ' + (expertResult.error?.message ?? 'Unknown'),
			timestamp: new Date().toISOString(),
		});

		if (!expertResult.success) {
			return expertResult as Result<PhaseExecutionResult>;
		}

		const response = expertResult.value;

		// 6. Store gathering turn (planSnapshot = null, isGathering = true)
		const turnWriteResult = writeIntakeTurn({
			dialogueId,
			turnNumber,
			humanMessage,
			expertResponse: response,
			planSnapshot: null,
			tokenCount: estimateTokenCount(humanMessage, response.conversationalResponse),
			isGathering: true,
		});

		if (!turnWriteResult.success) {
			return turnWriteResult as unknown as Result<PhaseExecutionResult>;
		}

		// 7. Update domain coverage from human text + expert response + expert tags
		const coverageUpdates = await updateDomainCoverageAfterTurn(
			conv, humanMessage, response.conversationalResponse, turnNumber,
		);

		// 8. Update conversation state (no draftPlan update during gathering)
		const updateResult = updateIntakeConversation(dialogueId, {
			turnCount: turnNumber,
			...coverageUpdates,
		});

		if (!updateResult.success) {
			return updateResult as unknown as Result<PhaseExecutionResult>;
		}

		// 9. Emit domain coverage event
		if (coverageUpdates.domainCoverage) {
			getEventBus().emit('intake:domain_coverage_updated', {
				dialogueId,
				coverage: coverageUpdates.domainCoverage,
			});
		}

		// 10. Check domain advancement (STATE_DRIVEN: move to next domain if covered)
		if (conv.intakeMode === IntakeMode.STATE_DRIVEN && coverageUpdates.currentDomain !== undefined) {
			if (coverageUpdates.currentDomain !== conv.currentDomain) {
				getEventBus().emit('intake:domain_transition', {
					dialogueId,
					fromDomain: conv.currentDomain,
					toDomain: coverageUpdates.currentDomain,
				});
				updateIntakeConversation(dialogueId, {
					currentDomain: coverageUpdates.currentDomain,
				});
			}
		}

		// 11. Check if gathering is complete → transition to DISCUSSING
		const gatheringComplete = checkGatheringComplete(conv, coverageUpdates);
		if (gatheringComplete) {
			updateIntakeConversation(dialogueId, {
				subState: IntakeSubState.DISCUSSING,
			});
			getEventBus().emit('intake:gathering_complete', {
				dialogueId,
			});
		}

		// 12. Record audit trail
		writeDialogueTurn({
			dialogue_id: dialogueId,
			role: Role.TECHNICAL_EXPERT,
			phase: 'INTAKE' as Phase,
			speech_act: SpeechAct.EVIDENCE,
			content_ref: 'gathering_turn:' + turnNumber,
		});

		// 13. Emit turn completed event
		emitIntakeTurnCompleted(
			dialogueId,
			turnNumber,
			response.conversationalResponse,
			0, // No plan version during gathering
		);

		// 14. Self-loop transition
		transitionWorkflow(
			dialogueId,
			'INTAKE' as Phase,
			TransitionTrigger.INTAKE_TURN_COMPLETE,
			{ turnNumber, isGathering: true }
		);

		return {
			success: true,
			value: {
				phase: 'INTAKE' as Phase,
				success: true,
				awaitingInput: true,
				metadata: {
					turnNumber,
					isGathering: true,
					gatheringComplete,
					focusDomain: conv.currentDomain,
					conversationalResponse: response.conversationalResponse,
					followUpQuestions: response.followUpQuestions,
					codebaseFindings: response.codebaseFindings,
					domainNotes: response.domainNotes,
					intakeMode: conv.intakeMode,
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
					: new Error('Failed to execute INTAKE gathering turn'),
		};
	}
}

/**
 * Build a formatted context summary from all prior gathering turns.
 * Groups notes by domain for injection into the Expert's context.
 * Returns empty string if no gathering turns exist.
 */
function buildGatheringContextSummary(dialogueId: string): string {
	const turnsResult = getGatheringTurns(dialogueId);
	if (!turnsResult.success || turnsResult.value.length === 0) {
		return '';
	}

	const sections: string[] = ['# Domain Gathering Notes (from Interviewer Phase)'];

	// Group by focusDomain
	const byDomain = new Map<string, Array<{
		notes: string[];
		findings: string[];
		humanResponse: string;
		turnNumber: number;
	}>>();

	for (const turn of turnsResult.value) {
		if (!isGatheringResponse(turn.expertResponse)) { continue; }
		const resp = turn.expertResponse as IntakeGatheringTurnResponse;
		const domain = resp.focusDomain;
		if (!byDomain.has(domain)) { byDomain.set(domain, []); }
		byDomain.get(domain)!.push({
			notes: resp.domainNotes,
			findings: resp.codebaseFindings ?? [],
			humanResponse: turn.humanMessage,
			turnNumber: turn.turnNumber,
		});
	}

	for (const [domain, entries] of byDomain) {
		const info = DOMAIN_INFO[domain as EngineeringDomain];
		if (!info) { continue; }
		sections.push('\n## ' + info.label);
		for (const entry of entries) {
			if (entry.notes.length > 0) {
				sections.push('Notes:\n' + entry.notes.map(n => '- ' + n).join('\n'));
			}
			if (entry.findings.length > 0) {
				sections.push('Codebase:\n' + entry.findings.map(f => '- ' + f).join('\n'));
			}
			sections.push('User input (turn ' + entry.turnNumber + '): ' + entry.humanResponse.substring(0, 300));
		}
	}

	return sections.join('\n');
}

/**
 * Build domain context string for gathering mode interviewer prompt.
 */
function buildGatheringDomainContext(conv: IntakeConversationState): string {
	if (!conv.currentDomain || !conv.domainCoverage) {
		return '';
	}

	const info = DOMAIN_INFO[conv.currentDomain];
	const domainIndex = DOMAIN_SEQUENCE.indexOf(conv.currentDomain);
	const topicAreas = info.keywords.join(', ');

	return [
		'CURRENT DOMAIN (' + (domainIndex + 1) + ' of ' + DOMAIN_SEQUENCE.length + '): ' + info.label,
		'Description: ' + info.description,
		'Topic areas: ' + topicAreas,
		'',
		'Your ENTIRE response must be scoped to this domain.',
		'Ask 2-4 specific questions about the topics listed above.',
		'Report codebase findings relevant to this domain.',
		'',
		formatCoverageSummaryForPrompt(conv.domainCoverage),
	].join('\n');
}

/**
 * Check if gathering is complete and should transition to DISCUSSING.
 */
function checkGatheringComplete(
	conv: IntakeConversationState,
	coverageUpdates: { domainCoverage?: DomainCoverageMap; currentDomain?: EngineeringDomain | null },
): boolean {
	if (conv.intakeMode === IntakeMode.STATE_DRIVEN) {
		// Complete when current domain advances to null (all domains visited)
		return coverageUpdates.currentDomain === null;
	}
	if (conv.intakeMode === IntakeMode.DOMAIN_GUIDED) {
		// Complete after gathering turns when no NONE-coverage domains remain,
		// or after 2 gathering turns
		if (!coverageUpdates.domainCoverage) { return false; }
		const gaps = getCoverageGaps(coverageUpdates.domainCoverage);
		return gaps.length === 0 || conv.turnCount >= 2;
	}
	return false; // HYBRID_CHECKPOINTS never enters GATHERING
}

// ==================== ANALYZING PHASE (INVERTED FLOW) ====================

/** Higher token budget for comprehensive analysis */
const INTAKE_ANALYSIS_TOKEN_BUDGET = 20000;

/**
 * Execute the silent ANALYSIS phase for STATE_DRIVEN and DOMAIN_GUIDED modes.
 * Expert reads all docs/codebase, produces comprehensive analysis.
 * No user interaction during this phase — one CLI call, then transition to PROPOSING.
 */
export async function executeIntakeAnalysis(
	dialogueId: string,
	humanMessage: string,
): Promise<Result<PhaseExecutionResult>> {
	try {
		// 1. Get conversation state
		const convResult = getOrCreateIntakeConversation(dialogueId);
		if (!convResult.success) {
			return convResult as unknown as Result<PhaseExecutionResult>;
		}
		const conv = convResult.value;

		// 2. Resolve Technical Expert CLI provider
		const providerResult = await resolveProviderForRole(Role.TECHNICAL_EXPERT);
		if (!providerResult.success) {
			return providerResult as Result<PhaseExecutionResult>;
		}

		// 3. Invoke Expert in ANALYZING mode
		const analysisCommandId = randomUUID();
		emitWorkflowCommand({
			dialogueId,
			commandId: analysisCommandId,
			action: 'start',
			commandType: 'cli_invocation',
			label: 'Technical Expert — INTAKE Analysis',
			summary: 'Analyzing: ' + humanMessage.substring(0, 120),
			status: 'running',
			timestamp: new Date().toISOString(),
		});

		const expertResult = await invokeAnalyzingTechnicalExpert({
			dialogueId,
			humanMessage,
			provider: providerResult.value,
			tokenBudget: INTAKE_ANALYSIS_TOKEN_BUDGET,
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
			commandId: analysisCommandId,
			action: expertResult.success ? 'complete' : 'error',
			commandType: 'cli_invocation',
			label: 'Technical Expert — INTAKE Analysis',
			summary: expertResult.success
				? 'Analysis completed'
				: 'Error: ' + (expertResult.error?.message ?? 'Unknown'),
			timestamp: new Date().toISOString(),
		});

		if (!expertResult.success) {
			return expertResult as Result<PhaseExecutionResult>;
		}

		const analysis = expertResult.value;

		// 4. Seed domain coverage from analysis domainAssessment
		const coverageMap = conv.domainCoverage ?? initializeCoverageMap();
		const seededCoverage = seedCoverageFromAnalysis(coverageMap, analysis.domainAssessment);

		// 5. Store as turn 0 (analysis turn)
		const turnWriteResult = writeIntakeTurn({
			dialogueId,
			turnNumber: 0,
			humanMessage,
			expertResponse: analysis,
			planSnapshot: analysis.initialPlan,
			tokenCount: estimateTokenCount(humanMessage, analysis.analysisSummary),
			isGathering: false,
		});

		if (!turnWriteResult.success) {
			return turnWriteResult as unknown as Result<PhaseExecutionResult>;
		}

		// 6. Update conversation: seed plan, coverage, transition to PROPOSING
		const updateResult = updateIntakeConversation(dialogueId, {
			subState: IntakeSubState.PROPOSING,
			turnCount: 1,
			draftPlan: analysis.initialPlan,
			domainCoverage: seededCoverage,
			currentDomain: null,
		});

		if (!updateResult.success) {
			return updateResult as unknown as Result<PhaseExecutionResult>;
		}

		// 7. Emit events
		getEventBus().emit('intake:domain_coverage_updated', {
			dialogueId,
			coverage: seededCoverage,
		});
		getEventBus().emit('intake:analysis_complete', {
			dialogueId,
			domainAssessment: analysis.domainAssessment,
		});
		emitIntakeTurnCompleted(
			dialogueId,
			0,
			analysis.analysisSummary,
			analysis.initialPlan.version,
		);
		emitIntakePlanUpdated(dialogueId, analysis.initialPlan);

		// 8. Record audit trail
		writeDialogueTurn({
			dialogue_id: dialogueId,
			role: Role.TECHNICAL_EXPERT,
			phase: 'INTAKE' as Phase,
			speech_act: SpeechAct.EVIDENCE,
			content_ref: 'intake_analysis:0',
		});

		// 9. Self-loop transition
		transitionWorkflow(
			dialogueId,
			'INTAKE' as Phase,
			TransitionTrigger.INTAKE_TURN_COMPLETE,
			{ turnNumber: 0, isAnalysis: true },
		);

		return {
			success: true,
			value: {
				phase: 'INTAKE' as Phase,
				success: true,
				awaitingInput: true,
				metadata: {
					turnNumber: 0,
					isAnalysis: true,
					planVersion: analysis.initialPlan.version,
					conversationalResponse: analysis.analysisSummary,
					codebaseFindings: analysis.codebaseFindings,
					domainAssessment: analysis.domainAssessment,
					intakeMode: conv.intakeMode,
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
					: new Error('Failed to execute INTAKE analysis'),
		};
	}
}

// ==================== CLARIFYING PHASE (INVERTED FLOW) ====================

/**
 * Execute a single CLARIFYING turn.
 * Reuses the IntakeTurnResponse format (conversationalResponse + updatedPlan)
 * but with the CLARIFYING system prompt that restricts questions to business
 * gaps and significant tradeoffs.
 *
 * After each turn, checks for convergence:
 * - [CLARIFICATION_COMPLETE] tag in response → transition to SYNTHESIZING
 * - clarificationRound >= MAX_CLARIFICATION_ROUNDS → transition to SYNTHESIZING
 * - Otherwise → stay in CLARIFYING, await next human response
 */
export async function executeIntakeClarificationTurn(
	dialogueId: string,
	humanMessage: string,
): Promise<Result<PhaseExecutionResult>> {
	try {
		// 1. Get conversation state
		const convResult = getOrCreateIntakeConversation(dialogueId);
		if (!convResult.success) {
			return convResult as unknown as Result<PhaseExecutionResult>;
		}
		const conv = convResult.value;
		const turnNumber = conv.turnCount + 1;
		const currentRound = conv.clarificationRound || 1;

		// 2. Resolve provider
		const providerResult = await resolveProviderForRole(Role.TECHNICAL_EXPERT);
		if (!providerResult.success) {
			return providerResult as Result<PhaseExecutionResult>;
		}

		// 3. Invoke Expert with CLARIFYING prompt
		const clarifyCommandId = randomUUID();
		emitWorkflowCommand({
			dialogueId,
			commandId: clarifyCommandId,
			action: 'start',
			commandType: 'cli_invocation',
			label: 'Technical Expert — Clarification Round ' + currentRound,
			summary: 'Clarifying: ' + humanMessage.substring(0, 120),
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
			domainCoverageContext: buildDomainCoverageContextForExpert(conv),
			subState: IntakeSubState.CLARIFYING,
			clarificationRound: currentRound,
		});

		emitWorkflowCommand({
			dialogueId,
			commandId: clarifyCommandId,
			action: expertResult.success ? 'complete' : 'error',
			commandType: 'cli_invocation',
			label: 'Technical Expert — Clarification Round ' + currentRound,
			summary: expertResult.success
				? 'Clarification round completed'
				: 'Error: ' + (expertResult.error?.message ?? 'Unknown'),
			timestamp: new Date().toISOString(),
		});

		if (!expertResult.success) {
			return expertResult as Result<PhaseExecutionResult>;
		}

		const response = expertResult.value;

		// 4. Store turn
		const turnWriteResult = writeIntakeTurn({
			dialogueId,
			turnNumber,
			humanMessage,
			expertResponse: response,
			planSnapshot: response.updatedPlan,
			tokenCount: estimateTokenCount(humanMessage, response.conversationalResponse),
			isGathering: false,
		});

		if (!turnWriteResult.success) {
			return turnWriteResult as unknown as Result<PhaseExecutionResult>;
		}

		// 5. Update domain coverage
		const coverageUpdates = await updateDomainCoverageAfterTurn(
			conv, humanMessage, response.conversationalResponse, turnNumber,
		);

		// 6. Check convergence
		const clarificationComplete =
			response.conversationalResponse.includes(CLARIFICATION_COMPLETE_TAG)
			|| currentRound >= MAX_CLARIFICATION_ROUNDS;

		const nextSubState = clarificationComplete
			? IntakeSubState.SYNTHESIZING
			: IntakeSubState.CLARIFYING;
		const nextRound = clarificationComplete
			? currentRound
			: currentRound + 1;

		// 7. Update conversation state
		const updateResult = updateIntakeConversation(dialogueId, {
			subState: nextSubState,
			turnCount: turnNumber,
			draftPlan: response.updatedPlan,
			clarificationRound: nextRound,
			...coverageUpdates,
		});

		if (!updateResult.success) {
			return updateResult as unknown as Result<PhaseExecutionResult>;
		}

		// 8. Emit events
		if (coverageUpdates.domainCoverage) {
			getEventBus().emit('intake:domain_coverage_updated', {
				dialogueId,
				coverage: coverageUpdates.domainCoverage,
			});
		}
		getEventBus().emit('intake:clarification_round_complete', {
			dialogueId,
			round: currentRound,
			isComplete: clarificationComplete,
		});
		emitIntakeTurnCompleted(
			dialogueId,
			turnNumber,
			response.conversationalResponse,
			response.updatedPlan.version,
		);
		emitIntakePlanUpdated(dialogueId, response.updatedPlan);

		// 9. Record audit trail
		writeDialogueTurn({
			dialogue_id: dialogueId,
			role: Role.TECHNICAL_EXPERT,
			phase: 'INTAKE' as Phase,
			speech_act: SpeechAct.EVIDENCE,
			content_ref: 'intake_clarification:' + turnNumber,
		});

		// 10. Self-loop transition
		transitionWorkflow(
			dialogueId,
			'INTAKE' as Phase,
			TransitionTrigger.INTAKE_TURN_COMPLETE,
			{ turnNumber, isClarification: true, clarificationComplete },
		);

		// 11. If converged, auto-trigger synthesis
		if (clarificationComplete) {
			if (isLoggerInitialized()) {
				getLogger().child({ component: 'intakePhase:clarification' }).info(
					'Clarification complete — transitioning to SYNTHESIZING',
					{ dialogueId, round: currentRound },
				);
			}
		}

		return {
			success: true,
			value: {
				phase: 'INTAKE' as Phase,
				success: true,
				awaitingInput: !clarificationComplete,
				metadata: {
					turnNumber,
					isClarification: true,
					clarificationRound: currentRound,
					clarificationComplete,
					planVersion: response.updatedPlan.version,
					conversationalResponse: response.conversationalResponse,
					suggestedQuestions: response.suggestedQuestions,
					codebaseFindings: response.codebaseFindings,
					intakeMode: conv.intakeMode,
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
					: new Error('Failed to execute INTAKE clarification turn'),
		};
	}
}

// ==================== HELPERS ====================

/**
 * Rough token count estimate for a conversation turn
 */
function estimateTokenCount(humanMessage: string, expertResponse: string): number {
	return Math.ceil((humanMessage.length + expertResponse.length) / 4);
}
