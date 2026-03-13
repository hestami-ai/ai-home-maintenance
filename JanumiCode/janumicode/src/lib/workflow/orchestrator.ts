/**
 * Workflow Orchestrator
 * Implements Phase 7.2: Complete workflow orchestration with all phases
 * DBOS-compatible orchestration of governed multi-role dialogue
 */

import type {
	Result,
	Phase,
	Claim,
	Verdict,
	LLMProviderInterface,
	RoleLLMConfig,
} from '../types';
import { Role } from '../types';
import {
	emitDialogueTurnAdded,
	emitWorkflowPhaseChanged,
	emitWorkflowGateTriggered,
	emitClaimCreated,
	emitCLIActivity,
	emitWorkflowCommand,
	emitWorkflowPhaseFailed,
} from '../integration/eventBus';
import { randomUUID } from 'node:crypto';
import {
	initializeWorkflowState,
	getWorkflowState,
	transitionWorkflow,
	updateWorkflowMetadata,
	TransitionTrigger,
} from './stateMachine';
import { hasOpenGates, createReviewGate, createGate, GateTriggerCondition } from './gates';
import {
	executeIntakeConversationTurn,
	executeIntakeGatheringTurn,
	executeIntakePlanFinalization,
	executeIntakePlanApproval,
	executeIntakeAnalysis,
	executeIntakeClarificationTurn,
} from './intakePhase';
import { IntakeSubState, IntakeMode } from '../types';
import type { DomainCoverageMap } from '../types';
import { getOrCreateIntakeConversation } from '../events/reader';
import { updateIntakeConversation } from '../events/writer';
import { classifyIntakeInput } from './intakeClassifier';
import {
	initializeCoverageMap,
	formatUncoveredDomainsForPrompt,
	getCoverageGaps,
	DOMAIN_INFO,
	DOMAIN_SEQUENCE,
} from './domainCoverageTracker';
import { getEventBus } from '../integration/eventBus';
import { executeVerification } from './verification';
import {
	invokeExecutor,
	reparseExecutorResponse,
	assumptionsToClaims,
	type ExecutorResponse,
} from '../roles/executor';
import {
	invokeHistorianInterpreter,
	invokeHistorianAdjudication,
} from '../roles/historianInterpreter';
import { HistorianQueryType } from '../context';
import { getDatabase } from '../database';
import { resolveProviderForRole } from '../cli/providerResolver';
import { buildStdinContent } from '../cli/types';
import {
	evaluateExecutorResponse,
	EvaluationVerdict,
	createProposalBranches,
	type ProposalBranch,
} from './responseEvaluator';
import { getLogger, isLoggerInitialized } from '../logging';
import { runNarrativeCuration } from '../curation/narrativeCurator';
import { CurationMode } from '../types/narrativeCurator';
import { embedAndStore, isEmbeddingAvailable } from '../embedding/service';

// ── MAKER imports ──
import type { TaskUnit, IntentRecord, AcceptanceContract, ValidationPacket, ToolchainDetection, RepairPacket } from '../types/maker';
import { RepairClassification } from '../types/maker';
import {
	createIntentRecord,
	createAcceptanceContract,
	getTaskGraphForDialogue,
	getIntentRecordForDialogue,
	getAcceptanceContractForDialogue,
	getTaskUnitsForGraph,
	createClaimUnit,
	createHistoricalInvariantPacket,
	createOutcomeSnapshot,
	updateTaskUnitStatus,
	updateTaskGraphStatus,
	getRepairPacketsForUnit,
} from '../database/makerStore';
import { decomposeGoalIntoTaskGraph } from './taskDecomposer';
import { checkDecompositionQuality, getNextReadyUnits, completeUnitAndPropagate, isGraphComplete, getGraphProgress, resetStaleInProgressUnits } from './taskGraph';
import { detectToolchains, runUnitValidation, classifyFailureType } from './validationPipeline';
import { classifyRepairability, canAttemptRepair, attemptRepair } from './repairEngine';
import { routeTaskToProvider } from './taskRouter';
import { getAllProviderProfiles } from '../cli/providerCapabilities';
import { getProviderCapabilityOverrides } from '../config/manager';
import { buildMakerPlannerContext } from '../context/builders/makerPlanner';
import { invokeExecutorForUnit } from '../roles/executor';
import { createEnrichedRepairEscalationGate } from './gates';
import { getWorkspaceRoot } from '../context/workspaceReader';

/**
 * Provider instances for workflow execution (actual LLM providers, not config)
 */
export interface WorkflowProviders {
	executor: LLMProviderInterface;
	verifier: LLMProviderInterface;
	historianInterpreter: LLMProviderInterface;
}

/**
 * Workflow execution options
 */
export interface WorkflowExecutionOptions {
	dialogueId: string;
	goal: string; // User's goal/request
	llmConfig: RoleLLMConfig;
	tokenBudget?: number;
	autoAdvance?: boolean; // Auto-advance through phases
}

/**
 * Phase execution result
 */
export interface PhaseExecutionResult {
	phase: Phase;
	success: boolean;
	nextPhase?: Phase;
	gateTriggered?: boolean;
	/** When true, the phase is waiting for the next human message.
	 *  The cycle loop should break and re-enable the webview input.
	 *  Used by the INTAKE conversational planning phase. */
	awaitingInput?: boolean;
	metadata: Record<string, unknown>;
	timestamp: string;
}

/**
 * Workflow execution result
 */
export interface WorkflowExecutionResult {
	dialogueId: string;
	currentPhase: Phase;
	phaseResults: PhaseExecutionResult[];
	isComplete: boolean;
	hasOpenGates: boolean;
}

/**
 * Start workflow
 * Initializes a new dialogue workflow
 *
 * @param options Workflow execution options
 * @returns Result containing workflow state
 */
export function startWorkflow(
	options: WorkflowExecutionOptions
): Result<{ dialogueId: string }> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Create dialogue record
		db.exec(`
			CREATE TABLE IF NOT EXISTS dialogues (
				dialogue_id TEXT PRIMARY KEY,
				goal TEXT NOT NULL,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			)
		`);

		const now = new Date().toISOString();

		db.prepare(
			`
			INSERT INTO dialogues (dialogue_id, goal, created_at, updated_at)
			VALUES (?, ?, ?, ?)
		`
		).run(options.dialogueId, options.goal, now, now);

		// Initialize workflow state
		const stateResult = initializeWorkflowState(options.dialogueId, {
			goal: options.goal,
		});

		if (!stateResult.success) {
			return stateResult as Result<{ dialogueId: string }>;
		}

		return { success: true, value: { dialogueId: options.dialogueId } };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to start workflow'),
		};
	}
}

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
				if (approvalResult.success && approvalResult.value.nextPhase) {
					runNarrativeCuration(dialogueId, CurationMode.INTENT).catch(
						(err) => {
							if (isLoggerInitialized()) {
								getLogger()
									.child({ component: 'curator' })
									.warn('Curator INTENT snapshot failed', {
										error: err instanceof Error ? err.message : String(err),
									});
							}
						}
					);

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

/**
 * Execute PROPOSE phase
 * Executor generates proposal and surfaces assumptions
 *
 * @param dialogueId Dialogue ID
 * @param provider LLM provider for Executor
 * @param tokenBudget Token budget
 * @returns Result containing phase execution result
 */
export async function executeProposePhase(
	dialogueId: string,
	tokenBudget: number
): Promise<Result<PhaseExecutionResult>> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Resolve CLI provider for Executor role
		const providerResult = await resolveProviderForRole(Role.EXECUTOR);
		if (!providerResult.success) {
			return providerResult as Result<PhaseExecutionResult>;
		}

		// Get goal from workflow metadata
		const stateResult = getWorkflowState(dialogueId);
		if (!stateResult.success) {
			return stateResult as Result<PhaseExecutionResult>;
		}

		const metadata = JSON.parse(stateResult.value.metadata);
		const rawGoal = metadata.lastIntakeGoal ?? metadata.goal ?? '';

		// If an approved INTAKE plan exists, build a rich structured prompt for the Executor
		const goal = metadata.approvedIntakePlan
			? formatApprovedPlanForExecutor(rawGoal, metadata.approvedIntakePlan)
			: rawGoal;

		// Shared command ID for proposal command block
		const proposeCommandId = randomUUID();

		// ── Retry cache check ──
		// If previous invocation failed and raw output was cached, try re-parsing first
		let response: ExecutorResponse | undefined;
		if (metadata.cachedRawCliOutput && metadata.lastFailedPhase === 'PROPOSE') {
			const reparseResult = reparseExecutorResponse(metadata.cachedRawCliOutput);
			if (reparseResult.success) {
				response = reparseResult.value;
				// Clear cache flags — re-parse succeeded
				updateWorkflowMetadata(dialogueId, {
					cachedRawCliOutput: undefined,
					lastFailedPhase: undefined,
				});

				// Emit a command block for the successful re-parse
				emitWorkflowCommand({
					dialogueId,
					commandId: proposeCommandId,
					action: 'start',
					commandType: 'role_invocation',
					label: 'Executor — Re-parsed Cached Response',
					summary: 'Successfully re-parsed cached CLI output (no LLM re-invocation)',
					status: 'running',
					timestamp: new Date().toISOString(),
				});
			}
			// If re-parse fails, fall through to fresh CLI invocation below
		}

		// ── Fresh CLI invocation (skipped if cache re-parse succeeded) ──
		if (!response) {
			const proposeProvider = providerResult.value;
			const proposeCmdPreview = proposeProvider.getCommandPreview({ stdinContent: '<goal + context>', outputFormat: 'json' });
			emitWorkflowCommand({
				dialogueId,
				commandId: proposeCommandId,
				action: 'start',
				commandType: 'role_invocation',
				label: `Executor — Generating Proposal [${proposeProvider.name}]`,
				summary: `Goal: ${goal.substring(0, 120)}${goal.length > 120 ? '...' : ''}`,
				status: 'running',
				timestamp: new Date().toISOString(),
			});
			if (proposeCmdPreview.success) {
				emitWorkflowCommand({
					dialogueId,
					commandId: proposeCommandId,
					action: 'output',
					commandType: 'role_invocation',
					label: 'Executor',
					summary: `$ ${proposeCmdPreview.value}`,
					timestamp: new Date().toISOString(),
				});
			}

			const executorResult = await invokeExecutor({
				dialogueId,
				goal,
				tokenBudget,
				provider: providerResult.value,
				includeHistoricalFindings: true,
				commandId: proposeCommandId,
			});

			if (!executorResult.success) {
				emitWorkflowCommand({
					dialogueId,
					commandId: proposeCommandId,
					action: 'error',
					commandType: 'role_invocation',
					label: 'Executor — Generating Proposal',
					summary: `Failed: ${executorResult.error.message}`,
					status: 'error',
					timestamp: new Date().toISOString(),
				});
				updateWorkflowMetadata(dialogueId, {
					lastFailedPhase: 'PROPOSE',
				});
				emitWorkflowPhaseFailed(dialogueId, 'PROPOSE', executorResult.error.message);
				return executorResult as Result<PhaseExecutionResult>;
			}

			response = executorResult.value;
		}
		const now = new Date().toISOString();

		// Emit full input
		emitWorkflowCommand({
			dialogueId,
			commandId: proposeCommandId,
			action: 'output',
			commandType: 'role_invocation',
			label: 'Executor',
			summary: '── Input ──',
			detail: goal,
			timestamp: now,
		});

		// Emit full output: proposal
		emitWorkflowCommand({
			dialogueId,
			commandId: proposeCommandId,
			action: 'output',
			commandType: 'role_invocation',
			label: 'Executor',
			summary: '── Proposal ──',
			detail: response.proposal,
			timestamp: now,
		});

		// Emit assumptions
		if (response.assumptions.length > 0) {
			const assumptionLines = response.assumptions
				.map((a, i) => `${i + 1}. [${a.criticality}] ${a.statement}`)
				.join('\n');
			emitWorkflowCommand({
				dialogueId,
				commandId: proposeCommandId,
				action: 'output',
				commandType: 'role_invocation',
				label: 'Executor',
				summary: `── Assumptions (${response.assumptions.length}) ──`,
				detail: assumptionLines,
				timestamp: now,
			});
		}

		// Emit constraint adherence notes
		if (response.constraint_adherence_notes.length > 0) {
			emitWorkflowCommand({
				dialogueId,
				commandId: proposeCommandId,
				action: 'output',
				commandType: 'role_invocation',
				label: 'Executor',
				summary: `── Constraint Notes (${response.constraint_adherence_notes.length}) ──`,
				detail: response.constraint_adherence_notes.join('\n'),
				timestamp: now,
			});
		}

		emitWorkflowCommand({
			dialogueId,
			commandId: proposeCommandId,
			action: 'complete',
			commandType: 'role_invocation',
			label: 'Executor — Proposal Complete',
			summary: `Proposal generated with ${response.assumptions.length} assumption(s), ${response.artifacts.length} artifact(s)`,
			status: 'success',
			timestamp: now,
		});
		const turnId = await getNextTurnId(dialogueId);

		// Store proposal as dialogue turn
		db.prepare(
			`
			INSERT INTO dialogue_turns (
				turn_id, dialogue_id, role, phase, speech_act,
				content_ref, timestamp
			) VALUES (?, ?, ?, ?, ?, ?, ?)
		`
		).run(
			turnId,
			dialogueId,
			Role.EXECUTOR,
			'PROPOSE',
			'CLAIM',
			JSON.stringify(response.proposal),
			now
		);
		emitDialogueTurnAdded(dialogueId, turnId, Role.EXECUTOR);

		// Fire-and-forget: embed proposal for semantic search
		if (isEmbeddingAvailable()) {
			embedAndStore('dialogue_turn', String(turnId), dialogueId, JSON.stringify(response.proposal)).catch(() => {});
		}

		// Cache executor response in workflow metadata for ASSUMPTION_SURFACING
		updateWorkflowMetadata(dialogueId, {
			turnCount: turnId,
			cachedExecutorResponse: {
				proposal: response.proposal,
				assumptions: response.assumptions,
				artifacts: response.artifacts,
				constraint_adherence_notes: response.constraint_adherence_notes,
			},
		});

		// ── Response Evaluator sub-step ──
		// Classify the executor's response before proceeding.
		// Build enriched context so the evaluator sees proposal + structured metadata.
		const assumptionSummary = response.assumptions.length > 0
			? `\n\nAssumptions surfaced (${response.assumptions.length}):\n${response.assumptions.map((a, i) => `${i + 1}. [${a.criticality}] ${a.statement}`).join('\n')}`
			: '';
		const artifactSummary = response.artifacts.length > 0
			? `\n\nArtifacts generated (${response.artifacts.length}):\n${response.artifacts.map((a, i) => `${i + 1}. [${a.type}] ${a.description}`).join('\n')}`
			: '';
		const enrichedResponse = response.proposal + assumptionSummary + artifactSummary;
		const evaluation = await evaluateExecutorResponse(goal, enrichedResponse, dialogueId);

		const evalLogger = isLoggerInitialized()
			? getLogger().child({ component: 'evaluator', dialogueId })
			: undefined;

		switch (evaluation.verdict) {
			case EvaluationVerdict.ESCALATE_CONFUSED: {
				evalLogger?.warn('Executor response classified as confused — escalating to human', {
					summary: evaluation.summary,
				});
				const gateResult = createReviewGate(
					dialogueId,
					`Executor response appears confused or incoherent: ${evaluation.summary ?? evaluation.reasoning}. Please provide clarification.`
				);
				if (gateResult.success && gateResult.value) {
					emitWorkflowGateTriggered(dialogueId, gateResult.value.gate_id, gateResult.value.reason);
				}
				// Narrative Curator: lightweight failure trace
				runNarrativeCuration(dialogueId, CurationMode.FAILURE).catch(() => {});
				return {
					success: true,
					value: {
						phase: 'PROPOSE' as Phase,
						success: true,
						gateTriggered: true,
						metadata: {
							proposal: response.proposal,
							evaluationVerdict: evaluation.verdict,
							evaluationReasoning: evaluation.reasoning,
						},
						timestamp: now,
					},
				};
			}

			case EvaluationVerdict.ESCALATE_QUESTIONS: {
				const questionList = evaluation.questions?.join('\n• ') ?? 'No specific questions extracted';
				evalLogger?.warn('Executor has questions — escalating to human', {
					questionCount: evaluation.questions?.length,
				});
				const gateResult = createReviewGate(
					dialogueId,
					`Executor needs clarification before proposing:\n• ${questionList}`
				);
				if (gateResult.success && gateResult.value) {
					emitWorkflowGateTriggered(dialogueId, gateResult.value.gate_id, gateResult.value.reason);
				}
				// Narrative Curator: lightweight failure trace
				runNarrativeCuration(dialogueId, CurationMode.FAILURE).catch(() => {});
				return {
					success: true,
					value: {
						phase: 'PROPOSE' as Phase,
						success: true,
						gateTriggered: true,
						metadata: {
							proposal: response.proposal,
							evaluationVerdict: evaluation.verdict,
							questions: evaluation.questions,
						},
						timestamp: now,
					},
				};
			}

			case EvaluationVerdict.ESCALATE_OPTIONS: {
				const options = evaluation.options ?? [];
				if (options.length < 2) {
					evalLogger?.info('ESCALATE_OPTIONS with <2 options — treating as PROCEED');
					break; // Fall through to normal PROCEED path
				}
				evalLogger?.info('Executor presented multiple options — setting up branch analysis', {
					optionCount: options.length,
					labels: options.map((o) => o.label),
				});

				const branches = createProposalBranches(options);

				// Mark first branch as analyzing, override cached response with first branch.
				// Store original assumptions separately so they can be reused per-branch.
				branches[0].status = 'analyzing';
				updateWorkflowMetadata(dialogueId, {
					proposalBranches: branches,
					currentBranchIndex: 0,
					originalAssumptions: response.assumptions,
					originalArtifacts: response.artifacts,
					originalConstraintNotes: response.constraint_adherence_notes,
					cachedExecutorResponse: {
						proposal: branches[0].proposal,
						assumptions: response.assumptions,
						artifacts: response.artifacts,
						constraint_adherence_notes: response.constraint_adherence_notes,
					},
				});

				return {
					success: true,
					value: {
						phase: 'PROPOSE' as Phase,
						success: true,
						nextPhase: 'ASSUMPTION_SURFACING' as Phase,
						metadata: {
							proposal: response.proposal,
							evaluationVerdict: evaluation.verdict,
							branchCount: branches.length,
						},
						timestamp: now,
					},
				};
			}

			case EvaluationVerdict.PROCEED:
			default:
				evalLogger?.info('Executor response classified as PROCEED');
				break;
		}

		// Normal PROCEED path
		// ── MAKER: Task graph decomposition (if intent record exists) ──
		const decompositionResult = await attemptMakerDecomposition(dialogueId, goal, providerResult.value);
		if (decompositionResult.gateTriggered) {
			return {
				success: true,
				value: {
					phase: 'PROPOSE' as Phase,
					success: true,
					gateTriggered: true,
					metadata: {
						proposal: response.proposal,
						evaluationVerdict: evaluation.verdict,
						decompositionIssue: decompositionResult.issue,
					},
					timestamp: now,
				},
			};
		}

		return {
			success: true,
			value: {
				phase: 'PROPOSE' as Phase,
				success: true,
				nextPhase: 'ASSUMPTION_SURFACING' as Phase,
				metadata: {
					proposal: response.proposal,
					assumptionCount: response.assumptions.length,
					evaluationVerdict: evaluation.verdict,
					graphId: decompositionResult.graphId,
				},
				timestamp: now,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to execute PROPOSE phase'),
		};
	}
}

/**
 * Execute ASSUMPTION_SURFACING phase
 * Converts executor assumptions (cached from PROPOSE) to claims
 *
 * @param dialogueId Dialogue ID
 * @param provider LLM provider (fallback if no cached response)
 * @param tokenBudget Token budget
 * @returns Result containing phase execution result
 */
export async function executeAssumptionSurfacingPhase(
	dialogueId: string,
	tokenBudget: number
): Promise<Result<PhaseExecutionResult>> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const stateResult = getWorkflowState(dialogueId);
		if (!stateResult.success) {
			return stateResult as Result<PhaseExecutionResult>;
		}

		const metadata = JSON.parse(stateResult.value.metadata);

		// Use cached executor response from PROPOSE phase if available
		let response: ExecutorResponse;
		if (metadata.cachedExecutorResponse) {
			response = {
				...metadata.cachedExecutorResponse,
				raw_response: '(cached from PROPOSE phase)',
			};
		} else {
			// Fallback: re-invoke Executor if no cached response
			const executorProviderResult = await resolveProviderForRole(Role.EXECUTOR);
			if (!executorProviderResult.success) {
				return executorProviderResult as Result<PhaseExecutionResult>;
			}
			const goal = metadata.lastIntakeGoal ?? metadata.goal ?? '';
			const executorResult = await invokeExecutor({
				dialogueId,
				goal,
				tokenBudget,
				provider: executorProviderResult.value,
			});

			if (!executorResult.success) {
				return executorResult as Result<PhaseExecutionResult>;
			}
			response = executorResult.value;
		}

		const turnId = await getNextTurnId(dialogueId);
		const now = new Date().toISOString();

		// Store dialogue turn FIRST (claims reference it via FK)
		db.prepare(
			`
			INSERT INTO dialogue_turns (
				turn_id, dialogue_id, role, phase, speech_act,
				content_ref, timestamp
			) VALUES (?, ?, ?, ?, ?, ?, ?)
		`
		).run(
			turnId,
			dialogueId,
			Role.EXECUTOR,
			'ASSUMPTION_SURFACING',
			'ASSUMPTION',
			JSON.stringify(response.assumptions),
			now
		);
		emitDialogueTurnAdded(dialogueId, turnId, Role.EXECUTOR);

		// Convert assumptions to claims
		const claims = assumptionsToClaims(
			response.assumptions,
			dialogueId,
			turnId
		);

		// Store claims (after turn exists for FK)
		for (const claim of claims) {
			db.prepare(
				`
				INSERT INTO claims (
					claim_id, statement, introduced_by, criticality,
					status, dialogue_id, turn_id, created_at, assumption_type
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`
			).run(
				claim.claim_id,
				claim.statement,
				claim.introduced_by,
				claim.criticality,
				claim.status,
				claim.dialogue_id,
				claim.turn_id,
				claim.created_at,
				claim.assumption_type ?? null
			);
			emitClaimCreated(dialogueId, claim.claim_id, claim.statement);

			// Fire-and-forget: embed claim for semantic search
			if (isEmbeddingAvailable()) {
				embedAndStore('claim', claim.claim_id, dialogueId, claim.statement).catch(() => {});
			}
		}

		// ── Branch tracking ──
		// If in multi-option mode, store this branch's claim IDs
		const claimIds = claims.map((c) => c.claim_id);
		const branches: ProposalBranch[] | undefined = metadata.proposalBranches;
		const branchIdx: number | undefined = metadata.currentBranchIndex;
		if (branches && branchIdx !== undefined && branches[branchIdx]) {
			branches[branchIdx].assumptions = response.assumptions;
			branches[branchIdx].claim_ids = claimIds;
			updateWorkflowMetadata(dialogueId, { proposalBranches: branches });
		}

		// ── MAKER: Extract ClaimUnits from task graph units ──
		extractMakerClaimUnits(dialogueId);

		return {
			success: true,
			value: {
				phase: 'ASSUMPTION_SURFACING' as Phase,
				success: true,
				nextPhase: 'VERIFY' as Phase,
				metadata: {
					claimCount: claims.length,
					claimIds,
				},
				timestamp: now,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to execute ASSUMPTION_SURFACING phase'),
		};
	}
}

/**
 * Execute VERIFY phase
 * Verifies all open claims
 *
 * @param dialogueId Dialogue ID
 * @param provider LLM provider for Verifier
 * @param tokenBudget Token budget
 * @returns Result containing phase execution result
 */
export async function executeVerifyPhase(
	dialogueId: string,
	tokenBudget: number
): Promise<Result<PhaseExecutionResult>> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Resolve CLI provider for Verifier role
		const verifierProviderResult = await resolveProviderForRole(Role.VERIFIER);
		if (!verifierProviderResult.success) {
			return verifierProviderResult as Result<PhaseExecutionResult>;
		}

		// Get all open claims
		const openClaims = db
			.prepare(
				`
			SELECT claim_id, statement, introduced_by, criticality,
			       status, dialogue_id, turn_id, created_at
			FROM claims
			WHERE dialogue_id = ? AND status = 'OPEN'
		`
			)
			.all(dialogueId) as Claim[];

		if (openClaims.length === 0) {
			return {
				success: true,
				value: {
					phase: 'VERIFY' as Phase,
					success: true,
					nextPhase: 'HISTORICAL_CHECK' as Phase,
					metadata: { claimCount: 0 },
					timestamp: new Date().toISOString(),
				},
			};
		}

		// Verify each claim using resolved CLI provider
		const verifyCommandId = randomUUID();
		const verifyProvider = verifierProviderResult.value;
		const verifyCmdPreview = verifyProvider.getCommandPreview({ stdinContent: '<claim + context>', outputFormat: 'json' });
		emitWorkflowCommand({
			dialogueId,
			commandId: verifyCommandId,
			action: 'start',
			commandType: 'role_invocation',
			label: `Verifier — Checking ${openClaims.length} claims [${verifyProvider.name}]`,
			summary: `Verifying ${openClaims.length} open claim(s)`,
			status: 'running',
			timestamp: new Date().toISOString(),
		});
		if (verifyCmdPreview.success) {
			emitWorkflowCommand({
				dialogueId,
				commandId: verifyCommandId,
				action: 'output',
				commandType: 'role_invocation',
				label: 'Verifier',
				summary: `$ ${verifyCmdPreview.value}`,
				timestamp: new Date().toISOString(),
			});
		}

		const verificationResults = [];
		for (const claim of openClaims) {
			const claimPreview = claim.statement.length > 120
				? claim.statement.substring(0, 120) + '…'
				: claim.statement;

			emitWorkflowCommand({
				dialogueId,
				commandId: verifyCommandId,
				action: 'output',
				commandType: 'role_invocation',
				label: 'Verifier',
				summary: `Verifying: ${claimPreview}`,
				timestamp: new Date().toISOString(),
			});

			const result = await executeVerification({
				dialogueId,
				claim,
				provider: verifierProviderResult.value,
				tokenBudget: Math.max(2000, Math.floor(tokenBudget / openClaims.length)),
				includeHistoricalVerdicts: true,
				checkForContradictions: true,
				commandId: verifyCommandId,
			});

			if (result.success) {
				verificationResults.push(result.value);
				const verdictPreview = claim.statement.length > 100
					? claim.statement.substring(0, 100) + '…'
					: claim.statement;
				emitWorkflowCommand({
					dialogueId,
					commandId: verifyCommandId,
					action: 'output',
					commandType: 'role_invocation',
					label: 'Verifier',
					summary: `→ ${result.value.verdict.verdict}: ${verdictPreview}`,
					detail: result.value.verdict.rationale,
					timestamp: new Date().toISOString(),
				});
			} else {
				const errorMsg = result.error?.message ?? 'Unknown error';
				emitWorkflowCommand({
					dialogueId,
					commandId: verifyCommandId,
					action: 'output',
					commandType: 'role_invocation',
					label: 'Verifier',
					summary: `→ ERROR (invocation failed): ${claimPreview}`,
					detail: errorMsg,
					timestamp: new Date().toISOString(),
				});
			}
		}

		// Emit summary of all verdicts
		const verdictSummary = verificationResults
			.map((r) => {
				const stmt = r.claim.statement.length > 100
					? r.claim.statement.substring(0, 100) + '…'
					: r.claim.statement;
				return `• [${r.verdict.verdict}] ${stmt}`;
			})
			.join('\n');
		emitWorkflowCommand({
			dialogueId,
			commandId: verifyCommandId,
			action: 'output',
			commandType: 'role_invocation',
			label: 'Verifier',
			summary: `── Results (${verificationResults.length}/${openClaims.length}) ──`,
			detail: verdictSummary,
			timestamp: new Date().toISOString(),
		});

		emitWorkflowCommand({
			dialogueId,
			commandId: verifyCommandId,
			action: 'complete',
			commandType: 'role_invocation',
			label: `Verifier — ${verificationResults.length} verified`,
			summary: `Verified ${verificationResults.length}/${openClaims.length} claims`,
			status: 'success',
			timestamp: new Date().toISOString(),
		});

		// ── Verification failure gate ──
		// If ALL verification invocations failed (0 out of N verified),
		// the claims remain OPEN — which wouldn't trigger the standard
		// DISPROVED/UNKNOWN gate check. This is a governance gap: we must
		// not proceed to EXECUTE with entirely unverified assumptions.
		const failedCount = openClaims.length - verificationResults.length;
		if (verificationResults.length === 0 && openClaims.length > 0) {
			const failGateResult = createGate({
				dialogueId,
				reason:
					`Verification failed for all ${openClaims.length} claim(s). ` +
					`No assumptions were verified — the verifier invocations returned errors. ` +
					`Review the errors above and resolve before proceeding to EXECUTE.`,
				blockingClaims: openClaims.map(c => c.claim_id),
				metadata: {
					condition: GateTriggerCondition.VERIFICATION_FAILURE,
					failedClaimCount: openClaims.length,
				},
			});
			if (failGateResult.success && failGateResult.value) {
				emitWorkflowGateTriggered(dialogueId, failGateResult.value.gate_id, failGateResult.value.reason);
			}
			return {
				success: true,
				value: {
					phase: 'VERIFY' as Phase,
					success: true,
					gateTriggered: true,
					metadata: {
						verifiedCount: 0,
						failedCount,
						reason: 'All verification invocations failed',
					},
					timestamp: new Date().toISOString(),
				},
			};
		}

		// Verification results are surfaced at the REVIEW phase where the human
		// can see full context (verification + historian findings) before deciding.
		// No gate is created here — the workflow flows through HISTORICAL_CHECK to REVIEW.
		return {
			success: true,
			value: {
				phase: 'VERIFY' as Phase,
				success: true,
				nextPhase: 'HISTORICAL_CHECK' as Phase,
				gateTriggered: false,
				metadata: {
					verifiedCount: verificationResults.length,
					failedCount,
					blockingCount: verificationResults.filter((r) => r.isBlocking).length,
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
					: new Error('Failed to execute VERIFY phase'),
		};
	}
}

/**
 * Execute HISTORICAL_CHECK phase
 * Checks for contradictions and precedents
 *
 * @param dialogueId Dialogue ID
 * @param provider LLM provider for Historian-Interpreter
 * @param tokenBudget Token budget
 * @returns Result containing phase execution result
 */
export async function executeHistoricalCheckPhase(
	dialogueId: string,
	tokenBudget: number
): Promise<Result<PhaseExecutionResult>> {
	try {
		// Resolve CLI provider for Historian-Interpreter role
		const historianProviderResult = await resolveProviderForRole(Role.HISTORIAN);
		if (!historianProviderResult.success) {
			return historianProviderResult as Result<PhaseExecutionResult>;
		}

		// Invoke Historian-Interpreter for contradiction check
		const histCheckCommandId = randomUUID();
		const historianProvider = historianProviderResult.value;
		const histCmdPreview = historianProvider.getCommandPreview({ stdinContent: '<query + context>', outputFormat: 'json' });
		emitWorkflowCommand({
			dialogueId,
			commandId: histCheckCommandId,
			action: 'start',
			commandType: 'role_invocation',
			label: `Historian — Checking Precedents [${historianProvider.name}]`,
			summary: 'Searching for contradictions and relevant precedents',
			status: 'running',
			timestamp: new Date().toISOString(),
		});
		if (histCmdPreview.success) {
			emitWorkflowCommand({
				dialogueId,
				commandId: histCheckCommandId,
				action: 'output',
				commandType: 'role_invocation',
				label: 'Historian',
				summary: `$ ${histCmdPreview.value}`,
				timestamp: new Date().toISOString(),
			});
		}

		// ── Read claims + verdicts from DB for per-claim adjudication ──
		const db = getDatabase();
		const claims: Claim[] = db
			? (db.prepare('SELECT * FROM claims WHERE dialogue_id = ?').all(dialogueId) as Claim[])
			: [];
		const verdicts: Verdict[] = db
			? (db.prepare(
				'SELECT v.* FROM verdicts v JOIN claims c ON v.claim_id = c.claim_id WHERE c.dialogue_id = ?'
			).all(dialogueId) as Verdict[])
			: [];

		// ── Try per-claim adjudication first, fallback to generic query ──
		let findings: string[] = [];
		let adjudicationData: any = null;

		if (claims.length > 0) {
			const adjResult = await invokeHistorianAdjudication({
				dialogueId,
				claims,
				verdicts,
				tokenBudget,
				provider: historianProviderResult.value,
				commandId: histCheckCommandId,
			});

			if (adjResult.success) {
				adjudicationData = adjResult.value;
				findings = adjResult.value.general_findings ?? [];

				// Emit adjudication summary
				const adjCount = adjResult.value.claim_adjudications.length;
				const verdictCounts = adjResult.value.claim_adjudications.reduce((acc, a) => {
					acc[a.verdict] = (acc[a.verdict] || 0) + 1;
					return acc;
				}, {} as Record<string, number>);
				const verdictSummary = Object.entries(verdictCounts)
					.map(([v, c]) => `${c} ${v}`)
					.join(', ');

				emitWorkflowCommand({
					dialogueId,
					commandId: histCheckCommandId,
					action: 'output',
					commandType: 'role_invocation',
					label: 'Historian',
					summary: `── Adjudication (${adjCount} claims: ${verdictSummary}) ──`,
					detail: adjResult.value.summary,
					timestamp: new Date().toISOString(),
				});
			}
		}

		// Fallback to generic query if adjudication failed or no claims
		if (!adjudicationData) {
			const historianResult = await invokeHistorianInterpreter({
				dialogueId,
				query: 'Check for contradictions and relevant precedents',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget,
				provider: historianProviderResult.value,
				commandId: histCheckCommandId,
			});

			if (!historianResult.success) {
				emitWorkflowCommand({
					dialogueId,
					commandId: histCheckCommandId,
					action: 'error',
					commandType: 'role_invocation',
					label: 'Historian — Checking Precedents',
					summary: `Failed: ${historianResult.error.message}`,
					status: 'error',
					timestamp: new Date().toISOString(),
				});
				return historianResult as Result<PhaseExecutionResult>;
			}

			findings = historianResult.value.findings ?? [];
		}

		// Emit general findings as output
		if (findings.length > 0) {
			const findingsText = findings
				.map((f: any, i: number) => `${i + 1}. ${typeof f === 'string' ? f : JSON.stringify(f)}`)
				.join('\n');
			emitWorkflowCommand({
				dialogueId,
				commandId: histCheckCommandId,
				action: 'output',
				commandType: 'role_invocation',
				label: 'Historian',
				summary: `── Findings (${findings.length}) ──`,
				detail: findingsText,
				timestamp: new Date().toISOString(),
			});
		}

		emitWorkflowCommand({
			dialogueId,
			commandId: histCheckCommandId,
			action: 'complete',
			commandType: 'role_invocation',
			label: 'Historian — Consistency Adjudication',
			summary: adjudicationData
				? `Adjudicated ${adjudicationData.claim_adjudications.length} claim(s), ${findings.length} finding(s)`
				: `Found ${findings.length} finding(s)`,
			status: 'success',
			timestamp: new Date().toISOString(),
		});

		// ── Branch loop check ──
		// If we're in multi-option mode, store findings for the current branch
		// and loop back to ASSUMPTION_SURFACING for the next branch if any remain.
		const stateResult = getWorkflowState(dialogueId);
		if (stateResult.success) {
			const metadata = JSON.parse(stateResult.value.metadata);
			const branches: ProposalBranch[] | undefined = metadata.proposalBranches;
			const currentIdx: number | undefined = metadata.currentBranchIndex;

			if (branches && currentIdx !== undefined && branches.length > 1) {
				const branchLogger = isLoggerInitialized()
					? getLogger().child({ component: 'evaluator', dialogueId })
					: undefined;

				// Mark current branch as analyzed and store its findings + adjudication
				branches[currentIdx].status = 'analyzed';
				branches[currentIdx].historical_findings = findings;
				if (adjudicationData) {
					branches[currentIdx].historian_adjudication = adjudicationData;
				}

				const nextIdx = currentIdx + 1;

				if (nextIdx < branches.length) {
					// More branches — advance to next and loop back
					branches[nextIdx].status = 'analyzing';
					branchLogger?.info('Branch analysis complete, advancing to next branch', {
						completedBranch: branches[currentIdx].label,
						nextBranch: branches[nextIdx].label,
						progress: `${nextIdx + 1}/${branches.length}`,
					});

					updateWorkflowMetadata(dialogueId, {
						proposalBranches: branches,
						currentBranchIndex: nextIdx,
						cachedExecutorResponse: {
							proposal: branches[nextIdx].proposal,
							assumptions: metadata.originalAssumptions ?? [],
							artifacts: metadata.originalArtifacts ?? [],
							constraint_adherence_notes: metadata.originalConstraintNotes ?? [],
						},
					});

					return {
						success: true,
						value: {
							phase: 'HISTORICAL_CHECK' as Phase,
							success: true,
							nextPhase: 'ASSUMPTION_SURFACING' as Phase,
							metadata: {
								findings,
								branchCompleted: branches[currentIdx].label,
								branchesRemaining: branches.length - nextIdx,
							},
							timestamp: new Date().toISOString(),
						},
					};
				}

				// All branches analyzed — proceed to REVIEW
				branchLogger?.info('All branches analyzed — proceeding to REVIEW', {
					branchCount: branches.length,
					labels: branches.map((b) => b.label),
				});
				updateWorkflowMetadata(dialogueId, {
					proposalBranches: branches,
				});
			}
		}

		// Persist to workflow metadata so the review gate card can access them
		const metadataUpdate: Record<string, any> = {
			historical_findings: findings,
		};
		if (adjudicationData) {
			metadataUpdate.historian_adjudication = adjudicationData;
		}
		updateWorkflowMetadata(dialogueId, metadataUpdate);

		// ── MAKER: Create HistoricalInvariantPacket from findings ──
		createMakerHistoricalPacket(dialogueId, findings);

		return {
			success: true,
			value: {
				phase: 'HISTORICAL_CHECK' as Phase,
				success: true,
				nextPhase: 'REVIEW' as Phase,
				metadata: {
					findings: historianResult.value.findings,
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
					: new Error('Failed to execute HISTORICAL_CHECK phase'),
		};
	}
}

/**
 * Execute REVIEW phase
 * Triggers a human gate so the user can review before execution proceeds
 *
 * @param dialogueId Dialogue ID
 * @returns Result containing phase execution result
 */
export async function executeReviewPhase(
	dialogueId: string
): Promise<Result<PhaseExecutionResult>> {
	try {
		// Check for multi-option branches — include branch context in review gate
		let reviewReason = 'Human review required before execution proceeds';
		const stateResult = getWorkflowState(dialogueId);
		if (stateResult.success) {
			const metadata = JSON.parse(stateResult.value.metadata);
			const branches: ProposalBranch[] | undefined = metadata.proposalBranches;
			if (branches && branches.length > 1) {
				const branchSummary = branches
					.map((b, i) => `${i + 1}. ${b.label}: ${b.summary}`)
					.join('\n');
				reviewReason =
					`Multiple implementation options have been fully analyzed. ` +
					`Please review all ${branches.length} options and choose one to proceed with:\n${branchSummary}`;
			}
		}

		// Trigger a human review gate — workflow pauses until resolved
		const gateResult = createReviewGate(dialogueId, reviewReason);

		if (gateResult.success && gateResult.value) {
			emitWorkflowGateTriggered(dialogueId, gateResult.value.gate_id, gateResult.value.reason);

			return {
				success: true,
				value: {
					phase: 'REVIEW' as Phase,
					success: true,
					// No nextPhase — gate blocks advancement until resolved
					gateTriggered: true,
					metadata: { gateId: gateResult.value.gate_id },
					timestamp: new Date().toISOString(),
				},
			};
		}

		// If gate creation failed, still pause (fail-safe)
		return {
			success: true,
			value: {
				phase: 'REVIEW' as Phase,
				success: true,
				gateTriggered: true,
				metadata: { warning: 'Review gate creation failed, workflow paused as fail-safe' },
				timestamp: new Date().toISOString(),
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to execute REVIEW phase'),
		};
	}
}

/**
 * Execute EXECUTE phase
 * Invokes the configured CLI provider for the Executor role to execute the verified proposal.
 * Uses resolveProviderForRole() to dispatch to Claude Code CLI, Gemini CLI, Codex CLI, or API fallback.
 * Streams CLI activity events to the governed stream UI via emitCLIActivity().
 *
 * MAKER path: If a task graph exists for this dialogue, uses per-unit execution with
 * validation and bounded repair instead of monolithic execution.
 *
 * @param dialogueId Dialogue ID
 * @returns Result containing phase execution result
 */
export async function executeExecutePhase(
	dialogueId: string
): Promise<Result<PhaseExecutionResult>> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// ── MAKER: Check if task graph exists → per-unit execution path ──
		const graphResult = getTaskGraphForDialogue(dialogueId);
		if (graphResult.success && graphResult.value) {
			return executeMakerExecutePhase(dialogueId, graphResult.value.graph_id);
		}

		// ── Legacy monolithic execution path ──
		// Retrieve the cached proposal from workflow metadata
		const stateResult = getWorkflowState(dialogueId);
		if (!stateResult.success) {
			return stateResult as Result<PhaseExecutionResult>;
		}

		const metadata = JSON.parse(stateResult.value.metadata);
		const proposal = metadata.cachedExecutorResponse?.proposal ?? '';

		if (!proposal) {
			return {
				success: false,
				error: new Error('No proposal found in workflow metadata for execution'),
			};
		}

		// Resolve the CLI provider for the Executor role
		const providerResult = await resolveProviderForRole(Role.EXECUTOR);
		if (!providerResult.success) {
			return providerResult as Result<PhaseExecutionResult>;
		}

		const provider = providerResult.value;
		const goal = metadata.lastIntakeGoal ?? metadata.goal ?? '';

		// Capture phase-start timestamp BEFORE emitting any command events.
		// The dialogue turn uses this timestamp so that its phase milestone
		// sorts before the CLI command block items in the stream.
		const phaseStartTimestamp = new Date().toISOString();

		// Build stdin content: execution prompt + verified proposal
		const stdinContent = buildStdinContent(
			'Execute the following verified proposal. Apply all changes to the workspace.',
			`Dialogue: ${dialogueId}\nGoal: ${goal}\n\n---\n\nProposal:\n${proposal}`
		);

		// Emit command block start for the CLI execution
		const executeCommandId = randomUUID();
		const execCmdPreview = provider.getCommandPreview({ stdinContent, outputFormat: 'stream-json' });
		emitWorkflowCommand({
			dialogueId,
			commandId: executeCommandId,
			action: 'start',
			commandType: 'cli_invocation',
			label: `Executor CLI — Executing Proposal [${provider.name}]`,
			summary: `Goal: ${goal.substring(0, 120)}${goal.length > 120 ? '...' : ''}`,
			status: 'running',
			timestamp: new Date().toISOString(),
		});
		if (execCmdPreview.success) {
			emitWorkflowCommand({
				dialogueId,
				commandId: executeCommandId,
				action: 'output',
				commandType: 'cli_invocation',
				label: 'Executor CLI',
				summary: `$ ${execCmdPreview.value}`,
				timestamp: new Date().toISOString(),
			});
		}

		// Emit full stdin content for observability (expandable in command block UI)
		emitWorkflowCommand({
			dialogueId,
			commandId: executeCommandId,
			action: 'output',
			commandType: 'cli_invocation',
			label: 'Executor CLI',
			summary: '── stdin ──',
			detail: stdinContent,
			lineType: 'stdin',
			timestamp: new Date().toISOString(),
		});

		// Invoke with streaming for real-time progress in governed stream UI
		const executionResult = await provider.invokeStreaming(
			{
				stdinContent,
				outputFormat: 'stream-json',
			},
			(event) => {
				emitCLIActivity(dialogueId, {
					...event,
					role: Role.EXECUTOR,
					phase: 'EXECUTE' as Phase,
				});
			}
		);

		const turnId = await getNextTurnId(dialogueId);
		const completionTimestamp = new Date().toISOString();

		let executionSummary: string;
		if (executionResult.success) {
			const exitCode = executionResult.value.exitCode;
			const timeSeconds = (executionResult.value.executionTime / 1000).toFixed(1);
			executionSummary = exitCode === 0
				? `Execution completed successfully (exit code 0, ${timeSeconds}s).`
				: `Execution completed with non-zero exit code ${exitCode} (${timeSeconds}s).`;
			// Emit execution result output
			emitWorkflowCommand({
				dialogueId,
				commandId: executeCommandId,
				action: 'output',
				commandType: 'cli_invocation',
				label: 'Executor CLI',
				summary: `── Result: exit ${exitCode} (${executionResult.value.executionTime}ms) ──`,
				detail: executionResult.value.response?.substring(0, 3000) || '(no response text)',
				timestamp: completionTimestamp,
			});
		} else {
			executionSummary = `Execution failed: ${executionResult.error.message}`;
			emitWorkflowCommand({
				dialogueId,
				commandId: executeCommandId,
				action: 'output',
				commandType: 'cli_invocation',
				label: 'Executor CLI',
				summary: `── Error ──`,
				detail: executionResult.error.message,
				timestamp: completionTimestamp,
			});
		}

		// Determine if execution actually succeeded (process ran AND exit code 0)
		const cliExitCode = executionResult.success ? executionResult.value.exitCode : -1;
		const executionSucceeded = executionResult.success && cliExitCode === 0;

		// Emit final command block status so the UI shows Retry button on failure
		emitWorkflowCommand({
			dialogueId,
			commandId: executeCommandId,
			action: executionSucceeded ? 'complete' : 'error',
			commandType: 'cli_invocation',
			label: `Executor CLI — ${executionSucceeded ? 'Execution Complete' : 'Execution Failed'}`,
			summary: executionSucceeded
				? `Execution completed successfully`
				: `Execution failed (exit code ${cliExitCode}). Use the Retry button or send a message to retry.`,
			status: executionSucceeded ? 'success' : 'error',
			timestamp: completionTimestamp,
		});

		// Use phaseStartTimestamp for the dialogue turn so the milestone divider
		// (derived from the first turn in this phase) sorts before command blocks.
		db.prepare(
			`
			INSERT INTO dialogue_turns (
				turn_id, dialogue_id, role, phase, speech_act,
				content_ref, timestamp
			) VALUES (?, ?, ?, ?, ?, ?, ?)
		`
		).run(
			turnId,
			dialogueId,
			Role.EXECUTOR,
			'EXECUTE',
			'DECISION',
			executionSummary,
			phaseStartTimestamp
		);
		emitDialogueTurnAdded(dialogueId, turnId, Role.EXECUTOR);

		// Store execution result in metadata for VALIDATE phase
		updateWorkflowMetadata(dialogueId, {
			executionResult: executionResult.success
				? { success: executionSucceeded, exitCode: cliExitCode }
				: { success: false, error: executionResult.error.message },
		});

		// Narrative Curator: outcome snapshot after execution
		runNarrativeCuration(dialogueId, CurationMode.OUTCOME).catch((err) => {
			if (isLoggerInitialized()) {
				getLogger()
					.child({ component: 'curator' })
					.warn('Curator OUTCOME snapshot failed', {
						error: err instanceof Error ? err.message : String(err),
					});
			}
		});

		// Only advance to VALIDATE if execution succeeded.
		// On failure (non-zero exit code), stay in EXECUTE so the user can retry.
		// Set awaitingInput on failure to stop the workflow cycle loop.
		return {
			success: true,
			value: {
				phase: 'EXECUTE' as Phase,
				success: executionSucceeded,
				nextPhase: executionSucceeded ? ('VALIDATE' as Phase) : undefined,
				awaitingInput: !executionSucceeded,
				metadata: {
					executionSuccess: executionSucceeded,
					exitCode: cliExitCode,
				},
				timestamp: completionTimestamp,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to execute EXECUTE phase'),
		};
	}
}

/**
 * Execute VALIDATE phase
 * Validates execution results — checks whether execution succeeded.
 * MAKER path: runs acceptance contract validation (lint, type-check, test suite).
 *
 * @param dialogueId Dialogue ID
 * @returns Result containing phase execution result
 */
export async function executeValidatePhase(
	dialogueId: string
): Promise<Result<PhaseExecutionResult>> {
	try {
		const stateResult = getWorkflowState(dialogueId);
		if (!stateResult.success) {
			return stateResult as Result<PhaseExecutionResult>;
		}

		const metadata = JSON.parse(stateResult.value.metadata);
		const execResult = metadata.executionResult;

		const now = new Date().toISOString();

		if (execResult && !execResult.success) {
			// Execution failed — trigger a gate for human decision on how to proceed
			const gateResult = createReviewGate(
				dialogueId,
				`Execution failed: ${execResult.error ?? 'unknown error'}. Human decision required.`
			);

			if (gateResult.success && gateResult.value) {
				emitWorkflowGateTriggered(dialogueId, gateResult.value.gate_id, gateResult.value.reason);
			}

			return {
				success: true,
				value: {
					phase: 'VALIDATE' as Phase,
					success: true,
					gateTriggered: true,
					metadata: { validationPassed: false, reason: execResult.error },
					timestamp: now,
				},
			};
		}

		// ── MAKER: Acceptance contract validation ──
		const contractValidation = await runMakerContractValidation(dialogueId);
		if (contractValidation.gateTriggered) {
			return {
				success: true,
				value: {
					phase: 'VALIDATE' as Phase,
					success: true,
					gateTriggered: true,
					metadata: { validationPassed: false, reason: contractValidation.reason },
					timestamp: now,
				},
			};
		}

		// Execution succeeded (or no result recorded) — proceed to COMMIT
		return {
			success: true,
			value: {
				phase: 'VALIDATE' as Phase,
				success: true,
				nextPhase: 'COMMIT' as Phase,
				metadata: { validationPassed: true },
				timestamp: now,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to execute VALIDATE phase'),
		};
	}
}

/**
 * Execute COMMIT phase
 * Commits the work and records completion
 *
 * @param dialogueId Dialogue ID
 * @returns Result containing phase execution result
 */
export async function executeCommitPhase(
	dialogueId: string
): Promise<Result<PhaseExecutionResult>> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const turnId = await getNextTurnId(dialogueId);
		const now = new Date().toISOString();

		db.prepare(
			`
			INSERT INTO dialogue_turns (
				turn_id, dialogue_id, role, phase, speech_act,
				content_ref, timestamp
			) VALUES (?, ?, ?, ?, ?, ?, ?)
		`
		).run(
			turnId,
			dialogueId,
			'SYSTEM' as any,
			'COMMIT',
			'DECISION',
			'Workflow completed',
			now
		);
		emitDialogueTurnAdded(dialogueId, turnId, 'SYSTEM');

		// ── MAKER: Record OutcomeSnapshot ──
		recordMakerOutcomeSnapshot(dialogueId);

		return {
			success: true,
			value: {
				phase: 'COMMIT' as Phase,
				success: true,
				// No nextPhase — workflow is complete. The cycle loop detects
				// completion via phase === COMMIT and calls completeDialogue().
				metadata: { completed: true },
				timestamp: now,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to execute COMMIT phase'),
		};
	}
}

/**
 * Get next turn ID
 * Generates the next turn ID for a dialogue
 */
async function getNextTurnId(dialogueId: string): Promise<number> {
	const db = getDatabase();
	if (!db) {
		throw new Error('Database not initialized');
	}

	const result = db
		.prepare(
			`
		SELECT MAX(turn_id) as maxTurnId
		FROM dialogue_turns
		WHERE dialogue_id = ?
	`
		)
		.get(dialogueId) as { maxTurnId: number | null };

	return (result.maxTurnId ?? 0) + 1;
}

/**
 * Format an approved INTAKE plan as a rich structured prompt for the Executor.
 * Replaces the raw goal string with a comprehensive plan document.
 */
function formatApprovedPlanForExecutor(
	originalGoal: string,
	plan: Record<string, unknown>
): string {
	const sections: string[] = [];

	sections.push('# Approved Implementation Plan');
	sections.push(`## Original Goal\n\n${originalGoal}`);

	if (plan.title) {
		sections.push(`## Plan: ${plan.title}`);
	}
	if (plan.summary) {
		sections.push(`## Summary\n\n${plan.summary}`);
	}

	const requirements = plan.requirements as Array<{ id: string; text: string }> | undefined;
	if (requirements && requirements.length > 0) {
		sections.push(
			'## Requirements\n\n' +
				requirements.map((r) => `- [${r.id}] ${r.text}`).join('\n')
		);
	}

	const decisions = plan.decisions as Array<{ id: string; text: string }> | undefined;
	if (decisions && decisions.length > 0) {
		sections.push(
			'## Decisions Made\n\n' +
				decisions.map((d) => `- [${d.id}] ${d.text}`).join('\n')
		);
	}

	const constraints = plan.constraints as Array<{ id: string; text: string }> | undefined;
	if (constraints && constraints.length > 0) {
		sections.push(
			'## Constraints\n\n' +
				constraints.map((c) => `- [${c.id}] ${c.text}`).join('\n')
		);
	}

	const technicalNotes = plan.technicalNotes as string[] | undefined;
	if (technicalNotes && technicalNotes.length > 0) {
		sections.push(
			'## Technical Notes\n\n' +
				technicalNotes.map((n) => `- ${n}`).join('\n')
		);
	}

	if (plan.proposedApproach) {
		sections.push(`## Proposed Approach\n\n${plan.proposedApproach}`);
	}

	// Domain coverage gap enrichment (Adaptive Deep INTAKE)
	const domainCoverage = plan.domainCoverage as DomainCoverageMap | undefined;
	if (domainCoverage) {
		const gaps = getCoverageGaps(domainCoverage);
		if (gaps.length > 0) {
			sections.push(
				'## Domain Coverage Gaps (from INTAKE)\n\n' +
				'The following engineering domains had limited coverage during INTAKE. ' +
				'Generate explicit assumptions for these areas:\n\n' +
				gaps.map(d => `- **${DOMAIN_INFO[d].label}**: ${DOMAIN_INFO[d].description}`).join('\n')
			);
		}
	}

	sections.push(
		'\n---\n\nImplement this plan. Generate a concrete proposal with assumptions.'
	);

	return sections.join('\n\n');
}

// ==================== ADAPTIVE DEEP INTAKE HELPERS ====================

/**
 * Initialize the Adaptive Deep INTAKE on first turn:
 * - Run the LLM-backed classifier (falls back to heuristics)
 * - Auto-select mode and initialize coverage map
 * - Emit classifier result and mode selection events
 */
async function initializeAdaptiveIntake(
	dialogueId: string,
	humanInput: string,
	attachments: string[],
): Promise<void> {
	try {
		const recommendation = await classifyIntakeInput(humanInput, attachments, dialogueId);

		// Initialize coverage map and set mode
		const coverageMap = initializeCoverageMap();

		// STATE_DRIVEN and DOMAIN_GUIDED use inverted flow (ANALYZING → PROPOSING → CLARIFYING)
		// HYBRID_CHECKPOINTS uses the original flow (DISCUSSING)
		const needsAnalysis = recommendation.recommended === IntakeMode.STATE_DRIVEN
			|| recommendation.recommended === IntakeMode.DOMAIN_GUIDED;
		const currentDomain = null; // No sequential domain walk in inverted flow
		const initialSubState = needsAnalysis
			? IntakeSubState.ANALYZING
			: IntakeSubState.DISCUSSING;

		// Persist to DB
		updateIntakeConversation(dialogueId, {
			intakeMode: recommendation.recommended,
			domainCoverage: coverageMap,
			currentDomain,
			checkpoints: [],
			classifierResult: recommendation,
			subState: initialSubState,
			clarificationRound: 0,
		});

		// Emit events
		getEventBus().emit('intake:classifier_result', {
			dialogueId,
			recommendation,
		});
		getEventBus().emit('intake:mode_selected', {
			dialogueId,
			mode: recommendation.recommended,
			source: 'classifier',
		});
		getEventBus().emit('intake:domain_coverage_updated', {
			dialogueId,
			coverage: coverageMap,
		});

		if (isLoggerInitialized()) {
			getLogger().child({ component: 'orchestrator:intake' }).info(
				`Adaptive INTAKE initialized: mode=${recommendation.recommended}, confidence=${recommendation.confidence}`,
				{ dialogueId, recommendation },
			);
		}
	} catch (error) {
		// Non-fatal: if classifier fails, conversation proceeds without adaptive mode
		if (isLoggerInitialized()) {
			getLogger().child({ component: 'orchestrator:intake' }).warn(
				'Failed to initialize adaptive INTAKE — proceeding without domain tracking',
				{ dialogueId, error: error instanceof Error ? error.message : String(error) },
			);
		}
	}
}

// ==================== MAKER HELPER FUNCTIONS ====================
// These functions are called from the main phase functions above.
// They encapsulate MAKER-specific logic to keep the phase functions clean.

/**
 * Create IntentRecord + AcceptanceContract from approved INTAKE plan.
 * Called at the end of plan approval in INTAKE phase.
 */
function createMakerIntentAndContract(dialogueId: string): void {
	const logger = isLoggerInitialized()
		? getLogger().child({ component: 'maker:intake', dialogueId })
		: undefined;

	try {
		const stateResult = getWorkflowState(dialogueId);
		if (!stateResult.success) { return; }

		const metadata = JSON.parse(stateResult.value.metadata);
		const plan = metadata.approvedIntakePlan;
		const goal = metadata.lastIntakeGoal ?? metadata.goal ?? '';

		if (!plan) { return; }

		// Extract structured data from the approved plan
		const requirements = (plan.requirements as Array<{ id: string; text: string }>) ?? [];
		const constraints = (plan.constraints as Array<{ id: string; text: string }>) ?? [];

		// Create IntentRecord
		const scopeIn = requirements.map((r: { id: string; text: string }) => r.text);
		const scopeOut = constraints
			.filter((c: { id: string; text: string }) => c.text.toLowerCase().includes('out of scope'))
			.map((c: { id: string; text: string }) => c.text);

		const intentResult = createIntentRecord(dialogueId, goal, {
			scope_in: scopeIn,
			scope_out: scopeOut,
			priority_axes: [],
			risk_posture: 'BALANCED',
		});

		if (!intentResult.success) {
			logger?.warn('Failed to create IntentRecord', { error: intentResult.error.message });
			return;
		}

		// Detect toolchains for validation requirements
		const workspaceRoot = getWorkspaceRoot();
		let validationReqs: Array<{ type: string; command?: string; description: string }> = [];
		if (workspaceRoot) {
			// Fire-and-forget: detect toolchains async (don't block plan approval)
			detectToolchains(workspaceRoot).then((tcResult) => {
				if (tcResult.success) {
					logger?.info('Toolchains detected', { count: tcResult.value.length });
				}
			}).catch(() => {});

			// Build basic validation requirements from common commands
			validationReqs = [
				{ type: 'TYPE_CHECK', description: 'Type checking passes' },
				{ type: 'BUILD', description: 'Build succeeds' },
			];
		}

		// Create AcceptanceContract
		const successConditions = requirements.map((r: { id: string; text: string }) => r.text);
		const nonGoals = scopeOut;

		const contractResult = createAcceptanceContract(
			intentResult.value.intent_id,
			dialogueId,
			{
				success_conditions: successConditions,
				required_validations: validationReqs,
				non_goals: nonGoals,
				human_judgment_required: [],
			}
		);

		if (!contractResult.success) {
			logger?.warn('Failed to create AcceptanceContract', { error: contractResult.error.message });
			return;
		}

		// Store IDs in workflow metadata
		updateWorkflowMetadata(dialogueId, {
			intent_id: intentResult.value.intent_id,
			contract_id: contractResult.value.contract_id,
		});

		logger?.info('MAKER IntentRecord + AcceptanceContract created', {
			intentId: intentResult.value.intent_id,
			contractId: contractResult.value.contract_id,
		});
	} catch (err) {
		logger?.warn('MAKER intent/contract creation failed', {
			error: err instanceof Error ? err.message : String(err),
		});
	}
}

/**
 * Attempt task graph decomposition after PROPOSE evaluator returns PROCEED.
 * Returns decomposition result — no-op if no intent record exists.
 */
async function attemptMakerDecomposition(
	dialogueId: string,
	goal: string,
	provider: import('../cli/roleCLIProvider').RoleCLIProvider
): Promise<{ graphId?: string; gateTriggered?: boolean; issue?: string }> {
	const logger = isLoggerInitialized()
		? getLogger().child({ component: 'maker:decompose', dialogueId })
		: undefined;

	try {
		// Check if intent record exists (MAKER path is active)
		const intentResult = getIntentRecordForDialogue(dialogueId);
		if (!intentResult.success || !intentResult.value) {
			return {}; // No intent record — non-MAKER path
		}

		const contractResult = getAcceptanceContractForDialogue(dialogueId);
		if (!contractResult.success || !contractResult.value) {
			return {}; // No contract — non-MAKER path
		}

		const intent = intentResult.value;
		const contract = contractResult.value;

		// Build historical context for decomposition
		const historicalCtx = await buildMakerPlannerContext({
			dialogueId,
			intentRecord: intent,
			contract,
			tokenBudget: 4000,
		});
		const historicalContext = historicalCtx.success ? historicalCtx.value : '';

		const workspaceRoot = getWorkspaceRoot() ?? '.';

		// Invoke decomposer
		const decompResult = await decomposeGoalIntoTaskGraph(
			intent,
			contract,
			historicalContext,
			dialogueId,
			provider,
			workspaceRoot
		);

		if (!decompResult.success) {
			logger?.warn('Decomposition failed', { error: decompResult.error.message });
			// Non-fatal — workflow continues on monolithic path
			return {};
		}

		const { graph, units, edges } = decompResult.value;

		// Quality check
		const qualityReport = checkDecompositionQuality(units, edges);
		if (!qualityReport.is_acceptable) {
			logger?.warn('Decomposition quality failed', {
				issues: qualityReport.issues,
				unitCount: qualityReport.unit_count,
			});
			// Create gate for human review of decomposition
			const gateResult = createReviewGate(
				dialogueId,
				`Task graph decomposition quality issues:\n${qualityReport.issues.map((i) => `• ${i}`).join('\n')}\n\nPlease review and approve or request re-decomposition.`
			);
			if (gateResult.success && gateResult.value) {
				emitWorkflowGateTriggered(dialogueId, gateResult.value.gate_id, gateResult.value.reason);
			}
			return { gateTriggered: true, issue: qualityReport.issues.join('; ') };
		}

		// Store graph_id in metadata
		updateWorkflowMetadata(dialogueId, {
			graph_id: graph.graph_id,
		});

		logger?.info('Task graph decomposition complete', {
			graphId: graph.graph_id,
			unitCount: units.length,
			edgeCount: edges.length,
		});

		return { graphId: graph.graph_id };
	} catch (err) {
		logger?.warn('MAKER decomposition failed', {
			error: err instanceof Error ? err.message : String(err),
		});
		return {};
	}
}

/**
 * Extract ClaimUnits from task graph units during ASSUMPTION_SURFACING.
 * Each unit's observables + falsifiers become claim_units in the DB.
 */
function extractMakerClaimUnits(dialogueId: string): void {
	const logger = isLoggerInitialized()
		? getLogger().child({ component: 'maker:claims', dialogueId })
		: undefined;

	try {
		const graphResult = getTaskGraphForDialogue(dialogueId);
		if (!graphResult.success || !graphResult.value) { return; }

		const taskUnitsResult = getTaskUnitsForGraph(graphResult.value.graph_id);
		if (!taskUnitsResult.success) { return; }

		let claimCount = 0;
		for (const unit of taskUnitsResult.value) {
			// Observables → ATOMIC claims
			for (const observable of unit.observables) {
				createClaimUnit(unit.unit_id, observable, 'ATOMIC', unit.falsifiers, []);
				claimCount++;
			}
		}

		logger?.info('MAKER claim units extracted from task graph', { claimCount });
	} catch (err) {
		logger?.warn('MAKER claim extraction failed', {
			error: err instanceof Error ? err.message : String(err),
		});
	}
}

/**
 * Create HistoricalInvariantPacket from historian findings.
 * Called at the end of HISTORICAL_CHECK phase.
 */
function createMakerHistoricalPacket(dialogueId: string, findings: unknown[]): void {
	const logger = isLoggerInitialized()
		? getLogger().child({ component: 'maker:historical', dialogueId })
		: undefined;

	try {
		if (!findings || findings.length === 0) { return; }

		// Classify findings into invariants, failure motifs, and patterns
		const invariants: string[] = [];
		const failureMotifs: string[] = [];
		const patterns: string[] = [];

		for (const finding of findings) {
			const text = typeof finding === 'string' ? finding : JSON.stringify(finding);
			const lower = text.toLowerCase();

			if (lower.includes('must') || lower.includes('always') || lower.includes('never') || lower.includes('invariant')) {
				invariants.push(text);
			} else if (lower.includes('fail') || lower.includes('error') || lower.includes('broke') || lower.includes('issue')) {
				failureMotifs.push(text);
			} else {
				patterns.push(text);
			}
		}

		createHistoricalInvariantPacket(dialogueId, {
			relevant_invariants: invariants,
			prior_failure_motifs: failureMotifs,
			precedent_patterns: patterns,
			reusable_subplans: [],
		});

		logger?.info('MAKER historical invariant packet created', {
			invariants: invariants.length,
			failureMotifs: failureMotifs.length,
			patterns: patterns.length,
		});
	} catch (err) {
		logger?.warn('MAKER historical packet creation failed', {
			error: err instanceof Error ? err.message : String(err),
		});
	}
}

/**
 * MAKER per-unit execution loop.
 * Executes task units in dependency order with validation and bounded repair.
 */
async function executeMakerExecutePhase(
	dialogueId: string,
	graphId: string
): Promise<Result<PhaseExecutionResult>> {
	const logger = isLoggerInitialized()
		? getLogger().child({ component: 'maker:execute', dialogueId, graphId })
		: undefined;

	const phaseStartTimestamp = new Date().toISOString();
	const workspaceRoot = getWorkspaceRoot() ?? '.';
	const overridesMap: Record<string, import('../cli/providerCapabilities').ProviderCapabilityOverrides | null> = {};
	for (const pid of ['claude-code', 'codex-cli', 'gemini-cli']) {
		overridesMap[pid] = getProviderCapabilityOverrides(pid);
	}
	const profiles = getAllProviderProfiles(overridesMap);

	// Load toolchains for validation
	const toolchainsResult = await detectToolchains(workspaceRoot);
	const toolchains: ToolchainDetection[] = toolchainsResult.success ? toolchainsResult.value : [];

	// Load acceptance contract (if any)
	const contractResult = getAcceptanceContractForDialogue(dialogueId);
	const contract: AcceptanceContract | null = contractResult.success ? contractResult.value : null;

	// Update graph status
	updateTaskGraphStatus(graphId, 'IN_PROGRESS');

	// Reset any units stuck in IN_PROGRESS/VALIDATING/REPAIRING from a prior
	// killed or cancelled execution. Without this, those units would be invisible
	// to getNextReadyUnits() and cause a deadlock.
	const staleReset = resetStaleInProgressUnits(graphId);
	if (staleReset.success && staleReset.value > 0) {
		logger?.warn(`Reset ${staleReset.value} stale in-progress unit(s) to READY`);
	}

	// Get ready units and process them
	const readyResult = getNextReadyUnits(graphId);
	if (!readyResult.success || readyResult.value.length === 0) {
		// Check if graph is already complete
		const completeResult = isGraphComplete(graphId);
		if (completeResult.success && completeResult.value) {
			updateTaskGraphStatus(graphId, 'COMPLETED');
			return {
				success: true,
				value: {
					phase: 'EXECUTE' as Phase,
					success: true,
					nextPhase: 'VALIDATE' as Phase,
					metadata: { makerPath: true, graphComplete: true },
					timestamp: new Date().toISOString(),
				},
			};
		}
		return {
			success: false,
			error: new Error('No ready units available and graph is not complete'),
		};
	}

	let gateTriggered = false;
	let unitsCompleted = 0;

	for (const unit of readyResult.value) {
		if (gateTriggered) { break; }

		const unitCommandId = randomUUID();
		emitWorkflowCommand({
			dialogueId,
			commandId: unitCommandId,
			action: 'start',
			commandType: 'cli_invocation',
			label: `Executor — Unit: ${unit.label}`,
			summary: unit.goal.substring(0, 120),
			status: 'running',
			timestamp: new Date().toISOString(),
		});

		// Mark unit as IN_PROGRESS
		updateTaskUnitStatus(unit.unit_id, 'IN_PROGRESS');
		updateWorkflowMetadata(dialogueId, { current_unit_id: unit.unit_id });

		// Route to best provider
		let unitProvider: import('../cli/roleCLIProvider').RoleCLIProvider;
		const routeResult = await routeTaskToProvider(unit, profiles);
		if (routeResult.success) {
			unitProvider = routeResult.value;
		} else {
			// Fallback to default executor provider
			const fallbackProvider = await resolveProviderForRole(Role.EXECUTOR);
			if (!fallbackProvider.success) {
				updateTaskUnitStatus(unit.unit_id, 'FAILED');
				continue;
			}
			unitProvider = fallbackProvider.value;
		}

		// Build unit context
		const intentResult = getIntentRecordForDialogue(dialogueId);
		let unitContext = '';
		if (intentResult.success && intentResult.value && contract) {
			const ctxResult = await buildMakerPlannerContext({
				dialogueId,
				intentRecord: intentResult.value,
				contract,
				tokenBudget: 3000,
			});
			unitContext = ctxResult.success ? ctxResult.value : '';
		}

		// Execute unit
		const execResult = await invokeExecutorForUnit({
			dialogueId,
			unit,
			context: unitContext,
			provider: unitProvider,
			commandId: unitCommandId,
		});

		if (!execResult.success || !execResult.value.success) {
			const errorMsg = execResult.success
				? `Exit code ${execResult.value.exitCode}`
				: execResult.error.message;
			emitWorkflowCommand({
				dialogueId,
				commandId: unitCommandId,
				action: 'error',
				commandType: 'cli_invocation',
				label: `Executor — Unit: ${unit.label}`,
				summary: `Execution failed: ${errorMsg}`,
				status: 'error',
				timestamp: new Date().toISOString(),
			});
			updateTaskUnitStatus(unit.unit_id, 'FAILED');
			gateTriggered = true;
			await createEnrichedRepairEscalationGate(
				dialogueId, unit.unit_id, 'runtime_error',
				`Unit execution failed: ${errorMsg}`, unit.label,
				execResult.value?.response ?? '', unit.goal,
			);
			break;
		}

		// Validate unit output
		updateTaskUnitStatus(unit.unit_id, 'VALIDATING');
		const validationResult = await runUnitValidation(unit, toolchains, contract, workspaceRoot);

		if (validationResult.success && validationResult.value.pass_fail) {
			// Validation passed
			updateTaskUnitStatus(unit.unit_id, 'COMPLETED');
			completeUnitAndPropagate(graphId, unit.unit_id);
			unitsCompleted++;

			emitWorkflowCommand({
				dialogueId,
				commandId: unitCommandId,
				action: 'complete',
				commandType: 'cli_invocation',
				label: `Executor — Unit: ${unit.label}`,
				summary: `Completed and validated`,
				status: 'success',
				timestamp: new Date().toISOString(),
			});
		} else {
			// Validation failed — attempt bounded repair
			const failureType = validationResult.success
				? classifyFailureType(validationResult.value.checks)
				: 'unknown' as import('../types/maker').FailureType;

			const existingRepairsResult = getRepairPacketsForUnit(unit.unit_id);
			const existingRepairs: RepairPacket[] = existingRepairsResult.success ? existingRepairsResult.value : [];

			const classification = classifyRepairability(failureType, unit, existingRepairs);
			const canRepair = canAttemptRepair(unit, existingRepairs, Date.parse(phaseStartTimestamp));

			if (classification === RepairClassification.AUTO_REPAIR_SAFE && canRepair.allowed) {
				updateTaskUnitStatus(unit.unit_id, 'REPAIRING');
				updateWorkflowMetadata(dialogueId, { repair_active: true });

				const repairResult = await attemptRepair(
					unit,
					validationResult.success ? validationResult.value : { validation_id: '', unit_id: unit.unit_id, checks: [], expected_observables: [], actual_observables: [], pass_fail: false, created_at: '' } as ValidationPacket,
					classification,
					unitProvider,
					workspaceRoot
				);

				updateWorkflowMetadata(dialogueId, { repair_active: false });

				if (repairResult.success && repairResult.value.result === 'FIXED') {
					// Re-validate after repair
					const revalidation = await runUnitValidation(unit, toolchains, contract, workspaceRoot);
					if (revalidation.success && revalidation.value.pass_fail) {
						updateTaskUnitStatus(unit.unit_id, 'COMPLETED');
						completeUnitAndPropagate(graphId, unit.unit_id);
						unitsCompleted++;
						emitWorkflowCommand({
							dialogueId,
							commandId: unitCommandId,
							action: 'complete',
							commandType: 'cli_invocation',
							label: `Executor — Unit: ${unit.label}`,
							summary: `Repaired and validated`,
							status: 'success',
							timestamp: new Date().toISOString(),
						});
						continue;
					}
				}
				// Repair failed or re-validation failed — escalate
				updateTaskUnitStatus(unit.unit_id, 'FAILED');
				gateTriggered = true;
				await createEnrichedRepairEscalationGate(
					dialogueId, unit.unit_id, failureType,
					`Auto-repair failed for unit "${unit.label}"`, unit.label,
					execResult.value?.response ?? '', unit.goal,
				);
			} else {
				// Cannot auto-repair — escalate immediately
				updateTaskUnitStatus(unit.unit_id, 'FAILED');
				gateTriggered = true;
				const reason = classification === RepairClassification.ESCALATE_REQUIRED
					? `Failure type "${failureType}" requires human intervention`
					: canRepair.reason ?? 'Repair budget exhausted';
				await createEnrichedRepairEscalationGate(
					dialogueId, unit.unit_id, failureType,
					`${reason} (unit: "${unit.label}")`, unit.label,
					execResult.value?.response ?? '', unit.goal,
				);
			}

			emitWorkflowCommand({
				dialogueId,
				commandId: unitCommandId,
				action: 'error',
				commandType: 'cli_invocation',
				label: `Executor — Unit: ${unit.label}`,
				summary: `Validation failed: ${failureType}`,
				status: 'error',
				timestamp: new Date().toISOString(),
			});
		}
	}

	// Check if entire graph is complete
	const graphComplete = isGraphComplete(graphId);
	if (graphComplete.success && graphComplete.value) {
		updateTaskGraphStatus(graphId, 'COMPLETED');
	}

	const progress = getGraphProgress(graphId);

	// Store execution result in metadata
	updateWorkflowMetadata(dialogueId, {
		current_unit_id: undefined,
		executionResult: { success: !gateTriggered, makerPath: true },
	});

	return {
		success: true,
		value: {
			phase: 'EXECUTE' as Phase,
			success: !gateTriggered,
			nextPhase: (!gateTriggered && graphComplete.success && graphComplete.value)
				? 'VALIDATE' as Phase
				: undefined,
			gateTriggered,
			awaitingInput: gateTriggered,
			metadata: {
				makerPath: true,
				unitsCompleted,
				progress: progress.success ? progress.value : undefined,
			},
			timestamp: new Date().toISOString(),
		},
	};
}

/**
 * Run acceptance contract validation during VALIDATE phase.
 * If no contract exists, returns no-op result (passes through).
 */
async function runMakerContractValidation(
	dialogueId: string
): Promise<{ gateTriggered: boolean; reason?: string }> {
	const logger = isLoggerInitialized()
		? getLogger().child({ component: 'maker:validate', dialogueId })
		: undefined;

	try {
		const contractResult = getAcceptanceContractForDialogue(dialogueId);
		if (!contractResult.success || !contractResult.value) {
			return { gateTriggered: false }; // No contract — skip
		}

		const contract = contractResult.value;
		if (contract.required_validations.length === 0) {
			return { gateTriggered: false }; // No validations required
		}

		const workspaceRoot = getWorkspaceRoot() ?? '.';
		const toolchainsResult = await detectToolchains(workspaceRoot);
		const toolchains: ToolchainDetection[] = toolchainsResult.success ? toolchainsResult.value : [];

		// Run a "whole-project" validation by creating a synthetic unit with no scope restriction
		const syntheticUnit: TaskUnit = {
			unit_id: 'contract-validation',
			graph_id: '',
			label: 'Acceptance Contract Validation',
			goal: 'Validate acceptance contract conditions',
			category: 'TEST',
			inputs: [],
			outputs: [],
			preconditions: [],
			postconditions: contract.success_conditions,
			allowed_tools: [],
			preferred_provider: null,
			max_change_scope: null,
			observables: contract.success_conditions,
			falsifiers: [],
			verification_method: 'automated',
			status: 'IN_PROGRESS',
			parent_unit_id: null,
			sort_order: 0,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		const validationResult = await runUnitValidation(syntheticUnit, toolchains, contract, workspaceRoot);

		if (!validationResult.success || !validationResult.value.pass_fail) {
			const failedChecks = validationResult.success
				? validationResult.value.checks.filter((c) => !c.passed).map((c) => `${c.check_type}: ${c.stdout_excerpt}`).join('; ')
				: validationResult.error.message;

			logger?.warn('Acceptance contract validation failed', { failedChecks });

			const gateResult = createReviewGate(
				dialogueId,
				`Acceptance contract validation failed:\n${failedChecks}\n\nReview and decide how to proceed.`
			);
			if (gateResult.success && gateResult.value) {
				emitWorkflowGateTriggered(dialogueId, gateResult.value.gate_id, gateResult.value.reason);
			}

			return { gateTriggered: true, reason: failedChecks };
		}

		logger?.info('Acceptance contract validation passed');
		return { gateTriggered: false };
	} catch (err) {
		logger?.warn('MAKER contract validation failed', {
			error: err instanceof Error ? err.message : String(err),
		});
		return { gateTriggered: false }; // Non-fatal
	}
}

/**
 * Record OutcomeSnapshot during COMMIT phase.
 * Aggregates execution data from the task graph and repairs.
 */
function recordMakerOutcomeSnapshot(dialogueId: string): void {
	const logger = isLoggerInitialized()
		? getLogger().child({ component: 'maker:outcome', dialogueId })
		: undefined;

	try {
		const graphResult = getTaskGraphForDialogue(dialogueId);
		if (!graphResult.success || !graphResult.value) { return; }

		const graph = graphResult.value;
		const progress = getGraphProgress(graph.graph_id);

		createOutcomeSnapshot(dialogueId, graph.graph_id, {
			providers_used: [],
			augmentations_used: [],
			success: graph.graph_status === 'COMPLETED',
			failure_modes: [],
			useful_invariants: [],
			units_completed: progress.success ? progress.value.completed : 0,
			units_total: progress.success ? progress.value.total : 0,
			total_wall_clock_ms: 0, // TODO: track wall clock time across units
		});

		logger?.info('MAKER outcome snapshot recorded', {
			graphId: graph.graph_id,
			success: graph.graph_status === 'COMPLETED',
		});
	} catch (err) {
		logger?.warn('MAKER outcome snapshot failed', {
			error: err instanceof Error ? err.message : String(err),
		});
	}
}

/**
 * Advance workflow to next phase
 * Orchestrates automatic phase advancement
 *
 * @param dialogueId Dialogue ID
 * @param llmConfig LLM configuration
 * @param tokenBudget Token budget
 * @returns Result containing phase execution result
 */
export async function advanceWorkflow(
	dialogueId: string,
	providers?: WorkflowProviders,
	tokenBudget: number = 10000
): Promise<Result<PhaseExecutionResult>> {
	try {
		// Get current workflow state
		const stateResult = getWorkflowState(dialogueId);
		if (!stateResult.success) {
			return stateResult as Result<PhaseExecutionResult>;
		}

		const currentPhase = stateResult.value.current_phase as Phase;

		// Check for open gates
		const gatesResult = hasOpenGates(dialogueId);
		if (gatesResult.success && gatesResult.value) {
			return {
				success: false,
				error: new Error('Cannot advance: workflow has open gates'),
			};
		}

		// Execute current phase
		let phaseResult: Result<PhaseExecutionResult>;

		switch (currentPhase) {
			case 'INTAKE': {
				const metadata = JSON.parse(stateResult.value.metadata);
				const humanInput =
					metadata.pendingIntakeInput ?? metadata.goal ?? '';
				phaseResult = await executeIntakePhase(
					dialogueId,
					humanInput
				);
				// Clear pendingIntakeInput after consumption
				if (metadata.pendingIntakeInput) {
					updateWorkflowMetadata(dialogueId, {
						pendingIntakeInput: undefined,
					});
				}
				break;
			}
			case 'PROPOSE':
				phaseResult = await executeProposePhase(
					dialogueId,
					tokenBudget
				);
				break;
			case 'ASSUMPTION_SURFACING':
				phaseResult = await executeAssumptionSurfacingPhase(
					dialogueId,
					tokenBudget
				);
				break;
			case 'VERIFY':
				phaseResult = await executeVerifyPhase(
					dialogueId,
					tokenBudget
				);
				break;
			case 'HISTORICAL_CHECK':
				phaseResult = await executeHistoricalCheckPhase(
					dialogueId,
					tokenBudget
				);
				break;
			case 'REVIEW':
				phaseResult = await executeReviewPhase(dialogueId);
				break;
			case 'EXECUTE':
				phaseResult = await executeExecutePhase(dialogueId);
				break;
			case 'VALIDATE':
				phaseResult = await executeValidatePhase(dialogueId);
				break;
			case 'COMMIT':
				phaseResult = await executeCommitPhase(dialogueId);
				break;
			case 'REPLAN': {
				// REPLAN is a pass-through phase: the human's review feedback
				// is already stored in metadata.replanRationale.  Append it to
				// the goal so the next PROPOSE cycle can incorporate it.
				const replanMeta = JSON.parse(stateResult.value.metadata);
				const replanFeedback = replanMeta.replanRationale;
				if (replanFeedback) {
					const existingGoal = replanMeta.lastIntakeGoal ?? replanMeta.goal ?? '';
					updateWorkflowMetadata(dialogueId, {
						lastIntakeGoal: `${existingGoal}\n\n---\n\n## Replanning Feedback (from Review)\n\n${replanFeedback}`,
						replanRationale: undefined, // consumed
					});
				}
				phaseResult = {
					success: true,
					value: {
						phase: 'REPLAN' as Phase,
						nextPhase: 'PROPOSE' as Phase,
						success: true,
						metadata: { replan: true },
						timestamp: new Date().toISOString(),
					},
				};
				break;
			}
			default:
				return {
					success: false,
					error: new Error(`Unknown phase: ${currentPhase}`),
				};
		}

		if (!phaseResult.success) {
			return phaseResult;
		}

		// Transition to next phase if specified
		if (
			phaseResult.value.nextPhase &&
			!phaseResult.value.gateTriggered &&
			!phaseResult.value.awaitingInput
		) {
			const transitionResult = transitionWorkflow(
				dialogueId,
				phaseResult.value.nextPhase,
				TransitionTrigger.PHASE_COMPLETE
			);

			if (!transitionResult.success) {
				return transitionResult as Result<PhaseExecutionResult>;
			}

			emitWorkflowPhaseChanged(dialogueId, currentPhase, phaseResult.value.nextPhase);
		}

		return phaseResult;
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to advance workflow'),
		};
	}
}
