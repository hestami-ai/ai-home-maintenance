/**
 * Intake Router
 * Extracted from orchestrator.ts — dispatches to sub-state handlers
 * based on the current IntakeSubState.
 */

import type { Result } from '../types';
import { Phase, IntakeSubState, IntakeMode, ProposerPhase } from '../types';
import type { IntakePlanDocument } from '../types/intake';
import { getOrCreateIntakeConversation } from '../events/reader';
import { updateIntakeConversation } from '../events/writer';
import { updateWorkflowMetadata } from './stateMachine';
import {
	executeIntakeConversationTurn,
	executeIntakeGatheringTurn,
	executeIntakePlanFinalization,
	executeIntakePlanApproval,
	executeIntakeAnalysis,
	executeIntakeClarificationTurn,
	executeProposerDomains,
	executeProposerJourneys,
	executeProposerEntities,
	executeProposerIntegrations,
} from './intakePhase';
import { runNarrativeCuration, produceHandoffDocument } from '../curation/narrativeCurator';
import { CurationMode } from '../types/narrativeCurator';
import { HandoffDocType } from '../context/engineTypes';
import { isLoggerInitialized, getLogger } from '../logging';
import type { PhaseExecutionResult } from './orchestrator';
import { initializeAdaptiveIntake, createMakerIntentAndContract } from './orchestrator';

/**
 * Execute INTAKE phase
 * Conversational planning phase: Human discusses requirements with Technical Expert.
 * Dispatches to sub-state handlers based on the current IntakeSubState.
 *
 * Sub-states:
 *   DISCUSSING         → executeIntakeConversationTurn() → awaitingInput: true
 *   SYNTHESIZING       → executeIntakePlanFinalization() → gateTriggered: true
 *   AWAITING_APPROVAL  → executeIntakePlanApproval()     → nextPhase: PROPOSE
 *
 * @param dialogueId Dialogue ID
 * @param humanInput The human's latest message (or initial goal for first turn)
 * @returns Result containing phase execution result
 */
export async function executeIntakePhase(
	dialogueId: string,
	humanInput: string
): Promise<Result<PhaseExecutionResult>> {
	try {
		const convResult = getOrCreateIntakeConversation(dialogueId);
		if (!convResult.success) {
			return convResult as unknown as Result<PhaseExecutionResult>;
		}

		const conv = convResult.value;

		switch (conv.subState) {
			case IntakeSubState.ANALYZING:
				return await executeIntakeAnalysis(dialogueId, humanInput);

			case IntakeSubState.PRODUCT_REVIEW: {
				const proposerPhase = conv.draftPlan?.proposerPhase as ProposerPhase | null | undefined;
				const isMmpSubmission = humanInput.startsWith('[MMP Decisions]');

				// Free text during PRODUCT_REVIEW = refinement feedback.
				// Re-run the CURRENT proposer round with the feedback so the LLM
				// can adjust its proposals (e.g., "focus on Pillar 1").
				if (!isMmpSubmission && humanInput.trim().length > 0) {
					// Determine which proposer to re-run based on current proposerPhase
					let rerunSubState: IntakeSubState;
					if (proposerPhase === ProposerPhase.DOMAIN_MAPPING) {
						rerunSubState = IntakeSubState.PROPOSING_DOMAINS;
					} else if (proposerPhase === ProposerPhase.JOURNEY_WORKFLOW) {
						rerunSubState = IntakeSubState.PROPOSING_JOURNEYS;
					} else if (proposerPhase === ProposerPhase.ENTITY_DATA_MODEL) {
						rerunSubState = IntakeSubState.PROPOSING_ENTITIES;
					} else if (proposerPhase === ProposerPhase.INTEGRATION_QUALITY) {
						rerunSubState = IntakeSubState.PROPOSING_INTEGRATIONS;
					} else {
						rerunSubState = IntakeSubState.PROPOSING_DOMAINS;
					}

					// Store feedback in plan BEFORE execution (proposer needs it),
					// but defer sub-state advancement until AFTER successful execution.
					const updatedPlan = { ...conv.draftPlan, humanFeedback: humanInput };
					updateIntakeConversation(dialogueId, {
						draftPlan: updatedPlan as IntakePlanDocument,
					});

					// Re-run the proposer with feedback
					let rerunResult;
					switch (rerunSubState) {
						case IntakeSubState.PROPOSING_DOMAINS:
							rerunResult = await executeProposerDomains(dialogueId, humanInput);
							break;
						case IntakeSubState.PROPOSING_JOURNEYS:
							rerunResult = await executeProposerJourneys(dialogueId, humanInput);
							break;
						case IntakeSubState.PROPOSING_ENTITIES:
							rerunResult = await executeProposerEntities(dialogueId, humanInput);
							break;
						case IntakeSubState.PROPOSING_INTEGRATIONS:
							rerunResult = await executeProposerIntegrations(dialogueId, humanInput);
							break;
						default:
							rerunResult = await executeProposerDomains(dialogueId, humanInput);
							break;
					}

					// Only advance sub-state after successful execution
					if (rerunResult.success) {
						updateIntakeConversation(dialogueId, { subState: rerunSubState });
					}
					return rerunResult;
				}

				// MMP submission — advance to next proposer round
				let nextSubState: IntakeSubState;
				if (proposerPhase === ProposerPhase.DOMAIN_MAPPING) {
					nextSubState = IntakeSubState.PROPOSING_JOURNEYS;
				} else if (proposerPhase === ProposerPhase.JOURNEY_WORKFLOW) {
					nextSubState = IntakeSubState.PROPOSING_ENTITIES;
				} else if (proposerPhase === ProposerPhase.ENTITY_DATA_MODEL) {
					nextSubState = IntakeSubState.PROPOSING_INTEGRATIONS;
				} else if (proposerPhase === ProposerPhase.INTEGRATION_QUALITY) {
					nextSubState = IntakeSubState.SYNTHESIZING;
				} else {
					nextSubState = IntakeSubState.PROPOSING;
				}
				// Execute FIRST, then advance sub-state on success (prevents corruption if execution throws)
				let advanceResult;
				if (nextSubState === IntakeSubState.PROPOSING_JOURNEYS) {
					advanceResult = await executeProposerJourneys(dialogueId, humanInput);
				} else if (nextSubState === IntakeSubState.PROPOSING_ENTITIES) {
					advanceResult = await executeProposerEntities(dialogueId, humanInput);
				} else if (nextSubState === IntakeSubState.PROPOSING_INTEGRATIONS) {
					advanceResult = await executeProposerIntegrations(dialogueId, humanInput);
				} else if (nextSubState === IntakeSubState.SYNTHESIZING) {
					advanceResult = await executeIntakePlanFinalization(dialogueId);
				}

				if (advanceResult) {
					if (advanceResult.success) {
						updateIntakeConversation(dialogueId, { subState: nextSubState });
					}
					return advanceResult;
				}

				return {
					success: true,
					value: {
						phase: Phase.INTAKE,
						success: true,
						awaitingInput: true,
						metadata: {},
						timestamp: new Date().toISOString(),
					},
				};
			}

			// === Proposer-Validator sub-states ===
			case IntakeSubState.PROPOSING_DOMAINS:
				return await executeProposerDomains(dialogueId, humanInput);

			case IntakeSubState.PROPOSING_JOURNEYS:
				return await executeProposerJourneys(dialogueId, humanInput);

			case IntakeSubState.PROPOSING_ENTITIES:
				return await executeProposerEntities(dialogueId, humanInput);

			case IntakeSubState.PROPOSING_INTEGRATIONS:
				return await executeProposerIntegrations(dialogueId, humanInput);

			case IntakeSubState.PROPOSING:
				// User responded to the proposal — transition to CLARIFYING
				updateIntakeConversation(dialogueId, {
					subState: IntakeSubState.CLARIFYING,
					clarificationRound: 1,
				});
				return await executeIntakeClarificationTurn(dialogueId, humanInput);

			case IntakeSubState.CLARIFYING:
				return await executeIntakeClarificationTurn(dialogueId, humanInput);

			case IntakeSubState.GATHERING:
				return await executeIntakeGatheringTurn(dialogueId, humanInput);

			case IntakeSubState.DISCUSSING:
				// First turn: cache goal, run classifier, initialize coverage
				if (conv.turnCount === 0) {
					updateWorkflowMetadata(dialogueId, {
						lastIntakeGoal: humanInput,
					});
					await initializeAdaptiveIntake(dialogueId, humanInput, []);

					// Re-read conv after initialization to get mode-aware state
					const freshResult = getOrCreateIntakeConversation(dialogueId);
					if (freshResult.success) {
						const fresh = freshResult.value;
						// STATE_DRIVEN and DOMAIN_GUIDED now use inverted flow (ANALYZING)
						if (fresh.intakeMode === IntakeMode.STATE_DRIVEN ||
							fresh.intakeMode === IntakeMode.DOMAIN_GUIDED) {
							return await executeIntakeAnalysis(dialogueId, humanInput);
						}
					}
				}
				return await executeIntakeConversationTurn(
					dialogueId,
					humanInput
				);

			case IntakeSubState.SYNTHESIZING:
				return await executeIntakePlanFinalization(dialogueId);

			case IntakeSubState.AWAITING_APPROVAL: {
				const approvalResult = executeIntakePlanApproval(dialogueId);
				// Narrative Curator: intent snapshot after plan approval
				// MUST await — fire-and-forget spawns a concurrent CLI process that
				// conflicts with the ARCHITECTURE phase CLI call in the next loop iteration.
				if (approvalResult.success && approvalResult.value.nextPhase) {
					try {
						await runNarrativeCuration(dialogueId, CurationMode.INTENT);
					} catch (err) {
						if (isLoggerInitialized()) {
							getLogger()
								.child({ component: 'curator' })
								.warn('Curator INTENT snapshot failed (non-blocking)', {
									error: err instanceof Error ? err.message : String(err),
								});
						}
					}

					// Produce canonical INTAKE handoff document for downstream phases
					produceHandoffDocument(dialogueId, HandoffDocType.INTAKE, 'INTAKE').catch((err) => {
						if (isLoggerInitialized()) {
							getLogger().child({ component: 'handoff' }).warn('INTAKE handoff doc failed', {
								error: err instanceof Error ? err.message : String(err),
							});
						}
					});

					// ── MAKER: Create IntentRecord + AcceptanceContract from approved plan ──
					createMakerIntentAndContract(dialogueId);
				}
				return approvalResult;
			}

			default:
				return {
					success: false,
					error: new Error(
						`Unknown intake sub-state: ${conv.subState}`
					),
				};
		}
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to execute INTAKE phase'),
		};
	}
}
