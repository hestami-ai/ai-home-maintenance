import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import { initializeWorkflowState } from '../../../lib/workflow/stateMachine';
import {
	createGate,
	createReviewGate,
	getGate,
	getGatesForDialogue,
	resolveGate,
	checkGateTriggers,
	triggerGateIfNeeded,
	getBlockingClaims,
	hasOpenGates,
	getGateResolution,
	createRepairEscalationGate,
	GateTriggerCondition,
} from '../../../lib/workflow/gates';
import { GateStatus, HumanAction, ClaimStatus } from '../../../lib/types';
import { getDatabase } from '../../../lib/database/init';
import { writeHumanDecision } from '../../../lib/events/writer';
import { randomUUID } from 'node:crypto';

describe('Gate Management', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	const ID1 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
	const ID2 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee02';
	const ID3 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee03';
	const ID4 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee04';
	const ID5 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee05';

	function setupDialogue(id: string): void {
		const db = getDatabase()!;
		db.prepare(
			"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, 'test', 'ACTIVE', datetime('now'))"
		).run(id);
		initializeWorkflowState(id);
	}

	function createClaim(dialogueId: string, statement: string, criticality: string, status: string): string {
		const db = getDatabase()!;
		// claims.turn_id is NOT NULL with composite FK to dialogue_events(dialogue_id, event_id).
		// Seed a dialogue_event and use its event_id.
		const turnInsert = db.prepare(`
			INSERT INTO dialogue_events (dialogue_id, event_type, role, phase, speech_act, summary, content, timestamp)
			VALUES (?, 'claim', 'EXECUTOR', 'PROPOSE', 'CLAIM', 'seed turn', 'seed', datetime('now'))
		`).run(dialogueId);
		const turnId = Number(turnInsert.lastInsertRowid);

		const claimId = randomUUID();
		db.prepare(
			`INSERT INTO claims (claim_id, statement, introduced_by, criticality, status, dialogue_id, turn_id, created_at)
			 VALUES (?, ?, 'EXECUTOR', ?, ?, ?, ?, datetime('now'))`
		).run(claimId, statement, criticality, status, dialogueId, turnId);
		return claimId;
	}

	describe('createGate', () => {
		it('creates a gate with OPEN status', () => {
			setupDialogue(ID1);
			const result = createGate({
				dialogueId: ID1,
				reason: 'Critical claim disproved',
				blockingClaims: ['claim-001'],
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.status).toBe(GateStatus.OPEN);
				expect(result.value.dialogue_id).toBe(ID1);
				expect(result.value.blocking_claims).toEqual(['claim-001']);
			}
		});

		it('creates gate with metadata', () => {
			setupDialogue(ID1);
			const result = createGate({
				dialogueId: ID1,
				reason: 'Test gate',
				blockingClaims: [],
				metadata: { condition: GateTriggerCondition.MANUAL_GATE },
			});
			expect(result.success).toBe(true);
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = createGate({
				dialogueId: ID1,
				reason: 'Test',
				blockingClaims: [],
			});
			expect(result.success).toBe(false);
		});
	});

	describe('createReviewGate', () => {
		it('creates a review gate without blocking claims', () => {
			setupDialogue(ID2);
			const result = createReviewGate(ID2, 'Human review required');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.status).toBe(GateStatus.OPEN);
				expect(result.value.blocking_claims).toEqual([]);
			}
		});
	});

	describe('getGate', () => {
		it('retrieves existing gate', () => {
			setupDialogue(ID1);
			const createResult = createGate({
				dialogueId: ID1,
				reason: 'Test',
				blockingClaims: ['claim-1'],
			});
			expect(createResult.success).toBe(true);
			if (!createResult.success) {return;}

			const getResult = getGate(createResult.value.gate_id);
			expect(getResult.success).toBe(true);
			if (getResult.success) {
				expect(getResult.value.gate_id).toBe(createResult.value.gate_id);
				expect(getResult.value.blocking_claims).toEqual(['claim-1']);
			}
		});

		it('returns error for nonexistent gate', () => {
			const result = getGate('nonexistent-gate-id');
			expect(result.success).toBe(false);
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = getGate('some-id');
			expect(result.success).toBe(false);
		});
	});

	describe('getGatesForDialogue', () => {
		it('retrieves all gates for dialogue', () => {
			setupDialogue(ID1);
			createGate({ dialogueId: ID1, reason: 'Gate 1', blockingClaims: [] });
			createGate({ dialogueId: ID1, reason: 'Gate 2', blockingClaims: [] });

			const result = getGatesForDialogue(ID1);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(2);
			}
		});

		it('filters gates by status', () => {
			setupDialogue(ID1);
			const gate1 = createGate({ dialogueId: ID1, reason: 'Gate 1', blockingClaims: [] });
			createGate({ dialogueId: ID1, reason: 'Gate 2', blockingClaims: [] });

			if (gate1.success) {
				const decision = writeHumanDecision({
					gate_id: gate1.value.gate_id,
					action: HumanAction.REJECT,
					rationale: 'Test',
					attachments_ref: null,
				});
				if (decision.success) {
					resolveGate({
						gateId: gate1.value.gate_id,
						decisionId: decision.value.decision_id,
						resolution: 'Resolved',
					});
				}
			}

			const openResult = getGatesForDialogue(ID1, GateStatus.OPEN);
			expect(openResult.success).toBe(true);
			if (openResult.success) {
				expect(openResult.value.length).toBe(1);
			}
		});

		it('returns empty array for dialogue with no gates', () => {
			setupDialogue(ID1);
			const result = getGatesForDialogue(ID1);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = getGatesForDialogue(ID1);
			expect(result.success).toBe(false);
		});
	});

	describe('resolveGate', () => {
		it('resolves a gate to RESOLVED status', () => {
			setupDialogue(ID5);
			const createResult = createGate({
				dialogueId: ID5,
				reason: 'Test gate for resolution',
				blockingClaims: [],
			});
			expect(createResult.success).toBe(true);
			if (!createResult.success) {return;}

			const decisionResult = writeHumanDecision({
				gate_id: createResult.value.gate_id,
				action: HumanAction.REJECT,
				rationale: 'Needs changes',
				attachments_ref: null,
			});
			expect(decisionResult.success).toBe(true);
			if (!decisionResult.success) {return;}

			const resolveResult = resolveGate({
				gateId: createResult.value.gate_id,
				decisionId: decisionResult.value.decision_id,
				resolution: 'Resolved after review',
			});
			expect(resolveResult.success).toBe(true);
			if (resolveResult.success) {
				expect(resolveResult.value.status).toBe(GateStatus.RESOLVED);
				expect(resolveResult.value.resolved_at).not.toBeNull();
			}
		});

		it('stores resolution metadata', () => {
			setupDialogue(ID1);
			const gate = createGate({ dialogueId: ID1, reason: 'Test', blockingClaims: [] });
			if (!gate.success) {return;}

			const decision = writeHumanDecision({
				gate_id: gate.value.gate_id,
				action: HumanAction.APPROVE,
				rationale: 'OK',
				attachments_ref: null,
			});
			if (!decision.success) {return;}

			const result = resolveGate({
				gateId: gate.value.gate_id,
				decisionId: decision.value.decision_id,
				resolution: 'Approved',
				metadata: { notes: 'All good' },
			});
			expect(result.success).toBe(true);
		});

		it('rejects already resolved gate', () => {
			setupDialogue(ID1);
			const gate = createGate({ dialogueId: ID1, reason: 'Test', blockingClaims: [] });
			if (!gate.success) {return;}

			const decision = writeHumanDecision({
				gate_id: gate.value.gate_id,
				action: HumanAction.APPROVE,
				rationale: 'OK',
				attachments_ref: null,
			});
			if (!decision.success) {return;}

			resolveGate({
				gateId: gate.value.gate_id,
				decisionId: decision.value.decision_id,
				resolution: 'First resolution',
			});

			const secondResolve = resolveGate({
				gateId: gate.value.gate_id,
				decisionId: decision.value.decision_id,
				resolution: 'Second resolution',
			});
			expect(secondResolve.success).toBe(false);
		});

		it('rejects nonexistent gate', () => {
			const result = resolveGate({
				gateId: 'nonexistent',
				decisionId: 'decision-1',
				resolution: 'Test',
			});
			expect(result.success).toBe(false);
		});
	});

	describe('checkGateTriggers', () => {
		it('detects disproved critical claims', () => {
			setupDialogue(ID1);
			createClaim(ID1, 'Critical assumption', 'CRITICAL', ClaimStatus.DISPROVED);

			const result = checkGateTriggers(ID1);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.shouldTrigger).toBe(true);
				expect(result.value.condition).toBe(GateTriggerCondition.CRITICAL_CLAIM_DISPROVED);
			}
		});

		it('detects unknown critical claims', () => {
			setupDialogue(ID1);
			createClaim(ID1, 'Critical assumption', 'CRITICAL', ClaimStatus.UNKNOWN);

			const result = checkGateTriggers(ID1);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.shouldTrigger).toBe(true);
				expect(result.value.condition).toBe(GateTriggerCondition.CRITICAL_CLAIM_UNKNOWN);
			}
		});

		it('returns no trigger when no critical issues', () => {
			setupDialogue(ID1);
			createClaim(ID1, 'Normal claim', 'NORMAL', ClaimStatus.VERIFIED);

			const result = checkGateTriggers(ID1);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.shouldTrigger).toBe(false);
			}
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = checkGateTriggers(ID1);
			expect(result.success).toBe(false);
		});
	});

	describe('triggerGateIfNeeded', () => {
		it('creates gate when trigger condition met', () => {
			setupDialogue(ID1);
			createClaim(ID1, 'Critical', 'CRITICAL', ClaimStatus.DISPROVED);

			const result = triggerGateIfNeeded(ID1);
			expect(result.success).toBe(true);
			if (result.success && result.value) {
				expect(result.value.status).toBe(GateStatus.OPEN);
			}
		});

		it('returns null when no trigger condition', () => {
			setupDialogue(ID1);
			const result = triggerGateIfNeeded(ID1);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBeNull();
			}
		});
	});

	describe('getBlockingClaims', () => {
		it('retrieves blocking claims for gate', () => {
			setupDialogue(ID1);
			const claimId = createClaim(ID1, 'Test claim', 'CRITICAL', ClaimStatus.DISPROVED);
			const gate = createGate({
				dialogueId: ID1,
				reason: 'Test',
				blockingClaims: [claimId],
			});
			if (!gate.success) {return;}

			const result = getBlockingClaims(gate.value.gate_id);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(1);
				expect(result.value[0].claim_id).toBe(claimId);
			}
		});

		it('returns empty array for gate without blocking claims', () => {
			setupDialogue(ID1);
			const gate = createGate({ dialogueId: ID1, reason: 'Test', blockingClaims: [] });
			if (!gate.success) {return;}

			const result = getBlockingClaims(gate.value.gate_id);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('handles nonexistent gate', () => {
			const result = getBlockingClaims('nonexistent');
			expect(result.success).toBe(false);
		});
	});

	describe('hasOpenGates', () => {
		it('returns true when gate is open', () => {
			setupDialogue(ID3);
			createGate({
				dialogueId: ID3,
				reason: 'test gate',
				blockingClaims: [],
			});
			const result = hasOpenGates(ID3);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBe(true);
			}
		});

		it('returns false when no gates exist', () => {
			setupDialogue(ID4);
			const result = hasOpenGates(ID4);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBe(false);
			}
		});

		it('returns false when all gates resolved', () => {
			setupDialogue(ID1);
			const gate = createGate({ dialogueId: ID1, reason: 'Test', blockingClaims: [] });
			if (!gate.success) {return;}

			const decision = writeHumanDecision({
				gate_id: gate.value.gate_id,
				action: HumanAction.APPROVE,
				rationale: 'OK',
				attachments_ref: null,
			});
			if (!decision.success) {return;}

			resolveGate({
				gateId: gate.value.gate_id,
				decisionId: decision.value.decision_id,
				resolution: 'Done',
			});

			const result = hasOpenGates(ID1);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBe(false);
			}
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = hasOpenGates(ID1);
			expect(result.success).toBe(false);
		});
	});

	describe('getGateResolution', () => {
		it('retrieves resolution details', () => {
			setupDialogue(ID1);
			const gate = createGate({ dialogueId: ID1, reason: 'Test', blockingClaims: [] });
			if (!gate.success) {return;}

			const decision = writeHumanDecision({
				gate_id: gate.value.gate_id,
				action: HumanAction.APPROVE,
				rationale: 'OK',
				attachments_ref: null,
			});
			if (!decision.success) {return;}

			resolveGate({
				gateId: gate.value.gate_id,
				decisionId: decision.value.decision_id,
				resolution: 'Approved',
				metadata: { notes: 'Test notes' },
			});

			const result = getGateResolution(gate.value.gate_id);
			expect(result.success).toBe(true);
			if (result.success && result.value) {
				expect(result.value.resolution).toBe('Approved');
				expect(result.value.metadata.notes).toBe('Test notes');
			}
		});

		it('returns null for unresolved gate', () => {
			setupDialogue(ID1);
			const gate = createGate({ dialogueId: ID1, reason: 'Test', blockingClaims: [] });
			if (!gate.success) {return;}

			const result = getGateResolution(gate.value.gate_id);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBeNull();
			}
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = getGateResolution('some-id');
			expect(result.success).toBe(false);
		});
	});

	describe('createRepairEscalationGate', () => {
		it('creates repair escalation gate', () => {
			setupDialogue(ID1);
			const result = createRepairEscalationGate(
				ID1,
				'unit-123',
				'verification_failure',
				'Unit failed verification',
				'Task Unit Label'
			);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.status).toBe(GateStatus.OPEN);
			}
		});
	});

	describe('integration scenarios', () => {
		it('manages complete gate lifecycle', () => {
			setupDialogue(ID1);

			const create = createGate({
				dialogueId: ID1,
				reason: 'Review required',
				blockingClaims: [],
			});
			expect(create.success).toBe(true);
			if (!create.success) {return;}

			const check = hasOpenGates(ID1);
			expect(check.success && check.value).toBe(true);

			const decision = writeHumanDecision({
				gate_id: create.value.gate_id,
				action: HumanAction.APPROVE,
				rationale: 'Looks good',
				attachments_ref: null,
			});
			expect(decision.success).toBe(true);
			if (!decision.success) {return;}

			const resolve = resolveGate({
				gateId: create.value.gate_id,
				decisionId: decision.value.decision_id,
				resolution: 'Approved',
			});
			expect(resolve.success).toBe(true);

			const checkAfter = hasOpenGates(ID1);
			expect(checkAfter.success && checkAfter.value).toBe(false);
		});

		it('handles multiple gates for same dialogue', () => {
			setupDialogue(ID1);
			createGate({ dialogueId: ID1, reason: 'Gate 1', blockingClaims: [] });
			createGate({ dialogueId: ID1, reason: 'Gate 2', blockingClaims: [] });
			createGate({ dialogueId: ID1, reason: 'Gate 3', blockingClaims: [] });

			const result = getGatesForDialogue(ID1);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(3);
			}
		});
	});
});
