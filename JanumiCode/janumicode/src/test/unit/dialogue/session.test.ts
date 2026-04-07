import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	createDialogueSession,
	getDialogueSession,
	addTurn,
	createAndAddTurn,
	getNextTurnId,
	updateDialoguePhase,
	getActiveSessions,
	closeDialogueSession,
	clearAllSessions,
	getSessionTurns,
	getDialogueStats,
} from '../../../lib/dialogue/session';
import { createEnvelope } from '../../../lib/dialogue/envelope';
import { Role, Phase, SpeechAct } from '../../../lib/types';

describe('Session', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		clearAllSessions();
	});

	afterEach(() => {
		clearAllSessions();
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('createDialogueSession', () => {
		it('creates a new dialogue session', () => {
			const result = createDialogueSession();
			expect(result.success).toBe(true);

			if (result.success) {
				expect(result.value.dialogue_id).toBeDefined();
				expect(result.value.created_at).toBeDefined();
				expect(result.value.last_turn_id).toBe(0);
				expect(result.value.current_phase).toBe(Phase.INTAKE);
				expect(result.value.turn_count).toBe(0);
			}
		});

		it('generates unique dialogue IDs', () => {
			const session1 = createDialogueSession();
			const session2 = createDialogueSession();

			expect(session1.success).toBe(true);
			expect(session2.success).toBe(true);

			if (session1.success && session2.success) {
				expect(session1.value.dialogue_id).not.toBe(session2.value.dialogue_id);
			}
		});

		it('adds session to active sessions cache', () => {
			const result = createDialogueSession();
			expect(result.success).toBe(true);

			if (result.success) {
				const activeSessions = getActiveSessions();
				expect(activeSessions).toHaveLength(1);
				expect(activeSessions[0].dialogue_id).toBe(result.value.dialogue_id);
			}
		});

		it('initializes session with correct timestamps', () => {
			const before = new Date();
			const result = createDialogueSession();
			const after = new Date();

			expect(result.success).toBe(true);

			if (result.success) {
				const createdAt = new Date(result.value.created_at);
				expect(createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
				expect(createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
				expect(result.value.last_updated).toBe(result.value.created_at);
			}
		});
	});

	describe('getDialogueSession', () => {
		it('retrieves cached session', () => {
			const createResult = createDialogueSession();
			expect(createResult.success).toBe(true);

			if (createResult.success) {
				const getResult = getDialogueSession(createResult.value.dialogue_id);
				expect(getResult.success).toBe(true);

				if (getResult.success && getResult.value) {
					expect(getResult.value.dialogue_id).toBe(createResult.value.dialogue_id);
					expect(getResult.value.turn_count).toBe(0);
				}
			}
		});

		it('returns null for non-existent dialogue', () => {
			const result = getDialogueSession('non-existent-id');
			expect(result.success).toBe(true);

			if (result.success) {
				expect(result.value).toBeNull();
			}
		});

		it('reconstructs session from database turns', () => {
			const createResult = createDialogueSession();
			expect(createResult.success).toBe(true);

			if (createResult.success) {
				const dialogueId = createResult.value.dialogue_id;

				// Add a turn
				const envelope = createEnvelope({
					dialogue_id: dialogueId,
					turn_id: 1,
					role: Role.EXECUTOR,
					phase: Phase.INTAKE,
					speech_act: SpeechAct.CLAIM,
					content_ref: 'blob://test',
					related_claims: [],
				});
				addTurn(envelope);

				// Clear cache to force reconstruction
				clearAllSessions();

				// Should reconstruct from database
				const reconstructed = getDialogueSession(dialogueId);
				expect(reconstructed.success).toBe(true);

				if (reconstructed.success && reconstructed.value) {
					expect(reconstructed.value.dialogue_id).toBe(dialogueId);
					expect(reconstructed.value.turn_count).toBe(1);
					expect(reconstructed.value.last_turn_id).toBe(1);
				}
			}
		});

		it('caches reconstructed session', () => {
			const createResult = createDialogueSession();
			expect(createResult.success).toBe(true);

			if (createResult.success) {
				const dialogueId = createResult.value.dialogue_id;

				const envelope = createEnvelope({
					dialogue_id: dialogueId,
					turn_id: 1,
					role: Role.EXECUTOR,
					phase: Phase.INTAKE,
					speech_act: SpeechAct.CLAIM,
					content_ref: 'blob://test',
					related_claims: [],
				});
				addTurn(envelope);

				clearAllSessions();

				// First call reconstructs
				getDialogueSession(dialogueId);

				// Should now be in cache
				const activeSessions = getActiveSessions();
				expect(activeSessions).toHaveLength(1);
				expect(activeSessions[0].dialogue_id).toBe(dialogueId);
			}
		});
	});

	describe('addTurn', () => {
		it('adds a turn to a new session', () => {
			const createResult = createDialogueSession();
			expect(createResult.success).toBe(true);

			if (createResult.success) {
				const envelope = createEnvelope({
					dialogue_id: createResult.value.dialogue_id,
					turn_id: 1,
					role: Role.EXECUTOR,
					phase: Phase.INTAKE,
					speech_act: SpeechAct.CLAIM,
					content_ref: 'blob://test-content',
					related_claims: [],
				});

				const result = addTurn(envelope);
				expect(result.success).toBe(true);

				if (result.success) {
					expect(result.value.event_id).toBe(1);
					expect(result.value.role).toBe(Role.EXECUTOR);
					expect(result.value.phase).toBe(Phase.INTAKE);
				}
			}
		});

		it('updates session state after adding turn', () => {
			const createResult = createDialogueSession();
			expect(createResult.success).toBe(true);

			if (createResult.success) {
				const dialogueId = createResult.value.dialogue_id;

				const envelope = createEnvelope({
					dialogue_id: dialogueId,
					turn_id: 1,
					role: Role.EXECUTOR,
					phase: Phase.INTAKE,
					speech_act: SpeechAct.CLAIM,
					content_ref: 'blob://test',
					related_claims: [],
				});

				addTurn(envelope);

				const session = getDialogueSession(dialogueId);
				expect(session.success).toBe(true);

				if (session.success && session.value) {
					expect(session.value.last_turn_id).toBe(1);
					expect(session.value.turn_count).toBe(1);
				}
			}
		});

		it('enforces sequential turn IDs', () => {
			const createResult = createDialogueSession();
			expect(createResult.success).toBe(true);

			if (createResult.success) {
				const dialogueId = createResult.value.dialogue_id;

				const envelope = createEnvelope({
					dialogue_id: dialogueId,
					turn_id: 5,
					role: Role.EXECUTOR,
					phase: Phase.INTAKE,
					speech_act: SpeechAct.CLAIM,
					content_ref: 'blob://test',
					related_claims: [],
				});

				const result = addTurn(envelope);
				expect(result.success).toBe(false);

				if (!result.success) {
					expect(result.error.message).toContain('Turn ID mismatch');
				}
			}
		});

		it('validates envelope before adding turn', () => {
			const createResult = createDialogueSession();
			expect(createResult.success).toBe(true);

			if (createResult.success) {
				const invalidEnvelope = createEnvelope({
					dialogue_id: createResult.value.dialogue_id,
					turn_id: 1,
					role: Role.EXECUTOR,
					phase: Phase.INTAKE,
					speech_act: SpeechAct.ASSUMPTION,
					content_ref: 'blob://test',
					related_claims: [],
				});

				const result = addTurn(invalidEnvelope);
				expect(result.success).toBe(false);
			}
		});

		it('handles multiple turns in sequence', () => {
			const createResult = createDialogueSession();
			expect(createResult.success).toBe(true);

			if (createResult.success) {
				const dialogueId = createResult.value.dialogue_id;

				for (let i = 1; i <= 5; i++) {
					const envelope = createEnvelope({
						dialogue_id: dialogueId,
						turn_id: i,
						role: Role.EXECUTOR,
						phase: Phase.INTAKE,
						speech_act: SpeechAct.CLAIM,
						content_ref: `blob://test-${i}`,
						related_claims: [],
					});
					const result = addTurn(envelope);
					expect(result.success).toBe(true);
				}

				const session = getDialogueSession(dialogueId);
				if (session.success && session.value) {
					expect(session.value.turn_count).toBe(5);
					expect(session.value.last_turn_id).toBe(5);
				}
			}
		});

		it('updates current phase from envelope', () => {
			const createResult = createDialogueSession();
			expect(createResult.success).toBe(true);

			if (createResult.success) {
				const dialogueId = createResult.value.dialogue_id;

				const envelope = createEnvelope({
					dialogue_id: dialogueId,
					turn_id: 1,
					role: Role.EXECUTOR,
					phase: Phase.PROPOSE,
					speech_act: SpeechAct.CLAIM,
					content_ref: 'blob://test',
					related_claims: [],
				});

				addTurn(envelope);

				const session = getDialogueSession(dialogueId);
				if (session.success && session.value) {
					expect(session.value.current_phase).toBe(Phase.PROPOSE);
				}
			}
		});
	});

	describe('createAndAddTurn', () => {
		it('creates and adds a turn in one operation', () => {
			const createResult = createDialogueSession();
			expect(createResult.success).toBe(true);

			if (createResult.success) {
				const result = createAndAddTurn({
					dialogue_id: createResult.value.dialogue_id,
					role: Role.EXECUTOR,
					phase: Phase.INTAKE,
					speech_act: SpeechAct.CLAIM,
					content_ref: 'blob://test',
				});

				expect(result.success).toBe(true);

				if (result.success) {
					expect(result.value.event_id).toBe(1);
				}
			}
		});

		it('automatically determines next turn ID', () => {
			const createResult = createDialogueSession();
			expect(createResult.success).toBe(true);

			if (createResult.success) {
				const dialogueId = createResult.value.dialogue_id;

				createAndAddTurn({
					dialogue_id: dialogueId,
					role: Role.EXECUTOR,
					phase: Phase.INTAKE,
					speech_act: SpeechAct.CLAIM,
					content_ref: 'blob://test1',
				});

				const result = createAndAddTurn({
					dialogue_id: dialogueId,
					role: Role.EXECUTOR,
					phase: Phase.INTAKE,
					speech_act: SpeechAct.CLAIM,
					content_ref: 'blob://test2',
				});

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.value.event_id).toBe(2);
				}
			}
		});

		it('fails if dialogue does not exist', () => {
			const result = createAndAddTurn({
				dialogue_id: 'non-existent-id',
				role: Role.EXECUTOR,
				phase: Phase.INTAKE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'blob://test',
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('not found');
			}
		});

		it('supports related claims', () => {
			const createResult = createDialogueSession();
			expect(createResult.success).toBe(true);

			if (createResult.success) {
				const result = createAndAddTurn({
					dialogue_id: createResult.value.dialogue_id,
					role: Role.VERIFIER,
					phase: Phase.VERIFY,
					speech_act: SpeechAct.VERDICT,
					content_ref: 'blob://test',
					related_claims: ['claim-1', 'claim-2'],
				});

				expect(result.success).toBe(true);
			}
		});
	});

	describe('getNextTurnId', () => {
		it('returns 1 for new session', () => {
			const createResult = createDialogueSession();
			expect(createResult.success).toBe(true);

			if (createResult.success) {
				const result = getNextTurnId(createResult.value.dialogue_id);
				expect(result.success).toBe(true);

				if (result.success) {
					expect(result.value).toBe(1);
				}
			}
		});

		it('returns incremented turn ID after turns', () => {
			const createResult = createDialogueSession();
			expect(createResult.success).toBe(true);

			if (createResult.success) {
				const dialogueId = createResult.value.dialogue_id;

				createAndAddTurn({
					dialogue_id: dialogueId,
					role: Role.EXECUTOR,
					phase: Phase.INTAKE,
					speech_act: SpeechAct.CLAIM,
					content_ref: 'blob://test',
				});

				const result = getNextTurnId(dialogueId);
				expect(result.success).toBe(true);

				if (result.success) {
					expect(result.value).toBe(2);
				}
			}
		});

		it('fails for non-existent dialogue', () => {
			const result = getNextTurnId('non-existent-id');
			expect(result.success).toBe(false);
		});
	});

	describe('updateDialoguePhase', () => {
		it('updates the current phase', () => {
			const createResult = createDialogueSession();
			expect(createResult.success).toBe(true);

			if (createResult.success) {
				const dialogueId = createResult.value.dialogue_id;

				const result = updateDialoguePhase(dialogueId, Phase.PROPOSE);
				expect(result.success).toBe(true);

				const session = getDialogueSession(dialogueId);
				if (session.success && session.value) {
					expect(session.value.current_phase).toBe(Phase.PROPOSE);
				}
			}
		});

		it('updates last_updated timestamp', () => {
			const createResult = createDialogueSession();
			expect(createResult.success).toBe(true);

			if (createResult.success) {
				const dialogueId = createResult.value.dialogue_id;
				const originalTimestamp = createResult.value.last_updated;

				updateDialoguePhase(dialogueId, Phase.VERIFY);

				const session = getDialogueSession(dialogueId);
				if (session.success && session.value) {
					// last_updated must not regress; SQLite datetime('now') is second-resolution
					// so back-to-back updates can tie within the same second.
					expect(session.value.last_updated >= originalTimestamp).toBe(true);
				}
			}
		});

		it('fails for non-cached dialogue', () => {
			const result = updateDialoguePhase('non-existent-id', Phase.PROPOSE);
			expect(result.success).toBe(false);
		});
	});

	describe('getActiveSessions', () => {
		it('returns empty array when no sessions exist', () => {
			const sessions = getActiveSessions();
			expect(sessions).toEqual([]);
		});

		it('returns all active sessions', () => {
			createDialogueSession();
			createDialogueSession();
			createDialogueSession();

			const sessions = getActiveSessions();
			expect(sessions).toHaveLength(3);
		});

		it('returns session objects', () => {
			const createResult = createDialogueSession();
			const sessions = getActiveSessions();

			expect(sessions).toHaveLength(1);
			expect(sessions[0].dialogue_id).toBe(createResult.success ? createResult.value.dialogue_id : '');
		});
	});

	describe('closeDialogueSession', () => {
		it('removes session from active cache', () => {
			const createResult = createDialogueSession();
			expect(createResult.success).toBe(true);

			if (createResult.success) {
				const dialogueId = createResult.value.dialogue_id;

				const closeResult = closeDialogueSession(dialogueId);
				expect(closeResult.success).toBe(true);

				const sessions = getActiveSessions();
				expect(sessions).toHaveLength(0);
			}
		});

		it('succeeds even if session not in cache', () => {
			const result = closeDialogueSession('non-existent-id');
			expect(result.success).toBe(true);
		});

		it('does not delete turns from database', () => {
			const createResult = createDialogueSession();
			expect(createResult.success).toBe(true);

			if (createResult.success) {
				const dialogueId = createResult.value.dialogue_id;

				createAndAddTurn({
					dialogue_id: dialogueId,
					role: Role.EXECUTOR,
					phase: Phase.INTAKE,
					speech_act: SpeechAct.CLAIM,
					content_ref: 'blob://test',
				});

				closeDialogueSession(dialogueId);

				const turnsResult = getSessionTurns(dialogueId);
				expect(turnsResult.success).toBe(true);
				if (turnsResult.success) {
					expect(turnsResult.value).toHaveLength(1);
				}
			}
		});
	});

	describe('clearAllSessions', () => {
		it('removes all sessions from cache', () => {
			createDialogueSession();
			createDialogueSession();
			createDialogueSession();

			expect(getActiveSessions()).toHaveLength(3);

			clearAllSessions();

			expect(getActiveSessions()).toHaveLength(0);
		});

		it('does not affect database turns', () => {
			const createResult = createDialogueSession();
			expect(createResult.success).toBe(true);

			if (createResult.success) {
				const dialogueId = createResult.value.dialogue_id;

				createAndAddTurn({
					dialogue_id: dialogueId,
					role: Role.EXECUTOR,
					phase: Phase.INTAKE,
					speech_act: SpeechAct.CLAIM,
					content_ref: 'blob://test',
				});

				clearAllSessions();

				const turnsResult = getSessionTurns(dialogueId);
				expect(turnsResult.success).toBe(true);
				if (turnsResult.success) {
					expect(turnsResult.value).toHaveLength(1);
				}
			}
		});
	});

	describe('getSessionTurns', () => {
		it('returns all turns for a dialogue', () => {
			const createResult = createDialogueSession();
			expect(createResult.success).toBe(true);

			if (createResult.success) {
				const dialogueId = createResult.value.dialogue_id;

				for (let i = 0; i < 3; i++) {
					createAndAddTurn({
						dialogue_id: dialogueId,
						role: Role.EXECUTOR,
						phase: Phase.INTAKE,
						speech_act: SpeechAct.CLAIM,
						content_ref: `blob://test-${i}`,
					});
				}

				const result = getSessionTurns(dialogueId);
				expect(result.success).toBe(true);

				if (result.success) {
					expect(result.value).toHaveLength(3);
				}
			}
		});

		it('supports limit parameter', () => {
			const createResult = createDialogueSession();
			expect(createResult.success).toBe(true);

			if (createResult.success) {
				const dialogueId = createResult.value.dialogue_id;

				for (let i = 0; i < 5; i++) {
					createAndAddTurn({
						dialogue_id: dialogueId,
						role: Role.EXECUTOR,
						phase: Phase.INTAKE,
						speech_act: SpeechAct.CLAIM,
						content_ref: `blob://test-${i}`,
					});
				}

				const result = getSessionTurns(dialogueId, 2);
				expect(result.success).toBe(true);

				if (result.success) {
					expect(result.value).toHaveLength(2);
				}
			}
		});
	});

	describe('getDialogueStats', () => {
		it('returns statistics for a dialogue', () => {
			const createResult = createDialogueSession();
			expect(createResult.success).toBe(true);

			if (createResult.success) {
				const dialogueId = createResult.value.dialogue_id;

				createAndAddTurn({
					dialogue_id: dialogueId,
					role: Role.EXECUTOR,
					phase: Phase.INTAKE,
					speech_act: SpeechAct.CLAIM,
					content_ref: 'blob://test1',
				});

				createAndAddTurn({
					dialogue_id: dialogueId,
					role: Role.EXECUTOR,
					phase: Phase.PROPOSE,
					speech_act: SpeechAct.CLAIM,
					content_ref: 'blob://test2',
				});

				const result = getDialogueStats(dialogueId);
				expect(result.success).toBe(true);

				if (result.success) {
					expect(result.value.turn_count).toBe(2);
					expect(result.value.role_distribution[Role.EXECUTOR]).toBe(1);
					expect(result.value.role_distribution[Role.EXECUTOR]).toBe(1);
					expect(result.value.phase_distribution[Phase.INTAKE]).toBe(1);
					expect(result.value.phase_distribution[Phase.PROPOSE]).toBe(1);
					expect(result.value.speech_act_distribution[SpeechAct.CLAIM]).toBe(2);
				}
			}
		});

		it('aggregates multiple turns correctly', () => {
			const createResult = createDialogueSession();
			expect(createResult.success).toBe(true);

			if (createResult.success) {
				const dialogueId = createResult.value.dialogue_id;

				for (let i = 0; i < 3; i++) {
					createAndAddTurn({
						dialogue_id: dialogueId,
						role: Role.EXECUTOR,
						phase: Phase.INTAKE,
						speech_act: SpeechAct.CLAIM,
						content_ref: `blob://test-${i}`,
					});
				}

				const result = getDialogueStats(dialogueId);
				if (result.success) {
					expect(result.value.turn_count).toBe(3);
					expect(result.value.role_distribution[Role.EXECUTOR]).toBe(3);
				}
			}
		});

		it('returns empty distributions for dialogue with no turns', () => {
			const createResult = createDialogueSession();
			expect(createResult.success).toBe(true);

			if (createResult.success) {
				const result = getDialogueStats(createResult.value.dialogue_id);
				expect(result.success).toBe(true);

				if (result.success) {
					expect(result.value.turn_count).toBe(0);
					expect(Object.keys(result.value.role_distribution)).toHaveLength(0);
					expect(Object.keys(result.value.phase_distribution)).toHaveLength(0);
					expect(Object.keys(result.value.speech_act_distribution)).toHaveLength(0);
				}
			}
		});
	});

	describe('workflow scenarios', () => {
		it('simulates complete dialogue workflow', () => {
			const session = createDialogueSession();
			expect(session.success).toBe(true);

			if (session.success) {
				const dialogueId = session.value.dialogue_id;

				createAndAddTurn({
					dialogue_id: dialogueId,
					role: Role.EXECUTOR,
					phase: Phase.INTAKE,
					speech_act: SpeechAct.CLAIM,
					content_ref: 'blob://intake-goal',
				});

				updateDialoguePhase(dialogueId, Phase.PROPOSE);

				createAndAddTurn({
					dialogue_id: dialogueId,
					role: Role.EXECUTOR,
					phase: Phase.PROPOSE,
					speech_act: SpeechAct.CLAIM,
					content_ref: 'blob://proposal',
				});

				updateDialoguePhase(dialogueId, Phase.VERIFY);

				createAndAddTurn({
					dialogue_id: dialogueId,
					role: Role.VERIFIER,
					phase: Phase.VERIFY,
					speech_act: SpeechAct.VERDICT,
					content_ref: 'blob://verification',
				});

				const stats = getDialogueStats(dialogueId);
				if (stats.success) {
					expect(stats.value.turn_count).toBe(3);
					expect(Object.keys(stats.value.phase_distribution)).toHaveLength(3);
				}
			}
		});

		it('handles session persistence across cache clears', () => {
			const session = createDialogueSession();
			expect(session.success).toBe(true);

			if (session.success) {
				const dialogueId = session.value.dialogue_id;

				createAndAddTurn({
					dialogue_id: dialogueId,
					role: Role.EXECUTOR,
					phase: Phase.INTAKE,
					speech_act: SpeechAct.CLAIM,
					content_ref: 'blob://test',
				});

				clearAllSessions();

				const retrieved = getDialogueSession(dialogueId);
				expect(retrieved.success).toBe(true);
				if (retrieved.success && retrieved.value) {
					expect(retrieved.value.turn_count).toBe(1);
				}

				createAndAddTurn({
					dialogue_id: dialogueId,
					role: Role.EXECUTOR,
					phase: Phase.INTAKE,
					speech_act: SpeechAct.CLAIM,
					content_ref: 'blob://test2',
				});

				const finalSession = getDialogueSession(dialogueId);
				if (finalSession.success && finalSession.value) {
					expect(finalSession.value.turn_count).toBe(2);
				}
			}
		});
	});
});
