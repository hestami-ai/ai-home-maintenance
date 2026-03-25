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
import type { MMPPayload, MirrorItem, MenuItem, MenuOption } from '../types/mmp';
import type { PhaseExecutionResult } from './orchestrator';
import type {
	IntakePlanDocument,
	IntakeAccumulation,
	IntakeConversationTurn,
	IntakeConversationState,
	DomainCoverageMap,
	IntakeGatheringTurnResponse,
} from '../types/intake';
import {
	IntakeSubState, IntakeMode, EngineeringDomain, isGatheringResponse,
	ProposerPhase,
} from '../types/intake';
import type {
	DomainProposal, EntityProposal, WorkflowProposal, IntegrationProposal,
} from '../types/intake';
import {
	getOrCreateIntakeConversation,
	getIntakeTurnsInRange,
	getGatheringTurns,
} from '../events/reader';
import {
	writeDialogueEvent,
	updateIntakeConversation,
} from '../events/writer';
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
import type { CLIActivityEvent } from '../cli/types';
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

/** Number of recent turns to keep in context for normal (non-synthesis) turns */
const INTAKE_CONTEXT_WINDOW_SIZE = 6;

/** When turns outside the sliding window exceed this count, trigger accumulation (legacy flows) */
const INTAKE_ACCUMULATION_THRESHOLD = 4;

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
		const expertResult = await invokeIntakeTechnicalExpert({
			dialogueId,
			humanMessage,
			currentPlan: conv.draftPlan,
			turnNumber,
			provider: providerResult.value,
			onEvent: (event) => {
				emitCLIActivity(dialogueId, {
					...event,
					role: Role.TECHNICAL_EXPERT,
					phase: 'INTAKE' as Phase,
				});
			},
			domainCoverageContext: buildDomainCoverageContextForExpert(conv),
			commandBlock: {
				dialogueId,
				commandId: intakeCommandId,
				label: `Technical Expert — INTAKE Turn ${turnNumber}`,
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

		// 4. Store unified event (replaces dual writeIntakeTurn + writeDialogueTurn)
		const eventResult = writeDialogueEvent({
			dialogue_id: dialogueId,
			event_type: 'intake_turn',
			role: Role.TECHNICAL_EXPERT,
			phase: 'INTAKE',
			speech_act: SpeechAct.EVIDENCE,
			summary: response.conversationalResponse.substring(0, 120),
			content: response.conversationalResponse,
			detail: {
				humanMessage,
				expertResponse: response,
				planSnapshot: response.updatedPlan,
				turnNumber,
				tokenCount: estimateTokenCount(humanMessage, response.conversationalResponse),
			},
		});

		if (!eventResult.success) {
			return eventResult as unknown as Result<PhaseExecutionResult>;
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
		// Synthesis needs a higher token budget — the plan now contains full proposer artifacts
		// (domains, journeys with steps, entities with attributes, integrations) which can be 15K+ tokens
		const synthesisResult = await invokeIntakePlanSynthesis({
			dialogueId,
			currentPlan: conv.draftPlan,
			provider: providerResult.value,
			onEvent: (event) => {
				emitCLIActivity(dialogueId, {
					...event,
					role: Role.TECHNICAL_EXPERT,
					phase: 'INTAKE' as Phase,
				});
			},
			commandBlock: {
				dialogueId,
				commandId: synthesisCommandId,
				label: 'Technical Expert — Plan Synthesis',
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

		// 2b. Carry forward proposer artifacts that synthesis may not have populated
		const dp = conv.draftPlan;
		if (dp.proposerPhase !== null && dp.proposerPhase !== undefined) {
			// Map quality attributes → uxRequirements if synthesis didn't populate them
			if ((!finalizedPlan.uxRequirements || finalizedPlan.uxRequirements.length === 0) && dp.qualityAttributes && dp.qualityAttributes.length > 0) {
				finalizedPlan.uxRequirements = dp.qualityAttributes;
			}
			// Carry forward proposer-specific fields for downstream phases
			if (!finalizedPlan.domainProposals && dp.domainProposals) { finalizedPlan.domainProposals = dp.domainProposals; }
			if (!finalizedPlan.entityProposals && dp.entityProposals) { finalizedPlan.entityProposals = dp.entityProposals; }
			if (!finalizedPlan.workflowProposals && dp.workflowProposals) { finalizedPlan.workflowProposals = dp.workflowProposals; }
			if (!finalizedPlan.integrationProposals && dp.integrationProposals) { finalizedPlan.integrationProposals = dp.integrationProposals; }
			if (!finalizedPlan.qualityAttributes && dp.qualityAttributes) { finalizedPlan.qualityAttributes = dp.qualityAttributes; }
			// Carry forward product artifacts if synthesis didn't regenerate them
			if (!finalizedPlan.personas && dp.personas) { finalizedPlan.personas = dp.personas; }
			if (!finalizedPlan.userJourneys && dp.userJourneys) { finalizedPlan.userJourneys = dp.userJourneys; }
			if (!finalizedPlan.phasingStrategy && dp.phasingStrategy) { finalizedPlan.phasingStrategy = dp.phasingStrategy; }
			if ((!finalizedPlan.successMetrics || finalizedPlan.successMetrics.length === 0) && dp.successMetrics) { finalizedPlan.successMetrics = dp.successMetrics; }
		}

		// 3. Store finalized plan
		const updateResult = updateIntakeConversation(dialogueId, {
			subState: IntakeSubState.AWAITING_APPROVAL,
			finalizedPlan,
		});

		if (!updateResult.success) {
			return updateResult as unknown as Result<PhaseExecutionResult>;
		}

		// 4. Record synthesis event
		writeDialogueEvent({
			dialogue_id: dialogueId,
			event_type: 'intake_synthesis',
			role: Role.TECHNICAL_EXPERT,
			phase: 'INTAKE',
			speech_act: SpeechAct.EVIDENCE,
			summary: `Plan finalized v${finalizedPlan.version}`,
			content: JSON.stringify(finalizedPlan),
			detail: { finalizedPlan },
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
 * 3. Return { nextPhase: ARCHITECTURE } to advance workflow
 *
 * @param dialogueId Dialogue ID
 * @returns PhaseExecutionResult with nextPhase: ARCHITECTURE
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

		// 3. Record approval event
		writeDialogueEvent({
			dialogue_id: dialogueId,
			event_type: 'intake_approval',
			role: Role.HUMAN,
			phase: 'INTAKE',
			speech_act: SpeechAct.DECISION,
			summary: `Plan v${conv.finalizedPlan.version} approved`,
		});

		// 4. Emit event
		emitIntakePlanApproved(dialogueId);

		// Return nextPhase: ARCHITECTURE to advance workflow
		return {
			success: true,
			value: {
				phase: 'INTAKE' as Phase,
				success: true,
				nextPhase: 'ARCHITECTURE' as Phase,
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
		const resp = turn.expertResponse;
		const respText = 'conversationalResponse' in resp
			? resp.conversationalResponse
			: ('analysisSummary' in resp ? resp.analysisSummary : '');
		const expertSummary =
			respText.length > 200
				? respText.substring(0, 200) + '...'
				: respText;
		summaryParts.push(`  Expert: ${expertSummary}`);

		// Carry forward any extracted items from the plan snapshot
		if (turn.planSnapshot) {
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

		// 6. Store unified gathering event
		const eventResult = writeDialogueEvent({
			dialogue_id: dialogueId,
			event_type: 'intake_gathering',
			role: Role.TECHNICAL_EXPERT,
			phase: 'INTAKE',
			speech_act: SpeechAct.EVIDENCE,
			summary: `Gathering: ${DOMAIN_INFO[conv.currentDomain].label}`,
			content: response.conversationalResponse,
			detail: {
				humanMessage,
				expertResponse: response,
				turnNumber,
				focusDomain: conv.currentDomain,
				domainNotes: response.domainNotes,
				tokenCount: estimateTokenCount(humanMessage, response.conversationalResponse),
			},
		});

		if (!eventResult.success) {
			return eventResult as unknown as Result<PhaseExecutionResult>;
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

// ==================== PRODUCT DISCOVERY MMP ====================

/**
 * Deterministically extract MMP from product artifacts in the initial plan.
 * Creates Mirror items for personas, user journeys, and UX assumptions
 * so the human can accept/reject/edit them — not just view static text.
 *
 * Only generates MMP for product_or_feature requests with actual product artifacts.
 */
export function extractProductDiscoveryMMP(plan: IntakePlanDocument): MMPPayload | undefined {
	if (plan.requestCategory !== 'product_or_feature') {
		console.log('[INTAKE:ExtractMMP] Skipped — requestCategory:', plan.requestCategory);
		return undefined;
	}
	console.log('[INTAKE:ExtractMMP] Extracting for product_or_feature. Plan fields:', {
		personas: plan.personas?.length ?? 0,
		userJourneys: plan.userJourneys?.length ?? 0,
		uxRequirements: plan.uxRequirements?.length ?? 0,
		phasingStrategy: plan.phasingStrategy?.length ?? 0,
		productVision: !!plan.productVision,
	});

	const mirrorItems: MirrorItem[] = [];
	const menuItems: MenuItem[] = [];
	let mirrorIdx = 0;

	// Mirror: persona assumptions
	if (plan.personas && plan.personas.length > 0) {
		for (const p of plan.personas.slice(0, 5)) {
			mirrorIdx++;
			mirrorItems.push({
				id: `PD-MIR-${mirrorIdx}`,
				text: `${p.name}: ${p.description}`,
				category: 'persona',
				rationale: (p.goals ?? []).length > 0
					? `Goals: ${p.goals.join('; ')}. Pain points: ${(p.painPoints ?? []).join('; ')}`
					: 'Identified from the project description',
				status: 'pending',
			});
		}
	}

	// Mirror: user journey assumptions (top 5)
	if (plan.userJourneys && plan.userJourneys.length > 0) {
		for (const j of plan.userJourneys.slice(0, 5)) {
			mirrorIdx++;
			// Build steps preview — guard against LLM returning stub step objects
			const validSteps = (j.steps ?? []).filter(
				s => s.actor || s.action
			);
			const stepsPreview = validSteps.length > 0
				? validSteps.slice(0, 3).map(s => {
					const actor = s.actor || 'User';
					const action = s.action || s.expectedOutcome || '(step)';
					return `${actor}: ${action}`;
				}).join(' → ')
				: j.scenario || j.title;
			mirrorItems.push({
				id: `PD-MIR-${mirrorIdx}`,
				text: `[${j.priority}] ${j.title}: ${stepsPreview}`,
				category: 'journey',
				rationale: (j.acceptanceCriteria && j.acceptanceCriteria.length > 0)
					? `Acceptance: ${j.acceptanceCriteria.slice(0, 2).join('; ')}`
					: j.scenario || j.title,
				status: 'pending',
			});
		}
	}

	// Mirror: UX requirements
	if (plan.uxRequirements && plan.uxRequirements.length > 0) {
		for (const ux of plan.uxRequirements.slice(0, 3)) {
			mirrorIdx++;
			mirrorItems.push({
				id: `PD-MIR-${mirrorIdx}`,
				text: ux,
				category: 'ux',
				rationale: 'Inferred from the project description and codebase analysis',
				status: 'pending',
			});
		}
	}

	// Mirror: product vision
	if (plan.productVision) {
		mirrorIdx++;
		mirrorItems.push({
			id: `PD-MIR-${mirrorIdx}`,
			text: plan.productVision,
			category: 'intent',
			rationale: 'Synthesized from the project description as the core value proposition',
			status: 'pending',
		});
	}

	// Menu: phasing decisions (if journeys exist but phasing is ambiguous)
	if (plan.userJourneys && plan.userJourneys.length > 2) {
		const mvpJourneys = plan.userJourneys.filter(j => j.priority === 'MVP');
		const v2Journeys = plan.userJourneys.filter(j => j.priority === 'V2');
		const futureJourneys = plan.userJourneys.filter(j => j.priority === 'FUTURE');

		if (mvpJourneys.length > 0) {
			const options: MenuOption[] = [];
			if (mvpJourneys.length > 0) {
				options.push({
					optionId: 'MENU-PD-1-A',
					label: `MVP only (${mvpJourneys.length} journeys)`,
					description: mvpJourneys.map(j => j.title).join(', '),
					tradeoffs: 'Fastest to ship, focused scope',
					recommended: true,
				});
			}
			if (v2Journeys.length > 0) {
				options.push({
					optionId: 'MENU-PD-1-B',
					label: `MVP + V2 (${mvpJourneys.length + v2Journeys.length} journeys)`,
					description: [...mvpJourneys, ...v2Journeys].map(j => j.title).join(', '),
					tradeoffs: 'Broader scope, longer timeline',
				});
			}
			if (options.length >= 2) {
				menuItems.push({
					id: 'MENU-PD-1',
					question: 'Which user journeys should be in the initial release?',
					context: 'This defines the launch scope and development timeline',
					options,
				});
			}
		}
	}

	if (mirrorItems.length === 0 && menuItems.length === 0) {
		return undefined;
	}

	const result: MMPPayload = {};

	if (mirrorItems.length > 0) {
		result.mirror = {
			steelMan: plan.productDescription
				|| plan.productVision
				|| 'Product discovery assumptions based on the analysis',
			items: mirrorItems,
		};
	}

	if (menuItems.length > 0) {
		result.menu = { items: menuItems };
	}

	const hasMirror = !!result.mirror;
	const hasMenu = !!result.menu;
	console.log('[INTAKE:ExtractMMP] Result:', {
		hasMirror,
		mirrorCount: result.mirror?.items?.length ?? 0,
		hasMenu,
		menuCount: result.menu?.items?.length ?? 0,
		returning: (hasMirror || hasMenu) ? 'MMPPayload' : 'empty object (truthy but no cards)',
	});

	return result;
}

// ==================== INTENT DISCOVERY PHASE (INVERTED FLOW) ====================


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

		// 3. Invoke Expert in INTENT_DISCOVERY mode
		const analysisCommandId = randomUUID();
		emitWorkflowCommand({
			dialogueId,
			commandId: analysisCommandId,
			action: 'start',
			commandType: 'cli_invocation',
			label: 'Product Discovery — Intent Discovery',
			summary: 'Analyzing: ' + humanMessage.substring(0, 120),
			status: 'running',
			timestamp: new Date().toISOString(),
		});

		const expertResult = await invokeAnalyzingTechnicalExpert({
			dialogueId,
			humanMessage,
			provider: providerResult.value,
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
			label: 'Product Discovery — Intent Discovery',
			summary: expertResult.success
				? 'Intent discovery completed'
				: 'Error: ' + (expertResult.error?.message ?? 'Unknown'),
			timestamp: new Date().toISOString(),
		});

		if (!expertResult.success) {
			return expertResult as Result<PhaseExecutionResult>;
		}

		const analysis = expertResult.value;

		// Strip technical fields from Intent Discovery output — technical analysis belongs in ARCHITECTURE
		analysis.codebaseFindings = [];
		analysis.domainAssessment = [];
		analysis.initialPlan.technicalNotes = [];
		analysis.initialPlan.proposedApproach = '';

		// Domain coverage removed from INTAKE — handled by ARCHITECTURE TECHNICAL_ANALYSIS

		// 4b. Extract product discovery MMP for human review (if product/feature request)
		const productMMP = extractProductDiscoveryMMP(analysis.initialPlan);

		console.log('[INTAKE:Analysis] Product discovery MMP extraction:', {
			requestCategory: analysis.initialPlan.requestCategory,
			intakeMode: conv.intakeMode,
			hasMMP: productMMP !== undefined,
			mirrorCount: productMMP?.mirror?.items?.length ?? 0,
			menuCount: productMMP?.menu?.items?.length ?? 0,
			preMortemCount: productMMP?.preMortem?.items?.length ?? 0,
			personasCount: analysis.initialPlan.personas?.length ?? 0,
			journeysCount: analysis.initialPlan.userJourneys?.length ?? 0,
			phasingCount: analysis.initialPlan.phasingStrategy?.length ?? 0,
			uxReqCount: analysis.initialPlan.uxRequirements?.length ?? 0,
			hasVision: !!analysis.initialPlan.productVision,
			hasDescription: !!analysis.initialPlan.productDescription,
		});

		// 5. Store analysis event
		const eventResult = writeDialogueEvent({
			dialogue_id: dialogueId,
			event_type: 'intake_analysis',
			role: Role.TECHNICAL_EXPERT,
			phase: 'INTAKE',
			speech_act: SpeechAct.EVIDENCE,
			summary: 'Intent discovery complete',
			content: analysis.analysisSummary,
			detail: {
				humanMessage,
				expertResponse: analysis,
				initialPlan: analysis.initialPlan,
				codebaseFindings: analysis.codebaseFindings,
				domainAssessment: analysis.domainAssessment,
				productDiscoveryMMP: productMMP ? JSON.stringify(productMMP) : undefined,
				turnNumber: 0,
				tokenCount: estimateTokenCount(humanMessage, analysis.analysisSummary),
			},
		});

		if (!eventResult.success) {
			return eventResult as unknown as Result<PhaseExecutionResult>;
		}

		// 6. Update conversation: seed plan, coverage, transition based on request type
		// Proposer-Validator flow: product_or_feature (STATE_DRIVEN or DOMAIN_GUIDED) → PROPOSING_DOMAINS
		// Technical tasks: → PROPOSING (no product review)
		let targetSubState: IntakeSubState;
		if (analysis.initialPlan.requestCategory === 'product_or_feature'
			&& (conv.intakeMode === IntakeMode.STATE_DRIVEN || conv.intakeMode === IntakeMode.DOMAIN_GUIDED)) {
			analysis.initialPlan.proposerPhase = ProposerPhase.DOMAIN_MAPPING;
			if (productMMP !== undefined) {
				// Gate on PRODUCT_REVIEW — user must review product artifacts before proposer rounds
				targetSubState = IntakeSubState.PRODUCT_REVIEW;
				analysis.initialPlan.preProposerReview = true;
			} else {
				// No product MMP — skip directly to proposer
				targetSubState = IntakeSubState.PROPOSING_DOMAINS;
			}
		} else if (productMMP !== undefined) {
			// Fallback: HYBRID_CHECKPOINTS with product artifacts → legacy PRODUCT_REVIEW
			targetSubState = IntakeSubState.PRODUCT_REVIEW;
		} else {
			targetSubState = IntakeSubState.PROPOSING;
		}

		console.log('[INTAKE:Analysis] Transition decision:', {
			targetSubState,
			needsInput: targetSubState === IntakeSubState.PRODUCT_REVIEW || targetSubState === IntakeSubState.PROPOSING,
			preProposerReview: analysis.initialPlan.preProposerReview ?? false,
			productDiscoveryMMPStored: !!(productMMP ? JSON.stringify(productMMP) : undefined),
		});

		const updateResult = updateIntakeConversation(dialogueId, {
			subState: targetSubState,
			turnCount: 1,
			draftPlan: analysis.initialPlan,
			currentDomain: null,
		});

		if (!updateResult.success) {
			return updateResult as unknown as Result<PhaseExecutionResult>;
		}

		// 7. Emit events
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

		// 8. Self-loop transition
		transitionWorkflow(
			dialogueId,
			'INTAKE' as Phase,
			TransitionTrigger.INTAKE_TURN_COMPLETE,
			{ turnNumber: 0, isAnalysis: true },
		);

		// Proposer sub-states auto-execute (no human input needed);
		// PRODUCT_REVIEW and PROPOSING await human MMP decisions.
		const needsInput = targetSubState === IntakeSubState.PRODUCT_REVIEW
			|| targetSubState === IntakeSubState.PROPOSING;

		return {
			success: true,
			value: {
				phase: 'INTAKE' as Phase,
				success: true,
				awaitingInput: needsInput,
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
		const expertResult = await invokeIntakeTechnicalExpert({
			dialogueId,
			humanMessage,
			currentPlan: conv.draftPlan,
			turnNumber,
			provider: providerResult.value,
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
			commandBlock: {
				dialogueId,
				commandId: clarifyCommandId,
				label: 'Technical Expert — Clarification Round ' + currentRound,
			},
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

		// 4. Store clarification event
		const eventResult = writeDialogueEvent({
			dialogue_id: dialogueId,
			event_type: 'intake_clarification',
			role: Role.TECHNICAL_EXPERT,
			phase: 'INTAKE',
			speech_act: SpeechAct.EVIDENCE,
			summary: `Clarification round ${currentRound}`,
			content: response.conversationalResponse,
			detail: {
				humanMessage,
				expertResponse: response,
				planSnapshot: response.updatedPlan,
				turnNumber,
				clarificationRound: currentRound,
				tokenCount: estimateTokenCount(humanMessage, response.conversationalResponse),
			},
		});

		if (!eventResult.success) {
			return eventResult as unknown as Result<PhaseExecutionResult>;
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

		// 9. Self-loop transition
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

// ==================== PROPOSER-VALIDATOR FLOW ====================

/**
 * Extract MMP for domain proposals — each domain and persona becomes a Mirror item.
 * Menu item for MVP/V2/Future prioritization.
 */
export function extractDomainMMP(
	domains: DomainProposal[],
	personas: Array<{ id: string; name: string; description: string }>,
): MMPPayload | undefined {
	const mirrorItems: MirrorItem[] = [];

	for (const d of domains) {
		mirrorItems.push({
			id: d.id,
			text: `${d.name}: ${d.description}`,
			category: 'domain',
			rationale: d.rationale,
			status: 'pending',
			source: d.source,
		});
	}

	for (const p of personas) {
		mirrorItems.push({
			id: p.id,
			text: `${p.name}: ${p.description}`,
			category: 'persona',
			rationale: 'Identified from domain analysis',
			status: 'pending',
			source: 'document-specified', // Personas come from Intent Discovery (user-validated)
		});
	}

	if (mirrorItems.length === 0) {return undefined;}

	const menuItems: MenuItem[] = [];
	if (domains.length > 2) {
		const options: MenuOption[] = [
			{
				optionId: 'PV-SCOPE-ALL',
				label: `All domains (${domains.length})`,
				description: 'Include every proposed domain in MVP scope',
				tradeoffs: 'Broadest scope, longest timeline',
			},
			{
				optionId: 'PV-SCOPE-CORE',
				label: 'Core domains only',
				description: 'Focus MVP on the most essential domains. Mark others as V2/Future during review.',
				tradeoffs: 'Focused scope, faster to ship',
				recommended: true,
			},
		];
		menuItems.push({
			id: 'PV-MENU-SCOPE',
			question: 'What should the initial release scope include?',
			context: 'Accept/reject individual domains above, then choose the overall scoping strategy',
			options,
		});
	}

	return {
		mirror: {
			steelMan: 'Based on your request and available context, here are the proposed business domains and personas for this product.',
			items: mirrorItems,
		},
		...(menuItems.length > 0 ? { menu: { items: menuItems } } : {}),
	};
}

/**
 * Extract MMP for journey/workflow proposals.
 */
export function extractJourneyWorkflowMMP(
	journeys: Array<{ id: string; title: string; scenario: string; priority?: string; implementationPhase?: string; source?: string }>,
	workflows: WorkflowProposal[],
): MMPPayload | undefined {
	const mirrorItems: MirrorItem[] = [];

	for (const j of journeys) {
		const phaseTag = j.implementationPhase ?? j.priority ?? '';
		mirrorItems.push({
			id: j.id,
			text: `${phaseTag ? '[' + phaseTag + '] ' : ''}${j.title}: ${j.scenario}`,
			category: 'journey',
			rationale: 'Proposed for accepted domains',
			status: 'pending',
			source: j.source,
		});
	}

	for (const w of workflows) {
		mirrorItems.push({
			id: w.id,
			text: `${w.name}: ${w.description}`,
			category: 'workflow',
			rationale: `Domain: ${w.domainId}. Steps: ${w.steps.length}. Actors: ${w.actors.join(', ')}`,
			status: 'pending',
			source: w.source,
		});
	}

	if (mirrorItems.length === 0) {return undefined;}

	return {
		mirror: {
			steelMan: 'Here are the proposed user journeys and system workflows for the accepted domains.',
			items: mirrorItems,
		},
	};
}

/**
 * Extract MMP for entity proposals.
 */
export function extractEntityMMP(
	entities: EntityProposal[],
): MMPPayload | undefined {
	const mirrorItems: MirrorItem[] = [];

	for (const e of entities) {
		mirrorItems.push({
			id: e.id,
			text: `${e.name}: ${e.description}`,
			category: 'entity',
			rationale: `Domain: ${e.domainId}. Attributes: ${e.keyAttributes.join(', ')}. Relationships: ${e.relationships.join(', ')}`,
			status: 'pending',
			source: e.source,
		});
	}

	if (mirrorItems.length === 0) {return undefined;}

	return {
		mirror: {
			steelMan: 'Here are the proposed data entities for the accepted domains and workflows.',
			items: mirrorItems,
		},
	};
}

/**
 * Extract MMP for integration proposals.
 */
export function extractIntegrationMMP(
	integrations: IntegrationProposal[],
	qualityAttributes: string[],
): MMPPayload | undefined {
	const mirrorItems: MirrorItem[] = [];

	for (const int of integrations) {
		mirrorItems.push({
			id: int.id,
			text: `${int.name} (${int.category}): ${int.description}`,
			category: 'integration',
			rationale: `Providers: ${int.standardProviders.join(', ')}. Ownership: ${int.ownershipModel}. ${int.rationale}`,
			status: 'pending',
			source: int.source,
		});
	}

	for (let i = 0; i < qualityAttributes.length; i++) {
		mirrorItems.push({
			id: `PV-QA-${i + 1}`,
			text: qualityAttributes[i],
			category: 'ux',
			rationale: 'Quality attribute for the platform',
			status: 'pending',
			source: 'ai-proposed',
		});
	}

	if (mirrorItems.length === 0) {return undefined;}

	const menuItems: MenuItem[] = [];
	// Ownership model menu for integrations that have alternatives
	const ownableIntegrations = integrations.filter(i => i.category !== 'other');
	if (ownableIntegrations.length > 0) {
		menuItems.push({
			id: 'PV-MENU-OWNERSHIP',
			question: 'What is the default data ownership strategy for integrations?',
			context: 'This sets the default — individual integrations can override via Mirror edits above',
			options: [
				{ optionId: 'PV-OWN-OWNED', label: 'Owned (System of Record)', description: 'Platform owns the data, integrations sync outbound', tradeoffs: 'Maximum control, more to build', recommended: true },
				{ optionId: 'PV-OWN-SYNCED', label: 'Synced (Bidirectional)', description: 'Data flows both ways between platform and external systems', tradeoffs: 'Balanced, conflict resolution needed' },
				{ optionId: 'PV-OWN-DELEGATED', label: 'Delegated (System of Action)', description: 'Platform orchestrates but external systems own the data', tradeoffs: 'Fastest integration, less control' },
			],
		});
	}

	return {
		mirror: {
			steelMan: 'Here are the proposed integrations and quality attributes for the platform.',
			items: mirrorItems,
		},
		...(menuItems.length > 0 ? { menu: { items: menuItems } } : {}),
	};
}

// ==================== PROPOSER EXECUTION FUNCTIONS ====================

/**
 * Proposer Round 1: Propose business domains + personas.
 * Uses INTENT_DISCOVERY findings as seed context.
 */
export async function executeProposerDomains(
	dialogueId: string,
	humanMessage: string,
): Promise<Result<PhaseExecutionResult>> {
	try {
		const convResult = getOrCreateIntakeConversation(dialogueId);
		if (!convResult.success) {return convResult as unknown as Result<PhaseExecutionResult>;}
		const conv = convResult.value;

		const providerResult = await resolveProviderForRole(Role.TECHNICAL_EXPERT);
		if (!providerResult.success) {return providerResult as Result<PhaseExecutionResult>;}

		const commandId = randomUUID();
		emitWorkflowCommand({
			dialogueId, commandId, action: 'start',
			commandType: 'cli_invocation',
			label: 'Proposer — Domain Mapping',
			summary: 'Proposing business domains and personas',
			status: 'running',
			timestamp: new Date().toISOString(),
		});

		const { invokeProposerDomains } = await import('../roles/technicalExpertIntake.js');
		const result = await invokeProposerDomains({
			dialogueId,
			humanMessage,
			provider: providerResult.value,
			draftPlan: conv.draftPlan,
			onEvent: (event: CLIActivityEvent) => {
				emitCLIActivity(dialogueId, {
					...event,
					role: Role.TECHNICAL_EXPERT,
					phase: 'INTAKE' as Phase,
				});
			},
		});

		emitWorkflowCommand({
			dialogueId, commandId,
			action: result.success ? 'complete' : 'error',
			commandType: 'cli_invocation',
			label: 'Proposer — Domain Mapping',
			summary: result.success
				? `Proposed ${result.value.domains.length} domains, ${result.value.personas.length} personas`
				: `Error: ${result.error?.message ?? 'Unknown'}`,
			timestamp: new Date().toISOString(),
		});

		if (!result.success) {return result as unknown as Result<PhaseExecutionResult>;}

		const { domains, personas } = result.value;
		const mmp = extractDomainMMP(domains, personas);

		// Store on draft plan
		const updatedPlan = {
			...conv.draftPlan,
			proposerPhase: ProposerPhase.DOMAIN_MAPPING,
			domainProposals: domains,
			personas,
		};

		writeDialogueEvent({
			dialogue_id: dialogueId,
			event_type: 'intake_proposer_domains',
			role: Role.TECHNICAL_EXPERT,
			phase: 'INTAKE',
			speech_act: SpeechAct.CLAIM,
			summary: `Proposed ${domains.length} domains, ${personas.length} personas`,
			content: JSON.stringify({ domains, personas }),
			detail: {
				proposerPhase: ProposerPhase.DOMAIN_MAPPING,
				productDiscoveryMMP: mmp ? JSON.stringify(mmp) : undefined,
			},
		});

		updateIntakeConversation(dialogueId, {
			subState: IntakeSubState.PRODUCT_REVIEW,
			draftPlan: updatedPlan,
		});

		transitionWorkflow(dialogueId, 'INTAKE' as Phase, TransitionTrigger.INTAKE_TURN_COMPLETE);

		return {
			success: true,
			value: {
				phase: 'INTAKE' as Phase,
				success: true,
				awaitingInput: true,
				timestamp: new Date().toISOString(),
				metadata: {},
			},
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Proposer Round 2: Propose user journeys + system workflows for accepted domains.
 */
export async function executeProposerJourneys(
	dialogueId: string,
	humanMessage: string,
): Promise<Result<PhaseExecutionResult>> {
	try {
		const convResult = getOrCreateIntakeConversation(dialogueId);
		if (!convResult.success) {return convResult as unknown as Result<PhaseExecutionResult>;}
		const conv = convResult.value;

		const providerResult = await resolveProviderForRole(Role.TECHNICAL_EXPERT);
		if (!providerResult.success) {return providerResult as Result<PhaseExecutionResult>;}

		const commandId = randomUUID();
		emitWorkflowCommand({
			dialogueId, commandId, action: 'start',
			commandType: 'cli_invocation',
			label: 'Proposer — Journeys & Workflows',
			summary: 'Proposing user journeys and system workflows',
			status: 'running',
			timestamp: new Date().toISOString(),
		});

		const { invokeProposerJourneys } = await import('../roles/technicalExpertIntake.js');
		const result = await invokeProposerJourneys({
			dialogueId,
			humanMessage,
			provider: providerResult.value,
			draftPlan: conv.draftPlan,
			onEvent: (event: CLIActivityEvent) => {
				emitCLIActivity(dialogueId, {
					...event,
					role: Role.TECHNICAL_EXPERT,
					phase: 'INTAKE' as Phase,
				});
			},
		});

		emitWorkflowCommand({
			dialogueId, commandId,
			action: result.success ? 'complete' : 'error',
			commandType: 'cli_invocation',
			label: 'Proposer — Journeys & Workflows',
			summary: result.success
				? `Proposed ${result.value.userJourneys.length} journeys, ${result.value.workflows.length} workflows`
				: `Error: ${result.error?.message ?? 'Unknown'}`,
			timestamp: new Date().toISOString(),
		});

		if (!result.success) {return result as unknown as Result<PhaseExecutionResult>;}

		const { userJourneys, workflows } = result.value;
		const mmp = extractJourneyWorkflowMMP(userJourneys, workflows);

		const updatedPlan = {
			...conv.draftPlan,
			proposerPhase: ProposerPhase.JOURNEY_WORKFLOW,
			userJourneys,
			workflowProposals: workflows,
		};

		writeDialogueEvent({
			dialogue_id: dialogueId,
			event_type: 'intake_proposer_journeys',
			role: Role.TECHNICAL_EXPERT,
			phase: 'INTAKE',
			speech_act: SpeechAct.CLAIM,
			summary: `Proposed ${userJourneys.length} journeys, ${workflows.length} workflows`,
			content: JSON.stringify({ userJourneys, workflows }),
			detail: {
				proposerPhase: ProposerPhase.JOURNEY_WORKFLOW,
				productDiscoveryMMP: mmp ? JSON.stringify(mmp) : undefined,
			},
		});

		updateIntakeConversation(dialogueId, {
			subState: IntakeSubState.PRODUCT_REVIEW,
			draftPlan: updatedPlan,
		});

		transitionWorkflow(dialogueId, 'INTAKE' as Phase, TransitionTrigger.INTAKE_TURN_COMPLETE);

		return {
			success: true,
			value: {
				phase: 'INTAKE' as Phase,
				success: true,
				awaitingInput: true,
				timestamp: new Date().toISOString(),
				metadata: {},
			},
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Proposer Round 3: Propose entities + data model for accepted domains/workflows.
 */
export async function executeProposerEntities(
	dialogueId: string,
	humanMessage: string,
): Promise<Result<PhaseExecutionResult>> {
	try {
		const convResult = getOrCreateIntakeConversation(dialogueId);
		if (!convResult.success) {return convResult as unknown as Result<PhaseExecutionResult>;}
		const conv = convResult.value;

		const providerResult = await resolveProviderForRole(Role.TECHNICAL_EXPERT);
		if (!providerResult.success) {return providerResult as Result<PhaseExecutionResult>;}

		const commandId = randomUUID();
		emitWorkflowCommand({
			dialogueId, commandId, action: 'start',
			commandType: 'cli_invocation',
			label: 'Proposer — Data Model',
			summary: 'Proposing entities and data model',
			status: 'running',
			timestamp: new Date().toISOString(),
		});

		const { invokeProposerEntities } = await import('../roles/technicalExpertIntake.js');
		const result = await invokeProposerEntities({
			dialogueId,
			humanMessage,
			provider: providerResult.value,
			draftPlan: conv.draftPlan,
			onEvent: (event: CLIActivityEvent) => {
				emitCLIActivity(dialogueId, {
					...event,
					role: Role.TECHNICAL_EXPERT,
					phase: 'INTAKE' as Phase,
				});
			},
		});

		emitWorkflowCommand({
			dialogueId, commandId,
			action: result.success ? 'complete' : 'error',
			commandType: 'cli_invocation',
			label: 'Proposer — Data Model',
			summary: result.success
				? `Proposed ${result.value.entities.length} entities`
				: `Error: ${result.error?.message ?? 'Unknown'}`,
			timestamp: new Date().toISOString(),
		});

		if (!result.success) {return result as unknown as Result<PhaseExecutionResult>;}

		const { entities } = result.value;
		const mmp = extractEntityMMP(entities);

		const updatedPlan = {
			...conv.draftPlan,
			proposerPhase: ProposerPhase.ENTITY_DATA_MODEL,
			entityProposals: entities,
		};

		writeDialogueEvent({
			dialogue_id: dialogueId,
			event_type: 'intake_proposer_entities',
			role: Role.TECHNICAL_EXPERT,
			phase: 'INTAKE',
			speech_act: SpeechAct.CLAIM,
			summary: `Proposed ${entities.length} entities`,
			content: JSON.stringify({ entities }),
			detail: {
				proposerPhase: ProposerPhase.ENTITY_DATA_MODEL,
				productDiscoveryMMP: mmp ? JSON.stringify(mmp) : undefined,
			},
		});

		updateIntakeConversation(dialogueId, {
			subState: IntakeSubState.PRODUCT_REVIEW,
			draftPlan: updatedPlan,
		});

		transitionWorkflow(dialogueId, 'INTAKE' as Phase, TransitionTrigger.INTAKE_TURN_COMPLETE);

		return {
			success: true,
			value: {
				phase: 'INTAKE' as Phase,
				success: true,
				awaitingInput: true,
				timestamp: new Date().toISOString(),
				metadata: {},
			},
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Proposer Round 4: Propose integrations + quality attributes.
 */
export async function executeProposerIntegrations(
	dialogueId: string,
	humanMessage: string,
): Promise<Result<PhaseExecutionResult>> {
	try {
		const convResult = getOrCreateIntakeConversation(dialogueId);
		if (!convResult.success) {return convResult as unknown as Result<PhaseExecutionResult>;}
		const conv = convResult.value;

		const providerResult = await resolveProviderForRole(Role.TECHNICAL_EXPERT);
		if (!providerResult.success) {return providerResult as Result<PhaseExecutionResult>;}

		const commandId = randomUUID();
		emitWorkflowCommand({
			dialogueId, commandId, action: 'start',
			commandType: 'cli_invocation',
			label: 'Proposer — Integrations & Quality',
			summary: 'Proposing integrations and quality attributes',
			status: 'running',
			timestamp: new Date().toISOString(),
		});

		const { invokeProposerIntegrations } = await import('../roles/technicalExpertIntake.js');
		const result = await invokeProposerIntegrations({
			dialogueId,
			humanMessage,
			provider: providerResult.value,
			draftPlan: conv.draftPlan,
			onEvent: (event: CLIActivityEvent) => {
				emitCLIActivity(dialogueId, {
					...event,
					role: Role.TECHNICAL_EXPERT,
					phase: 'INTAKE' as Phase,
				});
			},
		});

		emitWorkflowCommand({
			dialogueId, commandId,
			action: result.success ? 'complete' : 'error',
			commandType: 'cli_invocation',
			label: 'Proposer — Integrations & Quality',
			summary: result.success
				? `Proposed ${result.value.integrations.length} integrations, ${result.value.qualityAttributes.length} quality attributes`
				: `Error: ${result.error?.message ?? 'Unknown'}`,
			timestamp: new Date().toISOString(),
		});

		if (!result.success) {return result as unknown as Result<PhaseExecutionResult>;}

		const { integrations, qualityAttributes } = result.value;
		const mmp = extractIntegrationMMP(integrations, qualityAttributes);

		const updatedPlan = {
			...conv.draftPlan,
			proposerPhase: ProposerPhase.INTEGRATION_QUALITY,
			integrationProposals: integrations,
			qualityAttributes,
		};

		writeDialogueEvent({
			dialogue_id: dialogueId,
			event_type: 'intake_proposer_integrations',
			role: Role.TECHNICAL_EXPERT,
			phase: 'INTAKE',
			speech_act: SpeechAct.CLAIM,
			summary: `Proposed ${integrations.length} integrations, ${qualityAttributes.length} quality attributes`,
			content: JSON.stringify({ integrations, qualityAttributes }),
			detail: {
				proposerPhase: ProposerPhase.INTEGRATION_QUALITY,
				productDiscoveryMMP: mmp ? JSON.stringify(mmp) : undefined,
			},
		});

		updateIntakeConversation(dialogueId, {
			subState: IntakeSubState.PRODUCT_REVIEW,
			draftPlan: updatedPlan,
		});

		transitionWorkflow(dialogueId, 'INTAKE' as Phase, TransitionTrigger.INTAKE_TURN_COMPLETE);

		return {
			success: true,
			value: { phase: 'INTAKE' as Phase, success: true, awaitingInput: true, timestamp: new Date().toISOString(), metadata: {} },
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}
