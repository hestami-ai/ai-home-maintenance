import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import { initializeWorkflowState } from '../../../lib/workflow/stateMachine';
import {
	createGate,
	createReviewGate,
	resolveGate,
	hasOpenGates,
} from '../../../lib/workflow/gates';
import { GateStatus } from '../../../lib/types';
import { getDatabase } from '../../../lib/database/init';
import { writeHumanDecision } from '../../../lib/events/writer';

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

	// UUID-format IDs (36 chars) required by CHECK constraint
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
		}
	});

	it('creates a review gate without blocking claims', () => {
		setupDialogue(ID2);
		const result = createReviewGate(ID2, 'Human review required');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.status).toBe(GateStatus.OPEN);
		}
	});

	it('hasOpenGates returns true when gate is open', () => {
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

	it('hasOpenGates returns false when no gates exist', () => {
		setupDialogue(ID4);
		const result = hasOpenGates(ID4);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value).toBe(false);
		}
	});

	it('resolves a gate to RESOLVED status', () => {
		setupDialogue(ID5);
		const createResult = createGate({
			dialogueId: ID5,
			reason: 'Test gate for resolution',
			blockingClaims: [],
		});
		expect(createResult.success).toBe(true);
		if (!createResult.success) { return; }

		// Write a human decision (use REJECT so it doesn't auto-resolve the gate)
		const decisionResult = writeHumanDecision({
			gate_id: createResult.value.gate_id,
			action: 'REJECT',
			rationale: 'Needs changes',
		});
		expect(decisionResult.success).toBe(true);
		if (!decisionResult.success) { return; }

		// Now explicitly resolve the gate
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
});
