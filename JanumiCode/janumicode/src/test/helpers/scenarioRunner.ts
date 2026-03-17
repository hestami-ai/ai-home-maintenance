/**
 * Scenario Runner
 * Orchestrates governed workflow test scenarios using fakes.
 *
 * Rather than driving the full orchestrator (which has deep CLI/LLM dependencies),
 * the scenario runner exercises the workflow state machine, gates, events, and
 * claim/verdict pipeline — the core governed workflow logic — with deterministic
 * inputs and validates the outputs.
 */

import { randomUUID } from 'node:crypto';
import { createTempDatabase, type TempDbContext } from './tempDatabase';
import { initTestLogger, teardownTestLogger } from './fakeLogger';
import { registerFakeProviders, teardownFakeProviders, type FakeResponse } from './fakeProviders';
import { resetEventBus, getEventBus, type JanumiCodeEventType, type EventPayloads } from '../../lib/integration/eventBus';
import { createDialogueRecord } from '../../lib/dialogue/lifecycle';
import { initializeWorkflowState, transitionWorkflow, getWorkflowState, TransitionTrigger } from '../../lib/workflow/stateMachine';
import { createGate, resolveGate, hasOpenGates } from '../../lib/workflow/gates';
import { writeDialogueTurn, writeClaim, writeVerdict, writeHumanDecision } from '../../lib/events/writer';
import { Phase, Role, SpeechAct, ClaimCriticality, ClaimStatus, VerdictType, GateStatus, HumanAction } from '../../lib/types';

/**
 * Scenario definition — describes a governed workflow to simulate.
 */
export interface GovernedScenario {
	/** Unique scenario name */
	id: string;
	/** The user's goal */
	goal: string;
	/** Canned executor CLI responses */
	executorResponses?: FakeResponse[];
	/** Canned verifier CLI responses */
	verifierResponses?: FakeResponse[];
	/** Claims to create during the PROPOSE → ASSUMPTION_SURFACING path */
	claims?: Array<{
		statement: string;
		criticality: ClaimCriticality;
		/** Verdict to assign during VERIFY phase */
		verdict?: VerdictType;
		confidence?: number;
	}>;
	/** Maximum workflow advances before stopping */
	maxAdvances?: number;
	/** Callback when a gate is triggered — return a resolution action or null to leave open */
	onGateTriggered?: (gateId: string, reason: string) => {
		action: 'APPROVE' | 'REJECT' | 'OVERRIDE';
		rationale: string;
	} | null;
}

/**
 * Result from running a scenario.
 */
export interface ScenarioResult {
	/** Dialogue ID used */
	dialogueId: string;
	/** Ordered list of phases visited */
	phaseHistory: Phase[];
	/** Final phase reached */
	finalPhase: Phase;
	/** Number of claims created */
	claimsCreated: number;
	/** Number of gates created */
	gatesCreated: number;
	/** Number of gates resolved */
	gatesResolved: number;
	/** Whether any gates remain open */
	hasOpenGates: boolean;
	/** Events captured from the event bus */
	events: Array<{ type: JanumiCodeEventType; payload: unknown }>;
	/** Whether the scenario completed without errors */
	success: boolean;
	/** Error message if failed */
	error?: string;
}

/**
 * Scenario execution context — holds all test infrastructure.
 * Call `cleanup()` in afterEach.
 */
export interface ScenarioContext {
	tempDb: TempDbContext;
	dialogueId: string;
	cleanup: () => void;
}

/**
 * Set up the infrastructure for a scenario.
 * Creates temp DB, initializes logger, registers fake providers.
 */
export function setupScenario(scenario: GovernedScenario): ScenarioContext {
	initTestLogger();
	const tempDb = createTempDatabase();

	registerFakeProviders({
		executorResponses: scenario.executorResponses,
		verifierResponses: scenario.verifierResponses,
	});

	const dialogueId = randomUUID();

	// Create dialogue record and initialize workflow
	const createResult = createDialogueRecord(dialogueId, scenario.goal);
	if (!createResult.success) {
		throw new Error(`Failed to create dialogue: ${createResult.error.message}`);
	}

	const initResult = initializeWorkflowState(dialogueId);
	if (!initResult.success) {
		throw new Error(`Failed to initialize workflow: ${initResult.error.message}`);
	}

	return {
		tempDb,
		dialogueId,
		cleanup() {
			resetEventBus();
			teardownFakeProviders();
			tempDb.cleanup();
			teardownTestLogger();
		},
	};
}

/**
 * Run a governed workflow scenario.
 *
 * Simulates the workflow by:
 * 1. Creating a dialogue + workflow state (in INTAKE)
 * 2. Transitioning through phases with deterministic triggers
 * 3. Creating claims and verdicts at appropriate phases
 * 4. Triggering and optionally resolving gates
 * 5. Collecting event bus emissions
 *
 * This exercises the state machine, gate logic, and event bus integration
 * without requiring the full orchestrator.
 */
export async function runScenario(scenario: GovernedScenario): Promise<ScenarioResult> {
	const ctx = setupScenario(scenario);
	const { dialogueId } = ctx;

	const phaseHistory: Phase[] = [Phase.INTAKE];
	const events: Array<{ type: JanumiCodeEventType; payload: unknown }> = [];
	let claimsCreated = 0;
	let gatesCreated = 0;
	let gatesResolved = 0;

	// Subscribe to all events
	const eventTypes: JanumiCodeEventType[] = [
		'workflow:phase_changed',
		'workflow:gate_triggered',
		'workflow:gate_resolved',
		'claim:created',
		'claim:verified',
		'claim:disproved',
		'verdict:emitted',
	];

	const unsubscribers = eventTypes.map(type =>
		getEventBus().on(type, (payload: EventPayloads[typeof type]) => {
			events.push({ type, payload });
		})
	);

	try {
		const maxAdvances = scenario.maxAdvances ?? 10;

		// Phase 1: INTAKE → PROPOSE
		transitionWorkflow(dialogueId, Phase.PROPOSE, TransitionTrigger.INTAKE_PLAN_APPROVED);
		phaseHistory.push(Phase.PROPOSE);

		// Phase 2: PROPOSE — write a dialogue turn for the proposal
		const proposalTurn = writeDialogueTurn({
			dialogue_id: dialogueId,
			role: Role.EXECUTOR,
			phase: Phase.PROPOSE,
			speech_act: SpeechAct.CLAIM,
			content_ref: scenario.executorResponses?.[0]?.response ?? 'Fake proposal',
		});

		if (!proposalTurn.success) {
			return makeErrorResult(ctx, phaseHistory, events, `Failed to write proposal turn: ${proposalTurn.error.message}`);
		}

		// Phase 3: PROPOSE → ASSUMPTION_SURFACING — create claims
		transitionWorkflow(dialogueId, Phase.ASSUMPTION_SURFACING, TransitionTrigger.PHASE_COMPLETE);
		phaseHistory.push(Phase.ASSUMPTION_SURFACING);

		const claimRecords: Array<{ claim_id: string; verdict?: VerdictType; confidence?: number }> = [];

		for (const claimDef of (scenario.claims ?? [])) {
			const claimResult = writeClaim({
				dialogue_id: dialogueId,
				statement: claimDef.statement,
				introduced_by: Role.EXECUTOR,
				criticality: claimDef.criticality,
				status: ClaimStatus.OPEN,
				turn_id: proposalTurn.value.event_id,
			});

			if (claimResult.success) {
				claimsCreated++;
				claimRecords.push({
					claim_id: claimResult.value.claim_id,
					verdict: claimDef.verdict,
					confidence: claimDef.confidence,
				});
				getEventBus().emit('claim:created', {
					dialogueId,
					claimId: claimResult.value.claim_id,
					statement: claimDef.statement,
				});
			}
		}

		// Phase 4: ASSUMPTION_SURFACING → VERIFY — write verdicts
		transitionWorkflow(dialogueId, Phase.VERIFY, TransitionTrigger.PHASE_COMPLETE);
		phaseHistory.push(Phase.VERIFY);

		for (const claim of claimRecords) {
			if (claim.verdict) {
				const verdictResult = writeVerdict({
					claim_id: claim.claim_id,
					verdict: claim.verdict,
					constraints_ref: null,
					evidence_ref: null,
					rationale: `Automated test verdict: ${claim.verdict}`,
					novel_dependency: false,
				});

				if (verdictResult.success) {
					const eventType: JanumiCodeEventType =
						claim.verdict === VerdictType.VERIFIED ? 'claim:verified' :
						claim.verdict === VerdictType.DISPROVED ? 'claim:disproved' :
						'verdict:emitted';

					getEventBus().emit(eventType, {
						claimId: claim.claim_id,
						verdict: claim.verdict,
					} as EventPayloads[typeof eventType]);
				}
			}
		}

		// Check if any critical claims were disproved/unknown → trigger gate
		const shouldGate = claimRecords.some(c =>
			(c.verdict === VerdictType.DISPROVED || c.verdict === VerdictType.UNKNOWN)
		);

		if (shouldGate) {
			const blockingClaims = claimRecords
				.filter(c => c.verdict === VerdictType.DISPROVED || c.verdict === VerdictType.UNKNOWN)
				.map(c => c.claim_id);

			const gateResult = createGate({
				dialogueId,
				reason: 'Claims require human review',
				blockingClaims,
			});

			if (gateResult.success) {
				gatesCreated++;
				getEventBus().emit('workflow:gate_triggered', {
					dialogueId,
					gateId: gateResult.value.gate_id,
					reason: gateResult.value.reason,
				});

				// Allow scenario to resolve the gate
				if (scenario.onGateTriggered) {
					const resolution = scenario.onGateTriggered(
						gateResult.value.gate_id,
						gateResult.value.reason
					);

					if (resolution) {
						const decisionResult = writeHumanDecision({
							gate_id: gateResult.value.gate_id,
							action: resolution.action as HumanAction,
							rationale: resolution.rationale,
							attachments_ref: null,
						});

						if (decisionResult.success) {
							// If action is REJECT, manually resolve since writeHumanDecision
							// only auto-resolves for APPROVE/OVERRIDE
							if (resolution.action === 'REJECT') {
								resolveGate({
									gateId: gateResult.value.gate_id,
									decisionId: decisionResult.value.decision_id,
									resolution: resolution.rationale,
								});
							}
							gatesResolved++;

							getEventBus().emit('workflow:gate_resolved', {
								dialogueId,
								gateId: gateResult.value.gate_id,
								action: resolution.action,
							});
						}
					}
				}
			}
		}

		// Check if we can continue past VERIFY
		const openGatesResult = hasOpenGates(dialogueId);
		const stillBlocked = openGatesResult.success && openGatesResult.value;

		if (!stillBlocked) {
			// Phase 5: VERIFY → HISTORICAL_CHECK
			transitionWorkflow(dialogueId, Phase.HISTORICAL_CHECK, TransitionTrigger.PHASE_COMPLETE);
			phaseHistory.push(Phase.HISTORICAL_CHECK);

			// Phase 6: HISTORICAL_CHECK → REVIEW
			transitionWorkflow(dialogueId, Phase.REVIEW, TransitionTrigger.PHASE_COMPLETE);
			phaseHistory.push(Phase.REVIEW);

			// Phase 7: REVIEW → EXECUTE
			transitionWorkflow(dialogueId, Phase.EXECUTE, TransitionTrigger.PHASE_COMPLETE);
			phaseHistory.push(Phase.EXECUTE);

			// Phase 8: EXECUTE → VALIDATE
			transitionWorkflow(dialogueId, Phase.VALIDATE, TransitionTrigger.PHASE_COMPLETE);
			phaseHistory.push(Phase.VALIDATE);

			// Phase 9: VALIDATE → COMMIT
			transitionWorkflow(dialogueId, Phase.COMMIT, TransitionTrigger.PHASE_COMPLETE);
			phaseHistory.push(Phase.COMMIT);
		}

		// Get final state
		const finalState = getWorkflowState(dialogueId);
		const finalPhase = finalState.success
			? (finalState.value.current_phase as Phase)
			: phaseHistory[phaseHistory.length - 1];

		const finalOpenGates = hasOpenGates(dialogueId);

		return {
			dialogueId,
			phaseHistory,
			finalPhase,
			claimsCreated,
			gatesCreated,
			gatesResolved,
			hasOpenGates: finalOpenGates.success ? finalOpenGates.value : false,
			events,
			success: true,
		};
	} catch (error) {
		return makeErrorResult(
			ctx,
			phaseHistory,
			events,
			error instanceof Error ? error.message : 'Unknown error'
		);
	} finally {
		unsubscribers.forEach(fn => fn());
		ctx.cleanup();
	}
}

function makeErrorResult(
	ctx: ScenarioContext,
	phaseHistory: Phase[],
	events: Array<{ type: JanumiCodeEventType; payload: unknown }>,
	errorMessage: string,
): ScenarioResult {
	return {
		dialogueId: ctx.dialogueId,
		phaseHistory,
		finalPhase: phaseHistory[phaseHistory.length - 1],
		claimsCreated: 0,
		gatesCreated: 0,
		gatesResolved: 0,
		hasOpenGates: false,
		events,
		success: false,
		error: errorMessage,
	};
}
