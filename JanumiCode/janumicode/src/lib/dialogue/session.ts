/**
 * Dialogue Session Manager
 * Implements Phase 2.2: Turn Management
 * Manages active dialogues, turn sequences, and dialogue state
 */

import type {
	DialogueEnvelope,
	DialogueEvent,
	Result,
	ContentRef,
} from '../types';
import { Role, Phase, SpeechAct } from '../types';
import { writeDialogueTurn, getDialogueEvents } from '../events';
import {
	createEnvelope,
	createDialogueId,
	validateEnvelope,
	validateRoleSpeechAct,
} from './envelope';

/**
 * Dialogue session state
 */
export interface DialogueSession {
	dialogue_id: string;
	created_at: string;
	last_turn_id: number;
	last_updated: string;
	current_phase: Phase;
	turn_count: number;
}

/**
 * In-memory cache of active dialogue sessions
 */
const activeSessions = new Map<string, DialogueSession>();

/**
 * Create a new dialogue session
 *
 * Creates a new dialogue with a unique ID and initializes the session state.
 * The session begins in the INTAKE phase with no turns. Sessions are cached
 * in memory for quick access and can be persisted to database via turns.
 *
 * @returns Result containing the newly created dialogue session
 *
 * @example
 * ```typescript
 * const result = createDialogueSession();
 * if (result.success) {
 *   console.log(`Created dialogue: ${result.value.dialogue_id}`);
 * }
 * ```
 *
 * @remarks
 * - Session is automatically added to in-memory cache
 * - Initial phase is INTAKE
 * - Turn count starts at 0
 * - Session persists in cache until explicitly closed or cleared
 */
export function createDialogueSession(): Result<DialogueSession> {
	try {
		const dialogue_id = createDialogueId();
		const now = new Date().toISOString();

		const session: DialogueSession = {
			dialogue_id,
			created_at: now,
			last_turn_id: 0,
			last_updated: now,
			current_phase: Phase.INTAKE,
			turn_count: 0,
		};

		activeSessions.set(dialogue_id, session);

		return { success: true, value: session };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to create dialogue session'),
		};
	}
}

/**
 * Get dialogue session by ID
 *
 * Retrieves a dialogue session by its unique ID. First checks in-memory cache
 * for active sessions, then falls back to reconstructing session state from
 * database turns if not cached. Returns null if no dialogue with given ID exists.
 *
 * @param dialogue_id - Unique identifier for the dialogue (UUID format)
 * @returns Result containing the dialogue session if found, null if not found,
 *          or error if retrieval failed
 *
 * @example
 * ```typescript
 * const result = getDialogueSession('abc-123');
 * if (result.success && result.value) {
 *   console.log(`Dialogue has ${result.value.turn_count} turns`);
 * } else if (result.success && !result.value) {
 *   console.log('Dialogue not found');
 * }
 * ```
 *
 * @remarks
 * - Checks in-memory cache first for performance
 * - Reconstructs session from database if not cached
 * - Automatically caches reconstructed sessions
 * - Returns null (not error) for non-existent dialogues
 */
export function getDialogueSession(
	dialogue_id: string
): Result<DialogueSession | null> {
	try {
		// Check in-memory cache first
		const cachedSession = activeSessions.get(dialogue_id);
		if (cachedSession) {
			return { success: true, value: cachedSession };
		}

		// Load from database
		const turnsResult = getDialogueEvents({ dialogue_id, limit: 1 });
		if (!turnsResult.success) {
			return {
				success: false,
				error: turnsResult.error,
			};
		}

		if (turnsResult.value.length === 0) {
			return { success: true, value: null };
		}

		// Reconstruct session from database
		const allTurnsResult = getDialogueEvents({ dialogue_id });
		if (!allTurnsResult.success) {
			return {
				success: false,
				error: allTurnsResult.error,
			};
		}

		const turns = allTurnsResult.value;
		const lastTurn = turns[turns.length - 1];

		const session: DialogueSession = {
			dialogue_id,
			created_at: turns[0].timestamp,
			last_turn_id: lastTurn.event_id,
			last_updated: lastTurn.timestamp,
			current_phase: lastTurn.phase,
			turn_count: turns.length,
		};

		// Cache it
		activeSessions.set(dialogue_id, session);

		return { success: true, value: session };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get dialogue session'),
		};
	}
}

/**
 * Add a turn to a dialogue session
 * @param envelope Dialogue envelope
 * @returns Result containing created turn
 */
export function addTurn(
	envelope: DialogueEnvelope
): Result<DialogueEvent> {
	try {
		// Validate envelope
		const envelopeValidation = validateEnvelope(envelope);
		if (!envelopeValidation.success) {
			return {
				success: false,
				error: envelopeValidation.error,
			};
		}

		// Validate role-speech act combination
		const roleValidation = validateRoleSpeechAct(
			envelope.role,
			envelope.speech_act
		);
		if (!roleValidation.success) {
			return {
				success: false,
				error: roleValidation.error,
			};
		}

		// Get or create session
		const sessionResult = getDialogueSession(envelope.dialogue_id);
		if (!sessionResult.success) {
			return {
				success: false,
				error: sessionResult.error,
			};
		}

		let session = sessionResult.value;
		if (!session) {
			// Create new session
			const createResult = createDialogueSession();
			if (!createResult.success) {
				return {
					success: false,
					error: createResult.error,
				};
			}
			session = createResult.value;
			// Update dialogue_id in envelope if needed
			envelope.dialogue_id = session.dialogue_id;
		}

		// Verify turn_id matches expected sequence
		const expectedTurnId = session.last_turn_id + 1;
		if (envelope.turn_id !== expectedTurnId) {
			return {
				success: false,
				error: new Error(
					`Turn ID mismatch: expected ${expectedTurnId}, got ${envelope.turn_id}`
				),
			};
		}

		// Write turn to database
		const turnResult = writeDialogueTurn({
			dialogue_id: envelope.dialogue_id,
			role: envelope.role,
			phase: envelope.phase,
			speech_act: envelope.speech_act,
			content_ref: envelope.content_ref,
		});

		if (!turnResult.success) {
			return {
				success: false,
				error: turnResult.error,
			};
		}

		// Update session
		session.last_turn_id = turnResult.value.event_id;
		session.last_updated = turnResult.value.timestamp;
		session.current_phase = envelope.phase;
		session.turn_count++;
		activeSessions.set(session.dialogue_id, session);

		return { success: true, value: turnResult.value };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to add turn'),
		};
	}
}

/**
 * Create and add a turn in one operation
 *
 * Convenience function that creates a dialogue envelope and adds it as a turn
 * in a single operation. Automatically determines the next turn ID from the
 * session state and validates all parameters before creating the turn.
 *
 * @param params - Turn creation parameters
 * @param params.dialogue_id - ID of the dialogue to add turn to
 * @param params.role - Role creating the turn (EXECUTOR, VERIFIER, etc.)
 * @param params.phase - Current workflow phase (INTAKE, PROPOSE, etc.)
 * @param params.speech_act - Type of utterance (CLAIM, EVIDENCE, etc.)
 * @param params.content_ref - Reference to turn content (blob:// URL)
 * @param params.related_claims - Optional array of related claim IDs
 * @returns Result containing the created dialogue turn
 *
 * @example
 * ```typescript
 * const result = createAndAddTurn({
 *   dialogue_id: 'abc-123',
 *   role: Role.EXECUTOR,
 *   phase: Phase.PROPOSE,
 *   speech_act: SpeechAct.CLAIM,
 *   content_ref: 'blob://xyz789',
 *   related_claims: ['claim-1', 'claim-2']
 * });
 * if (result.success) {
 *   console.log(`Created turn ${result.value.turn_id}`);
 * }
 * ```
 *
 * @remarks
 * - Validates role-speech act combinations
 * - Automatically assigns sequential turn IDs
 * - Updates session state in cache
 * - Persists turn to database
 * - Fails if dialogue session doesn't exist
 */
export function createAndAddTurn(params: {
	dialogue_id: string;
	role: Role;
	phase: Phase;
	speech_act: SpeechAct;
	content_ref: ContentRef;
	related_claims?: string[];
}): Result<DialogueEvent> {
	try {
		// Get session to determine next turn_id
		const sessionResult = getDialogueSession(params.dialogue_id);
		if (!sessionResult.success) {
			return {
				success: false,
				error: sessionResult.error,
			};
		}

		const session = sessionResult.value;
		if (!session) {
			return {
				success: false,
				error: new Error(
					`Dialogue session not found: ${params.dialogue_id}`
				),
			};
		}

		const turn_id = session.last_turn_id + 1;

		// Create envelope
		const envelope = createEnvelope({
			dialogue_id: params.dialogue_id,
			turn_id,
			role: params.role,
			phase: params.phase,
			speech_act: params.speech_act,
			content_ref: params.content_ref,
			related_claims: params.related_claims || [],
		});

		// Add turn
		return addTurn(envelope);
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to create and add turn'),
		};
	}
}

/**
 * Get next turn ID for a dialogue
 * @param dialogue_id Dialogue ID
 * @returns Result containing next turn ID
 */
export function getNextTurnId(dialogue_id: string): Result<number> {
	try {
		const sessionResult = getDialogueSession(dialogue_id);
		if (!sessionResult.success) {
			return {
				success: false,
				error: sessionResult.error,
			};
		}

		const session = sessionResult.value;
		if (!session) {
			return {
				success: false,
				error: new Error(
					`Dialogue session not found: ${dialogue_id}`
				),
			};
		}

		return { success: true, value: session.last_turn_id + 1 };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get next turn ID'),
		};
	}
}

/**
 * Update dialogue phase
 * @param dialogue_id Dialogue ID
 * @param phase New phase
 * @returns Result indicating success
 */
export function updateDialoguePhase(
	dialogue_id: string,
	phase: Phase
): Result<void> {
	try {
		const session = activeSessions.get(dialogue_id);
		if (!session) {
			return {
				success: false,
				error: new Error(
					`Dialogue session not found: ${dialogue_id}`
				),
			};
		}

		session.current_phase = phase;
		session.last_updated = new Date().toISOString();
		activeSessions.set(dialogue_id, session);

		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to update dialogue phase'),
		};
	}
}

/**
 * Get all active dialogue sessions
 * @returns Array of active sessions
 */
export function getActiveSessions(): DialogueSession[] {
	return Array.from(activeSessions.values());
}

/**
 * Close a dialogue session (remove from active cache)
 * @param dialogue_id Dialogue ID
 * @returns Result indicating success
 */
export function closeDialogueSession(dialogue_id: string): Result<void> {
	try {
		activeSessions.delete(dialogue_id);
		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to close dialogue session'),
		};
	}
}

/**
 * Clear all active sessions (for cleanup)
 */
export function clearAllSessions(): void {
	activeSessions.clear();
}

/**
 * Get dialogue turns for a session
 * @param dialogue_id Dialogue ID
 * @param limit Optional limit
 * @param offset Optional offset
 * @returns Result containing turns
 */
export function getSessionTurns(
	dialogue_id: string,
	limit?: number,
	offset?: number
): Result<DialogueEvent[]> {
	return getDialogueEvents({
		dialogue_id,
		limit,
		offset,
	});
}

/**
 * Get dialogue statistics
 * @param dialogue_id Dialogue ID
 * @returns Result containing statistics
 */
export function getDialogueStats(dialogue_id: string): Result<{
	turn_count: number;
	role_distribution: Record<string, number>;
	phase_distribution: Record<string, number>;
	speech_act_distribution: Record<string, number>;
}> {
	try {
		const turnsResult = getDialogueEvents({ dialogue_id });
		if (!turnsResult.success) {
			return {
				success: false,
				error: turnsResult.error,
			};
		}

		const turns = turnsResult.value;

		const role_distribution: Record<string, number> = {};
		const phase_distribution: Record<string, number> = {};
		const speech_act_distribution: Record<string, number> = {};

		for (const turn of turns) {
			role_distribution[turn.role] =
				(role_distribution[turn.role] || 0) + 1;
			phase_distribution[turn.phase] =
				(phase_distribution[turn.phase] || 0) + 1;
			speech_act_distribution[turn.speech_act] =
				(speech_act_distribution[turn.speech_act] || 0) + 1;
		}

		return {
			success: true,
			value: {
				turn_count: turns.length,
				role_distribution,
				phase_distribution,
				speech_act_distribution,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get dialogue stats'),
		};
	}
}
