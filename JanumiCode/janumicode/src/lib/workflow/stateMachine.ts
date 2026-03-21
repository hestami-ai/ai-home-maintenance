/**
 * State Machine Implementation
 * Implements Phase 7.1: Workflow states, transitions, guards, persistence
 * DBOS-compatible state machine for governed multi-role dialogue
 */

import type { Result } from '../types';
import { Phase } from '../types';
import { getDatabase } from '../database';
import { nanoid } from 'nanoid';

/**
 * Workflow state record
 * Tracks the current state of a dialogue workflow
 */
export interface WorkflowState {
	state_id: string; // UUID
	dialogue_id: string;
	current_phase: Phase;
	previous_phase: Phase | null;
	metadata: string; // JSON metadata (custom state data)
	created_at: string; // ISO-8601
	updated_at: string; // ISO-8601
}

/**
 * State transition record
 * Append-only log of state changes for audit trail
 */
export interface StateTransition {
	transition_id: string; // UUID
	workflow_state_id: string;
	from_phase: Phase;
	to_phase: Phase;
	trigger: TransitionTrigger;
	metadata: string; // JSON metadata
	timestamp: string; // ISO-8601
}

/**
 * Transition triggers
 */
export enum TransitionTrigger {
	PHASE_COMPLETE = 'PHASE_COMPLETE', // Phase completed successfully
	GATE_TRIGGERED = 'GATE_TRIGGERED', // Gate opened, workflow suspended
	GATE_RESOLVED = 'GATE_RESOLVED', // Gate resolved, workflow resumed
	MANUAL_OVERRIDE = 'MANUAL_OVERRIDE', // Human-initiated transition
	ERROR_RECOVERY = 'ERROR_RECOVERY', // Error recovery transition
	REPLAN_REQUIRED = 'REPLAN_REQUIRED', // Replanning triggered
	INTAKE_TURN_COMPLETE = 'INTAKE_TURN_COMPLETE', // INTAKE conversation turn completed
	INTAKE_PLAN_FINALIZED = 'INTAKE_PLAN_FINALIZED', // Plan synthesis completed
	INTAKE_PLAN_APPROVED = 'INTAKE_PLAN_APPROVED', // Human approved the plan
	// MAKER triggers
	INTENT_CAPTURED = 'INTENT_CAPTURED', // IntentRecord + AcceptanceContract created
	CONTRACT_APPROVED = 'CONTRACT_APPROVED', // Acceptance contract approved
	DECOMPOSITION_COMPLETE = 'DECOMPOSITION_COMPLETE', // Task graph decomposition done
	UNIT_COMPLETE = 'UNIT_COMPLETE', // Single task unit completed
	UNIT_FAILED = 'UNIT_FAILED', // Single task unit failed
	REPAIR_ATTEMPT = 'REPAIR_ATTEMPT', // Bounded repair attempted
	REPAIR_ESCALATED = 'REPAIR_ESCALATED', // Repair escalated to human
	GRAPH_COMPLETE = 'GRAPH_COMPLETE', // All task units complete
	// Architecture phase triggers
	ARCHITECTURE_DECOMPOSED = 'ARCHITECTURE_DECOMPOSED', // Capabilities + workflows produced
	ARCHITECTURE_DESIGNED = 'ARCHITECTURE_DESIGNED', // Components + interfaces designed
	ARCHITECTURE_VALIDATED = 'ARCHITECTURE_VALIDATED', // Goal alignment + structural checks passed
	ARCHITECTURE_APPROVED = 'ARCHITECTURE_APPROVED', // Human approved the architecture
	ARCHITECTURE_REVISION = 'ARCHITECTURE_REVISION', // Human requested changes
	ARCHITECTURE_SKIPPED = 'ARCHITECTURE_SKIPPED', // Human chose to skip architecture
}

/**
 * Transition guard result
 */
export interface TransitionGuardResult {
	canTransition: boolean;
	reason?: string;
	blockingClaims?: string[]; // Claim IDs blocking transition
	blockingGates?: string[]; // Gate IDs blocking transition
}

/**
 * State metadata
 */
export interface StateMetadata {
	turnCount?: number;
	claimCount?: number;
	activeGateIds?: string[];
	lastError?: string;
	/** Raw CLI output cached before parsing — enables retry without re-invoking LLM */
	cachedRawCliOutput?: string;
	/** Which phase last failed — signals retry should attempt cache re-parse first */
	lastFailedPhase?: string;
	/** Step-level checkpoint for resume within a phase */
	phaseCheckpoint?: import('./phaseRunner').PhaseCheckpoint;
	// MAKER metadata
	graph_id?: string;
	current_unit_id?: string;
	intent_id?: string;
	contract_id?: string;
	repair_active?: boolean;
	[key: string]: unknown;
}

/**
 * Valid phase transitions
 * Defines the allowed state transition graph
 */
/**
 * Version of the transition graph. Increment when VALID_TRANSITIONS changes.
 * Stored in workflow_states so stale dialogues can be detected and remapped.
 */
export const TRANSITION_GRAPH_VERSION = 1;

const VALID_TRANSITIONS: Record<Phase, Phase[]> = {
	[Phase.INTAKE]: [Phase.INTAKE, Phase.ARCHITECTURE],
	[Phase.ARCHITECTURE]: [Phase.ARCHITECTURE, Phase.PROPOSE, Phase.REPLAN],
	[Phase.PROPOSE]: [Phase.ASSUMPTION_SURFACING, Phase.REPLAN],
	[Phase.ASSUMPTION_SURFACING]: [Phase.VERIFY, Phase.REPLAN],
	[Phase.VERIFY]: [Phase.HISTORICAL_CHECK, Phase.REVIEW, Phase.REPLAN],
	[Phase.HISTORICAL_CHECK]: [Phase.REVIEW, Phase.REPLAN],
	[Phase.REVIEW]: [Phase.EXECUTE, Phase.REPLAN],
	[Phase.EXECUTE]: [Phase.VALIDATE, Phase.REPLAN],
	[Phase.VALIDATE]: [Phase.COMMIT, Phase.REPLAN],
	[Phase.COMMIT]: [Phase.INTAKE], // Loop back for next task
	[Phase.REPLAN]: [Phase.PROPOSE], // Replan goes back to propose
};

/**
 * Initialize workflow state
 *
 * Creates the initial workflow state record for a new dialogue. The workflow
 * begins in the INTAKE phase with no previous phase. State and transition
 * tables are created if they don't exist. This function should be called once
 * per dialogue at the start of the workflow.
 *
 * @param dialogueId - Unique identifier for the dialogue
 * @param metadata - Optional initial metadata (turn count, claim count, etc.)
 * @returns Result containing the initialized workflow state
 *
 * @example
 * ```typescript
 * const result = initializeWorkflowState('abc-123', {
 *   turnCount: 0,
 *   claimCount: 0
 * });
 * if (result.success) {
 *   console.log(`Workflow initialized in ${result.value.current_phase}`);
 * }
 * ```
 *
 * @remarks
 * - Initial phase is always INTAKE
 * - Creates workflow_states and state_transitions tables if needed
 * - State persisted to database immediately
 * - Dialogue ID must be unique (enforced by UNIQUE constraint)
 * - Metadata stored as JSON string
 *
 * @throws Will return error if dialogue_id already has workflow state
 * @throws Will return error if database not initialized
 */
export function initializeWorkflowState(
	dialogueId: string,
	metadata: StateMetadata = {}
): Result<WorkflowState> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Create workflow_states table if it doesn't exist
		db.exec(`
			CREATE TABLE IF NOT EXISTS workflow_states (
				state_id TEXT PRIMARY KEY,
				dialogue_id TEXT NOT NULL UNIQUE,
				current_phase TEXT NOT NULL,
				previous_phase TEXT,
				metadata TEXT NOT NULL,
				transition_graph_version INTEGER NOT NULL DEFAULT 1,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			)
		`);

		// Create state_transitions table if it doesn't exist
		db.exec(`
			CREATE TABLE IF NOT EXISTS state_transitions (
				transition_id TEXT PRIMARY KEY,
				workflow_state_id TEXT NOT NULL,
				from_phase TEXT NOT NULL,
				to_phase TEXT NOT NULL,
				trigger TEXT NOT NULL,
				metadata TEXT NOT NULL,
				timestamp TEXT NOT NULL,
				FOREIGN KEY (workflow_state_id) REFERENCES workflow_states(state_id)
			)
		`);

		const stateId = nanoid();
		const now = new Date().toISOString();

		const state: WorkflowState = {
			state_id: stateId,
			dialogue_id: dialogueId,
			current_phase: 'INTAKE' as Phase,
			previous_phase: null,
			metadata: JSON.stringify(metadata),
			created_at: now,
			updated_at: now,
		};

		db.prepare(
			`
			INSERT INTO workflow_states (
				state_id, dialogue_id, current_phase, previous_phase,
				metadata, transition_graph_version, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`
		).run(
			state.state_id,
			state.dialogue_id,
			state.current_phase,
			state.previous_phase,
			state.metadata,
			TRANSITION_GRAPH_VERSION,
			state.created_at,
			state.updated_at
		);

		return { success: true, value: state };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to initialize workflow state'),
		};
	}
}

/**
 * Get current workflow state
 * Retrieves the current state for a dialogue
 *
 * @param dialogueId Dialogue ID
 * @returns Result containing workflow state
 */
export function getWorkflowState(dialogueId: string): Result<WorkflowState> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const state = db
			.prepare(
				`
			SELECT state_id, dialogue_id, current_phase, previous_phase,
			       metadata, created_at, updated_at
			FROM workflow_states
			WHERE dialogue_id = ?
		`
			)
			.get(dialogueId) as WorkflowState | undefined;

		if (!state) {
			return {
				success: false,
				error: new Error(`Workflow state not found for dialogue: ${dialogueId}`),
			};
		}

		return { success: true, value: state };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get workflow state'),
		};
	}
}

/**
 * Check if a phase transition is valid
 * Validates the transition against the state machine graph
 *
 * @param fromPhase Current phase
 * @param toPhase Target phase
 * @returns True if transition is valid
 */
export function isValidTransition(fromPhase: Phase, toPhase: Phase): boolean {
	const validNextPhases = VALID_TRANSITIONS[fromPhase];
	return validNextPhases.includes(toPhase);
}

/**
 * Evaluate transition guards
 * Checks if the workflow can transition to the next phase
 *
 * @param dialogueId Dialogue ID
 * @param fromPhase Current phase
 * @param toPhase Target phase
 * @returns Guard result with blocking reasons
 */
export function evaluateTransitionGuards(
	dialogueId: string,
	fromPhase: Phase,
	toPhase: Phase
): Result<TransitionGuardResult> {
	try {
		// Check if transition is valid in the state machine
		if (!isValidTransition(fromPhase, toPhase)) {
			return {
				success: true,
				value: {
					canTransition: false,
					reason: `Invalid transition: ${fromPhase} → ${toPhase}`,
				},
			};
		}

		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Check for blocking claims (CRITICAL claims with DISPROVED or UNKNOWN status)
		const blockingClaims = db
			.prepare(
				`
			SELECT claim_id
			FROM claims
			WHERE dialogue_id = ?
			  AND criticality = 'CRITICAL'
			  AND status IN ('DISPROVED', 'UNKNOWN')
		`
			)
			.all(dialogueId) as Array<{ claim_id: string }>;

		if (blockingClaims.length > 0) {
			// Check if all gates have been resolved (human accepted risk via OVERRIDE)
			const openGatesCount = db
				.prepare(
					`SELECT COUNT(*) as count FROM gates WHERE dialogue_id = ? AND status = 'OPEN'`
				)
				.get(dialogueId) as { count: number };

			if (openGatesCount.count > 0) {
				return {
					success: true,
					value: {
						canTransition: false,
						reason: 'Blocking critical claims exist',
						blockingClaims: blockingClaims.map((c) => c.claim_id),
					},
				};
			}
			// All gates resolved — human has accepted the risk, allow transition
		}

		// Check for open gates
		const openGates = db
			.prepare(
				`
			SELECT gate_id
			FROM gates
			WHERE dialogue_id = ?
			  AND status = 'OPEN'
		`
			)
			.all(dialogueId) as Array<{ gate_id: string }>;

		if (openGates.length > 0) {
			return {
				success: true,
				value: {
					canTransition: false,
					reason: 'Open gates blocking workflow',
					blockingGates: openGates.map((g) => g.gate_id),
				},
			};
		}

		// All guards passed
		return {
			success: true,
			value: {
				canTransition: true,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to evaluate transition guards'),
		};
	}
}

/**
 * Transition workflow to next phase
 * Performs state transition with guards and audit trail
 *
 * @param dialogueId Dialogue ID
 * @param toPhase Target phase
 * @param trigger Transition trigger
 * @param metadata Optional transition metadata
 * @returns Result containing updated workflow state
 */
export function transitionWorkflow(
	dialogueId: string,
	toPhase: Phase,
	trigger: TransitionTrigger,
	metadata: Record<string, unknown> = {}
): Result<WorkflowState> {
	try {
		// Get current state
		const stateResult = getWorkflowState(dialogueId);
		if (!stateResult.success) {
			return stateResult;
		}

		const currentState = stateResult.value;
		const fromPhase = currentState.current_phase as Phase;

		// Evaluate guards (unless manual override)
		if (trigger !== TransitionTrigger.MANUAL_OVERRIDE) {
			const guardResult = evaluateTransitionGuards(dialogueId, fromPhase, toPhase);
			if (!guardResult.success) {
				return guardResult as Result<WorkflowState>;
			}

			if (!guardResult.value.canTransition) {
				return {
					success: false,
					error: new Error(
						`Transition blocked: ${guardResult.value.reason}`
					),
				};
			}
		}

		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const now = new Date().toISOString();
		const transitionId = nanoid();

		// Atomic: update phase + log transition in a single transaction
		const txn = db.transaction(() => {
			db.prepare(
				`UPDATE workflow_states
				 SET current_phase = ?, previous_phase = ?, transition_graph_version = ?, updated_at = ?
				 WHERE dialogue_id = ?`
			).run(toPhase, fromPhase, TRANSITION_GRAPH_VERSION, now, dialogueId);

			db.prepare(
				`INSERT INTO state_transitions (
					transition_id, workflow_state_id, from_phase, to_phase,
					trigger, metadata, timestamp
				) VALUES (?, ?, ?, ?, ?, ?, ?)`
			).run(
				transitionId,
				currentState.state_id,
				fromPhase,
				toPhase,
				trigger,
				JSON.stringify(metadata),
				now
			);
		});
		txn();

		// Get updated state (read-only, outside transaction)
		return getWorkflowState(dialogueId);
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to transition workflow'),
		};
	}
}

/**
 * Update workflow state metadata
 * Updates custom metadata without changing phase
 *
 * @param dialogueId Dialogue ID
 * @param metadata Metadata to merge
 * @returns Result containing updated workflow state
 */
export function updateWorkflowMetadata(
	dialogueId: string,
	metadata: StateMetadata
): Result<WorkflowState> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const now = new Date().toISOString();

		// Atomic read-modify-write in a single transaction to prevent concurrent overwrites
		const txn = db.transaction(() => {
			const row = db.prepare(
				'SELECT metadata FROM workflow_states WHERE dialogue_id = ?'
			).get(dialogueId) as { metadata: string } | undefined;

			if (!row) {
				throw new Error(`No workflow state found for dialogue ${dialogueId}`);
			}

			const currentMetadata = JSON.parse(row.metadata) as StateMetadata;
			const updatedMetadata = { ...currentMetadata, ...metadata };

			db.prepare(
				`UPDATE workflow_states SET metadata = ?, updated_at = ? WHERE dialogue_id = ?`
			).run(JSON.stringify(updatedMetadata), now, dialogueId);
		});
		txn();

		return getWorkflowState(dialogueId);
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to update workflow metadata'),
		};
	}
}

/**
 * Get transition history
 * Retrieves all transitions for a dialogue
 *
 * @param dialogueId Dialogue ID
 * @returns Result containing transition history
 */
export function getTransitionHistory(
	dialogueId: string
): Result<StateTransition[]> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Get workflow state ID
		const stateResult = getWorkflowState(dialogueId);
		if (!stateResult.success) {
			return { success: false, error: stateResult.error };
		}

		const transitions = db
			.prepare(
				`
			SELECT transition_id, workflow_state_id, from_phase, to_phase,
			       trigger, metadata, timestamp
			FROM state_transitions
			WHERE workflow_state_id = ?
			ORDER BY timestamp ASC
		`
			)
			.all(stateResult.value.state_id) as StateTransition[];

		return { success: true, value: transitions };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get transition history'),
		};
	}
}

/**
 * Reconcile dialogues whose transition_graph_version doesn't match the current code.
 * Remaps unknown phases to INTAKE (safe fallback) and stamps the current version.
 * Call on extension activation to prevent soft-locks from schema evolution.
 * @returns Number of dialogues reconciled
 */
export function reconcileStaleTransitionGraphs(): Result<number> {
	try {
		const db = getDatabase();
		if (!db) {
			return { success: false, error: new Error('Database not initialized') };
		}

		const staleRows = db.prepare(
			`SELECT dialogue_id, current_phase, transition_graph_version
			 FROM workflow_states
			 WHERE transition_graph_version != ?`
		).all(TRANSITION_GRAPH_VERSION) as Array<{ dialogue_id: string; current_phase: string; transition_graph_version: number }>;

		if (staleRows.length === 0) {
			return { success: true, value: 0 };
		}

		const validPhases = new Set(Object.values(Phase));
		const now = new Date().toISOString();

		const txn = db.transaction(() => {
			for (const row of staleRows) {
				const phaseIsValid = validPhases.has(row.current_phase as Phase);
				if (!phaseIsValid) {
					// Remap unknown phase to INTAKE
					console.warn(`[StateMachine] Dialogue ${row.dialogue_id} has unknown phase "${row.current_phase}" (graph v${row.transition_graph_version}). Remapping to INTAKE.`);
					db.prepare(
						`UPDATE workflow_states SET current_phase = ?, transition_graph_version = ?, updated_at = ? WHERE dialogue_id = ?`
					).run(Phase.INTAKE, TRANSITION_GRAPH_VERSION, now, row.dialogue_id);
				} else {
					// Phase is valid in current graph, just stamp the version
					console.log(`[StateMachine] Dialogue ${row.dialogue_id} upgraded from graph v${row.transition_graph_version} to v${TRANSITION_GRAPH_VERSION}`);
					db.prepare(
						`UPDATE workflow_states SET transition_graph_version = ?, updated_at = ? WHERE dialogue_id = ?`
					).run(TRANSITION_GRAPH_VERSION, now, row.dialogue_id);
				}
			}
		});
		txn();

		return { success: true, value: staleRows.length };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Failed to reconcile transition graphs'),
		};
	}
}

/**
 * Restore workflow state
 * Reconstructs workflow state for resumption after suspension
 *
 * @param dialogueId Dialogue ID
 * @returns Result containing restored workflow state
 */
export function restoreWorkflowState(
	dialogueId: string
): Result<WorkflowState> {
	// For now, just return current state
	// In future, could implement more sophisticated restoration logic
	return getWorkflowState(dialogueId);
}

/**
 * Visualize workflow state
 * Creates a human-readable representation of the workflow state
 *
 * @param dialogueId Dialogue ID
 * @returns Result containing visualization string
 */
export function visualizeWorkflowState(
	dialogueId: string
): Result<string> {
	try {
		const stateResult = getWorkflowState(dialogueId);
		if (!stateResult.success) {
			return stateResult as Result<string>;
		}

		const state = stateResult.value;
		const metadata = JSON.parse(state.metadata) as StateMetadata;

		const transitionsResult = getTransitionHistory(dialogueId);
		if (!transitionsResult.success) {
			return transitionsResult as Result<string>;
		}

		const transitions = transitionsResult.value;

		let visualization = '';
		visualization += `=== Workflow State ===\n`;
		visualization += `Dialogue ID: ${state.dialogue_id}\n`;
		visualization += `Current Phase: ${state.current_phase}\n`;
		visualization += `Previous Phase: ${state.previous_phase ?? 'None'}\n`;
		visualization += `Created: ${state.created_at}\n`;
		visualization += `Updated: ${state.updated_at}\n`;
		visualization += `\n=== Metadata ===\n`;
		visualization += JSON.stringify(metadata, null, 2);
		visualization += `\n\n=== Transition History ===\n`;

		for (const transition of transitions) {
			visualization += `[${transition.timestamp}] ${transition.from_phase} → ${transition.to_phase} (${transition.trigger})\n`;
		}

		return { success: true, value: visualization };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to visualize workflow state'),
		};
	}
}
