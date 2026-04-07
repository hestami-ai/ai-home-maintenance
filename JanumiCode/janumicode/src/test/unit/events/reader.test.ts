import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	getDialogueEvents,
	getDialogueEventById,
	getClaims,
	getClaimById,
	getVerdicts,
	getGates,
	getGateById,
	getHumanDecisions,
	getArtifactByHash,
	getIntakeConversation,
	getOrCreateIntakeConversation,
	getIntakeTurns,
	getRecentIntakeTurns,
	getIntakeTurnsInRange,
	getArchitectureEvents,
	getLatestArchitectureValidation,
	getQaExchanges,
} from '../../../lib/events/reader';
import { writeDialogueTurn, writeClaim, writeVerdict, writeHumanDecision, updateIntakeConversation } from '../../../lib/events/writer';
import { createGate } from '../../../lib/workflow/gates';
import { Role, Phase, SpeechAct, ClaimStatus, ClaimCriticality, VerdictType, GateStatus, HumanAction, IntakeSubState } from '../../../lib/types';
import { getDatabase } from '../../../lib/database/init';

describe('Event Reader', () => {
	let tempDb: TempDbContext;
	const DLG_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
	const DLG_ID_2 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee02';

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		const db = getDatabase()!;
		db.prepare(
			"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, 'test goal', 'ACTIVE', datetime('now'))"
		).run(DLG_ID);
		db.prepare(
			"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, 'test goal 2', 'ACTIVE', datetime('now'))"
		).run(DLG_ID_2);
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('getDialogueEvents', () => {
		it('returns all events for a dialogue', () => {
			writeDialogueTurn({
				dialogue_id: DLG_ID,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'proposal 1',
			});
			writeDialogueTurn({
				dialogue_id: DLG_ID,
				role: Role.VERIFIER,
				phase: Phase.VERIFY,
				speech_act: SpeechAct.VERDICT,
				content_ref: 'verification',
			});

			const result = getDialogueEvents({ dialogue_id: DLG_ID });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(2);
				expect(result.value[0].role).toBe(Role.EXECUTOR);
				expect(result.value[1].role).toBe(Role.VERIFIER);
			}
		});

		it('filters by event_type', () => {
			writeDialogueTurn({
				dialogue_id: DLG_ID,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'proposal',
			});
			const db = getDatabase()!;
			db.prepare(
				"INSERT INTO dialogue_events (dialogue_id, event_type, role, phase, speech_act, summary, content, timestamp) VALUES (?, 'human_message', 'HUMAN', 'INTAKE', 'INSTRUCT', 'user input', 'help', datetime('now'))"
			).run(DLG_ID);

			const result = getDialogueEvents({ dialogue_id: DLG_ID, event_type: 'human_message' });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].event_type).toBe('human_message');
			}
		});

		it('filters by role', () => {
			writeDialogueTurn({
				dialogue_id: DLG_ID,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'executor turn',
			});
			writeDialogueTurn({
				dialogue_id: DLG_ID,
				role: Role.VERIFIER,
				phase: Phase.VERIFY,
				speech_act: SpeechAct.VERDICT,
				content_ref: 'verifier turn',
			});

			const result = getDialogueEvents({ dialogue_id: DLG_ID, role: Role.EXECUTOR });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].role).toBe(Role.EXECUTOR);
			}
		});

		it('filters by phase', () => {
			writeDialogueTurn({
				dialogue_id: DLG_ID,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'proposal',
			});
			writeDialogueTurn({
				dialogue_id: DLG_ID,
				role: Role.EXECUTOR,
				phase: Phase.EXECUTE,
				speech_act: SpeechAct.DECISION,
				content_ref: 'execution',
			});

			const result = getDialogueEvents({ dialogue_id: DLG_ID, phase: Phase.EXECUTE });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].phase).toBe(Phase.EXECUTE);
			}
		});

		it('filters by sinceEventId', () => {
			const turn1 = writeDialogueTurn({
				dialogue_id: DLG_ID,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'turn 1',
			});
			writeDialogueTurn({
				dialogue_id: DLG_ID,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'turn 2',
			});
			writeDialogueTurn({
				dialogue_id: DLG_ID,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'turn 3',
			});

			if (!turn1.success) { return; }
			const result = getDialogueEvents({ dialogue_id: DLG_ID, sinceEventId: turn1.value.event_id });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(2);
				expect(result.value.every(e => e.event_id > turn1.value.event_id)).toBe(true);
			}
		});

		it('supports pagination with limit and offset', () => {
			for (let i = 0; i < 5; i++) {
				writeDialogueTurn({
					dialogue_id: DLG_ID,
					role: Role.EXECUTOR,
					phase: Phase.PROPOSE,
					speech_act: SpeechAct.CLAIM,
					content_ref: `turn ${i}`,
				});
			}

			const page1 = getDialogueEvents({ dialogue_id: DLG_ID, limit: 2, offset: 0 });
			expect(page1.success).toBe(true);
			if (page1.success) {
				expect(page1.value).toHaveLength(2);
			}

			const page2 = getDialogueEvents({ dialogue_id: DLG_ID, limit: 2, offset: 2 });
			expect(page2.success).toBe(true);
			if (page2.success) {
				expect(page2.value).toHaveLength(2);
			}
		});

		it('isolates dialogues', () => {
			writeDialogueTurn({
				dialogue_id: DLG_ID,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'dialogue 1',
			});
			writeDialogueTurn({
				dialogue_id: DLG_ID_2,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'dialogue 2',
			});

			const result = getDialogueEvents({ dialogue_id: DLG_ID });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].dialogue_id).toBe(DLG_ID);
			}
		});
	});

	describe('getDialogueEventById', () => {
		it('returns event by id', () => {
			const turn = writeDialogueTurn({
				dialogue_id: DLG_ID,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'test',
			});
			if (!turn.success) { return; }

			const result = getDialogueEventById(turn.value.event_id);
			expect(result.success).toBe(true);
			if (result.success && result.value) {
				expect(result.value.event_id).toBe(turn.value.event_id);
				expect(result.value.content).toBe('test');
			}
		});

		it('returns null for non-existent id', () => {
			const result = getDialogueEventById(999999);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBeNull();
			}
		});
	});

	describe('getClaims', () => {
		beforeEach(() => {
			const turn = writeDialogueTurn({
				dialogue_id: DLG_ID,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'setup',
			});
			expect(turn.success).toBe(true);
		});

		it('returns all claims for a dialogue', () => {
			const turn = writeDialogueTurn({ dialogue_id: DLG_ID, role: Role.EXECUTOR, phase: Phase.PROPOSE, speech_act: SpeechAct.CLAIM, content_ref: 'x' });
			if (!turn.success) { return; }

			writeClaim({
				dialogue_id: DLG_ID,
				statement: 'Claim 1',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.CRITICAL,
				status: ClaimStatus.OPEN,
				turn_id: turn.value.event_id,
			});
			writeClaim({
				dialogue_id: DLG_ID,
				statement: 'Claim 2',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.NON_CRITICAL,
				status: ClaimStatus.OPEN,
				turn_id: turn.value.event_id,
			});

			const result = getClaims({ dialogue_id: DLG_ID });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(2);
			}
		});

		it('filters by status', () => {
			const turn = writeDialogueTurn({ dialogue_id: DLG_ID, role: Role.EXECUTOR, phase: Phase.PROPOSE, speech_act: SpeechAct.CLAIM, content_ref: 'x' });
			if (!turn.success) { return; }

			writeClaim({
				dialogue_id: DLG_ID,
				statement: 'Open claim',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.CRITICAL,
				status: ClaimStatus.OPEN,
				turn_id: turn.value.event_id,
			});
			const claim2 = writeClaim({
				dialogue_id: DLG_ID,
				statement: 'Verified claim',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.CRITICAL,
				status: ClaimStatus.VERIFIED,
				turn_id: turn.value.event_id,
			});
			expect(claim2.success).toBe(true);

			const result = getClaims({ dialogue_id: DLG_ID, status: ClaimStatus.VERIFIED });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].status).toBe(ClaimStatus.VERIFIED);
			}
		});

		it('filters by criticality', () => {
			const turn = writeDialogueTurn({ dialogue_id: DLG_ID, role: Role.EXECUTOR, phase: Phase.PROPOSE, speech_act: SpeechAct.CLAIM, content_ref: 'x' });
			if (!turn.success) { return; }

			writeClaim({
				dialogue_id: DLG_ID,
				statement: 'Critical',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.CRITICAL,
				status: ClaimStatus.OPEN,
				turn_id: turn.value.event_id,
			});
			writeClaim({
				dialogue_id: DLG_ID,
				statement: 'Non-critical',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.NON_CRITICAL,
				status: ClaimStatus.OPEN,
				turn_id: turn.value.event_id,
			});

			const result = getClaims({ dialogue_id: DLG_ID, criticality: ClaimCriticality.CRITICAL });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].criticality).toBe(ClaimCriticality.CRITICAL);
			}
		});

		it('supports pagination', () => {
			const turn = writeDialogueTurn({ dialogue_id: DLG_ID, role: Role.EXECUTOR, phase: Phase.PROPOSE, speech_act: SpeechAct.CLAIM, content_ref: 'x' });
			if (!turn.success) { return; }

			for (let i = 0; i < 5; i++) {
				writeClaim({
					dialogue_id: DLG_ID,
					statement: `Claim ${i}`,
					introduced_by: Role.EXECUTOR,
					criticality: ClaimCriticality.CRITICAL,
					status: ClaimStatus.OPEN,
					turn_id: turn.value.event_id,
				});
			}

			const page1 = getClaims({ dialogue_id: DLG_ID, limit: 2, offset: 0 });
			expect(page1.success).toBe(true);
			if (page1.success) {
				expect(page1.value).toHaveLength(2);
			}
		});
	});

	describe('getClaimById', () => {
		it('returns claim by id', () => {
			const turn = writeDialogueTurn({ dialogue_id: DLG_ID, role: Role.EXECUTOR, phase: Phase.PROPOSE, speech_act: SpeechAct.CLAIM, content_ref: 'x' });
			if (!turn.success) { return; }

			const claim = writeClaim({
				dialogue_id: DLG_ID,
				statement: 'Test claim',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.CRITICAL,
				status: ClaimStatus.OPEN,
				turn_id: turn.value.event_id,
			});
			if (!claim.success) { return; }

			const result = getClaimById(claim.value.claim_id);
			expect(result.success).toBe(true);
			if (result.success && result.value) {
				expect(result.value.statement).toBe('Test claim');
			}
		});

		it('returns null for non-existent id', () => {
			const result = getClaimById('non-existent');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBeNull();
			}
		});
	});

	describe('getVerdicts', () => {
		it('returns verdicts for a claim', () => {
			const turn = writeDialogueTurn({ dialogue_id: DLG_ID, role: Role.EXECUTOR, phase: Phase.PROPOSE, speech_act: SpeechAct.CLAIM, content_ref: 'x' });
			if (!turn.success) { return; }

			const claim = writeClaim({
				dialogue_id: DLG_ID,
				statement: 'Test',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.CRITICAL,
				status: ClaimStatus.OPEN,
				turn_id: turn.value.event_id,
			});
			if (!claim.success) { return; }

			writeVerdict({
				claim_id: claim.value.claim_id,
				verdict: VerdictType.VERIFIED,
				constraints_ref: null,
				evidence_ref: null,
				rationale: 'test rationale',
				novel_dependency: false,
			});

			const result = getVerdicts({ claim_id: claim.value.claim_id });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].verdict).toBe(VerdictType.VERIFIED);
				expect(result.value[0].novel_dependency).toBe(false);
			}
		});

		it('filters by verdict type', () => {
			const turn = writeDialogueTurn({ dialogue_id: DLG_ID, role: Role.EXECUTOR, phase: Phase.PROPOSE, speech_act: SpeechAct.CLAIM, content_ref: 'x' });
			if (!turn.success) { return; }

			const claim = writeClaim({
				dialogue_id: DLG_ID,
				statement: 'Test',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.CRITICAL,
				status: ClaimStatus.OPEN,
				turn_id: turn.value.event_id,
			});
			if (!claim.success) { return; }

			writeVerdict({
				claim_id: claim.value.claim_id,
				verdict: VerdictType.VERIFIED,
				constraints_ref: null,
				evidence_ref: null,
				rationale: 'verified',
				novel_dependency: false,
			});
			writeVerdict({
				claim_id: claim.value.claim_id,
				verdict: VerdictType.DISPROVED,
				constraints_ref: null,
				evidence_ref: null,
				rationale: 'disproved',
				novel_dependency: false,
			});

			const result = getVerdicts({ claim_id: claim.value.claim_id, verdict: VerdictType.DISPROVED });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].verdict).toBe(VerdictType.DISPROVED);
			}
		});

		it('correctly converts novel_dependency from integer to boolean', () => {
			const turn = writeDialogueTurn({ dialogue_id: DLG_ID, role: Role.EXECUTOR, phase: Phase.PROPOSE, speech_act: SpeechAct.CLAIM, content_ref: 'x' });
			if (!turn.success) { return; }

			const claim = writeClaim({
				dialogue_id: DLG_ID,
				statement: 'Test',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.CRITICAL,
				status: ClaimStatus.OPEN,
				turn_id: turn.value.event_id,
			});
			if (!claim.success) { return; }

			writeVerdict({
				claim_id: claim.value.claim_id,
				verdict: VerdictType.CONDITIONAL,
				constraints_ref: null,
				evidence_ref: null,
				rationale: 'has dependency',
				novel_dependency: true,
			});

			const result = getVerdicts({ claim_id: claim.value.claim_id });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value[0].novel_dependency).toBe(true);
				expect(typeof result.value[0].novel_dependency).toBe('boolean');
			}
		});
	});

	describe('getGates', () => {
		it('returns gates for a dialogue', () => {
			const gate = createGate({
				dialogueId: DLG_ID,
				reason: 'Test gate',
				blockingClaims: ['claim-1'],
			});
			expect(gate.success).toBe(true);

			const result = getGates({ dialogue_id: DLG_ID });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].reason).toBe('Test gate');
			}
		});

		it('parses blocking_claims JSON array', () => {
			const gate = createGate({
				dialogueId: DLG_ID,
				reason: 'Multi-claim gate',
				blockingClaims: ['claim-1', 'claim-2', 'claim-3'],
			});
			expect(gate.success).toBe(true);

			const result = getGates({ dialogue_id: DLG_ID });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value[0].blocking_claims).toEqual(['claim-1', 'claim-2', 'claim-3']);
				expect(Array.isArray(result.value[0].blocking_claims)).toBe(true);
			}
		});

		it('filters by status', () => {
			createGate({
				dialogueId: DLG_ID,
				reason: 'Open gate',
				blockingClaims: [],
			});

			const result = getGates({ dialogue_id: DLG_ID, status: GateStatus.OPEN });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].status).toBe(GateStatus.OPEN);
			}
		});
	});

	describe('getGateById', () => {
		it('returns gate by id with parsed blocking_claims', () => {
			const gate = createGate({
				dialogueId: DLG_ID,
				reason: 'Test',
				blockingClaims: ['claim-x', 'claim-y'],
			});
			if (!gate.success) { return; }

			const result = getGateById(gate.value.gate_id);
			expect(result.success).toBe(true);
			if (result.success && result.value) {
				expect(result.value.blocking_claims).toEqual(['claim-x', 'claim-y']);
			}
		});

		it('returns null for non-existent id', () => {
			const result = getGateById('non-existent');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBeNull();
			}
		});
	});

	describe('getHumanDecisions', () => {
		it('returns decisions for a gate', () => {
			const gate = createGate({
				dialogueId: DLG_ID,
				reason: 'Test',
				blockingClaims: [],
			});
			if (!gate.success) { return; }

			writeHumanDecision({
				gate_id: gate.value.gate_id,
				action: HumanAction.APPROVE,
				rationale: 'Looks good',
				attachments_ref: null,
			});

			const result = getHumanDecisions({ gate_id: gate.value.gate_id });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].action).toBe(HumanAction.APPROVE);
			}
		});

		it('filters by action', () => {
			const gate = createGate({
				dialogueId: DLG_ID,
				reason: 'Test',
				blockingClaims: [],
			});
			if (!gate.success) { return; }

			writeHumanDecision({
				gate_id: gate.value.gate_id,
				action: HumanAction.APPROVE,
				rationale: 'Approved',
				attachments_ref: null,
			});
			writeHumanDecision({
				gate_id: gate.value.gate_id,
				action: HumanAction.REJECT,
				rationale: 'Rejected',
				attachments_ref: null,
			});

			const result = getHumanDecisions({ gate_id: gate.value.gate_id, action: HumanAction.REJECT });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].action).toBe(HumanAction.REJECT);
			}
		});
	});

	describe('getArtifactByHash', () => {
		it('returns artifact by hash', () => {
			const db = getDatabase()!;
			// artifacts schema: (artifact_id UUID36 PK, content_hash UNIQUE, content BLOB, mime_type, size INTEGER, created_at)
			db.prepare(
				'INSERT INTO artifacts (artifact_id, content_hash, content, mime_type, size, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))'
			).run('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01', 'abc123', Buffer.from('test content'), 'text/plain', 12);

			const result = getArtifactByHash('abc123');
			expect(result.success).toBe(true);
			if (result.success && result.value) {
				// content is BLOB; better-sqlite3 returns Buffer for BLOB columns.
				expect(Buffer.from(result.value.content as unknown as Buffer).toString('utf8')).toBe('test content');
			}
		});

		it('returns null for non-existent hash', () => {
			const result = getArtifactByHash('non-existent');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBeNull();
			}
		});
	});

	describe('getIntakeConversation', () => {
		it('returns null when no conversation exists', () => {
			const result = getIntakeConversation(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBeNull();
			}
		});

		it('returns parsed conversation with JSON fields', () => {
			const conv = getOrCreateIntakeConversation(DLG_ID);
			expect(conv.success).toBe(true);

			const result = getIntakeConversation(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success && result.value) {
				expect(result.value.dialogueId).toBe(DLG_ID);
				expect(result.value.subState).toBe(IntakeSubState.DISCUSSING);
				expect(typeof result.value.draftPlan).toBe('object');
				expect(Array.isArray(result.value.accumulations)).toBe(true);
			}
		});
	});

	describe('getOrCreateIntakeConversation', () => {
		it('creates conversation if none exists', () => {
			const result = getOrCreateIntakeConversation(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.dialogueId).toBe(DLG_ID);
				expect(result.value.subState).toBe(IntakeSubState.DISCUSSING);
				expect(result.value.turnCount).toBe(0);
			}
		});

		it('returns existing conversation if present', () => {
			const first = getOrCreateIntakeConversation(DLG_ID);
			expect(first.success).toBe(true);
			if (!first.success) { return; }

			updateIntakeConversation(DLG_ID, { turnCount: 5 });

			const second = getOrCreateIntakeConversation(DLG_ID);
			expect(second.success).toBe(true);
			if (second.success) {
				expect(second.value.turnCount).toBe(5);
				expect(second.value.id).toBe(first.value.id);
			}
		});
	});

	describe('getIntakeTurns', () => {
		it('returns intake turns ordered chronologically', () => {
			const db = getDatabase()!;
			db.prepare(
				"INSERT INTO dialogue_events (dialogue_id, event_type, role, phase, speech_act, summary, content, detail, timestamp) VALUES (?, 'intake_turn', 'TECHNICAL_EXPERT', 'INTAKE', 'INFORM', 'turn 1', 'content 1', json('{\"turnNumber\": 1, \"humanMessage\": \"q1\", \"expertResponse\": \"a1\"}'), datetime('now'))"
			).run(DLG_ID);
			db.prepare(
				"INSERT INTO dialogue_events (dialogue_id, event_type, role, phase, speech_act, summary, content, detail, timestamp) VALUES (?, 'intake_turn', 'TECHNICAL_EXPERT', 'INTAKE', 'INFORM', 'turn 2', 'content 2', json('{\"turnNumber\": 2, \"humanMessage\": \"q2\", \"expertResponse\": \"a2\"}'), datetime('now'))"
			).run(DLG_ID);

			const result = getIntakeTurns(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(2);
				expect(result.value[0].turnNumber).toBe(1);
				expect(result.value[1].turnNumber).toBe(2);
			}
		});

		it('supports pagination', () => {
			const db = getDatabase()!;
			for (let i = 1; i <= 5; i++) {
				db.prepare(
					"INSERT INTO dialogue_events (dialogue_id, event_type, role, phase, speech_act, summary, content, detail, timestamp) VALUES (?, 'intake_turn', 'TECHNICAL_EXPERT', 'INTAKE', 'INFORM', ?, '', json(?), datetime('now'))"
				).run(DLG_ID, `turn ${i}`, JSON.stringify({ turnNumber: i }));
			}

			const page1 = getIntakeTurns(DLG_ID, { limit: 2, offset: 0 });
			expect(page1.success).toBe(true);
			if (page1.success) {
				expect(page1.value).toHaveLength(2);
			}

			const page2 = getIntakeTurns(DLG_ID, { limit: 2, offset: 2 });
			expect(page2.success).toBe(true);
			if (page2.success) {
				expect(page2.value).toHaveLength(2);
			}
		});
	});

	describe('getRecentIntakeTurns', () => {
		it('returns last N turns in chronological order', () => {
			const db = getDatabase()!;
			for (let i = 1; i <= 10; i++) {
				db.prepare(
					"INSERT INTO dialogue_events (dialogue_id, event_type, role, phase, speech_act, summary, content, detail, timestamp) VALUES (?, 'intake_turn', 'TECHNICAL_EXPERT', 'INTAKE', 'INFORM', ?, '', json(?), datetime('now', '+' || ? || ' seconds'))"
				).run(DLG_ID, `turn ${i}`, JSON.stringify({ turnNumber: i }), i);
			}

			const result = getRecentIntakeTurns(DLG_ID, 3);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(3);
				expect(result.value[0].turnNumber).toBe(8);
				expect(result.value[1].turnNumber).toBe(9);
				expect(result.value[2].turnNumber).toBe(10);
			}
		});
	});

	describe('getIntakeTurnsInRange', () => {
		it('returns turns within turn number range', () => {
			const db = getDatabase()!;
			for (let i = 1; i <= 5; i++) {
				db.prepare(
					"INSERT INTO dialogue_events (dialogue_id, event_type, role, phase, speech_act, summary, content, detail, timestamp) VALUES (?, 'intake_turn', 'TECHNICAL_EXPERT', 'INTAKE', 'INFORM', ?, '', json(?), datetime('now'))"
				).run(DLG_ID, `turn ${i}`, JSON.stringify({ turnNumber: i }));
			}

			const result = getIntakeTurnsInRange(DLG_ID, 1, 4);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(2);
				expect(result.value[0].turnNumber).toBe(2);
				expect(result.value[1].turnNumber).toBe(3);
			}
		});
	});

	describe('getArchitectureEvents', () => {
		it('returns architecture events chronologically', () => {
			const db = getDatabase()!;
			db.prepare(
				"INSERT INTO dialogue_events (dialogue_id, event_type, role, phase, speech_act, summary, content, timestamp) VALUES (?, 'architecture_design', 'ARCHITECTURE_EXPERT', 'ARCHITECTURE', 'INFORM', 'design', 'content', datetime('now'))"
			).run(DLG_ID);
			db.prepare(
				"INSERT INTO dialogue_events (dialogue_id, event_type, role, phase, speech_act, summary, content, timestamp) VALUES (?, 'architecture_validation', 'ARCHITECTURE_EXPERT', 'ARCHITECTURE', 'ASSESS', 'validation', 'content', datetime('now', '+1 seconds'))"
			).run(DLG_ID);

			const result = getArchitectureEvents(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(2);
				expect(result.value[0].event_type).toBe('architecture_design');
			}
		});
	});

	describe('getLatestArchitectureValidation', () => {
		it('returns most recent validation event', () => {
			const db = getDatabase()!;
			db.prepare(
				"INSERT INTO dialogue_events (dialogue_id, event_type, role, phase, speech_act, summary, content, timestamp) VALUES (?, 'architecture_validation', 'ARCHITECTURE_EXPERT', 'ARCHITECTURE', 'ASSESS', 'v1', 'content', datetime('now'))"
			).run(DLG_ID);
			db.prepare(
				"INSERT INTO dialogue_events (dialogue_id, event_type, role, phase, speech_act, summary, content, timestamp) VALUES (?, 'architecture_validation', 'ARCHITECTURE_EXPERT', 'ARCHITECTURE', 'ASSESS', 'v2', 'content', datetime('now', '+1 seconds'))"
			).run(DLG_ID);

			const result = getLatestArchitectureValidation(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success && result.value) {
				expect(result.value.summary).toBe('v2');
			}
		});

		it('returns null if no validation exists', () => {
			const result = getLatestArchitectureValidation(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBeNull();
			}
		});
	});

	describe('getQaExchanges', () => {
		it('returns Q&A exchanges chronologically', () => {
			const db = getDatabase()!;
			db.prepare(
				"INSERT INTO cli_activity_events (dialogue_id, command_id, event_type, summary, detail, phase, timestamp) VALUES (?, 'cmd-1', 'qa_exchange', 'Q1', 'A1', 'INTAKE', datetime('now'))"
			).run(DLG_ID);
			db.prepare(
				"INSERT INTO cli_activity_events (dialogue_id, command_id, event_type, summary, detail, phase, timestamp) VALUES (?, 'cmd-1', 'qa_exchange', 'Q2', 'A2', 'INTAKE', datetime('now', '+1 seconds'))"
			).run(DLG_ID);

			const result = getQaExchanges(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(2);
				expect(result.value[0].question).toBe('Q1');
				expect(result.value[0].answer).toBe('A1');
				expect(result.value[1].question).toBe('Q2');
			}
		});
	});
});
